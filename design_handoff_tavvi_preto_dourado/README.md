# Handoff: Tavvi em preto e dourado (console, painel, web e mobile)

Spec para reimplementar a identidade visual do **console da plataforma** (admin) e do **painel do restaurante** no monorepo `tavvi`, no web (`apps/web`, Next.js) e no app (`apps/mobile`, Expo). Nenhuma regra de negócio muda. O **cardápio público** (`apps/web/src/features/public-menu`, rotas `(site)`) **não muda**.

---

## 1. Sobre os arquivos deste pacote

Os arquivos `.dc.html` são **referências de design feitas em HTML**. São protótipos que mostram aparência e comportamento, **não código para copiar**. A tarefa é recriar esse visual no código que já existe (Next.js + Tailwind v4 + shadcn no web; Expo + React Native no mobile), mantendo os padrões, stores, server actions, DAL e rotas atuais.

Abra no navegador (precisa de internet para os ícones Lucide via unpkg):

| Arquivo | Conteúdo |
|---|---|
| `Tavvi Web.dc.html` | Protótipo clicável desktop: login, console, painel e convite. Barra "Protótipo" no rodapé troca de área. |
| `Tavvi Mobile.dc.html` | Dois iPhones clicáveis: app nativo do console (esquerda) e painel no navegador do celular (direita). Alterna claro/escuro. |
| `Tavvi Sistema.dc.html` | Cores, tipografia, componentes e o plano resumido. |
| `assets/` | Logo recolorida em dourado, versões para fundo claro e escuro. |
| `tokens/web-tokens.css` | Bloco de tokens pronto para substituir o de `base.css`. |
| `tokens/mobile-tokens.ts` | Proposta de `tokens.ts` + `typography.ts` do app. |

`support.js` e `tv-icon.js` servem só para os protótipos rodarem. Não vão para o produto.

## 2. Fidelidade

**Alta fidelidade.** Cores, tamanhos, pesos, raios, alturas e textos são finais. Recriar com precisão usando os componentes do repo (`components/ui/*`, `features/platform/components/*`, `features/workspace/components/*`, `apps/mobile/src/components/primitives/*`). Toda a copy dos protótipos veio do código atual; manter os textos do código quando houver diferença mínima.

## 3. Regras que continuam iguais (não mexer)

- **Não existe cadastro aberto.** As telas de login do console e do painel só têm "Entrar". Nenhum link de "criar conta".
- **Conta só nasce de convite.** O console emite **convites de plataforma**; quem abre o link cria a conta (ou entra) e cria **o próprio restaurante**. O painel emite **convites de equipe** com papel.
- Fluxo de `/convite/[token]` (`app/admin/workspace/invite/[token]/page.tsx`) continua com os 4 estados:
  1. token inválido/vencido/revogado/usado → "Convite indisponível";
  2. convite de plataforma, sem sessão → abas "Criar conta" / "Já tenho conta" (`SignUpForm` / `SignInForm next=/convite/[token]`);
  3. convite de plataforma, com sessão → `CreateRestaurantStep` (nome + slug com checagem ao vivo);
  4. convite de equipe, com sessão → `AcceptInviteButton`.
- A página não mostra quem emitiu, o e-mail amarrado nem a data.
- O link de convite aparece **uma única vez**: "Já copiei o link" só habilita depois de copiar; fechar sem copiar pede confirmação ("Descartar link?").
- Validade de 1 a 30 dias; "Gerar novo link" revoga o anterior e mantém destinatário e prazo.
- Papéis: Administrador (edita), Caixa / Atendente / Garçom (consultam). Precisa haver pelo menos um administrador; ninguém edita o próprio papel.
- Publicação exige itens visíveis com mídia (o cardápio é um feed de fotos).
- App mobile continua **somente console** (convites e restaurantes), com login por senha e biometria.

---

## 4. Tokens

### 4.1 Cores — web e mobile

Substituem **todo** o bloco `--tv-lime*` e as superfícies esverdeadas. O dourado é o único acento. Botão primário: **tinta** no claro, **dourado** no escuro.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `bg` | `#F5F3EE` | `#0D0C0A` | fundo da página |
| `side` | `#FAF9F6` | `#11100E` | sidebar |
| `surface` | `#FFFFFF` | `#171613` (mobile `#1A1916`) | cartões, tabelas, diálogos |
| `surface2` | `#F8F6F2` | `#1D1B18` (mobile `#211F1C`) | miniaturas, blocos internos |
| `hover` | `rgba(22,20,15,.04)` | `rgba(255,248,235,.045)` | hover de linha |
| `active` | `rgba(22,20,15,.065)` | `rgba(255,248,235,.08)` | item ativo da sidebar, linha selecionada |
| `line` | `rgba(22,20,15,.08)` | `rgba(255,248,235,.075)` | bordas de cartão e divisórias |
| `line2` | `rgba(22,20,15,.14)` | `rgba(255,248,235,.14)` | bordas de campo e botão secundário |
| `text` | `#17150F` | `#F2EEE6` | texto principal |
| `text2` | `#6A655B` | `#A6A094` | descrições |
| `text3` | `#8F8A80` | `#7C766B` | metadados, placeholders, cabeçalho de tabela |
| `gold` | `#B38B4D` | `#D0AC6E` | preenchimentos (switch ligado, anel de seleção, pontos) |
| `goldText` | `#86622C` | `#D6B67C` | **texto** dourado (AA sobre surface) |
| `goldSoft` | `#F3EBDD` | `rgba(208,172,110,.12)` | fundo de badge dourado, avatar |
| `btn` | `#17150F` | `#D0AC6E` | botão primário |
| `btnText` | `#FFFFFF` | `#15120C` | texto do primário |
| `hero` | `linear-gradient(135deg,#DDBF8A 0%,#C9A266 48%,#B48A4E 100%)` | `linear-gradient(135deg,#CFAE72 0%,#B28A4C 55%,#8F6B35 100%)` | cartão dourado |
| `heroInk` | `#1D170E` | `#17120A` | texto no cartão dourado |
| `heroInk2` | `rgba(29,23,14,.68)` | `rgba(23,18,10,.70)` | texto secundário no cartão dourado |
| `heroChip` | `rgba(255,255,255,.28)` | `rgba(255,255,255,.22)` | pílulas dentro do cartão dourado |
| `ok` / `okSoft` | `#3C7A4E` / `#E4EFE5` | `#86C595` / `rgba(134,197,149,.12)` | Ativo, Resgatado, Disponível |
| `warn` / `warnSoft` | `#94660F` / `#F5EAD2` | `#E0B465` / `rgba(224,180,101,.12)` | Suspenso, Vencido, Sem foto |
| `danger` / `dangerSoft` | `#B2372C` / `#F7E3DF` | `#EE8C80` / `rgba(238,140,128,.12)` | erro, destrutivo, Esgotado |
| `neutralSoft` | `rgba(22,20,15,.055)` | `rgba(255,248,235,.07)` | trilho de segmentado, Rascunho, Revogado |
| `scrim` | `rgba(22,20,15,.26)` | `rgba(0,0,0,.55)` | fundo de modal |
| `shadow` | `0 1px 2px rgba(22,20,15,.04)` | `none` | cartões |
| `pop` | `0 18px 44px -12px rgba(22,20,15,.22), 0 2px 6px rgba(22,20,15,.06)` | `0 24px 56px -12px rgba(0,0,0,.7), 0 0 0 1px rgba(255,248,235,.06)` | popover, drawer, diálogo, barra de salvar |
| `bar` (mobile) | `rgba(250,249,246,.86)` + blur 20 | `rgba(20,19,17,.86)` + blur 20 | tab bar e barra superior |

