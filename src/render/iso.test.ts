import { describe, expect, it } from 'vitest';
import { arrowStep, ellipseOf, fallbackView, flatSize, footprintColumns, mapBounds, project, rangeOf, sheetView, stepLength, unproject, viewFrom, VIEW0, type ViewState } from './iso';

describe('Projektion', () => {
  for (const iso of [false, true]) {
    it(`toTile(toScreen(p)) = p (${iso ? 'Iso' : 'Draufsicht'})`, () => {
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [12.25, 7.5], [299, 239], [-3.5, 4.75]] as const) {
        const s = project(iso, x, y);
        const t = unproject(iso, s.sx, s.sy);
        expect(t.x).toBeCloseTo(x, 9);
        expect(t.y).toBeCloseTo(y, 9);
      }
    });
  }
  it('Iso 2:1: Rasterschritte auf die Rautenecken', () => {
    expect(project(true, 1, 0)).toEqual({ sx: 32, sy: 16 });
    expect(project(true, 0, 1)).toEqual({ sx: -32, sy: 16 });
    expect(project(true, 1, 1)).toEqual({ sx: 0, sy: 32 });
  });
  it('Draufsicht bleibt 48 x 48', () => {
    expect(project(false, 2, 3)).toEqual({ sx: 96, sy: 144 });
  });
  it('Kartengrenze Iso 300 x 240: 17 280 x 8 640 px', () => {
    const b = mapBounds(true, 300, 240);
    expect(b.width).toBe(17280);
    expect(b.height).toBe(8640);
  });
});

describe('viewOf', () => {
  const step = (iso: boolean, dx: number, dy: number, prev: ViewState = VIEW0): ViewState => {
    const s = project(iso, dx, dy);
    return viewFrom(iso, s.sx, s.sy, prev);
  };
  it('Iso: 8 Bildschirmrichtungen auf 5 Ansichten, links gespiegelt', () => {
    // Bildschirmrichtung -> Ansicht
    const cases: [number, number, string, boolean][] = [
      [1, 0, 'side', false], [1, 1, 'frontDiag', false], [0, 1, 'front', false], [-1, 1, 'frontDiag', true],
      [-1, 0, 'side', true], [-1, -1, 'backDiag', true], [0, -1, 'back', false], [1, -1, 'backDiag', false],
    ];
    for (const [sx, sy, view, flip] of cases) {
      const v = viewFrom(true, sx, sy);
      expect([sx, sy, v.view, v.flip]).toEqual([sx, sy, view, flip]);
    }
  });
  it('Iso: die 8 Rasterrichtungen landen in 8 verschiedenen Sektoren', () => {
    const got = ([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const).map(([dx, dy]) => {
      const v = step(true, dx, dy);
      return `${v.view}${v.flip ? '<' : '>'}`;
    });
    // Raster (1,0) = rechts unten, (1,1) = unten, (1,-1) = rechts
    expect(got).toEqual(['frontDiag>', 'front>', 'frontDiag<', 'side<', 'backDiag<', 'back>', 'backDiag>', 'side>']);
  });
  it('Iso: rein senkrecht behält die Spiegelung', () => {
    expect(viewFrom(true, 0, 10, { view: 'side', flip: true, up: false }).flip).toBe(true);
    expect(viewFrom(true, 0, -10, { view: 'side', flip: false, up: false }).flip).toBe(false);
  });
  it('Draufsicht: altes Verhalten (Seite ab |dx| > 0,8·|dy|, Schwellen 0,0005)', () => {
    expect(step(false, 1, 0)).toEqual({ view: 'side', flip: false, up: false });
    expect(step(false, -1, 1)).toEqual({ view: 'side', flip: true, up: false });
    expect(step(false, 0.7, -1)).toEqual({ view: 'back', flip: false, up: true });
    expect(step(false, 0, 1, { view: 'side', flip: true, up: true })).toEqual({ view: 'front', flip: true, up: false });
    // waagrecht: oben/unten bleibt gemerkt, auch wenn die Seitenansicht gilt
    expect(step(false, 1, 0, { view: 'back', flip: true, up: true })).toEqual({ view: 'side', flip: false, up: true });
    // nie Schrägansichten
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) expect(['side', 'front', 'back']).toContain(step(false, dx, dy).view);
  });
  it('Rückfall ohne Schrägansicht', () => {
    expect(fallbackView('frontDiag')).toBe('front');
    expect(fallbackView('backDiag')).toBe('back');
    expect(fallbackView('side')).toBe('side');
    expect(sheetView({ idle_side_0: 1 }, 'frontDiag')).toBe('front');
    expect(sheetView({ idle_frontDiag_0: 1 }, 'frontDiag')).toBe('frontDiag');
    expect(sheetView({}, 'back')).toBe('back');
  });
});

