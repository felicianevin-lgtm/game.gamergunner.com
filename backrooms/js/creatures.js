// THE BACKROOMS: the monsters and how they look and move.
//   bacteria  Level 0: the Bacteria model (models/bacteria.glb, "Bacteria Lifeform (Backrooms)" by VHSvince, CC-BY-4.0)
//   entity    stand-in for the Bacteria if its file can't load: a tall, thin, faceless thing with long dangly strands (original design, made of shapes)
//   crawler   the Poolrooms: a pale thing that crawls along the bottom of the pool (original design)
//   partygoer Level Fun: the Partygoer model (models/partygoer.glb, "Partygoer from Backrooms (Updated)" by FilinMinv, CC-BY-4.0)
//   clark     the final level: Captain Clark (models/captain-clark.glb, Gamer Gunner's model). 3.7 m tall, hunched, darker,
//             glowing red eyes and a red glow; he reaches for you while he chases. pose() holds him still for his cutscene.
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

// ---------------------------------------------------------------- the Crawler (Poolrooms): long, pale, low, many legs
function crawler() {
  const g = new THREE.Group(), skin = M(0xd8dcd2), dark = M(0x8a9088), eye = glowM(0xff3030);
  const segs = [];
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.42 - i * 0.03, 12, 8), i % 2 ? skin : dark); s.scale.set(1.2, 0.55, 1); s.position.set(0, 0.35, -i * 0.55); g.add(s); segs.push(s); }
  const head = segs[0];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eye); e.position.set(s * 0.18, 0.35, 0.3); head.add(e); }
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 6), dark); jaw.rotation.x = Math.PI / 2; jaw.position.set(0, -0.05, 0.45); head.add(jaw);
  const legs = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const l = pivot(g, s * 0.4, 0.35, -i * 0.55 - 0.2); const b = box(l, 0.7, 0.07, 0.07, skin, s * 0.35, -0.12, 0); b.rotation.z = s * 0.5; legs.push({ l, s, i }); }
  let t = 0;
  return { g, height: 0.8, animate(dt, sp) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (3 + sp * 2.2);
    segs.forEach((s, i) => { s.position.x = Math.sin(t - i * 0.8) * 0.18 * Math.min(1, sp / 2 + 0.2); });
    for (const L of legs) L.l.rotation.y = Math.sin(t + L.i * 1.1 + (L.s > 0 ? Math.PI : 0)) * 0.6;
  } };
}

