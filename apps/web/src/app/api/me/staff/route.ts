import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getPrisma, getStaffMembership } from "@quantara/db";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Tells the signed-in caller whether they are staff, so the header can show an Admin link. Reveals nothing about anyone else. */
export async function GET() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const isStaff = session ? !!(await getStaffMembership(getPrisma(), session.user.id)) : false;
  return NextResponse.json({ isStaff }, { headers: { "Cache-Control": "private, no-store" } });
}
