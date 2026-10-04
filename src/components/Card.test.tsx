import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside a borderless paper surface with card radius", () => {
    render(<Card>contenu</Card>);
    const card = screen.getByText("contenu");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("bg-paper", "rounded-card");
    expect(card).not.toHaveClass("border");
  });

  it("merges a custom className", () => {
    render(<Card className="p-5">contenu</Card>);
    expect(screen.getByText("contenu")).toHaveClass("p-5");
  });
});
