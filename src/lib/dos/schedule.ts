import type { JourEntraine } from "./exercicesFixes";

const WEEKDAYS: (JourEntraine | "dimanche")[] = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];

export function getJourSemaine(date: string): JourEntraine | "dimanche" {
  const parsed = new Date(`${date}T00:00:00Z`);
  return WEEKDAYS[parsed.getUTCDay()]!;
}

export function getDosRestSeconds(jour: JourEntraine): number {
  return jour === "mardi" ? 60 : 90;
}
