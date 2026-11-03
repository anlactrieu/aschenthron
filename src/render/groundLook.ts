/**
 * Zonen-Look des Bodens (Außenwelt und Dungeons): welche Ninja-Bodenzellen und Tönung eine Kachel je Zone bekommt,
 * dazu die Detail-Sprites (Gras, Blumen, Kiesel, Knochen, Risse …), die `GameScene.makeChunk` einmalig in die
 * Chunk-Textur zeichnet. Alles reine Optik (nichts davon steht in der Sim); ohne Ninja-Bilder (Tests/Node) bleibt der
 * bisherige Boden unverändert.
 */
import { ninjaImg, type NinjaSrc } from './ninja';
import { ninjaProp, PIXEL } from './ninjaProps';

const FIELD = 'Backgrounds/Tilesets/TilesetField.png';
const FLOOR = 'Backgrounds/Tilesets/TilesetFloor.png';

/** Zone je Kachel (Index in `ZONE_NAMES`, 0 = keine Zone oder Stadt/Meer) */
export const ZONE_NAMES = ['', 'Roggenfelder', 'Düsterwald', 'Räuberlager', 'Moorlande', 'Totenacker', 'Hochland', 'Aschenöde', 'Aschengrund', 'Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche', 'Goblinbau', 'Spinnennest'];
export const Z = { none: 0, farm: 1, forest: 2, camp: 3, swamp: 4, grave: 5, hills: 6, ash: 7, grund: 8, gruft: 9, kata: 10, mine: 11, thron: 12, goblin: 13, nest: 14 } as const;

/** Zonenkarte aus den Regionen: kleinste Region gewinnt, Städte und unbekannte Namen zählen als „keine Zone“. */
export function buildZoneMap(regions: { x: number; y: number; w: number; h: number; name: string }[], gw: number, gh: number, tileSize = 1): Uint8Array {
  const out = new Uint8Array(gw * gh);
  const sorted = [...regions].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const r of sorted) {
    const id = Math.max(0, ZONE_NAMES.indexOf(r.name));
    const x0 = Math.max(0, Math.floor(r.x / tileSize));
    const y0 = Math.max(0, Math.floor(r.y / tileSize));
    const x1 = Math.min(gw, Math.ceil((r.x + r.w) / tileSize));
    const y1 = Math.min(gh, Math.ceil((r.y + r.h) / tileSize));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y * gw + x] = id;
  }
  return out;
}

/* ------------------------------------------------------------ Bodenzellen */

export interface LookCell { f: string; x: number; y: number }
export interface TileLook { cells?: LookCell[]; tint?: readonly [number, number, number, number] }

const block = (f: string, x: number, y: number): LookCell[] => [{ f, x, y }, { f, x: x + 16, y }, { f, x, y: y + 16 }, { f, x: x + 16, y: y + 16 }];
const GRASS_Y = block(FIELD, 48, 48);
const GRASS_D = block(FIELD, 48, 96);
const RELIEF = 'Backgrounds/Tilesets/TilesetRelief.png';
/** Steinplatten (Stadtstraße, Plätze): leicht gemusterte Reliefzellen, per Tönung ins Dunkelviolett gezogen */
const FLAGS: LookCell[] = [[80, 32], [128, 32], [160, 32], [128, 32]].map(([x, y]) => ({ f: RELIEF, x: x!, y: y! }));
const DIRT: LookCell[] = [[128, 128], [128, 144], [160, 144], [160, 160]].map(([x, y]) => ({ f: FLOOR, x: x!, y: y! }));

