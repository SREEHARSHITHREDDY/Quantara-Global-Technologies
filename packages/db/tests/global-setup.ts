// Creates a throw-away database, applies the REAL migrations, seeds it, and drops it afterwards.
// STATUS: unverified. Needs PostgreSQL + a role with CREATEDB + Prisma engines.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const root = join(import.meta.dirname, "..");
const baseUrl = (() => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const f = join(root, ".env");
  const m = existsSync(f) ? readFileSync(f, "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m) : null;
  if (!m) throw new Error("Set DATABASE_URL (see docs/LOCAL_DATABASE_SETUP.md)");
  return m[1]!;
})();
const dbName = `quantara_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const withDb = (name: string) => { const u = new URL(baseUrl); u.pathname = `/${name}`; return u.toString(); };

export async function setup() {
  const migs = join(root, "prisma", "migrations");
  if (!existsSync(migs) || readdirSync(migs).filter((d) => /^\d{14}_/.test(d)).length < 2)
    throw new Error("Migrations missing. Run `pnpm db:setup` first so init + constraints migrations exist.");
  const admin = new Client({ connectionString: withDb("postgres") });
  await admin.connect(); await admin.query(`CREATE DATABASE "${dbName}"`); await admin.end();
  process.env.TEST_DATABASE_URL = withDb(dbName);
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL };
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { cwd: root, env, stdio: "inherit" });
  execFileSync("pnpm", ["exec", "tsx", "src/seed/run.ts"], { cwd: root, env, stdio: "inherit" });
}
export async function teardown() {
  const admin = new Client({ connectionString: withDb("postgres") });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.end();
}
