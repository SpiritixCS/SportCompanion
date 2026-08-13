import { notFound, redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSeanceById, getSetsForSeance, listExerciseNames } from "@/lib/tracking/db";
import { TrackingSeanceScreen } from "@/components/tracking/TrackingSeanceScreen";

export const dynamic = "force-dynamic";

export default async function TrackingSeancePage({
  params,
}: {
  params: Promise<{ seanceId: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");

  const { seanceId: seanceIdParam } = await params;
  const seanceId = Number(seanceIdParam);
  const db = getDbForUser(user);
  const seance = getSeanceById(db, seanceId);
  if (!seance) notFound();

  const sets = getSetsForSeance(db, seanceId);
  const exerciseSuggestions = listExerciseNames(db);

  return (
    <TrackingSeanceScreen
      seanceId={seance.id}
      completed={seance.completedAt !== null}
      initialSets={sets}
      exerciseSuggestions={exerciseSuggestions}
    />
  );
}
