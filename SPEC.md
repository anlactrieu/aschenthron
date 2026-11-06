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

## Todesstrafe (entschieden: mittel; seit P4 durch D4O-nahe Regeln ersetzt)
Gilt jetzt nach Stufe gestaffelt, mit Gold, Besitzersperre am Leichenhaufen und PvP-Sonderfall; Regeln und Quellen siehe „Umsetzungsstand P4“ weiter unten. Unverändert: Respawn in der Stadt, Leichenlauf 5 Minuten, Safe-Zonen in Städten, Angelegtes bleibt.

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
Umsetzung auf Wunsch des Users in derselben Session (statt frischer Session). Stand: Meilensteine 1–6 umgesetzt, siehe HANDOFF.md. Git-Repo (`main`).
Advisor (Opus) an den Checkpoints laut ~/.claude/CLAUDE.md.

## Gebiet „Aschental“ (Stand Nachtarbeit, messbare Ziele)
Die Zielgröße „wie die erste Insel von T4C“ ist als messbare Ziele umgesetzt (nicht aus dem Gedächtnis nachgebaut, alle Namen sind eigen):
- Karte 160×120 Tiles, ca. 8.500 begehbare Kacheln, 2 Städte (Aschenhafen, Felsenwacht), 9 Landschaftszonen (Roggenfelder, Düsterwald, Räuberlager, Moorlande, Totenacker, Hochland, Aschenöde u. a.), 4 Dungeons (Gruft der Moorhexe, Katakomben, Tiefenmine, Thron der Asche), 5 Bosse, ca. 260 Monster, 22 Monsterarten, Level 1–30.
- Progression ohne Lücken (Test): zu jedem Level 1–30 gibt es Gegner im Abstand ≤ 2 Level. Städte sind frei von starken Gegnern.
- Spieldauer: Bot-Messlauf (`npm run pace`) bis Levelcap ca. 5,4 h Spielzeit (idealisierter Bot, Menschen eher langsamer), ca. 19 Tode.
- 14 Aufgaben (Töte-Aufgaben inkl. Bosse) bei 4 Questgebern, Level 1–28.

## Annahmen ohne Rückfrage (bitte morgen prüfen)
- Levelcap 30 statt 20; XP-Kurve und Monsterwerte zentral in `src/sim/data.ts` (`SCALE`, `xpToNext`).
- Grafik und Sound werden prozedural im Code erzeugt (keine heruntergeladenen Assets), weil Downloads deine Freigabe brauchen.
- Rüstung wirkt prozentual (Schaden × 30 / (30 + Rüstung)) statt als fester Abzug.
- Respawn nach dem Tod in der nächstgelegenen Stadt.
- Aufgaben: Töten, Truhen öffnen, Champions und benannte Mini-Bosse besiegen (keine Liefer-/Dialogquests).

## Stufe 2 (umgesetzt in der Nachtarbeit)
- 12 Fertigkeiten in 3 Bereichen (Nahkampf, Fernkampf, Magie): Flächenschaden, Mehrfachziel, Gift (Schaden über Zeit), Selbstheilung; Lehrer-Stufe 1 (Aschenhafen) und 2 (Felsenwacht).
- Legendäre Gegenstände mit Effekten (Lebensraub, Kritisch, Dornen, Mana pro Kill, Erfahrungs-/Goldbonus): 12 Unikate, Bosse lassen ihr Unikat gezielt fallen.
- 3 Sets (Wächter von Aschental, Knochenbinder, Aschenerbe) mit Boni bei 2/3/4 Teilen.
- Schmied: Aufwerten (normal → magisch → selten), Affixe neu würfeln, Affix hinzufügen (Goldkosten).
- Haltbarkeit/Reparatur und Dunkle Künste bleiben bewusst draußen.

## Mehrspieler und PvP (umgesetzt, experimentell, Branch `multiplayer`)
- Authoritativer Server (`server/`, Node + `ws`) führt dieselbe Simulation aus; Clients schicken nur Befehle (werden validiert, ratenbegrenzt) und bekommen 10×/s Schnappschüsse der Umgebung.
- Einzelspieler bleibt Standard und unverändert; Mehrspieler nur über `?server=…`.
- PvP: außerhalb der Städte; Mörder-Markierung (10 Min.) für Angreifer von Unbeteiligten; Notwehr frei; Beute liegt am Todesort.
- Mehrere Spieler teilen XP, Gold und Questfortschritt, wenn sie zuletzt Schaden an einem Monster gemacht haben und in der Nähe sind.
- Spielstände auf dem Server pro Name (Datei); keine Passwörter. Nicht für das offene Internet gedacht.
- Offen: Chat, Gruppen/Gilden, Handel zwischen Spielern, Anti-Cheat jenseits der Befehlsvalidierung.

## T4C-Recherche (Mechanik-Prinzipien, Quellenlage teils dünn; keine Inhalte übernommen)
Übernehmen: klassenlos mit Attributen + Skills (Skillpunkte bei Trainern gegen Gold) · Gegenstände mit Anforderungen (Ausrüstung als Ziel für Attribute) · Trefferchance als Verhältnis Angriff/Ausweichen, Rüstung als Abzug · Echtzeit-Klick mit Auto-Angriff · Gebiete als Level-Bänder mit Gegnerfamilien in Stufen · konfigurierbare Todesstrafe · Leichen-/Todesstellen-Bergung · Gruppen-XP-Teilung (später) · Atmosphäre vor Grafikfülle.
Abwandeln: Rebuild-Problem (Umverteilen gegen viel Gold erlauben) · HP/Mana aus aktuellen Attributen statt festgeschrieben · Grind durch Elite-Gegner, Mini-Bosse, Truhen und Ereignisse auflockern · Quests nicht nur „töte N“ · milde Todesstrafe als Standard · PvP nur in Zonen/mit Markierung.
Vermeiden: Endlos-Grind/Rebirth-Schleifen · harte Verluste ohne Schutz · unumkehrbare Fehlentscheidungen · Pflicht-Stat-Reihenfolge · Teleport-Items, die die Weltgröße entwerten · Dupe-Exploits (alles serverseitig validieren).

## Asset-Recherche (nur gelesen, NICHTS heruntergeladen – Download braucht deine Freigabe)
Es gibt kein fertiges, düsteres, einheitliches, lizenzsauberes Pixel-Iso-Paket mit Animationen. Empfehlung des Recherche-Agenten:
1. Isometric Stone Soup (CC0, 1895 Iso-Tiles 64x32 Boden/Wand) – https://opengameart.org/content/isometric-stone-soup
2. Dungeon Crawl 32x32 Tiles (CC0, >3000 Einzelbilder: Items, Monster, Effekte) – https://opengameart.org/content/dungeon-crawl-32x32-tiles
3. Clint Bellanger Figuren (CC-BY 3.0, Namensnennung nötig; gerenderte 3D-Sprites in 8 Richtungen mit Lauf-/Angriffsframes): Isometric Hero and Heroine, Isometric Hero and Creatures, Skeleton Warrior, Zombie, Goblin – Links auf opengameart.org (siehe Titel).
Grassland Tileset (CC-BY-SA) wird wegen ShareAlike nicht empfohlen. Bäume, Felsen, Wasser, Lava, Wölfe, Ratten, Spinnen, Golems, Dämonen und Effekte bleiben prozedural. Mischstil-Warnung: gerenderte Figuren + Pixel-Tiles brauchen einheitliche Palette/Skalierung. Lizenzdateien in den ZIPs vor dem Einbau prüfen; Credits-Seite im Spiel nötig.

## Nachtarbeit 2: neue Annahmen und Regeln (bitte prüfen)
- Insel v3: 240×180 Tiles, ~650 Monster in ~250 Rudeln (1–5 Tiere, Anführer eine Stufe höher), Monsterfamilien in Stufen (z. B. Goblin → Kundschafter → Krieger → Schamane → Häuptling), je weiter vom Zoneneingang desto stärker. Spielstände anderer Kartenversion starten in der Stadt.
- Champions (~10 % der Rudel mit ≥2 Tieren): Modifikator (flink, gepanzert, feurig, blutsaugend, dornig), dreifache Belohnung, garantierte magische/seltene Beute. 13 benannte Mini-Bosse mit Fähigkeiten und 15–25 Min. Wartezeit, garantiert seltene Beute, oft Unikat/Set-Teil.
- Boss-Mechaniken: Bodenschlag mit Warnring (1,3 s), Beschwörung bei halbem Leben (Helfer verschwinden beim Wiedererscheinen), Ansturm.
- 76 Truhen (Holz/Eisen/Gold), 12 Min. Wiederauffüllung, Beute nach Zonenstufe.
- Gegenstände haben Anforderungen (Stufe + Attribute); schwere Rüstung braucht Ausdauer, Waffen ab Stufe 11 Gewandtheit, Bögen Gewandtheit, Stäbe/Roben Verstand/Willenskraft. Fernkampf-Skills brauchen Bogen + Köcher mit Pfeilen (1 Pfeil pro Schuss; Pfeilbündel auf den Köcher ziehen), Magie-Skills profitieren von Stäben. Bögen/Stäbe machen im Nahkampf nur ein Viertel Schaden.
- Skillpunkte: 2 am Start, 1 pro Level; Rang 1–5 je Skill (Stufenanforderung steigt, Gold, +18 % Wirkung je Rang). Neuverteilen beim Lehrer gegen Gold (100 + 8·Stufe²), setzt Attribute und Skills zurück.
- Trefferchance: ATK/(ATK + 0,2·DEF), 35–97 %; Fehlschläge werden als „Verfehlt/Ausgewichen“ angezeigt. Zauber treffen immer.
- Neue Affixe: Angriffstempo, Kritisch, Regeneration, Treffsicherheit, Ausweichen. Rasten mit R (5× Erholung außerhalb der Stadt, endet bei Aktion/Treffer).
- Grafik: weiterhin prozedural; Recherche zu Fremd-Assets steht oben, nichts heruntergeladen (Freigabe nötig).

## Stufe 4: Kampftiefe, Welt/Endgame, echte Grafik (vom User gewählt, noch NICHT umgesetzt)
Auslöser: T4C-Profi-Review (Subagent). Bereits umgesetzt: Amulett + 2. Ring, zaubernde Monster (Schamane/Hexe/Imp), Zonenton, Skill-Auswahl vor Zielklick, Startgold 100.
Umsetzung in frischer Session, je Paket als eigener Commit; nach jedem Paket Tests/Lint/Build + `npm run pace`.

**A) Kampftiefe**
1. Schadensarten (physisch, Feuer, Frost, Gift) auf Skills/Waffen/Monstern; Resistenz-Affix und Monster-Familien mit Schwächen (Untote: Feuer schwach; Golems: Gift immun; …). Champion „feurig“ verursacht echtes Feuer.
2. Statuseffekte: Verlangsamen, Betäuben, Brennen (Gift-DoT existiert). Sim-autoritativ, im Schnappschuss/`net.ts` filtern, Icons im HUD.
3. Monster-Rollen: Heiler (Schamane heilt Verbündete), Gift-Spinne (verlangsamt), Bogenschütze (Abstand, nutzt `castAi`-Muster), Untote beschwören. Familien-Fähigkeiten über `Ability`.
4. Schild + Zweitwaffe: Slots `offhand`; Zweihänder (kein Schild) vs. Einhänder+Schild; Waffenfamilien schnell/schwer. Gürtel/Umhang später.
5. Attribut-Tiefe: Willenskraft als Konzentration/Resistenz, Schwellen-Boni, Gewichts-Behinderung statt hartem Limit (zu klären).

**B) Welt & Endgame**
1. Tag/Nacht + Wetter als Render-Layer (Sim unberührt; Nacht evtl. mehr Gefahr später).
2. Lore-NPCs, Dialoge, Questketten (Wegbeschreibung/Bring/Eskorte), zusätzlich zu Töten/Truhe/Champion/Mini-Boss.
3. Goblin- und Spinnen-Dungeon als neue Zonen (`scripts/gen_map.py`, MAP_VERSION erhöhen, Spielstand-Kompatibilität prüfen).
4. Endgame: Elite-Zone, Weltbosse mit Respawn-Rotation, Level-Kurve strecken (Ziel ~20–40 h, Wert mit dem User abstimmen, Pace-Bot nachmessen).

**C) Echte Grafik (Download vom User freigegeben)**
- Quelle: Dungeon Crawl 32x32 Tiles (CC0, OpenGameArt) für Items, Monster, Icons; ggf. Isometric Stone Soup für Boden/Wände. Vor dem Download Dateiname/Größe nennen.
- Lizenz + Quelle in `ASSETS.md`, Credits-Seite im Spiel. Prozedurale Grafik als Fallback behalten. Ladezeit/Bundle-Größe beachten.

**Nicht in diesem Paket (bewusst offen):** Soziales/PvP-Rahmen (Chat, Gruppen, Handel, Gilden, Kopfgeld, Login), Loot-Chase (Affix-Stufen, Sockel).

## Stufe 5: Solo-Ausbau (Auftrag des Users: alles aus dem T4C-Review, was für Solo-Spiel zählt)
Ausgenommen (nur Mehrspieler): Chat, Gruppen, Spieler-Handel, Gilden, Kopfgeld/Duelle, Login. Umsetzung in 4 Paketen nacheinander, je Paket Commit, Tests/Lint/Build, Pace-Messung:
- **P1 Kampftiefe:** Schadensarten + Resistenzen, Statuseffekte, Monster-Rollen (Heiler, Gift-Spinne, Bogenschütze, Untote beschwören).
- **P2 Ausrüstung & Loot:** Gürtel/Umhang/Beine, Zweihänder vs. Einhänder+Schild, Waffenfamilien, Attribut-Tiefe (Willenskraft, Schwellen), Affix-Stufen + Prefix/Suffix-Namen, Sockel/Gems.
- **P3 Welt & Endgame:** Tag/Nacht + Wetter, Lore-NPCs + Questketten, Goblin-/Spinnen-Dungeon, Elite-Zone + Weltbosse (Respawn), Level-Kurve bleibt (Bot ≈ 8 h).
- **P4 Grafik:** CC0-Pack (Dungeon Crawl 32x32) einbauen, `ASSETS.md` + Credits, prozeduraler Fallback.

## Stufe 6: Build-Tiefe für Skills, Zauber und Items (umgesetzt: Phase 1–5, dazu Stadt Moosbrück)
Ziel: freie Builds statt Itemleiter, nur Prinzipien klassischer freier MMORPGs, eigene Namen. Bestehende IDs, Speicherformate und Balance bleiben. Zauber = `SkillDef` mit `area: 'Magie'` (kein Parallelsystem), Skillpunkte bleiben die einzige Währung. Umsetzung in frischer Session, je Phase ein Commit mit Tests/Lint/Build.

**Entscheidungen (User):**
- Umfang erste Runde: Phase 1–3 (Fundament, Skills/Zauber, Items). UI-Politur (Buildprofil) und Balance-Benchmark danach.
- Respec: einmal gratis nach dem Update (neuer Merker im Spielstand, `save.ts` `KEYS`; Altstände ohne Merker bekommen ihn).
- Support im Solo: Selbsterhalt, Schutz, Debuffs auf Gegner. Fremdheilung nur im Mehrspielermodus (`target: 'ally'`). Keine Begleiter.
- Utility jetzt nur Schleichen, Erste Hilfe, Überleben. Wahrnehmung/Objektinteraktion später (bräuchte neue Spielobjekte).

