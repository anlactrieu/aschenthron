import { Rng } from './rng';
import { findPath, isWalkable, type Grid, type Pt } from './path';
import { itemReq, itemAffixes, gemTemplateId, handsOf, weaponSpeedOf, rollGem, rollUniqueSpecial, rollWorldDrop, rollWorldSpecial, rollDrop, rollPotion, rollSpecial, templateById, generateItem, rerollAffixes, extendAffixes, SETS, type GemInfo, type Item, type PowerId, type SetBonus, type EquipSlot, type Stat } from './items';
import {
  ATTR_KEYS, MAX_LEVEL, MAX_SKILL_RANK, SKILL_POINTS_PER_LEVEL, SKILL_POINTS_START, rankCooldown, rankDamage, rankLevelReq, rankMana, rankPrice, respecPrice, SAFE_REGEN, FIELD_REGEN, START_STAT_POINTS, STAT_POINTS_PER_LEVEL,
  monsterKind, npcKeyOf, CHAMPION_MODS, CHAMPION_REWARD, UNIQUE_REWARD, uniqueDef, type Ability, skillById, totalXpFor, SHOPS, ARMOR_K, QUESTS, questById, GEAR_DROP_FACTOR, POTION_DROP_CHANCE, POTION_COOLDOWN_TICKS, type AttrKey,
  FAMILY_RES, MELEE_SKILL_KRAFT_SCALE, MAX_RES, SLOW_FACTOR, STATUS_IDS, PASSIVE_CAP, DMG_NAME, type DmgType, type StatusId, type SkillDef, type PassiveKey,
  ATTR_THRESHOLD, ATTR_THRESHOLD_BONUS, WILL_RES_PER_2, WILL_STATUS_PER_POINT, WILL_STATUS_CAP, GEM_MIN_LEVEL, GEM_DROP, GEM_SOCKET_COST, WORLD_BOSS_LOOT, type QuestDef,
} from './data';
import { EFFECTS, cleanse, controlDr, dispel, mergeStatus } from './effects';

export const TICK_RATE = 20;
export const NPC_RANGE = 3;
/** Startgold reicht genau für eine Wahl: Bogen-Set (Bogen, Holzpfeile, Schnellschuss) oder Schwert plus etwas Rüstung. */
export const START_GOLD = 100;
const MELEE_RANGE = 1.5;
/** Zaubernde Monster halten diesen Abstand und schießen aus bis zu CAST_RANGE Feldern. */
const CAST_RANGE = 6;
const CAST_KEEP = 2.5;
/** Bogenschützen schießen den normalen Angriff aus bis zu BOW_RANGE Feldern, statt in den Nahkampf zu laufen. */
const BOW_RANGE = 9;
/** Monster-Schützen: Reichweite und Mindestabstand */
const ARCHER_RANGE = 7;
const ARCHER_KEEP = 3.5;
/** Heiler: Radius, Pause (Sekunden), Anteil der Lebenspunkte; Beschwörer: Pause und Höchstzahl */
const HEAL_RANGE = 6;
const HEAL_EVERY = 4;
const HEAL_FRACTION = 0.12;
const RAISE_EVERY = 12;
const RAISE_MAX = 3;
const RES_STAT = { fire: 'resFire', frost: 'resFrost', poison: 'resPoison' } as const;
const MONSTER_RESPAWN_TICKS = 20 * 45;
const MONSTER_LOOT_TTL = 20 * 180;
const CORPSE_LOOT_TTL = 20 * 300;
const LEASH = 14;
/** Rudel-Alarm: nur Rudelmitglieder in diesem Umkreis (Felder) eilen dem Angegriffenen zu Hilfe (kleiner = Lager lassen sich einzeln abziehen) */
const NOTE_DEBOUNCE = 100;
const PACK_ALERT_RANGE = 8;
/** Rudel-Patrouille: Umkreis um den Rudelplatz (Felder), Tempo gegenüber normalem Gehen, Verweilzeit an einem Wegpunkt (Ticks) */
const PATROL_RADIUS = 5;
const PATROL_SPEED = 0.55;
const PATROL_DWELL = [TICK_RATE * 6, TICK_RATE * 14] as const;
const NPC_WANDER_SPEED = 0.04;
/** Monster schlafen (kein Tick), wenn kein Spieler näher ist als dies */
const SLEEP_DIST = 32;
const REPATH_TICKS = 8;

export type Command =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'attack'; targetId: number }
  | { type: 'pickup'; groundId: number }
  | { type: 'equip'; itemId: number; to?: 'ring' | 'ring2' }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'drop'; itemId: number }
  | { type: 'usePotion'; itemId: number }
  | { type: 'spendStat'; attr: AttrKey }
  | { type: 'learnSkill'; skillId: string }
  | { type: 'trainSkill'; skillId: string }
  | { type: 'respec' }
  | { type: 'rest' }
  | { type: 'useSkill'; skillId: string; targetId?: number }
  | { type: 'buy'; templateId: string }
  | { type: 'sell'; itemId: number }
  | { type: 'sellBulk'; upTo: 'normal' | 'magic' | 'rare' }
  | { type: 'stashPut'; itemId: number }
  | { type: 'stashTake'; itemId: number }
  | { type: 'openChest'; chestId: number }
  | { type: 'acceptQuest'; questId: string }
  | { type: 'turnInQuest'; questId: string }
  | { type: 'talk'; npcId: number }
  | { type: 'craft'; itemId: number; op: 'upgrade' | 'reroll' | 'extend' }
  | { type: 'socket'; gemId: number; itemId: number; index?: number };

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
  /** Rang je gelerntem Skill (1–5) */
  skillRanks: Record<string, number>;
  skillPoints: number;
  skillCd: Record<string, number>;
  potionCd: number;
  quests: Record<string, { state: 'active' | 'done' | 'turned'; progress: number }>;
  inventory: Item[];
  equipment: Partial<Record<EquipSlot, Item>>;
  stash: Item[];
  pickupId: number | null;
  chestId: number | null;
  /** Ticks, in denen der Verfolgungspfad zum Ziel leer blieb (Ziel unerreichbar) */
  stuck: number;
  /** rastet: Leben und Mana füllen sich schneller, jede Aktion oder jeder Treffer beendet es */
  resting: boolean;
  home?: Pt;
  /** Rudel-Patrouille: letzter Wegpunkt-Schritt des Rudels, dem dieses Mitglied gefolgt ist; Versatz zum Rudelmittelpunkt; läuft gerade gemächlich */
  patrolSeq?: number;
  patrolOff?: Pt;
  patrolling?: boolean;
  diedAt: number;
  boss: boolean;
  enraged: boolean;
  /** true: verfolgt und schlägt das Ziel automatisch (Nahkampf-Befehl, Monster) */
  autoAttack: boolean;
  /** frühester Tick für die nächste Wegneuberechnung beim Verfolgen */
  repathAt: number;
  /** Gift: Schaden pro Sekunde bis Tick `until` */
  dot: { perSec: number; until: number; srcId: number } | null;
  /** Statuseffekte: Ende (Tick) je Effekt; Brand-Schaden pro Sekunde und Verursacher in `burn` */
  status: Partial<Record<StatusId, number>>;
  /** Stärke eines Effekts (nur Effekte mit Stärke, z. B. Schutz; optional, wird nicht gespeichert) */
  statusMag?: Partial<Record<StatusId, number>>;
  /** Spieler: ein kostenloses Neuverteilen offen (einmalig nach dem Skill-Update, wird gespeichert) */
  freeRespec?: boolean;
  /** Monster: frühester Tick für den nächsten Schutz-/Bannzauber */
  buffAt?: number;
  /** Kontroll-Verkürzung: letzter Treffer und Wiederholungszähler je Effekt */
  ccDr?: Partial<Record<StatusId, { at: number; n: number }>>;
  burn: { perSec: number; srcId: number } | null;
  /** Schadensart der normalen Angriffe (Monster) */
  dmgType: DmgType;
  healAt: number;
  raiseAt: number;
  /** letzter erlittener Treffer (Monster regenerieren erst nach Ruhe) */
  lastHitAt: number;
  /** Rudel-Kennung (0 = Einzelgänger): Rudelmitglieder greifen gemeinsam an */
  packId: number;
  /** Champion-Modifikator und Mini-Boss-Kennung */
  champ?: string;
  unique?: string;
  abilities: Ability[];
  summonKind?: string;
  abilityAt: number;
  chargeAt: number;
  chargeUntil: number;
  summoned: boolean;
  /** Beschworener Helfer: Kennung des Beschwörers (wird beim Wiedererscheinen des Bosses entfernt) */
  summonedBy?: number;
  /** Wartezeit bis zum Wiedererscheinen (Ticks) */
  respawnTicks: number;
  /** Faktor auf XP, Gold und Beute */
  rewardMult: number;
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

export interface Chest {
  id: number;
  x: number;
  y: number;
  /** Stufe der Gegend: bestimmt Beute */
  level: number;
  tier: 'wood' | 'iron' | 'gold';
  opened: boolean;
  respawnAt: number;
}

export type NpcKind = 'trainer' | 'merchant' | 'stash' | 'quest' | 'smith';
/** Fachgebiet eines Lehrers: Magie (Zauber) oder Kampf (Nahkampf, Fernkampf, Überleben). Ohne Angabe lehrt er alles. */
export type TrainerField = 'Kampf' | 'Magie';
export interface Npc {
  id: number;
  kind: NpcKind;
  name: string;
  x: number;
  y: number;
  /** Händler: Sortiment-Schlüssel; Lehrer: Stufe; Questgeber: Quest-IDs */
  shop?: string;
  tier?: number;
  /** Lehrer: Fachgebiet (ohne Angabe: alle) */
  field?: TrainerField;
  quests?: string[];
  /** Schlendert in diesem Umkreis (Felder) um `home`, solange niemand in der Nähe ist (nur wenn `World.npcWander`) */
  wander?: number;
  home?: Pt;
  path?: Pt[];
  nextMoveAt?: number;
}

type GameEventBase =
  | { type: 'hit'; attackerId: number; targetId: number; amount: number; skill?: string; crit?: boolean; dt?: DmgType }
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
  | { type: 'learned'; skillId: string; rank?: number }
  | { type: 'deathPenalty'; xpLost: number; dropped: Item[] }
  | { type: 'respawned' }
  | { type: 'potion'; item: Item }
  | { type: 'questProgress'; questId: string; progress: number; count: number }
  | { type: 'questDone'; questId: string }
  | { type: 'questTurned'; questId: string; xp: number; gold: number; item?: Item }
  | { type: 'questItem'; questId: string; item: string; progress: number; count: number }
  | { type: 'talk'; npcId: number }
  | { type: 'worldBoss'; id: number; name: string; state: 'spawn' | 'dead'; where: string }
  | { type: 'enraged'; id: number }
  | { type: 'fail'; reason: string }
  | { type: 'pk'; id: number }
  | { type: 'chestOpened'; chestId: number }
  | { type: 'miss'; attackerId: number; targetId: number }
  | { type: 'telegraph'; x: number; y: number; r: number; ms: number }
  | { type: 'summon'; id: number }
  | { type: 'mheal'; id: number; targetId: number; amount: number }
  | { type: 'charge'; id: number }
  | { type: 'respecced' }
  /** Erklärung einer Regelwirkung (Resistenz, Immunität, Bannung …) für das Kampflog; immer an einen Spieler gerichtet (`to`) */
  | { type: 'note'; text: string };

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
  chests: Chest[];
  telegraphs: { id: number; x: number; y: number; r: number; at: number; dmg: number; src: number }[];
  /** Akteur des gerade ausgeführten Befehls (für `fail`-Ereignisse) */
  cmdActor: number | null;
  /** Kampflog-Entprellung: letzter Tick je Empfänger und Text (nur Laufzeit) */
  noteSeen?: Map<string, number>;
  /** Patrouillen der Rudel (Schlüssel: Rudel-Id); nur Darstellung des Verhaltens, eigener Zufallsstrom `fx` */
  packs: Map<number, PackPatrol>;
  /** Stadt-NPCs dürfen schlendern (nur Einzelspieler; online kennen Clients die NPC-Positionen nur am Heimatplatz) */
  npcWander: boolean;
  fx: Rng;
}

