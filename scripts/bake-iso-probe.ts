// Probe „Ansicht“: derselbe Stadtausschnitt (Platz, zwei Häuser, Held, NPCs, Monster am Rand) einmal in der jetzigen
// Draufsicht (gleicher Code wie im Spiel: Boden, Häuser, Props, Figuren) und einmal in schräger Iso-Ansicht 2:1 wie in
// alten Online-RPGs. Nur zum Vergleichen, das Spiel bleibt unberührt.
//   npx tsx scripts/bake-iso-probe.ts
// Ausgabe nach probe/iso/ (Bilder + index.html, im Browser als Datei öffnen). Maßstab 2 wie im Spiel.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ART, INK, Raster, bytes, h3, mix, upscale, type Rgb } from '../src/render/world/raster';
import { matOf, paintGround, MATS } from '../src/render/world/ground';
import { stampDetail } from '../src/render/world/details';
import { barrel, crates, lantern, stall, tree, well, R, tone } from '../src/render/world/props';
import { houseDoorRaster, houseRoofRaster, houseWallRaster, lowerKind } from '../src/render/houses';
import { Z } from '../src/render/groundLook';
import { bakeFigure, type FigView, type FigureSheet, type FigureSpec } from '../src/render/figure';
import { bakeHero, heroPose, heroSpec, type HeroLook } from '../src/render/hero';
import { posed } from '../src/render/heroRig.js';
import { monsterSpec } from '../src/render/monster';
import { npcSpec } from '../src/render/npc';
import type { DoorIcon } from '../src/render/town';
// @ts-expect-error reines JS-Hilfsmodul aus dem pixelfx-Klon (nur Skript, nicht im Spiel)
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'probe', 'iso');
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------ Szene (Kacheln) */

const W = 18;
const H = 14;
/** Bodenart als [gid, Zone] wie im Spiel (über matOf) */
const K: Record<string, [number, number]> = { grass: [4, Z.farm], dirt: [7, Z.farm], cobble: [16, Z.none], flags: [1, Z.none] };
const gid = new Uint8Array(W * H).fill(K.grass[0]);
const zone = new Uint8Array(W * H).fill(K.grass[1]);
const setT = (x: number, y: number, k: string): void => {
  gid[y * W + x] = K[k]![0];
  zone[y * W + x] = K[k]![1];
};
for (let y = 0; y < 12; y++) for (let x = 0; x < 15; x++) setT(x, y, 'cobble');
for (let y = 6; y < 9; y++) for (let x = 7; x < 10; x++) setT(x, y, 'flags');
for (let x = 15; x < W; x++) {
  setT(x, 9, 'dirt');
  setT(x, 10, 'dirt');
}

interface HouseDef { x0: number; y0: number; w: number; h: number; variant: number; door: number; icon: DoorIcon; roof: Rgb[] }
const HOUSES: HouseDef[] = [
  // Dachfarben wie die Varianten der Draufsicht (0 Schiefer, 2 Stroh)
  { x0: 1, y0: 1, w: 6, h: 4, variant: 0, door: 3, icon: 'anchor', roof: [0x12141c, 0x22283a, 0x343c52, 0x4a546c, 0x646e86] },
  { x0: 9, y0: 1, w: 6, h: 4, variant: 2, door: 2, icon: 'anvil', roof: [0x1e1a10, 0x3a3220, 0x5a4c30, 0x7a6a44, 0x968658] },
];

type Who = { sheet: FigureSheet; x: number; y: number; view: FigView; flip?: boolean; anim?: 'idle' | 'walk' | 'attack'; i?: number };

const HERO: HeroLook = { armor: 'iron', robe: false, helm: 2, helmMat: 'iron', gloves: 1, legs: 1, weapon: 'sword', weaponTier: 1, shield: 2, cloak: 'red', quiver: false, rar: [1, 2, 2] };

