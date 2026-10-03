import type { Accent, PastilleState } from "./Pastille";

const LABELS: Record<PastilleState, string> = {
  done: "Fait",
  today: "Aujourd'hui",
  upcoming: "À venir",
  skipped: "Sauté",
  restOrWalk: "Repos",
};

// Classes littérales (le scanner Tailwind lit le source, il n'exécute rien).
const ACCENT_FILL: Record<Accent, string> = { cobalt: "bg-cobalt", sage: "bg-sage", brass: "bg-brass" };
const ACCENT_TEXT: Record<Accent, string> = { cobalt: "text-cobalt", sage: "text-sage", brass: "text-brass" };

function traitClass(state: PastilleState, accent: Accent): string {
  switch (state) {
    case "done":
      return ACCENT_FILL[accent];
    case "today":
      return `${ACCENT_FILL[accent]} opacity-35`;
    case "restOrWalk":
      return "bg-hairline h-0.5";
    default:
      return "bg-hairline";
  }
}

// La semaine en sept traits (remplace les pastilles) : fait = plein,
// aujourd'hui = accent pâle, repos = trait fin, à venir = gris.
export function SeptTraits({
  states,
  accent = "cobalt",
  size = "lg",
  showNumbers = false,
  todayCaret = false,
}: {
  states: PastilleState[];
  accent?: Accent;
  size?: "lg" | "sm";
  showNumbers?: boolean;
  todayCaret?: boolean;
}) {
  const lg = size === "lg";
  return (
    <div className={`flex ${lg ? "gap-2" : "gap-1"}`}>
      {states.map((state, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className={`flex items-center ${lg ? "h-1.5" : "h-1"}`}>
            <span
              role="img"
              aria-label={`Jour ${i + 1} : ${LABELS[state]}`}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`trait-grow block rounded-pill ${lg ? "w-8" : "w-[22px]"} ${
                state === "restOrWalk" ? "" : lg ? "h-1.5" : "h-1"
              } ${traitClass(state, accent)}`}
            />
          </div>
          {showNumbers && (
            <span
              className={`font-mono text-[10px] mt-2.5 tabular-nums ${
                state === "today" ? `${ACCENT_TEXT[accent]} font-medium` : "text-graphite"
              }`}
            >
              {i + 1}
            </span>
          )}
          {todayCaret && (
            <span
              aria-hidden="true"
              data-caret={state === "today" ? "true" : undefined}
              className={`mt-1 h-2 ${state === "today" ? ACCENT_TEXT[accent] : "invisible"}`}
            >
              <svg width="10" height="7" viewBox="0 0 10 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 6l4-4 4 4" />
              </svg>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
