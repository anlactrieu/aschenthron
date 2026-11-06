import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { BEGINNER_ZONE, DANGER_SPOTS, monsterKind, NIGHT, questById } from './data';
import { hourOf, isNightHour, NEW_CHAR_HOUR, nightNumber, START_HOUR, TICKS_PER_HOUR } from './clock';
import { syncClock } from './night';
import { nextStep, questAvailable, questMarks } from './quests';
import { pickTarget } from './pacebot';
import {
  applyCommand, beginnerKind, buyPrice, createWorld, drainEvents, getActor, inBeginnerZone, inSafeZone, spawnMonster, tick, TICK_RATE,
  type Actor, type Command, type World,
} from './world';

/** Einstieg für Neulinge (SPEC): Morgenstart, Anfängerzone vor Aschenhafen, erster Auftrag bei Joren. */
const map = mapJson as unknown as TiledMap;
const build = (seed = 3) => {
  const { world, playerId } = buildWorld(seed, map);
  return { w: world, p: getActor(world, playerId)! };
};
const npc = (w: World, name: string) => w.npcs.find((n) => n.name === name)!;
const at = (p: Actor, x: number, y: number) => Object.assign(p, { x, y, path: [] });
const talkTo = (w: World, p: Actor, name: string, cmd: (npcId: number) => Command): void => {
  const n = npc(w, name);
  at(p, n.x, n.y + 1);
  applyCommand(w, p.id, cmd(n.id));
};
/** Tötet den Gegner über den normalen Kampf (Spieler unverwundbar und überstark) */
const slay = (w: World, p: Actor, m: Actor): void => {
  Object.assign(p, { damage: [9999, 9999], maxHp: 1e6, hp: 1e6 });
  at(p, m.x - 1, m.y);
  applyCommand(w, p.id, { type: 'attack', targetId: m.id });
  for (let i = 0; i < 200 && m.alive; i++) tick(w);
  expect(m.alive).toBe(false);
};
const zoneMonsters = (w: World) => w.actors.filter((a) => a.kind === 'monster' && a.home && inBeginnerZone(w, a.home.x, a.home.y));
/** Osttor und Nordausgang von Aschenhafen (letzte Felder der Schutzzone) */
const GATES = [{ x: 48, y: 141 }, { x: 31, y: 131 }];
/** So weit kann ein fremder Gegner höchstens kommen: Leine (14) + Wahrnehmung nachts */
const REACH = 14 + 5 + NIGHT.aggro;

describe('Einstieg: Startzeit', () => {
  it('neue Charaktere starten um 7 Uhr, ohne Angabe bleibt die Welt bei 8 Uhr (geladene Spielstände)', () => {
    expect(NEW_CHAR_HOUR).toBe(7);
    expect(hourOf({ tick: 0, startHour: NEW_CHAR_HOUR })).toBe(7);
    const w = createWorld(1, { w: 4, h: 4, walkable: new Array(16).fill(true) });
    expect(w.startHour).toBeUndefined();
    expect(hourOf(w)).toBe(START_HOUR);
  });

  it('vor der ersten Nacht liegen 14 Spielstunden, die Nachtnummer springt um 21 Uhr', () => {
    const c = { tick: 0, startHour: NEW_CHAR_HOUR };
    expect(isNightHour(hourOf(c))).toBe(false);
    expect(nightNumber(c)).toBe(0);
    c.tick = 14 * TICKS_PER_HOUR - 1;
    expect(isNightHour(hourOf(c))).toBe(false);
    expect(nightNumber(c)).toBe(0);
    c.tick = 14 * TICKS_PER_HOUR;
    expect(isNightHour(hourOf(c))).toBe(true);
    expect(nightNumber(c)).toBe(1);
  });

  it('der Pace-Bot startet wie ein neuer Charakter', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('./pace.sim.ts', import.meta.url), 'utf8'));
    expect(src).toContain('w.startHour = NEW_CHAR_HOUR');
  });
});

