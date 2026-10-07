import type Phaser from 'phaser';
import type { MonsterFamily } from '../sim/data';
import type { Actor } from '../sim/world';
import { templateById } from '../sim/items';
import { sprite } from './sprites';
import { CHEST_SPRITES, MONSTER_SPRITES, PLAYER_BASE, PLAYER_DEFAULTS, PLAYER_HAIR, PLAYER_LAYERS, SPRITE_SCALE, NPC_NAME_SPRITES, npcSpriteFile } from './spriteMap';

/**
 * Prozedurale Pixel-Art: Terrain, Wände, Bäume usw. werden beim Start im Code gezeichnet.
 * Figuren, Truhen und Items nutzen, wo vorhanden, die CC0-Sprites von Dungeon Crawl Stone Soup (siehe sprites.ts,
 * spriteMap.ts, ASSETS.md); fehlt ein Sprite, greift die prozedurale Zeichnung unverändert als Fallback.
 * Sprites werden klein (logische Pixel) gemalt, mit Umriss versehen und dann hart (nearest) hochskaliert.
 */

type Ctx = CanvasRenderingContext2D;

export const TILE_W = 64;
export const TILE_H = 32;

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(c: HTMLCanvasElement): Ctx {
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return x;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function shade(n: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Grundfarbe einer Kachelart (für Übergänge an Terraingrenzen). */
export function tileBase(gid: number): number {
  return (TILE_PAL[gid] ?? TILE_PAL[4]!).base;
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, col: number | string): void {
  c.fillStyle = typeof col === 'number' ? css(col) : col;
  c.fillRect(x, y, w, h);
}

/** Dunkler 1-px-Umriss um alle deckenden Pixel (auf logischer Auflösung). */
function outline(src: HTMLCanvasElement, col = '#120e12'): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = mkCanvas(w, h);
  const sc = ctxOf(src);
  const oc = ctxOf(out);
  const d = sc.getImageData(0, 0, w, h).data;
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]!);
  oc.fillStyle = col;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) === 0 && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) oc.fillRect(x, y, 1, 1);
    }
  }
  oc.drawImage(src, 0, 0);
  return out;
}

/** Legt einen weichen Kontaktschatten unter ein Sprite (Bodenhaftung statt Schweben). */
function grounded(src: HTMLCanvasElement, widthFrac: number, baseYFrac: number): HTMLCanvasElement {
  const out = mkCanvas(src.width, src.height);
  const c = ctxOf(out);
  const cx = src.width / 2;
  const cy = src.height * baseYFrac;
  const w = src.width * widthFrac;
  for (let i = 3; i >= 0; i--) {
    c.fillStyle = `rgba(0,0,0,${0.1 + (3 - i) * 0.07})`;
    c.beginPath();
    c.ellipse(cx, cy, (w / 2) * (0.55 + i * 0.15), (w / 2) * 0.22 * (0.55 + i * 0.15), 0, 0, Math.PI * 2);
    c.fill();
  }
  c.drawImage(src, 0, 0);
  return out;
}

function upscale(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const out = mkCanvas(src.width * k, src.height * k);
  const c = ctxOf(out);
  c.drawImage(src, 0, 0, out.width, out.height);
  return out;
}


/* ------------------------------------------------ Sprite-Figuren (DCSS, CC0) */

/** Sprite-Kantenlänge und Rand (für Ausholen/Sprünge) in logischen Pixeln */
const SP = 32;
const SP_PAD = 4;
const SP_SIZE = SP + SP_PAD * 2;

/** Zeichnet ein Sprite, optional mit multiplikativer Färbung (Alpha bleibt erhalten). */
function drawSprite(x: Ctx, img: HTMLImageElement, tint?: number): void {
  if (tint === undefined) {
    x.drawImage(img, 0, 0);
    return;
  }
  const t = mkCanvas(SP, SP);
  const tc = ctxOf(t);
  tc.drawImage(img, 0, 0);
  tc.globalCompositeOperation = 'multiply';
  tc.fillStyle = css(tint);
  tc.fillRect(0, 0, SP, SP);
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(img, 0, 0);
  x.drawImage(t, 0, 0);
}

/**
 * Baut aus gezeichneten Sprite-Ebenen eine Figurentextur: Umriss, Hochskalierung und eine Bildhöhe, bei der die
 * unterste deckende Zeile genau auf `originY` liegt (so passt `setOrigin(0.5, originY)` für beliebige Sprites).
 */
const footCache = new WeakMap<HTMLImageElement, number>();
/** Unterste nicht-transparente Pixelzeile eines Sprites (Fußpunkt der Figur, unabhängig von Waffe/Umhang darüber). */
function opaqueBottom(img: HTMLImageElement): number {
  const hit = footCache.get(img);
  if (hit !== undefined) return hit;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = mkCanvas(w, h);
  const cx = ctxOf(c);
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, w, h).data;
  let b = h - 1;
  while (b > 0 && !d.subarray(b * w * 4, (b + 1) * w * 4).some((v, i) => i % 4 === 3 && v > 0)) b--;
  footCache.set(img, b);
  return b;
}

/** Oberste nicht-transparente Pixelzeile eines Sprites. */
function opaqueTop(img: HTMLImageElement): number {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = mkCanvas(w, h);
  const cx = ctxOf(c);
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, w, h).data;
  let t = 0;
  while (t < h - 1 && !d.subarray(t * w * 4, (t + 1) * w * 4).some((v, i) => i % 4 === 3 && v > 0)) t++;
  return t;
}

/**
 * Seitenansicht einer zweibeinigen Einzelfigur: Körper schmaler, beim Gehen schwingen die Beine
 * (untere ~40 % der Figur, links/rechts getrennt) entlang der Laufrichtung statt zur Seite zu spreizen.
 */
function drawProfile(x: Ctx, img: HTMLImageElement, tint: number | undefined, frame: number): void {
  const t = mkCanvas(SP, SP);
  drawSprite(ctxOf(t), img, tint);
  // DCSS-Figuren sind leicht nach links gedreht: vorab nach rechts spiegeln, damit Neigung und Beinschritt zur Laufrichtung passen
  x.translate(SP / 2, 0);
  x.scale(-0.88, 1);
  x.translate(-SP / 2, 0);
  if (frame !== FRAME_STEP_L && frame !== FRAME_STEP_R) {
    x.drawImage(t, 0, 0);
    return;
  }
  const top = opaqueTop(img);
  const bottom = opaqueBottom(img);
  const hip = Math.round(top + (bottom - top + 1) * 0.6);
  const side = frame === FRAME_STEP_L ? -1 : 1;
  x.save();
  x.beginPath();
  x.rect(0, 0, SP, hip);
  x.clip();
  x.drawImage(t, 0, 0);
  x.restore();
  for (const left of [true, false]) {
    const dx = (left ? 1 : -1) * side * 3;
    x.save();
    x.translate(dx, dx < 0 ? -1 : 0);
    x.beginPath();
    x.rect(left ? 0 : SP / 2, hip, SP / 2, SP - hip);
    x.clip();
    x.drawImage(t, 0, 0);
    x.restore();
  }
}

function spriteCanvas(key: string, draw: (x: Ctx) => void, scale: number, originY: number, rim?: string, foot?: number): HTMLCanvasElement {
  const hit = actorCache.get(key);
  if (hit) return hit;
  const c = mkCanvas(SP_SIZE, SP_SIZE);
  const x = ctxOf(c);
  x.translate(SP_PAD, SP_PAD);
  draw(x);
  const o = outline(c, rim);
  const d = ctxOf(o).getImageData(0, 0, SP_SIZE, SP_SIZE).data;
  let bottom = SP_SIZE - 1;
  if (foot !== undefined) bottom = Math.min(SP_SIZE - 1, foot + SP_PAD + 1);
  else while (bottom > 0 && !d.subarray(bottom * SP_SIZE * 4, (bottom + 1) * SP_SIZE * 4).some((v, i) => i % 4 === 3 && v > 0)) bottom--;
  const up = upscale(o, scale);
  const h = Math.max(up.height, Math.ceil(((bottom + 1) * scale) / originY));
  const out = mkCanvas(up.width, h);
  // Kleine Sprites (Ratten, Imps …) stehen im Bild höher als der Fußanker: nach unten schieben, damit die Füße auf dem Boden stehen
  const drop = Math.max(0, Math.round(originY * h - (bottom + 1) * scale));
  ctxOf(out).drawImage(up, 0, drop);
  actorCache.set(key, out);
  return out;
}