**Phase 1 Fundament:** `effects.ts` (Tabelle je Status: Art Buff/Debuff/Kontrolle, Schule, Stapelregel ersetzen/erneuern/stapeln, entfernbar, Kontroll-Verkürzung bei Wiederholung), `applyStatus` zieht ein, `dispel`/`cleanse`; optionales `Actor.statusMag`. `SkillDef`: optional `school`, `target`, `passive`, `info {Wirkung, Build, Synergie, Entscheidung, Grenze}`. `useSkill` in Effekt-Handler zerlegen; Golden-Test (fester Seed) beweist: 12 Alt-Skills liefern identische Werte. Ereignis `note` für Combat-Log-Erklärungen. Hotbar nur aktive Skills. Blitzschlag-Fix (Schadensart fehlte). Neue RNG-Würfe nur bei aktivem Feature (Seed-Stabilität).
**Phase 2 Skills (~14 neu, Alte unverändert):** Passiv: Parieren, Ausweichtraining, Präzision, Rüstungsbrecher, Schildbeherrschung. Magie: Elementarschild, Steinhaut, Schwäche/Fluch, Stille (unterbricht Zauber), Entzaubern, Läuterung, Manafluss. Utility: Erste Hilfe, Schleichen (Aggro-Radius), Überleben. Alle Boni gedeckelt. Gegenmaßnahmen: Entzauberer-Monster (Knochenakolyth), Kontrollresistenz Boss/Familie.
**Phase 3 Items (neue Vorlagen, Alt-Werte bleiben):** neue Stats (`spellFire`, `spellFrost`, `healPower`, `manaCost`, `ctrl`, Bewegung), Nachteile als negative `base`-Werte, Besonderheiten über `Power`; je Build 2–3 Vorlagen (Elementarstab, Paradeschwert, Bollwerk-Schild mit Tempo-Abzug, Heilring mit Manakosten, Kontroll-Amulett). Tooltip mit Vorzeichen, `gearScore` mit Nachteilen, `POWER_TEXT`-Guard.
**Phase 4/5 (später):** Skillkarte mit Info-Zeilen, Buildprofil/Archetyp-Empfehlung, Statusicons, Interaktionstests, Build-Benchmark (Zeit bis Sieg Level 10/20/30, 5 Builds), Pace-Kontrolle.

**Risiken:** IDs nie entfernen/umbenennen; unbekannte Stats/Powers tolerant laden; Snapshot-Felder optional + Defaults in `actorFromLite`; `ActorLite.st` erweitern; Tests mit festen Skill-Listen (`stage2.test.ts`) prüfen.

**Umsetzungsstand:** Alle Phasen umgesetzt (Effektsystem `effects.ts`, 27 Skills mit `info`, 21 Build-Items, Buildprofil `build.ts`, Benchmark `builds.bench.test.ts`, Stadt Moosbrück). Messung: Fern-/Zauberbuilds liefern im Altbestand 2–5× den Nahkampf-DPS (reglose Zielpuppe); bewusst nicht angefasst (Balance-Vorgabe), siehe Kommentar im Benchmark.

## Lebendige Welt (Rudel und Stadtbewohner)
- **Rudel:** höchstens 3 Tiere (meist 2–3), etwa 60 % der früheren Rudelanzahl je Zone (`PACK_MAX`, `PACK_DENSITY` in `scripts/gen_map.py`). Im Spiel patrouilliert jedes Rudel gemeinsam zwischen 1–2 Wegpunkten im Umkreis von 5 Feldern um den Rudelplatz (Tempo ×0,55, 6–14 s Pause), `setupPatrols`/`patrolStep` in `world.ts`. Beim Entdecken des Spielers Kampf wie bisher, danach zurück in die Patrouille. Bosse und Mini-Bosse bleiben stehen.
- **Handelsstraße:** Monster-freier Streifen `SAFE_R = 12` (Aggro 6 + Patrouille 5 + Puffer).
- **Stadtbewohner:** alle NPCs innerhalb der Sicherheitszone (außer der Truhe) schlendern in 2 Feldern Umkreis (`Npc.wander`), halten an, sobald jemand in Gesprächsreichweite ist. Nur Einzelspieler (`World.npcWander`), online bleiben NPCs am Platz, weil Clients nur den Heimatplatz kennen.
- Zufall für Verhalten nutzt den eigenen Strom `World.fx`, damit Kampf und Beute der Simulation unverändert deterministisch bleiben.

## D4O-Gefühl: Orientierung, Wucht, Tiefe (umgesetzt)
- **Orientierung:** Quest-Tracker oben rechts (bis 3 Aufgaben, Ziel + Ort), Intro-Banner mit Prämisse (Aschental, Aschenkönig, Ziel Stufe 30).
- **Kampfgefühl:** Crit-Sound, Hit-Stop (nur Einzelspieler, 55 ms Crit / 30 ms Boss), roter Todesblitz mit Banner.
- **Loot:** Rare-Drop-Sound, ▲ am Bodenlabel bei Verbesserung; neue Powers `execute`, `healKill`, `burnHit`, `frostHit` (Proc-Würfe nur mit eigenem Zufallsstrom `fx`), 6 neue Legendäre, 4 Proc-Waffen (Stat `procBurn`/`procFrost`).
- **Skills:** 12 neue Meisterfertigkeiten (Stufe 15–30, Lehrer Stufe 2, kein neuer Lehrer nötig) schließen die Lücke nach Blitzschlag.
- **Meisterschaft:** ab Stufe 20 genau eine von 4 Richtungen (Kriegsherr, Jäger, Erzmagier, Wächter) als Zusatzwerte (`SPECS`, `Actor.spec`, Befehl `chooseSpec`); Neuverteilen beim Lehrer setzt sie zurück.
- **Erfolge:** 16 Erfolge + Bestwerte (Taste O), nur clientseitig in localStorage (`aschenthron.ach.v1`). Echte Bestenliste braucht den Server: offen.
- **Offen:** Pace-Lauf mit neuen Skills (Bot nutzt keine Skills), Balance der Meisterschaften und Powers im Spiel prüfen, Server-Rangliste.

## D4O-Gefühl, Runde 2 (umgesetzt)
- **Level-Meilensteine** (`LEVEL_MILESTONES`, `milestonePoints` in data.ts): Stufe 10 (+3 Attr, +1 Skill), 15 (+3), 20 (+5, +1), 25 (+5, +1), 30 (+10, +1); zählen beim Neuverteilen und im Save-Import. Zweite Attribut-Schwelle bei 50 verdoppelt den Bonus (`ATTR_THRESHOLD_2`). `rankLevelReq` ist auf `MAX_LEVEL` gedeckelt (Rang 5 ist so immer erreichbar).
- **Upgrade-Bewertung** (`ui.ts` `gearScore`): Powers zählen mit ihrer Stärke (`POWER_WEIGHT`), Tooltip zeigt Gesamturteil in % und Effektwechsel, ▼ im Rucksack bei deutlicher Verschlechterung (`isDowngrade`).
- **Orientierung:** Richtungspfeil mit Entfernung zum nächsten Aufgabenziel ab 10 Feldern (`updateCompass`), Hinweis alle 90 s ohne laufende Aufgabe (`idleHint`), Endziel im Aufgabenfenster.
- **Titelbild** für neue Spiele mit Prämisse und Namenswahl (`showTitle`, Name in localStorage `aschenthron.name`); Erfolg und Banner beim Sturz des Aschenkönigs; Banner und Blitz bei Rare-Drops.
- **Nicht gemacht:** Startschaden erhöhen (Golden-Tests und Balance hängen daran), Server-Rangliste (braucht Server-Persistenz), Legendär-Droprate/Duplikate.
- **Pace-Kontrolle nach Runde 2:** Bot-Lauf Level 5 nach 13 min, 10 nach 50 min, 20 nach 188 min, 30 nach 504 min (8,4 h, 8 Tode). Entspricht den früheren Messungen, `XP_LATE_FACTOR = 1.0` passt also. Der Bot nutzt keine Skills; die Balance der neuen Skills bleibt per Hand zu prüfen.

## Teleport-Schriftrollen (Goldsenke)
- Zwei Rollen (`scroll_hafen` Stufe 1, 60 Wert; `scroll_wacht` Stufe 6, 90 Wert) als Verbrauchsgegenstand (Slot `potion`, Feld `town`), bei den Händlern `basic` und `advanced` kaufbar; Kaufpreis = 2 × Wert (120 bzw. 180 Gold), fallen nicht als Beute.
- Lesen: 3 s Wirkzeit (`TELEPORT_TICKS`, `Actor.tele`, `updateTeleport` in world.ts); Bewegung, Treffer, Kampf oder Tod brechen ab, die Rolle bleibt dann erhalten. Nicht lesbar im Kampf und nicht, wenn man schon in der Zielstadt ist (< 25 Felder). Stadtname kommt aus der Tiled-Karte (`world.towns[].name`).

## Roter Faden, Beute-Jagd, Mit-Jagen (Motivation)
Anlass: Spieler wusste nicht, was zu tun ist, und fand Quest-Monster nicht.
- **Nächster Schritt** (`nextStep` in quests.ts, Anzeige oben im Tracker, Knopf „Hinlaufen“, Richtungspfeil folgt ihm): 1) fertige Aufgabe abgeben, 2) nächstes Geschichts-Kettenglied (höchstens 6 Stufen unter der eigenen), 3) „Gesucht“: lebender benannter Elitegegner ±4 Stufen (seltene Beute, Chance auf Legendäres/Set), 4) nächstes Ziel einer laufenden Aufgabe, 5) Jagdgebiet passend zur Stufe.
- **Mit-Jagen** (`onMonsterDeath`): Kills der Monsterart einer freien Töte-Aufgabe (ohne Kette, Stufe erreicht) starten die Aufgabe automatisch; Abgabe weiter beim Auftraggeber.
- **Offen:** Kopfgeld-Aushang (nicht gewählt), mehr Story-Szenen/Kapitel für Stufe 15–30, gezielte Set-Jagd („wo droppt mein fehlendes Teil?“).

## Runde 3: Kopfgelder, Set-Jagd, Hauptfaden, Rangliste, Startwaffe (umgesetzt)
- **Kopfgelder:** Aushang in jeder Stadt (Befehl `bountyBoard`, Tag = Tagesnummer vom Client), 3 Kopfgelder je Tag für die Stufe (8–14 Kills einer Gegnerart, Gold + 10 % der Stufen-XP + 30 % Chance auf Seltenes); Abholen nur in der Stadt (`claimBounty`); `Actor.bounties/bountyDay`, gespeichert. Zufall nur über `w.fx`.
- **Set-Jagd:** Abschnitt im Aufgabenfenster für Sets, von denen man Teile besitzt (fehlende Teile + Fundorte).
- **Hauptfaden „Die Chronik der Asche“:** 6 Glieder (Stufe 15–28) über Maren, Tessa und Ruven bis zum Thron der Asche (Karte: `gen_map.py` und JSON gleich angepasst).
- **Rangliste:** Server beantwortet `{t:'board'}` mit den 10 XP-stärksten Spielern (gespeicherte + aktive); online im Erfolge-Tab.
- **Startwaffe:** Neues Spiel beginnt mit Rostschwert (Schaden 7–13 statt 4–7), nur Client, Sim und Golden-Tests unberührt.
- **Nicht gemacht:** Legendär-Droprate/Duplikate (braucht Spielerkontext im Wurf; ohne Spielgefühl nur geraten).

## Blickrichtung der Figuren (geplant, Entscheidung 2026-10-07)
Ziel: Spieler, NPCs und Monster zeigen beim Laufen die Seite (rechts/links) bzw. den Rücken (hoch/weg von der Kamera).
- **Ist-Stand:** `GameScene.ts` (~1425-1470) setzt pro Figur `view.flip` (Bildschirm-x, Spiegeln via `setFlipX`) und `view.up` (nach oben laufen) und reicht `back` an `playerCanvas`/`monsterCanvas` (`art.ts:740, 990`) weiter. Die DCSS-Sprites (`spritePlayer`, `spriteMonster`) ignorieren `back`: der Sprite-Pfad kehrt vor der prozeduralen Rückenzeichnung zurück. Rechts/links funktioniert bereits durch Spiegeln.
- **Entscheidung (User):** Keine neuen Assets. Rückenansicht = Sprite abgedunkelt und Gesicht überdeckt; Seitenansicht = Spiegeln (bleibt).
- **Umsetzung:** (1) `back` in `spritePlayer`/`spriteMonster` auswerten (eigener Cache-Key mit `b`), Abdunkeln per Multiply ~0.65, beim Spieler Gesichtsbereich der Kopfebene mit Haarfarbe (`PLAYER_HAIR`) übermalen, bei Monstern nur abdunkeln (Augen/Gesicht über Pixelmaske des oberen Spritedrittels dunkler). (2) NPCs prüfen: laufen sie (`npcWander`) über denselben Pfad `actorViews`, sonst anbinden. (3) Stehende Figur behält letzte Richtung (`view.up` nicht zurücksetzen). (4) Waffe/Schild vertauscht sich beim Spiegeln automatisch, bei Rückenansicht Waffe hinter Körper zeichnen (Ebenenreihenfolge in `spritePlayer`).
- **Nicht im Umfang:** echte 4-Richtungs-Sprites, Diagonalen als eigene Ansicht (Iso-Bewegung entlang einer Achse zählt als Seite bzw. Rücken).
- **Prüfen:** Visuell im Browser (links/rechts/hoch/runter, Spieler, ein NPC, drei Monsterfamilien), `tsc` + Tests; Golden-Tests der Sim bleiben unberührt (nur Client).

## Handy-Version (umgesetzt 2026-10-08, Entscheidung 2026-10-07)
Ziel: Spiel auf dem Smartphone im Browser spielbar, Querformat, Touch-Steuerung.
- **Entscheidungen (User):** Querformat mit Touch-Steuerung (kein Hochformat); Verteilung im Browser, lokal im WLAN (Dev-Server per `--host`), kein PWA/Hosting vorerst.
- **Ist-Stand:** `index.html` hat Viewport-Meta; `main.ts` nutzt `Phaser.Scale.RESIZE`; Klick-zum-Laufen/Angreifen läuft über `pointerdown` (`GameScene.onClick`), funktioniert damit per Tippen. Tasten (Q/E Tränke, R Rasten, C/K/J/O/N Fenster, Skill-Tasten) und die festen Desktop-Fenster (`ui.ts`, Drag-Handles) sind nicht touch-tauglich.
- **Umsetzung:** (1) Touch-Erkennung (`matchMedia('(pointer: coarse)')`), nur dann Touch-UI einblenden. (2) Bildschirmknöpfe: Tränke (Q/E), Rasten, Fenster (Inventar, Charakter, Skills, Aufgaben, Karte), Skill-Leiste mit großen Tippflächen (≥44 px). (3) Fenster auf dem Handy bildschirmfüllend, scrollbar, mit Schließen-Knopf; Rucksack: Tipp wählt Gegenstand, Aktionsleiste (anlegen/ablegen/wegwerfen) statt Drag-and-Drop. (4) `touch-action: none` auf dem Canvas, Zoom/Doppeltipp/Pull-to-refresh/Textmarkierung unterbinden, `user-select: none`. (5) Querformat-Hinweis im Hochformat („Bitte Gerät drehen“). (6) HUD (Lebens-/Manakugel, Tracker, Minikarte) an kleine Bildschirme anpassen. (7) Dev-Server mit `--host` und WLAN-URL dokumentieren.
- **Nicht im Umfang:** Hochformat-Layout, PWA/Installation, öffentliches Hosting, Gamepad.
- **Prüfen:** Browser-Pane mit `resize_window` (Preset mobile, Querformat z. B. 812×375), Tippen statt Klicken, alle Fenster erreichbar; echtes Gerät im WLAN durch den User. Sim und Golden-Tests unberührt (nur Client).

## Komfort-Paket (geplant, Entscheidung 2026-10-07)
Sechs kleine Verbesserungen, nur Client (Sim und Golden-Tests unberührt). Umsetzung nach Reset des Wochenkontingents in frischer Session.
- **Schnell aufheben:** Beim Darüberlaufen automatisch einsammeln: Gold, Tränke, Edelsteine, Pfeile. Ausrüstung bleibt liegen (Rucksack nicht vollmüllen). In den Einstellungen abschaltbar. Prüfen, dass Gewichtsgrenze und volle Rucksäcke eine klare Meldung geben statt stillem Fehlschlag.
- **Einstellungen:** Neues Fenster (Taste und Knopf): Lautstärke, Schadenszahlen an/aus, Namenslabels an/aus, Schnell aufheben an/aus. Speicherung in `localStorage` (try/catch). Wirkt sofort.
- **Tastenbelegung:** Im Einstellungsfenster eigene Tasten für Tränke (Q/E), Rasten (R), Fenster (C/K/J/O/N/I) und Skills; Konflikte erkennen, „Zurücksetzen“. Tastenabfrage in `GameScene.ts` (`typingInField` beachten) auf eine zentrale Belegungstabelle umstellen.
- **Rucksack:** Knopf „Sortieren“ (Slot, Seltenheit, Wert) und Filter (Waffen, Rüstung, Tränke, Sonstiges). Nicht gewählt: „Graues verkaufen“ und Verkaufs-Warnung.
- **Tag und Nacht:** Nur Optik: Lichtstimmung über die Tageszeit (Dämmerung, Nacht, Morgen), Laternen und Fensterlicht nachts heller, Vignette anpassen (`vignette` in `GameScene.ts`). Kein Einfluss auf Monster, Schaden oder Sim; Zeit aus der Echtzeit/Tick-Anzahl, ohne `w.rng`.
- **Spielstand:** Export und Import als Datei (JSON), sichtbarer „Gespeichert“-Hinweis beim Autospeichern, 2–3 Speicherplätze (Auswahl beim Start). Bestehenden Stand (`SAVE_KEY`) in Slot 1 übernehmen, Backup `.backup` beibehalten; Import prüfen (Version, Form) und nie ohne Rückfrage überschreiben.
- **Prüfen:** tsc, Tests, Lint; im Browser Einstellungen und Tastenbelegung durchklicken, Export/Import mit einem Stand, Tag/Nacht über Zeitraffer prüfen.

