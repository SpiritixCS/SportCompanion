import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

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
});
