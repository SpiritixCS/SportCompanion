import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeBanner } from "./ResumeBanner";

describe("ResumeBanner", () => {
  it("shows the resume label and links to the player at the given href", () => {
    render(<ResumeBanner exerciseName="Push ups" href="/player?parcours=beginner&level=0&day=0" />);
    expect(screen.getByText("Séance interrompue")).toBeInTheDocument();
    expect(screen.getByText("Reprendre à Push ups")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/player?parcours=beginner&level=0&day=0");
  });

  it("uses the sage accent border when accent='sage'", () => {
    render(<ResumeBanner exerciseName="Fentes" href="/player/tracking?day=0" accent="sage" />);
    expect(screen.getByRole("link")).toHaveClass("border-sage");
  });
});
