/**
 * Gemeinsames Backen der Skelett-Figuren (Held, Monster, NPCs): eine Figur liefert je Animation/Ansicht/Bild die Pixel
 * eines Rigs (`heroRig.js` für Zweibeiner, `monsterRig.js` für Tiere) und eine Farbe je Teil; daraus wird ein RGBA-Sheet bei 1x.
 * Zeilen = Ansicht (Seite, zur Kamera, weg; links = Seite gespiegelt), Spalten = Animationen hintereinander.
 * Reine Rechnung ohne DOM: läuft in Node (Kontaktbögen, Tests) und im Browser. Backen geht auch Bild für Bild (`FigureBaker`),
 * damit das Spiel die Arbeit über mehrere Frames verteilen kann.
 */
import { SHADE, type Posed } from './heroRig.js';

export type FigView = 'side' | 'front' | 'back';
export type FigAnim = 'idle' | 'walk' | 'attack' | 'hit' | 'die';
export const FIG_VIEWS: FigView[] = ['side', 'front', 'back'];
export const FIG_ANIMS: FigAnim[] = ['idle', 'walk', 'attack', 'hit', 'die'];

/** Farbverlauf hell -> dunkel, 5. Wert = Naht */
export type Ramp = readonly [number, number, number, number, number];

export interface FigureSpec {
  key: string;
  /** Bildgröße und Fußpunkt bei 1x */
  frame: { w: number; h: number; fx: number; fy: number };
  /** Bilder je Animation */
  anims: Record<FigAnim, number>;
  /** Pixel eines Bildes (Fußpunkt bei 0,0, Blick nach rechts) */
  render(anim: FigAnim, view: FigView, i: number): Posed;
  /** Farbverlauf je Teilnummer; fehlt einer, gilt `fallback` */
  mats: Record<number, Ramp>;
  fallback: Ramp;
  /** Umriss, Augen, Brustmarke */
  outline: number;
  eye: number;
  mark: number;
  /** Teile, die nicht zur Körperbreite zählen (Waffen) */
  loose?: Set<number>;
  /** Strecke je Laufzyklus in Bildschirm-Pixeln (Pixelmaßstab 2x), Ausholbilder des Angriffs */
  cyclePx: number;
  wind: number;
  /** auch Vorder-/Rückansicht nach Laufrichtung spiegeln (Tiere: schräg gedreht, nicht symmetrisch) */
  mirrorAll?: boolean;
}

export interface FigureSheet {
  key: string;
  /** Breite/Höhe des Sheets bei 1x */
  w: number;
  h: number;
  data: Uint8ClampedArray;
  /** Bildname `${anim}_${view}_${i}` -> Ecke links oben bei 1x */
  frames: Record<string, { x: number; y: number }>;
  frame: FigureSpec['frame'];
  anims: Record<FigAnim, number>;
  /** Kopfhöhe über dem Fußpunkt und Körperbreite im Stehen (ohne Waffe), 1x */
  top: number;
  bodyW: number;
  /** Pixel, die außerhalb ihres Bildes lagen (sollte 0 sein) */
  clipped: number;
  cyclePx: number;
  wind: number;
  mirrorAll: boolean;
}

const cols = (anims: Record<FigAnim, number>): number => FIG_ANIMS.reduce((n, a) => n + anims[a], 0);

/** Farbe eines Rig-Pixels */
export function pixelColor(spec: FigureSpec, sh: number, part: number, steel: number): number {
  if (sh === SHADE.INK) return spec.outline;
  if (sh === SHADE.STEEL) return steel;
  if (sh === SHADE.MARK) return spec.mark;
  if (sh === SHADE.EYE) return spec.eye;
  const ramp = spec.mats[part] ?? spec.fallback;
  return sh === SHADE.SEAM ? ramp[4] : ramp[sh >= SHADE.CORE ? Math.min(3, sh - SHADE.CORE + 1) : sh]!;
}

