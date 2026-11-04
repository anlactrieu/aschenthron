/**
 * Skelett-Figuren im Browser (Monster, NPCs, Held): Sheets werden in Web Workern gebacken (`figureWorker.ts`, bis zu drei parallel)
 * oder, falls es keine gibt, im Spielthread Bild für Bild mit Zeitbudget je Frame (`pumpFigures`). Eine Warteschlange mit
 * Vorrang: was gerade zu sehen ist, kommt vor dem Vorausbacken (`prefetchFigure`: Arten im Umkreis, NPCs beim Laden); jeder
 * Worker hat nur einen Auftrag zugleich, damit nichts Sichtbares hinter einem Stapel Vorausbacken wartet. Bis eine Figur fertig
 * ist, zeigt das Spiel nur ihren Schatten. Neue GPU-Texturen höchstens eine je Frame (`uploadSheet`), aus den rohen Pixeln
 * (halb so teuer wie ein Canvas). Fertige Sheets liegen im Cache (älteste ungenutzte fliegen raus).
 */
import type Phaser from 'phaser';
import { FigureBaker, type FigView, type FigureSheet, type FigureSpec } from './figure';
import { addSheetTexture, FIG_SCALE, pixelSource, type FigSource } from './heroSheet';
import { SHADE } from './heroRig.js';
import { heroSpec, type HeroLook } from './hero';
import { monsterSpec } from './monster';
import { cancelUpload, pendingUploads, pumpUploads, queueUpload, uploading } from './sheetUpload';
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
export function uploadSheet(scene: Phaser.Scene, key: string, src: FigSource, urgent = true): boolean {
  if (scene.textures.exists(key)) return true;
  // WebGL: scheibenweise über mehrere Frames (`pumpUploads`), die Textur ist erst danach da
  if (queueUpload(scene, key, src, urgent)) return false;
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

/** Ganz am Anfang jedes Frames (`draw`): Upload- und Riss-Budget auffrischen, bevor irgendetwas hochlädt. */
export function resetFigureBudgets(scene: Phaser.Scene): void {
  pumpUploads(scene);
  uploads = UPLOADS_PER_FRAME;
  silBudget = SIL_PER_FRAME;
}

/**
 * Am Anfang der Figurenpflege: ohne Worker aus der Warteschlange backen, bis das Zeitbudget verbraucht ist,
 * und alte Sheets aus dem Cache werfen.
 */
export function pumpFigures(scene: Phaser.Scene, inUse: () => Set<string>, budget = BUDGET_MS): void {
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
      // läuft noch der Upload, zeigt das Spiel den Schattenriss: nicht verwerfen (sonst wird die Art gleich neu gebacken)
      if (busy.has(old) || uploading(old)) continue;
      ready.delete(old);
      noAhead.delete(old);
      cancelUpload(scene, old);
      if (scene.textures.exists(old)) scene.textures.remove(old);
    }
  }
}

/** Am Ende jedes Frames: ist das Upload-Budget übrig, ein vorausgebackenes Sheet schon hochladen (dann kostet sein Erscheinen nichts). */
export function uploadAhead(scene: Phaser.Scene): void {
  // höchstens zwei Aufträge auf einmal, damit Sichtbares nicht hinter Vorausgeladenem wartet und nicht alles Fertige auf einmal Speicher belegt
  if (uploads <= 0 || pendingUploads() >= 2) return;
  for (const [key, src] of ready) {
    if (noAhead.has(key) || scene.textures.exists(key) || uploading(key)) continue;
    uploadSheet(scene, key, src, false);
    return;
  }
}

/** Sheet im Worker backen und an `done` geben (Held: eigener Cache); `false`, wenn es keine Worker gibt */
export function bakeInWorker(key: string, req: FigReq, done: (s: FigSource) => void): boolean {
  // schlug im Worker fehl: nicht in jedem Frame neu schicken (der Aufrufer backt dann selbst)
  if (none.has(key)) return false;
  return enqueue(key, req, true, done);
}

/* ------------------------------------------------ Platzhalter */

/**
 * Bis ein Sheet da ist, steht an seiner Stelle ein dunkler Schattenriss der Art (ihr Stehbild in der gerade gezeigten Ansicht, Seite/vorn/hinten, im Spielthread in
 * 0,1-2 ms gerechnet) in Artgröße: anklickbar, mit Namen, Balken und Trefferblitz. Alle Risse liegen in einer gemeinsamen
 * Leinwand-Textur, die beim Start einmal angelegt wird; neue GL-Texturen im Spiel stocken einzeln bis über 1 s.
 */
export const SIL_TEX = 'fig_sil';
/** Feldgröße bei 1x (größtes Bild: Aschenkönig 116x102), Felder je Zeile/Spalte */
const SIL_SLOT = 120;
const SIL_COLS = 8;
const SIL_ROWS = 12;
/** neue Risse je Frame (je ein Bild rechnen und die Leinwand neu hochladen) */
const SIL_PER_FRAME = 3;

