# Aschenthron

Dark-Fantasy-ARPG im Browser (Mac). Feste offene Insel „Aschental“, klassenloser Charakter, Loot-Grind, später PvP.

## Starten
```bash
npm install     # nur beim ersten Mal / nach Updates
npm run dev     # dann http://localhost:5173 öffnen
```
Steuerung: Klick = laufen/angreifen/aufheben/Truhe öffnen · I Inventar (Gegenstände per Drag-and-drop anlegen, verkaufen; zwölf Felder; Pfeile für den Bogen oder ein Schild kommen in die Nebenhand, Pfeile sind unendlich; Zweihandwaffen sperren die Nebenhand, Bögen erlauben nur Pfeile; Edelsteine setzt der Schmied in Sockel) · C Charakter · K Fertigkeiten · J Aufgaben · 1–9 Fertigkeit wählen, dann Ziel anklicken (Rechtsklick/Esc bricht ab; Heilung und Rundum-Zauber wirken sofort) · Q/E Heil-/Manatrank · R Rasten · N Karte · M Ton · F1 Credits · Esc Fenster schließen. Neustart: `?neu`, Bildrate: `?fps`, Zeitlupe der Effekte: `?slowfx`, feste Uhrzeit: `?stunde=22`, Wetter erzwingen: `?wetter=regen|nebel|asche|klar`.

Welt: Tag und Nacht laufen in Echtzeit (24 Minuten je Zyklus, nur Optik; Dungeons und Städte bleiben dunkel bzw. heller), Wetter wechselt je Außenzone (Regen, Nebel, Ascheflocken). Benannte NPCs (Chronistin Maren, Jägerin Ysa, Eremit Olm, Torwache Haldor, Schatzsucher Pell, Ritter Aldric) sprechen im Gesprächsfenster und geben Aufgabenketten (Besuch, Sammeln, Gespräch, Jagd); Ziele erscheinen auf der Karte (N) als gelbe Rauten, J zeigt Ketten, Ziel und Ort. Dungeons: Goblinbau (Stufe 8–12), Spinnennest (13–18); Elite-Zone Aschengrund (28–32) hinter der Aschenöde; drei Weltbosse (Moorlande, Hochland, Aschengrund) mit 25–40 Minuten Wartezeit.

## Mehrspieler (Server + PvP, experimentell)
```bash
npm run server                      # Terminal 1: Server, nur lokal erreichbar (127.0.0.1:8899)
# Browser: http://localhost:5173/?server=ws://127.0.0.1:8899&name=DeinName
```
- Für Freunde im selben Netzwerk: `HOST=0.0.0.0 npm run server` (es gibt keine Anmeldung, nur Namen; nur im vertrauten Netz nutzen).
- `PVP=0` schaltet Spieler-gegen-Spieler aus, `PORT=…` ändert den Port, `SAVE=datei.json` die Spielstand-Datei.
- PvP: nur außerhalb der Städte. Wer einen Unbeteiligten angreift, wird 10 Minuten zum Mörder (☠, überall angreifbar, auch in Städten). Notwehr zählt nicht. Beim Tod fallen Items an der Todesstelle (alle dürfen sie aufheben).

## Prüfen
`npm test` · `npm run lint` · `npm run build` · `npm run pace` (Bot-Messlauf Level-Tempo)
Karte neu erzeugen: `python3 scripts/gen_map.py --preview`.

## Grafik und Lizenzen
Figuren, Monster, NPCs, Truhen sowie Item- und Skill-Icons stammen aus „Dungeon Crawl 32x32 Tiles“ (Dungeon Crawl Stone Soup, **CC0**, https://opengameart.org/content/dungeon-crawl-32x32-tiles); Terrain, Wände und Effekte werden im Code gezeichnet. Fehlt ein Sprite, greift die prozedurale Grafik als Fallback. Quellen, Lizenzprüfung und Dateiliste: `ASSETS.md`; im Spiel F1 (Credits). Sprites neu importieren: `python3 scripts/import_dcss.py "<entpacktes Paket>"`.

Details: `SPEC.md` (Konzept, Annahmen), `HANDOFF.md` (Stand für die nächste Session).
