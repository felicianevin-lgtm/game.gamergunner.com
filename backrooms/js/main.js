// THE BACKROOMS (game.gamergunner.com/backrooms/): a first-person escape through four levels.
//   Level 0 the Lobby (maze + the Entity) -> the Poolrooms (platforms over water + the Crawler, throw rocks to distract it)
//   -> Level Fun (party rooms + Partygoers) -> the Deep Lobby (big maze + Captain Clark) -> ESCAPE: you win the
//   Backrooms hazmat suit and the Backrooms monster suit for your GunnerVerse avatar (avatar.js unlockSuit).
// A new maze every time you play a level. Caught = try that level again. Progress is saved in this browser.
import * as THREE from "/create/vendor/three.module.js";
import { LEVELS, neighbors } from "./levels.js";
import { make, preload } from "./creatures.js";
import { unlockSuit, loadAvatar, saveAvatar, avatarPicture } from "/create/js/avatar.js";
import { api, account } from "/create/js/net.js";

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const EYE = 1.6, RAD = 0.35, TALL = 1.8, WALK = 3.6, RUN = 6.4, JUMP = 5.2, GRAVITY = 15;

// ---------------------------------------------------------------- the 3D world
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
camera.rotation.order = "YXZ";
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5); scene.add(hemi);
const lamp = new THREE.PointLight(0xfff2c8, 2.5, 9, 1.6); scene.add(lamp); // (a little light around you)
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------------------------------------------------------------- what's going on
let lvl = 0, L = null, playing = false, paused = false, dying = 0, deathBy = "", loading = false;
const P = { pos: V(), vel: V(), yaw: 0, pitch: 0, grounded: true, stamina: 1, inWater: false, running: false, rocks: 0, bob: 0, stepD: 0, noise: 0 };
let mons = [], rocks = [], flying = [], ripples = [], time = 0;
let hash = new Map();
const save = { get() { try { return Math.max(0, Math.min(LEVELS.length - 1, Number(localStorage.getItem("gv_backrooms")) || 0)); } catch { return 0; } }, set(n) { try { localStorage.setItem("gv_backrooms", String(n)); } catch {} } };

// ---------------------------------------------------------------- solid boxes: a grid of buckets so only nearby walls are checked
const HC = 8, hk = (i, j) => i * 100003 + j;
function buildHash(boxes) {
  hash = new Map();
  for (const b of boxes) for (let i = Math.floor(b.x0 / HC); i <= Math.floor(b.x1 / HC); i++) for (let j = Math.floor(b.z0 / HC); j <= Math.floor(b.z1 / HC); j++) {
    const k = hk(i, j); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(b);
  }
}
let stamp = 0;
function near(x, z, r) {
  const out = []; stamp++;
  for (let i = Math.floor((x - r) / HC); i <= Math.floor((x + r) / HC); i++) for (let j = Math.floor((z - r) / HC); j <= Math.floor((z + r) / HC); j++) {
    const l = hash.get(hk(i, j)); if (l) for (const b of l) if (b._s !== stamp) { b._s = stamp; out.push(b); }
  }
  return out;
}
const inside = (p) => near(p.x, p.z, 0.1).some((b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y > b.y0 && p.y < b.y1);
function floorAt(x, z, y, rad) {
  let f = L.floorY;
  for (const b of near(x, z, rad)) if (x > b.x0 - rad * 0.6 && x < b.x1 + rad * 0.6 && z > b.z0 - rad * 0.6 && z < b.z1 + rad * 0.6 && b.y1 <= y + 0.05 && b.y1 > f) f = b.y1;
  return f;
}
// Push a body out of walls; low ledges (step) are climbed.
function collide(p, rad, tall, grounded, step) {
  for (const b of near(p.x, p.z, rad + 0.5)) {
    if (p.y >= b.y1 - 0.01 || p.y + tall <= b.y0) continue;
    const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1)), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= rad * rad) continue;
    if (grounded && b.y1 - p.y <= step) { p.y = b.y1; p.x = Math.max(b.x0 - rad * 0.4, Math.min(b.x1 + rad * 0.4, p.x)); p.z = Math.max(b.z0 - rad * 0.4, Math.min(b.z1 + rad * 0.4, p.z)); continue; } // (stepped up: now standing on it)
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (rad - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const o = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0]; p.x += o[1] * (o[0] + rad); p.z += o[2] * (o[0] + rad); }
  }
}
// Can a see b? (no wall in between)
function sees(a, b) {
  const d = a.distanceTo(b), n = Math.ceil(d / 0.45), p = V();
  for (let i = 1; i < n; i++) { p.lerpVectors(a, b, i / n); if (inside(p)) return false; }
  return true;
}
const waterAt = (x, z) => L.water.find((w) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1);

