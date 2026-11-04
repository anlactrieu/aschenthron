// Aschenthron: kleine Skelette für Tiere und Wesen ohne Menschengestalt (Ratten, Hunde/Wölfe, Spinnen, Würmer, Irrlichter),
// im Stil des Helden-Rigs (`heroRig.js`, Remix von pixelfx `rig.js`, MIT): Knochen in 3D, Beine per Zwei-Gelenk-IK auf den
// Boden gestellt, gezeichnet durch denselben Tiefenpuffer mit Tonstufen, Nähten, Lichtsaum und einer Umrisslinie.
// Koordinaten wie im Rig: x nach vorn (Blick nach rechts), y nach oben, z zur Kamera, Füße auf y = 0.
import { KIT, shape } from "./heroRig.js";

const { add, sub, unit, rotY, mm, mv, ik, axes, lerp3, sphere, sweep, ellipsoid } = KIT;
const TAU = Math.PI * 2;

/** Teilnummern (eigene Farben je Teil, Kanten dazwischen) */
export const BEAST_PART = { fur: 50, belly: 51, head: 52, snout: 53, ear: 54, paw: 55, tail: 56, mane: 57, horn: 58, legN: 59, legF: 60, mark: 61, eyeRing: 62 };
const P_ = BEAST_PART;

/** Schräge Draufsicht zur Kamera / weg (wie `SHEAR` in hero.ts) */
const BEAST_SHEAR = 0.32;
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };

/** Fuß in Phase p (0..1), Standbein am Boden `stance` des Zyklus (wie `gaitFoot` in figure.ts) */
function foot(p, stride, lift, stance = 0.5) {
  const q = ((p % 1) + 1) % 1;
  if (q < stance) return { x: stride - (q / stance) * 2 * stride, y: 0 };
  const s = (q - stance) / (1 - stance), e = 0.5 - 0.5 * Math.cos(s * Math.PI);
  return { x: -stride + e * 2 * stride, y: Math.sin(s * Math.PI) * lift };
}

/** Zeichnen in lokalen Koordinaten, ein Gesamtumbau `T` (Blickrichtung, Umfallen) wird auf alles angewandt */
function painter(M, d) {
  const P = (v) => add(mv(M, v), d);
  const R = (A) => mm(M, A);
  return {
    P,
    ball: (c, r, part, mat = 0) => sphere(P(c), r, part, mat),
    bone: (a, b, ra, rb, part, mat = 0, bulge = 0) => sweep(P(a), P(b), ra, rb, part, mat, bulge),
    egg: (c, A, r, part, mat = 0) => ellipsoid(P(c), R(A), r, part, mat),
  };
}


/**
 * Pose eines Tieres: Phase und Ausprägung je Animation.
 * walk: p = Laufphase; attack: Ausholen (0..1) -> Biss/Sprung (2) -> zurück; hit: zurückzucken; die: einknicken, umfallen.
 */
function phaseOf(anim, i, n) {
  const u = n > 1 ? i / (n - 1) : 0;
  if (anim === "walk") return { walk: i / n, move: 1 };
  if (anim === "idle") return { breath: Math.sin((i / n) * TAU) };
  if (anim === "attack") {
    // Bild 0-1 ausholen (zurück, tief), 2 Schlag (vor), dann zurück
    const keys = [{ lunge: -1.2, low: 1, jaw: 0.3 }, { lunge: -2, low: 1.6, jaw: 0.6 }, { lunge: 3.2, low: -0.4, jaw: 1 }, { lunge: 2.2, low: 0, jaw: 0.6 }, { lunge: 0.6, low: 0.3, jaw: 0.1 }];
    return { ...keys[Math.min(keys.length - 1, i)], attack: 1 };
  }
  if (anim === "hit") return { lunge: i === 0 ? -1.8 : -0.8, rear: i === 0 ? 1 : 0.5 };
  if (anim === "die") return { die: u };
  return {};
}

/* ------------------------------------------------ Vierbeiner (Ratte, Hund, Wolf, Höllenhund) */

