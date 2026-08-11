import { describe, it, expect } from "vitest";
import { archivo, interTight } from "./fonts";

describe("fonts", () => {
  it("exposes a CSS variable class for Archivo", () => {
    expect(archivo.variable).toMatch(/^__variable_/);
  });

  it("exposes a CSS variable class for Inter Tight", () => {
    expect(interTight.variable).toMatch(/^__variable_/);
  });
});
