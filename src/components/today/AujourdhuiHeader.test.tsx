import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AujourdhuiHeader } from "./AujourdhuiHeader";

describe("AujourdhuiHeader", () => {
  it("shows the greeting with the given prénom and opens réglages on icon click", async () => {
    const onOpenReglages = vi.fn();
    render(<AujourdhuiHeader userLabel="Mathis" onOpenReglages={onOpenReglages} />);
    expect(screen.getByText("Salut Mathis.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(onOpenReglages).toHaveBeenCalledOnce();
  });

  it("greets Clément by his own prénom", () => {
    render(<AujourdhuiHeader userLabel="Clément" onOpenReglages={() => {}} />);
    expect(screen.getByText("Salut Clément.")).toBeInTheDocument();
  });

  it("fills in the date label after mount", async () => {
    render(<AujourdhuiHeader userLabel="Mathis" onOpenReglages={() => {}} />);
    const raw = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(),
    );
    const expected = raw.charAt(0).toUpperCase() + raw.slice(1);
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
  });
});
