/**
 * Props der Code-Welt im Kunstraster (Maßstab 2 beim Anzeigen): Bäume, Felsen, Gräber, Säule, Stadt-Props, Zaun und
 * Wände/Klippen. Stil wie der Skelett-Held: kräftiger Umriss (INK), wenige flache Töne aus 5er-Rampen, Licht von oben
 * links, weicher Bodenschatten (halbtransparent) unter stehenden Dingen. Alles deterministisch aus Art + Variante.
 * Bilder stehen unten mittig auf dem Fußpunkt (Unterkante = Boden).
 */
import { ART, INK, Raster, h3, mix, rng, vnoise, type Rgb } from './raster';

export type Ramp5 = readonly [Rgb, Rgb, Rgb, Rgb, Rgb];
/** Ton einer 5er-Rampe zu einer (gerundeten, begrenzten) Stufe */
export const tone = (r: Ramp5, t: number): Rgb => r[Math.max(0, Math.min(4, Math.round(t)))]!;

/* ---------------------------------------------------------------- Rampen (dunkel → hell) */

export const R = {
  leaf: [0x0f1a12, 0x1a2e1a, 0x27421f, 0x385a28, 0x507434],
  leafAutumn: [0x1a160e, 0x2e2814, 0x463a1a, 0x605024, 0x7a6a32],
  leafDark: [0x0b1612, 0x13241a, 0x1c3322, 0x28452a, 0x385a32],
  pine: [0x0a1512, 0x11231b, 0x1a3324, 0x25452c, 0x345a36],
  blossom: [0x24161c, 0x40262f, 0x5e3742, 0x80505c, 0xa07480],
  bark: [0x160e0a, 0x261a12, 0x3a2a1c, 0x503c28, 0x6a5236],
  dead: [0x161210, 0x262019, 0x3a3026, 0x504435, 0x685a48],
  char: [0x080607, 0x110d0e, 0x1c1617, 0x2a2223, 0x3a3031],
  stone: [0x16151a, 0x2a282e, 0x403d45, 0x5a5660, 0x7a7680],
  stoneDark: [0x0e0d10, 0x1c1a1f, 0x2b2830, 0x3c3842, 0x524c58],
  stoneTan: [0x1e1812, 0x362c22, 0x504232, 0x6c5a44, 0x8c785c],
  wood: [0x1a100a, 0x2e1e12, 0x46301c, 0x604428, 0x7c5a36],
  iron: [0x121318, 0x23252c, 0x383b44, 0x545864, 0x7a7e8a],
  cloth: [0x2a0e0e, 0x4a1a18, 0x6e2a24, 0x903c30, 0xb05a44],
  linen: [0x3a3630, 0x5a544a, 0x7a7466, 0x9a9282, 0xbab2a0],
  moss: [0x101a10, 0x1a2a16, 0x26391e, 0x334a26, 0x435c30],
} as const satisfies Record<string, Ramp5>;

/** Bodenschatten: halbtransparente Ellipse (unter das Objekt gelegt, vor dem Umriss) */
function shadow(r: Raster, cx: number, cy: number, rx: number, ry: number, a = 110): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1 && !r.filled(x, y)) r.set(x, y, 0x050406, a);
    }
  }
}

/** Objekt (deckende Pixel) umranden und über einen Schatten legen: Ergebnis ist um 1 px größer */
function finish(obj: Raster, sh?: { cx: number; cy: number; rx: number; ry: number; a?: number }): Raster {
  const o = obj.outline(INK);
  if (!sh) return o;
  const out = new Raster(o.w, o.h);
  shadow(out, sh.cx + 1, sh.cy + 1, sh.rx, sh.ry, sh.a);
  out.blit(o, 0, 0);
  return out;
}

/* ---------------------------------------------------------------- Bäume */

interface Blob { x: number; y: number; r: number }

/**
 * Laubkrone aus überlappenden Ballen: jeder Ballen hell oben links, dunkel unten rechts; Blattbüschel über Rauschen;
 * wo ein vorderer Ballen über einem hinteren liegt, eine dunkle Fuge. `blobs` von hinten nach vorne.
 */
