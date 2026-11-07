/**
 * Wandblöcke der Iso-Ansicht (P9.2): Klippen, Mauern und Gruftwände als Quader mit Oberseite und zwei sichtbaren Seiten.
 * - Ein Bild je Stil, Nachbarmaske und Variante (Hash der Kachel), nicht je Kachel: wenige Texturen, GameScene setzt sie als Prop.
 * - Bild: 32 Kunstpixel breit, `16 + WALL_H` hoch. Oben die Oberseite (Raute 32x16), darunter die Seiten. Der Anker liegt an der
 *   unteren Ecke der Grundraute; Seitenfüße und Boden-Raute werden mit demselben Pixelmitten-Test wie der Boden (`isoGround.ts`)
 *   gezogen, damit zwischen Block und Boden keine Lücke aufgeht.
 * - Sichtbar sind nur die Süd- (+y, links unten) und die Ostseite (+x, rechts unten). Offene Nord- und Westseiten bekommen
 *   einen hellen Rand an der Oberseite (Licht von oben links).
 * Ohne DOM nutzbar (reine Raster).
 */
import { Raster, h3, mix, vnoise, type Rgb } from './raster';

export type WallKind = 'cliff' | 'brick' | 'dungeon';

/**
 * Höhe der Wandseiten in Kunstpixeln (Bildschirm: mal 2). 24 = volle Höhe (1,5 Kacheln), 12 = halbe.
 * Die Entscheidung trifft der Nutzer anhand von `probe/iso/wandhoehe.png`; bis dahin gilt die volle Höhe.
 */
export const WALL_H = 24;
/** Breite und Höhe der Kachelraute in Kunstpixeln */
const W = 32;
const HD = 16;
/** Anzahl Varianten je Stil und Maske */
export const WALL_VARIANTS = 3;

type Ramp5 = readonly [Rgb, Rgb, Rgb, Rgb, Rgb];
interface Pal { top: Ramp5; face: Ramp5; mortar: Rgb }
/** Paletten wie die Wandkacheln der Draufsicht (`WALLS` in `world/props.ts`), die Oberseite etwas heller, damit Kanten lesbar bleiben */
const PAL: Record<WallKind, Pal> = {
  cliff: { top: [0x0e0e0e, 0x1c1c18, 0x2a2a24, 0x3a3a30, 0x6a6a56], face: [0x141216, 0x231f22, 0x332d30, 0x463e40, 0x5c5254], mortar: 0x0e0d10 },
  brick: { top: [0x0e0c10, 0x1c181f, 0x2a252e, 0x3a3340, 0x6e6474], face: [0x17141a, 0x28222a, 0x3a3240, 0x4e4454, 0x665a6a], mortar: 0x100c10 },
  dungeon: { top: [0x070609, 0x100e14, 0x1a1720, 0x26222e, 0x4e4858], face: [0x0e0d12, 0x1a1820, 0x27242e, 0x35313e, 0x48424f], mortar: 0x070608 },
};

/** Ton t (0..4, gebrochen) einer Fünferrampe */
function tone(r: Ramp5, t: number): Rgb {
  const k = Math.max(0, Math.min(4, t));
  const i = Math.min(3, Math.floor(k));
  return mix(r[i]!, r[i + 1]!, k - i);
}

const MOSS: Ramp5 = [0x1a2616, 0x26361c, 0x34482a, 0x44603a, 0x58784a];

/** Größe des Wandbilds in Kunstpixeln (alle Blöcke gleich) */
export const WALL_W = W;
export const WALL_IMG_H = HD + WALL_H;

/**
 * Wandblock-Bild. `open`: Bits N=1, O=2, S=4, W=8 für Nachbarn, die keine Wand sind (wie `wallTile`). `variant` 0..WALL_VARIANTS−1.
 * Die Seiten S und O werden nur gezeichnet, wenn sie offen sind; verdeckte Seiten liegen hinter dem Nachbarblock.
 */
export function wallBlock(style: WallKind, open: number, variant: number): Raster {
  const P = PAL[style];
  const r = new Raster(W, WALL_IMG_H);
  const seed = 300 + variant * 17 + (style === 'cliff' ? 0 : style === 'brick' ? 1 : 2) * 101;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dxn = Math.abs(px - W / 2) / (W / 2);
      // Oberseite: Raute um (16, 8), Pixelmitten-Test wie beim Boden
      const dt = dxn + Math.abs(py - HD / 2) / (HD / 2);
      if (dt <= 1) {
        r.set(x, y, topColor(style, P, x, y, px, py, dxn, open, seed));
        continue;
      }
      // Seiten: unter der unteren Kante der Oberseite, bis zur unteren Kante der Grundraute (um WALL_H tiefer)
      const edge = HD / 2 + (HD / 2) * (1 - dxn);
      if (py <= HD / 2 || py > edge + WALL_H) continue;
      if (py <= edge) continue;
      const left = px < W / 2;
      if (left ? !(open & 4) : !(open & 2)) continue;
      const t = py - edge;
      const s = left ? px : W - px;
      r.set(x, y, faceColor(style, P, left, s, t, dxn, seed));
    }
  }
  return r;
}

