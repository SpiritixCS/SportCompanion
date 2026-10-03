import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { normalizeEmail, userDbPath } from "./email";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Mathis.F+x@Gmail.COM ")).toBe("mathis.f+x@gmail.com");
  });

  it.each(["", "abc", "../x@y.zz", "a/b@c.dd", "a\\b@c.dd", "a@b", "a@b.c", "a b@c.dd", "a@b.dd\u0000"])("rejects %j", (raw) => {
    expect(normalizeEmail(raw)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("userDbPath", () => {
  it("places the file under <DATA_DIR>/users", () => {
    process.env.DATA_DIR = "/srv/data";
    expect(userDbPath("a@b.fr")).toBe(path.join("/srv/data", "users", "a@b.fr.db"));
  });

  it("defaults DATA_DIR to <cwd>/data", () => {
    delete process.env.DATA_DIR;
    expect(userDbPath("a@b.fr")).toBe(path.join(process.cwd(), "data", "users", "a@b.fr.db"));
  });
});
