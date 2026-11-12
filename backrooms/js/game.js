// THE BACKROOMS game engine, shared by two games (each game's js/main.js calls run({levels, saveKey})):
//   The Backrooms (site/backrooms/): four levels, Level 0 the Lobby -> the Poolrooms -> Level Fun -> the Deep Lobby.
//   Backrooms Survival (site/backroomsurvival/): twelve levels, more monsters every level.
// First person. A new maze every time you play a level. Caught = try that level again. Progress is saved in this browser.
// Escaping the last level wins the Backrooms hazmat suit and the Backrooms monster suit for your avatar (avatar.js unlockSuit).
// Chase music (made in code) plays while anything is chasing you. If Captain Clark catches you there's a short
// cartoon-horror cutscene (he grabs you, bites, throws you into the wall, stomps over and kicks with his peg leg).
import * as THREE from "/create/vendor/three.module.js";
import { neighbors } from "./levels.js";
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
let LEVELS = [], SAVE_KEY = "gv_backrooms"; // (set by run())
const save = { get() { try { return Math.max(0, Math.min(LEVELS.length - 1, Number(localStorage.getItem(SAVE_KEY)) || 0)); } catch { return 0; } }, set(n) { try { localStorage.setItem(SAVE_KEY, String(n)); } catch {} } };

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
  // Captain Clark: a deep wobbly growl, and heavy footsteps that go THUD (boot) ... KNOCK (peg leg)
  growl: (v = 1) => { growl(1.6, v); },
  bootStep: (v = 1) => { tone(70, 0.22, "sine", 38, 1.6 * v); noise(0.14, 260, 0.9 * v); },
  pegStep: (v = 1) => { tone(820, 0.07, "triangle", 420, 0.9 * v); tone(410, 0.1, "square", 260, 0.35 * v); noise(0.05, 2600, 0.5 * v, "bandpass"); },
  grab: () => { noise(0.35, 900, 0.8, "bandpass"); tone(90, 0.4, "sawtooth", 60, 0.6); },
  bite: () => { for (let i = 0; i < 4; i++) noise(0.05, 3500, 0.9, "highpass", i * 0.045); tone(300, 0.25, "square", 120, 0.5); growl(0.7, 1.2); },
  whoosh: () => noise(0.45, 1200, 0.8, "bandpass"),
  slam: () => { tone(55, 0.5, "sine", 28, 2.4); noise(0.4, 400, 1.2); noise(0.12, 2000, 0.6, "bandpass"); },
  kick: () => { noise(0.2, 1500, 0.7, "bandpass"); tone(80, 0.45, "sine", 30, 2.6, 0.12); noise(0.3, 500, 1.3, "lowpass", 0.12); tone(1600, 0.6, "sine", 1500, 0.25, 0.2); },
  doom: () => { tone(49, 2.5, "sawtooth", 41, 0.9); tone(52, 2.5, "sawtooth", 43, 0.7); noise(2.2, 160, 0.5); },
};
function growl(len, vol) {
  try {
    const a = audio(), t = a.currentTime, o = a.createOscillator(), lfo = a.createOscillator(), lg = a.createGain(), bp = a.createBiquadFilter(), g = a.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(68, t); o.frequency.linearRampToValueAtTime(48, t + len);
    lfo.frequency.value = 9; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
    bp.type = "bandpass"; bp.Q.value = 3; bp.frequency.setValueAtTime(520, t); bp.frequency.linearRampToValueAtTime(240, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.15); g.gain.setValueAtTime(0.5 * vol, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(bp); bp.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
    noise(len, 180, 0.35 * vol);
  } catch {}
}

// ---------------------------------------------------------------- chase music (made in code, no files)
// Starts the moment anything is chasing you and fades out after the chase ends. A fast, low minor-key pulse
// with creeping half steps, drum hits, sharp string stabs and a screeching high tremolo when it's really close.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CH_BASS = [38, 38, 50, 38, 39, 38, 50, 37, 38, 38, 50, 38, 41, 40, 39, 37]; // (eighth notes, D minor)
const CH_HIGH = [74, 75, 74, 77, 74, 75, 78, 77];
const mus = { bus: null, on: false, timer: null, step: 0, next: 0, heat: 0, offAt: 0 };
function mTone(t, f, len, type, vol, slide = 0, attack = 0.004) {
  const a = ac, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.15, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + len + 0.05);
}
let mNoiseBuf = null;
function mNoise(t, len, freq, vol, type = "lowpass") {
  const a = ac;
  if (!mNoiseBuf) { mNoiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = mNoiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  n.buffer = mNoiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(f); f.connect(g); g.connect(mus.bus); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
}
function musicTick() {
  if (!ac || ac.state !== "running") return;
  if (!mus.on && ac.currentTime > mus.offAt + 4) { clearInterval(mus.timer); mus.timer = null; return; } // (faded out: stop)
  const s16 = 60 / 172 / 4;
  if (mus.next < ac.currentTime) mus.next = ac.currentTime + 0.05;
  while (mus.next < ac.currentTime + 0.25) {
    const i = mus.step % 32, t = mus.next, hot = mus.heat;
    if (i % 2 === 0) { const n = CH_BASS[(mus.step >> 1) % 16]; mTone(t, NOTE(n), s16 * 1.7, "sawtooth", 0.55); mTone(t, NOTE(n - 12), s16 * 1.9, "sine", 0.9); }
    if (i % 8 === 0) mTone(t, 140, 0.22, "sine", 2.2, 38, 0.002); // (boom)
    if (i === 14 || i === 30) mTone(t, 110, 0.18, "sine", 1.6, 45, 0.002);
    if (i % 8 === 4) mNoise(t, 0.14, 1800, 0.8, "bandpass");
    if (i % 2 === 1) mNoise(t, 0.03, 8000, 0.25, "highpass");
    if ([6, 14, 22, 27].includes(i)) for (const n of [62, 65, 68]) { mTone(t, NOTE(n) * 1.004, 0.13, "sawtooth", 0.28); mTone(t, NOTE(n) * 0.996, 0.13, "sawtooth", 0.28); } // (diminished stabs)
    if (hot > 0.45) mTone(t, NOTE(CH_HIGH[(mus.step >> 2) % 8] + 12), s16 * 0.9, "square", 0.09 + hot * 0.08); // (screech when it's close)
    if ((mus.step >> 5) % 4 === 3 && i === 0) mTone(t, NOTE(86), s16 * 30, "sine", 0.18, NOTE(98), 0.6); // (rising whistle)
    mus.next += s16; mus.step++;
  }
}
// on: is anything chasing you; heat 0..1 = how close
function chaseMusic(on, heat = 0) {
  if (!ac) return;
  if (!mus.bus) { mus.bus = ac.createGain(); mus.bus.gain.value = 0; mus.bus.connect(master); }
  mus.heat = heat;
  const target = on ? 0.55 + 0.45 * heat : 0;
  if (on && !mus.on) { mus.step = 0; mus.next = 0; }
  if (!on && mus.on) mus.offAt = ac.currentTime;
  mus.on = on;
  mus.bus.gain.setTargetAtTime(target, ac.currentTime, on ? 0.12 : 0.9); // (fades in fast, out slowly)
  if (on && !mus.timer) mus.timer = setInterval(musicTick, 60);
}
function stopMusicNow() { if (mus.bus && ac) { mus.bus.gain.cancelScheduledValues(ac.currentTime); mus.bus.gain.setTargetAtTime(0, ac.currentTime, 0.05); } mus.on = false; if (ac) mus.offAt = ac.currentTime; }

// ---------------------------------------------------------------- input
const keys = new Set();
let wantJump = false, wantGrab = false, wantThrow = false;
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "w", "a", "s", "d", "shift", "e", "f", "m", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === " ") wantJump = true;
  if (k === "e") wantGrab = true;
  if (k === "f") wantThrow = true;
  if (k === "m") bigMap = !bigMap;
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
  loading = true; playing = false; dying = 0; dyingLook = null; cut = null;
  $("jump").classList.remove("on"); $("dead").classList.add("hidden"); overlay("black").classList.remove("on"); // (the caught screen goes away)
  stopMusicNow();
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
  P.pos.set(L.start.x, floorAt(L.start.x, L.start.z, 5, RAD), L.start.z); P.vel.set(0, 0, 0); P.yaw = L.start.yaw; P.pitch = 0; P.stamina = 1; P.tired = false; P.rocks = 0; P.grounded = true;
  for (const r of L.rocks) addRock(V(r.x, r.y, r.z));
  for (const m of L.monsters) {
    const c = await make(m.kind);
    scene.add(c.g);
    // [walk, chase, how far it sees, name]. The Crawler (the water monster) is the fastest thing down here.
    const S = { bacteria: [1.6, 4.6, 20, "the Bacteria"], entity: [1.6, 4.6, 20, "the Entity"], crawler: [5, 27, 0, "the Crawler"], partygoer: [1.5, 4.7, 16, "a Partygoer"], clark: [2.4, 5.6, 26, "Captain Clark"] }[m.kind];
    const y = m.kind === "crawler" ? L.pool.FLOOR : 0;
    mons.push({ kind: m.kind, c, pos: V(m.x, y, m.z), yaw: Math.random() * 6, walk: S[0], chase: S[1], seeR: S[2], name: S[3], state: "wander", goal: null, path: null, pathT: 0, seeT: 0, lastSeen: null, searchT: 0, distract: null, alarm: 0, giggleT: 3 + Math.random() * 5, growlT: 4 + Math.random() * 4, stepD: 0, stepN: 0 });
  }
  drawLayout();
  startHum(L.pool ? "pool" : L.party ? "party" : "lobby");
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
  if (keys.has("w")) fz += 1;
  if (keys.has("s")) fz -= 1;
  if (keys.has("d")) fx += 1;
  if (keys.has("a")) fx -= 1;
  // arrow keys look around (the mouse does too)
  if (!dying) {
    if (keys.has("arrowleft")) P.yaw += dt * 2.4; if (keys.has("arrowright")) P.yaw -= dt * 2.4;
    if (keys.has("arrowup")) P.pitch = Math.min(1.45, P.pitch + dt * 1.6); if (keys.has("arrowdown")) P.pitch = Math.max(-1.45, P.pitch - dt * 1.6);
  }
  if (stick.id !== null) { fx = stick.dx / 55; fz = -stick.dy / 55; }
  const f = V(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), r = V(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const want = f.multiplyScalar(fz).add(r.multiplyScalar(fx));
  if (want.lengthSq() > 1) want.normalize();
  const w = waterAt(P.pos.x, P.pos.z);
  P.inWater = !!w && P.pos.y < w.top - 0.05;
  // out of breath: once the run bar is empty you walk until it's a third full again (it used to start running again right away)
  if (P.stamina <= 0.01) P.tired = true; else if (P.stamina >= 0.35) P.tired = false;
  P.running = keys.has("shift") && want.lengthSq() > 0.1 && !P.tired && !P.inWater;
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
  $("stamWrap").classList.toggle("low", P.stamina < 0.25 || !!P.tired);
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
      if (m.distract && (m.distract.t -= dt) > 0) { goal = m.distract.pos; speed = 18; m.state = "distracted"; }
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
    const sp = move(m, to, speed, dt, 0.4);
    if (m.kind === "partygoer" && (m.giggleT -= dt) < 0 && d < 20) { m.giggleT = 5 + Math.random() * 6; SFX.giggle(); }
    if (m.kind === "clark") { // you HEAR him coming: boot... peg... boot... peg... and a growl now and then
      const v = Math.max(0, 1 - d / 20);
      m.stepD += sp * dt; if (m.stepD > 1.35) { m.stepD = 0; if (v > 0) (m.stepN++ % 2 ? SFX.pegStep : SFX.bootStep)(v); }
      if ((m.growlT -= dt) < 0) { m.growlT = m.state === "chase" ? 2.5 + Math.random() * 2 : 6 + Math.random() * 6; if (d < 24) SFX.growl(Math.max(0.25, v)); }
    }
    if (m.state === "chase") danger = Math.max(danger, 1 - Math.min(1, d / m.seeR));
    if (d < (m.kind === "clark" ? 1.3 : 1.1)) return caught(m);
  }
  // chase music while anything is chasing you (the Crawler counts too), heartbeat + red edges
  const chasing = mons.some((m) => m.state === "chase");
  chaseMusic(chasing, danger);
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
  m.c.animate(dt, sp, m.state === "chase");
  return sp;
}
function caught(m) {
  if (dying || god) return;
  dying = 0.001; deathBy = m.name; playing = false;
  stopMusicNow(); stopHum();
  $("danger").style.opacity = "0";
  if (document.pointerLockElement) document.exitPointerLock();
  if (m.kind === "clark" && m.c.pose) return clarkCutscene(m);
  SFX.scream();
  $("jump").classList.remove("on"); void $("jump").offsetWidth; $("jump").classList.add("on");
  // turn to face it
  const target = V(m.pos.x, (m.kind === "crawler" ? L.pool.FLOOR : 0) + m.c.height * 0.85, m.pos.z);
  dyingLook = { from: camera.quaternion.clone(), to: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, target, V(0, 1, 0))) };
  setTimeout(() => { $("deadBy").textContent = "You got caught by " + deathBy + "."; $("dead").classList.remove("hidden"); }, 1300);
}
let dyingLook = null;

