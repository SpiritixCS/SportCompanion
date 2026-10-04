import { FillButton } from "@/components/FillButton";
import { ExerciseGlyph } from "@/components/glyphs/ExerciseGlyph";
import { useCountUp } from "@/components/trophies/useCountUp";
import type { MovementFamily } from "@/lib/trophies/movementFamily";
import { formatClock } from "@/lib/player/formatClock";
import { palierAtteint } from "@/lib/trophies/paliers";
import type { Accent } from "@/components/accent";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

export function SummaryView({
  exercises,
  setsLogged,
  durationSeconds,
  allTimeTotals,
  accent = "cobalt",
  onFinish,
  onBack,
}: {
  exercises: Exercise[];
  setsLogged: SetLoggedRecord[];
  durationSeconds: number;
  allTimeTotals: (number | undefined)[];
  accent?: Accent;
  onFinish: () => void;
  // Récap anticipé (« Terminer avec ce qui est fait ») : retour à la séance.
  onBack?: () => void;
}) {
  const repsByExercise = new Map<number, number>();
  for (const set of setsLogged) {
    repsByExercise.set(set.exerciseOrder, (repsByExercise.get(set.exerciseOrder) ?? 0) + set.repsActual);
  }
  const exercisesWorked = repsByExercise.size;
  const totalReps = [...repsByExercise.values()].reduce((sum, reps) => sum + reps, 0);

  // La durée est déjà vivante (elle avance chaque seconde) : affichée telle
  // quelle ; exercices et reps comptent de 0 (spec § Mouvement 3).
  const exercisesShown = useCountUp(exercisesWorked, 0);
  const repsShown = useCountUp(totalReps, 40);
  const stats = [
    { key: "Durée", value: formatClock(durationSeconds) },
    { key: "Exercices", value: String(exercisesShown) },
    { key: "Répétitions", value: String(repsShown) },
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
      <div className="flex-1 overflow-y-auto px-[18px] pt-[30px] pb-6">
        <h1 className="font-display font-extrabold text-[64px] uppercase leading-[0.86] max-w-[7ch]">Séance terminée</h1>

        {palierFranchi.map(({ exercise, palier }) => (
          <p key={exercise.id} className="font-mono text-11 uppercase tracking-[0.1em] text-brass-ink mt-3">
            Palier franchi · {palier.toLocaleString("fr-FR")} répétitions · {exercise.name}
          </p>
        ))}

        <div className="grid grid-cols-3 gap-2 mt-[22px]">
          {stats.map((stat) => (
            <div key={stat.key} className="bg-paper rounded-[20px] px-3 py-3.5">
              <div className="font-display font-extrabold text-[40px] leading-[0.9] tabular-nums">{stat.value}</div>
              <div className="font-mono text-11 uppercase tracking-[0.14em] text-graphite mt-2">{stat.key}</div>
            </div>
          ))}
        </div>

        <div className="bg-paper rounded-[24px] mt-3 px-4 py-1">
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
                className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 py-3 ${i > 0 ? "border-t border-hairline" : ""}`}
              >
                <ExerciseGlyph
                  exerciseId={row.exercise.id}
                  family={row.exercise.movementFamily as MovementFamily}
                  accent={accent === "sage" ? "sage" : "cobalt"}
                />
                <span className="text-15 leading-tight">{row.exercise.name}</span>
                <span className="font-display font-bold text-[20px] tracking-[0.02em] tabular-nums text-right">
                  +{row.reps} reps{row.allTime !== undefined ? ` · ${row.allTime} au total` : ""}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="flex-none px-[18px] pt-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline">
        <FillButton accent={accent} onClick={onFinish}>
          Terminer
        </FillButton>
        {onBack && (
          <button type="button" onClick={onBack} className="w-full h-11 mt-1.5 font-body text-15 font-medium text-graphite">
            Continuer la séance
          </button>
        )}
      </div>
    </div>
  );
}
