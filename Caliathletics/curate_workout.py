#!/usr/bin/env python3
"""
Normalise les noms d'exercices, classe chaque exercice (famille de
mouvement + "compte dans les stats"), et parse la chaîne "details" en
cible structurée (reps/secondes/minutes, valeur ou plage, effort max,
chaque côté).

Deux étapes automatiques (heuristiques par mots-clés) + un dict
d'overrides pour les cas mal classés — à corriger ici si la relecture de
workout_curation_review.csv révèle une erreur, plutôt que de complexifier
les heuristiques.
"""

import csv
import json
import re
from pathlib import Path

RAW_JSON = Path("workout_raw.json")
CURATED_JSON = Path("workout_curated.json")
REVIEW_CSV = Path("workout_curation_review.csv")

# --- Normalisation des noms (casse/coquilles repérées manuellement) ---
NAME_FIXES = {
    "beginner hindu push ups": "Beginner Hindu push ups",
    "dragon flag": "Dragon Flag",
    "muscle up": "Muscle Up",
    "elevated australian pull ups": "Elevated Australian pull ups",
    "paused dragon flaga": "Paused Dragon Flags",
    "one leg lip lifts": "One leg hip lifts",
    "side pull ups": "Side Pull ups",
    "high pull ups": "High Pull ups",
    "handstand push up": "Handstand push ups",
    "superman raises + hold": "Superman raises + isometric hold",
    "superman raises + iseometric hold": "Superman raises + isometric hold",
    "l-sit switches to straddle planche": "L-sit to straddle planche switches",
    "tuck planche push ups": "Tuck Planche push ups",
}

# --- Corrections de chaînes "details" du site source (fautes de frappe) ---
# Même principe que NAME_FIXES : une chaîne source exacte -> sa version
# corrigée. Ne pas complexifier SETS_RE pour ces cas isolés.
DETAILS_FIXES = {
    # Calf raises, beginner niveau 2 : le site a écrit "each leg" à la place
    # de "Sets", ce qui faisait lire 3 séries comme une plage de répétitions.
    "12 each leg, 3 each leg": "12 each leg, 3 Sets",
    # One leg l-hang switches, niveau avancé : "Max s." (abrégé) n'est pas
    # reconnu par le regex secondes, qui exige un chiffre avant le "s" —
    # faisait tomber l'unité en "reps" et comptait à tort dans les stats.
    "Max s., 3 Sets": "Max seconds, 3 Sets",
}


def normalize_name(name: str) -> str:
    fixed = NAME_FIXES.get(name.strip().lower())
    return fixed if fixed else name.strip()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug


# --- Famille de mouvement (mots-clés, premier match gagne) ---
FAMILY_RULES: list[tuple[str, list[str]]] = [
    ("dip", ["dip"]),
    ("push", ["push", "planche", "hspu", "hindu"]),
    ("pull", ["pull", "chin", "archery", "lever pull", "muscle up"]),
    ("lever", ["front lever", "back lever", "lever raise", "lever practice", "lever transition"]),
    ("handstand", ["handstand", "frogstand", "wall walk", "kickout", "elbow lever"]),
    ("squat", ["squat", "lunge"]),
    ("core", [
        "leg raise", "windshield", "l-sit", "l-hang", "hollow", "plank",
        "dragon flag", "core rollout", "superman", "side switches",
        "toe touches", "mountain climbers", "hip lifts",
    ]),
    ("other", []),  # fallback
]


def classify_family(name: str) -> str:
    lname = name.lower()
    for family, keywords in FAMILY_RULES:
        if not keywords:
            return family
        if any(kw in lname for kw in keywords):
            return family
    return "other"


# --- "Compte dans les stats" : strict ou plus dur seulement ---
EASY_KEYWORDS = [
    "assist", "negativ", "on knees", "australian", "incline", "elevated",
    "band assisted", "partner", "leg assisted", "wall assisted",
]


def classify_counts(name: str, family: str, target: dict | None) -> bool:
    lname = name.lower()
    if any(kw in lname for kw in EASY_KEYWORDS):
        return False
    if family in ("handstand", "lever", "other"):
        return False  # travail de compétence/isolation, pas un total de reps qui a du sens
    if target is None or target.get("unit") != "reps":
        return False  # secondes/minutes/pas de cible numérique : hors total de reps
    return True


# --- Overrides manuels (à compléter après relecture de la review CSV) ---
OVERRIDES: dict[str, dict] = {
    # "nom normalisé exact": {"movementFamily": "...", "countsInStats": True/False},
}


