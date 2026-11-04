/**
 * Häuser der Stadt als Gebäude, im Kunstraster der Code-Welt (24 px je Kachel, Maßstab 2, Stil wie world/props.ts):
 * In der Karte sind Häuser Wandringe (gid 18) mit Dielenboden (gid 15) innen und einer Türkachel (gid 28..37). Zur
 * Laufzeit werden diese Rechtecke erkannt; Karte und Sim bleiben unverändert. Gezeichnet wird ein Satteldach (Schindeln
 * bzw. Stroh, Dachfirst, Traufe, Giebelbretter, Schornsteine, Kerbe mit Vordach an der Türseite), ein Obergeschoss mit
 * Fachwerk, Fenstern mit Läden und Blumenkästen, ein Erdgeschoss mit Steinsockel, eine Holztür mit Berufsschild und ein
 * eigenes Lichtbild für die Fenster (nachts). Ohne Dokument (Node) liefern die Canvas-Bauer null; die Raster-Bauer
 * (`*Raster`) laufen überall (Kontaktbögen).
 */
import { DOOR_ICONS, TOWN_GID, drawDoorIcon, type DoorIcon } from './town';
import { ART, INK, Raster, h3, mix, toCanvas, type Rgb } from './world/raster';
import { R, fence, type Ramp5 } from './world/props';

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

/* ---------------------------------------------------------------- Paletten je Variante (gedämpft, dunkel) */

const ROOF: Ramp5[] = [
  [0x14161c, 0x212532, 0x303648, 0x434a5c, 0x5a6274], // Schiefer
  [0x1e0e0c, 0x341814, 0x4c241c, 0x663226, 0x804234], // Ziegel
  [0x1e180e, 0x342a16, 0x4a3c1e, 0x625028, 0x7c6634], // Stroh
  [0x121a12, 0x1e2a1c, 0x2a3a26, 0x384c30, 0x4a6040], // Moos
  [0x1a120c, 0x2c1e14, 0x40301e, 0x564028, 0x6e5434], // Holzschindel
];
const PLASTER: Ramp5[] = [
  [0x2e2a24, 0x4c463c, 0x6a6252, 0x857b68, 0x9c917c],
  [0x2c2c30, 0x48484e, 0x64626a, 0x7e7c82, 0x949198],
  [0x34281a, 0x544430, 0x725e44, 0x8b7656, 0xa08a68],
  [0x2e2a24, 0x4c463c, 0x6a6252, 0x857b68, 0x9c917c],
  [0x302a26, 0x4e4640, 0x6c6258, 0x877c70, 0x9e9284],
];
const SHUTTER: Ramp5[] = [
  [0x0e1614, 0x1a2824, 0x283c36, 0x365048, 0x48665c],
  [0x0e1218, 0x1a2230, 0x283448, 0x36465e, 0x485a74],
  [0x1a0c0a, 0x2e1612, 0x44221c, 0x5a2e26, 0x723c32],
  [0x1a120c, 0x2e2016, 0x443020, 0x5a402a, 0x725236],
  [0x101610, 0x1c281c, 0x2a3a28, 0x384c34, 0x4a6044],
];
const TIMBER: Ramp5 = [0x120a06, 0x20140c, 0x321f12, 0x462c1a, 0x5a3a24];
const STONE: Ramp5 = R.stone;
const GLASS = 0x121a24;
const GLASS_HI = 0x34465a;
/** Fensterlicht nachts (additiv) */
export const WINDOW_LIGHT: Rgb = 0xff9a38;

const t5 = (r: Ramp5, t: number): Rgb => r[Math.max(0, Math.min(4, Math.round(t)))]!;

/* ---------------------------------------------------------------- Dach */

/** Schindelfläche zwischen y0 und y1 (Reihen mit Versatz, Lichtkante oben, Schatten unten, Fugen) */
function shingles(r: Raster, ramp: Ramp5, xa: number, xb: number, y0: number, y1: number, rowH: number, shW: number, seed: number, lift: number): void {
  for (let y = y0, row = 0; y < y1; y += rowH, row++) {
    const rh = Math.min(rowH, y1 - y);
    const off = (row % 2) * (shW >> 1);
    for (let x = xa - off, i = 0; x < xb; x += shW, i++) {
      const tone = 2 + lift + (h3(seed, row, i) < 0.25 ? 0.6 : h3(seed, row, i + 50) < 0.15 ? -0.6 : 0);
      for (let yy = y; yy < y + rh; yy++) {
        for (let xx = Math.max(x, xa); xx < Math.min(x + shW, xb); xx++) {
          let t = tone;
          if (yy === y && rh > 2) t += 0.9; // Lichtkante
          if (yy === y + rh - 1) t = 0.6 + lift * 0.5; // Schatten unter der Reihe
          else if (xx === x) t -= 0.8; // Fuge
          r.set(xx, yy, t5(ramp, t));
        }
      }
    }
  }
}

