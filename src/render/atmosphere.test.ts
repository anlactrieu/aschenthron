import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';

import { DUNGEONS, dayColor, isDungeon, weatherFor, zoneClass } from './atmosphere';

const { world: w } = buildWorld(3, mapJson as unknown as TiledMap);

describe('Render: Zonenklassen', () => {
  it('Dungeon-Regionen sind in der Render-Liste (Zyklus ausgeschaltet), jede Dungeon-Region der Karte ist darin', () => {
    for (const r of w.regions) if (r.levels !== 'Stadt' && !['Roggenfelder', 'Düsterwald', 'Räuberlager', 'Moorlande', 'Totenacker', 'Hochland', 'Aschenöde', 'Aschengrund'].includes(r.name)) expect(isDungeon(r.name), r.name).toBe(true);
    for (const n of ['Goblinbau', 'Spinnennest', 'Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche']) {
      expect(DUNGEONS).toContain(n);
      expect(zoneClass(n)).toBe('indoor');
    }
    expect(zoneClass('Aschenhafen')).toBe('town');
    expect(zoneClass('Moorlande')).toBe('outdoor');
  });
});

describe('Render: Tag/Nacht und Wetter (reine Funktionen)', () => {
  it('Tagesfarbe: Mittag unverändert, Nacht bläulich dunkel, Dämmerung warm', () => {
    expect(dayColor(12)).toEqual([255, 255, 255]);
    const [nr, ng, nb] = dayColor(2);
    expect(nb).toBeGreaterThan(nr);
    expect(nr).toBeLessThan(140);
    const [dr, dg, db] = dayColor(19);
    expect(dr).toBeGreaterThan(dg);
    expect(dg).toBeGreaterThan(db);
    expect(ng).toBeLessThan(255);
    // stetig über Mitternacht
    expect(dayColor(23.99)).toEqual(dayColor(0));
    expect(dayColor(-1)).toEqual(dayColor(23));
  });

  it('Wetter: Zonenabhängig, deterministisch, wechselnd', () => {
    expect(weatherFor('Moorlande', 5)).toBe(weatherFor('Moorlande', 5));
    const seen = new Set<string>();
    for (let s = 0; s < 200; s++) seen.add(weatherFor('Moorlande', s));
    expect([...seen].sort()).toEqual(['clear', 'fog', 'rain']);
    const ash = new Set<string>();
    for (let s = 0; s < 200; s++) ash.add(weatherFor('Aschenöde', s));
    expect([...ash].sort()).toEqual(['ash', 'clear']);
    let rainy = 0;
    for (let s = 0; s < 400; s++) if (weatherFor('Roggenfelder', s) === 'rain') rainy++;
    expect(rainy).toBeGreaterThan(0);
    expect(rainy).toBeLessThan(80);
    for (let s = 0; s < 50; s++) expect(weatherFor('Tiefenmine', s)).toBe('clear');
  });
});

