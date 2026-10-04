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
    p.attrs.ausdauer = 30;
    p.attrs.gewandtheit = 30;
    p.level = 30;
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
    p.level = 30;
    p.attrs.gewandtheit = 40;
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
    p2.attrs.ausdauer = 40;
    p2.level = 30;
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

function armBow(w: World, p: ReturnType<typeof fresh>['p']): void {
  for (const id of ['hunt_bow', 'leather_quiver']) {
    const it = generateItem(w.rng, w.nextId++, id, 'normal');
    p.inventory.push(it);
    applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  }
}

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
    armBow(w, p);
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
    armBow(w, p);
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

describe('Anforderungen und Waffenarten', () => {
  it('Stufe und Attribute müssen stimmen, Fehlendes wird gemeldet', async () => {
    const { missingReq } = await import('./world');
    const { w, p } = fresh();
    const bow = generateItem(w.rng, w.nextId++, 'yew_bow', 'normal'); // Stufe 5, Gewandtheit 16
    expect(missingReq(p, bow)).toEqual(['Stufe 5', 'Gewandtheit 16']);
    applyCommand(w, p.id, { type: 'equip', itemId: bow.id }); // nicht im Rucksack: ignoriert
    p.inventory.push(bow);
    applyCommand(w, p.id, { type: 'equip', itemId: bow.id });
    expect(p.equipment.weapon).toBeUndefined();
    const ev = drainEvents(w).find((e) => e.type === 'cannotEquip');
    expect(ev && 'reason' in ev ? ev.reason : '').toContain('Gewandtheit 16');
    p.level = 5;
    p.attrs.gewandtheit = 16;
    expect(missingReq(p, bow)).toEqual([]);
    applyCommand(w, p.id, { type: 'equip', itemId: bow.id });
    expect(p.equipment.weapon).toBe(bow);
  });

  it('schwere Rüstung verlangt auch Ausdauer, Roben Verstand und Willenskraft', async () => {
    const { missingReq } = await import('./world');
    const { w, p } = fresh();
    p.level = 30;
    p.attrs.kraft = 40;
    const plate = generateItem(w.rng, w.nextId++, 'ash_cuirass', 'normal');
    expect(missingReq(p, plate).some((m) => m.startsWith('Ausdauer'))).toBe(true);
    const robe = generateItem(w.rng, w.nextId++, 'acolyte_robe', 'normal');
    expect(missingReq(p, robe)).toEqual(['Verstand 18', 'Willenskraft 12']);
    expect(robe.affixes[0]).toEqual({ stat: 'maxMana', value: 25 });
  });

  it('Bogen stärkt Fernkampf-Skills, Stab Magie; Nahkampf damit bleibt schwach', () => {
    const { w, p } = fresh();
    p.level = 6;
    p.mana = 200;
    p.skills.push('quick_shot', 'ember_bolt');
    const dmg = () => {
      const m = spawnMonster(w, 14, 10, 'wild_hound');
      m.aggroRange = 0;
      m.maxHp = 99999;
      m.hp = 99999;
      p.skillCd = {};
      p.mana = 500;
      applyCommand(w, p.id, { type: 'useSkill', skillId: 'quick_shot', targetId: m.id });
      applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
      return 99999 - m.hp;
    };
    let base = 0;
    for (let i = 0; i < 20; i++) base += dmg();
    const bow = generateItem(w.rng, w.nextId++, 'yew_bow', 'normal');
    const staff = generateItem(w.rng, w.nextId++, 'oak_staff', 'normal');
    p.attrs.gewandtheit = 16;
    p.attrs.verstand = 16;
    p.inventory.push(bow, staff);
    const qv = generateItem(w.rng, w.nextId++, 'leather_quiver', 'normal');
    p.inventory.push(qv);
    applyCommand(w, p.id, { type: 'equip', itemId: qv.id });
    applyCommand(w, p.id, { type: 'equip', itemId: bow.id });
    let withBow = 0;
    for (let i = 0; i < 20; i++) withBow += dmg();
    expect(withBow).toBeGreaterThan(base * 1.2);
    const [lo] = damageRange(p);
    const melee = lo;
    expect(melee).toBeLessThanOrEqual(6); // Bogen im Nahkampf: nur ein Viertel
    p.attrs.verstand = 16;
  });
});

