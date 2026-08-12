import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
const migrationsDir = path.join(process.cwd(), "migrations");

const db = getDb(dbPath);
const { applied } = runMigrations(db, migrationsDir);
db.close();

if (applied.length === 0) {
  console.log("No pending migrations.");
} else {
  console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
}