// ---------------------------------------------------------------- Captain Clark's catch: a short cartoon-horror cutscene
// He grabs you and lifts you up to his face, CHOMP (your shoulder), throws you into the wall, stomps over
// (boot... peg... boot... peg...) and kicks you in the face with his peg leg. Lights out. Then the CAUGHT screen.
// Seen through your own eyes. No gore: just a quick red flash on the hits.
let cut = null;
function overlay(id) { let e = $(id); if (!e) { e = document.createElement("div"); e.id = id; document.body.appendChild(e); } return e; }
function flash(strong = 1) { const e = overlay("hit"); e.style.setProperty("--a", String(0.7 * strong)); e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); }
function clarkCutscene(m) {
  const p = V(P.pos.x, L.floorY, P.pos.z);
  const room = (dir, max = 6) => { let s = 0.4; for (; s < max; s += 0.1) if (inside(V(p.x + dir.x * s, p.y + 1.0, p.z + dir.z * s))) break; return s; };
  // throw you the way with the most room before a wall (straight away from him if there's space)
  const toYou = V(P.pos.x - m.pos.x, 0, P.pos.z - m.pos.z); if (toYou.lengthSq() < 1e-4) toYou.set(0, 0, 1); toYou.normalize();
  const base = Math.atan2(toYou.x, toYou.z);
  let best = null;
  for (let k = 0; k < 8; k++) { const a = base + k * Math.PI / 4, dir = V(Math.sin(a), 0, Math.cos(a)), r = room(dir), score = r + (k === 0 ? 1.5 : 0); if (!best || score > best.score) best = { dir, r, score }; }
  const dir = best.dir, back = room(dir.clone().negate(), 2), gap = Math.max(0.5, Math.min(0.95, back - 0.35));
  m.pos.set(p.x - dir.x * gap, m.pos.y, p.z - dir.z * gap); m.yaw = Math.atan2(dir.x, dir.z);
  m.c.g.position.copy(m.pos); m.c.g.rotation.y = m.yaw; m.c.pose({ arms: 0 }); // (stands him there now, so his face is where the camera will look)
  const wall = p.clone().addScaledVector(dir, Math.max(1.0, best.r - 0.45));
  cut = { m, t: 0, dir, done: {}, eye: camera.position.clone(), H: m.c.height,
    wallEye: wall.clone().setY(p.y + 1.45), floorEye: wall.clone().setY(p.y + 0.6),
    from: m.pos.clone(), to: wall.clone().addScaledVector(dir, -1.15).setY(m.pos.y), stepT: 0, stepN: 0, heartT: 0 };
  overlay("black").classList.remove("on");
  SFX.grab(); SFX.growl(1.3); flash(0.35);
}
function updateCut(dt) {
  const c = cut, m = c.m, t = (c.t += dt), H = c.H;
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)), seg = (a, b) => ease((t - a) / (b - a));
  const at = (k, when, fn) => { if (t >= when && !c.done[k]) { c.done[k] = 1; fn(); } };
  const face = () => { const v = V(); m.c.g.updateMatrixWorld(true); return m.c.face(v) || V(m.pos.x, m.pos.y + H * 0.9, m.pos.z); };
  if (!c.held) { const f = face(); c.held = f.addScaledVector(c.dir, 0.95).add(V(0, -0.2, 0)); } // (lifted up in front of his face)
  const held = c.held;
  const cam = V(); let look = face(), roll = 0, shake = 0.012;
  const pose = { arms: 0, kick: 0, lean: 0, fling: 0 };
  let walking = 0;
  if (t < 0.45) { // he lunges and grabs
    cam.copy(c.eye); pose.arms = seg(0, 0.4); shake = 0.03;
  } else if (t < 1.15) { // ...and lifts you up to his face (you kick your legs: the view wobbles)
    cam.lerpVectors(c.eye, held, seg(0.45, 1.05)); pose.arms = 1; shake = 0.035; roll = Math.sin(t * 9) * 0.06;
  } else if (t < 1.8) { // CHOMP: he bites your shoulder
    const k = seg(1.15, 1.3) - seg(1.5, 1.75);
    cam.copy(held).addScaledVector(c.dir, -0.18 * k); pose.arms = 1; pose.lean = k;
    roll = 0.55 * k; look = face().add(V(0, -0.35 * k, 0));
    shake = t > 1.28 && t < 1.6 ? 0.08 : 0.02;
    at("bite", 1.28, () => { SFX.bite(); flash(0.8); });
  } else if (t < 2.4) { // THROWN into the wall
    const k = seg(1.8, 2.4);
    cam.lerpVectors(held, c.wallEye, k); cam.y += Math.sin(k * Math.PI) * 0.5;
    pose.arms = 1 - k; pose.fling = Math.sin(k * Math.PI); roll = 0.3 + Math.sin(k * Math.PI) * 0.7;
    at("whoosh", 1.8, () => SFX.whoosh());
  } else if (t < 2.9) { // SLAM, slide down the wall
    cam.lerpVectors(c.wallEye, c.floorEye, seg(2.45, 2.85)); roll = 0.3; shake = t < 2.65 ? 0.12 : 0.015;
    at("slam", 2.4, () => { SFX.slam(); flash(0.6); });
  } else if (t < 4.5) { // he stomps over to you: boot... peg... boot... peg...
    const k = Math.min(1, (t - 2.9) / 1.5);
    m.pos.lerpVectors(c.from, c.to, k); walking = c.from.distanceTo(c.to) / 1.5;
    cam.copy(c.floorEye).add(V(0, Math.sin(t * 3) * 0.02, 0)); roll = 0.3;
    if ((c.stepT -= dt) < 0) { c.stepT = 0.42; (c.stepN++ % 2 ? SFX.pegStep : SFX.bootStep)(1.2); }
    if ((c.heartT -= dt) < 0) { c.heartT = 0.6; SFX.heart(); }
    at("growl", 3.6, () => SFX.growl(1.4));
  } else { // the peg leg goes back... and KICK
    cam.copy(c.floorEye); roll = 0.3;
    pose.kick = -0.7 * seg(4.5, 4.8) + 1.75 * seg(4.8, 4.93);
    if (t >= 4.93) { const k = seg(4.93, 5.1); cam.addScaledVector(c.dir, 0.12 * k); look = face().add(V(0, 2.5 * k, 0)); roll = 0.3 + 0.8 * k; shake = 0.15 * (1 - seg(5.1, 5.6)); }
    at("kick", 4.93, () => { SFX.kick(); flash(1); overlay("black").classList.add("on"); });
    at("doom", 5.4, () => SFX.doom());
    at("over", 6.0, () => { $("deadBy").textContent = "Captain Clark got you!"; $("dead").classList.remove("hidden"); });
  }
  m.c.g.position.copy(m.pos); m.c.g.rotation.y = m.yaw;
  if (walking) m.c.animate(dt, walking, true); else m.c.pose(pose, dt);
  cam.x += (Math.random() - 0.5) * shake; cam.y += (Math.random() - 0.5) * shake; cam.z += (Math.random() - 0.5) * shake;
  camera.position.copy(cam); camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(roll);
  lamp.position.set(cam.x, cam.y + 0.6, cam.z);
}

