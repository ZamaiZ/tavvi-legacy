# Tavvi Mobile — console administrativo

Data: 2026-09-22

Status: desenho aprovado em conversa; aguardando revisão do documento antes do plano de implementação.

## 1. Objetivo

Criar a primeira versão funcional do aplicativo móvel Tavvi para administradores da plataforma. O aplicativo deve permitir:

- entrar com e-mail e senha;
- validar que a conta é administradora da plataforma;
- criar, listar e revogar convites de plataforma;
- listar os restaurantes já criados;
- restaurar e encerrar a sessão com segurança.

A interface deve portar fielmente para React Native a identidade privada do `nfc-menu`, com ênfase no dock móvel, nos tokens, na tipografia Inter, nos temas claro e escuro e na qualidade dos estados de interação.

O aplicativo é destinado a iOS e Android. O suporte web não é critério de aceite desta fase.

## 2. Escopo

### 2.1 Incluído

- Login exclusivo para administradores da plataforma.
- Sessão persistida e renovada no dispositivo.
- Verificação de autorização no login, na restauração da sessão e em toda chamada administrativa.
- Lista de convites de plataforma.
- Criação de convite com e-mail opcional e validade entre 1 e 30 dias.
- Exibição única do link recém-criado.
- Cópia do link para a área de transferência.
- Revogação de convite pendente, com confirmação curta.
- Lista somente leitura de restaurantes.
- Atualização por gesto nas duas listas.
- Estados de inicialização, carregamento, vazio, erro, sem conexão e sessão expirada.
- Temas Sistema, Claro e Escuro.
- Navegação móvel equivalente à do `nfc-menu`.

### 2.2 Fora do escopo

- Tela de detalhes do restaurante.
- Navegação ao tocar em um restaurante.
- Criação, edição, suspensão ou remoção de restaurante.
- Administração de cardápio, identidade, contato, equipe ou mídia.
- Convites de equipe.
- Cadastro de conta ou recuperação de senha.
- Resgate de convite.
- Notificações push.
- Persistência offline de dados administrativos.
- Fila offline de mutações.
- Dashboard, métricas ou atalhos sem ação real.
- Suporte web como superfície de produção.
- Alterações no código do `nfc-menu`.

## 3. Diagnóstico do estado atual

### 3.1 O aplicativo ainda é o starter do Expo

O `tavvi-mobile` usa Expo SDK 57, React Native 0.86, Expo Router, NativeWind 5 preview, Gluestack UI, Reanimated e Continuous Native Generation. Não há diretórios `ios/` ou `android/`.

As telas, ícones, splash animado e navegação atuais ainda pertencem ao starter. Não existe cliente Supabase, persistência segura de sessão, configuração de ambiente nem camada de acesso à API.

### 3.2 A falha do Metro vem de aliases contraditórios

O `tsconfig.json` procura `@/*` primeiro em `src/*`, enquanto o plugin `module-resolver` do Babel força `@` para a raiz do projeto. Assim, o Metro transforma `@/components/animated-icon` em um caminho para `components/animated-icon`, embora o arquivo real esteja em `src/components/animated-icon.tsx`.

Há ainda três convenções incompatíveis no starter:

- código da aplicação em `src/`;
- primitives geradas do Gluestack em `components/ui/`;
- assets em `assets/`.

A correção será estrutural e única:

- `@/*` aponta exclusivamente para `src/*`;
- `@ui/*` aponta para `components/ui/*`;
- `@assets/*` aponta para `assets/*`;
- o plugin `module-resolver` redundante sai do Babel;
- os imports atuais são normalizados, incluindo o CSS global;
- o Expo CLI passa a resolver os aliases pelo `tsconfig.json`, como documentado para o SDK usado.

Trocar somente o import que falhou é insuficiente, pois apenas exporia o próximo conflito.

### 3.3 O backend web não será a API móvel

O `nfc-menu` usa Supabase Auth com cookies host-only, Server Actions e DAL dependente do território derivado do host. Essa fronteira funciona para o Next.js, mas não é um contrato consumível por um aplicativo nativo.

Login, leitura e escrita não devem reutilizar o protocolo interno das Server Actions. Ele é um detalhe do Next.js, não uma API pública estável.

Criar convites diretamente no aplicativo também é rejeitado. Hoje o servidor:

- gera 256 bits aleatórios;
- devolve o token em claro somente uma vez;
- persiste apenas o hash SHA-256;
- autoriza a operação por papel;
- registra auditoria;
- constrói o link para o território correto.

