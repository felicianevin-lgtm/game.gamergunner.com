// MEGA OBBY (game.gamergunner.com/obby/): a giant 200-stage obstacle course. Every stage is a checkpoint; beat stage
// 200 for the Magic Carpet (fly anywhere, right-click players to push them back to their checkpoint).
// Files: levels.js (the whole course, made from the stage number), sfx.js (sounds). The climber + hats come from
// Lava Tower (/lava/js/player.js). Multiplayer: the GunnerVerse relay, shared rooms with ?k=ob. Test hook: window.OB.
import * as THREE from "/create/vendor/three.module.js";
import { RELAY, account } from "/create/js/net.js";
import { Climber, SKINS, HATS } from "/lava/js/player.js";
import { boxGeo, TEX } from "/lava/js/tower.js";
import { STAGES, PAD_LEN, ZONES, zoneOf, stage, spawnOf, stageType, TYPE_NAMES } from "./levels.js";
import { SFX, audio, setMuted } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- what's saved
const KEY = "gv_obby";
const S = (() => {
  const s = { v: 1, cp: 1, best: 1, carpet: false, deaths: 0, wins: 0, skin: "red", hat: "none", muted: false };
  try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && j.v === 1) Object.assign(s, j); } catch {}
  s.cp = clamp(Math.floor(+s.cp || 1), 1, STAGES + 1); s.best = clamp(Math.max(s.cp, Math.floor(+s.best || 1)), 1, STAGES + 1);
  return s;
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
// looks you unlock as you go (shirts every 25 stages, hats every 30)
const skinAt = (i) => i * 25, hatAt = (i) => i * 30;
const hasSkin = (id) => SKINS.findIndex((k) => k.id === id) >= 0 && S.best >= skinAt(SKINS.findIndex((k) => k.id === id));
const hasHat = (id) => HATS.findIndex((k) => k.id === id) >= 0 && S.best >= hatAt(HATS.findIndex((k) => k.id === id));

// ---------------------------------------------------------------- 3D
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: Q.has("test") || Q.has("thumb") });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 900);
function resize() { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const scene = new THREE.Scene(); scene.background = new THREE.Color(ZONES[0].sky); scene.fog = new THREE.Fog(ZONES[0].fog, 90, 320);
const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);
// stars (for the night + space zones)
const stars = (() => {
  const n = 1500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 500, q = Math.sqrt(1 - u * u); pos[i * 3] = Math.cos(a) * q * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sin(a) * q * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 })); scene.add(p); return p;
})();
// fluffy clouds far below (so the void doesn't look empty)
const clouds = (() => {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
  const geo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 40; i++) { const c = new THREE.Group(), a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 160; c.position.set(Math.cos(a) * d, -40 - Math.random() * 25, Math.sin(a) * d); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(geo, m); s.scale.set(8 + Math.random() * 8, 3 + Math.random() * 3, 6 + Math.random() * 6); s.position.set((Math.random() - 0.5) * 14, Math.random() * 2, (Math.random() - 0.5) * 10); c.add(s); } g.add(c); }
  g.userData.m = m; scene.add(g); return g;
})();

// textures
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const chevron = canvasTex(64, 64, (g) => { g.fillStyle = "#2a2a34"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "#ffd23f"; g.lineWidth = 8; g.beginPath(); g.moveTo(10, 46); g.lineTo(32, 20); g.lineTo(54, 46); g.stroke(); });
chevron.wrapS = chevron.wrapT = THREE.RepeatWrapping;
const slideTex = canvasTex(64, 256, (g) => { g.fillStyle = "#3ab8ff"; g.fillRect(0, 0, 64, 256); g.fillStyle = "#bdf0ff"; for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 64, 22); g.fillStyle = "#1a7ad0"; g.fillRect(0, 0, 5, 256); g.fillRect(59, 0, 5, 256); });
slideTex.wrapS = slideTex.wrapT = THREE.RepeatWrapping;
function label(text, color = "#fff", scale = 1, bg = "#0008") {
  const t = canvasTex(256, 64, (g) => { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 8, 248, 48, 14); g.fill(); g.font = "bold 32px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color; g.fillText(text.slice(0, 16), 128, 33); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(3.2 * scale, 0.8 * scale, 1); s.renderOrder = 5; return s;
}
const mats = new Map();
function mat(color, kind = "std") {
  const key = color + kind; if (mats.has(key)) return mats.get(key);
  let m;
  if (kind === "kill") m = new THREE.MeshStandardMaterial({ color, emissive: 0xff1010, emissiveIntensity: 0.7, roughness: 0.4 });
  else if (kind === "glass") m = new THREE.MeshStandardMaterial({ color, map: TEX.stud, roughness: 0.2, transparent: true, opacity: 0.85 });
  else if (kind === "glow") m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4 });
  else if (kind === "ice") { const t = slideTex.clone(); t.needsUpdate = true; m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, roughness: 0.3, emissive: 0x0a3050, emissiveIntensity: 0.4 }); }
  else m = new THREE.MeshStandardMaterial({ color, map: TEX.stud, roughness: 0.6 });
  mats.set(key, m); return m;
}

