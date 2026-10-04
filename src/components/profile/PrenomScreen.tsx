"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPrenomAction } from "@/lib/profile/actions";
import { FillButton } from "@/components/FillButton";

// Les trois modules, dans leur couleur (CLAUDE.md §4 : la couleur encode le module).
const MODULES = [
  { label: "Programme", text: "Trois parcours au poids du corps.", bar: "bg-cobalt", ink: "text-cobalt" },
  { label: "Tracking", text: "Compose ta propre semaine d'entraînement.", bar: "bg-sage", ink: "text-sage-strong" },
  { label: "Trophées", text: "Garde une trace de tes perfs.", bar: "bg-brass", ink: "text-brass-ink" },
] as const;

// Premier accès d'un nouvel utilisateur : le prénom est demandé une fois,
// avant tout écran du shell. Le layout le relit en DB après refresh.
export function PrenomScreen() {
  const router = useRouter();
  const [prenom, setPrenom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const blank = prenom.trim().length === 0;

  async function submit() {
    if (blank || saving) return;
    setSaving(true);
    setError(false);
    try {
      await setPrenomAction(prenom);
      router.refresh();
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-[18px] pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-[520px] mx-auto">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">SportCompanion</span>

      <div className="flex gap-2 mt-5" aria-hidden="true">
        {MODULES.map((m, i) => (
          <span key={m.label} className={`trait-grow h-1.5 flex-1 rounded-pill ${m.bar}`} style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>

      <span className="font-mono text-11 uppercase tracking-[0.14em] text-graphite mt-5">Bienvenue</span>
      <h1 className="font-display font-extrabold text-44 uppercase leading-[0.9] mt-1.5">Comment tu t&apos;appelles ?</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col mt-5"
      >
        <div className="bg-paper rounded-card px-5 pt-3 pb-2 border border-transparent focus-within:border-ink transition-colors">
          <label htmlFor="prenom" className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">
            Prénom
          </label>
          <input
            id="prenom"
            type="text"
            autoComplete="given-name"
            maxLength={40}
            value={prenom}
            placeholder="Ton prénom"
            onChange={(e) => setPrenom(e.target.value)}
            className="field-bare w-full bg-transparent font-display font-extrabold text-[32px] uppercase leading-none mt-1 placeholder:text-hairline"
          />
        </div>
        {error && <p className="text-13 text-graphite mt-3">Impossible d&apos;enregistrer. Réessaie.</p>}
        <div className="mt-3">
          <FillButton onClick={submit} disabled={blank || saving}>
            Continuer
          </FillButton>
        </div>
      </form>

      <ul className="card-rise bg-paper rounded-card mt-5 px-5">
        {MODULES.map((m, i) => (
          <li key={m.label} className={`flex gap-3.5 py-3 ${i > 0 ? "border-t border-hairline" : ""}`}>
            <span className={`w-1 rounded-pill flex-none ${m.bar}`} aria-hidden="true" />
            <div>
              <span className={`font-mono text-11 uppercase tracking-[0.14em] ${m.ink}`}>{m.label}</span>
              <p className="text-13 text-graphite">{m.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
