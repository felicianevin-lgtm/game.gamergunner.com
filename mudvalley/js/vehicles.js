// MUD VALLEY RP: every ride you can buy, how it drives, and the 3D model (with paint, tires, lift, engine parts and neon).
// Models face +z (forward). Wheels touch the ground at y = 0.
import * as THREE from "/create/vendor/three.module.js";
import { makePerson, LOOKS } from "./character.js";
import { mergeGeometries, toCreasedNormals } from "/create/vendor/BufferGeometryUtils.js";

// top = top speed on the road (m/s), acc = how fast it speeds up, grip = how well it sticks, turn = how fast it turns,
// off = how well it does on dirt / grass / mud (1 = great), size = how much room it takes on a trailer, tow = what trailers it can pull,
// crawl = how well it climbs steep hills (1 = a mountain goat, 0.2 = slides right back down)
export const VEHICLES = [
  { id: "pickup", name: "Rusty Pickup", price: 0, top: 30, acc: 9, grip: 7, turn: 1.9, off: { dirt: 0.8, grass: 0.72, mud: 0.5 }, size: 2, tow: 2, color: 0xc8502a, engine: 70, crawl: 0.55, desc: "Your first truck! A bit rusty, but it can pull a trailer anywhere." },
  { id: "atv", name: "Trail Buddy ATV", price: 1200, top: 23, acc: 12, grip: 8, turn: 2.5, off: { dirt: 1, grass: 0.95, mud: 0.82 }, size: 1, tow: 1, color: 0x3aa04a, engine: 120, open: true, quad: true, crawl: 0.9, desc: "A four-wheeler that LOVES mud and trails. Fits on a small trailer." },
  { id: "bike", name: "Dirt Rocket", price: 1800, top: 27, acc: 14, grip: 7, turn: 2.6, off: { dirt: 1, grass: 0.95, mud: 0.7 }, size: 1, tow: 0, color: 0xff7a1a, engine: 160, open: true, bike: true, crawl: 0.88, desc: "A dirt bike! Super quick, great for jumps and pizza delivery." },
  { id: "sportquad", name: "Sand Viper Sport Quad", price: 3500, top: 30, acc: 15, grip: 7.5, turn: 2.6, off: { dirt: 1, grass: 0.95, mud: 0.75 }, size: 1, tow: 0, color: 0xe0203a, engine: 165, open: true, quad: true, crawl: 0.86, desc: "A light, fast sport quad. Wheelies (T) and burnouts (hold W + S)!" },
  { id: "bigquad", name: "Big Muddy Quad", price: 4800, top: 24, acc: 12, grip: 8, turn: 2.3, off: { dirt: 1, grass: 1, mud: 0.95 }, size: 1, tow: 1, color: 0x4a6a2a, engine: 110, open: true, quad: true, crawl: 0.97, desc: "A big 4x4 quad with racks and huge mud tires. Nothing stops it." },
  { id: "bike450", name: "Thumper 450", price: 4200, top: 33, acc: 17, grip: 7.2, turn: 2.6, off: { dirt: 1, grass: 0.95, mud: 0.72 }, size: 1, tow: 0, color: 0x2a7ad0, engine: 175, open: true, bike: true, crawl: 0.9, desc: "A race dirt bike. Faster than the Dirt Rocket and SUPER good at wheelies." },
  { id: "pitbike", name: "Pit Rat 110 Pit Bike", price: 900, top: 19, acc: 11, grip: 7, turn: 2.9, off: { dirt: 1, grass: 0.95, mud: 0.7 }, size: 1, tow: 0, color: 0xffd23a, engine: 230, open: true, bike: true, crawl: 0.85, desc: "A little 110cc pit bike. Small, light and SO much fun in the dirt." },
  { id: "bike125", name: "Scrambler 125 Dirt Bike", price: 1400, top: 24, acc: 13, grip: 7, turn: 2.7, off: { dirt: 1, grass: 0.95, mud: 0.7 }, size: 1, tow: 0, color: 0xe0203a, engine: 200, open: true, bike: true, crawl: 0.87, desc: "A 125cc two-stroke dirt bike. Between a pit bike and a full-size bike: light, snappy, great on trails." },
  { id: "sport300", name: "Viper 300 Sport Bike", price: 6500, top: 42, acc: 16, grip: 8.5, turn: 2.5, off: { dirt: 0.45, grass: 0.4, mud: 0.2 }, size: 1, tow: 0, color: 0x3ac04a, engine: 215, open: true, bike: true, crawl: 0.3, desc: "A real street sport bike with a full fairing. Quick and nimble on roads... NOT for mud!" },
  { id: "super1000", name: "Thunder 1000 Superbike", price: 19000, top: 60, acc: 22, grip: 9.2, turn: 2.4, off: { dirt: 0.35, grass: 0.3, mud: 0.15 }, size: 1, tow: 0, color: 0x1a4ad0, engine: 240, open: true, bike: true, crawl: 0.25, desc: "A 1000cc superbike. The fastest thing on two wheels. Hold on tight!" },
  { id: "minitruck", name: "Mini Hauler", price: 2500, top: 24, acc: 8, grip: 7, turn: 2.3, off: { dirt: 0.85, grass: 0.8, mud: 0.6 }, size: 1, tow: 1, color: 0xf4f4f4, engine: 150, crawl: 0.6, desc: "A tiny work truck. Cheap, cute, and it even fits on a small trailer." },
  { id: "jeep", name: "Mud Hog 4x4", price: 5500, top: 31, acc: 10, grip: 7.5, turn: 2.0, off: { dirt: 0.97, grass: 0.93, mud: 0.86 }, size: 2, tow: 2, color: 0x2a7ad0, engine: 85, open: true, crawl: 0.95, desc: "Big tires, a snorkel and a light bar. Goes anywhere, pulls anything." },
  { id: "buggy", name: "Dune Hopper", price: 8000, top: 37, acc: 13.5, grip: 6.5, turn: 2.3, off: { dirt: 1, grass: 0.9, mud: 0.66 }, size: 2, tow: 1, color: 0xffd23a, engine: 140, open: true, air: 0.85, crawl: 0.75, desc: "A light dune buggy that flies off jumps. Fast on dirt!" },
  { id: "sports", name: "Street Comet", price: 12000, top: 50, acc: 16, grip: 9, turn: 2.1, off: { dirt: 0.42, grass: 0.35, mud: 0.2 }, size: 2, tow: 0, color: 0xe0203a, engine: 110, crawl: 0.25, desc: "A super fast sports car. Zooms on roads... but hates dirt and mud!" },
  { id: "ranch", name: "Ranch Hand Dually", price: 9500, top: 32, acc: 9.5, grip: 7.5, turn: 1.8, off: { dirt: 0.82, grass: 0.75, mud: 0.55 }, size: 2, tow: 2, color: 0x7a1a1a, engine: 72, crawl: 0.6, desc: "A big crew-cab pickup with double back wheels. Built for towing heavy trailers." },
  { id: "trailboss", name: "Trail Boss Lifted 4x4", price: 16000, top: 32, acc: 10.5, grip: 7.5, turn: 1.9, off: { dirt: 0.98, grass: 0.95, mud: 0.88 }, size: 2, tow: 2, color: 0x1a1a22, engine: 80, crawl: 0.95, desc: "A lifted pickup with giant tires, a light bar and a bull bar. Climbs like a goat." },
  { id: "dumper", name: "Gravel Dumper", price: 18000, top: 26, acc: 6, grip: 7, turn: 1.5, off: { dirt: 0.78, grass: 0.66, mud: 0.5 }, size: 9, tow: 2, color: 0xffb020, engine: 48, crawl: 0.45, desc: "A big 6-wheel dump truck from the construction site. Loud, slow and HUGE." },
  { id: "prerunner", name: "Desert Runner Trophy Truck", price: 28000, top: 42, acc: 14, grip: 7, turn: 2.1, off: { dirt: 1, grass: 0.95, mud: 0.72 }, size: 2, tow: 0, color: 0xff7a1a, engine: 105, air: 0.85, crawl: 0.82, desc: "A race truck with long springs. Flies over bumps and jumps at full speed." },
  { id: "swamp", name: "Swamp Crawler 6x6", price: 32000, top: 28, acc: 9, grip: 8, turn: 1.6, off: { dirt: 1, grass: 1, mud: 1 }, size: 9, tow: 2, color: 0x4a5a3a, engine: 55, crawl: 1, desc: "A giant 6-wheel-drive army-style truck. Mud, rivers, mountains... nothing stops it." },
  { id: "hauler", name: "Big Bertha Hauler", price: 15000, top: 30, acc: 6.5, grip: 7, turn: 1.5, off: { dirt: 0.72, grass: 0.62, mud: 0.42 }, size: 9, tow: 2, color: 0x6a3ad0, engine: 50, crawl: 0.35, desc: "A giant semi truck. Slow to start, but pulls the big flatbed full of cars." },
  { id: "crew", name: "Ridgeback 1500 Crew Cab (7 ft bed)", price: 14000, top: 38, acc: 11, grip: 8, turn: 1.9, off: { dirt: 0.85, grass: 0.78, mud: 0.58 }, size: 2, tow: 2, color: 0x9aa0aa, engine: 78, crawl: 0.62, desc: "A big, modern full-size crew cab pickup. Chrome grille, four doors, tows anything." },
  { id: "foxhatch", name: "Street Fox 5.0 Hatch", price: 11000, top: 46, acc: 15, grip: 8.5, turn: 2.2, off: { dirt: 0.45, grass: 0.38, mud: 0.22 }, size: 2, tow: 0, color: 0xe0203a, engine: 105, crawl: 0.3, desc: "A boxy 80s V8 hatchback. Light, loud and fast. Burnouts all day!" },
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
// trucks with a bed a dirt bike or quad can ride in (bed floor height + the middle of the bed, in the truck's own space)
// (front/back = where the bed starts + ends: the flatbed mod swaps everything in there for a steel deck)
export const BEDS = { crew: { y: 1.1, z: -2.55, front: -1.48, back: -3.62 }, pickup: { y: 1.02, z: -1.45, front: -0.42, back: -2.56 }, minitruck: { y: 0.82, z: -0.65, front: 0.44, back: -1.75 },
  ranch: { y: 1.12, z: -1.95, front: -0.8, back: -3.14 }, trailboss: { y: 1.5, z: -1.7, front: -0.66, back: -2.8 } };
export const FLATBED_PRICE = 800;
// the flatbed mod: take the bed off, bolt on a flat steel deck with a headache rack, stake pockets and toolboxes
function flatbed(C, B) {
  const b = C.body, keep = [], box = new THREE.Box3();
  b.updateMatrixWorld(true);
  for (const o of b.children) {
    if (!o.isMesh) { keep.push(o); continue; }
    box.setFromObject(o);
    const inBed = box.min.z >= B.back - 0.1 && box.max.z <= B.front + 0.2 && box.min.y > 0.3; // (everything that lives in the bed area, above the frame)
    if (!inBed) keep.push(o);
  }
  b.children.length = 0; for (const o of keep) { b.add(o); }
  const rear = C.wheels.filter((w) => !w.front), wTop = Math.max(...rear.map((w) => w.r0 * 2 * 1.12)) + 0.04;
  const y = Math.max(B.y, wTop), L = B.front - B.back, z = (B.front + B.back) / 2, W = Math.min(2.5, C.wid + 0.05);
  bx(b, W, 0.12, L, 0, y, z, M.deck); bx(b, W + 0.04, 0.1, 0.06, 0, y - 0.01, B.back + 0.03, M.dark); // the deck + its back edge
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) bx(b, 0.08, 0.1, 0.08, s * (W / 2 + 0.02), y, B.front - 0.25 - k * (L - 0.5) / 3, M.dark); // stake pockets
    bx(b, 0.06, 0.12, L, s * (W / 2 + 0.01), y, z, M.dark); // side rails
    bx(b, 0.4, 0.38, Math.min(0.9, L * 0.35), s * (W / 2 - 0.22), y - 0.32, B.front - 0.55, M.dark); // toolboxes under the deck
    bx(b, 0.07, 0.8, 0.07, s * (W / 2 - 0.1), y + 0.46, B.front - 0.06, M.dark); // headache rack posts
    bx(b, 0.12, 0.08, 0.04, s * (W / 2 - 0.2), y - 0.02, B.back - 0.01, M.tail); // taillights
  }
  for (const h of [0.86, 0.6, 0.34]) bx(b, W - 0.2, 0.06, 0.05, 0, y + h, B.front - 0.06, M.dark); // rack bars
  bx(b, W - 0.2, 0.6, 0.02, 0, y + 0.42, B.front - 0.07, M.grate); // the mesh
  C.flatY = y + 0.06;
}
export const PRICES = { paint: 150, rims: 200, neon: 500 };