function quad(b, ph, M0) {
  const k = b.size ?? 1, L = b.len * k, Hh = b.height * k, g = b.girth * k, hd = b.head * k, legR = (b.legR ?? 1.2) * k;
  const lunge = (ph.lunge ?? 0) * k, low = (ph.low ?? 0) * k, die = ph.die ?? 0;
  const bob = ph.walk !== undefined ? Math.abs(Math.sin(ph.walk * TAU)) * 0.5 * k : (ph.breath ?? 0) * 0.25 * k;
  // Sterben: Beine knicken ein (Körper sinkt), dann kippt er auf die Seite (zur Kamera)
  const sink = Math.min(1, die * 1.6) * (Hh - g * 0.9);
  const roll = Math.max(0, die - 0.35) / 0.65;
  const M = mm(M0, rotX(-roll * 1.45));
  const lift = roll * g * 0.6;
  const { P, ball, bone, egg } = painter(M, [0, lift, 0]);
  const shoulder = [L * 0.5 + lunge, Hh - g * 0.15 + bob - low * 0.6 - sink + (ph.rear ?? 0) * 1.2 * k, 0];
  const hip = [-L * 0.5 + lunge * 0.6, Hh * 0.96 - g * 0.15 + bob * 0.6 - sink, 0];
  // Rumpf: Brust kräftig, Hüfte schmaler, Bauch etwas heller
  const along = unit(sub(shoulder, hip)), up = [0, 1, 0];
  const A = axes(along, up);
  const n = 7;
  for (let j = 0; j <= n; j++) {
    const u = j / n, c = lerp3(hip, shoulder, u), r = g * (0.82 + 0.28 * Math.sin(u * Math.PI * 0.9 + 0.2));
    egg(c, A, [L / n + 1.6 * k, r * 0.95, r * 0.9], P_.fur);
  }
  egg(add(lerp3(hip, shoulder, 0.55), [0, -g * 0.45, 0]), A, [L * 0.32, g * 0.5, g * 0.62], P_.belly);
  if (b.mane) for (let j = 0; j < 5; j++) ball(add(shoulder, [0.6 * k - j * 0.5 * k, g * (0.35 + 0.1 * Math.sin(j)), (j % 2 ? 1 : -1) * g * 0.25]), g * 0.62 * b.mane, P_.mane);
  // Kopf und Hals
  const headUp = (ph.rear ?? 0) * 1.5 * k - low * 0.9 + (ph.breath ?? 0) * 0.2 * k;
  const head = add(shoulder, [g * 0.85 + hd * 0.6 + lunge * 0.3, g * 0.55 + hd * 0.35 + headUp, 0]);
  bone(add(shoulder, [0, g * 0.2, 0]), head, g * 0.62, hd * 0.75, P_.fur);
  const HA = axes([1, -0.12 - low * 0.08, 0], up);
  egg(head, HA, [hd * 1.05, hd * 0.92, hd * 0.88], P_.head);
  const jaw = (ph.jaw ?? 0) * 0.5;
  const snoutA = add(head, [hd * 0.55, -hd * 0.18, 0]), snoutB = add(head, [hd * 0.55 + b.snout * k, -hd * 0.35 - jaw * hd * 0.5, 0]);
  bone(snoutA, snoutB, hd * 0.6, hd * 0.38, P_.snout);
  if (jaw > 0.05) bone(add(head, [hd * 0.4, -hd * 0.62, 0]), add(head, [hd * 0.4 + b.snout * k * 0.85, -hd * 0.62 - jaw * hd * 1.4, 0]), hd * 0.36, hd * 0.24, P_.snout);
  ball(add(snoutB, [hd * 0.32, hd * 0.12, 0]), hd * 0.3, P_.paw);
  // Ohren: spitz (Hund) oder rund (Ratte)
  for (const s of [1, -1]) {
    const base = add(head, [-hd * 0.15, hd * 0.62, s * hd * 0.5]);
    if (b.earsRound) egg(add(base, [-hd * 0.1, hd * 0.4, s * hd * 0.15]), axes([0, 0, 1], [0, 1, 0]), [b.ears * k * 0.9, b.ears * k * 0.9, 0.5 * k], P_.ear);
    else bone(base, add(base, [-hd * 0.35, b.ears * k, s * hd * 0.2]), hd * 0.38, 0.25 * k, P_.ear);
  }
  if (b.horns) for (const s of [1, -1]) {
    const a0 = add(head, [hd * 0.1, hd * 0.7, s * hd * 0.45]), a1 = add(a0, [-hd * 0.9, hd * 0.9 * b.horns, s * hd * 0.35]), a2 = add(a1, [-hd * 1.1, -hd * 0.1, s * hd * 0.1]);
    bone(a0, a1, hd * 0.32, hd * 0.22, P_.horn);
    bone(a1, a2, hd * 0.22, 0.2 * k, P_.horn);
  }
  // Beine: vorn Ellbogen nach hinten, hinten Sprunggelenk nach hinten (Knie vorn), Trab: diagonale Paare gleichzeitig
  const stride = Hh * 0.42, liftF = Hh * 0.28;
  const legs = [
    { at: add(shoulder, [0, -g * 0.35, g * 0.55]), ph: 0, front: true, near: true },
    { at: add(shoulder, [0, -g * 0.35, -g * 0.55]), ph: 0.5, front: true, near: false },
    { at: add(hip, [0, -g * 0.3, g * 0.6]), ph: 0.5, front: false, near: true },
    { at: add(hip, [0, -g * 0.3, -g * 0.6]), ph: 0, front: false, near: false },
  ];
  for (const l of legs) {
    let fx = l.at[0], fy = legR * 0.8;
    if (ph.walk !== undefined) {
      const f = foot(ph.walk + l.ph, stride, liftF);
      fx += f.x;
      fy += f.y;
    } else if (ph.attack) fx += l.front ? lunge * 0.6 + 1.2 * k : -lunge * 0.2;
    // beim Umfallen ziehen sich die Beine unter den Körper
    fy += sink * 0.55;
    const target = [fx, fy, l.at[2] * 1.05];
    const len1 = Math.max(2, (l.at[1] - legR * 0.4) * 0.55), len2 = len1;
    const pole = l.front ? [-1, 0, 0] : [1, 0, 0];
    const leg = ik(P(l.at), P(target), len1, len2, mv(M, pole));
    const part = l.near ? P_.legN : P_.legF;
    sweep(P(l.at), leg.joint, legR * (l.front ? 1.25 : 1.6), legR, part, 0);
    sweep(leg.joint, leg.end, legR, legR * 0.8, part, 0);
    sphere(add(leg.end, mv(M, [legR * 0.5, -legR * 0.1, 0])), legR * 1.05, P_.paw, 0);
  }
  // Schwanz: Kette nach hinten, schwingt
  if (b.tail) {
    const sway = ph.walk !== undefined ? Math.sin(ph.walk * TAU) : (ph.breath ?? 0) * 0.5;
    let prev = add(hip, [-g * 0.5, g * 0.2, 0]);
    const segs = 6;
    for (let j = 1; j <= segs; j++) {
      const u = j / segs, droop = b.earsRound ? -u * 0.8 : (0.6 - u) * 0.9 + (ph.attack ? 0.5 : 0);
      const nx = add(prev, [-(b.tail * k) / segs, (droop * b.tail * k) / segs, (sway * 0.8 * k) / segs]);
      bone(prev, nx, (b.tailR ?? 1) * k * (1.1 - u * 0.6), (b.tailR ?? 1) * k * (1 - u * 0.65), P_.tail);
      prev = nx;
    }
  }
  const eyes = [1, -1].map((s) => P(add(head, [hd * 0.62, hd * 0.28, s * hd * 0.6])));
  return eyes;
}

