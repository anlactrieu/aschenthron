/**
 * Boden der Code-Welt: Materialien (Muster + Tonrampe), Zuordnung (gid, Zone) → Material und ein Maler, der einen
 * ganzen Chunk in einem Durchgang ins Kunstraster zeichnet.
 * - Muster liegen in Weltkoordinaten (kachelbar, 128 px): kein sichtbares Kachelraster.
 * - Übergänge: Jedes Material hat zwischen den Kachelmitten einen bilinear verteilten Anteil; ein Pixel gehört dem
 *   Material mit dem höchsten Anteil plus Rang und Rauschen. So werden Ecken rund und Kanten ausgefranst; Wiesenarten
 *   verschiedener Zonen gehen breit ineinander über.
 * - Zweiter Durchgang: dunkle Kante am höheren Material, Schatten darunter, Uferbank und Schaum am Wasser, Kruste an
 *   der Lava, Wassertiefe aus dem Abstand zum Land.
 */
import { ART, Raster, abgr, h3, vnoise, fbm, mix, type Rgb } from './raster';
import { Z } from '../groundLook';

/** Fünf Töne dunkel → hell (intern auf 7 Stufen erweitert: Zwischentöne für leise Flecken) */
export type Ramp = readonly [Rgb, Rgb, Rgb, Rgb, Rgb];
type Kind = 'land' | 'water' | 'lava';

const P = 128; // Musterperiode in Kunstpixeln (5⅓ Kacheln, nicht am Kachelraster ausgerichtet); Zweierpotenz für & statt %
const PM = P - 1;

/* ---------------------------------------------------------------- Muster (Tonindex 0..6 je Pixel, Grundton 3) */

type Pattern = Uint8Array;
const pat = (fill = 3): Pattern => new Uint8Array(P * P).fill(fill);
const wrap = (v: number): number => v & PM;
const put = (p: Pattern, x: number, y: number, t: number): void => {
  p[wrap(y) * P + wrap(x)] = Math.max(0, Math.min(6, t));
};
const tget = (p: Pattern, x: number, y: number): number => p[wrap(y) * P + wrap(x)]!;

/** Leise Flecken: Grundton 3, Zwischentöne 2/4 nach Rauschen (Wellenlänge s) */
function patches(p: Pattern, s: number, seed: number, lo = 0.3, hi = 0.7): void {
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const n = fbm(x, y, s, seed, P);
      put(p, x, y, n < lo ? 2 : n > hi ? 4 : 3);
    }
  }
}

/** Wiese: Flecken, Halmbüschel (heller Strich mit Spitze, dunkler Fuß) */
function grassPat(seed: number, blades = 0.045): Pattern {
  const p = pat();
  patches(p, 22, seed);
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const r = h3(x, y, seed + 1);
      if (r > blades) continue;
      const t = tget(p, x, y);
      put(p, x, y, t + 1);
      put(p, x, y - 1, t + 2);
      if (r < blades * 0.4) { put(p, x - 1, y, t + 1); put(p, x + 1, y - 1, t + 1); }
      put(p, x, y + 1, t - 2);
    }
  }
  return p;
}

/** Erde/Asche/Kies: Flecken, Krümel, Steinchen (heller Kern, dunkler Fuß) */
function dirtPat(seed: number, stones = 0.01, crumbs = 0.05): Pattern {
  const p = pat();
  patches(p, 18, seed, 0.32, 0.7);
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const c = h3(x, y, seed + 3);
      if (c < crumbs) put(p, x, y, tget(p, x, y) + (c < crumbs / 2 ? -1 : 1));
    }
  }
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      if (h3(x, y, seed + 4) > stones) continue;
      const big = h3(x, y, seed + 5) < 0.4;
      put(p, x, y, 6);
      put(p, x + 1, y, 5);
      if (big) { put(p, x, y + 1, 5); put(p, x + 1, y + 1, 4); put(p, x - 1, y, 5); }
      put(p, x, y + (big ? 2 : 1), 1);
      put(p, x + 1, y + (big ? 2 : 1), 1);
    }
  }
  return p;
}

