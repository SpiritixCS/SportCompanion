import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadProgrammeState } from "@/lib/programme/loadProgrammeState";
import { getCurrentPosition } from "@/lib/programme/db";
import { PARCOURS } from "@/lib/programme/parcours";
import { ProgrammeScreen } from "@/components/programme/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  const db = getDbForUser(await currentUser());
  const levelsByParcours = Object.fromEntries(
    PARCOURS.map((p) => [p.id, loadProgrammeState(db, p)]),
  );
  // Lecture seule : la consultation ne déplace jamais la position.
  const position = getCurrentPosition(db);
  const current = position ? { parcours: position.parcours, level: position.level, dayIndex: position.dayIndex } : null;
  return <ProgrammeScreen initialParcours="beginner" levelsByParcours={levelsByParcours} current={current} />;
}
