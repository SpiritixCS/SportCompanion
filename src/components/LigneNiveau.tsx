import { Pastille, type PastilleState, type Accent } from "./Pastille";

export function LigneNiveau({
  level,
  days,
  accent,
}: {
  level: number;
  days: PastilleState[];
  accent: Accent;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-18 font-semibold w-6 text-right">{level}</span>
      <div className="flex gap-2">
        {days.map((state, i) => (
          <Pastille key={i} state={state} accent={accent} />
        ))}
      </div>
    </div>
  );
}
