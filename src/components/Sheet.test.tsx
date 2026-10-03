import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("renders nothing when closed", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Ajuster les reps">
        contenu
      </Sheet>,
    );
    expect(screen.queryByText("contenu")).not.toBeInTheDocument();
  });

  it("renders content and title when open", () => {
    render(
      <Sheet open onClose={() => {}} title="Ajuster les reps">
        contenu
      </Sheet>,
    );
    expect(screen.getByText("contenu")).toBeInTheDocument();
    expect(screen.getByText("Ajuster les reps")).toBeInTheDocument();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Ajuster les reps">
        contenu
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Ajuster les reps">
        contenu
      </Sheet>,
    );
    fireEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders an optional eyebrow above the title and includes it in the dialog name", () => {
    render(
      <Sheet open onClose={() => {}} title="Jour 5" eyebrow="Débutant · Niveau 3">
        <p>contenu</p>
      </Sheet>,
    );
    const eyebrow = screen.getByText("Débutant · Niveau 3");
    const title = screen.getByText("Jour 5");
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Débutant · Niveau 3 · Jour 5" })).toBeInTheDocument();
  });
});
