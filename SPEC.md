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
