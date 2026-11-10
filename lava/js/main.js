// LAVA TOWER (game.gamergunner.com/lava/): a third-person obby. Climb an endless, randomly built tower while the lava
// rises from below. Sections get harder the higher you go: jumps, balance beams, moving platforms, spinning bars,
// falling tiles, blinking tiles, jump pads, conveyor belts and zigzag climbs. A checkpoint flag every few sections.
// Coins buy colours and hats in the shop. Best height, coins and the shop are saved in this browser.
import * as THREE from "/create/vendor/three.module.js";
import { Tower, CORE, CHECK_EVERY } from "./tower.js";
import { Lava } from "./lava.js";
import { Climber, SKINS, HATS } from "./player.js";
import { SFX, unlock, music, setMuted, isMuted, setIntensity } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const THUMB = Q.has("thumb");
const RAD = 0.36, TALL = 1.8, WALK = 7, SPRINT = 10.5, JUMP = 12.6, GRAV = 32, PAD = 22.5, FALLMAX = 42;
const COYOTE = 0.12, BUFFER = 0.15, DT = 1 / 60;

// ---------------------------------------------------------------- saved stuff
const store = {
  get(k, d) { try { const v = localStorage.getItem("gv_lava_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("gv_lava_" + k, JSON.stringify(v)); } catch {} },
};
const save = { best: Number(store.get("best", 0)) || 0, coins: Number(store.get("coins", 0)) || 0, owned: store.get("owned", ["red", "none"]), skin: store.get("skin", "red"), hat: store.get("hat", "none") };
if (!Array.isArray(save.owned)) save.owned = ["red", "none"];
const persist = () => { store.set("best", save.best); store.set("coins", save.coins); store.set("owned", save.owned); store.set("skin", save.skin); store.set("hat", save.hat); };

// ---------------------------------------------------------------- the 3D world
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: THUMB });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
const FOG = new THREE.Color(0xff9a6a);
scene.fog = new THREE.Fog(FOG, 45, 190);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xff7a3a, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.3); sun.position.set(30, 60, 20); scene.add(sun); scene.add(sun.target);
const amb = new THREE.AmbientLight(0xffffff, 0.35); scene.add(amb);

// sky: a big gradient dome that follows the camera (redder near the lava, bluer as you climb)
const skyU = { top: { value: new THREE.Color(0x3d7bd9) }, bot: { value: new THREE.Color(0xff9a6a) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0);\n#include <colorspace_fragment>\n}",
}));
sky.renderOrder = -1; scene.add(sky);
// clouds drifting around the tower (they loop up and down as you climb, so you feel the height)
const clouds = [];
{
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x553322 }), sg = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group(), n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(sg, cm); const r = 2.5 + Math.random() * 2.5; s.scale.set(r * 1.3, r * 0.8, r); s.position.set((k - n / 2) * 3.2, Math.random() * 1.5, Math.random() * 2); g.add(s); }
    const a = Math.random() * Math.PI * 2, d = 55 + Math.random() * 70;
    g.position.set(Math.cos(a) * d, -40 + Math.random() * 120, Math.sin(a) * d); g.rotation.y = -a + Math.PI / 2;
    scene.add(g); clouds.push(g);
  }
}

let tower = null;
const lava = new Lava(scene);
const me = new Climber(); scene.add(me.root);
me.setLook(save.skin, save.hat);
// blob shadow under you (helps you see where you'll land)
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; if (!THUMB) camera.fov = camera.aspect < 0.8 ? 80 : camera.aspect < 1.2 ? 70 : 62; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------------------------------------------------------------- game state
let mode = "menu"; // menu | play | paused | dead | thumb
let time = 0, runTime = 0, grace = 0, god = false, deadT = 0;
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), ground: null, grounded: false, coyote: 0, buffer: 0, cut: false, stun: 0, face: 0, maxH: 0, coins: 0, check: 0, airT: 0, stepT: 0 };
const cam = { yaw: 0, pitch: 0.32, dist: 9, tx: 0, ty: 0, tz: 0, shake: 0 };
const L = { speed: 0.3 };
let lastSec = null, toastT = 0;

