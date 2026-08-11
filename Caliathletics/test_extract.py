#!/usr/bin/env python3
"""Self-check de workout_raw.json — pas de framework, juste des assert."""
import json
from pathlib import Path

from bs4 import BeautifulSoup

from Parser import FILE_RE, INPUT_DIR, day_number, extract_training_exercises

data = json.loads(Path("workout_raw.json").read_text(encoding="utf-8"))

assert set(data.keys()) == {"beginner", "intermediate", "advanced"}
assert len(data["beginner"]) == 8, f"beginner: {len(data['beginner'])} niveaux"
assert len(data["intermediate"]) == 8, f"intermediate: {len(data['intermediate'])} niveaux"
assert len(data["advanced"]) == 4, f"advanced: {len(data['advanced'])} niveaux"

# Longueur exacte de chaque niveau (nombre de slots, repos compris). Un test
# « > 0 » ne voit pas un jour perdu ; ce compte-là, si.
SLOTS_PAR_NIVEAU = {
    "beginner": [7, 7, 7, 7, 7, 7, 7, 7],
    "intermediate": [7, 7, 7, 7, 7, 7, 7, 7],
    "advanced": [7, 7, 7, 7],
}
for tier, attendus in SLOTS_PAR_NIVEAU.items():
    reels = [len(level) for level in data[tier]]
    assert reels == attendus, f"{tier}: slots par niveau {reels}, attendu {attendus}"

# Aucun fichier écarté ne contenait de séance : si un slug ne donne pas de
# numéro de jour, la page doit vraiment être une page d'intro/récap sans
# section Training. C'est le garde-fou du bug beginner niveau 3 Day 1
# (module-4__level-1.html, slug "level-1" mais titre "Day 1", 8 exercices).
ecartes = 0
for tier in SLOTS_PAR_NIVEAU:
    for html_file in sorted((INPUT_DIR / tier).glob("*.html")):
        m = FILE_RE.match(html_file.name)
        if not m:
            continue
        html = html_file.read_text(encoding="utf-8", errors="ignore")
        if day_number(m.group(2), html) is not None:
            continue
        ecartes += 1
        cartes = extract_training_exercises(BeautifulSoup(html, "html.parser"))
        assert not cartes, f"{html_file} écarté alors qu'il a {len(cartes)} exercices Training"
assert ecartes > 0, "aucun fichier écarté : le filtre des pages d'intro ne s'applique plus"

# Le bug Skills Practice est corrigé : "Handstand push up" n'apparaît plus
# 3 fois avec 3 prescriptions différentes dans le niveau 1 advanced.
level1_advanced = data["advanced"][0]
handstand_entries = [
    ex
    for slot in level1_advanced
    if slot["kind"] == "train"
    for ex in slot["exercises"]
    if "Handstand push up" in ex["name"]
]
assert len(handstand_entries) <= 1, f"Skills Practice non filtré : {handstand_entries}"

# Chaque niveau a au moins un slot d'entraînement.
for tier, levels in data.items():
    for i, level in enumerate(levels):
        train_slots = [s for s in level if s["kind"] == "train"]
        assert len(train_slots) > 0, f"{tier} niveau {i+1} n'a aucun jour d'entraînement"
        for slot in train_slots:
            assert len(slot["exercises"]) > 0, f"{tier} niveau {i+1} {slot['label']} sans exercice"

print("OK —", sum(len(lv) for lv in data.values()), "niveaux vérifiés,", ecartes, "pages écartées sans séance")
