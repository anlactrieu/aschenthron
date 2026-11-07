/** Handelsstraße: Aschenhafen (Osttor) → Moorlande-Kreuzung → Felsenwacht (Südtor); Mittellinie der dreibreiten Wege. Gemeinsam für Sim (Wachpatrouille) und Darstellung (Reisende). */
export const ROUTE: readonly (readonly [number, number])[] = [[48, 141], [90, 141], [90, 106], [113, 106], [113, 82]];

export function routeLength(route: typeof ROUTE = ROUTE): number {
  let len = 0;
  for (let i = 1; i < route.length; i++) len += Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]);
  return len;
}

/** Punkt und Richtung (Einheitsvektor) bei Weglänge `s` ab dem Hafen */
export function routeAt(s: number, route: typeof ROUTE = ROUTE): { x: number; y: number; dx: number; dy: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1]!;
    const [bx, by] = route[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len || i === route.length - 1) {
      const k = Math.min(1, left / len);
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: (bx - ax) / len, dy: (by - ay) / len };
    }
    left -= len;
  }
  return { x: route[0]![0], y: route[0]![1], dx: 1, dy: 0 };
}

/** Abstand eines Punkts zur Strecke (Kacheln) */
export function routeDist(x: number, y: number, route: typeof ROUTE = ROUTE): number {
  let best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1]!;
    const [bx, by] = route[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - k * dx, y - ay - k * dy));
  }
  return best;
}

/** Ort auf der Hin-und-zurück-Strecke bei Weglänge `s` (0..2L, danach wieder von vorn); `dir` +1 = Hafen → Felsenwacht */
export function routePingPong(s: number, route: typeof ROUTE = ROUTE): { x: number; y: number; dx: number; dy: number; dir: 1 | -1 } {
  const L = routeLength(route);
  const m = (((s % (2 * L)) + 2 * L) % (2 * L));
  const fwd = m < L;
  const p = routeAt(fwd ? m : 2 * L - m, route);
  return fwd ? { ...p, dir: 1 } : { x: p.x, y: p.y, dx: -p.dx, dy: -p.dy, dir: -1 };
}
