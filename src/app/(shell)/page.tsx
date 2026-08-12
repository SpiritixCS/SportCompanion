import path from "node:path";
import { getDb } from "@/lib/db/client";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadDosTodayState } from "@/lib/dos/loadDosTodayState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function TodayPage() {
  const db = getDb(dbPath());
  const state = loadTodayState(db, PARCOURS);
  const dosState = loadDosTodayState(db);
  return <AujourdhuiScreen state={state} dosState={dosState} />;
}
