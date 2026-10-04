"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { FillButton } from "@/components/FillButton";
import type { Accent } from "@/components/accent";

// ponytail: stepper (−/valeur/+) au lieu d'une vraie molette à
// glisser/snap — le brief design l'appelle "feuille à molette", une
// vraie molette est beaucoup plus d'ingénierie d'interaction pour un
// gain marginal ici. Upgrade si ça se sent comme une friction réelle en
// séance.
export function RepsSheet({
  open,
  onClose,
  initialValue,
  accent = "cobalt",
  title = "Ajuster les reps",
  onConfirm,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number;
  accent?: Accent;
  title?: string;
  onConfirm: (value: number) => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid grid-cols-[64px_1fr_64px] items-center my-3.5 mb-[18px]">
        <button
          type="button"
          aria-label="−"
          onClick={() => setValue((v) => Math.max(0, v - 1))}
          className="w-16 h-16 rounded-pill border border-hairline bg-paper font-body text-[30px] text-ink"
        >
          −
        </button>
        <span key={value} className="value-bump text-center font-display font-extrabold text-112 leading-[0.85] tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label="+"
          onClick={() => setValue((v) => v + 1)}
          className="w-16 h-16 rounded-pill border border-hairline bg-paper font-body text-[30px] text-ink"
        >
          +
        </button>
      </div>
      <FillButton accent={accent} onClick={() => onConfirm(value)}>
        Valider
      </FillButton>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 w-full h-11 flex items-center justify-center font-body text-15 font-medium text-alert"
        >
          Supprimer la série
        </button>
      )}
    </Sheet>
  );
}
