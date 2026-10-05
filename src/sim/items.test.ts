import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { generateItem, TEMPLATES } from './items';
import {
  applyCommand, armorOf, carryCapacity, createWorld, damageRange, drainEvents,
  spawnMonster, spawnPlayer, tick, type World,
} from './world';
import type { Grid } from './path';

const grid = (): Grid => ({ w: 12, h: 12, walkable: new Array(144).fill(true) });

function giveItem(w: World, templateId: string, rarity: 'normal' | 'magic' | 'rare' = 'normal') {
  const p = w.actors[0]!;
  const it = generateItem(w.rng, w.nextId++, templateId, rarity);
  p.inventory.push(it);
  return { p, it };
}

describe('Items', () => {
  it('Affix-Anzahl passt zur Seltenheit', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 50; i++) {
      expect(generateItem(rng, i, 'rusty_sword', 'normal').affixes).toHaveLength(0);
      const m = generateItem(rng, i, 'rusty_sword', 'magic').affixes.length;
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(2);
      const r = generateItem(rng, i, 'rusty_sword', 'rare').affixes.length;
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThanOrEqual(4);
    }
  });

  it('gleicher Seed ergibt gleiches Item', () => {
    const a = generateItem(new Rng(9), 1, 'ash_mail', 'rare');
    const b = generateItem(new Rng(9), 1, 'ash_mail', 'rare');
    expect(a).toEqual(b);
  });

  it('Ausrüsten erhöht Schaden und Rüstung', () => {
    const w = createWorld(1, grid());
    const p = spawnPlayer(w, 1, 1);
    p.attrs.kraft = 12;
    const base = damageRange(p);
    const { it: sword } = giveItem(w, 'bone_club');
    const { it: mail } = giveItem(w, 'ash_mail');
    applyCommand(w, p.id, { type: 'equip', itemId: sword.id });
    applyCommand(w, p.id, { type: 'equip', itemId: mail.id });
    expect(damageRange(p)[1]).toBeGreaterThan(base[1]);
    expect(armorOf(p)).toBe(4);
    expect(p.inventory).toHaveLength(0);
  });

  it('zwei Ringe und ein Amulett lassen sich gleichzeitig tragen', () => {
    const w = createWorld(1, grid());
    const p = spawnPlayer(w, 1, 1);
    const { it: r1 } = giveItem(w, 'iron_ring');
    const { it: r2 } = giveItem(w, 'iron_ring');
    const { it: r3 } = giveItem(w, 'iron_ring');
    const { it: am } = giveItem(w, 'bone_charm');
    applyCommand(w, p.id, { type: 'equip', itemId: r1.id });
    applyCommand(w, p.id, { type: 'equip', itemId: r2.id });
    applyCommand(w, p.id, { type: 'equip', itemId: am.id });
    expect(p.equipment.ring?.id).toBe(r1.id);
    expect(p.equipment.ring2?.id).toBe(r2.id);
    expect(p.equipment.amulet?.id).toBe(am.id);
    // dritter Ring ersetzt das erste Feld, der alte Ring kommt in den Rucksack
    applyCommand(w, p.id, { type: 'equip', itemId: r3.id });
    expect(p.equipment.ring?.id).toBe(r3.id);
    expect(p.inventory.map((i) => i.id)).toContain(r1.id);
    applyCommand(w, p.id, { type: 'unequip', slot: 'ring2' });
    expect(p.equipment.ring2).toBeUndefined();
  });

  it('Anforderung verhindert Ausrüsten', () => {
    const w = createWorld(1, grid());
    const p = spawnPlayer(w, 1, 1);
    p.attrs.kraft = 5;
    const { it } = giveItem(w, 'ash_mail');
    applyCommand(w, p.id, { type: 'equip', itemId: it.id });
    expect(p.equipment.chest).toBeUndefined();
    expect(drainEvents(w).some((e) => e.type === 'cannotEquip')).toBe(true);
  });

  it('Gewichtslimit blockiert Aufheben, Kraft erhöht Kapazität', () => {
    const w = createWorld(1, grid());
    const p = spawnPlayer(w, 1, 1);
    expect(carryCapacity(p)).toBe(50);
    for (let i = 0; i < 4; i++) giveItem(w, 'ash_mail'); // 48 Gewicht
    const heavy = generateItem(w.rng, w.nextId++, 'bone_club', 'normal'); // 9
    w.ground.push({ id: w.nextId++, x: 2, y: 1, item: heavy, expiresAt: null });
    applyCommand(w, p.id, { type: 'pickup', groundId: w.ground[0]!.id });
    for (let i = 0; i < 100; i++) tick(w);
    expect(w.ground).toHaveLength(1);
    expect(drainEvents(w).some((e) => e.type === 'tooHeavy')).toBe(true);
    p.attrs.kraft = 20;
    applyCommand(w, p.id, { type: 'pickup', groundId: w.ground[0]!.id });
    for (let i = 0; i < 100; i++) tick(w);
    expect(w.ground).toHaveLength(0);
    expect(p.inventory).toHaveLength(5);
  });

  it('Monster lässt Beute fallen, Spieler hebt sie auf', () => {
    // Seeds durchprobieren, bis ein Drop fällt (Drop-Chance < 100 %)
    for (let seed = 1; seed < 50; seed++) {
      const w = createWorld(seed, grid());
      const p = spawnPlayer(w, 1, 1);
      p.damage = [500, 500];
      const m = spawnMonster(w, 3, 1);
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      for (let i = 0; i < 600 && m.alive; i++) tick(w);
      if (w.ground.length === 0) continue;
      const n = w.ground.length;
      for (const g of [...w.ground]) {
        applyCommand(w, p.id, { type: 'pickup', groundId: g.id });
        for (let i = 0; i < 100; i++) tick(w);
      }
      expect(p.inventory).toHaveLength(n);
      expect(w.ground).toHaveLength(0);
      return;
    }
    throw new Error('Kein Drop in 50 Seeds');
  });

  it('Templates haben eindeutige IDs', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});

describe('Drop-Pool', () => {
  it('jeder Slot hat für jede Monsterstufe passende Drops', async () => {
    const { TEMPLATES } = await import('./items');
    const slots = ['weapon', 'head', 'chest', 'hands', 'feet', 'ring', 'amulet', 'offhand', 'belt', 'cloak', 'legs'];
    for (let lvl = 2; lvl <= 16; lvl++) {
      for (const slot of slots) {
        const ok = TEMPLATES.some((t) => t.slot === slot && t.minLevel <= lvl && t.minLevel >= lvl - 8);
        expect(ok, `Slot ${slot} bei Level ${lvl}`).toBe(true);
      }
    }
  });
});