/** Schattenriss einer Figur: Bildname in `SIL_TEX`, Ursprung, Kopfhöhe und Körperbreite wie beim fertigen Sheet (Bildschirm-Pixel) */
export type Silhouette = { frame: string; ox: number; oy: number; top: number; w: number };

const sils = new Map<string, Silhouette>();
/** Stehbild warf: kein Riss (nicht in jedem Frame neu versuchen) */
const silNone = new Set<string>();
const silSlot = new Map<string, number>();
let silBudget = SIL_PER_FRAME;

/** Gemeinsame Textur der Schattenrisse anlegen (beim Szenenstart, solange noch nichts zu sehen ist) */
export function initSilhouettes(scene: Phaser.Scene): void {
  if (!scene.textures.exists(SIL_TEX)) scene.textures.createCanvas(SIL_TEX, SIL_SLOT * SIL_COLS, SIL_SLOT * SIL_ROWS);
  sils.clear();
  silSlot.clear();
  silNone.clear();
}

/** Angaben am Bild eines Schattenrisses (für Klickfläche, Namen, Schatten) oder `undefined` */
export const silhouetteOf = (frame: string): Silhouette | undefined => sils.get(frame);

/**
 * Schattenriss der Figur `key` (rechnet ihn beim ersten Mal, höchstens `SIL_PER_FRAME` je Frame), `null` = (noch) keiner.
 * `ahead`: nur vorab für Arten in der Nähe, deren Sheet noch fehlt; lässt einen Riss des Budgets für Sichtbare übrig.
 */
export function silhouette(scene: Phaser.Scene, key: string, req: FigReq, ahead = false, view: FigView = 'side'): Silhouette | null {
  const frame = view === 'side' ? key : `${key}|${view}`;
  const got = sils.get(frame);
  if (got) return got;
  if (silBudget <= (ahead ? 1 : 0) || none.has(key) || silNone.has(frame) || (ahead && scene.textures.exists(key))) return null;
  const tex = scene.textures.exists(SIL_TEX) ? (scene.textures.get(SIL_TEX) as Phaser.Textures.CanvasTexture) : null;
  const spec = specOf(req);
  if (!tex) return null;
  if (!spec || spec.frame.w > SIL_SLOT || spec.frame.h > SIL_SLOT) {
    silNone.add(frame);
    return null;
  }
  // Feld: ein freies, sonst das älteste, dessen Sheet schon fertig ist (dessen Riss wird nicht mehr gezeigt); sonst keins
  const used = new Set(silSlot.values());
  let slot = -1;
  for (let i = 0; i < SIL_COLS * SIL_ROWS; i++) if (!used.has(i)) { slot = i; break; }
  if (slot < 0) {
    const old = [...silSlot.keys()].find((k) => scene.textures.exists(k.split('|')[0]!));
    if (!old) return null;
    slot = silSlot.get(old)!;
    silSlot.delete(old);
    sils.delete(old);
    tex.remove(old);
  }
  silBudget--;
  const { w: FW, h: FH, fx: FX, fy: FY } = spec.frame;
  let r;
  try {
    r = spec.render('idle', view, 0);
  } catch {
    silNone.add(frame);
    return null;
  }
  const px = new ImageData(FW, FH);
  let bx0 = 1e9;
  let bx1 = -1e9;
  let top = 0;
  for (let k = 0; k < r.n; k++) {
    const x = r.xs[k]! + FX;
    const y = r.ys[k]! + FY;
    if (x < 0 || y < 0 || x >= FW || y >= FH) continue;
    const part = r.part[k]!;
    // Körper dunkel mit einem Hauch der Körperfarbe, Umriss als heller Rauchsaum (sonst verschwindet er auf dunklem Boden)
    const ink = r.shade[k] === SHADE.INK;
    const c = (spec.mats[part] ?? spec.fallback)[3];
    const o = (y * FW + x) * 4;
    px.data[o] = ink ? 112 : 14 + (((c >> 16) & 255) >> 3);
    px.data[o + 1] = ink ? 104 : 12 + (((c >> 8) & 255) >> 3);
    px.data[o + 2] = ink ? 120 : 16 + ((c & 255) >> 3);
    px.data[o + 3] = 255;
    if (!spec.loose?.has(part)) {
      bx0 = Math.min(bx0, x);
      bx1 = Math.max(bx1, x);
      top = Math.max(top, FY - y);
    }
  }
  const sx = (slot % SIL_COLS) * SIL_SLOT;
  const sy = Math.floor(slot / SIL_COLS) * SIL_SLOT;
  tex.context.clearRect(sx, sy, SIL_SLOT, SIL_SLOT);
  tex.context.putImageData(px, sx, sy);
  if (tex.has(frame)) tex.remove(frame);
  tex.add(frame, 0, sx, sy, FW, FH);
  tex.refresh();
  const s: Silhouette = { frame, ox: FX / FW, oy: FY / FH, top: top * FIG_SCALE, w: Math.max(0, bx1 - bx0 + 1) * FIG_SCALE };
  sils.set(frame, s);
  silSlot.set(frame, slot);
  return s;
}
