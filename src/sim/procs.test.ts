import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, drainEvents, spawnMonster, spawnPlayer, tick, passiveSum } from './world';
import { generateItem } from './items';
import type { Grid } from './path';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });

/** Spieler (Nahkampf, Rostschwert) kämpft gegen einen Dummy; liefert Treffer und Betäubungen. */
function fight(skills: Record<string, number>, seed = 5) {
  const w = createWorld(seed, open());
  const p = spawnPlayer(w, 10, 10);
  p.maxHp = p.hp = 99999;
  p.attrs.kraft = 40;
  const sword = generateItem(w.rng, w.nextId++, 'rusty_sword', 'normal');
  p.inventory.push(sword);
  applyCommand(w, p.id, { type: 'equip', itemId: sword.id });
  for (const [id, r] of Object.entries(skills)) { p.skills.push(id); p.skillRanks[id] = r; }
  const m = spawnMonster(w, 11, 10, 'field_rat');
  m.maxHp = m.hp = 999999;
  m.damage = [0, 0];
  let hits = 0, stuns = 0;
  const base: number[] = [];
  applyCommand(w, p.id, { type: 'attack', targetId: m.id });
  for (let i = 0; i < 6000; i++) {
    tick(w);
    for (const e of drainEvents(w)) if (e.type === 'hit' && e.attackerId === p.id) { hits++; base.push(e.amount); }
    if (m.status.stun) stuns++;
  }
  base.sort((a, b) => a - b);
  const med = base[Math.floor(base.length / 2)]!;
  const big = base.filter((x) => x > med * 1.5).length;
  return { p, hits, stuns, big };
}

describe('passive Treffer-Procs', () => {
  it('Betäubender Hieb betäubt gelegentlich, ohne den Skill nie', () => {
    expect(fight({}).stuns).toBe(0);
    const r = fight({ stunning_blow: 5 });
    expect(passiveSum(r.p, 'stunProc')).toBe(20);
    expect(r.stuns).toBeGreaterThan(0);
  });
  it('Mächtiger Hieb schlägt gelegentlich deutlich härter zu', () => {
    expect(fight({}).big).toBe(0);
    const r = fight({ mighty_blow: 5 });
    expect(r.hits).toBeGreaterThan(50);
    expect(r.big).toBeGreaterThan(0);
    expect(r.big).toBeLessThan(r.hits * 0.5);
  });
});
