import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { privacy, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };
export default function Page() { return <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED} intro={privacy.intro} sections={privacy.sections} />; }
