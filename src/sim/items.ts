import type { Rng } from './rng';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'ring';
export type Rarity = 'normal' | 'magic' | 'rare';
export type Stat = 'damage' | 'armor' | 'maxHp' | 'kraft';

export interface ItemTemplate {
  id: string;
  name: string;
  slot: Slot;
  weight: number;
  /** Basiswerte (Waffe: Schaden min/max, Rüstung: Rüstung) */
  damage?: [number, number];
  armor?: number;
  reqKraft: number;
}

export interface Affix {
  stat: Stat;
  value: number;
}

export interface Item {
  id: number;
  templateId: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  weight: number;
  damage?: [number, number];
  armor?: number;
  reqKraft: number;
  affixes: Affix[];
}

export const TEMPLATES: ItemTemplate[] = [
  { id: 'rusty_sword', name: 'Rostiges Schwert', slot: 'weapon', weight: 6, damage: [3, 6], reqKraft: 8 },
  { id: 'bone_club', name: 'Knochenkeule', slot: 'weapon', weight: 9, damage: [5, 9], reqKraft: 12 },
  { id: 'leather_cap', name: 'Lederkappe', slot: 'head', weight: 2, armor: 1, reqKraft: 5 },
  { id: 'ash_mail', name: 'Aschenhemd', slot: 'chest', weight: 12, armor: 4, reqKraft: 12 },
  { id: 'worn_gloves', name: 'Abgenutzte Handschuhe', slot: 'hands', weight: 1, armor: 1, reqKraft: 5 },
  { id: 'cloth_boots', name: 'Stoffstiefel', slot: 'feet', weight: 2, armor: 1, reqKraft: 5 },
  { id: 'iron_ring', name: 'Eisenring', slot: 'ring', weight: 0.5, reqKraft: 0 },
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

export function generateItem(rng: Rng, id: number, templateId: string, rarity: Rarity): Item {
  const t = templateById(templateId);
  const [lo, hi] = RARITY_AFFIXES[rarity];
  const count = rng.int(lo, hi);
  const pool = [...AFFIXES];
  const affixes: Affix[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const def = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    affixes.push({ stat: def.stat, value: rng.int(def.min, def.max) });
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
    reqKraft: t.reqKraft,
    affixes,
  };
}

export function rollDrop(rng: Rng, nextId: () => number): Item | null {
  if (rng.next() > 0.6) return null;
  const t = TEMPLATES[rng.int(0, TEMPLATES.length - 1)]!;
  return generateItem(rng, nextId(), t.id, rollRarity(rng));
}
