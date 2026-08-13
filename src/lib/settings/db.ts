import type Database from "better-sqlite3";

export type AppSettings = {
  restBetweenSetsSeconds: number;
  restBetweenExercisesSeconds: number;
  soundCountdownEnabled: boolean;
  startCountdownEnabled: boolean;
  keepScreenAwakeEnabled: boolean;
};

type SettingsRow = {
  rest_between_sets_seconds: number;
  rest_between_exercises_seconds: number;
  sound_countdown_enabled: number;
  start_countdown_enabled: number;
  keep_screen_awake_enabled: number;
};

function toAppSettings(row: SettingsRow): AppSettings {
  return {
    restBetweenSetsSeconds: row.rest_between_sets_seconds,
    restBetweenExercisesSeconds: row.rest_between_exercises_seconds,
    soundCountdownEnabled: row.sound_countdown_enabled === 1,
    startCountdownEnabled: row.start_countdown_enabled === 1,
    keepScreenAwakeEnabled: row.keep_screen_awake_enabled === 1,
  };
}

export function getSettings(db: Database.Database): AppSettings {
  const row = db
    .prepare(
      `SELECT rest_between_sets_seconds, rest_between_exercises_seconds,
              sound_countdown_enabled, start_countdown_enabled, keep_screen_awake_enabled
       FROM app_settings WHERE id = 1`,
    )
    .get() as SettingsRow;
  return toAppSettings(row);
}

const COLUMN_BY_KEY: Record<keyof AppSettings, string> = {
  restBetweenSetsSeconds: "rest_between_sets_seconds",
  restBetweenExercisesSeconds: "rest_between_exercises_seconds",
  soundCountdownEnabled: "sound_countdown_enabled",
  startCountdownEnabled: "start_countdown_enabled",
  keepScreenAwakeEnabled: "keep_screen_awake_enabled",
};

// Matches DurationRow's FLOOR_SECONDS; ceiling is a sane upper bound (10 min).
const DURATION_FLOOR_SECONDS = 15;
const DURATION_CEILING_SECONDS = 600;
const DURATION_KEYS = new Set<keyof AppSettings>(["restBetweenSetsSeconds", "restBetweenExercisesSeconds"]);

function clampDuration(value: number): number {
  return Math.min(DURATION_CEILING_SECONDS, Math.max(DURATION_FLOOR_SECONDS, Math.round(value)));
}

export function updateSettings(db: Database.Database, patch: Partial<AppSettings>): AppSettings {
  const entries = (Object.entries(patch) as [keyof AppSettings, number | boolean][]).filter(
    ([key]) => key in COLUMN_BY_KEY,
  );
  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${COLUMN_BY_KEY[key]} = ?`).join(", ");
    const values = entries.map(([key, value]) => {
      if (typeof value === "boolean") return value ? 1 : 0;
      return DURATION_KEYS.has(key) ? clampDuration(value) : value;
    });
    db.prepare(`UPDATE app_settings SET ${setClause} WHERE id = 1`).run(...values);
  }
  return getSettings(db);
}
