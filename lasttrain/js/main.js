// LAST TRAIN WEST (game.gamergunner.com/lasttrain/): ride an old steam train 12 km across the haunted desert to
// Sundown Station, with up to 3 friends.
//  - THE LOBBY: a walled frontier town. The Outfitter sells hats, shirts + bandanas, the Class Office sells classes
//    (buy, then equip), the Gunsmith sells a starting gun. Stand on a TRAIN pad (4 riders max) to ride out together.
//    Reach the Halfway Post on a run and the MIDWAY pad opens: start your next run at 6 km with what you had there.
//  - A RUN: start inside the walls of Fort Hope with no gun (buy one at the Gunsmith). Feed the furnace, loot the towns,
//    shoot the undead, sell bodies to the Sheriff, blow open bank vaults, raid Fort Cinder, beat the Pale Baron, and
//    survive the Blood Moon. At the end, pull the lever to lower the drawbridge and beat the Bone Colossus while it
//    comes down. Then cross to Sundown Station.
//  - Your BACKPACK (B) holds 8 things. T puts what you're holding straight in.
// Co-op: the run's host simulates the train, the time of day and the undead and sends them out (ltx); everybody sends
// what they do (lte): hits, loot picked up / dropped, the lever... Test hook: window.LT (with ?test).
import * as THREE from "/create/vendor/three.module.js";
import { SFX, audio, music, setMuted, isMuted } from "./sfx.js";
import { World, groundH, LEN, DECK, MAT, LOBBY_X, MID_X, CHASM } from "./world.js";
import { joinLobby, joinRun, newCode } from "./net.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TEST = Q.has("test");
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const f1 = (n) => (Math.round(n * 10) / 10).toString();

// ---------------------------------------------------------------- save
const SAVE_KEY = "gv_train_save";
let save = { stars: 5, best: 0, wins: 0, cls: "drifter", got: ["drifter"], guns: [], gun: "", look: { hat: 1, hatC: "5a3a20", shirt: "7a4a2a", band: "" }, owned: ["h1", "h0", "s7a4a2a", "c5a3a20", "b0"], mid: null };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); Object.assign(save, s); if (s.stars === undefined) save.stars = 5; } catch {}
for (const k of ["h1", "h0", "s7a4a2a", "c5a3a20", "b0"]) if (!save.owned.includes(k)) save.owned.push(k);
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

const CLASSES = [
  { id: "drifter", name: "Drifter", icon: "🤠", cost: 0, desc: "Starts with $90 instead of $60." },
  { id: "doctor", name: "Doctor", icon: "🩺", cost: 4, desc: "Starts with 5 bandages. Bandages heal twice as much." },
  { id: "miner", name: "Miner", icon: "⛏️", cost: 6, desc: "A pickaxe that hits hard. The train starts with a full furnace." },
  { id: "gunslinger", name: "Gunslinger", icon: "🔫", cost: 9, desc: "Starts with a shotgun and 16 shells. Reloads faster." },
  { id: "preacher", name: "Preacher", icon: "✝️", cost: 12, desc: "Starts with 4 holy water. Vampires hurt you half as much." },
  { id: "conductor", name: "Conductor", icon: "🚂", cost: 16, desc: "The train burns 35% less coal and goes 15% faster." },
];
const HATS = [{ n: "No hat", c: 0 }, { n: "Cowboy hat", c: 0 }, { n: "Top hat", c: 3 }, { n: "Wide brim", c: 4 }, { n: "Bowler", c: 3 }, { n: "Sheriff hat", c: 6 }];
const SHIRTS = [["7a4a2a", "Brown"], ["e8e8e8", "White"], ["2a3a6a", "Navy"], ["8a1e1a", "Red"], ["2a5a2a", "Green"], ["1a1a1e", "Black"], ["c89a3a", "Mustard"], ["6a2a6a", "Purple"]];
const HATCS = [["5a3a20", "Brown"], ["1a1a1e", "Black"], ["e8dcc0", "Cream"], ["6a6a6a", "Gray"], ["8a1e1a", "Red"]];
const BANDS = [["c0202a", "Red"], ["2a4aa0", "Blue"], ["111111", "Black"]];
const LOBBY_GUNS = [{ id: "revolver", cost: 3 }, { id: "shotgun", cost: 8 }, { id: "rifle", cost: 14 }];

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

// ---------------------------------------------------------------- people
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
  const hc = L(o.hatC || 0x5a3a20);
  if (o.hat === "cowboy") { box(head, 0.8, 0.05, 0.75, 0, 0.48, 0, hc); box(head, 0.46, 0.24, 0.44, 0, 0.6, 0, hc); }
  if (o.hat === "top") { box(head, 0.62, 0.04, 0.6, 0, 0.47, 0, hc); box(head, 0.4, 0.5, 0.4, 0, 0.74, 0, hc); box(head, 0.41, 0.07, 0.41, 0, 0.53, 0, L(0x8a1e1a)); }
  if (o.hat === "wide") { box(head, 1.2, 0.05, 1.15, 0, 0.48, 0, hc); const c = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.45, 8), hc); c.position.y = 0.7; head.add(c); }
  if (o.hat === "bowler") { const c = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hc); c.position.y = 0.47; head.add(c); box(head, 0.6, 0.04, 0.56, 0, 0.47, 0, hc); }
  if (o.hat === "sheriff") { box(head, 0.86, 0.05, 0.8, 0, 0.48, 0, hc); box(head, 0.46, 0.26, 0.44, 0, 0.61, 0, hc); box(head, 0.12, 0.12, 0.02, 0, 0.62, 0.23, new THREE.MeshPhongMaterial({ color: 0xffd23a, shininess: 90 })); }
  if (o.hat === "kepi") { box(head, 0.48, 0.2, 0.46, 0, 0.55, 0, L(0x2a3a6a)); box(head, 0.4, 0.04, 0.2, 0, 0.47, 0.28, L(0x1a1a1a)); }
  if (o.hat === "crown") for (let i = 0; i < 5; i++) box(head, 0.1, 0.22, 0.1, Math.cos(i * 1.26) * 0.2, 0.58, Math.sin(i * 1.26) * 0.2, L(0xffc83a, 0x3a2a00));
  if (o.band) box(head, 0.48, 0.2, 0.08, 0, 0.1, 0.21, L(o.band));
  if (o.cape) { const c = box(body, 0.75, 1.3, 0.06, 0, 0.95, -0.24, L(o.cape)); c.rotation.x = 0.08; box(body, 0.8, 0.35, 0.12, 0, 1.55, -0.16, L(o.cape)); }
  if (o.hair) box(head, 0.48, 0.12, 0.46, 0, 0.48, -0.02, L(o.hair));
  if (o.ribs) for (let i = 0; i < 4; i++) box(body, 0.7, 0.05, 0.4, 0, 1.0 + i * 0.14, 0.01, L(0x2a2a2a));
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
const HATN = ["", "cowboy", "top", "wide", "bowler", "sheriff"];
const myLookOpts = (lk = save.look) => ({ skin: 0xe0b090, shirt: parseInt(lk.shirt, 16), pants: 0x4a3a2a, hat: HATN[lk.hat] || "", hatC: parseInt(lk.hatC, 16), band: lk.band ? parseInt(lk.band, 16) : 0 });
const lookCode = () => [save.look.shirt, "4a3a2a", save.look.hatC, "0000" + (save.look.hat | 0) + (save.look.band ? 1 : 0), save.look.band || "000000", "e0b090"];
const lookFromCode = (k) => { if (!Array.isArray(k) || k.length < 5) return myLookOpts({ hat: 1, hatC: "5a3a20", shirt: "7a4a2a", band: "" }); const h = parseInt(k[3][4], 16) || 0, b = k[3][5] === "1"; return { skin: parseInt(k[5] || "e0b090", 16), shirt: parseInt(k[0], 16), pants: parseInt(k[1], 16), hat: HATN[h] || "", hatC: parseInt(k[2], 16), band: b ? parseInt(k[4], 16) : 0 }; };
function nameTag(text) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 48; const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, 0, 256, 48); g.fillStyle = "#ffe8b0"; g.font = "bold 28px Inter, sans-serif"; g.textAlign = "center"; g.fillText(text.slice(0, 18), 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.8, 0.34, 1); s.position.y = 2.5; s.renderOrder = 5; return s;
}

// ---------------------------------------------------------------- the train
const TR = { x: 30, v: 0, throttle: 0, fuel: 60, maxFuel: 100 };
const SPEEDS = [0, 6, 12, 18];
const train = new THREE.Group(); scene.add(train);
const tcols = [];
const tcol = (x0, x1, y0, y1, z0, z1) => tcols.push({ lx0: x0, lx1: x1, y0, y1, z0, z1, train: true, x0: 0, x1: 0 });
let lever, furnaceGlow, headLight, gatlingG;
const smokePuffs = [];
{
  const black = L(0x22232a), red = L(0x8a1e1a), brass = new THREE.MeshPhongMaterial({ color: 0xd8a83a, shininess: 70 }), wood = L(0x7a4a2a), iron = L(0x3a3a42);
  box(train, 26.8, 0.5, 3, -2.8, DECK - 0.25, 0, black); tcol(-16.2, 10.6, 0.4, DECK, -1.5, 1.5);
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 8.6, 18), black); boiler.rotation.z = Math.PI / 2; boiler.position.set(6, DECK + 1.25, 0); train.add(boiler);
  tcol(1.5, 10.6, DECK, DECK + 2.5, -1.15, 1.15);
  for (const x of [3, 6, 9]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.05, 6, 24), brass); r.rotation.y = Math.PI / 2; r.position.set(x, DECK + 1.25, 0); train.add(r); }
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 1.9, 12), black); stack.position.set(9, DECK + 3.1, 0); train.add(stack);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), brass); dome.position.set(5.5, DECK + 2.45, 0); train.add(dome);
  const cow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 4), red); cow.rotation.z = -Math.PI / 2; cow.rotation.x = Math.PI / 4; cow.position.set(11.1, 0.8, 0); cow.scale.set(1, 0.6, 1); train.add(cow);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), brass); lamp.rotation.z = Math.PI / 2; lamp.position.set(10.6, DECK + 2.6, 0); train.add(lamp);
  headLight = new THREE.SpotLight(0xffe0a0, 0, 90, 0.45, 0.4, 1.2); headLight.position.set(10.9, DECK + 2.6, 0); headLight.target.position.set(40, 0, 0); train.add(headLight, headLight.target);
  box(train, 0.15, 2.6, 2.9, 1.5, DECK + 1.3, 0, red);
  for (const s of [-1, 1]) { box(train, 2.3, 1.0, 0.12, 0.35, DECK + 0.5, s * 1.44, red); tcol(-0.8, 1.5, DECK, DECK + 1.0, s > 0 ? 1.35 : -1.5, s > 0 ? 1.5 : -1.35); box(train, 0.12, 1.6, 0.12, -0.8, DECK + 1.8, s * 1.44, red); }
  box(train, 3.8, 0.18, 3.3, -0.25, DECK + 2.7, 0, L(0x4a2a1a)); tcol(-2.1, 1.6, DECK + 2.6, DECK + 2.8, -1.65, 1.65);
  box(train, 0.06, 0.75, 0.95, 1.44, DECK + 0.7, 0, iron);
  furnaceGlow = box(train, 0.05, 0.6, 0.8, 1.4, DECK + 0.7, 0, new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  lever = new THREE.Group(); lever.position.set(0.9, DECK + 0.5, 0.95); train.add(lever); box(lever, 0.08, 0.9, 0.08, 0, 0.45, 0, brass); box(lever, 0.18, 0.18, 0.18, 0, 0.9, 0, red);
  for (const s of [-1, 1]) { box(train, 5.2, 0.9, 0.12, -5, DECK + 0.45, s * 1.44, black); tcol(-7.6, -2.4, DECK, DECK + 0.9, s > 0 ? 1.35 : -1.5, s > 0 ? 1.5 : -1.35); }
  const heap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 6), L(0x1a1a1e)); heap.position.set(-5, DECK + 0.4, 0); heap.scale.set(1.8, 1, 1); train.add(heap);
  for (const s of [-1, 1]) for (const [a, b] of [[-16, -13], [-11, -8]]) { box(train, b - a, 0.12, 0.1, (a + b) / 2, DECK + 0.55, s * 1.44, wood); tcol(a, b, DECK, DECK + 0.6, s > 0 ? 1.35 : -1.5, s > 0 ? 1.5 : -1.35); }
  for (const s of [-1, 1]) for (let x = -16; x <= -8; x += 1.5) box(train, 0.12, 0.6, 0.12, x, DECK + 0.3, s * 1.44, wood);
  box(train, 8.4, 0.08, 2.9, -12, DECK + 0.02, 0, wood);
  for (const x of [-15, -12.5, -10, -6.5, -3.5, 0, 3, 6, 9]) for (const s of [-1, 1]) { const big = x > -1 && x < 7; const w = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.75 : 0.5, big ? 0.75 : 0.5, 0.2, 16), red); w.rotation.x = Math.PI / 2; w.position.set(x, big ? 0.75 : 0.5, s * 0.95); train.add(w); w.userData.wheel = true; }
  gatlingG = new THREE.Group(); gatlingG.position.set(-14.5, DECK, 0); gatlingG.visible = false; train.add(gatlingG);
  box(gatlingG, 0.1, 1.1, 0.1, 0, 0.55, 0, iron);
  const barrel = new THREE.Group(); barrel.position.y = 1.15; gatlingG.add(barrel); gatlingG.userData.barrel = barrel;
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), brass); b.rotation.z = Math.PI / 2; b.position.set(0.5, Math.cos(i) * 0.1, Math.sin(i) * 0.1); barrel.add(b); }
  box(barrel, 0.5, 0.3, 0.3, -0.1, 0, 0, iron);
  train.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
}
const wheels = []; train.traverse((m) => m.userData.wheel && wheels.push(m));
const FURNACE = new THREE.Vector3(1.2, DECK + 0.7, 0), LEVER = new THREE.Vector3(0.9, DECK + 0.9, 0.95), GAT = new THREE.Vector3(-14.5, DECK, 0);
const trainPt = (v) => new THREE.Vector3(TR.x + v.x, v.y, v.z);
function syncTrainCols() { for (const c of tcols) { c.x0 = TR.x + c.lx0; c.x1 = TR.x + c.lx1; } }
syncTrainCols();
const smokeMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.35, depthWrite: false });
const smokeGeo = new THREE.SphereGeometry(0.6, 8, 6);

