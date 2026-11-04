/**
 * Skelett-Monster: jede Monsterart (`src/sim/data.ts`) bekommt eine Figur im Stil des Helden. Zweibeiner (Goblins, Banditen,
 * Hexen, Ghule, Untote, Trolle, Golems, Dämonen) laufen über denselben Rig-Remix (`heroRig.js`) mit eigenem Körperbau,
 * Ausrüstung, Waffe und Palette; Tiere (Ratten, Hunde/Wölfe, Spinnen, Würmer, Irrlichter) über eigene kleine Skelette
 * (`monsterRig.js`). Bosse sind größer per Proportion (`size`), nicht per Skalierung, und behalten die goldene Kontur.
 * Reine Daten und Rechnung ohne DOM (Node-Kontaktbögen `scripts/bake-monsters.ts`, Tests, Browser `monsterSheet.ts`).
 */
import { cycleLength, type FigAnim, type FigureSpec, type FigView, type Ramp } from './figure';
import { ACCENT, CLOAKS, heroPose, MAT, type Gait, type HeroLook, type HeroWeapon } from './hero';
import { PART, posed, type HeroGear, type RigBody, type RigPose } from './heroRig.js';
import { BEAST_PART, beastPosed, type BeastBody } from './monsterRig.js';

/* ------------------------------------------------ Farben */

const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
/** Verlauf aus einer Grundfarbe: Lichter wärmer, Schatten kühler (hell -> dunkel, Naht) */
export function rampOf(c: number, hi = 1.32): Ramp {
  // sehr dunkle Grundfarben anheben, sonst verschwinden die Figuren unter der Abdunkelung der Welt (DARK_GRADE)
  const lum = 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
  const lift = lum < 84 ? 84 / Math.max(20, lum) : 1;
  const r = ((c >> 16) & 255) * lift;
  const g = ((c >> 8) & 255) * lift;
  const b = (c & 255) * lift;
  const step = (k: number, warm: number): number => (clamp(r * k + warm * 10) << 16) | (clamp(g * k + warm * 4) << 8) | clamp(b * k - warm * 6 + (k < 1 ? (1 - k) * 18 : 0));
  return [step(hi, 1), step(1, 0), step(0.74, -0.4), step(0.52, -0.8), step(0.34, -1)];
}

const BONE = MAT.bone;
const BANDAGE: Ramp = [0xe4dcc4, 0xbab09a, 0x908874, 0x665e52, 0x403a34];
const STONE: Ramp = [0xb4b0a8, 0x8c8882, 0x68645e, 0x48443f, 0x2e2b28];
const LAVA: Ramp = [0xfff0a0, 0xffb040, 0xe0601a, 0x9a3210, 0x5a1a08];
const CHAR: Ramp = [0x6a5a52, 0x4c403a, 0x362c28, 0x241c1a, 0x161010];
const HOLLOW: Ramp = [0x3a3430, 0x2c2622, 0x201c1a, 0x161312, 0x0e0c0b];
const RAG: Ramp = [0x8a7a64, 0x6a5c4a, 0x4e4436, 0x382f26, 0x241e18];
const GOLD_OUTLINE = 0xc8801c;
const OUTLINE = 0x0c0a0e;

/* ------------------------------------------------ Katalog */

export interface HumDef {
  rig: 'hum';
  body: RigBody;
  gear?: HeroGear;
  /** Angriffsart (Posen) und Rig-Waffe (Form) */
  style: HeroWeapon;
  weapon?: string;
  shield?: number;
  /** vorgebeugt (Ghule, Trolle), Arme vorgestreckt (Zombies), schwebend (Geister) */
  hunch?: number;
  reach?: boolean;
  float?: boolean;
  gait?: Partial<Gait>;
  /** Teil-Farben; Schlüssel = Teilname aus PART oder Gruppe (skin, top, sleeve, legs, boots, hair, metal, cloth) */
  pal: Partial<Record<string, Ramp>>;
  eye: number;
  blade?: number[];
  orb?: number[];
  wood?: number[];
  /** Waffengröße (Speer der Wachen kleiner) */
  wscale?: number;
}
interface BeastDef {
  rig: 'beast';
  body: BeastBody;
  pal: Partial<Record<string, Ramp>>;
  eye: number;
  /** Bildgröße bei 1x */
  frame: { w: number; h: number; fx: number; fy: number };
}
export type MonsterDef = (HumDef | BeastDef) & { boss?: boolean };

