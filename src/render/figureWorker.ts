/**
 * Web Worker: backt Skelett-Figuren (Monster, NPCs) abseits des Spielthreads. Nachricht rein: { key, req }, raus: das fertige
 * Sheet (Pixel als übertragener Puffer). Gleicher Code wie im Hauptthread (`monster.ts`, `npc.ts`, `figure.ts`).
 */
import { bakeFigure } from './figure';
import { heroSpec } from './hero';
import { monsterSpec } from './monster';
import { npcSpec } from './npc';
import type { FigReq } from './monsterSheet';

self.onmessage = (e: MessageEvent<{ key: string; req: FigReq }>) => {
  const { key, req } = e.data;
  const spec = req.t === 'm' ? monsterSpec(req.id) : req.t === 'h' ? heroSpec(req.look) : npcSpec(req.kind, req.name);
  if (!spec) {
    self.postMessage({ key, sheet: null });
    return;
  }
  const sheet = bakeFigure(spec);
  self.postMessage({ key, sheet }, { transfer: [sheet.data.buffer] });
};