function newTower(seed) {
  if (tower) tower.destroy();
  tower = new Tower(scene, seed);
  tower.ensure(60);
}
function spawnAt(c) {
  P.pos.set(c.x, c.y + 0.02, c.z); P.vel.set(0, 0, 0); P.ground = null; P.grounded = false; P.stun = 0; P.cut = true;
  // face along the path (first side goes +x from the first corner)
  const sec = tower.sections.find((s) => s.check === c), idx = sec ? sec.idx + 1 : 0, dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][((idx % 4) + 4) % 4];
  P.face = Math.atan2(dir[0], dir[1]); cam.yaw = P.face + Math.PI; cam.pitch = 0.32;
  cam.tx = P.pos.x; cam.ty = P.pos.y + 1.6; cam.tz = P.pos.z;
  me.root.position.copy(P.pos); me.root.rotation.y = P.face; me.root.visible = true;
}
function startRun() {
  newTower((Math.random() * 1e9) | 0);
  P.maxH = 0; P.coins = 0; P.check = 0; runTime = 0; lastSec = null;
  spawnAt(tower.checkpoint(0));
  lava.reset(-11); L.speed = 0.25; grace = 4;
  setMode("play");
  toast("CLIMB!", "The lava is rising!", true);
}
function continueRun() {
  const c = tower.checkpoint(P.check) || tower.checkpoint(0);
  spawnAt(c);
  lava.reset(c.y - 11); runTime = Math.max(0, runTime - 40); grace = 2.5;
  setMode("play");
  toast("GO!", "Checkpoint " + P.check);
}
function setMode(m) {
  mode = m;
  $("hud").classList.toggle("hidden", !(m === "play" || m === "paused" || m === "dead"));
  $("menu").classList.toggle("hidden", m !== "menu");
  $("pause").classList.toggle("hidden", m !== "paused");
  $("dead").classList.toggle("hidden", !(m === "dead" && deadT > 0.9));
  music(m === "play" || m === "menu" ? !isMuted() && userGesture : false);
  if (m !== "play" && document.pointerLockElement) document.exitPointerLock();
  if (m === "play" && !touch) lockPointer();
  if (m === "menu") { refreshMenu(); menuScene(); }
}
let userGesture = false;

// ---------------------------------------------------------------- input
const keys = new Set();
let jumpHeld = false, jumpPressed = false;
const touch = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && "ontouchstart" in window);
if (touch) document.body.classList.add("touch");
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k) && mode === "play") e.preventDefault();
  if (k === "escape" && mode === "paused") { setMode("play"); return; }
  if (e.repeat) return;
  keys.add(k);
  if (k === " ") { jumpPressed = true; jumpHeld = true; }
  if (k === "m") toggleMute();
  if ((k === "p" || k === "escape") && mode === "play") setMode("paused");
});
addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); keys.delete(k); if (k === " ") jumpHeld = false; });
addEventListener("blur", () => { keys.clear(); jumpHeld = false; if (mode === "play") setMode("paused"); });
function lockPointer() { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch {} }
canvas.addEventListener("click", () => { if (mode === "play" && !touch && document.pointerLockElement !== canvas) lockPointer(); });
addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas || mode !== "play") return;
  cam.yaw -= e.movementX * 0.0026; cam.pitch = Math.max(-0.35, Math.min(1.25, cam.pitch + e.movementY * 0.0024));
});
document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement !== canvas && mode === "play" && !touch) setMode("paused"); });
addEventListener("wheel", (e) => { if (mode === "play") cam.dist = Math.max(4, Math.min(16, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: true });
// touch: a stick on the left, drag on the right to look, the JUMP button
const stick = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || mode !== "play") return;
  if (e.clientX < innerWidth * 0.45 && stick.id === null) {
    stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.dx = stick.dy = 0;
    const s = $("stick"); s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px"; s.classList.add("on"); s.firstElementChild.style.transform = "";
  } else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
});
addEventListener("pointermove", (e) => {
  if (e.pointerId === stick.id) {
    stick.dx = e.clientX - stick.x; stick.dy = e.clientY - stick.y; const l = Math.hypot(stick.dx, stick.dy);
    if (l > 55) { stick.dx *= 55 / l; stick.dy *= 55 / l; }
    $("stick").firstElementChild.style.transform = "translate(" + stick.dx + "px," + stick.dy + "px)";
  }
  if (e.pointerId === look.id) {
    cam.yaw -= (e.clientX - look.x) * 0.007; cam.pitch = Math.max(-0.35, Math.min(1.25, cam.pitch + (e.clientY - look.y) * 0.006));
    look.x = e.clientX; look.y = e.clientY;
  }
});
const lift = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; $("stick").classList.remove("on"); } if (e.pointerId === look.id) look.id = null; };
addEventListener("pointerup", lift); addEventListener("pointercancel", lift);
{
  const b = $("tJump");
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); jumpPressed = true; jumpHeld = true; b.classList.add("down"); });
  const up = () => { jumpHeld = false; b.classList.remove("down"); };
  b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
}
// the first tap/click anywhere turns the sound on (browsers need that)
const gesture = () => { unlock(); if (!userGesture) { userGesture = true; if (mode === "menu" || mode === "play") music(!isMuted()); } };
addEventListener("keydown", gesture, { capture: true }); addEventListener("pointerdown", gesture, { capture: true });

