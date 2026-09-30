import { PageHeader } from '@/components/shell/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MEMBER_ROLE_HINTS,
  MEMBER_ROLE_LABELS,
  type MemberRole,
} from '@/domain/invite'

// Espelha a tela de equipe. O que não depende de dados (cabeçalho, nomes dos
// papéis, colunas) já aparece pronto; só contagens e membros esperam — assim
// nada pula de lugar quando a página chega.
export default function Loading() {
  return (
    <main className="tv-team-page" aria-busy="true">
      <PageHeader
        eyebrow="Acessos"
        title="Equipe"
        description="Administradores editam o restaurante. Caixa, atendente e garçom consultam o cardápio e os preços."
        actions={<Skeleton className="h-[30px] w-[104px] rounded-full" />}
      />

      <div className="tv-team-body">
        <section className="tv-team-roles" aria-label="Papéis da equipe">
          {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => (
            <article key={role} className="tv-team-role">
              <div className="tv-team-role-head">
                <strong>{MEMBER_ROLE_LABELS[role]}</strong>
                <Skeleton className="h-[22px] w-4" />
              </div>
              <p>{MEMBER_ROLE_HINTS[role]}</p>
              <span className={`tv-team-tag${role === 'admin' ? ' is-edit' : ''}`}>
                {role === 'admin' ? 'Edita' : 'Consulta'}
              </span>
            </article>
          ))}
        </section>

        <div className="tv-table-shell">
          <div className="tv-table-head tv-team-columns">
            <span>Pessoa</span>
            <span>Papel</span>
            <span>Desde</span>
            <span />
          </div>
          {[0, 1, 2].map((membro) => (
            <div key={membro} className="tv-team-row tv-team-columns">
              <div className="tv-team-person">
                <Skeleton className="size-[30px] shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40 max-w-full" />
                  <Skeleton className="h-3 w-28 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-7 w-full rounded-[7px]" />
              <Skeleton className="h-3.5 w-[72px]" />
              <Skeleton className="ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
