import { describe, expect, it } from 'vitest';
import { MONSTERS, UNIQUES } from '../sim/data';
import { bakeFigure, FIG_ANIMS, FIG_VIEWS } from './figure';
import { MONSTER_DEFS, monsterSpec } from './monster';
import { NPC_FIG_NAMES, npcDef, npcSpec } from './npc';
import { NPC_NAME_SPRITES } from './spriteMap';

describe('Skelett-Monster', () => {
  it('jede Monsterart (und jede Basis eines Unikats) hat eine Figur, keine unbekannten IDs', () => {
    const ids = MONSTERS.map((m) => m.id);
    expect(ids.filter((id) => !MONSTER_DEFS[id])).toEqual([]);
    expect(UNIQUES.map((u) => u.base).filter((id) => !MONSTER_DEFS[id])).toEqual([]);
    expect(Object.keys(MONSTER_DEFS).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('Bosse sind größer (Proportion) und goldumrandet', () => {
    for (const m of MONSTERS.filter((k) => k.boss)) {
      const d = MONSTER_DEFS[m.id]!;
      expect(d.boss, m.id).toBe(true);
      expect(d.body.size ?? 1, m.id).toBeGreaterThanOrEqual(1.3);
    }
  });

  it('alle Arten backen vollständig, im Bild, in vertretbarer Zeit', () => {
    const t0 = performance.now();
    for (const m of MONSTERS) {
      const spec = monsterSpec(m.id)!;
      const s = bakeFigure(spec);
      expect(s.clipped, m.id).toBe(0);
      expect(Object.keys(s.frames).length, m.id).toBe(FIG_VIEWS.length * FIG_ANIMS.reduce((n, a) => n + spec.anims[a], 0));
      expect(s.top, m.id).toBeGreaterThan(6);
      expect(s.cyclePx, m.id).toBeGreaterThan(8);
    }
    // in Node ca. 3-4 s für alle 63 Arten; im Spiel backen Worker sie einzeln im Hintergrund
    expect(performance.now() - t0).toBeLessThan(20000);
  }, 30000);
});

describe('Skelett-NPCs', () => {
  it('jeder benannte NPC hat eine eigene Aufmachung, Truhen bleiben Truhen', () => {
    for (const name of Object.keys(NPC_NAME_SPRITES)) expect(NPC_FIG_NAMES, name).toContain(name);
    expect(npcDef('stash')).toBeNull();
    expect(npcDef('stash', 'Lagerverwalter Ottmar')).not.toBeNull();
    expect(npcDef('merchant', 'Unbekannt')).not.toBeNull();
  });

  it('backt im Bild', () => {
    for (const name of NPC_FIG_NAMES) {
      const s = bakeFigure(npcSpec('quest', name)!);
      expect(s.clipped, name).toBe(0);
    }
  }, 20000);
});