// ---------------------------------------------------------------- the map (top right; M or a tap makes it big)
// The level's layout is drawn once from above (walls, platforms, water, the exit); every frame the part around you
// is copied in, then the monsters (red dots) and you (the yellow arrow).
const MAP_PX = 4; // pixels per meter on the layout picture
let layout = null, bigMap = false;
const mapC = $("map"), mapX = mapC.getContext("2d");
mapC.addEventListener("pointerdown", (e) => { e.stopPropagation(); bigMap = !bigMap; });
function drawLayout() {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of L.boxes) { x0 = Math.min(x0, b.x0); z0 = Math.min(z0, b.z0); x1 = Math.max(x1, b.x1); z1 = Math.max(z1, b.z1); }
  const c = document.createElement("canvas"); c.width = Math.ceil((x1 - x0) * MAP_PX); c.height = Math.ceil((z1 - z0) * MAP_PX);
  const x = c.getContext("2d"), X = (v) => (v - x0) * MAP_PX, Z = (v) => (v - z0) * MAP_PX;
  x.fillStyle = L.pool ? "#d9eef2" : L.bg === 0x2a1030 ? "#3a1a40" : "#5a5130"; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "rgba(60,170,210,0.75)"; for (const w of L.water) x.fillRect(X(w.x0), Z(w.z0), (w.x1 - w.x0) * MAP_PX, (w.z1 - w.z0) * MAP_PX);
  const top = L.ceilingH ? L.ceilingH - 1.5 : 99;
  for (const b of L.boxes) { // walls, platforms, pillars (not the floor, the ceiling or the arches overhead)
    if (b.y1 <= L.floorY + 0.1 || b.y0 >= top) continue;
    x.fillStyle = b.y1 - b.y0 < 2 && L.pool ? "#ffffff" : L.pool ? "#9fb7bd" : "#e8d88a";
    x.fillRect(X(b.x0), Z(b.z0), Math.max(1.5, (b.x1 - b.x0) * MAP_PX), Math.max(1.5, (b.z1 - b.z0) * MAP_PX));
  }
  x.fillStyle = "#4dff7a"; x.beginPath(); x.arc(X(L.exit.x), Z(L.exit.z), 7, 0, 7); x.fill();
  x.fillStyle = "#003310"; x.font = "bold 9px sans-serif"; x.textAlign = "center"; x.fillText("EXIT", X(L.exit.x), Z(L.exit.z) + 3);
  layout = { c, x0, z0 };
}
function drawMap() {
  if (!layout) return;
  const big = bigMap, S = big ? Math.min(innerWidth, innerHeight) * 0.86 : (touch ? 120 : 170);
  if (mapC.width !== Math.round(S)) { mapC.width = mapC.height = Math.round(S); mapC.style.width = mapC.style.height = Math.round(S) + "px"; }
  mapC.classList.toggle("big", big);
  const x = mapX, W = mapC.width;
  x.clearRect(0, 0, W, W);
  // what part of the layout: everything (big map) or 44 m around you
  let k, ox, oz;
  if (big) { k = W / Math.max(layout.c.width, layout.c.height); ox = (W - layout.c.width * k) / 2; oz = (W - layout.c.height * k) / 2; }
  else { k = W / (44 * MAP_PX); ox = W / 2 - (P.pos.x - layout.x0) * MAP_PX * k; oz = W / 2 - (P.pos.z - layout.z0) * MAP_PX * k; }
  x.fillStyle = "rgba(0,0,0,0.55)"; x.fillRect(0, 0, W, W);
  x.drawImage(layout.c, ox, oz, layout.c.width * k, layout.c.height * k);
  const at = (p) => [ox + (p.x - layout.x0) * MAP_PX * k, oz + (p.z - layout.z0) * MAP_PX * k];
  // the monsters
  for (const m of mons) {
    const [mx, my] = at(m.pos), r = big ? 7 : 5;
    x.fillStyle = m.state === "chase" ? "#ff2020" : "#ff7a7a"; x.strokeStyle = "#000"; x.lineWidth = 2;
    x.beginPath(); x.arc(Math.max(r, Math.min(W - r, mx)), Math.max(r, Math.min(W - r, my)), r + (m.state === "chase" ? Math.sin(time * 12) * 1.5 : 0), 0, 7); x.fill(); x.stroke();
  }
  // you
  const [px, py] = at(P.pos), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), s = big ? 10 : 8;
  x.fillStyle = "#ffd531"; x.strokeStyle = "#000"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(px + fx * s, py + fz * s); x.lineTo(px - fx * s * 0.6 + fz * s * 0.6, py - fz * s * 0.6 - fx * s * 0.6); x.lineTo(px - fx * s * 0.6 - fz * s * 0.6, py - fz * s * 0.6 + fx * s * 0.6); x.closePath(); x.fill(); x.stroke();
}

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
  if (paused) chaseMusic(false);
  $("pause").classList.toggle("hidden", !paused);
  if (!on && playing && !touch) { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch {} }
}
$("resume").onclick = () => setPause(false);
$("quit").onclick = () => location.reload();
$("again").onclick = () => { $("dead").classList.add("hidden"); startLevel(lvl); };
$("start").onclick = () => { audio(); $("menu").classList.add("hidden"); save.set(0); startLevel(0); };
$("cont").onclick = () => { audio(); $("menu").classList.add("hidden"); startLevel(save.get()); };
$("playAgain").onclick = () => { $("done").classList.add("hidden"); startLevel(0); };
$("controls").innerHTML = touch ? "Left side: walk · Right side: look · 🏃 run · ⤒ jump · ✋ pick up rock · 🪨 throw · tap the map to make it big"
  : "<b>WASD</b> walk · <b>Mouse</b> or <b>arrow keys</b> look · <b>Shift</b> run · <b>Space</b> jump · <b>E</b> pick up a rock · <b>F</b> or <b>click</b> throw it · <b>M</b> big map · <b>Esc</b> pause";
