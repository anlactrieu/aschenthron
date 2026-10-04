import { describe, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { MAX_LEVEL, SHOPS, totalXpFor } from './data';
import { templateById, type Item } from './items';
import {
  applyCommand, buyPrice, carriedWeight, carryCapacity, drainEvents, getActor, inSafeZone, maxHpOf, tick, TICK_RATE,
  type Actor, type World,
} from './world';

/**
 * Bot-Messlauf für das Level-Tempo: kämpft nur im Nahkampf, nutzt Heiltränke, sammelt Beute,
 * rüstet Besseres aus, fährt bei Bedarf in die Stadt (verkauft, kauft Tränke und Ausrüstung).
 * Misst Spielzeit bis Level 5/10/20/30 und Tode. Messung, kein Balance-Beweis.
 */
const score = (i: Item) => (i.damage?.[1] ?? 0) * 1.5 + (i.armor ?? 0) * 2 + i.affixes.length * 3;

function townTrip(w: World, p: Actor): boolean {
  const merchant = w.npcs.filter((n) => n.kind === 'merchant').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]!;
  if (Math.hypot(merchant.x - p.x, merchant.y - p.y) > 2.5) {
    if (p.path.length === 0) applyCommand(w, p.id, { type: 'moveTo', x: Math.round(merchant.x), y: Math.round(merchant.y + 1) });
    return false;
  }
  for (const it of [...p.inventory]) if (it.slot !== 'potion') applyCommand(w, p.id, { type: 'sell', itemId: it.id });
  const shop = (SHOPS[merchant.shop ?? 'basic'] ?? []).map(templateById);
  // beste bezahlbare Tränke
  for (let n = p.inventory.filter((i) => i.heal).length; n < 6; n++) {
    const heals = shop.filter((t) => t.heal && buyPrice(t.id) <= p.gold).sort((a, b) => b.heal! - a.heal!);
    if (!heals[0]) break;
    applyCommand(w, p.id, { type: 'buy', templateId: heals[0].id });
  }
  // Ausrüstung: besseres Stück je Slot, solange bezahlbar und anlegbar
  for (const t of shop.filter((x) => x.slot !== 'potion')) {
    const cur = p.equipment[t.slot as keyof typeof p.equipment];
    const val = (t.damage?.[1] ?? 0) * 1.5 + (t.armor ?? 0) * 2;
    if ((!cur || val > score(cur)) && buyPrice(t.id) + 40 <= p.gold && p.attrs.kraft + 0 >= t.reqKraft) {
      applyCommand(w, p.id, { type: 'buy', templateId: t.id });
      const bought = p.inventory[p.inventory.length - 1];
      if (bought && bought.id) applyCommand(w, p.id, { type: 'equip', itemId: bought.id });
    }
  }
  return true;
}

describe('Level-Tempo (Messung)', () => {
  it('Bot-Lauf: Zeit bis Level 5/10/20/30', () => {
    const { world: w, playerId } = buildWorld(2024, mapJson as unknown as TiledMap);
    const p = getActor(w, playerId)!;
    const reached: Record<number, number> = {};
    let deaths = 0;
    let trips = 0;
    let mode: 'hunt' | 'town' = 'hunt';
    const maxTicks = TICK_RATE * 3600 * 12;
    for (let t = 0; t < maxTicks; t++) {
      tick(w);
      for (const e of drainEvents(w)) {
        if (e.type === 'levelUp') reached[e.level] ??= w.tick;
        if (e.type === 'deathPenalty') deaths++;
      }
      if (p.level >= MAX_LEVEL) break;
      if (t % 10 !== 0) continue;
      if (p.statPoints > 0) applyCommand(w, p.id, { type: 'spendStat', attr: p.statPoints % 3 === 0 ? 'ausdauer' : 'kraft' });
      for (const it of [...p.inventory]) {
        if (it.slot === 'potion') continue;
        const cur = p.equipment[it.slot];
        if ((!cur || score(it) > score(cur)) && p.attrs.kraft >= it.reqKraft) applyCommand(w, p.id, { type: 'equip', itemId: it.id });
      }
      const heals = p.inventory.filter((i) => i.heal);
      if (p.hp < maxHpOf(p) * 0.45 && heals.length && !inSafeZone(w, p.x, p.y)) {
        const need = maxHpOf(p) - p.hp;
        const pick = [...heals].sort((a, b) => a.heal! - b.heal!).find((i) => i.heal! >= need) ?? heals[heals.length - 1]!;
        applyCommand(w, p.id, { type: 'usePotion', itemId: pick.id });
      }
      const heavy = carriedWeight(p) > carryCapacity(p) * 0.85;
      const lowSupplies = heals.length === 0 && p.hp < maxHpOf(p) * 0.5;
      if (mode === 'hunt' && (heavy || lowSupplies)) {
        mode = 'town';
        trips++;
        p.targetId = null;
        p.path = [];
      }
      if (mode === 'town') {
        if (townTrip(w, p) && p.hp >= maxHpOf(p) * 0.9) mode = 'hunt';
        continue;
      }
      if (inSafeZone(w, p.x, p.y) && p.hp < maxHpOf(p) * 0.9) continue;
      if (p.targetId !== null || p.path.length > 0) continue;
      const loot = w.ground.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < 6);
      if (loot) {
        applyCommand(w, p.id, { type: 'pickup', groundId: loot.id });
        continue;
      }
      const m = w.actors
        .filter((a) => a.kind === 'monster' && a.alive && !a.boss && a.level <= p.level + 1 && a.level >= p.level - 4)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (m) applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      else if (p.level >= 1) {
        // keine passenden Gegner nah: zum nächsten passenden laufen (beliebig weit)
        const far = w.actors.filter((a) => a.kind === 'monster' && a.alive && !a.boss && a.level <= p.level + 2).sort((a, b) => b.level - a.level)[0];
        if (far) applyCommand(w, p.id, { type: 'attack', targetId: far.id });
      }
    }
    const mins = (tk?: number) => (tk ? `${(tk / TICK_RATE / 60).toFixed(0)} min` : 'nicht erreicht');
    console.log(`PACE Level5 ${mins(reached[5])} | Level10 ${mins(reached[10])} | Level20 ${mins(reached[20])} | Level30 ${mins(reached[30])} | Tode ${deaths} | Stadtfahrten ${trips} | Endlevel ${p.level} | XP-Bedarf Cap ${totalXpFor(MAX_LEVEL)} | Spielzeit ${(w.tick / TICK_RATE / 3600).toFixed(1)} h | kleinster Stufenabstand ok`);
  }, 900000);
});
