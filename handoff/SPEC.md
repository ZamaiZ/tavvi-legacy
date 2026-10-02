# Handoff v2: conta, perfil, configurações e notificações (console desktop)

**Referência visual:** `Conta e Notificacoes v2.dc.html`. Abra no navegador com o `support.js` na mesma pasta. Os quadros são interativos:

| Quadro | O que mostra |
|---|---|
| 2a | Restaurantes com o popover de conta e a central abertos (claro) |
| 2b | Página Perfil |
| 2c | Página Configurações |
| 2d | O mesmo que 2a, no escuro |
| 2e | Central vazia |
| 2f | Central carregando (skeleton) |

`Notificacoes Premium.dc.html` é o handoff v1, que já está no código: material translúcido, grupo "Neste aparelho", skeleton, agrupamento por dia. Esta spec trata só do que **muda** a partir do estado atual do repositório.

No protótipo, para ver cada coisa:
- **Popover de conta:** clique na conta no rodapé da sidebar.
- **Páginas:** Perfil e Configurações levam às páginas.
- **Tema:** trocá-lo, no popover ou em Configurações, repinta o quadro.
- **Notificações:** "Simular chegada (só protótipo)", ao lado do rótulo do quadro, simula a chegada pelo tempo real. As ações confirmam e saem, e "Marcar todas" dispensa em cascata.

---

## 0. Resumo das mudanças

1. **Popover de conta:** sai a edição de nome e sai "Sair de todos os aparelhos". Entram as linhas **Perfil** e **Configurações**. Tema e Notificações dividem um grupo.
2. **Nome somente leitura em todo lugar:** removem-se `AccountNameAction`, `updateDisplayNameAction` e `updateMyDisplayName`.
3. **Central sem o grupo "Neste aparelho":** o interruptor de push e a notificação de teste saem do `PanelList` e vão **só** para Configurações.
4. **"Sair de todos os aparelhos" só em Configurações**, nem no popover, nem no Perfil.
5. **Notificações em cartões, com até 2 ações** na barra de alerta nativa (borda inferior, divisória vertical).
6. **Animações de entrada e saída** dos itens, com `motion`, que já está no projeto (`motion@^13`, `LazyMotion` + `domAnimation`).
7. **Rotas novas:** `/perfil` e `/configuracoes`, nos territórios admin e painel.

Fora do escopo: o layout do celular (`AccountSheet`, `settings-mobile.tsx`, `NotificationCenterSheet`). A única mudança neles é tirar a edição de nome (§2).

---

## 1. Tokens (`app/base.css`)

