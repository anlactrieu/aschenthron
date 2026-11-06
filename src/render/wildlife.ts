/**
 * Wildnis mit Leben (rein clientseitig: Sim, Spielstand, Goldtests und Mehrspieler kennen nichts davon).
 *  - Harmlose Tiere je Zone: Rehe fliehen vor dem Helden, Krähen fliegen auf, Frösche sitzen im Moor, Fledermäuse fliegen nur nachts.
 *    Sie entstehen im Ring um den Helden und verschwinden wieder; ein festes Budget (Gesamtzahl, je Art, ein Neuling je 0,4 s)
 *    hält die Kosten gleich, egal wie groß die Zone ist.
 *  - Landmarken (Ruinen, Wegschreine, Galgen, verlassene Lagerfeuer, tote Abenteurer mit Notiz): Daten stehen als Objekte vom Typ
 *    "landmark" in der Karte (scripts/gen_map.py), die Bilder in world/props.ts. Sie blockieren nichts. Der Notiztext steht im Objekt
 *    (`text`) und kommt über `noteText` heraus; `onNote` meldet jede gelesene Notiz (Anknüpfung an die Gesprächs-Stichworte).
 *  - Reisende auf der Handelsstraße (Hafen → Moorlande → Felsenwacht): ein Händlerkarren und zwei Pilger, nur tagsüber, ihre Position
 *    ist eine reine Funktion der Zeit (kein Zustand, kein Kampf).
 * Alle Bilder liegen in EINEM Atlas (`wild_life`), der beim Start einmal hochgeladen wird: neue GL-Texturen im Spiel ruckeln.
 * Figuren der Pilger sind dieselben Skelett-Figuren wie die Bewohner der Städte (`res_*`, npc.ts).
 */
import type Phaser from 'phaser';
import { isWalkable, type Grid } from '../sim/path';
import { TILE_H, TILE_W, toScreen } from './iso';
import { walkFrame } from './figure';
import { idleFrame } from './hero';
import { FIG_SCALE, originOf } from './heroSheet';
import { figureTexture, prefetchFigure } from './monsterSheet';
import { npcFigKey } from './npc';
import type { Sfx } from './audio';
import { PAL as TOWN_PAL, dayPhase, lineClear, spriteRows } from './townLife';
import { toCanvas } from './world/raster';
import { campCold, corpse, gallows, merchantCart, merchantCartV, ruin, shrine } from './world/props';
import { DEER_POSES, bat, deer, frog } from './world/critters';

/* ------------------------------------------------------------------------------------------------ Daten */

type Rng = () => number;
export type FaunaKind = 'deer' | 'crow' | 'frog' | 'bat';
/** Wie viele je Art höchstens gleichzeitig um den Helden sind */
interface Fauna { kind: FaunaKind; cap: number }

/** Fauna je Zone (Namen der Karten-Regionen); Städte und Dungeons kommen nicht vor und bleiben leer */
export const ZONE_FAUNA: Record<string, Fauna[]> = {
  Roggenfelder: [{ kind: 'deer', cap: 3 }, { kind: 'crow', cap: 3 }],
  Düsterwald: [{ kind: 'deer', cap: 3 }, { kind: 'crow', cap: 2 }, { kind: 'bat', cap: 3 }],
  Räuberlager: [{ kind: 'crow', cap: 3 }, { kind: 'bat', cap: 2 }],
  Moorlande: [{ kind: 'frog', cap: 6 }, { kind: 'crow', cap: 2 }, { kind: 'bat', cap: 3 }],
  Totenacker: [{ kind: 'crow', cap: 4 }, { kind: 'bat', cap: 3 }],
  Hochland: [{ kind: 'deer', cap: 2 }, { kind: 'crow', cap: 2 }, { kind: 'bat', cap: 2 }],
  Aschenöde: [{ kind: 'crow', cap: 2 }, { kind: 'bat', cap: 2 }],
};
/** Gesamtbudget aller Tiere gleichzeitig */
export const MAX_CRITTERS = 12;
/** Kartenkacheln (gid), auf denen eine Art stehen darf (Gras 4, Hochland 8, Asche 9, Weg 7, Sumpf 3) */
const GROUND: Record<FaunaKind, ReadonlySet<number>> = {
  deer: new Set([4, 8]), crow: new Set([3, 4, 7, 8, 9]), frog: new Set([3]), bat: new Set([3, 4, 7, 8, 9]),
};
const SPAWN_RING: readonly [number, number] = [9, 22];
const DESPAWN_DIST = 30;
const SPAWN_EVERY_MS = 400;

