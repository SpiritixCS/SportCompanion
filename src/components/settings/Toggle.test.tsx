import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("reflects the checked state via aria-checked", () => {
    render(<Toggle checked={true} onChange={() => {}} label="Décompte sonore" />);
    expect(screen.getByRole("switch", { name: "Décompte sonore" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the inverted value on click", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Décompte sonore" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows the ink track when checked, hairline when not", () => {
    const { rerender } = render(<Toggle checked={true} onChange={() => {}} label="x" />);
    expect(screen.getByRole("switch").firstChild).toHaveClass("bg-ink");
    rerender(<Toggle checked={false} onChange={() => {}} label="x" />);
    expect(screen.getByRole("switch").firstChild).toHaveClass("bg-hairline");
  });
});
