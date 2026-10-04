export interface Grid {
  w: number;
  h: number;
  /** true = begehbar */
  walkable: boolean[];
}

export interface Pt {
  x: number;
  y: number;
}

export function isWalkable(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.w && y < g.h && g.walkable[y * g.w + x] === true;
}

const DIRS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** A* auf Tiles, 8 Richtungen, kein Eckenschneiden. Liefert Pfad ohne Startfeld, [] wenn keiner. */
export function findPath(g: Grid, from: Pt, to: Pt): Pt[] {
  if (!isWalkable(g, to.x, to.y)) return [];
  if (from.x === to.x && from.y === to.y) return [];
  const key = (x: number, y: number) => y * g.w + x;
  const open: { x: number; y: number; f: number }[] = [{ ...from, f: 0 }];
  const gScore = new Map<number, number>([[key(from.x, from.y), 0]]);
  const came = new Map<number, number>();
  const heur = (x: number, y: number) => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (cur.x === to.x && cur.y === to.y) {
      const out: Pt[] = [];
      let k = key(cur.x, cur.y);
      while (k !== key(from.x, from.y)) {
        out.push({ x: k % g.w, y: Math.floor(k / g.w) });
        k = came.get(k)!;
      }
      return out.reverse();
    }
    const cg = gScore.get(key(cur.x, cur.y))!;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkable(g, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!isWalkable(g, cur.x + dx, cur.y) || !isWalkable(g, cur.x, cur.y + dy))) continue;
      const ng = cg + (dx !== 0 && dy !== 0 ? 1.41 : 1);
      const nk = key(nx, ny);
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, key(cur.x, cur.y));
        open.push({ x: nx, y: ny, f: ng + heur(nx, ny) });
      }
    }
  }
  return [];
}
