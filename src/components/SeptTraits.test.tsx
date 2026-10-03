import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeptTraits } from "./SeptTraits";
import type { PastilleState } from "./Pastille";

const WEEK: PastilleState[] = ["done", "restOrWalk", "done", "restOrWalk", "today", "restOrWalk", "upcoming"];

describe("SeptTraits", () => {
  it("renders one labelled trait per day", () => {
    render(<SeptTraits states={WEEK} />);
    const traits = screen.getAllByRole("img");
    expect(traits).toHaveLength(7);
    expect(traits.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Jour 1 : Fait",
      "Jour 2 : Repos",
      "Jour 3 : Fait",
      "Jour 4 : Repos",
      "Jour 5 : Aujourd'hui",
      "Jour 6 : Repos",
      "Jour 7 : À venir",
    ]);
  });

  it("fills done days with the accent, tints today, thins rest days", () => {
    render(<SeptTraits states={WEEK} accent="sage" />);
    const [d1, d2, , , d5, , d7] = screen.getAllByRole("img");
    expect(d1).toHaveClass("bg-sage");
    expect(d5).toHaveClass("bg-sage", "opacity-35");
    expect(d2).toHaveClass("h-0.5");
    expect(d7).toHaveClass("bg-hairline");
  });

  it("shows day numbers with today's number in the accent, and a caret under today", () => {
    const { container } = render(<SeptTraits states={WEEK} showNumbers todayCaret />);
    expect(screen.getByText("5")).toHaveClass("text-cobalt");
    expect(screen.getByText("1")).toHaveClass("text-graphite");
    expect(container.querySelectorAll('[data-caret="true"]')).toHaveLength(1);
  });

  it("uses compact traits for size sm", () => {
    render(<SeptTraits states={WEEK} size="sm" />);
    expect(screen.getAllByRole("img")[0]).toHaveClass("w-[22px]");
  });
});
