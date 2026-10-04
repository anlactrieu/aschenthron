import type { Actor, World } from './world';

const KEYS = [
  'x', 'y', 'hp', 'mana', 'level', 'xp', 'statPoints', 'attrs', 'gold', 'skills', 'inventory', 'equipment', 'stash', 'maxHp',
] as const;

/** Serialisiert nur den Spieler; die Welt wird beim Laden neu aufgebaut. */
export function exportPlayer(p: Actor): string {
  const o: Record<string, unknown> = {};
  for (const k of KEYS) o[k] = p[k];
  return JSON.stringify({ v: 1, player: o });
}

export function importPlayer(w: World, p: Actor, json: string): boolean {
  try {
    const d = JSON.parse(json) as { v: number; player: Partial<Actor> };
    if (d.v !== 1 || !d.player) return false;
    for (const k of KEYS) if (d.player[k] !== undefined) (p as unknown as Record<string, unknown>)[k] = d.player[k];
    const ids = [...p.inventory, ...p.stash, ...Object.values(p.equipment)].map((i) => i!.id);
    w.nextId = Math.max(w.nextId, ...ids.map((i) => i + 1));
    p.path = [];
    p.alive = p.hp > 0;
    return true;
  } catch {
    return false;
  }
}
