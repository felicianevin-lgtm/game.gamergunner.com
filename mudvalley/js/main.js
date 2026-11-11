// MUD VALLEY RP (game.gamergunner.com/mudvalley/): a 3D open-world driving role-playing game.
// Drive on roads and muddy trails, do jobs for money, buy rides at the dealership, customize them, tow trailers,
// buy houses and win races. Progress is saved in this browser. Test hook: window.MV (see the bottom). ?thumb draws the thumbnail.
// Files: layout.js (the map plan), terrain.js (the ground), build.js + world.js (buildings, trees, the valley),
// vehicles.js (rides + models), physics.js (driving + walking), trailer.js, character.js (people), jobs.js, races.js,
// save.js, hud.js (on-screen info + maps), menus.js (shop screens), input.js (controls), sfx.js (sounds), fx.js (mud + dust).
import * as THREE from "/create/vendor/three.module.js";
import { buildWorld, makeSky, animateWorld, recolorMarker } from "./world.js";
import { groundAt, mapCanvas, PATHS, SURF } from "./terrain.js";
import { PLACES, HOUSES, WATER_Y } from "./layout.js";
import { vehicleById, buildCar, applyLook, animateCar, newCar, brokenCar, PAINTS } from "./vehicles.js";
import { makeBody, stepCar, placeModel, unflip, retune, makeWalker, stepWalker, bumpPair, speedOf } from "./physics.js";
import { trailerById, makeTrailer, stepTrailer, hitchPoint, couplerPoint, freeSlots, loadOnto, cargoBoxes, makeTowable } from "./trailer.js";
import { makePerson, LOOKS } from "./character.js";
import { FX } from "./fx.js";
import { SFX, audio, setMuted, engine } from "./sfx.js";
import { S, save, uid, slots, pay, spend, money, wipe } from "./save.js";
import { Jobs } from "./jobs.js";
import { Race, raceById } from "./races.js";
import { signTex } from "./build.js";
import { pushOut } from "./colliders.js";
import * as H from "./hud.js";
import * as IN from "./input.js";
import { initMenus, UI } from "./menus.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const THUMB = Q.has("thumb"), TEST = Q.has("test");
const DT = 1 / 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- 3D setup
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: TEST || THUMB });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 1500);
let quality = Q.has("low") ? 0 : 1;
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, quality ? 1.5 : 1);
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
if (IN.touch) document.body.classList.add("touch");

// ---------------------------------------------------------------- game state
const G = {
  mode: "play", // play | side (shop screens) | modal | map | race | thumb
  time: 0, CARS: new Map(), TRS: new Map(), me: null, race: null, tow: null, waypoint: null, panel: null, preview: null,
  shake: 0, hint: null, hintT: 0,
  // fast travel to your home (from the phone)
  goHome(h) { const yaw = h.yaw + Math.PI, f = freeSpot(h.garage.x, h.garage.z, yaw, mine() ? mine().m.len : 2); teleportMe(f.x, f.z, yaw); SFX.phone(); H.toast("Home sweet home!", h.name, "good"); },
};
let sky, world, fx, jobs;
const cam = { yaw: Math.PI, pitch: 0.3, zoom: 1, x: 0, y: 5, z: 0, tx: 0, ty: 0, tz: 0, snap: true };

// ---------------------------------------------------------------- your vehicles + trailers in the world
function spawnCar(s) {
  const m = buildCar(s); scene.add(m.root);
  const b = makeBody(s, m);
  const c = { s, m, b, on: null };
  settle(b);
  G.CARS.set(s.uid, c);
  return c;
}
function settle(b) { // let a parked vehicle sit nicely on the ground
  b.y = groundAt(b.x, b.z); b.air = false;
  for (let i = 0; i < 8; i++) { stepCar(b, { thr: 0, steer: 0, hand: true }, DT); b.vx = b.vz = b.vy = 0; }
  b.susp = 0; b.suspV = 0; placeModel(b);
}
function spawnTrailer(s) { const t = makeTrailer(s, scene); G.TRS.set(s.uid, t); return t; }
const sizeOf = (c) => vehicleById(c.s.id).size;
const towOf = (c) => vehicleById(c.s.id).tow;
const mine = () => G.me.car;
const body = () => (G.me.car ? G.me.car.b : null);
const myTrailer = () => { const c = mine(); if (!c) return null; for (const t of G.TRS.values()) if (t.hitched === c.b) return t; return null; };
function carCircles(b) {
  const len = b.model.len, wid = b.model.wid, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  if (len <= 3) return [{ x: b.x, z: b.z, r: Math.max(len, wid) * 0.45 }];
  return [{ x: b.x + fx * len * 0.26, z: b.z + fz * len * 0.26, r: wid * 0.52 }, { x: b.x - fx * len * 0.26, z: b.z - fz * len * 0.26, r: wid * 0.52 }];
}
// a free spot to put a vehicle (not on top of another one)
function freeSpot(x, z, yaw, len = 5) {
  const sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const [a, b] of [[0, 0], [4.5, 0], [-4.5, 0], [9, 0], [-9, 0], [0, -7], [4.5, -7], [-4.5, -7], [0, 7], [13.5, 0], [-13.5, 0], [0, -14]]) {
    const px = x + sx * a + fx * b, pz = z + sz * a + fz * b;
    let bad = false;
    for (const c of G.CARS.values()) if (!c.on && c !== mine() && Math.hypot(c.b.x - px, c.b.z - pz) < len / 2 + c.m.len / 2 + 0.5) bad = true;
    for (const t of G.TRS.values()) if (Math.hypot(t.x - px, t.z - pz) < len / 2 + 4) bad = true;
    if (pushOut(px, pz, Math.min(2.4, len / 2), groundAt(px, pz) + 0.5).hit > 0.05) bad = true;
    if (!bad) return { x: px, z: pz };
  }
  return { x, z };
}

