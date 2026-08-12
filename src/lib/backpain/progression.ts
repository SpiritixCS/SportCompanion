import { ARBRES, type ArbreId } from "./arbres";
import { isDechargeWeek } from "./periode";

export type Resultat = "montee" | "maintien" | "douleur" | "plafond" | "sommet" | "decharge" | "calibrage";

export type EvalRow = {
  arbre: ArbreId;
  semaine: number;
  cranApres: number;
  resultat: Resultat;
  horodatage: string;
};

export function getCurrentCran(evaluations: EvalRow[], arbre: ArbreId): number {
  const rows = evaluations.filter((e) => e.arbre === arbre);
  return rows.length === 0 ? 1 : rows[rows.length - 1]!.cranApres;
}

export function hasAlreadyRisenThisWeek(evaluations: EvalRow[], arbre: ArbreId, semaine: number): boolean {
  return evaluations.some((e) => e.arbre === arbre && e.semaine === semaine && e.resultat === "montee");
}

export function checkStagnation(evaluations: EvalRow[], arbre: ArbreId): boolean {
  const eligible = evaluations.filter(
    (e) => e.arbre === arbre && e.resultat !== "calibrage" && e.resultat !== "decharge",
  );

  const weekOrder: number[] = [];
  const byWeek = new Map<number, EvalRow[]>();
  for (const e of eligible) {
    if (!byWeek.has(e.semaine)) {
      byWeek.set(e.semaine, []);
      weekOrder.push(e.semaine);
    }
    byWeek.get(e.semaine)!.push(e);
  }

  const lastThreeWeeks = weekOrder.slice(-3);
  if (lastThreeWeeks.length < 3) return false;
  return lastThreeWeeks.every((week) => byWeek.get(week)!.every((e) => e.resultat === "maintien"));
}

export function evaluateProgression(input: {
  arbre: ArbreId;
  semaine: number;
  currentCran: number;
  seriesAuHaut: boolean;
  rpeAuCibleOuMoins: boolean;
  genePendant: number;
  dejaMonteeCetteSemaine: boolean;
}): { resultat: Resultat; message: string; cranApres: number } {
  const { arbre, semaine, currentCran, seriesAuHaut, rpeAuCibleOuMoins, genePendant, dejaMonteeCetteSemaine } = input;

  if (isDechargeWeek(semaine)) {
    return { resultat: "decharge", message: "Semaine de décharge : pas de test de cran.", cranApres: currentCran };
  }

  if (genePendant > 3) {
    return {
      resultat: "douleur",
      message: "Gêne au-delà de 3/10 : répéter le même cran la prochaine fois.",
      cranApres: currentCran,
    };
  }

  // §1 : en semaine 1 (calibrage), le plafond « une seule montée par semaine » ne s'applique pas —
  // l'utilisateur peut monter plusieurs fois dans la même séance pour trouver son cran de départ.
  if (dejaMonteeCetteSemaine && semaine !== 1) {
    return {
      resultat: "plafond",
      message: "Déjà monté cette semaine sur cette échelle. Une seule montée par semaine.",
      cranApres: currentCran,
    };
  }

  const sommet = ARBRES[arbre].crans.length;
  if (currentCran >= sommet) {
    return { resultat: "sommet", message: "Sommet de l'échelle atteint.", cranApres: currentCran };
  }

  // §1 : Arbre I démarre au cran 1 et y reste deux semaines minimum, même si c'est facile.
  if (arbre === "I" && currentCran === 1 && semaine < 3) {
    return {
      resultat: "maintien",
      message: "Arbre I : reste au cran 1 deux semaines minimum.",
      cranApres: currentCran,
    };
  }

  if (!seriesAuHaut || !rpeAuCibleOuMoins) {
    return {
      resultat: "maintien",
      message: "Rester à ce cran. Viser le haut de la fourchette au RPE cible.",
      cranApres: currentCran,
    };
  }

  const cranApres = currentCran + 1;
  const nomCranSuivant = ARBRES[arbre].crans[cranApres - 1]!.nom;
  return { resultat: "montee", message: `Cran suivant débloqué : ${nomCranSuivant}`, cranApres };
}
