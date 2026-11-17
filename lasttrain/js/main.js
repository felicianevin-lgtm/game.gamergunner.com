// LAST TRAIN WEST (game.gamergunner.com/lasttrain/): ride an old steam train 12 km across the haunted desert to
// Sundown Station. Feed the furnace with coal, loot the towns, cabins, mines and wagons along the line, shoot the
// undead, haul their bodies to the Sheriff for bounty money, sell gold + valuables at the store, buy guns, blow the
// bank vaults open with dynamite, raid Fort Cinder's armory and face the Pale Baron in Crimson Keep.
// Nights bring the undead; every third night is a BLOOD MOON and the vampires come out.
// Stars you earn on a run unlock new classes. Test hook: window.LT (see the bottom).
import * as THREE from "/create/vendor/three.module.js";
import { SFX, audio, music, setMuted, isMuted } from "./sfx.js";
import { World, groundH, LEN, DECK, MAT } from "./world.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TEST = Q.has("test");
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- save (stars + which classes are unlocked)
const SAVE_KEY = "gv_train_save";
let save = { stars: 0, best: 0, wins: 0, cls: "drifter", got: ["drifter"] };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")); } catch {}
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

const CLASSES = [
  { id: "drifter", name: "Drifter", icon: "🤠", cost: 0, shirt: 0x7a4a2a, desc: "A shovel, a revolver and a dream. Starts with $40." },
  { id: "doctor", name: "Doctor", icon: "🩺", cost: 4, shirt: 0xe8e8e8, desc: "Starts with 5 bandages. Bandages heal twice as much." },
  { id: "miner", name: "Miner", icon: "⛏️", cost: 6, shirt: 0x4a5a7a, desc: "A pickaxe that hits hard. The train starts with a full furnace." },
  { id: "gunslinger", name: "Gunslinger", icon: "🔫", cost: 9, shirt: 0x2a2a2a, desc: "Starts with a shotgun and 16 shells. Reloads faster." },
  { id: "preacher", name: "Preacher", icon: "✝️", cost: 12, shirt: 0x1a1a2a, desc: "Starts with 4 holy water. Vampires hurt you half as much." },
  { id: "conductor", name: "Conductor", icon: "🚂", cost: 16, shirt: 0x2a3a6a, desc: "The train burns 35% less coal and goes 15% faster." },
];

// ---------------------------------------------------------------- 3D setup
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: TEST });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8c89a, 60, 420);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xfff0d8, 0x8a6a4a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 }); sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf0f0ff, fog: false })); scene.add(moon);
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })); scene.add(sunBall);
const stars = (() => { const p = []; for (let i = 0; i < 900; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.3 + 0.1; p.push(Math.cos(a) * Math.cos(b) * 700, Math.sin(b) * 700, Math.sin(a) * Math.cos(b) * 700); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true })); })();
scene.add(stars);
function resize() { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

const world = new World(scene);
const L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
const box = (p, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; p.add(b); return b; };

// ---------------------------------------------------------------- people (the player + the undead are blocky folks)
function makeHuman(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = L(o.skin), shirt = L(o.shirt), pants = L(o.pants || 0x3a3a4a);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.17, 0.85, 0); legR.position.set(0.17, 0.85, 0);
  box(legL, 0.28, 0.85, 0.3, 0, -0.42, 0, pants); box(legR, 0.28, 0.85, 0.3, 0, -0.42, 0, pants);
  box(legL, 0.3, 0.14, 0.4, 0, -0.8, 0.05, L(0x2a1a10)); box(legR, 0.3, 0.14, 0.4, 0, -0.8, 0.05, L(0x2a1a10));
  body.add(legL, legR);
  box(body, 0.66, 0.75, 0.38, 0, 1.22, 0, shirt);
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.45, 1.52, 0); armR.position.set(0.45, 1.52, 0);
  box(armL, 0.22, 0.7, 0.24, 0, -0.32, 0, shirt); box(armR, 0.22, 0.7, 0.24, 0, -0.32, 0, shirt);
  box(armL, 0.2, 0.16, 0.22, 0, -0.72, 0, skin); box(armR, 0.2, 0.16, 0.22, 0, -0.72, 0, skin);
  body.add(armL, armR);
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  box(head, 0.46, 0.46, 0.44, 0, 0.23, 0, skin);
  const eye = o.eyes ? new THREE.MeshBasicMaterial({ color: o.eyes }) : L(0x111111);
  box(head, 0.08, 0.07, 0.02, -0.1, 0.28, 0.225, eye); box(head, 0.08, 0.07, 0.02, 0.1, 0.28, 0.225, eye);
  if (o.hat === "cowboy") { box(head, 0.8, 0.05, 0.75, 0, 0.48, 0, L(o.hatC || 0x5a3a20)); box(head, 0.46, 0.24, 0.44, 0, 0.6, 0, L(o.hatC || 0x5a3a20)); }
  if (o.hat === "kepi") { box(head, 0.48, 0.2, 0.46, 0, 0.55, 0, L(0x2a3a6a)); box(head, 0.4, 0.04, 0.2, 0, 0.47, 0.28, L(0x1a1a1a)); }
  if (o.hat === "crown") for (let i = 0; i < 5; i++) box(head, 0.1, 0.22, 0.1, Math.cos(i * 1.26) * 0.2, 0.58, Math.sin(i * 1.26) * 0.2, L(0xffc83a, 0x3a2a00));
  if (o.cape) { const c = box(body, 0.75, 1.3, 0.06, 0, 0.95, -0.24, L(o.cape)); c.rotation.x = 0.08; box(body, 0.8, 0.35, 0.12, 0, 1.55, -0.16, L(o.cape)); }
  if (o.hair) box(head, 0.48, 0.12, 0.46, 0, 0.48, -0.02, L(o.hair));
  root.scale.setScalar(o.scale || 1);
  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { root, body, legL, legR, armL, armR, head, t: Math.random() * 6 };
}
function animHuman(h, speed, dt, attack = 0) {
  h.t += dt * (2 + speed * 1.6); const s = Math.min(1, speed / 3) * 0.8;
  h.legL.rotation.x = Math.sin(h.t) * s; h.legR.rotation.x = -Math.sin(h.t) * s;
  h.armL.rotation.x = -Math.sin(h.t) * s * 0.8; h.armR.rotation.x = Math.sin(h.t) * s * 0.8;
  if (h.zombie) { h.armL.rotation.x = -1.4 + Math.sin(h.t * 0.5) * 0.1; h.armR.rotation.x = -1.4 - Math.sin(h.t * 0.5) * 0.1; }
  if (attack > 0) { h.armR.rotation.x = -2.6 + attack * 2.6; h.armL.rotation.x = -2.6 + attack * 2.6; }
}

