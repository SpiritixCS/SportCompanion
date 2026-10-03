import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeScreen } from "./ProgrammeScreen";
import type { ProgrammeLevelRow } from "@/lib/programme/loadProgrammeState";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const setCurrentPositionAction = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/programme/actions", () => ({
  setCurrentPositionAction: (...args: unknown[]) => setCurrentPositionAction(...args),
}));

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  setCurrentPositionAction.mockClear();
});

const BEGINNER_LEVELS: ProgrammeLevelRow[] = [
  {
    level: 0, percentDone: 33, pastilles: ["done", "restOrWalk", "upcoming", "restOrWalk", "upcoming", "restOrWalk", "restOrWalk"],
    days: [
      { dayIndex: 0, title: "Jour 1", exerciseCount: 4, durationEstimateMinutes: 34, pastilleState: "done" },
      { dayIndex: 1, title: "Jour 2", exerciseCount: 0, durationEstimateMinutes: 18, pastilleState: "restOrWalk" },
    ],
  },
];

const INTERMEDIATE_LEVELS: ProgrammeLevelRow[] = [0, 1, 2].map((level) => ({
  level, percentDone: 0, pastilles: ["upcoming", "restOrWalk", "upcoming", "restOrWalk", "upcoming", "restOrWalk", "restOrWalk"],
  days: [0, 1, 2, 3, 4].map((dayIndex) => ({
    dayIndex, title: `Jour ${dayIndex + 1}`, exerciseCount: dayIndex % 2 ? 0 : 7, durationEstimateMinutes: 46,
    pastilleState: dayIndex % 2 ? "restOrWalk" : "upcoming",
  })),
}));

const LEVELS_BY_PARCOURS = { beginner: BEGINNER_LEVELS, intermediate: INTERMEDIATE_LEVELS, advanced: [] };

describe("ProgrammeScreen", () => {
  it("shows the initial parcours' level rows with percent done", () => {
    render(<ProgrammeScreen initialParcours="beginner" levelsByParcours={LEVELS_BY_PARCOURS} />);
    expect(screen.getByText("Niveau 1")).toBeInTheDocument();
    expect(screen.getByText("33")).toBeInTheDocument();
  });

  it("switching the parcours tab shows that parcours' rows", async () => {
    render(<ProgrammeScreen initialParcours="beginner" levelsByParcours={LEVELS_BY_PARCOURS} />);
    await userEvent.click(screen.getByText("Advanced"));
    expect(screen.queryByText("Niveau 1")).not.toBeInTheDocument();
  });

  it("expanding a level row shows its 7 days, including rest days", async () => {
    render(<ProgrammeScreen initialParcours="beginner" levelsByParcours={LEVELS_BY_PARCOURS} />);
    await userEvent.click(screen.getByText("Niveau 1"));
    expect(screen.getByText("4 exercices · 34 min")).toBeInTheDocument();
    expect(screen.getByText("Repos")).toBeInTheDocument();
  });

  it("clicking a day opens the fiche jour sheet", async () => {
    render(<ProgrammeScreen initialParcours="beginner" levelsByParcours={LEVELS_BY_PARCOURS} />);
    await userEvent.click(screen.getByText("Niveau 1"));
    await userEvent.click(screen.getByText("Jour 1"));
    expect(screen.getByText("Démarrer ce jour")).toBeInTheDocument();
  });

  it("opens the user's current parcours and level, tagging it En cours and the day Aujourd'hui", () => {
    render(
      <ProgrammeScreen
        initialParcours="beginner"
        levelsByParcours={LEVELS_BY_PARCOURS}
        current={{ parcours: "intermediate", level: 2, dayIndex: 4 }}
      />,
    );
    expect(screen.getByRole("button", { name: "Intermédiaire" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("En cours")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Niveau 3/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Jour 5 : Aujourd'hui" })).toHaveLength(1);
  });

  it("opens nothing and tags nothing without a current position", () => {
    render(<ProgrammeScreen initialParcours="beginner" levelsByParcours={LEVELS_BY_PARCOURS} current={null} />);
    expect(screen.getByRole("button", { name: "Débutant" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("En cours")).not.toBeInTheDocument();
    expect(screen.queryByText("Démarrer ce jour")).not.toBeInTheDocument();
  });
});
