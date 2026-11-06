import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { isWalkable } from '../sim/path';
import { regionAt } from '../sim/world';
import { MAX_CRITTERS, TRAVELERS, ZONE_FAUNA, farFromRoute, fleeAngle, landmarksOf, noteText, packFrames, routeAt, routeLength, travelerAt } from './wildlife';
import { DEER_POSES, bat, deer, frog } from './world/critters';
import { campCold, corpse, gallows, merchantCart, merchantCartV, ruin, shrine } from './world/props';
import { RESIDENT_KINDS } from './npc';

const map = mapJson as unknown as TiledMap;
const { world } = buildWorld(1, map);
const g = world.grid;
const ground = (mapJson.layers[0] as unknown as { data: number[] }).data;
const gidAt = (x: number, y: number): number => ground[y * g.w + x]!;
const seeded = (): (() => number) => {
  let s = 11;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};
const lms = landmarksOf(map as unknown as Parameters<typeof landmarksOf>[0]);
const DUNGEONS = ['Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche', 'Goblinbau', 'Spinnennest', 'Aschengrund'];

describe('Wildnis: Landmarken in der Karte', () => {
  it('es gibt Landmarken aller fünf Arten in mindestens drei Zonen', () => {
    expect(lms.length).toBeGreaterThanOrEqual(15);
    expect(new Set(lms.map((l) => l.kind))).toEqual(new Set(['ruin', 'shrine', 'gallows', 'camp', 'corpse']));
    const zones = new Set(lms.map((l) => regionAt(world, l.x, l.y)?.name));
    expect(zones.size).toBeGreaterThanOrEqual(3);
  });
  it('jede steht auf freiem Boden, in einer Wildnis-Zone mit Tieren (nicht in Stadt oder Dungeon), und die Ids sind eindeutig', () => {
    for (const l of lms) {
      expect(isWalkable(g, l.x, l.y), l.id).toBe(true);
      const z = regionAt(world, l.x, l.y)?.name ?? '';
      expect(ZONE_FAUNA[z], `${l.id} in ${z}`).toBeDefined();
    }
    expect(new Set(lms.map((l) => l.id)).size).toBe(lms.length);
  });
  it('Leichen und Lagerfeuer tragen eine kurze Notiz, alle anderen keine; das Stichwort ist (noch) leer', () => {
    for (const l of lms) {
      if (l.kind === 'corpse') expect(noteText(l).length, l.id).toBeGreaterThan(40);
      expect(noteText(l).length, l.id).toBeLessThanOrEqual(240);
      if (l.kind === 'ruin' || l.kind === 'shrine' || l.kind === 'gallows') expect(l.text).toBe('');
      expect(l.topic).toBe('');
    }
  });
  it('die Karte selbst bleibt unberührt: Landmarken sind nur Objekte, die Sim kennt keine', () => {
    expect(world.npcs.length).toBe(22);
  });
});

describe('Wildnis: Handelsstraße und Reisende', () => {
  it('die Strecke liegt durchgehend auf Wegkacheln', () => {
    for (let s = 0; s <= routeLength(); s += 0.5) {
      const p = routeAt(s);
      expect(gidAt(Math.round(p.x), Math.round(p.y)), `s=${s} (${p.x},${p.y})`).toBe(7);
    }
  });
  it('Reisende bleiben immer auf der Strecke, drehen an den Toren um und blenden dort aus', () => {
    const L = routeLength();
    for (const def of TRAVELERS) {
      let turned = false;
      let last = travelerAt(def, 0);
      for (let t = 0; t < (2 * (2 * L) * 1000) / def.speed; t += 250) {
        const p = travelerAt(def, t);
        expect(gidAt(Math.round(p.x), Math.round(p.y))).toBe(7);
        expect(p.fade).toBeGreaterThanOrEqual(0);
        expect(p.fade).toBeLessThanOrEqual(1);
        if (p.fade < 0.1) turned = true;
        last = p;
      }
      expect(turned).toBe(true);
      expect(Math.hypot(last.dx, last.dy)).toBeCloseTo(1, 5);
    }
  });
  it('Reisende nutzen vorhandene Bewohner-Figuren (kein neuer Backauftrag)', () => {
    for (const def of TRAVELERS) expect(RESIDENT_KINDS).toContain(def.look);
  });
  it('Nähe zur Strecke', () => {
    expect(farFromRoute(70, 141, 5)).toBe(false);
    expect(farFromRoute(200, 20, 40)).toBe(true);
  });
});

