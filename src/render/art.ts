import type Phaser from 'phaser';
import type { MonsterFamily } from '../sim/data';
import type { Actor } from '../sim/world';
import { templateById } from '../sim/items';

/**
 * Prozedurale Pixel-Art: alles wird beim Start im Code gezeichnet (keine Fremd-Assets, keine Lizenzen).
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
  rect(x, 5, 2, 6, 5, o.skin);
  rect(x, 6, 4, 1, 1, 0x1a1418);
  rect(x, 9, 4, 1, 1, 0x1a1418);
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

export function monsterCanvas(id: string, family: MonsterFamily, color: number, boss: boolean, frame: number): HTMLCanvasElement {
  return actorCanvas(`mon_${id}_${frame}`, (x) => {
    POSE = frame === 2 ? 'wind' : frame === 3 ? 'strike' : 'idle';
    const r = rng(id.length * 91 + id.charCodeAt(0));
    FAMILY[family](x, frame, color, r);
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
}

export function lookOf(a: Actor): Look {
  const t = (slot: 'chest' | 'head' | 'weapon' | 'hands') => {
    const it = a.equipment[slot];
    return it ? tierOf(templateById(it.templateId).minLevel) : -1;
  };
  return { chest: t('chest'), head: t('head'), weapon: t('weapon'), hands: t('hands') };
}

export function playerCanvas(look: Look, frame: number): HTMLCanvasElement {
  const key = `pl_${look.chest}_${look.head}_${look.weapon}_${look.hands}_${frame}`;
  return actorCanvas(key, (x) => {
    POSE = frame === 2 ? 'wind' : frame === 3 ? 'strike' : 'idle';
    const body = look.chest >= 0 ? TIER_COL[look.chest]! : 0x4a68a0;
    humanoidBase(x, frame, { skin: SKIN, body, legs: look.chest >= 0 ? shade(body, 0.6) : 0x3a3a52, hair: 0x4a3020, arms: look.hands >= 0 ? TIER_COL[look.hands]! : body });
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
    if (look.weapon >= 0) {
      const wc = TIER_COL[look.weapon]!;
      weapon(x, shade(wc, 1.25), 10 + (look.weapon >= 3 ? 2 : 0));
    } else if (POSE === 'idle') {
      rect(x, 13, 9, 1, 4, 0x8a6a40);
    }
  }, 3);
}

export function npcCanvas(kind: string): HTMLCanvasElement {
  return actorCanvas(`npc_${kind}`, (x) => {
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
}

export function ensureTexture(scene: Phaser.Scene, key: string, make: () => HTMLCanvasElement): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  return key;
}

export { WALL_H };