// ---------------------------------------------------------------- the train
const TR = { x: 30, v: 0, throttle: 0, fuel: 60, maxFuel: 100, dist: 0 };
const SPEEDS = [0, 6, 12, 18];
const train = new THREE.Group(); scene.add(train);
const tcols = []; // colliders in train space (x along the train)
const tcol = (x0, x1, y0, y1, z0, z1) => tcols.push({ lx0: x0, lx1: x1, y0, y1, z0, z1, train: true, x0: 0, x1: 0 });
let lever, furnaceGlow, headLight, gatlingG, smokePuffs = [];
{
  const black = L(0x22232a), red = L(0x8a1e1a), brass = new THREE.MeshPhongMaterial({ color: 0xd8a83a, shininess: 70 }), wood = L(0x7a4a2a), iron = L(0x3a3a42);
  box(train, 26.8, 0.5, 3, -2.8, DECK - 0.25, 0, black); tcol(-16.2, 10.6, 0.4, DECK, -1.5, 1.5);
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 8.6, 18), black); boiler.rotation.z = Math.PI / 2; boiler.position.set(6, DECK + 1.25, 0); boiler.castShadow = true; train.add(boiler);
  tcol(1.5, 10.6, DECK, DECK + 2.5, -1.15, 1.15);
  for (const x of [3, 6, 9]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.05, 6, 24), brass); r.rotation.y = Math.PI / 2; r.position.set(x, DECK + 1.25, 0); train.add(r); }
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 1.9, 12), black); stack.position.set(9, DECK + 3.1, 0); train.add(stack);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), brass); dome.position.set(5.5, DECK + 2.45, 0); train.add(dome);
  const cow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 4), red); cow.rotation.z = -Math.PI / 2; cow.rotation.x = Math.PI / 4; cow.position.set(11.1, 0.8, 0); cow.scale.set(1, 0.6, 1); train.add(cow);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), brass); lamp.rotation.z = Math.PI / 2; lamp.position.set(10.6, DECK + 2.6, 0); train.add(lamp);
  headLight = new THREE.SpotLight(0xffe0a0, 0, 90, 0.45, 0.4, 1.2); headLight.position.set(10.9, DECK + 2.6, 0); headLight.target.position.set(40, 0, 0); train.add(headLight, headLight.target);
  // the cab
  box(train, 0.15, 2.6, 2.9, 1.5, DECK + 1.3, 0, red);
  for (const s of [-1, 1]) { box(train, 2.3, 1.0, 0.12, 0.35, DECK + 0.5, s * 1.44, red); tcol(-0.8, 1.5, DECK, DECK + 1.0, s > 0 ? 1.35 : -1.5, s > 0 ? 1.5 : -1.35); box(train, 0.12, 1.6, 0.12, -0.8, DECK + 1.8, s * 1.44, red); }
  box(train, 3.8, 0.18, 3.3, -0.25, DECK + 2.7, 0, L(0x4a2a1a)); tcol(-2.1, 1.6, DECK + 2.6, DECK + 2.8, -1.65, 1.65);
  furnaceGlow = box(train, 0.05, 0.6, 0.8, 1.42, DECK + 0.7, 0, new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  box(train, 0.06, 0.75, 0.95, 1.44, DECK + 0.7, 0, iron).scale.set(1, 1, 1); furnaceGlow.position.x = 1.4;
  lever = new THREE.Group(); lever.position.set(0.9, DECK + 0.5, 0.95); train.add(lever); box(lever, 0.08, 0.9, 0.08, 0, 0.45, 0, brass); box(lever, 0.18, 0.18, 0.18, 0, 0.9, 0, red);
  // the tender (coal car) + the cargo car
  for (const s of [-1, 1]) { box(train, 5.2, 0.9, 0.12, -5, DECK + 0.45, s * 1.44, black); tcol(-7.6, -2.4, DECK, DECK + 0.9, s > 0 ? 1.35 : -1.5, s > 0 ? 1.5 : -1.35); }
  const heap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 6), L(0x1a1a1e)); heap.position.set(-5, DECK + 0.4, 0); heap.scale.set(1.8, 1, 1); train.add(heap);
  for (const s of [-1, 1]) for (const [a, b] of [[-16, -13], [-11, -8]]) { box(train, b - a, 0.12, 0.1, (a + b) / 2, DECK + 0.55, s * 1.44, wood); tcol(a, b, DECK, DECK + 0.6, s > 0 ? 1.35 : -1.5, s > 0 ? 1.5 : -1.35); }
  for (const s of [-1, 1]) for (let x = -16; x <= -8; x += 1.5) box(train, 0.12, 0.6, 0.12, x, DECK + 0.3, s * 1.44, wood);
  box(train, 8.4, 0.08, 2.9, -12, DECK + 0.02, 0, wood);
  for (const x of [-15, -12.5, -10, -6.5, -3.5, 0, 3, 6, 9]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(x > -1 && x < 7 ? 0.75 : 0.5, x > -1 && x < 7 ? 0.75 : 0.5, 0.2, 16), red); w.rotation.x = Math.PI / 2; w.position.set(x, x > -1 && x < 7 ? 0.75 : 0.5, s * 0.95); train.add(w); w.userData.wheel = true; }
  // the gatling gun (only once you buy it)
  gatlingG = new THREE.Group(); gatlingG.position.set(-14.5, DECK, 0); gatlingG.visible = false; train.add(gatlingG);
  box(gatlingG, 0.1, 1.1, 0.1, 0, 0.55, 0, iron);
  const barrel = new THREE.Group(); barrel.position.y = 1.15; gatlingG.add(barrel); gatlingG.userData.barrel = barrel;
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), brass); b.rotation.z = Math.PI / 2; b.position.set(0.5, Math.cos(i) * 0.1, Math.sin(i) * 0.1); barrel.add(b); }
  box(barrel, 0.5, 0.3, 0.3, -0.1, 0, 0, iron);
  train.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
}
const FURNACE = new THREE.Vector3(1.2, DECK + 0.7, 0), LEVER = new THREE.Vector3(0.9, DECK + 0.9, 0.95), GAT = new THREE.Vector3(-14.5, DECK, 0);
const trainPt = (v) => new THREE.Vector3(TR.x + v.x, v.y, v.z);
function syncTrainCols() { for (const c of tcols) { c.x0 = TR.x + c.lx0; c.x1 = TR.x + c.lx1; } }
syncTrainCols();
const smokeMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.35, depthWrite: false });
const smokeGeo = new THREE.SphereGeometry(0.6, 8, 6);

// ---------------------------------------------------------------- collisions (boxes) for everything that walks or falls
function nearCols(x) { const out = []; for (const c of world.cols) if (c.x1 > x - 8 && c.x0 < x + 8) out.push(c); if (Math.abs(x - TR.x) < 30) out.push(...tcols); return out; }
// moves an entity e {x,y,z,vx,vy,vz,r,h} for dt, against the ground + boxes. Sets e.ground + e.onTrain
function physics(e, dt, grav = 22) {
  e.vy -= grav * dt; e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt;
  const cols = nearCols(e.x); e.blocked = false;
  for (const c of cols) {
    if (e.y + 0.4 >= c.y1 || e.y + e.h <= c.y0) continue;
    const ox = Math.min(e.x + e.r - c.x0, c.x1 - (e.x - e.r)), oz = Math.min(e.z + e.r - c.z0, c.z1 - (e.z - e.r));
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) e.x += e.x < (c.x0 + c.x1) / 2 ? -ox : ox; else e.z += e.z < (c.z0 + c.z1) / 2 ? -oz : oz;
    e.blocked = true;
  }
  let gy = groundH(e.x, e.z), onT = false;
  for (const c of cols) if (e.x > c.x0 - e.r * 0.5 && e.x < c.x1 + e.r * 0.5 && e.z > c.z0 - e.r * 0.5 && e.z < c.z1 + e.r * 0.5 && c.y1 <= e.y + 0.45 && c.y1 > gy) { gy = c.y1; onT = !!c.train; }
  e.ground = false;
  if (e.y <= gy) { e.y = gy; e.vy = Math.max(0, e.vy); e.ground = true; }
  e.onTrain = e.ground && onT;
}
// a ray against boxes: returns the distance to the first wall (or max)
function rayWalls(o, d, max) {
  let best = max;
  for (const c of [...world.cols, ...tcols]) {
    let t0 = 0, t1 = best;
    for (const [oa, da, a0, a1] of [[o.x, d.x, c.x0, c.x1], [o.y, d.y, c.y0, c.y1], [o.z, d.z, c.z0, c.z1]]) {
      if (Math.abs(da) < 1e-6) { if (oa < a0 || oa > a1) { t0 = 1e9; break; } continue; }
      let ta = (a0 - oa) / da, tb = (a1 - oa) / da; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) break;
    }
    if (t0 <= t1 && t0 < best && t0 > 0.05) best = t0;
  }
  return best;
}
function rayBox(o, d, x0, x1, y0, y1, z0, z1) {
  let t0 = 0, t1 = 1e9;
  for (const [oa, da, a0, a1] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(da) < 1e-6) { if (oa < a0 || oa > a1) return -1; continue; }
    let ta = (a0 - oa) / da, tb = (a1 - oa) / da; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
  }
  return t0;
}

// ---------------------------------------------------------------- weapons
const WEAPONS = {
  shovel: { name: "Shovel", icon: "🪏", melee: true, dmg: 34, rate: 1.7, range: 2.4 },
  pickaxe: { name: "Pickaxe", icon: "⛏️", melee: true, dmg: 60, rate: 1.3, range: 2.4 },
  revolver: { name: "Revolver", icon: "🔫", dmg: 34, rate: 2.6, mag: 6, reload: 1.6, ammo: "pistol", spread: 0.012, pellets: 1, snd: "revolver", price: 0 },
  shotgun: { name: "Shotgun", icon: "💥", dmg: 15, rate: 1.1, mag: 4, reload: 2.3, ammo: "shells", spread: 0.085, pellets: 8, snd: "shotgun", price: 120 },
  rifle: { name: "Rifle", icon: "🎯", dmg: 95, rate: 0.95, mag: 5, reload: 2.2, ammo: "rifle", spread: 0.002, pellets: 1, snd: "rifle", price: 220, zoom: true },
};
const AMMO = { pistol: { name: "Revolver rounds", n: 12, price: 8 }, shells: { name: "Shotgun shells", n: 8, price: 12 }, rifle: { name: "Rifle rounds", n: 10, price: 15 } };

// ---------------------------------------------------------------- items you can carry (one at a time) or grab
const ITEMS = {
  coal: { name: "Coal", fuel: 22, color: 0x222226, size: [0.6, 0.45, 0.6] },
  lumber: { name: "Lumber", fuel: 11, color: 0x9a6a3a, size: [1.4, 0.25, 0.35] },
  chair: { name: "Chair", fuel: 8, color: 0x7a4a2a, size: [0.5, 1.0, 0.5] },
  gold: { name: "Gold bar", value: 120, color: 0xffc83a, size: [0.5, 0.2, 0.25], shiny: true },
  silver: { name: "Silver bar", value: 60, color: 0xd8dce4, size: [0.5, 0.2, 0.25], shiny: true },
  jewels: { name: "Jewelry box", value: 45, color: 0x8a2a6a, size: [0.4, 0.3, 0.3] },
  painting: { name: "Painting", value: 50, color: 0xc89a4a, size: [0.9, 0.7, 0.08] },
  watch: { name: "Pocket watch", value: 25, color: 0xd8a83a, size: [0.22, 0.22, 0.08], shiny: true },
  crown: { name: "The Baron's Crown", value: 500, color: 0xffc83a, size: [0.5, 0.35, 0.5], shiny: true },
  dynamite: { name: "Dynamite", color: 0xc0302a, size: [0.5, 0.2, 0.2] },
  corpse: { name: "Body" },
  // grab-and-go
  cash: { name: "Money bag", grab: true, color: 0xb89a6a, size: [0.4, 0.45, 0.4] },
  ammo: { name: "Ammo box", grab: true, color: 0x5a6a2a, size: [0.5, 0.35, 0.35] },
  bandage: { name: "Bandage", grab: true, color: 0xf0f0f0, size: [0.3, 0.3, 0.3] },
  holy: { name: "Holy water", grab: true, color: 0x6ac0ff, size: [0.2, 0.4, 0.2], shiny: true },
  gun_shotgun: { name: "Shotgun", grab: true, color: 0x4a3a2a, size: [1.1, 0.15, 0.2] },
  gun_rifle: { name: "Rifle", grab: true, color: 0x3a2a1a, size: [1.4, 0.15, 0.2] },
};
const items = [];
const shinyMat = {};
function itemMesh(type) {
  const d = ITEMS[type]; const g = new THREE.Group();
  const m = d.shiny ? (shinyMat[type] ||= new THREE.MeshPhongMaterial({ color: d.color, shininess: 90, emissive: d.color, emissiveIntensity: 0.15 })) : L(d.color);
  box(g, ...d.size, 0, d.size[1] / 2, 0, m);
  if (type === "bandage") box(g, 0.32, 0.08, 0.32, 0, 0.15, 0, L(0xd02a2a));
  if (type === "dynamite") box(g, 0.04, 0.25, 0.04, 0.2, 0.3, 0, L(0xeeeeee));
  if (type === "chair") { box(g, 0.5, 0.08, 0.5, 0, 0.5, 0, L(0x5a3a1a)); g.children[0].scale.set(1, 1, 0.15); g.children[0].position.z = -0.22; }
  if (type === "cash") box(g, 0.2, 0.15, 0.2, 0, 0.5, 0, L(0x8a7a4a));
  return g;
}
function addItem(type, x, y, z, extra = {}) {
  const it = { type, x, y, z, vx: 0, vy: 0, vz: 0, r: 0.3, h: 0.4, mesh: extra.mesh || itemMesh(type), ...extra };
  it.mesh.rotation.y = Math.random() * 6; scene.add(it.mesh); items.push(it); return it;
}
function removeItem(it) { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); scene.remove(it.mesh); }

