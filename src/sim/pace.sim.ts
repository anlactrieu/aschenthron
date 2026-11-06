import { describe, it } from 'vitest';
import { hourOf } from './clock';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { MAX_LEVEL, SHOPS, totalXpFor } from './data';
import { pickMerchant, nightCare, openShops, pickTarget, repaired, SpotWatch, StuckWatch, type BotVariant } from './pacebot';
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

function townTrip(w: World, p: Actor, bot: BotVariant): boolean {
  const merchant = pickMerchant(w, p, bot);
  if (!merchant) return true;
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

/**
 * Varianten: PACE_BOT=old|fa18|new|vess (Standard vess, siehe pacebot.ts); PACE_NIGHT=0 friert die Uhr auf 12 Uhr ein (Kontrolllauf ohne Nacht).
 */
const BOT = (process.env.PACE_BOT ?? 'vess') as BotVariant;

describe('Level-Tempo (Messung)', () => {
  it('Bot-Lauf: Zeit bis Level 5/10/20/30', () => {
    const { world: w, playerId } = buildWorld(Number(process.env.PACE_SEED ?? 2024), mapJson as unknown as TiledMap);
    const p = getActor(w, playerId)!;
    const reached: Record<number, number> = {};
    let deaths = 0;
    const deathLevels: Record<number, number> = {};
    let trips = 0;
    let waited = 0; // Ticks, die der Bot nachts in der Stadt auf die Öffnung wartet
    const lastHits: string[] = [];
    let mode: 'hunt' | 'town' | 'wait' = 'town'; // wie ein echter Spieler: erst mit dem Startgold einkaufen
    const maxTicks = TICK_RATE * 3600 * Number(process.env.PACE_HOURS ?? 40); // Ziel Stufe 30 nach 20–30 h (P3)
    if (process.env.PACE_NIGHT === '0') w.fixedHour = 12; // Kontrolllauf ohne Nacht
    const spots = new SpotWatch(BOT);
    const stuck = new StuckWatch(BOT);
    let stuckCount = 0;
    let prev: { x: number; y: number };
    let prevTid: number | null;
    for (let t = 0; t < maxTicks; t++) {
      prev = { x: p.x, y: p.y };
      prevTid = p.targetId;
      tick(w);
      const events = drainEvents(w);
      spots.addEvents(events, p.id);
      for (const e of events) {
        if (e.type === 'hit' && e.targetId === p.id) lastHits.push(getActor(w, e.attackerId)?.name ?? '?');
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
      // P6: Läden nachts zu. `old` fährt trotzdem (Dauerschleife), `fa18` jagt weiter, `new`/`vess` warten in der Stadt, wenn die Tränke knapp sind
      const shopsOpen = BOT === 'old' || openShops(w, BOT).length > 0;
      const care = repaired(BOT) ? nightCare(w, p, BOT) : { caution: false, wait: false };
      if (mode === 'hunt' && shopsOpen && (heavy || lowSupplies)) {
        mode = 'town';
        trips++;
        p.targetId = null;
        p.path = [];
      } else if (mode === 'hunt' && care.wait) {
        mode = 'wait';
        p.targetId = null;
        p.path = [];
      }
      if (mode === 'hunt' && stuck.step(w, p, TICK_RATE)) {
        stuckCount++;
        p.targetId = null;
        p.path = [];
      }
      if (mode === 'hunt' && spots.step(w, p, 10, TICK_RATE)) {
        if (process.env.PACE_SPOTS) console.log(`WEITER nach ${(w.tick / TICK_RATE / 60).toFixed(0)} min L${p.level} @${Math.round(p.x)},${Math.round(p.y)}`);
        p.targetId = null;
        p.path = [];
      }
      if (mode === 'wait') {
        // wie ein Spieler: zum Händler gehen, dort (Schutzzone) heilen und bis zur Öffnung warten
        if (shopsOpen) { mode = 'town'; trips++; continue; }
        const home = w.npcs.filter((n) => n.kind === 'merchant').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (home && !inSafeZone(w, p.x, p.y) && p.path.length === 0) applyCommand(w, p.id, { type: 'moveTo', x: Math.round(home.x), y: Math.round(home.y + 1) });
        waited += 10;
        continue;
      }
      if (process.env.PACE_TRACE && t % (TICK_RATE * 600) === 0) console.log(`TRACE ${(w.tick / TICK_RATE / 60).toFixed(0)} min L${p.level} mode ${mode} @${Math.round(p.x)},${Math.round(p.y)} hp ${Math.round(p.hp)}/${maxHpOf(p)} heals ${p.inventory.filter((i) => i.heal).length} gold ${p.gold} open ${shopsOpen} tgt ${p.targetId} path ${p.path.length} ${(() => { const tg = p.targetId !== null ? getActor(w, p.targetId) : undefined; return tg ? `${tg.name} L${tg.level}@${Math.round(tg.x)},${Math.round(tg.y)} alive ${tg.alive} night ${!!tg.nightSpawn}` : '-'; })()} h ${hourOf(w).toFixed(1)}`);
      if (mode === 'town') {
        if (!shopsOpen) mode = repaired(BOT) && care.wait ? 'wait' : 'hunt';
        else if (townTrip(w, p, BOT) && p.hp >= maxHpOf(p) * 0.9) mode = 'hunt';
        continue;
      }
      if (inSafeZone(w, p.x, p.y) && p.hp < maxHpOf(p) * 0.9) continue;
      if (p.targetId !== null || p.path.length > 0) continue;
      const loot = w.ground.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < 6);
      if (loot) {
        applyCommand(w, p.id, { type: 'pickup', groundId: loot.id });
        continue;
      }
      const target = pickTarget(w, p, { bot: BOT, free: (a) => !spots.banned(w, a.x, a.y) && !stuck.ignored(w, a.id), caution: care.caution });
      if (target) applyCommand(w, p.id, { type: 'attack', targetId: target.id });
    }
    const mins = (tk?: number) => (tk ? `${(tk / TICK_RATE / 60).toFixed(0)} min` : 'nicht erreicht');
    console.log(`PACE Level5 ${mins(reached[5])} | Level10 ${mins(reached[10])} | Level20 ${mins(reached[20])} | Level30 ${mins(reached[30])} | Tode ${deaths} | Stadtfahrten ${trips} | Endlevel ${p.level} | XP-Bedarf Cap ${totalXpFor(MAX_LEVEL)} | Spielzeit ${(w.tick / TICK_RATE / 3600).toFixed(1)} h | Hänger ${stuckCount} | Warten ${(waited / TICK_RATE / 60).toFixed(0)} min | Bot ${BOT} Nacht ${process.env.PACE_NIGHT === '0' ? 'aus' : 'an'} | Tode je Level ${JSON.stringify(deathLevels)}`);
  }, 1800000);
});
