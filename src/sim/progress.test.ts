import { describe, expect, it } from 'vitest';
import type { Grid } from './path';
import { KILL_GOALS, LEVEL_TITLES, MAX_LEVEL, XP_VERSION, migrateXpV1, questXp, totalXpFor, xpStretch, xpToNext } from './data';
import { NAMED } from './named';
import { generateNamed, rollLoot, templateById, type Item } from './items';
import { Rng } from './rng';
import { QUESTS, NAMED_SHARE } from './data';
import { addNpc, applyCommand, createWorld, gainXp, questRewardChoices, groupKills, merchantNamed, namedPrice, spawnMonster, spawnPlayer, tick, type Actor, type World } from './world';
import { exportPlayer, importPlayer } from './save';

const big = (): Grid => ({ w: 40, h: 40, walkable: new Array(1600).fill(true) });

describe('P3 Stufenkurve', () => {
  it('Streckfaktor steigt mit der Stufe (früh flott, spät zäh)', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) expect(xpStretch(l)).toBeGreaterThanOrEqual(xpStretch(l - 1));
    expect(xpStretch(1)).toBeLessThan(xpStretch(MAX_LEVEL));
    for (let l = 1; l < MAX_LEVEL; l++) expect(totalXpFor(l + 1) - totalXpFor(l)).toBe(xpToNext(l));
  });

  it('Aufgaben-XP wächst mit dem Faktor ihrer Stufe', () => {
    expect(questXp(1, 100)).toBe(Math.round(100 * xpStretch(1)));
    expect(questXp(20, 100)).toBeGreaterThan(questXp(5, 100));
  });

  it('alter Spielstand (ohne xpv) behält Stufe und Anteil innerhalb der Stufe', () => {
    const w = createWorld(1, big());
    const p = spawnPlayer(w, 10, 10);
    const json = JSON.parse(exportPlayer(p)) as { v: number; xpv?: number; player: Record<string, unknown> };
    delete json.xpv;
    json.player.level = 12;
    json.player.xp = 0; // unter der Schwelle → Schwelle der Stufe
    const q = spawnPlayer(w, 12, 12);
    expect(importPlayer(w, q, JSON.stringify(json))).toBe(true);
    expect(q.level).toBe(12);
    expect(q.xp).toBe(totalXpFor(12));
    // gleicher Stand mit neuer Version wird nicht umgerechnet
    json.xpv = XP_VERSION;
    json.player.xp = totalXpFor(12) + 5;
    expect(importPlayer(w, q, JSON.stringify(json))).toBe(true);
    expect(q.xp).toBe(totalXpFor(12) + 5);
  });

  it('Umrechnung: Anteil bleibt, Stufe bleibt, Cap bleibt', () => {
    expect(migrateXpV1(10, 0)).toBe(totalXpFor(10));
    for (let l = 1; l < MAX_LEVEL; l++) {
      const x = migrateXpV1(l, 1e12);
      expect(x).toBeGreaterThanOrEqual(totalXpFor(l));
      expect(x).toBeLessThan(totalXpFor(l + 1));
    }
    expect(migrateXpV1(MAX_LEVEL, 0)).toBe(totalXpFor(MAX_LEVEL));
  });
});

function killOne(w: World, p: Actor, kind: string): void {
  const m = spawnMonster(w, p.x + 1, p.y, kind);
  m.hp = 1;
  applyCommand(w, p.id, { type: 'attack', targetId: m.id });
  for (let t = 0; t < 400 && m.alive; t++) tick(w);
  expect(m.alive).toBe(false);
}