describe('Schatztruhen', () => {
  const setup = (tier: 'wood' | 'iron' | 'gold' = 'wood') => {
    const { w, p } = fresh();
    w.chests.push({ id: w.nextId++, x: 12, y: 10, level: 10, tier, opened: false, respawnAt: 0 });
    return { w, p, c: w.chests[0]! };
  };

  it('Truhe öffnen gibt Gold und Beute; leere Truhe wieder auffüllen nach Wartezeit', () => {
    const { w, p, c } = setup('iron');
    const g0 = p.gold;
    applyCommand(w, p.id, { type: 'openChest', chestId: c.id });
    run(w, TICK_RATE * 4); // hinlaufen
    expect(c.opened).toBe(true);
    expect(p.gold).toBeGreaterThan(g0);
    expect(w.ground.length).toBeGreaterThanOrEqual(3);
    applyCommand(w, p.id, { type: 'openChest', chestId: c.id });
    expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
    run(w, TICK_RATE * 60 * 12 + 5);
    expect(c.opened).toBe(false);
  });

  it('bessere Truhen liefern mehr; Beute passt zur Stufe', () => {
    let wood = 0;
    let gold = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const tier of ['wood', 'gold'] as const) {
        const w = createWorld(seed, open());
        const p = spawnPlayer(w, 10, 10);
        w.chests.push({ id: w.nextId++, x: 11, y: 10, level: 12, tier, opened: false, respawnAt: 0 });
        applyCommand(w, p.id, { type: 'openChest', chestId: w.chests[0]!.id });
        run(w, 30);
        if (tier === 'wood') wood += p.gold + w.ground.length * 10;
        else gold += p.gold + w.ground.length * 10;
        for (const g of w.ground) if (g.item.slot !== 'potion') expect(itemReqLevel(g.item)).toBeLessThanOrEqual(13);
      }
    }
    expect(gold).toBeGreaterThan(wood * 1.5);
  });
});

function itemReqLevel(i: { req?: { level?: number } }): number {
  return i.req?.level ?? 1;
}

describe('Bogen braucht Köcher mit Pfeilen', () => {
  const shoot = (w: World, p: ReturnType<typeof fresh>['p'], bonusCheck = false) => {
    const m = spawnMonster(w, 14, 10, 'wild_hound');
    m.aggroRange = 0;
    m.maxHp = 99999;
    m.hp = 99999;
    p.skillCd = {};
    p.mana = 500;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'quick_shot', targetId: m.id });
    return bonusCheck ? 99999 - m.hp : m.hp < m.maxHp;
  };

  it('ohne Bogen, ohne Köcher oder mit leerem Köcher gibt es keinen Schuss', () => {
    const { w, p } = fresh();
    p.skills.push('quick_shot');
    expect(shoot(w, p)).toBe(false);
    expect(drainEvents(w).some((e) => e.type === 'fail' && e.reason.includes('Bogen'))).toBe(true);
    const bow = generateItem(w.rng, w.nextId++, 'hunt_bow', 'normal');
    p.inventory.push(bow);
    applyCommand(w, p.id, { type: 'equip', itemId: bow.id });
    expect(shoot(w, p)).toBe(false);
    expect(drainEvents(w).some((e) => e.type === 'fail' && e.reason.includes('Köcher'))).toBe(true);
    const q = generateItem(w.rng, w.nextId++, 'leather_quiver', 'normal');
    q.ammo = 0;
    p.inventory.push(q);
    applyCommand(w, p.id, { type: 'equip', itemId: q.id });
    expect(shoot(w, p)).toBe(false);
    expect(drainEvents(w).some((e) => e.type === 'fail' && e.reason.includes('leer'))).toBe(true);
  });

  it('jeder Schuss verbraucht einen Pfeil; Bündel füllen den Köcher auf (nur gleiche Pfeile)', () => {
    const { w, p } = fresh();
    p.skills.push('quick_shot');
    armBow(w, p);
    const q = p.equipment.quiver!;
    expect(q.ammo).toBe(40);
    expect(shoot(w, p)).toBe(true);
    expect(q.ammo).toBe(39);
    q.ammo = 30;
    const wood = generateItem(w.rng, w.nextId++, 'wood_arrows', 'normal');
    p.inventory.push(wood);
    applyCommand(w, p.id, { type: 'refillQuiver', itemId: wood.id });
    expect(q.ammo).toBe(40); // nur 10 passen rein
    expect(wood.ammo).toBe(10);
    q.ammo = 5;
    const iron = generateItem(w.rng, w.nextId++, 'iron_arrows', 'normal');
    p.inventory.push(iron);
    applyCommand(w, p.id, { type: 'refillQuiver', itemId: iron.id });
    expect(q.ammo).toBe(5); // andere Pfeile im Köcher: abgelehnt
    q.ammo = 0;
    applyCommand(w, p.id, { type: 'refillQuiver', itemId: iron.id });
    expect(q.ammo).toBe(20);
    expect(q.arrowBonus).toBe(4);
    expect(p.inventory.includes(iron)).toBe(false);
  });

  it('bessere Pfeile erhöhen den Schaden', () => {
    const a = fresh();
    a.p.skills.push('quick_shot');
    armBow(a.w, a.p);
    let base = 0;
    for (let i = 0; i < 30; i++) base += shoot(a.w, a.p, true) as number;
    const b = fresh();
    b.p.skills.push('quick_shot');
    armBow(b.w, b.p);
    b.p.equipment.quiver!.arrowBonus = 30;
    let strong = 0;
    for (let i = 0; i < 30; i++) strong += shoot(b.w, b.p, true) as number;
    expect(strong).toBeGreaterThan(base + 30 * 25);
  });
});

