import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AppData } from "./store";
import { normalizeAppearance } from "./appearance";
import { validateBackup } from "./backup";

export async function loadCloudData(userId: string): Promise<{ data: AppData; importOffered: boolean }> {
  const results = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("preferences").select("*").eq("user_id", userId).single(),
    supabase.from("appointments").select("*").eq("user_id", userId),
    supabase.from("entries").select("*").eq("user_id", userId),
    supabase.from("habits").select("*").eq("user_id", userId),
    supabase.from("reminders").select("*").eq("user_id", userId),
    supabase.from("important_days").select("*").eq("user_id", userId),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [profile,prefs,appointments,entries,habits,reminders,importantDays] = results;
  if (!profile.data || !prefs.data) throw new Error("Perfil indisponível");
  return { importOffered: profile.data.legacy_import_offered, data: validateBackup({
    profile: profile.data, prefs: { ...prefs.data, ...normalizeAppearance(prefs.data) },
    appointments: appointments.data ?? [],
    entries: (entries.data ?? []).map((e) => ({ ...e, value: e.value ?? undefined, quality: e.quality ?? undefined })),
    habits: habits.data ?? [], reminders: reminders.data ?? [], importantDays: importantDays.data ?? [],
  }) };
}
export async function saveCloudData(data: AppData) {
  const validated = validateBackup(data);
  const { error } = await supabase.rpc("save_iagenda_data", { payload: JSON.parse(JSON.stringify(validated)) as Json });
  if (error) throw error;
}
export async function markImportOffered(userId: string) {
  const { error } = await supabase.from("profiles").update({ legacy_import_offered: true }).eq("user_id",userId);
  if (error) throw error;
}