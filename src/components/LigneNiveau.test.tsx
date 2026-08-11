import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LigneNiveau } from "./LigneNiveau";

describe("LigneNiveau", () => {
  it("shows the level number and 7 pastilles", () => {
    render(
      <LigneNiveau
        level={3}
        accent="cobalt"
        days={["done", "done", "today", "upcoming", "upcoming", "upcoming", "upcoming"]}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(7);
  });
});
