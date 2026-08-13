"use server";

import type Database from "better-sqlite3";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { getStartDate } from "@/lib/backpain/db";
import { getSettings, updateSettings, type AppSettings } from "./db";
import packageJson from "../../../package.json";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
    dbInstance = getDb(dbPath);
  }
  return dbInstance;
}

export type ReglagesState = AppSettings & {
  dosStartDate: string | null;
  version: string;
};

export async function getReglagesStateAction(): Promise<ReglagesState> {
  const database = db();
  return {
    ...getSettings(database),
    dosStartDate: getStartDate(database),
    version: packageJson.version,
  };
}

export async function updateSettingsAction(patch: Partial<AppSettings>): Promise<AppSettings> {
  return updateSettings(db(), patch);
}
