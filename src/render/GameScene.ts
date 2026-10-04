import Phaser from 'phaser';
import { applyCommand, createWorld, drainEvents, spawnMonster, spawnPlayer, tick, TICK_RATE, type Actor, type Command, type World } from '../sim/world';
import { InventoryPanel, describeItem } from './InventoryPanel';
import { isWalkable, type Grid } from '../sim/path';
import { TILE_H, TILE_W, toScreen, toTile } from './iso';

function buildGrid(): Grid {
  const w = 20;
  const h = 20;
  const walkable = new Array<boolean>(w * h).fill(true);
  for (let i = 0; i < w; i++) {
    walkable[i] = walkable[(h - 1) * w + i] = false;
    walkable[i * w] = walkable[i * w + w - 1] = false;
  }
  for (let y = 5; y < 14; y++) walkable[y * w + 10] = false;
  return { w, h, walkable };
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private playerId = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private acc = 0;
  private log!: Phaser.GameObjects.Text;
  private msgs: string[] = [];
  private panel!: InventoryPanel;

  constructor() {
    super('game');
  }

  create(): void {
    this.world = createWorld(Date.now() >>> 0, buildGrid());
    this.playerId = spawnPlayer(this.world, 3, 3).id;
    spawnMonster(this.world, 15, 12);
    spawnMonster(this.world, 14, 4);
    this.panel = new InventoryPanel((c: Command) => applyCommand(this.world, this.playerId, c));
    this.gfx = this.add.graphics();
    this.log = this.add.text(12, 10, '', { color: '#c9b79c', fontSize: '14px' }).setScrollFactor(0).setDepth(10);
    this.cameras.main.setBackgroundColor('#0b0a0d');
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p));
    this.say('Linksklick: laufen · Monster: angreifen · Beute: aufheben · I: Inventar');
  }

  private say(m: string): void {
    this.msgs.push(m);
    this.msgs = this.msgs.slice(-5);
    this.log.setText(this.msgs.join('\n'));
  }

  private onClick(p: Phaser.Input.Pointer): void {
    const t = toTile(p.worldX, p.worldY);
    const loot = this.world.ground.find((g) => Math.hypot(g.x - t.x, g.y - t.y) < 0.8);
    if (loot) {
      applyCommand(this.world, this.playerId, { type: 'pickup', groundId: loot.id });
      return;
    }
    const target = this.world.actors.find(
      (a) => a.kind === 'monster' && a.alive && Math.hypot(a.x - t.x, a.y - t.y) < 0.9,
    );
    if (target) {
      applyCommand(this.world, this.playerId, { type: 'attack', targetId: target.id });
      return;
    }
    const x = Math.floor(t.x + 0.5);
    const y = Math.floor(t.y + 0.5);
    if (isWalkable(this.world.grid, x, y)) applyCommand(this.world, this.playerId, { type: 'moveTo', x, y });
  }

  update(_t: number, dt: number): void {
    this.acc += dt;
    const step = 1000 / TICK_RATE;
    while (this.acc >= step) {
      this.acc -= step;
      tick(this.world);
    }
    for (const e of drainEvents(this.world)) {
      if (e.type === 'hit') this.say(`${e.attackerId === this.playerId ? 'Du triffst' : 'Treffer auf dich'}: ${e.amount}`);
      if (e.type === 'died') this.say(e.id === this.playerId ? 'Du bist gestorben.' : 'Monster besiegt.');
      if (e.type === 'loot') this.say(`Beute: ${e.item.name}`);
      if (e.type === 'pickedUp') this.say(`Aufgehoben: ${e.item.name} (${describeItem(e.item)})`);
      if (e.type === 'tooHeavy') this.say(`Zu schwer: ${e.item.name}`);
      if (e.type === 'cannotEquip') this.say(`${e.item.name}: ${e.reason}`);
    }
    const pl = this.world.actors.find((a) => a.id === this.playerId);
    if (pl) this.panel.update(pl);
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const { grid } = this.world;
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const { sx, sy } = toScreen(x, y);
        const ok = isWalkable(grid, x, y);
        g.fillStyle(ok ? ((x + y) % 2 ? 0x2a2630 : 0x26222c) : 0x4b3f3a, 1);
        g.beginPath();
        g.moveTo(sx, sy - TILE_H / 2);
        g.lineTo(sx + TILE_W / 2, sy);
        g.lineTo(sx, sy + TILE_H / 2);
        g.lineTo(sx - TILE_W / 2, sy);
        g.closePath();
        g.fillPath();
      }
    }
    const COLORS = { normal: 0xc9c4bd, magic: 0x6f8fff, rare: 0xf2c94c };
    for (const gi of this.world.ground) {
      const { sx, sy } = toScreen(gi.x, gi.y);
      g.fillStyle(COLORS[gi.item.rarity], 1);
      g.fillTriangle(sx, sy - 12, sx + 8, sy, sx - 8, sy);
      g.fillTriangle(sx, sy + 6, sx + 8, sy, sx - 8, sy);
    }
    const sorted = [...this.world.actors].sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const a of sorted) this.drawActor(g, a);
    const p = this.world.actors.find((a) => a.id === this.playerId);
    if (p) {
      const { sx, sy } = toScreen(p.x, p.y);
      this.cameras.main.centerOn(sx, sy);
    }
  }

  private drawActor(g: Phaser.GameObjects.Graphics, a: Actor): void {
    const { sx, sy } = toScreen(a.x, a.y);
    if (!a.alive) {
      g.fillStyle(0x3b2a2a, 1);
      g.fillEllipse(sx, sy, 28, 12);
      return;
    }
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(sx, sy, 26, 11);
    g.fillStyle(a.kind === 'player' ? 0x6aa0d8 : 0xb0463c, 1);
    g.fillRect(sx - 8, sy - 30, 16, 30);
    g.fillStyle(0x300000, 1);
    g.fillRect(sx - 14, sy - 40, 28, 4);
    g.fillStyle(a.kind === 'player' ? 0x58b05c : 0xd44a3a, 1);
    g.fillRect(sx - 14, sy - 40, 28 * (a.hp / a.maxHp), 4);
  }
}
