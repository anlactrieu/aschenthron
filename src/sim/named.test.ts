import { describe, expect, it } from 'vitest';
import { NAMED } from './named';
import { AFFIXES, LEGENDARIES, SETS, SLOTS, TEMPLATES, affixRange, generateNamed, templateById, type Stat } from './items';
import { LOOT_GROUPS, MONSTERS, NAMED_BANDS, bandOf } from './data';

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

  it.skipIf(NAMED.length < 66)('je Band und Slot genau ein Fund (66)', () => {
    for (const band of NAMED_BANDS) {
      for (const slot of SLOTS) {
        const hits = NAMED.filter((d) => d.band === band && templateById(d.base).slot === slot);
        expect(hits.length, `Band ${band}, Slot ${slot}`).toBe(1);
      }
    }
    // etwa ein Drittel selten
    const rare = NAMED.filter((d) => d.rarity === 'rare').length;
    expect(rare).toBeGreaterThanOrEqual(16);
    expect(rare).toBeLessThanOrEqual(28);
  });
});
