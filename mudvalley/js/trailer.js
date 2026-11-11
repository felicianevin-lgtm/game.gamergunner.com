// MUD VALLEY RP: trailers. Hitch one to a truck (T), load your ATV, dirt bike or even a car onto it (E), tow it anywhere.
// A trailer is pulled by its hitch: its wheels just follow along behind (like a real one).
import * as THREE from "/create/vendor/three.module.js";
import { groundAt } from "./terrain.js";
import { pushOut } from "./colliders.js";

export const TRAILERS = [
  { id: "utility", name: "Small Utility Trailer", price: 600, cap: 2, len: 4.4, need: 1, maxSize: 1, desc: "Carries 2 small rides (ATVs or dirt bikes). Even an ATV can pull it!",
    slots: [{ x: 0.68, z: 0.2 }, { x: -0.68, z: 0.2 }], deckY: 0.7 },
  { id: "flatbed", name: "Big Flatbed Trailer", price: 3500, cap: 4, len: 8.6, need: 2, maxSize: 2, desc: "A long car hauler. Carries 2 cars, or a car + 2 small rides. Needs a truck.",
    slots: [{ x: 0, z: 2.9 }, { x: 0, z: 0.55 }, { x: 0, z: -1.8 }, { x: 0, z: -4.15 }], deckY: 1.0 },
];
export const trailerById = (id) => TRAILERS.find((t) => t.id === id);

const mat = {};
function mats() {
  if (mat.steel) return;
  mat.steel = new THREE.MeshLambertMaterial({ color: 0x4a4e58 });
  mat.deck = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  mat.red = new THREE.MeshLambertMaterial({ color: 0xd0302a });
  mat.yellow = new THREE.MeshLambertMaterial({ color: 0xffc020 });
  mat.tire = new THREE.MeshLambertMaterial({ color: 0x1e1f22 });
  mat.rim = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
  mat.light = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  mat.grate = new THREE.MeshLambertMaterial({ color: 0x6a6e78 });
}
const bx = (p, w, h, d, x, y, z, m, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };

// the 3D trailer (origin = the middle of its axle, on the ground; the hitch is at +z)
export function buildTrailer(type) {
  mats();
  const T = trailerById(type), root = new THREE.Group(), deck = new THREE.Group(); root.add(deck);
  const wheels = [];
  const wheel = (x, z, r) => { const w = new THREE.Group(); w.position.set(x, r, z); const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 12), mat.tire); t.rotation.z = Math.PI / 2; w.add(t); const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.3, 8), mat.rim); h.rotation.z = Math.PI / 2; w.add(h); w.children.forEach((c) => (c.castShadow = true)); root.add(w); wheels.push(w); };
  if (type === "utility") {
    bx(deck, 2.7, 0.12, 3.6, 0, 0.62, 0.2, mat.deck); bx(deck, 2.8, 0.14, 3.7, 0, 0.52, 0.2, mat.steel);
    for (const s of [-1, 1]) { bx(deck, 0.08, 0.45, 3.6, s * 1.38, 0.9, 0.2, mat.steel); bx(deck, 0.7, 0.1, 1.0, s * 1.5, 0.95, 0, mat.steel); }
    bx(deck, 2.7, 0.45, 0.08, 0, 0.9, 2.0, mat.steel);
    bx(deck, 2.4, 0.06, 1.0, 0, 0.62, -2.0, mat.grate, -0.5); // the ramp gate
    for (const s of [-1, 1]) { const tg = bx(deck, 0.1, 0.1, 2.6, s * 0.6, 0.55, 3.2, mat.steel); tg.rotation.y = -s * 0.22; bx(deck, 0.12, 0.12, 0.12, s * 1.36, 0.8, -1.55, mat.light); }
    bx(deck, 0.2, 0.15, 0.35, 0, 0.55, T.len - 0.1, mat.steel);
    wheel(1.5, 0, 0.36); wheel(-1.5, 0, 0.36);
  } else {
    bx(deck, 2.7, 0.18, 9.4, 0, 0.92, 0, mat.steel); for (let z = -4.4; z <= 4.4; z += 0.6) bx(deck, 2.66, 0.04, 0.4, 0, 1.02, z, mat.grate);
    for (const s of [-1, 1]) { bx(deck, 0.14, 0.26, 9.4, s * 1.36, 0.92, 0, mat.yellow); for (const z of [-4.4, -1.5, 1.5, 4.4]) bx(deck, 0.14, 0.1, 0.1, s * 1.42, 0.92, z, mat.light); }
    bx(deck, 2.7, 1.2, 0.12, 0, 1.6, 4.65, mat.steel);
    for (const s of [-1, 1]) { const r = bx(deck, 0.55, 0.06, 1.6, s * 0.75, 0.55, -5.25, mat.grate, -0.5); r.name = "ramp"; } // ramps
    const tongue = bx(deck, 0.24, 0.24, 4.4, 0, 0.88, 6.6, mat.steel); tongue.rotation.x = 0.02;
    bx(deck, 0.3, 0.2, 0.4, 0, 0.82, T.len - 0.05, mat.steel);
    for (const z of [-0.65, 0.65]) { wheel(1.45, z, 0.42); wheel(-1.45, z, 0.42); }
    for (const s of [-1, 1]) bx(deck, 0.5, 0.12, 2.4, s * 1.45, 0.98, 0, mat.steel);
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, deck, wheels, T };
}

