/**
 * Skelett-Held im Browser: ein gebackenes Sheet je Look (`hero.ts`) als Phaser-Textur mit benannten Bildern, 2x skaliert.
 * Gebacken wird zur Laufzeit beim ersten Gebrauch eines Looks (ca. 20-60 ms), danach aus dem Textur-Cache.
 * Schalter `?held=skelett|dcss` (Standard skelett), bewusst nicht gespeichert.
 */
import type Phaser from 'phaser';
import type { Look } from './art';
import { bakeHero, HERO_FRAME, heroKey, heroLookOf, type HeroSheet } from './hero';

export const HERO_SCALE = 2;

export type HeroMode = 'skelett' | 'dcss';
let mode: HeroMode | undefined;
export function heroMode(): HeroMode {
  if (mode) return mode;
  let m: string | null;
  try {
    m = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('held') : null;
  } catch {
    m = null;
  }
  mode = m === 'dcss' ? 'dcss' : 'skelett';
  return mode;
}

type FigCanvas = HTMLCanvasElement & { figTop?: number; figW?: number; figDir?: boolean };
const sheets = new Map<string, { sheet: HeroSheet; canvas: FigCanvas }>();

function sheetOf(look: Look): { key: string; sheet: HeroSheet; canvas: FigCanvas } {
  const key = heroKey(heroLookOf(look));
  let hit = sheets.get(key);
  if (!hit) {
    const sheet = bakeHero(heroLookOf(look));
    const one = document.createElement('canvas');
    one.width = sheet.w;
    one.height = sheet.h;
    one.getContext('2d')!.putImageData(new ImageData(sheet.data as Uint8ClampedArray<ArrayBuffer>, sheet.w, sheet.h), 0, 0);
    const canvas: FigCanvas = document.createElement('canvas');
    canvas.width = sheet.w * HERO_SCALE;
    canvas.height = sheet.h * HERO_SCALE;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(one, 0, 0, canvas.width, canvas.height);
    // für Schatten, Namenshöhe und Spiegeln in GameScene (wie die Ninja-Figuren): Figur blickt von Haus aus nach rechts
    canvas.figTop = sheet.top * HERO_SCALE;
    canvas.figW = sheet.bodyW * HERO_SCALE;
    canvas.figDir = true;
    hit = { sheet, canvas };
    sheets.set(key, hit);
  }
  return { key, ...hit };
}

/** So viele Looks bleiben gebacken (je ca. 3 MB als 2x-Canvas); ältere werden samt Textur verworfen */
const KEEP = 6;

/** Texturschlüssel des Helden-Sheets für diesen Look; legt die Textur samt Bildern beim ersten Mal an. */
export function heroTexture(scene: Phaser.Scene, look: Look): string {
  const { key, sheet, canvas } = sheetOf(look);
  // zuletzt benutzt ans Ende (Map hält die Einfügereihenfolge), Älteste verwerfen
  const hit = sheets.get(key)!;
  sheets.delete(key);
  sheets.set(key, hit);
  for (const old of sheets.keys()) {
    if (sheets.size <= KEEP) break;
    sheets.delete(old);
    if (scene.textures.exists(old)) scene.textures.remove(old);
  }
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, canvas)!;
    for (const [name, f] of Object.entries(sheet.frames)) {
      tex.add(name, 0, f.x * HERO_SCALE, f.y * HERO_SCALE, HERO_FRAME.w * HERO_SCALE, HERO_FRAME.h * HERO_SCALE);
    }
  }
  return key;
}

/** Ursprung (Fußpunkt) eines Bildes für `setOrigin` */
export const HERO_ORIGIN = { x: HERO_FRAME.fx / HERO_FRAME.w, y: HERO_FRAME.fy / HERO_FRAME.h };

/** Stehbild zur Kamera, eng zugeschnitten, ganzzahlig skaliert (Porträt und Inventarfigur). */
export function heroPortraitCanvas(look: Look, scale: number): HTMLCanvasElement {
  const { sheet, canvas } = sheetOf(look);
  const f = sheet.frames.idle_front_0!;
  let x0 = HERO_FRAME.w;
  let y0 = HERO_FRAME.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < HERO_FRAME.h; y++) for (let x = 0; x < HERO_FRAME.w; x++) {
    if (!sheet.data[((f.y + y) * sheet.w + f.x + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const k = HERO_SCALE;
  g.drawImage(canvas, (f.x + x0) * k, (f.y + y0) * k, w * k, h * k, 0, 0, out.width, out.height);
  return out;
}
