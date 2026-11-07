/**
 * Iso-Häuser (P9 Iso). Schnittstelle für GameScene, Inhalt gehört P9.3.
 * Ein Haus (aus `detectHouses`, Wandring samt Tür) wird zu wenigen Bildern (`IsoHousePart`). GameScene legt jedes Teil an seiner
 * Bildschirmposition ab (Maßstab 2, Ursprung links oben), schneidet es in Spalten von 32 px und gibt jeder Spalte die Tiefe der
 * vorderen bzw. hinteren Bodenkante der Grundfläche (`footprintColumns`, Feld `layer`). Ausblenden: `isoHouseFade` liefert die
 * Ziel-Deckkraft je Gruppe (`fade`), GameScene blendet weich dorthin. Die Wand- und Türkacheln des Rings zeichnet in Iso nur
 * dieses Modul (GameScene legt dafür keine Props an); der Boden darunter (Dielen) kommt wie bisher aus dem Boden-Chunk.
 * Platzhalter in P9.0: Kasten mit Satteldach nach der Vorlage `iso()` in `scripts/bake-iso-probe.ts`.
 * Ohne DOM nutzbar (reine Raster).
 */
import type { House } from './houses';
import { INK, Raster, h3, mix, type Rgb } from './world/raster';
import { project } from './iso';

/** Ausblend-Gruppen eines Hauses: Dach, Vorderwände, Rückwände (Innenseiten von Nord- und Westwand) */
export type IsoFade = 'roof' | 'walls' | 'back';

export interface IsoHousePart {
  /** Textur-Schlüssel (eindeutig je Haus und Teil) */
  key: string;
  make: () => Raster;
  /** Bildschirmposition der linken oberen Bildecke (das Bild wird mit Maßstab 2 gezeigt) */
  sx: number;
  sy: number;
  /** Tiefe aus der vorderen (Vorderwände, Dach) oder hinteren Bodenkante (Rückwände, von innen gesehen) */
  layer: 'front' | 'back';
  /** Ausblend-Gruppe (Ziel-Deckkraft aus `isoHouseFade`); 'none' bleibt immer deckend */
  fade: IsoFade | 'none';
  /** additiv über allem (Fensterlicht nachts, Deckkraft = Nacht); P9.3 */
  light?: boolean;
}

/** Wandhöhe und Dachhöhe in Höheneinheiten (1 Einheit = 16 Kunstpixel), wie in der Probe */
const WH = 2.1;
const ROOF = 1.5;
const OVERHANG = 0.3;
const UZ = 16;

/** Grundfläche des Hauses in Rasterkoordinaten (Kachelkanten) */
function box(hs: House): { xa: number; ya: number; xb: number; yb: number } {
  return { xa: hs.x0 - 0.5, ya: hs.y0 - 0.5, xb: hs.x0 + hs.w - 0.5, yb: hs.y0 + hs.h - 0.5 };
}

/** Bildschirm-Hülle (Kunstpixel-genau, Vielfache von 2) aller Teile eines Hauses: links oben und Größe in Kunstpixeln */
function frame(hs: House): { sx: number; sy: number; w: number; h: number } {
  const { xa, ya, xb, yb } = box(hs);
  const pts = [[xa - OVERHANG, ya - OVERHANG], [xb + OVERHANG, ya - OVERHANG], [xa - OVERHANG, yb + OVERHANG], [xb + OVERHANG, yb + OVERHANG]].map(([x, y]) => project(true, x!, y!));
  const x0 = Math.floor(Math.min(...pts.map((p) => p.sx)) / 2) * 2;
  const x1 = Math.ceil(Math.max(...pts.map((p) => p.sx)) / 2) * 2;
  const y0 = Math.floor((Math.min(...pts.map((p) => p.sy)) - (WH + ROOF + 1.4) * UZ * 2) / 2) * 2;
  const y1 = Math.ceil(Math.max(...pts.map((p) => p.sy)) / 2) * 2 + 2;
  return { sx: x0, sy: y0, w: (x1 - x0) / 2, h: (y1 - y0) / 2 };
}