/** Heldensheet mit Schrägansichten (Rig-Drehung 45°) statt Seite/vorn/hinten – Test, ob Iso-Diagonalen ohne neue Kunst gehen */
function heroDiag(h: HeroLook): FigureSheet {
  const base = heroSpec(h);
  const spec: FigureSpec = {
    ...base, key: base.key + '_diag',
    render: (anim, view, i) => {
      const p = heroPose(anim, 'front', i, h);
      // side = schräg zur Kamera (nach rechts unten), back = schräg weg (nach rechts oben)
      if (view === 'side') p.yaw = Math.PI / 4;
      if (view === 'back') { const q = heroPose(anim, 'back', i, h); q.yaw = -Math.PI / 4; return posed(q); }
      return posed(p);
    },
  };
  return bakeFigure(spec);
}

const fig = (spec: FigureSpec | null): FigureSheet => bakeFigure(spec!);
const heroSheet = bakeHero(HERO);
const heroDiagSheet = heroDiag(HERO);
const mirel = fig(npcSpec('merchant', 'Händlerin Mirel'));
const ilse = fig(npcSpec('smith', 'Schmiedin Ilse'));
const joren = fig(npcSpec('quest', 'Hafenmeister Joren'));
const kjorra = fig(npcSpec('trainer', 'Meisterin Kjorra'));
const gob = fig(monsterSpec('goblin'));
const gobS = fig(monsterSpec('goblin_scout'));
const rat = fig(monsterSpec('field_rat'));

/** Figuren auf Kachelmitten (x, y = Fußpunkt in Kacheln) */
function cast(iso: boolean): Who[] {
  return [
    { sheet: iso ? heroDiagSheet : heroSheet, x: 8.5, y: 9.6, view: iso ? 'side' : 'front', anim: 'walk', i: 2 },
    { sheet: mirel, x: 11.5, y: 7.2, view: 'front' },
    { sheet: ilse, x: 12.2, y: 5.7, view: 'side', flip: true },
    { sheet: joren, x: 4.5, y: 5.8, view: 'front' },
    { sheet: kjorra, x: 2.5, y: 9.5, view: 'side' },
    { sheet: gob, x: 16.2, y: 11.6, view: 'side', flip: true, anim: 'walk', i: 1 },
    { sheet: gobS, x: 17.2, y: 12.8, view: 'front' },
    { sheet: rat, x: 15.6, y: 13.2, view: 'side', flip: true },
  ];
}

interface PropDef { img: Raster; x: number; y: number }
const PROPS: PropDef[] = [
  { img: well(), x: 8.5, y: 7.5 },
  { img: stall(), x: 11.5, y: 6.6 },
  { img: lantern(), x: 7.5, y: 5.4 },
  { img: lantern(), x: 13.5, y: 9.5 },
  { img: barrel(), x: 0.6, y: 5.6 },
  { img: crates(), x: 14.4, y: 5.5 },
  { img: tree('oak', 0), x: 16.5, y: 4.5 },
  { img: tree('pine', 1), x: 17.2, y: 7.2 },
  { img: tree('oak', 2), x: 1.5, y: 13.4 },
  { img: tree('oakr', 1), x: 5.5, y: 13.2 },
];

/* ------------------------------------------------ Boden wie im Spiel */

const clampI = (x: number, y: number): number => Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x));
const mat = (x: number, y: number): number => matOf(gid[clampI(x, y)]!, zone[clampI(x, y)]!);
const ground = new Raster(W * ART, H * ART);
paintGround(ground, 0, 0, W, H, { mat, waterDist: () => 3 });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) stampDetail(ground, x, y, gid[y * W + x]!, zone[y * W + x]!, x * ART, y * ART);
void MATS;

/** Figurbild aus dem Sheet in ein Raster stempeln (Fußpunkt bei px, py; gespiegelt bei flip); `put` entscheidet je Pixel */
function stampFig(w: Who, put: (x: number, y: number, c: Rgb, a: number, h: number) => void, px: number, py: number): void {
  const s = w.sheet;
  const f = s.frames[`${w.anim ?? 'idle'}_${w.view}_${w.i ?? 0}`]!;
  const F = s.frame;
  for (let y = 0; y < F.h; y++) {
    for (let x = 0; x < F.w; x++) {
      const o = ((f.y + y) * s.w + f.x + x) * 4;
      const a = s.data[o + 3]!;
      if (!a) continue;
      const c = (s.data[o]! << 16) | (s.data[o + 1]! << 8) | s.data[o + 2]!;
      const dx = w.flip ? F.fx - x : x - F.fx;
      put(px + dx, py + y - F.fy, c, a, F.fy - y);
    }
  }
}

