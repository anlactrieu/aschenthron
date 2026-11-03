import Phaser from 'phaser';
import mapJson from '../data/aschenthron.json';
import { assignHotbar, hotbarFor } from './hotbar';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { DMG_COLOR, STATUS_COLOR, monsterKind, npcKeyOf, questById, QUESTS, SKILLS, STATUS_IDS } from '../sim/data';
import { giverLocation, nextStep, type NextStep, questAvailable, questMarks, type QuestMark } from '../sim/quests';
import { exportPlayer, importPlayer } from '../sim/save';
import {
  applyCommand, carriedWeight, carryCapacity, drainEvents, getActor, maxHpOf, maxManaOf, regionAt, tick, TICK_RATE, type Actor, type Chest, type Command, type Npc, type World,
} from '../sim/world';
import { isWalkable } from '../sim/path';
import { toScreen, toTile } from './iso';
import { NINJA_KEYS } from './ninjaProps';
import { ninjaNpcDef } from './figureMap';
import { detectHouses, houseDoor, houseDecor, houseFacade, houseFence, houseRoof, houseSign, houseWallTile, lowerKind, type House, type RoofNotch } from './houses';
import { biomeOf, buildZoneMap, drawDetail, drawLavaTile, drawWaterTile, patchNoise, Z } from './groundLook';
import { DOOR_ICONS, TOWN_GID, WATER_PROP_GIDS, registerTownArt } from './town';
import { Ui, describeItem, isUpgrade } from './ui';
import { generateItem, type Item } from '../sim/items';
import type { Mood } from './music';
import { AchievementTracker, type Stats } from './achievements';
import { itemIcon, skillCursor } from './icons';
import { Sfx } from './audio';
import { Minimap } from './minimap';
import { isTouch } from './touch';
import { Atmosphere, isDungeon } from './atmosphere';
import { Fx } from './fx';
import { playPixelfx, registerPixelfx, type FxName } from './pixelfx';
import { onSettings, settings } from './settings';
import type { RemoteSession } from '../net/client';
import {
  ensureTexture, FEET_ORIGIN_Y, FRAME_STEP_L, FRAME_STEP_R, FRAME_WIND, FRAME_STRIKE, lookKey, lookOf, npcTextureKey, BIPED, monsterCanvas, npcCanvas, ninjaNpcCanvas, playerCanvas, registerStaticArt, tileCanvas, TILE_H, TILE_VARIANTS, TILE_W, WALL_VARIANTS,
} from './art';

