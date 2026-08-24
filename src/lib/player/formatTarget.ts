import type { ExerciseTarget } from "@/lib/workout/types";

const UNIT_SUFFIX: Record<string, string> = {
  seconds: " s",
  minutes: " min",
};

export function formatTarget(sets: number, target: ExerciseTarget): string {
  let valueLabel: string;
  if (target.maxEffort || target.value === null) {
    valueLabel = "max";
  } else if (Array.isArray(target.value)) {
    valueLabel = target.value.join("-");
  } else {
    valueLabel = String(target.value);
  }
  const unitSuffix = target.maxEffort || target.value === null ? "" : (UNIT_SUFFIX[target.unit] ?? "");
  const sideSuffix = target.eachSide ? " / côté" : "";
  return `${sets} × ${valueLabel}${unitSuffix}${sideSuffix}`;
}
