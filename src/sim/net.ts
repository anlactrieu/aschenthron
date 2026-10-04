import { ATTR_KEYS } from './data';
import { isWalkable } from './path';
import type { Actor, Command, GameEvent, GroundItem, World } from './world';

/** Sichtweite (Tiles) für Schnappschüsse und Ereignisse */
export const NET_RADIUS = 38;

/** Prüft einen vom Netz empfangenen Befehl auf Form und Wertebereich; liefert nur Bekanntes zurück. */
export function validateCommand(w: World, c: unknown): Command | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 1e9;
  const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 64;
  switch (o.type) {
    case 'moveTo':
      return int(o.x) && int(o.y) && isWalkable(w.grid, o.x, o.y) ? { type: 'moveTo', x: o.x, y: o.y } : null;
    case 'attack':
      return int(o.targetId) ? { type: 'attack', targetId: o.targetId } : null;
    case 'pickup':
      return int(o.groundId) ? { type: 'pickup', groundId: o.groundId } : null;
    case 'equip': case 'drop': case 'usePotion': case 'sell': case 'stashPut': case 'stashTake':
      return int(o.itemId) ? ({ type: o.type, itemId: o.itemId } as Command) : null;
    case 'unequip':
      return ['weapon', 'head', 'chest', 'hands', 'feet', 'ring'].includes(o.slot as string) ? { type: 'unequip', slot: o.slot as 'weapon' } : null;
    case 'spendStat':
      return ATTR_KEYS.includes(o.attr as never) ? { type: 'spendStat', attr: o.attr as never } : null;
    case 'learnSkill':
      return str(o.skillId) ? { type: 'learnSkill', skillId: o.skillId } : null;
    case 'useSkill':
      return str(o.skillId) && (o.targetId === undefined || int(o.targetId)) ? { type: 'useSkill', skillId: o.skillId, targetId: o.targetId as number | undefined } : null;
    case 'buy':
      return str(o.templateId) ? { type: 'buy', templateId: o.templateId } : null;
    case 'acceptQuest': case 'turnInQuest':
      return str(o.questId) ? ({ type: o.type, questId: o.questId } as Command) : null;
    case 'craft':
      return int(o.itemId) && ['upgrade', 'reroll', 'extend'].includes(o.op as string) ? { type: 'craft', itemId: o.itemId, op: o.op as 'upgrade' } : null;
    default:
      return null;
  }
}

/** Reduzierte Sicht auf einen fremden Akteur (reicht für Darstellung, Zielanzeige und Namensschild). */
export interface ActorLite {
  id: number;
  kind: Actor['kind'];
  kindId?: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  boss: boolean;
  enraged: boolean;
  level: number;
  targetId: number | null;
  diedAt: number;
  pk: boolean;
  /** nur Spieler: angelegte Ausrüstung für die Optik */
  equipment?: Actor['equipment'];
}

export interface Snapshot {
  t: 'snap';
  tick: number;
  /** vollständiger eigener Spieler (JSON) */
  you: Actor;
  actors: ActorLite[];
  ground: GroundItem[];
  events: GameEvent[];
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) <= NET_RADIUS && Math.abs(a.y - b.y) <= NET_RADIUS;

export function makeSnapshot(w: World, you: Actor, events: GameEvent[]): Snapshot {
  const actors: ActorLite[] = [];
  const byId = new Map<number, Actor>();
  for (const a of w.actors) {
    if (a.id === you.id || !near(a, you)) continue;
    byId.set(a.id, a);
    // lange tote Monster werden nicht mehr gesendet
    if (!a.alive && a.kind === 'monster' && w.tick - a.diedAt > 20 * 4) continue;
    actors.push({
      id: a.id, kind: a.kind, kindId: a.kindId, name: a.name, x: a.x, y: a.y, hp: a.hp, maxHp: a.maxHp, alive: a.alive,
      boss: a.boss, enraged: a.enraged, level: a.level, targetId: a.targetId, diedAt: a.diedAt, pk: a.pkUntil > w.tick,
      equipment: a.kind === 'player' ? a.equipment : undefined,
    });
  }
  const evs = events.filter((e) => {
    if (e.to !== undefined) return e.to === you.id;
    switch (e.type) {
      case 'hit': return byId.has(e.targetId) || e.targetId === you.id || e.attackerId === you.id;
      case 'died': case 'enraged': case 'pk': return byId.has('id' in e ? e.id : -1) || ('id' in e && e.id === you.id);
      case 'loot': return near({ x: e.x, y: e.y }, you);
      default: return false;
    }
  });
  return { t: 'snap', tick: w.tick, you, actors, ground: w.ground.filter((g) => near(g, you)), events: evs };
}

/** Baut aus der reduzierten Sicht einen vollständigen Akteur (für Renderer und Zielanzeige auf dem Client). */
export function actorFromLite(l: ActorLite, tick: number): Actor {
  return {
    id: l.id, kind: l.kind, kindId: l.kindId, name: l.name, x: l.x, y: l.y, hp: l.hp, maxHp: l.maxHp, damage: [1, 1], speed: 0.1,
    attackCooldown: 20, cooldownLeft: 0, path: [], targetId: l.targetId, aggroRange: 0, alive: l.alive, level: l.level, xp: 0,
    statPoints: 0, attrs: { kraft: 10, gewandtheit: 10, ausdauer: 10, verstand: 10, willenskraft: 10 }, mana: 0, gold: 0, skills: [],
    skillCd: {}, potionCd: 0, quests: {}, inventory: [], equipment: l.equipment ?? {}, stash: [], pickupId: null, diedAt: l.diedAt,
    boss: l.boss, enraged: l.enraged, autoAttack: true, repathAt: 0, dot: null, lastHitAt: -9999, pkUntil: l.pk ? tick + 1e6 : 0,
    attackedBy: null, damagers: {},
  };
}

/** Aufwand eines Befehls für die Ratenbegrenzung: Wegsuchen sind teurer als einfache Aktionen. */
export function commandCost(c: Command): number {
  return c.type === 'moveTo' || c.type === 'attack' || c.type === 'pickup' ? 4 : 1;
}
