/**
 * Skelett-Monster und -NPCs im Browser: Sheets werden im Hintergrund gebacken, in Web Workern (`figureWorker.ts`, zwei
 * parallel) oder, falls es keine gibt, im Spielthread Bild für Bild mit Zeitbudget je Frame (`pumpFigures`). Bis eine Art
 * fertig ist, zeigt das Spiel die alte Figur. Fertige Sheets liegen als 1x-Textur im Cache (älteste ungenutzte fliegen raus).
 */
import type Phaser from 'phaser';
import { FigureBaker, type FigureSheet, type FigureSpec } from './figure';
import { addSheetTexture, sheetCanvas, sheetPortrait, type FigCanvas } from './heroSheet';
import { monsterSpec } from './monster';
import { npcSpec } from './npc';

/** Was gebacken werden soll (für den Worker: nur Daten) */
export type FigReq = { t: 'm'; id: string } | { t: 'n'; kind: string; name?: string };

/** So viele fertige Sheets bleiben im Cache (je ca. 0,5-2,5 MB) */
const KEEP = 40;
/** Backzeit je Spielframe in ms (nur ohne Worker) */
const BUDGET_MS = 5;
const WORKERS = 2;

const ready = new Map<string, FigCanvas>();
/** wartet im Worker */
const pending = new Set<string>();
/** wartet im Spielthread */
const local = new Map<string, FigureBaker>();
const reqs = new Map<string, FigReq>();

let pool: Worker[] | null | undefined;
let next = 0;

const specOf = (r: FigReq): FigureSpec | null => (r.t === 'm' ? monsterSpec(r.id) : npcSpec(r.kind, r.name));

function workers(): Worker[] | null {
  if (pool !== undefined) return pool;
  try {
    pool = Array.from({ length: WORKERS }, () => {
      const w = new Worker(new URL('./figureWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ key: string; sheet: FigureSheet | null }>) => {
        const { key, sheet } = e.data;
        pending.delete(key);
        if (sheet) ready.set(key, sheetCanvas(sheet));
      };
      w.onerror = () => {
        // Worker kaputt: alles Offene im Spielthread backen
        pool = null;
        for (const key of pending) {
          const s = specOf(reqs.get(key)!);
          if (s) local.set(key, new FigureBaker(s));
        }
        pending.clear();
      };
      return w;
    });
  } catch {
    pool = null;
  }
  return pool;
}

/** Fertige Figur (Texturschlüssel + Sheet) oder `null`, solange sie noch gebacken wird; stellt sie dann in die Warteschlange. */
export function figureTexture(scene: Phaser.Scene, key: string, req: FigReq): { key: string; sheet: FigureSheet } | null {
  const canvas = ready.get(key);
  if (canvas) {
    ready.delete(key);
    ready.set(key, canvas);
    addSheetTexture(scene, key, canvas);
    return { key, sheet: canvas.figSheet! };
  }
  if (pending.has(key) || local.has(key)) return null;
  reqs.set(key, req);
  const w = workers();
  if (w) {
    pending.add(key);
    w[next++ % w.length]!.postMessage({ key, req });
  } else {
    const s = specOf(req);
    if (s) local.set(key, new FigureBaker(s));
  }
  return null;
}

/** Backt (ohne Worker) aus der Warteschlange, bis das Zeitbudget verbraucht ist; wirft alte Sheets aus dem Cache. */
export function pumpFigures(scene: Phaser.Scene, inUse: () => Set<string>, budget = BUDGET_MS): void {
  if (local.size) {
    const t0 = performance.now();
    for (const [key, baker] of local) {
      while (performance.now() - t0 < budget && baker.step()) { /* weiter */ }
      if (baker.done) {
        local.delete(key);
        ready.set(key, sheetCanvas(baker.sheet));
      }
      if (performance.now() - t0 >= budget) break;
    }
  }
  if (ready.size > KEEP) {
    const busy = inUse();
    for (const old of [...ready.keys()]) {
      if (ready.size <= KEEP) break;
      if (busy.has(old)) continue;
      ready.delete(old);
      if (scene.textures.exists(old)) scene.textures.remove(old);
    }
  }
}

/** Sofort backen (Porträts) */
export function figurePortrait(key: string, req: FigReq, scale: number): HTMLCanvasElement | null {
  let canvas = ready.get(key);
  if (!canvas) {
    const s = specOf(req);
    if (!s) return null;
    const b = new FigureBaker(s);
    while (b.step()) { /* weiter */ }
    canvas = sheetCanvas(b.sheet);
    ready.set(key, canvas);
  }
  return sheetPortrait(canvas, scale);
}

/** Anzahl wartender Sheets (Debug) */
export const figureQueue = (): number => pending.size + local.size;