/** Weicher Bodenschatten unter einer Figur (Ellipse, halbtransparent) */
function blob(put: (x: number, y: number) => void, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) put(cx + x, cy + y);
}

/* ------------------------------------------------ Draufsicht (wie im Spiel: Dach + Fassade, Sortierung nach Fuß-y) */

function topDown(): Raster {
  const r = new Raster(W * ART, H * ART);
  r.d.set(ground.d);
  type Draw = { y: number; run: () => void };
  const draws: Draw[] = [];
  for (const hs of HOUSES) {
    draws.push({
      y: (hs.y0 + hs.h) * ART - 1,
      run: () => {
        r.blit(houseRoofRaster(hs.w, hs.h - 1, hs.variant, hs.x0 * 7), hs.x0 * ART, (hs.y0 - 1) * ART);
        for (let rel = 0; rel < hs.w; rel++) {
          if (rel === hs.door) continue;
          r.blit(houseWallRaster('upper', rel === 0 || rel === hs.w - 1 ? 'post' : rel % 2 ? 'win' : 'brace', hs.variant, rel), (hs.x0 + rel) * ART, (hs.y0 + hs.h - 2) * ART);
          r.blit(houseWallRaster('lower', lowerKind(rel, hs.w), hs.variant, rel), (hs.x0 + rel) * ART, (hs.y0 + hs.h - 1) * ART);
        }
        r.blit(houseDoorRaster(hs.icon, hs.variant, true, 3), (hs.x0 + hs.door) * ART, (hs.y0 + hs.h - 2) * ART);
      },
    });
  }
  for (const p of PROPS) draws.push({ y: p.y * ART, run: () => r.blit(p.img, Math.round(p.x * ART - p.img.w / 2), Math.round(p.y * ART - p.img.h + 2)) });
  for (const w of cast(false)) {
    const px = Math.round(w.x * ART);
    const py = Math.round(w.y * ART);
    draws.push({
      y: py,
      run: () => {
        blob((x, y) => r.blend(x, y, 0x050406, 0.45), px, py, Math.round(w.sheet.bodyW * 0.55), 3);
        stampFig(w, (x, y, c) => r.set(x, y, c), px, py);
      },
    });
  }
  draws.sort((a, b) => a.y - b.y).forEach((d) => d.run());
  return r;
}

/* ------------------------------------------------ Iso 2:1 (Kachel 32x16, Wandhöhe 16 px je Einheit, Z-Puffer) */

const TW = 16; // halbe Rautenbreite
const TH = 8; // halbe Rautenhöhe
const UZ = 16; // Pixel je Höheneinheit
const MARGIN_TOP = 64;
const IW = (W + H) * TW;
const IH = (W + H) * TH + MARGIN_TOP + 8;
const OX = H * TW;
const proj = (X: number, Y: number, Zh = 0): [number, number] => [OX + (X - Y) * TW, MARGIN_TOP + (X + Y) * TH - Zh * UZ];

