#!/usr/bin/env node
// One-shot local setup. Run from the repo root:  pnpm db:setup
// Needs: running PostgreSQL, DATABASE_URL in packages/db/.env, Prisma engines downloadable.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrations = join(root, "prisma", "migrations");
const run = (args) => execFileSync("pnpm", ["exec", "prisma", ...args], { cwd: root, stdio: "inherit", env: process.env });

if (!process.env.DATABASE_URL && existsSync(join(root, ".env"))) {
  const m = readFileSync(join(root, ".env"), "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m);
  if (m) process.env.DATABASE_URL = m[1];
}
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set (packages/db/.env)."); process.exit(1); }

mkdirSync(migrations, { recursive: true });
const existing = () => readdirSync(migrations).filter((d) => /^\d{14}_/.test(d)).sort();

// 1. Prisma-generated init migration (only if none exists yet)
if (existing().length === 0) {
  console.log("→ generating init migration from schema.prisma");
  run(["migrate", "dev", "--name", "init"]); // Prisma 7: no implicit seed/generate, so no flags needed
}
// 2. Our SQL supplement as a separate, later migration (only once)
if (!existing().some((d) => d.endsWith("_constraints"))) {
  const last = existing().at(-1);
  const ts = String(Number(last.slice(0, 14)) + 1); // sorts immediately after the last migration
  const dir = join(migrations, `${ts}_constraints`);
  mkdirSync(dir, { recursive: true });
  cpSync(join(root, "sql", "constraints.sql"), join(dir, "migration.sql"));
  console.log("→ added", dir);
}
// 3. Apply everything, generate client, seed
run(["migrate", "deploy"]);
run(["generate"]);
execFileSync("pnpm", ["run", "seed"], { cwd: root, stdio: "inherit", env: process.env });
console.log("\n✔ Database ready. Now run the integration tests:  pnpm --filter @quantara/db test:integration");
console.log("  Commit packages/db/prisma/migrations/ so deployments use the same migrations.");
