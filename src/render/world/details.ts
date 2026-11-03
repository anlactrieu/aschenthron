/**
 * Bodendetails der Code-Welt (Halme, Blumen, Farne, Steine, Knochen, Pilze, Risse, Glut, Netze …): kleine Bilder im
 * Kunstraster, die der Chunk-Maler einmalig in den Boden stempelt. Streuung je Biom in Gruppen (grober 4x4-Hash), wie
 * vorher in `groundLook.ts`. Kleine Objekte bekommen einen weichen Umriss, flache Dinge (Risse, Moos) keinen.
 */
import { ART, INK, Raster, h3, rng, type Rgb } from './raster';
import { Z } from '../groundLook';

type Pal = Record<string, Rgb>;

/** Bild aus Textzeilen (Zeichen → Farbe, '.' leer), optional mit halbtransparentem Umriss */
function spr(rows: string[], pal: Pal, ink: number | null = 170): Raster {
  const w = Math.max(...rows.map((r) => r.length));
  const r = new Raster(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]!];
      if (c !== undefined) r.set(x, y, c);
    }
  });
  if (ink === null) return r;
  const o = r.outline(INK);
  // Umriss halbtransparent: auf dem Boden wirkt er wie ein Schlagschatten, nicht wie ein Strich
  for (let i = 0; i < o.d.length; i++) {
    const p = o.d[i]!;
    if (p >>> 24 && (p & 0xffffff) === ((INK & 255) << 16 | (INK & 0xff00) | (INK >> 16))) o.d[i] = (p & 0xffffff) | (ink << 24) >>> 0;
  }
  return o;
}

/** Riss: gezackte Linie, flach (ohne Umriss) */
function crack(seed: number, c: Rgb, len = 9): Raster {
  const r = new Raster(12, 8);
  const g = rng(seed);
  let x = 1;
  let y = 2 + Math.floor(g() * 4);
  for (let i = 0; i < len && x < 11; i++) {
    r.set(x, y, c);
    if (g() < 0.3 && i > 2) r.set(x, y + (g() < 0.5 ? 1 : -1), c);
    x++;
    if (g() < 0.5) y = Math.max(0, Math.min(7, y + (g() < 0.5 ? -1 : 1)));
  }
  return r;
}

function embers(seed: number): Raster {
  const r = new Raster(10, 7);
  const g = rng(seed);
  for (let i = 0; i < 3; i++) {
    const x = 1 + Math.floor(g() * 8);
    const y = 1 + Math.floor(g() * 5);
    r.set(x - 1, y, 0x5a1a10);
    r.set(x + 1, y, 0x5a1a10);
    r.set(x, y + 1, 0x5a1a10);
    r.set(x, y, g() < 0.5 ? 0xffb040 : 0xe8642a);
  }
  return r;
}

function web(): Raster {
  const n = 11;
  const r = new Raster(n, n);
  const c = 0x8a8494;
  for (const [x1, y1] of [[10, 0], [9, 4], [6, 7], [3, 9], [0, 10]] as const) r.line(0, 0, x1, y1, c);
  for (const rad of [3, 6, 9]) {
    for (let a = 0; a <= 90; a += 8) r.set(Math.round(Math.cos((a * Math.PI) / 180) * rad), Math.round(Math.sin((a * Math.PI) / 180) * rad), 0x6e6878);
  }
  return r;
}

function puddle(w: number, h: number, fill: Rgb, rim: Rgb, hi: Rgb, seed: number): Raster {
  const r = new Raster(w, h);
  r.ellipse(w / 2, h / 2, w / 2, h / 2, (x, y, nx, ny) => {
    const d = nx * nx + ny * ny + (h3(x, y, seed) - 0.5) * 0.3;
    return d > 0.95 ? null : d > 0.6 ? rim : ny < -0.1 && nx < 0.1 && d < 0.35 ? hi : fill;
  });
  return r;
}

