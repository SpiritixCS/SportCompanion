"use client";

import { useEffect, useState } from "react";
import { IconClose } from "@/components/icons/IconClose";
import { IconChevronRight } from "@/components/icons/IconChevronRight";
import { Toggle } from "./Toggle";
import { DurationRow } from "./DurationRow";
import { getReglagesStateAction, updateSettingsAction, type ReglagesState } from "@/lib/settings/actions";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function ReglagesScreen({
  onClose,
  onChangePointDepart,
  programmePosition,
}: {
  onClose: () => void;
  onChangePointDepart: () => void;
  programmePosition: { parcoursLabel: string; level: number; dayIndex: number } | null;
}) {
  const [state, setState] = useState<ReglagesState | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    getReglagesStateAction()
      .then(setState)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(update: Partial<Omit<ReglagesState, "dosStartDate" | "version">>) {
    try {
      const next = await updateSettingsAction(update);
      setState((prev) => (prev ? { ...prev, ...next } : prev));
    } catch {
      setError(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      <div className="flex-none p-5 flex items-center justify-between gap-4">
        <span className="font-archivo text-24 font-semibold">Réglages</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center"
        >
          <IconClose />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-8">
        {error && (
          <div className="bg-paper border border-hairline rounded-card p-6">
            <p className="text-15 text-graphite">Impossible de charger les réglages.</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 h-11 px-5 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
            >
              Réessayer
            </button>
          </div>
        )}

        {!error && !state && (
          <div className="flex flex-col gap-8">
            <div className="h-40 rounded-card bg-paper border border-hairline animate-pulse" />
            <div className="h-40 rounded-card bg-paper border border-hairline animate-pulse" />
          </div>
        )}

        {state && (
          <>
            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                Programme
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4">
                  <span className="text-15">Parcours actif</span>
                  <span className="font-archivo text-15 font-medium text-graphite">
                    {programmePosition?.parcoursLabel ?? "Non défini"}
                  </span>
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Position</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums">
                    {programmePosition
                      ? `Niveau ${programmePosition.level + 1} · Jour ${programmePosition.dayIndex + 1}`
                      : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onChangePointDepart}
                  className="w-full min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline"
                >
                  <span className="text-15">Changer mon point de départ</span>
                  <IconChevronRight className="text-graphite flex-none" />
                </button>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                Séance
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <DurationRow
                  label="Repos entre séries"
                  valueSeconds={state.restBetweenSetsSeconds}
                  onConfirm={(v) => patch({ restBetweenSetsSeconds: v })}
                />
                <DurationRow
                  label="Repos entre exercices"
                  valueSeconds={state.restBetweenExercisesSeconds}
                  onConfirm={(v) => patch({ restBetweenExercisesSeconds: v })}
                  divider
                />
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Décompte sonore</span>
                  <Toggle
                    checked={state.soundCountdownEnabled}
                    onChange={(v) => patch({ soundCountdownEnabled: v })}
                    label="Décompte sonore"
                  />
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Compte à rebours</span>
                  <Toggle
                    checked={state.startCountdownEnabled}
                    onChange={(v) => patch({ startCountdownEnabled: v })}
                    label="Compte à rebours"
                  />
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline">
                  <span className="text-15">Garder l&apos;écran allumé</span>
                  <Toggle
                    checked={state.keepScreenAwakeEnabled}
                    onChange={(v) => patch({ keepScreenAwakeEnabled: v })}
                    label="Garder l'écran allumé"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                BackPain
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4">
                  <span className="text-15">Début de cycle</span>
                  <span className="font-archivo text-15 font-medium text-graphite">
                    {state.dosStartDate ? formatDateFr(state.dosStartDate) : "Non défini"}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                Données
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 opacity-40">
                  <span className="text-15">
                    Exporter
                    <span className="block text-13 text-graphite mt-0.5">Bientôt disponible</span>
                  </span>
                </div>
                <div className="min-h-14 px-5 flex items-center justify-between gap-4 border-t border-hairline opacity-40">
                  <span className="text-15 text-alert">
                    Réinitialiser la progression
                    <span className="block text-13 text-graphite mt-0.5">Bientôt disponible</span>
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mb-3">
                À propos
              </h2>
              <div className="bg-paper border border-hairline rounded-card overflow-hidden">
                <div className="min-h-14 px-5 flex items-center justify-between gap-4">
                  <span className="text-15">Version</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums">{state.version}</span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
