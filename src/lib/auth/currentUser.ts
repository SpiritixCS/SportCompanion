import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveEmail } from "./resolveEmail";
import { userDbPath } from "./email";

export type CurrentUser = { email: string; dbPath: string };

export async function currentUser(): Promise<CurrentUser> {
  let h: Headers | null = null;
  try {
    h = await headers();
  } catch {
    // Hors requête (script, test sans mock) : seule l'identité forcée de dev s'applique.
    h = null;
  }
  const email = await resolveEmail(h, process.env);
  if (!email) redirect("/acces-refuse");
  return { email, dbPath: userDbPath(email) };
}
