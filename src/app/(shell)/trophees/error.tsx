"use client";

export default function TropheesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="px-[18px] pt-5">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-brass-ink">Trophées</span>
      <p className="text-15 text-graphite mt-2">Impossible de charger les trophées.</p>
      <button
        type="button"
        onClick={reset}
        className="h-11 px-4 rounded-pill bg-ink text-paper font-body text-15 font-semibold mt-4"
      >
        Réessayer
      </button>
    </div>
  );
}
