import { Rng } from './rng';
import { findPath, isWalkable, type Grid, type Pt } from './path';
import { rollDrop, rollPotion, rollSpecial, templateById, generateItem, rerollAffixes, extendAffixes, SETS, type Item, type PowerId, type SetBonus, type Slot, type Stat } from './items';
import {
  ATTR_KEYS, MAX_LEVEL, SAFE_REGEN, FIELD_REGEN, START_STAT_POINTS, STAT_POINTS_PER_LEVEL,
  monsterKind, skillById, totalXpFor, SHOPS, ARMOR_K, QUESTS, questById, GEAR_DROP_FACTOR, POTION_DROP_CHANCE, POTION_COOLDOWN_TICKS, type AttrKey,
} from './data';

export const TICK_RATE = 20;
export const NPC_RANGE = 3;
const MELEE_RANGE = 1.5;
const MONSTER_RESPAWN_TICKS = 20 * 45;
const MONSTER_LOOT_TTL = 20 * 180;
const CORPSE_LOOT_TTL = 20 * 300;
const LEASH = 14;
/** Monster schlafen (kein Tick), wenn kein Spieler näher ist als dies */
const SLEEP_DIST = 32;
const REPATH_TICKS = 8;

export type Command =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'attack'; targetId: number }
  | { type: 'pickup'; groundId: number }
  | { type: 'equip'; itemId: number }
  | { type: 'unequip'; slot: Slot }
  | { type: 'drop'; itemId: number }
  | { type: 'usePotion'; itemId: number }
  | { type: 'spendStat'; attr: AttrKey }
  | { type: 'learnSkill'; skillId: string }
  | { type: 'useSkill'; skillId: string; targetId?: number }
  | { type: 'buy'; templateId: string }
  | { type: 'sell'; itemId: number }
  | { type: 'stashPut'; itemId: number }
  | { type: 'stashTake'; itemId: number }
  | { type: 'acceptQuest'; questId: string }
  | { type: 'turnInQuest'; questId: string }
  | { type: 'craft'; itemId: number; op: 'upgrade' | 'reroll' | 'extend' };

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
  potionCd: number;
  quests: Record<string, { state: 'active' | 'done' | 'turned'; progress: number }>;
  inventory: Item[];
  equipment: Partial<Record<Slot, Item>>;
  stash: Item[];
  pickupId: number | null;
  home?: Pt;
  diedAt: number;
  boss: boolean;
  enraged: boolean;
  /** true: verfolgt und schlägt das Ziel automatisch (Nahkampf-Befehl, Monster) */
  autoAttack: boolean;
  /** frühester Tick für die nächste Wegneuberechnung beim Verfolgen */
  repathAt: number;
  /** Gift: Schaden pro Sekunde bis Tick `until` */
  dot: { perSec: number; until: number; srcId: number } | null;
  /** letzter erlittener Treffer (Monster regenerieren erst nach Ruhe) */
  lastHitAt: number;
  /** Spieler: bis zu diesem Tick als Mörder markiert (überall angreifbar) */
  pkUntil: number;
  /** Spieler: zuletzt von diesem Spieler angegriffen (Notwehr-Erkennung) */
  attackedBy: { id: number; at: number } | null;
  /** Monster: Spieler, die Schaden verursacht haben (Tick des letzten Treffers) */
  damagers: Record<number, number>;
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

export type NpcKind = 'trainer' | 'merchant' | 'stash' | 'quest' | 'smith';
export interface Npc {
  id: number;
  kind: NpcKind;
  name: string;
  x: number;
  y: number;
  /** Händler: Sortiment-Schlüssel; Lehrer: Stufe; Questgeber: Quest-IDs */
  shop?: string;
  tier?: number;
  quests?: string[];
}

