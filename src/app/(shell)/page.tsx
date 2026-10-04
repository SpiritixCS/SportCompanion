import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTodayState } from "@/lib/programme/loadTodayState";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { PARCOURS } from "@/lib/programme/parcours";
import { AujourdhuiScreen } from "@/components/today/AujourdhuiScreen";
import { getPrenom } from "@/lib/profile/db";
import { lastPeaks, listExercises } from "@/lib/tracking/db";
import { catalogExercises } from "@/lib/pyramide/catalog";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTodayState(db, PARCOURS);
  const trackingState = loadTrackingScreenState(db);
  const catalog = catalogExercises();
  const pyramid = {
    catalog,
    lastPeaks: lastPeaks(db),
    suggestions: [...new Set([...catalog.map((c) => c.name), ...listExercises(db).map((e) => e.name)])],
  };
  return (
    <AujourdhuiScreen state={state} trackingState={trackingState} user={{ label: getPrenom(db) ?? "" }} pyramid={pyramid} />
  );
}
