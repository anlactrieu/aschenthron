/**
 * Skelett-Held (pixelfx-Rig-Remix `heroRig.js`): Posen für Stehen, Gehen, Angriff je Waffe (Hieb, Bogen, Stab), Getroffen und
 * Sterben in drei Ansichten (Seite, zur Kamera, weg; links = Seite gespiegelt), sichtbare Ausrüstung (Helmform, Rüstung, Robe,
 * Schild, Umhang, Köcher, Seltenheitsakzente) als Teile am Skelett, Material je Körperteil, gebacken über `figure.ts`.
 * Reine Daten und Rechnung ohne DOM: läuft in Node (Kontaktbögen `scripts/bake-hero.ts`, Tests) und im Browser (`heroSheet`).
 */
import type { Look } from './art';
import { bakeFigure, cycleLength, gaitFoot, type FigAnim, type FigureSheet, type FigureSpec, type FigView, type Ramp } from './figure';
import { PART, posed, type HeroGear, type RigPose } from './heroRig.js';

export type HeroView = FigView;
export type HeroAnim = FigAnim;
export type HeroWeapon = 'none' | 'sword' | 'axe' | 'mace' | 'dagger' | 'greatsword' | 'bow' | 'staff';

export const HERO_VIEWS: HeroView[] = ['side', 'front', 'back'];
/** Bilder je Animation */
export const HERO_ANIMS: Record<HeroAnim, number> = { idle: 4, walk: 8, attack: 6, hit: 2, die: 5 };
/** Bildgröße und Fußpunkt bei 1x (Pixelmaßstab im Spiel: 2x) */
export const HERO_FRAME = { w: 64, h: 64, fx: 30, fy: 58 };
/** Angriff: so viele Bilder Ausholen, danach kommt das Schlagbild (passt zu 40 % Ausholen in `SWING_MS`) */
export const HERO_WIND_FRAMES = 2;

/** Materialien der Rüstung/Robe */
export type HeroMat = 'cloth' | 'leather' | 'iron' | 'dread' | 'bone' | 'ash' | 'acolyte' | 'leatherDread' | 'leatherBone' | 'leatherAsh';

export interface HeroLook {
  /** Rumpf: Material, Robe statt Rüstung */
  armor: HeroMat;
  robe: boolean;
  /** Helmform: 0 kein, 1 Kappe, 2 Nasenhelm, 3 Topfhelm, 4 Kronenhelm, 5 Kapuze; Material */
  helm: number;
  helmMat: HeroMat;
  /** 0 keine, 1 Leder, 2 Eisen */
  gloves: number;
  /** Schienbeine/Stiefel: 0 Stoff, 1 Leder, 2 Eisen */
  legs: number;
  weapon: HeroWeapon;
  /** Stufe der Waffe (Kugelfarbe beim Stab) */
  weaponTier: number;
  /** 0 keins, 1 rund (Holz), 2 Kite (Eisen), 3 Turm */
  shield: number;
  /** Umhang: '' keiner, sonst Farbe nach Vorlage */
  cloak: string;
  quiver: boolean;
  /** Seltenheit 0 normal … 4 legendär von Helm, Rumpf, Waffe */
  rar: [number, number, number];
}

const has = (re: RegExp, id: string): boolean => re.test(id);

function matOf(id: string, fallback: HeroMat): HeroMat {
  if (has(/^dread/, id)) return 'dread';
  if (has(/^bone/, id)) return 'bone';
  if (has(/^ash/, id)) return 'ash';
  return fallback;
}

/** Material aus der Vorlagen-ID (Eisen/Leder), sonst nach Stufe; 0 = nichts angelegt. */
function grade(id: string, t: number, iron: RegExp, leather: RegExp): number {
  if (!id) return 0;
  if (iron.test(id)) return 2;
  if (leather.test(id)) return 1;
  return t >= 2 ? 2 : 1;
}

function weaponOf(look: Look): HeroWeapon {
  if (look.weapon < 0) return 'none';
  if (look.weaponKind === 1) return 'bow';
  if (look.weaponKind === 2) return 'staff';
  const id = look.ids.weapon;
  if (/dagger/.test(id)) return 'dagger';
  if (/claymore|greatsword|great_axe/.test(id)) return 'greatsword';
  if (/axe|cleaver/.test(id)) return 'axe';
  if (/club|hammer/.test(id)) return 'mace';
  return 'sword';
}

