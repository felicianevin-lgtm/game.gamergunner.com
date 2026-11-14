// MUD VALLEY RP (game.gamergunner.com/mudvalley/): a 3D open-world driving role-playing game.
// Drive on roads and muddy trails, do jobs for money, buy rides at the dealership, customize them, tow trailers,
// buy houses and win races. Progress is saved in this browser. Test hook: window.MV (see the bottom). ?thumb draws the thumbnail.
// Files: layout.js (the map plan), terrain.js (the ground), build.js + world.js (buildings, trees, the valley),
// vehicles.js (rides + models), physics.js (driving + walking), trailer.js, character.js (people), jobs.js, races.js,
// save.js, hud.js (on-screen info + maps), menus.js (shop screens), input.js (controls), sfx.js (sounds), fx.js (mud + dust),
// crime.js (robber + cop careers, blasters, wanted stars, jail), fishing.js (rods, casting, reeling, fish).
import * as THREE from "/create/vendor/three.module.js";
import { buildWorld, makeSky, animateWorld, recolorMarker, makeMarker } from "./world.js";
import { groundAt, mapCanvas, PATHS, SURF, nearestRoad, waterDepth, speedLimitAt } from "./terrain.js";
import { PLACES, HOUSES, WATER_Y, EDGE } from "./layout.js";
import { vehicleById, buildCar, applyLook, animateCar, newCar, brokenCar, PAINTS, loadBikeModel, BEDS } from "./vehicles.js";
import { makeBody, stepCar, placeModel, unflip, retune, makeWalker, stepWalker, bumpPair, speedOf, setPlatforms } from "./physics.js";
import { trailerById, makeTrailer, stepTrailer, hitchPoint, couplerPoint, freeSlots, loadOnto, cargoBoxes, makeTowable, trailerBack, stepDoor } from "./trailer.js";
import { makePerson, LOOKS, lookFor, makeRod, makeBlaster, makeTaser } from "./character.js";
import { Crime, ROB_SPOTS, blasterById, STUN_BLASTER, rankOf } from "./crime.js";
import { Fishing, rodById } from "./fishing.js";
import { Heist } from "./heist.js";
import { NPCs } from "./npcs.js";
import { Drops, PARTS, partById, addPart, have, SHIP_FEE } from "./parts.js";
import { RELAY, account } from "/create/js/net.js";
import { Interiors, buildingById, JAIL_SPOT, POCKET } from "./interiors.js";
import { MP } from "./mp.js";
import { FX } from "./fx.js";
import { SFX, audio, setMuted, engine } from "./sfx.js";
import { S, save, uid, slots, pay, spend, money, wipe } from "./save.js";
import { Jobs } from "./jobs.js";
import { Race, raceById } from "./races.js";
import { signTex, GARAGE_DOORS } from "./build.js";
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
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 900);
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
  shake: 0, hint: null, hintT: 0, siren: false, hold: null, lockWalk: false, aimT: 0, deepT: 0, rescueT: 0,
  // fast travel to your home (from the phone)
  goHome(h) { if (crime.noTeleport()) return; const yaw = h.yaw + Math.PI, f = freeSpot(h.garage.x, h.garage.z, yaw, mine() ? mine().m.len : 2); teleportMe(f.x, f.z, yaw); SFX.phone(); H.toast("Home sweet home!", h.name, "good"); },
};
let sky, world, fx, jobs, crime, fishing, interiors, mp, heist, npcs, drops;
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
  const p = makePerson(lookFor(S.role, S.gear.mask)); scene.add(p.root);
  G.me = { p, w: makeWalker(S.px, S.pz), car: null };
  G.me.w.isWalker = true;
}
// ---------------- going inside buildings (E at the front door)
const inside = () => !!(interiors && interiors.cur);
function goInside(bd, spot) {
  if (mine()) exitCar();
  if (fishing.busy) fishing.cancel();
  const p = interiors.enter(bd, spot), w = G.me.w;
  w.x = p.x; w.z = p.z; w.y = 0; w.vx = w.vz = w.vy = 0; w.air = false; w.yaw = p.yaw; cam.yaw = p.yaw; cam.pitch = 0.32; cam.snap = true;
  SFX.door(); H.flash("#000"); if (S.equip !== "blaster") G.me.p.hold(null); // (you put your stuff away inside: only a blaster stays out)
}
function goOutside() {
  const p = interiors.leaveRoom(); if (!p) return;
  const w = G.me.w; w.x = p.x; w.z = p.z; w.y = groundAt(p.x, p.z); w.vx = w.vz = 0; w.yaw = p.yaw; cam.yaw = p.yaw; cam.snap = true;
  SFX.door(); H.flash("#fff"); applyItem();
}
// where you are on the map (inside a building = at its front door)
function mapPos() { const c = mine(), b = c ? c.b : G.me.w; if (inside()) { const bd = interiors.cur.bd; return { x: bd.dx, y: groundAt(bd.dx, bd.dz), z: bd.dz, vx: 0, vz: 0, yaw: bd.out }; } return b; }
const MENUS = { pawn: () => UI.pawn(), dealer: () => UI.dealer(), jobs: () => UI.jobs(), gear: () => UI.gear(), blasters: () => UI.blasters(), bait: () => UI.bait(), police: () => UI.police(), hideout: () => UI.hideout() };
function insideActions(out) {
  const R = interiors.cur, w = G.me.w, l = interiors.local(w), bd = R.bd;
  if (itemsOwned().includes("blaster")) out.Q = { text: "Shoot", fn: useItem };
  if (l.z > bd.d / 2 - 1.7 && Math.abs(l.x) < 1.5) { out.E = { text: "Leave " + bd.name, fn: goOutside }; return out; }
  out.E = crime.robAction({ x: l.x, z: l.z, room: bd.id }) || heist.action(l);
  if (out.E) return out;
  for (const sp of R.spots) {
    if (Math.hypot(sp.x - l.x, sp.z - l.z) > sp.r) continue;
    if (sp.act === "menu") out.E = { text: { dealer: "Talk to the sales clerk (buy rides)", jobs: "Look at the Job Board", gear: "Shop for robber gear", blasters: "Shop for guns", bait: "Buy rods + sell your fish", police: "Talk to the desk sergeant", pawn: "Sell stuff to the pawn broker 💰", hideout: "Look at the secret map (stash loot)" }[bd.menu] || "Talk", fn: MENUS[bd.menu] };
    else if (sp.act === "chat") out.E = { text: "Say hi to the " + (bd.keeper || "neighbor").toLowerCase(), fn: () => { SFX.phone(); H.toast("“" + (sp.say || "Hi there! Welcome to " + bd.name + "!") + "”", bd.keeper || "", "", 3200); } };
    else if (sp.act === "snack") out.E = { text: "Buy a snack ($5)", fn: () => { if (spend(5)) { SFX.cash(); H.bumpMoney(); H.toast("Yum! 🍪", "That hit the spot.", "good", 1800); save(); } else SFX.nope(); } };
    else if (sp.act === "sleep") out.E = { text: S.houses.includes(bd.house.id) ? "Take a nap" : "Test the bed", fn: () => { H.flash("#000"); SFX.phone(); H.toast("Zzz... good morning!", "Nothing beats a nap.", "good", 2400); } };
    else if (sp.act === "tour") out.E = { text: "Buy this house (" + money(bd.house.price) + ")", fn: () => UI.house(bd.house) };
    if (out.E) break;
  }
  if (!out.E && bd.kind === "home" && !S.houses.includes(bd.house.id)) G.hint = G.hint || null;
  return out;
}
// ---------------- things you hold (X switches: empty hands -> blaster -> fishing rod -> spike strips)
const itemModels = {};
function itemsOwned() {
  const L = ["none"];
  if (S.blaster || S.role === "cop") L.push("blaster");
  if (S.rod) L.push("rod");
  if (S.role === "cop") L.push("taser", "spikes");
  return L;
}
const ITEM_NAME = { none: "Empty hands", blaster: "Blaster", rod: "Fishing rod", spikes: "Spike strips", taser: "Taser" };
function applyItem() {
  if (!itemsOwned().includes(S.equip)) S.equip = "none";
  let m = null;
  if (S.equip === "blaster") { const bl = blasterById(S.blaster) || STUN_BLASTER, k = "b" + bl.id; m = itemModels[k] || (itemModels[k] = makeBlaster(bl.tier)); }
  if (S.equip === "rod") { const r = rodById(S.rod), k = "r" + r.id; m = itemModels[k] || (itemModels[k] = makeRod(r.color)); }
  if (S.equip === "taser") m = itemModels.taser || (itemModels.taser = makeTaser());
  G.me.p.hold(m);
  document.body.classList.toggle("hasItem", S.equip !== "none");
}
function cycleItem() {
  if (fishing.busy) fishing.cancel();
  let L = itemsOwned();
  if (inside()) { L = L.filter((k) => k === "none" || k === "blaster"); if (L.length < 2) { SFX.nope(); H.toast("Not inside!", "Only a gun can come out indoors.", "warn", 1800); return; } }
  if (L.length < 2) { SFX.nope(); H.toast("Nothing to hold yet", "Buy a gun at the Gun Shop or a fishing rod at the Bait & Tackle.", "warn"); return; }
  S.equip = L[(L.indexOf(S.equip) + 1) % L.length]; applyItem(); SFX.click();
  const tip = { none: "", blaster: "Q = shoot (it aims for you!)", rod: "Face the water and press Q to cast", spikes: "Q = drop a spike strip", taser: "Q = zap! (short range, it aims for you)" }[S.equip];
  H.toast("🔄 " + ITEM_NAME[S.equip], tip, "", 2200);
}
function useItem() {
  const c = mine();
  if (inside()) { if (S.equip !== "blaster" && itemsOwned().includes("blaster") && !crime.jail) { S.equip = "blaster"; applyItem(); } // (Q indoors: out comes your gun)
    if (S.equip === "blaster" && !crime.ko && !crime.jail) { const y = cam.yaw; if (heist.fire(y)) { G.me.w.yaw = y; G.aimT = 0.4; } } return; }
  if (c) { if (S.role === "cop") crime.dropSpikes(); return; }
  if (crime.ko || crime.jail) return;
  if (S.equip === "blaster") { const y = cam.yaw; if (crime.fire(y)) { G.me.w.yaw = y; G.aimT = 0.4; } }
  else if (S.equip === "rod") fishing.press();
  else if (S.equip === "spikes") crime.dropSpikes();
  else if (S.equip === "taser") { const y = cam.yaw; if (crime.tase(y)) { G.me.w.yaw = y; G.aimT = 0.5; } }
  else if (itemsOwned().length > 1) H.toast("Your hands are empty", "Press X to take out your " + itemsOwned().slice(1).map((k) => ITEM_NAME[k].toLowerCase()).join(" or ") + ".", "", 2600);
}
// the police car you get as a cop (it isn't one of your garage rides)
const POLICE_UID = -1;
function policeCar() { return G.CARS.get(POLICE_UID) || null; }
function spawnPoliceCar(x = 420, z = -333, yaw = Math.PI / 2) {
  if (policeCar()) return policeCar();
  const id = S.cop.car === "interceptor" && S.cop.interceptor ? "interceptor" : "cruiser";
  const s = newCar(id, POLICE_UID); Object.assign(s, { x, z, yaw, tires: "allterrain" });
  const c = spawnCar(s); c.police = true; if (c.m.rider) c.m.rider.root.visible = false; return c;
}
function removePoliceCar() {
  const c = policeCar(); if (!c) return;
  if (c === mine()) exitCar();
  for (const t of G.TRS.values()) if (t.hitched === c.b) { t.hitched = null; t.s.hitched = null; }
  scene.remove(c.m.root); G.CARS.delete(POLICE_UID); G.siren = false;
}
// golden light beams over the career's main places (they glow on the maps too: hud.js HOT)
function hotBeacons(r) {
  G.hot = G.hot || {};
  for (const id of Object.keys(G.hot)) { scene.remove(G.hot[id]); delete G.hot[id]; }
  for (const id of Object.keys(H.HOT[r] || {})) { const p = PLACES[id]; if (id.startsWith("pawn")) continue; if (!p) continue; const bc = beacon(0xffd23a); setBeacon(bc, p); bc.children[0].scale.set(0.8, 1, 0.8); G.hot[id] = bc; }
}
function roleChanged(r) {
  G.me.p.setLook(lookFor(r, S.gear.mask)); if (mp) { mp.sendLook(); mp.sendRole(); }
  hotBeacons(r);
  if (r === "robber") {
    const shop = !S.blaster ? "blasters" : !S.gear.drill ? "gear" : null;
    if (shop) { GAME.setWaypoint({ x: PLACES[shop].x, z: PLACES[shop].z, name: PLACES[shop].name }); setTimeout(() => H.toast("🌟 " + (shop === "blasters" ? "The Gun Shop" : "The Tool Barn") + " is on your map!", shop === "blasters" ? "Get a gun to hold up the teller. Then get tools at the Tool Barn next door." : "Get the Super Drill for the bank vault.", "good", 5000), 1600); }
  }
  if (r === "cop") { const c = spawnPoliceCar(); H.toast("👮 Your police car is ready", "It’s parked at the Police Station. Hop in (F) and press G for the siren!", "good", 4200); }
  else removePoliceCar();
  applyItem();
}
function enterCar(c) {
  if (c.on) return;
  if (fishing && fishing.busy) fishing.cancel();
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
  b.vx *= 0.3; b.vz *= 0.3; if (c.police) G.siren = false;
  SFX.door(); engine(false);
  S.driving = null;
  parkOnTrailer(c);
}
function teleportMe(x, z, yaw) {
  if (interiors && interiors.cur && Math.abs(x) < 1000) interiors.leaveRoom();
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
  const out = { E: null, F: null, T: null, Q: null };
  const c = mine(), me = c ? c.b : G.me.w;
  // jail + knocked out: not much you can do
  if (crime.jail) { out.E = { text: "Jail break! Press E when the needle is in the green", fn: () => crime.jailTry() }; return out; }
  if (crime.ko) return out;
  if (inside()) return insideActions(out);
  // Q: use what you're holding
  if (c) { if (S.role === "cop") out.Q = { text: "Drop a spike strip (" + S.cop.spikes + ")", fn: useItem }; }
  else if (S.equip === "blaster") out.Q = { text: "Shoot", fn: useItem };
  else if (S.equip === "rod") out.Q = fishing.state === "bite" ? { text: "HOOK IT!", fn: useItem } : fishing.state === "reel" ? { text: "Hold to reel in", fn: () => {} } : fishing.state === "wait" ? { text: "Waiting for a bite... (Q = reel in)", fn: useItem } : fishing.busy ? null : { text: fishing.waterAhead() ? "Cast your line" : "Face the water to fish", warn: !fishing.waterAhead(), fn: useItem };
  else if (S.equip === "spikes") out.Q = { text: "Drop a spike strip (" + S.cop.spikes + ")", fn: useItem };
  else if (S.equip === "taser") out.Q = { text: "Zap with the taser ⚡", fn: useItem };
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
  // T on a dirt bike or a quad (when there's no trailer to hitch): wheelie!
  if (c && !out.T && c.b.t.wheelie && !G.race) out.T = { text: c.b.wheelie ? "Stop the wheelie" : "Wheelie! (keep holding W)", fn: () => { G.wheelieTap = true; } };
  // E: ride a dirt bike / quad into a truck bed, or take it back out
  const v0 = c && vehicleById(c.s.id);
  if (c && (v0.bike || v0.quad)) {
    for (const t of G.CARS.values()) {
      if (t === c || t.on || !BEDS[t.s.id]) continue;
      const bp = bedPoint(t); if (Math.hypot(bp.x - me.x, bp.z - me.z) > 4.5) continue;
      const h = bedHost(t);
      out.E = h.loaded.length ? { text: "This truck bed is full", warn: true, fn: () => SFX.nope() } : { text: "Ride into the " + vehicleById(t.s.id).name + "'s bed", fn: () => loadBed(c, t) };
      break;
    }
  }
  if (!c && !out.E) for (const t of G.CARS.values()) {
    if (!t.bedHost || !t.bedHost.loaded.length || t.on) continue;
    const bp = bedPoint(t); if (Math.hypot(bp.x - me.x, bp.z - me.z) > 4) continue;
    const u = t.bedHost.loaded[0].uid; out.E = { text: "Take the " + vehicleById(G.CARS.get(u).s.id).name + " out of the bed", fn: () => unloadBed(t.bedHost) }; break;
  }
  // E: load / unload trailers
  if (c && sizeOf(c) <= 2 && !out.E) {
    for (const tr of G.TRS.values()) {
      if (tr.hitched === c.b || !near(tr, me, tr.T.enclosed ? 10.5 : 6.5)) continue;
      if (tr.T.enclosed && !tr.s.open) { out.E = { text: "Open the trailer door", fn: () => trailerDoor(tr, true) }; break; }
      const sl = freeSlots(tr, sizeOf(c));
      out.E = sl ? { text: "Drive up the ramp onto the " + tr.T.name + ", then get out", warn: true, fn: () => SFX.nope() } : { text: sizeOf(c) > tr.T.maxSize ? "Too big for this trailer" : "Trailer is full", warn: true, fn: () => SFX.nope() };
      break;
    }
  }
  if (!c) for (const tr of G.TRS.values()) {
    if (!near(tr, me, tr.T.enclosed ? 7.5 : 6.5)) continue;
    if (tr.T.enclosed) { // (the big box trailer: open the door, then unload; T closes it)
      if (!tr.s.open) { out.E = { text: "Open the trailer door", fn: () => trailerDoor(tr, true) }; break; }
      out.T = { text: "Close the trailer door", fn: () => trailerDoor(tr, false) };
      if (!tr.loaded.length) { out.E = { text: "Close the trailer door", fn: () => trailerDoor(tr, false) }; break; }
    }
    if (tr.loaded.length) { const last = tr.loaded[tr.loaded.length - 1]; out.E = { text: "Unload " + vehicleById(G.CARS.get(last.uid).s.id).name, fn: () => unloadCar(tr) }; break; }
  }
  // E: open a SkyDrop delivery box
  if (!c && !out.E && drops) { const bx = drops.near(me.x, me.z); if (bx) out.E = { text: "📦 Open your SkyDrop box", fn: () => openDrop(bx) }; }
  // E: robbing, cuffing, booking (hold E)
  const cme = { x: me.x, z: me.z, inCar: !!c };
  if (!out.E) out.E = crime.bookAction(cme) || crime.cuffAction(cme) || (c ? null : crime.robAction(cme) || npcs.bagAction(cme));
  if (!out.E && !c) { const bd = interiors.doorNear(me.x, me.z); if (bd) out.E = { text: (bd.kind === "home" ? (S.houses.includes(bd.house.id) ? "Go inside your house" : "Take a tour: " + bd.name) : "Go inside " + bd.name), fn: () => goInside(bd) }; }
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
      if (id === "police") { out.E = { text: "Enter the Police Station", fn: () => UI.police() }; break; }
      if (id === "gear") { out.E = { text: "Shop at the Tool Barn", fn: () => UI.gear() }; break; }
      if (id === "blasters") { out.E = { text: "Shop at the Gun Shop", fn: () => UI.blasters() }; break; }
      if (id === "parts") { out.E = { text: "Shop at Valley Parts", fn: () => UI.parts() }; break; }
      if (id === "bait") { out.E = { text: "Bait & Tackle: rods + sell fish", fn: () => UI.bait() }; break; }
      if (id === "hideout") { out.E = S.role === "robber" ? { text: S.loot ? "Stash your loot (" + money(S.loot) + ")" : "Robber Hideout", fn: () => UI.hideout() } : { text: "A spooky old shack...", fn: () => UI.hideout() }; break; }
    }
  }
  return out;
}
// trailers: you DRIVE your ride up the ramp to load it (the big box trailer's door has to be open). Lined up behind the
// trailer, it lets you through; once you're past the back edge, the ride parks on the deck and you hop out.
const deckBack = (t) => ({ utility: -1.7, flatbed: -4.8, enclosed: -3.6 })[t.T.id] ?? -2;
const deckFront = (t) => ({ utility: 2.0, flatbed: 4.6, enclosed: 3.0 })[t.T.id] ?? 2;
const rampLen = (t) => ({ utility: 1.3, flatbed: 1.8, enclosed: 2.9 })[t.T.id] ?? 1.5;
// how high the trailer's deck / ramp is at a spot (or -Infinity if you're not on it). Cars + people drive up it.
function deckAt(x, z) {
  let best = -Infinity;
  for (const t of G.TRS.values()) {
    if (Math.abs(x - t.x) > 10 || Math.abs(z - t.z) > 10) continue;
    const p = trailerLocal(t, x, z); if (Math.abs(p.lx) > 1.3) continue;
    const back = deckBack(t), top = t.y + t.T.deckY;
    if (p.lz >= back && p.lz <= deckFront(t)) best = Math.max(best, top);
    else if (p.lz < back && p.lz > back - rampLen(t) && (!t.T.enclosed || t.doorA > 1.2)) best = Math.max(best, top - t.T.deckY * ((back - p.lz) / rampLen(t)));
  }
  return best;
}
setPlatforms(deckAt);
// is this ride sitting on a trailer's deck?
function onDeck(c, t) { const p = trailerLocal(t, c.b.x, c.b.z); return Math.abs(p.lx) < 1.4 && p.lz > deckBack(t) + c.m.len / 2 - 0.6 && p.lz < deckFront(t) + 0.3; }
function trailerLocal(t, x, z) { const dx = x - t.x, dz = z - t.z, c = Math.cos(t.yaw), s = Math.sin(t.yaw); return { lx: dx * c - dz * s, lz: dx * s + dz * c }; }
function canDriveIn(t, c) {
  if (!c || t.hitched === c.b) return false;
  if (t.T.enclosed && !(t.s.open && t.doorA > 1.2)) return false;
  if (!freeSlots(t, sizeOf(c))) return false;
  const p = trailerLocal(t, c.b.x, c.b.z), dy = Math.abs(Math.atan2(Math.sin(c.b.yaw - t.yaw), Math.cos(c.b.yaw - t.yaw)));
  return Math.abs(p.lx) < 1.5 && p.lz < deckBack(t) + 2.5 && (dy < 0.7 || dy > Math.PI - 0.7);
}
function driveInTrailers() {
  const c = mine(); if (!c || sizeOf(c) > 2) return;
  for (const t of G.TRS.values()) {
    if (t.hitched === c.b) continue;
    const p = trailerLocal(t, c.b.x, c.b.z);
    if (Math.abs(p.lx) > 1.6 || p.lz < deckBack(t) - 0.5 || p.lz > deckFront(t) + 1) continue;
    // up on the deck: the front wall stops you, the side walls keep you lined up
    const maxZ = deckFront(t) - c.m.len / 2 - 0.1, c0 = Math.cos(t.yaw), s0 = Math.sin(t.yaw);
    let lz = Math.min(p.lz, maxZ), lx = Math.max(-0.5, Math.min(0.5, p.lx));
    if (lz !== p.lz || lx !== p.lx) {
      c.b.x = t.x + lx * c0 + lz * s0; c.b.z = t.z - lx * s0 + lz * c0;
      const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw), vf = c.b.vx * fx + c.b.vz * fz; if (lz === maxZ && vf > 0) { c.b.vx -= fx * vf; c.b.vz -= fz * vf; }
    }
    if (onDeck(c, t) && !t.hintT) { t.hintT = 1; H.toast("On the trailer!", "Get out (F) to park it here.", "good", 2500); }
  }
}
function onDeckZone(t, c) { if (sizeOf(c) > 2 || !freeSlots(t, sizeOf(c))) return false; const p = trailerLocal(t, c.b.x, c.b.z); return Math.abs(p.lx) < 1.6 && p.lz > deckBack(t) - 0.5 && p.lz < deckFront(t) + 1; }
// you got out: a ride sitting on a trailer deck parks there for real (strapped down, so it rides along when you tow)
function parkOnTrailer(c) {
  if (sizeOf(c) > 2) return;
  for (const t of G.TRS.values()) {
    if (t.hitched === c.b || !onDeck(c, t)) continue;
    const sl = freeSlots(t, sizeOf(c)); if (!sl) continue;
    c.on = t; c.s.on = t.s.uid; c.b.vx = c.b.vz = 0; scene.remove(c.m.root); loadOnto(t, { uid: c.s.uid }, c.m, sl); t.hintT = 0;
    const w = G.me.w, back = deckBack(t) - rampLen(t) - 0.8; w.x = t.x + Math.sin(t.yaw) * back; w.z = t.z + Math.cos(t.yaw) * back; w.y = groundAt(w.x, w.z);
    SFX.load(); H.toast("Parked!", t.T.enclosed ? "Press T to close the door, then hook it to your truck." : "Hook the trailer to your truck (T) and tow it away.", "good"); save();
    return;
  }
}
// house garage doors roll up when it's your house and you come close
function stepGarageDoors(dt) {
  const me = mapPos();
  for (const d of GARAGE_DOORS) {
    const dist = Math.abs(me.x - d.x) + Math.abs(me.z - d.z);
    if (dist > 60 && d.open === 0) continue;
    const tgt = d.house && S.houses.includes(d.house) && !inside() && Math.hypot(me.x - d.x, me.z - d.z) < 16 ? 1 : 0;
    if (tgt !== d.tgt) { d.tgt = tgt; if (dist < 30) SFX.door(); }
    d.open += Math.sign(tgt - d.open) * Math.min(Math.abs(tgt - d.open), dt * 0.9);
    d.g.position.y = d.y0 + d.open * (d.h - 0.25); d.g.scale.y = 1 - d.open * 0.9;
    d.col.top = d.open > 0.8 ? -1e9 : d.y0 + 99;
  }
}
function trailerDoor(tr, open) { tr.s.open = open; SFX.hitch(); save(); }
function loadCar(c, tr, sl) {
  exitCar();
  const w = G.me.w, sx = Math.cos(tr.yaw), sz = -Math.sin(tr.yaw);
  w.x = tr.x + sx * 2.8; w.z = tr.z + sz * 2.8;
  c.on = tr; c.s.on = tr.s.uid; c.b.vx = c.b.vz = 0;
  loadOnto(tr, { uid: c.s.uid }, c.m, sl);
  SFX.load(); H.toast("Loaded!", tr.T.enclosed ? "Press T to close the door, then hook it to your truck." : "Now hop in your truck (F) and tow it away.", "good"); save();
}
function unloadCar(tr) {
  const e = tr.loaded.pop(); const c = G.CARS.get(e.uid);
  tr.model.deck.remove(c.m.root); scene.add(c.m.root);
  const back = trailerBack(tr.T), b = c.b;
  b.yaw = tr.yaw; b.x = tr.x - Math.sin(tr.yaw) * (back + c.m.len / 2 + 1); b.z = tr.z - Math.cos(tr.yaw) * (back + c.m.len / 2 + 1);
  const f = freeSpot(b.x, b.z, b.yaw, c.m.len); b.x = f.x; b.z = f.z;
  c.on = null; c.s.on = null; settle(b);
  SFX.load(); save();
}
// ---- truck beds: a dirt bike or quad rides along in the back of a pickup
function bedPoint(t) { const B = BEDS[t.s.id], fx = Math.sin(t.b.yaw), fz = Math.cos(t.b.yaw), back = -t.m.len / 2 - 1.2; return { x: t.b.x + fx * back, z: t.b.z + fz * back, mid: B }; }
function bedHost(t) {
  if (!t.bedHost) t.bedHost = { bed: true, truck: t, loaded: [], model: { deck: t.m.body }, s: { uid: "bed" + t.s.uid }, get x() { return t.b.x; }, get z() { return t.b.z; }, get yaw() { return t.b.yaw; } };
  return t.bedHost;
}
function putInBed(c, t) {
  const B = BEDS[t.s.id], h = bedHost(t), v = vehicleById(c.s.id);
  scene.remove(c.m.root); t.m.body.add(c.m.root);
  if (v.bike) { c.m.root.position.set(0.05, B.y, B.z + 0.05); c.m.root.rotation.set(0, 0.62, 0.1); } // (corner to corner, leaning a little, so it fits)
  else { c.m.root.position.set(0, B.y, B.z); c.m.root.rotation.set(0, 0, 0); }
  h.loaded.push({ uid: c.s.uid, slots: [0], model: c.m }); c.on = h; c.s.on = null; c.s.bed = t.s.uid; c.b.vx = c.b.vz = 0;
}
function loadBed(c, t) {
  exitCar(); putInBed(c, t);
  const w = G.me.w, sx = Math.cos(t.b.yaw), sz = -Math.sin(t.b.yaw); w.x = t.b.x + sx * 2.2; w.z = t.b.z + sz * 2.2;
  SFX.load(); H.toast("In the bed!", "Hop in the " + vehicleById(t.s.id).name + " (F) and drive. Press E at the back to take it out.", "good", 3200); save();
}
function unloadBed(h) {
  const e = h.loaded.pop(); if (!e) return; const c = G.CARS.get(e.uid), t = h.truck;
  t.m.body.remove(c.m.root); scene.add(c.m.root);
  const b = c.b, back = t.m.len / 2 + c.m.len / 2 + 0.8; b.yaw = t.b.yaw + Math.PI;
  b.x = t.b.x - Math.sin(t.b.yaw) * back; b.z = t.b.z - Math.cos(t.b.yaw) * back;
  const f = freeSpot(b.x, b.z, b.yaw, c.m.len); b.x = f.x; b.z = f.z;
  c.on = null; c.s.bed = null; settle(b); SFX.load(); save();
}
// ---- parts: buy, order by drone, open boxes, build a ride
function openDrop(bx) {
  const items = drops.open(bx), n = {}; for (const id of items) n[id] = (n[id] || 0) + 1;
  SFX.cash(); fx.confetti(bx.d.x, groundAt(bx.d.x, bx.d.z) + 1, bx.d.z, 40);
  H.toast("📦 You got:", Object.entries(n).map(([id, k]) => (k > 1 ? k + "× " : "") + partById(id).name).join(", "), "good", 4500);
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
  buyCar(id, color) {
    const v = vehicleById(id);
    if (S.cars.length >= slots()) { H.toast("Your garage is full!", "Buy a bigger house to own more rides (or sell one).", "warn"); SFX.nope(); return false; }
    if (!spend(v.price)) { SFX.nope(); H.toast("Not enough money", "Do some jobs to earn " + money(v.price - S.money) + " more.", "warn"); return false; }
    const s = newCar(id, uid()); s.yaw = Math.PI; if (color != null) s.paint = color;
    const f = freeSpot(-36, 12, Math.PI, 5); s.x = f.x; s.z = f.z;
    S.cars.push(s); const c = spawnCar(s);
    if (mine()) exitCar();
    if (inside()) { interiors.leaveRoom(); applyItem(); H.flash("#fff"); } // (walk out of the showroom and straight into your new ride)
    enterCar(c); SFX.buy(); H.bumpMoney(); fx.confetti(s.x, groundAt(s.x, s.z) + 2, s.z, 60);
    H.banner("NEW RIDE!", v.name); save(); return true;
  },
  buyTrailer(type, color) {
    const T = trailerById(type);
    if (!spend(T.price)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; }
    const s = { uid: uid(), type, x: -60, z: -16, yaw: 0, hitched: null };
    if (T.enclosed) { s.color = color ?? 0x1a1a1e; s.open = false; }
    const f = freeSpot(-60, 14, 0, T.len * 2); s.x = f.x; s.z = f.z;
    S.trailers.push(s); spawnTrailer(s); SFX.buy(); H.bumpMoney();
    H.toast(T.name + " bought!", "It's parked by the dealership. Back your truck up to it and press T.", "good", 5000); save(); return true;
  },
  sellCar(u) {
    const c = G.CARS.get(u); if (!c || S.cars.length <= 1) return false;
    if (c === mine()) exitCar();
    if (c.on) { const tr = c.on; const i = tr.loaded.findIndex((e) => e.uid === u); tr.loaded.splice(i, 1); tr.model.deck.remove(c.m.root); }
    if (c.bedHost && c.bedHost.loaded.length) unloadBed(c.bedHost); // (selling a truck: the bike in the back stays yours)
    for (const t of G.TRS.values()) if (t.hitched === c.b) { t.hitched = null; t.s.hitched = null; }
    scene.remove(c.m.root); G.CARS.delete(u); S.cars = S.cars.filter((s) => s.uid !== u);
    pay(Math.round(vehicleById(c.s.id).price * 0.5)); SFX.cash(); save(); return true;
  },
  bringCar(u, h, drive) {
    const c = G.CARS.get(u); if (!c || crime.noTeleport()) return;
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
    const t = G.TRS.get(u); if (!t || crime.noTeleport()) return; t.hitched = null; t.s.hitched = null;
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
  // sell a house back for 60% of what it cost (you need room left for all your rides)
  sellHouse(h) {
    if (!S.houses.includes(h.id) || !h.price) return false;
    const rest = S.houses.filter((x) => x !== h.id), room = Math.max(...rest.map((id) => (HOUSES.find((q) => q.id === id) || HOUSES[0]).slots));
    if (S.cars.length > room) { SFX.nope(); H.toast("Too many rides!", "Your other houses only fit " + room + " rides. Sell " + (S.cars.length - room) + " first.", "warn", 3500); return false; }
    S.houses = rest;
    if (S.home === h.id) S.home = rest.reduce((a, id) => ((HOUSES.find((q) => q.id === id) || HOUSES[0]).slots > (HOUSES.find((q) => q.id === a) || HOUSES[0]).slots ? id : a), "lot");
    const cash = Math.round(h.price * 0.6); pay(cash); houseSigns(); SFX.cash(); H.bumpMoney(); H.toast("🏠 Sold " + h.name, "+" + money(cash), "cash", 3000); save(); return true;
  },
  // customizing the vehicle you're in
  // ---- car parts
  buyPart(id) { const p = partById(id); if (!p || !spend(p.price)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; } addPart(id); SFX.cash(); H.bumpMoney(); save(); return true; },
  cartAdd(id) { if (S.cart.length >= 12) { SFX.nope(); H.toast("Cart is full", "A drone can only carry 12 parts at a time.", "warn"); return; } S.cart.push(id); SFX.click(); save(); },
  cartRemove(i) { S.cart.splice(i, 1); SFX.click(); save(); },
  orderCart() {
    if (!S.cart.length) return false;
    const sub = S.cart.reduce((a, id) => a + partById(id).price, 0), total = sub + SHIP_FEE(sub);
    if (!spend(total)) { SFX.nope(); H.toast("Not enough money", "You need " + money(total - S.money) + " more.", "warn"); return false; }
    drops.order(S.cart.slice()); S.cart = []; SFX.buy(); H.bumpMoney();
    H.toast("🚁 Order placed!", "A SkyDrop drone is on its way to you. Look up!", "good", 3500); save(); return true;
  },
  // put the parts together in your garage
  buildRide(h, o) {
    const fr = partById(o.frame), mo = partById(o.motor), ti = partById(o.tires);
    const need = [o.frame, o.motor, o.tires, "p_seat", ...(fr && fr.body ? ["p_body"] : []), ...(o.lift ? ["p_lift"] : [])];
    const cnt = {}; for (const id of need) cnt[id] = (cnt[id] || 0) + 1;
    if (!fr || !mo || !ti || Object.entries(cnt).some(([id, k]) => have(id) < k)) { SFX.nope(); H.toast("Missing parts!", "Check the list: you need every part.", "warn"); return false; }
    if (S.cars.length >= slots()) { H.toast("Your garage is full!", "Sell a ride or buy a bigger house first.", "warn"); SFX.nope(); return false; }
    for (const id of need) addPart(id, -1);
    const s = newCar(fr.model, uid()); Object.assign(s, { paint: o.color ?? s.paint, engine: mo.lv, maxEngine: mo.lv, tires: ti.tires, ownTires: ["street", ti.tires], lift: o.lift ? 1 : 0, maxLift: o.lift ? 1 : 0, rust: 0, built: true,
      rims: o.rims || "chrome", neon: o.neon || 0, ownNeon: [0, o.neon || 0], name: String(o.name || "").trim().slice(0, 24) || undefined });
    const yaw = h.yaw + Math.PI, f = freeSpot(h.garage.x, h.garage.z, yaw, 6); s.x = f.x; s.z = f.z; s.yaw = yaw;
    S.cars.push(s); const c = spawnCar(s); fx.confetti(s.x, groundAt(s.x, s.z) + 2, s.z, 80); SFX.buy();
    H.banner("YOU BUILT IT!", vehicleById(s.id).name + " · " + mo.name); save(); return c;
  },
  // ---- the build contest: enter a ride you built; the 🛠 Dev menu picks 3 winners, and everyone can buy those here
  enterContest(u) {
    const s = S.cars.find((c) => c.uid === u); if (!s || !s.built) return Promise.resolve(false);
    const a = account(), b = { base: s.id, name: s.name || "", paint: s.paint, rims: s.rims, tires: s.tires, engine: s.engine, lift: s.lift, neon: s.neon };
    return fetch(RELAY + "/mv/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ b, by: a ? a.u : "" }) }).then((r) => r.json()).then((r) => {
      if (r.ok) { s.entered = true; save(); SFX.buy(); H.toast("🏆 Entered!", "The GunnerVerse team will look at your build. If it wins, everyone can buy it at Valley Motors!", "good", 4500); return true; }
      H.toast("Couldn't enter it", r.e === "slowdown" ? "You entered a lot of builds. Try again later." : "Try again in a bit.", "warn"); return false;
    }).catch(() => { H.toast("Couldn't reach GunnerVerse", "Check your internet and try again.", "warn"); return false; });
  },
  get winners() { return G.winners || []; },
  buyWinner(i) {
    const w = (G.winners || [])[i]; if (!w) return false; const v = vehicleById(w.base), price = Math.round(v.price * 1.25 / 100) * 100;
    if (S.cars.length >= slots()) { H.toast("Your garage is full!", "Buy a bigger house to own more rides (or sell one).", "warn"); SFX.nope(); return false; }
    if (!spend(price)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; }
    const s = newCar(w.base, uid()); Object.assign(s, { paint: w.paint, rims: w.rims, tires: w.tires, ownTires: ["street", w.tires], engine: w.engine, maxEngine: w.engine, lift: v.bike ? Math.min(1, w.lift) : w.lift, maxLift: w.lift, neon: w.neon, ownNeon: [0, w.neon], rust: 0, name: w.name, by: w.by });
    s.yaw = Math.PI; const f = freeSpot(-36, 12, Math.PI, 5); s.x = f.x; s.z = f.z; S.cars.push(s); const c = spawnCar(s);
    if (mine()) exitCar(); if (inside()) { interiors.leaveRoom(); applyItem(); H.flash("#fff"); }
    enterCar(c); SFX.buy(); H.bumpMoney(); fx.confetti(s.x, groundAt(s.x, s.z) + 2, s.z, 60); H.banner("NEW RIDE!", w.name + " (built by " + w.by + ")"); save(); return true;
  },
  winnerPreview(i) { const w = (G.winners || [])[i]; if (w) GAME.showroomCar({ ...newCar(w.base, 0), paint: w.paint, rims: w.rims, tires: w.tires, engine: w.engine, lift: w.lift, neon: w.neon }); },
  buyScrubber() { if (!spend(25)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; } S.scrubber = true; SFX.cash(); H.bumpMoney(); save(); return true; },
  scrubFx(done) {
    const c = mine(); if (!c) return; SFX.wash(); for (let i = 0; i < 3; i++) fx.splash(c.b.x + (Math.random() - 0.5) * 2.5, c.b.y + 1.4, c.b.z + (Math.random() - 0.5) * 3, 6);
    if (done) { fx.confetti(c.b.x, c.b.y + 2.5, c.b.z, 40); H.toast("✨ Rust gone!", "Your " + vehicleById(c.s.id).name + " is shiny now.", "good"); }
  },
  custom(kind, val, cost) {
    const c = mine(); if (!c) return false;
    if (cost && !spend(cost)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; }
    c.s[kind] = val; applyLook(c.m, c.s); retune(c.b); if (cost) { SFX.cash(); H.bumpMoney(); } else SFX.click();
    save(); return true;
  },
  startRace(id) {
    const def = raceById(id), c = mine();
    if (!c) { H.toast("You need a vehicle to race!", "", "warn"); return; }
    if (crime.noTeleport()) return;
    if (jobs.active) { H.toast("You're on a job", "Finish or quit your job first (phone → Jobs).", "warn"); return; }
    const t = myTrailer(); if (t) { t.hitched = null; t.s.hitched = null; }
    UI.close();
    G.race = new Race(scene, def, { teleport: teleportMe });
    G.raceFrom = { x: PLACES[def.place].x, z: PLACES[def.place].z };
    G.mode = "race"; H.toast("🏁 " + def.name, "Get ready! Drive through the glowing hoops. R = back to the track.", "good", 4000); S.stats.races++;
  },
  quitRace() { endRace(); },
  takeJob(i) { return jobs.take(i); }, cancelJob() { jobs.cancel(); }, get jobs() { return jobs; },
  mePos() { return mapPos(); },
  sellItem(i) { const list = i < 0 ? S.backpack.splice(0) : S.backpack.splice(i, 1); const n = list.reduce((a, it) => a + it.v, 0); if (!n) return; pay(n); S.stats.pawned = (S.stats.pawned || 0) + n; SFX.cash(); H.bumpMoney(); H.toast("+" + money(n), "Sold " + list.length + " thing" + (list.length === 1 ? "" : "s") + " to the pawn shop.", "cash", 2400); save(); },
  setWaypoint(p) { G.waypoint = p; setBeacon(gpsBeacon, p); if (p) H.toast("GPS set", "Follow the purple arrow to " + (p.name || "your spot"), ""); },
  showroomCar(car) { // (a whole car setup on the showroom stand: contest winners)
    GAME.showroom(null); const m = buildCar(car); const R = inside() && interiors.cur.stage ? interiors.cur : null;
    if (R && R.featured) R.featured.visible = false;
    G.previewAt = R ? { x: POCKET.x + R.stage.x, y: R.stage.y, z: POCKET.z + R.stage.z, inside: true } : { x: -36, y: 1.45, z: 18 };
    m.root.position.set(G.previewAt.x, G.previewAt.y, G.previewAt.z); scene.add(m.root); G.preview = m;
  },
  showroom(id, color) {
    if (G.preview) { scene.remove(G.preview.root); G.preview = null; }
    if (!id) { if (inside() && interiors.cur.featured) interiors.cur.featured.visible = true; return; }
    const isT = !!trailerById(id);
    const m = isT ? { root: (() => { const g = new THREE.Group(); g.add(trailerModel(id, color)); return g; })() } : buildCar(Object.assign(newCar(id, 0), color != null ? { paint: color } : {}));
    const R = inside() && interiors.cur.stage ? interiors.cur : null; // (inside the showroom: it shows up on the big middle turntable)
    if (R && R.featured) R.featured.visible = false;
    G.previewAt = R ? { x: POCKET.x + R.stage.x, y: R.stage.y, z: POCKET.z + R.stage.z, inside: true } : { x: -36, y: 1.45, z: 18 };
    m.root.position.set(G.previewAt.x, G.previewAt.y, G.previewAt.z); scene.add(m.root); G.preview = m;
  },
  // ---- the phone's Dev app (code 2468)
  devMoney(n) { S.money = Math.max(0, Math.min(999999999, Math.round(n))); H.bumpMoney(); save(); },
  devCar(id) {
    const v = vehicleById(id), s = newCar(id, uid()); s.yaw = Math.PI; const me = mapPos();
    const f = inside() ? freeSpot(-36, 12, Math.PI, 5) : freeSpot(me.x + 6, me.z, 0, 5); s.x = f.x; s.z = f.z;
    S.cars.push(s); spawnCar(s); SFX.buy(); H.toast("🛠 Free ride!", v.name + " is parked " + (inside() ? "outside Valley Motors." : "right next to you."), "good", 3000); save();
  },
  devHouses() { S.houses = ["lot", ...HOUSES.filter((h) => h.price).map((h) => h.id)]; SFX.buy(); houseSigns(); H.toast("🛠 You own every house!", "Way more garage room now.", "good"); save(); },
  devWanted(n) { crime.setWanted(n); save(); },
  paintTrailer(u, color) { const t = G.TRS.get(u); if (!t || !t.model.body || !spend(150)) { SFX.nope(); return false; } t.s.color = color; t.model.body.color.set(color); SFX.buy(); H.bumpMoney(); save(); return true; },
  wipe() { wipe(); location.reload(); },
  get crime() { return crime; }, get fishing() { return fishing; }, get mp() { return mp; },
  copAtStation() { const why = crime.copAtStation(); if (why) { SFX.nope(); H.toast("Can’t switch right now", why, "warn"); return false; } return true; },
  setRole(r) { const why = crime.setRole(r); if (why) { SFX.nope(); H.toast("Can’t switch right now", why, "warn"); return false; } return true; },
  buyGear(g) { if (S.gear[g.id]) return false; if (!spend(g.price)) { SFX.nope(); H.toast("Not enough money", "You need " + money(g.price - S.money) + " more.", "warn"); return false; } S.gear[g.id] = true; SFX.buy(); H.bumpMoney(); if (g.id === "mask") G.me.p.setLook(lookFor(S.role, true)); save(); return true; },
  buyBlaster(bl) { if (!S.blasters.includes(bl.id)) { if (!spend(bl.price)) { SFX.nope(); H.toast("Not enough money", "You need " + money(bl.price - S.money) + " more.", "warn"); return false; } S.blasters.push(bl.id); SFX.buy(); H.bumpMoney(); } S.blaster = bl.id; S.equip = "blaster"; applyItem(); save(); return true; },
  buyRod(r) { if (!S.rods.includes(r.id)) { if (!spend(r.price)) { SFX.nope(); H.toast("Not enough money", "You need " + money(r.price - S.money) + " more.", "warn"); return false; } S.rods.push(r.id); SFX.buy(); H.bumpMoney(); } S.rod = r.id; S.equip = "rod"; applyItem(); save(); return true; },
  sellFish() { const { n, c } = fishing.sellAll(); if (!c) { SFX.nope(); return 0; } pay(n); SFX.cash(); H.bumpMoney(); H.toast("+" + money(n), "Sold " + c + " fish!", "cash"); save(); return n; },
  copCar(id) { S.cop.car = id; const c = policeCar(); if (c) { const { x, z } = c.b, yaw = c.b.yaw, was = c === mine(); removePoliceCar(); const n = spawnPoliceCar(x, z, yaw); if (was) enterCar(n); } save(); },
  refillSpikes() { S.cop.spikes = 3; SFX.load(); save(); },
  buyInterceptor() { if (S.cop.interceptor) return true; if (!spend(15000)) { SFX.nope(); H.toast("Not enough money", "", "warn"); return false; } S.cop.interceptor = true; SFX.buy(); H.bumpMoney(); GAME.copCar("interceptor"); return true; },
  policeCar,
  muted(m) { S.muted = m; setMuted(m); $("bMute").textContent = m ? "🔇" : "🔊"; save(); },
};
function trailerModel(id, color) { const tm = makeTrailer({ type: id, x: 0, z: 0, yaw: 0, color }, new THREE.Group()); tm.model.root.position.set(0, 0, 0); tm.model.root.rotation.set(0, 0, 0); return tm.model.root; }
function unloadCarByUid(u) { const c = G.CARS.get(u), tr = c.on; if (tr.bed) { unloadBed(tr); return; } const i = tr.loaded.findIndex((e) => e.uid === u); const [e] = tr.loaded.splice(i, 1); tr.loaded.push(e); unloadCar(tr); }
function endRace() {
  if (!G.race) return;
  G.race.dispose(); G.race = null; G.mode = "play";
  const p = G.raceFrom; teleportMe(p.x + 4, p.z, mine() ? mine().b.yaw : 0);
}

