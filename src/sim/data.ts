export type AttrKey = 'kraft' | 'gewandtheit' | 'ausdauer' | 'verstand' | 'willenskraft';
export const ATTR_KEYS: AttrKey[] = ['kraft', 'gewandtheit', 'ausdauer', 'verstand', 'willenskraft'];
export const ATTR_NAME: Record<AttrKey, string> = {
  kraft: 'Kraft', gewandtheit: 'Gewandtheit', ausdauer: 'Ausdauer', verstand: 'Verstand', willenskraft: 'Willenskraft',
};

/** Attribut-Schwellen: ab diesem Wert gibt es einen festen Bonus (Prozent) */
export const ATTR_THRESHOLD = 30;
/** Zweite Schwelle: der Bonus gilt dann doppelt */
export const ATTR_THRESHOLD_2 = 50;
export const ATTR_THRESHOLD_BONUS: Record<AttrKey, { pct: number; text: string }> = {
  kraft: { pct: 5, text: 'Nahkampfschaden' },
  gewandtheit: { pct: 5, text: 'Angriffstempo' },
  ausdauer: { pct: 5, text: 'Leben' },
  verstand: { pct: 5, text: 'Zauberschaden' },
  willenskraft: { pct: 10, text: 'Manaregeneration' },
};
/** Willenskraft: +1 % Resistenz (Feuer/Frost/Gift) je 2 Punkte über 10; verkürzt Betäubung und Verlangsamung um 1 % je Punkt über 10 (höchstens 40 %) */
export const WILL_RES_PER_2 = 1;
export const WILL_STATUS_PER_POINT = 0.01;
export const WILL_STATUS_CAP = 0.4;

/** Edelsteine: Drop-Chancen (je Monster ab Stufe GEM_MIN_LEVEL; Champions, Mini-Bosse, Bosse und Truhen öfter) und Einsetzkosten (Gold je Qualität²) */
export const GEM_MIN_LEVEL = 8;
export const GEM_DROP = { normal: 0.012, champion: 0.12, unique: 0.5, boss: 0.6, chest: { wood: 0.03, iron: 0.1, gold: 0.3 } };
export const GEM_SOCKET_COST = 30;

/** Version der Weltkarte: Spielstände mit anderer Version starten in der Stadt (Koordinaten passen nicht mehr). */
export const MAP_VERSION = 4;

export const MAX_LEVEL = 30;
export const STAT_POINTS_PER_LEVEL = 5;
/** Skillpunkte: wenige, damit Entscheidungen zählen (Rang 1–5 je Skill, jeder Rang kostet 1 Punkt) */
export const SKILL_POINTS_START = 2;
export const SKILL_POINTS_PER_LEVEL = 1;
export const MAX_SKILL_RANK = 5;
/** Meilensteine: zusätzliche Punkte beim Erreichen dieser Stufen (zählen beim Neuverteilen mit) */
export const LEVEL_MILESTONES: Record<number, { stat: number; skill: number }> = {
  10: { stat: 3, skill: 1 }, 15: { stat: 3, skill: 0 }, 20: { stat: 5, skill: 1 }, 25: { stat: 5, skill: 1 }, 30: { stat: 10, skill: 1 },
};
/** Summe der Meilenstein-Punkte bis einschließlich `level` */
export function milestonePoints(level: number): { stat: number; skill: number } {
  let stat = 0;
  let skill = 0;
  for (const [l, m] of Object.entries(LEVEL_MILESTONES)) if (Number(l) <= level) { stat += m.stat; skill += m.skill; }
  return { stat, skill };
}
/** Rang-Wirkung: Schaden/Heilung +18 % je Rang, Mana +6 %, Abklingzeit −6 % */
export const rankDamage = (rank: number): number => 1 + 0.18 * (rank - 1);
export const rankMana = (rank: number): number => 1 + 0.06 * (rank - 1);
export const rankCooldown = (rank: number): number => Math.max(0.6, 1 - 0.06 * (rank - 1));
/** Stufe, ab der Rang `rank` möglich ist */
export const rankLevelReq = (levelReq: number, rank: number): number => Math.min(MAX_LEVEL, levelReq + (rank - 1) * 3);
/** Goldkosten: Rang 1 = Lernpreis, danach halber Preis mal Rang */
export const rankPrice = (price: number, rank: number): number => (rank <= 1 ? price : Math.round(price * 0.5 * rank));
/** Umverteilen: teuer, aber möglich */
export const respecPrice = (level: number): number => 100 + level * level * 8;
export const START_STAT_POINTS = 10;
/** Nahkampf-Skills (mit `mult`) skalieren wie Fern- und Zauber-Skills mit ihrem Attribut: (Kraft − 10) · (1 + Stufe · 0,08) · Faktor, mal `mult` (Stufe-6-Balance, Benchmark `builds.bench.test.ts`). */
export const MELEE_SKILL_KRAFT_SCALE = 1.5;

/** XP, die von Level `l` auf `l+1` nötig sind. Kill-XP wächst mit L^1.3; der Faktor (1 + l/6) streckt die Kurve nach oben (mehr Kills pro Level im Endgame). */
export const XP_PER_LEVEL_BASE = 190;
/** Zusatzfaktor `1 + (l/Max)^Exp * Faktor`: frühe Level bleiben flüssig (L10 ≈ 1 h), das Endgame streckt sich (Bot-Messung: L30 nach ≈ 8 h, ein Mensch braucht deutlich länger). */
const XP_LATE_EXP = 1.5;
const XP_LATE_FACTOR = 1.0;
export function xpToNext(level: number): number {
  return Math.round(XP_PER_LEVEL_BASE * Math.pow(level, 1.3) * (1 + level / 6) * (1 + Math.pow(level / MAX_LEVEL, XP_LATE_EXP) * XP_LATE_FACTOR));
}

const XP_TABLE: number[] = [0, 0];
for (let l = 1; l <= MAX_LEVEL; l++) XP_TABLE[l + 1] = XP_TABLE[l]! + xpToNext(l);

/** Gesamt-XP, die für das Erreichen von `level` nötig sind. */
export function totalXpFor(level: number): number {
  return XP_TABLE[Math.min(level, MAX_LEVEL + 1)] ?? 0;
}

export type MonsterFamily = 'beast' | 'humanoid' | 'undead' | 'spider' | 'ghoul' | 'golem' | 'demon' | 'worm' | 'elemental';

/** ward: schützt sich selbst vor Elementarschaden; dispel: bannt Verstärkungen des Ziels (Gegenmaßnahme zu Schutzzaubern) */
export type Ability = 'slam' | 'summon' | 'charge' | 'cast' | 'heal' | 'poisonBite' | 'archer' | 'raise' | 'ward' | 'dispel';

/** Schadensarten; Resistenz in Prozent (negativ = Schwäche, 100 = immun). */
export type DmgType = 'physical' | 'fire' | 'frost' | 'poison';
export const DMG_NAME: Record<DmgType, string> = { physical: 'Physisch', fire: 'Feuer', frost: 'Frost', poison: 'Gift' };
export const DMG_COLOR: Record<DmgType, string> = { physical: '#ffffff', fire: '#ff9a3a', frost: '#8fd0ff', poison: '#8fe070' };
export const MAX_RES = 75;

/** Statuseffekte (Dauer in Ticks im Actor-Feld `status`). */
export type StatusId = 'slow' | 'stun' | 'burn' | 'ward' | 'stoneskin' | 'bandage' | 'weaken' | 'curse' | 'silence';
/** Alle Statuseffekte an einer Stelle (Ablauf, Netz, HUD): neue Effekte hier und in `effects.ts` eintragen. */
export const STATUS_IDS: readonly StatusId[] = ['slow', 'stun', 'burn', 'ward', 'stoneskin', 'bandage', 'weaken', 'curse', 'silence'];
export const STATUS_NAME: Record<StatusId, string> = {
  slow: 'Verlangsamt', stun: 'Betäubt', burn: 'Brennt', ward: 'Elementarschild', stoneskin: 'Steinhaut', bandage: 'Verband', weaken: 'Entkräftet', curse: 'Verflucht', silence: 'Verstummt',
};
export const STATUS_COLOR: Record<StatusId, string> = {
  slow: '#8fd0ff', stun: '#ffe45a', burn: '#ff9a3a', ward: '#7fb0ff', stoneskin: '#c8b898', bandage: '#8fe0a0', weaken: '#b08adf', curse: '#d05a8a', silence: '#e0e0e8',
};
/** Verlangsamung: Tempo und Angriffstempo auf diesen Faktor */
export const SLOW_FACTOR = 0.6;

export const FAMILY_RES: Partial<Record<MonsterFamily, Partial<Record<DmgType, number>>>> = {
  undead: { fire: -40, poison: 100 },
  golem: { poison: 100, frost: 30 },
  spider: { poison: 60 },
  demon: { fire: 60, frost: -30 },
  elemental: { fire: 80, frost: -50 },
};

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
  /** Fähigkeiten (Bosse und Mini-Bosse) */
  abilities?: Ability[];
  summonKind?: string;
  /** Schadensart der Angriffe (Standard physisch) */
  dmgType?: DmgType;
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

/** Monstertempo: Nahkämpfer 15 % langsamer als früher, schnelle Jäger (Wölfe, Hunde ab Tempo 0,12) nur 7 % – der Spieler (0,15) ist so klar schneller und kann zurückweichen. */
const MOVE_SLOW = 0.85;
const MOVE_FAST = 0.93;
/** Aggro-Radius normaler Monster höchstens so groß, damit Bogenschützen (Reichweite 9) zuerst schießen. */
const AGGRO_MAX = 5;

function mk(
  id: string, name: string, level: number, family: MonsterFamily, color: number,
  o: { speed?: number; cd?: number; aggro?: number; hp?: number; dmg?: number; boss?: boolean; drop?: number; abil?: Ability[]; summon?: string; dt?: DmgType } = {},
): MonsterKind {
  const hpM = (o.hp ?? 1) * (o.boss ? SCALE.bossHp : 1);
  const dmgM = (o.dmg ?? 1) * (o.boss ? SCALE.bossDmg : 1);
  const avg = SCALE.dmgAvg(level) * dmgM;
  return {
    id, name, level, family, color,
    hp: Math.round(SCALE.hp(level) * hpM),
    damage: [Math.max(1, Math.round(avg * 0.7)), Math.max(2, Math.round(avg * 1.3))],
    speed: Math.round((o.speed ?? 0.1) * ((o.speed ?? 0.1) >= 0.12 ? MOVE_FAST : MOVE_SLOW) * 10000) / 10000,
    attackCooldown: o.cd ?? 20,
    aggroRange: o.aggro ?? Math.min(AGGRO_MAX, 4 + Math.floor(level / 10)),
    xp: Math.round(SCALE.xp(level) * (o.boss ? SCALE.bossXp : 1)),
    gold: [Math.round(level * 1.5 + 1), Math.round(level * 3 + 3)],
    dropChance: o.boss ? 1 : (o.drop ?? 0.5),
    boss: o.boss,
    abilities: o.abil,
    summonKind: o.summon,
    dmgType: o.dt,
  };
}

