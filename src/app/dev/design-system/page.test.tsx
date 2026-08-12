import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DesignSystemPage from "./page";

describe("/dev/design-system", () => {
  it("renders a section for every base component", () => {
    render(<DesignSystemPage />);
    for (const heading of ["Card", "Pastille", "LigneNiveau", "Button", "BottomNav", "Sheet"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });
});
