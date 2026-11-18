import type { Metadata } from "next";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
export const metadata: Metadata = { title: "Two-factor verification", robots: { index: false } };
export default function Page() { return <TwoFactorForm />; }
