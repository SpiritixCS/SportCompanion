import { describe, it, expect } from "vitest";
import { checkPainEscalation } from "./douleur";

describe("checkPainEscalation", () => {
  it("returns normal for a single low-gene seance", () => {
    expect(checkPainEscalation([{ genePendant: 2, geneLendemain: 1 }])).toBe("normal");
  });

  it("returns normal with an empty history", () => {
    expect(checkPainEscalation([])).toBe("normal");
  });

  it("returns repeter_cran for a single seance with gene pendant above 3", () => {
    expect(checkPainEscalation([{ genePendant: 5, geneLendemain: 1 }])).toBe("repeter_cran");
  });

  it("returns repeter_cran for a single seance where only gene lendemain persists above 3", () => {
    expect(checkPainEscalation([{ genePendant: 2, geneLendemain: 4 }])).toBe("repeter_cran");
  });

  it("returns repeter_cran when the last seance is gênante but the one before it was not", () => {
    const history = [
      { genePendant: 1, geneLendemain: 1 },
      { genePendant: 5, geneLendemain: 2 },
    ];
    expect(checkPainEscalation(history)).toBe("repeter_cran");
  });

  it("returns redescendre_cran when the last two consecutive seances are both gênantes", () => {
    const history = [
      { genePendant: 4, geneLendemain: 2 },
      { genePendant: 5, geneLendemain: 3 },
    ];
    expect(checkPainEscalation(history)).toBe("redescendre_cran");
  });

  it("returns redescendre_cran even when an earlier normal seance precedes the two gênantes", () => {
    const history = [
      { genePendant: 1, geneLendemain: 1 },
      { genePendant: 4, geneLendemain: 1 },
      { genePendant: 4, geneLendemain: 1 },
    ];
    expect(checkPainEscalation(history)).toBe("redescendre_cran");
  });
});
