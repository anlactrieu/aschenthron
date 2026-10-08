import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { QUESTS } from './data';
import { applyCommand, drainEvents, maxHpOf, tick, type World } from './world';

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
});