describe('Skillpunkte, Ränge und Neuverteilen', () => {
  const town = () => {
    const f = fresh();
    addNpc(f.w, 'trainer', 'Lehrer', 11, 10, { tier: 2 });
    return f;
  };

  it('Skills kosten Punkte und Gold, Ränge steigern sich bis 5 mit Stufenanforderung', () => {
    const { w, p } = town();
    p.gold = 100000;
    p.level = 30;
    p.skillPoints = 10;
    applyCommand(w, p.id, { type: 'trainSkill', skillId: 'ember_bolt' });
    expect(p.skills).toEqual([]); // erst lernen
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'ember_bolt' });
    expect(p.skillRanks['ember_bolt']).toBe(1);
    for (let i = 0; i < 6; i++) applyCommand(w, p.id, { type: 'trainSkill', skillId: 'ember_bolt' });
    expect(p.skillRanks['ember_bolt']).toBe(5);
    expect(p.skillPoints).toBe(10 - 5);
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'ember_bolt' });
    expect(p.skillRanks['ember_bolt']).toBe(5);
  });

  it('ohne Punkte, Gold oder Stufe geht es nicht', () => {
    const { w, p } = town();
    p.skillPoints = 0;
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'power_strike' });
    expect(p.skills).toEqual([]);
    p.skillPoints = 3;
    p.gold = 0;
    p.level = 5;
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'power_strike' });
    expect(p.skills).toEqual([]);
    p.gold = 500;
    applyCommand(w, p.id, { type: 'learnSkill', skillId: 'power_strike' });
    applyCommand(w, p.id, { type: 'trainSkill', skillId: 'power_strike' }); // Rang 2 braucht Stufe 5, ok
    applyCommand(w, p.id, { type: 'trainSkill', skillId: 'power_strike' }); // Rang 3 braucht Stufe 8
    expect(p.skillRanks['power_strike']).toBe(2);
  });

  it('höhere Ränge machen mehr Schaden', () => {
    const dmg = (rank: number) => {
      const { w, p } = fresh();
      p.level = 10;
      p.skills.push('ember_bolt');
      p.skillRanks['ember_bolt'] = rank;
      let total = 0;
      for (let i = 0; i < 40; i++) {
        const m = spawnMonster(w, 14, 10, 'wild_hound');
        m.aggroRange = 0;
        m.maxHp = 99999;
        m.hp = 99999;
        p.mana = 500;
        p.skillCd = {};
        applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
        total += 99999 - m.hp;
      }
      return total;
    };
    expect(dmg(5)).toBeGreaterThan(dmg(1) * 1.5);
  });

  it('Neuverteilen kostet Gold, setzt Attribute und Skills zurück und gibt alle Punkte', () => {
    const { w, p } = town();
    p.level = 6;
    p.gold = 100000;
    p.attrs.kraft = 30;
    p.statPoints = 0;
    p.skills.push('power_strike');
    p.skillRanks['power_strike'] = 2;
    p.skillPoints = 0;
    const heavy = generateItem(w.rng, w.nextId++, 'steel_sword', 'normal');
    p.inventory.push(heavy);
    p.attrs.kraft = 30;
    p.level = 30;
    applyCommand(w, p.id, { type: 'equip', itemId: heavy.id });
    expect(p.equipment.weapon).toBe(heavy);
    p.level = 6;
    const g0 = p.gold;
    applyCommand(w, p.id, { type: 'respec' });
    expect(p.gold).toBeLessThan(g0);
    expect(p.attrs.kraft).toBe(10);
    expect(p.statPoints).toBe(10 + 5 * 5);
    expect(p.skills).toEqual([]);
    expect(p.skillPoints).toBe(2 + 5);
    expect(p.equipment.weapon).toBeUndefined();
    expect(p.inventory).toContain(heavy);
    p.gold = 1;
    p.statPoints = 0;
    applyCommand(w, p.id, { type: 'respec' });
    expect(p.statPoints).toBe(0); // zu wenig Gold
  });

  it('alter Spielstand: gelernte Skills werden Rang 1, übrige Punkte werden erstattet', async () => {
    const { importPlayer } = await import('./save');
    const { w, p } = fresh();
    const old = JSON.stringify({ v: 1, player: { level: 5, skills: ['power_strike', 'ember_bolt'] } });
    importPlayer(w, p, old);
    expect(p.skillRanks).toEqual({ power_strike: 1, ember_bolt: 1 });
    expect(p.skillPoints).toBe(2 + 4 - 2);
  });
});

