#!/usr/bin/env python3
"""Self-check de workout_curated.json."""
import json
from pathlib import Path

data = json.loads(Path("workout_curated.json").read_text(encoding="utf-8"))

VALID_FAMILIES = {"pull", "push", "dip", "squat", "core", "lever", "handstand", "other"}
VALID_UNITS = {"reps", "seconds", "minutes"}

count = 0
for tier, levels in data.items():
    for level in levels:
        for slot in level:
            if slot["kind"] != "train":
                continue
            for ex in slot["exercises"]:
                count += 1
                assert ex["movementFamily"] in VALID_FAMILIES, ex
                assert ex["target"]["unit"] in VALID_UNITS, ex
                assert isinstance(ex["countsInStats"], bool), ex
                assert isinstance(ex["sets"], int) and ex["sets"] > 0, ex
                assert ex["id"], ex

# Le bug de casse est corrigé : les variantes de casse d'un même exercice
# sont normalisées vers le même ID. Vérifier pour Dragon Flag (Dragon flag existe aussi).
ids = set()
for tier, levels in data.items():
    for level in levels:
        for slot in level:
            if slot["kind"] != "train":
                continue
            for ex in slot["exercises"]:
                if ex["name"] == "Dragon Flag":
                    ids.add(ex["id"])
assert len(ids) == 1, f"Dragon Flag a plusieurs id après normalisation : {ids}"

print(f"OK — {count} entrées exercice vérifiées")