### Umsetzungsstand Komfort-Paket (2026-10-08)
- **Umgesetzt:** `src/render/settings.ts` (Einstellungen + Tastenbelegung, `localStorage` `aschenthron.settings`), neuer Reiter "Einstellungen" (Taste P) in `ui.ts` (`renderSettings`): Lautstärke (`Sfx.setVolume`), Schadenszahlen, Namen, Schnell aufheben, Tastenbelegung mit Konflikt-Prüfung und Zurücksetzen, 3 Speicherplätze (`GameScene.slotList/switchSlot`, Platz 1 = alter Schlüssel `aschenthron.save.v1`), Export/Import bleibt unten im Reiter. Rucksack: Filter (Alle/Waffen/Rüstung/Tränke/Sonstiges) und Sortierung (aus/Art/Seltenheit/Wert) nur als Ansicht. Schnell aufheben: `GameScene.autoPickup` (Tränke, Edelsteine, Pfeile in 1,6 Feldern, jede Beute höchstens alle 6 s erneut). "Gespeichert"-Hinweis (`Ui.savedHint`) höchstens alle 30 s.
- **Schon vorhanden, nicht neu gebaut:** Tag und Nacht (`atmosphere.ts`: Tageszeit, Wetter, Licht), Export/Import als Datei und Code.
- **Nicht gemacht:** Speicherplatz-Auswahl im Titelbild (nur im Einstellungs-Reiter), Skill-Tasten über 1-9 hinaus.

## Abwechslung statt Grind (geplant, Entscheidung 2026-10-08, noch NICHT umgesetzt)
Anlass: „Es ist langweilig: ich renne durch die Aufgaben immer zu denselben Monstern, zu viel Grind, und ich weiß nicht wofür.“
Schmerzpunkte (User): gleiche Gegner wiederholen · kein Warum · nur Laufen und Hauen. Großes Ziel: **Beute-/Build-Jagd** (Diablo-Gefühl). Umsetzung in frischer Session mit dieser Spezifikation.

**Ist-Stand:** 17 Aufgaben in `QUESTS` (`data.ts`), Arten `kill|chest|champion|unique|visit|bring|talk`; dazu Kopfgelder, Hauptfaden „Chronik der Asche“, Set-Jagd, Mit-Jagen, `nextStep` (siehe oben). Kill-Aufgaben verlangen 8–10 Stück einer Art.

**1. Weniger Grind**
- Kill-Zahlen in `QUESTS` und Kopfgeldern auf **3–5** kürzen (Kopfgeld bisher 8–14); XP/Gold je Aufgabe nicht senken, sondern auf die Aufgabenanzahl umlegen. Pace-Lauf (`pace.sim.ts`, vitest.pace.config.ts) danach prüfen: Spielzeit bis Stufe 30 soll nicht einbrechen, also dafür mehr Aufgaben/Ereignisse als XP-Quelle.
- Gemischte Ziele statt einer Art: Aufgaben mit 2 Gegnerarten oder „Anführer des Rudels“ (`champion`/Rudel-Leader) statt Massenkill.

**2. Neue Aufgabentypen (neue `QuestKind`)**
- **`camp` Lager erobern:** Karte markiert Lager (Region + Rudel dort, z. B. Goblinlager, Banditenlager). Aufgabe fertig, wenn alle Monster der Region tot sind; danach respawnt das Lager nicht mehr (oder erst viel später) und eine Lagertruhe erscheint. Braucht: Regionsliste je Lager in `gen_map.py`, Zähler „Region geräumt“ in der Sim, Speicherung im Spielstand (`save.ts`, Version erhöhen).
- **`find` Suchen & Entscheiden:** Fundstücke/Orte in der Welt (Objekt im Tiled-Layer, Tippen/E zum Untersuchen), Rätsel-Truhen, und Aufgaben mit **zwei Lösungen** (z. B. Schmuggler laufen lassen oder verraten) mit unterschiedlicher Belohnung (Gold vs. Gegenstand). Entscheidung wird im Spielstand gemerkt.
- **Zufallsereignisse:** unterwegs seltene Auslöser (nur über `w.fx`, nie `w.rng`): Hinterhalt (Rudel taucht auf), wandernder Elite-Boss mit Beute, Notruf eines NPCs (kurze Aufgabe), fahrender Händler mit seltener Ware. Cooldown, nie in Städten oder auf Stufe-1-Gebiet.

**3. Das Warum: Beute-/Build-Jagd**
- Jede Aufgabe/jedes Lager nennt im Text **was es dort zu holen gibt** (Set-Teil, Legendär, Skill-Punkt-Wendepunkt) und die Karte/der Tracker zeigt es („Lager Rotfang: Set Wolfsjäger Teil 2/5 möglich“).
- Lager und Elite-Orte bekommen feste Beutetabellen (Sets/Legendäre pro Gebiet), Abgabe-Belohnung ist ein **wählbarer Gegenstand** (3 zur Auswahl) statt reinem Gold/XP.
- Build-Wendepunkte: bei bestimmten Stufen ein klarer Anlass (neue Passive/Spezialisierung, siehe Meisterschaft Lvl 20), im Hauptfaden als Kapitelbelohnung.

**Reihenfolge (jeweils mit Tests, Pace-Lauf, Golden-Tests unberührt halten):** (a) Kill-Zahlen kürzen + Beutehinweise im Text, (b) `camp`, (c) wählbare Belohnung, (d) Zufallsereignisse, (e) `find` mit Entscheidungen.
**Offen/Annahmen:** Anzahl Lager (Vorschlag 1 je Gebiet, 6–8 gesamt); ob geräumte Lager je Spielstand dauerhaft bleiben; Server/Mehrspieler zählt Lagerzustand pro Spieler (Vorschlag: ja, in `Actor`).

### Umsetzungsstand „Abwechslung statt Grind“ (2026-10-08)
- **Umgesetzt:** (a) Kill-Zahlen halbiert (XP/Gold je Aufgabe bleiben), Kopfgelder 4–7; (b) **Lager** (`camp`): 7 Lager (`CAMPS` in `gen_map.py`, Karte: Objekt `camp` + Besatzung mit `camp=<id>` + verschlossene Lagertruhe), Sim `World.camps`, `Actor.campId`, `campClearedBy`, 30 min Ruhe (`CAMP_RESPAWN_TICKS`), 7 Lageraufgaben `q_camp_*`; (c) **Belohnung zur Wahl**: `questRewardChoices(def)` (3 feste Stücke je Aufgabe, eigener Zufallsstrom), Befehl `turnInQuest.pick`, Auswahl im Aufgabenfenster, Vorschau „Zu holen“; (d) **Zufallsereignisse** (`wildEvents`, nur Einzelspieler): nach ~90 Feldern Weg draußen Hinterhalt / wandernder Anführer / verlorene Fracht, 2 min Abklingzeit; (e) **Suchen & Entscheiden** (`find`): Fundstücke (Karte: Objekt `find`, Funkeln im Spiel), `QuestDef.choices` (zwei Wege mit eigenem Gold/XP/Gegenstand), Aufgaben `q_find_cargo`, `q_find_smuggler`.
- **Nicht umgesetzt:** fahrender Händler (NPC müsste zur Laufzeit erscheinen/verschwinden), Lagerzustand im Mehrspieler (Server kennt `camps/finds` nicht im Snapshot), feste Beutetabellen je Lager (Beute kommt aus Standard-Truhen/Quest-Wahl), Aschengrund bleibt als Elite-Zone dicht (nicht ausgedünnt).
- **Messung:** Pace-Lauf des Bots jetzt 10,9 h bis Stufe 30 (vorher 8,4 h): Bot macht nur Kills, langsamere Respawns und weniger/vereinzelte Monster bremsen ihn; echte Spieler bekommen zusätzlich XP aus Lagern, Suchen, Ereignissen.

## Attribut-Anforderungen für Waffen, Zauber und Skills (geplant, Entscheidung 2026-10-08, noch NICHT umgesetzt)
Auftrag: Waffen, Zauber und Skills sollen Attribute als Anforderung haben wie in T4C. Entscheidungen des Users: **hart** (ohne die Werte nicht benutzbar bzw. nicht lernbar), Zuordnung **klassisch**; Rangfrage vom User nicht verstanden → Standard gewählt: **pro Rang steigend** (siehe unten). Umsetzung in frischer Session mit dieser Spezifikation.

**Ist-Stand:** Gegenstände haben `Req {level, kraft, gewandtheit, ausdauer, verstand, willenskraft}` (`items.ts`: `reqOfTemplate`, `itemReq`; Prüfung `missingReq` in `world.ts`; Anzeige im Tooltip). Waffen/Rüstung: nur `reqKraft` plus abgeleitet Gewandtheit (Waffen ≥ Kraft 14: 40 %) bzw. Ausdauer (Rüstung: 55 %). Skills/Zauber (`SkillDef` in `data.ts`, 41 Stück) haben nur `levelReq` und Rang-Stufenanforderung `rankLevelReq`; keine Attribute.

**1. Waffen (klassisch):**
- Nahkampf (Schwert/Axt/Keule): Kraft wie bisher; leichte/schnelle Waffen zusätzlich Gewandtheit; Zweihänder deutlich mehr Kraft.
- Bögen: Gewandtheit (kein Kraftwert nötig außer kleiner Zugkraft, ca. 30 % der Gewandtheitsforderung).
- Stäbe: Verstand (Hauptwert), Willenskraft als Nebenwert.
- `req` je Vorlage in `TEMPLATES` explizit setzen statt nur abzuleiten (Tabelle im Code, Werte an `minLevel` koppeln: Hauptattribut ≈ 8 + 1,4 × Stufe, Nebenattribut ≈ 40 % davon); Tooltip zeigt fehlende Werte rot (existiert).
- **Hart:** Waffe, deren Anforderung nicht erfüllt ist, lässt sich nicht anlegen (Anlegen scheitert mit Meldung; `missingReq` schon vorhanden, prüfen ob Anlegen es erzwingt).

**2. Skills und Zauber (klassisch, Feld `req?: Partial<Record<AttrKey, number>>` an `SkillDef`):**
- Nahkampf: Kraft (Wirbelhieb, Schädelspalter, Titanenhieb …), Parieren/Schildbeherrschung: Gewandtheit bzw. Ausdauer.
- Fernkampf: Gewandtheit; Giftpfeil/Giftregen zusätzlich Verstand klein.
- Magie: Verstand für Schadenszauber (Feuer/Frost/Blitz …); Willenskraft für Heilung, Schutz, Läuterung, Entzaubern, Fluch, Verstummen.
- Überleben: Ausdauer (Erste Hilfe, Überleben), Gewandtheit (Schleichen).
- Höhe: Hauptattribut ≈ 6 + 1,3 × `levelReq` (Stufe 30 → ca. 45), Nebenattribut ≈ 40 %.
- **Hart:** Lernen beim Lehrer (`learnSkill`) und Rang-Erhöhung (`rankUp`) scheitern, wenn die Anforderung fehlt. **Pro Rang steigend:** Rang 1 braucht den Grundwert, jeder weitere Rang +10 % (wie `rankLevelReq` die Stufe erhöht).
- Bereits gelernte Skills in alten Spielständen bleiben nutzbar (Bestandsschutz), nur neues Lernen/Hochstufen prüft.
- UI: Skill-Karte beim Lehrer und in der Fertigkeiten-Liste zeigt Anforderung (rot, was fehlt), Sperrgrund bei Klick.

**3. Folgen für Balance/Tests:** `skills.golden.test.ts` und Build-Tests (`build.ts`, `builds.bench.test.ts`) prüfen, ob die Bot-Builds die Anforderungen mit ihren Punkten erfüllen (Attributpunktverteilung im Pace-Bot `pace.sim.ts` anpassen, sonst bricht der Lauf); Respec bleibt kostenlos wie bisher. Neuer Test: je Skill/Waffe Anforderung erreichbar, Lernen scheitert mit Mangel, klappt mit genügend Punkten.

**Reihenfolge:** (a) `req` an Waffenvorlagen + Anlegen erzwingen, (b) `SkillDef.req` + Prüfung in `learnSkill`/`rankUp` + Meldungen, (c) UI-Anzeige, (d) Pace-Bot und Tests anpassen, Pace-Lauf messen.
**Offen:** Genaue Zahlen je Skill (Tabelle im Code), ob Attributpunkte pro Stufe (heute 5?) für hartes System reichen (Pace-Lauf entscheidet).

### Änderung 2026-10-08 (ersetzt die Rang-Regeln oben): D4O-Art, aktive Zauber ohne Rang
User: „Wie in D4O kein Rang für Zauber, lieber mehr Zauber; neue Zauber desselben Elements sollen nach und nach kommen, damit man sich aufs Leveln freut; sie brauchen höhere Attribute. Passive Skills dürfen mit Rängen gelevelt werden.“
- **Aktive Zauber und Kampf-Skills: kein Rang.** Stärke kommt aus Spielerstufe, Attribut (Verstand/Kraft/Gewandtheit), Items und Passiven, nicht aus einem Rang. `skillRanks`/`rankLevelReq`/`MAX_SKILL_RANK` gelten nur noch für Passive (`passive: true`, wie heute bis Rang 5).
- **Mehr aktive Zauber, dicht gestaffelt:** pro Element eine Reihe mit einem neuen Zauber etwa alle 3–4 Stufen, jeder mit eigener Rolle (nicht nur mehr Schaden): z. B. Feuer: Glutblitz (3) → Flammenpfeil (7) → Feuerball (16) → Brandmal/Flächenbrand (20) → Feuersturm (21) → Meteor (26) …; Frost: Frostsplitter (5) → Frostnova (11) → Eislanze (17) → Eiswand/Verlangsamung (21) → Gletscherbruch (25); Blitz: Funke (9) → Kettenblitz (14) → Blitzschlag (22) → Sturmruf (28); Gift/Dunkel/Heilung ähnlich. Zahl der aktiven Zauber von heute ~26 auf etwa 40–45, jede Stufe mindestens ein neues Spielzeug (Lehrer-Angebot, Tabelle `SKILLS` in `data.ts`, Namen/Beschreibungen/Symbole mit `info`-Feld wegen `skills.stage6.test.ts`).
- **Attributanforderung je Zauber** (`SkillDef.req`), steigend entlang der Reihe: Schadenszauber Verstand ≈ 6 + 1,3 × `levelReq` (Neben: Willenskraft 40 %), Heil/Schutz Willenskraft, Nahkampf Kraft, Fernkampf Gewandtheit, Überleben Ausdauer. Heißt: wer neue Zauber will, muss beim Stufenaufstieg Punkte in das passende Attribut stecken (Build-Entscheidung).
- **Lernen:** aktive Zauber kosten Gold beim Lehrer, erfordern Stufe + Attribute, aber **keine Skillpunkte**. Skillpunkte (`skillPoints`) gehen nur noch in Passive (Ränge); Anforderung der Passiven steigt je Rang (+10 %).
- **Altspielstände:** Ränge aktiver Skills werden eingeschmolzen, die investierten Skillpunkte zurückgegeben (Kostenloses Neuverteilen `freeRespec` existiert), gelernte aktive Zauber bleiben (Bestandsschutz bei fehlenden Attributen: benutzbar bis zum nächsten Respec).
- **Balance:** Schaden aktiver Zauber, die bisher mit Rang skalierten, wird auf Stufe/Attribut umgestellt (`skills.golden.test.ts` und Snapshots neu festlegen, bewusst); Pace-Lauf misst danach.
- **Reihenfolge:** (a) Datenmodell: `req`, Rang nur für Passive, Migration `save.ts`; (b) Prüfung beim Lernen/Anlegen + UI-Anzeige; (c) neue Zauber je Element (zuerst Feuer und Frost, dann Blitz, Gift/Dunkel, Heilung, Nahkampf, Fernkampf); (d) Pace-Bot, Tests, Balance.

