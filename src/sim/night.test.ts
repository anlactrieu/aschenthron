import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { NIGHT, NIGHT_NPCS, NIGHT_SPAWNS, SHOPS, monsterKind } from './data';
import { clockText, hourOf, isNightHour, nightNumber, openText, START_HOUR, TICKS_PER_HOUR } from './clock';
import { closedMessage, nightBuffable, NIGHT_NPC_ID, rebaseNight, setNightBuff, syncNpcPresence } from './night';
import { isWalkable } from './path';
import { makeSnapshot } from './net';
import { applyCommand, buyPrice, drainEvents, getActor, inSafeZone, regionAt, tick, TICK_RATE, type Actor, type World } from './world';

const map = mapJson as unknown as TiledMap;
const build = (seed = 3) => {
  const { world, playerId } = buildWorld(seed, map);
  return { w: world, p: getActor(world, playerId)! };
};
/** Setzt die Uhr auf eine Stunde (Tick = Stunde seit Start) und lässt eine Sekunde laufen */
const atHour = (w: World, hour: number, day = 0) => {
  w.tick = Math.round(((hour - START_HOUR + 24) % 24 + day * 24) * TICKS_PER_HOUR);
  w.tick -= w.tick % TICK_RATE;
  for (let i = 0; i < TICK_RATE; i++) tick(w);
};
const far = (w: World, p: Actor) => {
  p.x = w.start.x;
  p.y = w.start.y;
};
const nightMobs = (w: World) => w.actors.filter((a) => a.nightSpawn);

describe('P6: Uhr', () => {
  it('TICKS_PER_HOUR passt zu TICK_RATE (24 Spielstunden = 24 Minuten)', () => {
    expect(TICKS_PER_HOUR).toBe(TICK_RATE * 60);
  });
  it('Stunde folgt dem Tick, startet um 8 Uhr und läuft über Mitternacht', () => {
    const w = { tick: 0 };
    expect(hourOf(w)).toBe(START_HOUR);
    w.tick = 13 * TICKS_PER_HOUR;
    expect(hourOf(w)).toBe(21);
    w.tick = 16 * TICKS_PER_HOUR + TICKS_PER_HOUR / 2;
    expect(hourOf(w)).toBeCloseTo(0.5);
    w.tick = 24 * TICKS_PER_HOUR;
    expect(hourOf(w)).toBe(START_HOUR);
  });
  it('fixedHour friert die Uhr ein', () => {
    expect(hourOf({ tick: 99999, fixedHour: 22 })).toBe(22);
  });
  it('Nacht von 21 bis 5:30', () => {
    expect([20.99, 21, 23, 0, 5.49].map(isNightHour)).toEqual([false, true, true, true, true]);
    expect([5.5, 6, 12, 18].map(isNightHour)).toEqual([false, false, false, false]);
  });
  it('Nachtnummer springt um 21 Uhr', () => {
    const at = (h: number, day = 0) => nightNumber({ tick: Math.round((day * 24 + ((h - START_HOUR + 24) % 24)) * TICKS_PER_HOUR) });
    expect(at(20.9)).toBe(at(12));
    expect(at(21.1)).toBe(at(20.9) + 1);
    expect(at(3)).toBe(at(21.1));
    expect(at(21.1, 1)).toBe(at(21.1) + 1);
  });
  it('Textformen', () => {
    expect(clockText(7.5)).toBe('07:30');
    expect(clockText(23.99)).toBe('23:59');
    expect(openText(5.5)).toBe('5:30 Uhr');
    expect(openText(6)).toBe('6 Uhr');
  });
});