// ---------------------------------------------------------------- you
function makeMe() {
  const p = makePerson(LOOKS.you); scene.add(p.root);
  G.me = { p, w: makeWalker(S.px, S.pz), car: null };
}
function enterCar(c) {
  if (c.on) return;
  G.me.car = c; G.me.p.root.visible = false; c.m.rider && (c.m.rider.root.visible = true);
  cam.yaw = c.b.yaw; SFX.door(); setTimeout(() => SFX.start(), 120);
  S.driving = c.s.uid;
}
function exitCar() {
  const c = mine(); if (!c) return;
  const b = c.b, sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw), d = c.m.wid / 2 + 0.9;
  let px = b.x + sx * d, pz = b.z + sz * d;
  if (pushOut(px, pz, 0.5, b.y + 0.5).hit > 0.1) { px = b.x - sx * d; pz = b.z - sz * d; }
  const w = G.me.w; w.x = px; w.z = pz; w.y = groundAt(px, pz); w.vx = w.vz = 0; w.yaw = b.yaw;
  G.me.car = null; G.me.p.root.visible = true; if (c.m.rider) c.m.rider.root.visible = false;
  b.vx *= 0.3; b.vz *= 0.3;
  SFX.door(); engine(false);
  S.driving = null;
}
function teleportMe(x, z, yaw) {
  const c = mine();
  if (c) { const b = c.b; b.x = x; b.z = z; b.yaw = yaw; b.vx = b.vz = b.vy = 0; b.yawRate = 0; b.flipped = false; b.pitch = b.roll = 0; b.y = groundAt(x, z); b.air = false; placeModel(b); const t = myTrailer(); if (t) { t.x = x - Math.sin(yaw) * (t.T.len + 3); t.z = z - Math.cos(yaw) * (t.T.len + 3); t.yaw = yaw; stepTrailer(t, DT); } }
  else { const w = G.me.w; w.x = x; w.z = z; w.y = groundAt(x, z); w.vx = w.vz = 0; w.yaw = yaw; }
  cam.yaw = yaw; cam.snap = true;
}

// ---------------------------------------------------------------- job props: beacons, passengers, broken-down cars
function beacon(color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = 40; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 7, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  g.visible = false; scene.add(g); g.userData.ring = ring;
  return g;
}
let jobBeacon, gpsBeacon, passenger = null;
function setBeacon(bc, p) { if (!p) { bc.visible = false; return; } bc.visible = true; bc.position.set(p.x, groundAt(p.x, p.z) + (Math.abs(p.x) < 116 && Math.abs(p.z) < 106 ? 0.14 : 0), p.z); }
function roadsideSpot() {
  const list = PATHS.filter((p) => !p.town && p.kind !== "track" && p.kind !== "speedway" && p.n > 20);
  for (let tries = 0; tries < 40; tries++) {
    const p = list[Math.floor(Math.random() * list.length)], i = 5 + Math.floor(Math.random() * (p.n - 10));
    if (p.bridge[i] || p.ford[i]) continue;
    const tx = p.x[i + 1] - p.x[i], tz = p.z[i + 1] - p.z[i], l = Math.hypot(tx, tz) || 1, side = Math.random() < 0.5 ? 1 : -1;
    const x = p.x[i] - (tz / l) * (p.w / 2 + 3) * side, z = p.z[i] + (tx / l) * (p.w / 2 + 3) * side;
    if (Math.hypot(x - 36, z + 18) < 120) continue;
    if (pushOut(x, z, 2.5, groundAt(x, z) + 0.5).hit > 0.1 || WATER_Y > groundAt(x, z) - 0.3) continue;
    return { id: "breakdown", name: "the broken-down car", x, z, yaw: Math.atan2(tx, tz) + (Math.random() < 0.5 ? Math.PI : 0) };
  }
  return { id: "breakdown", name: "the broken-down car", x: 150, z: 60, yaw: 0 };
}
const jobApi = {
  roadsideSpot, toast: H.toast, hint: (t) => { G.hint = t; G.hintT = 1.2; },
  canTow: () => !!mine() && towOf(mine()) >= 2,
  trailer: () => myTrailer(),
  pos: () => (mine() ? mine().b : G.me.w), body: () => body(), vehicleId: () => (mine() ? mine().s.id : null),
  towHooked: () => !!(G.tow && mine() && G.tow.hitched === mine().b),
  started(j) {
    SFX.job(); H.toast(j.T.icon + " " + j.T.name, j.type === "tow" ? "Find the broken-down car (yellow beam) and hook it up with T!" : "Go to " + j.from.name + " (follow the yellow arrow)", "good", 4200);
    if (j.type === "taxi") { passenger = makePerson(LOOKS.npc[Math.floor(Math.random() * LOOKS.npc.length)]); passenger.root.position.set(j.from.x, groundAt(j.from.x, j.from.z), j.from.z); scene.add(passenger.root); }
    if (j.type === "tow") { const m = brokenCar(PAINTS[Math.floor(Math.random() * PAINTS.length)]); G.tow = makeTowable(m, j.from.x, j.from.z, j.from.yaw, scene); }
    jobGoal(j); UI.close(); save();
  },
  pickedUp(j) {
    SFX.pickup();
    const msg = { delivery: "Got the package!", pizza: "Pizza's hot! Hurry!", taxi: "Passenger is in. Drive smooth!", tow: "Hooked up! Tow it to Mud & Chrome Customs.", haul: "Cargo loaded!", supply: "Supplies loaded!" }[j.type];
    H.toast(msg, "Now deliver to " + j.to.name, "good");
    if (passenger) { scene.remove(passenger.root); passenger = null; }
    if (j.type === "haul") cargoBoxes(myTrailer(), j.cargo);
    jobGoal(j);
  },
  ended(j, ok, cash = 0, bonus = []) {
    if (passenger) { scene.remove(passenger.root); passenger = null; }
    if (G.tow) { const t = G.tow; scene.remove(t.model.root); G.tow = null; }
    for (const t of G.TRS.values()) if (t.cargo) cargoBoxes(t, null);
    setBeacon(jobBeacon, null);
    if (ok) {
      pay(cash); S.stats.jobs++; SFX.cash(); H.bumpMoney();
      H.toast("+" + money(cash), "Job done! " + bonus.map(([n, v]) => n + " +" + money(v)).join(" · "), "cash", 4500);
      const p = mine() ? mine().b : G.me.w; fx.confetti(p.x, p.y + 2, p.z, 40);
      firstGoals();
    } else H.toast("Job cancelled", "", "warn");
    save();
  },
};
function jobGoal(j) {
  j.goal = j.stage === 0 ? (j.type === "tow" ? "Find the broken-down car and press T to hook it up" : j.type === "haul" ? "Drive your trailer to " + j.from.name : "Go to " + j.from.name) : "Deliver to " + j.to.name;
  setBeacon(jobBeacon, jobs.target());
}

// ---------------------------------------------------------------- the house signs (FOR SALE / HOME)
function houseSigns() {
  for (const h of HOUSES) {
    const s = world.signs[h.id]; if (!s) continue;
    const own = S.houses.includes(h.id);
    const t = own ? signTex(S.home === h.id ? "HOME ★" : "YOURS", 256, 128, "#2a9a3a", "#ffffff") : signTex("FOR SALE\n" + money(h.price), 256, 128, "#ffffff", "#d0302a", { border: "#d0302a" });
    s.material.map && s.material.map.dispose(); s.material.map = t; s.material.needsUpdate = true;
    const mk = world.markers["house_" + h.id], mc = own && h.price ? "#3ac04a" : h.price ? "#ff5ad8" : "#7a8aa0";
    if (mk && mk.color !== mc) { mk.color = mc; mk.ring.material.color.set(mc); if (h.price) recolorMarker(mk, mc, "🏠"); }
  }
}