const RUST = [0xc0b6ac, 0x928678, 0x6a5e54, 0x463c34];
const BONEBLADE = [0xf0ead8, 0xd0c8b0, 0xa49c84, 0x746c5a];
const DARKBLADE = [0xb0a8d0, 0x847ca8, 0x5c5480, 0x3c3658];
const EMBERBLADE = [0xffe0a0, 0xffa050, 0xd0602a, 0x8a3a1a];
const ORB_GREEN = [0x9aff8a, 0x3a9a3a];
const ORB_PURPLE = [0xd08aff, 0x7a3ab8];

const sk = (c: number): Ramp => rampOf(c, 1.28);

/** Grundbausteine je Volk */
const goblin = (c: number, o: Partial<HumDef> = {}, b: RigBody = {}): HumDef => ({
  rig: 'hum', style: 'dagger', eye: 0xf8e040, ...o,
  body: { size: 0.8, head: 1.28, legs: 0.82, arms: 1.05, torso: 0.95, ...b },
  gear: { ears: 1.1, snout: 1.15, feet: 1.15, ...o.gear },
  pal: { skin: sk(c), top: RAG, sleeve: sk(c), legs: rampOf(0x5a4632), boots: sk(c), hair: sk(c), ...o.pal },
});
export const human = (o: Partial<HumDef> = {}, b: RigBody = {}): HumDef => ({
  rig: 'hum', style: 'sword', eye: 0x2a1c18, ...o,
  body: { size: 0.98, ...b },
  gear: { ...o.gear },
  pal: { skin: MAT.skin, hair: MAT.hair, ...o.pal },
});
const undead = (o: Partial<HumDef> = {}, b: RigBody = {}): HumDef => ({
  rig: 'hum', style: 'sword', eye: 0xff5a3a, ...o,
  body: { limb: 0.62, belly: 0.75, width: 0.9, head: 1.05, ...b },
  gear: { ribs: true, ...o.gear },
  pal: { skin: BONE, top: BONE, sleeve: BONE, legs: BONE, boots: BONE, hair: BONE, belly: HOLLOW, waist: BONE, ...o.pal },
});
const ghoul = (c: number, o: Partial<HumDef> = {}, b: RigBody = {}): HumDef => ({
  rig: 'hum', style: 'none', weapon: 'claw', hunch: 3, eye: 0xd8f060, gait: { stance: 0.5, stride: 4.2 }, ...o,
  body: { arms: 1.3, legs: 0.9, head: 0.95, limb: 0.88, ...b },
  gear: { snout: 1.12, feet: 1.1, ...o.gear },
  pal: { skin: sk(c), top: RAG, sleeve: sk(c), legs: RAG, boots: sk(c), hair: rampOf(0x3a3a2a), ...o.pal },
});
const troll = (c: number, o: Partial<HumDef> = {}, b: RigBody = {}): HumDef => ({
  rig: 'hum', style: 'mace', weapon: 'club', hunch: 2, eye: 0xf0a030, gait: { stance: 0.5, stride: 4.4 }, ...o,
  body: { size: 1.32, arms: 1.3, legs: 0.85, head: 0.98, limb: 1.32, belly: 1.25, width: 1.12, neck: 1, ...b },
  gear: { ears: 0.5, snout: 1.3, fists: 1.2, feet: 1.2, ...o.gear },
  pal: { skin: sk(c), top: sk(c), sleeve: sk(c), waist: sk(c), legs: rampOf(0x5a4632), boots: sk(c), hair: rampOf(0x4a4030), pelvis: MAT.leatherD, ...o.pal },
});
const golem = (r: Ramp, eye: number, b: RigBody = {}, o: Partial<HumDef> = {}): HumDef => ({
  rig: 'hum', style: 'none', eye, hunch: 1, gait: { stance: 0.5, stride: 4 }, ...o,
  body: { size: 1.35, head: 0.85, neck: 0.8, arms: 1.3, limb: 1.4, legs: 0.85, width: 1.3, belly: 1.1, ...b },
  gear: { fists: 1.45, feet: 1.15, ...o.gear },
  pal: { skin: r, top: r, sleeve: r, legs: r, boots: r, hair: r, ...o.pal },
});
const demon = (c: number, o: Partial<HumDef> = {}, b: RigBody = {}): HumDef => ({
  rig: 'hum', style: 'none', weapon: 'claw', eye: 0xffe040, ...o,
  body: { ...b },
  gear: { horns: 1, tail: 1, snout: 1.05, ...o.gear },
  pal: { skin: sk(c), top: sk(c), sleeve: sk(c), legs: sk(c), boots: rampOf(0x2a1a18), hair: rampOf(0x2a1a18), horn: rampOf(0x3a3030), wing: rampOf(0x5a2a2a), tail: sk(c), ...o.pal },
});

