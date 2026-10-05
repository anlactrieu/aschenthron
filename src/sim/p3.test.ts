import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { MAP_VERSION, NPC_LORE, QUESTS, UNIQUES, WORLD_BOSS_LOOT, questById, uniqueDef } from './data';
import { findPath, isWalkable, type Grid } from './path';
import { exportPlayer, importPlayer } from './save';
import { validateCommand } from './net';
import { questAvailable, questChains, questMarks, questWhere } from './quests';
import { rollDrop, rollUniqueSpecial, rollWorldSpecial, rollGem, templateById } from './items';
import { Rng } from './rng';
import { addNpc, applyCommand, createWorld, drainEvents, getActor, regionAt, spawnMonster, spawnPlayer, tick, TICK_RATE, type Actor, type World } from './world';

const map = mapJson as unknown as TiledMap;
const build = (seed = 3) => {
  const { world, playerId } = buildWorld(seed, map);
  return { w: world, p: getActor(world, playerId)! };
};
const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });
const arena = () => {
  const w = createWorld(5, open());
  const p = spawnPlayer(w, 10, 10);
  p.level = 30;
  p.damage = [9999, 9999];
  p.maxHp = 1e6;
  p.hp = 1e6;
  return { w, p };
};
const events = (w: World) => drainEvents(w);

