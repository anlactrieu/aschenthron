// Remix für Aschenthron: der Held als gedrungener, kräftiger Krieger. Kopie von pixelfx `src/core/rig.js`
// (https://github.com/patch-gg/pixelfx, MIT License, Copyright (c) 2026 Patch, Copyright (c) 2026 Hugo Duprez), geändert:
// kürzere Beine, breitere Schultern, größerer Kopf, Rüstungsformen (Helm, Schulterplatten), kurzes Schwert, Stab, kleiner Bogen,
// und jeder Pixel trägt seine Teilnummer und Tonstufe, damit das Spiel Material je Körperteil färben kann (`hero.ts`).
// Farben hier sind 0xRRGGBB (nicht ABGR wie im Original).
//
// The character who acts: a real skeleton in 3D, drawn down to pixels the way Dead Cells makes its sprites. Bones have
// fixed lengths and hang from each other, pelvis to spine to chest to shoulders, so the body can twist, bend and turn round,
// and depth decides what's in front. A pose only says where the hands and feet should be and how the body is carrying
// itself; the solver works out every joint, and the renderer shades it into a few flat tones with one clean ink line.
//
// Coordinates: x right, y up, z towards the viewer, in pixels, the feet at the origin. Poses are in screen terms (y negative
// is up), as effects are. The character faces +x with his right side towards the viewer, so the right hand is the near one.
//
// A rendered pose also knows, for each of its pixels, which pixel of the standing character it came from (`src`). That
// is what lets an effect drawn on the standing body (frost, poison, a scan line) follow the body wherever it goes.

const hex = (h) => parseInt(h.replace("#", ""), 16);
// Schattierungscodes statt Farben: 0..3 Platten hell bis dunkel, 4..7 Gelenke, 8 Naht, 9 Tinte, 10 Brustmarke, 11 Stahl (Farbe in `color`)
export const SHADE = { CORE: 4, SEAM: 8, INK: 9, MARK: 10, STEEL: 11, EYE: 12 };
const INK = SHADE.INK, SEAM = SHADE.SEAM, MARK = SHADE.MARK;
const SHELL = [0, 1, 2, 3], CORE = [4, 5, 6, 7];
const DEG = Math.PI / 180;

// ---- vectors and turns
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1e-6));
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (A, B) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; };
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---- the body's measurements, in pixels
// gedrungen: Beine 12,4 statt 16,9, Arme 11,8 statt 15, Schultern 6,6 statt 5,9 nach außen, Kopf größer (siehe drawBody)
const BASE_M = {
  pelvis: 15.1, spine1: 2.5, spine2: 4.0, shoulderUp: 2.4, shoulderOut: 6.6, neckUp: 2.6, headUp: 3.4,
  hipDown: 1.0, hipOut: 3.0, thigh: 6.4, shin: 6.0, upper: 6.0, fore: 5.8, turn: 36 * DEG,
};
// Aschenthron: Körperbau je Figur (Held, Goblin, Troll, Boss …) statt fester Maße. Alles 1 = der Held. `size` skaliert die ganze
// Figur samt Posen und Waffe (Bosse größer per Proportion, gleicher Pixelmaßstab); die übrigen Werte ändern nur ihre Teile.
const BODY0 = { size: 1, legs: 1, arms: 1, torso: 1, head: 1, width: 1, limb: 1, belly: 1, neck: 1, rim: true };
let M = BASE_M, BODY = BODY0, rimLight = true;
function setBody(b) {
  BODY = b ? { ...BODY0, ...b } : BODY0;
  rimLight = BODY.rim;
  if (!b) { M = BASE_M; return; }
  const k = BODY.size, L = BODY.legs, T = BODY.torso;
  M = {
    ...BASE_M,
    thigh: BASE_M.thigh * L * k, shin: BASE_M.shin * L * k, hipDown: BASE_M.hipDown * k, hipOut: BASE_M.hipOut * BODY.width * k,
    pelvis: ((BASE_M.thigh + BASE_M.shin) * L + 2.7) * k,
    spine1: BASE_M.spine1 * T * k, spine2: BASE_M.spine2 * T * k, shoulderUp: BASE_M.shoulderUp * T * k, shoulderOut: BASE_M.shoulderOut * BODY.width * k,
    neckUp: BASE_M.neckUp * BODY.neck * k, headUp: BASE_M.headUp * BODY.head * k, upper: BASE_M.upper * BODY.arms * k, fore: BASE_M.fore * BODY.arms * k,
  };
}
// Posenwerte in Pixeln, die mit `size` mitwachsen
const SIZED = ["fx", "fy", "fz", "bx", "by", "bz", "ffx", "ffy", "fzz", "fbx", "fby", "bzz", "crouch", "lean", "y"];
function sized(pose) {
  const k = pose.body?.size ?? 1;
  if (k === 1) return pose;
  const q = { ...STAND, ...pose };
  for (const f of SIZED) if (q[f] !== undefined) q[f] *= k;
  return q;
}
/** Standing easy, in screen terms: hands and feet are where they should end up, y negative is up. */
export const STAND = { lean: 0, crouch: 0, yaw: 0, fx: -3, fy: -11, bx: 5, by: -11, ffx: -2, ffy: -4, fbx: 3, fby: -4 };

// ---- solving a pose: from where the hands and feet should be, to every joint
function ik(a, target, L1, L2, pole) {
  let to = sub(target, a), d = len(to);
  const reach = L1 + L2 - 0.02;
  if (d > reach) { to = mul(to, reach / d); d = reach; }
  const u = unit(to), along = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
  let v = sub(pole, mul(u, dot(pole, u)));
  v = len(v) < 1e-4 ? unit(cross(u, [0, 0, 1])) : unit(v);
  return { joint: add(a, add(mul(u, along), mul(v, h))), end: add(a, to), u, v };
}
function frame(t, R) {
  return { t, R };
}
// a frame along a bone: its local x runs down the bone
function boneFrame(a, b, pole) {
  const x = unit(sub(b, a));
  let y = sub(pole, mul(x, dot(pole, x)));
  y = len(y) < 1e-4 ? unit(cross(x, [0, 0, 1])) : unit(y);
  const z = cross(x, y);
  return frame(a, [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]);
}
const weaponOf = (name) => WEAPONS[name];

