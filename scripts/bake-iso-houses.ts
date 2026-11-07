// Kontaktbogen der Iso-Häuser (P9.3): jede Türseite (S, E, N, W) bei Tag, bei Nacht und mit ausgeblendetem Dach/Vorderwänden.
//   npx tsx scripts/bake-iso-houses.ts [Ausgabeordner]
// Standard: probe/iso/haeuser.png. Die Teile kommen aus isoHouses.ts, wie sie GameScene ablegt (ohne Spaltenschnitt).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, abgr, bytes, mix, rgbOf, upscale } from '../src/render/world/raster';
import { isoHouseParts } from '../src/render/isoHouses';
import type { House } from '../src/render/houses';
import type { DoorIcon } from '../src/render/town';
// @ts-expect-error reines JS-Hilfsmodul aus dem pixelfx-Klon (nur Skript, nicht im Spiel)
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'probe', 'iso'));
mkdirSync(OUT, { recursive: true });

const doors: { side: House['door'] extends infer D ? (D extends { side: infer S } ? S : never) : never; x: number; y: number; icon: DoorIcon }[] = [
  { side: 'S', x: 4, y: 5, icon: 'anchor' },
  { side: 'E', x: 7, y: 2, icon: 'book' },
  { side: 'N', x: 3, y: 0, icon: 'coins' },
  { side: 'W', x: 0, y: 3, icon: 'sword' },
];
const house = (variant: number, d: (typeof doors)[number]): House => ({ x0: 0, y0: 0, w: 8, h: 6, variant, door: d });

/** Teile eines Hauses auf einen Boden legen; `night`: Licht additiv, `fade`: Dach und Vorderwände durchsichtig */
function compose(hs: House, night: boolean, fade: boolean, bg: number): Raster {
  const parts = isoHouseParts(hs);
  const rs = parts.map((p) => ({ p, r: p.make() }));
  const x0 = Math.min(...parts.map((p) => p.sx));
  const y0 = Math.min(...parts.map((p) => p.sy));
  const w = Math.max(...rs.map(({ p, r }) => (p.sx - x0) / 2 + r.w));
  const h = Math.max(...rs.map(({ p, r }) => (p.sy - y0) / 2 + r.h));
  const out = new Raster(w, h);
  out.rect(0, 0, w, h, bg);
  for (const { p, r } of rs) {
    const ox = (p.sx - x0) / 2;
    const oy = (p.sy - y0) / 2;
    const a = p.fade === 'roof' || p.fade === 'walls' ? (fade ? 0.2 : 1) : 1;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const px = r.d[y * r.w + x]!;
        const al = px >>> 24;
        if (!al) continue;
        const base = out.get(ox + x, oy + y);
        if (p.light) {
          if (!night) continue;
          const c = rgbOf(px);
          const b = rgbOf(base);
          const k = al / 255;
          out.set(ox + x, oy + y, (Math.min(255, ((b >> 16) & 255) + ((c >> 16) & 255) * k) << 16) | (Math.min(255, ((b >> 8) & 255) + ((c >> 8) & 255) * k) << 8) | Math.min(255, (b & 255) + (c & 255) * k));
        } else out.set(ox + x, oy + y, mix(rgbOf(base), rgbOf(px), a));
      }
    }
  }
  return out;
}

const cells: Raster[] = [];
doors.forEach((d, i) => {
  cells.push(compose(house(i, d), false, false, 0x2a2a2e), compose(house(i, d), true, false, 0x16161c), compose(house(i, d), true, true, 0x16161c));
});
const cw = Math.max(...cells.map((c) => c.w)) + 4;
const ch = Math.max(...cells.map((c) => c.h)) + 4;
const sheet = new Raster(cw * 3, ch * doors.length);
cells.forEach((c, i) => {
  const ox = (i % 3) * cw + 2;
  const oy = Math.floor(i / 3) * ch + 2;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) sheet.d[(oy + y) * sheet.w + ox + x] = c.d[y * c.w + x]!;
});
const big = upscale(sheet, 2);
void abgr;
writeFileSync(join(OUT, 'haeuser.png'), encodePNG(big.w, big.h, bytes(big)));
console.log(`haeuser.png ${big.w}x${big.h} in ${OUT}`);