export interface PackPatrol {
  pts: Pt[];
  idx: number;
  dir: 1 | -1;
  seq: number;
  nextAt: number;
  seen: number;
}

export function createWorld(seed: number, grid: Grid, safe: Rect[] = []): World {
  return { tick: 0, grid, rng: new Rng(seed), actors: [], nextId: 1, events: [], ground: [], safe, npcs: [], start: { x: 1, y: 1 }, towns: [], regions: [], pvp: false, chests: [], telegraphs: [], cmdActor: null, packs: new Map(), npcWander: false, fx: new Rng((seed ^ 0x9e3779b9) >>> 0) };
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
    mana: 20, gold: 0, skills: [], skillRanks: {}, skillPoints: 0, skillCd: {}, potionCd: 0, quests: {}, inventory: [], equipment: {}, stash: [], pickupId: null, chestId: null, resting: false, stuck: 0,
    diedAt: -1, boss: false, enraged: false, autoAttack: true, repathAt: 0, dot: null, status: {}, burn: null, dmgType: 'physical', healAt: 0, raiseAt: 0, lastHitAt: -9999, packId: 0, abilities: [], abilityAt: 0, chargeAt: 0, chargeUntil: 0, summoned: false, respawnTicks: MONSTER_RESPAWN_TICKS, rewardMult: 1, pkUntil: 0, attackedBy: null, damagers: {},
  };
  w.actors.push(a);
  return a;
}

export function spawnPlayer(w: World, x: number, y: number, name = 'Held'): Actor {
  const a = baseActor(w, 'player', name, x, y);
  Object.assign(a, { damage: [4, 7] as [number, number], speed: 0.15, attackCooldown: 14, statPoints: START_STAT_POINTS, gold: START_GOLD, skillPoints: SKILL_POINTS_START, freeRespec: false });
  a.hp = maxHpOf(a);
  a.mana = maxManaOf(a);
  if (w.towns.length === 0) w.start = { x, y };
  return a;
}

/** Startausrüstung für frische Charaktere: drei kleine Heiltränke gegen frühe Tode (Spielstände überschreiben das Inventar). */
export function giveStarterKit(w: World, p: Actor): void {
  for (let i = 0; i < 3; i++) p.inventory.push(generateItem(w.rng, w.nextId++, 'heal_small', 'normal'));
}

/** Neuer Spieler am Startpunkt (erste Stadt); für Mehrspieler. */
export function addPlayer(w: World, name: string): Actor {
  const at = w.towns[0] ?? w.start;
  const p = spawnPlayer(w, at.x, at.y, name);
  giveStarterKit(w, p);
  return p;
}

export function removePlayer(w: World, id: number): void {
  w.actors = w.actors.filter((a) => a.id !== id);
  for (const m of w.actors) {
    if (m.targetId === id) m.targetId = null;
    delete m.damagers[id];
  }
}

export function spawnMonster(w: World, x: number, y: number, kindId = 'field_rat', opts: { champ?: string; unique?: string } = {}): Actor {
  const k = monsterKind(kindId);
  const a = baseActor(w, 'monster', k.name, x, y);
  Object.assign(a, {
    kindId, level: k.level, hp: k.hp, maxHp: k.hp, damage: k.damage, speed: k.speed,
    attackCooldown: k.attackCooldown, aggroRange: k.aggroRange, home: { x, y }, boss: !!k.boss,
    abilities: [...(k.abilities ?? [])], summonKind: k.summonKind, dmgType: k.dmgType ?? 'physical',
  });
  const scaleDmg = (m: number) => {
    a.damage = [Math.max(1, Math.round(a.damage[0] * m)), Math.max(2, Math.round(a.damage[1] * m))];
  };
  const mod = opts.champ ? CHAMPION_MODS[opts.champ] : undefined;
  if (mod && opts.champ) {
    a.champ = opts.champ;
    a.name = `${mod.name} ${k.name}`;
    a.maxHp = a.hp = Math.round(k.hp * mod.hp);
    scaleDmg(mod.dmg);
    a.speed = k.speed * mod.speed;
    a.attackCooldown = Math.round(k.attackCooldown / Math.sqrt(mod.speed));
    a.rewardMult = CHAMPION_REWARD;
    if (opts.champ === 'fiery') a.dmgType = 'fire';
  }
  const u = opts.unique ? uniqueDef(opts.unique) : undefined;
  if (u) {
    a.unique = u.id;
    a.name = u.name;
    a.maxHp = a.hp = Math.round(k.hp * u.hp);
    scaleDmg(u.dmg);
    a.abilities = [...u.abilities];
    a.summonKind = u.summon;
    a.rewardMult = UNIQUE_REWARD;
    a.respawnTicks = TICK_RATE * 60 * u.respawnMin;
    a.aggroRange = u.world ? Math.min(a.aggroRange, 6) : Math.max(a.aggroRange, 7);
  }
  return a;
}

/* ---------- abgeleitete Werte ---------- */

/** Obergrenzen für gestapelte Boni (Balance) */
export const MAX_CRIT_PERCENT = 50;
export const MAX_REGEN_PER_SEC = 10;

export const BASE_CARRY = 30;
export const CARRY_PER_KRAFT = 2;

/** Zielfeld beim Anlegen: Ringe füllen erst das freie Feld, sonst ersetzt der erste Ring (oder das gewünschte Feld). */
export function equipSlotFor(a: Actor, it: Item, to?: 'ring' | 'ring2'): EquipSlot {
  if (it.slot !== 'ring') return it.slot === 'potion' || it.slot === 'gem' ? 'weapon' : it.slot;
  if (to) return to;
  return a.equipment.ring && !a.equipment.ring2 ? 'ring2' : 'ring';
}

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

/** Schwellenbonus eines Attributs in Prozent (ab ATTR_THRESHOLD, sonst 0). */
export function attrBonus(a: Actor, k: AttrKey): number {
  return a.attrs[k] >= ATTR_THRESHOLD ? ATTR_THRESHOLD_BONUS[k].pct : 0;
}

function affixSum(a: Actor, stat: Stat): number {
  let sum = 0;
  for (const it of equippedItems(a)) for (const f of itemAffixes(it)) if (f.stat === stat) sum += f.value;
  for (const set of activeSetBonuses(a)) for (const [, b] of set.bonuses) for (const f of b.affixes ?? []) if (f.stat === stat) sum += f.value;
  return sum;
}

/** Summe eines Item-Werts über Ausrüstung, Sockel und Set-Boni (für die Anzeige und das Buildprofil). */
export function gearStat(a: Actor, stat: Stat): number {
  return affixSum(a, stat);
}

/** Summe einer passiven Skill-Wirkung (Wert je Rang mal Rang, gedeckelt durch `PASSIVE_CAP`). */
export function passiveSum(a: Actor, key: PassiveKey): number {
  let sum = 0;
  for (const id of a.skills) {
    const s = skillById(id);
    const v = s?.pass?.[key];
    if (v) sum += v * (a.skillRanks[id] ?? 1);
  }
  const cap = PASSIVE_CAP[key];
  return cap !== undefined ? Math.min(cap, sum) : sum;
}

/** Paradechance in Prozent: Skill (gedeckelt) plus Gegenstände, insgesamt höchstens 25. */
export function parryChance(a: Actor): number {
  return Math.min(25, passiveSum(a, 'parry') + affixSum(a, 'parry'));
}

/** Wirkt Parieren? Einhandwaffe (kein Bogen/Stab) oder Schild nötig. */
function canParry(a: Actor): boolean {
  const wp = a.equipment.weapon;
  if (a.equipment.offhand?.off === 'shield') return true;
  return !!wp && wp.kind !== 'bow' && wp.kind !== 'staff' && handsOf(wp) === 1;
}

/** Resistenz in Prozent gegen eine Schadensart: Spieler über Affixe (höchstens 75), Monster über ihre Familie (negativ = Schwäche, 100 = immun). */
export function resistOf(a: Actor, dt: DmgType): number {
  if (dt === 'physical') return 0;
  const ward = a.status.ward ? (a.statusMag?.ward ?? 0) : 0;
  if (a.kind === 'player') return Math.min(MAX_RES, affixSum(a, RES_STAT[dt]) + Math.max(0, Math.floor((a.attrs.willenskraft - 10) / 2)) * WILL_RES_PER_2 + ward);
  const fam = (a.kindId && FAMILY_RES[monsterKind(a.kindId).family]?.[dt]) || 0;
  // Elementarschild eines Monsters: nie bis zur Immunität
  return ward && fam < 100 ? Math.min(Math.max(MAX_RES, fam), fam + ward) : fam;
}

/** Entfernt alle Statuseffekte samt Stärken und Verkürzungszählern (Tod, Wiedererscheinen). */
function clearStatus(a: Actor): void {
  a.status = {};
  a.statusMag = undefined;
  a.ccDr = undefined;
}

/** Hinweis für das Kampflog an die beteiligten Spieler (Ziel, sonst der Wirkende des laufenden Befehls). Nur für echte Regelwirkungen, nie je Treffer. */
export function note(w: World, a: Actor, text: string): void {
  const to = a.kind === 'player' ? a.id : w.cmdActor;
  if (to === null || getActor(w, to)?.kind !== 'player') return;
  // gleiche Meldung höchstens alle NOTE_DEBOUNCE Ticks (Spinnenbisse, Brand-Champions würden sonst jeden Treffer melden)
  const seen = (w.noteSeen ??= new Map());
  const key = `${to}|${text}`;
  const last = seen.get(key);
  if (last !== undefined && w.tick - last < NOTE_DEBOUNCE) return;
  if (seen.size > 64) for (const [k, t] of seen) if (w.tick - t >= NOTE_DEBOUNCE) seen.delete(k);
  seen.set(key, w.tick);
  w.events.push({ type: 'note', text, to });
}

/** Setzt einen Statuseffekt. Die Resistenz gegen `dt` verkürzt die Dauer (100 % = wirkungslos), Bosse sind nur halb so lange betäubt; Stapelregeln und Kontroll-Verkürzung stehen in `effects.ts`. */
export function applyStatus(w: World, t: Actor, id: StatusId, seconds: number, dt: DmgType, burn?: { perSec: number; srcId: number }, mag?: number): void {
  if (!t.alive) return;
  const def = EFFECTS[id];
  const res = resistOf(t, dt);
  if (res >= 100) {
    note(w, t, `${t.name} ist immun gegen ${def.label}.`);
    return;
  }
  // Willenskraft verkürzt Betäubung und Verlangsamung zusätzlich
  const will = id === 'stun' || id === 'slow' ? 1 - Math.min(WILL_STATUS_CAP, Math.max(0, t.attrs.willenskraft - 10) * WILL_STATUS_PER_POINT) : 1;
  const dr = controlDr(def, t.ccDr?.[id], w.tick);
  const secs = seconds * ((id === 'stun' || id === 'silence') && t.boss ? 0.5 : 1) * (1 - Math.max(0, res) / 100) * will * dr.factor;
  const until = w.tick + Math.round(secs * TICK_RATE);
  if (until <= w.tick) return;
  if (def.dr) (t.ccDr ??= {})[id] = dr.state;
  if (dr.factor < 1) note(w, t, `${def.label} auf ${t.name} wirkt nur noch verkürzt (wiederholte Kontrolle).`);
  else if (res > 0 && seconds > 0) note(w, t, `${def.label} auf ${t.name} durch Resistenz verkürzt.`);
  const merged = mergeStatus(def, t.status[id] === undefined ? undefined : { until: t.status[id]!, mag: t.statusMag?.[id] }, { until, mag });
  if (merged) {
    t.status[id] = merged.until;
    if (merged.mag !== undefined) (t.statusMag ??= {})[id] = merged.mag;
  }
  if (id === 'burn' && burn && (!t.burn || burn.perSec >= t.burn.perSec)) t.burn = burn;
}

/** Kritische Trefferchance in Prozent: Unikate, Sets und Affixe zusammen, höchstens 50 %. */
export function critChance(a: Actor): number {
  return Math.min(MAX_CRIT_PERCENT, powerOf(a, 'crit') + affixSum(a, 'crit') + (a.kind === 'player' ? passiveSum(a, 'crit') : 0));
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
  // Schildbeherrschung: mehr Rüstung vom Schild
  const shield = a.equipment.offhand;
  if (shield?.off === 'shield' && shield.armor) sum += (shield.armor * passiveSum(a, 'shieldArmor')) / 100;
  return sum;
}

