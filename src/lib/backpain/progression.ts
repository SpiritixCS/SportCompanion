import { ARBRES, type ArbreId } from "./arbres";

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
  const lastThree = eligible.slice(-3);
  return lastThree.length === 3 && lastThree.every((e) => e.resultat === "maintien");
}

export function evaluateProgression(input: {
  arbre: ArbreId;
  semaine: number;
  currentCran: number;
  seriesAuHaut: boolean;
  rpeAuCibleOuMoins: boolean;
  gene: number;
  dejaMonteeCetteSemaine: boolean;
}): { resultat: Resultat; message: string; cranApres: number } {
  const { arbre, semaine, currentCran, seriesAuHaut, rpeAuCibleOuMoins, gene, dejaMonteeCetteSemaine } = input;

  if (semaine % 4 === 0) {
    return { resultat: "decharge", message: "Semaine de décharge : pas de test de cran.", cranApres: currentCran };
  }

  if (gene > 3) {
    return {
      resultat: "douleur",
      message: "Gêne au-delà de 3/10 : répéter le même cran la prochaine fois.",
      cranApres: currentCran,
    };
  }

  if (dejaMonteeCetteSemaine) {
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