Mapeamento de badges de situação:

| Situação | Cor |
|---|---|
| Convite Pendente | `goldText` sobre `goldSoft` |
| Resgatado, Ativo | `ok` sobre `okSoft` |
| Vencido, Suspenso | `warn` sobre `warnSoft` |
| Revogado, Rascunho | `text2` sobre `neutralSoft` |

Badge: altura 20 (web) / 22 (iOS), padding 0 8, raio 999, 11px/500, ponto de 5px `currentColor` antes do texto.

### 4.2 Tipografia

**Fonte do sistema Apple** em todo o console e painel. Remover Plus Jakarta Sans e Inter do admin/painel (as fontes dos temas do cardápio público continuam).

```
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
font-variant-numeric: tabular-nums;
-webkit-font-smoothing: antialiased;
letter-spacing: -0.003em;
```
Mono (slugs, links, hex): `ui-monospace, "SF Mono", Menlo, monospace`, 11.5–12px.

No Expo: `fontFamily: undefined` (ou `'System'`). No iOS isso já é SF Pro. Remover `@expo-google-fonts/plus-jakarta-sans` e `Inter` do carregamento.

**Escala web**

| Papel | Tamanho / peso / entrelinha | Tracking |
|---|---|---|
| Título de página (h1) | 22 / 600 / 1.2 | -0.022em |
| Título do login (hero) | 34 / 600 / 1.1 | -0.025em |
| Título do login (form) | 22 / 600 | -0.02em |
| Número do cartão dourado | 32 / 600 / 1 | -0.03em |
| Número de estatística | 22 / 600 | -0.02em |
| Título de diálogo | 17 / 600 | -0.015em |
| Título de drawer | 18 / 600 | -0.02em |
| Seção / cartão | 14–15 / 600 | -0.01em |
| Linha de tabela, botão, input | 13 / 500 (input 400) | — |
| Corpo, descrição de página | 13 / 400 / 1.45 | — |
| Botão pequeno | 12.5 / 500 | — |
| Rótulo de campo | 12 / 500, cor `text2` | — |
| Eyebrow sobre o h1 ("Cardápio", "Marca"…) | 11.5 / 500, cor `goldText` | — |
| Metadado, cabeçalho de tabela, ajuda | 11.5 / 400–500, cor `text3` | — |
| Badge, contador | 11 / 500 | — |

**Escala iOS (app e web mobile)**

| Papel | Tamanho / peso |
|---|---|
| Large Title | 32 / 700, tracking -0.025em (web mobile: 28) |
| Headline, título de nav, título de sheet | 17 / 600 |
| Botão principal | 16 / 600 |
| Campo | 16 / 400 (nunca menos, para o iOS não dar zoom) |
| Linha de lista | 15 / 500 |
| Descrição | 14 / 400 |
| Footnote, metadado | 13 / 400 `text3` |
| Cabeçalho de grupo | 13 / 400, MAIÚSCULAS, tracking .02em, `text3` |
| Tab bar | 10.5 / 500 |

### 4.3 Raios, alturas, espaçamento

| Elemento | Web | iOS |
|---|---|---|
| Botões | pílula (999) · 30 px (página) · 34–36 px (diálogo/login) · 28 px (dentro de cartão) | pílula · 50–52 px |
| Campo | raio 8 · 32 px (página) · 34 px (login/diálogo) | raio 13–14 · 48–50 px |
| Controle segmentado | trilho raio 9, padding 2, fundo `neutralSoft`; botão raio 7, 26 px; ativo `surface` + `0 1px 2px rgba(22,20,15,.08), 0 0 0 .5px line2` | trilho raio 10; botão 32 px |
| Chip de filtro | 26 px, raio 999, ativo `btn`/`btnText`, inativo `surface` + borda `line2` | 32 px |
| Cartão, tabela | raio 14, borda `line`, `shadow` | raio 14 (grupo), 20 (destaque) |
| Cartão dourado | raio 16, padding 16×18 | raio 18–20, padding 14–16 |
| Drawer lateral | raio 18, 10 px das bordas | — |
| Diálogo | raio 18 (formulário), 16 (confirmação) | sheet raio 14 no topo |
| Menu de contexto | raio 11, padding 5, item 28 px raio 6 | — |
| Ícone em tile | 30×30 raio 8 (linha), 40–44 raio 12 (detalhe) | 34–36 raio 10 |
| Avatar | 26 (sidebar), 30 (linha), 34 (conta) — círculo `goldSoft`/`goldText` | 36, 52 (conta) |
| Switch | 30×18, bolinha 14 | 51×31, bolinha 27 |

Conteúdo das páginas web: `max-width: 1120px` (1160 no cardápio, identidade e contato), `padding: 26px 32px 64px`, `gap: 18px` entre blocos. Escala de espaço: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32.

### 4.4 Movimento

Uma curva só: `cubic-bezier(.2,.8,.2,1)` (ou a `--ease-out` atual). Sidebar abre e fecha animando `width` em 200 ms. Switch e hover: 150 ms. Sem glow, sem brilho, sem "bolsa". Com `prefers-reduced-motion`, tudo instantâneo.

---

## 5. Marca

- `assets/tavvi-brandmark-gold-on-light.png` / `-on-dark.png`: símbolo.
- `assets/tavvi-lockup-horizontal-gold-on-light.png` / `-on-dark.png`: símbolo + nome.
- `assets/tavvi-wordmark-gold-on-light.png` / `-on-dark.png`: nome.

Na versão para fundo claro, o traço dourado é `#B38B4D` e o texto `#16140F`. Na versão para fundo escuro, o traço é `#D6B67A` e o texto `#F4F1EA`.

Substituir em `apps/web/public/brand/` e `apps/mobile/assets/images/brand/`. Gerar de novo: ícone do app (`tavvi-icon.png`, fundo `#0D0C0A`, símbolo dourado), splash (`#0D0C0A`), favicon e `apple-touch-icon`. Os arquivos são recoloridos do PNG atual; para produção, peça a versão vetorial ao design.

