import { describe, expect, it } from 'vitest';
import { NINJA_GRADE, gradeRgb } from './ninja';

describe('Ninja-Abtönung', () => {
  it('dunkelt ab und nimmt Sättigung (Grün der Wiese wird gedeckter)', () => {
    const [r, g, b] = gradeRgb([60, 200, 60]);
    expect(g).toBeLessThan(200);
    expect(g - r).toBeLessThan(140 * NINJA_GRADE.sat + 1);
    expect(b).toBeGreaterThan(60);
  });

  it('Grau bleibt fast grau, nur dunkler', () => {
    const [r, g, b] = gradeRgb([200, 200, 200]);
    expect(g).toBeCloseTo(200 * NINJA_GRADE.lum, 0);
    expect(Math.abs(r - b)).toBeLessThan(25);
  });
});