function crown(r: Raster, blobs: Blob[], ramp: Ramp5, seed: number): void {
  const owner = new Int8Array(r.w * r.h).fill(-1);
  blobs.forEach((b, i) => {
    for (let y = Math.floor(b.y - b.r - 1); y <= Math.ceil(b.y + b.r + 1); y++) {
      for (let x = Math.floor(b.x - b.r - 1); x <= Math.ceil(b.x + b.r + 1); x++) {
        if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
        const dx = x + 0.5 - b.x;
        const dy = y + 0.5 - b.y;
        // ausgefranster Rand: Büschel über Winkelrauschen
        const ang = Math.atan2(dy, dx);
        const edge = b.r * (0.86 + 0.2 * vnoise(ang * 3 + i * 5, i, 1, seed));
        if (dx * dx + dy * dy <= edge * edge) owner[y * r.w + x] = i;
      }
    }
  });
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const i = owner[y * r.w + x]!;
      if (i < 0) continue;
      const b = blobs[i]!;
      const nx = (x + 0.5 - b.x) / b.r;
      const ny = (y + 0.5 - b.y) / b.r;
      let t = 2.4 - (nx * 0.9 + ny * 1.1) * 1.25;
      const n = vnoise(x, y, 2.2, seed + 3);
      t += n < 0.3 ? -0.8 : n > 0.72 ? 0.7 : 0;
      // Fuge: Nachbar oben/links gehört einem vorderen Ballen → dunkel
      const up = y > 0 ? owner[(y - 1) * r.w + x]! : -1;
      const lf = x > 0 ? owner[y * r.w + x - 1]! : -1;
      if ((up > i || lf > i) && h3(x, y, seed) < 0.8) t = 0.6;
      r.set(x, y, tone(ramp, t));
    }
  }
}

/** Stamm (senkrecht, leicht konisch) mit Wurzelfuß; Licht links */
function trunk(r: Raster, cx: number, top: number, bottom: number, w: number, ramp: Ramp5, roots = 1): void {
  for (let y = top; y <= bottom; y++) {
    const k = (y - top) / Math.max(1, bottom - top);
    const half = w / 2 + (k > 0.75 ? (k - 0.75) * 4 * roots : 0);
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const u = (x + 0.5 - (cx - half)) / (half * 2);
      let t = u < 0.3 ? 3 : u > 0.75 ? 1 : 2;
      if (h3(x, y, 7) < 0.12) t -= 1; // Rinde
      r.set(x, y, tone(ramp, t));
    }
  }
}

/** Ast als Linie mit Dicke (für tote Bäume) */
function branch(r: Raster, x0: number, y0: number, x1: number, y1: number, ramp: Ramp5, thick = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    for (let k = 0; k < thick; k++) r.set(x + k, y, tone(ramp, k === 0 ? 3 : 1));
  }
}

export type TreeStyle = 'oak' | 'pine' | 'dead' | 'char' | 'oakr' | 'pink' | 'big';

