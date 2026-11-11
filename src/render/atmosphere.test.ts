import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';

import { DUNGEON_AMBIENT, DUNGEONS, LIGHT_TILES, LIGHT_TILES_DUNGEON, darkness, dayColor, isDungeon, lightFactor, lightRadius, weatherFor, zoneClass } from './atmosphere';

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


describe('Render: Lichtkreis (T4)', () => {
  it('Dunkelheit: Mittag 0, Nacht und Dungeon voll, Dämmerung dazwischen', () => {
    expect(darkness(dayColor(12))).toBe(0);
    expect(darkness(dayColor(2))).toBe(1);
    expect(darkness(DUNGEON_AMBIENT)).toBe(1);
    const dusk = darkness(dayColor(20.5));
    expect(dusk).toBeGreaterThan(0.2);
    expect(dusk).toBeLessThan(1);
  });

  it('Nacht ist dunkler als zuvor (Bildrand unter 40 % Helligkeit)', () => {
    const [r, g, b] = dayColor(2);
    expect(Math.max(r, g, b)).toBeLessThan(0.4 * 255);
  });

  it('Lichtfaktor: voll im Kern, 0 am Rand und draußen, stetig und fallend dazwischen', () => {
    expect(lightFactor(0, 6)).toBe(1);
    expect(lightFactor(6, 6)).toBe(0);
    expect(lightFactor(9, 6)).toBe(0);
    let prev = 1;
    for (let d = 0; d <= 6; d += 0.25) {
      const f = lightFactor(d, 6);
      expect(f).toBeLessThanOrEqual(prev + 1e-9);
      expect(prev - f).toBeLessThan(0.2); // kein Sprung (Blinken)
      prev = f;
    }
    expect(lightFactor(1, 0)).toBe(0);
  });

  it('Lichtradius: eine Stelle, Dungeon enger, Fackelzuschlag vergrößert, nie negativ', () => {
    expect(lightRadius(false)).toBe(LIGHT_TILES);
    expect(lightRadius(true)).toBe(LIGHT_TILES_DUNGEON);
    expect(lightRadius(false, 2)).toBe(LIGHT_TILES + 2);
    expect(lightRadius(false, -3)).toBe(LIGHT_TILES);
  });
});