describe('P3: Aufgabenketten', () => {
  const chains = questChains();

  it('mindestens drei Ketten mit je 3–4 Gliedern, Vorgänger in derselben Kette, Folgeglieder nicht frei', () => {
    expect(chains.length).toBeGreaterThanOrEqual(3);
    for (const c of chains) {
      expect(c.quests.length, c.name).toBeGreaterThanOrEqual(3);
      expect(c.quests.length, c.name).toBeLessThanOrEqual(4);
      c.quests.forEach((q, i) => {
        if (i === 0) expect(q.requires, q.id).toBeUndefined();
        else expect(q.requires, q.id).toBe(c.quests[i - 1]!.id);
      });
    }
    const kinds = new Set(QUESTS.filter((q) => q.chain).map((q) => q.kind));
    for (const k of ['visit', 'bring', 'talk', 'kill'] as const) expect(kinds.has(k), k).toBe(true);
  });

  it('jede Kettenaufgabe hat genau einen Geber auf der Karte; Gesprächsziele und Besuchsorte existieren', () => {
    const { w } = build();
    for (const q of QUESTS.filter((x) => x.chain)) {
      const givers = w.npcs.filter((n) => n.quests?.includes(q.id));
      expect(givers.length, q.id).toBe(1);
      if (q.kind === 'talk') {
        expect(w.npcs.some((n) => n.name === q.target), q.id).toBe(true);
        expect(NPC_LORE[q.target], q.id).toBeDefined();
      }
      if (q.kind === 'visit') expect(w.regions.some((r) => r.name === q.place), q.id).toBe(true);
      if (q.kind === 'bring') expect(q.monsters?.length || q.chestRegion, q.id).toBeTruthy();
      if (q.kind === 'unique' && q.target) expect(uniqueDef(q.target), q.id).toBeDefined();
      if (q.kind !== 'chest') expect(questWhere(w, q), q.id).not.toBe('');
    }
  });

  it('Lore-NPCs: 6 benannte NPCs mit 2–4 Absätzen, alle auf der Karte erreichbar', () => {
    const { w, p } = build();
    const names = Object.keys(NPC_LORE);
    expect(names).toHaveLength(6);
    for (const n of names) {
      const para = NPC_LORE[n]!;
      expect(para.length).toBeGreaterThanOrEqual(2);
      expect(para.length).toBeLessThanOrEqual(4);
      const npc = w.npcs.find((x) => x.name === n);
      expect(npc, n).toBeDefined();
      expect(findPath(w.grid, { x: Math.round(p.x), y: Math.round(p.y) }, { x: Math.round(npc!.x), y: Math.round(npc!.y) }).length, n).toBeGreaterThan(0);
    }
  });

  it('Annahme: gesperrt, bis der Vorgänger abgegeben ist; Stufe und Geber zählen', () => {
    const { w, p } = build();
    const maren = w.npcs.find((n) => n.name === 'Chronistin Maren')!;
    const ysa = w.npcs.find((n) => n.name === 'Jägerin Ysa')!;
    p.level = 30;
    p.x = ysa.x; p.y = ysa.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob2' });
    expect(p.quests.c_gob2).toBeUndefined();
    expect(events(w).some((e) => e.type === 'fail' && e.reason.includes('abschließen'))).toBe(true);
    expect(questAvailable(p, questById('c_gob2')!)).toBe(false);
    // falscher Geber
    p.x = maren.x; p.y = maren.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob2' });
    expect(p.quests.c_gob2).toBeUndefined();
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob1' });
    expect(p.quests.c_gob1?.state).toBe('active');
    // zu niedrige Stufe
    p.level = 1;
    p.quests.c_gob1 = { state: 'turned', progress: 1 };
    p.x = ysa.x; p.y = ysa.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob2' });
    expect(p.quests.c_gob2).toBeUndefined();
    p.level = 30;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob2' });
    expect(p.quests.c_gob2?.state).toBe('active');
  });

  it('Gespräch: talk beendet die Gesprächsaufgabe sofort (Belohnung, Folgeglied frei) – nur in Reichweite', () => {
    const { w, p } = build();
    const maren = w.npcs.find((n) => n.name === 'Chronistin Maren')!;
    const ysa = w.npcs.find((n) => n.name === 'Jägerin Ysa')!;
    p.level = 10;
    p.x = maren.x; p.y = maren.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob1' });
    // zu weit weg
    applyCommand(w, p.id, { type: 'talk', npcId: ysa.id });
    expect(p.quests.c_gob1?.state).toBe('active');
    expect(events(w).some((e) => e.type === 'fail')).toBe(true);
    const gold = p.gold;
    p.x = ysa.x; p.y = ysa.y;
    applyCommand(w, p.id, { type: 'talk', npcId: ysa.id });
    expect(p.quests.c_gob1?.state).toBe('turned');
    expect(p.gold).toBe(gold + questById('c_gob1')!.gold);
    const ev = events(w);
    expect(ev.some((e) => e.type === 'talk' && e.npcId === ysa.id)).toBe(true);
    expect(ev.some((e) => e.type === 'questTurned' && e.questId === 'c_gob1')).toBe(true);
    expect(questAvailable(p, questById('c_gob2')!)).toBe(true);
  });

  it('Besuchsaufgabe: wird beim Betreten der Region erfüllt, dann beim Geber abgeben (Seltenes als Kettenabschluss)', () => {
    const { w, p } = build();
    const ysa = w.npcs.find((n) => n.name === 'Jägerin Ysa')!;
    p.level = 12;
    p.quests.c_gob1 = { state: 'turned', progress: 1 };
    p.quests.c_gob2 = { state: 'turned', progress: 4 };
    p.x = ysa.x; p.y = ysa.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob3' });
    for (let i = 0; i < 20; i++) tick(w);
    expect(p.quests.c_gob3?.state).toBe('active');
    const bau = w.regions.find((r) => r.name === 'Goblinbau')!;
    p.x = bau.x + bau.w / 2; p.y = bau.y + bau.h / 2;
    for (let i = 0; i < 12; i++) tick(w);
    expect(p.quests.c_gob3?.state).toBe('done');
    expect(questMarks(w, p).some((m) => m.questId === 'c_gob3' && m.done)).toBe(true);
    p.x = ysa.x; p.y = ysa.y;
    applyCommand(w, p.id, { type: 'turnInQuest', questId: 'c_gob3' });
    expect(p.quests.c_gob3?.state).toBe('turned');
    // letztes Glied: seltener Gegenstand im Rucksack
    p.quests.c_gob4 = { state: 'done', progress: 1 };
    const before = p.inventory.length;
    applyCommand(w, p.id, { type: 'turnInQuest', questId: 'c_gob4' });
    expect(p.inventory.length).toBe(before + 1);
    expect(['rare', 'legendary', 'set']).toContain(p.inventory[p.inventory.length - 1]!.rarity);
  });

  it('Sammelaufgabe (Monster): Quest-Gegenstand wird gezählt, nie im Rucksack, nicht verkaufbar', () => {
    const { w, p } = arena();
    const def = questById('c_gob2')!;
    const save = def.chance;
    def.chance = 1;
    addNpc(w, 'quest', 'Jägerin Ysa', 10, 11, { quests: ['c_gob2'] });
    p.quests.c_gob1 = { state: 'turned', progress: 1 };
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_gob2' });
    const inv = p.inventory.length;
    for (let i = 0; i < 4; i++) {
      const m = spawnMonster(w, 11, 10, 'goblin_warrior');
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      for (let t = 0; t < 60 && m.alive; t++) tick(w);
      expect(m.alive).toBe(false);
    }
    def.chance = save;
    expect(p.quests.c_gob2?.state).toBe('done');
    expect(p.quests.c_gob2?.progress).toBe(4);
    expect(events(w).filter((e) => e.type === 'questItem').length).toBe(4);
    // kein Inventar-Gegenstand außer der normalen Beute (keine Quest-Items)
    expect(p.inventory.slice(inv).every((i) => !i.name.includes('Goblinzeichen'))).toBe(true);
    // Monster anderer Arten zählen nicht
    p.quests.c_gob2 = { state: 'active', progress: 0 };
    const rat = spawnMonster(w, 11, 10, 'field_rat');
    applyCommand(w, p.id, { type: 'attack', targetId: rat.id });
    for (let t = 0; t < 60 && rat.alive; t++) tick(w);
    expect(p.quests.c_gob2.progress).toBe(0);
  });

  it('Sammelaufgabe (Truhen): nur Truhen der Region zählen', () => {
    const { w, p } = build();
    const pell = w.npcs.find((n) => n.name === 'Schatzsucher Pell')!;
    p.level = 25;
    p.quests.c_pell1 = { state: 'turned', progress: 3 };
    p.x = pell.x; p.y = pell.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: 'c_pell2' });
    const outside = w.chests.find((c) => regionAt(w, c.x, c.y)?.name !== 'Tiefenmine')!;
    const inside = w.chests.filter((c) => regionAt(w, c.x, c.y)?.name === 'Tiefenmine');
    expect(inside.length).toBeGreaterThanOrEqual(2);
    p.x = outside.x; p.y = outside.y;
    applyCommand(w, p.id, { type: 'openChest', chestId: outside.id });
    expect(p.quests.c_pell2!.progress).toBe(0);
    for (const c of inside.slice(0, 2)) {
      p.x = c.x; p.y = c.y;
      applyCommand(w, p.id, { type: 'openChest', chestId: c.id });
    }
    expect(p.quests.c_pell2!.state).toBe('done');
  });

  it('Unikat-Aufgabe mit Ziel zählt nur diesen Weltboss', () => {
    const { w, p } = arena();
    p.quests.c_eid4 = { state: 'active', progress: 0 };
    const other = spawnMonster(w, 11, 10, 'rock_troll', { unique: 'troll_chief_drogg' });
    other.hp = 1;
    applyCommand(w, p.id, { type: 'attack', targetId: other.id });
    for (let t = 0; t < 400 && other.alive; t++) tick(w);
    expect(p.quests.c_eid4!.progress).toBe(0);
    const wb = spawnMonster(w, 11, 11, 'pit_fiend', { unique: 'abyss_warden' });
    wb.hp = 1;
    applyCommand(w, p.id, { type: 'attack', targetId: wb.id });
    for (let t = 0; t < 400 && wb.alive; t++) tick(w);
    expect(p.quests.c_eid4!.state).toBe('done');
  });

  it('Netz: talk wird validiert', () => {
    const { w } = build();
    expect(validateCommand(w, { type: 'talk', npcId: 3 })).toEqual({ type: 'talk', npcId: 3 });
    expect(validateCommand(w, { type: 'talk', npcId: 'x' })).toBeNull();
  });
});

