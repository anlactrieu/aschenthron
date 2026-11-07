/**
 * Zeichnung der Iso-Häuser (P9.3), Vorlage `iso()` in `scripts/bake-iso-probe.ts`: Fachwerkwände mit Steinsockel, Fenstern und Tür,
 * Satteldach mit Schornstein, Ostgiebel mit Fachwerk, Berufsschild, Fensterlicht. Gezeichnet wird in Hauskoordinaten (Haus mit der
 * Ecke oben links auf Kachel 0/0); die Bilder hängen nur an `HouseShape`, nicht an der Lage im Land, deshalb teilen sich Häuser
 * gleicher Bauart und Tür ein Bild. Ohne DOM nutzbar.
 */
import { Raster, h3, mix, type Rgb } from './world/raster';
import { signRaster } from './houses';
import type { DoorIcon } from './town';
import { Quads, UZ, frameOf, glowSpot, toneOf as tone, type Frame, type Shade } from './isoDraw';

/** Wandhöhe und Dachhöhe in Höheneinheiten (1 Einheit = 16 Kunstpixel), wie in der Probe */
export const WH = 2.1;
export const ROOF = 1.5;
export const OVERHANG = 0.3;

export type Side = 'N' | 'S' | 'E' | 'W';

/** Alles, was das Bild eines Hauses bestimmt */
export interface HouseShape {
  w: number;
  h: number;
  variant: number;
  /** Tür: Seite, Kachelnummer entlang der Wand (S/N von West nach Ost, E/W von Süd nach Nord) und Schild */
  door: { side: Side; idx: number; icon: DoorIcon } | null;
}

const doorKey = (s: HouseShape, sides: string): string => (s.door && sides.includes(s.door.side) ? `${s.door.side}${s.door.idx}${s.door.icon}` : 'x');
export type PartName = 'back' | 'walls' | 'roof' | 'light';
/** Bildschlüssel eines Teils: nur das, was das Teil zeichnet (Rückwand und Dach hängen an der Nord-/Westtür, Wände an der Süd-/Osttür, Licht an jeder) */
export const partKey = (s: HouseShape, part: PartName): string =>
  `${part}_${s.variant}_${s.w}x${s.h}_${part === 'walls' ? doorKey(s, 'SE') : part === 'light' ? doorKey(s, 'NSEW') : doorKey(s, 'NW')}`;
/** Schlüssel der ganzen Bauart (für den Dachspeicher) */
export const shapeKey = (s: HouseShape): string => partKey(s, 'light');

/** Grundfläche in Hauskoordinaten (Kachelkanten) */
export const boxOf = (s: HouseShape): { xa: number; ya: number; xb: number; yb: number } => ({ xa: -0.5, ya: -0.5, xb: s.w - 0.5, yb: s.h - 0.5 });

/** Fußpunkt der Türmitte an der Außenwand */
function doorBase(s: HouseShape): [number, number] {
  const { xa, ya, xb, yb } = boxOf(s);
  const d = s.door!;
  switch (d.side) {
    case 'S': return [xa + d.idx + 0.5, yb];
    case 'N': return [xa + d.idx + 0.5, ya];
    case 'E': return [xb, yb - d.idx - 0.5];
    default: return [xa, yb - d.idx - 0.5];
  }
}

/** Bildausschnitt aller Teile eines Hauses (Bildschirm-Pixel, Ursprung = Kachel 0/0) */
export function houseFrame(s: HouseShape): Frame {
  const { xa, ya, xb, yb } = boxOf(s);
  const top = WH + ROOF + 2.4;
  return frameOf([
    [xa - OVERHANG, ya - OVERHANG, 0], [xb + OVERHANG, ya - OVERHANG, 0], [xa - OVERHANG, yb + OVERHANG, 0], [xb + OVERHANG, yb + OVERHANG, 0],
    [xa - OVERHANG, ya - OVERHANG, top], [xb + OVERHANG, ya - OVERHANG, top], [xa - OVERHANG, yb + OVERHANG, top], [xb + OVERHANG, yb + OVERHANG, top],
  ], 1);
}

/* ---------------------------------------------------------------- Farben */

