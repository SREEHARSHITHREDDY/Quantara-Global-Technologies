import { randomUUID } from "node:crypto";
import { isRoleKey } from "@quantara/rbac";
import type { PrismaClient } from "./generated/client";

export const STAFF_ORG_ID = "org_quantara_staff";
export type EnquiryStatusValue = "RECEIVED" | "ACKNOWLEDGED" | "ARCHIVED" | "SPAM";
export const ENQUIRY_STATUSES: readonly EnquiryStatusValue[] = ["RECEIVED", "ACKNOWLEDGED", "ARCHIVED", "SPAM"];

/** Settings editable in /admin/settings. Values are plain text; empty string clears the setting. */
export const EDITABLE_SETTINGS = [
  { key: "contact.email", label: "Contact email", group: "contact", isPublic: true, kind: "email" },
  { key: "contact.phone", label: "Contact phone", group: "contact", isPublic: true, kind: "text" },
  { key: "contact.address", label: "Registered address", group: "contact", isPublic: true, kind: "textarea" },
  { key: "company.legalName", label: "Legal entity name", group: "company", isPublic: true, kind: "text" },
  { key: "company.registrationNumber", label: "Registration number", group: "company", isPublic: true, kind: "text" },
  { key: "social.linkedin", label: "LinkedIn URL", group: "social", isPublic: true, kind: "url" },
  { key: "social.x", label: "X (Twitter) URL", group: "social", isPublic: true, kind: "url" },
  { key: "notifications.adminRecipients", label: "Enquiry notification recipients (comma-separated emails)", group: "notifications", isPublic: false, kind: "text" },
] as const;
export type EditableSettingKey = (typeof EDITABLE_SETTINGS)[number]["key"];

/** The caller's membership in the Quantara STAFF organization, or null (= not staff). Read from the database only. */
export async function getStaffMembership(db: PrismaClient, userId: string): Promise<{ organizationId: string; role: string } | null> {
  const m = await db.member.findFirst({ where: { userId, organization: { type: "STAFF" } }, select: { organizationId: true, role: true } });
  return m ? { organizationId: m.organizationId, role: m.role } : null;
}

/** Give an existing user a role in the STAFF organization (used by the grant-staff command). Idempotent. */
export async function grantStaffRole(db: PrismaClient, email: string, role: string, now = new Date()): Promise<{ userId: string; organizationId: string; role: string }> {
  if (!isRoleKey(role)) throw new Error(`Unknown role "${role}"`);
  const user = await db.user.findFirst({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw new Error(`No user with email ${email}. Sign up first, then run this again.`);
  const org = await db.organization.findFirst({ where: { type: "STAFF" }, select: { id: true } });
  if (!org) throw new Error("No STAFF organization exists. Run the seed first (pnpm --filter @quantara/db seed).");
  await db.member.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { role },
    create: { id: `mem_${randomUUID()}`, organizationId: org.id, userId: user.id, role, createdAt: now },
  });
  await db.auditLog.create({ data: { organizationId: org.id, actorType: "system", action: "staff.role.granted", resourceType: "user", resourceId: user.id, metadata: { role } } });
  return { userId: user.id, organizationId: org.id, role };
}

export interface EnquiryListItem { id: string; referenceId: string; fullName: string; businessEmail: string; organization: string; status: EnquiryStatusValue; spamScore: number; createdAt: Date; service: { title: string } | null }
export interface EnquiryListOptions { status?: EnquiryStatusValue; page?: number; pageSize?: number }
export async function listEnquiries(db: PrismaClient, opts: EnquiryListOptions = {}): Promise<{ items: EnquiryListItem[]; total: number; page: number; pageSize: number; pages: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const where = opts.status ? { status: opts.status } : {};
  const [items, total] = await Promise.all([
    db.contactEnquiry.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, referenceId: true, fullName: true, businessEmail: true, organization: true, status: true, spamScore: true, createdAt: true, service: { select: { title: true } } },
    }),
    db.contactEnquiry.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getEnquiry(db: PrismaClient, id: string) {
  return db.contactEnquiry.findUnique({ where: { id }, include: { service: { select: { title: true } }, industry: { select: { title: true } } } });
}