export function heroLookOf(look: Look): HeroLook {
  const i = look.ids;
  const chest = i.chest;
  let armor: HeroMat = 'cloth';
  if (look.robe) armor = /acolyte/.test(chest) ? 'acolyte' : matOf(chest, 'cloth');
  else if (chest) {
    const g = grade(chest, look.chest, /plate|mail|cuirass/, /leather|vest/);
    armor = matOf(chest, g === 2 ? 'iron' : 'leather');
    // Leder späterer Stufen: eigener Farbton statt Metall (sonst Schulterplatten und Kettenärmel)
    if (/leather/.test(chest)) armor = armor === 'dread' ? 'leatherDread' : armor === 'bone' ? 'leatherBone' : armor === 'ash' ? 'leatherAsh' : 'leather';
  }
  const head = i.head;
  const helm = !head ? 0 : /hood/.test(head) ? 5 : /cap/.test(head) ? 1 : /crown/.test(head) ? 4 : /visor|dread/.test(head) ? 3 : /helm/.test(head) ? 2 : look.head >= 3 ? 3 : 2;
  const shieldId = i.offhand;
  return {
    armor,
    robe: look.robe,
    helm,
    helmMat: helm === 1 ? 'leather' : helm === 5 ? 'cloth' : matOf(head, 'iron'),
    gloves: grade(i.hands, look.hands, /gauntlet|fists/, /glove/),
    legs: /greaves|steel_boots|chain|dread_legs|ash_legs|bone_legs/.test(i.feet + ' ' + i.legs) ? 2 : /leather|boots|treads/.test(i.feet + ' ' + i.legs) ? 1 : 0,
    weapon: weaponOf(look),
    weaponTier: Math.max(0, look.weapon),
    shield: look.shield < 0 ? 0 : /tower|bulwark/.test(shieldId) ? 3 : /wood/.test(shieldId) ? 1 : 2,
    cloak: i.cloak ? i.cloak.replace(/_cloak$/, '') : '',
    quiver: look.quiver,
    rar: [look.rar.head, look.rar.chest, look.rar.weapon],
  };
}

export function heroKey(h: HeroLook): string {
  return `hero_${h.armor}${h.robe ? 'R' : ''}_${h.helm}${h.helmMat}_${h.gloves}${h.legs}_${h.weapon}${h.weapon === 'staff' ? h.weaponTier : ''}_${h.shield}${h.cloak}${h.quiver ? 'Q' : ''}_${h.rar.join('')}`;
}

/* ------------------------------------------------ Posen (Bildschirm-Pixel bei 1x, y negativ = oben, Blick nach rechts) */

const RIG_WEAPON: Record<HeroWeapon, string | undefined> = { none: undefined, sword: 'shortsword', axe: 'axe', mace: 'mace', dagger: 'dagger', greatsword: 'greatsword', bow: 'smallbow', staff: 'staff' };
/** Laufschritt: Fuß ±STRIDE, Standbein STANCE des Zyklus am Boden (dazwischen kurze Flugphasen) */
export const HERO_STRIDE = 5.6;
export const HERO_STANCE = 0.4;
const LIFT = 3;
const ARM = 3.6;
/** Schräge Draufsicht zur Kamera / weg (Bild-y je Pixel Tiefe) */
export const SHEAR = 0.32;
/** beim Hieb und mit dem Zweihänder weniger Scherung, sonst fährt die Klinge zur Kamera unter den Bildrand */
export const SHEAR_REACH = SHEAR * 0.55;
/** liegend (Sterben von vorn/hinten): steilerer Blick von oben, damit der Liegende nicht zum Strich schrumpft */
const SHEAR_LIE = 0.8;
/** Strecke je Laufzyklus in Bildschirm-Pixeln bei Pixelmaßstab 2x: so gleiten die Füße nicht */
export const HERO_CYCLE_PX = cycleLength(HERO_STRIDE, HERO_STANCE) * 2;

const melee = (w: HeroWeapon): boolean => w === 'sword' || w === 'axe' || w === 'mace' || w === 'dagger' || w === 'none';

