"use client";

import { useState } from "react";
import { TrophyCard } from "./TrophyCard";
import { useCountUp } from "./useCountUp";
import { CycleButton } from "@/components/CycleButton";
import { closestPalier } from "@/lib/trophies/paliers";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

type Tri = "reps" | "recent" | "alpha";
type Filtre = "tous" | "programme" | "tracking";

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "reps", label: "Plus de reps" },
  { value: "recent", label: "Récent" },
  { value: "alpha", label: "A → Z" },
];

const FILTRE_OPTIONS: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "programme", label: "Programme" },
  { value: "tracking", label: "Tracking" },
];

const fr = (n: number) => n.toLocaleString("fr-FR");

export function TropheesScreen({ state }: { state: TropheesScreenState }) {
  const [tri, setTri] = useState<Tri>("reps");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const total = useCountUp(state.totalReps, 0);
  const next = closestPalier(state.cards);

  const cards = state.cards
    .filter((c) => filtre === "tous" || c.module === filtre)
    .sort((a, b) => {
      if (tri === "reps") return b.total - a.total;
      if (tri === "recent") return b.lastAt.localeCompare(a.lastAt);
      return a.name.localeCompare(b.name, "fr");
    });

  return (
    <div className="px-[18px] pt-5 pb-10">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-brass-ink">Trophées</span>
      <div data-testid="trophees-total" className="font-display font-extrabold text-112 leading-[0.82] tabular-nums mt-2.5">
        {fr(total)}
        <small className="font-mono text-[12px] font-normal tracking-[0.1em] uppercase text-graphite ml-1.5">reps</small>
      </div>
      <p className="text-[14px] text-graphite mt-2.5">
        {state.seanceCount} séance{state.seanceCount > 1 ? "s" : ""} · {state.joursActivite} jour
        {state.joursActivite > 1 ? "s" : ""} d&apos;activité
      </p>

      {next && (
        <div className="mt-[18px] bg-paper rounded-[22px] px-4 py-3.5">
          <div className="flex justify-between items-baseline gap-3">
            <span className="font-mono text-11 uppercase tracking-[0.14em] text-brass-ink">Prochain palier</span>
            <span className="font-display font-bold text-[20px] tabular-nums">
              {fr(next.card.total)} / {fr(next.progress.next)}
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-3 mt-1">
            <b className="font-semibold truncate">{next.card.name}</b>
            <span className="text-13 text-graphite whitespace-nowrap tabular-nums">{fr(next.left)} restants</span>
          </div>
          <div className="h-1 rounded-pill bg-hairline mt-2.5 overflow-hidden">
            <div className="trait-grow h-full rounded-pill bg-brass" style={{ width: `${next.progress.fraction * 100}%` }} />
          </div>
        </div>
      )}

      <div role="group" aria-label="Tri et filtre" className="flex gap-2 mt-[18px] overflow-x-auto [scrollbar-width:none]">
        <CycleButton options={TRI_OPTIONS} value={tri} onChange={setTri} ariaLabelPrefix="Trier" />
        <span aria-hidden="true" className="w-px bg-hairline flex-none my-1 mx-0.5" />
        {FILTRE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={filtre === opt.value}
            onClick={() => setFiltre(opt.value)}
            className={`h-[34px] px-[13px] rounded-pill font-body text-13 font-medium whitespace-nowrap border ${
              filtre === opt.value ? "bg-ink border-ink text-paper" : "bg-paper border-hairline text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {state.cards.length === 0 ? (
        <div className="pt-4">
          <div className="w-[calc(50%-4px)] h-[168px] rounded-[22px] border border-dashed border-hairline" />
          <p className="text-[14px] text-graphite mt-4">Fais ta première séance pour commencer à cumuler.</p>
        </div>
      ) : cards.length === 0 ? (
        <p className="text-[14px] text-graphite mt-4">
          Aucun exercice {filtre === "tracking" ? "Tracking" : "Programme"} pour l&apos;instant.
        </p>
      ) : (
        <div className="grid grid-cols-2 min-[720px]:grid-cols-3 gap-2 mt-3.5">
          {cards.map((card, index) => (
            <TrophyCard key={card.id} card={card} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
