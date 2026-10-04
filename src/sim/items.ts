import type { Rng } from './rng';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'ring';
/** Verbrauchsgegenstände belegen keinen Ausrüstungsslot */
export type ItemSlot = Slot | 'potion';
export type Rarity = 'normal' | 'magic' | 'rare' | 'set' | 'legendary';
export type Stat = 'damage' | 'armor' | 'maxHp' | 'kraft' | 'maxMana';
/** Besondere Effekte legendärer Gegenstände und Set-Boni */
export type PowerId = 'lifesteal' | 'crit' | 'thorns' | 'manaKill' | 'xpBonus' | 'goldBonus';
export interface Power {
  id: PowerId;
  value: number;
}
export const POWER_TEXT: Record<PowerId, (v: number) => string> = {
  lifesteal: (v) => `${v} % des Schadens als Leben`,
  crit: (v) => `${v} % Chance auf doppelten Schaden`,
  thorns: (v) => `${v} % des erlittenen Schadens zurückgeworfen`,
  manaKill: (v) => `+${v} Mana pro Kill`,
  xpBonus: (v) => `+${v} % Erfahrung`,
  goldBonus: (v) => `+${v} % Gold`,
};

export interface ItemTemplate {
  id: string;
  name: string;
  slot: ItemSlot;
  weight: number;
  heal?: number;
  mana?: number;
  /** Basiswerte (Waffe: Schaden min/max, Rüstung: Rüstung) */
  damage?: [number, number];
  armor?: number;
  reqKraft: number;
  value: number;
  minLevel: number;
}

export interface Affix {
  stat: Stat;
  value: number;
}

export interface Item {
  id: number;
  templateId: string;
  name: string;
  slot: ItemSlot;
  rarity: Rarity;
  weight: number;
  heal?: number;
  mana?: number;
  damage?: [number, number];
  armor?: number;
  reqKraft: number;
  value: number;
  affixes: Affix[];
  power?: Power;
  setId?: string;
  /** Legendär: Vorlagen-ID des Unikats */
  unique?: string;
}

