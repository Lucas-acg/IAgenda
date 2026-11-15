import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Info, MessageCircle, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app/shared";
import { dateLabel } from "@/components/app/shell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — IAgenda" },
      { name: "description", content: "Escolha quais conversas do WhatsApp a IA verifica para criar compromissos automaticamente." },
      { property: "og:title", content: "WhatsApp — IAgenda" },
      { property: "og:description", content: "Compromissos com hora marcada viram eventos na sua agenda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsappPage,
});

// New tables are not in the generated types yet.
const db = supabase as unknown as SupabaseClient;

interface Conversation { wa_id: string; contact_name: string; last_preview: string; last_message_at: string; watched: boolean }
interface Detected { id: string; wa_id: string; body: string; ai_status: string; ai_error: string | null; appointment_title: string | null; appointment_date: string | null; appointment_time: string | null; sent_at: string }

type State =
  | { kind: "setup" }
  | { kind: "other-owner" }
  | { kind: "ready"; conversations: Conversation[]; detected: Detected[] };

async function loadState(): Promise<State> {
  const claim = await db.rpc("claim_whatsapp_owner");
  if (claim.error) {
    if (["PGRST202", "PGRST205", "42P01", "42883"].includes(claim.error.code)) return { kind: "setup" };
    throw claim.error;
  }
  if (claim.data !== true) return { kind: "other-owner" };
  const [c, d] = await Promise.all([
    db.from("whatsapp_conversations").select("wa_id,contact_name,last_preview,last_message_at,watched").order("last_message_at", { ascending: false }).limit(200),
    db.from("whatsapp_messages").select("id,wa_id,body,ai_status,ai_error,appointment_title,appointment_date,appointment_time,sent_at").in("ai_status", ["created", "error"]).order("sent_at", { ascending: false }).limit(20),
  ]);
  if (c.error) throw c.error;
  if (d.error) throw d.error;
  return { kind: "ready", conversations: (c.data ?? []) as Conversation[], detected: (d.data ?? []) as Detected[] };
}

function formatPhone(waId: string) { return waId.length > 4 ? `+${waId.slice(0, 2)} ${waId.slice(2, 4)} ${waId.slice(4)}` : waId; }

