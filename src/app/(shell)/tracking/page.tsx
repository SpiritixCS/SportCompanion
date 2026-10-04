import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { getProgramDays } from "@/lib/tracking/program";
import { lastPeaks, listExercises } from "@/lib/tracking/db";
import { catalogExercises } from "@/lib/pyramide/catalog";
import { TrackingScreen } from "@/components/tracking/TrackingScreen";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const db = getDbForUser(await currentUser());
  return (
    <TrackingScreen
      state={loadTrackingScreenState(db)}
      days={getProgramDays(db)}
      exerciseSuggestions={listExercises(db)}
      globalRestSeconds={getSettings(db).restBetweenSetsSeconds}
      lastPeaks={lastPeaks(db)}
      catalog={catalogExercises()}
    />
  );
}