describe('Einstieg: Anfängerzone', () => {
  it('umfasst beide Ausgänge der Stadt', () => {
    const { w } = build();
    for (const g of GATES) {
      expect(inSafeZone(w, g.x, g.y)).toBe(true);
      expect(inBeginnerZone(w, g.x + (g.y === 141 ? 2 : 0), g.y - (g.y === 131 ? 2 : 0))).toBe(true);
    }
  });

  it('dort leben nur Ratten und Wildhunde der Stufe 1–3, ohne Champions und Unikate', () => {
    const { w } = build();
    const inside = zoneMonsters(w);
    expect(inside.length).toBeGreaterThanOrEqual(15);
    for (const m of inside) {
      expect(beginnerKind(m), `${m.kindId}@${m.home!.x},${m.home!.y}`).toBe(true);
      expect(monsterKind(m.kindId!).level).toBeLessThanOrEqual(BEGINNER_ZONE.maxLevel);
    }
    // genug Feldratten für den ersten Auftrag
    expect(inside.filter((m) => m.kindId === 'field_rat').length).toBeGreaterThanOrEqual(8);
  });

  it('Gefahrenorte, Rattenkönig und alle fremden Gegner bleiben außer Reichweite der Tore', () => {
    const { w } = build();
    for (const d of DANGER_SPOTS) expect(inBeginnerZone(w, d.x, d.y), d.id).toBe(false);
    const king = w.actors.find((a) => a.unique === 'rat_king')!;
    expect(inBeginnerZone(w, king.x, king.y)).toBe(false);
    for (const m of w.actors) {
      if (m.kind !== 'monster' || !m.home || beginnerKind(m)) continue;
      for (const g of GATES) expect(Math.hypot(m.home.x - g.x, m.home.y - g.y), `${m.kindId}@${m.home.x},${m.home.y}`).toBeGreaterThan(REACH);
    }
  });

  it('kein Rudel patrouilliert mit fremden Arten in die Zone', () => {
    const { w } = build();
    for (const [id, pk] of w.packs) {
      const mem = w.actors.filter((a) => a.packId === id && a.kind === 'monster');
      if (mem.every(beginnerKind)) continue;
      for (const pt of pk.pts.slice(1)) expect(inBeginnerZone(w, pt.x, pt.y), `Rudel ${id}`).toBe(false);
    }
  });

  it('nachts erscheinen dort keine Zusatzgegner, über viele Nächte', () => {
    const { w } = build();
    w.startHour = NEW_CHAR_HOUR;
    for (let night = 0; night < 30; night++) {
      // Sprung kurz vor 21 Uhr der nächsten Nacht, dann ein Tick auf die volle Sekunde
      w.tick = (night * 24 + 14) * TICKS_PER_HOUR - TICK_RATE;
      syncClock(w);
      w.tick += TICK_RATE;
      syncClock(w);
      expect(w.night).toBe(true);
      const spawned = w.actors.filter((a) => a.nightSpawn && a.alive);
      expect(spawned.length).toBeGreaterThan(0);
      for (const m of spawned) expect(inBeginnerZone(w, m.x, m.y), `${m.kindId}@${m.x},${m.y}`).toBe(false);
      w.tick += 9 * TICKS_PER_HOUR; // Morgen: Nachtgänger verschwinden
      syncClock(w);
    }
  });

  it('fremde Gegner greifen niemanden in der Zone an und lassen Verfolgte dort ziehen; Ratten schon', () => {
    const { w, p } = build();
    Object.assign(p, { maxHp: 1e6, hp: 1e6 });
    const wolf = spawnMonster(w, 80, 158, 'dire_wolf');
    at(p, 75, 158); // 5 Felder, in der Zone
    for (let i = 0; i < 40; i++) tick(w);
    expect(wolf.targetId).toBeNull();
    at(p, 83, 158); // draußen: der Wolf greift an
    for (let i = 0; i < 40 && wolf.targetId === null; i++) tick(w);
    expect(wolf.targetId).toBe(p.id);
    at(p, 70, 158); // zurück in die Zone: er lässt ab
    for (let i = 0; i < 40 && wolf.targetId !== null; i++) tick(w);
    expect(wolf.targetId).toBeNull();
    const rat = spawnMonster(w, 66, 150, 'field_rat');
    at(p, 64, 150);
    for (let i = 0; i < 40 && rat.targetId === null; i++) tick(w);
    expect(rat.targetId).toBe(p.id);
  });

  it('beim Wandern in der Zone gibt es keine Hinterhalte oder wandernden Anführer', () => {
    const { w, p } = build();
    Object.assign(p, { maxHp: 1e6, hp: 1e6, damage: [9999, 9999] });
    w.fixedHour = 12;
    w.npcWander = true; // Zufallsereignisse gibt es nur im Einzelspieler
    const before = w.actors.length;
    let events = 0;
    at(p, 52, 141);
    for (let leg = 0; leg < 30; leg++) {
      applyCommand(w, p.id, { type: 'moveTo', x: leg % 2 ? 52 : 72, y: 141 });
      for (let i = 0; i < 200; i++) tick(w);
      events += drainEvents(w).filter((e) => e.type === 'wildEvent').length;
    }
    expect(events).toBe(0);
    expect(w.actors.filter((a) => a.expireAt !== undefined)).toHaveLength(0);
    expect(w.actors.length).toBe(before);
  });

  it('Hinweise schicken Neulinge auf die Anfängerfelder, nicht zum Rattenkönig', () => {
    const { w, p } = build();
    p.quests.c_first3 = { state: 'turned', progress: 1 };
    for (const id of ['c_arr1', 'c_arr2', 'c_arr3', 'c_arr4', 'c_arr5']) p.quests[id] = { state: 'turned', progress: 1 };
    for (const lv of [1, 2, 3]) {
      p.level = lv;
      at(p, 60, 150);
      const s = nextStep(w, p)!;
      expect(s.text, `Stufe ${lv}`).not.toContain('Knabber');
      if (s.kind === 'zone') expect(inBeginnerZone(w, s.x!, s.y!)).toBe(true);
    }
  });

  it('der Pace-Bot `neu` jagt bis Stufe 3 nur in der Zone', () => {
    const { w, p } = build();
    at(p, 85, 155);
    const t = pickTarget(w, p, { bot: 'neu', free: () => true })!;
    expect(inBeginnerZone(w, t.x, t.y)).toBe(true);
    p.level = 4;
    expect(pickTarget(w, p, { bot: 'neu', free: () => true })).toBeDefined();
  });
});

