import { describe, expect, it } from 'vitest';
import { generateItem } from './items';
import { SLOW_FACTOR } from './data';
import {
  applyCommand, applyStatus, attackCooldownOf, createWorld, drainEvents, resistOf, spawnMonster, spawnPlayer, tick, TICK_RATE, type Actor, type World,
} from './world';
import type { Grid } from './path';
import { actorFromLite, makeSnapshot } from './net';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });
const fresh = () => {
  const w = createWorld(11, open());
  const p = spawnPlayer(w, 10, 10);
  p.maxHp = p.hp = 100000;
  return { w, p };
};
const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) tick(w);
};
const armBow = (w: World, p: Actor) => {
  for (const id of ['hunt_bow', 'wood_arrows']) {
    const it = generateItem(w.rng, w.nextId++, id, 'normal');
    p.inventory.push(it);
    applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  }
};
/** Wirkt `skill` n-mal auf einen ruhenden Gegner und liefert die Treffer-Ereignisse. */
function cast(w: World, p: Actor, skill: string, kind: string, n: number) {
  p.skills.push(skill);
  const m = spawnMonster(w, 14, 10, kind);
  m.aggroRange = 0;
  m.maxHp = m.hp = 1e9;
  const hits: { amount: number; dt?: string }[] = [];
  for (let i = 0; i < n; i++) {
    p.mana = 1e6;
    p.skillCd = {};
    applyCommand(w, p.id, { type: 'useSkill', skillId: skill, targetId: m.id });
    for (const e of drainEvents(w)) if (e.type === 'hit' && e.targetId === m.id && e.skill === skill) hits.push({ amount: e.amount, dt: e.dt });
  }
  return { m, hits };
}
const sum = (h: { amount: number }[]) => h.reduce((s, x) => s + x.amount, 0);

describe('Schadensarten und Resistenzen', () => {
  it('Feuer trifft Untote härter (+40 %) als Bestien, Dämonen weniger', () => {
    const mean = (kind: string) => {
      const { w, p } = fresh();
      return sum(cast(w, p, 'ember_bolt', kind, 80).hits) / 80;
    };
    const wolf = mean('wolf');
    expect(mean('skeleton') / wolf).toBeGreaterThan(1.3);
    expect(mean('skeleton') / wolf).toBeLessThan(1.5);
    expect(mean('imp') / wolf).toBeLessThan(0.5);
  });

  it('Hit-Ereignis trägt die Schadensart; Gift gegen Golems ist wirkungslos (0, kein Gift-DoT)', () => {
    const { w, p } = fresh();
    armBow(w, p);
    const { m, hits } = cast(w, p, 'poison_shot', 'stone_golem', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.dt === 'poison' && h.amount === 0)).toBe(true);
    expect(m.dot).toBeNull();
    const { w: w2, p: p2 } = fresh();
    armBow(w2, p2);
    const r = cast(w2, p2, 'poison_shot', 'wolf', 1);
    expect(r.hits[0]!.amount).toBeGreaterThan(0);
    expect(r.m.dot).not.toBeNull();
  });

  it('Spielerresistenz aus Affixen, gedeckelt bei 75 %', () => {
    const { w, p } = fresh();
    const ring = generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');
    ring.affixes.push({ stat: 'resFire', value: 40 });
    p.inventory.push(ring);
    applyCommand(w, p.id, { type: 'equip', itemId: ring.id });
    expect(resistOf(p, 'fire')).toBe(40);
    ring.affixes.push({ stat: 'resFire', value: 90 });
    expect(resistOf(p, 'fire')).toBe(75);
    expect(resistOf(p, 'frost')).toBe(0);
    expect(resistOf(p, 'physical')).toBe(0);
  });

  it('Feuriger Champion verursacht Feuerschaden; Feuerresistenz mindert Schaden und Brand-Dauer', () => {
    const lastHit = (res: number) => {
      const { w, p } = fresh();
      if (res) {
        const ring = generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');
        ring.affixes.push({ stat: 'resFire', value: res });
        p.equipment.ring = ring;
      }
      p.x = 12;
      const m = spawnMonster(w, 13, 10, 'wolf', { champ: 'fiery' });
      m.targetId = p.id;
      let hit: { amount: number; dt?: string } | undefined;
      for (let i = 0; i < 80 && !hit; i++) {
        tick(w);
        for (const e of drainEvents(w)) if (e.type === 'hit' && e.targetId === p.id) hit = e;
      }
      return { hit, p, w };
    };
    const a = lastHit(0);
    expect(a.hit?.dt).toBe('fire');
    expect(a.p.status.burn! - a.w.tick).toBeGreaterThan(TICK_RATE * 3);
    const b = lastHit(50);
    expect(b.p.status.burn! - b.w.tick).toBeLessThan(TICK_RATE * 2.5);
  });
});

