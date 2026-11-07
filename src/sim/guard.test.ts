import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { BEGINNER_ZONE, DANGER_PACK, GUARD, monsterKind } from './data';
import { ROUTE, routeDist, routeLength, routePingPong } from './route';
import { isWalkable } from './path';
import { addPlayer, applyCommand, getActor, inBeginnerZone, spawnMonster, tick, TICK_RATE, type Actor, type World } from './world';
import { makeSnapshot } from './net';

/** Kämpfende Wachpatrouille (P5): zwei Straßenwachen auf der Handelsstraße, echte Wesen der Sim. */
const map = mapJson as unknown as TiledMap;
const build = (seed = 3) => {
  const { world, playerId } = buildWorld(seed, map);
  // nur die Monster der Tests (die der Karte stören die Messung); Spieler unverwundbar
  world.actors = world.actors.filter((a) => a.kind !== 'monster');
  Object.assign(getActor(world, playerId)!, { maxHp: 1e6, hp: 1e6 });
  return { w: world, p: getActor(world, playerId)!, guards: world.actors.filter((a) => a.kind === 'guard') };
};
const at = (a: Actor, x: number, y: number) => Object.assign(a, { x, y, path: [] });
/** Wachen auf ein Streckenstück setzen (Weglänge `s` der ersten Wache) */
const place = (guards: Actor[], s: number) => {
  guards.forEach((g, i) => {
    g.patrol!.s = s - i * GUARD.gap;
    const p = routePingPong(g.patrol!.s);
    at(g, p.x, p.y);
  });
};
/** Begehbares Feld in der Nähe von (x+dx, y+dy) */
const spot = (w: World, x: number, y: number, dx: number, dy: number): [number, number] => {
  for (let r = 0; r < 6; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
    const px = Math.round(x) + dx + i;
    const py = Math.round(y) + dy + j;
    if (isWalkable(w.grid, px, py)) return [px, py];
  }
  throw new Error('kein Feld');
};
const mon = (w: World, g: Actor, dx: number, dy: number, kind: string, opts: { champ?: string } = {}) => spawnMonster(w, ...spot(w, g.x, g.y, dx, dy), kind, opts);
const run = (w: World, ticks: number) => { for (let i = 0; i < ticks; i++) tick(w); };
/** Streckenpunkt ohne Stadt und Anfängerzone (x ab 77 liegt hinter der Zone) */
const FIELD_S = 60;

