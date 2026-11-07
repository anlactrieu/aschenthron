/**
 * Projektion Raster -> Bildschirm (P9 Iso, Vertrag siehe SPEC „Umsetzungsplan P9 Iso“).
 * Zwei Modi: Draufsicht (48x48, achsenparallel) und Iso 2:1 wie T4C (Raute 64x32). Der Bau-Schalter `?ansicht=iso` wählt beim
 * Start einmal; ohne ihn bleibt alles wie vorher. Ganze Rasterkoordinaten sind Kachelmitten (Kachel k reicht von k − 0,5 bis k + 0,5).
 * Die Funktionen mit `iso`-Parameter sind rein und in beiden Modi testbar; die Kurzformen darunter binden den aktiven Modus.
 * Kein Aufrufer rechnet selbst mit TILE_W/TILE_H: Bodenkreise, Laufrichtung, Schrittlänge, Sichtbereich und Tiefe laufen hier.
 */
import type { FigView } from './figure';

/** Iso-Ansicht aktiv (`?ansicht=iso`); in Node (Tests, Kontaktbögen) und im Figuren-Worker ohne Suchtext immer aus */
export const ISO: boolean = typeof location !== 'undefined' && new URLSearchParams(location.search).get('ansicht') === 'iso';

export const tileW = (iso: boolean): number => (iso ? 64 : 48);
export const tileH = (iso: boolean): number => (iso ? 32 : 48);
export const TILE_W = tileW(ISO);
export const TILE_H = tileH(ISO);

/** Raute in Kunstpixeln (Maßstab 2): 32x16 */
export const ISO_ART_W = 32;
export const ISO_ART_H = 16;

export function project(iso: boolean, x: number, y: number): { sx: number; sy: number } {
  if (!iso) return { sx: x * 48, sy: y * 48 };
  return { sx: (x - y) * 32, sy: (x + y) * 16 };
}