const PLASTER: readonly (readonly Rgb[])[] = [
  [0x3a332c, 0x5a5044, 0x7a6e5c, 0x988a72, 0xb4a68a],
  [0x3a2e2a, 0x5a463c, 0x7a6252, 0x987c66, 0xb49a80],
  [0x34322c, 0x524e42, 0x726c5a, 0x8e8872, 0xaaa48a],
  [0x2e342e, 0x4a5248, 0x6a7466, 0x86907c, 0xa4ae98],
  [0x38302c, 0x584a42, 0x786458, 0x947e6e, 0xb09a86],
];
const ROOFS: readonly (readonly Rgb[])[] = [
  [0x12141c, 0x22283a, 0x343c52, 0x4a546c, 0x646e86],
  [0x2a1410, 0x4a221a, 0x6a3426, 0x8a4a34, 0xa66448],
  [0x1e1a10, 0x3a3220, 0x5a4c30, 0x7a6a44, 0x968658],
  [0x121a12, 0x1e2a1c, 0x2e4028, 0x42583a, 0x587450],
  [0x1a120c, 0x2c1e14, 0x44321e, 0x5e4630, 0x7a5e44],
];
const TIMBER: readonly Rgb[] = [0x1a120c, 0x2e2016, 0x463222, 0x5e4630, 0x7a5c40];
const STONE: readonly Rgb[] = [0x1e1c20, 0x343038, 0x4a4650, 0x625e68, 0x7c7882];
const IRON: readonly Rgb[] = [0x121318, 0x23252c, 0x383b44, 0x545864, 0x7a7e8a];
const GLASS: Rgb = 0x1a1e2a;
/** Fensterschein am Tag (leicht warm) und das Licht nachts */
const GLASS_WARM: Rgb = 0xff9a38;
const LIGHT: Rgb = 0xb06a20;

/* ---------------------------------------------------------------- Wände */

interface Face {
  /** Länge in Kacheln */
  len: number;
  /** Helligkeit (Stufen der Rampe) */
  lit: number;
  /** Kachel mit Tür oder −1 */
  door: number;
  seed: number;
}

/** Fenster einer Wandkachel: 'frame' (Rahmen), 'glass' (Scheibe) oder null; `upper` = Obergeschoss */
function windowCell(f: Face, tile: number, fx: number, z: number): 'frame' | 'glass' | null {
  const upper = z > 1.05;
  // über der Tür sitzt das Schild
  if (upper && tile === f.door) return null;
  const on = upper ? tile % 2 === 1 : tile % 2 === 0 && tile > 0 && tile < Math.floor(f.len) - 1 && tile !== f.door;
  const wz = upper ? [1.35, 1.8] : [0.45, 0.88];
  if (!on || fx <= 0.32 || fx >= 0.68 || z <= wz[0]! || z >= wz[1]!) return null;
  return fx < 0.36 || fx > 0.64 || z < wz[0]! + 0.05 || z > wz[1]! - 0.05 || Math.abs(fx - 0.5) < 0.02 ? 'frame' : 'glass';
}

/** Fachwerkwand: Steinsockel, Balken, Fenster, Tür */
function wallShade(pl: readonly Rgb[], f: Face): Shade {
  return (s, t) => {
    const along = s * f.len;
    const z = t * WH;
    const tile = Math.floor(along);
    const fx = along - tile;
    const lit = f.lit - (z > WH - 0.22 ? 0.5 : 0);
    if (tile === f.door && fx > 0.2 && fx < 0.8 && z < 1.08) {
      if (z < 0.05) return tone(STONE, 3 + lit);
      if (fx < 0.26 || fx > 0.74 || z > 1.0) return tone(TIMBER, 0.3 + lit);
      if (fx > 0.62 && fx < 0.68 && z > 0.45 && z < 0.55) return 0xc8a040;
      if (Math.abs(z - 0.28) < 0.04 || Math.abs(z - 0.78) < 0.04) return tone(IRON, 1.4 + lit);
      return tone(TIMBER, (Math.floor(fx * 14) % 2 ? 2.1 : 1.6) + lit);
    }
    if (z < 0.32) return tone(STONE, 2 + lit + (h3(Math.floor(along * 3), Math.floor(z * 6), f.seed) < 0.3 ? -0.6 : 0));
    if (fx < 0.07 || fx > 0.93 || Math.abs(z - 1.05) < 0.06 || z > WH - 0.1) return tone(TIMBER, 1 + lit);
    const win = windowCell(f, tile, fx, z);
    if (win === 'frame') return tone(TIMBER, 0.6 + lit);
    if (win === 'glass') return mix(GLASS, GLASS_WARM, 0.18 + (z > 1.05 ? 0.05 : 0));
    // Strebe im Feld ohne Fenster
    const upper = z > 1.05;
    if (!windowCell(f, tile, 0.5, upper ? 1.5 : 0.6) && tile !== f.door && Math.abs((fx - 0.12) / 0.76 - (upper ? (z - 1.1) / 0.9 : (z - 0.35) / 0.65)) < 0.07 && fx > 0.1 && fx < 0.9) return tone(TIMBER, 1 + lit);
    return tone(pl, 2.6 + lit + (h3(Math.floor(along * 16), Math.floor(z * 12), f.seed + 9) < 0.2 ? -0.4 : 0));
  };
}