Uso: lockup de 80–96 px no login e no convite; símbolo de 20 px dentro de um tile 28×28 (raio 8, `surface`, borda `line`) no topo da sidebar do console. Marca d'água do símbolo só no cartão dourado (opacidade .10–.12, `mix-blend-mode: multiply`) e no login escuro (opacidade .06).

---

## 6. Web — shell

### 6.1 Sidebar única (substitui as duas atuais)

Hoje existem duas navegações: `rail.tsx` (console e restaurante, via `console-shell.tsx` + `console-config.ts`) e `desktop-sidebar.tsx` + `nav-tree.tsx` (lista de restaurantes, via `tavvi-shell.tsx`). **Unificar em um componente `Sidebar`** usado pelos dois shells.

**Remover:** `liquid-frame.tsx`, `use-liquid-pocket.ts`, `nav-tree-geometry.tsx`, os flyouts do modo recolhido de `nav-tree.tsx`, e qualquer "encaixe" visual entre o item ativo e o conteúdo. Manter `rail-store.ts` / `sidebar-store.ts` (um só store) para o estado recolhido, persistido.

**Layout**
- `aside` com largura **232 px** aberta e **60 px** recolhida (transição de `width` 200 ms). Fundo `side`, `border-right: 1px solid line`, padding `10px 8px`, coluna com `gap: 2px`, altura 100vh, sem rolagem própria.
- **Topo (40 px)**, padding 0 4, gap 9:
  - Console / lista de restaurantes: tile 28×28 com o símbolo dourado; título "Tavvi" (13/600) e subtítulo "Console" ou "Painel" (11, `text3`).
  - Dentro de um restaurante: tile 28×28 com as iniciais em `hero`/`heroInk` (11/650); título = nome do restaurante; subtítulo "Painel · {papel}".
  - À direita, botão 26×26 `panel-left` "Recolher (⌘B)". Recolhida, some o texto e o botão; aparece `panel-left-open` acima da conta.
- **Busca**: 30 px, borda `line`, raio 8, fundo `surface`, ícone `search` 15, texto "Buscar" `text3`, `kbd` "⌘K" à direita (10.5px, borda `line`, raio 5). Recolhida, só o ícone, centralizado. Abre a paleta (`command-palette.tsx`). margin-bottom 12.
- **Rótulo de seção** (só aberta): 11/500 `text3`, padding 0 9 6. "Plataforma" (console), "Restaurante" (painel), "Gerenciar" (lista).
- **Itens**: 30 px, raio 7, padding 0 9, gap 9, ícone 16. Inativo: `text2`, peso 450. Hover: fundo `active`. **Ativo:** fundo `active`, texto `text`, peso 590, ícone `goldText`. Contador à direita (11, `text3`). Recolhido: só ícone centralizado + `title`/tooltip com o nome.
- **Rodapé**: botão de conta (padding 6, raio 9) com avatar 26 (inicial do e-mail, `goldSoft`/`goldText`), e-mail (12.5/500) e descrição (11, `text3`), `chevrons-up-down` 14. Abre o popover de conta.

**Itens por contexto** (de `console-config.ts`; trocar ícones Remix por Lucide/react-icons `lu`):

| Contexto | Itens (ícone · contador) |
|---|---|
| Console | Convites (`mail` · pendentes) · Restaurantes (`store` · total) |
| Lista de restaurantes | Restaurantes (`store`) |
| Restaurante | Cardápio (`book-open`) · Identidade (`palette`) · Contato (`contact`) · Equipe (`users` · membros) |

Primeiros passos não aparece na sidebar; vem pelo botão "Primeiros passos" no cabeçalho do cardápio (e pelo redirecionamento depois de criar o restaurante). Durante o passo de identidade, o item Identidade fica ativo; no passo de contato, o item Contato.

**Atalhos:** ⌘K / Ctrl K abre e fecha a paleta. ⌘B / Ctrl B recolhe e expande (ignorar quando o foco estiver em input, textarea ou select). Esc fecha paleta, popover, menus e confirmações.

### 6.2 Popover de conta (`account-popover.tsx`)

Fixo a 10 px da esquerda e 62 px do fundo, 272 px, raio 14, `pop`, padding 12, gap 12. Avatar 34 + e-mail + descrição. Bloco "Tema" com segmentado de 3 (Sistema · Claro · Escuro). Divisória. "Sair" (`log-out`, cor `danger`, hover `dangerSoft`).

### 6.3 Paleta ⌘K (`command-palette.tsx`, `console-command-palette.tsx`)

Centrada a 14vh do topo, 540 px, raio 14, `pop`, scrim. Campo 48 px com `search` 16 e placeholder "Buscar página ou ação", `kbd` "esc". Itens: tile 28×28 (raio 7, `surface2`, ícone `goldText`), título 13/500, subtítulo 11.5 `text3`, tipo à direita ("Página"/"Ação"). O primeiro resultado fica marcado; Enter executa.

- Console: páginas + "Novo convite".
- Restaurante: páginas + "Nova categoria", "Modo serviço", "Trocar de restaurante".
- Sem resultado: "Nada encontrado."

### 6.4 Toast (`components/ui/toast.tsx`)

Canto inferior direito (20 px), pílula 36 px, fundo `#17150F`, texto `#F2EEE6` 12.5, círculo 18 px dourado `#D0AC6E` com `check`. Some após 2.4 s. Igual nos dois temas.

### 6.5 Padrões reutilizáveis

