import type { Rng } from './rng';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'ring';
/** Verbrauchsgegenstände belegen keinen Ausrüstungsslot */
export type ItemSlot = Slot | 'potion';
export type Rarity = 'normal' | 'magic' | 'rare';
export type Stat = 'damage' | 'armor' | 'maxHp' | 'kraft';

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
];

const RARITY_VALUE: Record<Rarity, number> = { normal: 1, magic: 3, rare: 8 };
const RARITY_AFFIXES: Record<Rarity, [number, number]> = { normal: [0, 0], magic: [1, 2], rare: [3, 4] };

export function templateById(id: string): ItemTemplate {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unbekannte Item-Vorlage: ${id}`);
  return t;
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
  for (let i = 0; i < count && pool.length; i++) {
    const def = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    const scale = 1 + t.minLevel / 8;
    affixes.push({ stat: def.stat, value: Math.max(1, Math.round(rng.int(def.min, def.max) * (def.stat === 'kraft' ? 1 + t.minLevel / 20 : scale))) });
  }
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
