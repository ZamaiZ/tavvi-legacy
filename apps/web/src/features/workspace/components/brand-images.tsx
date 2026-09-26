'use client'

import { useState, useTransition } from 'react'
import { RiDeleteBinLine, RiImageAddLine } from 'react-icons/ri'
import { MediaDropzone } from '@/features/menu-editor/components/media-dropzone'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { BRAND_SLOT_LABELS, MEDIA_LIMITS, type BrandSlot } from '@/domain/media'
import { compressImage } from '@/lib/media/compress-image'
import { publicMediaUrl } from '@/lib/media-url'
import { uploadToSignedUrl } from '@/lib/upload'
import {
  createBrandUploadTicketAction,
  setBrandImageAction,
} from '@/server/actions/media'

const HELP_TEXT: Record<BrandSlot, string> = {
  logo: 'Quadrada funciona melhor. Aparece sobre a capa, no topo do cardápio.',
  cover: 'Deitada, bem larga. É a primeira coisa que o cliente vê.',
}

function Slot({
  restaurantId,
  slot,
  path,
}: {
  restaurantId: string
  slot: BrandSlot
  path: string | null
}) {
  const [currentPath, setCurrentPath] = useState<string | null>(path)
  const [pending, startTransition] = useTransition()

  function uploadFile(file: File) {
    // As actions vão DENTRO de startTransition por virem de manipulador de
    // evento — contrato documentado do Next 16.3.5. Fora dela, a revalidação
    // pode não voltar aplicada e a tela fica velha depois de um envio que
    // deu certo.
    startTransition(async () => {
      // Comprime ANTES de conferir o teto. A capa é a imagem mais pesada do
      // sistema, e recusar o original de uma foto que comprimiria bem abaixo
      // do limite desperdiçaria justamente a compressão.
      const compression = await compressImage(file)
      const blob = compression.blob

      if (blob.size > MEDIA_LIMITS.image.maxBytes) {
        toast.add({
          title: 'Arquivo grande demais',
          description: `Mesmo comprimido ficou em ${(blob.size / 1_048_576).toFixed(1)} MB, e o limite é ${Math.round(MEDIA_LIMITS.image.maxBytes / 1_048_576)} MB.`,
          type: 'error',
        })
        return
      }

      // O tipo do BLOB, e não o do arquivo: depois da compressão eles
      // divergem, e mandar o antigo grava no storage um arquivo com
      // content-type errado — que o navegador depois não desenha.
      const mimeType = blob.type || file.type

      const ticket = await createBrandUploadTicketAction({
        restaurantId,
        slot,
        mimeType,
      })
      if (!ticket.ok) {
        toast.add({ title: ticket.error, type: 'error' })
        return
      }

      try {
        await uploadToSignedUrl(ticket.data.signedUrl, blob, mimeType)
      } catch {
        toast.add({ title: 'Não foi possível enviar o arquivo.', type: 'error' })
        return
      }

      const savedResult = await setBrandImageAction({
        restaurantId,
        slot,
        storagePath: ticket.data.path,
      })
      if (savedResult.ok) {
        setCurrentPath(ticket.data.path)
        toast.add({ title: `${BRAND_SLOT_LABELS[slot]} atualizada`, type: 'success' })
      } else {
        toast.add({ title: savedResult.error, type: 'error' })
      }
    })
  }

  function removeImage() {
    startTransition(async () => {
      const result = await setBrandImageAction({
        restaurantId,
        slot,
        storagePath: null,
      })
      if (result.ok) {
        setCurrentPath(null)
        toast.add({ title: `${BRAND_SLOT_LABELS[slot]} removida`, type: 'success' })
      } else {
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  return (
    <div className="min-w-0">
      <p className="text-small font-medium">{BRAND_SLOT_LABELS[slot]}</p>

      <div
        className={`mt-2 overflow-hidden rounded-xl border border-border bg-surface-1 ${
          slot === 'logo' ? 'size-24' : 'aspect-[16/7] w-full'
        }`}
      >
        {currentPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicMediaUrl('image', currentPath)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <RiImageAddLine className="size-6" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Dropzone, e não botão — a mesma área de envio do editor de item. Sem
          isso o painel teria duas experiências de envio, e a capa, que é a
          imagem mais pesada do sistema, ficaria na pior das duas.

          Mas SEM staging, de propósito: logo e capa gravam sozinhas, na hora,
          como a Fase 3 decidiu. Envio de arquivo já é uma confirmação por si,
          e amarrá-lo a um botão de salvar criaria um estado em que o arquivo
          está no storage e o banco ainda não sabe dele.

          A diferença tem motivo real: mídia de item pertence a um item que
          PODE NÃO EXISTIR ainda; logo e capa pertencem a um restaurante que
          sempre existe. */}
      <div className="mt-3 min-w-0">
        <MediaDropzone
          onFiles={(files) => {
            const firstFile = files[0]
            if (firstFile) uploadFile(firstFile)
          }}
          acceptedTypes={MEDIA_LIMITS.image.mimes}
          disabled={pending}
          remaining={1}
        />
      </div>

      {currentPath ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={removeImage}
          >
            {pending ? (
              <Spinner className="size-4" />
            ) : (
              <RiDeleteBinLine className="size-4" />
            )}
            Remover
          </Button>
        </div>
      ) : null}

      <p className="mt-2 max-w-[36rem] text-small leading-relaxed text-muted-foreground">
        {HELP_TEXT[slot]}
      </p>
    </div>
  )
}

export function BrandImages({
  restaurantId,
  logoPath,
  coverPath,
}: {
  restaurantId: string
  logoPath: string | null
  coverPath: string | null
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Marca e imagens</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use arquivos nítidos e com pouco texto para funcionar bem em qualquer tela.</p>
      </div>
      <div className="grid min-w-0 items-start gap-6 sm:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)]">
        <Slot restaurantId={restaurantId} slot="logo" path={logoPath} />
        <Slot restaurantId={restaurantId} slot="cover" path={coverPath} />
      </div>
    </section>
  )
}