// ---------------------------------------------------------------- sound (all made in code)
let ac = null, master = null, hum = null;
function audio() { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination); } if (ac.state === "suspended") ac.resume(); return ac; }
function tone(f, len, type, slide, vol, delay = 0) { try { const a = audio(), t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len); g.gain.setValueAtTime(vol * 0.15, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len); o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05); } catch {} }
function noise(len, freq, vol, type = "lowpass", delay = 0) { try { const a = audio(), t = a.currentTime + delay, n = a.createBufferSource(), b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = a.createGain(); g.gain.value = vol * 0.4; n.connect(f); f.connect(g); g.connect(master); n.start(t); } catch {} }
function startHum(kind) {
  stopHum();
  try {
    const a = audio(), g = a.createGain(); g.gain.value = kind === "pool" ? 0.0 : 0.018; g.connect(master);
    const o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 60; o2.type = "sine"; o2.frequency.value = 120;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = kind === "party" ? 400 : 260;
    o1.connect(f); o2.connect(f); f.connect(g); o1.start(); o2.start();
    hum = { g, o: [o1, o2] };
  } catch {}
}
function stopHum() { if (hum) { try { hum.o.forEach((o) => o.stop()); hum.g.disconnect(); } catch {} hum = null; } }
const SFX = {
  step: () => noise(0.07, 700, 0.25), splashStep: () => noise(0.18, 1600, 0.35, "bandpass"), jump: () => noise(0.1, 500, 0.2),
  splash: () => { noise(0.5, 1800, 0.9, "bandpass"); noise(0.4, 500, 0.5); }, pickup: () => tone(520, 0.08, "square", 780, 0.6),
  throw: () => noise(0.15, 2200, 0.4, "bandpass"), drip: () => tone(1400 + Math.random() * 600, 0.25, "sine", 900, 0.25),
  party: () => [523, 659, 784].forEach((f, i) => tone(f * (Math.random() < 0.5 ? 1 : 0.75), 0.4, "triangle", 0, 0.12, i * 0.18)),
  giggle: () => [880, 990, 880, 1046].forEach((f, i) => tone(f, 0.1, "square", 0, 0.25, i * 0.08)),
  chase: () => { tone(110, 0.8, "sawtooth", 55, 0.6); noise(0.6, 300, 0.4); },
  scream: () => { noise(1.2, 3000, 0.9, "highpass"); tone(1400, 1.0, "sawtooth", 300, 0.8); tone(1180, 1.0, "square", 250, 0.6); },
  door: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.25, "triangle", 0, 0.5, i * 0.12)),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, "square", 0, 0.4, i * 0.14)),
  heart: () => { tone(60, 0.12, "sine", 40, 1.2); tone(55, 0.12, "sine", 38, 1.0, 0.18); },
};

