import type { Rng } from './rng';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'ring' | 'amulet' | 'offhand' | 'belt' | 'cloak' | 'legs';
/** Alle Ausrüstungsslots (Gegenstände); `ring2` ist nur ein zweites Feld für Ringe. */
export const SLOTS: Slot[] = ['weapon', 'head', 'chest', 'hands', 'feet', 'ring', 'amulet', 'offhand', 'belt', 'cloak', 'legs'];
/** Felder im Ausrüstungs-Objekt (Speicherstand, Netz-Validierung). */
export const EQUIP_SLOT_LIST: EquipSlot[] = [...SLOTS, 'ring2'];
/** Ausrüstungsfelder: wie Slot, dazu das zweite Ringfeld (Gegenstände selbst haben immer `ring`). */
export type EquipSlot = Slot | 'ring2';
/** Verbrauchsgegenstände belegen keinen Ausrüstungsslot */
export type ItemSlot = Slot | 'potion' | 'gem';
export type Rarity = 'normal' | 'magic' | 'rare' | 'set' | 'legendary';
export type Stat = 'damage' | 'armor' | 'maxHp' | 'kraft' | 'maxMana' | 'haste' | 'crit' | 'regen' | 'accuracy' | 'evasion' | 'resFire' | 'resFrost' | 'resPoison'
  /** Stufe 6: Build-Werte (Prozent, negativ = Nachteil) */
  | 'spellFire' | 'spellFrost' | 'healPower' | 'manaCost' | 'ctrl' | 'move' | 'parry'
  /** Proc-Werte (Prozent Chance je Treffer, siehe `dealDamage`) */
  | 'procBurn' | 'procFrost';
/** Besondere Effekte legendärer Gegenstände und Set-Boni */
export type PowerId = 'lifesteal' | 'crit' | 'thorns' | 'manaKill' | 'xpBonus' | 'goldBonus' | 'execute' | 'healKill' | 'burnHit' | 'frostHit';
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
  execute: (v) => `+${v} % Schaden gegen Gegner unter 30 % Leben`,
  healKill: (v) => `+${v} Leben pro Kill`,
  burnHit: (v) => `${v} % Chance, das Ziel in Brand zu setzen`,
  frostHit: (v) => `${v} % Chance, das Ziel zu verlangsamen`,
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
  /** Schriftrolle: Ziel-Stadt (Name der Stadt), teleportiert beim Lesen */
  town?: string;
  /** Basiswerte (Waffe: Schaden min/max, Rüstung: Rüstung) */
  damage?: [number, number];
  armor?: number;
  reqKraft: number;
  /** weitere Anforderungen (Stufe wird sonst aus minLevel abgeleitet) */
  req?: Req;
  /** Waffenart: Bogen und Stab stärken Fernkampf bzw. Magie statt Nahkampf */
  kind?: WeaponKind;
  /** Einhand (Standard) oder Zweihand: Zweihänder blockieren die Nebenhand (Bögen nur Pfeile) */
  hands?: 1 | 2;
  /** Multiplikator auf das Angriffsintervall (kleiner = schneller): Dolche 0,8, Hämmer 1,25 */
  speed?: number;
  /** Edelstein-Vorlage */
  gem?: GemInfo;
  /** feste Werte, die der Gegenstand immer mitbringt (z. B. Mana bei Stäben) */
  base?: Affix[];
  /** Nebenhand: Pfeile (unendlich, für Bögen nötig) oder Schild */
  off?: 'arrows' | 'shield';
  /** Zusatzschaden der Pfeile bei Fernkampf-Skills */
  arrowBonus?: number;
  /** Build-Hinweis für den Tooltip: wofür der Gegenstand gedacht ist und was er kostet */
  hint?: string;
  value: number;
  minLevel: number;
}

export interface Affix {
  stat: Stat;
  value: number;
  /** Affix-Stufe 1–5 (5 = selten, bester Wertbereich); ältere Gegenstände haben keine */
  tier?: number;
}

