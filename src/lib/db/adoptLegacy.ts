import Database from "better-sqlite3";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
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

type LegacyEntry = { legacyPath: string; email: string | undefined; prenom: string };

// Un fichier historique sans email valide ferait atterrir son propriétaire sur
// un compte vide, définitivement : on échoue au lieu de l'ignorer.
function checkEntry(entry: LegacyEntry): string | null {
  if (!existsSync(entry.legacyPath)) return null;
  const email = normalizeEmail(entry.email);
  if (!email) throw new Error(`Reprise de ${entry.legacyPath} : email absent ou invalide dans .env.`);
  return email;
}

function removeDb(file: string): void {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
}

// Reprise unique d'une base v0.1 (un fichier par utilisateur nommé) sous le
// nouveau nom <DATA_DIR>/users/<email>.db. L'original n'est jamais modifié :
// il reste comme sauvegarde. Idempotent : une copie existante n'est jamais
// écrasée. La copie est préparée dans un fichier temporaire et renommée
// seulement une fois vérifiée : un arrêt brutal ne laisse jamais une cible
// qui aurait l'air reprise.
export async function adoptLegacyDb(entry: LegacyEntry): Promise<"adopted" | "skipped"> {
  const email = checkEntry(entry);
  if (!email) return "skipped";
  const target = userDbPath(email);
  if (existsSync(target)) return "skipped";

  const tmp = `${target}.tmp`;
  mkdirSync(path.dirname(target), { recursive: true });
  removeDb(tmp);
  const legacy = new Database(entry.legacyPath, { readonly: true });
  try {
    await legacy.backup(tmp);
    const copy = new Database(tmp);
    try {
      runMigrations(copy, migrationsDir());
      setPrenom(copy, entry.prenom);
      if (fingerprint(copy) !== fingerprint(legacy)) {
        throw new Error(`Reprise de ${entry.legacyPath} : données différentes après copie.`);
      }
    } finally {
      copy.close();
    }
    renameSync(tmp, target);
  } catch (err) {
    removeDb(tmp);
    throw err;
  } finally {
    legacy.close();
  }
  return "adopted";
}

// Valide toutes les entrées avant d'en copier une seule : jamais d'état où
// un utilisateur est repris et l'autre non à cause d'une erreur de config.
export async function adoptLegacyDbs(entries: LegacyEntry[]): Promise<("adopted" | "skipped")[]> {
  entries.forEach(checkEntry);
  const results: ("adopted" | "skipped")[] = [];
  for (const entry of entries) results.push(await adoptLegacyDb(entry));
  return results;
}
