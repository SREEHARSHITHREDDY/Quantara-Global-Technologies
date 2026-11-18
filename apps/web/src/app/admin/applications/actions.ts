"use server";
import { revalidatePath } from "next/cache";
import { APPLICATION_STATUSES, getPrisma, setApplicationStatus, type ApplicationStatusValue } from "@quantara/db";
import { requireStaff } from "@/lib/admin";

export async function updateApplicationStatus(formData: FormData): Promise<void> {
  const s = await requireStaff("application:manage");
  const id = String(formData.get("id") ?? ""); const status = String(formData.get("status") ?? "") as ApplicationStatusValue;
  const note = String(formData.get("note") ?? "");
  if (!id || !APPLICATION_STATUSES.includes(status)) return;
  await setApplicationStatus(getPrisma(), id, status, note || undefined, s.userId, s.organizationId);
  revalidatePath("/admin/applications"); revalidatePath(`/admin/applications/${id}`);
}
