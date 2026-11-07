/**
 * Zeichenhelfer für Iso-Gebäude und -Props (P9.3): Flächen im Raum mit Z-Puffer in ein Kunstraster, Umriss am Rand (wie die Probe
 * `scripts/bake-iso-probe.ts` im Git-Stand 229f3f1). Koordinaten sind Rasterkoordinaten (Kachelmitten ganzzahlig) plus Höhe z in Einheiten zu 16
 * Kunstpixeln; ein Kunstpixel wird mit Maßstab 2 gezeigt. Ohne DOM nutzbar.
 */
import { INK, Raster, mix, type Rgb } from './world/raster';
import { project } from './iso';

/** Höhe einer Einheit in Kunstpixeln */
export const UZ = 16;

export type Shade = (s: number, t: number) => Rgb | null;

/** Bildausschnitt in Bildschirm-Pixeln (sx/sy gerade) und seine Größe in Kunstpixeln */
export interface Frame { sx: number; sy: number; w: number; h: number }

/** Hülle aller Raumpunkte [x, y, z] plus Rand `pad` Kunstpixel; ausgerichtet auf Vielfache von 2 Bildschirm-Pixeln */
export function frameOf(pts: readonly (readonly [number, number, number])[], pad = 2): Frame {
  const p = pts.map(([x, y, z]) => {
    const q = project(x, y);
    return { sx: q.sx, sy: q.sy - z * UZ * 2 };
  });
  const x0 = Math.floor(Math.min(...p.map((q) => q.sx)) / 2) * 2 - pad * 2;
  const x1 = Math.ceil(Math.max(...p.map((q) => q.sx)) / 2) * 2 + pad * 2;
  const y0 = Math.floor(Math.min(...p.map((q) => q.sy)) / 2) * 2 - pad * 2;
  const y1 = Math.ceil(Math.max(...p.map((q) => q.sy)) / 2) * 2 + pad * 2;
  return { sx: x0, sy: y0, w: (x1 - x0) / 2, h: (y1 - y0) / 2 };
}

export class Quads {
  readonly r: Raster;
  private depth: Float32Array;
  constructor(private f: Frame) {
    this.r = new Raster(f.w, f.h);
    this.depth = new Float32Array(f.w * f.h).fill(-1e9);
  }

  /** Raumpunkt → Kunstpixel im Raster */
  proj(x: number, y: number, z: number): [number, number] {
    const p = project(x, y);
    return [(p.sx - this.f.sx) / 2, (p.sy - this.f.sy) / 2 - z * UZ];
  }

  /** Fläche aus Ursprung O und den Kanten E1/E2; `shade(s, t)` liefert die Farbe (null = durchsichtig) */
  quad(O: readonly number[], E1: readonly number[], E2: readonly number[], shade: Shade): void {
    const P = (s: number, t: number): number[] => [O[0]! + E1[0]! * s + E2[0]! * t, O[1]! + E1[1]! * s + E2[1]! * t, O[2]! + E1[2]! * s + E2[2]! * t];
    const [u0, v0] = this.proj(O[0]!, O[1]!, O[2]!);
    const [ua, va] = this.proj(O[0]! + E1[0]!, O[1]! + E1[1]!, O[2]! + E1[2]!);
    const [ub, vb] = this.proj(O[0]! + E2[0]!, O[1]! + E2[1]!, O[2]! + E2[2]!);
    const m00 = ua - u0, m01 = ub - u0, m10 = va - v0, m11 = vb - v0;
    const det = m00 * m11 - m01 * m10;
    if (Math.abs(det) < 1e-6) return;
    const xs = [u0, ua, ub, ua + ub - u0];
    const ys = [v0, va, vb, va + vb - v0];
    const { w, h } = this.f;
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x++) {
        const du = x + 0.5 - u0;
        const dv = y + 0.5 - v0;
        const s = (m11 * du - m01 * dv) / det;
        const t = (-m10 * du + m00 * dv) / det;
        if (s < 0 || t < 0 || s > 1 || t > 1) continue;
        const q = P(s, t);
        const d = q[0]! + q[1]! + q[2]!;
        const i = y * w + x;
        if (d < this.depth[i]!) continue;
        const c = shade(s, t);
        if (c === null) continue;
        this.depth[i] = d;
        this.r.set(x, y, c);
      }
    }
  }

  /** Quader [x0..x1] × [y0..y1] × [z0..z1] mit den drei sichtbaren Flächen (Süd, Ost, Oben) */
  box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, south: Shade, east: Shade, top: Shade): void {
    this.quad([x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], south);
    this.quad([x1, y1, z0], [0, y0 - y1, 0], [0, 0, z1 - z0], east);
    this.quad([x0, y1, z1], [x1 - x0, 0, 0], [0, y0 - y1, 0], top);
  }

  /** Umriss: deckende Pixel mit leerem Nachbarn werden Tinte */
  done(): Raster {
    const { r } = this;
    const edge: number[] = [];
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if (!r.filled(x, y)) continue;
        if (!r.filled(x - 1, y) || !r.filled(x + 1, y) || !r.filled(x, y - 1) || !r.filled(x, y + 1)) edge.push(y * r.w + x);
      }
    }
    for (const i of edge) r.set(i % r.w, Math.floor(i / r.w), INK);
    return r;
  }
}

/** Ton aus einer 5er-Rampe (k 0..4, Bruchteile mischen) */
export function toneOf(ramp: readonly Rgb[], k: number): Rgb {
  const c = Math.max(0, Math.min(4, k));
  const i = Math.floor(c);
  return i >= 4 ? ramp[4]! : mix(ramp[i]!, ramp[i + 1]!, c - i);
}

/** Weicher Lichtfleck (additiv gedacht): Deckkraft fällt von der Mitte nach außen quadratisch ab */
export function glowSpot(r: Raster, cx: number, cy: number, rad: number, c: Rgb, peak = 200): void {
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
    for (let x = Math.floor(cx - rad * 1.25); x <= Math.ceil(cx + rad * 1.25); x++) {
      const d = Math.hypot((x + 0.5 - cx) / 1.25, y + 0.5 - cy) / rad;
      if (d >= 1) continue;
      const a = Math.round(peak * (1 - d) * (1 - d));
      if (a > (r.get(x, y) >>> 24)) r.set(x, y, c, a);
    }
  }
}
