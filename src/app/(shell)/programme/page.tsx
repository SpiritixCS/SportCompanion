import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadProgrammeState } from "@/lib/programme/loadProgrammeState";
import { PARCOURS } from "@/lib/programme/parcours";
import { ProgrammeScreen } from "@/components/programme/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  const db = getDbForUser(await currentUser());
  const levelsByParcours = Object.fromEntries(
    PARCOURS.map((p) => [p.id, loadProgrammeState(db, p)]),
  );
  return <ProgrammeScreen initialParcours="beginner" levelsByParcours={levelsByParcours} />;
}