function solve(pose) {
  const q = { ...STAND, ...pose }, lean = q.lean, W = q.weapon && weaponOf(q.weapon), OW = q.offWeapon && weaponOf(q.offWeapon);
  const sa = q.sa ?? 0, wl = q.wl ?? 1, axisZ = Math.sqrt(Math.max(0, 1 - wl * wl)) * (q.wz ?? 1);
  const axis = [Math.cos(sa) * wl, -Math.sin(sa) * wl, axisZ], side = [-Math.sin(sa), -Math.cos(sa), 0];
  const two = !!(q.two && W), out = (q.armOut ?? 0) * BODY.size, nearZ = (q.fz ?? (two ? 3 : 4.5) * BODY.size * BODY.width) + (two ? 0 : out);
  // how the chest is turned follows the hands: a hand driving forward brings its shoulder round; one drawn back opens him up
  const zk = BODY.size, fwd = (q.fx - STAND.fx * zk) / (24 * zk), farFwd = two ? 0 : (q.bx - STAND.bx * zk) / (22 * zk);
  let turn = M.turn + (fwd >= 0 ? -44 * DEG * Math.min(1, fwd) : 28 * DEG * Math.min(1, -fwd * 1.8));
  turn += (farFwd > 0 ? 34 * DEG * Math.min(1, farFwd) : 0) + (q.twist ?? 0) * 4 * DEG;
  if (q.turn !== undefined) turn = q.turn;
  const hipTurn = M.turn + (turn - M.turn) * 0.45, tilt = Math.atan2(lean, 13 * zk);
  // Aschenthron: `roll` kippt die Hüfte zur Seite (Spielbein-Seite sinkt), die Schultern halb so weit dagegen
  const hipRoll = q.roll ?? 0;
  const Rp = mm(mm(rotZ(-tilt * 0.25), rotY(-hipTurn)), rotX(hipRoll)), Rc = mm(mm(rotZ(-tilt), rotY(-turn)), rotX(-hipRoll * 0.5));
  // feet first: the pelvis sinks if that's what it takes for both legs to reach them
  const ak = BODY.size, fw = 2.4 * ak * BODY.width;
  const ankleN = [q.ffx, -q.ffy - 1.8 * ak, q.fzz ?? fw], ankleF = [q.fbx, -q.fby - 1.8 * ak, q.bzz ?? -fw];
  let pelvis = [lean * 0.2, M.pelvis - q.crouch, 0];
  const hipAt = (s) => add(pelvis, mv(Rp, [0, -M.hipDown, s * M.hipOut]));
  const maxLeg = (M.thigh + M.shin) * 0.995;
  for (const [s, a] of [[1, ankleN], [-1, ankleF]]) {
    const h = hipAt(s), dx = h[0] - a[0], dz = h[2] - a[2], flat = dx * dx + dz * dz;
    if (flat < maxLeg * maxLeg) {
      const top = a[1] + Math.sqrt(maxLeg * maxLeg - flat);
      if (h[1] > top) pelvis = [pelvis[0], pelvis[1] - (h[1] - top), pelvis[2]];
    }
  }
  const waist = add(pelvis, [Math.sin(tilt * 0.45) * M.spine1, Math.cos(tilt * 0.45) * M.spine1, 0]);
  const chest = add(waist, [Math.sin(tilt) * M.spine2, Math.cos(tilt) * M.spine2, 0]);
  const neck = add(chest, mv(Rc, [0, M.neckUp, 0]));
  // the head keeps looking where he's going: it takes only part of the lean and part of the turn
  const headTurn = M.turn * 0.9 + (turn - M.turn) * 0.35, nod = tilt * 0.35 + (q.hy ?? 0) * 7 * DEG, roll = (q.hx ?? 0) * 7 * DEG;
  const Rh = mm(rotZ(-nod - roll), rotY(-headTurn));
  const head = add(neck, mv(Rh, [0.15, M.headUp, 0]));
  // the arms: shoulders reach a little towards a far hand
  const pick = (s, target) => {
    const base = add(chest, mv(Rc, [0, M.shoulderUp, s * M.shoulderOut])), to = sub(target, base), d = len(to);
    return add(base, mul(unit(to), Math.min(1.8 * zk, Math.max(0, d - 11 * zk) * 0.35)));
  };
  const nearT = [q.fx, -q.fy, nearZ];
  const wk = BODY.size * (q.wscale ?? 1), farT = two ? [q.fx + axis[0] * W.two * wk, -q.fy + axis[1] * W.two * wk, nearZ + axis[2] * W.two * wk] : [q.bx, -q.by, q.bz ?? (q.armsFront ? 5.5 : -4.5) * BODY.size * BODY.width - out];
  const sN = pick(1, nearT), sF = pick(-1, farT);
  const pole = (s, T, shoulder, hold) => {
    // elbows hang down and back; overhead they go out and forward
    const up = clamp01((T[1] - shoulder[1] + 2) / 10);
    const base = [-0.55 + up * 1.1, -1 + up * 0.9, s * (0.45 + up * 0.5)];
    if (!hold) return base;
    // holding something, the forearm wants to meet the handle side on: try round the circle, keep the best
    const u = unit(sub(T, shoulder));
    let best = base, score = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = unit(cross(u, [0.3, 1, 0.2])), y = cross(u, x), v = add(mul(x, Math.cos(a)), mul(y, Math.sin(a)));
      const A = ik(shoulder, T, M.upper, M.fore, v), f = unit(sub(A.end, A.joint));
      const cost = Math.abs(dot(f, hold)) * 0.7 + (1 - dot(unit(base), v)) * 0.55;
      if (cost < score) { score = cost; best = v; }
    }
    return best;
  };
  const holdN = W ? (W.across ? side : axis) : null, holdF = two ? (W.across ? side : axis) : OW ? [Math.cos(q.sb ?? Math.PI), -Math.sin(q.sb ?? Math.PI), 0] : null;
  const armN = ik(sN, nearT, M.upper, M.fore, pole(1, nearT, sN, holdN)), armF = ik(sF, farT, M.upper, M.fore, pole(-1, farT, sF, holdF));
  // the legs: knees forward, a little out
  const kneePole = (s) => mv(Rp, [1, 0, s * 0.35]);
  const hipN = hipAt(1), hipF = hipAt(-1);
  const legN = ik(hipN, ankleN, M.thigh, M.shin, kneePole(1)), legF = ik(hipF, ankleF, M.thigh, M.shin, kneePole(-1));
  const footDir = (s) => { const t = hipTurn * 0.6 + s * 8 * DEG; return [Math.cos(t), 0, Math.sin(t)]; };
  const B = {
    pelvis: frame(pelvis, Rp), waist: frame(waist, mm(rotZ(-tilt * 0.6), rotY(-(turn + hipTurn) / 2))), chest: frame(chest, Rc), head: frame(head, Rh), neck: frame(neck, Rh),
    upperN: boneFrame(sN, armN.joint, armN.v), foreN: boneFrame(armN.joint, armN.end, armN.v), upperF: boneFrame(sF, armF.joint, armF.v), foreF: boneFrame(armF.joint, armF.end, armF.v),
    thighN: boneFrame(hipN, legN.joint, legN.v), shinN: boneFrame(legN.joint, legN.end, legN.v), thighF: boneFrame(hipF, legF.joint, legF.v), shinF: boneFrame(legF.joint, legF.end, legF.v),
  };
  B.footN = frame(legN.end, mm(rotY(-Math.atan2(footDir(1)[2], footDir(1)[0])), rotZ(q.toeF ? -55 * DEG : 0)));
  B.footF = frame(legF.end, mm(rotY(-Math.atan2(footDir(-1)[2], footDir(-1)[0])), rotZ(q.toeB ? -55 * DEG : 0)));
  return { B, W, OW, q, axis, side, armN, armF, legN, legF, sN, sF, hipN, hipF, turn };
}

// ---- drawing: every part goes through one depth buffer
const BW = 300, BH = 240, OX = 150, OY = 180; // the scratch grid, big enough for a raised scythe; feet at (OX, OY)
const Zb = new Float32Array(BW * BH), Tone = new Float32Array(BW * BH), Part = new Int8Array(BW * BH), Mat = new Int8Array(BW * BH), Col = new Uint32Array(BW * BH);
const touched = [];
const LIGHT = unit([-0.55, 0.72, 0.5]);
let clipBody = false, clipWeapon = false;
// Aschenthron: Schräge Draufsicht (`shear`): der Boden liegt bei y = -shear * z, also schneidet auch die Bodenkante schräg
let clipShear = 0;
function plot(i, z, tone, part, mat, wx, wy, color) {
  if (Part[i] === 0) touched.push(i);
  else if (z <= Zb[i]) return;
  Zb[i] = z;
  Tone[i] = tone;
  Part[i] = part;
  Mat[i] = mat;
  Col[i] = color;
}
function sphere(c, r, part, mat) {
  const x0 = Math.floor(c[0] - r), x1 = Math.ceil(c[0] + r), y0 = Math.floor(c[1] - r), y1 = Math.ceil(c[1] + r);
  for (let wy = y0; wy <= y1; wy++)
    for (let wx = x0; wx <= x1; wx++) {
      const dx = wx - c[0], dy = wy - c[1], d2 = dx * dx + dy * dy;
      if (d2 > r * r || (clipBody && wy < 1.5 - clipShear * c[2])) continue;
      const dz = Math.sqrt(r * r - d2), n = [dx / r, dy / r, dz / r], i = (OY - wy) * BW + (OX + wx);
      plot(i, c[2] + dz, dot(n, LIGHT), part, mat, wx, wy, 0);
    }
}
function sweep(a, b, ra, rb, part, mat, bulge = 0) {
  const n = Math.max(2, Math.ceil(len(sub(b, a)) / 0.4));
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    sphere(add(a, mul(sub(b, a), u)), ra + (rb - ra) * u + bulge * Math.sin(u * Math.PI), part, mat);
  }
}
// an ellipsoid with radii r along the axes of frame R, seen along z
function ellipsoid(c, R, r, part, mat, minY = -Infinity) {
  const big = Math.max(r[0], r[1], r[2]), x0 = Math.floor(c[0] - big), x1 = Math.ceil(c[0] + big), y0 = Math.floor(c[1] - big), y1 = Math.ceil(c[1] + big);
  const Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]], D = [1 / (r[0] * r[0]), 1 / (r[1] * r[1]), 1 / (r[2] * r[2])];
  // A = R diag(D) R^T
  const A = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i * 3 + j] = R[i * 3] * D[0] * R[j * 3] + R[i * 3 + 1] * D[1] * R[j * 3 + 1] + R[i * 3 + 2] * D[2] * R[j * 3 + 2];
  void Rt;
  for (let wy = y0; wy <= y1; wy++)
    for (let wx = x0; wx <= x1; wx++) {
      if ((clipBody && wy < 1.5 - clipShear * c[2]) || wy < minY) continue;
      const dx = wx - c[0], dy = wy - c[1];
      const qa = A[8], qb = 2 * (A[2] * dx + A[5] * dy), qc = A[0] * dx * dx + 2 * A[1] * dx * dy + A[4] * dy * dy - 1, disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const dz = (-qb + Math.sqrt(disc)) / (2 * qa);
      const n = unit([A[0] * dx + A[1] * dy + A[2] * dz, A[3] * dx + A[4] * dy + A[5] * dz, A[6] * dx + A[7] * dy + A[8] * dz]);
      plot((OY - wy) * BW + (OX + wx), c[2] + dz, dot(n, LIGHT), part, mat, wx, wy, 0);
    }
}
// parts: each has its own number, so edges between them can be seen
export const PART = { pelvis: 1, waist: 2, chest: 3, neck: 4, head: 5, face: 6, upperN: 7, elbowN: 8, foreN: 9, handN: 10, upperF: 11, elbowF: 12, foreF: 13, handF: 14, thighN: 15, kneeN: 16, shinN: 17, footN: 18, thighF: 19, kneeF: 20, shinF: 21, footF: 22, weapon: 23, offWeapon: 24, helm: 25, pauldronN: 26, pauldronF: 27,
  // Aschenthron: Ausrüstung und Körpermerkmale als eigene Teile (eigene Farbe je Teil, Kanten dazwischen)
  shield: 28, shieldRim: 29, shieldBoss: 30, cloak: 31, cloakHem: 32, robe: 33, robeHem: 34, quiver: 35, fletch: 36, crest: 37, ear: 38, horn: 39, tail: 40, wing: 41, hood: 42, belly: 43, beard: 44, crack: 45, rivet: 46 };

