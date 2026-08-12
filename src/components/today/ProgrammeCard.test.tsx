import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgrammeCard } from "./ProgrammeCard";
import type { PastilleState } from "@/components/Pastille";

const PASTILLES: PastilleState[] = ["done", "restOrWalk", "today", "upcoming", "restOrWalk", "upcoming", "upcoming"];

describe("ProgrammeCard", () => {
  it("shows position, exercise preview, and the rest-count line", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire"
        level={2}
        dayTitle="Jour 5"
        pastilles={PASTILLES}
        exercisesPreview={[{ name: "Push ups", dose: "3 × 12" }, { name: "Squats", dose: "3 × 15" }]}
        exercisesRestCount={2}
        durationEstimateMinutes={26}
        done={false}
        doneReps={null}
        href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByText("Intermédiaire · Niveau 3 · Jour 5")).toBeInTheDocument();
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.getByText("et 2 autres")).toBeInTheDocument();
    expect(screen.getByText("26 min")).toBeInTheDocument();
  });

  it("shows Commencer la séance and no accomplished block when not done", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercisesPreview={[]} exercisesRestCount={0} durationEstimateMinutes={18}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByRole("link", { name: "Commencer la séance" })).toHaveAttribute(
      "href", "/player?parcours=intermediate&level=2&day=4",
    );
    expect(screen.queryByText("Revoir la séance")).not.toBeInTheDocument();
  });

  it("shows the accomplished block and Revoir la séance when done", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercisesPreview={[]} exercisesRestCount={0} durationEstimateMinutes={18}
        done doneReps={42} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByText("42 répétitions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revoir la séance" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Commencer la séance" })).not.toBeInTheDocument();
  });

  it("omits the rest-count line when there's nothing left to preview", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercisesPreview={[{ name: "Plank", dose: "3 × 20-40" }]} exercisesRestCount={0} durationEstimateMinutes={18}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.queryByText(/autres?$/)).not.toBeInTheDocument();
  });
});
