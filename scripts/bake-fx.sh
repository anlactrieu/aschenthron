#!/bin/sh
# Backt die pixelfx-Effekte (tools/pixelfx, MIT) in dunkler Palette zu Spritesheets unter public/assets/fx.
# Aufruf aus dem Projektordner: sh scripts/bake-fx.sh
set -e
cd "$(dirname "$0")/../tools/pixelfx"
OUT=../../public/assets/fx
bake() { # name effekt optionen
  node tools/render.mjs "$2" --sheet --no-actor --out "$OUT/_t" --opts "$3" >/dev/null
  cp "$OUT/_t/$2/$(basename "$2").png" "$OUT/$1.png"
  cp "$OUT/_t/$2/$(basename "$2").json" "$OUT/$1.json"
}
mkdir -p "$OUT"
# Treffer: gedämpftes Blutrot/Glut, ein Schuss Weiß
bake hit impacts/hit-spark '{"palette":["#14040a","#3a0a14","#701a14","#a8301a","#d86a28","#ffc46a","#ffffff"]}'
bake crit impacts/crit-hit '{"palette":["#1a0a0e","#5a1a10","#a8301a","#e0561e","#ffb84a","#fff0b0","#ffffff"]}'
# Loot-Strahl nach Seltenheit (gedeckte Farben, hellster Wert nur im Kern)
bake loot_magic pickups/loot-beam '{"palette":["#081830","#0e2e5a","#14508c","#2a74c0","#4a9ae0","#8cc4f4","#d0eaff","#ffffff"]}'
bake loot_rare pickups/loot-beam '{"palette":["#1e1206","#4a3208","#86620c","#c49a1a","#f0cc3a","#ffe680","#fff6c4","#ffffff"]}'
bake loot_set pickups/loot-beam '{"palette":["#0c1a0e","#163418","#225224","#357530","#4f9a3a","#7cc048","#b4e070","#ffffff"]}'
bake loot_legendary pickups/loot-beam '{"palette":["#1a0a0e","#3d1012","#701a14","#b8401a","#f0701e","#ffa84a","#ffd890","#ffffff"]}'
# Level-up: Gold, aber nicht grell
bake levelup ui/level-up '{"palette":["#1e1206","#4a2c08","#86520c","#b87a14","#e0a428","#f5cc5a","#fff0b0","#ffffff"],"text":"STUFE!"}'
rm -rf "$OUT/_t"