// ---------------------------------------------------------------- collisions
let bridgeCol = null;
function nearCols(x) { const out = []; for (const c of world.cols) if (c.x1 > x - 8 && c.x0 < x + 8) out.push(c); if (mode === "run" && Math.abs(x - TR.x) < 30) out.push(...tcols); if (bridgeCol && Math.abs(x - CHASM[0]) < 80) out.push(bridgeCol); return out; }
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
function allCols() { const a = [...world.cols]; if (mode === "run") a.push(...tcols); if (bridgeCol) a.push(bridgeCol); return a; }
function rayWalls(o, d, max) {
  let best = max;
  for (const c of allCols()) {
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

// ---------------------------------------------------------------- weapons + items
const WEAPONS = {
  shovel: { name: "Shovel", icon: "🪏", melee: true, dmg: 34, rate: 1.7, range: 2.4 },
  pickaxe: { name: "Pickaxe", icon: "⛏️", melee: true, dmg: 60, rate: 1.3, range: 2.4 },
  revolver: { name: "Revolver", icon: "🔫", dmg: 34, rate: 2.6, mag: 6, reload: 1.6, ammo: "pistol", spread: 0.012, pellets: 1, snd: "revolver", price: 40 },
  shotgun: { name: "Shotgun", icon: "💥", dmg: 15, rate: 1.1, mag: 4, reload: 2.3, ammo: "shells", spread: 0.085, pellets: 8, snd: "shotgun", price: 120 },
  rifle: { name: "Rifle", icon: "🎯", dmg: 95, rate: 0.95, mag: 5, reload: 2.2, ammo: "rifle", spread: 0.002, pellets: 1, snd: "rifle", price: 220, zoom: true },
};
const AMMO = { pistol: { name: "Revolver rounds", n: 12, price: 8 }, shells: { name: "Shotgun shells", n: 8, price: 12 }, rifle: { name: "Rifle rounds", n: 10, price: 15 } };
const ITEMS = {
  coal: { name: "Coal", icon: "⚫", fuel: 22, color: 0x222226, size: [0.6, 0.45, 0.6] },
  lumber: { name: "Lumber", icon: "🪵", fuel: 11, color: 0x9a6a3a, size: [1.4, 0.25, 0.35] },
  chair: { name: "Chair", icon: "🪑", fuel: 8, color: 0x7a4a2a, size: [0.5, 1.0, 0.5] },
  gold: { name: "Gold bar", icon: "🟨", value: 120, color: 0xffc83a, size: [0.5, 0.2, 0.25], shiny: true },
  silver: { name: "Silver bar", icon: "⬜", value: 60, color: 0xd8dce4, size: [0.5, 0.2, 0.25], shiny: true },
  jewels: { name: "Jewelry box", icon: "💍", value: 45, color: 0x8a2a6a, size: [0.4, 0.3, 0.3] },
  painting: { name: "Painting", icon: "🖼️", value: 50, color: 0xc89a4a, size: [0.9, 0.7, 0.08] },
  watch: { name: "Pocket watch", icon: "⌚", value: 25, color: 0xd8a83a, size: [0.22, 0.22, 0.08], shiny: true },
  crown: { name: "The Baron's Crown", icon: "👑", value: 500, color: 0xffc83a, size: [0.5, 0.35, 0.5], shiny: true },
  skull: { name: "Colossus skull", icon: "💀", value: 800, color: 0xe8e0c8, size: [0.8, 0.7, 0.8] },
  dynamite: { name: "Dynamite", icon: "🧨", color: 0xc0302a, size: [0.5, 0.2, 0.2] },
  corpse: { name: "Body", icon: "🧟" },
  cash: { name: "Money bag", grab: true, color: 0xb89a6a, size: [0.4, 0.45, 0.4] },
  ammo: { name: "Ammo box", grab: true, color: 0x5a6a2a, size: [0.5, 0.35, 0.35] },
  bandage: { name: "Bandage", grab: true, color: 0xf0f0f0, size: [0.3, 0.3, 0.3] },
  holy: { name: "Holy water", grab: true, color: 0x6ac0ff, size: [0.2, 0.4, 0.2], shiny: true },
  gun_shotgun: { name: "Shotgun", grab: true, color: 0x4a3a2a, size: [1.1, 0.15, 0.2] },
  gun_rifle: { name: "Rifle", grab: true, color: 0x3a2a1a, size: [1.4, 0.15, 0.2] },
};
const items = [], itemById = new Map(), goneIds = new Set();
const shinyMat = {};
function itemMesh(type) {
  const d = ITEMS[type]; const g = new THREE.Group();
  const m = d.shiny ? (shinyMat[type] ||= new THREE.MeshPhongMaterial({ color: d.color, shininess: 90, emissive: d.color, emissiveIntensity: 0.15 })) : L(d.color);
  box(g, ...d.size, 0, d.size[1] / 2, 0, m);
  if (type === "bandage") box(g, 0.32, 0.08, 0.32, 0, 0.15, 0, L(0xd02a2a));
  if (type === "dynamite") box(g, 0.04, 0.25, 0.04, 0.2, 0.3, 0, L(0xeeeeee));
  if (type === "chair") { box(g, 0.5, 0.08, 0.5, 0, 0.5, 0, L(0x5a3a1a)); g.children[0].scale.set(1, 1, 0.15); g.children[0].position.z = -0.22; }
  if (type === "cash") box(g, 0.2, 0.15, 0.2, 0, 0.5, 0, L(0x8a7a4a));
  if (type === "skull") { box(g, 0.18, 0.18, 0.05, -0.18, 0.45, 0.41, L(0x111111)); box(g, 0.18, 0.18, 0.05, 0.18, 0.45, 0.41, L(0x111111)); }
  return g;
}
let myNet = 0, itemCounter = 0;
const newItemId = () => (myNet + 1) * 1000000 + ++itemCounter;
function addItem(type, x, y, z, extra = {}) {
  const id = extra.id ?? newItemId();
  if (itemById.has(id)) return itemById.get(id);
  const mesh = extra.mesh || (type === "corpse" ? corpseMesh(extra.kind || "walker") : itemMesh(type));
  const it = { type, x, y, z, vx: 0, vy: 0, vz: 0, r: 0.3, h: 0.4, ...extra, id, mesh };
  if (type === "corpse") { it.r = 0.5; it.bounty ??= FOES[it.kind || "walker"].bounty; it.foe ??= FOES[it.kind || "walker"].name; }
  it.mesh.rotation.y = Math.random() * 6; scene.add(it.mesh); items.push(it); itemById.set(id, it); return it;
}
function removeItem(it) { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); scene.remove(it.mesh); itemById.delete(it.id); goneIds.add(it.id); if (held === it) held = null; }
// an item made by me that everybody should see (bought, dropped, out of the backpack...)
function shareNew(it) { ev(`n,${it.id},${typeCode(it)},${f1(it.x)},${f1(it.y)},${f1(it.z)}`); }
const typeCode = (it) => (it.type === "corpse" ? "C" + KCH[it.kind || "walker"] : it.type);

// ---------------------------------------------------------------- the undead
const FOES = {
  walker: { name: "Walker", hp: 70, speed: 2.6, dmg: 10, bounty: 15, skin: 0x8aa86a, shirt: 0x6a5a4a, zombie: true },
  runner: { name: "Runner", hp: 45, speed: 6.8, dmg: 8, bounty: 20, skin: 0x9ab878, shirt: 0x8a3a2a, zombie: true },
  brute: { name: "Miner Brute", hp: 280, speed: 2.3, dmg: 26, bounty: 60, skin: 0x7a9a5a, shirt: 0x4a5a7a, scale: 1.4, zombie: true },
  soldier: { name: "Dead Soldier", hp: 125, speed: 3.6, dmg: 14, bounty: 35, skin: 0x8aa070, shirt: 0x2a3a6a, hat: "kepi", zombie: true },
  vamp: { name: "Vampire", hp: 170, speed: 8, dmg: 15, bounty: 80, skin: 0xe8e4f0, shirt: 0x1a1a22, cape: 0x8a0a1a, eyes: 0xff2020, hair: 0x111111, vamp: true },
  bat: { name: "Bat", hp: 18, speed: 9, dmg: 5, bounty: 0, fly: true },
  lord: { name: "The Pale Baron", hp: 1800, speed: 6, dmg: 30, bounty: 0, skin: 0xf0eef8, shirt: 0x2a0a14, cape: 0xa0101a, eyes: 0xff1010, hat: "crown", scale: 1.7, vamp: true, boss: true },
  colossus: { name: "The Bone Colossus", hp: 4500, speed: 3.4, dmg: 40, bounty: 0, skin: 0xe8e0c8, shirt: 0xd8d0b8, pants: 0xc8c0a8, eyes: 0xff6a1a, ribs: true, scale: 3.4, boss: true },
};
const KCH = { walker: "w", runner: "r", brute: "b", soldier: "s", vamp: "v", bat: "a", lord: "l", colossus: "c" };
const CHK = Object.fromEntries(Object.entries(KCH).map(([k, v]) => [v, k]));
const foes = [], foeById = new Map();
let foeCounter = 0;
const batGeo = new THREE.BoxGeometry(0.35, 0.25, 0.3), wingGeo = new THREE.BoxGeometry(0.6, 0.04, 0.3), batMat = L(0x1a1a1e), batEye = new THREE.MeshBasicMaterial({ color: 0xff2020 });
function foeModel(kind) {
  const d = FOES[kind];
  if (d.fly) {
    const root = new THREE.Group(), b = new THREE.Mesh(batGeo, batMat), wl = new THREE.Mesh(wingGeo, batMat), wr = new THREE.Mesh(wingGeo, batMat);
    wl.position.x = -0.4; wr.position.x = 0.4; root.add(b, wl, wr); const e = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), batEye); e.position.set(0, 0.04, 0.16); root.add(e);
    return { root, wl, wr, t: 0 };
  }
  const m = makeHuman(d); m.zombie = d.zombie || kind === "colossus"; return m;
}
function corpseMesh(kind) { const m = foeModel(kind); layDown(m, FOES[kind]); return m.root; }
function layDown(m, d) { m.body.rotation.x = -Math.PI / 2; m.body.position.y = 0.25 * (d.scale || 1); m.legL.rotation.x = m.legR.rotation.x = 0; m.armL.rotation.x = m.armR.rotation.x = -3; }
function spawnFoe(kind, x, z, y, id) {
  const d = FOES[kind];
  const f = { id: id ?? ++foeCounter, kind, d, x, z, y: y ?? groundH(x, z) + (d.fly ? 4 : 0), vx: 0, vy: 0, vz: 0, r: 0.4 * (d.scale || 1), h: 1.8 * (d.scale || 1), hp: d.hp, max: d.hp, model: foeModel(kind), atk: 0, cd: 0, yaw: 0, aggro: false, hit: 0, leap: 0 };
  scene.add(f.model.root); foes.push(f); foeById.set(f.id, f);
  return f;
}
function dropFoe(f) { const i = foes.indexOf(f); if (i >= 0) foes.splice(i, 1); foeById.delete(f.id); }
// (the host decides deaths; everybody turns the model into a body you can carry)
function killFoe(f, burn) {
  if (!isHost()) return;
  dropFoe(f); RUN.kills++;
  if (f.d.fly || burn) { scene.remove(f.model.root); puff(f.x, f.y + 1, f.z, burn ? 0x333333 : 0x1a1a1a, 10); ev(`K,${f.id}`); return; }
  ev(`k,${f.id},${KCH[f.kind]},${f1(f.x)},${f1(f.y)},${f1(f.z)}`);
  becomeBody(f);
}
function becomeBody(f) {
  if (f.kind === "lord") { scene.remove(f.model.root); boomFx(f.x, f.y + 1, f.z); RUN.baron = true; banner("THE PALE BARON IS DUST!", "His crown is worth $500. The keep's chest is open."); SFX.win(); if (isHost()) { const c = addItem("crown", f.x, f.y + 1, f.z); shareNew(c); } return; }
  if (f.kind === "colossus") { scene.remove(f.model.root); boomFx(f.x, f.y + 2, f.z); RUN.colossus = true; banner("THE COLOSSUS FALLS!", "Its skull is worth $800. The bridge keeps coming down!"); SFX.win(); if (isHost()) { const c = addItem("skull", f.x, f.y + 1, f.z); shareNew(c); } return; }
  layDown(f.model, f.d);
  addItem("corpse", f.x, f.y, f.z, { id: 500000000 + f.id, mesh: f.model.root, kind: f.kind });
}

// ---------------------------------------------------------------- effects
const fx = [];
const fxGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
function puff(x, y, z, color, n = 6) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); scene.add(m); fx.push({ m, vx: rand(-3, 3), vy: rand(1, 5), vz: rand(-3, 3), t: rand(0.4, 0.8) }); } }
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe8a0, transparent: true });
function tracer(a, b) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, tracerMat.clone()); scene.add(l); fx.push({ line: l, t: 0.07 }); }
let shake = 0;
function boomFx(x, y, z) {
  SFX.boom(); shake = Math.max(shake, Math.hypot(P.x - x, P.z - z) < 40 ? 0.8 : 0.2);
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 })); s.position.set(x, y, z); scene.add(s); fx.push({ ball: s, t: 0.5 });
  puff(x, y, z, 0x553322, 16);
}
// an explosion: the host hurts the undead, everybody hurts themselves
function boom(x, y, z, share = true) {
  boomFx(x, y, z);
  if (share) ev(`o,${f1(x)},${f1(y)},${f1(z)}`);
  if (isHost()) for (const f of [...foes]) { const dd = Math.hypot(f.x - x, f.y + 1 - y, f.z - z); if (dd < 6) hurtFoe(f, 200 * (1 - dd / 7), x, z); }
  const dp = Math.hypot(P.x - x, P.y + 1 - y, P.z - z); if (dp < 5) hurtPlayer(50 * (1 - dp / 6));
}

// ---------------------------------------------------------------- the player
const P = { x: LOBBY_X, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.38, h: 1.8, yaw: 0, pitch: -0.1, hp: 100, armor: 0, ground: true, onTrain: false, dead: false };
let hero = null, heroGun = null, held = null, mounted = false, gatHeat = 0, fp = false, aiming = false;
let mode = "title"; // title | lobby | run
const RUN = { money: 0, kills: 0, bounty: 0, time: 0, baron: false, colossus: false, over: false, won: false, nights: 0, lastNight: false, start: "a", midSaved: false, seed: 1 };
const INV = { weapons: [], cur: 0, ammo: { pistol: 0, shells: 0, rifle: 0 }, mag: {}, bandage: 0, holy: 0, gatling: false, pack: [] };
const PACK = 8;
let reloadT = 0, fireCD = 0, healT = 0, meleeT = 0;
const BR = { on: false, p: 0 }; // the drawbridge: lowering? how far down (0..1)

