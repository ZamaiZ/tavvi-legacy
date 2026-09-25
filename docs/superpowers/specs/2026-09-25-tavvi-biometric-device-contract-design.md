# Contrato biométrico por dispositivo — desenho

Data: 2026-09-25

Status: desenho para revisão do usuário.

## 1. Objetivo

Após o primeiro login administrativo com e-mail e senha, permitir ativar Face ID ou biometria Android neste aparelho. Depois de sair do app, a pessoa pode autenticar localmente e abrir uma nova sessão sem digitar e-mail e senha. Cada instalação tem um contrato independente que o backend consegue revogar.

O escopo inclui a configuração para gerar APK Android via EAS e conectá-lo ao backend HTTPS.

## 2. Restrições e critérios de sucesso

- Preservar o login administrativo atual por e-mail e senha como primeiro acesso e recuperação.
- Nunca persistir a senha.
- Usar Expo SDK 57 e `expo-local-authentication`/`expo-secure-store`, já instalados.
- O backend Express continua confirmando `platform_admin` em todo login e renovação; biometria local não concede autorização administrativa.
- Cada instalação registra seu contrato próprio. O aparelho mantém um `deviceId` e sinalizador de cadastro não secretos, além de um segredo aleatório numa chave SecureStore com autenticação exigida. O backend guarda hash desse segredo e o refresh token Supabase cifrado server-side.
- O segredo do contrato é bearer, não uma chave não exportável de hardware. A autenticação do SecureStore protege o caminho normal de leitura, mas aparelho comprometido, cliente alterado ou segredo extraído podem contornar essa barreira.
- Logout limpa sessão de uso e cache; preserva o contrato biométrico e a sessão Supabase cifrada associada a ele. Desativar biometria revoga o contrato no backend e apaga a chave local.
- O APK usa origem HTTPS configurada no build. URL efêmera do ngrok precisa de hostname reservado ou recompilação quando mudar.
- Não executar `git`, testes, typecheck, build ou lint; não alegar que aparelho ou APK foram verificados.

## 3. Estado atual observado

- `expo-local-authentication` e `expo-secure-store` já estão instalados e incluídos como config plugins em `app.json`.
- `src/features/auth/biometric-button.tsx` detecta hardware, modalidade e biometria cadastrada, mas o botão apenas mostra explicação.
- `src/features/auth/auth-context.tsx` guarda uma `MobileSession`; `signOut()` limpa a sessão local e o backend revoga o refresh token Supabase.
- `src/lib/secure-store-adapter.ts` fragmenta valores grandes em várias chaves. O segredo biométrico deve usar uma única entrada dedicada: fragmentar exigiria autenticação por bloco.
- `tavvi-backend/` autentica e renova sessões Supabase, mas não registra dispositivos.
- Não existe `eas.json`; `app.json` não define `android.package` nem URL da API.
- `EXPO_PUBLIC_API_URL` é incorporada ao bundle. Uma URL ngrok temporária que mudar deixa o APK apontando para a URL antiga.
- A spec aprovada do redesign preparou a interface biométrica e deixou o desbloqueio real para uma etapa futura.

## 4. Abordagens avaliadas

### 4.1 Segredo bearer protegido pelo SecureStore — escolhida

Cada instalação cria um segredo aleatório de alta entropia. O app o grava numa entrada SecureStore com `requireAuthentication: true`; o backend armazena somente seu hash. O backend cifra o refresh token Supabase da instalação com AES-256-GCM e uma chave server-only. Após autenticação biométrica, o SecureStore libera o segredo; o app o apresenta ao endpoint de login do dispositivo. O backend confere estado/hash, decifra e renova a sessão Supabase, revalida usuário/admin, atualiza o refresh token cifrado e devolve `MobileSession`.

Isso preserva o provedor atual, não persiste senha nem refresh token no app depois do logout e dá revogação individual. Acrescenta uma chave de cifragem e sua operação no backend. O bearer ainda pode ser reproduzido se extraído de um aparelho comprometido.

### 4.2 Chave não exportável no hardware — não escolhida nesta etapa

O aparelho cria uma chave privada no Keystore/Keychain e assina desafio do backend após biometria. O vínculo é criptográfico, mas exige módulo nativo e protocolo de desafio/resposta multiplataforma. É a opção futura se o segredo bearer não for suficiente.