// ---------------------------------------------------------------- what you can do nearby (E / F / T)
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
function actions() {
  const out = { E: null, F: null, T: null };
  const c = mine(), me = c ? c.b : G.me.w;
  // F: get in / out
  if (c) out.F = { text: "Get out", fn: exitCar };
  else {
    let best = null, bd = 1e9;
    for (const v of G.CARS.values()) { if (v.on) continue; const d = Math.hypot(v.b.x - me.x, v.b.z - me.z) - v.m.len / 2; if (d < 2.2 && d < bd) { bd = d; best = v; } }
    if (best) out.F = { text: "Drive " + vehicleById(best.s.id).name, fn: () => enterCar(best) };
  }
  // T: hitch / unhitch trailers (and tow-job cars)
  if (c && c.m.hitch) {
    const t = myTrailer();
    if (t) out.T = { text: "Unhitch trailer", fn: () => { t.hitched = null; t.s.hitched = null; SFX.hitch(); save(); } };
    else if (G.tow && G.tow.hitched === c.b) out.T = { text: "Unhook the car", fn: () => { G.tow.hitched = null; SFX.hitch(); } };
    else {
      const hp = hitchPoint(c.b);
      for (const tr of G.TRS.values()) {
        if (tr.hitched || !near(couplerPoint(tr), hp, 4.2)) continue;
        if (towOf(c) < tr.T.need) { out.T = { text: vehicleById(c.s.id).name + " can't pull the " + tr.T.name, warn: true, fn: () => SFX.nope() }; break; }
        out.T = { text: "Hitch the " + tr.T.name, fn: () => { tr.hitched = c.b; tr.s.hitched = c.s.uid; SFX.hitch(); H.toast("Trailer hitched!", "Drive slow around corners. Press T to unhitch.", "good"); save(); } };
        break;
      }
      if (!out.T && G.tow && !G.tow.hitched && near(couplerPoint(G.tow), hp, 5.5)) {
        out.T = towOf(c) >= 2 ? { text: "Hook up the broken car", fn: () => { G.tow.hitched = c.b; SFX.hitch(); } } : { text: "You need a truck to tow cars", warn: true, fn: () => SFX.nope() };
      }
    }
  }
  // E: load / unload trailers
  if (c && sizeOf(c) <= 2) {
    for (const tr of G.TRS.values()) {
      if (tr.hitched === c.b || !near(tr, me, 6.5)) continue;
      const sl = freeSlots(tr, sizeOf(c));
      out.E = sl ? { text: "Load onto the " + tr.T.name, fn: () => loadCar(c, tr, sl) } : { text: sizeOf(c) > tr.T.maxSize ? "Too big for this trailer" : "Trailer is full", warn: true, fn: () => SFX.nope() };
      break;
    }
  }
  if (!c) for (const tr of G.TRS.values()) if (tr.loaded.length && near(tr, me, 6.5)) { const last = tr.loaded[tr.loaded.length - 1]; out.E = { text: "Unload " + vehicleById(G.CARS.get(last.uid).s.id).name, fn: () => unloadCar(tr) }; break; }
  // E: places
  if (!out.E) {
    for (const [id, mk] of Object.entries(world.markers)) {
      if (!near(mk, me, mk.r + (c ? 1.5 : 0))) continue;
      const house = id.startsWith("house_") ? HOUSES.find((h) => "house_" + h.id === id) : null;
      if (house) { out.E = { text: S.houses.includes(house.id) ? "Open garage" : "Look at " + house.name, fn: () => UI.house(house) }; break; }
      if (id === "dealer") { out.E = { text: "Enter Valley Motors", fn: () => UI.dealer() }; break; }
      if (id === "jobs") { out.E = { text: "Look at the Job Board", fn: () => UI.jobs() }; break; }
      if (id === "customs") { out.E = c ? { text: "Customize your " + vehicleById(c.s.id).name, fn: () => UI.customs() } : { text: "Drive in here to customize", warn: true, fn: () => SFX.nope() }; break; }
      if (id === "wash") { out.E = c ? { text: "Car wash (free!)", fn: washCar } : { text: "Drive in to wash your ride", warn: true, fn: () => SFX.nope() }; break; }
      if (id === "lot") { out.E = { text: "Open garage", fn: () => UI.house(HOUSES[0]) }; break; }
      if (raceById(id)) { out.E = { text: "Race: " + raceById(id).name, fn: () => UI.raceInfo(raceById(id)) }; break; }
    }
  }
  return out;
}
function loadCar(c, tr, sl) {
  exitCar();
  const w = G.me.w, sx = Math.cos(tr.yaw), sz = -Math.sin(tr.yaw);
  w.x = tr.x + sx * 2.8; w.z = tr.z + sz * 2.8;
  c.on = tr; c.s.on = tr.s.uid; c.b.vx = c.b.vz = 0;
  loadOnto(tr, { uid: c.s.uid }, c.m, sl);
  SFX.load(); H.toast("Loaded!", "Now hop in your truck (F) and tow it away.", "good"); save();
}
function unloadCar(tr) {
  const e = tr.loaded.pop(); const c = G.CARS.get(e.uid);
  tr.model.deck.remove(c.m.root); scene.add(c.m.root);
  const back = tr.T.id === "flatbed" ? 5.6 : 2.4, b = c.b;
  b.yaw = tr.yaw; b.x = tr.x - Math.sin(tr.yaw) * (back + c.m.len / 2 + 1); b.z = tr.z - Math.cos(tr.yaw) * (back + c.m.len / 2 + 1);
  const f = freeSpot(b.x, b.z, b.yaw, c.m.len); b.x = f.x; b.z = f.z;
  c.on = null; c.s.on = null; settle(b);
  SFX.load(); save();
}
function washCar() {
  const c = mine(); c.s.dirt = 0; applyLook(c.m, c.s); SFX.wash();
  for (let i = 0; i < 6; i++) setTimeout(() => fx.splash(c.b.x + (Math.random() - 0.5) * 3, c.b.y + 2.5, c.b.z + (Math.random() - 0.5) * 3, 8), i * 200);
  H.toast("Squeaky clean!", "Your " + vehicleById(c.s.id).name + " is shiny again.", "good"); save();
}

