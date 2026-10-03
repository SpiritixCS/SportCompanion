import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepsSheet } from "./RepsSheet";

describe("RepsSheet", () => {
  it("prefills the value on the target when opened", () => {
    render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("increments and decrements with the stepper buttons", async () => {
    render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText("13")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("never decrements below 0", async () => {
    render(<RepsSheet open onClose={() => {}} initialValue={0} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("confirms the current stepper value, not the initial one", async () => {
    const onConfirm = vi.fn();
    render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onConfirm).toHaveBeenCalledWith(13);
  });

  it("uses the sage accent on the Valider button when accent='sage'", () => {
    render(<RepsSheet open onClose={() => {}} initialValue={12} accent="sage" onConfirm={() => {}} />);
    // L'accent est porté par le balayage du FillButton (fond ink).
    expect(screen.getByRole("button", { name: "Valider" }).querySelector('[aria-hidden="true"]')).toHaveClass("bg-sage");
  });

  it("uses a custom title when provided, defaults to Ajuster les reps otherwise", () => {
    const { rerender } = render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    expect(screen.getByText("Ajuster les reps")).toBeInTheDocument();

    rerender(<RepsSheet open onClose={() => {}} initialValue={12} title="Ajuster la durée (s)" onConfirm={() => {}} />);
    expect(screen.getByText("Ajuster la durée (s)")).toBeInTheDocument();
  });

  it("shows no delete affordance by default, shows one and calls onDelete when provided", async () => {
    const onDelete = vi.fn();
    const { rerender } = render(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} />);
    expect(screen.queryByRole("button", { name: "Supprimer la série" })).not.toBeInTheDocument();

    rerender(<RepsSheet open onClose={() => {}} initialValue={12} onConfirm={() => {}} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la série" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
