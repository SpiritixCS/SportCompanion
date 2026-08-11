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
});
