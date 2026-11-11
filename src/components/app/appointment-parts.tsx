import { useState } from "react";
import { Check, Pencil, Trash2, Clock, Bell, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CATEGORY_LABEL, appointmentStatus, useStore, type Appointment } from "@/lib/store";
import { STATUS_BAR, StatusBadge } from "./shared";
import { useAdd } from "./add-flow";
import { dateLabel } from "./shell";
import { cn } from "@/lib/utils";

export function AppointmentCard({ a, selected, onSelect }: { a: Appointment; selected?: boolean; onSelect: () => void }) {
  const st = appointmentStatus(a);
  const { updateAppointment } = useStore();
  return (
    <div className={cn("card-soft fade-up relative flex items-center gap-3 overflow-hidden p-3 pl-4 transition", selected && "ring-2 ring-primary")}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", STATUS_BAR[st])} aria-hidden />
      <button onClick={() => { updateAppointment(a.id, { done: !a.done }); toast.success(a.done ? "Marcado como pendente" : "Compromisso concluído"); }}
        aria-label={a.done ? "Desmarcar conclusão" : "Concluir compromisso"}
        className={cn("grid size-11 shrink-0 place-items-center rounded-full border-2 transition", a.done ? "border-done bg-done text-primary-foreground" : "border-input hover:border-primary")}>
        {a.done && <Check className="size-5" aria-hidden />}
      </button>
      <button onClick={onSelect} className="min-w-0 flex-1 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <p className={cn("truncate font-semibold", a.done && "text-muted-foreground line-through")}>{a.title}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />{dateLabel(a.date, "EEE, d MMM")} · {a.time}
          <span className="hidden sm:inline">· {CATEGORY_LABEL[a.category]}</span>
        </p>
      </button>
      <StatusBadge status={st} />
    </div>
  );
}

export function AppointmentDetail({ a, onDeleted }: { a: Appointment; onDeleted?: () => void }) {
  const { updateAppointment, removeAppointment } = useStore();
  const { open } = useAdd();
  const [confirm, setConfirm] = useState(false);
  const st = appointmentStatus(a);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <StatusBadge status={st} />
        <h2 className="font-display text-2xl font-bold">{a.title}</h2>
        <p className="capitalize text-muted-foreground">{dateLabel(a.date, "EEEE, d 'de' MMMM 'de' yyyy")} · {a.time}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted p-3"><dt className="text-muted-foreground">Categoria</dt><dd className="font-semibold">{CATEGORY_LABEL[a.category]}</dd></div>
        <div className="rounded-xl bg-muted p-3"><dt className="flex items-center gap-1 text-muted-foreground"><Bell className="size-3.5" aria-hidden />Lembrete</dt><dd className="font-semibold">{a.reminder === 0 ? "Nenhum" : a.reminder >= 1440 ? "1 dia antes" : a.reminder >= 60 ? "1 hora antes" : `${a.reminder} min antes`}</dd></div>
      </dl>
      {a.description && <p className="whitespace-pre-wrap rounded-xl border p-3 text-sm">{a.description}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Button className="h-11 rounded-xl" onClick={() => updateAppointment(a.id, { done: !a.done })}>
          {a.done ? <><Undo2 className="size-4" />Reabrir</> : <><Check className="size-4" />Concluir</>}
        </Button>
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => open("compromisso", { edit: a })}><Pencil className="size-4" />Editar</Button>
        <Button variant="outline" className="h-11 rounded-xl text-destructive hover:text-destructive" onClick={() => setConfirm(true)}><Trash2 className="size-4" />Excluir</Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
            <AlertDialogDescription>“{a.title}” será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { removeAppointment(a.id); toast.success("Compromisso excluído"); onDeleted?.(); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
