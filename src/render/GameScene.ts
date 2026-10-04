import Phaser from 'phaser';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { monsterKind, questById, SKILLS } from '../sim/data';
import { exportPlayer, importPlayer } from '../sim/save';
import {
  applyCommand, drainEvents, getActor, maxHpOf, maxManaOf, tick, TICK_RATE, type Actor, type Command, type Npc, type World,
} from '../sim/world';
import { isWalkable } from '../sim/path';
import { toScreen, toTile } from './iso';
import { Ui, describeItem } from './ui';
import { Sfx } from './audio';
import { Minimap } from './minimap';
import type { RemoteSession } from '../net/client';
import {
  ensureTexture, lookOf, monsterCanvas, playerCanvas, registerStaticArt, tileCanvas, TILE_H, TILE_VARIANTS, TILE_W, WALL_VARIANTS,
} from './art';

const SAVE_KEY = 'aschenthron.save.v1';
const VIEW = 30;
const CHUNK = 16;
const PROP_GIDS = new Set([2, 10, 11, 13, 14]);
const OVERLAY_DEPTH = 1e7;

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
  private flash = new Map<number, number>();
  private acc = 0;
  private autosave = 0;
  private frame = 0;
  private ui!: Ui;
  private sfx!: Sfx;
  private minimap!: Minimap;
  private regionName = '';
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
    if (!this.remote && new URLSearchParams(location.search).has('neu')) {
      store?.removeItem(SAVE_KEY);
      history.replaceState(null, '', location.pathname);
    }
    const saved = store?.getItem(SAVE_KEY);
    const p = this.player();
    this.ui = new Ui((c) => this.send(c), (i) => this.useSkillSlot(i), (k) => this.usePotionKind(k), () => this.newGame());
    this.sfx = new Sfx();
    this.minimap = new Minimap(this.world, this.tiles);
    if (this.remote) this.ui.say(`Verbunden als ${p.name}${this.remote.pvp ? ' – PvP außerhalb der Städte aktiv, Angreifer werden zu Mördern' : ''}. Klick auf Spieler greift an.`);
    else if (saved && importPlayer(this.world, p, saved)) this.ui.say('Spielstand geladen.');
    else this.ui.say('Willkommen in Aschenthron. C: Charakter (Attributpunkte verteilen!) · Q/E: Heil-/Manatrank · N: Karte · M: Ton · Klick: laufen/angreifen/aufheben · Lehrer, Händlerin, Schmiede, Truhe und Aufgaben in der Stadt.');
    this.gfx = this.add.graphics().setDepth(OVERLAY_DEPTH);
    this.cameras.main.setBackgroundColor('#0b0a0d');
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onClick(ptr));
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

  private useSkillSlot(i: number): void {
    const p = this.player();
    const id = p.skills[i];
    if (!id) return;
    const s = SKILLS.find((x) => x.id === id)!;
    let target = p.targetId !== null ? getActor(this.world, p.targetId) : undefined;
    if (!target || !target.alive) {
      target = this.world.actors
        .filter((a) => a.kind === 'monster' && a.alive && Math.hypot(a.x - p.x, a.y - p.y) <= s.range)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    }
    if (target) this.send({ type: 'useSkill', skillId: id, targetId: target.id });
    else this.ui.say('Kein Ziel in Reichweite.');
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

  private onClick(ptr: Phaser.Input.Pointer): void {
    const t = toTile(ptr.worldX, ptr.worldY);
    const w = this.world;
    const npc = w.npcs.find((n) => Math.hypot(n.x - t.x, n.y - (t.y + 0.5)) < 1);
    if (npc) {
      this.ui.toggle(true);
      this.send({ type: 'moveTo', x: Math.round(npc.x), y: Math.round(npc.y + 1) });
      return;
    }
    const loot = w.ground.find((g) => Math.hypot(g.x - t.x, g.y - t.y) < 0.8);
    if (loot) return this.send({ type: 'pickup', groundId: loot.id });
    const target = w.actors.find((a) => a.id !== this.playerId && a.alive && (a.kind === 'monster' || this.remote !== null) && Math.hypot(a.x - t.x, a.y - (t.y + 0.5)) < 1);
    if (target) return this.send({ type: 'attack', targetId: target.id });
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
    this.handleEvents(time);
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
  }

  /* ------------------------------------------------------------ Ereignisse */

  private handleEvents(time: number): void {
    const say = (m: string) => this.ui.say(m);
    const w = this.world;
    for (const e of this.remote ? this.remote.drainEvents() : drainEvents(w)) {
      switch (e.type) {
        case 'hit': {
          this.flash.set(e.targetId, time + 110);
          const sk = e.skill ? SKILLS.find((s) => s.id === e.skill) : undefined;
          if (e.attackerId === this.playerId) {
            say(`Du triffst für ${e.amount}${e.crit ? ' (KRITISCH!)' : ''}${sk ? ` (${sk.name})` : ''}`);
            if (sk) this.sfx.cast(sk.area);
            else this.sfx.hit();
          } else if (e.targetId === this.playerId) {
            say(`Du erleidest ${e.amount} Schaden`);
            this.sfx.hurt();
          }
          break;
        }
        case 'died':
          if (e.id !== this.playerId) {
            say(`${getActor(w, e.id)?.name ?? 'Monster'} besiegt.`);
            this.sfx.kill();
          }
          break;
        case 'loot': say(`Beute: ${e.item.name}`); break;
        case 'pickedUp': say(`Erhalten: ${e.item.name} (${describeItem(e.item)})`); this.sfx.pickup(); break;
        case 'tooHeavy': say(`Zu schwer: ${e.item.name}`); break;
        case 'cannotEquip': say(`${e.item.name}: ${e.reason}`); break;
        case 'xp': say(`+${e.amount} XP`); break;
        case 'gold': say(`+${e.amount} Gold`); this.sfx.coin(); break;
        case 'levelUp': say(`LEVEL ${e.level}! +5 Attributpunkte (C)`); this.sfx.levelUp(); break;
        case 'learned': say(`Gelernt: ${SKILLS.find((s) => s.id === e.skillId)?.name}`); this.sfx.quest(); break;
        case 'enraged': say(`${getActor(w, e.id)?.name} wird wütend!`); this.sfx.boss(); break;
        case 'healed': say(`Du heilst dich um ${e.amount}.`); this.sfx.potion(); break;
        case 'crafted': say(`Geschmiedet: ${e.item.name}`); this.sfx.pickup(); break;
        case 'potion': say(`Benutzt: ${e.item.name}`); this.sfx.potion(); break;
        case 'questProgress': say(`Aufgabe: ${e.progress}/${e.count}`); break;
        case 'questDone': say(`Aufgabe erfüllt: ${questById(e.questId)?.name} – beim Auftraggeber abgeben!`); this.sfx.quest(); break;
        case 'questTurned': say(`Aufgabe abgegeben: +${e.xp} XP, +${e.gold} Gold`); this.sfx.quest(); break;
        case 'deathPenalty':
          say(`Du bist gestorben: −${e.xpLost} XP, ${e.dropped.length} Item(s) liegen an der Todesstelle (5 Min.).`);
          this.sfx.death();
          break;
        case 'respawned': say('Du erwachst in der Stadt.'); break;
        case 'fail': say(e.reason); break;
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
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    this.updateChunks(px, py);
    this.updateProps(px, py);
    this.updateNpcs(time);
    this.updateLoot(time, g);
    this.updateActors(time, p, g);
    for (const r of this.world.safe) this.outline(g, r.x, r.y, r.w, r.h);
    const cp = this.camPos ?? p;
    const { sx, sy } = toScreen(cp.x, cp.y);
    this.cameras.main.centerOn(Math.round(sx), Math.round(sy - 14));
    if (this.frame % 6 === 0) this.minimap.draw(p.x, p.y);
    this.updateRegion(p);
  }

  private updateRegion(p: Actor): void {
    // Dungeons liegen innerhalb der Landkarte; kleinste passende Zone gewinnt
    const hit = this.world.regions
      .filter((r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const name = hit?.name ?? '';
    if (name !== this.regionName) {
      this.regionName = name;
      if (hit) this.ui.banner(`${hit.name}${hit.levels && hit.levels !== 'Stadt' ? ` · Stufe ${hit.levels}` : ''}`);
    }
  }

  private updateChunks(px: number, py: number): void {
    const { w, h } = this.world.grid;
    const cx0 = Math.max(0, Math.floor((px - VIEW) / CHUNK));
    const cx1 = Math.min(Math.floor((w - 1) / CHUNK), Math.floor((px + VIEW) / CHUNK));
    const cy0 = Math.max(0, Math.floor((py - VIEW) / CHUNK));
    const cy1 = Math.min(Math.floor((h - 1) / CHUNK), Math.floor((py + VIEW) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (!this.chunks.has(`${cx}_${cy}`)) this.makeChunk(cx, cy);
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
        ctx.drawImage(tileCanvas(ground, hash(x, y) % TILE_VARIANTS), sx - TILE_W / 2 - minSx, sy - TILE_H / 2 - minSy);
      }
    }
    const key = `chunk_${cx}_${cy}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, c);
    this.chunks.set(`${cx}_${cy}`, this.add.image(minSx, minSy, key).setOrigin(0, 0).setDepth(-1e6));
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
        img = this.add.image(sx, sy + 8, `npc_${n.kind}`).setOrigin(0.5, 0.93);
        this.npcViews.set(n.id, img);
      }
      img.setPosition(sx, sy + 8).setDepth(sy + 8);
      this.label(`n${n.id}`, n.name, sx, sy - 52, '#e8d9b0', seen);
      const mark = this.questMark(n, p);
      if (mark) this.label(`m${n.id}`, mark, sx, sy - 70 + Math.sin(time / 200) * 2, mark === '!' ? '#ffe45a' : '#7fe08a', seen, 22);
    }
    this.cleanLabels(seen, ['n', 'm']);
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
    for (const gi of this.world.ground) {
      live.add(gi.id);
      const { sx, sy } = toScreen(gi.x, gi.y);
      let img = this.lootViews.get(gi.id);
      if (!img) {
        img = this.add.image(sx, sy, `loot_${gi.item.rarity}`).setOrigin(0.5, 0.7);
        this.lootViews.set(gi.id, img);
      }
      const bob = Math.sin(time / 280 + gi.id) * 2;
      img.setPosition(sx, sy + 2 + bob).setDepth(sy + 4);
      if (gi.item.rarity !== 'normal') {
        const col = { magic: 0x6f8fff, rare: 0xf2c94c, set: 0x5fd070, legendary: 0xff8a2a }[gi.item.rarity as 'magic'];
        g.fillStyle(col, 0.18);
        g.fillRect(sx - 6, sy - 56, 12, 56);
        g.fillStyle(col, 0.28);
        g.fillRect(sx - 3, sy - 56, 6, 56);
      }
    }
    for (const [id, img] of this.lootViews) {
      if (!live.has(id)) {
        img.destroy();
        this.lootViews.delete(id);
      }
    }
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
        view = { img: this.add.image(sx, sy, 'pillar').setOrigin(0.5, 0.92), lastX: pos.x, lastY: pos.y, movingUntil: 0, flip: false };
        this.actorViews.set(a.id, view);
      }
      const dx = pos.x - view.lastX;
      const dy = pos.y - view.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) {
        view.movingUntil = time + 160;
        // Bildschirm-Richtung: iso x-y
        const screenDx = dx - dy;
        if (Math.abs(screenDx) > 0.0005) view.flip = screenDx < 0;
      }
      view.lastX = pos.x;
      view.lastY = pos.y;
      const frame = time < view.movingUntil ? Math.floor(time / 140) % 2 : 0;
      const img = view.img;
      if (a.kind === 'player') {
        const look = lookOf(a);
        const key = `pl_${look.chest}_${look.head}_${look.weapon}_${look.hands}_${frame}`;
        img.setTexture(ensureTexture(this, key, () => playerCanvas(look, frame)));
      } else {
        const k = monsterKind(a.kindId!);
        const key = `mon_${k.id}_${frame}`;
        img.setTexture(ensureTexture(this, key, () => monsterCanvas(k.id, k.family, k.color, !!k.boss, frame)));
      }
      img.setVisible(true).setPosition(sx, sy + 8).setDepth(sy + 8).setFlipX(view.flip);
      if (!a.alive) {
        img.setAngle(view.flip ? -90 : 90).setAlpha(0.55).setTint(0x664444);
        img.setDepth(sy);
        continue;
      }
      img.setAngle(0).setAlpha(1);
      if ((this.flash.get(a.id) ?? 0) > time) img.setTint(0xff7070);
      else if (a.enraged) img.setTint(0xff9a8a);
      else img.clearTint();
      if (a.kind === 'monster') {
        const big = a.boss ? 56 : 28;
        const top = sy + 8 - (a.boss ? 110 : 62);
        g.fillStyle(0x200000, 0.9);
        g.fillRect(sx - big / 2, top, big, 5);
        g.fillStyle(a.boss ? 0xe8832a : 0xd44a3a, 1);
        g.fillRect(sx - big / 2, top, big * Math.max(0, a.hp / a.maxHp), 5);
        if (a.boss || a.id === p.targetId) this.label(`a${a.id}`, a.name, sx, top - 10, a.boss ? '#ff9a4a' : '#e6cfcf', seen);
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