// ---------------------------------------------------------------- physics
const near = [];
const overlapXZ = (x, z, b) => x + RAD > b.minX && x - RAD < b.maxX && z + RAD > b.minZ && z - RAD < b.maxZ;
function movePlayer(dt) {
  const p = P.pos, v = P.vel;
  tower.solidsNear(p.y, 8, near);
  // ride whatever you're standing on (moving platforms)
  if (P.ground) {
    if (P.ground.solid) { p.x += P.ground.dx; p.y += P.ground.dy; p.z += P.ground.dz; }
    if (P.ground.kind === "belt") { p.x += P.ground.bx * dt; p.z += P.ground.bz * dt; }
  }
  // up / down
  const wasGrounded = P.grounded, fallSpeed = -v.y;
  let ny = p.y + v.y * dt, landed = null;
  for (const b of near) {
    if (!overlapXZ(p.x, p.z, b)) continue;
    if (v.y <= 0 && p.y >= b.maxY - 0.06 - Math.max(0, b.dy) && ny <= b.maxY) { if (!landed || b.maxY > landed.maxY) landed = b; }
    else if (v.y > 0 && p.y + TALL <= b.minY + 0.06 && ny + TALL > b.minY) { ny = b.minY - TALL - 0.001; v.y = 0; }
  }
  P.grounded = false; P.ground = null;
  if (landed) { ny = landed.maxY; v.y = 0; P.grounded = true; P.ground = landed; }
  p.y = ny;
  // sideways: x then z, with a little auto step-up onto low ledges
  for (const ax of ["x", "z"]) {
    const d = v[ax] * dt; if (!d) continue;
    p[ax] += d;
    for (const b of near) {
      if (p.y >= b.maxY - 0.01 || p.y + TALL <= b.minY + 0.01 || !overlapXZ(p.x, p.z, b)) continue;
      if ((P.grounded || P.coyote > 0) && b.maxY - p.y < 0.45 && b.kind !== "core") { p.y = b.maxY; P.grounded = true; P.ground = b; v.y = Math.max(0, v.y); continue; }
      if (ax === "x") p.x = d > 0 ? b.minX - RAD - 0.001 : b.maxX + RAD + 0.001;
      else p.z = d > 0 ? b.minZ - RAD - 0.001 : b.maxZ + RAD + 0.001;
      v[ax] = 0;
    }
  }
  // pushed by a moving platform from the side: get out the shortest way
  for (const b of near) {
    if (b.kind !== "mover" || p.y >= b.maxY - 0.01 || p.y + TALL <= b.minY + 0.01 || !overlapXZ(p.x, p.z, b)) continue;
    const o = [[b.maxY - p.y, "up"], [p.x + RAD - b.minX, "-x"], [b.maxX - (p.x - RAD), "+x"], [p.z + RAD - b.minZ, "-z"], [b.maxZ - (p.z - RAD), "+z"], [p.y + TALL - b.minY, "down"]].sort((a, c) => a[0] - c[0])[0];
    if (o[1] === "up") { p.y = b.maxY; P.grounded = true; P.ground = b; v.y = Math.max(0, v.y); }
    else if (o[1] === "down") { p.y = b.minY - TALL; v.y = Math.min(0, v.y); }
    else if (o[1] === "-x") p.x -= o[0]; else if (o[1] === "+x") p.x += o[0]; else if (o[1] === "-z") p.z -= o[0]; else p.z += o[0];
  }
  if (P.grounded && !wasGrounded && fallSpeed > 6) { SFX.land(); me.squash = Math.min(1, fallSpeed / 25); }
}

