"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { FillButton } from "@/components/FillButton";

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
        className={`w-full min-h-14 px-4 flex items-center justify-between gap-4 ${
          divider ? "border-t border-hairline" : ""
        }`}
      >
        <span className="text-15">{label}</span>
        <span className="font-mono text-13 text-graphite tabular-nums">{valueSeconds} s</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="grid grid-cols-[64px_1fr_64px] items-center my-3.5">
          <button type="button" onClick={() => setDraft((v) => Math.max(FLOOR_SECONDS, v - STEP_SECONDS))} className="w-16 h-16 rounded-pill border border-hairline bg-paper font-body text-[30px] text-ink">
            −
          </button>
          <span className="text-center font-display font-extrabold text-112 leading-[0.85] tabular-nums">{draft}</span>
          <button type="button" onClick={() => setDraft((v) => v + STEP_SECONDS)} className="w-16 h-16 rounded-pill border border-hairline bg-paper font-body text-[30px] text-ink">
            +
          </button>
        </div>
        <p className="text-center font-mono text-11 uppercase tracking-[0.14em] text-graphite mb-[18px]">secondes</p>
        <FillButton
          onClick={() => {
            onConfirm(draft);
            setOpen(false);
          }}
        >
          Valider
        </FillButton>
      </Sheet>
    </>
  );
}
