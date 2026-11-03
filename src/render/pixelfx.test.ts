import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FX_NAMES, preloadPixelfx } from './pixelfx';

const dir = resolve(__dirname, '../../public/assets/fx');

describe('pixelfx-Effekte', () => {
  it('jeder Effekt hat Sheet und Metadaten, Bildgröße passt zu Rahmen und Spalten', () => {
    for (const n of FX_NAMES) {
      expect(existsSync(resolve(dir, `${n}.png`)), n).toBe(true);
      const m = JSON.parse(readFileSync(resolve(dir, `${n}.json`), 'utf8')).meta.pixelfx;
      expect(m.frames, n).toBeGreaterThan(0);
      expect(m.frameSize).toHaveLength(2);
      const w = JSON.parse(readFileSync(resolve(dir, `${n}.json`), 'utf8')).meta.size.w;
      expect(w, n).toBe(m.frameSize[0] * m.columns);
    }
  });

  it('Laden ist in Node ein No-op (kein Image)', async () => {
    await expect(preloadPixelfx()).resolves.toBeUndefined();
  });
});