function updatePlayer(dt) {
  const p = P.pos, v = P.vel;
  // which way is "forward" (camera-relative)
  let ix = 0, iz = 0;
  if (keys.has("w")) iz += 1; if (keys.has("s")) iz -= 1; if (keys.has("d")) ix += 1; if (keys.has("a")) ix -= 1;
  let sprint = keys.has("shift");
  if (stick.id !== null) { ix += stick.dx / 55; iz -= stick.dy / 55; if (Math.hypot(stick.dx, stick.dy) > 48) sprint = true; }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const mx = fx * iz + rx * ix, mz = fz * iz + rz * ix, sp = sprint ? SPRINT : WALK;
  P.stun = Math.max(0, P.stun - dt);
  const acc = P.stun > 0 ? 4 : P.grounded ? 75 : 32;
  const ax = mx * sp - v.x, az = mz * sp - v.z, al = Math.hypot(ax, az), lim = acc * dt;
  if (al > lim) { v.x += (ax / al) * lim; v.z += (az / al) * lim; } else { v.x += ax; v.z += az; }
  if (il > 0.1 && P.stun <= 0) P.face = Math.atan2(mx, mz);
  // jumping: coyote time (jump just after walking off) + jump buffering (press just before landing)
  if (jumpPressed) P.buffer = BUFFER; else P.buffer = Math.max(0, P.buffer - dt);
  jumpPressed = false;
  P.coyote = P.grounded ? COYOTE : Math.max(0, P.coyote - dt);
  if (P.buffer > 0 && P.coyote > 0 && P.stun <= 0) {
    v.y = JUMP + (P.ground && P.ground.dy > 0 ? P.ground.dy / dt : 0);
    P.grounded = false; P.ground = null; P.coyote = 0; P.buffer = 0; P.cut = false; SFX.jump();
  }
  if (!jumpHeld && !P.cut && v.y > 0) { v.y *= 0.45; P.cut = true; } // let go early = smaller jump
  v.y = Math.max(-FALLMAX, v.y - GRAV * dt);
  movePlayer(dt);
  // what you landed on
  const g = P.ground;
  if (g && P.grounded) {
    if (g.kind === "pad") { v.y = PAD; P.grounded = false; P.ground = null; P.cut = true; g.squash = 1; SFX.bounce(); me.squash = 0.6; }
    else if (g.kind === "fall" && g.state === 0) { g.state = 1; g.timer = g.delay; SFX.crumble(); }
  }
  if (P.grounded) { P.airT = 0; const hs = Math.hypot(v.x, v.z); if (hs > 1) { P.stepT -= dt * hs; if (P.stepT < 0) { P.stepT = 2.2; SFX.step(); } } } else P.airT += dt;
  // spinning bars knock you away
  for (const sec of tower.sections) for (const s of sec.spinners) {
    if (P.stun > 0 || p.y > s.y + s.half || p.y + TALL < s.y - s.half) continue;
    const dx = p.x - s.x, dz = p.z - s.z, c = Math.cos(s.a), sn = Math.sin(s.a);
    const lx = dx * c + dz * sn, lz = -dx * sn + dz * c; // in the bar's own frame
    if (Math.abs(lx) < s.len + RAD && Math.abs(lz) < s.half + RAD) {
      // push the way the bar is sweeping, plus a bit outwards and up
      const sweep = Math.sign(lx * s.speed) || 1, kx = -sn * sweep, kz = c * sweep;
      v.x = kx * 8.5 + dx * 1.2; v.z = kz * 8.5 + dz * 1.2; v.y = 7.5; P.grounded = false; P.ground = null; P.stun = 0.4; P.cut = true;
      SFX.hit(); cam.shake = 0.35;
    }
  }
  // coins
  for (const sec of tower.sections) for (const c of sec.coins) {
    if (c.taken) continue;
    const dx = c.x - p.x, dy = c.mesh.position.y - (p.y + 0.9), dz = c.z - p.z;
    if (dx * dx + dz * dz < 1.0 && Math.abs(dy) < 1.4) {
      c.taken = true; c.mesh.visible = false; P.coins++; save.coins++; persist(); SFX.coin();
      const h = $("hCoins"); h.classList.remove("pop"); void h.offsetWidth; h.classList.add("pop");
      burst(c.x, c.mesh.position.y, c.z, [0xffd23f, 0xfff3a0], 10, 4);
    }
  }
  // checkpoints
  for (const sec of tower.sections) {
    const ck = sec.check; if (!ck || ck.reached) continue;
    if (Math.abs(p.x - ck.x) < 2.9 && Math.abs(p.z - ck.z) < 2.9 && p.y > ck.y - 0.2 && p.y < ck.y + 2.5) {
      ck.reached = true; P.check = Math.max(P.check, ck.n);
      ck.flagMat.color.setHex(0x3bff6a); ck.flagMat.emissive.setHex(0x0a5a1a);
      SFX.checkpoint(); toast("CHECKPOINT " + ck.n + "!", Math.floor(ck.y) + " m"); flash("");
      burst(ck.x, ck.y + 2.5, ck.z, [0xff4d6d, 0xffd60a, 0x5bd74a, 0x2ec4f0, 0x9b5de5, 0xff70c8], 70, 9);
    }
  }
  // new section: say what's coming
  const sec = tower.sectionAt(p.y);
  if (P.grounded && sec !== lastSec && sec.name) { lastSec = sec; if (sec.idx >= 0) { const s = $("secName"); s.textContent = sec.name; s.classList.remove("on"); void s.offsetWidth; s.classList.add("on"); } }
  P.maxH = Math.max(P.maxH, p.y);
  // the lava!
  if (p.y < lava.y + 0.05) {
    if (god) { v.y = 24; P.cut = true; p.y = lava.y + 0.06; }
    else die();
  }
}