function buildHero() {
  if (hero) scene.remove(hero.root);
  hero = makeHuman(myLookOpts());
  heroGun = new THREE.Group(); hero.armR.add(heroGun); heroGun.position.set(0, -0.75, 0.1);
  scene.add(hero.root); setGunModel();
}
function setGunModel() {
  if (!heroGun) return;
  heroGun.clear(); const w = INV.weapons[INV.cur]; const m = L(0x2a2a2e), wd = L(0x6a4428);
  if (w === "shovel") { box(heroGun, 0.06, 0.06, 1.2, 0, 0, 0.4, wd); box(heroGun, 0.3, 0.04, 0.35, 0, 0, 1.05, L(0x8a8a90)); }
  else if (w === "pickaxe") { box(heroGun, 0.07, 0.07, 1.1, 0, 0, 0.35, wd); box(heroGun, 0.9, 0.08, 0.1, 0, 0, 0.9, L(0x7a7a80)); }
  else if (w === "revolver") { box(heroGun, 0.08, 0.2, 0.12, 0, -0.05, 0.05, wd); box(heroGun, 0.07, 0.08, 0.45, 0, 0.06, 0.25, m); }
  else if (w === "shotgun") { box(heroGun, 0.1, 0.1, 1.1, 0, 0.04, 0.35, m); box(heroGun, 0.1, 0.18, 0.4, 0, -0.04, -0.15, wd); }
  else if (w === "rifle") { box(heroGun, 0.07, 0.08, 1.3, 0, 0.04, 0.45, m); box(heroGun, 0.1, 0.16, 0.5, 0, -0.04, -0.15, wd); box(heroGun, 0.06, 0.06, 0.3, 0, 0.13, 0.3, m); }
}
function clearRunStuff() {
  for (const f of [...foes]) scene.remove(f.model.root); foes.length = 0; foeById.clear();
  for (const it of [...items]) removeItem(it); goneIds.clear();
  for (const p of world.places) { if (p.built) world.unbuild(p); p.spawned = false; p.looted = false; }
  for (const i of world.inter) i.open = false;
  bridgeCol = null; BR.on = false; BR.p = 0;
}

// ---------------------------------------------------------------- THE LOBBY
function enterLobby() {
  mode = "lobby"; clearRunStuff(); closePanel(true);
  Object.assign(P, { x: LOBBY_X + rand(-4, 4), y: 0, z: rand(-4, 4), vx: 0, vy: 0, vz: 0, yaw: Math.PI, pitch: -0.1, hp: 100, dead: false });
  held = null; mounted = false; INV.weapons = ["shovel"]; INV.cur = 0; INV.pack = [];
  train.visible = false; TR.x = LOBBY_X - 400; TR.v = 0; syncTrainCols(); dayT = 0.3;
  buildHero(); world.update(LOBBY_X, onBuilt); updateSky(0);
  document.body.classList.add("inLobby"); $("hud").classList.remove("hidden");
  myPad = -1; padIds.forEach((s) => s.clear()); padT.fill(null); launching = false;
  connectLobby();
  music(0);
}
const lobbyPlace = () => world.places.find((p) => p.type === "lobby" && p.built);
const padIds = Array.from({ length: 5 }, () => new Set());
const padT = Array(5).fill(null);
let myPad = -1, launching = false;
function lobbyStep(dt) {
  const lp = lobbyPlace(); if (!lp) return;
  const me = lobbyId();
  let on = -1;
  lp.P.pads.forEach((pd, i) => {
    if (Math.abs(P.x - pd.x) < 3 && Math.abs(P.z - pd.z) < 3) {
      if (pd.mid && !save.mid) { if (!RUN.midWarn) { RUN.midWarn = true; toast("The MIDWAY train is locked. Reach the Halfway Post (6 km) on a run to open it!"); } return; }
      if (padIds[i].size >= 4 && !padIds[i].has(me)) { if (!RUN.fullWarn) { RUN.fullWarn = true; toast("That train is full (4 riders)."); } return; }
      on = i;
    }
  });
  if (on < 0) RUN.midWarn = RUN.fullWarn = false;
  if (on !== myPad) {
    if (myPad >= 0) padIds[myPad].delete(me);
    myPad = on; if (on >= 0) { padIds[on].add(me); SFX.click(); toast(lp.P.pads[on].mid ? "On the MIDWAY train: you'll start at 6 km with what you had there." : "On the train! It leaves when the timer runs out. Up to 4 riders."); }
    if (NET.lobby?.conn?.open) NET.lobby.conn.send({ t: "ltpad", p: on });
  }
  lp.P.pads.forEach((pd, i) => {
    const n = padIds[i].size;
    if (n === 0) padT[i] = null; else if (padT[i] === null) padT[i] = 15;
    if (padT[i] !== null) { padT[i] -= dt; if (n >= 4) padT[i] = Math.min(padT[i], 4); }
    const label = pd.mid ? "MIDWAY" : "TRAIN " + (i + 1);
    pd.sign.draw(label, pd.mid && !save.mid && n === 0 ? "locked" : `${n} / 4${padT[i] !== null ? "  ·  " + Math.max(0, Math.ceil(padT[i])) + "s" : ""}`, pd.mid ? "#ffd23a" : n >= 4 ? "#ff7a5a" : null);
    // the leader (lowest id on the pad) sends everyone off
    if (i === myPad && padT[i] !== null && padT[i] <= 0 && !launching && (!NET.lobby || NET.lobby.conn?.open)) {
      const ids = [...padIds[i]].sort((a, b) => a - b).slice(0, 4);
      if (ids[0] === me) launch(i, ids, pd.mid);
    }
  });
}
function launch(i, ids, mid) {
  launching = true; const seed = Math.floor(Math.random() * 2e9), code = newCode();
  const conn = NET.lobby?.conn;
  if (conn && conn.open && ids.length > 1) conn.send({ t: "ltgo", p: i, c: code, s: seed, m: mid ? "m" : "a", ids });
  setTimeout(() => startRun(mid ? "m" : "a", seed, ids.length > 1 ? code : null, true), 150);
}
const lobbyId = () => NET.lobby?.conn?.id || 0;

// ---------------------------------------------------------------- multiplayer
const NET = { lobby: null, run: null, others: new Map(), sent: 0, sentT: 0, q: [], sT: 0, xT: 0, shotT: 0 };
const isHost = () => (NET.run?.conn?.open ? NET.run.conn.isHost : RUN.leader !== false);
const curConn = () => (mode === "run" ? NET.run?.conn : NET.lobby?.conn);
function budget() { const now = performance.now(); if (now - NET.sentT > 1000) { NET.sentT = now; NET.sent = 0; } return 27 - NET.sent; }
function send(o, important) { const c = curConn(); if (!c || !c.open) return false; if (budget() <= (important ? 0 : 6)) return false; NET.sent++; c.send(o); return true; }
// a run event (everybody else gets it); queued so a burst never gets dropped by the relay's 30-a-second cap
function ev(d) { if (mode !== "run" || !NET.run?.conn?.open) return; NET.q.push(d); }
function flushEvents() { while (NET.q.length && budget() > 2) { let d = NET.q.shift(); while (NET.q.length && d.length + NET.q[0].length < 190) d += "~" + NET.q.shift(); send({ t: "lte", d }, true); } }
function connectLobby() {
  if (NET.lobby) return;
  NET.lobby = joinLobby((m, conn) => onNet(m, conn, "lobby"), (why) => { NET.lobby = null; if (mode === "lobby") { clearOthers(); toast(why === "full" ? "Every lobby is full: playing solo." : "Offline: you can still ride solo."); } });
}
function leaveLobby() { if (NET.lobby) { const l = NET.lobby; NET.lobby = null; l.close(); } clearOthers(); }
function clearOthers() { for (const o of NET.others.values()) scene.remove(o.h.root); NET.others.clear(); }
function addOther(id, name, look) {
  if (NET.others.has(id) || id === curConn()?.id) return NET.others.get(id);
  const o = { id, name: name || "Rider", look, h: makeHuman(lookFromCode(look)), x: 0, y: -100, z: 0, yaw: 0, tx: 0, ty: -100, tz: 0, tyaw: 0, rel: false, dead: false, seen: 0 };
  o.tag = nameTag(o.name); o.h.root.add(o.tag); scene.add(o.h.root); NET.others.set(id, o); return o;
}
function setOtherLook(o, look) { if (JSON.stringify(look) === JSON.stringify(o.look)) return; o.look = look; const pos = o.h.root.position.clone(); scene.remove(o.h.root); o.h = makeHuman(lookFromCode(look)); o.h.root.position.copy(pos); o.h.root.add(o.tag); scene.add(o.h.root); }
function onNet(m, conn, which) {
  if ((which === "lobby" && conn !== NET.lobby?.conn) || (which === "run" && conn !== NET.run?.conn)) return;
  if (m.t === "welcome") {
    myNet = m.id; clearOthers();
    for (const p of m.players || []) addOther(p.id, p.n, p.k);
    conn.send({ t: "look", k: lookCode() });
    if (which === "lobby" && myPad >= 0) { padIds[myPad].delete(0); padIds[myPad].add(m.id); conn.send({ t: "ltpad", p: myPad }); }
    if (which === "run") toast(conn.isHost ? "You're running this train." : "Riding with your crew!");
  } else if (m.t === "join" || m.t === "back") { addOther(m.id, m.n); const c = curConn(); if (c) { c.send({ t: "look", k: lookCode() }); if (which === "lobby" && myPad >= 0) c.send({ t: "ltpad", p: myPad }); } }
  else if (m.t === "leave" || m.t === "away") { const o = NET.others.get(m.id); if (o) { scene.remove(o.h.root); NET.others.delete(m.id); } padIds.forEach((s) => s.delete(m.id)); for (const it of items) if (it.heldBy === m.id) it.heldBy = 0; if (mode === "run") checkAllDead(); }
  else if (m.t === "look") { const o = NET.others.get(m.id) || addOther(m.id); if (o) setOtherLook(o, m.k); }
  else if (m.t === "s") {
    const o = NET.others.get(m.id) || addOther(m.id); if (!o) return;
    o.rel = !!m.w; o.tx = m.p[0]; o.ty = m.p[1]; o.tz = m.p[2]; o.tyaw = m.r; o.dead = !!m.c; o.seen = performance.now();
    if (o.y < -50) { o.x = o.tx + (o.rel ? TR.x : 0); o.y = o.ty; o.z = o.tz; }
  }
  else if (m.t === "ltpad") { padIds.forEach((s) => s.delete(m.id)); if (m.p >= 0 && m.p < 5) padIds[m.p].add(m.id); }
  else if (m.t === "ltgo") {
    for (const id of m.ids) padIds.forEach((s) => s.delete(id));
    if (m.ids.includes(lobbyId()) && mode === "lobby" && !launching) { launching = true; startRun(m.m, m.s, m.c, false); }
  }
  else if (m.t === "shot" && mode === "run") tracer(new THREE.Vector3(m.p[0] + TR.x, m.p[1], m.p[2]), new THREE.Vector3(m.x[0] + TR.x, m.x[1], m.x[2]));
  else if (m.t === "ltx" && mode === "run") onSnap(m.d);
  else if (m.t === "lte" && mode === "run") for (const d of m.d.split("~")) onEvent(m.id, d.split(","));
  else if (m.t === "host" && mode === "run" && m.id === conn.id) becomeHost();
}
// the host's picture of the run: "T x,v,throttle,fuel,dayT,nights,bridge,flags | foe;foe;..."
function sendSnap() {
  const others = [...NET.others.values()];
  const near = foes.filter((f) => !f.remote).map((f) => [f, Math.min(Math.hypot(f.x - P.x, f.z - P.z), ...others.map((o) => Math.hypot(f.x - o.x, f.z - o.z)))]).sort((a, b) => a[1] - b[1]).slice(0, 36).map(([f]) => f);
  const head = `T${f1(TR.x)},${TR.v.toFixed(2)},${TR.throttle},${Math.round(TR.fuel)},${dayT.toFixed(4)},${RUN.nights},${BR.p.toFixed(3)},${(BR.on ? 1 : 0) + (RUN.baron ? 2 : 0) + (gatlingG.visible ? 4 : 0)}`;
  let msg = head + "|", count = 0;
  const flush = () => { send({ t: "ltx", d: msg.replace(/;$/, "") }, true); msg = "F|"; count++; };
  for (const f of near) {
    const s = `${f.id.toString(36)},${KCH[f.kind]},${f1(f.x - TR.x)},${f1(f.y)},${f1(f.z)},${Math.round(f.yaw * 100)},${Math.round((f.hp / f.max) * 99)},${f.atk > 0.5 ? 1 : 0};`;
    if (msg.length + s.length > 450) flush();
    msg += s;
  }
  if (count === 0 || msg.length > 2) flush();
}
function onSnap(d) {
  if (isHost()) return;
  const [h, fs] = d.split("|");
  if (h[0] === "T") {
    const a = h.slice(1).split(",").map(Number);
    if (Math.abs(TR.x - a[0]) > 4) TR.x = a[0]; else TR.x += (a[0] - TR.x) * 0.3;
    TR.v = a[1]; TR.throttle = a[2]; TR.fuel = a[3];
    if (Math.abs(dayT - a[4]) > 0.002) dayT = a[4];
    RUN.nights = a[5]; BR.p = a[6]; BR.on = !!(a[7] & 1); if (a[7] & 2) RUN.baron = true; if (a[7] & 4) gatlingG.visible = INV.gatling = true;
  }
  if (!fs) return;
  const now = performance.now();
  for (const s of fs.split(";")) {
    const p = s.split(","); if (p.length < 8) continue;
    const id = parseInt(p[0], 36), kind = CHK[p[1]]; if (!kind) continue;
    let f = foeById.get(id);
    if (!f) { f = spawnFoe(kind, TR.x + +p[2], +p[4], +p[3], id); f.remote = true; }
    f.trx = +p[2]; f.ty = +p[3]; f.tz = +p[4]; f.tyaw = +p[5] / 100; f.hp = (+p[6] / 99) * f.max; if (+p[7]) f.atk = 1; f.seen = now; f.aggro = true;
  }
}
function onEvent(from, a) {
  const k = a[0], n = (i) => +a[i];
  if (k === "h" && isHost()) { const o = NET.others.get(from); for (let i = 1; i < a.length; i++) { const [fid, dmg] = a[i].split(":"); const f = foeById.get(parseInt(fid, 36)); if (f) hurtFoe(f, +dmg, o?.x, o?.z, true); } }
  else if (k === "d" && n(1) === myNet) hurtPlayer(n(2), a[3] === "1");
  else if (k === "k" || k === "K") {
    const f = foeById.get(n(1));
    if (k === "K") { if (f) { dropFoe(f); scene.remove(f.model.root); puff(f.x, f.y + 1, f.z, 0x222222, 8); } return; }
    if (f) { dropFoe(f); f.x = n(3); f.y = n(4); f.z = n(5); f.model.root.position.set(f.x, f.y, f.z); f.model.root.scale.setScalar(f.d.scale || 1); becomeBody(f); }
    else if (!goneIds.has(500000000 + n(1))) { const kind = CHK[a[2]]; if (kind === "lord" || kind === "colossus") becomeBody({ kind, d: FOES[kind], x: n(3), y: n(4), z: n(5), model: { root: new THREE.Group() } }); else if (kind) addItem("corpse", n(3), n(4), n(5), { id: 500000000 + n(1), kind }); }
  }
  else if (k === "p") { const it = itemById.get(n(1)); if (it) { it.heldBy = from; if (held === it) held = null; } }
  else if (k === "g") {
    let it = itemById.get(n(1));
    if (!it) it = makeFromCode(n(1), a[2], n(3), n(4), n(5));
    if (!it) return;
    it.heldBy = 0; it.x = n(3); it.y = n(4); it.z = n(5); it.vx = n(6); it.vy = n(7); it.vz = n(8); it.flying = !!(it.vx || it.vy || it.vz); it.ground = false; it.onTrain = false;
    if (it.type === "dynamite" && it.flying) it.lit = 2.2;
  }
  else if (k === "x") { const it = itemById.get(n(1)); if (it) removeItem(it); else goneIds.add(n(1)); }
  else if (k === "n") { if (!itemById.has(n(1)) && !goneIds.has(n(1))) makeFromCode(n(1), a[2], n(3), n(4), n(5)); }
  else if (k === "f" && isHost()) { TR.fuel = Math.min(TR.maxFuel, TR.fuel + n(1)); flare = 1; }
  else if (k === "t" && isHost()) { TR.throttle = clamp(n(1), 0, 3); }
  else if (k === "v") { const v = world.inter.find((i) => i.kind === "vault" && Math.abs(i.x - n(1)) < 1); if (v) v.open = true; }
  else if (k === "c") { const p = world.places.find((q) => Math.abs(q.x - n(1)) < 1); if (p) p.looted = true; }
  else if (k === "b") startBridge();
  else if (k === "D") { const o = NET.others.get(from); if (o) o.dead = true; toast(`${o ? o.name : "A rider"} went down!`); checkAllDead(); }
  else if (k === "W") win();
  else if (k === "L") gameOver(false);
  else if (k === "o") boom(n(1), n(2), n(3), false);
  else if (k === "y") holySplash(n(1), n(2), n(3), false);
  else if (k === "G") { gatlingG.visible = INV.gatling = true; }
}
function makeFromCode(id, code, x, y, z) {
  if (goneIds.has(id)) return null;
  if (code && code[0] === "C") return addItem("corpse", x, y, z, { id, kind: CHK[code[1]] || "walker" });
  if (!ITEMS[code]) return null;
  return addItem(code, x, y, z, { id });
}
function becomeHost() {
  toast("The leader left: your game runs the train now.");
  for (const f of foes) if (f.remote) { f.remote = false; f.aggro = true; }
}
function checkAllDead() {
  if (!isHost() || RUN.over || mode !== "run") return;
  const alive = (!P.dead ? 1 : 0) + [...NET.others.values()].filter((o) => !o.dead).length;
  if (alive === 0) { ev("L"); flushEvents(); gameOver(false); }
}
function sendState(dt) {
  const c = curConn(); if (!c || !c.open) return;
  NET.sT -= dt;
  if (NET.sT <= 0) { NET.sT = 0.125; const rel = mode === "run" && P.onTrain; send({ t: "s", p: [rel ? P.x - TR.x : P.x, P.y, P.z], r: P.yaw, c: P.dead ? 1 : 0, w: rel ? 1 : 0 }); }
  if (mode === "run" && isHost() && NET.others.size) { NET.xT -= dt; if (NET.xT <= 0) { NET.xT = 0.22; sendSnap(); } }
  flushEvents();
}
function updateOthers(dt) {
  for (const o of NET.others.values()) {
    const tx = o.tx + (o.rel ? TR.x : 0);
    if (Math.abs(o.x - tx) > 15) o.x = tx;
    const k = Math.min(1, dt * 12), px = o.x, pz = o.z;
    o.x = lerp(o.x, tx, k); o.y = lerp(o.y, o.ty, k); o.z = lerp(o.z, o.tz, k);
    let dy = o.tyaw - o.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; o.yaw += dy * k;
    o.h.root.position.set(o.x, o.y, o.z); o.h.root.rotation.y = o.yaw; o.h.root.visible = o.y > -50;
    const sp = Math.hypot(o.x - px - (o.rel ? TR.v * dt : 0), o.z - pz) / Math.max(dt, 0.001);
    animHuman(o.h, sp, dt);
    if (o.dead) { o.h.body.rotation.x = -Math.PI / 2; o.h.body.position.y = 0.3; } else { o.h.body.rotation.x = 0; o.h.body.position.y = 0; }
  }
  for (const it of items) if (it.heldBy) { const o = NET.others.get(it.heldBy); if (!o) { it.heldBy = 0; continue; } it.x = o.x + Math.sin(o.yaw) * 0.7; it.z = o.z + Math.cos(o.yaw) * 0.7; it.y = o.y + (it.type === "corpse" ? 1.3 : 0.9); it.mesh.position.set(it.x, it.y, it.z); it.mesh.rotation.y = o.yaw + (it.type === "corpse" ? Math.PI / 2 : 0); o.h.armL.rotation.x = o.h.armR.rotation.x = -1.3; }
}