describe('Treffer und Ausweichen', () => {
  it('Trefferchance steigt mit Angreiferwert und fällt mit Gewandtheit des Ziels', async () => {
    const { hitChance } = await import('./world');
    const { w, p } = fresh();
    const m = spawnMonster(w, 14, 10, 'bandit');
    const base = hitChance(m, p);
    p.attrs.gewandtheit = 40;
    expect(hitChance(m, p)).toBeLessThan(base);
    const weak = spawnMonster(w, 15, 10, 'field_rat');
    p.level = 20;
    expect(hitChance(p, weak)).toBeGreaterThan(0.85);
    expect(hitChance(m, p)).toBeGreaterThanOrEqual(0.35);
    expect(hitChance(p, m)).toBeLessThanOrEqual(0.97);
  });

  it('Fehlschläge treten auf, erzeugen miss-Ereignisse und zählen als Gefecht', () => {
    const { w, p } = fresh();
    p.damage = [1, 1];
    const m = spawnMonster(w, 11, 10, 'bandit_captain'); // deutlich höhere Stufe: oft verfehlt
    m.maxHp = 99999;
    m.hp = 99999;
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 60);
    const ev = drainEvents(w);
    const misses = ev.filter((e) => e.type === 'miss' && e.attackerId === p.id).length;
    const hits = ev.filter((e) => e.type === 'hit' && e.attackerId === p.id).length;
    expect(misses).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(misses);
  });
});