// ---------------------------------------------------------------- the course: only the stages around you are built
const loaded = new Map(); // stage -> { g: group, parts: [runtime parts] }
const SOLID = new Set(["solid", "check", "finish", "belt", "pad", "mover", "fall", "vanish", "ktile"]);
function setBox(p) { p.minX = p.x - p.w / 2; p.maxX = p.x + p.w / 2; p.minY = p.y - p.h / 2; p.maxY = p.y + p.h / 2; p.minZ = p.z - p.d / 2; p.maxZ = p.z + p.d / 2; }
function buildStage(s) {
  const st = stage(s), g = new THREE.Group(), parts = [];
  for (const d of st.parts) {
    const p = { ...d, ox: d.x, oy: d.y, oz: d.z, // (where it started: o = origin; bx / bz are a conveyor's push)
      dx: 0, dy: 0, dz: 0, state: 0, timer: 0, solid: SOLID.has(d.k) };
    if (p.k === "spin") {
      const bar = new THREE.Group(); bar.position.set(p.x, p.y, p.z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.len * 2, 0.5, 0.5), mat(0xff2a2a, "kill")); m.castShadow = true; bar.add(m);
      p.mesh = bar; g.add(bar);
    } else if (p.k === "ramp" || p.k === "rail") {
      const L = p.dir === "z" ? p.d : p.w, drop = p.y0 - p.y1, len = Math.hypot(L, drop), ang = Math.atan2(drop, L), th = p.k === "ramp" ? 0.5 : p.h;
      const m = new THREE.Mesh(p.k === "ramp" ? new THREE.BoxGeometry(p.dir === "z" ? p.w : len, th, p.dir === "z" ? len : p.d) : new THREE.BoxGeometry(p.dir === "z" ? p.w : len, th, p.dir === "z" ? len : p.d), p.k === "ramp" ? mat(p.c, "ice") : mat(p.c));
      m.position.set(p.x, (p.y0 + p.y1) / 2 - (p.k === "ramp" ? th / 2 : 0), p.z);
      if (p.dir === "z") m.rotation.x = ang; else m.rotation.z = -ang;
      if (p.k === "ramp") { m.material = m.material.clone(); m.material.map = m.material.map.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(1, len / 8); if (p.dir === "x") { m.material.map.center.set(0.5, 0.5); m.material.map.rotation = Math.PI / 2; } p.slideMap = m.material.map; }
      m.receiveShadow = true; m.castShadow = p.k === "rail"; p.mesh = m; g.add(m);
      if (p.k === "ramp") { setBox(p); p.minY = p.y1 - 1; p.maxY = p.y0 + 0.5; }
    } else if (p.k === "laser") {
      const L = Math.max(p.w, p.d), bm = new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true }), geo = new THREE.BoxGeometry(L, 0.16, 0.16);
      const beams = new THREE.Group(); beams.position.set(p.x, p.y, p.z); for (const yy of [-0.9, -0.3, 0.3, 0.9]) { const b = new THREE.Mesh(geo, bm); b.position.y = yy; beams.add(b); }
      if (p.d > p.w) beams.rotation.y = Math.PI / 2;
      p.mesh = beams; p.beamMat = bm; p.onFrac = d.on; p.on = false; g.add(beams); setBox(p);
    } else {
      const kind = p.k === "kill" || p.k === "ktile" ? "kill" : p.k === "vanish" ? "glass" : p.k === "pad" ? "glow" : "std";
      const m = new THREE.Mesh(boxGeo(p.w, p.h, p.d), p.k === "belt" ? new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.7 }) : p.k === "vanish" || p.k === "fall" ? mat(p.c, kind).clone() : mat(p.c, kind));
      m.position.set(p.x, p.y, p.z); m.castShadow = p.k !== "ktile" && p.k !== "check"; m.receiveShadow = true; p.mesh = m; g.add(m); setBox(p);
      if (p.k === "belt") {
        const along = Math.abs(p.bz) > Math.abs(p.bx) ? p.d : p.w, across = Math.abs(p.bz) > Math.abs(p.bx) ? p.w : p.d;
        const tex = chevron.clone(); tex.needsUpdate = true; tex.repeat.set(across / 2, along / 2);
        const top = new THREE.Mesh(new THREE.PlaneGeometry(across, along), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
        top.rotation.order = "YXZ"; top.rotation.y = Math.atan2(-p.bx, -p.bz); top.rotation.x = -Math.PI / 2; top.position.set(p.x, p.maxY + 0.01, p.z);
        p.tex = tex; p.speed = Math.hypot(p.bx, p.bz); g.add(top);
      }
      if (p.k === "check") addCheckSign(g, p, st);
      if (p.k === "finish") addFinish(g, p);
      if (p.k === "pad") { const r = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 6, 24), mat(0xffffff, "glow")); r.rotation.x = Math.PI / 2; r.position.set(p.x, p.maxY + 0.05, p.z); g.add(r); p.ring = r; }
    }
    parts.push(p);
  }
  scene.add(g);
  return { g, parts, st };
}
function addCheckSign(g, p, st) {
  // an arch over the start of the pad with the stage number on it
  const Z = zoneOf(p.s), alongZ = st.dir === 0, edge = (alongZ ? p.z : p.x) + PAD_LEN / 2 - 0.4; // (at the far end of the pad)
  const at = (across, y) => (alongZ ? [p.x + across, y, edge] : [edge, y, p.z + across]);
  for (const sx of [-1, 1]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.6, 0.4), mat(0xffffff)); pole.position.set(...at(sx * 3.7, p.maxY + 2.8)); pole.castShadow = true; g.add(pole); }
  const t = canvasTex(512, 128, (c) => { c.fillStyle = "#" + Z.c.toString(16).padStart(6, "0"); c.fillRect(0, 0, 512, 128); c.fillStyle = "#0004"; c.fillRect(0, 100, 512, 28); c.font = "bold 76px 'Lilita One', Inter, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.strokeStyle = "#0008"; c.lineWidth = 8; const txt = "STAGE " + p.s; c.strokeText(txt, 256, 54); c.fillText(txt, 256, 54); c.font = "bold 22px Inter, sans-serif"; c.fillText((TYPE_NAMES[stageType(p.s)] || "").toUpperCase(), 256, 114); });
  // (two one-sided boards back to back, so the writing reads the right way from both sides)
  const board = new THREE.Group(), sm = new THREE.MeshBasicMaterial({ map: t }), sg = new THREE.PlaneGeometry(7.8, 1.95);
  const front = new THREE.Mesh(sg, sm), back = new THREE.Mesh(sg, sm); back.rotation.y = Math.PI; board.add(front, back);
  board.position.set(...at(0, p.maxY + 5.3)); board.rotation.y = alongZ ? Math.PI : -Math.PI / 2; g.add(board);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 1, p.d - 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(p.x, p.maxY + 0.02, p.z); g.add(glow); p.glow = glow;
}
let carpetDisplay = null;
function addFinish(g, p) {
  const t = canvasTex(512, 128, (c) => { c.fillStyle = "#ffd23f"; c.fillRect(0, 0, 512, 128); c.font = "bold 70px 'Lilita One', Inter, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#3a2400"; c.fillText("🏆 YOU WIN! 🏆", 256, 64); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); sign.position.set(p.x, p.maxY + 7, p.z); g.add(sign); p.sign = sign;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 16), mat(0xffffff)); ped.position.set(p.x, p.maxY + 0.6, p.z); g.add(ped);
  const c = carpetModel(); c.position.set(p.x, p.maxY + 2.2, p.z); g.add(c); carpetDisplay = c;
}
function refreshWorld() {
  const at = clamp(P.fly ? flyStage : Math.max(S.cp, stageAtMe()), 1, STAGES), want = new Set();
  for (let s = at - 2; s <= at + 5; s++) if (s >= 1 && s <= STAGES) want.add(s);
  for (const [s, L] of loaded) if (!want.has(s)) { scene.remove(L.g); L.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); loaded.delete(s); }
  for (const s of want) if (!loaded.has(s)) loaded.set(s, buildStage(s));
  partsNow = []; for (const L of loaded.values()) for (const p of L.parts) partsNow.push(p);
}
let partsNow = [], flyStage = 1, flyT = 0;
// (on the Magic Carpet: the course loads around wherever you fly)
function nearestStage(p) { let best = 1, bd = Infinity; for (let s = 1; s <= STAGES; s++) { const q = spawnOf(s), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 * 0.3 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = s; } } return best; }
let lastStageAt = 1;
function stageAtMe() { return lastStageAt; }

// ---------------------------------------------------------------- the magic carpet
function carpetModel() {
  const tex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = "#b0184a"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffd23f"; g.fillRect(6, 6, w - 12, h - 12); g.fillStyle = "#7a0a40"; g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = "#ffd23f"; for (let y = 30; y < h - 20; y += 34) { g.beginPath(); g.moveTo(64, y); g.lineTo(90, y + 16); g.lineTo(64, y + 32); g.lineTo(38, y + 16); g.closePath(); g.fill(); }
    g.fillStyle = "#3affe0"; for (let y = 46; y < h - 20; y += 34) { g.beginPath(); g.arc(64, y, 5, 0, 7); g.fill(); }
  });
  const geo = new THREE.PlaneGeometry(1.7, 2.8, 8, 16); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  m.castShadow = true; m.userData.base = geo.attributes.position.array.slice();
  const grp = new THREE.Group(); grp.add(m);
  const tm = new THREE.MeshStandardMaterial({ color: 0xffd23f });
  for (const z of [-1.4, 1.4]) for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), tm); t.position.set(-0.7 + i * 0.35, 0, z + Math.sign(z) * 0.15); grp.add(t); }
  grp.userData.cloth = m;
  return grp;
}
function waveCarpet(c, t, fast) {
  const m = c.userData.cloth, pos = m.geometry.attributes.position, b = m.userData.base;
  for (let i = 0; i < pos.count; i++) { const x = b[i * 3], z = b[i * 3 + 2]; pos.setY(i, Math.sin(z * 2.2 - t * (fast ? 9 : 4)) * 0.07 + Math.sin(x * 3 + t * 2) * 0.03); }
  pos.needsUpdate = true;
}

