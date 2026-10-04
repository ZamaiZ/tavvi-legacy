# Auditoria estática de `apps/web` — 03/10/2026

## Escopo, método e cobertura

Varredura recursiva de todos os caminhos de `apps/web`, inclusive ocultos, dependências e saídas geradas. O inventário por caminho está em [cobertura.csv](cobertura.csv). A classificação usa a função do caminho no projeto: `src`, configuração, scripts e documentação são próprios; `node_modules` é dependência; `.next`, `next-env.d.ts` e saídas equivalentes são geradas; imagens e ícone são mídia; `.env.local` é segredo local. Diretórios aparecem individualmente no CSV. O segredo foi registrado apenas por existência, sem leitura de valores.

| Classe | Caminhos | Tratamento |
| --- | ---: | --- |
| Código, configuração e documentação próprios | 519 | 405 arquivos lidos integralmente; 114 diretórios inspecionados por metadados |
| Artefato gerado | 7.519 | Metadados |
| Dependência instalada | 57 | Metadados; guias pertinentes do Next.js 16 consultados separadamente |
| Mídia ou binário | 59 | Tamanho, formato, dimensões e referências de uso |
| Segredo local | 1 | Existência e papel, sem conteúdo |
| **Total** | **8.155** | **Nenhum caminho sem estado** |

Após a leitura, um segundo `Get-ChildItem -Force -Recurse` encontrou **8.155 caminhos**. Comparação com o CSV: **zero faltantes e zero excedentes**. Os 44 arquivos de splash são referenciados dinamicamente por `src/lib/pwa.ts`; alguns logos têm variantes sem referência literal, o que por si só não prova desuso. O registro inclui bytes e estado por caminho.

Foram lidos integralmente rotas, componentes, estilos, hooks, utilitários, DAL, ações, configurações, scripts e documentação próprios. Consultei o baseline de Supabase apenas para validar RLS e auditoria; ele é contexto externo ao escopo contado. Consultei a documentação instalada do Next 16 para Server Actions e convenções relevantes. Não executei Git, typecheck, build, lint nem testes, conforme `AGENTS.md`. Nenhum código da aplicação foi alterado.

## Mapa da arquitetura

`src/proxy.ts` separa os hosts público, console da plataforma e painel, reescrevendo URLs externas para `src/app`. Os layouts e páginas de `app` orquestram dados e estados de navegação. `src/features` contém fluxos de cardápio público, editor, equipe, convites, feedback, chamados, notificações, identidade e telas móveis responsivas. `src/components` contém shell, controles, tema e PWA. `src/domain` concentra DTOs e validação; `src/lib`, utilitários e URLs; `src/server/actions`, a interface de mutações; `src/server/dal`, acesso ao Supabase e autorização; `src/server/security`, limites e trilha de auditoria. `supabase/migrations/0001_web_baseline.sql` define a defesa de RLS e funções transacionais. `public` contém marca, ícones, splash e service worker.

A separação entre três territórios, cookies e RLS está explícita. O acoplamento mais sensível está nas operações que cruzam UI, múltiplas Server Actions, banco e Storage: um sucesso parcial não pode ser revertido por uma atualização da tela. Os estilos grandes são divididos por superfície e breakpoint; seu tamanho, isoladamente, não foi tratado como defeito.

## Achados priorizados

### P1 — URL pública sempre usa HTTP

**Evidência:** `src/app/admin/workspace/restaurants/[id]/page.tsx:50` monta `http://${env.NEXT_PUBLIC_ROOT_DOMAIN}` sem olhar o ambiente. A URL é entregue ao cartão de publicação nas linhas 61 e 74, onde pode ser copiada ou aberta. `src/server/territory.ts:43-55` já fornece `defaultProtocol()` e `originFor()` com HTTPS para domínio não local.

**Consequência:** o link compartilhado sai com HTTP em produção. Redirecionamento ou HSTS podem mascarar a falha em alguns navegadores, mas não corrigem o link gerado. **Confiança: alta.**

**Correção:** construir a URL com `originFor('site', defaultProtocol())` em um único utilitário de links públicos; usar o mesmo contrato na página e nos convites. Arquivos: página, `server/territory.ts` e consumidores de `publicUrl`.

### P1 — Área privada admite restaurante ativo sem papel de membro

**Evidência:** `src/server/dal/restaurant-workspace.ts:17-28` só exige que `getRestaurantForMember` devolva restaurante; mantém `role: null`. A consulta em `src/server/dal/restaurant-read.ts:121-146` não filtra vínculo. A policy `restaurants_select_public` em `supabase/migrations/0001_web_baseline.sql:613-616` permite ler restaurantes ativos por `authenticated`, além de `anon`. `src/features/workspace/components/restaurant-shell.tsx:27-48` monta a casca e mostra “Membro” para papel nulo. Já `src/server/dal/menu-read.ts:192` exige membro para carregar o cardápio.

