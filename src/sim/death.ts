import type { Item } from './items';

/**
 * Todesstrafe gegen Monster (P4), angelehnt an die Server-Einstellungen von The 4th Coming / D4O
 * (Realmud-Server: XP 10 % der Stufen-XP, Gold 10 %, Rucksack 5 %, Ausrüstung 0 %; Quellen in SPEC.md).
 * Abweichungen: sanfte Staffelung für Neulinge, Rucksack-Gegenstände liegen als Leichenhaufen
 * an der Todesstelle (bergbar), Gold ist wie bei T4C verloren, Besitzersperre am Haufen.
 * Alle Werte hängen nur von der Stufe ab (kein Zufall), damit Mehrspieler und Tests deterministisch bleiben.
 */
export interface DeathRules {
  /** Anteil der XP, die seit dem letzten Aufstieg gesammelt wurden */
  xpFrac: number;
  /** Anteil des mitgeführten Goldes */
  goldFrac: number;
  /** Anteil der verlierbaren Rucksack-Gegenstände (aufgerundet, mindestens 1) */
  itemFrac: number;
  /** Höchstzahl fallender Gegenstände */
  itemMax: number;
}

export const NEWBIE_SAFE_LEVEL = 5;
export const MID_LEVEL = 10;

export function deathRules(level: number): DeathRules {
  if (level <= NEWBIE_SAFE_LEVEL) return { xpFrac: 0, goldFrac: 0, itemFrac: 0, itemMax: 0 };
  if (level <= MID_LEVEL) return { xpFrac: 0.05, goldFrac: 0.05, itemFrac: 0.1, itemMax: 1 };
  return { xpFrac: 0.1, goldFrac: 0.1, itemFrac: 0.1, itemMax: 3 };
}

/** Verlierbar sind Waffen, Rüstung, Schmuck usw. Tränke, Edelsteine, benannte Funde und Unikate nie (D4O nimmt Sonderstücke aus Leichenhaufen aus). */
export function droppable(i: Item): boolean {
  return i.slot !== 'potion' && i.slot !== 'gem' && !i.named && !i.unique;
}

/** Wie viele der `n` verlierbaren Gegenstände fallen. */
export function dropCount(rules: DeathRules, n: number): number {
  if (n <= 0 || rules.itemMax <= 0) return 0;
  return Math.min(rules.itemMax, n, Math.max(1, Math.ceil(n * rules.itemFrac)));
}

/** Besitzersperre am Leichenhaufen (Ticks bei 20/s: 60 s). */
export const CORPSE_OWNER_TICKS = 20 * 60;
