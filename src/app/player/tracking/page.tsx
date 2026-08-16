import Link from "next/link";
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { getProgramDay } from "@/lib/tracking/program";
import { dayAsTrainDay } from "@/lib/tracking/dayAsTrainDay";
import { loadDayPlayerState } from "@/lib/tracking/loadDayPlayerState";
import { getSetsForSeance } from "@/lib/tracking/db";
import { logDaySetAction, skipDayExerciseAction, completeDaySeanceAction } from "@/lib/tracking/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";

export default async function TrackingPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");

  const { day: dayParam } = await searchParams;
  const dayOfWeek = Number(dayParam);

  // Graceful error screen for invalid/out-of-range day
  const notFoundScreen = (
    <main className="p-5">
      <p className="text-15 text-graphite">Jour introuvable.</p>
      <Link href="/" className="text-15 text-graphite underline mt-4 inline-block">
        Retour à Aujourd&apos;hui
      </Link>
    </main>
  );

  // Validate dayOfWeek before calling getProgramDay to avoid unhandled throw
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return notFoundScreen;
  }

  const db = getDbForUser(user);
  const programDay = getProgramDay(db, dayOfWeek);

  if (programDay.isRest || programDay.exercises.length === 0) {
    return notFoundScreen;
  }

  const day = dayAsTrainDay(programDay);
  const state = loadDayPlayerState(db, dayOfWeek, day);

  if (state.phase === "wrong-seance") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">
          Une autre séance est déjà en cours. Termine-la ou quitte-la avant d&apos;en commencer une nouvelle.
        </p>
        <Link href="/" className="text-15 text-graphite underline mt-4 inline-block">
          Retour à Aujourd&apos;hui
        </Link>
      </main>
    );
  }

  const settings = getSettings(db);
  const setsLogged = getSetsForSeance(db, state.seanceId).map((set) => ({
    id: set.id,
    seanceId: set.seanceId,
    exerciseOrder: set.exerciseOrder,
    setNumber: set.setNumber,
    repsTarget: String(day.exercises[set.exerciseOrder]?.target.value ?? ""),
    repsActual: set.valeurActual,
    restSeconds: settings.restBetweenSetsSeconds,
    completedAt: set.completedAt,
  }));

  return (
    <PlayerScreen
      day={day}
      state={state}
      setsLogged={setsLogged}
      accent="sage"
      restBetweenSetsSeconds={settings.restBetweenSetsSeconds}
      restBetweenExercisesSeconds={settings.restBetweenExercisesSeconds}
      keepScreenAwakeEnabled={settings.keepScreenAwakeEnabled}
      onLogSet={logDaySetAction.bind(null, dayOfWeek)}
      onSkipExercise={skipDayExerciseAction}
      onSeanceFinish={completeDaySeanceAction}
    />
  );
}
