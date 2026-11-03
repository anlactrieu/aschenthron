// Kontaktbogen eines Figuren-Sheets (src/render/figure.ts) als PNG nach public/probe/<pfad> (ignoriert).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FigureSheet } from '../src/render/figure';
// @ts-expect-error reines JS-Hilfsmodul aus dem pixelfx-Klon (nur Skript, nicht im Spiel)
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Spielboden zum Vergleich: dunkles Pflaster und Gras, wie im Spiel mit DARK_GRADE multipliziert */
const GRADE = [0.66, 0.64, 0.74];
const GROUNDS = [[86, 78, 92], [58, 74, 46]];

export function writeContact(rel: string, s: FigureSheet, o: { cols?: number[]; k?: number; ground?: boolean } = {}): string {
  const F = s.frame;
  const K = o.k ?? 4;
  const G = 4;
  const all = Array.from({ length: s.w / F.w }, (_, i) => i);
  const sel = o.cols ?? all;
  const cols = sel.length;
  const rows = s.h / F.h;
  const CW = cols * (F.w * K + G);
  const CH = rows * (F.h * K + G);
  const px = new Uint8Array(CW * CH * 4);
  const grade = (c: number[]): number[] => (o.ground ? c.map((v, j) => Math.round(v * GRADE[j]!)) : c);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const bg = o.ground ? grade(GROUNDS[(r + c) % 2]!) : [38, 34, 42];
    for (let y = 0; y < F.h * K + G; y++) for (let x = 0; x < F.w * K + G; x++) {
      const yy = r * (F.h * K + G) + y;
      const xx = c * (F.w * K + G) + x;
      if (yy < CH && xx < CW) px.set([...(x >= F.w * K || y >= F.h * K ? [20, 18, 22] : bg), 255], (yy * CW + xx) * 4);
    }
    if (!o.ground) for (let x = 0; x < F.w * K; x++) px.set([60, 54, 66, 255], ((r * (F.h * K + G) + F.fy * K + 1) * CW + c * (F.w * K + G) + x) * 4);
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
      const o2 = ((r * F.h + y) * s.w + sel[c]! * F.w + x) * 4;
      if (!s.data[o2 + 3]) continue;
      const col = grade([s.data[o2]!, s.data[o2 + 1]!, s.data[o2 + 2]!]);
      for (let j = 0; j < K * K; j++) {
        const yy = r * (F.h * K + G) + y * K + Math.floor(j / K);
        const xx = c * (F.w * K + G) + x * K + (j % K);
        px.set([...col, 255], (yy * CW + xx) * 4);
      }
    }
  }
  const file = join(ROOT, 'public', 'probe', rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePNG(CW, CH, px));
  return file;
}