export type LandmarkKind = 'ruin' | 'shrine' | 'gallows' | 'camp' | 'corpse';
export interface Landmark {
  id: string;
  kind: LandmarkKind;
  name: string;
  /** Kachel (Mitte bei ganzen Zahlen) */
  x: number;
  y: number;
  /** Notiztext (leer: keine Notiz) */
  text: string;
  /** Stichwort für die Gespräche (P2), leer solange nichts verknüpft ist */
  topic: string;
  variant: number;
}

interface TiledLike {
  tilewidth?: number;
  layers: { type: string; objects?: { name: string; type: string; x: number; y: number; properties?: { name: string; value: string }[] }[] }[];
}

/** Notiztext einer Landmarke: die eine Stelle, an der P2 später Stichwort-Texte einhängt */
export function noteText(lm: Landmark): string {
  return lm.text;
}

/** Ruinenform nach Namen: Mühle (2), Turm/Warte/Wacht (1), sonst Mauer mit Bogen (0) */
const ruinVariant = (name: string): number => (name.includes('Mühle') ? 2 : /Turm|Warte|Wacht/.test(name) ? 1 : 0);

/** Landmarken aus den Kartenobjekten lesen (Typ "landmark") */
export function landmarksOf(map: TiledLike): Landmark[] {
  const ts = map.tilewidth ?? 32;
  const out: Landmark[] = [];
  for (const l of map.layers) {
    if (l.type !== 'objectgroup') continue;
    for (const o of l.objects ?? []) {
      if (o.type !== 'landmark') continue;
      const prop = (k: string): string => o.properties?.find((p) => p.name === k)?.value ?? '';
      const kind = prop('kind') as LandmarkKind;
      if (!['ruin', 'shrine', 'gallows', 'camp', 'corpse'].includes(kind)) continue;
      const id = prop('id') || `lm_${out.length}`;
      const n = Number(id.replace(/\D/g, '')) || out.length;
      out.push({ id, kind, name: o.name, x: Math.round(o.x / ts), y: Math.round(o.y / ts), text: prop('text'), topic: prop('topic'), variant: kind === 'ruin' ? ruinVariant(o.name) : n % 2 });
    }
  }
  return out;
}

/** Handelsstraße: Aschenhafen (Osttor) → Moorlande-Kreuzung → Felsenwacht (Südtor); Mittellinie der dreibreiten Wege */
export const ROUTE: readonly (readonly [number, number])[] = [[48, 141], [90, 141], [90, 106], [113, 106], [113, 82]];

export function routeLength(route: typeof ROUTE = ROUTE): number {
  let len = 0;
  for (let i = 1; i < route.length; i++) len += Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]);
  return len;
}

/** Punkt und Richtung (Einheitsvektor) bei Weglänge `s` ab dem Hafen */
export function routeAt(s: number, route: typeof ROUTE = ROUTE): { x: number; y: number; dx: number; dy: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1]!;
    const [bx, by] = route[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len || i === route.length - 1) {
      const k = Math.min(1, left / len);
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: (bx - ax) / len, dy: (by - ay) / len };
    }
    left -= len;
  }
  return { x: route[0]![0], y: route[0]![1], dx: 1, dy: 0 };
}

interface TravelerDef {
  kind: 'cart' | 'pilgrim';
  /** Figur (npc.ts), beim Karren der Fuhrmann */
  look: string;
  /** Kacheln pro Sekunde */
  speed: number;
  /** Versatz auf der Strecke in Kacheln (verteilt die Reisenden) */
  offset: number;
  /** Anfangsrichtung: +1 Hafen → Felsenwacht, -1 zurück */
  start: 1 | -1;
}
export const TRAVELERS: TravelerDef[] = [
  { kind: 'cart', look: 'res_farmer', speed: 0.95, offset: 20, start: 1 },
  { kind: 'pilgrim', look: 'res_elder', speed: 0.7, offset: 60, start: -1 },
  { kind: 'pilgrim', look: 'res_fisher', speed: 0.78, offset: 105, start: 1 },
];

/** Ort eines Reisenden zur Zeit `t` (ms): hin und zurück, ohne Zustand. `fade` (0..1) blendet an den Toren ein und aus */
export function travelerAt(def: TravelerDef, t: number, route: typeof ROUTE = ROUTE): { x: number; y: number; dx: number; dy: number; fade: number } {
  const L = routeLength(route);
  const m = (((def.offset + (t / 1000) * def.speed) % (2 * L)) + 2 * L) % (2 * L);
  const fwd = m < L === (def.start === 1);
  const s = m < L ? m : 2 * L - m;
  const p = routeAt(s, route);
  const sgn = fwd ? 1 : -1;
  return { x: p.x, y: p.y, dx: p.dx * sgn, dy: p.dy * sgn, fade: Math.max(0, Math.min(1, s / 2.5, (L - s) / 2.5)) };
}

