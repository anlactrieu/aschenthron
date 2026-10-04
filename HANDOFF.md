# HANDOFF – Aschenthron

## Stand
Meilensteine 1–6 umgesetzt: Karte/Bewegung/Kampf, Drops/Inventar/Gewicht/Affixe, Attribute/Leveln/Lehrer/Skills, Todesstrafe (XP-Verlust + Item-Drop + Leichenlauf 5 Min.), Hub (Händler, Truhe, Safe-Zone), Dungeon + Boss (Aschenkönig, wütet <30 % LP, garantiert Seltenes). Speichern in localStorage.
Code: `src/sim/` (reine Logik: world, items, data, tiled, save, path, rng), `src/render/` (Phaser `GameScene`, DOM `ui.ts`). Karte: `src/data/aschenthron.json` (Tiled-Format, erzeugt von `scripts/gen_map.py`, in Tiled editierbar).
Befehle: `npm run dev | test | lint | build | pace` (pace = Bot-Messlauf Level-Tempo). Start-Reset: `?neu` an die URL oder Button im Panel. `Browserspiele/` und `Spiele/` sind per `.gitignore` bewusst nicht im Repo.

## Letzte 3 Entscheidungen
1. **Pivot auf T4C-Vorbild** (D4O = Die Vierte Offenbarung, nicht Diablo 4): feste offene Welt, klassenlos, Extraction gestrichen. Grund: das Spielgefühl, das der User will.
2. **Wenige zähe Gegner statt Horden, Karten als Tiled-Daten.** Grund: T4C-Grind-Gefühl; Tiled macht Karten später vom User editierbar.
3. **Haltbarkeit/Reparatur und Dunkle Künste nicht im Scope.** Grund: User hat sie bewusst nicht gewählt.

## Offene TODOs
- Offen aus Code-Review: UI-Panel serialisiert pro Frame JSON (Dirty-Flag wäre besser); A* in `chase` läuft fast jeden Tick pro Monster (Neuberechnung drosseln, Heap)
- Balancing per Spieltest (XP-Kurve, Monsterstärke, Drop-Raten)
- Echte Grafik statt Platzhalter, Sound
- Stufe 2 der Spec (Crafting, Sets, legendäre Effekte, mehr Skills), dann Server/PvP
- Asset-Pack wählen (oder Platzhalter-Diamant-Tiles) vor dem Kartenbau, Lizenzen in `ASSETS.md`
- Skill-Liste, Monster, Items, Lore eigenständig entwerfen (nichts aus T4C kopieren)
- Bibliotheksversionen prüfen, nicht aus dem Gedächtnis

## Dateien
- `SPEC.md`, `src/sim/world.ts` (Kern), `src/sim/data.ts` (Monster, Skills, XP), `src/render/ui.ts`

## Learnings
- "D4O" des Users = T4C, nie als Diablo 4 deuten.
- `AskUserQuestion`: max. 4 Fragen und max. 4 Optionen pro Frage.
- Bot-Test im Browser fand Verfolgungs-Bug bei Bruchteil-Positionen (chase blieb stehen); Sim-Tests mit ganzzahligen Positionen übersehen so etwas.
- macOS: `sed -i` braucht `''`, lieber python für Edits.
- Browser-Pane pausiert rAF im Hintergrund; Verhalten per `window.__game` (nur Dev) skripten.
