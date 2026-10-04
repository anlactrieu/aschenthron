import type { Rng } from './rng';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'ring' | 'quiver';
/** Verbrauchsgegenstände belegen keinen Ausrüstungsslot */
export type ItemSlot = Slot | 'potion' | 'ammo';
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

/** Anforderungen an den Träger (Stufe und Attribute), wie in klassischen RPGs. */
export interface Req {
  level?: number;
  kraft?: number;
  gewandtheit?: number;
  ausdauer?: number;
  verstand?: number;
  willenskraft?: number;
}
export type WeaponKind = 'melee' | 'bow' | 'staff';

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
  /** weitere Anforderungen (Stufe wird sonst aus minLevel abgeleitet) */
  req?: Req;
  /** Waffenart: Bogen und Stab stärken Fernkampf bzw. Magie statt Nahkampf */
  kind?: WeaponKind;
  /** feste Werte, die der Gegenstand immer mitbringt (z. B. Mana bei Stäben) */
  base?: Affix[];
  /** Köcher: Fassungsvermögen; Pfeilbündel: Stückzahl */
  capacity?: number;
  ammo?: number;
  /** Zusatzschaden der Pfeile bei Fernkampf-Skills */
  arrowBonus?: number;
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
  req?: Req;
  kind?: WeaponKind;
  /** Köcher: aktuelle Pfeile; Pfeilbündel: Stückzahl */
  ammo?: number;
  capacity?: number;
  arrowBonus?: number;
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
  { id: 'hunt_bow', name: 'Jagdbogen', slot: 'weapon', kind: 'bow', weight: 3, damage: [3, 6], reqKraft: 0, req: { gewandtheit: 10 }, value: 12, minLevel: 1 },
  { id: 'yew_bow', name: 'Eibenbogen', slot: 'weapon', kind: 'bow', weight: 4, damage: [8, 14], reqKraft: 0, req: { gewandtheit: 16 }, value: 70, minLevel: 6 },
  { id: 'horn_bow', name: 'Hornbogen', slot: 'weapon', kind: 'bow', weight: 4, damage: [13, 22], reqKraft: 0, req: { gewandtheit: 22 }, value: 170, minLevel: 11 },
  { id: 'war_bow', name: 'Kriegsbogen', slot: 'weapon', kind: 'bow', weight: 5, damage: [19, 32], reqKraft: 0, req: { gewandtheit: 28 }, value: 330, minLevel: 16 },
  { id: 'dread_bow', name: 'Schreckensbogen', slot: 'weapon', kind: 'bow', weight: 5, damage: [26, 44], reqKraft: 0, req: { gewandtheit: 34 }, value: 650, minLevel: 21 },
  { id: 'ash_bow', name: 'Aschenbogen', slot: 'weapon', kind: 'bow', weight: 6, damage: [35, 56], reqKraft: 0, req: { gewandtheit: 40 }, value: 1150, minLevel: 26 },
  { id: 'twig_staff', name: 'Krummstab', slot: 'weapon', kind: 'staff', weight: 3, damage: [2, 4], reqKraft: 0, req: { verstand: 10 }, base: [{ stat: 'maxMana', value: 8 }], value: 12, minLevel: 1 },
  { id: 'oak_staff', name: 'Eichenstab', slot: 'weapon', kind: 'staff', weight: 4, damage: [5, 9], reqKraft: 0, req: { verstand: 16 }, base: [{ stat: 'maxMana', value: 18 }], value: 70, minLevel: 6 },
  { id: 'bone_staff', name: 'Knochenstab', slot: 'weapon', kind: 'staff', weight: 4, damage: [9, 15], reqKraft: 0, req: { verstand: 22 }, base: [{ stat: 'maxMana', value: 30 }], value: 170, minLevel: 11 },
  { id: 'crystal_staff', name: 'Kristallstab', slot: 'weapon', kind: 'staff', weight: 5, damage: [13, 22], reqKraft: 0, req: { verstand: 28 }, base: [{ stat: 'maxMana', value: 45 }], value: 330, minLevel: 16 },
  { id: 'cinder_staff', name: 'Glutstab', slot: 'weapon', kind: 'staff', weight: 5, damage: [18, 30], reqKraft: 0, req: { verstand: 34 }, base: [{ stat: 'maxMana', value: 65 }], value: 650, minLevel: 21 },
  { id: 'void_staff', name: 'Leerenstab', slot: 'weapon', kind: 'staff', weight: 6, damage: [24, 40], reqKraft: 0, req: { verstand: 40 }, base: [{ stat: 'maxMana', value: 90 }], value: 1150, minLevel: 26 },
  { id: 'cloth_robe', name: 'Stoffrobe', slot: 'chest', weight: 4, armor: 1, reqKraft: 0, req: { verstand: 11 }, base: [{ stat: 'maxMana', value: 10 }], value: 30, minLevel: 2 },
  { id: 'acolyte_robe', name: 'Akolythenrobe', slot: 'chest', weight: 5, armor: 3, reqKraft: 0, req: { verstand: 18, willenskraft: 12 }, base: [{ stat: 'maxMana', value: 25 }], value: 140, minLevel: 9 },
  { id: 'bone_robe', name: 'Knochenrobe', slot: 'chest', weight: 6, armor: 6, reqKraft: 0, req: { verstand: 24, willenskraft: 18 }, base: [{ stat: 'maxMana', value: 40 }], value: 280, minLevel: 15 },
  { id: 'dread_robe', name: 'Schreckensrobe', slot: 'chest', weight: 7, armor: 9, reqKraft: 0, req: { verstand: 30, willenskraft: 24 }, base: [{ stat: 'maxMana', value: 60 }], value: 560, minLevel: 21 },
  { id: 'ash_robe', name: 'Aschenrobe', slot: 'chest', weight: 8, armor: 12, reqKraft: 0, req: { verstand: 36, willenskraft: 30 }, base: [{ stat: 'maxMana', value: 85 }], value: 1000, minLevel: 27 },
  { id: 'leather_vest', name: 'Lederwams', slot: 'chest', weight: 8, armor: 2, reqKraft: 0, req: { gewandtheit: 11 }, value: 30, minLevel: 2 },
  { id: 'hunter_vest', name: 'Jägerwams', slot: 'chest', weight: 9, armor: 6, reqKraft: 0, req: { gewandtheit: 18 }, value: 140, minLevel: 9 },
  { id: 'bone_leather', name: 'Knochenleder', slot: 'chest', weight: 10, armor: 10, reqKraft: 0, req: { gewandtheit: 24 }, value: 280, minLevel: 15 },
  { id: 'dread_leather', name: 'Schreckensleder', slot: 'chest', weight: 11, armor: 15, reqKraft: 0, req: { gewandtheit: 30 }, value: 560, minLevel: 21 },
  { id: 'ash_leather', name: 'Aschenleder', slot: 'chest', weight: 12, armor: 20, reqKraft: 0, req: { gewandtheit: 36 }, value: 1000, minLevel: 27 },
  { id: 'leather_quiver', name: 'Lederköcher', slot: 'quiver', weight: 1, reqKraft: 0, capacity: 40, ammo: 40, arrowBonus: 0, value: 20, minLevel: 1 },
  { id: 'hunter_quiver', name: 'Jägerköcher', slot: 'quiver', weight: 1.5, reqKraft: 0, capacity: 60, ammo: 60, arrowBonus: 4, value: 90, minLevel: 8 },
  { id: 'ranger_quiver', name: 'Waldläuferköcher', slot: 'quiver', weight: 2, reqKraft: 0, capacity: 90, ammo: 90, arrowBonus: 9, value: 260, minLevel: 16 },
  { id: 'ash_quiver', name: 'Aschenköcher', slot: 'quiver', weight: 2.5, reqKraft: 0, capacity: 130, ammo: 130, arrowBonus: 16, value: 700, minLevel: 24 },
  { id: 'wood_arrows', name: 'Holzpfeile (20)', slot: 'ammo', weight: 0.5, reqKraft: 0, ammo: 20, arrowBonus: 0, value: 8, minLevel: 1 },
  { id: 'iron_arrows', name: 'Eisenpfeile (20)', slot: 'ammo', weight: 0.6, reqKraft: 0, ammo: 20, arrowBonus: 4, value: 40, minLevel: 6 },
  { id: 'steel_arrows', name: 'Stahlpfeile (20)', slot: 'ammo', weight: 0.7, reqKraft: 0, ammo: 20, arrowBonus: 9, value: 110, minLevel: 12 },
  { id: 'ember_arrows', name: 'Glutpfeile (20)', slot: 'ammo', weight: 0.8, reqKraft: 0, ammo: 20, arrowBonus: 16, value: 280, minLevel: 18 },
  { id: 'ash_arrows', name: 'Aschenpfeile (20)', slot: 'ammo', weight: 0.9, reqKraft: 0, ammo: 20, arrowBonus: 26, value: 600, minLevel: 24 },
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

