import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { createTemplate } from "./templates";
import { getRotation, setRotation, advancePointer, getTodayTemplateId } from "./program";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-program-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("getRotation", () => {
  it("returns an empty rotation and a null pointer initially", () => {
    const db = setup();
    expect(getRotation(db)).toEqual({ entries: [], pointerTemplateId: null });
  });
});

describe("setRotation", () => {
  it("orders entries as given and points to the first one when nothing was set before", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    const rotation = setRotation(db, [push.id, pull.id]);
    expect(rotation.entries.map((e) => e.templateId)).toEqual([push.id, pull.id]);
    expect(rotation.pointerTemplateId).toBe(push.id);
  });

  it("keeps the current pointer when it's still in the new rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);
    advancePointer(db, push.id);

    const rotation = setRotation(db, [pull.id, push.id]);
    expect(rotation.pointerTemplateId).toBe(pull.id);
  });

  it("falls back to the first entry when the current pointer drops out of the rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    const legs = createTemplate(db, "Legs", []);
    setRotation(db, [push.id, pull.id]);

    const rotation = setRotation(db, [legs.id]);
    expect(rotation.pointerTemplateId).toBe(legs.id);
  });

  it("falls back to a null pointer for an empty rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    setRotation(db, [push.id]);
    expect(setRotation(db, []).pointerTemplateId).toBeNull();
  });
});

describe("advancePointer", () => {
  it("moves to the next entry, wrapping around at the end", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);

    advancePointer(db, push.id);
    expect(getTodayTemplateId(db)).toBe(pull.id);

    advancePointer(db, pull.id);
    expect(getTodayTemplateId(db)).toBe(push.id);
  });

  it("does nothing when the completed template is no longer in the rotation", () => {
    const db = setup();
    const push = createTemplate(db, "Push", []);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);
    setRotation(db, [pull.id]);

    advancePointer(db, push.id);
    expect(getTodayTemplateId(db)).toBe(pull.id);
  });
});
