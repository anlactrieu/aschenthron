import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { DANGER_OFFSETS, DANGER_SPOTS, monsterKind } from './data';
import { inSafeZone, regionAt } from './world';
import { isWalkable } from './path';

describe('Gefahrenorte (P4)', () => {
  const { world: w } = buildWorld(1, mapJson as unknown as TiledMap);
  it('stehen begehbar, außerhalb von Städten, in der genannten Zone', () => {
    expect(DANGER_SPOTS.length).toBeGreaterThanOrEqual(2);
    for (const d of DANGER_SPOTS) {
      expect(regionAt(w, d.x, d.y)?.name, d.id).toBe(d.zone);
      for (const [dx, dy] of DANGER_OFFSETS) {
        expect(isWalkable(w.grid, d.x + dx, d.y + dy), d.id).toBe(true);
        expect(inSafeZone(w, d.x + dx, d.y + dy), d.id).toBe(false);
      }
    }
  });
  it('sind deutlich stärker als die Zone und zu früh erreichbar', () => {
    for (const [i, d] of DANGER_SPOTS.entries()) {
      const hi = Number(regionAt(w, d.x, d.y)!.levels.split('-')[1]);
      const mons = w.actors.filter((a) => a.kind === 'monster' && a.packId === 200001 + i);
      expect(mons).toHaveLength(d.kinds.length);
      expect(Math.min(...d.kinds.map((k) => monsterKind(k).level)), d.id).toBeGreaterThan(hi - 3);
      expect(Math.max(...d.kinds.map((k) => monsterKind(k).level)), d.id).toBeGreaterThanOrEqual(hi + 3);
    }
  });
});
