export type AttrKey = 'kraft' | 'gewandtheit' | 'ausdauer' | 'verstand' | 'willenskraft';
export const ATTR_KEYS: AttrKey[] = ['kraft', 'gewandtheit', 'ausdauer', 'verstand', 'willenskraft'];
export const ATTR_NAME: Record<AttrKey, string> = {
  kraft: 'Kraft', gewandtheit: 'Gewandtheit', ausdauer: 'Ausdauer', verstand: 'Verstand', willenskraft: 'Willenskraft',
};

export const MAX_LEVEL = 30;
export const STAT_POINTS_PER_LEVEL = 5;
export const START_STAT_POINTS = 10;

/** XP, die von Level `l` auf `l+1` nötig sind. Kill-XP wächst mit L^1.3; der Faktor (1 + l/6) streckt die Kurve nach oben (mehr Kills pro Level im Endgame). */
export const XP_PER_LEVEL_BASE = 190;
export function xpToNext(level: number): number {
  return Math.round(XP_PER_LEVEL_BASE * Math.pow(level, 1.3) * (1 + level / 6));
}

const XP_TABLE: number[] = [0, 0];
for (let l = 1; l <= MAX_LEVEL; l++) XP_TABLE[l + 1] = XP_TABLE[l]! + xpToNext(l);

/** Gesamt-XP, die für das Erreichen von `level` nötig sind. */
export function totalXpFor(level: number): number {
  return XP_TABLE[Math.min(level, MAX_LEVEL + 1)] ?? 0;
}

export type MonsterFamily = 'beast' | 'humanoid' | 'undead' | 'spider' | 'ghoul' | 'golem' | 'demon' | 'worm' | 'elemental';