/** Strohdach: senkrechte Halmstriche, Bündelkanten waagrecht */
function thatch(r: Raster, ramp: Ramp5, xa: number, xb: number, y0: number, y1: number, seed: number, lift: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = xa; x < xb; x++) {
      let t = 2 + lift + (h3(x, Math.floor(y / 3), seed) < 0.3 ? 0.7 : h3(x, Math.floor(y / 2), seed + 1) < 0.2 ? -0.7 : 0);
      if ((y - y0) % 6 === 5) t = 0.8 + lift * 0.5;
      r.set(x, y, t5(ramp, t));
    }
  }
}

/** Steinschornstein, Fuß bei (x, yBase), Schatten rechts unten aufs Dach */
function chimney(r: Raster, x: number, yBase: number): void {
  const w = 8;
  const h = 14;
  const y = yBase - h;
  for (let k = 0; k < 3; k++) for (let i = 0; i < w; i++) r.blend(x + 2 + i, yBase + k, 0x050406, 0.4);
  r.rect(x - 1, y - 1, w + 2, h + 2, INK);
  for (let yy = y + 2; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) r.set(xx, yy, t5(STONE, xx === x ? 4 : xx >= x + w - 1 ? 1 : ((yy - y) % 3 === 0 ? 1.6 : 2.6)));
  r.rect(x - 1, y, w + 2, 2, STONE[4]);
  r.rect(x + 1, y, w - 2, 1, 0x0a0808);
}

/** Vordach im Kerbenkopf (eine Kachel breit) */
function awning(r: Raster, ramp: Ramp5, x: number, y: number, seed: number): void {
  r.rect(x - 1, y, ART + 2, 1, INK);
  shingles(r, ramp, x, x + ART, y + 1, y + 6, 3, 6, seed, 0.6);
  r.rect(x, y + 6, ART, 1, TIMBER[3]);
  r.rect(x - 1, y + 7, ART + 2, 1, INK);
  for (let k = 0; k < 2; k++) for (let i = 0; i < ART; i++) r.blend(x + i, y + 8 + k, 0x050406, 0.4 - k * 0.15);
}

/**
 * Dach als Raster: Rückseite oben (dunkler), First mit hellem Grat, Vorderseite, Traufe mit Brett, Giebelbretter links
 * (hell) und rechts (dunkel), Schornsteine. `notch` schneidet eine Kerbe für die Tür (mit Vordach).
 */
export function houseRoofRaster(wTiles: number, hTiles: number, variant: number, seed = 0, notch: RoofNotch | null = null): Raster {
  const W = wTiles * ART;
  const H = hTiles * ART;
  const r = new Raster(W, H);
  const ramp = ROOF[variant % ROOF.length]!;
  const straw = variant % ROOF.length === 2;
  const ridge = Math.round(H * 0.42);
  r.rect(0, 0, W, H, INK);
  if (straw) {
    thatch(r, ramp, 2, W - 2, 1, ridge - 2, seed, -0.4);
    thatch(r, ramp, 2, W - 2, ridge + 2, H - 4, seed + 5, 0.4);
  } else {
    shingles(r, ramp, 2, W - 2, 1, ridge - 2, 5, 7, seed, -0.5);
    shingles(r, ramp, 2, W - 2, ridge + 2, H - 4, 6, 9, seed + 5, 0.3);
  }
  // First: Grat mit Kappen
  r.rect(1, ridge - 2, W - 2, 1, INK);
  r.rect(2, ridge - 1, W - 4, 1, mix(ramp[4], 0xd8c8a8, 0.35));
  r.rect(2, ridge, W - 4, 1, ramp[4]);
  r.rect(2, ridge + 1, W - 4, 1, ramp[1]);
  for (let x = 7; x < W - 4; x += 8) r.rect(x, ridge - 1, 1, 2, ramp[1]);
  // Traufe: Brett und Kante
  r.rect(1, H - 4, W - 2, 1, TIMBER[4]);
  r.rect(1, H - 3, W - 2, 2, TIMBER[2]);
  r.rect(0, H - 1, W, 1, INK);
  // Giebelbretter
  r.rect(1, 1, 1, H - 2, TIMBER[4]);
  r.rect(W - 2, 1, 1, H - 2, TIMBER[1]);
  // Schornsteine auf der Rückseite, nicht über der Kerbe
  const cols: number[] = [];
  for (let k = 1; k < wTiles - 1; k++) if (!notch || Math.abs(k - notch.col) > 1) cols.push(k);
  const two = wTiles >= 7 && Math.floor(h3(seed, 1, 1) * 3) > 0;
  const first = cols[Math.floor(h3(seed, 2, 2) * Math.max(1, cols.length))] ?? 2;
  const picks = new Set<number>([first]);
  if (two) picks.add(cols[(cols.indexOf(first) + 3) % cols.length] ?? first);
  for (const k of picks) chimney(r, k * ART + 6 + Math.floor(h3(seed, k, 4) * 6), ridge - 1);
  if (notch) {
    const nx = notch.col * ART;
    const ny = notch.row * ART;
    const nh = notch.rows * ART;
    for (let y = ny; y < Math.min(H, ny + nh); y++) for (let x = nx; x < nx + ART; x++) r.d[y * W + x] = 0;
    if (nx > 0) { r.rect(nx - 1, ny, 1, nh, INK); r.rect(nx - 2, ny, 1, nh, TIMBER[4]); }
    if (nx + ART < W) { r.rect(nx + ART, ny, 1, nh, INK); r.rect(nx + ART + 1, ny, 1, nh, TIMBER[1]); }
    if (ny + nh < H) { r.rect(nx, ny + nh, ART, 1, INK); r.rect(nx, ny + nh + 1, ART, 1, TIMBER[3]); }
    awning(r, ramp, nx, ny, seed);
  }
  return r;
}

