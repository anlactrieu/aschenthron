# HANDOFF – Aschenthron

## Stand
Meilensteine 1–6 der `SPEC.md` umgesetzt und committet (Code-Stand `e4a6e2f`): Karte/Bewegung/Kampf, Drops/Inventar/Gewicht/Affixe, Attribute/Leveln/Lehrer/Skills, Todesstrafe (XP-Verlust + Item-Drop + Leichenlauf 5 Min.), Hub (Händler, Truhe, Safe-Zone ohne Kampf), Dungeon + Boss (Aschenkönig). Speichern in localStorage. 33 Tests, Lint und Build grün.
Befehle: `npm run dev | test | lint | build | pace` (pace = Bot-Messlauf Level-Tempo). Reset: `?neu` an die URL oder Button im Panel.
`Browserspiele/` und `Spiele/` sind per `.gitignore` bewusst nicht im Repo.

## Letzte 3 Entscheidungen
1. **Code-Review-Fixes:** Kämpfen in der Safe-Zone verboten, Händlersortiment in der Sim (`SHOP_ITEMS`), Drop-Pool deckt alle Slots ab. Grund: Safe-Zone ermöglichte risikoloses Farmen; Sim soll Autorität sein (online-fähig).
2. **XP-Kurve `150*(l-1)*l`:** Bot erreicht Level 20 in ~56 Min. Grund: Spec verlangt lange Kurve; Bot ist idealisiert, Wert noch nicht durch echtes Spielen geprüft.
3. **Pace-Messung als `npm run pace`** statt im Standard-Test. Grund: lange Laufzeit, keine Assertions.

## Offene TODOs
- User fragen: Level-Tempo auf ~3 h strecken und Monster härter machen? (Bot starb 0-mal)
- Framerate auf dem Mac prüfen lassen (im Browser-Pane nicht belastbar messbar)
- Aus Review offen: UI-Panel serialisiert pro Frame JSON (Dirty-Flag), A* in `chase` fast jeden Tick pro Monster (drosseln, Heap)
- Echte Grafik statt Platzhalter (Lizenzen in `ASSETS.md` tracken), Sound
- Stufe 2 der Spec (Crafting, Sets, legendäre Effekte, mehr Skills), dann Mini-Server/PvP

## Dateien
`src/sim/world.ts` (Kern: Tick, Befehle, Kampf, Tod), `data.ts` (Monster, Skills, XP, Shop), `items.ts`, `tiled.ts` (Kartenlader), `save.ts`; `src/render/GameScene.ts` (Phaser), `ui.ts` (DOM-HUD/Panel); Karte `src/data/aschenthron.json` (aus `scripts/gen_map.py`).

## Learnings
- "D4O" des Users = T4C (Die Vierte Offenbarung), nie als Diablo 4 deuten. Nichts aus T4C kopieren, nur Prinzipien.
- Bot-Läufe im echten Spiel fanden einen Verfolgungs-Bug bei Bruchteil-Positionen, den Tests mit ganzzahligen Positionen übersahen.
- Browser-Pane: Klick-Koordinaten der `computer`-Tools sind skaliert (Viewport 768 vs. Raster 800); vorher `innerWidth` prüfen. rAF pausiert im Hintergrund; Verhalten per `window.__game` (nur Dev) skripten.
- DOM-UI nie pro Frame neu aufbauen (`replaceChildren`), sonst gehen Mausklicks verloren.
- macOS: `sed -i` braucht `''`, für Edits lieber python.
- `AskUserQuestion`: max. 4 Fragen und max. 4 Optionen pro Frage.