/** Teile eines Hauses (Platzhalter: Rückwände, Vorderwände, Dach). Reihenfolge = Zeichenreihenfolge bei gleicher Tiefe. */
export function isoHouseParts(hs: House): IsoHousePart[] {
  const f = frame(hs);
  const id = `${hs.x0}_${hs.y0}`;
  const part = (name: string, layer: IsoHousePart['layer'], fade: IsoHousePart['fade'], draw: (q: Quads) => void): IsoHousePart => ({
    key: `ih_${name}_${id}`, sx: f.sx, sy: f.sy, layer, fade,
    make: () => {
      const q = new Quads(f);
      draw(q);
      return q.done();
    },
  });
  const { xa, ya, xb, yb } = box(hs);
  const seed = hs.x0 * 31 + hs.y0 * 17;
  const plaster = PLASTER[hs.variant % PLASTER.length]!;
  const roof = ROOFS[hs.variant % ROOFS.length]!;
  const door = hs.door;
  return [
    // Innenseiten der Nord- und Westwand (nur zu sehen, wenn die Vorderwände ausgeblendet sind)
    part('back', 'back', 'back', (q) => {
      q.quad([xa, ya, 0], [hs.w, 0, 0], [0, 0, WH], wallShade(plaster, hs.w, -0.6, -1, seed));
      q.quad([xa, yb, 0], [0, -hs.h, 0], [0, 0, WH], wallShade(plaster, hs.h, -1.1, -1, seed + 1));
    }),
    // Süd- (licht) und Ostwand (Schatten), Tür auf der jeweiligen Seite
    part('walls', 'front', 'walls', (q) => {
      q.quad([xa, yb, 0], [hs.w, 0, 0], [0, 0, WH], wallShade(plaster, hs.w, 0.4, door?.side === 'S' ? door.x - hs.x0 : -1, seed));
      q.quad([xb, yb, 0], [0, -hs.h, 0], [0, 0, WH], wallShade(plaster, hs.h, -0.9, door?.side === 'E' ? hs.y0 + hs.h - 1 - door.y : -1, seed + 2));
    }),
    // Satteldach (First entlang x) mit Ostgiebel
    part('roof', 'front', 'roof', (q) => {
      const mid = (ya + yb) / 2;
      const top = WH + ROOF;
      q.quad([xa - OVERHANG, mid, top], [hs.w + 2 * OVERHANG, 0, 0], [0, yb + OVERHANG - mid, WH - 0.15 - top], roofShade(roof, hs.w, 0.6, seed));
      q.quad([xa - OVERHANG, mid, top], [hs.w + 2 * OVERHANG, 0, 0], [0, ya - OVERHANG - mid, WH - 0.15 - top], roofShade(roof, hs.w, -0.6, seed));
      q.quad([xb, yb, WH], [0, -hs.h, 0], [0, 0, ROOF], (s, t) => {
        const e = Math.abs(s - 0.5) * 2;
        if (t > 1 - e) return null;
        return t > 1 - e - 0.08 ? TIMBER[0]! : tone(plaster, 1.6);
      });
    }),
  ];
}

/**
 * Ziel-Deckkraft je Ausblend-Gruppe, wenn der Held auf (px, py) steht (Rasterkoordinaten, auch Zwischenwerte): im Haus Dach und
 * Vorderwände fast weg, die Rückwände bleiben; verdeckt (Fuß hinter der Vorderkante und unter der Dachspitze, im Bild also vom
 * Haus überdeckt, auch hinter Nord- oder Westwand) alles halb durchsichtig; vor der Tür das Dach halb. Werte wie das Dach der
 * Draufsicht (0,2 / 0,5).
 */
export function isoHouseFade(hs: House, px: number, py: number): Record<IsoFade, number> {
  const inside = px >= hs.x0 - 0.5 && px <= hs.x0 + hs.w - 0.5 && py >= hs.y0 - 0.5 && py <= hs.y0 + hs.h - 0.5;
  if (inside) return { roof: 0.2, walls: 0.2, back: 1 };
  if (covers(hs, px, py)) return { roof: 0.4, walls: 0.4, back: 0.4 };
  const d = hs.door;
  const near = !!d && Math.abs(px - d.x) <= 2 && Math.abs(py - d.y) <= 2;
  return { roof: near ? 0.5 : 1, walls: 1, back: 1 };
}

/** Liegt eine Figur auf (px, py) im Bild hinter dem Haus? Bildschirm-x innerhalb der Grundfläche, Fuß über der Vorderkante, Kopf unter der Dachspitze */
function covers(hs: House, px: number, py: number): boolean {
  const { xa, ya, xb, yb } = box(hs);
  const f = project(true, px, py);
  const L = project(true, xa, yb);
  const F = project(true, xb, yb);
  const Rt = project(true, xb, ya);
  const B = project(true, xa, ya);
  if (f.sx <= L.sx + 8 || f.sx >= Rt.sx - 8) return false;
  const on = (a: { sx: number; sy: number }, b: { sx: number; sy: number }): number => a.sy + ((f.sx - a.sx) * (b.sy - a.sy)) / (b.sx - a.sx || 1);
  const front = f.sx <= F.sx ? on(L, F) : on(F, Rt);
  const back = f.sx <= B.sx ? on(L, B) : on(B, Rt);
  // Kopf etwa 56 px über dem Fuß; das Haus reicht bis (Wand + Dach) über die hintere Kante
  return f.sy < front && f.sy - 40 > back - (WH + ROOF) * UZ * 2;
}