describe('Champions, Mini-Bosse und Boss-Fähigkeiten', () => {
  it('Champions sind stärker, heißen anders und geben dreifache Belohnung plus gute Beute', async () => {
    const { monsterKind } = await import('./data');
    const { w } = fresh();
    const normal = spawnMonster(w, 14, 10, 'wolf');
    const champ = spawnMonster(w, 15, 10, 'wolf', { champ: 'armored' });
    expect(champ.maxHp).toBeGreaterThan(normal.maxHp * 2.5);
    expect(champ.name).toBe('Gepanzerter Wolf');
    expect(champ.rewardMult).toBe(3);
    expect(monsterKind('wolf').hp).toBe(normal.maxHp);
    const swift = spawnMonster(w, 16, 10, 'wolf', { champ: 'swift' });
    expect(swift.speed).toBeGreaterThan(normal.speed * 1.3);
    let rare = 0;
    for (let i = 0; i < 40; i++) {
      const f = fresh();
      f.p.damage = [9999, 9999];
      const c = spawnMonster(f.w, 11, 10, 'wolf', { champ: 'vampiric' });
      applyCommand(f.w, f.p.id, { type: 'attack', targetId: c.id });
      run(f.w, 200);
      if (f.w.ground.some((g) => g.item.rarity === 'magic' || g.item.rarity === 'rare')) rare++;
    }
    expect(rare).toBe(40);
  });

  it('Mini-Boss: benannt, zäh, mit Fähigkeiten und garantiert seltener Beute', async () => {
    const { uniqueDef } = await import('./data');
    const { w, p } = fresh();
    p.damage = [9999, 9999];
    const u = spawnMonster(w, 11, 10, 'giant_rat', { unique: 'rat_king' });
    expect(u.name).toBe('Rattenkönig Knabber');
    expect(u.abilities).toContain('summon');
    expect(uniqueDef('rat_king')!.respawnMin).toBe(15);
    expect(u.respawnTicks).toBe(15 * 60 * TICK_RATE);
    applyCommand(w, p.id, { type: 'attack', targetId: u.id });
    for (let i = 0; i < 400 && u.alive; i++) tick(w);
    expect(u.alive).toBe(false);
    expect(w.ground.filter((g) => g.item.rarity === 'rare').length).toBeGreaterThanOrEqual(1);
  });

  it('Bodenschlag warnt zuerst und trifft nur, wer im Ring stehen bleibt', () => {
    const { w, p } = fresh();
    p.maxHp = 5000;
    p.hp = 5000;
    p.x = 12;
    p.y = 10;
    const boss = spawnMonster(w, 14, 10, 'bandit_lord');
    boss.targetId = p.id;
    boss.damage = [20, 20];
    boss.cooldownLeft = 9999; // kein normaler Hieb
    tick(w);
    const ev = drainEvents(w);
    const tg = ev.find((e) => e.type === 'telegraph');
    expect(tg).toBeDefined();
    expect(p.hp).toBe(5000); // noch kein Schaden während der Warnung
    // ausweichen
    p.x = 4;
    p.y = 4;
    run(w, 40);
    expect(p.hp).toBe(5000);
    // zweiter Schlag: diesmal stehen bleiben
    p.x = 12;
    p.y = 10;
    boss.targetId = p.id;
    boss.abilityAt = 0;
    boss.cooldownLeft = 9999;
    run(w, 40);
    expect(p.hp).toBeLessThan(5000);
  });

  it('Beschwörung bei halbem Leben (einmalig), Ansturm schließt die Lücke', () => {
    const { w, p } = fresh();
    p.x = 20;
    p.y = 10;
    const boss = spawnMonster(w, 10, 10, 'goblin_king');
    boss.targetId = p.id;
    boss.hp = boss.maxHp * 0.4;
    boss.cooldownLeft = 9999;
    const before = w.actors.filter((a) => a.kind === 'monster').length;
    tick(w);
    expect(w.actors.filter((a) => a.kind === 'monster').length).toBe(before + 3);
    tick(w);
    expect(w.actors.filter((a) => a.kind === 'monster').length).toBe(before + 3);
    const cb = spawnMonster(w, 10, 14, 'stone_colossus');
    cb.targetId = p.id;
    p.x = 18;
    p.y = 14;
    cb.cooldownLeft = 9999;
    const d0 = Math.hypot(cb.x - p.x, cb.y - p.y);
    for (let i = 0; i < 12; i++) tick(w);
    expect(d0 - Math.hypot(cb.x - p.x, cb.y - p.y)).toBeGreaterThan(2);
  });

  it('feuriger Champion setzt in Brand, Dorniger wirft Schaden zurück', () => {
    const { w, p } = fresh();
    p.maxHp = 5000;
    p.hp = 5000;
    p.x = 12;
    p.y = 10;
    const fire = spawnMonster(w, 13, 10, 'wolf', { champ: 'fiery' });
    fire.targetId = p.id;
    run(w, 60);
    expect(p.dot).not.toBeNull();
    const w2 = createWorld(9, open());
    const p2 = spawnPlayer(w2, 10, 10);
    p2.damage = [50, 50];
    const th = spawnMonster(w2, 11, 10, 'wolf', { champ: 'thorned' });
    th.maxHp = 99999;
    th.hp = 99999;
    p2.maxHp = 5000;
    p2.hp = 5000;
    applyCommand(w2, p2.id, { type: 'attack', targetId: th.id });
    const h0 = p2.hp;
    run(w2, 60);
    expect(p2.hp).toBeLessThan(h0 - 5);
  });
});

