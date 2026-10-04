# HANDOFF – Aschenthron

## Stand
Meilenstein 1 (Karte, Bewegung, Kampf) und 2 (Drops, Inventar, Gewicht, Affixe) fertig. Code in `src/sim` (reine Logik) und `src/render` (Phaser + DOM-Inventar, Taste I). Nächster Schritt: Meilenstein 3 (Attribute, Leveln, Lehrer). Dev: `npm run dev`. Git-Repo (`main`). Alles Wichtige steht in `SPEC.md`.
`Browserspiele/` und `Spiele/` sind per `.gitignore` bewusst nicht im Repo.

## Letzte 3 Entscheidungen
1. **Pivot auf T4C-Vorbild** (D4O = Die Vierte Offenbarung, nicht Diablo 4): feste offene Welt, klassenlos, Extraction gestrichen. Grund: das Spielgefühl, das der User will.
2. **Wenige zähe Gegner statt Horden, Karten als Tiled-Daten.** Grund: T4C-Grind-Gefühl; Tiled macht Karten später vom User editierbar.
3. **Haltbarkeit/Reparatur und Dunkle Künste nicht im Scope.** Grund: User hat sie bewusst nicht gewählt.

## Offene TODOs
- Frische Session starten, SPEC.md lesen, mit Meilenstein 1 beginnen
- Asset-Pack wählen (oder Platzhalter-Diamant-Tiles) vor dem Kartenbau, Lizenzen in `ASSETS.md`
- Skill-Liste, Monster, Items, Lore eigenständig entwerfen (nichts aus T4C kopieren)
- Bibliotheksversionen prüfen, nicht aus dem Gedächtnis

## Dateien
- `SPEC.md` (Single Source of Truth), `.gitignore`, diese `HANDOFF.md`

## Learnings
- "D4O" des Users = T4C, nie als Diablo 4 deuten.
- `AskUserQuestion`: max. 4 Fragen und max. 4 Optionen pro Frage.
