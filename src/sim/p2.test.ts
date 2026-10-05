import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  EQUIP_SLOT_LIST, GEM_KINDS, SLOTS, TEMPLATES, TIER_CHANCE, TIER_MULT, affixRange, genderOf, generateItem, generateLegendary, handsOf,
  itemAffixes, nameItem, rareName, rerollAffixes, rollGem, rollSockets, rollTier, templateById, weaponSpeedOf, type Affix, type Item,
} from './items';
import { ATTR_THRESHOLD_BONUS, GEM_DROP, GEM_SOCKET_COST, SHOPS } from './data';
import {
  addNpc, applyCommand, armorOf, attackCooldownOf, attrBonus, createWorld, damageRange, drainEvents, maxHpOf, resistOf, applyStatus, socketCost,
  spawnMonster, spawnPlayer, tick, type Actor, type World,
} from './world';
import type { Grid } from './path';
import { exportPlayer, importPlayer } from './save';
import { validateCommand } from './net';

const open = (): Grid => ({ w: 30, h: 30, walkable: new Array(900).fill(true) });
const fresh = () => {
  const w = createWorld(21, open());
  const p = spawnPlayer(w, 10, 10);
  p.attrs.kraft = 40;
  p.attrs.gewandtheit = 40;
  p.attrs.ausdauer = 40;
  p.attrs.verstand = 40;
  p.level = 30;
  return { w, p };
};
const give = (w: World, p: Actor, id: string, rarity: 'normal' | 'magic' | 'rare' = 'normal'): Item => {
  const it = generateItem(w.rng, w.nextId++, id, rarity);
  p.inventory.push(it);
  return it;
};
const wear = (w: World, p: Actor, id: string, rarity: 'normal' | 'magic' | 'rare' = 'normal'): Item => {
  const it = give(w, p, id, rarity);
  applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  return it;
};
const reasons = (w: World) => drainEvents(w).flatMap((e) => (e.type === 'cannotEquip' ? [e.reason] : e.type === 'fail' ? [e.reason] : []));

describe('P2: neue Slots Gürtel, Umhang, Beine', () => {
  it('Slotlisten kennen alle zwölf Felder', () => {
    expect(EQUIP_SLOT_LIST).toHaveLength(12);
    for (const s of ['belt', 'cloak', 'legs']) expect(SLOTS).toContain(s);
  });

  it('jeder Slot hat eine Stufe-1-Vorlage und Drops für Stufe 2–16 (neue Slots: je ~6 Vorlagen bis Stufe 27)', () => {
    for (const slot of ['belt', 'cloak', 'legs'] as const) {
      const list = TEMPLATES.filter((t) => t.slot === slot);
      expect(list.length).toBeGreaterThanOrEqual(6);
      expect(list.some((t) => t.minLevel === 1)).toBe(true);
      expect(Math.max(...list.map((t) => t.minLevel))).toBeGreaterThanOrEqual(26);
    }
    for (let lvl = 2; lvl <= 27; lvl++) {
      for (const slot of SLOTS) expect(TEMPLATES.some((t) => t.slot === slot && t.minLevel <= lvl && t.minLevel >= lvl - 8), `${slot} bei ${lvl}`).toBe(true);
    }
  });

  it('Anlegen, Ablegen, Rüstung', () => {
    const { w, p } = fresh();
    const a0 = armorOf(p);
    const belt = wear(w, p, 'leather_belt');
    const cloak = wear(w, p, 'wool_cloak');
    const legs = wear(w, p, 'leather_pants');
    expect(p.equipment.belt).toBe(belt);
    expect(p.equipment.cloak).toBe(cloak);
    expect(p.equipment.legs).toBe(legs);
    expect(armorOf(p)).toBe(a0 + 1 + 1 + 3);
    expect(maxHpOf(p)).toBeGreaterThan(100 + 9);
    applyCommand(w, p.id, { type: 'unequip', slot: 'belt' });
    applyCommand(w, p.id, { type: 'unequip', slot: 'legs' });
    expect(p.equipment.belt).toBeUndefined();
    expect(p.inventory).toContain(belt);
    expect(armorOf(p)).toBe(a0 + 1);
  });

  it('Umhang bringt Basis-Affixe (Ausweichen/Resistenz)', () => {
    const { w, p } = fresh();
    wear(w, p, 'ash_cloak');
    expect(resistOf(p, 'fire')).toBe(12);
    expect(resistOf(p, 'poison')).toBe(8);
  });

  it('Neuverteilen legt Stücke ab, deren Anforderung nicht mehr passt', () => {
    const { w, p } = fresh();
    addNpc(w, 'trainer', 'Lehrer', 10, 11, { tier: 1 });
    p.gold = 100000;
    wear(w, p, 'dread_legs');
    expect(p.equipment.legs).toBeDefined();
    applyCommand(w, p.id, { type: 'respec' });
    expect(p.equipment.legs).toBeUndefined();
    expect(p.inventory.some((i) => i.slot === 'legs')).toBe(true);
  });

  it('Spielstand mit neuen Slots wird gespeichert und geladen; Altstand ohne sie bleibt gültig', () => {
    const { w, p } = fresh();
    wear(w, p, 'iron_belt');
    wear(w, p, 'hunter_cloak');
    wear(w, p, 'chain_legs');
    const json = exportPlayer(p);
    const w2 = createWorld(5, open());
    const q = spawnPlayer(w2, 1, 1);
    expect(importPlayer(w2, q, json)).toBe(true);
    expect(q.equipment.belt?.templateId).toBe('iron_belt');
    expect(q.equipment.cloak?.templateId).toBe('hunter_cloak');
    expect(q.equipment.legs?.templateId).toBe('chain_legs');
    // Altstand: nur alte Slots
    const old = JSON.stringify({ v: 1, mapV: 3, player: { level: 4, equipment: { head: generateItem(w.rng, 1, 'leather_cap', 'normal') } } });
    const q2 = spawnPlayer(createWorld(5, open()), 1, 1);
    expect(importPlayer(createWorld(5, open()), q2, old)).toBe(true);
    expect(q2.equipment.head).toBeDefined();
    expect(q2.equipment.belt).toBeUndefined();
  });

  it('Händler führen die unteren Stufen der neuen Slots', () => {
    for (const id of ['cloth_belt', 'rag_cloak', 'cloth_pants']) expect(SHOPS.basic).toContain(id);
    for (const key of Object.keys(SHOPS)) for (const id of SHOPS[key]!) expect(() => templateById(id)).not.toThrow();
  });

  it('Verkaufen funktioniert automatisch', () => {
    const { w, p } = fresh();
    addNpc(w, 'merchant', 'Händler', 10, 11, { shop: 'basic' });
    const it = give(w, p, 'cloth_belt');
    const g = p.gold;
    applyCommand(w, p.id, { type: 'sell', itemId: it.id });
    expect(p.gold).toBeGreaterThan(g);
  });
});

