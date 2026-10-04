# Fase 0 — Fundação

Este documento é o que uma pessoa precisa para subir o projeto e o que precisa ser resolvido antes de publicar. A arquitetura e as razões de cada decisão estão em [`docs/superpowers/specs/2026-09-18-fundacao-nfc-menu-design.md`](docs/superpowers/specs/2026-09-18-fundacao-nfc-menu-design.md).

## Subir o ambiente

1. **Docker Desktop precisa estar aberto.** O banco de prova roda dentro dele. Confira com `docker info --format "{{.ServerVersion}}"` — se der erro de pipe, o Docker está fechado.
2. `npx supabase start` sobe o Postgres local. A primeira vez baixa algo em torno de 1 a 2 GB de imagens.
3. `.env.local` precisa das três variáveis de `.env.example`. A chave anônima sai de `npx supabase status`, ou do painel do projeto na nuvem.
4. `pnpm dev`.

## Os três territórios

| Host em desenvolvimento | Quem | Sessão |
|---|---|---|
| `localhost:3000` | Cliente final, anônimo | **Nenhuma.** Este território nunca cria cliente de auth nem toca cookie |
| `admin.localhost:3000` | Administrador da plataforma | Isolada, cookie host-only |
| `painel.localhost:3000` | Dono do restaurante | Isolada, cookie host-only |

Chrome, Edge e Firefox resolvem `*.localhost` sozinhos — não é preciso editar o arquivo `hosts`. Para testar por linha de comando sem depender de DNS, use o header `Host`:

```bash
curl -s -H "Host: admin.localhost:3000" http://127.0.0.1:3000/entrar
```

Cada território tem cookie de sessão próprio, **host-only**. Quem for administrador e também dono de restaurante autentica duas vezes. É o preço da barreira: uma falha no cardápio público não alcança a sessão de administrador, porque ela não existe naquele domínio.

## Banco de dados

O que se executa no SQL Editor do Supabase é **`supabase/schema.sql`** — um arquivo só, com todas as migrations em ordem. Ele é gerado a partir de `supabase/migrations/` por:

```bash
bash supabase/build-schema.sh
```

Tudo nele é idempotente: rodar de novo não quebra nada e não duplica nada. O SQL Editor não guarda estado de migração, então um arquivo único e repetível elimina a chance de colar na ordem errada, pular um arquivo ou usar uma versão velha.

### Primeiro administrador

Não existe caminho no código que promova alguém a administrador da plataforma. Uma porta dessas seria a primeira coisa que um atacante procuraria. A promoção é manual, uma vez por ambiente:

1. Crie a conta normalmente (pelo app, ou em *Authentication → Users* no painel).
2. Abra `supabase/seed/bootstrap-admin.sql`, troque o e-mail na linha marcada.
3. Execute no SQL Editor e confira na listagem do final que a conta aparece.

### Verificar o isolamento

```bash
docker exec -i supabase_db_nfc-menu psql -U postgres -d postgres < supabase/seed/verificar-isolamento.sql
```

Cria dois donos e dois restaurantes, consulta o banco como cada um e desfaz tudo no final. **Toda linha precisa vir com `passou = t`.** Rode isso sempre que mexer em uma política de RLS.

### Dados de exemplo

`supabase/seed/dados-de-exemplo.sql` cria um restaurante de demonstração com categorias, itens, variações e um identificador. A última linha do arquivo, comentada, apaga tudo.

## Antes de publicar

Itens obrigatórios, nenhum deles opcional:

- **IP confiável.** `src/server/security/client-ip.ts` lê `x-forwarded-for`, que é **falsificável** quando não vem de um proxy confiável. Trocar pelo header que a plataforma garante (na Vercel, `x-vercel-forwarded-for`). Sem isso, o rate limit é contornável trocando um header.
- **`NEXT_PUBLIC_ROOT_DOMAIN`** apontando para o domínio real. Os três territórios são derivados dele; nada é escrito no código.
- **Três registros DNS**: o domínio raiz, `admin.` e `painel.`. Como são subdomínios fixos, **não** é preciso DNS wildcard nem certificado wildcard.
- **`serverActions.allowedOrigins`** já lista os três hosts em `next.config.ts`, derivados da env. Confira depois de trocar o domínio — a porta precisa aparecer por extenso quando houver uma.

## Dívidas conhecidas

> Resolvida na Fase 1: os tipos do banco passaram a ser gerados em
> `src/domain/database.types.ts` e o cliente Supabase é tipado com eles.
> Regerar com `npx supabase gen types typescript --local` sempre que uma
> migration mudar o schema.


| Dívida | Consequência | Quando vence |
|---|---|---|
| Sem SMTP | Não existe "esqueci minha senha". A recuperação é o administrador emitir um convite novo | Ao passar de ~10 restaurantes |
| Sem testes automatizados | Nenhum alarme quando alguém alterar uma política de RLS. As garantias estruturais (chave estrangeira composta, RLS negando por padrão) seguem valendo sozinhas | A critério do cliente |
| Duração de vídeo não verificada no servidor | Um dono pode subir vídeo longo de baixa qualidade no próprio cardápio | Quando entrar serviço de vídeo dedicado |
| Órfãos de upload interrompido | Acúmulo lento no storage | Quando o volume justificar uma rotina de limpeza |
| Sem cache entre requisições | Cada acesso ao cardápio consulta o banco | Quando o volume justificar. A DAL já é a fronteira de cache |
| Dois logins para quem for admin e dono | Consequência aceita do isolamento de sessão | Não vence: é o preço da barreira |

## O que a Fase 0 deixa pronto

- **Pedido e comunicação com o estabelecimento:** o item tem identidade estável e o identificador já carrega contexto de mesa em `label`. Pedido vira tabela nova apontando para o que já existe, não remodelagem.
- **Equipe e franquia:** `memberships` já é N↔N e `manager` já existe no enum. Falta apenas política e interface.
- **Vídeo em serviço dedicado:** `src/server/dal/media.ts` é a interface; trocar o provedor não toca no resto.
- **Novo território:** a derivação vive em `src/server/territory.ts`. Um quarto subdomínio é uma entrada a mais nesse mapa.
