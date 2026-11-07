/**
 * Iso-Boden und Wandblöcke (P9 Iso).
 * - Boden: ein Chunk (16x16 Kacheln) wird als Raute in ein Kunstraster gebacken (`IsoChunkBaker`, in Etappen), GameScene legt
 *   es bei `isoChunkOrigin` mit Maßstab 2 ab. Die Quelle (`IsoGroundSrc`) liefert die Kachelfragen (Material, Landabstand, Details).
 * - Wände (gid 2) sind nicht Teil des Chunks: je Kachel ein stehendes Bild aus `isoWall` (wenige gemeinsame Texturen nach Stil,
 *   offenen Seiten und Variante), GameScene setzt es wie ein Prop (Anker = untere Rautenecke, Tiefe `standDepth`).
 * Boden: nativ in Rauten gemalt (`world/ground.ts`, P9.2). Wände: Quader aus `world/isoWalls.ts`.
 * Ohne DOM nutzbar (reine Raster).
 */
import { Raster, h3 } from './world/raster';
import { ISO_STRIP, IsoTiles, paintGroundIso } from './world/ground';
import { stampDetailIso, stampWaterDetailIso } from './world/details';
import { WALL_VARIANTS, WALL_IMG_H, WALL_W, wallBlock } from './world/isoWalls';
import type { WallStyle } from './world/props';
import { ISO_ART_H, ISO_ART_W, project } from './iso';

/** Deckkraft verdeckender Wandblöcke, Bäume und Props vor dem Helden (GameScene `updateOcclusion`); P9.2 entscheidet mit dem Nutzer (Ausblenden oder Schattenriss) */
export const OCCLUDER_ALPHA = 0.45;

/** Chunkgröße in Kacheln (GameScene `CHUNK`) */
export const ISO_CHUNK = 16;
/** Kunstraster eines Chunks: Hülle der Raute aus 16x16 Kacheln (512 x 256 Kunstpixel, 1024 x 512 Bildschirm-Pixel) */
export const ISO_CHUNK_W = ISO_CHUNK * ISO_ART_W;
export const ISO_CHUNK_H = ISO_CHUNK * ISO_ART_H;

/** Bildschirmposition (links oben) des Chunk-Bildes (cx, cy): obere Rautenecke minus halbe Breite */
export function isoChunkOrigin(cx: number, cy: number): { sx: number; sy: number } {
  const top = project(cx * ISO_CHUNK - 0.5, cy * ISO_CHUNK - 0.5);
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
   * Bodendetail der Kachel: Wasserdetail mit Landabstand, Landdetail mit Bodenart und Zone,
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
 * Der Boden wird nativ in Rauten gemalt (`paintGroundIso`): Etappe 0 sammelt die Kachelfragen, dann je eine Etappe je Streifen
 * von `ISO_STRIP` Zeilen, zuletzt die Details (flach projiziert, stehend aufrecht).
 */
export class IsoChunkBaker {
  private readonly x0: number;
  private readonly y0: number;
  private n = 0;
  private tiles: IsoTiles | null = null;
  constructor(private readonly src: IsoGroundSrc, cx: number, cy: number, private readonly out: Raster) {
    this.x0 = cx * ISO_CHUNK;
    this.y0 = cy * ISO_CHUNK;
  }
  /** Anzahl Etappen (zum Planen) */
  get steps(): number {
    return 1 + STRIPS + 1;
  }
  step(): boolean {
    const { src, x0, y0, out } = this;
    if (this.n === 0) {
      this.tiles = new IsoTiles(x0, y0, {
        mat: (x, y) => src.mat(x, y),
        waterDist: (x, y) => src.waterDist(x, y),
        outside: (x, y) => src.outside(x, y),
        isWall: (x, y) => src.isWall(x, y),
      });
    } else if (this.n <= STRIPS) {
      paintGroundIso(out, this.tiles!, (this.n - 1) * ISO_STRIP);
    } else {
      for (let y = y0; y < y0 + ISO_CHUNK; y++) {
        for (let x = x0; x < x0 + ISO_CHUNK; x++) {
          if (src.outside(x, y) || src.isWall(x, y)) continue;
          const d = src.detail(x, y);
          if (d?.water) stampWaterDetailIso(out, x, y, d.zone, d.dist, x0, y0);
          else if (d) stampDetailIso(out, x, y, d.ground, d.zone, x0, y0);
        }
      }
      this.tiles = null;
    }
    this.n++;
    return this.n >= this.steps;
  }
}

const STRIPS = ISO_CHUNK_H / ISO_STRIP;

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

/**
 * Wandblock der Kachel (x, y). `open`: Bits wie `wallTile` (N=1, O=2, S=4, W=8 für Nachbarn, die keine Wand sind); sichtbar sind
 * in Iso nur die Süd- (+y, links unten) und die Ostseite (+x, rechts unten), Nord und West färben nur den Rand der Oberseite.
 * Die Variante kommt über einen Hash der Kachel und steckt im Schlüssel, damit es wenige gemeinsame Texturen gibt.
 */
export function isoWall(style: WallStyle, open: number, x: number, y: number): IsoWallArt {
  const variant = Math.floor(h3(x, y, 77) * WALL_VARIANTS);
  return { key: `iwall_${style}_${open & 15}_${variant}`, w: WALL_W, h: WALL_IMG_H, ax: WALL_W / 2, ay: WALL_IMG_H, make: () => wallBlock(style, open & 15, variant) };
}
