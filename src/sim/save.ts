import { ATTR_KEYS, MAP_VERSION, MAX_LEVEL, MAX_SKILL_RANK, SKILL_POINTS_PER_LEVEL, SKILL_POINTS_START, questById, skillById, totalXpFor } from './data';
import { isWalkable } from './path';
import { EQUIP_SLOT_LIST, GEM_KINDS, LEGENDARIES, SETS, TEMPLATES, handsOf, type Item } from './items';
import { maxHpOf, maxManaOf, type Actor, type World } from './world';

const KEYS = [
  'x', 'y', 'hp', 'mana', 'level', 'xp', 'statPoints', 'attrs', 'gold', 'skills', 'inventory', 'equipment', 'stash', 'maxHp', 'quests', 'skillRanks', 'skillPoints', 'freeRespec',
] as const;


/** Serialisiert nur den Spieler; die Welt wird beim Laden neu aufgebaut. */
export function exportPlayer(p: Actor): string {
  const o: Record<string, unknown> = {};
  for (const k of KEYS) o[k] = p[k];
  return JSON.stringify({ v: 1, mapV: MAP_VERSION, player: o });
}

/** Altformat: Köcher werden verworfen, Pfeilbündel (slot 'ammo') werden zu Pfeil-Gegenständen der Nebenhand. */
function migrateItem(i: unknown): unknown {
  if (!i || typeof i !== 'object') return i;
  const it = { ...(i as Record<string, unknown>) };
  if (it.slot === 'quiver') return null;
  if (it.slot === 'ammo') {
    const t = TEMPLATES.find((x) => x.id === it.templateId);
    if (!t || t.off !== 'arrows') return null;
    it.slot = 'offhand';
    it.off = 'arrows';
    it.name = t.name;
    it.value = t.value;
    delete it.ammo;
    delete it.capacity;
  }
  return it;
}

const isItem = (i: unknown): i is Item => {
  if (!i || typeof i !== 'object') return false;
  const it = i as Item;
  if (typeof it.id !== 'number' || typeof it.slot !== 'string' || !Array.isArray(it.affixes)) return false;
  if (!TEMPLATES.some((t) => t.id === it.templateId)) return false;
  if (it.setId !== undefined && !SETS.some((x) => x.id === it.setId)) return false;
  if (it.unique !== undefined && !LEGENDARIES.some((x) => x.id === it.unique)) return false;
  const okGem = (g: unknown) => !!g && typeof g === 'object' && GEM_KINDS.includes((g as { kind: never }).kind) && [1, 2, 3].includes((g as { q: number }).q);
  if (it.sockets !== undefined && (!Array.isArray(it.sockets) || it.sockets.length > 3 || !it.sockets.every((g) => g === null || okGem(g)))) return false;
  if (it.slot === 'gem' && !okGem(it.gem)) return false;
  return true;
};

/**
 * Lädt einen Spielstand tolerant: unbekannte/kaputte Teile werden verworfen oder auf Standard gesetzt,
 * Position außerhalb der Karte oder in einer Wand führt zum Startpunkt, XP werden an das Level angepasst.
 */
export function importPlayer(w: World, p: Actor, json: string): boolean {
  try {
    const d = JSON.parse(json) as { v: number; mapV?: number; player: Partial<Actor> };
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
    // Ränge: alte Spielstände ohne Ränge bekommen Rang 1 für jeden gelernten Skill
    p.skillRanks = {};
    const savedRanks = (s.skillRanks ?? {}) as Record<string, number>;
    for (const id of p.skills) p.skillRanks[id] = Math.min(MAX_SKILL_RANK, Math.max(1, Math.floor(num(savedRanks[id], 1))));
    const spent = Object.values(p.skillRanks).reduce((n, r) => n + r, 0);
    const earned = SKILL_POINTS_START + SKILL_POINTS_PER_LEVEL * (p.level - 1);
    p.skillPoints = typeof s.skillPoints === 'number' ? Math.max(0, Math.floor(s.skillPoints)) : Math.max(0, earned - spent);
    const rawCount = (Array.isArray(s.inventory) ? s.inventory.length : 0) + (Array.isArray(s.stash) ? s.stash.length : 0);
    p.inventory = Array.isArray(s.inventory) ? (s.inventory.map(migrateItem).filter(isItem) as Item[]) : [];
    p.stash = Array.isArray(s.stash) ? (s.stash.map(migrateItem).filter(isItem) as Item[]) : [];
    const lost = rawCount - p.inventory.length - p.stash.length;
    if (lost > 0) w.events.push({ type: 'fail', reason: `${lost} Gegenstand/Gegenstände aus dem Spielstand konnten nicht geladen werden (unbekannte Vorlage).`, to: p.id });
    p.equipment = {};
    for (const slot of EQUIP_SLOT_LIST) {
      const it = migrateItem((s.equipment as Record<string, unknown> | undefined)?.[slot]);
      if (isItem(it)) (p.equipment as Record<string, Item>)[slot] = it;
    }
    // Altstände: Zweihandwaffe plus unpassende Nebenhand (Bogen nur mit Pfeilen) – Nebenhand in den Rucksack
    const wp = p.equipment.weapon;
    const off = p.equipment.offhand;
    if (wp && off && handsOf(wp) === 2 && !(wp.kind === 'bow' && off.off === 'arrows')) {
      delete p.equipment.offhand;
      p.inventory.push(off);
    }
    const x = Math.round(num(s.x, w.start.x));
    const y = Math.round(num(s.y, w.start.y));
    // Position nur übernehmen, wenn der Spielstand zur selben Karte gehört
    if (d.mapV === MAP_VERSION && isWalkable(w.grid, x, y)) {
      p.x = num(s.x, w.start.x);
      p.y = num(s.y, w.start.y);
    } else {
      p.x = w.start.x;
      p.y = w.start.y;
    }
    p.hp = Math.min(maxHpOf(p), Math.max(1, num(s.hp, 1)));
    p.mana = Math.min(maxManaOf(p), Math.max(0, num(s.mana, 0)));
    p.quests = {};
    const qs = s.quests as Record<string, { state?: string; progress?: number }> | undefined;
    for (const [id, st] of Object.entries(qs ?? {})) {
      if (questById(id) && st && ['active', 'done', 'turned'].includes(st.state ?? '')) {
        p.quests[id] = { state: st.state as 'active' | 'done' | 'turned', progress: Math.max(0, Math.floor(num(st.progress, 0))) };
      }
    }
    // Altstände (ohne Merker): einmal kostenlos neu verteilen, damit die neuen Fertigkeiten ausprobiert werden können
    p.freeRespec = typeof s.freeRespec === 'boolean' ? s.freeRespec : true;
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
