"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CycleButton } from "@/components/CycleButton";
import { FillButton } from "@/components/FillButton";
import { ExerciseGlyph } from "@/components/glyphs/ExerciseGlyph";
import { InitialTile } from "@/components/glyphs/InitialTile";
import { startPyramidAction } from "@/lib/tracking/actions";
import { clampPeak, pyramidSteps, pyramidTotal, type PyramidShape } from "@/lib/pyramide/pyramid";
import type { CatalogExercise } from "@/lib/pyramide/catalog";

const SHAPES: { value: PyramidShape; label: string }[] = [
  { value: "classic", label: "Classique" },
  { value: "inverted", label: "Inversée" },
];
const DEFAULT_PEAK = 5;
const key = (name: string) => name.trim().toLowerCase();
// Recherche sans casse ni accents (« elev » trouve « Élévations »).
const fold = (name: string) => key(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const MAX_SUGGESTIONS = 6;

function narrow(suggestions: string[], query: string): string[] {
  const q = fold(query);
  if (!q) return [];
  const starts = suggestions.filter((s) => fold(s).startsWith(q));
  const contains = suggestions.filter((s) => !fold(s).startsWith(q) && fold(s).includes(q));
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

// Contenu de la feuille « Lancer une pyramide » (page Tracking).
export function PyramidLauncher({
  suggestions,
  catalog = [],
  lastPeaks,
  activeHref,
}: {
  suggestions: string[];
  catalog?: CatalogExercise[];
  lastPeaks: Record<string, number>;
  activeHref: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shape, setShape] = useState<PyramidShape>("classic");
  const [peak, setPeak] = useState(DEFAULT_PEAK);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const matches = listOpen ? narrow(suggestions, name) : [];
  const linked = catalog.find((c) => key(c.name) === key(name)) ?? null;
  const steps = pyramidSteps(shape, peak);

  function handleName(next: string) {
    setName(next);
    setListOpen(true);
    const last = lastPeaks[key(next)];
    if (last !== undefined) setPeak(last);
  }

  async function handleLaunch() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await startPyramidAction({ exerciseName: name.trim(), shape, peak });
      router.push("/player/pyramide");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const step = "w-11 h-11 rounded-pill border border-hairline bg-paper font-body text-[22px]";

  return (
    <div>
      <label htmlFor="pyramid-exercise" className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">
        Exercice
      </label>
      <div className="mt-2 flex items-center gap-3 h-[52px] rounded-[14px] border border-hairline bg-paper px-2 focus-within:border-sage">
        {name.trim() ? (
          linked ? (
            <ExerciseGlyph exerciseId={linked.id} family={linked.movementFamily} accent="sage" />
          ) : (
            <InitialTile name={name} />
          )
        ) : (
          <span className="w-9 h-9 rounded-[10px] bg-sage-soft flex-none" aria-hidden="true" />
        )}
        <input
          id="pyramid-exercise"
          type="text"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="pyramid-suggestions"
          autoComplete="off"
          value={name}
          onChange={(e) => handleName(e.target.value)}
          placeholder="Nom de l'exercice"
          className="flex-1 min-w-0 h-full bg-transparent text-15 outline-none focus-visible:outline-none"
        />
      </div>
      {matches.length > 0 && (
        <div id="pyramid-suggestions" role="listbox" className="mt-1.5 bg-paper border border-hairline rounded-[14px] overflow-hidden">
          {matches.map((m, i) => (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                handleName(m);
                setListOpen(false);
              }}
              className={`w-full text-left px-3.5 min-h-11 text-15 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-3.5">
        <span className="text-15">Forme</span>
        <CycleButton options={SHAPES} value={shape} onChange={setShape} ariaLabelPrefix="Forme" />
      </div>
      <div className="flex justify-between items-center mt-3.5">
        <span className="text-15">Sommet</span>
        <span className="flex items-center gap-3">
          <button type="button" aria-label="Sommet moins" onClick={() => setPeak((v) => clampPeak(v - 1))} className={step}>
            −
          </button>
          <b className="font-display font-extrabold text-44 leading-none min-w-14 text-center tabular-nums">{peak}</b>
          <button type="button" aria-label="Sommet plus" onClick={() => setPeak((v) => clampPeak(v + 1))} className={step}>
            +
          </button>
        </span>
      </div>

      <div aria-hidden="true" className="flex items-end gap-[3px] h-16 mt-4">
        {steps.map((reps, i) => (
          <span
            key={i}
            style={{ height: `${(reps / peak) * 100}%` }}
            className="flex-1 rounded-[3px] bg-sage transition-[height] duration-300 motion-reduce:transition-none"
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[12px] tracking-[0.06em] text-graphite mt-1.5 mb-4 tabular-nums">
        <span>{shape === "classic" ? `1 → ${peak} → 1` : `${peak} → 1 → ${peak}`}</span>
        <span>
          {pyramidTotal(shape, peak)} reps · {steps.length} marches
        </span>
      </div>

      {failed && <p className="text-13 text-alert mb-3">Impossible de lancer la pyramide. Réessaie.</p>}

      {activeHref ? (
        <Link
          href={activeHref}
          className="h-14 w-full rounded-pill bg-ink text-paper flex items-center justify-center font-body text-15 font-semibold"
        >
          Reprendre ta séance en cours
        </Link>
      ) : (
        <FillButton accent="sage" onClick={handleLaunch} disabled={!name.trim() || busy}>
          Lancer
        </FillButton>
      )}
    </div>
  );
}
