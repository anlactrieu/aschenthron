import Phaser from 'phaser';

/**
 * Kampf-Juice, nur Darstellung: schwebende Zahlen, Projektile, Ringe, Blitze, Schlagbögen, Funken, Lichtsäulen
 * und Umgebungspartikel. Gezeichnet auf dem Overlay-Graphics der Szene, Texte aus einem Pool.
 */

interface Effect {
  kind: 'zone' | 'swing' | 'projectile' | 'arrow' | 'ring' | 'bolt' | 'slash' | 'sparkle' | 'column' | 'burst' | 'beamRing' | 'charge' | 'spell' | 'flare';
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
  /** Zauber-Farbwelt (charge/spell/flare) */
  theme?: SpellTheme;
  /** Wucht des Einschlags: 0 normal, 1 kritisch, 2 Todesstoß */
  power?: 0 | 1 | 2;
}

/**
 * Farbwelt eines Zaubers: Kern (hell), Glut/Leuchten, Funken (zwei Töne), Rauch. Baustein für Glutblitz, Feuerball, Frostnova, Blitzschlag:
 * ein Zauber wählt nur eine Farbwelt, Aufladen, Flug und Einschlag zeichnet `Fx` (charge / spell / flare).
 */
export interface SpellTheme {
  core: number;
  glow: number;
  spark: [number, number];
  smoke: number;
  /** Funken fallen (Glut) oder steigen (Frost/Blitz bleiben leicht) */
  gravity: number;
}
export const SPELL_THEMES = {
  fire: { core: 0xfff2c0, glow: 0xff7a1a, spark: [0xffc860, 0xff5a1a], smoke: 0x3a3430, gravity: 1 },
  frost: { core: 0xf0fbff, glow: 0x6fc8ff, spark: [0xd8f4ff, 0x8fd0ff], smoke: 0x7a8c9a, gravity: 0.3 },
  poison: { core: 0xeaffd8, glow: 0x6fd050, spark: [0xb8f090, 0x7fe060], smoke: 0x2c4028, gravity: 0.5 },
  lightning: { core: 0xffffff, glow: 0x8fb4ff, spark: [0xe8f0ff, 0xb0c8ff], smoke: 0x4a4e66, gravity: 0 },
} satisfies Record<string, SpellTheme>;
export type SpellElement = keyof typeof SPELL_THEMES;
/** Zauber (Skill-ID) → Farbwelt; ein neuer Zauber trägt sich hier ein und läuft dann über charge/spell/flare */
export const SPELL_ELEMENT: Record<string, SpellElement> = { ember_bolt: 'fire', fireball: 'fire', lightning: 'lightning' };
/** Farbwelt eines Treffers: Schadenstyp (Frost/Gift/Feuer) gewinnt, sonst die Tabelle, sonst Feuer */
export function spellElementOf(skill: string | undefined, dt: string | undefined): SpellElement {
  if (dt === 'fire' || dt === 'frost' || dt === 'poison') return dt;
  return (skill && SPELL_ELEMENT[skill]) || 'fire';
}

interface FloatText {
  t: Phaser.GameObjects.Text;
  start: number;
  dur: number;
  x: number;
  y: number;
  vy: number;
  grow: number;
  /** Aufpoppen zu Beginn (Startfaktor der Größe, 1 = keins) */
  pop: number;
  /** seitliche Drift in Pixel über die Lebensdauer */
  dx: number;
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