export function tree(style: TreeStyle, v: number): Raster {
  const g = rng(v * 977 + style.length * 31 + 5);
  const W = style === 'big' ? 46 : 36;
  const H = style === 'big' ? 54 : style === 'pine' ? 50 : 46;
  const r = new Raster(W, H);
  const cx = W / 2;
  const base = H - 3;
  if (style === 'pine') {
    trunk(r, cx, base - 9, base, 4, R.bark, 0.6);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const top = 2 + i * 7;
      const bot = top + 12;
      const half = 4 + i * 3 + g() * 1.5;
      for (let y = top; y <= bot; y++) {
        const k = (y - top) / (bot - top);
        const hw = half * k + 1;
        for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
          // hängende Zweigspitzen an der Unterkante
          if (y === bot && h3(x, i, v) < 0.45) continue;
          const u = (x + 0.5 - cx) / hw;
          let t = 2.3 - u * 1.3 - (k > 0.8 ? 0.8 : 0) + (i === 0 ? 0.4 : 0);
          if (vnoise(x, y, 2, v + i) > 0.7) t += 0.6;
          r.set(x, y, tone(R.pine, t));
        }
      }
    }
    return finish(r, { cx, cy: base, rx: 11, ry: 3 });
  }
  if (style === 'dead' || style === 'char') {
    const ramp = style === 'dead' ? R.dead : R.char;
    trunk(r, cx, 14, base, 4, ramp, 1.2);
    const arms: [number, number, number, number][] = [
      [cx - 1, 22, cx - 11 - g() * 3, 12], [cx + 2, 18, cx + 12 + g() * 3, 9], [cx - 1, 15, cx - 6, 4], [cx + 1, 14, cx + 4, 2],
      [cx + 2, 26, cx + 10, 20], [cx - 9, 14, cx - 13, 8], [cx + 11, 11, cx + 15, 6],
    ];
    arms.forEach(([a, b, c, d], i) => branch(r, a, b, Math.round(c), d, ramp, i < 4 ? 2 : 1));
    if (style === 'char') for (let i = 0; i < 4; i++) r.set(Math.floor(cx - 2 + g() * 4), Math.floor(20 + g() * 20), g() < 0.5 ? 0xd8501e : 0x8a2a12);
    else if (v % 2 === 0) for (let i = 0; i < 5; i++) r.set(Math.floor(cx - 2 + g() * 4), Math.floor(24 + g() * 14), tone(R.moss, 3));
    return finish(r, { cx, cy: base, rx: 9, ry: 2.5 });
  }
  const ramp = style === 'pink' ? R.blossom : style === 'oak' && v === 2 ? R.leafAutumn : style === 'oakr' ? R.leafDark : R.leaf;
  const tall = style === 'oakr' ? 8 : 0;
  trunk(r, cx, style === 'big' ? 30 : 24 + tall, base, style === 'big' ? 6 : 5, R.bark, style === 'oakr' ? 1.8 : 1);
  if (style === 'oakr') {
    // sichtbare Wurzeln
    branch(r, cx - 3, base - 1, cx - 7, base, R.bark);
    branch(r, cx + 2, base - 1, cx + 7, base, R.bark);
  }
  const s = style === 'big' ? 1.3 : 1;
  const top = 3;
  const blobs: Blob[] = [
    { x: cx - 8 * s, y: top + 15 * s - tall * 0.3, r: 7 * s },
    { x: cx + 8 * s, y: top + 14 * s - tall * 0.3, r: 7.5 * s },
    { x: cx + 1 + (g() - 0.5) * 2, y: top + 8 * s, r: 8.5 * s },
    { x: cx - 4 * s, y: top + 19 * s - tall * 0.3, r: 7 * s },
    { x: cx + 5 * s, y: top + 20 * s - tall * 0.3, r: 6.5 * s },
  ];
  if (style === 'big') blobs.push({ x: cx - 10, y: top + 24, r: 7 }, { x: cx + 11, y: top + 25, r: 6.5 });
  crown(r, blobs, ramp, v * 13 + 1);
  if (style === 'pink' || (style === 'oak' && v === 1)) {
    // Blüten bzw. Früchte als helle Tupfen
    const dot = style === 'pink' ? 0xc49aa2 : 0x9a3a30;
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(cx - 13 + g() * 26);
      const y = Math.floor(top + 4 + g() * 20);
      if (r.filled(x, y) && r.filled(x + 1, y)) r.set(x, y, dot);
    }
  }
  return finish(r, { cx, cy: base, rx: style === 'big' ? 15 : 12, ry: 3.5 });
}

/* ---------------------------------------------------------------- Felsen, Gräber, Säule */

export type RockStyle = 'grey' | 'dark' | 'tan';

export function rock(style: RockStyle, v: number): Raster {
  const ramp = style === 'grey' ? R.stone : style === 'dark' ? R.stoneDark : R.stoneTan;
  const W = 26;
  const H = 21;
  const r = new Raster(W, H);
  const cx = W / 2;
  const rx = 9.5 + (v % 3) - (v === 2 ? 2.5 : 0);
  const ry = 7.5 + (v === 1 ? 1.5 : 0);
  const cy = H - 2 - ry;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const ang = Math.atan2(ny, nx);
      // kantige Kontur: Winkelrauschen grob gestuft
      const k = 0.8 + 0.25 * Math.round(vnoise(ang * 2.2, v, 1, 40 + v) * 4) / 4;
      const d = nx * nx + ny * ny;
      if (d > k * k || y > H - 3) continue;
      // Facetten: Licht oben links, eine Kante quer
      let t = 2.6 - nx * 1 - ny * 1.4;
      if (nx + ny * 0.3 > 0.35 - (v % 2) * 0.3) t -= 0.9;
      if (ny < -0.45) t += 0.6;
      if (h3(x, y, v + 9) < 0.06) t -= 1;
      r.set(x, y, tone(ramp, t));
    }
  }
  if (style === 'grey') for (let i = 0; i < 5; i++) { const x = Math.floor(cx - 5 + h3(i, v, 3) * 10); const y = Math.floor(cy - 3 + h3(i, v, 4) * 3); if (r.filled(x, y)) r.set(x, y, tone(R.moss, 3)); }
  return finish(r, { cx, cy: H - 3, rx: rx + 1, ry: 2.5, a: 90 });
}

