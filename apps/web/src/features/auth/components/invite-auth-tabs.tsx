'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'

// Criar conta ou entrar, no convite. Trocar de aba no meio de um envio
// esconderia o resultado: as abas travam enquanto um dos dois roda.
export function InviteAuthTabs({ next }: { next: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Tabs defaultValue="criar">
      <TabsList className="w-full">
        <TabsTrigger value="criar" className="flex-1" disabled={busy}>
          Criar conta
        </TabsTrigger>
        <TabsTrigger value="entrar" className="flex-1" disabled={busy}>
          Já tenho conta
        </TabsTrigger>
      </TabsList>
      <TabsContent value="criar" className="pt-6">
        <SignUpForm onPendingChange={setBusy} />
      </TabsContent>
      <TabsContent value="entrar" className="pt-6">
        {/* O destino é esta mesma página: depois de entrar, a pessoa
            precisa voltar aqui para concluir. O token vive no caminho,
            então atravessa a autenticação sem se perder. */}
        <SignInForm next={next} onPendingChange={setBusy} />
      </TabsContent>
    </Tabs>
  )
}
