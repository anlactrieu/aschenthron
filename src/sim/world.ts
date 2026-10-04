import { Rng } from './rng';
import { findPath, isWalkable, type Grid, type Pt } from './path';
import { rollDrop, TEMPLATES, templateById, generateItem, type Item, type Slot } from './items';
import {
  ATTR_KEYS, MAX_LEVEL, SAFE_REGEN, FIELD_REGEN, START_STAT_POINTS, STAT_POINTS_PER_LEVEL,
  monsterKind, skillById, totalXpFor, type AttrKey,
} from './data';

export const TICK_RATE = 20;
export const NPC_RANGE = 3;
const MELEE_RANGE = 1.5;
const MONSTER_RESPAWN_TICKS = 20 * 45;
const MONSTER_LOOT_TTL = 20 * 180;
const CORPSE_LOOT_TTL = 20 * 300;
const LEASH = 14;

export type Command =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'attack'; targetId: number }
  | { type: 'pickup'; groundId: number }
  | { type: 'equip'; itemId: number }
  | { type: 'unequip'; slot: Slot }
  | { type: 'drop'; itemId: number }
  | { type: 'spendStat'; attr: AttrKey }
  | { type: 'learnSkill'; skillId: string }
  | { type: 'useSkill'; skillId: string; targetId?: number }
  | { type: 'buy'; templateId: string }
  | { type: 'sell'; itemId: number }
  | { type: 'stashPut'; itemId: number }
  | { type: 'stashTake'; itemId: number };

export type Attrs = Record<AttrKey, number>;

export interface Actor {
  id: number;
  kind: 'player' | 'monster';
  kindId?: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  /** Basis-Leben (ohne Attribut-/Item-Boni) */
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
  level: number;
  xp: number;
  statPoints: number;
  attrs: Attrs;
  mana: number;
  gold: number;
  skills: string[];
  skillCd: Record<string, number>;
  inventory: Item[];
  equipment: Partial<Record<Slot, Item>>;
  stash: Item[];
  pickupId: number | null;
  home?: Pt;
  diedAt: number;
  boss: boolean;
  enraged: boolean;
}

export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item: Item;
  expiresAt: number | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type NpcKind = 'trainer' | 'merchant' | 'stash';
export interface Npc {
  id: number;
  kind: NpcKind;
  name: string;
  x: number;
  y: number;
}

export type GameEvent =
  | { type: 'hit'; attackerId: number; targetId: number; amount: number; skill?: string }
  | { type: 'died'; id: number }
  | { type: 'loot'; item: Item; x: number; y: number }
  | { type: 'pickedUp'; item: Item }
  | { type: 'tooHeavy'; item: Item }
  | { type: 'cannotEquip'; item: Item; reason: string }
  | { type: 'xp'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'gold'; amount: number }
  | { type: 'learned'; skillId: string }
  | { type: 'deathPenalty'; xpLost: number; dropped: Item[] }
  | { type: 'respawned' }
  | { type: 'enraged'; id: number }
  | { type: 'fail'; reason: string };

export interface World {
  tick: number;
  grid: Grid;
  rng: Rng;
  actors: Actor[];
  nextId: number;
  events: GameEvent[];
  ground: GroundItem[];
  safe: Rect[];
  npcs: Npc[];
  start: Pt;
}

export function createWorld(seed: number, grid: Grid, safe: Rect[] = []): World {
  return { tick: 0, grid, rng: new Rng(seed), actors: [], nextId: 1, events: [], ground: [], safe, npcs: [], start: { x: 1, y: 1 } };
}

export function addNpc(w: World, kind: NpcKind, name: string, x: number, y: number): Npc {
  const n: Npc = { id: w.nextId++, kind, name, x, y };
  w.npcs.push(n);
  return n;
}

