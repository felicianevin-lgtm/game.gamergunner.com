// MUD VALLEY RP: every ride you can buy, how it drives, and the 3D model (with paint, tires, lift, engine parts and neon).
// Models face +z (forward). Wheels touch the ground at y = 0.
import * as THREE from "/create/vendor/three.module.js";
import { makePerson, LOOKS } from "./character.js";
import { mergeGeometries } from "/create/vendor/BufferGeometryUtils.js";

// top = top speed on the road (m/s), acc = how fast it speeds up, grip = how well it sticks, turn = how fast it turns,
// off = how well it does on dirt / grass / mud (1 = great), size = how much room it takes on a trailer, tow = what trailers it can pull,
// crawl = how well it climbs steep hills (1 = a mountain goat, 0.2 = slides right back down)
export const VEHICLES = [
  { id: "pickup", name: "Rusty Pickup", price: 0, top: 30, acc: 9, grip: 7, turn: 1.9, off: { dirt: 0.8, grass: 0.72, mud: 0.5 }, size: 2, tow: 2, color: 0xc8502a, engine: 70, crawl: 0.55, desc: "Your first truck! A bit rusty, but it can pull a trailer anywhere." },
  { id: "atv", name: "Trail Buddy ATV", price: 1200, top: 23, acc: 12, grip: 8, turn: 2.5, off: { dirt: 1, grass: 0.95, mud: 0.82 }, size: 1, tow: 1, color: 0x3aa04a, engine: 120, open: true, crawl: 0.9, desc: "A four-wheeler that LOVES mud and trails. Fits on a small trailer." },
  { id: "bike", name: "Dirt Rocket", price: 1800, top: 27, acc: 14, grip: 7, turn: 2.6, off: { dirt: 1, grass: 0.95, mud: 0.7 }, size: 1, tow: 0, color: 0xff7a1a, engine: 160, open: true, bike: true, crawl: 0.88, desc: "A dirt bike! Super quick, great for jumps and pizza delivery." },
  { id: "jeep", name: "Mud Hog 4x4", price: 5500, top: 31, acc: 10, grip: 7.5, turn: 2.0, off: { dirt: 0.97, grass: 0.93, mud: 0.86 }, size: 2, tow: 2, color: 0x2a7ad0, engine: 85, open: true, crawl: 0.95, desc: "Big tires, a snorkel and a light bar. Goes anywhere, pulls anything." },
  { id: "buggy", name: "Dune Hopper", price: 8000, top: 37, acc: 13.5, grip: 6.5, turn: 2.3, off: { dirt: 1, grass: 0.9, mud: 0.66 }, size: 2, tow: 1, color: 0xffd23a, engine: 140, open: true, air: 0.85, crawl: 0.75, desc: "A light dune buggy that flies off jumps. Fast on dirt!" },
  { id: "sports", name: "Street Comet", price: 12000, top: 50, acc: 16, grip: 9, turn: 2.1, off: { dirt: 0.42, grass: 0.35, mud: 0.2 }, size: 2, tow: 0, color: 0xe0203a, engine: 110, crawl: 0.25, desc: "A super fast sports car. Zooms on roads... but hates dirt and mud!" },
  { id: "hauler", name: "Big Bertha Hauler", price: 15000, top: 30, acc: 6.5, grip: 7, turn: 1.5, off: { dirt: 0.72, grass: 0.62, mud: 0.42 }, size: 9, tow: 2, color: 0x6a3ad0, engine: 50, crawl: 0.35, desc: "A giant semi truck. Slow to start, but pulls the big flatbed full of cars." },
  { id: "monster", name: "Stomper Monster Truck", price: 22000, top: 33, acc: 11, grip: 7.5, turn: 1.8, off: { dirt: 1, grass: 1, mud: 0.93 }, size: 9, tow: 2, color: 0x2ac0a0, engine: 60, crawl: 1, desc: "HUGE wheels. Climbs anything, crushes mud, does big jumps." },
  // police cars (you get these when you join the police; they never show up at the dealership)
  { id: "cruiser", name: "Police Cruiser", price: 0, police: true, top: 40, acc: 13, grip: 8.5, turn: 2.1, off: { dirt: 0.7, grass: 0.62, mud: 0.45 }, size: 2, tow: 0, color: 0xf4f4f4, engine: 95, crawl: 0.45, desc: "A sturdy police car with a light bar and a siren (G)." },
  { id: "interceptor", name: "Police Interceptor", price: 15000, police: true, top: 52, acc: 17, grip: 9, turn: 2.2, off: { dirt: 0.6, grass: 0.5, mud: 0.35 }, size: 2, tow: 0, color: 0x1a2a5a, engine: 115, crawl: 0.35, desc: "The super fast police car. Unlocks at Sergeant rank (or buy it at the station)." },
  { id: "hyper", name: "Thunder GT", price: 45000, top: 62, acc: 21, grip: 10, turn: 2.1, off: { dirt: 0.33, grass: 0.28, mud: 0.15 }, size: 2, tow: 0, color: 0x1a1a22, engine: 125, crawl: 0.2, desc: "The fastest car in Mud Valley. Glowing lights, giant wing. Road only!" },
];
export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];