// a frame from three directions (made orthonormal, first one kept): columns = local x, y, z
function axes(x, y) {
  x = unit(x);
  y = unit(sub(y, mul(x, dot(y, x))));
  const z = cross(x, y);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}
const lerp3 = (a, b, u) => add(a, mul(sub(b, a), u));

function drawBody(S) {
  const { B, armN, armF, legN, legF, sN, sF, hipN, hipF, turn } = S, F_ = (name) => B[name];
  const k = BODY.size, tk = k * BODY.torso, wk = k * BODY.width, hk = k * BODY.head, lk = k * BODY.limb, bk = BODY.belly;
  const at = (f, v) => add(F_(f).t, mv(F_(f).R, v));
  const gear = S.q.gear ?? {};
  const C = F_("chest"), fwd = mv(C.R, [1, 0, 0]), up = mv(C.R, [0, 1, 0]), across = mv(C.R, [0, 0, 1]);
  const ghost = !!gear.ghost; // ohne Beine (Geister): Robe bis zum Boden, schwebt
  if (gear.golem) return drawGolem(S, gear.golem);
  if (gear.ribs) {
    // Skelett: Becken, dünne Wirbelsäule, Brustkorb aus Rippenbögen um einen dunklen Hohlraum
    ellipsoid(at("pelvis", [0, -0.2 * k, 0]), F_("pelvis").R, [2.4 * k, 1.9 * k, 3.9 * wk], PART.pelvis, 0);
    sweep(F_("pelvis").t, C.t, 1.1 * k, 1.2 * k, PART.waist, 1);
    ellipsoid(at("chest", [0, 0.6 * tk, 0]), C.R, [2.6 * k, 3.2 * tk, 4.6 * wk], PART.belly, 0);
    for (let j = 0; j < 4; j++) {
      const y = (2.7 - j * 1.45) * tk, rx = (3.7 - j * 0.25) * k, rz = (5.9 - j * 0.55) * wk;
      for (let a = 0; a < Math.PI * 2; a += 0.3) sphere(at("chest", [Math.cos(a) * rx, y - Math.abs(Math.sin(a)) * 0.5 * k, Math.sin(a) * rz]), 0.72 * k, PART.chest, 0);
    }
    sphere(at("chest", [0, 3.4 * tk, 0]), 1.6 * k, PART.chest, 0);
  } else {
    ellipsoid(at("pelvis", [0, -0.2 * k, 0]), F_("pelvis").R, [3.2 * k * bk, 2.6 * k, 4.7 * wk], PART.pelvis, 0);
    sweep(F_("pelvis").t, C.t, 3.5 * k * bk, 3.8 * wk, PART.waist, 1);
    ellipsoid(at("chest", [0.3 * k, 0.8 * tk, 0]), C.R, [4.0 * k * Math.max(1, bk * 0.9), 4.3 * tk, 6.6 * wk], PART.chest, 0);
  }
  if (bk > 1.05 && !gear.ribs) ellipsoid(at("waist", [1.2 * k * bk, -0.6 * k, 0]), C.R, [3.4 * k * bk, 3.4 * k, 4.6 * wk], PART.belly, 0);
  sweep(F_("neck").t, add(F_("neck").t, mv(F_("head").R, [0, 1.6 * hk, 0])), 1.7 * lk * BODY.neck ** 0.3, 1.5 * lk, PART.neck, 1);
  const H = F_("head"), hr = (v) => mv(H.R, v), atH = (v) => add(H.t, hr(v));
  const back = hr([1, 0, 0])[2];
  if (gear.helm === 3) {
    // Topfhelm: ganzer Kopf in Eisen, Sehschlitz (Augenmarken) und Kamm/Krone obendrauf
    ellipsoid(atH([0.4 * hk, 0.3 * hk, 0]), H.R, [4.4 * hk, 4.5 * hk, 4.1 * hk], PART.helm, 0);
  } else {
    ellipsoid(H.t, H.R, [3.8 * hk, 4.0 * hk, 3.6 * hk], PART.head, 0);
    ellipsoid(atH([1.05 * hk, -0.55 * hk, 0]), H.R, [3.0 * hk * (gear.snout ?? 1), 3.25 * hk, 2.95 * hk], PART.face, 0);
  }
  if (gear.beard) ellipsoid(atH([2.6 * hk, -2.6 * hk, 0]), H.R, [1.8 * hk, 2.4 * hk * gear.beard, 2.6 * hk], PART.beard, 0);
  if (gear.helm === 1 || gear.helm === 2 || gear.helm === 4) {
    // Kappe/Helm: Schale über Stirn und Hinterkopf, das Gesicht bleibt unterhalb der Krempe frei; Eisen mit Nasenkamm
    ellipsoid(atH([-0.25 * hk, 0.75 * hk, 0]), H.R, [4.3 * hk, 3.8 * hk, 4.1 * hk], PART.helm, 0, H.t[1] + 0.4 * hk - (back < -0.5 ? 2.5 * hk : 0));
    if (gear.helm === 2) ellipsoid(atH([3.4 * hk, -0.6 * hk, 0]), H.R, [0.9 * hk, 2.4 * hk, 0.8 * hk], PART.helm, 1);
  }
  if (gear.helm === 4) {
    // Kronenhelm: Zacken rundum über der Krempe
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + 0.3;
      sweep(atH([Math.cos(a) * 3.2 * hk, 2.6 * hk, Math.sin(a) * 3.2 * hk]), atH([Math.cos(a) * 3.4 * hk, 5.2 * hk, Math.sin(a) * 3.4 * hk]), 0.9 * hk, 0.4 * hk, PART.crest, 0);
    }
  }
  if (gear.helm === 5) {
    // Kapuze: weite Haube um Kopf und Nacken, vorn offen
    ellipsoid(atH([-1.3 * hk, 0.6 * hk, 0]), H.R, [4.4 * hk, 4.6 * hk, 4.4 * hk], PART.hood, 0, back < -0.5 ? -99 : H.t[1] - 3.5 * hk);
    sweep(atH([-1.5 * hk, -2 * hk, 0]), at("chest", [-1.5 * k, 2.6 * tk, 0]), 3.6 * hk, 4.6 * wk, PART.hood, 1);
  }
  if (gear.hat) {
    // Spitzhut (Hexe, Nekromant): Krempe und schiefe Spitze
    ellipsoid(atH([0, 2.8 * hk, 0]), H.R, [6.2 * hk, 0.9 * hk, 6.2 * hk], PART.hood, 0);
    sweep(atH([0, 3.2 * hk, 0]), atH([-3.2 * hk, 10.5 * hk, 0.6 * hk]), 3.6 * hk, 0.5 * hk, PART.hood, 0);
  }
  if (gear.crest) {
    // Kamm/Federbusch von der Stirn zum Nacken (Seltenheitsfarbe)
    for (let u = 0; u <= 1.001; u += 0.1) {
      const a = (u - 0.35) * 2.4;
      sphere(atH([Math.cos(a) * 3.6 * hk, (gear.helm === 3 ? 4.6 : 4.1) * hk + Math.sin(u * Math.PI) * 1.2 * hk, 0]), (1.1 - u * 0.5) * hk, PART.crest, 0);
    }
  }
  if (gear.ears) {
    // spitze Ohren (Goblins, Imps): vom Kopf schräg nach hinten oben
    for (const s2 of [1, -1]) sweep(atH([-0.2 * hk, 0.6 * hk, s2 * 3.3 * hk]), atH([-1.6 * hk, 2.2 * hk, s2 * (3.3 + 3.2 * gear.ears) * hk]), 1.3 * hk, 0.35 * hk, PART.ear, 0);
  }
  if (gear.horns) {
    for (const s2 of [1, -1]) {
      const a0 = atH([0.6 * hk, 3.0 * hk, s2 * 2.2 * hk]), a1 = atH([-0.6 * hk, 5.2 * hk, s2 * 3.6 * hk]), a2 = atH([-2.4 * hk, (5.2 + 1.8 * gear.horns) * hk, s2 * 3.4 * hk]);
      sweep(a0, a1, 1.1 * hk, 0.7 * hk, PART.horn, 0);
      sweep(a1, a2, 0.7 * hk, 0.25 * hk, PART.horn, 0);
    }
  }
  const arm = (far, A, sh, up2, el, fo, ha) => {
    sphere(sh, 2.9 * lk, up2, 0);
    sweep(sh, A.joint, 2.5 * lk, 1.9 * lk, up2, 0);
    // Schulterplatte: flache Kappe über dem Oberarmansatz
    if (gear.pauldron) ellipsoid(add(sh, [0, 0.9 * k, 0]), C.R, [3.1 * lk, 2.3 * lk, 3.3 * lk], far ? PART.pauldronF : PART.pauldronN, 0);
    sphere(A.joint, 1.7 * lk, el, 1);
    sweep(A.joint, A.end, 1.9 * lk, 1.5 * lk, fo, 0, 0.15 * lk);
    sphere(A.end, 2.1 * lk * (gear.fists ?? 1), ha, 0);
  };
  arm(false, armN, sN, PART.upperN, PART.elbowN, PART.foreN, PART.handN);
  arm(true, armF, sF, PART.upperF, PART.elbowF, PART.foreF, PART.handF);
  const leg = (L, hip, th, kn, sh, fo, nameFt) => {
    sweep(hip, L.joint, 3.4 * lk, 2.5 * lk, th, 0);
    sphere(L.joint, 2.1 * lk, kn, 1);
    sweep(L.joint, L.end, 2.4 * lk, 1.8 * lk, sh, 0, 0.4 * lk);
    const R = F_(nameFt).R, a = F_(nameFt).t;
    sweep(add(a, mv(R, [-1.4 * k, -0.6 * k, 0])), add(a, mv(R, [3.9 * k * (gear.feet ?? 1), -1.1 * k, 0])), 2.0 * lk, 1.5 * lk, fo, 0);
  };
  if (!ghost) {
    leg(legN, hipN, PART.thighN, PART.kneeN, PART.shinN, PART.footN, "footN");
    leg(legF, hipF, PART.thighF, PART.kneeF, PART.shinF, PART.footF, "footF");
  }
  if (gear.robe || ghost) {
    // Robe als Rock: übereinander gestapelte Scheiben von der Hüfte bis über die Füße, unten weiter; folgt der Mitte der Füße
    const P = F_("pelvis"), top = at("pelvis", [0, 0.6 * k, 0]);
    const feet = lerp3(legN.end, legF.end, 0.5), bot = [feet[0] * 0.8 + top[0] * 0.2, (ghost ? 0.5 : 2.4) * k, feet[2] * 0.5];
    const R = axes(sub(top, bot), mv(P.R, [1, 0, 0]));
    const n = Math.ceil(len(sub(top, bot)) / 0.5);
    for (let j = 0; j <= n; j++) {
      const u = j / n, c = lerp3(top, bot, u), flare = 1 + u * (ghost ? 0.1 : 0.35);
      const hem = u > 1 - 1.4 / Math.max(1, len(sub(top, bot)));
      ellipsoid(c, mm(R, [1, 0, 0, 0, 1, 0, 0, 0, 1]), [0.6, 4.4 * k * bk * flare, 6.1 * wk * flare], hem ? PART.robeHem : PART.robe, 0);
    }
  }
  if (gear.cloak) {
    // Umhang hinter dem Rücken: Bahn von den Schultern bis zu den Kniekehlen, schwingt mit `sway`
    const sway = (S.q.sway ?? 0) * k;
    const top = add(C.t, add(mul(up, 3.0 * tk), mul(fwd, -3.4 * k)));
    const bot = [C.t[0] - fwd[0] * (4.2 * k + sway), (ghost ? 2 : 4.2) * k * BODY.legs, C.t[2] - fwd[2] * (4.2 * k + sway)];
    const R = axes(fwd, sub(top, bot));
    const n = Math.ceil(len(sub(top, bot)) / 0.5);
    for (let j = 0; j <= n; j++) {
      const u = j / n, c = lerp3(top, bot, u), w = (5.6 + 2.0 * u) * wk;
      ellipsoid(c, R, [0.9 * k, 0.7, w], u > 0.86 ? PART.cloakHem : PART.cloak, 0);
    }
  }
  if (gear.quiver) {
    // Köcher schräg über dem Rücken, Federn oben
    const a = add(C.t, add(add(mul(up, 4.6 * tk), mul(fwd, -4.4 * k)), mul(across, -2.6 * wk)));
    const b = add(C.t, add(add(mul(up, -3.4 * tk), mul(fwd, -4.0 * k)), mul(across, 2.4 * wk)));
    sweep(a, b, 1.6 * k, 1.4 * k, PART.quiver, 0);
    for (const o of [-0.9, 0.6]) sphere(add(a, add(mul(across, o * k), mul(up, 1.6 * k))), 0.9 * k, PART.fletch, 0);
  }
  if (gear.wings) {
    // Flügel (Imp, Dämonen): zwei Hautsegel hinter den Schultern
    for (const s2 of [1, -1]) {
      const root = add(C.t, add(mul(up, 2.2 * tk), add(mul(fwd, -3.6 * k), mul(across, s2 * 2.4 * wk))));
      const tip = add(root, add(mul(up, 6 * k * gear.wings), add(mul(fwd, -4.5 * k), mul(across, s2 * 5.5 * k * gear.wings))));
      sweep(root, tip, 1.0 * k, 0.4 * k, PART.wing, 1);
      ellipsoid(lerp3(root, tip, 0.5), axes(sub(tip, root), fwd), [3.9 * k * gear.wings, 3.2 * k * gear.wings, 0.5], PART.wing, 0);
    }
  }
  if (gear.tail) {
    const P = F_("pelvis");
    let prev = at("pelvis", [-2.6 * k, 0.4 * k, 0]);
    for (let j = 1; j <= 6; j++) {
      const u = j / 6, nx = at("pelvis", [-2.6 * k - u * 7 * k * gear.tail, 0.4 * k - Math.sin(u * 2.4) * 3 * k + u * u * 4 * k, Math.sin(u * 3 + (S.q.sway ?? 0)) * 1.2 * k]);
      sweep(prev, nx, (1.3 - u * 0.8) * k, (1.3 - u * 0.9) * k, PART.tail, 0);
      prev = nx;
    }
    void P;
  }
  if (gear.shield) {
    // Schild am Fernarm: Fläche vor der Faust, Vorderseite in Blickrichtung (etwas zur Kamera), Rand, Buckel
    // von der Seite weiter zur Kamera gedreht, sonst sieht man nur die Kante
    // (Richtungen ohne die Scherung der Schrägsicht: eine Scheibe, die zur Kamera zeigt, bleibt so im Bild nur verschoben)
    const sh = S.q.shear ?? 0, flat = (v) => [v[0], v[1] + sh * v[2], v[2]];
    const hand = armF.end, nrm = unit(add(flat(fwd), mul(flat(across), S.q.yaw ? 0.8 : 1.7))), R = axes(nrm, flat(up));
    const c = add(hand, add(mul([nrm[0], nrm[1] - sh * nrm[2], nrm[2]], (S.q.yaw ? 1.4 : 3.4) * k), mul(up, -0.5 * k)));
    const tall = gear.shield === 3 ? 1.35 : gear.shield === 2 ? 1.15 : 1, wide = gear.shield === 3 ? 0.95 : gear.shield === 2 ? 0.85 : 1;
    ellipsoid(add(c, mul(nrm, -0.3)), R, [0.8, 5.4 * k * tall, 4.8 * k * wide], PART.shieldRim, 0);
    ellipsoid(c, R, [0.9, 4.6 * k * tall, 4.0 * k * wide], PART.shield, 0);
    if (gear.shield === 2) ellipsoid(add(c, mul(up, -4.6 * k)), R, [0.8, 2.6 * k, 2.4 * k], PART.shieldRim, 0);
    sphere(add(c, mul(nrm, 0.9)), 1.3 * k, PART.shieldBoss, 0);
  }
  void turn;
}

