import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { detectHouses, type House } from './houses';
import { footprintColumns } from './iso';
import { isoHouseFade, isoHouseParts, isoTownProp } from './isoHouses';
import { isoPropKey, isoPropRaster, propAnchor, blockRaster, type IsoProp } from './isoTownArt';

const tiles = (mapJson as { layers: { data: number[] }[] }).layers[0]!.data;
const houses = detectHouses(tiles, 300, 240);
const base: House = { x0: 10, y0: 20, w: 8, h: 6, variant: 1, door: null };
const withDoor = (side: 'N' | 'S' | 'E' | 'W', x: number, y: number): House => ({ ...base, door: { x, y, icon: 'anchor', side } });

describe('Iso-Häuser: Teile', () => {
  it('jedes Haus der Karte liefert vier Teile (Rückwand, Wände, Dach, Licht) mit Bild', () => {
    expect(houses.length).toBeGreaterThanOrEqual(10);
    for (const hs of houses) {
      const parts = isoHouseParts(hs);
      expect(parts.map((p) => p.fade)).toEqual(['back', 'walls', 'roof', 'none']);
      expect(parts.filter((p) => p.light).length).toBe(1);
      for (const p of parts) {
        const r = p.make();
        expect(r.w).toBeGreaterThan(100);
        expect(r.d.some((v) => v >>> 24 > 0), `${hs.x0},${hs.y0} ${p.key}`).toBe(true);
      }
    }
  });
  it('Häuser gleicher Bauart teilen sich Bild und Schlüssel, nur die Lage ist verschieden', () => {
    const a = isoHouseParts({ ...base, door: { x: 14, y: 25, icon: 'anchor', side: 'S' } });
    const b = isoHouseParts({ ...base, x0: 40, y0: 3, door: { x: 44, y: 8, icon: 'anchor', side: 'S' } });
    expect(a.map((p) => p.key)).toEqual(b.map((p) => p.key));
    // 30 Kacheln nach rechts und 17 nach oben: Δsx = (30 − (−17))·32, Δsy = (30 + (−17))·16
    expect(b[0]!.sx - a[0]!.sx).toBe(30 * 32 + 17 * 32);
    expect(b[0]!.sy - a[0]!.sy).toBe(13 * 16);
    const c = isoHouseParts({ ...base, door: { x: 15, y: 25, icon: 'anchor', side: 'S' } });
    expect(c[1]!.key).not.toBe(a[1]!.key);
  });
  it('Türen auf allen vier Seiten ändern das passende Teil, auch Nord und West', () => {
    const none = isoHouseParts(base);
    const sig = (hs: House): string[] => isoHouseParts(hs).map((p) => [...p.make().d].reduce((h, v) => (h * 31 + v) | 0, 7).toString());
    const s = sig(withDoor('S', 13, 25));
    const e = sig(withDoor('E', 17, 22));
    const n = sig(withDoor('N', 13, 20));
    const w = sig(withDoor('W', 10, 22));
    const bare = sig(base);
    // S/E: Vorderwände, Schild und Licht; N/W: Rückwand, Dach (Schild auf der Stange) und Licht
    expect(s[1]).not.toBe(bare[1]);
    expect(e[1]).not.toBe(bare[1]);
    expect(n[0]).not.toBe(bare[0]);
    expect(w[0]).not.toBe(bare[0]);
    expect(n[2]).not.toBe(bare[2]);
    expect(w[2]).not.toBe(bare[2]);
    expect(n[1]).toBe(bare[1]);
    expect(none.length).toBe(4);
  });
  it('das Bild passt in die Spalten des Hauses (Bildecke links der Grundfläche, Unterkante unter der Vorderecke)', () => {
    const hs = houses[0]!;
    const cols = footprintColumns(hs.x0, hs.y0, hs.w, hs.h);
    for (const p of isoHouseParts(hs)) {
      const r = p.make();
      expect(p.sx).toBeLessThan(cols[0]!.sx + 1);
      expect(p.sx + r.w * 2).toBeGreaterThan(cols[cols.length - 1]!.sx + 31);
    }
  });
});

describe('Iso-Häuser: Ausblenden', () => {
  it('im Haus blenden Dach und Vorderwände aus, davor nur das Dach, weit weg nichts', () => {
    const hs = withDoor('S', 13, 25);
    expect(isoHouseFade(hs, 14, 22)).toEqual({ roof: 0.2, walls: 0.2, back: 1 });
    expect(isoHouseFade(hs, 13, 26).roof).toBe(0.5);
    expect(isoHouseFade(hs, 0, 0)).toEqual({ roof: 1, walls: 1, back: 1 });
  });
  it('Nord- und Westtür: das Dach blendet auch draußen vor der Tür aus', () => {
    expect(isoHouseFade(withDoor('N', 13, 20), 13, 18).roof).toBeLessThan(1);
    expect(isoHouseFade(withDoor('W', 10, 22), 8, 22).roof).toBeLessThan(1);
  });
});

describe('Iso-Props', () => {
  it('Stadtprops: Stand und Blumenkasten bekommen Iso-Bilder je Richtung, der Rest bleibt', () => {
    expect(isoTownProp('twn_stall', 'x', 5, 5).key).toBe(isoPropKey('stall', 'x'));
    expect(isoTownProp('twn_stall', 'y', 5, 5).key).toBe(isoPropKey('stall', 'y'));
    expect(isoTownProp('twn_flowers', 'y', 5, 5).key).toBe(isoPropKey('flowers', 'y'));
    expect(isoTownProp('twn_barrel', 'x', 5, 5)).toEqual({ key: 'twn_barrel' });
    expect(isoTownProp('twn_lantern', 'y', 5, 5).oy).toBeUndefined();
  });
  it('Bilder sind gefüllt, Stand und Zaun unterscheiden sich je Richtung, der Anker liegt im Bild', () => {
    for (const kind of ['stall', 'flowers', 'fence'] as IsoProp[]) {
      const x = isoPropRaster(kind, 'x');
      const y = isoPropRaster(kind, 'y');
      expect(x.d.some((v) => v >>> 24 > 0), kind).toBe(true);
      expect(x.d.join()).not.toBe(y.d.join());
      expect(propAnchor(kind).oy).toBeGreaterThan(0.4);
      expect(propAnchor(kind).oy).toBeLessThan(1);
    }
  });
  it('Wandblock: Boden des Bildes ist die vordere Rautenecke, mit Tür ein anderes Bild', () => {
    const a = blockRaster(0, null);
    const b = blockRaster(0, { icon: 'book', axis: 'x', draw: () => undefined });
    expect(a.w).toBe(32);
    expect(a.d.join()).not.toBe(b.d.join());
    // unterste Zeile gefüllt (vordere Ecke)
    let bottom = false;
    for (let x = 0; x < a.w; x++) if (a.filled(x, a.h - 1)) bottom = true;
    expect(bottom).toBe(true);
  });
});