function moss(w: number, h: number, a: Rgb, b: Rgb, seed: number): Raster {
  const r = new Raster(w, h);
  r.ellipse(w / 2, h / 2, w / 2, h / 2, (x, y, nx, ny) => {
    const d = nx * nx + ny * ny + (h3(x, y, seed) - 0.5) * 0.5;
    return d > 0.9 ? null : h3(x, y, seed + 1) < 0.35 ? b : a;
  });
  return r;
}

// Farben (gedämpft wie der Boden; Akzente sparsam)
const GL = 0x5e7c3c; // helles Halmgrün
const GM = 0x41592c;
const GD = 0x2c3e22;
const DRY = 0x8a7a44;
const DRYD = 0x5e5232;
const STONE = 0x6e6a70;
const STONEL = 0x9a96a0;
const STONED = 0x45424a;
const BONE = 0xc8bea6;
const BONED = 0x8a8270;
const WOOD = 0x4a3324;
const WOODL = 0x6a4a30;

const MAKE: Record<string, () => Raster> = {
  // Wiese
  tuft: () => spr(['.l..l', 'lm.lm', '.mmm.'], { l: GL, m: GM }),
  tuft_b: () => spr(['l...l.', 'm.l.m.', 'mmmmm.'], { l: GL, m: GM }),
  tuft_dark: () => spr(['.l..l', 'lm.lm', '.mmm.'], { l: GM, m: GD }),
  tuft_dry: () => spr(['.l..l', 'lm.lm', '.mmm.'], { l: DRY, m: DRYD }),
  tuft_grey: () => spr(['.l..l', 'lm.lm', '.mmm.'], { l: 0x6e766a, m: 0x4a5048 }),
  flower_y: () => spr(['.y.', 'yoy', '.g.'], { y: 0xc8b35a, o: 0x8a5a2a, g: GM }),
  flower_w: () => spr(['.w.', 'wyw', '.g.'], { w: 0xc8c4b4, y: 0xb09a48, g: GM }),
  flower_p: () => spr(['.p.', 'pwp', '.g.'], { p: 0xa86a80, w: 0xd8c8b0, g: GM }),
  flower_v: () => spr(['.v.', 'vwv', '.g.'], { v: 0x7a6a9e, w: 0xc8c0d0, g: GM }),
  flowers: () => spr(['.y...p.', 'yoy.pwp', '.g.y.g.', '..yoy..', '...g...'], { y: 0xc8b35a, o: 0x8a5a2a, p: 0xa86a80, w: 0xd8c8b0, g: GM }),
  clover: () => spr(['.mm.', 'mllm', '.mm.'], { l: GL, m: GM }),
  // Wald
  fern: () => spr(['l...l..', '.l.l.l.', '..lml..', '.l.m.l.', '...m...'], { l: GM, m: GD }),
  fern_b: () => spr(['..l.l..', 'l.lml.l', '.l.m.l.', '...m...'], { l: GM, m: GD }),
  leaves: () => spr(['.a..', 'ab.c', '..cc'], { a: 0x6a4a24, b: 0x8a6430, c: 0x5a3e22 }),
  leaves_b: () => spr(['a..b', '.ab.', 'b..a'], { a: 0x7a5228, b: 0x5e4024 }),
  twig: () => spr(['w....', '.ww..', '...ww', '..w..'], { w: WOODL }),
  branch: () => spr(['w......', '.ww..w.', '...www.', '......w'], { w: WOOD }),
  berries: () => spr(['.g.', 'grg', '.rr'], { g: GD, r: 0x8a2a2e }),
  roots: () => spr(['w...w', '.w.w.', '..w..', '.w...'], { w: WOOD }),
  mush_red: () => spr(['.rrr.', 'rwrrr', '..s..', '.sss.'], { r: 0x9a3a30, w: 0xd8ccb8, s: 0xc0b49a }),
  mush_brown: () => spr(['.bbb.', 'blbbb', '..s..', '.sss.'], { b: 0x7a5434, l: 0xa8804e, s: 0xb8aa8a }),
  mush_pair: () => spr(['.bb..rr', 'blbbrwr', '.s...s.', '.s...s.'], { b: 0x7a5434, l: 0xa8804e, s: 0xb8aa8a, r: 0x9a3a30, w: 0xd8ccb8 }),
  mush_purple: () => spr(['.ppp.', 'plppp', '..s..', '.sss.'], { p: 0x6a4a8a, l: 0x9a7ab8, s: 0xb0a6b8 }),
  // Steine
  pebbles: () => spr(['.ab...', 'abb.a.', '.bb.bb'], { a: STONEL, b: STONE }),
  pebble: () => spr(['ab', 'bb'], { a: STONEL, b: STONE }),
  pebbles_dark: () => spr(['.ab...', 'abb.a.', '.bb.bb'], { a: STONE, b: STONED }),
  rock_s: () => spr(['.aab.', 'abbbc', 'bbbcc'], { a: STONEL, b: STONE, c: STONED }),
  rock_s_dark: () => spr(['.aab.', 'abbbc', 'bbbcc'], { a: STONE, b: STONED, c: 0x2e2c34 }),
  rubble: () => spr(['..ab...', '.abb.ab', 'abbcbbc', '.bcc.cc'], { a: STONEL, b: STONE, c: STONED }),
  rubble_dark: () => spr(['..ab...', '.abb.ab', 'abbcbbc', '.bcc.cc'], { a: STONE, b: STONED, c: 0x2e2c34 }),
  // Knochen
  bone: () => spr(['b....b', '.bbbb.', 'b....b'], { b: BONE }),
  bone_x: () => spr(['b...b', '.b.b.', '..b..', '.b.b.', 'b...b'], { b: BONE }),
  rib: () => spr(['.b.b.b', 'bbbbbb', 'd.d.d.'], { b: BONE, d: BONED }),
  skull: () => spr(['.bbb.', 'bbbbb', 'bkbkb', '.bdb.', '.b.b.'], { b: BONE, k: 0x1a1618, d: BONED }),
  // Moor und Wasser
  reeds: () => spr(['.b..b', '.g..b', '.g.g.', 'gg.g.', '.ggg.'], { b: 0x5a3e2a, g: 0x4a6232 }),
  reeds_s: () => spr(['.b.', '.g.', 'g.g', 'ggg'], { b: 0x5a3e2a, g: 0x4a6232 }),
  puddle: () => puddle(9, 5, 0x1e2a2a, 0x141c1c, 0x4a5e5a, 3),
  puddle_s: () => puddle(6, 4, 0x1e2a2a, 0x141c1c, 0x4a5e5a, 5),
  puddle_purple: () => puddle(8, 5, 0x2a2438, 0x1c1828, 0x5a4e72, 7),
  lily: () => spr(['.ggg.', 'gglgg', 'ggg.g', '.ggg.'], { g: 0x3a5a30, l: 0x5a7c42 }),
  lily_flower: () => spr(['.ggg.', 'ggppg', 'ggpp.', '.ggg.'], { g: 0x3a5a30, p: 0xb88aa0 }),
  ripple: () => spr(['www..ww', '..www..'], { w: 0x3a5872 }, null),
  ripple_b: () => spr(['.wwww.', 'ww..ww'], { w: 0x34506a }, null),
  moss: () => moss(8, 5, 0x3a5228, 0x4c6832, 11),
  moss_dark: () => moss(7, 4, 0x2a3c26, 0x34482c, 13),
  // Asche, Glut, Höhle
  ash_pile: () => spr(['..aab..', '.abbbb.', 'abbbbcc'], { a: 0x6a6266, b: 0x4e4649, c: 0x3a3436 }),
  ash_pile_s: () => spr(['.ab.', 'abbc'], { a: 0x6a6266, b: 0x4e4649, c: 0x3a3436 }),
  char_twig: () => spr(['w....', '.ww..', '...ww'], { w: 0x1e1a1a }),
  char_branch: () => spr(['w......', '.ww..w.', '...www.'], { w: 0x1a1616 }),
  crack_0: () => crack(1, 0x141114),
  crack_1: () => crack(2, 0x141114),
  crack_2: () => crack(3, 0x141114, 7),
  crack_3: () => crack(4, 0x141114, 6),
  crack_red: () => crack(5, 0xd8501e),
  crack_red_b: () => crack(6, 0xb8401a, 7),
  embers_0: () => embers(1),
  embers_1: () => embers(2),
  web: () => web(),
  gem_a: () => spr(['.a.', 'abc', '.c.'], { a: 0x8ab8d8, b: 0x4a7ab0, c: 0x2a4a78 }),
  gem_b: () => spr(['.a.', 'abc', '.c.'], { a: 0xd88aa8, b: 0xa04a70, c: 0x6a2a48 }),
  gem_c: () => spr(['.a.', 'abc', '.c.'], { a: 0x9ad88a, b: 0x4aa05a, c: 0x2a6a3a }),
  hay: () => spr(['.y.y..y', 'yyyyyyy', '.dyyyd.'], { y: 0xa8904a, d: 0x7a6a38 }),
};

