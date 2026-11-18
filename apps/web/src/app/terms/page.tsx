import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { terms, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Use" };
export default function Page() { return <LegalPage title="Terms of Use" updated={LEGAL_UPDATED} intro={terms.intro} sections={terms.sections} />; }