**Consequência:** uma pessoa autenticada sem vínculo pode obter nome, identidade e casca de um restaurante ativo pelo ID; a página de cardápio falha depois na DAL. A resposta da área privada é incoerente e o comentário de `page.tsx:41-43` sobre 404 sem confirmação de existência deixa de ser verdadeiro nesse caminho. As mutações continuam barradas pelos guardas e pela RLS. **Confiança: alta para a lacuna; exposição exata da resposta depende da composição de erro do Next.**

**Correção:** exigir papel de membro no agregador antes de devolver `RestaurantWorkspace`; decidir explicitamente se administrador da plataforma sem membership pode entrar e como seu papel aparece. Evitar depender da policy pública para autorização do painel. Arquivos: DAL de workspace/leitura, shell e páginas dependentes.

### P1 — Reordenação e mudança de categoria não são atômicas

**Evidência:** `src/server/dal/menu-write.ts:135-148,202-212` grava posições uma a uma. `src/features/menu-editor/lib/menu-order.ts:40-46` primeiro muda a categoria do item e depois reordena origem e destino em chamadas distintas.

**Consequência:** erro, fechamento da aba ou concorrência entre administradores pode deixar posições parcialmente atualizadas; mover um item pode terminar entre a troca de categoria e a renumeração. O filtro por `restaurant_id` impede escrita alheia, mas não garante que o conjunto de IDs enviado é completo e sem duplicatas. **Confiança: alta.**

**Correção:** uma RPC transacional para reordenar e mover, que valide pertencimento, conjunto e posições antes de gravar; manter a UI como cliente de uma ação única. Arquivos: schema SQL, DAL, ação de menu e `menu-order.ts`.

### P2 — Exclusão de feedback remove arquivos antes do registro

**Evidência:** `src/server/dal/feedback.ts:177-191` remove fotos do Storage e só depois chama `delete_feedback`. A limpeza de rascunhos repete a ordem em `:224-237`.

**Consequência:** se a RPC ou o delete falhar após o Storage aceitar a remoção, o feedback permanece no banco com caminhos de fotos inexistentes. A ordem foi escolhida para evitar arquivos órfãos, mas desloca a inconsistência para o registro visível. **Confiança: alta para a janela de falha.**

**Correção:** marcar exclusão no banco e retirar da leitura em transação; executar limpeza de arquivos de forma idempotente com fila/reconciliação. Definir política de retenção e recuperação para fotos antes de migrar. Arquivos: DAL de feedback, SQL e rotina de limpeza.

### P2 — Limite por IP depende de cabeçalhos que podem ser falsificados

**Evidência:** `src/server/security/client-ip.ts:14-15` usa o primeiro valor de `x-forwarded-for`, depois `x-real-ip`; `rateLimitIdentity()` em `:27-29` o usa como chave. O próprio comentário em `:7-9` reconhece a condição de proxy confiável. A regex de IPv4 em `:4` aceita octetos fora de 0–255, de modo que não valida um endereço `inet` por completo.

**Consequência:** se a borda de produção repassar cabeçalhos enviados pelo cliente, o visitante pode variar a chave e contornar limites; um IP sintaticamente aceito mas inválido pode fazer a RPC de auditoria falhar. Não há evidência nesta auditoria sobre a configuração da borda. **Confiança: alta no mecanismo, condicionada ao proxy implantado.**

**Correção:** definir o cabeçalho confiável por plataforma e aceitar valores apenas da borda; validar IP com parser apropriado. Arquivos: `client-ip.ts`, configuração de hospedagem e documentação de publicação.

### P2 — Falhas da trilha de auditoria são descartadas

**Evidência:** `src/server/security/audit.ts:20-31` aguarda `supabase.rpc('record_audit', ...)` sem examinar `{ error }`. A função SQL em `supabase/migrations/0001_web_baseline.sql:533-553` insere na tabela `audit_log`; há chamadas adicionais dentro de funções SQL de domínios específicos, mas não um gatilho geral que substitua todos os eventos invocados pela aplicação.

**Consequência:** ações podem ser apresentadas como concluídas sem o evento de auditoria correspondente. A RPC de auditoria separada não forma transação com a mutação anterior. **Confiança: alta para o descarte de erro; extensão do histórico ausente depende dos eventos.**

**Correção:** verificar `{ error }`, registrar falha operacional com contexto sem dados sensíveis e decidir quais eventos obrigatórios precisam ser gravados na mesma função SQL da mutação. Arquivos: `security/audit.ts`, DAL chamadoras e SQL dos eventos obrigatórios.

### P2 — Links de convite caem em HTTP sem `x-forwarded-proto`

**Evidência:** `src/server/dal/invites.ts:112-118,239-243` escolhe HTTP para qualquer valor diferente de `https`, inclusive ausência do cabeçalho. `src/server/territory.ts:43-47` tem fallback por domínio.

