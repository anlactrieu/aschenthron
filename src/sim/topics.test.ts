import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { QUESTS, NPC_TOPICS, isGiverOf, questById } from './data';
import { answerOf, canAsk, KEYWORDS, marksOf, openKeys, stripMarks } from './topics';
import { exportPlayer, importPlayer } from './save';
import { validateCommand } from './net';
import { questAvailable } from './quests';
import { applyCommand, createWorld, drainEvents, spawnPlayer, getActor, spawnMonster, tick, type Actor, type Command, type World } from './world';

const map = mapJson as unknown as TiledMap;
const build = (seed = 3) => {
  const { world, playerId } = buildWorld(seed, map);
  return { w: world, p: getActor(world, playerId)! };
};
const hiddenQuests = QUESTS.filter((q) => q.hidden);
const threads = [...new Set(hiddenQuests.map((q) => q.thread))];

/** Stellt den Spieler neben den NPC und führt den Befehl aus. */
const talkTo = (w: World, p: Actor, name: string, cmd: (npcId: number) => Command): void => {
  const n = w.npcs.find((x) => x.name === name)!;
  p.x = n.x;
  p.y = n.y;
  applyCommand(w, p.id, cmd(n.id));
};
const ask = (w: World, p: Actor, npc: string, topic: string) => talkTo(w, p, npc, (npcId) => ({ type: 'askTopic', npcId, topic }));
const turnIn = (w: World, p: Actor, id: string) => {
  const st = p.quests[id]!;
  st.state = 'done';
  st.progress = questById(id)!.count;
  talkTo(w, p, questById(id)!.giver!, () => ({ type: 'turnInQuest', questId: id }));
};
const fails = (w: World) => drainEvents(w).filter((e) => e.type === 'fail');

describe('P2 Themen: Daten', () => {
  it('jeder NPC der Karte hat Themen, alle Stichworte der Einstiegszeile sind beantwortet', () => {
    const { w } = build();
    for (const n of w.npcs) {
      const t = NPC_TOPICS[n.name];
      expect(t, n.name).toBeDefined();
      expect(openKeys(n.name).length, n.name).toBeGreaterThanOrEqual(2);
      for (const k of openKeys(n.name)) expect(answerOf(n.name, k), `${n.name}/${k}`).toBeDefined();
    }
    for (const name of Object.keys(NPC_TOPICS)) expect(w.npcs.some((n) => n.name === name), name).toBe(true);
  });

  it('jedes Stichwort in einem Text hat irgendwo einen NPC mit Antwort', () => {
    const answered = new Set(Object.values(NPC_TOPICS).flatMap((n) => Object.keys(n.topics)));
    for (const [name, t] of Object.entries(NPC_TOPICS)) {
      for (const text of [t.open, ...Object.values(t.topics).flatMap((a) => a.text)]) for (const m of marksOf(text)) expect(answered.has(m.key), `${name}: ${m.key}`).toBe(true);
    }
    expect(stripMarks('Hi [[a|Welt]]!')).toBe('Hi Welt!');
  });

  it('mindestens drei versteckte Ketten mit je drei Gliedern, jedes bei einem NPC der Karte abzugeben', () => {
    const { w } = build();
    expect(threads.length).toBeGreaterThanOrEqual(3);
    for (const th of threads) expect(hiddenQuests.filter((q) => q.thread === th).length, th).toBeGreaterThanOrEqual(3);
    for (const q of hiddenQuests) {
      expect(q.chain, q.id).toBeUndefined();
      expect(w.npcs.filter((n) => isGiverOf(n, q)).map((n) => n.name), q.id).toEqual([q.giver]);
      expect(w.npcs.some((n) => n.quests?.includes(q.id)), q.id).toBe(false);
    }
  });

  it('jedes versteckte Thema ist nur über Stichworte aus anderen Gesprächen erreichbar, jede versteckte Aufgabe hat genau ein Thema', () => {
    const owner = new Map<string, string>();
    for (const [name, t] of Object.entries(NPC_TOPICS)) {
      for (const [key, a] of Object.entries(t.topics)) {
        if (!a.quest) continue;
        expect(openKeys(name).includes(key), `${name}/${key} darf nicht frei sein`).toBe(false);
        const def = questById(a.quest)!;
        expect(def.hidden, a.quest).toBe(true);
        expect(def.giver, a.quest).toBe(name);
        expect(owner.has(a.quest), a.quest).toBe(false);
        owner.set(a.quest, key);
        // das Stichwort wird anderswo gelehrt: im Text eines anderen NPC oder als `teaches` einer anderen Aufgabe
        const fromText = Object.entries(NPC_TOPICS).some(([n2, t2]) => n2 !== name && [t2.open, ...Object.values(t2.topics).flatMap((x) => x.text)].some((s) => marksOf(s).some((m) => m.key === key)));
        const fromQuest = QUESTS.some((q) => q.teaches?.includes(key) && q.giver !== name);
        expect(fromText || fromQuest, `${name}/${key} wird nirgends gelehrt`).toBe(true);
      }
    }
    for (const q of hiddenQuests) expect(owner.has(q.id), q.id).toBe(true);
    for (const q of QUESTS) for (const k of q.teaches ?? []) expect(KEYWORDS.has(k), k).toBe(true);
  });

  it('versteckte Aufgaben tauchen nirgends als annehmbar oder als nächster Schritt auf', () => {
    const { p } = build();
    p.level = 30;
    for (const q of hiddenQuests) expect(questAvailable(p, q), q.id).toBe(false);
  });
});

