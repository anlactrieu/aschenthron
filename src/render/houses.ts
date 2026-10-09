/**
 * Häuser der Stadt als Gebäude (prozedural gezeichnet, Palette angelehnt an Ninja Adventure TilesetHouse, CC0): In der
 * Karte sind Häuser Wandringe (gid 18) mit Dielenboden (gid 15) innen und einer Türkachel (gid 28..37). Zur Laufzeit
 * werden diese Rechtecke erkannt; die Karte und die Sim bleiben unverändert. Gezeichnet wird ein Satteldach (Schindelreihen,
 * Dachfirst, Traufe, Schornsteine, Kerbe mit Vordach an der Türseite), eine zweigeschossige Vorderwand mit Fachwerk, Fenstern
 * mit Läden und Blumenkästen, Steinsockel und eine Holztür mit Berufsschild. Ohne Dokument (Node) liefern die Bauer null.
 */
import { DOOR_ICONS, TOWN_GID, drawDoorIcon, type DoorIcon } from './town';
import { PIXEL } from './ninjaProps';

/** Bis zu dieser Zeilenzahl reicht das Dach; Kerbe an der Türseite (Kachelspalte/-zeile im Dachbild) */
export interface RoofNotch { col: number; row: number; rows: number }

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


type Cv = HTMLCanvasElement;
type G = CanvasRenderingContext2D;
type Rgb = [number, number, number];