// ---------------------------------------------------------------- the game api (used by the shop screens in menus.js)
export const GAME = {
  get S() { return S; }, G, mine, myTrailer, freeSpot, scene, camera,
  slotsLeft: () => slots() - S.cars.length,
  buyCar(id) {
    const v = vehicleById(id);
    if (S.cars.length >= slots()) { H.toast("Your garage is full!", "Buy a bigger house to own more rides (or sell one).", "warn"); SFX.nope(); return false; }
    if (!spend(v.price)) { SFX.nope(); H.toast("Not enough money", "Do some jobs to earn " + money(v.price - S.money) + " more.", "warn"); return false; }
    const s = newCar(id, uid()); s.yaw = 0;
    const f = freeSpot(-36, -14, 0, 5); s.x = f.x; s.z = f.z;
    S.cars.push(s); const c = spawnCar(s);
    if (mine()) exitCar();
    enterCar(c); SFX.buy(); H.bumpMoney(); fx.confetti(s.x, groundAt(s.x, s.z) + 2, s.z, 60);
    H.banner("NEW RIDE!", v.name); save(); return true;
  },
  buyTrailer(type) {
    const T = trailerById(type);
    if (!spend(T.price)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; }
    const s = { uid: uid(), type, x: -60, z: -16, yaw: 0, hitched: null };
    const f = freeSpot(-62, -20, 0, T.len * 2); s.x = f.x; s.z = f.z;
    S.trailers.push(s); spawnTrailer(s); SFX.buy(); H.bumpMoney();
    H.toast(T.name + " bought!", "It's parked by the dealership. Back your truck up to it and press T.", "good", 5000); save(); return true;
  },
  sellCar(u) {
    const c = G.CARS.get(u); if (!c || S.cars.length <= 1) return false;
    if (c === mine()) exitCar();
    if (c.on) { const tr = c.on; const i = tr.loaded.findIndex((e) => e.uid === u); tr.loaded.splice(i, 1); tr.model.deck.remove(c.m.root); }
    for (const t of G.TRS.values()) if (t.hitched === c.b) { t.hitched = null; t.s.hitched = null; }
    scene.remove(c.m.root); G.CARS.delete(u); S.cars = S.cars.filter((s) => s.uid !== u);
    pay(Math.round(vehicleById(c.s.id).price * 0.5)); SFX.cash(); save(); return true;
  },
  bringCar(u, h, drive) {
    const c = G.CARS.get(u); if (!c) return;
    if (c.on) unloadCarByUid(u);
    for (const t of G.TRS.values()) if (t.hitched === c.b && c !== mine()) { t.hitched = null; t.s.hitched = null; }
    const far = Math.hypot(c.b.x - h.garage.x, c.b.z - h.garage.z) > 60;
    if (far && !spend(25)) { SFX.nope(); return; }
    if (c === mine() && !drive) exitCar();
    const yaw = h.yaw + Math.PI, f = freeSpot(h.garage.x, h.garage.z, yaw, c.m.len);
    const b = c.b; b.x = f.x; b.z = f.z; b.yaw = yaw; b.vx = b.vz = 0; b.flipped = false; settle(b);
    if (drive) { if (mine() && mine() !== c) exitCar(); if (!mine()) enterCar(c); cam.snap = true; UI.close(); }
    SFX.click(); if (far) H.toast("Delivered!", "A tow service brought it here for $25.", ""); save();
  },
  bringTrailer(u, h) {
    const t = G.TRS.get(u); if (!t) return; t.hitched = null; t.s.hitched = null;
    const yaw = h.yaw + Math.PI, f = freeSpot(h.garage.x, h.garage.z, yaw, t.T.len * 2);
    t.x = f.x; t.z = f.z; t.yaw = yaw; stepTrailer(t, DT); SFX.click(); save();
  },
  buyHouse(h) {
    if (S.houses.includes(h.id)) return;
    if (!spend(h.price)) { SFX.nope(); H.toast("Not enough money", "You need " + money(h.price - S.money) + " more.", "warn"); return false; }
    S.houses.push(h.id); S.home = h.id; houseSigns(); SFX.buy(); H.bumpMoney(); fx.confetti(h.x, groundAt(h.x, h.z) + 6, h.z, 120);
    H.banner("NEW HOME!", h.name + " · garage room: " + slots() + " rides"); save(); return true;
  },
  setHome(id) { S.home = id; houseSigns(); save(); },
  // customizing the vehicle you're in
  custom(kind, val, cost) {
    const c = mine(); if (!c) return false;
    if (cost && !spend(cost)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; }
    c.s[kind] = val; applyLook(c.m, c.s); retune(c.b); if (cost) { SFX.cash(); H.bumpMoney(); } else SFX.click();
    save(); return true;
  },
  startRace(id) {
    const def = raceById(id), c = mine();
    if (!c) { H.toast("You need a vehicle to race!", "", "warn"); return; }
    if (jobs.active) { H.toast("You're on a job", "Finish or quit your job first (phone → Jobs).", "warn"); return; }
    const t = myTrailer(); if (t) { t.hitched = null; t.s.hitched = null; }
    UI.close();
    G.race = new Race(scene, def, { teleport: teleportMe });
    G.raceFrom = { x: PLACES[def.place].x, z: PLACES[def.place].z };
    G.mode = "race"; H.toast("🏁 " + def.name, "Get ready! Drive through the glowing hoops. R = back to the track.", "good", 4000); S.stats.races++;
  },
  quitRace() { endRace(); },
  takeJob(i) { return jobs.take(i); }, cancelJob() { jobs.cancel(); }, get jobs() { return jobs; },
  setWaypoint(p) { G.waypoint = p; setBeacon(gpsBeacon, p); if (p) H.toast("GPS set", "Follow the purple arrow to " + (p.name || "your spot"), ""); },
  showroom(id) {
    if (G.preview) { scene.remove(G.preview.root); G.preview = null; }
    if (!id) return;
    const isT = !!trailerById(id);
    const m = isT ? { root: (() => { const g = new THREE.Group(); g.add(trailerModel(id)); return g; })() } : buildCar(newCar(id, 0));
    m.root.position.set(-36, 1.45, -18); scene.add(m.root); G.preview = m;
  },
  wipe() { wipe(); location.reload(); },
  muted(m) { S.muted = m; setMuted(m); $("bMute").textContent = m ? "🔇" : "🔊"; save(); },
};
function trailerModel(id) { const tm = makeTrailer({ type: id, x: 0, z: 0, yaw: 0 }, new THREE.Group()); tm.model.root.position.set(0, 0, 0); tm.model.root.rotation.set(0, 0, 0); return tm.model.root; }
function unloadCarByUid(u) { const c = G.CARS.get(u), tr = c.on; const i = tr.loaded.findIndex((e) => e.uid === u); const [e] = tr.loaded.splice(i, 1); tr.loaded.push(e); unloadCar(tr); }
function endRace() {
  if (!G.race) return;
  G.race.dispose(); G.race = null; G.mode = "play";
  const p = G.raceFrom; teleportMe(p.x + 4, p.z, mine() ? mine().b.yaw : 0);
}