/** Anforderungen eines Gegenstands: Stufe aus minLevel, Kraft aus reqKraft, schwere Rüstung/Waffen verlangen zusätzlich Ausdauer/Gewandtheit. */
export function reqOfTemplate(t: ItemTemplate): Req {
  const r: Req = { level: Math.max(1, t.minLevel - 1), ...t.req };
  if (t.reqKraft > 0) r.kraft = t.reqKraft;
  if (t.slot !== 'potion' && t.slot !== 'ring' && t.reqKraft >= 14) {
    if (t.slot === 'weapon' && r.gewandtheit === undefined) r.gewandtheit = Math.round(t.reqKraft * 0.4);
    else if (t.slot !== 'weapon' && r.ausdauer === undefined) r.ausdauer = Math.round(t.reqKraft * 0.55);
  }
  return r;
}

/** Anforderungen eines vorhandenen Gegenstands (alte Spielstände ohne `req` bleiben gültig). */
export function itemReq(i: Item): Req {
  const r: Req = { level: 1, ...i.req };
  if (r.kraft === undefined && i.reqKraft > 0) r.kraft = i.reqKraft;
  return r;
}

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
  const rarity: Rarity = t.slot === 'potion' || t.slot === 'ammo' || t.slot === 'quiver' ? 'normal' : rarityIn;
  const [lo, hi] = RARITY_AFFIXES[rarity];
  const count = rng.int(lo, hi);
  const pool = [...AFFIXES];
  const affixes: Affix[] = (t.base ?? []).map((a) => ({ ...a }));
  for (let i = 0; i < count && pool.length; i++) affixes.push(rollAffix(rng, pool, t.minLevel));
  const rolled = affixes.slice((t.base ?? []).length);
  const name = rolled.length ? `${t.name} ${AFFIXES.find((a) => a.stat === rolled[0]!.stat)!.name}` : t.name;
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
    req: t.slot === 'potion' || t.slot === 'ammo' ? undefined : reqOfTemplate(t),
    kind: t.kind,
    ammo: t.ammo,
    capacity: t.capacity,
    arrowBonus: t.arrowBonus,
    value: t.value * RARITY_VALUE[rarity] + (affixes.length) * 8,
    affixes,
  };
}

