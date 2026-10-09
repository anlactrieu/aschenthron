/**
 * Props aus dem Ninja-Adventure-Paket (CC0): Ausschnitte aus den Tilesets, auf die sichtbare Pixel zugeschnitten
 * und 3x hochskaliert. Fehlt ein Bild (oder läuft der Code in Node), liefert `ninjaProp` null und die prozedurale
 * Grafik springt ein.
 */
import { ninjaImg, preloadNinja, NINJA_GROUND_FILES } from './ninja';

/** Alle Dateien, die der Start vorlädt (Boden + Props) */
export const preloadAllNinja = (): Promise<void> => preloadNinja([...new Set([...NINJA_GROUND_FILES, ...NINJA_PROP_FILES])]);

const sheet = (n: string): string => `Backgrounds/Tilesets/${n}.png`;
export const NINJA_PROP_FILES = ['TilesetHouse', 'tileset_camp', 'TilesetNature', 'TilesetElement', 'TilesetRelief', 'TilesetDungeon'].map(sheet);

export const PIXEL = 3;

export interface PropPart { f: string; r: [number, number, number, number]; x: number; y: number }
export interface PropSpec {
  f: string;
  r: [number, number, number, number];
  /** Zusammengesetzt: Teilbilder auf einer Fläche der Größe r[2] x r[3] (statt eines einzelnen Ausschnitts) */
  parts?: PropPart[];
  flip?: boolean;
  /** Farbmischung: Zielfarbe und Anteil (0..1) – zum Abdunkeln/Tönen derselben Vorlage */
  tint?: [number, number, number, number];
}

const REL = 'TilesetRelief';
const DUN = 'TilesetDungeon';
const NAT = 'TilesetNature';
const ELE = 'TilesetElement';
const HOU = 'TilesetHouse';
const CAM = 'tileset_camp';

/** Rechtecke in Pixeln des 16x16-Rasters (abgelesen mit dem Gitter-Helfer). */
export const PROPS: Record<string, PropSpec> = {
  // Bäume (32x32-Zellen in der obersten Reihe von TilesetNature)
  tree_oak_0: { f: NAT, r: [0, 0, 32, 32] },
  tree_oak_1: { f: NAT, r: [256, 0, 32, 32] },
  tree_oak_2: { f: NAT, r: [288, 0, 32, 32] },
  tree_pine_0: { f: NAT, r: [32, 0, 32, 32] },
  tree_pine_1: { f: NAT, r: [32, 0, 32, 32], flip: true },
  tree_pine_2: { f: NAT, r: [32, 0, 32, 32], tint: [20, 60, 40, 0.18] },
  tree_dead_0: { f: NAT, r: [64, 0, 32, 32] },
  tree_dead_1: { f: NAT, r: [64, 0, 32, 32], flip: true },
  tree_dead_2: { f: NAT, r: [64, 0, 32, 32], tint: [50, 40, 40, 0.25] },
  tree_char_0: { f: NAT, r: [64, 0, 32, 32], tint: [20, 18, 20, 0.62] },
  tree_char_1: { f: NAT, r: [64, 0, 32, 32], flip: true, tint: [20, 18, 20, 0.62] },
  tree_char_2: { f: NAT, r: [64, 0, 32, 32], tint: [40, 20, 14, 0.55] },
  // Felsen
  rock_grey_0: { f: NAT, r: [288, 144, 16, 16] },
  rock_grey_1: { f: NAT, r: [258, 132, 29, 27] },
  rock_grey_2: { f: NAT, r: [258, 132, 29, 27], flip: true },
  rock_dark_0: { f: NAT, r: [288, 144, 16, 16], tint: [30, 20, 40, 0.5] },
  rock_dark_1: { f: NAT, r: [258, 132, 29, 27], tint: [30, 20, 40, 0.5] },
  rock_dark_2: { f: NAT, r: [258, 132, 29, 27], flip: true, tint: [30, 20, 40, 0.5] },
  // Wände (Felsfläche in Draufsicht, 16x16-Zellen); die Schattierung kommt in art.ts dazu
  wall_cliff_0: { f: REL, r: [80, 96, 16, 16] },
  wall_cliff_1: { f: REL, r: [80, 96, 16, 16], flip: true },
  wall_cliff_2: { f: REL, r: [80, 96, 16, 16], tint: [90, 60, 50, 0.2] },
  wall_dungeon_0: { f: REL, r: [80, 16, 16, 16], tint: [70, 56, 90, 0.22] },
  wall_dungeon_1: { f: REL, r: [80, 16, 16, 16], flip: true, tint: [70, 56, 90, 0.22] },
  wall_dungeon_2: { f: REL, r: [80, 16, 16, 16], tint: [50, 40, 70, 0.3] },
  wall_brick_0: { f: DUN, r: [80, 16, 16, 16] },
  wall_brick_1: { f: DUN, r: [80, 16, 16, 16], flip: true },
  wall_brick_2: { f: DUN, r: [80, 16, 16, 16], tint: [60, 40, 40, 0.25] },
  // Gräber (Kreuz, Grabstein, Stele) und Säule
  grave_0: { f: ELE, r: [64, 32, 16, 16] },
  grave_1: { f: ELE, r: [80, 32, 16, 16] },
  grave_2: { f: ELE, r: [48, 32, 16, 16] },
  pillar: { f: HOU, r: [0, 240, 16, 36] },
  // Stadt
  twn_barrel: { f: HOU, r: [288, 176, 16, 16] },
  twn_crates: { f: HOU, r: [304, 224, 16, 16] },
  twn_well: { f: ELE, r: [112, 32, 16, 16] },
  twn_lantern: { f: CAM, r: [91, 81, 15, 26] },
  twn_stall: { f: HOU, r: [0, 0, 32, 30], parts: [{ f: HOU, r: [256, 208, 16, 16], x: 0, y: 0 }, { f: HOU, r: [272, 208, 16, 16], x: 16, y: 0 }, { f: HOU, r: [256, 258, 32, 14], x: 0, y: 14 }] },
  twn_post: { f: CAM, r: [2, 80, 14, 30] },
};

