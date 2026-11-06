/**
 * Folgen der Tageszeit (P6): Beim Wechsel Tag/Nacht werden Untote und Nachtjäger draußen stärker, zusätzliche Gegner
 * erscheinen (am Morgen verschwinden sie), Läden schließen und die Nacht-NPCs treten auf. Alles hängt nur am Tick
 * (`clock.ts`) und an festen Hash-Werten, nie am Zufallsstrom `w.rng` (Golden-Tests und Mehrspieler bleiben stabil).
 */
import { DANGER_OFFSETS, monsterKind, NIGHT, NIGHT_HUNTERS, NIGHT_NPCS, NIGHT_SPAWNS } from './data';
import { DUNGEON_REGIONS, hourOf, isNightHour, nightNumber, NIGHT_TO, openText } from './clock';
import { isWalkable } from './path';
import { inSafeZone, regionAt, spawnMonster, TICK_RATE, type Actor, type Npc, type World } from './world';

/** Kennungen der Nacht-NPCs */
export const NIGHT_NPC_ID = 900000;

/** Händler (Läden), die nachts schließen, und der Nachthändler (hat selbst `shop`, ist aber kein `merchant`) */
export const isShop = (n: Npc): boolean => n.kind === 'merchant' || n.shop !== undefined;

const hash = (a: number, b: number, c: number): number => {
  let t = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b) ^ Math.imul(c + 7, 0xc2b2ae35)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Nachts stärker: Untote und Nachtjäger außerhalb von Dungeons; nie Bosse, Unikate und Beschwörungen */
export function nightBuffable(w: World, m: Actor): boolean {
  if (m.kind !== 'monster' || !m.kindId || m.boss || m.unique || m.summonedBy !== undefined || !m.home) return false;
  if (monsterKind(m.kindId).family !== 'undead' && !NIGHT_HUNTERS.includes(m.kindId)) return false;
  return !DUNGEON_REGIONS.includes(regionAt(w, m.home.x, m.home.y)?.name ?? '');
}

/** Schaltet die Nachtwerte eines Gegners ein oder aus (die ursprünglichen Werte bleiben in `nightBase`) */
export function setNightBuff(m: Actor, on: boolean): void {
  if (on === !!m.nightBase) return;
  if (on) {
    m.nightBase = { maxHp: m.maxHp, hp: m.hp, damage: [m.damage[0], m.damage[1]], aggro: m.aggroRange, reward: m.rewardMult };
    m.maxHp = Math.round(m.maxHp * NIGHT.hp);
    m.hp = m.alive ? Math.min(m.maxHp, Math.round(m.hp * NIGHT.hp)) : m.maxHp;
    m.damage = [Math.max(1, Math.round(m.damage[0] * NIGHT.dmg)), Math.max(2, Math.round(m.damage[1] * NIGHT.dmg))];
    m.aggroRange += NIGHT.aggro;
    m.rewardMult *= NIGHT.reward;
  } else if (m.nightBase) {
    const b = m.nightBase;
    m.hp = m.alive ? Math.max(1, Math.min(b.maxHp, Math.ceil(m.hp / NIGHT.hp))) : b.maxHp;
    m.maxHp = b.maxHp;
    m.damage = b.damage;
    m.aggroRange = b.aggro;
    m.rewardMult = b.reward;
    m.nightBase = undefined;
  }
}

/** Nach einem Zurücksetzen der Werte (z. B. Wut-Ende beim Wiederbeleben) gelten die Nachtwerte weiter */
export function rebaseNight(m: Actor): void {
  if (!m.nightBase) return;
  m.nightBase.damage = [m.damage[0], m.damage[1]];
  m.damage = [Math.max(1, Math.round(m.damage[0] * NIGHT.dmg)), Math.max(2, Math.round(m.damage[1] * NIGHT.dmg))];
}

/** Anwesenheit der Nacht-NPCs und Öffnung der Läden, rein aus der Uhr (auch auf dem Client nach jedem Schnappschuss) */
export function syncNpcPresence(w: World): void {
  const night = isNightHour(hourOf(w));
  for (const n of w.npcs) {
    n.away = !!n.nightOnly && !night;
    n.closed = night && n.kind === 'merchant';
  }
}

/** Nacht-NPCs einmalig anlegen (nach dem Kartenaufbau, auch auf dem Client) */
export function addNightNpcs(w: World): void {
  // feste Kennungen jenseits der Zähler, damit Akteur- und Gegenstands-Kennungen (und Golden-Tests) unverändert bleiben
  NIGHT_NPCS.forEach((d, i) => {
    if (w.npcs.some((n) => n.name === d.name)) return;
    w.npcs.push({ id: NIGHT_NPC_ID + i, kind: d.kind, name: d.name, x: d.x, y: d.y, ...(d.shop ? { shop: d.shop } : {}), nightOnly: true, away: true });
  });
}

/** Meldung, warum ein Laden zu ist (`undefined` = offen) */
export function closedMessage(n: Npc): string | undefined {
  return n.closed ? `${n.name} hat geschlossen. Der Laden öffnet um ${openText(NIGHT_TO)}.` : undefined;
}

function startNight(w: World): void {
  const players = w.actors.filter((a) => a.kind === 'player' && a.alive);
  for (const m of w.actors) if (nightBuffable(w, m)) setNightBuff(m, true);
  const night = nightNumber(w);
  NIGHT_SPAWNS.forEach((sp, si) => {
    // Ruheplätze vorhandener Gegner der Zone (feste Reihenfolge der Akteure), je Nacht anders gewählt
    const homes = w.actors.filter((m) => m.kind === 'monster' && !m.nightSpawn && !m.boss && !m.unique && !m.campId && m.home && regionAt(w, m.home.x, m.home.y)?.name === sp.zone).map((m) => m.home!);
    if (!homes.length) return;
    for (let i = 0; i < sp.count; i++) {
      const h = homes[Math.floor(hash(night, si, i) * homes.length)]!;
      const [dx, dy] = DANGER_OFFSETS[Math.floor(hash(night, si, i + 100) * DANGER_OFFSETS.length)]!;
      const x = h.x + dx;
      const y = h.y + dy;
      if (!isWalkable(w.grid, Math.round(x), Math.round(y)) || inSafeZone(w, x, y)) continue;
      // nicht vor den Füßen eines Spielers erscheinen
      if (players.some((p) => Math.hypot(p.x - x, p.y - y) < 9)) continue;
      const kind = sp.kinds[Math.floor(hash(night, si, i + 200) * sp.kinds.length)]!;
      const m = spawnMonster(w, x, y, kind);
      m.nightSpawn = true;
      m.respawnTicks = 1e9; // wird nach dem Tod aufgeräumt, kommt nicht wieder
      if (nightBuffable(w, m)) setNightBuff(m, true);
    }
  });
}

function endNight(w: World): void {
  for (const m of w.actors) {
    if (m.nightBase) setNightBuff(m, false);
    // Der Morgen vertreibt die Nachtgänger, kämpfende erst nach einer Schonfrist (wie bei Zufallsbegegnungen)
    if (m.nightSpawn) m.expireAt = w.tick;
  }
}

/** Einmal je Sekunde: erkennt den Wechsel Tag/Nacht und löst seine Folgen aus */
export function syncClock(w: World): void {
  if (w.tick % TICK_RATE !== 0) return;
  const night = isNightHour(hourOf(w));
  syncNpcPresence(w);
  if (night === w.night) return;
  w.night = night;
  if (night) startNight(w);
  else endNight(w);
}