// ---------------------------------------------------------------- the main loop
let acc = 0, last = performance.now(), saveT = 0, fpsT = 0, frames = 0, slowT = 0, miniT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (G.mode === "thumb") return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!G.frozen) { acc += dt; let n = 0; while (acc >= DT && n < 4) { tick(DT); acc -= DT; n++; } if (n >= 4) acc = 0; }
  draw(dt);
  // automatic quality: if the computer is struggling, draw fewer pixels
  frames++; fpsT += dt;
  if (fpsT > 2) { const fps = frames / fpsT; frames = 0; fpsT = 0; if (fps < 32 && quality) { slowT++; if (slowT >= 2) { quality = 0; resize(); renderer.shadowMap.enabled = fps > 22; } } else slowT = 0; }
}
function tick(dt) {
  G.time += dt;
  const blocked = G.mode === "side" || G.mode === "modal" || G.mode === "map";
  const c = mine();
  const raceLock = G.race && G.race.state === "count";
  // keys that work anytime you're playing
  if (!blocked) {
    const A = actions(); G.actions = A;
    if (IN.pressed("KeyF") && A.F && !G.race) A.F.fn();
    if (IN.pressed("KeyE") && A.E && !G.race) A.E.fn();
    if (IN.pressed("KeyT") && A.T && !G.race) A.T.fn();
    if (IN.pressed("KeyH")) (c && ["hauler", "monster"].includes(c.s.id) ? SFX.hornBig : SFX.horn)();
    if (IN.pressed("KeyR")) resetVehicle();
  }
  // driving
  if (c) {
    const inp = blocked || raceLock ? { thr: 0, steer: 0, hand: true } : IN.drive();
    if (G.mode === "side" && G.panel === "customs") { c.b.vx = c.b.vz = 0; }
    const b = stepCar(c.b, inp, dt);
    carEffects(c, b, inp, dt);
  } else {
    const w = IN.walk(); const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const mx = blocked ? 0 : -fz * w.x + fx * w.y, mz = blocked ? 0 : fx * w.x + fz * w.y;
    const jump = !blocked && IN.pressed("Space");
    if (jump) SFX.jump();
    stepWalker(G.me.w, mx, mz, w.run, jump, dt);
  }
  // bumping into other vehicles / trailers
  const me = c ? c.b : G.me.w;
  if (c) carVsStuff(c.b);
  else for (const o of G.CARS.values()) if (!o.on) for (const k of carCircles(o.b)) bumpPair(G.me.w, 0.4, k, k.r, true);
  for (const t of G.TRS.values()) stepTrailer(t, dt);
  if (G.tow) stepTrailer(G.tow, dt);
  if (G.race) raceTick(dt);
  jobs.update(dt);
  if (G.waypoint && Math.hypot(G.waypoint.x - me.x, G.waypoint.z - me.z) < 14) { G.waypoint = null; setBeacon(gpsBeacon, null); H.toast("You made it!", "", "good"); SFX.check(); }
  if (G.hintT > 0) G.hintT -= dt;
  fx.update(dt);
  saveT += dt; if (saveT > 6) { saveT = 0; syncSave(); }
}
// push the driven vehicle off parked ones (a simple version of bumpPair that moves the car body)
function carVsStuff(b) {
  for (const o of G.CARS.values()) {
    if (o.b === b || o.on) continue;
    for (const a of carCircles(b)) for (const k of carCircles(o.b)) {
      const dx = a.x - k.x, dz = a.z - k.z, d = Math.hypot(dx, dz), m = a.r + k.r;
      if (d >= m || d < 1e-4 || Math.abs(b.y - o.b.y) > 2.5) continue;
      const nx = dx / d, nz = dz / d, pen = m - d; b.x += nx * pen; b.z += nz * pen;
      const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= nx * vn * 1.3; b.vz -= nz * vn * 1.3; b.hit = Math.max(b.hit, -vn); }
    }
  }
  for (const t of G.TRS.values()) {
    if (t.hitched === b) continue;
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw), half = t.T.id === "flatbed" ? 4.5 : 1.8;
    for (const a of carCircles(b)) for (const s of [-half, 0, half]) {
      const kx = t.x + fx * s, kz = t.z + fz * s, dx = a.x - kx, dz = a.z - kz, d = Math.hypot(dx, dz), m = a.r + 1.3;
      if (d >= m || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d; b.x += nx * (m - d); b.z += nz * (m - d);
      const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= nx * vn * 1.2; b.vz -= nz * vn * 1.2; }
    }
  }
  if (G.race) for (const a of G.race.ais) { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 2.4 && d > 1e-3) { b.x += (dx / d) * (2.4 - d); b.z += (dz / d) * (2.4 - d); } }
}
// mud, dust, splashes, crashes, landings, big air, the engine sound
let lookT = 0, wasAir = false;
function carEffects(c, b, inp, dt) {
  const sp = speedOf(b), fx2 = Math.sin(b.yaw), fz2 = Math.cos(b.yaw);
  if (b.hit > 6) { SFX.crash(b.hit / 3); G.shake = Math.min(1, b.hit / 20); fx.sparks(b.x + fx2 * c.m.len / 2, b.y + 0.8, b.z + fz2 * c.m.len / 2, 12); jobs.crash(); }
  if (b.land > 5) { SFX.land(b.land / 2); G.shake = Math.min(0.8, b.land / 30); fx.dust(b.x, b.y, b.z, 6); if (b.surf === SURF.MUD) { fx.mud(b.x, b.y, b.z, 0, 0, 30, 1.4); SFX.squish(); } if (b.surf === SURF.WATER) { fx.splash(b.x, WATER_Y, b.z, 30, 1.4); SFX.splash(); } }
  if (wasAir && !b.air && b.airT > 1.0 && sp > 8 && !G.race) {
    const cash = Math.round(b.airT * 12); pay(cash); S.stats.bigAir++; H.bumpMoney();
    H.toast(b.airT > 2 ? "MEGA AIR!" : "BIG AIR!", b.airT.toFixed(1) + " seconds in the air! +" + money(cash), "cash", 2200); SFX.air();
  }
  wasAir = b.air;
  if (b.flipped) { G.hint = "Oops, you flipped! Press R to flip back"; G.hintT = 0.3; }
  // the ground flies up behind your wheels
  if (!b.air && sp > 3) {
    const rx = b.x - fx2 * c.m.len * 0.4, rz = b.z - fz2 * c.m.len * 0.4;
    if (b.surf === SURF.MUD) { if (Math.random() < 0.7) fx.mud(rx, b.y, rz, fx2, fz2, 2, Math.min(1.4, sp / 12)); c.s.dirt = Math.min(1, (c.s.dirt || 0) + dt * 0.1); if (Math.random() < 0.03) SFX.squish(); }
    else if (b.surf === SURF.WATER) { if (Math.random() < 0.6) fx.splash(rx, WATER_Y + 0.1, rz, 3, Math.min(1.2, sp / 14)); c.s.dirt = Math.max(0, (c.s.dirt || 0) - dt * 0.15); if (Math.random() < 0.04) SFX.splash(); }
    else if ([SURF.DIRT, SURF.TRACK, SURF.SAND, SURF.ROCK].includes(b.surf)) { if (Math.random() < Math.min(0.5, sp / 40)) fx.dust(rx, b.y, rz, 1, 0xc8a878, 0.3 + sp / 90); c.s.dirt = Math.min(1, (c.s.dirt || 0) + dt * 0.01); }
    else if (b.slip > 5 && Math.random() < 0.5) fx.dust(rx, b.y, rz, 1, b.surf === SURF.GRASS ? 0x9ad07a : 0xdddddd, 0.45);
  }
  lookT += dt; if (lookT > 0.5) { lookT = 0; applyLook(c.m, c.s); }
  // engine sound: rpm climbs through 5 gears
  const top = Math.max(10, b.t.top), k = clamp(sp / top, 0, 1) * 5, gear = Math.min(4, Math.floor(k));
  const rpm = clamp((k - gear) * 0.75 + 0.25 + Math.abs(inp.thr) * 0.1, 0, 1);
  engine(true, sp < 0.5 ? 0.1 + Math.abs(inp.thr) * 0.3 : rpm, Math.abs(inp.thr), b.t.engine, b.surf === SURF.ROAD || b.surf === SURF.TOWN ? b.slip : 0, !b.air && b.surf !== SURF.ROAD && b.surf !== SURF.TOWN ? Math.min(0.35, sp / 60) : 0);
}
function resetVehicle() {
  const c = mine();
  if (G.race && c && G.race.state === "go") { const p = G.race.resetPos(); teleportMe(p.x, p.z, p.yaw); SFX.flip(); return; }
  if (c) { unflip(c.b); SFX.flip(); }
}
function raceTick(dt) {
  const r = G.race, p = mine() ? mine().b : G.me.w;
  for (const e of r.update(dt, p)) {
    if (e.type === "count") { H.count(e.n); SFX.beep(); }
    else if (e.type === "go") { H.count("GO!"); SFX.go(); }
    else if (e.type === "cp") SFX.check();
    else if (e.type === "lap") { SFX.lap(); H.banner(e.lap === r.laps ? "FINAL LAP!" : "LAP " + e.lap, ""); }
    else if (e.type === "aiLand") fx.dust(e.a.x, e.a.y, e.a.z, 3);
    else if (e.type === "finish") {
      const prize = r.def.prize[e.place - 1] || 100;
      r.prize = prize; pay(prize); H.bumpMoney();
      const best = S.best[r.def.id]; r.newBest = !best || e.time < best; if (r.newBest) S.best[r.def.id] = Math.round(e.time * 10) / 10;
      if (e.place === 1) { S.wins[r.def.id] = (S.wins[r.def.id] || 0) + 1; SFX.win(); fx.confetti(p.x, p.y + 3, p.z, 120); H.banner("YOU WIN!", "+" + money(prize)); }
      else { (e.place <= 3 ? SFX.lap : SFX.lose)(); H.banner(H.ordinal(e.place) + " PLACE", "+" + money(prize)); }
      save();
    } else if (e.type === "results") UI.raceResults(r);
  }
}

