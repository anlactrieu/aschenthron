import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { AWAKENED, ASH_KING, ASH_TITLES, MONSTERS, NPC_TOPICS, QUESTS, THREAD_ASCHE, ashQuestId, awakenedOf, baseKindOf, isGiverOf, monsterKind, questById } from './data';
import { NAMED } from './named';
import { LEGENDARIES, SETS, TEMPLATES, affixRange, generateNamed, namedPool, rollNamed } from './items';
import { Rng } from './rng';
import { ASCHE_RUF } from './topicsData';
import { answerOf, marksOf, stripMarks } from './topics';
import { exportPlayer, importPlayer } from './save';
import { actorFromLite, makeSnapshot } from './net';
import { questSpeech, questWhere } from './quests';
import { applyCommand, ashStage, drainEvents, getActor, isMarked, regionAt, spawnMonster, tick, TICK_RATE, type Actor, type Command, type World } from './world';

const map = mapJson as unknown as TiledMap;
const build = (seed = 3, keepMonsters = true) => {
  const { world, playerId } = buildWorld(seed, map);
  if (!keepMonsters) world.actors = world.actors.filter((a) => a.kind !== 'monster');
  return { w: world, p: getActor(world, playerId)! };
};
const talkTo = (w: World, p: Actor, name: string, cmd: (npcId: number) => Command): void => {
  const n = w.npcs.find((x) => x.name === name)!;
  p.x = n.x;
  p.y = n.y;
  applyCommand(w, p.id, cmd(n.id));
};
const ask = (w: World, p: Actor, npc: string, topic: string) => talkTo(w, p, npc, (npcId) => ({ type: 'askTopic', npcId, topic }));
/** erlegt eine neu erzeugte Art neben dem Spieler (draußen vor dem Stadttor) */
const slay = (w: World, p: Actor, kindId: string): Actor => {
  Object.assign(p, { x: 62, y: 150, damage: [99999, 99999], maxHp: 1e7, hp: 1e7 });
  const m = spawnMonster(w, 63, 150, kindId);
  applyCommand(w, p.id, { type: 'attack', targetId: m.id });
  for (let i = 0; i < 400 && m.alive; i++) tick(w);
  expect(m.alive, `${kindId} bleibt stehen`).toBe(false);
  return m;
};
const L30 = (p: Actor) => Object.assign(p, { level: 30 });

const BASES = ['goblin_king', 'bandit_lord', 'bone_lord', 'bog_queen', 'stone_colossus', 'spider_queen', 'web_mother'];

