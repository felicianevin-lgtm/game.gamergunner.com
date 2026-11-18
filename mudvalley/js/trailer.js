// MUD VALLEY RP: trailers. Hitch one to a truck (T), load your ATV, dirt bike or even a car onto it (E), tow it anywhere.
// A trailer is pulled by its hitch: its wheels just follow along behind (like a real one).
import * as THREE from "/create/vendor/three.module.js";
import { groundAt } from "./terrain.js";
import { pushOut } from "./colliders.js";
import { bedOf, BEDS } from "./vehicles.js";

export const TRAILERS = [
  { id: "utility", name: "Small Utility Trailer", price: 600, cap: 2, len: 4.4, need: 1, maxSize: 1, desc: "Carries 2 small rides (ATVs or dirt bikes). Even an ATV can pull it!",
    slots: [{ x: 0.68, z: 0.2 }, { x: -0.68, z: 0.2 }], deckY: 0.7 },
  { id: "flatbed", name: "Big Flatbed Trailer", price: 3500, cap: 4, len: 8.6, need: 2, maxSize: 2, desc: "A long car hauler. Carries 2 cars, or a car + 2 small rides. Needs a truck.",
    slots: [{ x: 0, z: 2.9 }, { x: 0, z: 0.55 }, { x: 0, z: -1.8 }, { x: 0, z: -4.15 }], deckY: 1.0 },
  { id: "enclosed", name: "Big Enclosed Trailer", price: 6500, cap: 2, len: 7.6, need: 2, maxSize: 2, enclosed: true, paintable: true, desc: "A giant closed-up box trailer in YOUR color. Fits one car (or 2 small rides). The back door opens into a ramp.",
    slots: [{ x: 0, z: 0.9 }, { x: 0, z: -1.5 }], deckY: 0.9 },
  // a gooseneck: a long, heavy-duty deck that hooks onto a ball IN the truck bed (pickups with a bed only)
  { id: "gooseneck", name: "Big Iron Gooseneck Trailer", price: 7800, cap: 5, len: 10.4, need: 2, maxSize: 2, goose: true, long: true, paintable: true, desc: "A 32-foot gooseneck flatbed. It hooks onto a ball in your truck bed (pickups only), so it pulls super steady. Carries 2 cars + a small ride, or 5 small rides!",
    slots: [{ x: 0, z: 3.6 }, { x: 0, z: 1.4 }, { x: 0, z: -0.8 }, { x: 0, z: -3.0 }, { x: 0, z: -5.0 }], deckY: 1.0 },
  // a real travel trailer (an RV you tow): park it anywhere, walk up to the side door and press E to go inside
  { id: "camper", name: "Lazy Days RV Camper", price: 12000, cap: 0, len: 8.4, need: 2, maxSize: 0, rv: true, paintable: true, desc: "A real RV camper you can tow ANYWHERE! Park it, walk up to the side door and press E to go inside: a bed, a kitchen, a couch and a TV. The stripes come in YOUR color. Needs a truck.",
    slots: [], deckY: 0.8 },
];
// where the RV's side door is (trailer space: x = sideways, z = forward) and which way is "out"
export const RV_DOOR = { x: -1.3, z: -1.2 };
export const ENCLOSED_COLORS = [0x1a1a1e, 0xf4f4f4, 0xe0203a, 0x2a7ad0, 0x3aa04a, 0xffd23a, 0xff7a1a, 0x6a3ad0, 0xff5ad8, 0x9aa0aa, 0x7a4a2a, 0x2ac0a0];
// how far behind the axle the back end is, and how high the coupler sits
export const trailerBack = (T) => (T.id === "flatbed" ? 5.6 : T.id === "enclosed" ? 6.6 : T.id === "gooseneck" ? 6.4 : T.rv ? 3.8 : 2.4);
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
export function buildTrailer(type, color = 0x1a1a1e) {
  mats();
  const T = trailerById(type), root = new THREE.Group(), deck = new THREE.Group(); root.add(deck);
  let door = null, body = null;
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
  } else if (type === "enclosed") {
    // a big box on two axles: walls + roof in your color, a pointy nose, and a back door that drops down into a ramp
    body = new THREE.MeshLambertMaterial({ color });
    const H = 3.1, y0 = 0.9, zb = -3.5, zf = 3.1;
    bx(deck, 2.7, 0.2, zf - zb, 0, y0 - 0.1, (zf + zb) / 2, mat.steel); bx(deck, 2.5, 0.04, zf - zb - 0.1, 0, y0 + 0.02, (zf + zb) / 2, mat.deck);
    for (const s of [-1, 1]) { bx(deck, 0.08, H, zf - zb, s * 1.32, y0 + H / 2, (zf + zb) / 2, body); bx(deck, 0.1, 0.12, zf - zb, s * 1.36, y0 + 0.3, (zf + zb) / 2, mat.steel); }
    bx(deck, 2.72, 0.1, zf - zb + 0.1, 0, y0 + H + 0.05, (zf + zb) / 2, body);
    // the V nose: one solid wedge (closes the whole front wall, no gaps)
    const ns = new THREE.Shape(); ns.moveTo(-1.36, 0); ns.lineTo(1.36, 0); ns.lineTo(0.65, -0.75); ns.lineTo(-0.65, -0.75); ns.closePath();
    const nose = new THREE.Mesh(new THREE.ExtrudeGeometry(ns, { depth: H + 0.1, bevelEnabled: false }), body);
    nose.rotation.x = -Math.PI / 2; nose.position.set(0, y0, zf - 0.02); nose.castShadow = nose.receiveShadow = true; deck.add(nose);
    bx(deck, 2.7, 0.2, 0.75, 0, y0 - 0.1, zf + 0.3, mat.steel); // the frame under the nose
    for (const s of [-1, 1]) { bx(deck, 0.14, 0.14, 0.14, s * 1.36, y0 + H - 0.1, zb + 0.1, mat.light); bx(deck, 0.14, 0.14, 0.14, s * 1.36, y0 + H - 0.1, zf - 0.1, mat.yellow); bx(deck, 0.2, H + 0.1, 0.12, s * 1.3, y0 + H / 2, zb, mat.steel); }
    bx(deck, 2.72, 0.16, 0.12, 0, y0 + H, zb, mat.steel);
    for (const s of [-1, 1]) bx(deck, 0.7, 0.5, 2.6, s * 1.55, 0.95, 0, mat.steel); // fenders
    // the tongue runs from under the nose all the way to the coupler (an A-frame + a center bar)
    const tz0 = zf + 0.3, tz1 = T.len - 0.2;
    bx(deck, 0.24, 0.24, tz1 - tz0, 0, 0.82, (tz0 + tz1) / 2, mat.steel);
    for (const s of [-1, 1]) { const a = bx(deck, 0.16, 0.16, Math.hypot(tz1 - tz0, 1.1), s * 0.55, 0.8, (tz0 + tz1) / 2, mat.steel); a.rotation.y = -s * Math.atan2(1.1, tz1 - tz0); }
    bx(deck, 0.32, 0.22, 0.5, 0, 0.82, T.len - 0.1, mat.steel); // coupler
    bx(deck, 0.1, 0.6, 0.1, 0.3, 0.45, zf + 1.6, mat.steel); // jack stand
    // the back door (hinged at the bottom)
    door = new THREE.Group(); door.position.set(0, y0, zb - 0.06); deck.add(door);
    bx(door, 2.5, H - 0.05, 0.08, 0, (H - 0.05) / 2, 0, body); for (let y = 0.4; y < H; y += 0.6) bx(door, 2.3, 0.05, 0.1, 0, y, -0.02, mat.grate);
    for (const z of [-0.6, 0.6]) { wheel(1.55, z, 0.42); wheel(-1.55, z, 0.42); }
  } else if (type === "gooseneck") {
    // a long steel deck with a beavertail + 2 ramps at the back, a raised front deck, then the neck that reaches up and
    // over the tailgate down to a coupler that drops onto the ball in the truck bed
    body = new THREE.MeshLambertMaterial({ color });
    const y = 0.9, zb = -6.2, zf = 4.4, L = T.len;
    bx(deck, 2.6, 0.2, zf - zb, 0, y, (zf + zb) / 2, body); for (let z = zb + 0.3; z < zf; z += 0.55) bx(deck, 2.5, 0.04, 0.38, 0, y + 0.11, z, mat.deck);
    for (const s of [-1, 1]) { bx(deck, 0.14, 0.3, zf - zb, s * 1.3, y - 0.04, (zf + zb) / 2, body); for (let z = zb + 0.6; z < zf; z += 1.6) bx(deck, 0.12, 0.12, 0.12, s * 1.38, y + 0.05, z, mat.steel); bx(deck, 0.14, 0.1, 0.1, s * 1.36, y, zb + 0.1, mat.light); bx(deck, 0.14, 0.1, 0.1, s * 1.36, y, zf - 0.2, mat.yellow); }
    for (const s of [-1, 1]) { const r = bx(deck, 0.6, 0.06, 1.8, s * 0.75, 0.5, zb - 0.85, mat.grate, -0.5); r.name = "ramp"; } // ramps (beavertail)
    // the raised front deck (a step up), the neck + the coupler
    bx(deck, 2.6, 0.55, 2.0, 0, y + 0.1, zf + 1.0, body); bx(deck, 2.5, 0.04, 1.9, 0, y + 0.66, zf + 1.0, mat.deck);
    bx(deck, 0.5, 0.38, L - zf - 2.0 + 0.3, 0, y + 0.85, (zf + 2.0 + L) / 2 - 0.15, body); // the neck beam
    for (const s of [-1, 1]) bx(deck, 0.12, 0.6, 0.12, s * 0.3, y + 0.6, zf + 2.1, body);
    bx(deck, 0.3, 0.75, 0.3, 0, y + 0.3, L, body); bx(deck, 0.24, 0.14, 0.24, 0, y + 0.14, L, mat.steel); // the coupler post
    bx(deck, 0.08, 0.7, 0.08, 0.55, 0.45, zf + 1.6, mat.steel); bx(deck, 0.08, 0.7, 0.08, -0.55, 0.45, zf + 1.6, mat.steel); // landing legs
    for (const s of [-1, 1]) bx(deck, 0.6, 0.45, 3.1, s * 1.45, 0.92, -1.4, mat.steel); // fenders
    for (const z of [-2.2, -0.6]) { wheel(1.45, z, 0.42); wheel(-1.45, z, 0.42); }
  } else if (type === "camper") {
    // a tall rounded white box with stripes in your color, windows, a side door with steps, an awning (out when it's
    // parked), an A/C on the roof, propane tanks on the tongue
    body = new THREE.MeshLambertMaterial({ color });
    const white = new THREE.MeshLambertMaterial({ color: 0xf6f4ee }), cream = new THREE.MeshLambertMaterial({ color: 0xe4ddcc }), glass = new THREE.MeshLambertMaterial({ color: 0x24323e });
    const H = 2.75, y0 = 0.72, zb = -3.6, zf = 3.4, W = 2.5;
    const sh = new THREE.Shape();
    sh.moveTo(zb + 0.2, y0); sh.lineTo(zf - 0.25, y0); sh.quadraticCurveTo(zf, y0, zf, y0 + 0.3); sh.lineTo(zf, y0 + H - 0.8); sh.quadraticCurveTo(zf, y0 + H, zf - 0.8, y0 + H);
    sh.lineTo(zb + 0.45, y0 + H); sh.quadraticCurveTo(zb, y0 + H, zb, y0 + H - 0.45); sh.lineTo(zb, y0 + 0.2); sh.quadraticCurveTo(zb, y0, zb + 0.2, y0);
    const box = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 8 }), white);
    box.rotation.y = -Math.PI / 2; box.position.x = W / 2; deck.add(box);
    // stripes down both sides + across the front
    bx(deck, W + 0.03, 0.2, zf - zb - 0.5, 0, y0 + 0.85, (zf + zb) / 2 - 0.1, body); bx(deck, W + 0.03, 0.08, zf - zb - 0.7, 0, y0 + 1.1, (zf + zb) / 2 - 0.1, body);
    bx(deck, W - 0.2, 0.2, 0.06, 0, y0 + 0.85, zf + 0.01, body); bx(deck, W + 0.03, 0.12, zf - zb - 0.3, 0, y0 + 0.08, (zf + zb) / 2, cream);
    // windows (both sides), a wide front window and a back window
    for (const z of [2.2, 0.4, -2.6]) bx(deck, W + 0.04, 0.62, z === 0.4 ? 1.3 : 1.0, 0, y0 + 1.75, z, glass);
    bx(deck, 1.9, 0.5, 0.06, 0, y0 + 1.6, zf + 0.02, glass); bx(deck, 1.2, 0.45, 0.06, 0, y0 + 1.75, zb - 0.02, glass);
    // the side door (on the curb side: -x), a little window in it, a handle, and fold-down steps
    const dx = -W / 2 - 0.03;
    bx(deck, 0.05, 2.0, 0.78, dx, y0 + 1.02, RV_DOOR.z, cream); bx(deck, 0.06, 0.4, 0.4, dx - 0.01, y0 + 1.6, RV_DOOR.z, glass); bx(deck, 0.08, 0.05, 0.12, dx - 0.03, y0 + 1.0, RV_DOOR.z + 0.28, mat.rim);
    bx(deck, 0.36, 0.08, 0.7, dx - 0.2, 0.5, RV_DOOR.z, mat.grate); bx(deck, 0.36, 0.08, 0.7, dx - 0.5, 0.25, RV_DOOR.z, mat.grate);
    // the awning (rolled up while towing, out when parked)
    bx(deck, 0.18, 0.18, 4.6, dx - 0.08, y0 + 2.45, 0.1, body);
    const awning = new THREE.Group(); deck.add(awning);
    const aw = bx(awning, 2.2, 0.05, 4.6, dx - 1.1, y0 + 2.28, 0.1, body); aw.rotation.z = 0.12;
    for (let i = 0; i < 5; i++) bx(awning, 2.2, 0.055, 0.35, dx - 1.1, y0 + 2.285, -1.9 + i * 1.0, white).rotation.z = 0.12;
    for (const z of [-2.1, 2.3]) bx(awning, 0.05, y0 + 2.1, 0.05, dx - 2.15, (y0 + 2.1) / 2, z, mat.rim);
    // roof: an A/C unit + a vent; back: a bumper, tail lights and a spare tire
    bx(deck, 0.85, 0.32, 0.95, 0, y0 + H + 0.16, 0.7, white); bx(deck, 0.5, 0.12, 0.5, 0, y0 + H + 0.06, -2.1, cream);
    bx(deck, W - 0.2, 0.14, 0.14, 0, 0.62, zb - 0.1, mat.steel);
    for (const s of [-1, 1]) bx(deck, 0.18, 0.28, 0.06, s * 1.0, y0 + 0.45, zb - 0.02, mat.light);
    { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 14), mat.tire); t.rotation.x = Math.PI / 2; t.position.set(0, y0 + 0.75, zb - 0.12); deck.add(t); }
    for (const s of [-1, 1]) { bx(deck, 0.14, 0.14, 0.14, s * 1.2, y0 + H - 0.1, zb + 0.15, mat.light); bx(deck, 0.14, 0.14, 0.14, s * 1.2, y0 + H - 0.1, zf - 0.6, mat.yellow); }
    // the tongue: an A-frame + a center bar, two propane tanks, a jack stand, the coupler
    const tz0 = zf - 0.2, tz1 = T.len - 0.2;
    bx(deck, 0.24, 0.24, tz1 - tz0, 0, 0.8, (tz0 + tz1) / 2, mat.steel);
    for (const s of [-1, 1]) { const a = bx(deck, 0.16, 0.16, Math.hypot(tz1 - tz0, 1.1), s * 0.55, 0.78, (tz0 + tz1) / 2, mat.steel); a.rotation.y = -s * Math.atan2(1.1, tz1 - tz0); }
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10), white); p.position.set(s * 0.26, 1.25, zf + 0.75); deck.add(p); }
    bx(deck, 0.32, 0.22, 0.5, 0, 0.82, T.len - 0.1, mat.steel); bx(deck, 0.1, 0.6, 0.1, 0.3, 0.45, zf + 1.5, mat.steel);
    for (const z of [-0.55, 0.55]) { wheel(1.32, z, 0.4); wheel(-1.32, z, 0.4); }
    return finish({ root, deck, wheels, T, door, body, awning });
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
  return finish({ root, deck, wheels, T, door, body });
}
function finish(m) { m.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return m; }