/** Boden-Look für (gid, Zone); null = Standardzelle (`groundCell`). */
export function tileLook(gid: number, zone: number): TileLook | null {
  switch (gid) {
    case 4:
      switch (zone) {
        case Z.farm: return { cells: GRASS_Y };
        case Z.forest: return { cells: GRASS_D, tint: [30, 70, 50, 0.1] };
        case Z.camp: return { cells: GRASS_Y, tint: [160, 130, 60, 0.3] };
        case Z.grave: return { cells: GRASS_D, tint: [110, 120, 135, 0.32] };
        case Z.hills: return { cells: GRASS_D, tint: [150, 130, 70, 0.3] };
        default: return { cells: GRASS_Y };
      }
    case 3: return { cells: GRASS_D, tint: [88, 84, 40, 0.42] };
    case 7: return { cells: DIRT, tint: zone === Z.camp ? [110, 84, 52, 0.28] : [190, 140, 70, 0.2] };
    case 1: return zone === Z.none ? { cells: FLAGS, tint: [96, 82, 112, 0.5] } : null;
    case 16: return { cells: FLAGS, tint: [118, 98, 134, 0.5] };
    case 8: return { cells: GRASS_D, tint: [170, 150, 90, 0.4] };
    case 9: return zone === Z.grund ? { tint: [140, 36, 40, 0.34] } : { tint: [170, 96, 60, 0.22] };
    case 5:
      switch (zone) {
        case Z.gruft: return { tint: [60, 120, 80, 0.22] };
        case Z.kata: return { tint: [170, 170, 190, 0.2] };
        case Z.mine: return { tint: [150, 105, 60, 0.28] };
        case Z.thron: return { tint: [150, 40, 50, 0.24] };
        case Z.goblin: return { tint: [110, 100, 40, 0.24] };
        case Z.nest: return { tint: [110, 60, 140, 0.24] };
        default: return { cells: FLAGS, tint: [118, 98, 134, 0.5] };
      }
    default: return null;
  }
}

