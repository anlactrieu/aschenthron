/**
 * Lader für das Ninja-Adventure-Paket (Pixel-Boy und AAA, CC0 – siehe ASSETS.md): nur noch Figuren im Vergleichsmodus
 * und der HUD-Pfad (`NINJA_BASE`); die Welt ist per Code gezeichnet. Import-sicher in Node (Tests).
 * Lädt nie nach dem Start nach: `ninjaImg()` liefert nur, was `preloadNinja()` geholt hat.
 */

export const NINJA_BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}assets/ninja/`;
/** Geladenes Sheet (Figuren, Waffen) */
export type NinjaSrc = HTMLImageElement | HTMLCanvasElement;
const store = new Map<string, NinjaSrc>();

export function ninjaImg(path: string): NinjaSrc | null {
  return store.get(path) ?? null;
}

export function preloadNinja(paths: string[], timeoutMs = 8000): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    let open = paths.length;
    if (open === 0) return resolve();
    const timer = setTimeout(resolve, timeoutMs);
    const done = (): void => {
      if (--open === 0) {
        clearTimeout(timer);
        resolve();
      }
    };
    for (const p of paths) {
      const img = new Image();
      img.onload = () => { store.set(p, img); done(); };
      img.onerror = done;
      img.src = NINJA_BASE + p;
    }
  });
}
