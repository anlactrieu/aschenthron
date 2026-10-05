import { describe, expect, it } from 'vitest';
import { SHOPS, skillById, STATUS_IDS } from './data';
import { TEMPLATES, generateItem, reqOfTemplate, type Stat } from './items';
import {
  applyCommand, applyStatus, createWorld, drainEvents, spawnMonster, spawnPlayer, tick, TICK_RATE, maxHpOf, type Actor, type World,
} from './world';
import type { Grid } from './path';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });
const NEW = ['pyre_staff', 'ash_igniter', 'rime_staff', 'glacier_staff', 'ember_cloak', 'rime_cloak', 'mender_staff', 'healer_rod', 'mender_ring', 'recovery_ring', 'saint_ring', 'flow_ring', 'tide_ring', 'binding_amulet', 'warlock_amulet', 'parry_blade', 'duelist_blade', 'bulwark_shield', 'tower_shield', 'bastion_plate', 'windrunner_boots'];
const fresh = (seed = 4) => {
  const w = createWorld(seed, open());
  const p = spawnPlayer(w, 10, 10);
  p.level = 30;
  p.attrs = { kraft: 40, gewandtheit: 30, ausdauer: 20, verstand: 40, willenskraft: 10 };
  p.maxHp = p.hp = 5000;
  p.mana = 5000;
  return { w, p };
};
const wear = (w: World, p: Actor, tpl: string, extra?: { stat: Stat; value: number }[]) => {
  const it = generateItem(w.rng, w.nextId++, tpl, 'normal');
  if (extra) it.affixes.push(...extra);
  p.inventory.push(it);
  applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  return it;
};

