// ANIMATIONS FOR ANYTHING in GunnerVerse Studio: monsters, Characters, imported models, even a plain Block.
// Every thing can have obj.mo = {g: walk style (GAITS), i: standing-still move (IDLES), w: when (WHEN), sp: speed 0.3..3,
// l: what moves (LIMBS: legs and arms / legs only / just the body; for models whose "arms" are really hair or strands)}.
// When it plays, the thing's legs and arms are found by themselves (findLimbs):
//   - Monster Maker monsters already have jointed legs / arms / tentacles / wings / tail (monster.js rig)
//   - imported models with a skeleton: bones named like thigh / upper leg / leg and upper arm / arm (Mixamo, Blender...)
//   - anything else made of pieces (the Character, imported models without bones): pieces low down and thin are legs,
//     pieces sticking out of the sides higher up are arms; each gets a joint at its top (hip / shoulder)
// and the whole thing also bobs, leans, sways and hops, so even a Block can waddle around.
// play.js decides how much it's walking (0..1) from how fast it really moves; the editor shows the standing-still move.
import * as THREE from "../vendor/three.module.js";

export const GAITS = { // f = steps (radians / s), leg / arm = swing, bob / hop / crouch / lean / roll / yaw = whole body
  walk: { label: "Walk", icon: "🚶", f: 7, leg: 0.6, arm: 0.55, bob: 0.09, roll: 0.04 },
  run: { label: "Run", icon: "🏃", f: 11, leg: 0.95, arm: 0.95, bob: 0.16, lean: 0.18, roll: 0.03 },
  stomp: { label: "Stomp", icon: "🦖", f: 4.5, leg: 0.5, arm: 0.3, bob: 0.15, roll: 0.12, heavy: 1 },
  sneak: { label: "Sneak", icon: "🥷", f: 4, leg: 0.35, arm: 0.2, bob: 0.03, lean: 0.22, crouch: 0.1 },
  hop: { label: "Hop", icon: "🐰", f: 6, leg: 0, arm: 0, hop: 0.45, tuck: 0.4 },
  waddle: { label: "Waddle", icon: "🐧", f: 8, leg: 0.25, arm: 0.1, armOut: 0.5, bob: 0.04, roll: 0.2 },
  zombie: { label: "Zombie", icon: "🧟", f: 3.5, leg: 0.4, arm: 0.08, armPose: 1.45, bob: 0.05, roll: 0.1, lean: 0.08 },
  robot: { label: "Robot", icon: "🤖", f: 5, leg: 0.5, arm: 0.5, bob: 0.03, square: 1 },
  skip: { label: "Skip", icon: "💃", f: 7, leg: 0.7, arm: 0.7, hop: 0.22 },
  strut: { label: "Strut", icon: "😎", f: 6, leg: 0.55, arm: 0.35, bob: 0.06, yaw: 0.18 },
  crawl: { label: "Crawl / slither", icon: "🐍", f: 9, leg: 0.3, arm: 0.6, crouch: 0.22, yaw: 0.25 },
  stalk: { label: "Stalk (creepy)", icon: "🕷️", f: 3, leg: 0.42, arm: 0.04, bob: 0.03, lean: 0.12, roll: 0.07, yaw: 0.05 },
  fly: { label: "Fly", icon: "🦅", f: 7, leg: 0, legPose: 0.35, arm: 0, flap: 1, hover: 0.3, lean: 0.15 },
};
export const IDLES = {
  breathe: { label: "Breathe", icon: "😮‍💨" }, look: { label: "Look around", icon: "👀" }, dance: { label: "Dance", icon: "🕺" },
  wave: { label: "Wave", icon: "👋" }, jump: { label: "Jump", icon: "⏫" }, fly: { label: "Hover / flap", icon: "🪽" },
  spin: { label: "Spin", icon: "🌀" }, bob: { label: "Bob", icon: "🎈" }, wobble: { label: "Wobble", icon: "🍮" },
  sway: { label: "Sway", icon: "🌴" }, none: { label: "Stand still", icon: "🧍" },
};
export const LIMBS = { all: "Legs and arms", legs: "Legs only (arms hang still)", none: "Just the body (nothing swings)" };
export const WHEN = { move: "Walk when it moves", always: "Always walk", idle: "Never walk (just the standing move)" };