/** Haltung der Waffenhand im Stehen/Gehen je Waffe */
function carry(weapon: HeroWeapon): RigPose {
  if (weapon === 'greatsword') return { fx: 4, fy: -11.5, sa: 1.0, two: true, wscale: 0.62 };
  if (melee(weapon) && weapon !== 'none') return { fx: 4, fy: -12.5, sa: 0.75 };
  if (weapon === 'staff') return { fx: 3.5, fy: -13.5, sa: -1.45 };
  if (weapon === 'bow') return { fx: 3.5, fy: -13, sa: 0.15 }; // quer gehaltene Waffe: sa 0 = Bogen senkrecht
  return { fx: 1, fy: -11.5 };
}

function idlePose(i: number, h: HeroLook): RigPose {
  const b = Math.sin((i / HERO_ANIMS.idle) * Math.PI * 2); // Atmen: Brust hebt und senkt sich
  const c = carry(h.weapon);
  // mit Schild: Schildarm vor dem Körper
  const off = h.shield ? { bx: 6, by: -13 + b * 0.4, bz: 2.5 } : { bx: -1.5, by: -11.6 + b * 0.4 };
  return { ...c, crouch: 0.9 - b * 0.45, lean: 0.6, fy: (c.fy ?? -12) + b * 0.4, ...off, ffx: 3, ffy: -4, fbx: -3.2, fby: -4, hy: 0.2, sway: b * 0.3 };
}

/** Gangart: Schrittweite, Anteil Standbein, Fußhub (1x-Pixel bei Körpergröße 1) */
export interface Gait {
  stride: number;
  stance: number;
  lift: number;
}
export const HERO_GAIT: Gait = { stride: HERO_STRIDE, stance: HERO_STANCE, lift: LIFT };

function walkPose(i: number, h: HeroLook, view: HeroView, g: Gait): RigPose {
  const p = i / HERO_ANIMS.walk;
  const side = view === 'side';
  const lift = g.lift * (side ? 1 : 1.5);
  const n = gaitFoot(p, g.stride, lift, g.stance);
  const f = gaitFoot(p + 0.5, g.stride, lift, g.stance);
  const swing = Math.cos(p * Math.PI * 2);
  // Laufschritt: tief beim Aufsetzen, oben in der Flugphase
  const crouch = (g.stance < 0.45 ? 1.3 : 0.9) + (g.stance < 0.45 ? 0.9 : 0.5) * Math.cos((p - 0.12) * Math.PI * 4);
  const c = carry(h.weapon);
  const hold = h.weapon !== 'none';
  // von vorn/hinten geht der Armschwung in die Tiefe: kräftiger, und am Umkehrpunkt etwas nach außen, damit man ihn sieht
  const armK = side ? 1 : 1.6, out = side ? 0 : Math.abs(swing) * 1.4;
  const off = h.shield ? { bx: 6 + swing * 0.8, by: -13, bz: 2.5 } : { bx: 1 + swing * ARM * 1.2 * armK, by: -11.8 + Math.abs(swing) * 0.6 };
  return {
    ...c, crouch, lean: 1.6,
    ffx: n.x, ffy: n.y - 4, toeF: n.toe, fbx: f.x, fby: f.y - 4, toeB: f.toe,
    fx: (c.fx ?? 1) - swing * ARM * (hold ? 0.45 : 1) * armK, fy: (c.fy ?? -12) + Math.abs(swing) * 0.5,
    armOut: out,
    ...off,
    hy: 0.3,
    sway: 1.4 + Math.sin(p * Math.PI * 4) * 0.6,
    ...(c.sa !== undefined ? { sa: c.sa + (h.weapon === 'sword' ? swing * 0.15 : 0) } : {}),
  };
}