describe('P6: Läden und Nacht-NPCs', () => {
  it('Tags offen, nachts zu; Händler kaufen und verkaufen dann nicht', () => {
    const { w, p } = build();
    const mirel = w.npcs.find((n) => n.name === 'Händlerin Mirel')!;
    p.x = mirel.x;
    p.y = mirel.y + 1;
    p.gold = 1000;
    atHour(w, 12);
    expect(mirel.closed).toBe(false);
    applyCommand(w, p.id, { type: 'buy', templateId: 'heal_small' });
    expect(p.inventory.filter((i) => i.templateId === 'heal_small').length).toBe(4);
    atHour(w, 23);
    expect(mirel.closed).toBe(true);
    drainEvents(w);
    const gold = p.gold;
    applyCommand(w, p.id, { type: 'buy', templateId: 'heal_small' });
    const ev = drainEvents(w);
    expect(p.gold).toBe(gold);
    expect(ev.some((e) => e.type === 'fail' && e.reason.includes('geschlossen') && e.reason.includes('5:30 Uhr'))).toBe(true);
    const item = p.inventory[0]!;
    applyCommand(w, p.id, { type: 'sell', itemId: item.id });
    expect(p.inventory.includes(item)).toBe(true);
    expect(closedMessage(mirel)).toContain('Händlerin Mirel');
  });
  it('Morgens öffnen sie wieder', () => {
    const { w } = build();
    atHour(w, 23);
    const mirel = w.npcs.find((n) => n.name === 'Händlerin Mirel')!;
    expect(mirel.closed).toBe(true);
    atHour(w, 6);
    expect(mirel.closed).toBe(false);
  });
  it('Nacht-NPCs: nur nachts da, stehen auf begehbaren Kacheln in der Stadt, Kennungen kollidieren nicht', () => {
    const { w } = build();
    const names = NIGHT_NPCS.map((d) => d.name);
    const npcs = w.npcs.filter((n) => names.includes(n.name));
    expect(npcs.length).toBe(NIGHT_NPCS.length);
    for (const d of NIGHT_NPCS) {
      expect(isWalkable(w.grid, d.x, d.y), d.name).toBe(true);
      expect(inSafeZone(w, d.x, d.y), d.name).toBe(true);
    }
    expect(new Set(w.npcs.map((n) => n.id)).size).toBe(w.npcs.length);
    expect(npcs.every((n) => n.id >= NIGHT_NPC_ID)).toBe(true);
    atHour(w, 12);
    expect(npcs.every((n) => n.away)).toBe(true);
    atHour(w, 23);
    expect(npcs.every((n) => !n.away)).toBe(true);
    atHour(w, 7);
    expect(npcs.every((n) => n.away)).toBe(true);
  });
  it('Nachthändler: nur nachts erreichbar; Ware nur von dort, Tageshändler bleiben zu', () => {
    const { w, p } = build();
    const hehler = w.npcs.find((n) => n.name === 'Hehler Grau')!;
    p.x = hehler.x + 1;
    p.y = hehler.y;
    p.gold = 5000;
    atHour(w, 12);
    drainEvents(w);
    applyCommand(w, p.id, { type: 'buy', templateId: 'wisdom_amulet' });
    expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
    expect(p.inventory.some((i) => i.templateId === 'wisdom_amulet')).toBe(false);
    atHour(w, 23);
    drainEvents(w);
    applyCommand(w, p.id, { type: 'buy', templateId: 'wisdom_amulet' });
    expect(p.inventory.some((i) => i.templateId === 'wisdom_amulet')).toBe(true);
    // Tagesware (Standardsortiment) führt er nicht
    applyCommand(w, p.id, { type: 'buy', templateId: 'steel_sword' });
    expect(p.inventory.some((i) => i.templateId === 'steel_sword')).toBe(false);
    // verkaufen geht beim offenen Nachthändler
    const sellable = p.inventory.find((i) => i.templateId === 'wisdom_amulet')!;
    applyCommand(w, p.id, { type: 'sell', itemId: sellable.id });
    expect(p.inventory.includes(sellable)).toBe(false);
  });
  it('Nachthändler-Sortiment kennt nur vorhandene Vorlagen und führt nichts vom Tagessortiment', () => {
    const day = new Set([...SHOPS.basic!, ...SHOPS.advanced!, ...SHOPS.artisan!]);
    expect(SHOPS.night!.length).toBeGreaterThan(5);
    for (const id of SHOPS.night!) expect(buyPrice(id), id).toBeGreaterThan(0); // wirft bei unbekannter Vorlage
    expect(SHOPS.night!.filter((id) => day.has(id))).toEqual([]);
  });
  it('Mit weggetretenem Nacht-NPC geht kein Gespräch', () => {
    const { w, p } = build();
    const hobb = w.npcs.find((n) => n.name === 'Totengräber Hobb')!;
    p.x = hobb.x;
    p.y = hobb.y + 1;
    atHour(w, 12);
    drainEvents(w);
    applyCommand(w, p.id, { type: 'talk', npcId: hobb.id });
    expect(drainEvents(w).some((e) => e.type === 'talk')).toBe(false);
    atHour(w, 23);
    drainEvents(w);
    applyCommand(w, p.id, { type: 'talk', npcId: hobb.id });
    expect(drainEvents(w).some((e) => e.type === 'talk')).toBe(true);
  });
  it('Client: syncNpcPresence setzt Anwesenheit allein aus dem Tick', () => {
    const { world } = buildWorld(0, map, { player: false });
    world.tick = 14 * TICKS_PER_HOUR; // 22 Uhr
    syncNpcPresence(world);
    expect(world.npcs.find((n) => n.name === 'Hehler Grau')!.away).toBe(false);
    expect(world.npcs.find((n) => n.name === 'Händler Dorn')!.closed).toBe(true);
  });
});