// ---------------------------------------------------------------- you
const WALK = 12, JUMP = 13.5, GRAV = 34, FALLMAX = 55, RAD = 0.4, TALL = 1.9, COYOTE = 0.1, BUFFER = 0.13;
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), grounded: false, ground: null, coyote: 0, buffer: 0, cut: false, face: 0, stun: 0, pushed: 0, pushedBy: "", fly: false, dead: 0, stepT: 0 };
const me = new Climber(); scene.add(me.root); me.setLook(S.skin, S.hat);
me.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
const myCarpet = carpetModel(); myCarpet.visible = false; scene.add(myCarpet);
const cam = { yaw: Math.PI, pitch: 0.38, dist: 11, shake: 0 };
function respawn(quiet) {
  const sp = spawnOf(S.cp);
  P.pos.set(sp.x, sp.y + 0.05, sp.z); P.vel.set(0, 0, 0); P.grounded = false; P.ground = null; P.stun = 0; P.pushed = 0; P.dead = 0;
  P.face = sp.yaw; cam.yaw = sp.yaw + Math.PI; me.root.visible = true; lastStageAt = Math.min(S.cp, STAGES); refreshWorld();
  if (!quiet) { flash("white"); }
}
function die(why) {
  if (P.dead > 0 || P.fly) return;
  S.deaths++; save(); $("deaths").textContent = "💀 " + S.deaths.toLocaleString("en-US");
  SFX.die(); burst(P.pos.x, P.pos.y + 1, P.pos.z, [0xff3a3a, 0xffffff, 0xffd23f], 18, 7); flash("red");
  P.dead = 0.6; me.root.visible = false; cam.shake = 0.3;
  if (why) toast(why, "warn", 2200);
}

// ---------------------------------------------------------------- input
const keys = new Set(); let jumpPressed = false, jumpHeld = false;
const CODES = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", ArrowUp: "w", ArrowDown: "s", ArrowLeft: "a", ArrowRight: "d", Space: " ", KeyR: "r", KeyF: "f", KeyQ: "q", KeyC: "c", ShiftLeft: "shift", ShiftRight: "shift", ControlLeft: "control", ControlRight: "control", Escape: "escape" };
const keyName = (e) => CODES[e.code] || (e.key || "").toLowerCase();
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const k = keyName(e); audio();
  if (k === " " || k === "arrowup" || k === "arrowdown") e.preventDefault();
  if (panelOpen() && k === "escape") { closePanel(); return; }
  if (k === " " && !e.repeat) { jumpPressed = true; jumpHeld = true; }
  if (!e.repeat) { if (k === "r") { if (!P.fly) die(); } if (k === "f") toggleCarpet(); }
  keys.add(k);
});
addEventListener("keyup", (e) => { const k = keyName(e); if (k === " ") jumpHeld = false; keys.delete(k); });
addEventListener("blur", () => { keys.clear(); jumpHeld = false; });
// mouse: drag to look (left or right button), right-click (no drag) = push a player, wheel = zoom
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  audio(); canvas.focus(); if (panelOpen()) closePanel(); // (clicking the game closes a menu so you can move again)
  if (e.pointerType === "touch") return touchDown(e);
  drag = { x: e.clientX, y: e.clientY, b: e.button, moved: 0 }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return touchMove(e);
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 4) { cam.yaw -= dx * 0.0065; cam.pitch = clamp(cam.pitch + dy * 0.005, -0.6, 1.35); }
});
canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType === "touch") return touchUp(e);
  if (drag && drag.b === 2 && drag.moved <= 6) pushAt(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => { cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.12 : 0.89), 4, 28); e.preventDefault(); }, { passive: false });
// touch: the stick (left side), drag to look (right side), buttons
const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0, moved: 0 };
function touchDown(e) {
  if (e.clientX < innerWidth * 0.45 && stick.id === null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0; }
  else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; look.moved = 0; }
}
function touchMove(e) {
  if (e.pointerId === stick.id) { stick.dx = clamp(e.clientX - stick.ox, -55, 55); stick.dy = clamp(e.clientY - stick.oy, -55, 55); $("stick").firstChild.style.transform = `translate(${stick.dx}px,${stick.dy}px)`; }
  if (e.pointerId === look.id) { const dx = e.clientX - look.x, dy = e.clientY - look.y; look.moved += Math.abs(dx) + Math.abs(dy); cam.yaw -= dx * 0.008; cam.pitch = clamp(cam.pitch + dy * 0.006, -0.6, 1.35); look.x = e.clientX; look.y = e.clientY; }
}
function touchUp(e) {
  if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; $("stick").firstChild.style.transform = ""; }
  if (e.pointerId === look.id) { if (look.moved < 8 && P.fly) pushAt(e.clientX, e.clientY, true); look.id = null; }
}
{
  const b = $("tJump");
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); audio(); jumpPressed = true; jumpHeld = true; });
  const up = () => { jumpHeld = false; }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
  $("tPush").addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); pushNearest(); });
}

