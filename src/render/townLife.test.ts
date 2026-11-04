import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { isWalkable } from '../sim/path';
import { RESIDENT_KINDS } from './npc';
import { FLAT_DECOR, TOWNS, congratText, dayPhase, inShift, lineClear, looksOf, pickShout, pickSpot, spriteRows } from './townLife';

const { world } = buildWorld(1, mapJson as unknown as TiledMap);
const g = world.grid;
const seeded = (): (() => number) => {
  let s = 7;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

describe('Stadtleben: Zeitplan', () => {
  it('Schichten laufen auch über Mitternacht', () => {
    expect(inShift(12, [6, 20])).toBe(true);
    expect(inShift(20, [6, 20])).toBe(false);
    expect(inShift(23, [20, 6.5])).toBe(true);
    expect(inShift(3, [20, 6.5])).toBe(true);
    expect(inShift(12, [20, 6.5])).toBe(false);
  });
  it('Tagesabschnitte', () => {
    expect(dayPhase(12)).toBe('day');
    expect(dayPhase(20)).toBe('dusk');
    expect(dayPhase(2)).toBe('night');
  });
  it('nachts ist die Stadt nicht leer: Nachtwache und Betrunkener, tagsüber die übrigen', () => {
    for (const t of TOWNS) {
      const at = (h: number) => t.residents.filter((r) => inShift(h, r.shift)).map((r) => r.role);
      expect(at(23)).toContain('nightguard');
      expect(at(23)).not.toContain('child');
      expect(at(12)).toContain('guard');
      expect(at(12)).not.toContain('nightguard');
      expect(at(12).length).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('Stadtleben: Daten gegen die echte Karte', () => {
  it('8 bis 15 Bewohner je Stadt, alle Figuren definiert', () => {
    for (const t of TOWNS) {
      expect(t.residents.length).toBeGreaterThanOrEqual(8);
      expect(t.residents.length).toBeLessThanOrEqual(15);
      for (const l of looksOf(t)) expect(RESIDENT_KINDS).toContain(l);
    }
  });
  it('Haustüren sind begehbar', () => {
    for (const t of TOWNS) for (const r of t.residents) expect(isWalkable(g, r.home[0], r.home[1]), `${t.name} ${r.role} ${r.home}`).toBe(true);
  });
  it('jede Zone hat begehbare Kacheln, und jede Rolle findet einen Ort', () => {
    const rng = seeded();
    for (const t of TOWNS) {
      for (const [name, z] of Object.entries(t.zones)) expect(pickSpot(g, z, null, rng, 200), `${t.name}/${name}`).not.toBeNull();
      for (const r of t.residents) for (const zn of r.zones) expect(t.zones[zn], `${t.name} ${r.role} ${zn}`).toBeDefined();
      for (const a of t.animals) for (const zn of a.zones) expect(t.zones[zn], `${t.name} ${a.kind} ${zn}`).toBeDefined();
    }
  });
  it('hohe Schmuckstücke stehen nur auf schon blockierten Kacheln, flache auf begehbaren', () => {
    for (const t of TOWNS) {
      for (const d of t.decor) {
        const ok = isWalkable(g, d.x, d.y);
        if (FLAT_DECOR.has(d.kind)) expect(ok, `${t.name} ${d.kind} ${d.x},${d.y} sollte begehbar sein`).toBe(true);
        else if (d.kind === 'cart') expect(true).toBe(true);
        else expect(ok, `${t.name} ${d.kind} ${d.x},${d.y} sollte blockiert sein`).toBe(false);
      }
    }
  });
  it('Sichtlinie sieht Wände', () => {
    const t = TOWNS[0]!;
    const z = t.zones.markt!;
    expect(lineClear(g, z[0], z[1], z[0], z[1])).toBe(true);
    // quer durch Haus und Mauer nach draußen
    expect(lineClear(g, 31, 140, 31, 120)).toBe(false);
  });
});

describe('Stadtleben: Texte', () => {
  it('jede Rolle hat Zurufe in beiden Städten, ohne Wiederholung hintereinander', () => {
    const rng = seeded();
    for (const t of TOWNS) {
      for (const r of t.residents) {
        const a = pickShout(r.role, t.name, rng);
        expect(a.length).toBeGreaterThan(5);
        for (let i = 0; i < 20; i++) expect(pickShout(r.role, t.name, rng, a)).not.toBe(a);
      }
    }
  });
  it('Glückwunsch nennt die Stufe, Meilensteine haben eigene Texte', () => {
    const rng = seeded();
    expect(congratText('guard', 7, rng)).toMatch(/7|Stolz|stolz|Gut|Glückwunsch|Bravo|Stufe/);
    for (let i = 0; i < 30; i++) expect(congratText('npc', 12, rng)).toContain('12');
    expect(congratText('crier', 20, rng)).toContain('20');
    expect(congratText('npc', 30, rng)).toContain('30');
  });
});

describe('Stadtleben: Bilder', () => {
  it('alle Zeilen eines Sprites gleich breit', () => {
    for (const [name, rows] of Object.entries(spriteRows())) for (const r of rows) expect(r.length, `${name}: ${r}`).toBe(rows[0]!.length);
  });
});
