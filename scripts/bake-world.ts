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
import { barrel, boat, crates, fence, flowerBox, glow, grave, lantern, pillar, post, rock, ship, stall, tree, wallTile, well, type TreeStyle, type WallStyle } from '../src/render/world/props';
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

/* ------------------------------------------------ Props auf Wiese: Bäume, Felsen, Gräber, Stadt, Wände */

if (!only || only === 'props') {
  const TW = 30;
  const TH = 16;
  const mat = (x: number, y: number): number => matOf(y >= 11 && x >= 18 ? 5 : y >= 11 ? 9 : 4, y >= 11 && x >= 18 ? Z.kata : y >= 11 ? Z.ash : x > 14 ? Z.forest : Z.farm);
  const r = new Raster(TW * ART, TH * ART);
  paintGround(r, 0, 0, TW, TH, { mat, waterDist: () => 3 });
  /** Prop mit Fußpunkt unten mittig auf die Kachel (tx, ty) stellen */
  const stand = (img: Raster, tx: number, ty: number, lift = 2): void => r.blit(img, Math.round(tx * ART + ART / 2 - img.w / 2), (ty + 1) * ART - img.h + lift);
  const styles: TreeStyle[] = ['oak', 'oakr', 'big', 'pink', 'pine', 'dead', 'char'];
  styles.forEach((st, i) => { for (let v = 0; v < 3; v++) stand(tree(st, v), 1 + i * 4 + v, v % 2 ? 4 : 3); });
  (['grey', 'dark', 'tan'] as const).forEach((st, i) => { for (let v = 0; v < 3; v++) stand(rock(st, v), 1 + i * 3 + v, 6); });
  for (let v = 0; v < 3; v++) stand(grave(v), 11 + v, 6);
  stand(pillar(), 15, 6);
  stand(barrel(), 1, 9);
  stand(crates(), 3, 9);
  stand(well(), 5, 9);
  stand(lantern(), 7, 9);
  const gl = glow(20, 0xffc060, 90);
  r.blit(gl, 7 * ART + 12 - 20, 9 * ART + 2 - 20 + 4);
  stand(stall(), 10, 9);
  stand(post(), 13, 9);
  stand(flowerBox(), 15, 9);
  stand(boat(), 18, 9);
  stand(ship(), 23, 9, 6);
  for (let x = 0; x < 4; x++) stand(fence(x), 26 + x, 9);
  // Wände: je Stil ein kleines Rechteck (5x3) mit offener Südseite
  const styles2: [WallStyle, number][] = [['cliff', 1], ['brick', 9], ['dungeon', 19]];
  for (const [st, x0] of styles2) {
    const isWall = (x: number, y: number): boolean => x >= x0 && x < x0 + 5 && y >= 11 && y < 14;
    for (let y = 11; y < 14; y++) {
      for (let x = x0; x < x0 + 5; x++) {
        const open = (isWall(x, y - 1) ? 0 : 1) | (isWall(x + 1, y) ? 0 : 2) | (isWall(x, y + 1) ? 0 : 4) | (isWall(x - 1, y) ? 0 : 8);
        r.blit(wallTile(st, open, x, y), x * ART, y * ART);
      }
    }
  }
  save('props.png', r, 2);
  const crop = (x0: number, y0: number, w: number, h: number): Raster => {
    const c = new Raster(w * ART, h * ART);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) c.d[y * c.w + x] = r.d[(y0 * ART + y) * r.w + x0 * ART + x]!;
    return c;
  };
  save('props-baeume.png', crop(0, 0, 16, 5), 3);
  save('props-stadt.png', crop(0, 5, 30, 5), 2);
  save('props-waende.png', crop(0, 10, 25, 5), 3);
}

/* ------------------------------------------------ Häuser: alle Varianten mit Tür, Fassade, Nachtlicht */

if (!only || only === 'haus') {
  const { houseRoofRaster, houseFacadeRaster, houseWallRaster, houseDoorRaster, houseGlowRaster, lowerKind } = await import('../src/render/houses');
  const TW = 36;
  const TH = 9;
  const r = new Raster(TW * ART, TH * ART);
  paintGround(r, 0, 0, TW, TH, { mat: (x, y) => matOf(y >= 7 ? 16 : 16, Z.none), waterDist: () => 3 });
  const night = new Raster(r.w, r.h);
  for (let v = 0; v < 5; v++) {
    const w = 6 + (v % 2);
    const h = 5;
    const x0 = 1 + v * 7;
    const y0 = 2;
    const hs = { x0, y0, w, h, variant: v, door: { x: x0 + 2, y: y0 + h - 1, icon: (['anchor', 'book', 'coins', 'anvil', 'sword'] as const)[v], side: 'S' as const } };
    r.blit(houseRoofRaster(w, h - 1, v, v * 7), x0 * ART, (y0 - 1) * ART);
    r.blit(houseFacadeRaster(w, v, v * 7), x0 * ART, (y0 + h - 2) * ART);
    for (let rel = 0; rel < w; rel++) {
      const t = rel === 2 ? houseDoorRaster(hs.door.icon, v, true, v) : houseWallRaster('lower', lowerKind(rel, w), v, v + rel);
      r.blit(t, (x0 + rel) * ART, (y0 + h) * ART - t.h);
    }
    night.blit(houseGlowRaster(hs), x0 * ART, (y0 + h - 2) * ART);
  }
  save('haus.png', r, 2);
  // Nacht: dunkel multipliziert, Licht additiv
  const n = new Raster(r.w, r.h);
  for (let i = 0; i < r.d.length; i++) {
    const p = r.d[i]!;
    const q = night.d[i]!;
    const a = (q >>> 24) / 255;
    const ch = (s: number, k: number): number => Math.min(255, Math.round(((p >> s) & 255) * k + ((q >> s) & 255) * a * 0.8));
    n.d[i] = ((255 << 24) | (ch(16, 0.5) << 16) | (ch(8, 0.42) << 8) | ch(0, 0.36)) >>> 0;
  }
  save('haus-nacht.png', n, 2);
}