export const TEMPLATES: ItemTemplate[] = [
  { id: 'rusty_sword', name: 'Rostiges Schwert', slot: 'weapon', weight: 6, damage: [3, 6], reqKraft: 8, value: 10, minLevel: 1 },
  { id: 'bone_club', name: 'Knochenkeule', slot: 'weapon', weight: 9, damage: [5, 9], reqKraft: 12, value: 25, minLevel: 2 },
  { id: 'steel_sword', name: 'Stahlschwert', slot: 'weapon', weight: 8, damage: [8, 14], reqKraft: 15, value: 70, minLevel: 6 },
  { id: 'cinder_axe', name: 'Glutaxt', slot: 'weapon', weight: 12, damage: [12, 22], reqKraft: 20, value: 160, minLevel: 11 },
  { id: 'leather_cap', name: 'Lederkappe', slot: 'head', weight: 2, armor: 1, reqKraft: 5, value: 8, minLevel: 1 },
  { id: 'iron_helm', name: 'Eisenhelm', slot: 'head', weight: 5, armor: 3, reqKraft: 14, value: 55, minLevel: 6 },
  { id: 'ash_mail', name: 'Aschenhemd', slot: 'chest', weight: 12, armor: 4, reqKraft: 12, value: 35, minLevel: 2 },
  { id: 'plate_cuirass', name: 'Plattenpanzer', slot: 'chest', weight: 18, armor: 9, reqKraft: 18, value: 150, minLevel: 9 },
  { id: 'worn_gloves', name: 'Abgenutzte Handschuhe', slot: 'hands', weight: 1, armor: 1, reqKraft: 5, value: 6, minLevel: 1 },
  { id: 'cloth_boots', name: 'Stoffstiefel', slot: 'feet', weight: 2, armor: 1, reqKraft: 5, value: 6, minLevel: 1 },
  { id: 'iron_greaves', name: 'Eisenschienen', slot: 'feet', weight: 6, armor: 3, reqKraft: 14, value: 50, minLevel: 6 },
  { id: 'iron_gauntlets', name: 'Eisenhandschuhe', slot: 'hands', weight: 3, armor: 2, reqKraft: 14, value: 45, minLevel: 6 },
  { id: 'ember_gauntlets', name: 'Glutstulpen', slot: 'hands', weight: 4, armor: 5, reqKraft: 18, value: 120, minLevel: 11 },
  { id: 'warden_helm', name: 'Wächterhelm', slot: 'head', weight: 7, armor: 6, reqKraft: 18, value: 120, minLevel: 11 },
  { id: 'steel_boots', name: 'Stahlstiefel', slot: 'feet', weight: 8, armor: 5, reqKraft: 18, value: 110, minLevel: 11 },
  { id: 'silver_ring', name: 'Silberring', slot: 'ring', weight: 0.5, reqKraft: 0, value: 60, minLevel: 6 },
  { id: 'ember_ring', name: 'Glutring', slot: 'ring', weight: 0.5, reqKraft: 0, value: 140, minLevel: 11 },
  { id: 'iron_ring', name: 'Eisenring', slot: 'ring', weight: 0.5, reqKraft: 0, value: 12, minLevel: 1 },
  { id: 'war_blade', name: 'Kriegsklinge', slot: 'weapon', weight: 10, damage: [16, 28], reqKraft: 24, value: 300, minLevel: 16 },
  { id: 'doom_hammer', name: 'Schädelbrecher', slot: 'weapon', weight: 14, damage: [22, 38], reqKraft: 30, value: 600, minLevel: 21 },
  { id: 'ash_greatsword', name: 'Aschenrichter', slot: 'weapon', weight: 16, damage: [30, 50], reqKraft: 36, value: 1100, minLevel: 26 },
  { id: 'bone_plate', name: 'Knochenpanzer', slot: 'chest', weight: 20, armor: 14, reqKraft: 24, value: 280, minLevel: 15 },
  { id: 'dread_mail', name: 'Schreckenspanzer', slot: 'chest', weight: 22, armor: 20, reqKraft: 30, value: 560, minLevel: 21 },
  { id: 'ash_cuirass', name: 'Aschenharnisch', slot: 'chest', weight: 24, armor: 28, reqKraft: 36, value: 1000, minLevel: 27 },
  { id: 'crown_helm', name: 'Kronenhelm', slot: 'head', weight: 8, armor: 9, reqKraft: 22, value: 250, minLevel: 16 },
  { id: 'dread_helm', name: 'Schreckenshelm', slot: 'head', weight: 9, armor: 12, reqKraft: 28, value: 520, minLevel: 21 },
  { id: 'ash_visor', name: 'Aschenvisier', slot: 'head', weight: 10, armor: 16, reqKraft: 34, value: 950, minLevel: 27 },
  { id: 'bone_gloves', name: 'Knochenhandschuhe', slot: 'hands', weight: 4, armor: 7, reqKraft: 22, value: 230, minLevel: 16 },
  { id: 'dread_fists', name: 'Schreckensfäuste', slot: 'hands', weight: 5, armor: 10, reqKraft: 28, value: 480, minLevel: 21 },
  { id: 'ash_gauntlets', name: 'Aschenstulpen', slot: 'hands', weight: 6, armor: 13, reqKraft: 34, value: 900, minLevel: 27 },
  { id: 'bone_boots', name: 'Knochenstiefel', slot: 'feet', weight: 9, armor: 7, reqKraft: 22, value: 230, minLevel: 16 },
  { id: 'dread_treads', name: 'Schreckensschreiter', slot: 'feet', weight: 10, armor: 10, reqKraft: 28, value: 480, minLevel: 21 },
  { id: 'ash_boots', name: 'Aschenstiefel', slot: 'feet', weight: 11, armor: 13, reqKraft: 34, value: 900, minLevel: 27 },
  { id: 'moon_ring', name: 'Mondsteinring', slot: 'ring', weight: 0.5, reqKraft: 0, value: 300, minLevel: 16 },
  { id: 'blood_ring', name: 'Blutring', slot: 'ring', weight: 0.5, reqKraft: 0, value: 600, minLevel: 21 },
  { id: 'ash_band', name: 'Aschenreif', slot: 'ring', weight: 0.5, reqKraft: 0, value: 1100, minLevel: 27 },
  { id: 'heal_huge', name: 'Riesiger Heiltrank', slot: 'potion', weight: 0.6, heal: 600, reqKraft: 0, value: 160, minLevel: 21 },
  { id: 'mana_huge', name: 'Riesiger Manatrank', slot: 'potion', weight: 0.6, mana: 300, reqKraft: 0, value: 160, minLevel: 21 },
  { id: 'heal_max', name: 'Elixier des Lebens', slot: 'potion', weight: 0.7, heal: 1100, reqKraft: 0, value: 320, minLevel: 27 },
  { id: 'mana_max', name: 'Elixier der Weisheit', slot: 'potion', weight: 0.7, mana: 550, reqKraft: 0, value: 320, minLevel: 27 },
  { id: 'heal_small', name: 'Kleiner Heiltrank', slot: 'potion', weight: 0.3, heal: 50, reqKraft: 0, value: 8, minLevel: 1 },
  { id: 'heal_mid', name: 'Heiltrank', slot: 'potion', weight: 0.4, heal: 130, reqKraft: 0, value: 25, minLevel: 6 },
  { id: 'heal_big', name: 'Großer Heiltrank', slot: 'potion', weight: 0.5, heal: 280, reqKraft: 0, value: 70, minLevel: 11 },
  { id: 'mana_small', name: 'Kleiner Manatrank', slot: 'potion', weight: 0.3, mana: 30, reqKraft: 0, value: 8, minLevel: 1 },
  { id: 'mana_mid', name: 'Manatrank', slot: 'potion', weight: 0.4, mana: 70, reqKraft: 0, value: 25, minLevel: 6 },
  { id: 'mana_big', name: 'Großer Manatrank', slot: 'potion', weight: 0.5, mana: 140, reqKraft: 0, value: 70, minLevel: 11 },
];

