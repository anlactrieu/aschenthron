import { describe, expect, it } from 'vitest';
import { generateItem } from './items';
import { BASIC_TEMPO, applyCommand, attackCooldownOf, createWorld, damageRange, drainEvents, hitDamageRange, spawnMonster, spawnPlayer, tick, TICK_RATE } from './world';
import type { Grid } from './path';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });

function fresh(weapon?: string) {
  const w = createWorld(5, open());
  const p = spawnPlayer(w, 20, 20);
  p.level = 10;
  if (weapon) {
    const it = generateItem(w.rng, w.nextId++, weapon, 'normal');
    p.inventory.push(it);
    applyCommand(w, p.id, { type: 'equip', itemId: it.id });
  }
  return { w, p };
}

describe('Grundangriff: weniger, härtere Treffer', () => {
  it('Takt und Schaden je Treffer wachsen um denselben Faktor, der Schaden pro Sekunde bleibt', () => {
    const { w, p } = fresh('steel_sword');
    p.attrs.gewandtheit = 10;
    const [lo, hi] = damageRange(p);
    const [hlo, hhi] = hitDamageRange(p);
    expect(hlo).toBe(Math.round(lo * BASIC_TEMPO));
    expect(hhi).toBe(Math.round(hi * BASIC_TEMPO));
    const base = p.attackCooldown * (p.equipment.weapon?.speed ?? 1);
    expect(attackCooldownOf(p)).toBeCloseTo(base * BASIC_TEMPO, 5);
    // Schaden pro Sekunde (Mittel) bleibt innerhalb der Rundung gleich
    const dps = ((hlo + hhi) / 2) / attackCooldownOf(p);
    const old = ((lo + hi) / 2) / base;
    expect(dps / old).toBeGreaterThan(0.95);
    expect(dps / old).toBeLessThan(1.05);
    // Monster behalten Takt und Schaden
    const m = spawnMonster(w, 21, 20, 'wolf');
    expect(hitDamageRange(m)).toEqual(damageRange(m));
  });

  it('ein normaler Treffer betäubt oder unterbricht das Ziel nicht', () => {
    const { w, p } = fresh('steel_sword');
    const m = spawnMonster(w, 21, 20, 'wolf');
    m.hp = m.maxHp = 1e6;
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    let hits = 0;
    for (let i = 0; i < TICK_RATE * 8; i++) {
      tick(w);
      for (const e of drainEvents(w)) if (e.type === 'hit' && e.attackerId === p.id && !e.skill) hits++;
      expect(m.status.stun ?? 0).toBeLessThanOrEqual(w.tick);
    }
    expect(hits).toBeGreaterThan(3);
  });
});
