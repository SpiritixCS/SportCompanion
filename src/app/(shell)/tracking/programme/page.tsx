import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { listTemplates } from "@/lib/tracking/templates";
import { getRotation } from "@/lib/tracking/program";
import { listExercises } from "@/lib/tracking/db";
import { ProgrammeScreen } from "@/components/tracking/ProgrammeScreen";

export const dynamic = "force-dynamic";

export default async function TrackingProgrammePage() {
  const user = await currentUser();
  if (user.slug !== "clement") redirect("/");
  const db = getDbForUser(user);
  return (
    <ProgrammeScreen
      templates={listTemplates(db)}
      rotation={getRotation(db)}
      exerciseSuggestions={listExercises(db)}
    />
  );
}
