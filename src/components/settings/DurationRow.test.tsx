import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DurationRow } from "./DurationRow";

describe("DurationRow", () => {
  it("shows the current value on the row", () => {
    render(<DurationRow label="Repos entre séries" valueSeconds={90} onConfirm={() => {}} />);
    expect(screen.getByText("90 s")).toBeInTheDocument();
  });

  it("opens a sheet prefilled with the current value on tap", async () => {
    render(<DurationRow label="Repos entre séries" valueSeconds={90} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    expect(screen.getByText("90")).toBeInTheDocument();
  });

  it("steps by 15s and never goes below the 15s floor", async () => {
    render(<DurationRow label="Repos entre séries" valueSeconds={15} onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "−" }));
    expect(screen.getByText("15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("confirms the draft value and closes the sheet", async () => {
    const onConfirm = vi.fn();
    render(<DurationRow label="Repos entre séries" valueSeconds={90} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Repos entre séries" }));
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onConfirm).toHaveBeenCalledWith(105);
    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
  });
});