// what the customize shop sells
export const PAINTS = [0xc8502a, 0xe0203a, 0xff7a1a, 0xffd23a, 0x8adf3a, 0x3aa04a, 0x2ac0a0, 0x3ad0ff, 0x2a7ad0, 0x6a3ad0, 0xff5ad8, 0xffffff, 0x9aa0aa, 0x1a1a22, 0x7a4a2a, 0xd4af37];
export const RIMS = [{ id: "chrome", name: "Chrome", c: 0xd8dde3 }, { id: "black", name: "Black", c: 0x222226 }, { id: "gold", name: "Gold", c: 0xffc42a }, { id: "neon", name: "Neon Green", c: 0x6aff3a }, { id: "red", name: "Red", c: 0xe0203a }];
export const TIRES = [
  { id: "street", name: "Street Tires", price: 0, desc: "Best on roads." },
  { id: "allterrain", name: "All-Terrain Tires", price: 400, desc: "Better on dirt and grass." },
  { id: "mud", name: "Mud Tires", price: 700, desc: "Huge knobby tires. Mud? No problem! A bit slower on roads." },
];
export const ENGINE_COST = [0, 600, 1500, 3500, 7000];
export const LIFT_COST = [0, 400, 800, 1200];
export const NEONS = [null, 0x3ad0ff, 0xff3ad8, 0x6aff3a, 0xffd23a, 0xff3a3a, 0xffffff];
export const PRICES = { paint: 150, rims: 200, neon: 500 };

// a fresh owned vehicle
export function newCar(id, uid) {
  const v = vehicleById(id);
  return { uid, id, paint: v.color, rims: "chrome", tires: id === "atv" || id === "monster" || id === "bike" ? "mud" : id === "jeep" ? "allterrain" : "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0, x: 0, z: 0, yaw: 0, on: null };
}
// final driving numbers after upgrades
export function tune(car) {
  const v = vehicleById(car.id), off = { ...v.off };
  let top = v.top * (1 + 0.06 * car.engine), acc = v.acc * (1 + 0.1 * car.engine), grip = v.grip;
  const t = car.tires;
  if (t === "allterrain") { off.dirt += 0.08; off.grass += 0.08; off.mud += 0.1; top *= 0.98; }
  if (t === "mud") { off.dirt += 0.12; off.grass += 0.12; off.mud += 0.3; top *= 0.94; grip *= 0.92; }
  off.dirt += 0.03 * car.lift; off.grass += 0.03 * car.lift; off.mud += 0.04 * car.lift; grip *= 1 - 0.04 * car.lift;
  for (const k in off) off[k] = Math.min(1, off[k]);
  const crawl = Math.min(1, (v.crawl ?? 0.5) + (t === "mud" ? 0.08 : t === "allterrain" ? 0.04 : 0) + 0.02 * car.lift);
  return { top: top * car.limit, acc, grip, turn: v.turn, off, crawl, air: v.air ?? 1, bike: !!v.bike, engine: v.engine * (1 + 0.04 * car.engine) };
}
// 0..1 bars for the dealership
export function statBars(id, car) {
  const t = tune(car || newCar(id, 0)), v = vehicleById(id);
  return { speed: Math.min(1, t.top / 64), accel: Math.min(1, t.acc / 22), offroad: (t.off.dirt + t.off.grass + t.off.mud) / 3, handling: Math.min(1, (t.grip / 10) * 0.6 + (v.turn / 2.6) * 0.4) };
}

// ---------------------------------------------------------------- 3D models
const M = {};
function mats() {
  if (M.dark) return;
  M.dark = new THREE.MeshLambertMaterial({ color: 0x26282e });
  M.trim = new THREE.MeshLambertMaterial({ color: 0x3a3d44 });
  M.chrome = new THREE.MeshPhongMaterial({ color: 0xd8dde3, shininess: 120, specular: 0xffffff });
  M.glass = new THREE.MeshPhongMaterial({ color: 0x2a3a4a, shininess: 140, specular: 0xbfe6ff });
  M.light = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
  M.tail = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  M.tire = new THREE.MeshLambertMaterial({ color: 0x1e1f22 });
  M.seat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  M.rust = new THREE.MeshLambertMaterial({ color: 0x8a4a22 });
  M.wood = new THREE.MeshLambertMaterial({ color: 0x9a6a3a });
  M.white = new THREE.MeshLambertMaterial({ color: 0xf4f4f4 });
  M.glow = new THREE.MeshBasicMaterial({ color: 0x6af0ff });
  M.flame = new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.85, depthWrite: false });
}
function bx(p, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; }
function cy(p, r, h, x, y, z, mat, seg = 10, rx = 0, rz = 0, rTop = r) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); p.add(m); return m; }
const tube = (p, a, b, r, mat) => { const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(m); return m; };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// a wheel: steer pivot -> spinning part -> tire + rim
function wheel(car, x, z, r, w, front, opts = {}) {
  const pivot = new THREE.Group(); pivot.position.set(x, r, z);
  const spin = new THREE.Group(); pivot.add(spin);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), M.tire); tire.rotation.z = Math.PI / 2; spin.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, w + 0.04, 10), car.rimMat); rim.rotation.z = Math.PI / 2; spin.add(rim);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, r * 0.22, r * 0.9), car.rimMat); spin.add(hub);
  const hub2 = hub.clone(); hub2.rotation.x = Math.PI / 2; spin.add(hub2);
  // knobby tread (shows with mud / all-terrain tires)
  const knobs = new THREE.Group(); spin.add(knobs);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, r * 0.16, r * 0.3), M.tire); k.position.set(0, Math.cos(a) * r, Math.sin(a) * r); k.rotation.x = -a; knobs.add(k); }
  car.root.add(pivot);
  bakeGroup(spin, (o) => o === knobs); bakeGroup(knobs); // (glue the wheel parts together: fewer things to draw)
  const W = { pivot, spin, knobs, x, z, r0: r, r, front, side: Math.sign(x) || 1, bike: !!opts.bike };
  car.wheels.push(W);
  return W;
}

