import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { QUESTS } from './data';
import { applyCommand, drainEvents, maxHpOf, questRewardChoices, tick, type World } from './world';

const map = mapJson as unknown as TiledMap;

/** Spielt das Säubern eines Lagers durch: Spieler teleportiert zu jedem Besatzer und schlägt ihn nieder. */
function clearCamp(w: World, pid: number, id: string): void {
  const p = w.actors.find((a) => a.id === pid)!;
  p.damage = [9999, 9999];
  for (const m of w.actors.filter((a) => a.campId === id)) {
    p.x = m.x + 1;
    p.y = m.y;
    p.hp = maxHpOf(p);
    applyCommand(w, p.id, { type: 'attack', targetId: m.id });
    for (let i = 0; i < 120 && m.alive; i++) tick(w);
  }
}

describe('Lager erobern', () => {
  it('Karte hat 7 Lager mit Besatzung und verschlossener Truhe, und jede Lageraufgabe zeigt auf ein Lager', () => {
    const { world: w } = buildWorld(1, map, { player: false });
    expect(w.camps).toHaveLength(7);
    for (const c of w.camps) {
      expect(w.actors.filter((a) => a.campId === c.id).length).toBeGreaterThanOrEqual(4);
      expect(w.chests.filter((x) => x.camp === c.id)).toHaveLength(1);
    }
    for (const q of QUESTS.filter((x) => x.kind === 'camp')) expect(w.camps.some((c) => c.id === q.target)).toBe(true);
  });

  it('Lagertruhe bleibt zu, bis das Lager gesäubert ist; Aufgabe wird erfüllt; Besatzung bleibt lange fort', () => {
    const { world: w, playerId } = buildWorld(1, map);
    const p = w.actors.find((a) => a.id === playerId)!;
    p.level = 30;
    const camp = w.camps[0]!;
    const q = QUESTS.find((x) => x.kind === 'camp' && x.target === camp.id)!;
    p.quests[q.id] = { state: 'active', progress: 0 };
    const chest = w.chests.find((c) => c.camp === camp.id)!;
    p.x = chest.x;
    p.y = chest.y + 1;
    applyCommand(w, p.id, { type: 'openChest', chestId: chest.id });
    expect(drainEvents(w).some((e) => e.type === 'fail')).toBe(true);
    expect(chest.opened).toBe(false);
    clearCamp(w, p.id, camp.id);
    expect(camp.cleared).toBe(true);
    expect(p.quests[q.id]!.state).toBe('done');
    const crew = w.actors.filter((a) => a.campId === camp.id);
    expect(crew.every((a) => !a.alive && a.respawnTicks > 20 * 60 * 10)).toBe(true);
    p.x = chest.x;
    p.y = chest.y + 1;
    applyCommand(w, p.id, { type: 'openChest', chestId: chest.id });
    expect(chest.opened).toBe(true);
  });

  it('Aufgabe annehmen, wenn das Lager schon gesäubert ist, ist sofort erfüllt', () => {
    const { world: w, playerId } = buildWorld(1, map);
    const p = w.actors.find((a) => a.id === playerId)!;
    const camp = w.camps[0]!;
    camp.cleared = true;
    const q = QUESTS.find((x) => x.kind === 'camp' && x.target === camp.id)!;
    p.level = 30;
    const giver = w.npcs.find((n) => n.quests?.includes(q.id))!;
    p.x = giver.x + 1;
    p.y = giver.y;
    applyCommand(w, p.id, { type: 'acceptQuest', questId: q.id });
    expect(p.quests[q.id]!.state).toBe('done');
  });

  it('Belohnung zur Wahl: drei feste Stücke, die gewählte landet im Rucksack', () => {
    const { world: w, playerId } = buildWorld(1, map);
    const p = w.actors.find((a) => a.id === playerId)!;
    const q = QUESTS.find((x) => x.kind === 'camp')!;
    const a = questRewardChoices(q);
    expect(a).toHaveLength(3);
    expect(questRewardChoices(q).map((i) => i.name)).toEqual(a.map((i) => i.name));
    const giver = w.npcs.find((n) => n.quests?.includes(q.id))!;
    p.x = giver.x + 1;
    p.y = giver.y;
    p.level = 30;
    p.quests[q.id] = { state: 'done', progress: 1 };
    const before = p.inventory.length;
    applyCommand(w, p.id, { type: 'turnInQuest', questId: q.id, pick: 2 });
    expect(p.quests[q.id]!.state).toBe('turned');
    expect(p.inventory).toHaveLength(before + 1);
    expect(p.inventory.at(-1)!.name).toBe(a[2]!.name);
  });

  it('Zufallsereignis: nach etwa 90 Feldern Weg draußen passiert etwas, danach Ruhe (Abklingzeit)', () => {
    const { world: w, playerId } = buildWorld(1, map);
    w.npcWander = true;
    const p = w.actors.find((a) => a.id === playerId)!;
    const m = w.actors.find((a) => a.kind === 'monster' && !a.boss && !a.unique && !a.campId && a.kindId === 'goblin')!;
    p.x = m.x + 3;
    p.y = m.y;
    p.hp = p.maxHp = 99999;
    let events = 0;
    for (let sec = 0; sec < 120; sec++) {
      p.x += sec % 2 ? 2 : -2; // pendeln: zählt als Weg
      for (let i = 0; i < 20; i++) tick(w);
      events += drainEvents(w).filter((e) => e.type === 'wildEvent').length;
    }
    expect(events).toBeGreaterThanOrEqual(1);
    expect(events).toBeLessThanOrEqual(2);
  });

  it('Suchaufgabe: Fundstücke einsammeln, je Fund einmal, und die Entscheidung bestimmt die Belohnung', () => {
    const { world: w, playerId } = buildWorld(1, map);
    const p = w.actors.find((a) => a.id === playerId)!;
    const q = QUESTS.find((x) => x.id === 'q_find_cargo')!;
    const finds = w.finds.filter((f) => f.quest === q.id);
    expect(finds).toHaveLength(q.count);
    p.level = 30;
    p.hp = p.maxHp = 99999;
    p.quests[q.id] = { state: 'active', progress: 0 };
    for (const f of finds) {
      p.x = f.x;
      p.y = f.y;
      for (let i = 0; i < 10; i++) tick(w);
    }
    expect(p.quests[q.id]!.state).toBe('done');
    expect(p.quests[q.id]!.progress).toBe(q.count);
    const giver = w.npcs.find((n) => n.quests?.includes(q.id))!;
    p.x = giver.x + 1;
    p.y = giver.y;
    const gold0 = p.gold;
    const inv0 = p.inventory.length;
    applyCommand(w, p.id, { type: 'turnInQuest', questId: q.id, pick: 0 });
    expect(p.gold - gold0).toBe(q.choices![0]!.gold);
    expect(p.inventory).toHaveLength(inv0);
  });

  it('Zufallsereignis-Gegner verschwinden wieder: über 40 Minuten Pendeln bleibt die Monsterzahl beschränkt', () => {
    const { world: w, playerId } = buildWorld(1, map);
    w.npcWander = true;
    const p = w.actors.find((a) => a.id === playerId)!;
    const m = w.actors.find((a) => a.kind === 'monster' && !a.boss && !a.unique && !a.campId && a.kindId === 'goblin')!;
    p.x = m.x + 3;
    p.y = m.y;
    p.hp = p.maxHp = 99999;
    const n0 = w.actors.length;
    let max = 0;
    for (let sec = 0; sec < 2400; sec++) {
      p.x += sec % 2 ? 2 : -2;
      p.targetId = null;
      for (let i = 0; i < 20; i++) tick(w);
      drainEvents(w);
      max = Math.max(max, w.actors.length);
    }
    expect(max - n0).toBeLessThan(20); // ohne Lebensdauer wüchse es auf über 60
  }, 60000);

  it('jede Aufgabe mit Belohnung bietet drei Stücke zur Wahl', () => {
    for (const q of QUESTS.filter((x) => x.reward)) expect(questRewardChoices(q), q.id).toHaveLength(3);
  });

  it('Lager lässt sich auch langsam säubern: früh erschlagene Besatzer stehen nicht nach 2 Minuten wieder auf', () => {
    const { world: w, playerId } = buildWorld(1, map);
    const p = w.actors.find((a) => a.id === playerId)!;
    const camp = w.camps[0]!;
    const crew = w.actors.filter((a) => a.campId === camp.id);
    p.damage = [9999, 9999];
    p.hp = p.maxHp = 99999;
    const first = crew[0]!;
    p.x = first.x + 1;
    p.y = first.y;
    applyCommand(w, p.id, { type: 'attack', targetId: first.id });
    for (let i = 0; i < 120 && first.alive; i++) tick(w);
    expect(first.alive).toBe(false);
    p.x = w.start.x;
    p.y = w.start.y;
    for (let i = 0; i < 20 * 150; i++) tick(w);
    expect(first.alive).toBe(false);
  });
});