export function grave(v: number): Raster {
  const r = new Raster(16, 22);
  const k = v % 3;
  if (k === 0) {
    // Grabstein, oben gerundet, eingeritztes Kreuz
    for (let y = 4; y < 20; y++) {
      for (let x = 3; x < 13; x++) {
        if (y < 7 && (x - 7.5) ** 2 + (y - 7) ** 2 > 22) continue;
        r.set(x, y, tone(R.stone, x < 5 ? 4 : x > 10 ? 2 : 3));
      }
    }
    r.rect(7, 8, 2, 7, R.stone[1]);
    r.rect(5, 10, 6, 2, R.stone[1]);
  } else if (k === 1) {
    // Holzkreuz
    r.rect(7, 3, 3, 17, R.wood[3]);
    r.rect(7, 3, 1, 17, R.wood[4]);
    r.rect(3, 7, 11, 3, R.wood[3]);
    r.rect(3, 7, 11, 1, R.wood[4]);
    r.rect(9, 3, 1, 17, R.wood[1]);
  } else {
    // Stele mit Spitze, Moos
    for (let y = 2; y < 20; y++) {
      const hw = y < 6 ? (y - 1) * 0.7 : 3;
      for (let x = Math.floor(8 - hw); x < Math.ceil(8 + hw); x++) r.set(x, y, tone(R.stoneDark, x < 7 ? 4 : x > 8 ? 2 : 3));
    }
    for (let i = 0; i < 4; i++) r.set(6 + (i % 3), 15 + (i >> 1) * 2, R.moss[3]);
  }
  // Erdhügel
  r.rect(2, 19, 12, 2, R.stoneTan[1]);
  r.rect(3, 19, 10, 1, R.stoneTan[2]);
  return finish(r, { cx: 8, cy: 20, rx: 7, ry: 2, a: 90 });
}

export function pillar(): Raster {
  const r = new Raster(14, 36);
  for (let y = 3; y < 33; y++) for (let x = 3; x < 11; x++) r.set(x, y, tone(R.stone, x < 5 ? 4 : x > 8 ? 1 : x > 7 ? 2 : 3));
  for (let y = 6; y < 31; y += 5) r.rect(3, y, 8, 1, R.stone[1]);
  r.rect(1, 0, 12, 3, R.stone[3]);
  r.rect(1, 0, 12, 1, R.stone[4]);
  r.rect(1, 2, 12, 1, R.stone[1]);
  r.rect(1, 32, 12, 3, R.stone[2]);
  r.rect(1, 34, 12, 1, R.stone[1]);
  return finish(r, { cx: 7, cy: 34, rx: 7, ry: 2 });
}

/* ---------------------------------------------------------------- Stadt */

/** Holzfass von vorne: Dauben, zwei Eisenreifen, Deckel oben */
export function barrel(): Raster {
  const r = new Raster(14, 16);
  for (let y = 3; y < 15; y++) {
    const bulge = y > 5 && y < 12 ? 1 : 0;
    for (let x = 2 - bulge; x < 12 + bulge; x++) {
      const u = (x - 1) / 11;
      r.set(x, y, tone(R.wood, u < 0.25 ? 4 : u > 0.75 ? 1 : (x % 3 === 0 ? 2 : 3)));
    }
  }
  r.ellipse(7, 3, 5, 2, R.wood[3]);
  r.ellipse(7, 3, 3.5, 1.2, R.wood[2]);
  for (const y of [5, 11]) r.rect(1, y, 12, 1, R.iron[2]);
  r.set(2, 5, R.iron[4]);
  r.set(2, 11, R.iron[4]);
  return finish(r, { cx: 7, cy: 14, rx: 6, ry: 2 });
}

