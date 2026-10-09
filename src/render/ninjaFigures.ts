/**
 * Zeichnet die Ninja-Adventure-Figuren (CC0, siehe ASSETS.md) als Texturen für die Welt:
 *  - Held: Basisfigur „Boy“ plus Ausrüstungsebenen (Helm, Rumpf, Schulterplatten, Handschuhe, Hose, Stiefel, Umhang, Köcher, Schild, Waffe),
 *  - NPCs und Monster/Tiere/Bosse aus den Sheets.
 * Sheet-Layout (Character/Monster): 4 Spalten = Blickrichtung (0 unten, 1 oben, 2 links, 3 rechts), Zeilen = Bilder
 * (0 Stand, 1 und 3 Schritt, 2 Stand, bei Character Zeile 4 Angriff mit ausgestrecktem Arm). Tiere: 2 Seitenbilder (Blick rechts),
 * Bosse: Streifen „Idle.png“ mit quadratischen Bildern (nur Vorderansicht).
 * Wir zeichnen nur nach rechts blickende Seitenansichten; GameScene spiegelt für „links“.
 * Zuordnungen und Modus-Schalter: figureMap.ts. Import-sicher in Node (Canvas nur beim Aufruf).
 */
import { templateById } from '../sim/items';
import type { Look } from './art';
import { HERO_BASE, ninjaFigurePaths, ninjaSheetPath, weaponPath, type NinjaMon } from './figureMap';
import { ninjaImg, preloadNinja } from './ninja';

/** Lädt alle Figuren-Bilder vor (Held, Monster, NPCs, Waffen); fehlende bleiben leer (Fallback DCSS). */
export const preloadNinjaFigures = (): Promise<void> => preloadNinja(ninjaFigurePaths());

/** Bewegungsphasen wie in art.ts (FRAME_*): 1 linker Schritt, 2 Ausholen, 3 Schlag, 4 rechter Schritt */
const F_STEP_L = 1;
const F_WIND = 2;
const F_STRIKE = 3;
const F_STEP_R = 4;

/** Texturen tragen ihre sichtbare Höhe (über den Füßen) und Breite in Bildpunkten, für Namen, Balken und Schatten. */
export type FigCanvas = HTMLCanvasElement & { figTop?: number; figW?: number; figDir?: boolean };

