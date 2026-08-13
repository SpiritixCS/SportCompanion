import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { loadDosScreenState } from "@/lib/dos/loadDosScreenState";
import { DosScreen } from "@/components/dos/DosScreen";

export const dynamic = "force-dynamic";

export default async function DosPage() {
  const user = await currentUser();
  if (user.slug !== "mathis") redirect("/");
  const db = getDbForUser(user);
  const state = loadDosScreenState(db);
  return <DosScreen state={state} />;
}