function baseActor(w: World, kind: Actor['kind'], name: string, x: number, y: number): Actor {
  const a: Actor = {
    id: w.nextId++, kind, name, x, y, hp: 100, maxHp: 100, damage: [1, 2], speed: 0.1, attackCooldown: 20,
    cooldownLeft: 0, path: [], targetId: null, aggroRange: 0, alive: true, level: 1, xp: 0, statPoints: 0,
    attrs: { kraft: 10, gewandtheit: 10, ausdauer: 10, verstand: 10, willenskraft: 10 },
    mana: 20, gold: 0, skills: [], skillCd: {}, inventory: [], equipment: {}, stash: [], pickupId: null,
    diedAt: -1, boss: false, enraged: false,
  };
  w.actors.push(a);
  return a;
}

export function spawnPlayer(w: World, x: number, y: number): Actor {
  const a = baseActor(w, 'player', 'Held', x, y);
  Object.assign(a, { damage: [4, 7] as [number, number], speed: 0.15, attackCooldown: 14, statPoints: START_STAT_POINTS, gold: 20 });
  a.hp = maxHpOf(a);
  a.mana = maxManaOf(a);
  w.start = { x, y };
  return a;
}

export function spawnMonster(w: World, x: number, y: number, kindId = 'grave_rat'): Actor {
  const k = monsterKind(kindId);
  const a = baseActor(w, 'monster', k.name, x, y);
  Object.assign(a, {
    kindId, level: k.level, hp: k.hp, maxHp: k.hp, damage: k.damage, speed: k.speed,
    attackCooldown: k.attackCooldown, aggroRange: k.aggroRange, home: { x, y }, boss: !!k.boss,
  });
  return a;
}

/* ---------- abgeleitete Werte ---------- */

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
  return a.attrs.kraft + affixSum(a, 'kraft');
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
  const bonus = affixSum(a, 'damage') + Math.floor((effectiveKraft(a) - 10) / 2);
  return [Math.max(1, lo + bonus), Math.max(1, hi + bonus)];
}

export function maxHpOf(a: Actor): number {
  return Math.max(10, a.maxHp + (a.attrs.ausdauer - 10) * 5 + affixSum(a, 'maxHp'));
}

export function maxManaOf(a: Actor): number {
  return 20 + (a.attrs.verstand - 10) * 5;
}

export function attackCooldownOf(a: Actor): number {
  return Math.max(6, a.attackCooldown - Math.floor((a.attrs.gewandtheit - 10) / 2));
}

export function carryCapacity(a: Actor): number {
  return BASE_CARRY + CARRY_PER_KRAFT * effectiveKraft(a);
}

export function carriedWeight(a: Actor): number {
  return [...a.inventory, ...equippedItems(a)].reduce((s, i) => s + i.weight, 0);
}

