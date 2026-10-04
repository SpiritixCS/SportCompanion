import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { getProgramDays } from "@/lib/tracking/program";
import { listExercises } from "@/lib/tracking/db";
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
    />
  );
}
