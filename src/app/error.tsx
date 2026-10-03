"use client";

import { Card } from "@/components/Card";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="p-5">
      <Card className="p-6">
        <span className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">
          Erreur
        </span>
        <div className="font-display text-24 font-semibold mt-3 leading-[1.15]">
          Une erreur est survenue.
        </div>
        <div className="text-15 text-graphite mt-3">{error.message || "Impossible de charger cette page."}</div>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 w-full h-14 rounded-pill bg-ink text-paper font-body text-15 font-semibold"
        >
          Réessayer
        </button>
      </Card>
    </div>
  );
}