// Aschenthron: Golem (1 Stein, 2 Eisen): massiger Rumpf aus zwei Blöcken, kleiner Kopf tief zwischen Schulterbrocken mit
// Brauenwulst, Arme, die nach unten dicker werden, bis fast zum Boden, kurze Säulenbeine. Stein hat Risse (eigenes Teil
// `crack`, im Spiel dunkel oder glühend), Eisen Plattenkanten und Nieten (`rivet`). Maße in `size`, nicht in `limb`.
function drawGolem(S, kind) {
  const { B, armN, armF, legN, legF, sN, sF, hipN, hipF } = S, F_ = (name) => B[name];
  const k = BODY.size, hk = k * BODY.head;
  const at = (f, v) => add(F_(f).t, mv(F_(f).R, v));
  const C = F_("chest"), iron = kind === 2;
  ellipsoid(at("pelvis", [0, -0.3 * k, 0]), F_("pelvis").R, [3.8 * k, 3.0 * k, 5.4 * k], PART.pelvis, 0);
  sweep(F_("pelvis").t, C.t, 3.9 * k, 4.6 * k, PART.waist, 1);
  // Brustblock und vorgewölbter Bauchblock: die Fuge dazwischen trennt sie
  const chest = [0.8 * k, 1.2 * k, 0], R0 = [6.0 * k, 5.6 * k, 7.4 * k];
  ellipsoid(at("chest", chest), C.R, R0, PART.chest, 0);
  ellipsoid(at("chest", [2.4 * k, -3.2 * k, 0]), C.R, [4.4 * k, 3.6 * k, 5.8 * k], PART.belly, 0);
  // Punkte auf der Brustoberfläche: a = um die Hochachse (0 vorn, + zur nahen Seite), b = hoch/runter
  const onChest = (a, b, out = 1.02) => at("chest", add(chest, [R0[0] * Math.cos(b) * Math.cos(a) * out, R0[1] * Math.sin(b) * out, R0[2] * Math.cos(b) * Math.sin(a) * out]));
  if (iron) {
    // Plattenkante quer über die Brust, Nieten darauf und am Bauchblock
    for (let a = -0.9; a <= 1.5; a += 0.12) sphere(onChest(a, -0.05, 1.0), 0.75 * k, PART.crack, 0);
    for (let a = -0.7; a <= 1.4; a += 0.42) sphere(onChest(a, 0.32, 1.03), 0.62 * k, PART.rivet, 0);
    for (let a = -0.5; a <= 1.2; a += 0.55) sphere(at("chest", [1.9 * k + 3.8 * k * Math.cos(a), -2.6 * k, 5.4 * k * Math.sin(a)]), 0.6 * k, PART.rivet, 0);
  } else {
    // Risse: Zickzack-Linien über die vordere, zur Kamera gewandte Brust
    const cracks = [[[0.15, 0.75], [0.35, 0.45], [0.25, 0.2], [0.5, -0.05]], [[0.9, 0.6], [1.1, 0.3], [0.95, 0.05]], [[-0.35, 0.4], [-0.15, 0.15]]];
    for (const line of cracks) for (let j = 0; j + 1 < line.length; j++) {
      const [a0, b0] = line[j], [a1, b1] = line[j + 1];
      for (let u = 0; u <= 1.001; u += 0.2) sphere(onChest(a0 + (a1 - a0) * u, b0 + (b1 - b0) * u), 0.5 * k, PART.crack, 0);
    }
  }
  // Kopf: klein, tief eingesunken, Gesichtsstein mit glühenden Augen unter einem Brauenwulst
  // (vorn oben auf dem Brustblock statt auf dem Hals, sonst steckt er von vorn hinter der Brust; die Augen folgen B.head)
  const H = F_("head");
  H.t = at("chest", [3.6 * k, 6.2 * k, 0]);
  const atH = (v) => add(H.t, mv(H.R, v));
  ellipsoid(H.t, H.R, [3.4 * hk, 3.2 * hk, 3.4 * hk], PART.head, 0);
  ellipsoid(atH([1.05 * hk, -0.55 * hk, 0]), H.R, [3.0 * hk, 3.0 * hk, 2.95 * hk], PART.face, 0);
  ellipsoid(atH([1.7 * hk, 1.5 * hk, 0]), H.R, [2.6 * hk, 1.15 * hk, 3.6 * hk], iron ? PART.helm : PART.head, 0);
  if (iron) for (const s2 of [1, -1]) sphere(atH([0.4 * hk, 2.2 * hk, s2 * 2.8 * hk]), 0.6 * k, PART.rivet, 0);
  // Arme: Schulterbrocken, Oberarm, Ellbogen, Unterarm nach unten dicker, Faustblock
  const arm = (far, A, sh) => {
    const P2 = far ? PART.pauldronF : PART.pauldronN, U = far ? PART.upperF : PART.upperN, E = far ? PART.elbowF : PART.elbowN, Fo = far ? PART.foreF : PART.foreN, Ha = far ? PART.handF : PART.handN;
    sweep(sh, A.joint, 2.5 * k, 2.2 * k, U, 0);
    sphere(A.joint, 2.3 * k, E, 1);
    sweep(A.joint, A.end, 2.4 * k, 3.0 * k, Fo, 0);
    const dir = unit(sub(A.end, A.joint));
    ellipsoid(add(A.end, mul(dir, 1.2 * k)), axes(dir, mv(C.R, [1, 0, 0])), [3.3 * k, 3.0 * k, 3.1 * k], Ha, 0);
    ellipsoid(add(sh, mv(C.R, [-0.3 * k, 1.2 * k, 0])), C.R, [3.6 * k, 3.0 * k, 3.6 * k], P2, 0);
    if (iron) for (let j = -1; j <= 1; j++) sphere(add(sh, mv(C.R, [j * 1.6 * k, 4.1 * k, 0])), 0.6 * k, PART.rivet, 0);
  };
  arm(false, armN, sN);
  arm(true, armF, sF);
  // Beine: kurze Säulen, breite Füße
  const leg = (L, hip, th, kn, shn, fo, nameFt) => {
    sweep(hip, L.joint, 3.5 * k, 3.1 * k, th, 0);
    sphere(L.joint, 2.7 * k, kn, 1);
    sweep(L.joint, L.end, 3.0 * k, 3.3 * k, shn, 0);
    ellipsoid(add(F_(nameFt).t, mv(F_(nameFt).R, [1.3 * k, -0.7 * k, 0])), F_(nameFt).R, [4.0 * k, 1.9 * k, 3.1 * k], fo, 0);
  };
  leg(legN, hipN, PART.thighN, PART.kneeN, PART.shinN, PART.footN, "footN");
  leg(legF, hipF, PART.thighF, PART.kneeF, PART.shinF, PART.footF, "footF");
}

