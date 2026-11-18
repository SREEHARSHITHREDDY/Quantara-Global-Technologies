// Authoritative text from "Quantara Technologies – Corporate Profile – 2026 Edition" (July 2026).
// Contact details, addresses, leadership, clients, offices and history are intentionally ABSENT:
// the profile does not contain them. They live in SiteSetting rows managed through the CMS.

export const company = {
  name: "Quantara Technologies",
  tagline: "Engineering Intelligent Enterprises for the AI & Quantum Era",
  supportingTagline: "Transform Faster. Innovate Smarter. Lead Confidently.",
  closingTagline: "Engineering Intelligence. Accelerating Growth. Creating Lasting Value.",
  focusAreas: [
    "Artificial Intelligence",
    "Quantum Computing & Emerging Technologies",
    "Global Capability Centers",
    "Datacenter & Cloud Infrastructure",
  ],
  aboutHeadline: "Building the Future of Intelligent Business",
  about: [
    "Quantara Technologies is a next-generation technology consulting and digital engineering company dedicated to helping enterprises navigate the convergence of AI, quantum computing, and intelligent infrastructure.",
    "We combine strategic consulting, advanced engineering, and deep industry expertise to design intelligent solutions that solve complex business challenges — from agentic AI and quantum-ready architectures to Global Capability Center (GCC) enablement and next-generation datacenter modernization. Our engagements deliver measurable outcomes that drive sustained competitive advantage.",
    "Our team of experienced consultants, architects, data scientists, quantum researchers, and engineers works closely with clients to transform bold ideas into real-world enterprise impact.",
  ],
  vision:
    "To become one of the world's most trusted AI, quantum, and digital transformation partners — empowering every enterprise to become intelligent, autonomous, and future-ready.",
  mission:
    "To create innovative, secure, and scalable technology solutions — spanning AI, emerging technologies, and enterprise infrastructure — that accelerate business growth, improve customer experience, and deliver measurable value.",
  ctaHeadline: "Let's Build the Future Together",
  ctaBody:
    "Whether you're modernizing legacy systems, adopting AI and quantum-ready architectures, scaling a Global Capability Center, or transforming your datacenter footprint — Quantara Technologies is your trusted partner for transformation.",
} as const;

export const coreValues = [
  { name: "Innovation", description: "Constantly exploring new possibilities across AI, quantum, and digital frontiers." },
  { name: "Integrity", description: "Building trust through transparency and accountability." },
  { name: "Excellence", description: "Delivering exceptional quality in everything we do." },
  { name: "Customer Success", description: "Putting client outcomes at the center of every engagement." },
  { name: "Collaboration", description: "Working together to achieve extraordinary results." },
  { name: "Sustainability", description: "Creating technology that supports long-term business and societal impact." },
] as const;

export const approachSteps = [
  { step: 1, name: "Discover", description: "Understand business challenges, technology landscape, and identify opportunities across AI, quantum, and infrastructure." },
  { step: 2, name: "Design", description: "Create innovative, scalable, and secure digital and quantum-ready solutions tailored to enterprise goals." },
  { step: 3, name: "Build", description: "Deliver high-quality platforms and products using agile, engineering-led delivery methods." },
  { step: 4, name: "Deploy", description: "Implement with minimal disruption, strong governance, and maximum business value." },
  { step: 5, name: "Optimize", description: "Continuously improve performance through AI-driven insights and emerging-technology innovation." },
] as const;

export const whyQuantara = [
  { name: "AI-First, Quantum-Ready Delivery", description: "Every engagement is architected for intelligent automation today and quantum-scale advantage tomorrow." },
  { name: "Business Outcome Focus", description: "Solutions are measured by enterprise impact, not just technical delivery." },
  { name: "Enterprise-Grade Security", description: "Zero-trust, quantum-safe, and compliance-first by design." },
  { name: "Scalable Global Delivery", description: "Distributed delivery model supported by GCC and datacenter expertise." },
  { name: "Industry-Specific Expertise", description: "Deep domain knowledge across ten priority industry verticals." },
  { name: "Innovation-Driven Culture", description: "Continuous exploration of emerging technologies and new possibilities." },
  { name: "Agile & Collaborative Teams", description: "Cross-functional pods working in close partnership with client stakeholders." },
  { name: "Long-Term Strategic Partnerships", description: "Built for sustained transformation, not one-off projects." },
] as const;

/** Keys of SiteSetting rows the CMS must provide. Values are never hardcoded. */
export const requiredSiteSettings = [
  "contact.email", "contact.phone", "contact.address", "company.legalName",
  "company.registrationNumber", "social.linkedin", "social.x", "leadership.profiles",
  "analytics.googleAnalyticsId", "notifications.adminRecipients",
] as const;
