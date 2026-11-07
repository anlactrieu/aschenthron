// Kontaktbögen der Iso-Figuren (5 Ansichten, gleicher Code wie im Spiel: figure.ts, hero.ts, monster.ts, npc.ts) und Backzeit.
//   npx tsx scripts/bake-iso-figures.ts [monster|npc|held|zeit|alle] [--k 2] [--ids rat,wolf] [--out probe/iso/figuren]
// Ausgabe nach probe/iso/figuren/ (nicht committen):
//   monster-<n>.png   je Art ein Block, Spalten = 5 Ansichten (Seite, vorn, hinten, schräg vorn, schräg hinten), Zeilen = Stehen,
//                     Gehen, Angriff (Schlagbild), letztes Sterbebild; Blick nach rechts (links ist nur gespiegelt)
//   npc.png           alle Rollen, Spalten = 5 Ansichten, Zeilen = Stehen, Gehen
//   held-<waffe>.png  der Held mit jeder Waffenart, Zeilen = Stehen, Gehen, Angriff, letztes Sterbebild
//   zeit              Backzeit Held und 10 Arten mit 3 gegen 5 Ansichten, Speicher des Sheets
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeFigure, FIG_ANIMS, figViews, type FigAnim, type FigureSheet, type FigView } from '../src/render/figure';
import { heroSpec, type HeroLook, type HeroWeapon } from '../src/render/hero';
import { MONSTER_DEFS, monsterSpec } from '../src/render/monster';
import { NPC_FIG_NAMES, npcSpec, RESIDENT_KINDS } from '../src/render/npc';
// @ts-expect-error reines JS-Hilfsmodul aus dem pixelfx-Klon (nur Skript, nicht im Spiel)
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv.splice(i, 2)[1] : undefined;
};
const K = +(opt('--k') ?? 2);
const only = opt('--ids')?.split(',');
const OUT = join(ROOT, opt('--out') ?? 'probe/iso/figuren');
const what = argv[0] ?? 'alle';

const ISO_VIEWS = figViews(true);
const GRADE = [0.66, 0.64, 0.74];
const GROUNDS = [[86, 78, 92], [58, 74, 46]];

/** Eine Leinwand, auf die Sheet-Bilder gestempelt werden */
class Canvas {
  px: Uint8Array;
  constructor(public w: number, public h: number) {
    this.px = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) this.px.set([20, 18, 22, 255], i * 4);
  }
  rect(x: number, y: number, w: number, h: number, c: number[]): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h) this.px.set([...c, 255], (yy * this.w + xx) * 4);
  }
  /** Bild `name` des Sheets in die Zelle (x, y, w, h) setzen, Fußpunkt unten mittig */
  cell(s: FigureSheet, name: string, x: number, y: number, w: number, h: number, shade: number): void {
    const bg = GROUNDS[shade % 2]!.map((v, j) => Math.round(v * GRADE[j]!));
    this.rect(x, y, w, h, bg);
    const f = s.frames[name];
    if (!f) return;
    const F = s.frame;
    const ox = x + Math.round((w - F.w * K) / 2);
    const oy = y + h - 4 * K - F.fy * K;
    for (let yy = 0; yy < F.h; yy++) for (let xx = 0; xx < F.w; xx++) {
      const o = ((f.y + yy) * s.w + f.x + xx) * 4;
      if (!s.data[o + 3]) continue;
      const col = [0, 1, 2].map((j) => Math.round(s.data[o + j]! * GRADE[j]!));
      for (let j = 0; j < K * K; j++) {
        const X = ox + xx * K + (j % K);
        const Y = oy + yy * K + Math.floor(j / K);
        if (X >= x && Y >= y && X < x + w && Y < y + h) this.px.set([...col, 255], (Y * this.w + X) * 4);
      }
    }
  }
  save(rel: string): string {
    const file = join(OUT, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, encodePNG(this.w, this.h, this.px));
    return file;
  }
}

const last = (s: FigureSheet, a: FigAnim): number => s.anims[a] - 1;
/** Zeilen eines Blocks: Stehen, Gehen (Mitte), Angriff (Schlagbild), Sterben (letztes Bild) */
const ROWS: { anim: FigAnim; i: (s: FigureSheet) => number }[] = [
  { anim: 'idle', i: () => 0 },
  { anim: 'walk', i: (s) => Math.min(2, s.anims.walk - 1) },
  { anim: 'attack', i: (s) => Math.min(2, last(s, 'attack')) },
  { anim: 'die', i: (s) => last(s, 'die') },
];

