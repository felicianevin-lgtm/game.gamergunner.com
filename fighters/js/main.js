// BONK BRAWLERS: a 2D side-view 1-on-1 cartoon fighting game for GunnerVerse.
// Pick a brawler, then bonk the other one with punches, kicks and special moves. Best of 3 rounds.
// 1 player vs the computer (Easy / Normal / Hard) or 2 players on one keyboard. Keyboard, touch and gamepad.
// Everything is drawn in code on one <canvas> (960x540 "stage" scaled to fit the screen). Cartoon knockouts only: stars, no ouchies.
import { ROSTER, poseFor, blendPose, drawFighter, drawProj, drawPortrait } from "./roster.js";
import { SFX, audio, setMuted, isMuted } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const W = 960, H = 540, GROUND = 470, WALL_L = 40, WALL_R = 920, ROUND_TIME = 60;
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const store = {
  get(k, d) { try { const v = localStorage.getItem("gv_bonk_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("gv_bonk_" + k, JSON.stringify(v)); } catch {} },
};
const rand = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(rand() * a.length)];

let mode = "menu"; // menu | select | fight | pause | over | thumb
let vs = "cpu"; // cpu | 2p
let diff = store.get("diff", "normal");
let picks = [null, null], picking = 0, cursor = [0, 1];
let match = null, projs = [], fx = [], texts = [], banner = null;
let shake = 0, freeze = 0, slowmo = 0, superFreeze = 0, superBy = null, tick = 0;
setMuted(store.get("muted", false));

// ---------------------------------------------------------------- screen size
let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const s = Math.min(w / W, h / H);
  view = { s: s * dpr, ox: (w - W * s) / 2 * dpr, oy: (h - H * s) / 2 * dpr, dpr };
}
addEventListener("resize", resize); resize();

// ---------------------------------------------------------------- stages (painted once into their own canvas)
const STAGES = [
  { name: "SUNSET ROOFTOP", paint: paintRooftop },
  { name: "JUNGLE RUINS", paint: paintJungle },
  { name: "MOON BASE", paint: paintMoon },
];
const stageCache = {};
function stageCanvas(i) {
  if (!stageCache[i]) { const c = document.createElement("canvas"); c.width = W; c.height = H; STAGES[i].paint(c.getContext("2d"), seeded(i * 97 + 13)); stageCache[i] = c; }
  return stageCache[i];
}
function seeded(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function paintRooftop(g, r) {
  let gr = g.createLinearGradient(0, 0, 0, GROUND); gr.addColorStop(0, "#5b3a9a"); gr.addColorStop(0.55, "#ff5e8a"); gr.addColorStop(1, "#ffb36b");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(700, 330, 80, 0, 7); g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(r() * W, 60 + r() * 140, 60 + r() * 60, 12, 0, 0, 7); g.fill(); }
  for (const [col, y0, hmax, win] of [["#7a3f7d", 330, 200, "#ffcf7a"], ["#3d1f4a", 380, 150, "#ffd98f"]]) {
    let x = -20; while (x < W) { const w = 50 + r() * 70, h = 60 + r() * hmax; g.fillStyle = col; g.fillRect(x, y0 + 100 - h, w, h + 200); g.fillStyle = win; for (let wy = y0 + 112 - h; wy < GROUND - 10; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 14) if (r() < 0.35) g.fillRect(wx, wy, 6, 8); x += w + 6; }
  }
  // water tower
  g.fillStyle = "#2a1530"; g.fillRect(80, 330, 8, 140); g.fillRect(150, 330, 8, 140); g.fillRect(70, 260, 98, 75); g.beginPath(); g.moveTo(66, 262); g.lineTo(119, 225); g.lineTo(172, 262); g.fill();
  g.fillStyle = "#4b3a52"; g.fillRect(0, GROUND, W, H - GROUND); g.fillStyle = "#6c5674"; g.fillRect(0, GROUND, W, 8);
  g.fillStyle = "#3b2c42"; for (let x = 0; x < W; x += 64) g.fillRect(x, GROUND + 8, 2, H);
  g.fillStyle = "#5e4b66"; g.fillRect(760, GROUND - 40, 80, 40); g.fillStyle = "#3b2c42"; for (let i = 0; i < 4; i++) g.fillRect(768 + i * 18, GROUND - 32, 10, 24);
}
function paintJungle(g, r) {
  let gr = g.createLinearGradient(0, 0, 0, GROUND); gr.addColorStop(0, "#bdf2d5"); gr.addColorStop(1, "#4fae7c");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "#3f8f62"; g.beginPath(); g.moveTo(0, 380); for (let x = 0; x <= W; x += 40) g.lineTo(x, 330 + Math.sin(x * 0.012) * 40 + r() * 20); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  g.fillStyle = "#2f7a50"; g.beginPath(); g.moveTo(0, 420); for (let x = 0; x <= W; x += 30) g.lineTo(x, 400 + Math.sin(x * 0.02 + 1) * 25); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  // stone temple in the middle
  g.fillStyle = "#9b947f"; g.fillRect(380, 230, 200, 240); g.fillRect(350, 210, 260, 26); g.fillRect(400, 170, 160, 44);
  g.fillStyle = "#4a4436"; g.fillRect(450, 360, 60, 110); g.beginPath(); g.arc(480, 360, 30, Math.PI, 0); g.fill();
  g.fillStyle = "#6fbf4a"; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(360 + r() * 240, 200 + r() * 30, 8 + r() * 10, 0, 7); g.fill(); }
  for (const x of [120, 230, 730, 840]) { g.fillStyle = "#8f8a7a"; g.fillRect(x, 270, 46, 200); g.fillStyle = "#7d7868"; g.fillRect(x - 8, 262, 62, 14); g.fillStyle = "#6fbf4a"; g.beginPath(); g.arc(x + 10, 268, 12, 0, 7); g.arc(x + 34, 266, 9, 0, 7); g.fill(); }
  g.strokeStyle = "#2f8a3e"; g.lineWidth = 5; g.lineCap = "round";
  for (let i = 0; i < 12; i++) { const x = r() * W, len = 60 + r() * 160; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 20, len / 2, x - 5, len); g.stroke(); g.fillStyle = "#4fbf5a"; for (let y = 20; y < len; y += 26) { g.beginPath(); g.ellipse(x + 8, y, 9, 5, 0.5, 0, 7); g.fill(); } }
  g.fillStyle = "#7d7462"; g.fillRect(0, GROUND, W, H - GROUND); g.fillStyle = "#958b75"; g.fillRect(0, GROUND, W, 7);
  g.fillStyle = "#6a6252"; for (let x = 0; x < W; x += 80) g.fillRect(x + ((x / 80) % 2) * 40, GROUND + 7, 3, H);
  g.fillStyle = "#5fb04a"; for (let i = 0; i < 30; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, GROUND + 2); g.lineTo(x + 4, GROUND - 10); g.lineTo(x + 8, GROUND + 2); g.fill(); }
}
function paintMoon(g, r) {
  let gr = g.createLinearGradient(0, 0, 0, GROUND); gr.addColorStop(0, "#07051a"); gr.addColorStop(1, "#2a1f5e");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; g.fillRect(r() * W, r() * 400, r() < 0.1 ? 3 : 1.6, r() < 0.1 ? 3 : 1.6); }
  g.fillStyle = "#3a7bd5"; g.beginPath(); g.arc(200, 130, 80, 0, 7); g.fill();
  g.fillStyle = "#56c26a"; g.beginPath(); g.ellipse(180, 110, 30, 18, 0.4, 0, 7); g.ellipse(230, 160, 22, 14, -0.3, 0, 7); g.fill();
  g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(200, 80, 40, 7, 0, 0, 7); g.fill();
  g.fillStyle = "#cfcfe0"; g.beginPath(); g.arc(780, 90, 26, 0, 7); g.fill();
  g.fillStyle = "#8a86a8"; g.beginPath(); g.moveTo(0, 420); for (let x = 0; x <= W; x += 30) g.lineTo(x, 405 + Math.sin(x * 0.02) * 12 + r() * 6); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  for (const [x, rr] of [[640, 70], [760, 50], [300, 45]]) { g.fillStyle = "rgba(170,220,255,0.35)"; g.beginPath(); g.arc(x, 425, rr, Math.PI, 0); g.fill(); g.strokeStyle = "#cfe8ff"; g.lineWidth = 3; g.stroke(); }
  g.fillStyle = "#5b6475"; g.fillRect(0, GROUND, W, H - GROUND); g.fillStyle = "#8590a6"; g.fillRect(0, GROUND, W, 6);
  for (let x = 0; x < W; x += 40) { g.fillStyle = (x / 40) % 2 ? "#ffd23f" : "#2a2f3a"; g.fillRect(x, GROUND + 6, 40, 8); }
  g.fillStyle = "#3d4454"; for (let x = 20; x < W; x += 120) { g.fillRect(x, GROUND + 30, 60, 4); g.fillStyle = "#6ff"; g.fillRect(x + 70, GROUND + 26, 8, 8); g.fillStyle = "#3d4454"; }
}

