"use server";
import { revalidatePath } from "next/cache";
import { EDITABLE_SETTINGS, getPrisma, saveSettings, validateSettings, type SettingsInput } from "@quantara/db";
import { requireStaff } from "@/lib/admin";

export interface SettingsState { status: "idle" | "saved" | "error"; message?: string; errors?: Record<string, string> }

export async function updateSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const s = await requireStaff("site:settings:write"); // re-checked on every submit
  const input: SettingsInput = {};
  for (const def of EDITABLE_SETTINGS) { const v = formData.get(def.key); if (typeof v === "string") input[def.key] = v; }
  const { values, errors } = validateSettings(input);
  if (Object.keys(errors).length) return { status: "error", message: "Please fix the highlighted fields.", errors };
  const changed = await saveSettings(getPrisma(), values, s.userId, s.organizationId);
  revalidatePath("/admin/settings");
  if (changed.length) revalidatePath("/", "layout"); // refresh the public footer and contact page
  return { status: "saved", message: changed.length ? `Saved ${changed.length} change(s).` : "Nothing changed." };
}