// ---------------------------------------------------------------- input
const keys = {};
let locked = false, mouseDown = false, paused = false;
function lock() { try { const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch {} }
addEventListener("keydown", (e) => {
  if (e.target && e.target.tagName === "INPUT") return;
  if (e.repeat) return; keys[e.code] = true; audio();
  if (mode === "title") return;
  if (e.code === "Escape" && panelOpen) closePanel();
  if (e.code === "KeyB" && (mode === "run" || mode === "lobby")) { panelOpen && panelKind === "pack" ? closePanel() : openPack(); return; }
  if (panelOpen) return;
  if (e.code === "KeyE") interact();
  if (P.dead) return;
  if (e.code === "KeyR") reload();
  if (e.code === "KeyH") useBandage();
  if (e.code === "KeyG") throwHoly();
  if (e.code === "KeyT" && held) stow();
  if (e.code === "KeyQ" && held) throwHeld();
  if (e.code === "KeyV") fp = !fp;
  if (e.code === "KeyF" && near.lever) setThrottle(TR.throttle - 1);
  if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (INV.weapons[i]) { INV.cur = i; reloadT = 0; setGunModel(); SFX.click(); } }
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("wheel", (e) => { if (mode !== "run" || panelOpen || mounted || !INV.weapons.length) return; INV.cur = (INV.cur + (e.deltaY > 0 ? 1 : INV.weapons.length - 1)) % INV.weapons.length; reloadT = 0; setGunModel(); });
canvas.addEventListener("mousedown", (e) => {
  audio(); if (mode === "title" || panelOpen) return;
  if (!locked) { lock(); return; }
  if (e.button === 0) mouseDown = true; if (e.button === 2) aiming = true;
});
addEventListener("mouseup", (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) aiming = false; });
addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle("locked", locked); if (!locked && mode === "run" && !panelOpen && !RUN.over && NET.others.size === 0) showPause(true); });
addEventListener("mousemove", (e) => { if (!locked) return; const k = aiming && WEAPONS[INV.weapons[INV.cur]]?.zoom ? 0.0008 : 0.0022; P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.2, 1.1); });

// ---------------------------------------------------------------- doing things (E)
const near = { lever: false, furnace: false, gat: false, inter: null, item: null };
function setThrottle(t) {
  t = clamp(t, 0, 3); if (t === TR.throttle) return; TR.throttle = t; SFX.lever(); if (t && TR.v < 1) SFX.whistle();
  toast(["Throttle: STOP (brakes on)", "Throttle: SLOW", "Throttle: HALF", "Throttle: FULL STEAM"][t]);
  if (!isHost()) ev(`t,${t}`);
}
function scanNear() {
  const inRun = mode === "run";
  const lv = trainPt(LEVER), fu = trainPt(FURNACE), ga = trainPt(GAT);
  near.lever = inRun && Math.hypot(P.x - lv.x, P.z - lv.z) < 1.7 && Math.abs(P.y - DECK) < 1;
  near.furnace = inRun && Math.hypot(P.x - fu.x, P.z - fu.z) < 2.2 && Math.abs(P.y - DECK) < 1;
  near.gat = inRun && INV.gatling && Math.hypot(P.x - ga.x, P.z - ga.z) < 1.8 && Math.abs(P.y - DECK) < 1;
  near.inter = null; let bd = 1e9;
  for (const it of world.inter) { const d = Math.hypot(P.x - it.x, P.z - it.z); if (d < it.r && d < bd) { bd = d; near.inter = it; } }
  for (const p of world.places) if (p.built && p.chestAt && Math.hypot(P.x - p.chestAt.x, P.z - p.chestAt.z) < 2.6) near.inter = { kind: "chest", p };
  near.item = null; bd = 2.4;
  const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw);
  for (const it of items) {
    if (it === held || it.flying || it.heldBy) continue;
    const dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz);
    if (d > 2.6 || Math.abs(it.y - P.y) > 1.6) continue;
    const s = d - (dx * fx2 + dz * fz2) / Math.max(0.01, d) * 0.8;
    if (s < bd) { bd = s; near.item = it; }
  }
}
function interact() {
  if (P.dead) return;
  if (mode === "lobby") { const it = near.inter; if (!it) return; if (it.kind === "outfit") openOutfitter(); else if (it.kind === "classes") openClasses(); else if (it.kind === "lobbyguns") openLobbyGuns(); return; }
  if (mounted) { mounted = false; toast("Off the gatling gun"); return; }
  if (near.gat && !held) { mounted = true; toast("On the gatling gun: click to fire, E to get off"); return; }
  if (near.lever && !held) { setThrottle(TR.throttle >= 3 ? 0 : TR.throttle + 1); return; }
  if (held) {
    const d = ITEMS[held.type];
    if (near.furnace && d.fuel) return burn(held);
    const it = near.inter;
    if (it && it.kind === "sheriff" && held.type === "corpse") { pay(held.bounty, `Bounty: ${held.foe} +$${held.bounty}`); RUN.bounty += held.bounty; consume(held); return; }
    if (it && (it.kind === "store" || it.kind === "guns") && d.value) { pay(d.value, `Sold ${d.name} +$${d.value}`); consume(held); return; }
    if (it && it.kind === "sheriff" && d.value) { const v = Math.round(d.value * 0.8); pay(v, `The Sheriff paid $${v} for the ${d.name}`); consume(held); return; }
    if (it && it.kind === "vault" && held.type === "dynamite") { const v = it; consume(held); lightDynamite(v.x, P.y + 0.6, v.z, 3, v); toast("The fuse is lit! RUN!"); return; }
    dropHeld(); return;
  }
  if (near.item) return pickUp(near.item);
  const it = near.inter;
  if (!it) return;
  if (it.kind === "store" || it.kind === "guns") return openShop(it);
  if (it.kind === "sheriff") return toast("Sheriff: \"Bring me the bodies of the undead. I pay bounty on every one.\" (carry one here and press E)");
  if (it.kind === "vault") return toast(it.open ? "The vault is empty now." : "The vault is locked tight. A stick of dynamite would open it... (buy one at a store)");
  if (it.kind === "bridge") { if (BR.on) return toast("The bridge is already coming down! Hold them off!"); SFX.lever(); ev("b"); startBridge(); return; }
  if (it.kind === "chest") {
    if (it.p.type === "keep" && !RUN.baron) return toast("The Baron's chest is sealed by dark magic. Destroy the Pale Baron first!");
    if (it.p.looted) return toast("The chest is empty.");
    it.p.looted = true; ev(`c,${it.p.x}`); SFX.cash();
    for (let i = 0; i < 3; i++) shareNew(addItem("gold", it.p.chestAt.x + rand(-1, 1), P.y + 1, it.p.chestAt.z + rand(-1, 1)));
    shareNew(addItem("cash", it.p.chestAt.x, P.y + 1, it.p.chestAt.z, { amount: 150 })); toast("The chest bursts open: gold!");
  }
}
// an item leaves the world for good (sold, burned, grabbed, in the backpack)
function consume(it) { ev(`x,${it.id}`); removeItem(it); }
function pay(n, msg) { RUN.money += n; SFX.cash(); toast(msg); bumpMoney(); }
function pickUp(it) {
  const d = ITEMS[it.type];
  if (d.grab) {
    consume(it); SFX.pick();
    if (it.type === "cash") { const n = it.amount || 10 + (it.id % 36); RUN.money += n; toast(`+$${n}`); bumpMoney(); SFX.coin(); }
    if (it.type === "ammo") { const k = ["pistol", "pistol", "shells", "rifle"][it.id % 4]; INV.ammo[k] += AMMO[k].n; toast(`+${AMMO[k].n} ${AMMO[k].name}`); }
    if (it.type === "bandage") { INV.bandage++; toast("+1 Bandage (H to use)"); }
    if (it.type === "holy") { INV.holy++; toast("+1 Holy water (G to throw, hurts vampires a lot)"); }
    if (it.type.startsWith("gun_")) giveGun(it.type.slice(4), true);
    return;
  }
  held = it; it.vx = it.vz = it.vy = 0; it.heldBy = 0; SFX.pick(); ev(`p,${it.id}`);
  toast(`Carrying: ${it.type === "corpse" ? "the body of a " + it.foe + " ($" + it.bounty + " bounty)" : d.name}. E = put down, Q = throw, T = backpack`);
}
function dropHeld() { if (!held) return; const it = held; held = null; it.x = P.x + Math.sin(P.yaw) * 0.9; it.z = P.z + Math.cos(P.yaw) * 0.9; it.y = P.y + 0.9; it.vx = it.vy = it.vz = 0; it.flying = false; it.ground = false; SFX.drop(); ev(`g,${it.id},${typeCode(it)},${f1(it.x)},${f1(it.y)},${f1(it.z)},0,0,0`); }
function throwHeld() {
  const it = held; held = null; const d = camDir();
  it.x = P.x + d.x; it.y = P.y + 1.4; it.z = P.z + d.z; it.vx = d.x * 11 + (P.onTrain ? TR.v : 0); it.vy = d.y * 11 + 3; it.vz = d.z * 11; it.flying = true; it.ground = false; it.onTrain = false; it.mine = true; SFX.swing();
  if (it.type === "dynamite") it.lit = 2.2;
  ev(`g,${it.id},${typeCode(it)},${f1(it.x)},${f1(it.y)},${f1(it.z)},${f1(it.vx)},${f1(it.vy)},${f1(it.vz)}`);
}
function burn(it) {
  const d = ITEMS[it.type]; const k = save.cls === "conductor" ? 1.2 : 1, amt = Math.round(d.fuel * k);
  if (!isHost()) ev(`f,${amt}`);
  TR.fuel = Math.min(TR.maxFuel, TR.fuel + amt);
  consume(it); SFX.furnace(); toast(`+${amt} fuel (${d.name})`); flare = 1;
}
let flare = 0;
const dyn = [];
function lightDynamite(x, y, z, t, vault) { const m = itemMesh("dynamite"); m.position.set(x, y, z); scene.add(m); dyn.push({ m, x, y, z, t, vault }); }
function useBandage() {
  if (healT > 0 || mode !== "run") return; if (INV.bandage <= 0) return toast("No bandages! Buy them at a store."); if (P.hp >= 100) return toast("You're already at full health.");
  INV.bandage--; healT = 2; SFX.heal(); toast("Patching up...");
}
const holyShots = [];
function throwHoly() {
  if (mode !== "run") return;
  if (INV.holy <= 0) return toast("No holy water! Stores sell it."); INV.holy--;
  const d = camDir(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8ad0ff }));
  m.position.set(P.x, P.y + 1.6, P.z); scene.add(m); holyShots.push({ m, x: P.x, y: P.y + 1.6, z: P.z, vx: d.x * 16 + (P.onTrain ? TR.v : 0), vy: d.y * 16 + 3, vz: d.z * 16, t: 3 }); SFX.swing();
}
function holySplash(x, y, z, share = true) {
  puff(x, y, z, 0x8ad0ff, 12); SFX.hiss();
  if (share) ev(`y,${f1(x)},${f1(y)},${f1(z)}`);
  if (isHost()) for (const f of [...foes]) { const dd = Math.hypot(f.x - x, f.z - z); if (dd < 4) hurtFoe(f, (f.d.vamp ? 180 : 40) * (1 - dd / 5), x, z); }
}
// ---- the backpack
function stow() {
  if (!held) return;
  if (held.type === "corpse") return toast("A whole body won't fit in your backpack!");
  if (INV.pack.length >= PACK) return toast("Your backpack is full (8 things).");
  const t = held.type; INV.pack.push({ type: t }); consume(held); SFX.pick(); toast(`Put the ${ITEMS[t].name} in your backpack (B to open it)`);
  if (panelKind === "pack") openPack();
}
function takeOut(i) {
  if (held) return toast("Your hands are full: put that down first.");
  const s = INV.pack.splice(i, 1)[0]; if (!s) return;
  const it = addItem(s.type, P.x, P.y + 0.9, P.z); held = it; shareNew(it); ev(`p,${it.id}`); SFX.pick();
  closePanel(); toast(`Holding: ${ITEMS[s.type].name}`);
}