const SAVE_BASE = 'aschenthron.save.v1';
const SLOT_KEY = 'aschenthron.slot';
const SLOTS = 3;
/** Gespeicherter Speicherplatz (1–3); Platz 1 nutzt den bisherigen Schlüssel, damit alte Spielstände erhalten bleiben. */
function storedSlot(): number {
  try {
    const n = Number(window.localStorage.getItem(SLOT_KEY));
    return n >= 1 && n <= SLOTS ? n : 1;
  } catch {
    return 1;
  }
}
/** Der Platz wird beim Laden des Tabs einmal festgehalten: ein Wechsel in einem anderen Tab darf den Autosave hier nicht umleiten. */
const sessionSlot = storedSlot();
const activeSlot = (): number => sessionSlot;
const slotKey = (n: number): string => (n === 1 ? SAVE_BASE : `${SAVE_BASE}.s${n}`);
const saveKey = (): string => slotKey(sessionSlot);
const VIEW = 30;
/** Kamera-Zoom: Standard etwas weiter draußen als 1, per Mausrad zwischen ZOOM_MIN und ZOOM_MAX */
const ZOOM_DEFAULT = 0.75;
const ZOOM_MIN = isTouch ? 0.4 : 0.55;
const ZOOM_MAX = isTouch ? 1.4 : 1.1;
const ZOOM_KEY = 'aschenthron.zoom';
const CHUNK = 16;
/** Pfeiltasten → Kachelrichtung (Draufsicht: oben = −y, rechts = +x) */
const ARROW_DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

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
  /** läuft im Bild überwiegend seitlich: Seitenansicht */
  side?: boolean;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private tiles: number[] = [];
  /** Erkannte Häuser der Stadt (Wandringe, gid 18) samt Dach-Bildern und Zuordnung Kachel -> Haus */
  private houses: House[] = [];
  private houseAt = new Map<number, House>();
  private houseSigns = new Map<number, Phaser.GameObjects.Image>();
  private roofs: { img: Phaser.GameObjects.Image; house: House }[] = [];
  /** Türbilder an Nord-/Ost-/Westseite liegen über dem Dach und blenden mit ihm aus */
  private playerId = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private chunks = new Map<string, Phaser.GameObjects.Image>();
  private props = new Map<number, Phaser.GameObjects.Image>();
  private actorViews = new Map<number, ActorView>();
  private lootViews = new Map<number, Phaser.GameObjects.Image>();
  private npcViews = new Map<number, Phaser.GameObjects.Image>();
  /** Laufrichtung der NPCs: Spiegeln, Seitenansicht und Laufzyklus */
  private npcDir = new Map<number, { x: number; y: number; flip: boolean; side: boolean; up: boolean; movingUntil: number }>();  private chestViews = new Map<number, Phaser.GameObjects.Image>();
  private flash = new Map<number, number>();
  private acc = 0;
  private step: NextStep | null = null;
  private lastHint = 0;
  private lastBoard = -1e9;
  private zoneMood: Mood = 'town';
  private achv = new AchievementTracker();
  /** Hit-Stop: so viele ms bleibt die Simulation stehen (nur Einzelspieler), gibt Treffern Wucht */
  private hitStop = 0;
  private autosave = 0;
  private lastSavedHint = 0;
  /** Letzter Zeitpunkt, an dem der Spieler lief oder kämpfte (für Erinnerungen bei Leerlauf) */
  private lastActivity = 0;
  private lastAutoPick = 0;
  /** Beute-IDs, die schon einmal automatisch angesteuert wurden (kein Dauerversuch bei vollem Rucksack) */
  private autoTried = new Map<number, number>();
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
  /** Lichtstrahl (pixelfx) je Beuteteil ab magisch */
  private lootBeams = new Map<number, Phaser.GameObjects.Sprite>();
  /** Säule 4: Schattenflammen hinter Bossen in Sichtweite (Glutrot, sobald wütend) */
  private bossAuras = new Map<number, { s: Phaser.GameObjects.Sprite; rage: boolean }>();
  /** Boss-Auftritt: wann ein Boss zuletzt angekündigt wurde (nicht bei jedem erneuten Kontakt) */
  private bossIntroAt = new Map<number, number>();
  /** Bosse in der Nähe, alle 30 Frames neu gesammelt (nicht jeden Frame alle Akteure durchgehen) */
  private nearBosses: Actor[] = [];
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
  private zoneMap: Uint8Array | null = null;
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
    this.initHouses();
    const store = this.remote ? null : safeStorage();
    const params = new URLSearchParams(location.search);
    if (!this.remote && params.has('neu')) {
      store?.removeItem(saveKey());
      params.delete('neu');
      const rest = params.toString();
      history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
    }
    const saved = store?.getItem(saveKey());
    const p = this.player();
    try {
      const nm = store?.getItem('aschenthron.name');
      if (nm && !this.remote) p.name = nm;
    } catch { /* ohne Speicher: Standardname */ }
    this.ui = new Ui((c) => this.send(c), (i) => this.useSkillSlot(i), (k) => this.usePotionKind(k), () => this.newGame(), this.remote ? null : { export: () => exportPlayer(this.player()), import: (json) => this.importSave(json) }, this.remote ? null : { list: () => this.slotList(), switchTo: (n) => this.switchSlot(n) }, this.remote ? null : { save: () => this.manualSave(), load: () => this.manualLoad(), info: () => this.manualInfo() });
    this.ui.ach = this.achv;
    this.sfx = new Sfx();
    this.sfx.setVolume(settings().volume);
    onSettings(() => this.sfx.setVolume(settings().volume));
    registerPixelfx(this);
    this.atmo = new Atmosphere(this, this.sfx);
    this.minimap = new Minimap(this.world, this.tiles);
    if (this.remote) this.ui.say(`Verbunden als ${p.name}${this.remote.pvp ? ' – PvP außerhalb der Städte aktiv, Angreifer werden zu Mördern' : ''}. Klick auf Spieler greift an.`);
    else if (saved && importPlayer(this.world, p, saved)) this.ui.say('Spielstand geladen.');
    else {
      this.showTitle(p);
      // Erstausstattung: ein Rostschwert, damit die ersten Kämpfe nicht mit bloßen Fäusten beginnen
      const sword = generateItem(this.world.rng, this.world.nextId++, 'rusty_sword', 'normal');
      p.inventory.push(sword);
      this.send({ type: 'equip', itemId: sword.id });
      this.ui.banner('Aschental brennt. Der Thron der Asche ruft.', '#d8a24a');
      this.ui.welcome('Willkommen in Aschenhafen', [
        'Einst war Aschental ein Garten – dann verbrannte der Aschenkönig den Himmel. Du bist einer der Letzten, die noch gegen ihn ziehen. Dein Ziel: Stufe 30, der Thron der Asche.',
        'Sprich mit Hafenmeister Joren (Haus mit Anker, links vom Platz) – er zeigt dir die Stadt. Klick auf den Boden: laufen. Klick auf einen Gegner: angreifen. Dein nächster Schritt steht oben rechts.',
        'Punkte zu verteilen: C öffnet deinen Charakter, K die Fertigkeiten. Alle Tasten und Tipps findest du unter P.',
      ]);
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
    if (isTouch) {
      // Aktive Finger selbst mitzählen: Phasers pointer2.isDown bleibt nach abgebrochenen Touches gern hängen und blockiert dann jedes Laufen
      const drop = (e: PointerEvent): void => void this.fingers.delete(e.pointerId);
      window.addEventListener('pointerdown', (e) => this.fingers.add(e.pointerId), true);
      window.addEventListener('pointerup', drop, true);
      window.addEventListener('pointercancel', drop, true);
      window.addEventListener('blur', () => this.fingers.clear());
      document.addEventListener('visibilitychange', () => this.fingers.clear());
      // Handy: zwei Finger zoomen die Kamera, die Zoom-Knöpfe im Menü auch
      this.input.addPointer(1);
      window.addEventListener('aschenthron:zoom', (e) => this.setZoom(this.cameras.main.zoom * ((e as CustomEvent<number>).detail || 1)));
    }
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

  /** Tränke, Edelsteine und Pfeile in Reichweite automatisch aufheben (Ausrüstung bleibt liegen). */
  private autoPickup(time: number): void {
    const p = this.player();
    // nur im Leerlauf: sonst bricht das Aufheben einen Angriff oder Weg ab
    if (!p?.alive || p.pickupId !== null || p.targetId !== null || p.path.length > 0) return;
    // Versuche merken, solange die Beute in der Nähe liegt (kein Dauerversuch bei vollem Rucksack oder Übergewicht)
    for (const id of [...this.autoTried.keys()]) {
      const g = this.world.ground.find((x) => x.id === id);
      if (!g || Math.hypot(g.x - p.x, g.y - p.y) > 4) this.autoTried.delete(id);
    }
    for (const g of this.world.ground) {
      if (Math.hypot(g.x - p.x, g.y - p.y) > 1.6 || this.autoTried.has(g.id)) continue;
      const it = g.item;
      if (it.slot !== 'potion' && it.slot !== 'gem' && it.off !== 'arrows') continue;
      this.autoTried.set(g.id, time);
      this.send({ type: 'pickup', groundId: g.id });
      return;
    }
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
    safeStorage()?.removeItem(saveKey());
    location.reload();
  }

  /** Spielstand aus Datei/Code übernehmen: prüfen, alten Stand als Sicherung behalten, neu laden. */
  private importSave(json: string): boolean {
    try {
      if (!this.validSave(json)) return false;
    } catch {
      return false;
    }
    const store = safeStorage();
    if (!store) return false;
    try {
      const old = store.getItem(saveKey());
      if (old && this.validSave(old)) store.setItem(`${saveKey()}.backup`, old);
      store.setItem(saveKey(), json);
    } catch {
      return false;
    }
    this.resetting = true;
    location.reload();
    return true;
  }

  /** Grobe Prüfung eines Spielstands vor dem Überschreiben: Version, Spielerobjekt, Stufe. */
  private validSave(json: string): boolean {
    try {
      const o = JSON.parse(json) as { v?: unknown; player?: { level?: unknown; inventory?: unknown } };
      return !!o && typeof o === 'object' && o.v === 1 && !!o.player && typeof o.player === 'object' && typeof o.player.level === 'number' && (o.player.inventory === undefined || Array.isArray(o.player.inventory));
    } catch {
      return false;
    }
  }

  private save(): void {
    if (this.resetting || this.remote) return;
    try {
      safeStorage()?.setItem(saveKey(), exportPlayer(this.player()));
    } catch {
      /* Speicher voll oder gesperrt: Spiel läuft ohne Speichern weiter */
    }
  }

  /** Eigener Speicherstand des aktiven Platzes (zusätzlich zum Autospeichern), zu dem man zurückkehren kann. */
  private manualKey(): string {
    return `${saveKey()}.manual`;
  }

  private manualSave(): void {
    if (this.remote) return;
    const store = safeStorage();
    if (!store) {
      this.ui.say('Speichern nicht möglich (Browser-Speicher gesperrt).');
      return;
    }
    try {
      const json = exportPlayer(this.player());
      store.setItem(this.manualKey(), JSON.stringify({ at: Date.now(), json }));
      store.setItem(saveKey(), json);
      this.ui.savedHint('Spielstand gespeichert');
    } catch {
      this.ui.say('Speichern nicht möglich (Browser-Speicher voll oder gesperrt).');
    }
  }

  private manualRead(): { at: number; json: string } | null {
    try {
      const raw = safeStorage()?.getItem(this.manualKey());
      if (!raw) return null;
      const o = JSON.parse(raw) as { at?: number; json?: string };
      return typeof o.json === 'string' && typeof o.at === 'number' ? { at: o.at, json: o.json } : null;
    } catch {
      return null;
    }
  }

  private manualInfo(): string | null {
    const m = this.manualRead();
    if (!m) return null;
    let who = '';
    try {
      const o = JSON.parse(m.json) as { player?: { level?: number } };
      if (o.player?.level) who = `Stufe ${o.player.level}, `;
    } catch { /* Format unbekannt */ }
    return `${who}${new Date(m.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  }

  private manualLoad(): void {
    const m = this.manualRead();
    const store = safeStorage();
    if (!m || !store) return;
    if (!this.validSave(m.json)) {
      this.ui.say('Der gespeicherte Stand ist beschädigt und kann nicht geladen werden.');
      return;
    }
    try {
      store.setItem(saveKey(), m.json);
    } catch {
      this.ui.say('Laden nicht möglich.');
      return;
    }
    this.resetting = true;
    location.reload();
  }

  /** Übersicht der Speicherplätze für das Einstellungsfenster. */
  private slotList(): { n: number; label: string; exists: boolean; active: boolean }[] {
    const store = safeStorage();
    const out: { n: number; label: string; exists: boolean; active: boolean }[] = [];
    for (let n = 1; n <= SLOTS; n++) {
      let raw: string | null = null;
      try {
        raw = store?.getItem(slotKey(n)) ?? null;
      } catch { /* kein Zugriff */ }
      let label = 'leer';
      if (raw) {
        label = 'Spielstand';
        try {
          const o = JSON.parse(raw) as { player?: { name?: string; level?: number } };
          if (o.player) label = `${o.player.name ?? 'Held'}, Stufe ${o.player.level ?? 1}`;
        } catch { /* Format unbekannt */ }
      }
      out.push({ n, label, exists: !!raw, active: n === activeSlot() });
    }
    return out;
  }

  /** Speicherplatz wechseln: aktuellen Stand sichern, Platz merken, neu laden. */
  private switchSlot(n: number): void {
    if (n === activeSlot() || n < 1 || n > SLOTS) return;
    this.save();
    try {
      window.localStorage.setItem(SLOT_KEY, String(n));
    } catch {
      return;
    }
    this.resetting = true;
    location.reload();
  }

  /** Klassische Menüführung: Fertigkeit wählen (1–9 oder Leiste), dann Ziel anklicken. Selbstzauber wirken sofort. */
  private useSkillSlot(i: number): void {
    const p = this.player();
    const id = hotbarFor(p)[i];
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

  /** Handy: Abstand der zwei Finger (0 = nicht zwei Finger) und Zoom beim Start der Geste */
  private pinch = { dist: 0, zoom: 1 };

  private fingers = new Set<number>();

  private pinchZoom(): boolean {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (this.fingers.size < 2 || !a?.isDown || !b?.isDown) {
      this.pinch.dist = 0;
      return false;
    }
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (!this.pinch.dist) this.pinch = { dist: d || 1, zoom: this.cameras.main.zoom };
    else this.setZoom(this.pinch.zoom * (d / this.pinch.dist));
    return true;
  }

  private onClick(ptr: Phaser.Input.Pointer): void {
    if (isTouch && this.fingers.size >= 2) return;       // zweiter Finger = Zoom, kein Befehl
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
    box.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;overflow-y:auto;background:radial-gradient(ellipse at center,rgba(20,10,8,.88),rgba(0,0,0,.96));color:#e8d9b0;font-family:var(--ui-font);font-size:18px;text-align:center';
    const inner = document.createElement('div');
    inner.style.cssText = `max-width:520px;padding:${isTouch ? 10 : 24}px 24px;margin:auto`;
    inner.innerHTML = `<div style="font-size:${isTouch ? 30 : 44}px;letter-spacing:6px;color:#ffb14a;text-shadow:0 0 18px #b8501a">ASCHENTHRON</div>
<p style="margin:18px 0 6px;line-height:1.55">Aschental war ein Garten, bis der Aschenkönig den Himmel verbrannte. Seitdem wandern Tote durch die Moore, Goblins und Räuber plündern die Straßen, und die Hafenstadt hält sich am letzten Licht.</p>
<p style="margin:6px 0 18px;line-height:1.55;opacity:.9">Du bist eine der Letzten, die noch gegen ihn ziehen. Werde stärker, finde seltene Beute und bring den Aschenkönig auf seinem Thron zu Fall.</p>
<div style="margin-bottom:14px">Dein Name: <input id="ttl-name" maxlength="16" value="Held" style="background:#120f16;border:1px solid #6b5a48;color:#e8d9b0;padding:6px 10px;font:18px var(--ui-font);text-align:center;width:180px"></div>
<button id="ttl-go" style="background:#3a2f26;border:2px solid #d8a24a;color:#ffe8b0;padding:10px 26px;font:20px var(--ui-font);cursor:pointer">Das Abenteuer beginnt</button>
<p style="margin:16px 0 0;font-size:15px;opacity:.65">${isTouch ? 'Tippen = laufen und angreifen · Zwei Finger = zoomen · Menü unten rechts' : 'Klick = laufen und angreifen · Pfeiltasten laufen auch · Hilfe und Tasten: P'}</p>`;
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
    if (Object.values(p.quests).some((q) => q.state !== 'turned')) {
      // Aufgabe läuft, aber lange nichts getan: den nächsten Schritt wiederholen
      this.lastHint = time;
      const idle = time - this.lastActivity > 60000;
      if (idle && this.step) this.ui.say(`Nächster Schritt: ${this.step.text}`);
      return;
    }
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
    if (this.remote && time - this.lastBoard > 15000) {
      this.lastBoard = time;
      this.remote.requestBoard();
      this.ui.board = this.remote.board;
    }
    if (isTouch) this.pinchZoom();
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
      if (time - this.lastSavedHint > 30000) {
        this.lastSavedHint = time;
        this.ui.savedHint();
        const st = safeStorage();
        if (st && !this.remote && !st.getItem('aschenthron.tip.save')) {
          st.setItem('aschenthron.tip.save', '1');
          this.ui.say('Das Spiel speichert von selbst. Mit F5 legst du einen eigenen Stand ab, mit F9 lädst du ihn wieder.');
        }
      }
    }
    {
      const me = this.player();
      if (me && (me.path.length > 0 || me.targetId !== null)) this.lastActivity = time;
    }
    if (settings().autoPickup && time - this.lastAutoPick > 250) {
      this.lastAutoPick = time;
      this.autoPickup(time);
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

  /** Bildschirmposition der Füße (Drehpunkt der Boden-Effekte aus pixelfx) */
  private feetPos(a: Actor | undefined): { x: number; y: number } | null {
    if (!a) return null;
    const pos = this.dispPos(a);
    const { sx, sy } = toScreen(pos.x, pos.y);
    return { x: sx, y: sy };
  }

  /**
   * Gedämpfter Bildschirmschimmer statt `cameras.main.flash` (der hellt bis Vollfarbe auf und sprengt den dunklen Look):
   * Farbfläche mit kleiner Deckkraft über allem, blendet aus.
   */
  private glow(color: number, alpha: number, ms: number, add = true): void {
    const { width, height } = this.scale;
    const r = this.add.rectangle(width / 2, height / 2, width * 3, height * 3, color, 1).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 2).setAlpha(alpha).setBlendMode(add ? 1 : 0);
    this.tweens.add({ targets: r, alpha: 0, duration: ms * this.ts, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
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
    const once = () => !fxSeen.has(tag) && !!fxSeen.add(tag);
    // pixelfx (gebacken, Drehpunkt = Füße); ohne Sheet die alten Code-Effekte. `from` überspringt den Vorlauf, der Treffer steht ja schon fest.
    const pfx = (n: FxName, p: { x: number; y: number } | null, o: { from?: number; depth?: number } = {}) => !!p && !!playPixelfx(this, n, p.x, p.y, { depth: o.depth ?? OVERLAY_DEPTH - 1, from: o.from });
    const feetFrom = this.feetPos(at);
    const feetTo = this.feetPos(tg);
    switch (e.skill) {
      case 'lightning':
        if (!pfx('lightning', feetTo, { from: 0.8 })) this.fx.bolt(to.x, to.y + 10, 0x9fc0ff);
        this.cameras.main.shake(120, 0.004);
        break;
      case 'whirlwind':
        if (once() && !pfx('whirl', feetFrom, { from: 0.05 })) {
          this.fx.ring(from.x, from.y + 18, 150, 0xe8e8f0, 320);
          this.fx.slash(from.x, from.y, 0xdadae8, 0);
          this.fx.slash(from.x, from.y, 0xdadae8, Math.PI);
        }
        break;
      case 'frost_nova':
      case 'glacial_burst':
        // pixelfx ist seitlich gezeichnet (flacher Bodenring): der runde Code-Ring zeigt zusätzlich die echte Wirkfläche
        if (once()) {
          this.fx.ring(from.x, from.y + 18, 210, 0x7fd0ff, 460);
          if (!pfx('frost_nova', feetFrom, { from: 0.4 })) this.fx.burst(from.x, from.y, 0xaee4ff, 520);
          if (e.skill === 'glacial_burst') this.cameras.main.shake(140, 0.005);
        }
        break;
      case 'shockwave':
        if (once()) {
          this.fx.ring(from.x, from.y + 18, 170, 0xe0a060, 380);
          pfx('slam', feetFrom);
          this.cameras.main.shake(160, 0.006);
        }
        break;
      case 'power_strike': this.fx.slash(to.x, to.y, 0xffe0a0, 0.3); break;
      case 'skull_split':
      case 'titan_blow':
      case 'execution':
        this.fx.slash(to.x, to.y, 0xff9a60, 0.3);
        if (!pfx('slam', feetTo)) this.fx.ring(to.x, to.y + 14, 60, 0xff9a60, 300);
        this.cameras.main.shake(130, e.skill === 'skull_split' ? 0.006 : 0.008);
        break;
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
              if (!settings().dmgNumbers) {
                /* Schadenszahlen aus */
              } else if (toPlayer) this.fx.floatText(pos.x, pos.y - 30, txt, dcol ?? '#ff6a5a', 18);
              else if (fromPlayer) this.fx.floatText(pos.x, pos.y - 26, txt, e.crit ? '#ffe45a' : poison ? '#8fe070' : dcol ?? '#ffffff', e.crit ? 22 : 15);
              else this.fx.floatText(pos.x, pos.y - 26, txt, dcol ?? '#cfcfcf', 12);
              const away = at && tg && at.id !== tg.id ? this.dispPos(tg).x - this.dispPos(at).x - (this.dispPos(tg).y - this.dispPos(at).y) : 0;
              // pixelfx: Funken in Schlagrichtung (nach rechts gebacken, bei Schlag von rechts gespiegelt); ohne Sheet der alte Funkenkranz
              if (e.amount > 0 && !playPixelfx(this, e.crit ? 'crit' : 'hit', pos.x, pos.y, { depth: OVERLAY_DEPTH - 1, flip: away < 0 })) {
                this.fx.burst(pos.x, pos.y, toPlayer ? 0xff5a4a : e.crit ? 0xffe45a : 0xffffff, 260);
              }
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
            const sxv = (t.x - a.x) * TILE_W;
            const syv = (t.y - a.y) * TILE_H;
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
                    // pixelfx-Einschlag am Boden unter dem Hauptziel; der Rauch blendet zum Ende hin aus
                    const fb = playPixelfx(this, 'fire_burst', primary.x, primary.y + 18, { depth: OVERLAY_DEPTH - 1 });
                    if (fb) this.tweens.add({ targets: fb, alpha: 0, delay: 700 * this.ts, duration: 600 * this.ts });
                    else this.fx.burst(primary.x, primary.y, 0xffa040, 520);
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
            this.glow(0xf2c94c, 0.14, 260);
          }
          else if (r === 'legendary' || r === 'set') this.achBump('legendary');
          if (r === 'legendary' || r === 'set') {
            this.sfx.legendary();
            this.ui.banner(`${r === 'legendary' ? 'Legendär' : 'Set-Teil'}: ${e.item.name}`, r === 'legendary' ? '#ff8a2a' : '#5fd070');
            this.glow(r === 'legendary' ? 0xff8a2a : 0x5fd070, 0.2, 360);
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
        case 'tooHeavy': {
          const me = this.player();
          say(`Zu schwer: ${e.item.name} (Tragkraft ${carriedWeight(me).toFixed(1)} / ${carryCapacity(me)}). Verkaufe oder lagere etwas ein, oder steigere Kraft.`);
          break;
        }
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
          // Vignette hängt an der eigenen Stufe: nach dem Aufstieg neu bewerten (ohne erneutes Zonenbanner)
          this.applyVignette(regionAt(w, this.player().x, this.player().y), this.player());
          this.achBump('level', e.level);
          say(`LEVEL ${e.level}! +5 Attributpunkte (C), +1 Skillpunkt`);
          this.sfx.levelUp();
          const pos = this.bodyPos(this.player());
          if (pos) {
            if (!playPixelfx(this, 'levelup', pos.x, pos.y + 20, { depth: OVERLAY_DEPTH - 1 })) this.fx.column(pos.x, pos.y + 20, 0xfff0a0, 1400);
            this.fx.ring(pos.x, pos.y + 20, 170, 0xfff0a0, 600);
          }
          this.ui.banner(`Stufe ${e.level}!`, '#ffe45a');
          break;
        }
        case 'learned': {
          const sk = SKILLS.find((s) => s.id === e.skillId);
          say(sk?.passive ? `${sk.name}: Rang ${e.rank ?? 1}` : `${sk?.name} gelernt!`);
          this.sfx.quest();
          // Säule 3: Skillgewinn spürbar – Runenkreis mit Lichtsäule am Helden, Banner, leiser violetter Schimmer
          {
            const f = this.feetPos(this.player());
            const rank = e.rank ?? 1;
            if (f && !playPixelfx(this, 'learn', f.x, f.y + 2, { depth: OVERLAY_DEPTH - 1, from: sk?.passive ? 1.0 : 0.5 })) {
              const pos = this.bodyPos(this.player());
              if (pos) this.fx.ring(pos.x, pos.y + 20, 140, 0xb07ade, 600);
            }
            if (sk) this.ui.banner(sk.passive ? `${sk.name} – Rang ${rank}` : `Neue Fertigkeit: ${sk.name}`, '#c8a0f0');
            if (sk && !sk.passive) this.ui.pulseSkill(sk.id);
            this.glow(0x8448b8, 0.12, 500);
          }
          // neuer aktiver Zauber landet im ersten freien Platz der Schnellleiste
          if (sk && !sk.passive) {
            const p = this.player();
            const bar = hotbarFor(p);
            if (!bar.includes(sk.id)) {
              const free = bar.indexOf(null);
              if (free >= 0) assignHotbar(p, free, sk.id);
            }
          }
          break;
        }
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
            const f = this.feetPos(this.player());
            if (!f || !playPixelfx(this, 'heal', f.x, f.y, { depth: OVERLAY_DEPTH - 1, scale: 2.5 })) this.fx.sparkle(pos.x, pos.y, 0x6fff9a);
            this.glow(0x1c6a34, 0.3, 450);
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
        case 'wildEvent':
          say(e.text);
          this.ui.banner(e.text.split(/[!:.]/)[0] + '!', e.color);
          this.sfx.boss();
          break;
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
          say(`Du bist gestorben: −${e.xpLost} XP. ${e.dropped.length ? `${e.dropped.length} Gegenstand/Gegenstände aus dem Rucksack liegen an der Todesstelle – hol sie innerhalb von 5 Minuten zurück. ` : ''}Angelegte Ausrüstung bleibt immer erhalten.`);
          if (this.achv.stats.deaths <= 1) say('Tipp: Du erwachst in der Stadt. Rasten (R) und Tränke (Q/E) retten dich im Kampf; fliehen ist keine Schande.');
          this.sfx.death();
          this.cameras.main.shake(300, 0.008);
          this.glow(0x3a0006, 0.5, 900, false);
          this.ui.banner('Du bist gefallen', '#c43a3a');
          break;
        case 'teleported':
          this.glow(0x8fb4ff, 0.22, 420);
          this.sfx.levelUp();
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
    this.updateRoofs(px, py);
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
    if (this.frame % 30 === 0) {
      this.marks = questMarks(this.world, p);
      this.step = nextStep(this.world, p);
      this.ui.step = this.step;
    }
    if (this.frame % 6 === 0) this.minimap.draw(p.x, p.y, this.marks);
    this.updateCompass(g, p, time);
    this.updateRegion(p);
  }

  /** Pfeil um die Figur zum nächsten Aufgabenziel (erst ab 10 Feldern Abstand); Entfernung daneben. */
  private updateCompass(g: Phaser.GameObjects.Graphics, p: Actor, time: number): void {
    const seen = new Set<string>();
    let best: { x: number; y: number; done: boolean } | null = null;
    let bd = Infinity;
    if (this.step?.x !== undefined && this.step.y !== undefined) {
      best = { x: this.step.x, y: this.step.y, done: this.step.kind === 'turnin' };
      bd = Math.hypot(best.x - p.x, best.y - p.y);
    } else for (const m of this.marks) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best && bd > 10) {
      const me = toScreen(this.dispPos(p).x, this.dispPos(p).y);
      const to = toScreen(best.x, best.y);
      const ang = Math.atan2(to.sy - me.sy, to.sx - me.sx);
      const r = 78 + Math.sin(time / 260) * 3;
      const cx = me.sx + Math.cos(ang) * r;
      const cy = me.sy - 14 + Math.sin(ang) * r;
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

  /** Schattenflammen-Aura hinter jedem lebenden Boss in Sichtweite; wird bei Wut glutrot. */
  private updateBossAuras(p: Actor): void {
    const keep = new Set<number>();
    if (this.frame % 30 === 0) this.nearBosses = this.world.actors.filter((a) => a.kind === 'monster' && a.boss && Math.hypot(a.x - p.x, a.y - p.y) <= 22);
    for (const a of this.nearBosses) {
      if (!a.alive || Math.hypot(a.x - p.x, a.y - p.y) > 18) continue;
      const v = this.actorViews.get(a.id);
      const f = this.feetPos(a);
      if (!v || !v.img.visible || !f) continue;
      keep.add(a.id);
      let au = this.bossAuras.get(a.id);
      if (au && au.rage !== a.enraged) {
        au.s.destroy();
        this.bossAuras.delete(a.id);
        au = undefined;
      }
      if (!au) {
        const s = playPixelfx(this, a.enraged ? 'boss_rage' : 'boss_aura', f.x, f.y + 8, { depth: v.img.depth - 0.5, alpha: 1, scale: 3.4, from: ((a.id * 0.53) % 1) * 2.4 });
        if (!s) continue;
        au = { s, rage: a.enraged };
        this.bossAuras.set(a.id, au);
      }
      au.s.setPosition(f.x, f.y + 8).setDepth(v.img.depth - 0.5);
    }
    for (const [id, au] of this.bossAuras) {
      if (keep.has(id)) continue;
      au.s.destroy();
      this.bossAuras.delete(id);
    }
  }

  /** Boss-Auftritt beim ersten Kontakt (höchstens alle 3 Minuten je Boss): Banner, dunkler Schimmer, Beben, Boss-Ton. */
  private bossIntro(p: Actor): void {
    for (const a of this.world.actors) {
      if (a.kind !== 'monster' || !a.boss || !a.alive || a.targetId !== p.id || Math.hypot(a.x - p.x, a.y - p.y) > 14) continue;
      const last = this.bossIntroAt.get(a.id);
      if (last !== undefined && this.now - last < 180_000) continue;
      this.bossIntroAt.set(a.id, this.now);
      this.ui.banner(a.name, '#ff7a4a');
      this.glow(0x3a0408, 0.35, 900, false);
      this.cameras.main.shake(220, 0.004);
      this.sfx.boss();
    }
  }

  /** Bossmusik, solange ein lebender Boss in der Nähe auf den Spieler zielt; sonst Stimmung der Zone. */
  private applyMusic(): void {
    const p = this.player();
    const boss = this.world.actors.some((a) => a.kind === 'monster' && a.boss && a.alive && a.targetId === p.id && Math.hypot(a.x - p.x, a.y - p.y) < 14);
    this.sfx.setMood(boss ? 'boss' : this.zoneMood);
  }

  /**
   * Bildrand je Zone; Säule 4: gefährliche Orte (Zone deutlich über der eigenen Stufe) färben ihn blutrot.
   * Liefert, ob die Zone gefährlich ist.
   */
  private applyVignette(hit: { name: string; levels?: string } | undefined, p: Actor): boolean {
    const dungeon = isDungeon(hit?.name ?? '');
    const lv = /^(\d+)-(\d+)$/.exec(hit?.levels ?? '');
    const danger = !!lv && Number(lv[1]) >= p.level + 3;
    this.vignette.style.background = danger
      ? `radial-gradient(ellipse at center,rgba(0,0,0,0) ${dungeon ? 30 : 50}%,rgba(34,0,4,${dungeon ? 0.88 : 0.62}) 100%)`
      : dungeon
        ? 'radial-gradient(ellipse at center,rgba(8,6,20,.15) 30%,rgba(2,0,10,.82) 100%)'
        : 'radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(0,0,0,.45) 100%)';
    return danger;
  }

  private updateRegion(p: Actor): void {
    if (this.frame % 30 === 0) {
      this.applyMusic();
      this.bossIntro(p);
    }
    // Dungeons liegen innerhalb der Landkarte; kleinste passende Zone gewinnt
    const hit = regionAt(this.world, p.x, p.y);
    const name = hit?.name ?? '';
    if (name !== this.regionName) {
      this.regionName = name;
      const dungeon = isDungeon(name);
      const danger = this.applyVignette(hit, p);
      this.atmo.setRegion(name);
      const ash = name === 'Aschenöde' || name === 'Aschengrund' || name === 'Thron der Asche';
      this.zoneMood = ash ? 'ash' : dungeon ? (name.includes('Moorhexe') || name === 'Katakomben' ? 'moor' : 'dungeon') : name === 'Aschenhafen' || name === 'Felsenwacht' ? 'town' : name === 'Moorlande' || name === 'Totenacker' ? 'moor' : 'field';
      this.applyMusic();
      this.sfx.ambient(name === 'Moorlande' || name === 'Gruft der Moorhexe' ? 'wind' : ash ? 'embers' : dungeon ? 'cave' : null);
      if (hit && danger) {
        this.ui.banner(`${hit.name} · Stufe ${hit.levels} – Gefahr!`, '#ff5a4a');
        this.glow(0x2a0004, 0.3, 800, false);
        this.sfx.warn();
      } else if (hit) this.ui.banner(`${hit.name}${hit.levels && hit.levels !== 'Stadt' ? ` · Stufe ${hit.levels}` : ''}`);
    }
  }

  private updateChunks(px: number, py: number): void {
    const { w, h } = this.world.grid;
    const cx0 = Math.max(0, Math.floor((px - VIEW) / CHUNK));
    const cx1 = Math.min(Math.floor((w - 1) / CHUNK), Math.floor((px + VIEW) / CHUNK));
    const cy0 = Math.max(0, Math.floor((py - VIEW) / CHUNK));
    const cy1 = Math.min(Math.floor((h - 1) / CHUNK), Math.floor((py + VIEW) / CHUNK));
    // Nur wenige Chunks pro Frame bauen (Ruckeln beim Überqueren von Chunk-Grenzen vermeiden); beim Start mehr
    let budget = this.frame < 3 ? 40 : 3;
    const t0 = performance.now();
    for (let cy = cy0; cy <= cy1 && budget > 0; cy++) {
      for (let cx = cx0; cx <= cx1 && budget > 0; cx++) {
        if (!this.chunks.has(`${cx}_${cy}`)) {
          this.makeChunk(cx, cy);
          budget--;
          // Ein Chunk kostet 10–25 ms: nach dem ersten nur weiterbauen, solange der Frame kurz bleibt
          if (this.frame >= 3 && performance.now() - t0 > 12) budget = 0;
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

  private zones(): Uint8Array {
    if (!this.zoneMap) this.zoneMap = buildZoneMap(this.world.regions, this.world.grid.w, this.world.grid.h);
    return this.zoneMap;
  }

  /** Abstand (Kacheln, 1..6) zur nächsten Landkachel; 6 = mindestens 6 */
  private landDistance(x: number, y: number): number {
    for (let r = 1; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const g = this.gidAt(x + dx, y + dy);
          if (g !== 6 && g !== 12 && g !== 0 && !WATER_PROP_GIDS.has(g)) return r;
        }
      }
    }
    return 6;
  }

  private nearDoor(x: number, y: number): boolean {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (this.gidAt(x + dx, y + dy) >= TOWN_GID.doorFirst) return true;
    return false;
  }

  private makeChunk(cx: number, cy: number): void {
    const { w, h } = this.world.grid;
    const zones = this.zones();
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const x1 = x0 + CHUNK - 1;
    const y1 = y0 + CHUNK - 1;
    const minSx = x0 * TILE_W - TILE_W / 2;
    const maxSx = (x1 + 1) * TILE_W - TILE_W / 2;
    const minSy = y0 * TILE_H - TILE_H / 2;
    const maxSy = (y1 + 1) * TILE_H - TILE_H / 2;
    const c = document.createElement('canvas');
    c.width = maxSx - minSx;
    c.height = maxSy - minSy;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = y0; y <= Math.min(y1, h - 1); y++) {
      for (let x = x0; x <= Math.min(x1, w - 1); x++) {
        const gid = this.tiles[y * w + x] ?? 0;
        if (!gid) continue;
        const ground = WATER_PROP_GIDS.has(gid) ? 6 : this.houseAt.has(y * w + x) ? 15 : PROP_GIDS.has(gid) ? this.groundUnder(x, y) : gid;
        const { sx, sy } = toScreen(x, y);
        const ox = sx - TILE_W / 2 - minSx;
        const oy = sy - TILE_H / 2 - minSy;
        const zone = zones[y * w + x] ?? 0;
        ctx.drawImage(tileCanvas(ground, hash(x, y) % TILE_VARIANTS, zone), ox, oy);
        this.dither(ctx, x, y, ground, zone, ox, oy);
      }
    }
    // Zweiter Durchlauf: sanfte Helligkeitsflecken und Bodendetails (Gras, Blumen, Kiesel, Knochen …) nur auf freien Kacheln
    for (let y = y0; y <= Math.min(y1, h - 1); y++) {
      for (let x = x0; x <= Math.min(x1, w - 1); x++) {
        const gid = this.tiles[y * w + x] ?? 0;
        if (!gid) continue;
        const zone = zones[y * w + x] ?? 0;
        const { sx, sy } = toScreen(x, y);
        const ox = sx - TILE_W / 2 - minSx;
        const oy = sy - TILE_H / 2 - minSy;
        if (gid === 6 || WATER_PROP_GIDS.has(gid)) {
          drawWaterTile(ctx, x, y, zone, this.landDistance(x, y), ox, oy, TILE_W);
          continue;
        }
        if (gid === 12) {
          const nl = (dx: number, dy: number): boolean => this.gidAt(x + dx, y + dy) !== 12;
          drawLavaTile(ctx, x, y, [nl(1, 0), nl(-1, 0), nl(0, 1), nl(0, -1)], ox, oy, TILE_W);
          continue;
        }
        if (PROP_GIDS.has(gid) || this.houseAt.has(y * w + x) || !biomeOf(gid, 0)) continue;
        const pn = patchNoise(x, y);
        if (Math.abs(pn) > 0.25) {
          ctx.fillStyle = pn > 0 ? `rgba(255,250,200,${(pn - 0.25) * 0.09})` : `rgba(0,20,30,${(-pn - 0.25) * 0.11})`;
          ctx.fillRect(ox, oy, TILE_W, TILE_H);
        }
        if (this.nearDoor(x, y)) continue;
        drawDetail(ctx, x, y, gid, zone, ox, oy, TILE_W);
      }
    }
    const key = `chunk_${cx}_${cy}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, c);
    this.chunks.set(`${cx}_${cy}`, this.add.image(minSx, minSy, key).setOrigin(0, 0).setDepth(-1e6));
  }

  /**
   * Übergang zwischen Bodenarten (Draufsicht): An jeder Kante zu einer anderen Bodenart schiebt die Nachbarkachel ihre
   * eigenen Randpixel 0 bis 2 Bildpunkte (je 3 Bildschirmpixel) in diese Kachel hinein. Die Tiefe wechselt pro Spalte
   * zufällig, so entsteht ein ausgefranster Rand ohne harte Gerade. Wasser und Lava bekommen selbst keinen Rand.
   */
  private dither(ctx: CanvasRenderingContext2D, x: number, y: number, ground: number, zone: number, ox: number, oy: number): void {
    if (ground === 6 || ground === 12) return;
    const px = TILE_W / 16;
    const DEPTH = [0, 1, 1, 2, 2, 1];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let ng = this.gidAt(x + dx, y + dy);
      if (WATER_PROP_GIDS.has(ng)) ng = 6;
      else if (this.houseAt.has((y + dy) * this.world.grid.w + x + dx)) ng = 15;
      else if (PROP_GIDS.has(ng)) ng = this.groundUnder(x + dx, y + dy);
      const nz = this.zones()[(y + dy) * this.world.grid.w + x + dx] ?? 0;
      if ((ng === ground && nz === zone) || ng === 0) continue;
      const nb = tileCanvas(ng, hash(x + dx, y + dy) % TILE_VARIANTS, nz);
      for (let i = 0; i < 16; i++) {
        const d = DEPTH[hash(x * 131 + i * 7 + dx * 3 + 11, y * 17 + dy * 5 + ground) % DEPTH.length]!;
        if (!d) continue;
        const t = d * px;
        if (dx === 1) ctx.drawImage(nb, 0, i * px, t, px, ox + TILE_W - t, oy + i * px, t, px);
        else if (dx === -1) ctx.drawImage(nb, TILE_W - t, i * px, t, px, ox, oy + i * px, t, px);
        else if (dy === 1) ctx.drawImage(nb, i * px, 0, px, t, ox + i * px, oy + TILE_H - t, px, t);
        else ctx.drawImage(nb, i * px, TILE_H - t, px, t, ox + i * px, oy, px, t);
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

  /** Erkennt die Häuser und legt Dach-Bilder an; ohne Ninja-Bilder bleibt die alte Hausgrafik. */
  private initHouses(): void {
    this.houses = [];
    this.houseAt.clear();
    this.roofs = [];
    if (!houseRoof(8, 6, 0)) return;
    const { w, h } = this.world.grid;
    this.houses = detectHouses(this.tiles, w, h);
    for (const hs of this.houses) {
      for (let dy = 0; dy < hs.h; dy++) {
        for (let dx = 0; dx < hs.w; dx++) {
          if (dx === 0 || dy === 0 || dx === hs.w - 1 || dy === hs.h - 1) this.houseAt.set((hs.y0 + dy) * w + hs.x0 + dx, hs);
        }
      }
      const seed = hs.x0 * 31 + hs.y0 * 17;
      const notch = this.roofNotch(hs);
      const key = ensureTexture(this, `nh_roof_${hs.x0}_${hs.y0}`, () => houseRoof(hs.w, hs.h - 1, hs.variant, seed, notch)!);
      const { sx, sy } = toScreen(hs.x0, hs.y0 - 1);
      const roof = this.add.image(sx - TILE_W / 2, sy - TILE_H / 2, key).setOrigin(0, 0).setDepth(this.roofDepth(hs));
      this.roofs.push({ img: roof, house: hs });
      const fkey = ensureTexture(this, `nh_fac_${hs.x0}_${hs.y0}`, () => houseFacade(hs.w, hs.variant, seed)!);
      const f = toScreen(hs.x0, hs.y0 + hs.h - 2);
      const fac = this.add.image(f.sx - TILE_W / 2, f.sy - TILE_H / 2, fkey).setOrigin(0, 0).setDepth(this.roofDepth(hs) + 1);
      this.roofs.push({ img: fac, house: hs });
      // Kleine Außendeko (reine Optik: keine Kollision, kein Sim-Einfluss)
      const free = (x: number, y: number): boolean => {
        const g = this.tiles[y * w + x] ?? 0;
        return x >= 0 && y >= 0 && x < w && y < h && g !== 0 && g !== 6 && g !== 12 && !PROP_GIDS.has(g) && !this.houseAt.has(y * w + x);
      };
      for (const dc of houseDecor(hs, free)) {
        const p = toScreen(dc.x, dc.y);
        if (dc.kind === 'fence') {
          const fk = ensureTexture(this, `nh_fence_${hs.variant % 2}`, () => houseFence(hs.variant)!);
          this.add.image(p.sx, p.sy + 6, fk).setOrigin(0.5, 1).setDepth(p.sy + 6);
        } else if (this.textures.exists(dc.kind === 'barrel' ? 'twn_barrel' : 'twn_crates')) {
          this.add.image(p.sx, p.sy + TILE_H / 2 - 5, dc.kind === 'barrel' ? 'twn_barrel' : 'twn_crates').setOrigin(0.5, 1).setDepth(p.sy + TILE_H / 2);
        }
      }
    }
  }

  /** Kerbe im Dach an der Türseite (N, O, W); Süd-Türen sitzen in der Vorderwand und brauchen keine. Zeilen zählen ab Dachkopf (Kachelzeile y0 - 1). */
  private roofNotch(hs: House): RoofNotch | null {
    const d = hs.door;
    if (!d || d.side === 'S') return null;
    if (d.side === 'N') return { col: d.x - hs.x0, row: 0, rows: 2 };
    return { col: d.side === 'W' ? 0 : hs.w - 1, row: d.y - hs.y0, rows: 2 };
  }

  /** Tiefe des Daches: über allen Figuren im Haus (Grundlinie der oberen Vorderwand), Figuren in der Türreihe stehen davor */
  private roofDepth(hs: House): number {
    return (hs.y0 + hs.h - 1) * TILE_H - 25;
  }

  /** Dach blendet auf 20 % aus, solange der Spieler im Haus (oder unter dem Dachüberstand im Norden) steht, auf 50 % vor der Tür. */
  private updateRoofs(px: number, py: number): void {
    for (const { img, house: hs } of this.roofs) {
      const inside = px >= hs.x0 && px <= hs.x0 + hs.w - 1 && py >= hs.y0 - 1 && py <= hs.y0 + hs.h - 1;
      // Vor der Tür (bis 2 Kacheln) wird das Dach halb durchsichtig, damit man die Leute im Haus sieht
      const d = hs.door;
      const near = !!d && Math.abs(px - d.x) <= 2 && Math.abs(py - d.y) <= 2;
      const target = inside ? 0.2 : near ? 0.5 : 1;
      if (Math.abs(img.alpha - target) > 0.01) img.setAlpha(img.alpha + (target - img.alpha) * 0.2);
      else img.setAlpha(target);
    }
  }

  /** Haus-Kachel (Wandring oder Tür): Südreihe als Vorderwand mit Fenstern, übrige Wand schlicht, Tür mit Schild. */
  private houseProp(x: number, y: number, gid: number, hs: House, sx: number, sy: number): Phaser.GameObjects.Image {
    const seed = hs.x0 * 31 + hs.y0 * 17;
    if (gid >= TOWN_GID.doorFirst && hs.door) {
      const side = hs.door.side;
      const tall = side !== 'N';
      const key = ensureTexture(this, `nh_door_${hs.door.icon}_${hs.variant}_${tall ? 't' : 's'}`, () => houseDoor(hs.door!.icon, hs.variant, tall, seed)!);
      if (!tall) {
        // Nordtür: das Schild hängt im Vorhof (Reihe davor), hinter der Figur, die davor steht
        const sk = ensureTexture(this, `nh_sign_${hs.door.icon}`, () => houseSign(hs.door!.icon)!);
        const idx = y * this.world.grid.w + x;
        if (!this.houseSigns.has(idx)) this.houseSigns.set(idx, this.add.image(sx, sy - TILE_H / 2, sk).setOrigin(0.5, 1).setDepth(sy - TILE_H + 6));
      }
      return this.add.image(sx, sy + TILE_H / 2, key).setOrigin(0.5, 1).setDepth(sy + TILE_H / 2);
    }
    const south = y === hs.y0 + hs.h - 1;
    const kind = south ? lowerKind(x - hs.x0, hs.w) : 'brace';
    const key = ensureTexture(this, `nh_lo_${kind}_${hs.variant}_${seed}`, () => houseWallTile('lower', kind, hs.variant, seed + x)!);
    return this.add.image(sx, sy + TILE_H / 2, key).setOrigin(0.5, 1).setDepth(sy + TILE_H / 2);
  }

  private makeProp(x: number, y: number, gid: number, sx: number, sy: number): Phaser.GameObjects.Image {
    const hs = this.houseAt.get(y * this.world.grid.w + x);
    if (hs) return this.houseProp(x, y, gid, hs, sx, sy);
    const v = hash(x, y);
    let key: string;
    let oy: number;
    let dy = 8;
    if (gid === 2) {
      const style = this.scanFor(x, y, 2, 5) ? 'dungeon' : this.scanFor(x, y, 2, 1) ? 'brick' : 'cliff';
      key = `wall_${style === 'cliff' && this.gidAt(x, y + 1) === 2 ? 'top' : style}_${v % WALL_VARIANTS}`;
      oy = 1;
      dy = TILE_H / 2;
    } else if (gid === 10) {
      key = `tree_${this.treeStyle(x, y, v)}_${v % 3}`;
      oy = 0.93;
      dy = 10;
    } else if (gid === 11) {
      key = `rock_${this.rockStyle(x, y)}_${v % 3}`;
      oy = 0.85;
    } else if (gid === 13) {
      key = `grave_${v % 3}`;
      oy = 0.88;
    } else if (gid >= TOWN_GID.wall && gid <= TOWN_GID.doorLast) {
      ({ key, oy, dy } = this.townProp(x, y, gid, v));
    } else {
      key = 'pillar';
      oy = 0.92;
    }
    // Ninja-Bilder sind unten zugeschnitten: Fuß unten Mitte, knapp über der Kachel-Unterkante
    if (NINJA_KEYS.has(key)) return this.add.image(sx, sy + TILE_H / 2 - (gid === 2 ? 0 : 5), key).setOrigin(0.5, 1).setDepth(sy + TILE_H / 2);
    return this.add.image(sx, sy + dy, key).setOrigin(0.5, oy).setDepth(sy + TILE_H / 2);
  }

  /** Baumart je Zone (Wald: Eichen/Kiefern gemischt, Moor/Friedhof tot, Hochland Kiefern, Asche verkohlt), sonst nach den Nachbarkacheln. */
  private treeStyle(x: number, y: number, v: number): string {
    const zone = this.zones()[y * this.world.grid.w + x] ?? 0;
    const r = (v >>> 5) % 100;
    switch (zone) {
      case Z.forest: return r < 38 ? 'pine' : r < 74 ? 'oak' : r < 88 ? 'oakr' : 'big';
      case Z.farm: return r < 12 ? 'pink' : r < 32 ? 'big' : 'oak';
      case Z.camp: return r < 30 ? 'dead' : r < 60 ? 'oakr' : 'oak';
      case Z.grave: case Z.swamp: return r < 85 ? 'dead' : 'oakr';
      case Z.hills: return r < 70 ? 'pine' : 'oakr';
      case Z.ash: case Z.grund: return 'char';
      default: return this.scanFor(x, y, 2, 3) ? 'dead' : this.scanFor(x, y, 2, 9) ? 'char' : this.scanFor(x, y, 2, 8) ? 'pine' : 'oak';
    }
  }

  private rockStyle(x: number, y: number): string {
    const zone = this.zones()[y * this.world.grid.w + x] ?? 0;
    if (zone === Z.hills || zone === Z.camp) return (hash(x, y) >>> 7) % 100 < 30 ? 'tan' : 'grey';
    if (zone === Z.ash || zone === Z.grund) return 'dark';
    return this.scanFor(x, y, 2, 9) ? 'dark' : 'grey';
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

  /** Sichtbare Höhe/Breite einer Ninja-Figurentextur (über den Füßen, in Bildpunkten); `null` bei DCSS-/prozeduralen Figuren. */
  private figSize(img: Phaser.GameObjects.Image): { top: number; w: number; dir: boolean } | null {
    const src = img.texture.getSourceImage() as { figTop?: number; figW?: number; figDir?: boolean } | undefined;
    return src && src.figTop !== undefined ? { top: src.figTop, w: src.figW ?? 0, dir: !!src.figDir } : null;
  }

  /** Legt eine Ninja-Textur an (false, wenn das Bild nicht geladen ist → Aufrufer nimmt die DCSS-Figur). */
  private addNinjaTexture(key: string, canvas: HTMLCanvasElement | null): boolean {
    if (!canvas) return false;
    this.textures.addCanvas(key, canvas);
    return true;
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
      const nj = ninjaNpcDef(n.kind, n.name);
      const chestLike = n.kind === 'stash' && !nj;
      this.gfxGround.fillStyle(0x000000, 0.2);
      this.gfxGround.fillEllipse(sx, sy + 9, chestLike ? 34 : 26, chestLike ? 13 : 10);
      let dir = this.npcDir.get(n.id);
      if (!dir) {
        dir = { x: np.x, y: np.y, flip: false, side: false, up: false, movingUntil: 0 };
        this.npcDir.set(n.id, dir);
      }
      const ndx = np.x - dir.x;
      const ndy = np.y - dir.y;
      if (Math.abs(ndx) + Math.abs(ndy) > 0.001) {
        dir.movingUntil = time + 160;
        if (Math.abs(ndx) > 0.0005) dir.flip = ndx < 0;
        dir.side = Math.abs(ndx) > Math.abs(ndy) * 0.8;
        if (Math.abs(ndy) > 0.0005) dir.up = ndy < 0;
      }
      dir.x = np.x;
      dir.y = np.y;
      if (!chestLike) {
        const nf = time < dir.movingUntil ? WALK_FRAMES[Math.floor(time / STEP_MS) % 4]! : 0;
        const nSide = dir.side;
        const nk = npcTextureKey(n.kind, n.name);
        // Ninja-Figur (4 Blickrichtungen, Seitenbild nach rechts); fehlt das Bild oder ist der Modus dcss, die DCSS-Figur wie bisher
        const nBack = dir.up && !nSide;
        const njKey = nj ? `nnpc_${nj.sheet}_${nj.tint ?? 0}_${nf}${nBack ? 'b' : ''}${nSide ? 's' : ''}` : '';
        if (nj && (this.textures.exists(njKey) || this.addNinjaTexture(njKey, ninjaNpcCanvas(n.kind, n.name, nf, nBack, nSide)))) {
          img.setTexture(njKey);
        } else {
          img.setTexture(ensureTexture(this, nSide ? `${nk}_${nf}s` : nf ? `${nk}_${nf}` : nk, () => (nSide ? npcCanvas(n.kind, n.name, nf, true) : npcCanvas(n.kind, n.name, nf))));
        }
        const nfig = this.figSize(img);
        img.setFlipX(nfig?.dir ? nSide && dir.flip : dir.flip);
      }
      const nBob = !chestLike && time < dir.movingUntil ? -Math.abs(Math.sin((time / STEP_MS) * Math.PI * 0.5)) * 1.2 : 0;
      img.setPosition(sx, sy + 8 + nBob).setDepth(sy + 8);
      this.label(`n${n.id}`, n.name, sx, sy + 8 - (this.figSize(img)?.top ?? 56) - 4, '#e8d9b0', seen);
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
    // Fundstücke offener Suchaufgaben funkeln (nur in Sichtweite, nur ungefundene)
    if (this.frame % 40 === 0) {
      for (const f of this.world.finds) {
        const st = me.quests[f.quest];
        if (st?.state !== 'active' || st.found?.includes(f.id) || Math.abs(f.x - px) > VIEW || Math.abs(f.y - py) > VIEW) continue;
        const { sx, sy } = toScreen(f.x, f.y);
        this.fx.sparkle(sx, sy, 0xffe9a0, 1200);
      }
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
      const beamName = r === 'normal' ? undefined : (`loot_${r}` as FxName);
      let beam = this.lootBeams.get(gi.id);
      if (beamName && !beam) {
        // Sheets sind schon je Seltenheit eingefärbt (Kern in der hellsten Seltenheitsfarbe); kein setTint und keine additive
        // Mischung, sonst wird alles auf hellem Boden weiß.
        // Startphase je Beutestück versetzt, damit viele Strahlen nicht im Gleichtakt pulsieren.
        beam = playPixelfx(this, beamName, sx, sy + 4, { depth: sy + 5, alpha: { magic: 0.7, rare: 0.9, set: 0.95, legendary: 1 }[r as 'magic'], from: ((gi.id * 0.37) % 1) * 2.4 });
        if (beam) this.lootBeams.set(gi.id, beam);
      }
      beam?.setPosition(sx, sy + 4).setDepth(sy + 5);
      if (r !== 'normal' && !beam) {
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
        this.lootBeams.get(id)?.destroy();
        this.lootBeams.delete(id);
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
        // Bildschirm-Richtung: Draufsicht, Kachelschritt = Bildschirmschritt
        const screenDx = dx;
        if (Math.abs(screenDx) > 0.0005) view.flip = screenDx < 0;
        const screenDy = dy;
        view.side = Math.abs(screenDx) > Math.abs(screenDy) * 0.8;
        if (Math.abs(screenDy) > 0.0005) view.up = screenDy < 0;
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
        img.setTexture(ensureTexture(this, lookKey(look, frame, !!view.up && !view.side, !!view.side), () => playerCanvas(look, frame, !!view.up && !view.side, !!view.side)));
      } else {
        const k = monsterKind(a.kindId!);
        const key = `mon_${k.id}_${frame}${view.up && !view.side ? 'b' : ''}${view.side ? 's' : ''}`;
        img.setTexture(ensureTexture(this, key, () => monsterCanvas(k.id, k.family, k.color, !!k.boss, frame, !!view.up && !view.side, !!view.side)));
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
      const fig = this.figSize(img);
      if (a.alive) {
        const wide = fig ? Math.max(16, Math.min(56, fig.w * 0.55)) : a.boss ? 46 : a.kind === 'monster' && (monsterKind(a.kindId!).family === 'beast' || monsterKind(a.kindId!).family === 'spider') ? 30 : a.kind === 'monster' && monsterKind(a.kindId!).family === 'golem' ? 34 : 22;
        this.gfxGround.fillStyle(0x000000, 0.18);
        this.gfxGround.fillEllipse(sx + ox, sy + 9 + oy, wide * 1.25, wide * 0.5);
        this.gfxGround.fillStyle(0x000000, 0.22);
        this.gfxGround.fillEllipse(sx + ox, sy + 9 + oy, wide * 0.85, wide * 0.34);
      }
      img.setVisible(true).setPosition(sx + ox, sy + 8 + oy + bob).setDepth(sy + 8).setFlipX(
        // DCSS-Monster blicken von Haus aus nach links; nur die vorab gespiegelte Seitenansicht (Zweibeiner) blickt nach rechts
        fig ? (fig.dir ? !!view.side && view.flip : view.flip) : a.kind === 'monster' && !(view.side && BIPED.has(monsterKind(a.kindId!).family)) ? !view.flip : view.flip,
      );
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
        const top = sy + 8 - (fig ? fig.top + 8 : a.boss ? 110 : 62);
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
        if (a.id !== p.id) this.label(`a${a.id}`, `${a.name} (Lv ${a.level})${a.pkUntil > this.world.tick ? ' ☠' : ''}`, sx, sy + 8 - (fig ? fig.top + 12 : 66), a.pkUntil > this.world.tick ? '#ff5a4a' : '#9fd0ff', seen);
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
    this.updateBossAuras(p);
    // Figuren, die es in der Welt nicht mehr gibt (entfernte Beschwörungen, gegangene Spieler): Bild und Zwischenspeicher freigeben
    if (this.frame % 120 === 0) {
      const present = new Set(this.world.actors.map((x) => x.id));
      for (const [id, v] of this.actorViews) {
        if (present.has(id)) continue;
        v.img.destroy();
        this.actorViews.delete(id);
        this.prevPos.delete(id);
        this.interp.delete(id);
        this.disp.delete(id);
        this.kicks.delete(id);
        this.flash.delete(id);
      }
    }
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
    // Namen wachsen beim Herauszoomen mit, damit sie auf dem Bildschirm mindestens ~9 px groß bleiben (Handy: Zoom bis 0.4);
    // beim Standard-Zoom 0.75 bleibt der Faktor 1 (kein unscharfes Hochskalieren)
    const k = Math.max(1, 9 / (size * this.cameras.main.zoom));
    if (t.scaleX !== k) t.setScale(k);
    t.setPosition(Math.round(x), Math.round(y)).setVisible(settings().labels || id[0] === 'm' || size > 12);
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
