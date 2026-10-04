import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, getActor, spawnMonster, spawnPlayer, tick, TICK_RATE } from './world';
import { findPath, type Grid } from './path';

function openGrid(w = 12, h = 12): Grid {
  return { w, h, walkable: new Array(w * h).fill(true) };
}

describe('findPath', () => {
  it('findet Weg um Wand', () => {
    const g = openGrid(5, 5);
    for (let y = 0; y < 4; y++) g.walkable[y * 5 + 2] = false;
    const p = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(p.length).toBeGreaterThan(0);
    expect(p[p.length - 1]).toEqual({ x: 4, y: 0 });
    expect(p.every((q) => g.walkable[q.y * 5 + q.x])).toBe(true);
  });
  it('liefert [] bei blockiertem Ziel', () => {
    const g = openGrid(3, 3);
    g.walkable[4] = false;
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([]);
  });
});

describe('Simulation', () => {
  it('Spieler läuft per moveTo ans Ziel', () => {
    const w = createWorld(1, openGrid());
    const p = spawnPlayer(w, 1, 1);
    applyCommand(w, p.id, { type: 'moveTo', x: 6, y: 1 });
    for (let i = 0; i < TICK_RATE * 10; i++) tick(w);
    expect(p.x).toBeCloseTo(6);
    expect(p.y).toBeCloseTo(1);
  });

  it('Spieler besiegt Monster', () => {
    const w = createWorld(42, openGrid());
    const p = spawnPlayer(w, 1, 1);
    const m = spawnMonster(w, 9, 9);
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    for (let i = 0; i < TICK_RATE * 60 && m.alive && p.alive; i++) tick(w);
    expect(m.alive).toBe(false);
    expect(p.alive).toBe(true);
  });

  it('ist deterministisch bei gleichem Seed', () => {
    const run = () => {
      const w = createWorld(7, openGrid());
      const p = spawnPlayer(w, 1, 1);
      const m = spawnMonster(w, 5, 5);
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      for (let i = 0; i < 400; i++) tick(w);
      return [p.hp, m.hp, w.tick, getActor(w, m.id)?.alive];
    };
    expect(run()).toEqual(run());
  });
});
