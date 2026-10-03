import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

export function getDb(dbPath: string): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

// En prod, le serveur tourne depuis .next/standalone où migrations/ est copié
// par deploy.sh ; MIGRATIONS_DIR pointe dessus.
export function migrationsDir(): string {
  return process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "migrations");
}

const dbByPath = new Map<string, Database.Database>();

export function getDbForUser(user: { dbPath: string }): Database.Database {
  let db = dbByPath.get(user.dbPath);
  if (!db) {
    db = getDb(user.dbPath);
    // Premier accès de ce fichier par le process : crée le schéma d'un nouvel
    // utilisateur, ou rattrape une migration déployée depuis.
    runMigrations(db, migrationsDir());
    dbByPath.set(user.dbPath, db);
  }
  return db;
}
