import Phaser from 'phaser';

/**
 * Kampf-Juice, nur Darstellung: schwebende Zahlen, Projektile, Ringe, Blitze, Schlagbögen, Funken, Lichtsäulen
 * und Umgebungspartikel. Gezeichnet auf dem Overlay-Graphics der Szene, Texte aus einem Pool.
 */

interface Effect {
  kind: 'projectile' | 'arrow' | 'ring' | 'bolt' | 'slash' | 'sparkle' | 'column' | 'burst' | 'beamRing';
  start: number;
  dur: number;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  color: number;
  seed: number;
  onArrive?: () => void;
  arrived?: boolean;
}

interface FloatText {
  t: Phaser.GameObjects.Text;
  start: number;
  dur: number;
  x: number;
  y: number;
  vy: number;
  grow: number;
  active: boolean;
}

interface Ambient {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
  mist: boolean;
}

const DEPTH = 1e7 + 3;

export class Fx {
  private effects: Effect[] = [];
  private floats: FloatText[] = [];
  private ambient: Ambient[] = [];
  private now = 0;
  private seedCounter = 1;

  constructor(private scene: Phaser.Scene, private timeScale = 1) {}

  private seed(): number {
    this.seedCounter = (this.seedCounter * 1664525 + 1013904223) >>> 0;
    return this.seedCounter;
  }

  private rnd(seed: number, i: number): number {
    let t = (seed + i * 0x9e3779b9) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  floatText(x: number, y: number, text: string, color: string, size = 14, dur = 950): void {
    dur *= this.timeScale;
    let f = this.floats.find((q) => !q.active);
    if (!f) {
      const t = this.scene.add.text(0, 0, '', { fontSize: '14px', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH);
      f = { t, start: 0, dur: 0, x: 0, y: 0, vy: 0, grow: 1, active: false };
      this.floats.push(f);
    }
    const jitter = (this.seed() % 17) - 8;
    f.active = true;
    f.start = this.now;
    f.dur = dur;
    f.x = x + jitter;
    f.y = y;
    f.vy = -38;
    f.grow = size > 16 ? 1.25 : 1;
    f.t.setText(text).setColor(color).setFontSize(size).setVisible(true).setAlpha(1).setPosition(f.x, f.y);
  }

  private add(e: Omit<Effect, 'start' | 'seed'>): void {
    this.effects.push({ ...e, dur: e.dur * this.timeScale, start: this.now, seed: this.seed() });
    if (this.effects.length > 160) this.effects.shift();
  }

  projectile(x: number, y: number, x2: number, y2: number, color: number, dur = 170, onArrive?: () => void): void {
    this.add({ kind: 'projectile', x, y, x2, y2, dur, color, onArrive });
  }
  /** Pfeil: Schaft mit Spitze und Befiederung, fliegt in Blickrichtung. */
  arrow(x: number, y: number, x2: number, y2: number, color: number, dur = 170, onArrive?: () => void): void {
    this.add({ kind: 'arrow', x, y, x2, y2, dur, color, onArrive });
  }
  ring(x: number, y: number, radius: number, color: number, dur = 380): void {
    this.add({ kind: 'ring', x, y, r: radius, dur, color });
  }
  bolt(x: number, y: number, color: number): void {
    this.add({ kind: 'bolt', x, y, dur: 260, color });
  }
  slash(x: number, y: number, color: number, angle = 0): void {
    this.add({ kind: 'slash', x, y, r: angle, dur: 220, color });
  }
  sparkle(x: number, y: number, color: number, dur = 700): void {
    this.add({ kind: 'sparkle', x, y, dur, color });
  }
  column(x: number, y: number, color: number, dur = 1100): void {
    this.add({ kind: 'column', x, y, dur, color });
  }
  burst(x: number, y: number, color: number, dur = 420): void {
    this.add({ kind: 'burst', x, y, dur, color });
  }

  /** Umgebungspartikel (Glut, Nebel) im Sichtfeld der Kamera; kind null = keine. */
  setAmbient(kind: 'embers' | 'mist' | null, view: Phaser.Geom.Rectangle, dt: number): void {
    if (kind) {
      const want = kind === 'embers' ? 46 : 10;
      while (this.ambient.length < want && this.ambient.length < 60) {
        const s = this.seed();
        const mist = kind === 'mist';
        this.ambient.push({
          x: view.left + this.rnd(s, 1) * view.width,
          y: view.top + this.rnd(s, 2) * view.height,
          vx: mist ? 6 + this.rnd(s, 3) * 8 : -6 + this.rnd(s, 3) * 12,
          vy: mist ? -1 : -18 - this.rnd(s, 4) * 22,
          life: 0,
          max: mist ? 9000 : 2600 + this.rnd(s, 5) * 2400,
          size: mist ? 90 + this.rnd(s, 6) * 90 : 1.5 + this.rnd(s, 6) * 1.5,
          color: mist ? 0x9fb8a8 : this.rnd(s, 7) < 0.5 ? 0xff8a2a : 0xffc860,
          mist,
        });
      }
    }
    const dts = dt / 1000;
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const p = this.ambient[i]!;
      p.life += dt;
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      const out = p.x < view.left - 200 || p.x > view.right + 200 || p.y < view.top - 200 || p.y > view.bottom + 200;
      if (p.life > p.max || out || (!kind && this.ambient.length > 0 && p.life > 600)) this.ambient.splice(i, 1);
    }
  }

  update(now: number, g: Phaser.GameObjects.Graphics): void {
    this.now = now;
    // schwebende Texte
    for (const f of this.floats) {
      if (!f.active) continue;
      const k = (now - f.start) / f.dur;
      if (k >= 1) {
        f.active = false;
        f.t.setVisible(false);
        continue;
      }
      const ease = 1 - (1 - k) * (1 - k);
      f.t.setPosition(f.x, f.y + f.vy * ease * 1.6).setAlpha(k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35);
      f.t.setScale(f.grow > 1 && k < 0.15 ? 1 + (1 - k / 0.15) * 0.5 : 1);
    }
    // Umgebung
    for (const p of this.ambient) {
      const a = Math.min(1, p.life / 500) * Math.min(1, (p.max - p.life) / 700);
      g.fillStyle(p.color, p.mist ? 0.07 * a : 0.85 * a);
      if (p.mist) g.fillEllipse(p.x, p.y, p.size * 2, p.size * 0.7);
      else g.fillRect(p.x, p.y, p.size, p.size);
    }
    // Effekte
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      const k = (now - e.start) / e.dur;
      if (k >= 1) {
        if ((e.kind === 'projectile' || e.kind === 'arrow') && !e.arrived) e.onArrive?.();
        this.effects.splice(i, 1);
        continue;
      }
      this.drawEffect(g, e, k);
      if ((e.kind === 'projectile' || e.kind === 'arrow') && k > 0.92 && !e.arrived) {
        e.arrived = true;
        e.onArrive?.();
      }
    }
  }