export function inSafeZone(w: World, x: number, y: number): boolean {
  return w.safe.some((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
}

export function nearNpc(w: World, a: Actor, kind: NpcKind): Npc | undefined {
  return w.npcs.find((n) => n.kind === kind && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
}

export function sellPrice(i: Item): number {
  return Math.max(1, Math.floor(i.value * 0.5));
}

export function buyPrice(templateId: string): number {
  return templateById(templateId).value * 2;
}

export function getActor(w: World, id: number): Actor | undefined {
  return w.actors.find((a) => a.id === id);
}

/* ---------- Befehle ---------- */

function fail(w: World, reason: string): void {
  w.events.push({ type: 'fail', reason });
}

export function applyCommand(w: World, actorId: number, cmd: Command): void {
  const a = getActor(w, actorId);
  if (!a || !a.alive) return;
  switch (cmd.type) {
    case 'moveTo':
      a.targetId = null;
      a.pickupId = null;
      a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: cmd.x, y: cmd.y });
      break;
    case 'attack': {
      const t = getActor(w, cmd.targetId);
      if (!t || !t.alive || t.id === a.id) return;
      a.targetId = t.id;
      a.pickupId = null;
      a.path = [];
      break;
    }
    case 'pickup': {
      const g = w.ground.find((x) => x.id === cmd.groundId);
      if (!g) return;
      a.targetId = null;
      a.pickupId = g.id;
      a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: g.x, y: g.y });
      break;
    }
    case 'equip': {
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
      break;
    }
    case 'unequip': {
      const it = a.equipment[cmd.slot];
      if (!it) return;
      delete a.equipment[cmd.slot];
      a.inventory.push(it);
      a.hp = Math.min(a.hp, maxHpOf(a));
      break;
    }
    case 'drop': {
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it) return;
      a.inventory = a.inventory.filter((i) => i.id !== it.id);
      w.ground.push({ id: w.nextId++, x: Math.round(a.x), y: Math.round(a.y), item: it, expiresAt: null });
      break;
    }
    case 'spendStat':
      if (a.statPoints <= 0 || !ATTR_KEYS.includes(cmd.attr)) return;
      a.statPoints--;
      a.attrs[cmd.attr]++;
      break;
    case 'learnSkill': {
      const s = skillById(cmd.skillId);
      if (!s) return;
      if (!nearNpc(w, a, 'trainer')) return fail(w, 'Kein Lehrer in der Nähe.');
      if (a.skills.includes(s.id)) return fail(w, 'Bereits gelernt.');
      if (a.level < s.levelReq) return fail(w, `Benötigt Level ${s.levelReq}.`);
      if (a.gold < s.price) return fail(w, 'Nicht genug Gold.');
      a.gold -= s.price;
      a.skills.push(s.id);
      w.events.push({ type: 'learned', skillId: s.id });
      break;
    }
    case 'useSkill':
      useSkill(w, a, cmd.skillId, cmd.targetId);
      break;
    case 'buy': {
      if (!nearNpc(w, a, 'merchant')) return fail(w, 'Kein Händler in der Nähe.');
      if (!TEMPLATES.some((t) => t.id === cmd.templateId)) return;
      const price = buyPrice(cmd.templateId);
      if (a.gold < price) return fail(w, 'Nicht genug Gold.');
      const item = generateItem(w.rng, w.nextId++, cmd.templateId, 'normal');
      if (carriedWeight(a) + item.weight > carryCapacity(a)) {
        w.events.push({ type: 'tooHeavy', item });
        return;
      }
      a.gold -= price;
      a.inventory.push(item);
      w.events.push({ type: 'pickedUp', item });
      break;
    }
    case 'sell': {
      if (!nearNpc(w, a, 'merchant')) return fail(w, 'Kein Händler in der Nähe.');
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it) return;
      a.inventory = a.inventory.filter((i) => i.id !== it.id);
      const price = sellPrice(it);
      a.gold += price;
      w.events.push({ type: 'gold', amount: price });
      break;
    }
    case 'stashPut': {
      if (!nearNpc(w, a, 'stash')) return fail(w, 'Keine Truhe in der Nähe.');
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it) return;
      a.inventory = a.inventory.filter((i) => i.id !== it.id);
      a.stash.push(it);
      break;
    }
    case 'stashTake': {
      if (!nearNpc(w, a, 'stash')) return fail(w, 'Keine Truhe in der Nähe.');
      const it = a.stash.find((i) => i.id === cmd.itemId);
      if (!it) return;
      if (carriedWeight(a) + it.weight > carryCapacity(a)) {
        w.events.push({ type: 'tooHeavy', item: it });
        return;
      }
      a.stash = a.stash.filter((i) => i.id !== it.id);
      a.inventory.push(it);
      break;
    }
  }
}

function useSkill(w: World, a: Actor, skillId: string, targetId?: number): void {
  const s = skillById(skillId);
  if (!s || !a.skills.includes(s.id)) return fail(w, 'Fertigkeit nicht gelernt.');
  if ((a.skillCd[s.id] ?? 0) > 0) return;
  if (a.mana < s.mana) return fail(w, 'Nicht genug Mana.');
  const t = getActor(w, targetId ?? a.targetId ?? -1);
  if (!t || !t.alive || t.id === a.id) return fail(w, 'Kein Ziel.');
  if (Math.hypot(a.x - t.x, a.y - t.y) > s.range) return fail(w, 'Ziel außer Reichweite.');
  a.mana -= s.mana;
  a.skillCd[s.id] = s.cooldown;
  let amount: number;
  if (s.mult) {
    const [lo, hi] = damageRange(a);
    amount = Math.round(w.rng.int(lo, hi) * s.mult);
  } else {
    const [lo, hi] = s.base!;
    const scale = s.scales ? Math.max(0, a.attrs[s.scales] - 10) : 0;
    amount = w.rng.int(lo, hi) + scale;
  }
  a.targetId = t.id;
  a.path = [];
  dealDamage(w, a, t, amount, s.ignoresArmor, s.id);
}