describe('Statuseffekte', () => {
  it('Frostnova verlangsamt (Tempo und Angriffstempo), Status läuft ab', () => {
    const { w, p } = fresh();
    p.skills.push('frost_nova');
    const m = spawnMonster(w, 11, 10, 'wolf');
    m.aggroRange = 0;
    m.maxHp = m.hp = 1e6;
    const cd0 = attackCooldownOf(m);
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'frost_nova' });
    expect(m.status.slow).toBeGreaterThan(w.tick);
    expect(attackCooldownOf(m)).toBeGreaterThan(cd0);
    m.targetId = p.id;
    p.x = 20;
    const x0 = m.x;
    run(w, 10);
    const slowed = m.x - x0;
    run(w, TICK_RATE * 5);
    expect(m.status.slow).toBeUndefined();
    const x1 = m.x;
    p.x = 30;
    p.y = 10;
    m.x = x0;
    run(w, 10);
    expect(m.x - x0).toBeGreaterThan(slowed / SLOW_FACTOR - 0.01);
    expect(x1).toBeGreaterThan(x0);
  });

  it('Betäubung: keine Aktion; Bosse nur halb so lange', () => {
    const { w, p } = fresh();
    const m = spawnMonster(w, 11, 10, 'wolf');
    m.targetId = p.id;
    applyStatus(w, m, 'stun', 2, 'physical');
    const hp0 = p.hp;
    run(w, TICK_RATE * 2 - 2);
    expect(p.hp).toBe(hp0);
    expect(m.x).toBe(11);
    const boss = spawnMonster(w, 20, 20, 'goblin_king');
    applyStatus(w, boss, 'stun', 2, 'physical');
    expect(boss.status.stun! - w.tick).toBe(TICK_RATE);
    // betäubter Spieler kann keine Fertigkeit nutzen
    p.skills.push('power_strike');
    applyStatus(w, p, 'stun', 1, 'physical');
    p.mana = 100;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'power_strike', targetId: m.id });
    expect(p.skillCd['power_strike'] ?? 0).toBe(0);
  });

  it('Wuchtschlag betäubt das Ziel', () => {
    const { w, p } = fresh();
    p.x = 13.5;
    const { m } = cast(w, p, 'power_strike', 'wolf', 1);
    expect(m.status.stun).toBeGreaterThan(w.tick);
  });

  it('Feuerball setzt in Brand: Brand tickt als Feuerschaden und endet', () => {
    const { w, p } = fresh();
    const { m } = cast(w, p, 'fireball', 'wolf', 1);
    expect(m.status.burn).toBeGreaterThan(w.tick);
    drainEvents(w);
    const hp0 = m.hp;
    run(w, TICK_RATE * 4);
    expect(m.hp).toBeLessThan(hp0);
    const burns = drainEvents(w).filter((e) => e.type === 'hit' && e.skill === 'burn');
    expect(burns.length).toBeGreaterThan(0);
    expect(burns.every((e) => e.type === 'hit' && e.dt === 'fire')).toBe(true);
    expect(m.status.burn).toBeUndefined();
    expect(m.burn).toBeNull();
  });

  it('Giftspinne vergiftet und verlangsamt den Spieler; Tod löscht Status', () => {
    const { w, p } = fresh();
    p.x = 12;
    const s = spawnMonster(w, 13, 10, 'venom_spider');
    s.targetId = p.id;
    run(w, 60);
    expect(p.status.slow).toBeGreaterThan(0);
    expect(p.dot).not.toBeNull();
    s.cooldownLeft = 9999;
    p.hp = 1;
    p.dot = { perSec: 50, until: w.tick + 100, srcId: s.id };
    run(w, 25);
    expect(p.status).toEqual({});
    expect(p.dot).toBeNull();
  });
});