  floatText(x: number, y: number, text: string, color: string, size = 14, dur = 950, pop = 1): void {
    dur *= this.timeScale;
    let f = this.floats.find((q) => !q.active);
    // Zahlenflut deckeln: kleine Texte entfallen, wenn schon viele laufen (große, wichtige bleiben)
    if (!f && this.floats.length >= 26 && size < 16) return;
    if (!f) {
      const t = this.scene.add.text(0, 0, '', { fontSize: '14px', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH);
      f = { t, start: 0, dur: 0, x: 0, y: 0, vy: 0, grow: 1, pop: 1, dx: 0, active: false };
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
    f.pop = pop;
    f.dx = pop > 1 ? (jitter < 0 ? -1 : 1) * (10 + (this.seed() % 9)) : 0;
    f.t.setText(text).setColor(color).setFontSize(size).setStroke('#000', size >= 20 ? 5 : 3).setVisible(true).setAlpha(1).setPosition(f.x, f.y);
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
  /** Warnring am Boden (Radius in Tiles), füllt sich bis zum Einschlag. */
  zone(x: number, y: number, rTiles: number, color: number, dur: number): void {
    this.add({ kind: 'zone', x, y, r: rTiles, dur, color });
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
  /** Schwungbogen eines Nahkampfschlags: Sichel zwischen Angreifer und Ziel (`angle` = Bildschirmrichtung zum Angreifer). */
  swing(x: number, y: number, color: number, angle: number): void {
    this.add({ kind: 'swing', x, y, r: angle, dur: 200, color });
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
  /** Zauber aufladen: Glühen an Hand/Stab wächst, Funken ziehen hinein. */
  charge(x: number, y: number, theme: SpellTheme, dur = 160): void {
    this.add({ kind: 'charge', x, y, dur, color: theme.glow, theme });
  }
  /** Zaubergeschoss: leuchtender Kopf, flackernder Schweif, Funken- bzw. Glutspur; ruft `onArrive` beim Einschlag. */
  spell(x: number, y: number, x2: number, y2: number, theme: SpellTheme, dur = 220, onArrive?: () => void): void {
    this.add({ kind: 'spell', x, y, x2, y2, dur, color: theme.glow, theme, onArrive });
  }
  /** Einschlag: Lichtblitz, Feuer-/Energiestoß, wegsprühende Funken, Rauch. */
  flare(x: number, y: number, theme: SpellTheme, power: 0 | 1 | 2 = 0): void {
    this.add({ kind: 'flare', x, y, dur: 900, color: theme.glow, theme, power });
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
      // Sprung: schneller Satz nach oben, kurzer Rückfall, dann sanftes Steigen (nur bei aufpoppenden Zahlen)
      const hop = f.pop > 1 ? -Math.sin(Math.min(1, k / 0.22) * Math.PI) * 9 * f.pop : 0;
      f.t.setPosition(f.x + f.dx * ease, f.y + f.vy * ease * 1.6 + hop).setAlpha(k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35);
      // Aufpoppen mit Überschwingen; ohne `pop` das alte kurze Anwachsen großer Zahlen
      const pk = Math.min(1, k / 0.2);
      const sc = f.pop > 1 ? 1 + (f.pop - 1) * (1 - pk) * (1 - pk) * (1 + 0.6 * Math.cos(pk * Math.PI * 2)) : f.grow > 1 && k < 0.15 ? 1 + (1 - k / 0.15) * 0.5 : 1;
      f.t.setScale(Math.max(0.1, sc));
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
        if ((e.kind === 'projectile' || e.kind === 'arrow' || e.kind === 'spell') && !e.arrived) e.onArrive?.();
        this.effects.splice(i, 1);
        continue;
      }
      this.drawEffect(g, e, k);
      if ((e.kind === 'projectile' || e.kind === 'arrow' || e.kind === 'spell') && k > 0.92 && !e.arrived) {
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
      case 'zone': {
        const rx = e.r! * 45.25;
        const ry = e.r! * 22.6;
        g.fillStyle(e.color, 0.10 + 0.22 * k);
        g.fillEllipse(e.x, e.y, rx * 2, ry * 2);
        g.fillStyle(e.color, 0.18 + 0.3 * k * k);
        g.fillEllipse(e.x, e.y, rx * 2 * k, ry * 2 * k);
        g.lineStyle(3, e.color, 0.55 + 0.4 * Math.abs(Math.sin(k * 14)));
        g.strokeEllipse(e.x, e.y, rx * 2, ry * 2);
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
      case 'swing': {
        // Sichel: Kopf läuft von einer Seite zur anderen, der Schweif folgt; Ellipse passt zur Iso-Ansicht
        const head = -1.1 + k * 2.2;
        const tail = Math.max(-1.1, head - 1.1);
        for (const [w, rad, col, al] of [[6, 26, 0xffffff, 0.9], [3, 21, e.color, 0.8]] as const) {
          g.lineStyle(w * fade + 1, col, al * fade);
          g.beginPath();
          for (let i = 0; i <= 10; i++) {
            const a = e.r! + tail + ((head - tail) * i) / 10;
            const px = e.x + Math.cos(a) * rad * 0.9;
            const py = e.y - 4 + Math.sin(a) * rad * 0.6;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.strokePath();
        }
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
      case 'charge': {
        const th = e.theme!;
        const grow = k * k;
        const pulse = 0.85 + 0.15 * Math.sin(k * 40);
        g.fillStyle(th.glow, 0.18 * pulse);
        g.fillCircle(e.x, e.y, 5 + 11 * grow);
        g.fillStyle(th.glow, 0.45);
        g.fillCircle(e.x, e.y, 3 + 5 * grow);
        g.fillStyle(th.core, 0.95);
        g.fillCircle(e.x, e.y, 1.5 + 2.5 * grow);
        // Funken ziehen ins Zentrum, kreisend
        for (let i = 0; i < 7; i++) {
          const a = this.rnd(e.seed, i) * Math.PI * 2 + k * 5;
          const rr = (22 + this.rnd(e.seed, i + 9) * 14) * (1 - k);
          g.fillStyle(i % 2 ? th.spark[0] : th.spark[1], 0.4 + 0.6 * k);
          g.fillRect(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.7, 2, 2);
        }
        break;
      }
      case 'spell': {
        const th = e.theme!;
        const dx = e.x2! - e.x;
        const dy = e.y2! - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        // leichter Bogen, damit das Geschoss nicht wie eine Linie wirkt
        const arc = (kk: number) => -Math.sin(kk * Math.PI) * Math.min(14, len * 0.08);
        const at = (kk: number): [number, number] => [e.x + dx * kk, e.y + dy * kk + arc(kk)];
        const [hx, hy] = at(k);
        // Schweif: Flammenzunge aus abnehmenden Kreisen, flackernd
        for (let t = 9; t >= 1; t--) {
          const kk = Math.max(0, k - t * 0.035);
          const [tx, ty] = at(kk);
          const fl = (this.rnd(e.seed + Math.floor(k * 30), t) - 0.5) * 3.2;
          g.fillStyle(t > 5 ? th.spark[1] : th.glow, 0.5 - t * 0.045);
          g.fillCircle(tx - uy * fl, ty + ux * fl, Math.max(1.2, 6.2 - t * 0.55));
        }
        // Funken-/Glutspur: lösen sich vom Weg, fallen (je Farbwelt) ab
        for (let i = 0; i < 12; i++) {
          const born = this.rnd(e.seed, i) * k;
          const age = k - born;
          if (age > 0.4) continue;
          const [sx, sy] = at(born);
          const side = (this.rnd(e.seed, i + 30) - 0.5) * 16 * age * 5;
          const fall = age * age * 60 * th.gravity * (this.rnd(e.seed, i + 60) + 0.4);
          g.fillStyle(i % 3 === 0 ? th.core : (i % 2 ? th.spark[1] : th.spark[0]), 1 - age / 0.4);
          g.fillRect(sx - uy * side, sy + ux * side + fall, 2, 2);
        }
        // Kopf: Leuchten, Glut, heller Kern
        g.fillStyle(th.glow, 0.18);
        g.fillCircle(hx, hy, 13);
        g.fillStyle(th.glow, 0.5);
        g.fillCircle(hx, hy, 7.5);
        g.fillStyle(th.spark[0], 0.95);
        g.fillCircle(hx, hy, 5);
        g.fillStyle(th.core, 1);
        g.fillCircle(hx + ux, hy + uy, 2.6);
        break;
      }
      case 'flare': {
        const th = e.theme!;
        const pw = e.power ?? 0;
        const size = pw === 0 ? 1 : pw === 1 ? 1.25 : 1.5;
        // Lichtblitz: erste ~12 % der Zeit, hell und rund
        if (k < 0.14) {
          const f = 1 - k / 0.14;
          g.fillStyle(th.core, 0.55 * f);
          g.fillCircle(e.x, e.y, 34 * size * (0.5 + 0.5 * (1 - f)));
          g.fillStyle(0xffffff, 0.9 * f);
          g.fillCircle(e.x, e.y, 14 * size);
        }
        // Feuerstoß: wächst schnell, glüht aus
        const grow = Math.min(1, k / 0.3);
        const burn = Math.max(0, 1 - k / 0.55);
        if (burn > 0) {
          const r = (8 + 20 * (1 - (1 - grow) * (1 - grow))) * size;
          g.fillStyle(th.glow, 0.35 * burn);
          g.fillEllipse(e.x, e.y + 4, r * 2.4, r * 1.7);
          g.fillStyle(th.spark[1], 0.55 * burn);
          g.fillEllipse(e.x, e.y + 2, r * 1.6, r * 1.2);
          g.fillStyle(th.spark[0], 0.8 * burn);
          g.fillEllipse(e.x, e.y, r, r * 0.8);
          g.fillStyle(th.core, 0.9 * burn);
          g.fillCircle(e.x, e.y, r * 0.25);
        }
        // Bodenglut: bleibt kurz leuchten (Brandfleck)
        if (k > 0.1 && k < 0.8) {
          const sk = 1 - (k - 0.1) / 0.7;
          g.fillStyle(th.smoke, 0.22 * sk);
          g.fillEllipse(e.x, e.y + 12, 34 * size, 12 * size);
          g.fillStyle(th.glow, 0.25 * sk * sk);
          g.fillEllipse(e.x, e.y + 12, 20 * size, 7 * size);
        }
        // Funken: sprühen in alle Richtungen, fallen mit Schwerkraft
        const n = 14 + pw * 6;
        for (let i = 0; i < n; i++) {
          const a = this.rnd(e.seed, i) * Math.PI * 2;
          const sp = (30 + this.rnd(e.seed, i + 20) * 46) * size;
          const life = 0.45 + this.rnd(e.seed, i + 40) * 0.4;
          if (k > life) continue;
          const t = k / life;
          const d = sp * (1 - (1 - t) * (1 - t));
          const x = e.x + Math.cos(a) * d;
          const y = e.y - 4 + Math.sin(a) * d * 0.55 + t * t * 30 * th.gravity - (th.gravity === 0 ? 0 : 6 * Math.sin(t * Math.PI));
          g.fillStyle(i % 3 === 0 ? th.core : (i % 2 ? th.spark[1] : th.spark[0]), 1 - t * t);
          const sz = i % 4 === 0 ? 3 : 2;
          g.fillRect(x, y, sz, sz);
        }
        // Rauch (Brandgeruch): graue Schwaden steigen auf, nach dem Stoß
        if (k > 0.18) {
          const sk = (k - 0.18) / 0.82;
          for (let i = 0; i < 4 + pw; i++) {
            const ox = (this.rnd(e.seed, i + 80) - 0.5) * 22 * size;
            const rise = sk * (22 + this.rnd(e.seed, i + 90) * 20);
            g.fillStyle(th.smoke, 0.32 * (1 - sk) * Math.min(1, sk * 6));
            g.fillEllipse(e.x + ox + sk * 6 * (i % 2 ? 1 : -1), e.y - 6 - rise, (9 + sk * 12) * size, (7 + sk * 8) * size);
          }
        }
        break;
      }
      default:
        break;
    }
  }
}