// ---- what they hold: drawn along the handle from the fist, through the same depth buffer
function along(H, axis, side, part) {
  const n = cross(axis, side);
  const T = (i, k, c, lift = 0) => {
    i *= WK; k *= WK; lift *= WK;
    if (TINT.has(c)) c = TINT.get(c);
    const x = H[0] + axis[0] * i + side[0] * k + n[0] * lift, y = H[1] + axis[1] * i + side[1] * k + n[1] * lift, z = H[2] + axis[2] * i + side[2] * k + n[2] * lift;
    const wx = Math.round(x), wy = Math.round(y);
    if (clipWeapon && wy < -clipShear * z) return;
    const idx = (OY - wy) * BW + (OX + wx);
    if (idx < 0 || idx >= BW * BH) return;
    plot(idx, z + 0.05, 2, part, 2, wx, wy, c);
  };
  T.at = (i, k) => [H[0] + axis[0] * i * WK + side[0] * k * WK, H[1] + axis[1] * i * WK + side[1] * k * WK, H[2] + axis[2] * i * WK + side[2] * k * WK];
  return T;
}
// Aschenthron: Waffengröße (wächst mit der Figur) und Umfärben je Pose: `accent` ersetzt Bronze (Seltenheit), `orb` die Stabkugel,
// `blade` den Stahl (z. B. Knochen, rostig)
let WK = 1;
const TINT = new Map();
function setTint(q) {
  TINT.clear();
  WK = BODY.size * (q.wscale ?? 1);
  const ramp = (from, to) => { if (to) from.forEach((c, j) => TINT.set(c, to[j] >>> 0)); };
  ramp([STEEL.gold, STEEL.goldD], q.accent);
  ramp([STEEL.orb, STEEL.orbD], q.orb);
  ramp([STEEL.hi, STEEL.a, STEEL.b, STEEL.d], q.blade);
  ramp([STEEL.wood, STEEL.woodD], q.wood);
}
// gedämpfter als im Original: Eisen statt Chrom, Bronze statt Gold (dunkle Welt)
const STEEL = Object.fromEntries(Object.entries({ hi: "#e8ecf0", a: "#b8c0cc", b: "#848c9c", d: "#565c6c", gold: "#c89a48", goldD: "#8a6430", grip: "#6a3a26", gripD: "#3e2016", wood: "#8a5a32", woodD: "#5a3820", dark: "#3a3448", darkD: "#262033", olive: "#58663f", oliveA: "#7d8c58", oliveD: "#3a4529", orb: "#8fd0ff", orbD: "#4a7ac8" }).map(([k, v]) => [k, hex(v) >>> 0]));
function blade(T, from, length, w) {
  for (let i = from; i <= from + length + 0.01; i += 0.4) {
    const r = i - from, wd = r > length - 5 ? Math.max(0, ((length - r) / 5) * w) : w;
    for (let k = -wd; k <= wd + 0.01; k += 0.4) T(i, k, k < -w * 0.4 ? STEEL.hi : k > w * 0.4 ? STEEL.d : STEEL.a);
  }
}
const haft = (T, from, to, a, d, r = 0.8) => {
  for (let i = from; i <= to; i += 0.4) for (let k = -r; k <= r + 0.01; k += 0.4) T(i, k, k > 0.1 ? d : a);
};
export const WEAPONS = {
  // Aschenthron: Kurzschwert passend zur gedrungenen Figur (Klinge 12 statt 25)
  shortsword: { two: -3.6, draw(T) {
    haft(T, -2.4, 1.8, STEEL.grip, STEEL.gripD, 0.7);
    for (let k = -1.2; k <= 1.2; k += 0.4) T(-2.8, k, STEEL.goldD);
    for (let k = -3.4; k <= 3.4; k += 0.4) { T(2.2, k, Math.abs(k) > 2.6 ? STEEL.goldD : STEEL.gold); T(2.6, k, STEEL.goldD); }
    blade(T, 2.8, 12, 1.7);
  } },
  // Stab: Holzschaft mit Kugel (Platzhalter)
  staff: { two: -7, draw(T) {
    haft(T, -11, 13, STEEL.wood, STEEL.woodD, 0.6);
    for (let i = 13; i <= 17.6; i += 0.4) for (let k = -2.2; k <= 2.2; k += 0.4) {
      const r = Math.hypot(i - 15.3, k);
      if (r <= 2.3) T(i, k, r < 1 && k < 0 ? STEEL.hi : k > 0.8 ? STEEL.orbD : STEEL.orb);
    }
  } },
  // kleiner Bogen: Sehne folgt der Zughand (`pull`), mit `nocked` liegt ein Pfeil auf
  smallbow: { across: true, draw(T, q, off) {
    for (let u = -1; u <= 1.001; u += 0.04) {
      const k = u * 10, i = 3.6 * (1 - u * u) - 0.6;
      T(i, k, Math.abs(u) > 0.85 ? STEEL.goldD : STEEL.wood);
      T(i + 0.6, k, STEEL.woodD);
    }
    const tipA = T.at(-0.6, -10), tipB = T.at(-0.6, 10), mid = q.pull ? off : T.at(-0.6, 0);
    const line = (A, B, c) => {
      const n = Math.max(2, Math.ceil(len(sub(B, A)) / 0.4));
      for (let j = 0; j <= n; j++) {
        const P = add(A, mul(sub(B, A), j / n)), wx = Math.round(P[0]), wy = Math.round(P[1]), idx = (OY - wy) * BW + (OX + wx);
        if (idx >= 0 && idx < BW * BH) plot(idx, P[2] + 0.05, 2, PART.weapon, 2, wx, wy, c);
      }
    };
    line(tipA, mid, STEEL.a);
    line(tipB, mid, STEEL.a);
    if (q.nocked) {
      const tip = T.at(9, 0);
      line(mid, tip, STEEL.wood);
      for (let i = 7; i <= 10; i += 0.4) for (let k = -(10 - i) * 0.5; k <= (10 - i) * 0.5; k += 0.4) T(i, k, STEEL.hi);
    }
  } },
  // Axt: Holzstiel, Blatt nach vorn
  axe: { two: -4, draw(T) {
    haft(T, -3, 12, STEEL.wood, STEEL.woodD, 0.6);
    for (let i = 7; i <= 12.5; i += 0.4) {
      const w = 1.2 + ((i - 7) / 5.5) * 3.4;
      for (let k = -w; k <= 0.4; k += 0.4) T(i - k * 0.25, k - 0.6, k < -w + 0.9 ? STEEL.hi : k > -0.6 ? STEEL.d : STEEL.a);
    }
  } },
  // Streitkolben/Hammer: kurzer Stiel, schwerer Kopf
  mace: { two: -4, draw(T) {
    haft(T, -3, 9, STEEL.grip, STEEL.gripD, 0.6);
    for (let i = 8.5; i <= 13; i += 0.4) for (let k = -2.4; k <= 2.4; k += 0.4) T(i, k, k < -1.2 ? STEEL.a : k > 1.2 ? STEEL.d : i > 12.4 ? STEEL.hi : STEEL.b);
    for (const k of [-3, 3]) for (let i = 9.5; i <= 12; i += 0.4) T(i, k, STEEL.d);
  } },
  // Keule: knorriger Holzprügel (Goblins, Trolle)
  club: { two: -4, draw(T) {
    for (let i = -2.5; i <= 13; i += 0.4) {
      const r = 0.7 + Math.max(0, (i - 3) / 10) * 2.1 + (Math.abs(i - 9) < 0.5 ? 0.5 : 0);
      for (let k = -r; k <= r; k += 0.4) T(i, k, k < -r * 0.4 ? STEEL.wood : k > r * 0.4 ? STEEL.darkD : STEEL.woodD);
    }
  } },
  // Zauberstab: kurz, mit Kugel (Schamanen, Hexen)
  wand: { draw(T) {
    haft(T, -1.5, 8, STEEL.wood, STEEL.woodD, 0.5);
    for (let i = 8; i <= 11.4; i += 0.4) for (let k = -1.6; k <= 1.6; k += 0.4) {
      const r = Math.hypot(i - 9.7, k);
      if (r <= 1.7) T(i, k, r < 0.7 && k < 0 ? STEEL.hi : k > 0.5 ? STEEL.orbD : STEEL.orb);
    }
  } },
  // the fist is at i = 0; `two` is where the other hand goes; `across`: the handle lies across the weapon's length
  sword: { two: -4.4, draw(T, q) {
    const end = q.two ? -6.5 : -2.6;
    haft(T, end, 2.2, STEEL.grip, STEEL.gripD);
    for (let k = -1.4; k <= 1.4; k += 0.4) T(end - 0.4, k, STEEL.gold);
    for (let k = -4.6; k <= 4.6; k += 0.4) { T(2.6, k, Math.abs(k) > 3.8 ? STEEL.goldD : STEEL.gold); T(3, k, STEEL.goldD); }
    blade(T, 3.2, 25, 2.2);
  } },
  greatsword: { two: -4.8, draw(T) {
    haft(T, -7.2, 2.2, STEEL.grip, STEEL.gripD);
    for (let k = -1.8; k <= 1.8; k += 0.4) T(-7.6, k, STEEL.gold);
    for (let k = -6.6; k <= 6.6; k += 0.4) { T(2.6, k, Math.abs(k) > 5.6 ? STEEL.goldD : STEEL.gold); T(3, k, STEEL.goldD); }
    blade(T, 3.2, 31, 3);
    for (let i = 4; i <= 28; i += 0.4) T(i, 0, STEEL.b);
  } },
  dagger: { draw(T) {
    haft(T, -2.4, 1.8, STEEL.grip, STEEL.gripD);
    for (let k = -2.6; k <= 2.6; k += 0.4) T(2.2, k, STEEL.goldD);
    blade(T, 2.6, 10, 1.3);
  } },
  spear: { two: -12, draw(T) {
    haft(T, -18, 36, STEEL.wood, STEEL.woodD, 0.5);
    blade(T, 36, 11, 2);
    for (let k = -2.4; k <= 2.4; k += 0.4) T(36, k, STEEL.goldD);
  } },
  hammer: { two: -7, draw(T) {
    for (const lift of [-0.8, 0, 0.8]) for (let i = -10; i <= 18; i += 0.4) for (let k = -0.8; k <= 0.81; k += 0.4) T(i, k, k > 0.1 ? STEEL.woodD : STEEL.wood, lift);
    // the head is a block: its two faces, and the steel between them
    for (let i = 18; i <= 28; i += 0.4) for (let k = -9; k <= 9; k += 0.4) {
      const face = Math.abs(k) > 7.4 ? (k < 0 ? STEEL.a : STEEL.d) : i < 20 ? STEEL.hi : i > 26.4 ? STEEL.d : Math.abs(k) < 2 ? STEEL.gold : STEEL.b;
      T(i, k, face, 4.5);
      T(i, k, face, -4.5);
      if (i < 18.4 || i > 27.6 || Math.abs(k) > 8.6) for (let l = -4; l <= 4; l += 0.4) T(i, k, k < 0 ? STEEL.a : i > 27.6 ? STEEL.d : STEEL.b, l);
    }
  } },
  scythe: { two: -11, draw(T) {
    haft(T, -16, 31, STEEL.dark, STEEL.darkD, 0.5);
    for (let j = 0; j <= 28; j += 0.4) {
      const u = j / 28, w = 3.2 * (1 - u) + 0.3, b = 31.5 - u * u * 12;
      for (let k = -w; k <= w; k += 0.4) T(b + k, j + 0.8, k > w * 0.3 ? STEEL.hi : k < -w * 0.4 ? STEEL.d : STEEL.b);
    }
  } },
  claw: { draw(T) {
    for (const q0 of [-2.4, 0, 2.4])
      for (let i = 2; i <= 9.5; i += 0.4) {
        const u = (i - 2) / 7.5, k = q0 + u * u * 1.8;
        T(i, k, u > 0.55 ? STEEL.hi : STEEL.a);
        if (u < 0.6) T(i, k + 0.8, STEEL.d);
      }
  } },
  bow: { across: true, draw(T, q, off) {
    for (let u = -1; u <= 1.001; u += 0.025) {
      const k = u * 17, i = 6 * (1 - u * u) - 1;
      T(i, k, Math.abs(u) > 0.85 ? STEEL.goldD : STEEL.wood);
      T(i + 0.8, k, STEEL.woodD);
    }
    const tipA = T.at(-1, -17), tipB = T.at(-1, 17), mid = q.pull ? off : T.at(-1, 0);
    const line = (A, B, c) => {
      const n = Math.max(2, Math.ceil(len(sub(B, A)) / 0.4)), Z = STEEL.a;
      for (let k = 0; k <= n; k++) {
        const P = add(A, mul(sub(B, A), k / n)), wx = Math.round(P[0]), wy = Math.round(P[1]), idx = (OY - wy) * BW + (OX + wx);
        plot(idx, P[2] + 0.05, 2, PART.weapon, 2, wx, wy, c ?? Z);
      }
    };
    line(tipA, mid);
    line(tipB, mid);
    if (q.nocked) {
      const nock = mid, tip = T.at(13, 0);
      line(nock, tip, STEEL.wood);
      for (let i = 9; i <= 13; i += 0.4) for (let k = -(13 - i) * 0.45; k <= (13 - i) * 0.45; k += 0.4) T(i, k, STEEL.hi);
    }
  } },
  pistol: { across: true, draw(T) {
    for (let i = -1; i <= 9.5; i += 0.4) for (let k = -4.2; k <= -2.4; k += 0.4) T(i, k, k < -3.6 ? STEEL.a : k > -2.9 ? STEEL.d : STEEL.b);
    for (let i = -1.2; i <= 1.2; i += 0.4) for (let k = -2.4; k <= 2.4; k += 0.4) T(i, k, STEEL.gripD);
    T(9, -4.6, STEEL.hi);
  } },
  launcher: { two: -9, draw(T) {
    for (let i = -14; i <= 22; i += 0.4) for (let k = -6; k <= -1; k += 0.4) T(i, k, k < -4.8 ? STEEL.oliveA : k > -2.2 ? STEEL.oliveD : Math.abs(i - 3) < 1.4 ? STEEL.gold : STEEL.olive);
    for (let k = -6.8; k <= -0.2; k += 0.4) { T(22.4, k, STEEL.b); T(-14.4, k, STEEL.d); }
  } },
  handle: { draw(T) {
    haft(T, -2.6, 6, STEEL.grip, STEEL.gripD);
    for (let k = -1.6; k <= 1.6; k += 0.4) { T(-3, k, STEEL.gold); T(6.4, k, STEEL.gold); }
  } },
};