/** Zwei gestapelte Kisten */
export function crates(): Raster {
  const r = new Raster(20, 18);
  const box = (x0: number, y0: number, w: number, h: number): void => {
    r.rect(x0, y0, w, h, R.wood[3]);
    r.rect(x0, y0, w, 2, R.wood[4]);
    r.rect(x0, y0 + h - 1, w, 1, R.wood[1]);
    r.rect(x0, y0, 1, h, R.wood[2]);
    r.rect(x0 + w - 1, y0, 1, h, R.wood[1]);
    r.line(x0 + 1, y0 + 2, x0 + w - 2, y0 + h - 2, R.wood[2]);
    r.rect(x0 + 1, y0 + Math.floor(h / 2), w - 2, 1, R.wood[2]);
  };
  box(1, 7, 10, 10);
  box(10, 9, 9, 8);
  box(4, 1, 8, 7);
  return finish(r, { cx: 10, cy: 16, rx: 9, ry: 2 });
}

/** Brunnen: Steinring mit dunklem Wasser, zwei Pfosten, kleines Dach, Eimer */
export function well(): Raster {
  const r = new Raster(26, 30);
  // Dach
  for (let y = 0; y < 7; y++) for (let x = 3 + (6 - y); x < 23 - (6 - y); x++) r.set(x, y, tone(R.cloth, y < 2 ? 3 : y > 5 ? 1 : 2));
  r.rect(2, 6, 22, 2, R.wood[2]);
  // Pfosten, Welle, Seil, Eimer
  r.rect(5, 8, 2, 12, R.wood[3]);
  r.rect(19, 8, 2, 12, R.wood[2]);
  r.rect(6, 10, 14, 1, R.wood[1]);
  r.rect(12, 11, 1, 5, R.linen[2]);
  r.rect(11, 15, 3, 3, R.wood[2]);
  // Steinring
  for (let y = 18; y < 28; y++) {
    for (let x = 2; x < 24; x++) {
      const nx = (x + 0.5 - 13) / 11;
      const ny = (y + 0.5 - 21) / 4;
      if (y < 21 && nx * nx + ny * ny > 1) continue;
      const brick = (Math.floor(x / 4) + (y >> 1)) % 2;
      r.set(x, y, tone(R.stone, (y === 18 || y === 19 ? 4 : 2) + (brick ? 0 : -0.4) + (x < 6 ? 0.6 : x > 20 ? -0.8 : 0)));
    }
  }
  r.ellipse(13, 20, 8, 1.6, 0x0c1420);
  for (let y = 22; y < 28; y += 3) r.rect(2, y, 22, 1, R.stone[1]);
  return finish(r, { cx: 13, cy: 27, rx: 12, ry: 2.5 });
}

/** Laterne auf Pfahl; das Licht selbst ist ein eigenes Bild (`lanternGlow`), damit es nachts aufleuchten kann */
export function lantern(): Raster {
  const r = new Raster(10, 34);
  r.rect(4, 10, 2, 22, R.iron[2]);
  r.rect(4, 10, 1, 22, R.iron[3]);
  r.rect(2, 31, 6, 2, R.iron[1]);
  r.rect(2, 1, 6, 1, R.iron[2]);
  r.rect(3, 0, 4, 1, R.iron[3]);
  r.rect(2, 2, 6, 7, R.iron[1]);
  r.rect(3, 3, 4, 5, 0xf0c060);
  r.rect(4, 4, 2, 3, 0xfff0b0);
  r.rect(2, 9, 6, 1, R.iron[2]);
  return finish(r, { cx: 5, cy: 32, rx: 4, ry: 1.5 });
}

/** Lichtschein (weich, halbtransparent, wird additiv geblendet) */
export function glow(rad: number, col: Rgb, a = 120): Raster {
  const n = rad * 2;
  const r = new Raster(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - rad, y + 0.5 - rad) / rad;
      if (d >= 1) continue;
      // gestufte Ringe statt Verlauf (Pixel-Look)
      const k = d < 0.35 ? 1 : d < 0.65 ? 0.55 : 0.25;
      r.set(x, y, col, Math.round(a * k));
    }
  }
  return r;
}

