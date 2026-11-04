import type Phaser from 'phaser';
import { rect } from './art';
import { Raster, toCanvas } from './world/raster';
import { barrel, boat, crates, flowerBox, lantern, post, ship, stall, wallTile, well } from './world/props';

/**
 * Stadtgrafik (Stufe 6, Aschenhafen): Türschild-Symbole und die Registrierung der Stadt-Props (Fässer, Kisten, Brunnen,
 * Laternen, Marktstand, Blumenkästen, Boote, Pfähle, Segelschiff aus world/props.ts).
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

/** Registriert alle Stadt-Texturen in Phaser. */
export function registerTownArt(scene: Phaser.Scene): void {
  const add = (key: string, c: HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
  };
  // Wand-/Türkacheln außerhalb erkannter Häuser (in der jetzigen Karte keine): schlichte Ziegelwand der Code-Welt
  for (let v = 0; v < 4; v++) add(`twn_wall_${v}`, toCanvas(wallTile('brick', 15, v, 0)));
  DOOR_ICONS.forEach((icon) => {
    for (const axis of ['x', 'y'] as const) add(`twn_door_${icon}_${axis}`, toCanvas(wallTile('brick', 15, 0, 1)));
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