// ---- flat tones, seams, and one clean ink line
function finish(S) {
  const dim = (part) => (part >= PART.upperF && part <= PART.handF) || (part >= PART.thighF && part <= PART.footF) || part === PART.pauldronF ? 1 : 0;
  const toneOf = (v, part) => {
    let t = v > 0.8 ? 0 : v > 0.42 ? 1 : v > 0.08 ? 2 : 3;
    t = Math.min(3, t + dim(part));
    return t;
  };
  const tones = new Map();
  for (const i of touched) tones.set(i, toneOf(Tone[i], Part[i]));
  // a lone pixel of a tone, with no neighbour like it on the same part, takes its neighbours' tone
  for (const i of touched) {
    if (Mat[i] === 2) continue;
    const t = tones.get(i), votes = [0, 0, 0, 0];
    let same = false;
    for (const d of [-1, 1, -BW, BW]) {
      const j = i + d;
      if (Part[j] !== Part[i] || !tones.has(j)) continue;
      const u = tones.get(j);
      votes[u]++;
      if (u === t) same = true;
    }
    if (!same && votes.some((v) => v > 0)) tones.set(i, votes.indexOf(Math.max(...votes)));
  }
  // Aschenthron: Lichtsaum. Wo über oder links neben einem Pixel nichts mehr ist (Licht von links oben), eine Stufe heller,
  // damit die dunkle Figur sich vom dunklen Boden abhebt; nahe Teile (z hoch) bekommen ihn deutlicher als ferne
  if (rimLight) for (const i of touched) {
    if (Mat[i] === 2) continue;
    if (Part[i - BW] === 0 || Part[i - 1] === 0) tones.set(i, Math.max(0, tones.get(i) - (Part[i - BW] === 0 && Part[i - 1] === 0 ? 2 : 1)));
  }
  for (const i of touched) {
    if (Mat[i] === 2) continue;
    Col[i] = (Mat[i] === 1 ? CORE : SHELL)[tones.get(i)];
  }
  // where two parts meet: a soft seam if they touch, ink if one stands in front of the other
  const marks = new Map();
  for (const i of touched) {
    for (const d of [1, BW]) {
      const j = i + d;
      if (Part[j] === 0 || Part[j] === Part[i]) continue;
      const far = Zb[i] < Zb[j] ? i : j, dz = Math.abs(Zb[i] - Zb[j]), steel = Mat[i] === 2 || Mat[j] === 2;
      if (Mat[far] === 2 && dz < 1) continue;
      const ink = steel || dz > 2.2;
      if (ink) marks.set(far, INK);
      else if (!marks.has(far)) marks.set(far, SEAM);
    }
  }
  for (const [i, c] of marks) Col[i] = c;
  // Aschenthron: Augen, wo das Gesicht (oder der Topfhelm) zu sehen ist; Tiere geben ihre Augenpunkte direkt (`eyePts`)
  const { B } = S;
  const eyeAt = (e, ok) => {
    const i = (OY - Math.round(e[1])) * BW + (OX + Math.round(e[0]));
    if (ok(Part[i]) && Zb[i] <= e[2] + 1.2) Col[i] = SHADE.EYE;
  };
  if (S.eyePts) for (const e of S.eyePts) eyeAt(e, (p) => p !== 0);
  if (B && S.q.eyes !== false) {
    const H = B.head, hk = BODY.size * BODY.head, full = S.q.gear?.helm === 3, sn = full ? 1.45 : S.q.gear?.snout ?? 1;
    const fc = full ? add(H.t, mv(H.R, [0.4 * hk, 0.3 * hk, 0])) : add(H.t, mv(H.R, [1.05 * hk, -0.55 * hk, 0]));
    for (const s2 of [1, -1]) eyeAt(add(fc, mv(H.R, [2.68 * sn * hk, (full ? 0.9 : 0.5) * hk, s2 * 1.3 * hk])), (p) => p === PART.face || (full && p === PART.helm));
  }
  // the mark on his chest, when it's facing us
  if (B && S.q.mark !== false && mv(B.chest.R, [1, 0, 0])[2] > 0.15) {
    const chestAt = add(B.chest.t, mv(B.chest.R, [3, 1.6, -1.8]));
    const i = (OY - Math.round(chestAt[1])) * BW + (OX + Math.round(chestAt[0]));
    if (Part[i] === PART.chest) Col[i] = MARK;
  }
  // the outline, and everything into a small list of pixels
  const list = touched.slice(), ring = new Map();
  for (const i of list) for (const d of [-1, 1, -BW, BW]) { const j = i + d; if (Part[j] === 0 && !ring.has(j)) ring.set(j, i); }
  const n = list.length + ring.size, out = { n, xs: new Int16Array(n), ys: new Int16Array(n), color: new Uint32Array(n), shade: new Uint8Array(n), part: new Uint8Array(n), x0: 0, y0: 0, x1: 0, y1: 0 };
  let k = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const push = (i, sh, c, part) => {
    const x = (i % BW) - OX, y = ((i / BW) | 0) - OY;
    out.xs[k] = x; out.ys[k] = y; out.shade[k] = sh; out.color[k] = c; out.part[k] = part;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    k++;
  };
  // Stahl behält seine Farbe, außer wo eine Kante Tinte bekam
  for (const i of list) push(i, Mat[i] === 2 && Col[i] !== INK ? SHADE.STEEL : Col[i], Col[i], Part[i]);
  // Umriss: die Teilnummer des Nachbarn, an dem er hängt (Stahl-Umriss kann das Spiel dunkler färben als den Körper)
  for (const [j, i] of ring) push(j, INK, 0, Part[i]);
  let zs = 0;
  for (const i of list) zs += Zb[i];
  Object.assign(out, { x0, y0, x1, y1, z: list.length ? zs / list.length : 0 });
  for (const i of list) Part[i] = 0;
  touched.length = 0;
  return out;
}