export const MONSTERS: MonsterKind[] = [
  // Ratten
  mk('field_rat', 'Feldratte', 1, 'beast', 0x9a7b5a, { hp: 0.8, dmg: 0.8, speed: 0.11 }),
  mk('burrow_rat', 'Wühlratte', 3, 'beast', 0x7a6048, { hp: 0.9, speed: 0.11 }),
  mk('giant_rat', 'Riesenratte', 5, 'beast', 0x6a5238, { hp: 1.2, dmg: 1.05 }),
  // Hunde und Wölfe
  mk('wild_hound', 'Wildhund', 2, 'beast', 0x8a6a4a, { speed: 0.12, cd: 17 }),
  mk('feral_hound', 'Streuner', 4, 'beast', 0x7a5a3a, { speed: 0.12, cd: 17, hp: 1.1 }),
  mk('wolf', 'Wolf', 7, 'beast', 0x8a8a8e, { speed: 0.125, cd: 16, hp: 1.15 }),
  mk('dire_wolf', 'Schreckenswolf', 11, 'beast', 0x5a5a62, { speed: 0.125, cd: 16, hp: 1.3, dmg: 1.1 }),
  mk('shadow_wolf', 'Schattenwolf', 19, 'beast', 0x4a4a62, { speed: 0.125, hp: 0.9, cd: 16 }),
  mk('night_stalker', 'Nachtjäger', 24, 'beast', 0x3a3a52, { speed: 0.13, hp: 1.1, cd: 15, dmg: 1.15 }),
  // Goblins
  mk('goblin', 'Goblin', 2, 'humanoid', 0x6a9a4a, { hp: 0.9 }),
  mk('goblin_scout', 'Goblinkundschafter', 4, 'humanoid', 0x7ab05a, { speed: 0.115, hp: 0.9 }),
  mk('goblin_warrior', 'Goblinkrieger', 8, 'humanoid', 0x5a8a3a, { hp: 1.25, dmg: 1.1 }),
  mk('goblin_shaman', 'Goblinschamane', 10, 'humanoid', 0x8ac06a, { hp: 0.85, dmg: 1.25, abil: ['cast', 'heal', 'ward'], dt: 'fire' }),
  mk('goblin_archer', 'Goblinschütze', 5, 'humanoid', 0x7ab05a, { hp: 0.8, dmg: 0.9, cd: 24, abil: ['archer'] }),
  mk('goblin_chief', 'Goblinhäuptling', 13, 'humanoid', 0x4a7a2a, { hp: 1.8, dmg: 1.2, cd: 22 }),
  mk('goblin_brute', 'Goblinbrecher', 11, 'humanoid', 0x4f7f30, { hp: 1.4, dmg: 1.15, cd: 22 }),
  mk('goblin_warlord', 'Goblinkriegsherr', 12, 'humanoid', 0x3f6f28, { hp: 1.6, dmg: 1.2, cd: 22 }),
  // Banditen
  mk('bandit_novice', 'Räuberlehrling', 3, 'humanoid', 0xb06a4a),
  mk('highwayman', 'Wegelagerer', 7, 'humanoid', 0xa05a3a, { dmg: 1.1 }),
  mk('bandit_archer', 'Räuberschütze', 6, 'humanoid', 0xa07a4a, { hp: 0.8, dmg: 0.95, cd: 24, abil: ['archer'] }),
  mk('bandit', 'Räuber', 10, 'humanoid', 0x905030, { hp: 1.15, dmg: 1.15 }),
  mk('bandit_captain', 'Räuberhauptmann', 13, 'humanoid', 0x7a3a2a, { hp: 1.7, dmg: 1.25 }),
  // Spinnen
  mk('forest_spider', 'Waldspinne', 4, 'spider', 0x3a3a48, { speed: 0.115, hp: 0.9, abil: ['poisonBite'] }),
  mk('venom_spider', 'Giftspinne', 9, 'spider', 0x3a5a3a, { speed: 0.115, hp: 0.95, dmg: 1.15, abil: ['poisonBite'], dt: 'poison' }),
  mk('giant_spider', 'Riesenspinne', 14, 'spider', 0x4a3a58, { speed: 0.11, hp: 1.4, dmg: 1.15, abil: ['poisonBite'] }),
  mk('cave_spider', 'Höhlenspinne', 20, 'spider', 0x5a4a38, { speed: 0.115, hp: 1.3, dmg: 1.2, abil: ['poisonBite'], dt: 'poison' }),
  mk('brood_spider', 'Brutspinne', 15, 'spider', 0x4a3a52, { speed: 0.12, hp: 0.95, dmg: 1.1, abil: ['poisonBite'] }),
  mk('web_stalker', 'Netzlauerer', 16, 'spider', 0x3a4a3a, { speed: 0.115, hp: 1.3, dmg: 1.2, abil: ['poisonBite'], dt: 'poison' }),
  mk('nest_matron', 'Nestmatrone', 17, 'spider', 0x5a3a5a, { speed: 0.105, hp: 1.6, dmg: 1.2, abil: ['poisonBite'] }),
  // Sumpf
  mk('bog_ghoul', 'Sumpfghul', 6, 'ghoul', 0x5a8a5a, { speed: 0.085, hp: 1.15 }),
  mk('marsh_corpse', 'Moorleiche', 9, 'ghoul', 0x6a7a52, { speed: 0.08, hp: 1.35 }),
  mk('bog_witch', 'Sumpfhexe', 11, 'humanoid', 0x7a4a8a, { hp: 0.85, dmg: 1.3, abil: ['cast', 'ward'], dt: 'poison' }),
  mk('ghoul_alpha', 'Ghulalpha', 15, 'ghoul', 0x4a6a3a, { speed: 0.09, hp: 1.6, dmg: 1.2 }),
  // Untote
  mk('skeleton', 'Skelett', 8, 'undead', 0xdcd4bc, { hp: 0.9, dmg: 1.05 }),
  mk('wraith', 'Friedhofsgeist', 9, 'undead', 0x8a9ad8, { speed: 0.095, hp: 0.9, dmg: 1.15 }),
  mk('bone_acolyte', 'Knochenakolyth', 11, 'undead', 0xb8c8d8, { hp: 0.85, dmg: 1.1, abil: ['cast', 'heal', 'dispel'] }),
  mk('zombie', 'Zombie', 10, 'undead', 0x7a8a62, { speed: 0.075, hp: 1.5 }),
  mk('bone_knight', 'Knochenritter', 13, 'undead', 0xd8d0b8, { speed: 0.085, hp: 1.3 }),
  mk('necromancer', 'Totenbeschwörer', 14, 'undead', 0x6a4a8a, { hp: 0.9, dmg: 1.15, abil: ['cast', 'raise', 'ward'], summon: 'skeleton', dt: 'frost' }),
  mk('crypt_guard', 'Gruftwächter', 18, 'undead', 0xb8b0c8, { speed: 0.08, hp: 1.55, dmg: 1.15 }),
  mk('death_knight', 'Todesritter', 27, 'undead', 0x5a5a7a, { hp: 1.4, dmg: 1.2 }),
  // Trolle und Golems
  mk('hill_troll', 'Bergtroll', 15, 'golem', 0x7a8a6a, { speed: 0.08, hp: 1.5, cd: 24 }),
  mk('stone_golem', 'Steingolem', 17, 'golem', 0x8a8a92, { speed: 0.07, hp: 1.8, dmg: 1.2, cd: 26 }),
  mk('rock_troll', 'Felstroll', 18, 'golem', 0x6a7a62, { speed: 0.08, hp: 1.7, dmg: 1.15, cd: 24 }),
  mk('iron_golem', 'Eisengolem', 22, 'golem', 0x9a9aa8, { speed: 0.07, hp: 2.0, dmg: 1.25, cd: 26 }),
  // Würmer
  mk('pit_worm', 'Grubenwurm', 21, 'worm', 0x9a7a5a, { speed: 0.09, hp: 1.3 }),
  mk('acid_worm', 'Säurewurm', 25, 'worm', 0x8aa04a, { speed: 0.09, hp: 1.35, dmg: 1.2 }),
  // Asche und Feuer
  mk('ash_walker', 'Aschenwandler', 23, 'humanoid', 0x6a5a52, { hp: 1.1 }),
  mk('cinder_wisp', 'Lavageist', 25, 'elemental', 0xe0702a, { speed: 0.105, hp: 0.9, dmg: 1.35, dt: 'fire' }),
  mk('ember_elemental', 'Glutelementar', 27, 'elemental', 0xff5a1a, { speed: 0.1, hp: 1.5, dmg: 1.3, dt: 'fire' }),
  mk('imp', 'Imp', 24, 'demon', 0xd05a3a, { speed: 0.125, hp: 0.8, dmg: 1.3, cd: 16, abil: ['cast'], dt: 'fire' }),
  mk('hell_spawn', 'Höllenbrut', 29, 'demon', 0xc0402a, { speed: 0.1, hp: 1.3, dmg: 1.25, dt: 'fire' }),
  // Aschengrund (Elite-Zone, Stufe 28–32)
  mk('hell_hound', 'Höllenhund', 29, 'demon', 0xb03020, { speed: 0.13, hp: 1.1, dmg: 1.2, cd: 15, dt: 'fire' }),
  mk('doom_knight', 'Verdammter Ritter', 30, 'undead', 0x44446a, { speed: 0.09, hp: 1.55, dmg: 1.25, cd: 20 }),
  mk('pit_fiend', 'Grubenteufel', 32, 'demon', 0x9a2a1a, { speed: 0.1, hp: 1.6, dmg: 1.35, abil: ['cast'], dt: 'fire' }),
  // Bosse
  mk('goblin_king', 'Goblinkönig Grix', 10, 'humanoid', 0x3a6a1a, { boss: true, speed: 0.1, abil: ['slam', 'summon'], summon: 'goblin_scout' }),
  mk('bandit_lord', 'Räuberfürst Harkon', 12, 'humanoid', 0xc07a3a, { boss: true, speed: 0.1, abil: ['slam'] }),
  mk('bone_lord', 'Knochenfürst Morrik', 14, 'undead', 0xe8e0c0, { boss: true, speed: 0.09, abil: ['slam', 'summon'], summon: 'skeleton' }),
  mk('bog_queen', 'Moorhexe Veshra', 16, 'humanoid', 0x9a4a9a, { boss: true, speed: 0.095, abil: ['slam', 'summon'], summon: 'bog_ghoul' }),
  mk('stone_colossus', 'Steinkoloss', 20, 'golem', 0xa09a8a, { boss: true, speed: 0.07, abil: ['slam', 'charge'] }),
  mk('spider_queen', 'Spinnenkönigin Vyrra', 18, 'spider', 0x7a2a5a, { boss: true, speed: 0.1, abil: ['summon', 'charge'], summon: 'brood_spider' }),
  mk('web_mother', 'Webmutter Skarra', 23, 'spider', 0x6a3a6a, { boss: true, speed: 0.1, abil: ['summon', 'charge'], summon: 'cave_spider' }),
  mk('ash_king', 'Aschenkönig', 30, 'demon', 0xd86a2a, { boss: true, speed: 0.085, abil: ['slam', 'summon', 'charge'], summon: 'imp' }),
];

/** Champion-Modifikatoren: Anführer mancher Rudel, stärker, mit besonderer Eigenschaft und besserer Beute. */
export const CHAMPION_MODS: Record<string, { name: string; hp: number; dmg: number; speed: number; desc: string }> = {
  swift: { name: 'Flinker', hp: 1.8, dmg: 1.1, speed: 1.45, desc: 'sehr schnell' },
  armored: { name: 'Gepanzerter', hp: 3.0, dmg: 1.0, speed: 1, desc: 'sehr zäh' },
  fiery: { name: 'Feuriger', hp: 1.9, dmg: 1.3, speed: 1, desc: 'setzt in Brand' },
  vampiric: { name: 'Blutsaugender', hp: 2.0, dmg: 1.15, speed: 1, desc: 'heilt sich durch Treffer' },
  thorned: { name: 'Dorniger', hp: 2.0, dmg: 1.1, speed: 1, desc: 'wirft Schaden zurück' },
};
export const CHAMPION_REWARD = 3;

