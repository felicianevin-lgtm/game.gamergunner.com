// CIRCUIT SIEGE (game.gamergunner.com/circuit/): a robot tower defense game with a hub world.
// Files: data.js (towers, robots, maps, crates), sim.js (a match, step by step), match.js (drawing + playing a match),
// hub.js (the hub world), models.js (all the robots), ui.js (crates, locker, trading, dev menu), net.js (multiplayer),
// save.js (your stuff), sfx.js (sounds). Test hook: window.CT.
import * as THREE from "/create/vendor/three.module.js";
import { MAPS, mapById, towerById } from "./data.js";
import { Hub, PADS, floorAt, zoneAt, CRATE_SPOTS, TRADE_SPOT, LOCKER_SPOT } from "./hub.js";
import { avatarModel } from "./models.js";
import { Match } from "./match.js";
import { Conn, joinHub, newCode } from "./net.js";
import { S, save, addTower, fmt } from "./save.js";
import { SFX, audio, setMuted } from "./sfx.js";
import * as UI from "./ui.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
// ---------------------------------------------------------------- 3D
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: Q.has("test") || Q.has("thumb") });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
function resize() { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const hubScene = new THREE.Scene(); hubScene.background = new THREE.Color(0x020604); hubScene.fog = new THREE.Fog(0x020604, 70, 230);
hubScene.add(new THREE.HemisphereLight(0x9affc0, 0x0a1a10, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(30, 60, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 }); sun.shadow.camera.updateProjectionMatrix(); hubScene.add(sun); hubScene.add(sun.target);
const hub = new Hub(hubScene);

// ---------------------------------------------------------------- input
const I = { keys: {}, mouse: null, click: false, drag: null, wheel: 0, esc: false, num: 0, down: null, tapped: {} };
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
  audio(); if (!I.keys[e.code]) I.tapped[e.code] = true; I.keys[e.code] = true;
  if (e.code === "Escape") { I.esc = true; if (UI.isOpen()) UI.close(); }
  if (/^Digit[1-5]$/.test(e.code)) I.num = +e.code.slice(5);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => { I.keys[e.code] = false; });
addEventListener("blur", () => { I.keys = {}; });
canvas.addEventListener("pointerdown", (e) => { audio(); canvas.focus(); I.down = { x: e.clientX, y: e.clientY, b: e.button, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => {
  I.mouse = { x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 };
  if (I.down) { const dx = e.movementX || 0, dy = e.movementY || 0; I.down.moved += Math.abs(dx) + Math.abs(dy); if (I.down.moved > 6 || I.down.b === 2) { I.drag = I.drag || { dx: 0, dy: 0 }; I.drag.dx += dx; I.drag.dy += dy; } }
});
canvas.addEventListener("pointerup", (e) => { if (I.down && I.down.moved <= 6 && I.down.b === 0) I.click = true; if (I.down && I.down.b === 2 && I.down.moved <= 6) I.esc = true; I.down = null; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => { I.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

// ---------------------------------------------------------------- you (in the hub)
const me = { x: 0, y: 0, z: 1, vy: 0, yaw: Math.PI, air: false, model: avatarModel(S.color), camYaw: 0, camPitch: 0.35, dist: 9 };
hubScene.add(me.model.root);
let mode = "hub", match = null, hubConn = null, hubTimer = null, myPad = -1, padSince = {}, padOf = new Map(), names = {};

function hubStep(dt) {
  const blocked = UI.isOpen();
  if (I.drag) { me.camYaw -= I.drag.dx * 0.006; me.camPitch = Math.max(-0.1, Math.min(1.2, me.camPitch + I.drag.dy * 0.004)); }
  if (I.wheel) me.dist = Math.max(4, Math.min(18, me.dist * (I.wheel > 0 ? 1.12 : 0.89)));
  const k = I.keys, f = blocked ? 0 : (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), s = blocked ? 0 : (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  if (!blocked && (k.KeyQ)) me.camYaw += dt * 2; if (!blocked && k.KeyE && false) me.camYaw -= dt * 2;
  const fx = -Math.sin(me.camYaw), fz = -Math.cos(me.camYaw), sp = (k.ShiftLeft ? 11 : 7.5) * dt;
  let mx = fx * f - fz * s, mz = fz * f + fx * s; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const walk = l > 0.1;
  if (walk) { let d = Math.atan2(mx, mz) - me.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); me.yaw += d * Math.min(1, dt * 12); }
  // move, sliding along the guardrails (you can only step where there's floor)
  const tryMove = (nx, nz) => { const h = floorAt(nx, nz, me.y); if (h === null) return false; me.x = nx; me.z = nz; return true; };
  if (walk && !tryMove(me.x + mx * sp, me.z + mz * sp)) { tryMove(me.x + mx * sp, me.z) || tryMove(me.x, me.z + mz * sp); }
  if (!blocked && I.tapped.Space && !me.air) { me.vy = 8; me.air = true; }
  const floor = floorAt(me.x, me.z, me.y) ?? 0;
  if (me.air || me.y > floor + 0.05) { me.vy -= 22 * dt; me.y += me.vy * dt; if (me.y <= floor) { me.y = floor; me.vy = 0; me.air = false; } }
  else me.y = floor;
  me.model.root.position.set(me.x, me.y, me.z); me.model.root.rotation.y = me.yaw; me.model.pose(walk, performance.now() / 1000);
  // the camera, behind you
  const d = me.dist, cx = me.x + Math.sin(me.camYaw) * Math.cos(me.camPitch) * d, cz = me.z + Math.cos(me.camYaw) * Math.cos(me.camPitch) * d;
  camera.position.set(cx, me.y + 1.6 + Math.sin(me.camPitch) * d, cz); camera.lookAt(me.x, me.y + 1.6, me.z);
  sun.position.set(me.x + 30, me.y + 60, me.z + 20); sun.target.position.set(me.x, me.y, me.z);
  // what's around you: pads, crates, the trade terminal, the locker
  const pad = hub.padAt(me.x, me.z, me.y);
  if (pad !== myPad) { myPad = pad; if (hubConn && hubConn.open) hubConn.send({ t: "tdpad", p: pad }); if (pad >= 0) { const P = PADS[pad]; SFX.click(); UI.toast("⏳ " + mapById(P.map).name + " · " + P.cap + " players. Wait here for others (or play alone)!", "good", 3200); } }
  padTick(dt);
  let prompt = null;
  const near = (p, r = 3) => (me.x - p.x) ** 2 + (me.z - p.z) ** 2 < r * r && Math.abs(me.y - p.y) < 2;
  for (const c of CRATE_SPOTS) if (near(c, 3.2)) prompt = ["Open crates", () => UI.crates(c.r)];
  if (near(TRADE_SPOT)) prompt = ["Trade with players", () => UI.tradeMenu()];
  if (near(LOCKER_SPOT)) prompt = ["Tower locker (your loadout)", () => UI.locker()];
  const z = zoneAt(me.x, me.z, me.y);
  if (!prompt && z === "trade") { const o = nearestOther(4); if (o) prompt = ["Trade with " + o.name, () => { hubConn.send({ t: "tdtr", to: o.id, k: "req" }); UI.toast("Trade request sent!", "good"); }]; }
  $("prompt").classList.toggle("hidden", !prompt || blocked); if (prompt) $("prompt").innerHTML = "<kbd>E</kbd> " + prompt[0];
  if (prompt && !blocked && I.tapped.KeyE) { SFX.click(); prompt[1](); }
  if (!blocked && I.tapped.KeyI) UI.locker();
  $("zone").textContent = { spawn: "SPAWN", map0: "SCRAP YARD", map1: "NEON CITY", map2: "CORE REACTOR", deck: "UPPER DECK", crates: "CRATE ROOM", trade: "TRADING AREA", endless: "ENDLESS" }[z] || "";
  // tell the others where you are
  sendT -= dt; if (sendT <= 0 && hubConn && hubConn.open) { sendT = 0.1; hubConn.send({ t: "s", p: [round(me.x), round(me.y), round(me.z)], r: round(me.yaw), w: walk ? 1 : 0 }); }
  hub.animate(performance.now() / 1000); hub.drawOthers(dt, performance.now() / 1000);
}
let sendT = 0; const round = (v) => Math.round(v * 100) / 100;
function nearestOther(r) { let best = null, bd = r * r; for (const [id, o] of hub.others) { const d = (o.x - me.x) ** 2 + (o.z - me.z) ** 2; if (d < bd && Math.abs(o.y - me.y) < 2) { bd = d; best = { id, name: o.name }; } } return best; }

// ---------------------------------------------------------------- pads: who's standing on which one; the leader starts the match
function padTick(dt) {
  const counts = PADS.map(() => []);
  if (myPad >= 0) counts[myPad].push(hubConn && hubConn.open ? hubConn.id : 0);
  for (const [id, p] of padOf) if (p >= 0 && hub.others.has(id)) counts[p].push(id);
  counts.forEach((ids, i) => { hub.setPadCount(i, ids.length); if (ids.length && padSince[i] === undefined) padSince[i] = performance.now(); if (!ids.length) delete padSince[i]; });
  if (myPad < 0 || starting) { $("padTimer").classList.add("hidden"); return; }
  const P = PADS[myPad], ids = counts[myPad].sort((a, b) => a - b), wait = 12 - (performance.now() - padSince[myPad]) / 1000;
  $("padTimer").classList.remove("hidden"); $("padTimer").innerHTML = `<b>${mapById(P.map).name}</b> · ${ids.length}/${P.cap} players<br>Starting in <b>${Math.max(0, Math.ceil(wait))}</b>...`;
  const leader = ids[0] === (hubConn && hubConn.open ? hubConn.id : 0);
  if ((wait <= 0 || ids.length >= P.cap) && leader) startFromPad(myPad, ids.slice(0, P.cap));
}
let starting = false;
function startFromPad(p, ids) {
  starting = true; const P = PADS[p], seed = Math.floor(Math.random() * 2147483000);
  if (ids.length <= 1 || !hubConn || !hubConn.open) { startMatch(P.map, seed, null, 1); return; }
  const code = newCode(); hubConn.send({ t: "tdgo", p, c: code, s: seed, m: P.map, ids });
  goMatch(P.map, seed, code, "create", ids.length);
}
function goMatch(map, seed, code, how, expect) {
  UI.toast("🔗 Connecting to the match...", "good");
  const conn = new Conn(code, how, (m) => {
    if (m.t === "welcome") { for (const p of m.players || []) names[p.id] = p.n; names[m.id] = "You"; startMatch(map, seed, conn, expect); conn.send({ t: "tdc", c: { a: "join" } }); return; }
    if (m.t === "join") names[m.id] = m.n;
    if (match) matchMsg(m);
  }, (why) => { if (mode === "match" && match && !match.ended) { UI.toast("Lost the connection to the match (" + why + "). Playing on alone.", "warn", 4000); } });
  if (how === "join") setTimeout(() => {}, 0);
}
// ---------------------------------------------------------------- a match
function startMatch(map, seed, conn, expect) {
  if (match) return;
  leaveHub(); UI.close(); starting = false; mode = "match";
  const solo = !conn;
  match = new Match({ renderer, camera, map, seed, ids: solo ? [0] : [], me: solo ? 0 : conn.id, conn, names, toast: UI.toast, done: endMatch, omega: () => {} });
  match.expect = expect; match.joined = new Set(); match.waiting = !solo && conn.isHost; match.waitT = performance.now();
  $("hud").classList.add("hidden"); SFX.wave();
}
// the match host waits until everyone has joined, then starts the clock (everyone gets the same "join" list on step 1)
function matchMsg(m) {
  if (match.waiting && m.t === "tdc" && m.c.a === "join") { match.joined.add(m.id); return; }
  match.onMsg(m);
}
function matchTick() {
  if (match.waiting && (match.joined.size >= match.expect || performance.now() - match.waitT > 9000) && match.joined.size) {
    match.waiting = false; match.hold = match.joined.size; // (the host's clock starts when its own "join" stamps come back)
    for (const id of [...match.joined].sort((a, b) => a - b)) match.conn.send({ t: "tdx", T: 1, c: { o: id, a: "join" } });
    match.conn.send({ t: "tdt", T: 0, h: 0 });
  }
}
function endMatch(res) {
  S.bolts += res.bolts; S.stats.matches++; if (res.won) S.stats.wins++; S.stats.waves += res.waves; S.stats.kills += res.kills; S.stats.bosses += res.bossKills;
  if (mapById(res.map).endless) S.stats.bestEndless = Math.max(S.stats.bestEndless, res.waves);
  if (res.omega && !S.omega) { S.omega = true; addTower("omega"); }
  save(); UI.setBolts();
  if (match.conn) match.conn.close(); match.dispose(); match = null; mode = "hub";
  $("hud").classList.remove("hidden"); me.x = 0; me.z = 1; me.y = 0; me.camYaw = 0; me.yaw = Math.PI; myPad = -1; padSince = {};
  UI.banner("+⚡" + fmt(res.bolts) + " BOLTS", "#ffd23a"); SFX.coin();
  connectHub();
}
// ---------------------------------------------------------------- the hub room (other players, pads, trades)
function connectHub() {
  if (Q.has("offline")) { $("net").textContent = "📴 Offline (playing alone)"; return; }
  $("net").textContent = "🔌 connecting...";
  const j = joinHub((m, conn) => {
    hubConn = conn;
    if (m.t === "welcome") { $("net").textContent = "🟢 Online · " + (m.players.length + 1) + " in the hub"; hub.clearOthers(); padOf.clear(); for (const p of m.players || []) { hub.addOther(p.id, p.n, colorOf(p.k)); names[p.id] = p.n; } conn.send({ t: "look", k: [S.color.toString(16).padStart(6, "0")] }); if (myPad >= 0) conn.send({ t: "tdpad", p: myPad }); }
    else if (m.t === "join") { hub.addOther(m.id, m.n, colorOf(m.k)); names[m.id] = m.n; if (myPad >= 0) conn.send({ t: "tdpad", p: myPad }); count(); }
    else if (m.t === "leave") { hub.removeOther(m.id); padOf.delete(m.id); count(); }
    else if (m.t === "s") hub.moveOther(m.id, m.p, m.r, m.w);
    else if (m.t === "look") { const o = hub.others.get(m.id); if (o) { const c = colorOf(m.k); hubScene.remove(o.m.root); o.m = avatarModel(c); hubScene.add(o.m.root); } }
    else if (m.t === "tdpad") padOf.set(m.id, m.p);
    else if (m.t === "tdgo") { if (m.ids.includes(conn.id) && m.id !== conn.id && !match) { starting = true; setTimeout(() => goMatch(m.m, m.s, m.c, "join", m.ids.length), 700); } for (const id of m.ids) padOf.delete(id); }
    else if (m.t === "tdtr") UI.tradeMsg(m);
    else if (m.t === "tdgive") UI.gotGift(m);
  }, (why) => { $("net").textContent = why === "full" ? "🔴 The hubs are full: playing alone" : "🔴 Offline (" + why + ")"; hubConn = null; if (mode === "hub" && why !== "full") { clearTimeout(hubTimer); hubTimer = setTimeout(connectHub, 5000); } });
  const count = () => { $("net").textContent = "🟢 Online · " + (hub.others.size + 1) + " in the hub"; };
}
const colorOf = (k) => (Array.isArray(k) && /^[0-9a-fA-F]{6}$/.test(k[0] || "") ? parseInt(k[0], 16) : 0x3ad0ff);
function leaveHub() { clearTimeout(hubTimer); if (hubConn) { hubConn.close(); hubConn = null; } hub.clearOthers(); padOf.clear(); $("net").textContent = "⚔ In a match"; }

// ---------------------------------------------------------------- the screens' helpers
UI.initUI({
  players: () => [...hub.others.entries()].map(([id, o]) => ({ id, name: o.name })),
  tradeSend: (to, o) => hubConn && hubConn.send({ t: "tdtr", to, ...o }),
  giveSend: (to, o) => hubConn && hubConn.send({ t: "tdgive", to, ...o }),
  devCmd: (c) => match && match.cmd(c, UI.getDevCode()),
  inMatch: () => !!match,
});
$("bDev").onclick = () => { audio(); UI.dev(); };
$("bLocker").onclick = () => { audio(); UI.locker(); };
$("bHelp").onclick = () => { audio(); UI.help(); };
$("bMute").onclick = () => { S.muted = !S.muted; setMuted(S.muted); $("bMute").textContent = S.muted ? "🔇" : "🔊"; save(); };
setMuted(S.muted); $("bMute").textContent = S.muted ? "🔇" : "🔊";
$("bPlay").onclick = () => { audio(); $("intro").classList.add("hidden"); $("hud").classList.remove("hidden"); canvas.focus(); };
UI.setBolts();

// ---------------------------------------------------------------- the loop
let last = performance.now();
function core(dt, draw = true) {
  if (mode === "hub") { hubStep(dt); if (draw) renderer.render(hubScene, camera); }
  else if (match) { matchTick(); match.update(dt, { ...I, click: I.click && !UI.isOpen() }); if (draw) renderer.render(match.scene, camera); }
  I.click = false; I.drag = null; I.wheel = 0; I.esc = false; I.num = 0; I.tapped = {};
}
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; core(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
connectHub();
// test hook
window.CT = { frames: (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) core(dt, false); }, S, me, hub, get match() { return match; }, startMatch: (map) => startMatch(map, 12345, null, 1), addTower, PADS, I, get hubConn() { return hubConn; }, UI };
