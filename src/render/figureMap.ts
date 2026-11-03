/**
 * Zuordnung Spiel-IDs → Figuren aus „Ninja Adventure“ (Pixel-Boy und AAA, CC0, siehe ASSETS.md) und der Schalter „Figuren“.
 * Reine Daten und Funktionen ohne Canvas/Image: import-sicher in Node (Tests). Gezeichnet wird in `ninjaFigures.ts`.
 *
 * Schalter (URL `?figuren=` hat Vorrang und wird gemerkt, sonst localStorage `aschenthron.figuren2`):
 *  - `skelett` (Standard seit 2026-11-04): eigene Skelett-Figuren für Monster und NPCs (`monster.ts`, `npc.ts`); die alten
 *    Figuren (DCSS) nur, solange ein Sheet noch gebacken wird
 *  - `dcss`: DCSS-NPCs, DCSS-Monster, ein Pixelmaßstab (Rückfall)
 *  - `mix`: Held und NPCs Ninja; von den Monsterarten per stabilem Hash der Art-ID abwechselnd die Hälfte Ninja, die andere DCSS
 *  - `ninja`: alle Monster Ninja
 * Der Held hat einen eigenen Schalter (`?held=skelett|dcss`, `heroSheet.ts`).
 * Pfade relativ zu `public/assets/ninja/` (siehe `NINJA_BASE` in ninja.ts).
 */

export type FigMode = 'skelett' | 'mix' | 'ninja' | 'dcss';
export const FIG_MODES: FigMode[] = ['skelett', 'dcss', 'mix', 'ninja'];
export const FIG_LABEL: Record<FigMode, string> = { skelett: 'Skelett', mix: 'Mix', ninja: 'Ninja', dcss: 'DCSS' };
// neuer Schlüssel: ein früher gemerktes `dcss` (alter Standard) soll die neuen Figuren nicht verdecken
const FIG_KEY = 'aschenthron.figuren2';

let mode: FigMode | undefined;

const isMode = (v: unknown): v is FigMode => v === 'skelett' || v === 'mix' || v === 'ninja' || v === 'dcss';
/** Modi mit Ninja-Figuren (Held/NPCs/Monster aus Ninja Adventure) */
export const usesNinja = (m: FigMode): boolean => m === 'mix' || m === 'ninja';

/** Aktueller Modus: URL > localStorage > skelett. Außerhalb des Browsers immer `skelett`. */
export function figureMode(): FigMode {
  if (mode) return mode;
  let m: unknown;
  try {
    if (typeof location !== 'undefined') {
      m = new URLSearchParams(location.search).get('figuren');
      if (isMode(m)) window.localStorage.setItem(FIG_KEY, m);
    }
  } catch {
    /* kein Zugriff: weiter */
  }
  if (!isMode(m)) {
    try {
      m = typeof localStorage !== 'undefined' ? localStorage.getItem(FIG_KEY) : null;
    } catch {
      m = null;
    }
  }
  mode = isMode(m) ? m : 'skelett';
  return mode;
}

/** Speichert die Wahl (wirkt nach dem Neuladen). */
export function setFigureMode(m: FigMode): void {
  try {
    window.localStorage.setItem(FIG_KEY, m);
  } catch {
    /* nicht gespeichert */
  }
}

/** Zuletzt gespeicherte Wahl (gilt nach dem Neuladen); ohne Eintrag der aktive Modus. */
export function savedFigureMode(): FigMode {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(FIG_KEY) : null;
    if (isMode(v)) return v;
  } catch {
    /* kein Zugriff */
  }
  return figureMode();
}

/** Nur für Tests. */
export function forceFigureMode(m: FigMode | undefined): void {
  mode = m;
}

/* ------------------------------------------------ Monster */

export type NinjaGroup = 'Character' | 'Monster' | 'Animal' | 'Boss';

export interface NinjaMon {
  group: NinjaGroup;
  /** Ordnername im Paket */
  name: string;
  /** ganzzahlige Vergrößerung (Ninja 16 px → 48 px bei 3) */
  scale: number;
  /** Multiplikative Färbung (0xRRGGBB) */
  tint?: number;
}

