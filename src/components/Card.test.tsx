import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside a paper surface with hairline border and card radius", () => {
    render(<Card>contenu</Card>);
    const card = screen.getByText("contenu");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("bg-paper", "border-hairline", "rounded-card");
  });

  it("merges a custom className", () => {
    render(<Card className="p-5">contenu</Card>);
    expect(screen.getByText("contenu")).toHaveClass("p-5");
  });
});