/** Oberseite: Masse der Wand (leise Textur), helle Kante an offenen Nord-/Westseiten, dunkle an offenen Süd-/Ostseiten (Übergang zur Seite) */
function topColor(style: WallKind, P: Pal, x: number, y: number, px: number, py: number, dxn: number, open: number, seed: number): Rgb {
  // Kachelkoordinaten (0..1) aus der Pixelmitte: fu läuft entlang +x (rechts unten), fv entlang +y (links unten)
  const au = (px - W / 2) / 16;
  const bv = py / 8;
  const fu = (au + bv) / 2;
  const fv = (bv - au) / 2;
  let t: number;
  if (style === 'cliff') {
    const n = vnoise(x + seed, y * 2 + seed, 7, seed);
    t = n < 0.34 ? 1.9 : n > 0.66 ? 3 : 2.4;
  } else {
    // zwei mal zwei Platten je Kachel, Fugen entlang der Rautenachsen
    const cu = Math.floor(fu * 2);
    const cv = Math.floor(fv * 2);
    const k = h3(cu, cv, seed + 1);
    t = k < 0.25 ? 3 : k > 0.75 ? 1.8 : 2.4;
    const gu = fu * 2 - cu;
    const gv = fv * 2 - cv;
    if (gu > 0.9 || gv > 0.9) t = 1;
    else if (gu < 0.1 || gv < 0.1) t += 0.5;
  }
  const sp = h3(x, y, seed + 2);
  if (sp < 0.03) t -= 0.9;
  else if (sp > 0.985) t += 0.9;
  // Kantennähe: Abstand zu den vier Rautenkanten (1 px)
  const nearT = dxn + Math.abs(py - HD / 2) / (HD / 2) > 1 - 0.1;
  if (nearT) {
    const up = py < HD / 2;
    const lf = px < W / 2;
    if (up && !lf && open & 1) t = 4;
    else if (up && lf && open & 8) t = 4;
    else if (!up && lf && open & 4) t = 3.4;
    else if (!up && !lf && open & 2) t = 0.9;
  }
  let c = tone(P.top, t);
  if (style === 'cliff') {
    // Moos und Gras auf der Klippe
    const m = vnoise(x + seed * 3, y * 2, 9, seed + 9);
    if (m > 0.62) c = tone(MOSS, 0.9 + (m - 0.62) * 5);
  }
  return c;
}

/** Seitenfläche: s = Lauf entlang der Fläche (0..16), t = Abstand unter der Oberkante (0..WALL_H) */
function faceColor(style: WallKind, P: Pal, left: boolean, s: number, t: number, dxn: number, seed: number): Rgb {
  // Licht von oben links: die Südseite (links unten) ist heller als die Ostseite (rechts unten)
  const shade = left ? 0 : -0.9;
  const ti = Math.floor(t);
  const si = Math.floor(s);
  let v: number;
  if (ti === 0) v = 3.4; // Abrisskante oben
  else if (ti >= WALL_H - 1) v = ti === WALL_H - 1 ? 0.3 : 0.5; // dunkler Fuß
  else if (style === 'cliff') {
    // Felsschichten: waagrechte Lagen mit Versatz je 4 px Länge, helle Kanten, vereinzelt Risse und Moos
    const lay = layerOf(ti, si, left, seed);
    v = 1.5 + vnoise(si + (left ? 0 : 57), ti * 2, 5, seed + 4) * 1.4 - (ti > WALL_H * 0.6 ? 0.4 : 0);
    if (lay.edge) v = 0.7;
    else if (lay.top) v = Math.min(4, v + 1);
    if (h3(si, ti, seed + 5) < 0.04) v = 0.8;
    if (ti < 4 && vnoise(si * 3 + seed, 0, 4, seed + 6) > 0.62) v = Math.min(v, 1.2);
  } else {
    // Quader in Lagen zu 6 px (Fuge 1 px), versetzt; Oberkante jedes Quaders hell
    const ch = style === 'brick' ? 5 : 6;
    const course = Math.floor((ti - 1) / ch);
    const cy = (ti - 1) % ch;
    const bw = style === 'brick' ? 8 : 10;
    // s läuft kachelübergreifend mit Periode 16: Versatz je zweite Lage
    const off = (course % 2) * (bw >> 1);
    const sj = left ? si : 15 - si;
    const bx = (sj + off) % bw;
    const joint = bx === bw - 1 || cy === ch - 1;
    v = joint ? 0.4 : cy === 0 ? 3.2 : bx === 0 ? 2.8 : 2.1;
    if (!joint && h3(Math.floor((sj + off) / bw) + (left ? 0 : 31), course, seed + 8) < 0.25) v -= 0.6;
    if (style === 'dungeon' && !joint && h3(si, ti, seed + 9) < 0.04) v = 0.8;
  }
  // Ecke zwischen den Seiten (x nahe der Mitte): dunkle Kante, damit die Quaderkante lesbar bleibt
  if (dxn < 0.07) v = Math.max(0, v - 1.1);
  return tone(P.face, v + shade);
}

/** Schichtgrenzen einer Klippenseite: dunkle Fugenzeile `edge`, helle Zeile darüber `top`; Lage und Höhe ändern sich alle 4 px */
function layerOf(ti: number, si: number, left: boolean, seed: number): { edge: boolean; top: boolean } {
  const cell = Math.floor(si / 4) + (left ? 0 : 91);
  const j = h3(cell, 1, seed + 20);
  const base = 6 + Math.floor(j * 3);
  const row = (ti + Math.floor(h3(cell, 2, seed + 21) * 3)) % base;
  return { edge: row === base - 1, top: row === 0 };
}
