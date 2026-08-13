import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { currentUser } from "./currentUser";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.MATHIS_EMAIL = "mathis@example.com";
  process.env.CLEMENT_EMAIL = "clement@example.com";
  delete process.env.DEV_FORCE_USER_SLUG;
  headersMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("currentUser", () => {
  it("resolves Mathis when the header matches MATHIS_EMAIL", async () => {
    headersMock.mockResolvedValue(new Headers({ [`cf-access-authenticated-user-email`]: "mathis@example.com" }));
    const user = await currentUser();
    expect(user.slug).toBe("mathis");
  });

  it("resolves Clément when the header matches CLEMENT_EMAIL", async () => {
    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "clement@example.com" }));
    const user = await currentUser();
    expect(user.slug).toBe("clement");
  });

  it("falls back to Mathis when the header is absent", async () => {
    headersMock.mockResolvedValue(new Headers());
    const user = await currentUser();
    expect(user.slug).toBe("mathis");
  });

  it("falls back to Mathis when headers() throws (no request scope)", async () => {
    headersMock.mockImplementation(() => {
      throw new Error("`headers` was called outside a request scope");
    });
    const user = await currentUser();
    expect(user.slug).toBe("mathis");
  });

  it("throws for a header email that matches no known user", async () => {
    headersMock.mockResolvedValue(new Headers({ "cf-access-authenticated-user-email": "intrus@example.com" }));
    await expect(currentUser()).rejects.toThrow("Accès non reconnu");
  });

  it("DEV_FORCE_USER_SLUG bypasses headers entirely", async () => {
    process.env.DEV_FORCE_USER_SLUG = "clement";
    const user = await currentUser();
    expect(user.slug).toBe("clement");
    expect(headersMock).not.toHaveBeenCalled();
  });
});
