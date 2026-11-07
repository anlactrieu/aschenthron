/**
 * Iso-Bilder für Stadtprops (P9.3): Marktstand, Blumenkasten und Zaun je in zwei Richtungen (Zug entlang x bzw. y), dazu der
 * Wandblock samt Tür für Stadtwand-Kacheln außerhalb erkannter Häuser. Stehende Props wie Fass, Brunnen und Laterne bleiben die
 * Bilder der Code-Welt (`world/props.ts`). Die Bilder sind auf die Kachelmitte bezogen (`propAnchor`). Ohne DOM nutzbar; importiert
 * nichts aus `town.ts`/`houses.ts` (kein Importkreis), das Symbol der Tür kommt als Funktion von außen.
 */
import { INK, Raster, h3, mix, type Rgb } from './world/raster';
import { R, tone, type Ramp5 } from './world/props';
import { Quads, frameOf, type Frame, type Shade } from './isoDraw';
import type { DoorIcon } from './town';

export type Axis = 'x' | 'y';
export type IsoProp = 'stall' | 'flowers' | 'fence';

export const isoPropKey = (kind: IsoProp, axis: Axis): string => `twni_${kind}_${axis}`;

const TILE_PTS: [number, number, number][] = [[-0.5, -0.5, 0], [0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0]];
const PROP_TOP: Record<IsoProp, number> = { stall: 2.0, flowers: 0.8, fence: 0.9 };
const frameFor = (kind: IsoProp): Frame => frameOf([...TILE_PTS, [0, 0, PROP_TOP[kind]]], 1);

/** Ursprung y (0..1) der Kachelmitte im Bild; x ist immer 0,5. Das Bild steht mit `dy` 0 auf der Kachelmitte. */
export function propAnchor(kind: IsoProp): { oy: number } {
  const f = frameFor(kind);
  return { oy: (-f.sy / 2) / f.h };
}

const solid = (c: Rgb): Shade => () => c;
const planks = (ramp: Ramp5, k: number, step = 7): Shade => (s, t) => tone(ramp, k + (Math.floor(t * step) % 2 ? -0.5 : 0) + (s < 0.06 ? 0.6 : 0));

/** Marktstand: Tresen mit Waren, vier Pfosten, gestreiftes Tuch schräg darüber (Streifen laufen mit dem Zug) */
function stallRaster(axis: Axis): Raster {
  const f = frameFor('stall');
  const q = new Quads(f);
  const ax = axis === 'x';
  // Tresen: lang in Zugrichtung
  const [cx0, cx1, cy0, cy1] = ax ? [-0.5, 0.5, -0.22, 0.28] : [-0.28, 0.22, -0.5, 0.5];
  q.box(cx0, cy0, cx1, cy1, 0, 0.7, planks(R.wood, 2.4), planks(R.wood, 1.2), (s, t) => (h3(Math.floor(s * 9), Math.floor(t * 4), 3) < 0.3 ? tone(R.wood, 4) : tone(R.wood, 3.4)));
  // Waren auf dem Tresen
  const goods: Rgb[] = [0x9a3a30, 0xb8963a, 0x4a7a3a, 0xa86a2a, 0x7a5a8a];
  for (let i = 0; i < 5; i++) {
    const u = -0.4 + i * 0.2;
    const [gx, gy] = ax ? [u, 0.03] : [0.0, u];
    q.box(gx - 0.07, gy - 0.07, gx + 0.07, gy + 0.07, 0.7, 0.86, solid(mix(goods[i]!, 0x000000, 0.2)), solid(mix(goods[i]!, 0x000000, 0.4)), solid(mix(goods[i]!, 0xffffff, 0.25)));
  }
  // Pfosten an den Ecken des Tuchs
  const [px0, px1, py0, py1] = ax ? [-0.46, 0.4, -0.4, 0.4] : [-0.4, 0.4, -0.46, 0.4];
  for (const [x, y] of [[px0, py0], [px1, py0], [px0, py1], [px1, py1]] as const) {
    if (ax ? y === py0 : x === px0) continue;
    q.box(x - 0.04, y - 0.04, x + 0.04, y + 0.04, 0, 1.7, solid(tone(R.wood, 2.5)), solid(tone(R.wood, 1.5)), solid(tone(R.wood, 3)));
  }
  // Tuch: hinten hoch, vorn tiefer, Streifen längs des Zugs, Zackenkante vorn
  const stripe = (s: number, t: number, k: number): Rgb => {
    const odd = Math.floor(s * 8) % 2;
    return odd ? tone(R.linen, k - 0.4) : tone(R.cloth, k);
  };
  const cloth: Shade = (s, t) => {
    if (t > 0.9 && Math.floor(s * 16) % 2) return null;
    return stripe(s, t, t < 0.1 ? 4 : t > 0.8 ? 1.2 : 3);
  };
  if (ax) q.quad([-0.5, -0.4, 1.8], [1, 0, 0], [0, 0.95, -0.55], cloth);
  else q.quad([-0.4, -0.5, 1.8], [0, 1, 0], [0.95, 0, -0.55], cloth);
  return q.done();
}

