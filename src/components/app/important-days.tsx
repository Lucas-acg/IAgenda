import { useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { uid, useStore, type ImportantDay } from "@/lib/store";
import { PHOTO_BUCKET, validProfilePhoto } from "@/lib/profile-photo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-provider";

function DayPhoto({ day }: { day: ImportantDay }) {
  const { user } = useAuth();
  const { ready, setData, flush } = useStore();
  const [busy, setBusy] = useState(false);
  const path = day.photoPath ?? "";
  const { data: url } = useQuery({
    queryKey: ["important-day-photo", user?.id, path], enabled: !!user && !!path && path.startsWith(`${user.id}/`), staleTime: 30 * 60_000, refetchInterval: 30 * 60_000,
    queryFn: async () => { const result = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600); if (result.error) throw result.error; return result.data.signedUrl; },
  });
  const change = async (file: File | null) => {
    if (!user || !ready || busy) return;
    if (file && !validProfilePhoto(file)) { toast.error("Escolha uma foto JPG, PNG ou WebP de até 5 MB."); return; }
    setBusy(true);
    try {
      let next = "";
      if (file) {
        next = `${user.id}/important-${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"}`;
        const result = await supabase.storage.from(PHOTO_BUCKET).upload(next, file, { contentType: file.type });
        if (result.error) throw result.error;
      }
      setData((d) => ({ ...d, importantDays: d.importantDays.map((item) => item.id === day.id ? { ...item, photoPath: next } : item) }));
      await flush();
      if (path.startsWith(`${user.id}/`)) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      toast.success(file ? "Foto salva" : "Foto removida");
    } catch { toast.error("Não foi possível salvar a foto. Tente novamente."); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2">
    <Avatar className="size-12"><AvatarImage src={url} alt={`Foto de ${day.name}`} className="object-cover" /><AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">{day.date.slice(3)}/{day.date.slice(0, 2)}</AvatarFallback></Avatar>
    <Button asChild variant="outline" size="icon" className="size-11" disabled={busy}><label title="Alterar foto" aria-label={`Alterar foto de ${day.name}`} className="cursor-pointer"><Camera className="size-4" /><input type="file" className="sr-only" aria-label={`Foto de ${day.name}`} disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void change(file); }} /></label></Button>
    {path && <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={`Remover foto de ${day.name}`} onClick={() => void change(null)}><Trash2 className="size-4" /></Button>}
  </div>;
}

export function ImportantDays() {
  const { data, setData } = useStore();
  const [form, setForm] = useState({ name: "", date: "", note: "" });
  return <div className="space-y-5">
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      if (!form.name.trim() || !form.date) { toast.error("Preencha nome e data."); return; }
      setData((d) => ({ ...d, importantDays: [...d.importantDays, { id: uid(), name: form.name.trim(), date: form.date.slice(5), note: form.note, photoPath: "", notify: true }] }));
      setForm({ name: "", date: "", note: "" }); toast.success("Dia importante salvo");
    }}>
      <div className="space-y-1.5"><Label htmlFor="id-name">Nome</Label><Input id="id-name" className="h-11 rounded-xl" required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aniversário da Ana" /></div>
      <div className="space-y-1.5"><Label htmlFor="id-date">Data</Label><Input id="id-date" className="h-11 rounded-xl" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="id-note">Nota</Label><Textarea id="id-note" maxLength={10000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
      <Button type="submit" className="h-11 rounded-xl sm:col-span-2"><Plus className="size-4" />Adicionar</Button>
    </form>
    <p className="text-xs text-muted-foreground">Repete todo ano no mesmo dia.</p>
    {data.importantDays.length === 0 && <p className="text-sm text-muted-foreground">Nenhum dia importante ainda.</p>}
    <ul className="space-y-3">{[...data.importantDays].sort((a, b) => a.date.localeCompare(b.date)).map((day) => <li key={day.id} className="space-y-3 rounded-2xl border p-3">
      <div className="flex flex-wrap items-center gap-3"><DayPhoto day={day} /><span className="min-w-0 flex-1 break-words font-medium">{day.name}</span><Switch aria-label={`Notificar ${day.name}`} checked={day.notify} onCheckedChange={(notify) => setData((d) => ({ ...d, importantDays: d.importantDays.map((item) => item.id === day.id ? { ...item, notify } : item) }))} /><Button variant="ghost" size="icon" aria-label={`Excluir ${day.name}`} onClick={() => setData((d) => ({ ...d, importantDays: d.importantDays.filter((item) => item.id !== day.id) }))}><Trash2 className="size-4" /></Button></div>
      <div className="space-y-1.5"><Label htmlFor={`note-${day.id}`}>Nota</Label><Textarea id={`note-${day.id}`} maxLength={10000} value={day.note ?? ""} onChange={(e) => { const note = e.target.value; setData((d) => ({ ...d, importantDays: d.importantDays.map((item) => item.id === day.id ? { ...item, note } : item) })); }} /></div>
    </li>)}</ul>
  </div>;
}