describe('P2: Zweihand und Waffentempo', () => {
  it('Bögen, Stäbe und große Nahkampfwaffen sind zweihändig, Dolche und Schwerter einhändig', () => {
    for (const t of TEMPLATES.filter((x) => x.kind === 'bow' || x.kind === 'staff')) expect(t.hands).toBe(2);
    for (const id of ['doom_hammer', 'ash_greatsword', 'claymore', 'battle_axe']) expect(templateById(id).hands).toBe(2);
    for (const id of ['rusty_sword', 'steel_dagger', 'war_blade', 'dread_blade']) expect(handsOf(generateItem(new Rng(1), 1, id, 'normal'))).toBe(1);
  });

  it('Zweihänder verursachen etwa 45 % mehr Schaden als gleichstufige Einhänder (Hämmer inkl. +20 %)', () => {
    const avg = (id: string) => {
      const [a, b] = templateById(id).damage!;
      return (a + b) / 2;
    };
    expect(avg('claymore') / avg('cinder_axe')).toBeGreaterThan(1.3);
    expect(avg('claymore') / avg('cinder_axe')).toBeLessThan(1.6);
    expect(avg('great_axe') / avg('war_blade')).toBeGreaterThan(1.3);
    expect(avg('great_axe') / avg('war_blade')).toBeLessThan(1.6);
    expect(avg('ash_greatsword') / avg('ash_saber')).toBeGreaterThan(1.3);
    expect(avg('ash_greatsword') / avg('ash_saber')).toBeLessThan(1.6);
  });

  it('Zweihandwaffe schickt die Nebenhand in den Rucksack', () => {
    const { w, p } = fresh();
    const shield = wear(w, p, 'iron_shield');
    expect(p.equipment.offhand).toBe(shield);
    const hammer = wear(w, p, 'doom_hammer');
    expect(p.equipment.weapon).toBe(hammer);
    expect(p.equipment.offhand).toBeUndefined();
    expect(p.inventory).toContain(shield);
  });

  it('Schild und Pfeile bei Zweihandwaffe: Meldung, Nebenhand bleibt frei', () => {
    const { w, p } = fresh();
    wear(w, p, 'claymore');
    drainEvents(w);
    const shield = wear(w, p, 'iron_shield');
    expect(p.equipment.offhand).toBeUndefined();
    expect(reasons(w)).toContain('Zweihandwaffe: Nebenhand muss frei sein');
    expect(p.inventory).toContain(shield);
    wear(w, p, 'wood_arrows');
    expect(p.equipment.offhand).toBeUndefined();
    // Stab ebenfalls
    applyCommand(w, p.id, { type: 'unequip', slot: 'weapon' });
    wear(w, p, 'oak_staff');
    wear(w, p, 'iron_shield');
    expect(p.equipment.offhand).toBeUndefined();
  });

  it('Bogen: nur Pfeile in der Nebenhand', () => {
    const { w, p } = fresh();
    wear(w, p, 'hunt_bow');
    drainEvents(w);
    wear(w, p, 'wood_shield');
    expect(p.equipment.offhand).toBeUndefined();
    expect(reasons(w)).toContain('Bogen: In der Nebenhand nur Pfeile');
    const arrows = wear(w, p, 'wood_arrows');
    expect(p.equipment.offhand).toBe(arrows);
    // Bogen bleibt mit Pfeilen anlegbar, Schild fliegt beim Bogenwechsel raus
    const { w: w2, p: p2 } = fresh();
    const sh = wear(w2, p2, 'wood_shield');
    const bow = wear(w2, p2, 'hunt_bow');
    expect(p2.equipment.weapon).toBe(bow);
    expect(p2.inventory).toContain(sh);
  });

  it('Einhänder erlauben Schild und Pfeile weiter', () => {
    const { w, p } = fresh();
    wear(w, p, 'steel_sword');
    const sh = wear(w, p, 'wood_shield');
    expect(p.equipment.offhand).toBe(sh);
  });

  it('Altspielstand mit Zweihandwaffe und Schild räumt die Nebenhand auf', () => {
    const { w } = fresh();
    const hammer = generateItem(w.rng, 70, 'doom_hammer', 'normal');
    const shield = generateItem(w.rng, 71, 'iron_shield', 'normal');
    const q = spawnPlayer(createWorld(5, open()), 1, 1);
    const w2 = createWorld(5, open());
    expect(importPlayer(w2, q, JSON.stringify({ v: 1, mapV: 3, player: { level: 30, equipment: { weapon: hammer, offhand: shield } } }))).toBe(true);
    expect(q.equipment.weapon?.templateId).toBe('doom_hammer');
    expect(q.equipment.offhand).toBeUndefined();
    expect(q.inventory.some((i) => i.id === 71)).toBe(true);
    // Altgegenstand ohne `hands`-Feld: aus der Vorlage
    const legacy: Partial<Item> = { ...generateItem(w.rng, 72, 'yew_bow', 'normal') };
    delete legacy.hands;
    expect(handsOf(legacy as Item)).toBe(2);
  });

  it('Waffentempo: Dolch schneller, Hammer langsamer, Schwert unverändert', () => {
    const { w, p } = fresh();
    const base = attackCooldownOf(p);
    wear(w, p, 'steel_sword');
    expect(attackCooldownOf(p)).toBe(base);
    wear(w, p, 'steel_dagger');
    const fast = attackCooldownOf(p);
    expect(fast).toBeLessThan(base);
    expect(fast).toBeCloseTo(base * 0.8, 5);
    wear(w, p, 'war_hammer');
    const slow = attackCooldownOf(p);
    expect(slow).toBeGreaterThan(base);
    expect(slow).toBeCloseTo(base * 1.25, 5);
    expect(weaponSpeedOf(p.equipment.weapon!)).toBe(1.25);
  });
});