Essa lógica continuará no servidor, mas em Expo Router API routes pertencentes ao `tavvi-mobile`, sem alterar o `nfc-menu`.

## 4. Abordagens avaliadas

### 4.1 Expo Router API routes no `tavvi-mobile` — escolhida

O próprio projeto móvel contém uma API JSON pequena, autenticada por Bearer token e versionada em `/api/mobile/v1`. As rotas são exportadas como servidor e implantadas no EAS Hosting. O aplicativo nativo e a API são artefatos separados do mesmo repositório.

Vantagens:

- mantém o produto móvel isolado do ciclo de evolução do `nfc-menu`;
- não reutiliza o protocolo interno das Server Actions;
- não expõe o schema do banco como contrato do aplicativo;
- mantém geração de tokens, hash, autorização e auditoria fora do binário;
- oferece erros e versionamento próprios para o cliente móvel;
- concentra app, contrato e backend móvel em um projeto.

Custos aceitos:

- a API precisa ser implantada separadamente do binário;
- EAS Hosting possui limites gratuitos e cobrança conforme o plano;
- parte da orquestração já existente no backend web será reimplementada no backend móvel;
- o runtime do EAS Hosting é Cloudflare Workers e não disponibiliza APIs nativas do Node.js.

### 4.2 Supabase direto com RPCs — não escolhida

Seria possível mover criação e revogação para funções SQL e usar o Supabase diretamente no app. Isso reduziria a quantidade de Route Handlers, mas transformaria o schema e as RPCs no contrato do produto, espalharia DTOs entre projetos e dificultaria a evolução das mensagens e versões da API.

### 4.3 API versionada no `nfc-menu` — não escolhida

Essa alternativa reutilizaria mais código do backend web, mas acoplaria o aplicativo a outro repositório e exigiria alterar a DAL baseada em cookies. A decisão aprovada é manter o backend móvel separado no projeto Expo.

## 5. Arquitetura do projeto Expo

```text
Repositório tavvi-mobile
  ├─ aplicativo React Native
  │    ├─ credenciais → API de sessão
  │    ├─ sessão Supabase → SecureStore
  │    └─ Bearer token → API móvel versionada
  │
  └─ Expo Router API routes
       ├─ contexto autenticado
       ├─ serviços de domínio
       ├─ validação e erros HTTP
       └─ Supabase com RLS e RPCs existentes
                 │
                 ├─ convites
                 ├─ restaurantes
                 ├─ autorização
                 ├─ rate limit
                 └─ auditoria

EAS Hosting
  └─ executa somente a API e o artefato web exportado

Binário iOS/Android
  └─ nunca contém os módulos server-only nem segredos do backend
```

O Supabase continua sendo a autoridade de dados, identidade, RLS, rate limit e auditoria. O cliente nativo não conhece tabelas, políticas ou RPCs internas; conhece somente o contrato `/api/mobile/v1`.

O `nfc-menu` não é importado, modificado nem necessário para implantar o backend móvel.

## 6. Fronteira cliente/servidor no Expo

A API cria um contexto autenticado explícito para cada requisição, com ao menos:

- cliente Supabase tipado;
- usuário validado;
- identificador do ator;
- papel de administrador da plataforma confirmado;
- IP confiável ou ausência explícita de IP.

O adaptador HTTP extrai `Authorization: Bearer <access-token>`, cria um cliente Supabase limitado pela sessão do usuário, revalida o usuário e confirma `platform_admin`. Operações de domínio recebem esse contexto e não leem headers diretamente.

O backend usa somente a anon key com a sessão do próprio usuário. Nenhuma service role key é necessária. RLS e as verificações explícitas precisam concordar para permitir a operação.

Módulos de API e domínio servidor ficam fora dos módulos importados pelas telas. O cliente usa tipos de contrato próprios e nunca importa implementação server-only.

## 7. API móvel

A API vive em `src/app/api/mobile/v1` com arquivos `+api.ts`. O `app.json` usa `web.output: "server"`, requisito para exportar as API routes. O app recebe a origem implantada por `EXPO_PUBLIC_API_URL` e nunca depende de URL relativa no binário nativo.

O destino oficial é EAS Hosting. As rotas executam no runtime Cloudflare Workers:

- `fetch`, `Request`, `Response` e Web Crypto estão disponíveis;
- `node:crypto`, `fs` e módulos nativos do Node.js não são usados;
- geração de token usa `crypto.getRandomValues`;
- hash SHA-256 usa `crypto.subtle.digest`;
- cada operação deve terminar dentro dos limites do runtime, sem conexão persistente.

Estrutura:

```text
src/app/api/mobile/v1/
  session+api.ts
  invites+api.ts
  invites/[id]/revoke+api.ts
  restaurants+api.ts
```

Variáveis do cliente nativo:

- `EXPO_PUBLIC_API_URL`;
- `EXPO_PUBLIC_SUPABASE_URL`;
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Variáveis somente das API routes:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- `PAINEL_PUBLIC_URL`.

A URL e a anon key do Supabase são valores publicáveis, mas recebem nomes distintos no servidor para impedir imports acidentais entre os dois ambientes. Nenhuma variável server-only possui prefixo `EXPO_PUBLIC_`.

Em produção, o IP de auditoria e rate limit vem somente do header confiável disponibilizado pelo runtime do EAS Hosting. Headers genéricos encaminhados pelo cliente não promovem um valor a IP confiável. Em desenvolvimento local, ausência de um header confiável resulta em `null` para auditoria e em um balde conservador compartilhado para rate limit.

Os tipos do banco usados pelas API routes ficam em um snapshot local gerado do schema Supabase. O cliente React Native não importa esse snapshot; recebe DTOs menores definidos pelo contrato móvel.

### 7.1 Endpoints

#### `POST /api/mobile/v1/session`

Entrada:

```json
{
  "email": "admin@exemplo.com",
  "password": "senha"
}
```

Responsabilidades:

- validar formato;
- aplicar rate limit de login por IP;
- autenticar no Supabase;
- confirmar `platform_admin` antes de devolver a sessão;
- usar uma única mensagem para credenciais incorretas;
- não persistir sessão em cookies.

Saída contém os campos mínimos necessários para o cliente estabelecer a sessão Supabase e identificar o e-mail do usuário. Uma conta válida sem papel administrativo recebe `403` e não é persistida pelo app.

#### `GET /api/mobile/v1/session`

Valida o access token recebido, revalida o usuário no Supabase e confirma novamente `platform_admin`.

#### `GET /api/mobile/v1/invites`

Devolve apenas convites de plataforma, ordenados do mais recente para o mais antigo, sem `token_hash` e sem informação interna do banco.

#### `POST /api/mobile/v1/invites`

Entrada:

```json
{
  "email": "cliente@exemplo.com",
  "expiresInDays": 7
}
```

`email` é opcional; `expiresInDays` aceita inteiros entre 1 e 30. O servidor gera o token, persiste somente o hash, registra auditoria e devolve o link uma única vez.

Essa mutação não recebe repetição automática do cliente. O botão permanece desativado enquanto a requisição está em andamento.

#### `POST /api/mobile/v1/invites/:id/revoke`

Revoga somente convites de plataforma. Revogar novamente um convite já revogado é idempotente. Convite resgatado ou vencido retorna conflito de estado. A operação registra auditoria.

#### `GET /api/mobile/v1/restaurants`

Devolve somente os campos necessários à lista:

```ts
type MobileRestaurant = {
  id: string
  name: string
  slug: string
  segment: string | null
  status: 'draft' | 'active' | 'suspended'
  deletedAt: string | null
}
```

Não existe endpoint de detalhe nesta versão.

### 7.2 Envelope

Sucesso:

```json
{
  "data": {}
}
```

Erro previsto:

```json
{
  "error": {
    "code": "INVITE_NOT_PENDING",
    "message": "Este convite não está mais pendente."
  }
}
```

### 7.3 Status HTTP

- `400` ou `422`: entrada inválida;
- `401`: sessão ausente, inválida ou expirada;
- `403`: usuário autenticado sem papel administrativo;
- `404`: recurso realmente inexistente;
- `409`: conflito de estado;
- `429`: limite de tentativas;
- `500`: falha inesperada com mensagem opaca.

Detalhes do Supabase, tabelas, constraints, stack traces e tokens nunca aparecem na resposta.

Todas as respostas administrativas usam `Cache-Control: no-store` e `Content-Type: application/json`.

### 7.4 Rate limit e auditoria