/** Ob (x,y) mehr als `d` Kacheln von der Strecke entfernt ist (grob über die Strecken-Rechtecke) */
export function farFromRoute(x: number, y: number, d: number, route: typeof ROUTE = ROUTE): boolean {
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1]!;
    const [bx, by] = route[i]!;
    if (x >= Math.min(ax, bx) - d && x <= Math.max(ax, bx) + d && y >= Math.min(ay, by) - d && y <= Math.max(ay, by) + d) return false;
  }
  return true;
}

/** Fluchtrichtung weg vom Helden mit etwas Streuung, ausweichend um Hindernisse (null: eingekeilt) */
export function fleeAngle(from: { x: number; y: number }, to: { x: number; y: number }, rng: Rng, free: (x: number, y: number) => boolean): number | null {
  const base = Math.atan2(to.y - from.y, to.x - from.x) + (rng() - 0.5) * 0.9;
  for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1]) {
    const a = base + off;
    if (free(to.x + Math.cos(a) * 1.2, to.y + Math.sin(a) * 1.2)) return a;
  }
  return null;
}

/** Zeilenweises Packen von Bildern in einen Atlas der Breite `width` (2 px Abstand) */
export function packFrames(sizes: { name: string; w: number; h: number }[], width: number): { pos: Map<string, { x: number; y: number }>; height: number } {
  const pos = new Map<string, { x: number; y: number }>();
  let x = 0;
  let y = 0;
  let row = 0;
  for (const s of [...sizes].sort((a, b) => b.h - a.h)) {
    if (x + s.w > width) {
      x = 0;
      y += row + 2;
      row = 0;
    }
    pos.set(s.name, { x, y });
    x += s.w + 2;
    row = Math.max(row, s.h);
  }
  return { pos, height: y + row };
}

/* ------------------------------------------------------------------------------------------------ Atlas */

const ATLAS = 'wild_life';
const ATLAS_W = 1024;
const CROW_FRAMES = ['crow_0', 'crow_fly0', 'crow_fly1'] as const;

/** Kunstraster-Bild je Name (Maßstab 2, wie die Welt-Props) */
function artFrames(): Map<string, HTMLCanvasElement> {
  const m = new Map<string, HTMLCanvasElement>();
  DEER_POSES.forEach((p) => m.set(`deer_${p}`, toCanvas(deer(p))));
  m.set('frog_0', toCanvas(frog(false)));
  m.set('frog_1', toCanvas(frog(true)));
  m.set('bat_0', toCanvas(bat(0)));
  m.set('bat_1', toCanvas(bat(1)));
  for (let v = 0; v < 3; v++) m.set(`ruin_${v}`, toCanvas(ruin(v)));
  m.set('shrine_0', toCanvas(shrine()));
  m.set('gallows_0', toCanvas(gallows()));
  m.set('camp_0', toCanvas(campCold()));
  for (let v = 0; v < 2; v++) m.set(`corpse_${v}`, toCanvas(corpse(v)));
  m.set('cart_h0', toCanvas(merchantCart(0)));
  m.set('cart_h1', toCanvas(merchantCart(1)));
  m.set('cart_dn', toCanvas(merchantCartV(true)));
  m.set('cart_up', toCanvas(merchantCartV(false)));
  return m;
}

/** Krähen aus dem Stadtleben, auf Maßstab 2 gebracht (dieselben Zeilen und Farben) */
function crowFrames(): Map<string, HTMLCanvasElement> {
  const m = new Map<string, HTMLCanvasElement>();
  const rows = spriteRows();
  for (const name of CROW_FRAMES) {
    const r = rows[name]!;
    const c = document.createElement('canvas');
    c.width = r[0]!.length * 2;
    c.height = r.length * 2;
    const ctx = c.getContext('2d')!;
    r.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = TOWN_PAL[row[x]!];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    });
    m.set(name, c);
  }
  return m;
}

function initAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return;
  const frames = new Map([...artFrames(), ...crowFrames()]);
  const { pos, height } = packFrames([...frames].map(([name, c]) => ({ name, w: c.width, h: c.height })), ATLAS_W);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  for (const [name, c] of frames) ctx.drawImage(c, pos.get(name)!.x, pos.get(name)!.y);
  const tex = scene.textures.addCanvas(ATLAS, canvas);
  if (!tex) return;
  for (const [name, c] of frames) tex.add(name, 0, pos.get(name)!.x, pos.get(name)!.y, c.width, c.height);
}

/* ------------------------------------------------------------------------------------------------ Szene */

