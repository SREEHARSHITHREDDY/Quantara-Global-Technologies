import { NextResponse } from "next/server";
import type { ServiceError } from "@/server/council-service";

const NO_STORE = { "Cache-Control": "private, no-store" };
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
export const fail = (e: ServiceError) => json({ error: { code: e.code, message: e.message, ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) } }, e.status);
export const unauthorized = () => json({ error: { code: "unauthorized", message: "Please sign in." } }, 401);