/** Benannte Mini-Bosse: seltene Einzelgänger mit Fähigkeiten, langer Wartezeit und garantierter guter Beute. */
export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  hp: number;
  dmg: number;
  abilities: Ability[];
  summon?: string;
  respawnMin: number;
  /** Weltboss: wartet lange, kündigt Erscheinen und Tod an, lässt T4/T5-Affixe und bessere Edelsteine fallen */
  world?: boolean;
  /** Ort für Bannertexte */
  where?: string;
}
export const UNIQUES: UniqueDef[] = [
  { id: 'rat_king', name: 'Rattenkönig Knabber', base: 'giant_rat', hp: 6, dmg: 1.5, abilities: ['summon'], summon: 'field_rat', respawnMin: 15 },
  { id: 'spotted_beast', name: 'Fleckenbiest', base: 'feral_hound', hp: 6, dmg: 1.5, abilities: ['charge'], respawnMin: 15 },
  { id: 'goblin_shaman_brakk', name: 'Schamane Brakk', base: 'goblin_shaman', hp: 5, dmg: 1.4, abilities: ['summon', 'slam', 'cast'], summon: 'goblin', respawnMin: 18 },
  { id: 'venom_mother', name: 'Giftmutter Zischel', base: 'venom_spider', hp: 5, dmg: 1.4, abilities: ['summon', 'charge'], summon: 'forest_spider', respawnMin: 18 },
  { id: 'captain_kolm', name: 'Hauptmann Kolm', base: 'bandit_captain', hp: 4, dmg: 1.4, abilities: ['slam', 'charge'], respawnMin: 20 },
  { id: 'bog_brute', name: 'Moorbestie Gluck', base: 'ghoul_alpha', hp: 5, dmg: 1.4, abilities: ['slam'], respawnMin: 20 },
  { id: 'hexmaster_irva', name: 'Hexenmeisterin Irva', base: 'bog_witch', hp: 6, dmg: 1.5, abilities: ['summon', 'slam', 'cast'], summon: 'bog_ghoul', respawnMin: 20 },
  { id: 'crypt_ormund', name: 'Gruftwächter Ormund', base: 'crypt_guard', hp: 4.5, dmg: 1.4, abilities: ['slam', 'charge'], respawnMin: 22 },
  { id: 'ghost_lord_sael', name: 'Geistfürst Sael', base: 'wraith', hp: 7, dmg: 1.6, abilities: ['summon', 'slam'], summon: 'skeleton', respawnMin: 22 },
  { id: 'troll_chief_drogg', name: 'Trollhäuptling Drogg', base: 'rock_troll', hp: 4.5, dmg: 1.4, abilities: ['slam', 'charge'], respawnMin: 22 },
  { id: 'alpha_fenrik', name: 'Alphawolf Fenrik', base: 'dire_wolf', hp: 6, dmg: 1.5, abilities: ['charge', 'summon'], summon: 'wolf', respawnMin: 22 },
  { id: 'cinder_lord_zarkesh', name: 'Glutfürst Zarkesh', base: 'ember_elemental', hp: 4.5, dmg: 1.4, abilities: ['slam', 'summon'], summon: 'cinder_wisp', respawnMin: 25 },
  { id: 'dread_valdor', name: 'Schreckensritter Valdor', base: 'death_knight', hp: 4, dmg: 1.4, abilities: ['charge', 'slam'], respawnMin: 25 },
  // Weltbosse: lange Wartezeit, Beute mit hohen Affix-Stufen
  { id: 'bog_titan', name: 'Moorverschlinger Gurrak', base: 'ghoul_alpha', hp: 10, dmg: 1.6, abilities: ['slam', 'summon', 'charge'], summon: 'bog_ghoul', respawnMin: 25, world: true, where: 'in den Moorlanden' },
  { id: 'mountain_king', name: 'Bergkönig Thurgrim', base: 'rock_troll', hp: 9, dmg: 1.5, abilities: ['slam', 'charge', 'summon'], summon: 'hill_troll', respawnMin: 32, world: true, where: 'im Hochland' },
  { id: 'abyss_warden', name: 'Aschenfürst Morvath', base: 'pit_fiend', hp: 8, dmg: 1.5, abilities: ['slam', 'summon', 'charge'], summon: 'hell_hound', respawnMin: 40, world: true, where: 'im Aschengrund' },
];
export function uniqueDef(id: string): UniqueDef | undefined {
  return UNIQUES.find((u) => u.id === id);
}
export const UNIQUE_REWARD = 6;
/** Weltboss-Beute: Anzahl garantierter seltener Gegenstände mit mindestens dieser Affix-Stufe, Edelstein-Mindestqualität */
export const WORLD_BOSS_LOOT = { rares: 2, minTier: 4, minGem: 2 } as const;

export function monsterKind(id: string): MonsterKind {
  const k = MONSTERS.find((m) => m.id === id);
  if (!k) throw new Error(`Unbekanntes Monster: ${id}`);
  return k;
}

/** Funktionsgruppe eines Skills/Zaubers (Taktik, nicht Schadensart). */
export type SkillSchool = 'direct' | 'dot' | 'heal' | 'protect' | 'buff' | 'debuff' | 'control' | 'dispel' | 'resource' | 'utility';
export const SCHOOL_NAME: Record<SkillSchool, string> = {
  direct: 'Direktschaden', dot: 'Schaden über Zeit', heal: 'Heilung', protect: 'Schutz', buff: 'Verstärkung', debuff: 'Schwächung', control: 'Kontrolle', dispel: 'Bannung', resource: 'Ressource/Bewegung', utility: 'Hilfsfertigkeit',
};
/** Wen ein Skill trifft: Gegner, den Wirkenden selbst oder (nur Mehrspieler) einen verbündeten Spieler. */
export type SkillTarget = 'enemy' | 'self' | 'ally';

/** Erklärung für die UI: Was ändert der Skill, für wen lohnt er, womit kombiniert er, was kostet die Entscheidung, was kann er nicht. */
export interface SkillInfo {
  role: string;
  build: string;
  synergy: string;
  decision: string;
  limit: string;
}

export interface SkillDef {
  id: string;
  name: string;
  area: 'Nahkampf' | 'Fernkampf' | 'Magie' | 'Überleben';
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
  /** Flächenschaden: Radius (um den Zaubernden bei aoeSelf, sonst um das Ziel) */
  aoe?: number;
  aoeSelf?: boolean;
  /** Mehrfachziel: so viele nächste Gegner in Reichweite */
  targets?: number;
  /** Selbstheilung: Basiswert, skaliert mit Verstand */
  heal?: number;
  /** Gift: Zusatzschaden über `seconds` Sekunden (Faktor auf den Direktschaden) */
  dot?: { seconds: number; factor: number };
  /** Schadensart (Standard physisch) */
  dmgType?: DmgType;
  /** Statuseffekt auf Treffer (Bosse: Betäubung nur halb so lang) */
  status?: { id: StatusId; seconds: number };
  /** Lehrer-Stufe: 1 = Aschenhafen, 2 = Felsenwacht */
  tier: number;
  desc: string;
  /** Funktionsgruppe (ohne Angabe: aus den übrigen Feldern abgeleitet, siehe `schoolOf`) */
  school?: SkillSchool;
  target?: SkillTarget;
  /** Passiv: wirkt dauerhaft, belegt keinen Hotbar-Platz, wird nicht gewirkt */
  passive?: boolean;
  /** Passiv: Wirkung je Rang (Summe über alle gelernten Passiven in `passiveSum`) */
  pass?: Partial<Record<PassiveKey, number>>;
  /** Statuseffekt auf Selbst (target self) oder Gegner: Stärke `mag` + `magPerRank` je Rang ab Rang 2, höchstens `cap` */
  effect?: { id: StatusId; seconds: number; mag?: number; magPerRank?: number; cap?: number };
  /** Sonderwirkung ohne Schaden: Läuterung (Debuffs und Kontrolle von dir entfernen) oder Bannung (Verstärkungen des Ziels entfernen) */
  action?: 'cleanse' | 'dispel';
  info?: SkillInfo;
}

/** Passive Wirkungen (Prozent bzw. Punkte je Rang, siehe `passiveSum` in `world.ts`) */
export type PassiveKey = 'parry' | 'evade' | 'crit' | 'armorPen' | 'shieldArmor' | 'manaCost' | 'manaRegen' | 'stealth' | 'fieldRegen' | 'carry';
/** Obergrenzen gestapelter Passiven (Balance) */
export const PASSIVE_CAP: Partial<Record<PassiveKey, number>> = { parry: 15, armorPen: 40, manaCost: 25, stealth: 40, shieldArmor: 60 };

/** Funktionsgruppe eines Skills: explizit gesetzt oder aus den Wirkfeldern abgeleitet. */
export function schoolOf(s: SkillDef): SkillSchool {
  if (s.school) return s.school;
  if (s.heal !== undefined) return 'heal';
  if (s.dot) return 'dot';
  if (s.status && (s.status.id === 'stun' || s.status.id === 'slow') && !s.base && !s.mult) return 'control';
  return 'direct';
}

/** Meisterschaft: ab Stufe `SPEC_LEVEL` wählbar, bis zum Neuverteilen dauerhaft; wirkt wie zusätzliche Ausrüstungswerte. */
export const SPEC_LEVEL = 20;
export interface SpecDef { id: string; name: string; text: string; bonus: Record<string, number> }
export const SPECS: SpecDef[] = [
  { id: 'warlord', name: 'Kriegsherr', text: 'Nahkampf: +6 Schaden, +10 Rüstung, +5 % Parieren, +3 % Tempo.', bonus: { damage: 6, armor: 10, parry: 5, haste: 3 } },
  { id: 'ranger', name: 'Jäger', text: 'Fernkampf: +8 % Kritisch, +14 Ausweichen, +12 Treffsicherheit, +4 % Tempo, +4 Schaden.', bonus: { crit: 8, evasion: 14, accuracy: 12, haste: 4, damage: 4 } },
  { id: 'archmage', name: 'Erzmagier', text: 'Magie: +12 % Feuer- und Frostzauber, +12 % Heilung, −10 % Manakosten, +50 Mana.', bonus: { spellFire: 12, spellFrost: 12, healPower: 12, manaCost: -10, maxMana: 50 } },
  { id: 'warden', name: 'Wächter', text: 'Überleben: +150 Leben, +12 Rüstung, +8 % Widerstand gegen Feuer, Frost und Gift.', bonus: { maxHp: 150, armor: 12, resFire: 8, resFrost: 8, resPoison: 8 } },
];

