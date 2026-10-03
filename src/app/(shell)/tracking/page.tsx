import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadTrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import { TrackingScreen } from "@/components/tracking/TrackingScreen";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  const state = loadTrackingScreenState(db);
  return <TrackingScreen state={state} />;
}
