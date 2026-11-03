import { describe, expect, it } from 'vitest';
import type { Look } from './art';
import { attackFrame, cycleLength, FIG_ANIMS, FIG_VIEWS, walkFrame } from './figure';
import { bakeHero, HERO_ANIMS, HERO_CYCLE_PX, HERO_FRAME, HERO_STANCE, HERO_STRIDE, HERO_WIND_FRAMES, heroKey, heroLookOf, type HeroLook, type HeroWeapon } from './hero';

const sum = (d: Uint8ClampedArray): number => {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]!) | 0;
  return h;
};
const KNIGHT: HeroLook = { armor: 'iron', robe: false, helm: 2, helmMat: 'iron', gloves: 2, legs: 2, weapon: 'sword', weaponTier: 1, shield: 2, cloak: 'wool', quiver: false, rar: [2, 1, 2] };

describe('Skelett-Held', () => {
  it('backt alle Bilder je Ansicht und Animation', () => {
    const s = bakeHero(KNIGHT);
    const n = FIG_ANIMS.reduce((k, a) => k + HERO_ANIMS[a], 0);
    expect(Object.keys(s.frames)).toHaveLength(n * FIG_VIEWS.length);
    expect(s.w).toBe(n * HERO_FRAME.w);
    expect(s.h).toBe(FIG_VIEWS.length * HERO_FRAME.h);
  });

  it('steht auf dem Fußpunkt und ist gedrungen (ca. 30 px bei 1x)', () => {
    const s = bakeHero(KNIGHT);
    const { x, y } = s.frames.idle_side_0!;
    let lowest = -1;
    for (let yy = 0; yy < HERO_FRAME.h; yy++) for (let xx = 0; xx < HERO_FRAME.w; xx++) if (s.data[((y + yy) * s.w + x + xx) * 4 + 3]) lowest = yy;
    expect(Math.abs(lowest - HERO_FRAME.fy)).toBeLessThanOrEqual(1);
    expect(s.top).toBeGreaterThan(26);
    expect(s.top).toBeLessThan(38);
  });

  it('bleibt mit jeder Waffe und Ausrüstung im Bild', () => {
    const weapons: HeroWeapon[] = ['none', 'sword', 'axe', 'mace', 'dagger', 'greatsword', 'bow', 'staff'];
    for (const weapon of weapons) {
      const s = bakeHero({ ...KNIGHT, weapon, robe: weapon === 'staff', helm: weapon === 'bow' ? 5 : 4, quiver: weapon === 'bow', shield: weapon === 'greatsword' || weapon === 'bow' ? 0 : 3 });
      // ein paar Pixel unter dem Fußpunkt (liegende Figur) sind erlaubt, abgeschnittene Waffen oder Köpfe nicht
      expect(s.clipped, weapon).toBeLessThan(12);
    }
  }, 30000);

  it('ist deterministisch und unterscheidet Ausrüstung', () => {
    const a = sum(bakeHero(KNIGHT).data);
    expect(sum(bakeHero(KNIGHT).data)).toBe(a);
    expect(sum(bakeHero({ ...KNIGHT, armor: 'leather', helm: 1, gloves: 1 }).data)).not.toBe(a);
    expect(sum(bakeHero({ ...KNIGHT, shield: 0 }).data)).not.toBe(a);
    for (const d of [{ armor: 'leather' }, { shield: 0 }, { cloak: '' }, { rar: [0, 0, 0] }, { helm: 3 }, { quiver: true }, { robe: true }] as Partial<HeroLook>[]) {
      expect(heroKey({ ...KNIGHT, ...d })).not.toBe(heroKey(KNIGHT));
    }
  }, 20000);

  it('Schlagbild beginnt genau bei 40 % des Hiebs', () => {
    expect(attackFrame(0, HERO_ANIMS.attack, HERO_WIND_FRAMES)).toBe(0);
    expect(attackFrame(0.39, HERO_ANIMS.attack, HERO_WIND_FRAMES)).toBe(HERO_WIND_FRAMES - 1);
    expect(attackFrame(0.4, HERO_ANIMS.attack, HERO_WIND_FRAMES)).toBe(HERO_WIND_FRAMES);
    expect(attackFrame(0.999, HERO_ANIMS.attack, HERO_WIND_FRAMES)).toBe(HERO_ANIMS.attack - 1);
  });

  it('Laufbild folgt der Strecke, ein Zyklus passt zur Schrittweite (Füße gleiten nicht)', () => {
    const n = HERO_ANIMS.walk;
    expect(walkFrame(0, n, HERO_CYCLE_PX)).toBe(0);
    expect(walkFrame(-1, n, HERO_CYCLE_PX)).toBe(n - 1);
    expect(new Set(Array.from({ length: 64 }, (_, i) => walkFrame(i * (HERO_CYCLE_PX / 64), n, HERO_CYCLE_PX))).size).toBe(n);
    // Standbein: 2 * Schrittweite in `stance` des Zyklus, bei Pixelmaßstab 2
    expect(HERO_CYCLE_PX).toBeCloseTo(cycleLength(HERO_STRIDE, HERO_STANCE) * 2);
  });

  it('leitet Material, Helmform, Schild, Umhang und Seltenheit aus den Vorlagen ab', () => {
    const ids = { chest: '', legs: '', feet: '', hands: '', head: '', cloak: '', weapon: 'rusty_sword', offhand: '' };
    const look: Look = { chest: -1, head: -1, weapon: 0, hands: -1, weaponKind: 0, robe: false, quiver: false, shield: -1, rar: { head: 0, chest: 0, weapon: 0 }, ids };
    expect(heroLookOf(look)).toMatchObject({ armor: 'cloth', helm: 0, gloves: 0, weapon: 'sword', shield: 0, cloak: '' });
    const plate = heroLookOf({ ...look, chest: 1, head: 1, hands: 0, ids: { ...ids, chest: 'plate_cuirass', head: 'leather_cap', hands: 'iron_gauntlets' } });
    expect(plate).toMatchObject({ armor: 'iron', helm: 1, gloves: 2 });
    expect(heroLookOf({ ...look, weaponKind: 1 }).weapon).toBe('bow');
    expect(heroLookOf({ ...look, weapon: -1 }).weapon).toBe('none');
    expect(heroLookOf({ ...look, ids: { ...ids, weapon: 'battle_axe' } }).weapon).toBe('axe');
    expect(heroLookOf({ ...look, ids: { ...ids, weapon: 'claymore' } }).weapon).toBe('greatsword');
    expect(heroLookOf({ ...look, head: 3, ids: { ...ids, head: 'crown_helm' } }).helm).toBe(4);
    expect(heroLookOf({ ...look, shield: 1, ids: { ...ids, offhand: 'tower_shield' } }).shield).toBe(3);
    expect(heroLookOf({ ...look, robe: true, chest: 2, ids: { ...ids, chest: 'bone_robe', cloak: 'wolf_cloak' } })).toMatchObject({ armor: 'bone', robe: true, cloak: 'wolf' });
    expect(heroLookOf({ ...look, rar: { head: 4, chest: 2, weapon: 1 } }).rar).toEqual([4, 2, 1]);
  });
});
