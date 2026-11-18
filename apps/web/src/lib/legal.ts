import type { LegalSection } from "@/components/site/legal-page";

// WORKING TEXT. Describes what the site does today and makes no claims beyond that. It has not been reviewed by
// counsel and must be before launch. Update it in the same change that adds cookies, analytics or other processing.
export const LEGAL_UPDATED = "18 November 2026";

export const privacy = {
  intro: "This policy explains what personal information Quantara Technologies collects through this website, why, and the choices you have.",
  sections: [
    { heading: "Information we collect", body: [
      "When you submit the contact form we collect the details you enter: your name, business email, organization, job designation, country, optional phone number, the service and industry you select, your project requirements, timeline and any additional information.",
      "We also record the date and time of your consent, the version of the consent wording you agreed to, your browser's user-agent string, and a one-way hash of your network address that we use to limit abuse. We do not store your network address itself.",
    ] },
    { heading: "How we use it", body: [
      "We use your enquiry information to review your request and respond to you, and to keep a record of the enquiry. We use the abuse-prevention data only to detect spam and excessive submissions.",
    ] },
    { heading: "Sharing", body: [
      "We do not sell your personal information. We may use service providers that host or operate this website and our systems on our behalf, and we may disclose information where the law requires it.",
    ] },
    { heading: "Retention", body: ["We keep enquiry information only for as long as it is needed to respond to you and to maintain our business records, and then delete or anonymize it."] },
    { heading: "Your choices", body: [
      "You may ask us to access, correct or delete the personal information we hold about you, or to withdraw your consent, by contacting us through the Contact page and quoting your reference number if you have one.",
    ] },
    { heading: "Cookies", body: ["Our Cookie Policy explains how this website uses cookies and similar technologies."] },
    { heading: "Changes", body: ["We may update this policy. The date at the top shows when it was last changed."] },
  ] satisfies LegalSection[],
};

export const terms = {
  intro: "These terms apply to your use of the Quantara Technologies website. By using the website you agree to them.",
  sections: [
    { heading: "Use of the website", body: ["You may use this website for lawful purposes only. You must not attempt to disrupt it, gain unauthorized access to it, or submit false or abusive content."] },
    { heading: "Information on this website", body: ["The content on this website is provided for general information. It does not constitute professional advice or an offer, and descriptions of services do not create a commitment to supply them. Any engagement is governed by a separate written agreement."] },
    { heading: "Third-party information", body: ["Where we cite statistics or findings from third parties, we attribute them to the original source with its publication date. They are the sources' statements, not claims by Quantara Technologies."] },
    { heading: "Intellectual property", body: ["The content, design and trademarks on this website belong to Quantara Technologies or its licensors. You may not reproduce them without permission, except as the law allows."] },
    { heading: "Disclaimer and liability", body: ["The website is provided as is. To the extent the law allows, we are not liable for loss arising from your use of the website or reliance on its content."] },
    { heading: "Changes", body: ["We may update these terms. The date at the top shows when they were last changed."] },
  ] satisfies LegalSection[],
};

export const cookies = {
  intro: "This policy explains how this website uses cookies and similar technologies.",
  sections: [
    { heading: "What we use today", body: ["At the time of writing, this public website does not set cookies and does not use analytics or advertising trackers. The contact form does not use cookies."] },
    { heading: "If this changes", body: ["If we add cookies or analytics, we will describe each one here, and we will ask for your consent before setting any that are not strictly necessary."] },
    { heading: "Your browser", body: ["You can control or delete cookies through your browser settings."] },
  ] satisfies LegalSection[],
};
