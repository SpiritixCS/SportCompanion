#!/usr/bin/env python3
"""Génère src/lib/workout/data.ts depuis workout_curated.json."""
import json
from pathlib import Path

CURATED_JSON = Path("workout_curated.json")
OUTPUT_TS = Path("../src/lib/workout/data.ts")


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def ts_value(v):
    if v is None:
        return "null"
    if isinstance(v, list):
        return "[" + ", ".join(str(x) for x in v) + "]"
    return str(v)


def ts_exercise(ex: dict) -> str:
    t = ex["target"]
    target_ts = (
        "{ unit: " + ts_string(t["unit"]) + ", value: " + ts_value(t["value"]) +
        ", maxEffort: " + ("true" if t["maxEffort"] else "false") +
        ", eachSide: " + ("true" if t["eachSide"] else "false") + " }"
    )
    return (
        "{ id: " + ts_string(ex["id"]) + ", name: " + ts_string(ex["name"]) +
        ", movementFamily: " + ts_string(ex["movementFamily"]) +
        ", countsInStats: " + ("true" if ex["countsInStats"] else "false") +
        ", videoId: " + (ts_string(ex["videoId"]) if ex["videoId"] else "null") +
        ", sets: " + str(ex["sets"]) + ", target: " + target_ts + " }"
    )


def ts_slot(slot: dict) -> str:
    if slot["kind"] == "rest":
        return '{ kind: "rest" }'
    exercises_ts = ",\n        ".join(ts_exercise(e) for e in slot["exercises"])
    return (
        '{ kind: "train", label: ' + ts_string(slot["label"]) + ", exercises: [\n        " +
        exercises_ts + "\n      ] }"
    )


def main():
    curated = json.loads(CURATED_JSON.read_text(encoding="utf-8"))

    lines = [
        '// Généré par Caliathletics/generate_data_ts.py depuis workout_curated.json.',
        '// Ne pas éditer à la main — corriger la source (curate_workout.py) et régénérer.',
        'import type { WorkoutProgram } from "./types";',
        "",
    ]

    # Export individual tiers
    for tier in ["beginner", "intermediate", "advanced"]:
        lines.append(f"export const {tier} = [")
        for level in curated[tier]:
            slots_ts = ",\n    ".join(ts_slot(s) for s in level)
            lines.append(f"  [\n    {slots_ts}\n  ],")
        lines.append("];")
        lines.append("")

    # Export WORKOUT_PROGRAM for backwards compatibility
    lines.append("export const WORKOUT_PROGRAM: WorkoutProgram = {")
    for tier in ["beginner", "intermediate", "advanced"]:
        lines.append(f"  {tier},")
    lines.append("};")

    OUTPUT_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"-> {OUTPUT_TS}")


if __name__ == "__main__":
    main()
