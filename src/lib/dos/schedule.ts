import type { JourEntraine } from "./exercicesFixes";

const WEEKDAYS: (JourEntraine | "dimanche")[] = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];

export function getJourSemaine(date: string): JourEntraine | "dimanche" {
  const parsed = new Date(`${date}T00:00:00Z`);
  return WEEKDAYS[parsed.getUTCDay()]!;
}

// BackPainProgram.md §4 only states 60s on mardi explicitly, and 90-120s on
// lundi/mercredi/vendredi explicitly. jeudi/samedi have no explicit value in
// §4 — treated here as the other main-movement days (90s), an assumption,
// not a datum of the domain.
export function getDosRestSeconds(jour: JourEntraine): number {
  return jour === "mardi" ? 60 : 90;
}