export const SKILLS: SkillDef[] = [
  { id: 'power_strike', name: 'Wuchtschlag', area: 'Nahkampf', levelReq: 2, price: 50, mana: 8, cooldown: 60, range: 1.5, mult: 2, ignoresArmor: false, status: { id: 'stun', seconds: 0.8 }, tier: 1, desc: 'Doppelter Waffenschaden im Nahkampf, betäubt kurz (0,8 s).', info: { role: 'Schwerer Einzelhieb mit kurzer Betäubung.', build: 'Nahkämpfer und Schildkämpfer.', synergy: 'Mit Zweihändern und hoher Kraft; Betäubung lässt sich mit Kontrolldauer-Items verlängern.', decision: 'Mana und Abklingzeit gegen den Dauerangriff.', limit: 'Nur ein Ziel im Nahkampf; Bosse sind nur halb so lange betäubt.' } },
  { id: 'quick_shot', name: 'Schnellschuss', area: 'Fernkampf', levelReq: 1, price: 20, mana: 4, cooldown: 20, range: 9, base: [6, 12], scales: 'gewandtheit', ignoresArmor: false, tier: 1, desc: 'Schneller Schuss auf Distanz (Bogen und Pfeile in der Nebenhand nötig), skaliert mit Gewandtheit.', info: { role: 'Schneller Fernschuss, skaliert mit Gewandtheit.', build: 'Fernkämpfer.', synergy: 'Mit Bogen, Pfeilqualität, Präzision und Schleichen.', decision: 'Bogen und Pfeile statt Schild oder Zweihandwaffe.', limit: 'Braucht Bogen und Pfeile in der Nebenhand; schwächer als Spezialschüsse.' } },
  { id: 'ember_bolt', name: 'Glutblitz', area: 'Magie', levelReq: 3, price: 80, mana: 10, cooldown: 30, range: 7, base: [10, 18], scales: 'verstand', ignoresArmor: true, dmgType: 'fire', status: { id: 'burn', seconds: 3 }, tier: 1, desc: 'Feuerschaden, ignoriert Rüstung, skaliert mit Verstand; setzt in Brand.', info: { role: 'Günstiger Feuerzauber, ignoriert Rüstung, setzt in Brand.', build: 'Elementarmagier (Feuer) und Kampfmagier.', synergy: 'Mit Stäben, Verstand, Feuerzauber-Werten und Manafluss.', decision: 'Feuer gegen Resistente (Untote sind schwach, Dämonen resistent).', limit: 'Gegen feuerresistente Gegner schwach; Elementarschild der Gegner senkt den Schaden.' } },
  { id: 'healing_hand', name: 'Heilende Hand', area: 'Magie', levelReq: 4, price: 120, mana: 14, cooldown: 200, range: 0, heal: 40, scales: 'verstand', ignoresArmor: true, tier: 1, desc: 'Heilt dich selbst, stärker mit Verstand und Level.', info: { role: 'Heilt dich selbst, stärker mit Verstand und Stufe.', build: 'Heiler, Unterstützer, Kampfmagier.', synergy: 'Mit Heilkraft-Items, Manafluss und Läuterung.', decision: 'Mana für Überleben statt Schaden.', limit: 'Nur auf dich selbst (Fremdheilung nur im Mehrspielermodus); lange Abklingzeit.' } },
  { id: 'poison_shot', name: 'Giftpfeil', area: 'Fernkampf', levelReq: 6, price: 220, mana: 9, cooldown: 60, range: 9, base: [5, 9], scales: 'gewandtheit', ignoresArmor: false, dot: { seconds: 8, factor: 1.6 }, dmgType: 'poison', tier: 2, desc: 'Schuss (Bogen und Pfeile in der Nebenhand nötig), der das Ziel zusätzlich 8 Sekunden mit Gift schädigt.', info: { role: 'Fernschuss mit Gift über Zeit.', build: 'Fernkämpfer und Jäger gegen zähe Gegner.', synergy: 'Mit Bogen und Pfeilen; Gift ignoriert Rüstung.', decision: 'Zeit statt sofortigem Schaden; gut zum Weglaufen und Kiten.', limit: 'Untote und Golems sind immun; Giftresistenz senkt die Wirkung.' } },
  { id: 'whirlwind', name: 'Wirbelhieb', area: 'Nahkampf', levelReq: 10, price: 500, mana: 16, cooldown: 100, range: 1.6, mult: 1.2, aoe: 2.2, aoeSelf: true, ignoresArmor: false, tier: 2, desc: 'Trifft alle Gegner um dich herum.', info: { role: 'Trifft alle Gegner um dich herum.', build: 'Nahkämpfer gegen Rudel.', synergy: 'Mit Rüstungsbrecher, Steinhaut und Schildkampf (Einhandwaffe).', decision: 'Flächenschaden gegen den Einzelschlag.', limit: 'Kurze Reichweite; setzt dich mitten ins Rudel.' } },
  { id: 'frost_nova', name: 'Frostnova', area: 'Magie', levelReq: 11, price: 650, mana: 18, cooldown: 140, range: 1.6, base: [14, 22], scales: 'verstand', aoe: 3, aoeSelf: true, ignoresArmor: true, dmgType: 'frost', status: { id: 'slow', seconds: 4 }, tier: 2, desc: 'Frostschaden rund um dich herum, verlangsamt Getroffene 4 s.', info: { role: 'Frostschaden rund um dich, verlangsamt Getroffene.', build: 'Elementarmagier (Frost), Kontroll-Spezialisten und Kampfmagier.', synergy: 'Mit Frostzauber-Werten, Kontrolldauer und Elementarschild.', decision: 'Schutz durch Abstand statt reinem Schaden.', limit: 'Wirkt nur um dich herum; Dämonen und Elementare sind frostempfindlich, Golems resistent.' } },
  { id: 'multishot', name: 'Salve', area: 'Fernkampf', levelReq: 13, price: 800, mana: 14, cooldown: 70, range: 9, base: [9, 15], scales: 'gewandtheit', targets: 3, ignoresArmor: false, tier: 2, desc: 'Schießt (Bogen und Pfeile in der Nebenhand nötig) auf bis zu drei Gegner gleichzeitig; verbraucht einen Pfeil.', info: { role: 'Schießt auf bis zu drei Gegner gleichzeitig.', build: 'Fernkämpfer gegen Gruppen.', synergy: 'Mit Präzision (Krit je Pfeil), Pfeilbonus und Bogen.', decision: 'Breite statt Einzelschaden.', limit: 'Braucht Bogen und Pfeile; verbraucht Mana pro Salve.' } },
  { id: 'fireball', name: 'Feuerball', area: 'Magie', levelReq: 16, price: 1200, mana: 24, cooldown: 90, range: 7, base: [28, 42], scales: 'verstand', aoe: 2, ignoresArmor: true, dmgType: 'fire', status: { id: 'burn', seconds: 3 }, tier: 2, desc: 'Feuerschaden, explodiert am Ziel und trifft Gegner in der Nähe; setzt in Brand.', info: { role: 'Feuerschaden mit Explosion, trifft Gegner in der Nähe.', build: 'Elementarmagier (Feuer).', synergy: 'Mit Stäben, Feuerzauber-Werten, Verstand und Entzaubern gegen geschützte Zauberer.', decision: 'Hohe Manakosten gegen starken Flächenschaden.', limit: 'Feuerresistente Gegner und Elementarschild senken den Schaden stark.' } },
  { id: 'skull_split', name: 'Schädelspalter', area: 'Nahkampf', levelReq: 18, price: 1500, mana: 22, cooldown: 160, range: 1.5, mult: 3.2, ignoresArmor: false, status: { id: 'stun', seconds: 1.5 }, tier: 2, desc: 'Gewaltiger Hieb mit mehr als dreifachem Waffenschaden, betäubt 1,5 s.', info: { role: 'Gewaltiger Hieb mit langer Betäubung.', build: 'Nahkämpfer mit Zweihandwaffe.', synergy: 'Mit Rüstungsbrecher, Fluch der Blöße und Kontrolldauer.', decision: 'Lange Abklingzeit gegen einen vernichtenden Schlag.', limit: 'Nur ein Ziel im Nahkampf; Bosse sind nur halb so lange betäubt.' } },
  { id: 'lightning', name: 'Blitzschlag', area: 'Magie', levelReq: 22, price: 2400, mana: 30, cooldown: 120, range: 8, base: [60, 90], scales: 'verstand', ignoresArmor: true, tier: 2, desc: 'Zerschmetternder Blitz auf ein Ziel; ignoriert Rüstung und Elementarresistenzen (hohe Manakosten, lange Abklingzeit).', info: { role: 'Blitz, der Rüstung und Elementarresistenzen ignoriert.', build: 'Elementarmagier und Kampfmagier gegen resistente Gegner.', synergy: 'Mit Verstand, Staff und Fluch der Blöße; Manafluss senkt die hohen Kosten.', decision: 'Höchste Manakosten und lange Abklingzeit gegen verlässlichen Schaden.', limit: 'Nur ein Ziel; Elementarverstärker (Feuer-/Frostzauber-Werte) wirken nicht darauf.' } },
  // Meisterstufe (Lehrer Stufe 2): neue Fertigkeiten für die hohen Stufen
  { id: 'shockwave', name: 'Erschütterung', area: 'Nahkampf', levelReq: 15, price: 1100, mana: 20, cooldown: 150, range: 1.6, mult: 1.6, aoe: 2.4, aoeSelf: true, ignoresArmor: false, status: { id: 'stun', seconds: 1 }, tier: 2, desc: 'Der Boden bebt: trifft alle Gegner um dich und betäubt sie 1 s.', info: { role: 'Flächenhieb mit Betäubung um dich herum.', build: 'Nahkämpfer gegen Rudel.', synergy: 'Mit Wirbelhieb und Zweihändern.', decision: 'Betäubung der Gruppe statt Schaden am Einzelziel.', limit: 'Kurze Reichweite; Bosse nur halb so lange betäubt.' } },
  { id: 'ice_lance', name: 'Eislanze', area: 'Magie', levelReq: 17, price: 1400, mana: 22, cooldown: 100, range: 8, base: [34, 50], scales: 'verstand', ignoresArmor: true, dmgType: 'frost', status: { id: 'slow', seconds: 4 }, tier: 2, desc: 'Frostschaden auf ein Ziel, verlangsamt 4 s.', info: { role: 'Gezielter Frostschaden mit Verlangsamung.', build: 'Frostmagier und Kiter.', synergy: 'Mit Frostzauber-Werten und Kontrolldauer.', decision: 'Verlässlicher Einzelschaden statt Fläche.', limit: 'Frostresistente Gegner sind kaum betroffen.' } },
  { id: 'arrow_rain', name: 'Pfeilhagel', area: 'Fernkampf', levelReq: 19, price: 1700, mana: 22, cooldown: 130, range: 9, base: [16, 24], scales: 'gewandtheit', aoe: 2.5, ignoresArmor: false, tier: 2, desc: 'Ein Pfeilregen auf das Ziel und alle Gegner in der Nähe (Bogen und Pfeile nötig).', info: { role: 'Flächenschaden mit Pfeilen am Zielort.', build: 'Fernkämpfer gegen Gruppen.', synergy: 'Mit Präzision, Bogen und Pfeilbonus.', decision: 'Breite statt Einzelschaden.', limit: 'Braucht Bogen und Pfeile.' } },
  { id: 'firestorm', name: 'Feuersturm', area: 'Magie', levelReq: 21, price: 2200, mana: 34, cooldown: 180, range: 7, base: [44, 64], scales: 'verstand', aoe: 3, ignoresArmor: true, dmgType: 'fire', status: { id: 'burn', seconds: 4 }, tier: 2, desc: 'Ein Flammensturm, der alle Gegner im Umkreis verbrennt.', info: { role: 'Großer Feuerschaden im Umkreis mit Brand.', build: 'Feuermagier gegen Rudel.', synergy: 'Mit Feuerzauber-Werten, Stäben und Manafluss.', decision: 'Hohe Manakosten gegen starken Flächenschaden.', limit: 'Feuerresistente Gegner sind kaum betroffen.' } },
  { id: 'execution', name: 'Hinrichtung', area: 'Nahkampf', levelReq: 23, price: 2800, mana: 26, cooldown: 220, range: 1.5, mult: 4.4, ignoresArmor: false, tier: 2, desc: 'Vernichtender Hieb mit mehr als vierfachem Waffenschaden.', info: { role: 'Wuchtiger Einzelhieb mit über vierfachem Waffenschaden.', build: 'Nahkämpfer mit Zweihänder.', synergy: 'Mit Rüstungsbrecher und Fluch der Blöße.', decision: 'Lange Abklingzeit gegen einen vernichtenden Schlag.', limit: 'Nur ein Ziel im Nahkampf.' } },
  { id: 'venom_rain', name: 'Giftregen', area: 'Fernkampf', levelReq: 24, price: 3000, mana: 28, cooldown: 200, range: 9, base: [12, 18], scales: 'gewandtheit', aoe: 2.5, ignoresArmor: false, dot: { seconds: 8, factor: 1.8 }, dmgType: 'poison', tier: 2, desc: 'Giftpfeile auf eine Gruppe: Schaden und 8 s Gift auf alle Getroffenen.', info: { role: 'Gift auf eine ganze Gruppe.', build: 'Jäger und Fernkämpfer gegen Gruppen.', synergy: 'Mit Bogen und Gewandtheit; Gift ignoriert Rüstung.', decision: 'Zeit statt Soforttreffer.', limit: 'Untote und Golems sind immun.' } },
  { id: 'glacial_burst', name: 'Gletscherbruch', area: 'Magie', levelReq: 25, price: 3400, mana: 40, cooldown: 260, range: 1.6, base: [60, 84], scales: 'verstand', aoe: 3.6, aoeSelf: true, ignoresArmor: true, dmgType: 'frost', status: { id: 'slow', seconds: 5 }, tier: 2, desc: 'Eisige Detonation um dich herum, verlangsamt 5 s.', info: { role: 'Eisiger Flächenschaden um dich mit Verlangsamung.', build: 'Frostmagier im Nahbereich.', synergy: 'Mit Frostnova, Steinhaut und Elementarschild.', decision: 'Nähe zum Gegner gegen hohen Schaden.', limit: 'Golems sind resistent.' } },
  { id: 'meteor', name: 'Meteorschlag', area: 'Magie', levelReq: 26, price: 3800, mana: 48, cooldown: 300, range: 8, base: [100, 140], scales: 'verstand', aoe: 2.6, ignoresArmor: true, dmgType: 'fire', status: { id: 'burn', seconds: 4 }, tier: 2, desc: 'Ein Meteor schlägt am Ziel ein und verwüstet die Umgebung.', info: { role: 'Gewaltiger Feuerschaden am Ziel mit Explosion.', build: 'Feuermagier im Endgame.', synergy: 'Mit Feuerzauber-Werten, Verstand und Entzaubern.', decision: 'Sehr hohe Manakosten und lange Abklingzeit.', limit: 'Feuerresistente Gegner und Elementarschild senken den Schaden.' } },
  { id: 'titan_blow', name: 'Titanenhieb', area: 'Nahkampf', levelReq: 27, price: 4200, mana: 32, cooldown: 320, range: 1.5, mult: 5.6, ignoresArmor: false, status: { id: 'stun', seconds: 2 }, tier: 2, desc: 'Ein Hieb mit mehr als fünffachem Waffenschaden, betäubt 2 s.', info: { role: 'Schwerster Nahkampfhieb mit langer Betäubung.', build: 'Nahkämpfer mit Zweihandwaffe.', synergy: 'Mit Rüstungsbrecher und Kraft.', decision: 'Lange Abklingzeit gegen einen Finishing-Schlag.', limit: 'Bosse sind nur halb so lange betäubt.' } },
  { id: 'death_shot', name: 'Todesschuss', area: 'Fernkampf', levelReq: 28, price: 4600, mana: 34, cooldown: 240, range: 10, base: [90, 130], scales: 'gewandtheit', ignoresArmor: false, tier: 2, desc: 'Ein gezielter Schuss mit enormem Schaden (Bogen und Pfeile nötig).', info: { role: 'Mächtiger Einzelschuss auf große Distanz.', build: 'Fernkämpfer gegen Bosse.', synergy: 'Mit Präzision, Bogen und Schleichen.', decision: 'Wenige, aber vernichtende Schüsse.', limit: 'Braucht Bogen und Pfeile.' } },
  { id: 'soul_rend', name: 'Seelenriss', area: 'Magie', levelReq: 29, price: 5000, mana: 44, cooldown: 280, range: 7, base: [80, 110], scales: 'verstand', ignoresArmor: true, dot: { seconds: 6, factor: 2.2 }, dmgType: 'poison', tier: 2, desc: 'Reißt dem Ziel die Seele an: Schaden und starkes Gift über 6 s.', info: { role: 'Hoher Schaden plus starkes Gift über Zeit.', build: 'Magier gegen Bosse.', synergy: 'Mit Verstand, Fluch der Blöße und Verstummen.', decision: 'Zeit und Mana gegen Sofortschaden.', limit: 'Untote und Golems sind immun gegen das Gift.' } },
  { id: 'ash_apocalypse', name: 'Aschenapokalypse', area: 'Magie', levelReq: 30, price: 6000, mana: 64, cooldown: 420, range: 1.6, base: [120, 170], scales: 'verstand', aoe: 4, aoeSelf: true, ignoresArmor: true, dmgType: 'fire', status: { id: 'burn', seconds: 5 }, tier: 2, desc: 'Die Asche selbst brennt: gewaltiger Feuerschaden um dich herum.', info: { role: 'Höchster Flächenschaden des Spiels um dich herum.', build: 'Endgame-Magier.', synergy: 'Mit Verstand, Feuerzauber-Werten und Steinhaut.', decision: 'Extreme Manakosten und Abklingzeit.', limit: 'Feuerresistente Gegner und Elementarschild senken den Schaden.' } },
  // Stufe 6: Schutz, Schwächung, Kontrolle, Bannung, Passive, Hilfsfertigkeiten
  { id: 'cleanse', name: 'Läuterung', area: 'Magie', levelReq: 7, price: 300, mana: 12, cooldown: 300, range: 0, ignoresArmor: true, school: 'dispel', target: 'self', action: 'cleanse', tier: 1, desc: 'Entfernt Verlangsamung, Betäubung, Brand und Gift von dir.',
    info: { role: 'Reinigt dich von Debuffs und Kontrolle.', build: 'Jeder Zauberwirker und Nahkämpfer, der gegen Gift, Frost und Betäubung kämpft.', synergy: 'Gut gegen Spinnen (Gift, Verlangsamung), Frost- und Brandangriffe; ergänzt Willenskraft und Resistenzen.', decision: 'Ein Skillpunkt gegen mehr Schaden: Du überlebst Kontrolle statt sie auszusitzen.', limit: 'Heilt keinen Schaden, schützt nicht vor dem nächsten Effekt, Abklingzeit 15 s.' } },
  { id: 'elemental_ward', name: 'Elementarschild', area: 'Magie', levelReq: 8, price: 350, mana: 16, cooldown: 400, range: 0, ignoresArmor: true, school: 'protect', target: 'self', effect: { id: 'ward', seconds: 12, mag: 30, magPerRank: 4, cap: 60 }, tier: 1, desc: 'Senkt 12 s lang erlittenen Feuer-, Frost- und Giftschaden um 30 % (+4 % je Rang) und verkürzt Brand und Gift.',
    info: { role: 'Zeitlich begrenzter Elementarschutz zusätzlich zu Resistenzen (Obergrenze 75 % gesamt).', build: 'Elementarmagier, Kampfmagier und alle, die gegen Schamanen, Imps und Spinnen kämpfen.', synergy: 'Addiert sich zu Resistenz-Affixen und Edelsteinen; wirkt auf Brand-Dauer.', decision: 'Mana und eine Aktion für Überleben statt Schaden; Zeitpunkt vor dem Kampf wählen.', limit: 'Hilft nicht gegen physischen Schaden; ein Entzauberer (Knochenakolyth) bannt den Schild.' } },
  { id: 'weaken', name: 'Entkräftung', area: 'Magie', levelReq: 9, price: 400, mana: 12, cooldown: 300, range: 7, ignoresArmor: true, school: 'debuff', target: 'enemy', effect: { id: 'weaken', seconds: 10, mag: 25, magPerRank: 3, cap: 50 }, tier: 1, desc: 'Der Gegner verursacht 10 s lang 25 % (+3 % je Rang) weniger Schaden.',
    info: { role: 'Senkt den ausgehenden Schaden eines einzelnen Gegners.', build: 'Kontroll- und Debuff-Spezialisten, Schildkämpfer gegen einzelne starke Gegner.', synergy: 'Mit hoher Rüstung und Schildbeherrschung wird ein einzelner Gegner kaum noch gefährlich.', decision: 'Eine Aktion gegen Dauerschaden, lohnt bei Elite- und Bossgegnern.', limit: 'Nur ein Ziel, wirkt nicht auf Flächenangriffe oder Beschwörungen, ersetzt nur schwächere Entkräftung.' } },
  { id: 'dispel_magic', name: 'Entzaubern', area: 'Magie', levelReq: 10, price: 500, mana: 12, cooldown: 200, range: 7, ignoresArmor: true, school: 'dispel', target: 'enemy', action: 'dispel', tier: 2, desc: 'Entfernt Schutz- und Verstärkungszauber vom Ziel.',
    info: { role: 'Bannt Verstärkungen eines Gegners.', build: 'Kampfmagier und Kontroll-Spezialisten gegen Zauberer.', synergy: 'Gegen Schamanen, Hexen und Totenbeschwörer, die sich mit Elementarschild schützen; danach Direktschaden.', decision: 'Ein Zug, der keinen Schaden macht, aber den Schild des Gegners zerstört.', limit: 'Wirkt nur auf Verstärkungen, nie auf Gift, Brand oder Kontrolle.' } },
  { id: 'stone_skin', name: 'Steinhaut', area: 'Magie', levelReq: 12, price: 600, mana: 18, cooldown: 500, range: 0, ignoresArmor: true, school: 'protect', target: 'self', effect: { id: 'stoneskin', seconds: 12, mag: 25, magPerRank: 4, cap: 55 }, tier: 2, desc: 'Senkt 12 s lang erlittenen Nahkampf- und Fernkampfschaden (nach Rüstung) um 25 % (+4 % je Rang).',
    info: { role: 'Zeitlich begrenzter Schutz gegen physische Treffer.', build: 'Schildkämpfer und Kampfmagier im Nahkampf.', synergy: 'Mit Rüstung, Schildbeherrschung und Parieren; ergänzt den Elementarschild.', decision: 'Mana gegen Lebensverlust in harten Kämpfen.', limit: 'Mindert keinen Elementar-, Gift- oder Brandschaden und keine Zauber, die Rüstung ignorieren.' } },
  { id: 'silence', name: 'Verstummen', area: 'Magie', levelReq: 13, price: 800, mana: 14, cooldown: 360, range: 7, ignoresArmor: true, school: 'control', target: 'enemy', effect: { id: 'silence', seconds: 4 }, tier: 2, desc: 'Der Gegner kann 4 s lang nicht zaubern, heilen oder beschwören; Bosse halb so lange.',
    info: { role: 'Unterbricht Zauberer und Heiler.', build: 'Kontroll-Spezialisten, Fernkämpfer gegen Schamanen und Totenbeschwörer.', synergy: 'Schaltet Heiler, Beschwörer und Schutzzauber der Gegner aus; wiederholte Anwendung verkürzt sich.', decision: 'Ein Zug gegen die wichtigste Fähigkeit des Gegners statt Schaden.', limit: 'Hindert keine Nahkampfangriffe und keine Pfeile; kurz, Wiederholungen werden kürzer.' } },
  { id: 'curse', name: 'Fluch der Blöße', area: 'Magie', levelReq: 14, price: 900, mana: 20, cooldown: 450, range: 7, ignoresArmor: true, school: 'debuff', target: 'enemy', effect: { id: 'curse', seconds: 8, mag: 15, magPerRank: 2, cap: 35 }, tier: 2, desc: 'Der Gegner erleidet 8 s lang 15 % (+2 % je Rang) mehr Schaden.',
    info: { role: 'Erhöht den Schaden, den ein Gegner erleidet.', build: 'Debuff-Spezialisten und Nahkämpfer gegen Bosse.', synergy: 'Mit großen Einzeltreffern (Schädelspalter, Blitzschlag) am wertvollsten.', decision: 'Eine Aktion und Mana zum Verstärken aller folgenden Treffer.', limit: 'Nur ein Ziel, hält 8 s, stärkerer Fluch ersetzt schwächeren.' } },
  { id: 'first_aid', name: 'Erste Hilfe', area: 'Überleben', levelReq: 3, price: 150, mana: 0, cooldown: 1200, range: 0, ignoresArmor: true, school: 'utility', target: 'self', effect: { id: 'bandage', seconds: 8, mag: 3, magPerRank: 0.5, cap: 6 }, tier: 1, desc: 'Verband: heilt 8 s lang 3 % (+0,5 % je Rang) deines Lebens pro Sekunde; jeder Treffer löst ihn.',
    info: { role: 'Kostenlose Heilung außerhalb von Kämpfen.', build: 'Jeder Build, der Tränke sparen will, besonders Magier ohne Mana-Reserve.', synergy: 'Mit Überleben und Rasten; spart Heiltränke beim Jagen.', decision: 'Ein Skillpunkt gegen Tränke: Zeit statt Gold.', limit: 'Jeder erlittene Treffer löst den Verband; Abklingzeit 60 s; kein Kampfmittel.' } },
  { id: 'mana_flow', name: 'Manafluss', area: 'Magie', levelReq: 6, price: 250, mana: 0, cooldown: 0, range: 0, ignoresArmor: true, school: 'resource', target: 'self', passive: true, pass: { manaCost: 4, manaRegen: 10 }, tier: 1, desc: 'Passiv: Manakosten −4 % und Manaregeneration +10 % je Rang.',
    info: { role: 'Verwaltet Mana: günstigere Zauber und schnellere Erholung.', build: 'Elementar- und Kampfmagier, Heiler.', synergy: 'Mit Willenskraft (Regeneration) und Stäben mit hohem Mana.', decision: 'Dauerhafter Vorteil statt neuem Zauber.', limit: 'Erhöht keinen Schaden; Kostensenkung höchstens 25 %.' } },
  { id: 'parry', name: 'Parieren', area: 'Nahkampf', levelReq: 5, price: 300, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'protect', target: 'self', passive: true, pass: { parry: 3 }, tier: 1, desc: 'Passiv: 3 % Chance je Rang, einen Nahkampfangriff ganz abzuwehren (Einhandwaffe oder Schild nötig).',
    info: { role: 'Wehrt manche Nahkampftreffer vollständig ab.', build: 'Schild- und Einhandkämpfer.', synergy: 'Mit Schild (auch Schildbeherrschung) und Einhandwaffen; Dolche mit schnellem Tempo profitieren vom Austausch.', decision: 'Verteidigung als Glück statt Rüstung.', limit: 'Nicht mit Zweihand, Bogen oder Stab; wirkt nicht gegen Zauber, Pfeile oder Flächenschaden; höchstens 15 %.' } },
  { id: 'shield_mastery', name: 'Schildbeherrschung', area: 'Nahkampf', levelReq: 8, price: 450, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'protect', target: 'self', passive: true, pass: { shieldArmor: 12 }, tier: 1, desc: 'Passiv: Schilde bringen 12 % mehr Rüstung je Rang.',
    info: { role: 'Verstärkt die Rüstung des angelegten Schilds.', build: 'Defensiver Schildkämpfer.', synergy: 'Mit Schwergewichtsschilden, Parieren und Steinhaut.', decision: 'Nur mit Schild nützlich: festlegen auf Einhand und Schild.', limit: 'Ohne Schild wirkungslos; Zweihandwaffen und Bögen schließen den Schild aus.' } },
  { id: 'armor_break', name: 'Rüstungsbrecher', area: 'Nahkampf', levelReq: 9, price: 500, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'direct', target: 'enemy', passive: true, pass: { armorPen: 6 }, tier: 2, desc: 'Passiv: Angriffe ignorieren 6 % der gegnerischen Rüstung je Rang.',
    info: { role: 'Durchdringt Rüstung bei normalen Angriffen und Skills.', build: 'Nahkämpfer und Fernkämpfer gegen gepanzerte Gegner (Golems, Ritter).', synergy: 'Mit schweren Waffen (Zweihänder) und Schädelspalter.', decision: 'Dauerhafter Vorteil gegen Rüstung statt mehr Schaden.', limit: 'Wirkt nicht auf Zauber, die Rüstung ohnehin ignorieren; höchstens 40 %.' } },
  { id: 'precision', name: 'Präzision', area: 'Fernkampf', levelReq: 7, price: 400, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'direct', target: 'enemy', passive: true, pass: { crit: 2 }, tier: 1, desc: 'Passiv: +2 % kritische Trefferchance je Rang (zählt zur Obergrenze von 50 %).',
    info: { role: 'Mehr kritische Treffer (doppelter Schaden).', build: 'Fernkämpfer und schnelle Dolchkämpfer.', synergy: 'Mit Eile und Krit-Affixen; Salve wirkt mehrfach.', decision: 'Schwankender Zusatzschaden statt Verlässlichkeit.', limit: 'Gesamt höchstens 50 % Krit; kein Effekt gegen immune Gegner.' } },
  { id: 'evasion_training', name: 'Ausweichtraining', area: 'Fernkampf', levelReq: 6, price: 350, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'protect', target: 'self', passive: true, pass: { evade: 6 }, tier: 1, desc: 'Passiv: +6 Ausweichwert je Rang (weniger gegnerische Treffer, keine Wirkung gegen Zauber).',
    info: { role: 'Mehr Ausweichen gegen normale Angriffe.', build: 'Fernkämpfer und leicht gerüstete Kämpfer.', synergy: 'Mit Gewandtheit, Umhängen und Lederrüstung.', decision: 'Leichte Rüstung plus Ausweichen statt Plattenpanzer.', limit: 'Trefferchance bleibt mindestens 35 %; Zauber und Flächenschaden treffen immer.' } },
  { id: 'stealth', name: 'Schleichen', area: 'Überleben', levelReq: 6, price: 300, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'utility', target: 'self', passive: true, pass: { stealth: 8 }, tier: 1, desc: 'Passiv: Gegner bemerken dich 8 % je Rang später (kleinerer Entdeckungsradius).',
    info: { role: 'Verkleinert den Radius, in dem Gegner dich entdecken.', build: 'Fernkämpfer, Jäger, Schatzsucher.', synergy: 'Mit Bogen: Ziele ansprechen, bevor sie angreifen.', decision: 'Vermeiden statt Kämpfen.', limit: 'Verhindert keinen Rudelalarm und wirkt nicht, wenn du Gegner angreifst; höchstens 40 %.' } },
  { id: 'survival', name: 'Überleben', area: 'Überleben', levelReq: 4, price: 200, mana: 0, cooldown: 0, range: 0, ignoresArmor: false, school: 'utility', target: 'self', passive: true, pass: { fieldRegen: 0.5, carry: 2 }, tier: 1, desc: 'Passiv: +0,5 Leben/s außerhalb von Städten und +2 Traglast je Rang.',
    info: { role: 'Erholung in der Wildnis und mehr Tragkraft.', build: 'Jäger und Grinder ohne viele Tränke.', synergy: 'Mit Erster Hilfe und Rasten (R).', decision: 'Ausdauer im Feld statt Kampfkraft.', limit: 'Wirkt nicht in Städten (dort ohnehin schnelle Erholung) und nicht im Kampf mit viel Schaden.' } },
];

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export const SAFE_REGEN = 0.5;
export const FIELD_REGEN = 0.02;

