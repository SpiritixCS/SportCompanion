import type { ExerciseTarget } from "@/lib/workout/types";

export function formatTarget(sets: number, target: ExerciseTarget): string {
  let valueLabel: string;
  if (target.maxEffort || target.value === null) {
    valueLabel = "max";
  } else if (Array.isArray(target.value)) {
    valueLabel = target.value.join("-");
  } else {
    valueLabel = String(target.value);
  }
  const suffix = target.eachSide ? " / côté" : "";
  return `${sets} × ${valueLabel}${suffix}`;
}