/* ---------- Kampf ---------- */

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
  if (!last || Math.abs(last.x - goal.x) + Math.abs(last.y - goal.y) > 1) {
    a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, goal);
    if (a.path.length) a.path.pop();
  }
  if (a.path.length) return stepAlong(a);
  // Letzter Schritt: Ziel liegt im Nachbarfeld, aber noch außerhalb der Nahkampfreichweite
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return;
  const nx = a.x + (dx / d) * Math.min(a.speed, d);
  const ny = a.y + (dy / d) * Math.min(a.speed, d);
  if (isWalkable(w.grid, Math.round(nx), Math.round(ny))) {
    a.x = nx;
    a.y = ny;
  }
}

function fight(w: World, a: Actor, t: Actor): void {
  if (a.cooldownLeft > 0) return;
  a.cooldownLeft = attackCooldownOf(a);
  const [lo, hi] = damageRange(a);
  dealDamage(w, a, t, w.rng.int(lo, hi), false);
}

function dealDamage(w: World, a: Actor, t: Actor, raw: number, ignoreArmor: boolean, skill?: string): void {
  if (t.kind === 'player' && inSafeZone(w, t.x, t.y)) return;
  const amount = Math.max(1, raw - (ignoreArmor ? 0 : armorOf(t)));
  t.hp = Math.max(0, t.hp - amount);
  w.events.push({ type: 'hit', attackerId: a.id, targetId: t.id, amount, skill });
  if (t.boss && !t.enraged && t.hp > 0 && t.hp < t.maxHp * 0.3) {
    t.enraged = true;
    t.damage = [Math.round(t.damage[0] * 1.5), Math.round(t.damage[1] * 1.5)];
    w.events.push({ type: 'enraged', id: t.id });
  }
  if (t.hp > 0) return;
  t.alive = false;
  t.path = [];
  t.targetId = null;
  t.diedAt = w.tick;
  w.events.push({ type: 'died', id: t.id });
  if (t.kind === 'monster') onMonsterDeath(w, a, t);
  else onPlayerDeath(w, t);
}

function onMonsterDeath(w: World, killer: Actor, m: Actor): void {
  const k = monsterKind(m.kindId!);
  if (killer.kind === 'player') {
    gainXp(w, killer, k.xp);
    const gold = w.rng.int(k.gold[0], k.gold[1]);
    killer.gold += gold;
    w.events.push({ type: 'gold', amount: gold });
  }
  if (w.rng.next() <= k.dropChance) {
    const item = rollDrop(w.rng, () => w.nextId++, k.level, k.boss ? 'rare' : undefined);
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    w.ground.push({ id: w.nextId++, x, y, item, expiresAt: w.tick + MONSTER_LOOT_TTL });
    w.events.push({ type: 'loot', item, x, y });
  }
}

export function gainXp(w: World, a: Actor, amount: number): void {
  a.xp += amount;
  w.events.push({ type: 'xp', amount });
  while (a.level < MAX_LEVEL && a.xp >= totalXpFor(a.level + 1)) {
    a.level++;
    a.statPoints += STAT_POINTS_PER_LEVEL;
    a.maxHp += 10;
    a.hp = maxHpOf(a);
    a.mana = maxManaOf(a);
    w.events.push({ type: 'levelUp', level: a.level });
  }
}

