# Aschenthron

Dark-Fantasy-ARPG im Browser (Mac). Feste offene Insel „Aschental“, klassenloser Charakter, Loot-Grind, später PvP.

## Starten
```bash
npm install     # nur beim ersten Mal / nach Updates
npm run dev     # dann http://localhost:5173 öffnen
```
Steuerung: Klick = laufen/angreifen/aufheben/Truhe öffnen · I Inventar (Gegenstände per Drag-and-drop anlegen, in den Köcher füllen, verkaufen) · C Charakter · K Fertigkeiten · J Aufgaben · 1–9 Fertigkeit wählen, dann Ziel anklicken (Rechtsklick/Esc bricht ab; Heilung und Rundum-Zauber wirken sofort) · Q/E Heil-/Manatrank · R Rasten · N Karte · M Ton · Esc Fenster schließen. Neustart: `?neu`, Bildrate: `?fps`, Zeitlupe der Effekte: `?slowfx`.

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

Details: `SPEC.md` (Konzept, Annahmen), `HANDOFF.md` (Stand für die nächste Session).