const cache = new Map<string, Raster | null>();
export function detail(id: string): Raster | null {
  let r = cache.get(id);
  if (r === undefined) {
    r = MAKE[id]?.() ?? null;
    cache.set(id, r);
  }
  return r;
}
export const DETAIL_IDS = Object.keys(MAKE);

/* ---------------------------------------------------------------- Streuung je Biom */

interface Cluster { w: number; ids: string[]; dens: number }
type Biome = Cluster[];

const EMPTY: Cluster = { w: 3, ids: [], dens: 0 };
const TUFTS = ['tuft', 'tuft_b', 'tuft', 'clover'];
const FLOWERS = ['flower_y', 'flower_w', 'flower_p', 'flower_v', 'flowers', 'flower_y'];

const BIOMES: Record<string, Biome> = {
  meadow: [EMPTY, { w: 3, ids: TUFTS, dens: 0.55 }, { w: 2, ids: FLOWERS, dens: 0.45 }, { w: 1, ids: ['pebbles', 'rock_s', 'twig', 'leaves'], dens: 0.3 }],
  flowers: [{ w: 1, ids: TUFTS, dens: 0.5 }, { w: 4, ids: FLOWERS, dens: 0.9 }],
  forest: [EMPTY, { w: 3, ids: ['tuft_dark', 'tuft_dark', 'fern', 'fern_b'], dens: 0.55 }, { w: 2, ids: ['mush_red', 'mush_brown', 'mush_pair'], dens: 0.35 }, { w: 2, ids: ['leaves', 'leaves_b', 'twig', 'branch', 'berries', 'roots'], dens: 0.5 }],
  camp: [EMPTY, { w: 2, ids: ['twig', 'branch', 'char_twig'], dens: 0.4 }, { w: 2, ids: ['pebbles', 'rock_s', 'pebble'], dens: 0.4 }, { w: 2, ids: ['tuft_dry', 'tuft_dry', 'hay'], dens: 0.5 }, { w: 1, ids: ['bone', 'ash_pile_s'], dens: 0.3 }],
  swamp: [EMPTY, { w: 3, ids: ['reeds', 'reeds_s', 'reeds_s'], dens: 0.5 }, { w: 3, ids: ['puddle', 'puddle_s', 'puddle_purple'], dens: 0.45 }, { w: 2, ids: ['mush_brown', 'mush_purple', 'mush_pair'], dens: 0.35 }, { w: 2, ids: ['tuft_dark', 'moss_dark', 'char_twig', 'branch'], dens: 0.4 }],
  grave: [EMPTY, EMPTY, { w: 2, ids: ['tuft_grey', 'tuft_dry', 'tuft_grey'], dens: 0.5 }, { w: 2, ids: ['bone', 'bone_x', 'rib', 'skull', 'bone'], dens: 0.3 }, { w: 2, ids: ['leaves_b', 'twig', 'roots', 'pebbles'], dens: 0.4 }],
  hills: [EMPTY, { w: 3, ids: ['rock_s', 'pebbles', 'pebble', 'rubble'], dens: 0.45 }, { w: 3, ids: ['tuft_dry', 'tuft', 'tuft_dry'], dens: 0.5 }, { w: 1, ids: ['flower_y', 'flower_w', 'flower_v'], dens: 0.35 }, { w: 1, ids: ['twig', 'roots', 'moss'], dens: 0.3 }],
  ash: [EMPTY, { w: 3, ids: ['crack_0', 'crack_1', 'crack_2', 'crack_3'], dens: 0.5 }, { w: 2, ids: ['embers_0', 'embers_1'], dens: 0.35 }, { w: 2, ids: ['ash_pile', 'ash_pile_s'], dens: 0.35 }, { w: 2, ids: ['char_twig', 'char_branch', 'pebbles_dark', 'bone'], dens: 0.35 }],
  grund: [EMPTY, { w: 3, ids: ['crack_red', 'crack_red_b', 'crack_0', 'crack_1'], dens: 0.55 }, { w: 3, ids: ['embers_0', 'embers_1'], dens: 0.45 }, { w: 1, ids: ['ash_pile_s', 'bone', 'skull', 'char_branch'], dens: 0.3 }],
  road: [{ w: 5, ids: [], dens: 0 }, { w: 2, ids: ['pebble', 'pebbles', 'rock_s'], dens: 0.25 }],
  dun: [EMPTY, { w: 2, ids: ['crack_0', 'crack_1', 'crack_2', 'crack_3'], dens: 0.4 }, { w: 2, ids: ['rubble_dark', 'pebbles_dark', 'pebble'], dens: 0.35 }, { w: 1, ids: ['bone', 'bone_x', 'skull'], dens: 0.25 }],
  gruft: [EMPTY, { w: 3, ids: ['moss', 'moss_dark', 'mush_purple', 'mush_brown'], dens: 0.5 }, { w: 2, ids: ['crack_0', 'crack_2', 'puddle_s', 'puddle_purple'], dens: 0.4 }, { w: 2, ids: ['bone', 'bone_x', 'skull', 'rib'], dens: 0.3 }],
  kata: [EMPTY, { w: 3, ids: ['bone', 'bone_x', 'rib', 'skull', 'bone'], dens: 0.35 }, { w: 2, ids: ['rubble', 'pebbles_dark', 'crack_0', 'crack_3'], dens: 0.4 }],
  mine: [EMPTY, { w: 3, ids: ['rubble', 'rubble_dark', 'pebbles', 'rock_s_dark'], dens: 0.45 }, { w: 2, ids: ['gem_a', 'gem_b', 'gem_c'], dens: 0.3 }, { w: 1, ids: ['crack_1', 'crack_2', 'bone'], dens: 0.3 }],
  thron: [EMPTY, { w: 3, ids: ['crack_red', 'crack_red_b', 'crack_0'], dens: 0.5 }, { w: 2, ids: ['embers_0', 'embers_1'], dens: 0.4 }, { w: 1, ids: ['bone', 'skull', 'rubble_dark'], dens: 0.3 }],
  goblin: [EMPTY, { w: 2, ids: ['mush_brown', 'mush_pair', 'mush_red'], dens: 0.4 }, { w: 3, ids: ['bone', 'bone_x', 'rib', 'twig', 'branch'], dens: 0.4 }, { w: 2, ids: ['rubble', 'pebbles', 'rock_s_dark', 'crack_0'], dens: 0.4 }],
  nest: [EMPTY, { w: 3, ids: ['web'], dens: 0.35 }, { w: 2, ids: ['bone', 'rib', 'skull', 'bone_x'], dens: 0.35 }, { w: 2, ids: ['mush_purple', 'mush_pair', 'moss_dark'], dens: 0.35 }, { w: 1, ids: ['crack_0', 'crack_3'], dens: 0.3 }],
  town: [{ w: 6, ids: [], dens: 0 }, { w: 1, ids: ['pebble', 'leaves_b', 'tuft'], dens: 0.2 }],
};