const OVERLAY = 1e7;
const FONT = "NinjaUi, 'Courier New', monospace";
/** Notiz erscheint, wenn der Held so nah steht (Kacheln), und verschwindet wieder ab NOTE_LEAVE */
const NOTE_NEAR = 2.2;
const NOTE_LEAVE = 5;
const NOTE_COOLDOWN_MS = 45000;

export interface WildCtx {
  time: number;
  dtMs: number;
  hour: number;
  night: number;
  zoom: number;
  region: string;
  grid: Grid;
  /** Kartenkachel (gid) an einer Stelle */
  gid: (x: number, y: number) => number;
  /** Name der Zone an einer Stelle ('' = keine) */
  zoneAt: (x: number, y: number) => string;
  player: { x: number; y: number };
  /** Sichtbarer Weltausschnitt in Bildschirmpixeln (Kamera) */
  view: { x: number; y: number; width: number; height: number };
}

interface Critter {
  kind: FaunaKind;
  img: Phaser.GameObjects.Image;
  zone: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  alt: number;
  ang: number;
  cx: number;
  cy: number;
  state: 'idle' | 'graze' | 'walk' | 'flee' | 'fly' | 'hop' | 'free';
  until: number;
  since: number;
  flip: boolean;
  /** Einblenden (+) / Ausblenden (−) in 1/ms, 0 = stabil */
  alpha: number;
  fade: number;
  phase: number;
  soundAt: number;
}

interface Traveler {
  def: TravelerDef;
  img: Phaser.GameObjects.Image;
  cart?: Phaser.GameObjects.Image;
  key: string;
  req: { t: 'n'; kind: string };
  lastX: number;
  lastY: number;
  dist: number;
  flip: boolean;
  side: boolean;
  up: boolean;
  movingUntil: number;
}

export class Wildlife {
  /** Wird mit jeder gelesenen Notiz aufgerufen (P2: Stichwort freischalten) */
  onNote: ((lm: Landmark) => void) | null = null;
  private critters: Critter[] = [];
  private lms: { lm: Landmark; img: Phaser.GameObjects.Image }[] = [];
  private travelers: Traveler[] = [];
  private shadow: Phaser.GameObjects.Graphics;
  private note: Phaser.GameObjects.Text;
  private noteFor: Landmark | null = null;
  private noteSeen = new Map<string, number>();
  private rng: Rng;
  private region = '';
  private nextSpawn = 0;
  private lastPrefetch = -1e9;

