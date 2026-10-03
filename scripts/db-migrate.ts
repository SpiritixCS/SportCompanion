import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { getDb, migrationsDir } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";
import { dataDir } from "../src/lib/auth/email";

const usersDir = path.join(dataDir(), "users");
const files = existsSync(usersDir) ? readdirSync(usersDir).filter((f) => f.endsWith(".db")) : [];

for (const file of files) {
  const db = getDb(path.join(usersDir, file));
  const { applied } = runMigrations(db, migrationsDir());
  db.close();
  console.log(applied.length === 0 ? `[${file}] No pending migrations.` : `[${file}] Applied ${applied.length} migration(s): ${applied.join(", ")}`);
}