describe('T7 Daten: erwachte Bosse', () => {
  it('sieben erwachte Arten: Stufe 30, Boss, Fähigkeiten der Grundart plus genau eine, Heimat am Ort der Grundart', () => {
    expect(AWAKENED.map((d) => d.base).sort()).toEqual([...BASES].sort());
    for (const d of AWAKENED) {
      const k = monsterKind(d.id);
      const b = monsterKind(d.base);
      expect(k.level, d.id).toBe(30);
      expect(k.boss, d.id).toBe(true);
      expect(b.boss, d.base).toBe(true);
      expect(k.family, d.id).toBe(b.family);
      expect(k.abilities!.length, d.id).toBe(b.abilities!.length + 1);
      for (const a of b.abilities!) expect(k.abilities, d.id).toContain(a);
      expect(b.abilities, d.id).not.toContain(d.extra);
      expect(k.abilities, d.id).toContain(d.extra);
      expect(baseKindOf(d.id)).toBe(d.base);
      expect(baseKindOf(d.base)).toBe(d.base);
      expect(awakenedOf(d.base)?.id).toBe(d.id);
      expect(MONSTERS.filter((m) => m.name === k.name).length, `${d.id}: Name eindeutig`).toBe(1);
    }
    expect(awakenedOf(ASH_KING)).toBeUndefined();
  });

  it('jeder erwachte Boss trägt genau einen eigenen benannten Fund (Stufe 30), quer über die Slots, nicht im Zufallstopf', () => {
    const slots = new Set<string>();
    for (const d of AWAKENED) {
      const own = NAMED.filter((n) => n.boss === d.id);
      expect(own.map((n) => n.id), d.id).toEqual([d.named]);
      const def = own[0]!;
      expect(def.band).toBe(26);
      expect(def.rarity).toBe('rare');
      slots.add(generateNamed(1, def.id).slot);
      expect(namedPool(30).some((n) => n.id === def.id), `${def.id} liegt im Zufallstopf`).toBe(false);
    }
    expect(NAMED.filter((n) => n.boss).length).toBe(7);
    expect(slots.size).toBeGreaterThanOrEqual(6);
    // Zufallswürfe liefern sie nie
    const rng = new Rng(5);
    let id = 1;
    for (let i = 0; i < 400; i++) {
      const it = rollNamed(rng, () => id++, 30)!;
      expect(NAMED.find((n) => n.id === it.named)!.boss, it.name).toBeUndefined();
    }
  });

  it('die sieben Funde sind gültig: eigene Namen, drei Werte im Rahmen der Affix-Bereiche (Stufe 30), feste Werte', () => {
    const taken = new Set([...TEMPLATES.map((t) => t.name), ...LEGENDARIES.map((l) => l.name), ...SETS.flatMap((s) => s.pieces.map((p) => p.name)), ...NAMED.filter((n) => !n.boss).map((n) => n.name)]);
    for (const d of NAMED.filter((n) => n.boss)) {
      expect(taken.has(d.name), d.name).toBe(false);
      expect(d.affixes.length, d.id).toBe(3);
      expect(new Set(d.affixes.map((a) => a.stat)).size, d.id).toBe(3);
      for (const a of d.affixes) {
        const hi = affixRange(a.stat, 30, 5)[1];
        expect(a.value, `${d.id} ${a.stat}`).toBeLessThanOrEqual(hi);
        expect(a.value, `${d.id} ${a.stat}`).toBeGreaterThanOrEqual(affixRange(a.stat, 26, 1)[0]);
      }
      expect(d.lore!.length, d.id).toBeLessThanOrEqual(90);
      expect(generateNamed(1, d.id)).toEqual(generateNamed(1, d.id));
    }
  });

  it('Auftragskette „Die Asche ruft“: 7 versteckte Kill-Aufträge ohne Reihenfolge, je ein Geber', () => {
    const steps = QUESTS.filter((q) => q.thread === THREAD_ASCHE);
    expect(steps.length).toBe(7);
    for (const d of AWAKENED) {
      const q = questById(ashQuestId(d.id))!;
      expect(q.hidden).toBe(true);
      expect(q.kind).toBe('kill');
      expect(q.target).toBe(d.id);
      expect(q.requires).toBeUndefined();
      expect(q.minLevel).toBe(30);
    }
  });
});

