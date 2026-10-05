# HANDOFF – Aschenthron

## Stand
Seit der ersten Nachtarbeit dazugekommen: Insel „Aschental“ v3 (240×180, MAP_VERSION 3, ~650 Monster in Rudeln, 76 Truhen, Monsterfamilien in Stufen: Ratten, Hunde/Wölfe, Goblins, Banditen, Spinnen, Sumpf, Untote, Trolle/Golems, Würmer, Asche), Item-Anforderungen (Stufe + Attribute), Bögen/Stäbe/Roben/Lederwämser, Köcher + Pfeilbündel (Fernkampf-Skills brauchen Bogen + Pfeile), Schatztruhen (anklicken), neues Inventar (Figur mit Slots, Icon-Raster, Drag-and-drop, Tooltip-Vergleich, Anforderungen rot), HP/MP-Orbs + Schnellleiste, Juice (Kampfzahlen, Hiebe mit Ausholen/Schlag, Pfeile/Zauber mit Einschlag, Bodenschatten, Schritt-Wippen), Avatar zeigt Waffe/Köcher/Robe. Mehrspieler-Server (Branch gemergt) unverändert.
Befehle: `npm run dev | server | test | lint | build | pace`; Karte neu: `python3 scripts/gen_map.py`; URL-Parameter: `?neu` (Neustart), `?fps`, `?slowfx`, `?server=…&name=…`.
Recherche-Ergebnisse (T4C-Prinzipien, Sprite-Pakete): siehe SPEC.md. Nichts wurde heruntergeladen.
Danach dazugekommen: Skillpunkte + Ränge + Neuverteilen, Treffer/Ausweichen, Champions + 13 Mini-Bosse + Boss-Mechaniken (Warnring-Bodenschlag, Beschwörung, Ansturm), neue Affixe (Tempo/Kritisch/Regeneration/Treffsicherheit/Ausweichen), Aufgabenarten (Truhen/Champions/Mini-Bosse), Rasten (R), ▲-Upgrade-Hinweis und Wurfqualität im Tooltip, Rückansicht-Sprites, Kartenversion im Spielstand. Code-Review über alles seit dem Mehrspieler-Review erledigt und gefixt. Echter Drag-Test (Mausziehen im Browser) bestanden: Rucksack→Slot, Slot→Rucksack, Pfeile→Köcher, Rucksack→Welt.
Offene Ideen (nach Wert): Fremd-Sprites einbauen (nur mit Freigabe des Users, siehe SPEC), Goblin-/Spinnen-Dungeon, Gruppen-/Begleiter-System, Handel/Bank, Wetter/Tag-Nacht, mehr Boss-Phasen, Gildenfunktionen online, Delta-Schnappschüsse im Mehrspieler.

## Verifikation (Stand Nachtarbeit)
- 69 Unit- und Server-Tests (echte WebSocket-Verbindungen, 2 lokale Clients), Lint, Build grün.
- Bot-Messlauf (`npm run pace`): Level 30 nach ~5,8 h Spielzeit, 3 Tode.
- Headless-Skripte gegen die laufende Szene: Klick-Matrix auf Boss, Normalmonster, NPCs (inkl. Namensschild/Marker) – alle Treffer; Bodenklick läuft.
- Echte Mausklicks nur auf das DOM-UI (Panel, Hotbar); auf dem Canvas keine, weil das Browser-Pane nicht sichtbar war.
- Framerate: im Browser-Pane der App (auf dem Mac, Pane sichtbar) 59–61 FPS gemessen mit `?fps`; im Pane unsichtbar sind Werte nicht aussagekräftig. In einem normalen Browser-Tab nicht gemessen. Mehrspieler nur lokal geprüft.

## Stand T4C-Quick-Wins (ungecommittet, 107 Tests grün, Lint/Build ok)
- Amulett + 2. Ring: `EquipSlot` (`items.ts`), `equipSlotFor` (`world.ts`), Befehl `equip` mit optionalem `to`, 9 Amulett-Vorlagen, Icon in `icons.ts`, Doll-Positionen in `ui.ts`. Nicht im Händlersortiment (Pace-Balance).
- Zaubernde Monster: Ability `cast` (Goblinschamane, Sumpfhexe, Imp, Brakk, Irva), `castAi`/`clearLine` in `world.ts` (Reichweite 6, Abstand 2,5, Skill `ember_bolt` für VFX).
- Zonenton: `Sfx.ambient()` in `audio.ts`, aufgerufen aus `updateRegion` (GameScene). Zonen-Titel existierte schon.
- Offen: `npm run pace` nach Zauberer-Änderung neu messen; Commit.