describe('Straßenwache', () => {
  it('steht mit festem Wert auf der Strecke, zwei Stück, ohne die Kennung des Spielers zu ändern', () => {
    const { w, p, guards } = build();
    expect(guards).toHaveLength(GUARD.count);
    expect(p.id).toBeLessThan(guards[0]!.id);
    for (const g of guards) {
      expect(g.alive && g.hp === GUARD.hp && g.level === GUARD.level).toBe(true);
      expect(routeDist(g.x, g.y)).toBeLessThan(1);
    }
    expect(w.actors.filter((a) => a.kind === 'monster').every((a) => a.packId < DANGER_PACK || a.home)).toBe(true);
  });

  it('die ganze Strecke ist begehbar (Streife nimmt keinen Umweg)', () => {
    const { w } = build();
    for (let s = 0; s <= routeLength() * 2; s += 0.5) {
      const p = routePingPong(s);
      expect(isWalkable(w.grid, Math.round(p.x), Math.round(p.y))).toBe(true);
    }
  });

  it('geht die Strecke hin und zurück, auch wenn kein Spieler in der Nähe ist', () => {
    const { w, p, guards } = build();
    at(p, 20, 20); // weit weg (Schutz egal)
    const s0 = guards[0]!.patrol!.s;
    run(w, 400);
    expect(guards[0]!.patrol!.awake).toBe(false);
    expect(guards[0]!.patrol!.s).toBeCloseTo(s0 + 400 * GUARD.walkSpeed, 5);
    const g = guards[0]!;
    expect(routeDist(g.x, g.y)).toBeLessThan(1);
    // Umkehr am Ende: nach einer Hin-und-zurück-Strecke wieder am Anfang
    g.patrol!.s = routeLength() + 3;
    run(w, 1);
    expect(routePingPong(g.patrol!.s).dir).toBe(-1);
  });

  it('hilft dem Spieler: erlegt einen Verfolger am Straßenrand', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    const g = guards[0]!;
    const m = mon(w, g, 6, 4, 'goblin');
    at(p, g.x - 3, g.y);
    Object.assign(p, { maxHp: 1e6, hp: 1e6 });
    m.targetId = p.id;
    m.autoAttack = true;
    run(w, TICK_RATE * 20);
    expect(m.alive).toBe(false);
    expect(g.xp).toBe(0);
    expect(p.hp).toBeGreaterThan(0);
  });

  it('greift auch ein Monster am Streckenrand an, das niemanden jagt', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    const g = guards[0]!;
    const m = mon(w, g, 7, 0, 'goblin_scout');
    at(p, g.x - 2, g.y - 2);
    const hp0 = m.maxHp;
    run(w, TICK_RATE * 12);
    expect(m.hp < hp0 || !m.alive).toBe(true);
  });

  it('lässt Anfängerzone, Gefahrenorte, Champions, Bosse und Unikate in Ruhe (nur auf Streife)', () => {
    const { w, p, guards } = build();
    // Anfängerzone: Strecke dort liegt bei x 48–76
    const z = BEGINNER_ZONE;
    place(guards, 20);
    const g0 = guards[0]!;
    expect(inBeginnerZone(w, g0.x, g0.y)).toBe(true);
    const rat = mon(w, g0, 3, 0, 'field_rat');
    at(p, g0.x - 2, g0.y);
    run(w, TICK_RATE * 5);
    expect(rat.hp).toBe(rat.maxHp);
    expect(g0.targetId).not.toBe(rat.id);
    expect(z.x).toBeLessThan(g0.x);
    // außerhalb: Gefahrenort-Rudel, Champion, Boss
    place(guards, FIELD_S);
    const g = guards[0]!;
    at(p, g.x - 2, g.y - 2);
    const danger = mon(w, g, 5, 0, 'wolf');
    danger.packId = DANGER_PACK + 1;
    const champ = mon(w, g, 5, 2, 'wolf', { champ: 'swift' });
    const boss = mon(w, g, -5, 0, 'field_rat');
    boss.boss = true;
    run(w, TICK_RATE * 5);
    for (const m of [danger, champ, boss]) expect(m.hp).toBe(m.maxHp);
  });

  it('ist kein Ziel für Spieler: kein Angriff, keine Fläche, kein Skill', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    const g = guards[0]!;
    at(p, g.x - 1, g.y);
    Object.assign(p, { damage: [500, 500] });
    applyCommand(w, p.id, { type: 'attack', targetId: g.id });
    expect(p.targetId).toBeNull();
    run(w, TICK_RATE * 3);
    expect(g.hp).toBe(g.maxHp);
  });

  it('Kill allein bringt nichts, mit Mithilfe des Spielers zählt sein Anteil (XP an ihn, nicht an die Wache)', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    const g = guards[0]!;
    at(p, g.x - 4, g.y - 3);
    const solo = mon(w, g, 4, 0, 'goblin');
    solo.hp = 1;
    const loot0 = w.ground.length;
    const xp0 = p.xp;
    run(w, TICK_RATE * 15);
    expect(solo.alive).toBe(false);
    expect(w.ground.length).toBe(loot0);
    expect(p.xp).toBe(xp0);
    // mit Mithilfe
    const shared = mon(w, g, 4, 1, 'goblin');
    shared.hp = 1;
    shared.damagers[p.id] = w.tick;
    run(w, TICK_RATE * 15);
    expect(shared.alive).toBe(false);
    expect(p.xp).toBeGreaterThan(xp0);
    expect(g.xp).toBe(0);
  });

  it('geteilter Kill: jeder beteiligte Spieler bekommt seine eigene XP genau einmal', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    const g = guards[0]!;
    const p2 = addPlayer(w, 'Zweiter');
    Object.assign(p2, { maxHp: 1e6, hp: 1e6 });
    at(p, g.x - 4, g.y - 3);
    at(p2, g.x - 4, g.y - 2);
    const m = mon(w, g, 4, 0, 'goblin');
    m.hp = 1;
    m.damagers[p.id] = w.tick;
    m.damagers[p2.id] = w.tick;
    const x1 = p.xp;
    const x2 = p2.xp;
    run(w, TICK_RATE * 15);
    expect(m.alive).toBe(false);
    const gain = monsterKind('goblin').xp;
    expect(p.xp - x1).toBe(gain);
    expect(p2.xp - x2).toBe(gain);
  });

  it('wehrt sich in der Anfängerzone gegen ein Monster, das sie angreift, greift dort aber nichts von sich aus an', () => {
    const { w, p, guards } = build();
    place(guards, 20);
    const g = guards[0]!;
    expect(inBeginnerZone(w, g.x, g.y)).toBe(true);
    at(p, g.x - 6, g.y);
    const rat = mon(w, g, 1, 0, 'field_rat');
    rat.maxHp = rat.hp = 1e5;
    rat.targetId = g.id;
    rat.autoAttack = true;
    run(w, TICK_RATE * 6);
    expect(rat.hp).toBeLessThan(rat.maxHp);
    expect(g.targetId).toBe(rat.id);
  });

  it('fällt, wartet und kehrt am Hafen zurück', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    const g = guards[0]!;
    at(p, g.x - 3, g.y);
    g.hp = 1;
    const wolf = mon(w, g, 2, 0, 'dire_wolf');
    wolf.targetId = g.id;
    run(w, TICK_RATE * 5);
    expect(g.alive).toBe(false);
    const died = g.diedAt;
    run(w, GUARD.respawnTicks - (w.tick - died) - 1);
    expect(g.alive).toBe(false);
    run(w, 2);
    expect(g.alive).toBe(true);
    expect(g.hp).toBe(g.maxHp);
    expect(g.patrol!.s).toBeGreaterThanOrEqual(g.patrol!.s0);
    expect(g.x).toBeLessThan(ROUTE[1]![0]);
  });

  it('erscheint im Netz-Schnappschuss als Wache (nur Hinweis, keine Monsterart)', () => {
    const { w, p, guards } = build();
    place(guards, FIELD_S);
    at(p, guards[0]!.x - 3, guards[0]!.y);
    const snap = makeSnapshot(w, p, []);
    const lite = snap.actors.filter((a) => a.kind === 'guard');
    expect(lite).toHaveLength(2);
    expect(lite[0]!.kindId).toBeUndefined();
  });
});
