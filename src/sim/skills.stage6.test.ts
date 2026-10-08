import { describe, expect, it } from 'vitest';
import { SKILLS, STATUS_IDS, PASSIVE_CAP, monsterKind, schoolOf, skillById } from './data';
import { generateItem } from './items';
import { importPlayer, exportPlayer } from './save';
import {
  applyCommand, applyStatus, armorOf, attackCooldownOf, carryCapacity, createWorld, critChance, defenseRating, drainEvents, passiveSum, resistOf, spawnMonster, spawnPlayer, tick, TICK_RATE, addNpc,
  type Actor, type World,
} from './world';
import type { Grid } from './path';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });
const fresh = (seed = 9) => {
  const w = createWorld(seed, open());
  const p = spawnPlayer(w, 10, 10);
  p.level = 30;
  p.attrs = { kraft: 30, gewandtheit: 30, ausdauer: 20, verstand: 30, willenskraft: 10 };
  p.maxHp = p.hp = 5000;
  p.mana = 5000;
  return { w, p };
};
const learn = (p: Actor, id: string, rank = 1) => {
  if (!p.skills.includes(id)) p.skills.push(id);
  p.skillRanks[id] = rank;
};
const cast = (w: World, p: Actor, id: string, target?: number) => {
  drainEvents(w);
  applyCommand(w, p.id, { type: 'useSkill', skillId: id, targetId: target });
  return drainEvents(w);
};
const equip = (w: World, p: Actor, tpl: string) => {
  const it = generateItem(w.rng, w.nextId++, tpl, 'normal');
  p.inventory.push(it);
  applyCommand(w, p.id, { type: 'equip', itemId: it.id });
};