/** Block einer Figur: Spalten = Ansichten, Zeilen = Animationen; `rows` auf die vorhandenen beschränkt */
function block(c: Canvas, s: FigureSheet, x0: number, y0: number, cw: number, ch: number, rows = ROWS): void {
  rows.forEach((r, ri) => {
    if (!s.anims[r.anim]) return;
    ISO_VIEWS.forEach((v, vi) => c.cell(s, `${r.anim}_${v}_${r.i(s)}`, x0 + vi * cw, y0 + ri * ch, cw, ch, ri + vi));
  });
}

const sheetOf = (spec: ReturnType<typeof monsterSpec>): FigureSheet => bakeFigure(spec!, ISO_VIEWS);

function monsters(): void {
  const ids = (only ?? Object.keys(MONSTER_DEFS)).filter((id) => MONSTER_DEFS[id]);
  const PER = 12;
  const COLS = 3;
  for (let p = 0; p * PER < ids.length; p++) {
    const group = ids.slice(p * PER, (p + 1) * PER);
    const sheets = group.map((id) => sheetOf(monsterSpec(id)));
    const cw = Math.max(...sheets.map((s) => s.frame.w)) * K;
    const ch = Math.max(...sheets.map((s) => s.frame.h)) * K;
    const bw = cw * ISO_VIEWS.length + 8;
    const bh = ch * ROWS.length + 8;
    const rows = Math.ceil(group.length / COLS);
    const c = new Canvas(COLS * bw, rows * bh);
    sheets.forEach((s, n) => block(c, s, (n % COLS) * bw, Math.floor(n / COLS) * bh, cw, ch));
    console.log(c.save(`monster-${p + 1}.png`).replace(ROOT + '/', ''), group.join(' '));
  }
}

function npcs(): void {
  const specs = [...NPC_FIG_NAMES.map((n) => npcSpec('trainer', n)), ...RESIDENT_KINDS.map((k) => npcSpec(k))];
  const sheets = specs.map((sp) => sheetOf(sp));
  const rows = [ROWS[0]!, ROWS[1]!];
  const cw = Math.max(...sheets.map((s) => s.frame.w)) * K;
  const ch = Math.max(...sheets.map((s) => s.frame.h)) * K;
  const COLS = 3;
  const bw = cw * ISO_VIEWS.length + 8;
  const bh = ch * rows.length + 8;
  const c = new Canvas(COLS * bw, Math.ceil(sheets.length / COLS) * bh);
  sheets.forEach((s, n) => block(c, s, (n % COLS) * bw, Math.floor(n / COLS) * bh, cw, ch, rows));
  console.log(c.save('npc.png').replace(ROOT + '/', ''), `${sheets.length} Rollen`);
}

const BASE: HeroLook = { armor: 'cloth', robe: false, helm: 0, helmMat: 'iron', gloves: 0, legs: 0, weapon: 'sword', weaponTier: 0, shield: 0, cloak: '', quiver: false, rar: [0, 0, 0] };
/** Held mit jeder Waffenart; Ausrüstung wechselt mit (Schild, Umhang, Köcher, Robe) */
const HEROES: Record<string, Partial<HeroLook>> = {
  schwert: { armor: 'iron', helm: 2, gloves: 2, legs: 2, shield: 2, cloak: 'wool', weapon: 'sword', rar: [2, 1, 2] },
  dolch: { armor: 'leather', helm: 1, helmMat: 'leather', gloves: 1, legs: 1, weapon: 'dagger', cloak: 'hunter' },
  axt: { armor: 'iron', helm: 2, gloves: 1, weapon: 'axe', shield: 1 },
  streitkolben: { armor: 'iron', helm: 3, weapon: 'mace', shield: 3, cloak: 'ash' },
  zweihand: { armor: 'dread', helm: 3, helmMat: 'dread', gloves: 2, legs: 2, weapon: 'greatsword', cloak: 'dread', rar: [4, 4, 4] },
  zweihandaxt: { armor: 'ash', helm: 4, helmMat: 'ash', gloves: 2, legs: 2, weapon: 'axe', twoHand: true, rar: [3, 3, 3] },
  bogen: { armor: 'leather', helm: 5, helmMat: 'cloth', gloves: 1, legs: 1, weapon: 'bow', quiver: true, cloak: 'hunter' },
  stab: { armor: 'acolyte', robe: true, helm: 5, helmMat: 'cloth', weapon: 'staff', weaponTier: 2, cloak: 'dread', rar: [0, 2, 1] },
  unbewaffnet: { weapon: 'none' as HeroWeapon },
};