function WhatsappPage() {
  const qc = useQueryClient();
  const { reload } = useStore();
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["whatsapp"], queryFn: loadState, refetchInterval: 30_000 });

  const analyze = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/public/whatsapp/analyze", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const body = (await res.json().catch(() => ({}))) as { error?: string; analyzed?: number };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível analisar agora.");
      return body.analyzed ?? 0;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["whatsapp"] }); reload(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = useMutation({
    mutationFn: async ({ waId, watched }: { waId: string; watched: boolean }) => {
      const { error } = await db.from("whatsapp_conversations").update({ watched }).eq("wa_id", waId);
      if (error) throw error;
      return watched;
    },
    onMutate: async ({ waId, watched }) => {
      qc.setQueryData<State>(["whatsapp"], (s) => s?.kind === "ready" ? { ...s, conversations: s.conversations.map((c) => c.wa_id === waId ? { ...c, watched } : c) } : s);
    },
    onSuccess: (watched) => { if (watched) { toast.success("A IA vai verificar esta conversa"); analyze.mutate(); } },
    onError: () => { toast.error("Não foi possível salvar a escolha."); void qc.invalidateQueries({ queryKey: ["whatsapp"] }); },
  });

  const s = query.data;
  const names = new Map(s?.kind === "ready" ? s.conversations.map((c) => [c.wa_id, c.contact_name || formatPhone(c.wa_id)]) : []);
  const list = s?.kind === "ready" ? s.conversations.filter((c) => `${c.contact_name} ${c.wa_id}`.toLowerCase().includes(q.toLowerCase())) : [];

  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="A IA transforma mensagens com hora marcada em compromissos"
        actions={s?.kind === "ready" ? <Button variant="outline" className="h-11 rounded-xl" disabled={analyze.isPending} onClick={() => analyze.mutate()}><RefreshCw className={analyze.isPending ? "size-4 animate-spin" : "size-4"} />Analisar agora</Button> : undefined} />

      <div className="card-soft mb-5 flex gap-3 p-4 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">Funciona com o número <b className="text-foreground">WhatsApp Business</b> conectado ao IAgenda, pela API oficial: mensagens que chegam nele e as que você envia pelo app WhatsApp Business. Conversas de um WhatsApp pessoal não podem ser lidas pela API oficial. Dica: encaminhe ou escreva compromissos para o número Business, por exemplo “dentista amanhã às 15h”.</p>
      </div>

      {query.isPending && <p className="text-muted-foreground">Carregando conversas…</p>}
      {query.isError && <div role="alert" className="card-soft p-5"><p className="mb-3">Não foi possível carregar as conversas.</p><Button className="h-11 rounded-xl" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}

      {s?.kind === "setup" && <div className="card-soft flex gap-3 p-5"><ShieldAlert className="size-5 shrink-0 text-primary" aria-hidden /><div><p className="font-semibold">Integração ainda não ativada</p><p className="text-sm text-muted-foreground">Falta preparar o armazenamento das conversas no servidor. Depois disso, conecte o WhatsApp Business e volte aqui.</p></div></div>}
      {s?.kind === "other-owner" && <div className="card-soft p-5"><p className="font-semibold">Integração ligada a outra conta</p><p className="text-sm text-muted-foreground">O número WhatsApp Business deste IAgenda já está vinculado a outro usuário.</p></div>}

      {s?.kind === "ready" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="wa-conv">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="wa-conv" className="font-display text-lg font-semibold">Conversas</h2>
              <span className="text-sm text-muted-foreground">{s.conversations.filter((c) => c.watched).length} verificadas</span>
            </div>
            <div className="relative mb-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input aria-label="Buscar conversa" className="h-11 rounded-xl pl-9" placeholder="Buscar por nome ou número" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {s.conversations.length === 0 ? (
              <div className="card-soft p-6 text-center"><MessageCircle className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden /><p className="font-semibold">Nenhuma conversa ainda</p><p className="text-sm text-muted-foreground">As conversas aparecem aqui quando o número Business receber ou enviar a primeira mensagem.</p></div>
            ) : (
              <ul className="card-soft divide-y overflow-hidden">
                {list.map((c) => (
                  <li key={c.wa_id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">{(c.contact_name || "#").slice(0, 1).toUpperCase()}</span>
                    <label htmlFor={`wa-${c.wa_id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate font-semibold">{c.contact_name || formatPhone(c.wa_id)}</span>
                      <span className="block truncate text-sm text-muted-foreground">{c.last_preview}</span>
                    </label>
                    <Switch id={`wa-${c.wa_id}`} checked={c.watched} aria-label={`Verificar conversa com ${c.contact_name || c.wa_id}`} onCheckedChange={(v) => toggle.mutate({ waId: c.wa_id, watched: v })} />
                  </li>
                ))}
                {list.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</li>}
              </ul>
            )}
          </section>

          <section aria-labelledby="wa-found">
            <h2 id="wa-found" className="mb-3 font-display text-lg font-semibold">Criados pela IA</h2>
            {s.detected.length === 0 ? <p className="card-soft p-4 text-sm text-muted-foreground">Quando a IA encontrar um compromisso com hora marcada numa conversa verificada, ele aparece aqui e na sua agenda.</p> : (
              <ul className="space-y-2">
                {s.detected.map((d) => (
                  <li key={d.id} className="card-soft p-3 text-sm">
                    {d.ai_status === "created" ? (
                      <p className="flex items-center gap-2 font-semibold"><CalendarCheck className="size-4 text-primary" aria-hidden />{d.appointment_title}</p>
                    ) : <p className="font-semibold text-destructive">Não analisada: {d.ai_error ?? "erro"}</p>}
                    {d.ai_status === "created" && d.appointment_date && <p className="text-muted-foreground">{dateLabel(d.appointment_date, "EEEE, d 'de' MMM")} às {d.appointment_time}</p>}
                    <p className="mt-1 line-clamp-2 text-muted-foreground">“{d.body}” · {names.get(d.wa_id) ?? formatPhone(d.wa_id)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="ghost" className="mt-3 h-11 rounded-xl"><Link to="/">Ver agenda</Link></Button>
          </section>
        </div>
      )}
    </div>
  );
}
