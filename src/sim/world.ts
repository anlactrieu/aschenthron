import { Rng } from './rng';
import { findPath, type Grid, type Pt } from './path';
import { rollDrop, type Item, type Slot } from './items';

export const TICK_RATE = 20;

export type Command =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'attack'; targetId: number }
  | { type: 'pickup'; groundId: number }
  | { type: 'equip'; itemId: number }
  | { type: 'unequip'; slot: Slot }
  | { type: 'drop'; itemId: number };

export interface Actor {
  id: number;
  kind: 'player' | 'monster';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: [number, number];
  /** Tiles pro Tick */
  speed: number;
  /** Ticks zwischen Angriffen */
  attackCooldown: number;
  cooldownLeft: number;
  path: Pt[];
  targetId: number | null;
  aggroRange: number;
  alive: boolean;
  kraft: number;
  inventory: Item[];
  equipment: Partial<Record<Slot, Item>>;
  pickupId: number | null;
}

export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item: Item;
}

export interface World {
  tick: number;
  grid: Grid;
  rng: Rng;
  actors: Actor[];
  nextId: number;
  events: GameEvent[];
  ground: GroundItem[];
}

export type GameEvent =
  | { type: 'hit'; attackerId: number; targetId: number; amount: number }
  | { type: 'died'; id: number }
  | { type: 'loot'; item: Item; x: number; y: number }
  | { type: 'pickedUp'; item: Item }
  | { type: 'tooHeavy'; item: Item }
  | { type: 'cannotEquip'; item: Item; reason: string };

const MELEE_RANGE = 1.5;

export function createWorld(seed: number, grid: Grid): World {
  const w: World = { tick: 0, grid, rng: new Rng(seed), actors: [], nextId: 1, events: [], ground: [] };
  return w;
}

export function spawnPlayer(w: World, x: number, y: number): Actor {
  return addActor(w, { kind: 'player', x, y, hp: 100, maxHp: 100, damage: [8, 14], speed: 0.15, attackCooldown: 14, aggroRange: 0 });
}

export function spawnMonster(w: World, x: number, y: number): Actor {
  return addActor(w, { kind: 'monster', x, y, hp: 60, maxHp: 60, damage: [4, 9], speed: 0.09, attackCooldown: 20, aggroRange: 6 });
}

function addActor(
  w: World,
  a: Pick<Actor, 'kind' | 'x' | 'y' | 'hp' | 'maxHp' | 'damage' | 'speed' | 'attackCooldown' | 'aggroRange'>,
): Actor {
  const actor: Actor = { ...a, id: w.nextId++, cooldownLeft: 0, path: [], targetId: null, alive: true, kraft: 10, inventory: [], equipment: {}, pickupId: null };
  w.actors.push(actor);
  return actor;
}

export const BASE_CARRY = 30;
export const CARRY_PER_KRAFT = 2;

export function equippedItems(a: Actor): Item[] {
  return Object.values(a.equipment).filter((i): i is Item => !!i);
}

function affixSum(a: Actor, stat: 'damage' | 'maxHp' | 'kraft' | 'armor'): number {
  let sum = 0;
  for (const it of equippedItems(a)) for (const f of it.affixes) if (f.stat === stat) sum += f.value;
  return sum;
}

export function effectiveKraft(a: Actor): number {
  return a.kraft + affixSum(a, 'kraft');
}

export function armorOf(a: Actor): number {
  let sum = affixSum(a, 'armor');
  for (const it of equippedItems(a)) sum += it.armor ?? 0;
  return sum;
}

export function damageRange(a: Actor): [number, number] {
  let [lo, hi] = a.damage;
  const wpn = a.equipment.weapon;
  if (wpn?.damage) {
    lo += wpn.damage[0];
    hi += wpn.damage[1];
  }
  const bonus = affixSum(a, 'damage');
  return [lo + bonus, hi + bonus];
}

export function maxHpOf(a: Actor): number {
  return a.maxHp + affixSum(a, 'maxHp');
}

export function carryCapacity(a: Actor): number {
  return BASE_CARRY + CARRY_PER_KRAFT * effectiveKraft(a);
}

export function carriedWeight(a: Actor): number {
  return [...a.inventory, ...equippedItems(a)].reduce((s, i) => s + i.weight, 0);
}

export function getActor(w: World, id: number): Actor | undefined {
  return w.actors.find((a) => a.id === id);
}

