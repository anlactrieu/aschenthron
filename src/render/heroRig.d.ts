/** Typen zum Rig-Remix `heroRig.js` (pixelfx-Skelett, MIT). */
export interface HeroGear {
  /** 0 kein Helm, 1 Lederkappe, 2 Eisenhelm mit Nasenschutz */
  helm?: number;
  pauldron?: boolean;
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
export const SHADE: { CORE: number; SEAM: number; INK: number; MARK: number; STEEL: number };
export const PART: Record<string, number>;
export const STAND: RigPose;
export function posed(pose: RigPose): Posed;
export function shortfall(pose: RigPose): number;