/* ---------------------------------------------------------------- Platzhalter-Zeichnung */

type Shade = (s: number, t: number) => Rgb | null;

const PLASTER: readonly (readonly Rgb[])[] = [
  [0x3a332c, 0x5a5044, 0x7a6e5c, 0x988a72, 0xb4a68a],
  [0x3a2e2a, 0x5a463c, 0x7a6252, 0x987c66, 0xb49a80],
  [0x34322c, 0x524e42, 0x726c5a, 0x8e8872, 0xaaa48a],
];
const ROOFS: readonly (readonly Rgb[])[] = [
  [0x12141c, 0x22283a, 0x343c52, 0x4a546c, 0x646e86],
  [0x2a1410, 0x4a221a, 0x6a3426, 0x8a4a34, 0xa66448],
  [0x1e1a10, 0x3a3220, 0x5a4c30, 0x7a6a44, 0x968658],
];
const TIMBER: readonly Rgb[] = [0x1a120c, 0x2e2016, 0x463222, 0x5e4630, 0x7a5c40];
const STONE: readonly Rgb[] = [0x1e1c20, 0x343038, 0x4a4650, 0x625e68, 0x7c7882];

/** Ton aus einer 5er-Rampe (k 0..4, Bruchteile mischen) */
function tone(ramp: readonly Rgb[], k: number): Rgb {
  const c = Math.max(0, Math.min(4, k));
  const i = Math.floor(c);
  return i >= 4 ? ramp[4]! : mix(ramp[i]!, ramp[i + 1]!, c - i);
}

/** Fachwerkwand: Sockel aus Stein, Balken, Fenster je zweite Kachel; `door` = Kachel (ab s = 0) mit Tür oder −1 */
function wallShade(pl: readonly Rgb[], len: number, lit: number, door: number, seed: number): Shade {
  return (s, t) => {
    const along = s * len;
    const z = t * WH;
    const tile = Math.floor(along);
    const fx = along - tile;
    if (tile === door && fx > 0.22 && fx < 0.78 && z < 1.05) return tone(TIMBER, (fx < 0.27 || fx > 0.73 || z > 0.98 ? 0 : 1.6) + lit);
    if (z < 0.32) return tone(STONE, 2 + lit + (h3(Math.floor(along * 3), Math.floor(z * 6), seed) < 0.3 ? -0.6 : 0));
    if (fx < 0.07 || fx > 0.93 || Math.abs(z - 1.05) < 0.06 || z > WH - 0.1) return tone(TIMBER, 1 + lit);
    const upper = z > 1.05;
    const win = upper ? tile % 2 === 1 : tile % 2 === 0 && tile > 0 && tile < Math.floor(len) - 1 && tile !== door;
    const wz = upper ? [1.35, 1.8] : [0.45, 0.88];
    if (win && fx > 0.32 && fx < 0.68 && z > wz[0]! && z < wz[1]!) return fx < 0.36 || fx > 0.64 || z < wz[0]! + 0.05 || z > wz[1]! - 0.05 ? tone(TIMBER, 0.6 + lit) : mix(0x1a1e2a, 0xff9a38, 0.18);
    return tone(pl, 2.6 + lit);
  };
}

function roofShade(ramp: readonly Rgb[], len: number, lift: number, seed: number): Shade {
  return (s, t) => {
    const row = Math.floor(t * 7);
    const col = Math.floor(s * (len + 2 * OVERHANG) * 2.2 + (row % 2) * 0.5);
    let k = 2 + lift + (h3(col, row, seed) < 0.22 ? 0.6 : 0) - (t * 7 - row < 0.18 ? 0.9 : 0);
    if (t < 0.04) k += 1.2;
    if (t > 0.94) k = 0.4;
    return tone(ramp, k);
  };
}

/** Flächen im Raum mit Z-Puffer in ein Kunstraster, Umriss am Rand (wie die Probe) */
class Quads {
  private r: Raster;
  private depth: Float32Array;
  constructor(private f: { sx: number; sy: number; w: number; h: number }) {
    this.r = new Raster(f.w, f.h);
    this.depth = new Float32Array(f.w * f.h).fill(-1e9);
  }
  private proj(x: number, y: number, z: number): [number, number] {
    const p = project(true, x, y);
    return [(p.sx - this.f.sx) / 2, (p.sy - this.f.sy) / 2 - z * UZ];
  }
  quad(O: number[], E1: number[], E2: number[], shade: Shade): void {
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