interface AffixDef {
  stat: Stat;
  name: string;
  min: number;
  max: number;
}

const AFFIXES: AffixDef[] = [
  { stat: 'damage', name: 'des Zorns', min: 1, max: 4 },
  { stat: 'armor', name: 'der Härte', min: 1, max: 3 },
  { stat: 'maxHp', name: 'der Zähigkeit', min: 5, max: 20 },
  { stat: 'kraft', name: 'der Stärke', min: 1, max: 3 },
  { stat: 'maxMana', name: 'der Weisheit', min: 3, max: 10 },
];

const RARITY_VALUE: Record<Rarity, number> = { normal: 1, magic: 3, rare: 8, set: 14, legendary: 25 };
const RARITY_AFFIXES: Record<Rarity, [number, number]> = { normal: [0, 0], magic: [1, 2], rare: [3, 4], set: [0, 0], legendary: [0, 0] };

export function templateById(id: string): ItemTemplate {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unbekannte Item-Vorlage: ${id}`);
  return t;
}

function rollAffix(rng: Rng, pool: AffixDef[], minLevel: number): Affix {
  const def = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
  const scale = 1 + minLevel / 8;
  return { stat: def.stat, value: Math.max(1, Math.round(rng.int(def.min, def.max) * (def.stat === 'kraft' ? 1 + minLevel / 20 : scale))) };
}

export function rollRarity(rng: Rng): Rarity {
  const r = rng.next();
  return r < 0.05 ? 'rare' : r < 0.3 ? 'magic' : 'normal';
}

export function generateItem(rng: Rng, id: number, templateId: string, rarityIn: Rarity): Item {
  const t = templateById(templateId);
  const rarity: Rarity = t.slot === 'potion' ? 'normal' : rarityIn;
  const [lo, hi] = RARITY_AFFIXES[rarity];
  const count = rng.int(lo, hi);
  const pool = [...AFFIXES];
  const affixes: Affix[] = [];
  for (let i = 0; i < count && pool.length; i++) affixes.push(rollAffix(rng, pool, t.minLevel));
  const name = affixes.length
    ? `${t.name} ${AFFIXES.find((a) => a.stat === affixes[0]!.stat)!.name}`
    : t.name;
  return {
    id,
    templateId,
    name,
    slot: t.slot,
    rarity,
    weight: t.weight,
    damage: t.damage ? [...t.damage] : undefined,
    armor: t.armor,
    heal: t.heal,
    mana: t.mana,
    reqKraft: t.reqKraft,
    value: t.value * RARITY_VALUE[rarity] + affixes.length * 8,
    affixes,
  };
}

export function rollDrop(rng: Rng, nextId: () => number, monsterLevel: number, forceRarity?: Rarity): Item {
  const pool = TEMPLATES.filter((t) => t.slot !== 'potion' && t.minLevel <= monsterLevel && t.minLevel >= monsterLevel - 8);
  const t = pool[rng.int(0, pool.length - 1)]!;
  return generateItem(rng, nextId(), t.id, forceRarity ?? rollRarity(rng));
}

/** Stärkster Trank der Art, der zur Monsterstufe passt (Fenster wie bei Ausrüstung). */
export function rollPotion(rng: Rng, nextId: () => number, monsterLevel: number): Item {
  const kind: 'heal' | 'mana' = rng.next() < 0.6 ? 'heal' : 'mana';
  const tier = TEMPLATES.filter((t) => t.slot === 'potion' && t[kind] !== undefined && t.minLevel <= monsterLevel);
  const best = tier.filter((t) => t.minLevel === Math.max(...tier.map((x) => x.minLevel)));
  return generateItem(rng, nextId(), best[rng.int(0, best.length - 1)]!.id, 'normal');
}

/* ------------------------------------------------ Legendäre und Set-Gegenstände */

interface AffixRange {
  stat: Stat;
  min: number;
  max: number;
}

export interface LegendaryDef {
  id: string;
  name: string;
  base: string;
  minLevel: number;
  affixes: AffixRange[];
  power: Power;
  /** Fällt gezielt von diesem Monster (Boss) */
  source?: string;
}

export const LEGENDARIES: LegendaryDef[] = [
  { id: 'rat_king_ring', name: 'Ring des Rattenkönigs', base: 'iron_ring', minLevel: 1, affixes: [{ stat: 'maxHp', min: 15, max: 25 }], power: { id: 'goldBonus', value: 25 } },
  { id: 'bog_walkers', name: 'Moorwandler', base: 'cloth_boots', minLevel: 5, affixes: [{ stat: 'maxHp', min: 20, max: 30 }, { stat: 'armor', min: 2, max: 3 }], power: { id: 'xpBonus', value: 8 } },
  { id: 'harkon_blade', name: 'Harkons Klinge', base: 'steel_sword', minLevel: 12, affixes: [{ stat: 'damage', min: 6, max: 9 }, { stat: 'kraft', min: 2, max: 3 }], power: { id: 'crit', value: 15 }, source: 'bandit_lord' },
  { id: 'bone_cleaver', name: 'Knochenspalter', base: 'cinder_axe', minLevel: 11, affixes: [{ stat: 'damage', min: 8, max: 12 }], power: { id: 'crit', value: 12 } },
  { id: 'ember_band', name: 'Glutband', base: 'ember_ring', minLevel: 11, affixes: [{ stat: 'maxMana', min: 15, max: 25 }, { stat: 'damage', min: 3, max: 5 }], power: { id: 'lifesteal', value: 4 } },
  { id: 'morrik_plate', name: 'Morriks Knochenpanzer', base: 'bone_plate', minLevel: 14, affixes: [{ stat: 'armor', min: 6, max: 8 }, { stat: 'maxHp', min: 40, max: 60 }], power: { id: 'thorns', value: 15 }, source: 'bone_lord' },
  { id: 'veshra_seal', name: 'Veshras Siegel', base: 'silver_ring', minLevel: 16, affixes: [{ stat: 'maxMana', min: 20, max: 30 }, { stat: 'damage', min: 4, max: 6 }], power: { id: 'manaKill', value: 6 }, source: 'bog_queen' },
  { id: 'wolf_fang', name: 'Wolfsfang', base: 'war_blade', minLevel: 17, affixes: [{ stat: 'damage', min: 8, max: 12 }, { stat: 'kraft', min: 2, max: 4 }], power: { id: 'lifesteal', value: 5 } },
  { id: 'colossus_heart', name: 'Kolossherz', base: 'dread_mail', minLevel: 20, affixes: [{ stat: 'armor', min: 10, max: 14 }, { stat: 'maxHp', min: 80, max: 120 }], power: { id: 'thorns', value: 25 }, source: 'stone_colossus' },
  { id: 'death_grip', name: 'Griff des Todes', base: 'dread_fists', minLevel: 21, affixes: [{ stat: 'damage', min: 8, max: 12 }, { stat: 'armor', min: 4, max: 6 }], power: { id: 'lifesteal', value: 6 } },
  { id: 'ash_bringer', name: 'Aschenbringer', base: 'ash_greatsword', minLevel: 26, affixes: [{ stat: 'damage', min: 15, max: 20 }, { stat: 'kraft', min: 4, max: 6 }], power: { id: 'lifesteal', value: 8 }, source: 'ash_king' },
  { id: 'ash_crown', name: 'Aschenkrone', base: 'ash_visor', minLevel: 26, affixes: [{ stat: 'armor', min: 8, max: 12 }, { stat: 'maxHp', min: 100, max: 150 }], power: { id: 'xpBonus', value: 15 }, source: 'ash_king' },
];

export function legendaryById(id: string): LegendaryDef {
  const d = LEGENDARIES.find((x) => x.id === id);
  if (!d) throw new Error(`Unbekanntes Unikat: ${id}`);
  return d;
}

export function generateLegendary(rng: Rng, id: number, defId: string): Item {
  const d = legendaryById(defId);
  const t = templateById(d.base);
  const affixes = d.affixes.map((a) => ({ stat: a.stat, value: rng.int(a.min, a.max) }));
  return {
    id, templateId: d.base, name: d.name, slot: t.slot, rarity: 'legendary', weight: t.weight,
    damage: t.damage ? [...t.damage] : undefined, armor: t.armor, reqKraft: t.reqKraft,
    value: t.value * RARITY_VALUE.legendary + 100, affixes, power: { ...d.power }, unique: d.id,
  };
}

export interface SetBonus {
  affixes?: Affix[];
  power?: Power;
}

export interface SetDef {
  id: string;
  name: string;
  minLevel: number;
  /** Teile: Vorlage, Name, feste Zusatzwerte */
  pieces: { base: string; name: string; affixes: Affix[] }[];
  bonuses: Record<number, SetBonus>;
}

export const SETS: SetDef[] = [
  {
    id: 'warden', name: 'Wächter von Aschental', minLevel: 9,
    pieces: [
      { base: 'iron_helm', name: 'Wächterhaube', affixes: [{ stat: 'armor', value: 3 }] },
      { base: 'plate_cuirass', name: 'Wächterharnisch', affixes: [{ stat: 'maxHp', value: 25 }] },
      { base: 'iron_gauntlets', name: 'Wächterfäuste', affixes: [{ stat: 'damage', value: 3 }] },
      { base: 'iron_greaves', name: 'Wächterschienen', affixes: [{ stat: 'armor', value: 3 }] },
    ],
    bonuses: {
      2: { affixes: [{ stat: 'maxHp', value: 40 }] },
      3: { affixes: [{ stat: 'armor', value: 8 }] },
      4: { affixes: [{ stat: 'damage', value: 8 }], power: { id: 'thorns', value: 10 } },
    },
  },
  {
    id: 'bonebinder', name: 'Knochenbinder', minLevel: 15,
    pieces: [
      { base: 'crown_helm', name: 'Knochenbinder-Krone', affixes: [{ stat: 'maxMana', value: 15 }] },
      { base: 'bone_plate', name: 'Knochenbinder-Panzer', affixes: [{ stat: 'maxHp', value: 50 }] },
      { base: 'bone_gloves', name: 'Knochenbinder-Griffe', affixes: [{ stat: 'damage', value: 5 }] },
      { base: 'bone_boots', name: 'Knochenbinder-Tritte', affixes: [{ stat: 'armor', value: 5 }] },
    ],
    bonuses: {
      2: { affixes: [{ stat: 'maxMana', value: 40 }] },
      3: { affixes: [{ stat: 'damage', value: 12 }] },
      4: { affixes: [{ stat: 'kraft', value: 6 }], power: { id: 'lifesteal', value: 6 } },
    },
  },
  {
    id: 'ashen', name: 'Aschenerbe', minLevel: 26,
    pieces: [
      { base: 'ash_visor', name: 'Aschenerbe-Visier', affixes: [{ stat: 'maxHp', value: 80 }] },
      { base: 'ash_cuirass', name: 'Aschenerbe-Harnisch', affixes: [{ stat: 'armor', value: 10 }] },
      { base: 'ash_gauntlets', name: 'Aschenerbe-Stulpen', affixes: [{ stat: 'damage', value: 12 }] },
      { base: 'ash_boots', name: 'Aschenerbe-Stiefel', affixes: [{ stat: 'maxHp', value: 60 }] },
    ],
    bonuses: {
      2: { affixes: [{ stat: 'kraft', value: 8 }, { stat: 'maxHp', value: 120 }] },
      3: { affixes: [{ stat: 'damage', value: 25 }] },
      4: { affixes: [{ stat: 'armor', value: 25 }], power: { id: 'crit', value: 15 } },
    },
  },
];

export function setById(id: string): SetDef {
  const d = SETS.find((x) => x.id === id);
  if (!d) throw new Error(`Unbekanntes Set: ${id}`);
  return d;
}

export function generateSetPiece(rng: Rng, id: number, setId: string, index: number): Item {
  const set = setById(setId);
  const piece = set.pieces[index]!;
  const t = templateById(piece.base);
  void rng;
  return {
    id, templateId: piece.base, name: piece.name, slot: t.slot, rarity: 'set', weight: t.weight,
    damage: t.damage ? [...t.damage] : undefined, armor: t.armor, reqKraft: t.reqKraft,
    value: t.value * RARITY_VALUE.set, affixes: piece.affixes.map((a) => ({ ...a })), setId,
  };
}

/** Seltene Sonderdrops: Unikate (Bosse gezielt, sonst sehr selten) und Set-Teile. */
export function rollSpecial(rng: Rng, nextId: () => number, monsterLevel: number, monsterId: string, boss: boolean): Item | null {
  const sourced = LEGENDARIES.filter((d) => d.source === monsterId);
  if (sourced.length && rng.next() < 0.55) return generateLegendary(rng, nextId(), sourced[rng.int(0, sourced.length - 1)]!.id);
  if (boss) return null;
  if (rng.next() < 0.004) {
    const pool = LEGENDARIES.filter((d) => !d.source && d.minLevel <= monsterLevel + 1 && d.minLevel >= monsterLevel - 9);
    if (pool.length) return generateLegendary(rng, nextId(), pool[rng.int(0, pool.length - 1)]!.id);
  }
  if (rng.next() < 0.006) {
    const sets = SETS.filter((d) => d.minLevel <= monsterLevel + 1 && d.minLevel >= monsterLevel - 9);
    if (sets.length) {
      const set = sets[rng.int(0, sets.length - 1)]!;
      return generateSetPiece(rng, nextId(), set.id, rng.int(0, set.pieces.length - 1));
    }
  }
  return null;
}

/** Würfelt die Affixe eines normalen/magischen/seltenen Gegenstands neu (Schmied). */
export function rerollAffixes(rng: Rng, item: Item, rarity: Rarity, count: number): void {
  const t = templateById(item.templateId);
  const pool = [...AFFIXES];
  item.affixes = [];
  for (let i = 0; i < count && pool.length; i++) item.affixes.push(rollAffix(rng, pool, t.minLevel));
  item.rarity = rarity;
  item.name = item.affixes.length ? `${t.name} ${AFFIXES.find((a) => a.stat === item.affixes[0]!.stat)!.name}` : t.name;
  item.value = t.value * RARITY_VALUE[rarity] + item.affixes.length * 8;
}

/** Fügt einem seltenen Gegenstand ein weiteres Affix hinzu (Schmied). */
export function extendAffixes(rng: Rng, item: Item): void {
  const t = templateById(item.templateId);
  const pool = AFFIXES.filter((a) => !item.affixes.some((x) => x.stat === a.stat));
  if (!pool.length) return;
  item.affixes.push(rollAffix(rng, pool, t.minLevel));
  item.value += 8;
}