export function applyCommand(w: World, actorId: number, cmd: Command): void {
  const a = getActor(w, actorId);
  if (!a || !a.alive) return;
  if (cmd.type === 'moveTo') {
    a.targetId = null;
    a.pickupId = null;
    a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: cmd.x, y: cmd.y });
  } else if (cmd.type === 'pickup') {
    const g = w.ground.find((x) => x.id === cmd.groundId);
    if (!g) return;
    a.targetId = null;
    a.pickupId = g.id;
    a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: g.x, y: g.y });
  } else if (cmd.type === 'equip') {
    const it = a.inventory.find((i) => i.id === cmd.itemId);
    if (!it) return;
    if (effectiveKraft(a) < it.reqKraft) {
      w.events.push({ type: 'cannotEquip', item: it, reason: `Benötigt Kraft ${it.reqKraft}` });
      return;
    }
    const old = a.equipment[it.slot];
    a.inventory = a.inventory.filter((i) => i.id !== it.id);
    if (old) a.inventory.push(old);
    a.equipment[it.slot] = it;
    a.hp = Math.min(a.hp, maxHpOf(a));
  } else if (cmd.type === 'unequip') {
    const it = a.equipment[cmd.slot];
    if (!it) return;
    delete a.equipment[cmd.slot];
    a.inventory.push(it);
    a.hp = Math.min(a.hp, maxHpOf(a));
  } else if (cmd.type === 'drop') {
    const it = a.inventory.find((i) => i.id === cmd.itemId);
    if (!it) return;
    a.inventory = a.inventory.filter((i) => i.id !== it.id);
    w.ground.push({ id: w.nextId++, x: Math.round(a.x), y: Math.round(a.y), item: it });
  } else {
    const t = getActor(w, cmd.targetId);
    if (!t || !t.alive || t.id === a.id) return;
    a.targetId = t.id;
    a.path = [];
  }
}

function dist(a: Actor, b: Actor): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stepAlong(a: Actor): void {
  const next = a.path[0];
  if (!next) return;
  const dx = next.x - a.x;
  const dy = next.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= a.speed) {
    a.x = next.x;
    a.y = next.y;
    a.path.shift();
  } else {
    a.x += (dx / d) * a.speed;
    a.y += (dy / d) * a.speed;
  }
}

function chase(w: World, a: Actor, t: Actor): void {
  const goal = { x: Math.round(t.x), y: Math.round(t.y) };
  const last = a.path[a.path.length - 1];
  if (!last || Math.abs(last.x - goal.x) + Math.abs(last.y - goal.y) > 1 || a.path.length === 0) {
    const from = { x: Math.round(a.x), y: Math.round(a.y) };
    // Ziel selbst darf als blockiert gelten; zum Nachbarfeld laufen reicht
    a.path = findPath(w.grid, from, goal);
    if (a.path.length) a.path.pop();
  }
  stepAlong(a);
}

function fight(w: World, a: Actor, t: Actor): void {
  if (a.cooldownLeft > 0) return;
  a.cooldownLeft = a.attackCooldown;
  const [lo, hi] = damageRange(a);
  const amount = Math.max(1, w.rng.int(lo, hi) - armorOf(t));
  t.hp = Math.max(0, t.hp - amount);
  w.events.push({ type: 'hit', attackerId: a.id, targetId: t.id, amount });
  if (t.hp === 0) {
    t.alive = false;
    t.path = [];
    w.events.push({ type: 'died', id: t.id });
    if (t.kind === 'monster') {
      const item = rollDrop(w.rng, () => w.nextId++);
      if (item) {
        const x = Math.round(t.x);
        const y = Math.round(t.y);
        w.ground.push({ id: w.nextId++, x, y, item });
        w.events.push({ type: 'loot', item, x, y });
      }
    }
  }
}

/** Liefert angefallene Ereignisse und leert die Liste. */
export function drainEvents(w: World): GameEvent[] {
  const e = w.events;
  w.events = [];
  return e;
}

export function tick(w: World): void {
  w.tick++;
  for (const a of w.actors) {
    if (!a.alive) continue;
    if (a.cooldownLeft > 0) a.cooldownLeft--;

    if (a.kind === 'monster' && a.targetId === null) {
      const p = w.actors.find((x) => x.kind === 'player' && x.alive && dist(a, x) <= a.aggroRange);
      if (p) a.targetId = p.id;
    }

    const t = a.targetId === null ? undefined : getActor(w, a.targetId);
    if (a.targetId !== null && (!t || !t.alive)) {
      a.targetId = null;
      a.path = [];
    }
    if (t && t.alive) {
      if (dist(a, t) <= MELEE_RANGE) {
        a.path = [];
        fight(w, a, t);
      } else {
        chase(w, a, t);
      }
    } else {
      stepAlong(a);
      if (a.pickupId !== null) tryPickup(w, a);
    }
  }
}

function tryPickup(w: World, a: Actor): void {
  const g = w.ground.find((x) => x.id === a.pickupId);
  if (!g) {
    a.pickupId = null;
    return;
  }
  if (Math.hypot(a.x - g.x, a.y - g.y) > 1.2) {
    if (a.path.length === 0) a.pickupId = null;
    return;
  }
  a.pickupId = null;
  a.path = [];
  if (carriedWeight(a) + g.item.weight > carryCapacity(a)) {
    w.events.push({ type: 'tooHeavy', item: g.item });
    return;
  }
  w.ground = w.ground.filter((x) => x.id !== g.id);
  a.inventory.push(g.item);
  w.events.push({ type: 'pickedUp', item: g.item });
}
