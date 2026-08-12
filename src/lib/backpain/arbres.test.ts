import { describe, it, expect } from "vitest";
import { ARBRES } from "./arbres";

describe("ARBRES", () => {
  it("has exactly 10 trees, A through J", () => {
    expect(Object.keys(ARBRES).sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  });

  it("has the exact cran count per tree from §3", () => {
    expect(ARBRES.A.crans).toHaveLength(8);
    expect(ARBRES.B.crans).toHaveLength(7);
    expect(ARBRES.C.crans).toHaveLength(6);
    expect(ARBRES.D.crans).toHaveLength(6);
    expect(ARBRES.E.crans).toHaveLength(5);
    expect(ARBRES.F.crans).toHaveLength(5);
    expect(ARBRES.G.crans).toHaveLength(6);
    expect(ARBRES.H.crans).toHaveLength(7);
    expect(ARBRES.I.crans).toHaveLength(4);
    expect(ARBRES.J.crans).toHaveLength(6);
  });

  it("names the first and last cran of tree A correctly", () => {
    expect(ARBRES.A.crans[0]).toEqual({ numero: 1, nom: "Hip hinge au bâton" });
    expect(ARBRES.A.crans[7]).toEqual({ numero: 8, nom: "Nordic curl + gilet lesté" });
  });

  it("has 4 prescriptions per tree, one per block", () => {
    for (const arbre of Object.values(ARBRES)) {
      expect(arbre.prescriptions).toHaveLength(4);
    }
  });

  it("matches tree A's exact prescriptions from §4", () => {
    expect(ARBRES.A.prescriptions).toEqual([
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 3, min: 8, max: 10, unite: "reps" },
      { series: 4, min: 6, max: 8, unite: "reps" },
      { series: 4, min: 5, max: 6, unite: "reps" },
    ]);
  });

  it("switches tree I's unit from seconds (block 1) to meters (blocks 2-4)", () => {
    expect(ARBRES.I.prescriptions).toEqual([
      { series: 3, min: 15, max: 20, unite: "s" },
      { series: 3, min: 20, max: 25, unite: "m" },
      { series: 4, min: 25, max: 30, unite: "m" },
      { series: 4, min: 30, max: 40, unite: "m" },
    ]);
  });

  it("matches tree H's tenue-based prescriptions (unite s across all 4 blocks)", () => {
    expect(ARBRES.H.prescriptions).toEqual([
      { series: 3, min: 20, max: 25, unite: "s" },
      { series: 3, min: 30, max: 35, unite: "s" },
      { series: 3, min: 30, max: 40, unite: "s" },
      { series: 3, min: 45, max: 50, unite: "s" },
    ]);
  });
});
