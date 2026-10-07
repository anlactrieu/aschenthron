import Phaser from 'phaser';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { DMG_COLOR, STATUS_COLOR, monsterKind, npcKeyOf, questById, QUESTS, SKILLS, STATUS_IDS } from '../sim/data';
import { giverLocation, questAvailable, questMarks, type QuestMark } from '../sim/quests';
import { exportPlayer, importPlayer } from '../sim/save';
import {
  applyCommand, drainEvents, getActor, maxHpOf, maxManaOf, regionAt, tick, TICK_RATE, type Actor, type Chest, type Command, type Npc, type World,
  activeSkills,
} from '../sim/world';
import { isWalkable } from '../sim/path';
import { toScreen, toTile } from './iso';
import { DOOR_ICONS, TOWN_GID, WATER_PROP_GIDS, registerTownArt } from './town';
import { Ui, describeItem, isUpgrade } from './ui';
import type { Item } from '../sim/items';
import type { Mood } from './music';
import { AchievementTracker, type Stats } from './achievements';
import { itemIcon, skillCursor } from './icons';
import { Sfx } from './audio';
import { Minimap } from './minimap';
import { Atmosphere, isDungeon } from './atmosphere';
import { Fx } from './fx';
import type { RemoteSession } from '../net/client';
import {
  ensureTexture, tileBase, FEET_ORIGIN_Y, FRAME_STEP_L, FRAME_STEP_R, FRAME_WIND, FRAME_STRIKE, lookKey, lookOf, npcTextureKey, monsterCanvas, playerCanvas, registerStaticArt, tileCanvas, TILE_H, TILE_VARIANTS, TILE_W, WALL_VARIANTS,
} from './art';

const SAVE_KEY = 'aschenthron.save.v1';
const VIEW = 30;
/** Kamera-Zoom: Standard etwas weiter draußen als 1, per Mausrad zwischen ZOOM_MIN und ZOOM_MAX */
const ZOOM_DEFAULT = 0.75;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.1;
const ZOOM_KEY = 'aschenthron.zoom';
const CHUNK = 16;
/** Pfeiltasten → Kachelrichtung (isometrisch: oben = −x −y, rechts = +x −y) */
const ARROW_DIRS: Record<string, [number, number]> = { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] };

