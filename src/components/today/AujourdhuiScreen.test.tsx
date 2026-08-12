import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiScreen } from "./AujourdhuiScreen";
import type { TodayState } from "@/lib/programme/loadTodayState";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/programme/actions", () => ({
  setCurrentPositionAction: vi.fn().mockResolvedValue(undefined),
  resolveLevelUpAction: vi.fn().mockResolvedValue(undefined),
}));

describe("AujourdhuiScreen", () => {
  it("empty state shows the point de départ invite and opens SetupFlow on click", async () => {
    render(<AujourdhuiScreen state={{ phase: "empty" }} />);
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Définir mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("level-up state renders the LevelUpPrompt", () => {
    render(<AujourdhuiScreen state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }} />);
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
  });

  it("normal state renders the Programme card and the BackPain stub card", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} />);
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Arrive en phase 4")).toBeInTheDocument();
  });

  it("normal state with a resume shows the ResumeBanner", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null,
      resume: { exerciseName: "Push ups" },
    };
    render(<AujourdhuiScreen state={state} />);
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
  });
});
