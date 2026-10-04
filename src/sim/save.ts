import { ATTR_KEYS, MAX_LEVEL, skillById, totalXpFor } from './data';
import { isWalkable } from './path';
import type { Item } from './items';
import type { Actor, World } from './world';

const KEYS = [
  'x', 'y', 'hp', 'mana', 'level', 'xp', 'statPoints', 'attrs', 'gold', 'skills', 'inventory', 'equipment', 'stash', 'maxHp',
] as const;

const EQUIP_SLOTS = ['weapon', 'head', 'chest', 'hands', 'feet', 'ring'];

/** Serialisiert nur den Spieler; die Welt wird beim Laden neu aufgebaut. */
export function exportPlayer(p: Actor): string {
  const o: Record<string, unknown> = {};
  for (const k of KEYS) o[k] = p[k];
  return JSON.stringify({ v: 1, player: o });
}

const isItem = (i: unknown): i is Item =>
  !!i && typeof i === 'object' && typeof (i as Item).id === 'number' && typeof (i as Item).slot === 'string' && Array.isArray((i as Item).affixes);

/**
 * Lädt einen Spielstand tolerant: unbekannte/kaputte Teile werden verworfen oder auf Standard gesetzt,
 * Position außerhalb der Karte oder in einer Wand führt zum Startpunkt, XP werden an das Level angepasst.
 */
export function importPlayer(w: World, p: Actor, json: string): boolean {
  try {
    const d = JSON.parse(json) as { v: number; player: Partial<Actor> };
    if (d.v !== 1 || !d.player || typeof d.player !== 'object') return false;
    const s = d.player;
    const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
    p.level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(num(s.level, 1))));
    p.xp = Math.max(totalXpFor(p.level), num(s.xp, 0));
    p.statPoints = Math.max(0, Math.floor(num(s.statPoints, 0)));
    p.gold = Math.max(0, Math.floor(num(s.gold, 0)));
    p.maxHp = Math.max(10, num(s.maxHp, p.maxHp));
    for (const k of ATTR_KEYS) p.attrs[k] = Math.max(1, Math.floor(num((s.attrs as Record<string, number> | undefined)?.[k], 10)));
    p.skills = Array.isArray(s.skills) ? s.skills.filter((id) => typeof id === 'string' && skillById(id)) : [];
    p.inventory = Array.isArray(s.inventory) ? s.inventory.filter(isItem) : [];
    p.stash = Array.isArray(s.stash) ? s.stash.filter(isItem) : [];
    p.equipment = {};
    for (const slot of EQUIP_SLOTS) {
      const it = (s.equipment as Record<string, unknown> | undefined)?.[slot];
      if (isItem(it)) (p.equipment as Record<string, Item>)[slot] = it;
    }
    const x = Math.round(num(s.x, w.start.x));
    const y = Math.round(num(s.y, w.start.y));
    if (isWalkable(w.grid, x, y)) {
      p.x = num(s.x, w.start.x);
      p.y = num(s.y, w.start.y);
    } else {
      p.x = w.start.x;
      p.y = w.start.y;
    }
    p.hp = Math.max(1, num(s.hp, 1));
    p.mana = Math.max(0, num(s.mana, 0));
    p.skillCd = {};
    p.path = [];
    p.targetId = null;
    p.pickupId = null;
    p.alive = true;
    const ids = [...p.inventory, ...p.stash, ...Object.values(p.equipment)].map((i) => i!.id);
    w.nextId = Math.max(w.nextId, ...ids.map((i) => i + 1));
    return true;
  } catch {
    return false;
  }
}