const OUTLINE = '#141b1b';

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  return g;
}

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function shade(n: number, f: number): number {
  const ch = (s: number) => Math.min(255, Math.max(0, Math.round(((n >> s) & 255) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function mixc(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Ein Bild des Sheets (16x16 usw.), optional multiplikativ gefärbt (Alpha bleibt). */
function frameCanvas(img: HTMLImageElement, sx: number, sy: number, w: number, h: number, tint?: number): HTMLCanvasElement {
  const c = mk(w, h);
  const g = ctx(c);
  g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  if (tint !== undefined) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = hex(tint);
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  }
  return c;
}

/** Unterste und oberste deckende Zeile sowie Spaltenbereich. */
function bounds(c: HTMLCanvasElement): { top: number; bottom: number; left: number; right: number } {
  const d = ctx(c).getImageData(0, 0, c.width, c.height).data;
  let top = c.height;
  let bottom = -1;
  let left = c.width;
  let right = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3]! > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { top, bottom, left, right };
}

/**
 * Hochskalieren (nearest) und so in ein Bild setzen, dass die Fußzeile `foot` (Zeilenindex im Eingabebild) bei Phaser-Ursprung
 * (0.5, originY) liegt. `below` = erlaubte Zeilen unter den Füßen (Ausfallschritt, Waffe).
 */
function pack(comp: HTMLCanvasElement, foot: number, scale: number, originY: number): FigCanvas {
  const below = comp.height - foot - 1;
  const H0 = Math.ceil(((foot + 1) * scale) / originY);
  const H = Math.max(H0, below > 0 ? Math.ceil((below * scale) / (1 - originY)) : 0);
  const drop = Math.max(0, Math.round(originY * H - (foot + 1) * scale));
  const out = mk(comp.width * scale, Math.max(H, drop + comp.height * scale)) as FigCanvas;
  const g = ctx(out);
  g.drawImage(comp, 0, 0, comp.width, comp.height, 0, drop, comp.width * scale, comp.height * scale);
  const b = bounds(comp);
  out.figTop = (foot + 1 - b.top) * scale;
  out.figW = (b.right - b.left + 1) * scale;
  return out;
}

/* ------------------------------------------------ Monster, Tiere, Bosse, NPCs */

/**
 * Figur aus einem Sheet nach Blickrichtung und Bewegungsphase. `back` = Rücken, `side` = Seitenansicht (nach rechts).
 * Ohne geladenes Bild: `null` (Aufrufer nimmt DCSS bzw. die prozedurale Figur).
 */
export function ninjaFigureCanvas(def: NinjaMon, frame: number, back: boolean, side: boolean, originY: number): FigCanvas | null {
  if (typeof document === 'undefined') return null;
  const img = ninjaImg(ninjaSheetPath(def));
  if (!img) return null;
  const animal = def.group === 'Animal';
  const boss = def.group === 'Boss';
  let sx: number;
  let sy = 0;
  let fw = 16;
  let fh = 16;
  if (animal) {
    fw = Math.floor(img.width / 2);
    fh = img.height;
    sx = frame === F_STEP_L || frame === F_STEP_R || frame === F_STRIKE ? fw : 0;
  } else if (boss) {
    fw = fh = img.height;
    const n = Math.max(1, Math.floor(img.width / fh));
    const idx = frame === F_STEP_L ? 1 : frame === F_STEP_R ? 3 : frame === F_WIND || frame === F_STRIKE ? 2 : 0;
    sx = (idx % n) * fw;
  } else {
    sx = (back ? 1 : side ? 3 : 0) * 16;
    const row = frame === F_STEP_L ? 1 : frame === F_STEP_R ? 3 : frame === F_STRIKE ? (def.group === 'Character' ? 4 : 1) : 0;
    sy = row * 16;
  }
  const f = frameCanvas(img, sx, sy, fw, fh, def.tint);
  const fb = bounds(f);
  if (fb.bottom < 0) return null;
  // Blickrichtung für Ausholen/Schlag (Tiere blicken immer nach rechts, Bosse nach unten)
  const fx = animal || side ? 1 : 0;
  const fy = animal || side ? 0 : back ? -1 : 1;
  const k = boss ? 3 : Math.max(1, Math.round(fh / 16));
  const lunge = frame === F_STRIKE ? 2 * k : frame === F_WIND ? -k : 0;
  const ox = fx * lunge;
  const oy = fy * lunge;
  const padX = 2 * k + 1;
  const padTop = 3 * k;
  const below = Math.max(0, oy);
  const comp = mk(fw + padX * 2, padTop + fb.bottom + 1 + below);
  ctx(comp).drawImage(f, padX + ox, padTop + oy);
  const out = pack(comp, padTop + fb.bottom, def.scale, originY);
  out.figDir = !animal && !boss;
  return out;
}

/* ------------------------------------------------ Held */

const OX = 6;
const OY = 5;
const CW = 28;
const TIER_RGB = [0x7a5a3a, 0x8a8d96, 0x6a86a8, 0xd8d0b0, 0x5a3a6a, 0xd86a2a];
const RARITY_RGB = [0, 0x4aa0ff, 0xffd84a, 0x4ae06a, 0xff8a2a];
const ORB_RGB = [0x90c0ff, 0x80d0ff, 0xb090ff, 0x70e0e0, 0xff9a40, 0xc060ff];

interface Pal {
  d: string;
  m: string;
  l: string;
}

function palOf(tier: number, leather = false): Pal {
  let base = TIER_RGB[Math.max(0, Math.min(5, tier))]!;
  base = leather ? mixc(base, 0x8a5a2e, 0.55) : mixc(base, 0x8a8d96, 0.3);
  return { d: hex(shade(base, 0.55)), m: hex(base), l: hex(shade(base, 1.35)) };
}

function tierOfId(id: string): number {
  if (!id) return -1;
  try {
    const ml = templateById(id).minLevel;
    return ml >= 26 ? 5 : ml >= 21 ? 4 : ml >= 16 ? 3 : ml >= 11 ? 2 : ml >= 6 ? 1 : 0;
  } catch {
    return 0;
  }
}

type HelmKind = 'cap' | 'helm' | 'crown' | 'horn' | 'visor';
function helmKind(id: string): HelmKind {
  if (id.includes('cap') || id.includes('hood')) return 'cap';
  if (id.includes('crown')) return 'crown';
  if (id.includes('dread')) return 'horn';
  if (id.includes('visor')) return 'visor';
  return 'helm';
}

const rgbOf = (d: Uint8ClampedArray, k: number): [number, number, number] => [d[k]!, d[k + 1]!, d[k + 2]!];
const isOutlinePx = (r: number, g: number, b: number): boolean => r + g + b < 120;
const isSkinPx = (r: number, g: number, b: number): boolean => r > 200 && g > 120 && g < 190 && b < 130;
const isWhitePx = (r: number, g: number, b: number): boolean => r > 190 && g > 190 && b > 190;

interface An {
  top: number;
  bodyTop: number;
  xmin: number[];
  xmax: number[];
  hand: { x: number; y: number };
}

function analyze(d: ImageData): An {
  const xmin: number[] = [];
  const xmax: number[] = [];
  let top = 16;
  for (let y = 0; y < 16; y++) {
    let a = 99;
    let b = -1;
    for (let x = 0; x < 16; x++) {
      if (d.data[(y * 16 + x) * 4 + 3]! > 0) {
        if (x < a) a = x;
        if (x > b) b = x;
      }
    }
    xmin.push(a === 99 ? 8 : a);
    xmax.push(b < 0 ? 7 : b);
    if (b >= 0 && y < top) top = y;
  }
  // Kragenzeile (erste weiße Zeile ab Zeile 11) = Beginn des Körpers
  let bodyTop = 12;
  outer: for (let y = 11; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const k = (y * 16 + x) * 4;
      if (d.data[k + 3]! > 0 && isWhitePx(...rgbOf(d.data, k))) {
        bodyTop = y;
        break outer;
      }
    }
  }
  // Hand: ganz rechts liegender Hautpixel unterhalb der Schulter, sonst Ärmelende
  let hand = { x: Math.min(15, xmax[bodyTop + 2]! + 0), y: Math.min(15, bodyTop + 2) };
  let found = -1;
  for (let y = bodyTop + 1; y < 16; y++) {
    for (let x = 11; x < 16; x++) {
      const k = (y * 16 + x) * 4;
      if (d.data[k + 3]! > 0 && isSkinPx(...rgbOf(d.data, k)) && x > found) {
        found = x;
        hand = { x, y };
      }
    }
  }
  return { top, bodyTop, xmin, xmax, hand };
}

function setPx(d: ImageData, x: number, y: number, col: string): void {
  const k = (y * 16 + x) * 4;
  const n = parseInt(col.slice(1), 16);
  d.data[k] = n >> 16;
  d.data[k + 1] = (n >> 8) & 255;
  d.data[k + 2] = n & 255;
}

/** Alle deckenden Pixel einer Zeile (außer Umriss/Haut) neu einfärben; `skin` = auch Haut. */
function paintRow(d: ImageData, y: number, col: string | ((x: number) => string), opts: { skin?: boolean; x0?: number; x1?: number } = {}): void {
  if (y < 0 || y > 15) return;
  for (let x = opts.x0 ?? 0; x <= (opts.x1 ?? 15); x++) {
    const k = (y * 16 + x) * 4;
    if (d.data[k + 3]! === 0) continue;
    const [r, g, b] = rgbOf(d.data, k);
    if (isOutlinePx(r, g, b)) continue;
    if (!opts.skin && isSkinPx(r, g, b)) continue;
    setPx(d, x, y, typeof col === 'function' ? col(x) : col);
  }
}

/** Ein kleiner Rahmenblock (mit Umrissrand) auf die Ebene zeichnen. */
function block(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rows: string[], edge = OUTLINE): void {
  g.fillStyle = edge;
  g.fillRect(x - 1 + OX, y - 1 + OY, w + 2, h + 2);
  for (let i = 0; i < h; i++) {
    g.fillStyle = rows[Math.min(i, rows.length - 1)]!;
    g.fillRect(x + OX, y + i + OY, w, 1);
  }
}

const P = (g: CanvasRenderingContext2D, x: number, y: number, col: string): void => {
  g.fillStyle = col;
  g.fillRect(x + OX, y + OY, 1, 1);
};

/* Waffen */

interface WArt {
  file: string;
  tint?: number;
  /** Bogen (prozedural) */
  bow?: boolean;
  /** Stab/Zauberstab: Spitze leuchtet beim Zauber */
  staff?: boolean;
}

function weaponArt(id: string, kind: number, tier: number): WArt {
  if (kind === 1) return { file: '', bow: true };
  if (kind === 2) return { file: id.includes('twig') || id.includes('oak') ? 'Stick' : 'MagicWand', staff: true };
  if (/dagger/.test(id)) return { file: id.includes('bone') ? 'Bone' : tier >= 2 ? 'Ninjaku' : 'Sai' };
  if (/club/.test(id)) return { file: 'Club' };
  if (/hammer/.test(id)) return { file: 'Hammer' };
  if (/woodcutter/.test(id)) return { file: 'AxeTool' };
  if (/axe|cleaver/.test(id)) return { file: 'Axe', tint: tier >= 4 ? 0xd0b0e8 : undefined };
  if (/greatsword|claymore|dread_blade|pyre_blade|glacier_blade/.test(id)) return { file: 'BigSword', tint: tier >= 4 ? 0xd8b8f0 : undefined };
  if (/duelist|parry/.test(id)) return { file: 'Rapier' };
  if (/saber|war_blade/.test(id)) return { file: 'Katana', tint: tier >= 4 ? 0xffc890 : undefined };
  if (/cinder_blade/.test(id)) return { file: 'Sword' };
  if (/rime_blade/.test(id)) return { file: 'Sword2', tint: 0xa0d0ff };
  if (/rusty/.test(id)) return { file: 'Sword2', tint: 0xb89070 };
  return { file: 'Sword2' };
}

const weaponCache = new Map<string, HTMLCanvasElement>();
function weaponImage(w: WArt): HTMLCanvasElement | null {
  const key = `${w.file}|${w.tint ?? ''}`;
  const hit = weaponCache.get(key);
  if (hit) return hit;
  const img = ninjaImg(weaponPath(w.file));
  if (!img) return null;
  const c = frameCanvas(img, 0, 0, img.width, img.height, w.tint);
  weaponCache.set(key, c);
  return c;
}

/** Bogen: senkrechter Holzbogen, Sehne gespannt; beim Ausholen Sehne zurückgezogen mit Pfeil, beim Schuss gerade. */
function drawBow(g: CanvasRenderingContext2D, hx: number, hy: number, pal: Pal, frame: number, side: boolean, arrow: boolean): void {
  const top = hy - 6;
  for (let i = 0; i < 11; i++) {
    const t = (i - 5) / 5;
    const dx = Math.round(2 * (1 - t * t));
    P(g, hx + dx + 1, top + i, OUTLINE);
    P(g, hx + dx, top + i, i % 5 === 0 ? pal.l : pal.m);
  }
  const pull = frame === F_WIND ? 2 : 0;
  g.fillStyle = '#e8e0d0';
  for (let i = 1; i < 10; i++) {
    const t = (i - 5) / 5;
    const x = hx - Math.round(pull * (1 - Math.abs(t)));
    g.fillRect(x + OX, top + i + OY, 1, 1);
  }
  if (frame === F_WIND && arrow && side) {
    g.fillStyle = '#a07848';
    g.fillRect(hx - pull + OX, hy + OY, 5, 1);
    g.fillStyle = '#e8e8f0';
    g.fillRect(hx - pull + 5 + OX, hy + OY, 1, 1);
  }
}

function dirOf(back: boolean, side: boolean): 'front' | 'back' | 'side' {
  return side ? 'side' : back ? 'back' : 'front';
}

/**
 * Held aus Basisfigur + Ausrüstung. `scale` 3 (Welt) oder 6 (Inventar-Puppe).
 * Gibt `null` zurück, wenn die Basisfigur nicht geladen ist (dann greift der DCSS-Held).
 */
export function ninjaHeroCanvas(look: Look, frame: number, back: boolean, side: boolean, scale: number, originY: number): FigCanvas | null {
  if (typeof document === 'undefined') return null;
  const sheet = ninjaImg(ninjaSheetPath({ group: 'Character', name: HERO_BASE }));
  if (!sheet) return null;
  const view = dirOf(back, side);
  const col = back ? 1 : side ? 3 : 0;
  const row = frame === F_STEP_L ? 1 : frame === F_STEP_R ? 3 : frame === F_STRIKE ? 4 : 0;
  const bc = frameCanvas(sheet, col * 16, row * 16, 16, 16);
  const bg = ctx(bc);
  const d = bg.getImageData(0, 0, 16, 16);
  const an = analyze(d);
  const i = look.ids;
  const attacking = frame === F_WIND || frame === F_STRIKE;
  const tChest = look.chest;
  const tHead = look.head;
  const tHands = look.hands;
  const tLegs = tierOfId(i.legs);
  const tFeet = tierOfId(i.feet);
  const tCloak = tierOfId(i.cloak);
  const tWeapon = look.weapon;
  const rar = look.rar ?? { head: 0, chest: 0, weapon: 0 };
  const rcol = (n: number): string => (n > 0 ? hex(RARITY_RGB[Math.min(4, n)]!) : '');
  const centerX = Math.round((an.xmin[an.top + 3]! + an.xmax[an.top + 3]!) / 2);
  const bt = an.bodyTop;

  /* --- Einfärben (auf den Basis-Pixeln) --- */
  const leatherChest = /leather|vest/.test(i.chest);
  const robe = look.robe;
  const chestPal = tChest >= 0 ? palOf(tChest, leatherChest) : null;
  if (chestPal) {
    const last = robe ? 15 : tLegs >= 0 ? bt + 1 : 14;
    for (let y = bt; y <= Math.min(last, 15); y++) {
      const r0 = y - bt;
      paintRow(d, y, (x) => {
        if (robe && (x === 5 || x === 10)) return chestPal.d;
        if (!leatherChest && !robe && r0 >= 1 && (x === 7 || x === 8)) return chestPal.l;
        if (leatherChest && r0 === 1 && x === centerX) return chestPal.d;
        return r0 === 0 ? chestPal.l : r0 === 1 ? chestPal.m : chestPal.d;
      });
    }
    const ac = rcol(rar.chest);
    if (ac && !robe) paintRow(d, bt + 1, ac, { x0: centerX - 1, x1: centerX });
  }
  if (tLegs >= 0 && !robe) {
    const lp = palOf(tLegs, /leather|cloth/.test(i.legs));
    paintRow(d, 14, (x) => (x % 4 === 0 ? lp.l : lp.m));
  }
  if (tFeet >= 0 && !robe) {
    const bp = palOf(tFeet, /cloth|leather/.test(i.feet));
    paintRow(d, 15, (x) => (x % 5 === 0 ? bp.l : bp.m));
  } else if (tFeet >= 0) {
    const bp = palOf(tFeet, /cloth|leather/.test(i.feet));
    paintRow(d, 15, bp.m, { x0: 0, x1: 4 });
    paintRow(d, 15, bp.m, { x0: 11, x1: 15 });
  }
  if (tHands >= 0) {
    const gp = palOf(tHands, /gloves$|worn/.test(i.hands));
    for (let y = bt + 1; y < 16; y++) {
      if (side) {
        for (let x = 0; x < 16; x++) {
          const k = (y * 16 + x) * 4;
          if (d.data[k + 3]! > 0 && isSkinPx(...rgbOf(d.data, k))) setPx(d, x, y, gp.m);
        }
      } else {
        paintRow(d, y, y === bt + 1 ? gp.l : gp.m, { x0: 0, x1: 3, skin: true });
        paintRow(d, y, y === bt + 1 ? gp.l : gp.m, { x0: 12, x1: 15, skin: true });
      }
    }
  }
  /* Kopf: Kuppel über dem Haar, Gesicht bleibt frei */
  const hk = tHead >= 0 ? helmKind(i.head) : null;
  const hp = tHead >= 0 ? palOf(tHead) : null;
  if (hk && hp) {
    const faceBack = back ? 6 : 5;
    const rows = hk === 'cap' ? 3 : hk === 'visor' && !back && !side ? 8 : hk === 'visor' ? faceBack + 1 : faceBack;
    for (let r = 1; r <= rows; r++) {
      const y = an.top + r;
      let c: string;
      if (hk === 'cap') c = r === 1 ? hp.l : r === 2 ? hp.m : hp.d;
      else if (hk === 'visor' && r === 7 && !back && !side) c = '#101018';
      else if (hk === 'visor' && r >= 6 && !back && !side) c = hp.d;
      else c = r === 1 ? hp.l : r <= 3 ? hp.m : r === rows ? hp.d : hp.m;
      paintRow(d, y, c, { skin: hk === 'visor' && r >= 6 && !back });
    }
    if (hk === 'visor' && !back && !side) {
      for (const x of [5, 6, 9, 10]) setPx(d, x, an.top + 7, hp.l);
    }
    const ac = rcol(rar.head);
    if (ac && hk !== 'cap') paintRow(d, an.top + 1, ac, { x0: centerX - 2, x1: centerX + 1 });
    if (!back && !side && (hk === 'helm' || hk === 'crown' || hk === 'horn')) {
      for (let y = an.top + 6; y <= an.top + 8; y++) for (const x of [7, 8]) if (d.data[(y * 16 + x) * 4 + 3]! > 0) setPx(d, x, y, hp.d);
    }
  }
  bg.putImageData(d, 0, 0);

  /* --- Zusammensetzen --- */
  const comp = mk(CW, OY + 16 + 2);
  const g = ctx(comp);
  const shieldTier = look.shield;
  const cloakPal = tCloak >= 0 ? palOf(tCloak, /rag|wool|hunter|wolf/.test(i.cloak)) : null;
  const L = an.xmin[bt + 1]!;
  const R = an.xmax[bt + 1]!;

  // hinter dem Körper: Umhang, Köcher, Schild bei Seitenansicht
  if (cloakPal && view !== 'back') {
    const x0 = view === 'side' ? L - 1 : L - 1;
    const x1 = view === 'side' ? L + 3 : R + 1;
    for (let y = bt - 1; y <= 15; y++) {
      for (let x = x0; x <= x1; x++) {
        if (view === 'front' && x > L + 1 && x < R - 1 && y < 15) continue;
        P(g, x, y, y === 15 ? OUTLINE : x === x0 ? cloakPal.d : (x + y) % 4 === 0 ? cloakPal.l : cloakPal.m);
      }
    }
    P(g, x0, bt - 2, OUTLINE);
  }
  if (look.quiver && view !== 'back') {
    const qx = view === 'side' ? L - 1 : R;
    for (let y = bt - 3; y <= bt + 1; y++) {
      P(g, qx, y, '#6a4a28');
      P(g, qx + 1, y, y === bt - 3 ? '#e8e0d0' : '#8a6038');
    }
    P(g, qx, bt - 4, '#e8e0d0');
  }
  if (shieldTier >= 0 && view === 'side') {
    const sp = palOf(shieldTier);
    block(g, L - 1, bt, 3, 5, [sp.l, sp.m, sp.m, sp.d]);
  }

  g.drawImage(bc, OX, OY);

  // Umhang von hinten: über Rücken und Haarsaum
  if (cloakPal && view === 'back') {
    for (let y = bt - 2; y <= 15; y++) {
      const x0 = an.xmin[Math.max(bt, y)]! + 0;
      const x1 = an.xmax[Math.max(bt, y)]! - 0;
      for (let x = x0; x <= x1; x++) {
        if (y === bt - 2 && (x < x0 + 2 || x > x1 - 2)) continue;
        P(g, x, y, y === 15 || x === x0 || x === x1 ? OUTLINE : (x - x0) % 5 === 2 ? cloakPal.d : y === bt - 2 ? cloakPal.l : cloakPal.m);
      }
    }
  }
  if (look.quiver && view === 'back') {
    for (let k = 0; k < 6; k++) P(g, centerX + 1 + (k >> 1), bt - 3 + k, k % 2 ? '#8a6038' : '#6a4a28');
    P(g, centerX, bt - 4, '#e8e0d0');
  }

  // Schulterplatten (Metall; Leder und Roben haben keine)
  if (chestPal && !leatherChest && !robe) {
    if (view === 'side') {
      block(g, centerX - 2, bt - 1, 3, 2, [chestPal.l, chestPal.m]);
    } else {
      block(g, L - 2, bt - 1, 3, 2, [chestPal.l, chestPal.m]);
      block(g, R, bt - 1, 3, 2, [chestPal.l, chestPal.d]);
    }
  }
  // Schild vorn/hinten auf der linken Bildseite (hinten rechts)
  if (shieldTier >= 0 && view !== 'side') {
    const sp = palOf(shieldTier);
    const sx = view === 'front' ? L - 3 : R - 1;
    block(g, sx, bt - 1, 4, 6, view === 'front' ? [sp.l, sp.m, sp.m, sp.m, sp.d, sp.d] : [sp.m, sp.m, sp.d, sp.d, sp.d, sp.d]);
    if (view === 'front') {
      P(g, sx + 1, bt + 1, sp.l);
      P(g, sx + 2, bt + 1, sp.l);
      if (shieldTier >= 3) P(g, sx + 1, bt + 2, '#e0b030');
    }
  }
  // Helm-Zubehör über den Umriss
  if (hk && hp) {
    const cx0 = centerX;
    if (hk === 'crown') {
      for (const dx of [-3, 0, 3]) {
        P(g, cx0 + dx, an.top - 1, '#e0b030');
        P(g, cx0 + dx + 1, an.top - 1, '#ffe27a');
        P(g, cx0 + dx, an.top - 2, '#e0b030');
      }
    }
    if (hk === 'horn') {
      const lx = an.xmin[an.top + 2]!;
      const rx = an.xmax[an.top + 2]!;
      const hc = '#e8e0c0';
      if (view !== 'side') for (const [x, s] of [[lx, -1], [rx, 1]] as const) {
        P(g, x + s, an.top + 1, OUTLINE);
        P(g, x + s, an.top + 2, hc);
        P(g, x + s, an.top, hc);
        P(g, x + 2 * s, an.top - 1, hc);
        P(g, x + 2 * s, an.top - 2, OUTLINE);
      } else {
        P(g, lx - 1, an.top + 1, hc);
        P(g, lx - 1, an.top, hc);
        P(g, lx - 2, an.top - 1, hc);
      }
    }
    const plume = tHead >= 3 || rar.head >= 2;
    if (plume && hk !== 'cap') {
      const pc = hex(rar.head > 0 ? RARITY_RGB[Math.min(4, rar.head)]! : 0xe0262f);
      const px = view === 'side' ? cx0 - 2 : cx0;
      for (let y = 1; y <= 3; y++) {
        P(g, px, an.top - y, pc);
        P(g, px + 1, an.top - y, y === 3 ? pc : hex(shade(parseInt(pc.slice(1), 16), 0.75)));
      }
      P(g, px - 1, an.top - 3, pc);
      P(g, px + (view === 'side' ? -2 : 2), an.top - 2, hex(shade(parseInt(pc.slice(1), 16), 0.75)));
    }
  }

  /* Waffe in der Hand */
  if (look.weapon >= 0 || i.weapon) {
    const art = weaponArt(i.weapon, look.weaponKind, tWeapon);
    const gx = (view === 'side' ? an.hand.x : Math.max(an.hand.x, an.xmax[bt + 2]! + 1)) + (view === 'side' ? 0 : 0);
    const gy = an.hand.y;
    if (art.bow) {
      drawBow(g, gx + 1, gy - 1, palOf(tWeapon), frame, view === 'side', true);
    } else {
      const wi = weaponImage(art);
      if (wi) {
        // Tabelle der Drehung (Bogenmaß, 0 = Spitze nach oben, positiv = im Uhrzeigersinn)
        const rot = (() => {
          const idle = view === 'side' ? 0.35 : 0.22;
          if (frame === F_WIND) return view === 'side' ? -0.9 : view === 'back' ? 0.8 : 1.0;
          if (frame === F_STRIKE) {
            if (art.staff) return view === 'side' ? 1.5 : view === 'back' ? 0.1 : 1.3;
            return view === 'side' ? 1.65 : view === 'back' ? 0.05 : 1.6;
          }
          return idle + (frame === F_STEP_L ? -0.08 : frame === F_STEP_R ? 0.08 : 0);
        })();
        const ox = frame === F_STRIKE && view === 'side' ? 1 : 0;
        const oy = frame === F_STRIKE && view === 'back' ? -2 : 0;
        g.save();
        g.translate(gx + OX + ox, gy + OY + oy + 1);
        g.rotate(rot);
        g.scale(1, -1);
        g.drawImage(wi, -Math.floor(wi.width / 2), -1);
        g.restore();
        if (art.staff && attacking) {
          // leuchtende Spitze: Länge des Stabs entlang der Drehung
          const len = wi.height - 1;
          const tx = Math.round(gx + ox + Math.sin(rot) * len);
          const ty = Math.round(gy + oy + 1 - Math.cos(rot) * len);
          const oc = hex(ORB_RGB[Math.max(0, Math.min(5, tWeapon))]!);
          g.globalAlpha = 0.55;
          g.fillStyle = oc;
          g.fillRect(tx - 1 + OX, ty - 1 + OY, 3, 3);
          g.globalAlpha = 1;
          P(g, tx, ty, '#ffffff');
        }
      }
    }
    const ac = rcol(rar.weapon);
    if (ac && !art.bow) P(g, gx, gy - 1, ac);
  }

  const out = pack(comp, OY + 15, scale, originY);
  out.figDir = true;
  return out;
}
