// src/lib/tracking/loadTrackingScreenState.ts
import type Database from "better-sqlite3";
import { getActiveSeance, listCompletedSeances, type TrackingSeanceSummary } from "./db";
import { getTemplate, type TemplateExercise } from "./templates";
import { getRotation } from "./program";

export type TrackingScreenState = {
  activeSeance: { id: number; templateId: number | null } | null;
  seances: TrackingSeanceSummary[];
  todayTemplate: { templateId: number; nom: string; exercises: TemplateExercise[] } | null;
  rotationTemplates: { templateId: number; nom: string }[];
};

export function loadTrackingScreenState(db: Database.Database): TrackingScreenState {
  const active = getActiveSeance(db);
  const rotation = getRotation(db);
  const todayTemplate = rotation.pointerTemplateId !== null ? getTemplate(db, rotation.pointerTemplateId) : null;

  return {
    activeSeance: active ? { id: active.id, templateId: active.templateId } : null,
    seances: listCompletedSeances(db),
    todayTemplate: todayTemplate
      ? { templateId: todayTemplate.id, nom: todayTemplate.nom, exercises: todayTemplate.exercises }
      : null,
    rotationTemplates: rotation.entries.map((entry) => ({ templateId: entry.templateId, nom: entry.nom })),
  };
}
