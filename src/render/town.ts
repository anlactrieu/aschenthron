import type Phaser from 'phaser';
import { TILE_H, TILE_W, WALL_H, ctxOf, css, diamondPath, mkCanvas, rect, rng, shade } from './art';
import { Raster, toCanvas } from './world/raster';
import { barrel, boat, crates, flowerBox, lantern, post, ship, stall, well } from './world/props';

/**
 * Stadtgrafik (Stufe 6, Aschenhafen): Türschild-Symbole und die Registrierung der Stadt-Props (Fässer, Kisten, Brunnen,
 * Laternen, Marktstand, Blumenkästen, Boote, Pfähle, Segelschiff aus world/props.ts). Die alten Iso-Wand-/Türbilder
 * bleiben nur als Ersatz für Wandkacheln außerhalb erkannter Häuser.
 */

type Ctx = CanvasRenderingContext2D;

/** Kachelnummern der Stadtprops (siehe scripts/gen_map.py und tiled.ts) */
export const TOWN_GID = { wall: 18, barrel: 19, crates: 20, well: 21, lantern: 22, boat: 23, stall: 24, post: 25, ship: 26, flowers: 27, doorFirst: 28, doorLast: 37 } as const;
/** Kacheln, die über dem Wasser stehen (Boden darunter ist Wasser, kein Gras) */
export const WATER_PROP_GIDS = new Set<number>([TOWN_GID.boat, TOWN_GID.post, TOWN_GID.ship]);
export const DOOR_ICONS = ['anchor', 'book', 'coins', 'anvil', 'chest', 'shield', 'leaf', 'scroll', 'sword', 'staff'] as const;
export type DoorIcon = (typeof DOOR_ICONS)[number];
/** Stadt-Texturen aus der Code-Welt (stehen unten mittig, siehe GameScene.makeProp) */
export const WORLD_TOWN_KEYS = new Set(['twn_barrel', 'twn_crates', 'twn_well', 'twn_lantern', 'twn_stall', 'twn_post', 'twn_flowers', 'twn_boat', 'twn_ship']);

const PLASTER = [0xcdbf9f, 0xd8c8a8, 0xbfae90, 0xc9b69a];
const ROOF = [0x9a4632, 0x8a3a2c, 0x7a3a30, 0xa4502e];
const TIMBER = 0x5a3c26;

function poly(x: Ctx, pts: [number, number][], col: number): void {
  x.fillStyle = css(col);
  x.beginPath();
  x.moveTo(pts[0]![0], pts[0]![1]);
  for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
  x.closePath();
  x.fill();
}

function line(x: Ctx, ax: number, ay: number, bx: number, by: number, col: number, w = 1): void {
  x.strokeStyle = css(col);
  x.lineWidth = w;
  x.beginPath();
  x.moveTo(ax, ay);
  x.lineTo(bx, by);
  x.stroke();
}

