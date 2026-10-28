'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { toast } from '@/components/ui/toast'
import { comparableText } from '@/domain/common'
import { MAX_CATEGORIES_PER_BATCH, MAX_ITEMS_PER_BATCH, type OwnerMenuCategoryDTO } from '@/domain/menu'
import { MAX_MEDIA_PER_ITEM, type BatchUploadTicket } from '@/domain/media'
import { discardItemBatchUploadsAction, createItemBatchUploadTicketsAction } from '@/server/actions/media'
import { saveMenuItemsBatchAction } from '@/server/actions/menu'
import {
  createBulkCategory,
  createBulkItem,
  validateBulkMenuDraft,
  type BulkDraftErrors,
  type BulkItemDraft,
  type NewMenuCategoryDraft,
} from '../lib/bulk-menu-draft'
import {
  toSavePayload,
  type ItemDraft,
  type MediaDraft,
  type MediaPrep,
  type UploadedMedia,
  type VariantDraft,
} from '../lib/item-draft'
import { MAX_VARIANTS } from '../lib/item-draft'
import { inspectFile, prepareMedia, type SelectedFile } from '../lib/media-prep'
import { uploadToSignedUrl } from '@/lib/upload'

type Phase = 'idle' | 'uploading' | 'saving'
type PreparedMedia = Awaited<ReturnType<typeof prepareMedia>>
type NewMediaDraft = MediaDraft & { source: Extract<MediaDraft['source'], { type: 'new' }> }
type PendingUpload = { itemId: string; media: NewMediaDraft }
type SentFile = { itemId: string; kind: 'image' | 'video'; path: string }

function mediaFiles(tickets: BatchUploadTicket[]): SentFile[] {
  return tickets.flatMap((ticket) => [
    { itemId: ticket.itemId, kind: ticket.kind, path: ticket.path },
    ...(ticket.poster ? [{ itemId: ticket.itemId, kind: 'image' as const, path: ticket.poster.path }] : []),
  ])
}

async function withConcurrency<T>(items: T[], limit: number, task: (item: T, index: number) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      await task(items[index], index)
    }
  })
  await Promise.all(workers)
}

