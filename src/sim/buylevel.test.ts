import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { START_HOUR, TICKS_PER_HOUR } from './clock';
import { applyCommand, buyBlock, drainEvents, getActor, tick, TICK_RATE } from './world';

const map = mapJson as unknown as TiledMap;

describe('Kaufstufe bei Tränken', () => {
  it('Riesiger Heiltrank ist erst ab Stufe 20 kaufbar (wie Ausrüstung: Vorlagenstufe − 1), Ausrüstung bleibt auf Vorrat kaufbar', () => {
    const { world: w, playerId } = buildWorld(3, map);
    const p = getActor(w, playerId)!;
    const hehler = w.npcs.find((n) => n.name === 'Hehler Grau')!;
    p.x = hehler.x + 1;
    p.y = hehler.y;
    p.gold = 5000;
    w.tick = Math.round((23 - START_HOUR) * TICKS_PER_HOUR);
    w.tick -= w.tick % TICK_RATE;
    for (let i = 0; i < TICK_RATE; i++) tick(w);
    p.level = 5;
    drainEvents(w);
    const gold = p.gold;
    applyCommand(w, p.id, { type: 'buy', templateId: 'heal_huge' });
    const ev = drainEvents(w);
    expect(ev.some((e) => e.type === 'fail' && e.reason === 'Benötigt Stufe 20.')).toBe(true);
    expect(p.gold).toBe(gold);
    expect(p.inventory.some((i) => i.templateId === 'heal_huge')).toBe(false);
    expect(buyBlock(p, 'heal_huge')).toBe('Benötigt Stufe 20.');
    expect(buyBlock(p, 'heal_small')).toBeNull();
    expect(buyBlock(p, 'wisdom_amulet')).toBeNull();
    p.level = 20;
    expect(buyBlock(p, 'heal_huge')).toBeNull();
    applyCommand(w, p.id, { type: 'buy', templateId: 'heal_huge' });
    expect(p.inventory.some((i) => i.templateId === 'heal_huge')).toBe(true);
  });
});
