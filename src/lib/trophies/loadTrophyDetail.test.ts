import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet } from "@/lib/player/db";
import { loadTrophyDetail } from "./loadTrophyDetail";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-trophy-detail-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTrophyDetail", () => {
  it("returns null for an id with no logged sets", () => {
    const db = setup();
    expect(loadTrophyDetail(db, "squats")).toBeNull();
  });

  it("returns the card plus prochainPalier and resteAParcourir", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 6 = "squats", countsInStats: true
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 90, restSeconds: 90 });

    const detail = loadTrophyDetail(db, "squats");
    expect(detail).toMatchObject({ id: "squats", total: 90, prochainPalier: 100, resteAParcourir: 10 });
  });

  it("returns null resteAParcourir once every palier is passed", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 30_000, restSeconds: 90 });

    const detail = loadTrophyDetail(db, "squats");
    expect(detail).toMatchObject({ prochainPalier: null, resteAParcourir: null });
  });
});
