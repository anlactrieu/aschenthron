import type { World } from '../sim/world';
import type { QuestMark } from '../sim/quests';
import { uniqueDef } from '../sim/data';
import { isTouch } from './touch';

const COLORS: Record<number, string> = {
  1: '#6a625c', 2: '#2c2824', 3: '#35483a', 4: '#3f6034', 5: '#4a4452', 6: '#1d3550', 7: '#8a7658',
  8: '#5a6050', 9: '#5a4640', 10: '#2c4a2c', 11: '#4a4650', 12: '#c84a14', 13: '#5a5a62', 14: '#4a4652',
  15: '#7a5a38', 16: '#7a726a', 17: '#3f6034', 18: '#9a4632', 19: '#6a4428', 20: '#6a4428', 21: '#6a6870', 22: '#c8a850', 23: '#5a4030', 24: '#b8403a', 25: '#5a4230', 26: '#8a6a40', 27: '#6a4428',
  28: '#7a5a38', 29: '#7a5a38', 30: '#7a5a38', 31: '#7a5a38', 32: '#7a5a38', 33: '#7a5a38', 34: '#7a5a38', 35: '#7a5a38', 36: '#7a5a38',
};

const SIZES = [1, 0.7, 0.45];
const SIZE_KEY = 'aschenthron.minimapSize';

/** Kleine Übersichtskarte (N ein/aus, B Größe wechseln): Gelände einmal vorgerendert, pro Aufruf nur Marker. */
export class Minimap {
  private base: HTMLCanvasElement;
  private view: HTMLCanvasElement;
  private visible = true;
  private sizeIdx = 0;

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
    // Größe wie bisher (≈ 340 px breit), auch wenn die Karte größer wird
    const zoom = Math.min(1.4, 340 / gw);
    this.view.width = gw * zoom;
    this.view.height = gh * zoom;
    Object.assign(this.view.style, {
      position: 'fixed', left: '12px', top: '12px', border: '1px solid #4b3f3a', background: '#0b0a0d',
      imageRendering: 'pixelated', opacity: '0.7', pointerEvents: 'none', zIndex: '3',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.view);
    try {
      const n = Number(localStorage.getItem(SIZE_KEY));
      if (n >= 0 && n < SIZES.length) this.sizeIdx = n;
    } catch {
      /* ohne Speicher: Standardgröße */
    }
    if (isTouch) {
      // Handy: klein starten, Antippen wechselt klein → groß → ausgeblendet; Menü-Knopf „Karte“ blendet wieder ein
      this.sizeIdx = 2;
      this.view.style.left = 'max(8px,env(safe-area-inset-left))';
      this.view.style.top = 'max(8px,env(safe-area-inset-top))';
      this.view.style.pointerEvents = 'auto';
      this.view.onclick = () => {
        if (this.sizeIdx === 2) this.sizeIdx = 0;
        else this.setVisible(false);
        this.applySize();
      };
      window.addEventListener('aschenthron:map', () => {
        this.sizeIdx = 2;
        this.setVisible(!this.visible);
        this.applySize();
      });
    }
    this.applySize();
    if (isTouch) window.addEventListener('resize', () => this.applySize());
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        this.sizeIdx = (this.sizeIdx + 1) % SIZES.length;
        this.applySize();
        try {
          localStorage.setItem(SIZE_KEY, String(this.sizeIdx));
        } catch {
          /* egal */
        }
      }
      if (e.key.toLowerCase() === 'n') this.setVisible(!this.visible);
    });
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.view.style.display = v ? 'block' : 'none';
  }

  /** Anzeigegröße per CSS (Auflösung bleibt, Marker skalieren mit); höchstens ein Teil des Fensters. */
  private applySize(): void {
    const w0 = this.view.width * SIZES[this.sizeIdx]!;
    const h0 = this.view.height * SIZES[this.sizeIdx]!;
    // Begrenzung nur am Handy; am Laptop bleibt die Karte wie bisher
    const f = isTouch ? Math.min(1, (window.innerWidth * 0.4) / w0, (window.innerHeight * 0.55) / h0) : 1;
    this.view.style.width = `${Math.round(w0 * f)}px`;
    this.view.style.height = `${Math.round(h0 * f)}px`;
  }

  draw(px: number, py: number, marks: QuestMark[] = []): void {
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
        c.fillStyle = uniqueDef(a.unique)?.world ? '#c77fff' : '#ff9a2a';
        c.fillRect(a.x * k - 2, a.y * k - 2, 4, 4);
      }
      if (a.kind === 'monster' && a.boss && a.alive) {
        c.fillStyle = '#e04030';
        c.fillRect(a.x * k - 2, a.y * k - 2, 4, 4);
      }
    }
    // Aufgabenziele: gelbe Rauten (grün = abgeben)
    for (const m of marks) {
      c.fillStyle = m.done ? '#6fe08a' : '#ffe45a';
      c.beginPath();
      c.moveTo(m.x * k, m.y * k - 5);
      c.lineTo(m.x * k + 4, m.y * k);
      c.lineTo(m.x * k, m.y * k + 5);
      c.lineTo(m.x * k - 4, m.y * k);
      c.closePath();
      c.fill();
      c.strokeStyle = '#000';
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(px * k - 2, py * k - 2, 5, 5);
    c.strokeStyle = '#000';
    c.strokeRect(px * k - 2.5, py * k - 2.5, 6, 6);
  }
}
