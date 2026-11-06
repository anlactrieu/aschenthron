import { describe, expect, it } from 'vitest';
import { threatOf } from './threat';

describe('Gefahrenfarbe nach Stufenabstand (P4)', () => {
  it('Stufen grau bis rot', () => {
    const t = (d: number, x: object = {}) => threatOf(10, { level: 10 + d, ...x });
    expect([-9, -5, -4, 0, 1, 2, 3, 4, 5, 12].map((d) => t(d))).toEqual(['grau', 'grau', 'weiss', 'weiss', 'gelb', 'gelb', 'orange', 'orange', 'rot', 'rot']);
  });
  it('Champion +1, Boss und Unikat +3', () => {
    expect(threatOf(10, { level: 10, champ: 'fiery' })).toBe('gelb');
    expect(threatOf(10, { level: 10, boss: true })).toBe('orange');
    expect(threatOf(10, { level: 10, unique: 'x' })).toBe('orange');
    expect(threatOf(10, { level: 12, boss: true })).toBe('rot');
  });
});
