import { useState } from "react";
import { Download, Upload, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toISODate, useStore, type AppData } from "@/lib/store";
import { validateBackup } from "@/lib/backup";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "@/lib/encrypted-backup";

export function BackupControls() {
  const { data, setData, flush } = useStore();
  const [mode, setMode] = useState<"export" | "import" | null>(null);
  const [encrypted, setEncrypted] = useState<unknown>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => { setMode(null); setPassword(""); setConfirmation(""); setEncrypted(null); setError(""); };
  const restore = (value: unknown) => setPending(validateBackup(value));
  const read = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) { toast.error("Backup muito grande."); return; }
    try {
      const value: unknown = JSON.parse(await file.text());
      if (isEncryptedBackup(value)) { setEncrypted(value); setMode("import"); setError(""); }
      else restore(value);
    } catch { toast.error("Arquivo de backup inválido."); }
  };
  return <>
    <Button variant="outline" className="h-11 rounded-xl" onClick={() => { close(); setMode("export"); }}><Download className="size-4" />Exportar backup</Button>
    <Button variant="outline" className="h-11 rounded-xl" asChild><label htmlFor="pr-import" className="cursor-pointer"><Upload className="size-4" />Importar backup<input id="pr-import" type="file" accept=".iagenda,.json,application/json" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void read(file); }} /></label></Button>
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><LockKeyhole className="size-5" />{mode === "export" ? "Proteger backup" : "Desbloquear backup"}</DialogTitle><DialogDescription>{mode === "export" ? "Escolha uma senha exclusiva para este arquivo. Sem ela, o backup não poderá ser recuperado. As fotos permanecem na sua conta; o arquivo guarda suas referências." : "Informe a senha escolhida ao exportar este arquivo."}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setError("");
          if (mode === "export" && password !== confirmation) { setError("As senhas não coincidem."); return; }
          setBusy(true);
          try {
            if (mode === "export") {
              await flush();
              const content = await encryptBackup(validateBackup(data), password);
              const url = URL.createObjectURL(new Blob([content], { type: "application/octet-stream" }));
              const a = document.createElement("a"); a.href = url; a.download = `iagenda-backup-${toISODate(new Date())}.iagenda`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
              toast.success("Backup criptografado exportado");
            } else restore(await decryptBackup(encrypted, password));
            close();
          } catch { setError(mode === "import" ? "Senha incorreta ou arquivo inválido. Tente novamente." : "Não foi possível exportar. Confira a senha e tente novamente."); }
          finally { setBusy(false); }
        }}>
          <div className="space-y-2"><Label htmlFor="backup-password">Senha do backup</Label><Input id="backup-password" type="password" autoComplete={mode === "export" ? "new-password" : "off"} required minLength={mode === "export" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {mode === "export" && <div className="space-y-2"><Label htmlFor="backup-confirm">Confirmar senha</Label><Input id="backup-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Aguarde…" : mode === "export" ? "Exportar criptografado" : "Desbloquear"}</Button>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar este backup?</AlertDialogTitle><AlertDialogDescription>
        {pending && `O arquivo contém ${pending.appointments.length} compromissos, ${pending.entries.length} acontecimentos, ${pending.habits.length} hábitos, ${pending.habitRoutines.length} rotinas, ${pending.reminders.length} lembretes antigos e ${pending.importantDays.length} dias importantes.`} Todos os dados e preferências atuais serão substituídos.
      </AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => {
        e.preventDefault(); if (!pending) return;
        setBusy(true); setData(() => pending);
        void flush().then(() => { setPending(null); toast.success("Backup restaurado"); }).catch(() => toast.error("Não foi possível salvar a restauração. Tente novamente.")).finally(() => setBusy(false));
      }}>{busy ? "Restaurando…" : "Restaurar backup"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </>;
}