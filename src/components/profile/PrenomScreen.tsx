"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPrenomAction } from "@/lib/profile/actions";

// Premier accès d'un nouvel utilisateur : le prénom est demandé une fois,
// avant tout écran du shell. Le layout le relit en DB après refresh.
export function PrenomScreen() {
  const router = useRouter();
  const [prenom, setPrenom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const blank = prenom.trim().length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <main className="min-h-dvh flex flex-col justify-center p-5 max-w-[520px] mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <span className="font-display text-11 font-medium uppercase tracking-[0.08em] text-graphite">Bienvenue</span>
        <h1 className="font-display text-32 font-semibold mt-3">Comment tu t&apos;appelles ?</h1>
        <label htmlFor="prenom" className="text-13 text-graphite mt-8">
          Prénom
        </label>
        <input
          id="prenom"
          type="text"
          autoComplete="given-name"
          maxLength={40}
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          className="h-14 rounded-field border border-hairline bg-paper px-4 text-15 mt-2"
        />
        {error && <p className="text-13 text-graphite mt-3">Impossible d&apos;enregistrer. Réessaie.</p>}
        <button
          type="submit"
          disabled={blank || saving}
          className="mt-6 h-14 rounded-pill bg-ink text-paper font-display text-15 font-semibold disabled:opacity-40"
        >
          Continuer
        </button>
      </form>
    </main>
  );
}
