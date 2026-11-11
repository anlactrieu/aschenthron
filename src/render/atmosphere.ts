import type Phaser from 'phaser';
import type { Sfx } from './audio';
import { DUNGEON_REGIONS } from '../sim/clock';

/**
 * Tag/Nacht und Wetter als reiner Render-Layer (nichts davon steht in der Sim oder im Spielstand).
 * - Tageszeit: die Uhr der Sim (P6, `sim/clock.ts`, aus dem Tick abgeleitet, im Mehrspieler vom Server): ein voller Zyklus
 *   dauert 24 Minuten (1 Spielstunde = 1 Minute). Ohne Quelle (Tests) läuft sie nach der Echtzeit. Eine bildschirmfüllende
 *   Fläche mit Multiply-Mischung in der Szene färbt die Welt (Dämmerung warm, Nacht bläulich dunkel, Morgen warm).
 *   Sie liegt bei `LIGHT_DEPTH - 1`: Fenster- und Laternenlicht (additiv, Tiefe `LIGHT_DEPTH`) liegt darüber und
 *   wird nicht mitgedimmt.
 * - Dungeons ignorieren den Zyklus (konstante Dunkelheit: `DUNGEON_AMBIENT`), Städte bleiben heller.
 * - Lichtkreis (T4): die Dunkelheit ist ein Bild mit weichem Alpha-Loch (Multiply, Tönung = Umgebungsfarbe), mittig auf dem
 *   Helden. Der Kreis liegt als Kreis auf dem Boden (in der Iso-Ansicht eine 2:1-Ellipse). Radius: `lightRadius` (eine Stelle,
 *   dort greift später die Fackel der Nebenhand: `Atmosphere.lightBonus`). Gegner außerhalb des Lichts tönt GameScene dunkel
 *   (`lightFactor`, gleiche Kurve wie das Loch im Bild).
 * - Wetter je Außenzone, wechselt per Zufall alle ca. 3,5 Minuten (aus der Uhr abgeleitet, daher ohne Speicherstand):
 *   Regen (Moorlande, selten Aschenhafen-Umland), Nebel (Moorlande, Totenacker), Ascheflocken (Aschenöde, Aschengrund).
 * Testparameter: `?stunde=22` (feste Uhrzeit; im Einzelspieler setzt GameScene sie auch in der Sim, online gilt sie nur für das Bild), `?wetter=regen|nebel|asche|klar`.
 */

/** Tiefe der Lichter (Fenster, Laternen): über der Tönung, unter Regen und Ascheflocken */
/** `Phaser.BlendModes.MULTIPLY` (Wert, damit Tests ohne Phaser-Import laufen) */
const MULTIPLY = 2;
export const LIGHT_DEPTH = 1e7 + 2;

export type Weather = 'clear' | 'rain' | 'fog' | 'ash';
export type ZoneClass = 'indoor' | 'town' | 'outdoor';

/** Dungeons und Innenzonen: Tageszeit und Wetter greifen dort nicht. */
export const DUNGEONS = DUNGEON_REGIONS;
const TOWNS = ['Aschenhafen', 'Felsenwacht'];
const ASH_ZONES = ['Aschenöde', 'Aschengrund', 'Thron der Asche'];

export const isDungeon = (name: string): boolean => DUNGEONS.includes(name);
export const zoneClass = (name: string): ZoneClass => (isDungeon(name) ? 'indoor' : TOWNS.includes(name) ? 'town' : 'outdoor');

/** Ein Zyklus in Millisekunden (24 Spielstunden = 24 Minuten) */
export const DAY_MS = 24 * 60 * 1000;
/** Wetterwechsel-Takt */
export const WEATHER_SLOT_MS = 3.5 * 60 * 1000;

/** Nacht außerhalb des Lichts (T4: deutlich dunkler als vorher 96/108/168) */
const NIGHT: [number, number, number] = [50, 58, 98];

