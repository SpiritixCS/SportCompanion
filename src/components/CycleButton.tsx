"use client";

// Un seul bouton qui passe à l'option suivante à chaque toucher (préférence
// de Mathis pour les options qui tournent en boucle, ex. le tri des Trophées).
export function CycleButton<T extends string>({
  options,
  value,
  onChange,
  ariaLabelPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabelPrefix: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index]!;
  return (
    <button
      type="button"
      aria-label={`${ariaLabelPrefix} : ${current.label}`}
      onClick={() => onChange(options[(index + 1) % options.length]!.value)}
      className="h-[34px] px-3.5 rounded-pill bg-ink text-paper inline-flex items-center gap-2 font-body text-13 font-medium whitespace-nowrap"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
      </svg>
      <span className="inline-block overflow-hidden h-[1.2em] leading-[1.2em]">
        <span key={current.value} className="cycle-in inline-block">
          {current.label}
        </span>
      </span>
    </button>
  );
}
