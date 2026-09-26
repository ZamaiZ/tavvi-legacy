import type { ComponentProps, ReactNode } from 'react'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'

// O projeto já tinha `input-group` e nenhum campo o usava. Este invólucro
// existe para que pôr ícone num campo custe uma linha, e não seis — que é a
// diferença entre a regra ser seguida e ser esquecida.
export function IconField({
  id,
  label,
  icon,
  description,
  error,
  ...props
}: ComponentProps<typeof InputGroupInput> & {
  id: string
  label: string
  icon: ReactNode
  description?: string
  error?: string
}) {
  // Erro e descrição nunca aparecem juntos: quando há erro, ele SUBSTITUI a
  // ajuda. Empilhar os dois faz a pessoa ler a instrução que ela acabou de
  // não conseguir seguir.
  const describedBy = error ? `${id}-error` : description ? `${id}-help` : undefined

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        {/* aria-hidden porque o ícone repete o rótulo. Leitor de tela
            anunciando "ícone de e-mail, E-mail" é ruído, não ajuda. O clique
            no ícone continua focando o campo — isso é conveniência de mouse,
            e o próprio InputGroupAddon já cuida disso. */}
        <InputGroupAddon aria-hidden="true">{icon}</InputGroupAddon>
        <InputGroupInput
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </InputGroup>

      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : description ? (
        <FieldDescription id={`${id}-help`}>{description}</FieldDescription>
      ) : null}
    </Field>
  )
}