# --- Parsing de la chaîne "details" en cible structurée ---
EACH_RE = re.compile(r"each\s+(leg|side|arm|position)", re.I)
SETS_RE = re.compile(r"(\d+)\s*sets?", re.I)
NUM_RE = re.compile(r"\d+")


def parse_target(raw: str) -> tuple[dict | None, int | None]:
    raw = raw.strip()
    if raw in ("", "-", "Full body warm up"):
        return None, None

    text = raw
    if "|" in text:
        _, text = text.split("|", 1)
        text = text.strip()

    sets_match = SETS_RE.search(text)
    sets = int(sets_match.group(1)) if sets_match else None
    reps_part = SETS_RE.sub("", text).strip(" ,")

    each_side = bool(EACH_RE.search(reps_part))
    reps_part_clean = EACH_RE.sub("", reps_part).strip(" ,")

    max_effort = bool(re.search(r"\bmax\b", reps_part_clean, re.I))

    if re.search(r"minute", reps_part_clean, re.I):
        unit = "minutes"
    elif re.search(r"second|(?<=\d)s\b", reps_part_clean, re.I):
        unit = "seconds"
    else:
        unit = "reps"

    nums = [int(n) for n in NUM_RE.findall(reps_part_clean)]
    if not nums:
        value = None
    elif len(nums) == 1:
        value = nums[0]
    elif len(nums) == 2:
        value = [nums[0], nums[1]]
    else:
        value = nums

    return {"unit": unit, "value": value, "maxEffort": max_effort, "eachSide": each_side}, sets


def curate_exercise(raw_ex: dict) -> dict:
    name = normalize_name(raw_ex["name"])
    details = raw_ex["details"].strip()
    target, sets = parse_target(DETAILS_FIXES.get(details, details))
    family = classify_family(name)
    counts = classify_counts(name, family, target)

    if name in OVERRIDES:
        family = OVERRIDES[name].get("movementFamily", family)
        counts = OVERRIDES[name].get("countsInStats", counts)

    return {
        "id": slugify(name),
        "name": name,
        "movementFamily": family,
        "countsInStats": counts,
        "videoId": raw_ex["video_id"] or None,
        "sets": sets if sets is not None else 1,
        "target": target if target is not None else {"unit": "reps", "value": None, "maxEffort": True, "eachSide": False},
    }


def main():
    raw = json.loads(RAW_JSON.read_text(encoding="utf-8"))
    curated = {}
    review_rows = []
    seen_names = set()
    # Clé de dédup du CSV : (nom, details brut). Dédupliquer sur le seul nom
    # masquait les prescriptions divergentes d'un même exercice d'un niveau à
    # l'autre — exactement ce qui a rendu invisible le "3 each leg" de Calf raises.
    seen_prescriptions = set()

    for tier, levels in raw.items():
        curated[tier] = []
        for level in levels:
            curated_level = []
            for slot in level:
                if slot["kind"] == "rest":
                    curated_level.append({"kind": "rest"})
                    continue
                curated_exercises = [curate_exercise(ex) for ex in slot["exercises"]]
                curated_level.append({"kind": "train", "label": slot["label"], "exercises": curated_exercises})
                for raw_ex, ex in zip(slot["exercises"], curated_exercises):
                    seen_names.add(ex["name"])
                    key = (ex["name"], raw_ex["details"].strip())
                    if key not in seen_prescriptions:
                        seen_prescriptions.add(key)
                        review_rows.append((ex, key[1]))
            curated[tier].append(curated_level)

    CURATED_JSON.write_text(json.dumps(curated, indent=2, ensure_ascii=False), encoding="utf-8")

    with open(REVIEW_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "name", "movementFamily", "countsInStats", "sets",
            "unit", "value", "maxEffort", "eachSide", "rawDetails",
        ])
        for ex, raw_details in sorted(review_rows, key=lambda r: (r[0]["movementFamily"], r[0]["name"], r[1])):
            writer.writerow([
                ex["name"], ex["movementFamily"], ex["countsInStats"], ex["sets"],
                ex["target"]["unit"], ex["target"]["value"], ex["target"]["maxEffort"],
                ex["target"]["eachSide"], raw_details,
            ])

    print(
        f"{len(seen_names)} exercices uniques, {len(seen_prescriptions)} prescriptions distinctes"
        f" -> {CURATED_JSON} et {REVIEW_CSV}"
    )


if __name__ == "__main__":
    main()