function heroes(): void {
  const names = Object.keys(HEROES).filter((n) => !only || only.includes(n));
  const sheets = names.map((n) => {
    const spec = heroSpec({ ...BASE, ...HEROES[n] });
    return sheetOf(spec);
  });
  const cw = sheets[0]!.frame.w * K;
  const ch = sheets[0]!.frame.h * K;
  const bw = cw * ISO_VIEWS.length + 8;
  const bh = ch * ROWS.length + 8;
  const COLS = 3;
  const c = new Canvas(COLS * bw, Math.ceil(sheets.length / COLS) * bh);
  sheets.forEach((s, n) => block(c, s, (n % COLS) * bw, Math.floor(n / COLS) * bh, cw, ch));
  console.log(c.save(only ? 'held-sel.png' : 'held.png').replace(ROOT + '/', ''), names.join(' '));
}

/** Backzeit und Speicher: Held und 10 Arten, 3 gegen 5 Ansichten (Median aus 3 Läufen, in Node, ohne Worker) */
function timing(): void {
  const med = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1]!;
  const list: [string, ReturnType<typeof monsterSpec>][] = [
    ['Held', heroSpec({ ...BASE, ...HEROES.schwert })],
    ...['field_rat', 'wolf', 'goblin', 'skeleton', 'bog_ghoul', 'forest_spider', 'pit_worm', 'hill_troll', 'stone_golem', 'cinder_wisp', 'ash_king'].filter((id) => MONSTER_DEFS[id]).map((id): [string, ReturnType<typeof monsterSpec>] => [id, monsterSpec(id)]),
  ];
  let t3 = 0;
  let t5 = 0;
  let m3 = 0;
  let m5 = 0;
  console.log('Figur'.padEnd(14), '3 Ansichten'.padEnd(18), '5 Ansichten'.padEnd(18), 'Zeit', 'Speicher');
  for (const [name, spec] of list) {
    const run = (v: FigView[]): { ms: number; bytes: number } => {
      const ts = [0, 1, 2].map(() => {
        const t = performance.now();
        const s = bakeFigure(spec!, v);
        void s;
        return performance.now() - t;
      });
      const s = bakeFigure(spec!, v);
      return { ms: med(ts), bytes: s.data.byteLength };
    };
    const a = run(figViews(false));
    const b = run(ISO_VIEWS);
    t3 += a.ms;
    t5 += b.ms;
    m3 += a.bytes;
    m5 += b.bytes;
    console.log(name.padEnd(14), `${a.ms.toFixed(0)} ms ${(a.bytes / 1e6).toFixed(2)} MB`.padEnd(18), `${b.ms.toFixed(0)} ms ${(b.bytes / 1e6).toFixed(2)} MB`.padEnd(18), `+${((b.ms / a.ms - 1) * 100).toFixed(0)} %`, `+${((b.bytes / a.bytes - 1) * 100).toFixed(0)} %`);
  }
  console.log('Summe'.padEnd(14), `${t3.toFixed(0)} ms ${(m3 / 1e6).toFixed(1)} MB`.padEnd(18), `${t5.toFixed(0)} ms ${(m5 / 1e6).toFixed(1)} MB`.padEnd(18), `+${((t5 / t3 - 1) * 100).toFixed(0)} %`, `+${((m5 / m3 - 1) * 100).toFixed(0)} %`);
  void FIG_ANIMS;
}

if (what === 'monster' || what === 'alle') monsters();
if (what === 'npc' || what === 'alle') npcs();
if (what === 'held' || what === 'alle') heroes();
if (what === 'zeit') timing();