// ---------------------------------------------------------------- physics
const overlapXZ = (x, z, b) => x + RAD > b.minX && x - RAD < b.maxX && z + RAD > b.minZ && z - RAD < b.maxZ;
const rampY = (b, x, z) => { const t = b.dir === "z" ? (z - (b.z - b.d / 2)) / b.d : (x - (b.x - b.w / 2)) / b.w; return b.y0 + (b.y1 - b.y0) * clamp(t, 0, 1); };
function movePlayer(dt) {
  const p = P.pos, v = P.vel;
  if (P.ground && P.ground.solid) { p.x += P.ground.dx; p.y += P.ground.dy; p.z += P.ground.dz; }
  if (P.ground && P.ground.k === "belt") { p.x += P.ground.bx * dt; p.z += P.ground.bz * dt; }
  const was = P.ground, fall = -v.y;
  let ny = p.y + v.y * dt, landed = null, landY = -Infinity;
  for (const b of partsNow) {
    if (b.k === "ramp") {
      if (!overlapXZ(p.x, p.z, { minX: b.minX + RAD, maxX: b.maxX - RAD, minZ: b.minZ + RAD, maxZ: b.maxZ - RAD })) continue;
      const sy = rampY(b, p.x, p.z);
      if (v.y <= 0 && ((p.y >= sy - 0.5 && ny <= sy + 0.05) || (was === b && p.y - sy < 0.9))) { if (sy > landY) { landY = sy; landed = b; } }
      continue;
    }
    if (!b.solid || b.gone || !overlapXZ(p.x, p.z, b)) continue;
    if (v.y <= 0 && p.y >= b.maxY - 0.08 - Math.max(0, b.dy) && ny <= b.maxY) { if (b.maxY > landY) { landY = b.maxY; landed = b; } }
    else if (v.y > 0 && p.y + TALL <= b.minY + 0.08 && ny + TALL > b.minY) { ny = b.minY - TALL - 0.001; v.y = 0; }
  }
  P.grounded = false; P.ground = null;
  if (landed) { ny = landY; v.y = 0; P.grounded = true; P.ground = landed; }
  p.y = ny;
  for (const ax of ["x", "z"]) {
    const d = v[ax] * dt; if (!d) continue;
    p[ax] += d;
    for (const b of partsNow) {
      if (!b.solid || b.gone || p.y >= b.maxY - 0.01 || p.y + TALL <= b.minY + 0.01 || !overlapXZ(p.x, p.z, b)) continue;
      if ((P.grounded || P.coyote > 0) && b.maxY - p.y < 0.45) { p.y = b.maxY; P.grounded = true; P.ground = b; v.y = Math.max(0, v.y); continue; }
      if (ax === "x") p.x = d > 0 ? b.minX - RAD - 0.001 : b.maxX + RAD + 0.001; else p.z = d > 0 ? b.minZ - RAD - 0.001 : b.maxZ + RAD + 0.001;
      v[ax] = 0;
    }
  }
  // a moving platform shoving you from the side
  for (const b of partsNow) {
    if (b.k !== "mover" || p.y >= b.maxY - 0.01 || p.y + TALL <= b.minY + 0.01 || !overlapXZ(p.x, p.z, b)) continue;
    const o = [[b.maxY - p.y, "up"], [p.x + RAD - b.minX, "-x"], [b.maxX - (p.x - RAD), "+x"], [p.z + RAD - b.minZ, "-z"], [b.maxZ - (p.z - RAD), "+z"]].sort((a, c) => a[0] - c[0])[0];
    if (o[1] === "up") { p.y = b.maxY; P.grounded = true; P.ground = b; } else if (o[1] === "-x") p.x -= o[0]; else if (o[1] === "+x") p.x += o[0]; else if (o[1] === "-z") p.z -= o[0]; else p.z += o[0];
  }
  if (P.grounded && !was && fall > 8) { SFX.land(); me.squash = Math.min(1, fall / 28); }
}
function touches(b, grow = 0) { const p = P.pos; return p.x + RAD > b.minX - grow && p.x - RAD < b.maxX + grow && p.z + RAD > b.minZ - grow && p.z - RAD < b.maxZ + grow && p.y + TALL > b.minY - grow && p.y < b.maxY + grow; }

function updatePlayer(dt) {
  const p = P.pos, v = P.vel;
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { me.root.visible = true; respawn(); } return; }
  let ix = 0, iz = 0;
  if (keys.has("w")) iz += 1; if (keys.has("s")) iz -= 1; if (keys.has("d")) ix += 1; if (keys.has("a")) ix -= 1;
  if (stick.id !== null) { ix += stick.dx / 50; iz -= stick.dy / 50; }
  if (panelOpen()) ix = iz = 0;
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
  if (P.fly) { flyStep(dt, mx, mz, il); return; }
  P.stun = Math.max(0, P.stun - dt);
  const onRamp = P.ground && P.ground.k === "ramp", onIce = onRamp;
  const ctl = P.pushed > 0 ? 0 : P.stun > 0 ? 4 : onIce ? 14 : P.grounded ? 80 : 34;
  const tx = mx * WALK, tz = mz * WALK;
  if (onRamp) { // sliding: the slope pulls you down it, you can only steer a bit
    const ax = P.ground.dir; v[ax] += 22 * dt; v[ax] = Math.min(v[ax], 26);
    const side = ax === "z" ? "x" : "z"; v[side] += clamp((side === "x" ? tx : tz) - v[side], -ctl * dt, ctl * dt);
  } else {
    const ax = tx - v.x, az = tz - v.z, al = Math.hypot(ax, az), lim = ctl * dt;
    if (al > lim) { v.x += (ax / al) * lim; v.z += (az / al) * lim; } else { v.x += ax; v.z += az; }
  }
  if (il > 0.1 && P.stun <= 0 && P.pushed <= 0) P.face = Math.atan2(mx, mz);
  if (jumpPressed) P.buffer = BUFFER; else P.buffer = Math.max(0, P.buffer - dt);
  jumpPressed = false;
  P.coyote = P.grounded ? COYOTE : Math.max(0, P.coyote - dt);
  if (P.buffer > 0 && P.coyote > 0 && P.stun <= 0 && P.pushed <= 0) {
    v.y = JUMP + (P.ground && P.ground.dy > 0 ? P.ground.dy / dt : 0);
    P.grounded = false; P.ground = null; P.coyote = 0; P.buffer = 0; P.cut = false; SFX.jump();
  }
  if (!jumpHeld && !P.cut && v.y > 0 && stick.id === null) { v.y *= 0.5; P.cut = true; }
  v.y = Math.max(-FALLMAX, v.y - GRAV * dt);
  movePlayer(dt);
  const g = P.ground;
  if (g && P.grounded) {
    if (g.k === "pad") { v.y = g.pw || 22; P.grounded = false; P.ground = null; P.cut = true; SFX.bounce(); me.squash = 0.6; g.pop = 1; }
    else if (g.k === "ktile") return die("🟥 Red tiles are deadly!");
    else if (g.k === "vanish" && g.state === 0) { g.state = 1; g.timer = g.t; SFX.vanish(); }
    else if (g.k === "fall" && g.state === 0) { g.state = 1; g.timer = g.t; SFX.crumble(); }
    else if (g.k === "check") reachStage(g.s);
    else if (g.k === "finish") winGame();
    if (P.grounded && g.s === undefined && g.k !== "check") { /* (standing on something in the middle of a stage) */ }
  }
  if (P.grounded) { const hs = Math.hypot(v.x, v.z); if (hs > 1) { P.stepT -= dt * hs; if (P.stepT < 0) { P.stepT = 2.4; SFX.step(); } } }
  // the deadly stuff
  for (const b of partsNow) {
    if (b.k === "kill" && touches(b, -0.04)) return die();
    if (b.k === "laser" && b.on && touches(b, -0.05)) return die("🔴 Zapped by a laser! Wait for it to turn off.");
    if (b.k === "spin") {
      if (p.y > b.y + 0.3 || p.y + TALL < b.y - 0.3) continue;
      const dx = p.x - b.x, dz = p.z - b.z, c = Math.cos(b.a), sn = Math.sin(b.a), lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
      if (Math.abs(lx) < b.len + RAD && Math.abs(lz) < 0.25 + RAD) return die("🌀 Jump over the spinners!");
    }
  }
  // fell off
  if (p.y < deathY()) return die(P.pushed > 0 ? "💨 " + P.pushedBy + " pushed you off! Back to stage " + S.cp : null);
  if (P.pushed > 0) { P.pushed -= dt; if (P.pushed <= 0) die("💨 " + P.pushedBy + " pushed you off! Back to stage " + S.cp); }
}
function deathY() { let m = Infinity; for (let s = Math.max(1, S.cp - 1); s <= Math.min(STAGES, S.cp + 2); s++) m = Math.min(m, stage(s).minY); for (const [s, L] of loaded) if (Math.abs(s - lastStageAt) <= 1) m = Math.min(m, L.st.minY); return m - 14; }
function flyStep(dt, mx, mz, il) {
  const v = P.vel, sp = keys.has("shift") ? 40 : 24;
  const up = (keys.has(" ") || jumpHeld ? 1 : 0) - (keys.has("control") || keys.has("c") || keys.has("q") ? 1 : 0);
  const k = 1 - Math.exp(-dt * 4);
  v.x += (mx * sp - v.x) * k; v.z += (mz * sp - v.z) * k; v.y += (up * 14 - v.y) * k;
  P.pos.addScaledVector(v, dt); jumpPressed = false;
  flyT -= dt; if (flyT <= 0) { flyT = 0.5; const s = nearestStage(P.pos); if (s !== flyStage) { flyStage = s; lastStageAt = s; refreshWorld(); hud(); } }
  if (il > 0.1) P.face = Math.atan2(mx, mz);
  P.grounded = false; P.ground = null;
}

