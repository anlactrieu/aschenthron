/**
 * Iso-Boden und Wandblöcke (P9 Iso). Schnittstelle für GameScene, Inhalt gehört P9.2.
 * - Boden: ein Chunk (16x16 Kacheln) wird als Raute in ein Kunstraster gebacken (`IsoChunkBaker`, in Etappen), GameScene legt
 *   es bei `isoChunkOrigin` mit Maßstab 2 ab. Die Quelle (`IsoGroundSrc`) liefert dieselben Kachelfragen wie die Draufsicht,
 *   damit P9.2 nativ in Rauten malen kann, ohne GameScene zu ändern.
 * - Wände (gid 2) sind nicht Teil des Chunks: je Kachel ein stehendes Bild aus `isoWall` (wenige gemeinsame Texturen nach Stil,
 *   offenen Seiten und Variante), GameScene setzt es wie ein Prop (Anker = untere Rautenecke, Tiefe `standDepth`).
 * Platzhalter in P9.0: Boden = Draufsicht-Chunk affin in Rauten umgerechnet (wie die Probe), Wände = einfache Blöcke.
 * Ohne DOM nutzbar (reine Raster).
 */
import { ART, Raster } from './world/raster';
import { paintGround } from './world/ground';
import { stampDetail, stampWaterDetail } from './world/details';
import type { WallStyle } from './world/props';
import { ISO_ART_H, ISO_ART_W, project } from './iso';

/** Chunkgröße in Kacheln (gleich der Draufsicht, GameScene `CHUNK`) */
export const ISO_CHUNK = 16;
/** Kunstraster eines Chunks: Hülle der Raute aus 16x16 Kacheln (512 x 256 Kunstpixel, 1024 x 512 Bildschirm-Pixel) */
export const ISO_CHUNK_W = ISO_CHUNK * ISO_ART_W;
export const ISO_CHUNK_H = ISO_CHUNK * ISO_ART_H;

/** Bildschirmposition (links oben) des Chunk-Bildes (cx, cy): obere Rautenecke minus halbe Breite */
export function isoChunkOrigin(cx: number, cy: number): { sx: number; sy: number } {
  const top = project(true, cx * ISO_CHUNK - 0.5, cy * ISO_CHUNK - 0.5);
  return { sx: top.sx - ISO_CHUNK * 32, sy: top.sy };
}

/** Kachelfragen für den Boden (alle Koordinaten absolut; außerhalb der Karte darf alles kommen, `outside` sagt es) */
export interface IsoGroundSrc {
  /** Kartengröße in Kacheln */
  w: number;
  h: number;
  /** Bodenmaterial (`matOf`) und Landabstand wie für `paintGround` */
  mat(x: number, y: number): number;
  waterDist(x: number, y: number): number;
  /** außerhalb der Karte: bleibt leer (schwarz) */
  outside(x: number, y: number): boolean;
  /**
   * Bodendetail der Kachel wie in der Draufsicht (`chunkDecor`): Wasserdetail mit Landabstand, Landdetail mit Bodenart und Zone,
   * oder keins (Wand, Haus, Tür, Lava, Props).
   */
  detail(x: number, y: number): { water: true; zone: number; dist: number } | { water: false; ground: number; zone: number } | null;
  /** Wandkachel (gid 2)? Für Schatten/Übergänge am Boden; die Wand selbst kommt aus `isoWall`. */
  isWall(x: number, y: number): boolean;
}

/**
 * Backt einen Iso-Chunk in Etappen (je wenige ms): `step()` liefert true, wenn fertig. `out` ist ISO_CHUNK_W x ISO_CHUNK_H,
 * vorher geleert; Pixel außerhalb der Raute bleiben durchsichtig (Nachbar-Chunks füllen sie, ohne Überlappung: jede
 * Pixelmitte gehört genau einer Kachel, halboffen [k − 0,5, k + 0,5)).
 */
export class IsoChunkBaker {
  private readonly x0: number;
  private readonly y0: number;
  private n = 0;
  constructor(private readonly src: IsoGroundSrc, cx: number, cy: number, private readonly out: Raster) {
    this.x0 = cx * ISO_CHUNK;
    this.y0 = cy * ISO_CHUNK;
  }
  /** Anzahl Etappen (zum Planen) */
  get steps(): number {
    return FLAT_STRIPS + 1 + RESAMPLE_STRIPS;
  }
  step(): boolean {
    const { src, x0, y0 } = this;
    const flat = (FLAT_BUF ??= new Raster(ISO_CHUNK * ART, ISO_CHUNK * ART));
    const strip = ISO_CHUNK / FLAT_STRIPS;
    if (this.n === 0) flat.d.fill(0);
    if (this.n < FLAT_STRIPS) {
      paintGround(flat, x0, y0 + this.n * strip, ISO_CHUNK, strip, { mat: (x, y) => src.mat(x, y), waterDist: (x, y) => src.waterDist(x, y) }, (x, y) => src.outside(x, y), this.n * strip * ART);
    } else if (this.n === FLAT_STRIPS) {
      for (let y = y0; y < y0 + ISO_CHUNK; y++) {
        for (let x = x0; x < x0 + ISO_CHUNK; x++) {
          if (src.outside(x, y)) continue;
          const d = src.detail(x, y);
          const ox = (x - x0) * ART;
          const oy = (y - y0) * ART;
          if (d?.water) stampWaterDetail(flat, x, y, d.zone, d.dist, ox, oy);
          else if (d) stampDetail(flat, x, y, d.ground, d.zone, ox, oy);
        }
      }
    } else {
      // Platzhalter: Draufsicht-Raster per Nachschlagetabelle in die Raute umrechnen (Nachbarpixel)
      const k = this.n - FLAT_STRIPS - 1;
      const map = resampleMap();
      const rows = ISO_CHUNK_H / RESAMPLE_STRIPS;
      const { out } = this;
      for (let i = k * rows * ISO_CHUNK_W, e = (k + 1) * rows * ISO_CHUNK_W; i < e; i++) {
        const j = map[i]!;
        if (j >= 0) out.d[i] = flat.d[j]!;
      }
    }
    this.n++;
    return this.n >= this.steps;
  }
}

