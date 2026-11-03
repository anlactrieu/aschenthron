/**
 * Kleiner Pixel-Puffer für die Code-Welt (Boden, Wände, Häuser, Props): gezeichnet wird im Kunstraster (eine Kachel =
 * 24x24 Kunstpixel), angezeigt mit ganzzahligem Maßstab 2 (`ART_SCALE`). Ohne DOM nutzbar (Node-Kontaktbögen per
 * `scripts/bake-world.ts`); erst `toCanvas` braucht ein Dokument. Arbeitsweise wie pixelfx: harte Tonstufen aus kurzen
 * Rampen, Licht von oben links, kräftiger Umriss nur an Objekten.
 */

/** Kunstpixel je Kachel und Anzeige-Maßstab (24 * 2 = 48 = TILE_W) */
export const ART = 24;
export const ART_SCALE = 2;

/** Farbe als 0xRRGGBB; im Puffer liegt sie als ABGR (Byte-Reihenfolge von ImageData) */
export type Rgb = number;

export const abgr = (c: Rgb, a = 255): number => ((a << 24) | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
export const rgbOf = (p: number): Rgb => ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);

export class Raster {
  readonly d: Uint32Array;
  constructor(readonly w: number, readonly h: number) {
    this.d = new Uint32Array(w * h);
  }
  set(x: number, y: number, c: Rgb, a = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = abgr(c, a);
  }
  /** Halbtransparent über das Vorhandene legen (k 0..1) */
  blend(x: number, y: number, c: Rgb, k: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const p = this.d[i]!;
    if (!(p >>> 24)) return;
    this.d[i] = abgr(mix(rgbOf(p), c, k), p >>> 24);
  }
  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]!;
  }
  filled(x: number, y: number): boolean {
    return this.get(x, y) >>> 24 > 0;
  }
  rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  /** Gefüllte Ellipse (Mittelpunkt, Halbachsen) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Rgb | ((x: number, y: number, nx: number, ny: number) => Rgb | null)): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const col = typeof c === 'number' ? c : c(x, y, nx, ny);
        if (col !== null) this.set(x, y, col);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Rgb): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  /** Anderen Puffer hineinkopieren (nur deckende Pixel), optional gespiegelt */
  blit(src: Raster, ox: number, oy: number, flip = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const p = src.d[y * src.w + (flip ? src.w - 1 - x : x)]!;
        if (!(p >>> 24)) continue;
        const tx = ox + x;
        const ty = oy + y;
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const a = p >>> 24;
        if (a === 255) this.d[ty * this.w + tx] = p;
        else {
          const q = this.d[ty * this.w + tx]!;
          this.d[ty * this.w + tx] = q >>> 24 ? abgr(mix(rgbOf(q), rgbOf(p), a / 255), 255) : p;
        }
      }
    }
  }
  /** Umriss um alle deckenden Pixel (4er-Nachbarschaft), in einen um 1 größeren Rand */
  outline(ink: Rgb = INK): Raster {
    const out = new Raster(this.w + 2, this.h + 2);
    out.blit(this, 1, 1);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        // gegen die Quelle prüfen (um 1 versetzt), sonst zählen frisch gesetzte Umrisspixel mit
        if (this.filled(x - 1, y - 1)) continue;
        if (this.filled(x - 2, y - 1) || this.filled(x, y - 1) || this.filled(x - 1, y - 2) || this.filled(x - 1, y)) out.set(x, y, ink);
      }
    }
    return out;
  }
}

/** Umrissfarbe der Objekte (wie beim Skelett-Helden) */
export const INK: Rgb = 0x0c0a0e;

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
export const scale = (c: Rgb, k: number): Rgb => {
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};
export const css = (c: Rgb, a = 1): string => (a >= 1 ? `#${c.toString(16).padStart(6, '0')}` : `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`);

/* ---------------------------------------------------------------- Zufall und Rauschen (deterministisch) */

/** Hash dreier ganzer Zahlen → 0..1 */
export function h3(a: number, b: number, c = 0): number {
  let t = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  t = Math.imul(t ^ (t >>> 15), 2246822519);
  t = Math.imul(t ^ (t >>> 13), 3266489917);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Wertrauschen 0..1 mit Wellenlänge `s`; `period` (Vielfaches von s) macht es kachelbar */
export function vnoise(x: number, y: number, s: number, seed = 0, period = 0): number {
  // kachelbar nur mit ganzer Zellenzahl je Periode: Wellenlänge passend runden
  if (period) s = period / Math.max(1, Math.round(period / s));
  const fx = x / s;
  const fy = y / s;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const p = period ? period / s : 0;
  const w = (v: number): number => (p ? ((v % p) + p) % p : v);
  const sm = (t: number): number => t * t * (3 - 2 * t);
  const a = h3(w(ix), w(iy), seed);
  const b = h3(w(ix + 1), w(iy), seed);
  const c = h3(w(ix), w(iy + 1), seed);
  const d = h3(w(ix + 1), w(iy + 1), seed);
  const top = a + (b - a) * sm(tx);
  const bot = c + (d - c) * sm(tx);
  return top + (bot - top) * sm(ty);
}

/** Zwei Oktaven Wertrauschen 0..1 */
export function fbm(x: number, y: number, s: number, seed = 0, period = 0): number {
  return vnoise(x, y, s, seed, period) * 0.65 + vnoise(x, y, s / 2, seed + 7, period) * 0.35;
}

/** Deterministischer Zufallsstrom */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    s ^= s >>> 12;
    return (s >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- Ausgabe */

/** RGBA-Bytes des Puffers (für ImageData oder PNG) */
export function bytes(r: Raster): Uint8ClampedArray {
  return new Uint8ClampedArray(r.d.buffer, r.d.byteOffset, r.d.byteLength);
}

/** Zeichenfläche im Maßstab k (Standard 2), nächster Nachbar. Braucht ein Dokument. */
export function toCanvas(r: Raster, k = ART_SCALE): HTMLCanvasElement {
  const src = document.createElement('canvas');
  src.width = r.w;
  src.height = r.h;
  src.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(bytes(r)), r.w, r.h), 0, 0);
  if (k === 1) return src;
  const out = document.createElement('canvas');
  out.width = r.w * k;
  out.height = r.h * k;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Puffer k-fach vergrößert (für Node-Kontaktbögen) */
export function upscale(r: Raster, k: number): Raster {
  const out = new Raster(r.w * k, r.h * k);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.d[y * out.w + x] = r.d[Math.floor(y / k) * r.w + Math.floor(x / k)]!;
  return out;
}
