import type Database from "better-sqlite3";
import { getActiveSeance, listCompletedSeances, type TrackingSeanceSummary } from "./db";

export type TrackingScreenState = {
  activeSeanceId: number | null;
  seances: TrackingSeanceSummary[];
};

export function loadTrackingScreenState(db: Database.Database): TrackingScreenState {
  const active = getActiveSeance(db);
  return {
    activeSeanceId: active ? active.id : null,
    seances: listCompletedSeances(db),
  };
}
