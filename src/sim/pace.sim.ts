import { describe, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { totalXpFor } from './data';
import { applyCommand, drainEvents, getActor, inSafeZone, tick, TICK_RATE } from './world';

/**
 * Einfacher Bot (nur Nahkampf, sammelt Beute, rüstet Besseres aus, geht bei niedrigem Leben in die Stadt).
 * Dient der Messung des Level-Tempos, nicht als Balance-Beweis.
 */
describe('Level-Tempo (Messung)', () => {
  it('Bot-Lauf: Zeit bis Level 5/10/20', () => {
    const { world: w, playerId } = buildWorld(2024, mapJson as unknown as TiledMap);
    const p = getActor(w, playerId)!;
    p.gold = 0;
    applyCommand(w, p.id, { type: 'spendStat', attr: 'kraft' });
    const reached: Record<number, number> = {};
    let deaths = 0;
    const score = (i: { damage?: [number, number]; armor?: number; affixes: unknown[] }) => (i.damage?.[1] ?? 0) + (i.armor ?? 0) * 2 + i.affixes.length;
    for (let t = 0; t < TICK_RATE * 3600 * 6; t++) {
      tick(w);
      for (const e of drainEvents(w)) {
        if (e.type === 'levelUp') reached[e.level] ??= w.tick;
        if (e.type === 'deathPenalty') deaths++;
      }
      if (p.level >= 20) break;
      if (t % 10 !== 0) continue;
      if (p.statPoints > 0) applyCommand(w, p.id, { type: 'spendStat', attr: p.statPoints % 2 ? 'kraft' : 'ausdauer' });
      for (const it of [...p.inventory]) {
        if (it.slot === 'potion') continue;
        const cur = p.equipment[it.slot];
        if (!cur || score(it) > score(cur)) applyCommand(w, p.id, { type: 'equip', itemId: it.id });
      }
      p.inventory = p.inventory.slice(0, 10);
      if (p.hp < 0.4 * 100 + p.level * 6 && !inSafeZone(w, p.x, p.y)) {
        applyCommand(w, p.id, { type: 'moveTo', x: Math.round(w.start.x), y: Math.round(w.start.y) });
        continue;
      }
      if (inSafeZone(w, p.x, p.y) && p.hp < p.maxHp * 0.9) continue;
      if (p.targetId !== null || p.path.length > 0) continue;
      const loot = w.ground.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < 6);
      if (loot) {
        applyCommand(w, p.id, { type: 'pickup', groundId: loot.id });
        continue;
      }
      const m = w.actors
        .filter((a) => a.kind === 'monster' && a.alive && a.level <= p.level + 2)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (m) applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    }
    const mins = (tk?: number) => (tk ? `${(tk / TICK_RATE / 60).toFixed(1)} min` : 'nicht erreicht');
    console.log(`PACE Level5 ${mins(reached[5])} | Level10 ${mins(reached[10])} | Level20 ${mins(reached[20])} | Tode ${deaths} | Endlevel ${p.level} | XP-Bedarf L20 ${totalXpFor(20)}`);
  }, 120000);
});
