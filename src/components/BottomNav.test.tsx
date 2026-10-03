import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

const items = [
  { label: "Aujourd'hui", icon: <span data-testid="icon-today" />, active: true, href: "/" },
  { label: "Programme", icon: <span data-testid="icon-programme" />, active: false, href: "/programme" },
  { label: "Tracking", icon: <span data-testid="icon-tracking" />, active: false, href: "/tracking" },
  { label: "Trophées", icon: <span data-testid="icon-trophees" />, active: false, href: "/trophees" },
];

describe("BottomNav", () => {
  it("renders all 4 items as links", () => {
    render(<BottomNav items={items} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    for (const item of items) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("marks the active item with ink text and never an accent color class", () => {
    render(<BottomNav items={items} />);
    const active = screen.getByRole("link", { name: "Aujourd'hui" });
    expect(active).toHaveClass("text-ink");
    expect(active.className).not.toMatch(/text-(cobalt|sage|brass)/);

    const inactive = screen.getByRole("link", { name: "Programme" });
    expect(inactive).toHaveClass("text-graphite");
  });

  // Régression : sans z-index, les éléments positionnés de <main> (pastilles
  // repos/marche en `relative`) passaient par-dessus la barre fixe au scroll.
  it("stacks above positioned page content, below full-screen overlays (z-40+)", () => {
    render(<BottomNav items={items} />);
    expect(screen.getByRole("navigation")).toHaveClass("z-30");
  });
});
