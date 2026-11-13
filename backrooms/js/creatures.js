// THE BACKROOMS: the monsters and how they look and move.
//   bacteria  Level 0: the Bacteria, a thick, shiny-black, faceless walker with a huge jaw (original design, made of shapes)
//   entity    an older stand-in (a tall, thin, faceless thing with long dangly strands; original design, made of shapes)
//   crawler   the Poolrooms: a long, pale, bony thing with spider legs and spikes out of the water (original design)
//   partygoer Level Fun: the Partygoer model (models/partygoer.glb, "Partygoer from Backrooms (Updated)" by FilinMinv, CC-BY-4.0),
//             made creepier here: taller and thinner, grimy, head tilted, twitching, long arms reaching for you
//   clark     the final level: Captain Clark (models/captain-clark.glb, Gamer Gunner's model). 3.7 m tall, hunched, darker;
//             he reaches for you while he chases. pose() holds him still for his cutscene.
// make(kind) -> {g: Object3D (feet at 0, facing +z), animate(dt, speed), height}. Models load once (preload) and are
// cloned; if a model can't load, a stand-in made of shapes is used so the game still works.
import * as THREE from "/create/vendor/three.module.js";
import { GLTFLoader } from "/create/vendor/GLTFLoader.js";
import { clone as cloneSkinned } from "/create/vendor/SkeletonUtils.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...(o || {}) });
const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
function box(parent, w, h, d, m, x, y, z) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; }
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// ---------------------------------------------------------------- the Entity (Level 0)
function entity() {
  const g = new THREE.Group(), skin = M(0x0c0b0a), eye = glowM(0xf4f4ff);
  const body = pivot(g, 0, 1.55, 0);
  box(body, 0.42, 1.0, 0.28, skin, 0, 0.5, 0).rotation.x = 0.25; // hunched chest
  const head = pivot(body, 0, 1.1, 0.25);
  box(head, 0.32, 0.45, 0.32, skin, 0, 0.1, 0);
  for (const s of [-1, 1]) box(head, 0.05, 0.03, 0.02, eye, s * 0.08, 0.15, 0.17);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, s * 0.13, 0, 0); box(l, 0.12, 1.55, 0.12, skin, 0, -0.78, 0); legs.push(l);
    const a = pivot(body, s * 0.28, 0.95, 0.1); box(a, 0.09, 1.7, 0.09, skin, 0, -0.85, 0); for (let f = 0; f < 3; f++) box(a, 0.02, 0.35, 0.02, skin, (f - 1) * 0.04, -1.85, 0); a.rotation.z = s * 0.12; arms.push(a);
  }
  const strands = [];
  for (let i = 0; i < 10; i++) { const s = pivot(i < 6 ? head : body, (i % 5 - 2) * 0.07, i < 6 ? -0.1 : 0.9, i < 6 ? 0.05 : 0.1); box(s, 0.03, 0.8 + (i % 3) * 0.3, 0.03, skin, 0, -0.4 - (i % 3) * 0.15, 0); strands.push(s); }
  let t = 0;
  return { g, height: 3, animate(dt, sp) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (2 + sp * 1.4);
    const w = Math.min(1, sp / 2.5);
    legs[0].rotation.x = Math.sin(t) * 0.5 * w; legs[1].rotation.x = -Math.sin(t) * 0.5 * w;
    arms[0].rotation.x = -Math.sin(t) * 0.35 * w + Math.sin(t * 0.37) * 0.08; arms[1].rotation.x = Math.sin(t) * 0.35 * w + Math.cos(t * 0.41) * 0.08;
    head.rotation.z = Math.sin(t * 0.7) * 0.25; head.rotation.y = Math.sin(t * 0.23) * 0.4;
    strands.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.3 + i) * 0.25; s.rotation.z = Math.cos(t * 1.1 + i * 2) * 0.2; });
    body.position.y = 1.55 + Math.abs(Math.sin(t)) * 0.05 * w;
  } };
}