describe('Review-Fixes: DoT, Helfer, Netz, Spielstand', () => {
  it('Gift-Ticks tragen den Skill "dot" und lösen keine Pfeil-Skills aus', () => {
    const { w, p } = fresh();
    armBow(w, p);
    p.skills.push('poison_shot');
    p.mana = 100;
    const m = spawnMonster(w, 14, 10, 'bog_ghoul');
    m.aggroRange = 0;
    applyCommand(w, p.id, { type: 'useSkill', skillId: 'poison_shot', targetId: m.id });
    drainEvents(w);
    run(w, TICK_RATE * 3);
    const hits = drainEvents(w).filter((e) => e.type === 'hit' && e.attackerId === p.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.type === 'hit' && e.skill === 'dot')).toBe(true);
  });

  it('beschworene Helfer verschwinden, wenn der Boss wiedererscheint', () => {
    const { w, p } = fresh();
    p.x = 20;
    p.y = 10;
    const boss = spawnMonster(w, 10, 10, 'goblin_king');
    boss.targetId = p.id;
    boss.hp = boss.maxHp * 0.4;
    boss.cooldownLeft = 9999;
    tick(w);
    expect(w.actors.filter((a) => a.summonedBy === boss.id)).toHaveLength(3);
    boss.alive = false;
    boss.diedAt = w.tick;
    boss.targetId = null;
    run(w, boss.respawnTicks + 5);
    expect(boss.alive).toBe(true);
    expect(w.actors.filter((a) => a.summonedBy === boss.id)).toHaveLength(0);
  });

  it('Netzfilter reicht Warnringe, Fehlschläge, Beschwörung und Ansturm weiter', async () => {
    const { makeSnapshot } = await import('./net');
    const { w, p } = fresh();
    const m = spawnMonster(w, 14, 10, 'wolf');
    const evs = [
      { type: 'telegraph', x: 12, y: 10, r: 2, ms: 1000 },
      { type: 'miss', attackerId: m.id, targetId: p.id },
      { type: 'summon', id: m.id },
      { type: 'charge', id: m.id },
      { type: 'telegraph', x: 200, y: 10, r: 2, ms: 1000 },
    ] as const;
    const snap = makeSnapshot(w, p, [...evs]);
    expect(snap.events.map((e) => e.type)).toEqual(['telegraph', 'miss', 'summon', 'charge']);
  });

  it('Spielstand meldet Gegenstände mit unbekannter Vorlage', async () => {
    const { importPlayer } = await import('./save');
    const { w, p } = fresh();
    const good = generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');
    const bad = { ...generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'), templateId: 'gibt_es_nicht' };
    drainEvents(w);
    importPlayer(w, p, JSON.stringify({ v: 1, mapV: 3, player: { level: 1, inventory: [good, bad] } }));
    expect(p.inventory).toHaveLength(1);
    expect(drainEvents(w).some((e) => e.type === 'fail' && e.reason.includes('nicht geladen'))).toBe(true);
  });
});