type GameEventBase =
  | { type: 'hit'; attackerId: number; targetId: number; amount: number; skill?: string; crit?: boolean }
  | { type: 'healed'; amount: number }
  | { type: 'crafted'; item: Item; op: string }
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
  | { type: 'potion'; item: Item }
  | { type: 'questProgress'; questId: string; progress: number; count: number }
  | { type: 'questDone'; questId: string }
  | { type: 'questTurned'; questId: string; xp: number; gold: number }
  | { type: 'enraged'; id: number }
  | { type: 'fail'; reason: string }
  | { type: 'pk'; id: number };

/** `to`: nur für diesen Akteur bestimmt (sonst sichtbar für alle in der Nähe). */
export type GameEvent = GameEventBase & { to?: number };

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
  /** Wiedererwachen nach dem Tod: nächste Stadt */
  towns: Pt[];
  /** Benannte Zonen (nur Anzeige) */
  regions: (Rect & { name: string; levels: string })[];
  /** Spieler dürfen einander außerhalb von Städten angreifen (Server-Einstellung) */
  pvp: boolean;
  /** Akteur des gerade ausgeführten Befehls (für `fail`-Ereignisse) */
  cmdActor: number | null;
}

export function createWorld(seed: number, grid: Grid, safe: Rect[] = []): World {
  return { tick: 0, grid, rng: new Rng(seed), actors: [], nextId: 1, events: [], ground: [], safe, npcs: [], start: { x: 1, y: 1 }, towns: [], regions: [], pvp: false, cmdActor: null };
}

export function addNpc(w: World, kind: NpcKind, name: string, x: number, y: number, extra: Partial<Npc> = {}): Npc {
  const n: Npc = { id: w.nextId++, kind, name, x, y, ...extra };
  w.npcs.push(n);
  return n;
}

function baseActor(w: World, kind: Actor['kind'], name: string, x: number, y: number): Actor {
  const a: Actor = {
    id: w.nextId++, kind, name, x, y, hp: 100, maxHp: 100, damage: [1, 2], speed: 0.1, attackCooldown: 20,
    cooldownLeft: 0, path: [], targetId: null, aggroRange: 0, alive: true, level: 1, xp: 0, statPoints: 0,
    attrs: { kraft: 10, gewandtheit: 10, ausdauer: 10, verstand: 10, willenskraft: 10 },
    mana: 20, gold: 0, skills: [], skillCd: {}, potionCd: 0, quests: {}, inventory: [], equipment: {}, stash: [], pickupId: null,
    diedAt: -1, boss: false, enraged: false, autoAttack: true, repathAt: 0, dot: null, lastHitAt: -9999, pkUntil: 0, attackedBy: null, damagers: {},
  };
  w.actors.push(a);
  return a;
}

export function spawnPlayer(w: World, x: number, y: number, name = 'Held'): Actor {
  const a = baseActor(w, 'player', name, x, y);
  Object.assign(a, { damage: [4, 7] as [number, number], speed: 0.15, attackCooldown: 14, statPoints: START_STAT_POINTS, gold: 20 });
  a.hp = maxHpOf(a);
  a.mana = maxManaOf(a);
  if (w.towns.length === 0) w.start = { x, y };
  return a;
}

/** Neuer Spieler am Startpunkt (erste Stadt); für Mehrspieler. */
export function addPlayer(w: World, name: string): Actor {
  const at = w.towns[0] ?? w.start;
  return spawnPlayer(w, at.x, at.y, name);
}

export function removePlayer(w: World, id: number): void {
  w.actors = w.actors.filter((a) => a.id !== id);
  for (const m of w.actors) {
    if (m.targetId === id) m.targetId = null;
    delete m.damagers[id];
  }
}

