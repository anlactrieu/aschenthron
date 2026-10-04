export type AttrKey = 'kraft' | 'gewandtheit' | 'ausdauer' | 'verstand' | 'willenskraft';
export const ATTR_KEYS: AttrKey[] = ['kraft', 'gewandtheit', 'ausdauer', 'verstand', 'willenskraft'];
export const ATTR_NAME: Record<AttrKey, string> = {
  kraft: 'Kraft', gewandtheit: 'Gewandtheit', ausdauer: 'Ausdauer', verstand: 'Verstand', willenskraft: 'Willenskraft',
};

/** Version der Weltkarte: Spielstände mit anderer Version starten in der Stadt (Koordinaten passen nicht mehr). */
export const MAP_VERSION = 3;

export const MAX_LEVEL = 30;
export const STAT_POINTS_PER_LEVEL = 5;
/** Skillpunkte: wenige, damit Entscheidungen zählen (Rang 1–5 je Skill, jeder Rang kostet 1 Punkt) */
export const SKILL_POINTS_START = 2;
export const SKILL_POINTS_PER_LEVEL = 1;
export const MAX_SKILL_RANK = 5;
/** Rang-Wirkung: Schaden/Heilung +18 % je Rang, Mana +6 %, Abklingzeit −6 % */
export const rankDamage = (rank: number): number => 1 + 0.18 * (rank - 1);
export const rankMana = (rank: number): number => 1 + 0.06 * (rank - 1);
export const rankCooldown = (rank: number): number => Math.max(0.6, 1 - 0.06 * (rank - 1));
/** Stufe, ab der Rang `rank` möglich ist */
export const rankLevelReq = (levelReq: number, rank: number): number => levelReq + (rank - 1) * 3;
/** Goldkosten: Rang 1 = Lernpreis, danach halber Preis mal Rang */
export const rankPrice = (price: number, rank: number): number => (rank <= 1 ? price : Math.round(price * 0.5 * rank));
/** Umverteilen: teuer, aber möglich */
export const respecPrice = (level: number): number => 100 + level * level * 8;
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