- Login: balde existente `auth:login`, por IP.
- Criação e revogação: balde `mutation`, combinando usuário e IP quando disponíveis.
- Listagens não recebem limitação agressiva; dependem de autenticação, autorização e controle normal de tráfego.
- Criação e revogação registram ator, ação, alvo e IP quando confiável.
- Access token e refresh token não entram em logs ou metadados.

## 8. Sessão no aplicativo

A sessão possui quatro estados explícitos:

```text
inicializando
autenticado
sem sessão
sem permissão
```

Fluxo inicial:

1. O root layout monta imediatamente o Expo Router.
2. O provider lê a sessão do SecureStore.
3. Se houver sessão, o cliente tenta renová-la quando necessário.
4. O app chama `GET /session` para revalidar usuário e papel.
5. Somente depois libera as rotas protegidas.

Fluxo de uma chamada administrativa:

1. O cliente envia o access token atual.
2. Em `401`, tenta renovar a sessão uma única vez.
3. Se a renovação funcionar, repete a requisição uma única vez.
4. Se falhar, limpa o SecureStore e volta ao login.
5. Em `403`, limpa a sessão e mostra que a conta não possui acesso ao console.

O armazenamento usa APIs assíncronas do SecureStore para não bloquear a thread JavaScript. A preferência de tema também pode usar o mesmo armazenamento nesta fase, pois é pequena e evita introduzir outra dependência apenas para uma chave.

## 9. Estrutura de rotas do aplicativo

```text
src/app/
  _layout.tsx
  (auth)/
    _layout.tsx
    entrar.tsx
  (app)/
    _layout.tsx
    index.tsx
    restaurantes.tsx
```

- O root layout monta providers e um `Slot` desde a primeira renderização.
- A decisão de autenticação fica no layout aninhado, nunca antes de montar o navigator.
- `(auth)` não monta o dock.
- `(app)` monta o shell protegido e o dock.
- `index.tsx` é Convites e funciona como destino inicial.
- `restaurantes.tsx` é somente leitura e não possui descendentes.

O aplicativo usa `Stack`/`Slot` do Expo Router, não `unstable-native-tabs`. O dock do Tavvi não é uma tab bar nativa convencional e precisa controlar sua própria geometria e seus overlays.

## 10. Dados e cache no aplicativo

TanStack Query gerencia dados remotos em memória:

- `session`;
- `invites`;
- `restaurants`.

Regras:

- listas são deduplicadas enquanto uma busca equivalente está em andamento;
- criação e revogação invalidam apenas `invites`;
- mutações não repetem automaticamente;
- revogação não é otimista: o cartão muda somente após confirmação do servidor;
- dados administrativos não são persistidos em disco;
- ao voltar do background, sessão e lista visível podem ser revalidadas sem bloquear instantaneamente o conteúdo em memória;
- pull-to-refresh sempre força nova leitura.

O link criado não entra no cache do TanStack Query. Ele existe somente no estado do painel aberto.

## 11. Sistema visual

### 11.1 Fonte

Inter 400, 500, 600 e 700 é incorporada ao binário pelo plugin do `expo-font`. Não há download de fonte durante a abertura.

- títulos principais: 600 ou 700;
- títulos de seção: 600;
- corpo e formulários: 15–16dp;
- metadados: 13–14dp;
- informação essencial nunca abaixo de 12dp;
- datas e números usam algarismos tabulares.

### 11.2 Tokens

Os valores OKLCH privados do `nfc-menu` são convertidos para valores sRGB estáveis, e não aproximados visualmente. Um módulo tipado é a fonte de verdade para NativeWind, Gluestack, StyleSheet e Reanimated.

Tokens semânticos mínimos:

- `background`, `foreground`;
- `surface1`, `surface2`, `surface3`;
- `primary`, `primaryForeground`;
- `muted`, `mutedForeground`;
- `accent`, `accentForeground`;
- `border`, `input`, `ring`, `destructive`;
- `statusDraft`, `statusActive`, `statusSuspended` e seus fundos;
- sombras claras e escuras;
- raios de 8, 10 e 16dp;
- ritmo espacial baseado em 4dp;
- curva principal equivalente a `cubic-bezier(0.16, 1, 0.3, 1)`.

O verde-azulado aparece em ação primária, foco, seleção e estados de destaque. Não será usado como decoração indiscriminada.

### 11.3 Tema

O app suporta Sistema, Claro e Escuro. A preferência persiste entre aberturas. Mudanças do sistema são observadas quando a preferência for Sistema.

