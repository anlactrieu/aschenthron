import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { applyCommand, drainEvents, getActor, inSafeZone, tick, TICK_RATE } from './world';

const map = mapJson as unknown as TiledMap;

/**
 * Wolf-Hänger (Pace-Bot, Seed 21): Am Ostrand von Aschenhafen (Schutzzone endet bei x < 49) stand der Spieler bei x 48,6,
 * der Wolf direkt davor bei 49,5. Das Rundungsbild (49,142) verbarg, dass der Spieler noch in der Stadt war: der Auto-Angriff
 * kehrte stumm zurück, das Ziel blieb für immer gesetzt, nichts geschah und keine Meldung kam.
 */
describe('Angriff am Rand der Schutzzone', () => {
  const setup = () => {
    const { world: w, playerId } = buildWorld(21, map);
    for (const m of w.actors.filter((a) => a.kind === 'monster')) m.alive = false;
    const p = getActor(w, playerId)!;
    p.x = 48.6;
    p.y = 142;
    p.path = [];
    const wolf = w.actors.find((a) => a.kindId === 'dire_wolf')!;
    wolf.alive = true;
    wolf.hp = wolf.maxHp;
    wolf.x = 49.6;
    wolf.y = 142;
    wolf.home = { x: 49.6, y: 142 };
    drainEvents(w);
    return { w, p, wolf };
  };

  it('Ausgangslage: Spieler in der Stadt, Wolf davor', () => {
    const { w, p, wolf } = setup();
    expect(inSafeZone(w, p.x, p.y)).toBe(true);
    expect(inSafeZone(w, wolf.x, wolf.y)).toBe(false);
  });

  it('der Spieler schlägt aus der Stadt nicht zu, das Ziel wird mit Meldung verworfen statt ewig zu hängen', () => {
    const { w, p, wolf } = setup();
    applyCommand(w, p.id, { type: 'attack', targetId: wolf.id });
    for (let i = 0; i < TICK_RATE * 3; i++) tick(w);
    expect(p.targetId).toBeNull();
    expect(wolf.hp).toBe(wolf.maxHp);
    expect(drainEvents(w).some((e) => e.type === 'fail' && e.reason === 'In der Stadt ist Kämpfen verboten.')).toBe(true);
  });
});