// ---------------------------------------------------------------- the undead
const FOES = {
  walker: { name: "Walker", hp: 70, speed: 2.6, dmg: 10, bounty: 15, skin: 0x8aa86a, shirt: 0x6a5a4a, zombie: true },
  runner: { name: "Runner", hp: 45, speed: 6.8, dmg: 8, bounty: 20, skin: 0x9ab878, shirt: 0x8a3a2a, zombie: true },
  brute: { name: "Miner Brute", hp: 280, speed: 2.3, dmg: 26, bounty: 60, skin: 0x7a9a5a, shirt: 0x4a5a7a, scale: 1.4, zombie: true },
  soldier: { name: "Dead Soldier", hp: 125, speed: 3.6, dmg: 14, bounty: 35, skin: 0x8aa070, shirt: 0x2a3a6a, hat: "kepi", zombie: true },
  vamp: { name: "Vampire", hp: 170, speed: 8, dmg: 15, bounty: 80, skin: 0xe8e4f0, shirt: 0x1a1a22, cape: 0x8a0a1a, eyes: 0xff2020, hair: 0x111111, vamp: true },
  bat: { name: "Bat", hp: 18, speed: 9, dmg: 5, bounty: 0, fly: true },
  lord: { name: "The Pale Baron", hp: 1800, speed: 6, dmg: 30, bounty: 0, skin: 0xf0eef8, shirt: 0x2a0a14, cape: 0xa0101a, eyes: 0xff1010, hat: "crown", scale: 1.7, vamp: true, boss: true },
};
const foes = [];
const batGeo = new THREE.BoxGeometry(0.35, 0.25, 0.3), wingGeo = new THREE.BoxGeometry(0.6, 0.04, 0.3), batMat = L(0x1a1a1e), batEye = new THREE.MeshBasicMaterial({ color: 0xff2020 });
function spawnFoe(kind, x, z, y) {
  const d = FOES[kind];
  let model;
  if (d.fly) {
    const root = new THREE.Group(), b = new THREE.Mesh(batGeo, batMat), wl = new THREE.Mesh(wingGeo, batMat), wr = new THREE.Mesh(wingGeo, batMat);
    wl.position.x = -0.4; wr.position.x = 0.4; root.add(b, wl, wr); const e = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), batEye); e.position.set(0, 0.04, 0.16); root.add(e);
    model = { root, wl, wr, t: 0 };
  } else { model = makeHuman(d); model.zombie = d.zombie; }
  const f = { kind, d, x, z, y: y ?? groundH(x, z) + (d.fly ? 4 : 0), vx: 0, vy: 0, vz: 0, r: 0.4 * (d.scale || 1), h: 1.8 * (d.scale || 1), hp: d.hp, max: d.hp, model, atk: 0, cd: 0, yaw: 0, aggro: false, hit: 0, leap: 0 };
  scene.add(model.root); foes.push(f);
  return f;
}
function killFoe(f, burn) {
  foes.splice(foes.indexOf(f), 1);
  RUN.kills++;
  if (f.d.fly || burn) { scene.remove(f.model.root); puff(f.x, f.y + 1, f.z, burn ? 0x333333 : 0x1a1a1a, 10); return; }
  if (f.d.boss) { scene.remove(f.model.root); boom(f.x, f.y + 1, f.z, false); addItem("crown", f.x, f.y + 1, f.z); RUN.baron = true; banner("THE PALE BARON IS DUST!", "His crown is worth $500. The keep's chest is open."); SFX.win(); return; }
  // the body stays: carry it to the Sheriff for the bounty
  const m = f.model; m.body.rotation.x = -Math.PI / 2; m.body.position.y = 0.25 * (f.d.scale || 1); m.legL.rotation.x = m.legR.rotation.x = 0; m.armL.rotation.x = m.armR.rotation.x = -3;
  addItem("corpse", f.x, f.y, f.z, { mesh: m.root, bounty: f.d.bounty, foe: f.d.name, r: 0.5, h: 0.4, t: 0 });
}

// ---------------------------------------------------------------- effects: blood/dust puffs, tracers, explosions
const fx = [];
const fxGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
function puff(x, y, z, color, n = 6) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); scene.add(m); fx.push({ m, vx: rand(-3, 3), vy: rand(1, 5), vz: rand(-3, 3), t: rand(0.4, 0.8) }); } }
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe8a0, transparent: true });
function tracer(a, b) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, tracerMat.clone()); scene.add(l); fx.push({ line: l, t: 0.07 }); }
function boom(x, y, z, hurt = true) {
  SFX.boom(); shake = 0.8;
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 })); s.position.set(x, y, z); scene.add(s); fx.push({ ball: s, t: 0.5 });
  puff(x, y, z, 0x553322, 16);
  if (!hurt) return;
  for (const f of [...foes]) { const dd = Math.hypot(f.x - x, f.y + 1 - y, f.z - z); if (dd < 6) hurtFoe(f, 200 * (1 - dd / 7), x, z); }
  const dp = Math.hypot(P.x - x, P.y + 1 - y, P.z - z); if (dp < 5) hurtPlayer(50 * (1 - dp / 6));
}
let shake = 0;

// ---------------------------------------------------------------- the player
const P = { x: 22, y: DECK, z: 0, vx: 0, vy: 0, vz: 0, r: 0.38, h: 1.8, yaw: Math.PI / 2, pitch: -0.1, hp: 100, armor: 0, ground: true, onTrain: true };
let hero = null, heroGun = null, held = null, mounted = false, gatHeat = 0, fp = false, aiming = false;
const RUN = { money: 0, kills: 0, bounty: 0, start: 0, time: 0, baron: false, chest: false, over: false, won: false };
const INV = { weapons: [], cur: 0, ammo: { pistol: 0, shells: 0, rifle: 0 }, mag: {}, bandage: 0, holy: 0, gatling: false };
let reloadT = 0, fireCD = 0, healT = 0, meleeT = 0;

function startRun() {
  for (const f of [...foes]) scene.remove(f.model.root); foes.length = 0;
  for (const it of [...items]) removeItem(it);
  for (const p of world.places) { if (p.built) world.unbuild(p); p.gone = false; p.spawned = false; p.looted = false; }
  const cls = save.cls;
  Object.assign(TR, { x: 30, v: 0, throttle: 0, fuel: cls === "miner" ? 100 : 60 });
  Object.assign(P, { x: 22, y: DECK, z: 0, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, pitch: -0.1, hp: 100, armor: 0 });
  Object.assign(RUN, { money: cls === "drifter" ? 40 : 20, kills: 0, bounty: 0, time: 0, baron: false, chest: false, over: false, won: false, nights: 0, lastNight: false });
  Object.assign(INV, { weapons: [cls === "miner" ? "pickaxe" : "shovel", "revolver"], cur: 1, ammo: { pistol: 24, shells: 0, rifle: 0 }, mag: { revolver: 6 }, bandage: cls === "doctor" ? 5 : 2, holy: cls === "preacher" ? 4 : 0, gatling: false });
  if (cls === "gunslinger") { INV.weapons.push("shotgun"); INV.ammo.shells = 16; INV.mag.shotgun = 4; }
  held = null; mounted = false; gatlingG.visible = false; dayT = 0.05;
  if (hero) scene.remove(hero.root);
  hero = makeHuman({ skin: 0xe0b090, shirt: CLASSES.find((c) => c.id === cls).shirt, pants: 0x4a3a2a, hat: "cowboy" });
  heroGun = new THREE.Group(); hero.armR.add(heroGun); heroGun.position.set(0, -0.75, 0.1);
  scene.add(hero.root);
  syncTrainCols(); world.update(TR.x, onBuilt);
  setGunModel();
  RUN.start = performance.now();
}
function setGunModel() {
  heroGun.clear(); const w = INV.weapons[INV.cur]; const m = L(0x2a2a2e), wd = L(0x6a4428);
  if (w === "shovel") { box(heroGun, 0.06, 0.06, 1.2, 0, 0, 0.4, wd); box(heroGun, 0.3, 0.04, 0.35, 0, 0, 1.05, L(0x8a8a90)); }
  else if (w === "pickaxe") { box(heroGun, 0.07, 0.07, 1.1, 0, 0, 0.35, wd); box(heroGun, 0.9, 0.08, 0.1, 0, 0, 0.9, L(0x7a7a80)); }
  else if (w === "revolver") { box(heroGun, 0.08, 0.2, 0.12, 0, -0.05, 0.05, wd); box(heroGun, 0.07, 0.08, 0.45, 0, 0.06, 0.25, m); }
  else if (w === "shotgun") { box(heroGun, 0.1, 0.1, 1.1, 0, 0.04, 0.35, m); box(heroGun, 0.1, 0.18, 0.4, 0, -0.04, -0.15, wd); }
  else if (w === "rifle") { box(heroGun, 0.07, 0.08, 1.3, 0, 0.04, 0.45, m); box(heroGun, 0.1, 0.16, 0.5, 0, -0.04, -0.15, wd); box(heroGun, 0.06, 0.06, 0.3, 0, 0.13, 0.3, m); }
}