describe('P3: Spielstand 3 → 4', () => {
  it('Kartenversion 4; alter Spielstand startet in der Stadt, Aufgaben (auch Kette) bleiben', () => {
    expect(MAP_VERSION).toBe(4);
    const { p: p1 } = build();
    p1.level = 12;
    p1.quests.c_gob1 = { state: 'turned', progress: 1 };
    p1.quests.c_gob2 = { state: 'active', progress: 2 };
    p1.quests.q_rats = { state: 'turned', progress: 8 };
    p1.x = 100; p1.y = 100;
    expect(JSON.parse(exportPlayer(p1)).mapV).toBe(4);
    const old = JSON.stringify({ ...JSON.parse(exportPlayer(p1)), mapV: 3 });
    const { w: w2, p: p2 } = build(9);
    p2.x = 5; p2.y = 5;
    expect(importPlayer(w2, p2, old)).toBe(true);
    expect({ x: p2.x, y: p2.y }).toEqual(w2.start);
    expect(p2.quests.c_gob2).toEqual({ state: 'active', progress: 2 });
    expect(p2.quests.q_rats?.state).toBe('turned');
    // gleiche Version: Position bleibt (begehbares Feld)
    const { w: w3, p: p3 } = build(11);
    const cur = JSON.stringify({ ...JSON.parse(exportPlayer(p1)), player: { ...JSON.parse(exportPlayer(p1)).player, x: w3.start.x + 1, y: w3.start.y } });
    importPlayer(w3, p3, cur);
    expect(p3.x).toBeCloseTo(w3.start.x + 1);
  });

  it('Altstand mit Position in jetzt gesperrtem Gelände landet am Start; unbekannte Aufgaben fallen weg', () => {
    const { w, p } = build();
    // Position in einer Wand der Karte
    let wall = { x: 0, y: 0 };
    for (let y = 0; y < w.grid.h && !wall.x; y++) for (let x = 0; x < w.grid.w; x++) if (!isWalkable(w.grid, x, y)) { wall = { x, y }; break; }
    const json = JSON.stringify({ v: 1, mapV: 4, player: { level: 5, x: wall.x, y: wall.y, quests: { gibt_es_nicht: { state: 'active', progress: 1 }, c_moor1: { state: 'active', progress: 0 } } } });
    expect(importPlayer(w, p, json)).toBe(true);
    expect({ x: p.x, y: p.y }).toEqual(w.start);
    expect(p.quests.gibt_es_nicht).toBeUndefined();
    expect(p.quests.c_moor1?.state).toBe('active');
  });
});

