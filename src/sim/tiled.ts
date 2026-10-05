import type { Grid } from './path';
import { addNpc, createWorld, giveStarterKit, spawnMonster, spawnPlayer, type NpcKind, type Rect, type World } from './world';

interface TiledProp {
  name: string;
  value: string;
}
interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProp[];
}
interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: TiledObject[];
}
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: TiledLayer[];
}

/** Nicht begehbare Tile-IDs: 2 Wand, 6 Wasser, 10 Baum, 11 Fels, 12 Lava, 13 Grabstein, 14 Säule, 0 leer; Stadt: 18 Hauswand, 19 Fass, 20 Kisten, 21 Brunnen, 22 Laterne, 23 Boot, 24 Stand, 25 Pfahl, 26 Schiff, 27 Blumenkasten (begehbar: 15 Dielen, 16 Pflaster, 17 Blumenwiese, 28–36 Türen) */
const BLOCKED = new Set([0, 2, 6, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);

export interface LoadedMap {
  grid: Grid;
  tiles: number[];
}

export function loadMap(map: TiledMap): LoadedMap {
  const layer = map.layers.find((l) => l.type === 'tilelayer' && l.name === 'ground');
  if (!layer?.data) throw new Error('Tiled-Karte braucht eine Kachelebene "ground"');
  return {
    grid: { w: map.width, h: map.height, walkable: layer.data.map((g) => !BLOCKED.has(g)) },
    tiles: layer.data,
  };
}

/** Baut eine spielbare Welt: Karte, Sicherheitszonen, NPCs, Monster und Spieler. */
export function buildWorld(seed: number, map: TiledMap, opts: { player?: boolean } = {}): { world: World; tiles: number[]; playerId: number } {
  const { grid, tiles } = loadMap(map);
  const ts = map.tilewidth;
  const objs = map.layers.find((l) => l.type === 'objectgroup')?.objects ?? [];
  const prop = (o: TiledObject, n: string) => o.properties?.find((p) => p.name === n)?.value;
  const safe: Rect[] = objs
    .filter((o) => o.type === 'safezone')
    .map((o) => ({ x: o.x / ts, y: o.y / ts, w: o.width / ts, h: o.height / ts }));
  const world = createWorld(seed, grid, safe);
  world.regions = objs
    .filter((o) => o.type === 'region')
    .map((o) => ({ name: o.name, levels: prop(o, 'levels') ?? '', x: o.x / ts, y: o.y / ts, w: o.width / ts, h: o.height / ts }));
  const start = objs.find((o) => o.type === 'start');
  if (!start) throw new Error('Tiled-Karte braucht ein Objekt vom Typ "start"');
  for (const o of objs) {
    if (o.type === 'npc') {
      const kind = prop(o, 'kind') as NpcKind;
      addNpc(world, kind, o.name, o.x / ts, o.y / ts, {
        shop: prop(o, 'shop'),
        tier: prop(o, 'tier') ? Number(prop(o, 'tier')) : undefined,
        quests: prop(o, 'quests')?.split(','),
      });
    }
    if (o.type === 'chest') {
      world.chests.push({ id: world.nextId++, x: o.x / ts, y: o.y / ts, level: Number(prop(o, 'level') ?? 1), tier: (prop(o, 'tier') ?? 'wood') as 'wood', opened: false, respawnAt: 0 });
    }
    if (o.type === 'townstart') world.towns.push({ x: o.x / ts, y: o.y / ts });
    if (o.type === 'monster') {
      const m = spawnMonster(world, o.x / ts, o.y / ts, prop(o, 'kind'), { champ: prop(o, 'champ'), unique: prop(o, 'unique') });
      m.packId = Number(prop(o, 'pack') ?? 0);
    }
  }
  world.start = { x: start.x / ts, y: start.y / ts };
  if (opts.player === false) return { world, tiles, playerId: -1 };
  const player = spawnPlayer(world, start.x / ts, start.y / ts);
  giveStarterKit(world, player);
  return { world, tiles, playerId: player.id };
}
