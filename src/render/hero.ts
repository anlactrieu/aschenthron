/**
 * Skelett-Held (pixelfx-Rig-Remix `heroRig.js`): Posen für Stehen, Gehen und Nahkampf in drei Ansichten (Seite, zur Kamera,
 * weg; links = Seite gespiegelt), Material je Körperteil aus der Ausrüstung, gebacken zu einem RGBA-Sheet je Look.
 * Reine Daten und Rechnung ohne DOM: läuft in Node (Kontaktbögen `scripts/bake-hero.ts`, Tests) und im Browser (`heroSheet`).
 */
import type { Look } from './art';
import { PART, posed, SHADE, type RigPose } from './heroRig.js';

export type HeroView = 'side' | 'front' | 'back';
export type HeroAnim = 'idle' | 'walk' | 'attack';
export type HeroWeapon = 'none' | 'sword' | 'bow' | 'staff';

export const HERO_VIEWS: HeroView[] = ['side', 'front', 'back'];
/** Bilder je Animation */
export const HERO_ANIMS: Record<HeroAnim, number> = { idle: 4, walk: 8, attack: 6 };
/** Bildgröße und Fußpunkt bei 1x (Pixelmaßstab im Spiel: 2x) */
export const HERO_FRAME = { w: 64, h: 60, fx: 32, fy: 56 };
/** Angriff: so viele Bilder Ausholen, danach kommt das Schlagbild (passt zu 40 % Ausholen in `SWING_MS`) */
export const HERO_WIND_FRAMES = 2;

export interface HeroLook {
  /** 0 Tuch, 1 Leder, 2 Eisen */
  armor: number;
  /** 0 kein Helm, 1 Lederkappe, 2 Eisenhelm */
  helm: number;
  /** 0 keine, 1 Leder, 2 Eisen */
  gloves: number;
  weapon: HeroWeapon;
}

/** Material aus der Vorlagen-ID (Eisen/Leder), sonst nach Stufe; 0 = nichts angelegt. */
function material(id: string, t: number, iron: RegExp, leather: RegExp): number {
  if (!id) return 0;
  if (iron.test(id)) return 2;
  if (leather.test(id)) return 1;
  return t >= 2 ? 2 : 1;
}

export function heroLookOf(look: Look): HeroLook {
  const i = look.ids;
  return {
    // Roben vorerst als Tuch (eigene Form kommt mit der nächsten Ausrüstungsrunde)
    armor: look.robe ? 0 : material(i.chest, look.chest, /plate|mail|cuirass/, /leather|vest/),
    helm: material(i.head, look.head, /helm|visor|crown/, /cap|hood/),
    gloves: material(i.hands, look.hands, /gauntlet|fists/, /glove/),
    weapon: look.weapon < 0 ? 'none' : look.weaponKind === 1 ? 'bow' : look.weaponKind === 2 ? 'staff' : 'sword',
  };
}

export function heroKey(h: HeroLook): string {
  return `hero_${h.armor}${h.helm}${h.gloves}_${h.weapon}`;
}

/* ------------------------------------------------ Posen (Bildschirm-Pixel bei 1x, y negativ = oben, Blick nach rechts) */

const RIG_WEAPON: Record<HeroWeapon, string | undefined> = { none: undefined, sword: 'shortsword', bow: 'smallbow', staff: 'staff' };
const STRIDE = 4.2;
const LIFT = 2.4;
const ARM = 3.4;

/** Fuß in Phase p (0..1): Standbein gleitet zurück, Schwungbein hebt sich (aus der Gang-Probe, kürzere Beine). */
function foot(p: number, lift: number): { x: number; y: number; toe: boolean } {
  const q = ((p % 1) + 1) % 1;
  if (q < 0.5) return { x: STRIDE - (q / 0.5) * 2 * STRIDE, y: -4, toe: q > 0.38 };
  const s = (q - 0.5) / 0.5;
  const e = 0.5 - 0.5 * Math.cos(s * Math.PI);
  return { x: -STRIDE + e * 2 * STRIDE, y: -4 - Math.sin(s * Math.PI) * LIFT * lift, toe: false };
}

/** Haltung der Waffenhand im Stehen/Gehen je Waffe */
function carry(weapon: HeroWeapon): RigPose {
  if (weapon === 'sword') return { fx: 4, fy: -12.5, sa: 0.75 };
  if (weapon === 'staff') return { fx: 3.5, fy: -13.5, sa: -1.45 };
  if (weapon === 'bow') return { fx: 3.5, fy: -13, sa: 0.15 }; // quer gehaltene Waffe: sa 0 = Bogen senkrecht
  return { fx: 1, fy: -11.5 };
}

