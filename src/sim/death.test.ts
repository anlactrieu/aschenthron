import { describe, expect, it } from 'vitest';
import type { Grid } from './path';
import { generateItem } from './items';
import { totalXpFor } from './data';
import { deathRules, dropCount } from './death';
import { addPlayer, applyCommand, createWorld, drainEvents, gainXp, spawnMonster, spawnPlayer, tick, TICK_RATE, type Actor, type GameEvent, type World } from './world';

const open = (): Grid => ({ w: 30, h: 30, walkable: new Array(900).fill(true) });
const setup = (level: number) => {
  const w = createWorld(5, open(), [{ x: 0, y: 0, w: 4, h: 4 }]);
  const p = spawnPlayer(w, 1, 1);
  gainXp(w, p, totalXpFor(level));
  return { w, p };
};
/** Spieler stirbt sofort durch einen Schlag */
function kill(w: World, p: Actor): GameEvent | undefined {
  p.x = 15;
  p.y = 15;
  const m = spawnMonster(w, 16, 15, 'ash_king');
  m.damage = [9999, 9999];
  m.targetId = p.id;
  drainEvents(w);
  for (let i = 0; i < TICK_RATE * 3; i++) tick(w);
  return drainEvents(w).find((e) => e.type === 'deathPenalty');
}
const ring = (w: World) => generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');

describe('Todesstrafe nach Stufe (P4)', () => {
  it('Regeltabelle: Neulinge frei, Mitte halb, ab Stufe 11 voll', () => {
    expect(deathRules(1)).toEqual({ xpFrac: 0, goldFrac: 0, itemFrac: 0, itemMax: 0 });
    expect(deathRules(5).goldFrac).toBe(0);
    expect(deathRules(6).xpFrac).toBe(0.05);
    expect(deathRules(10).itemMax).toBe(1);
    expect(deathRules(11)).toMatchObject({ xpFrac: 0.1, goldFrac: 0.1, itemMax: 3 });
    expect(dropCount(deathRules(20), 0)).toBe(0);
    expect(dropCount(deathRules(20), 5)).toBe(1);
    expect(dropCount(deathRules(20), 25)).toBe(3);
    expect(dropCount(deathRules(20), 99)).toBe(3);
    expect(dropCount(deathRules(8), 99)).toBe(1);
    expect(dropCount(deathRules(3), 99)).toBe(0);
  });

  it('Stufe 3: kein Verlust an XP, Gold oder Rucksack', () => {
    const { w, p } = setup(3);
    p.gold = 500;
    for (let i = 0; i < 4; i++) p.inventory.push(ring(w));
    const xp = p.xp;
    const e = kill(w, p);
    expect(e).toMatchObject({ xpLost: 0, goldLost: 0 });
    expect(p.xp).toBe(xp);
    expect(p.gold).toBe(500);
    expect(p.inventory).toHaveLength(4);
    expect(w.ground).toHaveLength(0);
  });

  it('Stufe 12: 10 % der Level-XP und 10 % Gold, nie unter die Schwelle', () => {
    const { w, p } = setup(12);
    gainXp(w, p, 1000);
    p.gold = 555;
    const progress = p.xp - totalXpFor(p.level);
    const lvl = p.level;
    const e = kill(w, p) as Extract<GameEvent, { type: 'deathPenalty' }>;
    expect(e.xpLost).toBe(Math.floor(progress * 0.1));
    expect(e.goldLost).toBe(55);
    expect(p.gold).toBe(500);
    expect(p.level).toBe(lvl);
    expect(p.xp).toBeGreaterThanOrEqual(totalXpFor(lvl));
  });

  it('Ausnahmen: Tränke, Edelsteine, benannte Funde und Unikate fallen nie', () => {
    const { w, p } = setup(15);
    p.inventory.push(generateItem(w.rng, w.nextId++, 'heal_small', 'normal'));
    const named = ring(w);
    named.named = 'n_seidenfessel';
    const uni = ring(w);
    uni.unique = 'x';
    p.inventory.push(named, uni);
    kill(w, p);
    expect(w.ground).toHaveLength(0);
    expect(p.inventory).toHaveLength(3);
  });

  it('Leichenhaufen: nur der Besitzer, 60 s lang', () => {
    const { w, p } = setup(15);
    for (let i = 0; i < 4; i++) p.inventory.push(ring(w));
    kill(w, p);
    expect(w.ground).toHaveLength(1);
    const g = w.ground[0]!;
    expect(g.owner).toBe(p.id);
    const other = addPlayer(w, 'Fremder');
    other.x = g.x;
    other.y = g.y;
    applyCommand(w, other.id, { type: 'pickup', groundId: g.id });
    expect(other.pickupId).toBeNull();
    for (let i = 0; i < TICK_RATE * 61; i++) tick(w);
    applyCommand(w, other.id, { type: 'pickup', groundId: g.id });
    expect(other.pickupId).toBe(g.id);
  });
});
