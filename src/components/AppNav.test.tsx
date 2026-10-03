import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("shows the same 4 entries for everyone, Tracking in place of Dos", () => {
    render(<AppNav />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Aujourd'hui",
      "Programme",
      "Tracking",
      "Trophées",
    ]);
    expect(screen.queryByRole("link", { name: "Dos" })).not.toBeInTheDocument();
  });

  it("keeps the parent tab active on its sub-pages", () => {
    pathname.mockReturnValue("/trophees/push-ups");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Trophées" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Aujourd'hui" })).not.toHaveAttribute("aria-current");
  });

  it("only treats / as Aujourd'hui on the exact path", () => {
    pathname.mockReturnValue("/tracking/programme");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Tracking" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Aujourd'hui" })).not.toHaveAttribute("aria-current");
  });
});