// ---------------------------------------------------------------- shooting
function camDir() { const d = new THREE.Vector3(); camera.getWorldDirection(d); return d; }
function reload() {
  const w = WEAPONS[INV.weapons[INV.cur]]; if (!w || w.melee || reloadT > 0) return;
  const id = INV.weapons[INV.cur]; if ((INV.mag[id] ?? 0) >= w.mag) return; if (INV.ammo[w.ammo] <= 0) return toast(`Out of ${AMMO[w.ammo].name}! Buy more at a store.`);
  reloadT = w.reload * (save.cls === "gunslinger" ? 0.6 : 1); SFX.reload();
}
let hitBatch = new Map();
function hurtFoe(f, dmg, sx, sz, fromNet) {
  if (f.remote) { hitBatch.set(f.id, (hitBatch.get(f.id) || 0) + dmg); f.hit = 0.12; SFX.hit(); puff(f.x, f.y + f.h * 0.6, f.z, f.d.vamp ? 0x4a0010 : 0x6a1010, 3); return; }
  f.hp -= dmg; f.hit = 0.12; f.aggro = true; if (!fromNet) SFX.hit();
  puff(f.x, f.y + f.h * 0.6, f.z, f.d.vamp ? 0x4a0010 : 0x6a1010, 3);
  if (sx !== undefined && !f.d.boss) { const dx = f.x - sx, dz = f.z - sz, d = Math.hypot(dx, dz) || 1; f.vx += (dx / d) * 3; f.vz += (dz / d) * 3; }
  if (f.hp <= 0) killFoe(f);
}
function flushHits() { if (!hitBatch.size) return; ev("h," + [...hitBatch].map(([id, d]) => id.toString(36) + ":" + Math.round(d)).join(",")); hitBatch = new Map(); }
function shoot() {
  if (held) { if (mouseDown) { mouseDown = false; throwHeld(); } return; }
  const id = INV.weapons[INV.cur], w = WEAPONS[id];
  if (!w || !mouseDown || fireCD > 0 || reloadT > 0) return;
  if (w.melee) {
    fireCD = 1 / w.rate; meleeT = 0.3; SFX.swing();
    const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw); let hit = false;
    for (const f of [...foes]) { const dx = f.x - P.x, dz = f.z - P.z, d = Math.hypot(dx, dz); if (d < w.range + f.r && (dx * fx2 + dz * fz2) / (d || 1) > 0.3 && Math.abs(f.y - P.y) < 2 + f.h * 0.3) { hurtFoe(f, w.dmg, P.x, P.z); hit = true; } }
    if (hit) SFX.thunk();
    return;
  }
  if ((INV.mag[id] ?? 0) <= 0) { SFX.empty(); mouseDown = false; reload(); return; }
  INV.mag[id]--; fireCD = 1 / w.rate; SFX[w.snd](); shake = Math.max(shake, w.pellets > 1 ? 0.3 : 0.15);
  if (w.rate < 2) mouseDown = false;
  const o = camera.position.clone(), base = camDir();
  const muzzle = new THREE.Vector3(); heroGun.getWorldPosition(muzzle); if (fp) muzzle.copy(o).addScaledVector(base, 0.5).add(new THREE.Vector3(0, -0.2, 0));
  const spread = w.spread * (aiming ? 0.4 : 1);
  let end = null;
  for (let k = 0; k < w.pellets; k++) {
    const d = base.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(spread)).normalize();
    end = fireRay(o, d, w.dmg, muzzle);
  }
  if (end && NET.others.size && performance.now() - NET.shotT > 300) { NET.shotT = performance.now(); send({ t: "shot", p: [muzzle.x - TR.x, muzzle.y, muzzle.z], x: [end.x - TR.x, end.y, end.z], w: 0, h: 0 }); }
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
  return end;
}
function gatling() {
  const d = camDir(), bar = gatlingG.userData.barrel;
  gatlingG.rotation.y = Math.atan2(-d.z, d.x); bar.rotation.z = Math.asin(clamp(d.y, -0.6, 0.6));
  if (mouseDown && gatHeat < 1 && fireCD <= 0) {
    fireCD = 0.075; gatHeat += 0.022; SFX.gatling(); bar.rotation.x += 1;
    const o = camera.position.clone(), m = trainPt(GAT).add(new THREE.Vector3(0, 1.2, 0));
    fireRay(o, d.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.02)).normalize(), 20, m);
  }
  if (gatHeat >= 1) { gatHeat = 1.5; toast("The gatling gun OVERHEATED! Wait for it to cool."); }
}
function hurtPlayer(n, vamp) {
  if (RUN.over || P.dead || mode !== "run") return;
  if (vamp && save.cls === "preacher") n *= 0.5;
  if (P.armor > 0) { const a = Math.min(P.armor, n * 0.6); P.armor -= a; n -= a; }
  P.hp -= n; SFX.hurt(); $("hurt").style.opacity = 0.9; shake = Math.max(shake, 0.3);
  if (P.hp <= 0) die();
}
function die() {
  P.hp = 0; if (held) dropHeld(); P.dead = true; mounted = false;
  const team = NET.others.size > 0 && NET.run?.conn?.open;
  if (!team) { gameOver(false); return; }
  ev("D"); banner("YOU WENT DOWN", "Watch your crew. If anyone reaches Sundown, you all win!"); SFX.over();
  checkAllDead();
}

// ---------------------------------------------------------------- panels (shops, lobby, backpack)
let panelOpen = false, panelKind = "";
function openPanel(kind, title, sub, rows, top) {
  panelOpen = true; panelKind = kind; document.exitPointerLock?.(); mouseDown = false;
  $("shopTitle").textContent = title; $("shopSub").textContent = sub;
  $("shopMoney").textContent = top;
  const grid = $("shopGrid"); grid.innerHTML = "";
  for (const r of rows) {
    const b = document.createElement("button"); b.className = "shopItem" + (r.on ? " on" : "") + (r.off ? " off" : "");
    b.innerHTML = `<b>${r.name}</b><small>${r.desc || ""}</small><em>${r.tag || ""}</em>`;
    b.onclick = () => { audio(); r.click(); };
    grid.appendChild(b);
  }
  $("shop").classList.remove("hidden");
}
function closePanel(silent) { if (!panelOpen) return; panelOpen = false; panelKind = ""; $("shop").classList.add("hidden"); if (!silent) lock(); }
$("shopClose").onclick = () => closePanel();
function buyStars(cost, ok) { if (save.stars < cost) { SFX.nope(); toast(`You need ${cost} ⭐ (you have ${save.stars}). Earn stars by riding the train!`); return false; } save.stars -= cost; store(); SFX.buy(); ok(); return true; }
function openShop(it) {
  const guns = it.kind === "guns";
  const rows = guns ? [
    ...["revolver", "shotgun", "rifle"].map((w) => ({ name: WEAPONS[w].icon + " " + WEAPONS[w].name, desc: w === "revolver" ? "6 shots, fast" : w === "shotgun" ? "8 pellets, huge up close" : "Long range, right-click to aim", price: WEAPONS[w].price, fn: () => giveGun(w) })),
    { name: "🛡️ Armor vest", desc: "Soaks up 60% of hits (50 armor)", price: 90, fn: () => { P.armor = Math.min(100, P.armor + 50); } },
    { name: "⚙️ Gatling gun for the train", desc: "Bolted to the cargo car, for everyone. E to man it", price: 450, fn: () => { if (INV.gatling) return false; INV.gatling = true; gatlingG.visible = true; ev("G"); } },
    ...Object.entries(AMMO).map(([k, a]) => ({ name: `${a.name} x${a.n}`, price: a.price, fn: () => { INV.ammo[k] += a.n; } })),
  ] : [
    { name: "⚫ Coal", desc: "Throw it in the furnace: +22 fuel", price: 10, fn: () => spawnNear("coal") },
    { name: "🩹 Bandage", desc: "Heals you (H)", price: 20, fn: () => { INV.bandage++; } },
    { name: "💧 Holy water", desc: "Throw at vampires (G)", price: 35, fn: () => { INV.holy++; } },
    { name: "🧨 Dynamite", desc: "Blows open bank vaults. Or throw it! (Q)", price: 45, fn: () => spawnNear("dynamite") },
    ...Object.entries(AMMO).map(([k, a]) => ({ name: `${a.name} x${a.n}`, price: a.price, fn: () => { INV.ammo[k] += a.n; } })),
  ];
  const show = () => openPanel("shop", it.name, guns ? "Guns, armor and ammo. Carrying valuables? Hold one and press E at the counter to sell it." : "Supplies for the long ride. Carrying gold, silver or jewelry? Hold it and press E at the counter (or sell from your backpack: B).", rows.map((r) => ({ ...r, tag: "$" + r.price, click: () => { if (RUN.money < r.price) { SFX.nope(); return toast("Not enough money!"); } if (r.fn() === false) { SFX.nope(); return toast("You already have that."); } RUN.money -= r.price; SFX.buy(); bumpMoney(); show(); } })), "You have $" + RUN.money);
  show();
}
function giveGun(w, found) {
  if (INV.weapons.includes(w)) { if (found) { INV.ammo[WEAPONS[w].ammo] += AMMO[WEAPONS[w].ammo].n; toast(`+${AMMO[WEAPONS[w].ammo].n} ${AMMO[WEAPONS[w].ammo].name}`); return; } return false; }
  INV.weapons.push(w); INV.mag[w] = WEAPONS[w].mag; INV.ammo[WEAPONS[w].ammo] += AMMO[WEAPONS[w].ammo].n;
  INV.cur = INV.weapons.length - 1; setGunModel(); toast(`${WEAPONS[w].name}! It's slot ${INV.weapons.length} (keys 1-${INV.weapons.length})`);
}
function spawnNear(type) { const it = addItem(type, P.x + Math.sin(P.yaw) * 1.2, P.y + 0.6, P.z + Math.cos(P.yaw) * 1.2); shareNew(it); }
function openPack() {
  if (mode === "lobby") { openPanel("pack", "YOUR BACKPACK", "Your backpack is empty in the lobby. On a ride, press T to stash what you're holding, and B to open it.", [], `⭐ ${save.stars} stars`); return; }
  const shop = near.inter && (near.inter.kind === "store" || near.inter.kind === "guns");
  const rows = [];
  if (held && held.type !== "corpse") rows.push({ name: "⬇️ Put it in", desc: `The ${ITEMS[held.type].name} you're holding (or press T)`, tag: "", click: () => stow() });
  INV.pack.forEach((s, i) => {
    const d = ITEMS[s.type];
    rows.push({ name: `${d.icon || "📦"} ${d.name}`, desc: shop && d.value ? "Click to sell it here" : d.fuel ? "Click to take it out (feed the furnace!)" : "Click to take it out", tag: shop && d.value ? "Sell $" + d.value : "Take out", click: () => { if (shop && d.value) { INV.pack.splice(i, 1); pay(d.value, `Sold ${d.name} +$${d.value}`); openPack(); } else takeOut(i); } });
  });
  for (let i = INV.pack.length; i < PACK; i++) rows.push({ name: "· empty ·", desc: "Hold something and press T", tag: "", off: true, click: () => {} });
  const guns = INV.weapons.map((w) => WEAPONS[w].icon + " " + WEAPONS[w].name).join(", ");
  openPanel("pack", "YOUR BACKPACK", `${INV.pack.length} / ${PACK} slots. Guns: ${guns}. Ammo: ${INV.ammo.pistol} revolver · ${INV.ammo.shells} shells · ${INV.ammo.rifle} rifle. 🩹 ${INV.bandage} bandages · 💧 ${INV.holy} holy water.`, rows, "$" + RUN.money + (shop ? " · you're at a store: valuables sell here" : ""));
}
// lobby shops (stars)
function openOutfitter() {
  const lk = save.look, own = (k) => save.owned.includes(k);
  const rows = [];
  const item = (key, name, desc, cost, wearing, wear) => rows.push({ name, desc, on: wearing, tag: wearing ? "Wearing" : own(key) ? "Wear" : "⭐ " + cost, click: () => { if (!own(key) && !buyStars(cost, () => save.owned.push(key))) return; wear(); store(); buildHero(); NET.lobby?.conn?.send({ t: "look", k: lookCode() }); openOutfitter(); } });
  HATS.forEach((h, i) => item("h" + i, "🎩 " + h.n, "Hat", h.c, lk.hat === i, () => { lk.hat = i; }));
  SHIRTS.forEach(([c, n], i) => item("s" + c, `<i class="sw" style="background:#${c}"></i> ${n} shirt`, "Shirt", i === 0 ? 0 : 1, lk.shirt === c, () => { lk.shirt = c; }));
  HATCS.forEach(([c, n], i) => item("c" + c, `<i class="sw" style="background:#${c}"></i> ${n} hat color`, "Hat color", i === 0 ? 0 : 1, lk.hatC === c, () => { lk.hatC = c; }));
  item("b0", "No bandana", "Bandana", 0, !lk.band, () => { lk.band = ""; });
  BANDS.forEach(([c, n]) => item("b" + c, `<i class="sw" style="background:#${c}"></i> ${n} bandana`, "Outlaw bandana", 2, lk.band === c, () => { lk.band = c; }));
  openPanel("outfit", "THE OUTFITTER", "Hats, shirts and bandanas. Your crew sees what you wear!", rows, `⭐ ${save.stars} stars`);
}
function openClasses() {
  openPanel("classes", "THE CLASS OFFICE", "Buy a class with stars, then EQUIP it. You ride as your equipped class.", CLASSES.map((c) => {
    const got = save.got.includes(c.id), on = save.cls === c.id;
    return { name: `${c.icon} ${c.name}`, desc: c.desc, on, tag: on ? "Equipped" : got ? "Equip" : "⭐ " + c.cost, click: () => { if (!got && !buyStars(c.cost, () => save.got.push(c.id))) return; save.cls = c.id; store(); SFX.click(); toast(`${c.name} equipped!`); openClasses(); } };
  }), `⭐ ${save.stars} stars`);
}
function openLobbyGuns() {
  openPanel("lguns", "THE GUNSMITH", "You start each ride with NO gun. Buy one here with stars and equip it to bring it along (with a box of ammo). Or buy guns with cash in Fort Hope.", [
    { name: "🚫 No starting gun", desc: "Just your shovel", on: !save.gun, tag: !save.gun ? "Equipped" : "Equip", click: () => { save.gun = ""; store(); openLobbyGuns(); } },
    ...LOBBY_GUNS.map((g) => { const got = save.guns.includes(g.id), on = save.gun === g.id; return { name: WEAPONS[g.id].icon + " " + WEAPONS[g.id].name, desc: "Starting gun", on, tag: on ? "Equipped" : got ? "Equip" : "⭐ " + g.cost, click: () => { if (!got && !buyStars(g.cost, () => save.guns.push(g.id))) return; save.gun = g.id; store(); SFX.click(); openLobbyGuns(); } }; }),
  ], `⭐ ${save.stars} stars`);
}

