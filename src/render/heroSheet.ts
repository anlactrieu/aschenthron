/**
 * Skelett-Figuren im Browser: ein gebackenes Sheet (`figure.ts`) als Phaser-Textur bei 1x mit benannten Bildern; das Spiel
 * zeigt sie mit `FIG_SCALE` (2x, `pixelArt` = nächster Nachbar, also derselbe Pixelmaßstab wie vorskaliert, aber 1/4 Speicher).
 * Held: gebacken im Worker beim ersten Gebrauch eines Looks (bis dahin unsichtbar bzw. der vorige Look), danach aus dem Cache.
 * Schalter `?held=skelett|dcss` (Standard skelett), bewusst nicht gespeichert.
 */
import type Phaser from 'phaser';
import type { Look } from './art';
import { bakeFigure, type FigureSheet } from './figure';
import { bakeHero, heroKey, heroLookOf, heroSpec } from './hero';
import { bakeInWorker, uploadSheet } from './monsterSheet';
import { cancelUpload, uploading } from './sheetUpload';

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
type FigInfo = { figTop?: number; figW?: number; figDir?: boolean; figScale?: number; figSheet?: FigureSheet };
/**
 * Quelle eines Sheets: die rohen RGBA-Pixel (WebGL lädt sie direkt hoch, halb so teuer wie ein Canvas und ohne `putImageData`)
 * oder ein Canvas (Porträt, Canvas-Renderer)
 */
export type FigSource = (Uint8Array | HTMLCanvasElement) & FigInfo;

function withInfo<T extends FigSource>(src: T, sheet: FigureSheet): T {
  // Figur blickt von Haus aus nach rechts
  src.figTop = sheet.top * FIG_SCALE;
  src.figW = sheet.bodyW * FIG_SCALE;
  src.figDir = true;
  src.figScale = FIG_SCALE;
  src.figSheet = sheet;
  return src;
}

/** Sheet als 1x-Canvas mit Figurenangaben */
export function sheetCanvas(sheet: FigureSheet): HTMLCanvasElement & FigInfo {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.w;
  canvas.height = sheet.h;
  canvas.getContext('2d')!.putImageData(new ImageData(sheet.data as Uint8ClampedArray<ArrayBuffer>, sheet.w, sheet.h), 0, 0);
  return withInfo(canvas, sheet);
}

/** Sheet als Pixelquelle mit Figurenangaben (teilt den Speicher mit `sheet.data`) */
export const pixelSource = (sheet: FigureSheet): FigSource => withInfo(new Uint8Array(sheet.data.buffer, sheet.data.byteOffset, sheet.data.byteLength), sheet);

/** Textur mit allen Bildern des Sheets anlegen (falls nicht vorhanden) */
export function addSheetTexture(scene: Phaser.Scene, key: string, src: FigSource): void {
  if (scene.textures.exists(key)) return;
  const sheet = src.figSheet!;
  // rohe Pixel nur mit WebGL; der Canvas-Renderer braucht ein Bild (getSourceImage liefert in beiden Fällen die Figurenangaben)
  const webgl = 'gl' in scene.game.renderer;
  const tex = src instanceof HTMLCanvasElement || !webgl ? scene.textures.addCanvas(key, src instanceof HTMLCanvasElement ? src : sheetCanvas(sheet))! : scene.textures.addUint8Array(key, src, sheet.w, sheet.h)!;
  for (const [name, f] of Object.entries(sheet.frames)) tex.add(name, 0, f.x, f.y, sheet.frame.w, sheet.frame.h);
}

/** Ursprung (Fußpunkt) eines Bildes für `setOrigin` */
export const originOf = (sheet: FigureSheet): { x: number; y: number } => ({ x: sheet.frame.fx / sheet.frame.w, y: sheet.frame.fy / sheet.frame.h });

const sheets = new Map<string, FigSource>();

/** So viele Looks bleiben gebacken (je ca. 1,2 MB als 1x-Canvas); ältere werden samt Textur verworfen */
const KEEP = 8;

/** Look schon im Worker backen lassen, bevor er zu sehen ist (Spielstart); ohne Worker nichts */
export function prefetchHero(look: Look): void {
  const h = heroLookOf(look);
  const key = heroKey(h);
  if (!sheets.has(key)) bakeInWorker(key, { t: 'h', look: h }, (src) => sheets.set(key, src));
}

/**
 * Texturschlüssel des Helden-Sheets für diesen Look; legt die Textur samt Bildern beim ersten Mal an. Der Worker backt den
 * Look; bis er fertig und hochgeladen ist, bleibt das vorige Sheet stehen (`prev`, z. B. beim Ausrüstungswechsel) oder, ohne
 * Vorgänger, `null` (Figur unsichtbar). Nur ohne Worker wird sofort im Spielthread gebacken.
 */
export function heroTexture(scene: Phaser.Scene, look: Look, inUse?: () => Set<string>, prev?: string): { key: string; sheet: FigureSheet } | null {
  const h = heroLookOf(look);
  let key = heroKey(h);
  if (!sheets.has(key) && !bakeInWorker(key, { t: 'h', look: h }, (src) => sheets.set(heroKey(h), src))) sheets.set(key, pixelSource(bakeHero(h)));
  const fresh = sheets.get(key);
  if (!fresh || !uploadSheet(scene, key, fresh)) {
    // noch im Worker oder Upload erst im nächsten Frame
    if (!prev || prev === key || !sheets.has(prev) || !scene.textures.exists(prev)) return null;
    key = prev;
  }
  const src = sheets.get(key)!;
  // zuletzt benutzt ans Ende (Map hält die Einfügereihenfolge), Älteste verwerfen, außer sie sind gerade zu sehen
  sheets.delete(key);
  sheets.set(key, src);
  if (sheets.size > KEEP) {
    const busy = inUse?.() ?? new Set<string>();
    for (const old of [...sheets.keys()]) {
      if (sheets.size <= KEEP) break;
      if (old === key || busy.has(old) || uploading(old)) continue;
      sheets.delete(old);
      cancelUpload(scene, old);
      if (scene.textures.exists(old)) scene.textures.remove(old);
    }
  }
  return { key, sheet: src.figSheet! };
}

/** Stehbild zur Kamera, eng zugeschnitten, ganzzahlig skaliert (Porträt und Inventarfigur). */
export function sheetPortrait(sheet: FigureSheet, scale: number): HTMLCanvasElement {
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
  // nur den Ausschnitt aus den Pixeln holen, dann ganzzahlig vergrößern
  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const px = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    const o = ((f.y + y0 + y) * sheet.w + f.x + x0) * 4;
    px.data.set(sheet.data.subarray(o, o + w * 4), y * w * 4);
  }
  crop.getContext('2d')!.putImageData(px, 0, 0);
  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(crop, 0, 0, w, h, 0, 0, out.width, out.height);
  return out;
}

/** Porträt/Inventarfigur: aus dem fertigen Sheet, sonst nur das eine Stehbild backen (wenige ms statt des ganzen Sheets) */
export function heroPortraitCanvas(look: Look, scale: number): HTMLCanvasElement {
  const h = heroLookOf(look);
  const ready = sheets.get(heroKey(h));
  return sheetPortrait(ready?.figSheet ?? bakeFigure({ ...heroSpec(h), anims: { idle: 1, walk: 0, attack: 0, hit: 0, die: 0 } }), scale);
}
