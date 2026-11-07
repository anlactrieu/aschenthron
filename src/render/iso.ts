/**
 * Projektion Raster -> Bildschirm (Iso 2:1 wie T4C, Raute 64x32; Vertrag siehe SPEC „Umsetzungsplan P9 Iso“).
 * Ganze Rasterkoordinaten sind Kachelmitten (Kachel k reicht von k − 0,5 bis k + 0,5).
 * Kein Aufrufer rechnet selbst mit TILE_W/TILE_H: Bodenkreise, Laufrichtung, Schrittlänge, Sichtbereich und Tiefe laufen hier.
 */
import type { FigView } from './figure';

export const TILE_W = 64;
export const TILE_H = 32;

/** Raute in Kunstpixeln (Maßstab 2): 32x16 */
export const ISO_ART_W = 32;
export const ISO_ART_H = 16;

export function project(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * 32, sy: (x + y) * 16 };
}

export function unproject(sx: number, sy: number): { x: number; y: number } {
  const a = sx / 32;
  const b = sy / 16;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Kachelmitte -> Bildschirm. Linear ohne Versatz: `toScreen(dx, dy)` ist zugleich der Bildschirmschritt eines Rasterschritts. */
export const toScreen = project;
export const toTile = unproject;

/* ---------------------------------------------------------------- Fußpunkt und Tiefe */

/**
 * Fußpunkt der Figuren unter der Kachelmitte (Bildschirm-Pixel): 0, die Figur steht genau auf der Rautenmitte (wie in der Probe).
 * Alle figurbezogenen Versätze (Schatten, Namen, Balken, Körpermitte) zählen ab diesem Punkt.
 */
export const FOOT_DY = 0;

/**
 * Tiefe eines stehenden Objekts auf einer Kachel (Baum, Fass, Wandblock), aus der Bildschirm-y der Kachelmitte: Spaltenregel für
 * eine Raute (+8 = Vorderkante in der Spaltenmitte, siehe `footprintColumns`): Figuren mit größerem x + y stehen davor, gleiche
 * Summe dahinter.
 */
export const standDepth = (sy: number): number => sy + 8;

/** Bildschirm-y der Kachel-Vorderkante unter der Mitte (untere Rautenecke, 16). Bodenversatz für Bild-Unterkanten. */
export const FRONT_DY = TILE_H / 2;

/** Breite einer Tiefen-Spalte großer Objekte (halbe Raute) */
export const COLUMN_W = 32;

export interface DepthColumn {
  /** linke Kante (Bildschirm-x, Vielfaches von 32) */
  sx: number;
  /** Tiefe = Bildschirm-y der vorderen Bodenkante der Grundfläche in der Spaltenmitte (Vorderwände, Dach) */
  depth: number;
  /** dasselbe für die hintere Bodenkante (Rückwände, die man nur von innen sieht) */
  back: number;
}

/**
 * Spaltenschnitt einer Grundfläche (Kacheln x0..x0+w−1, y0..y0+h−1) in Iso: Spalten von 32 px, jede mit der Tiefe der vorderen
 * Bodenkante unter ihrer Mitte. Die Kante läuft zwischen den Spaltengrenzen gerade (Ecken liegen auf Vielfachen von 32), die
 * Mitte liegt damit 8 px vor dem Hinterende und 8 px hinter dem Vorderende: eine Figur eine Kachel vor der Wand hat mindestens
 * 8 px mehr Tiefe, eine Figur im Haus oder dahinter mindestens 8 px weniger.
 */
export function footprintColumns(x0: number, y0: number, w: number, h: number): DepthColumn[] {
  const xa = x0 - 0.5;
  const ya = y0 - 0.5;
  const xb = x0 + w - 0.5;
  const yb = y0 + h - 0.5;
  // Ecken: links (xa, yb), vorn (xb, yb), rechts (xb, ya), hinten (xa, ya)
  const L = project(xa, yb);
  const F = project(xb, yb);
  const Rt = project(xb, ya);
  const B = project(xa, ya);
  const on = (a: { sx: number; sy: number }, b: { sx: number; sy: number }, x: number): number => a.sy + ((x - a.sx) * (b.sy - a.sy)) / (b.sx - a.sx || 1);
  const out: DepthColumn[] = [];
  for (let sx = L.sx; sx < Rt.sx; sx += COLUMN_W) {
    const c = sx + COLUMN_W / 2;
    out.push({ sx, depth: c <= F.sx ? on(L, F, c) : on(F, Rt, c), back: c <= B.sx ? on(L, B, c) : on(B, Rt, c) });
  }
  return out;
}

/* ---------------------------------------------------------------- Laufrichtung */

/** Ansicht einer Figur: Bildzeile und Spiegelung; `up` = blickte zuletzt nach oben */
export interface ViewState {
  view: FigView;
  flip: boolean;
  up: boolean;
}

export const VIEW0: ViewState = { view: 'front', flip: false, up: false };

/**
 * Ansicht aus der Bildschirm-Richtung eines Schritts (dsx, dsy in Bildschirm-Pixeln, z. B. `toScreen(dx, dy)`).
 * 8 Sektoren zu 45° auf 5 Ansichten, links gespiegelt (runter front, hoch back, seitlich side, unten schräg frontDiag,
 * oben schräg backDiag). Rein senkrecht behält die Spiegelung den letzten Wert.
 */
export function viewOf(dsx: number, dsy: number, prev: ViewState = VIEW0): ViewState {
  if (!dsx && !dsy) return prev;
  // Sektor 0 = rechts, im Uhrzeigersinn (Bildschirm-y zeigt nach unten)
  const s = ((Math.round(Math.atan2(dsy, dsx) / (Math.PI / 4)) % 8) + 8) % 8;
  const view: FigView = (['side', 'frontDiag', 'front', 'frontDiag', 'side', 'backDiag', 'back', 'backDiag'] as const)[s]!;
  const flip = s === 2 || s === 6 ? prev.flip : s >= 3 && s <= 5;
  return { view, flip, up: s >= 5 };
}

/** Rückfall für Sheets ohne Schrägansicht (DCSS, Ninja, Schattenrisse, Sheets vor P9.1) */
export function fallbackView(v: FigView): 'side' | 'front' | 'back' {
  return v === 'frontDiag' ? 'front' : v === 'backDiag' ? 'back' : v;
}

/** Ansicht, die ein Sheet wirklich hat: Schrägansicht nur, wenn ihr erstes Stehbild existiert (Worker und Spiel können sich uneinig sein) */
export function sheetView(frames: Record<string, unknown>, v: FigView): FigView {
  return v === 'frontDiag' || v === 'backDiag' ? (frames[`idle_${v}_0`] ? v : fallbackView(v)) : v;
}

/**
 * Blickrichtung einer Figur, wie GameScene, townLife und wildlife sie halten: `side`/`up`/`flip` (alle 3-Ansichten-Figuren lesen
 * nur sie), `iv` = Ansicht der 5.
 */
export interface Facing {
  flip: boolean;
  up?: boolean;
  side?: boolean;
  iv?: FigView;
}

/** Ansicht nach einem Schritt (Bildschirmrichtung dsx, dsy) nachführen */
export function turn(o: Facing, dsx: number, dsy: number): void {
  const s = viewOf(dsx, dsy, { view: facingView(o), flip: o.flip, up: !!o.up });
  o.flip = s.flip;
  o.up = s.up;
  o.side = s.view === 'side';
  o.iv = s.view;
}

/** Gewünschte Ansicht (vor dem Rückfall auf das, was das Sheet hat) */
export function facingView(o: Facing): FigView {
  return o.iv ?? (o.side ? 'side' : o.up ? 'back' : 'front');
}

/** Wird diese Ansicht nach Laufrichtung gespiegelt? Seite und Schrägen ja (links = gespiegelt), vorn/hinten nur bei `mirrorAll`. */
export const mirrors = (v: FigView): boolean => v !== 'front' && v !== 'back';

/* ---------------------------------------------------------------- Strecken und Kreise */

/**
 * Strecke eines Rasterschritts für den Laufzyklus (Bildschirm-Pixel der Figur), unabhängig von der Richtung, damit die Füße
 * nicht gleiten: 64/√2 ≈ 45 px je Kachel (so weit wandert die Figur bei waagrechtem Lauf).
 */
export const gridStep = (dx: number, dy: number): number => Math.hypot(dx, dy) * (64 / Math.SQRT2);

/** Halbachsen eines Bodenkreises mit Radius r Kacheln: rx = r·W/√2, ry = r·H/√2. */
export const groundEllipse = (r: number): { rx: number; ry: number } => ({ rx: (r * 64) / Math.SQRT2, ry: (r * 32) / Math.SQRT2 });

/** Bodenring/-schatten der Breite w (Pixel): ein Bodenkreis über `groundEllipse` (2:1) */
export function groundSize(w: number): { w: number; h: number } {
  const e = groundEllipse(w / 2 / (64 / Math.SQRT2));
  return { w: e.rx * 2, h: e.ry * 2 };
}

/* ---------------------------------------------------------------- Sichtbereich */

export interface TileRange {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Kachelbereich (einschließlich, nicht auf die Karte beschnitten), der ein Bildschirm-Rechteck berührt: alle 4 Ecken projiziert. */
export function tileRange(v: { x: number; y: number; width: number; height: number }, margin = 0): TileRange {
  const cs = [unproject(v.x, v.y), unproject(v.x + v.width, v.y), unproject(v.x, v.y + v.height), unproject(v.x + v.width, v.y + v.height)];
  const xs = cs.map((c) => c.x);
  const ys = cs.map((c) => c.y);
  return {
    x0: Math.floor(Math.min(...xs) + 0.5) - margin,
    y0: Math.floor(Math.min(...ys) + 0.5) - margin,
    x1: Math.floor(Math.max(...xs) + 0.5) + margin,
    y1: Math.floor(Math.max(...ys) + 0.5) + margin,
  };
}

/** Liegt die Kachel (Mitte) im Bildschirm-Rechteck samt Rand (px)? Für Culling, wo der Kachelbereich nur eine grobe Hülle ist. */
export function tileOnScreen(x: number, y: number, v: { x: number; y: number; width: number; height: number }, pad: number): boolean {
  const { sx, sy } = toScreen(x, y);
  return sx > v.x - pad && sx < v.x + v.width + pad && sy > v.y - pad && sy < v.y + v.height + pad;
}

/** Bildschirm-Hülle der Karte (w x h Kacheln): Box um die 4 projizierten Kartenecken (300x240: 17 280 x 8 640 px) */
export function mapBounds(w: number, h: number): { x: number; y: number; width: number; height: number } {
  const cs = [project(-0.5, -0.5), project(w - 0.5, -0.5), project(-0.5, h - 0.5), project(w - 0.5, h - 0.5)];
  const xs = cs.map((c) => c.sx);
  const ys = cs.map((c) => c.sy);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/* ---------------------------------------------------------------- Eingabe */

/**
 * Pfeiltasten -> Rasterrichtung: sie folgen dem Bildschirm. Oben = (−1,−1), rechts = (+1,−1), unten = (+1,+1), links = (−1,+1);
 * zwei Tasten zusammen ergeben eine Rasterachse (oben + rechts = (0,−1)).
 */
export const ARROW_DIRS: Record<string, [number, number]> = { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] };

/** Summe gedrückter Pfeiltasten als Rasterschritt (je Achse −1/0/1; Gegenrichtungen heben sich auf) */
export function arrowStep(keys: Iterable<string>): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const k of keys) {
    const d = ARROW_DIRS[k];
    if (!d) continue;
    dx += d[0];
    dy += d[1];
  }
  return [Math.sign(dx), Math.sign(dy)];
}
