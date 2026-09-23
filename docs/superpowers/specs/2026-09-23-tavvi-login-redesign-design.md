# Redesign do login Tavvi

Data: 2026-09-23

Status: especificação para revisão

## 1. Objetivo

Substituir a tela de login atual por uma experiência mobile-first alinhada à nova identidade Tavvi: premium, limpa, elegante e funcional em iOS e Android. O redesign preserva o login administrativo existente, os três modos de tema e os estados de erro, mas troca o monograma provisório pelos assets oficiais e introduz a base técnica para biometria sem simular uma autenticação que ainda não existe.

O resultado deve manter a hierarquia da referência fornecida:

1. hero de marca com recorte para o controle de tema;
2. formulário de acesso administrativo;
3. ação principal com glow contido e ação biométrica adjacente;
4. rodapé mínimo com wordmark e ano atual.

## 2. Escopo desta etapa

### Incluído

- Reformulação completa de `LoginScreen`.
- Uso do lockup horizontal, brandmark decorativo e wordmark oficiais.
- Nova paleta de marca baseada no verde-lima `#B2F52F` e nos neutros escuros da referência.
- Hero com recorte geométrico real no canto superior direito.
- Controle circular que percorre Sistema, Claro e Escuro e preserva a preferência existente.
- Formulário com e-mail, senha, exibição da senha, validação, loading e erros acessíveis.
- CTA “Entrar no console” com glow controlado e contraste alto.
- Componente visual de biometria/Face ID preparado para disponibilidade por plataforma.
- Detecção técnica de hardware, modalidade e cadastro biométrico com `expo-local-authentication`.
- Configuração CNG da permissão de Face ID no `app.json`.
- Layout adaptável a safe areas, teclado, telefones pequenos, telas grandes e escala de fonte.
- Rodapé `Tavvi · <ano atual>`.

### Fora do escopo

- Recuperação de senha. O texto “Esqueci a senha” não será exibido como controle ativo até existir um destino completo de recuperação; um link morto reduziria a qualidade e a acessibilidade da tela.
- Desbloqueio real de uma sessão por biometria. A sessão atual é restaurada automaticamente e não possui estado de app bloqueado. A biometria real exigirá uma etapa posterior com estado `locked`, opção explícita de ativação e fallback por senha.
- Armazenamento da senha para biometria. A senha nunca será salva.
- Migração visual das demais telas para a nova identidade.
- Alterações de backend ou do contrato de login.

## 3. Referências avaliadas

- Screenshot principal fornecido pelo usuário.
- Artifact do Claude informado pelo usuário; o acesso direto retornou HTTP 403, portanto ele não foi usado como fonte de comportamento.
- Código HTML em `C:\Users\Eduardo Zamai\Desktop\Redesign de login Tavvi\Login Tavvi.dc.html`.
- Assets em `C:\Users\Eduardo Zamai\Downloads\Branding Tavvi` e na pasta do redesign.
- Documentação oficial versionada do Expo SDK 57 para `expo-local-authentication` e gradientes.

O HTML é referência visual, não implementação reutilizável. Ele é fixo em 390 × 844, usa CSS/web e simula o recorte com blocos da cor do fundo. Esses pontos não serão transportados para React Native.

## 4. Abordagens avaliadas

### 4.1 Cobertura pintada sobre um card retangular

Reproduz o HTML com views da cor do fundo cobrindo o topo direito. É simples, mas falha quando o fundo possui halo, gradiente ou muda de tema; a emenda pode aparecer. Rejeitada.

### 4.2 Máscara adicional com dependência nativa

Usa uma biblioteca de masked view para recortar todo o hero. É fiel, mas adiciona dependência e complexidade para uma geometria que já pode ser desenhada com o pacote existente. Rejeitada.

### 4.3 Shape SVG real — escolhida

Usa `react-native-svg`, já instalado, para desenhar o fundo e a borda do hero como um único `Path` com a concavidade do recorte. Gradientes ficam em `Defs`; o conteúdo permanece em uma camada React Native sobre o shape. Não há preenchimento falso no canto, emenda de cor ou nova dependência apenas para o recorte.

## 5. Direção visual

### 5.1 Composição

- Conteúdo centralizado com largura máxima para não virar um painel largo em tablets.
- Fundo da tela com base quase preta no tema escuro e base clara quente no tema claro, ambos com halo verde muito discreto.
- Hero com 248–272 dp de altura conforme a largura disponível.
- Formulário abaixo do hero com separação de 12–16 dp, superfície própria e raio contínuo.
- Rodapé empurrado para o fim da área disponível, mas pertencente ao conteúdo rolável em telas baixas.

