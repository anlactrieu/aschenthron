import { describe, expect, it } from 'vitest';
import { attackFrame, bakeHero, HERO_ANIMS, HERO_FRAME, HERO_VIEWS, HERO_WIND_FRAMES, heroKey, walkFrame, type HeroLook } from './hero';

const KNIGHT: HeroLook = { armor: 2, helm: 2, gloves: 2, weapon: 'sword' };

describe('Skelett-Held', () => {
  it('backt alle Bilder je Ansicht und Animation', () => {
    const s = bakeHero(KNIGHT);
    const n = HERO_ANIMS.idle + HERO_ANIMS.walk + HERO_ANIMS.attack;
    expect(Object.keys(s.frames)).toHaveLength(n * HERO_VIEWS.length);
    expect(s.w).toBe(n * HERO_FRAME.w);
    expect(s.h).toBe(HERO_VIEWS.length * HERO_FRAME.h);
  });

  it('steht auf dem Fußpunkt und ist gedrungen (ca. 30 px bei 1x)', () => {
    const s = bakeHero(KNIGHT);
    const { x, y } = s.frames.idle_side_0!;
    let lowest = -1;
    for (let yy = 0; yy < HERO_FRAME.h; yy++) for (let xx = 0; xx < HERO_FRAME.w; xx++) if (s.data[((y + yy) * s.w + x + xx) * 4 + 3]) lowest = yy;
    expect(Math.abs(lowest - HERO_FRAME.fy)).toBeLessThanOrEqual(1);
    expect(s.top).toBeGreaterThan(26);
    expect(s.top).toBeLessThan(36);
  });

  it('ist deterministisch und unterscheidet Rüstungsstufen', () => {
    expect(bakeHero(KNIGHT).data).toEqual(bakeHero(KNIGHT).data);
    const leather = bakeHero({ ...KNIGHT, armor: 1, helm: 1, gloves: 1 });
    expect(leather.data).not.toEqual(bakeHero(KNIGHT).data);
    expect(heroKey(KNIGHT)).not.toBe(heroKey({ ...KNIGHT, armor: 1 }));
  });

  it('Schlagbild beginnt genau bei 40 % des Hiebs', () => {
    expect(attackFrame(0)).toBe(0);
    expect(attackFrame(0.39)).toBe(HERO_WIND_FRAMES - 1);
    expect(attackFrame(0.4)).toBe(HERO_WIND_FRAMES);
    expect(attackFrame(0.999)).toBe(HERO_ANIMS.attack - 1);
  });

  it('Laufbild folgt der Strecke', () => {
    expect(walkFrame(0)).toBe(0);
    expect(walkFrame(-1)).toBe(HERO_ANIMS.walk - 1);
    expect(new Set(Array.from({ length: 64 }, (_, i) => walkFrame(i))).size).toBe(HERO_ANIMS.walk);
  });
});
