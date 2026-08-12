import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadProgrammeState } from "@/lib/programme/loadProgrammeState";
import { PARCOURS } from "@/lib/programme/parcours";
import { ProgrammeScreen } from "@/components/programme/ProgrammeScreen";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default function ProgrammePage() {
  const db = getDb(dbPath());
  const levelsByParcours = Object.fromEntries(
    PARCOURS.map((p) => [p.id, loadProgrammeState(db, p)]),
  );
  return <ProgrammeScreen initialParcours="beginner" levelsByParcours={levelsByParcours} />;
}