/**
 * Bewegungsphasen einer Figur: 0 Stand, 1 linker Schritt, 2 Ausholen/Anlegen, 3 Schlag/Schuss, 4 rechter Schritt.
 * Laufzyklus in GameScene: 1, 0, 4, 0.
 */
export const FRAME_STEP_L = 1;
export const FRAME_WIND = 2;
export const FRAME_STRIKE = 3;
export const FRAME_STEP_R = 4;

type AttackKind = 'melee' | 'bow' | 'staff';

interface BodyPose {
  /** Neigung in Grad (positiv = nach vorn, Blick nach rechts) um den Fußpunkt */
  rot: number;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

/** Körperhaltung der ganzen Figur um den Fußpunkt; `damp` schwächt große Figuren/Bosse ab. */
function bodyPose(frame: number, kind: AttackKind, damp = 1, profile = false): BodyPose {
  const p: BodyPose = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 };
  if (profile && (frame === FRAME_STEP_L || frame === FRAME_STEP_R)) {
    // Seitenansicht: gleichbleibend leicht nach vorn geneigt (Blick nach rechts), kein Wechsel nach hinten
    p.rot = 3 * damp;
    p.sy = 1 - 0.03 * damp;
  } else if (frame === FRAME_STEP_L || frame === FRAME_STEP_R) {
    const side = frame === FRAME_STEP_L ? -1 : 1;
    p.rot = side * 4 * damp;
    p.sy = 1 - 0.04 * damp;
    p.sx = 1 + 0.02 * damp;
    p.dx = side * 0.5 * damp;
  } else if (frame === FRAME_WIND) {
    if (kind === 'bow') Object.assign(p, { rot: 2, dx: 0 });
    else if (kind === 'staff') Object.assign(p, { rot: -5 * damp, dx: -1 * damp, dy: 1 });
    else Object.assign(p, { rot: -8 * damp, dx: -2 * damp, sy: 1 - 0.04 * damp, sx: 1 + 0.02 * damp });
  } else if (frame === FRAME_STRIKE) {
    if (kind === 'bow') Object.assign(p, { rot: -6 * damp, dx: -2 * damp, sy: 1 + 0.02 });
    else if (kind === 'staff') Object.assign(p, { rot: 9 * damp, dx: 3 * damp, dy: -1 });
    else Object.assign(p, { rot: 10 * damp, dx: 4 * damp, dy: -1, sx: 1 + 0.07 * damp, sy: 1 - 0.06 * damp });
  }
  return p;
}

/** Wendet eine Körperhaltung an (Drehpunkt: Fußmitte). */
function applyBodyPose(x: Ctx, p: BodyPose): void {
  x.translate(SP / 2 + p.dx, SP + p.dy);
  x.rotate((p.rot * Math.PI) / 180);
  x.scale(p.sx, p.sy);
  x.translate(-SP / 2, -SP);
}

/** Einteilige Figur (Monster): Haltung um den Fußpunkt. */
function pose(x: Ctx, frame: number, damp = 1, profile = false): void {
  applyBodyPose(x, bodyPose(frame, 'melee', damp, profile));
}

interface WeaponGeo {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Griff (Drehpunkt der Hand) */
  gripX: number;
  gripY: number;
  /** Spitze (oben) bzw. Bogenenden */
  topX: number;
  topY: number;
  botX: number;
  botY: number;
  /** Bogenbauch: -1 links, +1 rechts (aus der Lage der Bogenmitte gegenüber den Enden) */
  belly: number;
}

const geoCache = new Map<HTMLImageElement, WeaponGeo>();

