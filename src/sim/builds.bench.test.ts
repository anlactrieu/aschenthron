import { describe, expect, it } from 'vitest';
import { SKILLS, SKILL_POINTS_PER_LEVEL, SKILL_POINTS_START, STAT_POINTS_PER_LEVEL, START_STAT_POINTS, rankLevelReq, type AttrKey } from './data';
import { TEMPLATES, generateItem } from './items';
import {
  applyCommand, createWorld, drainEvents, maxManaOf, missingReq, spawnMonster, spawnPlayer, tick, TICK_RATE, type Actor, type World,
} from './world';
import type { Grid } from './path';

/**
 * Build-Benchmark (Stufe 6, Phase 5): Schaden pro Sekunde gegen einen reglosen Gegner derselben Stufe in 60 s,
 * Mana wird alle 15 s aufgefüllt (Tränke). Misst keine Überlebensfähigkeit; schützt vor Ausreißern, bei denen ein Build
 * die anderen um ein Vielfaches übertrifft.
 *
 * Messwerte (Stufe 10/20/30, DPS, Mana realistisch begrenzt): vor der Nahkampf-Anpassung Nahkämpfer 115/245/362, Schildkämpfer 72/180/269,
 * Fernkämpfer 220/541/1207, Elementarmagier 142/429/1006, Kampfmagier 109/297/551 (gleich auf dem Stand vor Stufe 6: Nahkämpfer 115/245/362,
 * Fernkämpfer 215/519/1154 – der Abstand war schon im Altbestand da). Fern- und Zauber-Skills skalieren mit ihrem Attribut (Faktor wächst mit
 * der Stufe), Nahkampf-Skills nur über den Waffenschaden. Entscheidung: Nahkampf-Skills (`mult`) bekommen einen Kraft-Term
 * (`MELEE_SKILL_KRAFT_SCALE`), Grundangriff unverändert. Danach: Nahkämpfer 144/314/493, Schildkämpfer 91/237/374, Fernkämpfer 220/541/1207,
 * Elementarmagier 142/429/1006, Kampfmagier 141/443/898. Nahkämpfer zahlen weniger Mana und halten mehr aus (hier nicht gemessen: der Gegner ist reglos).
 */
const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });

interface Spec {
  name: string;
  attrs: Partial<Record<AttrKey, number>>;
  skills: string[];
  weapon: (t: (typeof TEMPLATES)[number]) => boolean;
  shield?: boolean;
  arrows?: boolean;
  range: number;
}
const SPECS: Spec[] = [
  { name: 'Nahkämpfer', attrs: { kraft: 0.55, gewandtheit: 0.25, ausdauer: 0.2 }, skills: ['skull_split', 'power_strike', 'armor_break'], weapon: (t) => !t.kind && t.hands === 2, range: 1 },
  { name: 'Schildkämpfer', attrs: { kraft: 0.4, ausdauer: 0.4, gewandtheit: 0.2 }, skills: ['power_strike', 'parry', 'shield_mastery'], weapon: (t) => !t.kind && (t.hands ?? 1) === 1, shield: true, range: 1 },
  { name: 'Fernkämpfer', attrs: { gewandtheit: 0.7, ausdauer: 0.2, verstand: 0.1 }, skills: ['multishot', 'poison_shot', 'quick_shot', 'precision'], weapon: (t) => t.kind === 'bow', arrows: true, range: 6 },
  { name: 'Elementarmagier', attrs: { verstand: 0.7, willenskraft: 0.15, ausdauer: 0.15 }, skills: ['lightning', 'fireball', 'ember_bolt', 'mana_flow'], weapon: (t) => t.kind === 'staff', range: 5 },
  { name: 'Kampfmagier', attrs: { kraft: 0.35, verstand: 0.4, ausdauer: 0.25 }, skills: ['power_strike', 'fireball', 'ember_bolt', 'skull_split'], weapon: (t) => !t.kind && (t.hands ?? 1) === 1, range: 1 },
];