// Clean a saved {g, i, w, sp}.
export function sanitizeMotion(m) {
  if (!m || typeof m !== "object") return null;
  const out = { g: GAITS[m.g] ? m.g : "walk", i: IDLES[m.i] ? m.i : "breathe", w: WHEN[m.w] ? m.w : "move", sp: Math.max(0.3, Math.min(3, Math.round((+m.sp || 1) * 10) / 10)) };
  if (LIMBS[m.l] && m.l !== "all") out.l = m.l;
  return out;
}
// What a thing plays: its own settings, or (monsters made before these settings) its old Animation choice.
export function motionOf(o) {
  if (o.mo) return o.mo;
  if (o.type !== "monster") return null;
  const a = o.anim || "auto";
  if (a === "none") return { g: "walk", i: "none", w: "idle", sp: 1 };
  if (a === "dance" || a === "idle") return { g: "walk", i: a === "dance" ? "dance" : "breathe", w: "idle", sp: 1 };
  if (a === "fly") return { g: "fly", i: "fly", w: "move", sp: 1 };
  return { g: "walk", i: (o.mon && (o.mon.float || o.mon.ghost)) ? "fly" : "breathe", w: a === "walk" ? "always" : "move", sp: 1 };
}
// A script's me.play("dance" / "walk" / "idle" / "fly" / "stop" / any walk style) on top of the settings.
export function withPlay(mo, name) {
  if (!name) return mo;
  const m = { ...(mo || { g: "walk", i: "breathe", w: "move", sp: 1 }) };
  if (name === "stop" || name === "none") { m.i = "none"; m.w = "idle"; }
  else if (name === "walk") m.w = "always";
  else if (GAITS[name]) { m.g = name; m.w = "always"; }
  else if (IDLES[name]) { m.i = name; m.w = "idle"; }
  return m;
}

// ---------------------------------------------------------------- the pose for one moment
const wave = (x, square) => { const s = Math.sin(x); return square ? Math.sign(s) * Math.pow(Math.abs(s), 0.25) : s; };
// t = seconds, walk = 0..1. Returns the whole-body move (in "body heights") and functions for each leg / arm.
function pose(t, walk, mo) {
  const G = GAITS[mo.g] || GAITS.walk, idle = mo.i || "breathe", w = mo.w === "always" ? 1 : mo.w === "idle" ? 0 : Math.min(1, walk), st = 1 - w;
  const sp = mo.sp || 1, ph = t * G.f * sp, T = t * sp;
  const b = { y: 0, rx: 0, ry: 0, rz: 0, sq: 0, flap: 0, w };
  // walking
  b.y += Math.abs(wave(ph, G.square)) * (G.bob || 0) * w * (G.heavy ? 1.4 : 1);
  if (G.hop) b.y += Math.max(0, Math.sin(ph * (G.leg ? 1 : 0.5))) * G.hop * w;
  if (G.hover) b.y += (G.hover + Math.sin(T * 3) * 0.06) * w;
  b.y -= (G.crouch || 0) * w;
  b.rx += (G.lean || 0) * w;
  b.rz += Math.sin(ph) * (G.roll || 0) * w;
  b.ry += Math.sin(ph) * (G.yaw || 0) * w;
  if (G.flap) b.flap = Math.max(b.flap, w);
  // standing still
  if (st > 0) {
    if (idle === "breathe") { b.y += Math.sin(T * 2) * 0.012 * st; b.sq += Math.sin(T * 2) * 0.02 * st; }
    else if (idle === "look") b.ry += Math.sin(T * 0.9) * 0.6 * st;
    else if (idle === "dance") { b.y += Math.abs(Math.sin(T * 6)) * 0.12 * st; b.ry += Math.sin(T * 3) * 0.45 * st; b.rz += Math.sin(T * 6) * 0.08 * st; }
    else if (idle === "jump") b.y += Math.max(0, Math.sin(T * 5)) * 0.4 * st;
    else if (idle === "fly") { b.y += (0.3 + Math.sin(T * 3) * 0.08) * st; b.flap = Math.max(b.flap, st); }
    else if (idle === "spin") b.ry += (T * 3) % (Math.PI * 2) * (st > 0.5 ? 1 : 0);
    else if (idle === "bob") b.y += (Math.sin(T * 2.5) * 0.5 + 0.5) * 0.18 * st;
    else if (idle === "wobble") { b.rz += Math.sin(T * 7) * 0.09 * st; b.sq += Math.sin(T * 9) * 0.06 * st; }
    else if (idle === "sway") b.rz += Math.sin(T * 1.6) * 0.12 * st;
  }
  // legs: phase 0 / PI = which foot; side -1 left, +1 right
  b.leg = (phase, side) => {
    if (G.flap && w > 0.5) return { x: G.legPose || 0.35, z: 0 };
    let x = wave(ph + phase, G.square) * (G.leg || 0) * w;
    if (G.tuck) x -= Math.max(0, Math.sin(ph * 0.5)) * G.tuck * w;
    if (st > 0 && idle === "dance") x += Math.max(0, Math.sin(T * 6 + phase)) * -0.5 * st;
    if (st > 0 && idle === "fly") x += 0.35 * st;
    return { x, z: 0 };
  };
  b.arm = (phase, side) => {
    let x = -wave(ph + phase, G.square) * (G.arm || 0) * w + (G.armPose || 0) * w, z = side * (G.armOut || 0) * w;
    if (b.flap > 0) z += side * (0.3 + Math.sin(T * 12) * 0.8) * b.flap;
    if (st > 0) {
      if (idle === "breathe") x += Math.sin(T * 1.6 + phase) * 0.05 * st;
      else if (idle === "dance") { x += (2.3 + Math.sin(T * 6 + phase) * 0.4) * st; z += side * Math.sin(T * 6) * 0.3 * st; }
      else if (idle === "wave" && side > 0) z += (2.6 + Math.sin(T * 9) * 0.35) * st;
      else if (idle === "jump") z += side * Math.max(0, Math.sin(T * 5)) * 1.2 * st;
    }
    return { x, z };
  };
  return b;
}