function idlePose(i: number, weapon: HeroWeapon): RigPose {
  const b = Math.sin((i / HERO_ANIMS.idle) * Math.PI * 2); // Atmen: Brust hebt und senkt sich
  const c = carry(weapon);
  return { ...c, crouch: 0.9 - b * 0.45, lean: 0.6, fy: (c.fy ?? -12) + b * 0.4, bx: -1.5, by: -11.6 + b * 0.4, ffx: 3, fbx: -3.2, hy: 0.2 };
}

function walkPose(i: number, weapon: HeroWeapon, view: HeroView): RigPose {
  const p = i / HERO_ANIMS.walk;
  const side = view === 'side';
  const n = foot(p, side ? 1 : 1.6);
  const f = foot(p + 0.5, side ? 1 : 1.6);
  const swing = Math.cos(p * Math.PI * 2);
  const crouch = 1 + 0.8 * Math.cos((p - 0.08) * Math.PI * 4);
  const c = carry(weapon);
  const hold = weapon !== 'none';
  return {
    ...c, crouch, lean: 1,
    ffx: n.x, ffy: n.y, toeF: n.toe, fbx: f.x, fby: f.y, toeB: f.toe,
    fx: (c.fx ?? 1) - swing * ARM * (hold ? 0.45 : 1), fy: (c.fy ?? -12) + Math.abs(swing) * 0.5,
    bx: 1 + swing * ARM * 1.2, by: -11.8 + Math.abs(swing) * 0.6,
    hy: 0.3,
    ...(c.sa !== undefined ? { sa: c.sa + (weapon === 'sword' ? swing * 0.15 : 0) } : {}),
  };
}

/** Nahkampf (alle Waffen holen über den Kopf aus und schlagen nach vorn-unten; Bogen/Stab vorerst Platzhalter). */
function attackPose(i: number, weapon: HeroWeapon): RigPose {
  const keys: RigPose[] = [
    { fx: -1, fy: -21, sa: -2.2, bx: 6, by: -16, crouch: 1.6, lean: -2, ffx: 4, fbx: -5 },
    { fx: -4, fy: -23, sa: -2.75, bx: 7, by: -18, armsFront: true, crouch: 2.4, lean: -3, ffx: 4, fbx: -5 },
    { fx: 10, fy: -22, sa: -1.1, bx: -4, by: -16, crouch: 1.4, lean: 3, ffx: 7, fbx: -6 },
    { fx: 12, fy: -13, sa: 0.55, bx: -5, by: -16, crouch: 3, lean: 4, ffx: 8, fbx: -6, toeB: true },
    { fx: 10, fy: -12, sa: 0.9, bx: -3, by: -14, crouch: 2.6, lean: 3, ffx: 7, fbx: -5 },
    { fx: 6, fy: -12.5, sa: 0.8, bx: -2, by: -12.5, crouch: 1.4, lean: 1.5, ffx: 4, fbx: -3.5 },
  ];
  const k = keys[Math.min(keys.length - 1, i)]!;
  if (weapon === 'staff') return { ...k, sa: (k.sa ?? 0) - 1.4 };
  if (weapon === 'bow') {
    // Bogen: anheben, Sehnenhand zieht zurück, beim Schlagbild loslassen (Hand springt nach hinten), dann senken
    const bow: RigPose[] = [
      { fx: 8, fy: -17, sa: 0, bx: 4, by: -17, crouch: 1.2, lean: 0, ffx: 4, fbx: -4 },
      { fx: 9, fy: -18, sa: 0, bx: 1, by: -18, crouch: 1.6, lean: -1, ffx: 4, fbx: -4 },
      { fx: 9, fy: -18, sa: 0, bx: -3, by: -19, crouch: 1.6, lean: -1, ffx: 4, fbx: -4 },
      { fx: 9, fy: -17.5, sa: 0.05, bx: -3.5, by: -18, crouch: 1.4, lean: -0.5, ffx: 4, fbx: -4 },
      { fx: 7, fy: -15, sa: 0.1, bx: 0, by: -14, crouch: 1.2, lean: 0, ffx: 4, fbx: -4 },
      { fx: 5, fy: -13.5, sa: 0.15, bx: -1, by: -12.5, crouch: 1, lean: 0.4, ffx: 3.5, fbx: -3.5 },
    ];
    return bow[Math.min(bow.length - 1, i)]!;
  }
  return k;
}