function onPlayerDeath(w: World, p: Actor): void {
  // XP-Verlust: 5 % der Spanne des aktuellen Levels, nie unter die Level-Schwelle
  const span = totalXpFor(Math.min(p.level + 1, MAX_LEVEL)) - totalXpFor(Math.min(p.level, MAX_LEVEL - 1));
  const floor = totalXpFor(p.level);
  const xpLost = Math.max(0, Math.min(p.xp - floor, Math.floor(span * 0.05)));
  p.xp -= xpLost;
  // 1–3 Items fallen; Rucksack zuerst, Ausgerüstetes nur wenn der Rucksack nicht reicht
  const count = w.rng.int(1, 3);
  const dropped: Item[] = [];
  for (let i = 0; i < count; i++) {
    let pool = p.inventory;
    if (!pool.length) pool = equippedItems(p);
    if (!pool.length) break;
    const it = pool[w.rng.int(0, pool.length - 1)]!;
    dropped.push(it);
    p.inventory = p.inventory.filter((x) => x.id !== it.id);
    for (const s of Object.keys(p.equipment) as Slot[]) if (p.equipment[s]?.id === it.id) delete p.equipment[s];
  }
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  for (const item of dropped) w.ground.push({ id: w.nextId++, x, y, item, expiresAt: w.tick + CORPSE_LOOT_TTL });
  w.events.push({ type: 'deathPenalty', xpLost, dropped });
  // Respawn in der Stadt
  p.x = w.start.x;
  p.y = w.start.y;
  p.alive = true;
  p.hp = maxHpOf(p);
  p.mana = maxManaOf(p);
  p.path = [];
  p.targetId = null;
  p.pickupId = null;
  for (const m of w.actors) if (m.kind === 'monster' && m.targetId === p.id) m.targetId = null;
  w.events.push({ type: 'respawned' });
}

/* ---------- Tick ---------- */

/** Liefert angefallene Ereignisse und leert die Liste. */
export function drainEvents(w: World): GameEvent[] {
  const e = w.events;
  w.events = [];
  return e;
}

export function tick(w: World): void {
  w.tick++;
  w.ground = w.ground.filter((g) => g.expiresAt === null || g.expiresAt > w.tick);
  for (const a of w.actors) {
    if (!a.alive) {
      if (a.kind === 'monster' && w.tick - a.diedAt >= MONSTER_RESPAWN_TICKS && a.home) reviveMonster(a);
      continue;
    }
    if (a.cooldownLeft > 0) a.cooldownLeft--;
    for (const id of Object.keys(a.skillCd)) if ((a.skillCd[id] ?? 0) > 0) a.skillCd[id]!--;
    if (a.kind === 'player') regen(w, a);
    else monsterAi(w, a);
    if (a.kind === 'monster' && a.targetId === null && a.path.length === 0) {
      // Monster regeneriert langsam zu Hause
      a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.002);
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

function regen(w: World, p: Actor): void {
  const safe = inSafeZone(w, p.x, p.y);
  const max = maxHpOf(p);
  p.hp = Math.min(max, p.hp + (safe ? SAFE_REGEN : FIELD_REGEN + (p.attrs.ausdauer - 10) * 0.002));
  const mmax = maxManaOf(p);
  p.mana = Math.min(mmax, p.mana + 0.02 + (p.attrs.willenskraft - 10) * 0.005 + (safe ? 0.2 : 0));
}

function reviveMonster(m: Actor): void {
  m.alive = true;
  m.hp = m.maxHp;
  m.x = m.home!.x;
  m.y = m.home!.y;
  m.targetId = null;
  m.path = [];
  if (m.enraged) {
    m.enraged = false;
    m.damage = monsterKind(m.kindId!).damage;
  }
}

function monsterAi(w: World, m: Actor): void {
  const home = m.home!;
  if (m.targetId === null) {
    const p = w.actors.find(
      (x) => x.kind === 'player' && x.alive && dist(m, x) <= m.aggroRange && !inSafeZone(w, x.x, x.y),
    );
    if (p) m.targetId = p.id;
    return;
  }
  const t = getActor(w, m.targetId);
  const lost = !t || !t.alive || inSafeZone(w, t.x, t.y) || Math.hypot(m.x - home.x, m.y - home.y) > LEASH;
  if (lost) {
    m.targetId = null;
    m.path = findPath(w.grid, { x: Math.round(m.x), y: Math.round(m.y) }, home);
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
