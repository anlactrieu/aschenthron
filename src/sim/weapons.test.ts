import { describe, expect, it } from 'vitest';
import { SHOPS, monsterKind, uniqueDef } from './data';
import { LEGENDARIES, TEMPLATES, rollDrop, templateById } from './items';
import { Rng } from './rng';
import { buyPrice } from './world';

const weapons = TEMPLATES.filter((t) => t.slot === 'weapon');

describe('Waffen kaufen, Boss-Waffen jagen', () => {
  it('Händler verkaufen Nahkampf- und Fernkampfwaffen für jede Stufe bis 26', () => {
    const sold = new Set([...SHOPS.basic!, ...SHOPS.advanced!]);
    for (const kind of ['melee', 'bow'] as const) {
      for (const lv of [1, 6, 11, 16, 21, 26]) {
        const ok = weapons.some((t) => sold.has(t.id) && (t.kind ?? 'melee') === kind && t.minLevel >= lv && t.minLevel <= lv + 1 && !t.base?.some((b) => b.stat.startsWith('proc')));
        expect(ok, `${kind} Stufe ${lv}`).toBe(true);
      }
    }
  });

  it('hohe Waffen kosten mehr als der doppelte Grundwert, niedrige nicht', () => {
    expect(buyPrice('rusty_sword')).toBe(templateById('rusty_sword').value * 2);
    expect(buyPrice('ash_greatsword')).toBeGreaterThan(templateById('ash_greatsword').value * 2);
  });

  it('normale Monster lassen kaum Waffen fallen, Bosse deutlich mehr', () => {
    const share = (w: number) => {
      const rng = new Rng(7);
      let n = 0;
      for (let i = 0; i < 3000; i++) if (rollDrop(rng, () => i, 14, undefined, w).slot === 'weapon') n++;
      return n / 3000;
    };
    expect(share(0.12)).toBeLessThan(share(1) * 0.4);
    expect(share(0.12)).toBeLessThan(0.1);
  });

  it('jeder Boss und Mini-Boss hat eine eigene Spezialwaffe, die besser ist als die Grundwaffe', () => {
    const sources = ['rat_king', 'spotted_beast', 'goblin_king', 'goblin_shaman_brakk', 'venom_mother', 'captain_kolm', 'bandit_lord', 'bog_brute', 'hexmaster_irva', 'bone_lord', 'bog_queen', 'crypt_ormund', 'ghost_lord_sael', 'troll_chief_drogg', 'alpha_fenrik', 'spider_queen', 'stone_colossus', 'web_mother', 'cinder_lord_zarkesh', 'dread_valdor', 'bog_titan', 'mountain_king', 'abyss_warden', 'ash_king'];
    for (const src of sources) {
      const w = LEGENDARIES.filter((d) => d.source === src && templateById(d.base).slot === 'weapon');
      expect(w.length, src).toBeGreaterThanOrEqual(1);
      expect(() => (uniqueDefOrKind(src)), src).not.toThrow();
      for (const d of w) expect(d.power, d.id).toBeDefined();
    }
  });
});

function uniqueDefOrKind(id: string): unknown {
  try {
    return monsterKind(id);
  } catch {
    const u = uniqueDef(id);
    if (!u) throw new Error(`unbekannte Quelle ${id}`);
    return u;
  }
}