- **Cabeçalho de página** (`page-header.tsx`): eyebrow opcional (11.5/500 `goldText`), h1 22/600, descrição 13 `text2` max 560 px. Ação primária à direita, alinhada pela base.
- **Cartão dourado de resumo** (substitui `list-hero.tsx`): **um por tela**, no topo. Sem recorte chanfrado (`notched-path.ts` sai) e sem marca d'água grande: só o símbolo a 10–12% no canto superior direito.
- **Linha de estatísticas**: grid `minmax(0,2fr) repeat(3,minmax(0,1fr))`, gap 12. Cartão dourado + 3 cartões brancos (raio 16, padding 14×16, rótulo 12 `text2` com ícone 14 `text3`, número 22/600). Nos convites, os cartões são botões que aplicam o filtro.
- **Tabela** (`components/ui/table.tsx`, `invite-table.tsx`, `restaurant-table.tsx`): cartão raio 14. Cabeçalho 34 px, 11.5/500 `text3`, borda inferior `line`. Linhas `min-height: 52px` (50 nos restaurantes), padding 0 16, borda `line`, hover `hover`, selecionada `active`, cursor pointer, `chevron-right` 15 `text3` no fim. Tile ou avatar de 30 px na primeira coluna. Datas em `dd/mm/aaaa`, 12.5 `text2`.
- **Drawer de detalhe** (`invite-drawer.tsx`, `restaurant-drawer.tsx`): fixo à direita, 10 px de margem, 380 px (convite) / 400 px (restaurante), raio 18, `pop`, **sem scrim**; clicar fora fecha. Cabeçalho com rótulo 12 `text3` e botão fechar 28 px circular (`neutralSoft`, `x`).
- **Diálogo de confirmação** (`alert-dialog.tsx`): 320 px, centrado, raio 16, padding 20, texto centralizado. Ícone em círculo de 40 px (`dangerSoft`/`danger` se destrutivo, senão `goldSoft`/`goldText`). Título 15/600, texto 12.5 `text2`. Dois botões iguais de 32 px (Cancelar com borda / ação com fundo tonal).
- **Menu de contexto** (`dropdown-menu.tsx`): 180–210 px, alinhado à direita do gatilho, 4 px abaixo.
- **Barra de salvar flutuante** (identidade e contato): `position: sticky; bottom: 12px`, pílula, `surface`, borda `line`, `pop`, padding 8 8 8 16. Status à esquerda ("Tudo salvo" / "Alterações pendentes" / "Alterações não salvas"), ações à direita. Salvar com opacidade .4 enquanto não houver mudança.
- **Estado vazio**: cartão com borda **tracejada** `line2`, raio 14–16, padding 40–48, tile 40 (`goldSoft`), título 13.5–14/600, texto 12.5 `text2`, ação secundária.

---

## 7. Web — telas

Rotas atuais, sem mudança de URL.

### 7.1 Login do console e do painel
`admin/(platform)/sign-in`, `admin/workspace/sign-in` · `tavvi-auth-shell.tsx`, `auth-hero-copy.tsx`, `tavvi-sign-in-form.tsx`, `notched-surface.tsx` (sai), `auth.css`

- Grid de 2 colunas `minmax(0,1.05fr) minmax(0,1fr)`, 100vh.
- **Esquerda, sempre escura** (`#0D0C0A`, texto `#F2EEE6`), padding 40×48, coluna com `space-between`. Lockup dourado 92 px no topo. Símbolo gigante (520 px, opacidade .06) saindo pelo canto inferior direito. No meio, pílula "Console" / "Painel" (24 px, `rgba(208,172,110,.12)`, `#D6B67C`, ponto dourado), h1 34/600 e parágrafo 14 `#A6A094`:
  - Console: "Administre a plataforma." / "Convites, restaurantes e publicação em um só lugar."
  - Painel: "Seu restaurante, em ordem." / "Cardápio, identidade, equipe e contato — tudo o que o cliente vê na mesa." + 4 pílulas com borda: Cardápio, Identidade, Equipe, Contato.
  - Rodapé: wordmark 40 px a 55% · ano.
- **Direita**: fundo `bg`, formulário centralizado de 340 px, gap 14. "Entrar" (22/600) + dica 12.5 `text2` ("Credenciais de administrador" / "Acesso do restaurante"). Campos E-mail e Senha de 34 px com ícone 15 à esquerda (`mail`, `lock`); a senha tem o botão olho. Erro num bloco `dangerSoft`. CTA pílula de 36 px `btn`, "Entrar no console" / "Entrar no painel" + `arrow-right`, opacidade .45 até preencher os dois campos. Rodapé "Protegido por sessão segura · Tavvi" (11.5 `text3`).
- **Sem** "criar conta" e **sem** "esqueci a senha" (não existem hoje).
- O seletor Console/Painel no topo do formulário existe **só no protótipo**. No produto, cada rota tem o seu login.
- Abaixo de 900 px, a coluna escura vira uma faixa de 200 px acima do formulário.

### 7.2 Console · Convites
`admin/(platform)/invitations` · `invite-table.tsx`, `toolbar.tsx`, `list-hero.tsx`, `platform.css`

1. Cabeçalho: "Convites" / "Crie acessos seguros para que novos clientes cadastrem e administrem seus restaurantes." + botão primário "Novo convite" (`plus`).
2. Estatísticas: cartão dourado "Aguardando resgate" com pílula "Plataforma", número de pendentes e "pendentes de {n} convites emitidos", botões "Novo convite" (branco) e "Ver pendentes" (tinta); depois Resgatados (`circle-check`), Vencidos (`clock`), Revogados (`ban`).
3. Barra de ferramentas: busca de 260 px ("Buscar por e-mail") + segmentado Todos · Pendentes · Resgatados · Vencidos · Revogados, com contagem em `text3`. Manter o filtro na URL como hoje.
4. Tabela com as colunas `minmax(0,2.4fr) 96px 84px 84px 76px`: Destinatário (tile `mail` + e-mail ou "Qualquer e-mail" + meta "Válido até 3 de out. de 2026" / "Resgatado em…" / "Revogado em…" / "Venceu em…"), Situação (badge), Criado em, Válido até, ações (`ban` "Revogar convite" só nos pendentes, com hover `dangerSoft`; `rotate-ccw` "Gerar novo link" nos pendentes ou "Gerar novo convite" nos demais; `chevron-right`). Os botões de ação chamam `stopPropagation`. Abaixo de 760 px, a tabela rola na horizontal.
5. Sem resultados: "Nenhum convite encontrado para “{busca}”." ou "Nenhum convite nesta situação."

**Drawer do convite** (`invite-detail.tsx`): tile 40 `mail` + badge; e-mail (18/600, quebra em qualquer ponto) + meta; lista de 3 linhas (Criado em, Válido até, Destinatário = "E-mail definido" / "Qualquer e-mail"); **Histórico** em linha do tempo (ponto de 8 px + fio de 1 px): Criado (`text3`, "{data} · por {e-mail}"), Resgatado (`ok`), Revogado (`danger`), Venceu (`warn`), Aguardando resgate (`gold`). Ações: pendente → "Gerar novo link" (primário) + "Revogar convite" (`dangerSoft`/`danger`); demais → "Gerar novo convite" (secundário).

**Diálogo Novo convite / Novo link** (`invite-sheet.tsx`, `platform-invite-overlay.tsx`): 420 px, raio 18.
- Formulário: título + descrição ("Crie um acesso de restaurante." / "O link atual deixa de funcionar e um novo é gerado para o mesmo destinatário e prazo."). "E-mail (opcional)" com placeholder "Qualquer e-mail" e ajuda "Preenchido, o link só funciona para quem entrar com esse e-mail." (somente leitura ao gerar novo link). "Validade" como stepper (−/+ em 30×28, `neutralSoft`) de 1 a 30 dias, com ajuda "Escolha entre 1 e 30 dias. Depois desse prazo o link para de funcionar e você emite outro. Quem aceitar dentro do prazo não perde o acesso depois." CTA "Gerar link" / "Gerar novo link".
- Criado: círculo `okSoft` com `check`, "Convite criado" / "Copie agora. O link não será exibido novamente."; aviso em `warnSoft` ("O sistema guarda apenas uma marca deste link…"); link em mono dentro de `surface2`, `user-select: all`; "Copiar link" (secundário, vira "Link copiado" com `check`); "Já copiei o link" (primário, opacidade .4 até copiar).
- Fechar sem copiar: sobreposição "Descartar link?" / "Esse link é exibido uma única vez." com "Voltar ao link" e "Descartar".

