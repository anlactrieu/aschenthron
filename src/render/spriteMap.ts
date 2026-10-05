/**
 * Zuordnung Spiel-IDs → Sprites aus „Dungeon Crawl 32x32 Tiles“ (Dungeon Crawl Stone Soup, CC0, siehe ASSETS.md).
 * Alle Pfade relativ zu `public/assets/dcss/` und spiegeln die Ordner des Originalpakets.
 * `scripts/import_dcss.py` liest die Pfade (alles, was auf `.png` endet) aus dieser Datei und kopiert genau diese Dateien.
 * Fehlt ein Eintrag (oder die Datei), greift die prozedurale Grafik in icons.ts/art.ts.
 */

/** Vergrößerung der 32×32-Sprites in der Welt (ganzzahlig, damit die Pixel gleich groß bleiben). */
export const SPRITE_SCALE = { normal: 2, boss: 3, chest: 2 };

export interface MonsterSprite {
  file: string;
  /** Vergrößerung (Standard 2, Bosse 3) */
  scale?: number;
  /** Multiplikative Färbung (0xRRGGBB), z. B. dunkle Variante eines Wolfs */
  tint?: number;
}

const m = (file: string, tint?: number, scale?: number): MonsterSprite => ({ file: `monster/${file}.png`, tint, scale });

/** Monster-ID → Sprite. Bosse nutzen dieselbe Datei, nur größer. */
export const MONSTER_SPRITES: Record<string, MonsterSprite> = {
  // Ratten, Hunde, Wölfe
  field_rat: m('animals/grey_rat'),
  burrow_rat: m('animals/green_rat'),
  giant_rat: m('animals/orange_rat', undefined, 3),
  wild_hound: m('animals/jackal_new'),
  feral_hound: m('animals/hound'),
  wolf: m('animals/wolf'),
  dire_wolf: m('animals/warg'),
  shadow_wolf: m('animals/wolf', 0x7a7ab8),
  night_stalker: m('animals/war_dog', 0x8a8ac0),
  // Goblins
  goblin: m('goblin_new'),
  goblin_scout: m('hobgoblin_new'),
  goblin_warrior: m('orc_warrior_new'),
  goblin_shaman: m('orc_wizard_new'),
  goblin_archer: m('deep_elf_master_archer'),
  goblin_chief: m('orc_knight_new'),
  goblin_brute: m('ogre_new'),
  goblin_warlord: m('orc_warlord'),
  // Banditen
  bandit_novice: m('human_new'),
  highwayman: m('unique/maurice_new'),
  bandit_archer: m('elf_new'),
  bandit: m('unique/edmund_new'),
  bandit_captain: m('unique/donald_new'),
  // Spinnen
  forest_spider: m('animals/spider'),
  venom_spider: m('animals/redback_new'),
  giant_spider: m('animals/wolf_spider_new'),
  cave_spider: m('animals/trapdoor_spider_new'),
  brood_spider: m('animals/jumping_spider_new'),
  web_stalker: m('animals/tarantella_new'),
  nest_matron: m('animals/orb_spider', 0xd8a8d8),
  // Sumpf
  bog_ghoul: m('undead/ghoul'),
  marsh_corpse: m('undead/bog_body'),
  bog_witch: m('enchantress_human'),
  ghoul_alpha: m('undead/rotting_hulk_new'),
  // Untote
  skeleton: m('undead/skeletons/skeleton_humanoid_small_new'),
  wraith: m('undead/wraith'),
  bone_acolyte: m('undead/mummy_priest'),
  zombie: m('undead/zombies/zombie_small'),
  bone_knight: m('undead/skeletal_warrior_new'),
  necromancer: m('necromancer_new'),
  crypt_guard: m('undead/guardian_mummy'),
  death_knight: m('death_knight'),
  // Trolle und Golems
  hill_troll: m('troll'),
  stone_golem: m('nonliving/stone_golem'),
  rock_troll: m('rock_troll'),
  iron_golem: m('nonliving/iron_golem'),
  // Würmer
  pit_worm: m('animals/rock_worm'),
  acid_worm: m('animals/giant_centipede', 0xb8e060),
  // Asche und Feuer
  ash_walker: m('human_old', 0xa89890),
  cinder_wisp: m('nonliving/orb_of_fire_new'),
  ember_elemental: m('nonliving/fire_elemental_new'),
  imp: m('demons/imp'),
  hell_spawn: m('demonspawn/infernal'),
  hell_hound: m('animals/hell_hound_new'),
  doom_knight: m('hell_knight_new'),
  pit_fiend: m('demons/pit_fiend'),
  // Bosse
  goblin_king: m('unique/blork_the_orc_new'),
  bandit_lord: m('unique/sigmund_new'),
  bone_lord: m('undead/lich'),
  bog_queen: m('unique/erolcha_new'),
  stone_colossus: m('stone_giant_new'),
  spider_queen: m('animals/orb_spider', 0xc060a8),
  web_mother: m('animals/tarantella_new', 0xc080d0),
  ash_king: m('demons/balrug_new'),
};