function iso(): Raster {
  const r = new Raster(IW, IH);
  const depth = new Float32Array(IW * IH).fill(-1e9);
  const owner = new Int16Array(IW * IH).fill(-1);
  const put = (x: number, y: number, c: Rgb, d: number, id: number): void => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= IW || y >= IH) return;
    const i = y * IW + x;
    if (d < depth[i]!) return;
    depth[i] = d;
    owner[i] = id;
    r.set(x, y, c);
  };
  // Boden: jedes Bildschirmpixel zurück auf die Draufsicht-Textur (Nachbarpixel)
  for (let v = 0; v < IH; v++) {
    for (let u = 0; u < IW; u++) {
      const a = (u - OX) / TW;
      const b = (v - MARGIN_TOP) / TH;
      const X = (a + b) / 2;
      const Y = (b - a) / 2;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const p = ground.get(Math.floor(X * ART), Math.floor(Y * ART));
      put(u, v, ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255), X + Y, -1);
    }
  }
  // Fläche im Raum (Ursprung O, Kanten E1/E2), shade(s, t) liefert Farbe oder null; Tiefe = X + Y + Z
  const quad = (O: number[], E1: number[], E2: number[], id: number, shade: (s: number, t: number) => Rgb | null): void => {
    const P = (s: number, t: number): number[] => [O[0]! + E1[0]! * s + E2[0]! * t, O[1]! + E1[1]! * s + E2[1]! * t, O[2]! + E1[2]! * s + E2[2]! * t];
    const pts = [P(0, 0), P(1, 0), P(0, 1), P(1, 1)].map((q) => proj(q[0]!, q[1]!, q[2]!));
    const [u0, v0] = proj(O[0]!, O[1]!, O[2]!);
    const [ua, va] = proj(O[0]! + E1[0]!, O[1]! + E1[1]!, O[2]! + E1[2]!);
    const [ub, vb] = proj(O[0]! + E2[0]!, O[1]! + E2[1]!, O[2]! + E2[2]!);
    const m00 = ua - u0, m01 = ub - u0, m10 = va - v0, m11 = vb - v0;
    const det = m00 * m11 - m01 * m10;
    if (Math.abs(det) < 1e-6) return;
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const du = x + 0.5 - u0, dv = y + 0.5 - v0;
        const s = (m11 * du - m01 * dv) / det;
        const t = (-m10 * du + m00 * dv) / det;
        if (s < 0 || t < 0 || s > 1 || t > 1) continue;
        const c = shade(s, t);
        if (c === null) continue;
        const q = P(s, t);
        put(x, y, c, q[0]! + q[1]! + q[2]! + 0.02, id);
      }
    }
  };
  const PL: Rgb[] = [0x3a332c, 0x5a5044, 0x7a6e5c, 0x988a72, 0xb4a68a];
  const TIM = R.wood;
  const ST = R.stone;
  HOUSES.forEach((hs, id) => {
    const X0 = hs.x0, Y0 = hs.y0, X1 = hs.x0 + hs.w, Y1 = hs.y0 + hs.h;
    const WH = 2.1; // Wandhöhe (zwei Geschosse)
    // Fachwerkwand: s läuft entlang der Wand (Kacheln), z in Höheneinheiten
    const wall = (lenTiles: number, light: number, door: number) => (s: number, t: number): Rgb => {
      const along = s * lenTiles;
      const z = t * WH;
      const tile = Math.floor(along);
      const fx = along - tile;
      const lit = light;
      if (door >= 0 && tile === door && fx > 0.22 && fx < 0.78 && z < 1.05) {
        if (z > 0.98 || fx < 0.27 || fx > 0.73) return tone(TIM, 0 + lit);
        return tone(TIM, (Math.floor(fx * 10) % 2 ? 2 : 1.6) + lit);
      }
      if (z < 0.32) return tone(ST, (h3(Math.floor(along * 3), Math.floor(z * 6), id) < 0.3 ? 1.4 : 2) + lit + (Math.floor(z * 6) !== Math.floor((z + 0.03) * 6) ? -1 : 0));
      if (fx < 0.07 || fx > 0.93 || Math.abs(z - 1.05) < 0.06 || z > WH - 0.1) return tone(TIM, 1 + lit);
      const winZ = z > 1.05 ? [1.35, 1.8] : [0.45, 0.88];
      const winOn = z > 1.05 ? tile % 2 === 1 || lenTiles <= 4 : tile % 2 === 0 && tile !== 0 && tile !== Math.floor(lenTiles) - 1;
      if (winOn && fx > 0.32 && fx < 0.68 && z > winZ[0]! && z < winZ[1]!) {
        if (fx < 0.36 || fx > 0.64 || z < winZ[0]! + 0.05 || z > winZ[1]! - 0.05 || Math.abs(fx - 0.5) < 0.02) return tone(TIM, 0.6 + lit);
        return mix(0x1a1e2a, 0xff9a38, 0.18 + (z > 1.05 ? 0.05 : 0));
      }
      // Strebe im Feld ohne Fenster
      if (!winOn && Math.abs((fx - 0.12) / 0.76 - (z > 1.05 ? (z - 1.1) / 0.9 : (z - 0.35) / 0.65)) < 0.07 && fx > 0.1 && fx < 0.9) return tone(TIM, 1 + lit);
      return tone(PL, 2.6 + lit + (h3(Math.floor(along * 16), Math.floor(z * 12), id + 9) < 0.2 ? -0.4 : 0));
    };
    // Südwand (entlang X, lichte Seite), Ostwand (entlang Y, Schattenseite)
    quad([X0, Y1, 0], [hs.w, 0, 0], [0, 0, WH], id, wall(hs.w, 0.4, hs.door));
    quad([X1, Y1, 0], [0, -hs.h, 0], [0, 0, WH], id, wall(hs.h, -0.9, -1));
    // Satteldach, First entlang X, Überstand
    const ov = 0.3;
    const top = WH + 1.5;
    const mid = (Y0 + Y1) / 2;
    const roof = (lift: number) => (s: number, t: number): Rgb => {
      const row = Math.floor(t * 7);
      const col = Math.floor((s * (hs.w + 2 * ov)) * 2.2 + (row % 2) * 0.5);
      const edge = t * 7 - row < 0.18;
      let k = 2 + lift + (h3(col, row, id) < 0.22 ? 0.6 : 0) - (edge ? 0.9 : 0);
      if (t < 0.04) k += 1.2; // Firstkante
      if (t > 0.94) k = 0.4; // Traufbrett
      return tone(hs.roof as unknown as readonly [Rgb, Rgb, Rgb, Rgb, Rgb], k);
    };
    quad([X0 - ov, mid, top], [hs.w + 2 * ov, 0, 0], [0, Y1 + ov - mid, WH - 0.15 - top], id, roof(0.6));
    quad([X0 - ov, mid, top], [hs.w + 2 * ov, 0, 0], [0, Y0 - ov - mid, WH - 0.15 - top], id, roof(-0.6));
    // Ostgiebel (Dreieck auf der Ostwand)
    quad([X1, Y1, WH], [0, -hs.h, 0], [0, 0, top - WH], id, (s, t) => {
      const yy = Math.abs(s - 0.5) * 2; // 0 Mitte, 1 Rand
      if (t > 1 - yy) return null;
      if (t > 1 - yy - 0.08) return tone(TIM, 0.2);
      if (Math.abs(s - 0.5) < 0.03) return tone(TIM, 0.4);
      return tone(PL, 1.7 + (h3(Math.floor(s * 40), Math.floor(t * 20), id) < 0.2 ? -0.4 : 0));
    });
    // Schornstein
    const cx = X0 + hs.w * 0.7;
    quad([cx, mid + 0.35, top - 0.7], [0.5, 0, 0], [0, 0, 1.3], id, (s, t) => tone(ST, 2.2 + (Math.floor(t * 8) % 2 ? -0.5 : 0)));
    quad([cx + 0.5, mid + 0.35, top - 0.7], [0, -0.5, 0], [0, 0, 1.3], id, (s, t) => tone(ST, 1.2 + (Math.floor(t * 8) % 2 ? -0.5 : 0)));
    quad([cx, mid + 0.35, top + 0.6], [0.5, 0, 0], [0, -0.5, 0], id, () => tone(ST, 0.4));
  });
  // Umriss der Häuser (wie die Code-Welt: kräftige dunkle Kante gegen alles davor/dahinter)
  const ink: number[] = [];
  for (let y = 1; y < IH - 1; y++) for (let x = 1; x < IW - 1; x++) {
    const i = y * IW + x;
    if (owner[i]! < 0) continue;
    for (const j of [i - 1, i + 1, i - IW, i + IW]) if (owner[j] !== owner[i] && depth[j]! < depth[i]!) { ink.push(i); break; }
  }
  for (const i of ink) r.d[i] = r.d[i]! & 0xff000000 | (INK & 0xff) << 16 | (INK & 0xff00) | (INK >> 16 & 0xff);
  // Props und Figuren als stehende Bilder (Tiefe = Fuß X + Y + Höhe über dem Boden)
  for (const p of PROPS) {
    const [px, py] = proj(p.x, p.y);
    const foot = p.x + p.y;
    for (let y = 0; y < p.img.h; y++) for (let x = 0; x < p.img.w; x++) {
      const v = p.img.get(x, y);
      const a = v >>> 24;
      if (!a) continue;
      const c = ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
      const hh = (p.img.h - 2 - y) / UZ;
      const sx = Math.round(px - p.img.w / 2 + x), sy = Math.round(py - p.img.h + 2 + y);
      if (a < 255) { const i = sy * IW + sx; if (sx >= 0 && sy >= 0 && sx < IW && sy < IH && depth[i]! <= foot + Math.max(0, hh) + 0.3) r.blend(sx, sy, c, a / 255); continue; }
      put(sx, sy, c, foot + Math.max(0, hh) + 0.3, -2);
    }
  }
  for (const w of cast(true)) {
    const [px, py] = proj(w.x, w.y);
    const foot = w.x + w.y;
    blob((x, y) => { const i = y * IW + x; if (depth[i]! <= foot + 0.05) r.blend(x, y, 0x050406, 0.45); }, Math.round(px), Math.round(py), Math.round(w.sheet.bodyW * 0.55), 3);
    stampFig(w, (x, y, c, _a, hgt) => put(x, y, c, foot + hgt / UZ + 0.3, -3), Math.round(px), Math.round(py));
  }
  // Ränder außerhalb der Karte: Nachtschwarz
  for (let i = 0; i < r.d.length; i++) if (!(r.d[i]! >>> 24)) r.d[i] = 0xff0e0a0b;
  return r;
}