## Letzte 3 Entscheidungen (aktuell)
1. **Ringe: Gegenstand bleibt `slot:'ring'`, zweites Feld nur als `ring2` im Equipment.** Grund: keine Item-/Save-Migration, alte Spielstände gültig.
2. **Zauberer nutzen vorhandenen Skill-Namen `ember_bolt` als Hit-Skill.** Grund: Projektil-VFX/Ton ohne Render-Änderung.
3. **Amulette nicht im Shop.** Grund: Pace-Bot kauft Shop-Ausrüstung, Balance sollte unverändert bleiben.

## Frühere Entscheidungen
1. **Code-Review-Fixes:** Kämpfen in der Safe-Zone verboten, Händlersortiment in der Sim (`SHOP_ITEMS`), Drop-Pool deckt alle Slots ab. Grund: Safe-Zone ermöglichte risikoloses Farmen; Sim soll Autorität sein (online-fähig).
2. **XP-Kurve `150*(l-1)*l`:** Bot erreicht Level 20 in ~56 Min. Grund: Spec verlangt lange Kurve; Bot ist idealisiert, Wert noch nicht durch echtes Spielen geprüft.
3. **Pace-Messung als `npm run pace`** statt im Standard-Test. Grund: lange Laufzeit, keine Assertions.

## Advisor-Bewertung (Qualität, Tiefe, Optik, Juice)
Fazit: starkes technisches Fundament und Breite, aber als Spiel noch Prototyp: wenig Tiefe (alle Monster Nahkämpfer, Bosse nur HP-Sack mit Wut, 5 Affixarten, alle Skills erlernbar, Fernkampf mit Schwert), Optik kohärent aber brettartig (Raster-Kante, harte Terraingrenzen, Wände verdecken Monster), Juice fast nicht vorhanden (keine Zahlenpopups, 9 von 12 Skills ohne Effekt, kein Angriffsimpuls, Legendär-Drop wie jeder Pickup).
Plan Juice (nur Render, Events existieren): schwebende Kampfzahlen, Skill-VFX (Projektile/Ringe/Blitz), Treffergefühl (Lunge, Flash, Hit-Stop, Shake), Loot-Momente (Namen am Boden in Seltenheitsfarbe, Bogenflug, Legendär-Sound/Banner, Item-Vergleich-Tooltip), Lesbarkeit (HP-Balken nur bei Schaden/Ziel, Cursor-Highlight, Level-Up-Effekt), Atmosphäre (Kachelkante weg, Dithering, Wasser/Lava-Animation, Partikel, Vignette).
Plan Tiefe: Fernkampf-/Zaubermonster, Boss-Mechaniken (Bodenmarker, Adds, Ansturm), Champion-Packs, mehr Affixe, Bögen/Stäbe. Entscheidungen des Users nötig: Skill-Ränge/Punkte ja/nein; Monsterdichte (Gruppen 1–5 mit weniger Spawnpunkten vs. jetzt).

## Offene TODOs
- Mehrspieler im echten Netz/mit 3+ Spielern nur per Test und kurzem Live-Check geprüft; Chat, Gruppen, Gilden, Handel fehlen
- Framerate im Browser-Pane nicht belastbar messbar (unsichtbar); auf dem Mac prüfen, ggf. `?fps`-Anzeige ergänzen
- UI-Panel serialisiert pro Frame JSON (Dirty-Flag), `you` wird online mit jedem Schnappschuss komplett gesendet (Delta wäre besser)
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
- Neue Slots: `Object.keys(equipment)`-Schleifen müssen `EquipSlot` nutzen; `net.ts`-Validierung und `save.ts` `EQUIP_SLOTS` führen die Slotliste separat (beim Erweitern alle drei anpassen).
- Drop-Pool-Test verlangt pro Slot für Stufe 2–16 eine Vorlage mit minLevel ≤ Stufe (neue Slots brauchen eine Stufe-1-Vorlage).
