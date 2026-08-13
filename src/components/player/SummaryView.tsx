import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { formatClock } from "@/lib/player/formatClock";
import { palierAtteint } from "@/lib/trophies/paliers";
import type { Accent } from "@/components/Pastille";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

export function SummaryView({
  exercises,
  setsLogged,
  durationSeconds,
  allTimeTotals,
  accent = "cobalt",
  onFinish,
}: {
  exercises: Exercise[];
  setsLogged: SetLoggedRecord[];
  durationSeconds: number;
  allTimeTotals: (number | undefined)[];
  accent?: Accent;
  onFinish: () => void;
}) {
  const repsByExercise = new Map<number, number>();
  for (const set of setsLogged) {
    repsByExercise.set(set.exerciseOrder, (repsByExercise.get(set.exerciseOrder) ?? 0) + set.repsActual);
  }
  const exercisesWorked = repsByExercise.size;
  const totalReps = [...repsByExercise.values()].reduce((sum, reps) => sum + reps, 0);

  const stats = [
    { key: "Durée", value: formatClock(durationSeconds) },
    { key: "Exercices", value: String(exercisesWorked) },
    { key: "Répétitions", value: String(totalReps) },
  ];

  const palierFranchi = exercises
    .map((exercise, exerciseOrder) => {
      const reps = repsByExercise.get(exerciseOrder);
      const totalApres = allTimeTotals[exerciseOrder];
      if (reps === undefined || totalApres === undefined) return null;
      const totalAvant = totalApres - reps;
      const palierApres = palierAtteint(totalApres);
      if (palierApres === null || palierAtteint(totalAvant) === palierApres) return null;
      return { exercise, palier: palierApres };
    })
    .filter((row): row is { exercise: Exercise; palier: number } => row !== null);

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <div className="flex-1 overflow-y-auto px-5 pt-10 pb-6">
        <h1 className="font-archivo text-44 font-semibold">Séance terminée</h1>

        {palierFranchi.map(({ exercise, palier }) => (
          <p key={exercise.id} className="text-13 text-brass mt-3">
            Palier franchi · {palier.toLocaleString("fr-FR")} répétitions · {exercise.name}
          </p>
        ))}

        <div className="flex gap-3 mt-8">
          {stats.map((stat) => (
            <Card key={stat.key} className="flex-1 p-4">
              <div className="font-archivo text-32 font-semibold tabular-nums">{stat.value}</div>
              <div className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite mt-2.5">
                {stat.key}
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-8 overflow-hidden">
          {exercises
            .map((exercise, exerciseOrder) => ({
              exercise,
              reps: repsByExercise.get(exerciseOrder),
              allTime: allTimeTotals[exerciseOrder],
            }))
            .filter(
              (row): row is { exercise: Exercise; reps: number; allTime: number | undefined } =>
                row.reps !== undefined,
            )
            .map((row, i) => (
              <div
                key={row.exercise.id}
                className={`flex justify-between items-center gap-4 px-5 py-3.5 border-hairline ${i > 0 ? "border-t" : ""}`}
              >
                <span className="text-15">{row.exercise.name}</span>
                <span className="font-archivo text-18 font-semibold tabular-nums flex-none">
                  +{row.reps} reps{row.allTime !== undefined ? ` · ${row.allTime} au total` : ""}
                </span>
              </div>
            ))}
        </Card>
      </div>

      <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
        <Button variant="primary" accent={accent} onClick={onFinish}>
          Terminer
        </Button>
      </div>
    </div>
  );
}