A barra de status, o fundo nativo e os overlays acompanham o tema resolvido. O splash possui variações coerentes de claro e escuro na configuração nativa.

## 12. Dock móvel

O dock reproduz a referência de `nfc-menu/src/components/shell/mobile-navigation.tsx` com adaptação nativa.

Geometria:

- 12dp das laterais;
- 12dp da borda inferior, somados à safe area;
- 68dp de altura;
- três colunas iguais;
- botões Conta e Menu com 44×44dp e raio de 12dp;
- botão central com 58×58dp, raio de 18dp e deslocamento vertical de -14dp;
- raio externo de 16dp;
- borda discreta e sombra curta;
- blur quando suportado, com superfície opaca equivalente como fallback.

Comportamento:

- Conta abre popover acima do canto esquerdo;
- o centro retorna sempre a Convites;
- Menu abre painel inferior com Convites e Restaurantes;
- o painel inferior usa scrim e respeita safe areas;
- mudança de rota fecha qualquer painel;
- Android Back fecha primeiro o overlay aberto;
- em Restaurantes, o botão central fica neutro e Restaurantes fica ativo no menu;
- toques relevantes usam feedback háptico leve;
- reduced motion remove deslocamentos amplos e preserva apenas feedback instantâneo ou fade curto.

Conta mostra e-mail, tema e logout. Menu mostra somente destinos autorizados e reais.

## 13. Telas

### 13.1 Login

- fundo `surface1` com halo verde-azulado suave;
- monograma `TV` e nome `Tavvi`;
- título `Console da plataforma`;
- subtítulo curto sobre gerenciamento de restaurantes;
- cartão `surface2` com e-mail, senha e botão Entrar;
- alternância de tema no topo;
- erro de credenciais em alerta acessível dentro do cartão;
- KeyboardAvoidingView e rolagem suficiente para telas pequenas;
- botão mantém dimensões durante o estado pendente.

Não há cadastro, recuperação de senha ou login social nesta fase.

### 13.2 Convites

Cabeçalho:

- eyebrow `Plataforma`;
- título `Convites`;
- descrição curta;
- ação `Novo convite`.

Cada cartão mostra:

- e-mail ou `Qualquer e-mail`;
- situação derivada: Pendente, Resgatado, Revogado ou Vencido;
- data limite em formato `pt-BR`;
- ação Revogar apenas para convite pendente.

Criação abre painel inferior com:

- e-mail opcional;
- validade em dias, de 1 a 30, padrão 7;
- explicação de que o prazo é para aceitar, não duração do acesso;
- ação Gerar link.

Após sucesso, o mesmo painel mostra:

- título `Convite criado`;
- aviso de que o link não será exibido novamente;
- link selecionável visualmente;
- ação Copiar;
- ação `Já copiei o link`.

Se o usuário tentar fechar antes de copiar, uma confirmação explica que o link será perdido. O link não é persistido, logado ou colocado em cache.

Revogação usa confirmação curta e aparece apenas para Pendente.

### 13.3 Restaurantes

Cabeçalho:

- eyebrow `Plataforma`;
- título `Restaurantes`;
- descrição curta.

Cada cartão não interativo mostra:

- nome;
- `/<slug>`;
- segmento ou `Tipo não informado`;
- situação visual e textual.

Não há chevron, efeito de navegação, `onPress` nem destino de detalhe.

## 14. Estados da interface

Cada lista possui quatro representações próprias:

- skeleton com a geometria dos cartões finais;
- vazio com explicação e ação somente quando o usuário pode agir;
- conteúdo;
- erro recuperável com `Tentar novamente`.

Convites vazios oferecem `Novo convite`. Restaurantes vazios apenas explicam que aparecerão depois do resgate de um convite.

Sem conexão:

- a sessão local é preservada;
- o último conteúdo em memória pode continuar visível;
- a tela informa que não foi possível atualizar;
- nenhuma mutação é enfileirada silenciosamente.

## 15. Acessibilidade

Requisitos obrigatórios:

- alvos de toque de ao menos 44×44dp;
- rótulo acessível em todo botão somente com ícone;
- situação comunicada por texto, não apenas por cor;
- ordem de leitura equivalente à ordem visual;
- foco encaminhado para o primeiro controle relevante ao abrir um overlay;
- overlays marcados como modal para tecnologias assistivas;
- foco restaurado ao gatilho quando suportado;
- suporte ao botão Voltar do Android;
- contraste equivalente a WCAG AA para texto e controles;
- suporte a tamanhos de fonte ampliados sem cortar conteúdo essencial;
- conteúdo nunca encoberto pelo dock, teclado ou safe areas;
- reduced motion respeitado em dock, painéis, skeletons e transições.

