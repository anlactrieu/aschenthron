import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, loadMap, type TiledMap } from './tiled';
import { NPC_KEYS, NPC_ROLE, QUESTS, SHOPS } from './data';
import { TEMPLATES } from './items';
import { applyCommand, drainEvents, inSafeZone, regionAt, spawnPlayer } from './world';

const map = mapJson as unknown as TiledMap;
const { world: w } = buildWorld(1, map, { player: false });
const { grid, tiles } = loadMap(map);
const tile = (x: number, y: number) => tiles[Math.round(y) * map.width + Math.round(x)];
const inTown = w.npcs.filter((n) => regionAt(w, n.x, n.y)?.name === 'Aschenhafen');
const FLOOR = 15;
const WALL = 18;

describe('Aschenhafen (Hafenstadt)', () => {
  it('ist Stadt, Sicherheitszone und Wiederbelebungspunkt, ohne Monster; Start liegt am Hafen', () => {
    const r = w.regions.find((x) => x.name === 'Aschenhafen')!;
    expect(r.levels).toBe('Stadt');
    expect(w.towns.length).toBe(2);
    expect(inSafeZone(w, r.x + r.w / 2, r.y + 20)).toBe(true);
    expect(w.actors.filter((a) => a.kind === 'monster' && a.x >= r.x && a.x < r.x + r.w && a.y >= r.y && a.y < r.y + r.h)).toHaveLength(0);
    // Ankunft: Start auf dem Hafenplatz, Kai und Schiff in der Nähe
    expect(tile(w.start.x, w.start.y)).toBe(16);
    let ship = false;
    let planks = 0;
    for (let y = w.start.y - 4; y < w.start.y + 20; y++) for (let x = w.start.x - 12; x < w.start.x + 12; x++) {
      if (tile(x, y) === 26) ship = true;
      if (tile(x, y) === 15) planks++;
    }
    expect(ship).toBe(true);
    expect(planks).toBeGreaterThan(20);
  });

  it('jede Rolle hat einen NPC mit Rollenhinweis; Lehrer lehrt Stufe 1, zwei Händler mit verschiedenem Sortiment', () => {
    expect(inTown).toHaveLength(9);
    const kinds = inTown.map((n) => n.kind).sort();
    expect(kinds).toEqual(['merchant', 'merchant', 'quest', 'quest', 'quest', 'quest', 'smith', 'stash', 'trainer']);
    for (const n of inTown) expect(NPC_ROLE[n.name], n.name).toBeDefined();
    expect(inTown.find((n) => n.kind === 'trainer')!.tier).toBe(1);
    const shops = inTown.filter((n) => n.kind === 'merchant').map((n) => n.shop);
    expect(new Set(shops).size).toBe(2);
    for (const key of shops) for (const id of SHOPS[key!]!) {
      const t = TEMPLATES.find((x) => x.id === id);
      expect(t, id).toBeDefined();
      if (t!.hint) expect(t!.minLevel, `${id} zu hoch für einen Laden`).toBeLessThanOrEqual(11);
    }
  });

  it('jeder NPC steht in einem eigenen Haus (Dielen, umschlossen), jedes Haus hat ein Türschild', () => {
    // Raum eines NPC: zusammenhängende Dielenkacheln um ihn; genau 6x4 Felder, kein zweiter NPC darin
    const room = (sx: number, sy: number) => {
      const seen = new Set<number>([Math.round(sy) * map.width + Math.round(sx)]);
      const q = [...seen];
      while (q.length) {
        const c = q.pop()!;
        for (const d of [1, -1, map.width, -map.width]) {
          const k = c + d;
          if (!seen.has(k) && tiles[k] === FLOOR) {
            seen.add(k);
            q.push(k);
          }
        }
      }
      return seen;
    };
    for (const n of inTown) {
      expect(tile(n.x, n.y), n.name).toBe(FLOOR);
      const r = room(n.x, n.y);
      expect(r.size, `${n.name}: Raumgröße`).toBe(24);
      for (const o of inTown) if (o !== n) expect(r.has(Math.round(o.y) * map.width + Math.round(o.x)), `${n.name} teilt den Raum mit ${o.name}`).toBe(false);
    }
    for (let i = 0; i < inTown.length; i++) for (let j = i + 1; j < inTown.length; j++) {
      const a = inTown[i]!;
      const b = inTown[j]!;
      expect(Math.abs(a.x - b.x) >= 8 || Math.abs(a.y - b.y) >= 7, `${a.name}/${b.name} im selben Haus`).toBe(true);
    }
    // neun Türen mit neun verschiedenen Symbolen
    const doors = new Map<number, number>();
    for (const t of tiles) if (t >= 28 && t <= 36) doors.set(t, (doors.get(t) ?? 0) + 1);
    expect([...doors.keys()].sort()).toEqual([28, 29, 30, 31, 32, 33, 34, 35, 36]);
    for (const c of doors.values()) expect(c).toBe(1);
  });

  it('Stadt-NPCs und Türen sind vom Start aus erreichbar (Tür offen, Props blockieren, Dielen und Türen begehbar)', () => {
    expect(grid.walkable[Math.round(w.start.y) * grid.w + Math.round(w.start.x)]).toBe(true);
    for (const gid of [18, 19, 20, 21, 22, 23, 24, 25, 26, 27]) expect(tiles.some((t) => t === gid), `gid ${gid}`).toBe(true);
    const seen = new Set<number>();
    const q = [Math.round(w.start.y) * grid.w + Math.round(w.start.x)];
    seen.add(q[0]!);
    while (q.length) {
      const c = q.pop()!;
      const x = c % grid.w;
      const y = Math.floor(c / grid.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = (y + dy) * grid.w + x + dx;
        if (grid.walkable[k] && !seen.has(k)) {
          seen.add(k);
          q.push(k);
        }
      }
    }
    for (const n of inTown) expect(seen.has(Math.round(n.y) * grid.w + Math.round(n.x)), n.name).toBe(true);
    // Türen blockieren nicht, Wände schon
    tiles.forEach((t, i) => {
      if (t >= 28 && t <= 36) expect(grid.walkable[i]).toBe(true);
      if (t === WALL) expect(grid.walkable[i]).toBe(false);
    });
  });

  it('Ankunftskette führt durch alle Rollen: jede Station erklärt ihre Aufgabe, am Ende ist die Kette abgeschlossen', () => {
    const { world, playerId } = buildWorld(5, map);
    const p = world.actors.find((a) => a.id === playerId)!;
    const chain = QUESTS.filter((q) => q.chain === 'Ankunft in Aschenhafen');
    expect(chain.map((q) => q.target)).toEqual(['varn', 'mirel', 'ilse', 'ottmar', 'brandt']);
    const giverOf = (id: string) => world.npcs.find((n) => n.quests?.includes(id))!;
    expect(giverOf('c_arr1').name).toBe('Hafenmeister Joren');
    const gold = p.gold;
    for (const q of chain) {
      const giver = giverOf(q.id);
      p.x = giver.x;
      p.y = giver.y + 1;
      p.hp = p.maxHp;
      applyCommand(world, p.id, { type: 'acceptQuest', questId: q.id });
      expect(p.quests[q.id]?.state, q.id).toBe('active');
      const target = world.npcs.find((n) => NPC_KEYS[q.target] === n.name)!;
      p.x = target.x;
      p.y = target.y + 1;
      drainEvents(world);
      applyCommand(world, p.id, { type: 'talk', npcId: target.id });
      expect(p.quests[q.id]?.state, q.id).toBe('turned');
      expect(q.outro?.length, q.id).toBeGreaterThan(30);
    }
    expect(p.gold).toBeGreaterThan(gold);
    void spawnPlayer;
  });
});