/** NPC-Sprites: erst nach Name, dann nach Art (Händler, Lehrer, Schmied, Truhe, Questgeber). */
export const NPC_NAME_SPRITES: Record<string, string> = {
  'Lehrer Varn': 'monster/wizard.png',
  'Meisterin Kjorra': 'monster/unique/agnes_new.png',
  'Händlerin Mirel': 'monster/unique/margery_new.png',
  'Händler Dorn': 'monster/dwarf_new.png',
  'Schmiedin Ilse': 'monster/unique/maud_new.png',
  'Schmied Torgal': 'monster/deep_dwarf_berserker.png',
  'Hauptmann Brandt': 'monster/unique/donald_new.png',
  'Kräuterfrau Odda': 'monster/unique/josephine_new.png',
  'Wachführerin Tessa': 'monster/unique/jessica_new.png',
  'Späher Ruven': 'monster/unique/maurice_new.png',
  'Chronistin Maren': 'monster/unique/erica_new.png',
  'Torwache Haldor': 'monster/unique/frederick_new.png',
  'Jägerin Ysa': 'monster/unique/psyche_new.png',
  'Eremit Olm': 'monster/unique/harold.png',
  'Schatzsucher Pell': 'monster/unique/joseph_new.png',
  'Ritter Aldric': 'monster/holy/paladin.png',
};
export const NPC_KIND_SPRITES: Record<string, string> = {
  trainer: 'monster/wizard.png',
  merchant: 'monster/unique/margery_new.png',
  smith: 'monster/dwarf_new.png',
  quest: 'monster/human_new.png',
  stash: 'dungeon/chest.png',
};

export function npcSpriteFile(kind: string, name?: string): string | undefined {
  return (name ? NPC_NAME_SPRITES[name] : undefined) ?? NPC_KIND_SPRITES[kind];
}

/** Truhen (Welt): Holz = braune Truhe, Gold = goldene, Eisen = gefärbte braune. */
export const CHEST_SPRITES: Record<'wood' | 'iron' | 'gold', { closed: string; open: string; tint?: number }> = {
  wood: { closed: 'dungeon/chest_2_closed.png', open: 'dungeon/chest_2_open.png' },
  iron: { closed: 'dungeon/chest_2_closed.png', open: 'dungeon/chest_2_open.png', tint: 0x9aa8c8 },
  gold: { closed: 'dungeon/chest.png', open: 'dungeon/chest_2_open.png', tint: 0xffe070 },
};

const IT = (p: string) => `item/${p}.png`;

