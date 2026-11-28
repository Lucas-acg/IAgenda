import { useState } from "react";
import { Flame, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ALL_WEEKDAYS, WEEKDAY_LABELS, routineDue, routineStreaks } from "@/lib/habit-routines";
import { toISODate, useStore, type HabitRoutine } from "@/lib/store";
import { cn } from "@/lib/utils";

export function WeekdayPicker({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Dias da semana</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_LABELS.map((label, day) => (
          <Button
            key={day}
            type="button"
            variant="outline"
            aria-pressed={days.includes(day)}
            aria-label={label}
            className={cn(
              "h-11 min-w-11 rounded-xl px-2",
              days.includes(day) && "border-primary bg-primary-soft text-primary",
            )}
            onClick={() =>
              onChange(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort())
            }
          >
            {label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

export function TodayHabits() {
  const { data, ready, toggleRoutine } = useStore();
  const today = toISODate(new Date());
  const routines = data.habitRoutines.filter((r) => routineDue(r, today));
  return (
    <section aria-labelledby="today-habits" className="mb-6 border-b pb-5">
      <h2
        id="today-habits"
        className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"
      >
        <Repeat className="size-5 text-habit" />
        Hábitos de hoje
      </h2>
      {routines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma rotina programada para hoje.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {routines.map((r) => {
            const done = data.habits.some((h) => h.routine_id === r.id && h.date === today);
            const streak = routineStreaks(r, data.habits, today);
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <Checkbox
                  id={`today-${r.id}`}
                  disabled={!ready}
                  checked={done}
                  onCheckedChange={() => toggleRoutine(r.id, today)}
                  aria-label={`Marcar ${r.name}`}
                  className="size-6"
                />
                <Label
                  htmlFor={`today-${r.id}`}
                  className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-1"
                >
                  <span
                    className={cn(
                      "break-words font-medium",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {r.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Flame className="size-3 text-habit" />
                    Sequência: {streak.current} · Melhor: {streak.best}
                  </span>
                </Label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RoutineSettings() {
  const { data, saveRoutine, removeRoutine, setData } = useStore();
  const [editing, setEditing] = useState<HabitRoutine | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>(ALL_WEEKDAYS);
  const [time, setTime] = useState("");
  const [notify, setNotify] = useState(false);
  const reset = () => {
    setEditing(null);
    setName("");
    setDays(ALL_WEEKDAYS);
    setTime(""); setNotify(false);
  };
  return (
    <div className="space-y-5">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (notify && !time) { toast.error("Informe o horário para notificar."); return; }
          if (notify && !data.prefs.notifications) {
            if (typeof Notification !== "undefined") {
              const permission = await Notification.requestPermission();
              if (permission !== "granted") { toast.error("Permissão negada. Os avisos aparecerão apenas dentro do aplicativo."); }
            }
            setData((d) => ({ ...d, prefs: { ...d.prefs, notifications: true } }));
          }
          if (saveRoutine({ name, days, active: editing?.active ?? true, time: time || null, notify }, editing?.id)) {
            reset();
            toast.success("Rotina salva");
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="routine-name">Nome da rotina</Label>
          <Input
            id="routine-name"
            required
            className="h-11 rounded-xl"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <WeekdayPicker days={days} onChange={setDays} />
        <div className="space-y-1.5"><Label htmlFor="routine-time">Horário</Label><Input id="routine-time" type="time" required={notify} className="h-11 rounded-xl" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="flex items-center justify-between gap-3"><Label htmlFor="routine-notify">Notificar no horário</Label><Switch id="routine-notify" checked={notify} onCheckedChange={setNotify} /></div>
        <p className="text-xs text-muted-foreground">Avisos nos dias programados, com o aplicativo aberto. Hábitos já concluídos não geram aviso.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11 rounded-xl">
            <Plus className="size-4" />
            {editing ? "Salvar alterações" : "Criar rotina"}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
      <ul className="space-y-2">
        {data.habitRoutines.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border p-3">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.days.length === 7
                  ? "Todos os dias"
                  : r.days.map((d) => WEEKDAY_LABELS[d]).join(" · ")}{" "}
                · {r.active ? "Ativa" : "Pausada"}
                {r.time ? ` · ${r.time}${r.notify ? " · Notificar" : ""}` : ""}
              </p>
            </div>
            <Switch
              checked={r.active}
              aria-label={`Ativar ${r.name}`}
              onCheckedChange={(active) => saveRoutine({ ...r, active }, r.id)}
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-11"
              aria-label={`Editar ${r.name}`}
              onClick={() => {
                setEditing(r);
                setName(r.name);
                setDays(r.days);
                setTime(r.time ?? ""); setNotify(r.notify ?? false);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 text-destructive"
                  aria-label={`Excluir ${r.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir a rotina {r.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os registros anteriores serão mantidos no calendário e nas estatísticas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      removeRoutine(r.id);
                      if (editing?.id === r.id) reset();
                      toast.success("Rotina excluída");
                    }}
                  >
                    Excluir rotina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </div>
  );
}
