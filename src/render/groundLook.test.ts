import { describe, expect, it } from 'vitest';
import { buildZoneMap, Z } from './groundLook';

const region = (name: string, x: number, y: number, w: number, h: number) => ({ name, x, y, w, h });

describe('Zonenkarte', () => {
  const regs = [region('Roggenfelder', 0, 40, 100, 60), region('Düsterwald', 0, 0, 100, 40), region('Katakomben', 100, 0, 20, 100)];
  const m = buildZoneMap(regs, 120, 100);

  it('Grenze zwischen zwei Wiesenzonen verläuft nicht gerade, bleibt aber in der Nähe', () => {
    // erste Farm-Zeile je Spalte: Rechtecke ergäben überall 40
    const edges: number[] = [];
    for (let x = 0; x < 100; x++) {
      let y = 0;
      while (y < 100 && m[y * 120 + x] !== Z.farm) y++;
      edges.push(y);
    }
    expect(new Set(edges).size).toBeGreaterThan(5);
    for (const e of edges) expect(Math.abs(e - 40)).toBeLessThanOrEqual(20);
  });

  it('Dungeons bleiben rechteckig, im Freiland gibt es nur Freilandzonen', () => {
    for (let y = 0; y < 100; y++) for (let x = 100; x < 120; x++) expect(m[y * 120 + x]).toBe(Z.kata);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) expect([Z.farm, Z.forest]).toContain(m[y * 120 + x]);
  });

  it('ist deterministisch', () => {
    expect(buildZoneMap(regs, 120, 100)).toEqual(m);
  });
});
