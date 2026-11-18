# Quantara platform

Corporate website, Executive AI Council and admin portal for Quantara Technologies. Monorepo (pnpm).

| Path | What |
|---|---|
| `apps/web` | Next.js 16 app (public site, Council, admin) |
| `packages/content` | Company/service/industry content from the corporate profile, plus sourced market statistics |
| `packages/rbac` | Permission registry, role matrix, `can()` |
| `packages/auth` | Better Auth configuration (verification, reset, MFA, orgs, invitations, bans) |
| `packages/db` | Prisma schema, SQL supplement, seed, DB integration tests |
| `workers/jobs` | Separately deployable pg-boss worker (long-running AI/doc/email jobs) |
| `docs/` | `LOCAL_DATABASE_SETUP.md`, `DATABASE.md` |

**Read `STATUS.md` first**: it states exactly what is verified, unverified, mocked or not built.

```bash
pnpm install
pnpm verify:offline      # schema validation, typecheck, unit tests, production build (no database needed)
# database steps: docs/LOCAL_DATABASE_SETUP.md
```