/** Blumenkasten: niedriger Holzkasten mit Blumen */
function flowersRaster(axis: Axis): Raster {
  const f = frameFor('flowers');
  const q = new Quads(f);
  const [x0, x1, y0, y1] = axis === 'x' ? [-0.48, 0.48, -0.2, 0.2] : [-0.2, 0.2, -0.48, 0.48];
  const cols: Rgb[] = [0xa86a80, 0xc8b35a, 0xc8c4b4, 0x7a6a9e, 0xb0603a];
  q.box(x0, y0, x1, y1, 0, 0.36, planks(R.wood, 2.2, 4), planks(R.wood, 1.2, 4), (s, t) => {
    const k = h3(Math.floor(s * 14), Math.floor(t * 6), 5);
    return k < 0.3 ? cols[Math.floor(k * 16) % cols.length]! : tone(R.leaf, 3 + (k > 0.7 ? 0.8 : 0));
  });
  // Blüten und Halme über dem Kasten
  for (let i = 0; i < 7; i++) {
    const u = -0.4 + i * (0.8 / 6);
    const [bx, by] = axis === 'x' ? [u, ((i * 5) % 3 - 1) * 0.08] : [((i * 5) % 3 - 1) * 0.08, u];
    const [pu, pv] = q.proj(bx, by, 0.36);
    q.r.set(Math.round(pu), Math.round(pv) - 1, tone(R.leaf, 2.5));
    q.r.set(Math.round(pu), Math.round(pv) - 2, cols[i % cols.length]!);
  }
  return q.done();
}

/** Zaun: Pfosten an den Enden der Kachel, zwei Latten dazwischen; benachbarte Kacheln schließen nahtlos an */
function fenceRaster(axis: Axis): Raster {
  const f = frameFor('fence');
  const q = new Quads(f);
  const ax = axis === 'x';
  const rail = (z0: number, z1: number): void => {
    if (ax) q.box(-0.5, -0.03, 0.5, 0.03, z0, z1, planks(R.wood, 3, 3), planks(R.wood, 1.4, 3), solid(tone(R.wood, 4)));
    else q.box(-0.03, -0.5, 0.03, 0.5, z0, z1, planks(R.wood, 3, 3), planks(R.wood, 1.4, 3), solid(tone(R.wood, 4)));
  };
  rail(0.3, 0.42);
  rail(0.58, 0.7);
  for (const u of [-0.44, 0.44]) {
    const [x, y] = ax ? [u, 0] : [0, u];
    q.box(x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 0.85, solid(tone(R.wood, 2.6)), solid(tone(R.wood, 1.4)), solid(tone(R.wood, 3.8)));
  }
  return q.done();
}

export function isoPropRaster(kind: IsoProp, axis: Axis): Raster {
  return kind === 'stall' ? stallRaster(axis) : kind === 'flowers' ? flowersRaster(axis) : fenceRaster(axis);
}