// ---------------------------------------------------------------- the moving / changing parts
let T = 0;
function updateParts(dt) {
  T += dt;
  for (const b of partsNow) {
    b.dx = b.dy = b.dz = 0;
    if (b.mv) {
      const off = b.mv.amp * Math.sin(T * b.mv.sp + b.mv.ph), nx = b.ox + (b.mv.ax === "x" ? off : 0), nz = b.oz + (b.mv.ax === "z" ? off : 0);
      b.dx = nx - b.x; b.dz = nz - b.z; b.x = nx; b.z = nz; setBox(b); b.mesh.position.set(b.x, b.y, b.z);
    }
    if (b.k === "spin") { b.a += b.sp * dt; b.mesh.rotation.y = -b.a; }
    else if (b.k === "laser") { const t = ((T + b.ph) % b.per) / b.per; b.on = t < b.onFrac; b.beamMat.opacity = b.on ? 0.95 : 0.12 + (t > 0.85 ? 0.4 * Math.abs(Math.sin(T * 30)) : 0); }
    else if (b.k === "vanish") {
      if (b.state === 1) { b.timer -= dt; b.mesh.material.opacity = 0.4 + 0.45 * Math.abs(Math.sin(T * 25)); if (b.timer <= 0) { b.state = 2; b.timer = 2.6; b.gone = true; b.mesh.visible = false; } }
      else if (b.state === 2) { b.timer -= dt; if (b.timer <= 0) { b.state = 0; b.gone = false; b.mesh.visible = true; b.mesh.material.opacity = 0.85; } }
    } else if (b.k === "fall") {
      if (b.state === 1) { b.timer -= dt; b.mesh.position.x = b.x + (Math.random() - 0.5) * 0.08; if (b.timer <= 0) { b.state = 2; b.vy = 0; b.timer = 3; } }
      else if (b.state === 2) { b.vy -= 30 * dt; const dy = b.vy * dt; b.y += dy; b.dy = dy; setBox(b); b.mesh.position.set(b.x, b.y, b.z); b.timer -= dt; if (b.timer < 1.6) { b.gone = true; b.mesh.visible = false; } if (b.timer <= 0) { b.state = 0; b.gone = false; b.y = b.oy; setBox(b); b.mesh.position.set(b.x, b.y, b.z); b.mesh.visible = true; } }
    } else if (b.k === "belt") { b.tex.offset.y -= (b.speed / 2) * dt; }
    else if (b.k === "pad" && b.ring) { b.pop = Math.max(0, (b.pop || 0) - dt * 3); b.ring.scale.setScalar(1 + Math.sin(T * 5) * 0.1 + b.pop * 0.6); }
    else if (b.k === "check" && b.glow) b.glow.material.opacity = b.s <= S.cp ? 0.1 : 0.15 + Math.sin(T * 3) * 0.08;
  }
  if (carpetDisplay) { carpetDisplay.rotation.y += dt; carpetDisplay.position.y += Math.sin(T * 2) * 0.004; waveCarpet(carpetDisplay, T, false); }
}

// ---------------------------------------------------------------- stages + winning
function reachStage(s) {
  if (s > lastStageAt) lastStageAt = s;
  if (s <= S.cp) return;
  const zoneBefore = zoneOf(S.cp);
  S.cp = s; S.best = Math.max(S.best, s); save();
  refreshWorld(); netLevel();
  if (zoneOf(s) !== zoneBefore) { SFX.zone(); banner(zoneOf(s).name.toUpperCase(), "#ffe46a", "STAGE " + s); }
  else { SFX.check(); banner("STAGE " + s, "#3aff6a", "CHECKPOINT!"); }
  burst(P.pos.x, P.pos.y + 1, P.pos.z, [0x3aff6a, 0xffd23f, 0xffffff], 22, 6);
  for (let i = 1; i < SKINS.length; i++) if (s === skinAt(i)) toast("🎨 New shirt unlocked: " + SKINS[i].name + "!", "gold", 3500);
  for (let i = 1; i < HATS.length; i++) if (s === hatAt(i)) toast(HATS[i].icon + " New hat unlocked: " + HATS[i].name + "!", "gold", 3500);
  hud();
}
function winGame() {
  if (S.cp > STAGES) return;
  S.cp = STAGES + 1; S.best = STAGES + 1; S.wins++; const first = !S.carpet; S.carpet = true; save(); netLevel();
  SFX.win(); banner("YOU BEAT THE OBBY!", "#ffd23f", first ? "🧞 You got the MAGIC CARPET!" : "Winner #" + S.wins);
  for (let i = 0; i < 5; i++) setTimeout(() => burst(P.pos.x, P.pos.y + 3, P.pos.z, [0xff3a8a, 0xffd23f, 0x3affe0, 0x3aff6a], 30, 10), i * 300);
  if (first) setTimeout(() => toast("🧞 Press F (or the 🧞 button) to ride your Magic Carpet. Right-click players to push them off!", "gold", 7000), 1500);
  hud();
}
function toggleCarpet() {
  if (!S.carpet) { toast("🧞 Beat all 200 stages to win the Magic Carpet!", "warn"); SFX.nope(); return; }
  P.fly = !P.fly; P.vel.set(0, P.fly ? 4 : 0, 0); P.pushed = 0; myCarpet.visible = P.fly; SFX.carpet();
  $("bCarpet").classList.toggle("on", P.fly);
  if (!P.fly) { toast(S.cp > STAGES ? "🧞 Carpet away! Back at the finish." : "🧞 Carpet away! You're back at stage " + S.cp, "good"); respawn(true); }
  else toast("🧞 Flying! WASD to fly, Space up, Q down, Shift = fast. Right-click a player to push them!", "gold", 4500);
}

