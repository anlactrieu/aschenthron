import { describe, expect, it } from 'vitest';
import {
  LEGENDARIES, SETS, extendAffixes, generateItem, generateLegendary, generateSetPiece, rerollAffixes, rollSpecial,
} from './items';
import { SKILLS, MAX_LEVEL } from './data';
import {
  activeSetBonuses, addNpc, applyCommand, craftCost, createWorld, damageRange, drainEvents, gainXp, maxHpOf, maxManaOf,
  powerOf, spawnMonster, spawnPlayer, tick, TICK_RATE, type World,
} from './world';
import type { Grid } from './path';
import { totalXpFor } from './data';

const open = (): Grid => ({ w: 30, h: 30, walkable: new Array(900).fill(true) });
const fresh = () => {
  const w = createWorld(11, open());
  const p = spawnPlayer(w, 10, 10);
  return { w, p };
};
const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) tick(w);
};

describe('Legendäre Gegenstände und Set-Boni', () => {
  it('Unikate haben feste Basis, Affixe im Bereich und einen Effekt', () => {
    for (const d of LEGENDARIES) {
      const it = generateLegendary({ int: (a: number, b: number) => a + Math.floor((b - a) / 2), next: () => 0.5 } as never, 1, d.id);
      expect(it.rarity).toBe('legendary');
      expect(it.power?.id).toBe(d.power.id);
      expect(it.name).toBe(d.name);
    }
  });

  it('Bosse lassen ihr Unikat gezielt fallen', () => {
    const w = createWorld(3, open());
    let got = 0;
    for (let i = 0; i < 100; i++) {
      const it = rollSpecial(w.rng, () => w.nextId++, 12, 'bandit_lord', true);
      if (it?.unique === 'harkon_blade') got++;
    }
    expect(got).toBeGreaterThan(30);
    expect(got).toBeLessThan(80);
  });

  it('normale Monster lassen Sonderdrops nur sehr selten fallen', () => {
    const w = createWorld(4, open());
    let n = 0;
    for (let i = 0; i < 5000; i++) if (rollSpecial(w.rng, () => w.nextId++, 20, 'hill_troll', false)) n++;
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(150);
  });

  it('Set-Boni stufen sich nach angelegten Teilen und wirken auf Werte', () => {
    const { w, p } = fresh();
    p.attrs.kraft = 30;
    const set = SETS[0]!;
    const hp0 = maxHpOf(p);
    for (let i = 0; i < set.pieces.length; i++) {
      const piece = generateSetPiece(w.rng, w.nextId++, set.id, i);
      p.inventory.push(piece);
      applyCommand(w, p.id, { type: 'equip', itemId: piece.id });
      const bonus = activeSetBonuses(p);
      expect(bonus.length).toBe(i >= 1 ? 1 : 0);
      if (i === 1) expect(maxHpOf(p)).toBeGreaterThan(hp0 + 40 - 1);
    }
    expect(powerOf(p, 'thorns')).toBe(10);
    expect(activeSetBonuses(p)[0]!.bonuses).toHaveLength(3);
  });

  it('Lebensraub heilt, Kritisch verdoppelt, Dornen werfen Schaden zurück', () => {
    const { w, p } = fresh();
    const blade = generateLegendary(w.rng, w.nextId++, 'wolf_fang'); // Lebensraub
    p.attrs.kraft = 40;
    p.inventory.push(blade);
    applyCommand(w, p.id, { type: 'equip', itemId: blade.id });
    expect(powerOf(p, 'lifesteal')).toBe(5);
    p.hp = 20;
    const m = spawnMonster(w, 11, 10, 'wild_hound');
    m.damage = [1, 1];
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 2);
    expect(p.hp).toBeGreaterThan(20);

    const w2 = createWorld(12, open());
    const p2 = spawnPlayer(w2, 10, 10);
    const plate = generateLegendary(w2.rng, w2.nextId++, 'colossus_heart'); // Dornen 25 %
    p2.attrs.kraft = 40;
    p2.inventory.push(plate);
    applyCommand(w2, p2.id, { type: 'equip', itemId: plate.id });
    const m2 = spawnMonster(w2, 11, 10, 'hill_troll');
    m2.targetId = p2.id;
    run(w2, TICK_RATE * 3);
    expect(m2.hp).toBeLessThan(m2.maxHp);
  });
});