## 16. Desempenho

- Listas usam `FlatList`, não `ScrollView` com todos os registros montados.
- Cartões usam chaves estáveis por id.
- Callbacks e componentes de linha evitam rerenders desnecessários onde a medição mostrar benefício.
- Tokens e estilos estáticos não são recriados a cada renderização.
- Nenhum asset remoto é necessário para login ou navegação.
- Fonte e ícones essenciais são locais.
- O app não bloqueia a abertura esperando convites ou restaurantes; bloqueia apenas até resolver a sessão.

## 17. Segurança

- Nenhuma service role key entra no aplicativo.
- Supabase URL e anon key são públicas por natureza, mas não concedem autorização sem sessão e RLS.
- Access e refresh tokens ficam no SecureStore e nunca em AsyncStorage, logs ou mensagens de erro.
- Toda rota administrativa valida token e papel no servidor.
- Esconder telas ou botões não é autorização.
- Token em claro de convite existe somente na resposta da criação e no estado efêmero do painel.
- O banco continua armazenando apenas o hash do convite.
- Senha não é persistida pelo app.
- A API não aceita identidade do usuário no corpo; deriva o ator do Bearer token.
- IDs recebidos continuam sujeitos a validação e autorização no servidor.
- Respostas inesperadas não revelam mensagens do Supabase.
- Arquivos `+api.ts` e módulos server-only nunca são importados por componentes React Native.
- Variáveis sem prefixo `EXPO_PUBLIC_` são consumidas somente nas API routes.
- O backend móvel usa Web Crypto; não existe fallback que gere token com `Math.random()`.
- A URL pública do painel usada nos links de convite vem de variável de ambiente do servidor.

## 18. Verificação permitida

As instruções do projeto proíbem `git`, `typecheck`, `build`, `lint` e `test`. Nenhum desses comandos será executado.

A verificação será feita por:

- inspeção estática dos arquivos alterados;
- inicialização normal do Expo em modo de desenvolvimento;
- execução local das API routes pelo servidor Expo;
- bundle de desenvolvimento servido pelo Metro para Android e iOS;
- observação de erros do Metro e do servidor;
- login válido e inválido;
- tentativa com usuário autenticado sem papel administrativo;
- restauração, renovação e expiração de sessão;
- criação, cópia e revogação de convite;
- bloqueio de toque duplicado durante criação;
- listas vazias, carregando, preenchidas e com erro;
- claro, escuro e sistema;
- dock em aparelhos com e sem recorte/safe area ampla;
- teclado aberto no login e na criação de convite;
- Android Back com popover e painel abertos;
- fonte ampliada e reduced motion;
- confirmação visual de que nenhum conteúdo fica atrás do dock.

Operações reais que criem ou revoguem convites exigem uma conta administrativa e um ambiente explicitamente escolhido para a verificação manual.

O `eas deploy` exporta o bundle web antes da publicação. Como `build` está proibido pelas instruções atuais, a implementação deixará EAS Hosting e variáveis documentados e configurados, mas não executará a implantação. Publicar exigirá uma autorização posterior que suspenda explicitamente essa proibição para o comando de deploy.

## 19. Critérios de aceite

O trabalho estará concluído quando:

- o Metro não apresentar mais conflitos de alias;
- o app abrir com identidade Tavvi, Inter e tema coerente;
- apenas administradores da plataforma conseguirem manter sessão;
- sessão válida sobreviver ao fechamento e reabertura do aplicativo;
- sessão expirada ou permissão removida encerre o acesso com mensagem segura;
- convites possam ser listados, criados, copiados e revogados;
- o link criado nunca reapareça depois de descartado;
- restaurantes apareçam em uma lista somente leitura, sem navegação de detalhe;
- dock, Conta e Menu reproduzam a geometria e os estados da referência;
- carregamento, vazio, erro e falta de conexão tenham estados próprios;
- claro, escuro, sistema, safe areas, teclado, fonte ampliada e reduced motion funcionem sem conteúdo cortado;
- a lógica sensível de convite, autorização e auditoria execute somente nas Expo Router API routes e no Supabase;
- nenhuma informação interna do banco ou token seja exposta em logs ou respostas de erro.
