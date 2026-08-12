import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DosSetup } from "./DosSetup";

const setStartDateAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/dos/actions", () => ({
  setStartDateAction: (...args: unknown[]) => setStartDateAction(...args),
}));

describe("DosSetup", () => {
  it("pre-fills the date field to today", () => {
    render(<DosSetup onDone={() => {}} />);
    expect(screen.getByDisplayValue(new Date().toISOString().slice(0, 10))).toBeInTheDocument();
  });

  it("calls setStartDateAction with the chosen date then onDone", async () => {
    const onDone = vi.fn();
    render(<DosSetup onDone={onDone} />);
    const input = screen.getByDisplayValue(new Date().toISOString().slice(0, 10));
    fireEvent.change(input, { target: { value: "2026-08-10" } });
    await userEvent.click(screen.getByRole("button", { name: "C'est parti" }));
    expect(setStartDateAction).toHaveBeenCalledWith("2026-08-10");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
