import type { ArbreId } from "@/lib/backpain/arbres";

export type MovementFamily = "core" | "dip" | "handstand" | "lever" | "other" | "pull" | "push" | "squat";

// Mapping figé à la main — les 10 arbres BackPain n'ont pas de movementFamily
// propre (BackPainProgram.md ne classe pas par famille de mouvement), donc on
// les rattache au meilleur candidat parmi les 8 familles déjà curées côté
// Programme, uniquement pour le choix d'icône en Trophées.
export const DOS_ARBRE_MOVEMENT_FAMILY: Record<ArbreId, MovementFamily> = {
  A: "squat",
  B: "squat",
  C: "core",
  D: "squat",
  E: "pull",
  F: "pull",
  G: "push",
  H: "core",
  I: "core",
  J: "core",
};
