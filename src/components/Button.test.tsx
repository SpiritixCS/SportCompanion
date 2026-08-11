import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a primary button with the accent background and pill radius", () => {
    render(
      <Button variant="primary" accent="cobalt">
        Commencer la séance
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Commencer la séance" });
    expect(button).toHaveClass("bg-cobalt", "rounded-pill", "h-14");
  });

  it("renders a secondary button as an outline", () => {
    render(<Button variant="secondary">Revoir la séance</Button>);
    const button = screen.getByRole("button", { name: "Revoir la séance" });
    expect(button).toHaveClass("border-hairline", "rounded-pill");
    expect(button).not.toHaveClass("bg-cobalt");
  });

  it("fires onClick and respects disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" accent="sage" onClick={onClick} disabled>
        Terminer
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
