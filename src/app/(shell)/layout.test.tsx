import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const getPrenom = vi.fn();
vi.mock("@/lib/auth/currentUser", () => ({ currentUser: async () => ({ email: "a@b.fr", dbPath: "/x" }) }));
vi.mock("@/lib/db/client", () => ({ getDbForUser: () => ({}) }));
vi.mock("@/lib/profile/db", () => ({ getPrenom: () => getPrenom() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/profile/actions", () => ({ setPrenomAction: vi.fn() }));

import ShellLayout from "./layout";

beforeEach(() => getPrenom.mockReset());

describe("ShellLayout", () => {
  it("asks for the prénom before anything else when none is stored", async () => {
    getPrenom.mockReturnValue(null);
    render(await ShellLayout({ children: <p>contenu</p> }));
    expect(screen.getByText("Comment tu t'appelles ?")).toBeInTheDocument();
    expect(screen.queryByText("contenu")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders the nav and the page once the prénom is stored", async () => {
    getPrenom.mockReturnValue("Léa");
    render(await ShellLayout({ children: <p>contenu</p> }));
    expect(screen.getByText("contenu")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
