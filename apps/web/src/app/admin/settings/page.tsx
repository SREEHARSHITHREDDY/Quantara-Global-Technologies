import type { Metadata } from "next";
import { EDITABLE_SETTINGS, getPrisma, getSettings } from "@quantara/db";
import { can } from "@quantara/rbac";
import { Card } from "@/components/ui/layout";
import { requireStaff } from "@/lib/admin";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Site settings" };

export default async function SettingsPage() {
  const s = await requireStaff("site:settings:read");
  const values = await getSettings(getPrisma());
  const fields = EDITABLE_SETTINGS.map((d) => ({ key: d.key, label: d.label, kind: d.kind, value: values[d.key] ?? "" }));
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">Site settings</h1>
      <p className="text-sm text-slate-600">Contact and company details shown on the website. Leave a field empty to remove it. Nothing here is hardcoded in the site.</p>
      <Card><SettingsForm fields={fields} canWrite={can(s.ctx, "site:settings:write")} /></Card>
    </div>
  );
}
