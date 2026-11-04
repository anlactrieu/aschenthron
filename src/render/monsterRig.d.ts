/** Typen zu den Tier-Skeletten `monsterRig.js`. */
import type { Posed } from './heroRig.js';

export interface BeastBody {
  type: 'quad' | 'spider' | 'worm' | 'wisp';
  size?: number;
  /** Rumpflänge, Schulterhöhe, Rumpfdicke, Kopfgröße (1x-Pixel bei size 1) */
  len?: number;
  height?: number;
  girth?: number;
  head?: number;
  snout?: number;
  ears?: number;
  earsRound?: boolean;
  tail?: number;
  tailR?: number;
  legR?: number;
  legLen?: number;
  mane?: number;
  horns?: number;
  /** Spinne: Zeichnung auf dem Hinterleib, Krone (Bosse); Wurm: Stacheln */
  mark?: boolean;
  crown?: boolean;
  spikes?: boolean;
}
export const BEAST_PART: Record<string, number>;
export const SPIDER_STRIDE: number;
export function beastPosed(b: BeastBody, anim: string, view: string, i: number, n: number): Posed;
