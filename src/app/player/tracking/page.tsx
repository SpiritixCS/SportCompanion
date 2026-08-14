import Link from "next/link";
import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings } from "@/lib/settings/db";
import { getTemplate } from "@/lib/tracking/templates";
import { templateAsTrainDay } from "@/lib/tracking/templateAsTrainDay";
import { loadTemplatePlayerState } from "@/lib/tracking/loadTemplatePlayerState";
import { getSetsForSeance } from "@/lib/tracking/db";
import { logTemplateSetAction, skipTemplateExerciseAction, completeTemplateSeanceAction } from "@/lib/tracking/actions";
import { PlayerScreen } from "@/components/player/PlayerScreen";

export default async function TrackingPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");

  const { templateId: templateIdParam } = await searchParams;
  const templateId = Number(templateIdParam);
  const db = getDbForUser(user);
  const template = getTemplate(db, templateId);

  if (!template || template.exercises.length === 0) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Modèle introuvable.</p>
        <Link href="/" className="text-15 text-graphite underline mt-4 inline-block">
          Retour à Aujourd&apos;hui
        </Link>
      </main>
    );
  }

  const day = templateAsTrainDay(template);
  const state = loadTemplatePlayerState(db, templateId, day);

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
      onLogSet={logTemplateSetAction.bind(null, templateId)}
      onSkipExercise={skipTemplateExerciseAction}
      onSeanceFinish={completeTemplateSeanceAction.bind(null, templateId)}
    />
  );
}