// ---------------------------------------------------------------- input
const keys = new Set();
let wantJump = false, wantGrab = false, wantThrow = false;
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "w", "a", "s", "d", "shift", "e", "f"].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === " ") wantJump = true;
  if (k === "e") wantGrab = true;
  if (k === "f") wantThrow = true;
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
canvas.addEventListener("click", () => { audio(); if (playing && !touch && document.pointerLockElement !== canvas) { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } });
canvas.addEventListener("mousedown", (e) => { if (playing && document.pointerLockElement === canvas && e.button === 0) wantThrow = true; });
addEventListener("mousemove", (e) => { if (document.pointerLockElement !== canvas || !playing || dying) return; P.yaw -= e.movementX * 0.0022; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * 0.0022)); });
document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement !== canvas && playing && !dying && !touch && !$("done").offsetParent) setPause(true); });
// touch: a stick on the left, drag the right side to look, buttons
const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
const stick = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => {
  audio();
  if (e.pointerType !== "touch" || !playing) return;
  if (e.clientX < innerWidth * 0.45 && stick.id === null) { stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.dx = stick.dy = 0; }
  else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
});
addEventListener("pointermove", (e) => {
  if (e.pointerId === stick.id) { stick.dx = e.clientX - stick.x; stick.dy = e.clientY - stick.y; const l = Math.hypot(stick.dx, stick.dy); if (l > 55) { stick.dx *= 55 / l; stick.dy *= 55 / l; } }
  if (e.pointerId === look.id && !dying) { P.yaw -= (e.clientX - look.x) * 0.006; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - (e.clientY - look.y) * 0.006)); look.x = e.clientX; look.y = e.clientY; }
});
const lift = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; } if (e.pointerId === look.id) look.id = null; };
addEventListener("pointerup", lift); addEventListener("pointercancel", lift);
if (touch) {
  document.body.classList.add("touch");
  $("tJump").onpointerdown = (e) => { e.preventDefault(); wantJump = true; };
  $("tRun").onpointerdown = (e) => { e.preventDefault(); keys.add("shift"); }; $("tRun").onpointerup = $("tRun").onpointerleave = () => keys.delete("shift");
  $("tGrab").onpointerdown = (e) => { e.preventDefault(); wantGrab = true; };
  $("tThrow").onpointerdown = (e) => { e.preventDefault(); wantThrow = true; };
}

// ---------------------------------------------------------------- levels
async function startLevel(n) {
  loading = true; playing = false; dying = 0;
  $("loadMsg").textContent = "Loading " + LEVELS[n].name + "…"; $("loadMsg").classList.remove("hidden");
  if (L) { scene.remove(L.group); L.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  for (const m of mons) scene.remove(m.c.g);
  for (const r of rocks) scene.remove(r.m);
  for (const r of flying) scene.remove(r.m);
  for (const r of ripples) scene.remove(r.m);
  mons = []; rocks = []; flying = []; ripples = [];
  lvl = n;
  const def = LEVELS[n];
  L = def.build((Math.random() * 1e9) | 0);
  scene.add(L.group); buildHash(L.boxes);
  scene.background = new THREE.Color(L.bg); scene.fog = new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]);
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  lamp.intensity = L.pool ? 0 : 2.5;
  P.pos.set(L.start.x, floorAt(L.start.x, L.start.z, 5, RAD), L.start.z); P.vel.set(0, 0, 0); P.yaw = L.start.yaw; P.pitch = 0; P.stamina = 1; P.rocks = 0; P.grounded = true;
  for (const r of L.rocks) addRock(V(r.x, r.y, r.z));
  for (const m of L.monsters) {
    const c = await make(m.kind);
    scene.add(c.g);
    const S = { entity: [1.6, 4.6, 20, "the Entity"], crawler: [2.6, 10.5, 0, "the Crawler"], partygoer: [1.5, 4.7, 16, "a Partygoer"], clark: [2.0, 5.3, 24, "Captain Clark"] }[m.kind];
    const y = m.kind === "crawler" ? L.pool.FLOOR : 0;
    mons.push({ kind: m.kind, c, pos: V(m.x, y, m.z), yaw: Math.random() * 6, walk: S[0], chase: S[1], seeR: S[2], name: S[3], state: "wander", goal: null, path: null, pathT: 0, seeT: 0, lastSeen: null, searchT: 0, distract: null, alarm: 0, giggleT: 3 + Math.random() * 5 });
  }
  startHum(L.pool ? "pool" : n === 2 ? "party" : "lobby");
  $("loadMsg").classList.add("hidden");
  $("lvlName").textContent = def.name; $("lvlSub").textContent = def.sub; $("goal").textContent = def.goal;
  const t = $("title"); t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
  $("hud").classList.remove("hidden");
  playing = true; loading = false; paused = false;
  setPause(false);
}
function addRock(at) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: 0x8c8a84 }));
  m.position.copy(at); scene.add(m);
  rocks.push({ m });
}