### 7.3 Console · Restaurantes
`admin/(platform)/restaurants` · `restaurant-table.tsx`, `restaurant-detail.tsx`, `slug-form.tsx`, `status-form.tsx`

- Cabeçalho: "Restaurantes" / "Acompanhe os estabelecimentos, endereços públicos e situação de publicação."
- Estatísticas: cartão dourado "Restaurantes na plataforma" com o total e "cadastrados · {n} com cardápio no ar"; Ativos, Rascunho (`pencil-line`), Suspensos (`pause`).
- Busca 280 px "Buscar restaurante ou /slug".
- Tabela `minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.1fr) 92px 16px`: Restaurante (iniciais 30 px em `goldSoft`/`goldText`), Endereço (`/slug` em mono), Tipo (segmento ou "Não informado"), Situação, seta.
- **Drawer (400 px):** iniciais 44 px no gradiente `hero` + badge; nome + segmento; **Link público** (campo `surface2` com `link`, URL em mono, botão "Copiar" em `btn` → "Copiado" por 1.8 s); **Endereço público** (prefixo `tavvi.app/` + input; ajuda "O cardápio fica em … As plaquinhas continuam funcionando depois da troca…"; erro em `danger`; "Alterar endereço" desabilitado se o slug for igual ou inválido); **Situação** como radio de 3 cartões (Rascunho "Invisível para o público", Ativo "Cardápio no ar", Suspenso "Cardápio fora do ar"; o selecionado tem borda `gold`, fundo `goldSoft` e anel de 4 px dourado; Suspenso pede confirmação); Criado em / Atualizado em; "Remover restaurante" (texto `danger`, confirmação: "O cardápio sai do ar imediatamente… Os dados continuam no banco…").

### 7.4 Painel · Seus restaurantes
`admin/workspace/restaurants` (hoje em `tavvi-shell.tsx` + `desktop-sidebar.tsx`; passa a usar a Sidebar única)

Eyebrow "Painel", "Seus restaurantes", "Selecione um estabelecimento para gerenciar o cardápio, a marca e a equipe." Grid `repeat(auto-fill,minmax(250px,1fr))`, gap 14. Cartão: capa de 112 px (imagem real ou hachura neutra), iniciais 44 px sobre a borda da capa (gradiente `hero`, borda 3 px `surface`), nome 14/600, URL 12 `text3`, badge + papel. Hover: sobe 1 px e ganha `pop`.

### 7.5 Painel · Cardápio
`admin/workspace/restaurants/[id]` · `menu-workspace.tsx`, `publish-bar.tsx`, `category-section.tsx`, `item-row.tsx`, `menu-work-modes.tsx`, `reorder-buttons.tsx`, `workspace.css`

1. Cabeçalho: eyebrow "Cardápio", h1 = nome do restaurante, "Organize os pratos que seus clientes vão encontrar." Ações: "Primeiros passos" (secundário, `sparkles` dourado) e "Nova categoria" (primário, `folder-plus`).
2. **Cartão dourado de publicação** (substitui `publish-bar.tsx`):
   - Linha: pílula tinta com `globe` + "Rascunho" / "No ar"; descrição ("Só você vê. Publique quando terminar de montar." / "Quem encostar o celular na plaquinha vê o cardápio."). No ar: botão com a URL (copia) + "Ver no ar" (branco). Depois o botão tinta "Publicar cardápio" (`send`) / "Despublicar" (`eye-off`, com confirmação "Continuar no ar"), com opacidade .45 quando não dá para publicar. Por último, a pílula "Para publicar" com chevron, que abre e fecha o checklist.
   - Checklist em grid `auto-fit minmax(200px,1fr)`: "{n} categorias com itens"; "{x}/{y} itens visíveis com mídia" (clique aplica o filtro Sem mídia; "Ver sem mídia" sublinhado quando faltar); "Logo e capa adicionadas". Aviso abaixo, em `heroInk2`, quando faltar mídia.
3. Barra: segmentado **Ver** (Lista `list`, Índice `arrow-down-up`, Grade `layout-grid`) e segmentado **Trabalhar** (Estúdio, Quadro, Planilha, Sequência, Serviço); à direita, busca de 220 px "Buscar prato ou descrição" e o botão "Ordenar" (`arrow-up-down`), que fica em `btn` quando ativo e desabilitado com busca ou filtro.
4. Chips: Todos · Sem mídia · Indisponíveis · Ocultos, com contagem (escondidos nos modos Trabalhar).
5. **Categoria** = cartão raio 14. Cabeçalho: nome 14/600, "Oculta" se for o caso, "{n} itens", setas de ordem (quando Ordenar está ativo) e `ellipsis` (menu: Editar, Ocultar/Mostrar, Excluir, com confirmação que avisa quantos itens saem junto). Vazia: "Categoria sem itens" + "Adicionar primeiro item". Rodapé: "Adicionar item" em `goldText` (hover `goldSoft`).
6. **Linha do item** (Lista): grid `44px minmax(0,1fr) auto`, padding 10 12 10 16. Miniatura 44 raio 10 (imagem, ou tracejada com `image-plus` quando não houver mídia). Nome 13/500 + "Oculto" + badge "Sem foto" (`warnSoft`/`warn`). Descrição em 1 linha com reticências. Preço 12.5/500 ("A partir de" se houver variações; riscado se esgotado), meta "{n} fotos · {n} vídeos · {n} variações", tags como pílulas com borda. À direita: "Disponível"/"Esgotado" + switch dourado; setas (Ordenar); lápis; `ellipsis` (Editar, Marcar como esgotado/disponível, Ocultar/Mostrar, Mover para {categoria}…, Excluir). Item oculto com opacidade .55.
7. **Índice**: coluna de 180 px fixa ao rolar, com as categorias e contagens; clique rola até a categoria.
8. **Grade**: `auto-fill minmax(180px,1fr)`, imagem 4:3, nome, preço, switch.
9. **Serviço**: "Toque para alternar entre disponível e esgotado durante o atendimento." Tiles de 96 px (`auto-fill minmax(190px,1fr)`); esgotado em `dangerSoft`.
10. **Planilha**: colunas Item (input sem borda até o hover/foco), Categoria (select), Preço (R$ + input, salva no blur), Visível, Disponível (checkbox com `accent-color: gold`).
11. **Quadro**: colunas de 240 px em `neutralSoft`, cartões arrastáveis, select "Mover para outra categoria", coluna vazia com "Coluna livre".
12. **Sequência**: "A ordem em que os pratos aparecem no feed público. Só entram itens visíveis com foto ou vídeo." Cartões 9:12 com número em pílula tinta.
13. **Estúdio**: lista de 260 px + "Prévia ao vivo" (cartão do prato no tema do restaurante) + "Editar item".
14. Vazio total: "Seu cardápio começa aqui" + atalhos Entradas, Pratos principais, Bebidas, Sobremesas. Sem resultado: "Nenhum item encontrado" + "Limpar busca e filtros".