// ---------------------------------------------------------------- input
function lock() { try { const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch {} }
const keys = {};
let locked = false, mouseDown = false, playing = false;
addEventListener("keydown", (e) => {
  if (e.repeat) return; keys[e.code] = true; audio();
  if (!playing) return;
  if (e.code === "Escape" && panelOpen) closePanel();
  if (panelOpen) return;
  if (e.code === "KeyE") interact();
  if (e.code === "KeyR") reload();
  if (e.code === "KeyH") useBandage();
  if (e.code === "KeyG") throwHoly();
  if (e.code === "KeyQ" && held) throwHeld();
  if (e.code === "KeyV") fp = !fp;
  if (e.code === "KeyF" && near.lever) setThrottle(TR.throttle - 1);
  if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (INV.weapons[i]) { INV.cur = i; reloadT = 0; setGunModel(); SFX.click(); } }
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("wheel", (e) => { if (!playing || panelOpen || mounted) return; INV.cur = (INV.cur + (e.deltaY > 0 ? 1 : INV.weapons.length - 1)) % INV.weapons.length; reloadT = 0; setGunModel(); });
canvas.addEventListener("mousedown", (e) => {
  audio(); if (!playing || panelOpen) return;
  if (!locked) { lock(); return; }
  if (e.button === 0) mouseDown = true; if (e.button === 2) aiming = true;
});
addEventListener("mouseup", (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) aiming = false; });
addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle("locked", locked); if (!locked && playing && !panelOpen && !RUN.over) showPause(true); });
addEventListener("mousemove", (e) => { if (!locked) return; const k = aiming && WEAPONS[INV.weapons[INV.cur]]?.zoom ? 0.0008 : 0.0022; P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.2, 1.1); });

// ---------------------------------------------------------------- doing things (E)
const near = { lever: false, furnace: false, gat: false, inter: null, item: null };
function setThrottle(t) { t = clamp(t, 0, 3); if (t === TR.throttle) return; TR.throttle = t; SFX.lever(); if (t && TR.v < 1) SFX.whistle(); toast(["Throttle: STOP (brakes on)", "Throttle: SLOW", "Throttle: HALF", "Throttle: FULL STEAM"][t]); }
function scanNear() {
  const lv = trainPt(LEVER), fu = trainPt(FURNACE), ga = trainPt(GAT);
  near.lever = Math.hypot(P.x - lv.x, P.z - lv.z) < 1.7 && Math.abs(P.y - DECK) < 1;
  near.furnace = Math.hypot(P.x - fu.x, P.z - fu.z) < 2.2 && Math.abs(P.y - DECK) < 1;
  near.gat = INV.gatling && Math.hypot(P.x - ga.x, P.z - ga.z) < 1.8 && Math.abs(P.y - DECK) < 1;
  near.inter = null; let bd = 1e9;
  for (const it of world.inter) { const d = Math.hypot(P.x - it.x, P.z - it.z); if (d < it.r && d < bd) { bd = d; near.inter = it; } }
  for (const p of world.places) if (p.built && p.chestAt && Math.hypot(P.x - p.chestAt.x, P.z - p.chestAt.z) < 2.6) near.inter = { kind: "chest", p };
  near.item = null; bd = 2.4;
  const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw);
  for (const it of items) {
    if (it === held || it.flying) continue;
    const dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz);
    if (d > 2.6 || Math.abs(it.y - P.y) > 1.6) continue;
    const s = d - (dx * fx2 + dz * fz2) / Math.max(0.01, d) * 0.8;
    if (s < bd) { bd = s; near.item = it; }
  }
}
function interact() {
  if (mounted) { mounted = false; toast("Off the gatling gun"); return; }
  if (near.gat && !held) { mounted = true; toast("On the gatling gun: click to fire, E to get off"); return; }
  if (near.lever && !held) { setThrottle(TR.throttle >= 3 ? 0 : TR.throttle + 1); return; }
  if (held) {
    const d = ITEMS[held.type];
    if (near.furnace && d.fuel) return burn(held);
    const it = near.inter;
    if (it && it.kind === "sheriff" && held.type === "corpse") { pay(held.bounty, `Bounty: ${held.foe} +$${held.bounty}`); RUN.bounty += held.bounty; removeItem(held); held = null; return; }
    if (it && (it.kind === "store" || it.kind === "guns") && d.value) { pay(d.value, `Sold ${d.name} +$${d.value}`); removeItem(held); held = null; return; }
    if (it && it.kind === "sheriff" && d.value) { pay(Math.round(d.value * 0.8), `The Sheriff paid $${Math.round(d.value * 0.8)} for the ${d.name}`); removeItem(held); held = null; return; }
    if (it && it.kind === "vault" && held.type === "dynamite") { const v = it; removeItem(held); held = null; lightDynamite(v.x, P.y + 0.6, v.z, 3, v); toast("The fuse is lit! RUN!"); return; }
    dropHeld(); return;
  }
  if (near.item) return pickUp(near.item);
  const it = near.inter;
  if (!it) return;
  if (it.kind === "store" || it.kind === "guns") return openShop(it);
  if (it.kind === "sheriff") return toast("Sheriff: \"Bring me the bodies of the undead. I pay bounty on every one.\" (carry one here and press E)");
  if (it.kind === "vault") return toast(it.open ? "The vault is empty now." : "The vault is locked tight. A stick of dynamite would open it... (buy one at a store)");
  if (it.kind === "chest") {
    if (it.p.type === "keep" && !RUN.baron) return toast("The Baron's chest is sealed by dark magic. Destroy the Pale Baron first!");
    if (it.p.looted) return toast("The chest is empty.");
    it.p.looted = true; SFX.cash();
    for (let i = 0; i < 3; i++) addItem("gold", it.p.chestAt.x + rand(-1, 1), P.y + 1, it.p.chestAt.z + rand(-1, 1));
    addItem("cash", it.p.chestAt.x, P.y + 1, it.p.chestAt.z, { amount: 150 }); toast("The chest bursts open: gold!");
  }
}
function pay(n, msg) { RUN.money += n; SFX.cash(); toast(msg); bumpMoney(); }
function pickUp(it) {
  const d = ITEMS[it.type];
  if (d.grab) {
    removeItem(it); SFX.pick();
    if (it.type === "cash") { const n = it.amount || Math.round(rand(10, 45)); RUN.money += n; toast(`+$${n}`); bumpMoney(); SFX.coin(); }
    if (it.type === "ammo") { const k = ["pistol", "pistol", "shells", "rifle"][Math.floor(Math.random() * 4)]; INV.ammo[k] += AMMO[k].n; toast(`+${AMMO[k].n} ${AMMO[k].name}`); }
    if (it.type === "bandage") { INV.bandage++; toast("+1 Bandage (H to use)"); }
    if (it.type === "holy") { INV.holy++; toast("+1 Holy water (G to throw, hurts vampires a lot)"); }
    if (it.type.startsWith("gun_")) { const w = it.type.slice(4); if (!INV.weapons.includes(w)) { INV.weapons.push(w); INV.mag[w] = WEAPONS[w].mag; toast(`You got the ${WEAPONS[w].name}! (${INV.weapons.length})`); } INV.ammo[WEAPONS[w].ammo] += AMMO[WEAPONS[w].ammo].n; }
    return;
  }
  held = it; it.vx = it.vz = it.vy = 0; SFX.pick();
  toast(`Carrying: ${it.type === "corpse" ? "the body of a " + it.foe + " ($" + it.bounty + " bounty)" : d.name}. E = put down, Q = throw`);
}
function dropHeld() { if (!held) return; const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw); held.x = P.x + fx2 * 0.9; held.z = P.z + fz2 * 0.9; held.y = P.y + 0.9; held.vx = 0; held.vy = 0; held.vz = 0; held.flying = false; held = null; SFX.drop(); }
function throwHeld() { const it = held; held = null; const d = camDir(); it.x = P.x + d.x; it.y = P.y + 1.4; it.z = P.z + d.z; it.vx = d.x * 11 + (P.onTrain ? TR.v : 0); it.vy = d.y * 11 + 3; it.vz = d.z * 11; it.flying = true; it.ride = P.onTrain; SFX.swing(); }
function burn(it) {
  const d = ITEMS[it.type]; const k = save.cls === "conductor" ? 1.2 : 1;
  TR.fuel = Math.min(TR.maxFuel, TR.fuel + d.fuel * k); if (it === held) held = null; removeItem(it);
  SFX.furnace(); toast(`+${Math.round(d.fuel * k)} fuel (${d.name})`); flare = 1;
}
let flare = 0;
const dyn = [];
function lightDynamite(x, y, z, t, vault) { const m = itemMesh("dynamite"); m.position.set(x, y, z); scene.add(m); dyn.push({ m, x, y, z, t, vault, vx: 0, vy: 0, vz: 0, r: 0.2, h: 0.2 }); }
function useBandage() {
  if (healT > 0) return; if (INV.bandage <= 0) return toast("No bandages! Buy them at a store."); if (P.hp >= 100) return toast("You're already at full health.");
  INV.bandage--; healT = 2; SFX.heal(); toast("Patching up...");
}
function throwHoly() {
  if (INV.holy <= 0) return toast("No holy water! Stores sell it."); INV.holy--;
  const d = camDir(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8ad0ff }));
  m.position.set(P.x, P.y + 1.6, P.z); scene.add(m); holyShots.push({ m, x: P.x, y: P.y + 1.6, z: P.z, vx: d.x * 16, vy: d.y * 16 + 3, vz: d.z * 16, t: 3 }); SFX.swing();
}
const holyShots = [];

