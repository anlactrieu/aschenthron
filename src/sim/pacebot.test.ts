import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { xpToNext } from './data';
import { START_HOUR, TICKS_PER_HOUR } from './clock';
import { nightCare, openShops, pickMerchant, pickTarget, SpotWatch, BAN_MIN, BAN_RADIUS, STALL_MIN, WINDOW_MIN, StuckWatch, STUCK_SEC, IGNORE_MIN } from './pacebot';
import { getActor, spawnMonster, tick, TICK_RATE, type Actor, type GameEvent, type World } from './world';
import { generateItem } from './items';

const build = () => {
  const { world, playerId } = buildWorld(5, mapJson as unknown as TiledMap);
  const p = getActor(world, playerId)!;
  // freies Feld ohne Gegner: alle Monster aus dem Spiel nehmen, dann gezielt setzen
  world.actors = world.actors.filter((a) => a.kind !== 'monster');
  p.level = 10;
  p.x = world.start.x;
  p.y = world.start.y;
  return { w: world, p };
};
const mob = (w: World, p: Actor, dx: number, level: number): Actor => {
  const m = spawnMonster(w, p.x + dx, p.y, 'field_rat');
  m.level = level;
  return m;
};
const all = () => true;
const nightClock = (w: World) => { w.tick = Math.round((22 - START_HOUR) * TICKS_PER_HOUR); for (let i = 0; i < TICK_RATE; i++) tick(w); };

describe('Pace-Bot: Zielwahl', () => {
  it('wählt den nächsten Gegner in [Stufe−4, Stufe+1]', () => {
    const { w, p } = build();
    mob(w, p, 3, 5); // zu schwach (< Stufe−4)
    const nah = mob(w, p, 8, 11);
    mob(w, p, 12, 9);
    mob(w, p, 2, 12); // zu stark
    expect(pickTarget(w, p, { bot: 'new', free: all })!.id).toBe(nah.id);
  });
  it('mit Vorsicht höchstens Stufe+0', () => {
    const { w, p } = build();
    mob(w, p, 2, 11);
    const gleich = mob(w, p, 9, 10);
    expect(pickTarget(w, p, { bot: 'new', free: all, caution: true })!.id).toBe(gleich.id);
    expect(pickTarget(w, p, { bot: 'new', free: all })!.level).toBe(11);
  });
  it('gemiedene Plätze werden übersprungen, auch beim Fallback', () => {
    const { w, p } = build();
    const nah = mob(w, p, 3, 10);
    const weit = mob(w, p, 40, 10);
    const free = (a: Actor) => a.id !== nah.id;
    expect(pickTarget(w, p, { bot: 'new', free })!.id).toBe(weit.id);
  });
  it('Fallback `far`: neu nach Nähe, alt nach höchster Stufe', () => {
    const { w, p } = build();
    p.level = 20;
    const nah = mob(w, p, 4, 5); // unter Stufe−4: kein Nahziel, im Fallback erlaubt
    const hoch = mob(w, p, 40, 15);
    expect(pickTarget(w, p, { bot: 'new', free: all })!.id).toBe(nah.id);
    expect(pickTarget(w, p, { bot: 'fa18', free: all })!.id).toBe(hoch.id);
  });
  it('ohne Ziel: undefined', () => {
    const { w, p } = build();
    expect(pickTarget(w, p, { bot: 'new', free: all })).toBeUndefined();
  });
});

describe('Pace-Bot: Platzwechsel', () => {
  const fenster = (watch: SpotWatch, w: World, p: Actor, minutes: number) => {
    let res = false;
    for (let i = 0; i < minutes * 60 * (TICK_RATE / 10); i++) res = watch.step(w, p, 10, TICK_RATE);
    return res;
  };
  it('bannt den Ort bei zu wenig XP, wenn der Bot jagt', () => {
    const { w, p } = build();
    const m = mob(w, p, 4, 10);
    p.targetId = m.id;
    p.x = 100;
    p.y = 100;
    m.x = 103;
    m.y = 100;
    const watch = new SpotWatch('new');
    watch.gained = 1; // fast nichts
    w.tick = 5000;
    expect(fenster(watch, w, p, WINDOW_MIN)).toBe(true);
    expect(watch.banned(w, 100 + BAN_RADIUS - 1, 100)).toBe(true);
    expect(watch.banned(w, 100 + BAN_RADIUS + 1, 100)).toBe(false);
    w.tick += BAN_MIN * 60 * TICK_RATE + 1;
    expect(watch.banned(w, 100, 100)).toBe(false);
    expect(watch.gained).toBe(0);
  });
  it('genug XP: kein Wechsel', () => {
    const { w, p } = build();
    const m = mob(w, p, 4, 10);
    p.targetId = m.id;
    m.x = p.x + 3;
    const watch = new SpotWatch('new');
    watch.gained = Math.ceil((xpToNext(p.level) / STALL_MIN) * WINDOW_MIN) + 100;
    expect(fenster(watch, w, p, WINDOW_MIN)).toBe(false);
    expect(watch.bans).toHaveLength(0);
  });
  it('bannt nicht in der Stadt und nicht auf dem Weg, das Fenster läuft weiter', () => {
    const { w, p } = build();
    const watch = new SpotWatch('new');
    watch.gained = 0;
    // Stadt (Start liegt in der Schutzzone)
    const m = mob(w, p, 4, 10);
    p.targetId = m.id;
    expect(fenster(watch, w, p, WINDOW_MIN + 1)).toBe(false);
    expect(watch.bans).toHaveLength(0);
    // draußen, aber ohne Ziel (unterwegs)
    p.x = 100;
    p.y = 100;
    p.targetId = null;
    expect(fenster(watch, w, p, 1)).toBe(false);
    expect(watch.bans).toHaveLength(0);
    // Ziel fern (noch auf dem Weg)
    const fern = mob(w, p, 0, 10);
    fern.x = 100 + 40;
    fern.y = 100;
    p.targetId = fern.id;
    expect(fenster(watch, w, p, 1)).toBe(false);
    // sobald es kämpft: sofort gewechselt
    fern.x = 103;
    expect(watch.step(w, p, 10, TICK_RATE)).toBe(true);
    expect(watch.bans).toHaveLength(1);
  });
  it('Quest-XP zählt nicht als Jagdertrag, Kampf-XP schon', () => {
    const { p } = build();
    const watch = new SpotWatch('new');
    const ev: GameEvent[] = [
      { type: 'questTurned', questId: 'q', xp: 500, gold: 1, to: p.id },
      { type: 'xp', amount: 500, to: p.id },
      { type: 'xp', amount: 30, to: p.id },
      { type: 'xp', amount: 99, to: p.id + 1 },
    ];
    watch.addEvents(ev, p.id);
    expect(watch.gained).toBe(30);
    const alt = new SpotWatch('fa18');
    alt.addEvents(ev, p.id);
    expect(alt.gained).toBe(530);
  });
  it('der alte Bot wechselt nie', () => {
    const { w, p } = build();
    p.x = 100;
    p.y = 100;
    expect(fenster(new SpotWatch('old'), w, p, 3 * WINDOW_MIN)).toBe(false);
  });
});

