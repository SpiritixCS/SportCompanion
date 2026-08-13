"use client";

import { useState } from "react";
import { TrophyCard } from "./TrophyCard";
import { useCountUp } from "./useCountUp";
import type { TropheesScreenState } from "@/lib/trophies/loadTropheesScreenState";

type Tri = "reps" | "recent" | "alpha";
type Filtre = "tous" | "programme" | "dos" | "tracking";

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "reps", label: "Plus de reps" },
  { value: "recent", label: "Récent" },
  { value: "alpha", label: "Alphabétique" },
];

function toggleButtonClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium whitespace-nowrap ${
    active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"
  }`;
}

export function TropheesScreen({
  state,
  secondModule,
}: {
  state: TropheesScreenState;
  secondModule: { value: "dos" | "tracking"; label: string };
}) {
  const [tri, setTri] = useState<Tri>("reps");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const total = useCountUp(state.totalReps, 0);

  const filtreOptions: { value: Filtre; label: string }[] = [
    { value: "tous", label: "Tous" },
    { value: "programme", label: "Programme" },
    secondModule,
  ];

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
        {filtreOptions.map((opt) => (
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
          {/* Carte fantôme : même silhouette qu'une TrophyCard, mais en
              contour hairline transparent — même langage visuel que la
              pastille "à venir" (border-hairline, bg-transparent), pas une
              nouvelle convention. */}
          <div className="w-1/2 min-[720px]:w-1/3 rounded-card border border-dashed border-hairline bg-transparent overflow-hidden">
            <div className="aspect-square" />
            <div className="p-4">
              <div className="h-3.5 w-3/4 rounded-pill bg-hairline/60" />
              <div className="h-6 w-1/2 rounded-pill bg-hairline/60 mt-3" />
            </div>
          </div>
          <p className="text-15 text-graphite mt-5">
            Fais ta première séance pour commencer à cumuler.
          </p>
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
