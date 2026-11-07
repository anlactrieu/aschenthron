import { describe, expect, it } from 'vitest';
import { buildZoneMap, Z } from './groundLook';
import { matOf } from './world/ground';
import { Raster } from './world/raster';
import { IsoChunkBaker, ISO_CHUNK_H, ISO_CHUNK_W, isoWall, type IsoGroundSrc } from './isoGround';
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

describe('Iso-Boden (P9.2)', () => {
  const src = (wallAt: (x: number, y: number) => boolean): IsoGroundSrc => ({
    w: 64, h: 64,
    mat: (x, y) => (x + y > 40 ? matOf(6, 0) : matOf(4, 1)),
    waterDist: () => 2,
    outside: (x, y) => x < 0 || y < 0 || x >= 64 || y >= 64,
    isWall: (x, y) => wallAt(x, y),
    detail: () => ({ water: false, ground: 4, zone: 1 }),
  });
  const bake = (s: IsoGroundSrc, cx: number, cy: number): Raster => {
    const out = new Raster(ISO_CHUNK_W, ISO_CHUNK_H);
    const b = new IsoChunkBaker(s, cx, cy, out);
    let n = 0;
    while (!b.step()) n++;
    expect(n + 1).toBe(b.steps);
    return out;
  };
  /** Pixelmitte liegt in der Raute des Chunks (halboffen) */
  const inside = (u: number, v: number): boolean => {
    const a = (u + 0.5 - 256) / 16;
    const b = (v + 0.5) / 8;
    const lx = (a + b) / 2;
    const ly = (b - a) / 2;
    return lx >= 0 && ly >= 0 && lx < 16 && ly < 16;
  };

  it('deckt genau die Raute des Chunks, außerhalb bleibt es durchsichtig', () => {
    const r = bake(src(() => false), 1, 1);
    let bad = 0;
    for (let v = 0; v < r.h; v++) for (let u = 0; u < r.w; u++) if ((r.d[v * r.w + u]! >>> 24 > 0) !== inside(u, v)) bad++;
    expect(bad).toBe(0);
  });

  it('ist deterministisch', () => {
    expect(bake(src(() => false), 2, 1).d).toEqual(bake(src(() => false), 2, 1).d);
  });

  it('Nachbar-Chunks überlappen nicht und lassen keine Lücke an der gemeinsamen Kante', () => {
    const a = bake(src(() => false), 0, 0);
    const b = bake(src(() => false), 1, 0);
    // Raute (1,0) liegt um 16 Kacheln in x verschoben: 512 px rechts, 256 px tiefer; Überlappung der Hüllen prüfen
    let overlap = 0;
    for (let v = 0; v < a.h; v++) {
      for (let u = 0; u < a.w; u++) {
        const pa = a.d[v * a.w + u]! >>> 24;
        const ub = u - 256;
        const vb = v - 128;
        const pb = ub >= 0 && ub < b.w && vb >= 0 && vb < b.h ? b.d[vb * b.w + ub]! >>> 24 : 0;
        if (pa && pb) overlap++;
      }
    }
    expect(overlap).toBe(0);
  });

  it('Wandschatten fällt auf die Süd- und Ostnachbarn, nicht auf die Westseite', () => {
    const wall = (x: number, y: number): boolean => x === 5 && y === 5;
    const lit = bake(src(() => false), 0, 0);
    const shadow = bake(src(wall), 0, 0);
    const lum = (r: Raster, ix: number, iy: number): number => {
      const u = 256 + 16 * (ix - iy);
      const v = 8 * (ix + iy + 1);
      let s = 0;
      for (let dv = -4; dv < 4; dv++) for (let du = -6; du < 6; du++) {
        const p = r.d[(v + dv) * r.w + (u + du)]!;
        s += (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255);
      }
      return s;
    };
    expect(lum(shadow, 5, 6)).toBeLessThan(lum(lit, 5, 6));
    expect(lum(shadow, 6, 5)).toBeLessThan(lum(lit, 6, 5));
    expect(lum(shadow, 4, 5)).toBe(lum(lit, 4, 5));
  });

  it('Wandblock: Anker an der unteren Rautenecke, Seiten nur bei offener Seite, Schlüssel je Maske', () => {
    const a = isoWall('dungeon', 4, 3, 4);
    expect(a.ay).toBe(a.h);
    const r = a.make();
    expect([r.w, r.h]).toEqual([a.w, a.h]);
    expect(r.filled(4, a.h - 12)).toBe(true);
    expect(r.filled(28, a.h - 12)).toBe(false);
    expect(isoWall('dungeon', 6, 3, 4).key).not.toBe(a.key);
  });
});
