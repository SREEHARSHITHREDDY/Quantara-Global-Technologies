# Running migrations and database tests on your machine

> **Why this is needed.** The cloud sandbox this project was built in cannot download Prisma's migration
> engine (`binaries.prisma.sh` is blocked by its network policy). Everything database-dependent is therefore
> **UNVERIFIED** until you complete the steps below. See `STATUS.md` for the exact list.

## Prerequisites
| Need | Version | Check |
|---|---|---|
| Node.js | ≥ 22.12 | `node -v` |
| pnpm | ≥ 10 | `pnpm -v` (`corepack enable` if missing) |
| PostgreSQL **server, running** | 16 (14+ should work) | `pg_isready` must say *accepting connections* |
| Internet access to `binaries.prisma.sh` and the npm registry | — | needed once, to fetch Prisma's migration engine |
| A DB role with `CREATEDB` | — | the test harness creates and drops a throw-away database per run |

`psql` being installed does **not** mean a server is running. Always confirm with `pg_isready`.

## 1. Create the database and role (once)
```bash
psql -U postgres -c "CREATE ROLE quantara WITH LOGIN PASSWORD 'choose-a-password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE quantara OWNER quantara;"
```

## 2. Install and configure
```bash
cd quantara
pnpm install
cp packages/db/.env.example packages/db/.env      # then edit the password in DATABASE_URL
```

## 3. Validate the schema (works offline; already passes in the sandbox)
```bash
pnpm db:validate        # expect: SCHEMA VALID, models=55 enums=27
```

## 4. Create migrations, apply them, generate the client, seed
```bash
pnpm db:setup
```
This runs, in order:
1. `prisma migrate dev --name init` → generates `prisma/migrations/<timestamp>_init/` from `schema.prisma` (only if no migrations exist yet)
2. copies `sql/constraints.sql` to a second migration `<timestamp+1>_constraints/` (CHECK constraints, triggers, immutable audit log)
3. `prisma migrate deploy` → applies both
4. `prisma generate` → creates `src/generated/` (git-ignored)
5. `pnpm --filter @quantara/db seed` → loads profile content, roles/permissions, statistics (unpublished), disabled integrations

**Expected result:** exits 0 and prints `✔ Database ready`.
Seed counts to expect: 9 services, 48 capabilities, 10 industries, 7 roles in the staff organization, 13 statistics (0 published).

**Commit `packages/db/prisma/migrations/`** afterwards: deployments must use these exact files.

## 5. Typecheck the DB layer (needs the generated client)
```bash
pnpm typecheck:db
```

## 6. Run the database integration tests
```bash
pnpm test:db
```
Each run creates a fresh `quantara_test_*` database, applies the real migrations, seeds it, runs the tests, then drops it.
**Expected:** 2 files, 31 tests, all passing. This suite is what turns the "unverified" items in `STATUS.md` into "verified".

## 7. Confirm migrations are in sync
```bash
cd packages/db && pnpm exec prisma migrate status
```
Expect *Database schema is up to date*. Optionally run `pnpm exec prisma migrate diff --help` and diff the migrated database against `schema.prisma` (flag spelling varies by Prisma version; CHECK constraints and triggers are invisible to Prisma and expected).

## Optional: see the sourced statistics on the site while developing
```bash
SEED_PUBLISH_STATS=1 pnpm db:seed
```
Marks the 5 sourced statistics as published and verified by `dev-seed (unreviewed)`. Dev only. In production a human must verify each statistic against its source in the admin portal.

## If something fails
| Symptom | Likely cause / fix |
|---|---|
| `P1001 Can't reach database server` | Server not running → `pg_isready`; check host/port in `DATABASE_URL` |
| `P1000 Authentication failed` | Wrong password in `packages/db/.env` |
| `permission denied to create database` (tests) | Role lacks `CREATEDB` → `ALTER ROLE quantara CREATEDB;` |
| `Failed to fetch sha256 checksum … binaries.prisma.sh` | Network/proxy blocks Prisma downloads on your machine too |
| `migrate dev` says the database is not empty / drift | Use a fresh empty database for the first run |
| Unknown flag errors from `prisma` | Prisma CLI version differs from 7.10.1 → `pnpm install` to pin |
| Any test failure | **Send me the full output** (first failing test + stack). Do not edit tests to make them pass. |