/** Steinplatten in versetzten Reihen (Fuge 0, Platte 3/4/2, Licht oben links, Schatten unten rechts, wenige Risse) */
function slabPat(seed: number, rowH: number, minW: number, maxW: number, cracks = 0.08, joint = 0): Pattern {
  const p = pat();
  for (let r = 0; r < P / rowH; r++) {
    const y0 = r * rowH;
    // Fugen einer Reihe: zufällige Breiten, der Rest geht an die letzte Platte; die Reihe ist um `shift` versetzt (put wickelt um)
    const shift = Math.floor(h3(r, 0, seed) * P);
    const cuts = [0];
    for (let x = 0; ;) {
      const w = minW + Math.floor(h3(r, x, seed + 1) * (maxW - minW + 1));
      if (P - (x + w) < minW) break;
      x += w;
      cuts.push(x);
    }
    cuts.push(P);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i]! + shift;
      const b = cuts[i + 1]! + shift;
      const k = h3(r, a, seed + 2);
      const tone = k < 0.25 ? 4 : k > 0.85 ? 2 : 3;
      for (let yy = y0; yy < y0 + rowH; yy++) {
        for (let xx = a; xx < b; xx++) {
          let t = tone;
          if (yy === y0 + rowH - 1 || xx === b - 1) t = joint; // Fuge
          else if (yy === y0 || xx === a) t = tone + 1; // Lichtkante
          else if (yy === y0 + rowH - 2 || xx === b - 2) t = tone - 1; // Schattenkante
          else if (h3(xx, yy, seed + 3) < 0.025) t = tone - 1;
          put(p, xx, yy, t);
        }
      }
      // selten ein kurzer Riss (schräg, 3–5 px)
      if (k > 0.3 && k < 0.3 + cracks && b - a > 8) {
        let cx = a + 3 + Math.floor(h3(r, a, seed + 5) * (b - a - 6));
        const len = 3 + Math.floor(h3(r, a, seed + 6) * 3);
        for (let j = 0; j < len; j++) {
          put(p, cx, y0 + 2 + j, 1);
          if (j % 2) cx++;
        }
      }
    }
  }
  return p;
}

/** Natursteinplatten bzw. Kopfstein: unregelmäßige Steine (Voronoi, n Zellen je Periode), Fugen 0, Licht oben links */
function flagPat(seed: number, n = 11, mortar = 1.1): Pattern {
  const p = pat(1);
  const c = P / n;
  const pts: [number, number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.2 + 0.6 * h3(i, j, seed)) * c, (j + 0.2 + 0.6 * h3(i, j, seed + 1)) * c, h3(i, j, seed + 2)]);
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const ci = Math.floor(x / c);
      const cj = Math.floor(y / c);
      let d1 = 1e9, d2 = 1e9, best = 0, bdx = 0, bdy = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + n) % n;
          const jj = (cj + dj + n) % n;
          const q = pts[jj * n + ii]!;
          // Punkt in die Nachbarperiode verschieben, damit das Muster nahtlos umläuft
          const qx = q[0] + (ci + di < 0 ? -P : ci + di >= n ? P : 0);
          const qy = q[1] + (cj + dj < 0 ? -P : cj + dj >= n ? P : 0);
          const dx = x + 0.5 - qx;
          const dy = y + 0.5 - qy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; best = jj * n + ii; bdx = dx; bdy = dy; } else if (d < d2) d2 = d;
        }
      }
      const k = pts[best]![2];
      const base = k < 0.25 ? 4 : k > 0.8 ? 2 : 3;
      const edge = d2 - d1;
      let t = edge < mortar ? 0 : base;
      if (edge >= mortar && edge < mortar + 1.3) t = bdx + bdy < 0 ? base + 1 : base - 1;
      if (t > 0 && h3(x, y, seed + 3) < 0.02) t -= 1;
      put(p, x, y, t);
    }
  }
  return p;
}

