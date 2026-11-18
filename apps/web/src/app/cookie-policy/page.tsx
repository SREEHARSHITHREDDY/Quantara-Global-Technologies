import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { cookies, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookie Policy" };
export default function Page() { return <LegalPage title="Cookie Policy" updated={LEGAL_UPDATED} intro={cookies.intro} sections={cookies.sections} />; }