// how rusty it is (0 = shiny, 1 = crusty). The Rusty Pickup comes rusty.
export const rustOf = (car) => car.rust ?? (car.id === "pickup" ? 1 : 0);
// a fresh owned vehicle
export function newCar(id, uid) {
  const v = vehicleById(id);
  return { uid, id, paint: v.color, rims: "chrome", tires: (v.quad || v.bike) && v.off.dirt > 0.8 || id === "monster" || id === "swamp" ? "mud" : ["jeep", "trailboss", "prerunner"].includes(id) ? "allterrain" : "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0, x: 0, z: 0, yaw: 0, on: null };
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
  return { top: top * car.limit, acc, grip, turn: v.turn, off, crawl, air: v.air ?? 1, bike: !!v.bike, quad: !!v.quad, wheelie: !!(v.bike || v.quad), engine: v.engine * (1 + 0.04 * car.engine) };
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
  M.deck = new THREE.MeshPhongMaterial({ color: 0x8a8d92, shininess: 70, specular: 0x777777 });
  M.liner = new THREE.MeshLambertMaterial({ color: 0x2c2d31 });
  M.smoke = new THREE.MeshPhongMaterial({ color: 0x1a2028, transparent: true, opacity: 0.6, shininess: 120, specular: 0x8899aa });
  M.red = new THREE.MeshLambertMaterial({ color: 0xd0302a });
  M.grate = new THREE.MeshLambertMaterial({ color: 0x55585e, transparent: true, opacity: 0.55 });
  M.frame = new THREE.MeshPhongMaterial({ color: 0xa8adb2, shininess: 80, specular: 0x888888 });
  M.fork = new THREE.MeshPhongMaterial({ color: 0xc9a64a, shininess: 90, specular: 0xbbbbbb });
  M.engine = new THREE.MeshPhongMaterial({ color: 0x8a8d92, shininess: 60, specular: 0x666666 });
  M.flame = new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.85, depthWrite: false });
}
function bx(p, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; }
function cy(p, r, h, x, y, z, mat, seg = 10, rx = 0, rz = 0, rTop = r) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); p.add(m); return m; }
const tube = (p, a, b, r, mat) => { const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(m); return m; };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- the real dirt bike model (models/dirtbike.bin)
// a packed, slimmed-down model: the body + the two wheels (each centered on its axle so it can spin).
let BIKE = null;
export async function loadBikeModel() {
  if (BIKE) return BIKE;
  try {
    const buf = await (await fetch(new URL("../models/dirtbike.bin", import.meta.url))).arrayBuffer();
    const n = new DataView(buf).getUint32(0, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))), base = 4 + n;
    const out = { wheels: hdr.wheels, body: [], front: [], back: [] };
    for (const p of hdr.parts) {
      const pos = new Int16Array(buf, base + p.off, p.v * 3), idx = new Uint16Array(buf, base + p.off + p.v * 6, p.i);
      const f = new Float32Array(p.v * 3); for (let i = 0; i < f.length; i++) f[i] = pos[i] / 1000;
      let g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(f, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      g = g.toNonIndexed(); g.computeVertexNormals(); // (flat shading: crisp edges)
      out[p.group].push({ mat: p.mat, geo: g });
    }
    BIKE = out;
  } catch (e) { console.warn("dirt bike model didn't load, using the simple bike", e); }
  return BIKE;
}
// which color of the model is which part
const BIKE_MAT = {
  color_4634441: (C) => C.paint, // the plastics (your paint color)
  color_2829873: () => M.seat, color_2828838: () => M.tire, color_0: (C) => C.rimMat, color_15277357: () => M.chrome,
  color_10988977: () => M.frame, color_12561038: () => M.fork, color_14077624: () => M.engine, color_6383466: () => M.trim, color_16448250: () => M.white,
};
// dirt bike suspension (Mud & Chrome): taller suspension = the whole bike grows, so the wheels always match
export const SUSP = [{ name: "Lowered", k: 0.92, price: 250 }, { name: "Stock", k: 1, price: 0 }, { name: "Tall", k: 1.08, price: 350 }, { name: "Extra tall", k: 1.16, price: 500 }];
function realBike(C, size) {
  const k = size * (SUSP[C.car && C.car.susp != null ? C.car.susp : 1] || SUSP[1]).k;
  C.len = 2.5 * k; C.wid = 0.8 * Math.min(1, k); C.seat.set(0, 0.9 * k, -0.2 * k); C.hitch = null; C.hood = null; bikeModel(C, k); C.realBike = true;
}
function bikeModel(C, sc = 1) {
  const b = C.body;
  for (const p of BIKE.body) { const m = new THREE.Mesh(p.geo, (BIKE_MAT[p.mat] || (() => M.trim))(C)); m.scale.setScalar(sc); b.add(m); }
  for (const k of ["front", "back"]) {
    const w0 = BIKE.wheels[k], w = { x: w0.x * sc, z: w0.z * sc, r: w0.r * sc }, pivot = new THREE.Group(); pivot.position.set(w.x, w.r, w.z);
    const spin = new THREE.Group(); pivot.add(spin); spin.scale.setScalar(sc);
    for (const p of BIKE[k]) { const m = new THREE.Mesh(p.geo, (BIKE_MAT[p.mat] || (() => M.trim))(C)); m.castShadow = true; spin.add(m); }
    const knobs = new THREE.Group(); spin.add(knobs);
    C.root.add(pivot);
    C.wheels.push({ pivot, spin, knobs, x: w.x, z: w.z, r0: w.r, r: w.r, front: k === "front", side: 1, bike: true, model: true });
  }
}

