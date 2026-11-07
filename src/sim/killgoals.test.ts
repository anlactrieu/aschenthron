import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { KILL_GOALS, LOOT_GROUPS, MONSTERS, NPC_TOPICS, QUESTS, isGiverOf, questById } from './data';
import { KILL_GOAL_SPECS, killGoalKey, killGoalQuestId } from './killGoals';
import { answerOf, marksOf, openKeys } from './topics';
import { questAvailable, nextStep } from './quests';
import { exportPlayer, importPlayer } from './save';
import { actorFromLite, makeSnapshot } from './net';
import { applyCommand, drainEvents, getActor, spawnMonster, tick, TICK_RATE, type Actor, type Command, type World } from './world';
import { GUARD } from './data';
import { routePingPong } from './route';
import { isWalkable } from './path';

const map = mapJson as unknown as TiledMap;
const build = (seed = 3) => {
  const { world, playerId } = buildWorld(seed, map);
  world.actors = world.actors.filter((a) => a.kind !== 'monster');
  return { w: world, p: getActor(world, playerId)! };
};
const talkTo = (w: World, p: Actor, name: string, cmd: (npcId: number) => Command): void => {
  const n = w.npcs.find((x) => x.name === name)!;
  p.x = n.x;
  p.y = n.y;
  applyCommand(w, p.id, cmd(n.id));
};
const ask = (w: World, p: Actor, npc: string, topic: string) => talkTo(w, p, npc, (npcId) => ({ type: 'askTopic', npcId, topic }));
const turnIn = (w: World, p: Actor, id: string) => talkTo(w, p, questById(id)!.giver!, () => ({ type: 'turnInQuest', questId: id }));
const spot = (w: World, x: number, y: number, dx: number, dy: number): [number, number] => {
  for (let r = 0; r < 6; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (isWalkable(w.grid, x + dx + i, y + dy + j)) return [x + dx + i, y + dy + j];
  throw new Error('kein Feld');
};
/** erlegt ein Monster der Gruppe neben dem Spieler */
const slay = (w: World, p: Actor, kindId: string) => {
  // draußen vor dem Stadttor (in der Stadt wird nicht gekämpft)
  Object.assign(p, { x: 62, y: 150, damage: [9999, 9999], maxHp: 1e6, hp: 1e6 });
  const [mx, my] = spot(w, 62, 150, 1, 0);
  const m = spawnMonster(w, mx, my, kindId);
  applyCommand(w, p.id, { type: 'attack', targetId: m.id });
  for (let i = 0; i < 300 && m.alive; i++) tick(w);
  expect(m.alive).toBe(false);
};

describe('Kill-Ziel als Auftrag: Daten', () => {
  it('jede Beute-Gruppe hat zwei versteckte Aufträge (100 und 500 Kills) mit Gebern auf der Karte', () => {
    const { w } = build();
    expect(KILL_GOAL_SPECS.map((s) => s.group).sort()).toEqual(LOOT_GROUPS.map((g) => g.id).sort());
    for (const sp of KILL_GOAL_SPECS) {
      const g = LOOT_GROUPS.find((x) => x.id === sp.group)!;
      expect(sp.lv, sp.group).toBe(Math.min(...g.monsters.map((id) => MONSTERS.find((m) => m.id === id)!.level)));
      ([1, 2] as const).forEach((stage) => {
        const q = questById(killGoalQuestId(sp.group, stage))!;
        expect(q.kind).toBe('goal');
        expect(q.hidden).toBe(true);
        expect(q.count).toBe(KILL_GOALS[stage - 1]);
        expect(q.group).toBe(sp.group);
        expect(w.npcs.filter((n) => isGiverOf(n, q)).map((n) => n.name), q.id).toEqual([stage === 1 ? sp.b : sp.a]);
        expect(w.npcs.some((n) => n.quests?.includes(q.id)), q.id).toBe(false);
      });
      expect(questById(killGoalQuestId(sp.group, 2))!.requires).toBe(killGoalQuestId(sp.group, 1));
      expect(questById(killGoalQuestId(sp.group, 2))!.reward).toBe('rare');
      // das erste Stichwort nennt `a` frei, `b` gibt den Auftrag; das zweite lehrt die Abgabe von Stufe 1
      expect(openKeys(sp.a)).toContain(killGoalKey(sp.group, 1));
      expect(openKeys(sp.b)).not.toContain(killGoalKey(sp.group, 1));
      expect(answerOf(sp.b, killGoalKey(sp.group, 1))?.quest).toBe(killGoalQuestId(sp.group, 1));
      expect(answerOf(sp.a, killGoalKey(sp.group, 2))?.quest).toBe(killGoalQuestId(sp.group, 2));
      expect(openKeys(sp.a)).not.toContain(killGoalKey(sp.group, 2));
      expect(questById(killGoalQuestId(sp.group, 1))!.teaches).toEqual([killGoalKey(sp.group, 2)]);
      expect(marksOf(NPC_TOPICS[sp.a]!.topics[killGoalKey(sp.group, 2)]!.text.join(' ')).map((m) => m.key)).toContain(killGoalKey(sp.group, 2));
    }
  });

  it('Kopfgelder sind nie annehmbar und starten nicht von selbst beim Jagen', () => {
    const { w, p } = build();
    p.level = 30;
    for (const q of QUESTS.filter((x) => x.kind === 'goal')) expect(questAvailable(p, q), q.id).toBe(false);
    slay(w, p, 'field_rat');
    expect(Object.keys(p.quests).filter((id) => id.startsWith('k1_') || id.startsWith('k2_'))).toEqual([]);
  });
});

describe('Kill-Ziel als Auftrag: Ablauf', () => {
  it('Stichwort → Auftrag → Kills zählen → Abgabe → Folgeauftrag', () => {
    const { w, p } = build();
    // erst das Stichwort bei a, sonst weiß b nichts
    ask(w, p, 'Hafenmeister Joren', 'jagd_rats');
    expect(drainEvents(w).filter((e) => e.type === 'fail')).toHaveLength(1);
    expect(p.quests.k1_rats).toBeUndefined();
    ask(w, p, 'Kräuterfrau Odda', 'jagd_rats');
    expect(p.topics).toContain('jagd_rats');
    p.kills = { field_rat: 97 };
    ask(w, p, 'Hafenmeister Joren', 'jagd_rats');
    expect(p.quests.k1_rats).toMatchObject({ state: 'active', progress: 97 });
    ask(w, p, 'Hafenmeister Joren', 'jagd_rats');
    expect(Object.keys(p.quests).filter((id) => id === 'k1_rats')).toHaveLength(1);
    // drei weitere Ratten (summoned zählen nicht, hier keine)
    for (let i = 0; i < 2; i++) slay(w, p, 'field_rat');
    expect(p.quests.k1_rats).toMatchObject({ state: 'active', progress: 99 });
    slay(w, p, 'burrow_rat');
    expect(p.quests.k1_rats).toMatchObject({ state: 'done', progress: 100 });
    // Abgabe nur bei b
    talkTo(w, p, 'Kräuterfrau Odda', () => ({ type: 'turnInQuest', questId: 'k1_rats' }));
    expect(p.quests.k1_rats!.state).toBe('done');
    const gold = p.gold;
    turnIn(w, p, 'k1_rats');
    expect(p.quests.k1_rats!.state).toBe('turned');
    expect(p.gold).toBeGreaterThan(gold);
    expect(p.topics).toContain('jagd2_rats');
    // Stufe 2 bei a: Zähler schon bei 100, braucht 500
    ask(w, p, 'Kräuterfrau Odda', 'jagd2_rats');
    expect(p.quests.k2_rats).toMatchObject({ state: 'active', progress: 100 });
    p.kills = { field_rat: 499 };
    slay(w, p, 'field_rat');
    expect(p.quests.k2_rats!.state).toBe('done');
    expect(nextStep(w, p)!.kind).toBe('turnin');
    const items = p.inventory.length + w.ground.length;
    turnIn(w, p, 'k2_rats');
    expect(p.quests.k2_rats!.state).toBe('turned');
    expect(p.inventory.length + w.ground.length).toBe(items + 1);
  });

  it('bereits erreichte Kill-Ziele sind sofort erfüllt; zu niedrige Stufe weicht aus', () => {
    const { w, p } = build();
    p.level = 2;
    p.topics = ['jagd_goblins'];
    p.kills = { goblin: 150 };
    ask(w, p, 'Hauptmann Brandt', 'jagd_goblins');
    expect(p.quests.k1_goblins).toMatchObject({ state: 'done', progress: 100 });
    // Räuber ab Stufe 3
    p.topics = ['jagd_bandits'];
    ask(w, p, 'Jägerin Ysa', 'jagd_bandits');
    expect(p.quests.k1_bandits).toBeUndefined();
    p.level = 3;
    ask(w, p, 'Jägerin Ysa', 'jagd_bandits');
    expect(p.quests.k1_bandits?.state).toBe('active');
  });

  it('Spielstand: Roundtrip, Alt-Stand ohne Kopfgelder lädt', () => {
    const { w, p } = build();
    p.kills = { field_rat: 40 };
    p.topics = ['jagd_rats'];
    ask(w, p, 'Hafenmeister Joren', 'jagd_rats');
    const o = JSON.parse(exportPlayer(p)) as { player: { quests: Record<string, unknown> } };
    expect(Object.keys(o.player.quests)).toContain('k1_rats');
    const b = build();
    expect(importPlayer(b.w, b.p, JSON.stringify(o))).toBe(true);
    expect(b.p.quests.k1_rats).toMatchObject({ state: 'active', progress: 40 });
    delete o.player.quests.k1_rats;
    expect(importPlayer(build().w, build().p, JSON.stringify(o))).toBe(true);
  });

  it('Wachen-Kills zählen nicht als Kills des Spielers, Anrechnung nur bei Mitkampf', () => {
    const { w, p } = build();
    const g = w.actors.find((a) => a.kind === 'guard')!;
    const pt = routePingPong(60);
    Object.assign(g, { x: pt.x, y: pt.y, path: [] });
    Object.assign(p, { x: pt.x - 20, y: pt.y, maxHp: 1e6, hp: 1e6 });
    p.kills = {};
    const m = spawnMonster(w, Math.round(g.x) + 1, Math.round(g.y), 'goblin');
    m.hp = 1;
    for (let i = 0; i < TICK_RATE * 15 && m.alive; i++) tick(w);
    expect(GUARD.count).toBeGreaterThan(0);
    expect(m.alive).toBe(false); // die Wache hat ihn erlegt
    expect(p.kills).toEqual({});
  });
});

describe('Titel über dem Kopf: Mehrspieler', () => {
  it('der gewählte Titel steht im Netz-Snapshot anderer Spieler und kommt beim Client an', () => {
    const { w, p } = build();
    const other = spawnPlayerNear(w, p);
    other.titles = ['Rattenfänger'];
    other.title = 'Rattenfänger';
    const snap = makeSnapshot(w, p, []);
    const lite = snap.actors.find((a) => a.id === other.id)!;
    expect(lite.title).toBe('Rattenfänger');
    expect(actorFromLite(lite, snap.tick).title).toBe('Rattenfänger');
    // Monster tragen keinen Titel
    const m = spawnMonster(w, Math.round(p.x) + 2, Math.round(p.y), 'field_rat');
    expect(makeSnapshot(w, p, []).actors.find((a) => a.id === m.id)!.title).toBeUndefined();
    delete other.title;
    expect(makeSnapshot(w, p, []).actors.find((a) => a.id === other.id)!.title).toBeUndefined();
  });
});

import { spawnPlayer } from './world';
function spawnPlayerNear(w: World, p: Actor): Actor {
  return spawnPlayer(w, Math.round(p.x) + 1, Math.round(p.y));
}