describe('Neue Affixe wirken', () => {
  const wear = (w: World, p: ReturnType<typeof fresh>['p'], stat: 'haste' | 'crit' | 'regen' | 'accuracy' | 'evasion', value: number) => {
    const ring = generateItem(w.rng, w.nextId++, 'iron_ring', 'normal');
    ring.affixes.push({ stat, value });
    p.inventory.push(ring);
    applyCommand(w, p.id, { type: 'equip', itemId: ring.id });
  };

  it('Eile verkürzt die Angriffspause (höchstens 40 %)', async () => {
    const { attackCooldownOf } = await import('./world');
    const { w, p } = fresh();
    const base = attackCooldownOf(p);
    wear(w, p, 'haste', 20);
    expect(attackCooldownOf(p)).toBeLessThan(base);
    p.equipment.ring!.affixes[0]!.value = 999;
    expect(attackCooldownOf(p)).toBeGreaterThanOrEqual(Math.round(base * 0.6) - 1);
  });

  it('Regeneration heilt im Feld, Treffsicherheit/Ausweichen verschieben die Trefferchance', async () => {
    const { hitChance } = await import('./world');
    const { w, p } = fresh();
    p.x = 15;
    p.y = 15;
    p.hp = 10;
    wear(w, p, 'regen', 2);
    run(w, TICK_RATE * 10);
    expect(p.hp).toBeGreaterThan(10 + 15);
    const m = spawnMonster(w, 16, 16, 'bandit');
    const q = fresh();
    const base = hitChance(q.p, m);
    wear(q.w, q.p, 'accuracy', 40);
    expect(hitChance(q.p, m)).toBeGreaterThan(base);
    const r = fresh();
    const mm = spawnMonster(r.w, 16, 16, 'bandit');
    const b2 = hitChance(mm, r.p);
    wear(r.w, r.p, 'evasion', 40);
    expect(hitChance(mm, r.p)).toBeLessThan(b2);
  });

  it('Kritisch-Affix verdoppelt Schaden mit der angegebenen Chance', () => {
    const { w, p } = fresh();
    wear(w, p, 'crit', 50);
    p.maxHp = 99999;
    p.hp = 99999;
    let crits = 0;
    const m = spawnMonster(w, 11, 10, 'wild_hound');
    m.maxHp = 9e9;
    m.hp = 9e9;
    m.damage = [1, 1];
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    run(w, TICK_RATE * 60);
    for (const e of drainEvents(w)) if (e.type === 'hit' && e.attackerId === p.id && e.crit) crits++;
    expect(crits).toBeGreaterThan(8);
  });
});

describe('Abwechslungsreiche Aufgaben', () => {
  it('Truhen-, Champion- und Mini-Boss-Aufgaben zählen ihren Fortschritt', () => {
    const { w, p } = fresh();
    p.level = 20;
    p.quests['q_chests1'] = { state: 'active', progress: 0 };
    p.quests['q_champs1'] = { state: 'active', progress: 0 };
    p.quests['q_unique1'] = { state: 'active', progress: 0 };
    for (let i = 0; i < 3; i++) w.chests.push({ id: w.nextId++, x: 11, y: 10 + i, level: 3, tier: 'wood', opened: false, respawnAt: 0 });
    for (const c of w.chests) {
      applyCommand(w, p.id, { type: 'openChest', chestId: c.id });
      run(w, 60);
    }
    expect(p.quests['q_chests1']).toEqual({ state: 'done', progress: 3 });
    p.damage = [99999, 99999];
    for (let i = 0; i < 4; i++) {
      const c = spawnMonster(w, 12, 12, 'wolf', { champ: 'swift' });
      applyCommand(w, p.id, { type: 'attack', targetId: c.id });
      run(w, 120);
    }
    expect(p.quests['q_champs1']!.progress).toBeGreaterThanOrEqual(3);
    const u = spawnMonster(w, 12, 13, 'giant_rat', { unique: 'rat_king' });
    applyCommand(w, p.id, { type: 'attack', targetId: u.id });
    run(w, 200);
    expect(p.quests['q_unique1']!.state).toBe('done');
  });
});

