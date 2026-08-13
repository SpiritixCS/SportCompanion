"use client";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-pill flex-none transition-colors ${checked ? "bg-ink" : "bg-hairline"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
