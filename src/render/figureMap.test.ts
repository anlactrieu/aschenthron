import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../sim/data';
import { NPC_NAME_SPRITES } from './spriteMap';
import { NINJA_MONSTERS, NINJA_NPC_NAMES, figureLists, ninjaFigurePaths, ninjaMonsterDef, ninjaNpcDef } from './figureMap';
import { ninjaFigureCanvas, ninjaHeroCanvas } from './ninjaFigures';

const ids = MONSTERS.map((m) => m.id);

describe('Figuren-Zuordnung (Ninja Adventure, CC0)', () => {
  it('jede Monsterart hat eine Ninja-Zuordnung, keine unbekannten IDs', () => {
    expect(ids.filter((id) => !NINJA_MONSTERS[id])).toEqual([]);
    expect(Object.keys(NINJA_MONSTERS).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('alle zugeordneten Bilder liegen in public/assets/ninja', () => {
    const missing = ninjaFigurePaths().filter((p) => !existsSync(resolve(__dirname, '../../public/assets/ninja', p)));
    expect(missing).toEqual([]);
  });

  it('Modi: dcss = keine Ninja-Monster, ninja = alle, mix = stabil ungefähr die Hälfte', () => {
    expect(figureLists('dcss', ids).ninja).toEqual([]);
    expect(figureLists('ninja', ids).dcss).toEqual([]);
    const mix = figureLists('mix', ids);
    expect(Math.abs(mix.ninja.length - mix.dcss.length)).toBeLessThanOrEqual(2);
    expect(figureLists('mix', ids)).toEqual(mix);
    const bosses = MONSTERS.filter((m) => m.boss).map((m) => m.id);
    const nb = bosses.filter((id) => ninjaMonsterDef(id, 'mix')).length;
    expect(nb).toBe(Math.ceil(bosses.length / 2));
  });

  it('NPCs: jeder benannte NPC hat eine Ninja-Figur, unbekannte bekommen eine per Hash, Truhen keine', () => {
    for (const name of Object.keys(NPC_NAME_SPRITES)) expect(NINJA_NPC_NAMES[name], name).toBeDefined();
    expect(ninjaNpcDef('quest', 'Unbekannter Wanderer', 'mix')?.sheet).toBeTruthy();
    expect(ninjaNpcDef('quest', 'Unbekannter Wanderer', 'mix')).toEqual(ninjaNpcDef('quest', 'Unbekannter Wanderer', 'mix'));
    expect(ninjaNpcDef('stash', undefined, 'mix')).toBeUndefined();
    expect(ninjaNpcDef('smith', 'Schmied Torgal', 'dcss')).toBeUndefined();
  });

  it('Zeichner sind in Node import-sicher (kein document): liefern null', () => {
    expect(ninjaFigureCanvas(NINJA_MONSTERS.wolf!, 0, false, false, 0.9)).toBeNull();
    expect(ninjaHeroCanvas({} as never, 0, false, false, 3, 0.9)).toBeNull();
  });
});
