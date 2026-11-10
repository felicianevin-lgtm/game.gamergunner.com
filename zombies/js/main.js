// ZOMBIE SIEGE (game.gamergunner.com/zombies/): a top-down wave-survival shooter.
// Goofy blocky zombies pour into the town square through four gates. Blast them into confetti, grab their coins,
// shop between waves (new gadgets, upgrades, barricades, turrets) and beat King Rotsworth every 5 waves.
// Best wave/score are saved in this browser. Test hook: window.ZS (see the bottom). ?thumb draws the thumbnail scene.
import * as THREE from "/create/vendor/three.module.js";
import { SFX, audio, music, setMuted, isMuted } from "./sfx.js";
import { buildArena, pushOut, overlaps, rayHit, Nav, GATES, HX, HZ } from "./world.js";
import { ZTYPES, ZombieRenderer } from "./zombies.js";
import { FX } from "./fx.js";
import { makeHero, makeBarricade, makeTurret } from "./hero.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const THUMB = Q.has("thumb"), TEST = Q.get("test");
const DT = 1 / 60, PR = 0.45;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- 3D setup
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: !!(TEST || THUMB) });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 220);
const arena = buildArena(scene);
const cols = arena.cols;
const nav = new Nav(); nav.rebuild(cols);
const zr = new ZombieRenderer(scene, 160);
const fx = new FX(scene, $("overlay"));
const hero = makeHero(); scene.add(hero.root);
const flashLight = new THREE.PointLight(0xffc070, 0, 14, 1.5); scene.add(flashLight);
let camK = 1;
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  camK = camera.aspect < 1.25 ? clamp(1.25 / camera.aspect, 1, 1.85) : 1;
  fx.overlay.resize(dpr);
}
addEventListener("resize", resize); resize();

// the aim reticle on the ground
const reticle = new THREE.Group();
{
  const m = new THREE.MeshBasicMaterial({ color: 0xb4ff5a, transparent: true, opacity: 0.9, depthWrite: false });
  const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), m); r.rotation.x = -Math.PI / 2; reticle.add(r);
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.3), m); t.rotation.x = -Math.PI / 2; t.rotation.z = (i * Math.PI) / 2; t.position.set(Math.sin((i * Math.PI) / 2) * 0.72, 0, Math.cos((i * Math.PI) / 2) * 0.72); reticle.add(t); }
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), m); d.rotation.x = -Math.PI / 2; reticle.add(d);
  reticle.position.y = 0.06; reticle.renderOrder = 3; scene.add(reticle);
}
// boss slam warning circles
const teles = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.25, depthWrite: false })); d.rotation.x = -Math.PI / 2; g.add(d);
  const r = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.9, depthWrite: false })); r.rotation.x = -Math.PI / 2; g.add(r);
  g.position.y = 0.07; g.visible = false; scene.add(g); teles.push({ g, d, used: false });
}

// pickups: coins, hearts, ammo boxes (instanced)
const coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0x6a4a00 }), 400);
const heartGeo = (() => {
  const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(-0.15, -0.3, -0.55, -0.1, -0.5, 0.15); s.bezierCurveTo(-0.45, 0.45, -0.1, 0.45, 0, 0.22); s.bezierCurveTo(0.1, 0.45, 0.45, 0.45, 0.5, 0.15); s.bezierCurveTo(0.55, -0.1, 0.15, -0.3, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 8 }); g.center(); g.scale(0.8, 0.8, 0.8); return g;
})();
const heartMesh = new THREE.InstancedMesh(heartGeo, new THREE.MeshLambertMaterial({ color: 0xff3a5a, emissive: 0x6a0a1a }), 40);
const ammoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), new THREE.MeshLambertMaterial({ color: 0x5a7a2a, emissive: 0x2a3a00 }), 40);
for (const m of [coinMesh, heartMesh, ammoMesh]) { m.frustumCulled = false; m.count = 0; m.castShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }

// ---------------------------------------------------------------- the gadgets
const WEAPONS = [
  { id: "blaster", name: "Blaster", icon: "🔫", desc: "Never runs out!", cost: 0, up: 60, dmg: 22, rate: 4.5, mag: Infinity, reserve: 0, reload: 0, speed: 44, spread: 0.035, pellets: 1, color: 0x5ff0ff, shake: 0.12, kb: 3, w: 0.13, len: 1.1, unlock: 0 },
  { id: "shotgun", name: "Boom Shotgun", icon: "💥", desc: "Huge blast up close.", cost: 100, up: 90, dmg: 15, rate: 1.4, mag: 6, reserve: 36, reload: 1.3, speed: 34, spread: 0.42, pellets: 8, life: 0.42, color: 0xffb84a, shake: 0.45, kb: 6, w: 0.1, len: 0.8, unlock: 0 },
  { id: "smg", name: "Buzz SMG", icon: "⚡", desc: "Sprays super fast.", cost: 160, up: 110, dmg: 11, rate: 13, mag: 45, reserve: 270, reload: 1.4, speed: 50, spread: 0.13, pellets: 1, color: 0xffee55, shake: 0.08, kb: 1.4, w: 0.09, len: 1.0, unlock: 0 },
  { id: "rail", name: "Laser Rail", icon: "🔆", desc: "Beam zaps through a whole line!", cost: 320, up: 160, dmg: 120, rate: 1.15, mag: 6, reserve: 36, reload: 1.7, hitscan: true, color: 0xff4af0, shake: 0.5, kb: 5, unlock: 2 },
  { id: "rocket", name: "Rocket Popper", icon: "🚀", desc: "Big BOOM for big crowds.", cost: 480, up: 200, dmg: 170, rate: 0.9, mag: 3, reserve: 18, reload: 2.0, speed: 21, spread: 0, pellets: 1, splash: 3.9, color: 0xff7a30, shake: 0.7, kb: 12, w: 0.25, len: 0.7, unlock: 4 },
];
const lvlDmg = (lv) => 1 + 0.3 * (lv - 1), lvlMag = (lv) => 1 + 0.25 * (lv - 1), lvlRate = (lv) => 1 + 0.07 * (lv - 1);
const magOf = (i) => (WEAPONS[i].mag === Infinity ? Infinity : Math.round(WEAPONS[i].mag * lvlMag(GUN[i].lvl)));
const resOf = (i) => Math.round(WEAPONS[i].reserve * lvlMag(GUN[i].lvl));

// ---------------------------------------------------------------- state
const G = { mode: "menu", wave: 0, score: 0, coins: 0, kills: 0, combo: 0, comboT: 0, bestCombo: 0, shake: 0, slow: 0, god: false, paused: false, frozen: false,
  spawnQ: [], spawnT: 0, spec: null, modeT: 0, time: 0, navT: 0, bannerT: 0, flash: 0, seen: {} };
const P = { x: 0, z: 5, vx: 0, vz: 0, kbx: 0, kbz: 0, yaw: Math.PI, hp: 100, maxHp: 100, hpLv: 0, speedLv: 0, magnetLv: 0, dashT: 0, dashCd: 0, ddx: 0, ddz: 1,
  inv: 0, weapon: 0, lastWeapon: 0, fireCd: 0, reloadT: 0, recoil: 0, walk: 0, items: { barricade: 0, turret: 0 }, tip: 0 };
let GUN = WEAPONS.map((w, i) => ({ owned: i === 0, lvl: 1, ammo: w.mag, reserve: w.reserve }));
let zombies = [], bullets = [], pickups = [], barricades = [], turrets = [];
let best = { wave: 0, score: 0 };
try { best = { ...best, ...JSON.parse(localStorage.getItem("gv_zombies_best") || "{}") }; } catch {}
const saveBest = () => { try { localStorage.setItem("gv_zombies_best", JSON.stringify(best)); } catch {} };
const aim = { x: 0, z: -4 };
let TX = 0, TZ = 0; // what the zombies chase (the player, or a spot on the menu screen)
const playing = () => G.mode === "wave" || G.mode === "countdown" || G.mode === "clear";

// ---------------------------------------------------------------- zombie grid (fast "who is near here?")
const HC = 2, HOX = -42, HOZ = -34, HNX = 42, HNZ = 34;
const hHead = new Int32Array(HNX * HNZ), hNext = new Int32Array(512);
function hashBuild() {
  hHead.fill(-1);
  for (let i = 0; i < zombies.length && i < 512; i++) {
    const z = zombies[i]; if (z.dead) continue;
    const ci = Math.floor((z.x - HOX) / HC), cj = Math.floor((z.z - HOZ) / HC); if (ci < 0 || cj < 0 || ci >= HNX || cj >= HNZ) continue;
    const c = cj * HNX + ci; hNext[i] = hHead[c]; hHead[c] = i;
  }
}
function near(x, z, r, cb) {
  const i0 = Math.max(0, Math.floor((x - r - HOX) / HC)), i1 = Math.min(HNX - 1, Math.floor((x + r - HOX) / HC));
  const j0 = Math.max(0, Math.floor((z - r - HOZ) / HC)), j1 = Math.min(HNZ - 1, Math.floor((z + r - HOZ) / HC));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { let k = hHead[j * HNX + i]; while (k >= 0) { const zz = zombies[k]; if (!zz.dead) cb(zz); k = hNext[k]; } }
}

