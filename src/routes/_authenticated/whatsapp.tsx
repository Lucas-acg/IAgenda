import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Link2, Unlink, Copy, CalendarCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/shared";
import { AppointmentDetail } from "@/components/app/appointment-parts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { assistantStatus, generateLinkCode, unlinkPhone } from "@/lib/whatsapp/assistant.functions";
import { dateLabel } from "@/components/app/shell";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({ meta: [
    { title: "Assistente Telegram — IAgenda" }, { name: "description", content: "Vincule seu Telegram ao assistente oficial do IAgenda e registre compromissos pelo Telegram." },
    { property: "og:title", content: "Assistente Telegram — IAgenda" }, { property: "og:description", content: "Seus compromissos registrados pelo assistente oficial, na sua agenda privada." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: WhatsappPage,
});
function WhatsappPage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(assistantStatus), getCode = useServerFn(generateLinkCode), unlink = useServerFn(unlinkPhone);
  const { data, reload } = useStore();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["wa-assistant-status"], queryFn: () => getStatus(), refetchInterval: 10_000 });
  const detected = useQuery({ queryKey: ["wa-assistant-detected"], queryFn: async () => {
    const { data: rows, error } = await supabase.from("wa_assistant_messages").select("id,appointment_id,state,clarification,sent_at").in("state", ["created", "clarification", "error"]).order("sent_at", { ascending: false }).limit(100);
    if (error) throw error;
    return rows ?? [];
  }, refetchInterval: 15_000 });
  const link = useMutation({ mutationFn: () => getCode(), onSuccess: setCode, onError: () => toast.error("Não foi possível gerar o código.") });
  const removeLink = useMutation({ mutationFn: () => unlink(), onSuccess: () => { setCode(null); void qc.invalidateQueries({ queryKey: ["wa-assistant-status"] }); toast.success("Telegram desvinculado"); }, onError: () => toast.error("Não foi possível desvincular.") });
  const current = data.appointments.find((a) => a.id === selected);
  const ids = new Set(detected.data?.filter((m) => m.state === "created").map((m) => m.appointment_id));
  const appointments = data.appointments.filter((a) => ids.has(a.id)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const s = status.data;
  return <div>
    <PageHeader title="Telegram" subtitle="Assistente oficial do IAgenda" actions={<Button variant="outline" size="icon" aria-label="Atualizar Telegram" onClick={() => { reload(); void status.refetch(); void detected.refetch(); }}><RefreshCw className="size-4" /></Button>} />
    {(status.isPending || detected.isPending) && <p className="text-muted-foreground">Carregando…</p>}
    {(status.isError || detected.isError) && <p role="alert" className="text-destructive">Não foi possível carregar. Tente atualizar.</p>}
    <section className="mb-7 border-b pb-6" aria-labelledby="wa-status">
      <h2 id="wa-status" className="mb-3 font-display text-lg font-semibold">Assistente</h2>
      <p className="mb-2 font-medium">{s?.paused ? "Temporariamente indisponível" : s?.configured ? "Disponível" : "Aguardando ativação"}</p>
      <p className="mb-4 text-muted-foreground">Bot: {s?.botUsername ? `@${s.botUsername}` : "Ainda não configurado"}</p>
      {s?.botUsername && <Button asChild disabled={!s.configured} className="h-11 rounded-xl"><a href={`https://t.me/${s.botUsername}`} target="_blank" rel="noreferrer"><Send className="size-4" />Abrir no Telegram</a></Button>}
    </section>
    <section className="mb-7 border-b pb-6" aria-labelledby="wa-link">
      <h2 id="wa-link" className="mb-3 font-display text-lg font-semibold">Sua conta Telegram</h2>
      {s?.linkedPhone ? <div className="flex flex-wrap items-center gap-3"><p className="font-medium">Conta vinculada</p><Button variant="outline" disabled={removeLink.isPending} onClick={() => { if (window.confirm("Desvincular esta conta Telegram do assistente?")) removeLink.mutate(); }}><Unlink className="size-4" />Desvincular</Button></div>
      : <Button className="h-11 rounded-xl" disabled={!s?.configured || link.isPending} onClick={() => link.mutate()}><Link2 className="size-4" />{link.isPending ? "Gerando…" : "Vincular Telegram"}</Button>}
      {code && !s?.linkedPhone && <div className="mt-4 flex flex-wrap items-center gap-3"><code className="break-all text-lg">VINCULAR {code.code}</code><Button size="icon" variant="outline" aria-label="Copiar código" onClick={() => { void navigator.clipboard.writeText(`VINCULAR ${code.code}`).then(() => toast.success("Código copiado")); }}><Copy className="size-4" /></Button><Button asChild variant="outline"><a href={`https://t.me/${s?.botUsername}?start=${code.code}`} target="_blank" rel="noreferrer">Abrir no Telegram</a></Button><p className="w-full text-sm text-muted-foreground">Válido até {new Date(code.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p></div>}
    </section>
    <section aria-labelledby="wa-detected">
      <h2 id="wa-detected" className="mb-3 font-display text-lg font-semibold">Compromissos detectados</h2>
      {appointments.length === 0 ? <p className="text-muted-foreground">Nenhum compromisso detectado.</p> : <ul className="space-y-3">{appointments.map((a) => <li key={a.id} className="card-soft flex items-center gap-3 p-4"><CalendarCheck className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-words font-semibold">{a.title}</p><p className="text-sm text-muted-foreground">{dateLabel(a.date, "d 'de' MMMM 'de' yyyy")} · {a.time}</p></div><Button variant="outline" onClick={() => setSelected(a.id)}>Detalhes</Button></li>)}</ul>}
      {detected.data?.filter((m) => m.state === "clarification" || m.state === "error").map((m) => <p key={m.id} className="mt-3 text-sm text-muted-foreground">{m.state === "error" ? "Uma mensagem não pôde ser processada." : `Aguardando resposta no Telegram: ${m.clarification}`}</p>)}
    </section>
    <Sheet open={Boolean(current)} onOpenChange={(open) => { if (!open) setSelected(null); }}><SheetContent side="right" className="overflow-y-auto"><SheetHeader><SheetTitle>Compromisso detectado</SheetTitle><SheetDescription>Detalhes do compromisso</SheetDescription></SheetHeader><div className="p-5">{current && <AppointmentDetail a={current} onDeleted={() => setSelected(null)} />}</div></SheetContent></Sheet>
  </div>;
}