**Consequência:** configuração de proxy que omita o cabeçalho emite links inseguros ou sujeitos a redirecionamento. Não foi verificada a configuração de implantação. **Confiança: alta para o fallback; impacto condicionado à borda.**

**Correção:** centralizar construção de origem e usar `defaultProtocol()` como fallback; aceitar `x-forwarded-proto` somente da borda confiável. Arquivos: DAL de convites e `server/territory.ts`.

### P2 — Salvamento da identidade admite sucesso parcial

**Evidência:** `src/features/workspace/components/identity-form.tsx:177-205` grava logo e capa individualmente, atualiza estado salvo a cada uma e só então chama `updateIdentityAction` para segmento e tema.

**Consequência:** uma falha no segundo arquivo ou no tema deixa parte da identidade persistida, embora o usuário tenha iniciado um único “Salvar”. A tela preserva o estado parcial, mas não oferece um contrato de operação única nem reconciliação com Storage. **Confiança: alta.**

**Correção:** explicitar salvamento por etapa na UI ou criar um fluxo de commit com estado de operação e compensação/reconciliação; manter separada a transação SQL da limpeza de objetos no Storage. Arquivos: formulário, ação de restaurante e módulo de imagem da marca.

### P3 — CSP de produção ainda permite scripts inline

**Evidência:** `next.config.ts:16-18` define `script-src 'self' 'unsafe-inline'` em produção. **Consequência:** reduz a proteção da CSP se surgir uma injeção HTML; não há XSS demonstrado por esta inspeção. **Confiança: alta para a configuração, sem exploração comprovada.** Migrar para nonce ou hash requer verificar scripts do framework, tema e PWA. Arquivos: `next.config.ts`, proxy/layouts e eventuais scripts inline.

### P3 — Documentação de entrada não descreve o produto

**Evidência:** `README.md:1-35` ainda é o texto padrão do `create-next-app`; `README-fase0.md` tem instruções de fase e publicação mais específicas. **Consequência:** uma pessoa nova pode executar passos que não correspondem aos três hosts, ao baseline do banco e ao backend de Web Push. **Confiança: alta.** Consolidar no README principal um índice curto, com pré-requisitos, territórios, setup seguro do banco e links para a documentação viva.

## Plano incremental

1. **Correções objetivas:** centralizar origem/HTTPS; fechar `getRestaurantWorkspace` com papel explícito; corrigir a verificação de erro de auditoria; documentar contrato do proxy de IP. Essas mudanças não exigem reorganizar a árvore de componentes.
2. **Integridade do cardápio:** criar RPC para reordenação/movimento, validando o conjunto e usando a transação do Postgres. Substituir as três ações da UI por uma chamada. Depende do contrato de posições no SQL e de revisão dos consumidores desktop e móvel.
3. **Integridade de mídia e feedback:** definir estados de exclusão/salvamento, reconciliação e política de retenção. Migrar a DAL e os fluxos de UI em etapas, para que operações antigas pendentes possam ser retomadas. Storage e banco não compartilham transação.
4. **Higiene de interface e documentação:** após estabilizar os contratos, consolidar origem de links, README e regras CSP. Avaliar custo de hidratar simultaneamente as árvores desktop e móvel de `page.tsx:52-82` com medição real antes de separar carregamento; CSS oculta uma árvore visualmente, mas ambas são renderizadas.

**Decisões que precisam de produto/arquitetura:** acesso de administrador da plataforma sem membership ao painel; promessa de atomicidade do botão “Salvar identidade”; retenção ou remoção definitiva de fotos de feedback; exigência de auditoria transacional para cada evento; plataforma de hospedagem e seu cabeçalho de IP confiável. O plano acima mantém essas decisões explícitas, em vez de escondê-las em refatorações de tamanho de arquivo.

## Áreas sem achado relevante e limites

Na inspeção estática, não surgiu achado adicional material em `src/domain`, tema compartilhado, PWA, páginas públicas de menu, componentes de 404, componentes básicos de UI, perfil/conta e separação de cookies por território. O caminho externo `/restaurantes/...` é intencional e reescrito por `src/proxy.ts:73-87`; não é uma rota faltante. A prop `retry` de `error.tsx` é documentada pelo Next instalado e não foi reportada como erro.

Mídias e dependências não tiveram análise de qualidade de implementação; foram inventariadas por metadados. O guia instalado de CSP do Next não pôde ser aberto por permissão do sistema de arquivos; o achado de CSP se apoia no cabeçalho configurado e no efeito conhecido de `unsafe-inline`. `.env.local` não foi aberto. Sem execução do app, banco, navegador, build ou testes, não é possível afirmar exploração, comportamento de concorrência real, contraste visual em todos os dispositivos, custo de hidratação ou configuração efetiva do proxy de produção. Os achados acima distinguem evidência de código, consequência possível e dependência de ambiente.
