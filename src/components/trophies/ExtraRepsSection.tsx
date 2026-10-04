"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FillButton } from "@/components/FillButton";
import { Sheet } from "@/components/Sheet";
import { addExtraRepsAction, deleteExtraRepsAction } from "@/lib/extraReps/actions";
import type { ExtraRepsEntry } from "@/lib/extraReps/db";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

// Reps faites hors séance, ajoutées à la main depuis la fiche d'un exercice.
export function ExtraRepsSection({
  cardId,
  unit,
  entries,
}: {
  cardId: string;
  unit: "reps" | "seconds";
  entries: ExtraRepsEntry[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<ExtraRepsEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const noun = unit === "seconds" ? "secondes" : "reps";
  const amount = Number(draft);
  const valid = /^\d+$/.test(draft) && amount > 0;

  async function handleAdd() {
    if (!valid || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await addExtraRepsAction(cardId, amount);
      setAddOpen(false);
      setDraft("");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await deleteExtraRepsAction(toDelete.id);
      setToDelete(null);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setAddOpen(true);
        }}
        className="mt-3 h-[54px] w-full rounded-pill bg-paper border border-hairline text-ink font-body text-15 font-semibold"
      >
        Ajouter des {noun}
      </button>

      {entries.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-11 uppercase tracking-[0.14em] text-graphite mb-3">
            Hors séance
          </h2>
          <div className="bg-paper rounded-[22px] overflow-hidden">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`min-h-14 px-4 flex items-center justify-between gap-4 ${i > 0 ? "border-t border-hairline" : ""}`}
              >
                <span className="font-display font-bold text-24 tabular-nums">+{entry.amount}</span>
                <span className="text-15 text-graphite flex-1">{formatDateFr(entry.loggedAt)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFailed(false);
                    setToDelete(entry);
                  }}
                  aria-label={`Supprimer +${entry.amount}`}
                  className="h-11 px-3 text-13 text-graphite"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={`Ajouter des ${noun}`}>
        <label htmlFor="extra-reps-amount" className="sr-only">
          Nombre de {noun}
        </label>
        <input
          id="extra-reps-amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={(e) => setDraft(e.target.value.trim())}
          className="w-full h-16 rounded-[18px] border border-hairline bg-paper px-4 font-display font-extrabold text-44 tabular-nums"
        />
        <p className="text-13 text-graphite mt-2">Compté aujourd&apos;hui, hors séance.</p>
        {failed && <p className="text-13 text-graphite mt-2">Impossible d&apos;enregistrer. Réessaie.</p>}
        <div className="mt-6">
          <FillButton accent="brass" onClick={handleAdd} disabled={!valid || busy}>
            Ajouter
          </FillButton>
        </div>
      </Sheet>

      <Sheet open={toDelete !== null} onClose={() => setToDelete(null)} title="Supprimer l'ajout">
        <p className="text-15 text-graphite">
          Retirer {toDelete?.amount} {noun} du total ?
        </p>
        {failed && <p className="text-13 text-graphite mt-2">Impossible d&apos;enregistrer. Réessaie.</p>}
        <div className="flex flex-col gap-2.5 mt-6">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="h-14 rounded-pill border border-alert text-alert font-body text-15 font-semibold"
          >
            Retirer
          </button>
          <button
            type="button"
            onClick={() => setToDelete(null)}
            className="h-14 rounded-pill bg-ink text-paper font-body text-15 font-semibold"
          >
            Annuler
          </button>
        </div>
      </Sheet>
    </>
  );
}