/**
 * Skalierung: Character-Figuren (Menschen, Held, NPCs) 4x ≈ Höhe der DCSS-Menschen (je ~50–64 Bildpunkte sichtbar; bei 3x nur ~42–48);
 * Monster-Sheets und Tiere 3x, größere Arten 4x, Bosse 2x (Streifen 50–62 px) bzw. 5x (Spinnenbosse).
 */
const M = (group: NinjaGroup, name: string, scale = 3, tint?: number): NinjaMon => ({ group, name, scale, tint });

/** Monster-ID → Ninja-Figur. Jede der 64 Arten hat eine Zuordnung; ob sie gilt, entscheidet der Modus. */
export const NINJA_MONSTERS: Record<string, NinjaMon> = {
  // Ratten, Hunde, Wölfe (Tiere: 2 Seitenbilder, Blick nach rechts)
  field_rat: M('Monster', 'Mouse'),
  burrow_rat: M('Monster', 'MouseBlack'),
  giant_rat: M('Animal', 'Hamster', 4),
  wild_hound: M('Animal', 'DogYellow'),
  feral_hound: M('Animal', 'DogOrange'),
  wolf: M('Animal', 'DogBlack', 3, 0xb4b4be),
  dire_wolf: M('Animal', 'DogBlack', 4, 0x8a8a9a),
  shadow_wolf: M('Animal', 'DogBlack', 3, 0x6a6ab8),
  night_stalker: M('Animal', 'Hyena', 4, 0x6a6aa8),
  // Goblins
  goblin: M('Character', 'ManGreen', 4),
  goblin_scout: M('Character', 'NinjaGreen', 4),
  goblin_warrior: M('Character', 'GreenPig', 4),
  goblin_shaman: M('Character', 'MaskFrog', 4),
  goblin_archer: M('Character', 'NinjaLeaf', 4),
  goblin_chief: M('Character', 'DemonGreen', 4),
  goblin_brute: M('Monster', 'Reptile2'),
  goblin_warlord: M('Monster', 'Cyclope2', 4),
  // Banditen
  bandit_novice: M('Character', 'Villager3', 4),
  highwayman: M('Character', 'NinjaMasked', 4),
  bandit_archer: M('Character', 'CamouflageRed', 4),
  bandit: M('Character', 'NinjaRed', 4),
  bandit_captain: M('Character', 'RedGladiator', 4),
  // Spinnen (nur Rot/Gelb vorhanden: Tönung je Art)
  forest_spider: M('Monster', 'SpiderRed', 3, 0x707090),
  venom_spider: M('Monster', 'SpiderYellow', 3, 0x90e070),
  giant_spider: M('Monster', 'SpiderRed', 4, 0x9070b0),
  cave_spider: M('Monster', 'SpiderYellow', 3, 0xa08868),
  brood_spider: M('Monster', 'SpiderRed', 3, 0xb080a0),
  web_stalker: M('Monster', 'SpiderYellow', 4, 0xb0a0d8),
  nest_matron: M('Monster', 'SpiderRed', 4, 0xd070b8),
  // Sumpf (Menschen grün getönt)
  bog_ghoul: M('Character', 'Caveman2', 4, 0x9ac88a),
  marsh_corpse: M('Character', 'OldMan3', 4, 0x90a878),
  bog_witch: M('Character', 'OldWoman', 4, 0xb080c0),
  ghoul_alpha: M('Character', 'Caveman', 4, 0x90b878),
  // Untote
  skeleton: M('Character', 'Skeleton', 4),
  wraith: M('Character', 'Spirit', 4),
  bone_acolyte: M('Character', 'SkeletonDemon', 4),
  zombie: M('Character', 'Villager4', 4, 0x8aa070),
  bone_knight: M('Character', 'Knight', 4, 0xe0d8b8),
  necromancer: M('Character', 'SorcererBlack', 4),
  crypt_guard: M('Character', 'Statue', 4),
  death_knight: M('Character', 'NinjaDark', 4),
  // Trolle und Golems
  hill_troll: M('Monster', 'Beast2'),
  stone_golem: M('Character', 'GoldStatue', 4, 0xa0a0a8),
  rock_troll: M('Monster', 'Beast', 4),
  iron_golem: M('Character', 'RobotGrey', 4),
  // Würmer
  pit_worm: M('Monster', 'Larva2'),
  acid_worm: M('Monster', 'Larva', 3, 0xc0e070),
  // Asche und Feuer
  ash_walker: M('Character', 'Villager5', 4, 0xa89890),
  cinder_wisp: M('Monster', 'Flam'),
  ember_elemental: M('Monster', 'Flam', 4, 0xffa060),
  imp: M('Character', 'DemonRed', 4),
  hell_spawn: M('Monster', 'DragonYellow', 3, 0xe07050),
  hell_hound: M('Animal', 'DogOrange', 4, 0xd05040),
  doom_knight: M('Character', 'GladiatorBlue', 4, 0x7070a0),
  pit_fiend: M('Monster', 'Dragon', 4, 0xd05040),
  // Bosse (Boss-Ordner: erstes Bild des Idle-Streifens; Spinnenbosse große Spinnen)
  goblin_king: M('Boss', 'GiantBamboo', 2),
  bandit_lord: M('Boss', 'GiantRacoon', 2),
  bone_lord: M('Boss', 'GiantSpirit', 2, 0xe0e0d0),
  bog_queen: M('Boss', 'DemonCyclop2', 2, 0xd090e0),
  stone_colossus: M('Boss', 'DemonCyclop', 2, 0xa8a8a8),
  spider_queen: M('Monster', 'SpiderRed', 5, 0xd060b0),
  web_mother: M('Monster', 'SpiderYellow', 5, 0xc890e0),
  ash_king: M('Boss', 'GiantFlam', 2),
};