/* ------------------------------------------------ Spinne */

/** Schrittweite der Spinnenbeine bei Größe 1 (Laufzyklus in monster.ts `beastCycle`) */
export const SPIDER_STRIDE = 3.4;
/** Sterbebilder: Kippen um die Längsachse, Absinken (Anteil), Einrollen der Beine, Spreizen, Fußhub */
const SPIDER_DIE = [
  { roll: 0, drop: 0.3, curl: 0, spread: -0.6, lift: 3 },
  { roll: 0, drop: 1, curl: 0.05, spread: 1, lift: 0 },
  { roll: 0.45, drop: 1, curl: 0.45, spread: 0, lift: 0 },
  { roll: 2.8, drop: 1, curl: 0.55, spread: 0, lift: 0 },
];

function spider(b, ph, M0) {
  const k = b.size ?? 1, Hs = b.height * k, g = b.girth * k, hd = b.head * k, legR = (b.legR ?? 0.8) * k, legL = 11.5 * k * (b.legLen ?? 1);
  const lunge = (ph.lunge ?? 0) * k;
  // Sterben in Schlüsselbildern: zucken (Beine hoch), einknicken (Körper auf dem Boden, Beine flach gespreizt), auf die Seite
  // kippen (Beine krümmen sich), auf dem Rücken liegen (Beine eng eingerollt)
  const D = ph.die === undefined ? null : SPIDER_DIE[Math.min(SPIDER_DIE.length - 1, Math.round(ph.die * (SPIDER_DIE.length - 1)))];
  const flip = D ? D.roll : 0, curl = D ? D.curl : 0, spread = D ? D.spread : 0;
  const M = mm(M0, rotX(-flip));
  const { P, egg } = painter(M, [0, 0, 0]);
  const bob = ph.walk !== undefined ? Math.abs(Math.sin(ph.walk * TAU * 2)) * 0.4 * k : (ph.breath ?? 0) * 0.2 * k;
  const rear = (ph.attack ? Math.max(0, -(ph.lunge ?? 0)) * 0.9 : 0) + (ph.rear ?? 0) * 1.5;
  const drop = D ? D.drop * (Hs - g * 0.55) : 0;
  const C = [2.2 * k + lunge * 0.8, Hs + bob + rear * k * 0.5 - drop, 0];
  const A = [-g * 0.95 + lunge * 0.4, Hs + 1.4 * k + bob * 0.6 - drop, 0];
  egg(A, axes([1, 0.15, 0], [0, 1, 0]), [g * 1.05, g * 0.88, g * 0.95], P_.fur);
  if (b.mark) egg(add(A, [-g * 0.1, g * 0.8, 0]), axes([1, 0, 0], [0, 1, 0]), [g * 0.45, 0.8 * k, g * 0.32], P_.mark);
  egg(C, axes([1, 0.2 + rear * 0.12, 0], [0, 1, 0]), [hd * 1.05, hd * 0.8, hd * 0.95], P_.head);
  // Kieferklauen
  const fang = 0.6 + (ph.jaw ?? 0) * 0.6;
  for (const s of [1, -1]) sweep(P(add(C, [hd * 0.9, -hd * 0.25, s * hd * 0.35])), P(add(C, [hd * 1.45, -hd * (0.6 + fang * 0.5), s * hd * 0.25 * fang])), 0.7 * k, 0.35 * k, P_.snout, 0);
  if (b.crown) for (let j = -2; j <= 2; j++) sweep(P(add(C, [-hd * 0.1 + Math.abs(j) * -0.3 * k, hd * 0.7, j * hd * 0.32])), P(add(C, [-hd * 0.3, hd * 0.7 + (2.6 - Math.abs(j) * 0.6) * k, j * hd * 0.38])), 0.6 * k, 0.25 * k, P_.mark, 0);
  // acht Beine: je Seite vier, Knie hoch, Füße im Kreis auf dem Boden; zwei Vierergruppen wechseln sich ab
  const ANG = [0.62, 0.2, -0.28, -0.72];
  for (const s of [1, -1]) for (let j = 0; j < 4; j++) {
    const a = ANG[j], at = add(C, [hd * (0.35 - j * 0.28), -hd * 0.1, s * hd * 0.55]);
    const reach = legL * (1 + spread * 0.15);
    let fx = at[0] + Math.sin(a) * reach, fz = at[2] + s * Math.cos(a) * reach * 0.8, fy = legR;
    if (ph.walk !== undefined) {
      // Wechselschritt: Beine 1 und 3 der einen Seite mit 2 und 4 der anderen; deutlicher Hub, Knie gehen beim Heben hoch
      const f = foot(ph.walk + ((j + (s > 0 ? 0 : 1)) % 2) * 0.5, SPIDER_STRIDE * k, 3.2 * k);
      fx += f.x;
      fy += f.y;
    }
    if (ph.attack && j === 0) {
      fy += rear * 2.5 * k;
      fx += 1.5 * k;
    }
    if (D) {
      // die Füße ziehen sich zum Körper (eingerollt) und heben sich vom Boden; das Knie zeigt dann nach außen statt nach oben
      fy += D.lift * k;
      fx += (at[0] + Math.sin(a) * legL * 0.22 - fx) * curl;
      fz += (at[2] + s * Math.cos(a) * legL * 0.22 - fz) * curl;
      fy += (at[1] - hd * 0.9 - fy) * curl;
    }
    const pole = [Math.sin(a) * (0.3 + curl), 1 - curl * 0.6, s * Math.cos(a) * (0.5 + curl)];
    const knee = ik(P(at), P([fx, fy, fz]), legL * 0.5, legL * 0.68, mv(M, pole));
    const part = s > 0 ? P_.legN : P_.legF;
    sweep(P(at), knee.joint, legR * 1.3, legR, part, 0);
    sweep(knee.joint, knee.end, legR, legR * 0.6, part, 0);
  }
  // Augen: Gruppe vorn auf dem Kopf
  const eyes = [];
  for (const s of [1, -1]) for (const [ex, ey] of [[0.82, 0.32], [0.62, 0.58]]) eyes.push(P(add(C, [hd * ex, hd * ey, s * hd * 0.34])));
  return eyes;
}

