# PLAN – T4C-Stufe 2 (Stand 2026-11-11)

Dieser Plan ist die Arbeitsgrundlage für die nächsten Sessions. Er ersetzt nichts in `SPEC.md`, er baut auf „Plan: T4C-Charme" (P1–P9, umgesetzt) auf. Jede Session liest **nur diese Datei** und die Dateien ihres Pakets, nicht die ganze `SPEC.md`.

## Zielbild (eine Seite statt PRD)
Aschenthron soll sich anfühlen wie T4C / D4O, ohne etwas daraus zu kopieren (Regel „Rechtliches" in `SPEC.md` gilt weiter: eigene Namen, Texte, Bilder, Klänge).

**Fünf Säulen, an denen jede Änderung gemessen wird:**
1. **Entdecken statt geführt werden.** Wissen kommt aus Gesprächen und vom Herumlaufen, nicht aus Pfeilen.
2. **Feste, bekannte Welt.** Orte, Gegner und Funde haben Namen und einen festen Platz. Man sagt „das Goblinlager", nicht „ein Dungeon".
3. **Langsamer Aufstieg mit Gewicht.** Jede Stufe, jeder benannte Fund und jeder Tod bedeuten etwas.
4. **Text trägt die Welt.** Gespräche, Kampfmeldungen und Gerüchte laufen als lesbarer Text mit.
5. **Düstere, ruhige Stimmung.** Dunkle Nächte, Licht als Schutz, wenig Blinken.

**Gegen-Säulen (was nicht hineingehört):** Wegweiser und Autopilot, Beute-Feuerwerk, Zufallsaffixe, Truhen an jeder Ecke, Tagesaufgaben-Druck, verspielte bunte Oberfläche.

## Befund 2026-11-11 (im Spiel gesehen und im Code gezählt)
**Trägt schon:** Iso-Ansicht, Fachwerkstadt mit Bewohnern und Tieren, Stichwort-Gespräche mit Notizbuch, benannte Funde, Tag/Nacht mit Folgen, Straßenwache, Todesstrafe, gestreckte Stufenkurve (L30 nach rund 21 bis 26 h).

**Widerspricht dem Zielbild:**
| # | Befund | Beleg | Säule |
|---|---|---|---|
| 1 | Dauer-Wegweiser „Nächster Schritt" mit Hinlaufen, Richtungspfeil, Zielrauten | `nextStep`/`questMarks` in `src/sim/quests.ts`, `idleHint` in `GameScene.ts`, `minimap.ts` | 1 |
| 2 | 98 offene Truhen in der Welt, im Wald alle paar Schritte eine | `src/data/aschenthron.json` (98 `chest`) | 2, 3 |
| 3 | Beute nach Looter-Art: Lichtstrahl je Seltenheit, Zufallsaffixe; nur 30 % der Ausrüstungsbeute sind benannte Funde | `lootBeams` in `GameScene.ts`, `RARITY_AFFIXES` in `items.ts`, `NAMED_SHARE = 0.3` in `data.ts` | 3 |
| 4 | Oberfläche in orangem Holz mit Pixelschrift, die in Fließtext schwer lesbar ist; kein mitlaufender Textlog | `src/render/theme.ts`, Gesprächsfenster | 4, 5 |
| 5 | Nacht ist nur abgedunkelt, kein Lichtkreis um die Figur, Fackeln ohne Nutzen | `src/render/atmosphere.ts` | 5 |
| 6 | Dungeonwände sind niedrige Blöcke (`WALL_H = 24`), Gänge wirken wie Hecken; Gelände ohne Höhen | `src/render/world/isoWalls.ts` | 2, 5 |
| 7 | Gegner erscheinen als Schattenriss und ploppen auf; Sheet-Cache verwirft genutzte Texturen | Katakomben-Bild, `docs/archiv/HANDOFF-bis-2026-11-11.md` „Offen" (Eintrag „LIVE 2026-11-07") | 5 |
| 8 | Ende bei Stufe 30 auf einer Insel, kein Ziel danach | `MAX_LEVEL = 30` | 3 |
| 9 | Doku zu groß für Sessions: `HANDOFF.md` 170 KB (wird nach `/clear` automatisch geladen), `SPEC.md` 145 KB | Dateigrößen | Prozess |