// ---------------------------------------------------------------- zombies
let zid = 0;
function spawnZombie(type, x, z) {
  const T = ZTYPES[type], s = G.spec || { hpMul: 1 };
  let hp = T.hp * (type === "boss" ? 1 + (Math.max(1, G.wave / 5) - 1) * 0.7 : s.hpMul);
  const zz = { id: zid++, type, T, x, z, y: 0, vx: 0, vz: 0, kbx: 0, kbz: 0, yaw: 0, hp, maxHp: hp, phase: Math.random() * 6, flash: 0, squash: 0, fuse: 0, lunge: 0,
    atkCd: 0.5, losT: Math.random() * 0.3, los: false, hitT: 0, armUp: 0, grow: 1, walkAmt: 1, dead: false, stuckT: 0, chkT: 1, cx: x, cz: z,
    state: "walk", stateT: 0, slamCd: 3, roarT: 5, tele: null };
  zombies.push(zz);
  return zz;
}
function gateSpot(far) {
  let g = GATES[(Math.random() * 4) | 0];
  if (far) { const g2 = GATES[(Math.random() * 4) | 0]; if ((g2.x - P.x) ** 2 + (g2.z - P.z) ** 2 > (g.x - P.x) ** 2 + (g.z - P.z) ** 2) g = g2; }
  const o = rand(-2.2, 2.2), back = rand(0, 2.5);
  return g.ax === "x" ? [g.x + o, g.z + Math.sign(g.z) * back] : [g.x + Math.sign(g.x) * back, g.z + o];
}
function damageZombie(z, dmg, dx, dz, kb, color) {
  if (z.dead) return;
  let crit = false;
  if (color !== "boom" && Math.random() < 0.08) { dmg *= 2; crit = true; }
  z.hp -= dmg; z.flash = 1; z.squash = 1; z.hitT = 2.5;
  const m = z.T.mass; z.kbx += (dx * kb) / m; z.kbz += (dz * kb) / m;
  fx.overlay.text(z.x, 2.1 * z.T.s + 0.2, z.z, crit ? Math.round(dmg) + "!" : String(Math.round(dmg)), crit ? "#ff9a2a" : "#fff6a0", crit ? 26 : 18, 0.7);
  SFX.hit();
  if (z.hp <= 0) killZombie(z);
}
function killZombie(z) {
  if (z.dead) return;
  z.dead = true;
  const T = z.T, s = T.s;
  if (z.tele) { z.tele.used = false; z.tele.g.visible = false; }
  if (z.type === "boss") {
    fx.pop(z.x, z.z, 2.6, 0xffd23a); fx.confetti(z.x, 4, z.z, 160, 11); fx.boom(z.x, z.z, 6, 0xffd23a);
    SFX.bigPop(); G.shake = 1.4; G.slow = 1.3; banner("KING DEFEATED!", "Now that's how you save a town!", false, 2.4);
    for (let i = 0; i < 4; i++) dropPickup("heart", z.x + rand(-2, 2), z.z + rand(-2, 2));
  } else if (z.type === "boomer") {
    explode(z.x, z.z, 3.8, 80, { playerDmg: 16, color: 0x9cff3a }); SFX.splat();
  } else { fx.pop(z.x, z.z, s, T.skin); SFX.pop(); }
  // coins!
  let value = T.coins; const n = z.type === "boss" ? 24 : z.type === "tank" ? 3 : 1;
  for (let i = 0; i < n; i++) dropPickup("coin", z.x, z.z, Math.max(1, Math.round(value / n)));
  if (z.type !== "boss") {
    const hurt = P.hp < P.maxHp;
    if (hurt && Math.random() < (z.type === "tank" ? 0.14 : 0.045)) dropPickup("heart", z.x, z.z);
    else if (GUN.some((g, i) => i && g.owned) && Math.random() < 0.05) dropPickup("ammo", z.x, z.z);
  }
  // combo + score
  if (G.mode === "wave" || G.mode === "countdown" || G.mode === "clear") {
    G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 2.2; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const mult = comboMult();
    G.score += T.score * mult; G.kills++;
    if (G.combo >= 3) { SFX.combo(G.combo); $("combo").classList.remove("pop"); void $("combo").offsetWidth; $("combo").classList.add("pop"); }
    if (G.combo % 10 === 0) { const b = G.combo; G.coins += b; fx.overlay.text(P.x, 3, P.z, "COMBO BONUS +" + b, "#ffd23a", 26, 1.4, 1.2); SFX.buy(); }
  }
}
const comboMult = () => (G.combo >= 20 ? 4 : G.combo >= 10 ? 3 : G.combo >= 5 ? 2 : 1);
function explode(x, z, R, dmg, o = {}) {
  near(x, z, R + 2, (zz) => {
    const dx = zz.x - x, dz = zz.z - z, d = Math.hypot(dx, dz); if (d > R + zz.T.r) return;
    const k = 1 - 0.5 * Math.min(1, d / R), l = d || 1;
    damageZombie(zz, dmg * k, dx / l, dz / l, 14 * k, "boom");
  });
  if (o.playerDmg && G.mode !== "menu") {
    const dx = P.x - x, dz = P.z - z, d = Math.hypot(dx, dz);
    if (d < R) { const l = d || 1; P.kbx += (dx / l) * 13; P.kbz += (dz / l) * 13; hurtPlayer(o.playerDmg); }
  }
  fx.boom(x, z, R, o.color || 0xff8a2a);
  if (o.color !== 0x9cff3a) fx.smoke(x, 0.6, z, 10, 0.9, 0x555560, R * 0.6, 1.0);
  flashLight.position.set(x, 2.5, z); flashLight.color.set(o.color || 0xff8a2a); flashLight.intensity = 90;
  G.shake = Math.min(1.5, G.shake + 0.65); SFX.boom();
}

const _d = { x: 0, z: 0 };
function updateZombies(dt) {
  G.navT -= dt;
  if (G.navT <= 0) { nav.compute(TX, TZ); G.navT = 0.12; }
  hashBuild(); // (the list may have changed since last step: boomers that pop below look up their neighbours)
  const attacking = G.mode === "wave" || G.mode === "countdown" || G.mode === "clear";
  for (const z of zombies) {
    if (z.dead) continue;
    const T = z.T;
    z.flash = Math.max(0, z.flash - dt * 7); z.squash = Math.max(0, z.squash - dt * 6); z.lunge = Math.max(0, z.lunge - dt * 3); z.hitT -= dt;
    if (z.atkCd > 0) z.atkCd -= dt;
    let dx = TX - z.x, dz = TZ - z.z; const d = Math.hypot(dx, dz) || 1e-3; dx /= d; dz /= d;
    let sp = T.speed * (G.spec ? G.spec.speedMul : 1);
    if (G.mode === "menu") sp *= 0.6;
    const reach = T.r + PR + 0.2;
    let busy = false;
    if (z.type === "boss") busy = bossThink(z, dt, d);
    if (z.type === "boomer") {
      if (z.fuse > 0) { z.fuse += dt; sp *= 0.25; if (z.fuse >= 0.8) { killZombie(z); continue; } }
      else if (attacking && d < 2.4 && G.mode !== "dying") { z.fuse = 0.001; SFX.fuse(); }
    }
    // which way? straight at you if it can see you, otherwise follow the flow field around things
    z.losT -= dt;
    if (z.losT <= 0) { z.losT = 0.22 + Math.random() * 0.1; z.los = d < 16 && rayHit(z.x, z.z, TX, TZ, cols) >= 1; }
    let mx = dx, mz = dz;
    if (!z.los && d > 1.2 && nav.dir(z.x, z.z, _d)) { mx = _d.x; mz = _d.z; }
    if (busy || (d < reach && G.mode !== "menu")) sp = 0;
    const a = Math.min(1, dt * 7);
    z.vx += (mx * sp - z.vx) * a; z.vz += (mz * sp - z.vz) * a;
    z.x += (z.vx + z.kbx) * dt; z.z += (z.vz + z.kbz) * dt;
    const kd = Math.exp(-dt * 7); z.kbx *= kd; z.kbz *= kd;
    const v = Math.hypot(z.vx, z.vz);
    z.phase += dt * (1.5 + v * (z.type === "runner" ? 3.4 : 2.6) / Math.max(0.8, T.s));
    z.walkAmt = Math.min(1, v / 1.2 + 0.15);
    const want = busy ? Math.atan2(dx, dz) : v > 0.3 ? Math.atan2(z.vx, z.vz) : Math.atan2(dx, dz);
    let dy = want - z.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); z.yaw += dy * Math.min(1, dt * 8);
    // bite!
    if (attacking && !busy && d < reach + 0.2 && z.atkCd <= 0 && T.dmg > 0 && G.mode !== "dying") {
      z.atkCd = 1.05; z.lunge = 1; hurtPlayer(T.dmg * (G.spec ? G.spec.dmgMul : 1));
    }
    // stuck? (bumping into something for ages) - send it back to a gate
    z.chkT -= dt;
    if (z.chkT <= 0) {
      z.chkT = 1; const moved = Math.hypot(z.x - z.cx, z.z - z.cz); z.cx = z.x; z.cz = z.z;
      if (moved < 0.25 && !busy && d > reach + 1 && z.fuse <= 0) { if (++z.stuckT >= 6) { const s = gateSpot(true); z.x = s[0]; z.z = s[1]; z.stuckT = 0; } } else z.stuckT = 0;
    }
    if (Math.random() < dt * 0.05 && attacking) SFX.groan(z.type);
  }
  hashBuild();
  // zombies push each other apart
  for (let i = 0; i < zombies.length; i++) {
    const a = zombies[i]; if (a.dead) continue;
    near(a.x, a.z, a.T.r + 1.7, (b) => {
      if (b.id <= a.id) return;
      const dx = b.x - a.x, dz = b.z - a.z, m = a.T.r + b.T.r, d2 = dx * dx + dz * dz;
      if (d2 >= m * m || d2 < 1e-8) return;
      const d = Math.sqrt(d2), o = (m - d) / d, wa = b.T.mass / (a.T.mass + b.T.mass), k = Math.min(1, 0.6);
      a.x -= dx * o * wa * k; a.z -= dz * o * wa * k; b.x += dx * o * (1 - wa) * k; b.z += dz * o * (1 - wa) * k;
    });
  }
  // walls, crates, barricades, and you
  for (const z of zombies) {
    if (z.dead) continue;
    const bar = pushOut(z, z.T.r, cols, false);
    if (bar && G.mode !== "menu") { bar.hp -= dt * (z.T.dmg + 4) * 1.6; bar.hitT = 2; if (z.atkCd <= 0) { z.lunge = 1; z.atkCd = 0.8; } if (bar.hp <= 0) breakBarricade(bar); }
    if (G.mode !== "menu" && G.mode !== "dying" && P.dashT <= 0) {
      const dx = z.x - P.x, dz = z.z - P.z, m = z.T.r + PR, d2 = dx * dx + dz * dz;
      if (d2 < m * m && d2 > 1e-8) { const d = Math.sqrt(d2), o = (m - d) / d, wz = z.type === "boss" ? 0.05 : 0.65; z.x += dx * o * wz; z.z += dz * o * wz; P.x -= dx * o * (1 - wz); P.z -= dz * o * (1 - wz); }
    }
  }
}
// King Rotsworth: walks at you, then raises his arms and SLAMS the ground
function bossThink(z, dt, d) {
  z.roarT -= dt;
  if (z.roarT <= 0) { z.roarT = rand(6, 10); SFX.roar(); G.shake = Math.max(G.shake, 0.3); }
  z.slamCd -= dt;
  const R = 5.6;
  if (z.state === "walk") {
    if (d < 7.5 && z.slamCd <= 0 && G.mode !== "dying") {
      z.state = "wind"; z.stateT = 0;
      z.tele = teles.find((t) => !t.used) || null; if (z.tele) { z.tele.used = true; z.tele.g.visible = true; }
    }
    return false;
  }
  z.stateT += dt;
  if (z.state === "wind") {
    const t = Math.min(1, z.stateT / 1.0);
    z.armUp = t; z.grow = 1 + t * 0.08;
    if (z.tele) { z.tele.g.position.set(z.x, 0.07, z.z); z.tele.g.scale.setScalar(Math.max(0.5, R * t)); z.tele.d.material.opacity = 0.15 + 0.25 * Math.abs(Math.sin(z.stateT * 14)); }
    if (z.stateT >= 1.0) {
      z.state = "recover"; z.stateT = 0; z.armUp = 0; z.grow = 1; z.slamCd = Math.max(2.6, 4.6 - G.wave * 0.08);
      if (z.tele) { z.tele.used = false; z.tele.g.visible = false; z.tele = null; }
      fx.rings.add(z.x, z.z, 1, R * 1.2, 0.55, 0xffe070); fx.rings.add(z.x, z.z, 0.5, R, 0.4, 0xff5a3a);
      fx.smoke(z.x, 0.3, z.z, 26, 1.0, 0xc8a878, 5, 0.9); fx.burst(z.x, 0.5, z.z, 20, 0xffd080, 10, 0.12);
      G.shake = 1.3; SFX.slam();
      const dx = P.x - z.x, dz = P.z - z.z, pd = Math.hypot(dx, dz) || 1;
      if (pd < R && G.mode !== "menu") { P.kbx += (dx / pd) * 16; P.kbz += (dz / pd) * 16; hurtPlayer(28 * (G.spec ? G.spec.dmgMul : 1)); }
      for (const b of barricades) { const bx = (b.c.x0 + b.c.x1) / 2, bz = (b.c.z0 + b.c.z1) / 2; if (Math.hypot(bx - z.x, bz - z.z) < R) { b.c.hp -= 160; b.c.hitT = 2; if (b.c.hp <= 0) breakBarricade(b.c); } }
    }
    return true;
  }
  if (z.state === "recover") { if (z.stateT > 0.6) z.state = "walk"; return true; }
  return false;
}