/** Dielen: waagrechte Bretter (4 px), versetzte Stöße, Maserung, Nägel */
function plankPat(seed: number): Pattern {
  const p = pat();
  const H = 4;
  for (let r = 0; r < P / H; r++) {
    const k = h3(r, 1, seed);
    const tone = k < 0.3 ? 4 : k > 0.8 ? 2 : 3;
    const off = Math.floor(h3(r, 3, seed) * 24);
    for (let x = 0; x < P; x++) {
      for (let j = 0; j < H; j++) {
        const y = r * H + j;
        put(p, x, y, j === H - 1 ? 0 : j === 0 ? tone + 1 : h3(Math.floor(x / 5), y, seed + 4) < 0.16 ? tone - 1 : tone);
      }
      if ((x + off) % 24 === 0) {
        for (let j = 0; j < H - 1; j++) put(p, x, r * H + j, 0);
        put(p, x + 2, r * H + 1, 5);
      }
    }
  }
  return p;
}

/** Moor: Moospolster (3/4) über Schlamm (1/2), nasse Lichtpunkte */
function moorPat(seed: number): Pattern {
  const p = pat();
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const n = fbm(x, y, 14, seed, P);
      let t = n < 0.3 ? 1 : n < 0.42 ? 2 : n < 0.72 ? 3 : 4;
      if (t >= 3 && h3(x, y, seed + 1) < 0.035) t = 5;
      if (t === 1 && h3(x, y, seed + 2) < 0.03) t = 4;
      put(p, x, y, t);
    }
  }
  return p;
}

/** Wasser: ruhige Flecken (2/3), kurze hellere Wellenstriche (4) */
function waterPat(seed: number): Pattern {
  const p = pat();
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) put(p, x, y, fbm(x, y, 24, seed, P) < 0.42 ? 2 : 3);
  for (let y = 0; y < P; y += 3) {
    for (let x = 0; x < P; x++) {
      if (h3(x, y, seed + 1) > 0.016) continue;
      const len = 3 + Math.floor(h3(x, y, seed + 2) * 4);
      for (let i = 0; i < len; i++) put(p, x + i, y, 4);
    }
  }
  return p;
}

/** Lava: helle Adern (5/6) in glühender Masse (3/4), dunkle Krustenschollen (1/2) */
function lavaPat(seed: number): Pattern {
  const p = pat();
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const n = fbm(x, y, 14, seed, P);
      const v = Math.abs(vnoise(x, y, 10, seed + 3, P) - 0.5);
      put(p, x, y, v < 0.035 ? 6 : v < 0.08 ? 5 : n < 0.3 ? 1 : n < 0.42 ? 2 : n > 0.7 ? 4 : 3);
    }
  }
  return p;
}

/** Fels-/Höhlenboden: grobe Schollen mit dunklen Spalten, vereinzelte Lichtpunkte */
function rockPat(seed: number): Pattern {
  const p = pat();
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const n = fbm(x, y, 12, seed, P);
      const v = Math.abs(vnoise(x, y, 9, seed + 2, P) - 0.5);
      let t = v < 0.028 ? 0 : v < 0.055 ? 2 : n < 0.36 ? 2 : n > 0.66 ? 4 : 3;
      if (h3(x, y, seed + 4) < 0.012) t = 5;
      put(p, x, y, t);
    }
  }
  return p;
}

let PATS: Record<string, Pattern> | null = null;
function pats(): Record<string, Pattern> {
  PATS ??= {
    grass: grassPat(11),
    grassDense: grassPat(12, 0.075),
    dirt: dirtPat(21),
    gravel: dirtPat(22, 0.045, 0.08),
    ash: dirtPat(23, 0.005, 0.09),
    slab: slabPat(31, 8, 8, 16),
    bigslab: slabPat(32, 16, 12, 22, 0.12, 1),
    crypt: slabPat(34, 16, 14, 20, 0.2, 1),
    cobble: flagPat(33, 21, 1.4),
    flagstone: flagPat(35),
    plank: plankPat(41),
    moor: moorPat(51),
    water: waterPat(61),
    lava: lavaPat(71),
    rock: rockPat(81),
  };
  return PATS;
}

