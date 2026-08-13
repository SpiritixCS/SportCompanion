import type Database from "better-sqlite3";
import { computeTrophies, type TrophyCard } from "./computeTrophies";
import { prochainPalier } from "./paliers";

export type TrophyDetail = TrophyCard & {
  prochainPalier: number | null;
  resteAParcourir: number | null;
};

export function loadTrophyDetail(db: Database.Database, id: string): TrophyDetail | null {
  const card = computeTrophies(db).find((c) => c.id === id);
  if (!card) return null;

  const next = prochainPalier(card.total);
  return {
    ...card,
    prochainPalier: next,
    resteAParcourir: next === null ? null : next - card.total,
  };
}