**Editar item** (`item-edit-dialog.tsx`, `media-editor.tsx`, `variants-editor.tsx`, `dietary-tags-input.tsx`): painel lateral de 520 px com scrim, raio 18.
- Cabeçalho "Editar item" + nome.
- Bloco em `surface2`: **Fotos e vídeos** (grade de 4, capa marcada com a pílula "Capa", remover em círculo de 20 px, "Adicionar" tracejado com hover dourado; foco e enquadramento como hoje) e **Variações** (linhas de 34 px + nome/preço/"Adicionar").
- **Dados do item**: Nome; Destaques e restrições (pílulas `goldSoft`, Enter ou vírgula adiciona, máximo de 10, sugestões "+ Vegetariano" etc.); Categoria + Preço (R$); Descrição ("Texto simples; não aceita os caracteres menor e maior."); switches Visível e Disponível em cartões de 40 px.
- Rodapé: "Fechar" (ghost) + "Salvar item" (primário).

### 7.6 Painel · Primeiros passos
`[id]/getting-started` · `create-restaurant-step.tsx` (passo 1, no convite), `profile-form.tsx`

Cabeçalho próprio: "Passo {n} de 3" (11.5/600 `goldText`) + barra de 160×4 (trilho `neutralSoft`, preenchimento `gold`), h1 26/600, descrição 13.5.
- Passo 2: "A cara do seu cardápio" / "Escolha o tema e as cores. Dá para mudar depois, quando quiser." + formulário de Identidade.
- Passo 3: "Como te encontram" / "Telefone, WhatsApp e endereço viram botões no topo do cardápio." + formulário de Contato.
- Rodapé com divisória: "Continuar para o contato" (secundário) e "Pular e montar o cardápio" / "Ir para o cardápio" (ghost).

### 7.7 Painel · Identidade
`[id]/identity` · `identity-form.tsx`, `brand-images.tsx`, `theme-preview.tsx`, `floating-restaurant-preview.tsx`

Grid `minmax(0,1fr) 300px`, gap 20.
- Cartão **Logo e capa** ("Gravam sozinhas, na hora do envio."): quadrado de 120 px + retângulo "Capa · 1600 × 900", ambos tracejados.
- Cartão de tema:
  - "Tipo de restaurante" (select, max 320 px; ajuda "Só serve para sugerir um tema…"). Trocar o tipo aplica o tema sugerido.
  - "Tema do cardápio": grid `auto-fill minmax(120px,1fr)` com os 8 presets (Brasa, Forno, Grão, Sal, Horta, Neon, Nori, Confeito). Cada botão mostra 3 bolinhas de 12 px (base, destaque, escuro), "Aa" 18 px na fonte e cor do tema, nome 12.5/600 e "SUGERIDO" (9.5/600 `goldText`). Selecionado: borda `gold` + fundo `goldSoft`. Abaixo, os segmentos do tema.
  - "Cor de fundo" e "Cor de destaque": 5 círculos de 26 px dentro da faixa do tema (lógica de `identity-theme-options.ts`, `fitContrast`); selecionado com anel `0 0 0 2px surface, 0 0 0 3.5px gold`; hex em mono + "Dentro da faixa deste tema." / "O matiz é mantido nas duas versões do cardápio."
  - "Densidade": segmentado Confortável · Compacto + ajuda.
- Barra de salvar: "Restaurar as cores do tema" (ghost, `undo-2`) + "Salvar identidade" (`check`).
- Direita, fixa: "Prévia do cardápio" num celular de 260×520 (moldura `#0D0C0A`, raio 34/27), renderizando **o tema do restaurante** (não o dourado). Legenda "O cardápio público mantém o tema do restaurante."

### 7.8 Painel · Contato
`[id]/contact` · `profile-form.tsx`, `contact-preview.tsx`

Grid `minmax(0,560px) 300px`. Três cartões:
- **Sobre**: Nome; Descrição com contador "{n}/500".
- **Canais** ("Telefone e WhatsApp são guardados com o código do Brasil (55)."): Telefone (`phone`), WhatsApp (`message-circle`), Instagram (`instagram`, prefixo "@", tira @ digitado). Máscara `(11) 98765-4321` como hoje.
- **Endereço**: "Endereço físico" (`map-pin`, máximo de 200).

Barra de salvar com "Descartar" (só quando houver mudança) + "Salvar". Prévia à direita com os 4 botões (Ligar em destaque, WhatsApp, @instagram, Como chegar).

### 7.9 Painel · Equipe
`[id]/team` · `member-row.tsx`, `InviteDialog`

- Cabeçalho: eyebrow "Acessos", "Equipe", "Administradores editam o restaurante. Caixa, atendente e garçom consultam o cardápio e os preços." + "Convidar" (`user-plus`).
- 4 cartões de papel (`auto-fit minmax(200px,1fr)`): nome, contagem 18/600, descrição, tag "Edita" (`goldSoft`) ou "Consulta" (`neutralSoft`).
- Tabela `minmax(0,2fr) 150px 92px 92px`: Pessoa (avatar 30 com iniciais, nome ou e-mail, e-mail secundário), Papel (select; desabilitado para você mesmo; bloqueia rebaixar o último administrador com o toast "A equipe precisa de ao menos um administrador."), Desde, "Remover" (hover `dangerSoft`, confirmação "A pessoa perde o acesso a este restaurante na hora…") ou "Você".
- **Convites pendentes**: linhas com tile `mail`, e-mail ou "Qualquer e-mail", validade, papel, badge Pendente e botão revogar.
- **Convidar**: o mesmo diálogo de convite de 7.2, com o campo "Papel" (select) a mais; descrição "Convide alguém para a equipe de {restaurante}."

### 7.10 Convite (`/convite/[token]`)
`invite/[token]/page.tsx`, `auth-shell.tsx`, `sign-up-form.tsx`, `sign-in-form.tsx`, `create-restaurant-step.tsx`, `accept-invite-button.tsx`