### Umsetzungsstand „Attribut-Anforderungen / Zauber ohne Rang“ (2026-10-08)
- **Umgesetzt:** Aktive Skills ohne Rang (`skillRankOf`, `ACTIVE_POWER` 1,3 gleicht den Rangbonus aus); Lernen verlangt Stufe + Hauptattribut (`skillReq`, `skillMainAttr`, `missingSkillReq` in `data.ts`/`world.ts`), Gold, aber keine Skillpunkte; Passive behalten Ränge (Anforderung +10 % je Rang) und kosten Punkte; Altspielstand-Migration in `save.ts`; 24 neue aktive Skills (Feuer: Flammenpfeil, Glutregen, Brandmal, Phönixstoß; Frost: Frostsplitter, Eiszacken, Eisnebel, Winterzorn; Blitz: Funke, Kettenblitz, Sturmruf; Gift: Seuchenhauch, Verfall; Nahkampf: Beinfeger, Spaltschlag, Berserkerhieb, Erdspalter; Fernkampf: Beinschuss, Explosivpfeil, Durchschlagsschuss, Schattenpfeil; Heilung (Willenskraft): Wunden schließen, Große Heilung, Heiliger Segen), jede Stufe 1–30 bringt mindestens einen neuen aktiven Skill; frei belegbare Schnellleiste (`hotbar.ts`, 9 Plätze, Auswahl im Fertigkeiten-Fenster, neue Zauber landen im ersten freien Platz); Waffen: Dolche verlangen mehr Gewandtheit, Stäbe zusätzlich Willenskraft (Bögen/Stäbe/Kraft waren schon hart über `missingReq`).
- **Abweichung vom Plan:** Nur ein Hauptattribut je Skill (kein Nebenattribut); keine eigenen Icons für neue Zauber (es sind nur 4 Zauber-Icons im Repo, neue Zauber nutzen die Standard-Zeichnung; echte Icons brauchen einen Download und damit deine Freigabe).
- **Offen:** Balance im Spiel prüfen (Zauberschaden `ACTIVE_POWER`, Manakosten, Preise der neuen Zauber), Pace-Messung, Icons, Nebenattribute, neue Zauber für Überleben/Schutz.

## Waffen kaufen, Boss-Waffen jagen (umgesetzt 2026-10-08)
- Händler (`SHOPS.basic`/`advanced` in `data.ts`) verkaufen Nahkampf-, Fernkampf- und Stabwaffen für jede Stufe bis 26; Waffen ab Stufe 11 kosten ×1,6 (`buyPrice`).
- Normale Monster haben nur noch 12 % Chance, dass Waffen im Drop-Pool sind (`rollDrop(..., weaponShare)`, `WEAPON_SHARE_MONSTER`); Champions 40 %, Truhen 35 %, Bosse 60 %. Rüstung, Schmuck, Tränke unverändert.
- 24 feste Boss-/Mini-Boss-Waffen (`LEGENDARIES` mit `source`): jeder Boss, jeder Mini-Boss und die drei Weltbosse; `rollSpecial` bekommt die Mini-Boss-Kennung (55 % Chance je Kill); Übersicht „Boss-Waffen“ im Aufgabenfenster (J) unter der Set-Jagd.
- Offen: Balance (Preise im Verhältnis zum Goldfluss), eigene Icons, Spezialwaffen für Fern-/Stabbuilds in niedrigen Stufen prüfen.

## Neuer Look („Schmiede-Bild“, Stand 2026-10-09, Plan; noch NICHT umgesetzt)
- **Ziel:** Welt + Figuren + HUD im Stil des Referenzbildes (hell, bunt, warm, detailreiche Pixel-Art, Dorf/Schmiede, Zäune, Felder, Tiere; HUD mit Porträt, Leisten, Hotbar, Diablo-Tooltips mit Großbuchstaben-Pixelschrift).
- **Ist-Stand:** Spiel ist schon isometrisch (64x32, `iso.ts`) mit Fachwerk/Ziegel, aber dunkel/nächtlich; HUD mit Kugeln unten. Lücken: Palette (heller, gesättigter), Props (Zäune, Fässer, Amboss, Weizen, Tiere), HUD, Pixelschrift.
- **Entscheidung (mit Advisor):** Figuren bleiben DCSS (einzige vollständige, CC0, frontale Quelle), dazu ein gemeinsamer Render-Look: ganzzahliges Hochskalieren (Nearest), 1-px dunkle Kontur, mehr Sättigung/Wärme, Bodenschatten, grüner Auswahlring wie im Bild. Kein Mischen mehrerer Künstler/CC-BY-Packs.
- **Verworfen (nicht erneut laden):** Isometric medieval buildings 2 (42 MB, 3D-Renders, Stilbruch); Screaming-Brain Town Pack (Fototextur-Renders, keine Pixel-Art); Hormelz 8-Directional (ein Modell, 256 px HD); willYEE Dark Fantasy (Side-Scroller, nur Profil); Village Builder (nur 7 Bilder, gedämpfte Palette; höchstens Stilreferenz).
- **Offen/geprüft:** [crabcrabcrabs Medieval Tiles](https://crabcrabcrabs.itch.io/isometric-strategy-medieval-pixel-art-tiles) (64x64, 219 kB, bunt, Weizenfeld mit Zaun, Mühle, Turm) passt zum Raster 64x32, aber **Lizenz fehlt auf der Seite**; unter „More information“ nachsehen, sonst nur Stilreferenz.
- **HUD:** [Mana Soul GUI](https://opengameart.org/content/tiny-rpg-mana-soul-gui) (CC0, im Scratchpad geladen) umfärben (Violett → Anthrazit/Gold). Pixelschrift: gezielt suchen (meist OFL, Lizenz + Download vom User freigeben lassen).
- **Reihenfolge:** 1) HUD (Mana Soul + Pixelschrift, Tooltips per CSS in `ui.ts`), 2) Welt: Palette/Tageslicht (`atmosphere.ts`), prozedurale Props in `art.ts`/`town.ts`, 3) DCSS-Figurenbehandlung (`sprites.ts`). Umsetzung in frischer Session.
- **Kamerawinkel (User-Vorgabe, wichtig):** Referenzbild ist **schräge Draufsicht, achsenparallel** (Zäune/Wege horizontal und vertikal, Häuser von vorn oben), NICHT 2:1-Isometrie mit Rauten. Umbau der Projektion nötig: `iso.ts` (`toScreen`/`toTile`, TILE_W/H) plus Nutzung in `GameScene.ts` (31 Stellen), `art.ts` (26), `town.ts` (17); Sim/Server unberührt (Raster bleibt). Gelände, Häuser, Props müssen für die neue Ansicht neu gezeichnet werden (isometrische Packs entfallen; DCSS-Frontsprites passen dazu besser). Tiefensortierung, Klick-Picking, Minimap prüfen.
- **Neue Richtung (2026-10-09, User: CC0/CC-BY ist okay):** [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) (pixel-boy, **CC0**, 16x16, schräge Draufsicht): 50+ Figuren, 30+ Monster, 9 Bosse, Tiere, Items, Gelände/Häuser/Zäune/Marktstände, UI-Theme (Holz), 2 Schriften, FX. Liegt entpackt in `~/Downloads/Ninja Adventure - Asset Pack`, Probe unter `public/probe/` (uncommittet, Kopien in `public/probe/na/`). Alternativen laut Haiku-Recherche: Kenney Tiny Town (CC0, 16x16, nüchtern), Pixel Frog Tiny Swords (nicht weitergabefähig, nur nutzbar, 64x64, Gegner-Pack kostenpflichtig), Cainos Top Down Basic (nicht weitergabefähig). Weiter offen: Probe-Urteil des Users abwarten, dann Projektion in `iso.ts` auf Draufsicht umstellen und alle Sprites tauschen (Monster-/Item-Zuordnung in `spriteMap.ts` neu).

## Umsetzungsplan „Neuer Look“ (vom User freigegeben 2026-10-09; Umsetzung in frischer Session)
- **Entscheidung:** Basis = Ninja Adventure (CC0, 16x16, schräge Draufsicht, ~3x skaliert). Sichtbare Ausrüstung ist dem User wichtig, sonst „passt alles“.
- **Ausrüstungs-Ebenen (Held):** Ninja-Figuren sind feste 16x16-Sprites (Sheet 64x112 = 4 Spalten x 7 Zeilen; Zeilen 0-3 Gehen runter/hoch/links/rechts, weitere Angriff/Sprung). Held = nacktes Basissprite plus Ebenen: Körper (Rüstung als Farbtausch der Rumpf-Pixel nach Material/Stufe), Kopf (Helm-Overlay, wenige Pixel), Schild, Umhang (hinter dem Körper), Stiefel/Handschuhe als Farbtausch, Waffe aus `Items/Weapons` (Schwert, Axt, Hammer, Bogen, Stab, Wand, Lance, Rapier …) an der Hand je Blickrichtung. Pro Item-Stufe/Seltenheit Farbe und evtl. Glanz. Erst per Probe an Knight/NinjaGreen prüfen, wie lesbar das in 16 px ist.
- **Reihenfolge:** 0) Ausrüstungs-Probe (Entscheidungspunkt); 1) Projektion `iso.ts` auf Draufsicht (`toScreen`/`toTile`, Tiefensortierung, Picking, Minimap) und Gelände aus Tilesets (Autotile Boden/Wasser/Relief); 2) Städte/NPCs/Props (`town.ts`, `art.ts`) aus TilesetHouse/Element/Nature; 3) Monster/Tiere/Bosse in `spriteMap.ts` neu zuordnen (85 Arten, Tönung/Größe wie bisher); 4) Held mit Ausrüstungs-Ebenen; 5) HUD/Fenster mit Theme Wood + Pack-Schrift (`ui.ts`), Item-Icons bleiben DCSS (Pack hat zu wenige Rüstungs-/Schmuck-Icons); 6) FX (Zauber, Treffer) aus `FX/`; 7) ASSETS.md + Credits (F1) ergänzen, `public/probe` entfernen.
- **Bekannte Abstriche:** Ton wird bunter/weicher (Monster teils niedlich, kein klassisches Goblin/Ork/Untoten-Set; Skelett/Schädel, Schleim, Schlange, Spinne, Drache, Geist vorhanden); Ausrüstung am Helden einfacher als bisher (DCSS-Ebenen).
- **Prüfung je Schritt:** tsc, Lint, Tests, Build, im Browser ansehen; Golden-Snapshots der Sim bleiben unberührt (nur Darstellung).
- **Ergebnis Ausrüstungs-Probe (2026-10-09, `public/probe/equip/index.html`):** Ninja-Figuren sind ~10 von 16 Pixelzeilen Kopf, Körper nur 3-4 Zeilen. Probe mit 4 Stufen (Leder/Eisen/Gold/Arkan): Helm-Overlay (Kuppel + Federbusch), Rumpf-Farbtausch, Schulterplatten, Schild, Waffe aus `SpriteInHand.png` (Pack-Ordner `Items/Weapons/<Name>/`) ist auf einen Blick unterscheidbar, aber gröber als DCSS. Verbesserungen für die echte Umsetzung: Helm-Formen pro Typ (Kappe, Topfhelm, Kronenhelm, Haube), Haare unter dem Helm abdecken, Rückansicht/Seitenansicht (Zeilen 1-3 des Sheets) und Gehen-Frames mit demselben Overlay mitbewegen.

## Richtung (2026-11-03, vom Nutzer entschieden)
**Problem:** Sechs Runden Umgestaltung nur der Optik, ohne feste Richtung. Figuren-Mix (Ninja + DCSS, Pixelgröße 2x–5x), zu bunte Stimmung, HUD und flacher Kampf stören.
- **Look:** DCSS durchgehend, dunkel (Dark Fantasy passend zur Story). Ninja Adventure bleibt nur für Boden/Häuser/HUD-Rahmen, Stadt und Palette dunkler tönen. Ein Pixelmaßstab für alle Figuren. Standard `?figuren=dcss`.
- **Spaßsäulen (alle vier):** (1) Trefferfeeling: Wucht bei Hieb/Pfeil/Zauber (Funken, Wackeln, Zahlen). (2) Loot-Jagd: Lichtstrahl/Glanz nach Seltenheit. (3) Fortschritt: spürbares Level-up und Skillgewinn. (4) Erkunden: gefährliche Orte, Bosse, Atmosphäre.
- **HUD:** Minimap kleiner, Willkommenstext in gerahmtes Fenster, Leisten nah an die Hotbar, einheitliche Pixelschrift auch im Titelbild.
- **pixelfx (patch-gg, geprüft APPROVE):** erst nach dem Look-Umbau als Projekt-Skill, Palette dunkel/passend zur Rarität.
- **Status Figuren (2026-11-04, Commits 6549b67, aa876be, a8d1a12, 160cc8b):** Held mit kompletter Ausrüstung am Skelett und allen Posen (Stehen, Laufschritt ohne Gleiten, Angriff je Waffe inkl. Bogen/Stab, Getroffen, Sterben); alle 63 Monsterarten als Skelett-Figuren (Zweibeiner über den Rig-Remix mit Körperbau je Art, Tiere über `monsterRig.js`), Bosse per Proportion größer mit goldener Kontur; NPCs als Skelett-Menschen nach Rolle; Backen in Web Workern, Cache begrenzt; Standard-Modus `skelett`, DCSS nur Rückfall (`?figuren=dcss`, `?held=dcss`). Offen: Held im Worker backen, Golem/Spinne/Wurm nachschärfen (Details in HANDOFF „Figuren-Umbau“).
- **Erster Schnitt (frische Session):** Standard auf DCSS + einheitliche Skalierung, Stadt dunkler tönen, HUD-Fixes, dann 3 Effekte: Treffer, Loot-Strahl, Level-up.

## Status der Richtung (Stand 2026-11-03, Abend)
**Erledigt (Commits 80e8193, 6aa331e, ea8b52d, c273b24; tsc, Lint, 311 Tests grün):**
- [x] Figuren-Standard DCSS, ein Pixelmaßstab (Bosse 2x); Ninja nur noch Boden/Häuser/HUD (`?figuren=mix|ninja` zum Vergleich)
- [x] Dunklere Stimmung über `DARK_GRADE`/`TOWN_LIFT` in `atmosphere.ts`
- [x] HUD: kleine Minimap, gerahmtes Willkommensfenster, Leisten an der Hotbar, Pixelschrift im Titelbild
- [x] pixelfx als Projekt-Skill + `tools/pixelfx`; Effekte Treffer, Krit, Loot-Strahl nach Seltenheit, Level-up

**Offen:**
- [x] Treffer-/Krit-Effekt im echten Kampf geprüft, Krit als kompakter Remix (136x92)
- [x] Loot-Strahl: kürzer, schmal, Kern farbig, Phase je Beute versetzt
- [x] Kamerablitze durch gedämpften `glow()` ersetzt
- [x] Stadtboden/Häuser zentral entsättigt (`NINJA_GRADE`)
- [x] Heldenporträt = Brustbild des DCSS-Helden
- [x] Säule 1 Wucht: Zauber-Effekte aus pixelfx (Blitz, Frostnova, Wirbelhieb, Bodenschlag, Heilung); Wackeln/Zahlen gab es schon; Feuerball-Einschlag `fire_burst`
- [x] Säule 3 Skillgewinn: Runenkreis, Banner, Schnellleisten-Platz pulsiert
- [x] Säule 4 (Darstellung): Boss-Aura, Boss-Auftritt, Gefahr-Warnung + rote Vignette
- [x] Sheets verkleinert (15/20 fps): Level-up 0,5 MB, 15 Effekte zusammen 4,2 MB
- [ ] Ungeprüft: Handy, Nacht/Regen mit neuem Look, Händler-/Truhenfenster

## Probe: Held-Gang mit pixelfx-Skelett (2026-11-03, vom Nutzer gewählt)
**Problem:** Der Held (DCSS, ein Standbild) „geht komisch“: `art.ts` täuscht das Gehen vor, indem das ganze Bild um ±4° kippt und der Teil unter der Hüfte seitlich versetzt wird (`FRAME_STEP_L/R`, `WALK_FRAMES` in `GameScene.ts`, `STEP_MS` 110).
- **Entscheidung:** Erst eine **Probe**, keine Umstellung im Spiel. Probeseite `public/probe/gang/index.html` (Ordner `public/probe` ist ignoriert): pixelfx-Skelett (`tools/pixelfx/src/core/rig.js`, `poses.js`, Standardfigur 24x38) in DCSS-naher dunkler Palette, Laufzyklus in 4 Richtungen (rechts, links per Spiegeln, zur Kamera, vom Betrachter weg über `yaw`), Pixelmaßstab 2x, daneben der jetzige DCSS-Held mit seinem Gang zum Vergleich, beide auf einem Stück Stadtboden.
- **Danach entscheidet der Nutzer:** Skelett-Held übernehmen (dann Ausrüstung als Ebenen neu planen) oder DCSS-Gang verbessern (Federn, Beine versetzt, Arme, kein Kippen).
- **Bekannte Risiken:** anderer Stil als DCSS-Monster; sichtbare Ausrüstung müsste für das Skelett neu gebaut werden; pixelfx verbietet das Nachbauen fremder Spielfiguren (nur generische Motive).

