import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, loadMap, type TiledMap } from './tiled';
import { SHOPS, SKILLS } from './data';
import { TEMPLATES } from './items';
import { inSafeZone, regionAt } from './world';

const map = mapJson as unknown as TiledMap;
const { world: w } = buildWorld(1, map, { player: false });
const tiles = loadMap(map).tiles;
const tile = (x: number, y: number) => tiles[Math.round(y) * map.width + Math.round(x)];
const inTown = w.npcs.filter((n) => regionAt(w, n.x, n.y)?.name === 'Moosbrück');

describe('Moosbrück (dritte Stadt)', () => {
  it('ist Stadt, Sicherheitszone und Wiederbelebungspunkt, ohne Monster', () => {
    const r = w.regions.find((x) => x.name === 'Moosbrück')!;
    expect(r.levels).toBe('Stadt');
    expect(w.towns.length).toBe(3);
    expect(inSafeZone(w, r.x + r.w / 2, r.y + r.h / 2)).toBe(true);
    expect(w.actors.filter((a) => a.kind === 'monster' && a.x >= r.x && a.x < r.x + r.w && a.y >= r.y && a.y < r.y + r.h)).toHaveLength(0);
  });

  it('Lehrer, Händler, Schmied und Lager: je ein NPC, mit Lehrer der alle Fertigkeiten lehrt', () => {
    expect(inTown.map((n) => n.kind).sort()).toEqual(['merchant', 'smith', 'stash', 'trainer']);
    const trainer = inTown.find((n) => n.kind === 'trainer')!;
    // Stufe 1 wie in Aschenhafen: die zweite Lehrerstufe bleibt in Felsenwacht (Fortschritt über die Städte)
    expect(trainer.tier).toBe(1);
    expect(SKILLS.some((s) => s.tier === 1)).toBe(true);
    const shop = SHOPS[inTown.find((n) => n.kind === 'merchant')!.shop!]!;
    for (const id of shop) {
      const t = TEMPLATES.find((x) => x.id === id);
      expect(t, id).toBeDefined();
      expect(t!.minLevel, `${id} ist zu hoch für den Laden`).toBeLessThanOrEqual(11);
    }
    // Build-Stücke ab Stufe 16 gibt es in keinem Laden
    for (const ids of Object.values(SHOPS)) for (const id of ids) {
      const t = TEMPLATES.find((x) => x.id === id)!;
      if (t.hint) expect(t.minLevel, id).toBeLessThanOrEqual(11);
    }
  });

  it('jeder NPC steht in einem eigenen, umschlossenen Haus mit Tür zur Straße', () => {
    const wallDist = (x: number, y: number, dx: number, dy: number) => {
      for (let d = 1; d <= 8; d++) if (tile(x + dx * d, y + dy * d) === 2) return d;
      return 99;
    };
    for (const n of inTown) {
      expect(tile(n.x, n.y), n.name).toBe(1);
      // links und rechts Wand in Raumbreite, in der Senkrechten Rückwand und Tür/Wand gegenüber
      expect(wallDist(n.x, n.y, -1, 0), n.name).toBeLessThanOrEqual(4);
      expect(wallDist(n.x, n.y, 1, 0), n.name).toBeLessThanOrEqual(4);
      const up = wallDist(n.x, n.y, 0, -1);
      const down = wallDist(n.x, n.y, 0, 1);
      expect(Math.min(up, down), n.name).toBeLessThanOrEqual(3);
    }
    // keine zwei NPCs im selben Haus: Abstand größer als die Hausbreite oder -höhe
    for (let i = 0; i < inTown.length; i++) for (let j = i + 1; j < inTown.length; j++) {
      const a = inTown[i]!;
      const b = inTown[j]!;
      expect(Math.abs(a.x - b.x) >= 9 || Math.abs(a.y - b.y) >= 9, `${a.name}/${b.name}`).toBe(true);
    }
  });

  it('alle Stadt-NPCs sind vom Startpunkt aus zu erreichen (Brücke und Straße)', () => {
    const { grid } = loadMap(map);
    const seen = new Set<number>();
    const q = [Math.round(w.start.y) * grid.w + Math.round(w.start.x)];
    seen.add(q[0]!);
    while (q.length) {
      const c = q.pop()!;
      const x = c % grid.w;
      const y = Math.floor(c / grid.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const k = ny * grid.w + nx;
        if (nx >= 0 && ny >= 0 && nx < grid.w && ny < grid.h && grid.walkable[k] && !seen.has(k)) {
          seen.add(k);
          q.push(k);
        }
      }
    }
    for (const n of inTown) expect(seen.has(Math.round(n.y) * grid.w + Math.round(n.x)), n.name).toBe(true);
  });
});