Página em `bg`, coluna centralizada de 400 px, a 28 px do topo. Lockup dourado de 84 px, h1 24/600, subtítulo 13.5 `text2`. Um cartão (`surface`, raio 16, padding 16) por estado:
- **Sem sessão**: segmentado "Criar conta" / "Já tenho conta" (28 px); campos Nome (só em criar), E-mail, Senha ("Mínimo de 8 caracteres"); CTA "Criar conta" / "Entrar".
- **Criar restaurante**: "Nome do restaurante" (`store`, máximo de 120) + "Endereço do seu cardápio" (`tavvi.app/` + slug gerado do nome até a pessoa editar; `check` verde se livre, `x` vermelho se ocupado; mensagem ao vivo "Vai aparecer aqui conforme você digitar o nome." / "Este endereço está livre." / "Este endereço já está em uso. Tente outro."). "Criar restaurante" desabilitado até o slug estar livre. Nota "O endereço não muda depois. O nome, sim." Depois leva a Primeiros passos, passo 2.
- **Equipe**: só o botão "Aceitar convite" (38 px).
- **Indisponível**: cartão neutro com `link-2-off` e "Convites vencidos, revogados ou já usados não podem ser abertos."

O seletor de estados no topo é **só do protótipo**.

---

## 8. Web mobile (menos de 768 px) — console e painel

Referência: telefone da direita em `Tavvi Mobile.dc.html`. Substitui `mobile-navigation.tsx` e `components/shell/mobile-dock.tsx` do web (o dock flutuante e o sheet de páginas saem).

- **Barra superior fixa**, 48 px, fundo `bar` + blur, borda inferior `.5px line2`: tile 28 (iniciais no restaurante, símbolo no console) + nome 15/600 + subtítulo 11.5 `text3` + `search` 19 (abre a paleta em tela cheia).
- **Tab bar inferior fixa**, 84 px com a safe area, fundo `bar` + blur, borda superior `.5px line2`. Ícone 24 (traço 1.7) + rótulo 10.5/500; ativo em `goldText`, inativo em `text3`.
  - Painel: Cardápio · Serviço · Equipe · Ajustes (Ajustes agrupa Identidade, Contato, Trocar de restaurante, Tema e Sair).
  - Console: Convites (badge dourado com pendentes) · Restaurantes · Conta.
- Conteúdo com padding de 16 px, Large Title de 28/700, listas agrupadas (`surface`, raio 14, divisórias de `.5px` recuadas), switches de 51×31, chips de 32 px com rolagem horizontal, alvos de pelo menos 44 px e campos de 16 px.
- Cartão dourado de publicação no topo do Cardápio (pílula de estado + "Publicar" branco + linha de mídia).
- Editar item vira **sheet** (raio 14 no topo, alça de 36×5, "Fechar" · "Editar item" · "Salvar" em `goldText`), com grupos: mídia (grade de 3), Nome/Preço, Visível/Disponível, Variações/Destaques.
- Drawers de detalhe viram telas empilhadas com "‹ Voltar" em `goldText`.

---

## 9. App mobile (Expo) — console

Referência: telefone da esquerda em `Tavvi Mobile.dc.html`. Seguir as HIG (Human Interface Guidelines) da Apple: navegação por abas, títulos grandes, listas agrupadas e sheets.

### 9.1 Estrutura
- `app/(app)/_layout.tsx`: trocar `Stack` + `AppShell`/`MobileDock` por **`Tabs`** nativas (expo-router), com três abas: Convites (`mail`, `tabBarBadge` = pendentes, badge `gold`/`#17150F`), Restaurantes (`store`) e Conta (`circle-user`). Cada aba tem sua pilha para os detalhes (`invitations/[id]`, `restaurants/[id]`).
- Tab bar: fundo `bar` com `BlurView` (intensidade ~80, `systemChromeMaterial`), borda superior de .5 `line2`, ativo `goldText`, inativo `text3`, rótulo 10.5/500. Remover `mobile-dock.tsx`, `notched-path.ts` e o CTA flutuante do dock.
- Cabeçalhos: `headerLargeTitle: true`, `headerTransparent` + blur, `headerTintColor: goldText`. Botão "+" (34 px, círculo `surface`, ícone `goldText`) em `headerRight` da aba Convites.
- Haptics: `selectionAsync` na troca de filtro e de aba, `notificationAsync(Success)` ao copiar o link e ao criar convite, `impactAsync(Light)` nos switches.

### 9.2 Login (`login-screen.tsx`, `login-hero.tsx`, `login-form.tsx`, `login-backdrop.tsx`, `biometric-button.tsx`)
Sempre escuro (`#0D0C0A`, status bar clara). Lockup de 80 px; símbolo de 340 px a 7% à direita. Pílula "Console" dourada, título "Administre a plataforma." (30/700), subtítulo 15 `#A6A094` "Convites e restaurantes, de onde você estiver." Embaixo, cartão `#1A1916` com raio 22 e padding 16: campos de 48 px (`#232120`, raio 13, ícone 17 `#7C766B`, texto 16), "Entrar no console" (50 px, `#D0AC6E`, texto `#15120C` 16/600) e "Entrar com Face ID" (`scan-face` dourado, 46 px, transparente; mostra "Reconhecendo…" enquanto roda). Rodapé com wordmark e ano. Tirar a fonte Inter de `loginTypeStyles`.

### 9.3 Convites (`invitations-screen.tsx`, `list-hero.tsx`, `filter-chips.tsx`, `search-field.tsx`, `list-row.tsx`)
Large Title "Convites". Cartão dourado (raio 20): "Aguardando resgate", número 30/700 + "de {n} convites" e botão tinta "Novo" (36 px). Busca de 38 px (`neutralSoft`, raio 11, texto 16). Chips de 32 px com contagem. Lista agrupada: tile de 34 px `mail`, e-mail 15/500, meta 13 `text3`, badge de 22 px e chevron; linhas de 62 px; divisória de .5 px recuada até o texto. Vazio: "Nada encontrado" / "Ajuste a busca ou o filtro para ver outros resultados." Puxar para atualizar como hoje.

### 9.4 Detalhe do convite (`invitation-detail-screen.tsx`, `detail-hero.tsx`, `revoke-dialog.tsx`)
Voltar "‹ Convites" (17, `goldText`), título "Convite". Cartão com raio 20: tile de 44 + badge, e-mail 21/700 + meta. Grupo **HISTÓRICO** com a linha do tempo. Ações em pílulas de 50 px: "Gerar novo link" (primário) e "Revogar convite" (`dangerSoft`); nos demais estados, "Gerar novo convite". A revogação usa `Alert.alert` nativo, com o botão destrutivo.

