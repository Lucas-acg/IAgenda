import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AppData } from "./store";
import { normalizeAppearance } from "./appearance";
import { validateBackup } from "./backup";
let loadedAppointmentIds: string[] = [];
export function acceptCloudData(data: AppData) { loadedAppointmentIds = data.appointments.map((a) => a.id); }

export async function loadCloudData(userId: string): Promise<{ data: AppData; importOffered: boolean }> {
  const results = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("appointments").select("*").eq("user_id", userId),
    supabase.from("entries").select("*").eq("user_id", userId),
    supabase.from("habits").select("*").eq("user_id", userId),
    supabase.from("reminders").select("*").eq("user_id", userId),
    supabase.from("important_days").select("*").eq("user_id", userId),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [profile,prefs,appointments,entries,habits,reminders,importantDays] = results;
  const profileData = profile.data ?? { user_id: userId, name: "", timezone: "America/Sao_Paulo", height: "", weight: "", wake: "07:00", sleep: "23:00", waterGoal: 8, sleepGoal: 8, legacy_import_offered: false };
  const prefsData = prefs.data ?? { notifications: false, weekStartsMonday: false, ...normalizeAppearance() };
  return { importOffered: profileData.legacy_import_offered, data: validateBackup({
    profile: profileData, prefs: { ...prefsData, ...normalizeAppearance(prefsData) },
    appointments: appointments.data ?? [],
    entries: (entries.data ?? []).map((e) => ({ ...e, value: e.value ?? undefined, quality: e.quality ?? undefined })),
    habits: habits.data ?? [], reminders: reminders.data ?? [], importantDays: importantDays.data ?? [],
  }) };
}
export async function saveCloudData(data: AppData) {
  const validated = validateBackup(data);
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Authentication required");
  const { error } = await supabase.rpc("save_iagenda_data", { payload: JSON.parse(JSON.stringify({ ...validated, knownAppointmentIds: loadedAppointmentIds })) as Json });
  if (error) throw error;
  loadedAppointmentIds = validated.appointments.map((a) => a.id);
}
export async function markImportOffered(userId: string) {
  const { error } = await supabase.from("profiles").update({ legacy_import_offered: true }).eq("user_id",userId);
  if (error) throw error;
}