/* ------------------------------------------------ Wurm */

function worm(b, ph, M0) {
  const k = b.size ?? 1, L = b.len * k, g = b.girth * k, hd = b.head * k;
  const die = ph.die ?? 0;
  const t = ph.walk !== undefined ? ph.walk : (ph.breath ?? 0) * 0.05;
  const { P, ball } = painter(M0, [0, 0, 0]);
  // Kopf hebt sich (Angriff höher, dann Stoß nach vorn-unten); Sterben: sinkt zusammen
  const strike = ph.attack ? (ph.lunge ?? 0) : 0;
  const rise = (ph.attack ? (strike < 0 ? 1.6 : 0.6) : 1) * (1 - die) + (ph.rear ?? 0) * 0.4;
  const segs = 11;
  const pts = [];
  for (let j = 0; j <= segs; j++) {
    const u = j / segs;
    const head = Math.max(0, (u - 0.55) / 0.45);
    const x = -L * 0.55 + u * L * 0.9 + head * strike * 1.6 * k;
    const y = g * 0.85 + head * head * (12 * k * rise) + Math.sin(u * TAU * 1.2 - t * TAU) * 0.4 * k * (1 - head);
    // zur Kamera / weg: der Leib liegt in einem seitlichen Bogen, sonst verdeckt der Kopf alle Segmente
    const coil = (ph.coil ?? 0) * Math.sin((1 - u) * Math.PI * 1.7) * 8.5 * k * (1 - head);
    const z = Math.sin(u * TAU * 0.9 + t * TAU) * 2.2 * k * (1 - head * 0.8) + coil;
    pts.push([x * (1 - (ph.coil ?? 0) * 0.25), y, z]);
  }
  for (let j = 0; j < segs; j++) {
    const u = j / segs, r = g * (0.62 + 0.38 * Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.62));
    sweep(P(pts[j]), P(pts[j + 1]), r, r * 0.98, j % 2 ? P_.fur : P_.mark, 0);
  }
  const H = pts[segs];
  ball(H, hd, P_.head);
  // Maul: dunkler Ring vorn, beim Angriff weiter offen
  const open = 0.5 + (ph.jaw ?? 0) * 0.6;
  ball(add(H, [hd * 0.75, -hd * 0.1, 0]), hd * 0.55 * open, P_.snout);
  if (b.spikes) for (let j = 2; j < segs; j += 2) sweep(P(add(pts[j], [0, g * 0.6, 0])), P(add(pts[j], [-0.8 * k, g * 0.6 + 2.2 * k, 0])), 0.8 * k, 0.2 * k, P_.horn, 0);
  return [1, -1].map((s) => P(add(H, [hd * 0.45, hd * 0.55, s * hd * 0.5])));
}

