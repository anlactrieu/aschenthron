import type { World } from '../sim/world';

const COLORS: Record<number, string> = {
  1: '#6a625c', 2: '#2c2824', 3: '#35483a', 4: '#3f6034', 5: '#4a4452', 6: '#1d3550', 7: '#8a7658',
  8: '#5a6050', 9: '#5a4640', 10: '#2c4a2c', 11: '#4a4650', 12: '#c84a14', 13: '#5a5a62', 14: '#4a4652',
};

/** Kleine Übersichtskarte (Taste N): Gelände einmal vorgerendert, pro Aufruf nur Marker. */
export class Minimap {
  private base: HTMLCanvasElement;
  private view: HTMLCanvasElement;
  private visible = true;

  constructor(private w: World, tiles: number[]) {
    const { w: gw, h: gh } = w.grid;
    this.base = document.createElement('canvas');
    this.base.width = gw;
    this.base.height = gh;
    const c = this.base.getContext('2d')!;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const gid = tiles[y * gw + x] ?? 0;
        c.fillStyle = COLORS[gid] ?? '#000';
        c.fillRect(x, y, 1, 1);
      }
    }
    this.view = document.createElement('canvas');
    this.view.width = gw * 1.4;
    this.view.height = gh * 1.4;
    Object.assign(this.view.style, {
      position: 'fixed', left: '12px', top: '12px', border: '1px solid #4b3f3a', background: '#0b0a0d',
      imageRendering: 'pixelated', opacity: '0.92', pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.view);
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'n') {
        this.visible = !this.visible;
        this.view.style.display = this.visible ? 'block' : 'none';
      }
    });
  }

  draw(px: number, py: number): void {
    if (!this.visible) return;
    const k = this.view.width / this.base.width;
    const c = this.view.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.base, 0, 0, this.view.width, this.view.height);
    for (const t of this.w.towns) {
      c.fillStyle = '#e8c040';
      c.fillRect(t.x * k - 2, t.y * k - 2, 5, 5);
    }
    for (const ch of this.w.chests) {
      if (ch.opened) continue;
      c.fillStyle = ch.tier === 'gold' ? '#ffd84a' : ch.tier === 'iron' ? '#9fb4d8' : '#b88a50';
      c.fillRect(ch.x * k - 1, ch.y * k - 1, 3, 3);
    }
    for (const a of this.w.actors) {
      if (a.kind === 'monster' && a.unique && a.alive) {
        c.fillStyle = '#ff9a2a';
        c.fillRect(a.x * k - 2, a.y * k - 2, 4, 4);
      }
      if (a.kind === 'monster' && a.boss && a.alive) {
        c.fillStyle = '#e04030';
        c.fillRect(a.x * k - 2, a.y * k - 2, 4, 4);
      }
    }
    c.fillStyle = '#ffffff';
    c.fillRect(px * k - 2, py * k - 2, 5, 5);
    c.strokeStyle = '#000';
    c.strokeRect(px * k - 2.5, py * k - 2.5, 6, 6);
  }
}