/** Nur die Scheiben, warm (additiv über dem Haus, Deckkraft = Nacht) */
function lightShade(f: Face): Shade {
  return (s, t) => {
    const along = s * f.len;
    const tile = Math.floor(along);
    return windowCell(f, tile, along - tile, t * WH) === 'glass' ? LIGHT : null;
  };
}

/* ---------------------------------------------------------------- Dach */

function roofShade(ramp: readonly Rgb[], len: number, lift: number, seed: number): Shade {
  return (s, t) => {
    const row = Math.floor(t * 7);
    const col = Math.floor(s * (len + 2 * OVERHANG) * 2.2 + (row % 2) * 0.5);
    let k = 2 + lift + (h3(col, row, seed) < 0.22 ? 0.6 : 0) - (t * 7 - row < 0.18 ? 0.9 : 0);
    if (t < 0.05) k += 1.2;
    if (t > 0.94) k = 0.4;
    return tone(ramp, k);
  };
}

function gableShade(pl: readonly Rgb[], hLen: number): Shade {
  return (s, t) => {
    const e = Math.abs(s - 0.5) * 2;
    if (t > 1 - e) return null;
    if (t > 1 - e - 0.1) return tone(TIMBER, 1.3); // Giebelbrett
    const along = s * hLen;
    const fx = along - Math.floor(along);
    const z = t * ROOF;
    if (Math.abs(s - 0.5) < 0.1 && z > 0.3 && z < 0.95 && t < 1 - e - 0.12) {
      return Math.abs(s - 0.5) > 0.075 || z < 0.35 || z > 0.9 ? tone(TIMBER, 0.6) : mix(GLASS, GLASS_WARM, 0.2);
    }
    if (z < 0.1 || Math.abs(s - 0.5) < 0.02 || fx < 0.05 || fx > 0.95) return tone(TIMBER, 1.1);
    return tone(pl, 3.1);
  };
}

const BRICK: Shade = (s, t) => (Math.floor(t * 12) % 2 === 0 ? (Math.floor(s * 6) % 2 ? 0x5a3a30 : 0x6e463a) : Math.floor(s * 6 + 0.5) % 2 ? 0x5a3a30 : 0x6e463a);

/** Schornstein auf der Südseite des Daches, nahe dem Ostende */
function chimney(q: Quads, xb: number, mid: number, eaveY: number, top: number, lift: number): void {
  const cx = xb - 1.5;
  const cy = mid + 0.3;
  const zb = top - ((cy + 0.3 - mid) / (eaveY - mid)) * (top - (WH - 0.15)) - 0.15;
  const zt = top + 0.6;
  const shade = (k: number): Shade => (s, t) => {
    if (t > 0.9) return tone(STONE, 3.4 + k);
    const c = BRICK(s, t) as Rgb;
    return k < 0 ? mix(c, 0x1a0e0a, 0.35) : c;
  };
  void lift;
  q.quad([cx - 0.3, cy + 0.3, zb], [0.6, 0, 0], [0, 0, zt - zb], shade(0));
  q.quad([cx + 0.3, cy + 0.3, zb], [0, -0.6, 0], [0, 0, zt - zb], shade(-1));
  q.quad([cx - 0.3, cy + 0.3, zt], [0.6, 0, 0], [0, -0.6, 0], (s, t) => (s > 0.22 && s < 0.78 && t > 0.22 && t < 0.78 ? 0x14100e : tone(STONE, 3.6)));
}

/* ---------------------------------------------------------------- Teile */

/** Innenseiten der Nord- und Westwand (nur zu sehen, wenn die Vorderwände ausgeblendet sind), mit Tür, wenn sie dort liegt */
export function drawBack(s: HouseShape, f: Frame): Raster {
  const q = new Quads(f);
  const { xa, ya, yb } = boxOf(s);
  const pl = PLASTER[s.variant % PLASTER.length]!;
  const seed = s.variant * 31;
  const d = s.door;
  q.quad([xa, ya, 0], [s.w, 0, 0], [0, 0, WH], wallShade(pl, { len: s.w, lit: -0.6, door: d?.side === 'N' ? d.idx : -1, seed }));
  q.quad([xa, yb, 0], [0, -s.h, 0], [0, 0, WH], wallShade(pl, { len: s.h, lit: -1.1, door: d?.side === 'W' ? d.idx : -1, seed: seed + 1 }));
  return q.done();
}

