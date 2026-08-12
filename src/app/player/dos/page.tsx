import path from "node:path";
import { getDb } from "@/lib/db/client";
import { getStartDate, getEvaluations } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { getCurrentCran } from "@/lib/backpain/progression";
import type { ArbreId } from "@/lib/backpain/arbres";
import { getJourSemaine, getDosRestSeconds } from "@/lib/dos/schedule";
import { buildDosDay, ARBRES_DU_JOUR } from "@/lib/dos/buildDosDay";
import { loadDosPlayerState } from "@/lib/dos/loadDosPlayerState";
import { getSetsForDosSeance, toPlayerSetsLogged } from "@/lib/dos/db";
import { logDosSetAction, skipDosExerciseAction, startDosBilanAction } from "@/lib/dos/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DosPlayerPage() {
  const db = getDb(dbPath());
  const startDate = getStartDate(db);

  if (!startDate) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Définis d&apos;abord ta date de départ depuis l&apos;écran Dos.</p>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const jourSemaine = getJourSemaine(today);

  if (jourSemaine === "dimanche") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Repos aujourd&apos;hui — pas de séance Dos le dimanche.</p>
      </main>
    );
  }

  const semaine = computeWeek(startDate, today);
  const bloc = computeBlock(semaine);
  const evaluations = getEvaluations(db);
  const cranCourant = {} as Record<ArbreId, number>;
  for (const arbre of ARBRES_DU_JOUR[jourSemaine]) {
    cranCourant[arbre] = getCurrentCran(evaluations, arbre);
  }

  const day = buildDosDay(jourSemaine, bloc, cranCourant);
  const state = loadDosPlayerState(db, today, jourSemaine, semaine, day);
  const setsLogged = toPlayerSetsLogged(getSetsForDosSeance(db, state.seanceId));
  const restSeconds = getDosRestSeconds(jourSemaine);

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
      accent="sage"
      restBetweenSetsSeconds={restSeconds}
      restBetweenExercisesSeconds={restSeconds}
      onLogSet={logDosSetAction}
      onSkipExercise={skipDosExerciseAction}
      onSeanceFinish={startDosBilanAction}
    />
  );
}