const RAT_FRAME = { w: 44, h: 32, fx: 22, fy: 28 };
const DOG_FRAME = { w: 60, h: 48, fx: 30, fy: 43 };
const SPIDER_FRAME = { w: 68, h: 50, fx: 34, fy: 45 };
const rat = (c: number, size = 1): BeastDef => ({
  rig: 'beast', eye: 0xff4a3a, frame: size > 1.2 ? { w: 56, h: 40, fx: 28, fy: 36 } : RAT_FRAME,
  body: { type: 'quad', size, len: 8, height: 4.2, girth: 3.4, head: 2.6, snout: 2.6, ears: 1.5, earsRound: true, tail: 11, tailR: 0.7, legR: 0.9 },
  pal: { fur: rampOf(c), belly: rampOf(c, 1.5), snout: rampOf(0xd08a8a), paw: rampOf(0xc8908a), ear: rampOf(0xd09a9a), tail: rampOf(0xc0908a) },
});
const dog = (c: number, size = 1, o: Partial<BeastBody> = {}, pal: Partial<Record<string, Ramp>> = {}): BeastDef => ({
  rig: 'beast', eye: 0xf0c040, frame: size > 1.15 ? { w: 72, h: 56, fx: 36, fy: 50 } : DOG_FRAME,
  body: { type: 'quad', size, len: 13, height: 9.5, girth: 4.4, head: 3.2, snout: 3.6, ears: 2.2, tail: 8, tailR: 1.3, legR: 1.3, ...o },
  pal: { fur: rampOf(c), belly: rampOf(c, 1.55), snout: rampOf(c, 1.2), paw: rampOf(c, 0.9), ear: rampOf(c, 0.9), tail: rampOf(c), ...pal },
});
const spider = (c: number, size = 1, o: Partial<BeastBody> = {}): BeastDef => ({
  rig: 'beast', eye: 0xff3a2a, frame: size > 1.3 ? { w: 104, h: 74, fx: 52, fy: 68 } : size > 1.05 ? { w: 84, h: 60, fx: 42, fy: 54 } : SPIDER_FRAME,
  body: { type: 'spider', size: size * 1.15, len: 9, height: 5, girth: 4.6, head: 3.2, legR: 0.85, ...o },
  pal: { fur: rampOf(c), belly: rampOf(c, 1.5), paw: rampOf(c, 0.8), snout: rampOf(c, 1.15), mark: rampOf(0xc83a3a) },
});
const worm = (c: number, o: Partial<BeastBody> = {}): BeastDef => ({
  rig: 'beast', eye: 0xf8e040, frame: { w: 72, h: 60, fx: 36, fy: 54 },
  body: { type: 'worm', size: 1.2, len: 26, girth: 4.2, head: 4.4, ...o },
  pal: { fur: rampOf(c), belly: rampOf(c, 1.5), snout: rampOf(0xa04a4a), mark: rampOf(c, 0.8) },
});

export { rampOf as ramp, RAG, BONE };