## Neue Richtung: eigene Figuren und Welt per Code (2026-11-03, vom Nutzer entschieden)
**Ergebnis der Gang-Probe:** Der Nutzer will die pixelfx-Skelettfigur (`tools/pixelfx/src/core/rig.js`, Probe `public/probe/gang/`, Backskript `scripts/bake-walk.mjs`) als Held und passt lieber alles andere an. Ersetzt die Richtung „DCSS durchgehend“ (Abschnitt oben) schrittweise.
- **Reihenfolge:** (1) **Held zuerst ins Spiel**, (2) Monster, (3) Welt. Monster und Welt bleiben bis zu ihrem Schritt wie sie sind.
- **Held (alle drei wichtig):** sichtbare Ausrüstung je Item/Seltenheit (Helm, Rüstung, Schild, Umhang, Waffe) als Ebenen am Skelett; flüssige Bewegung mit echten Posen (Stehen, Gehen, Angriff Schwert/Bogen/Stab, Getroffen, Sterben) in 4 Richtungen (rechts, links gespiegelt, zur Kamera, weg); gedrungener, kräftiger Look (größerer Kopf, kräftige Umrisslinie), lesbar bei Pixelmaßstab 2x. Gebacken zu Sheets je Look (Cache wie `lookKey`), nicht live pro Frame.
- **Monster:** eigene Skelette je Familie. Humanoide (Goblins, Banditen, Untote, Ritter, Troll) = pixelfx-Skelett mit anderen Proportionen/Farben; Tiere (Ratte, Wolf, Spinne, Wurm, Golem, Elementar) bekommen eigene kleine Skelette im selben Stil. Bosse größer per Proportion, nicht per krummer Skalierung.
- **Welt:** komplett per Code gezeichnet im selben Pixelstil (Boden mit Übergängen, Häuser, Bäume, Felsen, Zäune, Wasser), dunkle Palette; Ninja-Kacheln fallen am Ende weg (HUD-Rahmen ggf. später).
- **Status Welt (2026-11-04, Commits c4287d6 … bd9c7c8):** umgesetzt. Boden, Übergänge, Ufer, Lava, Details, Wände/Klippen/Gruft, Bäume, Felsen, Gräber, Stadt-Props, Häuser mit Fensterlicht und Minimap per Code (`src/render/world/*`, `houses.ts`), Pixelmaßstab 2, Ninja-Tilesets nicht mehr geladen (HUD-Rahmen und Schrift bleiben). Mängel und nächster Schritt siehe HANDOFF „Welt-Umbau“.
- **Regeln:** ein ganzzahliger Pixelmaßstab (2x) für alles; keine fremden Spielfiguren nachbauen (pixelfx-Regel); Simulation/Golden-Snapshots unberührt; Prüfung je Schritt: tsc, Lint, Tests, Build, Browser; Commits pro verifiziertem Schritt auf `neuer-look`, nicht pushen; pixelfx-Skill in der Session laden (Session im Ordner `Spiele/Aschenthron` starten).
- **Status (2026-11-03, Commits 3d80322, 3d3af84, 2d3e55a):** Erster Schnitt umgesetzt. Rig-Remix `src/render/heroRig.js` (MIT-Kopf, gedrungen: Beine 12,4 statt 16,9 px, Schultern breiter, Kopf größer, Teilnummer je Pixel), Posen/Material/Bäcker `src/render/hero.ts` (Stehen 4, Gehen 8, Angriff 6 Bilder; Seite/vorn/hinten, links gespiegelt; Tuch/Leder/Eisen mit Helm, Schulterplatten, Wappenrock; Kurzschwert, Bogen und Stab als Platzhalter), Laufzeit-Backen je Look `src/render/heroSheet.ts`, Schalter `?held=skelett|dcss`, Porträt/Inventarfigur. Offen: Schild, Umhang, Robe als Form, Seltenheitsakzente, Getroffen/Sterben, echte Bogen-/Stab-Angriffe, dann Monster-Skelette.
- **Erster Schnitt (frische Session):** Held-Rig gedrungen umbauen, Gehen + Stehen + ein Angriff in 4 Richtungen, eine Rüstungsstufe und eine Waffe als Ebenen, im Spiel statt `playerCanvas` (Schalter `?held=skelett|dcss`, Standard skelett), Porträt aus dem neuen Helden.

## Plan: T4C-Charme (2026-11-04, nur Plan + Ansichts-Probe, noch NICHT umgesetzt)
Auslöser: Nutzer „Der Charme fehlt mir komplett.“ Hauptbeschwerden: **Welt leer/leblos** und **Kampf/Progression fühlen sich nicht wie T4C an**. Nur Prinzipien übernehmen, nichts kopieren (siehe „Rechtliches“). Recherche-Notizen mit Quellen: Notizordner `t4c-charme-recherche.md`.

### Was den T4C-Charme ausmacht (Recherche)
**Belegt** (Fan-Leitfäden t4c.com, t4cbible.com, winternun.blog, brosmetty.blogspot.com; superjumpmagazine.com „Ancient Worlds 4“; Wikipedia; gamebrain.co; mein-mmo.de):
- **Gespräche über Stichworte:** Man tippt Begriffe zum NPC (Auftrag, Arbeit, Heilen, Name …), Ja/Nein-Antworten; falsches oder zu frühes Wort setzt zurück oder der NPC greift an. Aufträge sind versteckt, man findet sie über Gespräche, Gerüchte, Wiki.
- **Kleiner, klarer Einstieg:** erster Auftrag per Stichwort, 15 Ratten im Keller unter dem Tempel der Startstadt; Heiler im Keller für Stufe 1; Startstadt mit Drachen-NPC.
- **Feste, bekannte Orte:** Tempelkeller in 4 Ebenen, Goblinlager, Orklager (Anführer ab ~15), Grab mit Mini-Boss (Respawn ~30 Min.). Jeder Spieler kennt „das Goblinlager“.
- **Weg von der Startinsel als großer Meilenstein:** zweite Insel ab Stufe 25 + 10.000 Gold + Questkette (100 Goblins, Vertrauen gewinnen), guter oder böser Weg (Karma); dritte Insel über Schlüsselkette, Karma-Schwellen, Stufe 40+.
- **Tag und Nacht haben Folgen:** Schwarzmarkt nur nachts, manche NPCs sprechen nur nachts oder nicht nachts.
- **Aufträge mit Reibung:** Zeitaufträge, lange Ketten mit Rätseln, Kill-Zähler (Waffe erst nach 500 Goblins kaufbar), Belohnung skaliert mit Stufe; 100 Goblins ≈ 15 % einer Stufe.
- **Todesstrafe spürbar:** je Server Prozent von Rucksack (5–30 %), Gold (10–35 %), XP (5–15 %).
- **Charaktererschaffung über Fragen**, klassenlos, Ausrüstung über Attribut-Anforderungen, Auto-Angriff, Mischbuilds.
- **Gemeinschaft und Musik:** kleine Server, man kennt jeden; „Glückwunsch!“-Kultur bei Level-ups; Musik wird am meisten gelobt (eingängig), Grafik schon damals veraltet. Kritik: Grind eintönig, kein Questlog, man weiß am Anfang nicht, was tun.

**Quellen:** https://www.t4c.com/cms/ar.html · https://www.t4cbible.com/ArakasQuest · https://winternun.blog/2021/12/02/the-4th-coming-t4c-quests-with-coordinates/ · http://brosmetty.blogspot.com/2013/08/blog-post.html · https://www.superjumpmagazine.com/ancient-worlds-part-4-the-4th-coming/ · https://en.wikipedia.org/wiki/The_4th_Coming · https://gamebrain.co/game/the-4th-coming · https://mein-mmo.de/8-alte-mmorpgs/9/ (Massively OP „Game Archaeologist“ war gesperrt; die Fan-Leitfäden schreiben teils voneinander ab).

**Vermutet** (nicht belegt): Der Charme entsteht aus Entdecken ohne Wegweiser, langsamem bedeutsamem Aufstieg, festen bekannten Orten mit Namen, wiedererkennbarer Musik je Ort und dem Gefühl, dass Stadt und Welt bewohnt sind (online durch andere Spieler, im Solo muss NPC-Leben das ersetzen). Beute eher feste, benannte Gegenstände mit bekannter Seltenheit als Zufallsaffixe.

### Ist-Stand (gespielt 2026-11-04, Dev-Server, 1280x800, Aschenhafen + Roggenfelder; Zahlen aus `data.ts`/`world.ts`)
- **Stadt leer:** Aschenhafen hat einen großen Pflasterplatz mit einem Marktstand, sonst nichts. In der ganzen Welt gibt es 22 NPCs, alle mit Funktion (Händler, Lehrer, Aufträge, Lager), davon 10 in Aschenhafen, meist in ihren Häusern. Keine Bewohner, Wachen, Kinder, Tiere, keine Stimmen.
- **Wildnis leblos:** Roggenfelder sind gleichmäßige Wiese mit einzelnen Bäumen, Ratten und Hunden. Keine Wege mit Reisenden, keine Landmarken (Ruinen, Schreine, Lagerfeuer), keine harmlosen Tiere, die Welt reagiert nicht.
- **Gespräche:** `NPC_LORE` sind 2–4 Absätze Monolog zum Durchblättern. Keine Themen, keine versteckten Aufträge, keine Reaktion auf den Spieler.
- **Tag/Nacht:** nur Darstellung (`atmosphere.ts`, 24-Minuten-Zyklus im Client); die Sim kennt keine Uhrzeit, nichts ändert sich nachts.
- **Musik:** generativ (`music.ts`, Tonleiter + Zufallsmelodie je Stimmung). Stimmig, aber nichts zum Wiedererkennen oder Mitsummen.
- **Kampf/Progression (Zahlen):** Feldratte Stufe 1 = 32 LP, 10 XP; Stufe 2 braucht 223 XP (≈ 22 Ratten); Startwaffe 7–13 Schaden (≈ 3–4 Treffer je Ratte). Bot: Stufe 5 nach 13 Min., 10 nach 50 Min., 30 nach 8,4 h (Levelcap). Todesstrafe mild (≈ 5 % XP, 1–3 Gegenstände, Leichenlauf). Beute nach Diablo-Art (Seltenheitsfarben, Zufallsaffixe, Lichtstrahl), dazu „Hinlaufen“-Autopilot und Richtungspfeil.
- **Startinsel:** eine zusammenhängende Insel bis Stufe 30, kein „Weg hinaus“ als Meilenstein.

### Lückenanalyse (gewichtet nach den beiden Beschwerden)
| # | Lücke | Beschwerde | Gewicht |
|---|---|---|---|
| 1 | Städte ohne Bewohner, Tagesablauf, Geräusche | Welt leer | hoch |
| 2 | Wildnis ohne harmloses Leben, Reisende, Landmarken | Welt leer | hoch |
| 3 | Gespräche ohne Themen, nichts zu entdecken | Welt leer | hoch |
| 4 | Tag/Nacht ohne Folgen | Welt leer | mittel |
| 5 | Aufstieg zu schnell und zu klein (Stufe 10 in < 1 h, Cap 30), Level-up ohne Echo der Welt | Progression | hoch |
| 6 | Beute als Zufallsaffix-Schwall statt benannter, bekannter Funde; keine Kill-Zähler-Ziele | Progression | hoch |
| 7 | Kampf ohne Gefahr: Gegnerstärke nicht lesbar, milde Strafe, Monster fliehen/rufen nicht | Kampf | mittel |
| 8 | Kein Inselwechsel als großes Ziel | Progression | mittel |
| 9 | Musik ohne Leitmotive | Atmosphäre | mittel |
| 10 | Draufsicht statt Iso (Raumgefühl) | Look | offen (Entscheidung) |

### Ansicht: Probe Draufsicht gegen Iso
- **Probe:** `scripts/bake-iso-probe.ts` backt denselben Stadtausschnitt (2 Häuser, Brunnen, Marktstand, Held, 4 NPCs, 2 Goblins, Ratte) mit dem Spielcode einmal als Draufsicht und einmal als Iso 2:1 (Rauten 64×32 bei Maßstab 2, Häuser als 3D-Kästen mit Fachwerk, Satteldach, Giebel, Tiefenpuffer). Ausgabe `probe/iso/` (index.html, `vergleich.png`), im Dev-Server unter `/probe/iso/`. Das Spiel ist unverändert.
- **Befund Figuren:** Beim Helden belegt: Das Rig backt per `yaw = ±45°` Schrägansichten (vorn-schräg, hinten-schräg) ohne neue Kunst (`probe/iso/held-richtungen.png`). Zweibeinige Monster und NPCs laufen über dasselbe Rig (`humSpec` → `posed`), dort vermutlich gleich; Tiere (`monsterRig.js`) ungeprüft. Iso braucht 2 zusätzliche Ansichten je Sheet (+~66 % Backzeit/Speicher).
- **Rahmen der Probe:** beide Bilder sind gleich große Bildschirmausschnitte (864×672), um den Platz herum ist nur Füllwiese. Bei Iso sieht man auf gleicher Fläche etwas weniger Karte (Rauten, Häuserhöhe).
- **Aufwand kompletter Umbau (Sim, Server, Spielstände unberührt):**
  | Teil | Dateien | Art | Aufwand |
  |---|---|---|---|
  | Projektion, Kamera, Klick-Picking, Tiefensortierung x+y, Pfeiltasten diagonal | `iso.ts`, `GameScene.ts` (44 Stellen), `art.ts` (3) | anpassen | S–M |
  | Boden-Chunks als Rauten, Übergänge/Ufer neu, Chunk-Pool | `world/ground.ts`, `world/details.ts`, `GameScene.ts` (Chunks) | umbauen | M–L |
  | Wände, Klippen, Gruft-/Dungeonwände als Iso-Blöcke | `world/props.ts` (`wallTile`) | neu | L |
  | Häuser als Kästen (Wände, Dach, Giebel, Türen an allen Seiten, Dach ausblenden beim Betreten, Fensterlicht) | `houses.ts`, `GameScene.ts` (Häuser) | neu (Probe-Ansatz) | L |
  | Props als stehende Bilder, Zäune/Stände je Richtung | `world/props.ts`, `town.ts` | übernehmen/anpassen | S–M |
  | Figuren: 2 Schrägansichten, Richtungswahl nach Laufrichtung (Held belegt, Zweibeiner vermutlich gleich, Tiere ungeprüft) | `figure.ts`, `hero.ts`, `monster.ts`, `monsterRig.js`, `npc.ts`, `figureWorker.ts` | anpassen | M (Tiere evtl. M–L) |
  | pixelfx-Ankerpunkte, Namen, Lichtstrahlen, Minimap (bleibt Draufsicht), HUD | `fx.ts`, `pixelfx.ts`, `minimap.ts` | meist übernehmen | S |
  | Render-Tests | `groundLook.test.ts`, `atmosphere.test.ts` u. a. | anpassen | S |
  Gesamt grob **4–6 Sessions** (vergleichbar mit dem Welt-Umbau 2026-11-04). Risiko: Wandkanten und Dungeons sind der größte Brocken; Boden nur umzuprojizieren (wie in der Probe) geht schnell, wirkt aber weicher.

### Pakete (priorisiert; „ansichtsunabhängig“ = sofort möglich, egal wie die Ansicht entschieden wird)
Allgemein: je Paket frische Session, Entscheidungen vorher per AskUserQuestion, Commits je verifiziertem Schritt auf `neuer-look`, Prüfung tsc, Lint, Tests, Build, Browser; bei Sim-Änderungen Golden-Snapshots bewusst aktualisieren und `npm run pace` nachmessen.

