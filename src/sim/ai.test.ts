import { describe, expect, it } from 'vitest';
import type { Grid } from './path';
import { MONSTERS, FLEE_HP, FLEE_TICKS } from './data';
import { createWorld, drainEvents, spawnMonster, spawnPlayer, tick, TICK_RATE, type GameEvent } from './world';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });
const setup = () => {
  const w = createWorld(3, open(), [{ x: 0, y: 0, w: 3, h: 3 }]);
  const p = spawnPlayer(w, 20, 20);
  p.hp = p.maxHp = 100000;
  return { w, p };
};
const run = (w: ReturnType<typeof setup>['w'], n: number): GameEvent[] => {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) { tick(w); ev.push(...drainEvents(w)); }
  return ev;
};

describe('Gegner-KI (P4)', () => {
  it('Daten: Untote, Bosse und Häuptlinge fliehen nie; nur Goblins und Banditen rufen', () => {
    for (const k of MONSTERS) {
      if (k.family === 'undead') expect(k.flees, k.id).toBeUndefined();
      if (k.boss) expect(k.flees, k.id).toBeUndefined();
      if (/chief|warlord|captain|brute|shaman/.test(k.id)) expect(k.flees, k.id).toBeUndefined();
      if (k.calls) expect(/goblin|bandit|highwayman/.test(k.id), k.id).toBe(true);
    }
    expect(MONSTERS.filter((k) => k.flees).length).toBeGreaterThanOrEqual(6);
  });

  it('Goblin ruft Goblins im Umkreis, nicht fremde Arten', () => {
    const { w, p } = setup();
    const a = spawnMonster(w, 24, 20, 'goblin');
    const b = spawnMonster(w, 30, 20, 'goblin_warrior');
    const far = spawnMonster(w, 20, 36, 'goblin');
    const rat = spawnMonster(w, 26, 24, 'field_rat');
    for (const m of [a, b, far, rat]) m.aggroRange = 0;
    a.aggroRange = 6;
    const ev = run(w, 3);
    expect(a.targetId).toBe(p.id);
    expect(b.targetId).toBe(p.id);
    expect(far.targetId).toBeNull();
    expect(rat.targetId).toBeNull();
    expect(ev.filter((e) => e.type === 'call')).toHaveLength(1);
  });

  it('Goblin flieht einmal bei wenig Leben Richtung Heimat und kehrt zurück', () => {
    const { w, p } = setup();
    const g = spawnMonster(w, 24, 20, 'goblin');
    g.home = { x: 34, y: 20 };
    g.targetId = p.id;
    g.hp = Math.floor(g.maxHp * (FLEE_HP - 0.05));
    const ev = run(w, 5);
    expect(ev.filter((e) => e.type === 'flee')).toHaveLength(1);
    expect(g.autoAttack).toBe(false);
    expect(g.x).toBeGreaterThan(24.3);
    run(w, FLEE_TICKS + 5);
    expect(g.autoAttack).toBe(true);
    const again = run(w, TICK_RATE * 5);
    expect(again.filter((e) => e.type === 'flee')).toHaveLength(0);
    expect(g.fled).toBe(true);
  });

  it('Untoter flieht nie, auch nicht mit 1 Leben', () => {
    const { w, p } = setup();
    const s = spawnMonster(w, 22, 20, 'skeleton');
    s.targetId = p.id;
    s.hp = 1;
    const ev = run(w, TICK_RATE * 3);
    expect(ev.some((e) => e.type === 'flee')).toBe(false);
    expect(s.autoAttack).toBe(true);
  });

  it('deterministisch: gleicher Seed, gleicher Ablauf', () => {
    const go = () => {
      const { w, p } = setup();
      const g = spawnMonster(w, 24, 20, 'bandit');
      g.targetId = p.id;
      g.hp = 5;
      run(w, TICK_RATE * 10);
      return [g.x, g.y, g.fled, w.rng.next()];
    };
    expect(go()).toEqual(go());
  });
});
