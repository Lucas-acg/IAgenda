# Ajustes do IAgenda
- [x] Ampliar personalização de aparência em todo o app, preservando registros.
- [x] Refinar espaçamento, legibilidade e controles das quatro abas.
- [ ] Verificar preferências salvas, navegação e telas de celular/computador (verificação visual com login real pendente).
- [x] Adicionar entrar, criar conta, recuperação de senha e Sair, preservando URLs.
- [x] Criar perfil automático e tabelas privadas com políticas por usuário.
- [x] Migrar persistência mantendo useStore, atualização otimista e erros visíveis.
- [x] Oferecer importação antiga uma vez, validar backups e restringir exclusões ao usuário.

# Integração com WhatsApp
- [x] Substituir conexão individual por estrutura de assistente em número oficial compartilhado.
- [x] Vincular telefone por código temporário e proteger dados privados no servidor.
- [x] Claude Haiku 4.5 integrado: chamada real de extração verificada.
- [x] Reformular WhatsApp: vínculo, número oficial, iniciar conversa e detalhes reutilizando edição/exclusão.
- [x] Manual completo com uso, configuração, limites e roteiro de aceitação.
- [x] Aplicar armazenamento do assistente e proteção contra duplicação.
- [ ] Conectar número oficial e selecionar Incoming messages (conexão recusada; número não fornecido).
- [ ] Verificar vínculo, resposta, edição e isolamento real de dois usuários (faltam conexão Meta e sessões autorizadas).
- [ ] Recuperação durável sem tráfego e retomada administrativa (agendamento suportado não disponível nas ferramentas desta sessão).

# Troca para Telegram
- [x] Preservar banco e caminhos, aceitar apenas textos privados e substituir vínculo/envio/telas.
- [x] Testes do Telegram e proteção do webhook verificados (14 testes; grupos ignorados e ausência de segredo rejeitada).
- [ ] Verificar vínculo, criação e resposta real (aguarda login autorizado e registro do webhook; confirmação remota do bot excedeu o tempo limite).
- [x] Configurar TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME e TELEGRAM_WEBHOOK_SECRET pelo armazenamento seguro.
- [ ] Registrar webhook após publicação (usuário fará registro com segredo copiado do formulário).
