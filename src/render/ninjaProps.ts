/**
 * Früher: Props und Bodendetails aus den Ninja-Adventure-Tilesets. Die Welt ist jetzt komplett per Code gezeichnet
 * (`world/*`), darum lädt der Start keine Tilesets mehr. Ninja-Figuren (Vergleichsmodus) lädt `ninjaFigures.ts` selbst,
 * HUD-Rahmen und Schrift kommen per CSS-URL (`theme.ts`).
 */

/** Vorladen beim Start (Aufruf in main.ts): keine Kachelbilder mehr nötig */
export const preloadAllNinja = (): Promise<void> => Promise.resolve();
