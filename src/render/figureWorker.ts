/**
 * Web Worker: backt Skelett-Figuren (Held, Monster, NPCs) abseits des Spielthreads. Nachricht rein: { key, req }, raus: das fertige
 * Sheet (Pixel als übertragener Puffer) oder `null` (keine Figur, Backfehler). Gleicher Code wie im Hauptthread (`monster.ts`, `npc.ts`, `figure.ts`).
 */
import { bakeFigure } from './figure';
import { heroSpec } from './hero';
import { monsterSpec } from './monster';
import { npcSpec } from './npc';
import type { FigReply, FigReq } from './monsterSheet';

const reply = (msg: FigReply, transfer: Transferable[] = []): void => self.postMessage(msg, { transfer });

self.onmessage = (e: MessageEvent<{ key: string; req: FigReq }>) => {
  const { key, req } = e.data;
  try {
    const spec = req.t === 'm' ? monsterSpec(req.id) : req.t === 'h' ? heroSpec(req.look) : npcSpec(req.kind, req.name);
    const sheet = spec ? bakeFigure(spec) : null;
    reply({ key, sheet }, sheet ? [sheet.data.buffer] : []);
  } catch {
    // Fehler im Rig: leeres Sheet, das Spiel zeigt die alte Figur
    reply({ key, sheet: null });
  }
};
