'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { RiComputerLine, RiMoonLine, RiSearchLine, RiSunLine } from 'react-icons/ri'
import { cn } from 'cn'
import { useProgressNavigate } from './navigation-progress'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { flattenNavItems } from './navigation'
import { getNavIcon } from './navigation-icons'
import type { TavviShellConfig } from './navigation.types'
import {
  setCommandPaletteOpen,
  useCommandPaletteOpen,
} from './command-palette-store'

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable)
  )
}

const subscribeNoop = () => () => {}

function ShortcutKeys() {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const mac = mounted && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <KbdGroup>
      <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  )
}

export function CommandPaletteTrigger({
  collapsed = false,
  className,
  onOpen,
}: {
  collapsed?: boolean
  className?: string
  onOpen?: () => void
}) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="block w-full" />}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Buscar página"
            onClick={() => {
              onOpen?.()
              setCommandPaletteOpen(true)
            }}
            className={cn(
              'h-10 w-full rounded-md bg-input/20 text-muted-foreground',
              className,
            )}
          >
            <RiSearchLine aria-hidden="true" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          Buscar página
          <ShortcutKeys />
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => {
        onOpen?.()
        setCommandPaletteOpen(true)
      }}
      className={cn(
        'h-10 w-full justify-start gap-2.5 rounded-md bg-input/20 px-3 text-muted-foreground',
        className,
      )}
    >
      <RiSearchLine aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 truncate">Buscar página</span>
      <span className="ml-auto"><ShortcutKeys /></span>
    </Button>
  )
}

export function CommandPalette({ config }: { config: TavviShellConfig }) {
  const open = useCommandPaletteOpen()
  const progressNavigate = useProgressNavigate()
  const { setTheme } = useTheme()
  const items = flattenNavItems(config.items)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isEditable(event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyK') {
        event.preventDefault()
        setCommandPaletteOpen(!open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function navigate(href: string) {
    setCommandPaletteOpen(false)
    progressNavigate(href)
  }

  function chooseTheme(theme: Theme) {
    setTheme(theme)
    setCommandPaletteOpen(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setCommandPaletteOpen}
      title="Busca rápida"
      description="Navegue pelo Tavvi ou altere a aparência."
      className="top-1/2 max-w-xl -translate-y-1/2 rounded-[22px]! border border-border/70 shadow-2xl"
    >
      <Command className="rounded-[22px]">
        <CommandInput placeholder="Buscar páginas e ações…" />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {items.map((item) => {
              const Icon = getNavIcon(item.icon)
              return (
                <CommandItem
                  key={item.href}
                  value={[item.label, ...(item.keywords ?? [])].join(' ')}
                  disabled={item.disabled}
                  onSelect={() => navigate(item.href)}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.description ? (
                    <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                      {item.description}
                    </span>
                  ) : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Aparência">
            <CommandItem onSelect={() => chooseTheme('system')}>
              <RiComputerLine aria-hidden="true" /> Sistema
            </CommandItem>
            <CommandItem onSelect={() => chooseTheme('light')}>
              <RiSunLine aria-hidden="true" /> Claro
            </CommandItem>
            <CommandItem onSelect={() => chooseTheme('dark')}>
              <RiMoonLine aria-hidden="true" /> Escuro
              <CommandShortcut>Ctrl Alt T</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