// ---------------------------------------------------------------- the Crawler (Poolrooms): long, pale and bony
// A long body under the water with a row of bone spikes sticking up out of it (you see them cut through the water
// before you see IT), long spider legs that arch up over the surface, a big head with four small white eyes and a
// jaw full of teeth. When it chases you its head comes up, the jaw opens and the spikes shake.
function crawler() {
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0);
  const skin = new THREE.MeshStandardMaterial({ color: 0xaab09e, roughness: 0.5 }), dark = M(0x3f443b), bone = M(0xe4ddc6), gum = M(0x4a0808), eyeM = glowM(0xf2f6ff);
  body.scale.setScalar(1.2);
  const segs = [], legs = [], spikes = [];
  for (let i = 0; i < 9; i++) {
    const s = pivot(body, 0, 0.34, -0.25 - i * 0.5), r = 0.42 - i * 0.028;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), i % 2 ? skin : dark); m.scale.set(1.15, 0.6, 1.05); m.castShadow = true; s.add(m);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35 + (i < 6 ? 0.18 : 0) - i * 0.015, 5), bone); sp.position.set(0, r * 0.5 + 0.12, 0); sp.rotation.x = -0.35; s.add(sp); spikes.push(sp);
    segs.push(s);
    if (i > 0 && i < 7) for (const side of [-1, 1]) { // spider legs: up and out, then down to the bottom of the pool
      const hip = pivot(s, side * r * 0.9, 0, 0); hip.rotation.z = side * 2.3;
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.62, 3, 6), skin); up.position.y = -0.35; hip.add(up);
      const knee = pivot(hip, 0, -0.7, 0); knee.rotation.z = side * -1.88;
      const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.82, 3, 6), dark); lo.position.y = -0.45; knee.add(lo);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), bone); claw.rotation.x = Math.PI; claw.position.y = -0.95; knee.add(claw);
      legs.push({ hip, i, side });
    }
  }
  // the head: wide and flat, four white eyes, teeth on top and on the jaw
  const head = pivot(body, 0, 0.36, 0.2);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), skin); skull.scale.set(1.1, 0.55, 1.25); skull.position.set(0, 0.06, 0.15); skull.castShadow = true; head.add(skull);
  for (const [x, y] of [[-0.17, 0.2], [0.17, 0.2], [-0.09, 0.25], [0.09, 0.25]]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); e.position.set(x, y, 0.55); head.add(e); }
  box(head, 0.5, 0.08, 0.3, gum, 0, -0.06, 0.4);
  for (let k = 0; k < 9; k++) { const tt = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 5), bone); tt.rotation.x = Math.PI; const a = (k - 4) * 0.3; tt.position.set(Math.sin(a) * 0.36, -0.04, 0.28 + Math.cos(a) * 0.3); head.add(tt); }
  const jaw = pivot(head, 0, -0.06, 0.05);
  const jm = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dark); jm.scale.set(1.05, 0.4, 1.2); jm.position.set(0, 0, 0.12); jaw.add(jm);
  for (let k = 0; k < 9; k++) { const tt = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 5), bone); const a = (k - 4) * 0.3; tt.position.set(Math.sin(a) * 0.33, 0.03, 0.12 + Math.cos(a) * 0.3); jaw.add(tt); }
  let t = 0, open = 0, lift = 0;
  return { g, height: 1.0,
  face(v) { return head.localToWorld(v.set(0, 0.1, 0.5)); }, // (for its jump scare)
  animate(dt, sp, chasing) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (3 + sp * 1.6);
    const w = Math.min(1, sp / 3 + 0.2);
    segs.forEach((s, i) => { s.position.x = Math.sin(t - i * 0.75) * 0.2 * w; s.rotation.y = Math.cos(t - i * 0.75) * 0.25 * w; });
    for (const L of legs) { const ph = t * 1.4 + L.i * 1.1 + (L.side > 0 ? Math.PI : 0); L.hip.rotation.y = Math.sin(ph) * 0.55 * L.side; L.hip.rotation.x = Math.max(0, Math.cos(ph)) * 0.35; }
    open += ((chasing ? 0.75 + Math.sin(t * 2.7) * 0.2 : 0.08) - open) * Math.min(1, dt * 6);
    lift += ((chasing ? 1 : 0) - lift) * Math.min(1, dt * 4);
    jaw.rotation.x = open * 0.9;
    head.position.x = segs[0].position.x; head.position.y = 0.36 + lift * 0.3; head.rotation.x = -lift * 0.4 + Math.sin(t * 0.8) * 0.05; head.rotation.y = Math.sin(t * 0.5) * 0.2;
    spikes.forEach((s, i) => { s.rotation.z = chasing ? Math.sin(t * 9 + i * 1.7) * 0.18 : 0; });
  } };
}

