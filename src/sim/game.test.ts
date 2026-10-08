import { describe, expect, it } from 'vitest';
import type { Grid } from './path';
import { generateItem } from './items';
import { skillById, totalXpFor } from './data';
import {
  addNpc, applyCommand, buyPrice, START_GOLD, createWorld, drainEvents, gainXp, inSafeZone, maxHpOf,
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

  it('Startgold reicht für das Bogen-Set samt Schnellschuss oder für Schwert plus Rüstung, aber nicht für beides', () => {
    const bow = buyPrice('hunt_bow') + buyPrice('wood_arrows') + skillById('quick_shot')!.price;
    const melee = buyPrice('rusty_sword') + buyPrice('leather_cap') + buyPrice('worn_gloves') + buyPrice('cloth_boots');
    expect(bow).toBeLessThanOrEqual(START_GOLD);
    expect(melee).toBeLessThanOrEqual(START_GOLD);
    expect(bow + buyPrice('rusty_sword')).toBeGreaterThan(START_GOLD);
    const { w, p } = fresh();
    addNpc(w, 'trainer', 'Lehrer', 2, 2);
    expect(p.gold).toBe(START_GOLD);
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'quick_shot' });
    expect(p.skills).toEqual(['quick_shot']); // schon auf Stufe 1 lernbar
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
    run(w, TICK_RATE * 121);
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
  it('Boss wird wütend, lässt garantiert Seltenes fallen', () => {
    const { w, p: pl } = fresh();
    pl.damage = [300, 300];
    pl.x = 10;
    pl.y = 10;
    const boss = spawnMonster(w, 12, 10, 'bandit_lord');
    boss.damage = [1, 1];
    applyCommand(w, pl.id, { type: 'attack', targetId: boss.id });
    for (let i = 0; i < TICK_RATE * 44 && boss.alive; i++) tick(w);
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
    const m = spawnMonster(w, 11, 10.6, 'field_rat');
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
    for (const id of ['hunt_bow', 'wood_arrows']) {
      const it = generateItem(w.rng, w.nextId++, id, 'normal');
      p.inventory.push(it);
      applyCommand(w, p.id, { type: 'equip', itemId: it.id });
    }
    const m = spawnMonster(w, 14, 10, 'field_rat');
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
    const m = spawnMonster(w, 11, 10, 'field_rat');
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
    const m = spawnMonster(w, 4, 2, 'field_rat');
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

describe('Tränke', () => {
  const potion = (w: World, id: string) => generateItem(w.rng, w.nextId++, id, 'normal');

  it('Heiltrank heilt, Manatrank stellt Mana her, Cooldown und Ablehnung bei vollen Werten', () => {
    const { w, p } = fresh();
    const h = potion(w, 'heal_small');
    const m = potion(w, 'mana_small');
    p.inventory.push(h, m);
    applyCommand(w, p.id, { type: 'usePotion', itemId: h.id });
    expect(p.inventory).toHaveLength(2); // volle LP: nicht verbraucht
    p.hp = 20;
    applyCommand(w, p.id, { type: 'usePotion', itemId: h.id });
    expect(p.hp).toBe(70);
    expect(p.inventory).toHaveLength(1);
    p.mana = 0;
    applyCommand(w, p.id, { type: 'usePotion', itemId: m.id });
    expect(p.mana).toBe(0); // Cooldown läuft
    run(w, 101);
    p.mana = 0;
    applyCommand(w, p.id, { type: 'usePotion', itemId: m.id });
    expect(p.mana).toBe(20); // auf Maximum begrenzt
    expect(p.inventory).toHaveLength(0);
  });

  it('Tränke lassen sich nicht anlegen', () => {
    const { w, p } = fresh();
    const h = potion(w, 'heal_small');
    p.inventory.push(h);
    applyCommand(w, p.id, { type: 'equip', itemId: h.id });
    expect(p.inventory).toHaveLength(1);
    expect(Object.keys(p.equipment)).toHaveLength(0);
  });

  it('Drops: Tränke häufiger als Ausrüstung', () => {
    let gear = 0;
    let potions = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const w = createWorld(seed, open());
      const p = spawnPlayer(w, 10, 10);
      p.damage = [999, 999];
      const m = spawnMonster(w, 11, 10, 'bog_ghoul');
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      run(w, 60);
      for (const g of w.ground) {
        if (g.item.slot === 'potion') potions++;
        else gear++;
      }
    }
    expect(potions).toBeGreaterThan(gear);
    expect(gear / 300).toBeLessThan(0.35);
    expect(potions / 300).toBeGreaterThan(0.2);
  });

  it('Händler verkauft Tränke', () => {
    const { w, p } = fresh();
    addNpc(w, 'merchant', 'H', 2, 2);
    p.gold = 100;
    applyCommand(w, p.id, { type: 'buy', templateId: 'heal_small' });
    expect(p.inventory[0]?.heal).toBe(50);
  });
});

describe('Speichern: Migration', () => {
  it('Position in Wand/außerhalb → Startpunkt, kaputte Teile verworfen, XP an Level angepasst', async () => {
    const { importPlayer } = await import('./save');
    const w = createWorld(1, open());
    w.grid.walkable[5 * 20 + 5] = false;
    const p = spawnPlayer(w, 2, 2);
    const old = JSON.stringify({
      v: 1,
      player: {
        x: 5, y: 5, hp: 50, mana: 5, level: 4, xp: 3, statPoints: 2, gold: 12, maxHp: 130,
        attrs: { kraft: 14 }, skills: ['power_strike', 'gibt_es_nicht'],
        inventory: [{ nope: true }, null], equipment: { weapon: { broken: 1 } }, stash: 'kaputt',
      },
    });
    expect(importPlayer(w, p, old)).toBe(true);
    expect([p.x, p.y]).toEqual([2, 2]);
    expect(p.skills).toEqual(['power_strike']);
    expect(p.inventory).toEqual([]);
    expect(p.stash).toEqual([]);
    expect(p.attrs.kraft).toBe(14);
    expect(p.attrs.verstand).toBe(10);
    expect(p.xp).toBe(totalXpFor(4));
    p.hp = 1;
    const off = JSON.stringify({ v: 1, player: { x: 999, y: -4, level: 1 } });
    expect(importPlayer(w, p, off)).toBe(true);
    expect([p.x, p.y]).toEqual([2, 2]);
  });
});

describe('Speichern: Kartenversion', () => {
  it('alter Spielstand ohne passende Kartenversion startet in der Stadt, gleiche Version behält die Position', async () => {
    const { importPlayer, exportPlayer } = await import('./save');
    const w = createWorld(1, open());
    const p = spawnPlayer(w, 2, 2);
    const old = JSON.stringify({ v: 1, player: { x: 12, y: 13, level: 3 } });
    expect(importPlayer(w, p, old)).toBe(true);
    expect([p.x, p.y]).toEqual([2, 2]);
    expect(p.level).toBe(3);
    p.x = 9;
    p.y = 9;
    const json = exportPlayer(p);
    p.x = 2;
    p.y = 2;
    importPlayer(w, p, json);
    expect([p.x, p.y]).toEqual([9, 9]);
  });
});

describe('Zaubernde Monster', () => {
  it('Schamane schießt aus der Distanz und hält Abstand', () => {
    const { w, p } = fresh();
    p.x = 8;
    p.y = 8;
    const m = spawnMonster(w, 13, 8, 'goblin_shaman');
    m.targetId = p.id;
    const hp0 = p.hp;
    for (let i = 0; i < TICK_RATE * 3; i++) tick(w);
    expect(p.hp).toBeLessThan(hp0);
    expect(Math.hypot(m.x - p.x, m.y - p.y)).toBeGreaterThan(2);
  });
});

describe('Bogenschützen und Todesstrafe', () => {
  it('Normaler Angriff mit Bogen und Pfeilen schießt aus der Distanz, ohne in den Nahkampf zu laufen', () => {
    const { w, p } = fresh();
    p.x = 8;
    p.y = 8;
    const bow = generateItem(w.rng, w.nextId++, 'hunt_bow', 'normal');
    const arrows = generateItem(w.rng, w.nextId++, 'wood_arrows', 'normal');
    p.equipment.weapon = bow;
    p.equipment.offhand = arrows;
    const m = spawnMonster(w, 13, 8, 'bog_ghoul');
    m.aggroRange = 0;
    m.speed = 0;
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 3);
    expect(m.hp).toBeLessThan(m.maxHp);
    expect(Math.hypot(m.x - p.x, m.y - p.y)).toBeGreaterThan(3);
  });

  it('Beim Tod fällt nie etwas Angelegtes', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = createWorld(seed, open(), [{ x: 0, y: 0, w: 4, h: 4 }]);
      const p = spawnPlayer(w, 10, 10);
      const sword = generateItem(w.rng, w.nextId++, 'rusty_sword', 'normal');
      const cap = generateItem(w.rng, w.nextId++, 'leather_cap', 'normal');
      p.equipment.weapon = sword;
      p.equipment.head = cap;
      p.hp = 1;
      const m = spawnMonster(w, 10, 10, 'wolf');
      m.damage = [500, 500];
      m.targetId = p.id;
      run(w, TICK_RATE * 2);
      expect(p.equipment.weapon?.id).toBe(sword.id);
      expect(p.equipment.head?.id).toBe(cap.id);
      expect(w.ground.some((g) => g.item.id === sword.id || g.item.id === cap.id)).toBe(false);
    }
  });
});