describe('T7 Gerüchte: nur über Worte auffindbar', () => {
  const DIRECTION = /Nordwesten|Nordosten|Südwesten|Südosten|Norden|Süden|Osten|Westen|Mitte/;
  /** Kompass nach Lage in der Region: Norden ist kleineres y (Drittel-Raster) */
  const compass = (rx: number, ry: number): string => {
    const ns = ry < 1 / 3 ? 'Nord' : ry > 2 / 3 ? 'Süd' : '';
    const ew = rx < 1 / 3 ? 'west' : rx > 2 / 3 ? 'ost' : '';
    if (!ns && !ew) return 'Mitte';
    if (!ns) return ew === 'west' ? 'Westen' : 'Osten';
    if (!ew) return ns === 'Nord' ? 'Norden' : 'Süden';
    return `${ns}${ew}en`;
  };

  it('Für jeden erwachten Boss: ein Gerücht mit Himmelsrichtung (stimmt mit der Karte) und Landmarke bei einem NPC der Karte', () => {
    const { w } = build();
    for (const d of AWAKENED) {
      const r = ASCHE_RUF[d.id]!;
      expect(r, d.id).toBeDefined();
      const boss = w.actors.find((a) => a.kind === 'monster' && a.kindId === d.base)!;
      const reg = regionAt(w, boss.home!.x, boss.home!.y)!;
      expect(reg.name, `${d.id}: Landmarke`).toBe(r.ort);
      expect(r.text.includes(r.ort), `${d.id}: Landmarke im Text`).toBe(true);
      const exp = compass((boss.home!.x - reg.x) / reg.w, (boss.home!.y - reg.y) / reg.h);
      expect(r.richtung, `${d.id}: Himmelsrichtung nach Karte`).toBe(exp);
      expect(DIRECTION.test(r.text) && r.text.includes(r.richtung), `${d.id}: Richtung im Text`).toBe(true);
      expect(w.npcs.some((n) => n.name === r.npc), r.npc).toBe(true);
      const a = answerOf(r.npc, r.key)!;
      expect(a, `${r.npc}/${r.key}`).toBeDefined();
      expect(a.text.join(' ')).toContain(r.text);
      expect(a.quest).toBe(ashQuestId(d.id));
      expect(a.needs).toBe('ash');
      expect(questById(ashQuestId(d.id))!.giver).toBe(r.npc);
      // der Auftragsort lässt sich auch über die Aufgabenliste benennen
      expect(questWhere(w, questById(ashQuestId(d.id))!)).toContain(r.ort);
      expect(stripMarks(questSpeech(w, questById(ashQuestId(d.id))!))).toContain(r.ort);
    }
  });

  it('Maren nennt Stichwort „asche“ nur Eingeweihten und führt zu allen sieben Gerüchten', () => {
    const a = answerOf('Chronistin Maren', 'asche')!;
    expect(a.needs).toBe('ash');
    const keys = marksOf(a.text.join(' ')).map((m) => m.key);
    for (const d of AWAKENED) expect(keys).toContain(ASCHE_RUF[d.id]!.key);
    // nicht in der freien Einstiegszeile
    expect(marksOf(NPC_TOPICS['Chronistin Maren']!.open).map((m) => m.key)).not.toContain('asche');
  });
});

