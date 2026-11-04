/**
 * Zonen der Karte fürs Zeichnen (Außenwelt und Dungeons): Zonennummer je Kachel aus den Regionen. Boden, Details und
 * Props je Zone malt die Code-Welt (`world/ground.ts`, `world/details.ts`). Reine Optik, nichts davon steht in der Sim.
 */

/** Zone je Kachel (Index in `ZONE_NAMES`, 0 = keine Zone oder Stadt/Meer) */
export const ZONE_NAMES = ['', 'Roggenfelder', 'Düsterwald', 'Räuberlager', 'Moorlande', 'Totenacker', 'Hochland', 'Aschenöde', 'Aschengrund', 'Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche', 'Goblinbau', 'Spinnennest'];
export const Z = { none: 0, farm: 1, forest: 2, camp: 3, swamp: 4, grave: 5, hills: 6, ash: 7, grund: 8, gruft: 9, kata: 10, mine: 11, thron: 12, goblin: 13, nest: 14 } as const;

import { fbm } from './world/raster';

/** Freilandzonen (Wiesenarten): nur ihre Grenzen untereinander werden verschlungen, Dungeons und Städte bleiben scharf */
const isOpen = (z: number): boolean => z >= Z.farm && z <= Z.grund;
/** Größte Verschiebung (Kacheln) der Zonengrenzen durch Rauschen */
const BORDER_WARP = 16;

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
  return meander(out, gw, gh);
}

/**
 * Regionen sind Rechtecke: Grenzen zwischen zwei Freilandzonen verlaufen über mehrere Kacheln durchs Rauschen, indem jede
 * Kachel die Zone einer verschobenen Nachbarkachel übernimmt (nur wenn beide Freiland sind).
 */
function meander(src: Uint8Array, gw: number, gh: number): Uint8Array {
  const out = src.slice();
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const z = src[y * gw + x]!;
      if (!isOpen(z)) continue;
      // Nur in der Nähe einer Grenze rechnen (Verschiebung reicht höchstens BORDER_WARP + 2 Kacheln)
      const r = BORDER_WARP + 2;
      let near = false;
      for (let dy = -r; dy <= r && !near; dy += 3) for (let dx = -r; dx <= r; dx += 3) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && src[ny * gw + nx] !== z) { near = true; break; }
      }
      if (!near) continue;
      const wx = (fbm(x, y, 14, 311) - 0.5) * 2 * BORDER_WARP + (fbm(x, y, 5, 312) - 0.5) * 2;
      const wy = (fbm(x, y, 14, 313) - 0.5) * 2 * BORDER_WARP + (fbm(x, y, 5, 314) - 0.5) * 2;
      const sx = Math.min(gw - 1, Math.max(0, Math.round(x + wx)));
      const sy = Math.min(gh - 1, Math.max(0, Math.round(y + wy)));
      const zz = src[sy * gw + sx]!;
      if (isOpen(zz)) out[y * gw + x] = zz;
    }
  }
  return out;
}
