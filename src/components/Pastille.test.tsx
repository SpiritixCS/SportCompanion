// src/components/Pastille.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pastille } from "./Pastille";

describe("Pastille", () => {
  it.each([
    ["upcoming", "À venir"],
    ["today", "Aujourd'hui"],
    ["done", "Fait"],
    ["skipped", "Sauté"],
    ["restOrWalk", "Repos ou marche"],
  ] as const)("labels the %s state as %s", (state, label) => {
    render(<Pastille state={state} accent="cobalt" />);
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
  });

  it("applies the accent color only for the today and done states", () => {
    const { container: today } = render(<Pastille state="today" accent="sage" />);
    expect(today.firstChild).toHaveClass("border-sage");

    const { container: upcoming } = render(<Pastille state="upcoming" accent="sage" />);
    expect(upcoming.firstChild).not.toHaveClass("border-sage");
    expect(upcoming.firstChild).not.toHaveClass("bg-sage");
  });

  it("renders a center dot for restOrWalk but not for upcoming", () => {
    const { container: restOrWalk } = render(<Pastille state="restOrWalk" accent="cobalt" />);
    expect(restOrWalk.firstChild?.childNodes).toHaveLength(1);

    const { container: upcoming } = render(<Pastille state="upcoming" accent="cobalt" />);
    expect(upcoming.firstChild?.childNodes).toHaveLength(0);
  });

  it("applies a halo ring only for the today state", () => {
    const { container: today } = render(<Pastille state="today" accent="brass" />);
    expect(today.firstChild).toHaveClass("ring-2", "ring-brass/20");

    for (const state of ["upcoming", "done", "skipped", "restOrWalk"] as const) {
      const { container } = render(<Pastille state={state} accent="brass" />);
      expect(container.firstChild).not.toHaveClass("ring-2");
    }
  });
});
