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
});
