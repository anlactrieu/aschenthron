# SPEC – Aschenthron (Dark-Fantasy-ARPG im Geist von T4C)

> Aktuelle Arbeit steht in `PLAN.md`. Alte Pläne, Umsetzungsstände und Nachtarbeit liegen in `docs/archiv/` (`SPEC-bis-2026-11-11.md`, `HANDOFF-bis-2026-11-11.md`).

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

## Rechtliches / Eigenständigkeit
Orientierung an T4C nur bei Spielprinzipien (Mechaniken lassen sich nicht schützen). **Nichts kopieren:** keine Namen, Skill- oder Item-Bezeichnungen, Texte, Karten, Grafiken, Sounds oder Logos aus T4C. Alle Skills, Items, Orte und Lore werden eigenständig erfunden. Eigene Namen und eigene Welt, keine Anspielungen auf T4C im Spiel oder Namen.

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

### Entscheidungen des Nutzers (2026-11-04)
1. **Ansicht:** erst Inhalte (P1–P7), Iso-Entscheidung später (P9 zurückgestellt).
2. **Level-Tempo:** auf **20–30 h** bis Stufe 30 strecken, Cap bleibt 30.
3. **Beute:** **fast nur benannte, feste Gegenstände** wie bei T4C (Zufallsaffixe nur noch Ausnahme).
4. **Gespräche:** Stichworte **nur anklicken**, kein Eintippen.
5. **Todesstrafe (2026-11-06):** so nah wie möglich an D4O, aber mit unserem System harmonisiert (bestehender Leichenlauf, 5 % der Stufenspanne, gestreckte Kurve aus P3, benannte Beute, Safe-Zonen). Umsetzung in P4: D4O-Regeln recherchieren (Quellen belegt/vermutet trennen), Abweichungen begründen.
Noch offen: 6 Fertigkeiten, 7 Wegweiser, 8 zweite Insel (siehe unten).
6. **T4C-Stufe 2 (2026-11-11):** Wegweiser ganz entfernen · Beute gezielt zurückbauen (Truhen, Lichtstrahlen, Zufallsaffixe raus; Sets und Edelsteine bleiben) · Pixel-Stil bleibt, Stimmung anheben · erst Wiedergeburt, dann zweite Insel. Zielbild, Befund und Pakete T0–T8 stehen in `PLAN.md`.

### Offene Entscheidungen für den Nutzer
1. **Ansicht:** Draufsicht behalten · auf Iso umbauen (4–6 Sessions, Probe `probe/iso/`) · erst Inhalte (P1–P7), Ansicht später. **Entschieden 2026-11-07: Iso 2:1, Plan unter „Umsetzungsplan P9 Iso“.**
2. **Level-Tempo:** Stufe 30 heute nach ≈ 8 h (Bot). Strecken (z. B. 20–30 h), Levelcap anheben oder lassen?
3. **Beute:** Zufallsaffixe behalten und benannte Funde ergänzen, oder überwiegend feste, benannte Gegenstände wie bei T4C?
4. **Gespräche:** Stichworte anklicken, eintippen oder beides?
5. **Todesstrafe:** so lassen oder schärfer (Gold-Anteil, mehr Gegenstände)?
6. **Fertigkeiten:** Rang 1–5 lassen oder als steigende Zahlenwerte beim Lehrer trainieren (großer Umbau)?
7. **Wegweiser:** „Hinlaufen“ und Richtungspfeil behalten, abschaltbar machen („Entdecken-Modus“) oder entfernen?
8. **Zweite Insel (P8):** ja und wann?

## Stack und Prüfung
TypeScript + Vite (Build), Vitest (Tests), ESLint (Lint), Phaser nur fürs Rendering. Versionen in der Umsetzungs-Session prüfen, nicht aus dem Gedächtnis. Vor jeder „fertig“-Meldung: Tests, Build, Lint laufen lassen.

## Prozess
Umsetzung auf Wunsch des Users in derselben Session (statt frischer Session). Stand: Meilensteine 1–6 umgesetzt, siehe HANDOFF.md. Git-Repo (`main`).
Advisor (Opus) an den Checkpoints laut ~/.claude/CLAUDE.md.