### 5.2 Hero

- Lockup horizontal no topo esquerdo, sem reconstrução textual do logo.
- Badge “Console · Acesso de administrador”.
- Título “Bem-vindo de volta.” com ponto verde.
- Descrição “Restaurantes, cardápios, mesas e pedidos em um só lugar.”
- Brandmark grande no canto inferior direito, com opacidade aproximada de 22–32%, parcialmente fora do quadro e sem competir com o título.
- Glow verde localizado atrás do brandmark, sem cobrir toda a tela.
- Controle de tema encaixado no recorte, com alvo mínimo de 48 dp, ícone coerente com Sistema/Claro/Escuro e feedback háptico já existente.

O hero mantém uma base escura de marca nos dois temas. A mudança de tema é percebida no fundo, formulário, inputs, textos secundários, bordas e status bar. Essa decisão preserva o lockup branco e evita criar versões de marca não fornecidas.

### 5.3 Formulário

- Cabeçalho “Entrar” e legenda “Credenciais de administrador”.
- Labels sempre visíveis; placeholder nunca substitui label.
- Input com ícone à esquerda, foco em verde e erro próximo ao campo.
- Campo de senha com controle de revelar/ocultar de no mínimo 44/48 dp.
- CTA verde-lima com texto quase preto, área escura para a seta e glow abaixo do botão. O glow não aumenta os limites de layout nem reduz a legibilidade.
- Botão biométrico quadrado, separado por 10–12 dp, com o mesmo raio do CTA e rótulo acessível específico à modalidade disponível.

### 5.4 Rodapé

- Wordmark oficial em baixa ênfase.
- Separador discreto.
- Ano derivado em runtime: `Tavvi · 2026` no ano atual, sem número de versão ou “Console privado”.

## 6. Sistema de cores e tipografia

Os valores da tela serão tokens, não hexadecimais espalhados pelos componentes. A base inicial vem da referência HTML:

- marca: `#B2F52F`;
- fundo de marca: `#0A0C09`;
- hero: `#121510`;
- campo escuro: `#181B15`;
- texto claro: `#F4F6F0`;
- texto secundário escuro: `#A9AEA3`.

A paleta clara terá equivalentes semânticos próprios e contraste medido; não será uma inversão automática. O foco verde sobre superfícies claras usará contorno escuro suficiente para permanecer perceptível.

Inter continua sendo a fonte da aplicação nesta etapa. O HTML usa Plus Jakarta Sans, mas introduzir uma segunda família somente no login criaria inconsistência. Uma eventual troca tipográfica global é outra decisão de identidade.

## 7. Assets

Os PNGs fornecidos possuem transparência e resolução suficiente, porém chegam a aproximadamente 1 MB por arquivo. As cópias de produção serão:

- preservadas na proporção original;
- recortadas apenas em transparência excedente, sem redesenho da marca;
- exportadas em dimensões compatíveis com densidades móveis;
- nomeadas por função em `assets/images/brand/`;
- renderizadas com `expo-image` e `contentFit="contain"`.

O asset fonte não será alterado. O app não carregará o lockup vertical nesta tela porque ele não é necessário à composição aprovada.

## 8. Arquitetura de componentes

```text
LoginScreen
├─ LoginBackdrop
├─ LoginHero
│  ├─ BrandShapeSvg
│  ├─ lockup horizontal
│  ├─ badge e textos
│  ├─ brandmark decorativo
│  └─ ThemeToggle
├─ LoginForm
│  ├─ alertas
│  ├─ LoginField de e-mail
│  ├─ LoginField de senha
│  ├─ AppButton primário
│  └─ BiometricButton
└─ LoginFooter
```

Esses componentes permanecem em `src/features/auth/` porque são privados da tela. Primitives globais só serão alterados quando a mudança beneficiar usos existentes; não haverá abstração global especulativa.

## 9. Fluxo de dados e estados

### Login por senha

O fluxo existente permanece:

1. validar o e-mail localmente;
2. bloquear submissão duplicada;
3. chamar `signIn` do contexto;
4. preservar os campos em falha;
5. mostrar erro seguro dentro do formulário;
6. redirecionar pelo layout quando o contexto se torna autenticado.

### Tema

O controle usa o ciclo existente `system → light → dark → system`, persiste no SecureStore e atualiza status bar e fundo nativo.

### Biometria nesta etapa

Ao montar a tela em plataforma nativa, um hook verifica:

1. presença de hardware biométrico;
2. biometria cadastrada;
3. modalidades suportadas;
4. plataforma atual.