export type GemKind = 'ruby' | 'sapphire' | 'emerald' | 'topaz';
export type GemQuality = 1 | 2 | 3;
export interface GemInfo {
  kind: GemKind;
  q: GemQuality;
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
  town?: string;
  damage?: [number, number];
  armor?: number;
  reqKraft: number;
  req?: Req;
  kind?: WeaponKind;
  hands?: 1 | 2;
  speed?: number;
  /** Nebenhand: Pfeile oder Schild */
  off?: 'arrows' | 'shield';
  arrowBonus?: number;
  value: number;
  affixes: Affix[];
  /** Sockel (null = leer); Edelsteine zählen wie Affixe */
  sockets?: (GemInfo | null)[];
  /** nur Edelstein-Gegenstände */
  gem?: GemInfo;
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
  { id: 'doom_hammer', name: 'Schädelbrecher', slot: 'weapon', hands: 2, speed: 1.25, weight: 16, damage: [34, 62], reqKraft: 32, value: 700, minLevel: 21 },
  { id: 'ash_greatsword', name: 'Aschenrichter', slot: 'weapon', hands: 2, weight: 16, damage: [37, 65], reqKraft: 36, value: 1250, minLevel: 26 },
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
  { id: 'bone_charm', name: 'Knochenanhänger', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'maxHp', value: 12 }], value: 40, minLevel: 1 },
  { id: 'copper_amulet', name: 'Kupferamulett', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'armor', value: 2 }], value: 70, minLevel: 6 },
  { id: 'wisdom_amulet', name: 'Weisheitsamulett', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'maxMana', value: 30 }], value: 150, minLevel: 11 },
  { id: 'hunter_talisman', name: 'Jägertalisman', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'accuracy', value: 12 }, { stat: 'evasion', value: 8 }], value: 150, minLevel: 11 },
  { id: 'ember_pendant', name: 'Glutanhänger', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'damage', value: 5 }, { stat: 'maxHp', value: 30 }], value: 310, minLevel: 16 },
  { id: 'moon_amulet', name: 'Mondamulett', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'maxMana', value: 60 }, { stat: 'regen', value: 1 }], value: 320, minLevel: 16 },
  { id: 'blood_pendant', name: 'Blutanhänger', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'maxHp', value: 90 }, { stat: 'damage', value: 8 }], value: 620, minLevel: 21 },
  { id: 'dread_talisman', name: 'Schreckenstalisman', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'crit', value: 3 }, { stat: 'haste', value: 4 }, { stat: 'maxHp', value: 60 }], value: 640, minLevel: 21 },
  { id: 'ash_amulet', name: 'Aschenamulett', slot: 'amulet', weight: 0.5, reqKraft: 0, base: [{ stat: 'damage', value: 14 }, { stat: 'maxHp', value: 140 }, { stat: 'armor', value: 6 }], value: 1150, minLevel: 27 },
  { id: 'heal_huge', name: 'Riesiger Heiltrank', slot: 'potion', weight: 0.6, heal: 600, reqKraft: 0, value: 160, minLevel: 21 },
  { id: 'mana_huge', name: 'Riesiger Manatrank', slot: 'potion', weight: 0.6, mana: 300, reqKraft: 0, value: 160, minLevel: 21 },
  { id: 'heal_max', name: 'Elixier des Lebens', slot: 'potion', weight: 0.7, heal: 1100, reqKraft: 0, value: 320, minLevel: 27 },
  { id: 'mana_max', name: 'Elixier der Weisheit', slot: 'potion', weight: 0.7, mana: 550, reqKraft: 0, value: 320, minLevel: 27 },
  { id: 'hunt_bow', name: 'Jagdbogen', slot: 'weapon', kind: 'bow', hands: 2, weight: 3, damage: [3, 6], reqKraft: 0, req: { gewandtheit: 10 }, value: 12, minLevel: 1 },
  { id: 'yew_bow', name: 'Eibenbogen', slot: 'weapon', kind: 'bow', hands: 2, weight: 4, damage: [8, 14], reqKraft: 0, req: { gewandtheit: 16 }, value: 70, minLevel: 6 },
  { id: 'horn_bow', name: 'Hornbogen', slot: 'weapon', kind: 'bow', hands: 2, weight: 4, damage: [13, 22], reqKraft: 0, req: { gewandtheit: 22 }, value: 170, minLevel: 11 },
  { id: 'war_bow', name: 'Kriegsbogen', slot: 'weapon', kind: 'bow', hands: 2, weight: 5, damage: [19, 32], reqKraft: 0, req: { gewandtheit: 28 }, value: 330, minLevel: 16 },
  { id: 'dread_bow', name: 'Schreckensbogen', slot: 'weapon', kind: 'bow', hands: 2, weight: 5, damage: [26, 44], reqKraft: 0, req: { gewandtheit: 34 }, value: 650, minLevel: 21 },
  { id: 'ash_bow', name: 'Aschenbogen', slot: 'weapon', kind: 'bow', hands: 2, weight: 6, damage: [35, 56], reqKraft: 0, req: { gewandtheit: 40 }, value: 1150, minLevel: 26 },
  { id: 'twig_staff', name: 'Krummstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 3, damage: [2, 4], reqKraft: 0, req: { verstand: 10 }, base: [{ stat: 'maxMana', value: 8 }], value: 12, minLevel: 1 },
  { id: 'oak_staff', name: 'Eichenstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 4, damage: [5, 9], reqKraft: 0, req: { verstand: 16 }, base: [{ stat: 'maxMana', value: 18 }], value: 70, minLevel: 6 },
  { id: 'bone_staff', name: 'Knochenstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 4, damage: [9, 15], reqKraft: 0, req: { verstand: 22 }, base: [{ stat: 'maxMana', value: 30 }], value: 170, minLevel: 11 },
  { id: 'crystal_staff', name: 'Kristallstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 5, damage: [13, 22], reqKraft: 0, req: { verstand: 28 }, base: [{ stat: 'maxMana', value: 45 }], value: 330, minLevel: 16 },
  { id: 'cinder_staff', name: 'Glutstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 5, damage: [18, 30], reqKraft: 0, req: { verstand: 34 }, base: [{ stat: 'maxMana', value: 65 }], value: 650, minLevel: 21 },
  { id: 'void_staff', name: 'Leerenstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 6, damage: [24, 40], reqKraft: 0, req: { verstand: 40 }, base: [{ stat: 'maxMana', value: 90 }], value: 1150, minLevel: 26 },
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
  { id: 'wood_arrows', name: 'Holzpfeile', slot: 'offhand', off: 'arrows', weight: 0.5, reqKraft: 0, arrowBonus: 0, value: 20, minLevel: 1 },
  { id: 'iron_arrows', name: 'Eisenpfeile', slot: 'offhand', off: 'arrows', weight: 0.6, reqKraft: 0, arrowBonus: 4, value: 90, minLevel: 6 },
  { id: 'steel_arrows', name: 'Stahlpfeile', slot: 'offhand', off: 'arrows', weight: 0.7, reqKraft: 0, arrowBonus: 9, value: 220, minLevel: 12 },
  { id: 'ember_arrows', name: 'Glutpfeile', slot: 'offhand', off: 'arrows', weight: 0.8, reqKraft: 0, arrowBonus: 16, value: 450, minLevel: 18 },
  { id: 'ash_arrows', name: 'Aschenpfeile', slot: 'offhand', off: 'arrows', weight: 0.9, reqKraft: 0, arrowBonus: 26, value: 900, minLevel: 24 },
  { id: 'wood_shield', name: 'Holzschild', slot: 'offhand', off: 'shield', weight: 3, armor: 2, reqKraft: 8, value: 20, minLevel: 1 },
  { id: 'iron_shield', name: 'Eisenschild', slot: 'offhand', off: 'shield', weight: 5, armor: 5, reqKraft: 14, value: 70, minLevel: 6 },
  { id: 'steel_shield', name: 'Stahlschild', slot: 'offhand', off: 'shield', weight: 7, armor: 9, reqKraft: 18, value: 150, minLevel: 11 },
  { id: 'bone_shield', name: 'Knochenschild', slot: 'offhand', off: 'shield', weight: 9, armor: 13, reqKraft: 24, value: 300, minLevel: 16 },
  { id: 'dread_shield', name: 'Schreckensschild', slot: 'offhand', off: 'shield', weight: 10, armor: 18, reqKraft: 30, value: 580, minLevel: 21 },
  { id: 'ash_shield', name: 'Aschenschild', slot: 'offhand', off: 'shield', weight: 12, armor: 24, reqKraft: 36, value: 1000, minLevel: 27 },
  { id: 'iron_dagger', name: 'Eisendolch', slot: 'weapon', speed: 0.8, weight: 2, damage: [4, 8], reqKraft: 10, value: 30, minLevel: 3 },
  { id: 'steel_dagger', name: 'Stahldolch', slot: 'weapon', speed: 0.8, weight: 3, damage: [8, 14], reqKraft: 16, value: 120, minLevel: 10 },
  { id: 'bone_dagger', name: 'Knochendolch', slot: 'weapon', speed: 0.8, weight: 3, damage: [14, 25], reqKraft: 22, value: 300, minLevel: 18 },
  { id: 'ash_dagger', name: 'Aschendolch', slot: 'weapon', speed: 0.8, weight: 4, damage: [20, 35], reqKraft: 30, value: 900, minLevel: 25 },
  { id: 'woodcutter_axe', name: 'Holzfälleraxt', slot: 'weapon', hands: 2, weight: 11, damage: [8, 15], reqKraft: 14, value: 70, minLevel: 3 },
  { id: 'battle_axe', name: 'Streitaxt', slot: 'weapon', hands: 2, weight: 13, damage: [11, 21], reqKraft: 18, value: 150, minLevel: 6 },
  { id: 'claymore', name: 'Zweihänder', slot: 'weapon', hands: 2, weight: 14, damage: [17, 32], reqKraft: 22, value: 260, minLevel: 11 },
  { id: 'war_hammer', name: 'Kriegshammer', slot: 'weapon', hands: 2, speed: 1.25, weight: 16, damage: [21, 38], reqKraft: 24, value: 320, minLevel: 12 },
  { id: 'great_axe', name: 'Großaxt', slot: 'weapon', hands: 2, weight: 15, damage: [24, 40], reqKraft: 28, value: 420, minLevel: 16 },
  { id: 'dread_cleaver', name: 'Schreckensspalter', slot: 'weapon', hands: 2, weight: 17, damage: [29, 52], reqKraft: 32, value: 700, minLevel: 21 },
  { id: 'dread_blade', name: 'Schreckensklinge', slot: 'weapon', weight: 11, damage: [20, 36], reqKraft: 30, value: 540, minLevel: 21 },
  { id: 'ash_saber', name: 'Aschensäbel', slot: 'weapon', weight: 12, damage: [27, 45], reqKraft: 36, value: 1000, minLevel: 26 },
  { id: 'cloth_belt', name: 'Stoffgürtel', slot: 'belt', weight: 0.5, armor: 1, reqKraft: 0, base: [{ stat: 'maxHp', value: 5 }], value: 8, minLevel: 1 },
  { id: 'leather_belt', name: 'Ledergürtel', slot: 'belt', weight: 1, armor: 1, reqKraft: 8, base: [{ stat: 'maxHp', value: 10 }], value: 40, minLevel: 6 },
  { id: 'iron_belt', name: 'Eisengürtel', slot: 'belt', weight: 2, armor: 2, reqKraft: 14, base: [{ stat: 'maxHp', value: 20 }], value: 110, minLevel: 11 },
  { id: 'bone_belt', name: 'Knochengürtel', slot: 'belt', weight: 2.5, armor: 3, reqKraft: 22, base: [{ stat: 'maxHp', value: 35 }], value: 240, minLevel: 16 },
  { id: 'dread_belt', name: 'Schreckensgürtel', slot: 'belt', weight: 3, armor: 4, reqKraft: 28, base: [{ stat: 'maxHp', value: 55 }], value: 480, minLevel: 21 },
  { id: 'ash_belt', name: 'Aschengurt', slot: 'belt', weight: 3.5, armor: 6, reqKraft: 34, base: [{ stat: 'maxHp', value: 80 }], value: 900, minLevel: 27 },
  { id: 'rag_cloak', name: 'Lumpenumhang', slot: 'cloak', weight: 1, armor: 1, reqKraft: 0, base: [{ stat: 'evasion', value: 3 }], value: 10, minLevel: 1 },
  { id: 'wool_cloak', name: 'Wollumhang', slot: 'cloak', weight: 1.5, armor: 1, reqKraft: 0, base: [{ stat: 'evasion', value: 6 }], value: 45, minLevel: 6 },
  { id: 'hunter_cloak', name: 'Jägerumhang', slot: 'cloak', weight: 2, armor: 2, reqKraft: 0, base: [{ stat: 'evasion', value: 9 }, { stat: 'resFrost', value: 4 }], value: 130, minLevel: 11 },
  { id: 'wolf_cloak', name: 'Wolfsfellumhang', slot: 'cloak', weight: 3, armor: 3, reqKraft: 0, base: [{ stat: 'evasion', value: 12 }, { stat: 'resFrost', value: 7 }], value: 270, minLevel: 16 },
  { id: 'dread_cloak', name: 'Schreckensmantel', slot: 'cloak', weight: 3.5, armor: 4, reqKraft: 0, base: [{ stat: 'evasion', value: 15 }, { stat: 'resFire', value: 9 }], value: 520, minLevel: 21 },
  { id: 'ash_cloak', name: 'Aschenmantel', slot: 'cloak', weight: 4, armor: 6, reqKraft: 0, base: [{ stat: 'evasion', value: 18 }, { stat: 'resFire', value: 12 }, { stat: 'resPoison', value: 8 }], value: 950, minLevel: 27 },
  { id: 'cloth_pants', name: 'Stoffhose', slot: 'legs', weight: 2, armor: 1, reqKraft: 0, value: 8, minLevel: 1 },
  { id: 'leather_pants', name: 'Lederhose', slot: 'legs', weight: 4, armor: 3, reqKraft: 10, value: 45, minLevel: 6 },
  { id: 'chain_legs', name: 'Kettenbeinlinge', slot: 'legs', weight: 7, armor: 5, reqKraft: 16, value: 120, minLevel: 11 },
  { id: 'bone_legs', name: 'Knochenbeinlinge', slot: 'legs', weight: 9, armor: 8, reqKraft: 22, value: 250, minLevel: 16 },
  { id: 'dread_legs', name: 'Schreckensbeinlinge', slot: 'legs', weight: 11, armor: 12, reqKraft: 28, value: 500, minLevel: 21 },
  { id: 'ash_legs', name: 'Aschenbeinlinge', slot: 'legs', weight: 13, armor: 17, reqKraft: 34, value: 920, minLevel: 27 },
  { id: 'scroll_hafen', name: 'Schriftrolle nach Aschenhafen', slot: 'potion', weight: 0.1, town: 'Aschenhafen', reqKraft: 0, value: 60, minLevel: 1 },
  { id: 'scroll_wacht', name: 'Schriftrolle nach Felsenwacht', slot: 'potion', weight: 0.1, town: 'Felsenwacht', reqKraft: 0, value: 90, minLevel: 6 },
  { id: 'heal_small', name: 'Kleiner Heiltrank', slot: 'potion', weight: 0.3, heal: 50, reqKraft: 0, value: 8, minLevel: 1 },
  { id: 'heal_mid', name: 'Heiltrank', slot: 'potion', weight: 0.4, heal: 130, reqKraft: 0, value: 25, minLevel: 6 },
  { id: 'heal_big', name: 'Großer Heiltrank', slot: 'potion', weight: 0.5, heal: 280, reqKraft: 0, value: 70, minLevel: 11 },
  { id: 'mana_small', name: 'Kleiner Manatrank', slot: 'potion', weight: 0.3, mana: 30, reqKraft: 0, value: 8, minLevel: 1 },
  { id: 'mana_mid', name: 'Manatrank', slot: 'potion', weight: 0.4, mana: 70, reqKraft: 0, value: 25, minLevel: 6 },
  { id: 'mana_big', name: 'Großer Manatrank', slot: 'potion', weight: 0.5, mana: 140, reqKraft: 0, value: 70, minLevel: 11 },
];

/* ------------------------------------------------ Build-Gegenstände (Stufe 6)
 * Jeder trägt einen Nachteil (negativer Basiswert) oder schwächere Grundwerte als gleichstufige Standardstücke
 * und einen Build-Hinweis; sie ersetzen kein Standardstück, sondern stützen einen Spielstil. */
const B = (t: Omit<ItemTemplate, 'reqKraft'> & { reqKraft?: number }): ItemTemplate => ({ reqKraft: 0, ...t });
TEMPLATES.push(
  // Proc-Waffen: Chance auf Brand bzw. Verlangsamung bei jedem Treffer, dafür weniger Grundschaden
  B({ id: 'cinder_blade', name: 'Glutklinge', slot: 'weapon', weight: 8, damage: [7, 12], reqKraft: 14, base: [{ stat: 'procBurn', value: 10 }], hint: 'Nahkämpfer: Treffer setzen manchmal in Brand, dafür weniger Schaden.', value: 150, minLevel: 8 }),
  B({ id: 'rime_blade', name: 'Raureifklinge', slot: 'weapon', weight: 8, damage: [7, 12], reqKraft: 14, base: [{ stat: 'procFrost', value: 12 }], hint: 'Nahkämpfer: Treffer verlangsamen manchmal, dafür weniger Schaden.', value: 150, minLevel: 8 }),
  B({ id: 'pyre_blade', name: 'Scheiterhaufenklinge', slot: 'weapon', weight: 11, damage: [16, 26], reqKraft: 26, base: [{ stat: 'procBurn', value: 16 }], hint: 'Nahkämpfer: häufiger Brand, dafür weniger Schaden.', value: 420, minLevel: 18 }),
  B({ id: 'glacier_blade', name: 'Gletscherklinge', slot: 'weapon', weight: 11, damage: [16, 26], reqKraft: 26, base: [{ stat: 'procFrost', value: 20 }], hint: 'Nahkämpfer: häufiges Verlangsamen, dafür weniger Schaden.', value: 420, minLevel: 18 }),
  // Elementarmagier: Feuer gegen Frostschutz und umgekehrt
  B({ id: 'pyre_staff', name: 'Pyromantenstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 4, damage: [7, 12], req: { verstand: 22 }, base: [{ stat: 'maxMana', value: 28 }, { stat: 'spellFire', value: 12 }, { stat: 'resFrost', value: -8 }], hint: 'Elementarmagier (Feuer): stärkere Feuerzauber, schwächerer Frostschutz.', value: 190, minLevel: 11 }),
  B({ id: 'ash_igniter', name: 'Aschenzünder', slot: 'weapon', kind: 'staff', hands: 2, weight: 5, damage: [14, 24], req: { verstand: 34 }, base: [{ stat: 'maxMana', value: 60 }, { stat: 'spellFire', value: 20 }, { stat: 'resFrost', value: -12 }], hint: 'Elementarmagier (Feuer): stärkere Feuerzauber, schwächerer Frostschutz.', value: 680, minLevel: 21 }),
  B({ id: 'rime_staff', name: 'Raureifstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 4, damage: [7, 12], req: { verstand: 22 }, base: [{ stat: 'maxMana', value: 28 }, { stat: 'spellFrost', value: 12 }, { stat: 'resFire', value: -8 }], hint: 'Elementarmagier (Frost): stärkere Frostzauber, schwächerer Feuerschutz.', value: 190, minLevel: 11 }),
  B({ id: 'glacier_staff', name: 'Gletscherstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 5, damage: [14, 24], req: { verstand: 34 }, base: [{ stat: 'maxMana', value: 60 }, { stat: 'spellFrost', value: 20 }, { stat: 'resFire', value: -12 }], hint: 'Elementarmagier (Frost): stärkere Frostzauber, schwächerer Feuerschutz.', value: 680, minLevel: 21 }),
  B({ id: 'ember_cloak', name: 'Glutmantel', slot: 'cloak', weight: 2.5, armor: 2, base: [{ stat: 'spellFire', value: 10 }, { stat: 'resFire', value: 10 }, { stat: 'resFrost', value: -10 }], hint: 'Feuermagier: stärkere Feuerzauber und Feuerschutz auf Kosten des Frostschutzes.', value: 280, minLevel: 16 }),
  B({ id: 'rime_cloak', name: 'Raureifmantel', slot: 'cloak', weight: 2.5, armor: 2, base: [{ stat: 'spellFrost', value: 10 }, { stat: 'resFrost', value: 10 }, { stat: 'resFire', value: -10 }], hint: 'Frostmagier: stärkere Frostzauber und Frostschutz auf Kosten des Feuerschutzes.', value: 280, minLevel: 16 }),
  // Heiler und Unterstützer
  B({ id: 'mender_staff', name: 'Linderungsstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 3, damage: [3, 6], req: { verstand: 14 }, base: [{ stat: 'maxMana', value: 16 }, { stat: 'healPower', value: 18 }, { stat: 'manaCost', value: 8 }], hint: 'Heiler: stärkere Heilung, aber teurere Zauber und kaum Schaden.', value: 90, minLevel: 6 }),
  B({ id: 'healer_rod', name: 'Heilerstab', slot: 'weapon', kind: 'staff', hands: 2, weight: 4, damage: [8, 14], req: { verstand: 26 }, base: [{ stat: 'maxMana', value: 40 }, { stat: 'healPower', value: 28 }, { stat: 'manaCost', value: 10 }], hint: 'Heiler: stärkere Heilung, aber teurere Zauber und wenig Schaden.', value: 360, minLevel: 16 }),
  B({ id: 'mender_ring', name: 'Ring der Linderung', slot: 'ring', weight: 0.5, base: [{ stat: 'healPower', value: 15 }, { stat: 'manaCost', value: 10 }], hint: 'Heiler: stärkere Heilung, Zauber kosten mehr Mana.', value: 110, minLevel: 6 }),
  B({ id: 'recovery_ring', name: 'Ring der Genesung', slot: 'ring', weight: 0.5, base: [{ stat: 'healPower', value: 25 }, { stat: 'manaCost', value: 12 }, { stat: 'maxMana', value: 20 }], hint: 'Heiler: stärkere Heilung, Zauber kosten mehr Mana.', value: 340, minLevel: 16 }),
  B({ id: 'saint_ring', name: 'Ring der Heiligen', slot: 'ring', weight: 0.5, base: [{ stat: 'healPower', value: 35 }, { stat: 'manaCost', value: 15 }, { stat: 'maxMana', value: 40 }], hint: 'Heiler: stärkere Heilung, Zauber kosten mehr Mana.', value: 1000, minLevel: 26 }),
  // Zauberdurchfluss: günstigere Zauber, weniger Leben
  B({ id: 'flow_ring', name: 'Strömungsring', slot: 'ring', weight: 0.5, base: [{ stat: 'manaCost', value: -10 }, { stat: 'maxHp', value: -20 }], hint: 'Zaubernde Builds: günstigere Zauber, aber weniger Leben.', value: 210, minLevel: 11 }),
  B({ id: 'tide_ring', name: 'Gezeitenring', slot: 'ring', weight: 0.5, base: [{ stat: 'manaCost', value: -15 }, { stat: 'maxHp', value: -40 }, { stat: 'maxMana', value: 30 }], hint: 'Zaubernde Builds: günstigere Zauber, aber deutlich weniger Leben.', value: 640, minLevel: 21 }),
  // Kontrolle und Debuff
  B({ id: 'binding_amulet', name: 'Amulett des Banns', slot: 'amulet', weight: 0.5, base: [{ stat: 'ctrl', value: 20 }, { stat: 'maxMana', value: 15 }, { stat: 'damage', value: -3 }], hint: 'Kontrolle: Betäubung, Verlangsamung und Stille wirken länger, dein Schaden sinkt.', value: 220, minLevel: 11 }),
  B({ id: 'warlock_amulet', name: 'Amulett des Zwingherrn', slot: 'amulet', weight: 0.5, base: [{ stat: 'ctrl', value: 30 }, { stat: 'maxMana', value: 30 }, { stat: 'damage', value: -6 }], hint: 'Kontrolle: Betäubung, Verlangsamung und Stille wirken länger, dein Schaden sinkt.', value: 680, minLevel: 21 }),
  // Nahkampf: Parade, Schild, Tempo
  B({ id: 'parry_blade', name: 'Parierklinge', slot: 'weapon', weight: 7, damage: [6, 10], reqKraft: 12, base: [{ stat: 'parry', value: 6 }, { stat: 'accuracy', value: -8 }], hint: 'Duellant (mit Parieren): wehrt Treffer ab, trifft aber schlechter und hat weniger Grundschaden.', value: 110, minLevel: 6 }),
  B({ id: 'duelist_blade', name: 'Duellantenklinge', slot: 'weapon', weight: 8, damage: [14, 24], reqKraft: 22, base: [{ stat: 'parry', value: 9 }, { stat: 'accuracy', value: -12 }], hint: 'Duellant (mit Parieren): wehrt Treffer ab, trifft aber schlechter und hat weniger Grundschaden.', value: 380, minLevel: 16 }),
  B({ id: 'bulwark_shield', name: 'Bollwerkschild', slot: 'offhand', off: 'shield', weight: 8, armor: 13, reqKraft: 22, base: [{ stat: 'parry', value: 5 }, { stat: 'move', value: -12 }, { stat: 'haste', value: -8 }], hint: 'Schildkämpfer: viel Rüstung und Parade, aber langsamer in Bewegung und Angriff.', value: 240, minLevel: 11 }),
  B({ id: 'tower_shield', name: 'Turmschild', slot: 'offhand', off: 'shield', weight: 12, armor: 24, reqKraft: 30, base: [{ stat: 'parry', value: 7 }, { stat: 'move', value: -15 }, { stat: 'haste', value: -10 }], hint: 'Schildkämpfer: viel Rüstung und Parade, aber langsamer in Bewegung und Angriff.', value: 720, minLevel: 21 }),
  B({ id: 'bastion_plate', name: 'Bastionspanzer', slot: 'chest', weight: 22, armor: 20, reqKraft: 26, base: [{ stat: 'move', value: -8 }, { stat: 'evasion', value: -10 }], hint: 'Schildkämpfer: sehr viel Rüstung, aber langsamer und leichter zu treffen.', value: 380, minLevel: 16 }),
  B({ id: 'windrunner_boots', name: 'Windläuferstiefel', slot: 'feet', weight: 2, armor: 2, base: [{ stat: 'move', value: 8 }, { stat: 'evasion', value: 6 }, { stat: 'resPoison', value: -6 }], hint: 'Fernkämpfer und Läufer: schneller und wendiger, aber kaum Rüstung und giftanfällig.', value: 170, minLevel: 11 }),
);

/* ------------------------------------------------ Edelsteine */

export const GEM_KINDS: GemKind[] = ['ruby', 'sapphire', 'emerald', 'topaz'];
export const GEM_NAME: Record<GemKind, string> = { ruby: 'Rubin', sapphire: 'Saphir', emerald: 'Smaragd', topaz: 'Topas' };
export const GEM_COLOR: Record<GemKind, number> = { ruby: 0xd83a4a, sapphire: 0x3a6ae0, emerald: 0x3ab060, topaz: 0xe8b830 };
const GEM_QUALITY_PREFIX = ['', 'Rissiger ', '', 'Makelloser '];
const GEM_LEVEL = [0, 8, 16, 24];
const GEM_VALUE = [0, 60, 200, 600];
/** Wirkung je Edelsteinart (Werte je Qualität 1–3): in Waffen (Offensive) und in Rüstung/Schilden. */
const GEM_WEAPON: Record<GemKind, { stat: Stat; v: [number, number, number] }> = {
  ruby: { stat: 'damage', v: [3, 6, 10] },
  sapphire: { stat: 'maxMana', v: [10, 20, 35] },
  emerald: { stat: 'haste', v: [3, 5, 8] },
  topaz: { stat: 'maxHp', v: [15, 30, 50] },
};
const GEM_ARMOR: Record<GemKind, { stat: Stat; v: [number, number, number] }> = {
  ruby: { stat: 'resFire', v: [5, 9, 14] },
  sapphire: { stat: 'resFrost', v: [5, 9, 14] },
  emerald: { stat: 'resPoison', v: [5, 9, 14] },
  topaz: { stat: 'armor', v: [2, 4, 7] },
};

export const gemTemplateId = (g: GemInfo): string => `gem_${g.kind}_${g.q}`;
export const gemName = (g: GemInfo): string => `${GEM_QUALITY_PREFIX[g.q]}${GEM_NAME[g.kind]}`;

/** Wert eines Edelsteins im Zielgegenstand (Waffe: Angriff, sonst Verteidigung). */
export function gemAffix(g: GemInfo, slot: ItemSlot): Affix {
  const d = (slot === 'weapon' ? GEM_WEAPON : GEM_ARMOR)[g.kind];
  return { stat: d.stat, value: d.v[g.q - 1]! };
}

/** Alle Affixe eines Gegenstands einschließlich der Edelsteine in seinen Sockeln. */
export function itemAffixes(i: Item): Affix[] {
  if (!i.sockets?.some(Boolean)) return i.affixes;
  return [...i.affixes, ...i.sockets.filter((g): g is GemInfo => !!g).map((g) => gemAffix(g, i.slot))];
}

for (const kind of GEM_KINDS) {
  for (const q of [1, 2, 3] as const) {
    TEMPLATES.push({ id: `gem_${kind}_${q}`, name: `${GEM_QUALITY_PREFIX[q]}${GEM_NAME[kind]}`, slot: 'gem', weight: 0.2, reqKraft: 0, gem: { kind, q }, value: GEM_VALUE[q]!, minLevel: GEM_LEVEL[q]! });
  }
}

/** Sockel: Höchstzahl je Slot (Schilde nur offhand mit `off: 'shield'`) und Verteilung nach Seltenheit (Wahrscheinlichkeit für 0, 1, 2, 3 Sockel). */
const SOCKET_MAX: Partial<Record<ItemSlot, number>> = { weapon: 3, chest: 3, head: 2, legs: 2, offhand: 2 };
const SOCKET_ODDS: Partial<Record<Rarity, number[]>> = {
  magic: [0.62, 0.28, 0.1, 0],
  rare: [0.35, 0.35, 0.2, 0.1],
  set: [0.2, 0.35, 0.3, 0.15],
  legendary: [0.1, 0.3, 0.35, 0.25],
};

export function rollSockets(rng: Rng, t: ItemTemplate, rarity: Rarity): (GemInfo | null)[] | undefined {
  const max = SOCKET_MAX[t.slot];
  const odds = SOCKET_ODDS[rarity];
  if (!max || !odds || (t.slot === 'offhand' && t.off !== 'shield')) return undefined;
  const r = rng.next();
  let acc = 0;
  let n = 0;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i]!;
    if (r < acc) {
      n = i;
      break;
    }
    n = i;
  }
  n = Math.min(n, max);
  return n > 0 ? new Array<GemInfo | null>(n).fill(null) : undefined;
}

/** Edelstein-Drop passend zur Stufe: höhere Qualität erst in höheren Gegenden. */
export function rollGem(rng: Rng, nextId: () => number, level: number, minQuality: GemQuality = 1): Item {
  const kind = GEM_KINDS[rng.int(0, GEM_KINDS.length - 1)]!;
  const r = rng.next();
  const natural: GemQuality = level >= 20 && r < 0.2 ? 3 : level >= 14 && r < 0.5 ? 2 : 1;
  // Mindestqualität (Weltbosse): Stufe 3 weiter möglich, wenn die Gegend hoch genug ist
  const q: GemQuality = minQuality > natural ? (level >= 20 && rng.next() < 0.35 ? 3 : minQuality) : natural;
  return generateItem(rng, nextId(), `gem_${kind}_${q}`, 'normal');
}

/* ------------------------------------------------ Affixe, Stufen und Namen */

interface AffixDef {
  stat: Stat;
  /** Suffix ("des Zorns") */
  name: string;
  /** Präfix-Stamm; je nach Geschlecht des Gegenstands kommt er/e/es dazu ("Scharf" → "Scharfes") */
  pre: string;
  min: number;
  max: number;
}

const AFFIXES: AffixDef[] = [
  { stat: 'damage', name: 'des Zorns', pre: 'Scharf', min: 1, max: 4 },
  { stat: 'armor', name: 'der Härte', pre: 'Gehärtet', min: 1, max: 3 },
  { stat: 'maxHp', name: 'der Zähigkeit', pre: 'Zäh', min: 5, max: 20 },
  { stat: 'kraft', name: 'der Stärke', pre: 'Kräftig', min: 1, max: 3 },
  { stat: 'maxMana', name: 'der Weisheit', pre: 'Weis', min: 3, max: 10 },
  { stat: 'haste', name: 'der Eile', pre: 'Flink', min: 2, max: 5 },
  { stat: 'crit', name: 'der Präzision', pre: 'Präzis', min: 1, max: 3 },
  { stat: 'regen', name: 'der Erneuerung', pre: 'Belebend', min: 1, max: 2 },
  { stat: 'accuracy', name: 'des Treffers', pre: 'Treffsicher', min: 3, max: 8 },
  { stat: 'evasion', name: 'der Behändigkeit', pre: 'Behänd', min: 3, max: 8 },
  { stat: 'resFire', name: 'des Feuerschutzes', pre: 'Glutfest', min: 4, max: 9 },
  { stat: 'resFrost', name: 'des Frostschutzes', pre: 'Frostfest', min: 4, max: 9 },
  { stat: 'resPoison', name: 'des Giftschutzes', pre: 'Giftfest', min: 4, max: 9 },
];

/** Affix-Stufen T1–T5: Wahrscheinlichkeit und Faktor auf die Spannweite (T5 selten, bester Bereich). */
export const TIER_CHANCE = [0.4, 0.28, 0.18, 0.1, 0.04];
export const TIER_MULT = [0.6, 0.9, 1.15, 1.35, 1.5];
export const TIER_COLOR = ['#9a8a78', '#c9c4bd', '#7f9fff', '#c77fff', '#ffd23a'];

export function rollTier(rng: Rng): number {
  const r = rng.next();
  let acc = 0;
  for (let i = 0; i < TIER_CHANCE.length; i++) {
    acc += TIER_CHANCE[i]!;
    if (r < acc) return i + 1;
  }
  return TIER_CHANCE.length;
}

const RARITY_VALUE: Record<Rarity, number> = { normal: 1, magic: 3, rare: 8, set: 14, legendary: 25 };
const RARITY_AFFIXES: Record<Rarity, [number, number]> = { normal: [0, 0], magic: [1, 2], rare: [3, 4], set: [0, 0], legendary: [0, 0] };

/** Anforderungen eines Gegenstands: Stufe aus minLevel, Kraft aus reqKraft, schwere Rüstung/Waffen verlangen zusätzlich Ausdauer/Gewandtheit. */
export function reqOfTemplate(t: ItemTemplate): Req {
  const r: Req = { level: Math.max(1, t.minLevel - 1), ...t.req };
  if (t.reqKraft > 0) r.kraft = t.reqKraft;
  if (t.slot !== 'potion' && t.slot !== 'gem' && t.slot !== 'ring' && t.slot !== 'amulet' && t.reqKraft >= 14) {
    if (t.slot === 'weapon' && r.gewandtheit === undefined) r.gewandtheit = Math.round(t.reqKraft * ((t.speed ?? 1) < 1 ? 0.7 : 0.4)); // leichte, schnelle Waffen (Dolche) verlangen mehr Gewandtheit
    else if (t.slot !== 'weapon' && r.ausdauer === undefined) r.ausdauer = Math.round(t.reqKraft * 0.55);
  }
  // Stäbe: neben Verstand etwas Willenskraft (Konzentration)
  if (t.kind === 'staff' && (r.verstand ?? 0) >= 14 && r.willenskraft === undefined) r.willenskraft = Math.round(r.verstand! * 0.4);
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

/** Hände einer Waffe (Altgegenstände ohne Feld: aus der Vorlage; Bögen und Stäbe sind zweihändig). */
export function handsOf(i: Item): 1 | 2 {
  if (i.slot !== 'weapon') return 1;
  if (i.hands) return i.hands;
  const t = TEMPLATES.find((x) => x.id === i.templateId);
  return t?.hands ?? (i.kind === 'bow' || i.kind === 'staff' ? 2 : 1);
}

/** Multiplikator auf das Angriffsintervall der Waffe (1 = normal). */
export function weaponSpeedOf(i: Item): number {
  if (i.slot !== 'weapon') return 1;
  return i.speed ?? TEMPLATES.find((x) => x.id === i.templateId)?.speed ?? 1;
}

/** Stufenskalierung je Affixart: Tempo/Kritisch/Regeneration wachsen nur sanft (sonst wären Vollausrüstungen unverwundbar). */
function affixScale(stat: Stat, minLevel: number): number {
  if (stat === 'haste' || stat === 'crit' || stat === 'regen' || stat === 'resFire' || stat === 'resFrost' || stat === 'resPoison') return 1 + minLevel / 30;
  if (stat === 'kraft') return 1 + minLevel / 20;
  return 1 + minLevel / 8;
}

/** Wertebereich eines Affixes für einen Gegenstand dieser Stufe und Affix-Stufe (ohne Stufe: Mittelwert-Faktor 1). */
export function affixRange(stat: Stat, minLevel: number, tier?: number): [number, number] {
  const d = AFFIXES.find((a) => a.stat === stat);
  if (!d) return [1, 1];
  const f = affixScale(stat, minLevel) * (tier ? TIER_MULT[tier - 1]! : 1);
  const lo = Math.max(1, Math.round(d.min * f));
  return [lo, Math.max(lo, Math.round(d.max * f))];
}

function rollAffix(rng: Rng, pool: AffixDef[], minLevel: number): Affix {
  const def = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
  const tier = rollTier(rng);
  const [lo, hi] = affixRange(def.stat, minLevel, tier);
  return { stat: def.stat, value: rng.int(lo, hi), tier };
}

export type Gender = 'm' | 'f' | 'n' | 'p';
const GENDER_ENDINGS: [string, Gender][] = [
  ['schwert', 'n'], ['wams', 'n'], ['hemd', 'n'], ['leder', 'n'], ['visier', 'n'], ['amulett', 'n'], ['schild', 'm'],
  ['axt', 'f'], ['keule', 'f'], ['klinge', 'f'], ['robe', 'f'], ['kappe', 'f'], ['hose', 'f'],
  ['handschuhe', 'p'], ['stulpen', 'p'], ['fäuste', 'p'], ['schreiter', 'p'], ['schienen', 'p'], ['stiefel', 'p'], ['beinlinge', 'p'], ['pfeile', 'p'],
];
/** Grammatisches Geschlecht des Gegenstandsnamens (für Adjektiv-Endungen); Standard männlich. */
export function genderOf(name: string): Gender {
  const n = name.toLowerCase();
  return GENDER_ENDINGS.find(([e]) => n.endsWith(e))?.[1] ?? 'm';
}
const ADJ_END: Record<Gender, string> = { m: 'er', f: 'e', n: 'es', p: 'e' };

const RARE_FIRST = ['Aschen', 'Grabes', 'Blut', 'Schatten', 'Frost', 'Glut', 'Nacht', 'Sturm', 'Knochen', 'Gift', 'Donner', 'Raben', 'Wolfs', 'Schädel', 'Drachen', 'Geister', 'Todes', 'Dornen', 'Eisen', 'Seelen', 'Nebel', 'Moor', 'Zorn', 'Rachen'];
const RARE_SECOND: Partial<Record<ItemSlot, string[]>> = {
  weapon: ['biss', 'zahn', 'spalter', 'schnitt', 'hieb', 'dorn', 'fang', 'kralle', 'splitter', 'bote'],
  head: ['wacht', 'schirm', 'krone', 'blick', 'haube', 'mal'],
  chest: ['wall', 'haut', 'schale', 'herz', 'panzer', 'mantel'],
  hands: ['griff', 'faust', 'klaue', 'umklammerung', 'schwur'],
  feet: ['tritt', 'schritt', 'pfad', 'sohle', 'lauf'],
  ring: ['schwur', 'funke', 'siegel', 'reif', 'band'],
  amulet: ['auge', 'herz', 'träne', 'zeichen', 'splitter'],
  offhand: ['wall', 'schutz', 'bollwerk', 'wacht', 'trutz'],
  belt: ['band', 'bund', 'kette', 'schnalle'],
  cloak: ['schleier', 'schwinge', 'fetzen', 'schatten', 'hülle'],
  legs: ['wehr', 'pfad', 'schutz', 'wacht'],
};

/** Zufälliger zusammengesetzter Fantasiename für seltene Gegenstände ("Aschenbiss", "Grabeskralle"). */
export function rareName(rng: Rng, slot: ItemSlot): string {
  const first = RARE_FIRST[rng.int(0, RARE_FIRST.length - 1)]!;
  const seconds = RARE_SECOND[slot] ?? RARE_SECOND.weapon!;
  const second = seconds[rng.int(0, seconds.length - 1)]!;
  return first + second;
}

/** Name nach Seltenheit: normal = Vorlage; magisch = Präfix (1. Affix) und/oder Suffix (2. Affix); selten = Fantasiename. */
export function nameItem(rng: Rng, t: ItemTemplate, rarity: Rarity, rolled: Affix[]): string {
  if (rarity === 'rare') return rareName(rng, t.slot);
  if (!rolled.length) return t.name;
  const pre = AFFIXES.find((a) => a.stat === rolled[0]!.stat)!;
  const suf = rolled[1] ? AFFIXES.find((a) => a.stat === rolled[1]!.stat)! : undefined;
  return `${pre.pre}${ADJ_END[genderOf(t.name)]} ${t.name}${suf ? ` ${suf.name}` : ''}`;
}

export function rollRarity(rng: Rng): Rarity {
  const r = rng.next();
  return r < 0.05 ? 'rare' : r < 0.3 ? 'magic' : 'normal';
}

export function generateItem(rng: Rng, id: number, templateId: string, rarityIn: Rarity): Item {
  const t = templateById(templateId);
  const rarity: Rarity = t.slot === 'potion' || t.slot === 'gem' || t.off === 'arrows' ? 'normal' : rarityIn;
  const [lo, hi] = RARITY_AFFIXES[rarity];
  const count = rng.int(lo, hi);
  const pool = [...AFFIXES];
  const affixes: Affix[] = (t.base ?? []).map((a) => ({ ...a }));
  for (let i = 0; i < count && pool.length; i++) affixes.push(rollAffix(rng, pool, t.minLevel));
  const rolled = affixes.slice((t.base ?? []).length);
  const name = nameItem(rng, t, rarity, rolled);
  const sockets = rollSockets(rng, t, rarity);
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
    ...(t.town ? { town: t.town } : {}),
    reqKraft: t.reqKraft,
    req: t.slot === 'potion' || t.slot === 'gem' ? undefined : reqOfTemplate(t),
    kind: t.kind,
    hands: t.hands,
    speed: t.speed,
    off: t.off,
    arrowBonus: t.arrowBonus,
    value: t.value * RARITY_VALUE[rarity] + (affixes.length) * 8,
    affixes,
    ...(sockets ? { sockets } : {}),
    ...(t.gem ? { gem: { ...t.gem } } : {}),
  };
}

/** `weaponShare` (0–1): Wahrscheinlichkeit, dass Waffen überhaupt im Wurf-Pool sind. Waffen kauft man beim Händler; Beute bringt vor allem Rüstung und Schmuck, Boss-Waffen kommen aus `rollSpecial`. */
export function rollDrop(rng: Rng, nextId: () => number, monsterLevel: number, forceRarity?: Rarity, weaponShare = 1): Item {
  const noWeapons = weaponShare < 1 && rng.next() >= weaponShare;
  const pool = TEMPLATES.filter((t) => t.slot !== 'potion' && t.slot !== 'gem' && !(noWeapons && t.slot === 'weapon') && (!forceRarity || t.off !== 'arrows') && t.minLevel <= monsterLevel && t.minLevel >= monsterLevel - 8);
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
  { id: 'abyss_edge', name: 'Schneide des Abgrunds', base: 'ash_saber', minLevel: 28, affixes: [{ stat: 'damage', min: 14, max: 18 }, { stat: 'haste', min: 4, max: 6 }], power: { id: 'lifesteal', value: 7 } },
  { id: 'warden_aegis', name: 'Ägide des Wächters', base: 'ash_shield', minLevel: 28, affixes: [{ stat: 'armor', min: 10, max: 14 }, { stat: 'maxHp', min: 90, max: 130 }], power: { id: 'thorns', value: 30 } },
  { id: 'ash_crown', name: 'Aschenkrone', base: 'ash_visor', minLevel: 26, affixes: [{ stat: 'armor', min: 8, max: 12 }, { stat: 'maxHp', min: 100, max: 150 }], power: { id: 'xpBonus', value: 15 }, source: 'ash_king' },
  { id: 'reaper_axe', name: 'Henkersbeil', base: 'cinder_axe', minLevel: 13, affixes: [{ stat: 'damage', min: 8, max: 11 }], power: { id: 'execute', value: 25 } },
  { id: 'frost_tooth', name: 'Frostzahn', base: 'steel_sword', minLevel: 14, affixes: [{ stat: 'damage', min: 6, max: 9 }, { stat: 'resFrost', min: 8, max: 12 }], power: { id: 'frostHit', value: 25 } },
  { id: 'soul_band', name: 'Seelenband', base: 'ember_ring', minLevel: 12, affixes: [{ stat: 'maxHp', min: 25, max: 40 }, { stat: 'damage', min: 2, max: 4 }], power: { id: 'healKill', value: 8 } },
  { id: 'ash_fang', name: 'Aschenfang', base: 'war_blade', minLevel: 18, affixes: [{ stat: 'damage', min: 9, max: 13 }, { stat: 'resFire', min: 8, max: 12 }], power: { id: 'burnHit', value: 22 } },
  { id: 'grave_seal', name: 'Siegel der Grabwacht', base: 'silver_ring', minLevel: 20, affixes: [{ stat: 'maxMana', min: 25, max: 35 }, { stat: 'maxHp', min: 30, max: 50 }], power: { id: 'healKill', value: 14 } },
  { id: 'harvest_saber', name: 'Schnitter', base: 'ash_saber', minLevel: 28, affixes: [{ stat: 'damage', min: 15, max: 20 }, { stat: 'crit', min: 3, max: 5 }], power: { id: 'execute', value: 40 } },
  { id: 'nagezahn', name: 'Nagezahn', base: 'iron_dagger', minLevel: 3, affixes: [{ stat: 'damage', min: 2, max: 3 }, { stat: 'haste', min: 2, max: 3 }], power: { id: 'goldBonus', value: 20 }, source: 'rat_king' },
  { id: 'fleckenzahn', name: 'Fleckenzahn', base: 'bone_club', minLevel: 4, affixes: [{ stat: 'damage', min: 3, max: 4 }, { stat: 'maxHp', min: 10, max: 15 }], power: { id: 'lifesteal', value: 3 }, source: 'spotted_beast' },
  { id: 'grix_hackebeil', name: 'Grix\' Hackebeil', base: 'battle_axe', minLevel: 10, affixes: [{ stat: 'damage', min: 6, max: 9 }, { stat: 'kraft', min: 1, max: 2 }], power: { id: 'crit', value: 12 }, source: 'goblin_king' },
  { id: 'brakk_stab', name: 'Brakks Knochenstab', base: 'bone_staff', minLevel: 10, affixes: [{ stat: 'maxMana', min: 30, max: 40 }, { stat: 'spellFire', min: 10, max: 14 }], power: { id: 'manaKill', value: 5 }, source: 'goblin_shaman_brakk' },
  { id: 'zischel_bogen', name: 'Zischels Giftbogen', base: 'yew_bow', minLevel: 9, affixes: [{ stat: 'damage', min: 5, max: 7 }, { stat: 'accuracy', min: 6, max: 9 }], power: { id: 'lifesteal', value: 4 }, source: 'venom_mother' },
  { id: 'kolm_hammer', name: 'Kolms Streithammer', base: 'war_hammer', minLevel: 12, affixes: [{ stat: 'damage', min: 8, max: 11 }, { stat: 'kraft', min: 2, max: 3 }], power: { id: 'execute', value: 20 }, source: 'captain_kolm' },
  { id: 'gluck_keule', name: 'Glucks Moorkeule', base: 'war_hammer', minLevel: 14, affixes: [{ stat: 'damage', min: 9, max: 12 }, { stat: 'maxHp', min: 30, max: 45 }], power: { id: 'thorns', value: 12 }, source: 'bog_brute' },
  { id: 'irva_stab', name: 'Irvas Hexenstab', base: 'crystal_staff', minLevel: 14, affixes: [{ stat: 'maxMana', min: 40, max: 55 }, { stat: 'spellFrost', min: 12, max: 16 }], power: { id: 'frostHit', value: 25 }, source: 'hexmaster_irva' },
  { id: 'morrik_zepter', name: 'Morriks Knochenzepter', base: 'bone_staff', minLevel: 14, affixes: [{ stat: 'maxMana', min: 35, max: 50 }, { stat: 'healPower', min: 10, max: 15 }], power: { id: 'healKill', value: 10 }, source: 'bone_lord' },
  { id: 'veshra_dorn', name: 'Veshras Dorn', base: 'steel_dagger', minLevel: 16, affixes: [{ stat: 'damage', min: 8, max: 11 }, { stat: 'haste', min: 4, max: 6 }], power: { id: 'lifesteal', value: 7 }, source: 'bog_queen' },
  { id: 'ormund_schwert', name: 'Ormunds Grabschwert', base: 'war_blade', minLevel: 16, affixes: [{ stat: 'damage', min: 10, max: 14 }, { stat: 'armor', min: 3, max: 5 }], power: { id: 'execute', value: 30 }, source: 'crypt_ormund' },
  { id: 'sael_floestern', name: 'Saels Flüstern', base: 'bone_dagger', minLevel: 17, affixes: [{ stat: 'damage', min: 10, max: 14 }, { stat: 'crit', min: 3, max: 5 }], power: { id: 'frostHit', value: 30 }, source: 'ghost_lord_sael' },
  { id: 'drogg_keule', name: 'Droggs Trollkeule', base: 'great_axe', minLevel: 17, affixes: [{ stat: 'damage', min: 12, max: 16 }, { stat: 'maxHp', min: 50, max: 70 }], power: { id: 'lifesteal', value: 5 }, source: 'troll_chief_drogg' },
  { id: 'fenrik_reisszahn', name: 'Fenriks Reißzahn', base: 'bone_dagger', minLevel: 17, affixes: [{ stat: 'damage', min: 9, max: 13 }, { stat: 'evasion', min: 6, max: 9 }], power: { id: 'crit', value: 14 }, source: 'alpha_fenrik' },
  { id: 'vyrra_netz', name: 'Netzspanner', base: 'war_bow', minLevel: 18, affixes: [{ stat: 'damage', min: 12, max: 16 }, { stat: 'accuracy', min: 8, max: 12 }], power: { id: 'frostHit', value: 22 }, source: 'spider_queen' },
  { id: 'koloss_brecher', name: 'Kolossbrecher', base: 'doom_hammer', minLevel: 20, affixes: [{ stat: 'damage', min: 18, max: 24 }, { stat: 'kraft', min: 3, max: 5 }], power: { id: 'thorns', value: 15 }, source: 'stone_colossus' },
  { id: 'skarra_stab', name: 'Skarras Seidenstab', base: 'cinder_staff', minLevel: 23, affixes: [{ stat: 'maxMana', min: 60, max: 80 }, { stat: 'spellFrost', min: 15, max: 20 }], power: { id: 'manaKill', value: 9 }, source: 'web_mother' },
  { id: 'zarkesh_klinge', name: 'Zarkeshs Glutklinge', base: 'dread_blade', minLevel: 25, affixes: [{ stat: 'damage', min: 16, max: 22 }, { stat: 'resFire', min: 10, max: 14 }], power: { id: 'burnHit', value: 30 }, source: 'cinder_lord_zarkesh' },
  { id: 'valdor_schreckensklinge', name: 'Valdors Schreckensklinge', base: 'dread_cleaver', minLevel: 25, affixes: [{ stat: 'damage', min: 20, max: 26 }, { stat: 'crit', min: 3, max: 5 }], power: { id: 'execute', value: 45 }, source: 'dread_valdor' },
  { id: 'gurrak_zahn', name: 'Gurraks Moorzahn', base: 'dread_cleaver', minLevel: 26, affixes: [{ stat: 'damage', min: 20, max: 27 }, { stat: 'maxHp', min: 60, max: 90 }], power: { id: 'lifesteal', value: 8 }, source: 'bog_titan' },
  { id: 'thurgrim_hammer', name: 'Thurgrims Bergbrecher', base: 'doom_hammer', minLevel: 28, affixes: [{ stat: 'damage', min: 24, max: 32 }, { stat: 'kraft', min: 4, max: 6 }], power: { id: 'thorns', value: 22 }, source: 'mountain_king' },
  { id: 'morvath_urteil', name: 'Morvaths Urteil', base: 'ash_greatsword', minLevel: 32, affixes: [{ stat: 'damage', min: 28, max: 38 }, { stat: 'kraft', min: 5, max: 8 }], power: { id: 'lifesteal', value: 10 }, source: 'abyss_warden' },
  { id: 'aschenkoenig_bogen', name: 'Todesschwinge', base: 'ash_bow', minLevel: 30, affixes: [{ stat: 'damage', min: 20, max: 26 }, { stat: 'crit', min: 4, max: 6 }, { stat: 'accuracy', min: 10, max: 14 }], power: { id: 'execute', value: 35 }, source: 'ash_king' },
  { id: 'aschenkoenig_zepter', name: 'Zepter der Asche', base: 'void_staff', minLevel: 30, affixes: [{ stat: 'maxMana', min: 90, max: 120 }, { stat: 'spellFire', min: 20, max: 26 }], power: { id: 'manaKill', value: 14 }, source: 'ash_king' },
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
  const sockets = rollSockets(rng, t, 'legendary');
  return {
    id, templateId: d.base, name: d.name, slot: t.slot, rarity: 'legendary', weight: t.weight,
    damage: t.damage ? [...t.damage] : undefined, armor: t.armor, reqKraft: t.reqKraft, req: reqOfTemplate(t), kind: t.kind, hands: t.hands, speed: t.speed,
    value: t.value * RARITY_VALUE.legendary + 100, affixes, power: { ...d.power }, unique: d.id,
    ...(sockets ? { sockets } : {}),
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
  const sockets = rollSockets(rng, t, 'set');
  return {
    id, templateId: piece.base, name: piece.name, slot: t.slot, rarity: 'set', weight: t.weight,
    damage: t.damage ? [...t.damage] : undefined, armor: t.armor, reqKraft: t.reqKraft, req: reqOfTemplate(t), kind: t.kind, hands: t.hands, speed: t.speed,
    value: t.value * RARITY_VALUE.set, affixes: piece.affixes.map((a) => ({ ...a })), setId,
    ...(sockets ? { sockets } : {}),
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
  item.name = nameItem(rng, t, rarity, rolled);
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

/** Mini-Boss-Beute: oft ein Unikat oder Set-Teil passend zur Stufe. */
export function rollUniqueSpecial(rng: Rng, nextId: () => number, level: number): Item | null {
  const r = rng.next();
  if (r < 0.3) {
    const pool = LEGENDARIES.filter((d) => !d.source && d.minLevel <= level + 2 && d.minLevel >= level - 10);
    if (pool.length) return generateLegendary(rng, nextId(), pool[rng.int(0, pool.length - 1)]!.id);
  } else if (r < 0.6) {
    const sets = SETS.filter((d) => d.minLevel <= level + 2 && d.minLevel >= level - 10);
    if (sets.length) {
      const set = sets[rng.int(0, sets.length - 1)]!;
      return generateSetPiece(rng, nextId(), set.id, rng.int(0, set.pieces.length - 1));
    }
  }
  return null;
}

/** Hebt alle gewürfelten Affixe eines Gegenstands auf mindestens Stufe `minTier` (Weltboss-Beute); T5 bleibt möglich. */
export function boostAffixTiers(rng: Rng, item: Item, minTier: number): void {
  if (item.slot === 'potion' || item.slot === 'gem') return;
  const t = templateById(item.templateId);
  const base = t.base?.length ?? 0;
  for (let i = base; i < item.affixes.length; i++) {
    const a = item.affixes[i]!;
    if ((a.tier ?? 0) >= minTier) continue;
    const tier = rng.next() < 0.35 ? 5 : minTier;
    const [lo, hi] = affixRange(a.stat, t.minLevel, tier);
    item.value += 6 * (tier - (a.tier ?? 1));
    item.affixes[i] = { stat: a.stat, value: rng.int(lo, hi), tier };
  }
}

/** Weltboss-Ausrüstung: seltenes Stück mit hohen Affix-Stufen. */
export function rollWorldDrop(rng: Rng, nextId: () => number, level: number, minTier: number): Item {
  const it = rollDrop(rng, nextId, level, 'rare');
  boostAffixTiers(rng, it, minTier);
  return it;
}

/** Weltboss-Sonderdrop: Unikat oder Set-Teil passend zur Stufe (60 %), sonst nichts. */
export function rollWorldSpecial(rng: Rng, nextId: () => number, level: number): Item | null {
  if (rng.next() < 0.4) return null;
  const pool = LEGENDARIES.filter((d) => !d.source && d.minLevel <= level + 3 && d.minLevel >= level - 10);
  if (pool.length && rng.next() < 0.6) return generateLegendary(rng, nextId(), pool[rng.int(0, pool.length - 1)]!.id);
  const sets = SETS.filter((d) => d.minLevel <= level + 3 && d.minLevel >= level - 10);
  if (!sets.length) return pool.length ? generateLegendary(rng, nextId(), pool[rng.int(0, pool.length - 1)]!.id) : null;
  const set = sets[rng.int(0, sets.length - 1)]!;
  return generateSetPiece(rng, nextId(), set.id, rng.int(0, set.pieces.length - 1));
}