describe('P2: Attribut-Tiefe', () => {
  it('Willenskraft erhöht Resistenzen (+1 % je 2 Punkte über 10) bis zum Deckel', () => {
    const { p } = fresh();
    expect(resistOf(p, 'fire')).toBe(0);
    p.attrs.willenskraft = 30;
    expect(resistOf(p, 'fire')).toBe(10);
    expect(resistOf(p, 'frost')).toBe(10);
    expect(resistOf(p, 'poison')).toBe(10);
    expect(resistOf(p, 'physical')).toBe(0);
    p.attrs.willenskraft = 200;
    expect(resistOf(p, 'fire')).toBe(75);
  });

  it('Willenskraft verkürzt Betäubung und Verlangsamung zusätzlich', () => {
    const { w, p } = fresh();
    applyStatus(w, p, 'stun', 4, 'physical');
    const plain = p.status.stun! - w.tick;
    p.status = {};
    p.attrs.willenskraft = 30;
    applyStatus(w, p, 'stun', 4, 'physical');
    const shorter = p.status.stun! - w.tick;
    expect(shorter).toBeLessThan(plain);
    p.status = {};
    applyStatus(w, p, 'slow', 4, 'frost');
    expect(p.status.slow! - w.tick).toBeLessThan(plain * 0.95);
  });

  it('Schwellenboni ab 30: Kraft, Gewandtheit, Ausdauer', () => {
    const w = createWorld(1, open());
    const p = spawnPlayer(w, 5, 5);
    p.attrs.kraft = 29;
    p.attrs.gewandtheit = 29;
    p.attrs.ausdauer = 29;
    const dmg29 = damageRange(p);
    const cd29 = attackCooldownOf(p);
    const hp29 = maxHpOf(p);
    expect(attrBonus(p, 'kraft')).toBe(0);
    p.attrs.kraft = 30;
    p.attrs.gewandtheit = 30;
    p.attrs.ausdauer = 30;
    expect(attrBonus(p, 'kraft')).toBe(ATTR_THRESHOLD_BONUS.kraft.pct);
    // +1 Punkt Kraft gibt sonst +0,5 Schaden; der Schwellenbonus ist deutlich größer
    expect(damageRange(p)[1]).toBeGreaterThanOrEqual(Math.round((dmg29[1] + 0) * 1.05));
    expect(attackCooldownOf(p)).toBeLessThan(cd29);
    expect(maxHpOf(p)).toBeGreaterThan(hp29 + 5);
  });

  it('Schwellenbonus Verstand erhöht Zauberschaden, Willenskraft die Manaregeneration', () => {
    const run = (verstand: number) => {
      const { w, p } = fresh();
      p.attrs.verstand = verstand;
      p.skills.push('ember_bolt');
      p.skillRanks.ember_bolt = 1;
      p.mana = 500;
      const m = spawnMonster(w, 14, 10, 'zombie');
      m.hp = m.maxHp = 1e6;
      m.aggroRange = 0;
      let total = 0;
      for (let i = 0; i < 80; i++) {
        p.skillCd = {};
        const before = m.hp;
        applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
        total += before - m.hp;
      }
      return total;
    };
    expect(run(30)).toBeGreaterThan(run(29) * 1.01);
    const regen = (will: number) => {
      const { w, p } = fresh();
      p.attrs.willenskraft = will;
      p.mana = 0;
      for (let i = 0; i < 40; i++) tick(w);
      return p.mana;
    };
    // (0,02 + 20 · 0,005) je Tick, +10 % ab Willenskraft 30
    expect(regen(30)).toBeCloseTo(0.12 * 40 * 1.1, 1);
    expect(regen(29)).toBeCloseTo(0.115 * 40, 1);
  });
});

