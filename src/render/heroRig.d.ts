/** Typen zum Rig-Remix `heroRig.js` (pixelfx-Skelett, MIT). */
export interface HeroGear {
  /** 0 kein Helm, 1 Kappe, 2 Eisenhelm mit Nasenschutz, 3 Topfhelm, 4 Kronenhelm, 5 Kapuze */
  helm?: number;
  pauldron?: boolean;
  /** Schild am Fernarm: 1 rund, 2 Kite, 3 Turm */
  shield?: number;
  cloak?: boolean;
  robe?: boolean;
  quiver?: boolean;
  /** Kamm/Federbusch auf dem Kopf */
  crest?: boolean;
  /** Spitzhut */
  hat?: boolean;
  /** Ohrenlänge (Goblin ~1) */
  ears?: number;
  horns?: number;
  tail?: number;
  wings?: number;
  /** Schnauze/Gesichtslänge (1 normal) */
  snout?: number;
  beard?: number;
  /** Faustgröße (1 normal) */
  fists?: number;
  /** Fußlänge (1 normal) */
  feet?: number;
  /** ohne Beine, Robe bis zum Boden */
  ghost?: boolean;
}
/** Körperbau (alles 1 = der Held); `size` skaliert Figur, Posen und Waffe */
export interface RigBody {
  size?: number;
  legs?: number;
  arms?: number;
  torso?: number;
  head?: number;
  width?: number;
  limb?: number;
  belly?: number;
  neck?: number;
  /** Lichtsaum oben/links (Standard an) */
  rim?: boolean;
}
export interface RigPose {
  lean?: number;
  crouch?: number;
  yaw?: number;
  turn?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  bx?: number;
  by?: number;
  bz?: number;
  ffx?: number;
  ffy?: number;
  fzz?: number;
  fbx?: number;
  fby?: number;
  bzz?: number;
  toeF?: boolean;
  toeB?: boolean;
  weapon?: string;
  sa?: number;
  wl?: number;
  two?: boolean;
  armsFront?: boolean;
  hy?: number;
  hx?: number;
  twist?: number;
  gear?: HeroGear;
  body?: RigBody;
  /** Bogen: Sehne an der Zughand, Pfeil aufgelegt */
  pull?: boolean;
  nocked?: boolean;
  /** Umkippen (Bogenmaß, > 0 nach hinten) und Verschieben danach */
  fall?: number;
  fallX?: number;
  fallY?: number;
  /** ganze Figur anheben (negativ = hoch) */
  y?: number;
  /** Umhang/Schwanz schwingen */
  sway?: number;
  /** Umfärben der Waffe: je 2 (accent, orb, wood) bzw. 4 (blade) Farben 0xRRGGBB */
  accent?: number[];
  orb?: number[];
  blade?: number[];
  wood?: number[];
  wscale?: number;
  eyes?: boolean;
  mark?: boolean;
  face?: number;
  sb?: number;
  offWeapon?: string;
}
export interface Posed {
  n: number;
  xs: Int16Array;
  ys: Int16Array;
  /** 0xRRGGBB, nur für Stahl gültig */
  color: Uint32Array;
  /** Schattierungscode, siehe SHADE */
  shade: Uint8Array;
  /** Teilnummer, siehe PART */
  part: Uint8Array;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export const SHADE: { CORE: number; SEAM: number; INK: number; MARK: number; STEEL: number; EYE: number };
export const PART: Record<string, number>;
export const STAND: RigPose;
export function posed(pose: RigPose): Posed;
export function shortfall(pose: RigPose): number;
