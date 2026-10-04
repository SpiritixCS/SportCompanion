"use client";


export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="px-[18px] pt-5">
      <div className="bg-paper rounded-[28px] p-6">
        <span className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">
          Erreur
        </span>
        <div className="font-display font-extrabold text-32 uppercase leading-[0.92] mt-2">
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
      </div>
    </div>
  );
}
