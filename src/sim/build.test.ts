import { describe, expect, it } from 'vitest';
import { ARCHETYPES, buildProfile, type ArchetypeId } from './build';
import { generateItem, type Stat } from './items';
import { applyCommand, createWorld, spawnPlayer, type Actor } from './world';
import type { Grid } from './path';

const open = (): Grid => ({ w: 20, h: 20, walkable: new Array(400).fill(true) });
function make(attrs: Partial<Actor['attrs']>, skills: Record<string, number>, gear: string[] = [], extra: { stat: Stat; value: number }[] = []): Actor {
  const w = createWorld(1, open());
  const p = spawnPlayer(w, 5, 5);
  p.level = 30;
  Object.assign(p.attrs, attrs);
  p.skills = Object.keys(skills);
  p.skillRanks = { ...skills };
  for (const id of gear) {
    const it = generateItem(w.rng, w.nextId++, id, 'normal');
    if (extra.length && it.slot === 'ring') it.affixes.push(...extra);
    p.inventory.push(it);
    p.attrs.kraft = Math.max(p.attrs.kraft, 40);
    applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  }
  return p;
}

describe('Buildprofil', () => {
  it('Frischer Charakter ist unspezialisiert', () => {
    expect(buildProfile(make({}, {})).primary).toBeNull();
  });

  const cases: [string, ArchetypeId, () => Actor][] = [
    ['Nahkämpfer', 'melee', () => make({ kraft: 50 }, { skull_split: 3, power_strike: 3, armor_break: 2 }, ['claymore'])],
    ['Schildkämpfer', 'shield', () => make({ kraft: 30, ausdauer: 40 }, { parry: 4, shield_mastery: 3, stone_skin: 2 }, ['steel_sword', 'bulwark_shield'])],
    ['Elementarmagier', 'elemental', () => make({ verstand: 55, willenskraft: 20 }, { fireball: 3, ember_bolt: 3, lightning: 2, mana_flow: 3 }, ['pyre_staff'])],
    ['Heiler', 'healer', () => make({ verstand: 35, willenskraft: 45 }, { healing_hand: 4, cleanse: 3, first_aid: 3, elemental_ward: 2 }, ['mender_staff'])],
    ['Fernkämpfer', 'ranged', () => make({ gewandtheit: 55 }, { quick_shot: 3, poison_shot: 3, multishot: 3, precision: 3, stealth: 2 }, ['yew_bow', 'iron_arrows'])],
    ['Kontrolle', 'control', () => make({ verstand: 30 }, { weaken: 3, curse: 3, silence: 3, dispel_magic: 2 }, [], [])],
  ];
  for (const [label, id, build] of cases) {
    it(`${label} wird erkannt`, () => {
      const r = buildProfile(build());
      expect([r.primary?.id, r.secondary?.id], JSON.stringify(r.scores.map((s) => [s.arch.id, s.score]))).toContain(id);
      expect(r.primary).not.toBeNull();
    });
  }

  it('Kampfmagier: Nahkampf und Magie gleich stark', () => {
    const p = make({ kraft: 40, verstand: 40 }, { power_strike: 4, skull_split: 3, fireball: 4, ember_bolt: 3, healing_hand: 2 }, ['steel_sword']);
    const r = buildProfile(p);
    expect([r.primary?.id, r.secondary?.id]).toContain('battlemage');
  });

  it('Jeder Archetyp hat Name und Empfehlung', () => {
    for (const a of ARCHETYPES) {
      expect(a.name.length).toBeGreaterThan(5);
      expect(a.tip.length).toBeGreaterThan(30);
    }
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(7);
  });
});