export function tintCanvas(c: HTMLCanvasElement, tint: readonly [number, number, number, number]): void {
  const x = c.getContext('2d')!;
  x.save();
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`;
  x.fillRect(0, 0, c.width, c.height);
  x.restore();
}

export function lookImage(cell: LookCell): NinjaSrc | null {
  return ninjaImg(cell.f);
}

/* --------------------------------------------------- prozedurale Detailbilder */

type PalMap = Record<string, string>;

/** Pixelbild aus Textzeilen (Zeichen → Farbe), automatischer dunkler Umriss wie bei den Ninja-Sprites, PIXEL-fach skaliert. */
function pix(rows: string[], pal: PalMap, outline: string | null = '#2a2024'): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const pad = outline ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = (w + pad * 2) * PIXEL;
  c.height = (h + pad * 2) * PIXEL;
  const g = c.getContext('2d')!;
  const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && y < h && x < w && !!pal[rows[y]![x] ?? '.'];
  if (outline) {
    g.fillStyle = outline;
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) g.fillRect((x + pad) * PIXEL, (y + pad) * PIXEL, PIXEL, PIXEL);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = pal[rows[y]![x] ?? '.'];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect((x + pad) * PIXEL, (y + pad) * PIXEL, PIXEL, PIXEL);
    }
  }
  return c;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    s ^= s >>> 12;
    return (s >>> 0) / 4294967296;
  };
}

/** Pixelkontur eines unregelmäßigen Flecks (Pfütze, Aschehaufen, Moos): Ellipse mit Rauschen, Rand dunkler. */
function blob(wpx: number, hpx: number, fill: string, rim: string | null, hi: string | null, seed: number, outline: string | null = null): HTMLCanvasElement {
  const r = seeded(seed);
  const rows: string[] = [];
  for (let y = 0; y < hpx; y++) {
    let row = '';
    for (let x = 0; x < wpx; x++) {
      const nx = (x + 0.5 - wpx / 2) / (wpx / 2);
      const ny = (y + 0.5 - hpx / 2) / (hpx / 2);
      const d = nx * nx + ny * ny + (r() - 0.5) * 0.25;
      row += d > 1 ? '.' : d > 0.68 && rim ? 'r' : hi && ny < -0.25 && nx < 0.2 && d < 0.55 ? 'h' : 'f';
    }
    rows.push(row);
  }
  return pix(rows, { f: fill, ...(rim ? { r: rim } : { r: fill }), ...(hi ? { h: hi } : { h: fill }) }, outline);
}

function crack(seed: number, col = 'rgba(24,18,26,0.6)'): HTMLCanvasElement {
  const r = seeded(seed);
  const c = document.createElement('canvas');
  c.width = 16 * PIXEL;
  c.height = 12 * PIXEL;
  const g = c.getContext('2d')!;
  g.fillStyle = col;
  let x = 1 + Math.floor(r() * 3);
  let y = 3 + Math.floor(r() * 6);
  const dir = r() < 0.5 ? 1 : -1;
  for (let i = 0; i < 10 + Math.floor(r() * 5); i++) {
    g.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
    if (r() < 0.25 && i > 2) { g.fillRect((x + 1) * PIXEL, (y + dir) * PIXEL, PIXEL, PIXEL); g.fillRect((x + 2) * PIXEL, (y + 2 * dir) * PIXEL, PIXEL, PIXEL); }
    x++;
    if (r() < 0.5) y = Math.max(1, Math.min(10, y + (r() < 0.5 ? -1 : 1)));
    if (x > 14) break;
  }
  return c;
}

function embers(seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const c = document.createElement('canvas');
  c.width = 14 * PIXEL;
  c.height = 10 * PIXEL;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * 12);
    const y = Math.floor(r() * 8);
    g.fillStyle = 'rgba(200,60,20,0.65)';
    g.fillRect((x - 1) * PIXEL, (y - 1) * PIXEL, PIXEL * 3, PIXEL * 3);
    g.fillStyle = r() < 0.5 ? '#ffb23a' : '#ff7a24';
    g.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
  }
  return c;
}

function web(seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const n = 14;
  const c = document.createElement('canvas');
  c.width = n * PIXEL;
  c.height = n * PIXEL;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(236,236,248,0.78)';
  const line = (x1: number, y1: number): void => {
    const steps = Math.max(Math.abs(x1), Math.abs(y1));
    for (let i = 0; i <= steps; i++) g.fillRect(Math.round((x1 * i) / steps) * PIXEL, Math.round((y1 * i) / steps) * PIXEL, PIXEL, PIXEL);
  };
  const rays = [[13, 0], [12, 5], [8, 9], [4, 12], [0, 13], [13, 3]];
  for (const [x1, y1] of rays) line(x1!, y1!);
  for (const rad of [4, 7, 10]) {
    for (let a = 0; a <= 90; a += 6) {
      const px = Math.round(Math.cos((a * Math.PI) / 180) * rad + (r() < 0.1 ? 1 : 0));
      const py = Math.round(Math.sin((a * Math.PI) / 180) * rad);
      g.fillRect(px * PIXEL, py * PIXEL, PIXEL, PIXEL);
    }
  }
  return c;
}

const PROC: Record<string, () => HTMLCanvasElement> = {
  mush_red: () => pix(['.RRRRR.', 'RRWRRWR', 'RRRRRRR', '..SSS..', '..SSS..', '.SSSSS.'], { R: '#d84a3a', W: '#fbf0dc', S: '#eedcb4' }),
  mush_red_s: () => pix(['.RRR.', 'RWRRR', '.SS..', '.SS..'], { R: '#d84a3a', W: '#fbf0dc', S: '#eedcb4' }),
  mush_brown: () => pix(['.BBBB.', 'BLBBLB', 'BBBBBB', '..SS..', '..SS..', '.SSSS.'], { B: '#a8703c', L: '#dcae72', S: '#e6d6b0' }),
  mush_pair: () => pix(['.BBB....RR.', 'BLBBB..RWRR', '.SS...SSSS.', '.SS....SS..'], { B: '#a8703c', L: '#dcae72', S: '#e6d6b0', R: '#d84a3a', W: '#fbf0dc' }),
  mush_purple: () => pix(['.PPPP.', 'PLPPLP', 'PPPPPP', '..SS..', '.SSSS.'], { P: '#8a5cb8', L: '#c9a6ea', S: '#d8cce0' }),
  pebbles: () => pix(['..GG.....', '.GHGG.GG.', '.GGGG.GHG', '..GG..GGG'], { G: '#8d9099', H: '#c9ccd4' }),
  pebbles_dark: () => pix(['..GG.....', '.GHGG.GG.', '.GGGG.GHG', '..GG..GGG'], { G: '#5c5660', H: '#8a8492' }),
  pebbles_one: () => pix(['.GG.', 'GHGG', '.GG.'], { G: '#8d9099', H: '#c9ccd4' }),
  rubble: () => pix(['..GGG....', '.GHGGG.GG', 'GGGGGGGHG', '.GGG.GGGG'], { G: '#7c7670', H: '#aaa49c' }),
  rubble_dark: () => pix(['..GGG....', '.GHGGG.GG', 'GGGGGGGHG', '.GGG.GGGG'], { G: '#4e4a56', H: '#7a7488' }),
  bone: () => pix(['WW.....WW', '.WWWWWWW.', 'WW.....WW'], { W: '#efe6d2' }),
  bone_x: () => pix(['W.....W', '.W...W.', '..WWW..', '.W...W.', 'W.....W'], { W: '#efe6d2' }),
  rib: () => pix(['.W.W.W.', 'WWWWWWW', 'W.W.W.W', '.W.W.W.'], { W: '#e6dcc4' }),
  skull: () => pix(['.WWWWW.', 'WWWWWWW', 'WKKWKKW', 'WKKWKKW', '.WWKWW.', '..WWW..', '..W.W..'], { W: '#efe6d2', K: '#2a2024' }),
  reeds: () => pix(['.B...B.', '.B...B.', '.G..GG.', 'GG..G..', '.GGGGG.', 'GGGGGGG'], { B: '#6a4630', G: '#5f8a3c' }),
  reeds_s: () => pix(['..B..', '..G..', '.GG.G', 'GGGGG'], { B: '#6a4630', G: '#5f8a3c' }),
  puddle_0: () => blob(11, 6, '#6a8f8c', '#3e5a54', '#9cc0bc', 11, '#2e3a30'),
  puddle_1: () => blob(8, 5, '#6a8f8c', '#3e5a54', '#9cc0bc', 23, '#2e3a30'),
  puddle_purple: () => blob(10, 6, '#7a6aa0', '#4a3c6a', '#b0a0d6', 5, '#2e2a40'),
  ash_pile: () => blob(9, 5, '#7a7476', '#5c5658', '#aaa4a4', 7, '#2e2a2e'),
  ash_pile_s: () => blob(6, 4, '#7a7476', '#5c5658', '#aaa4a4', 9, '#2e2a2e'),
  moss: () => blob(10, 6, '#5c8a3a', '#486f2e', '#86b45a', 13),
  moss_dark: () => blob(9, 5, '#456b3a', '#34522c', '#628a4e', 17),
  crack_0: () => crack(1),
  crack_1: () => crack(2),
  crack_2: () => crack(3),
  crack_3: () => crack(4),
  crack_red: () => crack(5, 'rgba(250,110,40,0.75)'),
  crack_red_b: () => crack(6, 'rgba(250,110,40,0.75)'),
  embers_0: () => embers(1),
  embers_1: () => embers(2),
  web_0: () => web(1),
  ripple_0: () => pix(['WWW..WW', '..WWW..'], { W: 'rgba(255,255,255,0.55)' }, null),
  ripple_1: () => pix(['.WWWW.', 'WW..WW'], { W: 'rgba(255,255,255,0.5)' }, null),
  lily: () => pix(['.GGGG.', 'GGGLGG', 'GGGG.G', '.GGGG.'], { G: '#4f9a42', L: '#7cc45e' }, '#2c4a34'),
  lily_flower: () => pix(['.GGGG.', 'GGPPGG', 'GGPPG.', '.GGGG.'], { G: '#4f9a42', P: '#f4a6c4' }, '#2c4a34'),
  hay: () => pix(['.Y.Y..Y.', 'YYYYYYYY', '.YYYYYY.'], { Y: '#d8b858' }),
};

const procCache = new Map<string, HTMLCanvasElement>();

/** Detailbild zur Kennung: `dt_*` kommt aus dem Ninja-Paket (ninjaProps), alles andere ist prozedural. */
export function detailSprite(id: string): HTMLCanvasElement | null {
  if (id.startsWith('dt_')) return ninjaProp(id);
  let c = procCache.get(id);
  if (!c) {
    const make = PROC[id];
    if (!make || typeof document === 'undefined') return null;
    c = make();
    procCache.set(id, c);
  }
  return c;
}

/* ---------------------------------------------------------------- Streuung */

interface Cluster { w: number; ids: string[]; dens: number }
type Biome = Cluster[];

const EMPTY: Cluster = { w: 3, ids: [], dens: 0 };
const TUFTS = ['dt_tuft_0', 'dt_tuft_1', 'dt_tuft_2', 'dt_tuft_3', 'dt_tuft_4', 'dt_tuft_6'];
const FLOWERS = ['dt_flower', 'dt_daisy', 'dt_tulip', 'dt_tuft_5', 'dt_clover', 'dt_flower', 'dt_tulip'];

const BIOMES: Record<string, Biome> = {
  meadow: [EMPTY, { w: 3, ids: TUFTS, dens: 0.5 }, { w: 3, ids: FLOWERS, dens: 0.6 }, { w: 1, ids: ['dt_sun_a', 'dt_sun_b', 'dt_sun_a'], dens: 0.3 }, { w: 1, ids: ['dt_pebbles', 'dt_rock', 'dt_twig_a', 'dt_leaves_a'], dens: 0.3 }],
  forest: [EMPTY, { w: 3, ids: ['dt_dark_0', 'dt_dark_1', 'dt_dark_2', 'dt_dark_3', 'dt_tuft_6', 'dt_tuft_7'], dens: 0.55 }, { w: 2, ids: ['dt_fern_a', 'dt_fern_b'], dens: 0.5 }, { w: 2, ids: ['mush_red', 'mush_brown', 'mush_pair', 'mush_red_s'], dens: 0.4 }, { w: 2, ids: ['dt_leaves_a', 'dt_leaves_b', 'dt_twig_a', 'dt_twig_b', 'dt_branch', 'dt_berries'], dens: 0.5 }],
  camp: [EMPTY, { w: 2, ids: ['dt_twig_a', 'dt_twig_b', 'dt_branch', 'dt_char_twig'], dens: 0.4 }, { w: 2, ids: ['dt_pebbles', 'dt_rock', 'pebbles_one'], dens: 0.4 }, { w: 2, ids: ['dt_dry_0', 'dt_dry_1', 'dt_dry_2', 'dt_dry_3'], dens: 0.5 }, { w: 1, ids: ['bone', 'ash_pile_s', 'hay'], dens: 0.3 }],
  swamp: [EMPTY, { w: 3, ids: ['reeds', 'reeds_s', 'reeds_s'], dens: 0.5 }, { w: 3, ids: ['puddle_0', 'puddle_1', 'puddle_purple'], dens: 0.5 }, { w: 2, ids: ['mush_brown', 'mush_purple', 'mush_pair'], dens: 0.4 }, { w: 2, ids: ['dt_dark_0', 'dt_dark_2', 'dt_dark_3', 'dt_char_twig', 'dt_branch'], dens: 0.4 }],
  grave: [EMPTY, EMPTY, { w: 2, ids: ['dt_dry_0', 'dt_dry_1', 'dt_dry_3', 'dt_dark_0'], dens: 0.5 }, { w: 2, ids: ['bone', 'bone_x', 'rib', 'skull', 'bone'], dens: 0.3 }, { w: 2, ids: ['dt_grey_leaves', 'dt_twig_b', 'dt_roots', 'pebbles'], dens: 0.4 }],
  hills: [EMPTY, { w: 3, ids: ['dt_rock', 'dt_rock', 'dt_pebbles', 'pebbles', 'pebbles_one', 'rubble'], dens: 0.45 }, { w: 3, ids: ['dt_dry_0', 'dt_dry_1', 'dt_dry_2', 'dt_dry_3', 'dt_tuft_2'], dens: 0.5 }, { w: 1, ids: ['dt_flower', 'dt_tulip', 'dt_daisy'], dens: 0.35 }, { w: 1, ids: ['dt_twig_a', 'dt_roots', 'moss'], dens: 0.3 }],
  ash: [EMPTY, { w: 3, ids: ['crack_0', 'crack_1', 'crack_2', 'crack_3'], dens: 0.5 }, { w: 2, ids: ['embers_0', 'embers_1'], dens: 0.35 }, { w: 2, ids: ['ash_pile', 'ash_pile_s'], dens: 0.35 }, { w: 2, ids: ['dt_char_twig', 'dt_char_branch', 'pebbles_dark', 'bone'], dens: 0.35 }],
  grund: [EMPTY, { w: 3, ids: ['crack_red', 'crack_red_b', 'crack_0', 'crack_1'], dens: 0.55 }, { w: 3, ids: ['embers_0', 'embers_1'], dens: 0.45 }, { w: 1, ids: ['ash_pile_s', 'bone', 'skull', 'dt_char_branch'], dens: 0.3 }],
  road: [{ w: 5, ids: [], dens: 0 }, { w: 2, ids: ['pebbles_one', 'dt_pebbles', 'pebbles'], dens: 0.2 }],
  dun: [EMPTY, { w: 2, ids: ['crack_0', 'crack_1', 'crack_2', 'crack_3'], dens: 0.4 }, { w: 2, ids: ['rubble_dark', 'pebbles_dark', 'pebbles_one'], dens: 0.35 }, { w: 1, ids: ['bone', 'bone_x', 'skull'], dens: 0.25 }],
  gruft: [EMPTY, { w: 3, ids: ['moss', 'moss_dark', 'mush_purple', 'mush_brown'], dens: 0.5 }, { w: 2, ids: ['crack_0', 'crack_2', 'puddle_1', 'puddle_purple'], dens: 0.4 }, { w: 2, ids: ['bone', 'bone_x', 'skull', 'rib'], dens: 0.3 }],
  kata: [EMPTY, { w: 3, ids: ['bone', 'bone_x', 'rib', 'skull', 'bone'], dens: 0.35 }, { w: 2, ids: ['rubble', 'pebbles_dark', 'crack_0', 'crack_3'], dens: 0.4 }],
  mine: [EMPTY, { w: 3, ids: ['rubble', 'rubble_dark', 'pebbles', 'dt_rock_dark'], dens: 0.45 }, { w: 2, ids: ['dt_gem_a', 'dt_gem_b', 'dt_gem_c', 'dt_gem_d'], dens: 0.3 }, { w: 1, ids: ['crack_1', 'crack_2', 'bone'], dens: 0.3 }],
  thron: [EMPTY, { w: 3, ids: ['crack_red', 'crack_red_b', 'crack_0'], dens: 0.5 }, { w: 2, ids: ['embers_0', 'embers_1'], dens: 0.4 }, { w: 1, ids: ['bone', 'skull', 'rubble_dark'], dens: 0.3 }],
  goblin: [EMPTY, { w: 2, ids: ['mush_brown', 'mush_pair', 'mush_red_s'], dens: 0.4 }, { w: 3, ids: ['bone', 'bone_x', 'rib', 'dt_twig_a', 'dt_branch'], dens: 0.4 }, { w: 2, ids: ['rubble', 'pebbles', 'dt_rock_dark', 'crack_0'], dens: 0.4 }],
  nest: [EMPTY, { w: 3, ids: ['web_0'], dens: 0.35 }, { w: 2, ids: ['bone', 'rib', 'skull', 'bone_x'], dens: 0.35 }, { w: 2, ids: ['mush_purple', 'mush_pair', 'moss_dark'], dens: 0.35 }, { w: 1, ids: ['crack_0', 'crack_3'], dens: 0.3 }],
};

/** Biom einer Bodenart in einer Zone; null = keine Streuung (Stadt, Wasser, Lava, Pflaster). */
export function biomeOf(gid: number, zone: number): string | null {
  if (gid === 7) return zone === Z.camp ? 'camp' : zone >= Z.gruft ? null : 'road';
  if (gid === 5) {
    switch (zone) {
      case Z.gruft: return 'gruft';
      case Z.kata: return 'kata';
      case Z.mine: return 'mine';
      case Z.thron: return 'thron';
      case Z.goblin: return 'goblin';
      case Z.nest: return 'nest';
      default: return 'dun';
    }
  }
  if (gid === 9) return zone === Z.grund ? 'grund' : 'ash';
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

const mix32 = (a: number, b: number, c: number): number => {
  let t = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647)) | 0;
  t = Math.imul(t ^ (t >>> 15), 2246822519);
  t = Math.imul(t ^ (t >>> 13), 3266489917);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
};

/** Streut höchstens ein Detail auf die Kachel (x, y); Gruppen entstehen über einen groben 4x4-Hash. Zeichnet an (ox, oy). */
export function drawDetail(ctx: CanvasRenderingContext2D, x: number, y: number, gid: number, zone: number, ox: number, oy: number, tile: number): void {
  const bk = biomeOf(gid, zone);
  if (!bk) return;
  const biome = BIOMES[bk]!;
  let tot = 0;
  for (const c of biome) tot += c.w;
  let pick = mix32(x >> 2, y >> 2, 1) * tot;
  let cl = biome[0]!;
  for (const c of biome) {
    if (pick < c.w) { cl = c; break; }
    pick -= c.w;
  }
  if (!cl.ids.length || mix32(x, y, 2) >= cl.dens * DENSITY) return;
  const id = cl.ids[Math.floor(mix32(x, y, 3) * cl.ids.length)]!;
  const spr = detailSprite(id);
  if (!spr || spr.width > tile || spr.height > tile) return;
  const px = Math.floor((mix32(x, y, 4) * (tile - spr.width)) / PIXEL) * PIXEL;
  const py = Math.floor((mix32(x, y, 5) * (tile - spr.height)) / PIXEL) * PIXEL;
  ctx.drawImage(spr, ox + px, oy + py);
}

/**
 * Wasserkachel: Tiefe (Abstand zum Land: 1 = Ufer, 2 = flach, 3+ = tief) färbt dunkler; Sumpfwasser wird trüb violett.
 * Dazu statische Wellenstriche und Seerosen (das Glitzern bleibt Sache von `GameScene.shimmer`).
 */
export function drawWaterTile(ctx: CanvasRenderingContext2D, x: number, y: number, zone: number, dist: number, ox: number, oy: number, tile: number): void {
  const swamp = zone === Z.swamp || zone === Z.gruft;
  if (swamp) {
    ctx.fillStyle = 'rgba(96,70,140,0.42)';
    ctx.fillRect(ox, oy, tile, tile);
  }
  const n = 0.85 + mix32(x, y, 20) * 0.3;
  if (dist >= 2) {
    const k = (Math.min(dist, 6) - 1) * 0.045 * n;
    ctx.fillStyle = swamp ? `rgba(30,24,70,${k * 0.9})` : `rgba(24,84,168,${k})`;
    ctx.fillRect(ox, oy, tile, tile);
  }
  const r = mix32(x, y, 21);
  let id: string | null = null;
  if (dist <= 2 && r < (swamp ? 0.26 : 0.07)) id = mix32(x, y, 22) < 0.3 ? 'lily_flower' : 'lily';
  else if (dist >= 3 && r > 0.82) id = mix32(x, y, 23) < 0.5 ? 'ripple_0' : 'ripple_1';
  if (!id) return;
  const spr = detailSprite(id);
  if (!spr) return;
  const px = Math.floor((mix32(x, y, 24) * (tile - spr.width)) / PIXEL) * PIXEL;
  const py = Math.floor((mix32(x, y, 25) * (tile - spr.height)) / PIXEL) * PIXEL;
  ctx.drawImage(spr, ox + px, oy + py);
}

/** Lavakachel: dunkle Krusten, gelbe Glutadern und ein verkrusteter Rand zu jedem Nachbarn ohne Lava (Seiten: [Ost, West, Süd, Nord]). */
export function drawLavaTile(ctx: CanvasRenderingContext2D, x: number, y: number, rim: readonly [boolean, boolean, boolean, boolean], ox: number, oy: number, tile: number): void {
  const px = PIXEL;
  const n = tile / px;
  ctx.fillStyle = 'rgba(176,36,10,0.42)';
  ctx.fillRect(ox, oy, tile, tile);
  for (let i = 0; i < 9; i++) {
    const cx = Math.floor(mix32(x, y, 30 + i) * (n - 4)) + 1;
    const cy = Math.floor(mix32(x, y, 40 + i) * (n - 4)) + 1;
    if (i < 3) {
      ctx.fillStyle = 'rgba(70,16,10,0.62)';
      ctx.fillRect(ox + cx * px, oy + cy * px, px * 4, px * 2);
      ctx.fillRect(ox + (cx + 1) * px, oy + (cy + 2) * px, px * 2, px);
    } else {
      ctx.fillStyle = i % 2 ? 'rgba(255,226,110,0.9)' : 'rgba(255,170,50,0.85)';
      ctx.fillRect(ox + cx * px, oy + cy * px, px * (2 + (i % 3)), px);
      if (i % 3 === 0) ctx.fillRect(ox + (cx + 1) * px, oy + (cy + 1) * px, px, px);
    }
  }
  ctx.fillStyle = '#6a2412';
  for (let i = 0; i < n; i++) {
    const d = 1 + Math.floor(mix32(x * 16 + i, y, 50) * 2);
    if (rim[0]) ctx.fillRect(ox + (n - d) * px, oy + i * px, d * px, px);
    if (rim[1]) ctx.fillRect(ox, oy + i * px, d * px, px);
    if (rim[2]) ctx.fillRect(ox + i * px, oy + (n - d) * px, px, d * px);
    if (rim[3]) ctx.fillRect(ox + i * px, oy, px, d * px);
  }
}

/** Sanfte Helligkeitsflecken (Wert-Rauschen, Wellenlänge ca. 5 Kacheln): −1..1 */
export function patchNoise(x: number, y: number): number {
  const s = 5;
  const fx = x / s;
  const fy = y / s;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sm = (t: number): number => t * t * (3 - 2 * t);
  const a = mix32(ix, iy, 9);
  const b = mix32(ix + 1, iy, 9);
  const c = mix32(ix, iy + 1, 9);
  const d = mix32(ix + 1, iy + 1, 9);
  const top = a + (b - a) * sm(tx);
  const bot = c + (d - c) * sm(tx);
  return (top + (bot - top) * sm(ty)) * 2 - 1;
}