  constructor(private scene: Phaser.Scene, private sfx: Sfx, landmarks: Landmark[]) {
    let s = (Date.now() ^ 0x7f4a7c15) >>> 0;
    this.rng = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    initAtlas(scene);
    this.shadow = scene.add.graphics().setDepth(-9e5 + 2);
    this.note = scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '16px', color: '#2a1d12', backgroundColor: '#f2e6c4', align: 'left', wordWrap: { width: 260 }, lineSpacing: 1, padding: { x: 8, y: 6 },
    }).setOrigin(0.5, 1).setDepth(OVERLAY + 6).setVisible(false);
    for (const lm of landmarks) {
      const { sx, sy } = toScreen(lm.x, lm.y);
      const img = scene.add.image(sx, sy + TILE_H / 2 + 2, ATLAS, this.landmarkFrame(lm)).setOrigin(0.5, 1).setDepth(sy + TILE_H / 2).setVisible(false);
      this.lms.push({ lm, img });
    }
    for (const def of TRAVELERS) {
      const img = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
      const cart = def.kind === 'cart' ? scene.add.image(0, 0, ATLAS, 'cart_h0').setOrigin(0.5, 1).setVisible(false) : undefined;
      this.travelers.push({ def, img, cart, key: npcFigKey(def.look), req: { t: 'n', kind: def.look }, lastX: 0, lastY: 0, dist: 0, flip: false, side: true, up: false, movingUntil: 0 });
    }
    for (let i = 0; i < MAX_CRITTERS; i++) {
      this.critters.push({
        kind: 'crow', img: scene.add.image(0, 0, ATLAS, 'crow_0').setOrigin(0.5, 1).setVisible(false), zone: '', x: 0, y: 0, tx: 0, ty: 0, alt: 0, ang: 0, cx: 0, cy: 0,
        state: 'free', until: 0, since: 0, flip: false, alpha: 0, fade: 0, phase: 0, soundAt: 0,
      });
    }
  }

  private landmarkFrame(lm: Landmark): string {
    return lm.kind === 'ruin' ? `ruin_${lm.variant % 3}` : lm.kind === 'corpse' ? `corpse_${lm.variant % 2}` : `${lm.kind}_0`;
  }

  /** Figurentexturen der gerade sichtbaren Reisenden (dürfen nicht aus dem Cache fliegen) */
  keysInUse(): string[] {
    return this.travelers.filter((t) => t.img.visible).map((t) => t.img.texture.key);
  }

  /** Zahlen zum Prüfen (Browser-Konsole, Tests): lebende Tiere je Art, sichtbare Landmarken und Reisende */
  stats(): { critters: Record<string, number>; landmarks: number; travelers: number } {
    const critters: Record<string, number> = {};
    for (const c of this.critters) if (c.img.visible || c.state !== 'free') critters[c.kind] = (critters[c.kind] ?? 0) + (c.state === 'free' ? 0 : 1);
    return { critters, landmarks: this.lms.filter((l) => l.img.visible).length, travelers: this.travelers.filter((t) => t.img.visible || t.cart?.visible).length };
  }

  /* ---------------------------------------------------------------------------- Takt */

  update(c: WildCtx): void {
    this.shadow.clear();
    const live = Math.min(c.dtMs, 100);
    this.updateLandmarks(c);
    this.updateTravelers(c);
    this.updateFauna(c, live);
  }

  /* ---------------------------------------------------------------------------- Landmarken und Notizen */

  private updateLandmarks(c: WildCtx): void {
    const k = Math.max(1, 10 / (12 * c.zoom));
    let near: { lm: Landmark; d: number } | null = null;
    for (const { lm, img } of this.lms) {
      const d = Math.hypot(lm.x - c.player.x, lm.y - c.player.y);
      const { sx, sy } = toScreen(lm.x, lm.y);
      const on = d < 40 && sx > c.view.x - 160 && sx < c.view.x + c.view.width + 160 && sy > c.view.y - 120 && sy < c.view.y + c.view.height + 200;
      if (img.visible !== on) img.setVisible(on);
      if (on && (lm.kind === 'ruin' || lm.kind === 'gallows' || lm.kind === 'shrine' || lm.kind === 'camp' || lm.kind === 'corpse')) {
        // flacher Schatten unter den hohen Bildern
        this.shadow.fillStyle(0x000000, 0.14);
        this.shadow.fillEllipse(sx, sy + TILE_H / 2 + 1, lm.kind === 'ruin' ? 70 : 30, 9);
      }
      if (lm.text && d < NOTE_NEAR && (!near || d < near.d)) near = { lm, d };
    }
    // Notiz: erscheint beim Herantreten (je Stelle höchstens alle 45 s), bleibt bis der Held weggeht
    if (this.noteFor) {
      const lm = this.noteFor;
      if (Math.hypot(lm.x - c.player.x, lm.y - c.player.y) > NOTE_LEAVE) {
        this.noteFor = null;
        this.note.setVisible(false);
      } else {
        const { sx, sy } = toScreen(lm.x, lm.y);
        this.note.setScale(k).setPosition(Math.round(sx), Math.round(sy - 14 * k));
      }
    } else if (near && c.time - (this.noteSeen.get(near.lm.id) ?? -1e9) > NOTE_COOLDOWN_MS) {
      const lm = near.lm;
      this.noteSeen.set(lm.id, c.time);
      this.noteFor = lm;
      // die Pixelschrift hat sehr schmale Leerzeichen: doppelt setzen, sonst kleben die Wörter
      this.note.setText(`${lm.name}\n${noteText(lm).replace(/ /g, '  ')}`).setVisible(true);
      const { sx, sy } = toScreen(lm.x, lm.y);
      this.note.setScale(k).setPosition(Math.round(sx), Math.round(sy - 14 * k));
      this.onNote?.(lm);
    }
  }

  /* ---------------------------------------------------------------------------- Reisende */

  private updateTravelers(c: WildCtx): void {
    const day = dayPhase(c.hour) === 'day';
    // Figuren vorausbacken, solange der Held in der Nähe der Straße ist (nach Treffer in den Städten schon im Cache)
    if (day && c.time - this.lastPrefetch > 4000 && !farFromRoute(c.player.x, c.player.y, 40)) {
      this.lastPrefetch = c.time;
      for (const t of this.travelers) prefetchFigure(t.key, t.req);
    }
    for (const t of this.travelers) {
      const hide = (): void => {
        t.img.setVisible(false);
        t.cart?.setVisible(false);
      };
      if (!day) {
        hide();
        continue;
      }
      const p = travelerAt(t.def, c.time);
      const { sx, sy } = toScreen(p.x, p.y);
      const onscreen = sx > c.view.x - 160 && sx < c.view.x + c.view.width + 160 && sy > c.view.y - 140 && sy < c.view.y + c.view.height + 160;
      if (!onscreen || p.fade <= 0.02) {
        hide();
        t.lastX = p.x;
        t.lastY = p.y;
        continue;
      }
      // Laufrichtung: Bildschirmrichtung wie bei den Bewohnern
      const mdx = p.x - t.lastX;
      const mdy = p.y - t.lastY;
      if (Math.abs(mdx) + Math.abs(mdy) > 0.0005 && Math.abs(mdx) + Math.abs(mdy) < 1) {
        t.dist += Math.hypot(mdx * TILE_W, mdy * TILE_H);
        t.movingUntil = c.time + 160;
        t.side = Math.abs(p.dx) > Math.abs(p.dy) * 0.8;
        if (Math.abs(p.dx) > 0.01) t.flip = p.dx < 0;
        t.up = p.dy < 0;
      }
      t.lastX = p.x;
      t.lastY = p.y;
      // Karren (an der Strecke) und Fuhrmann (daneben, vorn)
      let fx = p.x;
      let fy = p.y;
      if (t.cart) {
        const horiz = Math.abs(p.dx) > Math.abs(p.dy);
        const frame = horiz ? `cart_h${Math.floor(c.time / 260) % 2}` : p.dy > 0 ? 'cart_dn' : 'cart_up';
        t.cart.setFrame(frame).setFlipX(horiz && p.dx < 0).setAlpha(p.fade).setVisible(true).setPosition(sx, sy + 14).setDepth(sy + 14);
        this.shadow.fillStyle(0x000000, 0.18 * p.fade);
        this.shadow.fillEllipse(sx, sy + 15, horiz ? 100 : 48, 12);
        fx = p.x + p.dx * 1.9 + (horiz ? 0 : 0.9);
        fy = p.y + p.dy * 1.9 + (horiz ? 0.55 : 0);
      }
      this.drawFigure(t, fx, fy, p.fade, c);
    }
  }

  private drawFigure(t: Traveler, x: number, y: number, alpha: number, c: WildCtx): void {
    const { sx, sy } = toScreen(x, y);
    const got = figureTexture(this.scene, t.key, t.req);
    if (!got || got === 'wait') {
      t.img.setVisible(false);
      return;
    }
    const sheet = got.sheet;
    const v3 = t.side ? 'side' : t.up ? 'back' : 'front';
    const A = sheet.anims;
    const o = originOf(sheet);
    const moving = c.time < t.movingUntil;
    t.img.setTexture(got.key, moving ? `walk_${v3}_${walkFrame(t.dist, A.walk, sheet.cyclePx)}` : `idle_${v3}_${idleFrame(c.time + t.def.look.length * 977, A.idle)}`);
    t.img.setOrigin(o.x, o.y).setScale(FIG_SCALE).setFlipX(t.side && t.flip).setAlpha(alpha).setVisible(true).setPosition(sx, sy + 8).setDepth(sy + 8);
    this.shadow.fillStyle(0x000000, 0.2 * alpha);
    this.shadow.fillEllipse(sx, sy + 9, 26, 10);
  }

  /* ---------------------------------------------------------------------------- Tiere */

  private updateFauna(c: WildCtx, dt: number): void {
    const table = ZONE_FAUNA[c.region];
    const night = c.night > 0.45;
    if (c.region !== this.region) {
      this.region = c.region;
      // Zonenwechsel: Tiere der alten Zone blenden aus (kein Aufräumen in einem Rutsch)
      for (const a of this.critters) if (a.state !== 'free' && a.zone !== c.region) a.fade = -1 / 500;
    }
    if (table && c.time >= this.nextSpawn) {
      this.nextSpawn = c.time + SPAWN_EVERY_MS;
      const live = this.critters.filter((a) => a.state !== 'free' && a.fade >= 0);
      if (live.length < MAX_CRITTERS) {
        // eine Art mit freiem Platz, bei der Auswahl reihum wechselnd (damit nicht die erste Art alles belegt)
        const start = Math.floor(this.rng() * table.length);
        for (let i = 0; i < table.length; i++) {
          const f = table[(start + i) % table.length]!;
          if (f.kind === 'bat' && !night) continue;
          if (live.filter((a) => a.kind === f.kind).length >= f.cap) continue;
          if (this.spawn(f.kind, c)) break;
        }
      }
    }
    for (const a of this.critters) {
      if (a.state === 'free') continue;
      this.step(a, c, dt, night);
      this.draw(a, c);
    }
  }

  private spawn(kind: FaunaKind, c: WildCtx): boolean {
    const slot = this.critters.find((a) => a.state === 'free');
    if (!slot) return false;
    for (let i = 0; i < 6; i++) {
      const ang = this.rng() * Math.PI * 2;
      const d = SPAWN_RING[0] + this.rng() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const x = Math.round(c.player.x + Math.cos(ang) * d);
      const y = Math.round(c.player.y + Math.sin(ang) * d);
      if (!isWalkable(c.grid, x, y) || !GROUND[kind].has(c.gid(x, y)) || c.zoneAt(x, y) !== c.region) continue;
      slot.kind = kind;
      slot.zone = c.region;
      slot.x = x;
      slot.y = y;
      slot.tx = x;
      slot.ty = y;
      slot.cx = x;
      slot.cy = y;
      slot.alt = kind === 'bat' ? 36 + this.rng() * 20 : 0;
      slot.state = kind === 'bat' ? 'fly' : kind === 'deer' && this.rng() < 0.5 ? 'graze' : 'idle';
      slot.since = c.time;
      slot.until = c.time + 1500 + this.rng() * 4000;
      slot.flip = this.rng() < 0.5;
      slot.phase = this.rng() * 6.28;
      slot.alpha = 0;
      slot.fade = 1 / 700;
      slot.soundAt = c.time + 4000 + this.rng() * 12000;
      slot.img.setVisible(false);
      return true;
    }
    return false;
  }

  private free(a: Critter, c: WildCtx): (x: number, y: number) => boolean {
    const gnd = GROUND[a.kind];
    return (x, y) => isWalkable(c.grid, Math.round(x), Math.round(y)) && (a.kind === 'crow' || gnd.has(c.gid(Math.round(x), Math.round(y))));
  }

  private release(a: Critter): void {
    a.state = 'free';
    a.img.setVisible(false);
  }

  private step(a: Critter, c: WildCtx, dt: number, night: boolean): void {
    const sec = dt / 1000;
    const dpl = Math.hypot(a.x - c.player.x, a.y - c.player.y);
    if (a.fade) {
      a.alpha = Math.max(0, Math.min(1, a.alpha + a.fade * dt));
      if (a.fade > 0 && a.alpha >= 1) a.fade = 0;
      else if (a.fade < 0 && a.alpha <= 0) {
        this.release(a);
        return;
      }
    }
    if (a.fade >= 0 && (dpl > DESPAWN_DIST || a.zone !== c.region || (a.kind === 'bat' && !night && c.night < 0.25))) a.fade = -1 / 500;
    const free = this.free(a, c);
    const move = (speed: number, ang: number): boolean => {
      const nx = a.x + Math.cos(ang) * speed * sec;
      const ny = a.y + Math.sin(ang) * speed * sec;
      if (!free(nx, ny)) return false;
      a.x = nx;
      a.y = ny;
      if (Math.abs(Math.cos(ang)) > 0.2) a.flip = Math.cos(ang) < 0;
      return true;
    };
    switch (a.kind) {
      case 'deer': {
        if (a.state !== 'flee' && dpl < 6.5) {
          a.state = 'flee';
          a.until = c.time;
          a.since = c.time;
        }
        if (a.state === 'flee') {
          if (c.time >= a.until) {
            const ang = fleeAngle(c.player, a, this.rng, free);
            if (ang === null) {
              a.state = 'idle';
              a.until = c.time + 1500;
              break;
            }
            a.ang = ang;
            a.until = c.time + 350;
          }
          if (!move(5.4, a.ang)) a.until = c.time;
          if (dpl > 15 && c.time - a.since > 1500) {
            a.state = 'idle';
            a.until = c.time + 2500 + this.rng() * 3000;
          }
        } else if (a.state === 'walk') {
          const dx = a.tx - a.x;
          const dy = a.ty - a.y;
          const d = Math.hypot(dx, dy);
          if (d < 0.1 || !move(0.9, Math.atan2(dy, dx))) {
            a.state = 'idle';
            a.until = c.time + 1500 + this.rng() * 3000;
          }
        } else if (c.time >= a.until) {
          if (this.rng() < 0.5) {
            a.state = 'graze';
            a.until = c.time + 3000 + this.rng() * 6000;
          } else {
            const ang = this.rng() * Math.PI * 2;
            const len = 1.5 + this.rng() * 2.5;
            const tx = a.x + Math.cos(ang) * len;
            const ty = a.y + Math.sin(ang) * len;
            if (free(tx, ty) && lineClear(c.grid, a.x, a.y, tx, ty)) {
              a.tx = tx;
              a.ty = ty;
              a.state = 'walk';
            } else a.until = c.time + 1500;
          }
        }
        break;
      }
      case 'crow': {
        if (a.state !== 'fly' && dpl < 4.2) {
          a.state = 'fly';
          a.ang = Math.atan2(a.y - c.player.y, a.x - c.player.x) + (this.rng() - 0.5) * 1.2;
          a.until = c.time + 3600;
          this.sfx.caw(0.7);
        }
        if (a.state === 'fly') {
          a.alt = Math.min(90, a.alt + dt * 0.12);
          a.x += Math.cos(a.ang) * 5.2 * sec;
          a.y += Math.sin(a.ang) * 5.2 * sec;
          a.flip = Math.cos(a.ang) < 0;
          if (c.time > a.until && a.fade >= 0) a.fade = -1 / 600;
        } else if (c.time > a.soundAt) {
          a.soundAt = c.time + 9000 + this.rng() * 16000;
          if (dpl < 14) this.sfx.caw(Math.max(0.15, 0.7 - dpl / 24));
        }
        break;
      }
      case 'frog': {
        const hop = (ang: number): void => {
          const len = 1.2 + this.rng() * 0.8;
          const tx = a.x + Math.cos(ang) * len;
          const ty = a.y + Math.sin(ang) * len;
          if (!free(tx, ty)) return;
          a.tx = tx;
          a.ty = ty;
          a.cx = a.x;
          a.cy = a.y;
          a.state = 'hop';
          a.since = c.time;
          a.until = c.time + 380;
          a.flip = tx < a.x;
        };
        if (a.state === 'hop') {
          const k = Math.min(1, (c.time - a.since) / 380);
          a.x = a.cx + (a.tx - a.cx) * k;
          a.y = a.cy + (a.ty - a.cy) * k;
          a.alt = Math.sin(k * Math.PI) * 12;
          if (k >= 1) {
            a.alt = 0;
            a.state = 'idle';
            a.until = c.time + 2500 + this.rng() * 7000;
          }
        } else if (dpl < 2.6 && c.time > a.until - 1500) hop(Math.atan2(a.y - c.player.y, a.x - c.player.x) + (this.rng() - 0.5) * 1.4);
        else if (c.time >= a.until) hop(this.rng() * Math.PI * 2);
        break;
      }
      case 'bat': {
        // Flatterflug: Schleife um einen Mittelpunkt, der langsam zum Helden wandert
        const t = c.time / 1000 + a.phase;
        const toX = c.player.x - a.cx;
        const toY = c.player.y - a.cy;
        const dd = Math.hypot(toX, toY);
        if (dd > 10) {
          a.cx += (toX / dd) * 1.1 * sec;
          a.cy += (toY / dd) * 1.1 * sec;
        }
        const nx = a.cx + Math.cos(t * 1.1) * 3.4 + Math.sin(t * 2.7) * 0.8;
        const ny = a.cy + Math.sin(t * 1.7) * 2.2 + Math.cos(t * 3.1) * 0.6;
        a.flip = nx < a.x;
        a.x = nx;
        a.y = ny;
        a.alt = 44 + Math.sin(t * 2.3) * 12;
        break;
      }
    }
  }

  private draw(a: Critter, c: WildCtx): void {
    const { sx, sy } = toScreen(a.x, a.y);
    const on = sx > c.view.x - 60 && sx < c.view.x + c.view.width + 60 && sy - a.alt > c.view.y - 120 && sy - a.alt < c.view.y + c.view.height + 120;
    if (!on) {
      a.img.setVisible(false);
      return;
    }
    const t = c.time;
    const airborne = a.alt > 6;
    let frame: string;
    let shw = 14;
    switch (a.kind) {
      case 'deer':
        frame = a.state === 'flee' ? `deer_run${Math.floor(t / 90) % 2}` : a.state === 'graze' ? 'deer_graze' : 'deer_stand';
        shw = 32;
        break;
      case 'frog':
        frame = a.state === 'hop' ? 'frog_1' : 'frog_0';
        shw = 12;
        break;
      case 'bat':
        frame = `bat_${Math.floor(t / 90 + a.phase * 3) % 2}`;
        break;
      default:
        frame = airborne || a.state === 'fly' ? `crow_fly${Math.floor(t / 110 + a.phase) % 2}` : 'crow_0';
    }
    const lift = a.kind === 'bat' || (a.kind === 'crow' && airborne) ? Math.sin(t / 200 + a.phase) * 2 : 0;
    a.img.setFrame(frame).setFlipX(a.flip).setAlpha(a.alpha).setVisible(true).setPosition(sx, sy + 9 - a.alt + lift).setDepth(sy + 9 + (airborne ? 400 : 0));
    this.shadow.fillStyle(0x000000, (airborne ? 0.1 : 0.2) * a.alpha);
    this.shadow.fillEllipse(sx, sy + 10, shw, 6);
  }
}
