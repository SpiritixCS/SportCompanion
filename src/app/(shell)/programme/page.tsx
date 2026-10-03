import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadProgrammeState } from "@/lib/programme/loadProgrammeState";
import { isDayValidated } from "@/lib/programme/db";
import { resolvePosition } from "@/lib/programme/syncPosition";
import { PARCOURS } from "@/lib/programme/parcours";
import { ProgrammeScreen } from "@/components/programme/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  const db = getDbForUser(await currentUser());
  // Lecture seule : on calcule où Aujourd'hui placerait la position, sans l'écrire.
  const position = resolvePosition(db, (parcours, level, dayIndex) => {
    return PARCOURS.find((p) => p.id === parcours)?.program[level]?.[dayIndex]?.kind;
  });
  const levelsByParcours = Object.fromEntries(
    PARCOURS.map((p) => [
      p.id,
      loadProgrammeState(db, p, position?.parcours === p.id ? { level: position.level, cycle: position.cycle } : undefined),
    ]),
  );
  let current = null;
  if (position) {
    const day = PARCOURS.find((p) => p.id === position.parcours)?.program[position.level]?.[position.dayIndex];
    // « Aujourd'hui » seulement sur un jour d'entraînement pas encore validé.
    const todayIsOpen =
      day?.kind === "train" && !isDayValidated(db, position.parcours, position.level, position.dayIndex, position.cycle);
    current = { parcours: position.parcours, level: position.level, dayIndex: todayIsOpen ? position.dayIndex : null };
  }
  return <ProgrammeScreen initialParcours="beginner" levelsByParcours={levelsByParcours} current={current} />;
}