/** Backt ein Sheet Bild für Bild: `step()` backt das nächste Bild und meldet, ob noch welche fehlen. */
export class FigureBaker {
  readonly sheet: FigureSheet;
  private jobs: { anim: FigAnim; view: FigView; i: number; ox: number; oy: number }[] = [];
  constructor(private spec: FigureSpec) {
    const { w: FW, h: FH } = spec.frame;
    const W = FW * cols(spec.anims);
    const H = FH * FIG_VIEWS.length;
    this.sheet = { key: spec.key, w: W, h: H, data: new Uint8ClampedArray(W * H * 4), frames: {}, frame: spec.frame, anims: spec.anims, top: 0, bodyW: 0, clipped: 0, cyclePx: spec.cyclePx, wind: spec.wind, mirrorAll: !!spec.mirrorAll };
    FIG_VIEWS.forEach((view, row) => {
      let col = 0;
      for (const anim of FIG_ANIMS) {
        for (let i = 0; i < spec.anims[anim]; i++, col++) {
          this.sheet.frames[`${anim}_${view}_${i}`] = { x: col * FW, y: row * FH };
          // Stehbilder zuerst: sie bestimmen Kopfhöhe und Breite (Schatten, Namen), und das Spiel kann früh etwas zeigen
          const job = { anim, view, i, ox: col * FW, oy: row * FH };
          if (anim === 'idle') this.jobs.unshift(job);
          else this.jobs.push(job);
        }
      }
    });
  }
  get done(): boolean {
    return this.jobs.length === 0;
  }
  step(): boolean {
    const job = this.jobs.shift();
    if (!job) return false;
    const { spec, sheet } = this;
    const { w: FW, h: FH, fx: FX, fy: FY } = spec.frame;
    const r = spec.render(job.anim, job.view, job.i);
    let bx0 = 1e9;
    let bx1 = -1e9;
    for (let k = 0; k < r.n; k++) {
      const x = r.xs[k]! + FX;
      const y = r.ys[k]! + FY;
      if (x < 0 || y < 0 || x >= FW || y >= FH) {
        sheet.clipped++;
        continue;
      }
      const part = r.part[k]!;
      const c = pixelColor(spec, r.shade[k]!, part, r.color[k]!);
      const o = ((job.oy + y) * sheet.w + job.ox + x) * 4;
      sheet.data[o] = (c >> 16) & 255;
      sheet.data[o + 1] = (c >> 8) & 255;
      sheet.data[o + 2] = c & 255;
      sheet.data[o + 3] = 255;
      if (job.anim === 'idle' && !spec.loose?.has(part)) {
        bx0 = Math.min(bx0, x);
        bx1 = Math.max(bx1, x);
        sheet.top = Math.max(sheet.top, FY - y);
      }
    }
    if (job.anim === 'idle' && bx1 >= bx0) sheet.bodyW = Math.max(sheet.bodyW, bx1 - bx0 + 1);
    return this.jobs.length > 0;
  }
}

export function bakeFigure(spec: FigureSpec): FigureSheet {
  const b = new FigureBaker(spec);
  while (b.step()) { /* weiter */ }
  return b.sheet;
}

/**
 * Laufbild aus der zurückgelegten Strecke (Bildschirm-Pixel), damit die Füße nicht gleiten: ein Zyklus = `cyclePx`.
 */
export function walkFrame(dist: number, n: number, cyclePx: number): number {
  return ((Math.floor((dist / cyclePx) * n) % n) + n) % n;
}

/** Angriffsbild aus dem Fortschritt 0..1: Ausholen bis 0,4 (`wind` Bilder), ab dort Schlag und Ausschwingen. */
export function attackFrame(k: number, n: number, wind: number): number {
  if (k < 0.4) return Math.min(wind - 1, Math.floor((k / 0.4) * wind));
  return Math.min(n - 1, wind + Math.floor(((k - 0.4) / 0.6) * (n - wind)));
}

/** Bild einer Animation mit fester Dauer (ms) aus der vergangenen Zeit, bleibt auf dem letzten stehen */
export function onceFrame(elapsed: number, n: number, ms: number): number {
  return Math.max(0, Math.min(n - 1, Math.floor((elapsed / ms) * n)));
}

/**
 * Fuß in Phase p (0..1): Standbein gleitet mit `stance` Anteil des Zyklus von +stride nach -stride zurück, Schwungbein hebt sich.
 * Bei stance < 0,5 gibt es Flugphasen (Laufschritt). Der Körper legt je Zyklus `2 * stride / stance` zurück (`cycleLength`).
 */
export function gaitFoot(p: number, stride: number, lift: number, stance: number): { x: number; y: number; toe: boolean } {
  const q = ((p % 1) + 1) % 1;
  if (q < stance) return { x: stride - (q / stance) * 2 * stride, y: 0, toe: q > stance * 0.75 };
  const s = (q - stance) / (1 - stance);
  const e = 0.5 - 0.5 * Math.cos(s * Math.PI);
  return { x: -stride + e * 2 * stride, y: -Math.sin(s * Math.PI) * lift, toe: false };
}
export const cycleLength = (stride: number, stance: number): number => (2 * stride) / stance;