/** Hauswand als Block (wie die Stadtmauer, aber Putz, Fachwerk, Fenster, Ziegeldach als Oberseite). */
export function houseWallCanvas(variant: number): HTMLCanvasElement {
  const c = mkCanvas(TILE_W, TILE_H + WALL_H);
  const x = ctxOf(c);
  const r = rng(variant * 71 + 5);
  const plaster = PLASTER[variant % PLASTER.length]!;
  const roof = ROOF[variant % ROOF.length]!;
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const left: [number, number][] = [[0, hh], [hw, TILE_H], [hw, TILE_H + WALL_H], [0, hh + WALL_H]];
  const right: [number, number][] = [[TILE_W, hh], [hw, TILE_H], [hw, TILE_H + WALL_H], [TILE_W, hh + WALL_H]];
  poly(x, left, plaster);
  poly(x, right, shade(plaster, 0.8));
  // Steinsockel
  poly(x, [[0, hh + WALL_H - 7], [hw, TILE_H + WALL_H - 7], [hw, TILE_H + WALL_H], [0, hh + WALL_H]], 0x6a6560);
  poly(x, [[TILE_W, hh + WALL_H - 7], [hw, TILE_H + WALL_H - 7], [hw, TILE_H + WALL_H], [TILE_W, hh + WALL_H]], 0x57524e);
  // Fachwerk: Randbalken, Querbalken, Strebe
  for (const [side, col] of [[0, TIMBER], [1, shade(TIMBER, 0.8)]] as const) {
    const sx = side === 0 ? 0 : TILE_W;
    const sh = side === 0 ? 1 : -1;
    line(x, sx, hh, sx, hh + WALL_H, col, 3);
    line(x, hw, TILE_H, hw, TILE_H + WALL_H, col, 3);
    line(x, sx, hh + 2, hw, TILE_H + 2, col, 3);
    line(x, sx, hh + WALL_H - 9, hw, TILE_H + WALL_H - 9, col, 2);
    line(x, sx + sh * 2, hh + WALL_H - 10, sx + sh * 14, hh + 12 + (side === 0 ? 7 : 7), col, 2);
  }
  // Fenster (nicht jede Wand): Rahmen, Glas, Kreuz, Blumenkasten
  for (const side of [0, 1] as const) {
    if (r() > (side === 0 ? 0.62 : 0.5)) continue;
    const ox = side === 0 ? 11 : 37;
    const oy = side === 0 ? 27 : 27;
    const skew = side === 0 ? 1 : -1;
    for (let i = 0; i < 12; i++) {
      const px = ox + i;
      const py = oy + Math.round((skew * (i - 6)) / 2);
      rect(x, px, py, 1, 14, i === 0 || i === 11 ? TIMBER : 0x2a3a52);
    }
    for (let i = 1; i < 11; i++) rect(x, ox + i, oy + Math.round((skew * (i - 6)) / 2) + 6, 1, 1, TIMBER);
    for (let i = 1; i < 6; i++) rect(x, ox + 5, oy + Math.round((skew * (5 - 6)) / 2) + i, 1, 1, TIMBER);
    for (let i = 1; i < 11; i++) rect(x, ox + i, oy + Math.round((skew * (i - 6)) / 2) + 14, 1, 2, 0x4a3a2a);
    rect(x, ox + 3, oy + Math.round((skew * -3) / 2) + 2, 2, 2, 0xf0e0a0);
  }
  // Dach: Oberseite als Ziegelfläche mit Reihen und Firstkante
  x.save();
  diamondPath(x);
  x.clip();
  rect(x, 0, 0, TILE_W, TILE_H, roof);
  for (let i = -4; i <= 8; i++) line(x, i * 8, 0, i * 8 + hw, hh, shade(roof, 0.78), 1);
  for (let i = 0; i < 12; i++) rect(x, 8 + Math.floor(r() * 46), 3 + Math.floor(r() * 24), 3, 1, shade(roof, 1.15 + r() * 0.15));
  line(x, 4, hh, TILE_W - 4, hh, shade(roof, 1.25), 1);
  x.restore();
  // Dachkante (dunkle Linie an der Traufe)
  line(x, 0, hh, hw, TILE_H, shade(roof, 0.55), 2);
  line(x, TILE_W, hh, hw, TILE_H, shade(roof, 0.5), 2);
  return c;
}

/** Schild-Symbol (14x14) für Türschilder. */
export function drawDoorIcon(x: Ctx, icon: DoorIcon, ox: number, oy: number): void {
  const R = (a: number, b: number, w: number, h: number, col: number) => rect(x, ox + a, oy + b, w, h, col);
  switch (icon) {
    case 'anchor':
      R(6, 1, 2, 11, 0x2a3a52); R(4, 3, 6, 2, 0x2a3a52); R(2, 9, 3, 2, 0x2a3a52); R(9, 9, 3, 2, 0x2a3a52); R(3, 10, 8, 2, 0x2a3a52); R(5, 0, 4, 1, 0x2a3a52);
      break;
    case 'book':
      R(2, 2, 10, 10, 0x5a2a2a); R(3, 3, 8, 8, 0xe8e0c8); R(6, 3, 2, 8, 0x8a6a3a); R(4, 5, 2, 1, 0x6a5a40); R(9, 5, 2, 1, 0x6a5a40); R(4, 7, 2, 1, 0x6a5a40); R(9, 7, 2, 1, 0x6a5a40);
      break;
    case 'coins':
      R(2, 6, 7, 5, 0xe8b830); R(3, 5, 5, 1, 0xf8d860); R(3, 11, 5, 1, 0xa87820); R(6, 2, 7, 5, 0xf0c840); R(7, 1, 5, 1, 0xfff0a0); R(7, 7, 5, 1, 0xb08828); R(8, 3, 3, 3, 0xd8a820);
      break;
    case 'anvil':
      R(1, 3, 12, 3, 0x4a4a52); R(3, 6, 8, 2, 0x3a3a42); R(5, 8, 4, 3, 0x32323a); R(2, 11, 10, 2, 0x2a2a30); R(10, 2, 3, 1, 0x62626c); R(11, 1, 2, 2, 0x4a4a52);
      break;
    case 'chest':
      R(1, 4, 12, 8, 0x7a5030); R(1, 4, 12, 3, 0x946438); R(1, 7, 12, 1, 0x3a2414); R(6, 6, 2, 3, 0xe8c040); R(1, 4, 1, 8, 0x2a2a30); R(12, 4, 1, 8, 0x2a2a30);
      break;
    case 'shield':
      R(2, 1, 10, 7, 0x4a6aa8); R(3, 8, 8, 2, 0x4a6aa8); R(5, 10, 4, 2, 0x4a6aa8); R(6, 1, 2, 11, 0xe8e0c8); R(2, 4, 10, 2, 0xe8e0c8);
      break;
    case 'leaf':
      R(5, 2, 5, 8, 0x4a9a48); R(4, 4, 7, 4, 0x58b058); R(7, 3, 1, 9, 0x2a6a2c); R(6, 11, 3, 2, 0x5a3c26);
      break;
    case 'scroll':
      R(2, 3, 9, 9, 0xe8dcb8); R(1, 2, 11, 2, 0xc8b888); R(1, 11, 11, 2, 0xc8b888); R(3, 5, 6, 1, 0x6a5a40); R(3, 7, 5, 1, 0x6a5a40); R(3, 9, 6, 1, 0x6a5a40); R(10, 0, 2, 7, 0xe0e0e0);
      break;
    case 'staff':
      R(6, 4, 2, 9, 0x6a4a2a); R(5, 1, 4, 4, 0x60c0f0); R(6, 0, 2, 6, 0xc8f0ff); R(4, 2, 6, 2, 0xc8f0ff); R(2, 8, 1, 1, 0xe8c840); R(11, 6, 1, 1, 0xe8c840); R(10, 10, 1, 1, 0xe8c840);
      break;
    case 'sword':
      R(6, 1, 2, 8, 0xd8d8e0); R(5, 9, 4, 1, 0xe8b830); R(6, 10, 2, 3, 0x6a4a2a); R(2, 4, 3, 2, 0x4a6aa8); R(3, 6, 1, 4, 0x4a6aa8);
      break;
  }
}

