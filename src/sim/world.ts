import { Rng } from './rng';
import { findPath, type Grid, type Pt } from './path';

export const TICK_RATE = 20;

export type Command =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'attack'; targetId: number };

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
}

export interface World {
  tick: number;
  grid: Grid;
  rng: Rng;
  actors: Actor[];
  nextId: number;
  events: GameEvent[];
}

export type GameEvent =
  | { type: 'hit'; attackerId: number; targetId: number; amount: number }
  | { type: 'died'; id: number };

const MELEE_RANGE = 1.5;

export function createWorld(seed: number, grid: Grid): World {
  const w: World = { tick: 0, grid, rng: new Rng(seed), actors: [], nextId: 1, events: [] };
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
  const actor: Actor = { ...a, id: w.nextId++, cooldownLeft: 0, path: [], targetId: null, alive: true };
  w.actors.push(actor);
  return actor;
}

export function getActor(w: World, id: number): Actor | undefined {
  return w.actors.find((a) => a.id === id);
}

export function applyCommand(w: World, actorId: number, cmd: Command): void {
  const a = getActor(w, actorId);
  if (!a || !a.alive) return;
  if (cmd.type === 'moveTo') {
    a.targetId = null;
    a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: cmd.x, y: cmd.y });
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
  const amount = w.rng.int(a.damage[0], a.damage[1]);
  t.hp = Math.max(0, t.hp - amount);
  w.events.push({ type: 'hit', attackerId: a.id, targetId: t.id, amount });
  if (t.hp === 0) {
    t.alive = false;
    t.path = [];
    w.events.push({ type: 'died', id: t.id });
  }
}

export function tick(w: World): void {
  w.tick++;
  w.events = [];
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
    }
  }
}
