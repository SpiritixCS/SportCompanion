import type { ExerciseTarget } from "@/lib/workout/types";

export type JourEntraine = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi";

export type ExerciceFixe = {
  id: string;
  nom: string;
  sets: number;
  target: ExerciseTarget;
};

function target(unit: "reps" | "s", value: number | [number, number], eachSide = false): ExerciseTarget {
  return { unit, value, maxEffort: false, eachSide };
}

export const EXERCICES_FIXES: Record<JourEntraine, ExerciceFixe[]> = {
  lundi: [
    { id: "lundi-hip-hinge-echauffement", nom: "Hip hinge au bâton", sets: 2, target: target("reps", 10) },
  ],
  mardi: [
    { id: "mardi-bascules-quadrupedie", nom: "Bascules de bassin quadrupédie", sets: 3, target: target("reps", 10) },
    { id: "mardi-chat-chameau", nom: "Chat-chameau lent", sets: 3, target: target("reps", 10) },
    { id: "mardi-bird-dog", nom: "Bird dog", sets: 3, target: target("s", [6, 10]) },
    { id: "mardi-butees", nom: "Butées", sets: 1, target: target("reps", 10, true) },
  ],
  mercredi: [
    { id: "mercredi-90-90-hanches", nom: "90/90 hanches", sets: 2, target: target("reps", 8, true) },
    { id: "mercredi-couch-stretch", nom: "Couch stretch", sets: 2, target: target("s", 45, true) },
    { id: "mercredi-abduction-elastique", nom: "Abduction élastique", sets: 3, target: target("reps", [15, 20]) },
  ],
  jeudi: [
    { id: "jeudi-open-book-thoracique", nom: "Open book thoracique", sets: 2, target: target("reps", 8, true) },
    { id: "jeudi-face-pull-elastique", nom: "Face pull élastique", sets: 3, target: target("reps", 15) },
  ],
  vendredi: [
    { id: "vendredi-pont-fessier-echauffement", nom: "Pont fessier bilatéral", sets: 2, target: target("reps", 15) },
  ],
  samedi: [
    { id: "samedi-mobilite-epaules-thoracique", nom: "Open book thoracique", sets: 2, target: target("reps", 8, true) },
    { id: "samedi-curl-up-mcgill", nom: "Curl-up McGill", sets: 3, target: target("reps", 8) },
  ],
};
