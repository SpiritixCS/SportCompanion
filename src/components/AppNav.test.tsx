import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("shows Dos, not Tracking, for Mathis", () => {
    render(<AppNav userSlug="mathis" />);
    expect(screen.getByRole("link", { name: "Dos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tracking" })).not.toBeInTheDocument();
  });

  it("shows Tracking, not Dos, for Clément", () => {
    render(<AppNav userSlug="clement" />);
    expect(screen.getByRole("link", { name: "Tracking" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dos" })).not.toBeInTheDocument();
  });

  it("both variants keep Aujourd'hui, Programme, Trophées", () => {
    render(<AppNav userSlug="clement" />);
    expect(screen.getByRole("link", { name: "Aujourd'hui" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Programme" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trophées" })).toBeInTheDocument();
  });
});