// ---------------------------------------------------------------- camera + drawing
function updateCamera(dt) {
  const c = mine(), t = c ? c.b : G.me.w;
  const tw = c ? myTrailer() || (G.tow && G.tow.hitched === c.b ? G.tow : null) : null;
  let dist = (c ? 4.5 + c.m.len * 1.05 + (tw ? (tw.T ? tw.T.len : tw.len) * 0.8 : 0) : 6) * cam.zoom;
  // drag to look around; while driving it swings back behind you after a moment
  cam.yaw -= IN.look.dx * 0.006; cam.pitch = clamp(cam.pitch + IN.look.dy * 0.004, -0.05, 1.25);
  IN.look.dx = IN.look.dy = 0;
  if (IN.look.zoom) { cam.zoom = clamp(cam.zoom * (IN.look.zoom > 0 ? 1.12 : 0.89), 0.55, 2); IN.look.zoom = 0; }
  const dragging = performance.now() - IN.look.lastT < 1300;
  if (c && !dragging && G.mode !== "side") {
    const sp = speedOf(c.b), goal = c.b.yaw;
    if (sp > 1.5) cam.yaw += wrap(goal - cam.yaw) * Math.min(1, dt * (1.2 + sp * 0.08));
    cam.pitch += ((tw ? 0.4 : 0.28) - cam.pitch) * Math.min(1, dt * 0.8);
  }
  let tx = t.x, ty = t.y + (c ? 1.2 + (c.m.liftY || 0) : 1.4), tz = t.z;
  let px = tx - Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, pz = tz - Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist, py = ty + Math.sin(cam.pitch) * dist + 1.2;
  // shop screens get their own camera
  if (G.mode === "side" && G.panel === "dealer") { tx = -36; ty = 2.6; tz = -18; px = -36 + Math.sin(G.time * 0.25) * 2 + 8.5; py = 5.2; pz = -8.5; }
  if (G.mode === "side" && G.panel === "customs" && c) { const a = G.time * 0.3; tx = c.b.x; ty = c.b.y + 1.2; tz = c.b.z; px = tx + Math.sin(a) * (4 + c.m.len); pz = tz + Math.cos(a) * (4 + c.m.len); py = ty + 2.2; }
  if (G.mode === "side" && G.panel === "house" && G.houseView) {
    // look at the front of the house from a little to the side
    const h = G.houseView, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), sx = Math.cos(h.yaw), sz = -Math.sin(h.yaw);
    const d = { mansion: 40, farm: 42, family: 26, cabin: 24, camper: 18, lot: 30 }[h.id] || 26, k = h.id === "lot" ? 0 : 1;
    const hx = k ? h.x : h.garage.x, hz = k ? h.z : h.garage.z;
    tx = hx; ty = groundAt(hx, hz) + 3.5; tz = hz; px = hx + fx * d + sx * d * 0.55; pz = hz + fz * d + sz * d * 0.55; py = ty + d * 0.32;
  }
  // with a shop screen open on the left, center the view in the part you can see
  if (G.mode === "side" && innerWidth > 700) camera.setViewOffset(innerWidth, innerHeight, -Math.min(460, innerWidth) / 2, 0, innerWidth, innerHeight);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const gy = groundAt(px, pz) + 1.0; if (py < gy) py = gy;
  // don't let a hill get between the camera and you
  if (G.mode !== "side") { let lift = 0; for (let k = 0.25; k < 1.01; k += 0.15) { const x = tx + (px - tx) * k, z = tz + (pz - tz) * k, y = ty + (py - ty) * k; lift = Math.max(lift, (groundAt(x, z) + 0.9 - y) / k); } py += lift; }
  const k = cam.snap ? 1 : Math.min(1, dt * 10);
  cam.x += (px - cam.x) * k; cam.y += (py - cam.y) * k; cam.z += (pz - cam.z) * k;
  cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k; cam.snap = false;
  const sh = G.shake; G.shake = Math.max(0, G.shake - dt * 2.5);
  camera.position.set(cam.x + (Math.random() - 0.5) * sh * 0.5, cam.y + (Math.random() - 0.5) * sh * 0.5, cam.z);
  camera.lookAt(cam.tx, cam.ty, cam.tz);
  sky.sky.position.copy(camera.position);
  sky.follow(t.x, t.y, t.z);
}
function draw(dt) {
  const c = mine();
  // models
  for (const v of G.CARS.values()) if (!v.on) { placeModel(v.b); animateCar(v.m, { speed: v === c ? speedOf(v.b) : 0, reverse: v.b.vf < 0, steer: v.b.steer, wheelDrop: v.b.wheelDrop, boost: v.b.boost }, dt); }
  if (!c) {
    const w = G.me.w, p = G.me.p;
    p.root.position.set(w.x, w.y + (Math.abs(w.x) < 116 && Math.abs(w.z) < 106 ? 0.12 : 0), w.z); p.root.rotation.y = w.yaw;
    p.pose(w.air ? "jump" : w.moving > 7 ? "run" : w.moving > 0.5 ? "walk" : "stand", w.t, Math.min(1, w.moving / 4));
  }
  if (passenger) passenger.pose("wave", G.time);
  if (G.tow && G.tow.towCar.smoke) { G.tow.towCar.smoke.children.forEach((s, i) => { s.position.y = 1 + ((G.time * 0.8 + i * 0.4) % 1.6); s.scale.setScalar(0.6 + ((G.time * 0.8 + i * 0.4) % 1.6) * 0.6); }); }
  if (G.preview) { G.preview.root.rotation.y = G.time * 0.5; if (G.preview.wheels) animateCar(G.preview, { speed: 0, steer: 0 }, dt); }
  for (const bc of [jobBeacon, gpsBeacon]) if (bc.visible) { bc.userData.ring.rotation.z = G.time; bc.children[0].material.opacity = 0.22 + Math.sin(G.time * 4) * 0.08; }
  if (G.race) { G.race.hoop.rotation.z = 0; G.race.hoopRing.material.opacity = 0.6 + Math.sin(G.time * 6) * 0.3; }
  animateWorld(world, G.time, dt, camera.position, !!G.race);
  updateCamera(dt);
  renderer.render(scene, camera);
  hudTick(dt);
}
function hudTick(dt) {
  if (THUMB) return;
  document.body.classList.toggle("inmenu", G.mode === "side" || G.mode === "modal" || G.mode === "map");
  const c = mine(), b = c ? c.b : null, me = c ? c.b : G.me.w;
  const j = jobs.active;
  let target = null;
  if (G.race && !G.race.finished) { const n = G.race.nextCp(); target = { x: n.x, z: n.z, kind: "race" }; }
  else if (j) target = { ...jobs.target(), kind: "" };
  else if (G.waypoint) target = { ...G.waypoint, kind: "gps" };
  const vehicles = [...G.CARS.values()].filter((v) => !v.on && v !== c).map((v) => ({ x: v.b.x, z: v.b.z }));
  const g = { vehLabel: c ? vehicleById(c.s.id).name : "On foot", speed: b ? speedOf(b) : 0, topSpeed: b ? b.t.top : 30, driving: !!c, reverse: b && b.vf < -0.5, job: j, race: G.race, target, px: me.x, pz: me.z, camYaw: cam.yaw, pyaw: me.yaw, vehicles, trailerDots: [...G.TRS.values()].map((t) => ({ x: t.x, z: t.z })) };
  H.updateHud(g);
  miniT += dt; if (miniT > 0.08) { miniT = 0; H.drawMini(g); }
  if (G.mode === "map") H.drawBigMap(g);
  G.hudState = g;
  // hints for what you can press
  const list = [];
  if (G.mode === "play" || G.mode === "race") {
    const A = G.actions || {};
    if (G.hintT > 0 && G.hint) list.push({ key: "", text: G.hint, warn: true });
    if (!G.race) { if (A.E) list.push({ key: "E", text: A.E.text, warn: A.E.warn }); if (A.F) list.push({ key: "F", text: A.F.text }); if (A.T) list.push({ key: "T", text: A.T.text, warn: A.T.warn }); }
    if (G.race && G.race.state === "go" && c && (c.b.flipped || (G.race && Math.hypot(me.x - target?.x, me.z - target?.z) > 90))) list.push({ key: "R", text: "Back to the track" });
  }
  H.hints(list);
}
function syncSave() {
  for (const c of G.CARS.values()) { if (!c.on) { c.s.x = Math.round(c.b.x * 10) / 10; c.s.z = Math.round(c.b.z * 10) / 10; c.s.yaw = Math.round(c.b.yaw * 100) / 100; } c.s.on = c.on ? c.on.s.uid : null; }
  for (const t of G.TRS.values()) { t.s.x = t.x; t.s.z = t.z; t.s.yaw = t.yaw; let hu = null; for (const c of G.CARS.values()) if (t.hitched === c.b) hu = c.s.uid; t.s.hitched = hu; }
  const me = mine() ? mine().b : G.me.w; S.px = me.x; S.pz = me.z; S.driving = mine() ? mine().s.uid : null;
  if (G.race) { S.px = G.raceFrom.x; S.pz = G.raceFrom.z; }
  save();
}
addEventListener("beforeunload", () => { try { syncSave(); } catch {} });
document.addEventListener("visibilitychange", () => { if (document.hidden) try { syncSave(); } catch {} });