export const MONSTER_DEFS: Record<string, MonsterDef> = {
  // Ratten, Hunde, Wölfe
  field_rat: rat(0x9a7b5a),
  burrow_rat: rat(0x7a6048),
  giant_rat: rat(0x6a5238, 1.35),
  wild_hound: dog(0x8a6a4a, 0.95),
  feral_hound: dog(0x7a5a3a, 1, { ears: 1.8 }),
  wolf: dog(0x8a8a8e, 1.08, { mane: 1 }),
  dire_wolf: dog(0x5a5a62, 1.25, { mane: 1.3, girth: 4.8 }),
  shadow_wolf: { ...dog(0x4a4a72, 1.08, { mane: 1 }), eye: 0x8af0ff },
  night_stalker: { ...dog(0x3a3a52, 1.2, { mane: 0.6, len: 14, height: 10.5 }), eye: 0xc0a0ff },
  // Goblins
  goblin: goblin(0x6a9a4a),
  goblin_scout: goblin(0x7ab05a, { gear: { helm: 5 }, pal: { hood: rampOf(0x4a5a32), top: MAT.leatherD } }),
  goblin_warrior: goblin(0x5a8a3a, { style: 'mace', weapon: 'club', shield: 1, gear: { helm: 1 }, pal: { top: MAT.leather, helm: MAT.leatherD } }, { size: 0.86 }),
  goblin_shaman: goblin(0x8ac06a, { style: 'staff', weapon: 'wand', orb: ORB_GREEN, gear: { robe: true, horns: 0.5 }, pal: { robe: rampOf(0x6a4a30), robeHem: rampOf(0xc0a040), top: rampOf(0x6a4a30), horn: BONE } }),
  goblin_archer: goblin(0x7ab05a, { style: 'bow', gear: { helm: 5, quiver: true }, pal: { hood: rampOf(0x3a4a2a), top: MAT.leatherD } }),
  goblin_chief: goblin(0x4a7a2a, { style: 'axe', gear: { helm: 2, crest: true, pauldron: true }, pal: { top: MAT.leather, metal: MAT.iron, crest: MAT.tabard } }, { size: 0.92, belly: 1.15 }),
  goblin_brute: goblin(0x4f7f30, { style: 'mace', weapon: 'club' }, { size: 1.05, belly: 1.35, limb: 1.3, arms: 1.15, width: 1.15 }),
  goblin_warlord: goblin(0x3f6f28, { style: 'greatsword', weapon: 'axe', gear: { helm: 2, horns: 0.6, pauldron: true, cloak: true }, pal: { top: MAT.iron, metal: MAT.iron, cloak: rampOf(0x6a2a20), horn: BONE } }, { size: 1.0, belly: 1.2, limb: 1.15 }),
  goblin_king: { ...goblin(0x3a6a1a, { style: 'axe', gear: { helm: 4, cloak: true, pauldron: true }, pal: { top: MAT.leather, metal: rampOf(0xd8a040), crest: rampOf(0xf0c040), cloak: rampOf(0x8a2a2a), cloakHem: ACCENT[2] } }, { size: 1.3, belly: 1.4, limb: 1.25 }), boss: true },
  // Banditen
  bandit_novice: human({ style: 'dagger', gear: { helm: 5 }, pal: { top: MAT.leather, hood: rampOf(0x6a4a30), legs: MAT.trousers, boots: MAT.boot } }, { size: 0.94 }),
  highwayman: human({ gear: { helm: 5, cloak: true }, pal: { top: MAT.leatherD, hood: rampOf(0x3a3440), cloak: rampOf(0x3a3440), legs: MAT.trousers, boots: MAT.boot } }),
  bandit_archer: human({ style: 'bow', gear: { helm: 5, quiver: true }, pal: { top: MAT.leather, hood: rampOf(0x4a5a32), legs: MAT.trousers, boots: MAT.boot } }),
  bandit: human({ style: 'axe', shield: 1, gear: { helm: 1 }, pal: { top: MAT.leather, sleeve: rampOf(0xa05a3a), helm: MAT.leatherD, legs: MAT.trousers, boots: MAT.boot }, }, { belly: 1.1 }),
  bandit_captain: human({ shield: 2, gear: { helm: 2, pauldron: true, cloak: true }, pal: { top: MAT.iron, metal: MAT.iron, waist: rampOf(0x7a3a2a), cloak: rampOf(0x7a3a2a), legs: MAT.chain, boots: MAT.boot } }, { size: 1.04 }),
  bandit_lord: { ...human({ style: 'greatsword', gear: { helm: 2, crest: true, pauldron: true, cloak: true, beard: 1 }, pal: { top: MAT.iron, metal: MAT.iron, crest: ACCENT[2], waist: rampOf(0xc07a3a), cloak: rampOf(0x8a3a1a), cloakHem: ACCENT[2], legs: MAT.chain, boots: MAT.boot, beard: MAT.hair } }, { size: 1.4, belly: 1.1 }), boss: true },
  // Sumpf
  bog_ghoul: ghoul(0x5a8a5a),
  marsh_corpse: ghoul(0x6a7a52, { hunch: 2, pal: { top: rampOf(0x4a4a32), legs: rampOf(0x4a4a32) } }),
  bog_witch: human({ style: 'staff', weapon: 'wand', orb: ORB_GREEN, eye: 0x9aff6a, gear: { robe: true, hat: true, snout: 1.15 }, pal: { skin: rampOf(0x9ab08a), robe: rampOf(0x7a4a8a), robeHem: rampOf(0x3a6a3a), top: rampOf(0x7a4a8a), hood: rampOf(0x3a2a48), hair: rampOf(0x3a3a30) } }, { size: 0.95 }),
  ghoul_alpha: ghoul(0x4a6a3a, {}, { size: 1.25, belly: 1.2, limb: 1.1 }),
  bog_queen: { ...human({ style: 'staff', orb: ORB_GREEN, eye: 0x9aff6a, gear: { robe: true, hat: true, cloak: true, snout: 1.15 }, pal: { skin: rampOf(0x9ab08a), robe: rampOf(0x9a4a9a), robeHem: ACCENT[3], top: rampOf(0x9a4a9a), hood: rampOf(0x3a2a48), cloak: rampOf(0x3a5a3a), cloakHem: ACCENT[3] } }, { size: 1.42 }), boss: true },
  // Untote
  skeleton: undead({ shield: 1, blade: RUST, pal: { shield: MAT.wood } }),
  wraith: undead({ style: 'none', weapon: 'claw', float: true, eye: 0xc8f0ff, gear: { ghost: true, helm: 5, cloak: true, ribs: false }, pal: { skin: rampOf(0x8a9ad8, 1.4), top: rampOf(0x5a6a9a), sleeve: rampOf(0x5a6a9a), robe: rampOf(0x5a6a9a), robeHem: rampOf(0x8a9ad8, 1.5), hood: rampOf(0x4a5a8a), cloak: rampOf(0x3a4a7a), cloakHem: rampOf(0x8a9ad8, 1.4) } }, { limb: 0.75 }),
  bone_acolyte: undead({ style: 'staff', orb: ORB_PURPLE, gear: { robe: true, helm: 5 }, pal: { robe: rampOf(0x6a7a8a), robeHem: rampOf(0xb8c8d8), top: rampOf(0x6a7a8a), hood: rampOf(0x4a5a6a) } }),
  zombie: ghoul(0x7a8a62, { reach: true, hunch: 1.5, style: 'none', weapon: undefined, eye: 0xf0f070, gait: { stance: 0.5, stride: 3.6 }, pal: { top: rampOf(0x5a5060), legs: rampOf(0x4a4038) } }, { arms: 1.1, limb: 1 }),
  bone_knight: undead({ shield: 2, gear: { helm: 2, pauldron: true, ribs: false }, pal: { metal: rampOf(0x8a8a8a), top: rampOf(0x8a8a8a), helm: rampOf(0x8a8a8a) }, blade: RUST }, { size: 1.05 }),
  necromancer: human({ style: 'staff', orb: ORB_GREEN, eye: 0x9aff8a, gear: { robe: true, helm: 5, cloak: true }, pal: { skin: rampOf(0xc8c0b0), robe: rampOf(0x4a3a6a), robeHem: rampOf(0x8ac06a), top: rampOf(0x4a3a6a), hood: rampOf(0x2e2444), cloak: rampOf(0x2a2038) } }),
  crypt_guard: { ...undead({ style: 'mace', shield: 3, eye: 0xf8d040, gear: { ribs: false }, pal: { skin: BANDAGE, top: BANDAGE, sleeve: BANDAGE, legs: BANDAGE, boots: BANDAGE, hair: BANDAGE, shield: rampOf(0x6a5a3a) } }, { size: 1.12, limb: 1.05, belly: 1, width: 1.05 }) },
  death_knight: undead({ style: 'greatsword', eye: 0x8ad0ff, blade: DARKBLADE, gear: { helm: 3, horns: 0.8, pauldron: true, cloak: true, ribs: false }, pal: { top: MAT.dread, metal: MAT.dread, helm: MAT.dread, sleeve: MAT.dread, legs: MAT.dread, boots: MAT.dread, horn: BONE, cloak: rampOf(0x2a2034), cloakHem: rampOf(0x6a5aa8) } }, { size: 1.1, limb: 1.1, belly: 1, width: 1.05 }),
  // Trolle und Golems
  hill_troll: troll(0x7a8a6a),
  stone_golem: golem(STONE, 0x7ae0ff),
  rock_troll: troll(0x6a7a62, { pal: { skin: rampOf(0x7a8070), top: STONE } }, { size: 1.38 }),
  iron_golem: golem(MAT.iron, 0xffa040, { size: 1.4 }),
  stone_colossus: { ...golem(rampOf(0xa09a8a), 0xffd060, { size: 1.75 }), boss: true },
  // Würmer
  pit_worm: worm(0x9a7a5a),
  acid_worm: worm(0x8aa04a, { spikes: true }),
  // Asche und Feuer
  ash_walker: ghoul(0x6a5a52, { style: 'sword', weapon: 'shortsword', blade: RUST, hunch: 1.2, eye: 0xff8a3a, gear: { helm: 5 }, pal: { hood: rampOf(0x3a3230), top: rampOf(0x4a3e3a) } }, { arms: 1.1, limb: 0.95 }),
  cinder_wisp: { rig: 'beast', eye: 0xffffe0, frame: { w: 60, h: 68, fx: 30, fy: 62 }, body: { type: 'wisp', size: 1.55, girth: 5.5, height: 11 }, pal: { fur: LAVA, belly: rampOf(0xffe080, 1.2), mark: CHAR } },
  ember_elemental: golem(CHAR, 0xfff0a0, { size: 1.35 }, { pal: { chest: LAVA, belly: LAVA, head: LAVA, handN: LAVA, handF: LAVA } }),
  imp: demon(0xd05a3a, { gear: { horns: 0.6, tail: 0.8, wings: 0.75, ears: 0.7 } }, { size: 0.8, head: 1.3, legs: 0.85 }),
  hell_spawn: demon(0xc0402a, { hunch: 1.5 }, { size: 1.1, limb: 1.2, arms: 1.15 }),
  // Aschengrund
  hell_hound: { ...dog(0xb03020, 1.15, { mane: 1.2, horns: 1 }, { mane: CHAR, horn: rampOf(0x3a3030) }), eye: 0xfff080 },
  doom_knight: undead({ style: 'greatsword', eye: 0xff6a3a, blade: EMBERBLADE, gear: { helm: 3, crest: true, pauldron: true, cloak: true, ribs: false }, pal: { top: MAT.ash, metal: MAT.ash, helm: MAT.ash, sleeve: MAT.ash, legs: MAT.ash, boots: MAT.ash, crest: rampOf(0xc03a2a), cloak: rampOf(0x3a2020), cloakHem: ACCENT[4] } }, { size: 1.15, limb: 1.1, belly: 1, width: 1.05 }),
  pit_fiend: demon(0x9a2a1a, { style: 'greatsword', weapon: 'axe', blade: EMBERBLADE, gear: { horns: 1.2, wings: 1.1, tail: 1.1 } }, { size: 1.35, limb: 1.2, belly: 1.1 }),
  // Bosse
  bone_lord: { ...undead({ style: 'greatsword', eye: 0xc08aff, blade: BONEBLADE, gear: { helm: 4, cloak: true, pauldron: true }, pal: { helm: rampOf(0xc8a040), crest: rampOf(0xe0c060), metal: BONE, cloak: rampOf(0x4a2a5a), cloakHem: ACCENT[4] } }, { size: 1.5, limb: 0.75 }), boss: true },
  spider_queen: { ...spider(0x7a2a5a, 1.5, { crown: true }), boss: true },
  web_mother: { ...spider(0x6a3a6a, 1.55, { crown: true }), boss: true },
  ash_king: { ...demon(0xd86a2a, { style: 'greatsword', blade: EMBERBLADE, gear: { helm: 4, horns: 1, cloak: true, pauldron: true, tail: 0 }, pal: { top: MAT.ash, metal: MAT.ash, helm: rampOf(0xd8a040), crest: rampOf(0xf0c040), cloak: rampOf(0x5a2010), cloakHem: ACCENT[4] } }, { size: 1.6, belly: 1.15, limb: 1.15 }), boss: true },
  // Spinnen (nach den Bossen, Reihenfolge egal)
  forest_spider: spider(0x3a3a48),
  venom_spider: spider(0x3a5a3a, 1, { mark: true }),
  giant_spider: spider(0x4a3a58, 1.25),
  cave_spider: spider(0x5a4a38, 1.1),
  brood_spider: spider(0x4a3a52, 0.9),
  web_stalker: spider(0x3a4a3a, 1.1, { mark: true, legLen: 1.2 }),
  nest_matron: spider(0x5a3a5a, 1.2, { mark: true }),
};

