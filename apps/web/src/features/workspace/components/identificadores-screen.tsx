'use client'

import { useState, useTransition } from 'react'
import { LuChevronRight, LuCircleAlert, LuCopy, LuEllipsis, LuPencil, LuPlus, LuQrCode, LuRadio, LuRadioTower, LuScanLine } from 'react-icons/lu'
import { PageHeader } from '@/components/shell/page-header'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { PanelConfirm } from './panel-confirm'
import { TagPanel, type TagPanelState } from './identificadores-panel'
import { lastSeen, tagName, tagPublicUrl } from './identificadores-utils'
import type { TagDTO } from '@/domain/tag'
import { updateTagAction } from '@/server/actions/tags'

type Filter = 'all' | 'active' | 'attention' | 'inactive'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'attention', label: 'Precisam de atenção' },
  { value: 'inactive', label: 'Desativados' },
]

function tagFilter(tag: TagDTO): Exclude<Filter, 'all'> {
  if (!tag.isActive) return 'inactive'
  return tag.tableNumber ? 'active' : 'attention'
}

function sortTags(tags: TagDTO[]) {
  return [...tags].sort((a, b) => (a.tableNumber ?? Infinity) - (b.tableNumber ?? Infinity) || a.id.localeCompare(b.id))
}

export function IdentificadoresScreen({ restaurantId, initialTags }: { restaurantId: string; initialTags: TagDTO[] }) {
  const [tags, setTags] = useState(() => sortTags(initialTags))
  const [filter, setFilter] = useState<Filter>('all')
  const [panel, setPanel] = useState<TagPanelState | null>(null)
  const [confirmTagId, setConfirmTagId] = useState<string | null>(null)
  const [changingIds, setChangingIds] = useState<string[]>([])
  const [recentId, setRecentId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const mobile = useIsMobile()
  const confirmTag = tags.find((tag) => tag.id === confirmTagId) ?? null
  const counts = {
    all: tags.length,
    active: tags.filter((tag) => tagFilter(tag) === 'active').length,
    attention: tags.filter((tag) => tagFilter(tag) === 'attention').length,
    inactive: tags.filter((tag) => tagFilter(tag) === 'inactive').length,
  }
  const visible = tags.filter((tag) => filter === 'all' || tagFilter(tag) === filter)

  async function copy(tag: TagDTO) {
    try {
      await navigator.clipboard.writeText(tagPublicUrl(tag))
      toast.add({ title: `Link da ${tagName(tag).toLowerCase()} copiado`, type: 'success' })
    } catch {
      toast.add({ title: 'Não foi possível copiar o link neste navegador.', type: 'error' })
    }
  }

  function toggle(tag: TagDTO) {
    if (tag.isActive) { setConfirmTagId(tag.id); return }
    changeAvailability(tag)
  }

  function changeAvailability(tag: TagDTO) {
    if (changingIds.includes(tag.id)) return
    setChangingIds((current) => [...current, tag.id])
    startTransition(async () => {
      try {
        const result = await updateTagAction({ tagId: tag.id, tableNumber: tag.tableNumber, isActive: !tag.isActive })
        if (!result.ok) { toast.add({ title: result.error, type: 'error' }); return }
        setTags((current) => current.map((item) => item.id === tag.id ? { ...item, isActive: !tag.isActive } : item))
        toast.add({ title: !tag.isActive && !tag.tableNumber ? 'Identificador ativado. Defina uma mesa para os chamados.' : `Identificador da ${tagName(tag).toLowerCase()} ${tag.isActive ? 'desativado' : 'ativado'}`, type: 'success' })
      } catch {
        toast.add({ title: 'Não foi possível atualizar o identificador. Tente novamente.', type: 'error' })
      } finally {
        setChangingIds((current) => current.filter((id) => id !== tag.id))
        setConfirmTagId((current) => current === tag.id ? null : current)
      }
    })
  }

  function dropdownActions(tag: TagDTO) {
    return <>
      <DropdownMenuItem onClick={() => setPanel({ mode: 'details', tagId: tag.id })}><LuScanLine aria-hidden="true" />Abrir detalhes</DropdownMenuItem>
      <DropdownMenuItem onClick={() => void copy(tag)}><LuCopy aria-hidden="true" />Copiar link</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setPanel({ mode: 'edit', tagId: tag.id })}><LuPencil aria-hidden="true" />Editar mesa</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={changingIds.includes(tag.id)} variant={tag.isActive ? 'destructive' : 'default'} onClick={() => toggle(tag)}><LuRadio aria-hidden="true" />{tag.isActive ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
    </>
  }

  function contextActions(tag: TagDTO) {
    return <>
      <ContextMenuItem onClick={() => setPanel({ mode: 'details', tagId: tag.id })}><LuScanLine aria-hidden="true" />Abrir detalhes</ContextMenuItem>
      <ContextMenuItem onClick={() => void copy(tag)}><LuCopy aria-hidden="true" />Copiar link</ContextMenuItem>
      <ContextMenuItem onClick={() => setPanel({ mode: 'edit', tagId: tag.id })}><LuPencil aria-hidden="true" />Editar mesa</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={changingIds.includes(tag.id)} variant={tag.isActive ? 'destructive' : 'default'} onClick={() => toggle(tag)}><LuRadio aria-hidden="true" />{tag.isActive ? 'Desativar' : 'Ativar'}</ContextMenuItem>
    </>
  }

  return <div className="tv-tags-page">
    <MobileNavBar backHref={`/restaurantes/${restaurantId}/ajustes`} backLabel="Ajustes" />
    <div className="tv-tags-heading">
      <PageHeader className="tv-page-header" eyebrow="Atendimento" title="Identificadores" description="Cada mesa tem um link permanente para acessar o cardápio e chamar a equipe." />
      <button type="button" className="tv-tags-create-button" aria-label="Novo identificador" aria-haspopup="dialog" onClick={() => setPanel({ mode: 'create' })}><LuPlus aria-hidden="true" /><span className="tv-tags-create-full">Novo identificador</span><span className="tv-tags-create-short">Novo</span></button>
    </div>
    {tags.length > 0 ? <>
      <div className="tv-tags-overview" aria-label="Resumo dos identificadores">
        <span><strong>{counts.active}</strong> {counts.active === 1 ? 'ativo' : 'ativos'}</span>
        {counts.attention > 0 ? <span className="is-attention"><LuCircleAlert aria-hidden="true" /><strong>{counts.attention}</strong> sem mesa</span> : null}
        {counts.inactive > 0 ? <span><strong>{counts.inactive}</strong> {counts.inactive === 1 ? 'desativado' : 'desativados'}</span> : null}
      </div>
      <div className="tv-tags-filters" role="group" aria-label="Filtrar identificadores">
        {FILTERS.map((option) => <button key={option.value} type="button" className={filter === option.value ? 'is-selected' : ''} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}<span>{counts[option.value]}</span></button>)}
      </div>
    </> : null}
    {tags.length === 0 ? <div className="tv-tags-empty"><span className="tv-tags-empty-icon"><LuQrCode aria-hidden="true" /></span><h2>Pronto para identificar suas mesas</h2><p>Crie o primeiro identificador e copie o link para preparar o QR code da mesa.</p><button type="button" onClick={() => setPanel({ mode: 'create' })}><LuPlus aria-hidden="true" />Criar identificador</button></div>
      : visible.length === 0 ? <div className="tv-tags-filter-empty"><LuScanLine aria-hidden="true" /><h2>Nenhum identificador aqui</h2><span>Escolha outra categoria para ver suas mesas.</span></div>
        : <section className="tv-tags-list" aria-label="Identificadores do restaurante">
          {visible.map((tag) => <ContextMenu key={tag.id}>
            <ContextMenuTrigger render={<article className={`tv-tag-card is-${tagFilter(tag)}${recentId === tag.id ? ' is-recent' : ''}`} />}>
              <button type="button" className="tv-tag-main" aria-haspopup="dialog" onClick={() => setPanel({ mode: 'details', tagId: tag.id })}>
                <span className="tv-tag-icon"><LuQrCode aria-hidden="true" /></span>
                <span className="tv-tag-copy"><strong>{tagName(tag)}</strong><span>{lastSeen(tag)}</span></span>
                <span className={`tv-tag-status is-${tagFilter(tag)}`}><span aria-hidden="true" />{tagFilter(tag) === 'inactive' ? 'Desativado' : tagFilter(tag) === 'attention' ? 'Sem mesa' : 'Ativo'}</span>
                <LuChevronRight className="tv-tag-chevron" aria-hidden="true" />
              </button>
              <DropdownMenu><DropdownMenuTrigger className="tv-tag-more" aria-label={`Ações de ${tagName(tag).toLowerCase()}`} disabled={changingIds.includes(tag.id)}>{changingIds.includes(tag.id) ? <SpinnerRing decorative /> : <LuEllipsis aria-hidden="true" />}</DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={5}>{dropdownActions(tag)}</DropdownMenuContent></DropdownMenu>
            </ContextMenuTrigger>
            <ContextMenuContent aria-label={`Ações de ${tagName(tag).toLowerCase()}`}>{contextActions(tag)}</ContextMenuContent>
          </ContextMenu>)}
        </section>}
    {panel ? <TagPanel key={'tagId' in panel ? panel.tagId : 'new'} panel={panel} tag={'tagId' in panel ? tags.find((tag) => tag.id === panel.tagId) ?? null : null} restaurantId={restaurantId} mobile={mobile} onClose={() => setPanel(null)} onEdit={() => setPanel((current) => current && 'tagId' in current ? { mode: 'edit', tagId: current.tagId } : current)} onSaved={(tag, created) => { setTags((current) => sortTags(created ? [...current, tag] : current.map((item) => item.id === tag.id ? tag : item))); setFilter('all'); setRecentId(tag.id); window.setTimeout(() => setRecentId((current) => current === tag.id ? null : current), 1800); setPanel(created ? { mode: 'details', tagId: tag.id } : null) }} /> : null}
    <PanelConfirm open={!!confirmTag} onOpenChange={(open) => { if (!open) setConfirmTagId(null) }} icon={<LuRadioTower />} title={`Desativar ${confirmTag ? tagName(confirmTag).toLowerCase() : 'identificador'}?`} description="Este link deixa de abrir o cardápio e de receber chamados até você reativá-lo." confirmLabel="Desativar" pendingLabel="Desativando…" pending={!!confirmTag && changingIds.includes(confirmTag.id)} destructive onConfirm={() => { if (confirmTag) changeAvailability(confirmTag) }} />
  </div>
}