describe('Einstieg: erster Auftrag', () => {
  it('Joren am Startpunkt gibt ihn, Schritt für Schritt mit Markierung: Mirel → Ratten → Joren → Varn', () => {
    const { w, p } = build();
    const joren = npc(w, 'Hafenmeister Joren');
    expect(Math.hypot(joren.x - w.start.x, joren.y - w.start.y)).toBeLessThan(10);
    // Vor dem Annehmen: der nächste Schritt ist Joren
    let s = nextStep(w, p)!;
    expect(s.text).toContain('Vorrat für draußen');
    expect([s.x, s.y]).toEqual([joren.x, joren.y]);
    expect(questAvailable(p, questById('c_arr1')!)).toBe(false);

    talkTo(w, p, 'Hafenmeister Joren', () => ({ type: 'acceptQuest', questId: 'c_first1' }));
    expect(p.quests.c_first1?.state).toBe('active');
    const mirel = npc(w, 'Händlerin Mirel');
    expect(questMarks(w, p).map((m) => [m.x, m.y])).toEqual([[mirel.x, mirel.y]]);
    expect(nextStep(w, p)!.text).toContain('Händlerin Mirel');

    // (a) zwei kleine Heiltränke kaufen
    const gold = p.gold;
    talkTo(w, p, 'Händlerin Mirel', () => ({ type: 'buy', templateId: 'heal_small' }));
    expect(p.quests.c_first1?.progress).toBe(1);
    applyCommand(w, p.id, { type: 'buy', templateId: 'heal_small' });
    expect(p.gold).toBeLessThan(gold);
    expect(p.quests.c_first1?.state).toBe('turned');
    expect(p.quests.c_first2?.state).toBe('active');

    // (b) Feldratten vor dem Tor: die Markierung zeigt auf eine Ratte in der Zone; die freie Rattenplage startet nicht nebenher
    const mark = questMarks(w, p)[0]!;
    expect(inBeginnerZone(w, mark.x, mark.y)).toBe(true);
    s = nextStep(w, p)!;
    expect(s.text).toContain('Ratten vor dem Tor');
    expect(s.text).toContain(BEGINNER_ZONE.name);
    const rats = zoneMonsters(w).filter((m) => m.kindId === 'field_rat');
    for (const r of rats.slice(0, 5)) slay(w, p, r);
    expect(p.quests.q_rats).toBeUndefined();
    expect(p.quests.c_first2?.state).toBe('turned');
    expect(p.quests.c_first3?.state).toBe('active');

    // (c) zurück zu Joren, danach zeigt alles auf Varn
    expect(questMarks(w, p).map((m) => [m.x, m.y])).toEqual([[joren.x, joren.y]]);
    expect(nextStep(w, p)!.text).toContain('Hafenmeister Joren');
    drainEvents(w);
    talkTo(w, p, 'Hafenmeister Joren', (npcId) => ({ type: 'talk', npcId }));
    expect(p.quests.c_first3?.state).toBe('turned');
    expect(p.quests.c_arr1?.state).toBe('active');
    const varn = npc(w, 'Lehrer Varn');
    expect(questMarks(w, p).map((m) => [m.x, m.y])).toEqual([[varn.x, varn.y]]);
    expect(nextStep(w, p)!.text).toContain('Lehrer Varn');
    expect(questById('c_first3')!.outro).toContain('Varn');
    // die Belohnungen bringen zusammen mit den Ratten Stufe 2
    expect(p.level).toBeGreaterThanOrEqual(2);
  });

  it('ohne Gold schenkt Mirel die Tränke', () => {
    const { w, p } = build();
    talkTo(w, p, 'Hafenmeister Joren', () => ({ type: 'acceptQuest', questId: 'c_first1' }));
    p.gold = buyPrice('heal_small') - 1;
    const heals = p.inventory.filter((i) => i.templateId === 'heal_small').length;
    talkTo(w, p, 'Händlerin Mirel', (npcId) => ({ type: 'talk', npcId }));
    expect(p.inventory.filter((i) => i.templateId === 'heal_small').length).toBe(heals + 2);
    expect(p.quests.c_first1?.state).toBe('turned');
    expect(p.quests.c_first2?.state).toBe('active');
  });

  it('mit Gold verweist Mirel auf ihre Ware, statt zu schenken', () => {
    const { w, p } = build();
    talkTo(w, p, 'Hafenmeister Joren', () => ({ type: 'acceptQuest', questId: 'c_first1' }));
    const heals = p.inventory.length;
    talkTo(w, p, 'Händlerin Mirel', (npcId) => ({ type: 'talk', npcId }));
    expect(p.inventory.length).toBe(heals);
    expect(p.quests.c_first1?.state).toBe('active');
  });

  it('alte Spielstände mit begonnener Ankunftskette bekommen ihn nicht', () => {
    for (const state of ['active', 'turned'] as const) {
      const { w, p } = build();
      p.quests.c_arr1 = { state, progress: state === 'turned' ? 1 : 0 };
      expect(questAvailable(p, questById('c_first1')!), state).toBe(false);
      drainEvents(w);
      talkTo(w, p, 'Hafenmeister Joren', () => ({ type: 'acceptQuest', questId: 'c_first1' }));
      expect(p.quests.c_first1, state).toBeUndefined();
      expect(nextStep(w, p)?.text ?? '', state).not.toContain('Vorrat für draußen');
    }
  });
});
