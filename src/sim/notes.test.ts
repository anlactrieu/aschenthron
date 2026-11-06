import { describe, expect, it } from 'vitest';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from './tiled';
import { KEYWORDS } from './topics';
import { LANDMARK_TOPICS } from './topicsData';
import { applyCommand, drainEvents } from './world';
import { validateCommand } from './net';

describe('Landmarken-Notizen und Stichworte (P5/P4)', () => {
  const { world: w, playerId } = buildWorld(1, mapJson as unknown as TiledMap);
  const p = w.actors.find((a) => a.id === playerId)!;
  it('jede Zuordnung zeigt auf eine echte Landmarke und ein bekanntes Stichwort', () => {
    for (const [id, key] of Object.entries(LANDMARK_TOPICS)) {
      expect(w.landmarks.some((l) => l.id === id), id).toBe(true);
      expect(KEYWORDS.has(key), key).toBe(true);
    }
  });
  it('readNote: nur in der Nähe, lernt das Stichwort einmal', () => {
    const lm = w.landmarks.find((l) => l.id === 'lm4')!;
    p.x = lm.x + 10;
    p.y = lm.y;
    applyCommand(w, p.id, { type: 'readNote', id: 'lm4' });
    expect(p.topics ?? []).not.toContain('moor');
    p.x = lm.x + 1;
    applyCommand(w, p.id, { type: 'readNote', id: 'lm4' });
    applyCommand(w, p.id, { type: 'readNote', id: 'lm4' });
    expect(p.topics?.filter((t) => t === 'moor')).toHaveLength(1);
    expect(drainEvents(w).filter((e) => e.type === 'note')).toHaveLength(1);
  });
  it('Netzprüfung', () => {
    expect(validateCommand(w, { type: 'readNote', id: 'lm4' })).toEqual({ type: 'readNote', id: 'lm4' });
    expect(validateCommand(w, { type: 'readNote', id: '../x' })).toBeNull();
  });
});