export function rollDrop(rng: Rng, nextId: () => number, monsterLevel: number, forceRarity?: Rarity): Item {
  const pool = TEMPLATES.filter((t) => t.slot !== 'potion' && t.slot !== 'ammo' && t.minLevel <= monsterLevel && t.minLevel >= monsterLevel - 8);
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
    damage: t.damage ? [...t.damage] : undefined, armor: t.armor, reqKraft: t.reqKraft, req: reqOfTemplate(t), kind: t.kind,
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
    damage: t.damage ? [...t.damage] : undefined, armor: t.armor, reqKraft: t.reqKraft, req: reqOfTemplate(t), kind: t.kind,
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
  item.affixes = (t.base ?? []).map((a) => ({ ...a }));
  for (let i = 0; i < count && pool.length; i++) item.affixes.push(rollAffix(rng, pool, t.minLevel));
  item.rarity = rarity;
  const rolled = item.affixes.slice((t.base ?? []).length);
  item.name = rolled.length ? `${t.name} ${AFFIXES.find((a) => a.stat === rolled[0]!.stat)!.name}` : t.name;
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

/** Pfeilbündel passend zur Monsterstufe (selten als Beute). */
export function rollArrows(rng: Rng, nextId: () => number, monsterLevel: number): Item {
  const tiers = TEMPLATES.filter((t) => t.slot === 'ammo' && t.minLevel <= monsterLevel);
  const best = tiers.filter((t) => t.minLevel === Math.max(...tiers.map((x) => x.minLevel)));
  return generateItem(rng, nextId(), best[rng.int(0, best.length - 1)]!.id, 'normal');
}