// ---------------------------------------------------------------- Monster Maker rigs (monster.js)
export function animateRig(rig, t, walk, mo) {
  if (!rig || !rig.body) return;
  if (mo.i === "none" && mo.w === "idle") { resetRig(rig); return; }
  const b = pose(t, walk, mo), u = 0.75; // (monster bodies are ~4 units tall: the pose's body heights become units)
  rig.body.position.y = rig.bodyY + b.y * u + (rig.float && !b.flap ? Math.sin(t * 3) * 0.12 : 0);
  rig.body.rotation.set(b.rx * 0.5, b.ry, b.rz);
  if (rig.blob) rig.body.scale.set(1 - b.sq + Math.sin(t * 3) * 0.04, 1 + b.sq - Math.sin(t * 3) * 0.04, 1);
  for (const o of rig.moveWithBody) o.position.y = o.userData.y0 + b.y * u;
  for (const L of rig.legs) {
    const a = b.leg(L.phase, L.side);
    if (L.spidery) { const s = a.x / 0.6; L.j.rotation.set(0, s * 0.35 * L.side, Math.max(0, Math.cos(t * 7 + L.phase)) * 0.3 * b.w * L.side); }
    else L.j.rotation.set(a.x, 0, 0);
  }
  for (const A of rig.arms) { const a = b.arm(A.phase, A.side); A.j.rotation.set(a.x > 0.8 ? a.x - 0.9 : a.x, 0, A.side * 0.05 * Math.sin(t * 2) + a.z); } // (monster arms already reach forward)
  for (const T of rig.tents) T.j.rotation.set(Math.sin(t * 2.5 + T.i) * 0.18, 0, Math.cos(t * 2.2 + T.i * 1.3) * 0.18 + b.w * Math.sin(t * 7 + T.i) * 0.15);
  for (const W of rig.wings) W.j.rotation.z = W.side * (-0.15 + (b.flap ? Math.sin(t * 12) * 0.6 * b.flap : Math.sin(t * 1.5) * 0.06 + b.w * Math.sin(t * 7) * 0.15));
  if (rig.tail) rig.tail.rotation.y = Math.sin(t * 2 + 1) * (0.18 + b.w * 0.15);
}
function resetRig(rig) {
  rig.body.position.y = rig.bodyY; rig.body.rotation.set(0, 0, 0); rig.body.scale.set(1, 1, 1);
  for (const o of rig.moveWithBody) o.position.y = o.userData.y0;
  for (const L of rig.legs) L.j.rotation.set(0, 0, 0);
  for (const A of rig.arms) A.j.rotation.set(0, 0, 0);
}