describe('Bodenkreise und Strecken', () => {
  it('groundEllipse: Iso r·W/√2 x r·H/√2, Draufsicht Kreis r·W', () => {
    const e = ellipseOf(true, 1);
    expect(e.rx).toBeCloseTo(64 / Math.SQRT2, 9);
    expect(e.ry).toBeCloseTo(32 / Math.SQRT2, 9);
    expect(e.rx / e.ry).toBeCloseTo(2, 9);
    expect(ellipseOf(false, 0.5)).toEqual({ rx: 24, ry: 24 });
  });
  it('Iso: ein Bodenkreis mit Radius 1 berührt die Mitten der Rautenkanten (Kreis in der Ebene)', () => {
    // Punkt (1/√2, 1/√2)·r im Raster liegt auf Abstand r, also auf der Ellipse
    const e = ellipseOf(true, 1);
    const p = project(true, Math.SQRT1_2, Math.SQRT1_2);
    expect((p.sx / e.rx) ** 2 + (p.sy / e.ry) ** 2).toBeCloseTo(1, 9);
    const q = project(true, 1, 0);
    expect((q.sx / e.rx) ** 2 + (q.sy / e.ry) ** 2).toBeCloseTo(1, 9);
  });
  it('flatSize: Draufsicht unverändert, Iso gleiche Breite und 2:1', () => {
    expect(flatSize(false, 40, 18)).toEqual({ w: 40, h: 18 });
    const s = flatSize(true, 40, 18);
    expect(s.w).toBeCloseTo(40, 9);
    expect(s.h).toBeCloseTo(20, 9);
  });
  it('Schrittlänge hängt in Iso nicht von der Richtung ab', () => {
    expect(stepLength(true, 1, 0)).toBeCloseTo(stepLength(true, 0, 1), 9);
    expect(stepLength(true, 1, 1)).toBeCloseTo(stepLength(true, 1, 0) * Math.SQRT2, 9);
    expect(stepLength(false, 1, 0)).toBe(48);
  });
});

describe('tileRange', () => {
  it('Draufsicht: Rechteck auf Kacheln', () => {
    expect(rangeOf(false, { x: -24, y: -24, width: 480, height: 240 })).toEqual({ x0: 0, y0: 0, x1: 10, y1: 5 });
  });
  it('Iso: alle 4 Ecken, jede Kachel mit Mitte im Bild liegt drin', () => {
    const v = { x: 1000, y: 600, width: 960, height: 540 };
    const r = rangeOf(true, v);
    for (let y = r.y0 - 5; y <= r.y1 + 5; y++) {
      for (let x = r.x0 - 5; x <= r.x1 + 5; x++) {
        const s = project(true, x, y);
        const inside = s.sx >= v.x && s.sx <= v.x + v.width && s.sy >= v.y && s.sy <= v.y + v.height;
        if (inside) expect(x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1).toBe(true);
      }
    }
  });
});

