import { describe, expect, it } from 'vitest';
import { greeting, phaseOf, tierOf } from './talk';
import { isNightHour } from '../sim/clock';

describe('P2 Gruß', () => {
  const p = (level: number, turned = 0, titles: string[] = []) => ({
    level,
    quests: Object.fromEntries(Array.from({ length: turned }, (_, i) => [`x${i}`, { state: 'turned' as const, progress: 1 }])),
    titles,
  });
  it('Tageszeit und Bekanntheit ändern den Gruß', () => {
    expect([phaseOf(12), phaseOf(20), phaseOf(2)]).toEqual(['day', 'dusk', 'night']);
    expect(tierOf(p(1))).toBe('fremd');
    expect(tierOf(p(8))).toBe('bekannt');
    expect(tierOf(p(3, 3))).toBe('bekannt');
    expect(tierOf(p(25))).toBe('beruehmt');
    const all = new Set([greeting(p(1), 12), greeting(p(1), 20), greeting(p(1), 2), greeting(p(8), 12), greeting(p(25), 12), greeting(p(25), 2)]);
    expect(all.size).toBe(6);
  });
  it('Phase Nacht deckt sich mit der Nacht der Sim (Läden zu, Nachtgänger)', () => {
    for (let h = 0; h < 24; h += 0.25) expect(phaseOf(h) === 'night', `${h}`).toBe(isNightHour(h));
  });
});