describe('P6: Nachtgegner', () => {
  it('Nachtwerte nur für Untote und Nachtjäger außerhalb von Dungeons, nie für Bosse', () => {
    const { w } = build();
    const find = (kind: string) => w.actors.find((a) => a.kindId === kind && a.kind === 'monster')!;
    expect(nightBuffable(w, find('wraith'))).toBe(true); // Friedhofsgeist (Totenacker, Moor)
    const out = w.actors.filter((a) => a.kind === 'monster' && a.kindId === 'skeleton' && regionAt(w, a.home!.x, a.home!.y)?.name === 'Totenacker');
    expect(out.length).toBeGreaterThan(0);
    expect(nightBuffable(w, out[0]!)).toBe(true);
    const cat = w.actors.filter((a) => a.kind === 'monster' && a.kindId === 'skeleton' && regionAt(w, a.home!.x, a.home!.y)?.name === 'Katakomben');
    expect(cat.length).toBeGreaterThan(0);
    expect(nightBuffable(w, cat[0]!)).toBe(false);
    expect(nightBuffable(w, find('bone_lord'))).toBe(false);
    expect(nightBuffable(w, find('field_rat'))).toBe(false);
    expect(nightBuffable(w, find('night_stalker'))).toBe(true);
  });
  it('Nachtwerte an und wieder aus: ursprüngliche Werte kommen exakt zurück', () => {
    const { w } = build();
    const m = w.actors.find((a) => a.kindId === 'zombie' && regionAt(w, a.home!.x, a.home!.y)?.name === 'Totenacker')!;
    const base = { maxHp: m.maxHp, damage: [...m.damage], aggro: m.aggroRange, reward: m.rewardMult };
    setNightBuff(m, true);
    expect(m.maxHp).toBe(Math.round(base.maxHp * NIGHT.hp));
    expect(m.damage[1]).toBeGreaterThan(base.damage[1]!);
    expect(m.aggroRange).toBeCloseTo(base.aggro + NIGHT.aggro);
    expect(m.rewardMult).toBeCloseTo(base.reward * NIGHT.reward);
    setNightBuff(m, true); // doppelt ändert nichts
    expect(m.maxHp).toBe(Math.round(base.maxHp * NIGHT.hp));
    setNightBuff(m, false);
    expect({ maxHp: m.maxHp, damage: [...m.damage], aggro: m.aggroRange, reward: m.rewardMult }).toEqual(base);
    expect(m.hp).toBeLessThanOrEqual(m.maxHp);
  });
  it('Wiederbeleben setzt den Schaden zurück: die Nachtwerte gelten danach weiter und fallen am Morgen sauber weg', () => {
    const { w } = build();
    const m = w.actors.find((a) => a.kindId === 'zombie' && regionAt(w, a.home!.x, a.home!.y)?.name === 'Totenacker')!;
    const plain: [number, number] = [m.damage[0], m.damage[1]];
    setNightBuff(m, true);
    m.damage = [plain[0], plain[1]]; // wie nach dem Wut-Ende in reviveMonster
    rebaseNight(m);
    expect(m.damage[1]).toBe(Math.max(2, Math.round(plain[1] * NIGHT.dmg)));
    setNightBuff(m, false);
    expect(m.damage).toEqual(plain);
  });
  it('Nachts erscheinen Zusatzgegner an passenden Orten; am Morgen sind sie fort', () => {
    const { w, p } = build();
    far(w, p);
    const before = w.actors.filter((a) => a.kind === 'monster').length;
    atHour(w, 12);
    expect(nightMobs(w).length).toBe(0);
    atHour(w, 22);
    const extra = nightMobs(w);
    expect(extra.length).toBeGreaterThan(NIGHT_SPAWNS.reduce((n, s) => n + s.count, 0) * 0.6);
    expect(w.actors.filter((a) => a.kind === 'monster').length).toBe(before + extra.length);
    for (const m of extra) {
      expect(isWalkable(w.grid, Math.round(m.x), Math.round(m.y))).toBe(true);
      expect(inSafeZone(w, m.x, m.y)).toBe(false);
      expect(m.nightBase).toBeTruthy();
      const zone = regionAt(w, m.x, m.y)?.name;
      expect(NIGHT_SPAWNS.some((s) => s.zone === zone && s.kinds.includes(m.kindId!))).toBe(true);
    }
    atHour(w, 7);
    for (let i = 0; i < 200; i++) tick(w); // Aufräumen läuft alle 100 Ticks
    expect(nightMobs(w).length).toBe(0);
    expect(w.actors.filter((a) => a.kind === 'monster').length).toBe(before);
    expect(w.actors.filter((a) => a.nightBase).length).toBe(0);
  });
  it('Zusatzgegner sind deterministisch (gleicher Tick, gleiche Orte) und je Nacht anders', () => {
    const run = (hours: number[]) => {
      const { w, p } = build(5);
      far(w, p);
      const out: string[] = [];
      for (const h of hours) {
        atHour(w, h);
        out.push(nightMobs(w).map((m) => `${m.kindId}@${m.x},${m.y}`).join(';'));
      }
      return out;
    };
    const a = run([22]);
    expect(a[0]!.length).toBeGreaterThan(0);
    expect(run([22])).toEqual(a);
    // zweite Nacht: andere Wahl
    const { w, p } = build(5);
    far(w, p);
    atHour(w, 22);
    const first = nightMobs(w).map((m) => `${m.kindId}@${m.x},${m.y}`).join(';');
    atHour(w, 6);
    for (let i = 0; i < 200; i++) tick(w);
    atHour(w, 22, 1); // gleiche Uhrzeit, nächste Nacht
    const second = nightMobs(w).map((m) => `${m.kindId}@${m.x},${m.y}`).join(';');
    expect(second).not.toBe(first);
  });
  it('kein Zusatzgegner vor den Füßen eines Spielers', () => {
    const { w, p } = build();
    const m = w.actors.find((a) => a.kind === 'monster' && regionAt(w, a.home!.x, a.home!.y)?.name === 'Totenacker')!;
    p.x = m.home!.x;
    p.y = m.home!.y;
    atHour(w, 22);
    for (const e of nightMobs(w)) expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThanOrEqual(9);
  });
  it('Nachts kämpft ein Untoter härter als am Tag (gleicher Gegner, gleiche Rüstung)', () => {
    const dmg = (hour: number) => {
      const { w, p } = build();
      const m = w.actors.find((a) => a.kindId === 'zombie' && regionAt(w, a.home!.x, a.home!.y)?.name === 'Totenacker')!;
      atHour(w, hour);
      return { max: m.maxHp, hi: m.damage[1], aggro: m.aggroRange, p };
    };
    const day = dmg(12);
    const night = dmg(23);
    expect(night.max).toBeGreaterThan(day.max);
    expect(night.hi).toBeGreaterThan(day.hi);
    expect(night.aggro).toBeGreaterThan(day.aggro);
    expect(monsterKind('zombie').family).toBe('undead');
  });
  it('Gleiche Welt am Tag: Nacht verändert den Tagesbetrieb nicht (kein Nachtzustand, keine Zusatzgegner)', () => {
    const { w, p } = build();
    far(w, p);
    for (let i = 0; i < 60 * TICK_RATE; i++) tick(w);
    expect(w.night).toBe(false);
    expect(nightMobs(w).length).toBe(0);
  });
  it('fixedHour (Testhilfe) löst die Nacht sofort aus', () => {
    const { w, p } = build();
    far(w, p);
    w.fixedHour = 23;
    for (let i = 0; i < 2 * TICK_RATE; i++) tick(w);
    expect(w.night).toBe(true);
    expect(nightMobs(w).length).toBeGreaterThan(0);
  });
  it('Zusatzgegner erscheinen im Schnappschuss (Mehrspieler)', () => {
    const { w, p } = build();
    far(w, p);
    atHour(w, 22);
    const m = nightMobs(w)[0]!;
    p.x = m.x + 12;
    p.y = m.y;
    const snap = makeSnapshot(w, p, []);
    expect(snap.actors.some((a) => a.id === m.id)).toBe(true);
    expect(snap.tick).toBe(w.tick);
  });
  it('Tote Zusatzgegner kommen nicht wieder', () => {
    const { w, p } = build();
    far(w, p);
    atHour(w, 22);
    const m = nightMobs(w)[0]!;
    expect(m.respawnTicks).toBeGreaterThanOrEqual(1e9);
  });
});
