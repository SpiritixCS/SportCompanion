import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackPainCard } from "./BackPainCard";

const FOUR_EXERCISES = [
  { name: "Hip hinge au bâton", dose: "2 × 10" },
  { name: "Pont fessier bilatéral", dose: "3 × 12" },
  { name: "Superman au sol", dose: "3 × 8" },
  { name: "Gainage latéral", dose: "3 × 20" },
];

describe("BackPainCard", () => {
  it("shows the day, intitulé, the first 3 exercises, and a rest-count toggle", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercises={FOUR_EXERCISES}
        done={false}
        doneReps={null}
        href="/player/dos"
      />,
    );
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
    expect(screen.getByText("Hip hinge au bâton")).toBeInTheDocument();
    expect(screen.queryByText("Gainage latéral")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "et 1 autre" })).toBeInTheDocument();
    expect(screen.getByText("Commencer")).toBeInTheDocument();
  });

  it("expands to show every exercise on click, then collapses back on a second click", async () => {
    const user = userEvent.setup();
    render(
      <BackPainCard
        jourLabel="Lundi" intitule="Charnière & chaîne postérieure"
        exercises={FOUR_EXERCISES} done={false} doneReps={null} href="/player/dos"
      />,
    );
    await user.click(screen.getByRole("button", { name: "et 1 autre" }));
    expect(screen.getByText("Gainage latéral")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voir moins" }));
    expect(screen.queryByText("Gainage latéral")).not.toBeInTheDocument();
  });

  it("shows the accomplished state with total reps and Revoir la séance", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercises={[]}
        done={true}
        doneReps={42}
        href="/player/dos"
      />,
    );
    expect(screen.getByText("42 répétitions")).toBeInTheDocument();
    expect(screen.getByText("Revoir la séance")).toBeInTheDocument();
    expect(screen.queryByText("Commencer")).not.toBeInTheDocument();
  });
});