## Entscheidungen des Nutzers (2026-11-11)
1. **Wegweiser:** ganz entfernen, keine Ausnahme und kein Schalter.
2. **Beute:** gezielt zurückbauen. Truhen auf wenige versteckte oder verschlossene, Lichtstrahlen und Zufallsaffixe raus, feste Namen. **Sets und Edelsteine bleiben.** Champions, Kopfgelder und Erfolge bleiben unverändert.
3. **Grafik:** Pixel-Stil bleibt, Stimmung anheben (Wände, Licht, Oberfläche, Textlog). Kein neuer Figurenstil.
4. **Fernziel:** erst Wiedergeburt, dann zweite Insel.

5. **Wandhöhe (2026-11-11):** 40 (`WALL_H` in `isoWalls.ts`), umgesetzt.
6. **Oberfläche (2026-11-11):** Variante A „Schiefer und Eisen“, Vorlage `docs/probe/t3-oberflaeche.html` (Klasse `.va`).

7. **Grundsatz (2026-11-12, gilt für alles Künftige):** Es soll sich nach T4C anfühlen, aber besser, modern und für heutige Spieler. Bewährtes übernehmen, nichts erzwingen, kein Klon. Jedes neue System muss zum ganzen Spiel passen.
8. **Wiedergeburt (2026-11-12, ersetzt den ersten Teil von 4):** keine Rückkehr auf Stufe 1, keine Flügel. Der Nutzer hat die Entscheidung der Hauptsession übergeben; Begründung und Ersatz stehen unter T7. Reihenfolge bleibt: erst T7, dann zweite Insel.

Damit ist die offene Entscheidung 7 (Wegweiser) aus `SPEC.md` erledigt. Offen bleiben 6 (Fertigkeiten als trainierte Zahlenwerte) und `BASIC_TEMPO`.