## 5. Arquitetura e fluxo

### Primeiro acesso com senha

1. O app faz o login atual por HTTPS; o Express confirma `platform_admin` e devolve `MobileSession`.
2. Em aparelho compatível, o app solicita biometria. O SDK 57 documenta `SecureStore.requireAuthentication`; no iOS, a criação inicial da entrada não exibe prompt, então `LocalAuthentication.authenticateAsync` confirma o cadastro antes de gravá-la. No Android, confirmar o prompt da operação protegida SecureStore para evitar pedir biometria em duplicidade.
3. O app reutiliza/cria um `deviceId` de instalação não secreto e gera segredo aleatório somente se ainda não há contrato local registrado. Grava o segredo numa chave única com `requireAuthentication: true` e mensagem de autenticação. Depois chama `POST /session/device-contract` com `deviceId`, segredo e refresh token, autenticada pela sessão corrente.
4. O backend renova o refresh token recebido no Supabase, confirma que o usuário resultante é o mesmo da sessão bearer e continua `platform_admin`, cifra o refresh token renovado e guarda ciphertext, nonce/tag, hash do token, hash do segredo e timestamps. Responde com a sessão atualizada e sem ecoar segredo/token; o app persiste a sessão antes de concluir o cadastro.
5. Falha, cancelamento ou indisponibilidade da biometria não bloqueia login por senha. O app informa que o atalho não foi ativado e permite tentar novamente após novo login com senha.

### Login por biometria

1. O botão só aparece habilitado quando o sinalizador local indica contrato ativo, `SecureStore.canUseBiometricAuthentication()` é verdadeiro, a plataforma é nativa e biometria está cadastrada. Ler o sinalizador não acessa o segredo nem abre prompt.
2. `SecureStore.getItemAsync` com `requireAuthentication: true` apresenta o prompt nativo e libera o segredo.
3. O app chama `POST /api/mobile/v1/session/device` com `deviceId` e segredo.
4. O backend localiza contrato ativo pelo hash, aplica rate limit, decifra refresh token, renova via Supabase, confirma que o usuário é o mesmo e segue `platform_admin`, persiste refresh cifrado atualizado e devolve `MobileSession`.
5. O app persiste a nova sessão antes de declarar autenticação. A chave de contrato não precisa rotacionar em cada login; revogação e re-registro controlam seu ciclo de vida.
6. Rede indisponível mantém o contrato para nova tentativa. Contrato inválido/revogado, chave SecureStore invalidada ou perda da função administrativa apagam a chave local e retornam ao login por senha.

### Sessão aberta, refresh e logout

- `POST /session/refresh` atualiza ciphertext e hash do token cifrado quando o refresh antigo corresponde a um contrato ativo. Assim, a sessão aberta mantém o login biométrico futuro funcional.
- `signOut()` limpa sessão, cache e estado autenticado, mas não revoga no Supabase o refresh token que o contrato precisa para o próximo login.
- Na tela de login, ação “Desativar biometria neste aparelho” lê o segredo via SecureStore, revoga o contrato no backend e só então apaga a chave local. Falha de rede mantém a chave e informa que a revogação não foi confirmada.
- Login por senha neste aparelho pode reativar o contrato. Não criar nesta etapa uma tela para listar outros dispositivos.

## 6. API, banco e criptografia

Adicionar ao grupo de autenticação:

- `POST /session/device`: `{ deviceId, deviceSecret }` → `MobileSession` após validação, refresh Supabase e confirmação de admin.
- `POST /session/device-contract`: sessão bearer válida mais `{ deviceId, deviceSecret, refreshToken }` → valida no Supabase que o refresh pertence ao mesmo `user.id`, atualiza a sessão, e cria/atualiza vínculo deste usuário/dispositivo.
- `DELETE /session/device-contract`: público com `{ deviceId, deviceSecret }`; revoga somente o vínculo correspondente. O segredo protegido é necessário para desvincular depois do logout.
- Refresh existente: sincroniza ciphertext/hash quando o refresh token for parte de um contrato ativo.
- Logout existente: passa a encerrar a sessão local do app sem revogar a credencial Supabase necessária ao contrato. A rota não autoriza ações administrativas sem access token válido.