// a trailer in the world
export function makeTrailer(save, scene) {
  const m = buildTrailer(save.type);
  scene.add(m.root);
  const tr = { s: save, model: m, T: m.T, x: save.x, z: save.z, yaw: save.yaw, y: groundAt(save.x, save.z), pitch: 0, hitched: null, loaded: [], cargo: null, spin: 0 };
  place(tr);
  return tr;
}
// where the hitch ball on the back of a vehicle is (world)
export function hitchPoint(b) {
  const h = b.model.hitch; if (!h) return null;
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
  return { x: b.x + fx * h.z + sx * h.x, y: b.y + h.y, z: b.z + fz * h.z + sz * h.x };
}
// where the trailer's coupler (front tip) is (world)
export function couplerPoint(tr) { const L = tr.T ? tr.T.len : tr.len; return { x: tr.x + Math.sin(tr.yaw) * L, z: tr.z + Math.cos(tr.yaw) * L }; }

// follow the truck
export function stepTrailer(tr, dt) {
  if (!tr.hitched) { tr.y = groundAt(tr.x, tr.z); place(tr); return; }
  const b = tr.hitched, H = hitchPoint(b), L = tr.T ? tr.T.len : tr.len;
  let dx = tr.x - H.x, dz = tr.z - H.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  let ox = tr.x, oz = tr.z;
  tr.x = H.x + dx * L; tr.z = H.z + dz * L;
  // don't fold in half (jackknife)
  let yaw = Math.atan2(H.x - tr.x, H.z - tr.z), diff = Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw));
  if (Math.abs(diff) > 1.4) { yaw = b.yaw + Math.sign(diff) * 1.4; tr.x = H.x - Math.sin(yaw) * L; tr.z = H.z - Math.cos(yaw) * L; }
  const p = pushOut(tr.x, tr.z, 1.1, tr.y + 0.5); if (p.hit) { tr.x = p.x; tr.z = p.z; yaw = Math.atan2(H.x - tr.x, H.z - tr.z); tr.x = H.x - Math.sin(yaw) * L; tr.z = H.z - Math.cos(yaw) * L; }
  tr.yaw = yaw;
  tr.y = groundAt(tr.x, tr.z);
  const hy = b.y + (b.model.hitch ? b.model.hitch.y : 0.6);
  const coupY = tr.y + (tr.T ? (tr.T.id === "flatbed" ? 0.82 : 0.55) : tr.hitchY || 0.6);
  tr.pitch = Math.atan2(hy - coupY, L);
  tr.spin += Math.hypot(tr.x - ox, tr.z - oz) / 0.4 * (((tr.x - ox) * Math.sin(yaw) + (tr.z - oz) * Math.cos(yaw)) > 0 ? 1 : -1);
  place(tr);
}
function place(tr) {
  const r = tr.model.root;
  r.position.set(tr.x, tr.y + 0.04, tr.z); r.rotation.set(-tr.pitch, tr.yaw, 0, "YXZ");
  for (const w of tr.model.wheels) w.rotation.x = tr.spin;
}
// which slots a new vehicle of this size would use (null = no room)
export function freeSlots(tr, size) {
  if (size > tr.T.maxSize) return null;
  const used = []; for (const u of tr.loaded) used.push(...u.slots);
  const n = tr.T.slots.length;
  for (let i = 0; i + size <= n; i++) { const want = Array.from({ length: size }, (_, k) => i + k); if (want.every((k) => !used.includes(k))) return want; }
  return null;
}
// put a vehicle model onto the trailer deck
export function loadOnto(tr, entry, model, slots) {
  const S = tr.T.slots, x = slots.reduce((s, k) => s + S[k].x, 0) / slots.length, z = slots.reduce((s, k) => s + S[k].z, 0) / slots.length;
  tr.model.deck.add(model.root);
  model.root.position.set(x, tr.T.deckY, z); model.root.rotation.set(0, 0, 0);
  tr.loaded.push({ ...entry, slots, model });
}
export function cargoBoxes(tr, kind) {
  if (tr.cargo) { tr.model.deck.remove(tr.cargo); tr.cargo = null; }
  if (!kind) return;
  const g = new THREE.Group(), long = tr.T.id === "flatbed";
  if (kind === "logs") for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, long ? 8 : 3.2, 8), new THREE.MeshLambertMaterial({ color: [0x9a6a3a, 0x8a5a30, 0xa87a48][(i + r) % 3] })); l.rotation.x = Math.PI / 2; l.position.set(-0.96 + i * 0.64 + r * 0.32, tr.T.deckY + 0.36 + r * 0.56, long ? 0 : 0.2); l.castShadow = true; g.add(l); }
  else if (kind === "hay") for (let i = 0; i < (long ? 6 : 2); i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 10), new THREE.MeshLambertMaterial({ color: 0xe6c35a })); h.rotation.z = Math.PI / 2; h.position.set(long ? 0 : (i ? 0.66 : -0.66), tr.T.deckY + 0.72, long ? 3.4 - i * 1.5 : 0.2); h.castShadow = true; g.add(h); }
  else for (let i = 0; i < (long ? 8 : 4); i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), new THREE.MeshLambertMaterial({ color: [0xb08a5a, 0x9a7448][i % 2] })); c.position.set(((i % 2) - 0.5) * 1.2, tr.T.deckY + 0.5 + (long ? 0 : Math.floor(i / 2) * 1.02), long ? 3.4 - Math.floor(i / 2) * 2.2 : 0.2); c.castShadow = true; g.add(c); }
  tr.model.deck.add(g); tr.cargo = g;
}

// a broken-down car being towed (works like a trailer: its front wheels ride up on the tow hook)
export function makeTowable(model, x, z, yaw, scene) {
  scene.add(model.root);
  const L = model.len * 0.5 + 1.6;
  const tr = { s: null, model: { root: model.root, wheels: [], deck: model.root }, T: null, len: L, hitchY: 0.9, x, z, yaw, y: groundAt(x, z), pitch: 0, hitched: null, loaded: [], spin: 0, towCar: model };
  // (its middle is the "axle"; the front sticks out towards the truck)
  place(tr);
  return tr;
}