/** Nahkampf: über den Kopf ausholen, nach vorn-unten schlagen, ausschwingen */
const SWING: RigPose[] = [
  { fx: -1, fy: -21, sa: -2.2, bx: 6, by: -16, crouch: 1.6, lean: -2, ffx: 4, fbx: -5 },
  { fx: -4, fy: -23, sa: -2.75, bx: 7, by: -18, armsFront: true, crouch: 2.4, lean: -3, ffx: 4, fbx: -5 },
  { fx: 10, fy: -22, sa: -1.1, bx: -4, by: -16, crouch: 1.4, lean: 3, ffx: 7, fbx: -6 },
  { fx: 12, fy: -13, sa: 0.55, bx: -5, by: -16, crouch: 3, lean: 4, ffx: 8, fbx: -6, toeB: true },
  { fx: 10, fy: -12, sa: 0.9, bx: -3, by: -14, crouch: 2.6, lean: 3, ffx: 7, fbx: -5 },
  { fx: 6, fy: -12.5, sa: 0.8, bx: -2, by: -12.5, crouch: 1.4, lean: 1.5, ffx: 4, fbx: -3.5 },
];
/** Bogen: anheben, Sehne mit der Zughand ans Kinn ziehen (Pfeil liegt auf), beim Schlagbild loslassen, Bogen senken */
const BOW: RigPose[] = [
  { fx: 8, fy: -17, sa: 0, bx: 7, by: -17, pull: true, nocked: true, crouch: 1.2, lean: 0, ffx: 4, fbx: -4 },
  { fx: 9.5, fy: -18, sa: 0, bx: 1, by: -18.5, pull: true, nocked: true, crouch: 1.6, lean: -1, ffx: 4.5, fbx: -4.5, turn: 0.15 },
  { fx: 10, fy: -18, sa: 0, bx: -2.5, by: -18.5, crouch: 1.6, lean: -1.2, ffx: 4.5, fbx: -4.5, turn: 0.15, twist: -1 },
  { fx: 10, fy: -17.5, sa: 0.05, bx: -3.5, by: -17, crouch: 1.5, lean: -0.8, ffx: 4.5, fbx: -4.5, turn: 0.2 },
  { fx: 7, fy: -15, sa: 0.1, bx: 0, by: -14, crouch: 1.2, lean: 0, ffx: 4, fbx: -4 },
  { fx: 5, fy: -13.5, sa: 0.15, bx: -1, by: -12.5, crouch: 1, lean: 0.4, ffx: 3.5, fbx: -3.5 },
];
/** Stab: beidhändig hoch über den Kopf heben (Kugel leuchtet), dann waagrecht nach vorn stoßen, zurücknehmen */
const STAFF: RigPose[] = [
  { fx: 3, fy: -20, sa: -1.25, bx: 0, by: -16, crouch: 1.2, lean: -1, ffx: 3.5, fbx: -4, hy: -0.6 },
  { fx: 1, fy: -24, sa: -1.5, bx: -1, by: -21, crouch: 2.2, lean: -2.4, ffx: 3.5, fbx: -4.5, hy: -1 },
  { fx: 13, fy: -16, sa: -0.15, two: true, crouch: 2.4, lean: 4, ffx: 8, fbx: -6, toeB: true },
  { fx: 14, fy: -15, sa: -0.05, two: true, crouch: 2.8, lean: 4.5, ffx: 8, fbx: -6, toeB: true },
  { fx: 9, fy: -15, sa: -0.6, bx: 2, by: -13.5, crouch: 1.8, lean: 2, ffx: 6, fbx: -4.5 },
  { fx: 4.5, fy: -14, sa: -1.3, bx: -0.5, by: -12.5, crouch: 1.2, lean: 0.8, ffx: 4, fbx: -3.5 },
];
/** Zweihänder: beidhändiger Hieb */
const GREAT: RigPose[] = SWING.map((k0, j) => {
  const k: RigPose = { ...k0, two: true, wscale: 0.62, crouch: (k0.crouch ?? 0) + (j === 3 ? 0.6 : 0) };
  delete k.bx;
  delete k.by;
  return k;
});

function attackPose(i: number, h: HeroLook): RigPose {
  const at = (keys: RigPose[]): RigPose => keys[Math.min(keys.length - 1, i)]!;
  if (h.weapon === 'bow') return at(BOW);
  if (h.weapon === 'staff') return at(STAFF);
  if (h.weapon === 'greatsword') return at(GREAT);
  const k = at(SWING);
  // Schild bleibt beim Hieb vorn (Fernarm deckt), statt nach hinten auszuschwingen
  return h.shield ? { ...k, bx: 6.5, by: -14, bz: 2.5, armsFront: false } : k;
}

/** Getroffen: Oberkörper zuckt zurück, Kopf nach hinten, Arme öffnen sich */
function hitPose(i: number, h: HeroLook): RigPose {
  const c = carry(h.weapon);
  const k = i === 0 ? 1 : 0.55;
  return { ...c, fx: (c.fx ?? 1) - 2 * k, fy: (c.fy ?? -12) - 1.5 * k, bx: -4 * k, by: -14, crouch: 1.6 * k, lean: -3.2 * k, hy: -1.4 * k, ffx: 3.5, ffy: -4, fbx: -4, fby: -4, sway: -1 };
}