// a trailer in the world
export function makeTrailer(save, scene) {
  const m = buildTrailer(save.type, save.color);
  scene.add(m.root);
  const tr = { s: save, model: m, T: m.T, x: save.x, z: save.z, yaw: save.yaw, y: groundAt(save.x, save.z), pitch: 0, hitched: null, loaded: [], cargo: null, spin: 0, doorA: save.open ? DOOR_OPEN : 0 };
  place(tr);
  return tr;
}
// where the hitch ball on the back of a vehicle is (world)
export function hitchPoint(b) {
  const h = b.model.hitch; if (!h) return null;
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
  return { x: b.x + fx * h.z + sx * h.x, y: b.y + h.y, z: b.z + fz * h.z + sz * h.x };
}
// where the gooseneck ball in a truck bed is (world): the middle of the bed, a bit forward of the back axle
export function goosePoint(b) {
  const B = BEDS[b.car && b.car.id] && bedOf(b.car); if (!B) return null;
  const M = b.model, y = (M.flatY ?? B.y) + (M.liftY || 0), z = B.z + 0.25;
  return { x: b.x + Math.sin(b.yaw) * z, y: b.y + y, z: b.z + Math.cos(b.yaw) * z };
}
const hookPoint = (tr, b) => (tr.T && tr.T.goose ? goosePoint(b) : hitchPoint(b));
// where the trailer's coupler (front tip) is (world)
export function couplerPoint(tr) { const L = tr.T ? tr.T.len : tr.len; return { x: tr.x + Math.sin(tr.yaw) * L, z: tr.z + Math.cos(tr.yaw) * L }; }