const FLAT_STRIPS = 8;
const RESAMPLE_STRIPS = 2;
let FLAT_BUF: Raster | null = null;
let MAP: Int32Array | null = null;

/** Je Iso-Kunstpixel des Chunks der Index im Draufsicht-Raster des Chunks (−1 = außerhalb der Raute); für alle Chunks gleich */
function resampleMap(): Int32Array {
  if (MAP) return MAP;
  const N = ISO_CHUNK * ART;
  MAP = new Int32Array(ISO_CHUNK_W * ISO_CHUNK_H).fill(-1);
  for (let v = 0; v < ISO_CHUNK_H; v++) {
    for (let u = 0; u < ISO_CHUNK_W; u++) {
      // Pixelmitte in Bildschirm-Pixeln ab der oberen Rautenecke, dann zurück ins Raster (Kacheln ab der Chunk-Ecke)
      const a = ((u + 0.5) * 2 - ISO_CHUNK * 32) / 32;
      const b = ((v + 0.5) * 2) / 16;
      const lx = (a + b) / 2;
      const ly = (b - a) / 2;
      if (lx < 0 || ly < 0 || lx >= ISO_CHUNK || ly >= ISO_CHUNK) continue;
      MAP[v * ISO_CHUNK_W + u] = Math.floor(ly * ART) * N + Math.floor(lx * ART);
    }
  }
  return MAP;
}

/* ---------------------------------------------------------------- Wände */

/** Bild eines Wandblocks: Textur-Schlüssel, Größe (Kunstpixel), Anker = untere Rautenecke im Bild */
export interface IsoWallArt {
  key: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  make: () => Raster;
}

/** Wandhöhe des Platzhalters in Kunstpixeln (eine Kachelhöhe; die echte Höhe entscheidet der Nutzer in P9.2) */
const WALL_ART_H = 16;

const WALL_TONES: Record<WallStyle, { top: number; left: number; right: number; edge: number }> = {
  cliff: { top: 0x4a4a40, left: 0x3a3430, right: 0x262224, edge: 0x5c5a4c },
  brick: { top: 0x4e4454, left: 0x3a3240, right: 0x28222a, edge: 0x665a6a },
  dungeon: { top: 0x35313e, left: 0x27242e, right: 0x1a1820, edge: 0x48424f },
};

/**
 * Wandblock der Kachel (x, y). `open`: Bits wie `wallTile` (N=1, O=2, S=4, W=8 für Nachbarn, die keine Wand sind); sichtbar sind
 * in Iso nur die Süd- (+y, links unten) und die Ostseite (+x, rechts unten). Die Variante kommt über einen Hash der Kachel.
 */
export function isoWall(style: WallStyle, open: number, x: number, y: number): IsoWallArt {
  void x;
  void y;
  const vis = open & 6;
  const w = ISO_ART_W;
  const h = ISO_ART_H + WALL_ART_H;
  return { key: `iwall_${style}_${vis}`, w, h, ax: w / 2, ay: h, make: () => wallBlock(style, vis) };
}

function wallBlock(style: WallStyle, open: number): Raster {
  const T = WALL_TONES[style];
  const W = ISO_ART_W;
  const HH = ISO_ART_H / 2;
  const r = new Raster(W, ISO_ART_H + WALL_ART_H);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - W / 2) / (W / 2);
      // Oberseite: Raute um (16, 8)
      const dt = dx + Math.abs(y + 0.5 - HH) / HH;
      if (dt <= 1) {
        r.set(x, y, dt > 0.86 ? T.edge : T.top);
        continue;
      }
      // Seiten unter der unteren Kante der Oberseite
      const edge = HH + (1 - dx) * HH;
      if (y + 0.5 < edge || y + 0.5 > edge + WALL_ART_H) continue;
      const left = x < W / 2;
      if (left && !(open & 4)) continue;
      if (!left && !(open & 2)) continue;
      const base = left ? T.left : T.right;
      // Fugen: waagrecht alle 5 px, dunkler Fuß
      const yy = y + 0.5 - edge;
      r.set(x, y, yy > WALL_ART_H - 2 ? 0x0c0a0e : Math.floor(yy) % 5 === 4 ? T.right : base);
    }
  }
  return r;
}