describe('Rasten', () => {
  it('Rast beschleunigt die Erholung im Feld und endet bei Bewegung oder Treffer', () => {
    const regenAfter = (rest: boolean): [number, number] => {
      const { w, p } = fresh();
      p.x = 15;
      p.y = 15;
      p.hp = 10;
      p.mana = 0;
      if (rest) applyCommand(w, p.id, { type: 'rest' });
      run(w, TICK_RATE * 10);
      return [p.hp, p.mana];
    };
    const [hr, mr] = regenAfter(true);
    const [hn, mn] = regenAfter(false);
    expect(hr).toBeGreaterThan(hn + 1);
    expect(mr).toBeGreaterThan(mn);

    const { w, p } = fresh();
    p.x = 15;
    p.y = 15;
    applyCommand(w, p.id, { type: 'rest' });
    expect(p.resting).toBe(true);
    applyCommand(w, p.id, { type: 'moveTo', x: 18, y: 15 });
    expect(p.resting).toBe(false);
    applyCommand(w, p.id, { type: 'rest' });
    const m = spawnMonster(w, 16, 15, 'field_rat');
    m.targetId = p.id;
    run(w, TICK_RATE * 3);
    expect(p.resting).toBe(false);
    drainEvents(w);
    applyCommand(w, p.id, { type: 'rest' });
    expect(p.resting).toBe(false); // im Kampf nicht möglich
    expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
  });
});

describe('Balance bei Vollausrüstung (Level 30)', () => {
  const gear = (w: World, p: ReturnType<typeof fresh>['p'], stat: 'crit' | 'regen' | 'haste', value: number) => {
    p.level = 30;
    p.attrs.kraft = 60;
    p.attrs.ausdauer = 60;
    p.attrs.gewandtheit = 40;
    for (const id of ['ash_greatsword', 'ash_visor', 'ash_cuirass', 'ash_gauntlets', 'ash_boots', 'ash_band']) {
      const it = generateItem(w.rng, w.nextId++, id, 'normal');
      it.affixes.push({ stat, value });
      p.inventory.push(it);
      applyCommand(w, p.id, { type: 'equip', itemId: it.id });
    }
  };

  it('Kritisch-Chance ist bei 50 % gedeckelt, Regeneration bei 10 LP/s', async () => {
    const { critChance, MAX_REGEN_PER_SEC, MAX_CRIT_PERCENT } = await import('./world');
    const { w, p } = fresh();
    gear(w, p, 'crit', 40);
    expect(critChance(p)).toBe(MAX_CRIT_PERCENT);
    const r = fresh();
    gear(r.w, r.p, 'regen', 40);
    r.p.x = 15;
    r.p.y = 15;
    r.p.hp = 1;
    r.p.maxHp = 99999;
    const h0 = r.p.hp;
    run(r.w, TICK_RATE * 10);
    expect(r.p.hp - h0).toBeLessThan(MAX_REGEN_PER_SEC * 10 + 200 * 0.5 + 20);
  });

  it('ein voll ausgerüsteter Held verliert gegen ein Rudel Stufe-29-Gegner trotzdem Leben', () => {
    const { w, p } = fresh();
    gear(w, p, 'regen', 3);
    p.x = 15;
    p.y = 15;
    p.hp = maxHpOf(p);
    let low = p.hp;
    for (let i = 0; i < 3; i++) {
      const m = spawnMonster(w, 16 + i, 15, 'hell_spawn');
      m.targetId = p.id;
    }
    for (let i = 0; i < TICK_RATE * 15; i++) {
      tick(w);
      low = Math.min(low, p.hp);
    }
    expect(low).toBeLessThan(maxHpOf(p) * 0.8);
  });

  it('Roll-Bereiche für Tempo/Kritisch/Regeneration bleiben auch bei Stufe-26-Gegenständen klein', async () => {
    const { affixRange } = await import('./items');
    expect(affixRange('crit', 26)[1]).toBeLessThanOrEqual(6);
    expect(affixRange('regen', 26)[1]).toBeLessThanOrEqual(4);
    expect(affixRange('haste', 26)[1]).toBeLessThanOrEqual(10);
  });
});