describe('Stufe 6: Build-Gegenstände (Phase 3)', () => {
  it('Vorlagen: eindeutige IDs, Build-Hinweis, mindestens ein Nachteil, Anforderungen gesetzt', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const id of NEW) {
      const t = TEMPLATES.find((x) => x.id === id)!;
      expect(t, id).toBeDefined();
      expect(t.hint?.length, id).toBeGreaterThan(20);
      // Nachteil: ein negativer Gewinn-Wert oder höhere Manakosten
      expect(t.base?.some((a) => (a.stat === 'manaCost' ? a.value > 0 : a.value < 0)), `${id} braucht einen Nachteil`).toBe(true);
      expect(reqOfTemplate(t).level).toBeGreaterThan(0);
    }
  });

  it('keine reine Itemleiter: Build-Waffen und -Schilde haben weniger Grundwerte oder Tempo-Nachteile als das Standardstück ihrer Stufe', () => {
    const base = (id: string) => TEMPLATES.find((t) => t.id === id)!;
    const avg = (d: [number, number]) => (d[0] + d[1]) / 2;
    expect(avg(base('pyre_staff').damage!)).toBeLessThan(avg(base('bone_staff').damage!));
    expect(avg(base('parry_blade').damage!)).toBeLessThan(avg(base('steel_sword').damage!));
    expect(avg(base('duelist_blade').damage!)).toBeLessThan(avg(base('war_blade').damage!));
    expect(avg(base('mender_staff').damage!)).toBeLessThan(avg(base('oak_staff').damage!));
    // dafür mehr Rüstung, bezahlt mit Bewegung und Angriffstempo
    expect(base('bulwark_shield').armor!).toBeGreaterThan(base('steel_shield').armor!);
    expect(base('bulwark_shield').base!.some((a) => a.stat === 'move' && a.value < 0)).toBe(true);
    expect(base('bastion_plate').armor!).toBeGreaterThan(base('bone_plate').armor!);
  });

  it('Shop führt nur bekannte Vorlagen; neue Build-Stücke sind kaufbar', () => {
    for (const ids of Object.values(SHOPS)) for (const id of ids) expect(TEMPLATES.some((t) => t.id === id), id).toBe(true);
    expect(SHOPS.advanced).toEqual(expect.arrayContaining(['parry_blade', 'mender_ring', 'pyre_staff']));
  });

  it('Feuer-/Frostzauber-Wert erhöht nur die passende Schule', () => {
    const dmg = (extra: { stat: Stat; value: number }[], skill: string) => {
      const { w, p } = fresh(7);
      p.skills = [skill];
      p.skillRanks = { [skill]: 1 };
      wear(w, p, 'oak_staff', extra);
      const m = spawnMonster(w, 12, 10, 'wolf');
      m.hp = m.maxHp = 100000;
      drainEvents(w);
      applyCommand(w, p.id, { type: 'useSkill', skillId: skill, targetId: m.id });
      return drainEvents(w).filter((e) => e.type === 'hit').reduce((n, e) => n + (e.type === 'hit' ? e.amount : 0), 0);
    };
    expect(dmg([{ stat: 'spellFire', value: 50 }], 'ember_bolt')).toBeGreaterThan(dmg([], 'ember_bolt'));
    expect(dmg([{ stat: 'spellFrost', value: 50 }], 'ember_bolt')).toBe(dmg([], 'ember_bolt'));
    expect(dmg([{ stat: 'spellFrost', value: 50 }], 'frost_nova')).toBeGreaterThan(dmg([], 'frost_nova'));
  });

  it('Heilung und Manakosten: Heilkraft stärkt, Manakosten-Wert ändert Kosten, Untergrenze 40 %', () => {
    const heal = (extra: { stat: Stat; value: number }[]) => {
      const { w, p } = fresh();
      p.skills = ['healing_hand'];
      p.skillRanks = { healing_hand: 1 };
      wear(w, p, 'iron_ring', extra);
      p.hp = 100;
      applyCommand(w, p.id, { type: 'useSkill', skillId: 'healing_hand' });
      return p.hp - 100;
    };
    expect(heal([{ stat: 'healPower', value: 50 }])).toBeGreaterThan(heal([]));
    const cost = (v: number) => {
      const { w, p } = fresh();
      p.skills = ['ember_bolt'];
      p.skillRanks = { ember_bolt: 1 };
      wear(w, p, 'iron_ring', [{ stat: 'manaCost', value: v }]);
      const m = spawnMonster(w, 12, 10, 'wolf');
      const before = p.mana;
      applyCommand(w, p.id, { type: 'useSkill', skillId: 'ember_bolt', targetId: m.id });
      return before - p.mana;
    };
    expect(cost(50)).toBe(15);
    expect(cost(-20)).toBe(8);
    expect(cost(-500)).toBe(4);
  });

  it('Kontrolldauer verlängert Betäubung und Verlangsamung des Spielers, nicht Fremdeffekte', () => {
    const stun = (v: number) => {
      const { w, p } = fresh();
      p.skills = ['power_strike'];
      p.skillRanks = { power_strike: 1 };
      wear(w, p, 'iron_ring', [{ stat: 'ctrl', value: v }]);
      const m = spawnMonster(w, 11, 10, 'wolf');
      m.hp = m.maxHp = 100000;
      let until = 0;
      for (let i = 0; i < 20 && !until; i++) {
        p.skillCd = {};
        p.mana = 5000;
        applyCommand(w, p.id, { type: 'useSkill', skillId: 'power_strike', targetId: m.id });
        until = m.status.stun ? m.status.stun - w.tick : 0;
        drainEvents(w);
      }
      return until;
    };
    expect(stun(50)).toBeGreaterThan(stun(0));
    // ein Gegner, der den Spieler betäubt, wird nicht durch dessen Kontrollwert verlängert
    const { w, p } = fresh();
    wear(w, p, 'iron_ring', [{ stat: 'ctrl', value: 100 }]);
    applyStatus(w, p, 'stun', 1, 'physical');
    expect(p.status.stun! - w.tick).toBe(TICK_RATE);
  });

  it('Bewegung: Schilde bremsen, Stiefel beschleunigen (Grenzen 60–130 %)', () => {
    const walked = (tpl: string, extra?: { stat: Stat; value: number }[]) => {
      const { w, p } = fresh();
      if (tpl) wear(w, p, tpl, extra);
      applyCommand(w, p.id, { type: 'moveTo', x: 30, y: 10 });
      for (let i = 0; i < 40; i++) tick(w);
      return p.x;
    };
    const base = walked('');
    expect(walked('bulwark_shield')).toBeLessThan(base);
    expect(walked('windrunner_boots')).toBeGreaterThan(base);
    expect(walked('iron_ring', [{ stat: 'move', value: -500 }])).toBeCloseTo(10 + (base - 10) * 0.6, 0);
    const fast = walked('iron_ring', [{ stat: 'move', value: 500 }]);
    expect(fast).toBeGreaterThan(base);
    expect(fast).toBeLessThanOrEqual(10 + (base - 10) * 1.3 + 0.01); // Obergrenze 130 %
  });

  it('Parieren als Itemwert wirkt auch ohne Skill, aber nur mit Einhandwaffe/Schild; Gesamt höchstens 25 %', () => {
    const parried = (weapon: string, parry: number) => {
      const { w, p } = fresh(33);
      wear(w, p, weapon, [{ stat: 'parry', value: parry }]);
      p.attrs.gewandtheit = 1;
      const m = spawnMonster(w, 11, 10, 'wolf');
      m.targetId = p.id;
      m.level = 200;
      let n = 0;
      for (let i = 0; i < 600; i++) {
        m.cooldownLeft = 0;
        m.x = p.x + 1;
        m.y = p.y;
        p.hp = p.maxHp;
        tick(w);
        n += drainEvents(w).filter((e) => e.type === 'miss').length;
      }
      return n;
    };
    expect(parried('steel_sword', 25)).toBeGreaterThan(parried('steel_sword', 0));
    expect(parried('claymore', 25)).toBe(parried('claymore', 0));
    const hi = parried('steel_sword', 500);
    expect(hi).toBeLessThan(600 * 0.4);
  });

  it('Negative Basiswerte wirken: Strömungsring kostet Leben, Nachteil-Stats zählen', () => {
    const { w, p } = fresh();
    const hp0 = maxHpOf(p);
    wear(w, p, 'flow_ring');
    expect(maxHpOf(p)).toBe(hp0 - 20);
    expect(skillById('ember_bolt')).toBeDefined();
    expect(STATUS_IDS.length).toBeGreaterThan(3);
  });
});