/* ---------------------------------------------------------------- Materialien */

export interface Mat {
  key: string;
  pat: string;
  ramp: Ramp;
  /** Rang: höher greift an Kanten über niedrigeres */
  prio: number;
  kind: Kind;
  /** Gruppe: innerhalb einer Gruppe weicher, breiter Übergang ohne Kante (z. B. Wiesenarten der Zonen) */
  group: string;
  /** Schaum (Wasser) bzw. Kruste (Lava) am Rand */
  edge?: Rgb;
}

const m = (key: string, patName: string, ramp: Ramp, prio: number, kind: Kind = 'land', edge?: Rgb, group = key): Mat => ({ key, pat: patName, ramp, prio, kind, group, edge });
const G = 'grass';
const D = 'dun';

/** Welt-Palette: gedämpft, dunkel, Schatten kühl, Lichter warm */
export const MATS: Mat[] = [
  m('water', 'water', [0x0a1220, 0x0f1b2e, 0x16283f, 0x1f3853, 0x2e4e6a], 0, 'water', 0x6a8a9a),
  m('bog', 'water', [0x0c0f12, 0x12171a, 0x1a2122, 0x242d2b, 0x33403a], 0, 'water', 0x55644f),
  m('lava', 'lava', [0x4a0e08, 0x7a1a0c, 0xb0320e, 0xe86416, 0xffc048], 1, 'lava', 0x241012),
  m('plank', 'plank', [0x1d130e, 0x2e1f15, 0x40291b, 0x553726, 0x6c4831], 2),
  m('cobble', 'cobble', [0x141218, 0x25212a, 0x332e38, 0x443e49, 0x5a535e], 3),
  m('flags', 'flagstone', [0x17151b, 0x27232c, 0x36313c, 0x48424e, 0x5e5764], 3),
  m('dun', 'bigslab', [0x0f0e13, 0x1a1820, 0x24212b, 0x302c38, 0x403b48], 3, 'land', undefined, D),
  m('dun_gruft', 'bigslab', [0x0c110e, 0x151e19, 0x1e2a23, 0x29372e, 0x37473b], 3, 'land', undefined, D),
  m('dun_kata', 'crypt', [0x131215, 0x1f1c20, 0x2b282c, 0x3a3539, 0x4c464a], 3, 'land', undefined, D),
  m('dun_mine', 'rock', [0x120e0b, 0x1e1712, 0x2a2019, 0x382b21, 0x4a392b], 3, 'land', undefined, D),
  m('dun_thron', 'bigslab', [0x140a0c, 0x211114, 0x2e171b, 0x3e1f24, 0x52282d], 3, 'land', undefined, D),
  m('dun_goblin', 'rock', [0x11110b, 0x1d1c13, 0x29281b, 0x363423, 0x47442e], 3, 'land', undefined, D),
  m('dun_nest', 'rock', [0x110c14, 0x1b131f, 0x251a2b, 0x322239, 0x422c4a], 3, 'land', undefined, D),
  m('dirt', 'dirt', [0x1e1612, 0x2e2219, 0x3f2f22, 0x54402d, 0x6c533a], 4),
  m('dirt_camp', 'dirt', [0x1a1310, 0x281e16, 0x37291e, 0x4a3727, 0x5f4732], 4, 'land', undefined, 'dirt'),
  m('ash', 'ash', [0x141214, 0x1f1b1e, 0x2b2629, 0x3a3337, 0x4d4448], 5),
  m('ash_red', 'ash', [0x160d0e, 0x241415, 0x331c1c, 0x462625, 0x5c322e], 5, 'land', undefined, 'ash'),
  m('gravel', 'gravel', [0x191a19, 0x262822, 0x34382d, 0x464b3b, 0x5d624c], 6),
  m('moor', 'moor', [0x16150f, 0x1f2117, 0x29301f, 0x354026, 0x47522f], 7),
  m('grass', 'grass', [0x16221b, 0x1f3220, 0x2b4426, 0x3b582c, 0x527036], 8, 'land', undefined, G),
  m('grass_forest', 'grassDense', [0x101b18, 0x17281e, 0x1f3725, 0x2a492b, 0x3a5e32], 8, 'land', undefined, G),
  m('grass_camp', 'grass', [0x1d1e16, 0x2b2c1c, 0x3b3c23, 0x514f2d, 0x6a6539], 8, 'land', undefined, G),
  m('grass_grave', 'grass', [0x15181b, 0x1e2523, 0x29322c, 0x374135, 0x4a5443], 8, 'land', undefined, G),
  m('grass_hills', 'grass', [0x1a1f18, 0x262e1f, 0x343e27, 0x465131, 0x5d673d], 8, 'land', undefined, G),
  m('grass_moor', 'grass', [0x15160f, 0x1f2318, 0x2a311f, 0x364028, 0x485232], 8, 'land', undefined, G),
  m('meadow', 'grassDense', [0x16221b, 0x1f3220, 0x2b4426, 0x3b582c, 0x527036], 8, 'land', undefined, G),
];
export const MAT_INDEX: Record<string, number> = Object.fromEntries(MATS.map((mt, i) => [mt.key, i]));
const mi = (k: string): number => MAT_INDEX[k]!;

