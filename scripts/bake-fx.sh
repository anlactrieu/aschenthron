#!/bin/sh
# Backt die pixelfx-Effekte (tools/pixelfx, MIT) in dunkler Palette zu Spritesheets unter public/assets/fx.
# Aufruf aus dem Projektordner: sh scripts/bake-fx.sh
set -e
cd "$(dirname "$0")/../tools/pixelfx"
OUT=../../public/assets/fx
bake() { # name effekt optionen [fps]
  node tools/render.mjs "$2" --sheet --no-actor --out "$OUT/_t" --opts "$3" ${4:+--fps $4} >/dev/null
  cp "$OUT/_t/$2/$(basename "$2").png" "$OUT/$1.png"
  cp "$OUT/_t/$2/$(basename "$2").json" "$OUT/$1.json"
}
mkdir -p "$OUT"
# Treffer: gedämpftes Blutrot/Glut, ein Schuss Weiß
bake hit impacts/hit-spark '{"palette":["#14040a","#3a0a14","#701a14","#a8301a","#d86a28","#ffc46a","#ffffff"]}'
# Krit: kompakter Remix (impacts/crit-compact, Größenregler k), damit er neben 32-px-Figuren nicht das Bild füllt
bake crit impacts/crit-compact '{"palette":["#1a0a0e","#5a1a10","#a8301a","#e0561e","#ffb84a","#fff0b0","#ffffff"]}'
# Loot-Strahl nach Seltenheit: Remix pickups/loot-pillar (80 px hoch, schmal, ohne eigenes Schwert), 15 fps; gedeckte Farben, hellster Wert nur im Kern
bake loot_magic pickups/loot-pillar '{"palette":["#081830","#0e2e5a","#14508c","#2a74c0","#4a9ae0","#8cc4f4","#d0eaff","#ffffff"]}' 15
bake loot_rare pickups/loot-pillar '{"palette":["#1e1206","#4a3208","#86620c","#c49a1a","#f0cc3a","#ffe680","#fff6c4","#ffffff"]}' 15
bake loot_set pickups/loot-pillar '{"palette":["#0c1a0e","#163418","#225224","#357530","#4f9a3a","#7cc048","#b4e070","#ffffff"]}' 15
bake loot_legendary pickups/loot-pillar '{"palette":["#1a0a0e","#3d1012","#701a14","#b8401a","#f0701e","#ffa84a","#ffd890","#ffffff"]}' 15
# Level-up: Gold, aber nicht grell
bake levelup ui/level-up '{"palette":["#1e1206","#4a2c08","#86520c","#b87a14","#e0a428","#f5cc5a","#fff0b0","#ffffff"],"text":"STUFE!"}' 20
# Zauber (am Ziel bzw. am Wirker, nur radiale/senkrechte Effekte, die zur Draufsicht passen; Geschosse bleiben Code)
bake frost_nova ice/frost-nova '{"palette":["#06101e","#0e2440","#1a4470","#3274a8","#62a8d8","#a8d8f4","#e4f6ff","#ffffff"]}' 15
bake whirl melee/spin-slash '{"palette":["#0e1018","#262a38","#4a5068","#7a8098","#b0b6cc","#e0e4f0","#ffffff"]}'
bake slam impacts/ground-slam '{"palette":["#1a0a06","#3c1a0c","#6e3414","#a8561c","#e08a32","#ffc870","#fff0c8","#ffffff"]}' 15
bake lightning lightning/lightning-strike '{"palette":["#080c22","#141e48","#26387a","#4060b0","#6a90e0","#a8c4ff","#e0ecff","#ffffff"]}' 15
bake heal holy/heal '{"palette":["#06180c","#0e3418","#1c5a2a","#2e8a40","#52b860","#90e090","#d4ffd0","#ffffff"]}' 15
# Säule 3: neue Fertigkeit gelernt (Runenkreis mit Lichtsäule, gedämpftes Violett)
bake learn arcane/magic-circle-cast '{"palette":["#100818","#24103a","#3e1c62","#5e2e8e","#8448b8","#b07ade","#dcc0f6","#ffffff"]}' 15
# Säule 4: Boss-Aura hinter dem Boss (Schattenflammen, Asche-Violett), bei Wut Glutrot
bake boss_aura shadow/shadow-flames '{"palette":["#06040a","#140a1e","#2a1238","#4a1e5a","#743082","#a05aa8","#d0a0d0","#ffffff"]}' 15
bake boss_rage shadow/shadow-flames '{"palette":["#080204","#1e0606","#420c08","#74180c","#b02c10","#e06020","#ffb050","#fff0c0"]}' 15
rm -rf "$OUT/_t"