/** Sterben: in die Knie, nach hinten kippen, liegen */
const DIE: RigPose[] = [
  { fx: 2, fy: -15, bx: -3, by: -16, crouch: 2.4, lean: -3, hy: -1.4, ffx: 3, fbx: -4, fall: 0.12 },
  { fx: 1, fy: -13, bx: -4, by: -14, crouch: 4.2, lean: -3.5, hy: -1.6, ffx: 4, fbx: -2, fall: 0.45, fallX: 3 },
  { fx: -2, fy: -14, bx: -6, by: -13, crouch: 4.6, lean: -3, hy: -1.2, ffx: 5, fbx: -1, fall: 0.95, fallX: 7, fallY: -1 },
  { fx: -4, fy: -15, bx: -8, by: -12, crouch: 1.4, lean: -2, hy: -0.5, ffx: 3, fbx: -1, fall: 1.4, fallX: 11, fallY: -4.4 },
  { fx: -5, fy: -15.5, bx: -9, by: -13, crouch: 0.6, lean: -1.5, hy: 0, ffx: 2.5, fbx: -0.5, fall: 1.55, fallX: 12, fallY: -5.6 },
];

export function heroPose(anim: HeroAnim, view: HeroView, i: number, h: HeroLook, g: Gait = HERO_GAIT): RigPose {
  const base = anim === 'walk' ? walkPose(i, h, view, g) : anim === 'attack' ? attackPose(i, h) : anim === 'hit' ? hitPose(i, h) : anim === 'die' ? DIE[Math.min(DIE.length - 1, i)]! : idlePose(i, h);
  const gear: HeroGear = {
    helm: h.helm, pauldron: !h.robe && (h.armor === 'iron' || h.armor === 'dread' || h.armor === 'ash' || h.armor === 'bone'),
    robe: h.robe, cloak: !!h.cloak, quiver: h.quiver, shield: h.shield, crest: h.rar[0] >= 2 && h.helm >= 2 && h.helm <= 4,
  };
  const pose: RigPose = { ...base, weapon: anim === 'die' && i >= 2 ? undefined : RIG_WEAPON[h.weapon], gear, mark: !h.robe };
  const acc = ACCENT[h.rar[2]];
  if (acc) pose.accent = [acc[0], acc[2]];
  if (h.weapon === 'staff') pose.orb = ORBS[Math.min(ORBS.length - 1, h.weaponTier)];
  if (view === 'side') pose.turn = base.turn ?? 0.34 + (anim === 'walk' ? Math.cos((i / HERO_ANIMS.walk) * Math.PI * 2) * 0.08 : 0);
  else {
    // zur Kamera / weg: ganze Figur gedreht; Schritte gehen in die Tiefe, darum Füße auseinander und Knie höher (walkPose)
    pose.yaw = view === 'front' ? Math.PI / 2 : -Math.PI / 2;
    pose.turn = 0.05;
    pose.fzz = 3.3;
    pose.bzz = -3.3;
    // schräge Draufsicht: was näher zur Kamera ist, steht tiefer im Bild (Füße, Knie, Hände), so sieht man Schritt und Armschwung
    // (beim Hieb und mit dem Zweihänder weniger, sonst fährt die Klinge zur Kamera unter den Bildrand; liegend keine)
    pose.shear = anim === 'die' ? SHEAR + (SHEAR_LIE - SHEAR) * Math.min(1, i / 3) : anim === 'attack' || h.weapon === 'greatsword' ? SHEAR_REACH : SHEAR;
    if (anim === 'walk') {
      const p = i / HERO_ANIMS.walk;
      // Hüfte kippt zum Spielbein, Schultern drehen gegen die Beine
      pose.roll = -0.2 * Math.sin((p + 0.05) * Math.PI * 2);
      pose.turn = 0.05 + Math.cos(p * Math.PI * 2) * 0.14;
    }
  }
  return pose;
}

/* ------------------------------------------------ Farben je Material (hell -> dunkel, dazu Naht) */