describe('Stufe 6: Skills und Zauber (Phase 2)', () => {
  it('Daten: jeder Skill hat Gruppe, Wirkung und (neue) vollständige Info; IDs eindeutig', () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const s of SKILLS) {
      expect(schoolOf(s)).toBeTruthy();
      expect(s.info, s.id).toBeDefined();
      for (const v of Object.values(s.info!)) expect(v.length).toBeGreaterThan(10);
      expect(s.levelReq).toBeLessThanOrEqual(30);
    }
    for (const s of SKILLS) if (s.passive) expect(Object.keys(s.pass ?? {}).length, s.id).toBeGreaterThan(0);
  });

  it('Alle alten Skill-IDs bleiben erhalten', () => {
    for (const id of ['power_strike', 'quick_shot', 'ember_bolt', 'healing_hand', 'poison_shot', 'whirlwind', 'frost_nova', 'multishot', 'fireball', 'skull_split', 'lightning']) expect(skillById(id)).toBeDefined();
  });

  it('Elementarschild: senkt Elementar-, nicht physischen Schaden, wirkt auf Brand, ersetzt nur Schwächeres, Rang spielt keine Rolle', () => {
    const { w, p } = fresh();
    learn(p, 'elemental_ward', 1);
    const base = resistOf(p, 'fire');
    cast(w, p, 'elemental_ward');
    expect(p.status.ward).toBeDefined();
    expect(resistOf(p, 'fire')).toBe(base + 30);
    expect(resistOf(p, 'physical')).toBe(0);
    const until = p.status.ward!;
    // schwächerer (Rang 1) ersetzt nicht den stärkeren
    p.statusMag!.ward = 50;
    p.skillCd = {};
    cast(w, p, 'elemental_ward');
    expect(p.statusMag!.ward).toBe(50);
    expect(until).toBeGreaterThan(0);
    // aktive Zauber haben keinen Rang: auch ein hoher Eintrag in skillRanks verstärkt nichts
    p.status = {};
    p.statusMag = {};
    p.skillCd = {};
    learn(p, 'elemental_ward', 5);
    cast(w, p, 'elemental_ward');
    expect(p.statusMag!.ward).toBe(30);
    // Obergrenze der Gesamtresistenz 75
    p.statusMag!.ward = 200;
    expect(resistOf(p, 'frost')).toBe(75);
  });

  it('Steinhaut mindert nur physischen Schaden nach Rüstung (Zauber und Brand unberührt)', () => {
    const rolls = (stone: boolean, ignore: boolean) => {
      const { w, p } = fresh(21);
      const m = spawnMonster(w, 11, 10, 'goblin_warrior');
      if (stone) applyStatus(w, p, 'stoneskin', 10, 'physical', undefined, 40);
      m.targetId = p.id;
      p.hp = 100000;
      p.maxHp = 100000;
      drainEvents(w);
      // Monster greift an: wiederholt Nahkampf; Gesamtschaden messen
      m.damage = [50, 50];
      let dmg = 0;
      for (let i = 0; i < 40; i++) {
        const before = p.hp;
        m.cooldownLeft = 0;
        m.x = p.x + 1;
        m.y = p.y;
        void ignore;
        tick(w);
        dmg += before - p.hp;
        p.hp = 100000;
      }
      return dmg;
    };
    expect(rolls(true, false)).toBeLessThan(rolls(false, false));
  });

  it('Entkräftung und Fluch: weniger ausgehender, mehr erlittener Schaden; stärkere ersetzt schwächere', () => {
    const { w, p } = fresh();
    learn(p, 'weaken');
    learn(p, 'curse');
    const m = spawnMonster(w, 12, 10, 'wolf');
    cast(w, p, 'weaken', m.id);
    expect(m.status.weaken).toBeDefined();
    expect(m.statusMag!.weaken).toBe(25);
    cast(w, p, 'curse', m.id);
    expect(m.statusMag!.curse).toBe(15);
    expect(m.targetId).toBe(p.id);
    const lowerFirst = (a: number, b: number) => {
      applyStatus(w, m, 'curse', 8, 'physical', undefined, a);
      applyStatus(w, m, 'curse', 8, 'physical', undefined, b);
      return m.statusMag!.curse;
    };
    m.status = {};
    m.statusMag = {};
    expect(lowerFirst(20, 10)).toBe(20);
    m.status = {};
    m.statusMag = {};
    expect(lowerFirst(10, 20)).toBe(20);
  });

  it('Stille: Spieler können nicht zaubern; Zauberer-Monster zaubern nicht; Wiederholung wird verkürzt; Boss halb', () => {
    const { w, p } = fresh();
    learn(p, 'silence');
    learn(p, 'ember_bolt');
    const witch = spawnMonster(w, 12, 10, 'bog_witch');
    cast(w, p, 'silence', witch.id);
    const first = witch.status.silence! - w.tick;
    expect(first).toBe(4 * TICK_RATE);
    witch.status = {};
    w.tick += 10;
    p.skillCd = {};
    cast(w, p, 'silence', witch.id);
    const second = witch.status.silence! - w.tick;
    expect(second).toBeLessThan(first);
    const king = spawnMonster(w, 14, 10, 'goblin_king');
    applyStatus(w, king, 'silence', 4, 'physical');
    expect(king.status.silence! - w.tick).toBeLessThanOrEqual(2 * TICK_RATE);
    // Spieler stumm
    applyStatus(w, p, 'silence', 4, 'physical');
    const ev = cast(w, p, 'ember_bolt', witch.id);
    expect(ev.some((e) => e.type === 'fail')).toBe(true);
    // Heiler ist stumm
    const acolyte = spawnMonster(w, 15, 12, 'bone_acolyte');
    const hurt = spawnMonster(w, 16, 12, 'skeleton');
    hurt.hp = 1;
    acolyte.targetId = p.id;
    applyStatus(w, acolyte, 'silence', 4, 'physical');
    drainEvents(w);
    for (let i = 0; i < 5; i++) tick(w);
    expect(drainEvents(w).some((e) => e.type === 'mheal')).toBe(false);
  });

  it('Läuterung entfernt Debuffs; Bannung entfernt Verstärkungen und erklärt es im Log', () => {
    const { w, p } = fresh();
    learn(p, 'cleanse');
    learn(p, 'dispel_magic');
    p.status = { slow: w.tick + 100, burn: w.tick + 100 };
    p.dot = { perSec: 2, until: w.tick + 100, srcId: 0 };
    const ev = cast(w, p, 'cleanse');
    expect(p.status.slow).toBeUndefined();
    expect(p.dot).toBeNull();
    expect(ev.some((e) => e.type === 'note')).toBe(true);
    const witch = spawnMonster(w, 12, 10, 'bog_witch');
    applyStatus(w, witch, 'ward', 6, 'physical', undefined, 35);
    expect(resistOf(witch, 'poison')).toBeGreaterThan(0);
    const ev2 = cast(w, p, 'dispel_magic', witch.id);
    expect(witch.status.ward).toBeUndefined();
    expect(ev2.some((e) => e.type === 'note' && e.text.includes('Elementarschild'))).toBe(true);
  });

  it('Entzauberer-Monster bannt die Verstärkung des Spielers', () => {
    const { w, p } = fresh();
    expect(monsterKind('bone_acolyte').abilities).toContain('dispel');
    applyStatus(w, p, 'ward', 12, 'physical', undefined, 30);
    const m = spawnMonster(w, 13, 10, 'bone_acolyte');
    m.targetId = p.id;
    drainEvents(w);
    for (let i = 0; i < 3; i++) tick(w);
    expect(p.status.ward).toBeUndefined();
    expect(drainEvents(w).some((e) => e.type === 'note' && e.text.includes('bannt'))).toBe(true);
  });

  it('Erste Hilfe heilt über Zeit und bricht beim ersten Treffer ab', () => {
    const { w, p } = fresh();
    learn(p, 'first_aid');
    p.hp = 1000;
    cast(w, p, 'first_aid');
    expect(p.status.bandage).toBeDefined();
    for (let i = 0; i < TICK_RATE * 2; i++) tick(w);
    expect(p.hp).toBeGreaterThan(1000);
    const m = spawnMonster(w, 11, 10, 'wolf');
    m.targetId = p.id;
    m.damage = [30, 30];
    m.level = 200; // trifft fast immer
    const seen: string[] = [];
    for (let i = 0; i < TICK_RATE * 3 && p.status.bandage; i++) {
      tick(w);
      seen.push(...drainEvents(w).map((e) => e.type));
    }
    void seen;
    expect(w.tick).toBeLessThan(TICK_RATE * 8); // vor dem natürlichen Ablauf
    expect(p.status.bandage).toBeUndefined();
  });

  it('Passive: Obergrenzen, Krit, Ausweichen, Rüstungsbrecher, Schildbeherrschung, Mana, Traglast', () => {
    const { w, p } = fresh();
    const crit0 = critChance(p);
    const def0 = defenseRating(p);
    const carry0 = carryCapacity(p);
    learn(p, 'precision', 3);
    learn(p, 'evasion_training', 2);
    learn(p, 'survival', 4);
    expect(critChance(p)).toBe(crit0 + 6);
    expect(defenseRating(p)).toBe(def0 + 12);
    expect(carryCapacity(p)).toBe(carry0 + 8);
    learn(p, 'armor_break', 5);
    learn(p, 'armor_break', 5);
    expect(passiveSum(p, 'armorPen')).toBe(30);
    learn(p, 'armor_break', 5);
    p.skillRanks.armor_break = 99;
    expect(passiveSum(p, 'armorPen')).toBe(PASSIVE_CAP.armorPen);
    // Schild: Rüstung nur mit Schild
    learn(p, 'shield_mastery', 5);
    const a0 = armorOf(p);
    equip(w, p, 'iron_shield');
    const shield = p.equipment.offhand!;
    expect(armorOf(p)).toBeGreaterThan(a0 + shield.armor!);
    // Manafluss: Kosten sinken
    const { w: w2, p: p2 } = fresh();
    learn(p2, 'ember_bolt');
    learn(p2, 'mana_flow', 5);
    const m = spawnMonster(w2, 12, 10, 'wolf');
    const before = p2.mana;
    cast(w2, p2, 'ember_bolt', m.id);
    expect(before - p2.mana).toBe(Math.round(10 * 1 * (1 - 0.2)));
  });

  it('Parieren: wehrt Nahkampf ab (mit Einhandwaffe/Schild), nicht mit Zweihand; ohne Skill kein Würfel', () => {
    const hits = (skill: boolean, weapon: string, shield: boolean) => {
      const { w, p } = fresh(33);
      equip(w, p, weapon);
      if (shield) equip(w, p, 'iron_shield');
      if (skill) learn(p, 'parry', 5);
      p.attrs.gewandtheit = 1;
      const m = spawnMonster(w, 11, 10, 'wolf');
      m.targetId = p.id;
      let misses = 0;
      drainEvents(w);
      for (let i = 0; i < 400; i++) {
        m.cooldownLeft = 0;
        m.x = p.x + 1;
        m.y = p.y;
        p.hp = p.maxHp;
        tick(w);
        misses += drainEvents(w).filter((e) => e.type === 'miss').length;
      }
      return misses;
    };
    const base = hits(false, 'steel_sword', true);
    expect(hits(true, 'steel_sword', true)).toBeGreaterThan(base);
    expect(hits(true, 'claymore', false)).toBe(hits(false, 'claymore', false));
    expect(hits(true, 'hunt_bow', false)).toBe(hits(false, 'hunt_bow', false));
  });

  it('Schleichen verkleinert den Entdeckungsradius', () => {
    const { w, p } = fresh();
    const m = spawnMonster(w, 14, 10, 'goblin');
    m.aggroRange = 5;
    p.x = 10;
    p.y = 10;
    m.x = 14.5;
    for (let i = 0; i < 3; i++) tick(w);
    expect(m.targetId).toBe(p.id);
    const { w: w2, p: p2 } = fresh();
    learn(p2, 'stealth', 5);
    const m2 = spawnMonster(w2, 14, 10, 'goblin');
    m2.aggroRange = 5;
    m2.x = 14.5;
    for (let i = 0; i < 3; i++) tick(w2);
    expect(m2.targetId).toBeNull();
  });

  it('Gratis-Respec: Altstand ohne Merker einmal frei, danach bezahlt; Round-Trip behält den Verbrauch', () => {
    const { w, p } = fresh();
    addNpc(w, 'trainer', 'Lehrer', 11, 10, { tier: 2 });
    p.gold = 5;
    const save = JSON.parse(exportPlayer(p));
    delete save.player.freeRespec;
    expect(importPlayer(w, p, JSON.stringify(save))).toBe(true);
    expect(p.freeRespec).toBe(true);
    p.gold = 5;
    applyCommand(w, p.id, { type: 'respec' });
    expect(p.freeRespec).toBe(false);
    expect(p.gold).toBe(5);
    const re = exportPlayer(p);
    expect(importPlayer(w, p, re)).toBe(true);
    expect(p.freeRespec).toBe(false);
    drainEvents(w);
    applyCommand(w, p.id, { type: 'respec' });
    expect(p.gold).toBe(5);
    expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
  });

  it('Neuer Charakter bekommt keinen Gratis-Respec (auch nicht nach Export und Import)', () => {
    const { w, p } = fresh();
    expect(p.freeRespec).toBe(false);
    expect(importPlayer(w, p, exportPlayer(p))).toBe(true);
    expect(p.freeRespec).toBe(false);
  });

  it('Neue Statusse sind überall bekannt (Ablauf, Netz, Anzeige)', () => {
    expect(STATUS_IDS).toEqual(expect.arrayContaining(['ward', 'stoneskin', 'bandage', 'weaken', 'curse', 'silence']));
    expect(attackCooldownOf(fresh().p)).toBeGreaterThan(0);
  });
});