describe('T7 Spieler: Tod des Königs, Zeichen, Titel', () => {
  it('Ohne Sieg über den König: kein Zeichen, Maren schweigt, kein Gerücht, keine Auftrag', () => {
    const { w, p } = build();
    L30(p);
    expect(isMarked(p)).toBe(false);
    expect(ashStage(p)).toBe(0);
    ask(w, p, 'Chronistin Maren', 'asche');
    expect(p.topics ?? []).not.toContain('asche');
    expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
    // selbst mit bekanntem Stichwort bleibt sie stumm
    p.topics = ['asche', ASCHE_RUF.goblin_king_ash!.key];
    ask(w, p, 'Jägerin Ysa', ASCHE_RUF.goblin_king_ash!.key);
    expect(p.quests[ashQuestId('goblin_king_ash')]).toBeUndefined();
  });

  it('Der Tod des Aschenkönigs setzt das Zeichen dauerhaft, vergibt „Erbe der Asche“ und lehrt „asche“', () => {
    const { w, p } = build(3, false);
    L30(p);
    slay(w, p, 'ash_king');
    expect(isMarked(p)).toBe(true);
    expect(p.ash).toEqual([ASH_KING]);
    expect(ashStage(p)).toBe(1);
    expect(p.titles).toContain(ASH_TITLES[0]);
    expect(p.topics).toContain('asche');
    // zweiter Tod bringt nichts doppelt
    slay(w, p, 'ash_king');
    expect(p.ash).toEqual([ASH_KING]);
  });

  it('Stufe 30, König tot: Maren → Gerüchte → Aufträge; jeder erwachte Boss lässt seinen Fund fallen, nach allen sieben der zweite Titel', () => {
    const { w, p } = build(3, false);
    L30(p);
    slay(w, p, 'ash_king');
    ask(w, p, 'Chronistin Maren', 'asche');
    for (const d of AWAKENED) {
      const r = ASCHE_RUF[d.id]!;
      expect(p.topics, `Gerücht ${r.key} nach Maren`).toContain(r.key);
      ask(w, p, r.npc, r.key);
      expect(p.quests[ashQuestId(d.id)]?.state, d.id).toBe('active');
    }
    expect(Object.keys(p.quests).filter((id) => id.startsWith('h_ruf')).length).toBe(7);
    drainEvents(w);
    AWAKENED.forEach((d, i) => {
      const m = slay(w, p, d.id);
      const loot = drainEvents(w).filter((e) => e.type === 'loot').map((e) => (e as { item: { named?: string } }).item.named);
      expect(loot, `${d.id}: eigener Fund`).toContain(d.named);
      expect(loot.filter((n) => n && NAMED.find((x) => x.id === n)?.boss).length, `${d.id}: genau ein eigener Fund`).toBe(1);
      expect(m.alive).toBe(false);
      expect(p.ash!.length).toBe(2 + i);
      expect(p.ash).toContain(d.id);
      expect(p.quests[ashQuestId(d.id)]?.state).toBe('done');
      if (i < 6) expect(p.titles).not.toContain(ASH_TITLES[1]);
    });
    expect(ashStage(p)).toBe(8);
    expect(p.titles).toContain(ASH_TITLES[1]);
    // Wiederholung zählt nicht doppelt
    slay(w, p, AWAKENED[0]!.id);
    expect(p.ash!.length).toBe(8);
  });

  it('erwachter Boss ohne Zeichen des Töters zählt nicht (kein Zeichen ohne König)', () => {
    const { w, p } = build(3, false);
    L30(p);
    slay(w, p, AWAKENED[0]!.id);
    expect(p.ash ?? []).toEqual([]);
  });

  it('Speichern und Laden: Zeichen bleibt; Unbekanntes fällt weg; alter Stand ohne Feld lädt unverändert', () => {
    const { w, p } = build(3, false);
    L30(p);
    slay(w, p, 'ash_king');
    slay(w, p, AWAKENED[2]!.id);
    const json = exportPlayer(p);
    const { w: w2, p: q } = build(4, false);
    expect(importPlayer(w2, q, json)).toBe(true);
    expect(q.ash).toEqual(p.ash);
    expect(q.titles).toEqual(expect.arrayContaining([ASH_TITLES[0]]));
    // kaputte Einträge verworfen
    const bad = JSON.parse(json);
    bad.player.ash = [ASH_KING, 'unsinn', 42, AWAKENED[0]!.id, AWAKENED[0]!.id];
    const { w: w3, p: r } = build(4, false);
    importPlayer(w3, r, JSON.stringify(bad));
    expect(r.ash).toEqual([ASH_KING, AWAKENED[0]!.id]);
    // ohne den König zählt kein erwachter Boss
    const lone = JSON.parse(json);
    lone.player.ash = [AWAKENED[0]!.id];
    lone.player.kills = {};
    const { w: w4, p: s } = build(4, false);
    importPlayer(w4, s, JSON.stringify(lone));
    expect(s.ash ?? []).toEqual([]);
  });

  it('alter Spielstand ohne Feld „ash“ lädt wie zuvor (kein Zeichen, keine neuen Titel oder Stichworte)', () => {
    const { p } = build(3, false);
    L30(p);
    p.kills = { goblin: 3 };
    const old = JSON.parse(exportPlayer(p));
    delete old.player.ash;
    const { w: w2, p: q } = build(4, false);
    expect(importPlayer(w2, q, JSON.stringify(old))).toBe(true);
    expect(q.ash ?? []).toEqual([]);
    expect(q.topics).not.toContain('asche');
    expect(q.titles).not.toContain(ASH_TITLES[0]);
  });

  it('alter Stand, der den König schon erlegt hat (Kills), bekommt das Zeichen beim Laden nachgetragen', () => {
    const { p } = build(3, false);
    L30(p);
    p.kills = { ash_king: 1 };
    const old = JSON.parse(exportPlayer(p));
    delete old.player.ash;
    const { w: w2, p: q } = build(4, false);
    importPlayer(w2, q, JSON.stringify(old));
    expect(q.ash).toEqual([ASH_KING]);
    expect(q.titles).toContain(ASH_TITLES[0]);
    expect(q.topics).toContain('asche');
  });

  it('Netz: das Zeichen ist bei anderen Spielern als Stufe sichtbar', () => {
    const { w, p } = build(3, false);
    p.ash = [ASH_KING, AWAKENED[0]!.id, AWAKENED[1]!.id];
    const q = w.actors.find((a) => a.id !== p.id && a.kind === 'player') ?? (w.actors.push({ ...p, id: 99999, ash: undefined }), w.actors.at(-1)!);
    const snap = makeSnapshot(w, q, []);
    const lite = snap.actors.find((a) => a.id === p.id)!;
    expect(lite.ash).toBe(3);
    expect(ashStage(actorFromLite(lite, 0))).toBe(3);
    expect(snap.you.ash ?? []).toEqual([]);
  });
});

