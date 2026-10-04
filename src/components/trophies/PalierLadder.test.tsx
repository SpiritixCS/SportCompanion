import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalierLadder } from "./PalierLadder";

const fills = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>('[data-testid="palier-fill"]')].map((el) => el.style.width);

describe("PalierLadder", () => {
  it("fills reached paliers, partly fills the current one, leaves the rest empty", () => {
    const { container } = render(<PalierLadder total={340} />);
    expect(fills(container)).toEqual(["100%", "60%", "0%", "0%", "0%", "0%"]);
    expect(screen.getByText("160 reps")).toBeInTheDocument();
    expect(screen.getByText(/pour atteindre 500/)).toBeInTheDocument();
  });

  it("labels the six paliers from 100 to 25 k", () => {
    render(<PalierLadder total={0} />);
    for (const label of ["100", "500", "1 k", "5 k", "10 k", "25 k"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("says every palier is reached past 25 000", () => {
    const { container } = render(<PalierLadder total={25000} />);
    expect(fills(container).every((w) => w === "100%")).toBe(true);
    expect(screen.getByText("Tous les paliers atteints.")).toBeInTheDocument();
  });
});
