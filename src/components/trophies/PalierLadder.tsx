import { PALIERS, palierProgress } from "@/lib/trophies/paliers";

// Les 6 paliers en traits : atteints pleins en or, celui en cours rempli en partie.
export function PalierLadder({ total }: { total: number }) {
  const progress = palierProgress(total);
  return (
    <div className="bg-paper rounded-[22px] p-4 mt-[18px]">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-brass-ink">Paliers</span>
      <div className="grid grid-cols-6 gap-1 mt-3">
        {PALIERS.map((v, i) => {
          const prev = i ? PALIERS[i - 1]! : 0;
          const fill = total >= v ? 1 : total > prev ? (total - prev) / (v - prev) : 0;
          return (
            <div key={v} className="flex flex-col gap-1.5">
              <span className="block h-1.5 rounded-pill bg-hairline overflow-hidden">
                <span
                  data-testid="palier-fill"
                  className="trait-grow block h-full rounded-pill bg-brass"
                  style={{ width: `${Math.round(fill * 100)}%`, animationDelay: `${i * 80}ms` }}
                />
              </span>
              <span
                className={`font-mono text-[10px] text-center ${total >= v ? "text-brass-ink font-medium" : "text-graphite"}`}
              >
                {v >= 1000 ? `${v / 1000} k` : v}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3.5 text-[14px] text-graphite">
        {progress ? (
          <>
            <b className="text-ink font-semibold">{(progress.next - total).toLocaleString("fr-FR")} reps</b> pour atteindre{" "}
            {progress.next.toLocaleString("fr-FR")}.
          </>
        ) : (
          "Tous les paliers atteints."
        )}
      </p>
    </div>
  );
}