// ---------------------------------------------------------------- finding legs + arms on anything else
const _b = new THREE.Box3(), _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);
// A limb: {j: the joint, ax / az: the thing's right / forward axis in the joint's parent space, rest: its resting turn, side, kind, phase}
function limb(j, root, kind, side, phase) {
  j.parent.updateWorldMatrix(true, false); root.updateWorldMatrix(true, false);
  root.getWorldQuaternion(_q1); j.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q1);
  return { j, kind, side, phase, rest: j.quaternion.clone(), ax: AX.clone().applyQuaternion(_q2).normalize(), az: AZ.clone().applyQuaternion(_q2).normalize() };
}
function boneLimbs(root, bones) {
  const nm = (b) => b.name.toLowerCase().replace(/mixamorig[:_]?|bip0?1[ _]?|armature[:_|]?/g, "");
  const pickSide = (list) => {
    root.updateWorldMatrix(true, true);
    const inv = _m.copy(root.matrixWorld).invert();
    return list.map((b) => ({ b, x: b.getWorldPosition(_v).applyMatrix4(inv).x })).sort((p, q) => p.x - q.x);
  };
  const top = (list) => list.filter((b) => !list.includes(b.parent)); // (the upper bone of each chain)
  let legs = bones.filter((b) => /thigh|up_?per_?leg|upleg|hip(?!s)/.test(nm(b)));
  if (!legs.length) legs = top(bones.filter((b) => /leg/.test(nm(b)) && !/lower|low|shin|calf|knee|foot|toe/.test(nm(b))));
  let arms = bones.filter((b) => /up_?per_?arm|uparm|^(left|right|l|r)?[_. ]?arm$|arm[_. ]?(l|r|left|right)$/.test(nm(b)));
  if (!arms.length) arms = top(bones.filter((b) => /arm/.test(nm(b)) && !/fore|lower|hand|finger|twist/.test(nm(b))));
  const out = [];
  pickSide(legs.slice(0, 8)).forEach((p, i, a) => out.push(limb(p.b, root, "leg", p.x < 0 ? -1 : 1, (p.x < 0 ? 0 : Math.PI) + (a.length > 2 ? (i >> 1) * Math.PI : 0))));
  pickSide(arms.slice(0, 6)).forEach((p) => out.push(limb(p.b, root, "arm", p.x < 0 ? -1 : 1, p.x < 0 ? 0 : Math.PI)));
  // knees bend a little when the leg swings back
  // (and the foot below the knee turns back so it stays flat on the ground)
  for (const L of out) if (L.kind === "leg") { const k = L.j.children.find((c) => c.isBone); if (k) { L.knee = limb(k, root, "knee", L.side, 0); const f = k.children.find((c) => c.isBone && !/toe/i.test(c.name)); if (f) L.foot = limb(f, root, "foot", L.side, 0); } }
  return out;
}
function pieceLimbs(root) {
  root.updateWorldMatrix(true, true);
  const inv = _m.copy(root.matrixWorld).invert(), parts = [];
  root.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh && m.geometry) { _b.setFromObject(m).applyMatrix4(inv); if (!_b.isEmpty()) parts.push({ m, b: _b.clone() }); } });
  if (parts.length < 3) return [];
  const B = new THREE.Box3(); parts.forEach((p) => B.union(p.b));
  const S = B.getSize(new THREE.Vector3()), C = B.getCenter(new THREE.Vector3());
  const legs = [], arms = [];
  for (const p of parts) {
    const s = p.b.getSize(_v.clone()), c = p.b.getCenter(new THREE.Vector3());
    if (p.b.max.y <= B.min.y + 0.6 * S.y && p.b.min.y <= B.min.y + 0.12 * S.y && s.x <= 0.55 * S.x && s.y >= 0.15 * S.y && Math.abs(c.x - C.x) > 0.04 * S.x) legs.push({ ...p, c });
    else if (c.y > B.min.y + 0.35 * S.y && c.y < B.min.y + 0.9 * S.y && Math.abs(c.x - C.x) >= 0.28 * S.x && s.x <= 0.35 * S.x && s.y >= 0.18 * S.y && p.b.min.y > B.min.y + 0.15 * S.y) arms.push({ ...p, c });
  }
  // group the pieces: left / right (and front / back when the legs spread out, like a dog or a table)
  const groups = (list, splitZ) => {
    const g = new Map();
    for (const p of list) { const k = (p.c.x < C.x ? "L" : "R") + (splitZ ? (p.c.z < C.z ? "F" : "B") : ""); if (!g.has(k)) g.set(k, []); g.get(k).push(p); }
    return [...g.entries()];
  };
  const zs = legs.map((p) => p.c.z), splitZ = legs.length >= 4 && Math.max(...zs) - Math.min(...zs) > 0.35 * S.z;
  const out = [];
  const make = (key, list, kind) => {
    const box = new THREE.Box3(); list.forEach((p) => box.union(p.b));
    const parent = list[0].m.parent, at = box.getCenter(new THREE.Vector3()); at.y = box.max.y - (kind === "arm" ? box.getSize(_v).y * 0.08 : 0);
    const j = new THREE.Group(); j.name = "joint:" + kind;
    parent.add(j); j.position.copy(parent.worldToLocal(root.localToWorld(at.clone())));
    j.updateWorldMatrix(true, false);
    for (const p of list) j.attach(p.m);
    const side = key[0] === "L" ? -1 : 1;
    out.push(limb(j, root, kind, side, kind === "leg" ? (side < 0 ? 0 : Math.PI) + (key[1] === "B" ? Math.PI : 0) : side < 0 ? Math.PI : 0));
  };
  for (const [k, list] of groups(legs, splitZ)) make(k, list, "leg");
  for (const [k, list] of groups(arms, false)) make(k, list, "arm");
  return out;
}
// AUTO-RIG: an imported character that's one solid mesh (no skeleton, no separate leg / arm pieces) gets bones made
// for it: the shape is measured, the bottom half split into a left and right leg (with knees), and whatever sticks
// out of the sides of the body above the hips becomes arms. Each point of the mesh follows the bone it's in, blended
// softly at the hips and shoulders, so the legs and arms really bend. Only for upright, person-or-animal shapes.
const _w = new THREE.Vector3(), _mm = new THREE.Matrix4();
function autoRig(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), meshes = [];
  let count = 0;
  root.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh && m.geometry && m.geometry.attributes.position) { meshes.push(m); count += m.geometry.attributes.position.count; } });
  if (!meshes.length || count > 250000) return false;
  // where every point is (in the model's own space)
  const pts = meshes.map((m) => { _mm.multiplyMatrices(inv, m.matrixWorld); const a = m.geometry.attributes.position, out = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { _w.fromBufferAttribute(a, i).applyMatrix4(_mm); out[i * 3] = _w.x; out[i * 3 + 1] = _w.y; out[i * 3 + 2] = _w.z; } return out; });
  const B = new THREE.Box3(); for (const p of pts) for (let i = 0; i < p.length; i += 3) B.expandByPoint(_w.set(p[i], p[i + 1], p[i + 2]));
  const S = B.getSize(new THREE.Vector3()), C = B.getCenter(new THREE.Vector3());
  if (S.y < 0.6 * Math.max(S.x, S.z) && S.y < 0.4 * (S.x + S.z)) return false; // (flat or long things aren't people)
  const y0 = B.min.y, hipY = y0 + 0.47 * S.y, kneeY = y0 + 0.25 * S.y, shY = y0 + 0.8 * S.y;
  // where each leg is, and how wide the legs are
  let legX = [0, 0], legN = [0, 0], legOut = 0, maxX = 0;
  for (const p of pts) for (let i = 0; i < p.length; i += 3) {
    const x = p[i] - C.x, y = p[i + 1];
    maxX = Math.max(maxX, Math.abs(x));
    if (y < kneeY) { const s = x < 0 ? 0 : 1; legX[s] += x; legN[s]++; }
    if (y > y0 + 0.18 * S.y && y < y0 + 0.32 * S.y) legOut = Math.max(legOut, Math.abs(x));
  }
  if (!legN[0] || !legN[1] || maxX < 1e-4) return false;
  // where the arms start, on each side: across the chest, the body's surface is solid out to its edge, then there's a
  // gap, then the arm. (No gap, like arms pressed to the body: a bit past the legs.)
  const BINS = 48, cover = [new Uint8Array(BINS), new Uint8Array(BINS)], cy0 = hipY + 0.08 * S.y, cy1 = shY - 0.04 * S.y;
  meshes.forEach((m, mi) => {
    const p = pts[mi], idx = m.geometry.index, tri = idx ? idx.count / 3 : p.length / 9;
    for (let f = 0; f < tri; f++) {
      let lo = Infinity, hi = -Infinity, ylo = Infinity, yhi = -Infinity;
      for (let v = 0; v < 3; v++) { const k = idx ? idx.getX(f * 3 + v) : f * 3 + v, x = p[k * 3] - C.x, y = p[k * 3 + 1]; lo = Math.min(lo, x); hi = Math.max(hi, x); ylo = Math.min(ylo, y); yhi = Math.max(yhi, y); }
      if (yhi < cy0 || ylo > cy1) continue;
      for (const s of [0, 1]) {
        const a = s ? Math.max(0, lo) : Math.max(0, -hi), b = s ? hi : -lo;
        if (b < 0 || b < a) continue;
        for (let i = Math.floor((a / maxX) * (BINS - 1)); i <= Math.min(BINS - 1, Math.ceil((b / maxX) * (BINS - 1))); i++) cover[s][i] = 1;
      }
    }
  });
  const armAt = [0, 1].map((s) => {
    const c = cover[s]; let i = 0;
    while (i < BINS && c[i]) i++;           // (the body)
    let j = i; while (j < BINS && !c[j]) j++; // (the gap)
    return i > 1 && j < BINS && j > i ? ((i + j) / 2 / (BINS - 1)) * maxX : Math.max(legOut * 1.15, 0.3 * maxX);
  });
  const lx = [legX[0] / legN[0], legX[1] / legN[1]], blend = 0.05 * S.y;
  // the bones: body > hips > knees, body > shoulders
  const mk = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; parent.add(b); b.position.set(x, y, z); return b; };
  const body = new THREE.Bone(); body.name = "auto_body"; root.add(body); body.position.set(C.x, hipY, C.z);
  const thighs = [0, 1].map((s) => mk("thigh_" + "LR"[s], body, lx[s], 0, 0));
  const shins = [0, 1].map((s) => mk("shin_" + "LR"[s], thighs[s], 0, kneeY - hipY, 0));
  const arms = [0, 1].map((s) => mk("upperarm_" + "LR"[s], body, (s ? 1 : -1) * armAt[s], shY - hipY - 0.03 * S.y, 0));
  const bones = [body, ...thighs, ...shins, ...arms]; // (indexes: 0 body, 1-2 thighs, 3-4 shins, 5-6 arms)
  root.updateWorldMatrix(true, true);
  const skeleton = new THREE.Skeleton(bones);
  const sm = (t) => t * t * (3 - 2 * t), ramp = (v, a, b) => sm(Math.min(1, Math.max(0, (v - a) / (b - a))));
  meshes.forEach((m, mi) => {
    const p = pts[mi], n = p.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = p[i * 3] - C.x, y = p[i * 3 + 1], side = x < 0 ? 0 : 1;
      const arm = ramp(Math.abs(x), armAt[side] - 0.01 * S.x, armAt[side] + 0.03 * S.x) *ramp(y, hipY - 0.12 * S.y, hipY) * (1 - ramp(y, shY + 0.06 * S.y, shY + 0.1 * S.y));
      const leg = (1 - ramp(y, hipY - blend, hipY + blend)) * (1 - arm);
      const shin = 1 - ramp(y, kneeY - blend, kneeY + blend);
      // up to 3 bones per point: the body, the arm, the thigh or shin
      si[i * 4] = 0; sw[i * 4] = Math.max(0, 1 - arm - leg);
      si[i * 4 + 1] = 5 + side; sw[i * 4 + 1] = arm;
      si[i * 4 + 2] = shin > 0.5 ? 3 + side : 1 + side; sw[i * 4 + 2] = leg;
      si[i * 4 + 3] = 0; sw[i * 4 + 3] = 0;
    }
    const g = m.geometry.clone();
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    const s = new THREE.SkinnedMesh(g, m.material);
    s.name = m.name; s.position.copy(m.position); s.quaternion.copy(m.quaternion); s.scale.copy(m.scale);
    s.castShadow = m.castShadow; s.receiveShadow = m.receiveShadow; s.frustumCulled = false;
    m.parent.add(s); m.parent.remove(m);
    s.updateWorldMatrix(true, false);
    s.bind(skeleton, s.matrixWorld.clone());
  });
  return true;
}