/** Item-Vorlage (templateId) → Icon. Gürtel, Beinlinge und Edelsteine haben im Paket kein passendes Bild (prozeduraler Fallback). */
export const ITEM_SPRITES: Record<string, string> = {
  // Einhandwaffen
  rusty_sword: IT('weapon/short_sword_1_new'),
  bone_club: IT('weapon/club_new'),
  steel_sword: IT('weapon/long_sword_1_new'),
  cinder_axe: IT('weapon/war_axe_1'),
  war_blade: IT('weapon/falchion_1_new'),
  dread_blade: IT('weapon/demon_blade'),
  ash_saber: IT('weapon/sabre_2'),
  iron_dagger: IT('weapon/dagger_new'),
  steel_dagger: IT('weapon/elven_dagger'),
  bone_dagger: IT('weapon/orcish_dagger'),
  ash_dagger: IT('weapon/dagger_7'),
  // Zweihandwaffen
  doom_hammer: IT('weapon/hammer_3'),
  ash_greatsword: IT('weapon/greatsword_1_new'),
  woodcutter_axe: IT('weapon/axe'),
  battle_axe: IT('weapon/battle_axe_1'),
  claymore: IT('weapon/claymore'),
  war_hammer: IT('weapon/war_hammer'),
  great_axe: IT('weapon/broad_axe_1'),
  dread_cleaver: IT('weapon/executioner_axe_2_new'),
  // Bögen, Stäbe, Pfeile
  hunt_bow: IT('weapon/ranged/shortbow_1'),
  yew_bow: IT('weapon/ranged/bow_1'),
  horn_bow: IT('weapon/ranged/bow_2'),
  war_bow: IT('weapon/ranged/longbow_1'),
  dread_bow: IT('weapon/ranged/longbow_2'),
  ash_bow: IT('weapon/ranged/longbow_3'),
  twig_staff: IT('staff/staff_0'),
  oak_staff: IT('staff/staff_1'),
  bone_staff: IT('staff/staff_2'),
  crystal_staff: IT('staff/staff_3'),
  cinder_staff: IT('staff/staff_4'),
  void_staff: IT('staff/staff_5'),
  wood_arrows: IT('weapon/ranged/elven_arrow'),
  iron_arrows: IT('weapon/ranged/orcish_arrow'),
  steel_arrows: IT('weapon/ranged/silver_arrow'),
  ember_arrows: IT('weapon/ranged/needle-c'),
  ash_arrows: IT('weapon/ranged/sling_bullet_1_new'),
  // Schilde
  wood_shield: IT('armor/shields/buckler_1_new'),
  iron_shield: IT('armor/shields/shield_2_new'),
  steel_shield: IT('armor/shields/large_shield_1_new'),
  bone_shield: IT('armor/shields/large_shield_2_new'),
  dread_shield: IT('armor/shields/large_shield_3_new'),
  ash_shield: IT('armor/shields/lshield_dd_dk'),
  // Helme
  leather_cap: IT('armor/headgear/cap_1'),
  iron_helm: IT('armor/headgear/helmet_1'),
  warden_helm: IT('armor/headgear/helmet_2'),
  crown_helm: IT('armor/headgear/plumed_helmet'),
  dread_helm: IT('armor/headgear/helmet_4'),
  ash_visor: IT('armor/headgear/helmet_4_visor'),
  // Rüstungen, Roben, Lederwämser
  ash_mail: IT('armor/torso/ring_mail_1_new'),
  plate_cuirass: IT('armor/torso/plate_mail_1'),
  bone_plate: IT('armor/torso/splint_mail_1'),
  dread_mail: IT('armor/torso/banded_mail_1'),
  ash_cuirass: IT('armor/torso/plate_mail_2'),
  cloth_robe: IT('armor/torso/robe_1_new'),
  acolyte_robe: IT('armor/torso/robe_2_new'),
  bone_robe: IT('armor/torso/robe_3'),
  dread_robe: IT('armor/torso/robe_ego_1'),
  ash_robe: IT('armor/torso/robe_art_1'),
  leather_vest: IT('armor/torso/leather_armor_1'),
  hunter_vest: IT('armor/torso/leather_armor_2'),
  bone_leather: IT('armor/torso/studded_leather_armor'),
  dread_leather: IT('armor/torso/troll_leather_armor'),
  ash_leather: IT('armor/torso/leather_armor_3'),
  // Handschuhe, Stiefel, Umhänge
  worn_gloves: IT('armor/hands/glove_1_new'),
  iron_gauntlets: IT('armor/hands/glove_4_gauntlets'),
  ember_gauntlets: IT('armor/hands/gauntlet_1'),
  bone_gloves: IT('armor/hands/glove_3_new'),
  dread_fists: IT('armor/hands/glove_5'),
  ash_gauntlets: IT('armor/hands/glove_4_new'),
  cloth_boots: IT('armor/feet/boots_1_brown_new'),
  iron_greaves: IT('armor/feet/boots_iron_2'),
  steel_boots: IT('armor/feet/boots_2_jackboots'),
  bone_boots: IT('armor/feet/boots_3_stripe_new'),
  dread_treads: IT('armor/feet/boots_4_green'),
  ash_boots: IT('armor/feet/low_boots'),
  rag_cloak: IT('armor/back/cloak_1_leather'),
  wool_cloak: IT('armor/back/cloak_2'),
  hunter_cloak: IT('armor/back/cloak_3'),
  wolf_cloak: IT('armor/back/cloak_4'),
  dread_cloak: IT('armor/back/cloak_4'),
  ash_cloak: IT('armor/back/cloak_3'),
  // Ringe, Amulette
  iron_ring: IT('ring/iron'),
  silver_ring: IT('ring/silver'),
  ember_ring: IT('ring/ring_ruby'),
  moon_ring: IT('ring/moonstone'),
  blood_ring: IT('ring/ruby'),
  ash_band: IT('ring/plain_black'),
  bone_charm: IT('amulet/bone_gray'),
  copper_amulet: IT('amulet/cameo_orange'),
  wisdom_amulet: IT('amulet/crystal_white'),
  hunter_talisman: IT('amulet/eye_green'),
  ember_pendant: IT('amulet/celtic_red'),
  moon_amulet: IT('amulet/cameo_blue'),
  blood_pendant: IT('amulet/crystal_red'),
  dread_talisman: IT('amulet/face_2'),
  ash_amulet: IT('amulet/face_1_gold'),
  // Tränke
  heal_small: IT('potion/pink'),
  heal_mid: IT('potion/ruby_new'),
  heal_big: IT('potion/purple_red'),
  heal_huge: IT('potion/magenta_new'),
  heal_max: IT('potion/golden'),
  mana_small: IT('potion/sky_blue'),
  mana_mid: IT('potion/cyan_new'),
  mana_big: IT('potion/brilliant_blue_new'),
  mana_huge: IT('potion/white_new'),
  mana_max: IT('potion/silver'),
};