// ---------------------------------------------------------------- multiplayer
const HUB_CODES = Array.from({ length: 12 }, (_, i) => String(7400 + i));
const others = new Map(); let conn = null, connTimer = null, sendT = 0;
function connect(i = 0) {
  if (Q.has("offline")) { $("net").textContent = "📴 Offline"; return; }
  if (i >= HUB_CODES.length) { $("net").textContent = "🔴 All servers are full: playing alone"; return; }
  $("net").textContent = "🔌 connecting...";
  const a = account(); let ws, welcomed = false;
  try { ws = new WebSocket(RELAY.replace(/^http/, "ws") + "/room/" + HUB_CODES[i] + "?mode=auto&k=ob" + (a ? "&t=" + encodeURIComponent(a.t) : "")); } catch { return; }
  const c = { ws, id: 0, skip: false, send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === "error") { if (["full", "otherroom", "taken", "locked", "notfound"].includes(m.e)) { c.skip = true; ws.close(); connect(i + 1); } return; }
    if (m.t === "welcome") { welcomed = true; conn = c; c.id = m.id; clearOthers(); for (const p of m.players || []) addOther(p.id, p.n, p.k); c.send({ t: "look", k: myLook() }); netLevel(); count(); return; }
    if (m.t === "join") { addOther(m.id, m.n, m.k); netLevel(); count(); }
    else if (m.t === "leave") { removeOther(m.id); count(); }
    else if (m.t === "s") { const o = others.get(m.id); if (o) { o.tx = m.p[0]; o.ty = m.p[1]; o.tz = m.p[2]; o.tr = m.r; o.walk = m.w; o.fly = !!m.c; if (!o.seen) { o.seen = true; o.x = o.tx; o.y = o.ty; o.z = o.tz; o.r = o.tr; } } }
    else if (m.t === "look") { const o = others.get(m.id); if (o) setOtherLook(o, m.k); }
    else if (m.t === "oblv") { const o = others.get(m.id); if (o) { o.stage = m.l; o.won = !!m.w; drawPlayers(); } }
    else if (m.t === "obpush") gotPushed(m.id);
  };
  ws.onclose = () => { if (c.skip) return; if (conn === c) { conn = null; clearOthers(); } $("net").textContent = welcomed ? "🔴 Disconnected, trying again..." : "🔴 Offline"; clearTimeout(connTimer); connTimer = setTimeout(() => connect(0), 6000); };
}
const count = () => { $("net").textContent = "🟢 Online · " + (others.size + 1) + " playing"; drawPlayers(); };
const myLook = () => [Math.max(0, SKINS.findIndex((k) => k.id === S.skin)).toString(16).padStart(6, "0"), Math.max(0, HATS.findIndex((k) => k.id === S.hat)).toString(16).padStart(6, "0")];
function netLevel() { if (conn) conn.send({ t: "oblv", l: Math.min(S.cp, STAGES + 1), w: S.carpet ? 1 : 0 }); drawPlayers(); }
function addOther(id, name, k) {
  if (others.has(id)) return;
  const m = new Climber(); m.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(m.root);
  const tag = label(name || "Player", "#fff", 1); scene.add(tag);
  const carpet = carpetModel(); carpet.visible = false; scene.add(carpet);
  const o = { m, tag, carpet, name: name || "Player", x: 0, y: -999, z: 0, r: 0, tx: 0, ty: -999, tz: 0, tr: 0, walk: 0, fly: false, seen: false, stage: 1, won: false };
  others.set(id, o); if (k) setOtherLook(o, k);
}
function setOtherLook(o, k) { if (!Array.isArray(k)) return; const si = parseInt(k[0], 16) || 0, hi = parseInt(k[1], 16) || 0; o.m.setLook((SKINS[si] || SKINS[0]).id, (HATS[hi] || HATS[0]).id); }
function removeOther(id) { const o = others.get(id); if (!o) return; scene.remove(o.m.root); scene.remove(o.tag); scene.remove(o.carpet); others.delete(id); }
function clearOthers() { for (const id of [...others.keys()]) removeOther(id); }
function drawOthers(dt) {
  for (const o of others.values()) {
    const k = Math.min(1, dt * 12);
    o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; let d = o.tr - o.r; d = Math.atan2(Math.sin(d), Math.cos(d)); o.r += d * k;
    o.m.root.position.set(o.x, o.y + (o.fly ? 0.35 : 0), o.z); o.m.root.rotation.y = o.r; o.m.animate(dt, o.walk ? 9 : 0, !!o.fly, 0, false);
    if (o.fly) sitPose(o.m);
    o.carpet.visible = o.fly; if (o.fly) { o.carpet.position.set(o.x, o.y + 0.15, o.z); o.carpet.rotation.y = o.r; waveCarpet(o.carpet, T, true); }
    o.tag.position.set(o.x, o.y + 2.75, o.z); o.m.root.visible = o.tag.visible = o.seen;
  }
}
function drawPlayers() {
  const rows = [{ n: "You", s: Math.min(S.cp, STAGES + 1), w: S.carpet }, ...[...others.values()].map((o) => ({ n: o.name, s: o.stage, w: o.won }))].sort((a, b) => b.s - a.s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  $("players").innerHTML = rows.length > 1 ? rows.map((r) => `${r.w ? "🧞 " : ""}${esc(r.n)} · <b>${r.s > STAGES ? "🏆 WON" : "Stage " + r.s}</b>`).join("<br>") : "";
}
// pushing (only on the Magic Carpet): right-click someone near the mouse
function pushAt(sx, sy, tap) {
  if (!P.fly) { if (!tap && S.carpet) { toast("🧞 Get on your Magic Carpet (F) to push people!", "warn"); SFX.nope(); } return; }
  let best = null, bd = 70 * 70; const v = new THREE.Vector3();
  for (const [id, o] of others) {
    if (!o.seen || o.fly) continue;
    if (Math.hypot(o.x - P.pos.x, o.y - P.pos.y, o.z - P.pos.z) > 32) continue;
    v.set(o.x, o.y + 1, o.z).project(camera); if (v.z > 1) continue;
    const px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight, d = (px - sx) ** 2 + (py - sy) ** 2;
    if (d < bd) { bd = d; best = [id, o]; }
  }
  if (!best) { if (!tap) toast("Right-click right on a player (closer than 30 m) to push them!", "warn"); return; }
  doPush(best[0], best[1]);
}
function pushNearest() {
  if (!P.fly) { pushAt(0, 0); return; }
  let best = null, bd = 30;
  for (const [id, o] of others) { if (!o.seen || o.fly) continue; const d = Math.hypot(o.x - P.pos.x, o.y - P.pos.y, o.z - P.pos.z); if (d < bd) { bd = d; best = [id, o]; } }
  if (best) doPush(best[0], best[1]); else toast("Nobody close enough to push!", "warn");
}
let pushCool = 0;
function doPush(id, o) {
  if (pushCool > 0) return; pushCool = 0.6;
  if (conn) conn.send({ t: "obpush", to: id });
  SFX.push(); burst(o.x, o.y + 1, o.z, [0xffffff, 0xbfe6ff], 16, 6); toast("💨 You pushed " + o.name + "!", "good", 1600);
}
function gotPushed(id) {
  const o = others.get(id); if (!o || !o.fly || P.fly || P.dead > 0) return;
  if (Math.hypot(o.x - P.pos.x, o.y - P.pos.y, o.z - P.pos.z) > 40) return; // (too far away: ignore it)
  let dx = P.pos.x - o.x, dz = P.pos.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  P.vel.set(dx * 22, 15, dz * 22); P.grounded = false; P.ground = null; P.pushed = 1.4; P.pushedBy = o.name; P.cut = true;
  SFX.pushed(); cam.shake = 0.4; burst(P.pos.x, P.pos.y + 1, P.pos.z, [0xffffff, 0xbfe6ff], 16, 6);
}

// ---------------------------------------------------------------- the camera + drawing you
function sitPose(m) { m.legs[0].rotation.x = m.legs[1].rotation.x = -1.45; m.arms[0].rotation.x = -0.5; m.arms[1].rotation.x = -0.5; m.body.position.y = -0.55; m.body.rotation.x = 0; }
let zoneNow = -1;
function updateView(dt) {
  const p = P.pos;
  me.root.position.set(p.x, p.y + (P.fly ? 0.35 : 0), p.z);
  let d = P.face - me.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); me.root.rotation.y += d * Math.min(1, dt * 14);
  me.animate(dt, P.fly ? 0 : Math.hypot(P.vel.x, P.vel.z), !P.grounded && !P.fly, P.vel.y, P.pushed > 0);
  if (P.fly) { sitPose(me); myCarpet.position.set(p.x, p.y + 0.15, p.z); myCarpet.rotation.y = me.root.rotation.y; myCarpet.rotation.z = clamp(-d * 0.6, -0.3, 0.3); waveCarpet(myCarpet, T, true); }
  // camera: behind you, a little above
  const dist = cam.dist, cx = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, cz = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist, cy = p.y + 1.7 + Math.sin(cam.pitch) * dist;
  cam.shake = Math.max(0, cam.shake - dt);
  const sh = cam.shake * 0.5;
  camera.position.set(cx + (Math.random() - 0.5) * sh, cy + (Math.random() - 0.5) * sh, cz + (Math.random() - 0.5) * sh); camera.lookAt(p.x, p.y + 1.7, p.z);
  sun.position.set(p.x + 25, p.y + 60, p.z + 15); sun.target.position.set(p.x, p.y, p.z);
  stars.position.copy(camera.position); clouds.position.set(p.x, Math.min(p.y, stage(Math.min(S.cp, STAGES)).minY) , p.z);
  // the sky changes with the zone you're in
  const zi = Math.min(ZONES.length - 1, Math.floor((Math.min(lastStageAt, STAGES) - 1) / 25)), Z = ZONES[zi];
  const k = Math.min(1, dt * 1.5);
  scene.background.lerp(new THREE.Color(Z.sky), k); scene.fog.color.lerp(new THREE.Color(Z.fog), k);
  const night = zi >= 6 ? 1 : zi === 4 ? 0.3 : 0; stars.material.opacity += (night - stars.material.opacity) * k;
  clouds.userData.m.opacity += ((zi >= 6 ? 0 : zi === 4 ? 0.25 : 0.85) - clouds.userData.m.opacity) * k; clouds.visible = clouds.userData.m.opacity > 0.02;
  clouds.userData.m.color.lerp(new THREE.Color(zi === 4 ? 0x5a2a20 : 0xffffff), k);
  hemi.intensity += ((zi >= 6 ? 0.8 : zi === 4 ? 0.9 : 1.15) - hemi.intensity) * k;
  if (zi !== zoneNow) { zoneNow = zi; hud(); }
}