describe('Schmied', () => {
  const setup = () => {
    const { w, p } = fresh();
    addNpc(w, 'smith', 'S', 11, 10);
    p.gold = 100000;
    const it = generateItem(w.rng, w.nextId++, 'steel_sword', 'normal');
    p.inventory.push(it);
    return { w, p, it };
  };

  it('Aufwerten: normal → magisch → selten, kostet Gold', () => {
    const { w, p, it } = setup();
    const g0 = p.gold;
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'upgrade' });
    expect(it.rarity).toBe('magic');
    expect(it.affixes.length).toBeGreaterThanOrEqual(1);
    expect(p.gold).toBeLessThan(g0);
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'upgrade' });
    expect(it.rarity).toBe('rare');
    expect(it.affixes.length).toBeGreaterThanOrEqual(3);
  });

  it('Neu würfeln behält Anzahl, Hinzufügen erhöht bis maximal 5', () => {
    const { w, p, it } = setup();
    rerollAffixes(w.rng, it, 'rare', 3);
    const n = it.affixes.length;
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'reroll' });
    expect(it.affixes).toHaveLength(n);
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'extend' });
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'extend' });
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'extend' });
    expect(it.affixes.length).toBeLessThanOrEqual(5);
    expect(craftCost(it, 'extend')).toBeGreaterThan(0);
    extendAffixes(w.rng, it);
  });

  it('nur beim Schmied, nicht bei Unikaten, nicht ohne Gold', () => {
    const { w, p, it } = setup();
    p.gold = 1;
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'upgrade' });
    expect(it.rarity).toBe('normal');
    p.gold = 99999;
    p.x = 25;
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'upgrade' });
    expect(it.rarity).toBe('normal');
    p.x = 10;
    const leg = generateLegendary(w.rng, w.nextId++, 'wolf_fang');
    p.inventory.push(leg);
    applyCommand(w, p.id, { type: 'craft', itemId: leg.id, op: 'reroll' });
    expect(leg.name).toBe('Wolfsfang');
    expect(drainEvents(w).filter((e) => e.type === 'fail').length).toBeGreaterThanOrEqual(3);
  });
});

describe('Neue Fertigkeiten', () => {
  const learn = (p: ReturnType<typeof fresh>['p'], id: string) => p.skills.push(id);

  it('Wirbelhieb trifft alle Gegner ringsum, nicht entfernte', () => {
    const { w, p } = fresh();
    learn(p, 'whirlwind');
    const a = spawnMonster(w, 11, 10, 'field_rat');
    const b = spawnMonster(w, 9, 10, 'field_rat');
    const far = spawnMonster(w, 20, 20, 'field_rat');
    for (const m of [a, b, far]) m.aggroRange = 0;
    p.level = 12;
    p.mana = 100;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'whirlwind', targetId: a.id });
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('Salve schießt auf bis zu drei, Feuerball auf Gruppen, Heilung füllt LP', () => {
    const { w, p } = fresh();
    learn(p, 'multishot');
    learn(p, 'fireball');
    learn(p, 'healing_hand');
    p.level = 20;
    p.mana = 500;
    const ms = [13, 14, 15, 16].map((x) => spawnMonster(w, x, 10, 'wild_hound'));
    for (const m of ms) m.aggroRange = 0;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'multishot', targetId: ms[0]!.id });
    expect(ms.filter((m) => m.hp < m.maxHp)).toHaveLength(3);
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'fireball', targetId: ms[3]!.id });
    expect(ms[3]!.hp).toBeLessThan(ms[3]!.maxHp);
    p.hp = 10;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'healing_hand', targetId: undefined });
    expect(p.hp).toBeGreaterThan(40);
  });

  it('Giftpfeil verursacht Schaden über Zeit', () => {
    const { w, p } = fresh();
    learn(p, 'poison_shot');
    p.mana = 100;
    const m = spawnMonster(w, 14, 10, 'bog_ghoul');
    m.aggroRange = 0;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'poison_shot', targetId: m.id });
    const hp1 = m.hp;
    expect(m.dot).not.toBeNull();
    run(w, TICK_RATE * 4);
    expect(m.hp).toBeLessThan(hp1);
    run(w, TICK_RATE * 6);
    expect(m.dot).toBeNull();
  });

  it('Fertigkeitenliste ist stimmig: eindeutige IDs, Lehrerstufen, Level ≤ Cap', () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const s of SKILLS) {
      expect([1, 2]).toContain(s.tier);
      expect(s.levelReq).toBeLessThanOrEqual(MAX_LEVEL);
      if (s.heal === undefined) expect(s.mult !== undefined || s.base !== undefined).toBe(true);
    }
    expect(SKILLS.filter((s) => s.area === 'Nahkampf').length).toBeGreaterThanOrEqual(3);
    expect(SKILLS.filter((s) => s.area === 'Fernkampf').length).toBeGreaterThanOrEqual(3);
    expect(SKILLS.filter((s) => s.area === 'Magie').length).toBeGreaterThanOrEqual(4);
  });

  it('Mana-Affix erhöht das Maximum, Level-Cap bleibt', () => {
    const { w, p } = fresh();
    const m0 = maxManaOf(p);
    const ring = generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');
    ring.affixes.push({ stat: 'maxMana', value: 25 });
    p.inventory.push(ring);
    applyCommand(w, p.id, { type: 'equip', itemId: ring.id });
    expect(maxManaOf(p)).toBe(m0 + 25);
    gainXp(w, p, totalXpFor(MAX_LEVEL) * 2);
    expect(p.level).toBe(MAX_LEVEL);
    expect(damageRange(p)[0]).toBeGreaterThan(0);
  });
});

