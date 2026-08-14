// src/components/today/TrackingCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingCard } from "./TrackingCard";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const startTrackingSeanceAction = vi.fn();
vi.mock("@/lib/tracking/actions", () => ({
  startTrackingSeanceAction: (...args: unknown[]) => startTrackingSeanceAction(...args),
}));

const EMPTY_STATE: TrackingScreenState = {
  activeSeance: null,
  seances: [],
  todayTemplate: null,
  rotationTemplates: [],
};

describe("TrackingCard", () => {
  it("shows Enregistrer une séance and starts a freeform one on click when nothing is active or planned", async () => {
    startTrackingSeanceAction.mockResolvedValue(9);
    render(<TrackingCard state={EMPTY_STATE} />);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une séance" }));
    expect(startTrackingSeanceAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/tracking/9");
  });

  it("shows Reprendre linking to the freeform journal when the active seance has no template", () => {
    render(<TrackingCard state={{ ...EMPTY_STATE, activeSeance: { id: 7, templateId: null } }} />);
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/7");
  });

  it("shows Reprendre linking to the guided player when the active seance belongs to a template", () => {
    render(<TrackingCard state={{ ...EMPTY_STATE, activeSeance: { id: 7, templateId: 3 } }} />);
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/player/tracking?templateId=3");
  });

  it("shows today's template name, exercises and a Commencer link into the guided player", () => {
    render(
      <TrackingCard
        state={{
          ...EMPTY_STATE,
          todayTemplate: {
            templateId: 3,
            nom: "Push",
            exercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }],
          },
          rotationTemplates: [{ templateId: 3, nom: "Push" }],
        }}
      />,
    );
    expect(screen.getByText("Push")).toBeInTheDocument();
    expect(screen.getByText("Dips")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Commencer" })).toHaveAttribute("href", "/player/tracking?templateId=3");
  });

  it("hides Changer when the rotation has no other template", () => {
    render(
      <TrackingCard
        state={{
          ...EMPTY_STATE,
          todayTemplate: { templateId: 3, nom: "Push", exercises: [] },
          rotationTemplates: [{ templateId: 3, nom: "Push" }],
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Changer" })).not.toBeInTheDocument();
  });

  it("opens a sheet listing the other rotation templates on Changer, each linking into the guided player", async () => {
    render(
      <TrackingCard
        state={{
          ...EMPTY_STATE,
          todayTemplate: { templateId: 3, nom: "Push", exercises: [] },
          rotationTemplates: [
            { templateId: 3, nom: "Push" },
            { templateId: 4, nom: "Pull" },
          ],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Changer" }));
    expect(screen.getByRole("link", { name: "Pull" })).toHaveAttribute("href", "/player/tracking?templateId=4");
    expect(screen.queryByRole("link", { name: "Push" })).not.toBeInTheDocument();
  });
});
