"use client";

export default function TropheesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-5">
      <p className="text-15 text-graphite">Impossible de charger les trophées.</p>
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
