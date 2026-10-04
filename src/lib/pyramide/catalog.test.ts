import { describe, it, expect } from "vitest";
import { catalogExercises, findCatalogByName } from "./catalog";

describe("catalogExercises", () => {
  it("lists each counted reps exercise once, with its family", () => {
    const list = catalogExercises();
    expect(list.filter((e) => e.id === "pull-ups")).toEqual([{ id: "pull-ups", name: "Pull ups", movementFamily: "pull" }]);
  });

  it("leaves out exercises that do not count in the Trophées", () => {
    expect(catalogExercises().some((e) => e.id === "advanced-tuck-front-lever-raises")).toBe(false);
  });
});

describe("findCatalogByName", () => {
  it("matches a catalogue exercise whatever the case and surrounding spaces", () => {
    expect(findCatalogByName("  pull UPS ")?.id).toBe("pull-ups");
  });

  it("returns null for a free exercise", () => {
    expect(findCatalogByName("Good moraine")).toBeNull();
  });
});
