import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadDosScreenState } from "@/lib/dos/loadDosScreenState";
import { DosScreen } from "@/components/dos/DosScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DosPage() {
  const db = getDb(dbPath());
  const state = loadDosScreenState(db);
  return <DosScreen state={state} />;
}