describe('P2 Themen: Befehl askTopic', () => {
  it('freie Stichworte gehen sofort, versteckte erst nach dem Hören; zu weit weg und Unbekanntes scheitern', () => {
    const { w, p } = build();
    p.level = 30;
    ask(w, p, 'Hauptmann Brandt', 'rotschal');
    expect(fails(w).length).toBe(1);
    expect(p.topics ?? []).not.toContain('rotschal');
    ask(w, p, 'Kräuterfrau Odda', 'schlafmohn');
    expect(p.topics).toEqual(expect.arrayContaining(['schlafmohn', 'rotschal']));
    // fremde Frage: Odda weiß nichts über Gurrak
    ask(w, p, 'Kräuterfrau Odda', 'gurrak');
    expect(fails(w).length).toBe(1);
    // zu weit weg
    const odda = w.npcs.find((n) => n.name === 'Kräuterfrau Odda')!;
    p.x = odda.x + 50;
    applyCommand(w, p.id, { type: 'askTopic', npcId: odda.id, topic: 'kraeuter' });
    expect(fails(w).length).toBe(1);
  });

  it('Kette Rotschal: Stichwort → Auftrag → Abgabe lehrt das nächste Stichwort bei einem anderen NPC', () => {
    const { w, p } = build();
    p.level = 12;
    ask(w, p, 'Kräuterfrau Odda', 'schlafmohn');
    ask(w, p, 'Hauptmann Brandt', 'rotschal');
    expect(p.quests.h_rot1?.state).toBe('active');
    // nochmal fragen legt keinen zweiten Auftrag an
    ask(w, p, 'Hauptmann Brandt', 'rotschal');
    expect(p.quests.h_rot1?.state).toBe('active');
    expect(p.topics).not.toContain('tunnel');
    const gold = p.gold;
    turnIn(w, p, 'h_rot1');
    expect(p.quests.h_rot1?.state).toBe('turned');
    expect(p.gold).toBeGreaterThan(gold);
    expect(p.topics).toContain('tunnel');
    ask(w, p, 'Jägerin Ysa', 'tunnel');
    expect(p.quests.h_rot2?.state).toBe('active');
    turnIn(w, p, 'h_rot2');
    ask(w, p, 'Händlerin Mirel', 'schmugglerbuch');
    expect(p.quests.h_rot3?.state).toBe('active');
  });

  it('Abgabe nur beim eigenen Geber, in Reichweite', () => {
    const { w, p } = build();
    p.level = 12;
    ask(w, p, 'Kräuterfrau Odda', 'schlafmohn');
    ask(w, p, 'Hauptmann Brandt', 'rotschal');
    p.quests.h_rot1!.state = 'done';
    talkTo(w, p, 'Jägerin Ysa', (npcId) => { void npcId; return { type: 'turnInQuest', questId: 'h_rot1' }; });
    expect(p.quests.h_rot1!.state).toBe('done');
    talkTo(w, p, 'Hauptmann Brandt', () => ({ type: 'turnInQuest', questId: 'h_rot1' }));
    expect(p.quests.h_rot1!.state).toBe('turned');
  });

  it('zu niedrige Stufe: der NPC weicht aus, nur das Stichwort bleibt im Notizbuch', () => {
    const { w, p } = build();
    p.level = 3;
    ask(w, p, 'Kräuterfrau Odda', 'schlafmohn');
    ask(w, p, 'Hauptmann Brandt', 'rotschal');
    expect(p.quests.h_rot1).toBeUndefined();
    expect(p.topics).toContain('rotschal');
    p.level = 4;
    ask(w, p, 'Hauptmann Brandt', 'rotschal');
    expect(p.quests.h_rot1?.state).toBe('active');
  });

  it('Kette Schüler: Lager-Glied ist sofort erfüllt, wenn das Lager schon geräumt ist', () => {
    const { w, p } = build();
    p.level = 12;
    const camp = w.camps.find((c) => c.id === 'spinnenhoehle')!;
    camp.cleared = true;
    p.topics = ['netz'];
    ask(w, p, 'Hauptmann Brandt', 'netz');
    expect(p.quests.h_tam2?.state).toBe('done');
  });

  it('bestehende Aufträge bleiben erreichbar (Annehmen und Gesprächsaufgabe)', () => {
    const { w, p } = build();
    talkTo(w, p, 'Hauptmann Brandt', () => ({ type: 'acceptQuest', questId: 'q_rats' }));
    expect(p.quests.q_rats?.state).toBe('active');
    p.quests.c_first3 = { state: 'turned', progress: 1 }; // Ankunft folgt auf den ersten Auftrag
    talkTo(w, p, 'Hafenmeister Joren', () => ({ type: 'acceptQuest', questId: 'c_arr1' }));
    expect(p.quests.c_arr1?.state).toBe('active');
    talkTo(w, p, 'Lehrer Varn', (npcId) => ({ type: 'talk', npcId }));
    expect(p.quests.c_arr1?.state).toBe('turned');
  });

  it('Töte-Aufgaben mit verstecktem Thema starten nicht von selbst beim Jagen', () => {
    for (const [id, kind] of [['h_rot3', 'bandit_captain'], ['h_asche3', 'death_knight']] as const) {
      expect(questById(id)!.target).toBe(kind);
      const w = createWorld(5, { w: 40, h: 40, walkable: new Array(1600).fill(true) });
      const p = spawnPlayer(w, 10, 10);
      p.level = 30;
      p.damage = [9999, 9999];
      p.maxHp = p.hp = 1e6;
      const m = spawnMonster(w, 11, 10, kind);
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      for (let i = 0; i < 200 && m.alive; i++) tick(w);
      expect(m.alive, id).toBe(false);
      expect(p.quests[id], id).toBeUndefined();
    }
  });

  it('Befehl wird vom Netz geprüft', () => {
    const { w } = build();
    expect(validateCommand(w, { type: 'askTopic', npcId: 3, topic: 'rotschal' })).toEqual({ type: 'askTopic', npcId: 3, topic: 'rotschal' });
    expect(validateCommand(w, { type: 'askTopic', npcId: 3, topic: 'Rot Schal!' })).toBeNull();
    expect(validateCommand(w, { type: 'askTopic', npcId: 'x', topic: 'a' })).toBeNull();
    expect(validateCommand(w, { type: 'askTopic', npcId: 3 })).toBeNull();
  });

  it('canAsk: frei nur in der Einstiegszeile, sonst bekannt', () => {
    expect(canAsk('Hauptmann Brandt', 'raeuber', [])).toBe(true);
    expect(canAsk('Hauptmann Brandt', 'rotschal', [])).toBe(false);
    expect(canAsk('Hauptmann Brandt', 'rotschal', ['rotschal'])).toBe(true);
    expect(canAsk('Hauptmann Brandt', 'gurrak', ['gurrak'])).toBe(false);
  });
});