/** Marktstand: gestreiftes Tuchdach, Pfosten, Tresen mit Waren */
export function stall(): Raster {
  const r = new Raster(34, 30);
  for (let y = 0; y < 9; y++) {
    for (let x = 1; x < 33; x++) {
      const stripe = Math.floor((x - 1) / 4) % 2;
      const k = y < 2 ? 4 : y > 6 ? 1 : 3;
      r.set(x, y, stripe ? tone(R.linen, k - 0.5) : tone(R.cloth, k));
    }
  }
  for (let x = 1; x < 33; x += 4) r.rect(x, 9, 2, 1, Math.floor((x - 1) / 4) % 2 ? R.linen[1] : R.cloth[1]); // Zackenkante
  r.rect(3, 10, 2, 18, R.wood[3]);
  r.rect(29, 10, 2, 18, R.wood[2]);
  r.rect(2, 18, 30, 9, R.wood[3]);
  r.rect(2, 18, 30, 2, R.wood[4]);
  r.rect(2, 26, 30, 1, R.wood[1]);
  for (let x = 6; x < 30; x += 7) r.rect(x, 20, 1, 6, R.wood[2]);
  const goods: [number, Rgb][] = [[5, 0x9a3a30], [9, 0xb8963a], [14, 0x4a7a3a], [19, 0xa86a2a], [24, 0x7a5a8a]];
  for (const [x, c] of goods) { r.rect(x, 15, 4, 3, c); r.rect(x, 15, 4, 1, mix(c, 0xffffff, 0.3)); }
  return finish(r, { cx: 17, cy: 28, rx: 16, ry: 2.5 });
}

/** Holzpfahl im Wasser (Anleger) */
export function post(): Raster {
  const r = new Raster(8, 20);
  r.rect(2, 2, 4, 17, R.wood[2]);
  r.rect(2, 2, 1, 17, R.wood[4]);
  r.rect(5, 2, 1, 17, R.wood[1]);
  r.rect(1, 1, 6, 2, R.wood[3]);
  r.rect(2, 7, 4, 1, R.iron[2]);
  r.rect(2, 15, 4, 2, 0x2a4a44); // Algen an der Wasserlinie
  return finish(r);
}

/** Blumenkasten */
export function flowerBox(): Raster {
  const r = new Raster(20, 12);
  r.rect(1, 6, 18, 5, R.wood[2]);
  r.rect(1, 6, 18, 1, R.wood[4]);
  r.rect(1, 10, 18, 1, R.wood[1]);
  const cols = [0xa86a80, 0xc8b35a, 0xc8c4b4, 0x7a6a9e, 0xb0603a];
  for (let i = 0; i < 8; i++) {
    r.rect(2 + i * 2, 4, 2, 2, R.leaf[3]);
    r.set(2 + i * 2 + (i % 2), 2 + (i % 2), cols[i % cols.length]!);
    r.set(2 + i * 2 + (i % 2), 3 + (i % 2), R.leaf[2]);
  }
  return finish(r);
}

/** Ruderboot von oben schräg: Rumpf, Bänke, Ruder */
export function boat(): Raster {
  const r = new Raster(36, 16);
  for (let y = 2; y < 14; y++) {
    for (let x = 1; x < 35; x++) {
      const nx = (x + 0.5 - 18) / 17;
      const ny = (y + 0.5 - 8) / 6;
      if (nx * nx + ny * ny * 0.6 > 1 || Math.abs(ny) > 1) continue;
      const rim = nx * nx + ny * ny * 0.6 > 0.62;
      r.set(x, y, rim ? tone(R.wood, ny < 0 ? 4 : 2) : tone(R.wood, 1 + (x % 5 === 0 ? -1 : 0.4)));
    }
  }
  for (const x of [11, 18, 25]) r.rect(x, 4, 2, 9, R.wood[3]);
  r.line(8, 3, 2, 0, R.wood[4]);
  r.line(28, 13, 34, 15, R.wood[4]);
  return finish(r);
}