// follow the truck
export function stepTrailer(tr, dt) {
  if (tr.model.awning) tr.model.awning.visible = !tr.hitched; // (the RV's awning rolls out when it's parked)
  if (!tr.hitched) { tr.y = groundAt(tr.x, tr.z); place(tr); return; }
  const b = tr.hitched, H = hookPoint(tr, b) || hitchPoint(b), L = tr.T ? tr.T.len : tr.len;
  let dx = tr.x - H.x, dz = tr.z - H.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  let ox = tr.x, oz = tr.z;
  tr.x = H.x + dx * L; tr.z = H.z + dz * L;
  // don't fold in half (jackknife)
  let yaw = Math.atan2(H.x - tr.x, H.z - tr.z), diff = Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw));
  const fold = tr.T && tr.T.goose ? 1.25 : 1.4; // (a gooseneck turns tighter but its neck can't swing as far)
  if (Math.abs(diff) > fold) { yaw = b.yaw + Math.sign(diff) * fold; tr.x = H.x - Math.sin(yaw) * L; tr.z = H.z - Math.cos(yaw) * L; }
  const p = pushOut(tr.x, tr.z, 1.1, tr.y + 0.5); if (p.hit) { tr.x = p.x; tr.z = p.z; yaw = Math.atan2(H.x - tr.x, H.z - tr.z); tr.x = H.x - Math.sin(yaw) * L; tr.z = H.z - Math.cos(yaw) * L; }
  tr.yaw = yaw;
  tr.y = groundAt(tr.x, tr.z);
  const hy = tr.T && tr.T.goose ? H.y : b.y + (b.model.hitch ? b.model.hitch.y : 0.6);
  const coupY = tr.y + (tr.T ? (tr.T.id === "utility" ? 0.55 : tr.T.goose ? 0.9 : 0.82) : tr.hitchY || 0.6);
  tr.pitch = Math.atan2(hy - coupY, L);
  tr.spin += Math.hypot(tr.x - ox, tr.z - oz) / 0.4 * (((tr.x - ox) * Math.sin(yaw) + (tr.z - oz) * Math.cos(yaw)) > 0 ? 1 : -1);
  place(tr);
}
// the back door: closed = straight up, open = flat down on the ground like a ramp
const DOOR_OPEN = Math.PI / 2 + Math.asin(0.9 / 3.05);
export function stepDoor(tr, dt) {
  const D = tr.model.door; if (!D) return;
  const want = tr.s && tr.s.open ? DOOR_OPEN : 0;
  tr.doorA += Math.sign(want - tr.doorA) * Math.min(Math.abs(want - tr.doorA), dt * 1.8);
  D.rotation.x = -tr.doorA;
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
  const g = new THREE.Group(), long = tr.T.id === "flatbed" || !!tr.T.long;
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