// ---------------------------------------------------------------- models made from files (the Partygoer, Captain Clark)
const loader = new GLTFLoader(), loaded = {};
export function preload(kind) {
  const file = { partygoer: "/backrooms/models/partygoer.glb", clark: "/backrooms/models/captain-clark.glb" }[kind]; // (whole-site paths: Backrooms Survival uses them too)
  if (!file) return Promise.resolve(null);
  if (!loaded[kind]) loaded[kind] = new Promise((res) => loader.load(file, (g) => res(g.scene), undefined, () => res(null)));
  return loaded[kind];
}
// Bones are found by name; legs / arms swing around the model's own "sideways" axis, whatever way each bone points.
const BONES = {
  partygoer: { legL: /L_Thigh_\d/, legR: /R_Thigh_\d/, calfL: /L_Calf_\d/, calfR: /R_Calf_\d/, armL: /L_Upperarm_\d/, armR: /R_Upperarm_\d/,
    handL: /L_Hand_\d+$/, handR: /R_Hand_\d+$/, head: /CC_Base_Head_\d+$/ },
  clark: { legL: /mixamorig:?LeftUpLeg$/, legR: /mixamorig:?RightUpLeg$/, calfL: /mixamorig:?LeftLeg$/, calfR: /mixamorig:?RightLeg$/, armL: /mixamorig:?LeftArm$/, armR: /mixamorig:?RightArm$/, handL: /mixamorig:?LeftHand$/, handR: /mixamorig:?RightHand$/,
    footL: /mixamorig:?LeftFoot$/, head: /mixamorig:?Head$/, headTop: /mixamorig:?HeadTop_End$/, spine: /mixamorig:?Spine2$/ },
};
const CLARK_H = 3.7; // (he used to be 2.7 m: now he has to duck under the lights)
function fromModel(kind, scene, height) {
  const raw = cloneSkinned(scene);
  raw.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
  // stand it on the floor at the right height
  raw.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(raw), h = bb.max.y - bb.min.y || 1, s = height / h;
  const holder = new THREE.Group(), g = new THREE.Group();
  raw.scale.multiplyScalar(s); raw.position.set(-(bb.min.x + bb.max.x) / 2 * s, -bb.min.y * s, -(bb.min.z + bb.max.z) / 2 * s);
  holder.add(raw); g.add(holder);
  g.updateMatrixWorld(true);
  const find = (re) => { let b = null; raw.traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  const names = BONES[kind] || {}, bones = {};
  for (const k in names) bones[k] = find(names[k]);
  // each bone's "model sideways" and "model forward" axes, in its parent's space
  const gq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const rig = {};
  for (const [k, b] of Object.entries(bones)) {
    if (!b || !b.parent) continue;
    g.getWorldQuaternion(gq); b.parent.getWorldQuaternion(pq);
    const toParent = gq.clone().invert().multiply(pq).invert();
    rig[k] = { b, rest: b.quaternion.clone(), side: V(1, 0, 0).applyQuaternion(toParent).normalize(), fwd: V(0, 0, 1).applyQuaternion(toParent).normalize(), drop: 0 };
  }
  // arms held straight out (a T-pose) are lowered to the sides: try both ways, keep the one that puts the hand lower
  for (const [a, hnd] of [["armL", "handL"], ["armR", "handR"]]) {
    const R = rig[a], H = bones[hnd];
    if (!R || !H) continue;
    if (R.b.getWorldPosition(V()).y - H.getWorldPosition(V()).y > height * 0.12) continue; // (arms already down: leave them)
    const yAt = (ang) => { R.b.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(R.fwd, ang).multiply(R.rest)); g.updateMatrixWorld(true); return H.getWorldPosition(V()).y; };
    R.drop = yAt(1.2) < yAt(-1.2) ? 1.2 : -1.2;
    R.b.quaternion.copy(R.rest);
  }
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const turn = (R, swing, drop = 0) => { if (!R) return; q1.setFromAxisAngle(R.side, swing); q2.setFromAxisAngle(R.fwd, drop); R.b.quaternion.copy(q1).multiply(q2).multiply(R.rest); };
  // which way is "forward" for a swing: try both, keep the one that moves the hand / foot to the front (+z)
  const forwardSign = (R, end, drop = 0) => {
    if (!R || !end) return 1;
    const zAt = (s) => { turn(R, s * 1.0, drop); g.updateMatrixWorld(true); return end.getWorldPosition(V()).z; };
    const s = zAt(1) > zAt(-1) ? 1 : -1; R.b.quaternion.copy(R.rest); return s;
  };
  const reachL = forwardSign(rig.armL, bones.handL, rig.armL ? rig.armL.drop : 0), reachR = forwardSign(rig.armR, bones.handR, rig.armR ? rig.armR.drop : 0);
  const kickS = forwardSign(rig.legL, bones.footL);
  g.updateMatrixWorld(true);
  // CAPTAIN CLARK is extra scary: darker, a little thinner, hunched over. ("eyes" is an empty marker where his eyes are, for the cutscene camera.)
  let eyes = null, lean = 0;
  if (kind === "clark") {
    lean = 0.13;
    holder.scale.set(0.9, 1, 0.9);
    raw.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.setHex(0x8a7470); } });
    eyes = new THREE.Group(); g.add(eyes);
  }
  // THE PARTYGOERS are creepier too: taller and thinner, a grimy yellow, hunched, head tilted to one side
  let tilt = 0;
  if (kind === "partygoer") {
    lean = 0.1; tilt = 0.38;
    holder.scale.set(0.85, 1, 0.85);
    raw.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.setHex(0xb59e72); } });
    eyes = new THREE.Group(); g.add(eyes); // (where its face is, for its jump scare)
  }
  const creepy = kind === "clark" || kind === "partygoer";
  const tmp = V(), tmp2 = V();
  function placeEyes() {
    if (!eyes || !bones.head) return;
    g.updateMatrixWorld(true);
    bones.head.getWorldPosition(tmp); if (bones.headTop) { bones.headTop.getWorldPosition(tmp2); tmp.lerp(tmp2, 0.42); }
    g.worldToLocal(tmp); eyes.position.set(tmp.x, tmp.y, tmp.z + height * 0.036);
  }
  let t = 0, twitch = 0, tw = 0;
  return { g, height,
  face(v) { return eyes ? eyes.getWorldPosition(v) : null; },
  hand(i, v) { const h = i ? bones.handR : bones.handL; return h ? h.getWorldPosition(v) : null; }, // (where his eyes are: the cutscene camera looks there)
  animate(dt, sp, chasing) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (2 + sp * 1.6);
    const w = Math.min(1, sp / 3), sw = Math.sin(t) * 0.55 * w;
    turn(rig.legL, sw); turn(rig.legR, -sw);
    turn(rig.calfL, Math.max(0, -Math.sin(t)) * 0.7 * w * (rig.calfL && rig.calfL.side.x < 0 ? -1 : 1));
    turn(rig.calfR, Math.max(0, Math.sin(t)) * 0.7 * w * (rig.calfR && rig.calfR.side.x < 0 ? -1 : 1));
    const reach = creepy && chasing ? 0.9 : 0; // (Clark and the Partygoers reach for you while they chase you)
    if (rig.armL) turn(rig.armL, -sw * 0.6 * (reach ? 0.3 : 1) + reach * reachL, rig.armL.drop);
    if (rig.armR) turn(rig.armR, sw * 0.6 * (reach ? 0.3 : 1) + reach * reachR, rig.armR.drop);
    holder.position.y = Math.abs(Math.cos(t)) * 0.04 * w;
    if (creepy) { // hunched, and the head twitches now and then
      holder.rotation.x = lean + (chasing ? 0.08 : 0);
      if ((twitch -= dt) < 0) { twitch = (tilt ? 0.3 : 0.6) + Math.random() * 2.2; tw = (Math.random() - 0.5) * (tilt ? 1.0 : 0.7); }
      tw *= Math.exp(-dt * 3);
      turn(rig.head, 0, tilt + tw);
      placeEyes();
    }
  },
  // a held pose for cutscenes: arms 0..1 (reach out and grab), fling 0..1 (throw), kick -1..1 (peg leg back / forward), lean 0..1 (lunge to bite)
  pose(o) {
    turn(rig.legR, 0); turn(rig.calfL, 0); turn(rig.calfR, 0); turn(rig.head, 0);
    turn(rig.legL, (o.kick || 0) * kickS);
    const r = Math.min(1, o.arms || 0) * 1.0 + (o.fling || 0) * 0.9;
    if (rig.armL) turn(rig.armL, r * reachL, rig.armL.drop);
    if (rig.armR) turn(rig.armR, r * reachR + (o.raise || 0) * 0.9 * reachR, rig.armR.drop); // (raise: one hand comes up higher)
    holder.position.y = 0; holder.rotation.x = lean + (o.lean || 0) * 0.4 - Math.max(0, o.kick || 0) * 0.15;
    placeEyes();
  } };
}
// THE BACTERIA (original design, made of shapes): a tall, thick, shiny-black thing. Long arms with long fingers, a long
// faceless head with a jaw that opens all the way, and it really WALKS: hips, knees, feet, shoulders and elbows all move.
// pose() is for its catch cutscene: its hands reach for points in the world (a two-joint arm), and its jaw opens.
function bacteria() {
  const g = new THREE.Group(), root = pivot(g, 0, 0, 0);
  const skin = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.25, metalness: 0.15 });
  const gum = M(0x4a0808), tooth = M(0xe9e3cf);
  const cap = (parent, r, len, x, y, z, m = skin) => { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), m); c.position.set(x, y, z); c.castShadow = true; parent.add(c); return c; };
  const HIP = 1.5, SC = 0.82; // (built 3.7 m tall, then shrunk to 3 m)
  root.scale.setScalar(SC);
  const hips = pivot(root, 0, HIP, 0);
  cap(hips, 0.21, 0.2, 0, 0, 0).rotation.z = Math.PI / 2;
  const chest = pivot(hips, 0, 0.05, 0);
  cap(chest, 0.19, 0.4, 0, 0.36, 0);
  cap(chest, 0.31, 0.32, 0, 0.86, 0.02).scale.set(1.3, 1, 0.85);
  for (const s of [-1, 1]) cap(chest, 0.16, 0.12, s * 0.33, 1.05, 0).rotation.z = s * 1.2; // (bony shoulders)
  const neck = pivot(chest, 0, 1.18, 0.06);
  cap(neck, 0.1, 0.22, 0, 0.14, 0);
  const head = pivot(neck, 0, 0.3, 0.03);
  cap(head, 0.18, 0.24, 0, 0.32, -0.01).scale.set(1, 1, 1.1);
  cap(head, 0.12, 0.08, 0, 0.1, 0.06).scale.set(1.3, 0.6, 1.2); // (the upper lip)
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 5), tooth); t.rotation.x = Math.PI; t.position.set((i - 2.5) * 0.04, 0.02, 0.1 + Math.cos((i - 2.5) * 0.5) * 0.08); head.add(t); }
  box(head, 0.24, 0.12, 0.2, gum, 0, -0.02, 0.06); // (inside of the mouth)
  const jaw = pivot(head, 0, 0.04, -0.06);
  box(jaw, 0.26, 0.07, 0.32, skin, 0, -0.06, 0.14);
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 5), tooth); t.position.set((i - 2.5) * 0.04, -0.01, 0.16 + Math.cos((i - 2.5) * 0.5) * 0.08); jaw.add(t); }
  const legs = [], arms = [], drips = [];
  for (const s of [-1, 1]) {
    const thigh = pivot(hips, s * 0.17, 0, 0); cap(thigh, 0.14, 0.48, 0, -0.38, 0);
    const knee = pivot(thigh, 0, -0.74, 0); cap(knee, 0.11, 0.5, 0, -0.35, 0);
    const foot = pivot(knee, 0, -0.7, 0); box(foot, 0.18, 0.08, 0.42, skin, 0, 0.02, 0.1);
    legs.push({ thigh, knee, foot, s });
    const sh = pivot(chest, s * 0.44, 1.05, 0); cap(sh, 0.11, 0.62, 0, -0.41, 0);
    const el = pivot(sh, 0, -0.82, 0); cap(el, 0.085, 0.6, 0, -0.38, 0);
    const hand = pivot(el, 0, -0.78, 0); box(hand, 0.14, 0.18, 0.07, skin, 0, -0.08, 0);
    for (let f = 0; f < 4; f++) { const fi = pivot(hand, (f - 1.5) * 0.04, -0.16, 0); const c = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.34, 5), skin); c.rotation.x = Math.PI; c.position.y = -0.17; fi.add(c); fi.rotation.z = (f - 1.5) * 0.12; }
    arms.push({ sh, el, hand, s, sign: 0 });
  }
  for (let i = 0; i < 5; i++) { const d = pivot(i < 3 ? head : chest, (i - 1) * 0.1, i < 3 ? 0.05 : 1.15, i < 3 ? -0.05 : -0.12); cap(d, 0.025, 0.35 + (i % 2) * 0.25, 0, -0.3, 0); drips.push(d); } // (goo dripping off it)
  let t = 0, jerk = 0, jx = 0, jy = 0;
  // two-joint arm: point the shoulder and bend the elbow so the hand ends up at a point in the world
  const LA = 0.82, LB = 0.78, mtx = new THREE.Matrix4(), X = V(), Y = V(), Z = V(), tmp = V();
  function reach(a, world) {
    g.updateMatrixWorld(true);
    const loc = chest.worldToLocal(tmp.copy(world)).sub(a.sh.position);
    const d = Math.min(LA + LB - 0.01, Math.max(0.15, loc.length())), dir = loc.normalize();
    const cl = (x) => Math.max(-1, Math.min(1, x));
    const angS = Math.acos(cl((LA * LA + d * d - LB * LB) / (2 * LA * d))), angE = Math.PI - Math.acos(cl((LA * LA + LB * LB - d * d) / (2 * LA * LB)));
    X.crossVectors(dir, V(a.s * 0.4, -1, -0.3)); if (X.lengthSq() < 1e-6) X.set(1, 0, 0); X.normalize();
    const u = dir.clone().applyAxisAngle(X, angS);
    Y.copy(u).negate(); Z.crossVectors(X, Y);
    mtx.makeBasis(X, Y, Z); a.sh.quaternion.setFromRotationMatrix(mtx);
    if (!a.sign) { // (which way the elbow bends: try both once, keep the one that gets the hand there)
      const err = (sg) => { a.el.rotation.set(sg * angE, 0, 0); g.updateMatrixWorld(true); return a.hand.getWorldPosition(V()).distanceTo(world); };
      a.sign = err(1) < err(-1) ? 1 : -1;
    }
    a.el.rotation.set(a.sign * angE, 0, 0);
  }
  return { g, height: 3.0,
  face(v) { return head.localToWorld(v.set(0, 0.3, 0.12)); },
  mouth(v) { return head.localToWorld(v.set(0, 0.0, 0.2)); },
  hand(i, v) { return arms[i].hand.localToWorld(v.set(0, -0.14, 0.03)); }, // (0 = its right hand, 1 = its left hand)
  animate(dt, sp, chasing) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (1.6 + sp * 1.25);
    const w = Math.min(1, sp / 2.2), st = Math.sin(t), ct = Math.cos(t);
    for (const l of legs) { // legs step: the knee bends while the leg swings forward, the foot stays flat
      const sw = -st * l.s * 0.55 * w, bend = Math.max(0, ct * l.s) * 0.95 * w + 0.08;
      l.thigh.rotation.set(sw - 0.04, 0, 0); l.knee.rotation.set(bend, 0, 0); l.foot.rotation.set(-(sw + bend) * 0.9, 0, 0);
    }
    hips.position.y = HIP - 0.07 * w + Math.abs(ct) * 0.07 * w;
    hips.rotation.set(0, st * 0.14 * w, st * 0.04 * w);
    jerk -= dt; if (jerk <= 0) { jerk = 0.4 + Math.random() * 1.6; jx = (Math.random() - 0.5) * 0.5; jy = (Math.random() - 0.5) * 0.9; } // (sudden twitches)
    jx *= Math.exp(-dt * 4); jy *= Math.exp(-dt * 4);
    chest.rotation.set(0.12 + (chasing ? 0.28 : 0.08) * Math.max(w, 0.3), -st * 0.22 * w, 0);
    neck.rotation.set(-0.1 + jx * 0.5, jy * 0.3, Math.sin(t * 0.37) * 0.12);
    head.rotation.set(jx, jy, Math.sin(t * 0.5) * 0.15);
    jaw.rotation.x = chasing ? 0.25 + Math.sin(t * 2.3) * 0.15 : 0.04;
    for (const a of arms) { // arms swing the other way from the legs; when it chases, they reach for you
      const swing = st * a.s * 0.6 * w;
      if (chasing) a.sh.rotation.set(-1.15 + Math.sin(t * 1.7 + a.s) * 0.3, 0, a.s * 0.12);
      else a.sh.rotation.set(swing, 0, a.s * 0.1);
      a.el.rotation.set(chasing ? -0.35 : -0.25 - Math.max(0, -swing) * 0.5, 0, 0);
      a.hand.rotation.set(Math.sin(t * 1.3 + a.s) * 0.2, 0, 0);
    }
    drips.forEach((d, i) => { d.rotation.x = Math.sin(t * 1.4 + i) * 0.25; d.rotation.z = Math.cos(t * 1.1 + i * 2) * 0.2; });
  },
  // cutscene pose: o.hands = [world point or null, world point or null] (its right hand, its left hand), o.jaw 0..1, o.lean 0..1
  pose(o) {
    for (const l of legs) { l.thigh.rotation.set(-0.05, 0, 0); l.knee.rotation.set(0.1, 0, 0); l.foot.rotation.set(-0.05, 0, 0); }
    hips.position.y = HIP; hips.rotation.set(0, 0, 0);
    chest.rotation.set(0.15 + (o.lean || 0) * 0.35, 0, 0); neck.rotation.set(0.1 + (o.lean || 0) * 0.3, 0, 0); head.rotation.set(-(o.jaw || 0) * 0.45, 0, 0);
    jaw.rotation.x = (o.jaw || 0) * 1.3;
    arms.forEach((a, i) => { const p = o.hands && o.hands[i]; a.hand.rotation.set(0, 0, 0); if (p) reach(a, p); else { a.sh.rotation.set(-0.3, 0, a.s * 0.15); a.el.rotation.set(-0.4, 0, 0); } });
    g.updateMatrixWorld(true);
  } };
}
// Stand-ins if a model file can't load: a yellow smiling partygoer, a tall captain.
function standIn(kind) {
  if (kind === "partygoer") {
    const g = new THREE.Group(), y = M(0xffd531);
    box(g, 0.7, 1.0, 0.45, y, 0, 1.2, 0); const h = box(g, 0.55, 0.55, 0.5, y, 0, 1.95, 0);
    const smile = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: smileTex(), transparent: true })); smile.position.set(0, 0, 0.26); h.add(smile);
    for (const s of [-1, 1]) box(g, 0.25, 0.75, 0.25, y, s * 0.2, 0.37, 0);
    return { g, height: 2.2, animate() {} };
  }
  const g = entity(); g.g.scale.setScalar(1.15); return g;
}
function smileTex() { const c = document.createElement("canvas"); c.width = 64; c.height = 48; const x = c.getContext("2d"); x.fillStyle = "#111"; x.font = "bold 40px sans-serif"; x.fillText("=)", 8, 38); const t = new THREE.CanvasTexture(c); return t; }

export async function make(kind) {
  if (kind === "entity") return entity();
  if (kind === "crawler") return crawler();
  if (kind === "bacteria") return bacteria();
  const scene = await preload(kind);
  if (!scene) return standIn(kind);
  return fromModel(kind, scene, kind === "clark" ? CLARK_H : 3.15); // (the Partygoers got taller too)
}
