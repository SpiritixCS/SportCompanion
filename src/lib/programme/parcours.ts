import { beginner, intermediate, advanced } from "@/lib/workout/data";
import type { Program } from "@/lib/workout/types";

export type ParcoursMeta = {
  id: string;
  label: string;
  program: Program;
  levelCount: number;
};

export const PARCOURS: ParcoursMeta[] = [
  { id: "beginner", label: "Débutant", program: beginner, levelCount: beginner.length },
  { id: "intermediate", label: "Intermédiaire", program: intermediate, levelCount: intermediate.length },
  { id: "advanced", label: "Advanced", program: advanced, levelCount: advanced.length },
];

export function getParcours(id: string): ParcoursMeta | undefined {
  return PARCOURS.find((p) => p.id === id);
}