/** Misst Lage und Griffpunkt einer Waffenebene aus den deckenden Pixeln. */
function weaponGeo(img: HTMLImageElement): WeaponGeo {
  const hit = geoCache.get(img);
  if (hit) return hit;
  const c = mkCanvas(SP, SP);
  const cc = ctxOf(c);
  cc.drawImage(img, 0, 0);
  const d = cc.getImageData(0, 0, SP, SP).data;
  const rowAvg = (y0: number, y1: number): { x: number; n: number } => {
    let sum = 0;
    let n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(SP - 1, y1); y++) {
      for (let xx = 0; xx < SP; xx++) {
        if (d[(y * SP + xx) * 4 + 3]! > 0) {
          sum += xx;
          n++;
        }
      }
    }
    return { x: n ? sum / n : SP / 2, n };
  };
  let minX = SP;
  let maxX = 0;
  let minY = SP;
  let maxY = 0;
  for (let y = 0; y < SP; y++) {
    for (let xx = 0; xx < SP; xx++) {
      if (d[(y * SP + xx) * 4 + 3]! > 0) {
        minX = Math.min(minX, xx);
        maxX = Math.max(maxX, xx);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const top = rowAvg(minY, minY + 1);
  const bot = rowAvg(maxY - 1, maxY);
  const mid = rowAvg(Math.round((minY + maxY) / 2) - 2, Math.round((minY + maxY) / 2) + 2);
  const geo: WeaponGeo = {
    minX, maxX, minY, maxY,
    gripX: rowAvg(maxY - 4, maxY).x, gripY: maxY - 2,
    topX: top.x, topY: minY, botX: bot.x, botY: maxY,
    belly: mid.x < (top.x + bot.x) / 2 - 0.3 ? -1 : 1,
  };
  geoCache.set(img, geo);
  return geo;
}

/* ---------------------------------------------------------------- Kacheln */

const diamondPath = (c: Ctx, w = TILE_W, h = TILE_H, y0 = 0): void => {
  c.beginPath();
  c.moveTo(w / 2, y0);
  c.lineTo(w, y0 + h / 2);
  c.lineTo(w / 2, y0 + h);
  c.lineTo(0, y0 + h / 2);
  c.closePath();
};

interface TilePalette {
  base: number;
  dots: number[];
  dotCount: number;
  seams?: number;
  detail?: (c: Ctx, r: () => number) => void;
}

const TILE_PAL: Record<number, TilePalette> = {
  1: { base: 0x4a4440, dots: [0x3a3532, 0x5a534d, 0x403a37], dotCount: 40, seams: 0x363230 },
  3: { base: 0x2f3f2c, dots: [0x3a3a26, 0x2a4a45, 0x4a6a3a, 0x263622], dotCount: 55 },
  4: { base: 0x35502e, dots: [0x4a6e3a, 0x2a4226, 0x3f5e33], dotCount: 70 },
  5: { base: 0x34303a, dots: [0x26222c, 0x403a48, 0x2d2933], dotCount: 35, seams: 0x24202a },
  6: { base: 0x1d3550, dots: [0x2f5578, 0x244566, 0x16283e], dotCount: 30 },
  7: { base: 0x6a5840, dots: [0x8a7658, 0x4a3e2c, 0x75634a], dotCount: 55 },
  8: { base: 0x4a5040, dots: [0x6a6e5c, 0x3a4a30, 0x585e4c], dotCount: 55 },
  9: { base: 0x3a3230, dots: [0x6a4a3a, 0x2a2220, 0x4a3c38], dotCount: 55 },
  12: { base: 0x8a2a10, dots: [0xf08a20, 0x3a1008, 0xc84a14], dotCount: 45 },
  // Stadt (Stufe 6): Dielen, Marktplatzpflaster, Blumenwiese
  15: { base: 0x7a5a38, dots: [0x6a4a2c, 0x8a6a44, 0x70522f], dotCount: 22 },
  16: { base: 0x6e665e, dots: [0x80786e, 0x5c554e, 0x766e66], dotCount: 50, seams: 0x4e4741 },
  17: { base: 0x3a5a30, dots: [0x4a6e3a, 0x2f4a28, 0x44663a], dotCount: 60 },
};

const tileCache = new Map<string, HTMLCanvasElement>();

export function tileCanvas(gid: number, variant: number): HTMLCanvasElement {
  const key = `${gid}_${variant}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const pal = TILE_PAL[gid] ?? TILE_PAL[4]!;
  const c = mkCanvas(TILE_W, TILE_H);
  const x = ctxOf(c);
  const r = rng(gid * 977 + variant * 131 + 7);
  x.save();
  diamondPath(x);
  x.clip();
  rect(x, 0, 0, TILE_W, TILE_H, pal.base);
  for (let i = 0; i < pal.dotCount; i++) {
    const px = Math.floor(r() * TILE_W);
    const py = Math.floor(r() * TILE_H);
    const sz = r() < 0.2 ? 3 : 2;
    rect(x, px, py, sz, sz - (r() < 0.5 ? 1 : 0), mix(pal.base, pal.dots[Math.floor(r() * pal.dots.length)]!, 0.55));
  }
  if (pal.seams !== undefined) {
    x.strokeStyle = css(pal.seams);
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(TILE_W / 4, TILE_H / 4);
    x.lineTo((TILE_W * 3) / 4, (TILE_H * 3) / 4);
    x.moveTo((TILE_W * 3) / 4, TILE_H / 4);
    x.lineTo(TILE_W / 4, (TILE_H * 3) / 4);
    x.stroke();
  }
  if (gid === 4 && r() < 0.15) rect(x, 28 + Math.floor(r() * 8), 12 + Math.floor(r() * 6), 2, 2, 0xc0b060);
  if (gid === 15) {
    // Dielen: Fugen parallel zur Kachelkante, wechselnde Brettlängen
    x.strokeStyle = css(0x4a3220);
    x.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      x.beginPath();
      x.moveTo(TILE_W / 2 + i * 8, 0);
      x.lineTo(TILE_W / 2 + i * 8 + TILE_W / 2, TILE_H / 2);
      x.lineTo(TILE_W / 2 + i * 8, TILE_H);
      x.stroke();
    }
    for (let i = 0; i < 5; i++) rect(x, 8 + Math.floor(r() * 46), 4 + Math.floor(r() * 22), 2, 1, 0x3a2818);
  }
  if (gid === 17) {
    const cols = [0xe05a5a, 0xf0d84a, 0xf0f0f0, 0xb07ae0];
    for (let i = 0; i < 9; i++) rect(x, 8 + Math.floor(r() * 48), 4 + Math.floor(r() * 24), 2, 2, cols[Math.floor(r() * cols.length)]!);
  }
  if (gid === 9 && r() < 0.3) rect(x, 20 + Math.floor(r() * 24), 8 + Math.floor(r() * 14), 2, 2, 0xd86a2a);
  if (gid === 6) {
    x.fillStyle = 'rgba(160,200,230,0.25)';
    for (let i = 0; i < 3; i++) x.fillRect(10 + Math.floor(r() * 40), 6 + Math.floor(r() * 18), 8, 1);
  }
  if (gid === 3) {
    x.fillStyle = 'rgba(120,180,170,0.22)';
    for (let i = 0; i < 2; i++) x.fillRect(12 + Math.floor(r() * 36), 8 + Math.floor(r() * 16), 9, 2);
  }
  x.restore();
  tileCache.set(key, c);
  return c;
}

/* ------------------------------------------------------- Props (Wand, Baum…) */

export type WallStyle = 'brick' | 'dungeon' | 'cliff';
const WALL_H = 44;

function wallCanvas(style: WallStyle, variant: number): HTMLCanvasElement {
  const pal = {
    brick: { left: 0x5c5148, right: 0x4a4038, top: 0x7a6e62, line: 0x3a322c },
    dungeon: { left: 0x2c2833, right: 0x221e28, top: 0x403a48, line: 0x18151d },
    cliff: { left: 0x57524a, right: 0x433f39, top: 0x6c665c, line: 0x2f2c27 },
  }[style];
  const c = mkCanvas(TILE_W, TILE_H + WALL_H);
  const x = ctxOf(c);
  const r = rng(variant * 53 + style.length * 11);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  // linke Fläche
  x.fillStyle = css(pal.left);
  x.beginPath();
  x.moveTo(0, hh);
  x.lineTo(hw, TILE_H);
  x.lineTo(hw, TILE_H + WALL_H);
  x.lineTo(0, hh + WALL_H);
  x.closePath();
  x.fill();
  // rechte Fläche
  x.fillStyle = css(pal.right);
  x.beginPath();
  x.moveTo(TILE_W, hh);
  x.lineTo(hw, TILE_H);
  x.lineTo(hw, TILE_H + WALL_H);
  x.lineTo(TILE_W, hh + WALL_H);
  x.closePath();
  x.fill();
  // Ziegel/Fugen
  x.strokeStyle = css(pal.line);
  x.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const dy = i * 7;
    x.beginPath();
    x.moveTo(0, hh + dy);
    x.lineTo(hw, TILE_H + dy);
    x.lineTo(TILE_W, hh + dy);
    x.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const side = r() < 0.5 ? 0 : 1;
    const px = side === 0 ? 2 + Math.floor(r() * 28) : hw + 2 + Math.floor(r() * 28);
    const py = TILE_H + Math.floor(r() * (WALL_H - 4));
    rect(x, px, py, 2, 2, shade(side === 0 ? pal.left : pal.right, 0.8 + r() * 0.4));
  }
  // Oberseite
  x.save();
  x.translate(0, 0);
  diamondPath(x);
  x.fillStyle = css(pal.top);
  x.fill();
  x.restore();
  for (let i = 0; i < 10; i++) rect(x, 14 + Math.floor(r() * 36), 7 + Math.floor(r() * 17), 2, 1, shade(pal.top, 0.85 + r() * 0.3));
  if (style === 'cliff' && r() < 0.5) rect(x, 24 + Math.floor(r() * 14), 12, 6, 2, 0x4a6a3a);
  return c;
}

function treeCanvas(style: 'oak' | 'pine' | 'dead' | 'char', variant: number): HTMLCanvasElement {
  const lw = 16;
  const lh = 24;
  const c = mkCanvas(lw, lh);
  const x = ctxOf(c);
  const r = rng(variant * 31 + style.length);
  const trunk = style === 'char' ? 0x2a2220 : 0x5a4030;
  rect(x, 7, 15, 2, 8, trunk);
  rect(x, 6, 21, 4, 2, shade(trunk, 0.8));
  if (style === 'oak') {
    const g = [0x2f5a30, 0x3f7a3c, 0x255026];
    for (const [cx, cy, rad] of [[8, 9, 6], [4, 11, 4], [12, 11, 4], [8, 5, 4]] as const) {
      for (let yy = -rad; yy <= rad; yy++) {
        for (let xx = -rad; xx <= rad; xx++) {
          if (xx * xx + yy * yy <= rad * rad) rect(x, cx + xx, cy + yy, 1, 1, g[(xx + yy + 20 + variant) % 3 === 0 ? 1 : yy > 1 ? 2 : 0]!);
        }
      }
    }
  } else if (style === 'pine') {
    for (let i = 0; i < 4; i++) {
      const w = 3 + i * 2;
      rect(x, 8 - Math.floor(w / 2) - 1, 4 + i * 4, w + 2, 4, i % 2 ? 0x2a4a2c : 0x35603a);
      rect(x, 8 - Math.floor(w / 2) - 1, 7 + i * 4, w + 2, 1, 0x1f3a22);
    }
  } else {
    const col = style === 'dead' ? 0x4a4036 : 0x2a2220;
    rect(x, 7, 6, 2, 10, col);
    for (const [bx, by, dx] of [[7, 8, -4], [8, 6, 4], [7, 11, -3], [8, 10, 3]] as const) {
      rect(x, bx + Math.min(0, dx), by, Math.abs(dx), 1, col);
      rect(x, bx + dx, by - 2, 1, 2, col);
    }
    if (style === 'dead' && r() < 0.6) rect(x, 3, 14, 2, 1, 0x5a6a3a);
  }
  return grounded(upscale(outline(c), 3), 0.55, 0.93);
}

function rockCanvas(style: 'grey' | 'dark', variant: number): HTMLCanvasElement {
  const c = mkCanvas(14, 10);
  const x = ctxOf(c);
  const base = style === 'grey' ? 0x77727c : 0x54504c;
  rect(x, 2, 5, 10, 4, shade(base, 0.8));
  rect(x, 3, 3, 8, 4, base);
  rect(x, 5, 2, 4, 2, shade(base, 1.2));
  rect(x, 4 + (variant % 3), 4, 2, 1, shade(base, 1.3));
  return grounded(upscale(outline(c), 4), 0.9, 0.86);
}

function graveCanvas(variant: number): HTMLCanvasElement {
  const c = mkCanvas(12, 16);
  const x = ctxOf(c);
  const base = 0x8a8a90;
  if (variant % 2 === 0) {
    rect(x, 3, 4, 6, 9, base);
    rect(x, 4, 3, 4, 1, base);
    rect(x, 5, 6, 2, 1, 0x4a4a52);
    rect(x, 5, 8, 2, 1, 0x4a4a52);
  } else {
    rect(x, 5, 1, 2, 12, base);
    rect(x, 2, 4, 8, 2, base);
  }
  rect(x, 2, 12, 8, 2, 0x3a4a30);
  return grounded(upscale(outline(c), 4), 0.8, 0.9);
}

function pillarCanvas(): HTMLCanvasElement {
  const c = mkCanvas(12, 22);
  const x = ctxOf(c);
  rect(x, 2, 18, 8, 3, 0x3a3640);
  rect(x, 3, 4, 6, 15, 0x4a4652);
  rect(x, 3, 4, 2, 15, 0x5a5662);
  rect(x, 2, 2, 8, 3, 0x3a3640);
  return grounded(upscale(outline(c), 4), 0.9, 0.93);
}

/* ------------------------------------------------------------- Akteure */

type Painter = (x: Ctx, f: number, col: number, r: () => number) => void;

const SKIN = 0xd8b088;

type Pose = 'idle' | 'wind' | 'strike';
let POSE: Pose = 'idle';
/** Blick nach hinten (Figur läuft im Bild nach oben): Haare statt Gesicht */
let BACK = false;

/** Waffe je nach Haltung: Ruhe senkrecht, Ausholen über dem Kopf, Schlag waagerecht nach vorn. */
function weapon(x: Ctx, blade: number, len: number, hilt = 0x6a4a2a): void {
  if (POSE === 'wind') {
    rect(x, 13, -4, 1, Math.round(len * 0.8), blade);
    rect(x, 12, Math.round(len * 0.8) - 4, 3, 1, hilt);
  } else if (POSE === 'strike') {
    rect(x, 15, 8, Math.round(len * 0.5), 1, blade);
    rect(x, 14, 7, 1, 3, hilt);
  } else {
    rect(x, 13, 4, 1, len, blade);
    rect(x, 12, 4 + len - 2, 3, 1, hilt);
  }
}

function humanoidBase(x: Ctx, f: number, o: { skin: number; body: number; legs: number; hair?: number; belt?: number; arms?: number }): void {
  const step = f % 2;
  rect(x, 5, 14 + (step ? 0 : 1), 3, 6 - (step ? 0 : 1), o.legs);
  rect(x, 8, 14 + (step ? 1 : 0), 3, 6 - (step ? 1 : 0), shade(o.legs, 0.85));
  rect(x, 4, 7, 8, 8, o.body);
  rect(x, 4, 13, 8, 1, o.belt ?? shade(o.body, 0.6));
  const arm = o.arms ?? o.body;
  rect(x, 2, 7, 2, 6, arm);
  rect(x, 12, 7, 2, 6, shade(arm, 0.9));
  rect(x, 2, 13, 2, 1, o.skin);
  rect(x, 12, 13, 2, 1, o.skin);
  if (POSE === 'wind') {
    x.clearRect(12, 7, 2, 7);
    rect(x, 12, 3, 2, 6, shade(arm, 0.9));
    rect(x, 12, 2, 2, 1, o.skin);
  } else if (POSE === 'strike') {
    x.clearRect(12, 7, 2, 7);
    rect(x, 11, 8, 4, 2, shade(arm, 0.9));
    rect(x, 15, 8, 1, 2, o.skin);
    rect(x, 4, 7, 8, 8, shade(o.body, 1.08));
  }
  rect(x, 5, 2, 6, 5, BACK ? (o.hair ?? shade(o.skin, 0.55)) : o.skin);
  if (!BACK) {
    rect(x, 6, 4, 1, 1, 0x1a1418);
    rect(x, 9, 4, 1, 1, 0x1a1418);
  }
  if (o.hair !== undefined) rect(x, 5, 1, 6, 2, o.hair);
}

const FAMILY: Record<MonsterFamily, Painter> = {
  humanoid: (x, f, col) => {
    humanoidBase(x, f, { skin: SKIN, body: col, legs: shade(col, 0.55), hair: shade(col, 0.5) });
    weapon(x, 0xb8b8c0, 9);
  },
  undead: (x, f, col) => {
    humanoidBase(x, f, { skin: 0xe8e0c8, body: shade(col, 0.55), legs: 0x3a3438, arms: 0xe8e0c8 });
    rect(x, 6, 4, 2, 2, 0x120e12);
    rect(x, 9, 4, 2, 2, 0x120e12);
    rect(x, 5, 9, 6, 1, 0xe8e0c8);
    rect(x, 5, 11, 6, 1, 0xe8e0c8);
    weapon(x, col, 10, col);
  },
  ghoul: (x, f, col) => {
    humanoidBase(x, f, { skin: shade(col, 1.1), body: shade(col, 0.6), legs: shade(col, 0.45), arms: shade(col, 1.0) });
    rect(x, 1, 8, 2, 7, shade(col, 1.0));
    rect(x, 13, 8, 2, 7, shade(col, 1.0));
    rect(x, 6, 4, 1, 1, 0xe8e060);
    rect(x, 9, 4, 1, 1, 0xe8e060);
  },
  beast: (x, f, col) => {
    const l = f % 2;
    x.translate(0, 4);
    if (POSE === 'wind') x.translate(-2, 1);
    if (POSE === 'strike') x.translate(2, 0);
    rect(x, 3, 8, 10, 5, col);
    rect(x, 3, 8, 10, 1, shade(col, 1.2));
    rect(x, 11, 5, 4, 5, shade(col, 1.05));
    rect(x, 11, 4, 1, 2, shade(col, 0.7));
    rect(x, 14, 4, 1, 2, shade(col, 0.7));
    rect(x, 14, 7, 1, 1, 0x140808);
    rect(x, 13, 7, 1, 1, 0xd03030);
    if (POSE === 'strike') {
      rect(x, 12, 9, 4, 1, 0x1a0a0a);
      rect(x, 13, 10, 1, 1, 0xe8e0d0);
      rect(x, 15, 9, 1, 1, 0xe8e0d0);
      rect(x, 2, 12, 3, 1, 0xe8e0d0);
    }
    rect(x, 1, 7, 3, 2, shade(col, 0.8));
    rect(x, 4, 13, 2, 4 - (l ? 1 : 0), shade(col, 0.7));
    rect(x, 7, 13, 2, 3 + (l ? 1 : 0), shade(col, 0.7));
    rect(x, 10, 13, 2, 4 - (l ? 0 : 1), shade(col, 0.7));
  },
  spider: (x, f, col) => {
    const l = f % 2;
    x.translate(0, 5);
    if (POSE === 'wind') x.translate(0, 1);
    if (POSE === 'strike') x.translate(1, -1);
    rect(x, 6, 7, 6, 6, col);
    rect(x, 7, 8, 3, 2, shade(col, 1.4));
    rect(x, 3, 8, 4, 4, shade(col, 0.9));
    rect(x, 3, 9, 1, 1, 0xd03030);
    rect(x, 5, 9, 1, 1, 0xd03030);
    for (let i = 0; i < 4; i++) {
      const yy = 6 + i * 2 + (l && i % 2 ? 1 : 0);
      rect(x, 1, yy, 5, 1, shade(col, 0.7));
      rect(x, 12, yy, 4, 1, shade(col, 0.7));
      rect(x, 0, yy + 1, 1, 3, shade(col, 0.7));
      rect(x, 15, yy + 1, 1, 3, shade(col, 0.7));
    }
  },
  golem: (x, f, col, r) => {
    const l = f % 2;
    if (POSE === 'wind') {
      rect(x, 0, 1, 3, 9, shade(col, 0.85));
      rect(x, 14, 1, 3, 9, shade(col, 0.85));
    }
    if (POSE === 'strike') {
      rect(x, 13, 9, 7, 4, shade(col, 0.95));
      rect(x, 1, 9, 2, 5, shade(col, 0.85));
    }
    rect(x, 4, 15, 4, 6 - (l ? 1 : 0), shade(col, 0.7));
    rect(x, 9, 15, 4, 5 + (l ? 1 : 0), shade(col, 0.7));
    rect(x, 3, 6, 11, 10, col);
    rect(x, 0, 6, 3, 10, shade(col, 0.85));
    rect(x, 14, 6, 3, 10, shade(col, 0.85));
    rect(x, 5, 1, 7, 6, shade(col, 1.1));
    rect(x, 6, 3, 2, 1, 0xe8a030);
    rect(x, 9, 3, 2, 1, 0xe8a030);
    for (let i = 0; i < 14; i++) rect(x, 1 + Math.floor(r() * 14), 7 + Math.floor(r() * 8), 2, 1, shade(col, 0.7 + r() * 0.6));
  },
  demon: (x, f, col) => {
    humanoidBase(x, f, { skin: shade(col, 1.0), body: shade(col, 0.7), legs: shade(col, 0.5), arms: shade(col, 1.0) });
    rect(x, 4, 0, 1, 3, 0xe8e0c8);
    rect(x, 11, 0, 1, 3, 0xe8e0c8);
    rect(x, 6, 4, 1, 1, 0xf0e040);
    rect(x, 9, 4, 1, 1, 0xf0e040);
    rect(x, 0, 6, 3, 5, shade(col, 0.55));
    rect(x, 13, 6, 3, 5, shade(col, 0.55));
    rect(x, 7, 19, 2, 3, shade(col, 0.5));
  },
  worm: (x, f, col) => {
    if (POSE === 'wind') x.translate(-1, 1);
    if (POSE === 'strike') x.translate(2, 0);
    for (let i = 0; i < 6; i++) {
      const yy = 20 - i * 3;
      const off = Math.round(Math.sin(i * 1.1 + f * 1.4) * 2);
      rect(x, 5 + off, yy - 2, 6, 4, i % 2 ? shade(col, 0.85) : col);
    }
    rect(x, 4, 1, 8, 5, shade(col, 1.15));
    rect(x, 6, 4, 4, 2, 0x4a1010);
    rect(x, 5, 2, 1, 1, 0xf0e040);
    rect(x, 10, 2, 1, 1, 0xf0e040);
  },
  elemental: (x, f, col) => {
    x.translate(0, 2);
    if (POSE === 'strike') x.translate(2, 0);
    const w = f % 2;
    rect(x, 5, 12, 6, 7, shade(col, 0.8));
    rect(x, 4, 8, 8, 8, col);
    rect(x, 5 + w, 4, 6 - w * 2, 6, shade(col, 1.3));
    rect(x, 7, 1 + w, 2, 5, 0xf8e070);
    rect(x, 6, 8, 4, 5, 0xf8c040);
    rect(x, 6, 9, 1, 1, 0x301008);
    rect(x, 9, 9, 1, 1, 0x301008);
  },
};

const actorCache = new Map<string, HTMLCanvasElement>();
const FW = 20;
const FH = 28;
/** Rand um die Figur: Platz für erhobene Waffen und Sprünge nach vorn */
const PAD_X = 2;
const PAD_Y = 3;
/** Fußposition relativ zur Bildhöhe (für setOrigin) */
export const FEET_ORIGIN_Y = (PAD_Y + 22) / FH;

function actorCanvas(key: string, build: (x: Ctx) => void, scale: number): HTMLCanvasElement {
  const hit = actorCache.get(key);
  if (hit) return hit;
  const c = mkCanvas(FW, FH);
  const x = ctxOf(c);
  x.save();
  x.translate(PAD_X, PAD_Y);
  build(x);
  x.restore();
  const out = upscale(outline(c), scale);
  actorCache.set(key, out);
  return out;
}

/** Familien mit zwei Beinen: nur sie bekommen die Seitenansicht (Tiere sind im Sprite schon seitlich). */
export const BIPED = new Set<MonsterFamily>(['humanoid', 'undead', 'ghoul', 'demon']);

function spriteMonster(id: string, boss: boolean, frame: number, profile: boolean): HTMLCanvasElement | null {
  const def = MONSTER_SPRITES[id];
  const img = def ? sprite(def.file) : null;
  if (!def || !img) return null;
  const scale = boss ? Math.max(SPRITE_SCALE.boss, def.scale ?? 0) : def.scale ?? SPRITE_SCALE.normal;
  return spriteCanvas(`smon_${id}_${frame}${boss ? 'B' : ''}${profile ? 's' : ''}`, (x) => {
    pose(x, frame, boss ? 0.5 : scale > SPRITE_SCALE.normal ? 0.7 : 1, profile);
    if (profile) drawProfile(x, img, def.tint, frame);
    else drawSprite(x, img, def.tint);
  }, scale, FEET_ORIGIN_Y, boss ? '#c8801c' : undefined);
}

export function monsterCanvas(id: string, family: MonsterFamily, color: number, boss: boolean, frame: number, back = false, profile = false): HTMLCanvasElement {
  const sp = spriteMonster(id, boss, frame, profile && BIPED.has(family));
  if (sp) return sp;
  const fb = frame === FRAME_STEP_R ? FRAME_STEP_L : frame; // prozedurale Figur kennt nur einen Schrittwechsel
  return actorCanvas(`mon_${id}_${fb}${back ? 'b' : ''}`, (x) => {
    BACK = back && ['humanoid', 'undead', 'ghoul', 'demon'].includes(family);
    POSE = fb === 2 ? 'wind' : fb === 3 ? 'strike' : 'idle';
    const r = rng(id.length * 91 + id.charCodeAt(0));
    FAMILY[family](x, fb, color, r);
    if (boss) {
      rect(x, 4, 0, 8, 1, 0xe8c040);
      rect(x, 4, 0, 1, 2, 0xe8c040);
      rect(x, 11, 0, 1, 2, 0xe8c040);
      rect(x, 7, 0, 2, 2, 0xe8c040);
    }
  }, boss ? 5 : 3);
}

const TIER_COL = [0x7a5a3a, 0x8a8d96, 0x6a86a8, 0xd8d0b0, 0x5a3a6a, 0xd86a2a];
function tierOf(minLevel: number): number {
  return minLevel >= 26 ? 5 : minLevel >= 21 ? 4 : minLevel >= 16 ? 3 : minLevel >= 11 ? 2 : minLevel >= 6 ? 1 : 0;
}

export interface Look {
  chest: number;
  head: number;
  weapon: number;
  hands: number;
  /** 0 Schwert/Axt/Hammer, 1 Bogen, 2 Stab */
  weaponKind: number;
  /** Robe statt Rüstung: langer Rock */
  robe: boolean;
  quiver: boolean;
  /** Schild in der Nebenhand: Stufe (-1 = keins) */
  shield: number;
  /** Vorlagen-IDs der sichtbaren Ausrüstung (für die Sprite-Ebenen), leer = nichts angelegt */
  ids: { chest: string; legs: string; feet: string; hands: string; head: string; cloak: string; weapon: string; offhand: string };
}

export function lookOf(a: Actor): Look {
  const t = (slot: 'chest' | 'head' | 'weapon' | 'hands') => {
    const it = a.equipment[slot];
    return it ? tierOf(templateById(it.templateId).minLevel) : -1;
  };
  const kind = a.equipment.weapon ? templateById(a.equipment.weapon.templateId).kind : undefined;
  return {
    chest: t('chest'), head: t('head'), weapon: t('weapon'), hands: t('hands'),
    weaponKind: kind === 'bow' ? 1 : kind === 'staff' ? 2 : 0,
    robe: !!a.equipment.chest && a.equipment.chest.templateId.includes('robe'),
    quiver: a.equipment.offhand?.off === 'arrows',
    shield: a.equipment.offhand?.off === 'shield' ? tierOf(templateById(a.equipment.offhand.templateId).minLevel) : -1,
    ids: {
      chest: a.equipment.chest?.templateId ?? '', legs: a.equipment.legs?.templateId ?? '', feet: a.equipment.feet?.templateId ?? '',
      hands: a.equipment.hands?.templateId ?? '', head: a.equipment.head?.templateId ?? '', cloak: a.equipment.cloak?.templateId ?? '',
      weapon: a.equipment.weapon?.templateId ?? '', offhand: a.equipment.offhand?.off === 'shield' ? a.equipment.offhand.templateId : '',
    },
  };
}

/** Cache-/Texturschlüssel einer Spielerfigur (Aussehen + Bewegungsphase + Blickrichtung). */
export function lookKey(look: Look, frame: number, back: boolean, profile = false): string {
  const i = look.ids;
  return `pl_${look.chest}_${look.head}_${look.weapon}_${look.hands}_${look.weaponKind}_${look.robe ? 1 : 0}_${look.quiver ? 1 : 0}_${look.shield}_${i.chest}.${i.legs}.${i.feet}.${i.hands}.${i.head}.${i.cloak}.${i.weapon}.${i.offhand}_${frame}${back ? 'b' : ''}${profile ? 's' : ''}`;
}

/** Spielerfigur aus DCSS-Ebenen (Körper, Beine, Stiefel, Rüstung, Umhang, Handschuhe, Kopf, Schild, Waffe). Null = Fallback. */
function spritePlayer(look: Look, frame: number, scale: number = SPRITE_SCALE.normal, back = false, profile = false): HTMLCanvasElement | null {
  const base = sprite(PLAYER_BASE);
  if (!base) return null;
  const i = look.ids;
  const layer = (id: string, dflt?: string): HTMLImageElement | null => {
    const path = (id && PLAYER_LAYERS[id]) || dflt;
    return path ? sprite(path) : null;
  };
  const legs = layer(i.legs, PLAYER_DEFAULTS.legs);
  const boots = layer(i.feet, PLAYER_DEFAULTS.boots);
  const body = layer(i.chest, PLAYER_DEFAULTS.body);
  const cloak = layer(i.cloak);
  const gloves = layer(i.hands);
  const head = layer(i.head);
  const hair = i.head && look.head >= 1 ? null : sprite(PLAYER_HAIR);
  const shield = layer(i.offhand);
  const wpn = layer(i.weapon);
  const kind: AttackKind = look.weaponKind === 1 ? 'bow' : look.weaponKind === 2 ? 'staff' : 'melee';
  return spriteCanvas(`${lookKey(look, frame, back, profile)}_x${scale}`, (x) => {
    const walking = frame === FRAME_STEP_L || frame === FRAME_STEP_R;
    const attacking = frame === FRAME_WIND || frame === FRAME_STRIKE;
    const side = frame === FRAME_STEP_L ? -1 : 1;
    applyBodyPose(x, bodyPose(frame, kind, 1, profile));
    // Seitenansicht: Körper schmaler, Beine schwingen entlang der Laufrichtung (Vorderansicht → Profil)
    if (profile) {
      x.translate(SP / 2, 0);
      x.scale(0.88, 1);
      x.translate(-SP / 2, 0);
    }
    const HIP = 20;
    // Beine/Stiefel: linkes und rechtes Bein getrennt versetzt (Schrittzyklus bzw. breiter Stand beim Schlag)
    const legOff = (left: boolean): [number, number] => {
      if (profile) {
        if (walking) {
          const dx = (left ? 1 : -1) * side * 3;
          return [dx, dx < 0 ? -1 : 0];
        }
        if (frame === FRAME_STRIKE && kind === 'melee') return left ? [3, 0] : [-3, 0];
        if (frame === FRAME_WIND && kind === 'melee') return left ? [-1, 0] : [1, 0];
        return [0, 0];
      }
      if (walking) {
        const fwd = left === (side < 0); // vorderes (angehobenes) Bein
        return fwd ? [left ? -1 : 1, -2] : [left ? 1 : -1, 0];
      }
      if (frame === FRAME_STRIKE && kind === 'melee') return left ? [-2, 0] : [2, 0];
      if (frame === FRAME_WIND && kind === 'melee') return left ? [1, 0] : [-1, 0];
      return [0, 0];
    };
    const lowerHalf = (left: boolean, layers: (HTMLImageElement | null)[]): void => {
      const [ox, oy] = legOff(left);
      x.save();
      x.translate(ox, oy);
      x.beginPath();
      x.rect(left ? 0 : SP / 2, HIP, SP / 2, SP - HIP);
      x.clip();
      for (const l of layers) if (l) x.drawImage(l, 0, 0);
      x.restore();
    };
    // Saum von Umhang und Robe: unterhalb der Hüfte im Schritt leicht gegenläufig zum Schwung der Beine verschoben
    // (Frame 0 bleibt unverändert: Versatz 0, Teilung an der Hüfte ist nahtlos)
    const hem = (l: HTMLImageElement | null): void => {
      if (!l) return;
      x.save();
      if (walking) x.translate(-side, -1);
      x.beginPath();
      x.rect(0, HIP, SP, SP - HIP);
      x.clip();
      x.drawImage(l, 0, 0);
      x.restore();
    };
    // Umhang hinter dem Körper, damit die Rüstung sichtbar bleibt
    if (cloak) {
      x.save();
      x.beginPath();
      x.rect(0, 0, SP, HIP);
      x.clip();
      x.drawImage(cloak, 0, 0);
      x.restore();
      hem(cloak);
    }
    lowerHalf(true, [base, legs, boots]);
    lowerHalf(false, [base, legs, boots]);
    hem(body);
    // Oberkörper: beim Gehen leichte Gegenneigung um die Hüfte und tiefer im Schritt
    x.save();
    if (walking && !profile) {
      x.translate(SP / 2, HIP);
      x.rotate(((-side * 2.5 * Math.PI) / 180));
      x.translate(-SP / 2, -HIP + 1);
    }
    x.save();
    x.beginPath();
    x.rect(0, 0, SP, HIP + 2);
    x.clip();
    x.drawImage(base, 0, 0);
    x.restore();
    if (back) {
      // Rücken: Gesichtsfläche der Basisfigur mit Haarfarbe überdecken (nur auf vorhandenen Pixeln)
      x.save();
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = '#4a3020';
      x.fillRect(12, 3, 8, 7);
      x.fillStyle = '#5e4028';
      x.fillRect(13, 3, 5, 2);
      x.fillStyle = '#3a2418';
      x.fillRect(13, 8, 6, 1);
      x.restore();
    }
    if (body) {
      x.save();
      x.beginPath();
      x.rect(0, 0, SP, HIP);
      x.clip();
      x.drawImage(body, 0, 0);
      x.restore();
    }
    for (const l of [gloves, hair, head, shield]) if (l) x.drawImage(l, 0, 0);
    if (wpn) drawPlayerWeapon(x, wpn, look, frame, attacking, walking ? side : 0);
    x.restore();
  }, scale, FEET_ORIGIN_Y, undefined, Math.max(opaqueBottom(base), boots ? opaqueBottom(boots) : 0));
}

/** Waffe um den Griff drehen (Nahkampf), Bogen spannen/entspannen, Stab vorstoßen. */
function drawPlayerWeapon(x: Ctx, wpn: HTMLImageElement, look: Look, frame: number, attacking: boolean, walkSide: number): void {
  const g = weaponGeo(wpn);
  x.save();
  if (look.weaponKind === 0) {
    // Hand sitzt am unteren Ende der DCSS-Waffenebene (Heft), nicht an der Körpermitte
    x.translate(g.gripX, g.gripY);
    if (frame === FRAME_WIND) x.rotate(-1.2);
    else if (frame === FRAME_STRIKE) {
      x.translate(2, 0);
      x.rotate(1.2);
    } else x.rotate(walkSide * 0.12);
    x.translate(-g.gripX, -g.gripY);
    x.drawImage(wpn, 0, 0);
  } else if (look.weaponKind === 1) {
    if (attacking) {
      // Bogen nach vorn gestreckt, Bauch zum Ziel; Sehne gespannt (Ausholen) oder entspannt (Schuss)
      const mx = (g.minX + g.maxX) / 2;
      const my = (g.minY + g.maxY) / 2;
      x.translate(10, 0);
      x.translate(mx, my);
      x.rotate(frame === FRAME_WIND ? 0.04 : -0.1);
      if (g.belly < 0) x.scale(-1, 1);
      x.translate(-mx, -my);
      x.drawImage(wpn, 0, 0);
      const dir = g.belly; // Richtung zum Ziel in den Quellkoordinaten
      const bx = (g.topX + g.botX) / 2;
      const pull = frame === FRAME_WIND ? 5 : 0;
      const nx = bx - dir * pull;
      x.fillStyle = '#e8e0d0';
      const line = (x0: number, y0: number, x1: number, y1: number): void => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) x.fillRect(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), 1, 1);
      };
      line(g.topX + dir * 0, g.topY, nx, my);
      line(nx, my, g.botX + dir * 0, g.botY);
      if (frame === FRAME_WIND) {
        // Pfeil angelegt: Schaft, Spitze, Befiederung
        x.fillStyle = '#a07848';
        line(nx, my, nx + dir * 14, my);
        x.fillStyle = '#d8d8e0';
        line(nx + dir * 14, my - 1, nx + dir * 14, my + 1);
        line(nx + dir * 15, my, nx + dir * 15, my);
        x.fillStyle = '#c04a3a';
        line(nx, my - 1, nx + dir * 2, my - 1);
        line(nx, my + 1, nx + dir * 2, my + 1);
      }
    } else {
      x.drawImage(wpn, 0, 0);
    }
  } else {
    if (attacking) {
      // Stab: beim Ausholen angehoben, beim Schuss nach vorn gestoßen (waagerecht) mit leuchtender Spitze
      const px = g.gripX;
      const py = Math.min(g.maxY - 2, 18);
      x.translate(px, py);
      if (frame === FRAME_WIND) x.rotate(-0.35);
      else {
        x.translate(4, 0);
        x.rotate(1.25);
      }
      x.translate(-px, -py);
      x.drawImage(wpn, 0, 0);
      const orb = ORB_COLORS[look.weapon] ?? 0x90c0ff;
      const r = frame === FRAME_STRIKE ? 3 : 2;
      x.fillStyle = css(orb);
      x.globalAlpha = 0.55;
      x.fillRect(g.topX - r, g.topY + 1 - r, r * 2 + 1, r * 2 + 1);
      x.globalAlpha = 1;
      x.fillRect(g.topX - 1, g.topY, 3, 3);
      x.fillStyle = '#ffffff';
      x.fillRect(g.topX, g.topY + 1, 1, 1);
    } else {
      x.drawImage(wpn, 0, 0);
    }
  }
  x.restore();
}

const ORB_COLORS = [0x90c0ff, 0x80d0ff, 0xb090ff, 0x70e0e0, 0xff9a40, 0xc060ff];

/** Große Figur für das Inventarfenster: Bild und CSS-Breite (Sprite 1:1, prozedural wie bisher 104 px). */
export function playerPortrait(look: Look): { canvas: HTMLCanvasElement; width: number } {
  const sp = spritePlayer(look, 0, 4);
  if (sp) return { canvas: sp, width: sp.width };
  return { canvas: playerCanvas(look, 0), width: 104 };
}

export function playerCanvas(look: Look, frame: number, back = false, profile = false): HTMLCanvasElement {
  const sp = spritePlayer(look, frame, SPRITE_SCALE.normal, back, profile);
  if (sp) return sp;
  const fb = frame === FRAME_STEP_R ? FRAME_STEP_L : frame;
  return actorCanvas(lookKey(look, fb, back, profile), (x) => {
    BACK = back;
    POSE = fb === 2 ? 'wind' : fb === 3 ? 'strike' : 'idle';
    const body = look.chest >= 0 ? TIER_COL[look.chest]! : 0x4a68a0;
    humanoidBase(x, fb, { skin: SKIN, body, legs: look.chest >= 0 ? shade(body, 0.6) : 0x3a3a52, hair: 0x4a3020, arms: look.hands >= 0 ? TIER_COL[look.hands]! : body });
    if (look.chest >= 2) {
      rect(x, 3, 7, 2, 2, shade(body, 1.3));
      rect(x, 11, 7, 2, 2, shade(body, 1.3));
    }
    if (look.head >= 0) {
      const hc = TIER_COL[look.head]!;
      rect(x, 4, 1, 8, 3, hc);
      rect(x, 4, 4, 1, 2, hc);
      rect(x, 11, 4, 1, 2, hc);
      if (look.head >= 3) rect(x, 7, 0, 2, 2, shade(hc, 1.3));
    }
    if (look.quiver) {
      rect(x, 1, 6, 3, 9, 0x6a4a28);
      rect(x, 1, 5, 1, 2, 0xe8e0d0);
      rect(x, 2, 4, 1, 3, 0xd8c890);
    }
    if (look.shield >= 0) {
      // Schild vor dem linken Arm
      const sc = TIER_COL[look.shield]!;
      rect(x, 0, 8, 5, 7, shade(sc, 0.75));
      rect(x, 1, 9, 3, 5, sc);
      rect(x, 2, 11, 1, 1, shade(sc, 1.4));
    }
    if (look.robe) {
      // langer Rock bis zu den Füßen
      rect(x, 4, 14, 8, 6, shade(body, 0.95));
      rect(x, 3, 18, 10, 2, shade(body, 0.7));
      rect(x, 7, 14, 2, 6, shade(body, 1.25));
    }
    if (look.weapon >= 0 && look.weaponKind === 1) {
      // Bogen in der Hand: Bogenbogen mit Sehne, im Schuss angelegt
      const wc = shade(TIER_COL[look.weapon]!, 1.15);
      const bx = POSE === 'strike' ? 15 : 13;
      for (let i = 0; i < 12; i++) rect(x, bx + Math.round(Math.sin((i / 11) * Math.PI) * 2), 3 + i, 1, 1, wc);
      rect(x, bx, 3, 1, 1, 0xe8e0d0);
      rect(x, bx, 14, 1, 1, 0xe8e0d0);
      rect(x, POSE === 'wind' ? bx - 3 : bx, 4, 1, 10, 0xe8e0d0);
      if (POSE === 'strike') rect(x, 9, 8, 6, 1, 0xd8c890);
    } else if (look.weapon >= 0 && look.weaponKind === 2) {
      // Stab mit leuchtender Spitze
      const orb = [0x90c0ff, 0x80d0ff, 0xb090ff, 0x70e0e0, 0xff9a40, 0xc060ff][look.weapon]!;
      if (POSE === 'strike') {
        rect(x, 12, 8, 7, 1, 0x6a4a2a);
        rect(x, 18, 6, 3, 4, orb);
        rect(x, 19, 7, 1, 1, 0xffffff);
      } else {
        const top = POSE === 'wind' ? -4 : 0;
        rect(x, 13, top + 4, 1, 14, 0x6a4a2a);
        rect(x, 12, top + 1, 3, 4, orb);
        rect(x, 13, top + 2, 1, 1, 0xffffff);
      }
    } else if (look.weapon >= 0) {
      const wc = TIER_COL[look.weapon]!;
      weapon(x, shade(wc, 1.25), 10 + (look.weapon >= 3 ? 2 : 0));
    } else if (POSE === 'idle') {
      rect(x, 13, 9, 1, 4, 0x8a6a40);
    }
  }, 3);
}

/** Texturschlüssel eines NPCs: benannte NPCs mit eigenem Sprite bekommen eine eigene Textur. */
export function npcTextureKey(kind: string, name?: string): string {
  const f = name ? NPC_NAME_SPRITES[name] : undefined;
  return name && f && sprite(f) ? `npc_n_${name}` : `npc_${kind}`;
}

export function npcCanvas(kind: string, name?: string, frame = 0, profile = false): HTMLCanvasElement {
  const file = npcSpriteFile(kind, name);
  const img = file ? sprite(file) : null;
  if (img) {
    if (profile && kind !== 'stash') {
      return spriteCanvas(`snpc_${kind}_${name ?? ''}_${frame}s`, (x) => {
        pose(x, frame, 1, true);
        drawProfile(x, img, undefined, frame);
      }, SPRITE_SCALE.normal, FEET_ORIGIN_Y);
    }
    return spriteCanvas(`snpc_${kind}_${name ?? ''}`, (x) => drawSprite(x, img), SPRITE_SCALE.normal, FEET_ORIGIN_Y);
  }
  return actorCanvas(`npc_${kind}`, (x) => {
    BACK = false;
    POSE = 'idle';
    if (kind === 'stash') {
      rect(x, 2, 12, 12, 9, 0x7a5a30);
      rect(x, 2, 12, 12, 2, 0x9a7a40);
      rect(x, 7, 15, 2, 3, 0xe8c040);
      rect(x, 2, 16, 12, 1, 0x4a3820);
      return;
    }
    const cfg = {
      trainer: { body: 0x8a5ab0, hair: 0xcfcfd8, hat: 0x6a3a90 },
      merchant: { body: 0x3a9a60, hair: 0x6a4a2a, hat: 0x2a7a48 },
      quest: { body: 0xb09a30, hair: 0x4a3020, hat: 0x8a7a20 },
      smith: { body: 0x8a4a3a, hair: 0x2a1a10, hat: 0x5a3a2a },
    }[kind as 'trainer'] ?? { body: 0x888888, hair: 0x444444, hat: 0x666666 };
    humanoidBase(x, 0, { skin: SKIN, body: cfg.body, legs: shade(cfg.body, 0.55), hair: cfg.hair, belt: 0x4a3020 });
    if (kind === 'trainer') {
      rect(x, 4, 0, 8, 2, cfg.hat);
      rect(x, 13, 2, 1, 12, 0x8a6a3a);
      rect(x, 12, 1, 3, 2, 0x60c0f0);
    } else if (kind === 'merchant') {
      rect(x, 0, 9, 3, 5, 0x8a6a3a);
      rect(x, 4, 1, 8, 2, cfg.hat);
    } else if (kind === 'smith') {
      rect(x, 4, 9, 8, 5, 0x4a3828);
      rect(x, 13, 6, 2, 6, 0x6a6a72);
      rect(x, 12, 5, 4, 2, 0x8a8a92);
    } else {
      rect(x, 4, 1, 8, 2, cfg.hat);
    }
  }, 3);
}

export function lootCanvas(rarity: 'normal' | 'magic' | 'rare' | 'set' | 'legendary'): HTMLCanvasElement {
  const key = `loot_${rarity}`;
  const hit = actorCache.get(key);
  if (hit) return hit;
  const col = { normal: 0xc9c4bd, magic: 0x6f8fff, rare: 0xf2c94c, set: 0x5fd070, legendary: 0xff8a2a }[rarity];
  const c = mkCanvas(12, 12);
  const x = ctxOf(c);
  x.fillStyle = css(col) + '44';
  x.fillRect(1, 1, 10, 10);
  rect(x, 3, 4, 6, 5, shade(col, 0.7));
  rect(x, 4, 3, 4, 2, col);
  rect(x, 5, 5, 2, 2, shade(col, 1.2));
  const out = upscale(outline(c), 3);
  actorCache.set(key, out);
  return out;
}

export function chestCanvas(tier: 'wood' | 'iron' | 'gold', open: boolean): HTMLCanvasElement {
  const def = CHEST_SPRITES[tier];
  const img = sprite(open ? def.open : def.closed);
  if (img) return spriteCanvas(`schest_${tier}_${open ? 1 : 0}`, (x) => drawSprite(x, img, def.tint), SPRITE_SCALE.chest, 0.9);
  const body = { wood: 0x7a5230, iron: 0x5a6070, gold: 0x8a6a28 }[tier];
  const trim = { wood: 0x4a3018, iron: 0x9aa4b4, gold: 0xf0cc50 }[tier];
  const c = mkCanvas(16, 14);
  const x = ctxOf(c);
  rect(x, 2, 7, 12, 6, body);
  rect(x, 2, 7, 12, 1, shade(body, 1.3));
  rect(x, 2, 11, 12, 2, shade(body, 0.75));
  rect(x, 2, 7, 1, 6, trim);
  rect(x, 13, 7, 1, 6, trim);
  rect(x, 7, 8, 2, 3, trim);
  if (open) {
    rect(x, 3, 7, 10, 2, 0xffe890);
    rect(x, 4, 6, 8, 1, 0xfff4c0);
    rect(x, 2, 2, 12, 4, shade(body, 0.9));
    rect(x, 2, 2, 12, 1, trim);
    rect(x, 2, 2, 1, 4, trim);
    rect(x, 13, 2, 1, 4, trim);
  } else {
    rect(x, 2, 3, 12, 4, shade(body, 1.1));
    rect(x, 3, 2, 10, 1, shade(body, 1.1));
    rect(x, 2, 3, 12, 1, shade(body, 1.35));
    rect(x, 2, 3, 1, 4, trim);
    rect(x, 13, 3, 1, 4, trim);
    rect(x, 7, 6, 2, 2, trim);
    rect(x, 8, 7, 1, 1, 0x000000);
  }
  return grounded(upscale(outline(c), 4), 0.85, 0.9);
}

/* ------------------------------------------------------------ Registrierung */

export const WALL_VARIANTS = 3;
export const TILE_VARIANTS = 4;

/** Registriert alle statischen Texturen (Props) in Phaser. Kacheln werden zu Chunks zusammengesetzt. */
export function registerStaticArt(scene: Phaser.Scene): void {
  const add = (key: string, c: HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
  };
  for (const style of ['brick', 'dungeon', 'cliff'] as const) for (let v = 0; v < WALL_VARIANTS; v++) add(`wall_${style}_${v}`, wallCanvas(style, v));
  for (const style of ['oak', 'pine', 'dead', 'char'] as const) for (let v = 0; v < 3; v++) add(`tree_${style}_${v}`, treeCanvas(style, v));
  for (const style of ['grey', 'dark'] as const) for (let v = 0; v < 3; v++) add(`rock_${style}_${v}`, rockCanvas(style, v));
  for (let v = 0; v < 2; v++) add(`grave_${v}`, graveCanvas(v));
  add('pillar', pillarCanvas());
  for (const r of ['normal', 'magic', 'rare', 'set', 'legendary'] as const) add(`loot_${r}`, lootCanvas(r));
  for (const k of ['trainer', 'merchant', 'stash', 'quest', 'smith']) add(`npc_${k}`, npcCanvas(k));
  for (const [name, f] of Object.entries(NPC_NAME_SPRITES)) if (sprite(f)) add(`npc_n_${name}`, npcCanvas('quest', name));
  for (const t of ['wood', 'iron', 'gold'] as const) for (const o of [false, true]) add(`chest_${t}_${o ? 1 : 0}`, chestCanvas(t, o));
}

export function ensureTexture(scene: Phaser.Scene, key: string, make: () => HTMLCanvasElement): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  return key;
}

export { WALL_H, mkCanvas, ctxOf, rng, rect, css, shade, mix, outline, upscale, grounded, diamondPath };
