import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingCard } from "./TrackingCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const startTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
}));

describe("TrackingCard", () => {
  it("shows Enregistrer une séance and starts one on click when nothing is active", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingCard state={{ activeSeanceId: null, seances: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });

  it("shows Reprendre linking directly to the active seance", () => {
    render(<TrackingCard state={{ activeSeanceId: 7, seances: [] }} />);
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/7");
  });
});