// ---------------------------------------------------------------- what's in each place (the same loot for everyone in a run)
let seedR = 1;
const sr = () => ((seedR = (Math.imul(seedR, 1664525) + 1013904223) >>> 0) / 4294967296);
function onBuilt(p) {
  if (mode !== "run" || p.spawned) return; p.spawned = true;
  const P2 = p.P, pi = world.places.indexOf(p); let k = 0;
  seedR = (RUN.seed ^ Math.imul(pi + 1, 2654435761)) >>> 0 || 1;
  const loot = p.type === "keep" ? ["gold", "silver", "jewels", "painting", "holy", "holy"] : p.type === "fort" ? ["ammo", "ammo", "ammo", "bandage", "lumber", "cash", "silver"] :
    p.type === "mine" ? ["coal", "coal", "coal", "silver", "gold", "lumber"] : ["coal", "lumber", "chair", "cash", "cash", "ammo", "bandage", "watch", "jewels", "painting", "silver", "holy", "dynamite", "gold"];
  const put = (t, x, y, z) => { const id = (pi + 1) * 1000 + ++k; if (!goneIds.has(id)) addItem(t, x, y, z, { id }); };
  for (const s of P2.spots) {
    const r = sr(), r2 = sr(), r3 = sr();
    if (r < (p.type === "town" ? 0.6 : 0.75)) {
      let t = s.coal ? "coal" : loot[Math.floor(r2 * loot.length)];
      if (t === "gold" && r3 < 0.6) t = "silver";
      put(t, s.x, s.y + 0.3, s.z);
    }
  }
  if (p.type === "fort") { put("gun_rifle", P2.armory.x, 0.5, P2.armory.z); put("gun_shotgun", P2.armory.x + 1.5, 0.5, P2.armory.z); put("ammo", P2.armory.x - 1.5, 0.5, P2.armory.z); }
  if (p.type === "keep") { p.chestAt = P2.chest; const c = new THREE.Group(); box(c, 1.6, 0.9, 1, 0, 0.45, 0, L(0x5a2a14)); box(c, 1.7, 0.2, 1.1, 0, 0.95, 0, L(0xc8a03a)); c.position.set(P2.chest.x, 0, P2.chest.z); P2.g.add(c); }
  if (p.type === "bridge") { p.leaves = P2.leaves; p.leverM = P2.lever; }
  if (!isHost()) return;
  if (p.type === "keep") spawnFoe("lord", P2.boss.x, P2.boss.z - Math.sign(P2.boss.z) * 2).home = true;
  for (const f of P2.foes) { if (Math.random() < 0.7) spawnFoe(f.kind || (Math.random() < 0.25 ? "runner" : "walker"), f.x, f.z).noBurn = p.type === "keep"; }
}
function startBridge() {
  if (BR.on) return; BR.on = true;
  banner("THE BRIDGE IS COMING DOWN!", "Something huge climbs out of the canyon... Hold it off until the bridge is down!"); SFX.night(true);
  if (isHost()) {
    const b = spawnFoe("colossus", CHASM[0] - 30, 22); b.aggro = true;
    for (let i = 0; i < 6; i++) spawnFoe(i % 2 ? "runner" : "walker", CHASM[0] - rand(10, 50), rand(-25, 25)).aggro = true;
  }
}

// ---------------------------------------------------------------- day + night
const DAY = 360;
let dayT = 0.05;
const isNight = () => dayT > 0.62 && dayT < 0.97;
const bloodMoon = () => isNight() && RUN.nights % 3 === 0;
let spawnT = 0;
const skyDay = new THREE.Color(0x9ad0f0), skyDusk = new THREE.Color(0xe08a5a), skyNight = new THREE.Color(0x0a0e1e), skyBlood = new THREE.Color(0x3a0606);
const fogDay = new THREE.Color(0xe8d0a8), fogNight = new THREE.Color(0x0e1020), fogBlood = new THREE.Color(0x2a0606);
function updateSky(dt) {
  if (mode === "run") dayT = (dayT + dt / DAY) % 1;
  const night = mode === "run" && isNight();
  if (mode === "run") {
    if (night && !RUN.lastNight && isHost()) RUN.nights++;
    if (night && !RUN.lastNight) { const b = isHost() ? RUN.nights % 3 === 0 : (RUN.nights + 1) % 3 === 0; banner(b ? "BLOOD MOON" : "NIGHTFALL", b ? "The vampires are coming. Stay together. Keep the train moving." : "The dead are restless. Keep your gun ready."); SFX.night(b); }
    if (!night && RUN.lastNight) { banner("DAWN", "You lived through the night!"); SFX.bell(); }
    RUN.lastNight = night;
  }
  const a = (dayT - 0.05) / 0.6 * Math.PI;
  const k = mode !== "run" ? 0 : night ? 1 : dayT >= 0.97 ? 1 - (dayT - 0.97) / 0.03 * 0.5 : dayT < 0.03 ? 0.5 - dayT / 0.03 * 0.5 : dayT > 0.55 ? clamp((dayT - 0.55) / 0.07, 0, 1) : 0;
  const blood = mode === "run" && bloodMoon();
  const sky = skyDay.clone().lerp(skyDusk, clamp(k * 2, 0, 1)).lerp(blood ? skyBlood : skyNight, clamp(k * 2 - 1, 0, 1));
  scene.background = sky; scene.fog.color.copy(fogDay.clone().lerp(blood ? fogBlood : fogNight, k)); scene.fog.far = lerp(420, blood ? 150 : 190, k);
  sun.intensity = lerp(1.7, blood ? 0.35 : 0.25, k); sun.color.set(blood && k > 0.5 ? 0xff5040 : k > 0.5 ? 0x8090c0 : 0xfff0d0);
  hemi.intensity = lerp(0.95, 0.3, k); hemi.color.set(blood && k > 0.5 ? 0xff6050 : k > 0.5 ? 0x6070a0 : 0xfff0d8);
  const sy = Math.sin(a) * 300;
  sunBall.position.set(P.x + Math.cos(a) * 400, sy, P.z + 200); sunBall.visible = sy > -10;
  moon.position.set(P.x - 150, 220, P.z + 380); moon.visible = k > 0.3; moon.material.color.set(blood ? 0xff2a1a : 0xf0f0ff); moon.scale.setScalar(blood ? 1.6 : 1);
  stars.position.set(P.x, 0, P.z); stars.material.opacity = k;
  sun.position.set(P.x + (k > 0.5 ? -60 : Math.cos(a) * 80), k > 0.5 ? 120 : Math.max(20, sy * 0.5), P.z + 60); sun.target.position.set(P.x, 0, P.z);
  headLight.intensity = k > 0.3 ? 60 : 0;
  MAT.glass.color.set(k > 0.4 ? 0xffb050 : 0x1a1a22);
  if (mode === "run") music(blood ? 2 : night ? 1 : 0);
  return k;
}
function targets() { const t = []; if (!P.dead) t.push({ id: myNet, x: P.x, y: P.y, z: P.z, me: true }); for (const o of NET.others.values()) if (!o.dead && o.y > -50) t.push({ id: o.id, x: o.x, y: o.y, z: o.z }); return t; }
function nightSpawns(dt, T) {
  if (!isNight() || !T.length) return;
  const blood = bloodMoon(), cap = (blood ? 26 : 12 + Math.min(8, Math.floor(TR.x / 1500))) + (T.length - 1) * 4;
  spawnT -= dt; if (spawnT > 0 || foes.length >= cap) return;
  spawnT = (blood ? rand(0.8, 1.6) : rand(1.6, 3.2)) / Math.sqrt(T.length);
  const t = T[Math.floor(Math.random() * T.length)], ang = rand(0, Math.PI * 2), dist = rand(45, 80);
  const x = t.x + Math.max(-30, Math.cos(ang) * dist) + TR.v * 3, z = t.z + Math.sin(ang) * dist;
  if (x > CHASM[0] - 5 && x < CHASM[1] + 5) return;
  let kind = Math.random() < 0.35 ? "runner" : "walker";
  if (TR.x > 4000 && Math.random() < 0.12) kind = "vamp";
  if (TR.x > 2500 && Math.random() < 0.08) kind = "brute";
  if (blood) kind = Math.random() < 0.45 ? "vamp" : Math.random() < 0.5 ? "bat" : "runner";
  spawnFoe(kind, x, z).aggro = true;
}

// ---------------------------------------------------------------- starting a run
function startRun(start, seed, code, leader) {
  closePanel(true); leaveLobby(); clearRunStuff();
  mode = "run"; launching = false; RUN.seed = seed >>> 0 || 1; RUN.leader = !code || leader;
  document.body.classList.remove("inLobby"); train.visible = true;
  const cls = save.cls, mid = start === "m" && save.mid;
  Object.assign(TR, { x: mid ? MID_X + 30 : 30, v: 0, throttle: 0, fuel: cls === "miner" ? 100 : mid ? 70 : 60 });
  Object.assign(P, { x: TR.x - 4 + rand(-2, 2), y: DECK, z: rand(-0.6, 0.6), vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, pitch: -0.1, hp: 100, armor: 0, dead: false });
  Object.assign(RUN, { money: cls === "drifter" ? 90 : 60, kills: 0, bounty: 0, time: 0, baron: false, colossus: false, over: false, won: false, nights: 0, lastNight: false, start, midSaved: !!mid });
  Object.assign(INV, { weapons: [cls === "miner" ? "pickaxe" : "shovel"], cur: 0, ammo: { pistol: 0, shells: 0, rifle: 0 }, mag: {}, bandage: cls === "doctor" ? 5 : 1, holy: cls === "preacher" ? 4 : 0, gatling: false, pack: [] });
  if (cls === "gunslinger") { INV.weapons.push("shotgun"); INV.ammo.shells = 16; INV.mag.shotgun = 4; }
  if (save.gun && !INV.weapons.includes(save.gun)) { const w = WEAPONS[save.gun]; INV.weapons.push(save.gun); INV.mag[save.gun] = w.mag; INV.ammo[w.ammo] += AMMO[w.ammo].n; }
  dayT = 0.05;
  if (mid) { const m = save.mid; RUN.money = m.money; INV.weapons = [...new Set([...INV.weapons, ...m.weapons])]; Object.assign(INV.ammo, m.ammo); Object.assign(INV.mag, m.mag); INV.bandage = m.bandage; INV.holy = m.holy; INV.pack = [...m.pack]; P.armor = m.armor || 0; RUN.nights = m.nights || 1; }
  INV.cur = INV.weapons.length - 1;
  held = null; mounted = false; gatlingG.visible = false; itemCounter = 0;
  syncTrainCols(); buildHero(); world.update(TR.x, onBuilt); updateSky(0);
  paused = false;
  $("hud").classList.remove("hidden");
  banner(mid ? "BACK AT THE HALFWAY POST" : "FORT HOPE", mid ? "6 km down, 6 to go. Pull the train's lever (E) when you're ready." : "No gun yet? Buy one at the Gunsmith. Then pull the train's lever (E) to roll out!");
  SFX.whistle(); lock();
  if (code) NET.run = joinRun(code, leader, (m, conn) => onNet(m, conn, "run"), () => { if (mode === "run" && !RUN.over) toast("Lost the connection to your crew: riding solo now."); NET.run = null; RUN.leader = true; for (const f of foes) f.remote = false; clearOthers(); });
}
function midCheckpoint() {
  if (RUN.midSaved || TR.x < MID_X + 40) return;
  RUN.midSaved = true;
  save.mid = { money: RUN.money, weapons: [...INV.weapons], ammo: { ...INV.ammo }, mag: { ...INV.mag }, bandage: INV.bandage, holy: INV.holy, pack: [...INV.pack], armor: P.armor, nights: RUN.nights };
  store(); banner("CHECKPOINT SAVED!", "You reached the Halfway Post. The MIDWAY train is open in the lobby now.");
}