/** Material zu Bodenkachel und Zone (Wasser-Props und Hausböden ersetzt der Aufrufer vorher durch 6 bzw. 15). */
export function matOf(gid: number, zone: number): number {
  switch (gid) {
    case 6: return zone === Z.swamp || zone === Z.gruft ? mi('bog') : mi('water');
    case 12: return mi('lava');
    case 15: return mi('plank');
    case 16: return mi('cobble');
    case 17: return mi('meadow');
    case 1: return zone === Z.none ? mi('flags') : dungeonMat(zone);
    case 5: return zone === Z.none ? mi('flags') : dungeonMat(zone);
    case 7: return zone === Z.camp ? mi('dirt_camp') : zone >= Z.gruft ? dungeonMat(zone) : mi('dirt');
    case 8: return mi('gravel');
    case 9: return zone === Z.grund || zone === Z.thron ? mi('ash_red') : mi('ash');
    case 3: return mi('moor');
    case 4:
      switch (zone) {
        case Z.forest: return mi('grass_forest');
        case Z.camp: return mi('grass_camp');
        case Z.grave: return mi('grass_grave');
        case Z.hills: return mi('grass_hills');
        case Z.swamp: return mi('grass_moor');
        default: return mi('grass');
      }
    default: return mi('grass');
  }
}

function dungeonMat(zone: number): number {
  switch (zone) {
    case Z.gruft: return mi('dun_gruft');
    case Z.kata: return mi('dun_kata');
    case Z.mine: return mi('dun_mine');
    case Z.thron: return mi('dun_thron');
    case Z.goblin: return mi('dun_goblin');
    case Z.nest: return mi('dun_nest');
    default: return mi('dun');
  }
}

/** Mittlere Farbe eines Materials (Minimap) */
export function matColor(i: number): Rgb {
  return MATS[i]!.ramp[2];
}

/* ---------------------------------------------------------------- Chunk-Maler */

/** Kachelgröße als lokale Konstante (importierte Bindungen sind in Node-Skripten Getter, in der heißen Schleife teuer) */
const A_ = ART;

export interface GroundQuery {
  /** Materialindex der Kachel (außerhalb der Karte: beliebig, z. B. Wasser) */
  mat(x: number, y: number): number;
  /** Abstand in Kacheln (1..6) zum nächsten Land, nur für Wasserkacheln gefragt */
  waterDist(x: number, y: number): number;
}

interface Tables {
  /** Farben je Material als ABGR: 7 Töne (0..6), dazu [7] Rand (Schaum/Kruste) */
  col: Uint32Array[];
  pat: Pattern[];
  prio: Int8Array;
  /** 0 Land, 1 Wasser, 2 Lava */
  kind: Int8Array;
  group: Int16Array;
  /** Schwellenrauschen −0.5..0.5 und Verschiebung der Abtastung (Kunstpixel) */
  noise: Float32Array;
  warpX: Float32Array;
  warpY: Float32Array;
}

