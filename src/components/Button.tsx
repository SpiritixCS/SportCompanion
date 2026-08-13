import { ACCENT_BG, type Accent } from "./Pastille";

export function Button({
  children,
  variant,
  accent,
  onClick,
  disabled = false,
  ariaLabel,
}: {
  children: React.ReactNode;
  variant: "primary" | "secondary";
  accent?: Accent;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const base =
    "h-14 w-full rounded-pill font-archivo text-15 font-semibold disabled:opacity-40";
  const variantClasses =
    variant === "primary" && accent
      ? `${ACCENT_BG[accent]} text-paper`
      : "bg-paper border border-hairline text-ink";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${base} ${variantClasses}`}
    >
      {children}
    </button>
  );
}