export function useBulkMenuDraft({
  restaurantId,
  categories,
  onSaved,
}: {
  restaurantId: string
  categories: OwnerMenuCategoryDTO[]
  onSaved: () => void
}) {
  const [newCategories, setNewCategories] = useState<NewMenuCategoryDraft[]>([])
  const [rows, setRows] = useState<BulkItemDraft[]>([])
  const rowsRef = useRef(rows)
  const filesRef = useRef(new Map<string, { itemId: string; selected: SelectedFile }>())
  const preparedRef = useRef(new Map<string, PreparedMedia>())
  const queueRef = useRef<{ itemId: string; mediaKey: string }[]>([])
  const inspectionCountsRef = useRef(new Map<string, number>())
  const preparingRef = useRef(false)
  const inspectionsRef = useRef(0)
  const [inspecting, setInspecting] = useState(false)
  const [inspectingItems, setInspectingItems] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  const [attempted, setAttempted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([])
  const [mediaNotices, setMediaNotices] = useState<Record<string, string[]>>({})
  const [categoryLimitError, setCategoryLimitError] = useState<string | null>(null)
  const [errorTick, setErrorTick] = useState(0)
  const mountedRef = useRef(false)

  useEffect(() => { rowsRef.current = rows }, [rows])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      queueRef.current = []
      filesRef.current.clear()
      for (const row of rowsRef.current) {
        for (const media of row.values.media) {
          if (media.source.type === 'new' && media.source.previewUrl) URL.revokeObjectURL(media.source.previewUrl)
        }
      }
    }
  }, [])

  const validation = useMemo(
    () => validateBulkMenuDraft(rows, categories, newCategories),
    [rows, categories, newCategories],
  )
  const errors = attempted ? validation.errors : {}
  const isPreparing = inspecting || rows.some((row) => row.values.media.some((media) =>
    media.source.type === 'new' && (media.source.prep.status === 'queued' || media.source.prep.status === 'preparing'),
  ))
  const busy = phase !== 'idle'

  const replaceRows = useCallback((update: (current: BulkItemDraft[]) => BulkItemDraft[]) => {
    const next = update(rowsRef.current)
    rowsRef.current = next
    setRows(next)
  }, [])

  useEffect(() => {
    if (categories[0] && rowsRef.current.length === 0) {
      replaceRows(() => [createBulkItem(categories[0].id, true)])
    }
  }, [categories, replaceRows])

  const updateMedia = useCallback((itemId: string, mediaKey: string, update: (media: MediaDraft) => MediaDraft) => {
    replaceRows((current) => current.map((row) => row.id !== itemId ? row : {
      ...row,
      values: { ...row.values, media: row.values.media.map((media) => media.key === mediaKey ? update(media) : media) },
    }))
  }, [replaceRows])

  const setPrep = useCallback((itemId: string, mediaKey: string, prep: MediaPrep) => {
    updateMedia(itemId, mediaKey, (media) => media.source.type === 'new'
      ? { ...media, source: { ...media.source, prep } }
      : media,
    )
  }, [updateMedia])

  const pumpPreparation = useCallback(async () => {
    if (preparingRef.current) return
    preparingRef.current = true
    while (queueRef.current.length > 0 && mountedRef.current) {
      const next = queueRef.current.shift()!
      const stored = filesRef.current.get(next.mediaKey)
      if (!stored) continue
      setPrep(next.itemId, next.mediaKey, { status: 'preparing', progress: 0 })
      try {
        const prepared = await prepareMedia(stored.selected, (progress) => {
          if (mountedRef.current && filesRef.current.has(next.mediaKey)) setPrep(next.itemId, next.mediaKey, { status: 'preparing', progress })
        })
        if (mountedRef.current && filesRef.current.has(next.mediaKey)) {
          preparedRef.current.set(next.mediaKey, prepared)
          setPrep(next.itemId, next.mediaKey, { status: 'ready', ...prepared })
        }
      } catch (error) {
        if (mountedRef.current && filesRef.current.has(next.mediaKey)) {
          setPrep(next.itemId, next.mediaKey, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Não foi possível preparar este arquivo.',
          })
        }
      }
    }
    preparingRef.current = false
  }, [setPrep])

  const addItem = useCallback((categoryId: string) => {
    if (rowsRef.current.length >= MAX_ITEMS_PER_BATCH) {
      setSaveError(`O limite é ${MAX_ITEMS_PER_BATCH} itens por lote.`)
      return
    }
    const row = createBulkItem(categoryId, !rowsRef.current.some((entry) => entry.values.categoryId === categoryId))
    replaceRows((current) => [...current, row])
    setSaveError(null)
  }, [replaceRows])

  const removeItem = useCallback((itemId: string) => {
    const row = rowsRef.current.find((entry) => entry.id === itemId)
    for (const media of row?.values.media ?? []) {
      if (media.source.type === 'new') {
        filesRef.current.delete(media.key)
        preparedRef.current.delete(media.key)
        if (media.source.previewUrl) URL.revokeObjectURL(media.source.previewUrl)
      }
    }
    replaceRows((current) => current.filter((row) => row.id !== itemId))
    setMediaNotices((current) => {
      const next = { ...current }
      delete next[itemId]
      return next
    })
  }, [replaceRows])

  const updateItem = useCallback((itemId: string, update: (draft: ItemDraft) => ItemDraft) => {
    replaceRows((current) => current.map((row) => row.id === itemId ? { ...row, values: update(row.values) } : row))
  }, [replaceRows])

  const updateField = useCallback((itemId: string, field: keyof ItemDraft, value: unknown) => {
    updateItem(itemId, (draft) => ({ ...draft, [field]: value } as ItemDraft))
  }, [updateItem])

  const addVariant = useCallback((itemId: string) => {
    const key = crypto.randomUUID()
    updateItem(itemId, (draft) => draft.variants.length >= MAX_VARIANTS ? draft : {
      ...draft,
      variants: [...draft.variants, { key, name: '', priceCents: null, isAvailable: true }],
    })
    return key
  }, [updateItem])

  const setPricing = useCallback((itemId: string, mode: ItemDraft['pricing']) => {
    updateItem(itemId, (draft) => {
      if (mode === draft.pricing) return draft
      if (mode === 'variants' && draft.variants.length === 0) {
        return {
          ...draft,
          pricing: mode,
          variants: [{ key: crypto.randomUUID(), name: '', priceCents: draft.basePriceCents, isAvailable: true }],
        }
      }
      return { ...draft, pricing: mode }
    })
  }, [updateItem])

  const updateVariant = useCallback((itemId: string, key: string, change: Partial<VariantDraft>) => {
    updateItem(itemId, (draft) => ({
      ...draft,
      variants: draft.variants.map((variant) => variant.key === key ? { ...variant, ...change } : variant),
    }))
  }, [updateItem])

  const removeVariant = useCallback((itemId: string, key: string) => {
    updateItem(itemId, (draft) => ({ ...draft, variants: draft.variants.filter((variant) => variant.key !== key) }))
  }, [updateItem])

  const moveVariant = useCallback((itemId: string, activeKey: string, overKey: string) => {
    updateItem(itemId, (draft) => {
      const from = draft.variants.findIndex((variant) => variant.key === activeKey)
      const to = draft.variants.findIndex((variant) => variant.key === overKey)
      return from < 0 || to < 0 || from === to ? draft : { ...draft, variants: arrayMove(draft.variants, from, to) }
    })
  }, [updateItem])

  const addFiles = useCallback((itemId: string, incoming: File[]) => {
    if (incoming.length === 0) return
    if ((inspectionCountsRef.current.get(itemId) ?? 0) > 0) return
    inspectionCountsRef.current.set(itemId, 1)
    inspectionsRef.current += 1
    setInspecting(true)
    setInspectingItems([...inspectionCountsRef.current.keys()])
    setMediaNotices((current) => ({ ...current, [itemId]: [] }))
    void (async () => {
      try {
        const inspected = await Promise.all(incoming.map((file) => inspectFile(file)))
        if (!mountedRef.current) return
        const row = rowsRef.current.find((entry) => entry.id === itemId)
        if (!row) return
        let remaining = Math.max(0, MAX_MEDIA_PER_ITEM - row.values.media.length)
        const accepted: MediaDraft[] = []
        const notices: string[] = []
        for (const result of inspected) {
          if (!result.ok) { notices.push(result.error); continue }
          if (remaining <= 0) { notices.push(`Este item já chegou a ${MAX_MEDIA_PER_ITEM} mídias; “${result.value.file.name}” ficou de fora.`); continue }
          remaining -= 1
          const mediaKey = crypto.randomUUID()
          const preview = result.value.kind === 'image' ? result.value.file : result.value.posterBlob
          filesRef.current.set(mediaKey, { itemId, selected: result.value })
          accepted.push({
            key: mediaKey,
            source: { type: 'new', kind: result.value.kind, fileName: result.value.file.name, previewUrl: preview ? URL.createObjectURL(preview) : null, prep: { status: 'queued' }, upload: 'idle' },
            focalX: 0.5,
            focalY: 0.5,
          })
        }
        if (notices.length > 0) setMediaNotices((current) => ({ ...current, [itemId]: notices }))
        if (accepted.length === 0) return
        replaceRows((current) => current.map((entry) => entry.id === itemId
          ? { ...entry, values: { ...entry.values, media: [...entry.values.media, ...accepted] } }
          : entry,
        ))
        queueRef.current.push(...accepted.map((media) => ({ itemId, mediaKey: media.key })))
        void pumpPreparation()
      } finally {
        inspectionCountsRef.current.delete(itemId)
        inspectionsRef.current = Math.max(0, inspectionsRef.current - 1)
        if (mountedRef.current) {
          setInspecting(inspectionsRef.current > 0)
          setInspectingItems([...inspectionCountsRef.current.keys()])
        }
      }
    })()
  }, [pumpPreparation, replaceRows])

  const removeMedia = useCallback((itemId: string, mediaKey: string) => {
    const row = rowsRef.current.find((entry) => entry.id === itemId)
    const media = row?.values.media.find((entry) => entry.key === mediaKey)
    if (media?.source.type === 'new') {
      filesRef.current.delete(mediaKey)
      preparedRef.current.delete(mediaKey)
      if (media.source.previewUrl) URL.revokeObjectURL(media.source.previewUrl)
    }
    updateItem(itemId, (draft) => ({ ...draft, media: draft.media.filter((entry) => entry.key !== mediaKey) }))
  }, [updateItem])

  const moveMedia = useCallback((itemId: string, activeKey: string, overKey: string) => {
    updateItem(itemId, (draft) => {
      const from = draft.media.findIndex((media) => media.key === activeKey)
      const to = draft.media.findIndex((media) => media.key === overKey)
      return from < 0 || to < 0 || from === to ? draft : { ...draft, media: arrayMove(draft.media, from, to) }
    })
  }, [updateItem])

  const makeCover = useCallback((itemId: string, mediaKey: string) => {
    updateItem(itemId, (draft) => {
      const selected = draft.media.find((media) => media.key === mediaKey)
      return selected ? { ...draft, media: [selected, ...draft.media.filter((media) => media.key !== mediaKey)] } : draft
    })
  }, [updateItem])

  const addCategory = useCallback((nameValue: string, descriptionValue: string) => {
    const name = nameValue.trim()
    const description = descriptionValue.trim()
    if (newCategories.length >= MAX_CATEGORIES_PER_BATCH) {
      setCategoryLimitError(`O limite é ${MAX_CATEGORIES_PER_BATCH} categorias novas.`)
      return false
    }
    if (name.length < 2 || name.length > 80 || /[<>]/.test(name)) {
      setCategoryLimitError('Use um nome de 2 a 80 caracteres, sem < ou >.')
      return false
    }
    if (description.length > 300 || /[<>]/.test(description)) {
      setCategoryLimitError('A descrição pode ter até 300 caracteres e não aceita < ou >.')
      return false
    }
    if (newCategories.some((category) => comparableText(category.name) === comparableText(name))) {
      setCategoryLimitError('Já existe uma categoria nova com esse nome.')
      return false
    }
    const category = { ...createBulkCategory(), name, description }
    setNewCategories((current) => [...current, category])
    setCategoryLimitError(null)
    addItem(category.id)
    return true
  }, [addItem, newCategories])

  const removeCategory = useCallback((categoryId: string) => {
    if (rowsRef.current.some((row) => row.values.categoryId === categoryId)) return false
    setNewCategories((current) => current.filter((category) => category.id !== categoryId))
    return true
  }, [])

  const clearCategoryLimitError = useCallback(() => setCategoryLimitError(null), [])

  const setExpanded = useCallback((itemId: string, expanded: boolean) => {
    replaceRows((current) => current.map((row) => row.id === itemId ? { ...row, expanded } : row))
  }, [replaceRows])

  const toggleExpanded = useCallback((itemId: string) => {
    replaceRows((current) => current.map((row) => row.id === itemId ? { ...row, expanded: !row.expanded } : row))
  }, [replaceRows])

  const discardUploadFiles = useCallback(async (files: SentFile[]) => {
    if (files.length === 0) return
    await discardItemBatchUploadsAction({ restaurantId, files })
  }, [restaurantId])
  const discardUploads = useCallback(async (tickets: BatchUploadTicket[]) => {
    await discardUploadFiles(mediaFiles(tickets))
  }, [discardUploadFiles])

  const save = useCallback(async () => {
    if (phaseRef.current !== 'idle') return
    setAttempted(true)
    setSaveError(null)
    setUploadWarnings([])
    const snapshot = rowsRef.current
    const checked = validateBulkMenuDraft(snapshot, categories, newCategories)
    if (!checked.valid) {
      setSaveError('Revise os campos destacados antes de criar o lote.')
      setErrorTick((tick) => tick + 1)
      return
    }
    if (inspectionsRef.current > 0 || preparingRef.current || queueRef.current.length > 0) {
      setSaveError('Aguarde a preparação das mídias terminar.')
      return
    }
    const pending: PendingUpload[] = snapshot.flatMap((row) => row.values.media
      .filter((media): media is NewMediaDraft => media.source.type === 'new')
      .map((media) => ({ itemId: row.id, media })),
    )
    if (pending.some(({ media }) => media.source.prep.status !== 'ready' || !filesRef.current.has(media.key))) {
      setSaveError('Remova as mídias com erro ou tente prepará-las novamente.')
      setErrorTick((tick) => tick + 1)
      return
    }

    const setCurrentPhase = (next: Phase) => { phaseRef.current = next; setPhase(next) }
    let tickets: BatchUploadTicket[] = []
    try {
      if (pending.length > 0) {
        setCurrentPhase('uploading')
        setUploadProgress({ done: 0, total: pending.length })
        const requested = await createItemBatchUploadTicketsAction({
          restaurantId,
          files: pending.map(({ itemId, media }) => {
            const stored = filesRef.current.get(media.key)!
            const prepared = preparedRef.current.get(media.key)!
            return {
              itemId,
              mediaKey: media.key,
              kind: media.source.kind,
              mimeType: prepared.blob.type || stored.selected.file.type,
              ...(stored.selected.posterBlob ? { posterMimeType: stored.selected.posterBlob.type } : {}),
            }
          }),
        })
        if (!requested.ok) throw new Error(requested.error)
        tickets = requested.data.tickets
        const ticketByMedia = new Map(tickets.map((ticket) => [`${ticket.itemId}:${ticket.mediaKey}`, ticket]))
        const uploaded = new Map<string, UploadedMedia>()
        const failed: string[] = []
        const orphanedFiles: SentFile[] = []
        let done = 0
        await withConcurrency(pending, 3, async ({ itemId, media }) => {
          const stored = filesRef.current.get(media.key)
          const prepared = preparedRef.current.get(media.key)
          const ticket = ticketByMedia.get(`${itemId}:${media.key}`)
          if (!stored || !prepared || !ticket) {
            failed.push(`Uma mídia de “${media.source.fileName}” saiu do rascunho. Confira o item e tente novamente.`)
            return
          }
          updateMedia(itemId, media.key, (entry) => entry.source.type === 'new'
            ? { ...entry, source: { ...entry.source, upload: 'uploading' } }
            : entry,
          )
          try {
            const mimeType = prepared.blob.type || stored.selected.file.type
            await uploadToSignedUrl(ticket.signedUrl, prepared.blob, mimeType)
            let posterPath: string | undefined
            if (ticket.poster && stored.selected.posterBlob) {
              try {
                await uploadToSignedUrl(ticket.poster.signedUrl, stored.selected.posterBlob, stored.selected.posterBlob.type)
                posterPath = ticket.poster.path
              } catch {
                orphanedFiles.push({ itemId, kind: 'image', path: ticket.poster.path })
                setUploadWarnings((current) => [...current, `A capa de vídeo de “${media.source.fileName}” não subiu; o vídeo será mantido.`])
              }
            }
            uploaded.set(media.key, {
              storagePath: ticket.path,
              ...(posterPath ? { posterPath } : {}),
              width: prepared.width,
              height: prepared.height,
              durationMs: prepared.durationMs ?? undefined,
            })
            updateMedia(itemId, media.key, (entry) => entry.source.type === 'new'
              ? { ...entry, source: { ...entry.source, upload: 'done' } }
              : entry,
            )
          } catch {
            failed.push(`Não foi possível enviar “${media.source.fileName}”. Confira a conexão e tente de novo.`)
            updateMedia(itemId, media.key, (entry) => entry.source.type === 'new'
              ? { ...entry, source: { ...entry.source, upload: 'idle' } }
              : entry,
            )
          } finally {
            done += 1
            setUploadProgress({ done, total: pending.length })
          }
        })

        if (failed.length > 0) {
          await discardUploads(tickets)
          for (const { itemId, media } of pending) updateMedia(itemId, media.key, (entry) => entry.source.type === 'new'
            ? { ...entry, source: { ...entry.source, upload: 'idle' } }
            : entry,
          )
          throw new Error(failed[0])
        }

        setCurrentPhase('saving')
        const items = snapshot.map((row) => {
          const payload = toSavePayload({
            mode: 'create',
            restaurantId,
            itemId: row.id,
            draft: row.values,
            uploaded,
          })
          return payload
        })
        const result = await saveMenuItemsBatchAction({
          restaurantId,
          categories: newCategories.map(({ id, name, description }) => ({ id, name, description: description || undefined })),
          items,
        })
        if (!result.ok) throw new Error(result.error)
        await discardUploadFiles(orphanedFiles)
      } else {
        setCurrentPhase('saving')
        const items = snapshot.map((row) => {
          const payload = toSavePayload({ mode: 'create', restaurantId, itemId: row.id, draft: row.values, uploaded: new Map() })
          return payload
        })
        const result = await saveMenuItemsBatchAction({
          restaurantId,
          categories: newCategories.map(({ id, name, description }) => ({ id, name, description: description || undefined })),
          items,
        })
        if (!result.ok) throw new Error(result.error)
      }

      toast.add({ title: 'Lote criado', type: 'success' })
      setCurrentPhase('idle')
      setUploadProgress(null)
      onSaved()
    } catch (error) {
      if (tickets.length > 0) await discardUploads(tickets)
      setCurrentPhase('idle')
      setUploadProgress(null)
      setSaveError(error instanceof Error ? error.message : 'Não foi possível criar o lote.')
      setErrorTick((tick) => tick + 1)
    }
  }, [categories, discardUploadFiles, discardUploads, newCategories, onSaved, restaurantId, updateMedia])

  return {
    categories,
    newCategories,
    rows,
    errors,
    validation,
    phase,
    busy,
    isPreparing,
    inspecting,
    inspectingItems,
    saveError,
    uploadProgress,
    uploadWarnings,
    mediaNotices,
    categoryLimitError,
    clearCategoryLimitError,
    errorTick,
    canAddItem: rows.length < MAX_ITEMS_PER_BATCH,
    canAddCategory: newCategories.length < MAX_CATEGORIES_PER_BATCH,
    addCategory,
    removeCategory,
    addItem,
    removeItem,
    updateField,
    setPricing,
    addVariant,
    updateVariant,
    removeVariant,
    moveVariant,
    addFiles,
    removeMedia,
    moveMedia,
    makeCover,
    toggleExpanded,
    setExpanded,
    save,
  }
}