export const SHOPS: Record<string, string[]> = {
  // Moosbrück: Werkstatt für Build-Ausrüstung bis Stufe 11 (Stäbe, Parierwaffen, Schilde, Ringe) und Tränke; höhere Build-Stücke fallen nur als Beute
  artisan: ['heal_mid', 'heal_big', 'mana_mid', 'mana_big', 'parry_blade', 'mender_staff', 'mender_ring', 'pyre_staff', 'rime_staff', 'bulwark_shield', 'windrunner_boots', 'flow_ring', 'binding_amulet'],
  basic: ['rusty_sword', 'bone_club', 'steel_sword', 'leather_cap', 'iron_helm', 'ash_mail', 'worn_gloves', 'cloth_boots', 'iron_greaves', 'iron_ring', 'scroll_hafen', 'scroll_wacht', 'heal_small', 'heal_mid', 'mana_small', 'mana_mid', 'hunt_bow', 'twig_staff', 'cloth_robe', 'leather_vest', 'wood_arrows', 'iron_arrows', 'wood_shield', 'cloth_belt', 'leather_belt', 'rag_cloak', 'wool_cloak', 'cloth_pants', 'leather_pants', 'iron_dagger', 'woodcutter_axe'],
  advanced: ['scroll_hafen', 'scroll_wacht', 'steel_sword', 'cinder_axe', 'war_blade', 'iron_helm', 'warden_helm', 'plate_cuirass', 'bone_plate', 'iron_gauntlets', 'ember_gauntlets', 'iron_greaves', 'steel_boots', 'silver_ring', 'heal_mid', 'heal_big', 'mana_mid', 'mana_big', 'yew_bow', 'horn_bow', 'oak_staff', 'bone_staff', 'acolyte_robe', 'hunter_vest', 'bone_leather', 'iron_arrows', 'steel_arrows', 'ember_arrows', 'iron_shield', 'steel_shield', 'leather_belt', 'iron_belt', 'wool_cloak', 'hunter_cloak', 'leather_pants', 'chain_legs', 'steel_dagger', 'battle_axe', 'claymore', 'parry_blade', 'mender_staff', 'mender_ring', 'pyre_staff', 'rime_staff', 'bulwark_shield', 'windrunner_boots', 'flow_ring', 'binding_amulet'],
};