// first goals to help new players
function firstGoals() {
  if (S.stats.jobs === 1) setTimeout(() => H.toast("Nice work!", "Keep doing jobs. Save up $1,200 for an ATV at Valley Motors!", "good", 5000), 4800);
}

// ---------------------------------------------------------------- start up
async function boot() {
  try { await Promise.race([document.fonts.load('40px "Russo One"'), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  sky = makeSky(scene);
  world = buildWorld(scene);
  fx = new FX(scene);
  jobBeacon = beacon(0xffd23a); gpsBeacon = beacon(0xc86aff);
  H.setMapBase(mapCanvas(512));
  makeMe();
  for (const s of S.trailers) spawnTrailer(s);
  for (const s of S.cars) {
    const c = spawnCar(s);
    if (s.on && G.TRS.has(s.on)) { const tr = G.TRS.get(s.on); const sl = freeSlots(tr, sizeOf(c)); if (sl) { c.on = tr; loadOnto(tr, { uid: s.uid }, c.m, sl); } else s.on = null; }
  }
  for (const t of G.TRS.values()) if (t.s.hitched && G.CARS.has(t.s.hitched) && !G.CARS.get(t.s.hitched).on) t.hitched = G.CARS.get(t.s.hitched).b;
  jobs = new Jobs(jobApi);
  houseSigns();
  setMuted(!!S.muted); $("bMute").textContent = S.muted ? "🔇" : "🔊";
  initMenus(GAME);
  IN.initInput(canvas, {
    block: () => G.mode === "side" || G.mode === "modal" || G.mode === "map" || G.mode === "thumb",
    onTap: () => audio(),
    onKey: (k) => {
      audio();
      if (k === "Escape") { if (G.mode === "map") UI.closeMap(); else if (G.mode === "side" || G.mode === "modal") UI.close(); }
      if ((k === "KeyM") && (G.mode === "play" || G.mode === "race" || G.mode === "map")) UI.map();
      if ((k === "KeyP" || k === "Tab") && (G.mode === "play" || G.mode === "race")) UI.phone();
    },
  });
  $("bPhone").addEventListener("click", () => { audio(); UI.phone(); });
  $("bMap").addEventListener("click", () => { audio(); UI.map(); });
  $("bMute").addEventListener("click", () => { audio(); GAME.muted(!S.muted); });
  if (S.driving && G.CARS.has(S.driving) && !G.CARS.get(S.driving).on) { const c = G.CARS.get(S.driving); G.me.car = c; G.me.p.root.visible = false; cam.yaw = c.b.yaw; }
  for (const c of G.CARS.values()) if (c.m.rider) c.m.rider.root.visible = c === mine();
  $("loading").classList.add("hidden");
  if (THUMB) { thumbnail(); return; }
  $("hud").classList.remove("hidden");
  S.stats.played++; save();
  if (!S.intro && !TEST) UI.intro();
  requestAnimationFrame((t) => { last = t; frame(t); });
}

// ---------------------------------------------------------------- thumbnail mode (?thumb): a posed action shot + the title
function thumbnail() {
  G.mode = "thumb"; document.body.classList.add("thumb"); $("thumbTitle").classList.remove("hidden");
  for (const c of G.CARS.values()) c.m.root.visible = false;
  for (const t of G.TRS.values()) t.model.root.visible = false;
  G.me.p.root.visible = false;
  for (const k in world.markers) world.markers[k].g.visible = false;
  import("./thumb.js").then((m) => m.pose({ scene, camera, renderer, sky, fx, world })).catch((e) => console.error(e));
}

// ---------------------------------------------------------------- test hook
const MV = {
  get state() { const c = mine(), me = c ? c.b : G.me.w; return { mode: G.mode, money: S.money, driving: c ? c.s.id : null, x: me.x, y: me.y, z: me.z, speed: c ? speedOf(c.b) : 0, surf: c ? c.b.surf : null, cars: S.cars.map((s) => s.id), trailers: S.trailers.map((t) => t.type), houses: S.houses.slice(), job: jobs.active ? { type: jobs.active.type, stage: jobs.active.stage } : null, race: G.race ? { state: G.race.state, lap: G.race.lap, place: G.race.place, next: G.race.next, time: G.race.time, finished: G.race.finished } : null, flipped: c ? c.b.flipped : false, air: c ? c.b.air : false }; },
  S, G, GAME, UI, jobs: () => jobs, H,
  give(n) { pay(n); save(); return S.money; },
  teleport(x, z, yaw = 0) { teleportMe(x, z, yaw); },
  input: null,
  // drive with a fixed input for n steps (headless tests)
  drive(thr, steer, n = 60, hand = false) { const c = mine(); if (!c) return "on foot"; for (let i = 0; i < n; i++) { const b = stepCar(c.b, { thr, steer, hand }, DT); carEffects(c, b, { thr, steer, hand }, DT); carVsStuff(c.b); for (const t of G.TRS.values()) stepTrailer(t, DT); if (G.tow) stepTrailer(G.tow, DT); jobs.update(DT); if (G.race) raceTick(DT); fx.update(DT); G.time += DT; } return MV.state; },
  step(n = 1) { for (let i = 0; i < n; i++) tick(DT); },
  render() { draw(DT); },
  freeze(v = true) { G.frozen = v; },
  actions() { const a = actions(); return { E: a.E && a.E.text, F: a.F && a.F.text, T: a.T && a.T.text }; },
  press(k) { const a = actions(); if (a[k]) { a[k].fn(); return a[k].text; } return null; },
  enter(id) { const c = [...G.CARS.values()].find((v) => v.s.id === id && !v.on); if (c) { if (mine()) exitCar(); enterCar(c); } return !!c; },
  exit() { exitCar(); },
  startJob(type) { jobs.offers.unshift(jobs.makeOffer(type)); return jobs.take(0); },
  get job() { return jobs.active; },
  target() { return jobs.target(); },
  startRace(id) { GAME.startRace(id); return !!G.race; },
  get race() { return G.race; },
  sync() { syncSave(); },
  camYaw(v) { cam.yaw = v; cam.snap = true; },
  info() { return { ...renderer.info.render, quality, pixelRatio: renderer.getPixelRatio() }; },
};
window.MV = MV;
boot().catch((e) => { console.error(e); $("loading").querySelector("span").textContent = "Oops! Something went wrong: " + e.message; });