const turnAll = (S, a) => moveAll(S, rotY(-a), [0, 0, 0]);
// Aschenthron: die ganze Figur gedreht (R) und verschoben (d), z. B. beim Umfallen
const moveAll = (S, R, d) => {
  const P = (v) => add(mv(R, v), d);
  for (const f of Object.values(S.B)) { f.t = P(f.t); f.R = mm(R, f.R); }
  for (const A of [S.armN, S.armF, S.legN, S.legF]) { A.joint = P(A.joint); A.end = P(A.end); }
  S.sN = P(S.sN); S.sF = P(S.sF); S.hipN = P(S.hipN); S.hipF = P(S.hipF);
  S.axis = mv(R, S.axis); S.side = mv(R, S.side);
};
function render(pose) {
  setBody(pose.body);
  pose = sized(pose);
  setTint(pose);
  const S = solve(pose), q = S.q, whole = (q.yaw ?? 0) + (q.face === -1 ? Math.PI : 0);
  // Aschenthron: zur Kamera / weg erst in der Figurenebene nach hinten kippen (um die Bild-x-Achse nach dem Drehen), dann drehen
  const tipFirst = !!q.fall && !!q.yaw;
  if (tipFirst) moveAll(S, rotZ(q.fall), [q.fallX ?? 0, -(q.fallY ?? 0), 0]);
  if (whole) turnAll(S, whole);
  // Aschenthron: zur Kamera / weg von oben schräg gesehen: was näher zur Kamera liegt (z > 0), rückt im Bild nach unten. Eine
  // Scherung statt Drehung, damit die Figur gleich hoch bleibt: so sieht man Schritt, Knie und Armschwung in der Tiefe
  // (der Kopf wird nur verschoben, nicht geschert: sonst rutscht das Haar übers Gesicht)
  if (q.shear) {
    const keep = [S.B.head.R, S.B.neck.R];
    moveAll(S, [1, 0, 0, 0, 1, -q.shear, 0, 0, 1], [0, 0, 0]);
    [S.B.head.R, S.B.neck.R] = keep;
  }
  // Umfallen: um die Füße in der Bildebene kippen (fall > 0 = nach hinten), dann verschieben (fallX, fallY in Bildpixeln)
  if (q.fall && !tipFirst) moveAll(S, rotZ(q.fall), [q.fallX ?? 0, -(q.fallY ?? 0), 0]);
  if (q.y) moveAll(S, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, -q.y, 0]);
  const air = (q.y ?? 0) < -0.5 || !!q.fall;
  clipBody = !air;
  clipWeapon = !air;
  clipShear = q.shear ?? 0;
  drawBody(S);
  clipBody = false;
  if (S.W) S.W.draw(along(S.armN.end, S.axis, S.side, PART.weapon), q, S.armF.end);
  if (S.OW) {
    const sb = q.sb ?? Math.PI;
    let ax = [Math.cos(sb), -Math.sin(sb), 0], sd = [-Math.sin(sb), -Math.cos(sb), 0];
    if (whole) { const R = rotY(-whole); ax = mv(R, ax); sd = mv(R, sd); }
    S.OW.draw(along(S.armF.end, ax, sd, PART.offWeapon), q, S.armF.end);
  }
  clipWeapon = false;
  clipShear = 0;
  const out = finish(S);
  return q.fall ? onGround(out) : out;
}
// Aschenthron: eine liegende Figur so anheben, dass nichts unter dem Boden (Fußlinie) liegt
function onGround(out) {
  const over = out.y1 - 1;
  if (over > 0) {
    for (let k = 0; k < out.n; k++) out.ys[k] -= over;
    out.y0 -= over;
    out.y1 -= over;
  }
  return out;
}

