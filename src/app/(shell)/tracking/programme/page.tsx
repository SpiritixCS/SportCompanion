import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getProgramDays } from "@/lib/tracking/program";
import { listExercises } from "@/lib/tracking/db";
import { ProgrammeScreen } from "@/components/tracking/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function TrackingProgrammePage() {
  const user = await currentUser();
  const db = getDbForUser(user);
  return <ProgrammeScreen days={getProgramDays(db)} exerciseSuggestions={listExercises(db)} />;
}
