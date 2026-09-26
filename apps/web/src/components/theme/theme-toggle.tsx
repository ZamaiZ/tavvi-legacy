'use client'

import { RiComputerLine, RiMoonLine, RiSunLine } from 'react-icons/ri'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme, type Theme } from './theme-provider'

const OPTIONS: { value: Theme; label: string; Icon: typeof RiSunLine }[] = [
  { value: 'light', label: 'Claro', Icon: RiSunLine },
  { value: 'dark', label: 'Escuro', Icon: RiMoonLine },
  { value: 'system', label: 'Sistema', Icon: RiComputerLine },
]

export function ThemeToggle({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  const { theme, setTheme } = useTheme()
  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2]

  return (
    <DropdownMenu>
      {/* Base UI compoe com `render`, nao com `asChild` do Radix. O rotulo
          diz qual tema esta ativo: sem ele, um botao que so mostra um icone
          nao se explica para leitor de tela. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={label ? 'lg' : 'icon'}
            className={cn(label && 'w-full justify-start gap-3 px-3', className)}
            aria-label={label ? undefined : `Tema: ${current.label}`}
          />
        }
      >
        <current.Icon className="size-[20px]" aria-hidden="true" />
        {label ? <span>{label}</span> : <span className="sr-only">Tema</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (value === 'light' || value === 'dark' || value === 'system') {
              setTheme(value)
            }
          }}
        >
          <DropdownMenuLabel>Aparência</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OPTIONS.map(({ value, label: optionLabel, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" aria-hidden="true" />
              {optionLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
