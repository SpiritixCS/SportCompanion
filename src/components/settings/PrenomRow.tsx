"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";

export function PrenomRow({ prenom, onConfirm }: { prenom: string; onConfirm: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(prenom);
  const blank = draft.trim().length === 0;

  useEffect(() => {
    if (open) setDraft(prenom);
  }, [open, prenom]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Prénom"
        className="w-full min-h-14 px-5 flex items-center justify-between gap-4"
      >
        <span className="text-15">Prénom</span>
        <span className="font-display text-15 font-medium text-graphite">{prenom}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Prénom">
        <label htmlFor="reglages-prenom" className="sr-only">
          Ton prénom
        </label>
        <input
          id="reglages-prenom"
          type="text"
          autoComplete="given-name"
          maxLength={40}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full h-14 rounded-field border border-hairline bg-paper px-4 text-15"
        />
        <button
          type="button"
          disabled={blank}
          onClick={() => {
            onConfirm(draft);
            setOpen(false);
          }}
          className="mt-6 h-14 w-full rounded-pill bg-ink text-paper font-body text-15 font-semibold disabled:opacity-40"
        >
          Valider
        </button>
      </Sheet>
    </>
  );
}