export function heroPose(anim: HeroAnim, view: HeroView, i: number, h: HeroLook): RigPose {
  const base = anim === 'walk' ? walkPose(i, h.weapon, view) : anim === 'attack' ? attackPose(i, h.weapon) : idlePose(i, h.weapon);
  const pose: RigPose = { ...base, weapon: RIG_WEAPON[h.weapon], gear: { helm: h.helm, pauldron: h.armor >= 2 } };
  if (view === 'side') pose.turn = 0.34 + (anim === 'walk' ? Math.cos((i / HERO_ANIMS.walk) * Math.PI * 2) * 0.08 : 0);
  else {
    // zur Kamera / weg: ganze Figur gedreht; Schritte gehen in die Tiefe, darum Füße auseinander und Knie höher (walkPose)
    pose.yaw = view === 'front' ? Math.PI / 2 : -Math.PI / 2;
    pose.turn = 0.05;
    pose.fzz = 3.3;
    pose.bzz = -3.3;
    if (anim === 'walk') {
      // Schräge Draufsicht: der Fuß weiter weg von der Kamera steht höher im Bild, so sieht man den Schritt
      const away = (x: number): number => (view === 'front' ? STRIDE - x : x + STRIDE) * 0.32;
      pose.ffy = (pose.ffy ?? -4) - away(pose.ffx ?? 0);
      pose.fby = (pose.fby ?? -4) - away(pose.fbx ?? 0);
    }
  }
  return pose;
}

/* ------------------------------------------------ Farben je Material (hell -> dunkel, dazu Naht) */

type Ramp = readonly [number, number, number, number, number];
const MAT: Record<string, Ramp> = {
  skin: [0xe0b08a, 0xc08a66, 0x96664c, 0x6a4434, 0x4a3024],
  hair: [0x6a4a30, 0x4e3422, 0x3a2618, 0x2a1a10, 0x1e120a],
  tunic: [0x6a7a94, 0x4e5c76, 0x3a4458, 0x2a3040, 0x1e222e],
  leather: [0xa87a4a, 0x845a34, 0x624026, 0x452c1a, 0x301e12],
  leatherD: [0x7e5a3a, 0x5e4028, 0x452e1c, 0x302014, 0x22160e],
  iron: [0xc4ccd8, 0x939cac, 0x687082, 0x474d5c, 0x323642],
  chain: [0x8c929e, 0x6c727e, 0x50545e, 0x383b44, 0x282a32],
  cloth: [0x5a5466, 0x443f50, 0x332e3c, 0x25212c, 0x1a1720],
  tabard: [0x9a3a30, 0x7a2a24, 0x5a1e1a, 0x3e1412, 0x2a0e0c],
  sleeve: [0x7a2e26, 0x5e221c, 0x461814, 0x32100e, 0x240c0a],
  boot: [0x6a4a30, 0x4e3622, 0x3a2818, 0x2a1c10, 0x1e140c],
  belt: [0x6a4a2a, 0x50361e, 0x3a2614, 0x2a1a0e, 0x1e1208],
};
const OUTLINE = 0x0c0a0e;
const MARK_COL = 0xb08a3a; // Gürtelschnalle/Brustmarke: Bronze

function materials(h: HeroLook): Record<number, Ramp> {
  const body = h.armor === 2 ? MAT.iron! : h.armor === 1 ? MAT.leather! : MAT.tunic!;
  const sleeve = h.armor === 2 ? MAT.chain! : h.armor === 1 ? MAT.sleeve! : MAT.tunic!;
  // Eisen trägt einen roten Wappenrock um die Hüfte, Leder einen dunkleren Lederwams-Saum
  const waist = h.armor === 2 ? MAT.tabard! : h.armor === 1 ? MAT.leatherD! : MAT.tunic!;
  const fore = h.gloves === 2 ? MAT.iron! : h.gloves === 1 ? MAT.leather! : h.armor === 2 ? MAT.chain! : MAT.skin!;
  const hand = h.gloves === 2 ? MAT.iron! : h.gloves === 1 ? MAT.leatherD! : MAT.skin!;
  const shin = h.armor === 2 ? MAT.iron! : MAT.cloth!;
  const m: Record<number, Ramp> = {};
  const set = (names: string[], r: Ramp): void => {
    for (const n of names) m[PART[n]!] = r;
  };
  set(['chest'], body);
  set(['waist'], waist);
  set(['pelvis'], MAT.belt!);
  set(['neck'], h.armor === 2 ? MAT.chain! : MAT.skin!);
  set(['head'], h.helm === 2 ? MAT.iron! : MAT.hair!);
  set(['face'], MAT.skin!);
  set(['helm'], h.helm === 2 ? MAT.iron! : MAT.leather!);
  set(['upperN', 'elbowN', 'upperF', 'elbowF'], sleeve);
  set(['foreN', 'foreF'], fore);
  set(['handN', 'handF'], hand);
  set(['thighN', 'kneeN', 'thighF', 'kneeF'], MAT.cloth!);
  set(['shinN', 'shinF'], shin);
  set(['footN', 'footF'], MAT.boot!);
  set(['pauldronN', 'pauldronF'], MAT.iron!);
  return m;
}

