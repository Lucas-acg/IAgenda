# IAgenda

Agenda pessoal com compromissos, acontecimentos, hábitos recorrentes, calendário, estatísticas, relatórios e assistente Telegram. Os dados são privados por conta e salvos no Lovable Cloud.

## Stack

- React 19, TypeScript, TanStack Start v1 e TanStack Router.
- TanStack Query, Vite, Tailwind CSS v4 e componentes Radix/shadcn.
- PostgreSQL gerenciado pelo Lovable Cloud, autenticação e armazenamento privado de fotos.
- Claude Haiku 4.5 (`anthropic/claude-haiku-4-5`) pelo Lovable AI Gateway, no servidor.
- Telegram Bot API, Zod, date-fns, Vitest e Testing Library.

As versões exatas resolvidas ficam no `bun.lock`.

## Desenvolvimento

Instale Bun e uma versão atual do Node.js compatível com Vite.

```sh
bun install
# Apenas em uma cópia local sem .env: cp .env.example .env
bun run dev
```

Não substitua nem edite o `.env` gerenciado no projeto Lovable. Configure as variáveis locais pelos valores públicos da sua instalação. O aplicativo depende de autenticação, estrutura e funções já provisionadas no Lovable Cloud; somente copiar o código não cria esses recursos.

```sh
bun run test
bun run lint
bun run build
```

## Variáveis de ambiente

Veja `.env.example`. As variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` são configuração pública do cliente, gerenciada pelo Lovable Cloud. O nome técnico dessas variáveis é mantido para compatibilidade.

Somente servidor: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` e `LOVABLE_CRON_SECRET` (se usar o receptor agendado). Cadastre segredos em Settings → Secrets; nunca use prefixo `VITE_` em credenciais privadas nem inclua valores em commits. Credenciais administrativas são gerenciadas pela plataforma e não ficam disponíveis para copiar no Lovable Cloud.

## Arquitetura

- `src/routes/__root.tsx`: autenticação global, tema inicial, notificações e saída das rotas.
- `src/routes/_authenticated/`: páginas privadas. `/` é a agenda; `/telegram` é o assistente; `/whatsapp` redireciona para `/telegram`.
- `src/lib/store.tsx` + `cloud-store.ts`: estado otimista e salvamento transacional por `save_iagenda_data`, com fila serializada e rastreamento de revisões.
- `habit_routines`: definições de repetição. `habits`: registros diários vinculados por `routine_id` opcional; as sequências usam apenas os dias programados. Exclusão de rotina preserva registros anteriores.
- `src/lib/backup.ts`: validação de JSON e compatibilidade com backups anteriores sem rotinas.
- Fotos: bucket privado `profile-photos`, pasta por usuário, URLs assinadas temporárias. JPG/PNG/WebP, até 5 MB. O backup JSON guarda a referência, não os bytes da foto; em outra conta é preciso reenviar a foto.
- `src/lib/appearance.ts` e `src/styles.css`: tokens semânticos, contraste e temas.
- `src/lib/whatsapp/`: lógica de Telegram, extração de IA e caixa de entrada durável. Os nomes das tabelas `wa_*` e a API pública permanecem por compatibilidade.
- Webhook registrado: `POST /api/public/whatsapp/webhook`, protegido pelo cabeçalho `X-Telegram-Bot-Api-Secret-Token`. Apenas mensagens de texto privadas são aceitas. O worker `/api/public/whatsapp/worker` exige seu segredo de agendamento.
- `drizzle/migrations/`: alterações gerenciadas pelo Lovable; não editar o histórico ou os arquivos gerados.

O Telegram confirma a criação de compromissos. Lembretes de horário são locais, com o app aberto; não há envio proativo de lembretes pelo bot. O manifesto permite instalação PWA, mas não garante edição e sincronização offline.

## Publicação

Depois de sincronizar o repositório com o Lovable, utilize Publicar/Atualizar no editor. Alterar o código não atualiza automaticamente o endereço publicado.