export function monsterDef(id: string): MonsterDef | undefined {
  return MONSTER_DEFS[id];
}

/* ------------------------------------------------ Zweibeiner */

const HUM_ANIMS: Record<FigAnim, number> = { idle: 4, walk: 8, attack: 6, hit: 2, die: 5 };
const BEAST_ANIMS: Record<FigAnim, number> = { idle: 4, walk: 8, attack: 5, hit: 2, die: 4 };

function humLook(d: HumDef): HeroLook {
  return {
    armor: 'cloth', robe: !!d.gear?.robe, helm: d.gear?.helm ?? 0, helmMat: 'iron', gloves: 0, legs: 0,
    weapon: d.style, weaponTier: 0, shield: d.shield ?? 0, cloak: d.gear?.cloak ? 'x' : '', quiver: !!d.gear?.quiver, rar: [0, 0, 0],
  };
}

function humGait(d: HumDef): Gait {
  return { stride: 5.6, stance: 0.4, lift: 3, ...d.gait };
}

function humPose(d: HumDef, anim: FigAnim, view: FigView, i: number): RigPose {
  const look = humLook(d);
  const p = heroPose(anim, view, i, look, humGait(d));
  const living = anim !== 'die';
  if (d.hunch && living) {
    p.lean = (p.lean ?? 0) + d.hunch;
    p.hy = (p.hy ?? 0) - d.hunch * 0.25;
    p.crouch = (p.crouch ?? 0) + d.hunch * 0.3;
  }
  if (d.reach && living && anim !== 'attack') {
    const b = Math.sin((i / 4) * Math.PI);
    Object.assign(p, { fx: 9, fy: -16 + b * 0.6, bx: 8, by: -15.5 - b * 0.6, armsFront: true, bz: 3 });
  }
  if (d.float && living) p.y = -3 - Math.sin((i / (anim === 'walk' ? 8 : 4)) * Math.PI * 2) * 1;
  const gear: HeroGear = { ...p.gear, ...d.gear, helm: d.gear?.helm ?? 0, shield: d.shield ?? 0 };
  if (d.gear?.pauldron === undefined) gear.pauldron = false;
  const pose: RigPose = { ...p, body: d.body, gear, mark: false };
  if (d.weapon !== undefined || d.style === 'none') pose.weapon = anim === 'die' && i >= 2 ? undefined : d.weapon;
  if (d.blade) pose.blade = d.blade;
  if (d.orb) pose.orb = d.orb;
  if (d.wood) pose.wood = d.wood;
  if (d.wscale) pose.wscale = d.wscale;
  delete pose.accent;
  return pose;
}

