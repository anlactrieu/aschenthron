/**
 * Häuser der Stadt als Gebäude (Ninja Adventure TilesetHouse, CC0): In der Karte sind Häuser Wandringe (gid 18) mit
 * Dielenboden (gid 15) innen und einer Türkachel (gid 28..37). Zur Laufzeit werden diese Rechtecke erkannt; die Karte
 * und die Sim bleiben unverändert. Gezeichnet wird ein Dach (neun-geteilt aus dem Vorbild), die Südwand als Vorderwand mit
 * Fenstern und eine Tür mit Berufsschild. Fehlt die Bildvorlage, liefern die Bauer null und die alte Grafik springt ein.
 */
import { ninjaImg } from './ninja';
import { DOOR_ICONS, TOWN_GID, drawDoorIcon, type DoorIcon } from './town';
import { PIXEL } from './ninjaProps';

const SHEET = 'Backgrounds/Tilesets/TilesetHouse.png';
export const HOUSE_VARIANTS = 4;

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

type Cv = HTMLCanvasElement;
const mk = (w: number, h: number): Cv => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const ctx = (c: Cv): CanvasRenderingContext2D => {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  return g;
};

/** Farbvariante durch Kanaltausch (Orange wird Blau, Grün oder Rosa; Umrisse bleiben dunkel). */
function recolor(c: Cv, variant: number): Cv {
  if (variant === 0) return c;
  const g = ctx(c);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i]!, gg = d.data[i + 1]!, b = d.data[i + 2]!;
    const [nr, ng, nb] = variant === 1 ? [b, gg, r] : variant === 2 ? [gg, r, b] : [r, b, gg];
    // etwas gedämpft, damit die Farben nicht grell werden
    const grey = (nr + ng + nb) / 3;
    d.data[i] = nr * 0.78 + grey * 0.22; d.data[i + 1] = ng * 0.78 + grey * 0.22; d.data[i + 2] = nb * 0.78 + grey * 0.22;
  }
  g.putImageData(d, 0, 0);
  return c;
}

function up(src: Cv, k = PIXEL): Cv {
  const out = mk(src.width * k, src.height * k);
  const g = ctx(out);
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Dach: Ecken und Ränder aus dem Vorbild, die Fläche wird mit einem glatten Streifen und Mittelstück gefüllt. */
export function houseRoof(wTiles: number, hTiles: number, variant: number): Cv | null {
  const img = ninjaImg(SHEET);
  if (!img || typeof document === 'undefined') return null;
  const W = wTiles * 16;
  const H = hTiles * 16;
  const c = mk(W, H);
  const g = ctx(c);
  const T = [1, 9], Mid = [9, 20], B = [20, 31]; // Zeilenbereiche im Vorbild
  const rows: [number, number, number, number][] = []; // [Quelle y, Höhe, Ziel y, Höhe]
  const topH = T[1]! - T[0]!;
  const botH = B[1]! - B[0]!;
  rows.push([T[0]!, topH, 0, topH]);
  // Mitte wiederholen, bis die Fläche gefüllt ist
  const midSrcH = Mid[1]! - Mid[0]!;
  for (let y = topH; y < H - botH; y += midSrcH) rows.push([Mid[0]!, Math.min(midSrcH, H - botH - y), y, Math.min(midSrcH, H - botH - y)]);
  rows.push([B[0]!, botH, H - botH, botH]);
  for (const [sy, sh, dy, dh] of rows) {
    g.drawImage(img, 0, sy, 16, sh, 0, dy, 16, dh); // links
    g.drawImage(img, 32, sy, 16, sh, W - 16, dy, 16, dh); // rechts
    for (let x = 16; x < W - 16; x += 9) {
      const wdt = Math.min(9, W - 16 - x);
      g.drawImage(img, 16, sy, wdt, sh, x, dy, wdt, dh);
    }
  }
  // Schindelreihen über der glatten Fläche (das Vorbild hat nur wenige Zeichen)
  for (let y = 12, row = 0; y < H - botH - 2; y += 5, row++) {
    g.fillStyle = 'rgba(96,36,20,0.34)';
    g.fillRect(3, y, W - 6, 1);
    g.fillStyle = 'rgba(255,210,150,0.16)';
    g.fillRect(3, y + 1, W - 6, 1);
    g.fillStyle = 'rgba(96,36,20,0.26)';
    for (let x = 5 + (row % 2) * 4; x < W - 5; x += 8) g.fillRect(x, y + 1, 1, 4);
  }
  return up(recolor(c, variant));
}

/** Obere Reihe der Vorderwand (gehört optisch zum Dach, blendet mit ihm aus): Fenster an ungeraden Plätzen. */
export function houseFacade(wTiles: number, variant: number): Cv | null {
  if (typeof document === 'undefined') return null;
  const c = mk(wTiles * 48, 48);
  const g = ctx(c);
  for (let rel = 0; rel < wTiles; rel++) {
    const kind = rel % 2 === 1 && rel !== wTiles - 1 ? 'win' : 'wall';
    const t = houseWallTile(kind, variant);
    if (!t) return null;
    g.drawImage(t, rel * 48, 0);
  }
  return c;
}

const WALL_Y = 31;

/** 16x16-Teil der Vorderwand: 'win' mit Fenster, 'wall' schlicht, 'door' mit Türöffnung. */
export function houseWallTile(kind: 'win' | 'wall' | 'door', variant: number): Cv | null {
  const img = ninjaImg(SHEET);
  if (!img || typeof document === 'undefined') return null;
  const c = mk(16, 16);
  const g = ctx(c);
  // Wandfarbe aus dem Zwischenraum zwischen Fenster und Tür
  const probe = mk(1, 1);
  const pg = ctx(probe);
  pg.drawImage(img, 16, 40, 1, 1, 0, 0, 1, 1);
  const px = pg.getImageData(0, 0, 1, 1).data;
  g.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`;
  g.fillRect(0, 0, 16, 16);
  if (kind === 'door') {
    g.drawImage(img, 16, WALL_Y, 14, 16, 1, 0, 14, 16);
  } else {
    g.drawImage(img, 4, WALL_Y, 12, 16, 2, 0, 12, 16);
    if (kind === 'wall') {
      // Fensterfläche mit Wandfarbe übermalen, Leiste oben/unten bleibt
      g.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`;
      g.fillRect(2, 3, 12, 11);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(2, 3, 12, 1);
    }
  }
  return up(recolor(c, variant));
}

/** Türkachel samt hängendem Berufsschild (Schild oben, Tür unten). Größe 16 x 32 logisch. */
export function houseDoor(icon: DoorIcon, variant: number): Cv | null {
  const tile = houseWallTile('door', variant);
  if (!tile || typeof document === 'undefined') return null;
  const c = mk(16 * PIXEL, 32 * PIXEL);
  const g = ctx(c);
  g.drawImage(tile, 0, 16 * PIXEL);
  // Schild: Holzbrett mit dunklem Rand, darin das Symbol
  const s = mk(16, 16);
  const sg = ctx(s);
  sg.fillStyle = '#2a1a10';
  sg.fillRect(0, 0, 16, 16);
  sg.fillStyle = '#a07a4a';
  sg.fillRect(1, 1, 14, 14);
  sg.fillStyle = '#c09a62';
  sg.fillRect(1, 1, 14, 1);
  drawDoorIcon(sg, icon, 1, 1);
  g.drawImage(up(s), 0, 2 * PIXEL);
  return c;
}
