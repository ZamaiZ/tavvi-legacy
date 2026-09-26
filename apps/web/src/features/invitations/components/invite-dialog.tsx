'use client'

import { useState, useTransition } from 'react'
import {
  RiAlertLine,
  RiCheckLine,
  RiFileCopyLine,
  RiMailAddLine,
} from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { IconField } from '@/components/ui/field-icon'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import {
  MEMBER_ROLE_HINTS,
  MEMBER_ROLE_LABELS,
  memberRoleSchema,
  type MemberRole,
} from '@/domain/invite'
import {
  createPlatformInviteAction,
  createTeamInviteAction,
} from '@/server/actions/invites'

// Um componente para os dois convites. Eles diferem em uma coisa só — o
// convite de equipe escolhe papel, o de plataforma não, porque não existe
// restaurante ainda e o papel é sempre administrador. Duplicar a tela por
// causa de um campo faria dois lugares para o aviso do link aparecer uma vez
// só — e um deles ficaria desatualizado.
type InviteDialogProps =
  | { mode: 'platform' }
  | { mode: 'team'; restaurantId: string }

// `props` inteiro, e não desestruturado na assinatura: o TypeScript não
// estreita união discriminada quando ela é desmontada ali. Dentro da função,
// `props.mode === 'team'` estreita normalmente.
export function InviteDialog(props: InviteDialogProps) {
  const { mode } = props
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setOpen(false)
    setLink(null)
    setCopied(false)
    setError(null)
  }

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const email = String(formData.get('email') ?? '').trim() || undefined
      const expiresInDays = Number(formData.get('expiresInDays') ?? 7)

      const result =
        props.mode === 'platform'
          ? await createPlatformInviteAction({ email, expiresInDays })
          : await createTeamInviteAction({
              restaurantId: props.restaurantId,
              role: memberRoleSchema.catch('waiter').parse(formData.get('role')),
              email,
              expiresInDays,
            })

      if (result.ok) setLink(result.data.link)
      else setError(result.error)
    })
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Área de transferência negada ou indisponível. O link continua visível
      // e selecionável na tela, então dá para copiar na mão.
      toast.add({
        title: 'Não foi possível copiar automaticamente',
        description: 'Selecione o link e copie manualmente.',
        type: 'warning',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : reset())}>
      <DialogTrigger render={<Button variant={mode === 'platform' ? 'default' : 'outline'} />}>
        <RiMailAddLine className="size-4" />
        {mode === 'platform' ? 'Novo convite' : 'Convidar alguém'}
      </DialogTrigger>

      <DialogContent className={`${mode === 'team' ? 'tv-bottom-sheet-dialog' : ''} rounded-[24px] p-6 sm:p-7`}>
        {link === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
                {mode === 'platform' ? 'Novo convite' : 'Convidar para a equipe'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'platform'
                  ? 'Gera um link para alguém criar o próprio restaurante. Quem aceitar vira administrador dele.'
                  : 'Gera um link para alguém entrar na equipe deste restaurante.'}
              </DialogDescription>
            </DialogHeader>

            <form action={submit} className="space-y-6">
              {mode === 'team' ? (
                <Field>
                  <FieldLabel htmlFor="role">Papel</FieldLabel>
                  <div className="tv-invite-roles">
                    {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => <label key={role}>
                      <input type="radio" name="role" value={role} defaultChecked={role === 'waiter'} />
                      <strong>{MEMBER_ROLE_LABELS[role]}</strong>
                      <small>{MEMBER_ROLE_HINTS[role]}</small>
                    </label>)}
                  </div>
                  <FieldDescription>
                    Administradores podem editar o restaurante; os demais papéis consultam.
                  </FieldDescription>
                </Field>
              ) : null}

              <IconField
                id="invite-email"
                name="email"
                type="email"
                label="Amarrar a um e-mail"
                icon={<RiMailAddLine />}
                description="Opcional. Preenchido, o link só funciona para quem entrar com esse e-mail."
              />

              <Field>
                <FieldLabel htmlFor="expiresInDays">Prazo para aceitar</FieldLabel>
                <NativeSelect id="expiresInDays" name="expiresInDays" defaultValue="7">
                  <option value="1">1 dia</option>
                  <option value="7">7 dias</option>
                  <option value="30">30 dias</option>
                </NativeSelect>
                <FieldDescription>Depois desse prazo o link para de funcionar. Quem aceitar dentro do prazo não perde o acesso depois.</FieldDescription>
              </Field>

              {error ? (
                <p role="alert" className="text-small text-destructive">
                  {error}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={reset}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending} className="min-w-28">
                  {pending ? <Spinner className="size-4" /> : null}
                  {pending ? 'Gerando link…' : 'Gerar link'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">Convite criado</DialogTitle>
              <DialogDescription>
                Copie o link agora. Ele não será exibido de novo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* O aviso é texto, não só cor: quem não distingue o âmbar
                  precisa ler que isto é irrecuperável. */}
              <p className="flex gap-2 rounded-lg bg-status-suspended-bg p-4 text-small text-status-suspended">
                <RiAlertLine className="size-5 shrink-0" aria-hidden="true" />
                <span>
                  O sistema guarda apenas uma marca deste link, e não consegue
                  reconstruí-lo. Se você fechar sem copiar, terá que emitir
                  outro convite.
                </span>
              </p>

              <div className="flex gap-2">
                <Input
                  readOnly
                  value={link}
                  onFocus={(event) => event.target.select()}
                />
                <Button type="button" variant="outline" onClick={copy}>
                  {copied ? (
                    <RiCheckLine className="size-4" />
                  ) : (
                    <RiFileCopyLine className="size-4" />
                  )}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={reset}>
                Já copiei o link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