/** Teilfarben aus der Palette einer Art: Gruppen (skin, top, …) auf Teile verteilt, einzelne Teile überschreiben */
function humMats(d: HumDef): Record<number, Ramp> {
  const P = d.pal;
  const skin = P.skin ?? MAT.skin;
  const top = P.top ?? MAT.cloth;
  const metal = P.metal ?? MAT.iron;
  const groups: Record<string, Ramp> = {
    chest: top, belly: top, waist: P.waist ?? P.legs ?? top, pelvis: P.pelvis ?? MAT.belt, neck: skin, head: P.hair ?? skin, face: skin,
    helm: P.helm ?? metal, hood: P.hood ?? RAG, upperN: P.sleeve ?? top, elbowN: P.sleeve ?? top, upperF: P.sleeve ?? top, elbowF: P.sleeve ?? top,
    foreN: skin, foreF: skin, handN: skin, handF: skin, thighN: P.legs ?? RAG, kneeN: P.legs ?? RAG, thighF: P.legs ?? RAG, kneeF: P.legs ?? RAG,
    shinN: P.boots ?? MAT.boot, shinF: P.boots ?? MAT.boot, footN: P.boots ?? MAT.boot, footF: P.boots ?? MAT.boot,
    pauldronN: metal, pauldronF: metal, robe: P.robe ?? top, robeHem: P.robeHem ?? MAT.belt, cloak: P.cloak ?? CLOAKS.rag!, cloakHem: P.cloakHem ?? P.cloak ?? CLOAKS.rag!,
    quiver: MAT.leatherD, fletch: MAT.fletch, crest: P.crest ?? MAT.tabard, ear: skin, horn: P.horn ?? BONE, tail: P.tail ?? skin, wing: P.wing ?? skin, beard: P.beard ?? MAT.hair,
    shield: P.shield ?? (d.shield === 1 ? MAT.wood : metal), shieldRim: d.shield === 1 ? MAT.iron : MAT.chain, shieldBoss: MAT.iron,
  };
  const m: Record<number, Ramp> = {};
  for (const [name, r] of Object.entries(groups)) if (PART[name] !== undefined) m[PART[name]!] = P[name] ?? r;
  return m;
}