describe('Wildnis: Tiere', () => {
  it('Zonen mit Tieren sind echte Wildnis-Regionen der Karte; Städte und Dungeons bleiben leer', () => {
    const names = new Set(world.regions.map((r) => r.name));
    for (const z of Object.keys(ZONE_FAUNA)) {
      expect(names.has(z), z).toBe(true);
      expect(DUNGEONS).not.toContain(z);
      expect(z === 'Aschenhafen' || z === 'Felsenwacht').toBe(false);
    }
    expect(Object.values(ZONE_FAUNA).every((f) => f.reduce((n, a) => n + a.cap, 0) >= 2)).toBe(true);
  });
  it('Fledermäuse nur in dunklen Zonen, Frösche im Moor, Rehe auf dem Land', () => {
    expect(ZONE_FAUNA.Moorlande!.some((f) => f.kind === 'frog')).toBe(true);
    expect(ZONE_FAUNA.Roggenfelder!.some((f) => f.kind === 'deer')).toBe(true);
    expect(ZONE_FAUNA.Roggenfelder!.some((f) => f.kind === 'bat')).toBe(false);
    expect(ZONE_FAUNA.Totenacker!.some((f) => f.kind === 'bat')).toBe(true);
  });
  it('das Budget ist begrenzt', () => {
    for (const f of Object.values(ZONE_FAUNA)) expect(f.reduce((n, a) => n + a.cap, 0)).toBeLessThanOrEqual(MAX_CRITTERS + 4);
  });
  it('Fluchtrichtung zeigt vom Helden weg und weicht Hindernissen aus', () => {
    const rng = seeded();
    const hero = { x: 0, y: 0 };
    const deerAt = { x: 5, y: 0 };
    const a = fleeAngle(hero, deerAt, rng, () => true)!;
    expect(Math.cos(a)).toBeGreaterThan(0.5);
    // Osten versperrt: ein anderer Winkel, der frei ist
    const blocked = fleeAngle(hero, deerAt, rng, (x) => x < 5.5)!;
    expect(blocked).not.toBeNull();
    expect(fleeAngle(hero, deerAt, rng, () => false)).toBeNull();
  });
});

describe('Wildnis: Bilder', () => {
  it('alle Bilder haben Inhalt und bleiben im Atlas (1024 breit)', () => {
    const all = [
      ...DEER_POSES.map((p) => deer(p)), frog(false), frog(true), bat(0), bat(1), ruin(0), ruin(1), ruin(2), shrine(), gallows(), campCold(), corpse(0), corpse(1),
      merchantCart(0), merchantCart(1), merchantCartV(true), merchantCartV(false),
    ];
    for (const r of all) {
      expect(r.d.some((p) => p >>> 24 > 0)).toBe(true);
      expect(r.w * 2).toBeLessThanOrEqual(256);
    }
    const sizes = all.map((r, i) => ({ name: `f${i}`, w: r.w * 2, h: r.h * 2 }));
    const { pos, height } = packFrames(sizes, 1024);
    expect(height).toBeLessThan(512);
    // keine Überlappung
    const boxes = sizes.map((s) => ({ ...pos.get(s.name)!, w: s.w, h: s.h }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${i}/${j}`).toBe(true);
      }
    }
  });
  it('Landmarken-Bilder sind deterministisch', () => {
    expect([...ruin(1).d]).toEqual([...ruin(1).d]);
    expect([...corpse(0).d]).not.toEqual([...corpse(1).d]);
  });
});