/** Süd- (licht) und Ostwand (Schatten), Berufsschild über einer Tür auf diesen Seiten */
export function drawWalls(s: HouseShape, f: Frame): Raster {
  const q = new Quads(f);
  const { xa, xb, yb } = boxOf(s);
  const pl = PLASTER[s.variant % PLASTER.length]!;
  const seed = s.variant * 31;
  const d = s.door;
  q.quad([xa, yb, 0], [s.w, 0, 0], [0, 0, WH], wallShade(pl, { len: s.w, lit: 0.4, door: d?.side === 'S' ? d.idx : -1, seed }));
  q.quad([xb, yb, 0], [0, -s.h, 0], [0, 0, WH], wallShade(pl, { len: s.h, lit: -0.9, door: d?.side === 'E' ? d.idx : -1, seed: seed + 2 }));
  const r = q.done();
  if (d && (d.side === 'S' || d.side === 'E')) {
    const [bx, by] = doorBase(s);
    const [u, v] = q.proj(bx, by, 1.12);
    // Schild über der Tür, Bildschirm-Ausrichtung (hängt quer zur Wand)
    r.blit(signRaster(d.icon), Math.round(u) - 8, Math.round(v) - 16);
  }
  return r;
}

/** Satteldach (First entlang x) mit Ostgiebel, Schornstein und, bei Nord-/Westtür, dem Schild auf einer Stange über der Dachkante */
export function drawRoof(s: HouseShape, f: Frame): Raster {
  const q = new Quads(f);
  const { xa, ya, xb, yb } = boxOf(s);
  const pl = PLASTER[s.variant % PLASTER.length]!;
  const ramp = ROOFS[s.variant % ROOFS.length]!;
  const seed = s.variant * 31;
  const mid = (ya + yb) / 2;
  const top = WH + ROOF;
  q.quad([xa - OVERHANG, mid, top], [s.w + 2 * OVERHANG, 0, 0], [0, yb + OVERHANG - mid, WH - 0.15 - top], roofShade(ramp, s.w, 0.6, seed));
  q.quad([xa - OVERHANG, mid, top], [s.w + 2 * OVERHANG, 0, 0], [0, ya - OVERHANG - mid, WH - 0.15 - top], roofShade(ramp, s.w, -0.6, seed));
  q.quad([xb, yb, WH], [0, -s.h, 0], [0, 0, ROOF], gableShade(pl, s.h));
  chimney(q, xb, mid, yb + OVERHANG, top, 0);
  const r = q.done();
  const d = s.door;
  if (d && (d.side === 'N' || d.side === 'W')) {
    const [bx, by] = doorBase(s);
    const [u, v0] = q.proj(bx, by, 0);
    const col = Math.round(u);
    // höchstes Dachpixel in der Spalte der Tür; darüber steht die Stange
    let top0 = r.h;
    for (let y = 0; y < r.h; y++) if (r.filled(col, y)) { top0 = y; break; }
    if (top0 === r.h) top0 = Math.round(v0 - (WH + ROOF) * UZ);
    const pole = 6;
    for (let y = top0 - pole; y < top0; y++) {
      r.set(col, y, IRON[3]!);
      r.set(col - 1, y, IRON[1]!);
    }
    r.blit(signRaster(d.icon), col - 8, top0 - pole - 16);
  }
  return r;
}

/** Fensterlicht (nachts additiv über Süd- und Ostwand) und Lampenschein am Schild */
export function drawLight(s: HouseShape, f: Frame, roof: Raster): Raster {
  const q = new Quads(f);
  const { xa, xb, yb } = boxOf(s);
  const seed = s.variant * 31;
  const d = s.door;
  q.quad([xa, yb, 0], [s.w, 0, 0], [0, 0, WH], lightShade({ len: s.w, lit: 0, door: d?.side === 'S' ? d.idx : -1, seed }));
  q.quad([xb, yb, 0], [0, -s.h, 0], [0, 0, WH], lightShade({ len: s.h, lit: 0, door: d?.side === 'E' ? d.idx : -1, seed }));
  const r = q.r;
  if (d) {
    const [bx, by] = doorBase(s);
    if (d.side === 'S' || d.side === 'E') {
      const [u, v] = q.proj(bx, by, 1.12);
      glowSpot(r, Math.round(u), Math.round(v) - 8, 15, GLASS_WARM, 170);
    } else {
      const [u] = q.proj(bx, by, 0);
      const col = Math.round(u);
      let top0 = roof.h;
      for (let y = 0; y < roof.h; y++) if (roof.filled(col, y)) { top0 = y; break; }
      if (top0 < roof.h) glowSpot(r, col, top0 - 14, 16, GLASS_WARM, 170);
    }
  }
  return r;
}
