#!/bin/sh
# Alle Pace-Seeds parallel messen: tools/pace-all.sh <Ausgabeordner> [Präfix] [Datei]. Umgebung: PACE_BOT=old|fa18|new|vess|neu (Standard neu), PACE_NIGHT=0 (immer Mittag), PACE_SEEDS="2024 7", PACE_HOURS (Spielstunden, Standard 40)
OUT="$1"; PRE="${2:-run}"; FILE="${3:-src/sim/pace.sim.ts}"
mkdir -p "$OUT"
for s in ${PACE_SEEDS:-2024 7 99 11 12 13 21 42}; do
  PACE_SEED=$s PACE_SPOTS=1 npx vitest run -c vitest.pace.config.ts --reporter=verbose "$FILE" > "$OUT/$PRE-$s.log" 2>&1 &
done
wait
for s in ${PACE_SEEDS:-2024 7 99 11 12 13 21 42}; do
  echo "$s weiter=$(grep -c WEITER "$OUT/$PRE-$s.log")"
  grep -o 'PACE.*' "$OUT/$PRE-$s.log" | cut -c1-175
done