  private drawEffect(g: Phaser.GameObjects.Graphics, e: Effect, k: number): void {
    const fade = 1 - k;
    switch (e.kind) {
      case 'projectile': {
        const x = e.x + (e.x2! - e.x) * k;
        const y = e.y + (e.y2! - e.y) * k;
        for (let t = 1; t <= 4; t++) {
          const kk = Math.max(0, k - t * 0.06);
          g.fillStyle(e.color, 0.5 - t * 0.1);
          g.fillCircle(e.x + (e.x2! - e.x) * kk, e.y + (e.y2! - e.y) * kk, 4 - t * 0.6);
        }
        g.fillStyle(0xffffff, 0.95);
        g.fillCircle(x, y, 2.5);
        g.fillStyle(e.color, 0.9);
        g.fillCircle(x, y, 4.5);
        break;
      }
      case 'arrow': {
        const dx = e.x2! - e.x;
        const dy = e.y2! - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const hx = e.x + dx * k;
        const hy = e.y + dy * k - Math.sin(k * Math.PI) * 10;
        g.lineStyle(2, 0x7a5a3a, 1);
        g.lineBetween(hx - ux * 16, hy - uy * 16, hx, hy);
        g.lineStyle(1, 0xffffff, 0.8);
        g.lineBetween(hx - ux * 16, hy - uy * 16 - 1, hx - ux * 4, hy - uy * 4 - 1);
        g.fillStyle(e.color, 1);
        g.fillTriangle(hx + ux * 5, hy + uy * 5, hx - uy * 3 - ux * 2, hy + ux * 3 - uy * 2, hx + uy * 3 - ux * 2, hy - ux * 3 - uy * 2);
        g.lineStyle(2, 0xe8e0d0, 0.9);
        g.lineBetween(hx - ux * 16, hy - uy * 16, hx - ux * 19 - uy * 3, hy - uy * 19 + ux * 3);
        g.lineBetween(hx - ux * 16, hy - uy * 16, hx - ux * 19 + uy * 3, hy - uy * 19 - ux * 3);
        break;
      }
      case 'ring': {
        const r = e.r! * (0.25 + 0.75 * (1 - fade * fade));
        g.lineStyle(4 * fade + 1, e.color, 0.85 * fade);
        g.strokeEllipse(e.x, e.y, r * 2, r);
        g.lineStyle(2, 0xffffff, 0.5 * fade);
        g.strokeEllipse(e.x, e.y, r * 1.8, r * 0.9);
        break;
      }
      case 'bolt': {
        const segs = 9;
        for (const [w, c, a] of [[6, e.color, 0.5 * fade], [2, 0xffffff, fade]] as const) {
          g.lineStyle(w, c, a);
          g.beginPath();
          let px = e.x + (this.rnd(e.seed, 0) - 0.5) * 30;
          let py = e.y - 340;
          g.moveTo(px, py);
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            px = e.x + (this.rnd(e.seed + Math.floor(k * 6), s) - 0.5) * 36 * (1 - t);
            py = e.y - 340 * (1 - t);
            g.lineTo(px, py);
          }
          g.strokePath();
        }
        g.fillStyle(e.color, 0.4 * fade);
        g.fillCircle(e.x, e.y, 18 * (1 - k * 0.5));
        break;
      }
      case 'slash': {
        g.lineStyle(5 * fade + 1, 0xffffff, fade);
        g.beginPath();
        g.arc(e.x, e.y - 8, 26, -2.4 + e.r! + k * 1.2, -0.4 + e.r! + k * 1.2, false);
        g.strokePath();
        g.lineStyle(3, e.color, 0.8 * fade);
        g.beginPath();
        g.arc(e.x, e.y - 8, 20, -2.2 + e.r! + k * 1.2, -0.6 + e.r! + k * 1.2, false);
        g.strokePath();
        break;
      }
      case 'sparkle': {
        for (let i = 0; i < 12; i++) {
          const a = this.rnd(e.seed, i) * Math.PI * 2;
          const rr = 8 + this.rnd(e.seed, i + 20) * 22;
          const x = e.x + Math.cos(a) * rr;
          const y = e.y - k * (24 + this.rnd(e.seed, i + 40) * 24) + Math.sin(a) * rr * 0.4;
          g.fillStyle(i % 3 === 0 ? 0xffffff : e.color, fade);
          g.fillRect(x, y, 2, 2);
        }
        break;
      }
      case 'column': {
        const h = 160 * Math.min(1, k * 4);
        g.fillStyle(e.color, 0.22 * fade);
        g.fillRect(e.x - 14, e.y - h, 28, h);
        g.fillStyle(0xffffff, 0.3 * fade);
        g.fillRect(e.x - 5, e.y - h, 10, h);
        for (let i = 0; i < 8; i++) {
          const yy = e.y - ((k * 200 + i * 28) % 170);
          g.fillStyle(0xffffff, 0.7 * fade);
          g.fillRect(e.x - 12 + this.rnd(e.seed, i) * 24, yy, 2, 2);
        }
        break;
      }
      case 'burst': {
        for (let i = 0; i < 10; i++) {
          const a = this.rnd(e.seed, i) * Math.PI * 2;
          const d = (6 + this.rnd(e.seed, i + 10) * 26) * (1 - fade * fade);
          g.fillStyle(i % 2 ? e.color : 0xffffff, fade);
          g.fillRect(e.x + Math.cos(a) * d, e.y - 12 + Math.sin(a) * d * 0.6 - k * 8, 3, 3);
        }
        break;
      }
      default:
        break;
    }
  }
}
