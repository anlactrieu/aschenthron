/**
 * Lader und Zuordnung für das Ninja-Adventure-Paket (Pixel-Boy und AAA, CC0 – siehe ASSETS.md).
 * Import-sicher in Node (Tests): ohne `Image` bleibt alles beim prozeduralen Fallback.
 * Lädt nie nach dem Start nach: `ninjaImg()` liefert nur, was `preloadNinja()` geholt hat.
 */

export const NINJA_BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}assets/ninja/`;
const store = new Map<string, HTMLImageElement>();

export function ninjaImg(path: string): HTMLImageElement | null {
  return store.get(path) ?? null;
}

/**
 * Zentrale Stellschraube für den Dark-Fantasy-Look: alle Kachel-Sheets (Boden, Häuser, Props) werden beim Laden
 * entsättigt, leicht gekühlt und abgedunkelt, damit sie neben den DCSS-Figuren nicht bunt und weich wirken.
 * Figuren-Sheets (Character, Items …) bleiben unberührt.
 */
export const NINJA_GRADE = {
  /** Sättigung bleibt zu diesem Anteil (0.6 = −40 %) */
  sat: 0.6,
  /** Für überwiegend blaue Pixel (Wasser): schwächere Entsättigung */
  satWater: 0.85,
  /** Helligkeitsfaktor */
  lum: 0.9,
  /** Kühlung: Rot-/Blau-Faktor */
  r: 0.96,
  b: 1.05,
  /** Sheets mit abweichendem Helligkeitsfaktor (Dungeons sind schon sehr dunkel) */
  lumBySheet: { TilesetDungeon: 1 } as Record<string, number>,
};

/** Wendet `NINJA_GRADE` auf RGBA-Pixel an (in place, Alpha unberührt). */
export function gradePixels(d: Uint8ClampedArray, lumFactor: number = NINJA_GRADE.lum): void {
  const G = NINJA_GRADE;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const y = r * 0.3 + g * 0.59 + b * 0.11;
    const s = b > r && b > g * 0.95 ? G.satWater : G.sat;
    r = y + (r - y) * s;
    g = y + (g - y) * s;
    b = y + (b - y) * s;
    d[i] = r * G.r * lumFactor;
    d[i + 1] = g * lumFactor;
    d[i + 2] = b * G.b * lumFactor;
  }
}

/** Dieselbe Abtönung für einzelne RGB-Werte (prozedurale Häuser-Paletten). */
export function gradeRgb(c: readonly [number, number, number]): [number, number, number] {
  const d = new Uint8ClampedArray([c[0], c[1], c[2], 255]);
  gradePixels(d);
  return [d[0]!, d[1]!, d[2]!];
}

const GRADED_DIR = 'Backgrounds/Tilesets/';

/** Liefert für Kachel-Sheets eine abgetönte Canvas-Kopie (als Bildquelle verwendbar), sonst das Bild selbst. */
function gradeSheet(path: string, img: HTMLImageElement): HTMLImageElement {
  if (!path.startsWith(GRADED_DIR) || typeof document === 'undefined') return img;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return img;
  g.drawImage(img, 0, 0);
  const name = path.slice(GRADED_DIR.length).replace(/\.png$/, '');
  const data = g.getImageData(0, 0, c.width, c.height);
  gradePixels(data.data, NINJA_GRADE.lumBySheet[name] ?? NINJA_GRADE.lum);
  g.putImageData(data, 0, 0);
  // Canvas dient überall nur als drawImage-Quelle mit width/height – wie ein geladenes Bild.
  return c as unknown as HTMLImageElement;
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
      img.onload = () => { store.set(p, gradeSheet(p, img)); done(); };
      img.onerror = done;
      img.src = NINJA_BASE + p;
    }
  });
}

/** Boden-Tilesets, aus denen die flachsten (vollständig deckenden) Zellen zur Zielfarbe gesucht werden. */
const SHEETS = ['TilesetField', 'TilesetFloor', 'TilesetRelief', 'TilesetWater', 'TilesetDungeon', 'TilesetDesert', 'TilesetNature', 'TilesetElement'].map((n) => `Backgrounds/Tilesets/${n}.png`);
export const NINJA_GROUND_FILES = SHEETS;

/** Zielfarbe (RGB) je Kachelnummer; die passendste, möglichst flache 16x16-Zelle wird beim ersten Zugriff gesucht. */
export const GROUND: Record<number, [number, number, number]> = {
  1: [150, 150, 160], 3: [105, 135, 80], 4: [106, 168, 58], 5: [112, 102, 124], 6: [70, 150, 215], 7: [196, 150, 92],
  8: [120, 142, 100], 9: [122, 100, 96], 12: [236, 110, 30], 15: [170, 116, 64], 16: [168, 160, 146], 17: [106, 168, 58],
};

export interface Cell { img: HTMLImageElement; tx: number; ty: number }
const found = new Map<number, Cell | null>();

/** Sucht über alle geladenen Sheets die Zelle mit kleinstem Farbabstand plus Streuungsstrafe (flach = Füllfläche). */
export function groundCell(gid: number): Cell | null {
  if (found.has(gid)) return found.get(gid)!;
  const t = GROUND[gid];
  let best: Cell | null = null;
  if (t && typeof document !== 'undefined') {
    let bestScore = Infinity;
    for (const f of SHEETS) {
      const img = ninjaImg(f);
      if (!img) continue;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      for (let y = 0; y + 16 <= img.height; y += 16) {
        for (let x = 0; x + 16 <= img.width; x += 16) {
          const d = g.getImageData(x, y, 16, 16).data;
          let r = 0, gg = 0, b = 0, l = 0, l2 = 0, ok = true;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3]! < 255) { ok = false; break; }
            r += d[i]!; gg += d[i + 1]!; b += d[i + 2]!;
            const lum = d[i]! * 0.3 + d[i + 1]! * 0.6 + d[i + 2]! * 0.1;
            l += lum; l2 += lum * lum;
          }
          if (!ok) continue;
          r /= 256; gg /= 256; b /= 256; l /= 256; l2 /= 256;
          const sd = Math.sqrt(Math.max(0, l2 - l * l));
          const score = Math.hypot(r - t[0], gg - t[1], b - t[2]) + sd * 1.2;
          if (score < bestScore) { bestScore = score; best = { img, tx: x / 16, ty: y / 16 }; }
        }
      }
    }
  }
  found.set(gid, best);
  return best;
}