/* ------------------------------------------------ Ausgabe */

/** Dunkle Tönung wie im Spiel (Tagsüber in der Stadt, grob: DARK_GRADE mit Stadtaufhellung) */
const GRADE = [0.8, 0.78, 0.86];
function grade(r: Raster): Raster {
  const o = new Raster(r.w, r.h);
  for (let i = 0; i < r.d.length; i++) {
    const p = r.d[i]!;
    const cr = p & 255, cg = (p >> 8) & 255, cb = (p >> 16) & 255;
    o.d[i] = (0xff << 24 | Math.round(cb * GRADE[2]!) << 16 | Math.round(cg * GRADE[1]!) << 8 | Math.round(cr * GRADE[0]!)) >>> 0;
  }
  return o;
}

function save(name: string, r: Raster, k = 2): void {
  const big = upscale(grade(r), k);
  writeFileSync(join(OUT, name), encodePNG(big.w, big.h, bytes(big)));
  console.log(`${name} ${big.w}x${big.h}`);
}

const td = topDown();
const is = iso();
save('draufsicht.png', td);
save('iso.png', is);
// Nebeneinander auf gleicher Höhe (oben bündig)
const GAP = 12;
const side = new Raster(td.w + GAP + is.w, Math.max(td.h, is.h));
side.d.fill(0xff0e0a0b);
side.blit(td, 0, 0);
side.blit(is, td.w + GAP, Math.max(0, (td.h - is.h) >> 1));
save('vergleich.png', side);
// Figuren-Test: Held in Seite/vorn/hinten gegen die 45°-Drehung des Rigs (für Iso-Diagonalen)
const figs = new Raster(64 * 5, 64);
figs.d.fill(0xff2a2630);
const views: [FigureSheet, FigView][] = [[heroSheet, 'side'], [heroSheet, 'front'], [heroSheet, 'back'], [heroDiagSheet, 'side'], [heroDiagSheet, 'back']];
views.forEach(([s, v], k) => stampFig({ sheet: s, x: 0, y: 0, view: v, anim: 'walk', i: 2 }, (x, y, c) => figs.set(x, y, c), k * 64 + 30, 58));
save('held-richtungen.png', figs, 3);
void mix;