describe('P2 Themen: Spielstand', () => {
  it('Stichworte und versteckter Auftrag überleben Speichern und Laden', () => {
    const a = build();
    a.p.level = 12;
    ask(a.w, a.p, 'Kräuterfrau Odda', 'schlafmohn');
    ask(a.w, a.p, 'Hauptmann Brandt', 'rotschal');
    const json = exportPlayer(a.p);
    const b = build();
    expect(importPlayer(b.w, b.p, json)).toBe(true);
    expect(b.p.topics).toEqual(a.p.topics);
    expect(b.p.quests.h_rot1?.state).toBe('active');
  });

  it('alter Spielstand ohne Stichworte lädt mit leerem Notizbuch; Unbekanntes fällt weg', () => {
    const a = build();
    const o = JSON.parse(exportPlayer(a.p)) as { player: Record<string, unknown> };
    delete o.player.topics;
    const b = build();
    expect(importPlayer(b.w, b.p, JSON.stringify(o))).toBe(true);
    expect(b.p.topics).toEqual([]);
    o.player.topics = ['rotschal', 'gibtesnicht', 5, 'rotschal'];
    o.player.quests = { h_rot1: { state: 'active', progress: 1 }, gibt_es_nicht: { state: 'active', progress: 0 } };
    const c = build();
    importPlayer(c.w, c.p, JSON.stringify(o));
    expect(c.p.topics).toEqual(['rotschal']);
    expect(Object.keys(c.p.quests)).toEqual(['h_rot1']);
  });
});

describe('Gerüchte (Gefahrenorte und Nachthändler)', () => {
  it('jeder Gefahrenort wird in einem Stadtgespräch erwähnt', async () => {
    const { DANGER_SPOTS } = await import('./data');
    const all = Object.values(NPC_TOPICS).flatMap((n) => Object.values(n.topics).flatMap((a) => a.text));
    for (const d of DANGER_SPOTS) expect(all.some((t) => t.includes(d.name.split(' ')[0]!) || t.includes(d.name)), d.id).toBe(true);
  });
  it('mindestens zwei Stadt-NPCs erwähnen Hehler Grau und Nachthändlerin Vess mit offenem Stichwort', () => {
    const who = ['Händlerin Mirel', 'Händler Dorn'].filter((n) => {
      const t = NPC_TOPICS[n]!;
      return openKeys(n).some((k) => /Grau|Vess/.test(t.topics[k]?.text.join(' ') ?? ''));
    });
    expect(who.length).toBe(2);
  });
  it('das Gerücht ist im Gespräch abrufbar', () => {
    const { w, p } = build();
    ask(w, p, 'Hauptmann Brandt', 'roehricht');
    expect(fails(w)).toHaveLength(0);
    expect(canAsk('Hauptmann Brandt', 'roehricht', p.topics)).toBe(true);
    expect(p.topics).toContain('roehricht');
  });
});
