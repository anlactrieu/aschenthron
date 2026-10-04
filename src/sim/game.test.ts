import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { findPath, type Grid } from './path';
import { generateItem } from './items';
import { totalXpFor } from './data';
import {
  addNpc, applyCommand, buyPrice, createWorld, drainEvents, gainXp, getActor, inSafeZone, maxHpOf,
  nearNpc, spawnMonster, spawnPlayer, tick, TICK_RATE, type World,
} from './world';

const open = (): Grid => ({ w: 20, h: 20, walkable: new Array(400).fill(true) });
const fresh = () => {
  const w = createWorld(5, open(), [{ x: 0, y: 0, w: 4, h: 4 }]);
  const p = spawnPlayer(w, 1, 1);
  return { w, p };
};
const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) tick(w);
};

describe('Charakter und Leveln (M3)', () => {
  it('Stat-Punkte erhöhen Attribute und Werte', () => {
    const { w, p } = fresh();
    const hp0 = maxHpOf(p);
    applyCommand(w, p.id, { type: 'spendStat', attr: 'ausdauer' });
    expect(p.attrs.ausdauer).toBe(11);
    expect(maxHpOf(p)).toBe(hp0 + 5);
    expect(p.statPoints).toBe(9);
  });

  it('XP führen zum Levelaufstieg mit Stat-Punkten', () => {
    const { w, p } = fresh();
    gainXp(w, p, totalXpFor(3));
    expect(p.level).toBe(3);
    expect(p.statPoints).toBe(10 + 10);
    expect(p.hp).toBe(maxHpOf(p));
  });

  it('Lehrer: Skill lernen kostet Gold, braucht Level und Nähe', () => {
    const { w, p } = fresh();
    addNpc(w, 'trainer', 'Lehrer', 2, 2);
    p.gold = 100;
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'power_strike' });
    expect(p.skills).toHaveLength(0); // Level 1 reicht nicht
    gainXp(w, p, totalXpFor(2));
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'power_strike' });
    expect(p.skills).toEqual(['power_strike']);
    expect(p.gold).toBe(50);
    p.x = 15;
    p.y = 15;
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'quick_shot' });
    expect(p.skills).toHaveLength(1);
  });

  it('Skill verbraucht Mana, hat Cooldown und Reichweite', () => {
    const { w, p } = fresh();
    p.skills.push('ember_bolt');
    p.x = 8;
    p.y = 8;
    const m = spawnMonster(w, 12, 8, 'bog_ghoul');
    m.aggroRange = 0;
    const mana0 = p.mana;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
    expect(m.hp).toBeLessThan(m.maxHp);
    expect(p.mana).toBe(mana0 - 10);
    const hp1 = m.hp;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
    expect(m.hp).toBe(hp1); // Cooldown
    const far = spawnMonster(w, 19, 19);
    far.aggroRange = 0;
    p.skillCd = {};
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: far.id });
    expect(far.hp).toBe(far.maxHp);
  });
});