// ---------------------------------------------------------------- input
const keys = new Set();
const KEYMAP = {
  p1: { l: ["KeyA"], r: ["KeyD"], u: ["KeyW"], d: ["KeyS"], L: ["KeyF"], H: ["KeyG"], S: ["KeyH"], X: ["KeyR"] },
  p2: { l: ["ArrowLeft"], r: ["ArrowRight"], u: ["ArrowUp"], d: ["ArrowDown"], L: ["Comma", "Numpad1"], H: ["Period", "Numpad2"], S: ["Slash", "Numpad3"], X: ["Semicolon", "Numpad5"] },
  solo: { l: ["KeyA", "ArrowLeft"], r: ["KeyD", "ArrowRight"], u: ["KeyW", "ArrowUp", "Space"], d: ["KeyS", "ArrowDown"], L: ["KeyF", "KeyJ", "Comma", "Numpad1"], H: ["KeyG", "KeyK", "Period", "Numpad2"], S: ["KeyH", "KeyL", "Slash", "Numpad3"], X: ["KeyR", "Semicolon", "Numpad5"] },
};
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Slash"]);
const touchIn = { l: 0, r: 0, u: 0, d: 0, L: 0, H: 0, S: 0, X: 0 }, touchTap = {}; // (touchTap: a quick tap still counts even if it ends before the next game step)
function readPad(i) {
  const o = {};
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], list = [...pads].filter(Boolean), p = list[i];
    if (!p) return o;
    const b = (n) => p.buttons[n] && p.buttons[n].pressed, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    o.l = b(14) || ax < -0.5; o.r = b(15) || ax > 0.5; o.u = b(12) || ay < -0.6; o.d = b(13) || ay > 0.6;
    o.L = b(0); o.H = b(1); o.S = b(2); o.X = b(3) || b(5);
  } catch {}
  return o;
}
function readInput(side) {
  const map = vs === "cpu" ? KEYMAP.solo : side === 0 ? KEYMAP.p1 : KEYMAP.p2, o = {};
  for (const k in map) o[k] = map[k].some((c) => keys.has(c));
  if (side === 0) { for (const k in touchIn) o[k] = o[k] || !!touchIn[k] || !!touchTap[k]; for (const k in touchTap) delete touchTap[k]; }
  const pad = readPad(vs === "cpu" ? 0 : side); for (const k in pad) o[k] = o[k] || pad[k];
  return o;
}
addEventListener("keydown", (e) => {
  audio();
  if (GAME_KEYS.has(e.code) && (mode === "fight" || mode === "select")) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (mode === "fight" && (e.code === "Escape" || e.code === "KeyP")) { setMode("pause"); return; }
  if (mode === "pause" && (e.code === "Escape" || e.code === "KeyP")) { setMode("fight"); return; }
  if (mode === "select" && selectKey(e.code)) e.preventDefault();
  if (e.code === "KeyM" && mode !== "select") toggleMute();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); for (const k in touchIn) touchIn[k] = 0; if (mode === "fight") setMode("pause"); });
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "fight") setMode("pause"); });

// touch: a d-pad on the left (slide your thumb around), PUNCH / KICK / SPECIAL / SUPER on the right
const isTouch = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && "ontouchstart" in window);
let usedTouch = isTouch;
(function setupTouch() {
  const pad = $("dpad"); let pid = null;
  const set = (e) => {
    const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), dz = r.width * 0.14;
    touchIn.l = dx < -dz && Math.abs(dy) < Math.abs(dx) * 2.2 ? 1 : 0; touchIn.r = dx > dz && Math.abs(dy) < Math.abs(dx) * 2.2 ? 1 : 0;
    touchIn.u = dy < -dz && Math.abs(dx) < Math.abs(dy) * 2.2 ? 1 : 0; touchIn.d = dy > dz && Math.abs(dx) < Math.abs(dy) * 2.2 ? 1 : 0;
    pad.dataset.dir = (touchIn.u ? "u" : "") + (touchIn.d ? "d" : "") + (touchIn.l ? "l" : "") + (touchIn.r ? "r" : "");
  };
  const clear = () => { pid = null; touchIn.l = touchIn.r = touchIn.u = touchIn.d = 0; pad.dataset.dir = ""; };
  pad.addEventListener("pointerdown", (e) => { e.preventDefault(); audio(); pid = e.pointerId; try { pad.setPointerCapture(pid); } catch {} set(e); });
  pad.addEventListener("pointermove", (e) => { if (e.pointerId === pid) set(e); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) pad.addEventListener(ev, (e) => { if (e.pointerId === pid) clear(); });
  for (const b of document.querySelectorAll("#tbtns button")) {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); audio(); touchIn[k] = 1; touchTap[k] = 1; b.classList.add("on"); });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => { touchIn[k] = 0; b.classList.remove("on"); });
  }
  addEventListener("touchstart", () => { if (!usedTouch) { usedTouch = true; showTouch(); } }, { passive: true });
  document.addEventListener("contextmenu", (e) => { if (mode === "fight") e.preventDefault(); });
})();
function showTouch() { $("touch").classList.toggle("hidden", !(usedTouch && mode === "fight")); }

// ---------------------------------------------------------------- moves
function buildMoves(def) {
  const pw = def.power, sp = def.specials, su = def.super;
  const M = {
    L: { id: "L", pose: "jab", startup: 4, active: 3, rec: 8, dmg: 40 * pw, hb: [18, -128, 62, 28], type: "high", hs: 15, bs: 10, kb: 3, cancel: true, sfx: "whiff" },
    H: { id: "H", pose: "kick", startup: 9, active: 4, rec: 17, dmg: 85 * pw, hb: [16, -112, 82, 44], type: "mid", hs: 21, bs: 14, kb: 7, shake: 5, sfx: "whiffBig" },
    cL: { id: "cL", pose: "cjab", startup: 4, active: 3, rec: 8, dmg: 32 * pw, hb: [16, -74, 64, 26], type: "mid", hs: 14, bs: 9, kb: 3, cancel: true, crouch: true, sfx: "whiff" },
    cH: { id: "cH", pose: "sweep", startup: 8, active: 5, rec: 22, dmg: 75 * pw, hb: [10, -28, 96, 26], type: "low", hs: 20, bs: 14, kb: 5, knock: true, crouch: true, shake: 4, sfx: "whiffBig" },
    jL: { id: "jL", pose: "jpunch", startup: 4, active: 8, rec: 4, dmg: 50 * pw, hb: [8, -95, 60, 48], type: "over", hs: 16, bs: 11, kb: 3, air: true, sfx: "whiff" },
    jH: { id: "jH", pose: "jkick", startup: 6, active: 8, rec: 6, dmg: 80 * pw, hb: [6, -66, 76, 52], type: "over", hs: 20, bs: 13, kb: 5, air: true, shake: 3, sfx: "whiffBig" },
    proj: { id: "proj", pose: "throw", startup: 12, active: 1, rec: 22, spawn: true, special: true },
  };
  const f = sp.fwd, HB = { spin: [-62, -118, 124, 72], rocket: [10, -112, 80, 62], pan: [20, -150, 92, 140], slide: [0, -40, 92, 40], roll: [-34, -96, 104, 96], poke: [20, -112, 100, 34], rush: [-6, -136, 92, 130] };
  M.fwd = { id: "fwd", pose: f.pose, startup: 7, active: f.dur, rec: 14, dmg: f.dmg * pw, hits: f.hits, rehit: Math.max(5, Math.floor(f.dur / f.hits)), hb: HB[f.pose] || [0, -120, 80, 110], type: f.type || "mid", hs: 20, bs: 14, kb: f.knock ? 6 : 4, knock: f.knock, dash: f.vx, shake: 4, special: true, sfx: "dash", low: f.pose === "slide" || f.pose === "roll" };
  const r = sp.rise;
  M.rise = { id: "rise", pose: r.pose, startup: 3, active: 18, rec: 12, untilLand: true, inv: [1, 9], dmg: r.dmg * pw / r.hits, hits: r.hits, rehit: 6, hb: [-4, -175, 74, 150], type: "mid", hs: 24, bs: 14, kb: 4, knock: true, riseVy: r.vy, riseVx: r.vx, shake: 5, special: true, sfx: "rise" };
  if (su.type === "proj") M.super = { id: "super", pose: "throw", startup: 10, active: 1, rec: 30, spawn: true, isSuper: true, special: true };
  else M.super = { id: "super", pose: su.pose, startup: 6, active: su.dur, rec: 18, dmg: su.dmg * pw, hits: su.hits, rehit: Math.floor(su.dur / su.hits), hb: HB[su.pose] || HB.rush, type: "mid", hs: 22, bs: 12, kb: 3, knockLast: true, dash: su.vx, shake: 6, isSuper: true, special: true, sfx: "dash", inv: [0, 12], low: su.pose === "roll" };
  for (const k in M) { const m = M[k]; m.activeEnd = m.startup + m.active; m.total = m.activeEnd + m.rec; }
  return M;
}

