import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackPainCard } from "./BackPainCard";

describe("BackPainCard", () => {
  it("shows the day, intitulé, and exercise preview", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercisesPreview={[{ name: "Hip hinge au bâton", dose: "2 × 10" }]}
        exercisesRestCount={2}
        done={false}
        doneReps={null}
        href="/player/dos"
      />,
    );
    expect(screen.getByText("Lundi · Charnière & chaîne postérieure")).toBeInTheDocument();
    expect(screen.getByText("Hip hinge au bâton")).toBeInTheDocument();
    expect(screen.getByText("et 2 autres")).toBeInTheDocument();
    expect(screen.getByText("Commencer")).toBeInTheDocument();
  });

  it("shows the accomplished state with total reps and Revoir la séance", () => {
    render(
      <BackPainCard
        jourLabel="Lundi"
        intitule="Charnière & chaîne postérieure"
        exercisesPreview={[]}
        exercisesRestCount={0}
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