O botão recebe o rótulo “Face ID”, “Touch ID” ou “Biometria” conforme o resultado. Nesta etapa ele não concede sessão. Quando disponível, explica que o primeiro acesso deve ser feito com senha para uma futura ativação; quando indisponível, permanece visualmente desabilitado e anuncia o motivo. O componente e a configuração ficam prontos para serem ligados ao futuro estado `locked`.

A implementação futura de desbloqueio não armazenará senha. Ela deverá proteger uma sessão válida e oferecer fallback por senha.

## 10. Responsividade, teclado e acessibilidade

- Respeitar safe areas superior e inferior.
- Usar `KeyboardAvoidingView` e conteúdo rolável; o CTA nunca fica inacessível sob o teclado.
- Validar em largura de 375 dp e em aparelhos maiores.
- Evitar altura fixa da tela e qualquer dependência de 390 × 844.
- Permitir escala de fonte; cabeçalhos e linha auxiliar podem quebrar ou reorganizar.
- Alvos de toque de no mínimo 44 pt no iOS e 48 dp no Android.
- Ícones decorativos ficam fora da árvore de acessibilidade.
- Controles apenas por ícone recebem nome e estado acessível.
- Foco, erro, disabled e loading não dependem apenas de cor.
- Reduced Motion remove rotações e escalas não essenciais; mantém feedback instantâneo.
- O brandmark decorativo usa opacidade baixa e não recebe descrição acessível.

## 11. Performance

- Um único SVG absoluto desenha o shape e os glows do hero.
- Nenhum blur animado.
- Nada depende de medição contínua; a geometria é recalculada apenas quando a largura muda.
- Assets raster são redimensionados antes de entrar no bundle.
- Animações ficam em propriedades compostas e têm duração curta.
- A tela não adiciona uma biblioteca de gradiente: os gradientes necessários usam `react-native-svg` já presente.

## 12. Impacto esperado em arquivos

- `src/features/auth/login-screen.tsx`: composição e estados da nova tela.
- `src/features/auth/login-theme.ts`: paletas semânticas privadas do login.
- `src/features/auth/login-backdrop.tsx`: halo de fundo e decoração não interativa.
- `src/features/auth/login-hero.tsx`: shape, marca e controle de tema.
- `src/features/auth/login-form.tsx`: estado, validação, feedback e submissão do formulário.
- `src/features/auth/login-field.tsx`: campo privado do login com label, ícone e revelação de senha.
- `src/features/auth/biometric-button.tsx`: disponibilidade e apresentação biométrica.
- `src/theme/tokens.ts`: espectro de marca e tokens semânticos necessários.
- `src/components/primitives/theme-toggle.tsx`: tamanho e estilo opcionais, preservando o default atual.
- `app.json`: plugin e texto de permissão do Face ID.
- `package.json` e lockfile: `expo-local-authentication` instalado pelo Expo.
- `assets/images/brand/`: assets oficiais preparados para runtime.

`auth-context.tsx`, `FormField` e `AppButton` não mudam nesta etapa. Os campos, CTA e glow especiais permanecem privados do login para não ampliar primitives globais por um único uso.

## 13. Verificação manual

Não serão executados git, build, lint, typecheck ou testes, conforme as regras do projeto. A verificação permitida será manual no servidor de desenvolvimento e cobrirá:

- tema Sistema, Claro e Escuro;
- telefone pequeno e telefone grande;
- teclado aberto nos dois campos;
- e-mail inválido, credencial inválida, loading e acesso negado;
- revelar/ocultar senha;
- escala de fonte e reduced motion;
- hardware biométrico ausente, não cadastrado e disponível;
- contraste e legibilidade do glow;
- ausência de emenda no recorte do hero.

Face ID não pode ser validado no Expo Go no iOS segundo a documentação do SDK 57. A validação real dessa modalidade exigirá development build em etapa autorizada; a limitação será informada na entrega.

## 14. Critérios de aceite

1. O hero possui recorte geométrico real e nenhuma view da cor do fundo cobre o canto.
2. Lockup, brandmark e wordmark oficiais mantêm proporção e área de respiro.
3. O brandmark de fundo não compete com o título.
4. O login administrativo continua funcional com os mesmos contratos e mensagens seguras.
5. Tema, status bar, teclado e safe areas funcionam sem saltos ou conteúdo inacessível.
6. O CTA tem glow perceptível, contido e sem comprometer contraste.
7. O botão biométrico representa corretamente disponibilidade e não finge criar sessão.
8. Nenhum controle habilitado possui ação vazia.
9. A tela se adapta a 375 dp e não depende das dimensões fixas do mockup.
10. Nenhum comando proibido é executado.