const mk = (w: number, h: number): Cv => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const ctx = (c: Cv): G => {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  return g;
};
const cl = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
const col = (c: Rgb, k = 1): string => `rgb(${cl(c[0] * k)},${cl(c[1] * k)},${cl(c[2] * k)})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Kleiner Hash 0..n-1 aus drei Zahlen */
const hh = (a: number, b: number, c: number, n: number): number => {
  let h = (Math.imul(a + 17, 73856093) ^ Math.imul(b + 31, 19349663) ^ Math.imul(c + 7, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % n;
};
const rect = (g: G, c: string, x: number, y: number, w: number, h: number): void => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

function up(src: Cv, k = PIXEL): Cv {
  const out = mk(src.width * k, src.height * k);
  const g = ctx(out);
  g.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Dachfarbe, Läden, Putz je Variante: gedämpft, natürlich (Schiefer, Ziegel, Stroh, Moos, Holzschindel). */
const ROOF: Rgb[] = [[98, 114, 134], [152, 94, 72], [178, 150, 92], [104, 124, 100], [134, 102, 74]];
const SHUTTER: Rgb[] = [[84, 118, 106], [78, 104, 128], [128, 70, 58], [136, 88, 62], [92, 116, 90]];
const PLASTER: Rgb[] = [[222, 214, 194], [230, 210, 178], [216, 206, 178], [222, 214, 190], [228, 212, 186]];
const TIMBER: Rgb = [96, 66, 44];
const OUTLINE: Rgb = [38, 28, 28];
const STONE: Rgb = [132, 126, 116];

/** Eine Schindelfläche mit Reihenversatz zwischen y0 und y1, seitlich von xa bis xb. */
function shingles(g: G, base: Rgb, xa: number, xb: number, y0: number, y1: number, rowH: number, shW: number, seed: number, shade: number): void {
  for (let y = y0, r = 0; y < y1; y += rowH, r++) {
    const rh = Math.min(rowH, y1 - y);
    const off = (r % 2) * (shW >> 1);
    for (let x = xa - off, i = 0; x < xb; x += shW, i++) {
      const x0 = Math.max(x, xa);
      const x1 = Math.min(x + shW, xb);
      if (x1 <= x0) continue;
      const j = 0.9 + hh(seed, r, i, 21) * 0.01;
      rect(g, col(base, shade * j), x0, y, x1 - x0, rh);
      if (rh > 2) rect(g, col(base, shade * j * 1.14), x0, y, x1 - x0, 1); // Lichtkante oben
      rect(g, col(base, shade * 0.66), x0, y + rh - 1, x1 - x0, 1); // Schatten unter der Reihe
      if (x >= xa) rect(g, col(base, shade * 0.72), x, y, 1, rh - 1); // Fuge links
    }
  }
}

/** Steinschornstein auf dem Dach: Fuß bei (x, yBase), Schatten nach rechts unten. */
function chimney(g: G, x: number, yBase: number, seed: number): void {
  const w = 9;
  const h = 13;
  const y = yBase - h;
  rect(g, 'rgba(20,14,14,0.38)', x + 2, yBase - 3, w, 5); // Schatten auf dem Dach
  rect(g, col(OUTLINE), x - 1, y - 1, w + 2, h + 2);
  rect(g, col(STONE, 0.92), x, y + 2, w, h - 2);
  rect(g, col(STONE, 1.18), x, y + 2, 2, h - 2); // Lichtseite
  rect(g, col(STONE, 0.7), x + w - 2, y + 2, 2, h - 2); // Schattenseite
  for (let r = 0; r < 4; r++) {
    const yy = y + 5 + r * 3;
    rect(g, col(STONE, 0.62), x, yy, w, 1);
    for (let i = r % 2 ? 2 : 4; i < w; i += 5) rect(g, col(STONE, 0.62), x + i, yy - 2, 1, 2);
  }
  rect(g, col(STONE, 1.3), x - 1, y, w + 2, 2); // Deckplatte
  rect(g, col(OUTLINE), x - 1, y + 2, w + 2, 1);
  rect(g, col([34, 26, 28]), x + 2, y + 0, w - 4, 1); // Rauchöffnung
  if (hh(seed, x, 3, 2) === 0) rect(g, col(STONE, 1.05), x + 3, y - 2, 3, 1);
}

/** Vordach im Kerbenkopf: zwei Schindelreihen, dunkle Unterseite, Schatten darunter. */
function awning(g: G, base: Rgb, x: number, y: number, seed: number): void {
  rect(g, col(OUTLINE), x - 1, y, 18, 1);
  shingles(g, base, x, x + 16, y + 1, y + 4, 3, 6, seed, 1.04);
  rect(g, col(TIMBER, 0.8), x, y + 4, 16, 1);
  rect(g, 'rgba(10,6,6,0.4)', x, y + 5, 16, 2);
}

/**
 * Dach als Satteldach in Draufsicht: Rückseite oben (dunkler), Dachfirst mit hellem Grat, Vorderseite mit Schindelreihen,
 * Traufe mit Schatten unten, Giebelbretter links/rechts, Schornsteine. `notch` schneidet eine Kerbe für die Tür.
 */
export function houseRoof(wTiles: number, hTiles: number, variant: number, seed = 0, notch: RoofNotch | null = null): Cv | null {
  if (typeof document === 'undefined') return null;
  const W = wTiles * 16;
  const H = hTiles * 16;
  const c = mk(W, H);
  const g = ctx(c);
  const base = ROOF[variant % ROOF.length]!;
  const ridge = Math.round(H * 0.42);
  rect(g, col(OUTLINE), 0, 0, W, H);
  shingles(g, base, 2, W - 2, 1, ridge - 2, 4, 6, seed, 0.78); // Rückseite
  shingles(g, base, 2, W - 2, ridge + 2, H - 4, 5, 8, seed + 5, 1); // Vorderseite
  // Dachfirst: Grat mit Kappen
  rect(g, col(OUTLINE), 1, ridge - 2, W - 2, 1);
  rect(g, col(mix(base, [255, 244, 220], 0.5)), 2, ridge - 1, W - 4, 1);
  rect(g, col(mix(base, [255, 244, 220], 0.3)), 2, ridge, W - 4, 1);
  rect(g, col(base, 0.55), 2, ridge + 1, W - 4, 1);
  for (let x = 6; x < W - 4; x += 7) rect(g, col(base, 0.6), x, ridge - 1, 1, 2);
  // Traufe: Traufbrett und Schatten
  rect(g, col(TIMBER, 1.15), 1, H - 4, W - 2, 1);
  rect(g, col(TIMBER, 0.95), 1, H - 3, W - 2, 2);
  rect(g, col(OUTLINE), 0, H - 1, W, 1);
  // Giebelbretter links (hell) und rechts (dunkel)
  rect(g, col(TIMBER, 1.25), 1, 1, 1, H - 2);
  rect(g, col(TIMBER, 0.8), W - 2, 1, 1, H - 2);
  // Schornsteine auf der Rückseite, nicht über der Kerbe
  const cols: number[] = [];
  for (let k = 1; k < wTiles - 1; k++) if (!notch || Math.abs(k - notch.col) > 1) cols.push(k);
  const nChim = wTiles >= 7 && hh(seed, 1, 1, 3) > 0 ? 2 : 1;
  const first = cols[hh(seed, 2, 2, Math.max(1, cols.length))] ?? 2;
  const picks = new Set<number>([first]);
  if (nChim === 2) picks.add(cols[(cols.indexOf(first) + 3) % cols.length] ?? first);
  for (const k of picks) chimney(g, k * 16 + 3 + hh(seed, k, 4, 3), ridge - 1, seed + k);
  if (notch) {
    const nx = notch.col * 16;
    const ny = notch.row * 16;
    const nh = notch.rows * 16;
    g.clearRect(nx, ny, 16, nh);
    // Ränder der Kerbe: Außenlinie und Lichtkante auf der Dachseite
    if (nx > 0) {
      rect(g, col(OUTLINE), nx - 1, ny, 1, nh);
      rect(g, col(TIMBER, 1.2), nx - 2, ny, 1, nh);
    }
    if (nx + 16 < W) {
      rect(g, col(OUTLINE), nx + 16, ny, 1, nh);
      rect(g, col(TIMBER, 0.85), nx + 17, ny, 1, nh);
    }
    if (ny + nh < H) {
      rect(g, col(OUTLINE), nx, ny + nh, 16, 1);
      rect(g, col(TIMBER, 1.15), nx, ny + nh + 1, 16, 1);
    }
    awning(g, base, nx, ny, seed);
  }
  return up(c);
}

/** Zeichnet das Fenster-Teil einer Kachel: Rahmen, Glas mit Kreuz und Glanz, Läden, Sims. */
function windowPane(g: G, v: number, y: number, h: number): void {
  const sh = SHUTTER[v % SHUTTER.length]!;
  rect(g, col(OUTLINE), 3, y - 1, 10, h + 2);
  rect(g, col(TIMBER, 1.1), 4, y, 8, h);
  rect(g, col([120, 150, 168]), 5, y + 1, 6, h - 2);
  rect(g, col([176, 204, 214]), 5, y + 1, 2, 2); // Glanz
  rect(g, col(TIMBER, 0.9), 7, y + 1, 1, h - 2);
  rect(g, col(TIMBER, 0.9), 5, y + Math.floor(h / 2), 6, 1);
  // Läden beidseitig
  for (const sx of [1, 12]) {
    rect(g, col(OUTLINE), sx, y - 1, 3, h + 2);
    rect(g, col(sh), sx + (sx === 1 ? 0 : 1), y, 2, h);
    rect(g, col(sh, 0.7), sx + (sx === 1 ? 1 : 0), y + 1, 1, h - 2);
  }
  rect(g, col([200, 192, 176]), 3, y + h, 10, 1); // Sims
  rect(g, col(OUTLINE), 3, y + h + 1, 10, 1);
}

/** Putzfläche mit leichtem Rauschen */
function plaster(g: G, v: number, seed: number): void {
  const p = PLASTER[v % PLASTER.length]!;
  rect(g, col(p), 0, 0, 16, 16);
  for (let i = 0; i < 9; i++) rect(g, col(p, 0.94 + hh(seed, i, 9, 4) * 0.02), hh(seed, i, 1, 16), hh(seed, i, 2, 16), 1, 1);
}

/** Holzpfosten an den Kachelrändern (Fachwerk) */
function posts(g: G, y0: number, y1: number): void {
  for (const x of [0, 14]) {
    rect(g, col(OUTLINE), x === 0 ? 0 : 15, y0, 1, y1 - y0);
    rect(g, col(TIMBER), x === 0 ? 1 : 14, y0, x === 0 ? 1 : 1, y1 - y0);
  }
  rect(g, col(TIMBER, 1.2), 1, y0, 1, y1 - y0);
  rect(g, col(TIMBER), 13, y0, 2, y1 - y0);
}

/** Steinsockel unten in der Kachel (5 Reihen hoch) */
function plinth(g: G, y: number, seed: number): void {
  rect(g, col(STONE), 0, y, 16, 16 - y);
  rect(g, col(OUTLINE, 1.4), 0, y, 16, 1);
  rect(g, col(STONE, 1.15), 0, y + 1, 16, 1);
  for (let r = 0, yy = y + 2; yy < 16; r++, yy += 3) {
    rect(g, col(STONE, 0.62), 0, yy + 2 > 15 ? 15 : yy + 2, 16, 1);
    for (let x = (r % 2) * 4; x < 16; x += 8) rect(g, col(STONE, 0.66), x, yy, 1, 3);
  }
  rect(g, col(STONE, 0.9 + hh(seed, 1, 1, 3) * 0.05), 3, y + 2, 2, 1);
}

/**
 * 16x16-Kachel der Vorderwand. `row`: 'upper' (Obergeschoss unter der Traufe, gehört zur Dachebene) oder 'lower'
 * (Erdgeschoss mit Steinsockel). `kind`: 'win' Fenster, 'brace' Putz mit Fachwerkstrebe, 'post' Eckpfosten.
 */
export function houseWallTile(row: 'upper' | 'lower', kind: 'win' | 'brace' | 'post', variant: number, seed = 0): Cv | null {
  if (typeof document === 'undefined') return null;
  const c = mk(16, 16);
  const g = ctx(c);
  plaster(g, variant, seed);
  if (row === 'upper') {
    rect(g, col(TIMBER, 0.9), 0, 14, 16, 2); // Deckenbalken
    rect(g, col(OUTLINE), 0, 15, 16, 1);
    rect(g, col(TIMBER, 1.2), 0, 14, 16, 1);
    if (kind === 'win') {
      windowPane(g, variant, 3, 8);
      // Blumenkasten
      rect(g, col(OUTLINE), 2, 12, 12, 3);
      rect(g, col([124, 84, 52]), 3, 12, 10, 2);
      const fl: Rgb[] = [[224, 96, 108], [236, 196, 84], [190, 120, 196], [240, 240, 232]];
      for (let i = 0; i < 5; i++) {
        rect(g, col([70, 130, 62]), 3 + i * 2, 11, 2, 1);
        rect(g, col(fl[(hh(seed, i, 5, 4) + i) % 4]!), 3 + i * 2 + (i % 2), 10 + (i % 2), 1, 1);
      }
    } else if (kind === 'brace') {
      for (let i = 0; i < 11; i++) rect(g, col(TIMBER), 3 + i, 3 + i, 1, 1);
      posts(g, 3, 14);
    }
    rect(g, 'rgba(10,6,6,0.42)', 0, 0, 16, 1); // Schatten der Traufe
    rect(g, 'rgba(10,6,6,0.3)', 0, 1, 16, 1);
    rect(g, 'rgba(10,6,6,0.16)', 0, 2, 16, 1);
    if (kind === 'post') posts(g, 3, 14);
  } else {
    plinth(g, 11, seed);
    if (kind === 'win') {
      windowPane(g, variant, 1, 8);
    } else if (kind === 'brace') {
      for (let i = 0; i < 10; i++) rect(g, col(TIMBER), 3 + i, 1 + i, 1, 1);
      posts(g, 0, 11);
    } else {
      posts(g, 0, 11);
    }
  }
  return up(c);
}

/** Obere Fassadenreihe (gehört optisch zum Dach, blendet mit ihm aus): Fenster an ungeraden Plätzen. */
export function houseFacade(wTiles: number, variant: number, seed = 0): Cv | null {
  if (typeof document === 'undefined') return null;
  const c = mk(wTiles * 48, 48);
  const g = ctx(c);
  for (let rel = 0; rel < wTiles; rel++) {
    const edge = rel === 0 || rel === wTiles - 1;
    const t = houseWallTile('upper', edge ? 'post' : rel % 2 === 1 ? 'win' : 'brace', variant, seed + rel);
    if (!t) return null;
    g.drawImage(t, rel * 48, 0);
  }
  return c;
}

/** Zeile der Vorderwand im Erdgeschoss: Art der Kachel an Spalte `rel`. */
export function lowerKind(rel: number, w: number): 'win' | 'brace' | 'post' {
  return rel === 0 || rel === w - 1 ? 'post' : rel % 2 === 0 ? 'win' : 'brace';
}

/** Holztür in Rahmen mit Steinschwelle, 16x16 (Unterteil). */
function doorLeaf(g: G, oy: number, variant: number): void {
  const wood: Rgb = [130, 90, 54];
  rect(g, col(OUTLINE), 2, oy + 2, 12, 14);
  rect(g, col(TIMBER, 1.1), 3, oy + 2, 10, 2); // Sturzbalken
  rect(g, col(wood, 0.55), 3, oy + 4, 10, 11); // dunkle Öffnung als Rand
  rect(g, col(wood), 4, oy + 5, 8, 11);
  rect(g, col(OUTLINE), 3, oy + 4, 1, 1);
  rect(g, col(OUTLINE), 12, oy + 4, 1, 1); // gerundete Ecken
  for (let x = 6; x < 12; x += 2) rect(g, col(wood, 0.72), x, oy + 5, 1, 11);
  rect(g, col(wood, 1.2), 4, oy + 5, 1, 11);
  rect(g, col([58, 52, 52]), 4, oy + 7, 8, 1); // Eisenbänder
  rect(g, col([58, 52, 52]), 4, oy + 12, 8, 1);
  rect(g, col([232, 196, 92]), 10, oy + 10, 1, 2); // Griff
  rect(g, col(STONE, 1.1), 2, oy + 15, 12, 1); // Schwelle
  void variant;
}

/**
 * Tür mit Berufsschild. `tall`: 16x32 mit hängendem Schild über der Tür (Süd-, Ost-, Westtür), sonst nur Tür 16x16
 * (Nordtür, das Schild kommt als eigenes Bild, siehe `houseSign`).
 */
export function houseDoor(icon: DoorIcon, variant: number, tall = true, seed = 0): Cv | null {
  if (typeof document === 'undefined') return null;
  const hgt = tall ? 32 : 16;
  const c = mk(16, hgt);
  const g = ctx(c);
  const lo = hgt - 16;
  if (tall) {
    // Obere Wand hinter dem Schild
    const top = mk(16, 16);
    const tg = ctx(top);
    plaster(tg, variant, seed);
    posts(tg, 0, 16);
    g.drawImage(top, 0, 0);
  }
  plaster(g, variant, seed + 1);
  // Unterteil: Putz, Pfosten, Sockel, Tür
  const bot = mk(16, 16);
  const bg = ctx(bot);
  plaster(bg, variant, seed + 2);
  posts(bg, 0, 16);
  plinth(bg, 12, seed);
  doorLeaf(bg, 0, variant);
  g.drawImage(bot, 0, lo);
  if (tall) {
    g.drawImage(drawSign(icon, true), 0, 2);
  }
  return up(c);
}

/** Hängendes Berufsschild (Holzbrett, dunkler Rand, Symbol), 16x16. Mit `chain` hängt es an zwei Ketten unter einem Balken. */
function drawSign(icon: DoorIcon, chain: boolean): Cv {
  const s = mk(16, 16);
  const sg = ctx(s);
  rect(sg, col(OUTLINE), 0, 0, 16, 16);
  rect(sg, col([160, 122, 74]), 1, 1, 14, 14);
  rect(sg, col([196, 158, 100]), 1, 1, 14, 1);
  rect(sg, col([112, 80, 50]), 1, 14, 14, 1);
  drawDoorIcon(sg, icon, 1, 1);
  if (chain) {
    rect(sg, col(TIMBER, 0.8), 0, 0, 16, 1);
  }
  return s;
}

/** Berufsschild als eigenes Bild (für Nordtüren). */
export function houseSign(icon: DoorIcon): Cv | null {
  if (typeof document === 'undefined') return null;
  return up(drawSign(icon, false));
}
