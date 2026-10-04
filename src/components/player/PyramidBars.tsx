import { pyramidSteps, type PyramidShape } from "@/lib/pyramide/pyramid";
import type { Accent } from "@/components/accent";

const DONE: Record<Accent, string> = { cobalt: "bg-cobalt", sage: "bg-sage", brass: "bg-brass" };
const SOFT: Record<Accent, string> = { cobalt: "bg-cobalt-soft", sage: "bg-sage-soft", brass: "bg-brass-soft" };

// La pyramide dessinée en barres : faites pleines, en cours qui se remplit, à venir grises.
export function PyramidBars({
  shape,
  peak,
  setNumber,
  accent,
}: {
  shape: PyramidShape;
  peak: number;
  setNumber: number;
  accent: Accent;
}) {
  const steps = pyramidSteps(shape, peak);
  return (
    <div aria-hidden="true" className="flex items-end gap-1 h-[70px] mt-4">
      {steps.map((reps, i) => {
        const state = i + 1 < setNumber ? "done" : i + 1 === setNumber ? "current" : "upcoming";
        return (
          <span
            key={i}
            data-testid="pyramid-bar"
            data-state={state}
            style={{ height: `${(reps / peak) * 100}%` }}
            className={`relative flex-1 rounded-[4px] overflow-hidden ${
              state === "done" ? DONE[accent] : state === "current" ? SOFT[accent] : "bg-hairline"
            }`}
          >
            {state === "current" && <span className={`set-pulse absolute inset-0 ${DONE[accent]}`} />}
          </span>
        );
      })}
    </div>
  );
}