// ---------------------------------------------------------------- fighters
function makeFighter(def, side, alt) {
  return {
    def, side, alt, moves: buildMoves(def), x: side ? 660 : 300, y: GROUND, floorY: GROUND, vx: 0, vy: 0, push: 0, face: side ? -1 : 1,
    hp: def.hp, hpShow: def.hp, hpLag: 0, meter: 0, state: "idle", st: 0, move: null, moveT: 0, phase: "", hitN: 0, lastHitT: -99, connected: false,
    pose: null, mood: "normal", flash: 0, grounded: true, crouching: false, invT: 0, walkT: 0, combo: 0, comboShow: 0,
    buf: { L: 0, H: 0, S: 0, X: 0 }, prev: {}, in: {}, airAct: false, proj: null, moveSerial: 0, jumpSerial: 0, ai: { t: 0, plan: null },
    portrait: null,
  };
}
const FREE = new Set(["idle", "walk", "crouch"]);
function startMove(f, m) {
  f.state = "attack"; f.move = m; f.moveT = 0; f.phase = "start"; f.hitN = 0; f.lastHitT = -99; f.connected = false; f.moveSerial++;
  if (!m.air && f.grounded) f.vx = 0;
  f.crouching = !!m.crouch;
}
function startSuper(f) {
  f.meter = 0; startMove(f, f.moves.super);
  superFreeze = 50; superBy = f; SFX.super();
  showBanner(f.def.super.name, "SUPER MOVE!", 70, "#ffd23f");
}
function hurtbox(f) {
  const k = f.def.scale, w = 56 * k;
  let h = f.crouching ? 95 * k : 150 * k;
  if (f.state === "attack" && f.move.low && f.phase !== "start") h = 80 * k;
  if (f.state === "down" || (f.state === "ko" && f.grounded)) return null;
  return { x: f.x - w / 2, y: f.y - h, w, h };
}
function hitbox(f, m) {
  const k = f.def.scale, [hx, hy, hw, hh] = m.hb;
  const x0 = f.face > 0 ? f.x + hx * k : f.x - (hx + hw) * k;
  return { x: x0, y: f.y + hy * k, w: hw * k, h: hh * k };
}
const overlap = (a, b) => a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function updateFighter(f, o) {
  const i = f.in, p = f.prev, k = f.def.scale;
  const fighting = match.phase === "fight";
  for (const b of ["L", "H", "S", "X"]) { if (fighting && i[b] && !p[b]) f.buf[b] = 6; else if (f.buf[b] > 0) f.buf[b]--; }
  const wantSuper = f.meter >= 100 && ((f.buf.L > 0 && f.buf.H > 0) || f.buf.X > 0);
  const fwd = f.face > 0 ? i.r : i.l, back = f.face > 0 ? i.l : i.r;
  if (f.flash > 0) f.flash--;
  if (f.invT > 0) f.invT--;
  if (f.comboShow > 0) f.comboShow--;

  // face the other brawler when standing around
  if (f.grounded && (FREE.has(f.state) || f.state === "block" || f.state === "land" || f.state === "jumpsquat") && Math.abs(o.x - f.x) > 4) f.face = o.x > f.x ? 1 : -1;

  const clearBuf = () => { f.buf.L = f.buf.H = f.buf.S = f.buf.X = 0; };
  const tryActions = () => {
    if (!fighting) return false;
    if (wantSuper) { clearBuf(); startSuper(f); return true; }
    if (f.buf.S > 0) {
      f.buf.S = 0;
      if (i.d) { startMove(f, f.moves.rise); return true; }
      if (fwd) { startMove(f, f.moves.fwd); return true; }
      if (!f.proj) { startMove(f, f.moves.proj); return true; }
    }
    if (f.buf.L > 0) { f.buf.L = 0; startMove(f, i.d ? f.moves.cL : f.moves.L); return true; }
    if (f.buf.H > 0) { f.buf.H = 0; startMove(f, i.d ? f.moves.cH : f.moves.H); return true; }
    return false;
  };
  const threat = () => (o.state === "attack" && o.phase !== "rec" && Math.abs(o.x - f.x) < 300) || projs.some((q) => q.owner === o && Math.abs(q.x - f.x) < 240 && Math.sign(f.x - q.x) === q.dir);

  switch (f.state) {
    case "idle": case "walk": case "crouch": case "block": case "land": {
      if (f.state === "block" || f.state === "land") { if (--f.st > 0) { f.vx = 0; break; } }
      if (tryActions()) break;
      f.crouching = false;
      if (fighting && i.u) { f.state = "jumpsquat"; f.st = 4; f.jdir = i.r ? 1 : i.l ? -1 : 0; f.vx = 0; break; }
      if (i.d && fighting) { f.state = back && threat() ? "block" : "crouch"; f.st = 0; f.crouching = true; f.vx = 0; break; }
      if (fighting && back && threat()) { f.state = "block"; f.st = 0; f.vx = 0; break; }
      if (fighting && (i.l || i.r)) { const dir = i.r ? 1 : -1; f.vx = dir * (dir === f.face ? f.def.speed : f.def.speed * 0.75); f.state = "walk"; f.walkT++; break; }
      f.state = "idle"; f.vx = 0; break;
    }
    case "jumpsquat":
      if (--f.st <= 0) { f.vy = -f.def.jump; f.vx = f.jdir * f.def.speed * 1.3; f.grounded = false; f.state = "air"; f.airAct = false; f.jumpSerial++; SFX.jump(); }
      break;
    case "air":
      if (fighting && !f.airAct && f.buf.L > 0) { f.buf.L = 0; f.airAct = true; startMove(f, f.moves.jL); }
      else if (fighting && !f.airAct && f.buf.H > 0) { f.buf.H = 0; f.airAct = true; startMove(f, f.moves.jH); }
      break;
    case "hit": if (--f.st <= 0) { f.state = "idle"; f.combo = 0; } break;
    case "down": if (--f.st <= 0) { f.state = "getup"; f.st = 16; f.invT = 24; } break;
    case "getup": if (--f.st <= 0) f.state = "idle"; break;
    case "attack": {
      const m = f.move;
      f.moveT++;
      f.phase = f.moveT < m.startup ? "start" : f.moveT < m.activeEnd ? "active" : "rec";
      if (f.moveT === m.startup) {
        if (m.spawn) spawnProj(f, m.isSuper);
        if (m.riseVy) { f.vy = m.riseVy; f.vx = f.face * m.riseVx; f.grounded = false; }
        if (m.sfx) SFX[m.sfx]();
      }
      if (m.dash) { if (f.phase === "active") f.vx = f.face * m.dash; else if (f.phase === "rec" && f.grounded) f.vx *= 0.75; }
      // cancel a punch that hit into a kick / special / super (combos!)
      if (fighting && m.cancel && f.connected && f.moveT > m.startup) {
        if (wantSuper) { clearBuf(); startSuper(f); break; }
        if (f.buf.S > 0 || f.buf.H > 0) { f.state = "idle"; if (!tryActions()) { f.state = "attack"; } else break; }
      }
      if (fighting && (m.id === "L" || m.id === "cL") && f.moveT <= 4 && wantSuper) { clearBuf(); startSuper(f); break; }
      if (m.untilLand) { if (f.moveT >= m.activeEnd && f.grounded) { f.state = "land"; f.st = m.rec; f.vx = 0; } }
      else if (f.moveT >= m.total) { f.state = f.grounded ? "idle" : "air"; f.move = null; f.crouching = !!(f.grounded && i.d); }
      break;
    }
  }
  f.prev = { ...i };

  // physics
  if (!f.grounded) {
    f.vy += f.state === "fall" || f.state === "ko" ? 0.7 : 0.8;
    f.y += f.vy; f.x += f.vx;
    if (f.y >= GROUND && f.vy > 0) {
      f.y = GROUND; f.vy = 0; f.grounded = true;
      if (f.state === "fall") { f.state = "down"; f.st = 38; f.vx = 0; SFX.thud(); dust(f.x, GROUND, 10); shake = Math.max(shake, 4); }
      else if (f.state === "ko") { f.st = 1; f.vx = 0; SFX.thud(); dust(f.x, GROUND, 14); shake = Math.max(shake, 7); setTimeout(() => SFX.dizzy(), 200); }
      else if (f.state === "attack") { if (!f.move.untilLand) { f.state = "land"; f.st = 4; f.move = null; } }
      else { f.state = "land"; f.st = 3; SFX.land(); }
      if (f.state === "land" || f.state === "idle") f.vx = 0;
    }
  } else f.x += f.vx;
  f.x += f.push; f.push *= 0.8; if (Math.abs(f.push) < 0.05) f.push = 0;
  f.x = clamp(f.x, WALL_L, WALL_R);
  f.inv = f.invT > 0 || (f.state === "attack" && f.move.inv && f.moveT >= f.move.inv[0] && f.moveT <= f.move.inv[1]);

  // face + pose
  f.mood = f.state === "ko" ? "dizzy" : f.state === "hit" || f.state === "fall" || f.state === "down" ? "ouch" : f.state === "win" ? "happy" : f.state === "attack" ? "mad" : "normal";
  const tgt = poseFor(f, tick);
  f.pose = blendPose(f.pose, tgt, f.state === "attack" ? 0.55 : f.state === "hit" ? 0.6 : 0.3);
  if (f.hpShow > f.hp) { if (f.hpLag > 0) f.hpLag--; else f.hpShow = Math.max(f.hp, f.hpShow - f.def.hp * 0.012); }
}

