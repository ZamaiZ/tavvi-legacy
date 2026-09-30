'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// A área de envio envolve a grade de mídia inteira.
//
// Aceita os três caminhos que uma pessoa realmente usa: arrastar do
// explorador, colar do clipboard, e clicar (o tile "Adicionar" chama
// `openPicker`). Um input só, `multiple`, sem separar foto de vídeo — no feed
// o cliente não distingue tipo, e o dono também não deveria precisar escolher
// a gaveta antes de escolher o arquivo.
export function MediaDropzone({
  onFiles,
  acceptedTypes,
  disabled = false,
  remaining,
  children,
}: {
  onFiles: (files: File[]) => void
  acceptedTypes: readonly string[]
  disabled?: boolean
  /** Quantas telas ainda cabem. Zero bloqueia soltar e colar. */
  remaining: number
  children: (openPicker: () => void) => ReactNode
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
      className="tv-media-drop"
      data-dragging={draggingOver || undefined}
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
    >
      {children(() => inputRef.current?.click())}
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
