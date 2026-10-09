#!/usr/bin/env python3
"""Kopiert die genutzten Teile des Pakets "Ninja Adventure - Asset Pack" (CC0, pixel-boy.itch.io/ninja-adventure-asset-pack)
nach public/assets/ninja/ (Ordnerstruktur bleibt erhalten): Gelände-Tilesets, Figuren, Monster, Bosse, Tiere,
Waffen, UI-Theme "Theme Wood", Schrift, Lizenz. Keine Audio-Dateien, keine GIFs, keine Godot-Projekte.

Aufruf: python3 scripts/import_ninja.py "<Pfad zu 'Ninja Adventure - Asset Pack'>"
Liest nur Bilddateien und die Schrift, führt nichts aus dem Paket aus.
"""
import shutil
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not src or not src.is_dir():
    sys.exit(__doc__)
dst = root / "public/assets/ninja"

patterns = [
    "Backgrounds/Tilesets/*.png",
    "Backgrounds/Animated/*/*.png",
    "Actor/Character/*/SpriteSheet.png",
    "Actor/Character/*/Faceset.png",
    "Actor/Monster/*/SpriteSheet.png",
    "Actor/Monster/*/Faceset.png",
    "Actor/Boss/*/Idle.png",
    "Actor/Boss/*/Sprite.png",
    "Actor/Boss/*/Faceset.png",
    "Actor/Animal/*/SpriteSheet.png",
    "Items/Weapons/*/Sprite.png",
    "Items/Weapons/*/SpriteInHand.png",
    "Ui/Theme/Theme Wood/*.png",
    "Ui/Font/NormalFont.ttf",
    "FX/Elemental/*/SpriteSheet.png",
    "LICENSE.txt",
    "README.md",
    "Palette.png",
]
n = 0
# Monster ohne SpriteSheet.png heißen im Paket <Name>/<Name>.png (64x64, 4 Zeilen): als SpriteSheet.png ablegen
for d in sorted((src / "Actor/Monster").iterdir()):
    if d.is_dir() and not (d / "SpriteSheet.png").exists():
        cand = [f for f in d.glob("*.png") if f.name.lower() != "faceset.png"]
        if cand:
            out = dst / "Actor/Monster" / d.name / "SpriteSheet.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(cand[0], out)
            n += 1
for pat in patterns:
    for f in sorted(src.glob(pat)):
        if not f.is_file():
            continue
        out = dst / f.relative_to(src)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(f, out)
        n += 1
print(f"{n} Dateien kopiert nach {dst}")
