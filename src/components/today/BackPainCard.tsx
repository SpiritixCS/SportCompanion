import Link from "next/link";
import { Card } from "@/components/Card";
import { IconCheck } from "@/components/icons/IconCheck";

export function BackPainCard({
  jourLabel,
  intitule,
  exercisesPreview,
  exercisesRestCount,
  done,
  doneReps,
  href,
}: {
  jourLabel: string;
  intitule: string;
  exercisesPreview: { name: string; dose: string }[];
  exercisesRestCount: number;
  done: boolean;
  doneReps: number | null;
  href: string;
}) {
  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>

      <div className="font-archivo text-24 font-semibold mt-3.5">
        {jourLabel} · {intitule}
      </div>

      {exercisesPreview.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {exercisesPreview.map((e) => (
            <div key={e.name} className="flex items-baseline justify-between gap-4">
              <span className="text-15">{e.name}</span>
              <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                {e.dose}
              </span>
            </div>
          ))}
          {exercisesRestCount > 0 && (
            <div className="text-13 text-graphite">
              {exercisesRestCount === 1 ? "et 1 autre" : `et ${exercisesRestCount} autres`}
            </div>
          )}
        </div>
      )}

      {done ? (
        <>
          <div className="flex items-center gap-4 mt-5 pt-5 border-t border-hairline">
            <span className="w-9 h-9 rounded-pill bg-sage text-paper flex items-center justify-center flex-none">
              <IconCheck size={16} />
            </span>
            <span>
              <span className="block font-archivo text-18 font-semibold tabular-nums">
                {doneReps ?? 0} répétitions
              </span>
              <span className="block text-13 text-graphite mt-0.5">Séance terminée</span>
            </span>
          </div>
          <Link
            href={href}
            className="mt-5 h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
          >
            Revoir la séance
          </Link>
        </>
      ) : (
        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Commencer
        </Link>
      )}
    </Card>
  );
}
