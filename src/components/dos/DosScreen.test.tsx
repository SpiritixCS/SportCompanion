import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DosScreen } from "./DosScreen";
import type { DosScreenState } from "@/lib/dos/loadDosScreenState";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("DosScreen", () => {
  it("renders DosSetup when no start date is set", () => {
    render(<DosScreen state={{ phase: "no-start-date" }} />);
    expect(screen.getByText("Tu démarres aujourd'hui ?")).toBeInTheDocument();
  });

  it("renders semaine/bloc, today's card, week row, and arbre progress when ready", () => {
    const state: DosScreenState = {
      phase: "ready",
      semaine: 5,
      bloc: 2,
      today: {
        phase: "normal",
        jourLabel: "Lundi",
        intitule: "Charnière & chaîne postérieure",
        exercisesPreview: [{ name: "Hip hinge au bâton", dose: "2 × 10" }],
        exercisesRestCount: 0,
        done: false,
        doneReps: null,
        resume: null,
      },
      arbresProgress: [
        { arbre: "A", nom: "Charnière & ischios", cranCourant: 3, cranNom: "Leg curl serviette bilatéral", totalCrans: 8 },
      ],
      weekPastilles: ["today", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming", "restOrWalk"],
    };
    render(<DosScreen state={state} />);
    expect(screen.getByText("Semaine 5 · Bloc 2")).toBeInTheDocument();
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
    expect(screen.getByText("Charnière & ischios")).toBeInTheDocument();
    expect(screen.getByText("Leg curl serviette bilatéral")).toBeInTheDocument();
  });

  it("shows a Repos card when today is a rest day", () => {
    const state: DosScreenState = {
      phase: "ready",
      semaine: 5,
      bloc: 2,
      today: { phase: "rest" },
      arbresProgress: [],
      weekPastilles: ["done", "done", "done", "done", "done", "done", "restOrWalk"],
    };
    render(<DosScreen state={state} />);
    expect(screen.getByText("Repos")).toBeInTheDocument();
  });
});
