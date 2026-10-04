# HANDOFF – Aschenthron

## Stand
Nachtarbeit läuft (Auftrag des Users: alles ausführen, morgen früh ein komplettes Gebiet in T4C-Insel-Größe spielbar). Reihenfolge laut Advisor: Pfadfindung → Save-Migration → Gebiet (A) → Balance (B) → Grafik/Sound (C) → Stufe-2-Loot (D) → Mehrspieler (E, nur auf eigenem Branch/Einstiegspunkt, Singleplayer bleibt Standard).
Fertig + committet: A (Insel „Aschental“ 160×120, 2 Städte, 4 Dungeons, 5 Bosse, 22 Monsterarten, 14 Quests, Level 1–30, ~290 Monster), B (Bot-Messung ~6 h bis Cap), C (prozedurale Pixel-Art, WebAudio-Sound, Minikarte N, Zonenbanner).
Befehle: `npm run dev | test | lint | build | pace`. Reset: `?neu`. Karte neu erzeugen: `python3 scripts/gen_map.py [--preview]` (schreibt `src/data/aschenthron.json`).
Annahmen für den User: siehe `SPEC.md` Abschnitt „Annahmen ohne Rückfrage“.
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
