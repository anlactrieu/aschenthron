import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { isWalkable, findPath } from './path';
import { MONSTERS, MAX_LEVEL, QUESTS, monsterKind } from './data';
import { applyCommand, getActor, inSafeZone, tick } from './world';

const { world: w, playerId } = buildWorld(7, mapJson as unknown as TiledMap);
const player = getActor(w, playerId)!;
const monsters = w.actors.filter((a) => a.kind === 'monster');

describe('Gebiet „Aschental“: Inhalt und Größe', () => {
  it('ist inselgroß: Karte, Monsterzahl, Städte, Bosse', () => {
    expect(w.grid.w).toBeGreaterThanOrEqual(230);
    expect(w.grid.h).toBeGreaterThanOrEqual(170);
    expect(monsters.length).toBeGreaterThanOrEqual(350);
    expect(w.chests.length).toBeGreaterThanOrEqual(45);
    expect(w.safe.length).toBeGreaterThanOrEqual(2);
    expect(w.towns.length).toBeGreaterThanOrEqual(2);
    const bosses = new Set(monsters.filter((m) => m.boss).map((m) => m.kindId));
    expect([...bosses].sort()).toEqual(['ash_king', 'bandit_lord', 'bog_queen', 'bone_lord', 'goblin_king', 'stone_colossus', 'web_mother']);
    const kinds = new Set(monsters.map((m) => m.kindId));
    expect(kinds.size).toBeGreaterThanOrEqual(40);
  });

  it('Champions und benannte Mini-Bosse sind verteilt', () => {
    const champs = monsters.filter((m) => m.champ);
    const uniques = monsters.filter((m) => m.unique);
    expect(champs.length).toBeGreaterThanOrEqual(12);
    expect(uniques.length).toBeGreaterThanOrEqual(11);
    expect(new Set(uniques.map((u) => u.unique)).size).toBe(uniques.length);
    for (const u of uniques) expect(u.abilities.length).toBeGreaterThan(0);
    // nie in Stadtnähe
    for (const m of [...champs, ...uniques]) for (const t of w.towns) expect(Math.hypot(m.x - t.x, m.y - t.y)).toBeGreaterThan(14);
  });

  it('NPCs: je Stadt Lehrer, Händler, Truhe, Schmied und Questgeber', () => {
    for (const kind of ['trainer', 'merchant', 'stash', 'smith', 'quest'] as const) {
      expect(w.npcs.filter((n) => n.kind === kind).length, kind).toBeGreaterThanOrEqual(2);
    }
  });

  it('jeder Level bis zum Cap hat in Reichweite passende Gegner (keine Lücke in der Progression)', () => {
    const levels = monsters.filter((m) => !m.boss).map((m) => monsterKind(m.kindId!).level);
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      expect(levels.some((l) => Math.abs(l - lv) <= 2), `Level ${lv}`).toBe(true);
    }
  });

  it('alle Monster, NPCs und Bosse sind erreichbar', () => {
    const reach = new Set<number>();
    const queue = [[Math.round(player.x), Math.round(player.y)]] as [number, number][];
    reach.add(queue[0]![1] * w.grid.w + queue[0]![0]);
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const k = ny * w.grid.w + nx;
        if (isWalkable(w.grid, nx, ny) && !reach.has(k)) {
          reach.add(k);
          queue.push([nx, ny]);
        }
      }
    }
    for (const m of monsters) expect(reach.has(Math.round(m.y) * w.grid.w + Math.round(m.x)), `${m.name} @${m.x},${m.y}`).toBe(true);
    for (const n of w.npcs) expect(reach.has(Math.round(n.y) * w.grid.w + Math.round(n.x)), n.name).toBe(true);
  });

  it('Stadteingänge sind frei von starken Gegnern (kein Camping)', () => {
    for (const m of monsters) {
      const lvl = monsterKind(m.kindId!).level;
      for (const t of w.towns) {
        if (Math.hypot(m.x - t.x, m.y - t.y) < 14) expect(lvl, `${m.name} nahe Stadt`).toBeLessThanOrEqual(3);
      }
      expect(inSafeZone(w, m.x, m.y)).toBe(false);
    }
  });

  it('Questkette deckt Level 1–28 ab, alle Ziele existieren auf der Karte', () => {
    const kinds = new Set(monsters.map((m) => m.kindId));
    for (const q of QUESTS) if (q.kind === 'kill') expect(kinds.has(q.target), q.id).toBe(true);
    expect(Math.min(...QUESTS.map((q) => q.minLevel))).toBe(1);
    expect(Math.max(...QUESTS.map((q) => q.minLevel))).toBeGreaterThanOrEqual(28);
    expect(MONSTERS.length).toBeGreaterThanOrEqual(20);
  });
});

describe('Performance auf der großen Karte', () => {
  it('ein Tick mit Spieler mitten im Gelände bleibt schnell (Schlafen/Aggro-Logik)', () => {
    player.x = 80;
    player.y = 70;
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) tick(w);
    const per = (performance.now() - t0) / 200;
    expect(per).toBeLessThan(5);
  });

  it('Klick auf unerreichbare, aber begehbare Kachel (abgeschnittene Insel) friert nicht ein', () => {
    // Kopie der echten Karte mit einem begehbaren Fleck mitten im Wasser
    const grid = { ...w.grid, walkable: [...w.grid.walkable] };
    const spot = { x: 3, y: 3 };
    grid.walkable[spot.y * grid.w + spot.x] = true;
    const from = { x: Math.round(player.x), y: Math.round(player.y) };
    const t0 = performance.now();
    const path = findPath(grid, from, spot);
    expect(path).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(250);
    const t1 = performance.now();
    applyCommand(w, playerId, { type: 'moveTo', x: from.x, y: from.y });
    expect(performance.now() - t1).toBeLessThan(250);
  });
});
