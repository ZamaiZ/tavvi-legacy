'use client'

import { useEffect, useRef, useState } from 'react'
import { RiUploadCloud2Line } from 'react-icons/ri'
import { cn } from 'cn'

// A área de envio, no lugar do botão que existia até a Fase 4.
//
// Aceita os três caminhos que uma pessoa realmente usa: arrastar do
// explorador, colar do clipboard, e clicar. Um input só, `multiple`, sem
// separar foto de vídeo — no feed o cliente não distingue tipo, e o dono
// também não deveria precisar escolher a gaveta antes de escolher o arquivo.
export function MediaDropzone({
  onFiles,
  acceptedTypes,
  disabled = false,
  remaining,
}: {
  onFiles: (files: File[]) => void
  acceptedTypes: readonly string[]
  disabled?: boolean
  /** Quantas telas ainda cabem. Zero desabilita e a área diz o teto. */
  remaining: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Contador, e não booleano: `dragleave` dispara ao passar por cima de um
  // FILHO, e com booleano o estado pisca a cada movimento do mouse.
  const dragDepth = useRef(0)
  const [draggingOver, setDraggingOver] = useState(false)

  const blocked = disabled || remaining <= 0

  // Colar. Ouve na janela porque o alvo do `paste` é o que estiver em foco, e
  // ninguém foca uma área de envio antes de colar.
  useEffect(() => {
    if (blocked) return

    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) return
      event.preventDefault()
      onFiles(files)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [blocked, onFiles])

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault()
        if (blocked) return
        dragDepth.current += 1
        setDraggingOver(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDraggingOver(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDraggingOver(false)
        if (blocked) return
        onFiles(Array.from(event.dataTransfer.files))
      }}
      className={cn(
        'flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-4 text-center transition-colors',
        blocked
          ? 'border-border bg-muted/30 text-muted-foreground'
          : draggingOver
            ? 'border-primary bg-primary/5 text-foreground'
            : 'border-border bg-surface-1 text-muted-foreground hover:border-primary/50',
      )}
    >
      <RiUploadCloud2Line
        className={cn('size-5', draggingOver ? 'text-primary' : undefined)}
        aria-hidden="true"
      />

      {blocked ? (
        <p className="text-small font-medium">
          Este prato já está com todas as telas preenchidas.
        </p>
      ) : (
        <>
          <p className="text-small">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Escolha os arquivos
            </button>{' '}
            ou arraste para cá. Também dá para colar.
          </p>
          <p className="text-micro text-muted-foreground">
            Fotos e vídeos juntos. Cabem mais {remaining}{' '}
            {remaining === 1 ? 'tela' : 'telas'}.
          </p>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        // Um input só, com os dois tipos. Separar em dois obrigava o dono a
        // decidir "é foto ou vídeo?" antes de abrir a gaveta.
        accept={acceptedTypes.join(',')}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) onFiles(files)
          // Zerar permite escolher o MESMO arquivo de novo depois de removê-lo.
          event.target.value = ''
        }}
      />
    </div>
  )
}
