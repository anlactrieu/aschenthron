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

/** Höchstzahl expandierter Knoten, damit unerreichbare Ziele nicht die ganze Karte fluten. */
export const PATH_NODE_CAP = 25000;

/** Binärer Min-Heap über (Knoten, Priorität). */
class MinHeap {
  private keys: number[] = [];
  private prios: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, prio: number): void {
    let i = this.keys.length;
    this.keys.push(key);
    this.prios.push(prio);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.prios[p]! <= prio) break;
      this.keys[i] = this.keys[p]!;
      this.prios[i] = this.prios[p]!;
      i = p;
    }
    this.keys[i] = key;
    this.prios[i] = prio;
  }
  pop(): number {
    const top = this.keys[0]!;
    const lastKey = this.keys.pop()!;
    const lastPrio = this.prios.pop()!;
    const n = this.keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.prios[c + 1]! < this.prios[c]!) c++;
        if (this.prios[c]! >= lastPrio) break;
        this.keys[i] = this.keys[c]!;
        this.prios[i] = this.prios[c]!;
        i = c;
      }
      this.keys[i] = lastKey;
      this.prios[i] = lastPrio;
    }
    return top;
  }
}

/** A* auf Tiles, 8 Richtungen, kein Eckenschneiden. Liefert Pfad ohne Startfeld, [] wenn keiner (oder Knotenlimit). */
export function findPath(g: Grid, from: Pt, to: Pt): Pt[] {
  if (!isWalkable(g, to.x, to.y)) return [];
  if (from.x === to.x && from.y === to.y) return [];
  const n = g.w * g.h;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const start = from.y * g.w + from.x;
  const goal = to.y * g.w + to.x;
  gScore[start] = 0;
  const heap = new MinHeap();
  heap.push(start, 0);
  const heur = (x: number, y: number) => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  let expanded = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) {
      const out: Pt[] = [];
      let k = cur;
      while (k !== start) {
        out.push({ x: k % g.w, y: Math.floor(k / g.w) });
        k = came[k]!;
      }
      return out.reverse();
    }
    if (++expanded > PATH_NODE_CAP) return [];
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    const cg = gScore[cur]!;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(g, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!isWalkable(g, cx + dx, cy) || !isWalkable(g, cx, cy + dy))) continue;
      const nk = ny * g.w + nx;
      if (closed[nk]) continue;
      const ng = cg + (dx !== 0 && dy !== 0 ? 1.41 : 1);
      if (ng < gScore[nk]!) {
        gScore[nk] = ng;
        came[nk] = cur;
        heap.push(nk, ng + heur(nx, ny));
      }
    }
  }
  return [];
}
