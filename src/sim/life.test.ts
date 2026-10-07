import { describe, expect, it } from 'vitest';
import type { Grid } from './path';
import { addNpc, createWorld, setupPatrols, spawnMonster, spawnPlayer, tick, type World } from './world';

const big = (): Grid => ({ w: 80, h: 80, walkable: new Array(6400).fill(true) });
const run = (w: World, ticks: number, each?: () => void) => {
  for (let i = 0; i < ticks; i++) {
    tick(w);
    each?.();
  }
};
const pack = (w: World) => {
  const a = spawnMonster(w, 40, 40, 'goblin');
  const b = spawnMonster(w, 41, 40, 'goblin');
  a.packId = b.packId = 7;
  setupPatrols(w);
  return [a, b] as const;
};

describe('Lebendige Welt', () => {
  it('Rudel patrouillieren gemeinsam im Umkreis ihres Platzes, solange niemand in der Nähe ist', () => {
    const w = createWorld(3, big());
    spawnPlayer(w, 40, 62);                                   // im Wachbereich, aber weit außerhalb der Aggro-Reichweite
    const [a, b] = pack(w);
    expect(w.packs.size).toBe(1);
    let far = 0;
    let apart = 0;
    run(w, 20 * 120, () => {
      far = Math.max(far, Math.hypot(a.x - 40, a.y - 40), Math.hypot(b.x - 41, b.y - 40));
      apart = Math.max(apart, Math.hypot(a.x - b.x, a.y - b.y));
    });
    expect(far).toBeGreaterThan(1.5);
    expect(far).toBeLessThanOrEqual(9);
    expect(apart).toBeLessThan(6);
    expect(a.targetId).toBeNull();
  });

  it('beim Entdecken des Spielers endet das Schlendern, nach dem Kampf geht es zurück in die Patrouille', () => {
    const w = createWorld(3, big());
    const p = spawnPlayer(w, 40, 62);
    const [a, b] = pack(w);
    run(w, 20 * 20);
    p.x = a.x + 2;
    p.y = a.y;
    run(w, 3);
    expect(a.targetId).toBe(p.id);
    expect(a.patrolling).toBe(false);
    expect(b.targetId).toBe(p.id);
    p.x = 40;
    p.y = 75;                                                 // weit weg: Verfolgung bricht ab
    run(w, 20 * 60);
    expect(a.targetId).toBeNull();
    expect(Math.hypot(a.x - 40, a.y - 40)).toBeLessThanOrEqual(9);
  });

  it('Bosse und einzelne Monster ohne Rudel-Id patrouillieren nicht', () => {
    const w = createWorld(3, big());
    spawnPlayer(w, 40, 62);
    const lone = spawnMonster(w, 40, 40, 'goblin');
    lone.packId = 0;
    setupPatrols(w);
    expect(w.packs.size).toBe(0);
    run(w, 20 * 60);
    expect(lone.x).toBe(40);
  });

  it('NPCs schlendern nur im Einzelspieler-Modus, nie weit von ihrem Platz, und stehen still, wenn jemand bei ihnen ist', () => {
    const w = createWorld(3, big());
    const p = spawnPlayer(w, 40, 62);
    const n = addNpc(w, 'merchant', 'Händler', 40, 40, { wander: 2 });
    run(w, 20 * 60);
    expect(n.x).toBe(40);                                     // npcWander aus
    w.npcWander = true;
    let far = 0;
    let moved = false;
    run(w, 20 * 90, () => {
      far = Math.max(far, Math.hypot(n.x - 40, n.y - 40));
      moved ||= n.x !== 40 || n.y !== 40;
    });
    expect(moved).toBe(true);
    expect(far).toBeLessThanOrEqual(3);
    p.x = n.x + 1;
    p.y = n.y;
    const { x, y } = n;
    run(w, 20 * 30);
    expect(n.x).toBe(x);
    expect(n.y).toBe(y);
  });
});