export function houseRoof(wTiles: number, hTiles: number, variant: number, seed = 0, notch: RoofNotch | null = null): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return toCanvas(houseRoofRaster(wTiles, hTiles, variant, seed, notch));
}

/* ---------------------------------------------------------------- Wände, Fenster, Tür */

/** Putzfläche mit leisem Rauschen */
function plaster(r: Raster, v: number, seed: number, y0 = 0, y1 = ART): void {
  const p = PLASTER[v % PLASTER.length]!;
  for (let y = y0; y < y1; y++) for (let x = 0; x < ART; x++) r.set(x, y, t5(p, h3(x + seed * 3, y, 9) < 0.08 ? 1.6 : h3(x, y + seed, 10) < 0.05 ? 3 : 2.4));
}

/** Fachwerk: Pfosten an den Kachelrändern */
function posts(r: Raster, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    r.set(0, y, INK);
    r.set(1, y, TIMBER[4]);
    r.set(2, y, TIMBER[2]);
    r.set(ART - 3, y, TIMBER[3]);
    r.set(ART - 2, y, TIMBER[1]);
    r.set(ART - 1, y, INK);
  }
}

/** Strebe (schräger Balken) im Fachwerk */
function brace(r: Raster, y0: number, y1: number): void {
  for (let i = 0; i <= y1 - y0; i++) {
    const x = 3 + Math.round((i * (ART - 7)) / (y1 - y0));
    r.set(x, y0 + i, TIMBER[3]);
    r.set(x + 1, y0 + i, TIMBER[1]);
  }
}

/** Fenster: Rahmen, dunkles Glas mit Kreuz und Glanz, Läden, Sims */
function windowPane(r: Raster, v: number, y: number, h: number): void {
  const sh = SHUTTER[v % SHUTTER.length]!;
  r.rect(6, y - 1, 12, h + 2, INK);
  r.rect(7, y, 10, h, TIMBER[3]);
  r.rect(8, y + 1, 8, h - 2, GLASS);
  r.rect(8, y + 1, 2, 2, GLASS_HI);
  r.rect(11, y + 1, 1, h - 2, TIMBER[2]);
  r.rect(8, y + Math.floor(h / 2), 8, 1, TIMBER[2]);
  for (const sx of [2, 18]) {
    r.rect(sx, y - 1, 4, h + 2, INK);
    r.rect(sx + 1, y, 2, h, sh[3]);
    r.rect(sx + (sx === 2 ? 2 : 1), y + 1, 1, h - 2, sh[1]);
  }
  r.rect(6, y + h + 1, 12, 1, STONE[3]);
  r.rect(6, y + h + 2, 12, 1, INK);
}

