/**
 * Skelett-Figuren im Browser (Monster, NPCs, Held): Sheets werden in Web Workern gebacken (`figureWorker.ts`, bis zu drei parallel)
 * oder, falls es keine gibt, im Spielthread Bild für Bild mit Zeitbudget je Frame (`pumpFigures`). Eine Warteschlange mit
 * Vorrang: was gerade zu sehen ist, kommt vor dem Vorausbacken (`prefetchFigure`: Arten im Umkreis, NPCs beim Laden); jeder
 * Worker hat nur einen Auftrag zugleich, damit nichts Sichtbares hinter einem Stapel Vorausbacken wartet. Bis eine Figur fertig
 * ist, zeigt das Spiel nur ihren Schatten. Neue GPU-Texturen höchstens eine je Frame (`uploadSheet`), aus den rohen Pixeln
 * (halb so teuer wie ein Canvas). Fertige Sheets liegen im Cache (älteste ungenutzte fliegen raus).
 */
import type Phaser from 'phaser';
import { FigureBaker, type FigureSheet, type FigureSpec } from './figure';
import { addSheetTexture, pixelSource, type FigSource } from './heroSheet';
import { heroSpec, type HeroLook } from './hero';
import { monsterSpec } from './monster';
import { npcSpec } from './npc';

/** Was gebacken werden soll (für den Worker: nur Daten) */
export type FigReq = { t: 'm'; id: string } | { t: 'n'; kind: string; name?: string } | { t: 'h'; look: HeroLook };
/** Antwort des Workers (Pixel als übertragener Puffer) */
export type FigReply = { key: string; sheet: FigureSheet | null };

/** So viele fertige Sheets bleiben im Cache (je ca. 0,5-2,5 MB) */
const KEEP = 40;
/** Backzeit je Spielframe in ms (nur ohne Worker) */
const BUDGET_MS = 5;
/** Worker: zwei Kerne bleiben dem Spiel und dem Browser, höchstens drei (jeder lädt die Figurenmodule) */
const WORKERS = Math.max(1, Math.min(3, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 2));
/** Neue GPU-Texturen je Frame: ein Sheet kostet 4-15 ms, mehrere im selben Frame ruckeln */
const UPLOADS_PER_FRAME = 1;

type Job = { key: string; req: FigReq; urgent: boolean; done?: (s: FigSource) => void };

const ready = new Map<string, FigSource>();
/** ohne Skelett-Figur (keine Definition oder Backen schlug fehl): das Spiel zeigt die alte Figur */
const none = new Set<string>();
/** nur vorausgebacken für später (NPCs beim Laden): nicht vorab auf die GPU */
const noAhead = new Set<string>();
/** wartet auf einen freien Worker */
const queue: Job[] = [];
/** gerade in einem Worker */
const running = new Map<string, Job>();
/** wartet im Spielthread (ohne Worker) */
const local = new Map<string, FigureBaker>();

let pool: Worker[] | null | undefined;
const idle: Worker[] = [];
let uploads = UPLOADS_PER_FRAME;

const specOf = (r: FigReq): FigureSpec | null => (r.t === 'm' ? monsterSpec(r.id) : r.t === 'h' ? heroSpec(r.look) : npcSpec(r.kind, r.name));

/** Ohne Worker: alles Offene (außer dem Helden, der backt selbst) dem Spielthread geben */
function toLocal(jobs: Iterable<Job>): void {
  for (const j of jobs) {
    if (j.done) continue;
    const s = specOf(j.req);
    if (s) local.set(j.key, new FigureBaker(s));
  }
}

