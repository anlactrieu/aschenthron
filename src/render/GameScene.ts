import Phaser from 'phaser';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { monsterKind, questById, SKILLS } from '../sim/data';
import { exportPlayer, importPlayer } from '../sim/save';
import {
  applyCommand, drainEvents, getActor, maxHpOf, maxManaOf, tick, TICK_RATE, type Actor, type Chest, type Command, type Npc, type World,
} from '../sim/world';
import { isWalkable } from '../sim/path';
import { toScreen, toTile } from './iso';
import { Ui, describeItem } from './ui';
import { Sfx } from './audio';
import { Minimap } from './minimap';
import { Fx } from './fx';
import type { RemoteSession } from '../net/client';
import {
  ensureTexture, tileBase, FEET_ORIGIN_Y, lookOf, monsterCanvas, playerCanvas, registerStaticArt, tileCanvas, TILE_H, TILE_VARIANTS, TILE_W, WALL_VARIANTS,
} from './art';

const SAVE_KEY = 'aschenthron.save.v1';
const VIEW = 30;
const CHUNK = 16;
const PROP_GIDS = new Set([2, 10, 11, 13, 14]);
const OVERLAY_DEPTH = 1e7;
/** Dauer eines Hiebs/Wurfs in ms (Ausholen 40 %, Schlag 60 %) */
const SWING_MS = 240;

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
  private autosave = 0;
  private frame = 0;
  private ui!: Ui;
  private sfx!: Sfx;
  private minimap!: Minimap;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private fx!: Fx;
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
  private ts = 1;
  private timers: { at: number; fn: () => void }[] = [];
  private fireballs = new Map<number, { impacts: (() => void)[]; target: number }>();
  private regionName = '';
  private armedSkill: string | null = null;
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
      this.tiles = built.tiles;
      this.playerId = built.playerId;
    }
    registerStaticArt(this);
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
    this.ui = new Ui((c) => this.send(c), (i) => this.useSkillSlot(i), (k) => this.usePotionKind(k), () => this.newGame());
    this.sfx = new Sfx();
    this.minimap = new Minimap(this.world, this.tiles);
    if (this.remote) this.ui.say(`Verbunden als ${p.name}${this.remote.pvp ? ' – PvP außerhalb der Städte aktiv, Angreifer werden zu Mördern' : ''}. Klick auf Spieler greift an.`);
    else if (saved && importPlayer(this.world, p, saved)) this.ui.say('Spielstand geladen.');
    else this.ui.say('Willkommen in Aschenthron. Dein Startgold reicht für eine Wahl: Schwert und Rüstung (Händlerin) oder Bogen, Pfeile und Schnellschuss (Händlerin + Lehrer). C: Charakter (Attributpunkte verteilen!) · Q/E: Heil-/Manatrank · R: Rasten · N: Karte · M: Ton · Klick: laufen/angreifen/aufheben · Lehrer, Händlerin, Schmiede, Truhe und Aufgaben in der Stadt.');
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
    this.input.mouse?.disableContextMenu();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setArmed(null);
    });
    window.addEventListener('beforeunload', () => {
      if (!this.resetting) this.save();
    });
  }

  private player(): Actor {
    return getActor(this.world, this.playerId)!;
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
    const id = p.skills[i];
    if (!id) return;
    const s = SKILLS.find((x) => x.id === id)!;
    if (s.heal !== undefined || s.aoeSelf) {
      this.setArmed(null);
      this.send({ type: 'useSkill', skillId: id });
      return;
    }
    if (this.armedSkill === id) return this.setArmed(null);
    this.setArmed(id);
    this.ui.say(`${s.name} gewählt – Ziel anklicken (Rechtsklick oder Esc: abbrechen).`);
  }

  private setArmed(id: string | null): void {
    this.armedSkill = id;
    this.ui.setArmed(id);
    this.game.canvas.style.cursor = id ? 'crosshair' : '';
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
    for (const n of this.world.npcs) {
      const img = this.npcViews.get(n.id);
      if (!img) continue;
      const b = img.getBounds();
      // Box nach oben und seitlich erweitern: Namensschild und Marker gehören zum Anklickbaren
      const box = new Phaser.Geom.Rectangle(b.centerX - 55, b.top - 64, 110, b.height + 64);
      if (box.contains(wx, wy) && (!best || img.depth > best.depth)) best = { depth: img.depth, npc: n };
    }
    return best;
  }

  private onClick(ptr: Phaser.Input.Pointer): void {
    const t = toTile(ptr.worldX, ptr.worldY);
    const w = this.world;
    const hit = this.pick(ptr.worldX, ptr.worldY);
    if (this.armedSkill) {
      if (ptr.rightButtonDown()) return this.setArmed(null);
      if (hit?.actor) return this.send({ type: 'useSkill', skillId: this.armedSkill, targetId: hit.actor.id });
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

  update(time: number, dt: number): void {
    if (this.remote) {
      if (this.remote.closed && !this.ended) {
        this.ended = true;
        this.ui.say('Verbindung zum Server verloren. Seite neu laden.');
      }
    } else {
      this.acc += Math.min(dt, 250);
      const step = 1000 / TICK_RATE;
      while (this.acc >= step) {
        this.acc -= step;
        tick(this.world);
      }
    }
    this.now = time;
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
              const txt = e.crit ? `${e.amount}!` : String(e.amount);
              if (toPlayer) this.fx.floatText(pos.x, pos.y - 30, txt, '#ff6a5a', 18);
              else if (fromPlayer) this.fx.floatText(pos.x, pos.y - 26, txt, e.crit ? '#ffe45a' : poison ? '#8fe070' : '#ffffff', e.crit ? 22 : 15);
              else this.fx.floatText(pos.x, pos.y - 26, txt, '#cfcfcf', 12);
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
            if (e.crit || (tg?.boss && fromPlayer)) this.cameras.main.shake(70, e.crit ? 0.004 : 0.0025);
            if (toPlayer) this.cameras.main.shake(60, 0.002);
            if (fromPlayer) {
              if (sk) this.sfx.cast(sk.area);
              else this.sfx.hit();
            } else if (toPlayer) this.sfx.hurt();
          };
          // Der Angreifer holt sichtbar aus (Ausholen → Schlag/Wurf), erst dann trifft es; Gift/Brand/Bodenschlag nicht
          let delay = 0;
          const ambient = e.skill === 'dot' || e.skill === 'slam';
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
              if (to && f && at) this.fx.slash(to.x, to.y, at.kind === 'player' ? 0xf0f0ff : 0xffb0a0, (f.x <= to.x ? 0 : Math.PI) + (at.kind === 'player' ? 0 : 0.5));
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
                const col = { quick_shot: 0xe8d8a0, multishot: 0xe8d8a0, poison_shot: 0x7fe060, ember_bolt: 0xff8a2a }[e.skill as 'quick_shot'];
                if (arrowSkill) this.fx.arrow(f.x, f.y, to.x, to.y, col, 170, impact);
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
          this.cameras.main.shake(180, 0.004);
          say(`${boss?.name} ruft Verstärkung!`);
          this.sfx.boss();
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
            if (dead?.boss) say(`${dead.name} besiegt.`);
          }
          break;
        }
        case 'loot': {
          const r = e.item.rarity;
          if (r === 'legendary' || r === 'set') {
            this.sfx.legendary();
            this.ui.banner(`${r === 'legendary' ? 'Legendär' : 'Set-Teil'}: ${e.item.name}`, r === 'legendary' ? '#ff8a2a' : '#5fd070');
            this.cameras.main.flash(220, r === 'legendary' ? 255 : 120, r === 'legendary' ? 150 : 255, 60);
            say(`Beute: ${e.item.name}!`);
          } else if (r === 'rare') say(`Beute: ${e.item.name}`);
          break;
        }
        case 'respecced': say('Alles neu verteilt: Attribute und Fertigkeiten sind zurückgesetzt.'); this.sfx.quest(); break;
        case 'chestOpened': {
          this.sfx.chest();
          const ch = w.chests.find((c) => c.id === e.chestId);
          if (ch) {
            const { sx, sy } = toScreen(ch.x, ch.y);
            this.fx.burst(sx, sy - 8, 0xffe890, 600);
            this.fx.sparkle(sx, sy - 6, 0xffe890, 900);
          }
          break;
        }
        case 'pickedUp': say(`Erhalten: ${e.item.name} (${describeItem(e.item)})`); this.sfx.pickup(); break;
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
        case 'crafted': say(`Geschmiedet: ${e.item.name}`); this.sfx.pickup(); break;
        case 'potion': {
          const pos = this.bodyPos(this.player());
          if (pos) this.fx.sparkle(pos.x, pos.y, e.item.heal ? 0xff6a7a : 0x6a8aff);
          say(`Benutzt: ${e.item.name}`);
          this.sfx.potion();
          break;
        }
        case 'questProgress': say(`Aufgabe: ${e.progress}/${e.count}`); break;
        case 'questDone': say(`Aufgabe erfüllt: ${questById(e.questId)?.name} – beim Auftraggeber abgeben!`); this.sfx.quest(); break;
        case 'questTurned': say(`Aufgabe abgegeben: +${e.xp} XP, +${e.gold} Gold`); this.sfx.quest(); break;
        case 'deathPenalty':
          say(`Du bist gestorben: −${e.xpLost} XP, ${e.dropped.length} Item(s) liegen an der Todesstelle (5 Min.).`);
          this.sfx.death();
          this.cameras.main.shake(300, 0.008);
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
    this.fx.setAmbient(this.ambientKind, this.cameras.main.worldView, time - this.lastTime);
    this.lastTime = time;
    this.fx.update(time, g);
    const cp = this.camPos ?? p;
    const { sx, sy } = toScreen(cp.x, cp.y);
    this.cameras.main.centerOn(Math.round(sx), Math.round(sy - 14));
    if (this.frame % 6 === 0) this.minimap.draw(p.x, p.y);
    this.updateRegion(p);
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
    if (hit?.actor) cursor = 'crosshair';
    else if (hit?.npc || hit?.chest) cursor = 'pointer';
    else {
      const t = toTile(wp.x, wp.y);
      if (this.world.ground.some((gi) => Math.hypot(gi.x - t.x, gi.y - t.y) < 0.8)) cursor = 'pointer';
    }
    if (cursor !== this.cursor) {
      this.cursor = cursor;
      this.input.setDefaultCursor(cursor || 'default');
    }
  }

  private updateRegion(p: Actor): void {
    // Dungeons liegen innerhalb der Landkarte; kleinste passende Zone gewinnt
    const hit = this.world.regions
      .filter((r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const name = hit?.name ?? '';
    if (name !== this.regionName) {
      this.regionName = name;
      const dungeon = ['Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche'].includes(name);
      this.vignette.style.background = dungeon
        ? 'radial-gradient(ellipse at center,rgba(8,6,20,.15) 30%,rgba(2,0,10,.82) 100%)'
        : 'radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(0,0,0,.45) 100%)';
      this.ambientKind = name === 'Aschenöde' || name === 'Thron der Asche' ? 'embers' : name === 'Moorlande' || name === 'Gruft der Moorhexe' ? 'mist' : null;
      this.sfx.ambient(name === 'Moorlande' || name === 'Gruft der Moorhexe' ? 'wind' : name === 'Aschenöde' || name === 'Thron der Asche' ? 'embers' : dungeon ? 'cave' : null);
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
        const ground = PROP_GIDS.has(gid) ? this.groundUnder(x, y) : gid;
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
      if (PROP_GIDS.has(ng)) ng = this.groundUnder(x + dx, y + dy);
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
    } else {
      key = 'pillar';
      oy = 0.92;
    }
    return this.add.image(sx, sy + dy, key).setOrigin(0.5, oy).setDepth(sy + TILE_H / 2);
  }

  private updateNpcs(time: number): void {
    const p = this.player();
    const seen = new Set<string>();
    for (const n of this.world.npcs) {
      let img = this.npcViews.get(n.id);
      const { sx, sy } = toScreen(n.x, n.y);
      if (!img) {
        img = this.add.image(sx, sy + 8, `npc_${n.kind}`).setOrigin(0.5, FEET_ORIGIN_Y);
        this.npcViews.set(n.id, img);
      }
      this.gfxGround.fillStyle(0x000000, 0.2);
      this.gfxGround.fillEllipse(sx, sy + 9, n.kind === 'stash' ? 34 : 26, n.kind === 'stash' ? 13 : 10);
      img.setPosition(sx, sy + 8).setDepth(sy + 8);
      this.label(`n${n.id}`, n.name, sx, sy - 52, '#e8d9b0', seen);
      const mark = this.questMark(n, p);
      if (mark) this.label(`m${n.id}`, mark, sx, sy - 70 + Math.sin(time / 200) * 2, mark === '!' ? '#ffe45a' : '#7fe08a', seen, 22);
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
      if (!st && def && p.level >= def.minLevel) avail = true;
    }
    return avail ? '!' : '';
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
      // Beutenamen in Seltenheitsfarbe: magisch und besser immer in der Nähe, Normales nur nah oder unter dem Mauszeiger
      const near = Math.hypot(gi.x - p.x, gi.y - p.y);
      const hov = hoverTile && Math.hypot(gi.x - hoverTile.x, gi.y - hoverTile.y) < 0.9;
      if (near < 12 && (r !== 'normal' || near < 5 || hov) && k >= 1) {
        this.label(`l${gi.id}`, gi.item.name, sx, sy - (r === 'legendary' ? 24 : 18), '#' + col.toString(16).padStart(6, '0'), seen, r === 'normal' ? 11 : 12);
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
      const frame = swinging ? (swingK < 0.4 ? 2 : 3) : time < view.movingUntil ? Math.floor(time / 140) % 2 : 0;
      const img = view.img;
      if (a.kind === 'player') {
        const look = lookOf(a);
        const key = `pl_${look.chest}_${look.head}_${look.weapon}_${look.hands}_${look.weaponKind}_${look.robe ? 1 : 0}_${look.quiver ? 1 : 0}_${frame}${view.up ? 'b' : ''}`;
        img.setTexture(ensureTexture(this, key, () => playerCanvas(look, frame, !!view.up)));
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
      const bob = walking ? -Math.abs(Math.sin(time / 140 * Math.PI * 0.5)) * 2.4 : 0;
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
        img.setAngle(view.flip ? -90 : 90).setAlpha(Math.max(0, 0.6 - age * 0.6)).setTint(0x664444).setScale(1);
        img.setDepth(sy);
        continue;
      }
      // leichtes Atmen, wenn sie stehen
      img.setAngle(0).setAlpha(1).setScale(1, 1);
      if ((this.flash.get(a.id) ?? 0) > time) img.setTint(0xffffff);
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

  /** Anzeigeposition: lokal exakt, online geglättet zwischen den 10-Hz-Schnappschüssen. */
  private dispPos(a: Actor): { x: number; y: number } {
    if (!this.remote) return a;
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
