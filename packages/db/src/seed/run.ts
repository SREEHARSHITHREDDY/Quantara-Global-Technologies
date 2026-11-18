import "dotenv/config";
import { createPrisma } from "../index";
import { seedAll } from "./seed";

const db = createPrisma();
const publish = process.env.SEED_PUBLISH_STATS === "1" && process.env.NODE_ENV !== "production";
seedAll(db, { publishSourcedStatistics: publish, log: (m) => console.log("[seed]", m) })
  .then(() => console.log("[seed] done"))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
