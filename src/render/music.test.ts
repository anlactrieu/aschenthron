import { describe, expect, it } from 'vitest';
import { MOODS, parseTheme } from './music';

describe('Leitmotive', () => {
  for (const [name, def] of Object.entries(MOODS)) {
    it(`${name}: Takte à 4 Schläge, passend zur Akkordfolge`, () => {
      const bars = def.theme.split('|').map((b) => parseTheme(b).beats);
      for (const b of bars) expect(b).toBe(4);
      expect(bars.length % def.prog.length).toBe(0);
    });
    it(`${name}: Thema hat Noten in sinnvoller Lage`, () => {
      const { notes } = parseTheme(def.theme);
      expect(notes.length).toBeGreaterThan(6);
      for (const n of notes) {
        expect(n.degree).toBeGreaterThanOrEqual(0);
        expect(n.degree).toBeLessThan(14);
      }
    });
  }
});
