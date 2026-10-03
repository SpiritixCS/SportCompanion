"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getSettings, updateSettings, type AppSettings } from "./db";
import packageJson from "../../../package.json";

async function db() {
  return getDbForUser(await currentUser());
}

export type ReglagesState = AppSettings & {
  version: string;
};

export async function getReglagesStateAction(): Promise<ReglagesState> {
  return {
    ...getSettings(await db()),
    version: packageJson.version,
  };
}

export async function updateSettingsAction(patch: Partial<AppSettings>): Promise<AppSettings> {
  return updateSettings(await db(), patch);
}