// Each game's js/main.js starts it: run({ levels, saveKey })
export function run(cfg) {
  LEVELS = cfg.levels; SAVE_KEY = cfg.saveKey || SAVE_KEY;
  if (save.get() > 0) { $("cont").classList.remove("hidden"); $("cont").textContent = "▶ Continue: " + (LEVELS[save.get()].label || LEVELS[save.get()].sub); }
  preload("bacteria"); preload("partygoer"); preload("clark");
}

// ---------------------------------------------------------------- every frame
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!frozen) tick(dt);
  renderer.render(scene, camera);
}
function tick(dt) {
  if (!(dt > 0)) return;
  time += dt;
  if (L && L.waterMesh) { L.waterMesh.material.map.offset.x = Math.sin(time * 0.3) * 0.05; L.waterMesh.material.map.offset.y = time * 0.02; }
  if (L) for (const f of L.flicker) if (Math.random() < 0.04) f.visible = !f.visible || Math.random() < 0.6;
  if (dying) { dying += dt; if (cut) updateCut(dt); else if (dyingLook) camera.quaternion.slerpQuaternions(dyingLook.from, dyingLook.to, Math.min(1, dying * 5)); return; }
  if (!playing || paused || loading) return;
  updatePlayer(dt);
  if (!playing) return;
  updateMonsters(dt);
  updateRocks(dt);
  drawMap();
  if (L.pool && Math.random() < dt * 0.4) SFX.drip();
  if (L.party && Math.random() < dt * 0.08) SFX.party();
}
requestAnimationFrame(frame);
let god = false, frozen = false; // (testing only)
window.BR = { render() { renderer.render(scene, camera); }, get P() { return P; }, get mons() { return mons; }, get L() { return L; }, get LEVELS() { return LEVELS; }, startLevel, step(n) { for (let i = 0; i < n; i++) tick(1 / 60); }, keys, levelDone, get playing() { return playing; }, set god(v) { god = v; }, set frozen(v) { frozen = v; }, caught, get cut() { return cut; }, get music() { return mus; } }; // (for testing)
