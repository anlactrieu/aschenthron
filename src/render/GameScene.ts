import Phaser from 'phaser';
import mapJson from '../data/aschenthron.json';
import { buildWorld, type TiledMap } from '../sim/tiled';
import { monsterKind, questById, SKILLS } from '../sim/data';
import { exportPlayer, importPlayer } from '../sim/save';
import {
  applyCommand, drainEvents, getActor, inSafeZone, maxHpOf, maxManaOf, tick, TICK_RATE, type Actor, type Command, type World,
} from '../sim/world';
import { isWalkable } from '../sim/path';
import { TILE_H, TILE_W, toScreen, toTile } from './iso';
import { Ui, describeItem } from './ui';

const SAVE_KEY = 'aschenthron.save.v1';
const TILE_COLORS: Record<number, [number, number]> = {
  1: [0x3a3438, 0x35303a], 7: [0x4a4034, 0x453b30], 8: [0x3a3d36, 0x363932], 9: [0x3c3230, 0x382e2c], 12: [0x8a3a1a, 0x7a3216], 10: [0x2b3526, 0x273122], 11: [0x2e2a33, 0x2a262f], 3: [0x2c3a2f, 0x28362b], 4: [0x2b3526, 0x273122], 5: [0x2e2a33, 0x2a262f], 6: [0x1c2a3d, 0x1c2a3d],
};
const RARITY = { normal: 0xc9c4bd, magic: 0x6f8fff, rare: 0xf2c94c };
const VIEW = 32;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private tiles: number[] = [];
  private playerId = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private acc = 0;
  private autosave = 0;
  private ui!: Ui;
  private resetting = false;

  constructor() {
    super('game');
  }

  create(): void {
    const built = buildWorld(Date.now() >>> 0, mapJson as unknown as TiledMap);
    this.world = built.world;
    this.tiles = built.tiles;
    this.playerId = built.playerId;
    const store = safeStorage();
    if (new URLSearchParams(location.search).has('neu')) {
      store?.removeItem(SAVE_KEY);
      history.replaceState(null, '', location.pathname);
    }
    const saved = store?.getItem(SAVE_KEY);
    const p = this.player();
    this.ui = new Ui((c) => this.send(c), (i) => this.useSkillSlot(i), (k) => this.usePotionKind(k), () => this.newGame());
    if (saved && importPlayer(this.world, p, saved)) this.ui.say('Spielstand geladen.');
    else this.ui.say('Willkommen in Aschenthron. C: Charakter (Attributpunkte verteilen!) · Q/E: Heil-/Manatrank · Klick: laufen/angreifen/aufheben · Lehrer, Händlerin und Truhe in der Stadt.');
    this.gfx = this.add.graphics();
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
    applyCommand(this.world, this.playerId, c);
  }

  private newGame(): void {
    this.resetting = true;
    safeStorage()?.removeItem(SAVE_KEY);
    location.reload();
  }

  private save(): void {
    if (this.resetting) return;
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
    const npc = w.npcs.find((n) => Math.hypot(n.x - t.x, n.y - t.y) < 1);
    if (npc) {
      this.ui.toggle(true);
      this.send({ type: 'moveTo', x: Math.round(npc.x), y: Math.round(npc.y + 1) });
      return;
    }
    const loot = w.ground.find((g) => Math.hypot(g.x - t.x, g.y - t.y) < 0.8);
    if (loot) return this.send({ type: 'pickup', groundId: loot.id });
    const target = w.actors.find((a) => a.kind === 'monster' && a.alive && Math.hypot(a.x - t.x, a.y - (t.y + 0.5)) < 1);
    if (target) return this.send({ type: 'attack', targetId: target.id });
    const x = Math.floor(t.x + 0.5);
    const y = Math.floor(t.y + 0.5);
    if (isWalkable(w.grid, x, y)) this.send({ type: 'moveTo', x, y });
  }

  update(_t: number, dt: number): void {
    this.acc += Math.min(dt, 250);
    const step = 1000 / TICK_RATE;
    while (this.acc >= step) {
      this.acc -= step;
      tick(this.world);
    }
    this.handleEvents();
    this.autosave += dt;
    if (this.autosave > 5000) {
      this.autosave = 0;
      this.save();
    }
    const p = this.player();
    const tgt = p.targetId !== null ? getActor(this.world, p.targetId) : undefined;
    this.ui.update(this.world, p, tgt);
    this.draw();
  }

  private handleEvents(): void {
    const say = (m: string) => this.ui.say(m);
    for (const e of drainEvents(this.world)) {
      switch (e.type) {
        case 'hit':
          if (e.attackerId === this.playerId) say(`Du triffst für ${e.amount}${e.skill ? ` (${SKILLS.find((s) => s.id === e.skill)?.name})` : ''}`);
          else if (e.targetId === this.playerId) say(`Du erleidest ${e.amount} Schaden`);
          break;
        case 'died':
          if (e.id !== this.playerId) say(`${getActor(this.world, e.id)?.name ?? 'Monster'} besiegt.`);
          break;
        case 'loot': say(`Beute: ${e.item.name}`); break;
        case 'pickedUp': say(`Erhalten: ${e.item.name} (${describeItem(e.item)})`); break;
        case 'tooHeavy': say(`Zu schwer: ${e.item.name}`); break;
        case 'cannotEquip': say(`${e.item.name}: ${e.reason}`); break;
        case 'xp': say(`+${e.amount} XP`); break;
        case 'gold': say(`+${e.amount} Gold`); break;
        case 'levelUp': say(`LEVEL ${e.level}! +5 Attributpunkte (C)`); break;
        case 'learned': say(`Gelernt: ${SKILLS.find((s) => s.id === e.skillId)?.name}`); break;
        case 'enraged': say(`${getActor(this.world, e.id)?.name} wird wütend!`); break;
        case 'deathPenalty':
          say(`Du bist gestorben: −${e.xpLost} XP, ${e.dropped.length} Item(s) liegen an der Todesstelle (5 Min.).`);
          break;
        case 'potion': say(`Benutzt: ${e.item.name}`); break;
        case 'questProgress': say(`Aufgabe: ${e.progress}/${e.count}`); break;
        case 'questDone': say(`Aufgabe erfüllt: ${questById(e.questId)?.name} – beim Auftraggeber abgeben!`); break;
        case 'questTurned': say(`Aufgabe abgegeben: +${e.xp} XP, +${e.gold} Gold`); break;
        case 'respawned': say('Du erwachst in der Stadt.'); break;
        case 'fail': say(e.reason); break;
      }
    }
  }

  private draw(): void {
    const g = this.gfx;
    const w = this.world;
    const p = this.player();
    g.clear();
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const { w: gw, h: gh } = w.grid;
    const view = this.cameras.main.worldView;
    for (let y = Math.max(0, cy - VIEW); y < Math.min(gh, cy + VIEW); y++) {
      for (let x = Math.max(0, cx - VIEW); x < Math.min(gw, cx + VIEW); x++) {
        const gid = this.tiles[y * gw + x] ?? 0;
        if (!gid) continue;
        const { sx, sy } = toScreen(x, y);
        if (sx < view.left - 64 || sx > view.right + 64 || sy < view.top - 64 || sy > view.bottom + 64) continue;
        if (gid === 2) this.drawBlock(g, sx, sy);
        else if (gid === 10 || gid === 11) {
          this.diamond(g, sx, sy, TILE_COLORS[gid]![(x + y) % 2]!);
          if (gid === 10) this.prop(g, sx, sy, 0x1f3a22, 0x2f5a30, 34);
          else this.prop(g, sx, sy, 0x55505a, 0x77727c, 14);
        }
        else this.diamond(g, sx, sy, TILE_COLORS[gid]?.[(x + y) % 2] ?? 0x222222);
      }
    }
    for (const r of w.safe) this.outline(g, r.x, r.y, r.w, r.h);

    for (const gi of w.ground) {
      const { sx, sy } = toScreen(gi.x, gi.y);
      g.fillStyle(RARITY[gi.item.rarity], 1);
      g.fillTriangle(sx, sy - 12, sx + 8, sy, sx - 8, sy);
      g.fillTriangle(sx, sy + 6, sx + 8, sy, sx - 8, sy);
    }
    for (const n of w.npcs) {
      const { sx, sy } = toScreen(n.x, n.y);
      const col = { trainer: 0xd8a24a, merchant: 0x6ac08a, stash: 0x9a7a5a, quest: 0xe8e060, smith: 0xc06a4a }[n.kind];
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(sx, sy, 26, 11);
      g.fillStyle(col, 1);
      if (n.kind === 'stash') g.fillRect(sx - 12, sy - 18, 24, 18);
      else g.fillRect(sx - 8, sy - 30, 16, 30);
    }
    const seen = new Set<number>();
    for (const n of w.npcs) this.label(n.id, n.name, toScreen(n.x, n.y), -44, '#e8d9b0', seen);
    const actors = [...w.actors].sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const a of actors) {
      if (Math.abs(a.x - p.x) > VIEW || Math.abs(a.y - p.y) > VIEW) continue;
      this.drawActor(g, a);
    }
    for (const a of actors) {
      if (a.kind === 'monster' && a.alive && (a.boss || a.id === p.targetId)) this.label(a.id, a.name, toScreen(a.x, a.y), -52, a.boss ? '#ff9a4a' : '#e6cfcf', seen);
    }
    for (const [id, t] of this.labels) if (!seen.has(id)) { t.destroy(); this.labels.delete(id); }
    const { sx, sy } = toScreen(p.x, p.y);
    this.cameras.main.centerOn(sx, sy);
  }

  private label(id: number, text: string, pos: { sx: number; sy: number }, dy: number, color: string, seen: Set<number>): void {
    seen.add(id);
    let t = this.labels.get(id);
    if (!t) {
      t = this.add.text(0, 0, text, { fontSize: '12px', color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(5);
      this.labels.set(id, t);
    }
    t.setPosition(pos.sx, pos.sy + dy);
  }

  private pool = [0, 1, 2, 3].map(() => new Phaser.Math.Vector2());

  /** Zeichnet ein Viereck mit wiederverwendeten Punkten (vermeidet Allokationen pro Kachel und Frame). */
  private quad(g: Phaser.GameObjects.Graphics, color: number, c: number[]): void {
    g.fillStyle(color, 1);
    for (let i = 0; i < 4; i++) this.pool[i]!.set(c[i * 2]!, c[i * 2 + 1]!);
    g.fillPoints(this.pool, true);
  }

  private diamond(g: Phaser.GameObjects.Graphics, sx: number, sy: number, color: number): void {
    this.quad(g, color, [sx, sy - TILE_H / 2, sx + TILE_W / 2, sy, sx, sy + TILE_H / 2, sx - TILE_W / 2, sy]);
  }

  private drawBlock(g: Phaser.GameObjects.Graphics, sx: number, sy: number): void {
    const h = 20;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    this.quad(g, 0x3a302d, [sx - hw, sy, sx, sy + hh, sx, sy + hh - h, sx - hw, sy - h]);
    this.quad(g, 0x2c2422, [sx + hw, sy, sx, sy + hh, sx, sy + hh - h, sx + hw, sy - h]);
    this.diamond(g, sx, sy - h, 0x4b3f3a);
  }

  /** Einfaches Platzhalter-Objekt (Baum/Fels) auf einer Kachel */
  private prop(g: Phaser.GameObjects.Graphics, sx: number, sy: number, dark: number, light: number, h: number): void {
    this.quad(g, dark, [sx - 9, sy + 2, sx, sy + 7, sx + 9, sy + 2, sx, sy - h]);
    this.quad(g, light, [sx - 7, sy, sx, sy - 5, sx + 7, sy, sx, sy - h]);
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

  private drawActor(g: Phaser.GameObjects.Graphics, a: Actor): void {
    const { sx, sy } = toScreen(a.x, a.y);
    if (!a.alive) {
      if (this.world.tick - a.diedAt < TICK_RATE * 3 && a.kind === 'monster') {
        g.fillStyle(0x3b2a2a, 1);
        g.fillEllipse(sx, sy, 28, 12);
      }
      return;
    }
    const k = a.kind === 'monster' ? monsterKind(a.kindId!) : null;
    const size = a.boss ? 1.8 : 1;
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(sx, sy, 26 * size, 11 * size);
    g.fillStyle(a.kind === 'player' ? 0x6aa0d8 : a.enraged ? 0xff3a2a : k!.color, 1);
    g.fillRect(sx - 8 * size, sy - 30 * size, 16 * size, 30 * size);
    const maxHp = a.kind === 'player' ? 1 : a.maxHp;
    if (a.kind === 'monster') {
      g.fillStyle(0x300000, 1);
      g.fillRect(sx - 14, sy - 34 * size - 6, 28, 4);
      g.fillStyle(0xd44a3a, 1);
      g.fillRect(sx - 14, sy - 34 * size - 6, 28 * Math.max(0, a.hp / maxHp), 4);
    }
    if (a.kind === 'player' && inSafeZone(this.world, a.x, a.y)) {
      g.lineStyle(1, 0xd8a24a, 0.6);
      g.strokeEllipse(sx, sy, 34, 15);
    }
  }
}