/** Gegenstands-Drops: Ausrüstung seltener, Tränke häufiger. Faktor auf die Monster-dropChance. */
export const GEAR_DROP_FACTOR = 0.5;
export const POTION_DROP_CHANCE = 0.3;
export const POTION_COOLDOWN_TICKS = 100;

/** Rüstungs-Formel: Schaden * K / (K + Rüstung) */
export const ARMOR_K = 30;

/** kill: Monsterart; chest: Truhen; champion/unique: Champions bzw. Mini-Bosse (unique mit `target`: ein bestimmter); visit: Region betreten; bring: Gegenstand von Monstern/Truhen sammeln; talk: mit einem NPC sprechen */
export type QuestKind = 'kill' | 'chest' | 'champion' | 'unique' | 'visit' | 'bring' | 'talk';

export interface QuestDef {
  id: string;
  /** kill: Monsterart `target`; chest: Truhen öffnen; champion: Champions töten; unique: benannte Mini-Bosse töten */
  kind: QuestKind;
  name: string;
  text: string;
  minLevel: number;
  /** Monsterart, die gezählt wird */
  target: string;
  count: number;
  xp: number;
  gold: number;
  /** Aufgabenkette (Titel); Reihenfolge im Feld QUESTS bestimmt die Kapitel */
  chain?: string;
  /** Vorgänger in der Kette: erst nach dessen Abgabe freigeschaltet */
  requires?: string;
  /** visit: Regionsname, der betreten werden muss; bring mit `chestRegion`: Region der Truhen */
  place?: string;
  /** bring: Name des Quest-Gegenstands (kein echter Inventar-Gegenstand, nur gezählt, nicht verkaufbar), Quellmonster, Trefferchance je Kill */
  item?: string;
  monsters?: string[];
  chance?: number;
  chestRegion?: string;
  /** Belohnung zusätzlich zu XP/Gold: ein seltener Gegenstand oder ein Unikat/Set-Teil */
  reward?: 'rare' | 'unique';
  /** Abschlusstext (Chatzeile bei Abgabe) */
  outro?: string;
}

const q = (id: string, name: string, text: string, minLevel: number, target: string, count: number, xpMul: number, goldMul: number): QuestDef => {
  const k = MONSTERS.find((m) => m.id === target)!;
  return { id, kind: 'kill', name, text, minLevel, target, count, xp: Math.round(k.xp * count * xpMul), gold: Math.round(k.gold[1] * count * goldMul) };
};

/** Abwechslungsreichere Aufträge: Truhen, Champions, Mini-Bosse (Belohnung nach Stufe). */
const qv = (id: string, name: string, text: string, minLevel: number, kind: QuestKind, count: number, mult: number): QuestDef => ({
  id, kind, name, text, minLevel, target: '', count,
  xp: Math.round(SCALE.xp(minLevel + 1) * count * mult),
  gold: Math.round((minLevel * 3 + 3) * count * mult),
});

