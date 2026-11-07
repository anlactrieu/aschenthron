/**
 * Häuser der Stadt als Gebäude: In der Karte sind Häuser Wandringe (gid 18) mit Dielenboden (gid 15) innen und einer Türkachel
 * (gid 28..37). Zur Laufzeit werden diese Rechtecke erkannt (`detectHouses`); Karte und Sim bleiben unverändert. Gezeichnet wird
 * das Haus in isoHouses.ts / isoHouseArt.ts. Hier liegen die Erkennung, das Berufsschild und die Außendeko.
 */
import { DOOR_ICONS, TOWN_GID, drawDoorIcon, type DoorIcon } from './town';
import { INK, Raster, h3, mix, type Rgb } from './world/raster';

export const HOUSE_VARIANTS = 5;

export interface House {
  x0: number;
  y0: number;
  /** Außenmaß in Kacheln (inkl. Wandring) */
  w: number;
  h: number;
  variant: number;
  door: { x: number; y: number; icon: DoorIcon; side: 'N' | 'S' | 'E' | 'W' } | null;
}

/** Findet Häuser: Ecke oben links ist Wand (18), diagonal innen liegt Dielenboden (15); Maß aus dem Innenbereich. */
export function detectHouses(tiles: ArrayLike<number>, gw: number, gh: number): House[] {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : tiles[y * gw + x] ?? 0);
  const out: House[] = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (at(x, y) !== TOWN_GID.wall || at(x + 1, y + 1) !== 15) continue;
      if (at(x - 1, y) === TOWN_GID.wall && at(x - 1, y + 1) === TOWN_GID.wall) continue; // keine Ecke
      let iw = 0;
      while (at(x + 1 + iw, y + 1) === 15) iw++;
      let ih = 0;
      while (at(x + 1, y + 1 + ih) === 15) ih++;
      const w = iw + 2;
      const h = ih + 2;
      // Wandring (Tür darf die Wand ersetzen) und Boden vollständig prüfen
      let ok = true;
      let door: House['door'] = null;
      for (let dy = 0; dy < h && ok; dy++) {
        for (let dx = 0; dx < w && ok; dx++) {
          const g = at(x + dx, y + dy);
          const ring = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
          if (!ring) {
            ok = g === 15;
          } else if (g >= TOWN_GID.doorFirst && g <= TOWN_GID.doorLast) {
            const side = dy === 0 ? 'N' : dy === h - 1 ? 'S' : dx === 0 ? 'W' : 'E';
            door = { x: x + dx, y: y + dy, icon: DOOR_ICONS[g - TOWN_GID.doorFirst]!, side };
          } else {
            ok = g === TOWN_GID.wall;
          }
        }
      }
      if (!ok || w < 4 || h < 4) continue;
      out.push({ x0: x, y0: y, w, h, variant: ((x * 7 + y * 13) >>> 0) % HOUSE_VARIANTS, door });
    }
  }
  return out;
}

/** Fensterlicht nachts (additiv) */
export const WINDOW_LIGHT: Rgb = 0xff9a38;

/** Hängendes Berufsschild (Holzbrett, dunkler Rand, Symbol), 16x16 */
export function signRaster(icon: DoorIcon): Raster {
  const r = new Raster(16, 16);
  r.rect(0, 0, 16, 16, INK);
  r.rect(1, 1, 14, 14, 0x6a4a2c);
  r.rect(1, 1, 14, 1, 0x8a6a40);
  r.rect(1, 14, 14, 1, 0x4a321e);
  drawDoorIcon(rasterCtx(r) as unknown as CanvasRenderingContext2D, icon, 1, 1);
  return r;
}

/** Minimaler 2D-Kontext auf einem Raster (nur fillStyle als #rrggbb und fillRect), damit drawDoorIcon auch hier malt */
function rasterCtx(r: Raster): { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void } {
  let col = 0;
  return {
    set fillStyle(v: string) { col = parseInt(v.replace('#', ''), 16) || 0; },
    get fillStyle() { return `#${col.toString(16).padStart(6, '0')}`; },
    fillRect(x, y, w, h) { r.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), mix(col, 0x30282a, 0.25)); },
  };
}

export interface HouseDecor { x: number; y: number; kind: 'barrel' | 'crates' | 'fence' }

/**
 * Kleine Außendeko vor der Südwand eines Hauses (nur Optik, keine Kollision, kein Sim-Einfluss): Fässer, Kisten, Zaunstücke
 * per Hash an freien Kacheln. `free(x, y)` sagt, ob die Kachel ohne Prop/Wand und keine Wasser-/Lavakachel ist. Die Tür-Vorplätze
 * (Süd: 2 Kacheln seitlich, Ost/West/Nord: 2 Kacheln davor) bleiben frei.
 */
export function houseDecor(hs: House, free: (x: number, y: number) => boolean): HouseDecor[] {
  const out: HouseDecor[] = [];
  const row = hs.y0 + hs.h; // Reihe direkt unter der Südwand
  const d = hs.door;
  const blocked = (x: number, y: number): boolean => !!d && Math.abs(x - d.x) + Math.abs(y - d.y) <= 2;
  const seed = hs.x0 * 31 + hs.y0 * 17;
  const pattern = Math.floor(h3(seed, 5, 5) * 3);
  const spots: [number, number, HouseDecor['kind'][]][] = [];
  const L = hs.x0 + 1;
  const Rr = hs.x0 + hs.w - 2;
  if (pattern === 0) spots.push([L, row, ['barrel']], [Rr, row, ['crates']]);
  else if (pattern === 1) spots.push([L, row, ['fence']], [L + 1, row, ['fence']], [Rr, row, ['barrel']]);
  else spots.push([L, row, ['crates']], [Rr - 1, row, ['fence']], [Rr, row, ['fence']]);
  for (const [x, y, kinds] of spots) {
    if (blocked(x, y) || !free(x, y)) continue;
    out.push({ x, y, kind: kinds[0]! });
  }
  return out;
}