describe('Todesstrafe (M4)', () => {
  it('XP-Verlust ohne Levelverlust, Items fallen, Respawn in der Stadt', () => {
    const { w, p } = fresh();
    gainXp(w, p, totalXpFor(4) + 20);
    const lvl = p.level;
    for (let i = 0; i < 5; i++) p.inventory.push(generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'));
    p.x = 10;
    p.y = 10;
    const m = spawnMonster(w, 11, 10, 'ash_king');
    m.damage = [9999, 9999];
    m.targetId = p.id;
    drainEvents(w);
    run(w, TICK_RATE * 3);
    const ev = drainEvents(w);
    const pen = ev.find((e) => e.type === 'deathPenalty');
    expect(pen).toBeDefined();
    expect(p.level).toBe(lvl);
    expect(p.xp).toBeGreaterThanOrEqual(totalXpFor(lvl));
    expect(w.ground.length).toBeGreaterThanOrEqual(1);
    expect(w.ground.length).toBeLessThanOrEqual(3);
    expect(p.inventory.length + w.ground.length).toBe(5);
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(maxHpOf(p));
    expect(inSafeZone(w, p.x, p.y)).toBe(true);
    // Leichenlauf: Beute liegt an der Todesstelle
    expect(w.ground.every((g) => g.x === 10 && g.y === 10)).toBe(true);
  });

  it('Items am Leichenort verfallen nach 5 Minuten', () => {
    const { w, p } = fresh();
    p.inventory.push(generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'));
    p.x = 10;
    p.y = 10;
    const m = spawnMonster(w, 11, 10, 'ash_king');
    m.damage = [9999, 9999];
    m.targetId = p.id;
    run(w, TICK_RATE * 3);
    expect(w.ground).toHaveLength(1);
    run(w, TICK_RATE * 301);
    expect(w.ground).toHaveLength(0);
  });

  it('Safe-Zone: Monster greifen nicht an, Spieler nimmt keinen Schaden', () => {
    const { w, p } = fresh();
    p.x = 1;
    p.y = 1;
    const m = spawnMonster(w, 2, 2);
    m.targetId = p.id;
    run(w, TICK_RATE * 5);
    expect(p.hp).toBe(maxHpOf(p));
    expect(m.targetId).toBeNull();
  });

  it('Monster respawnt nach Wartezeit', () => {
    const { w, p } = fresh();
    p.damage = [999, 999];
    p.x = 10;
    p.y = 10;
    const m = spawnMonster(w, 12, 10);
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 5);
    expect(m.alive).toBe(false);
    run(w, TICK_RATE * 46);
    expect(m.alive).toBe(true);
    expect(m.hp).toBe(m.maxHp);
  });
});

describe('Hub: Händler und Stash (M5)', () => {
  it('Kaufen, Verkaufen und Lagern nur in Reichweite', () => {
    const { w, p } = fresh();
    addNpc(w, 'merchant', 'H', 2, 2);
    addNpc(w, 'stash', 'T', 3, 2);
    p.gold = 100;
    applyCommand(w, p.id, { type: 'buy', templateId: 'leather_cap' });
    expect(p.inventory).toHaveLength(1);
    expect(p.gold).toBe(100 - buyPrice('leather_cap'));
    const it = p.inventory[0]!;
    applyCommand(w, p.id, { type: 'stashPut', itemId: it.id });
    expect(p.stash).toHaveLength(1);
    expect(p.inventory).toHaveLength(0);
    applyCommand(w, p.id, { type: 'stashTake', itemId: it.id });
    expect(p.inventory).toHaveLength(1);
    const g0 = p.gold;
    applyCommand(w, p.id, { type: 'sell', itemId: it.id });
    expect(p.gold).toBeGreaterThan(g0);
    p.x = 15;
    p.y = 15;
    p.inventory.push(it);
    applyCommand(w, p.id, { type: 'sell', itemId: it.id });
    expect(p.inventory).toHaveLength(1);
    expect(nearNpc(w, p, 'merchant')).toBeUndefined();
  });

  it('Stash übersteht den Tod', () => {
    const { w, p } = fresh();
    p.stash.push(generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'));
    p.x = 10;
    p.y = 10;
    const m = spawnMonster(w, 11, 10, 'ash_king');
    m.damage = [9999, 9999];
    m.targetId = p.id;
    run(w, TICK_RATE * 3);
    expect(p.stash).toHaveLength(1);
  });
});

describe('Welt, Dungeon und Boss (M6)', () => {
  const { world, playerId } = buildWorld(1, mapJson as unknown as TiledMap);
  const p = getActor(world, playerId)!;

  it('Karte enthält Stadt, NPCs, Monster und den Boss', () => {
    expect(inSafeZone(world, p.x, p.y)).toBe(true);
    expect(world.npcs.map((n) => n.kind).sort()).toEqual(['merchant', 'stash', 'trainer']);
    expect(world.actors.some((a) => a.kindId === 'ash_king' && a.boss)).toBe(true);
    expect(world.actors.filter((a) => a.kind === 'monster').length).toBeGreaterThan(30);
  });

  it('alle Monster und der Boss sind von der Stadt aus erreichbar', () => {
    for (const a of world.actors) {
      if (a.kind !== 'monster') continue;
      const path = findPath(world.grid, { x: Math.round(p.x), y: Math.round(p.y) }, { x: a.x, y: a.y });
      expect(path.length, `${a.name} @${a.x},${a.y}`).toBeGreaterThan(0);
    }
  });

  it('Boss wird wütend, lässt garantiert Seltenes fallen', () => {
    const { w, p: pl } = fresh();
    pl.damage = [300, 300];
    pl.x = 10;
    pl.y = 10;
    const boss = spawnMonster(w, 12, 10, 'ash_king');
    boss.damage = [1, 1];
    applyCommand(w, pl.id, { type: 'attack', targetId: boss.id });
    run(w, TICK_RATE * 30);
    const ev = drainEvents(w);
    expect(ev.some((e) => e.type === 'enraged')).toBe(true);
    expect(boss.alive).toBe(false);
    expect(w.ground.some((g) => g.item.rarity === 'rare')).toBe(true);
  });
});

describe('Speichern', () => {
  it('Export/Import erhält Spielerzustand', async () => {
    const { exportPlayer, importPlayer } = await import('./save');
    const a = fresh();
    gainXp(a.w, a.p, totalXpFor(5));
    a.p.inventory.push(generateItem(a.w.rng, a.w.nextId++, 'steel_sword', 'rare'));
    a.p.skills.push('ember_bolt');
    const json = exportPlayer(a.p);
    const b = fresh();
    expect(importPlayer(b.w, b.p, json)).toBe(true);
    expect(b.p.level).toBe(5);
    expect(b.p.inventory[0]!.name).toBe(a.p.inventory[0]!.name);
    expect(b.p.skills).toEqual(['ember_bolt']);
    expect(b.w.nextId).toBeGreaterThan(a.p.inventory[0]!.id);
    expect(importPlayer(b.w, b.p, 'kaputt')).toBe(false);
  });
});

describe('Verfolgung', () => {
  it('Spieler erreicht Monster auch bei Bruchteil-Positionen', () => {
    const { w, p } = fresh();
    p.x = 10;
    p.y = 11.9;
    const m = spawnMonster(w, 11, 10.6, 'grave_rat');
    p.damage = [999, 999];
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 5);
    expect(m.alive).toBe(false);
  });
});

describe('Fernkampf', () => {
  it('Fernkampf-Skill zieht den Helden nicht in den Nahkampf', () => {
    const { w, p } = fresh();
    p.x = 10;
    p.y = 10;
    p.skills.push('quick_shot');
    const m = spawnMonster(w, 14, 10, 'grave_rat');
    m.aggroRange = 0;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'quick_shot', targetId: m.id });
    expect(m.hp).toBeLessThan(m.maxHp);
    run(w, TICK_RATE * 3);
    expect(p.x).toBe(10);
    expect(p.y).toBe(10);
    expect(p.targetId).toBe(m.id);
  });

  it('Nahkampf-Skill löst Verfolgung aus', () => {
    const { w, p } = fresh();
    p.x = 10;
    p.y = 10;
    p.skills.push('power_strike');
    const m = spawnMonster(w, 11, 10, 'grave_rat');
    m.aggroRange = 0;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'power_strike', targetId: m.id });
    run(w, TICK_RATE * 5);
    expect(m.alive).toBe(false);
  });
});

