import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bakeFigure, type FigureSheet } from './figure';
import { heroSpec, type HeroLook } from './hero';
import { MONSTER_DEFS, monsterSpec } from './monster';
import { NPC_FIG_NAMES, npcSpec, RESIDENT_KINDS } from './npc';

/**
 * Die Figuren-Sheets (5 Ansichten) dürfen sich nicht unbemerkt ändern: Hash aller Pixel je Figur gegen
 * `figureBaseline.json` (Stand P9.5). Neu erzeugen nur bewusst: `UPDATE_FIGURE_BASELINE=1 npx vitest run src/render/figureBaseline.test.ts`.
 */
const FILE = join(dirname(fileURLToPath(import.meta.url)), 'figureBaseline.json');

const BASE: HeroLook = { armor: 'cloth', robe: false, helm: 0, helmMat: 'iron', gloves: 0, legs: 0, weapon: 'sword', weaponTier: 0, shield: 0, cloak: '', quiver: false, rar: [0, 0, 0] };
const HEROES: Record<string, Partial<HeroLook>> = {
  ritter: { armor: 'iron', helm: 2, gloves: 2, legs: 2, shield: 2, cloak: 'wool', rar: [2, 1, 2] },
  topf: { armor: 'dread', helm: 3, helmMat: 'dread', gloves: 2, legs: 2, weapon: 'greatsword', cloak: 'dread', rar: [4, 4, 4] },
  jaeger: { armor: 'leather', helm: 5, helmMat: 'cloth', gloves: 1, legs: 1, weapon: 'bow', quiver: true, cloak: 'hunter' },
  magier: { armor: 'acolyte', robe: true, helm: 5, helmMat: 'cloth', weapon: 'staff', weaponTier: 2, cloak: 'dread', rar: [0, 2, 1] },
};

function hash(s: FigureSheet): string {
  let h = 2166136261;
  for (let i = 0; i < s.data.length; i++) h = Math.imul(h ^ s.data[i]!, 16777619) >>> 0;
  return `${s.w}x${s.h}:${h.toString(16)}`;
}

function current(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [n, o] of Object.entries(HEROES)) out[`hero:${n}`] = hash(bakeFigure(heroSpec({ ...BASE, ...o })));
  for (const id of Object.keys(MONSTER_DEFS)) out[`monster:${id}`] = hash(bakeFigure(monsterSpec(id)!));
  for (const n of NPC_FIG_NAMES) out[`npc:${n}`] = hash(bakeFigure(npcSpec('quest', n)!));
  for (const k of [...RESIDENT_KINDS, 'trainer', 'merchant', 'smith', 'quest']) out[`npc-kind:${k}`] = hash(bakeFigure(npcSpec(k)!));
  return out;
}

describe('Figuren-Sheets bleiben byte-gleich', () => {
  it('Pixel-Hash aller Helden, Monster und NPCs wie in der Baseline', () => {
    const now = current();
    if (process.env.UPDATE_FIGURE_BASELINE) writeFileSync(FILE, JSON.stringify(now, null, 1) + '\n');
    expect(now).toEqual(JSON.parse(readFileSync(FILE, 'utf8')));
  }, 60000);
});
