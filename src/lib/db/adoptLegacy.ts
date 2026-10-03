import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { normalizeEmail, userDbPath } from "@/lib/auth/email";
import { setPrenom } from "@/lib/profile/db";
import { runMigrations } from "./migrate";
import { migrationsDir } from "./client";

// Empreinte des données qui comptent pour l'utilisateur : position Programme,
// séances, séries et reps, séries Tracking. Doit être identique avant/après.
function fingerprint(db: Database.Database): string {
  const q = (sql: string) => JSON.stringify(db.prepare(sql).all());
  return [
    q(`SELECT parcours, level, day_index, cycle FROM current_position`),
    q(`SELECT COUNT(*) n FROM seances`),
    q(`SELECT COUNT(*) n, COALESCE(SUM(reps_actual), 0) s FROM sets_logged`),
    q(`SELECT COUNT(*) n FROM tracking_sets_logged`),
  ].join("|");
}

// Reprise unique d'une base v0.1 (un fichier par utilisateur nommé) sous le
// nouveau nom <DATA_DIR>/users/<email>.db. L'original n'est jamais modifié :
// il reste comme sauvegarde. Idempotent : une copie existante n'est jamais
// écrasée.
export async function adoptLegacyDb(opts: {
  legacyPath: string;
  email: string | undefined;
  prenom: string;
}): Promise<"adopted" | "skipped"> {
  const email = normalizeEmail(opts.email);
  if (!email || !existsSync(opts.legacyPath)) return "skipped";
  const target = userDbPath(email);
  if (existsSync(target)) return "skipped";

  mkdirSync(path.dirname(target), { recursive: true });
  const legacy = new Database(opts.legacyPath, { readonly: true });
  try {
    await legacy.backup(target);
    const copy = new Database(target);
    try {
      copy.pragma("journal_mode = WAL");
      runMigrations(copy, migrationsDir());
      setPrenom(copy, opts.prenom);
      if (fingerprint(copy) !== fingerprint(legacy)) {
        throw new Error(`Reprise de ${opts.legacyPath} : données différentes après copie.`);
      }
    } finally {
      copy.close();
    }
  } catch (err) {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(target + suffix, { force: true });
    throw err;
  } finally {
    legacy.close();
  }
  return "adopted";
}