/** How far short of where the pose wants them the hands fall, in px: arms don't stretch. */
export function shortfall(pose) {
  setBody(pose.body);
  pose = sized(pose);
  const S = solve(pose), q = S.q, near = len(sub(S.armN.end, [q.fx, -q.fy, S.armN.end[2]])), far = q.two ? 0 : len(sub(S.armF.end, [q.bx, -q.by, S.armF.end[2]]));
  return Math.max(near, far);
}
/** The pixels of a pose: { n, xs, ys, color, shade, part, x0, y0, x1, y1 }, in local space with the feet at (0, 0). */
// Ohne Cache (das Original rundet Posenwerte auf ganze Pixel für seinen Cache): das Spiel cacht ganze Sheets je Look.
export function posed(pose) {
  return render(pose);
}

/**
 * The skeleton of a pose, in the same local space as posed(): x right, y down, feet at (0, 0), z toward the viewer, whole
 * figure turned by its yaw. { joints: { name: [x, y, z] }, bones: [[from, to], ...], handles: [name, ...] }: the handles
 * are what a pose moves (hands and feet); everything else is solved from them.
 */
export function skeleton(pose) {
  setBody(pose.body);
  pose = sized(pose);
  const S = solve(pose), q = S.q, whole = (q.yaw ?? 0) + (q.face === -1 ? Math.PI : 0);
  if (whole) turnAll(S, whole);
  const { B, armN, armF, legN, legF, sN, sF, hipN, hipF } = S, at = (f, v) => add(f.t, mv(f.R, v));
  const J = {
    pelvis: B.pelvis.t, waist: B.waist.t, chest: B.chest.t, neck: B.neck.t, head: B.head.t, crown: at(B.head, [0, 3.3, 0]),
    shoulderN: sN, elbowN: armN.joint, handN: armN.end, shoulderF: sF, elbowF: armF.joint, handF: armF.end,
    hipN, kneeN: legN.joint, ankleN: legN.end, toeN: at(B.footN, [4.6, -1.1, 0]), hipF, kneeF: legF.joint, ankleF: legF.end, toeF: at(B.footF, [4.6, -1.1, 0]),
  };
  const joints = Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [v[0], -v[1], v[2]]]));
  const bones = [["pelvis", "waist"], ["waist", "chest"], ["chest", "neck"], ["neck", "head"], ["head", "crown"], ["chest", "shoulderN"], ["shoulderN", "elbowN"], ["elbowN", "handN"], ["chest", "shoulderF"], ["shoulderF", "elbowF"], ["elbowF", "handF"], ["pelvis", "hipN"], ["hipN", "kneeN"], ["kneeN", "ankleN"], ["ankleN", "toeN"], ["pelvis", "hipF"], ["hipF", "kneeF"], ["kneeF", "ankleF"], ["ankleF", "toeF"]];
  return { joints, bones, handles: ["handN", "handF", "ankleN", "ankleF"] };
}

/**
 * Aschenthron: Werkzeug für eigene Skelette (Tiere in `monsterRig.js`): dieselben Formen, derselbe Tiefenpuffer, dieselben
 * Töne, Nähte, Lichtsäume und Umrisse wie beim Helden. `shape(draw)` zeichnet (draw gibt die Augenpunkte zurück) und liefert
 * die Pixel wie `posed()`.
 */
export const KIT = { add, sub, mul, dot, cross, len, unit, rotY, rotZ, mm, mv, ik, axes, lerp3, sphere, sweep, ellipsoid };
export function shape(draw, pin = true) {
  setBody(null);
  clipBody = false;
  clipWeapon = false;
  const eyePts = draw();
  // pin = false: nicht auf die Fußlinie heben (schräge Draufsicht: der nähere Fuß liegt zu Recht etwas tiefer)
  const out = finish({ q: { eyes: false, mark: false }, eyePts });
  return pin ? onGround(out) : out;
}