### 9.5 Novo convite (`create-invitation-sheet.tsx`)
Sheet de página (`presentation: 'formSheet'` ou modal com alça), fundo `grouped`. Barra: "Cancelar" (`goldText`) · "Novo convite" (17/600). Grupo com o campo de e-mail (50 px) + footnote; linha "Validade" com o valor e um stepper nativo (−|+, 46×32). CTA de 52 px "Gerar link". Estado criado: check em círculo de 52 px `okSoft`, "Convite criado", o link em mono num cartão, aviso em `warnSoft`, "Copiar link" (vira "Link copiado") e "Já copiei o link" (opacidade .4 até copiar). Bloquear o arraste para fechar enquanto o link não tiver sido copiado.

### 9.6 Restaurantes e detalhe (`restaurants-screen.tsx`, `restaurant-detail-screen.tsx`, `info-list.tsx`)
Lista agrupada: iniciais 36 em `goldSoft`, nome, "/slug · segmento", badge. No detalhe: cartão `hero` com as iniciais num tile tinta (texto `#D6B67C`) + pílula de situação, nome 24/700 e segmento. **LINK PÚBLICO** com "Copiar" (38 px, vira dourado com "Copiado"). **RESPONSÁVEIS** (avatar, nome, e-mail em `mailto:`, papel) ou "Nenhum responsável cadastrado." Grupo com Criado em / Atualizado em. Footnote "Consulta somente leitura".

### 9.7 Conta (hoje no menu do dock)
Cartão com avatar de 52 (gradiente `hero`), e-mail 17/600 e "Administrador da plataforma". **APARÊNCIA**: segmentado Sistema · Claro · Escuro (`theme-selector.tsx`). **SEGURANÇA**: "Entrar com Face ID" com switch. Grupo "Sair" (vermelho, centralizado).

### 9.8 Toast
Pílula de 40 px `#17150F` no topo (abaixo da Dynamic Island), `circle-check` dourado e texto 14/500.

---

## 10. Estado e dados

Nada de API, DAL ou server action novo. Mudanças de estado só no cliente:
- Sidebar: um store (`rail-store.ts`) com `collapsed: boolean` persistido em cookie/localStorage, lido no SSR como hoje para evitar o salto na carga.
- Tema: continua em `theme-provider.tsx` (Sistema/Claro/Escuro); passa a trocar só os tokens novos.
- Filtros e busca das listas: mantidos na URL como em `toolbar.tsx`.
- Modo de visualização do cardápio (`view`) e "Ordenar": estado local, como em `menu-workspace.tsx`.
- Mobile: aba ativa pelo expo-router; o badge da aba Convites vem da query de convites (`features/invitations/queries.ts`).

---

## 11. Plano de execução (PRs independentes)

1. **Tokens e fonte**: `app/base.css` (substituir o bloco de `.admin-territory, .tv-auth-scope, .workspace-territory` e o equivalente `.dark` por `tokens/web-tokens.css`; reduzir `--text-*` e `--radius-tv-*`; `--primary` = tinta/dourado), `lib/fonts.ts` (sai Jakarta do admin), `components/theme/platform-theme-tokens.tsx`. Mobile: `theme/tokens.ts` e `theme/typography.ts` (ver `tokens/mobile-tokens.ts`), `global.css` e o provider do gluestack. Sem mudar layout ainda.
2. **Sidebar única**: novo `components/shell/sidebar.tsx`; `console-shell.tsx` e `tavvi-shell.tsx` passam a usá-la; apagar `liquid-frame.tsx`, `use-liquid-pocket.ts`, `nav-tree-geometry.tsx`, `desktop-sidebar.tsx`, `rail.tsx`, `nav-tree.tsx` (ou reduzir a um item simples). Mais o popover de conta e a paleta.
3. **Primitivos**: `components/ui/button.tsx` (pílulas de 30/34/36), `input.tsx`/`input-group.tsx` (32/34), `tabs.tsx` (segmentado), `badge.tsx` + `tv-badge.tsx`, `switch.tsx` (dourado 30×18), `table.tsx`, `sheet.tsx` (drawer com raio 18 e margem de 10), `dialog.tsx`/`alert-dialog.tsx`, `dropdown-menu.tsx`, `toast.tsx`, `empty.tsx`, `page-header.tsx`.
4. **Console web**: `list-hero.tsx` → cartão dourado + estatísticas; `toolbar.tsx`; `invite-table.tsx`; `invite-detail.tsx` com a linha do tempo; `invite-sheet.tsx`; `restaurant-table.tsx`, `restaurant-detail.tsx`, `slug-form.tsx`, `status-form.tsx`; `platform.css`.
5. **Painel web**: `publish-bar.tsx`, `menu-workspace.tsx`, `category-section.tsx`, `item-row.tsx`, `menu-work-modes.tsx`, `item-edit-dialog.tsx` e o editor de mídia, `identity-form.tsx`, `profile-form.tsx`, `member-row.tsx` + página de equipe, `getting-started/page.tsx`, lista de restaurantes; `workspace.css`.
6. **Auth e convite**: `tavvi-auth-shell.tsx`, `auth-hero-copy.tsx`, `tavvi-sign-in-form.tsx`, `tavvi-field.tsx`, `auth-shell.tsx`, `sign-up-form.tsx`, `create-restaurant-step.tsx`; remover `notched-surface.tsx`; `auth.css`.
7. **Web mobile**: barra superior + tab bar no lugar de `mobile-navigation.tsx`/`mobile-dock.tsx`; sheets.
8. **App Expo**: `(app)/_layout.tsx` com Tabs; primitivos (`list-row`, `section-card`, `detail-hero`, `filter-chips`, `search-field`, `status-badge`, `primary-cta`, `secondary-cta`, `tonal-button`, `state-card`); telas de login, convites, detalhe, sheet, restaurantes e conta; apagar `mobile-dock.tsx`, `notched-path.ts` e `list-hero.tsx` antigo.
9. **Marca**: trocar os PNGs, o ícone do app, o splash e o favicon.

---

## 12. Critérios de aceite

- [ ] Nenhuma ocorrência de `#B2F52F`, `lime`, `--tv-lime*` ou `limeSoft` fora de `features/public-menu`.
- [ ] Plus Jakarta Sans e Inter não são carregados no admin, no painel nem no app.
- [ ] Sidebar de 232/60 px, sem animação de encaixe e sem flyout; ⌘B e ⌘K funcionam; o estado persiste entre recargas sem salto.
- [ ] Um único cartão dourado por tela.
- [ ] Contraste AA nos dois temas: texto dourado sempre com `goldText`, nunca `gold`.
- [ ] Nenhuma tela de login oferece cadastro; conta só nasce em `/convite/[token]`.
- [ ] O link de convite continua sendo mostrado uma vez só, com o bloqueio "Já copiei o link" e a confirmação de descarte.
- [ ] Web mobile e app com alvos de 44 pt ou mais e campos de 16 px.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Cardápio público e as prévias de Identidade/Contato continuam no tema do restaurante.
- [ ] Testes existentes passam; snapshots visuais atualizados.
