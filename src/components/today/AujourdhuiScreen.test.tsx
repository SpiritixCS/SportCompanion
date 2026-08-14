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
vi.mock("@/lib/tracking/actions", () => ({ startTrackingSeanceAction: vi.fn() }));

const MATHIS = { slug: "mathis" as const, label: "Mathis" };
const CLEMENT = { slug: "clement" as const, label: "Clément" };

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

const NORMAL_PROGRAMME_STATE: TodayState = {
  phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
  dayTitle: "Jour 1", exercises: [], totalExercises: 0,
  durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
};

describe("AujourdhuiScreen", () => {
  it("empty state shows the point de départ invite and opens SetupFlow on click", async () => {
    render(
      <AujourdhuiScreen state={{ phase: "empty" }} dosState={DOS_NO_START_DATE} trackingState={null} user={MATHIS} />,
    );
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Définir mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("level-up state renders the LevelUpPrompt", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
        trackingState={null}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
  });

  it("level-up state still shows the active parcours in Réglages, not Non défini", async () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={DOS_NO_START_DATE}
        trackingState={null}
        user={MATHIS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 1")).toBeInTheDocument();
  });

  it("normal state renders the Programme card and the real BackPainCard", () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        dosState={DOS_NORMAL}
        trackingState={null}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
  });

  it("normal state with a Programme resume shows the cobalt ResumeBanner", () => {
    const state: TodayState = { ...NORMAL_PROGRAMME_STATE, resume: { exerciseName: "Push ups" } };
    render(<AujourdhuiScreen state={state} dosState={DOS_NO_START_DATE} trackingState={null} user={MATHIS} />);
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
  });

  it("shows the no-start-date Dos card when Dos setup hasn't happened yet", () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        dosState={DOS_NO_START_DATE}
        trackingState={null}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Définis ta date de départ pour commencer.")).toBeInTheDocument();
  });

  it("shows a sage ResumeBanner when the Dos seance is interrupted", () => {
    const dosResume: DosTodayState = { ...DOS_NORMAL, resume: { exerciseName: "Hip hinge au bâton" } };
    render(
      <AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={dosResume} trackingState={null} user={MATHIS} />,
    );
    expect(screen.getByText("Reprendre à Hip hinge au bâton")).toBeInTheDocument();
  });

  it("opens Réglages from the header icon and closes it", async () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        dosState={DOS_NORMAL}
        trackingState={null}
        user={MATHIS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(screen.getByText("Réglages")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
  });

  it("Changer mon point de départ inside Réglages closes it and opens SetupFlow", async () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        dosState={DOS_NORMAL}
        trackingState={null}
        user={MATHIS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("greets Clément by name and never renders a Dos card when dosState is null", () => {
    render(
      <AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} dosState={null} trackingState={null} user={CLEMENT} />,
    );
    expect(screen.getByText("Salut Clément.")).toBeInTheDocument();
    expect(screen.queryByText("Dos")).not.toBeInTheDocument();
  });

  it("shows the Tracking card for Clément when trackingState is provided", () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        dosState={null}
        trackingState={{ activeSeanceId: null, seances: [] }}
        user={CLEMENT}
      />,
    );
    expect(screen.getByRole("button", { name: "Enregistrer une séance" })).toBeInTheDocument();
  });

  it("shows the Tracking card for Clément even before he's set a Programme point de départ", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "empty" }}
        dosState={null}
        trackingState={{ activeSeanceId: null, seances: [] }}
        user={CLEMENT}
      />,
    );
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer une séance" })).toBeInTheDocument();
  });

  it("shows the Tracking card for Clément on the level-up prompt too", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        dosState={null}
        trackingState={{ activeSeanceId: 3, seances: [] }}
        user={CLEMENT}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/3");
  });
});
