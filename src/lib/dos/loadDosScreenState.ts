import type Database from "better-sqlite3";
import { getStartDate, getEvaluations } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { getCurrentCran } from "@/lib/backpain/progression";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { loadDosTodayState, type DosTodayState } from "./loadDosTodayState";
import { getDosSeanceByDate } from "./db";
import type { PastilleState } from "@/components/Pastille";

export type ArbreProgressRow = {
  arbre: ArbreId;
  nom: string;
  cranCourant: number;
  cranNom: string;
  totalCrans: number;
};

export type DosScreenState =
  | { phase: "no-start-date" }
  | {
      phase: "ready";
      semaine: number;
      bloc: number;
      today: DosTodayState;
      arbresProgress: ArbreProgressRow[];
      weekPastilles: PastilleState[];
    };

const ALL_ARBRES: ArbreId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function mondayOf(date: Date): Date {
  const day = date.getUTCDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  return monday;
}

export function loadDosScreenState(db: Database.Database): DosScreenState {
  const startDate = getStartDate(db);
  if (!startDate) return { phase: "no-start-date" };

  const todayIso = new Date().toISOString().slice(0, 10);
  const semaine = computeWeek(startDate, todayIso);
  const bloc = computeBlock(semaine);
  const evaluations = getEvaluations(db);

  const arbresProgress: ArbreProgressRow[] = ALL_ARBRES.map((arbre) => {
    const cran = getCurrentCran(evaluations, arbre);
    const def = ARBRES[arbre];
    return { arbre, nom: def.nom, cranCourant: cran, cranNom: def.crans[cran - 1]!.nom, totalCrans: def.crans.length };
  });

  const monday = mondayOf(new Date(`${todayIso}T00:00:00Z`));
  const weekPastilles: PastilleState[] = Array.from({ length: 7 }, (_, i) => {
    if (i === 6) return "restOrWalk"; // dimanche
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    const dateIso = date.toISOString().slice(0, 10);
    const seance = getDosSeanceByDate(db, dateIso);
    if (seance?.completedAt) return "done";
    if (dateIso === todayIso) return "today";
    return "upcoming";
  });

  return { phase: "ready", semaine, bloc, today: loadDosTodayState(db), arbresProgress, weekPastilles };
}