/* ---------------------------------------------------------------- Wandblock mit Tür */

const BRICK: { top: Ramp5; face: Ramp5 } = {
  top: [0x0e0c10, 0x18151a, 0x221e24, 0x2e2830, 0x625866],
  face: [0x17141a, 0x28222a, 0x3a3240, 0x4e4454, 0x665a6a],
};
const BLOCK_H = 2.1;

/** Minimaler 2D-Kontext auf einem Raster (nur fillStyle als #rrggbb und fillRect), damit `drawDoorIcon` auch hier malt */
function rasterCtx(r: Raster): { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void } {
  let col = 0;
  return {
    set fillStyle(v: string) { col = parseInt(v.replace('#', ''), 16) || 0; },
    get fillStyle() { return `#${col.toString(16).padStart(6, '0')}`; },
    fillRect(x, y, w, h) { r.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), mix(col, 0x30282a, 0.25)); },
  };
}

/** Berufsschild 16x16; `draw` malt das Symbol (`drawDoorIcon` aus `town.ts`) */
export function signOf(icon: DoorIcon, draw: (ctx: CanvasRenderingContext2D, icon: DoorIcon, ox: number, oy: number) => void): Raster {
  const r = new Raster(16, 16);
  r.rect(0, 0, 16, 16, INK);
  r.rect(1, 1, 14, 14, 0x6a4a2c);
  r.rect(1, 1, 14, 1, 0x8a6a40);
  r.rect(1, 14, 14, 1, 0x4a321e);
  draw(rasterCtx(r) as unknown as CanvasRenderingContext2D, icon, 1, 1);
  return r;
}

/**
 * Ein Wandblock einer Stadtmauer-Kachel (Ziegel) mit zwei sichtbaren Seiten; mit `door` sitzt auf der Südseite (Zug entlang x) bzw.
 * Ostseite (Zug entlang y) eine Holztür mit Schild. Unterkante des Bildes = vordere Rautenecke der Kachel.
 */
export function blockRaster(variant: number, door: { icon: DoorIcon; axis: Axis; draw: Parameters<typeof signOf>[1] } | null): Raster {
  const f = frameOf([...TILE_PTS, [0, 0, BLOCK_H]], 0);
  const q = new Quads(f);
  const face = (lit: number, withDoor: boolean): Shade => (s, t) => {
    const z = t * BLOCK_H;
    if (withDoor && s > 0.3 && s < 0.7 && z < 1.05) {
      if (s < 0.34 || s > 0.66 || z > 0.98) return tone(R.wood, 0.5 + lit);
      return tone(R.wood, (Math.floor(s * 20) % 2 ? 2 : 1.6) + lit);
    }
    const row = Math.floor(z * 5);
    const col = Math.floor(s * 4 + (row % 2) * 0.5);
    const mortar = (z * 5 - row < 0.14) || (s * 4 + (row % 2) * 0.5 - col < 0.07);
    if (mortar) return BRICK.face[0];
    const k = 2 + lit + (h3(col, row, variant) < 0.25 ? 0.5 : h3(col, row, variant + 40) < 0.2 ? -0.5 : 0);
    return tone(BRICK.face, k);
  };
  q.quad([-0.5, 0.5, 0], [1, 0, 0], [0, 0, BLOCK_H], face(0.4, door?.axis === 'x'));
  q.quad([0.5, 0.5, 0], [0, -1, 0], [0, 0, BLOCK_H], face(-0.6, door?.axis === 'y'));
  q.quad([-0.5, 0.5, BLOCK_H], [1, 0, 0], [0, -1, 0], (s, t) => tone(BRICK.top, 3 + (s < 0.05 || t > 0.95 ? 0.6 : 0)));
  const r = q.done();
  if (door) {
    const [u, v] = q.proj(door.axis === 'x' ? 0 : 0.5, door.axis === 'x' ? 0.5 : 0, 1.12);
    r.blit(signOf(door.icon, door.draw), Math.round(u) - 8, Math.round(v) - 16);
  }
  return r;
}