// ---------------------------------------------------------------- shooting
function camDir() { const d = new THREE.Vector3(); camera.getWorldDirection(d); return d; }
function reload() {
  const w = WEAPONS[INV.weapons[INV.cur]]; if (!w || w.melee || reloadT > 0) return;
  const id = INV.weapons[INV.cur]; if ((INV.mag[id] ?? 0) >= w.mag) return; if (INV.ammo[w.ammo] <= 0) return toast(`Out of ${AMMO[w.ammo].name}! Buy more at a store.`);
  reloadT = w.reload * (save.cls === "gunslinger" ? 0.6 : 1); SFX.reload();
}
function hurtFoe(f, dmg, sx, sz) {
  f.hp -= dmg; f.hit = 0.12; f.aggro = true; SFX.hit();
  puff(f.x, f.y + f.h * 0.6, f.z, f.d.vamp ? 0x4a0010 : 0x6a1010, 3);
  if (sx !== undefined && !f.d.boss) { const dx = f.x - sx, dz = f.z - sz, d = Math.hypot(dx, dz) || 1; f.vx += (dx / d) * 3; f.vz += (dz / d) * 3; }
  if (f.hp <= 0) killFoe(f);
}
function shoot(dt) {
  if (held) { if (mouseDown) { mouseDown = false; throwHeld(); } return; }
  const id = INV.weapons[INV.cur], w = WEAPONS[id];
  if (!mouseDown || fireCD > 0 || reloadT > 0) return;
  if (w.melee) {
    fireCD = 1 / w.rate; meleeT = 0.3; SFX.swing();
    const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw); let hit = false;
    for (const f of [...foes]) { const dx = f.x - P.x, dz = f.z - P.z, d = Math.hypot(dx, dz); if (d < w.range + f.r && (dx * fx2 + dz * fz2) / (d || 1) > 0.3 && Math.abs(f.y - P.y) < 2) { hurtFoe(f, w.dmg, P.x, P.z); hit = true; } }
    if (hit) SFX.thunk();
    return;
  }
  if ((INV.mag[id] ?? 0) <= 0) { SFX.empty(); mouseDown = false; reload(); return; }
  INV.mag[id]--; fireCD = 1 / w.rate; SFX[w.snd](); shake = Math.max(shake, w.pellets > 1 ? 0.3 : 0.15);
  if (w.rate < 2) mouseDown = false;
  const o = camera.position.clone(), base = camDir();
  const muzzle = new THREE.Vector3(); heroGun.getWorldPosition(muzzle); if (fp) muzzle.copy(o).addScaledVector(base, 0.5).add(new THREE.Vector3(0, -0.2, 0));
  const spread = w.spread * (aiming ? 0.4 : 1);
  for (let k = 0; k < w.pellets; k++) {
    const d = base.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(spread)).normalize();
    fireRay(o, d, w.dmg, muzzle);
  }
  P.pitch += w.pellets > 1 ? 0.04 : 0.015;
}
function fireRay(o, d, dmg, muzzle, maxD = 220) {
  const wall = rayWalls(o, d, maxD);
  let best = wall, bf = null;
  for (const f of foes) { const t = rayBox(o, d, f.x - f.r, f.x + f.r, f.y, f.y + f.h, f.z - f.r, f.z + f.r); if (t > 0 && t < best) { best = t; bf = f; } }
  const end = o.clone().addScaledVector(d, best);
  tracer(muzzle, end);
  if (bf) { const head = end.y > bf.y + bf.h * 0.8; hurtFoe(bf, dmg * (head ? 1.8 : 1), o.x, o.z); if (head) puff(end.x, end.y, end.z, 0xffffff, 2); }
  else if (best < maxD) puff(end.x, end.y, end.z, 0xc8a878, 2);
}
function gatling(dt) {
  const d = camDir(), bar = gatlingG.userData.barrel; bar.rotation.y = 0;
  gatlingG.rotation.y = Math.atan2(-d.z, d.x); bar.rotation.z = Math.asin(clamp(d.y, -0.6, 0.6));
  if (mouseDown && gatHeat < 1 && fireCD <= 0) {
    fireCD = 0.075; gatHeat += 0.022; SFX.gatling(); bar.rotation.x += 1;
    const o = camera.position.clone(), m = trainPt(GAT).add(new THREE.Vector3(0, 1.2, 0));
    fireRay(o, d.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.02)).normalize(), 20, m);
  }
  if (gatHeat >= 1) { gatHeat = 1.5; toast("The gatling gun OVERHEATED! Wait for it to cool."); }
}
function hurtPlayer(n, vamp) {
  if (RUN.over) return;
  if (vamp && save.cls === "preacher") n *= 0.5;
  if (P.armor > 0) { const a = Math.min(P.armor, n * 0.6); P.armor -= a; n -= a; }
  P.hp -= n; SFX.hurt(); $("hurt").style.opacity = 0.9; shake = Math.max(shake, 0.3);
  if (P.hp <= 0) gameOver(false);
}

// ---------------------------------------------------------------- shops
let panelOpen = false;
function openShop(it) {
  panelOpen = true; document.exitPointerLock?.(); mouseDown = false;
  const guns = it.kind === "guns";
  const rows = guns ? [
    ["Shotgun", "8 pellets, huge up close", 120, () => giveGun("shotgun")],
    ["Rifle", "Long range, right-click to aim", 220, () => giveGun("rifle")],
    ["Armor vest", "Soaks up 60% of hits (50 armor)", 90, () => { P.armor = Math.min(100, P.armor + 50); }],
    ["Gatling gun for the train", "Bolted to the cargo car. E to man it", 450, () => { if (INV.gatling) return false; INV.gatling = true; gatlingG.visible = true; }],
    ...Object.entries(AMMO).map(([k, a]) => [`${a.name} x${a.n}`, "", a.price, () => { INV.ammo[k] += a.n; }]),
  ] : [
    ["Coal", "Throw it in the furnace: +22 fuel", 10, () => spawnNear("coal")],
    ["Bandage", "Heals you (H)", 20, () => { INV.bandage++; }],
    ["Holy water", "Throw at vampires (G)", 35, () => { INV.holy++; }],
    ["Dynamite", "Blows open bank vaults. Or throw it! (Q)", 45, () => spawnNear("dynamite")],
    ...Object.entries(AMMO).map(([k, a]) => [`${a.name} x${a.n}`, "", a.price, () => { INV.ammo[k] += a.n; }]),
  ];
  $("shopTitle").textContent = it.name === "DEPOT" ? "THE DEPOT STORE" : it.name;
  $("shopSub").textContent = guns ? "Guns, armor and ammo. Bring valuables to sell (hold one, press E at the counter)." : "Supplies for the long ride. Carrying gold, silver or jewelry? Press E at the counter to sell it.";
  const grid = $("shopGrid"); grid.innerHTML = "";
  for (const [name, desc, price, fn] of rows) {
    const b = document.createElement("button"); b.className = "shopItem"; b.innerHTML = `<b>${name}</b><small>${desc}</small><em>$${price}</em>`;
    b.onclick = () => { if (RUN.money < price) { SFX.nope(); return toast("Not enough money!"); } if (fn() === false) { SFX.nope(); return toast("You already have that."); } RUN.money -= price; SFX.buy(); bumpMoney(); updateShopMoney(); };
    grid.appendChild(b);
  }
  updateShopMoney(); $("shop").classList.remove("hidden");
}
function updateShopMoney() { $("shopMoney").textContent = "$" + RUN.money; }
function giveGun(w) { if (INV.weapons.includes(w)) return false; INV.weapons.push(w); INV.mag[w] = WEAPONS[w].mag; INV.ammo[WEAPONS[w].ammo] += AMMO[WEAPONS[w].ammo].n; toast(`${WEAPONS[w].name} is slot ${INV.weapons.length}`); }
function spawnNear(type) { addItem(type, P.x + Math.sin(P.yaw) * 1.2, P.y + 0.6, P.z + Math.cos(P.yaw) * 1.2); }
function closePanel() { panelOpen = false; $("shop").classList.add("hidden"); lock(); }
$("shopClose").onclick = closePanel;

// ---------------------------------------------------------------- what's in each place when you get there
function onBuilt(p) {
  if (p.spawned) return; p.spawned = true;
  const P2 = p.P;
  const loot = p.type === "keep" ? ["gold", "silver", "jewels", "painting", "holy", "holy"] : p.type === "fort" ? ["ammo", "ammo", "ammo", "bandage", "lumber", "cash", "silver"] :
    p.type === "mine" ? ["coal", "coal", "coal", "silver", "gold", "lumber"] : ["coal", "lumber", "chair", "cash", "cash", "ammo", "bandage", "watch", "jewels", "painting", "silver", "holy", "dynamite", "gold"];
  for (const s of P2.spots) {
    if (Math.random() < (p.type === "town" ? 0.6 : 0.75)) {
      let t = s.coal ? "coal" : loot[Math.floor(Math.random() * loot.length)];
      if (t === "gold" && Math.random() < 0.6) t = "silver";
      addItem(t, s.x, s.y + 0.3, s.z);
    }
  }
  if (p.type === "fort") { addItem("gun_rifle", P2.armory.x, 0.5, P2.armory.z); addItem("gun_shotgun", P2.armory.x + 1.5, 0.5, P2.armory.z); addItem("ammo", P2.armory.x - 1.5, 0.5, P2.armory.z); }
  if (p.type === "keep") { p.chestAt = P2.chest; const c = new THREE.Group(); box(c, 1.6, 0.9, 1, 0, 0.45, 0, L(0x5a2a14)); box(c, 1.7, 0.2, 1.1, 0, 0.95, 0, L(0xc8a03a)); c.position.set(P2.chest.x, 0, P2.chest.z); P2.g.add(c); spawnFoe("lord", P2.boss.x, P2.boss.z - Math.sign(P2.boss.z) * 2).home = true; }
  for (const f of P2.foes) { if (Math.random() < 0.7) spawnFoe(f.kind || (Math.random() < 0.25 ? "runner" : "walker"), f.x, f.z).noBurn = p.type === "keep"; }
}

