import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import type { Exercise } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";

export function SummaryView({
  exercises,
  setsLogged,
  durationSeconds,
  onFinish,
}: {
  exercises: Exercise[];
  setsLogged: SetLoggedRecord[];
  durationSeconds: number;
  onFinish: () => void;
}) {
  const repsByExercise = new Map<number, number>();
  for (const set of setsLogged) {
    repsByExercise.set(set.exerciseOrder, (repsByExercise.get(set.exerciseOrder) ?? 0) + set.repsActual);
  }
  const exercisesWorked = repsByExercise.size;
  const totalReps = [...repsByExercise.values()].reduce((sum, reps) => sum + reps, 0);
  const minutes = Math.round(durationSeconds / 60);

  return (
    <div className="p-5 flex flex-col gap-8">
      <h1 className="font-archivo text-32 font-semibold">Séance terminée</h1>

      <div className="flex justify-between">
        <div>
          <div className="font-archivo text-44 font-semibold tabular-nums">{minutes}</div>
          <div className="text-13 text-graphite">minutes</div>
        </div>
        <div>
          <div className="font-archivo text-44 font-semibold tabular-nums">{exercisesWorked}</div>
          <div className="text-13 text-graphite">exercices</div>
        </div>
        <div>
          <div className="font-archivo text-44 font-semibold tabular-nums">{totalReps}</div>
          <div className="text-13 text-graphite">répétitions</div>
        </div>
      </div>

      <Card className="p-5 flex flex-col gap-3">
        {exercises.map((exercise, exerciseOrder) => {
          const reps = repsByExercise.get(exerciseOrder);
          if (reps === undefined) return null;
          return (
            <div key={exercise.id} className="flex justify-between text-15">
              <span>{exercise.name}</span>
              <span className="font-archivo tabular-nums">+{reps} reps</span>
            </div>
          );
        })}
      </Card>

      <Button variant="primary" accent="cobalt" onClick={onFinish}>
        Terminer
      </Button>
    </div>
  );
}