// ---------------------------------------------------------------- the player
const keys = new Set();
let firing = false, testFire = false, wantDash = false, testMove = null;
const stickL = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, stickR = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
function hurtPlayer(dmg) {
  if (G.god || P.inv > 0 || P.dashT > 0 || G.mode === "dying" || !playing()) return;
  P.hp = Math.max(0, P.hp - dmg); P.inv = 0.5;
  G.shake = Math.min(1.5, G.shake + 0.4); G.flash = 1; SFX.hurt();
  fx.overlay.text(P.x, 2.4, P.z, "-" + Math.round(dmg), "#ff5a5a", 22, 0.8);
  if (P.hp <= 0) die();
}
function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.has("w") || keys.has("arrowup")) iz -= 1;
  if (keys.has("s") || keys.has("arrowdown")) iz += 1;
  if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
  if (keys.has("d") || keys.has("arrowright")) ix += 1;
  if (stickL.id !== null) { ix += stickL.x; iz += stickL.y; }
  if (testMove) { ix += testMove.x; iz += testMove.z; }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const speed = 6.3 + P.speedLv * 0.6;
  P.dashCd -= dt; P.inv -= dt;
  if (wantDash && P.dashCd <= 0 && G.mode !== "dying") {
    let dx = ix, dz = iz; if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(P.yaw); dz = Math.cos(P.yaw); }
    const l = Math.hypot(dx, dz) || 1; P.ddx = dx / l; P.ddz = dz / l; P.dashT = 0.2; P.dashCd = 1.1; SFX.dash();
    fx.smoke(P.x, 0.3, P.z, 6, 0.4, 0xffffff, 1.5, 0.4);
  }
  wantDash = false;
  if (P.dashT > 0) {
    P.dashT -= dt; P.vx = P.ddx * 23; P.vz = P.ddz * 23;
    fx.glow.add(P.x + rand(-0.2, 0.2), rand(0.4, 1.4), P.z + rand(-0.2, 0.2), 0, 0, 0, 0.18, 0.25, 0x5ff0ff, 0, 0, 0);
  } else {
    const a = Math.min(1, dt * 14); P.vx += (ix * speed - P.vx) * a; P.vz += (iz * speed - P.vz) * a;
  }
  P.x += (P.vx + P.kbx) * dt; P.z += (P.vz + P.kbz) * dt;
  const kd = Math.exp(-dt * 6); P.kbx *= kd; P.kbz *= kd;
  pushOut(P, PR, cols, true);
  P.x = clamp(P.x, -HX + 0.5, HX - 0.5); P.z = clamp(P.z, -HZ + 0.5, HZ - 0.5);
  // face where you aim
  const ax = aim.x - P.x, az = aim.z - P.z;
  if (ax * ax + az * az > 0.04) { const want = Math.atan2(ax, az); let d = want - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 25); }
  // shooting
  P.fireCd -= dt; P.recoil = Math.max(0, P.recoil - dt * 8);
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) finishReload(); }
  const wantFire = firing || testFire || (stickR.id !== null && Math.hypot(stickR.x, stickR.y) > 0.3);
  if (wantFire && G.mode !== "dying") tryFire();
  P.walk += dt;
  const v = Math.hypot(P.vx, P.vz);
  hero.animate(dt, Math.min(1, v / 5), P.walk, P.recoil, P.dashT > 0);
  hero.root.position.set(P.x, 0, P.z); hero.root.rotation.y = P.yaw;
  hero.body.visible = !(P.inv > 0 && Math.floor(P.inv * 20) % 2 === 0 && !G.god);
}
function muzzle() {
  const f = hero.muzzleLocal() + 0.42, s = Math.sin(P.yaw), c = Math.cos(P.yaw);
  return { x: P.x + s * f + c * 0.12, z: P.z + c * f - s * 0.12, y: 1.24 };
}
function tryFire() {
  const i = P.weapon, w = WEAPONS[i], g = GUN[i];
  if (P.fireCd > 0 || P.reloadT > 0) return;
  if (g.ammo <= 0) {
    if (g.reserve > 0) startReload();
    else { SFX.empty(); P.fireCd = 0.35; fx.overlay.text(P.x, 2.6, P.z, "Out of ammo!", "#ffd23a", 18, 0.9); switchWeapon(0); }
    return;
  }
  P.fireCd = 1 / (w.rate * lvlRate(g.lvl));
  if (w.mag !== Infinity) g.ammo--;
  const m = muzzle();
  let dx = aim.x - m.x, dz = aim.z - m.z;
  if (Math.hypot(aim.x - P.x, aim.z - P.z) < 1.6) { dx = Math.sin(P.yaw); dz = Math.cos(P.yaw); }
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const dmg = w.dmg * lvlDmg(g.lvl);
  if (w.hitscan) rail(m, dx, dz, dmg, w);
  else {
    const base = Math.atan2(dx, dz);
    for (let k = 0; k < w.pellets; k++) {
      const a = base + (w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * w.spread + rand(-0.04, 0.04) : rand(-w.spread, w.spread) / 2);
      const sp = w.speed * (w.pellets > 1 ? rand(0.85, 1.1) : 1);
      bullets.push({ x: m.x, z: m.z, y: m.y, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, dmg, life: w.life || 1.1, color: w.color, kb: w.kb, w: w.w, len: w.len, splash: w.splash || 0, rocket: w.id === "rocket" });
    }
  }
  hero.flash(w.color === 0x5ff0ff ? 0xb0ffff : 0xfff0a0); P.recoil = 1;
  flashLight.position.set(m.x, 1.6, m.z); flashLight.color.set(w.color); flashLight.intensity = Math.max(flashLight.intensity, 18);
  G.shake = Math.min(1.5, G.shake + w.shake * 0.5);
  fx.sparks(m.x, m.y, m.z, dx, dz, 3, w.color, 5);
  if (w.id === "shotgun") fx.smoke(m.x + dx * 0.3, m.y, m.z + dz * 0.3, 3, 0.25, 0xdddddd, 0.6, 0.4);
  SFX[w.id]();
  if (g.ammo === 0 && g.reserve > 0) startReload();
}
function rail(m, dx, dz, dmg, w) {
  const L = 48, ex = m.x + dx * L, ez = m.z + dz * L;
  const t = rayHit(m.x, m.z, ex, ez, cols), len = L * t, hx = m.x + dx * len, hz = m.z + dz * len;
  const hits = [];
  for (const z of zombies) {
    if (z.dead) continue;
    const px = z.x - m.x, pz = z.z - m.z, along = px * dx + pz * dz; if (along < 0 || along > len + z.T.r) continue;
    const perp = Math.abs(px * dz - pz * dx); if (perp < z.T.r + 0.15) hits.push([along, z]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  for (const [, z] of hits) { damageZombie(z, dmg, dx, dz, w.kb); fx.burst(z.x, 1.2 * z.T.s, z.z, 8, 0xff8af8, 6); }
  fx.streaks.fade(m.x, m.y, m.z, hx, 1.0, hz, 0.42, 0.32, 0xff4af0);
  fx.streaks.fade(m.x, m.y, m.z, hx, 1.0, hz, 0.16, 0.24, 0xffffff);
  for (let i = 0; i < 18; i++) { const k = Math.random() * len; fx.glow.add(m.x + dx * k, m.y - (m.y - 1) * (k / len), m.z + dz * k, rand(-1, 1), rand(0.5, 2), rand(-1, 1), 0.1, rand(0.25, 0.5), 0xff8af8, 0, 1, 0); }
  fx.sparks(hx, 1, hz, -dx, -dz, 10, 0xff8af8, 7);
}
function startReload() {
  const i = P.weapon, g = GUN[i];
  if (WEAPONS[i].mag === Infinity || P.reloadT > 0 || g.reserve <= 0 || g.ammo >= magOf(i)) return;
  P.reloadT = WEAPONS[i].reload; SFX.reload();
}
function finishReload() {
  const i = P.weapon, g = GUN[i], take = Math.min(magOf(i) - g.ammo, g.reserve);
  g.ammo += take; g.reserve -= take; P.reloadT = 0;
}
function switchWeapon(i) {
  if (i < 0 || i >= WEAPONS.length || !GUN[i].owned || i === P.weapon) return;
  P.lastWeapon = P.weapon; P.weapon = i; P.reloadT = 0; P.fireCd = Math.max(P.fireCd, 0.15);
  hero.setGun(WEAPONS[i].id); SFX.click();
  if (GUN[i].ammo <= 0 && GUN[i].reserve > 0) startReload();
}
function cycleWeapon(dir) {
  for (let k = 1; k <= WEAPONS.length; k++) { const i = (P.weapon + dir * k + WEAPONS.length * 5) % WEAPONS.length; if (GUN[i].owned) { switchWeapon(i); return; } }
}

// ---------------------------------------------------------------- bullets
function updateBullets(dt) {
  let n = 0;
  for (const b of bullets) {
    const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
    const tw = rayHit(b.x, b.z, nx, nz, cols);
    let hz = tw, hit = null;
    const sdx = nx - b.x, sdz = nz - b.z, A = sdx * sdx + sdz * sdz;
    near((b.x + nx) / 2, (b.z + nz) / 2, Math.sqrt(A) / 2 + 1.8, (z) => {
      const ex = b.x - z.x, ez = b.z - z.z, r = z.T.r, B = 2 * (ex * sdx + ez * sdz), C = ex * ex + ez * ez - r * r;
      let t; if (C < 0) t = 0; else { const disc = B * B - 4 * A * C; if (disc < 0) return; t = (-B - Math.sqrt(disc)) / (2 * A); if (t < 0) return; }
      if (t < hz) { hz = t; hit = z; }
    });
    const sp = Math.hypot(b.vx, b.vz), dx = b.vx / sp, dz = b.vz / sp;
    if (hit || tw < 1) {
      const px = b.x + sdx * hz, pz = b.z + sdz * hz;
      if (b.splash) explode(px, pz, b.splash, b.dmg, { color: 0xff8a2a });
      else if (hit) { damageZombie(hit, b.dmg, dx, dz, b.kb); fx.sparks(px, b.y, pz, -dx, -dz, 4, b.color, 6); }
      else fx.sparks(px, b.y, pz, -dx, -dz, 5, 0xfff0b0, 6);
      continue;
    }
    b.x = nx; b.z = nz; b.life -= dt;
    if (b.rocket) { b.y = Math.max(0.9, b.y - dt * 0.4); if (Math.random() < 0.7) fx.puff.add(b.x - dx * 0.5, b.y, b.z - dz * 0.5, rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), rand(0.15, 0.3), 0.5, 0xdddddd, -1, 2, 1); }
    if (b.life <= 0) { if (b.splash) explode(b.x, b.z, b.splash, b.dmg, { color: 0xff8a2a }); continue; }
    bullets[n++] = b;
  }
  bullets.length = n;
}

// ---------------------------------------------------------------- pickups
function dropPickup(kind, x, z, value = 0) {
  const a = Math.random() * Math.PI * 2, s = rand(1, 3.5);
  pickups.push({ kind, x, z, y: 1, vx: Math.cos(a) * s, vy: rand(4, 7), vz: Math.sin(a) * s, value, life: kind === "coin" ? 20 : 25, t: Math.random() * 6, pull: false });
}
function updatePickups(dt) {
  const mag = 2.6 + P.magnetLv * 1.6, vac = G.mode === "clear";
  let n = 0;
  for (const p of pickups) {
    p.t += dt; p.life -= dt;
    const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz);
    if ((d < mag && p.kind === "coin") || (d < 1.6) || (vac && p.kind === "coin")) p.pull = true;
    if (G.mode === "dying" || G.mode === "menu") p.pull = false;
    if (p.pull) {
      const sp = vac ? 22 : 14; p.x += (dx / (d || 1)) * sp * dt; p.z += (dz / (d || 1)) * sp * dt; p.y += (1 - p.y) * dt * 8;
    } else {
      p.vy -= 20 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      if (p.y < 0.45) { p.y = 0.45; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.4 : 0; p.vx *= 0.6; p.vz *= 0.6; }
      const q = { x: p.x, z: p.z }; pushOut(q, 0.25, cols, true); p.x = q.x; p.z = q.z;
    }
    if (d < 0.7 && G.mode !== "dying" && G.mode !== "menu") { collect(p); continue; }
    if (p.life <= 0 && !p.pull) continue;
    pickups[n++] = p;
  }
  pickups.length = n;
}
function collect(p) {
  if (p.kind === "coin") { G.coins += p.value; SFX.coin(); fx.overlay.text(P.x + rand(-0.4, 0.4), 2.2, P.z, "+" + p.value, "#ffd23a", 16, 0.6, 2); coinBump = 0.25; }
  else if (p.kind === "heart") { const h = Math.min(P.maxHp - P.hp, 30); P.hp += h; SFX.heal(); fx.overlay.text(P.x, 2.4, P.z, "+" + Math.max(h, 0) + " ❤", "#ff7a9a", 22, 1); fx.burst(P.x, 1.2, P.z, 14, 0xff6a8a, 5); }
  else {
    let gave = false;
    GUN.forEach((g, i) => { if (i && g.owned) { const mx = resOf(i); if (g.reserve < mx) { g.reserve = Math.min(mx, g.reserve + Math.ceil(mx * 0.4)); gave = true; } } });
    SFX.ammo(); fx.overlay.text(P.x, 2.4, P.z, gave ? "AMMO!" : "+10", gave ? "#c8ff7a" : "#ffd23a", 20, 1); if (!gave) G.coins += 10;
  }
}