/** Schlüssel der Texturen, die aus dem Ninja-Paket stammen (Fuß unten mitte, nicht prozedural verankert) */
export const NINJA_KEYS = new Set<string>();

const cache = new Map<string, HTMLCanvasElement | null>();

/** Zugeschnittene, 3x skalierte Zeichenfläche zu einer Props-Kennung (oder null). */
export function ninjaProp(id: string): HTMLCanvasElement | null {
  if (cache.has(id)) return cache.get(id)!;
  const out = build(id);
  cache.set(id, out);
  return out;
}

function build(id: string): HTMLCanvasElement | null {
  const spec = PROPS[id];
  if (!spec || typeof document === 'undefined') return null;
  const [rx, ry, rw, rh] = spec.r;
  const src = document.createElement('canvas');
  src.width = rw;
  src.height = rh;
  const sg = src.getContext('2d', { willReadFrequently: true })!;
  if (spec.parts) {
    for (const p of spec.parts) {
      const pi = ninjaImg(sheet(p.f));
      if (!pi) return null;
      sg.drawImage(pi, p.r[0], p.r[1], p.r[2], p.r[3], p.x, p.y, p.r[2], p.r[3]);
    }
  } else {
    const img = ninjaImg(sheet(spec.f));
    if (!img) return null;
    sg.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
  }
  const d = sg.getImageData(0, 0, rw, rh);
  let x0 = rw, y0 = rh, x1 = -1, y1 = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (d.data[(y * rw + x) * 4 + 3]! > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  if (spec.tint) {
    const [tr, tg, tb, k] = spec.tint;
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = d.data[i]! * (1 - k) + tr * k;
      d.data[i + 1] = d.data[i + 1]! * (1 - k) + tg * k;
      d.data[i + 2] = d.data[i + 2]! * (1 - k) + tb * k;
    }
    sg.putImageData(d, 0, 0);
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = bw * PIXEL;
  out.height = bh * PIXEL;
  const og = out.getContext('2d')!;
  og.imageSmoothingEnabled = false;
  if (spec.flip) {
    og.translate(out.width, 0);
    og.scale(-1, 1);
  }
  og.drawImage(src, x0, y0, bw, bh, 0, 0, out.width, out.height);
  return out;
}