// keep the two brawlers from standing inside each other
function separate(a, b) {
  if (a.state === "ko" || b.state === "ko") return;
  const minD = 28 * a.def.scale + 28 * b.def.scale, dx = b.x - a.x, dist = Math.abs(dx);
  if (dist >= minD || Math.abs(a.y - b.y) > 110 * Math.min(a.def.scale, b.def.scale)) return;
  const dir = dx === 0 ? (a.side ? -1 : 1) : Math.sign(dx), over = (minD - dist) / 2;
  a.x -= dir * over; b.x += dir * over;
  if (a.x < WALL_L) { b.x += WALL_L - a.x; a.x = WALL_L; } if (b.x < WALL_L) { a.x += WALL_L - b.x; b.x = WALL_L; }
  if (a.x > WALL_R) { b.x -= a.x - WALL_R; a.x = WALL_R; } if (b.x > WALL_R) { a.x -= b.x - WALL_R; b.x = WALL_R; }
}

// ---------------------------------------------------------------- hits
const HIT_WORDS = ["BONK!", "POW!", "WHAM!", "BOP!", "ZONK!", "KAPOW!", "BOING!", "THWACK!"];
function applyHit(a, d, m, dir, at, isProj, lastHit) {
  const i = d.in || {}, backHeld = dir > 0 ? i.r : i.l, crouchHeld = !!i.d;
  const canBlock = d.grounded && (FREE.has(d.state) || d.state === "block" || d.state === "land");
  const blocked = canBlock && backHeld && (m.type === "low" ? crouchHeld : m.type === "over" ? !crouchHeld : true);
  if (blocked) {
    d.state = "block"; d.st = m.bs || 12; d.crouching = crouchHeld; d.vx = 0;
    d.hp = Math.max(1, d.hp - (m.dmg || 0) * 0.12); d.hpLag = 30; // (chip damage can't knock you out)
    d.push = dir * (m.kb || 3) * 0.9;
    if (!isProj && (d.x <= WALL_L + 20 || d.x >= WALL_R - 20)) a.push = -dir * (m.kb || 3) * 0.7;
    gainMeter(a, 3); gainMeter(d, 5);
    blockSpark(at[0], at[1]); SFX.block(); freeze = Math.max(freeze, 4);
    return;
  }
  const inStun = d.state === "hit" || d.state === "fall";
  a.combo = inStun ? a.combo + 1 : 1;
  const scale = m.isSuper || a.state === "attack" && a.move && a.move.isSuper ? Math.max(0.65, 1 - (a.combo - 1) * 0.06) : Math.max(0.4, 1 - (a.combo - 1) * 0.12);
  const dmg = (m.dmg || 0) * scale;
  d.hp -= dmg; d.hpLag = 30; d.flash = 6;
  gainMeter(a, dmg * 0.1); gainMeter(d, dmg * 0.07);
  if (a.combo >= 2) { a.comboShow = 70; a.comboN = a.combo; }
  const big = dmg >= 70 || m.isSuper;
  if (d.hp <= 0) { knockout(a, d, dir); hitSpark(at[0], at[1], true); return; }
  if (m.knock || !d.grounded || (m.knockLast && lastHit)) {
    d.state = "fall"; d.vy = -8; d.vx = dir * 4.5; d.grounded = false; d.move = null; d.crouching = false;
  } else {
    d.state = "hit"; d.st = m.hs || 16; d.move = null; d.push = dir * (m.kb || 3);
    if (!isProj && (d.x <= WALL_L + 20 || d.x >= WALL_R - 20)) a.push = -dir * (m.kb || 3) * 0.8;
  }
  freeze = Math.max(freeze, big ? 8 : 5); shake = Math.max(shake, m.shake || (big ? 5 : 1.5));
  hitSpark(at[0], at[1], big);
  if (big) popText(at[0], at[1] - 30, pick(HIT_WORDS));
  (big || dmg >= 55 ? SFX.hitH : SFX.hitL)();
}
function gainMeter(f, n) { const was = f.meter; f.meter = Math.min(100, f.meter + n); if (was < 100 && f.meter >= 100) { SFX.meter(); popText(f.x, f.y - 190, "SUPER READY!", "#ffd23f", 26); } }
function knockout(a, d, dir) {
  d.hp = 0; d.state = "ko"; d.vy = -11; d.vx = dir * 6; d.grounded = false; d.move = null; d.crouching = false;
  match.phase = "ko"; match.phaseT = 0; match.roundWinner = a.side;
  slowmo = 60; freeze = 18; shake = 14; SFX.ko();
  showBanner("KNOCKOUT!", d.hp <= 0 && a.hp >= a.def.hp ? "PERFECT!" : "", 150, "#ff4d6d");
  for (const p of projs) p.dead = true;
}
function checkHits(a, d) {
  if (a.state !== "attack" || a.phase !== "active" || !a.move.dmg) return;
  const m = a.move;
  if (m.hits > 1 ? a.hitN >= m.hits || a.moveT - a.lastHitT < m.rehit : a.hitN > 0) return;
  if (d.inv || d.state === "ko" || d.state === "down" || d.state === "fall" || d.state === "getup") return;
  const hb = hitbox(a, m), hu = hurtbox(d);
  if (!overlap(hb, hu)) return;
  const cx = (Math.max(hb.x, hu.x) + Math.min(hb.x + hb.w, hu.x + hu.w)) / 2, cy = (Math.max(hb.y, hu.y) + Math.min(hb.y + hb.h, hu.y + hu.h)) / 2;
  const dir = m.hb[0] < 0 && Math.abs(d.x - a.x) < 20 ? a.face : Math.sign(d.x - a.x) || a.face;
  applyHit(a, d, m, dir, [cx, cy], false, m.hits > 1 && a.hitN + 1 >= m.hits);
  a.hitN++; a.lastHitT = a.moveT; a.connected = true;
}

// ---------------------------------------------------------------- projectiles
function spawnProj(f, isSuper) {
  const sp = isSuper ? f.def.super : f.def.specials.proj, k = f.def.scale;
  const p = {
    owner: f, dir: f.face, x: f.x + f.face * 46 * k, y: f.y - (sp.shape === "tornado" ? 40 : 100) * k, vx: f.face * sp.speed, vy: sp.vy || 0, g: sp.g || 0,
    size: sp.size || 1, shape: sp.shape, color: sp.color, dmg: sp.dmg * f.def.power, hits: sp.hits || 1, maxHits: sp.hits || 1, last: -99, t: 0, super: !!isSuper,
    r: (sp.shape === "laser" ? 30 : sp.shape === "tornado" ? 36 : 20) * (sp.size || 1),
  };
  if (!isSuper) f.proj = p;
  projs.push(p);
  (isSuper ? SFX.zap : SFX.throw)();
}
function projBox(p) { const r = p.r; return p.shape === "tornado" ? { x: p.x - r * 0.7, y: p.y - r * 2.1, w: r * 1.4, h: r * 2.6 } : p.shape === "laser" ? { x: p.x - (p.dir > 0 ? r * 3 : 0) - r * 0.5, y: p.y - r * 0.55, w: r * 3.5, h: r * 1.1 } : { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 }; }
function updateProjs() {
  for (const p of projs) {
    if (p.dead) continue;
    p.t++; p.x += p.vx; p.vy += p.g; p.y += p.vy;
    if (p.g && p.y >= GROUND - 10) { p.dead = true; dust(p.x, GROUND, 6); SFX.pop(); }
    if (p.x < -200 || p.x > W + 200) p.dead = true;
  }
  // projectiles bonk into each other
  for (let i = 0; i < projs.length; i++) for (let j = i + 1; j < projs.length; j++) {
    const a = projs[i], b = projs[j];
    if (a.dead || b.dead || a.owner === b.owner || !overlap(projBox(a), projBox(b))) continue;
    if (a.super && !b.super) { b.dead = true; a.hits--; } else if (b.super && !a.super) { a.dead = true; b.hits--; } else { a.dead = b.dead = true; }
    if (a.hits <= 0) a.dead = true; if (b.hits <= 0) b.dead = true;
    hitSpark((a.x + b.x) / 2, (a.y + b.y) / 2, false); SFX.pop();
  }
  for (const p of projs) {
    if (p.dead) continue;
    const d = p.owner === match.f[0] ? match.f[1] : match.f[0];
    if (d.inv || d.state === "ko" || d.state === "down" || d.state === "fall" || d.state === "getup" || p.t - p.last < 7) continue;
    const hu = hurtbox(d);
    if (!overlap(projBox(p), hu)) continue;
    const m = { dmg: p.dmg, type: "mid", hs: 18, bs: 12, kb: p.super ? 2 : 4, shake: p.super ? 5 : 2, isSuper: p.super, knockLast: p.super, hits: p.maxHits };
    applyHit(p.owner, d, m, p.dir, [p.x, Math.max(hu.y + 10, Math.min(p.y, hu.y + hu.h - 10))], true, p.hits <= 1);
    p.last = p.t; if (--p.hits <= 0) p.dead = true;
  }
  for (const p of projs) if (p.dead && p.owner.proj === p) p.owner.proj = null;
  projs = projs.filter((p) => !p.dead);
}

