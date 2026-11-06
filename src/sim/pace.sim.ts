import { describe, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { MAX_LEVEL, SHOPS, totalXpFor, xpToNext } from './data';
import { handsOf, templateById, type Item } from './items';
import {
  missingReq, damageRange, applyCommand, regionAt, buyPrice, armorOf, carryCapacity, drainEvents, getActor, inSafeZone, maxHpOf, tick, TICK_RATE,
  type Actor, type World,
} from './world';

/**
 * Bot-Messlauf für das Level-Tempo: kämpft nur im Nahkampf, nutzt Heiltränke, sammelt Beute,
 * rüstet Besseres aus, fährt bei Bedarf in die Stadt (verkauft, kauft Tränke und Ausrüstung).
 * Misst Spielzeit bis Level 5/10/20/30 und Tode. Messung, kein Balance-Beweis.
 */
const score = (i: Item) => (i.damage?.[1] ?? 0) * 1.5 + (i.armor ?? 0) * 2 + i.affixes.length * 3;

function townTrip(w: World, p: Actor): boolean {
  const byDist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y);
  const merchants = w.npcs.filter((n) => n.kind === 'merchant').sort(byDist);
  const merchant = merchants.find((n) => !n.closed && !n.away) ?? merchants[0]!;
  if (Math.hypot(merchant.x - p.x, merchant.y - p.y) > 2.5) {
    if (p.path.length === 0) applyCommand(w, p.id, { type: 'moveTo', x: Math.round(merchant.x), y: Math.round(merchant.y + 1) });
    return false;
  }
  for (const it of [...p.inventory]) if (it.slot !== 'potion') applyCommand(w, p.id, { type: 'sell', itemId: it.id });
  // überzählige Tränke verkaufen (Bot hortet sonst Mana-Tränke und gilt für immer als überladen)
  const keep = new Map<string, number>();
  for (const it of [...p.inventory]) {
    if (it.slot !== 'potion') continue;
    const kind = it.heal ? 'heal' : 'mana';
    const n = (keep.get(kind) ?? 0) + 1;
    keep.set(kind, n);
    if (n > (kind === 'heal' ? 12 : 3)) applyCommand(w, p.id, { type: 'sell', itemId: it.id });
  }
  const shop = (SHOPS[merchant.shop ?? 'basic'] ?? []).map(templateById);
  // beste bezahlbare Tränke
  for (let n = p.inventory.filter((i) => i.heal).length; n < 6; n++) {
    const heals = shop.filter((t) => t.heal && buyPrice(t.id) <= p.gold).sort((a, b) => b.heal! - a.heal!);
    if (!heals[0]) break;
    applyCommand(w, p.id, { type: 'buy', templateId: heals[0].id });
  }
  // Ausrüstung: besseres Stück je Slot, solange bezahlbar und anlegbar
  for (const t of shop.filter((x) => x.slot !== 'potion' && x.slot !== 'gem' && x.off !== 'arrows' && x.kind === undefined && x.hands !== 2 && !x.req)) {
    const cur = p.equipment[t.slot as keyof typeof p.equipment];
    const val = (t.damage?.[1] ?? 0) * 1.5 + (t.armor ?? 0) * 2;
    if ((!cur || val > score(cur)) && buyPrice(t.id) + 40 <= p.gold && p.attrs.kraft >= t.reqKraft && p.level >= Math.max(1, t.minLevel - 1) && !t.req && t.kind === undefined) {
      applyCommand(w, p.id, { type: 'buy', templateId: t.id });
      const bought = p.inventory[p.inventory.length - 1];
      if (bought && bought.id) applyCommand(w, p.id, { type: 'equip', itemId: bought.id });
    }
  }
  return true;
}

/** Wie ein Spieler: Wirft ein Platz zu wenig XP ab (Aufstieg dauert länger als STALL_MIN), zieht der Bot weiter und meidet ihn eine Weile. */
const WINDOW_MIN = 20;
const STALL_MIN = 240;
const BAN_MIN = 90;
const BAN_RADIUS = 25;