// ---------------------------------------------------------------- models made from files (the Partygoer, Captain Clark)
const loader = new GLTFLoader(), loaded = {};
export function preload(kind) {
  const file = { partygoer: "/backrooms/models/partygoer.glb", clark: "/backrooms/models/captain-clark.glb", bacteria: "/backrooms/models/bacteria.glb" }[kind]; // (whole-site paths: Backrooms Survival uses them too)
  if (!file) return Promise.resolve(null);
  if (!loaded[kind]) loaded[kind] = new Promise((res) => loader.load(file, (g) => res(g.scene), undefined, () => res(null)));
  return loaded[kind];
}
// Bones are found by name; legs / arms swing around the model's own "sideways" axis, whatever way each bone points.
const BONES = {
  partygoer: { legL: /L_Thigh_\d/, legR: /R_Thigh_\d/, calfL: /L_Calf_\d/, calfR: /R_Calf_\d/, armL: /L_Upperarm_\d/ },
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
  // CAPTAIN CLARK is extra scary: darker, a little thinner, hunched over, glowing red eyes and a red glow around him
  let eyes = null, lean = 0;
  if (kind === "clark") {
    lean = 0.13;
    holder.scale.set(0.9, 1, 0.9);
    raw.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.setHex(0x8a7470); } });
    eyes = new THREE.Group(); g.add(eyes);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a14 }), haloM = new THREE.MeshBasicMaterial({ color: 0xff1a00, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(height * 0.011, 10, 8), eyeM); e.position.x = s * height * 0.018; e.scale.y = 0.6; eyes.add(e);
      const h = new THREE.Mesh(new THREE.SphereGeometry(height * 0.026, 10, 8), haloM); h.position.x = s * height * 0.018; eyes.add(h);
    }
    const glow = new THREE.PointLight(0xff2010, 2.2, 6.5, 1.4); glow.position.set(0, height * 0.55, height * 0.35); g.add(glow);
  }
  const tmp = V(), tmp2 = V();
  function placeEyes() {
    if (!eyes || !bones.head) return;
    g.updateMatrixWorld(true);
    bones.head.getWorldPosition(tmp); if (bones.headTop) { bones.headTop.getWorldPosition(tmp2); tmp.lerp(tmp2, 0.42); }
    g.worldToLocal(tmp); eyes.position.set(tmp.x, tmp.y, tmp.z + height * 0.036);
  }
  let t = 0, twitch = 0, tw = 0;
  return { g, height,
  face(v) { return eyes ? eyes.getWorldPosition(v) : null; }, // (where his eyes are: the cutscene camera looks there)
  animate(dt, sp, chasing) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (2 + sp * 1.6);
    const w = Math.min(1, sp / 3), sw = Math.sin(t) * 0.55 * w;
    turn(rig.legL, sw); turn(rig.legR, -sw);
    turn(rig.calfL, Math.max(0, -Math.sin(t)) * 0.7 * w * (rig.calfL && rig.calfL.side.x < 0 ? -1 : 1));
    turn(rig.calfR, Math.max(0, Math.sin(t)) * 0.7 * w * (rig.calfR && rig.calfR.side.x < 0 ? -1 : 1));
    const reach = eyes && chasing ? 0.9 : 0; // (Clark reaches for you while he chases you)
    if (rig.armL) turn(rig.armL, -sw * 0.6 * (reach ? 0.3 : 1) + reach * reachL, rig.armL.drop);
    if (rig.armR) turn(rig.armR, sw * 0.6 * (reach ? 0.3 : 1) + reach * reachR, rig.armR.drop);
    holder.position.y = Math.abs(Math.cos(t)) * 0.04 * w;
    if (eyes) { // hunched, and his head twitches now and then
      holder.rotation.x = lean + (chasing ? 0.08 : 0);
      if ((twitch -= dt) < 0) { twitch = 0.6 + Math.random() * 2.2; tw = (Math.random() - 0.5) * 0.7; }
      tw *= Math.exp(-dt * 3);
      turn(rig.head, 0, tw);
      placeEyes();
    }
  },
  // a held pose for cutscenes: arms 0..1 (reach out and grab), fling 0..1 (throw), kick -1..1 (peg leg back / forward), lean 0..1 (lunge to bite)
  pose(o) {
    turn(rig.legR, 0); turn(rig.calfL, 0); turn(rig.calfR, 0); turn(rig.head, 0);
    turn(rig.legL, (o.kick || 0) * kickS);
    const r = Math.min(1, o.arms || 0) * 1.0 + (o.fling || 0) * 0.9;
    if (rig.armL) turn(rig.armL, r * reachL, rig.armL.drop);
    if (rig.armR) turn(rig.armR, r * reachR, rig.armR.drop);
    holder.position.y = 0; holder.rotation.x = lean + (o.lean || 0) * 0.4 - Math.max(0, o.kick || 0) * 0.15;
    placeEyes();
  } };
}
// The Bacteria has no bones: the whole thing sways, twitches and leans in when it runs.
function bacteria(scene) {
  const raw = scene.clone(true);
  raw.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3, metalness: 0, side: THREE.DoubleSide }); } });
  raw.updateMatrixWorld(true);
  const height = 3.0, bb = new THREE.Box3().setFromObject(raw), s = height / (bb.max.y - bb.min.y || 1);
  const g = new THREE.Group(), holder = new THREE.Group();
  raw.scale.multiplyScalar(s); raw.position.set(-(bb.min.x + bb.max.x) / 2 * s, -bb.min.y * s, -(bb.min.z + bb.max.z) / 2 * s);
  holder.add(raw); g.add(holder);
  let t = 0, jerk = 0, jx = 0, jz = 0;
  return { g, height, animate(dt, sp) {
    if (!(sp >= 0)) sp = 0;
    t += dt * (1.5 + sp * 1.5);
    const w = Math.min(1, sp / 4);
    jerk -= dt; if (jerk <= 0) { jerk = 0.3 + Math.random() * 1.4; jx = (Math.random() - 0.5) * 0.25; jz = (Math.random() - 0.5) * 0.25; } // (sudden twitches)
    holder.rotation.x += ((0.28 * w + Math.sin(t * 0.9) * 0.06 + jx) - holder.rotation.x) * Math.min(1, dt * 10);
    holder.rotation.z += ((Math.sin(t * 1.3) * 0.08 + jz) - holder.rotation.z) * Math.min(1, dt * 10);
    holder.rotation.y = Math.sin(t * 0.5) * 0.3;
    holder.position.y = Math.abs(Math.sin(t * 2)) * 0.1 * w;
    holder.scale.set(1 - Math.sin(t * 2) * 0.03, 1 + Math.sin(t * 2) * 0.04, 1);
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
  const scene = await preload(kind);
  if (kind === "bacteria") return scene ? bacteria(scene) : entity();
  if (!scene) return standIn(kind);
  return fromModel(kind, scene, kind === "clark" ? CLARK_H : 2.9);
}