/** Tür: zwei Pfosten mit Sturz und hängendem Schild. `axis`: Richtung der Wandreihe (x: Wand links oben und rechts unten). */
export function doorCanvas(icon: DoorIcon, axis: 'x' | 'y'): HTMLCanvasElement {
  const c = mkCanvas(TILE_W, TILE_H + WALL_H);
  const x = ctxOf(c);
  const g = (px: number, py: number): [number, number] => [px, py + WALL_H];
  const a = axis === 'x' ? g(16, 8) : g(48, 8);
  const b = axis === 'x' ? g(48, 24) : g(16, 24);
  const H = 40;
  // Pfosten und Sturz
  for (const [px, py] of [a, b]) {
    rect(x, px - 2, py - H, 4, H, TIMBER);
    rect(x, px - 2, py - H, 1, H, shade(TIMBER, 1.3));
    rect(x, px - 3, py - 3, 6, 3, 0x6a6560);
  }
  line(x, a[0], a[1] - H, b[0], b[1] - H, TIMBER, 4);
  line(x, a[0], a[1] - H - 3, b[0], b[1] - H - 3, shade(TIMBER, 1.25), 1);
  // Schild an zwei Ketten
  const mx = Math.round((a[0] + b[0]) / 2);
  const my = Math.round((a[1] + b[1]) / 2) - H;
  rect(x, mx - 8, my + 2, 1, 6, 0x303038);
  rect(x, mx + 7, my + 2, 1, 6, 0x303038);
  rect(x, mx - 11, my + 8, 23, 20, shade(TIMBER, 0.7));
  rect(x, mx - 10, my + 9, 21, 18, 0xa07a4a);
  rect(x, mx - 10, my + 9, 21, 1, 0xc09a62);
  drawDoorIcon(x, icon, mx - 7, my + 11);
  return c;
}

/** Registriert alle Stadt-Texturen in Phaser. */
export function registerTownArt(scene: Phaser.Scene): void {
  const add = (key: string, c: HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
  };
  for (let v = 0; v < PLASTER.length; v++) add(`twn_wall_${v}`, houseWallCanvas(v));
  DOOR_ICONS.forEach((icon) => {
    for (const axis of ['x', 'y'] as const) add(`twn_door_${icon}_${axis}`, doorCanvas(icon, axis));
  });
  // Stadt-Props der Code-Welt (world/props.ts), Maßstab 2, Fußpunkt unten mittig
  const W = (key: string, make: () => Raster) => add(key, toCanvas(make()));
  W('twn_barrel', barrel);
  W('twn_crates', crates);
  W('twn_well', well);
  W('twn_lantern', lantern);
  W('twn_stall', stall);
  W('twn_post', post);
  W('twn_flowers', flowerBox);
  W('twn_boat', boat);
  W('twn_ship', ship);
}