// ---------------------------------------------------------------- effects
function hitSpark(x, y, big) {
  fx.push({ kind: "ring", x, y, life: 14, max: 14, r: big ? 60 : 36, col: "#fff6b0" });
  const n = big ? 10 : 6;
  for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2, s = 3 + rand() * (big ? 7 : 4); fx.push({ kind: "star", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 22 + rand() * 12, max: 34, r: 5 + rand() * (big ? 8 : 4), rot: rand() * 6, col: pick(["#ffe94d", "#ffffff", "#ffb703", "#7df9ff"]) }); }
}
function blockSpark(x, y) {
  fx.push({ kind: "ring", x, y, life: 12, max: 12, r: 34, col: "#7dd3ff" });
  for (let i = 0; i < 6; i++) { const a = rand() * Math.PI * 2, s = 2 + rand() * 4; fx.push({ kind: "shard", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14, max: 14, r: 8, rot: a, col: "#bfe9ff" }); }
}
function dust(x, y, n) { for (let i = 0; i < n; i++) fx.push({ kind: "dust", x: x + (rand() - 0.5) * 40, y, vx: (rand() - 0.5) * 4, vy: -rand() * 2, life: 26, max: 26, r: 8 + rand() * 10, col: "rgba(230,220,210,0.6)" }); }
function popText(x, y, txt, col = "#ffe94d", size = 34) { texts.push({ x: clamp(x, 90, W - 90), y, txt, col, size, life: 50, max: 50, rot: (rand() - 0.5) * 0.4 }); }
function showBanner(text, sub, life, col) { banner = { text, sub, life, max: life, col: col || "#fff" }; }
function updateFx() {
  for (const p of fx) { p.life--; if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; if (p.kind === "star") p.vy += 0.25; if (p.kind === "dust") { p.vx *= 0.92; p.r += 0.4; } p.rot = (p.rot || 0) + 0.2; } }
  fx = fx.filter((p) => p.life > 0);
  for (const t of texts) { t.life--; t.y -= 0.6; }
  texts = texts.filter((t) => t.life > 0);
  if (banner && --banner.life <= 0) banner = null;
}
function star(g, x, y, r, rot, col) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.restore();
}

// ---------------------------------------------------------------- the computer player
const DIFF = {
  easy: { react: 14, think: 26, block: 0.15, aa: 0.1, special: 0.3, combo: 0, idle: 0.38, super: 0.25, jumpDodge: 0.05 },
  normal: { react: 7, think: 13, block: 0.45, aa: 0.4, special: 0.45, combo: 0.4, idle: 0.12, super: 0.6, jumpDodge: 0.3 },
  hard: { react: 3, think: 7, block: 0.8, aa: 0.75, special: 0.55, combo: 0.85, idle: 0.02, super: 0.9, jumpDodge: 0.5 },
};
function aiInput(f, o) {
  const A = f.ai, D = DIFF[diff] || DIFF.normal, out = { l: 0, r: 0, u: 0, d: 0, L: 0, H: 0, S: 0, X: 0 };
  if (match.phase !== "fight") return out;
  const dx = o.x - f.x, dist = Math.abs(dx), toward = dx > 0 ? "r" : "l", away = dx > 0 ? "l" : "r";
  // follow up a punch that hit with a kick or a special (combo)
  if (f.state === "attack" && f.connected && f.move.cancel && A.comboFor !== f.moveSerial) {
    A.comboFor = f.moveSerial;
    if (rand() < D.combo) { A.pulse = rand() < 0.5 ? "H" : "S"; A.pulseDir = A.pulse === "S" && rand() < 0.5 ? "fwd" : ""; A.wait = 2; }
  }
  if (A.pulse) { if (A.wait-- > 0) return out; out[A.pulse] = 1; if (A.pulseDir === "fwd") out[toward] = 1; if (A.pulseDir === "d") out.d = 1; A.pulse = null; return out; }
  // block attacks
  if (o.state === "attack" && o.move.dmg && o.phase !== "rec" && dist < 280) {
    if (A.blockFor !== o.moveSerial) { A.blockFor = o.moveSerial; A.willBlock = rand() < D.block; }
    if (A.willBlock && o.moveT >= Math.min(o.move.startup - 1, D.react * 0.5)) { out[away] = 1; if (o.move.type === "low") out.d = 1; return out; }
  }
  // dodge or block projectiles
  for (const p of projs) {
    if (p.owner !== o || Math.sign(f.x - p.x) !== p.dir || Math.abs(p.x - f.x) > 240) continue;
    if (A.projFor !== p) { A.projFor = p; const r = rand(); A.projAct = r < D.jumpDodge ? "jump" : r < D.block + D.jumpDodge * 0.5 ? "block" : "none"; }
    if (A.projAct === "block") { out[away] = 1; return out; }
    if (A.projAct === "jump" && Math.abs(p.x - f.x) < 170 && f.grounded) { out.u = 1; out[toward] = 1; return out; }
  }
  // knock jumping-in brawlers out of the air
  if (!o.grounded && (o.state === "air" || (o.state === "attack" && o.move.air)) && dist < 190 && o.y > GROUND - 190) {
    if (A.aaFor !== o.jumpSerial) { A.aaFor = o.jumpSerial; A.aa = rand() < D.aa; }
    if (A.aa && FREE.has(f.state)) { A.aa = false; out.d = 1; out.S = 1; return out; }
  }
  if (--A.t <= 0 || !A.plan) { A.t = D.think + rand() * D.think; A.plan = choosePlan(f, o, D, dist); A.pressed = false; }
  const pl = A.plan;
  if (pl.hold === "fwd") out[toward] = 1;
  if (pl.hold === "back") out[away] = 1;
  if (pl.d) out.d = 1;
  if (pl.btn && !A.pressed) { out[pl.btn] = 1; if (pl.btn === "X") { out.L = out.H = 1; } if (pl.dir === "fwd") out[toward] = 1; if (pl.dir === "d") out.d = 1; A.pressed = true; }
  if (pl.jump && !A.pressed) { out.u = 1; out[toward] = 1; A.pressed = true; }
  return out;
}
function choosePlan(f, o, D, dist) {
  const r = rand();
  if (f.meter >= 100 && dist < 340 && rand() < D.super * 0.35) return { btn: "X" };
  if (rand() < D.idle) return {};
  if (o.state === "down" || o.state === "getup") return rand() < 0.5 ? { hold: "fwd" } : {};
  if (dist > 330) {
    if (r < D.special * 0.6 && !f.proj) return { btn: "S" };
    if (r < D.special * 0.6 + 0.12) return { jump: true };
    return { hold: "fwd" };
  }
  if (dist > 135) {
    if (r < 0.18) return { btn: "S", dir: "fwd" };
    if (r < 0.3) return { jump: true };
    if (r < 0.42 && !f.proj) return { btn: "S" };
    if (r < 0.5) return { hold: "back" };
    return { hold: "fwd" };
  }
  if (r < 0.28) return { btn: "L", d: rand() < 0.3 };
  if (r < 0.52) return { btn: "H" };
  if (r < 0.66) return { btn: "H", d: true, dir: "d" };
  if (r < 0.74) return { btn: "S", dir: "d", d: true };
  if (r < 0.86) return { hold: "back" };
  if (r < 0.93) return { btn: "S", dir: "fwd" };
  return { hold: "back", jump: false };
}