/** Steinsockel unten in der Kachel ab y */
function plinth(r: Raster, y: number): void {
  for (let yy = y; yy < ART; yy++) {
    for (let x = 0; x < ART; x++) {
      const row = Math.floor((yy - y - 1) / 3);
      const off = (row % 2) * 4;
      let t = yy === y ? 0.4 : yy === y + 1 ? 3.6 : (yy - y - 1) % 3 === 2 ? 1 : (x + off) % 8 === 0 ? 1.2 : 2.4;
      if (yy === ART - 1) t = 0.6;
      r.set(x, yy, t5(STONE, t));
    }
  }
}

/** Glasflächen (für das Nachtlicht): [x, y, w, h] im Kunstraster der Kachel */
const WIN_UPPER: [number, number, number, number] = [8, 6, 8, 8];
const WIN_LOWER: [number, number, number, number] = [8, 3, 8, 8];

/**
 * Kachel der Vorderwand als Raster. `row`: 'upper' (Obergeschoss unter der Traufe, gehört zur Dachebene) oder 'lower'
 * (Erdgeschoss mit Steinsockel). `kind`: 'win' Fenster, 'brace' Putz mit Strebe, 'post' Eckpfosten.
 */
export function houseWallRaster(row: 'upper' | 'lower', kind: 'win' | 'brace' | 'post', variant: number, seed = 0): Raster {
  const r = new Raster(ART, ART);
  plaster(r, variant, seed);
  if (row === 'upper') {
    r.rect(0, ART - 3, ART, 2, TIMBER[2]); // Deckenbalken
    r.rect(0, ART - 3, ART, 1, TIMBER[4]);
    r.rect(0, ART - 1, ART, 1, INK);
    if (kind === 'win') {
      windowPane(r, variant, WIN_UPPER[1] - 1, WIN_UPPER[3] + 2);
      // Blumenkasten
      r.rect(5, 17, 14, 3, INK);
      r.rect(6, 17, 12, 2, R.wood[2]);
      const fl = [0xa86a80, 0xc8b35a, 0x8a6aa8, 0xc8c4b4];
      for (let i = 0; i < 6; i++) {
        r.rect(6 + i * 2, 16, 2, 1, R.leaf[3]);
        r.set(6 + i * 2 + (i % 2), 15 + (i % 2), fl[(Math.floor(h3(seed, i, 5) * 4) + i) % 4]!);
      }
    } else {
      posts(r, 3, ART - 3);
      if (kind === 'brace') brace(r, 4, ART - 5);
    }
    // Schatten der Traufe
    for (let k = 0; k < 3; k++) for (let x = 0; x < ART; x++) r.blend(x, k, 0x050406, 0.55 - k * 0.17);
  } else {
    plinth(r, 16);
    if (kind === 'win') windowPane(r, variant, WIN_LOWER[1] - 1, WIN_LOWER[3] + 2);
    else {
      posts(r, 0, 16);
      if (kind === 'brace') brace(r, 1, 15);
    }
  }
  return r;
}

export function houseWallTile(row: 'upper' | 'lower', kind: 'win' | 'brace' | 'post', variant: number, seed = 0): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return toCanvas(houseWallRaster(row, kind, variant, seed));
}

export function houseFacadeRaster(wTiles: number, variant: number, seed = 0): Raster {
  const r = new Raster(wTiles * ART, ART);
  for (let rel = 0; rel < wTiles; rel++) r.blit(houseWallRaster('upper', upperKind(rel, wTiles), variant, seed + rel), rel * ART, 0);
  return r;
}

/** Obere Fassadenreihe (gehört optisch zum Dach, blendet mit ihm aus): Fenster an ungeraden Plätzen. */
export function houseFacade(wTiles: number, variant: number, seed = 0): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return toCanvas(houseFacadeRaster(wTiles, variant, seed));
}

function upperKind(rel: number, w: number): 'win' | 'brace' | 'post' {
  return rel === 0 || rel === w - 1 ? 'post' : rel % 2 === 1 ? 'win' : 'brace';
}

/** Zeile der Vorderwand im Erdgeschoss: Art der Kachel an Spalte `rel`. */
export function lowerKind(rel: number, w: number): 'win' | 'brace' | 'post' {
  return rel === 0 || rel === w - 1 ? 'post' : rel % 2 === 0 ? 'win' : 'brace';
}

/**
 * Nachtlicht der Fenster eines Hauses als Raster über Obergeschoss und Erdgeschoss (2 Kachelreihen, Breite des Hauses):
 * warme Glasfläche plus kleiner gestufter Schein. Wird additiv über die Fassade gelegt, Deckkraft nach Tageszeit.
 * Die Tür-Kachel bleibt dunkel.
 */
