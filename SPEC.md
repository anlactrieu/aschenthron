# SPEC – Aschenthron (Dark-Fantasy-ARPG im Geist von T4C)

## Vision
Ein Spiel im Geist von **The 4th Coming / Die Vierte Offenbarung (T4C)**, aber im Browser auf dem Mac.
Feste offene Welt, klassenloser Charakteraufbau, Respawn-Grind, seltene Drops, echtes Risiko, später PvP, Handel und Gilden.
Kein Diablo-Klon: keine Zufallsdungeons als Kern und keine festen Klassen.

## Festgelegte Entscheidungen
| Thema | Entscheidung |
|---|---|
| Plattform | Browser (macOS), TypeScript, 2D Iso/Top-Down, Canvas/Phaser nur fürs Rendering |
| Welt | Feste, handgebaute, zusammenhängende Karte mit Städten, Wildnis und Dungeons |
| Charakter | Klassenlos: Stat-Punkte pro Level frei verteilen, Skills bei Lehrern lernen |
| Kampf | Echtzeit-Action, Skills mit Cooldowns. Wenige zähe Gegner an festen Spawnpunkten (Gruppen 1–5), Taktik vor Reaktion; keine Horden |
| Grind | Monster respawnen an festen Orten, seltene Drops, lange Level-Kurve |
| Setting | Dark Fantasy |
| Loot | Seltenheitsstufen, Affixe, legendäre Effekte, Crafting, Sets (Details in der Detailphase) |
| Todesstrafe | XP-Verlust und Item-Drop beim Tod (siehe unten). Extraction-Modus ist gestrichen |
| Mehrspieler | Singleplayer-MVP, Architektur online-fähig; Server später mit PvP, Handel, Gilden |
| PvP | Später: offene Welt, Überfälle, 1v1, Gilden. Lieblingsmodus des Spielers, aber nicht Fokus der ersten Stufe |

## Architektur-Pflichten (online-fähig ab Tag 1)
- Spiellogik als reine TypeScript-Simulation mit festem Tick, ohne Phaser/DOM.
- Seeded RNG, Eingaben als Commands, Rendering liest nur den State.
- Welt als Daten (Karten, Spawns, Monster, Items), damit Inhalte ohne Codeänderung wachsen können.
- Netzwerk-Bibliothek erst nach Prüfung wählen, nicht aus dem Gedächtnis.

## MVP (Stufe 1)
Eine kleine feste Region: 1 Stadt, 2–3 Jagdgebiete, 1 Dungeon, 1 Boss.
Stat-Punkte plus Skills bei Lehrern, Respawn-Monster, Loot-Kern mit Seltenheiten und Affixen,
Todesstrafe, Speichern im Browser (localStorage/IndexedDB). Solo, keine KI-Begleiter im MVP.
Levelbereich MVP: 1–20 mit Platzhalter-XP-Kurve. Hub: Händler, Skill-Lehrer, Bank/Stash (sicherer Ort für Items).

## Ausbaustufen
2. Größere Welt, mehr Skills, Crafting, Sets, legendäre Effekte
3. Mini-Server für dich und Freunde: Handel, Gruppen, Gilden
4. PvP: Duelle, offene Welt mit PK-Regeln, Gildenkriege

## Todesstrafe (entschieden: mittel)
- ca. 5 % XP des aktuellen Levels weg (nie Level-Verlust unter Schwelle, Feinjustierung beim Balancing)
- 1–3 zufällige Items fallen an der Todesstelle, bevorzugt nicht Ausgerüstetes
- Respawn in der Stadt, Leichenlauf zum Einsammeln der Items (zeitlich begrenzt)
- Safe-Zonen in Städten

## Charakter (entschieden)
- 5 Attribute: Kraft, Gewandtheit, Ausdauer, Verstand, Willenskraft (eigene Formeln, eigene Namen im Spiel prüfen)
- Skill-Bereiche: Nahkampf, Fernkampf, Magie. Dunkle Künste/Handwerk: nicht gewählt, nicht geplant
- Skills bei Lehrern lernen, eigene Skill-Liste, nicht aus T4C übernommen
- Steuerung: Klick-Bewegung/Angriff + Skill-Tasten 1–9

## Items (entschieden)
- Ausrüstungsslots (Helm, Brust, Waffe, Ringe usw.) mit Level-/Attributanforderungen
- Zufällige Affixe auf magischen/seltenen Items
- Inventar mit Gewichtslimit (Tragkraft hängt an Kraft)
- Haltbarkeit/Reparatur: nicht im Scope (bewusst nicht gewählt)

## Karten (entschieden)
Feste Karten als Tiled-Daten (JSON, Tiled-Editor frei nutzbar). Ich erzeuge sie, du kannst sie später selbst editieren. Tile-Geometrie hängt vom Asset-Pack: zuerst Pack wählen oder Platzhalter-Diamant-Tiles, bevor Karten gebaut werden.

## Grafik (entschieden)
Pixel-Art Iso, düster. Quellen: freie, lizenzgeprüfte Asset-Packs (CC0 o. ä.) plus eigene Anpassung; Lizenzen in `ASSETS.md` tracken. Im MVP zuerst Platzhalter erlaubt.

## MVP-Welt (entschieden)
„Verfallenes Königreich“: zerstörte Burgstadt als Hub, Sumpf, Friedhofswald, Katakomben mit Boss.

## Rechtliches / Eigenständigkeit
Orientierung an T4C nur bei Spielprinzipien (Mechaniken lassen sich nicht schützen). **Nichts kopieren:** keine Namen, Skill- oder Item-Bezeichnungen, Texte, Karten, Grafiken, Sounds oder Logos aus T4C. Alle Skills, Items, Orte und Lore werden eigenständig erfunden. Eigene Namen und eigene Welt, keine Anspielungen auf T4C im Spiel oder Namen.

## Offene Fragen
- Konkrete Skill-Liste, Monster, Items, Lore (in Detailphase mit Advisor)
- Wie PvP später Schutz vor Missbrauch bekommt (Safe-Zonen, PK-Ruf)

## Meilensteine (vertikale Scheiben, in dieser Reihenfolge)
1. Iso-Karte, Klick-Bewegung, Angriff auf ein Monster. Akzeptanz: Monster stirbt, Simulation läuft ohne Phaser testbar
2. Drops, Inventar, Gewichtslimit. Akzeptanz: Item aufheben, ausrüsten, Gewicht begrenzt Tragen
3. Attribute, Leveln, ein Lehrer. Akzeptanz: Punkte verteilen, Skill lernen und nutzen
4. Todesstrafe und Leichenlauf. Akzeptanz: XP-Verlust, Items an Todesstelle, Rückholen möglich
5. Hub mit Händler und Stash. Akzeptanz: kaufen, verkaufen, sicher lagern
6. Dungeon und Boss. Akzeptanz: Katakomben spielbar, Boss mit Drop

## Stack und Prüfung
TypeScript + Vite (Build), Vitest (Tests), ESLint (Lint), Phaser nur fürs Rendering. Versionen in der Umsetzungs-Session prüfen, nicht aus dem Gedächtnis. Vor jeder „fertig“-Meldung: Tests, Build, Lint laufen lassen.

## Prozess
Umsetzung in frischer Session mit dieser SPEC.md. Git-Repo ist angelegt (`main`).
Advisor (Opus) an den Checkpoints laut ~/.claude/CLAUDE.md.
