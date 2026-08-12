"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import type { ArbreId } from "@/lib/backpain/arbres";
import type { Reserve } from "@/lib/dos/bilan";

const RESERVE_OPTIONS: { value: Reserve; label: string }[] = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5 ou +" },
];

export function BilanDos({
  arbres,
  onValidate,
}: {
  arbres: { arbre: ArbreId; nom: string }[];
  onValidate: (reserves: Partial<Record<ArbreId, Reserve>>, genePendant: number) => void;
}) {
  const [reserves, setReserves] = useState<Partial<Record<ArbreId, Reserve>>>({});
  const [genePendant, setGenePendant] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = arbres.every((a) => reserves[a.arbre] !== undefined);

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
        <h1 className="font-archivo text-32 font-semibold">Bilan de séance</h1>
        <p className="text-15 text-graphite mt-2">Combien de répétitions te restait-il en réserve, à la dernière série ?</p>

        <div className="flex flex-col gap-5 mt-6">
          {arbres.map((a) => (
            <Card key={a.arbre} className="p-4">
              <div className="text-15 font-medium">{a.nom}</div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {RESERVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReserves((r) => ({ ...r, [a.arbre]: option.value }))}
                    className={`h-11 px-4 rounded-pill border font-archivo text-15 font-semibold ${
                      reserves[a.arbre] === option.value
                        ? "bg-sage text-paper border-sage"
                        : "bg-paper border-hairline text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <div className="text-15 font-medium">Gêne pendant la séance</div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <Button variant="secondary" onClick={() => setGenePendant((g) => Math.max(0, g - 1))}>
              −
            </Button>
            <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">{genePendant}</span>
            <Button variant="secondary" onClick={() => setGenePendant((g) => Math.min(10, g + 1))}>
              +
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
        <Button
          variant="primary"
          accent="sage"
          disabled={submitting || !allAnswered}
          onClick={() => {
            setSubmitting(true);
            onValidate(reserves, genePendant);
          }}
        >
          Valider la séance
        </Button>
      </div>
    </div>
  );
}