let TAB: Tables | null = null;
function tables(): Tables {
  if (TAB) return TAB;
  const PT = pats();
  const groups = [...new Set(MATS.map((mt) => mt.group))];
  const noise = new Float32Array(P * P);
  const warpX = new Float32Array(P * P);
  const warpY = new Float32Array(P * P);
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      noise[y * P + x] = vnoise(x, y, 4, 901, P) * 0.6 + vnoise(x, y, 2, 902, P) * 0.4 - 0.5;
      warpX[y * P + x] = (fbm(x, y, 32, 903, P) - 0.5) * 4 * WARP;
      warpY[y * P + x] = (fbm(x, y, 32, 904, P) - 0.5) * 4 * WARP;
    }
  }
  TAB = {
    col: MATS.map((mt) => {
      const r = mt.ramp;
      const seven = [r[0], r[1], mix(r[1], r[2], 0.5), r[2], mix(r[2], r[3], 0.5), r[3], r[4], mt.edge ?? r[4]];
      return Uint32Array.from(seven.map((c) => abgr(c)));
    }),
    pat: MATS.map((mt) => PT[mt.pat]!),
    prio: Int8Array.from(MATS.map((mt) => mt.prio)),
    kind: Int8Array.from(MATS.map((mt) => (mt.kind === 'land' ? 0 : mt.kind === 'water' ? 1 : 2))),
    group: Int16Array.from(MATS.map((mt) => groups.indexOf(mt.group))),
    noise,
    warpX,
    warpY,
  };
  return TAB;
}

/** Höchste Verschiebung der Abtastposition (Kunstpixel): Grenzen werden zu Kurven statt Kachelkanten */
const WARP = 6;
const BANK_HI = abgr(0x2a1f19);
const BANK_LO = abgr(0x18120f);
const RIM = 4; // Rand um den Chunk für Nachbarprüfungen (Kunstpixel)

/** n ist ein Material niedrigeren Rangs aus anderer Gruppe als k (k bekommt dort eine dunkle Kante) */
function lower(T: Tables, k: number, n: number): boolean {
  return n !== k && T.group[n] !== T.group[k] && T.prio[n]! < T.prio[k]!;
}
/** n ist Land höheren Rangs aus anderer Gruppe (wirft Schatten auf k) */
function higher(T: Tables, k: number, n: number): boolean {
  return n !== k && T.group[n] !== T.group[k] && T.prio[n]! > T.prio[k]! && T.kind[n] === 0;
}

/**
 * Zeichnet die Kacheln (tx0..tx0+ntx-1, ty0..ty0+nty-1) in `out` (Breite ntx*24 Kunstpixel), ab Pixelzeile `outRow`
 * (so lässt sich ein Chunk in Streifen über mehrere Bilder malen). Kacheln, für die `skip` true liefert, bleiben leer.
 */