/** Segelschiff am Kai: Rumpf mit Planken, Mast, gerefftes Segel, Flagge */
export function ship(): Raster {
  const r = new Raster(64, 60);
  // Rumpf
  for (let y = 38; y < 56; y++) {
    const inset = Math.max(0, y - 48) * 1.6;
    for (let x = Math.floor(4 + inset); x < Math.ceil(60 - inset); x++) {
      const t = y < 40 ? 4 : y > 52 ? 1 : (y % 3 === 0 ? 2 : 3);
      r.set(x, y, tone(R.wood, t - (x > 54 ? 1 : 0)));
    }
  }
  r.rect(1, 35, 10, 5, R.wood[3]); // Heck
  r.rect(52, 36, 10, 4, R.wood[3]); // Bug
  for (let i = 0; i < 6; i++) r.rect(10 + i * 8, 44, 3, 3, 0x120c08); // Ruderpforten
  // Masten und Segel
  r.rect(30, 4, 3, 34, R.wood[2]);
  r.rect(30, 4, 1, 34, R.wood[4]);
  r.rect(14, 14, 2, 24, R.wood[2]);
  for (let y = 8; y < 30; y++) {
    const bow = Math.round(Math.sin(((y - 8) / 22) * Math.PI) * 3);
    for (let x = 19 - bow; x < 45 + bow; x++) {
      const t = x < 24 ? 4 : x > 40 ? 2 : 3;
      r.set(x, y, (y > 16 && y < 20) ? tone(R.cloth, t - 0.5) : tone(R.linen, t));
    }
  }
  for (let y = 18; y < 32; y++) for (let x = 6; x < 14; x++) r.set(x, y, tone(R.linen, x < 8 ? 4 : 2.6));
  r.rect(33, 1, 7, 4, R.cloth[3]);
  r.rect(33, 1, 7, 1, R.cloth[4]);
  return finish(r);
}

/** Niedriger Holzzaun, eine Kachel breit: zwei Querlatten, Pfosten mit Spitze links */
export function fence(v: number): Raster {
  const r = new Raster(ART, 13);
  const ramp = v % 2 ? R.wood : R.dead;
  for (const y of [4, 8]) {
    r.rect(0, y, ART, 2, ramp[3]);
    r.rect(0, y, ART, 1, ramp[4]);
  }
  for (const x of [1, 12]) {
    r.rect(x, 1, 3, 11, ramp[2]);
    r.rect(x, 1, 1, 11, ramp[4]);
    r.set(x + 1, 0, ramp[3]);
  }
  return r.outline(INK);
}

/* ---------------------------------------------------------------- Wände */

export type WallStyle = 'cliff' | 'brick' | 'dungeon';

interface WallPal { top: Ramp5; face: Ramp5; mortar: Rgb }
const WALLS: Record<WallStyle, WallPal> = {
  cliff: { top: [0x0e0e0e, 0x181816, 0x22221e, 0x2e2e28, 0x5a5a4c], face: [0x141216, 0x231f22, 0x332d30, 0x463e40, 0x5c5254], mortar: 0x0e0d10 },
  brick: { top: [0x0e0c10, 0x18151a, 0x221e24, 0x2e2830, 0x625866], face: [0x17141a, 0x28222a, 0x3a3240, 0x4e4454, 0x665a6a], mortar: 0x100c10 },
  dungeon: { top: [0x070609, 0x0e0d12, 0x15131a, 0x1e1b24, 0x46404e], face: [0x0e0d12, 0x1a1820, 0x27242e, 0x35313e, 0x48424f], mortar: 0x070608 },
};

/** Periode der Wandmuster in Kacheln */
const WP = 4;
const wallCache = new Map<string, Raster>();

/** Höhe der Frontfläche (Kunstpixel) einer Wand, deren Südnachbar offen ist */
const FACE = 16;

/**
 * Wandkachel in schräger Draufsicht. `open`: Bits N=1, O=2, S=4, W=8 für Nachbarn, die keine Wand sind. Oberseite mit
 * Steinplatten (Klippe: Fels mit Moos), an offenen Seiten eine helle Kante; zur offenen Südseite eine Frontfläche aus
 * Quadern bzw. Felsschichten mit dunklem Fuß. Ergebnis 24x24, gecacht (nicht verändern).
 */