**P1 Lebende Städte** (ansichtsunabhängig, Beschwerde Welt leer, Aufwand M)
- Ziel: Aschenhafen und Felsenwacht wirken bewohnt.
- Änderungen: leeren Platz verdichten (Marktstände, Karren, Kisten, Aushangbrett, Banner; Props tragen in beide Ansichten), 8–15 Bewohner je Stadt ohne Funktion (Wache auf Runde, Kinder, Bauer mit Korb, Fischer am Kai, Betrunkener, Ausrufer), Tiere (Hühner, Katze, Hund, Krähen, Möwen am Hafen), Tagesablauf nach Uhrzeit (Markt am Tag, nachts Wache mit Fackel, Leute gehen in die Häuser), kurze Zurufe als Sprechblasen (eigene Texte, Gerüchte zu Orten), Stadtgeräusche (Hammer an der Schmiede, Stimmengewirr). Bewohner und NPCs in Hörweite gratulieren beim Level-up („Glückwunsch!“-Ersatz, hört auf das bestehende Ereignis `levelUp`). Rein clientseitig, damit Sim, Golden-Tests und Mehrspieler unberührt bleiben.
- Dateien: neu `src/render/townLife.ts`, `src/render/npc.ts` (Bewohner-Looks), `src/render/audio.ts` (Stadtgeräusche), `src/render/town.ts` + `scripts/gen_map.py`/`src/data/aschenthron.json` (Platz-Props), ein Haken in `GameScene.ts`.

**P2 Gespräche mit Themen** (ansichtsunabhängig, Beschwerde Welt leer, Aufwand M)
- Ziel: Entdecken wie bei T4C, ohne Tipp-Frust.
- Änderungen: Gesprächsfenster mit hervorgehobenen Stichworten im Text; Klick (optional Eintippen) öffnet ein Thema; Themen geben Gerüchte, Wegbeschreibungen, Hintergrund und schalten **versteckte Aufträge** frei, die es nur über Stichworte aus anderen Gesprächen gibt; Notizbuch „Bekannte Stichworte“; Gruß nach Ruf/Stufe/Tageszeit. Bestehende Aufträge bleiben erreichbar.
- Dateien: `src/sim/data.ts` (neu `NPC_TOPICS` neben `NPC_LORE`), `src/sim/quests.ts` (Freischalten über Thema, Befehl `askTopic`), `src/sim/save.ts` (bekannte Stichworte), `src/render/ui.ts` (Gesprächsfenster).

**P3 Fortschritt mit Gewicht** (ansichtsunabhängig, Beschwerde Progression, Aufwand M–L)
- Ziel: Stufen fühlen sich verdient an, Beute hat Namen.
- Änderungen: (a) Level-Kurve strecken (Zielwert vom Nutzer, siehe Entscheidungen), Bot nachmessen; (b) Meilenstein-Titel bei Stufe 10/20/30 (das Gratulieren der Bewohner macht P1); (c) **benannte Funde** je Monsterfamilie mit fester, kleiner Chance und eigenem Namen, Bestiarium zeigt Drops nach dem ersten Fund; (d) **Kill-Zähler-Ziele** (nach 100/500 Goblins Titel, Händlerware oder Auftrag); (e) optional Charaktererschaffung über Fragen statt freier Startpunkte.
- Dateien: `src/sim/data.ts` (Kurve, Funde), `src/sim/items.ts` (Funde im Drop-Wurf), `src/sim/world.ts` (Kill-Zähler), `src/render/ui.ts` + `src/render/achievements.ts` (Bestiarium, Titel), `src/sim/save.ts`.

**P4 Kampf mit Gefahr** (ansichtsunabhängig, Beschwerde Kampf, Aufwand M)
- Ziel: Man sieht, was gefährlich ist, und spürt einen Tod.
- Änderungen: Gegnername + Stufenfarbe bei Hover (grau/weiß/gelb/orange/rot nach Stufenabstand); Gegner rufen Rudelgenossen und fliehen bei wenig Leben (Goblins, Banditen), Untote nie; ein paar „zu früh betreten“-Gefahrenorte nahe der Startgebiete; Todesstrafe wählbar schärfer (Gold-Anteil, mehr Rucksack-Gegenstände, siehe Entscheidungen).
- Dateien: `src/sim/world.ts` (KI), `src/sim/data.ts` (Werte), `src/render/GameScene.ts` (Hover-Anzeige).

**P5 Wildnis mit Leben** (überwiegend ansichtsunabhängig, Beschwerde Welt leer, Aufwand M–L)
- Ziel: Zwischen den Orten passiert etwas.
- Änderungen: harmlose Tiere (Rehe fliehen, Krähen fliegen auf, Frösche im Moor, Fledermäuse nachts), Landmarken je Zone (Ruinen, Wegschrein, Galgen, verlassenes Lagerfeuer, tote Abenteurer mit Notiz/Hinweis auf P2-Stichworte), Reisende auf der Handelsstraße (Händlerkarren, Pilger, Wachpatrouille, die gegen Monster kämpft).
- Dateien: neu `src/render/wildlife.ts` (Tiere, nur Client), `src/render/world/props.ts` (Landmarken-Bilder), `scripts/gen_map.py` + `src/data/aschenthron.json` (Landmarken als Daten, `MAP_VERSION` prüfen), `src/sim/world.ts` (kämpfende Patrouille, später).

**P6 Tag und Nacht mit Folgen** (ansichtsunabhängig, Aufwand M)
- Ziel: Nachts ist die Welt anders.
- Änderungen: Uhrzeit in die Sim (aus Tick, im Mehrspieler vom Server), Nachtmarkt/Hehler nur nachts, Läden schließen, einzelne NPCs nur nachts, nachts mehr oder stärkere Untote und Nachtjäger.
- Dateien: `src/sim/world.ts`, `src/sim/data.ts`, `src/render/atmosphere.ts` (Uhr aus der Sim lesen), `src/render/ui.ts`.

**P7 Musik mit Leitmotiven** (ansichtsunabhängig, Aufwand S–M)
- Ziel: Orte erkennt man am Klang.
- Änderungen: je Stimmung eine selbst komponierte, feste Melodie (im Code notiert) als Thema, die generative Begleitung bleibt darunter; Stadtthema, Feld, Moor, Dungeon, Boss.
- Dateien: `src/render/music.ts`.

**P8 Weg von der Startinsel** (Aufwand XL, nach P2/P3)
- Ziel: großes Etappenziel wie bei T4C.
- Änderungen: Aschental wird Startinsel; zweite Region per Schiff ab Aschenhafen, freigeschaltet über Stufe + Gold + Questkette (optional guter/böser Weg); neue Karte, Monster, Stadt.
- Dateien: `scripts/gen_map.py`, `src/data/*.json`, `src/sim/data.ts`, `src/sim/world.ts`, `src/sim/save.ts` (Karten-/Regionwechsel).

**P9 Ansicht** (nur wenn der Nutzer Iso wählt, Aufwand 4–6 Sessions, siehe Tabelle oben). Ansichtsabhängig sind vor allem Häuser, Wände und Boden; Props und Figuren aus P1/P5 tragen hinüber.

### Reihenfolge und Aufteilung auf Sessions
**Top 5:** P1 Lebende Städte · P3 Fortschritt mit Gewicht · P2 Gespräche mit Themen · P4 Kampf mit Gefahr · P5 Wildnis mit Leben (je eine Hauptbeschwerde zuerst; P7 Musik ist klein und läuft nebenher).
- **Welle 1 (parallel, getrennte Dateien):** P1 Lebende Städte (`townLife.ts`, `npc.ts`, `audio.ts`, `town.ts`, Karte, Haken in `GameScene.ts`) · P3 Fortschritt (`data.ts`, `items.ts`, `world.ts`, `save.ts`, `ui.ts`, `achievements.ts`) · P7 Musik (`music.ts`). Keine Datei doppelt; Karte (`gen_map.py`/JSON) nur P1.
- **Welle 2:** P2 Gespräche (nach P3, beide in `data.ts`/`save.ts`/`ui.ts`) parallel zu P5 Wildnis, solange P5 nur `wildlife.ts`/`props.ts`/Karte anfasst. Danach P4 Kampf → P6 Tag/Nacht (beide `world.ts`/`data.ts`, nacheinander; die kämpfende Patrouille aus P5 erst nach P4).
- **Welle 3:** P8 Insel; P9 Ansicht, falls gewählt (blockiert dann alle Render-Pakete, also nicht parallel zu P1/P5).

### Entscheidungen des Nutzers (2026-11-04)
1. **Ansicht:** erst Inhalte (P1–P7), Iso-Entscheidung später (P9 zurückgestellt).
2. **Level-Tempo:** auf **20–30 h** bis Stufe 30 strecken, Cap bleibt 30.
3. **Beute:** **fast nur benannte, feste Gegenstände** wie bei T4C (Zufallsaffixe nur noch Ausnahme).
4. **Gespräche:** Stichworte **nur anklicken**, kein Eintippen.
5. **Todesstrafe (2026-11-06):** so nah wie möglich an D4O, aber mit unserem System harmonisiert (bestehender Leichenlauf, 5 % der Stufenspanne, gestreckte Kurve aus P3, benannte Beute, Safe-Zonen). Umsetzung in P4: D4O-Regeln recherchieren (Quellen belegt/vermutet trennen), Abweichungen begründen.
Noch offen: 6 Fertigkeiten, 7 Wegweiser, 8 zweite Insel (siehe unten).

### Offene Entscheidungen für den Nutzer
1. **Ansicht:** Draufsicht behalten · auf Iso umbauen (4–6 Sessions, Probe `probe/iso/`) · erst Inhalte (P1–P7), Ansicht später.
2. **Level-Tempo:** Stufe 30 heute nach ≈ 8 h (Bot). Strecken (z. B. 20–30 h), Levelcap anheben oder lassen?
3. **Beute:** Zufallsaffixe behalten und benannte Funde ergänzen, oder überwiegend feste, benannte Gegenstände wie bei T4C?
4. **Gespräche:** Stichworte anklicken, eintippen oder beides?
5. **Todesstrafe:** so lassen oder schärfer (Gold-Anteil, mehr Gegenstände)?
6. **Fertigkeiten:** Rang 1–5 lassen oder als steigende Zahlenwerte beim Lehrer trainieren (großer Umbau)?
7. **Wegweiser:** „Hinlaufen“ und Richtungspfeil behalten, abschaltbar machen („Entdecken-Modus“) oder entfernen?
8. **Zweite Insel (P8):** ja und wann?

### P3 Fortschritt mit Gewicht: Umbau-Entwurf (2026-11-04, Session „p3-fortschritt“)
**Nutzerentscheidungen (AskUserQuestion 2026-11-04):** Kurve „früh flott, spät zäh“ (Bot-Ziel: Stufe 10 ≈ 2 h, 20 ≈ 9 h, 30 ≈ 25 h) · Schmied bleibt die Ausnahme für Zufallsaffixe (Aufwerten, Neu würfeln, Erweitern gegen Gold; benannte Funde, Unikate, Set-Teile unveränderbar) · Zufallsaffix-Beute fällt nur noch bei Weltbossen · Unikate mit festen Werten (aufgerundete Mitte des alten Bereichs; gefundene alte Stücke behalten ihre Werte).
**Basismessung vor dem Umbau (Bot, Seed 2024):** Stufe 5 nach 19 Min., 10 nach 74 Min., 20 nach 234 Min., Stufe 30 in 12 h nicht erreicht (Endstufe 29, 95 Tode, davon 65 auf Stufe 23–26). Die SPEC-Angabe „8,4 h“ ist veraltet.

**Beute (benannt und fest):**
- **Grundgegenstände** (die 157 Vorlagen in `items.ts`, z. B. „Eisenhelm“) bleiben feste Gegenstände ohne Affixe und sind weiter der Großteil der Beute. Händler verkaufen wie bisher nur Grundgegenstände.
- **Benannte Funde** (`NAMED` in `src/sim/named.ts`): fester Name, Grundvorlage, feste Zusatzwerte, feste Sockelzahl, Seltenheitsklasse `magic` (2 Werte) oder `rare` (3 Werte, halbe Fallchance). Am Gegenstand: `Item.named = id`, Werte in `affixes` (ohne `tier`), damit Tooltip und Bewertung ohne Umbau laufen. Kein neuer `Rarity`-Wert (Bodentexturen in `GameScene`/`art.ts` hängen daran).
- **Menge:** je Stufenband (1, 6, 11, 16, 21, 26) und Slot genau ein Fund = **66 Funde** (11 Slots × 6 Bänder), jeder einer Beute-Gruppe zugeordnet, die in dem Band jagt.
- **Beute-Gruppen** (`LOOT_GROUPS` in `data.ts`, eine Tabelle für Funde, Kill-Zähler und Bestiarium; `family` taugt nicht, `humanoid` mischt Goblins, Räuber und Hexen): Ratten, Hunde und Wölfe, Goblins, Räuber, Spinnen, Moor (Ghule, Hexen), Untote, Trolle und Golems, Würmer, Glut (Aschenwandler, Elementare), Dämonen.
- **Wurf:** Fällt Ausrüstung, ist es mit 30 % ein benannter Fund aus aktuellem und vorigem Stufenband (Funde der eigenen Gruppe vierfach gewichtet), sonst ein Grundgegenstand. Ausrüstungs-Fallchance sinkt etwas (`GEAR_DROP_FACTOR` 0,5 → 0,35), weil eine Stufe 2–3-mal so lange dauert.
- **Alle Beutewege:** normale Monster wie oben · Champions: sicher ein benannter Fund ihrer Gruppe · Mini-Bosse: ein benannter Fund (bevorzugt `rare`) plus Unikat/Set-Wurf wie bisher · Weltbosse: weiter Zufallsaffixe mit hohen Stufen (die einzige Beute-Ausnahme) plus Unikat/Set · Truhen und verlorene Fracht: Grundgegenstände und benannte Funde · Kopfgeld: 30 % benannter Fund der Zielgruppe · Aufgaben-Belohnung: drei benannte Funde der Stufe zur Wahl.
- **Unikate, Proc-Waffen, Meisterschaft:** Unikate bleiben (sie sind schon benannt), Werte jetzt fest; Boss-Quellen unverändert. Proc-Waffen sind Grundvorlagen mit festen Werten und bleiben. Meisterschaft (Stufe 20) ist kein Beutesystem und bleibt unverändert. Sets bleiben.
- **Bestiarium:** je Beute-Gruppe die Monsterarten mit Kill-Zahl und die Funde der Gruppe (benannte Funde, Unikate ihrer Bosse). Ein Fund zeigt Name und Werte erst, wenn man ihn einmal gefunden hat, sonst „???“.

**Stufen:** `xpToNext` bekommt einen Streckfaktor je Stufe (früh klein, spät groß), Bot-Ziel siehe oben. XP aus Aufgaben wird mit demselben Faktor der Aufgabenstufe skaliert, damit Aufgaben nicht entwertet werden; Kopfgelder hängen schon an `xpToNext`. Todesstrafe bleibt 5 % der Stufenspanne (wird damit absolut größer).

**Titel und Kill-Ziele:** Meilenstein-Titel bei Stufe 10, 20 und 30. Je Beute-Gruppe: 100 Kills → Titel, 500 Kills → zweiter Titel und ein benannter Fund der Gruppe wird bei den Händlern kaufbar (Preis-Prüfung im Befehl `buy`, nicht nur in der Oberfläche). Aktiven Titel wählt man im Charakterfenster (Befehl `setTitle`). Anzeige über dem Kopf braucht `GameScene` (P1-Datei) und kommt später.

**Spielstände:** `kills` (je Monsterart), `found` (gefundene Funde/Unikate), `titles`, `title`, `xpv` neu in `KEYS` (Server speichert über `exportPlayer`, Client bekommt alles über `Snapshot.you`). Alte Zufallsgegenstände bleiben unverändert erhalten. Unbekanntes `named` wird entfernt, der Gegenstand bleibt. Alte Stände (ohne `xpv`) behalten ihre Stufe; der Fortschritt innerhalb der Stufe wird anteilig auf die neue Kurve umgerechnet.

**Nicht in dieser Runde:** Kill-Ziel als Auftrag (nach P2 Gespräche, dann als versteckter Auftrag), Titel über dem Kopf (nach P1), Charaktererschaffung über Fragen.