export function paintGround(out: Raster, tx0: number, ty0: number, ntx: number, nty: number, q: GroundQuery, skip?: (x: number, y: number) => boolean, outRow = 0): void {
  const T = tables();
  const { col: C, pat: PT, prio: PR, kind: KD, group: GR, noise: NT, warpX: WX, warpY: WY } = T;
  // Kachelcache mit 2 Kacheln Rand (Verschiebung + Nachbarn): Material und (Wasser) Landabstand
  const M = 2;
  const cw = ntx + M * 2;
  const ch = nty + M * 2;
  const tm = new Int16Array(cw * ch);
  const twd = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const k = q.mat(tx0 + x - M, ty0 + y - M);
      tm[y * cw + x] = k;
      twd[y * cw + x] = KD[k] === 1 ? q.waterDist(tx0 + x - M, ty0 + y - M) : 0;
    }
  }
  // Kachel gleichförmig (alle 8 Nachbarn gleich)?
  const uni = new Uint8Array(cw * ch);
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const k = tm[y * cw + x]!;
      let same = 1;
      for (let dy = -1; dy <= 1 && same; dy++) for (let dx = -1; dx <= 1; dx++) if (tm[(y + dy) * cw + x + dx] !== k) { same = 0; break; }
      uni[y * cw + x] = same;
    }
  }

  // Durchgang 1: Besitzer und Grundton je Pixel (Chunk + RIM), kachelweise
  const pw = ntx * A_ + RIM * 2;
  const ph = nty * A_ + RIM * 2;
  const own = new Int16Array(pw * ph);
  const tone = new Int8Array(pw * ph);
  const px0 = tx0 * A_ - RIM;
  const py0 = ty0 * A_ - RIM;
  const cand = new Int16Array(4);
  const wsum = new Float32Array(4);
  for (let cty = Math.floor(py0 / A_); cty * A_ < py0 + ph; cty++) {
    const j0 = Math.max(0, cty * A_ - py0);
    const j1 = Math.min(ph, (cty + 1) * A_ - py0);
    for (let ctx = Math.floor(px0 / A_); ctx * A_ < px0 + pw; ctx++) {
      const i0 = Math.max(0, ctx * A_ - px0);
      const i1 = Math.min(pw, (ctx + 1) * A_ - px0);
      const ci = (cty - ty0 + M) * cw + ctx - tx0 + M;
      const m0 = tm[ci]!;
      if (uni[ci] && KD[m0] !== 1) {
        // gleichförmig: nur das Muster kopieren
        const pt = PT[m0]!;
        for (let j = j0; j < j1; j++) {
          const prow = ((py0 + j) & PM) * P;
          for (let i = i0; i < i1; i++) {
            own[j * pw + i] = m0;
            tone[j * pw + i] = pt[prow + ((px0 + i) & PM)]!;
          }
        }
        continue;
      }
      for (let j = j0; j < j1; j++) {
        const wy = py0 + j;
        for (let i = i0; i < i1; i++) {
          const wx = px0 + i;
          // Verschobene Abtastung, Anteile der vier nächsten Kachelmitten
          const ni = (wy & PM) * P + (wx & PM);
          const fxw = wx + WX[ni]!;
          const fyw = wy + WY[ni]!;
          const tx = Math.floor(fxw / A_);
          const ty = Math.floor(fyw / A_);
          const fx = (fxw - tx * A_ + 0.5) / A_ - 0.5;
          const fy = (fyw - ty * A_ + 0.5) / A_ - 0.5;
          const sx = fx < 0 ? -1 : 1;
          const sy = fy < 0 ? -cw : cw;
          const ax = fx < 0 ? -fx : fx;
          const ay = fy < 0 ? -fy : fy;
          const b = (ty - ty0 + M) * cw + tx - tx0 + M;
          const m00 = tm[b]!;
          const m10 = tm[b + sx]!;
          const m01 = tm[b + sy]!;
          const m11 = tm[b + sy + sx]!;
          let best = m00;
          if (m10 !== m00 || m01 !== m00 || m11 !== m00) {
            cand[0] = m00;
            wsum[0] = (1 - ax) * (1 - ay);
            let n = 1;
            for (let s = 0; s < 3; s++) {
              const k = s === 0 ? m10 : s === 1 ? m01 : m11;
              const w = s === 0 ? ax * (1 - ay) : s === 1 ? (1 - ax) * ay : ax * ay;
              let c = 0;
              while (c < n && cand[c] !== k) c++;
              if (c === n) { cand[n] = k; wsum[n++] = w; } else wsum[c]! += w;
            }
            let sameGroup = true;
            for (let c = 1; c < n; c++) if (GR[cand[c]!] !== GR[cand[0]!]) sameGroup = false;
            const amp = sameGroup ? 1.6 : 0.3;
            let bestScore = -9;
            for (let c = 0; c < n; c++) {
              const k = cand[c]!;
              const sc = wsum[c]! + PR[k]! * 0.022 + NT[((wy + k * 29) & PM) * P + ((wx + k * 41) & PM)]! * amp;
              if (sc > bestScore) { bestScore = sc; best = k; }
            }
          }
          let t = PT[best]![ni]!;
          if (KD[best] === 1) {
            // Tiefe: Landabstand bilinear zwischen den Kachelmitten (Land = 0), mit Rauschen geschwellt
            const dd = (twd[b]! * (1 - ax) + twd[b + sx]! * ax) * (1 - ay) + (twd[b + sy]! * (1 - ax) + twd[b + sy + sx]! * ax) * ay + NT[((wy * 2) & PM) * P + ((wx * 2 + 17) & PM)]! * 0.5;
            t += dd < 1.1 ? 1 : dd < 2.2 ? 0 : dd < 3.4 ? -1 : -2;
            t = t < 0 ? 0 : t > 6 ? 6 : t;
          }
          own[j * pw + i] = best;
          tone[j * pw + i] = t;
        }
      }
    }
  }

  // Durchgang 2: Farben; an Randkacheln Kanten, Schatten, Ufer, Kruste
  const W = ntx * A_;
  const O = (i: number, j: number): number => own[(j < 0 ? 0 : j >= ph ? ph - 1 : j) * pw + (i < 0 ? 0 : i >= pw ? pw - 1 : i)]!;
  for (let ty = ty0; ty < ty0 + nty; ty++) {
    for (let tx = tx0; tx < tx0 + ntx; tx++) {
      if (skip?.(tx, ty)) continue;
      const ci = (ty - ty0 + M) * cw + tx - tx0 + M;
      // Randkachel, wenn im 5x5-Umfeld (Verschiebung reicht bis in die Nachbarkachel) ein anderes Material liegt
      let border = false;
      const k0 = tm[ci]!;
      for (let dy = -2; dy <= 2 && !border; dy++) for (let dx = -2; dx <= 2; dx++) if (tm[ci + dy * cw + dx] !== k0) { border = true; break; }
      for (let v = 0; v < A_; v++) {
        const j = (ty - ty0) * A_ + v + RIM;
        const row = (j - RIM + outRow) * W;
        for (let u = 0; u < A_; u++) {
          const i = (tx - tx0) * A_ + u + RIM;
          const k = own[j * pw + i]!;
          let t = tone[j * pw + i]!;
          if (!border) { out.d[row + i - RIM] = C[k]![t]!; continue; }
          let colv = -1;
          const kk = KD[k]!;
          if (kk === 0) {
            const up = O(i, j - 1), dn = O(i, j + 1), lf = O(i - 1, j), rt = O(i + 1, j);
            if (up === k && dn === k && lf === k && rt === k && O(i, j - 2) === k) { out.d[row + i - RIM] = C[k]![t]!; continue; }
            if (lower(T, k, up) || lower(T, k, dn) || lower(T, k, lf) || lower(T, k, rt)) t = t < 1 ? t : 1; // dunkle Kante des höheren Materials
            else if (higher(T, k, up) || higher(T, k, lf)) t = t < 1 ? t : 1; // Schatten unter/neben dem höheren Material
            else if (higher(T, k, O(i, j - 2))) t = t > 0 ? t - 1 : 0;
          } else {
            // Abstand zum Land (bis 3 px); Land direkt darüber = Uferbank
            let near = 9;
            for (let r = 1; r <= 3 && near > 3; r++) {
              for (let dy = -r; dy <= r && near > r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  if ((dx < 0 ? -dx : dx) !== r && (dy < 0 ? -dy : dy) !== r) continue;
                  if (KD[O(i + dx, j + dy)] === 0) { near = r; break; }
                }
              }
            }
            if (kk === 1) {
              if (KD[O(i, j - 1)] === 0) colv = BANK_HI;
              else if (KD[O(i, j - 2)] === 0) colv = BANK_LO;
              else if (near === 1) t = 7;
              else if (near <= 3) t = t < 6 ? t + 1 : 6;
            } else if (near === 1) t = 7;
            else if (near === 2) t = t < 1 ? t : 1;
          }
          out.d[row + i - RIM] = colv >= 0 ? colv : C[k]![t]!;
        }
      }
    }
  }
}