// ---------------------------------------------------------------- day + night
const DAY = 360; // seconds for one whole day
let dayT = 0.05;
const isNight = () => dayT > 0.62 && dayT < 0.97;
const bloodMoon = () => isNight() && RUN.nights % 3 === 0;
let spawnT = 0;
const skyDay = new THREE.Color(0x9ad0f0), skyDusk = new THREE.Color(0xe08a5a), skyNight = new THREE.Color(0x0a0e1e), skyBlood = new THREE.Color(0x3a0606);
const fogDay = new THREE.Color(0xe8d0a8), fogNight = new THREE.Color(0x0e1020), fogBlood = new THREE.Color(0x2a0606);
function updateSky(dt) {
  dayT = (dayT + dt / DAY) % 1;
  const night = isNight();
  if (night && !RUN.lastNight) { RUN.nights++; const b = RUN.nights % 3 === 0; banner(b ? "BLOOD MOON" : "NIGHTFALL", b ? "The vampires are coming. Stay together. Keep the train moving." : "The dead are restless. Get the lantern lit and your gun ready."); SFX.night(b); }
  if (!night && RUN.lastNight && RUN.nights) { banner("DAWN", "You lived through the night!"); SFX.bell(); }
  RUN.lastNight = night;
  // the sun goes around: up at 0.25, down at ~0.6
  const a = (dayT - 0.05) / 0.6 * Math.PI, up = Math.sin(clamp(a, 0, Math.PI));
  const k = night ? 1 : dayT >= 0.97 ? 1 - (dayT - 0.97) / 0.03 * 0.5 : dayT < 0.03 ? 0.5 - dayT / 0.03 * 0.5 : dayT > 0.55 ? clamp((dayT - 0.55) / 0.07, 0, 1) : 0;
  const blood = bloodMoon();
  const sky = skyDay.clone().lerp(skyDusk, clamp(k * 2, 0, 1)).lerp(blood ? skyBlood : skyNight, clamp(k * 2 - 1, 0, 1));
  scene.background = sky; scene.fog.color.copy(fogDay.clone().lerp(blood ? fogBlood : fogNight, k)); scene.fog.far = lerp(420, blood ? 150 : 190, k);
  sun.intensity = lerp(1.7, blood ? 0.35 : 0.25, k); sun.color.set(blood && k > 0.5 ? 0xff5040 : k > 0.5 ? 0x8090c0 : 0xfff0d0);
  hemi.intensity = lerp(0.95, 0.3, k); hemi.color.set(blood && k > 0.5 ? 0xff6050 : k > 0.5 ? 0x6070a0 : 0xfff0d8);
  const sx = Math.cos(a) * 400, sy = Math.sin(a) * 300;
  sunBall.position.set(P.x + sx, sy, P.z + 200); sunBall.visible = sy > -10;
  moon.position.set(P.x - 150, 220, P.z + 380); moon.visible = k > 0.3; moon.material.color.set(blood ? 0xff2a1a : 0xf0f0ff); moon.scale.setScalar(blood ? 1.6 : 1);
  stars.position.set(P.x, 0, P.z); stars.material.opacity = k;
  sun.position.set(P.x + (k > 0.5 ? -60 : Math.cos(a) * 80), k > 0.5 ? 120 : Math.max(20, sy * 0.5), P.z + 60); sun.target.position.set(P.x, 0, P.z);
  headLight.intensity = k > 0.3 ? 60 : 0;
  MAT.glass.color.set(k > 0.4 ? 0xffb050 : 0x1a1a22);
  music(blood ? 2 : night ? 1 : 0);
  return k;
}
function nightSpawns(dt) {
  if (!isNight()) return;
  const blood = bloodMoon(), cap = blood ? 26 : 12 + Math.min(8, Math.floor(TR.x / 1500));
  spawnT -= dt; if (spawnT > 0 || foes.length >= cap) return;
  spawnT = blood ? rand(0.8, 1.6) : rand(1.6, 3.2);
  const ang = rand(0, Math.PI * 2), dist = rand(45, 80);
  const x = P.x + Math.max(-30, Math.cos(ang) * dist) + TR.v * 3, z = P.z + Math.sin(ang) * dist;
  let kind = Math.random() < 0.35 ? "runner" : "walker";
  if (TR.x > 4000 && Math.random() < 0.12) kind = "vamp";
  if (TR.x > 2500 && Math.random() < 0.08) kind = "brute";
  if (blood) kind = Math.random() < 0.45 ? "vamp" : Math.random() < 0.5 ? "bat" : "runner";
  const f = spawnFoe(kind, x, z); f.aggro = true;
}

