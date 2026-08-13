"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";

const STEP_SECONDS = 15;
const FLOOR_SECONDS = 15;

export function DurationRow({
  label,
  valueSeconds,
  onConfirm,
  divider = false,
}: {
  label: string;
  valueSeconds: number;
  onConfirm: (nextSeconds: number) => void;
  divider?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(valueSeconds);

  useEffect(() => {
    if (open) setDraft(valueSeconds);
  }, [open, valueSeconds]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={`w-full min-h-14 px-5 flex items-center justify-between gap-4 ${
          divider ? "border-t border-hairline" : ""
        }`}
      >
        <span className="text-15">{label}</span>
        <span className="font-archivo text-15 font-medium text-graphite tabular-nums">{valueSeconds} s</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex flex-col items-center gap-1 py-4">
          <div className="flex items-center justify-center gap-6">
            <Button variant="secondary" onClick={() => setDraft((v) => Math.max(FLOOR_SECONDS, v - STEP_SECONDS))}>
              −
            </Button>
            <span className="font-archivo text-44 font-semibold tabular-nums w-24 text-center">{draft}</span>
            <Button variant="secondary" onClick={() => setDraft((v) => v + STEP_SECONDS)}>
              +
            </Button>
          </div>
          <span className="text-13 text-graphite">secondes</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onConfirm(draft);
            setOpen(false);
          }}
          className="h-14 w-full rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
        >
          Valider
        </button>
      </Sheet>
    </>
  );
}
