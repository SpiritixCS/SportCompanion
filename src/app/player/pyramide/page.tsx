import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { loadPyramidPlayerState } from "@/lib/tracking/loadPyramidPlayerState";
import {
  logPyramidSetAction,
  skipDayExerciseAction,
  completePyramidAction,
  resumeDaySeanceAction,
  discardDaySeanceAction,
} from "@/lib/tracking/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";

export const dynamic = "force-dynamic";

// La pyramide libre active ; sans pyramide en cours, retour à la page Tracking.
export default async function PyramidPlayerPage() {
  const db = getDbForUser(await currentUser());
  const pyramid = loadPyramidPlayerState(db);
  if (!pyramid) redirect("/tracking");

  const settings = getSettings(db);
  return (
    <PlayerScreen
      day={pyramid.day}
      state={pyramid.state}
      setsLogged={pyramid.setsLogged}
      accent="sage"
      restBetweenSetsSeconds={settings.restBetweenSetsSeconds}
      restBetweenExercisesSeconds={settings.restBetweenExercisesSeconds}
      keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
      onLogSet={logPyramidSetAction}
      onSkipExercise={skipDayExerciseAction}
      onSeanceFinish={completePyramidAction}
      onResume={resumeDaySeanceAction}
      onDiscard={discardDaySeanceAction}
    />
  );
}