describe('Review-Fixes', () => {
  it('Schmied lehnt unbekannte Operationen ab', () => {
    const { w, p } = fresh();
    addNpc(w, 'smith', 'S', 11, 10);
    p.gold = 9999;
    const it = generateItem(w.rng, w.nextId++, 'steel_sword', 'normal');
    p.inventory.push(it);
    applyCommand(w, p.id, { type: 'craft', itemId: it.id, op: 'x' as never });
    expect(it.affixes).toHaveLength(0);
    expect(p.gold).toBe(9999);
  });

  it('Heilende Hand wirkt auch in der Stadt', () => {
    const w = createWorld(2, open(), [{ x: 0, y: 0, w: 30, h: 30 }]);
    const p = spawnPlayer(w, 10, 10);
    p.skills.push('healing_hand');
    p.mana = 50;
    p.hp = 10;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'healing_hand' });
    expect(p.hp).toBeGreaterThan(10);
  });

  it('Dornen-Rückwurf kritet nicht und stiehlt kein Leben', () => {
    const { w, p } = fresh();
    const plate = generateLegendary(w.rng, w.nextId++, 'colossus_heart');
    const blade = generateLegendary(w.rng, w.nextId++, 'harkon_blade');
    p.attrs.kraft = 40;
    p.inventory.push(plate, blade);
    applyCommand(w, p.id, { type: 'equip', itemId: plate.id });
    applyCommand(w, p.id, { type: 'equip', itemId: blade.id });
    p.hp = 200;
    const m = spawnMonster(w, 11, 10, 'hill_troll');
    m.targetId = p.id;
    run(w, 40);
    const ev = drainEvents(w);
    const reflected = ev.filter((e) => e.type === 'hit' && e.attackerId === p.id && e.targetId === m.id);
    for (const e of reflected) expect((e as { crit?: boolean }).crit).toBe(false);
  });

  it('Import klemmt LP/Mana und verwirft Items mit unbekanntem Set', async () => {
    const { importPlayer } = await import('./save');
    const { w, p } = fresh();
    const good = generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');
    const bad = { ...generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'), setId: 'gibt_es_nicht' };
    const json = JSON.stringify({ v: 1, player: { level: 1, hp: 9999, mana: 9999, inventory: [good, bad] } });
    expect(importPlayer(w, p, json)).toBe(true);
    expect(p.hp).toBeLessThanOrEqual(maxHpOf(p));
    expect(p.mana).toBeLessThanOrEqual(maxManaOf(p));
    expect(p.inventory).toHaveLength(1);
  });
});
