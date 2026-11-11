import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../sim/data';
import { figureTexture, prefetchFigure, pumpFigures } from './monsterSheet';

/** Szene-Attrappe: jede Textur "existiert" sofort (kein GPU-Upload), entfernte Schlüssel werden gezählt */
function fakeScene() {
  const removed: string[] = [];
  const scene = { game: { renderer: {} }, textures: { exists: () => true, remove: (k: string) => removed.push(k) } };
  return { scene: scene as never, removed };
}

describe('Sheet-Cache', () => {
  it('wirft angefragte Arten nicht hinaus, auch wenn mehr im Umkreis sind als der Cache hält', () => {
    const { scene, removed } = fakeScene();
    // Katakomben: mehr Arten im Umkreis als `KEEP` (24); alle werden angefragt und gebacken, noch keine ist im Bild (inUse leer)
    const ids = MONSTERS.slice(0, 26).map((m) => m.id);
    for (const id of ids) figureTexture(scene, `m_${id}`, { t: 'm', id });
    for (let i = 0; i < 400 && !ids.every((id) => figureTexture(scene, `m_${id}`, { t: 'm', id }) !== 'wait'); i++) {
      pumpFigures(scene, () => new Set(), 50, 1000);
    }
    // jede Prüfrunde fragt alle erneut an; nach dem Pumpen darf nichts fehlen
    for (const id of ids) prefetchFigure(`m_${id}`, { t: 'm', id });
    pumpFigures(scene, () => new Set(), 50, 1100);
    expect(removed).toEqual([]);
    expect(ids.every((id) => figureTexture(scene, `m_${id}`, { t: 'm', id }) !== 'wait')).toBe(true);
    // lange nicht mehr gefragt: jetzt darf der Cache aufräumen, und meldet, was er verworfen hat
    const gone = pumpFigures(scene, () => new Set(), 50, 1e9);
    expect(gone.length).toBeGreaterThan(0);
    expect(removed).toEqual(gone);
  }, 60000);
});