// glue all the little meshes inside a group into one mesh per material (a car = ~25 draws instead of ~120).
// skip(o) = true keeps that part (and everything in it) separate (things that move, blink or hide).
export function bakeGroup(group, skip = () => false, byColor = false) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), rel = new THREE.Matrix4();
  const by = new Map(), kill = [];
  group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let q = o; q && q !== group; q = q.parent) if (skip(q) || !q.visible) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const a of Object.keys(g.attributes)) if (a !== "position" && a !== "normal") g.deleteAttribute(a);
    g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
    const key = byColor ? o.material.type + o.material.color.getHex() : o.material;
    if (!by.has(key)) by.set(key, { mat: o.material, list: [] });
    by.get(key).list.push(g); kill.push(o);
  });
  if (kill.length < 2) return;
  for (const o of kill) o.parent.remove(o);
  for (const { mat, list } of by.values()) { const m = new THREE.Mesh(list.length > 1 ? mergeGeometries(list) : list[0], mat); m.castShadow = true; group.add(m); }
}

// makes the model for an owned vehicle (or a showroom one): returns { root, body, wheels, ... }
// opts.keepRider: leave the rider's arms and legs movable; opts.driver: who drives (a look from LOOKS)
export function buildCar(car, opts = {}) {
  mats();
  const v = vehicleById(car.id);
  const root = new THREE.Group(), lift = new THREE.Group(), body = new THREE.Group(); root.add(lift); lift.add(body);
  const paint = new THREE.MeshPhongMaterial({ color: car.paint, shininess: 70, specular: 0x666666 });
  const paint2 = new THREE.MeshPhongMaterial({ color: new THREE.Color(car.paint).multiplyScalar(0.7), shininess: 50, specular: 0x444444 });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xd8dde3, shininess: 100, specular: 0xffffff });
  const C = { root, lift, body, paint, paint2, rimMat, wheels: [], seat: V3(0.42, 0.9, 0.2), hitch: V3(0, 0.6, -2.5), len: 4.6, wid: 2.1, hood: null, pipes: [], rider: null, id: car.id, extras: {} };
  BUILD[car.id](C, v);
  // engine upgrade parts, neon glow, rider
  C.scoop = new THREE.Group(); body.add(C.scoop);
  if (C.hood) { bx(C.scoop, 0.7, 0.18, 0.9, C.hood.x, C.hood.y + 0.09, C.hood.z, M.dark); const bl = new THREE.Group(); bl.name = "blower"; C.scoop.add(bl); bx(bl, 0.6, 0.35, 0.6, C.hood.x, C.hood.y + 0.3, C.hood.z + 0.05, M.chrome); bx(bl, 0.5, 0.12, 0.4, C.hood.x, C.hood.y + 0.53, C.hood.z + 0.05, M.dark); }
  C.flames = [];
  for (const p of C.pipes) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), M.flame); f.rotation.x = -Math.PI / 2; f.position.set(p.x, p.y, p.z - 0.4); f.visible = false; body.add(f); C.flames.push(f); const pipe = cy(body, 0.08, 0.4, p.x, p.y, p.z, M.chrome, 8, Math.PI / 2); pipe.name = "pipe"; }
  const ng = new THREE.Mesh(new THREE.PlaneGeometry(C.wid * 1.5, C.len * 1.2), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x3ad0ff }));
  ng.rotation.x = -Math.PI / 2; ng.position.y = 0.06; root.add(ng); C.neon = ng;
  const look = opts.driver || LOOKS.you;
  if (v.open || car.id === "bike" || car.id === "atv") {
    const p = makePerson(look, 0.85); p.pose(v.bike || car.id === "atv" ? "ride" : "sit"); p.root.position.copy(C.seat); body.add(p.root); C.rider = p;
  } else {
    // a little driver you can see through the window
    const p = makePerson(look, 0.7); p.pose("sit"); p.root.position.copy(C.seat); body.add(p.root); C.rider = p;
  }
  if (!opts.keepRider) bakeGroup(C.rider.root, () => false, true);
  const keep = new Set([C.scoop, C.rider.root, ...C.flames, ...(C.lights || []), ...(C.forks || [])]);
  bakeGroup(body, (o) => keep.has(o) || o.name === "pipe" || o.name === "flag");
  root.traverse((o) => { if (o.isMesh && o !== ng) { o.castShadow = true; } });
  applyLook(C, car);
  return C;
}
let GT = null;
function glowTex() {
  if (GT) return GT;
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.9)"); r.addColorStop(0.5, "rgba(255,255,255,0.4)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (GT = new THREE.CanvasTexture(c));
}
const MUD = new THREE.Color(0x5a3d24), tmp = new THREE.Color();
// paint, rims, tires, lift, engine parts, neon (call again after customizing)
export function applyLook(C, car) {
  C.paint.color.set(car.paint).lerp(MUD, Math.min(0.75, car.dirt || 0));
  C.paint2.color.set(car.paint).multiplyScalar(0.7).lerp(MUD, Math.min(0.75, car.dirt || 0));
  C.rimMat.color.set((RIMS.find((r) => r.id === car.rims) || RIMS[0]).c);
  const tk = car.tires === "mud" ? 1.12 : car.tires === "allterrain" ? 1.05 : 1;
  for (const w of C.wheels) {
    w.r = w.r0 * tk; w.spin.scale.set(car.tires === "mud" ? 1.15 : 1, tk, tk); w.knobs.visible = car.tires !== "street";
  }
  C.lift.position.y = (C.wheels[0] ? C.wheels[0].r0 * (tk - 1) : 0) + car.lift * 0.17;
  C.liftY = C.lift.position.y;
  C.scoop.visible = car.engine >= 2; const bl = C.scoop.getObjectByName("blower"); if (bl) bl.visible = car.engine >= 4;
  C.body.traverse((o) => { if (o.name === "pipe") o.visible = car.engine >= 3; });
  C.neon.visible = !!NEONS[car.neon]; if (NEONS[car.neon]) C.neon.material.color.set(NEONS[car.neon]);
  C.engineLv = car.engine;
}
// spin wheels, steer, bounce the wheels onto the ground and lean the bike
export function animateCar(C, st, dt) {
  for (const w of C.wheels) {
    w.spin.rotation.x += (st.speed / w.r) * dt * (st.reverse ? -1 : 1);
    if (w.front) w.pivot.rotation.y = -st.steer * (w.bike ? 0.45 : 0.5); // (steer + = turn right = wheels point to the right side, which is local -x)
    w.pivot.position.y = w.r + (st.wheelDrop ? st.wheelDrop[C.wheels.indexOf(w)] || 0 : 0);
  }
  if (C.forks) for (const f of C.forks) f.rotation.y = -(st.steer || 0) * 0.45;
  // the police light bar: red, blue, red, blue...
  if (C.lights) { const on = st.siren, ph = Math.floor((st.t || performance.now() / 1000) * 7) % 2; C.lights[0].material.color.setHex(on && ph ? 0xff2a2a : 0x6a1a1a); C.lights[1].material.color.setHex(on && !ph ? 0x2a6aff : 0x1a2a6a); }
  const fl = C.engineLv >= 4 && st.boost > 0.6;
  for (const f of C.flames) { f.visible = fl; if (fl) f.scale.setScalar(0.7 + Math.random() * 0.6); }
}