describe('P3: neue Zonen und Dungeons', () => {
  const { w, p } = build();
  const inRegion = (name: string) => w.actors.filter((a) => a.kind === 'monster' && regionAt(w, a.x, a.y)?.name === name);

  it('Regionen existieren und ordnen Positionen richtig zu', () => {
    for (const [name, lv] of [['Goblinbau', '8-12'], ['Spinnennest', '13-18'], ['Aschengrund', '28-32']] as const) {
      const r = w.regions.find((x) => x.name === name)!;
      expect(r, name).toBeDefined();
      expect(r.levels).toBe(lv);
      expect(regionAt(w, r.x + r.w / 2, r.y + r.h / 2)?.name).toBe(name);
    }
    expect(regionAt(w, 0, 0)).toBeUndefined();
    expect(regionAt(w, w.start.x, w.start.y)?.name).toBe('Aschenhafen');
  });

  it('Goblinbau: Grix im Bau (nicht mehr im Wald), Goblin-Familie, 3–5 Truhen, erreichbar, Eingang ohne Wächter', () => {
    const grix = w.actors.find((a) => a.kindId === 'goblin_king')!;
    expect(regionAt(w, grix.x, grix.y)?.name).toBe('Goblinbau');
    const mons = inRegion('Goblinbau').filter((m) => m.kindId !== 'goblin_king');
    expect(mons.length).toBeGreaterThanOrEqual(15);
    for (const m of mons) expect(['goblin_scout', 'goblin_archer', 'goblin_warrior', 'goblin_shaman', 'goblin_brute', 'goblin_warlord', 'goblin_chief'], m.kindId).toContain(m.kindId);
    expect(Math.min(...mons.map((m) => m.level))).toBeGreaterThanOrEqual(4);
    const ch = w.chests.filter((c) => regionAt(w, c.x, c.y)?.name === 'Goblinbau');
    expect(ch.length).toBeGreaterThanOrEqual(3);
    expect(ch.length).toBeLessThanOrEqual(5);
    expect(findPath(w.grid, { x: Math.round(w.start.x), y: Math.round(w.start.y) }, { x: Math.round(grix.x), y: Math.round(grix.y) }).length).toBeGreaterThan(0);
    // keine Wächter im Bossraum (Bot-Schutz: kein Rudel direkt neben Grix)
    expect(w.actors.filter((a) => a.kind === 'monster' && a.id !== grix.id && Math.hypot(a.x - grix.x, a.y - grix.y) < 4).length).toBe(0);
  });

  it('Düsterwald-Eingang entschärft: kein Goblinkönig im Wald, vordere Rudel höchstens 3', () => {
    const forest = inRegion('Düsterwald');
    expect(forest.some((m) => m.kindId === 'goblin_king')).toBe(false);
    const packs = new Map<number, number>();
    for (const m of forest) if (m.packId) packs.set(m.packId, (packs.get(m.packId) ?? 0) + 1);
    expect(Math.max(...packs.values())).toBeLessThanOrEqual(5);
    // nahe dem Waldeingang (Entfernung < 0,5 vom Eingang (75,120)) nie mehr als 3
    const near = new Map<number, number>();
    const f = (m: Actor) => (Math.abs(m.x - 75) + Math.abs(m.y - 120)) / 105;
    for (const m of forest.filter((x) => x.packId && f(x) < 0.45)) near.set(m.packId, (near.get(m.packId) ?? 0) + 1);
    for (const n of near.values()) expect(n).toBeLessThanOrEqual(3);
  });

  it('Spinnennest: Spinnen, Königin, erreichbar, 3–5 Truhen', () => {
    const q = w.actors.find((a) => a.kindId === 'spider_queen')!;
    expect(regionAt(w, q.x, q.y)?.name).toBe('Spinnennest');
    const mons = inRegion('Spinnennest').filter((m) => m !== q);
    expect(mons.length).toBeGreaterThanOrEqual(15);
    for (const m of mons) expect(m.kindId && w.actors.length ? ['giant_spider', 'brood_spider', 'web_stalker', 'nest_matron'] : []).toContain(m.kindId);
    const ch = w.chests.filter((c) => regionAt(w, c.x, c.y)?.name === 'Spinnennest');
    expect(ch.length).toBeGreaterThanOrEqual(3);
    expect(ch.length).toBeLessThanOrEqual(5);
    expect(findPath(w.grid, { x: Math.round(w.start.x), y: Math.round(w.start.y) }, { x: Math.round(q.x), y: Math.round(q.y) }).length).toBeGreaterThan(0);
  });

  it('Aschengrund: Elite (Stufe 28–32), dichter als die Aschenöde, bessere Truhen, erreichbar', () => {
    const g = inRegion('Aschengrund').filter((m) => !m.unique);
    const ash = inRegion('Aschenöde');
    const area = (n: string) => { const r = w.regions.find((x) => x.name === n)!; return r.w * r.h; };
    expect(g.length / area('Aschengrund')).toBeGreaterThan(ash.length / area('Aschenöde'));
    expect(Math.min(...g.map((m) => m.level))).toBeGreaterThanOrEqual(29);
    expect(Math.max(...g.map((m) => m.level))).toBeLessThanOrEqual(32);
    const ch = w.chests.filter((c) => regionAt(w, c.x, c.y)?.name === 'Aschengrund');
    expect(ch.length).toBeGreaterThanOrEqual(6);
    expect(ch.every((c) => c.level >= 28 && c.tier !== 'wood')).toBe(true);
    const target = g[0]!;
    expect(findPath(w.grid, { x: Math.round(w.start.x), y: Math.round(w.start.y) }, { x: Math.round(target.x), y: Math.round(target.y) }).length).toBeGreaterThan(0);
  });

  it('Weltbosse stehen in Moorlande, Hochland und Aschengrund (abseits der Städte)', () => {
    const where: Record<string, string> = { bog_titan: 'Moorlande', mountain_king: 'Hochland', abyss_warden: 'Aschengrund' };
    for (const [id, region] of Object.entries(where)) {
      const m = w.actors.find((a) => a.unique === id)!;
      expect(m, id).toBeDefined();
      expect(regionAt(w, m.x, m.y)?.name).toBe(region);
      expect(findPath(w.grid, { x: Math.round(w.start.x), y: Math.round(w.start.y) }, { x: Math.round(m.x), y: Math.round(m.y) }).length, id).toBeGreaterThan(0);
      for (const t of w.towns) expect(Math.hypot(t.x - m.x, t.y - m.y), id).toBeGreaterThan(25);
    }
  });

  it('p.x bleibt gültig (Spieler startet in der Stadt)', () => {
    expect(p.alive).toBe(true);
  });
});

