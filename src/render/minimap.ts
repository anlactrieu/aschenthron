import type { World } from '../sim/world';
import type { QuestMark } from '../sim/quests';
import { uniqueDef } from '../sim/data';
import { isTouch } from './touch';
import { NINJA_BASE } from './ninja';

/** Farben je gid, aus der Palette der Code-Welt (world/ground.ts, props.ts, houses.ts), eine Stufe heller für die kleine Karte */
const COLORS: Record<number, string> = {
  1: '#5e5764', 2: '#16141a', 3: '#47522f', 4: '#527036', 5: '#403b48', 6: '#1f3853', 7: '#6c533a',
  8: '#5d624c', 9: '#4d4448', 10: '#28452a', 11: '#7a7680', 12: '#e86416', 13: '#8a8690', 14: '#7a7680',
  15: '#6c4831', 16: '#5a535e', 17: '#527036', 18: '#663226', 19: '#7c5a36', 20: '#7c5a36', 21: '#7a7680', 22: '#ff9a38', 23: '#604428', 24: '#903c30', 25: '#604428', 26: '#7c5a36', 27: '#7c5a36',
  28: '#6c4831', 29: '#6c4831', 30: '#6c4831', 31: '#6c4831', 32: '#6c4831', 33: '#6c4831', 34: '#6c4831', 35: '#6c4831', 36: '#6c4831', 37: '#6c4831',
};

// Standard klein (B: größer / noch kleiner); neuer Speicherschlüssel, damit alte Wahl der großen Karte nicht greift
const SIZES = [0.5, 0.85, 0.32];
const SIZE_KEY = 'aschenthron.minimapSize2';

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
      position: 'fixed', right: '12px', top: '12px', border: '10px solid transparent', borderImage: `url("${NINJA_BASE}Ui/Theme/Theme%20Wood/nine_path_panel.png") 5 / 10px stretch`, background: '#0a1220', backgroundClip: 'padding-box',
      imageRendering: 'pixelated', opacity: '0.88', pointerEvents: 'none', zIndex: '3',
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
      this.view.style.right = 'auto';
      this.view.style.left = 'max(8px,env(safe-area-inset-left))';
      this.view.style.top = 'calc(max(8px,env(safe-area-inset-top)) + var(--tl-h) + 4px)';
      this.view.style.borderWidth = '6px';
      this.view.style.borderImageWidth = '6px';
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
    // sofort das Gelände zeigen (draw läuft erst nach den ersten Bildern), statt einer schwarzen Fläche
    const v = this.view.getContext('2d')!;
    v.imageSmoothingEnabled = false;
    v.drawImage(this.base, 0, 0, this.view.width, this.view.height);
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
    this.syncHeight();
  }

  /** Höhe samt Rahmen als CSS-Variable, damit die Aufgabenanzeige darunter Platz lässt. */
  private syncHeight(): void {
    const h = this.visible && !isTouch ? this.view.offsetHeight || parseFloat(this.view.style.height) + 20 || 0 : 0;
    document.documentElement.style.setProperty('--mm-h', `${h}px`);
  }

  /** Anzeigegröße per CSS (Auflösung bleibt, Marker skalieren mit); höchstens ein Teil des Fensters. */
  private applySize(): void {
    const w0 = this.view.width * SIZES[this.sizeIdx]!;
    const h0 = this.view.height * SIZES[this.sizeIdx]!;
    // Begrenzung nur am Handy; am Laptop bleibt die Karte wie bisher
    const f = isTouch ? Math.min(1, (window.innerWidth * 0.4) / w0, (window.innerHeight * 0.55) / h0) : 1;
    this.view.style.width = `${Math.round(w0 * f)}px`;
    this.view.style.height = `${Math.round(h0 * f)}px`;
    this.syncHeight();
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