/** Farbverlauf des Tages: Stunde → Multiplikationsfarbe (255 = unverändert). */
const KEYS: [number, [number, number, number]][] = [
  [0, NIGHT], [4.5, NIGHT], [6.5, [255, 200, 156]], [8.5, [255, 255, 255]],
  [17, [255, 255, 255]], [19, [255, 180, 132]], [20.5, [116, 104, 150]], [22, NIGHT], [24, NIGHT],
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

/**
 * Dunkle Grundstimmung (Dark Fantasy, Asche): multipliziert auf die Tagesfarbe, auch im hellen Mittag nie volle Farbe.
 * Die Code-Welt (world/*) ist selbst schon dunkel gemalt, darum nur noch ein leichter, fast neutraler Zug (vorher
 * 0.66/0.64/0.74 für die bunten Ninja-Kacheln: Tag wirkte violett).
 */
export const DARK_GRADE: readonly [number, number, number] = [0.92, 0.9, 0.94];
/** Wie weit Städte zum ungetönten Bild aufgehellt werden (vorher 0.4: Stadt wirkte bunt und hell). */
const TOWN_LIFT = 0.12;

/** Umgebungsfarbe in Dungeons (vorher nur Vignette; die Tageszeit greift dort nicht) */
export const DUNGEON_AMBIENT: readonly [number, number, number] = [72, 70, 96];

/** Lichtradius des Helden in Kacheln (Bodenkreis) draußen/Stadt und im Dungeon. */
export const LIGHT_TILES = 6.5;
export const LIGHT_TILES_DUNGEON = 6;
/** Anteil des Radius mit vollem Licht, danach weicher Übergang bis zum Rand */
const LIGHT_CORE = 0.45;
/** Wie stark die Umgebungsfarbe im Kern noch durchschlägt (0 = Kern ungedimmt) */
const LIGHT_FLOOR = 0.35;
/** Höhe/Breite des Lichtkreises im Bild: ein Bodenkreis ist in der Iso-Ansicht eine 2:1-Ellipse */
export const LIGHT_SQUASH = 0.5;

/**
 * Einzige Stelle für die Größe des Lichtkreises (in Kacheln). `bonus` ist für Lichtquellen am Helden vorgesehen:
 * die Fackel der Nebenhand (nach T2b) übergibt hier ihren Zuschlag (siehe `Atmosphere.lightBonus`).
 */
export const lightRadius = (dungeon: boolean, bonus = 0): number => (dungeon ? LIGHT_TILES_DUNGEON : LIGHT_TILES) + Math.max(0, bonus);

/** Licht an einem Punkt im Abstand `dist` zum Mittelpunkt einer Lichtquelle mit Radius `radius` (gleiche Einheit): 1 voll, 0 dunkel, weich dazwischen. */
export function lightFactor(dist: number, radius: number): number {
  if (radius <= 0) return 0;
  const t = (dist / radius - LIGHT_CORE) / (1 - LIGHT_CORE);
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  return 1 - t * t * (3 - 2 * t);
}

/** Wie dunkel die Umgebung ist: 0 bei Tag (fast ungetönt), 1 bei Nacht und im Dungeon. Aus der Multiplikationsfarbe (0–255). */
export function darkness(rgb: readonly [number, number, number]): number {
  const lum = (rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11) / 255;
  return Math.max(0, Math.min(1, (0.88 - lum) / 0.5));
}

/** Alphawert des Lichtlochs bei Abstand `r` vom Mittelpunkt (in Radien): 1 = volle Umgebungsfarbe, `LIGHT_FLOOR` = Kern. */
const holeAlpha = (r: number): number => 1 - (1 - LIGHT_FLOOR) * lightFactor(r, 1);

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

/** Kantenlänge der Lichttextur; das Loch füllt nur den Mittelteil (`HOLE_FRAC` der halben Kantenlänge), der Rest ist volle Dunkelheit */
const TEX = 1024;
const HOLE_FRAC = 0.1;

function holeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const x = c.getContext('2d')!;
  const half = TEX / 2;
  const g = x.createRadialGradient(half, half, 0, half, half, half);
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const r = i / n; // in Lochradien
    g.addColorStop((i / n) * HOLE_FRAC, `rgba(255,255,255,${holeAlpha(r).toFixed(3)})`);
  }
  g.addColorStop(HOLE_FRAC + 0.001, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = g;
  x.fillRect(0, 0, TEX, TEX);
  return c;
}

export class Atmosphere {
  private tint: Phaser.GameObjects.Image;
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
  private placeKey = '';
  private rainSent = -1;
  private mix = { indoor: 0, town: 0 };
  private fixedHour: number | null;
  private fixedWeather: Weather | null;
  /** Uhr der Sim (Spielstunde); ohne Quelle Echtzeit */
  source: (() => number) | null = null;
  private t = 0;
  /** Zuschlag auf den Lichtradius in Kacheln (Fackel der Nebenhand: dort eintragen) */
  lightBonus = 0;
  /** Debug: aktuelle Werte (lesbar über window.__game) */
  state = { hour: 12, weather: 'clear' as Weather, k: 0, color: '255,255,255', dark: 0 };

  constructor(private scene: Phaser.Scene, private sfx: Sfx) {
    const q = new URLSearchParams(location.search);
    const h = q.get('stunde');
    this.fixedHour = h && Number.isFinite(Number(h)) ? Number(h) : null;
    const w = q.get('wetter');
    this.fixedWeather = w ? ({ regen: 'rain', nebel: 'fog', asche: 'ash', klar: 'clear' } as Record<string, Weather>)[w] ?? null : null;
    // Dunkelheit mit Lichtloch (Multiply): riesig, damit sie bei kleinem Zoom das ganze Bild deckt; weiche Ränder (nicht Nearest)
    if (!scene.textures.exists('atmo_dark')) scene.textures.addCanvas('atmo_dark', holeCanvas())?.setFilter(0);
    this.tint = scene.add.image(0, 0, 'atmo_dark').setScrollFactor(0).setBlendMode(MULTIPLY).setDepth(LIGHT_DEPTH - 1);
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;background:radial-gradient(ellipse at center,rgba(160,176,170,.16) 20%,rgba(150,166,160,.42) 100%)';
    document.body.append(this.veil);
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(1e7 + 6);
  }