// ---------------------------------------------------------------- barricades + turrets
function place(kind) {
  if (!playing() || P.items[kind] <= 0) { if (playing()) { SFX.nope(); fx.overlay.text(P.x, 2.6, P.z, kind === "turret" ? "No turrets! Buy one in the shop" : "No barricades! Buy some in the shop", "#ffd23a", 15, 1.2); } return false; }
  let x = aim.x, z = aim.z;
  const d = Math.hypot(x - P.x, z - P.z);
  if (d > 7 || d < 1.6) { x = P.x + Math.sin(P.yaw) * 2.4; z = P.z + Math.cos(P.yaw) * 2.4; }
  x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2;
  const fdx = x - P.x, fdz = z - P.z, alongZ = Math.abs(fdx) > Math.abs(fdz);
  const pts = kind === "turret" ? [[x, z]] : alongZ ? [[x, z - 1], [x, z], [x, z + 1]] : [[x - 1, z], [x, z], [x + 1, z]];
  const ok = Math.abs(x) < HX - 1.5 && Math.abs(z) < HZ - 1.5 && Math.hypot(x - P.x, z - P.z) > 1.2 && !pts.some(([px, pz]) => overlaps(px, pz, kind === "turret" ? 0.7 : 0.5, cols));
  if (!ok) { SFX.nope(); fx.overlay.text(x, 1.5, z, "Can't build here!", "#ff8a6a", 16, 1); return false; }
  P.items[kind]--;
  if (kind === "barricade") {
    const mesh = makeBarricade(alongZ); mesh.position.set(x, 0, z); scene.add(mesh);
    const c = alongZ ? { t: "b", x0: x - 0.3, x1: x + 0.3, z0: z - 1.25, z1: z + 1.25 } : { t: "b", x0: x - 1.25, x1: x + 1.25, z0: z - 0.3, z1: z + 0.3 };
    Object.assign(c, { hp: 320, max: 320, low: true, mesh, hitT: 0 });
    cols.push(c); barricades.push({ c, mesh });
  } else {
    const t = makeTurret(); t.g.position.set(x, 0, z); scene.add(t.g);
    const c = { t: "c", x, z, r: 0.5, turret: true, low: true }; cols.push(c);
    turrets.push({ x, z, g: t.g, head: t.head, yaw: 0, cd: 0, target: null, scanT: 0, c });
  }
  fx.smoke(x, 0.3, z, 8, 0.5, 0xd8c8a0, 1.2, 0.5); SFX.build();
  nav.rebuild(cols); nav.compute(TX, TZ, true);
  return true;
}
function breakBarricade(c) {
  if (c.dead) return;
  c.dead = true;
  const i = barricades.findIndex((b) => b.c === c); if (i >= 0) { scene.remove(barricades[i].mesh); barricades.splice(i, 1); }
  const k = cols.indexOf(c); if (k >= 0) cols.splice(k, 1);
  const x = (c.x0 + c.x1) / 2, z = (c.z0 + c.z1) / 2;
  fx.smoke(x, 0.5, z, 10, 0.6, 0xb08a5a, 1.5, 0.7);
  for (let j = 0; j < 14; j++) fx.solid.add(x + rand(-1, 1), rand(0.3, 1), z + rand(-1, 1), rand(-4, 4), rand(3, 7), rand(-4, 4), rand(0.2, 0.45), 1.4, 0xb07a42, 16, 1, 0);
  SFX.build(); nav.rebuild(cols); nav.compute(TX, TZ, true);
}
function updateTurrets(dt) {
  for (const t of turrets) {
    t.cd -= dt; t.scanT -= dt;
    if (t.scanT <= 0) {
      t.scanT = 0.2; t.target = null; let bd = 12 * 12;
      for (const z of zombies) { if (z.dead) continue; const d2 = (z.x - t.x) ** 2 + (z.z - t.z) ** 2; if (d2 < bd && rayHit(t.x, t.z, z.x, z.z, cols) >= 1) { bd = d2; t.target = z; } }
    }
    if (t.target && t.target.dead) t.target = null;
    if (t.target) {
      const want = Math.atan2(t.target.x - t.x, t.target.z - t.z); let d = want - t.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); t.yaw += d * Math.min(1, dt * 12);
      if (t.cd <= 0 && Math.abs(d) < 0.25) {
        t.cd = 0.28; const s = Math.sin(t.yaw), c = Math.cos(t.yaw);
        bullets.push({ x: t.x + s * 0.8, z: t.z + c * 0.8, y: 0.85, vx: s * 40, vz: c * 40, dmg: 13 + G.wave * 0.6, life: 0.4, color: 0x7dff5a, kb: 1.5, w: 0.1, len: 0.9, splash: 0 });
        fx.sparks(t.x + s * 0.85, 0.85, t.z + c * 0.85, s, c, 2, 0x7dff5a, 4); SFX.turret();
      }
    } else t.yaw += dt * 0.6;
    t.head.rotation.y = t.yaw;
  }
}

