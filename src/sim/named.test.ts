import { describe, expect, it } from 'vitest';
import { NAMED } from './named';
import { AFFIXES, LEGENDARIES, SETS, SLOTS, TEMPLATES, affixRange, generateItem, generateNamed, namedPool, rollLoot, rollNamed, rollWorldDrop, templateById, type Stat } from './items';
import { LOOT_GROUPS, MONSTERS, NAMED_BANDS, NAMED_SHARE, bandOf } from './data';
import { Rng } from './rng';
import { createWorld, spawnPlayer } from './world';
import { exportPlayer, importPlayer } from './save';

/** Werte, die benannte Funde tragen dürfen: die Affixe der alten Zufallsbeute und die Zauber-/Heilwerte aus Stufe 6. */
const BUILD_STATS: Stat[] = ['spellFire', 'spellFrost', 'healPower'];
const SOCKET_SLOTS = ['weapon', 'chest', 'head', 'legs', 'offhand'];

/** Bänder, in denen eine Gruppe Monster hat. */
function groupBands(group: string): Set<number> {
  const g = LOOT_GROUPS.find((x) => x.id === group)!;
  return new Set(g.monsters.map((id) => bandOf(MONSTERS.find((m) => m.id === id)!.level)));
}

describe('benannte Funde (named.ts)', () => {
  it('IDs und Namen sind eindeutig und kollidieren nicht mit Vorlagen, Unikaten, Sets', () => {
    const ids = NAMED.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = NAMED.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    const taken = new Set([...TEMPLATES.map((t) => t.name), ...LEGENDARIES.map((l) => l.name), ...SETS.flatMap((s) => s.pieces.map((p) => p.name))]);
    for (const n of names) expect(taken.has(n), n).toBe(false);
  });

  it('jeder Fund ist gültig: Vorlage, Slot, Band, Gruppe, Wertezahl, Wertebereich', () => {
    for (const d of NAMED) {
      const t = templateById(d.base);
      expect(t.slot === 'potion' || t.slot === 'gem', d.id).toBe(false);
      expect(t.off === 'arrows', `${d.id}: keine Pfeile`).toBe(false);
      expect(NAMED_BANDS as readonly number[]).toContain(d.band);
      expect(Math.abs(t.minLevel - d.band), `${d.id}: Vorlage ${t.id} Stufe ${t.minLevel} passt nicht zu Band ${d.band}`).toBeLessThanOrEqual(5);
      expect(LOOT_GROUPS.some((g) => g.id === d.group), `${d.id}: Gruppe ${d.group}`).toBe(true);
      expect(groupBands(d.group).has(d.band), `${d.id}: Gruppe ${d.group} jagt nicht im Band ${d.band}`).toBe(true);
      expect(d.affixes.length, d.id).toBe(d.rarity === 'rare' ? 3 : 2);
      expect(new Set(d.affixes.map((a) => a.stat)).size, `${d.id}: Werte doppelt`).toBe(d.affixes.length);
      for (const a of d.affixes) {
        expect(a.tier, `${d.id}: keine Affix-Stufe`).toBeUndefined();
        if (BUILD_STATS.includes(a.stat)) {
          expect(a.value, `${d.id} ${a.stat}`).toBeGreaterThanOrEqual(2);
          expect(a.value, `${d.id} ${a.stat}`).toBeLessThanOrEqual(6 + d.band / 2);
          continue;
        }
        expect(AFFIXES.some((x) => x.stat === a.stat), `${d.id}: Wert ${a.stat} nicht erlaubt`).toBe(true);
        const lo = affixRange(a.stat, d.band, 1)[0];
        const hi = affixRange(a.stat, d.band + 4, 5)[1];
        expect(a.value, `${d.id} ${a.stat} ${a.value} < ${lo}`).toBeGreaterThanOrEqual(lo);
        expect(a.value, `${d.id} ${a.stat} ${a.value} > ${hi}`).toBeLessThanOrEqual(hi);
      }
      if (d.sockets) expect(SOCKET_SLOTS.includes(t.slot) && (t.slot !== 'offhand' || t.off === 'shield'), `${d.id}: Sockel im Slot ${t.slot}`).toBe(true);
      if (d.lore) expect(d.lore.length, `${d.id}: Lore zu lang`).toBeLessThanOrEqual(90);
    }
  });

  it('erzeugte Gegenstände sind fest (zweimal gleich) und tragen ihre ID', () => {
    for (const d of NAMED) {
      const a = generateNamed(1, d.id);
      const b = generateNamed(1, d.id);
      expect(a).toEqual(b);
      expect(a.named).toBe(d.id);
      expect(a.name).toBe(d.name);
      expect(a.rarity).toBe(d.rarity);
    }
  });

  it('je Band und Slot zwei bis drei Funde (Waffen bis vier), aus mehreren Gruppen, etwa ein Drittel selten', () => {
    for (const band of NAMED_BANDS) {
      for (const slot of SLOTS) {
        const hits = NAMED.filter((d) => d.band === band && templateById(d.base).slot === slot);
        expect(hits.length, `Band ${band}, Slot ${slot}`).toBeGreaterThanOrEqual(2);
        expect(hits.length, `Band ${band}, Slot ${slot}`).toBeLessThanOrEqual(slot === 'weapon' ? 4 : 3);
        expect(new Set(hits.map((d) => d.group)).size, `Band ${band}, Slot ${slot}: gleiche Gruppe`).toBeGreaterThanOrEqual(2);
      }
      const inBand = NAMED.filter((d) => d.band === band);
      const rare = inBand.filter((d) => d.rarity === 'rare').length;
      expect(rare / inBand.length, `Band ${band}: Anteil selten`).toBeGreaterThanOrEqual(0.25);
      expect(rare / inBand.length, `Band ${band}: Anteil selten`).toBeLessThanOrEqual(0.45);
    }
  });

  it('kein Fund-Wert liegt über dem Höchstwert der ersten 66 Funde seines Bands (+15 %), kein Ausreißer nach oben', () => {
    const old = NAMED.slice(0, 66);
    for (const d of NAMED.slice(66)) {
      for (const a of d.affixes) {
        const peers = old.filter((o) => o.band === d.band).flatMap((o) => o.affixes.filter((x) => x.stat === a.stat).map((x) => x.value));
        if (!peers.length) continue;
        expect(a.value, `${d.id} ${a.stat}`).toBeLessThanOrEqual(Math.ceil(Math.max(...peers) * 1.15));
      }
    }
  });

  it('T2b Abdeckung: jede Stufe 1–35 hat in jedem Slot einen Fund, Waffen in allen drei Klassen (Nahkampf, Bogen, Stab)', () => {
    const klass = (d: (typeof NAMED)[number]): string => templateById(d.base).kind ?? 'melee';
    for (let lv = 1; lv <= 35; lv++) {
      const pool = namedPool(lv);
      for (const slot of SLOTS) expect(pool.some((d) => templateById(d.base).slot === slot), `Stufe ${lv}, Slot ${slot}`).toBe(true);
      const kinds = new Set(pool.filter((d) => templateById(d.base).slot === 'weapon').map(klass));
      for (const k of ['melee', 'bow', 'staff']) expect(kinds.has(k), `Stufe ${lv}, Waffenklasse ${k}`).toBe(true);
    }
    for (const band of NAMED_BANDS) {
      const kinds = new Set(NAMED.filter((d) => d.band === band && templateById(d.base).slot === 'weapon').map(klass));
      for (const k of ['melee', 'bow', 'staff']) expect(kinds.has(k), `Band ${band}, Waffenklasse ${k}`).toBe(true);
    }
  });

  it('T2b feste Beute: NAMED_SHARE = 1, jede Beute und jede Weltboss-Beute ist ein benannter Fund mit festen Werten', () => {
    expect(NAMED_SHARE).toBe(1);
    const rng = new Rng(77);
    let id = 1;
    for (let lv = 1; lv <= 32; lv++) {
      for (let i = 0; i < 40; i++) {
        const loot = rollLoot(rng, () => id++, lv, LOOT_GROUPS[i % LOOT_GROUPS.length]!.id, NAMED_SHARE);
        expect(loot.named, `Stufe ${lv}: ${loot.name}`).toBeDefined();
        expect(loot).toEqual(generateNamed(loot.id, loot.named!));
        const boss = rollWorldDrop(rng, () => id++, lv);
        expect(boss.named, `Weltboss Stufe ${lv}`).toBeDefined();
        expect(boss.rarity).toBe('rare');
        expect(rollNamed(rng, () => id++, lv)).not.toBeNull();
      }
    }
  });

  it('T2b alte Gegenstände mit Zufallsaffixen bleiben im Spielstand gültig: laden, tragen, verkaufen', () => {
    const w = createWorld(5, { w: 30, h: 30, walkable: new Array(900).fill(true) });
    const p = spawnPlayer(w, 10, 10);
    p.level = 30;
    for (const k of ['kraft', 'gewandtheit', 'ausdauer', 'verstand'] as const) p.attrs[k] = 40;
    const magic = generateItem(new Rng(3), 1, 'steel_sword', 'magic');
    const rare = generateItem(new Rng(4), 2, 'ash_mail', 'rare');
    expect(magic.named).toBeUndefined();
    expect(rare.affixes.length).toBeGreaterThan(2);
    p.inventory = [magic];
    p.equipment = { chest: rare };
    const json = exportPlayer(p);
    const w2 = createWorld(5, { w: 30, h: 30, walkable: new Array(900).fill(true) });
    const q = spawnPlayer(w2, 10, 10);
    expect(importPlayer(w2, q, json)).toBe(true);
    expect(q.inventory[0]).toMatchObject({ name: magic.name, rarity: 'magic', affixes: magic.affixes });
    expect(q.equipment.chest).toMatchObject({ name: rare.name, rarity: 'rare', affixes: rare.affixes });
  });
});