export function unproject(iso: boolean, sx: number, sy: number): { x: number; y: number } {
  if (!iso) return { x: sx / 48, y: sy / 48 };
  const a = sx / 32;
  const b = sy / 16;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Kachelmitte -> Bildschirm. Linear ohne Versatz: `toScreen(dx, dy)` ist zugleich der Bildschirmschritt eines Rasterschritts. */
export function toScreen(x: number, y: number): { sx: number; sy: number } {
  return project(ISO, x, y);
}

export function toTile(sx: number, sy: number): { x: number; y: number } {
  return unproject(ISO, sx, sy);
}

/* ---------------------------------------------------------------- Fußpunkt und Tiefe */

/**
 * Fußpunkt der Figuren unter der Kachelmitte (Bildschirm-Pixel). Draufsicht 8 wie bisher, Iso 0: die Figur steht genau auf der
 * Rautenmitte (wie in der Probe). Alle figurbezogenen Versätze (Schatten, Namen, Balken, Körpermitte) zählen ab diesem Punkt.
 */
export const footDy = (iso: boolean): number => (iso ? 0 : 8);
export const FOOT_DY = footDy(ISO);

/**
 * Tiefe eines stehenden Objekts auf einer Kachel (Baum, Fass, Wandblock), aus der Bildschirm-y der Kachelmitte.
 * Draufsicht: Fuß der Kachel (+24, Figuren derselben Reihe stehen dahinter). Iso: Spaltenregel für eine Raute (+8 = Vorderkante
 * in der Spaltenmitte, siehe `footprintColumns`): Figuren mit größerem x + y stehen davor, gleiche Summe dahinter.
 */
export const standDy = (iso: boolean): number => (iso ? 8 : 24);
export const standDepth = (sy: number): number => sy + standDy(ISO);

/** Bildschirm-y der Kachel-Vorderkante unter der Mitte (Draufsicht: Fuß der Kachel 24, Iso: untere Rautenecke 16). Bodenversatz für Bild-Unterkanten. */
export const frontDy = (iso: boolean): number => tileH(iso) / 2;
export const FRONT_DY = frontDy(ISO);

/** Breite einer Tiefen-Spalte großer Objekte (halbe Raute) */
export const COLUMN_W = 32;

export interface DepthColumn {
  /** linke Kante (Bildschirm-x, Vielfaches von 32) */
  sx: number;
  /** Tiefe = Bildschirm-y der Vorderkante der Grundfläche in der Spaltenmitte */
  depth: number;
}

/**
 * Spaltenschnitt einer Grundfläche (Kacheln x0..x0+w−1, y0..y0+h−1) in Iso: Spalten von 32 px, jede mit der Tiefe der vorderen
 * Bodenkante unter ihrer Mitte. Die Vorderkante läuft zwischen den Spaltengrenzen gerade (Ecken liegen auf Vielfachen von 32),
 * die Mitte liegt damit 8 px vor dem Hinterende und 8 px hinter dem Vorderende: eine Figur direkt vor der Wand (eine Kachel weiter)
 * hat mindestens 8 px mehr Tiefe, eine Figur dahinter mindestens 8 px weniger. Die Tiefen gelten nur für Iso.
 */
export function footprintColumns(x0: number, y0: number, w: number, h: number): DepthColumn[] {
  const x1 = x0 + w - 0.5;
  const y1 = y0 + h - 0.5;
  const xa = x0 - 0.5;
  const ya = y0 - 0.5;
  // linke Ecke (xa, y1), vordere Ecke (x1, y1), rechte Ecke (x1, ya)
  const left = project(true, xa, y1);
  const front = project(true, x1, y1);
  const right = project(true, x1, ya);
  const out: DepthColumn[] = [];
  for (let sx = left.sx; sx < right.sx; sx += COLUMN_W) {
    const c = sx + COLUMN_W / 2;
    const depth = c <= front.sx ? left.sy + ((c - left.sx) * (front.sy - left.sy)) / (front.sx - left.sx || 1) : front.sy + ((c - front.sx) * (right.sy - front.sy)) / (right.sx - front.sx || 1);
    out.push({ sx, depth });
  }
  return out;
}

/* ---------------------------------------------------------------- Laufrichtung */

/** Ansicht einer Figur: Bildzeile und Spiegelung; `up` = blickte zuletzt nach oben (Draufsicht hält es über Seitwärtsschritte) */
export interface ViewState {
  view: FigView;
  flip: boolean;
  up: boolean;
}

export const VIEW0: ViewState = { view: 'front', flip: false, up: false };

/**
 * Ansicht aus der Bildschirm-Richtung eines Schritts (dsx, dsy in Bildschirm-Pixeln, z. B. `toScreen(dx, dy)`).
 * Iso: 8 Sektoren zu 45° auf 5 Ansichten, links gespiegelt (runter front, hoch back, seitlich side, unten schräg frontDiag,
 * oben schräg backDiag). Rein senkrecht behält die Spiegelung den letzten Wert.
 * Draufsicht wie bisher: Seite, wenn |dx| > 0,8·|dy|; Spiegelung und oben/unten ändern sich nur ab 0,0005 Kachel (Werte in
 * Kacheln, Bildschirm = Raster), also nur 3 Ansichten.
 */
export function viewFrom(iso: boolean, dsx: number, dsy: number, prev: ViewState = VIEW0): ViewState {
  if (!iso) {
    const dx = dsx / 48;
    const dy = dsy / 48;
    const flip = Math.abs(dx) > 0.0005 ? dx < 0 : prev.flip;
    const up = Math.abs(dy) > 0.0005 ? dy < 0 : prev.up;
    const side = Math.abs(dx) > Math.abs(dy) * 0.8;
    return { view: side ? 'side' : up ? 'back' : 'front', flip, up };
  }
  if (!dsx && !dsy) return prev;
  // Sektor 0 = rechts, im Uhrzeigersinn (Bildschirm-y zeigt nach unten)
  const s = ((Math.round(Math.atan2(dsy, dsx) / (Math.PI / 4)) % 8) + 8) % 8;
  const view: FigView = (['side', 'frontDiag', 'front', 'frontDiag', 'side', 'backDiag', 'back', 'backDiag'] as const)[s]!;
  const flip = s === 2 || s === 6 ? prev.flip : s >= 3 && s <= 5;
  return { view, flip, up: s >= 5 };
}

export const viewOf = (dsx: number, dsy: number, prev?: ViewState): ViewState => viewFrom(ISO, dsx, dsy, prev);

/** Rückfall für Sheets ohne Schrägansicht (DCSS, Ninja, Schattenrisse, Sheets vor P9.1) */
export function fallbackView(v: FigView): 'side' | 'front' | 'back' {
  return v === 'frontDiag' ? 'front' : v === 'backDiag' ? 'back' : v;
}

/** Ansicht, die ein Sheet wirklich hat: Schrägansicht nur, wenn ihr erstes Stehbild existiert (Worker und Spiel können sich uneinig sein) */
export function sheetView(frames: Record<string, unknown>, v: FigView): FigView {
  return v === 'frontDiag' || v === 'backDiag' ? (frames[`idle_${v}_0`] ? v : fallbackView(v)) : v;
}

/* ---------------------------------------------------------------- Strecken und Kreise */

/**
 * Strecke eines Rasterschritts für den Laufzyklus (Bildschirm-Pixel der Figur), unabhängig von der Richtung, damit die Füße
 * nicht gleiten. Draufsicht wie bisher 48 px je Kachel; Iso 64/√2 ≈ 45 px (so weit wandert die Figur bei waagrechtem Lauf).
 */
export function stepLength(iso: boolean, dx: number, dy: number): number {
  return iso ? Math.hypot(dx, dy) * (64 / Math.SQRT2) : Math.hypot(dx * 48, dy * 48);
}
export const gridStep = (dx: number, dy: number): number => stepLength(ISO, dx, dy);

/** Halbachsen eines Bodenkreises mit Radius r Kacheln. Iso: rx = r·W/√2, ry = r·H/√2. Draufsicht: rx = ry = r·W. */
export function ellipseOf(iso: boolean, r: number): { rx: number; ry: number } {
  return iso ? { rx: (r * 64) / Math.SQRT2, ry: (r * 32) / Math.SQRT2 } : { rx: r * 48, ry: r * 48 };
}
export const groundEllipse = (r: number): { rx: number; ry: number } => ellipseOf(ISO, r);

/**
 * Bodenring/-schatten, der in der Draufsicht als w x h (Pixel) gezeichnet wird: dort bleibt er genau so (die Draufsicht hat
 * gestauchte Ellipsen, keine Kreise), in Iso wird er ein Bodenkreis gleicher Breite über `groundEllipse` (2:1).
 */
export function flatSize(iso: boolean, w: number, h: number): { w: number; h: number } {
  if (!iso) return { w, h };
  const e = ellipseOf(true, w / 2 / (64 / Math.SQRT2));
  return { w: e.rx * 2, h: e.ry * 2 };
}
export const groundSize = (w: number, h: number): { w: number; h: number } => flatSize(ISO, w, h);

/* ---------------------------------------------------------------- Sichtbereich */

export interface TileRange {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Kachelbereich (einschließlich, nicht auf die Karte beschnitten), der ein Bildschirm-Rechteck berührt: alle 4 Ecken projiziert. */
export function rangeOf(iso: boolean, v: { x: number; y: number; width: number; height: number }, margin = 0): TileRange {
  const cs = [unproject(iso, v.x, v.y), unproject(iso, v.x + v.width, v.y), unproject(iso, v.x, v.y + v.height), unproject(iso, v.x + v.width, v.y + v.height)];
  const xs = cs.map((c) => c.x);
  const ys = cs.map((c) => c.y);
  return {
    x0: Math.floor(Math.min(...xs) + 0.5) - margin,
    y0: Math.floor(Math.min(...ys) + 0.5) - margin,
    x1: Math.floor(Math.max(...xs) + 0.5) + margin,
    y1: Math.floor(Math.max(...ys) + 0.5) + margin,
  };
}
export const tileRange = (v: { x: number; y: number; width: number; height: number }, margin = 0): TileRange => rangeOf(ISO, v, margin);

/** Liegt die Kachel (Mitte) im Bildschirm-Rechteck samt Rand (px)? Für Culling im Iso-Modus, wo der Kachelbereich nur eine grobe Hülle ist. */
export function tileOnScreen(x: number, y: number, v: { x: number; y: number; width: number; height: number }, pad: number): boolean {
  const { sx, sy } = toScreen(x, y);
  return sx > v.x - pad && sx < v.x + v.width + pad && sy > v.y - pad && sy < v.y + v.height + pad;
}

/** Bildschirm-Hülle der Karte (w x h Kacheln): Box um die 4 projizierten Kartenecken (Iso 300x240: 17 280 x 8 640 px) */
export function mapBounds(iso: boolean, w: number, h: number): { x: number; y: number; width: number; height: number } {
  const cs = [project(iso, -0.5, -0.5), project(iso, w - 0.5, -0.5), project(iso, -0.5, h - 0.5), project(iso, w - 0.5, h - 0.5)];
  const xs = cs.map((c) => c.sx);
  const ys = cs.map((c) => c.sy);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/* ---------------------------------------------------------------- Eingabe */

/**
 * Pfeiltasten -> Rasterrichtung: sie folgen dem Bildschirm. Draufsicht: oben = −y, rechts = +x. Iso: oben = (−1,−1),
 * rechts = (+1,−1), unten = (+1,+1), links = (−1,+1); zwei Tasten zusammen ergeben eine Rasterachse (oben + rechts = (0,−1)).
 */
export function arrowDirs(iso: boolean): Record<string, [number, number]> {
  return iso
    ? { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] }
    : { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
}

/** Summe gedrückter Pfeiltasten als Rasterschritt (je Achse −1/0/1; Gegenrichtungen heben sich auf) */
export function arrowStep(iso: boolean, keys: Iterable<string>): [number, number] {
  const dirs = arrowDirs(iso);
  let dx = 0;
  let dy = 0;
  for (const k of keys) {
    const d = dirs[k];
    if (!d) continue;
    dx += d[0];
    dy += d[1];
  }
  return [Math.sign(dx), Math.sign(dy)];
}
