const LABELS: Record<PastilleState, string> = {
  upcoming: "À venir",
  today: "Aujourd'hui",
  done: "Fait",
  skipped: "Sauté",
  restOrWalk: "Repos ou marche",
};

export type PastilleState = "upcoming" | "today" | "done" | "skipped" | "restOrWalk";
export type Accent = "cobalt" | "sage" | "brass";

// Class names must be literal strings, not template interpolation:
// Tailwind's build-time scanner reads source text, it never executes JS,
// so `border-${accent}` would never generate real CSS in production.
export const ACCENT_BORDER: Record<Accent, string> = {
  cobalt: "border-cobalt",
  sage: "border-sage",
  brass: "border-brass",
};
export const ACCENT_BG: Record<Accent, string> = {
  cobalt: "bg-cobalt",
  sage: "bg-sage",
  brass: "bg-brass",
};

const STATE_CLASSES: Record<PastilleState, (accent: Accent) => string> = {
  upcoming: () => "border border-hairline bg-transparent",
  today: (accent) => `border-2 ${ACCENT_BORDER[accent]} bg-transparent`,
  done: (accent) => `${ACCENT_BG[accent]} border ${ACCENT_BORDER[accent]}`,
  skipped: () => "bg-hairline border border-hairline",
  restOrWalk: () => "border border-hairline bg-transparent relative",
};

export function Pastille({ state, accent }: { state: PastilleState; accent: Accent }) {
  return (
    <span
      role="img"
      aria-label={LABELS[state]}
      className={`inline-block w-3 h-3 rounded-pill ${STATE_CLASSES[state](accent)}`}
    />
  );
}