export function damageRange(a: Actor): [number, number] {
  let [lo, hi] = a.damage;
  const wpn = a.equipment.weapon;
  if (wpn?.damage) {
    // Bögen und Stäbe taugen im Nahkampf kaum (ein Viertel); ihre Stärke liegt bei Fernkampf bzw. Magie
    const f = wpn.kind === 'bow' || wpn.kind === 'staff' ? 0.25 : 1;
    lo += Math.round(wpn.damage[0] * f);
    hi += Math.round(wpn.damage[1] * f);
  }
  const bonus = affixSum(a, 'damage') + Math.floor((effectiveKraft(a) - 10) / 2);
  const f = 1 + attrBonus(a, 'kraft') / 100;
  return [Math.max(1, Math.round((lo + bonus) * f)), Math.max(1, Math.round((hi + bonus) * f))];
}

export function maxHpOf(a: Actor): number {
  return Math.max(10, Math.round((a.maxHp + (a.attrs.ausdauer - 10) * 5 + affixSum(a, 'maxHp')) * (1 + attrBonus(a, 'ausdauer') / 100)));
}

export function maxManaOf(a: Actor): number {
  return 20 + (a.attrs.verstand - 10) * 5 + affixSum(a, 'maxMana');
}

/** Startet die Angriffspause; ein Bruchteil-Rest der letzten Pause (negativ) wird gutgeschrieben, damit Tempo-Boni unter einem Tick wirken. */
function startCooldown(a: Actor): void {
  a.cooldownLeft = attackCooldownOf(a) + Math.min(0, a.cooldownLeft);
}

export function attackCooldownOf(a: Actor): number {
  const base = a.attackCooldown - Math.floor((a.attrs.gewandtheit - 10) / 2);
  // Eile (Affix, Edelsteine): bis zu 40 % schneller, Untergrenze 6 Ticks
  let cd = Math.max(6, Math.round(base * (1 - Math.min(0.4, affixSum(a, 'haste') / 100))));
  // Waffentempo (Dolche 0,8, Hämmer 1,25) und Gewandtheit-Schwelle wirken nach der Untergrenze, sonst gingen sie bei hoher Gewandtheit verloren;
  // der Bruchteil bleibt als Rest in `cooldownLeft` erhalten (siehe `startCooldown`)
  const wpn = a.equipment.weapon;
  const wSpeed = wpn ? weaponSpeedOf(wpn) : 1;
  const tempo = attrBonus(a, 'gewandtheit');
  const frac = wSpeed !== 1 || tempo > 0;
  if (frac) cd = Math.max(4, (cd * wSpeed) / (1 + tempo / 100));
  if (a.status.slow) cd /= SLOW_FACTOR;
  return frac ? cd : Math.round(cd);
}

/** Fehlende Anforderungen für einen Gegenstand (leer = anlegbar). `replaced`: ersetztes Stück, dessen Kraft-Bonus nicht zählt. */
export function missingReq(a: Actor, it: Item, replaced?: Item): string[] {
  const r = itemReq(it);
  const out: string[] = [];
  if ((r.level ?? 1) > a.level) out.push(`Stufe ${r.level}`);
  const bonusLost = replaced ? replaced.affixes.filter((f) => f.stat === 'kraft').reduce((n, f) => n + f.value, 0) : 0;
  if ((r.kraft ?? 0) > effectiveKraft(a) - bonusLost) out.push(`Kraft ${r.kraft}`);
  for (const [k, label] of [['gewandtheit', 'Gewandtheit'], ['ausdauer', 'Ausdauer'], ['verstand', 'Verstand'], ['willenskraft', 'Willenskraft']] as const) {
    if ((r[k] ?? 0) > a.attrs[k]) out.push(`${label} ${r[k]}`);
  }
  return out;
}

/** Angriffs- und Verteidigungswert (Stufe, Gewandtheit, Rüstung): Treffer-/Ausweichformel als Verhältnis. */
export function attackRating(a: Actor): number {
  return a.kind === 'player' ? 20 + 3 * a.level + 2 * a.attrs.gewandtheit + affixSum(a, 'accuracy') : 20 + 4 * a.level;
}
export function defenseRating(a: Actor): number {
  return a.kind === 'player' ? 10 + 2 * a.level + 2 * a.attrs.gewandtheit + armorOf(a) * 0.5 + affixSum(a, 'evasion') + passiveSum(a, 'evade') : 10 + 3 * a.level;
}
/** Trefferchance 35–97 %: ATK / (ATK + 0,2 · DEF). Gleichstark ≈ 83 %. */
export function hitChance(att: Actor, def: Actor): number {
  const atk = attackRating(att);
  return Math.min(0.97, Math.max(0.35, atk / (atk + 0.2 * defenseRating(def))));
}

export function carryCapacity(a: Actor): number {
  return BASE_CARRY + CARRY_PER_KRAFT * effectiveKraft(a) + passiveSum(a, 'carry');
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

/** Kleinste benannte Region (Zone/Dungeon), die den Punkt enthält. */
export function regionAt(w: World, x: number, y: number): (Rect & { name: string; levels: string }) | undefined {
  let best: (Rect & { name: string; levels: string }) | undefined;
  for (const r of w.regions) {
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h && (!best || r.w * r.h < best.w * best.h)) best = r;
  }
  return best;
}

/** Fachgebiet einer Fertigkeit: Zauber lehrt der Magielehrer, alles andere der Kampflehrer. */
export function skillField(s: { area: string }): TrainerField {
  return s.area === 'Magie' ? 'Magie' : 'Kampf';
}
export function trainerTeaches(n: Npc, s: { area: string; tier: number }): boolean {
  return (n.tier ?? 1) >= s.tier && (!n.field || n.field === skillField(s));
}