export function spawnMonster(w: World, x: number, y: number, kindId = 'field_rat'): Actor {
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

/** Aktive Set-Boni: pro Set zählen alle Bonusstufen bis zur Zahl angelegter Teile. */
export function activeSetBonuses(a: Actor): { name: string; pieces: number; bonuses: [number, SetBonus][] }[] {
  const out: { name: string; pieces: number; bonuses: [number, SetBonus][] }[] = [];
  for (const set of SETS) {
    const n = equippedItems(a).filter((i) => i.setId === set.id).length;
    if (n >= 2) out.push({ name: set.name, pieces: n, bonuses: Object.entries(set.bonuses).filter(([k]) => Number(k) <= n).map(([k, v]) => [Number(k), v] as [number, SetBonus]) });
  }
  return out;
}

function affixSum(a: Actor, stat: Stat): number {
  let sum = 0;
  for (const it of equippedItems(a)) for (const f of it.affixes) if (f.stat === stat) sum += f.value;
  for (const set of activeSetBonuses(a)) for (const [, b] of set.bonuses) for (const f of b.affixes ?? []) if (f.stat === stat) sum += f.value;
  return sum;
}

/** Summe eines besonderen Effekts aus Gegenständen und Set-Boni. */
export function powerOf(a: Actor, id: PowerId): number {
  let sum = 0;
  for (const it of equippedItems(a)) if (it.power?.id === id) sum += it.power.value;
  for (const set of activeSetBonuses(a)) for (const [, b] of set.bonuses) if (b.power?.id === id) sum += b.power.value;
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
  return 20 + (a.attrs.verstand - 10) * 5 + affixSum(a, 'maxMana');
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

/** Darf `a` den Spieler `t` angreifen? (Server-PvP, nicht in Städten, außer das Ziel ist als Mörder markiert) */
export function canPvp(w: World, a: Actor, t: Actor): boolean {
  if (!w.pvp || a.id === t.id || a.kind !== 'player' || t.kind !== 'player' || !a.alive || !t.alive) return false;
  if (inSafeZone(w, a.x, a.y)) return false;
  return !inSafeZone(w, t.x, t.y) || t.pkUntil > w.tick;
}

export function isPk(w: World, a: Actor): boolean {
  return a.pkUntil > w.tick;
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
  w.events.push({ type: 'fail', reason, to: w.cmdActor ?? undefined });
}

export function applyCommand(w: World, actorId: number, cmd: Command): void {
  w.cmdActor = actorId;
  try {
    execCommand(w, actorId, cmd);
  } finally {
    w.cmdActor = null;
  }
}

function execCommand(w: World, actorId: number, cmd: Command): void {
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
      if (t.kind === 'player' && !canPvp(w, a, t)) return fail(w, 'Hier ist kein Kampf gegen Spieler erlaubt.');
      a.targetId = t.id;
      a.autoAttack = true;
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
      if (!it || it.slot === 'potion') return;
      const replaced = a.equipment[it.slot];
      const bonusLost = replaced ? replaced.affixes.filter((f) => f.stat === 'kraft').reduce((n, f) => n + f.value, 0) : 0;
      if (effectiveKraft(a) - bonusLost < it.reqKraft) {
        w.events.push({ type: 'cannotEquip', item: it, reason: `Benötigt Kraft ${it.reqKraft}`, to: a.id });
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
    case 'usePotion': {
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it || it.slot !== 'potion') return;
      if (a.potionCd > 0) return fail(w, 'Du musst kurz warten.');
      const needHp = it.heal !== undefined && a.hp < maxHpOf(a);
      const needMana = it.mana !== undefined && a.mana < maxManaOf(a);
      if (!needHp && !needMana) return fail(w, 'Das brauchst du gerade nicht.');
      if (it.heal) a.hp = Math.min(maxHpOf(a), a.hp + it.heal);
      if (it.mana) a.mana = Math.min(maxManaOf(a), a.mana + it.mana);
      a.inventory = a.inventory.filter((i) => i.id !== it.id);
      a.potionCd = POTION_COOLDOWN_TICKS;
      w.events.push({ type: 'potion', item: it, to: a.id });
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
      const trainer = nearNpc(w, a, 'trainer');
      if (!trainer) return fail(w, 'Kein Lehrer in der Nähe.');
      if ((trainer.tier ?? 1) < s.tier) return fail(w, 'Das lehrt dieser Lehrer nicht.');
      if (a.skills.includes(s.id)) return fail(w, 'Bereits gelernt.');
      if (a.level < s.levelReq) return fail(w, `Benötigt Level ${s.levelReq}.`);
      if (a.gold < s.price) return fail(w, 'Nicht genug Gold.');
      a.gold -= s.price;
      a.skills.push(s.id);
      w.events.push({ type: 'learned', skillId: s.id, to: a.id });
      break;
    }
    case 'useSkill':
      useSkill(w, a, cmd.skillId, cmd.targetId);
      break;
    case 'buy': {
      const merchants = w.npcs.filter((n) => n.kind === 'merchant' && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
      if (!merchants.length) return fail(w, 'Kein Händler in der Nähe.');
      if (!merchants.some((m) => (SHOPS[m.shop ?? 'basic'] ?? []).includes(cmd.templateId))) return fail(w, 'Das führt der Händler nicht.');
      const price = buyPrice(cmd.templateId);
      if (a.gold < price) return fail(w, 'Nicht genug Gold.');
      const item = generateItem(w.rng, w.nextId++, cmd.templateId, 'normal');
      if (carriedWeight(a) + item.weight > carryCapacity(a)) {
        w.events.push({ type: 'tooHeavy', item, to: a.id });
        return;
      }
      a.gold -= price;
      a.inventory.push(item);
      w.events.push({ type: 'pickedUp', item, to: a.id });
      break;
    }
    case 'sell': {
      if (!nearNpc(w, a, 'merchant')) return fail(w, 'Kein Händler in der Nähe.');
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it) return;
      a.inventory = a.inventory.filter((i) => i.id !== it.id);
      const price = sellPrice(it);
      a.gold += price;
      w.events.push({ type: 'gold', amount: price, to: a.id });
      break;
    }
    case 'acceptQuest': {
      const def = questById(cmd.questId);
      const giver = w.npcs.find((n) => n.kind === 'quest' && n.quests?.includes(cmd.questId) && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
      if (!def || !giver) return fail(w, 'Hier gibt es diese Aufgabe nicht.');
      if (a.quests[def.id]) return fail(w, 'Aufgabe bereits angenommen.');
      if (a.level < def.minLevel) return fail(w, `Benötigt Level ${def.minLevel}.`);
      a.quests[def.id] = { state: 'active', progress: 0 };
      break;
    }
    case 'turnInQuest': {
      const def = questById(cmd.questId);
      const st = a.quests[cmd.questId];
      const giver = w.npcs.find((n) => n.kind === 'quest' && n.quests?.includes(cmd.questId) && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
      if (!def || !st || !giver) return fail(w, 'Hier gibt es nichts abzugeben.');
      if (st.state !== 'done') return fail(w, 'Aufgabe noch nicht erfüllt.');
      st.state = 'turned';
      a.gold += def.gold;
      w.events.push({ type: 'questTurned', questId: def.id, xp: def.xp, gold: def.gold, to: a.id });
      gainXp(w, a, def.xp);
      break;
    }
    case 'craft': {
      if (!nearNpc(w, a, 'smith')) return fail(w, 'Kein Schmied in der Nähe.');
      if (cmd.op !== 'upgrade' && cmd.op !== 'reroll' && cmd.op !== 'extend') return fail(w, 'Unbekannte Schmiedearbeit.');
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it || it.slot === 'potion') return;
      if (it.rarity === 'legendary' || it.rarity === 'set') return fail(w, 'Das lässt sich nicht verändern.');
      const cost = craftCost(it, cmd.op);
      if (cmd.op === 'upgrade' && it.rarity === 'rare') return fail(w, 'Bereits selten.');
      if (cmd.op === 'reroll' && it.rarity === 'normal') return fail(w, 'Normale Gegenstände haben keine Affixe.');
      if (cmd.op === 'extend' && (it.rarity !== 'rare' || it.affixes.length >= 5)) return fail(w, 'Nur seltene Gegenstände mit weniger als 5 Affixen.');
      if (a.gold < cost) return fail(w, 'Nicht genug Gold.');
      a.gold -= cost;
      if (cmd.op === 'upgrade') {
        if (it.rarity === 'normal') rerollAffixes(w.rng, it, 'magic', w.rng.int(1, 2));
        else rerollAffixes(w.rng, it, 'rare', w.rng.int(3, 4));
      } else if (cmd.op === 'reroll') rerollAffixes(w.rng, it, it.rarity, it.affixes.length);
      else extendAffixes(w.rng, it);
      w.events.push({ type: 'crafted', item: it, op: cmd.op, to: a.id });
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
        w.events.push({ type: 'tooHeavy', item: it, to: a.id });
        return;
      }
      a.stash = a.stash.filter((i) => i.id !== it.id);
      a.inventory.push(it);
      break;
    }
  }
}

export function craftCost(item: Item, op: 'upgrade' | 'reroll' | 'extend'): number {
  if (op === 'upgrade') return Math.round(item.rarity === 'normal' ? 30 + item.value : 80 + item.value * 1.5);
  if (op === 'reroll') return Math.round(20 + item.value * 0.4);
  return Math.round(120 + item.value * 1.2);
}

function useSkill(w: World, a: Actor, skillId: string, targetId?: number): void {
  const s = skillById(skillId);
  if (!s || !a.skills.includes(s.id)) return fail(w, 'Fertigkeit nicht gelernt.');
  if ((a.skillCd[s.id] ?? 0) > 0) return;
  if (a.mana < s.mana) return fail(w, 'Nicht genug Mana.');
  const lvl = 1 + a.level * 0.1;
  if (s.heal !== undefined) {
    const scale = s.scales ? Math.max(0, a.attrs[s.scales] - 10) * 3 : 0;
    const amount = Math.round((s.heal + scale) * lvl);
    a.mana -= s.mana;
    a.skillCd[s.id] = s.cooldown;
    const before = a.hp;
    a.hp = Math.min(maxHpOf(a), a.hp + amount);
    w.events.push({ type: 'healed', amount: Math.round(a.hp - before), to: a.id });
    return;
  }
  if (a.kind === 'player' && inSafeZone(w, a.x, a.y)) return fail(w, 'In der Stadt ist Kämpfen verboten.');
  const first = getActor(w, targetId ?? a.targetId ?? -1);
  if (!s.aoeSelf && (!first || !first.alive || first.id === a.id)) return fail(w, 'Kein Ziel.');
  const range = s.range;
  if (first && !s.aoeSelf && Math.hypot(a.x - first.x, a.y - first.y) > range) return fail(w, 'Ziel außer Reichweite.');
  if (first && first.kind === 'player' && !canPvp(w, a, first)) return fail(w, 'Hier ist kein Kampf gegen Spieler erlaubt.');
  const enemy = (x: Actor) => x.alive && x.id !== a.id && (x.kind !== a.kind || canPvp(w, a, x));
  let victims: Actor[];
  if (s.aoeSelf) victims = w.actors.filter((x) => enemy(x) && Math.hypot(x.x - a.x, x.y - a.y) <= s.aoe!);
  else if (s.aoe) victims = w.actors.filter((x) => enemy(x) && Math.hypot(x.x - first!.x, x.y - first!.y) <= s.aoe!);
  else if (s.targets) {
    victims = [first!, ...w.actors.filter((x) => enemy(x) && x.id !== first!.id && Math.hypot(x.x - a.x, x.y - a.y) <= range).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))].slice(0, s.targets);
  } else victims = [first!];
  if (!victims.length) return fail(w, 'Kein Ziel.');
  a.mana -= s.mana;
  a.skillCd[s.id] = s.cooldown;
  // Fern-/Magie-Skills lösen keine Nahkampf-Verfolgung aus; Nahkampf-Skills schon
  if (first) {
    if (s.mult) a.autoAttack = true;
    else if (a.targetId !== first.id) a.autoAttack = false;
    a.targetId = first.id;
  }
  a.path = [];
  for (const v of victims) {
    let amount: number;
    if (s.mult) {
      const [lo, hi] = damageRange(a);
      amount = Math.round(w.rng.int(lo, hi) * s.mult);
    } else {
      const [lo, hi] = s.base!;
      const scale = s.scales ? Math.max(0, a.attrs[s.scales] - 10) * (1 + a.level * 0.08) : 0;
      amount = Math.round(w.rng.int(lo, hi) * lvl + scale);
    }
    dealDamage(w, a, v, amount, s.ignoresArmor, s.id);
    if (s.dot && v.alive) v.dot = { perSec: Math.max(1, Math.round((amount * s.dot.factor) / s.dot.seconds)), until: w.tick + s.dot.seconds * TICK_RATE, srcId: a.id };
  }
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
  const stale = !last || Math.abs(last.x - goal.x) + Math.abs(last.y - goal.y) > 1;
  if (stale && (w.tick >= a.repathAt || a.path.length === 0)) {
    a.repathAt = w.tick + REPATH_TICKS;
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
  if (a.kind === 'player' && inSafeZone(w, a.x, a.y)) return;
  a.cooldownLeft = attackCooldownOf(a);
  const [lo, hi] = damageRange(a);
  dealDamage(w, a, t, w.rng.int(lo, hi), false);
}

