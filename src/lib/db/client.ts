import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function getDb(dbPath: string): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}
