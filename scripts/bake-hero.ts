// Kontaktbögen des Skelett-Helden (gleicher Code wie im Spiel: src/render/hero.ts), zum Ansehen beim Verfeinern.
//   npx tsx scripts/bake-hero.ts [armor helm gloves weapon]   z. B. npx tsx scripts/bake-hero.ts 2 2 2 sword
//   Optionen: --cols 0,4,12 (nur diese Spalten), --k 8 (Maßstab)
// Ausgabe nach public/probe/held/ (ignoriert): contact-<look>.png, 4x, Zeilen = Seite, zur Kamera, weg; Spalten = Stehen, Gehen, Angriff.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeHero, heroKey, HERO_FRAME, type HeroLook, type HeroWeapon } from '../src/render/hero';
// @ts-expect-error reines JS-Hilfsmodul aus dem pixelfx-Klon (nur Skript, nicht im Spiel)
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'probe', 'held');
mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv.splice(i, 2)[1] : undefined;
};
const pick = opt('--cols')?.split(',').map(Number);
const K = +(opt('--k') ?? 4);
const a = argv;
const looks: HeroLook[] = a.length
  ? [{ armor: +a[0]!, helm: +(a[1] ?? 0), gloves: +(a[2] ?? 0), weapon: (a[3] ?? 'sword') as HeroWeapon }]
  : [
      { armor: 0, helm: 0, gloves: 0, weapon: 'none' },
      { armor: 1, helm: 1, gloves: 1, weapon: 'sword' },
      { armor: 2, helm: 2, gloves: 2, weapon: 'sword' },
      { armor: 1, helm: 0, gloves: 0, weapon: 'bow' },
      { armor: 0, helm: 0, gloves: 0, weapon: 'staff' },
    ];

const G = 4;
for (const look of looks) {
  const t = performance.now();
  const s = bakeHero(look);
  const ms = performance.now() - t;
  const all = Array.from({ length: s.w / HERO_FRAME.w }, (_, i) => i);
  const sel = pick ?? all;
  const cols = sel.length;
  const rows = s.h / HERO_FRAME.h;
  const CW = cols * (HERO_FRAME.w * K + G);
  const CH = rows * (HERO_FRAME.h * K + G);
  const px = new Uint8Array(CW * CH * 4);
  for (let i = 0; i < CW * CH; i++) px.set([38, 34, 42, 255], i * 4);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    // Fußlinie als Orientierung
    for (let x = 0; x < HERO_FRAME.w * K; x++) px.set([60, 54, 66, 255], ((r * (HERO_FRAME.h * K + G) + HERO_FRAME.fy * K + 1) * CW + c * (HERO_FRAME.w * K + G) + x) * 4);
    for (let y = 0; y < HERO_FRAME.h; y++) for (let x = 0; x < HERO_FRAME.w; x++) {
      const o = ((r * HERO_FRAME.h + y) * s.w + sel[c]! * HERO_FRAME.w + x) * 4;
      if (!s.data[o + 3]) continue;
      for (let j = 0; j < K * K; j++) {
        const yy = r * (HERO_FRAME.h * K + G) + y * K + Math.floor(j / K);
        const xx = c * (HERO_FRAME.w * K + G) + x * K + (j % K);
        px.set(s.data.subarray(o, o + 4), (yy * CW + xx) * 4);
      }
    }
  }
  const file = join(OUT, `contact-${heroKey(look)}${pick ? '-sel' : ''}.png`);
  writeFileSync(file, encodePNG(CW, CH, px));
  console.log(`${file}  ${ms.toFixed(0)} ms, Kopf ${s.top} px, Körper ${s.bodyW} px breit`);
}
