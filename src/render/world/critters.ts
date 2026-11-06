/**
 * Harmlose Wildtiere der Wildnis (wildlife.ts) im Kunstraster wie die Props: Reh, Frosch, Fledermaus. Kräftiger Umriss,
 * wenige flache Töne, Licht von oben links; alle Tiere blicken nach rechts (gespiegelt wird beim Anzeigen). Fußpunkt = Unterkante.
 * Die Krähe kommt aus dem Stadtleben (townLife.ts), sie wird dort schon gezeichnet.
 */
import { INK, Raster, h3, type Rgb } from './raster';
import { tone, type Ramp5 } from './props';

const FUR: Ramp5 = [0x2a1a10, 0x4a3220, 0x6c4a2a, 0x8c6438, 0xb4884e];
const GREEN: Ramp5 = [0x0e1a0e, 0x1e3a1a, 0x30581f, 0x4c7a2c, 0x76a043];
const BONE = 0xd8c8a0;

export type DeerPose = 'stand' | 'graze' | 'run0' | 'run1';
export const DEER_POSES: DeerPose[] = ['stand', 'graze', 'run0', 'run1'];

/** Reh (mit kleinem Geweih): Hals und Kopf je nach Haltung, vier Läufe, weißer Spiegel am Hinterteil */
export function deer(pose: DeerPose): Raster {
  const r = new Raster(26, 22);
  const run = pose === 'run0' || pose === 'run1';
  const by = run ? 9 : 10; // Körpermitte
  // Läufe zuerst (hinter dem Körper): vorn rechts, hinten links
  const leg = (x: number, top: number, bot: number, dx = 0): void => {
    for (let y = top; y <= bot; y++) r.set(x + Math.round((dx * (y - top)) / Math.max(1, bot - top)), y, tone(FUR, y > bot - 2 ? 0 : 1));
  };
  if (run) {
    const a = pose === 'run0';
    leg(6, by + 2, 18, a ? -4 : 2); leg(8, by + 2, 18, a ? -2 : 3);
    leg(15, by + 2, 18, a ? 4 : -2); leg(17, by + 2, 18, a ? 5 : -1);
  } else {
    leg(6, by + 2, 18); leg(8, by + 2, 18); leg(15, by + 2, 18); leg(17, by + 2, 18);
  }
  // Rumpf
  r.ellipse(12, by, 8, 4.2, (x, y, nx, ny) => tone(FUR, ny < -0.35 ? 4 : ny > 0.45 ? 2 : nx > 0.4 ? 3 : 3.4));
  r.ellipse(12, by + 2, 6, 1.8, tone(FUR, 4));
  r.ellipse(12, by + 2.6, 5, 1.2, BONE);
  // Spiegel und Schwanz
  r.ellipse(4, by - 1, 1.8, 2.2, BONE);
  r.set(2, by - 2, tone(FUR, 3));
  // Hals und Kopf
  const neck: [number, number, number, number] = pose === 'graze' ? [17, by - 1, 21, by + 5] : [17, by - 2, 20, by - 8];
  for (let o = -1; o <= 1; o++) r.line(neck[0] + o, neck[1], neck[2] + o, neck[3], tone(FUR, 3 + (o < 0 ? 1 : o > 0 ? -1 : 0)));
  const hx = neck[2] + 2;
  const hy = neck[3] + (pose === 'graze' ? 1 : -1);
  r.ellipse(hx, hy, 3, 2.1, (x, y, nx, ny) => tone(FUR, ny < -0.3 ? 4 : 3));
  r.rect(hx + 2, hy, 2, 2, tone(FUR, 2));
  r.set(hx + 3, hy, 0x14100c); // Nase
  r.set(hx + 1, hy - 1, 0x100c08); // Auge
  r.set(hx - 2, hy - 2, tone(FUR, 3)); // Ohr
  r.set(hx - 3, hy - 3, tone(FUR, 3));
  if (pose !== 'graze') {
    // Geweih: zwei Stangen mit Zinken
    r.line(hx - 1, hy - 2, hx - 2, hy - 7, BONE);
    r.line(hx, hy - 2, hx + 1, hy - 6, BONE);
    r.set(hx - 3, hy - 5, BONE);
    r.set(hx + 2, hy - 4, BONE);
  } else {
    r.line(hx - 1, hy - 2, hx - 3, hy - 4, BONE);
  }
  return r.outline(INK);
}