export type Ability = 'slam' | 'summon' | 'charge';

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
  o: { speed?: number; cd?: number; aggro?: number; hp?: number; dmg?: number; boss?: boolean; drop?: number; abil?: Ability[]; summon?: string } = {},
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
    aggroRange: o.aggro ?? Math.min(7, 4 + Math.floor(level / 10)),
    xp: Math.round(SCALE.xp(level) * (o.boss ? SCALE.bossXp : 1)),
    gold: [Math.round(level * 1.5 + 1), Math.round(level * 3 + 3)],
    dropChance: o.boss ? 1 : (o.drop ?? 0.5),
    boss: o.boss,
    abilities: o.abil,
    summonKind: o.summon,
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
  mk('goblin_shaman', 'Goblinschamane', 10, 'humanoid', 0x8ac06a, { hp: 0.85, dmg: 1.25 }),
  mk('goblin_chief', 'Goblinhäuptling', 13, 'humanoid', 0x4a7a2a, { hp: 1.8, dmg: 1.2, cd: 22 }),
  // Banditen
  mk('bandit_novice', 'Räuberlehrling', 3, 'humanoid', 0xb06a4a),
  mk('highwayman', 'Wegelagerer', 7, 'humanoid', 0xa05a3a, { dmg: 1.1 }),
  mk('bandit', 'Räuber', 10, 'humanoid', 0x905030, { hp: 1.15, dmg: 1.15 }),
  mk('bandit_captain', 'Räuberhauptmann', 13, 'humanoid', 0x7a3a2a, { hp: 1.7, dmg: 1.25 }),
  // Spinnen
  mk('forest_spider', 'Waldspinne', 4, 'spider', 0x3a3a48, { speed: 0.115, hp: 0.9 }),
  mk('venom_spider', 'Giftspinne', 9, 'spider', 0x3a5a3a, { speed: 0.115, hp: 0.95, dmg: 1.15 }),
  mk('giant_spider', 'Riesenspinne', 14, 'spider', 0x4a3a58, { speed: 0.11, hp: 1.4, dmg: 1.15 }),
  mk('cave_spider', 'Höhlenspinne', 20, 'spider', 0x5a4a38, { speed: 0.115, hp: 1.3, dmg: 1.2 }),
  // Sumpf
  mk('bog_ghoul', 'Sumpfghul', 6, 'ghoul', 0x5a8a5a, { speed: 0.085, hp: 1.15 }),
  mk('marsh_corpse', 'Moorleiche', 9, 'ghoul', 0x6a7a52, { speed: 0.08, hp: 1.35 }),
  mk('bog_witch', 'Sumpfhexe', 11, 'humanoid', 0x7a4a8a, { hp: 0.85, dmg: 1.3 }),
  mk('ghoul_alpha', 'Ghulalpha', 15, 'ghoul', 0x4a6a3a, { speed: 0.09, hp: 1.6, dmg: 1.2 }),
  // Untote
  mk('skeleton', 'Skelett', 8, 'undead', 0xdcd4bc, { hp: 0.9, dmg: 1.05 }),
  mk('wraith', 'Friedhofsgeist', 9, 'undead', 0x8a9ad8, { speed: 0.095, hp: 0.9, dmg: 1.15 }),
  mk('zombie', 'Zombie', 10, 'undead', 0x7a8a62, { speed: 0.075, hp: 1.5 }),
  mk('bone_knight', 'Knochenritter', 13, 'undead', 0xd8d0b8, { speed: 0.085, hp: 1.3 }),
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
  mk('cinder_wisp', 'Lavageist', 25, 'elemental', 0xe0702a, { speed: 0.105, hp: 0.9, dmg: 1.35 }),
  mk('ember_elemental', 'Glutelementar', 27, 'elemental', 0xff5a1a, { speed: 0.1, hp: 1.5, dmg: 1.3 }),
  mk('imp', 'Imp', 24, 'demon', 0xd05a3a, { speed: 0.125, hp: 0.8, dmg: 1.3, cd: 16 }),
  mk('hell_spawn', 'Höllenbrut', 29, 'demon', 0xc0402a, { speed: 0.1, hp: 1.3, dmg: 1.25 }),
  // Bosse
  mk('goblin_king', 'Goblinkönig Grix', 10, 'humanoid', 0x3a6a1a, { boss: true, speed: 0.1, abil: ['slam', 'summon'], summon: 'goblin_scout' }),
  mk('bandit_lord', 'Räuberfürst Harkon', 12, 'humanoid', 0xc07a3a, { boss: true, speed: 0.1, abil: ['slam'] }),
  mk('bone_lord', 'Knochenfürst Morrik', 14, 'undead', 0xe8e0c0, { boss: true, speed: 0.09, abil: ['slam', 'summon'], summon: 'skeleton' }),
  mk('bog_queen', 'Moorhexe Veshra', 16, 'humanoid', 0x9a4a9a, { boss: true, speed: 0.095, abil: ['slam', 'summon'], summon: 'bog_ghoul' }),
  mk('stone_colossus', 'Steinkoloss', 20, 'golem', 0xa09a8a, { boss: true, speed: 0.07, abil: ['slam', 'charge'] }),
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
}
export const UNIQUES: UniqueDef[] = [
  { id: 'rat_king', name: 'Rattenkönig Knabber', base: 'giant_rat', hp: 6, dmg: 1.5, abilities: ['summon'], summon: 'field_rat', respawnMin: 15 },
  { id: 'spotted_beast', name: 'Fleckenbiest', base: 'feral_hound', hp: 6, dmg: 1.5, abilities: ['charge'], respawnMin: 15 },
  { id: 'goblin_shaman_brakk', name: 'Schamane Brakk', base: 'goblin_shaman', hp: 5, dmg: 1.4, abilities: ['summon', 'slam'], summon: 'goblin', respawnMin: 18 },
  { id: 'venom_mother', name: 'Giftmutter Zischel', base: 'venom_spider', hp: 5, dmg: 1.4, abilities: ['summon', 'charge'], summon: 'forest_spider', respawnMin: 18 },
  { id: 'captain_kolm', name: 'Hauptmann Kolm', base: 'bandit_captain', hp: 4, dmg: 1.4, abilities: ['slam', 'charge'], respawnMin: 20 },
  { id: 'bog_brute', name: 'Moorbestie Gluck', base: 'ghoul_alpha', hp: 5, dmg: 1.4, abilities: ['slam'], respawnMin: 20 },
  { id: 'hexmaster_irva', name: 'Hexenmeisterin Irva', base: 'bog_witch', hp: 6, dmg: 1.5, abilities: ['summon', 'slam'], summon: 'bog_ghoul', respawnMin: 20 },
  { id: 'crypt_ormund', name: 'Gruftwächter Ormund', base: 'crypt_guard', hp: 4.5, dmg: 1.4, abilities: ['slam', 'charge'], respawnMin: 22 },
  { id: 'ghost_lord_sael', name: 'Geistfürst Sael', base: 'wraith', hp: 7, dmg: 1.6, abilities: ['summon', 'slam'], summon: 'skeleton', respawnMin: 22 },
  { id: 'troll_chief_drogg', name: 'Trollhäuptling Drogg', base: 'rock_troll', hp: 4.5, dmg: 1.4, abilities: ['slam', 'charge'], respawnMin: 22 },
  { id: 'alpha_fenrik', name: 'Alphawolf Fenrik', base: 'dire_wolf', hp: 6, dmg: 1.5, abilities: ['charge', 'summon'], summon: 'wolf', respawnMin: 22 },
  { id: 'cinder_lord_zarkesh', name: 'Glutfürst Zarkesh', base: 'ember_elemental', hp: 4.5, dmg: 1.4, abilities: ['slam', 'summon'], summon: 'cinder_wisp', respawnMin: 25 },
  { id: 'dread_valdor', name: 'Schreckensritter Valdor', base: 'death_knight', hp: 4, dmg: 1.4, abilities: ['charge', 'slam'], respawnMin: 25 },
];
export function uniqueDef(id: string): UniqueDef | undefined {
  return UNIQUES.find((u) => u.id === id);
}
export const UNIQUE_REWARD = 6;

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
  /** Flächenschaden: Radius (um den Zaubernden bei aoeSelf, sonst um das Ziel) */
  aoe?: number;
  aoeSelf?: boolean;
  /** Mehrfachziel: so viele nächste Gegner in Reichweite */
  targets?: number;
  /** Selbstheilung: Basiswert, skaliert mit Verstand */
  heal?: number;
  /** Gift: Zusatzschaden über `seconds` Sekunden (Faktor auf den Direktschaden) */
  dot?: { seconds: number; factor: number };
  /** Lehrer-Stufe: 1 = Aschenhafen, 2 = Felsenwacht */
  tier: number;
  desc: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'power_strike', name: 'Wuchtschlag', area: 'Nahkampf', levelReq: 2, price: 50, mana: 8, cooldown: 60, range: 1.5, mult: 2, ignoresArmor: false, tier: 1, desc: 'Doppelter Waffenschaden im Nahkampf.' },
  { id: 'quick_shot', name: 'Schnellschuss', area: 'Fernkampf', levelReq: 2, price: 60, mana: 4, cooldown: 20, range: 6, base: [6, 12], scales: 'gewandtheit', ignoresArmor: false, tier: 1, desc: 'Schneller Schuss auf Distanz (Bogen und Köcher nötig), skaliert mit Gewandtheit.' },
  { id: 'ember_bolt', name: 'Glutblitz', area: 'Magie', levelReq: 3, price: 80, mana: 10, cooldown: 30, range: 7, base: [10, 18], scales: 'verstand', ignoresArmor: true, tier: 1, desc: 'Magischer Schaden, ignoriert Rüstung, skaliert mit Verstand.' },
  { id: 'healing_hand', name: 'Heilende Hand', area: 'Magie', levelReq: 4, price: 120, mana: 14, cooldown: 200, range: 0, heal: 40, scales: 'verstand', ignoresArmor: true, tier: 1, desc: 'Heilt dich selbst, stärker mit Verstand und Level.' },
  { id: 'poison_shot', name: 'Giftpfeil', area: 'Fernkampf', levelReq: 6, price: 220, mana: 9, cooldown: 60, range: 6, base: [5, 9], scales: 'gewandtheit', ignoresArmor: false, dot: { seconds: 8, factor: 1.6 }, tier: 2, desc: 'Schuss (Bogen und Köcher nötig), der das Ziel zusätzlich 8 Sekunden vergiftet.' },
  { id: 'whirlwind', name: 'Wirbelhieb', area: 'Nahkampf', levelReq: 10, price: 500, mana: 16, cooldown: 100, range: 1.6, mult: 1.2, aoe: 2.2, aoeSelf: true, ignoresArmor: false, tier: 2, desc: 'Trifft alle Gegner um dich herum.' },
  { id: 'frost_nova', name: 'Frostnova', area: 'Magie', levelReq: 11, price: 650, mana: 18, cooldown: 140, range: 1.6, base: [14, 22], scales: 'verstand', aoe: 3, aoeSelf: true, ignoresArmor: true, tier: 2, desc: 'Magische Druckwelle um dich herum.' },
  { id: 'multishot', name: 'Salve', area: 'Fernkampf', levelReq: 13, price: 800, mana: 14, cooldown: 70, range: 6, base: [9, 15], scales: 'gewandtheit', targets: 3, ignoresArmor: false, tier: 2, desc: 'Schießt (Bogen und Köcher nötig) auf bis zu drei Gegner gleichzeitig; verbraucht einen Pfeil.' },
  { id: 'fireball', name: 'Feuerball', area: 'Magie', levelReq: 16, price: 1200, mana: 24, cooldown: 90, range: 7, base: [28, 42], scales: 'verstand', aoe: 2, ignoresArmor: true, tier: 2, desc: 'Explodiert am Ziel und trifft Gegner in der Nähe.' },
  { id: 'skull_split', name: 'Schädelspalter', area: 'Nahkampf', levelReq: 18, price: 1500, mana: 22, cooldown: 160, range: 1.5, mult: 3.2, ignoresArmor: false, tier: 2, desc: 'Gewaltiger Hieb mit mehr als dreifachem Waffenschaden.' },
  { id: 'lightning', name: 'Blitzschlag', area: 'Magie', levelReq: 22, price: 2400, mana: 30, cooldown: 120, range: 8, base: [60, 90], scales: 'verstand', ignoresArmor: true, tier: 2, desc: 'Zerschmetternder Blitz auf ein Ziel.' },
];

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export const SAFE_REGEN = 0.5;
export const FIELD_REGEN = 0.02;

