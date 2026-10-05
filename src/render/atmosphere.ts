import type Phaser from 'phaser';
import type { Sfx } from './audio';

/**
 * Tag/Nacht und Wetter als reiner Render-Layer (nichts davon steht in der Sim oder im Spielstand).
 * - Tageszeit: Echtzeit, ein voller Zyklus dauert 24 Minuten (1 Spielstunde = 1 Minute). Ein DOM-Overlay mit
 *   `mix-blend-mode: multiply` färbt das Bild (Dämmerung warm, Nacht bläulich dunkel, Morgen warm).
 * - Dungeons ignorieren den Zyklus (konstante Dunkelheit über den Vignetten-Verlauf der Szene), Städte bleiben heller.
 * - Wetter je Außenzone, wechselt per Zufall alle ca. 3,5 Minuten (aus der Uhr abgeleitet, daher ohne Speicherstand):
 *   Regen (Moorlande, selten Aschenhafen-Umland), Nebel (Moorlande, Totenacker), Ascheflocken (Aschenöde, Aschengrund).
 * Testparameter: `?stunde=22` (feste Uhrzeit), `?wetter=regen|nebel|asche|klar`.
 */

export type Weather = 'clear' | 'rain' | 'fog' | 'ash';
export type ZoneClass = 'indoor' | 'town' | 'outdoor';

/** Dungeons und Innenzonen: Tageszeit und Wetter greifen dort nicht. */
export const DUNGEONS = ['Gruft der Moorhexe', 'Katakomben', 'Tiefenmine', 'Thron der Asche', 'Goblinbau', 'Spinnennest'];
const TOWNS = ['Aschenhafen', 'Felsenwacht'];
const ASH_ZONES = ['Aschenöde', 'Aschengrund', 'Thron der Asche'];

export const isDungeon = (name: string): boolean => DUNGEONS.includes(name);
export const zoneClass = (name: string): ZoneClass => (isDungeon(name) ? 'indoor' : TOWNS.includes(name) ? 'town' : 'outdoor');

/** Ein Zyklus in Millisekunden (24 Spielstunden = 24 Minuten) */
export const DAY_MS = 24 * 60 * 1000;
/** Wetterwechsel-Takt */
export const WEATHER_SLOT_MS = 3.5 * 60 * 1000;

/** Farbverlauf des Tages: Stunde → Multiplikationsfarbe (255 = unverändert). */
const KEYS: [number, [number, number, number]][] = [
  [0, [96, 108, 168]], [4.5, [96, 108, 168]], [6.5, [255, 200, 156]], [8.5, [255, 255, 255]],
  [17, [255, 255, 255]], [19, [255, 180, 132]], [20.5, [132, 120, 170]], [22, [96, 108, 168]], [24, [96, 108, 168]],
];

export function dayColor(hour: number): [number, number, number] {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < KEYS.length; i++) {
    const [h1, c1] = KEYS[i]!;
    const [h0, c0] = KEYS[i - 1]!;
    if (h <= h1) {
      const t = (h - h0) / (h1 - h0 || 1);
      return [0, 1, 2].map((k) => Math.round(c0[k]! + (c1[k]! - c0[k]!) * t)) as [number, number, number];
    }
  }
  return KEYS[0]![1];
}