// Grundpalette bewusst heller als die Welt: das Spiel legt noch eine dunkle Multiplikation (DARK_GRADE) darüber
export const MAT = {
  skin: [0xf0c49c, 0xd29a72, 0xa87254, 0x7a4e3a, 0x4a3024],
  hair: [0x8a6440, 0x6a4a30, 0x4e3422, 0x36241a, 0x22160e],
  cloth: [0x8c9ab4, 0x6c7a96, 0x505c78, 0x3a4258, 0x262a3a],
  trousers: [0x7a7088, 0x5e566c, 0x463f52, 0x322c3c, 0x221e2a],
  leather: [0xc8945a, 0xa07040, 0x7a5030, 0x553620, 0x382414],
  leatherD: [0x98704a, 0x765434, 0x583c24, 0x3e2a18, 0x281a10],
  leatherDread: [0x8a6a8a, 0x684e6a, 0x4c384e, 0x342636, 0x221822],
  leatherBone: [0xd8c4a0, 0xb09a78, 0x88745a, 0x60503e, 0x3e3428],
  leatherAsh: [0xa8705a, 0x845442, 0x623c30, 0x442820, 0x2c1a14],
  iron: [0xdce4ee, 0xaab4c4, 0x7c8698, 0x575f72, 0x3a3f4e],
  chain: [0xa4aab6, 0x80868f, 0x60656e, 0x45484f, 0x2e3036],
  dread: [0x8a84a8, 0x625c80, 0x45405e, 0x302c44, 0x1e1a2c],
  bone: [0xeee6cc, 0xccc2a4, 0xa49a7e, 0x7a725c, 0x4e483a],
  ash: [0xa08478, 0x7c5e56, 0x5c423e, 0x402c2a, 0x2a1c1a],
  acolyte: [0x7a8ed8, 0x5a6cb4, 0x42508c, 0x2e3864, 0x1e2442],
  tabard: [0xc04a3c, 0x9a382e, 0x742822, 0x521a16, 0x340e0c],
  boot: [0x8a6440, 0x6a4a30, 0x4e3622, 0x36241a, 0x22160e],
  belt: [0x8a643a, 0x6a4a2a, 0x50361e, 0x382414, 0x22160c],
  wood: [0xb08050, 0x8a6038, 0x684628, 0x48301c, 0x2e1e12],
  fletch: [0xf0ece0, 0xc8c0b0, 0x9a9080, 0x6a6458, 0x403c34],
} satisfies Record<string, Ramp>;
export const CLOAKS: Record<string, Ramp> = {
  rag: [0x9a8a72, 0x7a6c58, 0x5c5042, 0x40382e, 0x2a241e],
  wool: [0xa8504a, 0x843a36, 0x642a28, 0x461c1c, 0x2e1212],
  hunter: [0x72905a, 0x567044, 0x405432, 0x2c3a22, 0x1c2616],
  wolf: [0xb4b0aa, 0x8e8a86, 0x6a6764, 0x4a4846, 0x302e2e],
  dread: [0x6a5a8a, 0x4e4268, 0x38304c, 0x262034, 0x181420],
  ash: [0x6e6260, 0x544a48, 0x3e3634, 0x2a2424, 0x1a1616],
  ember: [0xd2643a, 0xa84a2a, 0x7e361e, 0x582414, 0x38160c],
  rime: [0xa8d0e8, 0x80a8c8, 0x5e82a4, 0x42607c, 0x2a3e52],
};
/** Seltenheitsakzent (Saum, Kamm, Parierstange): magisch blau, selten gold, Set grün, legendär glut */
export const ACCENT: (Ramp | undefined)[] = [
  undefined,
  [0x9ab4ff, 0x6f8fff, 0x4a64c8, 0x34468e, 0x222e5c],
  [0xffe08a, 0xf2c94c, 0xc09a30, 0x86681e, 0x544010],
  [0x9ae88a, 0x5fd070, 0x3e9a4e, 0x2a6a36, 0x184020],
  [0xffb066, 0xff8a2a, 0xc8601a, 0x8a4010, 0x562608],
];
const ORBS: number[][] = [[0x9ad0ff, 0x4a7ac8], [0x8ae0ff, 0x3a8ab8], [0xc0a0ff, 0x6a48c8], [0x8af0e8, 0x2a9a90], [0xffb060, 0xc8601a], [0xd890ff, 0x8a3ac8]];
const OUTLINE = 0x0c0a0e;
const MARK_COL = 0xc8a048; // Gürtelschnalle/Brustmarke: Bronze