// ---------------------------------------------------------------- waves
function makeWave(n) {
  const q = [], total = Math.round(7 + n * 3.2 + n * n * 0.18);
  const wR = n >= 2 ? Math.min(0.34, 0.06 + 0.035 * n) : 0, wT = n >= 3 ? Math.min(0.17, 0.03 + 0.014 * n) : 0, wB = n >= 4 ? Math.min(0.15, 0.05 + 0.01 * n) : 0;
  for (let i = 0; i < total; i++) { const r = Math.random(); q.push(r < wR ? "runner" : r < wR + wT ? "tank" : r < wR + wT + wB ? "boomer" : "walker"); }
  if (n === 2) q.splice(2, 0, "runner", "runner"); if (n === 3) q.splice(3, 0, "tank"); if (n === 4) q.splice(2, 0, "boomer", "boomer");
  if (n % 5 === 0) { const nb = Math.floor(n / 10) + 1; for (let i = 0; i < nb; i++) q.splice(Math.floor(q.length * (0.25 + i * 0.3)), 0, "boss"); }
  return { q, hpMul: 1 + (n - 1) * 0.09 + Math.max(0, n - 10) * 0.05, speedMul: 1 + Math.min(0.3, (n - 1) * 0.025), dmgMul: 1 + (n - 1) * 0.035,
    gap: Math.max(0.2, 1.05 - n * 0.06), maxAlive: Math.min(75, 14 + n * 5) };
}
const WAVE_TIPS = { 2: "Watch out: RUNNERS are fast!", 3: "BIG TANKS take lots of hits!", 4: "BOOMERS go BOOM. Pop them from far away!", 5: "BOSS WAVE: KING ROTSWORTH!" };
function startCountdown(n) {
  G.wave = n; G.spec = makeWave(n); G.spawnQ = G.spec.q.slice(); G.spawnT = 1.2;
  G.mode = "countdown"; G.modeT = 2.4;
  GUN.forEach((g, i) => { if (i && g.owned) { g.reserve = resOf(i); if (g.ammo <= 0) g.ammo = magOf(i); } });
  arena.setMood((n - 1) / 9);
  const boss = n % 5 === 0;
  banner("WAVE " + n, WAVE_TIPS[n] || (boss ? "BOSS WAVE! The King is back!" : n > 5 ? "They're getting angrier..." : "Here they come!"), boss, 2.4);
  SFX.horn(); music(boss ? 2 : 1);
}
function updateWave(dt) {
  if (G.mode === "countdown") { G.modeT -= dt; if (G.modeT <= 0) G.mode = "wave"; }
  if (G.mode === "wave" || G.mode === "countdown") {
    G.spawnT -= dt;
    const alive = zombies.length;
    if (G.spawnT <= 0 && G.spawnQ.length && alive < G.spec.maxAlive) {
      const type = G.spawnQ.shift(), s = gateSpot(type === "boss");
      spawnZombie(type, s[0], s[1]);
      if (type === "boss") { SFX.roar(); G.shake = 0.8; banner("KING ROTSWORTH!", "Watch for his GROUND SLAM (red circle)!", true, 2.6); }
      G.spawnT = G.spec.gap * rand(0.5, 1.4) * (G.mode === "countdown" ? 1.5 : 1);
    }
    if (G.mode === "wave" && !G.spawnQ.length && !zombies.some((z) => !z.dead)) {
      G.mode = "clear"; G.modeT = 2.6;
      const bonus = 10 + G.wave * 5; G.coins += bonus;
      banner("WAVE " + G.wave + " CLEAR!", "+" + bonus + " bonus coins", false, 2.4); SFX.clear();
      fx.confetti(P.x, 3, P.z, 60, 6); music(0);
      if (G.wave > best.wave) { best.wave = G.wave; saveBest(); }
    }
  } else if (G.mode === "clear") { G.modeT -= dt; if (G.modeT <= 0) openShop(); }
}
let bannerTimer = 0;
function banner(big, small, boss, t) {
  $("bannerBig").textContent = big; $("bannerSmall").textContent = small || "";
  const b = $("banner"); b.classList.toggle("boss", !!boss); b.classList.remove("on"); void b.offsetWidth; b.classList.add("on");
  bannerTimer = t;
}

// ---------------------------------------------------------------- shop
const EXTRAS = [
  { id: "hp", icon: "❤️", name: "Max Health +25", desc: "More health, and heals you up.", max: 5, lv: () => P.hpLv, cost: (l) => 60 + l * 45 },
  { id: "speed", icon: "👟", name: "Speedy Sneakers", desc: "Run faster.", max: 4, lv: () => P.speedLv, cost: (l) => 70 + l * 50 },
  { id: "magnet", icon: "🧲", name: "Coin Magnet", desc: "Grab coins from farther away.", max: 3, lv: () => P.magnetLv, cost: (l) => 45 + l * 40 },
  { id: "heal", icon: "🩹", name: "Patch Up", desc: "Heal back to full health.", cost: () => 30 },
  { id: "barricade", icon: "🧱", name: "Barricade", desc: "A wall zombies must chew through. Press B to place.", cost: () => 35 },
  { id: "turret", icon: "🤖", name: "Auto-Turret", desc: "Shoots zombies by itself! Press T. (max 3)", cost: () => 160 },
];
function shopItems() {
  const out = [];
  WEAPONS.forEach((w, i) => {
    const g = GUN[i];
    if (!g.owned) {
      const locked = G.wave < w.unlock;
      out.push({ id: w.id, icon: w.icon, name: w.name, desc: w.desc, lvText: locked ? "Unlocks after wave " + w.unlock : "NEW!", cost: w.cost, can: !locked, label: locked ? "🔒 Locked" : "Buy " + w.cost });
    } else {
      const max = g.lvl >= 4, c = Math.round(w.up * g.lvl);
      out.push({ id: w.id, icon: w.icon, name: w.name, desc: "Upgrade: more damage" + (w.mag === Infinity ? " and speed." : ", bigger clip."), lvText: "Level " + g.lvl + "/4", cost: max ? 0 : c, can: !max, label: max ? "MAXED" : "Upgrade " + c, owned: true });
    }
  });
  for (const e of EXTRAS) {
    const l = e.lv ? e.lv() : 0, max = e.max && l >= e.max;
    let can = !max, extra = "";
    if (e.id === "heal") can = P.hp < P.maxHp;
    if (e.id === "turret") { const have = P.items.turret + turrets.length; can = have < 3; extra = "Have " + have + "/3"; }
    if (e.id === "barricade") { const have = P.items.barricade + barricades.length; can = have < 10; extra = "Have " + P.items.barricade + " to place"; }
    const c = e.cost(l);
    out.push({ id: e.id, icon: e.icon, name: e.name, desc: e.desc, lvText: e.max ? "Level " + l + "/" + e.max : extra, cost: max ? 0 : c, can, label: max ? "MAXED" : e.id === "heal" && !can ? "Full!" : "Buy " + c });
  }
  return out;
}
function buy(id) {
  const it = shopItems().find((s) => s.id === id);
  if (!it || !it.can || G.coins < it.cost) { SFX.nope(); return false; }
  G.coins -= it.cost;
  const wi = WEAPONS.findIndex((w) => w.id === id);
  if (wi >= 0) {
    const g = GUN[wi];
    if (!g.owned) { g.owned = true; g.lvl = 1; g.ammo = magOf(wi); g.reserve = resOf(wi); switchWeapon(wi); }
    else { g.lvl++; g.ammo = magOf(wi); g.reserve = resOf(wi); }
  } else if (id === "hp") { P.hpLv++; P.maxHp += 25; P.hp = Math.min(P.maxHp, P.hp + 50); }
  else if (id === "speed") P.speedLv++;
  else if (id === "magnet") P.magnetLv++;
  else if (id === "heal") P.hp = P.maxHp;
  else if (id === "barricade") P.items.barricade++;
  else if (id === "turret") P.items.turret++;
  SFX.buy(); renderShop(id);
  return true;
}
function openShop() {
  G.mode = "shop"; firing = false;
  $("shopTitle").textContent = "WAVE " + G.wave + " CLEARED!";
  $("nextWave").textContent = "▶ START WAVE " + (G.wave + 1);
  renderShop(); $("shop").classList.remove("hidden"); document.body.classList.remove("playing");
}
function renderShop(flashId) {
  $("shopCoins").textContent = G.coins;
  $("shopGrid").innerHTML = shopItems().map((s) => `<div class="card${s.owned ? " owned" : ""}${s.id === flashId ? " flash" : ""}"><span class="ic">${s.icon}</span><b>${s.name}</b><span class="lv">${s.lvText || ""}</span><p>${s.desc}</p><button type="button" data-buy="${s.id}" ${!s.can || G.coins < s.cost ? "disabled" : ""}>${s.label}</button></div>`).join("");
}
$("shopGrid").addEventListener("click", (e) => { const b = e.target.closest("button[data-buy]"); if (b) buy(b.dataset.buy); });
function closeShop() {
  if (G.mode !== "shop") return;
  $("shop").classList.add("hidden"); document.body.classList.add("playing");
  startCountdown(G.wave + 1);
}
$("nextWave").onclick = () => { audio(); closeShop(); };