export interface MonsterKind {
  id: string;
  name: string;
  level: number;
  family: MonsterFamily;
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

/** Zentrale Skalierung: alle Monsterwerte folgen diesen Formeln (Balancing-Regler). */
export const SCALE = {
  hp: (l: number) => 25 + 14 * l + 0.9 * l * l,
  dmgAvg: (l: number) => 5 + 0.85 * l,
  xp: (l: number) => 10 * Math.pow(l, 1.3),
  bossHp: 7,
  bossDmg: 1.5,
  bossXp: 15,
};

function mk(
  id: string, name: string, level: number, family: MonsterFamily, color: number,
  o: { speed?: number; cd?: number; aggro?: number; hp?: number; dmg?: number; boss?: boolean; drop?: number } = {},
): MonsterKind {
  const hpM = (o.hp ?? 1) * (o.boss ? SCALE.bossHp : 1);
  const dmgM = (o.dmg ?? 1) * (o.boss ? SCALE.bossDmg : 1);
  const avg = SCALE.dmgAvg(level) * dmgM;
  return {
    id, name, level, family, color,
    hp: Math.round(SCALE.hp(level) * hpM),
    damage: [Math.max(1, Math.round(avg * 0.7)), Math.max(2, Math.round(avg * 1.3))],
    speed: o.speed ?? 0.1,
    attackCooldown: o.cd ?? 20,
    aggroRange: o.aggro ?? Math.min(9, 5 + Math.floor(level / 8)),
    xp: Math.round(SCALE.xp(level) * (o.boss ? SCALE.bossXp : 1)),
    gold: [Math.round(level * 1.5 + 1), Math.round(level * 3 + 3)],
    dropChance: o.boss ? 1 : (o.drop ?? 0.5),
    boss: o.boss,
  };
}

export const MONSTERS: MonsterKind[] = [
  mk('field_rat', 'Feldratte', 1, 'beast', 0x9a7b5a, { hp: 0.8, dmg: 0.8, speed: 0.11 }),
  mk('wild_hound', 'Wildhund', 2, 'beast', 0x8a6a4a, { speed: 0.12, cd: 17 }),
  mk('bandit_novice', 'Räuberlehrling', 3, 'humanoid', 0xb06a4a),
  mk('forest_spider', 'Waldspinne', 4, 'spider', 0x3a3a48, { speed: 0.115, hp: 0.9 }),
  mk('bog_ghoul', 'Sumpfghul', 6, 'ghoul', 0x5a8a5a, { speed: 0.085, hp: 1.15 }),
  mk('highwayman', 'Wegelagerer', 7, 'humanoid', 0xa05a3a, { dmg: 1.1 }),
  mk('wraith', 'Friedhofsgeist', 9, 'undead', 0x8a9ad8, { speed: 0.095, hp: 0.9, dmg: 1.15 }),
  mk('bog_witch', 'Sumpfhexe', 11, 'humanoid', 0x7a4a8a, { hp: 0.85, dmg: 1.3 }),
  mk('bone_knight', 'Knochenritter', 13, 'undead', 0xd8d0b8, { speed: 0.085, hp: 1.3 }),
  mk('hill_troll', 'Bergtroll', 15, 'golem', 0x7a8a6a, { speed: 0.08, hp: 1.5, cd: 24 }),
  mk('stone_golem', 'Steingolem', 17, 'golem', 0x8a8a92, { speed: 0.07, hp: 1.8, dmg: 1.2, cd: 26 }),
  mk('shadow_wolf', 'Schattenwolf', 19, 'beast', 0x4a4a62, { speed: 0.125, hp: 0.9, cd: 16 }),
  mk('pit_worm', 'Grubenwurm', 21, 'worm', 0x9a7a5a, { speed: 0.09, hp: 1.3 }),
  mk('ash_walker', 'Aschenwandler', 23, 'humanoid', 0x6a5a52, { hp: 1.1 }),
  mk('cinder_wisp', 'Lavageist', 25, 'elemental', 0xe0702a, { speed: 0.105, hp: 0.9, dmg: 1.35 }),
  mk('death_knight', 'Todesritter', 27, 'undead', 0x5a5a7a, { hp: 1.4, dmg: 1.2 }),
  mk('hell_spawn', 'Höllenbrut', 29, 'demon', 0xc0402a, { speed: 0.1, hp: 1.3, dmg: 1.25 }),
  mk('stone_colossus', 'Steinkoloss', 20, 'golem', 0xa09a8a, { boss: true, speed: 0.07 }),
  mk('bandit_lord', 'Räuberfürst Harkon', 12, 'humanoid', 0xc07a3a, { boss: true, speed: 0.1 }),
  mk('bone_lord', 'Knochenfürst Morrik', 14, 'undead', 0xe8e0c0, { boss: true, speed: 0.09 }),
  mk('bog_queen', 'Moorhexe Veshra', 16, 'humanoid', 0x9a4a9a, { boss: true, speed: 0.095 }),
  mk('ash_king', 'Aschenkönig', 30, 'demon', 0xd86a2a, { boss: true, speed: 0.085 }),
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
  /** Lehrer-Stufe: 1 = Aschenhafen, 2 = Felsenwacht */
  tier: number;
  desc: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'power_strike', name: 'Wuchtschlag', area: 'Nahkampf', levelReq: 2, price: 50, mana: 8, cooldown: 60, range: 1.5, mult: 2, ignoresArmor: false, tier: 1, desc: 'Doppelter Waffenschaden im Nahkampf.' },
  { id: 'quick_shot', name: 'Schnellschuss', area: 'Fernkampf', levelReq: 2, price: 60, mana: 4, cooldown: 20, range: 6, base: [6, 12], scales: 'gewandtheit', ignoresArmor: false, tier: 1, desc: 'Schneller Schuss auf Distanz, skaliert mit Gewandtheit.' },
  { id: 'ember_bolt', name: 'Glutblitz', area: 'Magie', levelReq: 3, price: 80, mana: 10, cooldown: 30, range: 7, base: [10, 18], scales: 'verstand', ignoresArmor: true, tier: 1, desc: 'Magischer Schaden, ignoriert Rüstung, skaliert mit Verstand.' },
];

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export const SAFE_REGEN = 0.5;
export const FIELD_REGEN = 0.02;