// a car body from its side shape: pts = [z, y] going around the outline (arch: ["arch", z, r] = a wheel arch cut out
// of the bottom edge). w = how wide. Rounded edges (bevel) so it looks like a real car instead of boxes.
function profile(p, pts, w, mat, x = 0, bev = 0.05) {
  const s = new THREE.Shape(); let first = true;
  for (const q of pts) {
    if (q[0] === "arch") { const [, z, r, y0] = q; s.lineTo(z - r, y0); s.absarc(z, y0, r, Math.PI, 0, true); continue; }
    if (first) { s.moveTo(q[0], q[1]); first = false; } else s.lineTo(q[0], q[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, w - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10 });
  const m = new THREE.Mesh(g, mat); m.rotation.y = -Math.PI / 2; m.position.x = x + w / 2 - bev; p.add(m); return m;
}

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
  const rustMat = new THREE.MeshLambertMaterial({ color: 0x8a4a22, transparent: true }); // (scrub it off at Mud & Chrome)
  const C = { root, lift, body, paint, paint2, rimMat, rustMat, wheels: [], seat: V3(0.42, 0.9, 0.2), hitch: V3(0, 0.6, -2.5), len: 4.6, wid: 2.1, hood: null, pipes: [], rider: null, id: car.id, extras: {} };
  C.car = car;
  BUILD[car.id](C, v);
  if (car.flatbed && BEDS[car.id]) flatbed(C, BEDS[car.id]);
  C.rearZ = Math.min(...C.wheels.map((w) => w.z)); // (wheelies tip back around the back wheel)
  // engine upgrade parts, neon glow, rider
  C.scoop = new THREE.Group(); body.add(C.scoop);
  if (C.hood) { bx(C.scoop, 0.7, 0.18, 0.9, C.hood.x, C.hood.y + 0.09, C.hood.z, M.dark); const bl = new THREE.Group(); bl.name = "blower"; C.scoop.add(bl); bx(bl, 0.6, 0.35, 0.6, C.hood.x, C.hood.y + 0.3, C.hood.z + 0.05, M.chrome); bx(bl, 0.5, 0.12, 0.4, C.hood.x, C.hood.y + 0.53, C.hood.z + 0.05, M.dark); }
  C.flames = [];
  for (const p of C.pipes) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), M.flame); f.rotation.x = -Math.PI / 2; f.position.set(p.x, p.y, p.z - 0.4); f.visible = false; body.add(f); C.flames.push(f); const pipe = cy(body, 0.08, 0.4, p.x, p.y, p.z, M.chrome, 8, Math.PI / 2); pipe.name = "pipe"; }
  const ng = new THREE.Mesh(new THREE.PlaneGeometry(C.wid * 1.5, C.len * 1.2), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x3ad0ff }));
  ng.rotation.x = -Math.PI / 2; ng.position.y = 0.06; root.add(ng); C.neon = ng;
  const look = opts.driver || LOOKS.you;
  if (v.open || v.bike || v.quad) {
    const p = makePerson(look, 0.85); p.pose(v.bike || v.quad ? "ride" : "sit"); p.root.position.copy(C.seat); if (C.lean) p.root.rotation.x = C.lean; body.add(p.root); C.rider = p;
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
  const real = C.wheels[0] && C.wheels[0].model; // (the real bike already has knobby tires)
  for (const w of C.wheels) {
    if (w.model) continue;
    w.r = w.r0 * tk; w.spin.scale.set(car.tires === "mud" ? 1.15 : 1, tk, tk); w.knobs.visible = car.tires !== "street";
  }
  C.lift.position.y = (C.wheels[0] && !real ? C.wheels[0].r0 * (tk - 1) : 0) + (C.wheels[0] && C.wheels[0].bike ? 0 : car.lift) * 0.17; // (dirt bikes don't get lifted)
  C.liftY = C.lift.position.y;
  C.scoop.visible = car.engine >= 2; const bl = C.scoop.getObjectByName("blower"); if (bl) bl.visible = car.engine >= 4;
  C.body.traverse((o) => { if (o.name === "pipe") o.visible = car.engine >= 3; });
  C.neon.visible = !!NEONS[car.neon]; if (NEONS[car.neon]) C.neon.material.color.set(NEONS[car.neon]);
  C.engineLv = car.engine;
  const rust = rustOf(car); C.rustMat.opacity = rust; C.rustMat.visible = rust > 0.02;
}
// spin wheels, steer, bounce the wheels onto the ground and lean the bike
export function animateCar(C, st, dt) {
  for (const w of C.wheels) {
    w.spin.rotation.x += ((st.burn && !w.front ? 34 : st.speed) / w.r) * dt * (st.reverse && !st.burn ? -1 : 1); // (burnout: the back wheel spins like crazy)
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

// ================================================================ realistic bodies
// A body is "lofted": a cross-section (the car cut like a loaf of bread) every 10 cm from the front to the back, joined
// up. The sides lean in toward the roof, the wheel arches are cut out of the bottom, the windows wrap around, and the
// lighting keeps sharp creases while the curves stay smooth. o (meters; z = forward, 0 = the middle of the car):
//  zf / zb: the front / back end, w: half width at the belt line, b: bottom of the body, s: the belt line (window bottoms)
//  hood: hood height at the very front, cowl: hood height at the windshield, roof: roof height
//  ws / wt: windshield bottom / top (z), rb: where the roof ends, rg + deck: back window bottom + trunk height (cars);
//  trucks leave deck out (the cab just ends). roofW / hoodW: half widths up top. wheels: [[z, r]] -> wheel arches.
function shell(C, o, mats) {
  const w = o.w, wb0 = o.wb ?? w - 0.03, nose = o.nose ?? 0.25, roofW = o.roofW ?? w * 0.84, hoodW = o.hoodW ?? w * 0.95, truck = o.deck == null;
  const top = truck ? [[o.zf, o.hood - (o.drop ?? 0.1)], [o.zf - nose, o.hood], [o.ws, o.cowl], [o.wt, o.roof], [o.rb, o.roof], [o.zb, o.roof - 0.03]]
    : [[o.zf, o.hood - (o.drop ?? 0.1)], [o.zf - nose, o.hood], [o.ws, o.cowl], [o.wt, o.roof], [o.rb, o.roof], [o.rg, o.deck], [o.zb + nose * 0.6, o.deck], [o.zb, o.deck - 0.08]];
  const lerpTab = (tab, z) => { for (let i = 0; i < tab.length - 1; i++) { const [z0, v0] = tab[i], [z1, v1] = tab[i + 1]; if (z <= z0 && z >= z1) return z0 === z1 ? v1 : v0 + (v1 - v0) * ((z0 - z) / (z0 - z1)); } return tab[z > tab[0][0] ? 0 : tab.length - 1][1]; };
  const zs = new Set([o.zf, o.zb]); for (let z = o.zf; z > o.zb; z -= 0.1) zs.add(+z.toFixed(3));
  for (const [z] of top) zs.add(z); for (const [zw, r] of o.wheels || []) for (let k = -12; k <= 12; k++) zs.add(+(zw + (k / 12) * (r + 0.08)).toFixed(3));
  const Z = [...zs].filter((z) => z <= o.zf && z >= o.zb).sort((a, b) => b - a);
  const cab0 = o.ws + 1e-3, cab1 = (truck ? o.zb : o.rg) - 1e-3, clamp01 = (v) => Math.max(0, Math.min(1, v));
  const S = Z.map((z) => {
    const t = lerpTab(top, z), g = z <= cab0 && z >= cab1, end = clamp01(Math.min(o.zf - z, z - o.zb) / Math.max(0.05, nose));
    let bot = o.b; for (const [zw, r] of o.wheels || []) { const R = r + 0.08, d = z - zw; if (Math.abs(d) < R) bot = Math.max(bot, r + Math.sqrt(R * R - d * d)); }
    const ww = w - (1 - end) * (o.taper ?? 0.07), s = Math.min(o.s - (1 - end) * 0.05, t - 0.03); bot = Math.min(bot, s - 0.1);
    const up = g ? clamp01((t - o.cowl) / Math.max(0.05, o.roof - o.cowl)) : 0, wt = Math.min(hoodW + (roofW - hoodW) * up, ww - 0.02);
    return { z, t, g, b: bot, s, w: ww, wb: Math.min(wb0, ww) - (1 - end) * 0.02, wt };
  });
  const steep = (A, B) => Math.abs(A.t - B.t) / Math.abs(A.z - B.z) > 0.38;
  const tall = (q) => q.t - q.s > 0.22;
  return loft(C.body, S, (q) => { const r2 = Math.min(0.07, (q.t - q.s) * 0.35 + 0.012), r1 = 0.05;
    return [[q.wb - r1, q.b], [q.wb, q.b + r1], [q.w, q.s], [q.wt, q.t - r2], [q.wt - r2, q.t], [-(q.wt - r2), q.t], [-q.wt, q.t - r2], [-q.w, q.s], [-q.wb, q.b + r1], [-(q.wb - r1), q.b]]; },
  (k, A, B) => (k === 9 ? 2 : k === 2 || k === 6 ? (A.g && B.g && tall(A) && tall(B) ? 1 : 0) : k >= 3 && k <= 5 ? ((A.g || B.g) && steep(A, B) && (k === 4 || tall(A) || tall(B)) ? 1 : 0) : 0),
  mats || [C.paint, M.glass, M.dark], true);
}
// a pickup bed (an open U: outside skin, rail caps, a liner inside) with arches for the back wheels
function bedShell(C, o) {
  const zs = new Set([o.zf, o.zb]); for (let z = o.zf; z > o.zb; z -= 0.1) zs.add(+z.toFixed(3));
  for (const [zw, r] of o.wheels || []) for (let k = -12; k <= 12; k++) zs.add(+(zw + (k / 12) * (r + 0.08)).toFixed(3));
  const Z = [...zs].filter((z) => z <= o.zf && z >= o.zb).sort((a, b) => b - a), w = o.w, wb = w - 0.03, i = w - 0.09;
  const S = Z.map((z) => { let bot = o.b; for (const [zw, r] of o.wheels || []) { const R = r + 0.08, d = z - zw; if (Math.abs(d) < R) bot = Math.max(bot, r + Math.sqrt(R * R - d * d)); } return { z, b: Math.min(bot, o.floor - 0.04) }; });
  const mats = [C.paint, M.trim, M.dark, M.liner];
  return loft(C.body, S, (q) => [[wb - 0.05, q.b], [wb, q.b + 0.05], [w, o.rail], [i, o.rail], [i, o.floor], [-i, o.floor], [-i, o.rail], [-w, o.rail], [-wb, q.b + 0.05], [-(wb - 0.05), q.b]],
    (k) => (k === 9 ? 2 : k === 2 || k === 6 ? 1 : k >= 3 && k <= 5 ? 3 : 0), mats, false);
}
// join the cross-sections into meshes (one per material), smooth curves + sharp creases
function loft(parent, S, sec, matOf, mats, caps) {
  const P = S.map(sec), n = P[0].length, buf = mats.map(() => []);
  const push = (arr, x, y, z) => arr.push(x, y, z);
  for (let i = 0; i < S.length - 1; i++) for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n, a = P[i][k], b = P[i][k2], c = P[i + 1][k], d = P[i + 1][k2], z0 = S[i].z, z1 = S[i + 1].z, B = buf[matOf(k, S[i], S[i + 1])];
    push(B, a[0], a[1], z0); push(B, c[0], c[1], z1); push(B, b[0], b[1], z0); push(B, b[0], b[1], z0); push(B, c[0], c[1], z1); push(B, d[0], d[1], z1);
  }
  if (caps) for (const [j, f] of [[0, 1], [S.length - 1, -1]]) {
    const pts = P[j], z = S[j].z, cx = 0, cy = pts.reduce((s, p) => s + p[1], 0) / n;
    for (let k = 0; k < n; k++) { const p = pts[k], q = pts[(k + 1) % n]; if (f > 0) { push(buf[0], cx, cy, z); push(buf[0], p[0], p[1], z); push(buf[0], q[0], q[1], z); } else { push(buf[0], cx, cy, z); push(buf[0], q[0], q[1], z); push(buf[0], p[0], p[1], z); } }
  }
  for (let m = 0; m < mats.length; m++) {
    if (!buf[m].length) continue;
    let g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(buf[m], 3)); g = toCreasedNormals(g, 0.6);
    const mesh = new THREE.Mesh(g, mats[m]); mesh.castShadow = true; parent.add(mesh);
  }
  return S;
}
// the body slice closest to z (for putting doors, mirrors, lights on the body)
const at = (S, z) => S.reduce((a, q) => (Math.abs(q.z - z) < Math.abs(a.z - z) ? q : a), S[0]);
// details that make it look real
function seam(C, S, z) { const q = at(S, z); for (const s of [-1, 1]) bx(C.body, 0.012, q.s - q.b - 0.1, 0.025, s * ((q.w + q.wb) / 2 + 0.006), (q.s + q.b) / 2 + 0.04, z, M.dark); }
function handle(C, S, z) { const q = at(S, z); for (const s of [-1, 1]) bx(C.body, 0.04, 0.05, 0.2, s * (q.w + 0.01), q.s - 0.12, z, M.chrome); }
function pillar(C, S, z, mat, wide = 0.12) {
  const q = at(S, z), len = Math.hypot(q.w - q.wt, q.t - q.s), a = Math.atan2(q.w - q.wt, q.t - q.s);
  for (const s of [-1, 1]) bx(C.body, 0.03, len, wide, s * ((q.w + q.wt) / 2 + 0.012), (q.s + q.t) / 2, z, mat || C.paint, 0, 0, s * a);
}
function mirror(C, S, z, big) { const q = at(S, z); for (const s of [-1, 1]) { bx(C.body, 0.06, big ? 0.3 : 0.15, big ? 0.32 : 0.22, s * (q.w + (big ? 0.2 : 0.12)), q.s + (big ? 0.14 : 0.08), z, M.dark); bx(C.body, big ? 0.2 : 0.12, 0.04, 0.05, s * (q.w + 0.06), q.s + 0.04, z + 0.04, M.dark); } }
function flare(C, S, zw, r, mat, thick = 0.06) {
  const q = at(S, zw), R = r + 0.09;
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.TorusGeometry(R, thick, 6, 20, Math.PI), mat || M.trim); f.rotation.y = Math.PI / 2; f.position.set(s * (q.wb + 0.01), r, zw); f.scale.set(1, 1, 1.5); C.body.add(f); }
}
function backGlass(C, S, top = 0.05) { const q = S[S.length - 1], h = q.t - q.s - top - 0.06; bx(C.body, q.wt * 2 - 0.12, h, 0.03, 0, q.s + 0.04 + h / 2, q.z - 0.012, M.glass); }
function truckGrille(C, S, o) { // a big pickup grille: chrome frame, dark mesh, chrome bars
  const z = S[0].z + 0.012, y = o.y, gw = o.w, gh = o.h;
  bx(C.body, gw + 0.1, gh + 0.1, 0.05, 0, y - gh / 2 - 0.05, z, M.chrome); bx(C.body, gw, gh, 0.06, 0, y - gh / 2, z + 0.005, M.dark);
  for (let i = 1; i < (o.bars ?? 3); i++) bx(C.body, gw, 0.04, 0.07, 0, y - gh + (i * gh) / (o.bars ?? 3) - 0.02, z + 0.01, M.chrome);
  if (o.cross) bx(C.body, 0.08, gh, 0.07, 0, y - gh / 2, z + 0.01, M.chrome);
}

