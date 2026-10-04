"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResumeBanner } from "@/components/today/ResumeBanner";
import { IconClose } from "@/components/icons/IconClose";
import { Sheet } from "@/components/Sheet";
import { FillLink } from "@/components/FillButton";
import { InitialTile } from "@/components/glyphs/InitialTile";
import { DayEditor } from "./DayEditor";
import { PyramidLauncher } from "./PyramidLauncher";
import { activeSeanceHref } from "@/lib/tracking/activeSeanceHref";
import { pyramidSteps } from "@/lib/pyramide/pyramid";
import type { CatalogExercise } from "@/lib/pyramide/catalog";
import { formatClock } from "@/lib/player/formatClock";
import { doseLabel } from "@/lib/tracking/dose";
import { advanceProgramDayAction, deleteTrackingSeanceAction, saveDayAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import type { DayExerciseInput, TrackingProgramDay } from "@/lib/tracking/program";
import type { TrackingUnit } from "@/lib/tracking/db";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

const EYEBROW = "font-mono text-11 uppercase tracking-[0.14em]";
const LINE_BUTTON = "h-14 w-full rounded-pill border border-hairline bg-paper font-body text-15 font-semibold disabled:opacity-40";

export function TrackingScreen({
  state,
  days,
  exerciseSuggestions,
  globalRestSeconds,
  lastPeaks = {},
  catalog = [],
}: {
  state: TrackingScreenState;
  days: TrackingProgramDay[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
  globalRestSeconds: number;
  lastPeaks?: Record<string, number>;
  catalog?: CatalogExercise[];
}) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const activeHref = state.activeSeance ? activeSeanceHref(state.activeSeance) : null;

  const pointer = state.programDay.dayOfWeek;
  const next = state.programDay;
  const editingDay = editing === null ? null : days.find((d) => d.dayOfWeek === editing) ?? null;

  async function handleDeleteSeance(seanceId: number) {
    setError(false);
    try {
      await deleteTrackingSeanceAction(seanceId);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleAdvance() {
    if (advancing) return;
    setAdvancing(true);
    setError(false);
    try {
      await advanceProgramDayAction();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setAdvancing(false);
    }
  }

  async function handleSave(isRest: boolean, exercises: DayExerciseInput[]) {
    if (editing === null) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveDayAction(editing, isRest, exercises);
      setEditing(null);
      router.refresh();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  function openEditor(dayOfWeek: number) {
    setSaveError(false);
    setEditing(dayOfWeek);
  }

  return (
    <div className="px-[18px] pt-5 pb-10">
      <span className={`${EYEBROW} text-sage-strong`}>Programme perso</span>
      <h1 className="font-display font-extrabold text-[56px] uppercase leading-[0.9] mt-1.5">Tracking</h1>

      {state.activeSeance !== null && (
        <div className="mt-[18px]">
          <ResumeBanner
            exerciseName="ta séance en cours"
            href={activeHref!}
            accent="sage"
          />
        </div>
      )}

      <div role="group" aria-label="Tes 7 jours" className="grid grid-cols-7 gap-1.5 mt-[18px]">
        {days.map((d) => {
          const isPointer = d.dayOfWeek === pointer && !state.programEmpty;
          const count = d.exercises.length;
          return (
            <button
              key={d.dayOfWeek}
              type="button"
              onClick={() => openEditor(d.dayOfWeek)}
              aria-label={`${d.label}, ${d.isRest ? "repos" : `${count} exercice${count > 1 ? "s" : ""}`}${
                isPointer ? " · prochaine séance" : ""
              }`}
              className={`relative rounded-2xl pt-2.5 pb-[9px] flex flex-col items-center gap-[7px] ${
                isPointer ? "bg-ink text-paper" : "bg-paper"
              }`}
            >
              <span className={`font-mono text-11 ${isPointer ? "text-mist" : "text-graphite"}`}>{d.label.slice(0, 3)}</span>
              {d.isRest ? (
                <span className="font-mono text-[10px] h-5 flex items-center text-graphite">repos</span>
              ) : (
                <span className={`font-display font-extrabold text-[22px] leading-[0.9] ${count === 0 ? "text-hairline" : ""}`}>
                  {count}
                </span>
              )}
              {isPointer && (
                <span aria-hidden="true" className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-pill bg-sage" />
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-13 text-alert mt-4">Une erreur est survenue. Réessaie.</p>}

      {state.programEmpty ? (
        <div className="card-rise mt-[22px] bg-paper rounded-[28px] px-5 py-[22px]">
          <span className={`${EYEBROW} text-sage-strong`}>Pour commencer</span>
          <h2 className="font-display font-extrabold text-[34px] uppercase leading-[0.92] mt-1.5">Ta semaine est vide</h2>
          <p className="text-[14px] text-graphite mt-1.5 mb-4">
            Touche un jour pour y mettre tes exercices, ou laisse-le en repos.
          </p>
          <button
            type="button"
            onClick={() => openEditor(0)}
            className="h-14 w-full rounded-pill bg-sage-strong text-paper font-body text-15 font-semibold"
          >
            Composer lundi
          </button>
        </div>
      ) : (
        <div className="card-rise mt-[22px] bg-paper rounded-[28px] p-5">
          <span className={`${EYEBROW} text-sage-strong`}>Prochaine séance</span>
          <h2 className="font-display font-extrabold text-[40px] uppercase leading-[0.9] mt-1.5">{next.label}</h2>
          {next.isRest ? (
            <>
              <p className="text-15 text-graphite mt-2 mb-4">Jour de repos.</p>
              <button type="button" onClick={handleAdvance} disabled={advancing} className={LINE_BUTTON}>
                Jour suivant
              </button>
            </>
          ) : next.exercises.length === 0 ? (
            <>
              <p className="text-15 text-graphite mt-2 mb-4">Aucun exercice ce jour-là.</p>
              <button type="button" onClick={() => openEditor(next.dayOfWeek)} className={LINE_BUTTON}>
                Ajouter des exercices
              </button>
            </>
          ) : (
            <>
              <div className="mt-2">
                {next.exercises.map((e) => (
                  <div
                    key={e.ordre}
                    className="grid grid-cols-[36px_1fr_auto] gap-3 items-center py-3 border-b border-hairline last:border-b-0"
                  >
                    <InitialTile name={e.name} />
                    <span className="min-w-0">
                      <span className="block text-15 truncate">{e.name}</span>
                      <span className="block font-mono text-11 uppercase tracking-[0.06em] text-graphite mt-0.5">
                        {e.pyramid ? "Repos auto" : `Repos ${formatClock(e.restSeconds ?? globalRestSeconds)}`}
                      </span>
                    </span>
                    <span className="font-display font-bold text-[20px] tracking-[0.02em] tabular-nums whitespace-nowrap">
                      {doseLabel(e)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3.5">
                <FillLink href={`/player/tracking?day=${next.dayOfWeek}`} accent="sage" base="accent">
                  Commencer la séance
                </FillLink>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card-rise mt-3 bg-paper rounded-[28px] p-5">
        <span className={`${EYEBROW} text-sage-strong`}>Pyramide</span>
        <h2 className="font-display font-extrabold text-[34px] uppercase leading-[0.92] mt-1.5">Monte, redescends</h2>
        <div aria-hidden="true" className="flex items-end gap-[3px] h-[34px] mt-3 mb-4">
          {pyramidSteps("classic", 5).map((reps, i) => (
            <span key={i} style={{ height: `${reps * 20}%` }} className="flex-1 rounded-[3px] bg-sage-soft" />
          ))}
        </div>
        <button type="button" onClick={() => setLauncherOpen(true)} className={LINE_BUTTON}>
          Lancer une pyramide
        </button>
      </div>

      <section className="mt-[26px]">
        <span className={`${EYEBROW} text-graphite`}>Tes séances</span>
        {state.seances.length === 0 ? (
          <p className="text-[14px] text-graphite mt-2.5 mx-0.5">Aucune séance enregistrée pour l&apos;instant.</p>
        ) : (
          state.seances.map((seance) => (
            <div key={seance.id} className="flex items-center gap-2 bg-paper rounded-[18px] pl-4 pr-2 py-3.5 mt-2">
              <Link href={`/tracking/${seance.id}`} className="flex-1 flex items-center justify-between gap-4 min-w-0">
                <span className="min-w-0">
                  <span className="block text-15 font-medium">{formatDateFr(seance.completedAt)}</span>
                  {seance.pyramid ? (
                    <span className="block text-13 text-graphite mt-0.5">
                      <span>Pyramide · {seance.pyramid.exerciseName}</span>{" "}
                      <span className="font-mono text-11 tracking-[0.06em]">
                        {seance.pyramid.shape === "classic"
                          ? `1→${seance.pyramid.peak}→1`
                          : `${seance.pyramid.peak}→1→${seance.pyramid.peak}`}
                      </span>
                    </span>
                  ) : (
                    <span className="block text-13 text-graphite mt-0.5">
                      {seance.exerciseCount} exercice{seance.exerciseCount > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                <span className="text-right">
                  {seance.totalReps > 0 && (
                    <span className="block font-display font-bold text-[22px] tabular-nums">{seance.totalReps}</span>
                  )}
                  {seance.totalSeconds > 0 && (
                    <span
                      className={`block font-display tabular-nums ${
                        seance.totalReps > 0 ? "text-13 text-graphite" : "font-bold text-[22px]"
                      }`}
                    >
                      {seance.totalSeconds} s
                    </span>
                  )}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleDeleteSeance(seance.id)}
                aria-label="Supprimer la séance"
                className="text-graphite flex-none w-9 h-9 flex items-center justify-center"
              >
                <IconClose size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      {launcherOpen && (
        <Sheet open onClose={() => setLauncherOpen(false)} eyebrow="Pyramide" title="Lancer" accent="sage">
          <PyramidLauncher
            suggestions={[...new Set([...catalog.map((c) => c.name), ...exerciseSuggestions.map((e) => e.name)])]}
            catalog={catalog}
            lastPeaks={lastPeaks}
            activeHref={activeHref}
          />
        </Sheet>
      )}

      {editingDay && (
        <Sheet open onClose={() => setEditing(null)} eyebrow="Modifier le jour" title={editingDay.label} accent="sage">
          <DayEditor
            key={editingDay.dayOfWeek}
            day={editingDay}
            globalRestSeconds={globalRestSeconds}
            exerciseSuggestions={exerciseSuggestions}
            saving={saving}
            error={saveError}
            onSave={handleSave}
          />
        </Sheet>
      )}
    </div>
  );
}
