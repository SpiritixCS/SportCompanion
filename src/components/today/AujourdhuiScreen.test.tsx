import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiScreen } from "./AujourdhuiScreen";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

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
    prenom: "Mathis",
    version: "0.1.0",
  }),
  updateSettingsAction: vi.fn(),
}));
vi.mock("@/lib/profile/actions", () => ({ setPrenomAction: vi.fn() }));
vi.mock("@/lib/tracking/actions", () => ({ advanceProgramDayAction: vi.fn(), startPyramidAction: vi.fn() }));

const MATHIS = { slug: "mathis" as const, label: "Mathis" };
const CLEMENT = { slug: "clement" as const, label: "Clément" };

const TRACKING_REST: TrackingScreenState = {
  programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
  programEmpty: false,
  activeSeance: null,
  seances: [],
};

const NORMAL_PROGRAMME_STATE: TodayState = {
  phase: "normal", parcours: "beginner", parcoursLabel: "Débutant", level: 0, dayIndex: 0,
  dayTitle: "Jour 1", exercises: [], totalExercises: 0,
  durationEstimateMinutes: 18, pastilles: [], done: false, doneReps: null, resume: null,
};

describe("AujourdhuiScreen", () => {
  it("empty state shows the point de départ invite and opens SetupFlow on click", async () => {
    render(
      <AujourdhuiScreen state={{ phase: "empty" }} trackingState={TRACKING_REST} user={MATHIS} />,
    );
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Définir mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("level-up state renders the LevelUpPrompt", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        trackingState={TRACKING_REST}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
  });

  it("level-up state still shows the active parcours in Réglages, not Non défini", async () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        trackingState={TRACKING_REST}
        user={MATHIS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Débutant")).toBeInTheDocument());
    expect(screen.getByText("Niveau 1")).toBeInTheDocument();
  });

  it("normal state renders the Programme card and the Tracking card, never a Dos card", () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        trackingState={TRACKING_REST}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 · Jour 1")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Repos")).toBeInTheDocument();
    expect(screen.queryByText("Dos")).not.toBeInTheDocument();
  });

  it("normal state with a Programme resume shows the cobalt ResumeBanner", () => {
    const state: TodayState = { ...NORMAL_PROGRAMME_STATE, resume: { exerciseName: "Push ups" } };
    render(<AujourdhuiScreen state={state} trackingState={TRACKING_REST} user={MATHIS} />);
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
  });

  it("opens Réglages from the header icon and closes it", async () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        trackingState={TRACKING_REST}
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
        trackingState={TRACKING_REST}
        user={MATHIS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(screen.getByText("Changer mon point de départ")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Changer mon point de départ" }));
    expect(screen.getByText("Choisis ton parcours")).toBeInTheDocument();
  });

  it("greets the user by name", () => {
    render(
      <AujourdhuiScreen state={NORMAL_PROGRAMME_STATE} trackingState={TRACKING_REST} user={CLEMENT} />,
    );
    expect(screen.getByText("Salut Clément.")).toBeInTheDocument();
  });

  it("shows the Tracking card for Mathis too", () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        trackingState={TRACKING_REST}
        user={MATHIS}
      />,
    );
    expect(screen.getByText("Lundi · Repos")).toBeInTheDocument();
  });

  it("shows the Tracking card for Clément even before he's set a Programme point de départ", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "empty" }}
        trackingState={{ programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
  programEmpty: false, activeSeance: null, seances: [] }}
        user={CLEMENT}
      />,
    );
    expect(screen.getByText("Premier jour")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Repos")).toBeInTheDocument();
  });

  it("shows the Tracking card for Clément on the level-up prompt too", () => {
    render(
      <AujourdhuiScreen
        state={{ phase: "level-up", parcours: "beginner", parcoursLabel: "Débutant", level: 0 }}
        trackingState={{ programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
  programEmpty: false, activeSeance: { id: 3, dayOfWeek: null, dayLabel: null, plannedExercises: null, loggedExercises: [] }, seances: [] }}
        user={CLEMENT}
      />,
    );
    expect(screen.getByText("Débutant · Niveau 1 terminé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/tracking/3");
  });

  it("offers to launch a pyramid from Aujourd'hui", async () => {
    render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        trackingState={TRACKING_REST}
        user={MATHIS}
        pyramid={{ suggestions: ["Pull ups"], catalog: [], lastPeaks: {} }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Lancer une pyramide" }));
    expect(screen.getByRole("dialog", { name: "Pyramide · Lancer" })).toBeInTheDocument();
  });

  it("places the pyramid card second, between the Programme and the Tracking", () => {
    const { container } = render(
      <AujourdhuiScreen
        state={NORMAL_PROGRAMME_STATE}
        trackingState={TRACKING_REST}
        user={MATHIS}
        pyramid={{ suggestions: [], catalog: [], lastPeaks: {} }}
      />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("UP, DOWN")).toBeGreaterThan(text.indexOf("Commencer la séance"));
    expect(text.indexOf("UP, DOWN")).toBeLessThan(text.lastIndexOf("Tracking"));
  });
});