export function houseGlowRaster(hs: House): Raster {
  const r = new Raster(hs.w * ART, ART * 2);
  const doorRel = hs.door && hs.door.side === 'S' ? hs.door.x - hs.x0 : -1;
  const lit = (rel: number, row: number): boolean => h3(hs.x0 + rel, hs.y0 + row, 77) < 0.7;
  const pane = (ox: number, oy: number, [x, y, w, h]: [number, number, number, number]): void => {
    for (let yy = -3; yy < h + 3; yy++) {
      for (let xx = -3; xx < w + 3; xx++) {
        const inside = xx >= 0 && yy >= 0 && xx < w && yy < h;
        const d = Math.max(xx < 0 ? -xx : xx >= w ? xx - w + 1 : 0, yy < 0 ? -yy : yy >= h ? yy - h + 1 : 0);
        const a = inside ? 200 : d === 1 ? 70 : d === 2 ? 36 : 16;
        r.set(ox + x + xx, oy + y + yy, inside && (xx === 0 || yy === 0) ? 0xffd890 : WINDOW_LIGHT, a);
      }
    }
  };
  for (let rel = 0; rel < hs.w; rel++) {
    if (upperKind(rel, hs.w) === 'win' && lit(rel, 0)) pane(rel * ART, 0, WIN_UPPER);
    if (lowerKind(rel, hs.w) === 'win' && rel !== doorRel && lit(rel, 1)) pane(rel * ART, ART, WIN_LOWER);
  }
  return r;
}

export function houseGlow(hs: House): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return toCanvas(houseGlowRaster(hs));
}

/** Holztür in Rahmen mit Steinschwelle (untere Kachel ab oy) */
function doorLeaf(r: Raster, oy: number): void {
  const wood = R.wood;
  r.rect(4, oy + 2, 16, 22, INK);
  r.rect(5, oy + 2, 14, 2, TIMBER[3]); // Sturz
  r.rect(5, oy + 4, 14, 19, wood[1]);
  r.rect(6, oy + 5, 12, 18, wood[2]);
  for (let x = 9; x < 18; x += 3) r.rect(x, oy + 5, 1, 18, wood[1]);
  r.rect(6, oy + 5, 1, 18, wood[3]);
  r.rect(6, oy + 8, 12, 1, R.iron[1]); // Eisenbänder
  r.rect(6, oy + 17, 12, 1, R.iron[1]);
  r.rect(15, oy + 13, 1, 2, 0xc8a040); // Griff
  r.rect(4, oy + 23, 16, 1, STONE[3]); // Schwelle
}

/** Hängendes Berufsschild (Holzbrett, dunkler Rand, Symbol), 16x16 */
function signRaster(icon: DoorIcon): Raster {
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

/**
 * Tür mit Berufsschild. `tall`: 24x48 mit hängendem Schild über der Tür (Süd-, Ost-, Westtür), sonst nur die Tür 24x24
 * (Nordtür, das Schild kommt als eigenes Bild, siehe `houseSign`).
 */
export function houseDoorRaster(icon: DoorIcon, variant: number, tall = true, seed = 0): Raster {
  const hgt = tall ? ART * 2 : ART;
  const r = new Raster(ART, hgt);
  const lo = hgt - ART;
  if (tall) {
    plaster(r, variant, seed, 0, ART);
    posts(r, 0, ART);
  }
  plaster(r, variant, seed + 1, lo, hgt);
  const bot = new Raster(ART, ART);
  plaster(bot, variant, seed + 2);
  posts(bot, 0, ART);
  plinth(bot, 19);
  doorLeaf(bot, 0);
  r.blit(bot, 0, lo);
  if (tall) {
    r.rect(4, 2, 1, 3, R.iron[2]);
    r.rect(19, 2, 1, 3, R.iron[2]);
    r.blit(signRaster(icon), 4, 5);
  }
  return r;
}

export function houseDoor(icon: DoorIcon, variant: number, tall = true, seed = 0): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return toCanvas(houseDoorRaster(icon, variant, tall, seed));
}

/** Berufsschild als eigenes Bild (für Nordtüren), unten mittig auf einer Kachel */
export function houseSign(icon: DoorIcon): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const r = new Raster(ART, ART);
  r.rect(4, 0, 1, 6, R.iron[2]);
  r.rect(19, 0, 1, 6, R.iron[2]);
  r.blit(signRaster(icon), 4, 6);
  return toCanvas(r);
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

/** Niedriger Holzzaun (eine Kachel breit), unten bündig */
export function houseFence(variant: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return toCanvas(fence(variant));
}
