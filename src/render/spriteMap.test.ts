import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../sim/data';
import { TEMPLATES } from '../sim/items';
import { SKILLS } from '../sim/data';
import { ITEM_SPRITES, MONSTER_SPRITES, PLAYER_LAYERS, SKILL_SPRITES, allSpritePaths } from './spriteMap';
import { preloadSprites, sprite } from './sprites';

describe('Sprite-Zuordnung (DCSS, CC0)', () => {
  it('jede zugeordnete Datei liegt in public/assets/dcss', () => {
    const missing = allSpritePaths().filter((p) => !existsSync(resolve(__dirname, '../../public/assets/dcss', p)));
    expect(missing).toEqual([]);
  });

  it('Zuordnungen verweisen auf bekannte Monster, Vorlagen und Skills', () => {
    const mons = new Set(MONSTERS.map((m) => m.id));
    const tpls = new Set(TEMPLATES.map((t) => t.id));
    expect(Object.keys(MONSTER_SPRITES).filter((k) => !mons.has(k))).toEqual([]);
    expect(Object.keys(ITEM_SPRITES).filter((k) => !tpls.has(k))).toEqual([]);
    expect(Object.keys(PLAYER_LAYERS).filter((k) => !tpls.has(k))).toEqual([]);
    expect(Object.keys(SKILL_SPRITES).filter((k) => !SKILLS.some((s) => s.id === k))).toEqual([]);
  });

  it('alle Monsterarten haben ein Sprite', () => {
    expect(MONSTERS.filter((m) => !MONSTER_SPRITES[m.id]).map((m) => m.id)).toEqual([]);
  });

  it('Sprite-Lader ist in Node import-sicher (kein Image): Fallback, kein Absturz', async () => {
    await preloadSprites(allSpritePaths());
    expect(sprite('monster/goblin_new.png')).toBeNull();
  });
});