/** Biom einer Bodenart in einer Zone; null = keine Streuung (Wasser, Lava, Dielen). */
export function biomeOf(gid: number, zone: number): string | null {
  if (gid === 7) return zone === Z.camp ? 'camp' : zone >= Z.gruft ? biomeOf(5, zone) : 'road';
  if (gid === 5 || (gid === 1 && zone !== Z.none)) {
    switch (zone) {
      case Z.none: return 'town';
      case Z.gruft: return 'gruft';
      case Z.kata: return 'kata';
      case Z.mine: return 'mine';
      case Z.thron: return 'thron';
      case Z.goblin: return 'goblin';
      case Z.nest: return 'nest';
      default: return 'dun';
    }
  }
  if (gid === 1 || gid === 16) return 'town';
  if (gid === 17) return 'flowers';
  if (gid === 9) return zone === Z.grund || zone === Z.thron ? 'grund' : 'ash';
  if (gid === 8) return 'hills';
  if (gid === 3) return 'swamp';
  if (gid === 4) {
    switch (zone) {
      case Z.forest: return 'forest';
      case Z.camp: return 'camp';
      case Z.grave: return 'grave';
      case Z.hills: return 'hills';
      case Z.swamp: return 'swamp';
      default: return 'meadow';
    }
  }
  return null;
}