/** Tippt der Spieler gerade in ein Eingabefeld (z. B. Spielstand-Code)? Dann bleiben die Pfeiltasten beim Feld. */
function typingInField(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

const PROP_GIDS = new Set([2, 10, 11, 13, 14, ...Array.from({ length: TOWN_GID.doorLast - TOWN_GID.wall + 1 }, (_, i) => TOWN_GID.wall + i)]);
const OVERLAY_DEPTH = 1e7;
/** Dauer eines Hiebs/Wurfs in ms (Ausholen 40 %, Schlag 60 %) */
const SWING_MS = 240;
const STEP_MS = 110;
const WALK_FRAMES = [FRAME_STEP_L, 0, FRAME_STEP_R, 0];

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const hash = (x: number, y: number): number => ((x * 73856093) ^ (y * 19349663)) >>> 0;

interface ActorView {
  img: Phaser.GameObjects.Image;
  lastX: number;
  lastY: number;
  movingUntil: number;
  flip: boolean;
  swingUntil?: number;
  swingStart?: number;
  /** läuft im Bild nach oben: Rückansicht */
  up?: boolean;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private tiles: number[] = [];
  private playerId = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private chunks = new Map<string, Phaser.GameObjects.Image>();
  private props = new Map<number, Phaser.GameObjects.Image>();
  private actorViews = new Map<number, ActorView>();
  private lootViews = new Map<number, Phaser.GameObjects.Image>();
  private npcViews = new Map<number, Phaser.GameObjects.Image>();
  private chestViews = new Map<number, Phaser.GameObjects.Image>();
  private flash = new Map<number, number>();
  private acc = 0;
  private lastHint = 0;
  private zoneMood: Mood = 'town';
  private achv = new AchievementTracker();
  /** Hit-Stop: so viele ms bleibt die Simulation stehen (nur Einzelspieler), gibt Treffern Wucht */
  private hitStop = 0;
  private autosave = 0;
  private frame = 0;
  private ui!: Ui;
  private sfx!: Sfx;
  private minimap!: Minimap;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private fx!: Fx;
  private atmo!: Atmosphere;
  private marks: QuestMark[] = [];
  private gfxGround!: Phaser.GameObjects.Graphics;
  private gfxShimmer!: Phaser.GameObjects.Graphics;
  private lastShimmer = -1000;
  private hover: { npc?: Npc; actor?: Actor } | null = null;
  private cursor = '';
  private kicks = new Map<number, { x: number; y: number }>();
  private lootBorn = new Map<number, { t: number; dx: number }>();
  private vignette!: HTMLDivElement;
  private ambientKind: 'embers' | 'mist' | null = null;
  private lastTime = 0;
  private now = 0;
  private prevPos = new Map<number, { x: number; y: number }>();
  private interp = new Map<number, { x: number; y: number }>();
  private arrows = new Set<string>();
  private arrowActive = false;
  private lastArrowMove = 0;
  private ts = 1;
  private timers: { at: number; fn: () => void }[] = [];
  private fireballs = new Map<number, { impacts: (() => void)[]; target: number }>();
  private regionName = '';
  private armedSkill: string | null = null;
  private armedCursor = '';
  /** Zauber, der nach dem Anlaufen gewirkt wird (Ziel war außer Reichweite). */
  private pendingCast: { skillId: string; targetId: number } | null = null;
  private pendingRepath = 0;
  private resetting = false;
  private ended = false;
  private camPos: { x: number; y: number } | null = null;
  private remote: RemoteSession | null = null;
  private disp = new Map<number, { x: number; y: number }>();

  constructor() {
    super('game');
  }

  create(data?: { session?: RemoteSession }): void {
    this.remote = data?.session ?? null;
    if (this.remote) {
      this.world = this.remote.world;
      this.tiles = this.remote.tiles;
      this.playerId = this.remote.playerId;
    } else {
      const built = buildWorld(Date.now() >>> 0, mapJson as unknown as TiledMap);
      this.world = built.world;
      this.world.npcWander = true;
      this.tiles = built.tiles;
      this.playerId = built.playerId;
    }
    registerStaticArt(this);
    registerTownArt(this);
    const store = this.remote ? null : safeStorage();
    const params = new URLSearchParams(location.search);
    if (!this.remote && params.has('neu')) {
      store?.removeItem(SAVE_KEY);
      params.delete('neu');
      const rest = params.toString();
      history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
    }
    const saved = store?.getItem(SAVE_KEY);
    const p = this.player();
    try {
      const nm = store?.getItem('aschenthron.name');
      if (nm && !this.remote) p.name = nm;
    } catch { /* ohne Speicher: Standardname */ }
    this.ui = new Ui((c) => this.send(c), (i) => this.useSkillSlot(i), (k) => this.usePotionKind(k), () => this.newGame(), this.remote ? null : { export: () => exportPlayer(this.player()), import: (json) => this.importSave(json) });
    this.ui.ach = this.achv;
    this.sfx = new Sfx();
    this.atmo = new Atmosphere(this, this.sfx);
    this.minimap = new Minimap(this.world, this.tiles);
    if (this.remote) this.ui.say(`Verbunden als ${p.name}${this.remote.pvp ? ' – PvP außerhalb der Städte aktiv, Angreifer werden zu Mördern' : ''}. Klick auf Spieler greift an.`);
    else if (saved && importPlayer(this.world, p, saved)) this.ui.say('Spielstand geladen.');
    else {
      this.showTitle(p);
      this.ui.banner('Aschental brennt. Der Thron der Asche ruft.', '#d8a24a');
      this.ui.say('Einst war Aschental ein Garten – dann verbrannte der Aschenkönig den Himmel. Du bist einer der Letzten, die noch gegen ihn ziehen. Dein Ziel: Stufe 30, der Thron der Asche.');
      this.ui.say('Willkommen im Hafen von Aschenhafen! Hafenmeister Joren (Haus mit Anker, links vom Platz) zeigt dir die Stadt: Lehrhaus (Buch), Kaufhaus (Münzen), Schmiede (Amboss), Lager (Truhe), Wache (Schild). Mit Startgold, Schwert oder Bogen geht es auf die Felder. C: Charakter (Attributpunkte verteilen!) · K: Fertigkeiten · Q/E: Tränke · R: Rasten · N: Karte · Pfeiltasten oder Klick: laufen · Klick auf Gegner: angreifen. Deine laufenden Aufgaben stehen oben rechts.');
    }
    this.gfx = this.add.graphics().setDepth(OVERLAY_DEPTH);
    this.gfxGround = this.add.graphics().setDepth(-9e5);
    this.gfxShimmer = this.add.graphics().setDepth(-9e5 + 1);
    this.ts = new URLSearchParams(location.search).has('slowfx') ? 6 : 1;
    this.fx = new Fx(this, this.ts);
    this.vignette = document.createElement('div');
    this.vignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;transition:opacity 1.2s,background 1.2s;opacity:1;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(0,0,0,.45) 100%)';
    document.body.appendChild(this.vignette);
    if (new URLSearchParams(location.search).has('fps')) {
      this.fpsText = this.add.text(0, 0, '', { fontSize: '14px', color: '#9fff9f', backgroundColor: '#000a' }).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 5);
    }
    this.cameras.main.setBackgroundColor('#0b0a0d');
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onClick(ptr));
    // Kamera-Zoom per Mausrad (weiter heraus = mehr Welt sichtbar), Wert bleibt im Browser gespeichert
    this.setZoom(Number(safeStorage()?.getItem(ZOOM_KEY)) || ZOOM_DEFAULT);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.cameras.main.zoom * (dy > 0 ? 0.92 : 1.08)));
    this.input.mouse?.disableContextMenu();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setArmed(null);
      if (ARROW_DIRS[e.key] && !typingInField(e) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.arrows.add(e.key);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (ARROW_DIRS[e.key]) this.arrows.delete(e.key);
    });
    window.addEventListener('blur', () => this.arrows.clear());
    window.addEventListener('beforeunload', () => {
      if (!this.resetting) this.save();
    });
  }

  private player(): Actor {
    return getActor(this.world, this.playerId)!;
  }

  /** Laufen mit den Pfeiltasten: Bildschirmrichtung in Kachelrichtung umgerechnet, solange gedrückt in kurzen Abständen ein Ziel in der Nähe setzen. */
  private arrowMove(time: number): void {
    if (!this.arrows.size) {
      if (this.arrowActive) {
        this.arrowActive = false;
        const p = this.player();
        this.send({ type: 'moveTo', x: Math.round(p.x), y: Math.round(p.y) });
      }
      return;
    }
    if (time - this.lastArrowMove < (this.remote ? 250 : 100)) return;
    this.lastArrowMove = time;
    const p = this.player();
    if (!p.alive) return;
    let dx = 0;
    let dy = 0;
    for (const k of this.arrows) {
      dx += ARROW_DIRS[k]![0];
      dy += ARROW_DIRS[k]![1];
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!dx && !dy) return;
    const ox = Math.round(p.x);
    const oy = Math.round(p.y);
    const w = this.world;
    // weitestes begehbares Ziel in Blickrichtung; an Wänden entlang der freien Achse gleiten
    const tries: [number, number][] = [[dx, dy], [dx, 0], [0, dy]];
    for (const [tx, ty] of tries) {
      if (!tx && !ty) continue;
      for (let k = 3; k >= 1; k--) {
        const x = ox + tx * k;
        const y = oy + ty * k;
        if (isWalkable(w.grid, x, y)) {
          this.arrowActive = true;
          this.send({ type: 'moveTo', x, y });
          return;
        }
      }
    }
  }

  private send(c: Command): void {
    if (this.remote) this.remote.send(c);
    else applyCommand(this.world, this.playerId, c);
  }

  private newGame(): void {
    this.resetting = true;
    safeStorage()?.removeItem(SAVE_KEY);
    location.reload();
  }

  /** Spielstand aus Datei/Code übernehmen: prüfen, alten Stand als Sicherung behalten, neu laden. */
  private importSave(json: string): boolean {
    try {
      const o = JSON.parse(json) as { player?: unknown };
      if (!o || typeof o !== 'object' || !o.player || typeof o.player !== 'object') return false;
    } catch {
      return false;
    }
    const store = safeStorage();
    if (!store) return false;
    try {
      const old = store.getItem(SAVE_KEY);
      if (old) store.setItem(`${SAVE_KEY}.backup`, old);
      store.setItem(SAVE_KEY, json);
    } catch {
      return false;
    }
    this.resetting = true;
    location.reload();
    return true;
  }

  private save(): void {
    if (this.resetting || this.remote) return;
    try {
      safeStorage()?.setItem(SAVE_KEY, exportPlayer(this.player()));
    } catch {
      /* Speicher voll oder gesperrt: Spiel läuft ohne Speichern weiter */
    }
  }

  /** Klassische Menüführung: Fertigkeit wählen (1–9 oder Leiste), dann Ziel anklicken. Selbstzauber wirken sofort. */
  private useSkillSlot(i: number): void {
    const p = this.player();
    const id = activeSkills(p)[i];
    if (!id) return;
    const s = SKILLS.find((x) => x.id === id)!;
    if (s.heal !== undefined || s.aoeSelf || s.target === 'self') {
      this.setArmed(null);
      this.send({ type: 'useSkill', skillId: id });
      return;
    }
    if (this.armedSkill === id) return this.setArmed(null);
    this.setArmed(id);
    this.ui.say(`${s.name} gewählt – Ziel anklicken (Rechtsklick oder Esc: abbrechen).`);
  }

  private setZoom(z: number): void {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    this.cameras.main.setZoom(zoom);
    try {
      safeStorage()?.setItem(ZOOM_KEY, String(zoom));
    } catch {
      /* ohne Speicher: Zoom gilt nur für diese Sitzung */
    }
  }

  private setArmed(id: string | null): void {
    this.armedSkill = id;
    this.pendingCast = null;
    this.ui.setArmed(id);
    const sk = id ? SKILLS.find((x) => x.id === id) : undefined;
    // Mauszeiger wird zum Zauber-Symbol (Mitte = Klickpunkt)
    this.armedCursor = sk ? `url(${skillCursor(sk)}) 16 16, crosshair` : '';
    this.cursor = '\0';
  }

  private usePotionKind(kind: 'heal' | 'mana'): void {
    const p = this.player();
    const potions = p.inventory.filter((i) => i.slot === 'potion' && i[kind] !== undefined);
    // kleinsten ausreichenden Trank zuerst: sparsam, aber nicht wirkungslos
    const need = kind === 'heal' ? maxHpOf(p) - p.hp : maxManaOf(p) - p.mana;
    const sorted = [...potions].sort((a, b) => a[kind]! - b[kind]!);
    const pick = sorted.find((i) => i[kind]! >= need) ?? sorted[sorted.length - 1];
    if (pick) this.send({ type: 'usePotion', itemId: pick.id });
    else this.ui.say(kind === 'heal' ? 'Kein Heiltrank im Rucksack.' : 'Kein Manatrank im Rucksack.');
  }

  /** Trefferprüfung im Bildraum gegen die sichtbaren Sprites (inkl. Namensschild/Aufgaben-Marker bei NPCs). */
  private pick(wx: number, wy: number): { npc?: Npc; actor?: Actor; chest?: Chest } | null {
    let best: { depth: number; npc?: Npc; actor?: Actor; chest?: Chest } | null = null;
    for (const c of this.world.chests) {
      const img = this.chestViews.get(c.id);
      if (img?.visible && !c.opened && img.getBounds().contains(wx, wy) && (!best || img.depth > best.depth)) best = { depth: img.depth, chest: c };
    }
    for (const a of this.world.actors) {
      if (a.id === this.playerId || !a.alive || (a.kind === 'player' && !this.remote)) continue;
      const v = this.actorViews.get(a.id);
      if (!v || !v.img.visible) continue;
      if (v.img.getBounds().contains(wx, wy) && (!best || v.img.depth > best.depth)) best = { depth: v.img.depth, actor: a };
    }
    // NPCs: zuerst die Figur selbst, erst danach die erweiterte Fläche (Namensschild/Marker); bei Überlappung gewinnt der nächste
    let npcBest: { score: number; npc: Npc } | null = null;
    for (const n of this.world.npcs) {
      const img = this.npcViews.get(n.id);
      if (!img) continue;
      const b = img.getBounds();
      const body = b.contains(wx, wy);
      const box = new Phaser.Geom.Rectangle(b.centerX - 55, b.top - 64, 110, b.height + 64);
      if (!body && !box.contains(wx, wy)) continue;
      const score = (body ? 0 : 1000) + Math.hypot(wx - b.centerX, wy - b.centerY);
      if (!npcBest || score < npcBest.score) npcBest = { score, npc: n };
    }
    if (npcBest) {
      const img = this.npcViews.get(npcBest.npc.id)!;
      if (!best || img.depth > best.depth || npcBest.score < 1000) best = { depth: img.depth, npc: npcBest.npc };
    }
    return best;
  }

  /** Zauber auf Ziel: in Reichweite sofort wirken, sonst hinlaufen und danach wirken (Auswahl endet nach dem Klick). */
  private castAt(skillId: string, target: Actor): void {
    // Dauerfeuer: hinlaufen, dann immer wieder wirken, bis das Ziel tot ist (oder ein neuer Klick/Mana-Mangel es beendet)
    this.pendingCast = { skillId, targetId: target.id };
    this.pendingRepath = 0;
  }

  private pendingCastStep(time: number): void {
    const pc = this.pendingCast;
    if (!pc) return;
    const p = this.player();
    const t = getActor(this.world, pc.targetId);
    const sk = SKILLS.find((x) => x.id === pc.skillId);
    if (!p?.alive || !t || !t.alive || !sk || this.arrows.size) {
      this.pendingCast = null;
      return;
    }
    if (Math.hypot(p.x - t.x, p.y - t.y) <= sk.range - 0.3) {
      if (p.path.length) this.send({ type: 'moveTo', x: Math.round(p.x), y: Math.round(p.y) });
      if ((p.skillCd[sk.id] ?? 0) > 0) return;
      if (p.mana < sk.mana) {
        this.pendingCast = null;
        this.ui.say('Nicht genug Mana.');
        return;
      }
      this.send({ type: 'useSkill', skillId: pc.skillId, targetId: t.id });
      return;
    }
    if (time - this.pendingRepath < 250) return;
    this.pendingRepath = time;
    this.send({ type: 'moveTo', x: Math.round(t.x), y: Math.round(t.y) });
  }

  private onClick(ptr: Phaser.Input.Pointer): void {
    const t = toTile(ptr.worldX, ptr.worldY);
    const w = this.world;
    const hit = this.pick(ptr.worldX, ptr.worldY);
    this.pendingCast = null;                                  // jeder neue Klick beendet das Dauerfeuer
    if (this.armedSkill) {
      if (ptr.rightButtonDown()) return this.setArmed(null);
      const id = this.armedSkill;
      this.setArmed(null);                                    // Auswahl endet mit dem nächsten Klick, egal worauf
      if (hit?.actor) return this.castAt(id, hit.actor);
    }
    if (hit?.npc) {
      this.ui.toggle(true);
      this.send({ type: 'moveTo', x: Math.round(hit.npc.x), y: Math.round(hit.npc.y + 1) });
      return;
    }
    if (hit?.chest) return this.send({ type: 'openChest', chestId: hit.chest.id });
    if (hit?.actor) return this.send({ type: 'attack', targetId: hit.actor.id });
    const loot = w.ground.find((g) => Math.hypot(g.x - t.x, g.y - t.y) < 0.8);
    if (loot) return this.send({ type: 'pickup', groundId: loot.id });
    const x = Math.floor(t.x + 0.5);
    const y = Math.floor(t.y + 0.5);
    if (isWalkable(w.grid, x, y)) this.send({ type: 'moveTo', x, y });
  }

  /** Titelbild für neue Spiele: Prämisse, Endziel und Namenswahl. */
  private showTitle(p: Actor): void {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(20,10,8,.88),rgba(0,0,0,.96));color:#e8d9b0;font-family:Georgia,serif;text-align:center';
    const inner = document.createElement('div');
    inner.style.cssText = 'max-width:520px;padding:24px';
    inner.innerHTML = `<div style="font-size:44px;letter-spacing:6px;color:#ffb14a;text-shadow:0 0 18px #b8501a">ASCHENTHRON</div>
<p style="margin:18px 0 6px;line-height:1.55">Aschental war ein Garten, bis der Aschenkönig den Himmel verbrannte. Seitdem wandern Tote durch die Moore, Goblins und Räuber plündern die Straßen, und die Hafenstadt hält sich am letzten Licht.</p>
<p style="margin:6px 0 18px;line-height:1.55;opacity:.9">Du bist eine der Letzten, die noch gegen ihn ziehen. Werde stärker, finde seltene Beute und bring den Aschenkönig auf seinem Thron zu Fall.</p>
<div style="margin-bottom:14px">Dein Name: <input id="ttl-name" maxlength="16" value="Held" style="background:#120f16;border:1px solid #6b5a48;color:#e8d9b0;padding:6px 10px;font:16px Georgia,serif;text-align:center;width:180px"></div>
<button id="ttl-go" style="background:#3a2f26;border:2px solid #d8a24a;color:#ffe8b0;padding:10px 26px;font:bold 16px Georgia,serif;cursor:pointer">Das Abenteuer beginnt</button>`;
    box.append(inner);
    document.body.append(box);
    const go = (): void => {
      const name = (box.querySelector<HTMLInputElement>('#ttl-name')!.value.trim() || 'Held').slice(0, 16);
      p.name = name;
      try { window.localStorage.setItem('aschenthron.name', name); } catch { /* egal */ }
      box.remove();
    };
    box.querySelector<HTMLButtonElement>('#ttl-go')!.onclick = go;
    box.querySelector<HTMLInputElement>('#ttl-name')!.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
    });
  }

  /** Wer keine laufende Aufgabe hat, bekommt alle 90 s einen Hinweis auf die nächste mögliche. */
  private idleHint(time: number): void {
    if (this.remote || this.frame % 60 !== 0 || time - this.lastHint < 90000) return;
    const p = this.player();
    if (Object.values(p.quests).some((q) => q.state !== 'turned')) { this.lastHint = time; return; }
    const next = QUESTS.find((q) => !p.quests[q.id] && questAvailable(p, q));
    this.lastHint = time;
    if (!next) return;
    const loc = giverLocation(this.world, next);
    this.ui.say(`Keine laufende Aufgabe. Neu: „${next.name}“${loc ? ` – ${loc.text}` : ''}.`);
  }

  /** Zähler für Erfolge (nur Einzelspieler); neue Erfolge werden eingeblendet. */
  private achBump(key: keyof Stats, by = 1): void {
    if (this.remote) return;
    for (const a of this.achv.bump(key, by)) {
      this.ui.banner(`Erfolg: ${a.name}`, '#d8c070');
      this.ui.say(`Erfolg freigeschaltet: ${a.name} – ${a.text}`);
      this.sfx.quest();
    }
  }

  update(time: number, dt: number): void {
    if (this.remote) {
      if (this.remote.closed && !this.ended) {
        this.ended = true;
        this.ui.say('Verbindung zum Server verloren. Seite neu laden.');
      }
    } else {
      if (this.hitStop > 0) this.hitStop -= dt;
      else this.acc += Math.min(dt, 250);
      const step = 1000 / TICK_RATE;
      while (this.acc >= step) {
        this.acc -= step;
        this.snapshotPrev();
        tick(this.world);
      }
    }
    this.now = time;
    this.idleHint(time);
    this.arrowMove(time);
    this.pendingCastStep(time);
    this.handleEvents();
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= time);
      this.timers = this.timers.filter((t) => t.at > time);
      for (const t of due) t.fn();
    }
    this.autosave += dt;
    if (this.autosave > 5000) {
      this.autosave = 0;
      this.save();
    }
    const p = this.player();
    if (!p) return;
    const tgt = p.targetId !== null ? getActor(this.world, p.targetId) : undefined;
    this.ui.update(this.world, p, tgt);
    this.frame++;
    this.draw(time, p);
    if (this.fpsText && this.frame % 20 === 0) this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} FPS · Chunks ${this.chunks.size} · Props ${this.props.size}`);
  }

  /* ------------------------------------------------------------ Ereignisse */

  /** Bildschirmposition der Körpermitte eines Akteurs (für Effekte) */
  private bodyPos(a: Actor | undefined): { x: number; y: number } | null {
    if (!a) return null;
    const pos = this.dispPos(a);
    const { sx, sy } = toScreen(pos.x, pos.y);
    return { x: sx, y: sy - (a.boss ? 34 : 18) };
  }

  /** Verzögert eine Darstellung (Ausholen vor dem Treffer). */
  private later(ms: number, fn: () => void): void {
    if (ms <= 0) fn();
    else this.timers.push({ at: this.now + ms, fn });
  }

  private kick(id: number, dx: number, dy: number): void {
    this.kicks.set(id, { x: dx, y: dy });
  }

  private skillFx(e: { attackerId: number; targetId: number; skill: string }, fxSeen: Set<string>): void {
    const at = getActor(this.world, e.attackerId);
    const tg = getActor(this.world, e.targetId);
    const from = this.bodyPos(at);
    const to = this.bodyPos(tg);
    if (!from || !to) return;
    const tag = `${e.attackerId}:${e.skill}`;
    switch (e.skill) {
      case 'lightning': this.fx.bolt(to.x, to.y + 10, 0x9fc0ff); this.cameras.main.shake(120, 0.004); break;
      case 'whirlwind':
        if (!fxSeen.has(tag)) {
          fxSeen.add(tag);
          this.fx.ring(from.x, from.y + 18, 150, 0xe8e8f0, 320);
          this.fx.slash(from.x, from.y, 0xdadae8, 0);
          this.fx.slash(from.x, from.y, 0xdadae8, Math.PI);
        }
        break;
      case 'frost_nova':
        if (!fxSeen.has(tag)) {
          fxSeen.add(tag);
          this.fx.ring(from.x, from.y + 18, 210, 0x7fd0ff, 460);
          this.fx.burst(from.x, from.y, 0xaee4ff, 520);
        }
        break;
      case 'power_strike': this.fx.slash(to.x, to.y, 0xffe0a0, 0.3); break;
      case 'skull_split': this.fx.slash(to.x, to.y, 0xff9a60, 0.3); this.fx.ring(to.x, to.y + 14, 60, 0xff9a60, 300); this.cameras.main.shake(130, 0.006); break;
      default: break;
    }
  }

  private handleEvents(): void {
    const say = (m: string) => this.ui.say(m);
    const w = this.world;
    const fxSeen = new Set<string>();
    for (const e of this.remote ? this.remote.drainEvents() : drainEvents(w)) {
      switch (e.type) {
        case 'hit': {
          const sk = e.skill ? SKILLS.find((s) => s.id === e.skill) : undefined;
          const at = getActor(w, e.attackerId);
          const tg = getActor(w, e.targetId);
          const fromPlayer = e.attackerId === this.playerId;
          const toPlayer = e.targetId === this.playerId;
          const arrowSkill = !!e.skill && ['quick_shot', 'multishot', 'poison_shot'].includes(e.skill);
          const boltSkill = !!e.skill && ['ember_bolt', 'fireball'].includes(e.skill);
          const projectile = arrowSkill || boltSkill;
          // Wirkung am Ziel: Zahl, Blitz, Rückstoß, Ton – bei Geschossen erst beim Einschlag
          const impact = () => {
            this.flash.set(e.targetId, this.now + 120 * this.ts);
            const pos = this.bodyPos(tg);
            if (pos) {
              const poison = e.skill === 'dot' && !e.crit;
              const txt = e.amount === 0 ? 'immun' : e.crit ? `${e.amount}!` : String(e.amount);
              const dcol = e.dt ? DMG_COLOR[e.dt] : undefined;
              if (toPlayer) this.fx.floatText(pos.x, pos.y - 30, txt, dcol ?? '#ff6a5a', 18);
              else if (fromPlayer) this.fx.floatText(pos.x, pos.y - 26, txt, e.crit ? '#ffe45a' : poison ? '#8fe070' : dcol ?? '#ffffff', e.crit ? 22 : 15);
              else this.fx.floatText(pos.x, pos.y - 26, txt, dcol ?? '#cfcfcf', 12);
              this.fx.burst(pos.x, pos.y, toPlayer ? 0xff5a4a : e.crit ? 0xffe45a : 0xffffff, 260);
            }
            if (at && tg && at.id !== tg.id) {
              const a = this.dispPos(at);
              const t = this.dispPos(tg);
              const sxv = (t.x - a.x - (t.y - a.y)) * 32;
              const syv = (t.x - a.x + (t.y - a.y)) * 16;
              const len = Math.hypot(sxv, syv) || 1;
              this.kick(tg.id, (sxv / len) * 5, (syv / len) * 5);
            }
            if (fromPlayer && !this.remote && (e.crit || tg?.boss)) this.hitStop = Math.max(this.hitStop, e.crit ? 55 : 30);
            if (e.crit || (tg?.boss && fromPlayer)) this.cameras.main.shake(70, e.crit ? 0.004 : 0.0025);
            if (toPlayer) this.cameras.main.shake(60, 0.002);
            if (fromPlayer) {
              if (sk) this.sfx.cast(sk.area);
              else if (e.crit) this.sfx.crit();
              else this.sfx.hit();
            } else if (toPlayer) this.sfx.hurt();
          };
          // Der Angreifer holt sichtbar aus (Ausholen → Schlag/Wurf), erst dann trifft es; Gift/Brand/Bodenschlag nicht
          let delay = 0;
          const ambient = e.skill === 'dot' || e.skill === 'burn' || e.skill === 'slam';
          if (at && tg && at.id !== tg.id && !ambient) {
            const a = this.dispPos(at);
            const t = this.dispPos(tg);
            const sxv = (t.x - a.x - (t.y - a.y)) * 32;
            const syv = (t.x - a.x + (t.y - a.y)) * 16;
            const len = Math.hypot(sxv, syv) || 1;
            const v = this.actorViews.get(at.id);
            if (v) {
              v.swingStart = this.now;
              v.swingUntil = this.now + SWING_MS * this.ts;
              v.flip = sxv < 0;
              v.up = syv < 0;
            }
            delay = SWING_MS * 0.4 * this.ts;
            this.later(delay, () => this.kick(at.id, (sxv / len) * (projectile ? -1 : 10), (syv / len) * (projectile ? -0.5 : 10)));
          }
          const from = this.bodyPos(at);
          if (ambient) {
            impact();
          } else if (!e.skill) {
            this.later(delay, () => {
              const to = this.bodyPos(tg);
              const f = this.bodyPos(at);
              if (to && f && at) this.fx.swing(to.x, to.y, at.kind === 'player' ? 0xf0f0ff : 0xffb0a0, Math.atan2(f.y - to.y, f.x - to.x));
              impact();
            });
          } else if (projectile && from) {
            if (e.skill === 'fireball') {
              // ein Feuerball pro Zauber: alle Treffer des Flächenschadens warten auf den Einschlag
              let b = this.fireballs.get(e.attackerId);
              if (!b) {
                b = { impacts: [], target: at?.targetId ?? e.targetId };
                this.fireballs.set(e.attackerId, b);
                const batch = b;
                this.later(delay, () => {
                  this.fireballs.delete(e.attackerId);
                  const primary = this.bodyPos(getActor(w, batch.target)) ?? this.bodyPos(tg);
                  const f2 = this.bodyPos(at);
                  if (!primary || !f2) return batch.impacts.forEach((fn) => fn());
                  this.fx.projectile(f2.x, f2.y, primary.x, primary.y, 0xff5a1a, 240, () => {
                    this.fx.ring(primary.x, primary.y + 14, 130, 0xff6a2a, 420);
                    this.fx.burst(primary.x, primary.y, 0xffa040, 520);
                    this.cameras.main.shake(110, 0.004);
                    batch.impacts.forEach((fn) => fn());
                  });
                });
              }
              b.impacts.push(impact);
            } else {
              this.later(delay, () => {
                const f = this.bodyPos(at);
                const to = this.bodyPos(tg);
                if (!f || !to) return impact();
                const col = e.skill === 'ember_bolt' && e.dt === 'frost' ? 0x8fd0ff : e.skill === 'ember_bolt' && e.dt === 'poison' ? 0x7fe060 : { quick_shot: 0xe8d8a0, multishot: 0xe8d8a0, poison_shot: 0x7fe060, ember_bolt: 0xff8a2a }[e.skill as 'quick_shot'];
                if (arrowSkill) {
                  // Pfeil startet am vorgestreckten Bogen, nicht in der Körpermitte
                  const dl = Math.hypot(to.x - f.x, to.y - f.y) || 1;
                  const k0 = Math.min(16, dl * 0.4) / dl;
                  this.fx.arrow(f.x + (to.x - f.x) * k0, f.y + (to.y - f.y) * k0, to.x, to.y, col, 170, impact);
                }
                else this.fx.projectile(f.x, f.y, to.x, to.y, col, 200, impact);
              });
            }
          } else {
            this.later(delay, () => {
              impact();
              if (e.skill) this.skillFx({ attackerId: e.attackerId, targetId: e.targetId, skill: e.skill }, fxSeen);
            });
          }
          break;
        }
        case 'telegraph': {
          const { sx, sy } = toScreen(e.x, e.y);
          this.fx.zone(sx, sy + 8, e.r, 0xff3a2a, e.ms);
          this.sfx.warn();
          break;
        }
        case 'summon': {
          const boss = getActor(w, e.id);
          const pos = this.bodyPos(boss);
          if (pos) {
            this.fx.ring(pos.x, pos.y + 20, 160, 0xb060ff, 600);
            this.fx.burst(pos.x, pos.y, 0xb060ff, 700);
          }
          if (boss?.boss) {
            this.cameras.main.shake(180, 0.004);
            say(`${boss.name} ruft Verstärkung!`);
            this.sfx.boss();
          }
          break;
        }
        case 'mheal': {
          const pos = this.bodyPos(getActor(w, e.targetId));
          if (pos) {
            this.fx.floatText(pos.x, pos.y - 26, `+${e.amount}`, '#7fe070', 13);
            this.fx.ring(pos.x, pos.y + 14, 70, 0x7fe070, 400);
          }
          break;
        }
        case 'charge': {
          const boss = getActor(w, e.id);
          const pos = this.bodyPos(boss);
          if (pos) this.fx.burst(pos.x, pos.y + 10, 0xc8b898, 500);
          this.sfx.cast('Nahkampf');
          break;
        }
        case 'miss': {
          const at = getActor(w, e.attackerId);
          const tg = getActor(w, e.targetId);
          const v = at ? this.actorViews.get(at.id) : undefined;
          if (v) {
            v.swingStart = this.now;
            v.swingUntil = this.now + SWING_MS * this.ts;
          }
          this.later(SWING_MS * 0.4 * this.ts, () => {
            const pos = this.bodyPos(tg);
            if (!pos) return;
            const toPlayer = e.targetId === this.playerId;
            this.fx.floatText(pos.x, pos.y - 26, toPlayer ? 'Ausgewichen' : 'Verfehlt', toPlayer ? '#7fe0ff' : '#b0b0b8', 13);
            if (e.attackerId === this.playerId || toPlayer) this.sfx.miss();
          });
          break;
        }
        case 'died': {
          const dead = getActor(w, e.id);
          if (e.id !== this.playerId) {
            const pos = this.bodyPos(dead);
            if (pos) {
              this.fx.burst(pos.x, pos.y, dead?.boss ? 0xffb040 : 0xd8d0c0, dead?.boss ? 900 : 420);
              if (dead?.boss) {
                this.fx.ring(pos.x, pos.y + 20, 200, 0xffb040, 700);
                this.cameras.main.shake(350, 0.008);
                this.ui.banner(`${dead.name} ist gefallen!`, '#ffb040');
              }
            }
            this.sfx.kill();
            this.achBump('kills');
            if (dead?.boss) { this.achBump('bosses'); if (dead.kindId === 'ash_king') { this.achBump('king'); this.ui.banner('Der Aschenkönig ist gefallen – Aschental atmet auf.', '#ffd23a'); this.sfx.fanfare(); } say(`${dead.name} besiegt.`); }
          }
          break;
        }
        case 'loot': {
          const r = e.item.rarity;
          if (r === 'rare') {
            this.achBump('rares');
            this.ui.banner(`Selten: ${e.item.name}`, '#f2c94c');
            this.cameras.main.flash(160, 255, 220, 90);
          }
          else if (r === 'legendary' || r === 'set') this.achBump('legendary');
          if (r === 'legendary' || r === 'set') {
            this.sfx.legendary();
            this.ui.banner(`${r === 'legendary' ? 'Legendär' : 'Set-Teil'}: ${e.item.name}`, r === 'legendary' ? '#ff8a2a' : '#5fd070');
            this.cameras.main.flash(220, r === 'legendary' ? 255 : 120, r === 'legendary' ? 150 : 255, 60);
            say(`Beute: ${e.item.name}!`);
          } else if (r === 'rare' || e.item.slot === 'gem') {
            if (r === 'rare') this.sfx.rare();
            say(`Beute: ${e.item.name}`);
          }
          break;
        }
        case 'note': say(e.text); break;
        case 'respecced': say('Alles neu verteilt: Attribute und Fertigkeiten sind zurückgesetzt.'); this.sfx.quest(); break;
        case 'chestOpened': {
          this.achBump('chests');
          this.sfx.chest();
          const ch = w.chests.find((c) => c.id === e.chestId);
          if (ch) {
            const { sx, sy } = toScreen(ch.x, ch.y);
            this.fx.burst(sx, sy - 8, 0xffe890, 600);
            this.fx.sparkle(sx, sy - 6, 0xffe890, 900);
          }
          break;
        }
        case 'pickedUp':
          if (e.item.slot === 'gem') {
            say(`Edelstein: ${e.item.name}`);
            this.sfx.gem();
          } else {
            say(`Erhalten: ${e.item.name} (${describeItem(e.item)})`);
            this.sfx.pickup();
          }
          break;
        case 'tooHeavy': say(`Zu schwer: ${e.item.name}`); break;
        case 'cannotEquip': say(`${e.item.name}: ${e.reason}`); break;
        case 'xp': {
          const pos = this.bodyPos(this.player());
          if (pos) this.fx.floatText(pos.x - 22, pos.y - 44, `+${e.amount} XP`, '#9fd0ff', 12, 1100);
          break;
        }
        case 'gold': {
          this.sfx.coin();
          const pos = this.bodyPos(this.player());
          if (pos) this.fx.floatText(pos.x + 22, pos.y - 34, `+${e.amount}g`, '#ffd84a', 12, 1100);
          break;
        }
        case 'levelUp': {
          this.achBump('level', e.level);
          say(`LEVEL ${e.level}! +5 Attributpunkte (C), +1 Skillpunkt`);
          this.sfx.levelUp();
          const pos = this.bodyPos(this.player());
          if (pos) {
            this.fx.column(pos.x, pos.y + 20, 0xfff0a0, 1400);
            this.fx.ring(pos.x, pos.y + 20, 170, 0xfff0a0, 600);
          }
          this.ui.banner(`Stufe ${e.level}!`, '#ffe45a');
          break;
        }
        case 'learned': say(`${SKILLS.find((s) => s.id === e.skillId)?.name}: Rang ${e.rank ?? 1}`); this.sfx.quest(); break;
        case 'enraged': {
          const boss = getActor(w, e.id);
          const pos = this.bodyPos(boss);
          if (pos) this.fx.ring(pos.x, pos.y + 20, 180, 0xff3a2a, 600);
          this.cameras.main.shake(250, 0.006);
          say(`${boss?.name} wird wütend!`);
          this.sfx.boss();
          break;
        }
        case 'healed': {
          const pos = this.bodyPos(this.player());
          if (pos) {
            this.fx.sparkle(pos.x, pos.y, 0x6fff9a);
            this.fx.floatText(pos.x, pos.y - 30, `+${e.amount}`, '#6fff9a', 16);
          }
          this.sfx.potion();
          break;
        }
        case 'crafted': say(e.op === 'socket' ? `Edelstein eingesetzt: ${e.item.name}` : `Geschmiedet: ${e.item.name}`); this.sfx.pickup(); break;
        case 'potion': {
          const pos = this.bodyPos(this.player());
          if (pos) this.fx.sparkle(pos.x, pos.y, e.item.heal ? 0xff6a7a : 0x6a8aff);
          say(`Benutzt: ${e.item.name}`);
          this.sfx.potion();
          break;
        }
        case 'questProgress': say(`Aufgabe: ${e.progress}/${e.count}`); break;
        case 'questDone': say(`Aufgabe erfüllt: ${questById(e.questId)?.name} – beim Auftraggeber abgeben!`); this.sfx.quest(); break;
        case 'questTurned': {
          this.achBump('quests');
          const def = questById(e.questId);
          say(`Aufgabe abgegeben: +${e.xp} XP, +${e.gold} Gold${e.item ? `, ${e.item.name}` : ''}`);
          if (def?.outro) say(def.outro);
          if (e.item) this.ui.banner(`Belohnung: ${e.item.name}`, '#ffd23a');
          this.sfx.quest();
          break;
        }
        case 'questItem': say(`${e.item} gefunden (${e.progress}/${e.count})`); this.sfx.pickup(); break;
        case 'talk': this.sfx.quest(); break;
        case 'worldBoss': {
          // Banner/Ton nur in der Nähe (Entfernung zum Boss), sonst nur eine dezente Chatzeile
          const wb = getActor(w, e.id);
          const pl = this.player();
          const dist = wb ? Math.hypot(wb.x - pl.x, wb.y - pl.y) : Infinity;
          if (e.state === 'spawn') {
            say(`Weltboss erwacht: ${e.name} ${e.where}.`);
            if (dist <= 60) {
              this.ui.banner(`${e.name} erwacht ${e.where}!`, '#c77fff');
              this.sfx.boss();
            }
          } else {
            say(`Weltboss besiegt: ${e.name}. Beute liegt am Boden.`);
            if (dist <= 60) this.ui.banner(`${e.name} ist gefallen!`, '#ffd23a');
            const pos = dist <= 24 ? this.bodyPos(wb) : null;
            if (pos) {
              // Sichtweite: Effekt und Fanfare (Boss-Flag-Gegner haben Ring/Shake schon im 'died'-Ereignis)
              if (!wb?.boss) {
                this.fx.burst(pos.x, pos.y, 0xffd23a, 900);
                this.fx.ring(pos.x, pos.y + 20, 200, 0xffd23a, 700);
                this.cameras.main.shake(350, 0.008);
              }
              this.sfx.fanfare();
            }
          }
          break;
        }
        case 'deathPenalty':
          this.achBump('deaths');
          say(`Du bist gestorben: −${e.xpLost} XP, ${e.dropped.length} Item(s) liegen an der Todesstelle (5 Min.).`);
          this.sfx.death();
          this.cameras.main.shake(300, 0.008);
          this.cameras.main.flash(500, 120, 0, 0);
          this.ui.banner('Du bist gefallen', '#c43a3a');
          break;
        case 'respawned': say('Du erwachst in der Stadt.'); break;
        case 'fail': say(e.reason); break;
        default: break;
      }
    }
  }

  /* --------------------------------------------------------------- Zeichnen */

  private gidAt(x: number, y: number): number {
    const { w, h } = this.world.grid;
    return x < 0 || y < 0 || x >= w || y >= h ? 6 : (this.tiles[y * w + x] ?? 6);
  }

  /** Bodenkachel unter einem Hindernis: häufigste begehbare Nachbarkachel. */
  private groundUnder(x: number, y: number): number {
    const count = new Map<number, number>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const g = this.gidAt(x + dx, y + dy);
        if (!PROP_GIDS.has(g) && g !== 6 && g !== 12 && g !== 0) count.set(g, (count.get(g) ?? 0) + 1);
      }
    }
    let best = 4;
    let n = 0;
    for (const [g, c] of count) if (c > n) { best = g; n = c; }
    return best;
  }

  private scanFor(x: number, y: number, r: number, gid: number): boolean {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.gidAt(x + dx, y + dy) === gid) return true;
    return false;
  }

  private draw(time: number, p: Actor): void {
    const g = this.gfx;
    g.clear();
    this.gfxGround.clear();
    if (this.frame % 3 === 0) this.updateHover();
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    this.updateChunks(px, py);
    this.updateProps(px, py);
    this.updateNpcs(time);
    this.updateChests(time, px, py);
    this.updateLoot(time, g);
    this.updateActors(time, p, g);
    for (const r of this.world.safe) this.outline(g, r.x, r.y, r.w, r.h);
    this.shimmer(time, px, py);
    const dtFrame = Math.min(time - this.lastTime, 100);
    this.atmo.update(dtFrame);
    this.ambientKind = this.atmo.ambientKind();
    this.fx.setAmbient(this.ambientKind, this.cameras.main.worldView, time - this.lastTime);
    this.lastTime = time;
    this.fx.update(time, g);
    const cp = this.camPos ?? p;
    const { sx, sy } = toScreen(cp.x, cp.y);
    this.cameras.main.centerOn(Math.round(sx), Math.round(sy - 14));
    if (this.frame % 30 === 0) this.marks = questMarks(this.world, p);
    if (this.frame % 6 === 0) this.minimap.draw(p.x, p.y, this.marks);
    this.updateCompass(g, p, time);
    this.updateRegion(p);
  }

  /** Pfeil um die Figur zum nächsten Aufgabenziel (erst ab 10 Feldern Abstand); Entfernung daneben. */
  private updateCompass(g: Phaser.GameObjects.Graphics, p: Actor, time: number): void {
    const seen = new Set<string>();
    let best: QuestMark | null = null;
    let bd = Infinity;
    for (const m of this.marks) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best && bd > 10) {
      const me = toScreen(this.dispPos(p).x, this.dispPos(p).y);
      const to = toScreen(best.x, best.y);
      const ang = Math.atan2(to.sy - me.sy, to.sx - me.sx);
      const r = 78 + Math.sin(time / 260) * 3;
      const cx = me.sx + Math.cos(ang) * r;
      const cy = me.sy - 14 + Math.sin(ang) * r * 0.6;
      const col = best.done ? 0x6fe08a : 0xffe45a;
      g.fillStyle(col, 0.9);
      g.lineStyle(1.5, 0x000000, 0.9);
      const tip = { x: cx + Math.cos(ang) * 9, y: cy + Math.sin(ang) * 9 };
      const l = { x: cx + Math.cos(ang + 2.5) * 7, y: cy + Math.sin(ang + 2.5) * 7 };
      const rr = { x: cx + Math.cos(ang - 2.5) * 7, y: cy + Math.sin(ang - 2.5) * 7 };
      g.fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
      g.strokeTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
      this.label('z-compass', `${Math.round(bd)}`, cx, cy + 14, best.done ? '#6fe08a' : '#ffe45a', seen, 11);
    }
    this.cleanLabels(seen, ['z']);
  }

  /** Glitzern auf Wasser und pulsierende Lava (nur Darstellung, unter Props und Akteuren). */
  private shimmer(time: number, px: number, py: number): void {
    if (time - this.lastShimmer < 120) return;
    this.lastShimmer = time;
    const g = this.gfxShimmer;
    g.clear();
    const { w, h } = this.world.grid;
    const view = this.cameras.main.worldView;
    for (let y = Math.max(0, py - VIEW); y < Math.min(h, py + VIEW); y++) {
      for (let x = Math.max(0, px - VIEW); x < Math.min(w, px + VIEW); x++) {
        const gid = this.tiles[y * w + x];
        if (gid !== 6 && gid !== 12) continue;
        const { sx, sy } = toScreen(x, y);
        if (sx < view.left - 40 || sx > view.right + 40 || sy < view.top - 20 || sy > view.bottom + 20) continue;
        const hh = hash(x, y);
        if (gid === 6) {
          const phase = ((hh % 1000) / 1000 + time / 2400) % 1;
          if (phase < 0.2) {
            const a = Math.sin((phase / 0.2) * Math.PI);
            g.fillStyle(0xcfe8ff, 0.32 * a);
            g.fillRect(sx - 10 + (hh % 17), sy - 4 + (hh % 7), 7, 1);
            g.fillRect(sx - 4 + (hh % 9), sy + 1 + (hh % 5), 4, 1);
          }
        } else {
          const pulse = 0.5 + 0.5 * Math.sin(time / 420 + (hh % 100));
          g.fillStyle(0xffd070, 0.12 + 0.2 * pulse);
          g.fillRect(sx - 12 + (hh % 19), sy - 3 + (hh % 9), 9, 2);
        }
      }
    }
  }

  private updateHover(): void {
    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const hit = this.pick(wp.x, wp.y);
    this.hover = hit;
    let cursor = '';
    if (this.armedSkill) cursor = this.armedCursor;
    else if (hit?.actor) cursor = 'crosshair';
    else if (hit?.npc || hit?.chest) cursor = 'pointer';
    else if (!this.armedSkill) {
      const t = toTile(wp.x, wp.y);
      if (this.world.ground.some((gi) => Math.hypot(gi.x - t.x, gi.y - t.y) < 0.8)) cursor = 'pointer';
    }
    if (cursor !== this.cursor) {
      this.cursor = cursor;
      this.input.setDefaultCursor(cursor || 'default');
    }
  }

  /** Bossmusik, solange ein lebender Boss in der Nähe auf den Spieler zielt; sonst Stimmung der Zone. */
  private applyMusic(): void {
    const p = this.player();
    const boss = this.world.actors.some((a) => a.kind === 'monster' && a.boss && a.alive && a.targetId === p.id && Math.hypot(a.x - p.x, a.y - p.y) < 14);
    this.sfx.setMood(boss ? 'boss' : this.zoneMood);
  }

  private updateRegion(p: Actor): void {
    if (this.frame % 30 === 0) this.applyMusic();
    // Dungeons liegen innerhalb der Landkarte; kleinste passende Zone gewinnt
    const hit = regionAt(this.world, p.x, p.y);
    const name = hit?.name ?? '';
    if (name !== this.regionName) {
      this.regionName = name;
      const dungeon = isDungeon(name);
      this.vignette.style.background = dungeon
        ? 'radial-gradient(ellipse at center,rgba(8,6,20,.15) 30%,rgba(2,0,10,.82) 100%)'
        : 'radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(0,0,0,.45) 100%)';
      this.atmo.setRegion(name);
      const ash = name === 'Aschenöde' || name === 'Aschengrund' || name === 'Thron der Asche';
      this.zoneMood = ash ? 'ash' : dungeon ? (name.includes('Moorhexe') || name === 'Katakomben' ? 'moor' : 'dungeon') : name === 'Aschenhafen' || name === 'Felsenwacht' ? 'town' : name === 'Moorlande' || name === 'Totenacker' ? 'moor' : 'field';
      this.applyMusic();
      this.sfx.ambient(name === 'Moorlande' || name === 'Gruft der Moorhexe' ? 'wind' : ash ? 'embers' : dungeon ? 'cave' : null);
      if (hit) this.ui.banner(`${hit.name}${hit.levels && hit.levels !== 'Stadt' ? ` · Stufe ${hit.levels}` : ''}`);
    }
  }

  private updateChunks(px: number, py: number): void {
    const { w, h } = this.world.grid;
    const cx0 = Math.max(0, Math.floor((px - VIEW) / CHUNK));
    const cx1 = Math.min(Math.floor((w - 1) / CHUNK), Math.floor((px + VIEW) / CHUNK));
    const cy0 = Math.max(0, Math.floor((py - VIEW) / CHUNK));
    const cy1 = Math.min(Math.floor((h - 1) / CHUNK), Math.floor((py + VIEW) / CHUNK));
    // Nur wenige Chunks pro Frame bauen (Ruckeln beim Überqueren von Chunk-Grenzen vermeiden); beim Start mehr
    let budget = this.frame < 3 ? 40 : 2;
    for (let cy = cy0; cy <= cy1 && budget > 0; cy++) {
      for (let cx = cx0; cx <= cx1 && budget > 0; cx++) {
        if (!this.chunks.has(`${cx}_${cy}`)) {
          this.makeChunk(cx, cy);
          budget--;
        }
      }
    }
    if (this.frame % 30 === 0) {
      for (const [key, img] of this.chunks) {
        const [cx, cy] = key.split('_').map(Number) as [number, number];
        if (cx < cx0 - 2 || cx > cx1 + 2 || cy < cy0 - 2 || cy > cy1 + 2) {
          img.destroy();
          this.textures.remove(`chunk_${key}`);
          this.chunks.delete(key);
        }
      }
    }
  }

  private makeChunk(cx: number, cy: number): void {
    const { w, h } = this.world.grid;
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const x1 = x0 + CHUNK - 1;
    const y1 = y0 + CHUNK - 1;
    const minSx = (x0 - y1) * (TILE_W / 2) - TILE_W / 2;
    const maxSx = (x1 - y0) * (TILE_W / 2) + TILE_W / 2;
    const minSy = (x0 + y0) * (TILE_H / 2) - TILE_H / 2;
    const maxSy = (x1 + y1) * (TILE_H / 2) + TILE_H / 2;
    const c = document.createElement('canvas');
    c.width = maxSx - minSx;
    c.height = maxSy - minSy;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = y0; y <= Math.min(y1, h - 1); y++) {
      for (let x = x0; x <= Math.min(x1, w - 1); x++) {
        const gid = this.tiles[y * w + x] ?? 0;
        if (!gid) continue;
        const ground = WATER_PROP_GIDS.has(gid) ? 6 : PROP_GIDS.has(gid) ? this.groundUnder(x, y) : gid;
        const { sx, sy } = toScreen(x, y);
        const ox = sx - TILE_W / 2 - minSx;
        const oy = sy - TILE_H / 2 - minSy;
        ctx.drawImage(tileCanvas(ground, hash(x, y) % TILE_VARIANTS), ox, oy);
        this.dither(ctx, x, y, ground, ox, oy);
      }
    }
    const key = `chunk_${cx}_${cy}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, c);
    this.chunks.set(`${cx}_${cy}`, this.add.image(minSx, minSy, key).setOrigin(0, 0).setDepth(-1e6));
  }

  /** Weicher Übergang: an Grenzen zu anderen Bodenarten streut die Nachbarfarbe Pixel auf die Kachelkante. */
  private dither(ctx: CanvasRenderingContext2D, x: number, y: number, ground: number, ox: number, oy: number): void {
    // Kanten der Raute (Ecken relativ zur Mitte): oben, rechts, unten, links
    const T: [number, number] = [0, -16];
    const R: [number, number] = [32, 0];
    const B: [number, number] = [0, 16];
    const L: [number, number] = [-32, 0];
    const edges: [number, number, [number, number], [number, number]][] = [
      [1, 0, R, B], [-1, 0, L, T], [0, 1, L, B], [0, -1, T, R],
    ];
    for (const [dx, dy, A, Bc] of edges) {
      let ng = this.gidAt(x + dx, y + dy);
      if (WATER_PROP_GIDS.has(ng)) ng = 6;
      else if (PROP_GIDS.has(ng)) ng = this.groundUnder(x + dx, y + dy);
      if (ng === ground || ng === 0 || ground === 6 || ground === 12) continue;
      ctx.fillStyle = '#' + tileBase(ng).toString(16).padStart(6, '0');
      const n = hash(x * 7 + dx + 3, y * 13 + dy + 5);
      for (let i = 0; i < 12; i++) {
        const t = (((n >>> (i * 2)) ^ (i * 2654435761)) >>> 0) % 100 / 100;
        const depth = (((n >>> 5) + i * 7919) >>> 0) % 100 / 100;
        if (depth > 0.55) continue;
        // Punkt auf der Kante, nach innen zur Mitte hin versetzt
        const px = (A[0] + (Bc[0] - A[0]) * t) * (1 - depth * 0.42);
        const py = (A[1] + (Bc[1] - A[1]) * t) * (1 - depth * 0.42);
        ctx.fillRect(Math.round(ox + TILE_W / 2 + px), Math.round(oy + TILE_H / 2 + py), 2, 1);
      }
    }
  }

  private updateProps(px: number, py: number): void {
    const { w, h } = this.world.grid;
    const view = this.cameras.main.worldView;
    for (let y = Math.max(0, py - VIEW); y < Math.min(h, py + VIEW); y++) {
      for (let x = Math.max(0, px - VIEW); x < Math.min(w, px + VIEW); x++) {
        const gid = this.tiles[y * w + x] ?? 0;
        if (!PROP_GIDS.has(gid)) continue;
        const idx = y * w + x;
        if (this.props.has(idx)) continue;
        const { sx, sy } = toScreen(x, y);
        if (sx < view.left - 160 || sx > view.right + 160 || sy < view.top - 160 || sy > view.bottom + 160) continue;
        this.props.set(idx, this.makeProp(x, y, gid, sx, sy));
      }
    }
    if (this.frame % 20 === 0) {
      for (const [idx, img] of this.props) {
        const x = idx % w;
        const y = Math.floor(idx / w);
        if (Math.abs(x - px) > VIEW + 4 || Math.abs(y - py) > VIEW + 4) {
          img.destroy();
          this.props.delete(idx);
        }
      }
    }
  }

  private makeProp(x: number, y: number, gid: number, sx: number, sy: number): Phaser.GameObjects.Image {
    const v = hash(x, y);
    let key: string;
    let oy: number;
    let dy = 8;
    if (gid === 2) {
      const style = this.scanFor(x, y, 2, 5) ? 'dungeon' : this.scanFor(x, y, 2, 1) ? 'brick' : 'cliff';
      key = `wall_${style}_${v % WALL_VARIANTS}`;
      oy = 1;
      dy = TILE_H / 2;
    } else if (gid === 10) {
      const style = this.scanFor(x, y, 2, 3) ? 'dead' : this.scanFor(x, y, 2, 9) ? 'char' : this.scanFor(x, y, 2, 8) ? 'pine' : 'oak';
      key = `tree_${style}_${v % 3}`;
      oy = 0.93;
      dy = 10;
    } else if (gid === 11) {
      key = `rock_${this.scanFor(x, y, 2, 9) ? 'dark' : 'grey'}_${v % 3}`;
      oy = 0.85;
    } else if (gid === 13) {
      key = `grave_${v % 2}`;
      oy = 0.88;
    } else if (gid >= TOWN_GID.wall && gid <= TOWN_GID.doorLast) {
      ({ key, oy, dy } = this.townProp(x, y, gid, v));
    } else {
      key = 'pillar';
      oy = 0.92;
    }
    return this.add.image(sx, sy + dy, key).setOrigin(0.5, oy).setDepth(sy + TILE_H / 2);
  }

  /** Stadtprops: Hauswand, Tür mit Berufsschild (Achse nach den Nachbarwänden), Dekoration. */
  private townProp(x: number, y: number, gid: number, v: number): { key: string; oy: number; dy: number } {
    const wall = (gx: number, gy: number) => this.gidAt(gx, gy) === TOWN_GID.wall;
    if (gid === TOWN_GID.wall) return { key: `twn_wall_${v % 4}`, oy: 1, dy: TILE_H / 2 };
    if (gid >= TOWN_GID.doorFirst) {
      const axis = wall(x - 1, y) || wall(x + 1, y) ? 'x' : 'y';
      return { key: `twn_door_${DOOR_ICONS[gid - TOWN_GID.doorFirst]}_${axis}`, oy: 1, dy: TILE_H / 2 };
    }
    const m: Record<number, { key: string; oy: number; dy: number }> = {
      [TOWN_GID.barrel]: { key: 'twn_barrel', oy: 0.9, dy: 8 }, [TOWN_GID.crates]: { key: 'twn_crates', oy: 0.9, dy: 8 }, [TOWN_GID.well]: { key: 'twn_well', oy: 0.92, dy: 10 },
      [TOWN_GID.lantern]: { key: 'twn_lantern', oy: 0.95, dy: 8 }, [TOWN_GID.stall]: { key: 'twn_stall', oy: 0.9, dy: 8 }, [TOWN_GID.post]: { key: 'twn_post', oy: 0.9, dy: 8 },
      [TOWN_GID.flowers]: { key: 'twn_flowers', oy: 0.9, dy: 8 }, [TOWN_GID.boat]: { key: 'twn_boat', oy: 0.8, dy: 8 }, [TOWN_GID.ship]: { key: 'twn_ship', oy: 0.82, dy: 10 },
    };
    return m[gid] ?? { key: 'pillar', oy: 0.92, dy: 8 };
  }

  private updateNpcs(time: number): void {
    const p = this.player();
    const seen = new Set<string>();
    for (const n of this.world.npcs) {
      let img = this.npcViews.get(n.id);
      const np = this.dispPos(n);
      const { sx, sy } = toScreen(np.x, np.y);
      if (!img) {
        img = this.add.image(sx, sy + 8, npcTextureKey(n.kind, n.name)).setOrigin(0.5, FEET_ORIGIN_Y);
        this.npcViews.set(n.id, img);
      }
      this.gfxGround.fillStyle(0x000000, 0.2);
      this.gfxGround.fillEllipse(sx, sy + 9, n.kind === 'stash' ? 34 : 26, n.kind === 'stash' ? 13 : 10);
      img.setPosition(sx, sy + 8).setDepth(sy + 8);
      this.label(`n${n.id}`, n.name, sx, sy - 52, '#e8d9b0', seen);
      const mark = this.questMark(n, p);
      if (mark) this.label(`m${n.id}`, mark, sx, sy - 70 + Math.sin(time / 200) * 2, mark === '!' ? '#ffe45a' : mark === '…' ? '#8fd0ff' : '#7fe08a', seen, 22);
    }
    this.cleanLabels(seen, ['n', 'm']);
  }

  private updateChests(time: number, px: number, py: number): void {
    const seen = new Set<string>();
    const me = this.player();
    for (const c of this.world.chests) {
      let img = this.chestViews.get(c.id);
      const near = Math.abs(c.x - px) <= VIEW && Math.abs(c.y - py) <= VIEW;
      if (!near) {
        img?.setVisible(false);
        continue;
      }
      const { sx, sy } = toScreen(c.x, c.y);
      const key = `chest_${c.tier}_${c.opened ? 1 : 0}`;
      if (!img) {
        img = this.add.image(sx, sy + 8, key).setOrigin(0.5, 0.9);
        this.chestViews.set(c.id, img);
      }
      img.setTexture(key).setVisible(true).setPosition(sx, sy + 8).setDepth(sy + 8);
      this.gfxGround.fillStyle(0x000000, 0.22);
      this.gfxGround.fillEllipse(sx, sy + 9, 36, 13);
      if (!c.opened) {
        const col = { wood: 0xc89860, iron: 0x9fb4d8, gold: 0xffd84a }[c.tier];
        if (c.tier !== 'wood' && (this.frame + c.id * 7) % 45 === 0) this.fx.sparkle(sx, sy - 6, col, 800);
        if (Math.hypot(c.x - me.x, c.y - me.y) < 9) this.label(`c${c.id}`, c.tier === 'gold' ? 'Goldene Truhe' : c.tier === 'iron' ? 'Eisentruhe' : 'Truhe', sx, sy - 22 + Math.sin(time / 300) * 1.5, '#' + col.toString(16).padStart(6, '0'), seen, 11);
      } else img.setAlpha(0.85);
      if (!c.opened) img.setAlpha(1);
    }
    this.cleanLabels(seen, ['c']);
  }

  private questMark(n: Npc, p: Actor): string {
    if (n.kind !== 'quest') return '';
    let avail = false;
    for (const id of n.quests ?? []) {
      const st = p.quests[id];
      const def = questById(id);
      if (st?.state === 'done') return '?';
      if (def && questAvailable(p, def)) avail = true;
    }
    // Gesprächsziel einer offenen Aufgabe: Sprechblase
    for (const [id, st] of Object.entries(p.quests)) {
      const def = questById(id);
      if (st.state === 'active' && def?.kind === 'talk' && def.target === npcKeyOf(n.name)) return '…';
    }
    return avail ? '!' : '';
  }

  /** Tränke und Edelsteine liegen mit ihrem eigenen Symbol am Boden (bis es geladen ist: Standard-Beutesymbol). */
  private useItemTexture(img: Phaser.GameObjects.Image, it: Item): void {
    if (it.slot !== 'potion' && it.slot !== 'gem') return;
    const key = `lootitem_${it.templateId}`;
    const apply = () => img.setTexture(key).setDisplaySize(30, 30);
    if (this.textures.exists(key)) {
      apply();
      return;
    }
    const im = new Image();
    im.onload = () => {
      if (!this.textures.exists(key)) this.textures.addImage(key, im);
      if (img.scene) apply();
    };
    im.src = itemIcon(it);
  }

  private updateLoot(time: number, g: Phaser.GameObjects.Graphics): void {
    const live = new Set<number>();
    const p = this.player();
    const seen = new Set<string>();
    const hoverTile = this.hoverTile();
    for (const gi of this.world.ground) {
      live.add(gi.id);
      const { sx, sy } = toScreen(gi.x, gi.y);
      let img = this.lootViews.get(gi.id);
      if (!img) {
        img = this.add.image(sx, sy, `loot_${gi.item.rarity}`).setOrigin(0.5, 0.7);
        this.lootViews.set(gi.id, img);
        this.useItemTexture(img, gi.item);
        this.lootBorn.set(gi.id, { t: time, dx: ((gi.id * 37) % 25) - 12 });
      }
      const born = this.lootBorn.get(gi.id)!;
      const k = Math.min(1, (time - born.t) / 480);
      // Bogenflug aus dem Gegner
      const arc = -Math.sin(k * Math.PI) * 30;
      const slide = (1 - k) * born.dx;
      this.gfxGround.fillStyle(0x000000, 0.28);
      this.gfxGround.fillEllipse(sx + slide, sy + 6, 18 - Math.abs(arc) * 0.2, 6);
      img.setPosition(sx + slide, sy + 2 + arc).setDepth(sy + 4);
      const r = gi.item.rarity;
      const col = { normal: 0xc9c4bd, magic: 0x6f8fff, rare: 0xf2c94c, set: 0x5fd070, legendary: 0xff8a2a }[r];
      if (r !== 'normal') {
        const pulse = r === 'legendary' ? 0.75 + 0.25 * Math.sin(time / 180) : 1;
        const wide = r === 'legendary' ? 16 : r === 'set' ? 12 : 8;
        const tall = r === 'legendary' ? 110 : 60;
        g.fillStyle(col, 0.16 * pulse);
        g.fillRect(sx - wide, sy - tall, wide * 2, tall);
        g.fillStyle(col, 0.3 * pulse);
        g.fillRect(sx - wide / 2, sy - tall, wide, tall);
        if ((r === 'legendary' || r === 'set') && (this.frame + gi.id) % 40 === 0) this.fx.sparkle(sx, sy - 10, col, 900);
      }
      if (gi.item.slot === 'gem' && (this.frame + gi.id) % 36 === 0) this.fx.sparkle(sx, sy - 8, 0x9fe8ff, 800);
      // Beutenamen in Seltenheitsfarbe: magisch und besser immer in der Nähe, Normales nur nah oder unter dem Mauszeiger
      const near = Math.hypot(gi.x - p.x, gi.y - p.y);
      const hov = hoverTile && Math.hypot(gi.x - hoverTile.x, gi.y - hoverTile.y) < 0.9;
      if (near < 12 && (r !== 'normal' || near < 5 || hov) && k >= 1) {
        this.label(`l${gi.id}`, (isUpgrade(p, gi.item) ? '▲ ' : '') + gi.item.name, sx, sy - (r === 'legendary' ? 24 : 18), '#' + col.toString(16).padStart(6, '0'), seen, r === 'normal' ? 11 : 12);
      }
      if (hov) {
        g.lineStyle(2, col, 0.9);
        g.strokeEllipse(sx, sy + 4, 30, 14);
      }
    }
    this.cleanLabels(seen, ['l']);
    for (const [id, img] of this.lootViews) {
      if (!live.has(id)) {
        img.destroy();
        this.lootViews.delete(id);
        this.lootBorn.delete(id);
      }
    }
  }

  private hoverTile(): { x: number; y: number } | null {
    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    return toTile(wp.x, wp.y);
  }

  private updateActors(time: number, p: Actor, g: Phaser.GameObjects.Graphics): void {
    const seen = new Set<string>();
    const active = new Set<number>();
    for (const a of this.world.actors) {
      let view = this.actorViews.get(a.id);
      const near = Math.abs(a.x - p.x) <= VIEW && Math.abs(a.y - p.y) <= VIEW;
      if (!near || (!a.alive && a.kind === 'monster' && this.world.tick - a.diedAt > TICK_RATE * 4)) {
        view?.img.setVisible(false);
        continue;
      }
      active.add(a.id);
      const pos = this.dispPos(a);
      if (a.id === p.id) this.camPos = pos;
      const { sx, sy } = toScreen(pos.x, pos.y);
      if (!view) {
        view = { img: this.add.image(sx, sy, 'pillar').setOrigin(0.5, FEET_ORIGIN_Y), lastX: pos.x, lastY: pos.y, movingUntil: 0, flip: false };
        this.actorViews.set(a.id, view);
      }
      const dx = pos.x - view.lastX;
      const dy = pos.y - view.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) {
        view.movingUntil = time + 160;
        // Bildschirm-Richtung: iso x-y
        const screenDx = dx - dy;
        if (Math.abs(screenDx) > 0.0005) view.flip = screenDx < 0;
        if (Math.abs(dx + dy) > 0.0005) view.up = dx + dy < 0;
      }
      view.lastX = pos.x;
      view.lastY = pos.y;
      const swinging = !!view.swingUntil && view.swingUntil > time && a.alive;
      const swingK = swinging ? (time - view.swingStart!) / (view.swingUntil! - view.swingStart!) : -1;
      // Laufzyklus: Schritt links, Stand (Wippe oben), Schritt rechts, Stand; Phase = ein Bild pro STEP_MS (~9 Wechsel/s)
      const stepPhase = time / STEP_MS;
      const frame = swinging ? (swingK < 0.4 ? FRAME_WIND : FRAME_STRIKE) : time < view.movingUntil ? WALK_FRAMES[Math.floor(stepPhase) % 4]! : 0;
      const img = view.img;
      if (a.kind === 'player') {
        const look = lookOf(a);
        img.setTexture(ensureTexture(this, lookKey(look, frame, !!view.up), () => playerCanvas(look, frame, !!view.up)));
      } else {
        const k = monsterKind(a.kindId!);
        const key = `mon_${k.id}_${frame}${view.up ? 'b' : ''}`;
        img.setTexture(ensureTexture(this, key, () => monsterCanvas(k.id, k.family, k.color, !!k.boss, frame, !!view.up)));
      }
      // Rückstoß/Ausfallschritt aus Treffern, klingt schnell ab
      const kk = this.kicks.get(a.id);
      let ox = 0;
      let oy = 0;
      if (kk) {
        ox = kk.x;
        oy = kk.y;
        kk.x *= 0.78;
        kk.y *= 0.78;
        if (Math.abs(kk.x) + Math.abs(kk.y) < 0.2) this.kicks.delete(a.id);
      }
      // Schritt-Wippen beim Gehen, Bodenschatten bleibt fest unter den Füßen
      const walking = time < view.movingUntil && a.alive;
      // Wippe: im Schritt (Fuß setzt auf) unten, im Durchgang (Stand-Bild) oben; Monster hüpfen stärker, Bosse weniger
      const bob = walking && !swinging ? -Math.abs(Math.sin(stepPhase * Math.PI * 0.5)) * (a.boss ? 0.8 : a.kind === 'monster' ? 1.6 : 1.2) : 0;
      if (a.alive) {
        const wide = a.boss ? 46 : a.kind === 'monster' && (monsterKind(a.kindId!).family === 'beast' || monsterKind(a.kindId!).family === 'spider') ? 30 : a.kind === 'monster' && monsterKind(a.kindId!).family === 'golem' ? 34 : 22;
        this.gfxGround.fillStyle(0x000000, 0.18);
        this.gfxGround.fillEllipse(sx + ox, sy + 9 + oy, wide * 1.25, wide * 0.5);
        this.gfxGround.fillStyle(0x000000, 0.22);
        this.gfxGround.fillEllipse(sx + ox, sy + 9 + oy, wide * 0.85, wide * 0.34);
      }
      img.setVisible(true).setPosition(sx + ox, sy + 8 + oy + bob).setDepth(sy + 8).setFlipX(view.flip);
      if (!a.alive) {
        const age = a.kind === 'monster' ? (this.world.tick - a.diedAt) / (TICK_RATE * 4) : 0;
        img.setAngle(view.flip ? -90 : 90).setAlpha(Math.max(0, 0.6 - age * 0.6)).setTintMode(Phaser.TintModes.MULTIPLY).setTint(0x664444).setScale(1);
        img.setDepth(sy);
        continue;
      }
      // leichtes Atmen, wenn sie stehen (Skalierung um die Füße)
      const breath = !walking && !swinging ? 1 + Math.sin(time / 420 + a.id * 1.7) * 0.014 : 1;
      img.setAngle(0).setAlpha(1).setScale(1 / breath ** 0.5, breath);
      // Treffer-Blitz: Phaser-Tint multipliziert (Weiß = unsichtbar) → echter Blitz über den Füllmodus; sonst Modus immer zurücksetzen
      const flashing = (this.flash.get(a.id) ?? 0) > time;
      if (flashing) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (img.tintMode !== Phaser.TintModes.MULTIPLY) img.setTintMode(Phaser.TintModes.MULTIPLY);
      if (flashing) { /* Blitz läuft */ }
      else if (a.status.stun) img.setTint(0xfff0a0);
      else if (a.status.burn) img.setTint(0xffa060);
      else if (a.status.slow) img.setTint(0x9ac8ff);
      else if (a.dot) img.setTint(0x9aff9a);
      else if (a.enraged) img.setTint(0xff9a8a);
      else img.clearTint();
      if (a.resting && this.frame % 40 === 0) {
        this.fx.floatText(sx + 10, sy - 38, 'z', '#bfd8ff', 14, 1400);
        this.fx.sparkle(sx, sy - 6, 0x9fd0ff, 900);
      }
      const hovered = this.hover?.actor?.id === a.id;
      if (a.champ || a.unique) {
        const col = a.unique ? 0xff9a2a : ({ swift: 0x6fe0ff, armored: 0xa0b0d0, fiery: 0xff7a2a, vampiric: 0xe03a4a, thorned: 0x7fe070 } as Record<string, number>)[a.champ!] ?? 0xffe45a;
        const pulse = 0.5 + 0.5 * Math.sin(time / 260 + a.id);
        g.lineStyle(2, col, 0.5 + 0.4 * pulse);
        g.strokeEllipse(sx, sy + 8, (a.boss ? 60 : 44) + pulse * 6, (a.boss ? 26 : 19) + pulse * 3);
        g.fillStyle(col, 0.12 + 0.1 * pulse);
        g.fillEllipse(sx, sy + 8, a.boss ? 54 : 40, a.boss ? 24 : 17);
        if (this.frame % 30 === a.id % 30) this.fx.sparkle(sx, sy - 20, col, 700);
      }
      if (hovered) {
        g.lineStyle(2, 0xffffff, 0.75);
        g.strokeEllipse(sx, sy + 6, a.boss ? 70 : 40, a.boss ? 30 : 18);
      }
      if (a.kind === 'monster') {
        const big = a.boss ? 56 : 28;
        const top = sy + 8 - (a.boss ? 110 : 62);
        // Balken nur bei Schaden, Ziel, Mauszeiger oder Boss
        if (a.boss || a.hp < a.maxHp - 0.5 || a.id === p.targetId || hovered) {
          g.fillStyle(0x200000, 0.9);
          g.fillRect(sx - big / 2, top, big, 5);
          g.fillStyle(a.boss ? 0xe8832a : 0xd44a3a, 1);
          g.fillRect(sx - big / 2, top, big * Math.max(0, a.hp / a.maxHp), 5);
        }
        // Statussymbole: kleine Punkte neben dem Balken (Verlangsamung, Betäubung, Brand), Gift grün
        const pips = [...STATUS_IDS.filter((id) => a.status[id]).map((id) => parseInt(STATUS_COLOR[id].slice(1), 16)), ...(a.dot ? [0x7fe060] : [])];
        pips.forEach((c, i) => {
          g.fillStyle(0x000000, 0.8);
          g.fillCircle(sx + big / 2 + 7 + i * 9, top + 2, 4);
          g.fillStyle(c, 1);
          g.fillCircle(sx + big / 2 + 7 + i * 9, top + 2, 3);
        });
        if (a.boss || a.champ || a.unique || a.id === p.targetId || hovered) this.label(`a${a.id}`, a.name, sx, top - 10, a.unique ? '#ff9a2a' : a.boss ? '#ff9a4a' : a.champ ? '#ffe45a' : '#e6cfcf', seen);
        if (a.champ || a.unique) {
          g.fillStyle(0x200000, 0.9);
          g.fillRect(sx - big / 2, top, big, 5);
          g.fillStyle(a.unique ? 0xff9a2a : 0xf0c040, 1);
          g.fillRect(sx - big / 2, top, big * Math.max(0, a.hp / a.maxHp), 5);
        }
      } else {
        if (a.id !== p.id) this.label(`a${a.id}`, `${a.name} (Lv ${a.level})${a.pkUntil > this.world.tick ? ' ☠' : ''}`, sx, sy + 8 - 66, a.pkUntil > this.world.tick ? '#ff5a4a' : '#9fd0ff', seen);
        // Spielerring in der Stadt = sicher
        if (this.world.safe.some((r) => a.x >= r.x && a.y >= r.y && a.x < r.x + r.w && a.y < r.y + r.h)) {
          g.lineStyle(1, 0xd8a24a, 0.7);
          g.strokeEllipse(sx, sy + 6, 36, 16);
        }
      }
      if (a.id === p.targetId && a.kind === 'monster') {
        g.lineStyle(2, 0xff6a4a, 0.9);
        g.strokeEllipse(sx, sy + 6, a.boss ? 64 : 38, a.boss ? 28 : 17);
      }
    }
    for (const [id, v] of this.actorViews) if (!active.has(id)) v.img.setVisible(false);
    this.cleanLabels(seen, ['a']);
  }

  /** Position vor dem letzten Simulationsschritt, damit die Darstellung zwischen den 20 Schritten pro Sekunde gleiten kann. */
  private snapshotPrev(): void {
    for (const a of [...this.world.actors, ...this.world.npcs]) {
      const v = this.prevPos.get(a.id);
      if (v) {
        v.x = a.x;
        v.y = a.y;
      } else this.prevPos.set(a.id, { x: a.x, y: a.y });
    }
  }

  /** Anzeigeposition: lokal zwischen letztem und aktuellem Simulationsschritt interpoliert, online geglättet zwischen den 10-Hz-Schnappschüssen. */
  private dispPos(a: { id: number; x: number; y: number }): { x: number; y: number } {
    if (!this.remote) {
      const v = this.prevPos.get(a.id);
      if (!v) return a;
      const dx = a.x - v.x;
      const dy = a.y - v.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) return a;     // Sprung (Wiederbelebung, Teleport): nicht gleiten
      const k = Math.min(1, this.acc / (1000 / TICK_RATE));
      let o = this.interp.get(a.id);
      if (!o) this.interp.set(a.id, (o = { x: 0, y: 0 }));
      o.x = v.x + dx * k;
      o.y = v.y + dy * k;
      return o;
    }
    let d = this.disp.get(a.id);
    if (!d) {
      d = { x: a.x, y: a.y };
      this.disp.set(a.id, d);
    }
    const dx = a.x - d.x;
    const dy = a.y - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) {
      d.x = a.x;
      d.y = a.y;
    } else {
      d.x += dx * 0.35;
      d.y += dy * 0.35;
    }
    return d;
  }

  private label(id: string, text: string, x: number, y: number, color: string, seen: Set<string>, size = 12): void {
    seen.add(id);
    let t = this.labels.get(id);
    if (!t) {
      t = this.add.text(0, 0, text, { fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 3, fontStyle: size > 12 ? 'bold' : 'normal' }).setOrigin(0.5).setDepth(OVERLAY_DEPTH + 1);
      this.labels.set(id, t);
    }
    if (t.text !== text) t.setText(text);
    t.setPosition(Math.round(x), Math.round(y)).setVisible(true);
  }

  private cleanLabels(seen: Set<string>, prefixes: string[]): void {
    for (const [id, t] of this.labels) {
      if (prefixes.includes(id[0]!) && !seen.has(id)) {
        t.destroy();
        this.labels.delete(id);
      }
    }
  }

  private outline(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.lineStyle(1, 0xd8a24a, 0.35);
    const pts = [toScreen(x - 0.5, y - 0.5), toScreen(x + w - 0.5, y - 0.5), toScreen(x + w - 0.5, y + h - 0.5), toScreen(x - 0.5, y + h - 0.5)];
    g.beginPath();
    g.moveTo(pts[0]!.sx, pts[0]!.sy);
    for (const q of pts.slice(1)) g.lineTo(q.sx, q.sy);
    g.closePath();
    g.strokePath();
  }
}
