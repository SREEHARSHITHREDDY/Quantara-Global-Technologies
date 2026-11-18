"use server";
import { revalidatePath } from "next/cache";
import { ENQUIRY_STATUSES, getPrisma, setEnquiryStatus, type EnquiryStatusValue } from "@quantara/db";
import { requireStaff } from "@/lib/admin";

export async function updateEnquiryStatus(formData: FormData): Promise<void> {
  const s = await requireStaff("enquiry:manage"); // re-checked on every action, never trusting the page
  const id = String(formData.get("id") ?? ""); const status = String(formData.get("status") ?? "") as EnquiryStatusValue;
  if (!id || !ENQUIRY_STATUSES.includes(status)) return;
  await setEnquiryStatus(getPrisma(), id, status, s.userId, s.organizationId);
  revalidatePath("/admin/enquiries"); revalidatePath(`/admin/enquiries/${id}`);
}