// ---------------------------------------------------------------- HUD + screens
function hud() {
  const s = Math.min(S.cp, STAGES + 1);
  $("stage").innerHTML = s > STAGES ? "🏆 <b>WINNER</b>" : `STAGE <b>${s}</b><small>/ ${STAGES}</small>`;
  $("bar").firstChild.style.width = (Math.min(1, (s - 1) / STAGES) * 100).toFixed(1) + "%";
  const at = Math.min(lastStageAt, STAGES);
  $("zone").innerHTML = P.fly ? `🧞 Flying over stage ${at}<small>${zoneOf(at).name}</small>` : s > STAGES ? "🧞 You have the Magic Carpet!" : `${zoneOf(at).name}<small>Next: ${TYPE_NAMES[stageType(at)] || ""}</small>`;
  $("bCarpet").classList.toggle("hidden", !S.carpet); $("tPush").classList.toggle("hidden", !S.carpet);
  $("deaths").textContent = "💀 " + S.deaths.toLocaleString("en-US");
}
let bannerT = 0;
function banner(text, color, small) { const b = $("banner"); b.innerHTML = text + (small ? `<small>${small}</small>` : ""); b.style.color = color; b.classList.add("on"); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove("on"), 1900); }
function toast(text, kind = "good", ms = 2600) { const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = text; $("toasts").appendChild(t); while ($("toasts").children.length > 4) $("toasts").firstChild.remove(); setTimeout(() => t.remove(), ms); }
function flash(kind) { const f = $("flash"); f.className = kind === "red" ? "red" : ""; f.style.transition = "none"; f.style.opacity = kind === "red" ? 0.35 : 0.5; requestAnimationFrame(() => { f.style.transition = "opacity .4s"; f.style.opacity = 0; }); }
const panelOpen = () => !$("panel").classList.contains("hidden");
function closePanel() { $("panel").classList.add("hidden"); canvas.focus(); }
function openPanel(html, onClick) {
  const p = $("panel"); p.innerHTML = `<button type="button" class="x">✕</button>` + html; p.classList.remove("hidden");
  p.onclick = (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; SFX.click(); if (b.classList.contains("x")) return closePanel(); onClick && onClick(b); };
}
function stagesPanel() {
  const max = Math.min(S.best, STAGES);
  let html = `<h2>📍 PICK A STAGE</h2><p>Go back to any stage you've reached. Your best: <b>${S.best > STAGES ? "🏆 all 200!" : "Stage " + S.best}</b></p>`;
  for (let z = 0; z < ZONES.length; z++) {
    html += `<div class="zoneh">${ZONES[z].name} (${z * 25 + 1}–${z * 25 + 25})</div><div class="grid">`;
    for (let s = z * 25 + 1; s <= z * 25 + 25; s++) html += `<button type="button" data-s="${s}" class="${s === Math.min(S.cp, STAGES) ? "cur" : ""}" ${s > max ? "disabled" : ""}>${s}</button>`;
    html += `</div>`;
  }
  openPanel(html, (b) => { const s = +b.dataset.s; if (!s) return; S.cp = s; save(); if (P.fly) { P.fly = false; myCarpet.visible = false; $("bCarpet").classList.remove("on"); } closePanel(); respawn(); netLevel(); hud(); toast("📍 Stage " + s, "good"); });
}
function stylePanel() {
  const draw = () => `<h2>🎨 YOUR LOOK</h2><p>Unlock more by getting further!</p><b>Shirt</b><div class="looks">${SKINS.map((k, i) => `<button type="button" data-skin="${k.id}" class="${S.skin === k.id ? "on" : ""}" ${hasSkin(k.id) ? "" : "disabled"}><i style="background:#${k.color.toString(16).padStart(6, "0")}"></i>${k.name}<br><small>${hasSkin(k.id) ? "" : "🔒 Stage " + skinAt(i)}</small></button>`).join("")}</div>
    <b>Hat</b><div class="looks">${HATS.map((h, i) => `<button type="button" data-hat="${h.id}" class="${S.hat === h.id ? "on" : ""}" ${hasHat(h.id) ? "" : "disabled"}><i>${h.icon}</i>${h.name}<br><small>${hasHat(h.id) ? "" : "🔒 Stage " + hatAt(i)}</small></button>`).join("")}</div>`;
  openPanel(draw(), (b) => { if (b.dataset.skin) S.skin = b.dataset.skin; if (b.dataset.hat) S.hat = b.dataset.hat; save(); me.setLook(S.skin, S.hat); if (conn) conn.send({ t: "look", k: myLook() }); $("panel").innerHTML = `<button type="button" class="x">✕</button>` + draw(); });
}
function helpPanel() {
  openPanel(`<h2>❓ HOW TO PLAY</h2>
    <p><kbd>WASD</kbd> move · <kbd>Space</kbd> jump (hold it for a higher jump) · drag the mouse to look · wheel to zoom · <kbd>R</kbd> back to your checkpoint</p>
    <p>🏁 Every stage starts with a <b>checkpoint</b>. Fall off and you go back to the last one you reached.</p>
    <p>🟥 <b>Red = deadly</b>: kill bricks, spinners, lasers (wait until they blink off) and red checker tiles (only step on the black ones).</p>
    <p>🟦 <b>Vanishing tiles</b> disappear a moment after you land: keep moving! 🟫 <b>Falling floors</b> drop after you stand on them.</p>
    <p>🛝 <b>Slides</b> are icy: steer with A / D. 🟩 <b>Jump pads</b> launch you. ➡ <b>Conveyors</b> push you around.</p>
    <p>🧞 Beat <b>stage 200</b> to win the <b>Magic Carpet</b>: press <kbd>F</kbd> to fly anywhere (<kbd>Space</kbd> up, <kbd>Q</kbd> down, <kbd>Shift</kbd> fast), and <b>right-click</b> a player to push them off. They go back to their checkpoint!</p>
    <p>🎨 Get further to unlock shirts and hats. 📍 Go back to any stage you've reached.</p>`);
}
// the dev menu (the code is checked by the server): skip to any stage, get the Magic Carpet
const DEV_CODE = "2468";
let devOk = (() => { try { return sessionStorage.getItem("ob_dev") === "1"; } catch { return false; } })();
function devPanel() {
  if (!devOk) {
    openPanel(`<h2>🛠 DEV MENU</h2><p>Type the dev code:</p><p><input id="devCode" type="password" autocomplete="off" style="font:inherit;font-size:20px;padding:8px 12px;border-radius:10px;border:0;width:180px"> <button type="button" class="big" data-a="unlock" style="font-size:18px;padding:8px 22px">Unlock</button></p>`, (b) => {
      if (b.dataset.a !== "unlock") return;
      if ($("devCode").value.trim() === DEV_CODE) { devOk = true; try { sessionStorage.setItem("ob_dev", "1"); } catch {} SFX.check(); devPanel(); }
      else { SFX.nope(); toast("🛠 Wrong dev code", "warn"); $("devCode").value = ""; }
    });
    setTimeout(() => { const i = $("devCode"); if (i) { i.focus(); i.onkeydown = (e) => { if (e.key === "Enter") document.querySelector('#panel [data-a="unlock"]').click(); }; } }, 30);
    return;
  }
  let html = `<h2>🛠 DEV MENU</h2><p>Skip to any stage: <input id="devStage" type="number" min="1" max="${STAGES}" value="${Math.min(S.cp, STAGES)}" style="font:inherit;font-size:18px;padding:6px 10px;border-radius:10px;border:0;width:90px"> <button type="button" data-a="go" class="big" style="font-size:18px;padding:6px 20px">GO</button></p>
    <p><button type="button" data-a="carpet" class="big" style="font-size:16px;padding:8px 18px">${S.carpet ? "🧞 Take away the Magic Carpet" : "🧞 Give me the Magic Carpet"}</button> <button type="button" data-a="finish" class="big" style="font-size:16px;padding:8px 18px">🏆 Go to the finish</button></p>`;
  for (let z = 0; z < ZONES.length; z++) { html += `<div class="zoneh">${ZONES[z].name}</div><div class="grid">`; for (let s = z * 25 + 1; s <= z * 25 + 25; s++) html += `<button type="button" data-s="${s}" class="${s === Math.min(S.cp, STAGES) ? "cur" : ""}">${s}</button>`; html += `</div>`; }
  openPanel(html, (b) => {
    let s = +b.dataset.s || 0;
    if (b.dataset.a === "go") s = clamp(Math.floor(+$("devStage").value || 1), 1, STAGES);
    if (b.dataset.a === "finish") s = STAGES + 1;
    if (b.dataset.a === "carpet") { S.carpet = !S.carpet; save(); if (!S.carpet && P.fly) toggleCarpet(); hud(); netLevel(); devPanel(); toast(S.carpet ? "🧞 You got the Magic Carpet! Press F to fly." : "🧞 Carpet taken away", "gold"); return; }
    if (!s) return;
    S.cp = s; S.best = Math.max(S.best, s); save();
    if (P.fly) { P.fly = false; myCarpet.visible = false; $("bCarpet").classList.remove("on"); }
    closePanel(); respawn(); netLevel(); hud(); toast(s > STAGES ? "🛠 Skipped to the finish" : "🛠 Skipped to stage " + s, "good");
  });
}
$("bDev").onclick = () => { audio(); devPanel(); };
$("bStages").onclick = () => { audio(); stagesPanel(); };
$("bStyle").onclick = () => { audio(); stylePanel(); };
$("bHelp").onclick = () => { audio(); helpPanel(); };
$("bReset").onclick = () => { audio(); if (!P.fly) die(); };
$("bCarpet").onclick = () => { audio(); toggleCarpet(); };
$("bMute").onclick = () => { S.muted = !S.muted; setMuted(S.muted); $("bMute").textContent = S.muted ? "🔇" : "🔊"; save(); };
setMuted(S.muted); $("bMute").textContent = S.muted ? "🔇" : "🔊";
$("continue").textContent = S.cp > STAGES ? "🏆 You beat the obby! Your Magic Carpet is waiting." : S.cp > 1 ? "Continue from stage " + S.cp : "";
$("bPlay").onclick = () => { audio(); $("intro").classList.add("hidden"); $("hud").classList.remove("hidden"); canvas.focus(); hud(); };

