export type AttrKey = 'kraft' | 'gewandtheit' | 'ausdauer' | 'verstand' | 'willenskraft';
export const ATTR_KEYS: AttrKey[] = ['kraft', 'gewandtheit', 'ausdauer', 'verstand', 'willenskraft'];
export const ATTR_NAME: Record<AttrKey, string> = {
  kraft: 'Kraft', gewandtheit: 'Gewandtheit', ausdauer: 'Ausdauer', verstand: 'Verstand', willenskraft: 'Willenskraft',
};

export const MAX_LEVEL = 20;
export const STAT_POINTS_PER_LEVEL = 5;
export const START_STAT_POINTS = 10;

/** Gesamt-XP, die für das Erreichen von `level` nötig sind. */
export function totalXpFor(level: number): number {
  return 50 * (level - 1) * level;
}

export interface MonsterKind {
  id: string;
  name: string;
  level: number;
  hp: number;
  damage: [number, number];
  /** Tiles pro Tick */
  speed: number;
  attackCooldown: number;
  aggroRange: number;
  xp: number;
  gold: [number, number];
  dropChance: number;
  boss?: boolean;
  color: number;
}

export const MONSTERS: MonsterKind[] = [
  { id: 'grave_rat', name: 'Grabratte', level: 1, hp: 30, damage: [2, 5], speed: 0.1, attackCooldown: 18, aggroRange: 5, xp: 10, gold: [1, 4], dropChance: 0.4, color: 0x9a7b5a },
  { id: 'bog_ghoul', name: 'Sumpfghul', level: 3, hp: 70, damage: [5, 10], speed: 0.085, attackCooldown: 22, aggroRange: 6, xp: 28, gold: [4, 10], dropChance: 0.5, color: 0x5a8a5a },
  { id: 'wraith', name: 'Friedhofsgeist', level: 7, hp: 130, damage: [10, 18], speed: 0.09, attackCooldown: 20, aggroRange: 7, xp: 70, gold: [10, 22], dropChance: 0.55, color: 0x8a9ad8 },
  { id: 'bone_knight', name: 'Knochenritter', level: 12, hp: 260, damage: [18, 30], speed: 0.08, attackCooldown: 24, aggroRange: 7, xp: 140, gold: [20, 40], dropChance: 0.6, color: 0xd8d0b8 },
  { id: 'ash_king', name: 'Aschenkönig', level: 16, hp: 1400, damage: [30, 48], speed: 0.075, attackCooldown: 26, aggroRange: 9, xp: 1500, gold: [200, 300], dropChance: 1, boss: true, color: 0xd86a2a },
];

export function monsterKind(id: string): MonsterKind {
  const k = MONSTERS.find((m) => m.id === id);
  if (!k) throw new Error(`Unbekanntes Monster: ${id}`);
  return k;
}

export interface SkillDef {
  id: string;
  name: string;
  area: 'Nahkampf' | 'Fernkampf' | 'Magie';
  levelReq: number;
  price: number;
  mana: number;
  cooldown: number;
  range: number;
  /** Faktor auf den Waffenschaden (Nahkampf) */
  mult?: number;
  /** Fester Schadensbereich (Fern/Magie) */
  base?: [number, number];
  scales?: AttrKey;
  ignoresArmor: boolean;
  desc: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'power_strike', name: 'Wuchtschlag', area: 'Nahkampf', levelReq: 2, price: 50, mana: 8, cooldown: 60, range: 1.5, mult: 2, ignoresArmor: false, desc: 'Doppelter Waffenschaden im Nahkampf.' },
  { id: 'quick_shot', name: 'Schnellschuss', area: 'Fernkampf', levelReq: 2, price: 60, mana: 4, cooldown: 20, range: 6, base: [6, 12], scales: 'gewandtheit', ignoresArmor: false, desc: 'Schneller Schuss auf Distanz, skaliert mit Gewandtheit.' },
  { id: 'ember_bolt', name: 'Glutblitz', area: 'Magie', levelReq: 3, price: 80, mana: 10, cooldown: 30, range: 7, base: [10, 18], scales: 'verstand', ignoresArmor: true, desc: 'Magischer Schaden, ignoriert Rüstung, skaliert mit Verstand.' },
];

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export const SAFE_REGEN = 0.5;
export const FIELD_REGEN = 0.02;
