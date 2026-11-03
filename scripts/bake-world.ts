// Kontaktbögen der Code-Welt (gleicher Code wie im Spiel: src/render/world/*), zum Ansehen beim Verfeinern.
//   npx tsx scripts/bake-world.ts            alle Bögen
//   npx tsx scripts/bake-world.ts boden      nur einen (boden, props, haus)
// Ausgabe nach public/probe/welt/ (ignoriert), Maßstab 2 wie im Spiel; Ausschnitte zusätzlich 4x.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ART, Raster, bytes, upscale } from '../src/render/world/raster';
import { MATS, matOf, paintGround } from '../src/render/world/ground';
import { stampDetail, stampWaterDetail } from '../src/render/world/details';
import { Z } from '../src/render/groundLook';
// @ts-expect-error reines JS-Hilfsmodul aus dem pixelfx-Klon (nur Skript, nicht im Spiel)
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'probe', 'welt');
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];

function save(name: string, r: Raster, k = 2): void {
  const big = k === 1 ? r : upscale(r, k);
  writeFileSync(join(OUT, name), encodePNG(big.w, big.h, bytes(big)));
  console.log(`${name} ${big.w}x${big.h}`);
}

/* ------------------------------------------------ Probekarte: Flecken aller Böden mit Übergängen, See mit Ufer, Lava */

export const PROBE_W = 40;
export const PROBE_H = 26;
/** Bodenart der Probe als [gid, Zone] (wie im Spiel über matOf gemappt) */
const K: Record<string, [number, number]> = {
  grass: [4, Z.farm], forest: [4, Z.forest], camp: [4, Z.camp], grave: [4, Z.grave], hills: [4, Z.hills], meadow: [17, Z.none],
  dirt: [7, Z.farm], dirt_camp: [7, Z.camp], water: [6, Z.farm], bog: [6, Z.swamp], moor: [3, Z.swamp], cobble: [16, Z.none], flags: [1, Z.none],
  plank: [15, Z.none], gravel: [8, Z.hills], ash: [9, Z.ash], ash_red: [9, Z.grund], lava: [12, Z.grund],
  dun: [5, Z.thron + 99], dun_gruft: [5, Z.gruft], dun_kata: [5, Z.kata], dun_mine: [5, Z.mine], dun_thron: [5, Z.thron], dun_goblin: [5, Z.goblin], dun_nest: [5, Z.nest],
};
export function probeMap(): { gid: Uint8Array; zone: Uint8Array } {
  const gid = new Uint8Array(PROBE_W * PROBE_H).fill(4);
  const zone = new Uint8Array(PROBE_W * PROBE_H).fill(Z.farm);
  const set = (x: number, y: number, k: string): void => {
    if (x < 0 || y < 0 || x >= PROBE_W || y >= PROBE_H) return;
    gid[y * PROBE_W + x] = K[k]![0];
    zone[y * PROBE_W + x] = K[k]![1];
  };
  const blob = (cx: number, cy: number, rx: number, ry: number, k: string): void => {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) set(x, y, k);
  };
  const box = (x0: number, y0: number, w: number, h: number, k: string): void => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, k);
  };
  // Zeile 1: Wiesenarten nebeneinander, dazwischen ein Weg und eine Blumenwiese
  box(0, 0, 8, 8, 'forest');
  box(16, 0, 8, 8, 'camp');
  box(24, 0, 8, 8, 'grave');
  box(32, 0, 8, 8, 'hills');
  for (let x = 0; x < PROBE_W; x++) { set(x, 4, x >= 16 && x < 24 ? 'dirt_camp' : 'dirt'); set(x, 5, x >= 16 && x < 24 ? 'dirt_camp' : 'dirt'); }
  blob(12, 2, 2, 1, 'meadow');
  // See mit Insel, Moor mit Tümpel
  blob(8, 13, 6, 4, 'water');
  blob(8, 13, 1, 1, 'grass');
  box(16, 9, 8, 8, 'moor');
  blob(20, 13, 2, 2, 'bog');
  // Stadt: Pflaster, Platten, Dielen
  box(24, 9, 8, 8, 'cobble');
  box(27, 11, 3, 3, 'flags');
  box(32, 9, 8, 8, 'plank');
  // Zeile 3: Kies, Asche, Aschengrund mit Lava, Dungeonböden
  box(0, 18, 8, 8, 'gravel');
  box(8, 18, 8, 8, 'ash');
  box(16, 18, 8, 8, 'ash_red');
  blob(19, 22, 2, 2, 'lava');
  const dun = ['dun', 'dun_gruft', 'dun_kata', 'dun_mine', 'dun_thron', 'dun_goblin', 'dun_nest', 'dirt_camp'];
  dun.forEach((k, i) => box(24 + (i % 4) * 4, 18 + Math.floor(i / 4) * 4, 4, 4, k));
  return { gid, zone };
}

const clampXY = (x: number, y: number): number => Math.max(0, Math.min(PROBE_H - 1, y)) * PROBE_W + Math.max(0, Math.min(PROBE_W - 1, x));

function landDist(mat: (x: number, y: number) => number, x: number, y: number): number {
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (MATS[mat(x + dx, y + dy)]!.kind !== 'water') return r;
      }
    }
  }
  return 6;
}

/** Probeboden wie im Spiel: Boden, dann Details je Kachel */
export function probeGround(): Raster {
  const { gid, zone } = probeMap();
  const mat = (x: number, y: number): number => matOf(gid[clampXY(x, y)]!, zone[clampXY(x, y)]!);
  const r = new Raster(PROBE_W * ART, PROBE_H * ART);
  const t0 = performance.now();
  paintGround(r, 0, 0, PROBE_W, PROBE_H, { mat, waterDist: (x, y) => landDist(mat, x, y) });
  for (let y = 0; y < PROBE_H; y++) {
    for (let x = 0; x < PROBE_W; x++) {
      const g = gid[y * PROBE_W + x]!;
      const z = zone[y * PROBE_W + x]!;
      if (g === 6) stampWaterDetail(r, x, y, z, landDist(mat, x, y), x * ART, y * ART);
      else stampDetail(r, x, y, g, z, x * ART, y * ART);
    }
  }
  const ms = performance.now() - t0;
  console.log(`Boden ${PROBE_W}x${PROBE_H} Kacheln in ${ms.toFixed(1)} ms`);
  return r;
}

if (!only || only === 'boden') {
  const r = probeGround();
  save('boden.png', r, 2);
  // Ausschnitte 4x: Wiese/Weg, See, Stadt
  const crop = (x0: number, y0: number, w: number, h: number): Raster => {
    const c = new Raster(w * ART, h * ART);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) c.d[y * c.w + x] = r.d[(y0 * ART + y) * r.w + x0 * ART + x]!;
    return c;
  };
  save('boden-weg.png', crop(4, 1, 12, 7), 4);
  save('boden-see.png', crop(1, 8, 14, 10), 4);
  save('boden-stadt.png', crop(22, 8, 16, 9), 4);
  save('boden-asche.png', crop(6, 17, 18, 9), 4);
}
