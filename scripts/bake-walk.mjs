#!/usr/bin/env node
// Probe: Laufzyklus des Helden mit dem pixelfx-Skelett (tools/pixelfx/src/core/rig.js), in DCSS-naher Palette umgefärbt.
// Ausgabe nach public/probe/gang/ (ignoriert): walk.png (Zeilen = Richtungen, Spalten = Bilder), walk.json, contact-<richtung>.png.
//   node scripts/bake-walk.mjs
// Kein Spielcode: nur für die Probeseite /probe/gang/index.html.
/* global console */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { posed, posedParts } from '../tools/pixelfx/src/core/rig.js';
import { DUMMY_PAL } from '../tools/pixelfx/src/core/actor.js';
import { hex as abgr } from '../tools/pixelfx/src/core/color.js';
import { encodePNG } from '../tools/pixelfx/tools/lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'probe', 'gang');
const N = 8; // Bilder je Zyklus
const W = 40, H = 48, FX = 20, FY = 45; // Bildgröße, Fußpunkt
const hex = (s) => parseInt(s.slice(1), 16);

// Graustufen der Standardfigur -> Tonstufe (0 hell … 3 dunkel), Gelenke etwas dunkler, Naht/Tinte eigens
// (pixelfx speichert Farben als ABGR)
const key = (c) => abgr(c) >>> 0;
const TONE = new Map([[DUMMY_PAL.A, 0], [DUMMY_PAL.B, 1], [DUMMY_PAL.C, 2], [DUMMY_PAL.D, 3], [DUMMY_PAL.E, 1], [DUMMY_PAL.F, 2], [DUMMY_PAL.G, 3]].map(([c, t]) => [key(c), t]));
const SEAM = key(DUMMY_PAL.J), INK = key(DUMMY_PAL.k), MARK = key(DUMMY_PAL.m);

// Material je Körperteil, Rampe hell -> dunkel (+ Naht). Leder, Eisen, Haut, dunkles Tuch.
const MAT = {
  hood: ['#9a9aa4', '#72727e', '#50505c', '#363640', '#26262e'], // Eisenhaube
  skin: ['#e0b08a', '#c08a66', '#96664c', '#6a4434', '#4a3024'],
  leather: ['#a07448', '#7e5634', '#5e3e26', '#422a1a', '#2e1e12'],
  sleeve: ['#7a2e26', '#5e221c', '#461814', '#32100e', '#240c0a'], // dunkelrotes Untergewand
  glove: ['#5c5450', '#463e3a', '#342e2c', '#262220', '#1a1616'], // nah am Hosenton: in Rückansicht landet Hosen-`src` teils auf den Händen
  belt: ['#6a4a2a', '#50361e', '#3a2614', '#2a1a0e', '#1e1208'],
  cloth: ['#5e5a66', '#48444e', '#36323c', '#28242c', '#1c1a20'],
  boot: ['#6a4a30', '#4e3622', '#3a2818', '#2a1c10', '#1e140c'],
};
const PART_MAT = {
  head: 'hood', face: 'skin', neck: 'hood', chest: 'leather', waist: 'leather', pelvis: 'belt',
  upperN: 'sleeve', elbowN: 'sleeve', upperF: 'sleeve', elbowF: 'sleeve', foreN: 'glove', handN: 'glove', foreF: 'glove', handF: 'glove',
  thighN: 'cloth', kneeN: 'cloth', shinN: 'cloth', thighF: 'cloth', kneeF: 'cloth', shinF: 'cloth', footN: 'boot', footF: 'boot',
};
// Waffe: Goldtöne der pixelfx-Klinge werden zu dunklem Eisen/Holz
const STEEL_MAP = new Map();
const OUTLINE = hex('#0c0a0e');

// Welcher Körperteil liegt an welchem Pixel der Standfigur (24 x 38)? Daraus färbt `src` jeden Pixel jeder Pose.
const partAt = new Array(24 * 38).fill('');
for (const pt of posedParts({})) for (let i = 0; i < pt.n; i++) {
  const c = pt.xs[i] + 12, r = 38 + pt.ys[i];
  if (c >= 0 && r >= 0 && c < 24 && r < 38 && (!partAt[r * 24 + c] || pt.color[i] !== INK)) partAt[r * 24 + c] = pt.name;
}

function recolor(c, src, view) {
  if (c === INK) return OUTLINE;
  let part = src >= 0 ? partAt[src] : '';
  if (view === 'back' && part === 'face') part = 'head'; // Hinterkopf: Haube statt Gesicht
  const ramp = MAT[PART_MAT[part] ?? ''];
  if (c === MARK) return ramp ? hex(ramp[2]) : hex('#5e4430');
  if (TONE.has(c) && ramp) return hex(ramp[TONE.get(c)]);
  if (c === SEAM && ramp) return hex(ramp[4]);
  if (TONE.has(c) || c === SEAM) return hex(MAT.leather[TONE.get(c) ?? 4]);
  // Waffe (eigene Stahlfarben): entsättigen und abdunkeln
  if (!STEEL_MAP.has(c)) {
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, l = 0.3 * r + 0.55 * g + 0.15 * b;
    const warm = r > b + 40; // Gold/Holz -> dunkle Bronze, sonst Eisen
    const k = warm ? 0.85 : 0.8;
    const v = warm ? [l * 0.8, l * 0.62, l * 0.42] : [l * 0.86, l * 0.88, l * 0.94];
    STEEL_MAP.set(c, (Math.round(v[0] * k) << 16) | (Math.round(v[1] * k) << 8) | Math.round(v[2] * k));
  }
  return STEEL_MAP.get(c);
}

