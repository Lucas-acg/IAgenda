import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { BarChart3, CalendarDays, ListChecks, Plus, Settings, CalendarHeart, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useAdd } from "./add-flow";
import { nowTime, parseISODate, toISODate, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Compromissos", icon: ListChecks },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;
const DESKTOP_NAV = [...NAV.slice(0, 3), { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle } as const, NAV[3]] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { open } = useAdd();
  const { data, ready } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useReminderNotifications();
  const initials = (data.profile.name || "Você").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset["palette"] = data.prefs.palette;
    root.dataset["density"] = data.prefs.compact ? "compact" : "comfortable";
    root.dataset["text"] = data.prefs.largeText ? "large" : "standard";
    root.dataset["motion"] = data.prefs.animations ? "on" : "off";
  }, [data.prefs, ready]);

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop / tablet sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r bg-sidebar p-3 md:flex lg:w-64 lg:p-5">
        <Link to="/" className="mb-6 flex items-center gap-2.5 px-1">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><CalendarHeart className="size-5" aria-hidden /></span>
          <span className="hidden font-display text-xl font-bold lg:block">IAgenda</span>
        </Link>
        <Button onClick={() => open()} className="mb-5 h-11 rounded-xl shadow-[var(--shadow-fab)]" aria-label="Adicionar registro">
          <Plus className="size-5" /> <span className="hidden lg:inline">Adicionar</span>
        </Button>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Principal">
          {DESKTOP_NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} title={n.label}
                className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <n.icon className="size-5 shrink-0" aria-hidden /><span className="hidden lg:inline">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link to="/configuracoes" className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">{ready ? initials : ""}</span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-semibold">{data.profile.name || "Seu perfil"}</span>
            <span className="block text-xs text-muted-foreground">Perfil e preferências</span>
          </span>
        </Link>
      </aside>

      <main className="app-content min-w-0 flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] md:px-8 md:pb-10 md:pt-8 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
          {[NAV[0], NAV[1]].map((n) => <MobileTab key={n.to} {...n} path={path} />)}
          <div className="flex justify-center">
            <Button size="icon" onClick={() => open()} aria-label="Adicionar registro"
              className="-mt-7 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-fab)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
              <Plus className="size-7" aria-hidden />
            </Button>
          </div>
          {[NAV[2], NAV[3]].map((n) => <MobileTab key={n.to} {...n} path={path} />)}
        </div>
      </nav>
    </div>
  );
}

function MobileTab({ to, label, icon: Icon, path }: { to: (typeof NAV)[number]["to"]; label: string; icon: typeof Plus; path: string }) {
  const active = to === "/" ? path === "/" : path.startsWith(to);
  const short = label === "Compromissos" ? "Agenda" : label === "Estatísticas" ? "Estatísticas" : label === "Configurações" ? "Ajustes" : label;
  return (
    <Link to={to} aria-label={label} aria-current={active ? "page" : undefined}
      className={cn("flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
      <Icon className="size-6" aria-hidden />{short}
    </Link>
  );
}

export function todayLabel() { return format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }); }
export function dateLabel(iso: string, f = "d 'de' MMM") { return format(parseISODate(iso), f, { locale: ptBR }); }

/** Fires browser notifications for appointments, daily reminders and important days while the app is open. */
function useReminderNotifications() {
  const { data } = useStore();
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!data.prefs.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const tick = () => {
      const now = new Date(); const today = toISODate(now); const t = nowTime();
      const notify = (key: string, title: string, body: string) => {
        if (fired.current.has(key)) return; fired.current.add(key);
        try { new Notification(title, { body, icon: "/icon-512.png" }); } catch { /* alguns navegadores exigem service worker */ }
      };
      data.reminders.filter((r) => r.active && r.time === t).forEach((r) => notify(`r-${r.id}-${today}`, r.name, `Lembrete diário das ${r.time}`));
      data.appointments.filter((a) => !a.done && a.reminder > 0).forEach((a) => {
        const [h = 0, m = 0] = a.time.split(":").map(Number); const when = parseISODate(a.date); when.setHours(h, m - a.reminder);
        if (Math.abs(now.getTime() - when.getTime()) < 60_000) notify(`a-${a.id}`, a.title, `Às ${a.time} — ${dateLabel(a.date)}`);
      });
      if (t === "09:00") data.importantDays.filter((d) => d.notify && d.date === today.slice(5)).forEach((d) => notify(`d-${d.id}-${today}`, "Dia importante", d.name));
    };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, [data]);
}
