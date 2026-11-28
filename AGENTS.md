<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## App presentation
- Keep appearance defaults and validation in `src/lib/appearance.ts`; merge them into existing preferences on load and backup restore to preserve older records.
- Apply appearance preferences through document data attributes and global semantic tokens so dialogs, charts, navigation, and pages share the same presentation.
- Normalize legacy colors in the appearance module and apply its shared pre-paint/live theme logic; this prevents flashes and keeps old backups compatible.
- Serialize cloud saves with revision tracking and accept cloud baselines only with accepted reads; this preserves edits made during requests and safely flushes before sign-out.
- Keep date-grid and elapsed-time rules in small pure helpers shared with regression tests; this avoids divergent calendar and report calculations.

## Data and integrations
- `StoreProvider` lives only inside the `_authenticated` layout and syncs to the cloud through `src/lib/cloud-store.ts`; the root route only mounts `AuthProvider`, so public pages never load user data.
- Telegram: the secret-header-verified receiver is `POST /api/public/whatsapp/webhook`; every delivery is stored in `whatsapp_webhook_events` before processing, and AI-created appointments use the deterministic id `wa-tg-<chat id>-<message id>` so retries never duplicate them.
- Keep AI extraction rules (what counts as an appointment) in `src/lib/whatsapp/extract.ts` with tests in `src/test/whatsapp-extract.test.ts`.
- The Telegram assistant uses a server-only direct Bot API token and server-verified chat links; reuse wa_* tables with phone storing chat_id and never infer user identity from message text.
- Preserve cloud-created appointments outside the client's loaded ID baseline when saving local edits, because webhook writes can arrive between reads.
- Process verified Telegram deliveries through a durable inbox and request-scoped background execution; ambiguous outbound sends require reconciliation, not blind replay.
- Keep recurring definitions separate from daily habit logs, with owner-scoped deferred references; replacing definitions and logs in one save preserves history and transactional consistency.
- Compute scheduled-day streaks and case-insensitive suggestions in `habit-routines.ts`; shared pure rules keep checklist and tests consistent.
- Store profile photos in an owner-scoped private Storage bucket and persist only their path; temporary signed URLs prevent public photo access.
- Keep `/whatsapp` as a page redirect to `/telegram`, without renaming the registered webhook or integration storage; external bot registrations must remain valid.

- Encrypt new backups with browser Web Crypto AES-256-GCM and PBKDF2-SHA256; never persist backup passwords, and retain validation and confirmation for legacy imports.
- Keep routine notification eligibility in a pure helper; only active, scheduled, incomplete routines with a configured time are notified.
- Reuse the private owner-scoped photo bucket for important-day photos; persist only paths and serve temporary signed URLs.