export function nearNpc(w: World, a: Actor, kind: NpcKind): Npc | undefined {
  return w.npcs.find((n) => n.kind === kind && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
}

const SELL_RANK: Record<string, number> = { normal: 0, magic: 1, rare: 2 };

/** Rucksack-Gegenstände, die der Sammelverkauf bis zu dieser Seltenheit mitnimmt (nie Tränke, Edelsteine, Set- und Unikat-Teile). */
export function bulkSellable(a: Actor, upTo: 'normal' | 'magic' | 'rare'): Item[] {
  return a.inventory.filter((i) => i.slot !== 'potion' && i.slot !== 'gem' && (SELL_RANK[i.rarity] ?? 99) <= SELL_RANK[upTo]!);
}

export function sellPrice(i: Item): number {
  // gesockelte Edelsteine zählen mit
  const gems = (i.sockets ?? []).reduce((n, g) => n + (g ? templateById(gemTemplateId(g)).value : 0), 0);
  return Math.max(1, Math.floor((i.value + gems) * 0.5));
}

export function buyPrice(templateId: string): number {
  return templateById(templateId).value * 2;
}

export function getActor(w: World, id: number): Actor | undefined {
  return w.actors.find((a) => a.id === id);
}

/* ---------- Befehle ---------- */

/** Gibt eine erfüllte Aufgabe ab: Gold, XP, optional ein seltener Gegenstand oder ein Unikat/Set-Teil (landet im Rucksack). */
function finishQuest(w: World, a: Actor, def: QuestDef): void {
  const st = a.quests[def.id];
  if (!st) return;
  st.state = 'turned';
  a.gold += def.gold;
  let item: Item | undefined;
  if (def.reward) {
    const lv = def.minLevel + 2;
    const ids = () => w.nextId++;
    let special: Item | null = null;
    if (def.reward === 'unique') for (let i = 0; i < 8 && !special; i++) special = i % 2 ? rollWorldSpecial(w.rng, ids, lv) : rollUniqueSpecial(w.rng, ids, lv);
    item = special ?? rollDrop(w.rng, ids, lv, 'rare');
    if (carriedWeight(a) + item.weight > carryCapacity(a)) {
      // Belohnung nie verlieren: zu schwer → als Bodenbeute neben den Spieler legen
      w.ground.push({ id: w.nextId++, x: Math.round(a.x), y: Math.round(a.y), item, expiresAt: null });
      w.events.push({ type: 'fail', reason: 'Rucksack zu schwer – Belohnung liegt am Boden.', to: a.id });
    } else a.inventory.push(item);
  }
  w.events.push({ type: 'questTurned', questId: def.id, xp: def.xp, gold: def.gold, ...(item ? { item } : {}), to: a.id });
  gainXp(w, a, def.xp);
}

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
  if (cmd.type === 'rest') {
    if (a.resting) a.resting = false;
    else if (a.targetId !== null || (w.tick - a.lastHitAt) < TICK_RATE * 3) return fail(w, 'Mitten im Kampf kannst du nicht rasten.');
    else {
      a.resting = true;
      a.path = [];
      a.pickupId = null;
      a.chestId = null;
    }
    return;
  }
  // jede andere Handlung beendet die Rast
  if (cmd.type !== 'spendStat' && cmd.type !== 'equip' && cmd.type !== 'unequip') a.resting = false;
  switch (cmd.type) {
    case 'moveTo':
      a.targetId = null;
      a.pickupId = null;
      a.chestId = null;
      a.path = findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: cmd.x, y: cmd.y });
      break;
    case 'attack': {
      const t = getActor(w, cmd.targetId);
      if (!t || !t.alive || t.id === a.id) return;
      if (t.kind === 'player' && !canPvp(w, a, t)) return fail(w, 'Hier ist kein Kampf gegen Spieler erlaubt.');
      if (Math.hypot(a.x - t.x, a.y - t.y) > MELEE_RANGE + 0.5 && !findPath(w.grid, { x: Math.round(a.x), y: Math.round(a.y) }, { x: Math.round(t.x), y: Math.round(t.y) }).length) return fail(w, 'Das Ziel ist nicht erreichbar.');
      a.stuck = 0;
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
      if (!it || it.slot === 'potion' || it.slot === 'gem') return;
      const target = equipSlotFor(a, it, cmd.to);
      const replaced = a.equipment[target];
      const missing = missingReq(a, it, replaced);
      if (missing.length) {
        w.events.push({ type: 'cannotEquip', item: it, reason: `Benötigt ${missing.join(', ')}`, to: a.id });
        return;
      }
      const hands = offhandIssue(a, it);
      if (hands) {
        w.events.push({ type: 'cannotEquip', item: it, reason: hands, to: a.id });
        return;
      }
      const old = a.equipment[target];
      a.inventory = a.inventory.filter((i) => i.id !== it.id);
      if (old) a.inventory.push(old);
      a.equipment[target] = it;
      // Zweihandwaffe: die Nebenhand wandert in den Rucksack (Bögen behalten Pfeile)
      const off = a.equipment.offhand;
      if (it.slot === 'weapon' && handsOf(it) === 2 && off && !(it.kind === 'bow' && off.off === 'arrows')) {
        delete a.equipment.offhand;
        a.inventory.push(off);
      }
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
    case 'learnSkill':
    case 'trainSkill': {
      const s = skillById(cmd.skillId);
      if (!s) return;
      const trainers = w.npcs.filter((n) => n.kind === 'trainer' && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
      if (!trainers.length) return fail(w, 'Kein Lehrer in der Nähe.');
      if (!trainers.some((n) => trainerTeaches(n, s))) {
        if (trainers.every((n) => n.field && n.field !== skillField(s))) return fail(w, skillField(s) === 'Magie' ? 'Zauber lehrt dir ein Magielehrer.' : 'Das lehrt dir ein Kampflehrer, kein Magier.');
        return fail(w, 'Das lehrt dieser Lehrer nicht.');
      }
      const known = a.skills.includes(s.id);
      const rank = known ? (a.skillRanks[s.id] ?? 1) : 0;
      if (cmd.type === 'learnSkill' && known) return fail(w, 'Bereits gelernt – Ränge steigerst du mit dem Plus.');
      if (cmd.type === 'trainSkill' && !known) return fail(w, 'Erst lernen.');
      if (rank >= MAX_SKILL_RANK) return fail(w, 'Höchster Rang erreicht.');
      const next = rank + 1;
      if (a.level < rankLevelReq(s.levelReq, next)) return fail(w, `Rang ${next} benötigt Stufe ${rankLevelReq(s.levelReq, next)}.`);
      if (a.skillPoints < 1) return fail(w, 'Keine Skillpunkte übrig.');
      const price = rankPrice(s.price, next);
      if (a.gold < price) return fail(w, 'Nicht genug Gold.');
      a.gold -= price;
      a.skillPoints--;
      a.skillRanks[s.id] = next;
      if (!known) a.skills.push(s.id);
      w.events.push({ type: 'learned', skillId: s.id, rank: next, to: a.id });
      break;
    }
    case 'respec': {
      const trainer = nearNpc(w, a, 'trainer');
      if (!trainer) return fail(w, 'Kein Lehrer in der Nähe.');
      const price = a.freeRespec ? 0 : respecPrice(a.level);
      if (a.gold < price) return fail(w, `Neuverteilen kostet ${price} Gold.`);
      a.gold -= price;
      a.freeRespec = false;
      for (const k of ATTR_KEYS) a.attrs[k] = 10;
      a.statPoints = START_STAT_POINTS + STAT_POINTS_PER_LEVEL * (a.level - 1);
      a.skills = [];
      a.skillRanks = {};
      a.skillCd = {};
      a.skillPoints = SKILL_POINTS_START + SKILL_POINTS_PER_LEVEL * (a.level - 1);
      // Ausrüstung, die nun die Anforderungen verfehlt, wandert in den Rucksack
      for (const slot of Object.keys(a.equipment) as EquipSlot[]) {
        const it = a.equipment[slot];
        if (it && missingReq(a, it).length) {
          delete a.equipment[slot];
          a.inventory.push(it);
        }
      }
      a.hp = Math.min(a.hp, maxHpOf(a));
      a.mana = Math.min(a.mana, maxManaOf(a));
      w.events.push({ type: 'respecced', to: a.id });
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
    case 'sellBulk': {
      if (!nearNpc(w, a, 'merchant')) return fail(w, 'Kein Händler in der Nähe.');
      const items = bulkSellable(a, cmd.upTo);
      if (!items.length) return fail(w, 'Nichts zu verkaufen.');
      const ids = new Set(items.map((i) => i.id));
      const total = items.reduce((n, i) => n + sellPrice(i), 0);
      a.inventory = a.inventory.filter((i) => !ids.has(i.id));
      a.gold += total;
      w.events.push({ type: 'gold', amount: total, to: a.id });
      break;
    }
    case 'openChest': {
      const c = w.chests.find((x) => x.id === cmd.chestId);
      if (!c) return;
      if (c.opened) return fail(w, 'Die Truhe ist leer.');
      a.targetId = null;
      a.pickupId = null;
      if (Math.hypot(a.x - c.x, a.y - c.y) <= CHEST_RANGE) return openChest(w, a, c);
      a.chestId = c.id;
      // zum Feld vor der Truhe laufen, sonst direkt zu ihrem Feld
      const from = { x: Math.round(a.x), y: Math.round(a.y) };
      a.path = isWalkable(w.grid, c.x, c.y + 1) ? findPath(w.grid, from, { x: c.x, y: c.y + 1 }) : [];
      if (!a.path.length) a.path = findPath(w.grid, from, { x: c.x, y: c.y });
      break;
    }
    case 'acceptQuest': {
      const def = questById(cmd.questId);
      const giver = w.npcs.find((n) => n.quests?.includes(cmd.questId) && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
      if (!def || !giver) return fail(w, 'Hier gibt es diese Aufgabe nicht.');
      if (a.quests[def.id]) return fail(w, 'Aufgabe bereits angenommen.');
      if (a.level < def.minLevel) return fail(w, `Benötigt Level ${def.minLevel}.`);
      if (def.requires && a.quests[def.requires]?.state !== 'turned') return fail(w, `Erst „${questById(def.requires)?.name ?? '?'}“ abschließen.`);
      a.quests[def.id] = { state: 'active', progress: 0 };
      break;
    }
    case 'turnInQuest': {
      const def = questById(cmd.questId);
      const st = a.quests[cmd.questId];
      const giver = w.npcs.find((n) => n.quests?.includes(cmd.questId) && Math.hypot(n.x - a.x, n.y - a.y) <= NPC_RANGE);
      if (!def || !st || !giver) return fail(w, 'Hier gibt es nichts abzugeben.');
      if (st.state !== 'done') return fail(w, 'Aufgabe noch nicht erfüllt.');
      finishQuest(w, a, def);
      break;
    }
    case 'talk': {
      const n = w.npcs.find((x) => x.id === cmd.npcId);
      if (!n || Math.hypot(n.x - a.x, n.y - a.y) > NPC_RANGE) return fail(w, 'Zu weit entfernt.');
      w.events.push({ type: 'talk', npcId: n.id, to: a.id });
      // Gesprächsaufgaben mit diesem NPC als Ziel sind sofort erfüllt und abgegeben
      for (const def of QUESTS) {
        const st = a.quests[def.id];
        if (def.kind === 'talk' && def.target === npcKeyOf(n.name) && st?.state === 'active') {
          st.progress = def.count;
          st.state = 'done';
          finishQuest(w, a, def);
        }
      }
      break;
    }
    case 'craft': {
      if (!nearNpc(w, a, 'smith')) return fail(w, 'Kein Schmied in der Nähe.');
      if (cmd.op !== 'upgrade' && cmd.op !== 'reroll' && cmd.op !== 'extend') return fail(w, 'Unbekannte Schmiedearbeit.');
      const it = a.inventory.find((i) => i.id === cmd.itemId);
      if (!it || it.slot === 'potion' || it.slot === 'gem') return;
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
    case 'socket': {
      if (!nearNpc(w, a, 'smith')) return fail(w, 'Kein Schmied in der Nähe.');
      const gemItem = a.inventory.find((i) => i.id === cmd.gemId);
      const it = a.inventory.find((i) => i.id === cmd.itemId) ?? equippedItems(a).find((i) => i.id === cmd.itemId);
      if (!gemItem || gemItem.slot !== 'gem' || !gemItem.gem || !it || it.slot === 'gem' || it.slot === 'potion') return fail(w, 'Das lässt sich nicht einsetzen.');
      if (!it.sockets?.length) return fail(w, 'Dieser Gegenstand hat keine Sockel.');
      const index = cmd.index ?? it.sockets.findIndex((x) => !x);
      if (index < 0) return fail(w, 'Alle Sockel sind belegt – wähle einen Sockel zum Ersetzen (der alte Edelstein geht verloren).');
      if (!Number.isInteger(index) || index >= it.sockets.length) return fail(w, 'Ungültiger Sockel.');
      const cost = socketCost(gemItem.gem);
      if (a.gold < cost) return fail(w, 'Nicht genug Gold.');
      a.gold -= cost;
      it.sockets[index] = { ...gemItem.gem };
      a.inventory = a.inventory.filter((i) => i.id !== gemItem.id);
      a.hp = Math.min(a.hp, maxHpOf(a));
      w.events.push({ type: 'crafted', item: it, op: 'socket', to: a.id });
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

/** Goldkosten für das Einsetzen eines Edelsteins (wächst mit der Qualität). */
export function socketCost(g: GemInfo): number {
  return GEM_SOCKET_COST * g.q * g.q;
}

/** Nebenhand-Regeln bei Zweihandwaffen: Bögen erlauben nur Pfeile, andere Zweihänder verlangen eine freie Nebenhand. */
function offhandIssue(a: Actor, it: Item): string | null {
  if (it.slot !== 'offhand') return null;
  const wp = a.equipment.weapon;
  if (!wp || handsOf(wp) !== 2) return null;
  if (wp.kind === 'bow') return it.off === 'arrows' ? null : 'Bogen: In der Nebenhand nur Pfeile';
  return 'Zweihandwaffe: Nebenhand muss frei sein';
}

export function craftCost(item: Item, op: 'upgrade' | 'reroll' | 'extend'): number {
  if (op === 'upgrade') return Math.round(item.rarity === 'normal' ? 30 + item.value : 80 + item.value * 1.5);
  if (op === 'reroll') return Math.round(20 + item.value * 0.4);
  return Math.round(120 + item.value * 1.2);
}

/** Aktive Fertigkeiten in Lernreihenfolge: nur sie belegen Hotbar-Plätze (1–9); Passive wirken dauerhaft. */
export function activeSkills(p: Actor): string[] {
  return p.skills.filter((id) => !skillById(id)?.passive);
}

/** Selbstheilung (Skills mit `heal`): Basiswert plus Attribut-Skalierung, Stufe und Rang. */
function castHeal(w: World, a: Actor, s: SkillDef, rank: number, manaCost: number): void {
  const lvl = 1 + a.level * 0.1;
  const scale = s.scales ? Math.max(0, a.attrs[s.scales] - 10) * 3 : 0;
  const healMod = affixSum(a, 'healPower');
  const amount = Math.round((s.heal! + scale) * lvl * rankDamage(rank) * (healMod !== 0 ? Math.max(0.2, 1 + healMod / 100) : 1));
  a.mana -= manaCost;
  a.skillCd[s.id] = Math.round(s.cooldown * rankCooldown(rank));
  const before = a.hp;
  a.hp = Math.min(maxHpOf(a), a.hp + amount);
  w.events.push({ type: 'healed', amount: Math.round(a.hp - before), to: a.id });
}

/** Alle Gegner, die ein Schadens-Skill trifft (Fläche um den Wirkenden oder das Ziel, Mehrfachziel nach Entfernung, sonst nur das Ziel). */
function skillVictims(w: World, a: Actor, s: SkillDef, first: Actor | undefined): Actor[] {
  const enemy = (x: Actor) => x.alive && x.id !== a.id && (x.kind !== a.kind || canPvp(w, a, x));
  if (s.aoeSelf) return w.actors.filter((x) => enemy(x) && Math.hypot(x.x - a.x, x.y - a.y) <= s.aoe!);
  if (s.aoe) return w.actors.filter((x) => enemy(x) && Math.hypot(x.x - first!.x, x.y - first!.y) <= s.aoe!);
  if (s.targets) {
    return [first!, ...w.actors.filter((x) => enemy(x) && x.id !== first!.id && Math.hypot(x.x - a.x, x.y - a.y) <= s.range).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))].slice(0, s.targets);
  }
  return [first!];
}

/** Rohschaden eines Treffers (würfelt genau einmal): Nahkampf-Skills über Waffenschaden, sonst Basisbereich plus Attribut, passende Waffe und Pfeile. */
function skillRawDamage(w: World, a: Actor, s: SkillDef, rank: number, arrows: Item | undefined): number {
  if (s.mult) {
    const [lo, hi] = damageRange(a);
    const kraft = Math.max(0, a.attrs.kraft - 10) * (1 + a.level * 0.08) * MELEE_SKILL_KRAFT_SCALE;
    return Math.round((w.rng.int(lo, hi) + kraft) * s.mult * rankDamage(rank));
  }
  const lvl = 1 + a.level * 0.1;
  const [lo, hi] = s.base!;
  const scale = s.scales ? Math.max(0, a.attrs[s.scales] - 10) * (1 + a.level * 0.08) : 0;
  const wp = a.equipment.weapon;
  const matches = wp?.damage && ((s.area === 'Fernkampf' && wp.kind === 'bow') || (s.area === 'Magie' && wp.kind === 'staff'));
  const weaponBonus = matches ? ((wp!.damage![0] + wp!.damage![1]) / 2) * 0.9 : 0;
  const spell = s.area === 'Magie' ? 1 + attrBonus(a, 'verstand') / 100 : 1;
  const school = s.area === 'Magie' && s.dmgType ? affixSum(a, s.dmgType === 'fire' ? 'spellFire' : s.dmgType === 'frost' ? 'spellFrost' : 'healPower') : 0;
  const schoolMod = school !== 0 && s.dmgType !== 'poison' ? Math.max(0.2, 1 + school / 100) : 1;
  return Math.round((w.rng.int(lo, hi) * lvl + scale + weaponBonus + (arrows?.arrowBonus ?? 0)) * rankDamage(rank) * spell * schoolMod);
}

/** Nebenwirkungen eines Treffers: Statuseffekt (Brand: 10 % des Treffers pro Sekunde) und Gift über Zeit. */
function skillRiders(w: World, a: Actor, s: SkillDef, v: Actor, amount: number, dt: DmgType): void {
  if (s.status) applyStatus(w, v, s.status.id, ctrlSeconds(a, s.status.id, s.status.seconds), s.status.id === 'stun' ? 'physical' : dt, s.status.id === 'burn' ? { perSec: Math.max(1, Math.round(amount * 0.1)), srcId: a.id } : undefined);
  if (s.dot && resistOf(v, dt) < 100) v.dot = { perSec: Math.max(1, Math.round((amount * s.dot.factor) / s.dot.seconds)), until: w.tick + s.dot.seconds * TICK_RATE, srcId: a.id };
}

/** Dauer eines Kontrolleffekts, den `a` verhängt: Gegenstände mit Kontrolldauer verlängern (oder verkürzen) sie. */
function ctrlSeconds(a: Actor, id: StatusId, seconds: number): number {
  if (EFFECTS[id].kind !== 'control' || a.kind !== 'player') return seconds;
  const c = affixSum(a, 'ctrl');
  return c !== 0 ? seconds * Math.max(0.3, 1 + c / 100) : seconds;
}

/** Skills ohne Schaden: Schutz/Verband auf sich, Schwächung/Kontrolle/Bannung auf einen Gegner, Läuterung. */
function castEffect(w: World, a: Actor, s: SkillDef, rank: number, manaCost: number, targetId?: number): void {
  const self = (s.target ?? 'enemy') === 'self';
  let t: Actor = a;
  if (!self) {
    if (a.kind === 'player' && inSafeZone(w, a.x, a.y)) return fail(w, 'In der Stadt ist Kämpfen verboten.');
    const first = getActor(w, targetId ?? a.targetId ?? -1);
    if (!first || !first.alive || first.id === a.id) return fail(w, 'Kein Ziel.');
    if (Math.hypot(a.x - first.x, a.y - first.y) > s.range) return fail(w, 'Ziel außer Reichweite.');
    if (first.kind === 'player' && !canPvp(w, a, first)) return fail(w, 'Hier ist kein Kampf gegen Spieler erlaubt.');
    t = first;
  }
  a.mana -= manaCost;
  a.skillCd[s.id] = Math.round(s.cooldown * rankCooldown(rank));
  if (!self) {
    if (a.targetId !== t.id) a.autoAttack = false;
    a.targetId = t.id;
    a.path = [];
    // Wer verflucht oder entkräftet wird, wehrt sich
    if (t.kind === 'monster' && t.targetId === null) {
      t.targetId = a.id;
      t.autoAttack = true;
      alertPack(w, t, a.id);
    }
  }
  if (s.action === 'cleanse') {
    const n = cleanse(a, STATUS_IDS);
    note(w, a, n > 0 ? `${s.name}: ${n} schädliche Wirkung${n > 1 ? 'en' : ''} entfernt.` : `${s.name}: nichts zu entfernen.`);
  }
  if (s.action === 'dispel') {
    const gone = dispel(t, STATUS_IDS);
    note(w, a, gone.length ? `${s.name}: ${t.name} verliert ${gone.map((id) => EFFECTS[id].label).join(', ')}.` : `${s.name}: ${t.name} hat keine Verstärkungen.`);
  }
  const e = s.effect;
  if (e) {
    const mag = e.mag !== undefined ? Math.min(e.cap ?? Infinity, e.mag + (e.magPerRank ?? 0) * (rank - 1)) : undefined;
    const heal = e.id === 'bandage' ? affixSum(a, 'healPower') : 0;
    const shown = mag !== undefined && heal !== 0 ? Math.round(mag * Math.max(0.2, 1 + heal / 100) * 10) / 10 : mag;
    applyStatus(w, t, e.id, ctrlSeconds(a, e.id, e.seconds), 'physical', undefined, shown);
    if (t.status[e.id]) {
      const amount = shown === undefined ? '' : e.id === 'bandage' ? `${shown} % Leben pro Sekunde, ` : `${shown} %, `;
      note(w, a, `${EFFECTS[e.id].label}${self ? '' : ` auf ${t.name}`}: ${amount}bis ${Math.max(1, Math.round((t.status[e.id]! - w.tick) / TICK_RATE))} s.`);
    }
  }
}

function useSkill(w: World, a: Actor, skillId: string, targetId?: number): void {
  const s = skillById(skillId);
  if (!s || !a.skills.includes(s.id)) return fail(w, 'Fertigkeit nicht gelernt.');
  if (s.passive) return fail(w, 'Passive Fertigkeiten wirken von selbst.');
  if ((a.skillCd[s.id] ?? 0) > 0) return;
  if (a.status.stun) return fail(w, 'Du bist betäubt.');
  if (a.status.silence) return fail(w, 'Du bist zum Schweigen gebracht.');
  const rank = a.skillRanks[s.id] ?? 1;
  // Manakosten: Manafluss (−) und Gegenstände (+/−), nie unter 40 % der Grundkosten
  const costMod = affixSum(a, 'manaCost') - passiveSum(a, 'manaCost');
  const manaCost = Math.round(s.mana * rankMana(rank) * (costMod !== 0 ? Math.max(0.4, 1 + costMod / 100) : 1));
  if (a.mana < manaCost) return fail(w, 'Nicht genug Mana.');
  if (s.heal !== undefined) return castHeal(w, a, s, rank, manaCost);
  if (s.effect || s.action) return castEffect(w, a, s, rank, manaCost, targetId);
  if (a.kind === 'player' && inSafeZone(w, a.x, a.y)) return fail(w, 'In der Stadt ist Kämpfen verboten.');
  const bowShot = s.area === 'Fernkampf' && a.kind === 'player';
  if (bowShot) {
    if (a.equipment.weapon?.kind !== 'bow') return fail(w, 'Dafür brauchst du einen Bogen.');
    if (a.equipment.offhand?.off !== 'arrows') return fail(w, 'Dafür brauchst du Pfeile in der Nebenhand.');
  }
  const first = getActor(w, targetId ?? a.targetId ?? -1);
  if (!s.aoeSelf && (!first || !first.alive || first.id === a.id)) return fail(w, 'Kein Ziel.');
  if (first && !s.aoeSelf && Math.hypot(a.x - first.x, a.y - first.y) > s.range) return fail(w, 'Ziel außer Reichweite.');
  if (first && first.kind === 'player' && !canPvp(w, a, first)) return fail(w, 'Hier ist kein Kampf gegen Spieler erlaubt.');
  const victims = skillVictims(w, a, s, first);
  if (!victims.length) return fail(w, 'Kein Ziel.');
  a.mana -= manaCost;
  a.skillCd[s.id] = Math.round(s.cooldown * rankCooldown(rank));
  const arrows = bowShot ? a.equipment.offhand : undefined;
  // Fern-/Magie-Skills lösen keine Nahkampf-Verfolgung aus; Nahkampf-Skills schon
  if (first) {
    if (s.mult) a.autoAttack = true;
    else if (a.targetId !== first.id) a.autoAttack = false;
    a.targetId = first.id;
  }
  a.path = [];
  const dt = s.dmgType ?? 'physical';
  for (const v of victims) {
    const amount = skillRawDamage(w, a, s, rank, arrows);
    const dealt = dealDamage(w, a, v, amount, s.ignoresArmor, s.id, false, !s.ignoresArmor, dt);
    if (dealt < 0 || !v.alive) continue;
    skillRiders(w, a, s, v, amount, dt);
  }
}

/* ---------- Kampf ---------- */

function dist(a: Actor, b: Actor): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function speedOf(a: Actor, tickNow: number): number {
  const gear = a.kind === 'player' ? affixSum(a, 'move') : 0;
  const move = gear !== 0 ? Math.min(1.3, Math.max(0.6, 1 + gear / 100)) : 1;
  const stroll = a.patrolling && a.targetId === null ? PATROL_SPEED : 1;
  return (a.chargeUntil > tickNow ? a.speed * 3 : a.speed) * (a.status.slow ? SLOW_FACTOR : 1) * move * stroll;
}

function stepAlong(a: Actor, tickNow = 0): void {
  const next = a.path[0];
  if (!next) return;
  const dx = next.x - a.x;
  const dy = next.y - a.y;
  const d = Math.hypot(dx, dy);
  const sp = speedOf(a, tickNow);
  if (d <= sp) {
    a.x = next.x;
    a.y = next.y;
    a.path.shift();
  } else {
    a.x += (dx / d) * sp;
    a.y += (dy / d) * sp;
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
  if (a.path.length) return stepAlong(a, w.tick);
  // Letzter Schritt: Ziel liegt im Nachbarfeld, aber noch außerhalb der Nahkampfreichweite
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return;
  const nx = a.x + (dx / d) * Math.min(speedOf(a, w.tick), d);
  const ny = a.y + (dy / d) * Math.min(speedOf(a, w.tick), d);
  if (isWalkable(w.grid, Math.round(nx), Math.round(ny))) {
    a.x = nx;
    a.y = ny;
  }
}

function clearLine(w: World, a: Actor, t: Actor): boolean {
  const d = dist(a, t);
  for (let s = 0.5; s < d; s += 0.5) {
    if (!isWalkable(w.grid, Math.round(a.x + ((t.x - a.x) * s) / d), Math.round(a.y + ((t.y - a.y) * s) / d))) return false;
  }
  return true;
}

/** Zaubernde Monster und Schützen: im Bereich stehen bleiben und schießen, zu nahen Zielen ausweichen. Gibt true zurück, wenn es gehandelt hat. */
function castAi(w: World, m: Actor, t: Actor): boolean {
  const archer = m.abilities.includes('archer');
  const d = dist(m, t);
  if (d > (archer ? ARCHER_RANGE : CAST_RANGE) || !clearLine(w, m, t)) return false;
  if (d < (archer ? ARCHER_KEEP : CAST_KEEP)) {
    const spd = speedOf(m, w.tick);
    const nx = m.x - ((t.x - m.x) / (d || 1)) * spd;
    const ny = m.y - ((t.y - m.y) / (d || 1)) * spd;
    if (!isWalkable(w.grid, Math.round(nx), Math.round(ny))) return false;
    m.path = [];
    m.x = nx;
    m.y = ny;
    return true;
  }
  m.path = [];
  if (m.cooldownLeft > 0) return true;
  const [lo, hi] = damageRange(m);
  if (archer) {
    m.cooldownLeft = attackCooldownOf(m);
    dealDamage(w, m, t, w.rng.int(lo, hi), false, 'quick_shot', false, true);
    return true;
  }
  m.cooldownLeft = attackCooldownOf(m) + 6;
  dealDamage(w, m, t, Math.max(1, Math.round(w.rng.int(lo, hi) * 0.9)), false, 'ember_bolt', false, true, m.dmgType);
  return true;
}

/** Normaler Angriff mit Bogen und angelegten Pfeilen: aus der Distanz, voller Waffenschaden plus Pfeilbonus. Gibt true zurück, wenn gehandelt wurde. */
function bowAi(w: World, a: Actor, t: Actor): boolean {
  const wpn = a.equipment.weapon;
  if (wpn?.kind !== 'bow' || a.equipment.offhand?.off !== 'arrows') return false;
  const d = dist(a, t);
  if (d > BOW_RANGE || !clearLine(w, a, t)) return false;
  a.path = [];
  a.stuck = 0;
  if (a.cooldownLeft > 0) return true;
  if (inSafeZone(w, a.x, a.y)) return true;
  startCooldown(a);
  const bonus = affixSum(a, 'damage') + Math.floor((a.attrs.gewandtheit - 10) / 2) + (a.equipment.offhand.arrowBonus ?? 0);
  const [wlo, whi] = wpn.damage ?? [0, 0];
  const lo = Math.max(1, a.damage[0] + wlo + bonus);
  const hi = Math.max(1, a.damage[1] + whi + bonus);
  dealDamage(w, a, t, w.rng.int(lo, hi), false, 'quick_shot', false, true);
  return true;
}

function fight(w: World, a: Actor, t: Actor): void {
  if (a.cooldownLeft > 0) return;
  if (a.kind === 'player' && inSafeZone(w, a.x, a.y)) return;
  startCooldown(a);
  const [lo, hi] = damageRange(a);
  dealDamage(w, a, t, w.rng.int(lo, hi), false, undefined, false, true, a.dmgType);
}

/** Heiler-Monster: verletzte Verbündete im Umkreis heilen (hat Vorrang vor dem Angriff). */
function healAi(w: World, m: Actor): boolean {
  if (m.targetId === null || w.tick < m.healAt) return false;
  let best: Actor | undefined;
  for (const x of w.actors) {
    if (x.kind !== 'monster' || !x.alive || x.id === m.id || x.hp >= x.maxHp * 0.75 || dist(m, x) > HEAL_RANGE) continue;
    if (!best || x.hp / x.maxHp < best.hp / best.maxHp) best = x;
  }
  if (!best) return false;
  m.healAt = w.tick + TICK_RATE * HEAL_EVERY;
  m.cooldownLeft = Math.max(m.cooldownLeft, 12);
  m.path = [];
  const amount = Math.round(best.maxHp * HEAL_FRACTION);
  best.hp = Math.min(best.maxHp, best.hp + amount);
  w.events.push({ type: 'mheal', id: m.id, targetId: best.id, amount });
  return true;
}

const WARD_EVERY = 20;
const WARD_MAG = 35;
const DISPEL_EVERY = 10;

/** Zauberer-Monster: schützt sich im Kampf mit einem Elementarschild (kurz, höchstens alle WARD_EVERY s); Stille und Entzaubern nehmen ihn. */
function wardAi(w: World, m: Actor): boolean {
  if (m.targetId === null || m.status.ward || w.tick < (m.buffAt ?? 0)) return false;
  m.buffAt = w.tick + TICK_RATE * WARD_EVERY;
  applyStatus(w, m, 'ward', 6, 'physical', undefined, WARD_MAG);
  m.cooldownLeft = Math.max(m.cooldownLeft, 12);
  m.path = [];
  return true;
}

/** Entzauberer-Monster: bannt Schutz und Verstärkungen des Ziels (Gegenmaßnahme zu Schutzzaubern). */
function dispelAi(w: World, m: Actor): boolean {
  if (m.targetId === null || w.tick < (m.buffAt ?? 0)) return false;
  const t = getActor(w, m.targetId);
  if (!t || !t.alive || dist(m, t) > CAST_RANGE || !STATUS_IDS.some((id) => t.status[id] && EFFECTS[id].kind === 'buff')) return false;
  m.buffAt = w.tick + TICK_RATE * DISPEL_EVERY;
  const gone = dispel(t, STATUS_IDS);
  m.cooldownLeft = Math.max(m.cooldownLeft, 12);
  m.path = [];
  if (gone.length) note(w, t, `${m.name} bannt deine Verstärkung: ${gone.map((id) => EFFECTS[id].label).join(', ')}.`);
  return true;
}

/** Totenbeschwörer: ruft alle RAISE_EVERY Sekunden ein Skelett (höchstens RAISE_MAX gleichzeitig; gibt weder Beute noch XP). */
function raiseAi(w: World, m: Actor): boolean {
  if (m.targetId === null || w.tick < m.raiseAt || !m.summonKind) return false;
  m.raiseAt = w.tick + TICK_RATE * RAISE_EVERY;
  if (w.actors.filter((x) => x.summonedBy === m.id && x.alive).length >= RAISE_MAX) return false;
  const spots: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  const spot = spots.map(([dx, dy]) => [Math.round(m.x) + dx, Math.round(m.y) + dy] as const).find(([x, y]) => isWalkable(w.grid, x, y));
  if (!spot) return false;
  const minion = spawnMonster(w, spot[0], spot[1], m.summonKind);
  minion.packId = m.packId;
  minion.summonedBy = m.id;
  minion.targetId = m.targetId;
  minion.respawnTicks = 1e9;
  minion.rewardMult = 0;
  m.cooldownLeft = Math.max(m.cooldownLeft, 20);
  m.path = [];
  w.events.push({ type: 'summon', id: m.id });
  return true;
}

/** Entfernt die Helfer eines Beschwörers (Tod oder Wiedererscheinen). */
function dismissSummons(w: World, m: Actor): void {
  for (const x of w.actors) {
    if (x.summonedBy === m.id && x.alive) {
      x.alive = false;
      x.hp = 0;
      x.targetId = null;
      x.diedAt = w.tick - TICK_RATE * 7; // wird vom nächsten Aufräumen entfernt
    }
  }
}

/** Liefert den verursachten Schaden, bei Fehlschlag oder wirkungslosem Treffer −1. */
function dealDamage(w: World, a: Actor, t: Actor, rawIn: number, ignoreArmor: boolean, skill?: string, noReflect = false, canMiss = false, dt: DmgType = 'physical'): number {
  if (t.kind === 'player' && inSafeZone(w, t.x, t.y) && t.pkUntil <= w.tick) return -1;
  if (canMiss && !noReflect && w.rng.next() > hitChance(a, t)) {
    t.lastHitAt = w.tick;
    t.resting = false;
    if (t.kind === 'monster' && a.kind === 'player' && t.alive && t.targetId === null) {
      t.targetId = a.id;
      t.autoAttack = true;
      alertPack(w, t, a.id);
    }
    w.events.push({ type: 'miss', attackerId: a.id, targetId: t.id });
    return -1;
  }
  // Parieren: Nahkampftreffer (kein Skill, keine Zauber/Pfeile) auf Spieler mit passender Waffe; Würfel nur bei gelerntem Skill
  if (canMiss && !noReflect && !skill && t.kind === 'player' && parryChance(t) > 0 && canParry(t) && w.rng.next() * 100 < parryChance(t)) {
    t.lastHitAt = w.tick;
    t.resting = false;
    note(w, t, `Du parierst den Angriff von ${a.name}.`);
    w.events.push({ type: 'miss', attackerId: a.id, targetId: t.id });
    return -1;
  }
  let raw = rawIn;
  // Entkräftung des Angreifers
  if (a.status.weaken) raw *= 1 - Math.min(50, a.statusMag?.weaken ?? 0) / 100;
  let crit = false;
  if (a.kind === 'player' && !noReflect) {
    const chance = critChance(a);
    if (chance > 0 && w.rng.next() * 100 < chance) {
      raw *= 2;
      crit = true;
    }
  }
  const res = resistOf(t, dt);
  // Rüstungsbrecher (nur Angriffe, die Rüstung beachten); Steinhaut mindert nur im Rüstungszweig (Zauber, Gift und Brand bleiben unberührt)
  let physical = raw;
  if (!ignoreArmor) {
    const pen = a.kind === 'player' ? passiveSum(a, 'armorPen') : 0;
    physical = (raw * ARMOR_K) / (ARMOR_K + armorOf(t) * (1 - pen / 100));
    if (t.status.stoneskin) {
      const sk = Math.min(60, t.statusMag?.stoneskin ?? 0);
      physical *= 1 - sk / 100;
      note(w, t, `Steinhaut mindert physischen Schaden um ${sk} %.`);
    }
  }
  if (res > 0 && t.status.ward && dt !== 'physical') note(w, t, `Elementarschild mindert ${DMG_NAME[dt]}schaden (Widerstand ${Math.round(res)} %).`);
  const cursed = t.status.curse ? 1 + Math.min(35, t.statusMag?.curse ?? 0) / 100 : 1;
  const exec = a.kind === 'player' && !noReflect && t.hp < t.maxHp * 0.3 ? 1 + powerOf(a, 'execute') / 100 : 1;
  const amount = res >= 100 ? 0 : Math.max(1, Math.round(physical * (1 - res / 100) * cursed * exec));
  t.hp = Math.max(0, t.hp - amount);
  if (t.status.bandage && amount > 0) {
    delete t.status.bandage;
    if (t.statusMag) delete t.statusMag.bandage;
    note(w, t, 'Der Verband löst sich durch den Treffer.');
  }
  t.lastHitAt = w.tick;
  t.resting = false;
  // Wer angegriffen wird, wehrt sich (auch gegen Fernkämpfer außerhalb der Aggro-Reichweite)
  if (t.kind === 'monster' && a.kind === 'player' && t.alive && t.targetId === null) {
    t.targetId = a.id;
    t.autoAttack = true;
    alertPack(w, t, a.id);
  }
  w.events.push({ type: 'hit', attackerId: a.id, targetId: t.id, amount, skill, crit, ...(dt !== 'physical' ? { dt } : {}) });
  if (a.kind === 'player' && t.kind === 'monster') t.damagers[a.id] = w.tick;
  if (a.kind === 'monster' && a.champ && t.kind === 'player' && t.alive) {
    if (a.champ === 'fiery') applyStatus(w, t, 'burn', 4, 'fire', { perSec: Math.max(2, Math.round(3 + a.level * 0.6)), srcId: a.id });
    if (a.champ === 'vampiric') a.hp = Math.min(a.maxHp, a.hp + Math.round(amount * 0.4));
  }
  if (a.kind === 'monster' && t.kind === 'player' && t.alive && !skill && a.abilities.includes('poisonBite')) {
    applyStatus(w, t, 'slow', 2, 'poison');
    const secs = 3 * (1 - resistOf(t, 'poison') / 100);
    if (a.dmgType === 'poison' && amount > 0 && secs > 0 && (!t.dot || t.dot.until < w.tick + secs * TICK_RATE)) t.dot = { perSec: Math.max(1, Math.round((amount * 0.3) / 3)), until: w.tick + Math.round(secs * TICK_RATE), srcId: a.id };
  }
  if (a.kind === 'player' && t.kind === 'monster' && t.champ === 'thorned' && !noReflect && a.alive) {
    dealDamage(w, t, a, Math.max(1, Math.round(amount * 0.15)), true, undefined, true);
  }
  if (a.kind === 'player' && t.kind === 'player') {
    // Angriff auf einen Unbeteiligten macht zum Mörder; Notwehr (Gegenschlag auf den Angreifer) nicht
    const selfDefense = a.attackedBy?.id === t.id && w.tick - a.attackedBy.at < TICK_RATE * 10;
    if (!selfDefense && t.pkUntil <= w.tick && a.pkUntil <= w.tick) {
      a.pkUntil = w.tick + TICK_RATE * 60 * 10;
      w.events.push({ type: 'pk', id: a.id });
    } else if (!selfDefense && a.pkUntil > w.tick) a.pkUntil = w.tick + TICK_RATE * 60 * 10;
    t.attackedBy = { id: a.id, at: w.tick };
  }
  // Brand-/Frosttreffer: eigener Zufallsstrom `fx` und nur mit passender Power, damit der Kampfwurf-Strom unverändert bleibt
  if (a.kind === 'player' && t.kind === 'monster' && t.hp > 0 && !noReflect && amount > 0) {
    const bh = powerOf(a, 'burnHit') + affixSum(a, 'procBurn');
    if (bh > 0 && w.fx.next() * 100 < bh) applyStatus(w, t, 'burn', 3, 'fire', { perSec: Math.max(2, Math.round(2 + a.level * 0.5)), srcId: a.id });
    const fh = powerOf(a, 'frostHit') + affixSum(a, 'procFrost');
    if (fh > 0 && w.fx.next() * 100 < fh) applyStatus(w, t, 'slow', 3, 'frost');
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
  if (t.hp > 0) return amount;
  t.alive = false;
  t.path = [];
  t.targetId = null;
  t.dot = null;
  clearStatus(t);
  t.burn = null;
  if (t.abilities.includes('raise')) dismissSummons(w, t);
  t.diedAt = w.tick;
  w.events.push({ type: 'died', id: t.id });
  if (t.kind === 'monster') onMonsterDeath(w, a, t);
  else onPlayerDeath(w, t);
  return amount;
}

function onMonsterDeath(w: World, killer: Actor, m: Actor): void {
  if (m.rewardMult <= 0) return;
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
      if (st?.state !== 'active') continue;
      const matches = q.kind === 'kill' ? q.target === m.kindId : q.kind === 'champion' ? !!m.champ : q.kind === 'unique' ? !!m.unique && (!q.target || q.target === m.unique) : false;
      if (matches) {
        st.progress++;
        w.events.push({ type: 'questProgress', questId: q.id, progress: st.progress, count: q.count, to: pl.id });
        if (st.progress >= q.count) {
          st.state = 'done';
          w.events.push({ type: 'questDone', questId: q.id, to: pl.id });
        }
      } else if (q.kind === 'bring' && q.monsters?.includes(m.kindId!) && !m.summoned && w.rng.next() < (q.chance ?? 0.4)) {
        questItemFound(w, pl, q, st);
      }
    }
    gainXp(w, killer, Math.round(k.xp * (1 + powerOf(pl, 'xpBonus') / 100)));
    const mk = powerOf(pl, 'manaKill');
    if (mk > 0) pl.mana = Math.min(maxManaOf(killer), pl.mana + mk);
    const hk = powerOf(pl, 'healKill');
    if (hk > 0) pl.hp = Math.min(maxHpOf(pl), pl.hp + hk);
    const gold = Math.round(w.rng.int(k.gold[0], k.gold[1]) * m.rewardMult * (1 + powerOf(pl, 'goldBonus') / 100));
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
  if (k.level >= GEM_MIN_LEVEL && w.rng.next() < (k.boss ? GEM_DROP.boss : m.unique ? GEM_DROP.unique : m.champ ? GEM_DROP.champion : GEM_DROP.normal)) drop(rollGem(w.rng, () => w.nextId++, k.level));
  if (m.champ) drop(rollDrop(w.rng, () => w.nextId++, k.level, w.rng.next() < 0.25 ? 'rare' : 'magic'));
  const wb = m.unique ? uniqueDef(m.unique) : undefined;
  if (wb?.world) {
    // Weltboss: garantierte seltene Stücke mit hohen Affix-Stufen, bessere Edelsteine, oft Unikat/Set-Teil
    const nid = () => w.nextId++;
    for (let i = 0; i < WORLD_BOSS_LOOT.rares; i++) drop(rollWorldDrop(w.rng, nid, k.level, WORLD_BOSS_LOOT.minTier));
    drop(rollGem(w.rng, nid, k.level, WORLD_BOSS_LOOT.minGem));
    if (w.rng.next() < 0.5) drop(rollGem(w.rng, nid, k.level, WORLD_BOSS_LOOT.minGem));
    const wsp = rollWorldSpecial(w.rng, nid, Math.min(k.level + 2, 30));
    if (wsp) drop(wsp);
    drop(rollPotion(w.rng, nid, k.level));
    w.events.push({ type: 'worldBoss', id: m.id, name: m.name, state: 'dead', where: wb.where ?? '' });
  } else if (m.unique) {
    drop(rollDrop(w.rng, () => w.nextId++, k.level, 'rare'));
    if (w.rng.next() < 0.5) drop(rollDrop(w.rng, () => w.nextId++, k.level, 'rare'));
    const sp = rollUniqueSpecial(w.rng, () => w.nextId++, k.level);
    if (sp) drop(sp);
    drop(rollPotion(w.rng, () => w.nextId++, k.level));
  }
  const special = rollSpecial(w.rng, () => w.nextId++, k.level, k.id, !!k.boss);
  if (special) drop(special);
}

/** Ein Quest-Gegenstand wird gefunden (nur gezählt, nicht im Rucksack: nicht verkaufbar, nicht verlierbar). */
function questItemFound(w: World, pl: Actor, q: QuestDef, st: { state: 'active' | 'done' | 'turned'; progress: number }): void {
  st.progress++;
  w.events.push({ type: 'questItem', questId: q.id, item: q.item ?? 'Gegenstand', progress: st.progress, count: q.count, to: pl.id });
  if (st.progress >= q.count) {
    st.state = 'done';
    w.events.push({ type: 'questDone', questId: q.id, to: pl.id });
  }
}

export function gainXp(w: World, a: Actor, amount: number): void {
  a.xp += amount;
  w.events.push({ type: 'xp', amount, to: a.id });
  while (a.level < MAX_LEVEL && a.xp >= totalXpFor(a.level + 1)) {
    a.level++;
    a.statPoints += STAT_POINTS_PER_LEVEL;
    a.skillPoints += SKILL_POINTS_PER_LEVEL;
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
  // 1–3 Items aus dem Rucksack fallen; Angelegtes geht nie verloren
  const count = w.rng.int(1, 3);
  const dropped: Item[] = [];
  for (let i = 0; i < count; i++) {
    const pool = p.inventory;
    if (!pool.length) break;
    const it = pool[w.rng.int(0, pool.length - 1)]!;
    dropped.push(it);
    p.inventory = p.inventory.filter((x) => x.id !== it.id);
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
  clearStatus(p);
  p.burn = null;
  p.dot = null;
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
  if (w.tick % 100 === 0) cleanupSummons(w);
  processTelegraphs(w);
  for (const c of w.chests) if (c.opened && w.tick >= c.respawnAt) c.opened = false;
  w.ground = w.ground.filter((g) => g.expiresAt === null || g.expiresAt > w.tick);
  const players = w.actors.filter((x) => x.kind === 'player' && x.alive);
  if (w.npcWander) npcWanderStep(w, players);
  if (w.tick % 10 === 0) for (const pl of players) checkVisits(w, pl);
  for (const a of w.actors) {
    if (a.kind === 'monster' && a.alive && a.targetId === null && a.path.length === 0 && a.hp >= a.maxHp) {
      if (!players.some((pl) => Math.abs(pl.x - a.x) < SLEEP_DIST && Math.abs(pl.y - a.y) < SLEEP_DIST)) continue;
    }
    if (!a.alive) {
      if (a.kind === 'monster' && w.tick - a.diedAt >= a.respawnTicks && a.home) reviveMonster(w, a);
      continue;
    }
    if (a.cooldownLeft > 0) a.cooldownLeft--; // darf knapp unter 0 fallen (Rest, s. startCooldown)
    if (a.potionCd > 0) a.potionCd--;
    if (a.dot) {
      if (w.tick % TICK_RATE === 0) {
        const src = getActor(w, a.dot.srcId) ?? a;
        const d = a.dot;
        if (w.tick >= d.until) a.dot = null;
        dealDamage(w, src, a, d.perSec, true, 'dot', false, false, 'poison');
        if (!a.alive) continue;
      } else if (w.tick >= a.dot.until) a.dot = null;
    }
    for (const id of STATUS_IDS) if (a.status[id] !== undefined && a.status[id]! <= w.tick) {
      delete a.status[id];
      if (a.statusMag) delete a.statusMag[id];
    }
    if (a.burn) {
      if (!a.status.burn) a.burn = null;
      else if (w.tick % TICK_RATE === 0) {
        dealDamage(w, getActor(w, a.burn.srcId) ?? a, a, a.burn.perSec, true, 'burn', false, false, 'fire');
        if (!a.alive) continue;
      }
    }
    for (const id of Object.keys(a.skillCd)) if ((a.skillCd[id] ?? 0) > 0) a.skillCd[id]!--;
    if (a.status.bandage && w.tick % TICK_RATE === 0) a.hp = Math.min(maxHpOf(a), a.hp + (maxHpOf(a) * (a.statusMag?.bandage ?? 0)) / 100);
    if (a.status.stun) {
      if (a.kind === 'player') regen(w, a);
      continue;
    }
    if (a.kind === 'monster' && a.abilities.length && !a.status.silence && ((a.abilities.includes('heal') && healAi(w, a)) || (a.abilities.includes('raise') && raiseAi(w, a)) || (a.abilities.includes('ward') && wardAi(w, a)) || (a.abilities.includes('dispel') && dispelAi(w, a)))) continue;
    if (a.kind === 'player') regen(w, a);
    else monsterAi(w, a, players);
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
      if (a.kind === 'monster' && ((a.abilities.includes('cast') && !a.status.silence) || a.abilities.includes('archer')) && castAi(w, a, t)) {
        // Zauberer: schießt aus der Distanz oder weicht zurück
      } else if (a.kind === 'player' && bowAi(w, a, t)) {
        // Bogenschütze: schießt aus der Distanz
      } else if (dist(a, t) <= MELEE_RANGE) {
        a.path = [];
        a.stuck = 0;
        fight(w, a, t);
      } else {
        const before = a.x + a.y;
        chase(w, a, t);
        if (a.kind === 'player') {
          a.stuck = a.x + a.y === before ? a.stuck + 1 : 0;
          if (a.stuck > TICK_RATE * 2) {
            a.stuck = 0;
            a.targetId = null;
            w.events.push({ type: 'fail', reason: 'Das Ziel ist nicht erreichbar.', to: a.id });
          }
        }
      }
    } else {
      stepAlong(a, w.tick);
      if (a.pickupId !== null) tryPickup(w, a);
      if (a.chestId !== null) tryOpenChest(w, a);
    }
  }
}

/** Besuchsaufgaben: erfüllt, sobald der Spieler die Region betritt (alle 0,5 s geprüft). */
function checkVisits(w: World, pl: Actor): void {
  for (const q of QUESTS) {
    if (q.kind !== 'visit' || pl.quests[q.id]?.state !== 'active') continue;
    const r = w.regions.find((x) => x.name === q.place);
    if (!r || pl.x < r.x || pl.y < r.y || pl.x >= r.x + r.w || pl.y >= r.y + r.h) continue;
    const st = pl.quests[q.id]!;
    st.progress = q.count;
    st.state = 'done';
    w.events.push({ type: 'questProgress', questId: q.id, progress: st.progress, count: q.count, to: pl.id });
    w.events.push({ type: 'questDone', questId: q.id, to: pl.id });
  }
}

function cleanupSummons(w: World): void {
  let any = false;
  for (const a of w.actors) {
    if (a.kind === 'monster' && !a.alive && a.respawnTicks >= 1e9 && w.tick - a.diedAt > TICK_RATE * 6) {
      any = true;
      break;
    }
  }
  if (any) w.actors = w.actors.filter((a) => !(a.kind === 'monster' && !a.alive && a.respawnTicks >= 1e9 && w.tick - a.diedAt > TICK_RATE * 6));
}

function regen(w: World, p: Actor): void {
  const safe = inSafeZone(w, p.x, p.y);
  if (p.resting && (p.path.length > 0 || p.targetId !== null)) p.resting = false;
  const boost = p.resting ? 5 : 1;
  const max = maxHpOf(p);
  p.hp = Math.min(max, p.hp + ((safe ? SAFE_REGEN : FIELD_REGEN + (p.attrs.ausdauer - 10) * 0.002 + passiveSum(p, 'fieldRegen') / TICK_RATE) + Math.min(MAX_REGEN_PER_SEC, affixSum(p, 'regen')) / TICK_RATE) * (safe ? 1 : boost));
  const mmax = maxManaOf(p);
  p.mana = Math.min(mmax, p.mana + (0.02 + (p.attrs.willenskraft - 10) * 0.005 + (safe ? 0.2 : 0)) * boost * (1 + attrBonus(p, 'willenskraft') / 100) * (1 + passiveSum(p, 'manaRegen') / 100));
}

function reviveMonster(w: World, m: Actor): void {
  // Helfer vom letzten Mal verschwinden, sonst häufen sie sich über Respawns
  if (m.abilities.includes('summon')) dismissSummons(w, m);
  m.alive = true;
  m.patrolling = false;
  m.patrolSeq = -1;
  m.hp = m.maxHp;
  m.x = m.home!.x;
  m.y = m.home!.y;
  m.targetId = null;
  m.path = [];
  m.dot = null;
  clearStatus(m);
  m.burn = null;
  m.damagers = {};
  m.summoned = false;
  m.chargeUntil = 0;
  if (m.enraged) {
    m.enraged = false;
    m.damage = monsterKind(m.kindId!).damage;
  }
  const wb = m.unique ? uniqueDef(m.unique) : undefined;
  if (wb?.world) w.events.push({ type: 'worldBoss', id: m.id, name: m.name, state: 'spawn', where: wb.where ?? '' });
}

/** Rudelmitglieder in der Nähe greifen dasselbe Ziel an. */
function alertPack(w: World, m: Actor, targetId: number): void {
  if (!m.packId) return;
  for (const o of w.actors) {
    if (o.kind === 'monster' && o.alive && o.packId === m.packId && o.targetId === null && o.id !== m.id && Math.hypot(o.x - m.x, o.y - m.y) <= PACK_ALERT_RANGE) {
      o.targetId = targetId;
      o.patrolling = false;
      o.autoAttack = true;
    }
  }
}

/** Legt für jedes Rudel (Rudel-Id > 0, ohne Bosse und Mini-Bosse) 1–2 Wegpunkte im Umkreis des Rudelplatzes fest; Nutzt nur den Zufallsstrom `fx`. */
export function setupPatrols(w: World): void {
  const groups = new Map<number, Actor[]>();
  for (const a of w.actors) {
    if (a.kind !== 'monster' || !a.packId || a.boss || a.unique || a.summonedBy || !a.home) continue;
    let g = groups.get(a.packId);
    if (!g) groups.set(a.packId, (g = []));
    g.push(a);
  }
  for (const [id, mem] of groups) {
    const anchor = { x: Math.round(mem[0]!.home!.x), y: Math.round(mem[0]!.home!.y) };
    const pts: Pt[] = [anchor];
    for (let tries = 0; tries < 24 && pts.length < 3; tries++) {
      const p = { x: anchor.x + w.fx.int(-PATROL_RADIUS, PATROL_RADIUS), y: anchor.y + w.fx.int(-PATROL_RADIUS, PATROL_RADIUS) };
      if (!isWalkable(w.grid, p.x, p.y) || inSafeZone(w, p.x, p.y)) continue;
      if (pts.some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 4)) continue;
      const path = findPath(w.grid, anchor, p);
      if (!path.length || path.length > PATROL_RADIUS * 2 + 2) continue;
      pts.push(p);
    }
    if (pts.length < 2) continue;
    for (const m of mem) m.patrolOff = { x: Math.round(m.home!.x) - anchor.x, y: Math.round(m.home!.y) - anchor.y };
    w.packs.set(id, { pts, idx: 0, dir: 1, seq: 0, nextAt: w.fx.int(PATROL_DWELL[0], PATROL_DWELL[1]), seen: -1 });
  }
}

/** Ruhiges Rudel: Alle Mitglieder wandern gemeinsam (mit ihrem Versatz) von Wegpunkt zu Wegpunkt und warten dazwischen. */
function patrolStep(w: World, m: Actor): void {
  const pk = w.packs.get(m.packId);
  if (!pk || !m.patrolOff) return;
  if (pk.seen !== w.tick) {
    pk.seen = w.tick;
    if (w.tick >= pk.nextAt) {
      if (pk.idx + pk.dir < 0 || pk.idx + pk.dir >= pk.pts.length) pk.dir = (pk.dir * -1) as 1 | -1;
      pk.idx += pk.dir;
      pk.seq++;
      pk.nextAt = w.tick + w.fx.int(PATROL_DWELL[0], PATROL_DWELL[1]);
    }
  }
  if (m.patrolSeq === pk.seq || m.path.length) return;
  m.patrolSeq = pk.seq;
  const wp = pk.pts[pk.idx]!;
  let tx = wp.x + m.patrolOff.x;
  let ty = wp.y + m.patrolOff.y;
  if (!isWalkable(w.grid, tx, ty) || inSafeZone(w, tx, ty)) {
    tx = wp.x;
    ty = wp.y;
  }
  const path = findPath(w.grid, { x: Math.round(m.x), y: Math.round(m.y) }, { x: tx, y: ty });
  if (path.length) {
    m.path = path;
    m.patrolling = true;
  }
}

/** Stadt-NPCs schlendern gemächlich in kleinem Umkreis, bleiben aber stehen, sobald jemand mit ihnen reden könnte. */
function npcWanderStep(w: World, players: Actor[]): void {
  for (const n of w.npcs) {
    if (!n.wander) continue;
    if (!n.home) n.home = { x: n.x, y: n.y };
    if (!players.some((p) => Math.abs(p.x - n.x) < SLEEP_DIST && Math.abs(p.y - n.y) < SLEEP_DIST)) continue;
    if (players.some((p) => Math.hypot(p.x - n.x, p.y - n.y) <= NPC_RANGE + 1.5)) {
      n.path = [];
      continue;
    }
    const next = n.path?.[0];
    if (next) {
      const dx = next.x - n.x;
      const dy = next.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d <= NPC_WANDER_SPEED) {
        n.x = next.x;
        n.y = next.y;
        n.path!.shift();
        if (!n.path!.length) n.nextMoveAt = w.tick + w.fx.int(TICK_RATE * 4, TICK_RATE * 10);
      } else {
        n.x += (dx / d) * NPC_WANDER_SPEED;
        n.y += (dy / d) * NPC_WANDER_SPEED;
      }
      continue;
    }
    if (w.tick < (n.nextMoveAt ?? 0)) continue;
    n.nextMoveAt = w.tick + TICK_RATE * 2;
    const t = { x: Math.round(n.home.x) + w.fx.int(-n.wander, n.wander), y: Math.round(n.home.y) + w.fx.int(-n.wander, n.wander) };
    if (!isWalkable(w.grid, t.x, t.y) || (Math.abs(t.x - n.x) < 1 && Math.abs(t.y - n.y) < 1)) continue;
    const path = findPath(w.grid, { x: Math.round(n.x), y: Math.round(n.y) }, t);
    if (path.length && path.length <= n.wander * 3) n.path = path;
  }
}

function monsterAi(w: World, m: Actor, players: Actor[]): void {
  const home = m.home!;
  if (m.targetId === null) {
    let best: Actor | undefined;
    let bd = m.aggroRange;
    for (const x of players) {
      if ((inSafeZone(w, x.x, x.y) && x.pkUntil <= w.tick)) continue;
      const d = dist(m, x);
      const stealth = x.kind === 'player' ? passiveSum(x, 'stealth') : 0;
      if (d <= bd && (stealth <= 0 || d <= m.aggroRange * (1 - stealth / 100))) {
        bd = d;
        best = x;
      }
    }
    if (best) {
      m.targetId = best.id;
      m.patrolling = false;
      alertPack(w, m, best.id);
      return;
    }
    patrolStep(w, m);
    return;
  }
  const t = getActor(w, m.targetId);
  const lost = !t || !t.alive || (inSafeZone(w, t.x, t.y) && t.pkUntil <= w.tick) || Math.hypot(m.x - home.x, m.y - home.y) > LEASH;
  if (lost) {
    m.targetId = null;
    m.patrolling = false;
    m.patrolSeq = -1;
    m.path = findPath(w.grid, { x: Math.round(m.x), y: Math.round(m.y) }, home);
    return;
  }
  if (m.abilities.length && t) useAbilities(w, m, t);
}

/** Boss-Fähigkeiten: Bodenschlag mit Warnring, Beschwörung bei halbem Leben, Ansturm. */
function useAbilities(w: World, m: Actor, t: Actor): void {
  const d = dist(m, t);
  if (m.abilities.includes('slam') && w.tick >= m.abilityAt && d <= 8) {
    const dmg = Math.round(((m.damage[0] + m.damage[1]) / 2) * 2.2);
    const r = m.boss ? 3 : 2.4;
    w.telegraphs.push({ id: w.nextId++, x: t.x, y: t.y, r, at: w.tick + 26, dmg, src: m.id });
    w.events.push({ type: 'telegraph', x: t.x, y: t.y, r, ms: 26 * (1000 / TICK_RATE) });
    m.abilityAt = w.tick + TICK_RATE * (m.boss ? 6 : 8);
  }
  if (m.abilities.includes('summon') && !m.summoned && m.hp < m.maxHp * 0.5 && m.summonKind) {
    m.summoned = true;
    w.events.push({ type: 'summon', id: m.id });
    const pack = w.nextId++;
    for (let i = 0; i < 3; i++) {
      const sx = Math.round(m.x) + (i - 1) * 2;
      const sy = Math.round(m.y) + 2;
      const x = isWalkable(w.grid, sx, sy) ? sx : Math.round(m.x);
      const y = isWalkable(w.grid, sx, sy) ? sy : Math.round(m.y);
      const minion = spawnMonster(w, x, y, m.summonKind);
      minion.packId = pack;
      minion.summonedBy = m.id;
      minion.targetId = t.id;
      minion.respawnTicks = 1e9; // Gerufene Helfer kommen nicht wieder
    }
  }
  if (m.abilities.includes('charge') && w.tick >= m.chargeAt && d >= 4 && d <= 10) {
    m.chargeUntil = w.tick + 14;
    m.chargeAt = w.tick + TICK_RATE * 9;
    m.cooldownLeft = 0;
    w.events.push({ type: 'charge', id: m.id });
  }
}

function processTelegraphs(w: World): void {
  if (!w.telegraphs.length) return;
  const keep: World['telegraphs'] = [];
  for (const tg of w.telegraphs) {
    if (tg.at > w.tick) {
      keep.push(tg);
      continue;
    }
    const src = getActor(w, tg.src);
    if (!src) continue;
    for (const p of w.actors) {
      if (p.kind !== 'player' || !p.alive) continue;
      if (Math.hypot(p.x - tg.x, p.y - tg.y) <= tg.r) dealDamage(w, src, p, tg.dmg, false, 'slam');
    }
  }
  w.telegraphs = keep;
}

const CHEST_RANGE = 2;
const CHEST_RESPAWN_TICKS = TICK_RATE * 60 * 12;

function tryOpenChest(w: World, a: Actor): void {
  const c = w.chests.find((x) => x.id === a.chestId);
  if (!c || c.opened) {
    a.chestId = null;
    return;
  }
  if (Math.hypot(a.x - c.x, a.y - c.y) <= CHEST_RANGE) {
    a.chestId = null;
    a.path = [];
    openChest(w, a, c);
  } else if (a.path.length === 0) a.chestId = null;
}

/** Öffnet eine Truhe: Gold, Tränke, Ausrüstung (bessere Truhen: bessere Seltenheit, selten Unikate/Set-Teile). */
function openChest(w: World, a: Actor, c: Chest): void {
  c.opened = true;
  c.respawnAt = w.tick + CHEST_RESPAWN_TICKS;
  for (const q of QUESTS) {
    const st = a.quests[q.id];
    if (st?.state !== 'active') continue;
    if (q.kind === 'bring' && q.chestRegion && regionAt(w, c.x, c.y)?.name === q.chestRegion) {
      questItemFound(w, a, q, st);
      continue;
    }
    if (q.kind !== 'chest') continue;
    st.progress++;
    w.events.push({ type: 'questProgress', questId: q.id, progress: st.progress, count: q.count, to: a.id });
    if (st.progress >= q.count) {
      st.state = 'done';
      w.events.push({ type: 'questDone', questId: q.id, to: a.id });
    }
  }
  const mult = { wood: 1, iron: 1.8, gold: 3 }[c.tier];
  const gold = Math.round(w.rng.int(c.level * 6, c.level * 14 + 10) * mult);
  a.gold += gold;
  w.events.push({ type: 'gold', amount: gold, to: a.id });
  w.events.push({ type: 'chestOpened', chestId: c.id });
  const spots: [number, number][] = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let n = 0;
  const drop = (item: Item) => {
    const [dx, dy] = spots[n++ % spots.length]!;
    const x = isWalkable(w.grid, Math.round(c.x) + dx, Math.round(c.y) + dy) ? Math.round(c.x) + dx : Math.round(c.x);
    const y = isWalkable(w.grid, Math.round(c.x) + dx, Math.round(c.y) + dy) ? Math.round(c.y) + dy : Math.round(c.y);
    w.ground.push({ id: w.nextId++, x, y, item, expiresAt: w.tick + MONSTER_LOOT_TTL });
    w.events.push({ type: 'loot', item, x, y });
  };
  const gear = c.tier === 'wood' ? 1 : c.tier === 'iron' ? 2 : 3;
  for (let i = 0; i < gear; i++) {
    const r = w.rng.next();
    const rarity = c.tier === 'gold' ? (r < 0.35 ? 'rare' : 'magic') : c.tier === 'iron' ? (r < 0.15 ? 'rare' : r < 0.7 ? 'magic' : 'normal') : r < 0.05 ? 'rare' : r < 0.35 ? 'magic' : 'normal';
    drop(rollDrop(w.rng, () => w.nextId++, c.level, rarity));
  }
  for (let i = 0; i < (c.tier === 'wood' ? 1 : 2); i++) drop(rollPotion(w.rng, () => w.nextId++, c.level));
  if (c.level >= GEM_MIN_LEVEL && w.rng.next() < GEM_DROP.chest[c.tier]) drop(rollGem(w.rng, () => w.nextId++, c.level));
  if (c.tier !== 'wood') {
    const special = rollSpecial(w.rng, () => w.nextId++, c.level, '', false);
    if (special && w.rng.next() < (c.tier === 'gold' ? 1 : 0.4)) drop(special);
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