/** Bild-Datei einer Figur (Boss-Streifen oder Sheet). */
export function ninjaSheetPath(d: { group: NinjaGroup; name: string }): string {
  return `Actor/${d.group}/${d.name}/${d.group === 'Boss' ? 'Idle.png' : 'SpriteSheet.png'}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mix: Arten (Bosse getrennt von Normalen) nach Hash sortiert, jede zweite Ninja – stabil und genau zur Hälfte. */
const mixSet = ((): Set<string> => {
  const out = new Set<string>();
  for (const bossGroup of [false, true]) {
    const ids = Object.keys(NINJA_MONSTERS).filter((id) => (NINJA_MONSTERS[id]!.group === 'Boss' || ['spider_queen', 'web_mother'].includes(id)) === bossGroup);
    ids.sort((a, b) => hash(a) - hash(b) || (a < b ? -1 : 1));
    ids.forEach((id, i) => {
      if (i % 2 === 0) out.add(id);
    });
  }
  return out;
})();

/** Ninja-Figur der Monsterart im gewählten Modus (`undefined` = DCSS-Sprite). */
export function ninjaMonsterDef(id: string, m: FigMode = figureMode()): NinjaMon | undefined {
  if (!usesNinja(m)) return undefined;
  const d = NINJA_MONSTERS[id];
  if (!d) return undefined;
  return m === 'ninja' || mixSet.has(id) ? d : undefined;
}

/** Für die Konsolenausgabe: welche Arten sind in diesem Modus Ninja, welche DCSS. */
export function figureLists(m: FigMode, allIds: string[]): { ninja: string[]; dcss: string[] } {
  const ninja = allIds.filter((id) => ninjaMonsterDef(id, m));
  return { ninja, dcss: allIds.filter((id) => !ninjaMonsterDef(id, m)) };
}

/* ------------------------------------------------ NPCs */

export interface NinjaNpc {
  /** Ordnername unter Actor/Character */
  sheet: string;
  /** Gesicht (Faceset.png im selben Ordner) – für Dialog-/Händlerfenster später */
  face: string;
  tint?: number;
}

const N = (sheet: string, tint?: number): NinjaNpc => ({ sheet, face: sheet, tint });

export const NINJA_NPC_NAMES: Record<string, NinjaNpc> = {
  'Lehrer Varn': N('OldMan2'),
  'Magierin Selka': N('SorcererOrange'),
  'Erzmagier Orvan': N('Master'),
  'Hafenmeister Joren': N('Inspector'),
  'Lagerverwalter Ottmar': N('Villager2'),
  'Lagerverwalter Torvin': N('Villager4'),
  'Händler Wenzel': N('Sultan'),
  'Meisterin Kjorra': N('Monk2'),
  'Händlerin Mirel': N('Woman'),
  'Händler Dorn': N('Sultan2'),
  'Schmiedin Ilse': N('Cavegirl2'),
  'Schmied Torgal': N('Caveman2'),
  'Hauptmann Brandt': N('Samurai'),
  'Kräuterfrau Odda': N('OldWoman'),
  'Wachführerin Tessa': N('FighterRed'),
  'Späher Ruven': N('NinjaBlue'),
  'Chronistin Maren': N('Villager5'),
  'Torwache Haldor': N('Knight'),
  'Jägerin Ysa': N('CamouflageGreen'),
  'Eremit Olm': N('OldMan'),
  'Schatzsucher Pell': N('MaskGoldRacoon'),
  'Ritter Aldric': N('KnightGold'),
};

/** Nach Art (kind), wenn der Name nicht in der Tabelle steht. */
export const NINJA_NPC_KINDS: Record<string, NinjaNpc> = {
  trainer: N('Master'),
  merchant: N('Sultan'),
  smith: N('Caveman2'),
  quest: N('Villager'),
};

/** Zufallsfiguren für unbekannte Namen (stabiler Hash des Namens). */
export const NINJA_NPC_POOL = ['Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'Villager6', 'Woman', 'OldMan', 'OldMan2', 'Child', 'Monk', 'Noble'];

/** Figur eines NPCs (`undefined` im Modus `dcss` und für Truhen ohne Namen in der Tabelle: Lagerverwalter sind Figuren, Truhen bleiben Truhen). */
export function ninjaNpcDef(kind: string, name?: string, m: FigMode = figureMode()): NinjaNpc | undefined {
  if (!usesNinja(m)) return undefined;
  if (name && NINJA_NPC_NAMES[name]) return NINJA_NPC_NAMES[name];
  if (kind === 'stash') return undefined;
  if (kind === 'quest' || !NINJA_NPC_KINDS[kind]) return N(NINJA_NPC_POOL[hash(name ?? kind) % NINJA_NPC_POOL.length]!);
  return NINJA_NPC_KINDS[kind]!;
}

/* ------------------------------------------------ Held */

export const HERO_BASE = 'Boy';
export const heroSheetPath = `Actor/Character/${HERO_BASE}/SpriteSheet.png`;
/** Waffen in der Hand (Bild „SpriteInHand“; Bögen sind prozedural) */
export const WEAPON_FILES = ['Sword', 'Sword2', 'BigSword', 'Katana', 'Rapier', 'Sai', 'Ninjaku', 'Bone', 'Club', 'Hammer', 'Axe', 'AxeTool', 'Pickaxe', 'Lance', 'MagicWand', 'Stick'];
export const weaponPath = (n: string): string => `Items/Weapons/${n}/SpriteInHand.png`;

/** Alle Bilddateien der Figuren zum Vorladen (relativ zu NINJA_BASE). */
export function ninjaFigurePaths(): string[] {
  const s = new Set<string>([heroSheetPath]);
  for (const d of Object.values(NINJA_MONSTERS)) s.add(ninjaSheetPath(d));
  for (const d of [...Object.values(NINJA_NPC_NAMES), ...Object.values(NINJA_NPC_KINDS)]) s.add(`Actor/Character/${d.sheet}/SpriteSheet.png`);
  for (const n of NINJA_NPC_POOL) s.add(`Actor/Character/${n}/SpriteSheet.png`);
  for (const w of WEAPON_FILES) s.add(weaponPath(w));
  return [...s];
}