// ---------------------------------------------------------------- the player
function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (keys.has("w") || keys.has("arrowup")) fz += 1;
  if (keys.has("s") || keys.has("arrowdown")) fz -= 1;
  if (keys.has("d") || keys.has("arrowright")) fx += 1;
  if (keys.has("a") || keys.has("arrowleft")) fx -= 1;
  if (stick.id !== null) { fx = stick.dx / 55; fz = -stick.dy / 55; }
  const f = V(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), r = V(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const want = f.multiplyScalar(fz).add(r.multiplyScalar(fx));
  if (want.lengthSq() > 1) want.normalize();
  const w = waterAt(P.pos.x, P.pos.z);
  P.inWater = !!w && P.pos.y < w.top - 0.05;
  P.running = keys.has("shift") && want.lengthSq() > 0.1 && P.stamina > 0.02 && !P.inWater;
  P.stamina = Math.max(0, Math.min(1, P.stamina + (P.running ? -0.2 : 0.14) * dt));
  want.multiplyScalar((P.running ? RUN : WALK) * (P.inWater ? 0.8 : 1));
  const k = 1 - Math.exp(-(P.grounded ? 12 : 3) * dt);
  P.vel.x += (want.x - P.vel.x) * k; P.vel.z += (want.z - P.vel.z) * k;
  if (wantJump && P.grounded) { P.vel.y = P.inWater ? 4 : JUMP; P.grounded = false; SFX.jump(); }
  wantJump = false;
  P.vel.y -= GRAVITY * dt;
  const prevY = P.pos.y;
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  collide(P.pos, RAD, TALL, P.grounded, P.inWater ? 1.0 : 0.45); // (in the water you can climb out onto a platform)
  P.pos.y += P.vel.y * dt;
  const fl = floorAt(P.pos.x, P.pos.z, Math.max(prevY, P.pos.y), RAD);
  if (P.pos.y <= fl) { if (!P.grounded && P.vel.y < -6) SFX.step(); P.pos.y = fl; P.vel.y = 0; P.grounded = true; }
  else if (P.pos.y > fl + 0.05) P.grounded = false;
  if (L.ceilingH && P.pos.y + TALL > L.ceilingH) { P.pos.y = L.ceilingH - TALL; P.vel.y = Math.min(0, P.vel.y); }
  // footsteps (monsters can hear you running)
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (P.grounded) { P.stepD += sp * dt; P.bob += sp * dt * 2.2; if (P.stepD > (P.running ? 2.0 : 1.6)) { P.stepD = 0; (P.inWater ? SFX.splashStep : SFX.step)(); if (P.running) P.noise = 0.6; } }
  P.noise = Math.max(0, P.noise - dt);
  camera.position.set(P.pos.x, P.pos.y + EYE + Math.sin(P.bob) * 0.04 * Math.min(1, sp / 3), P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
  lamp.position.set(P.pos.x, P.pos.y + 2.2, P.pos.z);
  // rocks: pick up (E) and throw (F / click)
  let nearRock = null;
  for (const R of rocks) if (R.m.position.distanceTo(P.pos.clone().setY(R.m.position.y)) < 1.8 && Math.abs(R.m.position.y - P.pos.y) < 1.5) nearRock = R;
  $("prompt").textContent = nearRock && P.rocks < 3 ? (touch ? "Tap ✋ to pick up the rock" : "Press E to pick up the rock") : "";
  if (wantGrab && nearRock && P.rocks < 3) { scene.remove(nearRock.m); rocks.splice(rocks.indexOf(nearRock), 1); P.rocks++; SFX.pickup(); }
  if (wantThrow && P.rocks > 0) {
    P.rocks--; SFX.throw();
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: 0x8c8a84 }));
    m.position.copy(camera.position).addScaledVector(dir, 0.5); scene.add(m);
    flying.push({ m, v: dir.multiplyScalar(16).add(V(0, 3.5, 0)) });
  }
  wantGrab = wantThrow = false;
  $("rocks").textContent = P.rocks ? "🪨 x" + P.rocks + (touch ? "" : "  (F or click to throw)") : "";
  $("rocks").classList.toggle("hidden", !P.rocks);
  $("stam").style.width = P.stamina * 100 + "%";
  $("stamWrap").classList.toggle("low", P.stamina < 0.25);
  $("water").classList.toggle("on", P.inWater);
  // the exit
  if (Math.hypot(P.pos.x - L.exit.x, P.pos.z - L.exit.z) < L.exit.r) levelDone();
}
function updateRocks(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const R = flying[i];
    R.v.y -= GRAVITY * dt; R.m.position.addScaledVector(R.v, dt); R.m.rotation.x += dt * 8;
    const p = R.m.position, w = waterAt(p.x, p.z);
    if (w && p.y < w.top) { // splash! the Crawler goes to look
      SFX.splash(); splashFx(V(p.x, w.top, p.z));
      for (const m of mons) if (m.kind === "crawler") m.distract = { pos: V(p.x, 0, p.z), t: 6 };
      scene.remove(R.m); flying.splice(i, 1); continue;
    }
    const fl = floorAt(p.x, p.z, p.y, 0.1);
    if (inside(p) || p.y <= fl + 0.1) { // landed on something dry: it's a rock you can pick up again
      if (inside(p)) p.addScaledVector(R.v.clone().normalize(), -0.3);
      p.y = floorAt(p.x, p.z, p.y + 0.5, 0.1) + 0.15; noise(0.08, 900, 0.3);
      rocks.push({ m: R.m }); flying.splice(i, 1);
    }
  }
  for (let i = ripples.length - 1; i >= 0; i--) { const R = ripples[i]; R.t += dt; R.m.scale.setScalar(0.3 + R.t * 4); R.m.material.opacity = 0.8 * (1 - R.t / 1.2); if (R.t > 1.2) { scene.remove(R.m); ripples.splice(i, 1); } }
}
function splashFx(at, big = true) {
  for (let k = 0; k < (big ? 3 : 1); k++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.copy(at).setY(at.y + 0.02); scene.add(m); ripples.push({ m, t: -k * 0.25 });
  }
}

