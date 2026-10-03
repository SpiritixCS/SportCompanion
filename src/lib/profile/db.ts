import type Database from "better-sqlite3";

export function getPrenom(db: Database.Database): string | null {
  const row = db.prepare(`SELECT prenom FROM user_profile WHERE id = 1`).get() as { prenom: string | null } | undefined;
  return row?.prenom ?? null;
}

export function setPrenom(db: Database.Database, prenom: string): void {
  const value = prenom.trim();
  if (value.length < 1 || value.length > 40) throw new Error("Prénom : 1 à 40 caractères.");
  db.prepare(`UPDATE user_profile SET prenom = ? WHERE id = 1`).run(value);
}
