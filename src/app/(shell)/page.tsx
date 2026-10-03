import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTodayState(db, PARCOURS);
  const trackingState = loadTrackingScreenState(db);
  return <AujourdhuiScreen state={state} trackingState={trackingState} user={{ label: user.label }} />;
}
