'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { toast } from '@/components/ui/toast'
import { MAX_MEDIA_PER_ITEM } from '@/domain/media'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import { discardItemUploadsAction } from '@/server/actions/media'
import { saveItemAction } from '@/server/actions/menu'
import {
  draftFingerprint,
  draftFromItem,
  emptyDraft,
  firstErrorMessage,
  hasErrors,
  MAX_VARIANTS,
  toSavePayload,
  validateDraft,
  type DraftErrors,
  type ItemDraft,
  type MediaDraft,
  type MediaPrep,
  type UploadedMedia,
  type VariantDraft,
} from '../lib/item-draft'
import { inspectFile, prepareMedia, uploadPreparedMedia, type SelectedFile } from '../lib/media-prep'

export type SavePhase = 'idle' | 'preparing' | 'uploading' | 'saving'
type SentFile = { kind: 'image' | 'video'; path: string }

function revokePreviews(media: MediaDraft[]) {
  for (const entry of media) {
    if (entry.source.type === 'new' && entry.source.previewUrl) URL.revokeObjectURL(entry.source.previewUrl)
  }
}

// O item em edição, do desktop e do celular. Tudo fica no navegador até o
// "Salvar": a preparação da mídia (compressão e conferência) roda em
// segundo plano, um arquivo por vez; o salvar espera ela terminar, sobe os
// arquivos e grava tudo numa chamada (`saveItemAction`).
export function useItemDraft({
  restaurantId,
  item,
  categoryId,
  onSaved,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO | null
  categoryId: string
  onSaved: () => void
}) {
  const [initial] = useState(() => (item ? draftFromItem(item) : emptyDraft(categoryId)))
  const initialFingerprint = useMemo(() => draftFingerprint(initial), [initial])
  const [draft, setDraft] = useState<ItemDraft>(initial)
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  })

  const [phase, setPhase] = useState<SavePhase>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mediaNotices, setMediaNotices] = useState<string[]>([])
  const [inspecting, setInspecting] = useState(0)
  const [errorTick, setErrorTick] = useState(0)
  const [, startSave] = useTransition()

  // Arquivos e preparação em refs: a fila e o salvar leem o valor ATUAL, e
  // não o do último render.
  const filesRef = useRef(new Map<string, SelectedFile>())
  const prepRef = useRef(new Map<string, MediaPrep>())
  const queueRef = useRef<string[]>([])
  const runningRef = useRef(false)
  const waitersRef = useRef<(() => void)[]>([])
  const inspectionsRef = useRef(new Set<Promise<void>>())
  const itemIdRef = useRef<string | null>(item?.id ?? null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      revokePreviews(draftRef.current.media)
    }
  }, [])

  const errors = useMemo<DraftErrors>(() => (attempted ? validateDraft(draft) : {}), [attempted, draft])
  const dirty = draftFingerprint(draft) !== initialFingerprint
  const busy = phase !== 'idle'

  const update = useCallback(<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }, [])

  // --- Variações ---------------------------------------------------------

  const setPricing = useCallback((mode: ItemDraft['pricing']): string | null => {
    const current = draftRef.current
    if (mode === current.pricing) return null
    if (mode === 'variants' && current.variants.length === 0) {
      // O preço já digitado vira a primeira variação, só faltando o nome.
      const key = crypto.randomUUID()
      setDraft((latest) => ({
        ...latest,
        pricing: 'variants',
        variants: [{ key, name: '', priceCents: latest.basePriceCents, isAvailable: true }],
      }))
      return key
    }
    setDraft((latest) => ({ ...latest, pricing: mode }))
    return null
  }, [])

  const addVariant = useCallback((): string => {
    const key = crypto.randomUUID()
    setDraft((current) =>
      current.variants.length >= MAX_VARIANTS
        ? current
        : { ...current, variants: [...current.variants, { key, name: '', priceCents: null, isAvailable: true }] },
    )
    return key
  }, [])

  const updateVariant = useCallback((key: string, change: Partial<VariantDraft>) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.key === key ? { ...variant, ...change } : variant)),
    }))
  }, [])

  const removeVariant = useCallback((key: string) => {
    setDraft((current) => ({ ...current, variants: current.variants.filter((variant) => variant.key !== key) }))
  }, [])

  const moveVariant = useCallback((activeKey: string, overKey: string) => {
    setDraft((current) => {
      const from = current.variants.findIndex((variant) => variant.key === activeKey)
      const to = current.variants.findIndex((variant) => variant.key === overKey)
      if (from < 0 || to < 0 || from === to) return current
      return { ...current, variants: arrayMove(current.variants, from, to) }
    })
  }, [])

  // --- Mídia --------------------------------------------------------------

  const setPrep = useCallback((key: string, prep: MediaPrep) => {
    prepRef.current.set(key, prep)
    setDraft((current) => ({
      ...current,
      media: current.media.map((media) =>
        media.key === key && media.source.type === 'new' ? { ...media, source: { ...media.source, prep } } : media,
      ),
    }))
  }, [])

  const setUpload = useCallback((key: string, upload: 'idle' | 'uploading' | 'done') => {
    setDraft((current) => ({
      ...current,
      media: current.media.map((media) =>
        media.key === key && media.source.type === 'new' ? { ...media, source: { ...media.source, upload } } : media,
      ),
    }))
  }, [])

  const settleWaiters = useCallback(() => {
    if (runningRef.current || queueRef.current.length > 0) return
    const waiters = waitersRef.current
    waitersRef.current = []
    for (const resolve of waiters) resolve()
  }, [])

  // Um arquivo por vez: comprimir vídeo é pesado, e em paralelo travaria o
  // celular. Arquivo removido antes da vez dele é pulado.
  const pump = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    while (queueRef.current.length > 0 && mountedRef.current) {
      const key = queueRef.current.shift() as string
      const selected = filesRef.current.get(key)
      if (!selected) continue
      setPrep(key, { status: 'preparing', progress: 0 })
      try {
        const prepared = await prepareMedia(selected, (percentage) => {
          if (filesRef.current.has(key)) setPrep(key, { status: 'preparing', progress: percentage })
        })
        if (filesRef.current.has(key)) setPrep(key, { status: 'ready', ...prepared })
      } catch (error) {
        if (filesRef.current.has(key)) {
          setPrep(key, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Não foi possível preparar o arquivo.',
          })
        }
      }
    }
    runningRef.current = false
    settleWaiters()
  }, [setPrep, settleWaiters])

  const waitForPrep = useCallback(async () => {
    while (inspectionsRef.current.size > 0) await Promise.all([...inspectionsRef.current])
    if (!runningRef.current && queueRef.current.length === 0) return
    await new Promise<void>((resolve) => {
      waitersRef.current.push(resolve)
    })
  }, [])

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return
    setMediaNotices([])
    setInspecting((count) => count + 1)
    const task = (async () => {
      try {
        const inspected = await Promise.all(files.map((file) => inspectFile(file)))
        if (!mountedRef.current) return
        const notices: string[] = []
        const accepted: MediaDraft[] = []
        let free = Math.max(0, MAX_MEDIA_PER_ITEM - draftRef.current.media.length)
        for (const result of inspected) {
          if (!result.ok) {
            notices.push(result.error)
            continue
          }
          if (free <= 0) {
            notices.push(`Este prato já chegou a ${MAX_MEDIA_PER_ITEM} telas; “${result.value.file.name}” ficou de fora.`)
            continue
          }
          free -= 1
          const key = crypto.randomUUID()
          const preview = result.value.kind === 'image' ? result.value.file : result.value.posterBlob
          filesRef.current.set(key, result.value)
          prepRef.current.set(key, { status: 'queued' })
          accepted.push({
            key,
            source: {
              type: 'new',
              kind: result.value.kind,
              fileName: result.value.file.name,
              previewUrl: preview ? URL.createObjectURL(preview) : null,
              prep: { status: 'queued' },
              upload: 'idle',
            },
            focalX: 0.5,
            focalY: 0.5,
          })
        }
        if (notices.length > 0) setMediaNotices(notices)
        if (accepted.length === 0) return
        // O ref vai junto, já: uma segunda escolha logo em seguida precisa
        // contar estas vagas como ocupadas.
        draftRef.current = { ...draftRef.current, media: [...draftRef.current.media, ...accepted] }
        setDraft((current) => ({ ...current, media: [...current.media, ...accepted] }))
        queueRef.current.push(...accepted.map((media) => media.key))
        void pump()
      } finally {
        setInspecting((count) => count - 1)
      }
    })()
    inspectionsRef.current.add(task)
    void task.finally(() => inspectionsRef.current.delete(task))
  }, [pump])

  const removeMedia = useCallback((key: string) => {
    const target = draftRef.current.media.find((media) => media.key === key)
    if (target?.source.type === 'new' && target.source.previewUrl) URL.revokeObjectURL(target.source.previewUrl)
    filesRef.current.delete(key)
    prepRef.current.delete(key)
    setDraft((current) => ({ ...current, media: current.media.filter((media) => media.key !== key) }))
  }, [])

  const moveMedia = useCallback((activeKey: string, overKey: string) => {
    setDraft((current) => {
      const from = current.media.findIndex((media) => media.key === activeKey)
      const to = current.media.findIndex((media) => media.key === overKey)
      if (from < 0 || to < 0 || from === to) return current
      return { ...current, media: arrayMove(current.media, from, to) }
    })
  }, [])

  const makeCover = useCallback((key: string) => {
    setDraft((current) => {
      const target = current.media.find((media) => media.key === key)
      if (!target) return current
      return { ...current, media: [target, ...current.media.filter((media) => media.key !== key)] }
    })
  }, [])

  // --- Salvar -------------------------------------------------------------

  const discard = useCallback(
    async (itemId: string | null, sent: SentFile[]) => {
      if (!itemId || sent.length === 0) return
      await discardItemUploadsAction({ restaurantId, itemId, files: sent })
    },
    [restaurantId],
  )

  function fail(message: string) {
    setPhase('idle')
    setProgress(null)
    setSaveError(message)
    setErrorTick((tick) => tick + 1)
  }

  function save() {
    if (phase !== 'idle') return
    setAttempted(true)
    setSaveError(null)
    const snapshot = draftRef.current
    const firstCheck = validateDraft(snapshot)
    if (hasErrors(firstCheck)) {
      fail(firstErrorMessage(firstCheck))
      return
    }

    // A fase muda FORA da transição: atualização feita antes do primeiro
    // await de uma ação assíncrona só aparece quando a ação termina, e a
    // tela precisa travar já.
    setPhase('preparing')
    startSave(async () => {
      await waitForPrep()
      if (!mountedRef.current) return

      // A lista pode ter ganhado arquivos durante a espera (escolhidos antes
      // do clique, ainda em conferência): o envio usa a lista de AGORA.
      const current = draftRef.current
      const pending = current.media.filter((media) => media.source.type === 'new')
      if (pending.some((media) => prepRef.current.get(media.key)?.status !== 'ready')) {
        fail('Remova as mídias com erro para salvar.')
        return
      }

      const mode = item ? 'update' : 'create'
      let itemId = itemIdRef.current
      const uploaded = new Map<string, UploadedMedia>()
      const sent: SentFile[] = []

      if (pending.length > 0) {
        setPhase('uploading')
        for (const [index, media] of pending.entries()) {
          setProgress({ done: index, total: pending.length })
          const selected = filesRef.current.get(media.key)
          const prepared = prepRef.current.get(media.key)
          if (!selected || prepared?.status !== 'ready') {
            await discard(itemId, sent)
            fail('Uma mídia saiu da lista durante o envio. Tente de novo.')
            return
          }
          setUpload(media.key, 'uploading')
          try {
            const result = await uploadPreparedMedia({ restaurantId, itemId, selected, prepared })
            itemId = result.itemId
            itemIdRef.current = result.itemId
            sent.push(...result.files)
            uploaded.set(media.key, result.media)
            setUpload(media.key, 'done')
          } catch (error) {
            setUpload(media.key, 'idle')
            await discard(itemId, sent)
            fail(error instanceof Error ? error.message : 'Não foi possível enviar a mídia.')
            return
          }
        }
        setProgress({ done: pending.length, total: pending.length })
      }

      // Item novo sem mídia: o id nasce aqui. O banco recusaria uma colisão
      // pela chave primária, e a mensagem diz o que fazer.
      if (!itemId) {
        itemId = crypto.randomUUID()
        itemIdRef.current = itemId
      }

      setPhase('saving')
      const result = await saveItemAction(toSavePayload({ mode, restaurantId, itemId, draft: current, uploaded }))
      if (!result.ok) {
        // As mídias voltam a "não enviadas": a próxima tentativa sobe de novo.
        for (const media of pending) setUpload(media.key, 'idle')
        await discard(itemId, sent)
        fail(result.error)
        return
      }

      revokePreviews(current.media)
      setPhase('idle')
      setProgress(null)
      toast.add({ title: mode === 'create' ? 'Item criado' : 'Item salvo', type: 'success' })
      onSaved()
    })
  }

  return {
    values: draft,
    errors,
    dirty,
    busy,
    phase,
    progress,
    saveError,
    mediaNotices,
    inspecting: inspecting > 0,
    errorTick,
    update,
    setPricing,
    addVariant,
    updateVariant,
    removeVariant,
    moveVariant,
    addFiles,
    removeMedia,
    moveMedia,
    makeCover,
    save,
  }
}

export type ItemDraftController = ReturnType<typeof useItemDraft>
