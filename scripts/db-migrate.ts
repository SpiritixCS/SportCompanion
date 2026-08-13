import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";
import { knownUsers } from "../src/lib/auth/users";

const migrationsDir = path.join(process.cwd(), "migrations");

for (const user of knownUsers()) {
  const db = getDb(user.dbPath);
  const { applied } = runMigrations(db, migrationsDir);
  db.close();

  if (applied.length === 0) {
    console.log(`[${user.slug}] No pending migrations.`);
  } else {
    console.log(`[${user.slug}] Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }
}