// ---------------------------------------------------------------- monsters
const cellOf = (g, p) => [Math.max(0, Math.min(g.W - 1, Math.floor((p.x - g.x0) / g.cell))), Math.max(0, Math.min(g.H - 1, Math.floor((p.z - g.z0) / g.cell)))];
const cellMid = (g, i, j) => V(g.x0 + (i + 0.5) * g.cell, 0, g.z0 + (j + 0.5) * g.cell);
// The next room to walk into on the shortest way from a to b.
function nextStep(g, a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return null;
  const prev = new Map(), q = [a], key = (c) => c[0] * 1000 + c[1];
  prev.set(key(a), null);
  while (q.length) {
    const c = q.shift();
    if (c[0] === b[0] && c[1] === b[1]) { let s = c; while (prev.get(key(s)) && (prev.get(key(s))[0] !== a[0] || prev.get(key(s))[1] !== a[1])) s = prev.get(key(s)); return s; }
    for (const n of neighbors(g, c[0], c[1])) if (!prev.has(key(n))) { prev.set(key(n), c); q.push(n); }
  }
  return null;
}
function updateMonsters(dt) {
  let danger = 0;
  const eyeP = V(P.pos.x, P.pos.y + EYE, P.pos.z);
  for (const m of mons) {
    m.pathT -= dt; m.seeT -= dt;
    let goal = null, speed = m.walk;
    const d = Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
    if (m.kind === "crawler") {
      // It lives in the water. Touch the water and it races at you. Splashes (thrown rocks) pull it away.
      if (m.distract && (m.distract.t -= dt) > 0) { goal = m.distract.pos; speed = 7; m.state = "distracted"; }
      else if (P.inWater) { goal = P.pos; speed = m.chase; if (m.state !== "chase") SFX.chase(); m.state = "chase"; m.alarm = 2; }
      else { m.alarm -= dt; if (!m.goal || Math.hypot(m.goal.x - m.pos.x, m.goal.z - m.pos.z) < 1.5 || m.pathT < -6) { const w = L.water[0]; m.goal = V(w.x0 + 2 + Math.random() * (w.x1 - w.x0 - 4), 0, Math.max(w.z0 + 3, Math.min(w.z1 - 3, P.pos.z + (Math.random() - 0.5) * 50))); m.pathT = 0; } goal = m.goal; m.state = "wander"; }
      move(m, goal, speed, dt, 0.5);
      const w = L.water[0]; m.pos.x = Math.max(w.x0 + 0.5, Math.min(w.x1 - 0.5, m.pos.x)); m.pos.z = Math.max(w.z0 + 0.5, Math.min(w.z1 - 0.5, m.pos.z)); m.pos.y = L.pool.FLOOR;
      if (m.state === "chase") danger = Math.max(danger, 1 - Math.min(1, d / 30));
      if (P.inWater && d < 1.4) return caught(m);
      continue;
    }
    // Land monsters: they see you (in front of nothing solid, close enough), hear you running, chase, search, wander.
    if (m.seeT <= 0) {
      m.seeT = 0.2;
      const mEye = V(m.pos.x, m.c.height * 0.85, m.pos.z);
      const canSee = d < 2.2 || (d < m.seeR && sees(mEye, eyeP));
      if (canSee) { if (m.state !== "chase") { SFX.chase(); if (m.kind === "partygoer") SFX.giggle(); } m.state = "chase"; m.lastSeen = P.pos.clone(); }
      else if (m.state === "chase") { m.state = "search"; m.searchT = 6; }
      else if (P.noise > 0 && d < 14 && m.state === "wander") { m.state = "search"; m.lastSeen = P.pos.clone(); m.searchT = 5; }
    }
    if (m.state === "chase") { goal = P.pos; speed = m.chase; }
    else if (m.state === "search") { goal = m.lastSeen; speed = (m.walk + m.chase) / 2; m.searchT -= dt; if (m.searchT <= 0 || Math.hypot(goal.x - m.pos.x, goal.z - m.pos.z) < 1) m.state = "wander"; }
    else { if (!m.goal || Math.hypot(m.goal.x - m.pos.x, m.goal.z - m.pos.z) < 1 || m.pathT < -15) { const g = L.grid; m.goal = cellMid(g, Math.floor(Math.random() * g.W), Math.floor(Math.random() * g.H)); m.pathT = 0; } goal = m.goal; }
    // find the way (rooms of the maze)
    const g = L.grid, mc = cellOf(g, m.pos), gc = cellOf(g, goal);
    if (m.pathT <= 0 || !m.via) { m.via = nextStep(g, mc, gc); m.pathT = 0.25; }
    let to = goal;
    if (m.via && (m.via[0] !== mc[0] || m.via[1] !== mc[1])) to = cellMid(g, m.via[0], m.via[1]);
    move(m, to, speed, dt, 0.4);
    if (m.kind === "partygoer" && (m.giggleT -= dt) < 0 && d < 20) { m.giggleT = 5 + Math.random() * 6; SFX.giggle(); }
    if (m.state === "chase") danger = Math.max(danger, 1 - Math.min(1, d / m.seeR));
    if (d < 1.1) return caught(m);
  }
  // heartbeat + red edges when something is after you
  $("danger").style.opacity = String(danger * 0.85);
  heartT -= 0.016 + danger * 0.05;
  if (danger > 0.05 && heartT < 0) { heartT = 1; SFX.heart(); }
}
let heartT = 0;
function move(m, to, speed, dt, rad) {
  const dx = to.x - m.pos.x, dz = to.z - m.pos.z, d = Math.hypot(dx, dz);
  let sp = 0;
  if (d > 0.3) {
    const step = Math.min(d, speed * dt);
    const before = m.pos.clone();
    m.pos.x += dx / d * step; m.pos.z += dz / d * step;
    const y = m.pos.y; m.pos.y = m.kind === "crawler" ? L.pool.FLOOR : 0;
    collide(m.pos, rad, m.kind === "crawler" ? 0.5 : 2.5, false, 0);
    m.pos.y = y;
    sp = dt > 0 ? m.pos.distanceTo(before) / dt : 0;
    let df = Math.atan2(dx, dz) - m.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); m.yaw += df * Math.min(1, dt * 8);
  }
  m.c.g.position.copy(m.pos); m.c.g.rotation.y = m.yaw;
  m.c.animate(dt, sp);
}
function caught(m) {
  if (dying || god) return;
  dying = 0.001; deathBy = m.name; playing = false;
  SFX.scream(); stopHum();
  if (document.pointerLockElement) document.exitPointerLock();
  $("jump").classList.remove("on"); void $("jump").offsetWidth; $("jump").classList.add("on");
  // turn to face it
  const target = V(m.pos.x, (m.kind === "crawler" ? L.pool.FLOOR : 0) + m.c.height * 0.85, m.pos.z);
  dyingLook = { from: camera.quaternion.clone(), to: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, target, V(0, 1, 0))) };
  setTimeout(() => { $("deadBy").textContent = "You got caught by " + deathBy + "."; $("dead").classList.remove("hidden"); }, 1300);
}
let dyingLook = null;

