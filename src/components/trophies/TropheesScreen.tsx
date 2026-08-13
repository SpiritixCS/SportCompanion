"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { TrophyCard } from "./TrophyCard";
import { useCountUp } from "./useCountUp";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

type Tri = "reps" | "recent" | "alpha";
type Filtre = "tous" | "programme" | "dos";

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "reps", label: "Plus de reps" },
  { value: "recent", label: "Récent" },
  { value: "alpha", label: "Alphabétique" },
];

const FILTRE_OPTIONS: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "programme", label: "Programme" },
  { value: "dos", label: "Dos" },
];

function toggleButtonClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium whitespace-nowrap ${
    active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"
  }`;
}

export function TropheesScreen({ state }: { state: TropheesScreenState }) {
  const [tri, setTri] = useState<Tri>("reps");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const total = useCountUp(state.totalReps, 0);

  const cards = state.cards
    .filter((c) => filtre === "tous" || c.module === filtre)
    .sort((a, b) => {
      if (tri === "reps") return b.total - a.total;
      if (tri === "recent") return b.lastAt.localeCompare(a.lastAt);
      return a.name.localeCompare(b.name, "fr");
    });

  return (
    <div className="pb-10">
      <div className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-brass">
          Trophées
        </span>
        <div className="font-archivo text-44 font-semibold tabular-nums mt-3">{total}</div>
        <p className="text-15 text-graphite mt-1.5">
          {state.seanceCount} séance{state.seanceCount > 1 ? "s" : ""} · {state.joursActivite} jour
          {state.joursActivite > 1 ? "s" : ""} d&apos;activité
        </p>
      </div>

      <div className="sticky top-0 bg-canvas z-10 px-5 py-3 flex gap-2 overflow-x-auto border-b border-hairline">
        {TRI_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTri(opt.value)}
            className={toggleButtonClass(tri === opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <span className="w-px bg-hairline mx-1" />
        {FILTRE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFiltre(opt.value)}
            className={toggleButtonClass(filtre === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="px-5 pt-6">
          <Card className="p-6 text-center">
            <p className="text-15 text-graphite">Fais ta première séance pour commencer à cumuler.</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 min-[720px]:grid-cols-3 gap-3 px-5 pt-5">
          {cards.map((card, index) => (
            <TrophyCard key={card.id} card={card} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
