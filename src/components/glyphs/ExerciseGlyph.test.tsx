import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ExerciseGlyph, glyphFor } from "./ExerciseGlyph";
import { EXERCISE_GLYPHS, FAMILY_GLYPHS } from "./glyphPaths";

describe("glyphFor", () => {
  it("prefers the exercise's own glyph over its family", () => {
    expect(glyphFor("hanging-knee-raises", "other")).toBe(EXERCISE_GLYPHS["hanging-knee-raises"]);
  });

  it("falls back to the family glyph when the exercise has none", () => {
    expect(glyphFor("push-ups", "push")).toBe(FAMILY_GLYPHS.push);
  });

  it("falls back to the « other » glyph for an unknown or missing family", () => {
    expect(glyphFor(null, null)).toBe(FAMILY_GLYPHS.other);
    expect(glyphFor("x", "nope" as never)).toBe(FAMILY_GLYPHS.other);
  });

  it("covers the 15 « other » exercises and the 8 families", () => {
    expect(Object.keys(EXERCISE_GLYPHS)).toHaveLength(15);
    expect(Object.keys(FAMILY_GLYPHS).sort()).toEqual(["core", "dip", "handstand", "lever", "other", "pull", "push", "squat"]);
  });
});

describe("ExerciseGlyph", () => {
  it("renders a decorative indigo tile by default", () => {
    const { container } = render(<ExerciseGlyph exerciseId="push-ups" family="push" />);
    const tile = container.firstElementChild!;
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveClass("bg-cobalt-soft", "text-cobalt", "w-9", "h-9");
    expect(tile.querySelector("svg")).toHaveAttribute("stroke-width", "1.8");
  });

  it("uses the jade tile for the sage accent and a big tile for size lg", () => {
    const { container } = render(<ExerciseGlyph family="core" accent="sage" size="lg" />);
    expect(container.firstElementChild).toHaveClass("bg-sage-soft", "text-sage-ink", "w-[84px]");
  });
});