/** Schnellleisten-Tränke (Q/E): kleinster Trank der Art */
export const POTION_QUICK: Record<'heal' | 'mana', string> = { heal: ITEM_SPRITES.heal_mid!, mana: ITEM_SPRITES.mana_mid! };

/** Skill-ID → Icon (Schulen/Zauber und Waffenfertigkeiten aus dem GUI-Ordner). */
export const SKILL_SPRITES: Record<string, string> = {
  power_strike: 'gui/skills/maces_flails.png',
  quick_shot: 'gui/skills/bows.png',
  ember_bolt: 'gui/spells/fire/throw_flame_new.png',
  healing_hand: 'gui/invocations/elyvilon_heal_other.png',
  poison_shot: 'gui/spells/poison/poison_arrow_new.png',
  whirlwind: 'gui/skills/long_blades.png',
  frost_nova: 'gui/spells/ice/ozocubus_refrigeration_new.png',
  multishot: 'gui/skills/crossbows.png',
  fireball: 'gui/spells/fire/fireball_new.png',
  skull_split: 'gui/skills/axes.png',
  lightning: 'gui/spells/air/lightning_bolt_new.png',
};

/* ------------------------------------------------ Spielerfigur (Ebenen) */

const P = (p: string) => `player/${p}.png`;

export const PLAYER_BASE = P('base/human_male');
export const PLAYER_HAIR = P('hair/brown_2');
/** Standardkleidung ohne Ausrüstung */
export const PLAYER_DEFAULTS = { body: P('body/shirt_white_1'), legs: P('legs/pants_brown'), boots: P('boots/short_brown') };