describe('P2: Affix-Stufen', () => {
  it('Verteilung der Stufen entspricht den Wahrscheinlichkeiten', () => {
    const rng = new Rng(77);
    const n = 20000;
    const count = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) count[rollTier(rng) - 1]!++;
    TIER_CHANCE.forEach((p, i) => expect(Math.abs(count[i]! / n - p)).toBeLessThan(0.02));
    expect(TIER_CHANCE.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('jeder gewürfelte Affix hat eine Stufe und liegt in der Spannweite dieser Stufe', () => {
    const rng = new Rng(5);
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      const id = ['steel_sword', 'iron_helm', 'plate_cuirass', 'war_blade'][i % 4]!;
      const t = templateById(id);
      const it = generateItem(rng, i, id, i % 2 ? 'rare' : 'magic');
      for (const a of it.affixes.slice(t.base?.length ?? 0)) {
        expect(a.tier).toBeGreaterThanOrEqual(1);
        expect(a.tier).toBeLessThanOrEqual(5);
        const [lo, hi] = affixRange(a.stat, t.minLevel, a.tier);
        expect(a.value).toBeGreaterThanOrEqual(lo);
        expect(a.value).toBeLessThanOrEqual(hi);
        expect(a.value).toBeGreaterThanOrEqual(1);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(500);
  });

  it('Spannweite wächst mit der Stufe (T1 ×0,6 … T5 ×1,5)', () => {
    expect(TIER_MULT[0]).toBe(0.6);
    expect(TIER_MULT[4]).toBe(1.5);
    for (const stat of ['damage', 'maxHp', 'resFire'] as const) {
      for (let t = 1; t < 5; t++) {
        const a = affixRange(stat, 20, t);
        const b = affixRange(stat, 20, t + 1);
        expect(b[1]).toBeGreaterThanOrEqual(a[1]);
        expect(b[0]).toBeGreaterThanOrEqual(a[0]);
      }
    }
    expect(affixRange('maxHp', 20, 5)[1]).toBeGreaterThan(affixRange('maxHp', 20, 1)[1] * 2);
  });

  it('gleicher Seed ergibt gleiche Stufen; Neuwürfeln würfelt Stufen neu', () => {
    const a = generateItem(new Rng(9), 1, 'plate_cuirass', 'rare');
    const b = generateItem(new Rng(9), 1, 'plate_cuirass', 'rare');
    expect(a).toEqual(b);
    const rng = new Rng(4);
    const it = generateItem(rng, 1, 'plate_cuirass', 'rare');
    const tiers = new Set<string>();
    for (let i = 0; i < 40; i++) {
      rerollAffixes(rng, it, 'rare', 3);
      expect(it.affixes.every((x: Affix) => x.tier !== undefined)).toBe(true);
      tiers.add(it.affixes.map((x) => x.tier).join(','));
    }
    expect(tiers.size).toBeGreaterThan(10);
  });

  it('Basis-Affixe der Vorlage haben keine Stufe', () => {
    const it = generateItem(new Rng(2), 1, 'ash_belt', 'rare');
    expect(it.affixes[0]!.tier).toBeUndefined();
    expect(it.affixes[0]!.stat).toBe('maxHp');
  });
});

describe('P2: Namen', () => {
  it('Geschlecht der Gegenstandsnamen', () => {
    expect(genderOf('Stahlschwert')).toBe('n');
    expect(genderOf('Eisenhelm')).toBe('m');
    expect(genderOf('Robe')).toBe('f');
    expect(genderOf('Aschenstiefel')).toBe('p');
    expect(genderOf('Glutaxt')).toBe('f');
    expect(genderOf('Eisenschild')).toBe('m');
    expect(genderOf('Schreckensfäuste')).toBe('p');
    expect(nameItem(new Rng(1), templateById('iron_shield'), 'magic', [{ stat: 'maxMana', value: 3 }])).toBe('Weiser Eisenschild');
    expect(nameItem(new Rng(1), templateById('dread_fists'), 'magic', [{ stat: 'armor', value: 3 }])).toBe('Gehärtete Schreckensfäuste');
  });

  it('Magische Gegenstände tragen Präfix (1. Affix) und Suffix (2. Affix)', () => {
    const t = templateById('steel_sword');
    const dmg: Affix = { stat: 'damage', value: 2 };
    const arm: Affix = { stat: 'armor', value: 2 };
    expect(nameItem(new Rng(1), t, 'magic', [dmg])).toBe('Scharfes Stahlschwert');
    expect(nameItem(new Rng(1), t, 'magic', [dmg, dmg])).toBe('Scharfes Stahlschwert des Zorns');
    expect(nameItem(new Rng(1), templateById('iron_helm'), 'magic', [arm])).toBe('Gehärteter Eisenhelm');
    expect(nameItem(new Rng(1), templateById('worn_gloves'), 'magic', [arm])).toContain('Gehärtete');
    expect(nameItem(new Rng(1), t, 'normal', [])).toBe('Stahlschwert');
  });

  it('Seltene bekommen deterministische Fantasienamen', () => {
    expect(rareName(new Rng(3), 'weapon')).toBe(rareName(new Rng(3), 'weapon'));
    const names = new Set<string>();
    const rng = new Rng(8);
    for (let i = 0; i < 200; i++) names.add(rareName(rng, 'weapon'));
    expect(names.size).toBeGreaterThan(50);
    const it = generateItem(new Rng(11), 1, 'steel_sword', 'rare');
    expect(it.name).not.toContain('Stahlschwert');
    expect(it.name).toMatch(/^[A-ZÄÖÜ][a-zäöüß]+$/);
    for (const slot of SLOTS) expect(rareName(new Rng(1), slot).length).toBeGreaterThan(4);
  });

  it('alte Namen im Spielstand bleiben gültig', () => {
    const w = createWorld(5, open());
    const q = spawnPlayer(w, 1, 1);
    const old = { ...generateItem(w.rng, 5, 'steel_sword', 'magic'), name: 'Stahlschwert des Zorns' };
    expect(importPlayer(w, q, JSON.stringify({ v: 1, mapV: 3, player: { level: 3, inventory: [old] } }))).toBe(true);
    expect(q.inventory[0]!.name).toBe('Stahlschwert des Zorns');
  });
});

describe('P2: Sockel und Edelsteine', () => {
  it('Sockel nur bei magisch und besser und nur in passenden Slots', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      for (const id of ['steel_sword', 'plate_cuirass', 'iron_helm', 'dread_legs', 'iron_shield']) {
        expect(generateItem(rng, i, id, 'normal').sockets).toBeUndefined();
      }
      for (const id of ['iron_ring', 'bone_charm', 'cloth_boots', 'worn_gloves', 'cloth_belt', 'rag_cloak']) {
        expect(generateItem(rng, i, id, 'rare').sockets).toBeUndefined();
      }
      expect(generateItem(rng, i, 'wood_arrows', 'rare').sockets).toBeUndefined();
    }
    let withSock = 0;
    let max = 0;
    for (let i = 0; i < 400; i++) {
      const s = generateItem(rng, i, 'plate_cuirass', 'rare').sockets;
      if (s) withSock++;
      max = Math.max(max, s?.length ?? 0);
    }
    expect(withSock).toBeGreaterThan(150);
    expect(withSock).toBeLessThan(330);
    expect(max).toBe(3);
    const t = templateById('iron_helm');
    for (let i = 0; i < 200; i++) expect(rollSockets(rng, t, 'legendary')?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('Edelstein-Vorlagen: 4 Arten × 3 Qualitäten, nicht ausrüstbar, nie im normalen Drop-Pool', () => {
    const gems = TEMPLATES.filter((t) => t.slot === 'gem');
    expect(gems).toHaveLength(12);
    expect(new Set(gems.map((g) => g.gem!.kind)).size).toBe(4);
    const { w, p } = fresh();
    const g = give(w, p, 'gem_ruby_2');
    applyCommand(w, p.id, { type: 'equip', itemId: g.id });
    expect(Object.keys(p.equipment)).toHaveLength(0);
    expect(p.inventory).toContain(g);
    const rng = new Rng(2);
    for (let i = 0; i < 500; i++) expect(['gem', 'potion']).not.toContain(generateItem(rng, i, templateById(['steel_sword', 'iron_helm', 'cloth_belt'][i % 3]!).id, 'normal').slot);
  });

  const setup = () => {
    const { w, p } = fresh();
    addNpc(w, 'smith', 'Schmied', 10, 11);
    p.gold = 5000;
    return { w, p };
  };
  const sockets = (n: number) => (it: Item) => {
    it.sockets = new Array(n).fill(null);
    return it;
  };

  it('Einsetzen kostet Gold, verbraucht den Stein und füllt den ersten leeren Sockel', () => {
    const { w, p } = setup();
    const sword = sockets(2)(give(w, p, 'steel_sword', 'magic'));
    const gem = give(w, p, 'gem_ruby_3');
    const gold = p.gold;
    applyCommand(w, p.id, { type: 'socket', gemId: gem.id, itemId: sword.id });
    expect(sword.sockets![0]).toEqual({ kind: 'ruby', q: 3 });
    expect(sword.sockets![1]).toBeNull();
    expect(p.inventory).not.toContain(gem);
    expect(p.gold).toBe(gold - socketCost({ kind: 'ruby', q: 3 }));
    expect(socketCost({ kind: 'ruby', q: 3 })).toBe(GEM_SOCKET_COST * 9);
    expect(drainEvents(w).some((e) => e.type === 'crafted' && e.op === 'socket')).toBe(true);
  });

  it('Boni zählen: Rubin in Waffe = Schaden, in Rüstung = Feuerwiderstand', () => {
    const { w, p } = setup();
    const sword = sockets(1)(give(w, p, 'steel_sword', 'magic'));
    sword.affixes = [];
    const helm = sockets(1)(give(w, p, 'iron_helm', 'magic'));
    helm.affixes = [];
    applyCommand(w, p.id, { type: 'equip', itemId: sword.id });
    applyCommand(w, p.id, { type: 'equip', itemId: helm.id });
    const d0 = damageRange(p);
    const a0 = armorOf(p);
    const hp0 = maxHpOf(p);
    for (const [gemId, item] of [['gem_ruby_3', sword], ['gem_ruby_3', helm]] as const) {
      const gem = give(w, p, gemId);
      applyCommand(w, p.id, { type: 'socket', gemId: gem.id, itemId: item.id });
    }
    expect(damageRange(p)[0]).toBeGreaterThan(d0[0] + 8);
    expect(resistOf(p, 'fire')).toBe(14);
    // Topas: Rüstung in Helm, Leben in Waffe
    const { w: w2, p: p2 } = setup();
    const s2 = sockets(1)(give(w2, p2, 'steel_sword', 'magic'));
    const h2 = sockets(1)(give(w2, p2, 'iron_helm', 'magic'));
    applyCommand(w2, p2.id, { type: 'equip', itemId: s2.id });
    applyCommand(w2, p2.id, { type: 'equip', itemId: h2.id });
    const a1 = armorOf(p2);
    const hp1 = maxHpOf(p2);
    applyCommand(w2, p2.id, { type: 'socket', gemId: give(w2, p2, 'gem_topaz_2').id, itemId: h2.id });
    expect(armorOf(p2)).toBe(a1 + 4);
    applyCommand(w2, p2.id, { type: 'socket', gemId: give(w2, p2, 'gem_topaz_2').id, itemId: s2.id });
    // +30 Leben (Ausdauer 40 gibt zusätzlich +5 % Schwellenbonus auf die Summe)
    expect(maxHpOf(p2)).toBeGreaterThanOrEqual(hp1 + 30);
    expect(maxHpOf(p2)).toBeLessThanOrEqual(hp1 + 33);
    expect(a0).toBeGreaterThanOrEqual(0);
    expect(hp0).toBeGreaterThan(0);
  });

  it('Saphir, Smaragd: Mana/Frost bzw. Tempo/Gift', () => {
    const { w, p } = setup();
    const sword = sockets(2)(give(w, p, 'steel_sword', 'magic'));
    const legs = sockets(2)(give(w, p, 'bone_legs', 'magic'));
    sword.affixes = [];
    legs.affixes = [];
    applyCommand(w, p.id, { type: 'equip', itemId: sword.id });
    applyCommand(w, p.id, { type: 'equip', itemId: legs.id });
    p.attrs.gewandtheit = 10; // bei hoher Gewandtheit steht die Pause schon an der Untergrenze (6 Ticks)
    const cd0 = attackCooldownOf(p);
    applyCommand(w, p.id, { type: 'socket', gemId: give(w, p, 'gem_emerald_3').id, itemId: sword.id });
    expect(attackCooldownOf(p)).toBeLessThan(cd0);
    applyCommand(w, p.id, { type: 'socket', gemId: give(w, p, 'gem_emerald_1').id, itemId: legs.id });
    expect(resistOf(p, 'poison')).toBe(5);
    applyCommand(w, p.id, { type: 'socket', gemId: give(w, p, 'gem_sapphire_2').id, itemId: legs.id });
    expect(resistOf(p, 'frost')).toBe(9);
    expect(itemAffixes(legs).some((a) => a.stat === 'resFrost')).toBe(true);
  });

  it('Fehlerfälle: kein Schmied, kein Gold, keine Sockel, voll, ungültiger Index, falsche Gegenstände', () => {
    const { w, p } = setup();
    const sword = sockets(1)(give(w, p, 'steel_sword', 'magic'));
    const gem = give(w, p, 'gem_ruby_1');
    const plain = give(w, p, 'iron_helm', 'normal');
    drainEvents(w);
    p.gold = 5;
    applyCommand(w, p.id, { type: 'socket', gemId: gem.id, itemId: sword.id });
    expect(reasons(w)).toContain('Nicht genug Gold.');
    p.gold = 5000;
    applyCommand(w, p.id, { type: 'socket', gemId: gem.id, itemId: plain.id });
    expect(reasons(w)).toContain('Dieser Gegenstand hat keine Sockel.');
    applyCommand(w, p.id, { type: 'socket', gemId: gem.id, itemId: sword.id, index: 5 });
    expect(reasons(w)).toContain('Ungültiger Sockel.');
    applyCommand(w, p.id, { type: 'socket', gemId: sword.id, itemId: sword.id });
    expect(reasons(w)).toContain('Das lässt sich nicht einsetzen.');
    applyCommand(w, p.id, { type: 'socket', gemId: gem.id, itemId: sword.id });
    expect(sword.sockets![0]).toEqual({ kind: 'ruby', q: 1 });
    // voll: ohne Index nicht möglich, mit Index ersetzt (alter Stein geht verloren)
    const gem2 = give(w, p, 'gem_topaz_3');
    applyCommand(w, p.id, { type: 'socket', gemId: gem2.id, itemId: sword.id });
    expect(reasons(w).some((r) => r.includes('Alle Sockel sind belegt'))).toBe(true);
    expect(p.inventory).toContain(gem2);
    applyCommand(w, p.id, { type: 'socket', gemId: gem2.id, itemId: sword.id, index: 0 });
    expect(sword.sockets![0]).toEqual({ kind: 'topaz', q: 3 });
    expect(p.inventory.some((i) => i.slot === 'gem')).toBe(false);
    // ohne Schmied
    const far = createWorld(3, open());
    const q = spawnPlayer(far, 10, 10);
    const s3 = sockets(1)(give(far, q, 'steel_sword', 'magic'));
    const g3 = give(far, q, 'gem_ruby_1');
    drainEvents(far);
    applyCommand(far, q.id, { type: 'socket', gemId: g3.id, itemId: s3.id });
    expect(reasons(far)).toContain('Kein Schmied in der Nähe.');
    expect(s3.sockets![0]).toBeNull();
  });

  it('Neu würfeln und Aufwerten erhalten Sockel und Edelsteine', () => {
    const { w, p } = setup();
    const sword = sockets(2)(give(w, p, 'steel_sword', 'magic'));
    applyCommand(w, p.id, { type: 'socket', gemId: give(w, p, 'gem_ruby_1').id, itemId: sword.id });
    applyCommand(w, p.id, { type: 'craft', itemId: sword.id, op: 'reroll' });
    applyCommand(w, p.id, { type: 'craft', itemId: sword.id, op: 'upgrade' });
    expect(sword.sockets).toEqual([{ kind: 'ruby', q: 1 }, null]);
  });

  it('Edelsteine fallen selten ab Stufe 8, nie darunter; Qualität wächst mit der Stufe', () => {
    const { w } = fresh();
    let totalKills = 0;
    for (let i = 0; i < 400; i++) {
      const p = spawnPlayer(w, 5, 5 + (i % 10));
      p.damage = [9999, 9999];
      const m = spawnMonster(w, 6, 5 + (i % 10), 'zombie');
      m.aggroRange = 0;
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      for (let t = 0; t < 40 && m.alive; t++) tick(w);
      totalKills++;
      w.actors = w.actors.filter((a) => a.id !== p.id);
    }
    const n = w.ground.filter((g) => g.item.slot === 'gem').length;
    expect(totalKills).toBe(400);
    expect(n).toBeGreaterThan(0);
    expect(n / totalKills).toBeLessThan(GEM_DROP.normal * 4);
    // niedrige Stufe: nie
    const w2 = createWorld(9, open());
    for (let i = 0; i < 300; i++) {
      const p = spawnPlayer(w2, 5, 5);
      p.damage = [9999, 9999];
      const m = spawnMonster(w2, 6, 5, 'goblin');
      m.aggroRange = 0;
      applyCommand(w2, p.id, { type: 'attack', targetId: m.id });
      for (let t = 0; t < 40 && m.alive; t++) tick(w2);
      w2.actors = w2.actors.filter((a) => a.id !== p.id);
    }
    expect(w2.ground.some((g) => g.item.slot === 'gem')).toBe(false);
    const rng = new Rng(6);
    let high = 0;
    for (let i = 0; i < 300; i++) {
      expect(rollGem(rng, () => i, 8).gem!.q).toBe(1);
      if (rollGem(rng, () => i, 25).gem!.q === 3) high++;
    }
    expect(high).toBeGreaterThan(20);
    for (const k of GEM_KINDS) expect(TEMPLATES.some((t) => t.id === `gem_${k}_1`)).toBe(true);
  });

  it('Spielstand: Sockel und Edelsteine werden gespeichert, kaputte Sockel verworfen', () => {
    const { w, p } = setup();
    const sword = sockets(2)(give(w, p, 'steel_sword', 'magic'));
    applyCommand(w, p.id, { type: 'socket', gemId: give(w, p, 'gem_ruby_2').id, itemId: sword.id });
    give(w, p, 'gem_topaz_1');
    const json = exportPlayer(p);
    const w2 = createWorld(1, open());
    const q = spawnPlayer(w2, 1, 1);
    importPlayer(w2, q, json);
    expect(q.inventory.find((i) => i.templateId === 'steel_sword')!.sockets).toEqual([{ kind: 'ruby', q: 2 }, null]);
    expect(q.inventory.find((i) => i.slot === 'gem')!.gem).toEqual({ kind: 'topaz', q: 1 });
    const bad = { ...generateItem(w.rng, 99, 'steel_sword', 'magic'), sockets: [{ kind: 'quark', q: 9 }] };
    const w3 = createWorld(1, open());
    const q3 = spawnPlayer(w3, 1, 1);
    importPlayer(w3, q3, JSON.stringify({ v: 1, mapV: 3, player: { level: 3, inventory: [bad] } }));
    expect(q3.inventory).toHaveLength(0);
  });

  it('Unikate können Sockel haben', () => {
    let any = false;
    for (let i = 0; i < 50 && !any; i++) any = !!generateLegendary(new Rng(i), 1, 'harkon_blade').sockets;
    expect(any).toBe(true);
  });
});

describe('P2: Netz-Validierung', () => {
  const w = createWorld(1, open());
  it('socket: nur ganze Zahlen, Index 0–2', () => {
    expect(validateCommand(w, { type: 'socket', gemId: 4, itemId: 5 })).toEqual({ type: 'socket', gemId: 4, itemId: 5 });
    expect(validateCommand(w, { type: 'socket', gemId: 4, itemId: 5, index: 2 })).toEqual({ type: 'socket', gemId: 4, itemId: 5, index: 2 });
    expect(validateCommand(w, { type: 'socket', gemId: 4, itemId: 5, index: 3 })).toBeNull();
    expect(validateCommand(w, { type: 'socket', gemId: 4, itemId: 5, index: -1 })).toBeNull();
    expect(validateCommand(w, { type: 'socket', gemId: 'x', itemId: 5 })).toBeNull();
    expect(validateCommand(w, { type: 'socket', gemId: 4.5, itemId: 5 })).toBeNull();
    expect(validateCommand(w, { type: 'socket', itemId: 5 })).toBeNull();
    expect(validateCommand(w, { type: 'socket', gemId: 1, itemId: 5, index: 1, extra: 'x' })).toEqual({ type: 'socket', gemId: 1, itemId: 5, index: 1 });
  });
  it('unequip kennt die neuen Slots, aber keine fremden', () => {
    for (const slot of ['belt', 'cloak', 'legs', 'ring2']) expect(validateCommand(w, { type: 'unequip', slot })).toEqual({ type: 'unequip', slot });
    expect(validateCommand(w, { type: 'unequip', slot: 'gem' })).toBeNull();
    expect(validateCommand(w, { type: 'unequip', slot: 'tail' })).toBeNull();
  });
});