### Umsetzungsstand P3 (2026-11-04)
- **Umgesetzt:** Stufenkurve (`xpStretch` 1,45 → 1,85 linear auf die alte Kurve, Aufgaben-XP mitgestreckt, alte Stände anteilig umgerechnet), 66 benannte Funde (`named.ts`, 22 selten) auf allen Beutewegen, Unikate mit festen Werten, Zufallsaffixe nur noch Weltboss und Schmied, Titel (Stufe 10/20/30, 100/500 Kills je Beute-Gruppe, Befehl `setTitle`), Händlerware nach 500 Kills (gefundene Funde der Gruppe, dreifacher Wert), Bestiarium-Tab (Taste L) mit Kills, Kill-Zielen, Monsterarten und Funden („???“ bis zum ersten Fund), Titel im Charakterfenster und im Fensterkopf, Tooltip „Benannter Fund“ mit Lore.
- **Tempo (Bot, fester Beute, 3 Seeds 2024/7/99):** Stufe 10 nach 114/122/113 Min., 20 nach 501/582/500 Min., 30 nach 24,9/22,8/27,6 h (88/40/84 Tode). Vor P3: Stufe 30 nach ≈ 14 h.
- **Befund:** Feste Beute macht den Bot ab Stufe 10 etwa 1,5-mal langsamer (kein „bester von vielen Zufallswürfen“ mehr); die Kurve wurde danach eingestellt. Nur Funde der eigenen Gruppe (erster Versuch) ließ den Bot auf Stufe 23–24 hängen (≈ 300 Tode), deshalb jetzt Gruppe vierfach gewichtet statt ausschließlich. Der Bot bewertet jedes Affix gleich (auch Zauberwerte für einen Nahkämpfer); bewusst nicht geändert, damit alte und neue Messung vergleichbar bleiben.
- **Offen:** Kill-Ziel als Auftrag (mit P2 als versteckter Auftrag), Titel über dem Kopf (Haken in `GameScene.ts` nach P1), Charaktererschaffung über Fragen, Erfolge (`achievements.ts`) zählen „seltene Funde“ weiter über die Seltenheit (benannte seltene zählen mit), Balance einzelner Funde im Spiel prüfen, mehr Funde je Band (heute genau einer je Slot).

### Umsetzungsstand P2 Gespräche mit Themen (2026-11-06)
- **Umgesetzt:** Gesprächsfenster in `ui.ts` (Gruß nach Bekanntheit und Tageszeit, Einstiegszeile mit Stichworten, Antwortkarte, „Gehörtes ansprechen“), Stichworte nur per Klick. Themen für alle 22 NPCs der Karte (beide Städte, Wildnis) in `src/sim/topicsData.ts` (`NPC_TOPICS`, aus `data.ts` wieder ausgeführt): Gerüchte, Wegbeschreibungen, Hintergrund; eigene Texte. Notizbuch „Bekannte Stichworte“ im Aufgabenfenster (J). Stichworte im Text als `[[schluessel|Anzeige]]`; wer einen Text liest, lernt alle Stichworte darin.
- **Regel:** Frei anklickbar ist nur, was in der Einstiegszeile des NPC steht. Alles andere fragt man erst, wenn das Stichwort aus einem *anderen* Gespräch (oder einer Abgabe, `QuestDef.teaches`) bekannt ist. Ein NPC ohne Antwort zeigt es grau, das Stichwort bleibt im Notizbuch. Zu niedrige Stufe (`minLevel`): der NPC weicht aus, nur das Stichwort wird gemerkt.
- **Sim:** Befehl `askTopic {npcId, topic}` (`world.ts`, geprüft in `net.ts`, Reichweite `NPC_RANGE`, Stichwort bekannt/frei, Stufe). Reine Logik in `src/sim/topics.ts`. Spielerfeld `topics` (Spielstand-Schlüssel `topics`, Altstände: leer, Unbekanntes fällt weg). `beginQuest`/`learnTopics` in `world.ts`; `acceptQuest` nutzt `beginQuest` (gleiches Verhalten).
- **Versteckte Aufträge:** `QuestDef.hidden/giver/teaches/thread`, `isGiverOf` (Abgabe beim `giver`, der sie nicht in `quests` führt, deshalb keine Kartenänderung). 4 Ketten × 3 Glieder, jedes Glied lehrt mit der Abgabe das Stichwort für das nächste bei einem anderen NPC: **Rotschals Handel** (Odda → Brandt → Ysa → Mirel, Stufe 4–10), **Die Totenglocke** (Torgal/Orvan → Haldor → Kjorra, 9–13), **Der verschwundene Schüler** (Varn → Joren → Brandt → Varn, 5–8), **Der gebrochene Eid** (Aldric → Maren → Ruven → Tessa, 20–25). Nicht in `questChains()` und nie als „Annehmen“ oder „nächster Schritt“ sichtbar (`questAvailable` false). Bestehende Aufträge unverändert (Test).
- **Balance:** Der Pace-Bot fragt keine Themen; die Aufträge geben XP wie Kettenglieder (`chainQ`-Formel), `npm run pace` siehe Prüfstand im Bericht.
- **Offen / nicht gemacht:** P3-Rest „Kill-Ziel als Auftrag“ nicht angefasst (kein sauberer Ansatz ohne neues Auftrags-Kind); Abgabe-Marker („?“) über dem NPC in `GameScene.ts` fehlt (gehört der Parallel-Session), der Hinweis steht nur im Fenster und im Aufgabentracker; Gruß kennt keinen echten „Ruf“ (gibt es nicht), er nimmt Stufe, abgegebene Aufgaben und Titel; Themen sind statisch (kein Wechsel der Antwort nach Welt-Ereignissen); `Ruven`, `Tessa`, `Haldor` haben schon Ketten in `c_*`, ihre Themen verweisen nicht darauf.
- **Tests:** `src/sim/topics.test.ts` (Daten: jeder Karten-NPC hat Themen, jedes Einstiegswort beantwortet, ≥3 Ketten à 3, jede verdeckte Antwort ist anderswo lehrbar; Befehl: frei/verdeckt, Reichweite, Stufe, Kette bis zur Abgabe, Netzprüfung; Spielstand: Roundtrip, Altstand), `src/render/talk.test.ts` (Gruß).

### Umsetzungsstand P5 Wildnis mit Leben (2026-11-06, nur Client)
- **Neu:** `src/render/wildlife.ts` (Tiere, Landmarken, Notizen, Reisende, ein Atlas `wild_life`), `src/render/world/critters.ts` (Reh, Frosch, Fledermaus im Kunstraster), Landmarken-Bilder in `world/props.ts` (Ruine in 3 Formen, Wegschrein, Galgen, kaltes Lagerfeuer, toter Abenteurer, Händlerkarren seitlich und von vorn/hinten). Haken in `GameScene.ts`: Konstruktor, `updateWildlife`, `keysInUse` (je eine Zeile bis Methode). Sim, Spielstand, Mehrspieler, `MAP_VERSION` (bleibt 4) unberührt.
- **Tiere:** Zonentabelle `ZONE_FAUNA` (Roggenfelder/Düsterwald/Hochland Rehe, Moor Frösche, Krähen fast überall, Fledermäuse nachts außer Roggenfelder). Entstehen im Ring 9–22 Kacheln um den Helden auf passendem Boden und in derselben Zone, blenden ein/aus. Budget: 12 gleichzeitig, je Art/Zone gedeckelt, ein Neuling je 0,4 s. Reh flieht ab 6,5 Kacheln mit 5,4 Kacheln/s und weicht Hindernissen aus, Krähe fliegt ab 4,2 auf (`sfx.caw`), Frosch hüpft ab 2,6 weg, Fledermäuse nur bei `night > 0.45`, über den Baumkronen.
- **Landmarken:** 25 Objekte vom Typ `landmark` (`kind`, `id`, `text`, `topic`) am Ende von `scripts/gen_map.py` (ohne Zufall, Kacheln und alte Objekte byte-gleich, geprüft per Vergleich mit dem Vorgänger-JSON), in 7 Zonen, blockieren nichts (die Sim kennt den Typ nicht). Notizen (Leichen, Lagerfeuer) erscheinen bei ≤ 2,2 Kacheln als Pergamentbox, je Stelle höchstens alle 45 s. **Einhängestelle für P2:** `noteText(lm)` und `Wildlife.onNote` (Rückruf je gelesener Notiz); `topic` ist in den Daten reserviert und leer.
- **Reisende:** Händlerkarren (Fuhrmann `res_farmer`) und zwei Pilger (`res_elder`, `res_fisher`) auf der Handelsstraße Hafen-Osttor → (90,141) → (90,106) → (113,106) → Felsenwacht-Südtor, nur tagsüber, Position = reine Funktion der Zeit, blenden an den Toren aus. Nutzen vorhandene Bewohner-Figuren, kein neuer Backauftrag.
- **Gemessen** (Dev-Build, `?neu&stunde=12&wetter=klar`, 1024x768, Schleife per `__game.step`, versteckter Pane, andere Sessions liefen parallel): Spielstart 6–7 Frames > 33 ms hinter dem Vorhang (max 74–92 ms) mit wie ohne Wildnis; danach Sprung Roggenfelder, Straße Roggenfelder→Moorlande (500 Schritte), Sprung Moorlande, Moor→Totenacker, Düsterwald→Roggenfelder: **0 Frames > 33 ms**, max 15–31 ms (ohne Wildnis 14–32 ms), Median 2,3–3,1 ms; dasselbe nachts (`?stunde=22`, Fledermäuse aktiv): 0 Frames > 33 ms, max 14–21 ms. Teleport an den Karren (Figur kalt): max 14 ms. Ein Lauf unter paralleler Last (Tests) zeigte einzelne 36–113 ms, Wiederholung im Ruhezustand sauber.
- **Offen:** Kämpfende Wachpatrouille (nach P4, `world.ts`); Anknüpfung der Notizen an P2-Stichworte; Landmarken ohne Kollision (Held läuft durch Ruinen); Ruinen-Bogen etwas schmal, Frösche im dunklen Moor klein; Tiere ohne eigene Geräusche außer Krähen; `gen_map.py --preview` stürzt mit KeyError 21 ab (schon vorher).

### Umsetzungsstand P4 Kampf mit Gefahr (2026-11-06)

**Recherche Todesstrafe (T4C/D4O).** Quellenlage dünn: Es gibt keine einheitliche Regel, die Strafe ist *je Server* eingestellt (seit v1.81.5.1228 im Changelog serverseitig konfigurierbar). Betreiber laut Steam „Dialsoft, D4O AG“.
- **Belegt** (Wortlaut der Betreiberseiten):
  - Realmud-Server, Tod durch Monster: XP **10 %** („10% of current level experience“), Gold **10 %**, Rucksack **5 %**, Ausrüstung **0 %**; Tod durch Spieler: XP 0, Gold 10, Rucksack 0, Ausrüstung 0. Quellen: <https://support.t4c.com/knowledgebase.php?article=14>, <https://support.t4c.com/knowledgebase.php?article=29>, <https://www.t4c.com/cms/realmud-server-settings.html>.
  - Weitere Server (nur Tooltip auf der Realmud-Seite, Monstertod): 4th Saga XP 5 / Gold 10 / Rucksack 15 / Ausrüstung 0; Neerya XP 15 / Gold 15 / Rucksack 0 / Ausrüstung 0; Abomination (PvP-Testserver) XP 5 / Gold 35 / Rucksack 30 / Ausrüstung 5. Quelle: Realmud-Seite oben; Abomination auch <https://www.t4c.com/cms/article/Opening-Announcement-Abomination-Server.html> (Stand 08/2024).
  - Es gibt „death piles“ (Trading Rules, Realmud: bestimmte Gegenstände dürfen nicht aus einem Haufen genommen werden) und einen „death timer“, nach dessen Ablauf man zum Tempel teleportiert wird (Changelog v1.81.5.1278, 20.03.2026): <https://t4c-world.com/?page=changelog>.
- **Nicht belegt / vermutet:** Wovon die XP-Prozente genau gerechnet werden („current level experience“ – wir lesen: seit dem letzten Aufstieg gesammelte XP); Dauer des Death Timers; ob „Backpack 5 %“ Anteil der Gegenstände oder Chance je Gegenstand ist; Bergung der eigenen Leiche (nirgends beschrieben); Schutz für Neulinge (nur indirekt über „Start Level“ bei PvP). Der Changelog wurde nur zum Teil gelesen (rund 40 000 von 340 000 Zeichen wörtlich).
- Die Recherche lief über Seitenabrufe durch Unter-Agenten; Zahlen oben stehen so auf den genannten Seiten, einzelne Widersprüche der Seiten (Start-Stufe Realmud 10 vs. 25, PvP-Text vs. Tabelle) sind unaufgelöst und für PvM unerheblich.

**Regeln (umgesetzt, `src/sim/death.ts`, Anwendung in `world.ts` `onPlayerDeath`).** Wir nehmen Realmud/Monstertod als Vorbild; Werte nur nach Stufe, ohne Zufall:

| Stufe | XP | Gold | Rucksack | Ausrüstung |
|---|---|---|---|---|
| 1–5 | 0 | 0 | 0 | 0 |
| 6–10 | 5 % der XP dieses Levels | 5 % | 10 % der verlierbaren Gegenstände, max. 1 | 0 |
| ab 11 | 10 % der XP dieses Levels | 10 % | 10 % (aufgerundet, mind. 1), max. 3 | 0 |

- XP = Anteil dessen, was seit dem letzten Aufstieg gesammelt wurde (nie unter die Stufenschwelle, wie T4C „current level experience“). Das ersetzt die frühere Regel „5 % der Stufenspanne“ (im Mittel gleich groß, bei frisch erreichter Stufe milder).
- **Tod durch einen Spieler (PvP):** nur Gold (Realmud: XP 0, Rucksack 0, Ausrüstung 0, Gold 10 %), gleiche Stufenstaffelung (`deathRules(level, pvp)`, Test in `death.test.ts`). Der Pace-Bot kämpft nie gegen Spieler.
- Gold geht wie bei T4C verloren (kein Haufen, bewusst: Goldsenke, keine Änderung an `GroundItem`).
- Rucksack-Gegenstände fallen an der Todesstelle als **Leichenhaufen** (Leichenlauf wie bisher 5 Minuten), die ersten **60 s nur für den Besitzer** (`GroundItem.owner/ownerUntil`, `isLocked`, geprüft bei `pickup` und `tryPickup`).
- **Nie verloren:** Angelegtes, Tränke (Rollen und Heiltränke retten den Leichenlauf), Edelsteine, **benannte Funde** und Unikate (D4O nimmt Sonderstücke aus Leichenhaufen aus; bei fester, benannter Beute wäre ein Verlust zu hart).
- **Abweichungen von D4O und Begründung:** (1) Staffelung für Neulinge, in D4O nicht belegt; Stufe 1–5 ohne Verlust, sonst stirbt man am Anfang gegen Ratten und lernt nur Frust (T4C gilt als „sink or swim“ für Neue). (2) Leichenhaufen mit Besitzersperre und 5-Minuten-Frist: bei D4O ist Bergung nicht belegt; unser Leichenlauf aus dem alten Entwurf bleibt, weil die Kurve aus P3 (L30 ≈ 25 h) harte Verluste sonst nicht trägt. (3) Rucksack-Anteil mit Deckel von 3 statt freiem Prozentsatz (Realmud 5 %). (4) Kein Death Timer, kein Priester-Wiedererwecken: Respawn sofort in der Stadt wie bisher.
- Nachricht im Spiel (`GameScene`, `deathPenalty`) nennt jetzt Gold und die 60-s-Sperre; Hilfetext in `ui.ts` angepasst.

**Pace (`npm run pace`, Bot, feste Beute; gleiche Läufe vorher auf `97d959b`, nachher auf `1e67dd4` für die Seeds 2024/7/99, auf `7782000` für 11/12/13; zwischen beiden Ständen änderten sich nur Ruf-Drossel, Flucht-Reset und PvP-Regel):**

| Seed | vorher L30 / Tode | nachher L30 / Tode |
|---|---|---|
| 2024 | 24,9 h / 88 | 25,1 h / 122 |
| 7 | 22,8 h / 40 | 22,6 h / 106 |
| 99 | 27,6 h / 84 | 33,5 h / 52 |
| 11 | über 40 h (hängt) / 6 | 23,0 h / 89 |
| 12 | 22,7 h / 54 | 22,9 h / 55 |
| 13 | 22,3 h / 67 | 24,7 h / 73 |

