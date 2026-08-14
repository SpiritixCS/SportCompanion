import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgrammeCard } from "./ProgrammeCard";
import type { PastilleState } from "@/components/Pastille";

const PASTILLES: PastilleState[] = ["done", "restOrWalk", "today", "upcoming", "restOrWalk", "upcoming", "upcoming"];

const FIVE_EXERCISES = [
  { name: "Push ups", dose: "3 × 12" },
  { name: "Squats", dose: "3 × 15" },
  { name: "Dips", dose: "3 × 10" },
  { name: "Pull ups", dose: "3 × 8" },
  { name: "Plank", dose: "3 × 20-40" },
];

describe("ProgrammeCard", () => {
  it("shows position, the first 3 exercises, and a rest-count toggle beyond that", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire"
        level={2}
        dayTitle="Jour 5"
        pastilles={PASTILLES}
        exercises={FIVE_EXERCISES}
        durationEstimateMinutes={26}
        done={false}
        doneReps={null}
        href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByText("Intermédiaire · Niveau 3 · Jour 5")).toBeInTheDocument();
    expect(screen.getByText("Push ups")).toBeInTheDocument();
    expect(screen.getByText("3 × 12")).toBeInTheDocument();
    expect(screen.queryByText("Pull ups")).not.toBeInTheDocument();
    expect(screen.getByText("26 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "et 2 autres" })).toBeInTheDocument();
  });

  it("expands to show every exercise on click, then collapses back on a second click", async () => {
    const user = userEvent.setup();
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={FIVE_EXERCISES} durationEstimateMinutes={26}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    await user.click(screen.getByRole("button", { name: "et 2 autres" }));
    expect(screen.getByText("Pull ups")).toBeInTheDocument();
    expect(screen.getByText("Plank")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voir moins" }));
    expect(screen.queryByText("Pull ups")).not.toBeInTheDocument();
  });

  it("shows Commencer la séance and no accomplished block when not done", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={[]} durationEstimateMinutes={18}
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
        exercises={[]} durationEstimateMinutes={18}
        done doneReps={42} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.getByText("42 répétitions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revoir la séance" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Commencer la séance" })).not.toBeInTheDocument();
  });

  it("omits the toggle when there's nothing left beyond the first 3", () => {
    render(
      <ProgrammeCard
        parcoursLabel="Intermédiaire" level={2} dayTitle="Jour 5" pastilles={PASTILLES}
        exercises={[{ name: "Plank", dose: "3 × 20-40" }]} durationEstimateMinutes={18}
        done={false} doneReps={null} href="/player?parcours=intermediate&level=2&day=4"
      />,
    );
    expect(screen.queryByRole("button", { name: /^et .* autres?$/ })).not.toBeInTheDocument();
  });
});
