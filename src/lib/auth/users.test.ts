import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { knownUsers } from "./users";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.DB_PATH;
  delete process.env.MATHIS_EMAIL;
  delete process.env.CLEMENT_EMAIL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("knownUsers", () => {
  it("returns only Mathis when CLEMENT_EMAIL is unset", () => {
    const users = knownUsers();
    expect(users.map((u) => u.slug)).toEqual(["mathis"]);
  });

  it("defaults Mathis's dbPath to data/sportcompanion.db under cwd", () => {
    const users = knownUsers();
    expect(users[0]!.dbPath).toBe(path.join(process.cwd(), "data", "sportcompanion.db"));
  });

  it("uses DB_PATH for Mathis and derives Clément's path as a sibling file", () => {
    process.env.DB_PATH = "/srv/app/data/sportcompanion.db";
    process.env.CLEMENT_EMAIL = "clement@example.com";
    const users = knownUsers();
    expect(users.find((u) => u.slug === "mathis")!.dbPath).toBe("/srv/app/data/sportcompanion.db");
    expect(users.find((u) => u.slug === "clement")!.dbPath).toBe("/srv/app/data/sportcompanion.clement.db");
  });

  it("includes Clément once CLEMENT_EMAIL is set, carrying the configured email", () => {
    process.env.CLEMENT_EMAIL = "clement@example.com";
    const users = knownUsers();
    const clement = users.find((u) => u.slug === "clement");
    expect(clement).toBeDefined();
    expect(clement!.email).toBe("clement@example.com");
    expect(clement!.label).toBe("Clément");
  });
});