Adicione nos dois temas, junto de `--tv-group`, `--tv-skel` etc.:

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--tv-fresh` | `rgba(179,139,77,.14)` | `rgba(208,172,110,.14)` | fundo do cartão que acabou de chegar |

Todo o resto já existe: `--tv-mat`, `--tv-group`, `--tv-line-2`, `--tv-active`, `--tv-hover`, `--tv-gold-text`, `--tv-danger`, `--tv-ease`, `--tv-dur-*`, `--tv-pop-lg`, `--tv-seg-on`, `--tv-mat-text-3`.

**Curvas** (já usadas no repo; não criar outras):
- `EASE_OUT = [0.2, 0.8, 0.2, 1]`, igual a `--tv-ease`.
- `EASE_IN = [0.4, 0, 1, 1]`, só para saídas.
- `EXPO_OUT = [0.16, 1, 0.3, 1]`, a do `Reveal`, para a entrada das páginas.

Sugestão: exportar essas curvas de `components/motion/easing.ts`.

---

## 2. Nome somente leitura

- `components/shell/account-popover.tsx`: remover o import e o uso de `AccountNameAction`, e também o `useState(shownName)`. O título passa a ser `name?.trim() || email || 'Conta'`.
- `features/platform/components/account/account-sheet.tsx` (l. 65) e `features/workspace/components/mobile/settings-mobile.tsx` (l. 67): remover `<AccountNameAction …/>`.
- Apagar `components/shell/account-name-action.tsx`, `server/actions/profile.ts`, a função `updateMyDisplayName` em `server/dal/profile.ts` e `updateDisplayNameSchema` em `domain/profile.ts`. Mantenha `displayNameSchema`, que o cadastro por convite usa em `server/dal/session.ts`.
- `console-shell.css`: apagar `.tv-account-name`, `.tv-account-name input`, `.tv-account-name-save` e as variantes delas (l. 129–139), e tirá-las do seletor de foco da l. 162.
- Opcional: deixar a policy `profiles_update_self` só para leitura, se nada mais escrever em `profiles`.

---

## 3. Popover de conta (`account-popover.tsx` + `console-shell.css`)

Material, posição e `tv-pop-in` continuam como estão. Ordem nova:

```
┌ cabeçalho (avatar 42 · nome · e-mail · papel)        sem mudança
├ grupo A
│   Perfil            [tile neutro: LuCircleUserRound]  ›
│   ── hairline .is-inset (45px)
│   Configurações     [tile neutro: LuSettings]         ›
│   ── hairline .is-inset
│   Instalar app      (PwaInstallAction, quando houver)
├ grupo B
│   Notificações      [tile ouro: LuBell]   (badge)     ›
│   ── hairline (12px)
│   Tema   [ Sistema | Claro | Escuro ]                 (.tv-account-theme)
└ Sair
```

- **Perfil e Configurações são `<Link>`** do `next/link`, com `className="tv-account-row"`, e chamam `onClick={onClose}`. Os `href` saem de `toExternalPath('/admin/profile')` e `toExternalPath('/admin/settings')`, ou das versões `/admin/workspace/*` no painel. O shell já sabe o território: passe `profileHref` e `settingsHref` como props do `AccountPopover`.
- Tile neutro: `.tv-account-tile.is-neutral`, que já existe.
- `.tv-account-row` precisa valer para `<a>`: acrescente `text-decoration: none;` e `color: var(--tv-text)`.
- Raio das linhas dentro do grupo: a primeira ganha `12px 12px 0 0`, a última `0 0 12px 12px`, a única `12px`. Assim o hover não vaza pelos cantos:
  ```css
  .tv-account-group > .tv-account-row:not(:only-child):first-child { border-radius: 12px 12px 0 0; }
  .tv-account-group > .tv-account-row:not(:only-child):last-child { border-radius: 0 0 12px 12px; }
  .tv-account-group > .tv-account-row:not(:first-child):not(:last-child) { border-radius: 0; }
  ```
- A linha Notificações abre a central como hoje (`aria-expanded`, `aria-controls="tv-notif-panel"`). A central continua montada **dentro** do popover, logo depois da linha (foco preso, Tab contínuo).
- `.tv-signout-button`: `height: 38px` → `36px`.
- **"Sair de todos os aparelhos" sai do popover.** Remova o botão, o estado `confirmAll`, o `useSignOutEverywhere`, o `PanelConfirm`, a classe `is-under-confirm`, o `inert` e a prop `signOutEverywhere` (e o repasse dela em `console-shell.tsx`, l. 198). O catcher volta a ser incondicional. A lógica passa para Configurações (§6).
- Rodapé da sidebar (`sidebar.tsx`, l. 221): o título passa a ser o **nome** (fallback e-mail), como no protótipo. Hoje mostra o e-mail. Ponto da conta (`.tv-sidebar-account-dot`) sem mudança.
- **Foco ao fechar pelo link:** `onClose` + navegação. Não devolva o foco ao botão da conta, porque a página nova recebe o foco pelo `template.tsx`.

---

## 4. Rotas

`lib/route-paths.ts`, em `externalFirstSegments`:
```ts
admin:  { …, perfil: 'profile', configuracoes: 'settings' },
painel: { …, perfil: 'profile', configuracoes: 'settings' },
```
Não conflita com `restaurantes/:id/ajustes`, que está no 3º segmento.

Arquivos novos:
- `app/admin/(platform)/profile/page.tsx` e `app/admin/(platform)/settings/page.tsx`, ambos com `requirePlatformAdminPage()`.
- `app/admin/workspace/profile/page.tsx` e `app/admin/workspace/settings/page.tsx`, com `requireUser()` (o mesmo guard da escolha de restaurante).
- `metadata`: `{ title: 'Perfil' }` e `{ title: 'Configurações' }`.
- Os dois territórios renderizam os mesmos componentes: `features/account/components/profile-page.tsx` e `settings-page.tsx`, com CSS em `features/account/styles/account.css`.
- Nenhum item novo na sidebar; o item ativo fica nenhum. Adicionar "Perfil" e "Configurações" na `command-palette.tsx`, com as palavras-chave `conta, senha, digital` e `tema, aparência, notificações`.

---

## 5. Página Perfil (2b)

Coluna `max-width: 680px`, alinhada à esquerda do conteúdo (mesmo padding do `main` das outras páginas). `gap: 28px` entre seções.

### 5.1 Anatomia
1. `PageHeader title="Perfil" description="Seus dados de acesso ao Tavvi."`.
2. **Identidade:** avatar de 64px (`--tv-hero-gradient`, tinta `--tv-hero-ink`, 24px/600, `inset 0 0 0 .5px rgba(0,0,0,.08)`), nome em 19px/650 com `-.015em`, e-mail em 13px `--tv-text-2`, e um chip do papel com `margin-top: 6px`, `padding: 3px 9px`, raio 999, `--tv-gold-soft`/`--tv-gold-text`, 11.5px/600.
3. **Informações** (lista agrupada só para leitura). Linhas de 46px, `padding: 0 16px`, rótulo em 13.5px `--tv-text` à esquerda e valor em 13.5px `--tv-text-2` à direita, hairline `.5px var(--tv-line-2)` entre linhas:
   - Nome: `profiles.display_name`, ou "—".
   - E-mail: `auth.users.email`.
   - Papel: no console, "Administrador da plataforma". No painel, uma linha por restaurante (`Foods Lara`, `Administrador`), usando o `roleLabel` de `console-config.ts`.
   - Membro desde: `auth.users.created_at`, formato `14 de março de 2026` (`Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })`).
   - Último acesso: `auth.users.last_sign_in_at`, com `relativeTime` / `fullDateTime` de `lib/relative-time` (`title` com a data completa).
   - Rodapé do grupo: "Nome e e-mail vêm do convite e não podem ser alterados por aqui." (12px, `--tv-text-3`, `padding: 0 16px`).
4. **Segurança:** uma linha "Senha", com tile neutro `LuKeyRound`, hint "Última alteração há …" (ou "Alterada agora") e CTA "Alterar" em `--tv-gold-text` 13px/500. A linha expande o formulário **dentro do mesmo cartão**:
   - Campos agrupados (`--tv-group`, raio 10, linhas de 40px, hairline com 12px de recuo): Senha atual, Nova senha, Confirmar nova senha.
   - Botões à direita: "Cancelar" (pílula de 30px, `--tv-neutral-soft`) e "Alterar senha" (pílula de 30px, `--tv-btn`/`--tv-btn-text`, 600).
   - Server action nova `changePasswordAction`: reautentica com `signInWithPassword` (e-mail + senha atual) e chama `auth.updateUser({ password })`. Aplica `enforceRateLimit('mutation', …)`.
   - Erros em linha, abaixo dos campos (12px, `--tv-danger`). Sucesso: o formulário fecha, o hint vira "Alterada agora" e um `toast` "Senha alterada" aparece.
   - Enquanto pendente: `aria-busy`, `SpinnerRing` e "Alterando…".
5. **Aparelhos com digital.** Uma linha por aparelho: tile `LuSmartphone`, nome, meta "iOS · usado hoje às 09:42", e o botão "Desligar" (pílula de 28px transparente, `--tv-danger`, hover `--tv-danger-soft`).
   - Rodapé: "Desligar pede e-mail e senha no próximo acesso por aquele aparelho."
   - Vazio: "Nenhum aparelho com digital ligada." (13px, `--tv-text-3`).
   - **Depende do backend:** um select dos contratos de aparelho do usuário (spec `2026-10-01-biometria-persistente`) e o revoke por `deviceId`. Os campos `platform`, `name` e `lastUsedAt` não existem no contrato atual. Se não der agora, **a seção não entra** (sem placeholder).

O Perfil **não** tem "Sair de todos os aparelhos"; isso fica só em Configurações.

### 5.2 Cartão (padrão das duas páginas)
```css
.tv-acc-section { display: flex; flex-direction: column; gap: 8px; }
.tv-acc-section > h2 { margin: 0; padding: 0 16px; color: var(--tv-text-2); font-size: 13px; font-weight: 600; }
.tv-acc-card { overflow: hidden; border-radius: 14px; background: var(--tv-surface); box-shadow: 0 0 0 .5px var(--tv-line); }
.tv-acc-row { min-height: 46px; padding: 0 16px; display: flex; align-items: center; gap: 12px; }
.tv-acc-row + .tv-acc-row { border-top: .5px solid var(--tv-line-2); }
.tv-acc-foot { padding: 0 16px; color: var(--tv-text-3); font-size: 12px; line-height: 1.45; }
```
Os KPIs de Restaurantes usam o mesmo cartão (`--tv-surface` + anel de `.5px`), então a página conversa com o resto do console.

---

## 6. Página Configurações (2c)

`PageHeader title="Configurações" description="Aparência, avisos e sessões."`.

1. **Aparência:** cartão com `padding: 16px` e grid `repeat(3, minmax(0,1fr))` com `gap: 14px`, um botão por tema.
   - Miniatura `aspect-ratio: 16/10`, raio 10, `overflow: hidden`, feita de `div`s (sem imagem): metade esquerda e metade direita, cada uma com uma "sidebar" de 28% e uma barra de 34%×8px em ouro. "Sistema" fica meio claro, meio escuro. Cores claras: fundo `#F5F3EE`, sidebar `#FAF9F6`, barra `#C9A266`. Escuras: `#0D0C0A`, `#171613`, `#B28A4C`.
   - Selecionado: `box-shadow: 0 0 0 2px var(--tv-gold), 0 0 0 5px var(--tv-gold-soft)`, rótulo em 600 `--tv-text`. Não selecionado: `0 0 0 .5px var(--tv-line-2)`, rótulo em 500 `--tv-text-2`. Transição `box-shadow 180ms var(--tv-ease)`.
   - Semântica: `role="radiogroup"` com `aria-label="Tema"`, e cada botão com `role="radio"` e `aria-checked`. Setas ← → movem a seleção.
   - Usa o mesmo estado do `ThemeSegment` (`account-panel.tsx`): o provider de tema e o frame `.tv-theme-switching` não mudam.
2. **Notificações** (é o **único** lugar do desktop com push e teste): cartão com `<PwaNotificationsAction variant="group" />` e o teste. Exporte o `TestButton` de `notification-list.tsx` (ou leve-o para `test-notification-button.tsx`). A anatomia é a de `.tv-notif-device`, mas com fundo `--tv-surface`, linhas de 56/46px e `padding-inline: 16px`. Use o modificador `.tv-notif-device.is-page`.
   - O teste usa `url: '/configuracoes'` (externa), para que tocar na notificação de teste traga a pessoa de volta.
   - As notas `needs-install` e `denied` do `PwaNotificationsAction` expandem dentro do cartão (`.tv-account-note`, com `padding: 0 16px 12px 56px`).
3. **Sessões:** cartão de uma linha, 46px, "Sair de todos os aparelhos" em `--tv-danger` 13.5px/500, com `LuMonitorSmartphone` numa coluna de 28px (alinhada aos tiles de cima) e hover `--tv-danger-soft`.
   - Rodapé: o `signOutEverywhereCopy.description` ("Isso encerra sua sessão em todos os aparelhos e desliga a digital em todos eles, inclusive neste.").
   - Abre o `PanelConfirm` com `signOutEverywhereCopy` (`destructive`, `pending` do `useSignOutEverywhere`), movido do popover sem mudança de lógica.
   - Território: hoje só o console tem essa ação (decisão de 2026-10-01). No painel, a seção Sessões não renderiza, a menos que o produto decida liberar.

Não há outras configurações por enquanto. A página não ganha seção vazia.

---

## 7. Notificações em cartões e com ações

### 7.0 Central sem "Neste aparelho"
Em `PanelList` (`notification-list.tsx`), remova o bloco `<div className="tv-notif-device">…</div>`. O `.tv-notif-scroll` começa direto no skeleton, no vazio ou nos grupos. Remova também de `notifications.css` as regras de `.tv-notif-device*`, `.tv-notif-hairline` e `.tv-notif-switch*` que só o painel usava, **depois** de levá-las para Configurações (`.tv-notif-device.is-page`). O `SheetList` do celular fica como está (fora do escopo).

### 7.1 Contrato
Em `packages/api-contracts/src/notifications.ts` e `domain/notification.ts`:
```ts
export type NotificationAction = {
  id: string                    // 'open' | 'approve' | 'decline' | …
  label: string                 // 'Ver feedback'
  doneLabel?: string            // 'Aberto', 'Aprovado'
  style?: 'default' | 'primary' | 'destructive'
  kind: 'navigate' | 'mutation' // navigate usa `url`; mutation chama o servidor
  url?: string
}
// em NotificationDTO / AppNotification:
actions?: NotificationAction[]  // no máximo 2: o cliente faz slice(0, 2)
```
**Fase 1 (sem banco):** as ações derivam do `kind` no cliente, num mapa `KIND_ACTIONS` ao lado de `KIND_ICONS`:
- `feedback_received` → `[{ id:'open', label:'Ver feedback', style:'primary', kind:'navigate' }]`
- `team_member_joined` → `[{ id:'open', label:'Ver equipe', style:'primary', kind:'navigate' }]`
- `restaurant_joined` → `[{ id:'open', label:'Abrir restaurante', style:'primary', kind:'navigate' }]`
- `test` → nenhuma

**Fase 2:** ações vindas do banco (coluna `actions jsonb`), para casos como pedido de acesso, com Recusar (`destructive`) e Aprovar (`primary`), validadas com zod em `notificationFromRow`.

Ordem: secundária ou destrutiva à esquerda, primária à direita (como no alerta do iOS).

### 7.2 Markup (`NotificationItem`, variante `panel`)
O `<li>` vira um cartão. Não há botão dentro de botão: o corpo é um `<button>` e a barra é irmã dele.
```tsx
<m.li layout={false} …(ver §8) className="tv-notif-entry">
  <article className={`tv-notif-card${fresh ? ' is-fresh' : ''}`} aria-labelledby={titleId}>
    <button type="button" className="tv-notif-item" onClick={() => onOpen(item)}>
      <span className="tv-notif-icon" aria-hidden="true"><Icon /></span>
      <span className="tv-notif-copy">
        <span className="tv-notif-line"><strong id={titleId}>{item.title}</strong>{time}</span>
        <span>{item.body}</span>
      </span>
    </button>
    {actions.length ? (
      <div className="tv-notif-actions" role="group" aria-label="Ações">
        {actions.map((a, k) => (
          <button key={a.id} type="button"
            className={`tv-notif-action is-${a.style ?? 'default'}`}
            data-state={doneId === a.id ? 'done' : doneId ? 'dim' : undefined}
            aria-disabled={Boolean(doneId) || undefined}
            onClick={(e) => { e.stopPropagation(); run(a) }}>
            {doneId === a.id ? <LuCheck aria-hidden="true" /> : null}
            {doneId === a.id ? (a.doneLabel ?? a.label) : a.label}
          </button>
        ))}
      </div>
    ) : null}
  </article>
</m.li>
```

### 7.3 CSS (`notifications.css`)
```css
/* Lista em cartões */
.is-panel .tv-notif-scroll { padding: 0 12px 12px; }
.is-panel .tv-notif-group-label { padding: 0 4px 6px; }
.is-panel .tv-notif-list { gap: 0; }            /* o espaço vem do cartão: ele colapsa junto */
.tv-notif-entry { list-style: none; }
.tv-notif-card { margin-bottom: 6px; overflow: hidden; border-radius: 12px; background: var(--tv-group); transition: background-color 900ms ease; }
.tv-notif-card.is-fresh { background: var(--tv-fresh); transition-duration: 0s; }
.is-panel .tv-notif-item { padding: 12px; border-radius: 0; }
@media (hover: hover) { .is-panel .tv-notif-item:hover { background: var(--tv-hover); } }
.is-panel .tv-notif-item:focus-visible { outline: 2px solid var(--tv-gold); outline-offset: -2px; }