// ---------------------------------------------------------------- start / game over / menus
function clearWorld() {
  zombies = []; bullets = []; pickups = [];
  for (const b of barricades) { scene.remove(b.mesh); const k = cols.indexOf(b.c); if (k >= 0) cols.splice(k, 1); }
  for (const t of turrets) { scene.remove(t.g); const k = cols.indexOf(t.c); if (k >= 0) cols.splice(k, 1); }
  barricades = []; turrets = []; for (const t of teles) { t.used = false; t.g.visible = false; }
  nav.rebuild(cols); fx.clear();
}
function startGame() {
  audio(); clearWorld();
  Object.assign(G, { wave: 0, score: 0, coins: 0, kills: 0, combo: 0, comboT: 0, bestCombo: 0, shake: 0, slow: 0, paused: false, seen: {} });
  Object.assign(P, { x: 0, z: 5, vx: 0, vz: 0, kbx: 0, kbz: 0, yaw: Math.PI, hp: 100, maxHp: 100, hpLv: 0, speedLv: 0, magnetLv: 0, dashT: 0, dashCd: 0, inv: 0, weapon: 0, lastWeapon: 0, fireCd: 0, reloadT: 0, recoil: 0, items: { barricade: 1, turret: 0 }, tip: 0 });
  GUN = WEAPONS.map((w, i) => ({ owned: i === 0, lvl: 1, ammo: w.mag, reserve: w.reserve }));
  hero.setGun("blaster"); hero.tip(0); hero.root.visible = true;
  aim.x = 0; aim.z = 0;
  for (const id of ["menu", "over", "shop", "pause"]) $(id).classList.add("hidden");
  $("hud").classList.remove("hidden"); document.body.classList.add("playing");
  TX = P.x; TZ = P.z; nav.compute(TX, TZ, true);
  startCountdown(1);
}
function die() {
  G.mode = "dying"; G.modeT = 2.2; G.slow = 1.2; firing = false;
  SFX.over(); music(0); fx.smoke(P.x, 0.6, P.z, 10, 0.6, 0xffffff, 1.5, 0.8);
  banner("OH NO!", "", true, 2);
}
function showOver() {
  G.mode = "over";
  const newBest = G.score > best.score || G.wave > best.wave;
  best.wave = Math.max(best.wave, G.wave); best.score = Math.max(best.score, G.score); saveBest();
  $("overWave").textContent = "WAVE " + G.wave; $("overScore").textContent = G.score.toLocaleString(); $("overKills").textContent = G.kills; $("overCombo").textContent = "x" + G.bestCombo;
  $("overBest").textContent = (newBest && G.score > 0 ? "🏆 NEW BEST! " : "") + "Best: wave " + best.wave + " · " + best.score.toLocaleString() + " points";
  $("over").classList.remove("hidden"); document.body.classList.remove("playing");
}
function toMenu() {
  clearWorld(); G.mode = "menu"; G.paused = false; music(0);
  for (const id of ["over", "shop", "pause", "hud"]) $(id).classList.add("hidden");
  $("menu").classList.remove("hidden"); document.body.classList.remove("playing");
  arena.setMood(0.15); hero.root.visible = false; menuZombies(); showBest();
}
function menuZombies() {
  G.spec = null;
  for (let i = 0; i < 14; i++) { const t = ["walker", "walker", "runner", "tank", "boomer"][i % 5]; spawnZombie(t, rand(-20, 20), rand(-15, 15)); }
}
function showBest() { $("best").textContent = best.wave ? "🏆 Your best: wave " + best.wave + " · " + best.score.toLocaleString() + " points" : ""; }
function setPause(on) {
  if (on && !(playing() || G.mode === "dying")) return;
  G.paused = on; firing = false; keys.clear();
  $("pause").classList.toggle("hidden", !on);
  document.body.classList.toggle("playing", !on);
}
$("start").onclick = () => { audio(); startGame(); };
$("again").onclick = () => startGame();
$("toMenu").onclick = () => toMenu();
$("resume").onclick = () => setPause(false);
$("quit").onclick = () => toMenu();
$("pauseBtn").onclick = () => setPause(!G.paused);
function updateMuteUI() { const m = isMuted(); $("muteBtn").textContent = m ? "🔇" : "🔊"; $("menuMute").textContent = m ? "🔇 Sound off" : "🔊 Sound on"; }
const toggleMute = () => { audio(); setMuted(!isMuted()); updateMuteUI(); };
$("muteBtn").onclick = toggleMute; $("menuMute").onclick = toggleMute; updateMuteUI();

// ---------------------------------------------------------------- input
const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window || Q.has("touch");
if (touch) document.body.classList.add("touch");
const CONTROLS = touch
  ? "<b>Left thumb</b> move · <b>Right thumb</b> aim + shoot · <b>DASH</b> zoom away · <b>↻</b> reload · <b>🔫</b> switch gadget · <b>🧱</b> build"
  : "<b>WASD</b> move · <b>Mouse</b> aim · <b>Hold click</b> shoot · <b>R</b> reload · <b>1-5</b> / <b>wheel</b> switch · <b>Space</b> dash · <b>B</b> barricade · <b>T</b> turret · <b>Esc</b> pause · <b>M</b> mute";
$("controls").innerHTML = CONTROLS; $("controls2").innerHTML = CONTROLS;
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  audio();
  if (e.repeat) return;
  if (k === "escape" || k === "p") { if (G.mode === "shop") return; setPause(!G.paused); return; }
  if (k === "m") { toggleMute(); return; }
  if (k === "enter" && G.mode === "menu") { startGame(); return; }
  if (k === "enter" && G.mode === "shop") { closeShop(); return; }
  if (G.paused) return;
  keys.add(k);
  if (k === " ") wantDash = true;
  if (k === "r") startReload();
  if (k === "q") switchWeapon(P.lastWeapon);
  if (k >= "1" && k <= "5") switchWeapon(+k - 1);
  if (k === "b") place("barricade");
  if (k === "t") place("turret");
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => { keys.clear(); firing = false; if (playing() && !TEST) setPause(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden && playing() && !TEST) setPause(true); });
const mouse = { x: innerWidth / 2, y: innerHeight * 0.4, used: false };
// (pointer events, so taps on a phone never count as the mouse)
addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; } });
canvas.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; audio(); mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; if (e.button === 0 && playing() && !G.paused) firing = true; if (e.button === 2 && playing()) wantDash = true; });
addEventListener("pointerup", (e) => { if (e.pointerType === "mouse" && e.button === 0) firing = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
let wheelT = 0;
addEventListener("wheel", (e) => { if (!playing() || G.paused) return; const n = performance.now(); if (n - wheelT < 120) return; wheelT = n; cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
// touch: a stick appears wherever your thumb lands (left half = move, right half = aim + fire)
const STICK = 55;
canvas.addEventListener("pointerdown", (e) => {
  audio();
  if (e.pointerType !== "touch" || !playing() || G.paused) return;
  const s = e.clientX < innerWidth / 2 ? stickL : stickR, el = s === stickL ? $("stickL") : $("stickR");
  if (s.id !== null) return;
  s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY; s.x = s.y = 0;
  el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px"; el.classList.add("on"); el.firstElementChild.style.transform = "";
});
addEventListener("pointermove", (e) => {
  for (const [s, id] of [[stickL, "stickL"], [stickR, "stickR"]]) {
    if (e.pointerId !== s.id) continue;
    let dx = e.clientX - s.ox, dy = e.clientY - s.oy; const l = Math.hypot(dx, dy); if (l > STICK) { dx *= STICK / l; dy *= STICK / l; }
    s.x = dx / STICK; s.y = dy / STICK; $(id).firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  }
});
const lift = (e) => {
  for (const [s, id] of [[stickL, "stickL"], [stickR, "stickR"]]) if (e.pointerId === s.id) { s.id = null; s.x = s.y = 0; const el = $(id); el.classList.remove("on"); el.firstElementChild.style.transform = ""; el.style.left = el.style.top = ""; }
};
addEventListener("pointerup", lift); addEventListener("pointercancel", lift);
const tb = (id, fn) => { $(id).addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); audio(); if (playing() && !G.paused) fn(); }); };
tb("tDash", () => { wantDash = true; }); tb("tReload", () => startReload()); tb("tSwap", () => cycleWeapon(1));
tb("tBuild", () => place(P.items.barricade > 0 ? "barricade" : "turret"));

// ---------------------------------------------------------------- HUD
const slotsEl = $("slots");
slotsEl.innerHTML = WEAPONS.map((w, i) => `<div class="slot" data-i="${i}"><em>${i + 1}</em>${w.icon}<small></small></div>`).join("");
slotsEl.addEventListener("pointerdown", (e) => { const s = e.target.closest(".slot"); if (s) { e.stopPropagation(); switchWeapon(+s.dataset.i); } });
const hudCache = {};
const setT = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
const setW = (id, f) => { const v = Math.round(clamp(f, 0, 1) * 1000) / 10 + "%"; if (hudCache[id + "w"] !== v) { hudCache[id + "w"] = v; $(id).style.width = v; } };
let coinBump = 0;
function hud(dt) {
  if (G.mode === "menu" || THUMB) return;
  setT("hpNum", Math.ceil(P.hp)); setW("hpFill", P.hp / P.maxHp); setW("hpLag", P.hp / P.maxHp);
  $("hpBox").classList.toggle("low", P.hp / P.maxHp < 0.3);
  setW("dashFill", 1 - Math.max(0, P.dashCd) / 1.1);
  setT("waveNum", "WAVE " + G.wave);
  const left = G.spawnQ.length + zombies.filter((z) => !z.dead).length;
  setT("zLeft", G.mode === "wave" || G.mode === "countdown" ? left + (left === 1 ? " zombie left" : " zombies left") : "");
  setT("coinNum", G.coins); setT("scoreNum", G.score.toLocaleString());
  if (coinBump > 0) { coinBump -= dt; $("coins").classList.add("bump"); } else $("coins").classList.remove("bump");
  const bosses = zombies.filter((z) => z.type === "boss" && !z.dead);
  $("bossBox").classList.toggle("hidden", !bosses.length);
  if (bosses.length) { let h = 0, m = 0; for (const b of bosses) { h += b.hp; m += b.maxHp; } setW("bossFill", h / m); setT("bossName", bosses.length > 1 ? "KING ROTSWORTH x" + bosses.length : "KING ROTSWORTH"); }
  const show = G.combo >= 3 && G.comboT > 0;
  $("combo").classList.toggle("hidden", !show);
  if (show) { setT("comboNum", "x" + G.combo); setW("comboFill", G.comboT / 2.2); }
  const w = WEAPONS[P.weapon], g = GUN[P.weapon];
  setT("gunName", w.name + (g.lvl > 1 ? " Lv" + g.lvl : ""));
  setT("ammoNum", w.mag === Infinity ? "∞" : g.ammo + " / " + g.reserve);
  $("ammoNum").classList.toggle("empty", w.mag !== Infinity && g.ammo === 0);
  $("reloadBar").classList.toggle("on", P.reloadT > 0); if (P.reloadT > 0) setW("reloadFill", 1 - P.reloadT / w.reload);
  const sig = GUN.map((q, i) => (q.owned ? 1 : 0) + ":" + (i === P.weapon ? 1 : 0) + ":" + (WEAPONS[i].mag === Infinity ? "∞" : q.ammo + q.reserve)).join("|");
  if (hudCache.sig !== sig) {
    hudCache.sig = sig;
    [...slotsEl.children].forEach((el, i) => { el.classList.toggle("on", i === P.weapon); el.classList.toggle("locked", !GUN[i].owned); el.lastElementChild.textContent = !GUN[i].owned ? "" : WEAPONS[i].mag === Infinity ? "∞" : GUN[i].ammo + GUN[i].reserve; });
  }
  const it = (P.items.barricade ? `<span>🧱 x${P.items.barricade} <b>${touch ? "" : "[B]"}</b></span>` : "") + (P.items.turret ? `<span>🤖 x${P.items.turret} <b>${touch ? "" : "[T]"}</b></span>` : "");
  if (hudCache.items !== it) { hudCache.items = it; $("items").innerHTML = it; }
  $("hurt").style.opacity = Math.max(G.flash, P.hp / P.maxHp < 0.3 ? 0.25 + 0.15 * Math.sin(G.time * 6) : 0);
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $("banner").classList.remove("on"); }
}

