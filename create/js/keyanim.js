// MY ANIMATIONS (keyframes) for anything in GunnerVerse Studio: you pose the thing at different moments on a timeline
// (move it, turn it, resize it) and it glides between those poses. The editor's 🎞️ Add animation screen is animmaker.js;
// play.js plays them, scare.js can use one as a jump scare.
//   obj.anims = [{id, name, len (seconds), when (ANIM_WHEN), at (seconds: "time"), btn (a GUI button's id: "button"),
//                 r (studs: "near"), end (ANIM_END), walk ("" or a walk style / standing move from motion.js: legs and
//                 arms move while it plays; older animations only), keys: [{t, p: [x, y, z] move, r: [x, y, z] turn (degrees),
//                 s: [x, y, z] size ×, b: {bone id: [x, y, z] turn (degrees)}}]}]
// 🦴 BONES: a Mesh's own bones (world.js buildMesh, obj.bones) or an imported model's skeleton (bone id = its name).
// boneList() finds them on a built thing; each key can turn any of them, so you can puppet arms, hands, heads...
// "moving" / "idle" animations loop by themselves while the thing walks / chases around or stands still (play.js).
// Every key is measured from where the thing stands in your world (its own front / up / side, so "forward" is always
// the way it faces); the key at 0 s is always that starting spot.
import * as THREE from "../vendor/three.module.js";
import { GAITS, IDLES } from "./motion.js";

export const ANIM_WHEN = {
  start: "When the game starts",
  time: "After some seconds",
  button: "When a GUI button is clicked",
  click: "When a player clicks it",
  touch: "When a player touches it",
  near: "When a player gets close",
  script: "Only when a script says me.play(\"name\")",
  moving: "While it moves around (walking, chasing)",
  idle: "While it stands still",
  scare: "In its jump scare",
};
export const LOOPS = { moving: 1, idle: 1 }; // (these always loop)
export const ANIM_END = { stay: "Stays where it ends", back: "Goes back to the start", loop: "Plays again and again (loop)" };
export const MAX_ANIMS = 8, MAX_KEYS = 40, MAX_LEN = 30, MAX_BONES = 60;
export const okBone = (id) => typeof id === "string" && /^[A-Za-z0-9_:.| -]{1,60}$/.test(id);
export const WALKS = { "": "Nothing (just moves)", ...Object.fromEntries(Object.entries(GAITS).map(([k, v]) => [k, v.icon + " " + v.label])),
  ...Object.fromEntries(Object.entries(IDLES).filter(([k]) => k !== "none" && !GAITS[k]).map(([k, v]) => [k, v.icon + " " + v.label])) };

const rid = () => Math.random().toString(36).slice(2, 10);
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : d; };
const vec = (v, lo, hi, d) => [0, 1, 2].map((i) => num(Array.isArray(v) ? v[i] : d, lo, hi, d));

export function newAnim(when, n) {
  return { id: rid(), name: "Animation " + (n || 1), len: 2, when: ANIM_WHEN[when] ? when : "start", at: 3, btn: "", r: 8, end: when === "scare" ? "stay" : "back", walk: "",
    keys: [{ t: 0, p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] }] };
}

export function sanitizeAnims(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const a of list.slice(0, MAX_ANIMS)) {
    if (!a || typeof a !== "object") continue;
    const len = num(a.len, 0.2, MAX_LEN, 2);
    const keys = (Array.isArray(a.keys) ? a.keys : []).slice(0, MAX_KEYS).filter((k) => k && typeof k === "object")
      .map((k) => { const c = { t: num(k.t, 0, len, 0), p: vec(k.p, -500, 500, 0), r: vec(k.r, -3600, 3600, 0), s: vec(k.s, 0.05, 20, 1) };
        if (k.b && typeof k.b === "object") { const b = {}; for (const [id, v] of Object.entries(k.b).slice(0, MAX_BONES)) if (okBone(id)) b[id] = vec(v, -3600, 3600, 0); if (Object.keys(b).length) c.b = b; }
        return c; })
      .filter((k) => k.t > 0).sort((x, y) => x.t - y.t);
    const seen = new Set(), uniq = keys.filter((k) => !seen.has(k.t) && seen.add(k.t));
    out.push({ id: String(a.id || rid()).replace(/[^a-z0-9]/gi, "").slice(0, 16) || rid(), name: String(a.name || "Animation").replace(/[\u0000-\u001f]/g, "").slice(0, 30) || "Animation",
      len, when: ANIM_WHEN[a.when] ? a.when : "start", at: num(a.at, 0, 600, 3), btn: /^[a-z0-9]{1,16}$/i.test(a.btn || "") ? a.btn : "", r: num(a.r, 1, 100, 8),
      end: LOOPS[a.when] ? "loop" : ANIM_END[a.end] ? a.end : "back", walk: WALKS[a.walk] && a.walk ? a.walk : "",
      keys: [{ t: 0, p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] }, ...uniq] });
  }
  return out.length ? out : null;
}