// ---------------------------------------------------------------- each vehicle's shape
const BUILD = {
  pickup(C) {
    const b = C.body, P = C.paint;
    C.len = 5.2; C.wid = 2.1; C.seat.set(0.42, 0.95, 0.3); C.hitch.set(0, 0.62, -2.62); C.hood = V3(0, 1.32, 1.75);
    bx(b, 1.7, 0.3, 4.9, 0, 0.62, 0, M.dark);
    bx(b, 2.0, 0.72, 1.55, 0, 1.0, 1.75, P); bx(b, 2.0, 0.78, 1.7, 0, 1.03, 0.2, P); // hood + cab bottom
    bx(b, 1.86, 0.66, 1.5, 0, 1.7, 0.15, M.glass); bx(b, 1.92, 0.1, 1.45, 0, 2.06, 0.1, P);
    for (const s of [-1, 1]) { bx(b, 0.08, 0.66, 0.1, s * 0.94, 1.7, 0.88, P); bx(b, 0.08, 0.66, 0.1, s * 0.94, 1.7, -0.58, P); }
    bx(b, 1.96, 0.1, 0.12, 0, 1.38, 0.95, P);
    // the bed
    bx(b, 1.8, 0.12, 2.1, 0, 0.85, -1.4, M.trim);
    for (const s of [-1, 1]) bx(b, 0.12, 0.58, 2.2, s * 0.94, 1.08, -1.4, P);
    bx(b, 2.0, 0.58, 0.12, 0, 1.08, -2.47, P); bx(b, 2.0, 0.58, 0.1, 0, 1.08, -0.35, P);
    // bumpers, grille, lights
    bx(b, 2.1, 0.26, 0.24, 0, 0.72, 2.6, M.chrome); bx(b, 2.1, 0.22, 0.2, 0, 0.72, -2.58, M.chrome);
    bx(b, 1.3, 0.42, 0.06, 0, 1.06, 2.53, M.dark); for (const s of [-1, 1]) { bx(b, 0.32, 0.22, 0.06, s * 0.78, 1.14, 2.54, M.light); bx(b, 0.2, 0.3, 0.06, s * 0.88, 1.12, -2.54, M.tail); }
    for (const [x, y, z, w] of [[0.6, 1.2, 2.2, 0.4], [-1.01, 1.0, 0.5, 0.3], [0.7, 1.32, -2.1, 0.5], [-0.4, 1.38, 1.4, 0.35]]) bx(b, w, w * 0.6, 0.04, x, y, z, M.rust, x < -1 ? 0 : -Math.PI / 2 * (y > 1.3 ? 1 : 0), x < -1 ? Math.PI / 2 : 0);
    bx(b, 0.16, 0.16, 0.3, 0, 0.6, -2.72, M.chrome);
    C.pipes.push(V3(-0.7, 0.55, -2.55));
    for (const [x, z, f] of [[0.95, 1.6, 1], [-0.95, 1.6, 1], [0.95, -1.55, 0], [-0.95, -1.55, 0]]) wheel(C, x, z, 0.46, 0.34, f);
  },
  atv(C) {
    const b = C.body, P = C.paint;
    C.len = 2.2; C.wid = 1.3; C.seat.set(0, 0.88, -0.25); C.hitch.set(0, 0.5, -1.15); C.hood = null;
    bx(b, 0.9, 0.35, 1.7, 0, 0.62, 0, M.dark);
    bx(b, 1.2, 0.22, 0.75, 0, 0.92, 0.6, P); bx(b, 1.2, 0.22, 0.7, 0, 0.92, -0.62, P); // fenders
    bx(b, 0.62, 0.3, 0.9, 0, 0.92, -0.1, M.seat); bx(b, 0.5, 0.3, 0.5, 0, 0.98, 0.36, P);
    for (const z of [0.85, -0.85]) { bx(b, 0.9, 0.05, 0.4, 0, 1.1, z, M.trim); }
    tube(b, V3(0, 0.95, 0.5), V3(0, 1.3, 0.62), 0.04, M.trim); tube(b, V3(-0.4, 1.32, 0.6), V3(0.4, 1.32, 0.6), 0.035, M.trim);
    bx(b, 0.3, 0.16, 0.08, 0, 0.95, 0.98, M.light); bx(b, 0.5, 0.18, 0.06, 0, 0.65, 1.02, M.trim);
    C.pipes.push(V3(0.3, 0.7, -0.95));
    for (const [x, z, f] of [[0.55, 0.62, 1], [-0.55, 0.62, 1], [0.55, -0.62, 0], [-0.55, -0.62, 0]]) wheel(C, x, z, 0.36, 0.3, f);
  },
  bike(C) {
    const b = C.body, P = C.paint;
    C.len = 2.1; C.wid = 0.8; C.seat.set(0, 0.92, -0.2); C.hitch = null; C.hood = null;
    // the fork + handlebars turn with the front wheel (a group pivoting on the steering head)
    const fork = new THREE.Group(); fork.position.set(0, 0, 0.62); b.add(fork); C.forks = [fork];
    tube(fork, V3(0, 0.45, 0.13), V3(0, 1.15, -0.12), 0.05, M.chrome);
    tube(b, V3(0, 0.55, -0.1), V3(0, 1.05, 0.45), 0.06, M.trim); tube(b, V3(0, 0.55, -0.1), V3(0, 0.45, -0.75), 0.05, M.trim);
    bx(b, 0.36, 0.3, 0.62, 0, 1.08, 0.2, P); bx(b, 0.3, 0.12, 0.85, 0, 1.0, -0.35, M.seat);
    bx(b, 0.26, 0.08, 0.5, 0, 0.98, 0.8, P, 0.4); bx(b, 0.26, 0.08, 0.6, 0, 1.0, -0.85, P, -0.3); // fenders
    bx(b, 0.32, 0.34, 0.24, 0, 0.6, 0.1, M.trim);
    tube(fork, V3(-0.38, 1.2, -0.12), V3(0.38, 1.2, -0.12), 0.03, M.trim);
    bx(fork, 0.42, 0.34, 0.04, 0, 1.15, 0.13, M.white);
    C.pipes.push(V3(0.18, 0.7, -0.6));
    wheel(C, 0, 0.75, 0.42, 0.16, 1, { bike: true }); wheel(C, 0, -0.75, 0.42, 0.2, 0, { bike: true });
  },
  jeep(C) {
    const b = C.body, P = C.paint;
    C.len = 4.4; C.wid = 2.2; C.seat.set(0.45, 1.15, -0.1); C.hitch.set(0, 0.75, -2.25); C.hood = V3(0, 1.55, 1.35);
    bx(b, 1.7, 0.35, 4.0, 0, 0.82, 0, M.dark);
    bx(b, 1.95, 0.75, 4.0, 0, 1.25, 0, P); bx(b, 1.9, 0.2, 1.4, 0, 1.6, 1.35, P);
    bx(b, 1.7, 0.1, 2.3, 0, 1.62, -0.75, M.seat);
    for (const s of [-1, 1]) { bx(b, 0.45, 0.14, 1.2, s * 1.05, 1.6, 1.3, M.trim); bx(b, 0.45, 0.14, 1.2, s * 1.05, 1.6, -1.35, M.trim); } // fender flares
    bx(b, 1.85, 0.7, 0.07, 0, 2.0, 0.6, M.glass, -0.25); bx(b, 1.9, 0.08, 0.1, 0, 2.36, 0.52, P);
    // roll cage
    for (const s of [-1, 1]) { tube(b, V3(s * 0.88, 1.6, 0.55), V3(s * 0.85, 2.5, 0.2), 0.05, M.dark); tube(b, V3(s * 0.85, 2.5, 0.2), V3(s * 0.85, 2.5, -1.6), 0.05, M.dark); tube(b, V3(s * 0.85, 2.5, -1.6), V3(s * 0.88, 1.6, -1.8), 0.05, M.dark); }
    tube(b, V3(-0.85, 2.5, 0.2), V3(0.85, 2.5, 0.2), 0.05, M.dark); tube(b, V3(-0.85, 2.5, -1.6), V3(0.85, 2.5, -1.6), 0.05, M.dark);
    bx(b, 1.4, 0.16, 0.18, 0, 2.6, 0.2, M.dark); for (let i = 0; i < 5; i++) bx(b, 0.2, 0.1, 0.04, -0.56 + i * 0.28, 2.6, 0.3, M.light);
    bx(b, 2.0, 0.3, 0.3, 0, 0.9, 2.1, M.dark); bx(b, 1.3, 0.5, 0.06, 0, 1.28, 2.01, M.dark); for (const s of [-1, 1]) cy(b, 0.16, 0.06, s * 0.7, 1.3, 2.03, M.light, 10, Math.PI / 2);
    for (let i = 0; i < 6; i++) bx(b, 0.06, 0.42, 0.04, -0.4 + i * 0.16, 1.3, 2.04, M.trim);
    bx(b, 2.0, 0.3, 0.26, 0, 0.9, -2.1, M.dark); for (const s of [-1, 1]) bx(b, 0.18, 0.24, 0.06, s * 0.82, 1.3, -2.02, M.tail);
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14), M.tire); spare.rotation.x = Math.PI / 2; spare.position.set(0, 1.5, -2.2); b.add(spare);
    tube(b, V3(-1.0, 1.5, 1.0), V3(-1.0, 2.5, 0.75), 0.07, M.dark); // snorkel
    C.pipes.push(V3(0.75, 0.75, -2.15));
    for (const [x, z, f] of [[1.0, 1.35, 1], [-1.0, 1.35, 1], [1.0, -1.35, 0], [-1.0, -1.35, 0]]) wheel(C, x, z, 0.56, 0.42, f);
  },
  buggy(C) {
    const b = C.body, P = C.paint;
    C.len = 3.8; C.wid = 2.1; C.seat.set(0, 0.85, -0.15); C.hitch.set(0, 0.55, -1.95); C.hood = null;
    bx(b, 1.2, 0.2, 3.2, 0, 0.6, 0, M.dark);
    bx(b, 1.3, 0.3, 1.2, 0, 0.85, 1.25, P, -0.15); bx(b, 1.6, 0.5, 0.9, 0, 0.95, -1.3, P);
    bx(b, 0.6, 0.6, 0.5, 0, 1.0, -0.35, M.seat); bx(b, 0.6, 0.12, 0.6, 0, 0.72, 0, M.seat);
    const cage = [[V3(-0.65, 0.7, 0.75), V3(-0.55, 1.95, 0.1)], [V3(0.65, 0.7, 0.75), V3(0.55, 1.95, 0.1)], [V3(-0.55, 1.95, 0.1), V3(-0.6, 1.9, -0.8)], [V3(0.55, 1.95, 0.1), V3(0.6, 1.9, -0.8)], [V3(-0.6, 1.9, -0.8), V3(-0.7, 0.75, -1.2)], [V3(0.6, 1.9, -0.8), V3(0.7, 0.75, -1.2)], [V3(-0.55, 1.95, 0.1), V3(0.55, 1.95, 0.1)], [V3(-0.6, 1.9, -0.8), V3(0.6, 1.9, -0.8)], [V3(-0.65, 0.7, 0.75), V3(-0.4, 0.6, 1.8)], [V3(0.65, 0.7, 0.75), V3(0.4, 0.6, 1.8)]];
    for (const [a, c] of cage) tube(b, a, c, 0.05, M.trim);
    bx(b, 0.8, 0.5, 0.6, 0, 1.0, -1.65, M.trim); cy(b, 0.1, 0.5, 0.25, 1.3, -1.7, M.chrome); cy(b, 0.1, 0.5, -0.25, 1.3, -1.7, M.chrome);
    tube(b, V3(0.6, 1.9, -0.8), V3(0.7, 3.4, -1.0), 0.015, M.trim); const flag = bx(b, 0.02, 0.35, 0.5, 0.7, 3.25, -1.25, M.tail); flag.name = "flag";
    for (const s of [-1, 1]) cy(b, 0.13, 0.05, s * 0.4, 0.9, 1.85, M.light, 10, Math.PI / 2);
    C.pipes.push(V3(0.35, 0.9, -1.95), V3(-0.35, 0.9, -1.95));
    for (const [x, z, f, r] of [[0.98, 1.3, 1, 0.46], [-0.98, 1.3, 1, 0.46], [1.0, -1.25, 0, 0.54], [-1.0, -1.25, 0, 0.54]]) wheel(C, x, z, r, f ? 0.32 : 0.46, f);
  },
  sports(C) {
    const b = C.body, P = C.paint;
    C.len = 4.5; C.wid = 2.0; C.seat.set(0.4, 0.12, -0.2); C.hitch = null; C.hood = V3(0, 0.85, 1.3);
    bx(b, 1.95, 0.42, 4.4, 0, 0.55, 0, P);
    bx(b, 1.9, 0.16, 1.3, 0, 0.82, 1.4, P, 0.08); bx(b, 1.8, 0.2, 0.5, 0, 0.5, 2.25, P, 0.3);
    bx(b, 1.6, 0.42, 1.7, 0, 0.98, -0.3, M.glass); bx(b, 1.5, 0.08, 1.2, 0, 1.2, -0.35, P);
    bx(b, 1.7, 0.26, 1.2, 0, 0.84, -1.6, P, -0.1);
    for (const s of [-1, 1]) { bx(b, 0.06, 0.18, 2.2, s * 0.99, 0.6, 0, M.white); bx(b, 0.12, 0.25, 0.6, s * 0.98, 0.55, -1.05, M.dark); }
    tube(b, V3(-0.6, 0.95, -2.0), V3(-0.6, 1.3, -2.1), 0.05, M.dark); tube(b, V3(0.6, 0.95, -2.0), V3(0.6, 1.3, -2.1), 0.05, M.dark);
    bx(b, 2.0, 0.08, 0.5, 0, 1.33, -2.12, P, 0.1); bx(b, 0.06, 0.3, 0.55, -1.0, 1.28, -2.12, M.dark); bx(b, 0.06, 0.3, 0.55, 1.0, 1.28, -2.12, M.dark);
    for (const s of [-1, 1]) { bx(b, 0.45, 0.1, 0.06, s * 0.65, 0.68, 2.22, M.light, 0.3); bx(b, 0.5, 0.1, 0.06, s * 0.6, 0.66, -2.21, M.tail); }
    bx(b, 1.2, 0.18, 0.06, 0, 0.42, 2.38, M.dark);
    C.pipes.push(V3(0.35, 0.4, -2.2), V3(-0.35, 0.4, -2.2));
    for (const [x, z, f] of [[0.88, 1.42, 1], [-0.88, 1.42, 1], [0.88, -1.42, 0], [-0.88, -1.42, 0]]) wheel(C, x, z, 0.38, 0.32, f);
  },
  hauler(C) {
    const b = C.body, P = C.paint;
    C.len = 7.4; C.wid = 2.5; C.seat.set(0.55, 1.75, 2.0); C.hitch.set(0, 1.05, -2.9); C.hood = V3(0, 2.05, 3.25);
    bx(b, 1.6, 0.4, 7.0, 0, 0.95, -0.1, M.dark);
    bx(b, 2.3, 1.0, 1.6, 0, 1.55, 3.0, P); bx(b, 2.4, 2.2, 1.9, 0, 2.2, 1.55, P); // hood + cab
    bx(b, 2.2, 0.85, 0.08, 0, 2.75, 2.52, M.glass, -0.08); for (const s of [-1, 1]) bx(b, 0.06, 0.7, 0.9, s * 1.21, 2.7, 1.8, M.glass);
    bx(b, 2.3, 1.8, 1.4, 0, 2.0, 0.05, P); bx(b, 2.42, 0.3, 3.4, 0, 3.35, 0.9, P2(C));
    bx(b, 1.5, 0.9, 0.1, 0, 1.55, 3.82, M.chrome); for (let i = 0; i < 6; i++) bx(b, 1.4, 0.04, 0.12, 0, 1.2 + i * 0.14, 3.85, M.dark);
    bx(b, 2.5, 0.35, 0.3, 0, 0.95, 3.85, M.chrome); for (const s of [-1, 1]) { bx(b, 0.34, 0.24, 0.06, s * 0.95, 1.5, 3.82, M.light); cy(b, 0.12, 3.2, s * 1.3, 2.9, 0.75, M.chrome, 8); bx(b, 0.4, 0.5, 1.4, s * 1.25, 0.9, 0.9, M.chrome); }
    bx(b, 2.2, 0.3, 3.2, 0, 1.2, -1.6, M.trim); cy(b, 0.7, 0.12, 0, 1.35, -1.4, M.dark, 16);
    for (const s of [-1, 1]) { bx(b, 0.3, 0.2, 0.06, s * 1.05, 1.0, -3.2, M.tail); bx(b, 0.7, 0.6, 1.9, s * 1.1, 1.2, -1.8, M.dark); }
    C.pipes.push(V3(1.3, 4.4, 0.75), V3(-1.3, 4.4, 0.75));
    for (const [x, z, f] of [[1.08, 3.0, 1], [-1.08, 3.0, 1], [1.08, -1.2, 0], [-1.08, -1.2, 0], [1.08, -2.45, 0], [-1.08, -2.45, 0]]) wheel(C, x, z, 0.6, 0.46, f);
  },
  monster(C) {
    const b = C.body, P = C.paint;
    C.len = 5.4; C.wid = 3.2; C.seat.set(0.45, 2.35, 0.2); C.hitch.set(0, 1.2, -2.7); C.hood = V3(0, 2.75, 1.6);
    bx(b, 1.6, 0.4, 4.6, 0, 1.25, 0, M.dark);
    for (const z of [1.55, -1.55]) { bx(b, 2.4, 0.18, 0.3, 0, 1.15, z, M.trim); for (const s of [-1, 1]) { tube(b, V3(s * 0.7, 1.2, z + 0.2), V3(s * 1.0, 2.2, z + 0.1), 0.09, M.chrome); tube(b, V3(s * 0.7, 1.2, z - 0.2), V3(s * 1.0, 2.2, z - 0.1), 0.09, M.chrome); } }
    bx(b, 2.2, 0.75, 4.6, 0, 2.4, 0, P); bx(b, 2.1, 0.75, 1.6, 0, 3.1, 0.0, M.glass); bx(b, 2.15, 0.1, 1.5, 0, 3.5, 0, P);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) bx(b, 0.04, 0.22, 0.8 - i * 0.15, s * 1.11, 2.35 + (i % 2) * 0.12, 1.2 - i * 0.6, [M.tail, M.flame][i % 2]); // flame stripes
    bx(b, 2.3, 0.3, 0.3, 0, 2.1, 2.35, M.chrome); bx(b, 2.3, 0.3, 0.3, 0, 2.1, -2.35, M.chrome);
    for (const s of [-1, 1]) { bx(b, 0.34, 0.22, 0.06, s * 0.75, 2.5, 2.31, M.light); bx(b, 0.3, 0.28, 0.06, s * 0.85, 2.5, -2.31, M.tail); }
    bx(b, 1.6, 0.14, 0.2, 0, 3.6, 0.6, M.dark); for (let i = 0; i < 4; i++) bx(b, 0.24, 0.1, 0.04, -0.45 + i * 0.3, 3.6, 0.72, M.light);
    C.pipes.push(V3(0.8, 1.5, -2.5));
    for (const [x, z, f] of [[1.45, 1.6, 1], [-1.45, 1.6, 1], [1.45, -1.6, 0], [-1.45, -1.6, 0]]) wheel(C, x, z, 1.05, 0.85, f);
  },
  hyper(C) {
    const b = C.body, P = C.paint;
    C.len = 4.7; C.wid = 2.1; C.seat.set(0.38, 0.0, -0.15); C.hitch = null; C.hood = V3(0, 0.78, -1.5);
    bx(b, 2.05, 0.36, 4.6, 0, 0.48, 0, P); bx(b, 1.9, 0.14, 1.5, 0, 0.7, 1.4, P, 0.12); bx(b, 1.9, 0.2, 0.6, 0, 0.42, 2.3, P, 0.35);
    bx(b, 1.5, 0.36, 1.9, 0, 0.84, -0.2, M.glass); bx(b, 1.3, 0.06, 1.1, 0, 1.03, -0.3, P);
    bx(b, 1.8, 0.24, 1.4, 0, 0.72, -1.55, P, -0.08);
    for (const s of [-1, 1]) { bx(b, 0.14, 0.24, 1.0, s * 1.02, 0.5, -0.6, M.dark); bx(b, 0.04, 0.05, 3.6, s * 1.03, 0.36, 0, M.glow); }
    tube(b, V3(-0.7, 0.85, -2.05), V3(-0.7, 1.45, -2.2), 0.05, M.dark); tube(b, V3(0.7, 0.85, -2.05), V3(0.7, 1.45, -2.2), 0.05, M.dark);
    bx(b, 2.2, 0.08, 0.6, 0, 1.48, -2.22, P, 0.12); for (const s of [-1, 1]) bx(b, 0.06, 0.34, 0.66, s * 1.1, 1.4, -2.22, M.dark);
    bx(b, 1.9, 0.06, 0.06, 0, 0.62, -2.3, M.tail); for (const s of [-1, 1]) bx(b, 0.55, 0.06, 0.06, s * 0.6, 0.58, 2.38, M.glow);
    bx(b, 1.8, 0.14, 0.4, 0, 0.3, -2.3, M.dark);
    C.pipes.push(V3(0.2, 0.42, -2.35), V3(-0.2, 0.42, -2.35));
    for (const [x, z, f] of [[0.92, 1.45, 1], [-0.92, 1.45, 1], [0.92, -1.45, 0], [-0.92, -1.45, 0]]) wheel(C, x, z, 0.38, 0.36, f);
  },
};
function P2(C) { return C.paint2; }
// a police car: white doors, a push bar and a red + blue light bar on the roof
function police(C, fast) {
  const b = C.body, P = C.paint, W = M.white;
  C.len = 4.8; C.wid = 2.1; C.seat.set(0.42, 0.25, -0.1); C.hitch = null; C.hood = null;
  const lo = fast ? 0.48 : 0.62, top = fast ? 1.2 : 1.55;
  bx(b, 2.0, 0.5, 4.7, 0, lo, 0, P);
  bx(b, 1.96, 0.18, 1.3, 0, lo + 0.3, 1.55, P, fast ? 0.1 : 0.04);
  bx(b, 2.02, 0.42, 1.9, 0, lo + 0.02, -0.1, fast ? M.dark : W); // doors
  bx(b, 1.7, top - lo - 0.25, 2.1, 0, (lo + top) / 2 + 0.05, -0.3, M.glass); bx(b, 1.72, 0.08, 1.7, 0, top + 0.02, -0.35, P);
  bx(b, 1.9, 0.26, 1.1, 0, lo + 0.3, -1.85, P);
  // light bar
  bx(b, 1.4, 0.12, 0.34, 0, top + 0.1, -0.35, M.dark);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x6a1a1a })); red.position.set(-0.36, top + 0.22, -0.35); b.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x1a2a6a })); blue.position.set(0.36, top + 0.22, -0.35); b.add(blue);
  C.lights = [red, blue];
  // push bar, lights, a star on the door
  bx(b, 1.6, 0.36, 0.14, 0, lo - 0.05, 2.42, M.dark); for (const s of [-1, 1]) { bx(b, 0.1, 0.5, 0.1, s * 0.6, lo, 2.4, M.dark); bx(b, 0.42, 0.14, 0.06, s * 0.68, lo + 0.12, 2.36, M.light); bx(b, 0.42, 0.14, 0.06, s * 0.68, lo + 0.12, -2.36, M.tail); }
  for (const s of [-1, 1]) bx(b, 0.04, 0.3, 0.3, s * 1.02, lo + 0.05, -0.1, new THREE.MeshBasicMaterial({ color: 0xffd23a }));
  C.pipes.push(V3(0.4, lo - 0.1, -2.35));
  const r = fast ? 0.38 : 0.42;
  for (const [x, z, f] of [[0.9, 1.5, 1], [-0.9, 1.5, 1], [0.9, -1.45, 0], [-0.9, -1.45, 0]]) wheel(C, x, z, r, 0.34, f);
}
BUILD.cruiser = (C) => police(C, false);
BUILD.interceptor = (C) => police(C, true);

// ---------------------------------------------------------------- the broken-down car for the tow job (no driver)
export function brokenCar(color = 0x8a9aa8) {
  const C = buildCar({ id: "sports", paint: color, rims: "black", tires: "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0.3 });
  C.body.remove(C.rider.root); C.rider = null;
  const smoke = new THREE.Group(); C.body.add(smoke); C.smoke = smoke;
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshLambertMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.6 })); s.position.set(0, 1 + i * 0.4, 1.5); smoke.add(s); }
  return C;
}
