import { describe, expect, it } from 'vitest';
import { generateItem } from './items';
import { SKILLS } from './data';
import { applyCommand, createWorld, drainEvents, spawnMonster, spawnPlayer, type Actor } from './world';
import type { Grid } from './path';

/**
 * Golden-Test: Werte, Ereignisse und RNG-Stand jedes Skills in festen Szenarien.
 * Schützt das Refactoring von `useSkill` (Stufe 6, Phase 1): die 12 Alt-Skills müssen identisch bleiben.
 */
const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });

function setup(seed: number, weapon: string | null, offhand: string | null, rank: number, critBuild: boolean) {
  const w = createWorld(seed, open());
  const p = spawnPlayer(w, 10, 10);
  p.level = 20;
  p.attrs = { kraft: 30, gewandtheit: 30, ausdauer: 20, verstand: 30, willenskraft: 20 };
  p.maxHp = p.hp = 5000;
  p.mana = 5000;
  p.skills = SKILLS.map((s) => s.id);
  p.skillRanks = Object.fromEntries(SKILLS.map((s) => [s.id, rank]));
  for (const id of [weapon, offhand]) {
    if (!id) continue;
    const it = generateItem(w.rng, w.nextId++, id, 'normal');
    p.inventory.push(it);
    applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  }
  if (critBuild) p.equipment.ring = Object.assign(generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'), { affixes: [{ stat: 'crit' as const, value: 40 }] });
  const victims: Actor[] = [spawnMonster(w, 12, 10, 'goblin_warrior'), spawnMonster(w, 13, 11, 'skeleton'), spawnMonster(w, 11, 12, 'venom_spider'), spawnMonster(w, 14, 10, 'stone_golem')];
  drainEvents(w);
  return { w, p, victims };
}

function run(skillId: string, o: { weapon?: string | null; offhand?: string | null; rank?: number; crit?: boolean; seed?: number; hurt?: boolean }) {
  const { w, p, victims } = setup(o.seed ?? 5, o.weapon ?? 'steel_sword', o.offhand ?? null, o.rank ?? 1, o.crit ?? false);
  if (o.hurt) p.hp = 100;
  applyCommand(w, p.id, { type: 'useSkill', skillId, targetId: victims[0]!.id });
  const ev = drainEvents(w).filter((e) => e.type !== 'note');
  return {
    ev,
    hp: Math.round(p.hp),
    mana: p.mana,
    cd: p.skillCd,
    auto: p.autoAttack,
    target: p.targetId,
    victims: victims.map((v) => ({ hp: v.hp, status: v.status, dot: v.dot, burn: v.burn, target: v.targetId })),
    next: w.rng.next(),
  };
}

describe('Skills golden', () => {
  for (const s of SKILLS) {
    it(`${s.id} Rang 1`, () => {
      expect(run(s.id, { weapon: s.area === 'Fernkampf' ? 'hunt_bow' : s.area === 'Magie' ? 'oak_staff' : 'steel_sword', offhand: s.area === 'Fernkampf' ? 'iron_arrows' : null, hurt: s.id === 'healing_hand' })).toMatchSnapshot();
    });
  }
  it('Rang 4, Krit, mehrere Seeds', () => {
    for (const id of ['power_strike', 'whirlwind', 'frost_nova', 'fireball', 'multishot', 'poison_shot', 'lightning', 'healing_hand']) {
      const bow = id === 'multishot' || id === 'poison_shot';
      for (const seed of [1, 2, 3]) expect(run(id, { weapon: bow ? 'yew_bow' : 'bone_staff', offhand: bow ? 'steel_arrows' : null, rank: 4, crit: true, seed, hurt: id === 'healing_hand' })).toMatchSnapshot();
    }
  });
  it('Fehlerpfade: Bogen fehlt, Pfeile fehlen, Stab-Bonus, Zweihand-Nahkampf', () => {
    expect(run('quick_shot', { weapon: 'steel_sword' })).toMatchSnapshot();
    expect(run('quick_shot', { weapon: 'hunt_bow' })).toMatchSnapshot();
    expect(run('ember_bolt', { weapon: 'void_staff' })).toMatchSnapshot();
    expect(run('ember_bolt', { weapon: 'steel_sword' })).toMatchSnapshot();
    expect(run('power_strike', { weapon: 'claymore' })).toMatchSnapshot();
  });
});