// ---------------------------------------------------------------- the main loop
let acc = 0, last = performance.now(), saveT = 0, fpsT = 0, frames = 0, slowT = 0, miniT = 0, limT = 0;
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
    if (IN.pressed("KeyF") && A.F && !G.race && !crime.jail && !crime.ko) A.F.fn();
    // E: tap, or hold for things like robbing + cuffing
    const eTap = IN.pressed("KeyE");
    if (A.E && A.E.hold && !G.race) {
      const h = G.hold && G.hold.id === A.E.id ? G.hold : null;
      if (IN.isHeld("KeyE")) {
        if (!h) { G.hold = { id: A.E.id, t: 0 }; A.E.start && A.E.start(); }
        G.hold.t += dt; A.E.tick && A.E.tick(G.hold.t / A.E.hold);
        if (G.hold.t >= A.E.hold) { G.hold = null; A.E.done(); }
      } else if (h) { h.t = Math.max(0, h.t - dt * 0.5); }
    } else { G.hold = null; if (eTap && A.E && !G.race) A.E.fn(); }
    if (IN.pressed("KeyT") && A.T && !G.race) A.T.fn();
    if (IN.pressed("KeyQ") && !G.race) useItem();
    if (IN.pressed("KeyX") && !G.race && !c) cycleItem();
    if (IN.pressed("KeyG")) { if (c && c.police) { G.siren = !G.siren; SFX.click(); H.toast(G.siren ? "🚨 Siren ON" : "Siren off", "", "", 1200); } else if (c) SFX.nope(); }
    if (IN.pressed("KeyH")) (c && ["hauler", "monster"].includes(c.s.id) ? SFX.hornBig : SFX.horn)();
    if (IN.pressed("KeyR")) resetVehicle();
  }
  // driving
  if (c) {
    const inp = blocked || raceLock ? { thr: 0, steer: 0, hand: true } : IN.drive();
    inp.wheelie = G.wheelieTap; G.wheelieTap = false;
    if (G.mode === "side" && G.panel === "customs") { c.b.vx = c.b.vz = 0; c.b.x += (36 - c.b.x) * 0.2; c.b.z += (-40 - c.b.z) * 0.2; c.b.yaw += dt * 0.35; } // (spinning on the turntable)
    const b = stepCar(c.b, inp, dt);
    carEffects(c, b, inp, dt);
  } else {
    const w = IN.walk(); const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const frozen = blocked || G.lockWalk || !!crime.ko || (fishing.busy && fishing.state !== "wait");
    if (fishing.state === "wait" && Math.hypot(w.x, w.y) > 0.3) fishing.cancel(); // (walking away reels the line in)
    const mx = frozen ? 0 : -fz * w.x + fx * w.y, mz = frozen ? 0 : fx * w.x + fz * w.y;
    const jump = !frozen && !fishing.busy && IN.pressed("Space");
    if (jump) SFX.jump();
    if (inside()) interiors.step(G.me.w, G.lockWalk ? 0 : mx, G.lockWalk ? 0 : mz, w.run, jump && !G.lockWalk, dt);
    else if (!G.lockWalk) stepWalker(G.me.w, mx, mz, w.run, jump, dt);
  }
  // bumping into other vehicles / trailers
  const me = c ? c.b : G.me.w;
  if (c) carVsStuff(c.b);
  else { for (const o of G.CARS.values()) if (!o.on) for (const k of carCircles(o.b)) bumpPair(G.me.w, 0.4, k, k.r, true); if (mp && mp.on) for (const k of mp.carCircles()) bumpPair(G.me.w, 0.4, k, k.r, true); }
  for (const t of G.TRS.values()) { stepTrailer(t, dt); stepDoor(t, dt); }
  stepGarageDoors(dt);
  driveInTrailers();
  if (G.tow) stepTrailer(G.tow, dt);
  if (G.race) raceTick(dt);
  jobs.update(dt);
  crime.update(dt);
  if (inside()) heist.update(dt);
  npcs.update(dt, inside() || !!G.race);
  drops.update(dt);
  fishing.update(dt, !blocked && IN.isHeld("KeyQ"));
  mp.update(dt);
  if (G.aimT > 0) G.aimT -= dt;
  G.rescueT -= dt; if (G.rescueT <= 0 && !inside()) { G.rescueT = 0.5; rescue(); }
  if (G.waypoint && !inside() && Math.hypot(G.waypoint.x - me.x, G.waypoint.z - me.z) < 14) { G.waypoint = null; setBeacon(gpsBeacon, null); H.toast("You made it!", "", "good"); SFX.check(); }
  if (G.hintT > 0) G.hintT -= dt;
  fx.update(dt);
  saveT += dt; if (saveT > 6) { saveT = 0; syncSave(); }
}
// ---------------- the safety net: anything that leaves the valley, falls through the ground or sinks in deep water
// gets put back on the nearest road (or trail)
const lost = (o, y) => !Number.isFinite(o.x) || !Number.isFinite(o.z) || !Number.isFinite(y) || Math.abs(o.x) > EDGE + 3 || Math.abs(o.z) > EDGE + 3 || y < groundAt(o.x, o.z) - 2.5;
function rescue() {
  const c = mine(), me = c ? c.b : G.me.w;
  // stuck in deep water (the pond, the deep part of the river)
  const deep = c ? waterDepth(me.x, me.z) > (c.m.liftY || 0) + 1.3 && !me.air : false;
  G.deepT = deep ? G.deepT + 0.5 : 0;
  if (lost(me, me.y) || G.deepT > 3) {
    const p = nearestRoad(Number.isFinite(me.x) ? me.x : 0, Number.isFinite(me.z) ? me.z : 0);
    G.deepT = 0; teleportMe(p.x, p.z, p.yaw);
    H.toast(deep ? "Glub glub! Towed out of the water" : "Whoa! Back on solid ground", "We put you back on the nearest road.", "warn", 3200);
  }
  for (const o of G.CARS.values()) if (o !== c && !o.on && (lost(o.b, o.b.y) || waterDepth(o.b.x, o.b.z) > 2.2)) { const p = nearestRoad(Number.isFinite(o.b.x) ? o.b.x : 0, Number.isFinite(o.b.z) ? o.b.z : 0); const f = freeSpot(p.x, p.z, p.yaw, o.m.len); Object.assign(o.b, { x: f.x, z: f.z, yaw: p.yaw, vx: 0, vz: 0, vy: 0, flipped: false }); settle(o.b); }
  for (const t of G.TRS.values()) if (!t.hitched && lost(t, t.y)) { const p = nearestRoad(Number.isFinite(t.x) ? t.x : 0, Number.isFinite(t.z) ? t.z : 0); t.x = p.x; t.z = p.z; t.yaw = p.yaw; stepTrailer(t, DT); }
  for (const k of crime.cops) if (lost(k.b, k.b.y)) { const p = nearestRoad(k.b.x || 0, k.b.z || 0); Object.assign(k.b, { x: p.x, z: p.z, yaw: p.yaw, vx: 0, vz: 0, vy: 0, y: groundAt(p.x, p.z) }); }
  const rc = crime.call && crime.call.robber.car.b; if (rc && lost(rc, rc.y)) { const p = nearestRoad(rc.x || 0, rc.z || 0); Object.assign(rc, { x: p.x, z: p.z, yaw: p.yaw, vx: 0, vz: 0, vy: 0, y: groundAt(p.x, p.z) }); }
}
// push the driven vehicle off parked ones (a simple version of bumpPair that moves the car body)
// crashing into your friends' cars in a lobby: you bounce off on your screen, and they get shoved on theirs
const bumpT = new Map();
function friendCars(b) {
  if (!mp || !mp.on) return;
  for (const k of mp.carCircles()) for (const a of carCircles(b)) {
    const dx = a.x - k.x, dz = a.z - k.z, d = Math.hypot(dx, dz), m = a.r + k.r;
    if (d >= m || d < 1e-4 || Math.abs(b.y - k.y) > 2.5) continue;
    const nx = dx / d, nz = dz / d; b.x += nx * (m - d); b.z += nz * (m - d);
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) {
      b.vx -= nx * vn * 1.4; b.vz -= nz * vn * 1.4; b.hit = Math.max(b.hit, -vn);
      const now = performance.now();
      if (-vn > 2 && now - (bumpT.get(k.id) || 0) > 250) { bumpT.set(k.id, now); mp.bump(k.id, -nx * -vn * 0.9, -nz * -vn * 0.9); }
    }
  }
}
function carVsStuff(b) {
  friendCars(b);
  for (const o of G.CARS.values()) {
    if (o.b === b || o.on) continue;
    for (const a of carCircles(b)) for (const k of carCircles(o.b)) {
      const dx = a.x - k.x, dz = a.z - k.z, d = Math.hypot(dx, dz), m = a.r + k.r;
      if (d >= m || d < 1e-4 || Math.abs(b.y - o.b.y) > 2.5) continue;
      const nx = dx / d, nz = dz / d, pen = m - d; b.x += nx * pen; b.z += nz * pen;
      const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= nx * vn * 1.3; b.vz -= nz * vn * 1.3; b.hit = Math.max(b.hit, -vn); }
    }
  }
  const me = mine();
  for (const t of G.TRS.values()) {
    if (t.hitched === b) continue;
    if (me && me.b === b && (canDriveIn(t, me) || onDeckZone(t, me))) continue; // (lined up behind it / up on it: let the ride drive up the ramp)
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw), half = t.T.id === "flatbed" ? 4.5 : t.T.enclosed ? 3.2 : 1.8;
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
  // burnout: smoke (or dirt, or mud) pours off the spinning back wheel
  if (b.burn) {
    const rx = b.x - fx2 * (c.m.len * 0.5 + 0.6), rz = b.z - fz2 * (c.m.len * 0.5 + 0.6), dirty = [SURF.DIRT, SURF.TRACK, SURF.SAND, SURF.ROCK].includes(b.surf);
    if (b.surf === SURF.MUD) { if (Math.random() < 0.8) fx.mud(rx, b.y, rz, -fx2, -fz2, 2, 1.1); c.s.dirt = Math.min(1, (c.s.dirt || 0) + dt * 0.12); }
    else if (Math.random() < 0.3) fx.dust(rx, b.y, rz, 1, dirty ? 0xc8a878 : b.surf === SURF.GRASS ? 0x9ad07a : 0xe6e6e6, 0.5);
  }
  // wheelie: a timer while you're up, cash when you come down after a long one
  if (b.wa > 0.3) { G.hint = "🏍️ WHEELIE! " + b.wheelieT.toFixed(1) + " s"; G.hintT = 0.2; }
  if (b.wheelieDone) {
    const t = Math.min(30, b.wheelieDone); b.wheelieDone = 0;
    if (t > 2 && !G.race) { const cash = Math.round(t * 10); pay(cash); H.bumpMoney(); H.toast(t > 6 ? "MEGA WHEELIE!" : "WHEELIE!", t.toFixed(1) + " seconds on the back wheel! +" + money(cash), "cash", 2200); SFX.air(); }
  }
  lookT += dt; if (lookT > 0.5) { lookT = 0; applyLook(c.m, c.s); }
  // engine sound: rpm climbs through 5 gears
  const top = Math.max(10, b.t.top), k = clamp(sp / top, 0, 1) * 5, gear = Math.min(4, Math.floor(k));
  const rpm = clamp((k - gear) * 0.75 + 0.25 + Math.abs(inp.thr) * 0.1, 0, 1);
  if (b.burn) { engine(true, 0.86 + Math.random() * 0.1, 1, b.t.engine, b.surf === SURF.ROAD || b.surf === SURF.TOWN ? 9 : 0, b.surf !== SURF.ROAD && b.surf !== SURF.TOWN ? 0.3 : 0); return; } // (revving like crazy)
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
  const sens = IN.controls.sens || 1, inv = IN.controls.invert ? -1 : 1; // (📱 Settings → 🎮 Controls: camera speed + flip up/down)
  cam.yaw -= IN.look.dx * 0.006 * sens; cam.pitch = clamp(cam.pitch + IN.look.dy * 0.004 * sens * inv, -0.05, 1.25);
  IN.look.dx = IN.look.dy = 0;
  const ak = IN.arrowLook(); // arrow keys turn the camera too
  if (ak.x || ak.y) { cam.yaw -= ak.x * dt * 2.4 * sens; cam.pitch = clamp(cam.pitch - ak.y * dt * 1.2 * sens * inv, -0.05, 1.25); IN.look.lastT = performance.now(); }
  if (IN.look.zoom) { cam.zoom = clamp(cam.zoom * (IN.look.zoom > 0 ? 1.12 : 0.89), 0.55, 2); IN.look.zoom = 0; }
  const dragging = performance.now() - IN.look.lastT < 1300;
  if (c && !dragging && G.mode !== "side") {
    const sp = speedOf(c.b), goal = c.b.yaw;
    if (sp > 1.5) cam.yaw += wrap(goal - cam.yaw) * Math.min(1, dt * (1.2 + sp * 0.08));
    cam.pitch += ((tw ? 0.4 : 0.28) - cam.pitch) * Math.min(1, dt * 0.8);
  }
  if (inside()) dist = 3.6 * Math.min(1.2, cam.zoom);
  let tx = t.x, ty = t.y + (c ? 1.2 + (c.m.liftY || 0) : 1.4), tz = t.z;
  let px = tx - Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, pz = tz - Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist, py = ty + Math.sin(cam.pitch) * dist + (inside() ? 0.5 : 1.2);
  if (inside() && G.mode !== "side") { [px, py, pz] = interiors.clampCam(px, py, pz); }
  // shop screens get their own camera
  if (G.mode === "side" && G.panel === "dealer") {
    const P = G.previewAt || { x: -36, y: 1.45, z: 18 }, ins = !!P.inside && inside();
    tx = P.x; ty = P.y + 1.15; tz = P.z; px = P.x + Math.sin(G.time * 0.25) * (ins ? 1.2 : 2) + (ins ? 4.8 : 8.5); py = ins ? 3.2 : 5.2; pz = P.z + (ins ? 6.2 : -9.5);
  }
  if (G.mode === "side" && G.panel === "customs" && c) { tx = c.b.x; ty = c.b.y + 0.9; tz = c.b.z; px = tx + 4.2; pz = tz + Math.min(9.5, 3 + c.m.len); py = c.b.y + 2.8; } // (inside the bay, near the door)
  if (G.mode === "side" && G.panel === "house" && G.houseView) {
    // look at the front of the house from a little to the side
    const h = G.houseView, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), sx = Math.cos(h.yaw), sz = -Math.sin(h.yaw);
    const d = { mansion: 40, farm: 42, family: 26, cabin: 24, camper: 18, small: 20 }[h.build] || 30, k = h.id === "lot" ? 0 : 1;
    const hx = k ? h.x : h.garage.x, hz = k ? h.z : h.garage.z;
    tx = hx; ty = groundAt(hx, hz) + 3.5; tz = hz; px = hx + fx * d + sx * d * 0.55; pz = hz + fz * d + sz * d * 0.55; py = ty + d * 0.32;
  }
  // with a shop screen open on the left, center the view in the part you can see
  if (G.mode === "side" && innerWidth > 700) camera.setViewOffset(innerWidth, innerHeight, -Math.min(460, innerWidth) / 2, 0, innerWidth, innerHeight);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const gy = inside() ? 0.6 : groundAt(px, pz) + 1.0; if (py < gy) py = gy;
  // don't let a hill get between the camera and you
  if (G.mode !== "side" && !inside()) { let lift = 0; for (let k = 0.25; k < 1.01; k += 0.15) { const x = tx + (px - tx) * k, z = tz + (pz - tz) * k, y = ty + (py - ty) * k; lift = Math.max(lift, (groundAt(x, z) + 0.9 - y) / k); } py += lift; }
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
  for (const v of G.CARS.values()) if (!v.on) { placeModel(v.b); animateCar(v.m, { speed: v === c ? speedOf(v.b) : 0, burn: v === c && v.b.burn, reverse: v.b.vf < 0, steer: v.b.steer, wheelDrop: v.b.wheelDrop, boost: v.b.boost, siren: v.police && G.siren && v === c, t: G.time }, dt); }
  if (!c) {
    const w = G.me.w, p = G.me.p;
    p.root.position.set(w.x, w.y + (Math.abs(w.x) < 116 && Math.abs(w.z) < 106 ? 0.12 : 0), w.z); p.root.rotation.y = w.yaw;
    if (crime.ko) p.pose("ko", G.time);
    else if (fishing.busy) { /* (fishing.draw does the pose) */ }
    else if (G.aimT > 0) p.pose("aim", G.time);
    else p.pose(w.air ? "jump" : w.moving > 7 ? "run" : w.moving > 0.5 ? "walk" : "stand", w.t, Math.min(1, w.moving / 4));
  }
  crime.draw(dt, G.time); fishing.draw(dt, G.time); mp.draw(dt, G.time); if (inside()) { interiors.draw(G.time, G.me.w); heist.draw(G.time); } npcs.draw(G.time);
  if (G.robMarks) { const show = S.role === "robber" && !G.race; for (const m of G.robMarks) { m.g.visible = show; if (show) { m.icon.position.y = 2.6 + Math.sin(G.time * 2 + m.x) * 0.2; m.ring.material.opacity = crime.t < m.spot.readyAt ? 0.15 : 0.6 + Math.sin(G.time * 4) * 0.25; } } }
  if (passenger) passenger.pose("wave", G.time);
  if (G.tow && G.tow.towCar.smoke) { G.tow.towCar.smoke.children.forEach((s, i) => { s.position.y = 1 + ((G.time * 0.8 + i * 0.4) % 1.6); s.scale.setScalar(0.6 + ((G.time * 0.8 + i * 0.4) % 1.6) * 0.6); }); }
  if (G.preview) { G.preview.root.rotation.y = G.time * 0.5; if (G.preview.wheels) animateCar(G.preview, { speed: 0, steer: 0 }, dt); }
  for (const bc of [jobBeacon, gpsBeacon, ...Object.values(G.hot || {})]) if (bc.visible) { bc.userData.ring.rotation.z = G.time; bc.children[0].material.opacity = 0.22 + Math.sin(G.time * 4) * 0.08; }
  if (G.race) { G.race.hoop.rotation.z = 0; G.race.hoopRing.material.opacity = 0.6 + Math.sin(G.time * 6) * 0.3; }
  animateWorld(world, G.time, dt, camera.position, !!G.race);
  updateCamera(dt);
  renderer.render(scene, camera);
  hudTick(dt);
}
function hudTick(dt) {
  if (THUMB) return;
  document.body.classList.toggle("inmenu", G.mode === "side" || G.mode === "modal" || G.mode === "map");
  document.body.classList.toggle("copCar", !!(mine() && mine().police));
  const c = mine(), b = c ? c.b : null, me = mapPos();
  const j = jobs.active;
  let target = null;
  const CH = crime.hud();
  if (G.race && !G.race.finished) { const n = G.race.nextCp(); target = { x: n.x, z: n.z, kind: "race" }; }
  else if (CH.jail) target = null;
  else if (CH.target) target = { ...CH.target, kind: "crime" };
  else if (j) target = { ...jobs.target(), kind: "" };
  else if (G.waypoint) target = { ...G.waypoint, kind: "gps" };
  const vehicles = [...G.CARS.values()].filter((v) => !v.on && v !== c).map((v) => ({ x: v.b.x, z: v.b.z }));
  const role = S.role === "cop" ? "👮 " + rankOf().name : S.role === "robber" ? "🦹 Robber" : "";
  const g = { friends: mp.dots(), pins: G.pins, crime: CH, reel: fishing.hud(), role, item: !c && S.equip !== "none" ? ITEM_NAME[S.equip] : "", cops: [...crime.cops, ...crime.patrols].map((k) => ({ x: k.b.x, z: k.b.z })), vehLabel: (role ? role + " · " : "") + (c ? vehicleById(c.s.id).name : "On foot"), speed: b ? speedOf(b) : 0, topSpeed: b ? b.t.top : 30, driving: !!c, reverse: b && b.vf < -0.5, job: j, race: G.race, target, px: me.x, pz: me.z, camYaw: cam.yaw, pyaw: me.yaw, vehicles, trailerDots: [...G.TRS.values()].map((t) => ({ x: t.x, z: t.z })) };
  limT += dt; if (limT > 0.3) { limT = 0; G.limit = c && !inside() ? speedLimitAt(b.x, b.z) : 0; }
  g.limit = G.limit;
  H.updateHud(g);
  miniT += dt; if (miniT > 0.08) { miniT = 0; H.drawMini(g); }
  if (G.mode === "map") H.drawBigMap(g);
  G.hudState = g;
  // hints for what you can press
  const list = [];
  if (G.mode === "play" || G.mode === "race") {
    const A = G.actions || {};
    if (G.hintT > 0 && G.hint) list.push({ key: "", text: G.hint, warn: true });
    if (!G.race) {
      if (A.E) list.push({ key: "E", text: A.E.text, warn: A.E.warn, bar: A.E.hold && G.hold && G.hold.id === A.E.id ? G.hold.t / A.E.hold : A.E.hold ? 0 : undefined });
      if (A.F) list.push({ key: "F", text: A.F.text }); if (A.T) list.push({ key: "T", text: A.T.text, warn: A.T.warn });
      if (A.Q) list.push({ key: "Q", text: A.Q.text, warn: A.Q.warn, hot: fishing.state === "bite" });
      if (c && c.police) list.push({ key: "G", text: G.siren ? "Siren off" : "Siren on" });
    }
    if (G.race && G.race.state === "go" && c && (c.b.flipped || (G.race && Math.hypot(me.x - target?.x, me.z - target?.z) > 90))) list.push({ key: "R", text: "Back to the track" });
  }
  H.hints(list);
  if (G.hold && G.actions && G.actions.E && G.actions.E.hold) H.holdBar(G.hold.t / G.actions.E.hold); else H.holdBar(0);
}
function syncSave() {
  for (const c of G.CARS.values()) { if (!c.on) { c.s.x = Math.round(c.b.x * 10) / 10; c.s.z = Math.round(c.b.z * 10) / 10; c.s.yaw = Math.round(c.b.yaw * 100) / 100; } c.s.on = c.on ? c.on.s.uid : null; }
  for (const t of G.TRS.values()) { t.s.x = t.x; t.s.z = t.z; t.s.yaw = t.yaw; let hu = null; for (const c of G.CARS.values()) if (t.hitched === c.b) hu = c.s.uid; t.s.hitched = hu; }
  const me = mapPos(); S.px = me.x; S.pz = me.z; S.driving = mine() ? mine().s.uid : null;
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
  await loadBikeModel();
  fetch(RELAY + "/mv/winners").then((r) => r.json()).then((r) => { if (r && Array.isArray(r.winners)) G.winners = r.winners.filter((w) => vehicleById(w.base).id === w.base); }).catch(() => {});
  makeMe();
  for (const s of S.trailers) spawnTrailer(s);
  for (const s of S.cars) {
    const c = spawnCar(s);
    if (s.on && G.TRS.has(s.on)) { const tr = G.TRS.get(s.on); const sl = freeSlots(tr, sizeOf(c)); if (sl) { c.on = tr; loadOnto(tr, { uid: s.uid }, c.m, sl); } else s.on = null; }
  }
  for (const c of G.CARS.values()) if (c.s.bed && G.CARS.has(c.s.bed) && !c.on && BEDS[G.CARS.get(c.s.bed).s.id]) putInBed(c, G.CARS.get(c.s.bed)); else c.s.bed = null;
  for (const t of G.TRS.values()) if (t.s.hitched && G.CARS.has(t.s.hitched) && !G.CARS.get(t.s.hitched).on) t.hitched = G.CARS.get(t.s.hitched).b;
  jobs = new Jobs(jobApi);
  crime = new Crime({
    scene, fx, makeBeacon: (col) => beacon(col), setBeacon, toast: H.toast, banner: H.banner, bumpMoney: H.bumpMoney,
    me() { const c = mine(), b = mapPos(), w = G.me.w; return { x: b.x, y: b.y, z: b.z, vx: b.vx, vz: b.vz, yaw: b.yaw, inCar: !!c, car: c, body: c ? c.b : null, walker: inside() ? { x: b.x, z: b.z, vx: 0, vz: 0, isWalker: true } : w, speed: inside() ? 0 : Math.hypot(b.vx || 0, b.vz || 0), len: c ? c.m.len : 1, indoors: inside() }; },
    goJail() { goInside(buildingById("police"), JAIL_SPOT); G.lockWalk = true; cam.yaw = 0; cam.pitch = 0.25; cam.snap = true; },
    leaveJail(p) { G.lockWalk = false; if (inside()) interiors.leaveRoom(); teleportMe(p.x, p.z, p.yaw); },
    exitCar: () => { if (mine()) exitCar(); }, teleport: (x, z, yaw) => teleportMe(x, z, yaw), lockWalk: (v) => { G.lockWalk = v; }, roleChanged, policeCar, mySiren: () => G.siren && !!mine() && mine().police, shake: (k) => { G.shake = Math.max(G.shake, k); },
    indoors: () => inside(), roomId: () => (inside() ? interiors.cur.bd.id : null), openVault: () => heist.openVault(),
    civilians: () => npcs.targets(), knockCiv: (c, role) => npcs.knock(c, role), alarm: (x, z, r) => npcs.alarm(x, z, r), dropMine: (x, z) => npcs.dropMine(x, z), confiscate: () => npcs.confiscate(),
    racing: () => !!G.race, onRoad: () => !!mine() && (mine().b.surf === SURF.ROAD || mine().b.surf === SURF.TOWN),
    friends: () => (mp && mp.on ? mp.list() : []), zap: (id, k) => mp.zap(id, k), shared: (x, y, z, tx, ty, tz, w) => mp.shot([x, y, z], [tx, ty, tz], w),
  });
  fishing = new Fishing({ scene, fx, toast: H.toast, banner: H.banner, me: () => G.me.w, person: () => G.me.p, rodModel: () => (S.equip === "rod" ? G.me.p.item && G.me.p.item.userData.bend ? G.me.p.item : itemModels["r" + S.rod] : null) });
  interiors = new Interiors({ scene, onEnter: (c) => heist.enter(c), onLeave: () => heist.leave() });
  drops = new Drops({ scene, me: () => { const b = mapPos(); return { x: b.x, z: b.z, yaw: b.yaw || 0 }; }, indoors: () => inside(),
    dropped: () => { SFX.door(); H.toast("📦 Special delivery!", "Your SkyDrop box just dropped. Walk up to it and press E to open it.", "good", 3500); },
    landed: (x, y, z) => { fx.dust(x, y, z, 10); SFX.land(2); } });
  npcs = new NPCs({ scene, me: () => crime.api.me(), toast: H.toast, bumpMoney: H.bumpMoney, crime, quality: () => quality });
  heist = new Heist({ scene, crime, interiors, me: () => G.me.w, toast: H.toast, banner: H.banner, bumpMoney: H.bumpMoney,
    aim() { G.aimT = 0.3; const w = G.me.w; if (w.moving < 0.5) w.yaw = heist.aimYaw(); } });
  G.pins = [];
  mp = new MP({
    scene, toast: H.toast, look: () => lookFor(S.role, S.gear.mask),
    me() { const c = mine(), p = mapPos(); return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, moving: c ? speedOf(c.b) > 1 : G.me.w.moving > 0.5, car: c ? { id: c.s.id, paint: c.s.paint } : null }; },
    pin(who, x, z) { G.pins.push({ x, z, name: who }); if (G.pins.length > 5) G.pins.shift(); GAME.setWaypoint({ x, z, name: who + "’s pin 📍" }); },
    changed() { UI.mpChanged && UI.mpChanged(); $("bPhone").classList.toggle("dot", mp.unread > 0); },
    zapped: (p, k) => crime.zappedBy(p, k), shot: (p, x, w) => crime.friendShot(p, x, w),
    // a friend rammed you: your ride gets shoved (on foot you just stumble)
    bumped(p, vx, vz) {
      const c = mine(); const sp = Math.hypot(vx, vz);
      if (c) { c.b.vx += vx; c.b.vz += vz; c.b.yawRate += (Math.random() - 0.5) * sp * 0.15; } else { G.me.w.vx = (G.me.w.vx || 0) + vx * 0.6; G.me.w.vz = (G.me.w.vz || 0) + vz * 0.6; }
      if (sp > 3) { SFX.crash(sp / 3); G.shake = Math.min(1, sp / 20); const q = mapPos(); fx.sparks(q.x, q.y + 0.8, q.z, 10); }
    },
  });
  // little red rings where robbers can rob things outside (only robbers see them)
  G.robMarks = ROB_SPOTS.filter((sp) => !sp.room).map((sp) => { const m = makeMarker(scene, sp.x, sp.z, 1.4, "#ff4a4a", sp.icon); m.icon.scale.set(1.6, 1.6, 1); m.icon.position.y = 2.6; m.spot = sp; m.g.visible = false; return m; });
  if (S.role === "cop") { const c = spawnPoliceCar(); if (S.driving === POLICE_UID) { Object.assign(c.b, { x: S.px, z: S.pz }); settle(c.b); } }
  hotBeacons(S.role);
  applyItem();
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
  $("jailBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); audio(); crime.jailTry(); });
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
  get state() { const c = mine(), me = c ? c.b : G.me.w; return { role: S.role, wanted: S.wanted, loot: S.loot, cops: crime.cops.length, jail: crime.jail ? +crime.jail.t.toFixed(1) : 0, ko: !!crime.ko, fishing: fishing.state, fish: S.fish.length, equip: S.equip, mode: G.mode, money: S.money, driving: c ? c.s.id : null, x: me.x, y: me.y, z: me.z, speed: c ? speedOf(c.b) : 0, surf: c ? c.b.surf : null, cars: S.cars.map((s) => s.id), trailers: S.trailers.map((t) => t.type), houses: S.houses.slice(), job: jobs.active ? { type: jobs.active.type, stage: jobs.active.stage } : null, race: G.race ? { state: G.race.state, lap: G.race.lap, place: G.race.place, next: G.race.next, time: G.race.time, finished: G.race.finished } : null, flipped: c ? c.b.flipped : false, air: c ? c.b.air : false }; },
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
  get crime() { return crime; }, get fishing() { return fishing; }, get world() { return world; }, scene, camera, renderer,
  // hold a key for n steps (e.g. MV.hold("KeyE", 300) robs / cuffs)
  hold(code, n = 60) { IN.forceHeld(code, true); MV.step(n); IN.forceHeld(code, false); return MV.state; },
  tap(code) { IN.forceTap(code); MV.step(1); return MV.state; },
  setRole(r) { return GAME.setRole(r); },
  equip(k) { S.equip = k; applyItem(); return S.equip; },
  cam(yaw, pitch) { cam.yaw = yaw; if (pitch !== undefined) cam.pitch = pitch; cam.snap = true; },
  rescueNow() { G.rescueT = 0; MV.step(1); return MV.state; },
  get interiors() { return interiors; }, get mp() { return mp; }, get npcs() { return npcs; },
  goIn(id) { const bd = buildingById(id); const w = G.me.w; if (mine()) exitCar(); teleportMe(bd.dx + Math.sin(bd.out) * 1.2, bd.dz + Math.cos(bd.out) * 1.2, bd.out + Math.PI); const a = actions(); if (a.E && a.E.text.includes(bd.name.split(" ")[0]) || (a.E && /inside|tour/i.test(a.E.text))) { a.E.fn(); return a.E.text; } return a.E && a.E.text; },
  walkTo(lx, lz) { const w = G.me.w, P = interiors.cur ? { x: w.x - interiors.local(w).x, z: w.z - interiors.local(w).z } : { x: 0, z: 0 }; w.x = P.x + lx; w.z = P.z + lz; return MV.actions(); },
};
window.MV = MV;
boot().catch((e) => { console.error(e); $("loading").querySelector("span").textContent = "Oops! Something went wrong: " + e.message; });