describe('Pfeiltasten', () => {
  it('Draufsicht: oben = −y, rechts = +x', () => {
    expect(arrowStep(false, ['ArrowUp'])).toEqual([0, -1]);
    expect(arrowStep(false, ['ArrowUp', 'ArrowRight'])).toEqual([1, -1]);
  });
  it('Iso: folgen dem Bildschirm, zwei Tasten = Rasterachse', () => {
    expect(arrowStep(true, ['ArrowUp'])).toEqual([-1, -1]);
    expect(arrowStep(true, ['ArrowRight'])).toEqual([1, -1]);
    expect(arrowStep(true, ['ArrowDown'])).toEqual([1, 1]);
    expect(arrowStep(true, ['ArrowLeft'])).toEqual([-1, 1]);
    expect(arrowStep(true, ['ArrowUp', 'ArrowRight'])).toEqual([0, -1]);
    expect(arrowStep(true, ['ArrowDown', 'ArrowRight'])).toEqual([1, 0]);
    expect(arrowStep(true, ['ArrowUp', 'ArrowDown'])).toEqual([0, 0]);
    // jede der 8 Richtungen zeigt auf dem Bildschirm dorthin, wohin die Tasten zeigen
    const want: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const combos = [['ArrowUp'], ['ArrowDown'], ['ArrowLeft'], ['ArrowRight'], ['ArrowUp', 'ArrowLeft'], ['ArrowUp', 'ArrowRight'], ['ArrowDown', 'ArrowLeft'], ['ArrowDown', 'ArrowRight']];
    for (const c of combos) {
      const [dx, dy] = arrowStep(true, c);
      const s = project(true, dx, dy);
      const wx = c.reduce((n, k) => n + want[k]![0], 0);
      const wy = c.reduce((n, k) => n + want[k]![1], 0);
      expect([Math.sign(s.sx), Math.sign(s.sy)]).toEqual([wx, wy]);
    }
  });
});

describe('Tiefenvertrag', () => {
  // Haus 6 x 4 Kacheln ab (10, 20)
  const cols = footprintColumns(10, 20, 6, 4);
  const colAt = (sx: number): number => cols.find((c) => sx >= c.sx && sx < c.sx + 32)!.depth;
  it('Spalten von 32 px über die ganze Breite', () => {
    expect(cols.length).toBe(((6 + 4) * 64) / 2 / 32);
    for (let i = 1; i < cols.length; i++) expect(cols[i]!.sx - cols[i - 1]!.sx).toBe(32);
  });
  it('Figur eine Kachel vor der Wand steht davor, auch neben den Flügeln', () => {
    const fronts: [number, number][] = [];
    for (let x = 10; x < 16; x++) fronts.push([x, 24]); // vor der Südwand
    for (let y = 20; y < 24; y++) fronts.push([16, y]); // vor der Ostwand
    fronts.push([16, 24]);
    for (const [x, y] of fronts) {
      const s = project(true, x, y);
      // Figur ~30 px breit: beide Spalten, die sie überdeckt
      for (const dx of [-14, 14]) {
        const sx = s.sx + dx;
        if (sx < cols[0]!.sx || sx >= cols[cols.length - 1]!.sx + 32) continue;
        expect(s.sy, `${x},${y}`).toBeGreaterThan(colAt(sx));
      }
    }
  });
  it('Figur im Haus oder dahinter steht dahinter', () => {
    const behind: [number, number][] = [];
    for (let x = 10; x < 16; x++) behind.push([x, 19], [x, 22]);
    for (let y = 20; y < 24; y++) behind.push([9, y], [14, y]);
    for (const [x, y] of behind) {
      const s = project(true, x, y);
      for (const dx of [-14, 14]) {
        const sx = s.sx + dx;
        if (sx < cols[0]!.sx || sx >= cols[cols.length - 1]!.sx + 32) continue;
        expect(s.sy, `${x},${y}`).toBeLessThan(colAt(sx));
      }
    }
  });
  it('eine Raute: Spaltentiefe = Mitte + 8 (standDepth in Iso)', () => {
    const one = footprintColumns(3, 4, 1, 1);
    const c = project(true, 3, 4);
    expect(one.map((k) => k.depth)).toEqual([c.sy + 8, c.sy + 8]);
  });
});