export const QUESTS: QuestDef[] = [
  q('q_rats', 'Rattenplage', 'Die Felder sind voller Ratten. Erlege 8 Feldratten.', 1, 'field_rat', 8, 1.5, 1.5),
  q('q_hounds', 'Wilde Hunde', 'Wildhunde reißen unser Vieh. Erlege 8 davon.', 2, 'wild_hound', 8, 1.5, 1.5),
  q('q_goblins', 'Goblinplage', 'Goblins plündern die Höfe am Waldrand. Vertreibe 10 Goblins.', 3, 'goblin', 10, 1.5, 1.5),
  q('q_goblin_scouts', 'Späher im Unterholz', 'Goblinkundschafter spähen unsere Wege aus. Töte 8.', 5, 'goblin_scout', 8, 1.5, 1.5),
  q('q_goblin_king', 'Der Goblinkönig', 'Grix sammelt ein Heer im Goblinbau nördlich des Räuberlagers. Erschlage ihn.', 10, 'goblin_king', 1, 1.5, 2),
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

QUESTS.push(
  qv('q_chests1', 'Schatzsucher', 'Man munkelt von vergrabenen Truhen auf den Feldern. Öffne 3 Truhen.', 2, 'chest', 3, 2.5),
  qv('q_unique1', 'Namenlose Jagd', 'Manche Bestien haben Namen und Gefolge. Erlege einen benannten Gegner (Orange auf der Karte).', 6, 'unique', 1, 6),
  qv('q_champs1', 'Anführer brechen', 'Rudelführer mit besonderer Kraft leiten die Angriffe. Besiege 4 Champions.', 8, 'champion', 4, 2),
  qv('q_chests2', 'Beutezug', 'Plündere 6 Truhen im Land, in Dungeons oder in der Wildnis.', 10, 'chest', 6, 2.5),
  qv('q_unique2', 'Legenden der Wildnis', 'Jage 3 benannte Gegner.', 14, 'unique', 3, 5),
  qv('q_champs2', 'Eiserne Anführer', 'Brich die Macht von 8 Champions.', 18, 'champion', 8, 2),
);

type ChainStep = Partial<QuestDef> & Pick<QuestDef, 'id' | 'kind' | 'name' | 'text' | 'minLevel'>;
/** Kettenglied: Belohnung wächst mit Stufe und Faktor `mult`; talk/visit zählen 1. */
const chainQ = (chain: string, mult: number, st: ChainStep): QuestDef => {
  const count = st.count ?? 1;
  return {
    target: '', count, ...st, chain,
    xp: Math.round(SCALE.xp(st.minLevel + 1) * count * mult * (st.kind === 'bring' ? 0.5 : 1)),
    gold: Math.round((st.minLevel * 3 + 3) * Math.max(1, count * 0.7) * mult),
  };
};

export const CHAIN_GOBLIN = 'Spuren des Goblinkönigs';
export const CHAIN_MOOR = 'Das Schweigen im Moor';
export const CHAIN_OATH = 'Der letzte Eid';
export const CHAIN_MINE = 'Pells Fund';
export const CHAIN_WEB = 'Netze der Königin';
export const CHAIN_ARRIVAL = 'Ankunft in Aschenhafen';
export const CHAIN_THRONE = 'Die Chronik der Asche';

QUESTS.push(
  chainQ(CHAIN_GOBLIN, 2, { id: 'c_gob1', kind: 'talk', name: 'Ein Wort mit der Jägerin', text: 'Chronistin Maren schickt dich zu Jägerin Ysa am Räuberlager: Sie hat die Spuren des Goblinkönigs gelesen.', minLevel: 5, target: 'ysa', outro: 'Ysa nickt knapp: „Dann hör gut zu. Es gibt Arbeit.“' }),
  chainQ(CHAIN_GOBLIN, 2, { id: 'c_gob2', kind: 'bring', name: 'Goblinzeichen', text: 'Sammle 4 Goblinzeichen: abgenagte Knochenstücke, die Goblins bei sich tragen. Ysa liest daraus, wohin sie ziehen.', minLevel: 6, requires: 'c_gob1', item: 'Goblinzeichen', monsters: ['goblin', 'goblin_scout', 'goblin_archer', 'goblin_warrior', 'goblin_shaman'], chance: 0.5, count: 4, outro: 'Ysa ordnet die Zeichen in den Staub. „Ein Bau. Tief unter dem Lager.“' }),
  chainQ(CHAIN_GOBLIN, 2, { id: 'c_gob3', kind: 'visit', name: 'Der Eingang des Baus', text: 'Finde den Goblinbau im Norden des Räuberlagers und betritt ihn. Nur einen Blick, mehr nicht.', minLevel: 8, requires: 'c_gob2', place: 'Goblinbau', outro: 'Ysa: „Du lebst. Gut. Dann weißt du jetzt, womit wir es zu tun haben.“' }),
  chainQ(CHAIN_GOBLIN, 3, { id: 'c_gob4', kind: 'kill', name: 'Das Ende des Goblinkönigs', text: 'Grix hat sich in seinem Bau verschanzt. Erschlage ihn, bevor sein Heer die Höfe überrennt.', minLevel: 10, requires: 'c_gob3', target: 'goblin_king', reward: 'rare', outro: 'Ysa spuckt in die Asche: „Der Wald atmet wieder.“' }),

  chainQ(CHAIN_MOOR, 2, { id: 'c_moor1', kind: 'talk', name: 'Der Eremit im Moor', text: 'Torwache Haldor erzählt von einem Einsiedler in den Moorlanden, der die Hexe kennt. Sprich mit Eremit Olm.', minLevel: 6, target: 'olm', outro: 'Olm blinzelt aus tiefen Höhlen der Augen. „Setz dich, Fremder. Das Moor flüstert.“' }),
  chainQ(CHAIN_MOOR, 2, { id: 'c_moor2', kind: 'bring', name: 'Irrlichtkraut', text: 'Bring Olm 5 Büschel Irrlichtkraut. Es wächst nur dort, wo Ghule und Moorleichen liegen.', minLevel: 7, requires: 'c_moor1', item: 'Irrlichtkraut', monsters: ['bog_ghoul', 'marsh_corpse'], chance: 0.45, count: 5, outro: 'Olm riecht an dem Kraut und lächelt dünn. „Genug für einen Trank der Klarsicht.“' }),
  chainQ(CHAIN_MOOR, 2, { id: 'c_moor3', kind: 'kill', name: 'Hexen des Moors', text: 'Die Sumpfhexen hören Veshras Ruf. Töte 6 von ihnen, damit ihr Singen leiser wird.', minLevel: 10, requires: 'c_moor2', target: 'bog_witch', count: 6, outro: 'Olm lauscht in die Nacht. „Leiser. Aber nicht still.“' }),
  chainQ(CHAIN_MOOR, 3, { id: 'c_moor4', kind: 'kill', name: 'Veshras Ende', text: 'Dringe in die Gruft der Moorhexe vor und töte Veshra. Olm hat sie einst gekannt.', minLevel: 14, requires: 'c_moor3', target: 'bog_queen', reward: 'unique', outro: 'Olm weint, ohne dass sich sein Gesicht bewegt. „Danke. Endlich ruht sie.“' }),

  chainQ(CHAIN_OATH, 2, { id: 'c_eid1', kind: 'talk', name: 'Der Sterbende Ritter', text: 'Haldor spricht von einem Ritter, der in der Aschenöde liegt und nicht sterben will. Finde Aldric und höre ihn an.', minLevel: 20, target: 'aldric', outro: 'Aldrics Atem rasselt. „Kommst du … von Thron und Krone?“' }),
  chainQ(CHAIN_OATH, 2, { id: 'c_eid2', kind: 'bring', name: 'Siegelsplitter', text: 'Aldric trug ein Siegel, das beim Fall des Throns zerbrach. Sammle 4 Siegelsplitter von den Wesen der Aschenöde.', minLevel: 21, requires: 'c_eid1', item: 'Siegelsplitter', monsters: ['ash_walker', 'cinder_wisp', 'imp', 'night_stalker'], chance: 0.35, count: 4, outro: 'Aldric hält die Splitter an die Brust. „Noch hält es. Noch.“' }),
  chainQ(CHAIN_OATH, 3, { id: 'c_eid3', kind: 'visit', name: 'Hinter der Asche', text: 'Aldric bittet dich, den Aschengrund im Osten der Öde zu betreten und zurückzukehren – er muss wissen, ob das Tor offen ist.', minLevel: 27, requires: 'c_eid2', place: 'Aschengrund', outro: 'Aldric schließt die Augen. „Offen. Wie ich fürchtete.“' }),
  chainQ(CHAIN_OATH, 4, { id: 'c_eid4', kind: 'unique', name: 'Morvaths Schwur', text: 'Aschenfürst Morvath hält die Pforte im Aschengrund. Zerschlage ihn, damit Aldrics Eid erfüllt ist.', minLevel: 28, requires: 'c_eid3', target: 'abyss_warden', reward: 'unique', outro: 'Aldric lächelt zum ersten Mal. „Die Wache … ist vorbei.“' }),

  chainQ(CHAIN_MINE, 2, { id: 'c_pell1', kind: 'chest', name: 'Pells Spürsinn', text: 'Der Schatzsucher Pell hat die Mine kartiert, aber nie Zeit gehabt, alles zu leeren. Öffne 3 Truhen irgendwo im Land.', minLevel: 17, count: 3 }),
  chainQ(CHAIN_MINE, 2, { id: 'c_pell2', kind: 'bring', name: 'Pells Beutel', text: 'Pell hat seinen Beutel in einer Truhe der Tiefenmine verloren. Finde 2 Beutel in den Truhen dort.', minLevel: 17, requires: 'c_pell1', item: 'Pells Beutel', chestRegion: 'Tiefenmine', count: 2, outro: 'Pell zählt die Münzen mit zitternden Fingern. „Alles da. Fast alles.“' }),
  chainQ(CHAIN_MINE, 3, { id: 'c_pell3', kind: 'kill', name: 'Die Webmutter', text: 'Hinter dem letzten Gang wartet Webmutter Skarra. Pell traut sich nicht, solange sie lebt.', minLevel: 20, requires: 'c_pell2', target: 'web_mother', reward: 'rare', outro: 'Pell lacht heiser. „Dann gehört die Mine wieder den Lebenden.“' }),

  chainQ(CHAIN_WEB, 2, { id: 'c_web1', kind: 'visit', name: 'Das Spinnennest', text: 'Südlich vom Totenacker liegt ein Nest. Haldor will wissen, wie groß es ist. Betritt das Spinnennest.', minLevel: 13, place: 'Spinnennest', outro: 'Haldor zeichnet das Nest in die Karte. „Größer als gedacht.“' }),
  chainQ(CHAIN_WEB, 2, { id: 'c_web2', kind: 'bring', name: 'Seidenstränge', text: 'Sammle 5 Seidenstränge von den Spinnen im Nest. Die Schmiede brauchen sie als Beweis.', minLevel: 14, requires: 'c_web1', item: 'Seidenstrang', monsters: ['giant_spider', 'web_stalker', 'nest_matron', 'brood_spider'], chance: 0.4, count: 5, outro: 'Haldor hebt einen Strang ins Licht. „Dünner als Haar, fester als Stahl.“' }),
  chainQ(CHAIN_WEB, 3, { id: 'c_web3', kind: 'kill', name: 'Spinnenkönigin Vyrra', text: 'Töte die Königin des Nests, bevor sie sich ausbreitet.', minLevel: 17, requires: 'c_web2', target: 'spider_queen', reward: 'rare', outro: 'Haldor schweigt lange. „Schlaf gut heute Nacht. Ich werde es nicht.“' }),
);

// Hauptfaden für die hohen Stufen: Chronistin Maren führt Schritt für Schritt zum Aschenkönig
QUESTS.push(
  chainQ(CHAIN_THRONE, 2.5, { id: 'c_thr1', kind: 'kill', name: 'Der Knochenfürst', text: 'Maren schreibt die Geschichte des Falls nieder und braucht Zeugen. Beginne mit Knochenfürst Morrik: Er hütet die Toten im Totenacker.', minLevel: 15, target: 'bone_lord', reward: 'rare', outro: 'Maren streicht eine Zeile durch. „Einer weniger, der sich erinnert. Danke.“' }),
  chainQ(CHAIN_THRONE, 2.5, { id: 'c_thr2', kind: 'unique', name: 'Der Wächter der Gruft', text: 'Gruftwächter Ormund trägt den Schlüssel zur alten Königsgruft. Erlege ihn und bring Maren die Nachricht.', minLevel: 18, requires: 'c_thr1', target: 'crypt_ormund', outro: 'Maren: „Die Gruft steht offen. Was darin lag, ist längst Asche.“' }),
  chainQ(CHAIN_THRONE, 3, { id: 'c_thr3', kind: 'champion', name: 'Die Brut der Asche', text: 'Wachführerin Tessa meldet: Immer mehr Anführer sammeln sich im Osten. Brich die Macht von 4 Champions.', minLevel: 22, requires: 'c_thr2', count: 4, outro: 'Tessa nickt knapp. „Sie sammeln sich nicht umsonst. Etwas ruft sie.“' }),
  chainQ(CHAIN_THRONE, 3, { id: 'c_thr4', kind: 'unique', name: 'Der Bergkönig', text: 'Späher Ruven hat den Bergkönig Thurgrim in den Hochlanden gesehen. Wer ihn schlägt, öffnet den Weg zum Thron.', minLevel: 24, requires: 'c_thr3', target: 'mountain_king', reward: 'rare', outro: 'Ruven pfeift leise. „Das hätte ich dir nicht zugetraut. Jetzt traue ich es dir zu.“' }),
  chainQ(CHAIN_THRONE, 3.5, { id: 'c_thr5', kind: 'unique', name: 'Der Glutfürst', text: 'Glutfürst Zarkesh bewacht die Pforte zur Aschenöde. Ruven: „Ohne seine Glut kommt keiner an den Thron.“', minLevel: 26, requires: 'c_thr4', target: 'cinder_lord_zarkesh', reward: 'unique', outro: 'Ruven senkt die Stimme. „Der Weg ist frei. Der Aschenkönig wartet.“' }),
  chainQ(CHAIN_THRONE, 3.5, { id: 'c_thr6', kind: 'visit', name: 'Vor dem Thron', text: 'Betritt den Thron der Asche und sieh dem König ins Gesicht. Maren will wissen, ob die Chronik enden darf.', minLevel: 28, requires: 'c_thr5', place: 'Thron der Asche', outro: 'Maren legt die Feder nieder. „Dann schreibt jetzt kein Chronist mehr. Sondern du.“' }),
);

// Ankunftskette für neue Spieler: ein Rundgang, bei dem jede Rolle der Stadt einmal erklärt wird (reine Gesprächsaufgaben, kleine Belohnung)
QUESTS.push(
  chainQ(CHAIN_ARRIVAL, 3, { id: 'c_arr1', kind: 'talk', name: 'Im Lehrhaus', text: 'Hafenmeister Joren schickt dich zum Lehrhaus nördlich der Straße: Lehrer Varn zeigt dir, wie du Fertigkeiten lernst.', minLevel: 1, target: 'varn', outro: 'Varn: „Fertigkeiten lernst du hier gegen Skillpunkte und Gold. Jede Stufe bringt einen Punkt. Wähle dir einen Stil, nicht alles.“' }),
  chainQ(CHAIN_ARRIVAL, 3, { id: 'c_arr2', kind: 'talk', name: 'Im Kaufhaus', text: 'Varn rät dir, bei Händlerin Mirel Tränke und eine erste Ausrüstung zu kaufen.', minLevel: 1, requires: 'c_arr1', target: 'mirel', outro: 'Mirel: „Waffen, Rüstung, Tränke. Du kannst hier auch alles verkaufen, was du nicht brauchst. Zieh Gegenstände in den Rucksack, um zu kaufen.“' }),
  chainQ(CHAIN_ARRIVAL, 3, { id: 'c_arr3', kind: 'talk', name: 'In der Schmiede', text: 'Mirel verweist dich an Schmiedin Ilse: Sie verbessert Gegenstände.', minLevel: 1, requires: 'c_arr2', target: 'ilse', outro: 'Ilse: „Ich werte Gegenstände auf, würfle Zusatzwerte neu und setze Edelsteine ein. Komm wieder, wenn du Gold und gute Beute hast.“' }),
  chainQ(CHAIN_ARRIVAL, 3, { id: 'c_arr4', kind: 'talk', name: 'Im Lagerhaus', text: 'Ilse schickt dich ins Lagerhaus zu Lagerverwalter Ottmar. Dort liegt dein Besitz sicher.', minLevel: 1, requires: 'c_arr3', target: 'ottmar', outro: 'Ottmar: „Alles in meinem Lager bleibt dir auch beim Tod. Lass wertvolle Dinge hier, wenn du in gefährliche Gegenden gehst.“' }),
  chainQ(CHAIN_ARRIVAL, 3, { id: 'c_arr5', kind: 'talk', name: 'Bei der Wache', text: 'Zuletzt zur Wache: Hauptmann Brandt hat die ersten Aufträge für dich.', minLevel: 1, requires: 'c_arr4', target: 'brandt', outro: 'Brandt: „Gut, dass du dich umgesehen hast. Nimm dir einen Auftrag, jage in den Feldern und komm zurück. Viel Glück.“' }),
);

/** Stabile NPC-Schlüssel (Gesprächsaufgaben referenzieren diese statt des Anzeigenamens) → Anzeigename. */
export const NPC_KEYS: Record<string, string> = {
  maren: 'Chronistin Maren',
  haldor: 'Torwache Haldor',
  ysa: 'Jägerin Ysa',
  olm: 'Eremit Olm',
  pell: 'Schatzsucher Pell',
  aldric: 'Ritter Aldric',
  joren: 'Hafenmeister Joren',
  varn: 'Lehrer Varn',
  mirel: 'Händlerin Mirel',
  ilse: 'Schmiedin Ilse',
  ottmar: 'Lagerverwalter Ottmar',
  brandt: 'Hauptmann Brandt',
};

/** Rollenhinweis im Fenster jedes Stadt-NPCs: Was kann ich hier tun? */
export const NPC_ROLE: Record<string, string> = {
  'Hafenmeister Joren': 'Willkommen! Frag mich, wenn du nicht weißt, wohin.',
  'Lehrer Varn': 'Kampflehrer: Nahkampf, Fernkampf und Überleben lernen; hier verteilst du auch deine Skillpunkte neu.',
  'Magierin Selka': 'Magielehrerin: Zauber lernen (Feuer, Frost, Heilung, Schutz). Kampffertigkeiten lehrt Varn.',
  'Händlerin Mirel': 'Kaufen und verkaufen: Waffen, Rüstung, Tränke.',
  'Händler Wenzel': 'Spezialausrüster: Ausrüstung für besondere Spielstile (Stäbe, Schilde, Ringe).',
  'Schmiedin Ilse': 'Gegenstände aufwerten, Zusatzwerte neu würfeln, Edelsteine einsetzen.',
  'Lagerverwalter Ottmar': 'Sicheres Lager: Hier abgelegte Gegenstände bleiben dir auch beim Tod.',
  'Lagerverwalter Torvin': 'Sicheres Lager der Felsenwacht: dasselbe Lager wie in Aschenhafen, Gegenstände bleiben dir auch beim Tod.',
  'Hauptmann Brandt': 'Aufträge der Wache: Jagd, Truhen und Anführer.',
  'Kräuterfrau Odda': 'Aufträge rund um Kräuter und die Ghule im Moor.',
  'Chronistin Maren': 'Geschichten und Spuren der Insel; ihre Aufträge führen weit hinaus.',
};
/** Schlüssel eines NPC (aus dem Anzeigenamen) oder undefined. */
export function npcKeyOf(name: string): string | undefined {
  return Object.keys(NPC_KEYS).find((k) => NPC_KEYS[k] === name);
}

/** Dialoge der benannten NPCs (2–4 Absätze). Schlüssel: NPC-Name. Die Aufgaben stehen an den NPCs der Karte (Eigenschaft `quests`). */
export const NPC_LORE: Record<string, string[]> = {
  'Hafenmeister Joren': [
    'Willkommen in Aschenhafen. Das Schiff hinter dir bringt jeden, der hier neu anfängt.',
    'Nördlich der Straße: das Lehrhaus (Buchzeichen) für Fertigkeiten, das Kaufhaus (Münzen) für Waren, die Schmiede (Amboss) und das Lager (Truhe). Die Wache (Schild) vergibt Aufträge, die Kräuterfrau (Blatt) auch.',
    'Geh deinen Weg erst einmal in Ruhe ab. Vor der Stadt warten auf den Feldern Ratten und Hunde – zum Üben genau richtig. Wenn du magst, mache einen Rundgang: Ich schicke dich zum Lehrer.',
  ],
  'Chronistin Maren': [
    'Ich schreibe auf, was andere vergessen wollen. Aschental war einmal ein Garten, bevor der Thron der Asche den Himmel verbrannte.',
    'Die Felder, der Wald, das Moor – überall liegen Namen im Boden, die niemand mehr trägt. Jede Truhe, jedes Grab gehört zu einer Geschichte.',
    'Wenn du mir Spuren bringst, schreibe ich sie nieder. Wer weiß, vielleicht kannst du ein Kapitel zu Ende führen, das ich nur anfangen konnte.',
  ],
  'Jägerin Ysa': [
    'Hier ist das Räuberlager, und trotzdem fürchte ich weniger die Banditen als das, was unter ihnen scharrt.',
    'Goblins graben. Nicht zufällig, nicht wild – sie folgen einem Plan. Wo Grix ist, wird gegraben.',
    'Ich habe gelernt, auf Zeichen zu achten. Kleine Dinge. Knochen, Fußspuren, ein verlorener Zahn. Hilf mir, sie zu sammeln.',
  ],
  'Eremit Olm': [
    'Siebzig Winter im Moor, und es hat mich nicht geholt. Ich muss ihm langweilig vorkommen.',
    'Veshra war früher eine Heilerin, bevor sie ihren Kummer in den Sumpf goss. Jetzt singt der Sumpf für sie, und wer ihm lauscht, bleibt.',
    'Ich kann dir nicht helfen, ohne dass du mir hilfst. Kräuter, Geduld, ein bisschen Mut. Mehr verlange ich nicht.',
    'Wenn du Gurrak begegnest, dem Verschlinger: lauf. Oder bring Freunde. Und Tränke. Viele Tränke.',
  ],
  'Torwache Haldor': [
    'Seit vierzig Jahren stehe ich an diesem Tor. Die Felsenwacht hat nie gefallen – aber sie hat auch nie gewonnen.',
    'Was aus den Bergen kommt, wird größer. Was aus dem Süden kommt, wird zahlreicher. Beides macht mir Sorgen.',
    'Ich habe Namen für Dinge, die andere nicht sehen wollen: den Eremiten im Moor, den sterbenden Ritter in der Asche, das Nest im Süden. Du kannst mit ihnen sprechen, wenn du mutig bist.',
  ],
  'Schatzsucher Pell': [
    'Psst. Nicht so laut. Die Mine hat Ohren, und manche davon haben acht Beine.',
    'Ich habe alles gekartet. Jede Truhe, jeden Gang. Aber ich habe vergessen, dass man am Ende wieder hinaus muss.',
    'Wenn du Truhen öffnest, denk an mich. Und wenn du auf einen schwarzen Beutel stößt – der gehört mir.',
  ],
  'Ritter Aldric': [
    'Sie nennen mich den Sterbenden, aber das ist ein Titel, der mir mit jedem Tag ungenauer erscheint.',
    'Wir waren dreißig, als wir zum Thron zogen. Wir schworen, die Asche aufzuhalten. Ich bin der Letzte, der noch nicht vergessen hat, warum.',
    'Der Aschenkönig fiel, doch hinter ihm liegt eine Pforte im Aschengrund. Morvath wacht dort. Was er behütet, will ich nicht aussprechen.',
  ],
};

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((x) => x.id === id);
}
