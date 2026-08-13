import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiScreen } from "./AujourdhuiScreen";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { DosTodayState } from "@/lib/dos/loadDosTodayState";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/programme/actions", () => ({
  setCurrentPositionAction: vi.fn().mockResolvedValue(undefined),
  resolveLevelUpAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/settings/actions", () => ({
  getReglagesStateAction: vi.fn().mockResolvedValue({
    restBetweenSetsSeconds: 90,
    restBetweenExercisesSeconds: 120,
    soundCountdownEnabled: false,
    startCountdownEnabled: false,
    keepScreenAwakeEnabled: true,
    dosStartDate: null,
    version: "0.1.0",
  }),
  updateSettingsAction: vi.fn(),
}));

const DOS_NO_START_DATE: DosTodayState = { phase: "no-start-date" };
const DOS_NORMAL: DosTodayState = {
  phase: "normal",
  jourLabel: "Lundi",
  intitule: "Charnière & chaîne postérieure",
  exercisesPreview: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
  exercisesRestCount: 0,
  done: false,
  doneReps: null,
  resume: null,
};

describe("AujourdhuiScreen", () => {
  it("empty state shows the point de départ invite and opens SetupFlow on click", async () => {
    render(<AujourdhuiScreen state={{ phase: "empty" }} dosState={DOS_NO_START_DATE} />);
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Définir mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("level-up state renders the LevelUpPrompt", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
  });

  it("level-up state still shows the active parcours in Réglages, not Non défini", async () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 1")).toBeInTheDocument();
  });

  it("normal state renders the Programme card and the real BackPainCard", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NORMAL} />);
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
  });

  it("normal state with a Programme resume shows the cobalt ResumeBanner", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null,
      resume: { exerciseName: "Push ups" },
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NO_START_DATE} />);
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
  });

  it("shows the no-start-date Dos card when Dos setup hasn't happened yet", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NO_START_DATE} />);
    expect(screen.getByText("Définis ta date de départ pour commencer.")).toBeInTheDocument();
  });

  it("shows a sage ResumeBanner when the Dos seance is interrupted", () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    const dosResume: DosTodayState = { ...DOS_NORMAL, resume: { exerciseName: "Hip hinge au bâton" } };
    render(<AujourdhuiScreen state={state} dosState={dosResume} />);
    expect(screen.getByText("Reprendre à Hip hinge au bâton")).toBeInTheDocument();
  });

  it("opens Réglages from the header icon and closes it", async () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NORMAL} />);
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(screen.getByText("Réglages")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
  });

  it("Changer mon point de départ inside Réglages closes it and opens SetupFlow", async () => {
    const state: TodayState = {
      phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
      dayTitle: "Jour 1", exercisesPreview: [], exercisesRestCount: 0, totalExercises: 0,
      durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
    };
    render(<AujourdhuiScreen state={state} dosState={DOS_NORMAL} />);
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });
});
