"use server";
import { revalidatePath } from "next/cache";
import { getCouncilWorkspace, getPrisma, setCouncilPlan } from "@quantara/db";
import { requireStaff } from "@/lib/admin";
import { validatePlanForm } from "@/lib/council-admin";

export interface PlanState { status: "idle" | "saved" | "error"; message?: string; errors?: Record<string, string> }

/** Changes a customer workspace's council plan. Permission is re-checked on every submit; the change is audited. */
export async function updatePlan(organizationId: string, _prev: PlanState, formData: FormData): Promise<PlanState> {
  const s = await requireStaff("ai:provider:manage");
  const v = validatePlanForm({ plan: formData.get("plan"), trialDays: formData.get("trialDays"), maxConcurrent: formData.get("maxConcurrent") });
  if (!v.ok) return { status: "error", message: "Please fix the highlighted fields.", errors: v.errors };
  const db = getPrisma();
  if (!(await getCouncilWorkspace(db, organizationId))) return { status: "error", message: "Workspace not found." };
  await setCouncilPlan(db, { organizationId, plan: v.value.plan, trialDays: v.value.trialDays, maxConcurrent: v.value.maxConcurrent, actorId: s.userId });
  revalidatePath(`/admin/council/${organizationId}`);
  revalidatePath("/admin/council");
  return { status: "saved", message: "Plan updated." };
}