// ---------------------------------------------------------------- confetti
const bits = [], bitGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
function burst(x, y, z, colors, n, sp) {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(bitGeo, mat(colors[i % colors.length], "glow")); m.position.set(x, y, z); scene.add(m); bits.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * sp, Math.random() * sp, (Math.random() - 0.5) * sp), life: 1 + Math.random() * 0.5 }); }
}
function updateBits(dt) { for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.life -= dt; b.v.y -= 20 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 8; b.m.scale.setScalar(Math.max(0.01, b.life)); if (b.life <= 0) { scene.remove(b.m); bits.splice(i, 1); } } }

// ---------------------------------------------------------------- the loop
function core(dt, draw = true) {
  pushCool = Math.max(0, pushCool - dt);
  updateParts(dt); updatePlayer(dt); updateView(dt); drawOthers(dt); updateBits(dt);
  // which stage you're standing in (for loading the course around you + the sky)
  if (P.grounded && P.ground && P.ground.s) lastStageAt = Math.max(lastStageAt, P.ground.s);
  sendT -= dt; if (sendT <= 0 && conn) { sendT = 0.1; const r = (v) => Math.round(v * 100) / 100; conn.send({ t: "s", p: [r(P.pos.x), r(P.pos.y), r(P.pos.z)], r: r(me.root.rotation.y), w: P.grounded && Math.hypot(P.vel.x, P.vel.z) > 1 ? 1 : 0, c: P.fly ? 1 : 0 }); }
  if (draw) renderer.render(scene, camera);
  jumpPressed = false;
}
let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  try { core(dt); } catch (e) { console.error(e); jumpPressed = false; } // (a bug in one frame never freezes the whole game)
  requestAnimationFrame(frame);
}
respawn(true); hud();
requestAnimationFrame(frame);
connect();
// test hook
window.OB = { frames: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) core(dt, false); renderer.render(scene, camera); }, S, P, cam, keys, stage, spawnOf, others, get parts() { return partsNow; }, tp: (s) => { S.cp = s; S.best = Math.max(S.best, s); respawn(true); hud(); }, toggleCarpet, die, press: () => { jumpPressed = true; jumpHeld = true; }, release: () => { jumpHeld = false; }, pushAt, pushNearest, get conn() { return conn; }, win: winGame };
