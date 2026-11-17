# Ajustes do IAgenda
- [x] Ampliar personalização de aparência em todo o app, preservando registros.
- [x] Refinar espaçamento, legibilidade e controles das quatro abas.
- [ ] Verificar preferências salvas, navegação e telas de celular/computador (verificação visual com login real pendente).
- [x] Adicionar entrar, criar conta, recuperação de senha e Sair, preservando URLs.
- [x] Criar perfil automático e tabelas privadas com políticas por usuário.
- [x] Migrar persistência mantendo useStore, atualização otimista e erros visíveis.
- [x] Oferecer importação antiga uma vez, validar backups e restringir exclusões ao usuário.

# Integração com WhatsApp
- [ ] Substituir conexão individual por assistente em número oficial compartilhado.
- [ ] Vincular telefone por código temporário; isolar usuários e evitar duplicações.
- [ ] Claude Haiku 4.5 integrado ao Lovable, esclarecimentos e confirmação pelo WhatsApp.
- [ ] Reformular WhatsApp: vínculo, número oficial, iniciar conversa, editar/excluir detectados.
- [ ] Manual completo e testes reais de dois usuários (dependem da Meta e credenciais).
- [x] Aba WhatsApp: escolher conversas verificadas e ver compromissos criados pela IA.
- [x] Receptor oficial de webhooks com caixa de entrada durável e recuperação.
- [x] IA real (Lovable AI) que cria compromissos com data e hora.
- [ ] Aplicar `docs/whatsapp-setup.sql` pelo Lovable (tabelas novas).
- [ ] Conectar o WhatsApp Business no Lovable e escolher este projeto em "Incoming messages".