/* ------------------------------------------------ Irrlicht (Lavageist) */

function wisp(b, ph, M0) {
  const k = b.size ?? 1, g = b.girth * k, H = b.height * k, die = ph.die ?? 0;
  const t = ph.walk ?? ((ph.breath ?? 0) + 1) * 0.25;
  const { P, ball } = painter(M0, [0, 0, 0]);
  const grow = (ph.attack ? 1 + Math.max(0, ph.lunge ?? 0) * 0.08 : 1) * (1 - die * 0.75);
  const c = [(ph.lunge ?? 0) * 0.6 * k, H + Math.sin(t * TAU) * 1.2 * k - die * H * 0.5, 0];
  ball(c, g * grow, P_.fur);
  ball(add(c, [g * 0.15, g * 0.1, 0]), g * 0.62 * grow, P_.belly);
  // Flammenzungen: spitze Kegel, die flackernd nach oben züngeln
  for (let j = 0; j < 5; j++) {
    const a = j * 2.5 + t * TAU * 0.5, flick = Math.sin(j * 1.7 + t * TAU * 2);
    const base = add(c, [Math.cos(a) * g * 0.42, g * 0.35, Math.sin(a) * g * 0.42]);
    const tip = add(base, [Math.cos(a) * g * 0.2 - 0.8 * k, g * (1.5 + 0.35 * flick) * grow, Math.sin(a) * g * 0.2]);
    sweep(P(base), P(tip), g * 0.52 * grow, 0.3 * k, P_.fur, 0);
  }
  sweep(P(add(c, [0, g * 0.2, 0])), P(add(c, [-0.6 * k, g * 2.3 * grow, 0])), g * 0.6 * grow, 0.35 * k, P_.belly, 0);
  // Glutbrocken kreisen
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * TAU + t * TAU;
    ball(add(c, [Math.cos(a) * g * 1.45, -g * 0.2 + Math.sin(a * 2) * 1.2 * k, Math.sin(a) * g * 1.45]), 0.9 * k * (1 - die), P_.mark);
  }
  return [1, -1].map((s) => P(add(c, [g * 0.85, g * 0.15, s * g * 0.35])));
}