describe('P3: Weltbosse', () => {
  const world = UNIQUES.filter((u) => u.world);

  it('drei Weltbosse mit 25–40 Minuten Wartezeit, Fähigkeiten, Orte', () => {
    expect(world.map((u) => u.id).sort()).toEqual(['abyss_warden', 'bog_titan', 'mountain_king']);
    for (const u of world) {
      expect(u.respawnMin).toBeGreaterThanOrEqual(25);
      expect(u.respawnMin).toBeLessThanOrEqual(40);
      expect(u.abilities.length).toBeGreaterThanOrEqual(2);
      expect(u.where).toBeTruthy();
    }
  });

  it('Tod meldet worldBoss/dead, Wiedererscheinen erst nach der Wartezeit mit worldBoss/spawn', () => {
    const { w, p } = arena();
    const u = uniqueDef('bog_titan')!;
    const m = spawnMonster(w, 11, 10, u.base, { unique: u.id });
    expect(m.respawnTicks).toBe(TICK_RATE * 60 * u.respawnMin);
    expect(m.aggroRange).toBeLessThanOrEqual(6);
    p.damage = [99999, 99999];
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    for (let t = 0; t < 200 && m.alive; t++) tick(w);
    expect(m.alive).toBe(false);
    const ev = events(w);
    expect(ev.find((e) => e.type === 'worldBoss')).toMatchObject({ state: 'dead', name: u.name });
    // fast die ganze Wartezeit: bleibt tot
    p.x = 30; p.y = 30; // weit weg, damit nichts passiert
    w.tick = m.diedAt + m.respawnTicks - 5;
    tick(w);
    expect(m.alive).toBe(false);
    w.tick = m.diedAt + m.respawnTicks;
    tick(w);
    expect(m.alive).toBe(true);
    expect(m.hp).toBe(m.maxHp);
    expect(events(w).find((e) => e.type === 'worldBoss')).toMatchObject({ state: 'spawn', name: u.name });
  });

  it('Beute: garantierte Seltene mit T4/T5-Affixen und Edelstein mindestens Qualität 2', () => {
    for (const id of ['bog_titan', 'mountain_king', 'abyss_warden']) {
      const { w, p } = arena();
      const u = uniqueDef(id)!;
      const m = spawnMonster(w, 11, 10, u.base, { unique: id });
      p.damage = [99999, 99999];
      applyCommand(w, p.id, { type: 'attack', targetId: m.id });
      for (let t = 0; t < 200 && m.alive; t++) tick(w);
      const loot = events(w).filter((e) => e.type === 'loot').map((e) => (e.type === 'loot' ? e.item : null)!);
      const rares = loot.filter((i) => i.rarity === 'rare' && i.slot !== 'gem');
      expect(rares.length, id).toBeGreaterThanOrEqual(WORLD_BOSS_LOOT.rares);
      const boosted = rares.filter((i) => i.slot !== 'potion' && i.affixes.slice(templateById(i.templateId).base?.length ?? 0).every((a) => (a.tier ?? 0) >= WORLD_BOSS_LOOT.minTier));
      expect(boosted.length, id).toBeGreaterThanOrEqual(WORLD_BOSS_LOOT.rares);
      const gems = loot.filter((i) => i.slot === 'gem');
      expect(gems.length, id).toBeGreaterThanOrEqual(1);
      expect(Math.min(...gems.map((g) => g.gem!.q)), id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('P3: Beute-Tabellen bis Stufe 32', () => {
  it('rollDrop, rollUniqueSpecial, rollWorldSpecial, rollGem liefern für Stufen 1–32 gültige Ergebnisse', () => {
    const rng = new Rng(99);
    let id = 1;
    for (let lvl = 1; lvl <= 32; lvl++) {
      for (let i = 0; i < 25; i++) {
        const it = rollDrop(rng, () => id++, lvl, i % 3 === 0 ? 'rare' : undefined);
        expect(it.templateId, `Stufe ${lvl}`).toBeTruthy();
        rollUniqueSpecial(rng, () => id++, lvl);
        rollWorldSpecial(rng, () => id++, Math.min(lvl + 2, 30));
        expect(rollGem(rng, () => id++, lvl, 2).gem!.q).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('Spät-Unikate fallen bei Weltbossen im Aschengrund-Bereich (Pool nicht leer)', () => {
    const rng = new Rng(5);
    let id = 1;
    const names = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const s = rollWorldSpecial(rng, () => id++, 30);
      if (s?.unique) names.add(s.unique);
    }
    expect(names.size).toBeGreaterThanOrEqual(2);
  });
});