// ---------------------------------------------------------------- camera + drawing
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3(), ndc = new THREE.Vector2();
const camPos = new THREE.Vector3(0, 30, 30), camLook = new THREE.Vector3();
let aimOverride = null;
function updateAim() {
  if (aimOverride) { aim.x = aimOverride.x; aim.z = aimOverride.z; return; }
  if (stickR.id !== null && Math.hypot(stickR.x, stickR.y) > 0.25) { const l = Math.hypot(stickR.x, stickR.y); aim.x = P.x + (stickR.x / l) * 7; aim.z = P.z + (stickR.y / l) * 7; return; }
  if (touch && !mouse.used) { // keep aiming the same way while you move
    if (stickR.id === null) { const l = Math.hypot(aim.x - P.x, aim.z - P.z) || 1; const dx = (aim.x - P.x) / l, dz = (aim.z - P.z) / l; aim.x = P.x + dx * 7; aim.z = P.z + dz * 7; }
    return;
  }
  ndc.set((mouse.x / innerWidth) * 2 - 1, -(mouse.y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(ground, hitP)) { aim.x = hitP.x; aim.z = hitP.z; }
}
function updateCamera(dt) {
  if (G.mode === "menu") {
    const t = G.time * 0.08; camPos.set(Math.sin(t) * 34, 24, Math.cos(t) * 34); camLook.set(0, 0, 0);
  } else {
    const lx = clamp((aim.x - P.x) * 0.15, -3.5, 3.5), lz = clamp((aim.z - P.z) * 0.15, -3, 3);
    const tx = P.x + lx, tz = P.z + lz, k = Math.min(1, dt * 5);
    camLook.x += (tx - camLook.x) * k; camLook.z += (tz - camLook.z) * k; camLook.y = 0;
    camPos.set(camLook.x, 21 * camK, camLook.z + 13.5 * camK);
  }
  camera.position.copy(camPos);
  const s = G.shake * G.shake * 0.7;
  if (s > 0.001) camera.position.add(_SH.set(rand(-s, s), rand(-s, s), rand(-s, s)));
  camera.lookAt(camLook);
}
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(1, 1, 1), _P3 = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0), _SH = new THREE.Vector3();
function draw(dt) {
  updateCamera(dt);
  updateAim();
  reticle.visible = playing() && !G.paused && (!touch || stickR.id !== null || mouse.used);
  reticle.position.x = aim.x; reticle.position.z = aim.z;
  const rs = 1 + P.recoil * 0.25; reticle.scale.set(rs, 1, rs); reticle.rotation.y = G.time * 0.8;
  zr.draw(zombies);
  // bullets + the aim line
  fx.streaks.begin();
  for (const b of bullets) { const sp = Math.hypot(b.vx, b.vz); fx.streaks.line(b.x - (b.vx / sp) * b.len, b.y, b.z - (b.vz / sp) * b.len, b.x, b.y, b.z, b.w, b.color); }
  if (reticle.visible) { const m = muzzle(); fx.streaks.line(m.x, m.y - 0.05, m.z, aim.x, 0.1, aim.z, 0.025, 0x223a12); }
  fx.streaks.end(); fx.draw();
  // pickups
  const M = _M, q = _Q, sc = _S, p3 = _P3, up = _UP;
  let nc = 0, nh = 0, na = 0;
  for (const p of pickups) {
    if (p.life < 3 && Math.floor(p.life * 8) % 2 === 0) continue;
    q.setFromAxisAngle(up, p.t * 3); p3.set(p.x, p.y + Math.sin(p.t * 4) * 0.08, p.z); M.compose(p3, q, sc);
    if (p.kind === "coin" && nc < 400) coinMesh.setMatrixAt(nc++, M); else if (p.kind === "heart" && nh < 40) heartMesh.setMatrixAt(nh++, M); else if (p.kind === "ammo" && na < 40) ammoMesh.setMatrixAt(na++, M);
  }
  coinMesh.count = nc; heartMesh.count = nh; ammoMesh.count = na;
  coinMesh.instanceMatrix.needsUpdate = heartMesh.instanceMatrix.needsUpdate = ammoMesh.instanceMatrix.needsUpdate = true;
  // health bars over hurt zombies and barricades
  for (const z of zombies) if (!z.dead && z.hitT > 0 && z.type !== "boss" && z.hp < z.maxHp) fx.overlay.bars.push({ x: z.x, y: 2.25 * z.T.s + 0.25, z: z.z, w: 26 + z.T.s * 10, f: z.hp / z.maxHp, color: z.hp / z.maxHp > 0.5 ? "#7dff5a" : z.hp / z.maxHp > 0.25 ? "#ffd23a" : "#ff5a4a" });
  for (const b of barricades) if (b.c.hp < b.c.max) fx.overlay.bars.push({ x: (b.c.x0 + b.c.x1) / 2, y: 1.4, z: (b.c.z0 + b.c.z1) / 2, w: 40, f: b.c.hp / b.c.max, color: "#ffb84a" });
  fx.overlay.draw(camera);
  hud(dt);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- the loop (fixed 1/60 steps)
function fixedStep(dt) {
  G.time += dt;
  if (G.mode === "menu") {
    TX = Math.sin(G.time * 0.25) * 12; TZ = Math.cos(G.time * 0.25) * 9;
    updateZombies(dt);
    zombies = zombies.filter((z) => !z.dead);
  } else if (playing() || G.mode === "dying") {
    if (G.mode === "dying") {
      G.modeT -= dt; P.tip = Math.min(Math.PI / 2, P.tip + dt * 4); hero.tip(-P.tip); hero.root.position.set(P.x, 0, P.z);
      if (G.modeT <= 0) showOver();
    } else updatePlayer(dt);
    TX = P.x; TZ = P.z;
    updateZombies(dt);
    updateBullets(dt);
    updateTurrets(dt);
    updatePickups(dt);
    if (G.mode !== "dying") updateWave(dt);
    let n = 0; for (const z of zombies) if (!z.dead) zombies[n++] = z; zombies.length = n;
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  } else if (G.mode === "over") { updateBullets(dt); updatePickups(dt); }
  G.shake = Math.max(0, G.shake - dt * 2.2); G.flash = Math.max(0, G.flash - dt * 3);
  flashLight.intensity *= Math.exp(-dt * 18);
  fx.update(dt);
}
let acc = 0, lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (THUMB) { renderer.render(scene, camera); return; }
  if (!G.frozen && !G.paused && G.mode !== "shop") {
    let rate = 1; if (G.slow > 0) { G.slow -= dt; rate = 0.35; }
    acc += dt * rate; let n = 0;
    while (acc >= DT && n < 5) { fixedStep(DT); acc -= DT; n++; }
    if (n >= 5) acc = 0;
  } else if (G.mode === "shop" && !G.frozen) { G.time += dt; fx.update(dt); }
  draw(dt);
}