// ---------------------------------------------------------------- the main loop
let last = performance.now(), acc = 0;
const tmpV = new THREE.Vector3();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!playing || paused) { renderer.render(scene, camera); return; }
  step(dt);
  renderer.render(scene, camera);
}
let paused = false;
function step(dt) {
  RUN.time += dt;
  const k = updateSky(dt);
  // ---- the train
  const prevX = TR.x;
  const far = Math.abs(P.x - TR.x) > 150 && !P.onTrain;
  let target = TR.fuel > 0 && !far ? SPEEDS[TR.throttle] * (save.cls === "conductor" ? 1.15 : 1) : 0;
  if (TR.x + 10.6 > LEN + 50) target = 0;
  TR.v += clamp(target - TR.v, -(target === 0 ? 2.6 : 1.4) * dt, 1.0 * dt);
  if (TR.x + 10.6 > LEN + 57) TR.v = 0;
  if (TR.v > 0.1 && TR.throttle) TR.fuel = Math.max(0, TR.fuel - [0, 0.12, 0.22, 0.36][TR.throttle] * dt * (save.cls === "conductor" ? 0.65 : 1));
  if (TR.fuel <= 0 && TR.throttle && !RUN.noFuelMsg) { RUN.noFuelMsg = true; toast("OUT OF FUEL! Throw coal, lumber or chairs into the furnace."); }
  if (TR.fuel > 0) RUN.noFuelMsg = false;
  TR.x += TR.v * dt; const tdx = TR.x - prevX;
  train.position.x = TR.x; syncTrainCols();
  lever.rotation.z = -0.5 + TR.throttle * 0.33;
  furnaceGlow.material.color.setHSL(0.07, 1, clamp(0.25 + TR.fuel / 250 + flare * 0.3, 0, 0.7)); flare = Math.max(0, flare - dt);
  train.traverse((m) => { if (m.userData.wheel) m.rotation.y -= TR.v * dt / 0.6; });
  if (TR.v > 0.5 && Math.random() < dt * (3 + TR.v)) { SFX.chuff(TR.v); const s = new THREE.Mesh(smokeGeo, smokeMat); s.position.set(TR.x + 9, DECK + 4, rand(-0.2, 0.2)); scene.add(s); smokePuffs.push({ m: s, t: 2.5 }); }
  for (const s of [...smokePuffs]) { s.t -= dt; s.m.position.y += dt * 2; s.m.position.x -= TR.v * dt * 0.6; s.m.scale.setScalar(1 + (2.5 - s.t) * 0.7); s.m.material.opacity = 0.35; if (s.t <= 0) { scene.remove(s.m); smokePuffs.splice(smokePuffs.indexOf(s), 1); } }
  world.update(TR.x, onBuilt);
  // ---- the player
  if (P.onTrain) P.x += tdx;
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 8.5 : 5.2) * (held && held.type === "corpse" ? 0.75 : 1) * (mounted ? 0 : 1);
  const sx = Math.sin(P.yaw), cz = Math.cos(P.yaw);
  let mx = fwd * sx - side * cz, mz = fwd * cz + side * sx; const ml = Math.hypot(mx, mz) || 1;
  const want = (fwd || side) ? sp : 0;
  P.vx = lerp(P.vx, (mx / ml) * want, P.ground ? 0.25 : 0.05); P.vz = lerp(P.vz, (mz / ml) * want, P.ground ? 0.25 : 0.05);
  if (keys.Space && P.ground && !mounted) { P.vy = 8; P.ground = false; }
  physics(P, dt);
  if (P.y < -20) { P.x = TR.x; P.y = DECK + 1; P.z = 0; }
  if (mounted) { const g = trainPt(GAT); P.x = g.x - 0.9; P.z = g.z; P.y = DECK; }
  // ---- held item follows the hands
  if (held) { const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw); held.x = P.x + fx2 * 0.7; held.z = P.z + fz2 * 0.7; held.y = P.y + (held.type === "corpse" ? 1.3 : 0.9); held.mesh.position.set(held.x, held.y, held.z); held.mesh.rotation.y = P.yaw + (held.type === "corpse" ? Math.PI / 2 : 0); }
  // ---- items fall, ride the train, get burned in the furnace
  const fu = trainPt(FURNACE);
  for (const it of [...items]) {
    if (it === held) continue;
    if (it.onTrain) it.x += tdx;
    if (it.flying || !it.ground || Math.abs(it.vx) + Math.abs(it.vz) > 0.01) {
      physics(it, dt); it.vx *= it.ground ? 0.6 : 0.995; it.vz *= it.ground ? 0.6 : 0.995; if (it.ground) it.flying = false;
      if (ITEMS[it.type].fuel && Math.hypot(it.x - fu.x, it.y - fu.y, it.z - fu.z) < 1.1) { burn(it); continue; }
    } else if (Math.abs(it.x - TR.x) < 30) physics(it, dt);
    it.mesh.position.set(it.x, it.y, it.z);
    if (it.type === "cash" || it.type.startsWith("gun_") || ITEMS[it.type].shiny) it.mesh.rotation.y += dt;
    if (it.x < TR.x - 320 && Math.abs(it.x - P.x) > 200) removeItem(it);
  }
  // ---- dynamite + holy water
  for (const d of [...dyn]) { d.t -= dt; d.m.rotation.y += dt * 8; if (Math.random() < 0.5) puff(d.m.position.x, d.m.position.y + 0.3, d.m.position.z, 0xffd040, 1); if (d.t <= 0) { scene.remove(d.m); dyn.splice(dyn.indexOf(d), 1); boom(d.x, d.y, d.z); if (d.vault && !d.vault.open) { d.vault.open = true; for (let i = 0; i < 3; i++) addItem("gold", d.x + rand(-1, 1), d.y + 1, d.z + rand(-1, 1)); for (let i = 0; i < 2; i++) addItem("cash", d.x + rand(-1, 1), d.y + 1, d.z + rand(-1, 1), { amount: 60 }); toast("The vault blew open! Gold bars everywhere!"); } } }
  for (const it of [...items]) if (it.type === "dynamite" && it.flying && it.lit === undefined) { it.lit = 2.2; }
  for (const it of [...items]) if (it.lit !== undefined) { it.lit -= dt; if (Math.random() < 0.5) puff(it.x, it.y + 0.3, it.z, 0xffd040, 1); if (it.lit <= 0) { removeItem(it); boom(it.x, it.y, it.z); } }
  for (const h of [...holyShots]) {
    h.vy -= 20 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.m.position.set(h.x, h.y, h.z); h.t -= dt;
    let hitF = foes.find((f) => Math.hypot(f.x - h.x, f.z - h.z) < 1 + f.r && h.y > f.y && h.y < f.y + f.h);
    if (hitF || h.y < groundH(h.x, h.z) || h.t <= 0) {
      scene.remove(h.m); holyShots.splice(holyShots.indexOf(h), 1); puff(h.x, h.y, h.z, 0x8ad0ff, 12); SFX.hiss();
      for (const f of [...foes]) { const dd = Math.hypot(f.x - h.x, f.z - h.z); if (dd < 4) hurtFoe(f, (f.d.vamp ? 180 : 40) * (1 - dd / 5), h.x, h.z); }
    }
  }
  // ---- the undead
  nightSpawns(dt);
  for (const f of [...foes]) {
    if (f.onTrain) f.x += tdx;
    const dx = P.x - f.x, dz = P.z - f.z, d = Math.hypot(dx, dz), dy = P.y - f.y;
    if (d < (isNight() ? 70 : 32)) f.aggro = true;
    if (f.home && d > 40) f.aggro = false;
    f.cd -= dt; f.hit -= dt; f.atk = Math.max(0, f.atk - dt * 3);
    let tx = 0, tz = 0, spd = f.d.speed;
    if (f.aggro && !RUN.over) { tx = dx / (d || 1); tz = dz / (d || 1); }
    else { f.wander = (f.wander || 0) - dt; if (f.wander <= 0) { f.wander = rand(2, 5); f.wx = rand(-1, 1); f.wz = rand(-1, 1); } tx = f.wx * 0.3; tz = f.wz * 0.3; }
    if (f.d.fly) {
      const ty = P.y + 1.2 + (d > 3 ? 2 : 0);
      f.vx = lerp(f.vx, tx * spd + (P.onTrain ? TR.v : 0), 0.05); f.vz = lerp(f.vz, tz * spd, 0.05); f.vy = lerp(f.vy, (ty - f.y) * 2, 0.05);
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.model.t += dt * 18; f.model.wl.rotation.z = Math.sin(f.model.t) * 0.8; f.model.wr.rotation.z = -Math.sin(f.model.t) * 0.8;
      if (Math.hypot(dx, dz, P.y + 1.2 - f.y) < 1.2 && f.cd <= 0) { f.cd = 1; hurtPlayer(f.d.dmg, true); SFX.groan("bat"); }
    } else {
      // keep up with a moving train when it's close (they run beside it, then jump on)
      const chase = f.aggro && P.onTrain && d < 30 ? TR.v * 0.85 : 0;
      f.vx = lerp(f.vx, tx * spd + Math.sign(tx || 1) * 0 + (chase && f.d.speed > 5 ? chase : 0), 0.15); f.vz = lerp(f.vz, tz * spd, 0.15);
      if (f.d.vamp && f.aggro && f.ground && d < 9 && d > 2.5 && f.leap <= 0) { f.vy = 8; f.vx = tx * 13 + (P.onTrain ? TR.v : 0); f.vz = tz * 13; f.leap = 2.5; SFX.groan("vamp"); }
      f.leap -= dt;
      if (f.aggro && f.ground && (f.blocked || dy > 0.9) && d < 12) f.vy = 9.5;
      physics(f, dt);
      if (d < 1.3 + f.r && Math.abs(dy) < 1.6 && f.cd <= 0 && !RUN.over) { f.cd = f.d.boss ? 1.1 : 1.0; f.atk = 1; hurtPlayer(f.d.dmg, f.d.vamp); }
      if (Math.random() < dt * 0.15 && d < 30) SFX.groan(f.kind === "lord" ? "lord" : f.d.vamp ? "vamp" : f.kind);
      animHuman(f.model, Math.hypot(f.vx, f.vz), dt, f.atk);
      // vampires burn in the sun (unless they're indoors)
      if (f.d.vamp && !f.d.boss && !f.noBurn && k < 0.3 && !world.indoors(f.x, f.z)) { f.hp -= 40 * dt; if (Math.random() < 0.3) puff(f.x, f.y + 1.5, f.z, 0x444444, 1); if (f.hp <= 0) { killFoe(f, true); continue; } }
      if (f.kind === "lord" && f.aggro && Math.random() < dt * 0.25 && foes.length < 40) { for (let i = 0; i < 3; i++) spawnFoe("bat", f.x, f.z, f.y + 3).aggro = true; SFX.groan("lord"); }
    }
    if (f.aggro || d < 60) f.yaw = Math.atan2(f.vx, f.vz);
    f.model.root.position.set(f.x, f.y, f.z); f.model.root.rotation.y = f.yaw;
    if (f.hit > 0) f.model.root.scale.setScalar((f.d.scale || 1) * 1.06); else f.model.root.scale.setScalar(f.d.scale || 1);
    if ((f.x < TR.x - 260 && Math.abs(f.x - P.x) > 150) || f.y < -30) { scene.remove(f.model.root); foes.splice(foes.indexOf(f), 1); }
  }
  // ---- you
  fireCD -= dt; meleeT = Math.max(0, meleeT - dt);
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { const id = INV.weapons[INV.cur], w = WEAPONS[id]; const n = Math.min(w.mag - (INV.mag[id] ?? 0), INV.ammo[w.ammo]); INV.mag[id] = (INV.mag[id] ?? 0) + n; INV.ammo[w.ammo] -= n; } }
  if (healT > 0) { healT -= dt; P.hp = Math.min(100, P.hp + dt * (save.cls === "doctor" ? 40 : 20)); }
  gatHeat = Math.max(0, gatHeat - dt * (gatHeat > 1 ? 0.25 : 0.35)); if (gatHeat > 1 && gatHeat - dt * 0.25 <= 1) gatHeat = 0.99;
  if (mounted) gatling(dt); else shoot(dt);
  if (panelOpen && near.inter && Math.hypot(P.x - near.inter.x, P.z - near.inter.z) > 4) closePanel();
  scanNear();
  // ---- the hero model + camera
  hero.root.position.set(P.x, P.y, P.z); hero.root.rotation.y = P.yaw;
  animHuman(hero, P.ground ? Math.hypot(P.vx - (P.onTrain ? 0 : 0), P.vz) : 0, dt);
  const wpn = WEAPONS[INV.weapons[INV.cur]];
  if (held) { hero.armL.rotation.x = hero.armR.rotation.x = -1.3; }
  else if (meleeT > 0) hero.armR.rotation.x = -2.6 + (0.3 - meleeT) * 10;
  else if (!wpn.melee) { hero.armR.rotation.x = -1.45 - P.pitch * 0.8; }
  heroGun.visible = !held && !mounted;
  hero.root.visible = !fp || mounted;
  const zoom = aiming && wpn.zoom && !held;
  camera.fov = lerp(camera.fov, zoom ? 22 : aiming ? 52 : 65, 0.2); camera.updateProjectionMatrix();
  const head = tmpV.set(P.x, P.y + 1.65, P.z);
  const dir = new THREE.Vector3(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
  if (fp || zoom) camera.position.copy(head).addScaledVector(dir, 0.25);
  else {
    const right = new THREE.Vector3(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
    const back = mounted ? 3 : aiming ? 2.4 : 4.2;
    const o = head.clone().addScaledVector(right, mounted ? 0 : 0.75);
    const want2 = o.clone().addScaledVector(dir, -back).add(new THREE.Vector3(0, 0.4, 0));
    const cd = want2.clone().sub(o), cl = cd.length(); cd.normalize();
    const hit = rayWalls(o, cd, cl);
    camera.position.copy(o).addScaledVector(cd, Math.max(0.3, hit - 0.25));
    const gh = groundH(camera.position.x, camera.position.z) + 0.3; if (camera.position.y < gh) camera.position.y = gh;
  }
  camera.lookAt(camera.position.clone().add(dir));
  if (shake > 0) { camera.position.x += rand(-1, 1) * shake * 0.15; camera.position.y += rand(-1, 1) * shake * 0.15; shake = Math.max(0, shake - dt * 3); }
  // ---- effects
  for (const e of [...fx]) {
    e.t -= dt;
    if (e.m) { e.vy -= 15 * dt; e.m.position.x += e.vx * dt; e.m.position.y += e.vy * dt; e.m.position.z += e.vz * dt; }
    if (e.line) e.line.material.opacity = e.t / 0.07;
    if (e.ball) { e.ball.scale.setScalar(1 + (0.5 - e.t) * 10); e.ball.material.opacity = e.t * 1.6; }
    if (e.t <= 0) { const o = e.m || e.line || e.ball; scene.remove(o); o.geometry.dispose(); if (o.material) o.material.dispose(); fx.splice(fx.indexOf(e), 1); }
  }
  // ---- winning
  if (!RUN.won && TR.x + 10.6 > LEN + 20 && P.x > LEN - 80) win();
  hud(dt);
}

// ---------------------------------------------------------------- HUD
let toastT = 0, bannerT = 0;
function toast(s) { $("toast").textContent = s; $("toast").classList.add("on"); toastT = 3.2; }
function banner(a, b) { $("bannerBig").textContent = a; $("bannerSmall").textContent = b; $("banner").classList.add("on"); $("banner").classList.toggle("blood", a === "BLOOD MOON"); bannerT = 4; }
function bumpMoney() { const m = $("money"); m.classList.remove("bump"); void m.offsetWidth; m.classList.add("bump"); }
function hud(dt) {
  toastT -= dt; if (toastT <= 0) $("toast").classList.remove("on");
  bannerT -= dt; if (bannerT <= 0) $("banner").classList.remove("on");
  const hurt = $("hurt"); hurt.style.opacity = Math.max(0, +hurt.style.opacity - dt * 1.5);
  $("hpFill").style.width = Math.max(0, P.hp) + "%"; $("hpNum").textContent = Math.max(0, Math.ceil(P.hp));
  $("armorFill").style.width = P.armor + "%"; $("armorRow").classList.toggle("hidden", P.armor <= 0);
  $("money").textContent = "$" + RUN.money;
  const km = Math.max(0, (TR.x + 10.6) / 1000); $("kmNum").textContent = km.toFixed(2) + " / " + (LEN / 1000) + " km";
  $("trackFill").style.width = clamp(km / (LEN / 1000) * 100, 0, 100) + "%";
  $("trainDot").style.left = clamp(km / (LEN / 1000) * 100, 0, 100) + "%";
  $("youDot").style.left = clamp(P.x / LEN * 100, 0, 100) + "%";
  const night = isNight(), blood = bloodMoon();
  $("clock").textContent = blood ? "🩸 BLOOD MOON" : night ? `🌙 Night ${RUN.nights}` : dayT > 0.5 ? "🌇 Evening" : `☀️ Day ${RUN.nights + 1}`;
  $("clock").classList.toggle("blood", blood);
  $("fuelFill").style.width = TR.fuel / TR.maxFuel * 100 + "%"; $("fuelBox").classList.toggle("low", TR.fuel < 20);
  $("speedNum").textContent = Math.round(TR.v * 2.237) + " mph";
  $("throttle").textContent = ["STOP", "SLOW", "HALF", "FULL"][TR.throttle];
  const id = INV.weapons[INV.cur], w = WEAPONS[id];
  $("gunName").textContent = (held ? "✋ " + (held.type === "corpse" ? "Body ($" + held.bounty + ")" : ITEMS[held.type].name) : mounted ? "Gatling gun" : w.icon + " " + w.name);
  $("ammoNum").textContent = held || w.melee ? "" : mounted ? (gatHeat > 1 ? "HOT!" : "🔥" + Math.round(gatHeat * 100) + "%") : `${INV.mag[id] ?? 0} / ${INV.ammo[w.ammo]}`;
  $("reloadBar").style.visibility = reloadT > 0 ? "visible" : "hidden"; if (reloadT > 0) $("reloadFill").style.width = (1 - reloadT / (w.reload || 1)) * 100 + "%";
  $("slots").innerHTML = INV.weapons.map((x, i) => `<i class="${i === INV.cur ? "on" : ""}"><small>${i + 1}</small>${WEAPONS[x].icon}</i>`).join("") + `<i class="cons"><small>H</small>🩹${INV.bandage}</i><i class="cons"><small>G</small>💧${INV.holy}</i>`;
  let hint = "";
  if (near.lever && !held) hint = `E: throttle up (${["STOP", "SLOW", "HALF", "FULL"][TR.throttle]}) · F: throttle down`;
  else if (near.furnace && held && ITEMS[held.type].fuel) hint = "E: throw it in the furnace!";
  else if (near.gat && !held) hint = "E: man the gatling gun";
  else if (held && near.inter?.kind === "sheriff" && held.type === "corpse") hint = `E: turn in the body for $${held.bounty}`;
  else if (held && near.inter && (near.inter.kind === "store" || near.inter.kind === "guns") && ITEMS[held.type].value) hint = `E: sell the ${ITEMS[held.type].name} for $${ITEMS[held.type].value}`;
  else if (held && near.inter?.kind === "vault" && held.type === "dynamite") hint = "E: plant the dynamite on the vault!";
  else if (held) hint = "E: put it down · Q or click: throw";
  else if (near.item) hint = `E: ${ITEMS[near.item.type].grab ? "grab" : "pick up"} ${near.item.type === "corpse" ? "the body (" + near.item.foe + ", $" + near.item.bounty + ")" : ITEMS[near.item.type].name}`;
  else if (near.inter) hint = { store: "E: shop", guns: "E: shop for guns", sheriff: "Sheriff: bring bodies here", vault: "The bank vault", chest: "E: open the chest" }[near.inter.kind] || "";
  $("hint").textContent = hint; $("hint").classList.toggle("hidden", !hint);
  const boss = foes.find((f) => f.d.boss && f.aggro);
  $("bossBox").classList.toggle("hidden", !boss); if (boss) $("bossFill").style.width = boss.hp / boss.max * 100 + "%";
  $("cross").classList.toggle("hidden", !!held);
}

// ---------------------------------------------------------------- start / end
function gameOver(won) {
  if (RUN.over) return; RUN.over = true; playing = true;
  const km = Math.min(LEN, Math.max(0, TR.x)) / 1000;
  const earned = Math.floor(km) + Math.floor(RUN.kills / 25) + (won ? 10 : 0) + (RUN.baron ? 3 : 0);
  save.stars += earned; save.best = Math.max(save.best, km); if (won) save.wins++; store();
  document.exitPointerLock?.();
  setTimeout(() => {
    $("overTitle").textContent = won ? "YOU MADE IT TO SUNDOWN!" : "YOU DIED IN THE DESERT";
    $("overTitle").className = won ? "gold" : "red";
    $("overKm").textContent = km.toFixed(2) + " km"; $("overKills").textContent = RUN.kills; $("overMoney").textContent = "$" + RUN.money; $("overStars").textContent = "+" + earned + " ⭐";
    $("over").classList.remove("hidden"); $("hud").classList.add("hidden"); playing = false;
  }, won ? 600 : 1400);
  won ? SFX.win() : SFX.over();
}
function win() { RUN.won = true; banner("SUNDOWN STATION!", "You crossed the whole desert!"); gameOver(true); }
function showPause(on) { paused = on; $("pause").classList.toggle("hidden", !on); }
$("resume").onclick = () => { showPause(false); lock(); };
$("quit").onclick = () => { showPause(false); playing = false; RUN.over = true; $("hud").classList.add("hidden"); showMenu(); };
$("again").onclick = () => { $("over").classList.add("hidden"); begin(); };
$("toMenu").onclick = () => { $("over").classList.add("hidden"); showMenu(); };
const muteBtns = () => { for (const b of [$("muteBtn"), $("menuMute")]) b.textContent = isMuted() ? "🔇 Sound off" : "🔊 Sound on"; };
for (const b of [$("muteBtn"), $("menuMute")]) b.onclick = () => { audio(); setMuted(!isMuted()); muteBtns(); };
muteBtns();

function showMenu() {
  $("menu").classList.remove("hidden");
  $("starNum").textContent = save.stars; $("best").textContent = save.best ? `Your best: ${save.best.toFixed(2)} km${save.wins ? " · Reached Sundown " + save.wins + "x" : ""}` : "";
  const grid = $("classes"); grid.innerHTML = "";
  for (const c of CLASSES) {
    const got = save.got.includes(c.id);
    const b = document.createElement("button"); b.className = "cls" + (save.cls === c.id ? " on" : "") + (got ? "" : " locked");
    b.innerHTML = `<span>${c.icon}</span><b>${c.name}</b><small>${c.desc}</small><em>${got ? (save.cls === c.id ? "PICKED" : "Pick") : "🔒 " + c.cost + " ⭐"}</em>`;
    b.onclick = () => {
      audio();
      if (!got) { if (save.stars < c.cost) { SFX.nope(); return; } save.stars -= c.cost; save.got.push(c.id); SFX.buy(); }
      save.cls = c.id; store(); SFX.click(); showMenu();
    };
    grid.appendChild(b);
  }
}
function begin() {
  audio(); $("menu").classList.add("hidden"); $("hud").classList.remove("hidden");
  startRun(); playing = true; paused = false;
  lock();
  banner("ALL ABOARD!", "Pull the lever (E) to get moving. Feed the furnace. Reach Sundown Station, 12 km west.");
  SFX.whistle();
}
$("start").onclick = begin;
$("controls").innerHTML = $("controls2").innerHTML = `<b>WASD</b> move · <b>Mouse</b> look · <b>Click</b> shoot · <b>Right-click</b> aim · <b>R</b> reload · <b>1-5</b> weapons · <b>E</b> pick up / drop / use · <b>Q</b> throw · <b>H</b> bandage · <b>G</b> holy water · <b>Space</b> jump · <b>Shift</b> run · <b>V</b> first person`;

// the menu shows the train sitting at the depot
startRun(); playing = false; RUN.over = true; hero.root.visible = true;
updateSky(0); camera.position.set(16, 4, 16); camera.lookAt(20, 2, 0);
showMenu();
requestAnimationFrame(tick);
if (TEST) window.LT = { P, TR, RUN, INV, foes, items, world, spawnFoe, addItem, setThrottle, step, get dayT() { return dayT; }, set dayT(v) { dayT = v; }, begin, camera, interact, near, scene, hurtFoe, pickUp, isNight, get held() { return held; }, openShop };
