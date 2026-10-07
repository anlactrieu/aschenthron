import { describe, expect, it } from 'vitest';
import type { Grid } from './path';
import { SKILLS, SPECS, SPEC_LEVEL } from './data';
import { LEGENDARIES, POWER_TEXT, TEMPLATES, generateItem } from './items';
import { applyCommand, armorOf, createWorld, maxHpOf, powerOf, spawnPlayer, tick, type World } from './world';
import { exportPlayer, importPlayer } from './save';

const big = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });

describe('Meisterschaft', () => {
  it('erst ab Stufe 20, einmal wählbar, wirkt als Wert und überlebt Speichern', () => {
    const w = createWorld(1, big());
    const p = spawnPlayer(w, 10, 10);
    applyCommand(w, p.id, { type: 'chooseSpec', spec: 'warden' });
    expect(p.spec).toBeUndefined();
    p.level = SPEC_LEVEL;
    const hp = maxHpOf(p);
    const ar = armorOf(p);
    applyCommand(w, p.id, { type: 'chooseSpec', spec: 'warden' });
    expect(p.spec).toBe('warden');
    expect(maxHpOf(p)).toBeGreaterThan(hp + 100);
    expect(armorOf(p)).toBeGreaterThan(ar);
    applyCommand(w, p.id, { type: 'chooseSpec', spec: 'ranger' });
    expect(p.spec).toBe('warden');
    const w2: World = createWorld(2, big());
    const q = spawnPlayer(w2, 10, 10);
    expect(importPlayer(w2, q, exportPlayer(p))).toBe(true);
    expect(q.spec).toBe('warden');
  });
  it('Daten: jede Meisterschaft hat nur bekannte Werte', () => {
    expect(SPECS.length).toBe(4);
    for (const s of SPECS) expect(Object.keys(s.bonus).length).toBeGreaterThan(2);
  });
});

describe('Hohe Stufen und neue Effekte', () => {
  it('es gibt Fertigkeiten für die Stufen 23 bis 30', () => {
    for (const lv of [23, 24, 25, 26, 27, 28, 29, 30]) expect(SKILLS.some((s) => s.levelReq === lv)).toBe(true);
  });
  it('neue Powers haben Text, Unikate und Proc-Waffen sind gültig', () => {
    for (const id of ['execute', 'healKill', 'burnHit', 'frostHit'] as const) expect(POWER_TEXT[id](10)).toContain('10');
    for (const l of LEGENDARIES) expect(TEMPLATES.some((t) => t.id === l.base)).toBe(true);
    expect(TEMPLATES.filter((t) => t.base?.some((b) => b.stat === 'procBurn' || b.stat === 'procFrost')).length).toBe(4);
  });
  it('Power-Summe liest Ausrüstung', () => {
    const w = createWorld(1, big());
    const p = spawnPlayer(w, 10, 10);
    expect(powerOf(p, 'execute')).toBe(0);
  });
});

describe('Level-Meilensteine', () => {
  it('Stufe 10 bringt Extrapunkte, Neuverteilen behält sie, Rang-Grenze liegt im Level-Cap', async () => {
    const { gainXp } = await import('./world');
    const { totalXpFor, milestonePoints, rankLevelReq, MAX_LEVEL } = await import('./data');
    const w = createWorld(1, big());
    const p = spawnPlayer(w, 10, 10);
    const before = p.statPoints;
    gainXp(w, p, totalXpFor(10) + 1);
    expect(p.level).toBe(10);
    expect(p.statPoints).toBe(before + 5 * 9 + milestonePoints(10).stat);
    expect(milestonePoints(30).stat).toBe(26);
    expect(rankLevelReq(22, 5)).toBe(Math.min(MAX_LEVEL, 34));
  });
});

describe('Teleport-Schriftrollen', () => {
  const setup = () => {
    const w = createWorld(1, { w: 120, h: 120, walkable: new Array(14400).fill(true) });
    w.towns.push({ x: 100, y: 100, name: 'Felsenwacht' }, { x: 10, y: 10, name: 'Aschenhafen' });
    const p = spawnPlayer(w, 60, 60);
    const scroll = makeScroll(w, 'scroll_hafen');
    p.inventory.push(scroll);
    return { w, p, scroll };
  };
  const makeScroll = (w: World, id: string) => generateItem(w.rng, 9000, id, 'normal');
  it('braucht 3 s, bringt in die Stadt und verbraucht die Rolle', () => {
    const { w, p, scroll } = setup();
    applyCommand(w, p.id, { type: 'usePotion', itemId: scroll.id });
    expect(p.tele).toBeDefined();
    for (let i = 0; i < 70; i++) tick(w);
    expect(Math.round(p.x)).toBe(10);
    expect(p.inventory.some((i) => i.id === scroll.id)).toBe(false);
  });
  it('Bewegung bricht ab und die Rolle bleibt erhalten', () => {
    const { w, p, scroll } = setup();
    applyCommand(w, p.id, { type: 'usePotion', itemId: scroll.id });
    p.x += 2;
    for (let i = 0; i < 70; i++) tick(w);
    expect(p.tele).toBeUndefined();
    expect(Math.round(p.x)).toBe(62);
    expect(p.inventory.some((i) => i.id === scroll.id)).toBe(true);
  });
});