Adicionar migration Supabase aditiva para tabela de contratos, índice único do usuário/instalação, estado, hashes, ciphertext/nonce/tag e timestamps. Sem acesso direto da tabela pelo app. RPCs devem limitar dados retornados, confirmar `auth.uid()` e admin em mutações autenticadas, aplicar rate limit no fluxo de login por dispositivo e nunca retornar hashes ou ciphertext para o cliente.

Adicionar variável server-only `DEVICE_CONTRACT_ENCRYPTION_KEY` com exatamente 32 bytes em encoding documentado. Cifrar com AES-256-GCM e nonce aleatório a cada gravação, guardar versão do envelope e autenticar o ciphertext. Nunca colocar essa chave no app, expor em endpoint ou registrar token/segredo/ciphertext em logs. Nesta primeira versão, rotação controlada invalida os ciphertexts antigos e exige login por senha/re-cadastro; documentar janela e procedimento de atualização. Sem chave válida, login biométrico falha fechado e login por senha continua disponível.

Manter envelopes `{ data }`/`{ error }`, `Cache-Control: no-store` e mensagens opacas. Credencial inválida/revogada recebe erro uniforme de autenticação; usuário sem papel administrativo recebe `403`.

## 7. Armazenamento e build

- Criar armazenamento biométrico separado de `sessionStore`: metadados (`deviceId`, sinalizador de cadastro) numa chave sem prompt e o segredo numa única chave com autenticação exigida. Ambos têm schemas próprios; metadados não autorizam chamadas de backend.
- A chave do segredo usa SecureStore assíncrono com `requireAuthentication: true` e `authenticationPrompt`. Verificar suporte com `canUseBiometricAuthentication()`. Não usar AsyncStorage nem fragmentação para esse segredo.
- A documentação oficial do SDK 57 confirma que mudança nas biometrias pode invalidar a entrada SecureStore protegida; nesse caso, limpar o contrato local e oferecer senha/re-cadastro. `requireAuthentication` para Face ID não é testável no Expo Go; precisa de build nativo e aparelho real.
- Preservar os config plugins atuais e a permissão Face ID. Web continua com senha.
- Criar `eas.json` com perfil `preview`/interno e `android.buildType: "apk"`; definir `android.package` estável e incluir configuração EAS/projeto se necessária.
- Injetar `EXPO_PUBLIC_API_URL` no ambiente de build. Para APK utilizável por mais tempo, usar hostname HTTPS reservado do ngrok ou domínio estável; endpoint público não é segredo.

## 8. Falhas, segurança e recuperação

- Sem hardware/biometria cadastrada, em web ou ao cancelar: senha continua funcional; botão informa indisponibilidade.
- Falha de rede no login biométrico não apaga contrato. Falha ao gravar sessão impede declarar login concluído.
- Contrato revogado, usuário removido de admin ou refresh inválido: apagar chave local e pedir senha.
- Falha ao persistir refresh cifrado após renovação: responder erro sem devolver nova sessão; exigir login por senha e re-registro se a sessão não puder ser recuperada.
- Falha ao revogar remotamente: não apagar chave local nem afirmar que o contrato foi revogado.
- O refresh token cifrado amplia o impacto de comprometimento do backend ou vazamento da chave server-only; rotação e acesso à chave precisam ser restritos e auditáveis.
- URL ngrok expirada/alterada exige hostname fixo ou novo APK com URL atualizada.
- Troca de biometria, limpeza do app ou invalidade do SecureStore pode apagar o acesso; senha permite reativar.

## 9. Fora de escopo e verificação

Fora de escopo: senha persistida/recuperada; bloqueio biométrico em todo retorno do background; gestão de outros dispositivos; proteção garantida contra root/jailbreak ou cliente comprometido; chave privada não exportável; publicar APK ou implantar backend.

Revisão de código deve cobrir cadastro, login após logout, cancelamento, falta de hardware, rede, refresh concorrente, atualização do ciphertext, chave de cifragem ausente/inválida, perda de admin, revogação, mudança biométrica, reinstalação e configuração APK/URL.

Não executar testes, lint, typecheck ou build conforme as instruções do projeto. A aceitação em aparelho real, após o usuário gerar/instalar o APK, deve verificar cadastro inicial, logout/login biométrico, fallback por senha, revogação e rede indisponível. Não declarar comportamento de hardware/build validado antes disso.
