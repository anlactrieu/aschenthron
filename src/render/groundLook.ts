/**
 * Zonen der Karte fürs Zeichnen (Außenwelt und Dungeons): Zonennummer je Kachel aus den Regionen. Boden, Details und
 * Props je Zone malt die Code-Welt (`world/ground.ts`, `world/details.ts`). Reine Optik, nichts davon steht in der Sim.
 */

/** Zone je Kachel (Index in `ZONE_NAMES`, 0 = keine Zone oder Stadt/Meer) */
export const ZONE_NAMES = ['', 'Roggenfelder', 'Düsterwald', 'Räuberlager', 'Moorlande', 'Totenacker', 'Hochland', 'Aschenöde', 'Aschengrund', 'Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche', 'Goblinbau', 'Spinnennest'];
export const Z = { none: 0, farm: 1, forest: 2, camp: 3, swamp: 4, grave: 5, hills: 6, ash: 7, grund: 8, gruft: 9, kata: 10, mine: 11, thron: 12, goblin: 13, nest: 14 } as const;

/** Zonenkarte aus den Regionen: kleinste Region gewinnt, Städte und unbekannte Namen zählen als „keine Zone“. */
export function buildZoneMap(regions: { x: number; y: number; w: number; h: number; name: string }[], gw: number, gh: number, tileSize = 1): Uint8Array {
  const out = new Uint8Array(gw * gh);
  const sorted = [...regions].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const r of sorted) {
    const id = Math.max(0, ZONE_NAMES.indexOf(r.name));
    const x0 = Math.max(0, Math.floor(r.x / tileSize));
    const y0 = Math.max(0, Math.floor(r.y / tileSize));
    const x1 = Math.min(gw, Math.ceil((r.x + r.w) / tileSize));
    const y1 = Math.min(gh, Math.ceil((r.y + r.h) / tileSize));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y * gw + x] = id;
  }
  return out;
}
