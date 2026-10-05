/**
 * Lader für die Fremd-Sprites (Dungeon Crawl Stone Soup, CC0 – siehe ASSETS.md).
 * Import-sicher in Node (Tests): ohne `Image` bleibt alles beim prozeduralen Fallback.
 * Lädt nie nach dem Start nach: `sprite()` liefert nur, was `preloadSprites()` geholt hat.
 */

const BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}assets/dcss/`;

const store = new Map<string, HTMLImageElement>();
let loaded = 0;
let failed = 0;

/** Geladenes Sprite oder `null` (nicht vorhanden/nicht geladen → Aufrufer nimmt den Fallback). */
export function sprite(path: string): HTMLImageElement | null {
  return store.get(path) ?? null;
}

export function spriteStats(): { loaded: number; failed: number } {
  return { loaded, failed };
}

/** Lädt alle Pfade parallel; Fehler und Zeitüberschreitung sind erlaubt (dann Fallback). */
export function preloadSprites(paths: string[], timeoutMs = 8000): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    let open = paths.length;
    if (open === 0) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    const done = (): void => {
      if (--open === 0) {
        clearTimeout(timer);
        resolve();
      }
    };
    for (const p of paths) {
      const img = new Image();
      img.onload = () => {
        store.set(p, img);
        loaded++;
        done();
      };
      img.onerror = () => {
        failed++;
        done();
      };
      img.src = BASE + p;
    }
  });
}