/* Barra de ações: a do alerta nativo */
.tv-notif-actions { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); border-top: .5px solid var(--tv-line-2); }
.tv-notif-action { height: 40px; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 6px;
  border: 0; border-radius: 0; background: transparent; color: var(--tv-gold-text);
  font: inherit; font-size: 13.5px; font-weight: 450; letter-spacing: -.005em; white-space: nowrap; cursor: pointer;
  transition: var(--tv-transition); transition-duration: 160ms, 160ms, 160ms, 160ms, 160ms, 160ms, 220ms; }
.tv-notif-action + .tv-notif-action { border-left: .5px solid var(--tv-line-2); }
.tv-notif-action.is-primary { font-weight: 650; }
.tv-notif-action.is-destructive { color: var(--tv-danger); }
@media (hover: hover) { .tv-notif-action:hover:not([aria-disabled="true"]) { background: var(--tv-hover); } }
.tv-notif-action:active:not([aria-disabled="true"]) { background: var(--tv-active); transition-duration: 0s; }
.tv-notif-action[data-state="done"] { background: var(--tv-active); cursor: default; }
.tv-notif-action[data-state="dim"] { opacity: .35; cursor: default; }
.tv-notif-action svg { width: 13px; height: 13px; animation: tv-fade-up 220ms var(--tv-ease) both; }
.tv-notif-action:focus-visible { outline: 2px solid var(--tv-gold); outline-offset: -2px; }
.tv-notif-action[aria-busy="true"] { cursor: progress; }
.tv-notif-action .tv-spinner { width: 13px; height: 13px; }

