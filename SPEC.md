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
