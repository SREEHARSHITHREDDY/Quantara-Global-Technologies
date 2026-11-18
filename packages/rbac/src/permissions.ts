/** Single source of truth for permission keys. */
export const PERMISSIONS = {
  // Platform (valid only inside a STAFF organization)
  "site:settings:read": "Read site settings",
  "site:settings:write": "Change site settings (contact details, leadership, etc.)",
  "content:write": "Edit pages, services, industries",
  "content:publish": "Publish page/service/industry changes",
  "insight:write": "Create and edit insights",
  "insight:publish": "Publish insights",
  "enquiry:read": "Read contact enquiries",
  "enquiry:manage": "Archive / mark enquiries",
  "lead:read": "Read leads",
  "lead:write": "Change lead status",
  "lead:assign": "Assign leads",
  "lead:note": "Add internal lead notes",
  "newsletter:read": "View newsletter subscribers",
  "newsletter:export": "Export subscribers",
  "job:write": "Create and edit job posts",
  "job:publish": "Publish job posts",
  "application:read": "Read job applications",
  "application:manage": "Change application status",
  "application:resume:download": "Download candidate resumes",
  "analytics:read": "View platform analytics",
  "integration:manage": "Configure integrations",
  "audit:read": "Read the audit log",
  "ai:provider:manage": "Manage AI providers and credentials",
  "ai:agent:configure": "Configure executive agents",
  "ai:usage:read": "Read AI usage and cost",
  "org:manage": "Create / suspend organizations",
  // Organization-scoped (valid in any organization)
  "user:read": "List members of the organization",
  "user:invite": "Invite users to the organization",
  "user:manage": "Change member roles",
  "user:suspend": "Suspend / reinstate members",
  "council:use": "Use the Executive Council",
  "council:document:upload": "Upload documents to the Council",
  "council:history:read:org": "Read all Council history in the organization",
  "council:approval:decide": "Approve or reject agent-prepared actions",
  "council:report:export": "Export Council reports",
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permissions that only make sense inside the Quantara STAFF organization. */
export const PLATFORM_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "site:settings:read","site:settings:write","content:write","content:publish","insight:write","insight:publish",
  "enquiry:read","enquiry:manage","lead:read","lead:write","lead:assign","lead:note","newsletter:read","newsletter:export",
  "job:write","job:publish","application:read","application:manage","application:resume:download",
  "analytics:read","integration:manage","audit:read","ai:provider:manage","ai:agent:configure","ai:usage:read","org:manage",
]);
