# SDD ledger — plan: docs/superpowers/plans/2026-09-23-tavvi-login-redesign.md

Setup: execução direta escolhida pelo usuário.

Ruling: não usar worktree, git ou scripts de execução baseados em git — `AGENTS.md` proíbe qualquer comando git — custo se errado: o trabalho permanece no workspace atual sem isolamento de branch.

Ruling: não usar TDD, testes, lint, typecheck ou build — `AGENTS.md` proíbe esses comandos e declara que não trabalharemos com testes — custo se errado: a verificação fica limitada a inspeção estática e exercício manual no Expo.

Pre-flight: Task 1 produz `brand` e assets consumidos por Tasks 3, 4 e 6 — nomes e caminhos consistentes.

Pre-flight: Task 2 produz `BiometricButton` consumido por Task 5 — prop estrutural `colors` aceita `LoginPalette` produzido na Task 3.

Pre-flight: Task 3 produz `LoginPalette`, `getLoginPalette` e `LoginBackdrop` consumidos por Tasks 4, 5 e 6 — assinaturas consistentes.

Pre-flight: Tasks 4 e 5 produzem `LoginHero` e `LoginForm` consumidos por Task 6 — props consistentes com `useAppTheme` e `useAuth`.

Task 1: Ruling: executar o FFmpeg fora da sandbox — o link WinGet apontava para um alvo sem permissão de leitura na sandbox — custo se errado: dependência operacional do FFmpeg instalado apenas para gerar os binários, sem impacto em runtime.

Task 1: complete (assets 900×900, 480×188 e 420×152 com alpha preservado; tokens de marca inspecionados por `rg`).

Task 2: Ruling: executar `npx expo install` fora da sandbox — o Node ativo é um symlink do NVM cujo alvo não é legível na sandbox — custo se errado: a instalação depende do runtime Node do usuário, mas o package e lockfile ficam registrados no projeto.

Task 2: complete (`expo-local-authentication` 57.0.3 instalado, config plugin adicionado e integração inspecionada sem `authenticateAsync` nem persistência de senha).

Task 3: complete (paletas privadas e backdrop SVG inspecionados; valores do login isolados das telas não relacionadas).

Task 5: Ruling: usar um ref síncrono além do estado visual de submissão — atualizações de estado podem ser agrupadas e não impedem dois eventos no mesmo frame — custo se errado: um ref privado adicional durante a vida do formulário.

Task 4: complete (hero com `Path` e `ClipPath` reais, brandmark recortado pelo mesmo shape e toggle dimensionável inspecionados estaticamente).

Task 5: complete (campos, autofill, alertas, CTA, biometria e guarda síncrona de submissão inspecionados; contraste do texto secundário claro corrigido para 4,65:1 sobre o campo).

Task 6: complete (composição responsiva montada; Metro iniciou e o bundle Android de desenvolvimento respondeu HTTP 200 com 9.389.890 bytes após a última alteração).

Final review: self-review estática; execução direta escolhida pelo usuário e uso de subagentes não autorizado. A revisão visual em dispositivo nativo, tamanhos extremos e estados reais de autenticação permanece como limitação de verificação, não como alegação concluída.