/* ------------------------------------------------ Tiere */

function beastMats(d: BeastDef): Record<number, Ramp> {
  const m: Record<number, Ramp> = {};
  const fur = d.pal.fur!;
  for (const [name, id] of Object.entries(BEAST_PART)) m[id] = d.pal[name] ?? fur;
  return m;
}

/* ------------------------------------------------ Spezifikation */

/** Bildgröße nach Körpergröße; Zweihänder brauchen etwas mehr Breite */
const frameOf = (size: number, wide = false): FigureSpec['frame'] => {
  const s = Math.max(0.85, size);
  const h = Math.round((64 * s) / 2) * 2;
  const w = wide ? Math.round((h * 1.14) / 2) * 2 : h;
  return { w, h, fx: Math.round(h * 0.47), fy: h - Math.round(6 * s) };
};

export const monsterKey = (id: string): string => `mfig_${id}`;

export function monsterSpec(id: string): FigureSpec | null {
  const d = MONSTER_DEFS[id];
  if (!d) return null;
  const outline = d.boss ? GOLD_OUTLINE : OUTLINE;
  if (d.rig === 'hum') return humSpec(monsterKey(id), d, outline);
  const size = d.body.size ?? 1;
  return {
    key: monsterKey(id), frame: d.frame, anims: BEAST_ANIMS,
    render: (anim, view, i) => beastPosed(d.body, anim, view, i, BEAST_ANIMS[anim]),
    mats: beastMats(d), fallback: d.pal.fur!, outline, eye: d.eye, mark: 0xc8a048,
    cyclePx: beastCycle(d.body) * 2 * size, wind: 2, mirrorAll: true,
  };
}

/** Figur eines Zweibeiners (Monster oder NPC); `anims` erlaubt weniger Bilder (NPCs greifen nicht an) */
export function humSpec(key: string, d: HumDef, outline = OUTLINE, anims: Record<FigAnim, number> = HUM_ANIMS): FigureSpec {
  const size = d.body.size ?? 1;
  const g = humGait(d);
  return {
    key, frame: frameOf(size, d.style === 'greatsword'), anims,
    render: (anim, view, i) => posed(humPose(d, anim, view, i)),
    mats: humMats(d), fallback: d.pal.top ?? RAG, outline, eye: d.eye, mark: 0xc8a048,
    loose: new Set([PART.weapon!, PART.offWeapon!]),
    cyclePx: cycleLength(g.stride, g.stance) * 2 * size, wind: 2,
  };
}

/** Strecke je Laufzyklus eines Tieres bei 1x und Größe 1 (passend zu `monsterRig.js`) */
function beastCycle(b: BeastBody): number {
  if (b.type === 'worm' || b.type === 'wisp') return 40;
  const stride = b.type === 'spider' ? 2.6 : (b.height ?? 8) * 0.42;
  return cycleLength(stride, 0.5);
}