## Pakete
Regeln für alle: eigener Worktree-Branch von `neuer-look`; Prüfung `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; alles Sichtbare im Browser ansehen und Bilder in die Übergabe; bei Sim-Änderungen Golden-Snapshots bewusst aktualisieren und `sh tools/pace-all.sh` (8 Seeds) nachmessen, Ziel L30-Median 20 bis 30 h. Kein Push auf `main`. Beim Browser-Test den Spielstand des Nutzers nicht überschreiben (kein `?neu` auf Platz 1).

### T0 Doku entschlacken (Haiku oder Sonnet, klein)
- `HANDOFF.md` auf die letzten 3 Einträge und die „Learnings" kürzen, den Rest unverändert nach `docs/archiv/HANDOFF-bis-2026-11-11.md`.
- `SPEC.md`: umgesetzte Pläne (alles vor „Plan: T4C-Charme") nach `docs/archiv/` verschieben, vorn bleiben Vision, Entscheidungen, Rechtliches und ein Verweis auf `PLAN.md`.
- Fertig, wenn `HANDOFF.md` unter 15 KB liegt und kein Inhalt verloren ist (Zeilenzahl Archiv + Rest = vorher).

### T1 Wegweiser entfernen (Sonnet)
- Raus: Feld „Nächster Schritt" mit Hinlaufen, Richtungspfeil, Zielrauten in Welt und Minimap, Leerlauf-Hinweise. `nextStep` darf für den Pace-Bot bleiben, die Darstellung nutzt es nicht mehr.
- Dafür: Jeder Auftrag muss über Worte auffindbar sein. Test, der für jedes Auftragsziel prüft, dass ein Stichwort oder Auftragstext eine Wegbeschreibung enthält (Himmelsrichtung plus Landmarke). Fehlende Beschreibungen in `topicsData.ts` ergänzen. Das Aufgabenfenster (J) zeigt nur noch, was der NPC gesagt hat.
- Dateien: `src/sim/quests.ts`, `src/sim/topicsData.ts`, `src/render/minimap.ts`, `GameScene.ts` (nur `idleHint`, `marks`, `step`), `ui.ts` (nur das Feld).
- Fertig, wenn ein neuer Charakter die Kette „Erste Schritte" ohne jede Markierung schafft (im Browser durchgespielt).

### T2 Beute zurückbauen (Sonnet, Abnahme mit Pace-Zahlen durch die Hauptsession)
- **T2a Truhen und Lichtstrahlen** (`scripts/gen_map.py`, `src/data/aschenthron.json`, `MAP_VERSION`, Beute-Teil in `GameScene.ts`): 98 Truhen auf etwa 12 an festen, versteckten Orten (Dungeon-Enden, Ruinen, hinter Gefahrenorten), jede in einem Gerücht erwähnt. Lichtstrahlen und Aufleuchten weg, Beute liegt als kleiner Gegenstand am Boden, Name nur beim Zeigen.
- **T2b Feste Beute** (`src/sim/items.ts`, `src/sim/named.ts`, `src/sim/data.ts`): Zufallsaffixe für neue Beute abschalten, Stufen „magisch/selten" entfallen für neue Funde, `NAMED_SHARE` Richtung 1. Alte Gegenstände in Spielständen bleiben gültig. Lücken in den 222 Zeilen `named.ts` je Stufenband und Slot auffüllen.
- Risiko: Balance. Ohne Affixe sinkt die Kraft der Ausrüstung, darum Pace vorher und nachher.
- Fertig, wenn Pace im Zielband liegt und im Bestiarium jeder Fund einen festen Namen hat.

### T3 Oberfläche in Stein, lesbare Schrift, Textlog (Probe: Hauptsession; Umsetzung: Sonnet)
- Erst Probe mit zwei Varianten als Standbild (Skill `prototype`, dazu `frontend-design`, `ui-ux-pro-max`, `impeccable`), Nutzer wählt. Dann Umsetzung.
- Inhalt: dunkler Stein und Eisen statt orangem Holz (eigene Zeichnung per CSS oder Code, keine fremden Vorlagen), Fließtext in gut lesbarer Schrift ab 16 px, Pixelschrift nur für Titel. Textlog unten links mit Kampfmeldungen („Du triffst … für 12"), Gesprächszeilen, Funden und Stufenaufstieg, einklappbar. Handy-HUD-Überlappung dabei beheben.
- Dateien: `src/render/theme.ts`, `ui.ts`, `hotbar.ts`, `touch.ts`, `index.html`.
- Fertig, wenn Kontrast AA erreicht ist und Desktop 1280×800 sowie Handy quer 812×375 gesehen wurden.

### T4 Nacht mit Lichtkreis (Sonnet)
- Nachts und im Dungeon deutlich dunkler, Lichtkreis um die Figur, Laternen und Fenster als Lichtinseln. Fackel als Gegenstand der Nebenhand vergrößert den Kreis (Abwägung gegen Schild). Gegner außerhalb des Lichts nur als dunkle Gestalt, das ersetzt den heutigen Schattenriss-Effekt sinnvoll.
- Dateien: `src/render/atmosphere.ts`, Haken in `GameScene.ts`; Fackel in `src/sim/items.ts` (nach T2b).
- Fertig, wenn Bildzeit je Frame höchstens 1 ms steigt und `?stunde=22` in Stadt, Wald und Katakomben gesehen wurde.

### T5 Hohe Wände und Gelände (Probe: Hauptsession; Umsetzung: Sonnet)
- Probe: Katakomben-Ausschnitt mit Wandhöhe 24, 40 und 56, Wände vor der Figur werden durchsichtig. Nutzer wählt (die Entscheidung „Wandhöhe/Verdeckung" ist seit P9 offen).
- Danach optional Klippenstufen in Hochland und Aschenöde als reine Darstellung, die Sim bleibt flach.
- Dateien: `src/render/world/isoWalls.ts`, `src/render/isoGround.ts`, Chunk-Teil in `GameScene.ts`.

### T6 Offene Mängel (Sonnet, Skill `diagnosing-bugs`)
- Sheet-Cache verwirft genutzte Texturen (`heroSheet.ts`, `monsterSheet.ts`), Aufploppen frischer Gegner, gerades Band der Frostnova, dazu ein `/code-review` über den ganzen P9-Diff.
- Fertig, wenn ein Schwarmtod mit 8 Gegnern ohne Einfrieren läuft und die Review-Befunde behoben oder begründet abgelehnt sind.

### T7 Nachspiel „Die Asche ruft“ statt Wiedergeburt (Regeln entschieden 2026-11-12; Umsetzung: Sonnet, Skill `tdd`)
- **Warum keine Rückkehr auf Stufe 1:** Ein Durchgang dauert im Median rund 22 h. Die Welt ist handgebaut und lebt vom Entdecken über Worte (kein Wegweiser, 13 versteckte Truhen, feste Beute): beim zweiten Mal ist alles bekannt, es bliebe reine Wiederholung. In T4C trug die Wiedergeburt, weil andere Spieler den Status sahen und Attributpunkte knapp waren; hier gibt es Umlernen gegen Gold schon. Erzwungenes Neuspielen bewährt sich nur bei zufälliger Welt oder Beute, beides wurde hier bewusst abgebaut.
- **Was aus der Wiedergeburt bleibt (der bewährte Kern):** ein Ziel nach Stufe 30, ein Grund, alte Orte neu zu besuchen, ein sichtbares Zeichen.
- **Regeln:**
  1. Auslöser: Tod des Aschenkönigs (`ash_king`). Stufe 30 bleibt die Grenze, nichts wird zurückgesetzt, kein Attributbonus.
  2. Danach erwachen die 7 übrigen Bosse (`goblin_king` bis `web_mother`) an ihren Orten neu, auf Stufe 30 und mit je einer zusätzlichen Fähigkeit. Jeder trägt genau einen eigenen benannten Fund (7 neue Einträge in `named.ts`, Stufe 30, quer über die Slots). Erwachte Bosse erscheinen nur für Figuren, die den König besiegt haben; im Mehrspieler entscheidet der Angreifer mit dem höchsten Stand.
  3. Auffinden nur über Worte: Maren bekommt das Stichwort „asche“, je Boss ein Gerücht mit Himmelsrichtung und Landmarke bei einem passenden NPC (Muster `TRUHEN` in `topicsData.ts`, Test wie `wegweiser.test.ts`). Neue Auftragskette „Die Asche ruft“ (7 Schritte, Reihenfolge frei, `hidden` für den Auto-Start).
  4. Zeichen: Aschenmal, glimmende Risse an der Figur, sichtbar ab dem Sieg über den König, voll ausgeprägt nach allen 7. Nachts schwach leuchtend. Kein Kranz, keine Flügel.
  5. Titel: „Erbe der Asche“ (König besiegt), „Der die Asche zum Schweigen brachte“ (alle 7). Eintrag ins Bestiarium je erwachtem Boss.
- **Bewusst nicht:** höhere Stufengrenze, härtere Gesamtwelt, Punktebonus, Vererbung an neue Figuren. Das meiste davon gehört, wenn überhaupt, zur zweiten Insel.
- Dateien: `src/sim/data.ts`, `named.ts`, `world.ts`, `save.ts`, `quests.ts`, `topicsData.ts`, `ui.ts`, Figur in `src/render/hero.ts`.
- Fertig, wenn ein Stufe-30-Stand nach dem König alle 7 erwachten Bosse über Gerüchte findet, das Zeichen im Browser gesehen wurde und alte Spielstände unverändert laden. Pace bis Stufe 30 darf sich nicht verschieben (keine neuen Zufallswürfe vor dem Königstod).

### T8 Zweite Insel (später, eigene SPEC)
- Entspricht P8 in `SPEC.md` (Details in `docs/archiv/SPEC-bis-2026-11-11.md`). Erst nach T7, mit eigener Klärungsrunde.

## Reihenfolge
| Welle | Parallel | Warum so |
|---|---|---|
| 0 | T0 · T6 | Macht alle folgenden Sessions billiger und den Unterbau stabil |
| 1 | T1 · T2b · T4 (ohne Fackel) | Getrennte Dateien; `GameScene.ts` nur T1 (Hinweise) und T4 (Licht-Haken) an verschiedenen Stellen |
| 2 | T2a · T3-Probe · T5-Probe | T2a nach T1 wegen `GameScene.ts` und Minimap; Proben ändern das Spiel nicht |
| 3 | T3 · T5 | Nach Wahl des Nutzers; T3 besitzt `ui.ts`, T5 die Welt-Darstellung |
| 4 | T7 | Braucht stabile Beute (T2) und die neue Oberfläche (T3) |
| 5 | T8 | Eigenes Großprojekt |

## Welches Modell wofür
- **Sonnet:** alle Umsetzungen mit klarer Abnahme (T1, T2, T4, T6, Umsetzung von T3, T5, T7). Hat bei P9.1 bis P9.3 getragen.
- **Hauptsession (stärkstes Modell):** Proben mit Geschmacksurteil (T3, T5), Regelentwurf (T7), Balance-Urteil nach Pace-Läufen, Abnahme jedes Pakets (Diff lesen, Prüfbefehle selbst laufen lassen, Bilder ansehen).
- **Haiku:** nur T0 und reine Suchaufträge.
- Qualitätsrisiko bei kleineren Modellen liegt nicht im Code, sondern bei Geschmack und Balance. Darum bleiben diese beiden Punkte oben.