describe('Sammelverkauf', () => {
  it('verkauft alles bis zur gewählten Seltenheit, behält Tränke und Seltenere, braucht einen Händler', () => {
    const { w, p } = fresh();
    const mk = (id: string, r: 'normal' | 'magic' | 'rare') => {
      const it = generateItem(w.rng, w.nextId++, id, r);
      p.inventory.push(it);
      return it;
    };
    const a = mk('rusty_sword', 'normal');
    const b = mk('leather_cap', 'magic');
    const c = mk('iron_helm', 'rare');
    const potion = mk('heal_small', 'normal');
    p.inventory = p.inventory.filter((i) => i.slot !== 'potion' || i.id === potion.id);
    applyCommand(w, p.id, { type: 'sellBulk', upTo: 'magic' });
    expect(p.inventory.map((i) => i.id)).toContain(a.id); // kein Händler in der Nähe
    addNpc(w, 'merchant', 'Händler', 2, 2);
    const g0 = p.gold;
    applyCommand(w, p.id, { type: 'sellBulk', upTo: 'magic' });
    const ids = p.inventory.map((i) => i.id);
    expect(ids).not.toContain(a.id);
    expect(ids).not.toContain(b.id);
    expect(ids).toContain(c.id);
    expect(ids).toContain(potion.id);
    expect(p.gold).toBeGreaterThan(g0);
    applyCommand(w, p.id, { type: 'sellBulk', upTo: 'rare' });
    expect(p.inventory.map((i) => i.id)).not.toContain(c.id);
    expect(p.inventory.map((i) => i.id)).toContain(potion.id);
  });
});
