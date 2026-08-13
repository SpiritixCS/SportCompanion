import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";
import { TropheesScreen } from "@/components/trophies/TropheesScreen";

export const dynamic = "force-dynamic";

export default async function TropheesPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTropheesScreenState(db);
  const secondModule =
    user.slug === "clement" ? { value: "tracking" as const, label: "Tracking" } : { value: "dos" as const, label: "Dos" };
  return <TropheesScreen state={state} secondModule={secondModule} />;
}
