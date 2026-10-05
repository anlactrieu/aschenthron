#!/usr/bin/env python3
"""Kopiert die in src/render/spriteMap.ts verwendeten Sprites aus dem entpackten Paket
"Dungeon Crawl Stone Soup Full" (CC0, opengameart.org/content/dungeon-crawl-32x32-tiles)
nach public/assets/dcss/ (Ordnerstruktur bleibt erhalten).

Aufruf: python3 scripts/import_dcss.py "<Pfad zu 'Dungeon Crawl Stone Soup Full'>"
Liest nur Bilddateien, führt nichts aus dem Paket aus.
"""
import re
import shutil
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not src or not src.is_dir():
    sys.exit(__doc__)

text = (root / "src/render/spriteMap.ts").read_text(encoding="utf-8")
paths = set(re.findall(r"'([A-Za-z0-9_\-/]+\.png)'", text))
# Pfade, die über die Hilfsfunktionen m(...)/IT(...)/P(...) gebaut werden
paths |= {f"monster/{p}.png" for p in re.findall(r"\bm\('([A-Za-z0-9_\-/]+)'", text)}
paths |= {f"item/{p}.png" for p in re.findall(r"\bIT\('([A-Za-z0-9_\-/]+)'\)", text)}
paths |= {f"player/{p}.png" for p in re.findall(r"\bP\('([A-Za-z0-9_\-/]+)'\)", text)}

dst = root / "public/assets/dcss"
missing = []
for p in sorted(paths):
    s = src / p
    if not s.is_file():
        missing.append(p)
        continue
    (dst / p).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(s, dst / p)
for lic in ("LICENSE.txt", "README.txt"):
    if (src / lic).is_file():
        shutil.copyfile(src / lic, dst / lic)
print(f"{len(paths) - len(missing)} Dateien kopiert, {len(missing)} fehlen")
for p in missing:
    print("FEHLT:", p)