/** Ebenen je Vorlage (templateId); der Slot ergibt sich aus der Vorlage. */
export const PLAYER_LAYERS: Record<string, string> = {
  // Körper
  ash_mail: P('body/ringmail'), plate_cuirass: P('body/plate'), bone_plate: P('body/half_plate'), dread_mail: P('body/banded_2'), ash_cuirass: P('body/plate_black'),
  cloth_robe: P('body/robe_brown'), acolyte_robe: P('body/robe_blue'), bone_robe: P('body/robe_gray_2'), dread_robe: P('body/robe_purple'), ash_robe: P('body/robe_black_red'),
  leather_vest: P('body/leather_armor'), hunter_vest: P('body/leather_armor_2'), bone_leather: P('body/leather_stud'), dread_leather: P('body/leather_heavy'), ash_leather: P('body/leather_metal'),
  // Beine
  cloth_pants: P('legs/pants_brown'), leather_pants: P('legs/pants_black'), chain_legs: P('legs/metal_gray'), bone_legs: P('legs/leg_armor_1'), dread_legs: P('legs/leg_armor_3'), ash_legs: P('legs/leg_armor_5'),
  // Stiefel
  cloth_boots: P('boots/middle_brown'), iron_greaves: P('boots/middle_gray'), steel_boots: P('boots/middle_gold'), bone_boots: P('boots/long_white'), dread_treads: P('boots/long_red'), ash_boots: P('boots/middle_purple'),
  // Handschuhe
  worn_gloves: P('gloves/glove_brown'), iron_gauntlets: P('gloves/gauntlet_blue'), ember_gauntlets: P('gloves/glove_red'), bone_gloves: P('gloves/glove_white'), dread_fists: P('gloves/glove_black'), ash_gauntlets: P('gloves/glove_purple'),
  // Köpfe
  leather_cap: P('head/cap_black_1'), iron_helm: P('head/iron_1'), warden_helm: P('head/iron_2'), crown_helm: P('head/helm_plume'), dread_helm: P('head/fhelm_horn_2'), ash_visor: P('head/full_black'),
  // Umhänge
  rag_cloak: P('cloak/brown'), wool_cloak: P('cloak/gray'), hunter_cloak: P('cloak/green'), wolf_cloak: P('cloak/white'), dread_cloak: P('cloak/red'), ash_cloak: P('cloak/black'),
  // Waffen (rechte Hand)
  rusty_sword: P('hand_right/short_sword'), bone_club: P('hand_right/club'), steel_sword: P('hand_right/long_sword'), cinder_axe: P('hand_right/hand_axe_new'),
  war_blade: P('hand_right/falchion_new'), doom_hammer: P('hand_right/hammer_2_new'), ash_greatsword: P('hand_right/great_sword'),
  iron_dagger: P('hand_right/dagger_new'), steel_dagger: P('hand_right/dagger_slant_new'), bone_dagger: P('hand_right/knife'), ash_dagger: P('hand_right/sword_thief'),
  woodcutter_axe: P('hand_right/axe'), battle_axe: P('hand_right/battleaxe'), claymore: P('hand_right/heavy_sword'), war_hammer: P('hand_right/hammer_new'),
  great_axe: P('hand_right/great_axe'), dread_cleaver: P('hand_right/axe_executioner_new'), dread_blade: P('hand_right/sword_black'), ash_saber: P('hand_right/sabre'),
  hunt_bow: P('hand_right/bow'), yew_bow: P('hand_right/bow_2'), horn_bow: P('hand_right/bow_3'), war_bow: P('hand_right/great_bow'), dread_bow: P('hand_right/bow_blue'), ash_bow: P('hand_right/great_bow'),
  twig_staff: P('hand_right/staff_plain'), oak_staff: P('hand_right/staff_mage'), bone_staff: P('hand_right/staff_skull'), crystal_staff: P('hand_right/staff_ring_blue'), cinder_staff: P('hand_right/staff_ruby'), void_staff: P('hand_right/staff_evil'),
  // Schilde (linke Hand)
  wood_shield: P('hand_left/buckler_round_2'), iron_shield: P('hand_left/shield_round_2'), steel_shield: P('hand_left/shield_kite_1'), bone_shield: P('hand_left/shield_skull'), dread_shield: P('hand_left/shield_long_red'), ash_shield: P('hand_left/shield_large_dd_dk'),
};

/** Alle verwendeten Sprite-Pfade (für Vorladen und Import-Skript). */
export function allSpritePaths(): string[] {
  const s = new Set<string>();
  for (const v of Object.values(MONSTER_SPRITES)) s.add(v.file);
  for (const v of Object.values(NPC_NAME_SPRITES)) s.add(v);
  for (const v of Object.values(NPC_KIND_SPRITES)) s.add(v);
  for (const c of Object.values(CHEST_SPRITES)) {
    s.add(c.closed);
    s.add(c.open);
  }
  for (const v of Object.values(ITEM_SPRITES)) s.add(v);
  for (const v of Object.values(SKILL_SPRITES)) s.add(v);
  for (const v of Object.values(PLAYER_LAYERS)) s.add(v);
  s.add(PLAYER_BASE);
  s.add(PLAYER_HAIR);
  for (const v of Object.values(PLAYER_DEFAULTS)) s.add(v);
  return [...s];
}