export const SHOPS: Record<string, string[]> = {
  basic: ['rusty_sword', 'bone_club', 'steel_sword', 'leather_cap', 'iron_helm', 'ash_mail', 'worn_gloves', 'cloth_boots', 'iron_greaves', 'iron_ring', 'heal_small', 'heal_mid', 'mana_small', 'mana_mid'],
  advanced: ['steel_sword', 'cinder_axe', 'war_blade', 'iron_helm', 'warden_helm', 'plate_cuirass', 'bone_plate', 'iron_gauntlets', 'ember_gauntlets', 'iron_greaves', 'steel_boots', 'silver_ring', 'heal_mid', 'heal_big', 'mana_mid', 'mana_big'],
};

/** Gegenstands-Drops: Ausrüstung seltener, Tränke häufiger. Faktor auf die Monster-dropChance. */
export const GEAR_DROP_FACTOR = 0.4;
export const POTION_DROP_CHANCE = 0.3;
export const POTION_COOLDOWN_TICKS = 100;

/** Rüstungs-Formel: Schaden * K / (K + Rüstung) */
export const ARMOR_K = 30;

export interface QuestDef {
  id: string;
  name: string;
  text: string;
  minLevel: number;
  /** Monsterart, die gezählt wird */
  target: string;
  count: number;
  xp: number;
  gold: number;
}

const q = (id: string, name: string, text: string, minLevel: number, target: string, count: number, xpMul: number, goldMul: number): QuestDef => {
  const k = MONSTERS.find((m) => m.id === target)!;
  return { id, name, text, minLevel, target, count, xp: Math.round(k.xp * count * xpMul), gold: Math.round(k.gold[1] * count * goldMul) };
};

export const QUESTS: QuestDef[] = [
  q('q_rats', 'Rattenplage', 'Die Felder sind voller Ratten. Erlege 8 Feldratten.', 1, 'field_rat', 8, 1.5, 1.5),
  q('q_hounds', 'Wilde Hunde', 'Wildhunde reißen unser Vieh. Erlege 8 davon.', 2, 'wild_hound', 8, 1.5, 1.5),
  q('q_bandits', 'Lehrlinge des Bösen', 'Räuberlehrlinge lauern an den Wegen. Besiege 8.', 3, 'bandit_novice', 8, 1.5, 1.5),
  q('q_spiders', 'Netze im Wald', 'Der Düsterwald ist voller Waldspinnen. Töte 10.', 4, 'forest_spider', 10, 1.5, 1.5),
  q('q_herbs', 'Sumpfkraut', 'Ohne Ghule im Moor kann ich Kräuter sammeln. Besiege 6 Sumpfghule.', 5, 'bog_ghoul', 6, 1.5, 1.5),
  q('q_ghouls', 'Ghulplage', 'Die Ghule werden mehr. Besiege 12 Sumpfghule.', 7, 'bog_ghoul', 12, 1.4, 1.5),
  q('q_wraiths', 'Unruhige Tote', 'Auf dem Totenacker spuken Geister. Banne 12 Friedhofsgeister.', 9, 'wraith', 12, 1.4, 1.5),
  q('q_harkon', 'Der Räuberfürst', 'Harkon terrorisiert die Straßen. Erschlage ihn in seinem Lager im Nordwesten.', 10, 'bandit_lord', 1, 1.5, 2),
  q('q_katacombs', 'Knochenritter', 'In den Katakomben marschieren Knochenritter. Zerschlage 12.', 12, 'bone_knight', 12, 1.4, 1.5),
  q('q_trolls', 'Bergtrolle', 'Trolle bedrohen den Pass im Hochland. Töte 12.', 14, 'hill_troll', 12, 1.4, 1.5),
  q('q_veshra', 'Die Moorhexe', 'Veshra herrscht in der Gruft nördlich der Stadt. Töte sie.', 14, 'bog_queen', 1, 1.5, 2),
  q('q_mine', 'Der Steinkoloss', 'Ein Koloss erwacht in der Tiefenmine. Zerstöre ihn.', 18, 'stone_colossus', 1, 1.5, 2),
  q('q_ash', 'Asche und Glut', 'Aschenwandler ziehen aus der Öde. Besiege 15.', 21, 'ash_walker', 15, 1.4, 1.5),
  q('q_king', 'Der Aschenkönig', 'Der Aschenkönig sitzt auf seinem Thron. Beende seine Herrschaft.', 28, 'ash_king', 1, 1.5, 2),
];

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((x) => x.id === id);
}
