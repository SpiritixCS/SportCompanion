import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadPlayerState } from "@/lib/player/loadPlayerState";
import { getSetsForSeance } from "@/lib/player/db";
import { beginner, intermediate, advanced } from "@/lib/workout/data";
import type { Program } from "@/lib/workout/types";
import { PlayerScreen } from "@/components/player/PlayerScreen";

const PROGRAMS: Record<string, Program> = { beginner, intermediate, advanced };

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function PlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ parcours?: string; level?: string; day?: string }>;
}) {
  const params = await searchParams;
  const parcours = params.parcours ?? "";
  const level = Number(params.level);
  const dayIndex = Number(params.day);

  const program = PROGRAMS[parcours];
  const programLevel = program?.[level];
  const day = programLevel?.[dayIndex];

  if (!program || !programLevel || !day || day.kind !== "train") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">
          Jour introuvable pour ces paramètres. Essaie
          /player?parcours=beginner&level=0&day=0
        </p>
      </main>
    );
  }

  const db = getDb(dbPath());
  const state = loadPlayerState(db, parcours, level, dayIndex, day);
  const setsLogged = getSetsForSeance(db, state.seanceId);

  return <PlayerScreen day={day} state={state} setsLogged={setsLogged} />;
}
