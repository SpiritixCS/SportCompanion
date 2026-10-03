import type Database from "better-sqlite3";
import { computeTrophies } from "@/lib/trophies/computeTrophies";

export type ExtraRepsEntry = { id: number; amount: number; loggedAt: string };

const MAX_AMOUNT = 100_000;

// Seulement sur un exercice déjà présent dans Trophées ; datée de maintenant.
export function addExtraReps(db: Database.Database, cardId: string, amount: number): void {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new Error(`Quantité invalide : ${amount}`);
  }
  if (!computeTrophies(db).some((c) => c.id === cardId)) {
    throw new Error(`Exercice absent des Trophées : ${cardId}`);
  }
  db.prepare(`INSERT INTO extra_reps (card_id, amount, logged_at) VALUES (?, ?, ?)`).run(
    cardId,
    amount,
    new Date().toISOString(),
  );
}

export function listExtraReps(db: Database.Database, cardId: string): ExtraRepsEntry[] {
  return db
    .prepare(
      `SELECT id, amount, logged_at AS loggedAt FROM extra_reps WHERE card_id = ? ORDER BY logged_at DESC, id DESC`,
    )
    .all(cardId) as ExtraRepsEntry[];
}

export function deleteExtraReps(db: Database.Database, id: number): void {
  db.prepare(`DELETE FROM extra_reps WHERE id = ?`).run(id);
}