/** Versatz je Körperbau und Ansicht (schräge Draufsicht), siehe `beastPosed` */
const REST_LIFT = new WeakMap();

/**
 * Pixel eines Tier-Bildes wie `posed()`: { n, xs, ys, color, shade, part, ... }.
 * Seitenansicht leicht zur Kamera gedreht, zur Kamera / weg = ganze Figur gedreht.
 */
export function beastPosed(b, anim, view, i, n) {
  const ph = phaseOf(anim, i, n);
  if (b.type === "worm" && view !== "side") ph.coil = view === "front" ? 1 : -1;
  // Würmer zur Kamera / weg echt von vorn/hinten (Maul zur Kamera, Leib im seitlichen Bogen). Vierbeiner bleiben schräg (60°):
  // echt von vorn sind sie bei Spielgröße nur ein schmaler Strich (Ratten ein Punkt); dafür schräg von oben gesehen (Scherung wie
  // beim Helden: näher = tiefer im Bild), so steht der fernere Fuß höher und man sieht den Schritt. Spinnen/Irrlichter: schräg, ungeschert
  const straight = view !== "side" && b.type === "worm";
  const yaw = view === "side" ? 0.42 : straight ? (view === "front" ? Math.PI / 2 : -Math.PI / 2) : view === "front" ? 1.05 : -1.05;
  const sheared = view !== "side" && (b.type === "worm" || b.type === "quad");
  const M = sheared ? mm([1, 0, 0, 0, 1, -BEAST_SHEAR, 0, 0, 1], rotY(-yaw)) : rotY(-yaw);
  const draw = (q) => () => (b.type === "quad" ? quad(b, q, M) : b.type === "spider" ? spider(b, q, M) : b.type === "worm" ? worm(b, q, M) : wisp(b, q, M));
  if (!sheared || anim === "die") return shape(draw(ph));
  // schräg von oben: alle Bilder einer Ansicht um denselben Betrag heben (aus dem Stehbild), damit der Standfuß im Gehen nicht
  // springt; nur was trotzdem unter die Fußlinie reicht, wird zusätzlich angehoben
  const key = `${view}`;
  let lift = REST_LIFT.get(b)?.[key];
  if (lift === undefined) {
    const ref = shape(draw({ ...phaseOf("idle", 0, 4), coil: ph.coil }), false);
    lift = Math.max(0, ref.y1 - 1);
    REST_LIFT.set(b, { ...REST_LIFT.get(b), [key]: lift });
  }
  const out = shape(draw(ph), false);
  const up = Math.max(lift, out.y1 - 1);
  for (let j = 0; j < out.n; j++) out.ys[j] -= up;
  out.y0 -= up;
  out.y1 -= up;
  return out;
}