export async function setEnquiryStatus(db: PrismaClient, id: string, status: EnquiryStatusValue, actorId: string, organizationId: string | null): Promise<boolean> {
  if (!ENQUIRY_STATUSES.includes(status)) throw new Error("Invalid enquiry status");
  return db.$transaction(async (tx: Pick<PrismaClient, "contactEnquiry" | "auditLog">) => {
    const current = await tx.contactEnquiry.findUnique({ where: { id }, select: { status: true } });
    if (!current) return false;
    await tx.contactEnquiry.update({ where: { id }, data: { status, ...(status === "ACKNOWLEDGED" ? { acknowledgedAt: new Date() } : {}) } });
    await tx.auditLog.create({ data: { organizationId, actorId, action: "enquiry.status.changed", resourceType: "contact_enquiry", resourceId: id, metadata: { from: current.status, to: status } } });
    return true;
  });
}

export async function getSettings(db: PrismaClient): Promise<Record<string, string>> {
  const rows = await db.siteSetting.findMany({ where: { key: { in: EDITABLE_SETTINGS.map((s) => s.key) } }, select: { key: true, value: true } });
  const out: Record<string, string> = {};
  for (const r of rows) if (typeof r.value === "string") out[r.key] = r.value;
  return out;
}

/** Public settings only (safe to render on the website). */
export async function getPublicSettings(db: PrismaClient): Promise<Record<string, string>> {
  const rows = await db.siteSetting.findMany({ where: { isPublic: true, key: { in: EDITABLE_SETTINGS.map((s) => s.key) } }, select: { key: true, value: true } });
  const out: Record<string, string> = {};
  for (const r of rows) if (typeof r.value === "string" && r.value) out[r.key] = r.value;
  return out;
}

export type SettingsInput = Partial<Record<EditableSettingKey, string>>;
/** Validates and saves only known keys. Empty value removes the setting. Returns the keys that changed. */
export function validateSettings(input: SettingsInput): { values: Record<string, string>; errors: Record<string, string> } {
  const values: Record<string, string> = {}; const errors: Record<string, string> = {};
  for (const def of EDITABLE_SETTINGS) {
    const raw = input[def.key]; if (raw === undefined) continue;
    const v = raw.trim();
    if (v.length > 1000) { errors[def.key] = "Too long (max 1000 characters)"; continue; }
    if (v && def.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[def.key] = "Enter a valid email address";
    else if (v && def.kind === "url" && !/^https:\/\/[^\s]+$/.test(v)) errors[def.key] = "Enter a full https:// address";
    else if (def.key === "notifications.adminRecipients" && v && !v.split(",").every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()))) errors[def.key] = "Enter valid, comma-separated email addresses";
    else values[def.key] = v;
  }
  return { values, errors };
}

export async function saveSettings(db: PrismaClient, values: Record<string, string>, actorId: string, organizationId: string | null): Promise<string[]> {
  const known = new Map(EDITABLE_SETTINGS.map((s) => [s.key as string, s]));
  const changed: string[] = [];
  await db.$transaction(async (tx: Pick<PrismaClient, "siteSetting" | "auditLog">) => {
    for (const [key, value] of Object.entries(values)) {
      const def = known.get(key); if (!def) continue;
      const existing = await tx.siteSetting.findUnique({ where: { key }, select: { value: true } });
      if (!value) {
        if (existing) { await tx.siteSetting.delete({ where: { key } }); changed.push(key); }
        continue;
      }
      if (existing?.value === value) continue;
      await tx.siteSetting.upsert({ where: { key }, update: { value, updatedBy: actorId }, create: { key, value, group: def.group, isPublic: def.isPublic, updatedBy: actorId } });
      changed.push(key);
    }
    // Audit log records WHICH settings changed, never the values.
    if (changed.length) await tx.auditLog.create({ data: { organizationId, actorId, action: "site.settings.updated", resourceType: "site_setting", metadata: { keys: changed } } });
  });
  return changed;
}