  /** Aktuelle Spielstunde 0–24 */
  hour(): number {
    return this.fixedHour ?? this.source?.() ?? ((Date.now() % DAY_MS) / DAY_MS) * 24;
  }

  /** Wie dunkel es draußen ist: 0 am Mittag, 1 tief in der Nacht (für Fenster- und Laternenlicht) */
  night(): number {
    const [r, g, b] = dayColor(this.hour());
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    return Math.max(0, Math.min(1, (1 - lum) * 1.8 - 0.05));
  }

  /** Aktueller Lichtradius des Helden in Kacheln */
  lightTiles(): number {
    return lightRadius(this.zone === 'indoor', this.lightBonus);
  }

  /** Dunkelheit der Umgebung 0–1 (gleitend, gilt für Nacht und Dungeon) */
  dark(): number {
    return this.state.dark;
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
    } else if (this.cur !== 'clear') this.k = Math.min(1, this.k + dt / 1500);
    const rainK = this.cur === 'rain' ? this.k : 0;

    // Farb-Overlay (nur bei sichtbarer Änderung neu gesetzt)
    const [r0, g0, b0] = dayColor(hour);
    // Dungeons: eigene Umgebungsfarbe statt Tageszeit (die Dunkelheit kommt aus dem Lichtbild, nicht mehr aus der Vignette allein)
    const grade = 1 - this.mix.indoor;
    const day = [r0 * (1 - grade * (1 - DARK_GRADE[0])), g0 * (1 - grade * (1 - DARK_GRADE[1])), b0 * (1 - grade * (1 - DARK_GRADE[2]))];
    const [r, g, b] = day.map((c, k) => c! + (DUNGEON_AMBIENT[k]! - c!) * this.mix.indoor) as [number, number, number];
    const lift = this.mix.town * TOWN_LIFT;
    const rain = 1 - 0.14 * rainK;
    const out = [r, g, b].map((c) => Math.round((c + (255 - c) * lift) * rain));
    const q = out.map((c) => Math.min(255, Math.round(c / 2) * 2));
    const ck = q.join(',');
    if (ck !== this.colorKey) {
      this.colorKey = ck;
      this.tint.setTint((q[0]! << 16) | (q[1]! << 8) | q[2]!);
    }
    const fogK = this.cur === 'fog' ? this.k : 0;
    const vk = (Math.round(fogK * 25) / 25).toFixed(2);
    if (vk !== this.veilKey) {
      this.veilKey = vk;
      this.veil.style.opacity = vk;
    }
    this.placeLight();
    this.state = { hour, weather: this.cur, k: this.k, color: ck, dark: darkness(q as [number, number, number]) };

    // Regenrauschen: nur bei spürbarer Änderung an den Ton melden
    const rs = Math.round(rainK * 20);
    if (rs !== this.rainSent) {
      this.rainSent = rs;
      this.sfx.rain(rainK);
    }

    this.draw(dt, rainK, this.cur === 'ash' ? this.k : 0);
  }

  /** Versatz des Helden zur Bildmitte in Weltpixeln: am Kartenrand hält die Kamera an, das Licht bleibt beim Helden */
  private off = { x: 0, y: 0 };
  setFocus(dx: number, dy: number): void {
    this.off.x = Math.round(dx);
    this.off.y = Math.round(dy);
    this.placeLight();
  }

  /** Lichtbild auf den Helden (Bildmitte plus Versatz am Kartenrand), Größe aus dem Lichtradius; deckt immer das ganze Bild */
  private placeLight(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const zoom = this.scene.cameras.main.zoom || 1;
    const { x: ox, y: oy } = this.off;
    const key = `${W}|${H}|${zoom}|${this.lightTiles()}|${ox}|${oy}`;
    if (key === this.placeKey) return;
    this.placeKey = key;
    const rx = (this.lightTiles() * 64) / Math.SQRT2; // Bodenkreis, Halbachse waagerecht in Weltpixeln
    const holeR = (TEX / 2) * HOLE_FRAC;
    const need = Math.max((W / 2 / zoom + 60 + Math.abs(ox)) / (TEX / 2), (H / 2 / zoom + 60 + Math.abs(oy)) / ((TEX / 2) * LIGHT_SQUASH));
    const sx = Math.max(rx / holeR, need);
    // Füße des Helden liegen 22 px unter dem Kameraziel (GameScene: centerOn(sy + FOOT_DY - 22))
    this.tint.setPosition(W / 2 + ox, H / 2 + 22 + oy).setScale(sx, sx * LIGHT_SQUASH);
  }

  private draw(dt: number, rainK: number, ashK: number): void {
    const g = this.gfx;
    g.clear();
    if (rainK <= 0.02 && ashK <= 0.02) return;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const s = dt / 1000;
    if (rainK > 0.02) {
      const want = Math.round(130 * Math.min(1, rainK * 1.4));
      while (this.drops.length < 130) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 760 + Math.random() * 380, s: 9 + Math.random() * 9 });
      g.lineStyle(2, 0xdcecff, Math.min(0.85, 0.85 * Math.min(1, rainK * 1.5)));
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