describe('Monster-Rollen', () => {
  it('Goblinschamane heilt verletzte Verbündete im Radius um 12 %', () => {
    const { w, p } = fresh();
    p.x = 16;
    const sh = spawnMonster(w, 13, 10, 'goblin_shaman');
    sh.targetId = p.id;
    const ally = spawnMonster(w, 12, 11, 'wolf');
    ally.aggroRange = 0;
    ally.hp = ally.maxHp * 0.4;
    const far = spawnMonster(w, 30, 30, 'wolf');
    far.hp = far.maxHp * 0.4;
    run(w, 3);
    expect(ally.hp / ally.maxHp).toBeGreaterThan(0.515);
    expect(ally.hp / ally.maxHp).toBeLessThan(0.53);
    expect(far.hp / far.maxHp).toBeLessThan(0.41);
    const evs = drainEvents(w);
    expect(evs.some((e) => e.type === 'mheal' && e.targetId === ally.id)).toBe(true);
    // nur alle ~4 s
    run(w, TICK_RATE * 2);
    expect(drainEvents(w).filter((e) => e.type === 'mheal')).toHaveLength(0);
    run(w, TICK_RATE * 3);
    expect(drainEvents(w).filter((e) => e.type === 'mheal')).toHaveLength(1);
  });

  it('Schützen schießen aus Distanz und halten Abstand', () => {
    const { w, p } = fresh();
    p.x = 16;
    const a = spawnMonster(w, 10, 10, 'bandit_archer');
    a.targetId = p.id;
    const hp0 = p.hp;
    let minD = 99;
    const skills: (string | undefined)[] = [];
    for (let i = 0; i < 200; i++) {
      tick(w);
      minD = Math.min(minD, Math.hypot(a.x - p.x, a.y - p.y));
      for (const e of drainEvents(w)) if (e.type === 'hit' && e.attackerId === a.id) skills.push(e.skill);
    }
    expect(p.hp).toBeLessThan(hp0);
    expect(skills.length).toBeGreaterThan(2);
    expect(skills.every((s) => s === 'quick_shot')).toBe(true);
    expect(minD).toBeGreaterThan(3);
  });

  it('Totenbeschwörer ruft alle 12 s Skelette (höchstens 3), die keine Beute geben; Tod entlässt sie', () => {
    const { w, p } = fresh();
    p.x = 16;
    const n = spawnMonster(w, 13, 10, 'necromancer');
    n.targetId = p.id;
    n.maxHp = n.hp = 1e9;
    p.maxHp = p.hp = 1e9;
    run(w, 3);
    const minions = () => w.actors.filter((a) => a.summonedBy === n.id && a.alive);
    expect(minions()).toHaveLength(1);
    run(w, TICK_RATE * 12 + 2);
    expect(minions()).toHaveLength(2);
    run(w, TICK_RATE * 60);
    expect(minions().length).toBeLessThanOrEqual(3);
    expect(minions().length).toBeGreaterThanOrEqual(1);
    const xp0 = p.xp;
    const gold0 = p.gold;
    const sk = minions()[0]!;
    sk.hp = 1;
    p.skills.push('ember_bolt');
    p.mana = 1000;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: sk.id });
    expect(sk.alive).toBe(false);
    expect(w.ground.length).toBe(0);
    expect(p.xp).toBe(xp0);
    expect(p.gold).toBe(gold0);
  });

  it('Tod des Beschwörers entlässt seine Helfer', () => {
    const { w, p } = fresh();
    p.x = 16;
    p.damage = [100000, 100000];
    const n = spawnMonster(w, 13, 10, 'necromancer');
    n.targetId = p.id;
    run(w, 3);
    expect(w.actors.some((a) => a.summonedBy === n.id && a.alive)).toBe(true);
    p.skills.push('ember_bolt');
    p.mana = 1000;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: n.id });
    n.hp = 1;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: n.id });
    p.skillCd = {};
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: n.id });
    expect(n.alive).toBe(false);
    expect(w.actors.filter((a) => a.summonedBy === n.id && a.alive)).toHaveLength(0);
  });
});

describe('Netz', () => {
  it('Schnappschuss trägt Status, Hit-Art und Heilungs-Ereignis; Client baut Status wieder auf', () => {
    const { w, p } = fresh();
    const m = spawnMonster(w, 14, 10, 'wolf');
    applyStatus(w, m, 'slow', 3, 'frost');
    m.dot = { perSec: 1, until: w.tick + 100, srcId: p.id };
    const evs = [
      { type: 'hit', attackerId: p.id, targetId: m.id, amount: 5, skill: 'ember_bolt', dt: 'fire' },
      { type: 'mheal', id: m.id, targetId: m.id, amount: 3 },
      { type: 'mheal', id: m.id, targetId: 9999, amount: 3 },
    ] as const;
    const snap = makeSnapshot(w, p, [...evs]);
    expect(snap.events.map((e) => e.type)).toEqual(['hit', 'mheal']);
    expect(snap.events[0]).toMatchObject({ dt: 'fire' });
    const lite = snap.actors.find((a) => a.id === m.id)!;
    expect(lite.st).toEqual(['slow', 'poison']);
    const back = actorFromLite(lite, w.tick);
    expect(back.status.slow).toBeGreaterThan(w.tick);
    expect(back.dot).not.toBeNull();
    expect(snap.actors.find((a) => a.id === m.id)).toBeDefined();
  });
});