describe('Safe-Zone und Sortiment', () => {
  it('Spieler kann aus der Safe-Zone weder zaubern noch zuschlagen', () => {
    const { w, p } = fresh();
    p.skills.push('ember_bolt');
    p.damage = [999, 999];
    const m = spawnMonster(w, 4, 2, 'grave_rat');
    m.aggroRange = 0;
    p.x = 3;
    p.y = 2;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 2);
    expect(m.hp).toBe(m.maxHp);
  });

  it('Händler verkauft nur sein Sortiment', () => {
    const { w, p } = fresh();
    addNpc(w, 'merchant', 'H', 2, 2);
    p.gold = 9999;
    applyCommand(w, p.id, { type: 'buy', templateId: 'cinder_axe' });
    expect(p.inventory).toHaveLength(0);
  });

  it('Kraft-Bonus des ersetzten Items zählt nicht für die Anforderung', () => {
    const { w, p } = fresh();
    p.attrs.kraft = 12;
    const boost = generateItem(w.rng, w.nextId++, 'bone_club', 'normal');
    boost.affixes.push({ stat: 'kraft', value: 6 });
    p.equipment.weapon = boost;
    const heavy = generateItem(w.rng, w.nextId++, 'steel_sword', 'normal'); // Kraft 15
    p.inventory.push(heavy);
    applyCommand(w, p.id, { type: 'equip', itemId: heavy.id });
    expect(p.equipment.weapon).toBe(boost);
  });
});
