import { ALL_PERMISSIONS, type Permission } from "./permissions";

export type RoleKey =
  | "super_admin" | "admin" | "content_manager" | "hr_manager"
  | "bd_manager" | "ai_platform_admin" | "council_user";

export interface RoleDefinition { key: RoleKey; name: string; description: string; permissions: readonly Permission[] }

const council: Permission[] = ["council:use", "council:document:upload", "council:report:export"];

export const ROLES: Record<RoleKey, RoleDefinition> = {
  super_admin: { key: "super_admin", name: "Super Administrator", description: "Unrestricted within the organization.", permissions: ALL_PERMISSIONS },
  admin: { key: "admin", name: "Administrator", description: "Manages the organization, its members and day-to-day operations.", permissions: [
    "site:settings:read","site:settings:write","content:write","content:publish","insight:write","insight:publish",
    "enquiry:read","enquiry:manage","lead:read","lead:write","lead:assign","lead:note","newsletter:read","newsletter:export",
    "job:write","job:publish","application:read","application:manage","application:resume:download","analytics:read","audit:read",
    "ai:usage:read","user:read","user:invite","user:manage","user:suspend",
    ...council, "council:history:read:org","council:approval:decide"] },
  content_manager: { key: "content_manager", name: "Content Manager", description: "Website content and insights.", permissions: [
    "site:settings:read","content:write","content:publish","insight:write","insight:publish","analytics:read"] },
  hr_manager: { key: "hr_manager", name: "HR Manager", description: "Careers and candidate applications.", permissions: [
    "job:write","job:publish","application:read","application:manage","application:resume:download"] },
  bd_manager: { key: "bd_manager", name: "Business Development Manager", description: "Enquiries, leads and newsletter.", permissions: [
    "enquiry:read","enquiry:manage","lead:read","lead:write","lead:assign","lead:note","newsletter:read","analytics:read"] },
  ai_platform_admin: { key: "ai_platform_admin", name: "AI Platform Administrator", description: "AI providers, agents and usage.", permissions: [
    "ai:provider:manage","ai:agent:configure","ai:usage:read","integration:manage","audit:read","council:history:read:org"] },
  council_user: { key: "council_user", name: "Executive Council User", description: "Uses the Executive Council with private history.", permissions: council },
};
export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];
export const isRoleKey = (k: string): k is RoleKey => k in ROLES;