function die() {
  deadT = 0; setMode("dead");
  SFX.death(); flash("red"); cam.shake = 0.6;
  $("toast").classList.remove("on"); $("secName").classList.remove("on");
  burst(P.pos.x, lava.y + 0.3, P.pos.z, [0xff3a00, 0xffb000, 0x333333], 40, 8);
  const h = Math.floor(P.maxH), nb = h > save.best;
  if (nb) { save.best = h; persist(); }
  $("deadMsg").innerHTML = "You climbed <b>" + h + " m</b> and grabbed <b>" + P.coins + "</b> coins";
  const db = $("deadBest"); db.textContent = nb ? "NEW BEST!" : "Best: " + save.best + " m"; db.classList.toggle("new", nb);
  const c = $("cont"); c.classList.toggle("hidden", P.check < 1); c.textContent = "🚩 Continue from checkpoint " + P.check;
}

// ---------------------------------------------------------------- confetti / sparks
const bits = [], bitGeo = new THREE.BoxGeometry(0.16, 0.16, 0.05), bitMats = new Map();
function burst(x, y, z, colors, n, power) {
  for (let i = 0; i < n; i++) {
    const col = colors[i % colors.length];
    if (!bitMats.has(col)) bitMats.set(col, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(bitGeo, bitMats.get(col)); m.position.set(x, y, z); scene.add(m);
    const a = Math.random() * Math.PI * 2, u = Math.random();
    bits.push({ m, vx: Math.cos(a) * power * (0.3 + u * 0.7), vy: power * (0.5 + Math.random()), vz: Math.sin(a) * power * (0.3 + u * 0.7), life: 1.2 + Math.random() * 0.8, spin: Math.random() * 10 });
  }
}
function updateBits(dt) {
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i]; b.life -= dt; b.vy -= 18 * dt; b.vx *= 0.98; b.vz *= 0.98;
    b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt; b.m.rotation.x += b.spin * dt; b.m.rotation.y += b.spin * dt * 0.7;
    if (b.life <= 0) { scene.remove(b.m); bits.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- HUD bits
function toast(big, small, warn) {
  const t = $("toast"); t.innerHTML = big + (small ? "<small>" + small + "</small>" : ""); t.classList.toggle("warn", !!warn);
  t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
}
function flash(kind) { const f = $("flash"); f.className = "on " + kind; requestAnimationFrame(() => requestAnimationFrame(() => { f.className = kind; })); }
let hudCache = "";
function drawHud() {
  const h = Math.max(0, Math.floor(P.pos.y)), dist = Math.max(0, P.pos.y - lava.y);
  const s = h + "|" + P.coins + "|" + Math.floor(dist) + "|" + save.best;
  if (s !== hudCache) {
    hudCache = s;
    $("hNow").textContent = h + " m"; $("hCoinN").textContent = P.coins;
    $("hBest").textContent = "BEST " + Math.max(save.best, Math.floor(P.maxH)) + " m";
    $("mDist").textContent = Math.floor(dist) + " m";
  }
  const k = Math.max(0, Math.min(1, dist / 30));
  $("mFill").style.height = Math.max(3, 100 - k * 100) + "%";
  $("meter").classList.toggle("hot", dist < 6);
  const heat = mode === "play" ? Math.max(0, 1 - dist / 9) : mode === "dead" ? 1 : 0;
  $("heat").style.opacity = (heat * (0.75 + Math.sin(time * 8) * 0.12 * heat)).toFixed(3);
}

// ---------------------------------------------------------------- camera
const tmpV = new THREE.Vector3();
function updateCamera(dt) {
  if (keys.has("arrowleft")) cam.yaw += dt * 2.4; if (keys.has("arrowright")) cam.yaw -= dt * 2.4;
  if (keys.has("arrowup")) cam.pitch = Math.min(1.25, cam.pitch + dt * 1.4); if (keys.has("arrowdown")) cam.pitch = Math.max(-0.35, cam.pitch - dt * 1.4);
  const k = 1 - Math.exp(-dt * 14), ky = 1 - Math.exp(-dt * 7);
  cam.tx += (P.pos.x - cam.tx) * k; cam.tz += (P.pos.z - cam.tz) * k; cam.ty += (P.pos.y + 1.6 - cam.ty) * ky;
  let d = cam.dist;
  const ox = Math.sin(cam.yaw) * Math.cos(cam.pitch), oy = Math.sin(cam.pitch), oz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
  // don't go inside the tower core: shorten the camera if the core is in the way
  const C = CORE + 0.5; let tHit = Infinity;
  { const t0x = (-C - cam.tx) / ox, t1x = (C - cam.tx) / ox, t0z = (-C - cam.tz) / oz, t1z = (C - cam.tz) / oz;
    const tmin = Math.max(Math.min(t0x, t1x), Math.min(t0z, t1z)), tmax = Math.min(Math.max(t0x, t1x), Math.max(t0z, t1z));
    if (tmax >= Math.max(0, tmin) && tmin > 0) tHit = tmin; }
  if (tHit < d) d = Math.max(1.6, tHit - 0.3);
  // on the menu (wide screens) slide the view so you stand on the right, next to the menu
  const side = mode === "menu" && innerWidth > 760 ? 2.4 : 0, sx = -Math.cos(cam.yaw) * side, sz = Math.sin(cam.yaw) * side;
  camera.position.set(cam.tx + ox * d + sx, cam.ty + oy * d, cam.tz + oz * d + sz);
  if (camera.position.y < lava.y + 0.6) camera.position.y = lava.y + 0.6;
  camera.lookAt(cam.tx + sx, cam.ty, cam.tz + sz);
  cam.shake = Math.max(0, cam.shake - dt);
  const near = Math.max(0, 1 - (P.pos.y - lava.y) / 4) * (mode === "play" ? 0.12 : 0);
  const sh = cam.shake * 0.5 + near;
  if (sh > 0) camera.position.add(tmpV.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
}

// ---------------------------------------------------------------- one fixed step of the game (1/60 s)
const skyA = { top: new THREE.Color(0x4a2a6a), bot: new THREE.Color(0xff7a3a) }, skyB = { top: new THREE.Color(0x2f7fe0), bot: new THREE.Color(0xffc7a0) };
function step(dt) {
  time += dt;
  if (!tower) return;
  if (mode === "play") {
    runTime += dt;
    tower.update(time, dt);
    updatePlayer(dt);
    if (mode === "play") {
      // the lava rises a little faster as time goes on, and catches up if you're far ahead
      if (grace > 0) grace -= dt;
      else {
        const gap = P.pos.y - lava.y;
        L.speed = Math.min(0.95, 0.25 + runTime * 0.0025) + Math.max(0, gap - 22) * 0.07;
        lava.y += L.speed * dt;
      }
      tower.ensure(P.pos.y + 60); tower.prune(lava.y);
      setIntensity(Math.max(0, 1 - (P.pos.y - lava.y) / 10));
      if (Math.random() < dt * 0.6 && P.pos.y - lava.y < 8) SFX.hiss();
    }
  } else if (mode === "dead") {
    deadT += dt; tower.update(time, dt);
    me.root.position.y = Math.max(lava.y - 2.5, me.root.position.y - dt * 1.6);
    if (deadT > 0.9 && $("dead").classList.contains("hidden")) $("dead").classList.remove("hidden");
  } else if (mode === "menu") {
    tower.update(time, dt);
    cam.yaw += dt * 0.12;
  }
  if (mode !== "thumb") {
    // you (the model)
    if (mode !== "dead") me.root.position.copy(P.pos);
    let df = P.face - me.root.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
    me.root.rotation.y += df * (1 - Math.exp(-dt * 14));
    me.animate(dt, mode === "play" ? Math.hypot(P.vel.x, P.vel.z) : 0, mode === "play" && !P.grounded && P.airT > 0.06, P.vel.y, P.stun > 0);
    updateCamera(dt);
  }
  lava.update(dt, time, P.pos, (pos) => { if (mode === "play" && pos.distanceToSquared(P.pos) < 400) SFX.pop(); });
  updateBits(dt);
  // the blob shadow lands on the highest thing under you
  let gy = -Infinity;
  for (const b of tower.solidsNear(P.pos.y, 30, near)) if (P.pos.x > b.minX && P.pos.x < b.maxX && P.pos.z > b.minZ && P.pos.z < b.maxZ && b.maxY <= P.pos.y + 0.05 && b.maxY > gy) gy = b.maxY;
  if (gy > lava.y && mode !== "dead") { shadow.visible = true; shadow.position.set(P.pos.x, gy + 0.03, P.pos.z); const hgt = P.pos.y - gy; shadow.scale.setScalar(Math.max(0.4, 1 - hgt * 0.05)); shadow.material.opacity = Math.max(0.12, 0.45 - hgt * 0.02); }
  else shadow.visible = false;
  // sky + fog: fiery near the lava, blue sky up high
  const hk = Math.max(0, Math.min(1, (camera.position.y - lava.y) / 40)), alt = Math.max(0, Math.min(1, camera.position.y / 400));
  skyU.top.value.copy(skyA.top).lerp(skyB.top, hk).lerp(new THREE.Color(0x1a1450), alt * 0.8);
  skyU.bot.value.copy(skyA.bot).lerp(skyB.bot, hk * 0.7);
  FOG.copy(skyU.bot.value); lava.uni.uFog.value.copy(FOG);
  sky.position.copy(camera.position);
  sun.position.set(camera.position.x + 30, camera.position.y + 60, camera.position.z + 20); sun.target.position.copy(camera.position);
  for (const c of clouds) { if (c.position.y < camera.position.y - 70) c.position.y += 140; else if (c.position.y > camera.position.y + 70) c.position.y -= 140; }
}

// ---------------------------------------------------------------- the menu, shop, buttons
function menuScene() {
  newTower((Math.random() * 1e9) | 0);
  const c = tower.checkpoint(0); P.maxH = 0; spawnAt(c); P.face = Math.PI * 0.25; me.root.rotation.y = P.face;
  lava.reset(-9);
  cam.dist = 7; cam.pitch = 0.18; cam.yaw = P.face + 0.4;
}
function refreshMenu() {
  $("mBest").textContent = save.best + " m"; $("mCoins").textContent = save.coins;
  const item = (it, kind) => {
    const owned = save.owned.includes(it.id), on = (kind === "skin" ? save.skin : save.hat) === it.id;
    const pic = kind === "skin" ? '<i class="sw" style="background:#' + it.color.toString(16).padStart(6, "0") + '"></i>' : '<i class="ic">' + it.icon + "</i>";
    return '<button type="button" class="item' + (owned ? " owned" : "") + (on ? " on" : "") + (!owned && save.coins < it.price ? " poor" : "") + '" data-k="' + kind + '" data-id="' + it.id + '">' + pic + it.name +
      '<span class="pr">' + (on ? "✓ Wearing" : owned ? "Wear" : "🪙 " + it.price) + "</span></button>";
  };
  $("shopSkins").innerHTML = SKINS.map((s) => item(s, "skin")).join("");
  $("shopHats").innerHTML = HATS.map((h) => item(h, "hat")).join("");
}
function shopClick(e) {
  const b = e.target.closest(".item"); if (!b) return;
  const kind = b.dataset.k, id = b.dataset.id, it = (kind === "skin" ? SKINS : HATS).find((x) => x.id === id);
  if (!save.owned.includes(id)) {
    if (save.coins < it.price) { SFX.nope(); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); $("shopMsg").textContent = "You need " + (it.price - save.coins) + " more coins for " + it.name + ". Climb and grab coins!"; $("shopMsg").style.color = "#ffb380"; return; }
    save.coins -= it.price; save.owned.push(id); SFX.buy(); $("shopMsg").textContent = "You got " + it.name + "!"; $("shopMsg").style.color = "#9fe89f";
    burst(P.pos.x, P.pos.y + 2, P.pos.z, [0xffd23f, 0xff70c8, 0x2ec4f0], 30, 5);
  } else { SFX.click(); $("shopMsg").textContent = ""; }
  if (kind === "skin") save.skin = id; else save.hat = id;
  persist(); me.setLook(save.skin, save.hat); refreshMenu();
}
$("shopSkins").addEventListener("click", shopClick); $("shopHats").addEventListener("click", shopClick);
function toggleMute() {
  setMuted(!isMuted());
  music(!isMuted() && (mode === "play" || mode === "menu"));
  const on = !isMuted(); $("bMute").textContent = on ? "🔊" : "🔇"; $("mMute").textContent = on ? "🔊 Sound on" : "🔇 Sound off";
}
$("bMute").onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$("mMute").onclick = toggleMute;
if (isMuted()) { $("bMute").textContent = "🔇"; $("mMute").textContent = "🔇 Sound off"; }
$("bPause").onclick = () => { if (mode === "play") setMode("paused"); };
$("play").onclick = () => { userGesture = true; startRun(); };
$("resume").onclick = () => setMode("play");
$("restart").onclick = () => startRun();
$("quit").onclick = () => setMode("menu");
$("cont").onclick = () => continueRun();
$("again").onclick = () => startRun();
$("dMenu").onclick = () => setMode("menu");
$("controls").innerHTML = touch
  ? "<b>Left side</b>: move (push far to run) · <b>Right side</b>: drag to look · <b>JUMP</b> button (hold for a bigger jump)"
  : "<b>WASD</b> move · <b>Space</b> jump (hold = higher) · <b>Shift</b> sprint · <b>Mouse</b> (click the game) or <b>arrow keys</b> turn the camera · <b>Wheel</b> zoom · <b>Esc</b> pause · <b>M</b> sound";

// ---------------------------------------------------------------- thumbnail: a posed action shot (?thumb)
function thumbScene() {
  mode = "thumb";
  $("menu").classList.add("hidden"); $("hud").classList.add("hidden"); $("thumbTitle").classList.remove("hidden"); $("heat").style.opacity = "0.3";
  newTower(20261110);
  // a jumps section on the +z side: pose mid-leap between two platforms
  tower.ensure(80);
  const sec = tower.sections.find((s) => s.idx === 0);
  const plats = sec.solids.filter((b) => b.kind !== "core" && b.mesh);
  const a = plats[1], b = plats[2];
  const ax = (a.minX + a.maxX) / 2, az = (a.minZ + a.maxZ) / 2, bx = (b.minX + b.maxX) / 2, bz = (b.minZ + b.maxZ) / 2;
  P.pos.set(ax * 0.45 + bx * 0.55, Math.max(a.maxY, b.maxY) + 1.7, az * 0.45 + bz * 0.55);
  me.root.position.copy(P.pos); me.root.rotation.y = Math.atan2(bx - ax, bz - az); me.pose("leap");
  lava.reset(P.pos.y - 7.5);
  for (let i = 0; i < 240; i++) { time += DT; tower.update(time, DT); lava.update(DT, time, P.pos); }
  // camera: up on the next platform, looking back down at you leaping up towards it (lava glowing far below)
  const dir = new THREE.Vector3(bx - ax, 0, bz - az).normalize(), out = new THREE.Vector3(dir.z, 0, -dir.x);
  const T = (Q.get("thumb") || "").split(",").map(Number); // (tuning: ?thumb=back,up,side,lookDown,lookSide)
  const [cb, cu, cs, ld, ls] = [T[0] || 4.5, T[1] || 1.7, T[2] || 1.1, T[3] || 0.35, T[4] || 1.5];
  camera.position.copy(P.pos).addScaledVector(dir, cb).addScaledVector(out, cs).add(new THREE.Vector3(0, cu, 0));
  camera.lookAt(tmpV.copy(P.pos).addScaledVector(out, -ls).add(new THREE.Vector3(0, -ld, 0)));
  camera.fov = 64; camera.updateProjectionMatrix();
  shadow.visible = false;
  const hk = 0.35; skyU.top.value.copy(skyA.top).lerp(skyB.top, hk); skyU.bot.value.copy(skyA.bot).lerp(skyB.bot, hk * 0.7);
  FOG.copy(skyU.bot.value); lava.uni.uFog.value.copy(FOG); sky.position.copy(camera.position);
  sun.position.set(camera.position.x + 30, camera.position.y + 60, camera.position.z + 20); sun.target.position.copy(camera.position);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- main loop
let acc = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (mode === "thumb") { renderer.render(scene, camera); return; }
  let d = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode !== "paused") { acc += d; let n = 0; while (acc >= DT && n < 6) { step(DT); acc -= DT; n++; } if (n === 6) acc = 0; }
  if (mode === "play" || mode === "dead" || mode === "paused") drawHud();
  renderer.render(scene, camera);
}
if (THUMB) thumbScene(); else setMode("menu");
requestAnimationFrame((t) => { last = t; frame(t); });

// ---------------------------------------------------------------- for testing (no real input needed)
window.LAVA = {
  step(n = 1) { for (let i = 0; i < n; i++) step(DT); },
  render() { renderer.render(scene, camera); },
  start() { userGesture = false; startRun(); },
  continue: continueRun, die, setMode,
  get mode() { return mode; }, get player() { return P; }, get lava() { return lava; }, get tower() { return tower; }, get cam() { return cam; }, get save() { return save; },
  get god() { return god; }, set god(v) { god = !!v; },
  keys, press(k) { keys.add(k); if (k === " ") { jumpPressed = true; jumpHeld = true; } }, release(k) { keys.delete(k); if (k === " ") jumpHeld = false; },
  get checkpoint() { return P.check; }, CHECK_EVERY,
};