export function wallTile(style: WallStyle, open: number, wxAbs: number, wyAbs: number): Raster {
  // Muster wiederholt sich alle 4 Kacheln: so reichen wenige Bilder je Stil und Nachbarmaske (Cache)
  const wx = ((wxAbs % WP) + WP) % WP;
  const wy = ((wyAbs % WP) + WP) % WP;
  const key = `${style}_${open}_${wx}_${wy}`;
  const hit = wallCache.get(key);
  if (hit) return hit;
  const v = (wx * 7 + wy) % 3;
  const P = WALLS[style];
  const r = new Raster(ART, ART);
  const faceTop = open & 4 ? ART - FACE : ART;
  // Oberseite
  for (let y = 0; y < faceTop; y++) {
    for (let x = 0; x < ART; x++) {
      const gx = wx * ART + x;
      const gy = wy * ART + y;
      let t: number;
      // Oberseite = Masse der Wand: dunkel, leise Textur (Fels bzw. grobe Blöcke), damit sie nicht wie Boden wirkt
      if (style === 'cliff') {
        const n = vnoise(gx, gy, 6, 77, WP * ART);
        t = n < 0.35 ? 1 : n > 0.66 ? 3 : 2;
      } else {
        const row = Math.floor(gy / 8);
        const off = (row % 2) * 6;
        const fx = (gx + off) % 12;
        const fy = gy % 8;
        t = fx === 11 || fy === 7 ? 0 : h3(Math.floor(((gx + off) % (WP * ART)) / 12), row, 3) < 0.3 ? 2.4 : 1.8;
      }
      // Kanten zu offenen Seiten: hell (oben/links), dunkel (rechts)
      if ((open & 1 && y === 0) || (open & 8 && x === 0)) t = 4;
      else if ((open & 1 && y === 1) || (open & 8 && x === 1)) t = Math.max(t, 3.2);
      else if (open & 2 && x === ART - 1) t = 0.8;
      r.set(x, y, tone(P.top, t));
    }
  }
  if (style === 'cliff') {
    // Moos und Grasbüschel auf der Klippe
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(h3(wx, wy, 30 + i) * (ART - 3));
      const y = Math.floor(h3(wx, wy, 40 + i) * (faceTop - 3));
      if (h3(wx, wy, 50 + i) < 0.5) { r.set(x, y, R.moss[3]); r.set(x + 1, y, R.moss[2]); r.set(x, y + 1, R.moss[2]); }
    }
  }
  if (open & 4) {
    // Frontfläche: helle Abrisskante, Quader/Felsschichten, dunkler Fuß
    for (let y = faceTop; y < ART; y++) {
      const fy = y - faceTop;
      for (let x = 0; x < ART; x++) {
        const gx = wx * ART + x;
        let t: number;
        if (fy === 0) t = 0.4;
        else if (y >= ART - 2) t = y === ART - 1 ? 0 : 0.6;
        else if (style === 'cliff') {
          const strata = vnoise(gx, fy * 3, 4, 90 + v, WP * ART);
          t = 1.4 + strata * 2 - (fy > 5 ? 0.6 : 0);
          if (h3(gx, fy, 91) < 0.07) t = 0.6;
        } else {
          // Quader in Lagen zu 5 px, versetzt; Oberkante jedes Quaders hell
          const course = Math.floor((fy - 1) / 5);
          const cy = (fy - 1) % 5;
          const off = (course % 2) * 6;
          const bx = (gx + off) % 12;
          const joint = bx === 11 || cy === 4;
          t = joint ? 0.5 : cy === 0 ? 3.2 : bx === 0 ? 2.8 : 2.1;
          if (!joint && h3(Math.floor(((gx + off) % (WP * ART)) / 12), course + wy * 7, 92) < 0.25) t -= 0.6;
          if (style === 'dungeon' && !joint && h3(gx, fy + wy * 31, 93) < 0.04) t = 0.8;
        }
        if (open & 8 && x === 0) t = Math.min(4, t + 1);
        if (open & 2 && x === ART - 1) t = Math.max(0, t - 1);
        r.set(x, y, tone(P.face, t));
      }
    }
  }
  wallCache.set(key, r);
  return r;
}
