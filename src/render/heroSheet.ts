/**
 * Skelett-Figuren im Browser: ein gebackenes Sheet (`figure.ts`) als Phaser-Textur bei 1x mit benannten Bildern; das Spiel
 * zeigt sie mit `FIG_SCALE` (2x, `pixelArt` = nächster Nachbar, also derselbe Pixelmaßstab wie vorskaliert, aber 1/4 Speicher).
 * Held: gebacken zur Laufzeit beim ersten Gebrauch eines Looks (ca. 20-60 ms), danach aus dem Cache.
 * Schalter `?held=skelett|dcss` (Standard skelett), bewusst nicht gespeichert.
 */
import type Phaser from 'phaser';
import type { Look } from './art';
import type { FigureSheet } from './figure';
import { bakeHero, heroKey, heroLookOf } from './hero';

/** Pixelmaßstab aller Skelett-Figuren in der Welt */
export const FIG_SCALE = 2;

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

/** Zusatzangaben am Quellbild einer Figur (GameScene liest sie für Schatten, Namen, Klickfläche, Spiegeln), in Bildschirm-Pixeln */
export type FigCanvas = HTMLCanvasElement & { figTop?: number; figW?: number; figDir?: boolean; figScale?: number; figSheet?: FigureSheet };

/** Sheet als 1x-Canvas mit Figurenangaben */
export function sheetCanvas(sheet: FigureSheet): FigCanvas {
  const canvas: FigCanvas = document.createElement('canvas');
  canvas.width = sheet.w;
  canvas.height = sheet.h;
  canvas.getContext('2d')!.putImageData(new ImageData(sheet.data as Uint8ClampedArray<ArrayBuffer>, sheet.w, sheet.h), 0, 0);
  // Figur blickt von Haus aus nach rechts
  canvas.figTop = sheet.top * FIG_SCALE;
  canvas.figW = sheet.bodyW * FIG_SCALE;
  canvas.figDir = true;
  canvas.figScale = FIG_SCALE;
  canvas.figSheet = sheet;
  return canvas;
}

/** Textur mit allen Bildern des Sheets anlegen (falls nicht vorhanden) */
export function addSheetTexture(scene: Phaser.Scene, key: string, canvas: FigCanvas): void {
  if (scene.textures.exists(key)) return;
  const sheet = canvas.figSheet!;
  const tex = scene.textures.addCanvas(key, canvas)!;
  for (const [name, f] of Object.entries(sheet.frames)) tex.add(name, 0, f.x, f.y, sheet.frame.w, sheet.frame.h);
}

/** Ursprung (Fußpunkt) eines Bildes für `setOrigin` */
export const originOf = (sheet: FigureSheet): { x: number; y: number } => ({ x: sheet.frame.fx / sheet.frame.w, y: sheet.frame.fy / sheet.frame.h });

const sheets = new Map<string, FigCanvas>();

function sheetOf(look: Look): { key: string; canvas: FigCanvas } {
  const h = heroLookOf(look);
  const key = heroKey(h);
  let canvas = sheets.get(key);
  if (!canvas) {
    canvas = sheetCanvas(bakeHero(h));
    sheets.set(key, canvas);
  }
  return { key, canvas };
}

/** So viele Looks bleiben gebacken (je ca. 1,2 MB als 1x-Canvas); ältere werden samt Textur verworfen */
const KEEP = 8;

/** Texturschlüssel des Helden-Sheets für diesen Look; legt die Textur samt Bildern beim ersten Mal an. */
export function heroTexture(scene: Phaser.Scene, look: Look, inUse?: () => Set<string>): { key: string; sheet: FigureSheet } {
  const { key, canvas } = sheetOf(look);
  // zuletzt benutzt ans Ende (Map hält die Einfügereihenfolge), Älteste verwerfen, außer sie sind gerade zu sehen
  sheets.delete(key);
  sheets.set(key, canvas);
  if (sheets.size > KEEP) {
    const busy = inUse?.() ?? new Set<string>();
    for (const old of [...sheets.keys()]) {
      if (sheets.size <= KEEP) break;
      if (old === key || busy.has(old)) continue;
      sheets.delete(old);
      if (scene.textures.exists(old)) scene.textures.remove(old);
    }
  }
  addSheetTexture(scene, key, canvas);
  return { key, sheet: canvas.figSheet! };
}

/** Stehbild zur Kamera, eng zugeschnitten, ganzzahlig skaliert (Porträt und Inventarfigur). */
export function sheetPortrait(canvas: FigCanvas, scale: number): HTMLCanvasElement {
  const sheet = canvas.figSheet!;
  const F = sheet.frame;
  const f = sheet.frames.idle_front_0!;
  let x0 = F.w;
  let y0 = F.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
    if (!sheet.data[((f.y + y) * sheet.w + f.x + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const w = Math.max(1, x1 - x0 + 1);
  const h = Math.max(1, y1 - y0 + 1);
  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(canvas, f.x + x0, f.y + y0, w, h, 0, 0, out.width, out.height);
  return out;
}

export function heroPortraitCanvas(look: Look, scale: number): HTMLCanvasElement {
  return sheetPortrait(sheetOf(look).canvas, scale);
}
