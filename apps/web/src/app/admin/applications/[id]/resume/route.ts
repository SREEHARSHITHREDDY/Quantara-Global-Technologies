import { NextResponse } from "next/server";
import { auditResumeDownload, getPrisma } from "@quantara/db";
import { can } from "@quantara/rbac";
import { requireStaff } from "@/lib/admin";
import { getResumeStorage } from "@/server/resume-storage";

export const dynamic = "force-dynamic";

/** Staff-only resume download. Every download is written to the audit log. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("application:resume:download");
  if (!can(s.ctx, "application:resume:download")) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const db = getPrisma();
  const a = await db.jobApplication.findUnique({ where: { id }, select: { resumeStorageKey: true, resumeFilename: true, resumeMimeType: true } });
  const storage = getResumeStorage();
  const bytes = a && storage ? await storage.get(a.resumeStorageKey) : null;
  if (!a || !bytes) return new NextResponse("Not found", { status: 404 });
  await auditResumeDownload(db, id, s.userId, s.organizationId);
  return new NextResponse(Buffer.from(bytes), { headers: {
    "Content-Type": a.resumeMimeType,
    "Content-Disposition": `attachment; filename="${a.resumeFilename.replace(/[^\w. -]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
  } });
}
