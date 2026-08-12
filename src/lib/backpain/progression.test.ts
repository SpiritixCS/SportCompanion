import { describe, it, expect } from "vitest";
import { getCurrentCran, hasAlreadyRisenThisWeek, checkStagnation, evaluateProgression } from "./progression";
import type { EvalRow } from "./progression";

function row(overrides: Partial<EvalRow>): EvalRow {
  return {
    arbre: "A",
    semaine: 1,
    cranApres: 1,
    resultat: "maintien",
    horodatage: "2026-08-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("getCurrentCran", () => {
  it("defaults to 1 when the tree has never been evaluated", () => {
    expect(getCurrentCran([], "A")).toBe(1);
  });

  it("returns the cranApres of the most recent row for that tree", () => {
    const evaluations = [row({ cranApres: 2, resultat: "montee" }), row({ cranApres: 2, resultat: "maintien" })];
    expect(getCurrentCran(evaluations, "A")).toBe(2);
  });

  it("ignores rows for other trees", () => {
    const evaluations = [row({ arbre: "B", cranApres: 5 }), row({ arbre: "A", cranApres: 1 })];
    expect(getCurrentCran(evaluations, "A")).toBe(1);
  });

  it("counts a calibrage row as authoritative for the current cran", () => {
    const evaluations = [row({ cranApres: 3, resultat: "calibrage" })];
    expect(getCurrentCran(evaluations, "A")).toBe(3);
  });
});

describe("hasAlreadyRisenThisWeek", () => {
  it("is false with no montee row this week", () => {
    const evaluations = [row({ semaine: 3, resultat: "maintien" })];
    expect(hasAlreadyRisenThisWeek(evaluations, "A", 3)).toBe(false);
  });

  it("is true once a montee is recorded this week", () => {
    const evaluations = [row({ semaine: 3, resultat: "montee" })];
    expect(hasAlreadyRisenThisWeek(evaluations, "A", 3)).toBe(true);
  });

  it("ignores a montee from a different week", () => {
    const evaluations = [row({ semaine: 2, resultat: "montee" })];
    expect(hasAlreadyRisenThisWeek(evaluations, "A", 3)).toBe(false);
  });
});

describe("checkStagnation", () => {
  it("is false with fewer than 3 eligible evaluations", () => {
    const evaluations = [row({ resultat: "maintien" }), row({ resultat: "maintien" })];
    expect(checkStagnation(evaluations, "A")).toBe(false);
  });

  it("is true when the last 3 eligible evaluations are all maintien", () => {
    const evaluations = [row({ resultat: "maintien" }), row({ resultat: "maintien" }), row({ resultat: "maintien" })];
    expect(checkStagnation(evaluations, "A")).toBe(true);
  });

  it("resets when a montee appears among the last 3", () => {
    const evaluations = [
      row({ resultat: "maintien" }),
      row({ resultat: "montee", cranApres: 2 }),
      row({ resultat: "maintien", cranApres: 2 }),
    ];
    expect(checkStagnation(evaluations, "A")).toBe(false);
  });

  it("does not count calibrage or decharge rows toward the window, and they don't break it", () => {
    const evaluations = [
      row({ resultat: "maintien" }),
      row({ resultat: "calibrage" }),
      row({ resultat: "decharge" }),
      row({ resultat: "maintien" }),
      row({ resultat: "maintien" }),
    ];
    expect(checkStagnation(evaluations, "A")).toBe(true);
  });
});

describe("evaluateProgression", () => {
  const base = {
    arbre: "A" as const,
    semaine: 5,
    currentCran: 3,
    seriesAuHaut: true,
    rpeAuCibleOuMoins: true,
    gene: 0,
    dejaMonteeCetteSemaine: false,
  };

  it("returns decharge on a decharge week, regardless of other inputs", () => {
    const result = evaluateProgression({ ...base, semaine: 8, gene: 9 });
    expect(result).toEqual({
      resultat: "decharge",
      message: "Semaine de décharge : pas de test de cran.",
      cranApres: 3,
    });
  });

  it("returns douleur when gene exceeds 3, before checking anything else", () => {
    const result = evaluateProgression({ ...base, gene: 4, dejaMonteeCetteSemaine: true });
    expect(result).toEqual({
      resultat: "douleur",
      message: "Gêne au-delà de 3/10 : répéter le même cran la prochaine fois.",
      cranApres: 3,
    });
  });

  it("returns plafond when already risen this week", () => {
    const result = evaluateProgression({ ...base, dejaMonteeCetteSemaine: true });
    expect(result).toEqual({
      resultat: "plafond",
      message: "Déjà monté cette semaine sur cette échelle. Une seule montée par semaine.",
      cranApres: 3,
    });
  });

  it("returns sommet at the top of a short tree (I, 4 crans)", () => {
    const result = evaluateProgression({ ...base, arbre: "I", currentCran: 4 });
    expect(result).toEqual({
      resultat: "sommet",
      message: "Sommet de l'échelle atteint.",
      cranApres: 4,
    });
  });

  it("returns sommet at the top of a long tree (A, 8 crans)", () => {
    const result = evaluateProgression({ ...base, currentCran: 8 });
    expect(result).toEqual({
      resultat: "sommet",
      message: "Sommet de l'échelle atteint.",
      cranApres: 8,
    });
  });

  it("returns maintien when series don't reach the top of the range", () => {
    const result = evaluateProgression({ ...base, seriesAuHaut: false });
    expect(result).toEqual({
      resultat: "maintien",
      message: "Rester à ce cran. Viser le haut de la fourchette au RPE cible.",
      cranApres: 3,
    });
  });

  it("returns maintien when RPE exceeds the block target", () => {
    const result = evaluateProgression({ ...base, rpeAuCibleOuMoins: false });
    expect(result.resultat).toBe("maintien");
    expect(result.cranApres).toBe(3);
  });

  it("returns montee with the next cran's name when every condition passes", () => {
    const result = evaluateProgression(base);
    expect(result).toEqual({
      resultat: "montee",
      message: "Cran suivant débloqué : Leg curl serviette unilatéral",
      cranApres: 4,
    });
  });

  it("evaluates decharge before douleur when both would fail", () => {
    const result = evaluateProgression({ ...base, semaine: 4, gene: 8 });
    expect(result.resultat).toBe("decharge");
  });

  it("evaluates douleur before plafond when both would fail", () => {
    const result = evaluateProgression({ ...base, gene: 5, dejaMonteeCetteSemaine: true });
    expect(result.resultat).toBe("douleur");
  });

  it("allows repeated calibrage in week 1 regardless of dejaMonteeCetteSemaine (caller always passes false)", () => {
    const result = evaluateProgression({ ...base, semaine: 1, dejaMonteeCetteSemaine: false });
    expect(result.resultat).toBe("montee");
  });
});