// ---------------------------------------------------------------- winning
function levelDone() {
  if (!playing) return;
  playing = false; SFX.door();
  if (document.pointerLockElement) document.exitPointerLock();
  if (L.final) return escaped();
  save.set(lvl + 1);
  $("fade").classList.add("on");
  setTimeout(() => { startLevel(lvl + 1).then(() => $("fade").classList.remove("on")); }, 900);
}
function escaped() {
  save.set(0); stopHum(); SFX.win();
  unlockSuit("hazmat"); unlockSuit("monster");
  const av = loadAvatar();
  $("suitA").src = avatarPicture({ ...av, suit: "hazmat" }, 220, true);
  $("suitB").src = avatarPicture({ ...av, suit: "monster" }, 220, true);
  $("hud").classList.add("hidden"); $("done").classList.remove("hidden");
}
function wear(suit) {
  const av = { ...loadAvatar(), suit };
  saveAvatar(av);
  const a = account();
  if (a) api("/social/avatar", { t: a.t, a: av }).catch(() => {}); // (your account too, so friends see it)
  $("wornMsg").textContent = suit === "none" ? "Suit off." : "You're wearing it! Your avatar changed everywhere on GunnerVerse.";
}
$("wearA").onclick = () => wear("hazmat");
$("wearB").onclick = () => wear("monster");

