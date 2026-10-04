// Types du domaine Programme (Caliathletics). Alignés sur la forme réelle de
// workout_curated.json — voir Caliathletics/generate_data_ts.py.

export type TargetValue = number | [number, number] | [number, number, number] | null;

export type ExerciseTarget = {
  unit: string;
  value: TargetValue;
  maxEffort: boolean;
  eachSide: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  movementFamily: string;
  countsInStats: boolean;
  videoId: string | null;
  sets: number;
  target: ExerciseTarget;
  // Tracking uniquement : repos entre séries propre à l'exercice.
  restSeconds?: number;
};

export type TrainDay = { kind: "train"; label: string; exercises: Exercise[] };
export type RestDay = { kind: "rest" };
export type ProgramDay = TrainDay | RestDay;
export type ProgramLevel = ProgramDay[];
export type Program = ProgramLevel[];
