import { existsSync, readFileSync } from "node:fs";
// Minimal .env loader for local runs (production injects real environment variables).
for (const f of [".env", "../../packages/db/.env"]) if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/); if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!; }