function dps(spec: Spec, level: number, seed: number): number {
  const w: World = createWorld(seed, open());
  const p: Actor = spawnPlayer(w, 10, 10);
  p.level = level;
  const points = START_STAT_POINTS + STAT_POINTS_PER_LEVEL * (level - 1);
  for (const [k, f] of Object.entries(spec.attrs)) p.attrs[k as AttrKey] += Math.round(points * f!);
  let sp = SKILL_POINTS_START + SKILL_POINTS_PER_LEVEL * (level - 1);
  for (const id of spec.skills) {
    const s = SKILLS.find((x) => x.id === id)!;
    let rank = 0;
    while (rank < 3 && sp > 0 && level >= rankLevelReq(s.levelReq, rank + 1)) {
      rank++;
      sp--;
    }
    if (rank) {
      p.skills.push(id);
      p.skillRanks[id] = rank;
    }
  }
  const wear = (pool: typeof TEMPLATES) => {
    for (const t of pool.sort((a, b) => (b.damage ? b.damage[0] + b.damage[1] : b.armor ?? 0) - (a.damage ? a.damage[0] + a.damage[1] : a.armor ?? 0))) {
      const it = generateItem(w.rng, w.nextId++, t.id, 'normal');
      if (missingReq(p, it).length) continue;
      p.inventory.push(it);
      applyCommand(w, p.id, { type: 'equip', itemId: it.id });
      if (p.equipment[it.slot as 'weapon' | 'offhand']?.id === it.id) return;
    }
  };
  const ok = (t: (typeof TEMPLATES)[number]) => t.minLevel <= level && t.minLevel >= level - 10 && !t.hint;
  wear(TEMPLATES.filter((t) => t.slot === 'weapon' && ok(t) && spec.weapon(t)));
  if (spec.shield) wear(TEMPLATES.filter((t) => t.slot === 'offhand' && t.off === 'shield' && ok(t)));
  if (spec.arrows) wear(TEMPLATES.filter((t) => t.slot === 'offhand' && t.off === 'arrows' && ok(t)));
  p.maxHp = p.hp = 1e9;
  p.mana = maxManaOf(p);
  const dummy = spawnMonster(w, 10 + spec.range, 10, 'bandit');
  dummy.level = level;
  dummy.hp = dummy.maxHp = 1e12;
  dummy.damage = [0, 0];
  drainEvents(w);
  let dealt = 0;
  const ticks = TICK_RATE * 60;
  const bot = SKILLS.filter((s) => p.skills.includes(s.id) && !s.passive);
  applyCommand(w, p.id, { type: 'attack', targetId: dummy.id });
  for (let i = 0; i < ticks; i++) {
    if (i % (TICK_RATE * 15) === 0) p.mana = maxManaOf(p);
    dummy.x = 10 + spec.range;
    dummy.y = 10;
    dummy.path = [];
    dummy.targetId = null;
    for (const s of bot) {
      if ((p.skillCd[s.id] ?? 0) <= 0 && p.mana >= s.mana * 1.5) applyCommand(w, p.id, { type: 'useSkill', skillId: s.id, targetId: dummy.id });
    }
    if (p.targetId === null) applyCommand(w, p.id, { type: 'attack', targetId: dummy.id });
    tick(w);
    for (const e of drainEvents(w)) if (e.type === 'hit' && e.attackerId === p.id) dealt += e.amount;
  }
  return dealt / 60;
}

describe('Build-Benchmark (Schaden pro Sekunde, Messung)', () => {
  for (const level of [10, 20, 30]) {
    it(`Stufe ${level}: Spannweite der Schadens-Builds bleibt unter Faktor 3,6`, () => {
      const res = SPECS.map((s) => ({ name: s.name, dps: [1, 2, 3].reduce((n, seed) => n + dps(s, level, seed), 0) / 3 }));
      const table = res.map((r) => `${r.name} ${r.dps.toFixed(1)}`).join(' | ');
      const hi = Math.max(...res.map((r) => r.dps));
      const lo = Math.min(...res.map((r) => r.dps));
      console.log(`BENCH L${level}: ${table} (Verhältnis ${(hi / lo).toFixed(2)})`);
      expect(lo, table).toBeGreaterThan(0);
      expect(hi / lo, table).toBeLessThan(3.6);
      // Schild kostet höchstens die Hälfte des Nahkampfschadens (dafür Rüstung, Parieren)
      expect(res[1]!.dps, table).toBeGreaterThan(res[0]!.dps * 0.5);
    });
  }
});
