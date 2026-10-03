"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { setPrenom } from "./db";

export async function setPrenomAction(prenom: string): Promise<void> {
  setPrenom(getDbForUser(await currentUser()), prenom);
}
