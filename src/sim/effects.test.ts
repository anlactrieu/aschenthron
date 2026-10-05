import { describe, expect, it } from 'vitest';
import { EFFECTS, cleanse, controlDr, dispel, mergeStatus } from './effects';
import { STATUS_IDS, SKILLS, schoolOf, type StatusId } from './data';
import { applyCommand, applyStatus, activeSkills, createWorld, drainEvents, spawnMonster, spawnPlayer, tick, TICK_RATE } from './world';
import { actorFromLite, makeSnapshot } from './net';
import { generateItem } from './items';
import type { Grid } from './path';

const open = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });
const fresh = () => {
  const w = createWorld(3, open());
  const p = spawnPlayer(w, 10, 10);
  p.maxHp = p.hp = 100000;
  return { w, p };
};

describe('Effekte (Stufe 6, Phase 1)', () => {
  it('jeder Status hat eine Definition', () => {
    for (const id of STATUS_IDS) expect(EFFECTS[id]).toBeDefined();
  });

  it('refresh: nur längere Dauer verlängert; replace: Stärkeres ersetzt; stack: addiert bis zur Obergrenze', () => {
    const refresh = EFFECTS.slow;
    expect(mergeStatus(refresh, { until: 100 }, { until: 80 })).toBeNull();
    expect(mergeStatus(refresh, { until: 100 }, { until: 120 })).toEqual({ until: 120 });
    const rep = { ...refresh, stack: 'replace' as const };
    expect(mergeStatus(rep, { until: 100, mag: 30 }, { until: 200, mag: 20 })).toBeNull();
    expect(mergeStatus(rep, { until: 100, mag: 30 }, { until: 50, mag: 40 })).toEqual({ until: 50, mag: 40 });
    const stack = { ...refresh, stack: 'stack' as const, cap: 50 };
    expect(mergeStatus(stack, { until: 100, mag: 30 }, { until: 90, mag: 30 })).toEqual({ until: 100, mag: 50 });
  });

  it('Kontroll-Verkürzung: Wiederholung im Fenster verkürzt bis zur Untergrenze', () => {
    const def = { ...EFFECTS.stun, dr: { window: 100, step: 0.5, floor: 0.25 } };
    const a = controlDr(def, undefined, 10);
    expect(a.factor).toBe(1);
    const b = controlDr(def, a.state, 50);
    expect(b.factor).toBe(0.5);
    const c = controlDr(def, b.state, 90);
    expect(c.factor).toBe(0.25);
    expect(controlDr(def, c.state, 500).factor).toBe(1);
  });

  it('applyStatus: Dauer, Resistenz-Notiz und Immunität erklären sich im Log (nur an Spieler)', () => {
    const { w, p } = fresh();
    const skel = spawnMonster(w, 12, 10, 'skeleton');
    const demon = spawnMonster(w, 13, 10, 'imp');
    drainEvents(w);
    w.cmdActor = p.id;
    applyStatus(w, skel, 'burn', 3, 'poison'); // Untote: Gift 100 % → immun
    expect(skel.status.burn).toBeUndefined();
    applyStatus(w, demon, 'burn', 3, 'fire'); // Dämon: Feuer 60 % → verkürzt
    expect(demon.status.burn).toBeDefined();
    const notes = drainEvents(w).filter((e) => e.type === 'note');
    expect(notes).toHaveLength(2);
    expect(notes.every((e) => e.to === p.id)).toBe(true);
    // Monster gegen Monster ohne Spieler als Befehlsgeber: kein Log
    w.cmdActor = null;
    applyStatus(w, skel, 'burn', 3, 'poison');
    expect(drainEvents(w).filter((e) => e.type === 'note')).toHaveLength(0);
  });

  it('Log-Notizen werden entprellt: 10 Spinnenbisse in 2 s melden die Resistenz nur einmal', () => {
    const { w, p } = fresh();
    p.equipment.ring = Object.assign(generateItem(w.rng, w.nextId++, 'iron_ring', 'normal'), { affixes: [{ stat: 'resPoison' as const, value: 30 }] });
    const spider = spawnMonster(w, 11, 10, 'venom_spider');
    drainEvents(w);
    for (let i = 0; i < 10; i++) {
      applyStatus(w, p, 'slow', 2, 'poison');
      w.tick += 4;
    }
    expect(drainEvents(w).filter((e) => e.type === 'note')).toHaveLength(1);
    w.tick += 200;
    applyStatus(w, p, 'slow', 2, 'poison');
    expect(drainEvents(w).filter((e) => e.type === 'note')).toHaveLength(1);
    void spider;
  });

  it('Läuterung entfernt Debuffs, Kontrolle und Gift; Bannung lässt sie unberührt', () => {
    const { w, p } = fresh();
    p.status = { slow: w.tick + 100, stun: w.tick + 100, burn: w.tick + 100 };
    p.burn = { perSec: 3, srcId: 0 };
    p.dot = { perSec: 2, until: w.tick + 100, srcId: 0 };
    expect(dispel(p, STATUS_IDS)).toEqual([]);
    expect(Object.keys(p.status)).toHaveLength(3);
    expect(cleanse(p, STATUS_IDS)).toBe(4);
    expect(p.status).toEqual({});
    expect(p.burn).toBeNull();
    expect(p.dot).toBeNull();
  });

  it('Status laufen ab und werden bei Tod samt Stärke geleert', () => {
    const { w, p } = fresh();
    const m = spawnMonster(w, 12, 10, 'goblin');
    applyStatus(w, m, 'slow', 1, 'physical', undefined, 40);
    expect(m.statusMag?.slow).toBe(40);
    for (let i = 0; i < TICK_RATE + 2; i++) tick(w);
    expect(m.status.slow).toBeUndefined();
    expect(m.statusMag?.slow).toBeUndefined();
    void p;
  });

  it('Netz: Statusliste kommt aus STATUS_IDS und überlebt den Schnappschuss', () => {
    const { w, p } = fresh();
    const m = spawnMonster(w, 12, 10, 'goblin');
    for (const id of STATUS_IDS as readonly StatusId[]) m.status[id] = w.tick + 100;
    const snap = makeSnapshot(w, p, []);
    const lite = snap.actors.find((a) => a.id === m.id)!;
    expect(lite.st).toEqual([...STATUS_IDS]);
    expect(Object.keys(actorFromLite(lite, w.tick).status).sort()).toEqual([...STATUS_IDS].sort());
  });

  it('Skills: jede Gruppe ableitbar, Alt-Skills aktiv, Passive gewirkt gibt Fehler', () => {
    for (const s of SKILLS) expect(schoolOf(s)).toBeTruthy();
    expect(schoolOf(SKILLS.find((s) => s.id === 'healing_hand')!)).toBe('heal');
    expect(schoolOf(SKILLS.find((s) => s.id === 'poison_shot')!)).toBe('dot');
    const { w, p } = fresh();
    p.skills = SKILLS.map((s) => s.id);
    expect(activeSkills(p)).toEqual(p.skills.filter((id) => !SKILLS.find((s) => s.id === id)!.passive));
    SKILLS.push({ ...SKILLS[0]!, id: 'test_passive', passive: true });
    try {
      p.skills.push('test_passive');
      expect(activeSkills(p)).not.toContain('test_passive');
      drainEvents(w);
      applyCommand(w, p.id, { type: 'useSkill', skillId: 'test_passive' });
      expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
    } finally {
      SKILLS.pop();
    }
  });
});