describe('Level-Tempo (Messung)', () => {
  it('Bot-Lauf: Zeit bis Level 5/10/20/30', () => {
    const { world: w, playerId } = buildWorld(Number(process.env.PACE_SEED ?? 2024), mapJson as unknown as TiledMap);
    const p = getActor(w, playerId)!;
    const reached: Record<number, number> = {};
    let deaths = 0;
    const deathLevels: Record<number, number> = {};
    let trips = 0;
    const lastHits: string[] = [];
    let mode: 'hunt' | 'town' = 'town'; // wie ein echter Spieler: erst mit dem Startgold einkaufen
    const maxTicks = TICK_RATE * 3600 * Number(process.env.PACE_HOURS ?? 40); // Ziel Stufe 30 nach 20–30 h (P3)
    let gained = 0; // XP-Gewinn im laufenden Fenster (nur Jagd, Stadtfahrten zählen nicht)
    let windowTicks = 0;
    const bans: { x: number; y: number; until: number }[] = [];
    const banned = (x: number, y: number) => bans.some((b) => b.until > w.tick && Math.hypot(b.x - x, b.y - y) < BAN_RADIUS);
    let prev: { x: number; y: number };
    let prevTid: number | null;
    for (let t = 0; t < maxTicks; t++) {
      prev = { x: p.x, y: p.y };
      prevTid = p.targetId;
      tick(w);
      for (const e of drainEvents(w)) {
        if (e.type === 'hit' && e.targetId === p.id) lastHits.push(getActor(w, e.attackerId)?.name ?? '?');
        if (e.type === 'xp' && (e.to === undefined || e.to === p.id)) gained += e.amount;
        if (e.type === 'levelUp') { reached[e.level] ??= w.tick; if (process.env.PACE_LEVELS) console.log(`LEVEL ${e.level} nach ${(w.tick / TICK_RATE / 60).toFixed(0)} min @${Math.round(p.x)},${Math.round(p.y)} ${regionAt(w, p.x, p.y)?.name ?? '-'} hp ${maxHpOf(p)} ar ${armorOf(p)} dmg ${damageRange(p).join('-')}`); }
        if (e.type === 'deathPenalty') {
          deaths++;
          if (process.env.PACE_DEATHS) { const nm = w.actors.filter((a) => a.kind === 'monster' && a.alive).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; console.log(`DEATH L${p.level} @${Math.round(prev.x)},${Math.round(prev.y)} ${regionAt(w, prev.x, prev.y)?.name ?? '-'} ziel ${(() => { const tg = prevTid !== null ? getActor(w, prevTid) : undefined; return tg ? `${tg.name} L${tg.level}@${Math.round(tg.x)},${Math.round(tg.y)}` : '-'; })()} bei ${nm?.name} (${nm?.champ ?? '-'}) killer ${[...new Set(lastHits.slice(-12))].join('/')} hp max ${maxHpOf(p)} armor ${armorOf(p)}`); }
          deathLevels[p.level] = (deathLevels[p.level] ?? 0) + 1;
        }
      }
      if (p.level >= MAX_LEVEL) break;
      if (t % 10 !== 0) continue;
      if (p.statPoints > 0) applyCommand(w, p.id, { type: 'spendStat', attr: (['kraft', 'ausdauer', 'kraft', 'gewandtheit', 'ausdauer'] as const)[p.statPoints % 5]! });
      for (const it of [...p.inventory]) {
        // Zweihänder, Edelsteine ignoriert der Bot (kein Nebenhand-Management)
        if (it.slot === 'potion' || it.slot === 'gem' || it.off === 'arrows' || it.kind === 'bow' || it.kind === 'staff' || handsOf(it) === 2) continue;
        const cur = p.equipment[it.slot];
        if ((!cur || score(it) > score(cur)) && missingReq(p, it).length === 0) applyCommand(w, p.id, { type: 'equip', itemId: it.id });
      }
      const heals = p.inventory.filter((i) => i.heal);
      if (p.hp < maxHpOf(p) * 0.45 && heals.length && !inSafeZone(w, p.x, p.y)) {
        const need = maxHpOf(p) - p.hp;
        const pick = [...heals].sort((a, b) => a.heal! - b.heal!).find((i) => i.heal! >= need) ?? heals[heals.length - 1]!;
        applyCommand(w, p.id, { type: 'usePotion', itemId: pick.id });
      }
      const heavy = p.inventory.reduce((n, i) => n + i.weight, 0) > carryCapacity(p) * 0.45;
      const lowSupplies = heals.length === 0 && p.hp < maxHpOf(p) * 0.5;
      // P6: Läden nachts zu – dann nicht in die Stadt fahren, sondern weiterjagen (Wartezeit würde die Messung verfälschen)
      const shopsOpen = w.npcs.some((n) => n.kind === 'merchant' && !n.closed && !n.away);
      if (mode === 'hunt' && shopsOpen && (heavy || lowSupplies)) {
        mode = 'town';
        trips++;
        p.targetId = null;
        p.path = [];
      }
      if (mode === 'hunt') {
        windowTicks += 10;
        if (windowTicks >= WINDOW_MIN * 60 * TICK_RATE) {
          const rate = gained / WINDOW_MIN; // XP je Minute
          if (rate * STALL_MIN < xpToNext(p.level) && !banned(p.x, p.y)) {
            bans.push({ x: p.x, y: p.y, until: w.tick + BAN_MIN * 60 * TICK_RATE });
            if (process.env.PACE_SPOTS) console.log(`WEITER nach ${(w.tick / TICK_RATE / 60).toFixed(0)} min L${p.level} @${Math.round(p.x)},${Math.round(p.y)} rate ${rate.toFixed(1)} XP/min, Bedarf ${xpToNext(p.level)}`);
            p.targetId = null;
            p.path = [];
          }
          gained = 0;
          windowTicks = 0;
        }
      }
      if (mode === 'town') {
        if (!shopsOpen) mode = 'hunt';
        else if (townTrip(w, p) && p.hp >= maxHpOf(p) * 0.9) mode = 'hunt';
        continue;
      }
      if (inSafeZone(w, p.x, p.y) && p.hp < maxHpOf(p) * 0.9) continue;
      if (p.targetId !== null || p.path.length > 0) continue;
      const loot = w.ground.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < 6);
      if (loot) {
        applyCommand(w, p.id, { type: 'pickup', groundId: loot.id });
        continue;
      }
      const free = (a: Actor) => !banned(a.x, a.y);
      const m = w.actors
        .filter((a) => a.kind === 'monster' && a.alive && !a.boss && !a.unique && a.level <= p.level + 1 && a.level >= p.level - 4 && free(a))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (m) applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      else if (p.level >= 1) {
        // keine passenden Gegner nah: zum nächsten passenden laufen (beliebig weit)
        const farAll = w.actors.filter((a) => a.kind === 'monster' && a.alive && !a.boss && !a.unique && a.level <= p.level + 2);
        const far = (farAll.some(free) ? farAll.filter(free) : farAll).sort((a, b) => b.level - a.level)[0];
        if (far) applyCommand(w, p.id, { type: 'attack', targetId: far.id });
      }
    }
    const mins = (tk?: number) => (tk ? `${(tk / TICK_RATE / 60).toFixed(0)} min` : 'nicht erreicht');
    console.log(`PACE Level5 ${mins(reached[5])} | Level10 ${mins(reached[10])} | Level20 ${mins(reached[20])} | Level30 ${mins(reached[30])} | Tode ${deaths} | Stadtfahrten ${trips} | Endlevel ${p.level} | XP-Bedarf Cap ${totalXpFor(MAX_LEVEL)} | Spielzeit ${(w.tick / TICK_RATE / 3600).toFixed(1)} h | Tode je Level ${JSON.stringify(deathLevels)}`);
  }, 1800000);
});