// ---------------------------------------------------------------- thumbnail scene (?thumb)
function buildThumb() {
  document.body.classList.add("thumb"); $("menu").classList.add("hidden"); $("thumbTitle").classList.remove("hidden");
  arena.setMood(0.56);
  G.mode = "thumb"; clearWorld();
  const T = THUMB_POSE;
  P.x = T.hero[0]; P.z = T.hero[1]; P.yaw = Math.atan2(T.aim[0] - P.x, T.aim[1] - P.z); hero.setGun("rail");
  hero.root.position.set(P.x, 0, P.z); hero.root.rotation.y = P.yaw; hero.animate(0.016, 0.9, 0.35, 0.7, false); hero.flash(0xffb0ff);
  for (const [t, x, z, ph] of T.horde) {
    const zz = spawnZombie(t, x, z); zz.yaw = Math.atan2(P.x - x, P.z - z) + rand(-0.2, 0.2); zz.phase = ph ?? rand(0, 6); zz.walkAmt = 1;
    if (t === "boomer") zz.fuse = 0.3;
  }
  const boss = spawnZombie("boss", T.boss[0], T.boss[1]); boss.yaw = Math.atan2(P.x - T.boss[0], P.z - T.boss[1]); boss.armUp = 0.9; boss.grow = 1.22; boss.phase = 1.2;
  const tl = teles[0]; tl.g.visible = true; tl.g.position.set(T.boss[0], 0.07, T.boss[1]); tl.g.scale.setScalar(4.2);
  // the laser beam zaps through the horde, zombies go POP
  const m = muzzle(), dx = T.aim[0] - m.x, dz = T.aim[1] - m.z, l = Math.hypot(dx, dz), ex = m.x + (dx / l) * 30, ez = m.z + (dz / l) * 30;
  fx.streaks.fade(m.x, m.y, m.z, ex, 1.2, ez, 0.55, 10, 0xff4af0); fx.streaks.fade(m.x, m.y, m.z, ex, 1.2, ez, 0.2, 10, 0xffffff);
  for (let i = 0; i < 50; i++) { const k = Math.random() * 22; fx.glow.add(m.x + (dx / l) * k + rand(-0.2, 0.2), m.y + rand(-0.35, 0.35), m.z + (dz / l) * k + rand(-0.2, 0.2), 0, 0, 0, rand(0.07, 0.15), 5, 0xff9af8, 0, 0, 0); }
  for (const [x, z, s] of T.pops) { fx.pop(x, z, s); fx.confetti(x, 1.2, z, 40, 7); }
  for (let i = 0; i < 12; i++) pickups.push({ kind: "coin", x: T.pops[0][0] + rand(-1.5, 1.5), z: T.pops[0][1] + rand(-1.5, 1.5), y: rand(0.8, 2.8), vx: 0, vy: 0, vz: 0, value: 5, life: 20, t: rand(0, 6) });
  fx.update(0.16);
  flashLight.position.set(m.x, 1.6, m.z); flashLight.color.set(0xffc0f0); flashLight.intensity = 3;
  zr.draw(zombies);
  fx.streaks.begin(); fx.streaks.end(); fx.draw();
  let nc = 0; const M = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const p of pickups) { M.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(new THREE.Vector3(0.3, 1, 0.2).normalize(), p.t), new THREE.Vector3(1.1, 1.1, 1.1)); coinMesh.setMatrixAt(nc++, M); }
  coinMesh.count = nc; coinMesh.instanceMatrix.needsUpdate = true;
  reticle.visible = false;
  camera.fov = T.fov; camera.updateProjectionMatrix();
  camera.position.set(...T.cam); camera.lookAt(...T.look);
}
const THUMB_POSE = {
  hero: [-4.5, 9.5], aim: [9, 11.5], boss: [24.5, 1.0], cam: [-4.6, 4.0, 20.2], look: [3.6, 3.0, 7.5], fov: 54,
  horde: [
    ["walker", 1.2, 10.4], ["runner", 3.0, 12.6], ["walker", 3.6, 8.6], ["boomer", 5.4, 10.8], ["walker", 6.4, 13.8], ["tank", 6.8, 6.4], ["walker", 8.6, 9.8], ["runner", 9.0, 12.8],
    ["walker", 10.4, 7.6], ["walker", 4.6, 5.0], ["boomer", 11.6, 11.2], ["walker", 12.6, 9.0], ["walker", 2.2, 4.0], ["tank", 13.4, 5.2], ["walker", 14.6, 11.6], ["runner", 15.0, 8.0],
    ["walker", 8.4, 3.2], ["walker", 12.4, 2.6], ["walker", 5.6, 1.2], ["walker", 17.2, 9.8],
  ],
  pops: [[0.6, 11.0, 1.1], [4.4, 11.8, 1.0]],
};

// ---------------------------------------------------------------- test hook
const ZS = {
  step(n = 1) { for (let i = 0; i < n; i++) fixedStep(DT); },
  render() { draw(DT); },
  start() { startGame(); },
  get god() { return G.god; }, set god(v) { G.god = !!v; },
  aimAt(x, z) { aimOverride = x === null || x === undefined ? null : { x, z }; if (aimOverride) { aim.x = x; aim.z = z; } },
  fire(on) { testFire = !!on; },
  move(x, z) { testMove = x === null || x === undefined ? null : { x, z }; },
  dash() { wantDash = true; },
  buy, place, closeShop, switchWeapon, toMenu,
  setWave(n) { G.wave = n - 1; if (G.mode === "shop") $("shop").classList.add("hidden"); zombies = []; startCountdown(n); },
  freeze(v = true) { G.frozen = v; },
  get state() { return { mode: G.mode, wave: G.wave, hp: P.hp, maxHp: P.maxHp, coins: G.coins, score: G.score, kills: G.kills, zombies: zombies.length, queue: G.spawnQ.length, weapon: WEAPONS[P.weapon].id, combo: G.combo, bestCombo: G.bestCombo, items: { ...P.items }, barricades: barricades.length, turrets: turrets.length, player: { x: P.x, z: P.z } }; },
  get zombies() { return zombies; }, get player() { return P; }, get guns() { return GUN; },
  nearest() { let b = null, bd = 1e9; for (const z of zombies) { if (z.dead) continue; const d = (z.x - P.x) ** 2 + (z.z - P.z) ** 2; if (d < bd) { bd = d; b = z; } } return b; },
};
window.ZS = ZS;

async function runTest(kind) {
  const out = { kind, errors: [] }, el = $("testOut");
  const show = () => { el.textContent = JSON.stringify(out); el.dataset.done = "1"; console.log("ZSTEST " + JSON.stringify(out)); };
  const autoplay = (frames, opts = {}) => {
    for (let i = 0; i < frames; i++) {
      const z = ZS.nearest();
      if (z) ZS.aimAt(z.x + z.vx * 0.15, z.z + z.vz * 0.15); else ZS.aimAt(P.x, P.z - 5);
      if (opts.until && opts.until()) return i;
      ZS.step(1);
    }
    return frames;
  };
  try {
    ZS.start(); ZS.god = true; ZS.fire(true);
    if (kind === "play") {
      autoplay(60 * 14); ZS.place("barricade"); autoplay(30);
      out.state = ZS.state;
    } else if (kind === "shop") {
      autoplay(60 * 120, { until: () => G.mode === "shop" });
      G.coins += 400; ZS.buy("shotgun"); ZS.buy("smg"); renderShop(); out.state = ZS.state;
    } else if (kind === "boss") {
      ZS.setWave(5); autoplay(60 * 30, { until: () => zombies.some((z) => z.type === "boss" && z.state === "wind" && z.stateT > 0.6) }); out.state = ZS.state;
      out.boss = zombies.filter((z) => z.type === "boss").map((z) => ({ hp: Math.round(z.hp), state: z.state }));
    } else if (kind === "gear") {
      G.wave = 6; G.coins = 9999;
      out.bought = ["shotgun", "smg", "rail", "rocket", "turret", "turret", "barricade", "hp", "speed", "magnet"].map((id) => id + ":" + ZS.buy(id));
      ZS.setWave(6);
      ZS.aimAt(P.x + 3, P.z - 1); out.placedTurret = ZS.place("turret"); ZS.aimAt(P.x - 3, P.z - 1); out.placedTurret2 = ZS.place("turret");
      ZS.aimAt(P.x, P.z + 3); out.placedBarricade = ZS.place("barricade"); ZS.aimAt(P.x, P.z + 3); out.placedOnTop = ZS.place("barricade");
      const per = {};
      for (let w = 1; w <= 4; w++) { ZS.switchWeapon(w); const k0 = G.kills; autoplay(60 * 8); per[WEAPONS[w].id] = G.kills - k0; }
      out.killsPerWeapon = per; out.state = ZS.state; out.ammo = GUN.map((g) => [g.ammo, g.reserve, g.lvl]);
      ZS.switchWeapon(4); autoplay(60 * 6, { until: () => fx.rings.list.some((r) => r.life > 0.3) });
    } else if (kind === "perf") {
      ZS.setWave(12); G.spawnQ = [];
      for (let i = 0; i < 90; i++) { const sp = gateSpot(false); spawnZombie(["walker", "runner", "tank", "boomer"][i % 4], sp[0], sp[1]); }
      ZS.fire(true); let t0 = performance.now(); autoplay(600); out.stepMs = +((performance.now() - t0) / 600).toFixed(3);
      out.zombies = zombies.length; t0 = performance.now(); for (let i = 0; i < 20; i++) ZS.render(); out.drawMsSwiftshader = +((performance.now() - t0) / 20).toFixed(1);
      out.state = ZS.state;
    } else if (kind === "over") {
      ZS.god = false; ZS.fire(false); autoplay(60 * 90, { until: () => G.mode === "over" }); ZS.step(5); out.state = ZS.state;
      out.overVisible = !$("over").classList.contains("hidden");
    } else if (kind === "full") {
      const log = []; let frames = 0, buys = [];
      while (G.wave < 7 && frames < 60 * 60 * 12) {
        if (G.mode === "shop") {
          log.push({ wave: G.wave, coins: G.coins, kills: G.kills, t: Math.round(frames / 60) });
          for (const id of ["shotgun", "smg", "rail", "turret", "rocket", "hp", "barricade"]) if (ZS.buy(id)) buys.push(G.wave + ":" + id);
          ZS.closeShop();
          if (P.items.turret) { ZS.aimAt(P.x + 3, P.z); ZS.place("turret"); }
        }
        frames += autoplay(60, { until: () => G.mode === "shop" }) || 1;
        if (G.mode === "wave" && GUN[P.weapon].ammo <= 0 && GUN[P.weapon].reserve <= 0) ZS.switchWeapon(0);
        // rotate through gadgets so each one gets used
        if (frames % 600 < 60) { const owned = GUN.map((g, i) => (g.owned ? i : -1)).filter((i) => i >= 0); ZS.switchWeapon(owned[(frames / 600 | 0) % owned.length]); }
      }
      out.zpos = zombies.map((z) => [z.type, +z.x.toFixed(1), +z.z.toFixed(1), Math.round(z.hp), z.los, z.stuckT]); out.waves = log; out.buys = buys; out.reachedWave = G.wave; out.frames = frames; out.state = ZS.state;
      out.turretsPlaced = turrets.length;
      // now let the horde win to check game over
      ZS.god = false; ZS.fire(false); autoplay(60 * 120, { until: () => G.mode === "over" }); ZS.step(5);
      out.overMode = G.mode; out.overVisible = !$("over").classList.contains("hidden"); out.best = JSON.parse(localStorage.getItem("gv_zombies_best") || "null");
    }
    ZS.freeze(true); ZS.aimAt(null); ZS.render();
  } catch (e) { out.errors.push(String(e && e.stack || e)); }
  show();
}
addEventListener("error", (e) => { const el = $("testOut"); el.textContent += "\nERROR " + e.message; console.error("ZSERR", e.message); });

// ---------------------------------------------------------------- go
if (THUMB) buildThumb();
else { toMenu(); if (TEST) { $("testOut").classList.remove("hidden"); setTimeout(() => runTest(TEST), 50); } }
requestAnimationFrame(frame);