describe('Pace-Bot: Nacht und Vorräte', () => {
  it('nachts sind Händler zu; nur `vess` kennt den Nachthändler', () => {
    const { w, p } = build();
    expect(openShops(w, 'new').length).toBeGreaterThan(0);
    nightClock(w);
    expect(openShops(w, 'new')).toHaveLength(0);
    expect(openShops(w, 'fa18')).toHaveLength(0);
    expect(openShops(w, 'old').length).toBeGreaterThan(0); // `old` fragt nicht nach Öffnung
    const nacht = openShops(w, 'vess');
    expect(nacht.length).toBeGreaterThan(0);
    expect(nacht.every((n) => n.shop === 'night')).toBe(true);
    expect(pickMerchant(w, p, 'vess')!.shop).toBe('night');
    expect(pickMerchant(w, p, 'new')).toBeUndefined();
  });
  it('knappe Tränke bei geschlossenen Läden: Vorsicht bzw. Warten', () => {
    const { w, p } = build();
    nightClock(w);
    p.inventory = [];
    expect(nightCare(w, p, 'new')).toEqual({ caution: true, wait: true });
    p.inventory = [generateItem(w.rng, w.nextId++, 'heal_small', 'normal'), generateItem(w.rng, w.nextId++, 'heal_small', 'normal')];
    expect(nightCare(w, p, 'new')).toEqual({ caution: true, wait: false });
    for (let i = 0; i < 2; i++) p.inventory.push(generateItem(w.rng, w.nextId++, 'heal_small', 'normal'));
    expect(nightCare(w, p, 'new')).toEqual({ caution: false, wait: false });
  });
  it('tagsüber keine Vorsicht', () => {
    const { w, p } = build();
    p.inventory = [];
    expect(nightCare(w, p, 'new')).toEqual({ caution: false, wait: false });
  });
});

describe('Pace-Bot: Hänger', () => {
  it('Ziel, das nichts bewirkt, wird nach STUCK_SEC verworfen und eine Weile ignoriert', () => {
    const { w, p } = build();
    const m = mob(w, p, 1, 10);
    p.targetId = m.id;
    const watch = new StuckWatch('new');
    let verworfen = false;
    for (let i = 0; i < STUCK_SEC * TICK_RATE + 20 && !verworfen; i += 10) {
      w.tick += 10;
      verworfen = watch.step(w, p, TICK_RATE);
    }
    expect(verworfen).toBe(true);
    expect(watch.ignored(w, m.id)).toBe(true);
    w.tick += IGNORE_MIN * 60 * TICK_RATE + 1;
    expect(watch.ignored(w, m.id)).toBe(false);
  });
  it('Fortschritt (Ziel verliert Leben) setzt die Uhr zurück; der alte Bot ignoriert nie', () => {
    const { w, p } = build();
    const m = mob(w, p, 1, 10);
    p.targetId = m.id;
    const watch = new StuckWatch('new');
    for (let i = 0; i < 3 * STUCK_SEC * TICK_RATE; i += 10) {
      w.tick += 10;
      if (i % (10 * TICK_RATE) === 0) m.hp -= 1;
      expect(watch.step(w, p, TICK_RATE)).toBe(false);
    }
    const alt = new StuckWatch('fa18');
    for (let i = 0; i < 3 * STUCK_SEC * TICK_RATE; i += 10) {
      w.tick += 10;
      expect(alt.step(w, p, TICK_RATE)).toBe(false);
    }
  });
});
