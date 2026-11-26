# Ajustes do IAgenda
- [x] Implementar rotinas recorrentes, migração dos registros, checklist, sequências e gestão em Configurações.
- [x] Adicionar foto privada de perfil e ajustar quinas das barras de frequência.
- [x] Limpar código e dependências não usados, documentar configuração e renomear página para Telegram com redirecionamento.
- [x] Verificar criação, marcação, pausa, edição, exclusão preservando histórico, foto e backup com conta de teste; 44 testes passaram.
- [x] Comitar e solicitar publicação desta atualização em https://ia-genda.lovable.app.
- [ ] Remover fisicamente as quatro tabelas legadas: desativadas por comentário, preservadas pela política de alterações compatíveis.
- [x] Corrigir validação, carregamento, sincronização, backup, calendário, lembretes e estatísticas solicitados em 21/11.
- [x] Aplicar cor personalizada, temas e opções de aparência com persistência e compatibilidade de backups.
- [x] Verificar as correções e comitar esta atualização; publicação solicitada para ia-genda.lovable.app.
- [x] Ampliar personalização de aparência em todo o app, preservando registros.
- [x] Refinar espaçamento, legibilidade e controles das quatro abas.
- [x] Verificar preferências salvas, navegação e telas de celular/computador com login real.
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