// a rounded molded part (quad fenders, a buggy's nose, a seat): its top height goes through tops = [[z, y], ...] front -> back
function pod(C, o, mat) {
  const zs = []; for (let z = o.zf; z > o.zb; z -= 0.06) zs.push(z); zs.push(o.zb);
  const lt = (z) => { const T = o.tops; for (let i = 0; i < T.length - 1; i++) if (z <= T[i][0] && z >= T[i + 1][0]) return T[i][1] + (T[i + 1][1] - T[i][1]) * ((T[i][0] - z) / (T[i][0] - T[i + 1][0] || 1)); return T[z > T[0][0] ? 0 : T.length - 1][1]; };
  const S = zs.map((z) => { const e = Math.min(1, Math.min(o.zf - z, z - o.zb) / (o.round ?? 0.15)), end = Math.sqrt(Math.max(0.05, e)); const t = lt(z); return { z, t, b: o.b + (1 - end) * (t - o.b) * 0.35, w: o.w * (0.75 + 0.25 * end) }; });
  return loft(C.body, S, (q) => { const h = q.t - q.b, r = Math.min(0.08, h * 0.45), wt = q.w * (o.top ?? 0.82);
    return [[q.w * 0.92 - 0.03, q.b], [q.w * 0.92, q.b + 0.03], [q.w, q.b + h * 0.5], [wt, q.t - r], [wt - r, q.t], [-(wt - r), q.t], [-wt, q.t - r], [-q.w, q.b + h * 0.5], [-q.w * 0.92, q.b + 0.03], [-(q.w * 0.92 - 0.03), q.b]]; },
  (k) => (k === 9 ? 1 : 0), [mat || C.paint, M.dark], true);
}

