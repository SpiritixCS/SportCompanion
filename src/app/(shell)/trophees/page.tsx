import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";
import { TropheesScreen } from "@/components/trophies/TropheesScreen";

export const dynamic = "force-dynamic";

export default async function TropheesPage() {
  const db = getDbForUser(await currentUser());
  const state = loadTropheesScreenState(db);
  return <TropheesScreen state={state} />;
}