/* ------------------------------------------------ Backen */

export interface HeroSheet {
  /** Breite/Höhe des Sheets bei 1x */
  w: number;
  h: number;
  data: Uint8ClampedArray;
  /** Bildname `${anim}_${view}_${i}` -> Ecke links oben bei 1x */
  frames: Record<string, { x: number; y: number }>;
  /** Kopfhöhe über dem Fußpunkt und Körperbreite (ohne Waffe), 1x */
  top: number;
  bodyW: number;
}

/** Zeilen des Sheets: je Ansicht eine Zeile, Spalten = idle, walk, attack hintereinander */
const COLS = HERO_ANIMS.idle + HERO_ANIMS.walk + HERO_ANIMS.attack;

export function bakeHero(h: HeroLook): HeroSheet {
  const { w: FW, h: FH, fx: FX, fy: FY } = HERO_FRAME;
  const W = FW * COLS;
  const H = FH * HERO_VIEWS.length;
  const data = new Uint8ClampedArray(W * H * 4);
  const frames: HeroSheet['frames'] = {};
  const mats = materials(h);
  let top = 0;
  let bodyW = 0;
  HERO_VIEWS.forEach((view, row) => {
    let col = 0;
    for (const anim of ['idle', 'walk', 'attack'] as HeroAnim[]) {
      for (let i = 0; i < HERO_ANIMS[anim]; i++, col++) {
        const r = posed(heroPose(anim, view, i, h));
        const ox = col * FW;
        const oy = row * FH;
        frames[`${anim}_${view}_${i}`] = { x: ox, y: oy };
        let bx0 = 1e9;
        let bx1 = -1e9;
        for (let k = 0; k < r.n; k++) {
          const x = r.xs[k]! + FX;
          const y = r.ys[k]! + FY;
          if (x < 0 || y < 0 || x >= FW || y >= FH) continue;
          const sh = r.shade[k]!;
          const part = r.part[k]!;
          let c: number;
          if (sh === SHADE.INK) c = OUTLINE;
          else if (sh === SHADE.STEEL) c = r.color[k]!;
          else if (sh === SHADE.MARK) c = MARK_COL;
          else {
            const ramp = mats[part] ?? MAT.cloth!;
            c = sh === SHADE.SEAM ? ramp[4] : ramp[sh >= SHADE.CORE ? Math.min(3, sh - SHADE.CORE + 1) : sh]!;
          }
          const o = ((oy + y) * W + ox + x) * 4;
          data[o] = (c >> 16) & 255;
          data[o + 1] = (c >> 8) & 255;
          data[o + 2] = c & 255;
          data[o + 3] = 255;
          if (part !== PART.weapon && part !== PART.offWeapon) {
            bx0 = Math.min(bx0, x);
            bx1 = Math.max(bx1, x);
            if (anim === 'idle') top = Math.max(top, FY - y);
          }
        }
        if (anim === 'idle') bodyW = Math.max(bodyW, bx1 - bx0 + 1);
      }
    }
  });
  return { w: W, h: H, data, frames, top, bodyW };
}

/**
 * Bild der Laufanimation aus der zurückgelegten Strecke (Bildschirm-Pixel), damit die Füße nicht übers Pflaster gleiten:
 * ein Zyklus = HERO_CYCLE_PX.
 */
export const HERO_CYCLE_PX = 64;
export function walkFrame(dist: number): number {
  const n = HERO_ANIMS.walk;
  return ((Math.floor((dist / HERO_CYCLE_PX) * n) % n) + n) % n;
}

/** Angriffsbild aus dem Fortschritt 0..1 des Hiebs: Ausholen bis 0,4, ab dort Schlag und Ausschwingen. */
export function attackFrame(k: number): number {
  const n = HERO_ANIMS.attack;
  if (k < 0.4) return Math.min(HERO_WIND_FRAMES - 1, Math.floor((k / 0.4) * HERO_WIND_FRAMES));
  return Math.min(n - 1, HERO_WIND_FRAMES + Math.floor(((k - 0.4) / 0.6) * (n - HERO_WIND_FRAMES)));
}

/** Atembild im Stehen */
export function idleFrame(time: number): number {
  return Math.floor(time / 260) % HERO_ANIMS.idle;
}