function dealDamage(w: World, a: Actor, t: Actor, rawIn: number, ignoreArmor: boolean, skill?: string, noReflect = false): void {
  if (t.kind === 'player' && inSafeZone(w, t.x, t.y) && t.pkUntil <= w.tick) return;
  let raw = rawIn;
  let crit = false;
  if (a.kind === 'player' && !noReflect) {
    const chance = powerOf(a, 'crit');
    if (chance > 0 && w.rng.next() * 100 < chance) {
      raw *= 2;
      crit = true;
    }
  }
  const amount = Math.max(1, Math.round(ignoreArmor ? raw : (raw * ARMOR_K) / (ARMOR_K + armorOf(t))));
  t.hp = Math.max(0, t.hp - amount);
  t.lastHitAt = w.tick;
  // Wer angegriffen wird, wehrt sich (auch gegen Fernkämpfer außerhalb der Aggro-Reichweite)
  if (t.kind === 'monster' && a.kind === 'player' && t.alive && t.targetId === null) {
    t.targetId = a.id;
    t.autoAttack = true;
  }
  w.events.push({ type: 'hit', attackerId: a.id, targetId: t.id, amount, skill, crit });
  if (a.kind === 'player' && t.kind === 'monster') t.damagers[a.id] = w.tick;
  if (a.kind === 'player' && t.kind === 'player') {
    // Angriff auf einen Unbeteiligten macht zum Mörder; Notwehr (Gegenschlag auf den Angreifer) nicht
    const selfDefense = a.attackedBy?.id === t.id && w.tick - a.attackedBy.at < TICK_RATE * 10;
    if (!selfDefense && t.pkUntil <= w.tick && a.pkUntil <= w.tick) {
      a.pkUntil = w.tick + TICK_RATE * 60 * 10;
      w.events.push({ type: 'pk', id: a.id });
    } else if (!selfDefense && a.pkUntil > w.tick) a.pkUntil = w.tick + TICK_RATE * 60 * 10;
    t.attackedBy = { id: a.id, at: w.tick };
  }
  if (a.kind === 'player' && a.alive && !noReflect) {
    const steal = powerOf(a, 'lifesteal');
    if (steal > 0) a.hp = Math.min(maxHpOf(a), a.hp + Math.max(1, Math.round((amount * steal) / 100)));
  }
  if (t.kind === 'player' && !noReflect && a.alive && a.kind === 'monster') {
    const th = powerOf(t, 'thorns');
    if (th > 0) dealDamage(w, t, a, Math.max(1, Math.round((amount * th) / 100)), true, undefined, true);
  }
  if (t.boss && !t.enraged && t.hp > 0 && t.hp < t.maxHp * 0.3) {
    t.enraged = true;
    t.damage = [Math.round(t.damage[0] * 1.5), Math.round(t.damage[1] * 1.5)];
    w.events.push({ type: 'enraged', id: t.id });
  }
  if (t.hp > 0) return;
  t.alive = false;
  t.path = [];
  t.targetId = null;
  t.dot = null;
  t.diedAt = w.tick;
  w.events.push({ type: 'died', id: t.id });
  if (t.kind === 'monster') onMonsterDeath(w, a, t);
  else onPlayerDeath(w, t);
}