// The pose at t seconds: {p, r, s} (smooth in and out between keys). Past the last key it holds that pose.
// Bones: every bone any key turns gets a value at every moment (0 where a key doesn't mention it), so going back
// to the start really puts them back.
const smooth = (x) => x * x * (3 - 2 * x);
const ZERO = [0, 0, 0];
export function animBones(a) { const s = new Set(); for (const k of a.keys) if (k.b) for (const id in k.b) s.add(id); return [...s]; }
function full(k, ids) { if (!ids.length) return k; const b = {}; for (const id of ids) b[id] = (k.b && k.b[id]) || ZERO; return { ...k, b }; }
export function sampleAnim(a, t) {
  const k = a.keys, ids = animBones(a);
  if (!k.length) return { p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] };
  if (t <= k[0].t) return full(k[0], ids);
  for (let i = 1; i < k.length; i++) {
    if (t > k[i].t) continue;
    const A = k[i - 1], B = k[i], f = smooth((t - A.t) / Math.max(1e-6, B.t - A.t));
    const mix = (x, y) => [0, 1, 2].map((j) => x[j] + (y[j] - x[j]) * f);
    const out = { p: mix(A.p, B.p), r: mix(A.r, B.r), s: mix(A.s, B.s) };
    if (ids.length) { out.b = {}; for (const id of ids) out.b[id] = mix((A.b && A.b[id]) || ZERO, (B.b && B.b[id]) || ZERO); }
    return out;
  }
  return full(k[k.length - 1], ids);
}
// Where an animation is after `el` seconds of playing: {pose, done}.
export function animAt(a, el) {
  if (a.end === "loop" || LOOPS[a.when]) return { pose: sampleAnim(a, el % a.len), done: false };
  if (el >= a.len) return { pose: a.end === "back" ? sampleAnim(a, 0) : sampleAnim(a, a.len), done: true };
  return { pose: sampleAnim(a, el), done: false };
}

// Put a pose on a built thing g: base = {pos: Vector3, q: Quaternion, s: Vector3} = where it stands without the animation.
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), D2R = Math.PI / 180;
export function poseQuat(r, out) { return (out || new THREE.Quaternion()).setFromEuler(_e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, "YXZ")); }
export function applyPose(g, base, pose) {
  g.position.copy(base.pos).add(_v.set(pose.p[0], pose.p[1], pose.p[2]).applyQuaternion(base.q));
  g.quaternion.copy(base.q).multiply(poseQuat(pose.r, _q));
  g.scale.set(base.s.x * pose.s[0], base.s.y * pose.s[1], base.s.z * pose.s[2]);
}
// For things that move by themselves too (chasers, scripts, movers): take off last frame's pose, put this one on.
// last = {p: Vector3 (world), q: Quaternion} (kept between frames).
export function shiftPose(g, base, pose, last) {
  g.position.sub(last.p);
  g.quaternion.multiply(_q.copy(last.q).invert());
  poseQuat(pose.r, last.q);
  last.p.set(pose.p[0], pose.p[1], pose.p[2]).applyQuaternion(g.quaternion);
  g.position.add(last.p);
  g.quaternion.multiply(last.q);
  g.scale.set(base.s.x * pose.s[0], base.s.y * pose.s[1], base.s.z * pose.s[2]);
}
// ---------------------------------------------------------------- 🦴 bones
// The bones of a built thing (inner = world.js's scaled group): [{id, name, node}]. Meshes: their own (buildMesh);
// imported models: their skeleton, once loaded (the bone's name is its id).
export function boneList(inner) {
  if (!inner) return [];
  if (inner.userData.bones) return [...inner.userData.bones.values()].map((n) => ({ id: n.userData.boneId, name: n.name, node: n }));
  const src = inner.userData.copy; if (!src) return [];
  const out = [], seen = new Set();
  src.traverse((o) => { if (o.isBone && okBone(o.name) && !seen.has(o.name)) { seen.add(o.name); out.push({ id: o.name, name: o.name.replace(/^mixamorig\d*:?/i, ""), node: o }); } });
  return out;
}
export function findBone(inner, id) {
  const m = inner && inner.userData.boneMap && inner.userData.boneFor === (inner.userData.copy || inner.userData.bones) ? inner.userData.boneMap : null;
  if (m) return m.get(id) || null;
  if (!inner) return null;
  inner.userData.boneMap = new Map(boneList(inner).map((b) => [b.id, b.node])); inner.userData.boneFor = inner.userData.copy || inner.userData.bones;
  return inner.userData.boneMap.get(id) || null;
}
export function restOf(node) { return node.userData.rest || (node.userData.rest = node.quaternion.clone()); }
const _bq = new THREE.Quaternion();
export function applyBones(inner, pose) {
  if (!pose.b || !inner) return;
  for (const id in pose.b) { const n = findBone(inner, id); if (n) n.quaternion.copy(restOf(n)).multiply(poseQuat(pose.b[id], _bq)); }
}
export function animSummary(a, gui) {
  const w = a.when === "time" ? "after " + a.at + " s" : a.when === "button" ? "when " + ((gui || []).find((g) => g.id === a.btn) || { name: "a button" }).name + " is clicked"
    : a.when === "near" ? "when a player is " + a.r + " studs away" : a.when === "script" ? 'me.play("' + a.name + '")' : ANIM_WHEN[a.when].toLowerCase();
  return a.len + " s · " + (a.keys.length - 1) + " pose" + (a.keys.length === 2 ? "" : "s") + " · " + w + (a.end === "loop" ? " · loops" : "");
}
