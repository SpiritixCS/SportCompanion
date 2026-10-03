"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings, updateSettings, type AppSettings } from "./db";
import { getPrenom } from "@/lib/profile/db";
import packageJson from "../../../package.json";

async function db() {
  return getDbForUser(await currentUser());
}

export type ReglagesState = AppSettings & {
  prenom: string | null;
  version: string;
};

export async function getReglagesStateAction(): Promise<ReglagesState> {
  const database = await db();
  return {
    ...getSettings(database),
    prenom: getPrenom(database),
    version: packageJson.version,
  };
}

export async function updateSettingsAction(patch: Partial<AppSettings>): Promise<AppSettings> {
  return updateSettings(await db(), patch);
}
