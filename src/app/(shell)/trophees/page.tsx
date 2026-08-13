import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadTropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";
import { TropheesScreen } from "@/components/trophies/TropheesScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default function TropheesPage() {
  const db = getDb(dbPath());
  const state = loadTropheesScreenState(db);
  return <TropheesScreen state={state} />;
}
