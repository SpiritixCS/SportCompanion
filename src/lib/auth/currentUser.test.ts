import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { currentUser } from "./currentUser";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.DATA_DIR = "/srv/data";
  delete process.env.DEV_FORCE_USER_EMAIL;
  delete process.env.CF_ACCESS_TEAM_DOMAIN;
  delete process.env.CF_ACCESS_AUD;
  headersMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("currentUser", () => {
  it("resolves any email from the header to its own file under DATA_DIR/users", async () => {
    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "Nouveau@Exemple.fr" }));
    expect(await currentUser()).toEqual({
      email: "nouveau@exemple.fr",
      dbPath: path.join("/srv/data", "users", "nouveau@exemple.fr.db"),
    });
  });

  it("redirects to /acces-refuse when no identity can be resolved", async () => {
    headersMock.mockResolvedValue(new Headers({}));
    await expect(currentUser()).rejects.toThrow("REDIRECT:/acces-refuse");
  });

  it("uses DEV_FORCE_USER_EMAIL outside production, even without a request scope", async () => {
    process.env.DEV_FORCE_USER_EMAIL = "dev@exemple.fr";
    headersMock.mockRejectedValue(new Error("no request scope"));
    expect((await currentUser()).email).toBe("dev@exemple.fr");
  });
});