function materials(h: HeroLook): Record<number, Ramp> {
  const metal = (m: HeroMat): Ramp => (m === 'leatherDread' ? MAT.leatherDread : m === 'leatherBone' ? MAT.leatherBone : m === 'leatherAsh' ? MAT.leatherAsh : m === 'iron' ? MAT.iron : m === 'dread' ? MAT.dread : m === 'bone' ? MAT.bone : m === 'ash' ? MAT.ash : m === 'leather' ? MAT.leather : m === 'acolyte' ? MAT.acolyte : MAT.cloth);
  const heavy = h.armor === 'iron' || h.armor === 'dread' || h.armor === 'ash' || h.armor === 'bone';
  const body = metal(h.armor);
  const leathery = h.armor === 'leather' || h.armor.startsWith('leather');
  const sleeve = h.robe ? body : heavy ? MAT.chain : leathery ? MAT.leatherD : MAT.cloth;
  const acc = ACCENT[h.rar[1]];
  // schwere Rüstung trägt einen Wappenrock um die Hüfte (rot, ab magisch in Seltenheitsfarbe), Leder einen dunklen Wams-Saum
  const waist = h.robe ? body : heavy ? acc ?? MAT.tabard : leathery ? MAT.leatherD : MAT.cloth;
  const fore = h.gloves === 2 ? MAT.iron : h.gloves === 1 ? MAT.leather : heavy ? MAT.chain : MAT.skin;
  const hand = h.gloves === 2 ? MAT.iron : h.gloves === 1 ? MAT.leatherD : MAT.skin;
  const shin = h.legs === 2 ? MAT.iron : MAT.boot;
  const m: Record<number, Ramp> = {};
  const set = (names: (keyof typeof PART)[], r: Ramp): void => {
    for (const n of names) m[PART[n]!] = r;
  };
  set(['chest', 'belly'], body);
  set(['waist'], waist);
  set(['pelvis'], MAT.belt);
  set(['neck'], heavy ? MAT.chain : MAT.skin);
  set(['head'], MAT.hair);
  set(['face'], MAT.skin);
  set(['helm'], metal(h.helmMat));
  set(['hood'], h.helmMat === 'cloth' ? CLOAKS[h.cloak] ?? MAT.trousers : metal(h.helmMat));
  set(['upperN', 'elbowN', 'upperF', 'elbowF'], sleeve);
  set(['foreN', 'foreF'], fore);
  set(['handN', 'handF'], hand);
  set(['thighN', 'kneeN', 'thighF', 'kneeF'], h.legs === 2 ? MAT.chain : MAT.trousers);
  set(['shinN', 'shinF'], shin);
  set(['footN', 'footF'], h.legs === 2 ? MAT.iron : MAT.boot);
  set(['pauldronN', 'pauldronF'], body);
  set(['robe'], body);
  set(['robeHem'], acc ?? MAT.belt);
  const cloak = CLOAKS[h.cloak] ?? CLOAKS.rag!;
  set(['cloak'], cloak);
  set(['cloakHem'], ACCENT[Math.max(h.rar[1], 0)] ?? cloak);
  set(['quiver'], MAT.leatherD);
  set(['fletch'], MAT.fletch);
  set(['crest'], ACCENT[h.rar[0]] ?? MAT.tabard);
  set(['shield'], h.shield === 1 ? MAT.wood : h.shield === 3 ? MAT.tabard : MAT.iron);
  set(['shieldRim'], h.shield === 1 ? MAT.iron : MAT.chain);
  set(['shieldBoss'], MAT.iron);
  return m;
}

/* ------------------------------------------------ Backen */

export type HeroSheet = FigureSheet;

export function heroSpec(h: HeroLook): FigureSpec {
  return {
    key: heroKey(h),
    frame: HERO_FRAME,
    anims: HERO_ANIMS,
    render: (anim, view, i) => posed(heroPose(anim, view, i, h)),
    mats: materials(h),
    fallback: MAT.cloth,
    outline: OUTLINE,
    eye: 0x2a1c18,
    mark: MARK_COL,
    loose: new Set([PART.weapon!, PART.offWeapon!]),
    cyclePx: HERO_CYCLE_PX,
    wind: HERO_WIND_FRAMES,
  };
}

export function bakeHero(h: HeroLook): HeroSheet {
  return bakeFigure(heroSpec(h));
}

/** Atembild im Stehen: ein Atemzug ca. 2,8 s (Aufrufer versetzt die Zeit je Figur) */
export function idleFrame(time: number, n = HERO_ANIMS.idle): number {
  return Math.floor(time / 700) % n;
}
