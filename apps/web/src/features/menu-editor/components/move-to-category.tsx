'use client'

import { useMemo, useState } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { LuCheck, LuChevronDown, LuCornerDownRight } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'

type Option = { id: string; name: string }

// "Mover para" dentro do menu do item. A lista abre INLINE, dentro do próprio
// menu (`inline`), e não num popup portado: um popup aninhado seria "clique
// fora" para o menu, que fecharia no meio da escolha.
export function MoveToCategory({
  item,
  categories,
  onMove,
  touch = false,
  disabled = false,
}: {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  onMove: (categoryId: string) => void
  /** No toque, a busca fica fora do foco inicial do menu: o teclado só abre
   *  quando a pessoa toca no campo. */
  touch?: boolean
  /** Outra ação do item está rodando. */
  disabled?: boolean
}) {
  const options = useMemo<Option[]>(
    () => categories.filter((category) => category.id !== item.categoryId).map(({ id, name }) => ({ id, name })),
    [categories, item.categoryId],
  )
  const [value, setValue] = useState<Option | null>(null)
  const [listOpen, setListOpen] = useState(false)

  return (
    <div
      className="tv-pmenu-move"
      role="group"
      aria-label="Mover para outra categoria"
      // O menu usa as teclas para navegar e para a busca por letra. Aqui
      // elas pertencem ao campo; só Tab segue para o menu, e Esc só quando a
      // lista já está fechada.
      onKeyDown={(event) => {
        if (event.key === 'Tab') return
        if (event.key === 'Escape' && !listOpen) return
        event.stopPropagation()
      }}
    >
      <span className="tv-pmenu-move-label"><LuCornerDownRight aria-hidden="true" />Mover para</span>
      <Combobox.Root
        items={options}
        value={value}
        onValueChange={(next) => {
          setValue(next)
          setListOpen(false)
        }}
        open={listOpen}
        onOpenChange={(next) => setListOpen(next)}
        inline
        disabled={disabled}
        itemToStringLabel={(option: Option) => option.name}
        isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
      >
        <div className="tv-pmenu-move-row">
          <Combobox.InputGroup className="tv-pmenu-move-field">
            <Combobox.Input placeholder="Buscar categoria" aria-label="Categoria de destino" tabIndex={touch ? -1 : undefined} />
            <Combobox.Trigger className="tv-pmenu-move-toggle" aria-label="Mostrar categorias">
              <LuChevronDown aria-hidden="true" />
            </Combobox.Trigger>
          </Combobox.InputGroup>
          <button type="button" className="tv-pbtn is-primary is-sm" disabled={!value} onClick={() => value && onMove(value.id)}>
            Mover
          </button>
        </div>
        {listOpen ? (
          <>
            <Combobox.Empty className="tv-pmenu-move-empty">Nenhuma categoria encontrada.</Combobox.Empty>
            <Combobox.List className="tv-pmenu-move-list">
              {(option: Option) => (
                <Combobox.Item key={option.id} value={option} className="tv-pmenu-move-option">
                  <span>{option.name}</span>
                  <Combobox.ItemIndicator><LuCheck aria-hidden="true" /></Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </>
        ) : null}
      </Combobox.Root>
    </div>
  )
}
