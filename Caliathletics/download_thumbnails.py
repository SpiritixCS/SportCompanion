#!/usr/bin/env python3
"""Télécharge une vignette par exercice depuis les pages scrapées (caliathletics_backup/)
vers public/exercises/{id}.jpg. Source: video-thumb i.vimeocdn.com déjà référencée dans
le HTML scrapé, pas de nouveau scraping du site.
"""
import glob
import json
import re
import urllib.request
from pathlib import Path

CURATED_JSON = Path(__file__).parent / "workout_curated.json"
BACKUP_DIR = Path(__file__).parent / "caliathletics_backup"
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "exercises"


def build_id_to_video_id() -> dict[str, str]:
    curated = json.loads(CURATED_JSON.read_text(encoding="utf-8"))
    mapping: dict[str, str] = {}
    for modules in curated.values():
        for module in modules:
            for day in module:
                for ex in day.get("exercises", []):
                    if ex["id"] not in mapping and ex.get("videoId"):
                        mapping[ex["id"]] = ex["videoId"]
    return mapping


def build_video_id_to_thumb_url() -> dict[str, str]:
    thumb_map: dict[str, str] = {}
    pattern = re.compile(r"data-video-id='(\d+)'>\s*<img src=\"([^\"]+)\"")
    for path in glob.glob(str(BACKUP_DIR / "**" / "*.html"), recursive=True):
        html = Path(path).read_text(encoding="utf-8", errors="ignore")
        for video_id, src in pattern.findall(html):
            thumb_map.setdefault(video_id, src)
    return thumb_map


def main() -> None:
    id_to_video = build_id_to_video_id()
    video_to_url = build_video_id_to_thumb_url()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    missing = []
    for exercise_id, video_id in sorted(id_to_video.items()):
        url = video_to_url.get(video_id)
        if not url:
            missing.append(exercise_id)
            continue
        dest = OUTPUT_DIR / f"{exercise_id}.jpg"
        urllib.request.urlretrieve(url, dest)
        print(f"{exercise_id} <- {url}")

    if missing:
        print(f"\nManquants ({len(missing)}): {missing}")
    print(f"\n{len(id_to_video) - len(missing)}/{len(id_to_video)} vignettes téléchargées.")


if __name__ == "__main__":
    main()
