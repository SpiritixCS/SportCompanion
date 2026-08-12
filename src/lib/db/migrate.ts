import type Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function runMigrations(
  db: Database.Database,
  migrationsDir: string,
): { applied: string[] } {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const alreadyApplied = new Set(
    (db.prepare("SELECT filename FROM _migrations").all() as { filename: string }[]).map(
      (row) => row.filename,
    ),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied: string[] = [];

  for (const filename of files) {
    if (alreadyApplied.has(filename)) continue;

    const sql = readFileSync(path.join(migrationsDir, filename), "utf-8");
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)").run(
        filename,
        new Date().toISOString(),
      );
    });

    try {
      transaction();
    } catch (err) {
      throw new Error(
        `Migration ${filename} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    applied.push(filename);
  }

  return { applied };
}
