#!/usr/bin/env python3
"""
Extraction du programme Caliathletics depuis les HTML sauvegardés.

Une page a jusqu'à 3 sections <div class="row program-part[...]"> :
  - "" (pas de classe suppl.)          -> Warm up (1ère section) ou Training (2ème)
  - " skills"                           -> Skills Practice (variantes optionnelles, exclues)

On ne garde que les cartes de la section Training (celle dont le <h2>
précédent dans le HTML dit "Training", ou par défaut la 2ème section
program-part sans classe "skills" si l'intro "Training" n'est pas trouvée).

Les jours de repos n'ont pas de <h1>Level N</h1> fiable : on reconstruit
l'ordre des niveaux et des jours depuis le NOM DE FICHIER, pas depuis le
texte de la page :
  - module-{N}__day-{D}[-suffixe].html  -> jour D du niveau correspondant
    au rang de N parmi les modules du palier (module le plus petit = niveau 1)
  - module-{N}__day-{D}-rest-day.html   -> même règle, jour de repos
  - si le slug ne matche pas "day-\\d+", on retombe sur le <title> de la
    page ("Day N - Calisthenics workout - ...") : certains slugs mentent
    (beginner/module-4__level-1.html EST le Day 1 du niveau 3, avec ses 8
    exercices Training). Les vraies pages d'intro/récap (how-to-use,
    introduction, skills-training, modifying-program...) n'ont jamais
    "Day N" en titre et restent ignorées.
  - une page "day" est un jour de repos si, une fois les cartes Training
    extraites, la liste est vide (le nom de fichier n'est pas fiable à lui
    seul : plusieurs jours de repos beginner n'ont pas "-rest-day" dans
    leur slug, ex. module-2__day-4.html)
"""

import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

INPUT_DIR = Path("caliathletics_backup")
OUTPUT_JSON = Path("workout_raw.json")

DAY_SLUG_RE = re.compile(r"^day-(\d+)")
FILE_RE = re.compile(r"^module-(\d+)__(.+)\.html$")
TITLE_DAY_RE = re.compile(r"<title>\s*Day\s+(\d+)\b", re.I)


def day_number(slug: str, html: str) -> int | None:
    """Numéro de jour d'une page, depuis le slug du fichier ou, à défaut, son <title>.

    Renvoie None pour une vraie page d'intro/récap (aucune des deux sources
    ne donne de numéro de jour)."""
    m = DAY_SLUG_RE.match(slug)
    if m:
        return int(m.group(1))
    m = TITLE_DAY_RE.search(html)
    return int(m.group(1)) if m else None


def extract_training_exercises(soup: BeautifulSoup) -> list[dict]:
    """Ne retourne que les cartes de la section Training (jamais Warm up ni Skills Practice)."""
    sections = soup.select("div.row.program-part")
    training_cards = []
    for section in sections:
        if "skills" in (section.get("class") or []):
            continue
        h2 = section.find("h2")
        title = h2.get_text(strip=True).lower() if h2 else ""
        if title == "warm up":
            continue
        # Warm up sans h2 identifiable et Training se distinguent : Training
        # est toujours la section program-part (sans "skills") qui n'est pas
        # la toute première du document.
        if title != "training" and section is sections[0]:
            continue
        training_cards.extend(section.select("div.card.card-decoration"))

    results = []
    for card in training_cards:
        title_el = card.select_one("h3.exercise-title")
        reps_el = card.select_one("p.repeat-time")
        video_el = card.select_one("[data-video-id]")
        name = title_el.get_text(strip=True) if title_el else ""
        if not name:
            continue
        results.append(
            {
                "name": name,
                "details": reps_el.get_text(strip=True) if reps_el else "",
                "video_id": video_el.get("data-video-id") if video_el else "",
            }
        )
    return results


def build_tier_levels(tier_dir: Path) -> list[list[dict]]:
    """Regroupe les fichiers d'un palier en niveaux ordonnés (par n° de module),
    chaque niveau étant une liste ordonnée de slots (par n° de jour)."""
    by_module: dict[int, list[tuple[int, Path, str]]] = {}
    for html_file in sorted(tier_dir.glob("*.html")):
        m = FILE_RE.match(html_file.name)
        if not m:
            continue
        module_num = int(m.group(1))
        html = html_file.read_text(encoding="utf-8", errors="ignore")
        day_num = day_number(m.group(2), html)
        if day_num is None:
            continue  # page d'intro/récap, pas un jour de séance
        by_module.setdefault(module_num, []).append((day_num, html_file, html))

    levels: list[list[dict]] = []
    for module_num in sorted(by_module):
        days = sorted(by_module[module_num], key=lambda t: t[0])
        slots = []
        for day_num, html_file, html in days:
            soup = BeautifulSoup(html, "html.parser")
            exercises = extract_training_exercises(soup)
            if exercises:
                slots.append({"kind": "train", "label": f"Day {day_num}", "exercises": exercises})
            else:
                slots.append({"kind": "rest"})
        levels.append(slots)
    return levels


def main():
    result = {}
    for tier in ["beginner", "intermediate", "advanced"]:
        tier_dir = INPUT_DIR / tier
        if not tier_dir.exists():
            print(f"Dossier manquant : {tier_dir}")
            continue
        levels = build_tier_levels(tier_dir)
        result[tier] = levels
        total_exercises = sum(len(s["exercises"]) for lvl in levels for s in lvl if s["kind"] == "train")
        print(f"{tier}: {len(levels)} niveaux, {total_exercises} exercices Training extraits")

    OUTPUT_JSON.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"-> {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