const DENSITY = 0.62;

/** Streut höchstens ein Detail auf die Kachel (x, y) und stempelt es an (ox, oy) in `out`; Gruppen über einen 4x4-Hash. */
export function stampDetail(out: Raster, x: number, y: number, gid: number, zone: number, ox: number, oy: number): void {
  const bk = biomeOf(gid, zone);
  if (!bk) return;
  const biome = BIOMES[bk]!;
  let tot = 0;
  for (const c of biome) tot += c.w;
  let pick = h3(x >> 2, y >> 2, 1) * tot;
  let cl = biome[0]!;
  for (const c of biome) {
    if (pick < c.w) { cl = c; break; }
    pick -= c.w;
  }
  if (!cl.ids.length || h3(x, y, 2) >= cl.dens * DENSITY) return;
  const spr = detail(cl.ids[Math.floor(h3(x, y, 3) * cl.ids.length)]!);
  if (!spr || spr.w > ART || spr.h > ART) return;
  out.blit(spr, ox + Math.floor(h3(x, y, 4) * (ART - spr.w)), oy + Math.floor(h3(x, y, 5) * (ART - spr.h)), h3(x, y, 6) < 0.5);
}

/** Wasserdetails: Seerosen am Ufer (im Moor häufiger), Wellenstriche im Tiefen */
export function stampWaterDetail(out: Raster, x: number, y: number, zone: number, dist: number, ox: number, oy: number): void {
  const swamp = zone === Z.swamp || zone === Z.gruft;
  const r = h3(x, y, 21);
  let id: string | null = null;
  if (dist <= 2 && r < (swamp ? 0.26 : 0.06)) id = h3(x, y, 22) < 0.3 ? 'lily_flower' : 'lily';
  else if (dist >= 3 && r > 0.85) id = h3(x, y, 23) < 0.5 ? 'ripple' : 'ripple_b';
  if (!id) return;
  const spr = detail(id)!;
  out.blit(spr, ox + 2 + Math.floor(h3(x, y, 24) * (ART - 4 - spr.w)), oy + 2 + Math.floor(h3(x, y, 25) * (ART - 4 - spr.h)));
}
