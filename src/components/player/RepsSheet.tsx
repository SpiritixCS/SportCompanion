"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import type { Accent } from "@/components/Pastille";

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
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number;
  accent?: Accent;
  onConfirm: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Sheet open={open} onClose={onClose} title="Ajuster les reps">
      <div className="flex items-center justify-center gap-6 py-4">
        <Button variant="secondary" onClick={() => setValue((v) => Math.max(0, v - 1))}>
          −
        </Button>
        <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">
          {value}
        </span>
        <Button variant="secondary" onClick={() => setValue((v) => v + 1)}>
          +
        </Button>
      </div>
      <Button variant="primary" accent={accent} onClick={() => onConfirm(value)}>
        Valider
      </Button>
    </Sheet>
  );
}
