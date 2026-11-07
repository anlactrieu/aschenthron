import { describe, expect, it } from 'vitest';
import { bakeFigure, FIG_ANIMS, figViews, type FigureSpec } from './figure';
import { heroSpec, type HeroLook } from './hero';
import { MONSTER_DEFS, monsterSpec } from './monster';
import { NPC_FIG_NAMES, npcSpec, RESIDENT_KINDS } from './npc';

const ISO = figViews(true);
const HERO: HeroLook = { armor: 'iron', robe: false, helm: 2, helmMat: 'iron', gloves: 1, legs: 1, weapon: 'sword', weaponTier: 1, shield: 2, cloak: 'wool', quiver: false, rar: [1, 2, 2] };

/** Pixel des ersten Stehbildes jeder Ansicht (Grundlage von Schattenriss `silhouette`, `figTop`, `figW`) */
/** `clip`: Pixel außerhalb des Bildes, die schon in der Draufsicht so sind (Zweihänder, Sterben von der Seite: 6) */
function checkViews(name: string, spec: FigureSpec, clip = 0): void {
  const s = bakeFigure(spec, ISO);
  expect(s.views, name).toEqual(ISO);
  expect(s.h, name).toBe(spec.frame.h * 5);
  expect(s.clipped, name).toBeLessThanOrEqual(clip);
  expect(Object.keys(s.frames).length, name).toBe(5 * FIG_ANIMS.reduce((n, a) => n + spec.anims[a], 0));
  expect(s.top, name).toBeGreaterThan(6);
  expect(s.bodyW, name).toBeGreaterThan(3);
  for (const v of ISO) {
    // Schattenriss: das Stehbild jeder Ansicht hat Pixel, Kopf über dem Fuß und Breite
    const r = spec.render('idle', v, 0);
    expect(r.n, `${name} ${v}`).toBeGreaterThan(20);
    const f = s.frames[`idle_${v}_0`]!;
    let n = 0;
    let top = 0;
    let x0 = 1e9;
    let x1 = -1;
    for (let y = 0; y < spec.frame.h; y++) for (let x = 0; x < spec.frame.w; x++) {
      if (!s.data[((f.y + y) * s.w + f.x + x) * 4 + 3]) continue;
      n++;
      top = Math.max(top, spec.frame.fy - y);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
    expect(n, `${name} ${v} Pixel`).toBeGreaterThan(20);
    expect(top, `${name} ${v} Höhe`).toBeGreaterThan(4);
    expect(x1 - x0, `${name} ${v} Breite`).toBeGreaterThan(2);
  }
}

describe('Iso-Figuren mit 5 Ansichten', () => {
  it('Draufsicht 3 Ansichten, Iso 5 mit denselben ersten dreien', () => {
    expect(figViews(false)).toEqual(['side', 'front', 'back']);
    expect(ISO.slice(0, 3)).toEqual(figViews(false));
  });

  it('Held: alle Waffenarten haben 5 Ansichten, im Bild, mit Kopfhöhe und Breite', () => {
    const w = ['sword', 'axe', 'mace', 'dagger', 'greatsword', 'bow', 'staff', 'none'] as const;
    for (const weapon of w) checkViews(`hero ${weapon}`, heroSpec({ ...HERO, weapon, robe: weapon === 'staff', shield: weapon === 'bow' || weapon === 'greatsword' ? 0 : 2, quiver: weapon === 'bow' }), weapon === 'greatsword' ? 6 : 0);
    checkViews('hero twoHand', heroSpec({ ...HERO, weapon: 'axe', twoHand: true, shield: 0 }));
  }, 60000);

  it('alle Monsterarten backen in 5 Ansichten', () => {
    for (const id of Object.keys(MONSTER_DEFS)) checkViews(id, monsterSpec(id)!);
  }, 120000);

  it('alle NPC-Rollen backen in 5 Ansichten', () => {
    for (const n of NPC_FIG_NAMES) checkViews(n, npcSpec('quest', n)!);
    for (const k of RESIDENT_KINDS) checkViews(k, npcSpec(k)!);
  }, 60000);

  it('die ersten drei Zeilen des Iso-Sheets gleichen der Draufsicht (gleiche Pixel)', () => {
    const spec = heroSpec(HERO);
    const a = bakeFigure(spec);
    const b = bakeFigure(spec, ISO);
    expect(Buffer.from(b.data.buffer, 0, a.data.length).equals(Buffer.from(a.data.buffer))).toBe(true);
  });
});