// ---------------------------------------------------------------- the main loop
let last = performance.now();
const tmpV = new THREE.Vector3();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === "title" || paused) { renderer.render(scene, camera); return; }
  step(dt);
  renderer.render(scene, camera);
}
function step(dt) {
  if (mode === "lobby") return lobbyFrame(dt);
  if (mode !== "run") return;
  RUN.time += dt;
  const host = isHost();
  const k = updateSky(dt);
  // ---- the train (the host drives it; everyone else follows the host's numbers between updates)
  const prevX = TR.x;
  const T = targets();
  if (host) {
    const far = T.length && T.every((t) => Math.abs(t.x - TR.x) > 150);
    let target = TR.fuel > 0 && !far ? SPEEDS[TR.throttle] * (save.cls === "conductor" ? 1.15 : 1) : 0;
    const stopAt = BR.p < 1 ? CHASM[0] - 6 : LEN + 57;
    if (TR.x + 10.6 > stopAt - 25) target = Math.min(target, Math.max(0, (stopAt - TR.x - 10.6) * 0.4));
    TR.v += clamp(target - TR.v, -(target === 0 ? 2.6 : 1.4) * dt, 1.0 * dt);
    if (TR.x + 10.6 >= stopAt) { TR.v = 0; TR.x = Math.min(TR.x, stopAt - 10.6); }
    if (TR.v > 0.1 && TR.throttle) TR.fuel = Math.max(0, TR.fuel - [0, 0.12, 0.22, 0.36][TR.throttle] * dt * (save.cls === "conductor" ? 0.65 : 1));
  }
  if (TR.fuel <= 0 && TR.throttle && !RUN.noFuelMsg) { RUN.noFuelMsg = true; toast("OUT OF FUEL! Throw coal, lumber or chairs into the furnace."); }
  if (TR.fuel > 0) RUN.noFuelMsg = false;
  TR.x += TR.v * dt; const tdx = TR.x - prevX;
  train.position.x = TR.x; syncTrainCols();
  lever.rotation.z = -0.5 + TR.throttle * 0.33;
  furnaceGlow.material.color.setHSL(0.07, 1, clamp(0.25 + TR.fuel / 250 + flare * 0.3, 0, 0.7)); flare = Math.max(0, flare - dt);
  for (const w of wheels) w.rotation.y -= TR.v * dt / 0.6;
  if (TR.v > 0.5 && Math.random() < dt * (3 + TR.v)) { SFX.chuff(TR.v); const s = new THREE.Mesh(smokeGeo, smokeMat); s.position.set(TR.x + 9, DECK + 4, rand(-0.2, 0.2)); scene.add(s); smokePuffs.push({ m: s, t: 2.5 }); }
  for (const s of [...smokePuffs]) { s.t -= dt; s.m.position.y += dt * 2; s.m.position.x -= TR.v * dt * 0.6; s.m.scale.setScalar(1 + (2.5 - s.t) * 0.7); if (s.t <= 0) { scene.remove(s.m); smokePuffs.splice(smokePuffs.indexOf(s), 1); } }
  world.update(P.dead ? TR.x : clamp(P.x, TR.x - 200, TR.x + 200), onBuilt);
  midCheckpoint();
  // ---- the drawbridge
  if (host && BR.on && BR.p < 1) { const boss = foes.some((f) => f.kind === "colossus"); BR.p = Math.min(boss ? 0.85 : 1, BR.p + dt / 75); }
  const bp = world.places.find((p) => p.type === "bridge" && p.built);
  if (bp && bp.leaves) { for (const l of bp.leaves) l.rotation.z = l.userData.dir * 1.45 * (1 - BR.p); if (bp.leverM) bp.leverM.rotation.z = BR.on ? -0.6 : 0.6; }
  if (BR.p >= 1 && !bridgeCol) { bridgeCol = { x0: CHASM[0] - 0.5, x1: CHASM[1] + 0.5, y0: -2, y1: 0.4, z0: -3.5, z1: 3.5 }; banner("THE BRIDGE IS DOWN!", "Cross it! Sundown Station is just ahead."); SFX.bell(); }
  // ---- me
  if (P.onTrain) P.x += tdx;
  if (!P.dead) {
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sp = (keys.ShiftLeft || keys.ShiftRight ? 8.5 : 5.2) * (held && held.type === "corpse" ? 0.75 : 1) * (mounted || panelOpen ? 0 : 1);
    const sx = Math.sin(P.yaw), cz = Math.cos(P.yaw);
    const mx = fwd * sx - side * cz, mz = fwd * cz + side * sx, ml = Math.hypot(mx, mz) || 1;
    const want = fwd || side ? sp : 0;
    P.vx = lerp(P.vx, (mx / ml) * want, P.ground ? 0.25 : 0.05); P.vz = lerp(P.vz, (mz / ml) * want, P.ground ? 0.25 : 0.05);
    if (keys.Space && P.ground && !mounted && !panelOpen) { P.vy = 8; P.ground = false; }
  } else { P.vx *= 0.9; P.vz *= 0.9; }
  physics(P, dt);
  if (P.y < -20) { P.x = TR.x; P.y = DECK + 1; P.z = 0; P.vy = 0; toast("You fell into the canyon! Your crew hauled you back to the train."); hurtPlayer(25); }
  if (mounted) { const g = trainPt(GAT); P.x = g.x - 0.9; P.z = g.z; P.y = DECK; }
  if (held) { const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw); held.x = P.x + fx2 * 0.7; held.z = P.z + fz2 * 0.7; held.y = P.y + (held.type === "corpse" ? 1.3 : 0.9); held.mesh.position.set(held.x, held.y, held.z); held.mesh.rotation.y = P.yaw + (held.type === "corpse" ? Math.PI / 2 : 0); }
  // ---- items (thrown into the furnace: the thrower's game feeds it)
  const fu = trainPt(FURNACE);
  for (const it of [...items]) {
    if (it === held || it.heldBy) continue;
    if (it.onTrain) it.x += tdx;
    if (it.flying || !it.ground) {
      physics(it, dt); it.vx *= it.ground ? 0.6 : 0.995; it.vz *= it.ground ? 0.6 : 0.995; if (it.ground) it.flying = false;
      if (it.mine && ITEMS[it.type].fuel && Math.hypot(it.x - fu.x, it.y - fu.y, it.z - fu.z) < 1.1) { burn(it); continue; }
    } else if (Math.abs(it.x - TR.x) < 30) physics(it, dt);
    it.mesh.position.set(it.x, it.y, it.z);
    if (it.type === "cash" || it.type.startsWith("gun_") || ITEMS[it.type].shiny) it.mesh.rotation.y += dt;
    if (it.lit !== undefined) { it.lit -= dt; if (Math.random() < 0.5) puff(it.x, it.y + 0.3, it.z, 0xffd040, 1); if (it.lit <= 0) { const mine = it.mine; removeItem(it); boom(it.x, it.y, it.z, false); if (mine && !isHost()) ev(`o,${f1(it.x)},${f1(it.y)},${f1(it.z)}`); } }
    if (it.x < TR.x - 320 && Math.abs(it.x - P.x) > 200) removeItem(it);
  }
  for (const d of [...dyn]) { d.t -= dt; d.m.rotation.y += dt * 8; if (Math.random() < 0.5) puff(d.x, d.y + 0.3, d.z, 0xffd040, 1); if (d.t <= 0) { scene.remove(d.m); dyn.splice(dyn.indexOf(d), 1); boom(d.x, d.y, d.z); if (d.vault && !d.vault.open) { d.vault.open = true; ev(`v,${f1(d.vault.x)}`); for (let i = 0; i < 3; i++) shareNew(addItem("gold", d.x + rand(-1, 1), d.y + 1, d.z + rand(-1, 1))); for (let i = 0; i < 2; i++) shareNew(addItem("cash", d.x + rand(-1, 1), d.y + 1, d.z + rand(-1, 1), { amount: 60 })); toast("The vault blew open! Gold bars everywhere!"); } } }
  for (const h of [...holyShots]) {
    h.vy -= 20 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.m.position.set(h.x, h.y, h.z); h.t -= dt;
    const hitF = foes.find((f) => Math.hypot(f.x - h.x, f.z - h.z) < 1 + f.r && h.y > f.y && h.y < f.y + f.h);
    if (hitF || h.y < groundH(h.x, h.z) || h.t <= 0) { scene.remove(h.m); holyShots.splice(holyShots.indexOf(h), 1); holySplash(h.x, h.y, h.z); }
  }
  // ---- the undead
  if (host) nightSpawns(dt, T);
  const now = performance.now();
  for (const f of [...foes]) {
    if (f.onTrain && !f.remote) f.x += tdx;
    f.hit -= dt; f.atk = Math.max(0, f.atk - dt * 3);
    if (f.remote) {
      // (someone else's game runs this one: just glide to where the host says it is)
      if (now - (f.seen || 0) > 1500) { dropFoe(f); scene.remove(f.model.root); continue; }
      const tx = TR.x + f.trx, kk = Math.min(1, dt * 10), px = f.x, pz = f.z;
      if (Math.abs(f.x - tx) > 12) f.x = tx;
      f.x = lerp(f.x, tx, kk); f.y = lerp(f.y, f.ty, kk); f.z = lerp(f.z, f.tz, kk); f.yaw = f.tyaw;
      if (f.d.fly) { f.model.t += dt * 18; f.model.wl.rotation.z = Math.sin(f.model.t) * 0.8; f.model.wr.rotation.z = -Math.sin(f.model.t) * 0.8; }
      else animHuman(f.model, Math.hypot(f.x - px, f.z - pz) / Math.max(dt, 0.001) * 0.5, dt, f.atk);
      f.model.root.position.set(f.x, f.y, f.z); f.model.root.rotation.y = f.yaw;
      f.model.root.scale.setScalar((f.d.scale || 1) * (f.hit > 0 ? 1.06 : 1));
      continue;
    }
    let tg = null, d = 1e9;
    for (const t of T) { const dd = Math.hypot(t.x - f.x, t.z - f.z); if (dd < d) { d = dd; tg = t; } }
    const dx = tg ? tg.x - f.x : 0, dz = tg ? tg.z - f.z : 0, dy = tg ? tg.y - f.y : 0;
    if (tg && d < (isNight() ? 70 : 32)) f.aggro = true;
    if (f.home && d > 40) f.aggro = false;
    f.cd -= dt;
    let tx = 0, tz = 0; const spd = f.d.speed;
    if (f.aggro && tg && !RUN.over) { tx = dx / (d || 1); tz = dz / (d || 1); }
    else { f.wander = (f.wander || 0) - dt; if (f.wander <= 0) { f.wander = rand(2, 5); f.wx = rand(-1, 1); f.wz = rand(-1, 1); } tx = f.wx * 0.3; tz = f.wz * 0.3; }
    const hitT = (dmg, vamp) => { if (tg.me) hurtPlayer(dmg, vamp); else ev(`d,${tg.id},${Math.round(dmg)},${vamp ? 1 : 0}`); };
    if (f.d.fly) {
      const ty = (tg ? tg.y : f.y) + 1.2 + (d > 3 ? 2 : 0);
      f.vx = lerp(f.vx, tx * spd + (TR.v > 1 && d < 30 ? TR.v : 0), 0.05); f.vz = lerp(f.vz, tz * spd, 0.05); f.vy = lerp(f.vy, (ty - f.y) * 2, 0.05);
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.model.t += dt * 18; f.model.wl.rotation.z = Math.sin(f.model.t) * 0.8; f.model.wr.rotation.z = -Math.sin(f.model.t) * 0.8;
      if (tg && Math.hypot(dx, dz, tg.y + 1.2 - f.y) < 1.2 && f.cd <= 0) { f.cd = 1; hitT(f.d.dmg, true); SFX.groan("bat"); }
    } else {
      const chase = f.aggro && tg && d < 30 && TR.v > 1 ? TR.v * 0.85 : 0;
      f.vx = lerp(f.vx, tx * spd + (chase && f.d.speed > 5 ? chase : 0), 0.15); f.vz = lerp(f.vz, tz * spd, 0.15);
      if (f.d.vamp && f.aggro && f.ground && d < 9 && d > 2.5 && f.leap <= 0) { f.vy = 8; f.vx = tx * 13 + (TR.v > 1 ? TR.v : 0); f.vz = tz * 13; f.leap = 2.5; SFX.groan("vamp"); }
      f.leap -= dt;
      if (f.aggro && f.ground && (f.blocked || dy > 0.9) && d < 12 && f.kind !== "colossus") f.vy = 9.5;
      physics(f, dt);
      if (tg && d < 1.3 + f.r && Math.abs(dy) < 1.6 + f.h * 0.2 && f.cd <= 0 && !RUN.over) { f.cd = f.d.boss ? 1.1 : 1.0; f.atk = 1; hitT(f.d.dmg, f.d.vamp); }
      if (f.kind === "colossus" && f.aggro && f.cd <= 0 && f.ground && d < 14 && Math.random() < dt * 0.8) {
        f.cd = 2.5; f.atk = 1; const sx = f.x + tx * 4, sz = f.z + tz * 4; boomFx(sx, f.y + 0.3, sz);
        for (const t of T) if (Math.hypot(t.x - sx, t.z - sz) < 6) { if (t.me) hurtPlayer(25); else ev(`d,${t.id},25,0`); }
        ev(`o,${f1(sx)},${f1(f.y + 0.3)},${f1(sz)}`);
      }
      if (Math.random() < dt * 0.15 && d < 30) SFX.groan(f.kind === "lord" || f.kind === "colossus" ? "lord" : f.d.vamp ? "vamp" : f.kind);
      animHuman(f.model, Math.hypot(f.vx, f.vz), dt, f.atk);
      if (f.d.vamp && !f.d.boss && !f.noBurn && k < 0.3 && !world.indoors(f.x, f.z)) { f.hp -= 40 * dt; if (Math.random() < 0.3) puff(f.x, f.y + 1.5, f.z, 0x444444, 1); if (f.hp <= 0) { killFoe(f, true); continue; } }
      if (f.kind === "lord" && f.aggro && Math.random() < dt * 0.25 && foes.length < 40) { for (let i = 0; i < 3; i++) spawnFoe("bat", f.x, f.z, f.y + 3).aggro = true; SFX.groan("lord"); }
    }
    if (f.aggro || d < 60) f.yaw = Math.atan2(f.vx, f.vz);
    f.model.root.position.set(f.x, f.y, f.z); f.model.root.rotation.y = f.yaw;
    f.model.root.scale.setScalar((f.d.scale || 1) * (f.hit > 0 ? 1.06 : 1));
    if ((f.x < TR.x - 260 && T.every((t) => Math.abs(f.x - t.x) > 150)) || f.y < -30) { scene.remove(f.model.root); dropFoe(f); }
  }
  // ---- my weapon, healing
  fireCD -= dt; meleeT = Math.max(0, meleeT - dt);
  if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { const id = INV.weapons[INV.cur], w = WEAPONS[id]; if (w && !w.melee) { const n = Math.min(w.mag - (INV.mag[id] ?? 0), INV.ammo[w.ammo]); INV.mag[id] = (INV.mag[id] ?? 0) + n; INV.ammo[w.ammo] -= n; } } }
  if (healT > 0) { healT -= dt; P.hp = Math.min(100, P.hp + dt * (save.cls === "doctor" ? 40 : 20)); }
  gatHeat = Math.max(0, gatHeat - dt * 0.3); if (gatHeat > 1 && gatHeat < 1.02) gatHeat = 0.99;
  if (!P.dead && !panelOpen) { if (mounted) gatling(); else shoot(); }
  flushHits();
  if (panelOpen && panelKind === "shop" && near.inter && Math.hypot(P.x - near.inter.x, P.z - near.inter.z) > 4) closePanel();
  scanNear();
  // ---- winning: anyone alive reaches Sundown
  if (host && !RUN.won && !RUN.over && T.some((t) => t.x > LEN - 15 && t.x < LEN + 60 && Math.abs(t.z) < 30)) { ev("W"); flushEvents(); win(); }
  updateOthers(dt);
  sendState(dt);
  heroAndCamera(dt);
  effects(dt);
  hud(dt);
}
function lobbyFrame(dt) {
  updateSky(dt);
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 8.5 : 5.2) * (panelOpen ? 0 : 1);
  const sx = Math.sin(P.yaw), cz = Math.cos(P.yaw);
  const mx = fwd * sx - side * cz, mz = fwd * cz + side * sx, ml = Math.hypot(mx, mz) || 1, want = fwd || side ? sp : 0;
  P.vx = lerp(P.vx, (mx / ml) * want, 0.25); P.vz = lerp(P.vz, (mz / ml) * want, 0.25);
  if (keys.Space && P.ground && !panelOpen) { P.vy = 8; P.ground = false; }
  physics(P, dt);
  if (panelOpen && near.inter && Math.hypot(P.x - near.inter.x, P.z - near.inter.z) > 4 && panelKind !== "pack") closePanel();
  scanNear(); lobbyStep(dt); updateOthers(dt); sendState(dt);
  heroAndCamera(dt); effects(dt); hud(dt);
}
function heroAndCamera(dt) {
  hero.root.position.set(P.x, P.y, P.z); hero.root.rotation.y = P.yaw;
  animHuman(hero, P.ground ? Math.hypot(P.vx, P.vz) : 0, dt);
  if (P.dead) { hero.body.rotation.x = -Math.PI / 2; hero.body.position.y = 0.3; } else { hero.body.rotation.x = 0; hero.body.position.y = 0; }
  const wpn = WEAPONS[INV.weapons[INV.cur]] || WEAPONS.shovel;
  if (held) { hero.armL.rotation.x = hero.armR.rotation.x = -1.3; }
  else if (meleeT > 0) hero.armR.rotation.x = -2.6 + (0.3 - meleeT) * 10;
  else if (!wpn.melee && mode === "run") hero.armR.rotation.x = -1.45 - P.pitch * 0.8;
  heroGun.visible = !held && !mounted && mode === "run";
  hero.root.visible = !fp || mounted || P.dead;
  const zoom = aiming && wpn.zoom && !held && mode === "run";
  camera.fov = lerp(camera.fov, zoom ? 22 : aiming && mode === "run" ? 52 : 65, 0.2); camera.updateProjectionMatrix();
  // dead: watch a friend who's still up (or the train)
  let fx0 = P.x, fy0 = P.y, fz0 = P.z;
  if (P.dead) { const o = [...NET.others.values()].find((q) => !q.dead && q.y > -50); if (o) { fx0 = o.x; fy0 = o.y; fz0 = o.z; } else { fx0 = TR.x; fy0 = DECK; fz0 = 0; } }
  const head = tmpV.set(fx0, fy0 + 1.65, fz0);
  const dir = new THREE.Vector3(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
  if ((fp || zoom) && !P.dead) camera.position.copy(head).addScaledVector(dir, 0.25);
  else {
    const right = new THREE.Vector3(-Math.cos(P.yaw), 0, Math.sin(P.yaw));
    const back = P.dead ? 7 : mounted ? 3 : aiming && mode === "run" ? 2.4 : 4.2;
    const o = head.clone().addScaledVector(right, mounted || P.dead ? 0 : 0.75);
    const want2 = o.clone().addScaledVector(dir, -back).add(new THREE.Vector3(0, 0.4, 0));
    const cd = want2.clone().sub(o), cl = cd.length(); cd.normalize();
    const hit = rayWalls(o, cd, cl);
    camera.position.copy(o).addScaledVector(cd, Math.max(0.3, hit - 0.25));
    const gh = groundH(camera.position.x, camera.position.z) + 0.3; if (camera.position.y < gh) camera.position.y = gh;
  }
  camera.lookAt(camera.position.clone().add(dir));
  if (shake > 0) { camera.position.x += rand(-1, 1) * shake * 0.15; camera.position.y += rand(-1, 1) * shake * 0.15; shake = Math.max(0, shake - dt * 3); }
}
function effects(dt) {
  for (const e of [...fx]) {
    e.t -= dt;
    if (e.m) { e.vy -= 15 * dt; e.m.position.x += e.vx * dt; e.m.position.y += e.vy * dt; e.m.position.z += e.vz * dt; }
    if (e.line) e.line.material.opacity = e.t / 0.07;
    if (e.ball) { e.ball.scale.setScalar(1 + (0.5 - e.t) * 10); e.ball.material.opacity = e.t * 1.6; }
    if (e.t <= 0) { const o = e.m || e.line || e.ball; scene.remove(o); o.geometry.dispose(); if (o.material) o.material.dispose(); fx.splice(fx.indexOf(e), 1); }
  }
}

// ---------------------------------------------------------------- HUD
let toastT = 0, bannerT = 0, lastSlots = "";
function toast(s) { $("toast").textContent = s; $("toast").classList.add("on"); toastT = 3.4; }
function banner(a, b) { $("bannerBig").textContent = a; $("bannerSmall").textContent = b; $("banner").classList.add("on"); $("banner").classList.toggle("blood", a === "BLOOD MOON"); bannerT = 4.5; }
function bumpMoney() { const m = $("money"); m.classList.remove("bump"); void m.offsetWidth; m.classList.add("bump"); }
function hud(dt) {
  toastT -= dt; if (toastT <= 0) $("toast").classList.remove("on");
  bannerT -= dt; if (bannerT <= 0) $("banner").classList.remove("on");
  const hurt = $("hurt"); hurt.style.opacity = Math.max(0, +hurt.style.opacity - dt * 1.5);
  $("starsHud").textContent = `⭐ ${save.stars}`;
  $("crew").textContent = NET.others.size ? `👥 ${NET.others.size + 1} ${mode === "lobby" ? "in the lobby" : "riders"}` : mode === "lobby" ? (NET.lobby?.conn?.open ? "👥 just you here" : "offline: solo rides") : "";
  let hint = "";
  if (mode === "lobby") {
    const it = near.inter;
    hint = it ? { outfit: "E: the Outfitter (hats, shirts, bandanas)", classes: "E: the Class Office (buy + equip classes)", lobbyguns: "E: the Gunsmith (a starting gun)" }[it.kind] || "" : myPad >= 0 ? "Waiting for the train... step off the pad to cancel" : "";
    $("hint").textContent = hint; $("hint").classList.toggle("hidden", !hint);
    return;
  }
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
  const id = INV.weapons[INV.cur], w = WEAPONS[id] || WEAPONS.shovel;
  $("gunName").textContent = P.dead ? "💀 Down" : held ? "✋ " + (held.type === "corpse" ? "Body ($" + held.bounty + ")" : ITEMS[held.type].name) : mounted ? "Gatling gun" : w.icon + " " + w.name;
  $("ammoNum").textContent = held || w.melee || P.dead ? "" : mounted ? (gatHeat > 1 ? "HOT!" : "🔥" + Math.round(gatHeat * 100) + "%") : `${INV.mag[id] ?? 0} / ${INV.ammo[w.ammo]}`;
  $("reloadBar").style.visibility = reloadT > 0 ? "visible" : "hidden"; if (reloadT > 0) $("reloadFill").style.width = (1 - reloadT / (w.reload || 1)) * 100 + "%";
  const slots = INV.weapons.map((x, i) => `<i class="${i === INV.cur ? "on" : ""}"><small>${i + 1}</small>${WEAPONS[x].icon}</i>`).join("") + `<i class="cons"><small>H</small>🩹${INV.bandage}</i><i class="cons"><small>G</small>💧${INV.holy}</i><i class="cons"><small>B</small>🎒${INV.pack.length}</i>`;
  if (slots !== lastSlots) { $("slots").innerHTML = slots; lastSlots = slots; }
  if (P.dead) hint = "You're down. Your crew can still win it!";
  else if (near.lever && !held) hint = `E: throttle up (${["STOP", "SLOW", "HALF", "FULL"][TR.throttle]}) · F: throttle down`;
  else if (near.furnace && held && ITEMS[held.type].fuel) hint = "E: throw it in the furnace!";
  else if (near.gat && !held) hint = "E: man the gatling gun";
  else if (held && near.inter?.kind === "sheriff" && held.type === "corpse") hint = `E: turn in the body for $${held.bounty}`;
  else if (held && near.inter && (near.inter.kind === "store" || near.inter.kind === "guns") && ITEMS[held.type].value) hint = `E: sell the ${ITEMS[held.type].name} for $${ITEMS[held.type].value}`;
  else if (held && near.inter?.kind === "vault" && held.type === "dynamite") hint = "E: plant the dynamite on the vault!";
  else if (held) hint = "E: put it down · Q or click: throw · T: backpack";
  else if (near.item) hint = `E: ${ITEMS[near.item.type].grab ? "grab" : "pick up"} ${near.item.type === "corpse" ? "the body (" + near.item.foe + ", $" + near.item.bounty + ")" : ITEMS[near.item.type].name}`;
  else if (near.inter) hint = { store: "E: shop", guns: "E: shop for guns", sheriff: "Sheriff: bring bodies here", vault: "The bank vault", chest: "E: open the chest", bridge: BR.on ? "The bridge is coming down!" : "E: pull the lever to lower the drawbridge" }[near.inter.kind] || "";
  $("hint").textContent = hint; $("hint").classList.toggle("hidden", !hint);
  const boss = foes.find((f) => f.d.boss && f.aggro && Math.hypot(f.x - P.x, f.z - P.z) < 90);
  $("bossBox").classList.toggle("hidden", !boss); if (boss) { $("bossName").textContent = boss.d.name.toUpperCase(); $("bossFill").style.width = boss.hp / boss.max * 100 + "%"; }
  $("bridgeBox").classList.toggle("hidden", !BR.on || BR.p >= 1); $("bridgeFill").style.width = BR.p * 100 + "%";
  $("cross").classList.toggle("hidden", !!held || P.dead);
}

// ---------------------------------------------------------------- the end of a run
function gameOver(won) {
  if (RUN.over) return; RUN.over = true;
  const km = (Math.min(LEN, Math.max(0, TR.x)) - (RUN.start === "m" ? MID_X : 0)) / 1000;
  const earned = Math.max(0, Math.floor(km * 2)) + Math.floor(RUN.kills / 15) + (won ? 15 : 0) + (RUN.baron ? 5 : 0) + (RUN.colossus ? 10 : 0);
  save.stars += earned; save.best = Math.max(save.best, Math.min(LEN, TR.x) / 1000); if (won) { save.wins++; save.mid = null; } store();
  document.exitPointerLock?.();
  setTimeout(() => {
    $("overTitle").textContent = won ? "YOU MADE IT TO SUNDOWN!" : "THE DESERT GOT YOU";
    $("overTitle").className = won ? "gold" : "red";
    $("overKm").textContent = (Math.min(LEN, TR.x) / 1000).toFixed(2) + " km"; $("overKills").textContent = RUN.kills; $("overMoney").textContent = "$" + RUN.money; $("overStars").textContent = "+" + earned + " ⭐";
    $("overMid").textContent = save.mid && !won ? "Your Halfway Post checkpoint is saved: take the MIDWAY train in the lobby to start at 6 km." : "";
    $("over").classList.remove("hidden"); $("hud").classList.add("hidden");
  }, won ? 800 : 1400);
  if (won) SFX.win(); else SFX.over();
}
function win() { if (RUN.won) return; RUN.won = true; banner("SUNDOWN STATION!", "You crossed the whole desert!"); gameOver(true); }
function backToLobby() { $("over").classList.add("hidden"); if (NET.run) { const r = NET.run; NET.run = null; r.close(); } clearOthers(); enterLobby(); lock(); }
function showPause(on) { paused = on; $("pause").classList.toggle("hidden", !on); }
$("resume").onclick = () => { showPause(false); lock(); };
$("quit").onclick = () => { showPause(false); RUN.over = true; backToLobby(); };
$("again").onclick = backToLobby;
const muteBtns = () => { $("muteBtn").textContent = isMuted() ? "🔇" : "🔊"; $("menuMute").textContent = isMuted() ? "🔇 Sound off" : "🔊 Sound on"; };
for (const b of [$("muteBtn"), $("menuMute")]) b.onclick = () => { audio(); setMuted(!isMuted()); muteBtns(); };
muteBtns();
$("start").onclick = () => { audio(); $("menu").classList.add("hidden"); enterLobby(); lock(); banner("THE LOBBY", "Shop for hats, classes and a starting gun. Then step on a TRAIN pad to ride out (4 riders max)."); };
$("controls").innerHTML = $("controls2").innerHTML = `<b>WASD</b> move · <b>Mouse</b> look · <b>Click</b> shoot · <b>Right-click</b> aim · <b>R</b> reload · <b>1-5</b> weapons · <b>E</b> pick up / drop / use · <b>Q</b> throw · <b>B</b> backpack · <b>T</b> stash in backpack · <b>H</b> bandage · <b>G</b> holy water · <b>Space</b> jump · <b>Shift</b> run · <b>V</b> first person`;

// the title screen: the lobby behind it
mode = "title"; P.x = LOBBY_X; P.z = 0; train.visible = false; buildHero(); world.update(LOBBY_X, onBuilt); updateSky(0);
camera.position.set(LOBBY_X + 14, 6, -12); camera.lookAt(LOBBY_X, 2, 20);
requestAnimationFrame(tick);
if (TEST) window.LT = { P, TR, RUN, INV, NET, BR, foes, items, world, save, spawnFoe, addItem, setThrottle, step, get dayT() { return dayT; }, set dayT(v) { dayT = v; }, get mode() { return mode; }, camera, interact, near, scene, hurtFoe, pickUp, isNight, get held() { return held; }, openShop, startRun, enterLobby, stow, openPack, takeOut, startBridge, padIds, lobbyId, isHost };