const hash32 = (n: number): number => {
  let t = (n + 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Wetter einer Zone im Zeitfenster `slot` (rein aus der Uhr, damit es zwischen Neuladen und Spielern stabil bleibt). */
export function weatherFor(zone: string, slot: number): Weather {
  const r = hash32(slot * 31 + zone.length * 7 + (zone.charCodeAt(0) || 0));
  switch (zone) {
    case 'Moorlande': return r < 0.3 ? 'rain' : r < 0.65 ? 'fog' : 'clear';
    case 'Totenacker': return r < 0.22 ? 'fog' : 'clear';
    case 'Roggenfelder': case 'Aschenhafen': return r < 0.1 ? 'rain' : 'clear';
    case 'Aschenöde': case 'Aschengrund': return r < 0.6 ? 'ash' : 'clear';
    default: return 'clear';
  }
}

interface Particle {
  x: number;
  y: number;
  v: number;
  s: number;
}

export class Atmosphere {
  private overlay: HTMLDivElement;
  private veil: HTMLDivElement;
  private gfx: Phaser.GameObjects.Graphics;
  private drops: Particle[] = [];
  private flakes: Particle[] = [];
  private zone: ZoneClass = 'outdoor';
  private region = '';
  private cur: Weather = 'clear';
  private k = 0;
  private colorKey = '';
  private veilKey = '';
  private rainSent = -1;
  private mix = { indoor: 0, town: 0 };
  private fixedHour: number | null;
  private fixedWeather: Weather | null;
  private t = 0;
  /** Debug: aktuelle Werte (lesbar über window.__game) */
  state = { hour: 12, weather: 'clear' as Weather, k: 0, color: '255,255,255' };

  constructor(private scene: Phaser.Scene, private sfx: Sfx) {
    const q = new URLSearchParams(location.search);
    const h = q.get('stunde');
    this.fixedHour = h !== null && Number.isFinite(Number(h)) ? Number(h) : null;
    const w = q.get('wetter');
    this.fixedWeather = w ? ({ regen: 'rain', nebel: 'fog', asche: 'ash', klar: 'clear' } as Record<string, Weather>)[w] ?? null : null;
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;mix-blend-mode:multiply;background:rgb(255,255,255)';
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;background:radial-gradient(ellipse at center,rgba(160,176,170,.16) 20%,rgba(150,166,160,.42) 100%)';
    document.body.append(this.overlay, this.veil);
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(1e7 + 6);
  }

  /** Aktuelle Spielstunde 0–24 */
  hour(): number {
    return this.fixedHour ?? ((Date.now() % DAY_MS) / DAY_MS) * 24;
  }

  setRegion(name: string): void {
    this.region = name;
    this.zone = zoneClass(name);
  }

  /** Welcher Welt-Partikeltyp (Fx.setAmbient) zur Zone und zum Wetter passt. */
  ambientKind(): 'embers' | 'mist' | null {
    if (ASH_ZONES.includes(this.region)) return 'embers';
    if (this.region === 'Gruft der Moorhexe') return 'mist';
    if (this.cur === 'fog' && this.k > 0.3) return 'mist';
    return null;
  }

  private targetWeather(): Weather {
    if (this.zone === 'indoor') return 'clear';
    if (this.fixedWeather) return this.fixedWeather;
    return weatherFor(this.region, Math.floor(Date.now() / WEATHER_SLOT_MS));
  }

  update(dt: number): void {
    this.t += dt;
    const hour = this.hour();
    // sanfter Wechsel zwischen Außen, Stadt und Innen
    const ease = Math.min(1, dt / 900);
    this.mix.indoor += ((this.zone === 'indoor' ? 1 : 0) - this.mix.indoor) * ease;
    this.mix.town += ((this.zone === 'town' ? 1 : 0) - this.mix.town) * ease;
    // Wetter blendet aus, wechselt, blendet ein
    const want = this.targetWeather();
    if (want !== this.cur) {
      this.k -= dt / 3500;
      if (this.k <= 0) {
        this.k = 0;
        this.cur = want;
      }
    } else if (this.cur !== 'clear') this.k = Math.min(1, this.k + dt / 3500);
    const rainK = this.cur === 'rain' ? this.k : 0;

    // Farb-Overlay (nur bei sichtbarer Änderung neu gesetzt)
    const [r, g, b] = dayColor(hour);
    const lift = Math.min(1, this.mix.indoor + this.mix.town * 0.4);
    const rain = 1 - 0.14 * rainK;
    const out = [r, g, b].map((c) => Math.round((c + (255 - c) * lift) * rain));
    const ck = out.map((c) => Math.min(255, Math.round(c / 2) * 2)).join(',');
    if (ck !== this.colorKey) {
      this.colorKey = ck;
      this.overlay.style.background = `rgb(${ck})`;
    }
    const fogK = this.cur === 'fog' ? this.k : 0;
    const vk = (Math.round(fogK * 25) / 25).toFixed(2);
    if (vk !== this.veilKey) {
      this.veilKey = vk;
      this.veil.style.opacity = vk;
    }
    this.state = { hour, weather: this.cur, k: this.k, color: ck };

    // Regenrauschen: nur bei spürbarer Änderung an den Ton melden
    const rs = Math.round(rainK * 20);
    if (rs !== this.rainSent) {
      this.rainSent = rs;
      this.sfx.rain(rainK);
    }

    this.draw(dt, rainK, this.cur === 'ash' ? this.k : 0);
  }

  private draw(dt: number, rainK: number, ashK: number): void {
    const g = this.gfx;
    g.clear();
    if (rainK <= 0.02 && ashK <= 0.02) return;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const s = dt / 1000;
    if (rainK > 0.02) {
      const want = Math.round(130 * rainK);
      while (this.drops.length < 130) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 760 + Math.random() * 380, s: 9 + Math.random() * 9 });
      g.lineStyle(1.5, 0xdcecff, 0.62 * rainK);
      g.beginPath();
      for (let i = 0; i < want; i++) {
        const d = this.drops[i]!;
        d.y += d.v * s;
        d.x -= d.v * 0.16 * s;
        if (d.y > H) {
          d.y = -d.s;
          d.x = Math.random() * (W + 120);
        }
        if (d.x < -20) d.x += W + 40;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - d.s * 0.16, d.y + d.s);
      }
      g.strokePath();
    }
    if (ashK > 0.02) {
      const want = Math.round(55 * ashK);
      while (this.flakes.length < 55) this.flakes.push({ x: Math.random() * W, y: Math.random() * H, v: 28 + Math.random() * 36, s: 1 + Math.random() * 1.6 });
      g.fillStyle(0xd8d0c8, 0.75 * ashK);
      for (let i = 0; i < want; i++) {
        const f = this.flakes[i]!;
        f.y += f.v * s;
        f.x += Math.sin(this.t / 700 + i) * 14 * s + 8 * s;
        if (f.y > H + 4) {
          f.y = -4;
          f.x = Math.random() * W;
        }
        if (f.x > W + 4) f.x = -4;
        g.fillRect(f.x, f.y, f.s, f.s);
      }
    }
  }
}