// Ein Schritt: Phase p 0..1, Nah-Bein vorne bei p = 0 (Kontakt). Standbein gleitet linear zurück, Schwungbein hebt sich.
const STRIDE = 5.5, LIFT = 3.2, ARM = 4.5;
function foot(p, lift = 1) {
  const q = ((p % 1) + 1) % 1;
  if (q < 0.5) return { x: STRIDE - (q / 0.5) * 2 * STRIDE, y: -4, toe: q > 0.38 }; // Stand: vorn -> hinten, Ferse hebt am Ende
  const s = (q - 0.5) / 0.5, e = 0.5 - 0.5 * Math.cos(s * Math.PI);
  return { x: -STRIDE + e * 2 * STRIDE, y: -4 - Math.sin(s * Math.PI) * LIFT * lift, toe: false };
}
function walkPose(p, view) {
  const lift = view === 'side' ? 1 : 1.5, n = foot(p, lift), f = foot(p + 0.5, lift);
  const swing = Math.cos(p * Math.PI * 2); // +1: Nah-Bein vorn -> Nah-Arm hinten
  // Federn: tief kurz nach dem Kontakt, hoch in der Passierpose
  const crouch = 1.3 + 1.1 * Math.cos((p - 0.08) * Math.PI * 4);
  const pose = {
    crouch, lean: 1.2,
    ffx: n.x, ffy: n.y, toeF: n.toe, fbx: f.x, fby: f.y, toeB: f.toe,
    // Nah-Hand mit Schwert schwingt weniger, Fernhand frei gegengleich
    fx: 1 - swing * ARM * 0.6, fy: -14.5 + Math.abs(swing) * 0.6, bx: 4 + swing * ARM * 1.3, by: -14.8 + Math.abs(swing) * 0.8,
    weapon: 'dagger', sa: 1.1 + swing * 0.12,
    hy: 0.3,
  };
  if (view === 'side') Object.assign(pose, { turn: 0.32 + swing * 0.08 });
  if (view === 'front') Object.assign(pose, { yaw: Math.PI / 2, turn: 0.05 + swing * 0.1, fzz: 3.2, bzz: -3.2 });
  if (view === 'back') Object.assign(pose, { yaw: -Math.PI / 2, turn: 0.05 + swing * 0.1, fzz: 3.2, bzz: -3.2 });
  return pose;
}

function frameRGBA(pose, flip, view) {
  const r = posed(pose), px = new Uint8Array(W * H * 4);
  for (let i = 0; i < r.n; i++) {
    const x = (flip ? -r.xs[i] - 1 : r.xs[i]) + FX, y = r.ys[i] + FY;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const c = recolor(r.color[i], r.src[i], view), o = (y * W + x) * 4;
    px[o] = (c >> 16) & 255; px[o + 1] = (c >> 8) & 255; px[o + 2] = c & 255; px[o + 3] = 255;
  }
  return px;
}

const DIRS = [['right', 'side', false], ['left', 'side', true], ['front', 'front', false], ['back', 'back', false]];
mkdirSync(OUT, { recursive: true });
const sheet = new Uint8Array(W * N * H * DIRS.length * 4), SW = W * N;
const frames = {};
DIRS.forEach(([name, view, flip], row) => {
  // Kontaktbogen 6x mit Abstand und dunklem Grund
  const K = 6, G = 6, CW = N * (W * K + G), CH = H * K, contact = new Uint8Array(CW * CH * 4);
  for (let i = 0; i < CW * CH; i++) contact.set([30, 27, 34, 255], i * 4);
  for (let f = 0; f < N; f++) {
    const px = frameRGBA(walkPose(f / N, view), flip, view);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4;
      sheet.set(px.subarray(s, s + 4), ((row * H + y) * SW + f * W + x) * 4);
      if (px[s + 3]) for (let j = 0; j < K * K; j++) contact.set(px.subarray(s, s + 4), ((y * K + ((j / K) | 0)) * CW + f * (W * K + G) + x * K + (j % K)) * 4);
    }
    frames[`${name}_${f}`] = { frame: { x: f * W, y: row * H, w: W, h: H } };
  }
  writeFileSync(join(OUT, `contact-${name}.png`), encodePNG(CW, CH, contact));
});
writeFileSync(join(OUT, 'walk.png'), encodePNG(SW, H * DIRS.length, sheet));
writeFileSync(join(OUT, 'walk.json'), JSON.stringify({ frames, meta: { size: { w: SW, h: H * DIRS.length }, frame: [W, H], pivot: [FX, FY], n: N, dirs: DIRS.map((d) => d[0]) } }, null, 1));
console.log(`walk.png ${SW}x${H * DIRS.length}, ${N} Bilder x ${DIRS.length} Richtungen -> ${OUT}`);
