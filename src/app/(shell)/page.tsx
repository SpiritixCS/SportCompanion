import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadDosTodayState } from "@/lib/dos/loadDosTodayState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTodayState(db, PARCOURS);
  const dosState = user.slug === "mathis" ? loadDosTodayState(db) : null;
  return <AujourdhuiScreen state={state} dosState={dosState} user={{ slug: user.slug, label: user.label }} />;
}