const BUILD = {
  pickup(C) {
    // an old square-body pickup: flat sides, a big chrome grille + bumpers, a tall cab... and rust
    const b = C.body, P = C.paint;
    C.len = 5.2; C.wid = 2.1; C.seat.set(0.42, 0.95, 0.3); C.hitch.set(0, 0.62, -2.62); C.hood = V3(0, 1.47, 1.75);
    bx(b, 1.5, 0.24, 4.9, 0, 0.5, 0, M.dark); // frame
    const S = shell(C, { zf: 2.6, zb: -0.38, w: 1.0, b: 0.62, s: 1.4, hood: 1.44, cowl: 1.48, roof: 2.04, ws: 0.95, wt: 0.66, rb: -0.28, wheels: [[1.6, 0.52]], nose: 0.1, drop: 0.04, roofW: 0.9, hoodW: 0.98, taper: 0.03 });
    bedShell(C, { zf: -0.42, zb: -2.56, w: 1.0, b: 0.62, rail: 1.4, floor: 1.02, wheels: [[-1.55, 0.52]] });
    bx(b, 1.96, 0.76, 0.07, 0, 1.02, -2.555, P); bx(b, 1.82, 0.36, 0.06, 0, 1.2, -0.46, P); // tailgate + bed front
    backGlass(C, S, 0.08); seam(C, S, 0.88); seam(C, S, -0.32); handle(C, S, -0.14);
    for (const s of [-1, 1]) { const q = at(S, 0.82); bx(b, 0.06, 0.22, 0.18, s * (q.w + 0.13), q.s + 0.14, 0.82, M.chrome); bx(b, 0.14, 0.03, 0.03, s * (q.w + 0.06), q.s + 0.05, 0.84, M.chrome); }
    truckGrille(C, S, { y: 1.36, w: 1.66, h: 0.46, bars: 2, cross: true });
    for (const s of [-1, 1]) { bx(b, 0.24, 0.22, 0.05, s * 0.68, 1.13, 2.625, M.light); bx(b, 0.12, 0.36, 0.06, s * 0.95, 1.05, -2.57, M.tail); }
    bx(b, 2.1, 0.24, 0.22, 0, 0.72, 2.68, M.chrome); bx(b, 2.06, 0.22, 0.2, 0, 0.68, -2.64, M.chrome);
    // rust spots (Mud & Chrome can scrub them off)
    C.hasRust = true;
    for (const [z, w0] of [[2.0, 0.45], [1.25, 0.35]]) bx(b, w0, w0 * 0.6, 0.02, 0.5 - w0, at(S, z).t + 0.006, z, C.rustMat, -Math.PI / 2);
    for (const [z, y, s, w0] of [[0.45, 0.95, -1, 0.32], [-1.95, 0.92, 1, 0.45]]) bx(b, w0, w0 * 0.6, 0.02, s * 1.012, y, z, C.rustMat, 0, Math.PI / 2);
    bx(b, 0.16, 0.16, 0.3, 0, 0.6, -2.72, M.chrome);
    C.pipes.push(V3(-0.7, 0.55, -2.55));
    for (const [x, z, f] of [[0.84, 1.6, 1], [-0.84, 1.6, 1], [0.84, -1.55, 0], [-0.84, -1.55, 0]]) wheel(C, x, z, 0.46, 0.34, f);
  },
  bike(C) {
    const b = C.body, P = C.paint;
    C.len = 2.1; C.wid = 0.8; C.seat.set(0, 0.92, -0.2); C.hitch = null; C.hood = null;
    if (BIKE) return realBike(C, 1); // (no add-on exhaust: the bike has its own)
    // the fork + handlebars turn with the front wheel (a group pivoting on the steering head)
    const fork = new THREE.Group(); fork.position.set(0, 0, 0.62); b.add(fork); C.forks = [fork];
    tube(fork, V3(0, 0.45, 0.13), V3(0, 1.15, -0.12), 0.05, M.chrome);
    tube(b, V3(0, 0.55, -0.1), V3(0, 1.05, 0.45), 0.06, M.trim); tube(b, V3(0, 0.55, -0.1), V3(0, 0.45, -0.75), 0.05, M.trim);
    bx(b, 0.36, 0.3, 0.62, 0, 1.08, 0.2, P); bx(b, 0.3, 0.12, 0.85, 0, 1.0, -0.35, M.seat);
    bx(b, 0.26, 0.08, 0.5, 0, 0.98, 0.8, P, 0.4); bx(b, 0.26, 0.08, 0.6, 0, 1.0, -0.85, P, -0.3); // fenders
    bx(b, 0.32, 0.34, 0.24, 0, 0.6, 0.1, M.trim);
    tube(fork, V3(-0.38, 1.2, -0.12), V3(0.38, 1.2, -0.12), 0.03, M.trim);
    bx(fork, 0.42, 0.34, 0.04, 0, 1.15, 0.13, M.white);
    wheel(C, 0, 0.75, 0.42, 0.16, 1, { bike: true }); wheel(C, 0, -0.75, 0.42, 0.2, 0, { bike: true });
  },
  jeep(C) {
    // an open-top 4x4: a flat tub body with round headlights, fender flares, a roll cage, a snorkel and a light bar
    const b = C.body, P = C.paint;
    C.len = 4.4; C.wid = 2.2; C.seat.set(0.45, 1.15, -0.1); C.hitch.set(0, 0.75, -2.25); C.hood = V3(0, 1.67, 1.35);
    bx(b, 1.6, 0.3, 4.0, 0, 0.8, 0, M.dark);
    const S = shell(C, { zf: 2.1, zb: -2.1, w: 0.98, b: 0.82, s: 1.58, hood: 1.64, cowl: 1.66, roof: 1.66, ws: -1.9, wt: -1.95, rb: -2.0, wheels: [[1.35, 0.64], [-1.35, 0.64]], nose: 0.12, drop: 0.05, roofW: 0.94, hoodW: 0.94, taper: 0.03 });
    flare(C, S, 1.35, 0.64, M.trim, 0.09); flare(C, S, -1.35, 0.64, M.trim, 0.09); seam(C, S, 0.55); seam(C, S, -0.7);
    bx(b, 1.7, 0.05, 2.3, 0, 1.68, -0.75, M.seat); for (const x of [-0.45, 0.45]) bx(b, 0.55, 0.5, 0.5, x, 1.9, -0.2, M.seat);
    bx(b, 1.85, 0.7, 0.05, 0, 2.02, 0.6, M.glass, -0.25); bx(b, 1.92, 0.08, 0.1, 0, 2.36, 0.52, P); for (const s of [-1, 1]) bx(b, 0.06, 0.74, 0.08, s * 0.94, 2.0, 0.6, P, -0.25);
    for (const s of [-1, 1]) { tube(b, V3(s * 0.88, 1.66, 0.55), V3(s * 0.85, 2.5, 0.2), 0.05, M.dark); tube(b, V3(s * 0.85, 2.5, 0.2), V3(s * 0.85, 2.5, -1.6), 0.05, M.dark); tube(b, V3(s * 0.85, 2.5, -1.6), V3(s * 0.88, 1.66, -1.8), 0.05, M.dark); }
    tube(b, V3(-0.85, 2.5, 0.2), V3(0.85, 2.5, 0.2), 0.05, M.dark); tube(b, V3(-0.85, 2.5, -1.6), V3(0.85, 2.5, -1.6), 0.05, M.dark);
    bx(b, 1.4, 0.16, 0.18, 0, 2.6, 0.2, M.dark); for (let i = 0; i < 5; i++) bx(b, 0.2, 0.1, 0.04, -0.56 + i * 0.28, 2.6, 0.3, M.light);
    bx(b, 2.0, 0.28, 0.3, 0, 0.92, 2.18, M.dark); bx(b, 1.2, 0.46, 0.04, 0, 1.3, 2.105, M.dark); for (const s of [-1, 1]) cy(b, 0.17, 0.06, s * 0.68, 1.32, 2.1, M.light, 14, Math.PI / 2);
    for (let i = 0; i < 6; i++) bx(b, 0.06, 0.4, 0.05, -0.4 + i * 0.16, 1.3, 2.12, P);
    bx(b, 2.0, 0.28, 0.26, 0, 0.92, -2.16, M.dark); for (const s of [-1, 1]) bx(b, 0.16, 0.22, 0.05, s * 0.8, 1.32, -2.11, M.tail);
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), M.tire); spare.rotation.x = Math.PI / 2; spare.position.set(0, 1.55, -2.28); b.add(spare);
    tube(b, V3(-1.0, 1.5, 1.0), V3(-1.0, 2.5, 0.75), 0.07, M.dark); // snorkel
    C.pipes.push(V3(0.75, 0.75, -2.15));
    for (const [x, z, f] of [[1.0, 1.35, 1], [-1.0, 1.35, 1], [1.0, -1.35, 0], [-1.0, -1.35, 0]]) wheel(C, x, z, 0.56, 0.42, f);
  },
  buggy(C) {
    const b = C.body, P = C.paint;
    C.len = 3.8; C.wid = 2.1; C.seat.set(0, 0.85, -0.15); C.hitch.set(0, 0.55, -1.95); C.hood = null;
    bx(b, 1.2, 0.2, 3.2, 0, 0.6, 0, M.dark);
    pod(C, { zf: 1.95, zb: 0.55, w: 0.68, b: 0.62, tops: [[1.95, 0.72], [1.6, 0.92], [0.9, 1.05], [0.55, 1.08]], round: 0.3 }); // fiberglass nose
    pod(C, { zf: -0.9, zb: -1.85, w: 0.82, b: 0.7, tops: [[-0.9, 1.05], [-1.2, 1.2], [-1.85, 1.1]], round: 0.2 }); // engine cover
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
    // a low sports car: pointy nose, a long hood, a bubble roof, side intakes, a rear wing
    const b = C.body, P = C.paint;
    C.len = 4.5; C.wid = 2.0; C.seat.set(0.4, 0.12, -0.25); C.hitch = null; C.hood = V3(0, 0.78, 1.35);
    const S = shell(C, { zf: 2.28, zb: -2.26, w: 0.98, b: 0.3, s: 0.7, hood: 0.64, cowl: 0.8, roof: 1.17, ws: 0.98, wt: 0.22, rb: -0.62, rg: -1.6, deck: 0.9, wheels: [[1.42, 0.42], [-1.42, 0.42]], nose: 0.55, drop: 0.18, roofW: 0.7, hoodW: 0.9, taper: 0.12 });
    seam(C, S, 0.9); seam(C, S, -0.55); handle(C, S, -0.4); mirror(C, S, 0.78);
    for (const s of [-1, 1]) {
      const q = at(S, -0.95); bx(b, 0.03, 0.2, 0.55, s * (q.w + 0.005), 0.5, -0.95, M.dark); // side intakes
      bx(b, 0.42, 0.06, 0.18, s * 0.6, 0.55, 2.16, M.light, -0.3); bx(b, 0.5, 0.07, 0.05, s * 0.55, 0.82, -2.27, M.tail);
    }
    bx(b, 1.0, 0.12, 0.05, 0, 0.4, 2.29, M.dark); bx(b, 1.6, 0.16, 0.2, 0, 0.36, -2.22, M.dark);
    tube(b, V3(-0.6, 0.9, -2.0), V3(-0.6, 1.2, -2.1), 0.04, M.dark); tube(b, V3(0.6, 0.9, -2.0), V3(0.6, 1.2, -2.1), 0.04, M.dark);
    bx(b, 1.9, 0.05, 0.42, 0, 1.22, -2.12, P, 0.08); for (const s of [-1, 1]) bx(b, 0.04, 0.22, 0.45, s * 0.95, 1.16, -2.12, M.dark);
    C.pipes.push(V3(0.35, 0.38, -2.25), V3(-0.35, 0.38, -2.25));
    for (const [x, z, f] of [[0.84, 1.42, 1], [-0.84, 1.42, 1], [0.84, -1.42, 0], [-0.84, -1.42, 0]]) wheel(C, x, z, 0.38, 0.32, f);
  },
  hauler(C) {
    // a big semi truck: long hood, a tall sleeper cab, chrome stacks + tanks
    const b = C.body, P = C.paint;
    C.len = 7.6; C.wid = 2.5; C.seat.set(0.55, 1.75, 1.9); C.hitch.set(0, 1.05, -2.9); C.hood = V3(0, 2.15, 3.2);
    bx(b, 1.6, 0.4, 7.0, 0, 0.95, -0.1, M.dark);
    const S = shell(C, { zf: 3.9, zb: 0.0, w: 1.2, b: 0.95, s: 2.15, hood: 2.1, cowl: 2.3, roof: 3.32, ws: 2.45, wt: 2.2, rb: 0.1, wheels: [[3.0, 0.68]], nose: 0.3, drop: 0.12, roofW: 1.1, hoodW: 1.1, taper: 0.06 });
    seam(C, S, 2.3); seam(C, S, 1.0); handle(C, S, 1.15); mirror(C, S, 2.35, true); flare(C, S, 3.0, 0.68, M.chrome, 0.05);
    bx(b, 1.5, 0.9, 0.06, 0, 1.6, 3.91, M.chrome); for (let i = 0; i < 6; i++) bx(b, 1.4, 0.04, 0.08, 0, 1.25 + i * 0.14, 3.93, M.dark);
    bx(b, 2.5, 0.35, 0.3, 0, 1.0, 3.98, M.chrome);
    for (const s of [-1, 1]) { bx(b, 0.32, 0.22, 0.05, s * 0.88, 1.62, 3.88, M.light); cy(b, 0.12, 3.2, s * 1.3, 2.9, -0.15, M.chrome, 8); cy(b, 0.3, 1.3, s * 1.32, 0.78, 1.2, M.chrome, 14, Math.PI / 2); }
    bx(b, 2.2, 0.3, 3.2, 0, 1.2, -1.6, M.trim); cy(b, 0.7, 0.12, 0, 1.35, -1.4, M.dark, 16);
    for (const s of [-1, 1]) { bx(b, 0.3, 0.2, 0.06, s * 1.05, 1.0, -3.2, M.tail); bx(b, 0.7, 0.6, 1.9, s * 1.1, 1.2, -1.8, M.dark); }
    C.pipes.push(V3(1.3, 4.5, -0.15), V3(-1.3, 4.5, -0.15));
    for (const [x, z, f] of [[1.08, 3.0, 1], [-1.08, 3.0, 1], [1.08, -1.2, 0], [-1.08, -1.2, 0], [1.08, -2.45, 0], [-1.08, -2.45, 0]]) wheel(C, x, z, 0.6, 0.46, f);
  },
  monster(C) {
    const b = C.body, P = C.paint;
    C.len = 5.4; C.wid = 3.2; C.seat.set(0.45, 2.35, 0.2); C.hitch.set(0, 1.2, -2.7); C.hood = V3(0, 2.75, 1.6);
    bx(b, 1.6, 0.4, 4.6, 0, 1.25, 0, M.dark);
    for (const z of [1.55, -1.55]) { bx(b, 2.4, 0.18, 0.3, 0, 1.15, z, M.trim); for (const s of [-1, 1]) { tube(b, V3(s * 0.7, 1.2, z + 0.2), V3(s * 1.0, 2.2, z + 0.1), 0.09, M.chrome); tube(b, V3(s * 0.7, 1.2, z - 0.2), V3(s * 1.0, 2.2, z - 0.1), 0.09, M.chrome); } }
    const S = shell(C, { zf: 2.42, zb: -0.4, w: 1.1, b: 2.0, s: 2.72, hood: 2.78, cowl: 2.84, roof: 3.45, ws: 1.05, wt: 0.55, rb: -0.32, wheels: [], nose: 0.18, drop: 0.06, roofW: 0.98, hoodW: 1.05 });
    bedShell(C, { zf: -0.44, zb: -2.42, w: 1.1, b: 2.0, rail: 2.72, floor: 2.3, wheels: [] }); bx(b, 2.16, 0.72, 0.07, 0, 2.36, -2.415, P);
    backGlass(C, S); seam(C, S, 0.95); seam(C, S, -0.3); handle(C, S, -0.12); mirror(C, S, 0.9, true); truckGrille(C, S, { y: 2.74, w: 1.6, h: 0.5, bars: 3 });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) bx(b, 0.04, 0.22, 0.8 - i * 0.15, s * 1.11, 2.35 + (i % 2) * 0.12, 1.2 - i * 0.6, [M.tail, M.flame][i % 2]); // flame stripes
    bx(b, 2.3, 0.3, 0.3, 0, 2.1, 2.5, M.chrome); bx(b, 2.3, 0.3, 0.3, 0, 2.1, -2.5, M.chrome);
    for (const s of [-1, 1]) { bx(b, 0.3, 0.2, 0.05, s * 0.86, 2.55, 2.42, M.light); bx(b, 0.12, 0.4, 0.06, s * 1.06, 2.45, -2.42, M.tail); }
    bx(b, 1.6, 0.14, 0.2, 0, 3.52, 0.6, M.dark); for (let i = 0; i < 4; i++) bx(b, 0.24, 0.1, 0.04, -0.45 + i * 0.3, 3.52, 0.72, M.light);
    C.pipes.push(V3(0.8, 1.5, -2.5));
    for (const [x, z, f] of [[1.45, 1.6, 1], [-1.45, 1.6, 1], [1.45, -1.6, 0], [-1.45, -1.6, 0]]) wheel(C, x, z, 1.05, 0.85, f);
  },
  // a modern full-size crew cab pickup (real body shape: wheel arches, sloped windshield, four doors, chrome grille)
  crew(C) {
    // a modern full-size crew cab pickup: tall hood, big grille, four doors, tow mirrors, a real open bed
    const b = C.body, P = C.paint;
    C.len = 6.65; C.wid = 2.12; C.seat.set(0.45, 1.02, 0.1); C.hitch.set(0, 0.62, -3.76); C.hood = V3(0, 1.57, 2.1);
    bx(b, 1.5, 0.22, 6.3, 0, 0.5, -0.45, M.dark); // frame
    const S = shell(C, { zf: 3.0, zb: -1.44, w: 1.03, b: 0.62, s: 1.4, hood: 1.52, cowl: 1.58, roof: 2.04, ws: 1.18, wt: 0.4, rb: -1.32, wheels: [[1.92, 0.52]], nose: 0.2, drop: 0.06, roofW: 0.9, hoodW: 0.99, taper: 0.05 });
    bedShell(C, { zf: -1.48, zb: -3.62, w: 1.03, b: 0.62, rail: 1.42, floor: 1.1, wheels: [[-2.4, 0.52]] }); // (a 7 ft bed)
    bx(b, 2.02, 0.8, 0.07, 0, 1.02, -3.615, P); bx(b, 0.4, 0.05, 0.03, 0, 1.3, -3.655, M.dark); bx(b, 1.88, 0.32, 0.06, 0, 1.26, -1.5, P); // tailgate + bed front
    backGlass(C, S); pillar(C, S, -0.42, M.dark, 0.14); pillar(C, S, -1.36, P, 0.16);
    for (const z of [1.13, -0.42, -1.36]) seam(C, S, z); handle(C, S, -0.22); handle(C, S, -1.16); mirror(C, S, 1.02, true);
    flare(C, S, 1.92, 0.52, M.trim, 0.05); flare(C, S, -2.4, 0.52, M.trim, 0.05);
    truckGrille(C, S, { y: 1.44, w: 1.5, h: 0.6, bars: 3, cross: true });
    for (const s of [-1, 1]) {
      bx(b, 0.3, 0.18, 0.05, s * 0.84, 1.33, 2.99, M.light); bx(b, 0.32, 0.035, 0.06, s * 0.84, 1.22, 3.0, M.white); // headlights + LED strip
      bx(b, 0.16, 0.08, 0.05, s * 0.7, 0.72, 3.18, M.light); // fog lights
      bx(b, 0.1, 0.46, 0.06, s * 0.98, 1.17, -3.62, M.tail); bx(b, 0.2, 0.06, 2.6, s * 1.08, 0.6, -0.15, M.trim); // taillights, running boards
    }
    bx(b, 2.08, 0.3, 0.26, 0, 0.74, 3.06, M.chrome); bx(b, 1.7, 0.16, 0.22, 0, 0.52, 3.0, M.dark);
    bx(b, 2.08, 0.26, 0.24, 0, 0.68, -3.72, M.chrome); bx(b, 0.18, 0.18, 0.3, 0, 0.6, -3.86, M.dark); bx(b, 0.32, 0.05, 0.04, 0, 1.99, -1.46, M.tail);
    C.pipes.push(V3(-0.75, 0.52, -3.7));
    for (const [x, z, f] of [[0.86, 1.92, 1], [-0.86, 1.92, 1], [0.86, -2.4, 0], [-0.86, -2.4, 0]]) wheel(C, x, z, 0.46, 0.34, f);
  },
  // a boxy 80s V8 hatchback coupe (four little headlights, a slanted hatch, a lip spoiler)
  foxhatch(C) {
    // a boxy 80s V8 hatchback coupe (four little headlights, a slanted glass hatch, a lip spoiler)
    const b = C.body, P = C.paint;
    C.len = 4.6; C.wid = 1.9; C.seat.set(0.38, 0.2, -0.3); C.hitch = null; C.hood = V3(0, 0.9, 1.45);
    const S = shell(C, { zf: 2.3, zb: -2.28, w: 0.93, b: 0.36, s: 0.78, hood: 0.76, cowl: 0.86, roof: 1.3, ws: 0.86, wt: 0.05, rb: -0.78, rg: -2.0, deck: 0.98, wheels: [[1.38, 0.38], [-1.3, 0.38]], nose: 0.14, drop: 0.06, roofW: 0.78, hoodW: 0.9, taper: 0.04 });
    seam(C, S, 0.82); seam(C, S, -0.88); handle(C, S, -0.7); mirror(C, S, 0.72); pillar(C, S, -0.32, P, 0.1);
    for (const s of [-1, 1]) {
      const q = at(S, 0); bx(b, 0.02, 0.1, 3.6, s * ((q.w + q.wb) / 2 + 0.012), 0.52, 0, M.dark); // the black side stripe
      for (const x of [0.32, 0.6]) bx(b, 0.22, 0.12, 0.05, s * x, 0.64, 2.31, M.light); // four little headlights
      bx(b, 0.56, 0.16, 0.05, s * 0.52, 0.78, -2.29, M.tail);
    }
    bx(b, 0.5, 0.1, 0.05, 0, 0.66, 2.32, M.dark); bx(b, 1.86, 0.18, 0.2, 0, 0.36, 2.3, M.dark); bx(b, 1.86, 0.2, 0.18, 0, 0.38, -2.28, M.dark);
    bx(b, 1.5, 0.05, 0.3, 0, 1.0, -2.1, P, -0.15); for (let i = 0; i < 4; i++) bx(b, 0.9, 0.025, 0.05, 0, at(S, 1.05 - i * 0.12).t + 0.012, 1.05 - i * 0.12, M.dark);
    C.pipes.push(V3(0.55, 0.32, -2.3), V3(-0.55, 0.32, -2.3));
    for (const [x, z, f] of [[0.78, 1.38, 1], [-0.78, 1.38, 1], [0.78, -1.3, 0], [-0.78, -1.3, 0]]) wheel(C, x, z, 0.34, 0.26, f);
  },
  // a pit bike + a 125: the real dirt bike, smaller
  pitbike(C) { if (BIKE) return realBike(C, 0.72); BUILD.bike(C); },
  bike125(C) { if (BIKE) return realBike(C, 0.86); BUILD.bike(C); },
  sport300(C) { sportBike(C, 1.2, false); },
  super1000(C) { sportBike(C, 1.27, true); },
  atv(C) { quad(C, 1, 0.36); },
  sportquad(C) { quad(C, 0.95, 0.34, { sport: true }); },
  bigquad(C) { quad(C, 1.18, 0.44, { racks: true }); },
  bike450(C) {
    BUILD.bike(C);
    if (C.realBike) return;
    const b = C.body; // race number plates + a longer seat
    for (const s of [-1, 1]) bx(b, 0.04, 0.3, 0.42, s * 0.17, 0.98, -0.45, M.white);
    bx(b, 0.34, 0.05, 0.9, 0, 1.08, -0.3, M.dark);
  },
  minitruck(C) {
    // a little cab-over work truck: the cab sits right over the front wheels, a fold-down bed
    const b = C.body, P = C.paint;
    C.len = 3.6; C.wid = 1.5; C.seat.set(0.3, 0.72, 0.95); C.hitch.set(0, 0.45, -1.85); C.hood = null;
    bx(b, 1.2, 0.2, 3.4, 0, 0.42, 0, M.dark);
    const S = shell(C, { zf: 1.78, zb: 0.48, w: 0.74, b: 0.42, s: 1.12, hood: 1.15, cowl: 1.17, roof: 1.84, ws: 1.72, wt: 1.38, rb: 0.56, wheels: [[1.05, 0.34]], nose: 0.05, drop: 0.05, roofW: 0.68, hoodW: 0.72, taper: 0.03 });
    bedShell(C, { zf: 0.44, zb: -1.75, w: 0.74, b: 0.42, rail: 1.05, floor: 0.82, wheels: [[-1.0, 0.34]] });
    bx(b, 1.44, 0.6, 0.06, 0, 0.75, -1.745, P); bx(b, 1.3, 0.22, 0.06, 0, 0.94, 0.4, P);
    backGlass(C, S, 0.06); seam(C, S, 1.6); seam(C, S, 0.6); handle(C, S, 0.7); mirror(C, S, 1.6);
    for (const s of [-1, 1]) { bx(b, 0.22, 0.14, 0.04, s * 0.5, 0.82, 1.79, M.light); bx(b, 0.14, 0.22, 0.05, s * 0.62, 0.85, -1.76, M.tail); }
    bx(b, 1.52, 0.16, 0.12, 0, 0.55, 1.82, M.chrome);
    C.pipes.push(V3(0.45, 0.4, -1.75));
    for (const [x, z, f] of [[0.6, 1.05, 1], [-0.6, 1.05, 1], [0.6, -1.0, 0], [-0.6, -1.0, 0]]) wheel(C, x, z, 0.3, 0.22, f);
  },
  ranch(C) {
    // a big crew cab dually: double back wheels under wide fenders
    const b = C.body, P = C.paint;
    C.len = 6.3; C.wid = 2.6; C.seat.set(0.45, 1.08, 0.45); C.hitch.set(0, 0.68, -3.25); C.hood = V3(0, 1.62, 2.3);
    bx(b, 1.6, 0.26, 6.0, 0, 0.62, 0, M.dark);
    const S = shell(C, { zf: 3.14, zb: -0.76, w: 1.04, b: 0.68, s: 1.46, hood: 1.58, cowl: 1.64, roof: 2.12, ws: 1.34, wt: 0.6, rb: -0.64, wheels: [[2.05, 0.56]], nose: 0.2, drop: 0.06, roofW: 0.92, hoodW: 1.0, taper: 0.05 });
    bedShell(C, { zf: -0.8, zb: -3.14, w: 1.04, b: 0.68, rail: 1.46, floor: 1.12, wheels: [] });
    bx(b, 2.04, 0.78, 0.07, 0, 1.07, -3.135, P); bx(b, 1.9, 0.32, 0.06, 0, 1.3, -0.84, P);
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.36, 20, 1, false, 0, Math.PI), P); f.rotation.z = Math.PI / 2; f.position.set(s * 1.2, 0.5, -1.95); b.add(f); } // wide back fenders
    backGlass(C, S); pillar(C, S, 0.3, M.dark, 0.14);
    for (const z of [1.32, 0.3, -0.7]) seam(C, S, z); handle(C, S, 0.48); handle(C, S, -0.52); mirror(C, S, 1.18, true); flare(C, S, 2.05, 0.56, M.trim, 0.05);
    truckGrille(C, S, { y: 1.5, w: 1.6, h: 0.66, bars: 4 });
    for (const s of [-1, 1]) { bx(b, 0.32, 0.22, 0.05, s * 0.86, 1.32, 3.13, M.light); bx(b, 0.1, 0.44, 0.06, s * 0.99, 1.2, -3.14, M.tail); bx(b, 0.2, 0.06, 2.8, s * 1.1, 0.66, 0.3, M.trim); }
    bx(b, 2.2, 0.3, 0.28, 0, 0.8, 3.2, M.chrome); bx(b, 2.2, 0.26, 0.24, 0, 0.76, -3.26, M.chrome);
    C.pipes.push(V3(-0.75, 0.6, -3.2));
    for (const [x, z, f] of [[0.9, 2.05, 1], [-0.9, 2.05, 1]]) wheel(C, x, z, 0.5, 0.36, f);
    for (const x of [0.86, -0.86, 1.2, -1.2]) wheel(C, x, -1.95, 0.5, 0.3, 0);
  },
  trailboss(C) {
    // a lifted 4x4: big tires poking out under fender flares, a steel bumper + bull bar, a roof light bar
    const b = C.body, P = C.paint;
    C.len = 5.7; C.wid = 2.5; C.seat.set(0.45, 1.6, 0.25); C.hitch.set(0, 1.0, -2.95); C.hood = V3(0, 2.07, 1.9);
    bx(b, 1.5, 0.3, 5.2, 0, 1.0, 0, M.dark); for (const z of [1.75, -1.65]) { bx(b, 1.9, 0.2, 0.25, 0, 0.75, z, M.trim); for (const s of [-1, 1]) tube(b, V3(s * 0.5, 0.8, z), V3(s * 0.45, 1.15, z + 0.25), 0.07, M.red); }
    const S = shell(C, { zf: 2.85, zb: -0.62, w: 1.03, b: 1.15, s: 1.92, hood: 2.0, cowl: 2.06, roof: 2.62, ws: 1.05, wt: 0.35, rb: -0.52, wheels: [[1.75, 0.74]], nose: 0.18, drop: 0.05, roofW: 0.9, hoodW: 0.98 });
    bedShell(C, { zf: -0.66, zb: -2.8, w: 1.03, b: 1.15, rail: 1.92, floor: 1.5, wheels: [[-1.65, 0.74]] });
    bx(b, 2.0, 0.78, 0.07, 0, 1.53, -2.795, P); bx(b, 1.88, 0.42, 0.06, 0, 1.71, -0.7, P);
    backGlass(C, S); seam(C, S, 0.95); seam(C, S, -0.3); handle(C, S, -0.1); mirror(C, S, 0.88, true);
    flare(C, S, 1.75, 0.74, M.dark, 0.09); flare(C, S, -1.65, 0.74, M.dark, 0.09);
    truckGrille(C, S, { y: 1.95, w: 1.5, h: 0.55, bars: 3 });
    tube(b, V3(-0.95, 1.2, 2.95), V3(-0.85, 2.1, 2.9), 0.06, M.dark); tube(b, V3(0.95, 1.2, 2.95), V3(0.85, 2.1, 2.9), 0.06, M.dark); tube(b, V3(-0.85, 2.1, 2.9), V3(0.85, 2.1, 2.9), 0.06, M.dark);
    bx(b, 2.3, 0.32, 0.3, 0, 1.3, 2.9, M.dark); bx(b, 2.2, 0.28, 0.26, 0, 1.3, -2.86, M.dark);
    bx(b, 1.8, 0.14, 0.2, 0, 2.7, 0.75, M.dark); for (let i = 0; i < 6; i++) bx(b, 0.22, 0.1, 0.04, -0.7 + i * 0.28, 2.7, 0.86, M.light);
    for (const s of [-1, 1]) { bx(b, 0.3, 0.2, 0.05, s * 0.8, 1.8, 2.855, M.light); bx(b, 0.1, 0.42, 0.06, s * 0.98, 1.72, -2.8, M.tail); }
    C.pipes.push(V3(0.75, 1.0, -2.85));
    for (const [x, z, f] of [[1.12, 1.75, 1], [-1.12, 1.75, 1], [1.12, -1.65, 0], [-1.12, -1.65, 0]]) wheel(C, x, z, 0.66, 0.5, f);
  },
  prerunner(C) {
    // a desert trophy truck: long sloped hood, wide fiberglass fenders, a cage out back with the spare
    const b = C.body, P = C.paint;
    C.len = 5.6; C.wid = 2.5; C.seat.set(0.4, 1.02, -0.2); C.hitch = null; C.hood = V3(0, 1.5, 1.7);
    bx(b, 1.4, 0.26, 4.8, 0, 0.85, 0, M.dark);
    const S = shell(C, { zf: 2.72, zb: -0.95, w: 1.0, b: 0.95, s: 1.5, hood: 1.42, cowl: 1.6, roof: 2.25, ws: 0.72, wt: 0.12, rb: -0.85, wheels: [[1.8, 0.66]], nose: 0.5, drop: 0.14, roofW: 0.84, hoodW: 0.95 });
    bedShell(C, { zf: -0.98, zb: -2.62, w: 1.0, b: 0.95, rail: 1.45, floor: 1.2, wheels: [[-1.75, 0.66]] });
    bx(b, 1.96, 0.46, 0.06, 0, 1.2, -2.615, P);
    flare(C, S, 1.8, 0.66, P, 0.13); flare(C, S, -1.75, 0.66, P, 0.13); backGlass(C, S); seam(C, S, 0.6); handle(C, S, -0.7);
    for (const s of [-1, 1]) { tube(b, V3(s * 0.8, 1.6, -1.0), V3(s * 0.8, 2.2, -1.9), 0.05, M.trim); tube(b, V3(s * 0.8, 2.2, -1.9), V3(s * 0.8, 1.45, -2.6), 0.05, M.trim); }
    tube(b, V3(-0.8, 2.2, -1.9), V3(0.8, 2.2, -1.9), 0.05, M.trim);
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 14), M.tire); spare.position.set(0, 1.4, -1.8); b.add(spare);
    bx(b, 1.6, 0.14, 0.2, 0, 2.32, 0.15, M.dark); for (let i = 0; i < 5; i++) bx(b, 0.22, 0.1, 0.04, -0.56 + i * 0.28, 2.32, 0.26, M.light);
    for (const s of [-1, 1]) { bx(b, 0.36, 0.12, 0.05, s * 0.6, 1.24, 2.7, M.light); bx(b, 0.2, 0.2, 0.06, s * 0.88, 1.3, -2.62, M.tail); const q = at(S, -0.2); bx(b, 0.02, 0.3, 0.9, s * (q.w + 0.012), 1.18, -0.2, M.white); }
    bx(b, 1.8, 0.2, 0.25, 0, 0.95, 2.75, M.dark);
    C.pipes.push(V3(0.3, 0.9, -2.62), V3(-0.3, 0.9, -2.62));
    for (const [x, z, f] of [[1.15, 1.8, 1], [-1.15, 1.8, 1], [1.15, -1.75, 0], [-1.15, -1.75, 0]]) wheel(C, x, z, 0.58, 0.44, f);
  },
  dumper(C) {
    // a big dump truck: a square work cab and a steel dump box
    const b = C.body, P = C.paint;
    C.len = 7.5; C.wid = 2.7; C.seat.set(0.55, 1.85, 2.2); C.hitch.set(0, 1.0, -3.6); C.hood = V3(0, 2.15, 3.2);
    bx(b, 1.6, 0.45, 7.0, 0, 1.0, 0, M.dark);
    const S = shell(C, { zf: 3.72, zb: 0.82, w: 1.25, b: 1.0, s: 2.2, hood: 2.1, cowl: 2.25, roof: 3.25, ws: 2.5, wt: 2.32, rb: 0.92, wheels: [[2.95, 0.7]], nose: 0.25, drop: 0.1, roofW: 1.16, hoodW: 1.14 });
    seam(C, S, 2.4); seam(C, S, 1.0); handle(C, S, 1.15); mirror(C, S, 2.4, true); flare(C, S, 2.95, 0.7, M.dark, 0.08); backGlass(C, S);
    bx(b, 1.6, 0.9, 0.06, 0, 1.65, 3.73, M.chrome); for (let i = 0; i < 5; i++) bx(b, 1.5, 0.04, 0.08, 0, 1.3 + i * 0.16, 3.75, M.dark); bx(b, 2.6, 0.35, 0.3, 0, 1.0, 3.8, M.dark);
    for (const s of [-1, 1]) { bx(b, 0.32, 0.22, 0.05, s * 1.0, 1.68, 3.7, M.light); cy(b, 0.11, 2.8, s * 1.32, 2.7, 0.65, M.chrome, 8); }
    bx(b, 2.6, 1.6, 4.0, 0, 2.15, -1.45, P2(C)); bx(b, 2.4, 0.1, 3.8, 0, 2.97, -1.45, M.dark);
    for (let z = -3.2; z <= 0.4; z += 0.9) for (const s of [-1, 1]) bx(b, 0.08, 1.5, 0.14, s * 1.32, 2.15, z, M.trim);
    bx(b, 2.6, 0.12, 1.0, 0, 3.36, 0.85, P2(C));
    for (const s of [-1, 1]) bx(b, 0.3, 0.2, 0.06, s * 1.1, 1.2, -3.5, M.tail);
    C.pipes.push(V3(1.32, 4.1, 0.65));
    for (const [x, z, f] of [[1.12, 2.95, 1], [-1.12, 2.95, 1], [1.12, -0.9, 0], [-1.12, -0.9, 0], [1.12, -2.3, 0], [-1.12, -2.3, 0]]) wheel(C, x, z, 0.62, 0.5, f);
  },
  swamp(C) {
    // a giant army-style 6x6: a tall square cab, a canvas-top box, a snorkel
    const b = C.body, P = C.paint;
    C.len = 6.8; C.wid = 3.0; C.seat.set(0.5, 2.3, 1.0); C.hitch.set(0, 1.3, -3.4); C.hood = V3(0, 2.6, 2.6);
    bx(b, 1.8, 0.5, 6.2, 0, 1.45, 0, M.dark);
    const S = shell(C, { zf: 3.34, zb: -0.45, w: 1.3, b: 1.5, s: 2.6, hood: 2.52, cowl: 2.62, roof: 3.62, ws: 1.62, wt: 1.3, rb: -0.35, wheels: [[2.15, 0.92], [0, 0.92]], nose: 0.22, drop: 0.08, roofW: 1.22, hoodW: 1.24, taper: 0.05 });
    seam(C, S, 1.5); seam(C, S, 0.0); handle(C, S, 0.15); mirror(C, S, 1.5, true); backGlass(C, S);
    bx(b, 2.6, 1.2, 3.0, 0, 2.15, -1.95, P); for (let i = 0; i < 4; i++) tube(b, V3(-1.3, 2.75, -0.6 - i * 0.9), V3(1.3, 2.75, -0.6 - i * 0.9), 0.04, M.dark);
    bx(b, 2.8, 0.4, 0.4, 0, 1.55, 3.42, M.dark); for (let i = 0; i < 5; i++) bx(b, 0.12, 0.6, 0.05, -0.6 + i * 0.3, 2.05, 3.35, M.dark);
    for (const s of [-1, 1]) { cy(b, 0.18, 0.06, s * 0.9, 2.3, 3.35, M.light, 12, Math.PI / 2); bx(b, 0.3, 0.2, 0.06, s * 1.15, 2.0, -3.46, M.tail); }
    tube(b, V3(-1.36, 2.2, 1.9), V3(-1.36, 3.9, 1.7), 0.09, M.dark); // snorkel
    C.pipes.push(V3(1.0, 1.4, -3.4));
    for (const [x, z, f] of [[1.32, 2.15, 1], [-1.32, 2.15, 1], [1.32, 0.0, 0], [-1.32, 0.0, 0], [1.32, -2.05, 0], [-1.32, -2.05, 0]]) wheel(C, x, z, 0.82, 0.62, f);
  },
  hyper(C) {
    // the supercar: super low, a wedge nose, glowing strips, a giant wing
    const b = C.body, P = C.paint;
    C.len = 4.7; C.wid = 2.1; C.seat.set(0.38, 0.0, -0.2); C.hitch = null; C.hood = V3(0, 0.82, -1.5);
    const S = shell(C, { zf: 2.35, zb: -2.35, w: 1.02, b: 0.24, s: 0.6, hood: 0.5, cowl: 0.72, roof: 1.06, ws: 0.85, wt: 0.0, rb: -0.7, rg: -1.75, deck: 0.8, wheels: [[1.45, 0.42], [-1.45, 0.42]], nose: 0.6, drop: 0.2, roofW: 0.66, hoodW: 0.92, taper: 0.14 });
    seam(C, S, 0.8); mirror(C, S, 0.7);
    for (const s of [-1, 1]) { const q = at(S, -0.6); bx(b, 0.03, 0.22, 0.9, s * (q.w + 0.005), 0.46, -0.6, M.dark); bx(b, 0.03, 0.04, 3.4, s * (q.w + 0.01), 0.32, 0, M.glow); bx(b, 0.5, 0.05, 0.1, s * 0.58, 0.46, 2.26, M.glow, -0.2); }
    tube(b, V3(-0.7, 0.85, -2.05), V3(-0.7, 1.45, -2.2), 0.05, M.dark); tube(b, V3(0.7, 0.85, -2.05), V3(0.7, 1.45, -2.2), 0.05, M.dark);
    bx(b, 2.2, 0.06, 0.6, 0, 1.48, -2.22, P, 0.12); for (const s of [-1, 1]) bx(b, 0.05, 0.34, 0.66, s * 1.1, 1.4, -2.22, M.dark);
    bx(b, 1.8, 0.05, 0.05, 0, 0.72, -2.36, M.tail); bx(b, 1.7, 0.14, 0.36, 0, 0.3, -2.3, M.dark);
    C.pipes.push(V3(0.2, 0.42, -2.36), V3(-0.2, 0.42, -2.36));
    for (const [x, z, f] of [[0.9, 1.45, 1], [-0.9, 1.45, 1], [0.9, -1.45, 0], [-0.9, -1.45, 0]]) wheel(C, x, z, 0.38, 0.36, f);
  },
};
// a quad (4-wheeler). s = how big, wr = wheel size
function quad(C, s, wr, o = {}) {
  const b = C.body, P = C.paint, up = wr - 0.36, y = (v) => v * s + up;
  C.len = 2.2 * s; C.wid = 1.3 * s; C.seat.set(0, y(0.88), -0.25 * s); C.hitch = o.sport ? null : V3(0, y(0.5), -1.15 * s); C.hood = null;
  bx(b, 0.9 * s, 0.35 * s, 1.7 * s, 0, y(0.62), 0, M.dark);
  // molded plastic fenders that wrap over the wheels, a rounded tank in the middle, a padded seat
  pod(C, { zf: 1.05 * s, zb: 0.2 * s, w: 0.62 * s, b: y(0.74), tops: [[1.05 * s, y(0.86)], [0.85 * s, y(1.04)], [0.4 * s, y(1.06)], [0.2 * s, y(0.98)]], round: 0.18 * s, top: 0.9 });
  pod(C, { zf: -0.25 * s, zb: -1.05 * s, w: 0.62 * s, b: y(0.74), tops: [[-0.25 * s, y(1.0)], [-0.5 * s, y(1.04)], [-0.9 * s, y(1.02)], [-1.05 * s, y(0.9)]], round: 0.18 * s, top: 0.9 });
  pod(C, { zf: 0.42 * s, zb: 0.1 * s, w: 0.28 * s, b: y(0.85), tops: [[0.42 * s, y(1.02)], [0.25 * s, y(1.12)], [0.1 * s, y(1.06)]], round: 0.12 * s });
  pod(C, { zf: 0.12 * s, zb: -0.62 * s, w: 0.26 * s, b: y(0.9), tops: [[0.12 * s, y(1.1)], [-0.1 * s, y(1.12)], [-0.62 * s, y(1.13)]], round: 0.1 * s, top: 0.9 }, M.seat);
  if (!o.sport) for (const z of [0.85, -0.85]) bx(b, 0.9 * s, 0.05, 0.4 * s, 0, y(1.1), z * s, M.trim); // racks
  if (o.racks) for (const z of [0.85, -0.85]) for (const x of [-0.42, 0.42]) tube(b, V3(x * s, y(1.1), (z - 0.18) * s), V3(x * s, y(1.25), (z + 0.18) * s), 0.03, M.trim);
  if (o.sport) { for (const sd of [-1, 1]) bx(b, 0.06, 0.18, 0.9 * s, sd * 0.6 * s, y(0.86), 0, M.white); bx(b, 0.6, 0.06, 0.25, 0, y(0.7), 1.05 * s, M.dark); }
  tube(b, V3(0, y(0.95), 0.5 * s), V3(0, y(1.3), 0.62 * s), 0.04, M.trim); tube(b, V3(-0.4 * s, y(1.32), 0.6 * s), V3(0.4 * s, y(1.32), 0.6 * s), 0.035, M.trim);
  bx(b, 0.3 * s, 0.16 * s, 0.08, 0, y(0.95), 0.98 * s, M.light); bx(b, 0.5 * s, 0.18 * s, 0.06, 0, y(0.65), 1.02 * s, M.trim);
  C.pipes.push(V3(0.3 * s, y(0.7), -0.95 * s));
  for (const [x, z, f] of [[0.55, 0.62, 1], [-0.55, 0.62, 1], [0.55, -0.62, 0], [-0.55, -0.62, 0]]) wheel(C, x * s * (o.sport ? 1.08 : 1), z * s, wr, 0.3 * s * (o.racks ? 1.25 : 1), f);
}
function P2(C) { return C.paint2; }
// a street sport bike, built like a real 300 sport bike: a narrow pointed upper fairing with twin angled headlights and
// a smoked screen, big side fairings over a black lower cowl, a tank, a rider seat + a higher passenger seat, a slim tail
// with a hanging plate bracket, a side muffler, silver forks + brake discs, 17-inch wheels (1.4 m wheelbase).
// big = the 1000cc superbike (a bit bigger, a fat back tire, winglets)
function sportBike(C, k, big) {
  const b = C.body, P = C.paint, K = (v) => v * k;
  C.len = K(2.02); C.wid = 0.72; C.seat.set(0, K(0.72), K(-0.26)); C.hitch = null; C.hood = null; C.lean = 0.32;
  // frame, engine, radiator, swingarm
  for (const s of [-1, 1]) { tube(b, V3(s * K(0.09), K(0.86), K(0.5)), V3(s * K(0.11), K(0.44), K(-0.18)), K(0.035), M.dark); tube(b, V3(s * K(0.1), K(0.43), K(-0.18)), V3(s * K(0.09), K(0.31), K(-0.7)), K(0.035), M.frame); }
  bx(b, K(0.32), K(0.28), K(0.42), 0, K(0.42), K(0.06), M.engine); bx(b, K(0.28), K(0.2), K(0.2), 0, K(0.6), K(0.24), M.engine, -0.5); bx(b, K(0.34), K(0.3), K(0.05), 0, K(0.6), K(0.42), M.dark, -0.2);
  // bodywork
  pod(C, { zf: K(1.0), zb: K(0.44), w: K(0.2), b: K(0.62), tops: [[K(1.0), K(0.74)], [K(0.9), K(0.87)], [K(0.62), K(1.0)], [K(0.44), K(1.0)]], round: K(0.32), top: 0.55 }); // the pointed upper fairing
  pod(C, { zf: K(0.72), zb: K(-0.02), w: K(big ? 0.285 : 0.27), b: K(0.4), tops: [[K(0.72), K(0.72)], [K(0.45), K(0.83)], [K(0.1), K(0.8)], [K(-0.02), K(0.7)]], round: K(0.14), top: 0.9 }); // side fairings
  pod(C, { zf: K(0.56), zb: K(0.0), w: K(big ? 0.29 : 0.275), b: K(0.36), tops: [[K(0.56), K(0.52)], [K(0.3), K(0.54)], [K(0.0), K(0.5)]], round: K(0.1) }, M.dark); // the black lower cowl
  pod(C, { zf: K(0.4), zb: K(-0.12), w: K(0.2), b: K(0.78), tops: [[K(0.4), K(0.98)], [K(0.2), K(1.02)], [K(-0.12), K(0.9)]], round: K(0.12) }); // tank
  pod(C, { zf: K(-0.38), zb: K(-1.0), w: K(0.15), b: K(0.76), tops: [[K(-0.38), K(0.85)], [K(-0.68), K(0.94)], [K(-1.0), K(0.98)]], round: K(0.2), top: 0.65 }); // tail
  pod(C, { zf: K(-0.1), zb: K(-0.44), w: K(0.15), b: K(0.8), tops: [[K(-0.1), K(0.83)], [K(-0.44), K(0.86)]], round: K(0.05) }, M.seat); // rider seat
  pod(C, { zf: K(-0.46), zb: K(-0.7), w: K(0.11), b: K(0.86), tops: [[K(-0.46), K(0.93)], [K(-0.7), K(0.96)]], round: K(0.05) }, M.seat); // passenger seat
  for (const s of [-1, 1]) bx(b, K(0.13), K(0.2), 0.012, s * K(0.06), K(1.03), K(0.6), M.smoke, -1.2, s * 0.22); // a smoked windscreen that wraps around (two angled halves)
  for (const s of [-1, 1]) {
    bx(b, K(0.11), K(0.05), 0.03, s * K(0.075), K(0.8), K(0.955), M.light, -0.35, s * 0.45); // twin headlights
    bx(b, 0.012, K(0.05), K(0.22), s * K(big ? 0.29 : 0.275), K(0.66), K(0.35), M.dark, 0, 0, s * 0.1); bx(b, 0.012, K(0.035), K(0.16), s * K(big ? 0.29 : 0.275), K(0.6), K(0.32), M.dark); // side vents
    bx(b, 0.012, K(0.03), K(0.55), s * K(big ? 0.29 : 0.275), K(0.74), K(0.3), M.white, 0.12); // a white stripe
    tube(b, V3(s * K(0.18), K(0.95), K(0.66)), V3(s * K(0.3), K(0.99), K(0.62)), 0.012, M.dark); bx(b, K(0.1), K(0.06), K(0.03), s * K(0.32), K(1.0), K(0.62), M.dark); // mirrors
    if (big) bx(b, 0.012, K(0.08), K(0.2), s * K(0.285), K(0.72), K(0.75), M.dark); // winglets
  }
  bx(b, K(0.12), K(0.04), 0.03, 0, K(0.93), K(-1.0), M.tail, 0.3); // taillight
  tube(b, V3(0, K(0.8), K(-0.92)), V3(0, K(0.62), K(-1.1)), 0.015, M.dark); bx(b, K(0.18), K(0.12), 0.015, 0, K(0.58), K(-1.12), M.white, 0.3); // plate bracket
  bx(b, K(0.12), K(0.04), K(0.5), 0, K(0.66), K(-0.6), M.dark); // rear hugger
  // exhaust: headers under the engine, a short muffler on the right by the back wheel
  tube(b, V3(K(0.06), K(0.32), K(0.32)), V3(K(0.12), K(0.27), K(-0.12)), K(0.03), M.chrome); tube(b, V3(K(0.12), K(0.27), K(-0.12)), V3(K(0.17), K(0.42), K(-0.32)), K(0.035), M.chrome);
  cy(b, K(big ? 0.085 : 0.075), K(0.42), K(0.18), K(0.5), K(-0.48), M.dark, 14, Math.PI / 2 - 0.35); cy(b, K(0.05), K(0.03), K(0.18), K(0.57), K(-0.68), M.chrome, 12, Math.PI / 2 - 0.35);
  // front end: silver forks with black lowers, clip-on bars, a front fender, brake discs (turn with the front wheel)
  const fork = new THREE.Group(); fork.position.set(0, 0, K(0.7)); b.add(fork); C.forks = [fork];
  for (const s of [-1, 1]) { tube(fork, V3(s * K(0.085), K(0.42), K(-0.05)), V3(s * K(0.085), K(0.93), K(-0.25)), K(0.03), M.frame); tube(fork, V3(s * K(0.085), K(0.29), 0), V3(s * K(0.085), K(0.45), K(-0.06)), K(0.038), M.dark); }
  for (const s of [-1, 1]) tube(fork, V3(s * K(0.085), K(0.9), K(-0.26)), V3(s * K(0.27), K(0.87), K(-0.32)), K(0.018), M.dark);
  bx(fork, K(0.13), K(0.035), K(0.4), 0, K(0.62), K(0.02), P, 0.15);
  for (const s of [-1, 1]) cy(fork, K(0.14), 0.01, s * K(0.07), K(0.29), 0, M.frame, 16, 0, Math.PI / 2);
  cy(b, K(0.11), 0.01, -K(0.08), K(0.31), K(-0.7), M.frame, 16, 0, Math.PI / 2);
  // 17-inch wheels on fat street tires
  wheel(C, 0, K(0.7), K(0.29), K(0.11), 1, { bike: true }); wheel(C, 0, K(-0.7), K(0.31), K(big ? 0.19 : 0.15), 0, { bike: true });
  for (const w of C.wheels) w.knobs.visible = false;
}
// a police car: white doors, a push bar and a red + blue light bar on the roof
function police(C, fast) {
  // a police sedan (the fast one is lower and sleeker): black + white doors, push bar, light bar
  const b = C.body, P = C.paint, r = fast ? 0.38 : 0.42, roof = fast ? 1.36 : 1.52;
  C.len = 4.9; C.wid = 2.1; C.seat.set(0.42, 0.25, -0.15); C.hitch = null; C.hood = null;
  const S = shell(C, { zf: 2.45, zb: -2.45, w: 1.0, b: 0.38, s: 0.92, hood: 0.9, cowl: 1.0, roof, ws: 0.92, wt: 0.15, rb: -0.95, rg: -1.62, deck: 1.04, wheels: [[1.5, r + 0.04], [-1.45, r + 0.04]], nose: 0.3, drop: 0.12, roofW: 0.84, hoodW: 0.95 });
  for (const s of [-1, 1]) { const q = at(S, -0.05); bx(b, 0.02, q.s - q.b - 0.12, 1.92, s * ((q.w + q.wb) / 2 + 0.008), (q.s + q.b) / 2 + 0.03, -0.05, fast ? M.dark : M.white); bx(b, 0.03, 0.28, 0.28, s * ((q.w + q.wb) / 2 + 0.02), 0.68, 0.3, new THREE.MeshBasicMaterial({ color: 0xffd23a })); }
  seam(C, S, 0.92); seam(C, S, -0.05); seam(C, S, -1.0); handle(C, S, 0.1); handle(C, S, -0.85); mirror(C, S, 0.8); pillar(C, S, -0.05, M.dark, 0.14);
  bx(b, 1.4, 0.1, 0.34, 0, roof + 0.02, -0.35, M.dark);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x6a1a1a })); red.position.set(-0.36, roof + 0.15, -0.35); b.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x1a2a6a })); blue.position.set(0.36, roof + 0.15, -0.35); b.add(blue);
  C.lights = [red, blue];
  bx(b, 1.5, 0.34, 0.12, 0, 0.5, 2.6, M.dark); for (const s of [-1, 1]) { bx(b, 0.1, 0.6, 0.1, s * 0.6, 0.48, 2.56, M.dark); bx(b, 0.4, 0.12, 0.05, s * 0.66, 0.78, 2.43, M.light); bx(b, 0.42, 0.14, 0.05, s * 0.64, 0.88, -2.44, M.tail); }
  bx(b, 1.96, 0.18, 0.16, 0, 0.44, 2.44, M.dark); bx(b, 1.96, 0.2, 0.16, 0, 0.46, -2.44, M.dark);
  C.pipes.push(V3(0.45, 0.34, -2.46));
  for (const [x, z, f] of [[0.86, 1.5, 1], [-0.86, 1.5, 1], [0.86, -1.45, 0], [-0.86, -1.45, 0]]) wheel(C, x, z, r, 0.32, f);
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