// ---------------------------------------------------------------- match + rounds
function newMatch() {
  const d0 = ROSTER.find((r) => r.id === picks[0]), d1 = ROSTER.find((r) => r.id === picks[1]);
  match = { defs: [d0, d1], wins: [0, 0], round: 1, stage: Math.floor(rand() * STAGES.length), cpu: vs === "cpu" };
  for (const s of [0, 1]) { const c = document.createElement("canvas"); c.width = c.height = 72; drawPortrait(c, s ? d1 : d0, s === 1 && d0 === d1); match["por" + s] = c; }
  startRound();
}
function startRound() {
  const m = match;
  m.f = [makeFighter(m.defs[0], 0, false), makeFighter(m.defs[1], 1, m.defs[0] === m.defs[1])];
  for (const f of m.f) f.pose = blendPose(null, poseFor(f, 0));
  m.time = ROUND_TIME * 60; m.phase = "intro"; m.phaseT = 0; m.roundWinner = -1;
  projs = []; fx = []; texts = []; banner = null; freeze = slowmo = superFreeze = 0; shake = 0;
}
function endRound() {
  const m = match, w = m.roundWinner;
  if (w >= 0) m.wins[w]++;
  if (m.wins[0] >= 2 || m.wins[1] >= 2 || m.round >= 5) { matchOver(); return; }
  m.round++; startRound();
}
function matchOver() {
  const m = match, w = m.wins[0] === m.wins[1] ? -1 : m.wins[0] > m.wins[1] ? 0 : 1;
  const name = w < 0 ? "" : m.defs[w].name;
  $("overTitle").textContent = w < 0 ? "IT'S A TIE!" : name + " WINS!";
  $("overSub").textContent = w < 0 ? "Nobody got bonked enough. Go again!" : vs === "cpu" ? (w === 0 ? "You beat the computer on " + diff.toUpperCase() + "! " + (diff === "hard" ? "You're a BONK MASTER! 🏆" : "Try a harder level next!") : "The computer got you this time. Rematch!") : (w === 0 ? "Player 1" : "Player 2") + " is the champ!";
  if (vs === "cpu" && w === 0) { const won = store.get("wins", {}); won[diff] = (won[diff] || 0) + 1; store.set("wins", won); }
  const oc = $("overPic"); drawPortrait(oc, m.defs[Math.max(0, w)], w === 1 && m.defs[0] === m.defs[1]);
  oc.style.visibility = w < 0 ? "hidden" : "visible";
  setMode("over");
}

function stepFight() {
  const m = match, [a, b] = m.f;
  tick++;
  updateFx();
  if (shake > 0) shake = shake < 0.3 ? 0 : shake * 0.86;
  if (superFreeze > 0) { superFreeze--; return; }
  if (freeze > 0) { freeze--; return; }
  if (slowmo > 0) { slowmo--; if (slowmo % 2) return; }
  m.phaseT++;
  if (m.phase === "intro") {
    if (m.phaseT === 10) { const last = m.wins[0] === 1 && m.wins[1] === 1; showBanner(last ? "FINAL ROUND" : "ROUND " + m.round, STAGES[m.stage].name, 60, "#ffffff"); SFX.ready(); }
    if (m.phaseT === 75) { showBanner("BRAWL!", "", 40, "#ffd23f"); SFX.fight(); }
    if (m.phaseT >= 80) { m.phase = "fight"; m.phaseT = 0; }
  } else if (m.phase === "fight") {
    if (--m.time <= 0) {
      m.time = 0; m.phase = "timeup"; m.phaseT = 0; SFX.bell();
      const pa = a.hp / a.def.hp, pb = b.hp / b.def.hp;
      m.roundWinner = Math.abs(pa - pb) < 0.001 ? -1 : pa > pb ? 0 : 1;
      showBanner("TIME!", m.roundWinner < 0 ? "DRAW" : "", 90, "#7df9ff");
    } else if (m.time % 60 === 0 && m.time <= 600) SFX.tick();
  } else if (m.phase === "ko" || m.phase === "timeup") {
    const w = m.roundWinner;
    const at = m.phase === "ko" ? 110 : 80;
    if (m.phaseT === at && w >= 0) { SFX.win(); SFX.cheer(); popText(m.f[w].x, m.f[w].y - 200, m.f[w].def.name.split(" ")[0] + " WINS!", "#ffd23f", 30); }
    if (m.phaseT >= at) for (const s of [0, 1]) { // (once they're standing on the floor: the winner cheers, the other one is sad)
      const f = m.f[s];
      if (f.state === "win" || f.state === "sad" || f.state === "ko" || f.state === "fall" || !f.grounded) continue;
      if (f.state === "down" || f.state === "getup" || f.state === "attack" || f.state === "hit") continue;
      f.state = s === w ? "win" : "sad"; f.move = null; f.vx = 0; f.push = 0;
    }
    if (m.phaseT >= 220) { endRound(); return; }
  }
  // inputs
  for (const s of [0, 1]) {
    const f = m.f[s], o = m.f[1 - s];
    f.in = s === 1 && vs === "cpu" ? aiInput(f, o) : readInput(s);
    if (m.phase !== "fight") { f.in = { l: 0, r: 0, u: 0, d: 0, L: 0, H: 0, S: 0, X: 0 }; }
    if ((m.phase === "ko" || m.phase === "timeup") && (f.state === "win" || f.state === "sad")) { tickPose(f); continue; }
    updateFighter(f, o);
  }
  separate(a, b);
  if (usedTouch) $("tX").classList.toggle("ready", a.meter >= 100);
  checkHits(a, b); checkHits(b, a);
  updateProjs();
}
function tickPose(f) { f.mood = f.state === "win" ? "happy" : "normal"; f.pose = blendPose(f.pose, poseFor(f, tick), 0.25); if (f.hpShow > f.hp) f.hpShow = Math.max(f.hp, f.hpShow - f.def.hp * 0.012); }