function onMonsterDeath(w: World, killer: Actor, m: Actor): void {
  const k = monsterKind(m.kindId!);
  // Alle Spieler, die zuletzt (30 s) Schaden gemacht haben und in der Nähe sind, bekommen XP, Gold und Questfortschritt
  const credited = new Map<number, Actor>();
  if (killer.kind === 'player') credited.set(killer.id, killer);
  for (const [id, at] of Object.entries(m.damagers)) {
    const pl = getActor(w, Number(id));
    if (pl && pl.alive && w.tick - at <= TICK_RATE * 30 && Math.hypot(pl.x - m.x, pl.y - m.y) <= 25) credited.set(pl.id, pl);
  }
  for (const pl of credited.values()) {
    for (const q of QUESTS) {
      const st = pl.quests[q.id];
      if (st?.state === 'active' && q.target === m.kindId) {
        st.progress++;
        w.events.push({ type: 'questProgress', questId: q.id, progress: st.progress, count: q.count, to: pl.id });
        if (st.progress >= q.count) {
          st.state = 'done';
          w.events.push({ type: 'questDone', questId: q.id, to: pl.id });
        }
      }
    }
    gainXp(w, killer, Math.round(k.xp * (1 + powerOf(pl, 'xpBonus') / 100)));
    const mk = powerOf(pl, 'manaKill');
    if (mk > 0) pl.mana = Math.min(maxManaOf(killer), pl.mana + mk);
    const gold = Math.round(w.rng.int(k.gold[0], k.gold[1]) * (1 + powerOf(pl, 'goldBonus') / 100));
    pl.gold += gold;
    w.events.push({ type: 'gold', amount: gold, to: pl.id });
  }
  const x = Math.round(m.x);
  const y = Math.round(m.y);
  const drop = (item: Item) => {
    w.ground.push({ id: w.nextId++, x, y, item, expiresAt: w.tick + MONSTER_LOOT_TTL });
    w.events.push({ type: 'loot', item, x, y });
  };
  if (k.boss || w.rng.next() <= k.dropChance * GEAR_DROP_FACTOR) {
    drop(rollDrop(w.rng, () => w.nextId++, k.level, k.boss ? 'rare' : undefined));
  }
  if (w.rng.next() <= POTION_DROP_CHANCE) drop(rollPotion(w.rng, () => w.nextId++, k.level));
  const special = rollSpecial(w.rng, () => w.nextId++, k.level, k.id, !!k.boss);
  if (special) drop(special);
}

