# Deployment guide

Status: this describes what the code needs. It has **not** been rehearsed on a hosting platform. Treat the first deployment as a staging run.

## Requirements
Node 22.12+, pnpm 10, PostgreSQL 15 or 16 (tested on 15), HTTPS in front of the web app, one long-running process each for web and worker.

## Environment variables
| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (web, worker, scripts) | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | Public site URL, for example `https://www.example.com` |
| `NEXT_PUBLIC_SITE_URL` | yes | Same public URL |
| `APP_IP_HASH_SALT` | yes in production | `openssl rand -hex 32`; hashes visitor IPs for abuse limiting |
| `RESUME_STORAGE_DIR` | yes in production | Private, persistent directory not served by the site |
| `MAIL_FROM`, `RESEND_API_KEY` | for email | Verification and reset emails; domain must be verified in Resend. Without them no email is sent. |
| `COUNCIL_ENABLE_MOCK` | demos only | Set to `1` to allow the Mock provider in production |
| `COUNCIL_DEFAULT_PLAN` | optional | Plan for NEW customer workspaces: blank or `STANDARD` = open to everyone (live preview), `TRIAL` = time-limited (`COUNCIL_DEFAULT_TRIAL_DAYS`, default 14), `DISABLED` = closed. Anything else closes it. |
| `COUNCIL_ALLOW_SELF_APPROVAL` | optional | Set to `1` only if one person must approve their own requests (for example a solo owner); off by default |
| `COUNCIL_MOCK_SCENARIO` | optional | Worker scenario; blank means success |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `S3_*`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `APP_ENCRYPTION_KEY` | not used yet | Reserved for features not built |

See `.env.example`. Never commit `.env`.

## Steps
```
pnpm install --frozen-lockfile
pnpm db:migrate                 # applies migrations (prisma migrate deploy)
pnpm db:seed                    # roles, services, industries, statistics, disabled integrations
pnpm --filter @quantara/web build
pnpm --filter @quantara/web start      # process 1: web (set PORT as needed)
pnpm --filter @quantara/worker start   # process 2: worker (must share DATABASE_URL)
```
The worker must run, or consultations stay queued. Run both under a process supervisor so they restart on failure.

## First-time setup
1. Create your account on the site and verify the email.
2. Make yourself staff: `pnpm --filter @quantara/db staff:grant -- you@example.com super_admin`.
3. Sign in at `/staff`, then open `/admin`.
4. Enable the Council for a customer workspace: `pnpm --filter @quantara/db council:plan -- customer@example.com TRIAL 14`.
5. Enter real contact details in admin Settings.

## Deploying the website on Vercel
Vercel runs the **website only**. The worker, the database and file storage need other homes (see below).
* **Project settings:** Root Directory `apps/web`, Framework Next.js, Node.js Version 22.x, install command left as default (`pnpm install`). The build script generates the Prisma client first, so no extra build command is needed.
* **Environment variables** (Production): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL` (both the final public URL), `APP_IP_HASH_SALT`, `RESEND_API_KEY`, `MAIL_FROM`, `COUNCIL_ENABLE_MOCK=1` (preview). Set them before the first deploy.
* **Database:** a hosted PostgreSQL (Neon, Supabase or similar). Use its pooled connection string for `DATABASE_URL` on Vercel. Run migrations and seed once from your computer against it: `DATABASE_URL="..." pnpm db:migrate && DATABASE_URL="..." pnpm db:seed`.
* **Worker:** Vercel cannot run it. Run `pnpm --filter @quantara/worker start` as an always-on process on a service such as Railway, Render or Fly, with the same `DATABASE_URL` and `COUNCIL_ENABLE_MOCK=1`. Without it, consultations stay queued.
* **Resume uploads:** Vercel's disk is temporary, so job applications with a resume are refused until object storage (S3) support is built. The rest of the Careers page works.
* **Live progress:** the progress stream may be cut by the platform's time limit; the page reconnects and resumes from where it stopped, so no events are lost.

## Opening the Council to everyone (live preview)
New workspaces are open by default (`COUNCIL_DEFAULT_PLAN` blank). For a public demo set `COUNCIL_ENABLE_MOCK=1` on **both** web and worker: without it the Mock provider is off in production and the Council reports "not available". Every answer is then labelled as a simulation and the Council page shows a Preview notice.
Workspaces that already exist keep their plan. To open all of those that are still closed: `pnpm --filter @quantara/db council:plan -- --all STANDARD`.
When you add real AI keys or start charging, set `COUNCIL_DEFAULT_PLAN=DISABLED` (or `TRIAL`) on web before real keys go live, and review per-workspace budgets in Admin, Council, so open access cannot run up AI costs.

## Email with Resend
1. In Resend, add the domain `quantaraglobaltech.com` (Domains, Add domain).
2. Resend shows DNS records (SPF, DKIM and optionally DMARC). Add them where the domain's DNS is managed, then press Verify. This can take minutes to hours.
3. Create an API key (API Keys, Create, "Sending access") and put it in `RESEND_API_KEY`.
4. Set `MAIL_FROM` to an address on that domain, for example `cto@quantaraglobaltech.com`. The mailbox does not have to exist to send, but replies go to it, so it should.
5. Restart web. Sign up with a real address and confirm the verification email arrives (check spam).
Until a domain is verified, Resend only delivers to your own account email, and in development the site prints emails to the server console instead.

## Contact details
`pnpm --filter @quantara/db settings:set -- <staff-email> contact.email=... contact.careersEmail=... contact.phone=...` saves them through the same audited path as the admin Settings form. An empty value removes a setting.

## Health and monitoring
`GET /api/health` is a liveness check only. Monitor the worker process separately and watch the database for queued consultations that do not progress.

## Backups and recovery
Back up PostgreSQL on a schedule and test a restore. `AuditLog` rows cannot be deleted by the application; any retention purge needs a DBA procedure.

## Launch checklist
- [ ] Staging run completed with HTTPS and both processes
- [ ] Check chain green against the production PostgreSQL major version
- [ ] Secrets generated and stored outside git
- [ ] Email domain verified; a real verification email received
- [ ] Contact details, legal pages and registration details reviewed by counsel
- [ ] Pages reviewed in a browser at desktop and mobile widths
- [ ] Mock provider labelled "simulated" confirmed on screen, or real provider adapters built and keys added
- [ ] Backup and restore tested
