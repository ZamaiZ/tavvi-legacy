# Registro de etiquetas NFC de mesa

## Operação

Abra **Identificadores** no painel por Chrome em um Android com NFC ativo e conexão HTTPS. Em **Detalhes**, toque em **Ler etiqueta**, aproxime uma NTAG213, confira o número de série e o conteúdo encontrado, e escolha **Gravar link**. Depois da confirmação de gravação, toque em **Verificar etiqueta** e aproxime a mesma etiqueta novamente. O painel só registra o vínculo se o número de série e a URL lidos forem iguais aos esperados.

Se a etiqueta já contiver a URL correta, **Conferir e vincular** permite concluir o inventário sem regravá-la. A substituição de uma etiqueta não apaga a anterior. Apague ou descarte a anterior fisicamente; enquanto o identificador estiver ativo, qualquer cópia de sua URL continuará abrindo o cardápio.

Safari e Chrome no iPhone não são considerados gravadores Web NFC. Um iPhone compatível pode ler a etiqueta já programada e abrir sua URL. O número de série de uma NTAG213 comum oferece rastreabilidade operacional, não autenticação criptográfica nem prova de que a etiqueta está na mesa certa.

## Dados e implantação

`supabase/migrations/0003_menu_tag_nfc_registration.sql` acrescenta o vínculo e duas funções restritas ao administrador do restaurante. Aplicar essa migração incremental ao projeto Supabase identificado **antes** de disponibilizar a nova interface. A migração `0001_web_baseline.sql` é apenas para projeto novo e vazio; não a executar sobre dados existentes.

O registro de uma tentativa ocorre antes da gravação; a confirmação do vínculo e seu evento de auditoria ocorrem na mesma transação. Uma interrupção pode deixar apenas o evento de tentativa, que indica resultado desconhecido. O operador pode reler a etiqueta e concluir o vínculo em uma nova operação. O histórico visível no painel mostra os 30 eventos mais recentes; o log completo permanece na tabela de auditoria. Mudanças de mesa ou ativação de um identificador com etiqueta vinculada também são registradas.

O navegador relata a leitura e a gravação ao servidor. A aplicação não consegue provar remotamente que o chip é original ou que a etiqueta está fixada em uma mesa específica. A aceitação operacional requer uma conferência com uma NTAG213 real em Android e uma leitura da URL em iPhone antes do uso no restaurante.