Median vorher 23,85 h (Seed 11 als „über 40 h“ gezählt), nachher 23,85 h. Auf `7782000` lagen Seed 2024 bei 32,4 h (103 Tode, siehe Schleife unten); nach dem Review-Fix 25,1 h – die Streuung kommt von der Schleife, nicht vom Fix. Nur Todesstrafe (Zwischenmessung): Seed 2024 25,8 h, Seed 7 27,9 h. **Befund:** Zählung: nachher 1 von 6 Seeds über 30 h (99; auf `7782000` zusätzlich 2024), vorher 1 von 6 (Seed 11, hing). Bei Seed 2024 (auf `7782000`) ist eine Bot-Schleife nachgewiesen, kein Balance-Effekt: Seed 2024 sitzt von Minute 172 bis 636 auf Stufe 13 bei (22,65) im Räuberlager und tötet nur den nachspawnenden Champion „Blutsaugender Räuber“ (L10); Gold steigt, XP kaum. Der Bot wählt das nächste Ziel in `[Stufe−4, Stufe+1]` und verlässt so einen Platz nie. Der Vorher-Lauf von Seed 11 hing ebenfalls (über 40 h, 6 Tode); die Ursache dort wurde nicht untersucht, für Seed 99 ist die Schleife nur vermutet. Einzeln abgeschaltete Teile (Ruf, Flucht, Gefahrenorte) brachten Stufe 20 nach 482–568 min (Seeds 2024/99) und bei Seed 99 L30 nach 26,2–28,8 h (Seed 2024 lief nur 18 h); der Verursacher ist nicht eindeutig, weil jede Änderung den Zufallsstrom verschiebt. Der Bot wurde bewusst nicht geändert (Vergleichbarkeit). Todesstrafe und KI machen den Bot im Schnitt etwas langsamer und sterben lassen ihn öfter, das Ziel 20–30 h hält im Median.

**Nachtrag „Bot-Schleife“ (2026-11-06, nur `src/sim/pace.sim.ts` und `tools/pace-all.sh`, Sim unberührt).**
- **Ursache belegt:** Seed 99 sitzt auf `18b5d69` von Minute 378 (Stufe 13) bis 915 (Stufe 14) bei (22,65) im Räuberlager. Mit der Haltelogik sichtbar: dort 60 XP/min bei 28 930 XP Stufenbedarf, also rund 480 min je Stufe; der Bot sucht das nächste Ziel in `[Stufe−4, Stufe+1]` und der Champion respawnt am selben Platz. Seed 2024 zeigt die Schleife auf `18b5d69` nicht mehr (25,1 h), die Aussage im Befund oben galt für `7782000`. Seed 11 lief auf `18b5d69` bei 23,0 h; der frühere Hänger ist nicht mehr nachstellbar.
- **Änderung:** (1) Alle 20 Min Jagdzeit wird die XP/min gemessen; reicht sie nicht für einen Aufstieg in 240 min, wird der Platz (Radius 25) 90 min gemieden, Zielwahl nur außerhalb (fehlt etwas, greift der alte Fallback). Deterministisch, kein Zufall. (2) Seit P6 schließen Läden nachts: der alte Bot fuhr dann in Dauerschleife in die Stadt (5 000–13 000 „Stadtfahrten“). Jetzt fährt er nur bei offenem Laden, sonst jagt er weiter.
- **Messung** (`tools/pace-all.sh`, Seeds 2024/7/99/11/12/13). „Alt“ = alter Bot auf P6-Sim (`22c6c1a`), „neu“ = Bot mit (1) und (2); „P5“ = alter Bot vor P6 (`18b5d69`, Tabelle oben).

| Seed | P5 L30 / Tode | Alt (P6) L30 / Tode | Neu (P6) L30 / Tode |
|---|---|---|---|
| 2024 | 25,1 h / 122 | 25,6 h / 68 | 29,8 h / 124 |
| 7 | 22,6 h / 106 | 28,4 h / 47 | 36,2 h / 186 |
| 99 | 33,5 h / 52 | 33,2 h / 67 | über 40 h (Stufe 29) / 228 |
| 11 | 23,0 h / 89 | 30,1 h / 140 | 26,8 h / 117 |
| 12 | 20,9 h / 53 | 36,5 h / 91 | 35,9 h / 224 |
| 13 | 24,7 h / 73 | 27,1 h / 94 | 28,4 h / 121 |

Median: P5 23,9 h, Alt 29,3 h, Neu 32,9 h (Seed 99 als 40 h gezählt).
- **Ehrlich:** Das Ziel „kein Seed über 30 h“ ist nicht erreicht. Auf der P6-Sim bringt die Zielwahl im Schnitt nichts (Streuung durch geänderten Zufallsstrom größer als der Effekt). Der Platzwechsel greift (Seed 99: Räuberlager bei Minute 149 verlassen), aber alle Läufe über 30 h haben Todesserien auf Stufe 23–25 (je 40–70 Tode), das ist keine Farmschleife, sondern Sim-Balance (Nachtjäger/stärkere Untote aus P6, Gegner um Stufe 23–25 im Verhältnis zur Ausrüstung). Das gehört in `p6-tagnacht`, nicht in den Bot. Ein Versuch, Todesorte 90 min zu meiden, machte den Frühverlauf langsamer (Stufe 5 nach 45–64 min statt 28–36) und wurde verworfen. Zu wenige Seeds für Aussagen unter ±3 h.

**Gegner-KI (`world.ts`, Werte `data.ts`, Tests `ai.test.ts`).** `MonsterKind.calls/flees`. **Ruf** (`callForHelp`, in `alertPack`): ein Rufer (Goblins, Häuptling/Kriegsherr/Brecher/Schamane, Banditen, Hauptmann) holt beim ersten Kontakt gleichartige Rufer derselben Beutegruppe im Umkreis `CALL_RANGE` 12 (auch aus anderen Rudeln), je Rufer alle 20 s, Ereignis `call` → Sprechblase „Zu mir!“ mit Ring. **Flucht** (`fleeStep`): nur Goblin, Kundschafter, Krieger, Schütze, Räuberlehrling, Wegelagerer, Räuberschütze, Räuber, nur einmal je Leben, unter 25 % Leben, 8 s Richtung Heimat (`autoAttack` aus, Ziel bleibt), danach zurück in den Kampf, Ereignis `flee` → „Rückzug!“. Nie: Untote, Bosse, Unikate, Champions, Häuptlinge, Beschwörungen (Test). Feste Schwellen und Ticks, kein Zufall; Mehrspieler: Events laufen über `makeSnapshot` (`call`/`flee` nach Sichtbarkeit).

**Gefahr sichtbar.** `src/sim/threat.ts`: Stufenabstand Monster − Spieler (+1 Champion, +3 Boss/Unikat): ≤ −5 grau, ≤ 0 weiß, 1–2 gelb, 3–4 orange, ab 5 rot. Beim Zeigen steht „Name (Lv N) · Wort“ in dieser Farbe (`GameScene.updateActors`); `label()` aktualisiert jetzt auch die Farbe. Die XP hängen nicht am Stufenabstand, „grau“ heißt nur „harmlos“.

**Gefahrenorte.** `DANGER_SPOTS` in `data.ts` (Karte und `MAP_VERSION` unverändert, Spawn in `buildWorld` nach `setupPatrols`, eigene Rudel-Kennung ab 200001, bleiben am Platz): **Wolfsbau** bei (57,138) mit 3 Schreckenswölfen (L11) und 1 Wolf in den Roggenfeldern (Stufe 1–5), **Räubernest im Röhricht** bei (76,145) mit Hauptmann (L13) und 3 Räubern (L10), ebenfalls Roggenfelder, weit weg von der Handelsstraße (x ≈ 90). Ein erster Platz im Düsterwald-Eingang wurde verworfen (`p3.test.ts` verlangt dort höchstens 3er-Rudel). Hinweise (`hint`) stehen in den Daten, sind aber noch in keinem Gespräch eingebaut.

**Reste aus P2/P5.** „?“-Marker über jedem Geber eines fertigen versteckten Auftrags (`GameScene.questMark`, `isGiverOf`, auch bei NPCs ohne Auftragsliste). Landmarken-Notizen lehren Stichworte: `LANDMARK_TOPICS` (10 der 12 Notizen; Lagerfeuer lm7/lm25 bleiben Stimmung) in `topicsData.ts`, Befehl `readNote {id}` (`world.landmarks` aus der Karte, Reichweite 4, Netzprüfung `^lm[0-9]+$`), Haken `Wildlife.onNote`.

**Im Spiel geprüft** (Dev-Build `vite build --mode development`, eigener Port 5191, Browser-Pane; Bildrate im versteckten Pane niedrig, Schritte per `__game.step`): Hover am Schreckenswolf (Lv 11) bei Spielerstufe 3/6/8/10/12/17 → rot „tödlich“, orange „gefährlich“, gelb „etwas stärker“, weiß „ebenbürtig“, grau „harmlos“ (Farbwerte aus dem Label gelesen); Goblin bei 1 Leben: „Rückzug!“, Goblin eines anderen Rudels schließt sich an: „Zu mir!“; Tod auf Stufe 17: −500 XP, −90 Gold, 1 Ring am Todesort mit 60-s-Sperre und 5-min-Frist, nach Rücklauf wieder im Rucksack; „?“ über Hauptmann Brandt bei erledigtem `h_rot1`.

**Golden-Snapshots:** keine hat sich geändert (`git diff 97d959b..HEAD -- src/sim/__snapshots__` leer), also nichts zu aktualisieren; geänderte Tests: `game.test.ts` (Stufe der Todes-Tests angehoben, weil Stufe 1–5 jetzt verlustfrei ist).

**Offen / Mängel.** Namensfarben von Champions, Unikaten und Bossen sind beim Zeigen durch die Gefahrenfarbe ersetzt (Aura bleibt); Landmarke lm6 lehrt das Stichwort `rotschal` direkt (Einstieg in „Rotschals Handel“ ohne Odda, bewusst als zweiter Weg); „?“-Marker nur an Brandt (Typ `quest`) geprüft, nicht an einem Geber ohne Auftragsliste; Kein Death Timer und keine Wiederbelebung durch NPC; Gefahrenorte ohne Gerüchte in Gesprächen und ohne Kartenzeichen; nur zwei Orte (Düsterwald-Eingang ist wegen `p3.test.ts` frei geblieben); Gold-Verlust ohne Haufen; Bot-Schleife siehe oben (Messung streut stark, 8 Seeds wären besser als 6); die „kämpfende Wachpatrouille“ aus P5 ist nicht Teil von P4 geworden; Rufen und Fliehen im Mehrspieler nur im Sim-Test, nicht mit echtem Server geprüft.

### Umsetzungsstand P6 Tag und Nacht mit Folgen (2026-11-06)
- **Uhr in der Sim** (`src/sim/clock.ts`): reine Funktion des Ticks, 1 Spielstunde = 1200 Ticks (24 Min. je Tag wie vorher), Start 8 Uhr, **Nacht 21–5:30**. Im Mehrspieler zählt der Server-Tick, den jeder Schnappschuss mitbringt (`net/client.ts` ruft `syncNpcPresence`). `World.fixedHour` = Testhilfe `?stunde=` (nur Einzelspieler, setzt GameScene). `atmosphere.ts` (`source`), `townLife.ts`/`wildlife.ts` (über `atmo.hour()`), Gruß (`talk.ts`) und HUD lesen diese Uhr; `phaseOf`/`dayPhase` decken sich jetzt mit der Nacht der Sim.
- **Läden:** Händler (`kind merchant`) sind nachts zu (`Npc.closed`): Kaufen/Verkaufen schlägt mit „… hat geschlossen. Der Laden öffnet um 5:30 Uhr.“ fehl, Namensschild „(geschlossen)“, Seitenfenster zeigt den Hinweis. Schmied und Lager bleiben offen.
- **Nacht-NPCs** (`NIGHT_NPCS`, Kennungen ab 900000, damit `nextId` und Golden-Tests unberührt bleiben): Hehler Grau (Aschenhafen), Nachthändlerin Vess (Felsenwacht) mit Sortiment `SHOPS.night` (Amulette, Ringe, Riesentränke, sonst nur Beute) und Totengräber Hobb. Nur nachts da (`Npc.away`), je mit Lore, Rollenhinweis und Themen. Der Nachthändler ist `kind quest` mit `shop`, damit der Pace-Bot ihn nicht ansteuert.
- **Nachtgegner** (`src/sim/night.ts`, Werte `NIGHT`/`NIGHT_SPAWNS` in `data.ts`): Untote und Wölfe/Nachtjäger draußen (nie Bosse, Unikate, Beschwörungen, Dungeons) bekommen beim Wechsel HP ×1,25, Schaden ×1,2, Wahrnehmung +1,5, Belohnung ×1,25 (`nightBase` merkt die Tageswerte). Dazu bis zu 26 Zusatzgegner je Nacht (Düsterwald, Moorlande, Totenacker, Hochland, Aschenöde) an Ruheplätzen vorhandener Monster, gewählt per Hash aus der Nachtnummer (kein `w.rng`), nicht näher als 9 Kacheln an einem Spieler; am Morgen weg (über `expireAt`, kämpfende nach Schonfrist), tot kommen sie nicht wieder.
- **UI:** Uhr im Porträt („☀ 14:05“, „☾ 22:40 · Nacht“).
- **Außerhalb der genannten Dateien angefasst:** `tiled.ts` (Nacht-NPCs anlegen), `net/client.ts`, `talk.ts`, `topicsData.ts` (Themen, `topics.test` verlangt sie); Tests angepasst (`town`, `p3`, `camp`, `wildlife`: Tages-NPCs zählen ohne Nacht-NPCs, Zufallsbegegnungen ohne Nachtgänger).
- **Golden-Snapshots:** unverändert (`git diff 18b5d69..HEAD -- src/sim/__snapshots__` leer): die erste Nacht beginnt bei Tick 15 600, `syncClock` nutzt weder `w.rng` noch `w.fx`, Nacht-NPC-Kennungen verschieben `nextId` nicht.
- **Prüfung:** tsc, Lint, 441 Tests, Build grün. Browser (Dev-Build, `python3 -m http.server`): Totenacker bei Tag 37 / Nacht 46 Monster (Untote 19 → 28; Friedhofsgeist HP 202 → 253, Schaden 10–19 → 12–23, Wahrnehmung 4 → 5,5), Zusatzgegner am Morgen weg; Mirel nachts „(geschlossen)“ mit Meldung; Hehler verkauft ein Weisheitsamulett; Mehrspieler mit `npm run server`: zwei Clients gleicher Tick (21:27 Nacht ≈ 13 Min. nach Serverstart), Läden zu, Servermeldung beim Kauf bei Dorn.
- **Pace** (`npm run pace`, 6 Seeds; vorher = `18b5d69`, nachher = P6, dritte Spalte = P6 mit absichtlich offenen Läden; alle in Scratch-Worktrees mit demselben `pace.sim.ts`):

| Seed | vorher L30 | nachher L30 | Läden offen L30 |
|---|---|---|---|
| 2024 | 25,1 h | 25,6 h | 25,3 h |
| 7 | 22,6 h | 28,4 h | 26,4 h |
| 99 | 33,5 h | 33,2 h | 25,2 h |
| 11 | 23,0 h | 30,1 h | 21,2 h |
| 12 | 20,9 h | 36,5 h | 21,8 h |
| 13 | 24,7 h | 27,1 h | 23,8 h |
| Median | 23,9 h | 29,3 h | 24,5 h |

  **Befund:** Die Nachtgegner allein kosten etwa 0,6 h im Median (Spalte 3). Der Sprung auf 29 h kommt von den geschlossenen Läden: der Bot (`pace.sim.ts`, nicht geändert) fährt zum nächsten `merchant`, verkauft nachts nichts und pendelt bis 5:30 zwischen Stadt und Jagd (Stadtfahrten 5800–13500 statt ~170). Das ist ein Bot-Artefakt (ein Spieler jagt nachts und verkauft tagsüber), zeigt aber auch: schwere Taschen kosten nachts Zeit. Seed 99 (33,5 h vorher) ist die schon bekannte Bot-Schleife aus P4.
- **Mängel / offen:** (1) Jeder Neustart (Seite neu laden, Server neu starten) setzt die Uhr auf 8 Uhr; Einzelspieler-Sitzungen unter 13 Minuten sehen keine Nacht. (2) Gegner, die erst während der Nacht entstehen (Zufallsbegegnungen), bekommen keine Nachtwerte. (3) Die Hover-Gefahrenfarbe ignoriert die Nachtwerte. (4) Online setzt `?stunde=` nur Bild und HUD, die Sim folgt dem Server. (5) Der Nachthändler bietet auch die „Auf Bestellung“-Ware (benannte Funde) an, weil jeder NPC mit `shop` als Laden zählt. (6) Der Pace-Bot sollte nachts jagen und tagsüber verkaufen (Sache von `bot-schleife`). (7) Alles im Browser-Pane unter hoher Systemlast (~1 fps) gesehen, die Nachtstimmung im Bild nicht ausführlich begutachtet.