/* Skeleton no formato de cartão (o primeiro com a barra de ações) */
.tv-notif-skeleton { gap: 6px; }
.tv-notif-skeleton-label { margin: 2px 4px 4px; }
.tv-notif-skeleton-row { padding: 0; flex-direction: column; gap: 0; overflow: hidden; border-radius: 12px; background: var(--tv-group); }
.tv-notif-skeleton-main { padding: 12px; display: flex; gap: 12px; }
.tv-notif-skeleton-bar { height: 38px; display: grid; grid-template-columns: 1fr 1fr; place-items: center; border-top: .5px solid var(--tv-line-2); }
.tv-notif-skeleton-bar .tv-skel { width: 56px; height: 9px; }

@keyframes tv-fade-up { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
```
O peso 450 é o da SF Pro variável; no Windows arredonda para 400.

### 7.4 Comportamento
- **Corpo:** `markAsRead(id)` + `router.push(item.url)` + `onNavigate`, como hoje.
- **Ação `navigate`:** fica em `done` (check + `doneLabel`) por 720ms, depois `markAsRead` + `router.push(a.url ?? item.url)` + `onNavigate`.
- **Ação `mutation`:** botão com `aria-busy` + `SpinnerRing` enquanto espera. Se der certo: `done` por 720ms, depois o item sai da lista (o servidor já marcou como lida; use um `dismiss(id)` novo no provider, que tira da lista e desconta 1 sem chamar o servidor de novo). Se der erro: volta ao normal + `toast` de erro, e o item fica.
- Com qualquer ação em `done`, os dois botões e o corpo travam (`aria-disabled`), para evitar clique duplo.
- O contador e o badge caem no **início** da saída (otimista), não no fim.

---

## 8. Animações (motion)

Use `motion/react-m` (`m.li`, `m.div`) dentro do `LazyMotion` que já existe (`components/providers/motion-provider.tsx`). `AnimatePresence` funciona com `domAnimation`; **não use `layout`**, que exige `domMax. A altura anima com `height: 'auto'`, que o `domAnimation` suporta.

### 8.1 Item: chegada (INSERT pelo tempo real)
```tsx
const enter = {
  initial: { opacity: 0, y: -10, scale: 0.97, height: 0 },
  animate: { opacity: 1, y: 0, scale: 1, height: 'auto',
    transition: {
      height:  { duration: 0.38, ease: EASE_OUT },
      opacity: { duration: 0.30, ease: 'easeOut', delay: 0.09 },
      y:       { duration: 0.46, ease: EASE_OUT, delay: 0.04 },
      scale:   { duration: 0.46, ease: EASE_OUT, delay: 0.04 },
    } },
}
```
- `style={{ overflow: 'hidden', transformOrigin: 'top center' }}` no `m.li`. O `margin-bottom` de 6px fica **dentro** do `li` (no `.tv-notif-card`), então colapsa junto.
- `<AnimatePresence initial={false}>` em volta do `.map()`: o que já estava na lista ao abrir a central **não** anima, só o que chega depois.
- **Destaque de chegada:** o item novo nasce com `is-fresh` (`--tv-fresh`, sem transição) e perde a classe 1.6s depois. Aí o fundo volta para `--tv-group` em 900ms. No provider, guarde os ids que chegaram pelo INSERT num `Set` com timeout de 1600ms e exponha `freshIds`.
- Quando a chegada cria o grupo "Hoje", o grupo inteiro entra com o mesmo `enter`, sem delay.

### 8.2 Item: saída (lida, ação ou "Marcar todas")
```tsx
exit: (i = 0) => ({
  opacity: 0, x: 18, scale: 0.98, height: 0,
  transition: {
    opacity: { duration: 0.18, ease: EASE_IN, delay: i * 0.06 },
    x:       { duration: 0.24, ease: EASE_IN, delay: i * 0.06 },
    scale:   { duration: 0.24, ease: EASE_IN, delay: i * 0.06 },
    height:  { duration: 0.30, ease: EASE_OUT, delay: 0.15 + i * 0.06 },
  },
})
```
A sequência é: o cartão desliza 18px para a direita enquanto some, e só então a altura fecha e a lista sobe. Os itens de baixo sobem sozinhos com o colapso, sem precisar de `layout`.

### 8.3 "Marcar todas como lidas" em cascata
- Passe a ação para otimista, como o `markAsRead`: `setItems([])` e `setUnreadCount(0)` na hora, e `refresh()` se o servidor recusar.
- Cada item recebe `custom={Math.min(index, 10)}` no `AnimatePresence` e no `m.li`, o que dá 60ms entre itens, com teto de 10 (mesma regra do `Stagger`).
- O botão "Marcar todas" some quando o contador chega a zero; o foco vai para o `h3`, como já faz.

### 8.4 Rótulo do grupo
O grupo (`.tv-notif-group`) também é `m.div` no `AnimatePresence` de grupos, com `exit` `{ opacity: 0, height: 0, marginBottom: -14 }`. A altura e a margem levam 300ms com delay de 160ms; a opacidade, 180ms. O `-14px` anula o `gap: 14px` do `.tv-notif-scroll`. Assim "Hoje" fecha junto com o último item, sem buraco.

### 8.5 Vazio
`.tv-notif-empty` entra com `tv-fade-up 420ms var(--tv-ease) both`. Ele só monta quando a lista zera **e** as saídas terminam: use `<AnimatePresence mode="popLayout" onExitComplete={() => setSettledEmpty(true)}>`, ou monte o vazio quando `items.length === 0 && !exiting`. Sem isso, o vazio aparece por baixo dos cartões que ainda estão saindo.

### 8.6 Ação confirmada
Ao clicar: `data-state="done"` no botão e `"dim"` no outro (opacidade .35 em 220ms), o check entra com `tv-fade-up 220ms`, espera 720ms e sai como no §8.2.

### 8.7 Central e popover
- `.tv-notif-panel`: acrescente `animation: tv-pop-in 200ms var(--tv-ease) backwards; transform-origin: left bottom;`. Hoje ela aparece seca.
- O popover continua com `tv-pop-in 150ms`.

### 8.8 Páginas Perfil e Configurações
- As seções entram com `<Stagger step={0.04}>` (`components/motion/reveal.tsx`), que já usa `EXPO_OUT` em 0.26s.
- **Formulário de senha:** `m.div` com `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: 'auto', opacity: 1 }}` (altura 0.32s `EASE_OUT`, opacidade 0.22s) e `exit` invertido, dentro de `AnimatePresence`. Ao abrir, o foco vai para "Senha atual"; ao cancelar, volta para a linha "Senha".
- **Desligar aparelho:** igual à saída do item (§8.2), sem cascata. Primeiro `x: 14` com `EASE_IN` (0.22s), depois a altura fecha (0.30s, delay 0.14s). Se for o último, o texto do vazio entra com `tv-fade-up 300ms`.
- **Cartões de tema:** só a transição de `box-shadow`, 180ms.

### 8.9 Movimento reduzido
- O CSS já está coberto pela regra global de `base.css` (l. 440).
- **No motion, não:** em cada componente, use `const reduced = useReducedMotion()` com esta tabela:

| | Normal | `reduced` |
|---|---|---|
| Entrada | §8.1 | `initial={false}`, aparece direto |
| Saída | §8.2 | `exit={{ opacity: 0, transition: { duration: 0.15 } }}`, sem `x`, `scale`, altura nem cascata |
| Destaque fresh | 1.6s + 900ms | mantém, porque é cor e não movimento |
| Espera da ação | 720ms | mantém, porque é feedback |

---

## 9. Acessibilidade
- A barra de ações é um `role="group"` com `aria-label="Ações"`. Cada botão anuncia o próprio rótulo. Ao confirmar, um `aria-live="polite"` com `sr-only` no cartão diz o `doneLabel` (ex.: "Aprovado").
- Quando o item com foco sai, o foco vai para o próximo cartão, para o anterior ou, se a lista ficou vazia, para o `h3` "Notificações".
- Contraste: `--tv-gold-text` sobre `--tv-group` dentro de `--tv-mat` passa de 4.5:1 nos dois temas. Confira de novo o `--tv-danger` no escuro (`#EE8C80`).
- Os rótulos das linhas de Perfil e Configurações no popover são os próprios textos; os chevrons ficam com `aria-hidden`.

---

## 10. Ícones (react-icons/lu)
Novos: `LuCircleUserRound`, `LuSettings`, `LuKeyRound`, `LuCheck`. Já em uso: `LuBell`, `LuChevronRight`, `LuLogOut`, `LuMonitorSmartphone`, `LuSmartphone`, `LuBellRing`, `LuCheckCheck`, `LuMessageSquareText`, `LuUserPlus`, `LuStore`.

## 11. Critérios de aceite
- [ ] 2a–2f batem com o protótipo nos temas claro e escuro.
- [ ] Nenhum lugar edita o nome; o código de escrita do nome foi removido.
- [ ] Popover sem "Sair de todos os aparelhos"; central sem push e sem teste. Os três ficam só em Configurações.
- [ ] Perfil e Configurações abrem pelo popover e pela paleta, nos dois territórios, e fecham o popover.
- [ ] Itens com 0, 1 e 2 ações. A barra fica colada na borda inferior, com divisória vertical, e a primária em negrito.
- [ ] Clicar no corpo marca como lida; clicar numa ação não dispara o corpo.
- [ ] Chegada pelo tempo real anima e destaca; a lista carregada ao abrir não anima.
- [ ] Saída sem salto de layout; "Marcar todas" em cascata; o rótulo do grupo fecha junto; o vazio entra só depois.
- [ ] Com `prefers-reduced-motion`, nenhum movimento além de fades de 150ms.
- [ ] O foco nunca cai no `<body>` quando um item sai.