// ---------------------------------------------------------------- drawing
function render() {
  try { drawFrame(); } catch (e) { renderBroke = true; throw e; } finally { while (saves > 0) { ctx.restore(); saves--; } }
}
let saves = 0, renderBroke = false;
function drawFrame() {
  if (renderBroke && ctx.reset) { ctx.reset(); renderBroke = false; } // (a drawing error last frame: start fresh)
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0b0612"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!match) { drawIdleBg(); return; }
  const m = match;
  ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
  ctx.save(); saves++;
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const sx = shake ? (rand() - 0.5) * shake * 2 : 0, sy = shake ? (rand() - 0.5) * shake * 2 : 0;
  ctx.translate(sx, sy);
  ctx.drawImage(stageCanvas(m.stage), -12, -12, W + 24, H + 24);
  if (superFreeze > 0 && superBy) { // the screen goes dark and the super brawler glows
    ctx.fillStyle = "rgba(10,0,30,0.55)"; ctx.fillRect(-20, -20, W + 40, H + 40);
    const g = ctx.createRadialGradient(superBy.x, superBy.y - 80, 10, superBy.x, superBy.y - 80, 200);
    g.addColorStop(0, "rgba(255,230,120,0.65)"); g.addColorStop(1, "rgba(255,230,120,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + tick * 0.05; ctx.strokeStyle = "rgba(255,240,170,0.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(superBy.x + Math.cos(a) * 70, superBy.y - 80 + Math.sin(a) * 70); ctx.lineTo(superBy.x + Math.cos(a) * 160, superBy.y - 80 + Math.sin(a) * 160); ctx.stroke(); }
  }
  // brawlers (the attacker is drawn in front)
  const order = m.f.slice().sort((p, q) => (p.state === "attack" ? 1 : 0) - (q.state === "attack" ? 1 : 0));
  for (const f of order) {
    if (f.state === "attack" && f.move.dash && f.phase === "active") { // speed ghosts
      for (let g = 2; g >= 1; g--) { ctx.globalAlpha = 0.18 * g; drawFighter(ctx, { ...f, x: f.x - f.face * g * 22, noShadow: true, flash: 0 }, tick); }
      ctx.globalAlpha = 1;
    }
    if (f.invT > 0 && f.state === "getup" && (tick >> 1) % 2) ctx.globalAlpha = 0.55;
    drawFighter(ctx, f, tick); ctx.globalAlpha = 1;
    if (f.state === "ko" && f.grounded) { // dizzy stars spinning over the knocked-out brawler's head
      const hx = f.x - f.face * 78 * f.def.scale, hy = f.y - 46;
      for (let i = 0; i < 4; i++) { const a = tick * 0.1 + i * Math.PI / 2; star(ctx, hx + Math.cos(a) * 34, hy + Math.sin(a) * 10 - 10, 9, tick * 0.15, i % 2 ? "#ffe94d" : "#fff6b0"); }
    }
    if (f.state === "hit" || f.state === "fall") { const k = f.def.scale; for (let i = 0; i < 2; i++) { const a = tick * 0.25 + i * Math.PI; star(ctx, f.x + Math.cos(a) * 24, f.y - 175 * k + Math.sin(a) * 6, 6, tick * 0.2, "#ffe94d"); } }
  }
  for (const p of projs) drawProj(ctx, p, tick);
  for (const p of fx) {
    const a = p.life / p.max;
    if (p.kind === "ring") { ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = 6 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - a * 0.7), 0, 7); ctx.stroke(); }
    else if (p.kind === "star") { ctx.globalAlpha = Math.min(1, a * 1.5); star(ctx, p.x, p.y, p.r, p.rot, p.col); }
    else if (p.kind === "shard") { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke(); }
    else if (p.kind === "dust") { ctx.globalAlpha = a * 0.8; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y - p.r * 0.4, p.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const t of texts) comicText(t.txt, t.x, t.y, t.size * (t.life > t.max - 6 ? 1 + (t.life - t.max + 6) * 0.08 : 1), t.col, t.rot, Math.min(1, t.life / 15));
  ctx.restore(); saves--;
  drawHud();
  if (banner) {
    const age = banner.max - banner.life, sc = age < 8 ? 0.4 + age * 0.08 + (age > 5 ? 0.05 : 0) : 1, al = Math.min(1, banner.life / 12);
    comicText(banner.text, W / 2, H * 0.42, 78 * sc, banner.col, 0, al);
    if (banner.sub) comicText(banner.sub, W / 2, H * 0.42 + 58, 28, "#ffffff", 0, al);
  }
}
function comicText(txt, x, y, size, col, rot, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.font = `${Math.round(size)}px "Russo One", Impact, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = Math.max(4, size * 0.16); ctx.strokeStyle = "#1a0b2e"; ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore();
}
function drawHud() {
  const m = match;
  ctx.save();
  for (const s of [0, 1]) {
    const f = m.f[s], x0 = s ? 520 : 70, bw = 370, y0 = 26, bh = 24, pct = Math.max(0, f.hp / f.def.hp), lag = Math.max(0, f.hpShow / f.def.hp);
    // bar frame
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(x0 - 4, y0 - 4, bw + 8, bh + 8, 8); ctx.fill();
    ctx.fillStyle = "#3a2550"; roundRect(x0, y0, bw, bh, 5); ctx.fill();
    const fill = (p, col) => { const w = bw * p; ctx.fillStyle = col; if (s === 0) roundRect(x0 + bw - w, y0, w, bh, 5); else roundRect(x0, y0, w, bh, 5); ctx.fill(); };
    if (lag > pct) fill(lag, "#ffffff");
    const g = ctx.createLinearGradient(0, y0, 0, y0 + bh); const c1 = pct > 0.3 ? "#ffe25a" : "#ff8a3d", c2 = pct > 0.3 ? "#ffb703" : "#ff5d3d";
    g.addColorStop(0, c1); g.addColorStop(1, c2); fill(pct, g);
    ctx.fillStyle = "rgba(255,255,255,0.35)"; if (s === 0) ctx.fillRect(x0 + bw - bw * pct + 3, y0 + 3, Math.max(0, bw * pct - 6), 5); else ctx.fillRect(x0 + 3, y0 + 3, Math.max(0, bw * pct - 6), 5);
    // portrait + name + round stars
    const py = y0 + 42, pcx = s ? W - 36 : 36;
    ctx.save(); ctx.beginPath(); ctx.arc(pcx, 40, 28, 0, 7); ctx.fillStyle = "#1a0b2e"; ctx.fill(); ctx.strokeStyle = s ? "#7df9ff" : "#ffd23f"; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
    if (s) { ctx.translate(pcx * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(m["por" + s], pcx - 30, 10, 60, 60); ctx.restore();
    ctx.font = "18px 'Russo One', sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = s ? "right" : "left";
    const nx = s ? x0 + bw : x0, label = (vs === "cpu" ? (s ? "CPU " : "YOU ") : "P" + (s + 1) + " ") + "· " + f.def.name;
    ctx.lineWidth = 4; ctx.strokeStyle = "#1a0b2e"; ctx.strokeText(label, nx, py + 2); ctx.fillStyle = "#fff"; ctx.fillText(label, nx, py + 2);
    for (let i = 0; i < 2; i++) { const sx2 = s ? x0 + bw - 12 - i * 26 : x0 + 12 + i * 26; star(ctx, sx2, py + 26, 11, 0, m.wins[s] > i ? "#ffd23f" : "rgba(255,255,255,0.25)"); }
    // super meter
    const mx = s ? W - 40 - 220 : 40, my = H - 30, full = f.meter >= 100;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(mx - 3, my - 3, 226, 18, 7); ctx.fill();
    ctx.fillStyle = full ? ((tick >> 3) % 2 ? "#7df9ff" : "#ffd23f") : "#4fc3ff"; const mw = 220 * f.meter / 100;
    if (s === 0) roundRect(mx, my, mw, 12, 5); else roundRect(mx + 220 - mw, my, mw, 12, 5); ctx.fill();
    ctx.font = "13px 'Russo One', sans-serif"; ctx.textAlign = s ? "right" : "left"; ctx.fillStyle = full ? "#ffd23f" : "rgba(255,255,255,0.8)";
    ctx.strokeStyle = "#1a0b2e"; ctx.lineWidth = 3; const st = full ? "SUPER READY!  PUNCH + KICK" : "SUPER";
    ctx.strokeText(st, s ? W - 40 : 40, my - 12); ctx.fillText(st, s ? W - 40 : 40, my - 12);
    if (f.comboShow > 0 && f.comboN >= 2) comicText(f.comboN + " HITS!", s ? W - 140 : 140, 170, 34, "#7df9ff", s ? 0.1 : -0.1, Math.min(1, f.comboShow / 15));
  }
  // timer
  ctx.fillStyle = "#1a0b2e"; ctx.beginPath(); ctx.arc(W / 2, 38, 32, 0, 7); ctx.fill(); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.stroke();
  const secs = Math.ceil(match.time / 60);
  ctx.font = "30px 'Russo One', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = secs <= 10 && (tick >> 4) % 2 ? "#ff6b6b" : "#fff"; ctx.fillText(secs, W / 2, 40);
  ctx.restore();
}
function roundRect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); if (w <= 0) { ctx.beginPath(); return; } ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
let menuDemo = null;
function drawIdleBg() { // behind the menus: the rooftop with two brawlers bouncing
  ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
  ctx.drawImage(stageCanvas(0), 0, 0);
  if (!menuDemo) menuDemo = [0, 1].map((s) => ({ def: ROSTER[s ? 3 : 0], x: s ? 620 : 340, y: GROUND, floorY: GROUND, face: s ? -1 : 1, pose: null, mood: "normal", state: "idle", walkT: 0 }));
  for (const f of menuDemo) { f.pose = blendPose(f.pose, poseFor(f, tick), 0.3); drawFighter(ctx, f, tick); }
  tick++;
}

// ---------------------------------------------------------------- thumbnail (?thumb): a posed action shot for the game card
function thumbScene() {
  mode = "thumb";
  for (const id of ["menu", "select", "hud", "touch"]) $(id).classList.add("hidden");
  picks = [Q.get("p1") || "rex", Q.get("p2") || "penny"]; newMatch(); match.stage = +(Q.get("stage") || 0); match.phase = "fight";
  const [a, b] = match.f; a.x = 420; b.x = 545;
  startMove(a, a.moves.H); a.moveT = 10; a.phase = "active"; b.state = "hit"; b.st = 99; b.mood = "ouch";
  a.meter = 100; b.hp = b.def.hp * 0.45; b.hpShow = b.def.hp * 0.6; a.hp = a.def.hp * 0.8; a.hpShow = a.hp;
  for (let i = 0; i < 12; i++) { a.pose = blendPose(a.pose, poseFor(a, i), 1); b.pose = blendPose(b.pose, poseFor(b, i), 1); a.mood = "mad"; b.mood = "ouch"; }
  hitSpark(530, 352, true); for (const p of fx) { p.life = p.max * 0.75; for (let j = 0; j < 4; j++) { p.x += p.vx || 0; p.y += p.vy || 0; } }
  texts = [{ x: 655, y: 330, txt: "BONK!", col: "#ffe94d", size: 46, life: 40, max: 50, rot: 0.15 }];
  match.time = 60 * 47;
  const draw = () => {
    render();
    ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
    comicText("BONK", W / 2 - 4, 140, 92, "#ffd23f", -0.05, 1); comicText("BRAWLERS", W / 2 + 6, 220, 70, "#7df9ff", -0.05, 1);
  };
  document.fonts.ready.then(draw); setTimeout(draw, 600);
}

// ---------------------------------------------------------------- menus
function setMode(m) {
  mode = m;
  $("menu").classList.toggle("hidden", m !== "menu");
  $("select").classList.toggle("hidden", m !== "select");
  $("pause").classList.toggle("hidden", m !== "pause");
  $("over").classList.toggle("hidden", m !== "over");
  $("hud").classList.toggle("hidden", m !== "fight");
  document.body.classList.toggle("fighting", m === "fight" || m === "pause");
  if (m === "menu") match = null;
  showTouch();
  if (m === "fight") canvas.focus();
  for (const k in touchIn) touchIn[k] = 0;
}
function renderControls() {
  const el = $("controls");
  el.innerHTML = usedTouch && !matchMedia("(pointer: fine)").matches
    ? "<b>Touch:</b> slide the pad to move (up = jump, down = crouch). Hold <b>away</b> to block. <b>PUNCH</b>, <b>KICK</b>, <b>SPECIAL</b> (try it with → or ↓ held). Fill your bar, then press <b>SUPER</b>!"
    : "<b>1 player:</b> move <kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> · jump <kbd>W</kbd>/<kbd>↑</kbd> · crouch <kbd>S</kbd>/<kbd>↓</kbd> · punch <kbd>F</kbd>/<kbd>J</kbd> · kick <kbd>G</kbd>/<kbd>K</kbd> · special <kbd>H</kbd>/<kbd>L</kbd><br>" +
      "<b>2 players:</b> P1 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>F</kbd><kbd>G</kbd><kbd>H</kbd> · P2 arrows + <kbd>,</kbd><kbd>.</kbd><kbd>/</kbd> (or numpad <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>)<br>" +
      "<b>Block:</b> hold away from the other brawler (crouch to block sweeps). <b>Specials:</b> SPECIAL, → + SPECIAL, ↓ + SPECIAL. <b>Super:</b> fill your bar, then PUNCH + KICK together! Pause <kbd>Esc</kbd>, sound <kbd>M</kbd>. Gamepads work too.";
}
function refreshDiff() { for (const b of document.querySelectorAll("#diff button")) b.classList.toggle("on", b.dataset.d === diff); }
for (const b of document.querySelectorAll("#diff button")) b.onclick = () => { diff = b.dataset.d; store.set("diff", diff); refreshDiff(); SFX.click(); };
$("b1p").onclick = () => { audio(); vs = "cpu"; openSelect(); };
$("b2p").onclick = () => { audio(); vs = "2p"; openSelect(); };

// character select
const cards = [];
(function buildGrid() {
  const grid = $("grid");
  ROSTER.forEach((d, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "card"; b.style.setProperty("--c", d.look.shirt === "#ffffff" ? "#e63946" : d.look.shirt);
    const c = document.createElement("canvas"); c.width = c.height = 120; drawPortrait(c, d);
    b.append(c); const n = document.createElement("b"); n.textContent = d.name; b.append(n);
    const tags = document.createElement("i"); b.append(tags);
    b.onclick = () => { audio(); b.blur(); if (picking > 1) return; cursor[picking] = i; choose(i); };
    b.onmouseenter = () => { if (picking < 2) { cursor[picking] = i; refreshSelect(); } };
    grid.append(b); cards.push(b);
  });
})();
function openSelect() { match = null; picks = [null, null]; picking = 0; cursor = [0, ROSTER.length - 1]; setMode("select"); refreshSelect(); }
function choose(i) {
  if (picking > 1) return;
  picks[picking] = ROSTER[i].id; SFX.pick();
  picking++; if (picking === 1) cursor[1] = cursor[1] === i ? (i + 1) % ROSTER.length : cursor[1];
  refreshSelect();
}
function refreshSelect() {
  $("selTitle").textContent = picking === 0 ? (vs === "cpu" ? "Pick YOUR brawler!" : "Player 1, pick your brawler!") : picking === 1 ? (vs === "cpu" ? "Now pick who the computer plays!" : "Player 2, pick your brawler!") : "Ready to brawl?";
  cards.forEach((c, i) => {
    const t = c.querySelector("i"); let s = "";
    if (picks[0] === ROSTER[i].id) s += "<em class='p1'>" + (vs === "cpu" ? "YOU" : "P1") + "</em>";
    if (picks[1] === ROSTER[i].id) s += "<em class='p2'>" + (vs === "cpu" ? "CPU" : "P2") + "</em>";
    t.innerHTML = s; c.classList.toggle("cur", picking < 2 && cursor[picking] === i); c.classList.toggle("cur2", picking === 1);
  });
  for (const s of [0, 1]) {
    const id = picks[s] || (picking === s ? ROSTER[cursor[s]].id : null), d = ROSTER.find((r) => r.id === id), el = $("info" + s);
    if (!d) { el.innerHTML = "<div class='who'>" + (vs === "cpu" ? (s ? "CPU" : "YOU") : "P" + (s + 1)) + "</div><p class='wait'>?</p>"; continue; }
    el.innerHTML = "<div class='who'>" + (vs === "cpu" ? (s ? "CPU" : "YOU") : "P" + (s + 1)) + (picks[s] ? " ✔" : "") + "</div><canvas width='160' height='160'></canvas><h3>" + d.name + "</h3><p class='tag'>" + d.tag + "</p>" +
      "<ul><li><kbd>SPECIAL</kbd> " + d.specials.proj.name + "</li><li><kbd>→ + SPECIAL</kbd> " + d.specials.fwd.name + "</li><li><kbd>↓ + SPECIAL</kbd> " + d.specials.rise.name + "</li><li class='sup'><kbd>PUNCH + KICK</kbd> " + d.super.name + " <small>(full bar)</small></li></ul>" +
      "<div class='stats'>" + statBar("Power", (d.power - 0.85) / 0.45) + statBar("Speed", (d.speed - 2.4) / 1.7) + statBar("Health", (d.hp - 900) / 320) + "</div>";
    drawPortrait(el.querySelector("canvas"), d, s === 1 && picks[0] === d.id);
    el.onclick = () => { if (picks[s]) { picks[s] = null; if (s === 0) picks[1] = null; picking = s; SFX.click(); refreshSelect(); } };
  }
  $("selGo").disabled = picking < 2;
  $("selRandom").textContent = picking < 2 ? "🎲 Random" : "🎲 Re-roll CPU";
  $("selRandom").classList.toggle("hidden", picking >= 2 && vs !== "cpu");
  $("selHint").textContent = picking < 2 ? "Click a brawler, or use the arrow keys / WASD and press Enter. Click a picked brawler's card on the side to change it." : "Press FIGHT or Enter!";
}
function statBar(n, v) { return "<span>" + n + "<i><b style='width:" + Math.round(clamp(v, 0.1, 1) * 100) + "%'></b></i></span>"; }
function selectKey(code) {
  const cols = 3, s = Math.min(picking, 1);
  const mv = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1, KeyW: -cols, ArrowUp: -cols, KeyS: cols, ArrowDown: cols }[code];
  if (mv && picking < 2) { cursor[s] = (cursor[s] + mv + ROSTER.length) % ROSTER.length; SFX.click(); refreshSelect(); return true; }
  if (["Enter", "Space", "KeyF", "KeyJ", "Comma", "NumpadEnter"].includes(code)) { if (picking < 2) choose(cursor[s]); else go(); return true; }
  if (code === "Escape" || code === "Backspace") { if (picking > 0) { picking--; picks[picking] = null; refreshSelect(); } else setMode("menu"); return true; }
  return false;
}
function go() { if (picking < 2) return; SFX.fight(); newMatch(); setMode("fight"); }
$("selGo").onclick = go;
$("selBack").onclick = () => { SFX.click(); setMode("menu"); };
$("selRandom").onclick = () => { audio(); if (picking >= 2) { picking = 1; picks[1] = null; } const i = Math.floor(rand() * ROSTER.length); cursor[picking] = i; choose(i); };
$("resume").onclick = () => setMode("fight");
$("restart").onclick = () => { newMatch(); setMode("fight"); };
$("pSelect").onclick = () => openSelect();
$("pMenu").onclick = () => setMode("menu");
$("again").onclick = () => { newMatch(); setMode("fight"); };
$("oSelect").onclick = () => openSelect();
$("oMenu").onclick = () => setMode("menu");
$("bPause").onclick = () => { if (mode === "fight") setMode("pause"); };
$("bMute").onclick = toggleMute; $("mMute").onclick = toggleMute;
function toggleMute() { setMuted(!isMuted()); store.set("muted", isMuted()); refreshMute(); audio(); }
function refreshMute() { $("bMute").textContent = isMuted() ? "🔇" : "🔊"; $("mMute").textContent = isMuted() ? "🔇 Sound off" : "🔊 Sound on"; }

// ---------------------------------------------------------------- main loop (60 steps a second)
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(100, now - last); last = now;
  const STEP = 1000 / 60;
  while (acc >= STEP) { acc -= STEP; if (mode === "fight" && match) stepFight(); }
  if (mode !== "thumb") render();
}
refreshDiff(); refreshMute(); renderControls();
window.__bonk = { get match() { return match; }, get mode() { return mode; }, keys, step(n = 1) { for (let i = 0; i < n && mode === "fight"; i++) stepFight(); render(); } }; // (for testing in the console)
if (Q.has("thumb")) thumbScene(); else setMode("menu");
requestAnimationFrame(frame);