// The limbs of a built thing (inner = world.js's scaled group). Imported models are found once they finish loading.
export function findLimbs(inner) {
  const src = inner.userData.copy || (inner.userData.model ? null : inner);
  if (!src) return null;
  if (inner.userData.limbs && inner.userData.limbsFor === src) return inner.userData.limbs;
  const bones = []; src.traverse((o) => { if (o.isBone) bones.push(o); });
  let limbs = bones.length ? boneLimbs(src, bones) : pieceLimbs(src);
  // an imported model with nothing found: give it bones (autoRig), then use those
  if (!bones.length && !limbs.length && inner.userData.copy && autoRig(src)) { const b2 = []; src.traverse((o) => { if (o.isBone) b2.push(o); }); limbs = boneLimbs(src, b2); }
  inner.userData.limbs = limbs; inner.userData.limbsFor = src;
  return limbs;
}
// How many legs + arms it found (for the Animation window).
export function limbCount(inner) {
  if (inner.userData.rig) { const r = inner.userData.rig; return { legs: r.legs.length, arms: r.arms.length, rig: true }; }
  const l = findLimbs(inner) || [];
  return { legs: l.filter((x) => x.kind === "leg").length, arms: l.filter((x) => x.kind === "arm").length, rig: false };
}

// ---------------------------------------------------------------- moving it
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function turn(L, x, z) { L.j.quaternion.copy(_qa.setFromAxisAngle(L.ax, x)).multiply(_qb.setFromAxisAngle(L.az, z)).multiply(L.rest); }
// inner = the built thing (world.js), h = its real height, t = seconds, walk = 0..1, mo = settings (motionOf / withPlay).
export function animateThing(inner, h, t, walk, mo) {
  if (!inner || !mo) return;
  if (inner.userData.rig) { animateRig(inner.userData.rig, t, walk, mo); return; }
  const base = inner.userData.base || (inner.userData.base = { y: inner.position.y, s: inner.scale.clone() });
  const still = mo.i === "none" && mo.w === "idle";
  const b = still ? { y: 0, rx: 0, ry: 0, rz: 0, sq: 0, leg: () => ({ x: 0, z: 0 }), arm: () => ({ x: 0, z: 0 }) } : pose(t, walk, mo);
  inner.position.y = base.y + b.y * h * 0.3;
  inner.rotation.set(b.rx * 0.6, b.ry, b.rz);
  inner.scale.set(base.s.x * (1 - b.sq * 0.5), base.s.y * (1 + b.sq), base.s.z * (1 - b.sq * 0.5));
  const limbs = inner.userData.mixing ? null : findLimbs(inner); // (a playing model animation moves the bones itself)
  if (!limbs) return;
  for (const L of limbs) {
    if (mo.l === "none" || (mo.l === "legs" && L.kind === "arm")) { turn(L, 0, 0); continue; } // (those stay still)
    if (L.kind === "leg") { const a = b.leg(L.phase, L.side), k = Math.max(0, -a.x) * 0.9; turn(L, a.x, 0); if (L.knee) turn(L.knee, -k, 0); if (L.foot) turn(L.foot, (k - a.x) * 0.8, 0); } // (+ = swings forward, so a knee bends with -)
    else if (L.kind === "arm") { const a = b.arm(L.phase, L.side); turn(L, a.x, a.z); }
  }
}