describe('P3 Titel und Kill-Ziele', () => {
  it('Stufentitel bei 10, wählbar, überlebt Speichern', () => {
    const w = createWorld(1, big());
    const p = spawnPlayer(w, 10, 10);
    gainXp(w, p, totalXpFor(10) - p.xp);
    expect(p.level).toBe(10);
    expect(p.titles).toContain(LEVEL_TITLES[10]);
    expect(p.title).toBe(LEVEL_TITLES[10]);
    applyCommand(w, p.id, { type: 'setTitle', title: 'Erfunden' });
    expect(p.title).toBe(LEVEL_TITLES[10]);
    applyCommand(w, p.id, { type: 'setTitle', title: null });
    expect(p.title).toBeUndefined();
    const q = spawnPlayer(w, 12, 12);
    expect(importPlayer(w, q, exportPlayer(p))).toBe(true);
    expect(q.titles).toContain(LEVEL_TITLES[10]);
  });

  it('Kills je Art zählen; 100 Ratten geben den Titel, 500 schalten gefundene Funde beim Händler frei', () => {
    const w = createWorld(3, big());
    const p = spawnPlayer(w, 10, 10);
    p.attrs.kraft = 60;
    killOne(w, p, 'field_rat');
    expect(p.kills?.field_rat).toBe(1);
    p.kills!.burrow_rat = KILL_GOALS[0] - 2;
    killOne(w, p, 'giant_rat');
    expect(groupKills(p, 'rats')).toBe(KILL_GOALS[0]);
    expect(p.titles).toContain('Rattenfänger');
    const ratFind = NAMED.find((d) => d.group === 'rats')!;
    p.found = [ratFind.id];
    expect(merchantNamed(p)).toEqual([]);
    p.kills!.burrow_rat = KILL_GOALS[1];
    killOne(w, p, 'field_rat');
    expect(p.titles).toContain('Plage der Plagen');
    expect(merchantNamed(p)).toEqual([ratFind.id]);
    addNpc(w, 'merchant', 'Händler', p.x, p.y + 1);
    p.gold = namedPrice(ratFind.id);
    applyCommand(w, p.id, { type: 'buy', templateId: ratFind.base, named: ratFind.id });
    expect(p.gold).toBe(0);
    expect(p.inventory.some((i) => i.named === ratFind.id)).toBe(true);
    // nicht gefundene Funde bleiben gesperrt
    const other = NAMED.find((d) => d.group === 'rats' && d.id !== ratFind.id)!;
    p.gold = 1e6;
    applyCommand(w, p.id, { type: 'buy', templateId: other.base, named: other.id });
    expect(p.inventory.some((i) => i.named === other.id)).toBe(false);
  });

  it('Aufheben merkt den Fund fürs Bestiarium; Laden ergänzt Funde aus dem Besitz und unbekannte Kennungen fallen weg', () => {
    const w = createWorld(4, big());
    const p = spawnPlayer(w, 10, 10);
    const it = generateNamed(w.nextId++, NAMED[0]!.id);
    w.ground.push({ id: w.nextId++, x: 10, y: 10, item: it, expiresAt: null });
    applyCommand(w, p.id, { type: 'pickup', groundId: w.ground[w.ground.length - 1]!.id });
    for (let t = 0; t < 20; t++) tick(w);
    expect(p.found).toContain(NAMED[0]!.id);
    const json = JSON.parse(exportPlayer(p)) as { player: { found: string[]; inventory: Record<string, unknown>[] } };
    json.player.found = [];
    json.player.inventory.push({ ...generateNamed(999, NAMED[1]!.id), named: 'n_gibtsnicht' });
    const q = spawnPlayer(w, 12, 12);
    expect(importPlayer(w, q, JSON.stringify(json))).toBe(true);
    expect(q.found).toContain(NAMED[0]!.id);
    const ghost = q.inventory.find((i) => i.id === 999)!;
    expect(ghost).toBeDefined();
    expect(ghost.named).toBeUndefined();
  });
});

/** Fest: Grundgegenstand ohne gewürfelte Affixe oder benannter Fund ohne Affix-Stufen. */
const fixedLoot = (i: Item): boolean => {
  const base = templateById(i.templateId).base?.length ?? 0;
  if (i.named) return i.affixes.every((a) => a.tier === undefined);
  return i.rarity === 'normal' && i.affixes.length === base;
};

describe('P3 Beute: benannt und fest', () => {
  it('normale Monsterbeute hat nie Zufallsaffixe; etwa 30 % benannte Funde, die Gruppe bevorzugt', () => {
    const rng = new Rng(11);
    let id = 1;
    let named = 0;
    let own = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const it = rollLoot(rng, () => id++, 8, 'goblins', NAMED_SHARE, 0.12);
      expect(fixedLoot(it), it.name).toBe(true);
      if (it.named) {
        named++;
        if (NAMED.find((d) => d.id === it.named)!.group === 'goblins') own++;
      }
    }
    expect(named / N).toBeGreaterThan(0.25);
    expect(named / N).toBeLessThan(0.35);
    expect(own / named).toBeGreaterThan(0.35);
    expect(own).toBeLessThan(named);
  });

  it('Aufgaben-Belohnungen sind drei verschiedene feste Stücke', () => {
    for (const q of QUESTS.filter((x) => x.reward === 'rare').slice(0, 10)) {
      const c = questRewardChoices(q);
      expect(c.length).toBe(3);
      expect(new Set(c.map((i) => i.name)).size).toBe(3);
      for (const it of c) expect(fixedLoot(it), `${q.id}: ${it.name}`).toBe(true);
    }
  });

  it('Champions lassen sicher einen benannten Fund fallen', () => {
    const w = createWorld(5, big());
    const p = spawnPlayer(w, 10, 10);
    p.attrs.kraft = 60;
    const m = spawnMonster(w, 11, 10, 'goblin_warrior', { champ: 'swift' });
    m.hp = 1;
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    for (let t = 0; t < 400 && m.alive; t++) tick(w);
    expect(m.alive).toBe(false);
    expect(w.ground.some((g) => !!g.item.named)).toBe(true);
    for (const g of w.ground) if (g.item.slot !== 'potion' && g.item.slot !== 'gem') expect(fixedLoot(g.item) || !!g.item.unique, g.item.name).toBe(true);
  });
});
