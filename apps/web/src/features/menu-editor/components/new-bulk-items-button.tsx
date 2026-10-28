'use client'

import { LuList } from 'react-icons/lu'

export function NewBulkItemsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="tv-pbtn" onClick={onClick}>
      <LuList aria-hidden="true" />Adicionar vários itens
    </button>
  )
}