/** Frosch: sitzend (flach, mit Kehlsack) oder im Sprung (gestreckt, Hinterbeine lang) */
export function frog(jump: boolean): Raster {
  const r = new Raster(14, 10);
  if (!jump) {
    r.ellipse(6, 6, 4.6, 3, (x, y, nx, ny) => tone(GREEN, ny < -0.3 ? 4 : ny > 0.4 ? 2 : 3));
    r.ellipse(6, 7.6, 3, 1.1, tone(GREEN, 4));
    r.rect(10, 3, 2, 2, tone(GREEN, 3));
    r.rect(2, 3, 2, 2, tone(GREEN, 3));
    r.set(10, 3, 0xe8d86a);
    r.set(2, 3, 0xe8d86a);
    r.rect(1, 7, 3, 2, tone(GREEN, 2));
    r.rect(8, 8, 4, 1, tone(GREEN, 1));
    for (let i = 0; i < 4; i++) r.set(4 + Math.floor(h3(i, 3, 3) * 5), 5 + (i % 2), tone(GREEN, 1));
  } else {
    r.ellipse(6, 4, 4.2, 2.2, (x, y, nx, ny) => tone(GREEN, ny < -0.2 ? 4 : 3));
    r.rect(9, 1, 2, 2, tone(GREEN, 3));
    r.set(10, 1, 0xe8d86a);
    r.line(3, 5, 0, 8, tone(GREEN, 2));
    r.line(4, 5, 1, 9, tone(GREEN, 1));
    r.line(9, 5, 12, 8, tone(GREEN, 2));
  }
  return r.outline(INK);
}

/** Fledermaus von vorn-seitlich: Flügel oben (0) oder unten (1), Knochenrippen heller, rote Augen */
export function bat(frame: number): Raster {
  const r = new Raster(22, 12);
  const wing: Rgb = 0x2a2236;
  const bone: Rgb = 0x7a6a96;
  const up = frame === 0;
  const y0 = up ? 1 : 6;
  // Flügel: Membran zwischen Fingerknochen und Rumpf
  for (const side of [-1, 1]) {
    const tipX = 11 + side * 10;
    const tipY = y0 + (up ? 0 : 4);
    const fan: [number, number][] = [[tipX, tipY], [11 + side * 7, y0 + (up ? 2 : 3)], [11 + side * 4, y0 + (up ? 3 : 2)]];
    for (const [fx, fy] of fan) {
      for (let t = 0; t <= 1; t += 0.06) {
        const x = Math.round(11 + side * 1 + (fx - 11 - side) * t);
        const y = Math.round(6 + (fy - 6) * t);
        r.set(x, y, bone);
      }
    }
    for (let x = 0; x < 9; x++) {
      const px = 11 + side * (2 + x);
      const top = Math.round(6 + (tipY - 6) * (x / 8) * 0.9);
      const bot = Math.round(7 + 2 - (x > 6 ? 1 : 0));
      for (let y = Math.min(top, 7); y <= Math.max(top, bot); y++) if (!r.filled(px, y)) r.set(px, y, wing);
    }
  }
  r.ellipse(11, 7, 2.6, 3, tone([0x0a0810, 0x14101c, 0x1e1828, 0x2a2236, 0x3a3048], 2));
  r.set(9, 4, 0x2a2236); r.set(13, 4, 0x2a2236);
  r.set(10, 6, 0xe04040); r.set(12, 6, 0xe04040);
  return r.outline(INK);
}