// ---------------------------------------------------------------- menus
function setPause(on) {
  paused = on && playing;
  $("pause").classList.toggle("hidden", !paused);
  if (!on && playing && !touch) { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch {} }
}
$("resume").onclick = () => setPause(false);
$("quit").onclick = () => location.reload();
$("again").onclick = () => { $("dead").classList.add("hidden"); startLevel(lvl); };
$("start").onclick = () => { audio(); $("menu").classList.add("hidden"); save.set(0); startLevel(0); };
$("cont").onclick = () => { audio(); $("menu").classList.add("hidden"); startLevel(save.get()); };
$("playAgain").onclick = () => { $("done").classList.add("hidden"); startLevel(0); };
if (save.get() > 0) { $("cont").classList.remove("hidden"); $("cont").textContent = "▶ Continue: " + LEVELS[save.get()].sub; }
$("controls").innerHTML = touch ? "Left side: walk · Right side: look · 🏃 run · ⤒ jump · ✋ pick up rock · 🪨 throw"
  : "<b>WASD</b> walk · <b>Mouse</b> look · <b>Shift</b> run · <b>Space</b> jump · <b>E</b> pick up a rock · <b>F</b> or <b>click</b> throw it · <b>Esc</b> pause";
preload("partygoer"); preload("clark");

// ---------------------------------------------------------------- every frame
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  tick(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}
function tick(dt) {
  if (!(dt > 0)) return;
  time += dt;
  if (L && L.waterMesh) { L.waterMesh.material.map.offset.x = Math.sin(time * 0.3) * 0.05; L.waterMesh.material.map.offset.y = time * 0.02; }
  if (L) for (const f of L.flicker) if (Math.random() < 0.04) f.visible = !f.visible || Math.random() < 0.6;
  if (dying) { dying += dt; if (dyingLook) camera.quaternion.slerpQuaternions(dyingLook.from, dyingLook.to, Math.min(1, dying * 5)); return; }
  if (!playing || paused || loading) return;
  updatePlayer(dt);
  if (!playing) return;
  updateMonsters(dt);
  updateRocks(dt);
  if (L.pool && Math.random() < dt * 0.4) SFX.drip();
  if (lvl === 2 && Math.random() < dt * 0.08) SFX.party();
}
requestAnimationFrame(frame);
let god = false; // (testing only)
window.BR = { render() { renderer.render(scene, camera); }, get P() { return P; }, get mons() { return mons; }, get L() { return L; }, startLevel, step(n) { for (let i = 0; i < n; i++) tick(1 / 60); }, keys, levelDone, get playing() { return playing; }, set god(v) { god = v; } }; // (for testing)