function workers(): Worker[] | null {
  if (pool !== undefined) return pool;
  try {
    pool = Array.from({ length: WORKERS }, () => {
      const w = new Worker(new URL('./figureWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<FigReply>) => {
        const { key, sheet } = e.data;
        const job = running.get(key);
        running.delete(key);
        idle.push(w);
        if (sheet) {
          const src = pixelSource(sheet);
          if (job?.done) job.done(src);
          else ready.set(key, src);
        } else none.add(key);
        feed();
      };
      w.onerror = () => {
        // Worker startet nicht (Backfehler meldet er selbst als leeres Sheet): alles Offene im Spielthread backen
        for (const x of pool ?? []) x.terminate();
        pool = null;
        toLocal([...running.values(), ...queue]);
        running.clear();
        queue.length = 0;
        idle.length = 0;
      };
      return w;
    });
    idle.push(...pool);
  } catch {
    pool = null;
  }
  return pool;
}

/** Freie Worker mit dem wichtigsten Auftrag versorgen: Sichtbares zuerst, sonst in der Reihenfolge der Anfrage */
function feed(): void {
  while (idle.length && queue.length) {
    const i = queue.findIndex((j) => j.urgent);
    const job = queue.splice(Math.max(0, i), 1)[0]!;
    running.set(job.key, job);
    idle.pop()!.postMessage({ key: job.key, req: job.req });
  }
}

/** Auftrag einreihen (oder einen wartenden vorziehen); `false`, wenn es keine Worker gibt */
function enqueue(key: string, req: FigReq, urgent: boolean, done?: (s: FigSource) => void): boolean {
  if (!workers()) return false;
  if (running.has(key)) return true;
  const queued = queue.find((j) => j.key === key);
  if (queued) queued.urgent ||= urgent;
  else queue.push({ key, req, urgent, done });
  feed();
  return true;
}

/** Workers schon beim Laden starten (ihr Modul lädt, während das Spiel seine Bilder holt) */
export function startFigureWorkers(): void {
  workers();
}

/**
 * GPU-Textur eines Sheets anlegen, falls es sie noch nicht gibt; `false`, wenn in diesem Frame schon eine neue hochgeladen
 * wurde (dann im nächsten Frame wieder fragen).
 */
export function uploadSheet(scene: Phaser.Scene, key: string, src: FigSource): boolean {
  if (scene.textures.exists(key)) return true;
  if (uploads <= 0) return false;
  uploads--;
  addSheetTexture(scene, key, src);
  return true;
}

/**
 * Fertige Figur (Texturschlüssel + Sheet), `'wait'`, solange sie noch gebacken oder hochgeladen wird (stellt sie dann vorn in die
 * Warteschlange), oder `null`, wenn es keine Skelett-Figur gibt (alte Figur zeigen).
 */
export function figureTexture(scene: Phaser.Scene, key: string, req: FigReq): { key: string; sheet: FigureSheet } | 'wait' | null {
  if (none.has(key)) return null;
  const src = ready.get(key);
  if (src) {
    if (!uploadSheet(scene, key, src)) return 'wait';
    ready.delete(key);
    ready.set(key, src);
    noAhead.delete(key);
    return { key, sheet: src.figSheet! };
  }
  noAhead.delete(key);
  if (local.has(key) || enqueue(key, req, true)) return 'wait';
  const s = specOf(req);
  if (!s) {
    none.add(key);
    return null;
  }
  local.set(key, new FigureBaker(s));
  return 'wait';
}

/**
 * Figur vorausbacken (Arten im Umkreis, NPCs beim Laden), nachrangig hinter allem Sichtbaren; ohne Worker nichts. `ahead`:
 * fertig gleich auf die GPU laden (für Arten, die gleich ins Bild kommen).
 */
export function prefetchFigure(key: string, req: FigReq, ahead = true): void {
  if (ready.has(key) || local.has(key) || none.has(key)) return;
  if (!ahead && !running.has(key) && !queue.some((j) => j.key === key)) noAhead.add(key);
  if (ahead) noAhead.delete(key);
  enqueue(key, req, false);
}

/**
 * Am Anfang jedes Frames: Upload-Budget auffrischen, ohne Worker aus der Warteschlange backen, bis das Zeitbudget verbraucht ist,
 * und alte Sheets aus dem Cache werfen.
 */
export function pumpFigures(scene: Phaser.Scene, inUse: () => Set<string>, budget = BUDGET_MS): void {
  uploads = UPLOADS_PER_FRAME;
  if (local.size) {
    const t0 = performance.now();
    for (const [key, baker] of local) {
      try {
        while (performance.now() - t0 < budget && baker.step()) { /* weiter */ }
      } catch {
        // Fehler im Rig: diese Art bleibt bei der alten Figur, statt in jedem Frame erneut zu werfen
        local.delete(key);
        none.add(key);
        continue;
      }
      if (baker.done) {
        local.delete(key);
        ready.set(key, pixelSource(baker.sheet));
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
      noAhead.delete(old);
      if (scene.textures.exists(old)) scene.textures.remove(old);
    }
  }
}

/** Am Ende jedes Frames: ist das Upload-Budget übrig, ein vorausgebackenes Sheet schon hochladen (dann kostet sein Erscheinen nichts). */
export function uploadAhead(scene: Phaser.Scene): void {
  if (uploads <= 0) return;
  for (const [key, src] of ready) {
    if (noAhead.has(key) || scene.textures.exists(key)) continue;
    uploadSheet(scene, key, src);
    return;
  }
}

/** Sheet im Worker backen und an `done` geben (Held: eigener Cache); `false`, wenn es keine Worker gibt */
export function bakeInWorker(key: string, req: FigReq, done: (s: FigSource) => void): boolean {
  // schlug im Worker fehl: nicht in jedem Frame neu schicken (der Aufrufer backt dann selbst)
  if (none.has(key)) return false;
  return enqueue(key, req, true, done);
}