export function gainXp(w: World, a: Actor, amount: number): void {
  a.xp += amount;
  w.events.push({ type: 'xp', amount, to: a.id });
  while (a.level < MAX_LEVEL && a.xp >= totalXpFor(a.level + 1)) {
    a.level++;
    a.statPoints += STAT_POINTS_PER_LEVEL;
    a.maxHp += 10;
    a.hp = maxHpOf(a);
    a.mana = maxManaOf(a);
    w.events.push({ type: 'levelUp', level: a.level, to: a.id });
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
  w.events.push({ type: 'deathPenalty', xpLost, dropped, to: p.id });
  // Respawn in der Stadt
  const town = w.towns.length
    ? w.towns.reduce((best, t) => (Math.hypot(t.x - p.x, t.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? t : best))
    : w.start;
  p.x = town.x;
  p.y = town.y;
  p.alive = true;
  p.hp = maxHpOf(p);
  p.mana = maxManaOf(p);
  p.path = [];
  p.targetId = null;
  p.pickupId = null;
  for (const m of w.actors) if (m.kind === 'monster' && m.targetId === p.id) m.targetId = null;
  w.events.push({ type: 'respawned', to: p.id });
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
  const players = w.actors.filter((x) => x.kind === 'player' && x.alive);
  for (const a of w.actors) {
    if (a.kind === 'monster' && a.alive && a.targetId === null && a.path.length === 0 && a.hp >= a.maxHp) {
      if (!players.some((pl) => Math.abs(pl.x - a.x) < SLEEP_DIST && Math.abs(pl.y - a.y) < SLEEP_DIST)) continue;
    }
    if (!a.alive) {
      if (a.kind === 'monster' && w.tick - a.diedAt >= MONSTER_RESPAWN_TICKS && a.home) reviveMonster(a);
      continue;
    }
    if (a.cooldownLeft > 0) a.cooldownLeft--;
    if (a.potionCd > 0) a.potionCd--;
    if (a.dot) {
      if (w.tick % TICK_RATE === 0) {
        const src = getActor(w, a.dot.srcId) ?? a;
        const d = a.dot;
        if (w.tick >= d.until) a.dot = null;
        dealDamage(w, src, a, d.perSec, true, 'poison_shot');
        if (!a.alive) continue;
      } else if (w.tick >= a.dot.until) a.dot = null;
    }
    for (const id of Object.keys(a.skillCd)) if ((a.skillCd[id] ?? 0) > 0) a.skillCd[id]!--;
    if (a.kind === 'player') regen(w, a);
    else monsterAi(w, a);
    if (a.kind === 'monster' && a.targetId === null && a.path.length === 0 && w.tick - a.lastHitAt > TICK_RATE * 6) {
      // Monster regeneriert langsam zu Hause
      a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.002);
    }

    const t = a.targetId === null ? undefined : getActor(w, a.targetId);
    if (t && t.kind === 'player' && a.kind === 'player' && !canPvp(w, a, t)) {
      a.targetId = null;
      a.path = [];
    } else if (a.targetId !== null && (!t || !t.alive)) {
      a.targetId = null;
      a.path = [];
    }
    if (t && t.alive && a.autoAttack && a.targetId !== null) {
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
  m.dot = null;
  m.damagers = {};
  if (m.enraged) {
    m.enraged = false;
    m.damage = monsterKind(m.kindId!).damage;
  }
}

function monsterAi(w: World, m: Actor): void {
  const home = m.home!;
  if (m.targetId === null) {
    let best: Actor | undefined;
    let bd = m.aggroRange;
    for (const x of w.actors) {
      if (x.kind !== 'player' || !x.alive || (inSafeZone(w, x.x, x.y) && x.pkUntil <= w.tick)) continue;
      const d = dist(m, x);
      if (d <= bd) {
        bd = d;
        best = x;
      }
    }
    if (best) m.targetId = best.id;
    return;
  }
  const t = getActor(w, m.targetId);
  const lost = !t || !t.alive || (inSafeZone(w, t.x, t.y) && t.pkUntil <= w.tick) || Math.hypot(m.x - home.x, m.y - home.y) > LEASH;
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
    w.events.push({ type: 'tooHeavy', item: g.item, to: a.id });
    return;
  }
  w.ground = w.ground.filter((x) => x.id !== g.id);
  a.inventory.push(g.item);
  w.events.push({ type: 'pickedUp', item: g.item, to: a.id });
}