export const SHOPS: Record<string, string[]> = {
  basic: ['rusty_sword', 'bone_club', 'steel_sword', 'leather_cap', 'iron_helm', 'ash_mail', 'worn_gloves', 'cloth_boots', 'iron_greaves', 'iron_ring', 'heal_small', 'heal_mid', 'mana_small', 'mana_mid', 'hunt_bow', 'twig_staff', 'cloth_robe', 'leather_vest', 'leather_quiver', 'wood_arrows', 'iron_arrows'],
  advanced: ['steel_sword', 'cinder_axe', 'war_blade', 'iron_helm', 'warden_helm', 'plate_cuirass', 'bone_plate', 'iron_gauntlets', 'ember_gauntlets', 'iron_greaves', 'steel_boots', 'silver_ring', 'heal_mid', 'heal_big', 'mana_mid', 'mana_big', 'yew_bow', 'horn_bow', 'oak_staff', 'bone_staff', 'acolyte_robe', 'hunter_vest', 'bone_leather', 'hunter_quiver', 'ranger_quiver', 'iron_arrows', 'steel_arrows', 'ember_arrows'],
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
  q('q_goblins', 'Goblinplage', 'Goblins plündern die Höfe am Waldrand. Vertreibe 10 Goblins.', 3, 'goblin', 10, 1.5, 1.5),
  q('q_goblin_scouts', 'Späher im Unterholz', 'Goblinkundschafter spähen unsere Wege aus. Töte 8.', 5, 'goblin_scout', 8, 1.5, 1.5),
  q('q_goblin_king', 'Der Goblinkönig', 'Grix sammelt ein Heer im Düsterwald. Erschlage ihn.', 10, 'goblin_king', 1, 1.5, 2),
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