describe('T7 Welt: erwachte Bosse erscheinen nur für Gezeichnete', () => {
  const homeOf = (w: World, base: string) => w.actors.find((a) => a.kind === 'monster' && a.home && (a.kindId === base || baseKindOf(a.kindId!) === base) && !a.summonedBy)!;

  it('ohne Zeichen bleibt die Welt wie sie war; mit Zeichen werden die sieben Bosse am selben Ort zu ihrer erwachten Form', () => {
    const { w, p } = build();
    const before = BASES.map((b) => ({ id: homeOf(w, b).id, home: { ...homeOf(w, b).home! }, kind: homeOf(w, b).kindId }));
    for (let i = 0; i < TICK_RATE * 3; i++) tick(w);
    for (const b of before) expect(getActor(w, b.id)!.kindId).toBe(b.kind);
    p.ash = [ASH_KING];
    for (let i = 0; i < TICK_RATE * 3; i++) tick(w);
    for (const b of before) {
      const m = getActor(w, b.id)!;
      expect(awakenedOf(b.kind!)?.id, b.kind).toBe(m.kindId);
      expect(m.level).toBe(30);
      expect(m.name).toBe(monsterKind(m.kindId!).name);
      expect(m.home).toEqual(b.home);
      expect(m.boss).toBe(true);
      expect(m.hp).toBe(m.maxHp);
      expect(m.abilities.length).toBe(monsterKind(m.kindId!).abilities!.length);
    }
    // der König selbst bleibt der König
    expect(w.actors.find((a) => a.kindId === ASH_KING)).toBeDefined();
    // das Zeichen weg (anderer Spieler im Mehrspieler): sie schlafen wieder ein
    p.ash = undefined;
    for (let i = 0; i < TICK_RATE * 3; i++) tick(w);
    for (const b of before) expect(getActor(w, b.id)!.kindId).toBe(b.kind);
  });

  it('ein erschlagener Boss kehrt nach der Wartezeit als erwachte Form zurück (nur mit Zeichen)', () => {
    const { w, p } = build();
    p.ash = [ASH_KING];
    const m = homeOf(w, 'goblin_king');
    for (let i = 0; i < TICK_RATE * 2; i++) tick(w);
    expect(m.kindId).toBe('goblin_king_ash');
    m.alive = false;
    m.hp = 0;
    m.diedAt = w.tick;
    for (let i = 0; i < m.respawnTicks + 5; i++) tick(w);
    expect(m.alive).toBe(true);
    expect(m.kindId).toBe('goblin_king_ash');
    // ohne Zeichen kommt die Grundform zurück
    p.ash = undefined;
    for (let i = 0; i < TICK_RATE * 2; i++) tick(w);
    expect(m.kindId).toBe('goblin_king');
    m.alive = false;
    m.hp = 0;
    m.diedAt = w.tick;
    for (let i = 0; i < m.respawnTicks + 5; i++) tick(w);
    expect(m.kindId).toBe('goblin_king');
  });

  it('Aufträge „Töte Goblinkönig“ zählen auch die erwachte Form (kein Sackgassen-Auftrag für Gezeichnete)', () => {
    const { w, p } = build(3, false);
    L30(p);
    p.ash = [ASH_KING];
    p.quests.c_gob4 = { state: 'active', progress: 0 };
    slay(w, p, 'goblin_king_ash');
    expect(p.quests.c_gob4?.state).toBe('done');
  });
});

describe('T7 Karte bleibt unberührt', () => {
  it('alle Geber der Gerüchte sind in der Karte, die neuen Aufträge stehen bei keinem NPC in `quests`', () => {
    const { w } = build();
    for (const q of QUESTS.filter((x) => x.thread === THREAD_ASCHE)) {
      expect(w.npcs.filter((n) => isGiverOf(n, q)).map((n) => n.name), q.id).toEqual([q.giver]);
      expect(w.npcs.some((n) => n.quests?.includes(q.id)), q.id).toBe(false);
    }
  });
});
