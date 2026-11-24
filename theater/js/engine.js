// MOVIE THEATER: the cartoon movie engine. A movie is a list of timed events (who moves where, who punches who,
// explosions, camera moves, lines of talk, title cards) played on a 1280 x 720 canvas: cartoon fighters with
// posable arms + legs, faces that change, weapons, backgrounds that scroll, sparks, "POW!" bursts, speed lines,
// slow motion and screen shake. films.js writes the movies with the Script helpers at the bottom.
import { sfx as sfx0, say as say0, hush, playMusic, stopMusic } from "./sfx.js";
// (silent = drawing a poster: run the movie forward without any sound)
let SILENT = false;
export function setSilent(v) { SILENT = v; }
const sfx = (n) => { if (!SILENT) sfx0(n); };
const say = (t, p, r) => { if (!SILENT) say0(t, p, r); };

export const W = 1280, H = 720;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- poses (angles in radians, 0 = straight down,
// + = toward the way the fighter faces). arms: [shoulder, elbow bend], legs: [hip, knee bend]
const POSES = {
  idle: { lean: 0.04, aB: [0.5, -1.7], aF: [0.7, -1.9], lB: [-0.18, 0.1], lF: [0.22, 0.1], crouch: 6 },
  guard: { lean: 0.1, aB: [0.9, -2.1], aF: [1.1, -2.2], lB: [-0.3, 0.25], lF: [0.35, 0.2], crouch: 14 },
  punch: { lean: 0.22, aB: [0.6, -2.2], aF: [1.62, -0.05], lB: [-0.45, 0.15], lF: [0.45, 0.25], crouch: 10 },
  punch2: { lean: 0.25, aB: [1.62, -0.05], aF: [0.5, -2.1], lB: [-0.45, 0.2], lF: [0.5, 0.2], crouch: 10 },
  kick: { lean: -0.32, aB: [-0.5, -0.8], aF: [0.9, -1.8], lB: [-0.1, 0.1], lF: [1.75, 0.0], crouch: 0 },
  spinkick: { lean: -0.5, aB: [-1.0, -0.4], aF: [1.4, -0.3], lB: [-0.2, 0.3], lF: [2.0, 0.0], crouch: 0 },
  uppercut: { lean: 0.15, aB: [0.4, -1.8], aF: [2.7, -0.25], lB: [-0.5, 0.4], lF: [0.3, 0.5], crouch: 4 },
  slash: { lean: 0.28, aB: [0.3, -1.2], aF: [2.3, -0.3], lB: [-0.5, 0.2], lF: [0.55, 0.35], crouch: 12, swing: true },
  stab: { lean: 0.3, aB: [0.2, -1.4], aF: [1.55, 0], lB: [-0.6, 0.2], lF: [0.7, 0.45], crouch: 16 },
  block: { lean: -0.05, aB: [1.25, -2.4], aF: [1.4, -2.5], lB: [-0.35, 0.3], lF: [0.3, 0.3], crouch: 16 },
  hurt: { lean: -0.38, aB: [-0.5, -0.4], aF: [-0.3, -0.5], lB: [-0.35, 0.3], lF: [0.25, 0.4], crouch: 10, face: "hurt" },
  jump: { lean: 0.15, aB: [2.4, -0.6], aF: [2.6, -0.5], lB: [0.4, -1.9], lF: [0.9, -1.6], crouch: 0 },
  flykick: { lean: -0.2, aB: [2.4, -0.4], aF: [0.6, -1.4], lB: [0.3, -1.7], lF: [1.6, 0], crouch: 0 },
  cast: { lean: 0.15, aB: [1.5, -0.1], aF: [1.6, 0], lB: [-0.45, 0.2], lF: [0.45, 0.3], crouch: 12 },
  charge: { lean: -0.1, aB: [-0.4, -1.2], aF: [-0.3, -1.3], lB: [-0.5, 0.4], lF: [0.5, 0.45], crouch: 24 },
  taunt: { lean: -0.08, aB: [-0.6, 2.2], aF: [3.0, 0], lB: [-0.25, 0.1], lF: [0.25, 0.1], crouch: 0, face: "happy" },
  point: { lean: 0.05, aB: [0.2, -0.3], aF: [1.6, 0], lB: [-0.2, 0.1], lF: [0.2, 0.1], crouch: 0 },
  shrug: { lean: 0, aB: [0.9, 2.0], aF: [0.9, 2.0], lB: [-0.15, 0.1], lF: [0.15, 0.1], crouch: 0 },
  cheer: { lean: -0.05, aB: [3.0, 0.2], aF: [3.0, -0.2], lB: [-0.25, 0.1], lF: [0.25, 0.1], crouch: 0, face: "happy" },
  bow: { lean: 0.9, aB: [0.0, -0.1], aF: [0.1, -0.1], lB: [-0.05, 0], lF: [0.05, 0], crouch: 0 },
  throw: { lean: 0.25, aB: [-0.6, -0.6], aF: [2.3, -0.2], lB: [-0.55, 0.2], lF: [0.5, 0.3], crouch: 8 },
  duck: { lean: 0.3, aB: [1.8, -2.4], aF: [1.9, -2.4], lB: [-0.6, 1.9], lF: [0.9, 1.9], crouch: 60 },
  sit: { lean: -0.05, aB: [0.5, -1.4], aF: [0.6, -1.5], lB: [1.55, 1.5], lF: [1.45, 1.6], crouch: 0 },
  dizzy: { lean: -0.15, aB: [1.0, -0.2], aF: [-0.8, -0.2], lB: [-0.4, 0.3], lF: [0.4, 0.2], crouch: 8, face: "dizzy" },
  hug: { lean: 0.2, aB: [1.4, -1.0], aF: [1.5, -1.1], lB: [-0.2, 0.1], lF: [0.25, 0.1], crouch: 0, face: "happy" },
  wave: { lean: 0, aB: [0.3, -0.2], aF: [2.7, 0.6], lB: [-0.2, 0.1], lF: [0.2, 0.1], crouch: 0, face: "happy" },
};
const lerpPose = (a, b, k) => { const o = { face: k > 0.5 ? b.face : a.face, swing: b.swing }; for (const key of ["lean", "crouch"]) o[key] = lerp(a[key], b[key], k); for (const key of ["aB", "aF", "lB", "lF"]) o[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)]; return o; };

// ---------------------------------------------------------------- an actor (a fighter in the movie)
export class Actor {
  constructor(id, look) {
    this.id = id; this.look = look; this.s = look.scale || 1;
    this.x = -9999; this.y = 600; this.facing = 1; this.visible = false; this.base = "idle"; this.act = null;
    this.vx = 0; this.vy = 0; this.air = 0; this.rot = 0; this.alpha = 1; this.face = "normal";
    this.tx = null; this.jmp = null; this.ko = null; this.sayText = null; this.sayEnd = 0; this.hurtEnd = 0; this.glow = 0; this.float = 0;
  }
}
// ---------------------------------------------------------------- the player: runs one movie
export class Movie {
  constructor(def) {
    this.def = def; this.t = 0; this.speed = 1; this.slowEnd = -1; this.events = def.events.slice().sort((a, b) => a.t - b.t); this.ei = 0;
    this.actors = {}; for (const [id, look] of Object.entries(def.cast)) this.actors[id] = new Actor(id, look);
    this.fx = []; this.proj = []; this.titles = []; this.cam = { z: 1, x: W / 2, y: H / 2 }; this.camT = null; this.shake = 0; this.flash = 0; this.bg = def.bg; this.flashCol = "#fff";
    this.done = false; this.length = def.length;
  }
  start() { if (this.def.music) playMusic(this.def.music); }
  stop() { stopMusic(); hush(); }
  update(rdt) {
    if (this.done) return;
    if (this.t > this.slowEnd) this.speed = 1;
    const dt = rdt * this.speed; this.t += dt;
    while (this.ei < this.events.length && this.events[this.ei].t <= this.t) this.run(this.events[this.ei++]);
    for (const A of Object.values(this.actors)) this.step(A, dt);
    for (const f of this.fx) { f.age += dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g ?? 900) * dt; } }
    this.fx = this.fx.filter((f) => f.age < f.life);
    for (const p of this.proj) p.age += dt; this.proj = this.proj.filter((p) => p.age < p.d);
    if (this.camT) { const c = this.camT, k = ease((this.t - c.t0) / c.d); this.cam.z = lerp(c.z0, c.z, k); this.cam.x = lerp(c.x0, c.x, k); this.cam.y = lerp(c.y0, c.y, k); if (k >= 1) this.camT = null; }
    this.shake = Math.max(0, this.shake - dt * 2.2); this.flash = Math.max(0, this.flash - dt * 3);
    if (this.t >= this.length) { this.done = true; this.stop(); }
  }
  // one event
  run(e) {
    const A = e.who ? this.actors[e.who] : null, t = this.t;
    switch (e.type) {
      case "show": A.visible = true; A.x = e.x; A.y = e.y ?? A.y; A.facing = e.facing ?? A.facing; A.base = e.base || "idle"; A.alpha = 1; A.ko = null; A.rot = 0; break;
      case "hide": A.visible = false; break;
      case "face": A.facing = e.dir; break;
      case "base": A.base = e.base; break;
      case "move": A.tx = { x0: A.x, x: e.x, t0: t, d: e.d, y0: A.y, y: e.y ?? A.y }; A.base = e.anim || "run"; if (e.x !== A.x && !e.keepFace) A.facing = Math.sign(e.x - A.x); break;
      case "jump": A.jmp = { x0: A.x, x: e.x ?? A.x, y0: A.y, y: e.y ?? A.y, t0: t, d: e.d, h: e.h ?? 200, flip: e.flip || 0, pose: e.pose || "jump" }; A.ko = null; A.rot = 0; if (e.x !== undefined && e.x !== A.x && !e.keepFace) A.facing = Math.sign(e.x - A.x); break;
      case "act": A.act = { name: e.pose, t0: t, d: e.d, hold: e.hold }; if (e.face) A.face = e.face; break;
      case "hit": { A.act = { name: "hurt", t0: t, d: e.d ?? 0.45 }; A.vx = (e.dir ?? -A.facing) * (e.power ?? 1) * 380; A.hurtEnd = t + 0.5; const hx = A.x + (e.dir ?? -A.facing) * -20 * A.s, hy = A.y - 120 * A.s; this.burst(hx, hy, e.power ?? 1, e.word); this.shake = Math.max(this.shake, 0.25 * (e.power ?? 1)); if (e.sound !== false) sfx(e.sound || "punch"); break; }
      case "ko": A.ko = { t0: t, dir: e.dir ?? -A.facing, power: e.power ?? 1, sky: e.sky }; A.act = null; A.tx = null; A.jmp = null; this.shake = 0.6; sfx(e.sound || "ko"); this.burst(A.x, A.y - 130 * A.s, 1.6, e.word || "K.O.!"); break;
      case "up": A.ko = null; A.rot = 0; A.base = "idle"; A.y = e.y ?? A.y; A.act = { name: "idle", t0: t, d: 0.1 }; break;
      case "say": A.sayText = e.text; A.sayEnd = t + e.d; if (!e.silent) say(e.text, A.look.voice ?? 1, A.look.rate ?? 1.05); break;
      case "face2": A.face = e.face; break;
      case "glow": A.glow = e.v; break;
      case "float": A.float = e.v; break;
      case "alpha": A.alpha = e.v; break;
      case "look": Object.assign(A.look, e.v); break;
      case "sfx": sfx(e.name); break;
      case "cam": this.camT = { z0: this.cam.z, x0: this.cam.x, y0: this.cam.y, z: e.z, x: e.x ?? W / 2, y: e.y ?? H / 2, t0: t, d: e.d || 0.001 }; break;
      case "shake": this.shake = Math.max(this.shake, e.a); break;
      case "flash": this.flash = 1; this.flashCol = e.color || "#fff"; break;
      case "slow": this.speed = e.f; this.slowEnd = t + e.d; break;
      case "bg": this.bg = e.bg; break;
      case "title": this.titles.push({ text: e.text, sub: e.sub, t0: t, d: e.d, color: e.color || "#ffd23a", size: e.size || 120, y: e.y }); break;
      case "fx": this.addFx(e); break;
      case "proj": { const from = typeof e.from === "string" ? this.actors[e.from] : null, to = typeof e.to === "string" ? this.actors[e.to] : null;
        const fx = from ? from.x + from.facing * 70 * from.s : e.from[0], fy = from ? from.y - 115 * from.s : e.from[1];
        const tx = to ? to.x : e.to[0], ty = to ? to.y - 110 * to.s : e.to[1];
        this.proj.push({ kind: e.kind, x0: fx, y0: fy, x1: tx, y1: ty, d: e.d, age: 0, arc: e.arc || 0, color: e.color, size: e.size || 1 }); if (e.sound) sfx(e.sound); break; }
    }
  }
  burst(x, y, power = 1, word) {
    const words = ["POW!", "BAM!", "WHAM!", "BOOM!", "KAPOW!", "SMACK!", "THWACK!", "ZONK!"];
    this.fx.push({ kind: "pow", x, y, age: 0, life: 0.55, word: word === undefined ? words[Math.floor(Math.random() * words.length)] : word, s: 0.7 + power * 0.35, rot: rnd(-0.3, 0.3) });
    for (let i = 0; i < 10 + power * 6; i++) { const a = rnd(0, Math.PI * 2), v = rnd(200, 600) * power; this.fx.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 400, age: 0, life: rnd(0.2, 0.45), c: ["#fff7b0", "#ffd23a", "#ffffff"][i % 3] }); }
  }
  addFx(e) {
    const T = this.t, n = e.n || 1;
    if (e.kind === "boom" || e.kind === "bigboom") {
      const big = e.kind === "bigboom";
      this.fx.push({ kind: "ball", x: e.x, y: e.y, age: 0, life: big ? 1.1 : 0.7, r: big ? 260 : 140 });
      for (let i = 0; i < (big ? 50 : 26); i++) { const a = rnd(0, Math.PI * 2), v = rnd(150, big ? 900 : 600); this.fx.push({ kind: "debris", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, g: 800, age: 0, life: rnd(0.6, 1.4), c: ["#ff7a1a", "#ffd23a", "#5a5a5a", "#e0302a"][i % 4], r: rnd(4, 12) }); }
      this.shake = Math.max(this.shake, big ? 1 : 0.6); this.flash = big ? 0.9 : 0.4; this.flashCol = "#fff3c0"; sfx(big ? "bigboom" : "boom");
    } else if (e.kind === "confetti") { for (let i = 0; i < 120; i++) { const a = rnd(-Math.PI, 0), v = rnd(200, 900); this.fx.push({ kind: "conf", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 500, age: 0, life: rnd(1.5, 3), c: ["#ff3a5a", "#ffd23a", "#3aa0ff", "#4adf6a", "#ff7ad8", "#ffffff"][i % 6], r: rnd(5, 10), spin: rnd(-10, 10) }); } }
    else if (e.kind === "dust") { for (let i = 0; i < 10; i++) this.fx.push({ kind: "puff", x: e.x + rnd(-40, 40), y: e.y - rnd(0, 20), vx: rnd(-120, 120), vy: rnd(-90, -20), g: 0, age: 0, life: rnd(0.5, 0.9), r: rnd(18, 36), c: e.c || "rgba(200,180,150," }); }
    else if (e.kind === "smoke") { for (let i = 0; i < 14; i++) this.fx.push({ kind: "puff", x: e.x + rnd(-50, 50), y: e.y + rnd(-30, 30), vx: rnd(-60, 60), vy: rnd(-120, -40), g: 0, age: 0, life: rnd(0.8, 1.6), r: rnd(30, 60), c: e.c || "rgba(120,120,120," }); }
    else if (e.kind === "flour") { for (let i = 0; i < 40; i++) this.fx.push({ kind: "puff", x: e.x + rnd(-80, 80), y: e.y + rnd(-60, 40), vx: rnd(-200, 200), vy: rnd(-160, 20), g: 0, age: 0, life: rnd(1.2, 2.4), r: rnd(30, 70), c: "rgba(255,255,255," }); }
    else if (e.kind === "slash") this.fx.push({ kind: "slash", x: e.x, y: e.y, age: 0, life: 0.3, dir: e.dir || 1, s: e.s || 1, c: e.c || "#ffffff" });
    else if (e.kind === "beam") this.fx.push({ kind: "beam", x: e.x, y: e.y, x2: e.x2, y2: e.y2, age: 0, life: e.d || 0.5, c: e.c || "#ff3a3a", w: e.w || 14 });
    else if (e.kind === "fire") this.fx.push({ kind: "fire", x: e.x, y: e.y, x2: e.x2, y2: e.y2, age: 0, life: e.d || 1 });
    else if (e.kind === "speed") this.fx.push({ kind: "speed", age: 0, life: e.d || 0.6 });
    else if (e.kind === "stars") this.fx.push({ kind: "stars", who: e.who, age: 0, life: e.d || 2 });
    else if (e.kind === "twinkle") this.fx.push({ kind: "twinkle", x: e.x, y: e.y, age: 0, life: 1.2 });
    else if (e.kind === "lightning") { this.fx.push({ kind: "bolt", x: e.x, y: e.y, age: 0, life: 0.35, seed: Math.random() }); this.flash = 0.7; this.flashCol = "#dff4ff"; sfx("zap"); }
    else if (e.kind === "hearts") { for (let i = 0; i < 12; i++) this.fx.push({ kind: "heart", x: e.x + rnd(-60, 60), y: e.y, vx: rnd(-40, 40), vy: rnd(-180, -80), g: 0, age: 0, life: rnd(1, 2) }); }
    else if (e.kind === "splat") { for (let i = 0; i < 18; i++) { const a = rnd(0, Math.PI * 2), v = rnd(100, 420); this.fx.push({ kind: "debris", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, g: 900, age: 0, life: rnd(0.5, 1), c: e.c || "#f4f0e8", r: rnd(5, 12) }); } }
    else if (e.kind === "sparks") { for (let i = 0; i < 18; i++) { const a = rnd(0, Math.PI * 2), v = rnd(200, 650); this.fx.push({ kind: "spark", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 400, age: 0, life: rnd(0.2, 0.45), c: e.c || ["#fff7b0", "#ffd23a", "#ffffff"][i % 3] }); } }
    else if (e.kind === "text") this.fx.push({ kind: "text", x: e.x, y: e.y, age: 0, life: e.d || 1.2, text: e.text, c: e.c || "#fff", size: e.size || 60 });
  }
  // movement each frame
  step(A, dt) {
    const t = this.t;
    if (A.tx) { const k = clamp((t - A.tx.t0) / A.tx.d, 0, 1); A.x = lerp(A.tx.x0, A.tx.x, k); A.y = lerp(A.tx.y0, A.tx.y, k); if (k >= 1) { A.tx = null; if (A.base === "run" || A.base === "walk") A.base = "idle"; } }
    if (A.jmp) { const J = A.jmp, k = clamp((t - J.t0) / J.d, 0, 1); A.x = lerp(J.x0, J.x, k); A.y = lerp(J.y0, J.y, k); A.air = Math.sin(k * Math.PI) * J.h; A.rot = J.flip ? -J.flip * A.facing * k * Math.PI * 2 : 0; if (k >= 1) { A.jmp = null; A.air = 0; A.rot = 0; this.addFx({ kind: "dust", x: A.x, y: A.y }); sfx("land"); } }
    if (A.vx) { A.x += A.vx * dt; A.vx *= Math.exp(-6 * dt); if (Math.abs(A.vx) < 5) A.vx = 0; }
    if (A.ko) { const K = A.ko, k = t - K.t0; if (K.sky) { A.x += K.dir * 900 * dt; A.air = k * 700; A.rot += K.dir * dt * 14; } else if (k < 0.7) { A.x += K.dir * (1 - k / 0.7) * 520 * K.power * dt; A.air = Math.sin(clamp(k / 0.7, 0, 1) * Math.PI) * 90 * K.power; A.rot = -K.dir * Math.min(1, k / 0.5) * Math.PI / 2 * A.facing; } else { A.air = 0; A.rot = -K.dir * Math.PI / 2 * A.facing; } }
  }
  // ---------------------------------------------------------------- drawing
  draw(g) {
    g.save();
    const c = this.cam, sh = this.shake * 22;
    const BG = BACKGROUNDS[this.bg] || BACKGROUNDS.city;
    BG(g, this.t, c);
    g.translate(W / 2 + rnd(-sh, sh), H / 2 + rnd(-sh, sh)); g.scale(c.z, c.z); g.translate(-c.x, -c.y);
    if (BG.ground) BG.ground(g, this.t, c);
    for (const f of this.fx) if (f.kind === "ball" || f.kind === "puff") drawFx(g, f, this);
    const list = Object.values(this.actors).filter((A) => A.visible).sort((a, b) => a.y - b.y);
    for (const A of list) drawActor(g, A, this);
    for (const p of this.proj) drawProj(g, p);
    for (const f of this.fx) if (f.kind !== "ball" && f.kind !== "puff" && f.kind !== "speed") drawFx(g, f, this);
    for (const A of list) if (A.sayText && this.t < A.sayEnd) drawBubble(g, A, this);
    g.restore();
    for (const f of this.fx) if (f.kind === "speed") drawFx(g, f, this);
    if (this.flash > 0) { g.globalAlpha = this.flash * 0.85; g.fillStyle = this.flashCol; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    for (const T of this.titles) { const k = (this.t - T.t0) / T.d; if (k < 0 || k > 1) continue; drawTitle(g, T, k); }
    // movie look: letterbox bars + a soft vignette
    g.fillStyle = "#000"; g.fillRect(0, 0, W, 34); g.fillRect(0, H - 34, W, 34);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)"); g.fillStyle = v; g.fillRect(0, 0, W, H);
    // the subtitle for whoever is talking
    for (const A of Object.values(this.actors)) if (A.sayText && this.t < A.sayEnd) { g.font = "bold 30px Inter, Arial, sans-serif"; g.textAlign = "center"; g.lineWidth = 6; g.strokeStyle = "#000"; const s = (A.look.name ? A.look.name + ": " : "") + A.sayText; g.strokeText(s, W / 2, H - 52); g.fillStyle = "#fff"; g.fillText(s, W / 2, H - 52); break; }
  }
}
// ---------------------------------------------------------------- the pose for this moment
function poseOf(A, M) {
  const t = M.t, base = POSES.idle;
  let P;
  if (A.ko) P = lerpPose(POSES.hurt, POSES.idle, 0.3);
  else if (A.base === "run" || A.base === "walk") {
    const sp = A.base === "run" ? 14 : 8, k = A.base === "run" ? 1 : 0.6, s1 = Math.sin(t * sp);
    P = { lean: A.base === "run" ? 0.22 : 0.06, crouch: 4, aB: [-s1 * 0.9 * k + 0.2, -1.6], aF: [s1 * 0.9 * k + 0.2, -1.6], lB: [s1 * 0.8 * k, 0.4 + Math.max(0, s1) * 0.9 * k], lF: [-s1 * 0.8 * k, 0.4 + Math.max(0, -s1) * 0.9 * k] };
  } else if (A.base === "dance") {
    const s1 = Math.sin(t * 9); P = { lean: s1 * 0.15, crouch: 10 + Math.abs(s1) * 14, aB: [2.4 + s1 * 0.6, 0.4], aF: [2.4 - s1 * 0.6, -0.4], lB: [-0.3 + s1 * 0.3, 0.3], lF: [0.3 + s1 * 0.3, 0.3], face: "happy" };
  } else if (POSES[A.base]) P = POSES[A.base];
  else P = base;
  if (A.jmp) P = lerpPose(P, POSES[A.jmp.pose] || POSES.jump, Math.min(1, (t - A.jmp.t0) / 0.12));
  if (A.act && !A.ko) {
    const a = A.act, k = (t - a.t0) / a.d, target = POSES[a.name] || base;
    if (k >= 1 && !a.hold) A.act = null;
    else { const w = a.hold && k >= 1 ? 1 : k < 0.25 ? ease(k / 0.25) : k < 0.6 ? 1 : 1 - ease((k - 0.6) / 0.4); P = lerpPose(P, target, w); if (target.swing) P.aF = [lerp(3.0, 0.7, ease(clamp(k / 0.45, 0, 1))), -0.2]; }
  }
  // breathing
  P = { ...P, bob: A.base === "idle" && !A.act ? Math.sin(t * 2.4 + A.x) * 2 : 0 };
  return P;
}
const dirv = (a, f) => [Math.sin(a) * f, Math.cos(a)];
function limb(g, x, y, a1, a2, L1, L2, f, w, col, endR, endCol) {
  const [dx, dy] = dirv(a1, f), ex = x + dx * L1, ey = y + dy * L1, [dx2, dy2] = dirv(a1 + a2, f), hx = ex + dx2 * L2, hy = ey + dy2 * L2;
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
  if (endR) { g.fillStyle = endCol; g.beginPath(); g.arc(hx, hy, endR, 0, Math.PI * 2); g.fill(); }
  return { ex, ey, hx, hy, ang: a1 + a2 };
}
function shade(hex, k) { const c = parseInt(hex.slice(1), 16), r = clamp(((c >> 16) & 255) * k, 0, 255), gg = clamp(((c >> 8) & 255) * k, 0, 255), b = clamp((c & 255) * k, 0, 255); return `rgb(${r | 0},${gg | 0},${b | 0})`; }
// ---------------------------------------------------------------- draw one actor
function drawActor(g, A, M) {
  const L = A.look;
  if (L.kind === "dragon") return drawDragon(g, A, M);
  const P = poseOf(A, M), s = A.s, f = A.facing;
  const legU = 46 * s, legL = 44 * s, torso = 70 * s, armU = 38 * s, armL = 36 * s, hr = 31 * s;
  g.save(); g.globalAlpha = A.alpha;
  const fl = A.float ? Math.sin(M.t * 3 + A.x) * 10 : 0;
  // feet find the ground: work out the legs, then sit the body so the lower foot touches the floor
  const footY = (lg) => { const [, d1] = dirv(lg[0], 1), [, d2] = dirv(lg[0] + lg[1], 1); return d1 * legU + d2 * legL; };
  const drop = Math.max(footY(P.lB), footY(P.lF));
  const hipX = A.x, hipY = A.y - drop - A.air + (P.bob || 0) - fl;
  // shadow
  g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(A.x, A.y + 2, 50 * s * Math.max(0.3, 1 - A.air / 500), 10 * s, 0, 0, Math.PI * 2); g.fill();
  g.translate(hipX, hipY); g.rotate(A.rot); g.translate(-hipX, -hipY);
  if (A.glow) { g.shadowColor = A.glow; g.shadowBlur = 30; }
  const skin = L.skin || "#f2c49b", body = L.body || "#3a7ad0", pants = L.pants || "#2a3550", shoe = L.shoes || "#222";
  const topX = hipX + Math.sin(P.lean) * f * torso, topY = hipY - Math.cos(P.lean) * torso;
  const shX = lerp(hipX, topX, 0.88), shY = lerp(hipY, topY, 0.88);
  // cape (behind)
  if (L.cape) { g.fillStyle = L.cape; g.beginPath(); g.moveTo(shX - f * 8 * s, shY); g.quadraticCurveTo(hipX - f * (40 + Math.sin(M.t * 6) * 10) * s, hipY + 10 * s, hipX - f * (30 + Math.sin(M.t * 7) * 14) * s, A.y - A.air - 10 * s); g.lineTo(hipX - f * 4 * s, hipY - 10 * s); g.fill(); }
  const armCol = L.kind === "robot" ? "#8a9098" : L.sleeves === false ? skin : body;
  const aB = limb(g, shX - f * 6 * s, shY + 6 * s, P.aB[0], P.aB[1], armU, armL, f, 14 * s, shade(armCol.startsWith("#") ? armCol : "#888888", 0.8), 9 * s, L.kind === "robot" ? "#5a6068" : skin);
  if (L.shield) { g.fillStyle = L.shield; g.strokeStyle = "#d4af37"; g.lineWidth = 5 * s; g.beginPath(); g.ellipse(aB.hx + f * 6 * s, aB.hy, 30 * s, 40 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "#d4af37"; g.fillRect(aB.hx + f * 6 * s - 4 * s, aB.hy - 24 * s, 8 * s, 48 * s); }
  limb(g, hipX - f * 9 * s, hipY, P.lB[0], P.lB[1], legU, legL, f, 17 * s, shade(pants, 0.8), 10 * s, shoe);
  // torso
  g.fillStyle = body; g.save(); g.translate(hipX, hipY); g.rotate(P.lean * f); roundRect(g, -25 * s, -torso - 4 * s, 50 * s, torso + 12 * s, 16 * s); g.fill();
  if (L.belt) { g.fillStyle = L.belt; g.fillRect(-26 * s, -12 * s, 52 * s, 10 * s); }
  if (L.kind === "robot") { g.fillStyle = "#5a6068"; g.fillRect(-14 * s, -torso + 14 * s, 28 * s, 22 * s); g.fillStyle = A.glow || "#3ad0ff"; g.beginPath(); g.arc(0, -torso + 25 * s, 7 * s, 0, Math.PI * 2); g.fill(); }
  if (L.apron) { g.fillStyle = L.apron; roundRect(g, -20 * s, -torso * 0.6, 40 * s, torso * 0.65, 8 * s); g.fill(); }
  if (L.armor) { g.fillStyle = L.armor; roundRect(g, -27 * s, -torso, 54 * s, torso * 0.6, 12 * s); g.fill(); }
  if (L.shawl) { g.fillStyle = L.shawl; g.beginPath(); g.moveTo(-27 * s, -torso + 4 * s); g.lineTo(27 * s, -torso + 4 * s); g.lineTo(0, -torso * 0.4); g.fill(); }
  g.restore();
  limb(g, hipX + f * 9 * s, hipY, P.lF[0], P.lF[1], legU, legL, f, 17 * s, pants, 10 * s, shoe);
  // head
  const hx = topX + Math.sin(P.lean) * f * (hr + 2), hy = topY - Math.cos(P.lean) * (hr - 2);
  drawHead(g, A, M, hx, hy, hr, P);
  // front arm + the thing in that hand
  const aF = limb(g, shX + f * 6 * s, shY + 6 * s, P.aF[0], P.aF[1], armU, armL, f, 14 * s, armCol, 9 * s, L.kind === "robot" ? "#5a6068" : skin);
  if (L.weapon) drawWeapon(g, L, aF, f, s, M);
  g.restore();
}
function drawHead(g, A, M, x, y, r, P) {
  const L = A.look, f = A.facing, s = A.s, face = A.hurtEnd > M.t ? "hurt" : P.face || A.face;
  if (L.kind === "robot") { g.fillStyle = L.head || "#b8c0c8"; roundRect(g, x - r, y - r, r * 2, r * 2, r * 0.35); g.fill(); g.fillStyle = "#1a1e24"; roundRect(g, x - r * 0.75 + f * r * 0.15, y - r * 0.35, r * 1.5, r * 0.55, r * 0.25); g.fill(); g.fillStyle = L.eye || "#ff3a3a"; g.shadowColor = L.eye || "#ff3a3a"; g.shadowBlur = 16; for (const k of [-0.35, 0.3]) { g.beginPath(); g.arc(x + f * r * (k + 0.15), y - r * 0.08, r * 0.14, 0, Math.PI * 2); g.fill(); } g.shadowBlur = 0; g.strokeStyle = "#8a9098"; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x, y - r * 1.5); g.stroke(); g.fillStyle = "#ff3a3a"; g.beginPath(); g.arc(x, y - r * 1.55, 5 * s, 0, Math.PI * 2); g.fill(); return; }
  const skin = L.kind === "alien" ? L.skin || "#7be03a" : L.skin || "#f2c49b";
  g.fillStyle = skin; g.beginPath(); if (L.kind === "alien") g.ellipse(x, y - r * 0.2, r * 1.05, r * 1.3, 0, 0, Math.PI * 2); else g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  // hair + hats
  if (L.hair) { g.fillStyle = L.hair; g.beginPath(); g.arc(x - f * r * 0.1, y - r * 0.2, r * 1.02, Math.PI * 1.05, Math.PI * 1.98); g.fill(); if (L.bun) { g.beginPath(); g.arc(x - f * r * 0.6, y - r * 0.9, r * 0.45, 0, Math.PI * 2); g.fill(); } }
  if (L.mask) { g.fillStyle = L.mask; g.beginPath(); g.arc(x, y, r * 1.02, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.fillRect(x - r, y + r * 0.05, r * 2, r * 0.5); g.fillStyle = skin; roundRect(g, x - r * 0.55 + f * r * 0.3, y - r * 0.38, r * 1.0, r * 0.4, r * 0.15); g.fill(); }
  if (L.hat === "headband") { g.fillStyle = L.band || "#e0302a"; g.fillRect(x - r, y - r * 0.55, r * 2, r * 0.25); g.beginPath(); g.moveTo(x - f * r, y - r * 0.45); g.lineTo(x - f * (r + 26 + Math.sin(M.t * 12) * 6) * s, y - r * 0.2); g.lineTo(x - f * (r + 22) * s, y - r * 0.05); g.fill(); }
  if (L.hat === "cowboy") { g.fillStyle = L.hatC || "#6a4426"; g.beginPath(); g.ellipse(x, y - r * 0.75, r * 1.6, r * 0.28, 0, 0, Math.PI * 2); g.fill(); roundRect(g, x - r * 0.8, y - r * 1.55, r * 1.6, r * 0.85, r * 0.3); g.fill(); }
  if (L.hat === "chef") { g.fillStyle = "#ffffff"; g.fillRect(x - r * 0.8, y - r * 1.1, r * 1.6, r * 0.5); for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.arc(x + k * r, y - r * 1.4, r * 0.5, 0, Math.PI * 2); g.fill(); } }
  if (L.hat === "helmet") { g.fillStyle = L.hatC || "#b8c0c8"; g.beginPath(); g.arc(x, y, r * 1.08, Math.PI, Math.PI * 2); g.fill(); g.fillRect(x - r * 1.08, y - 2, r * 2.16, r * 0.25); if (L.plume) { g.fillStyle = L.plume; g.beginPath(); g.ellipse(x - f * r * 0.3, y - r * 1.3, r * 0.6, r * 0.3, -f * 0.5, 0, Math.PI * 2); g.fill(); } }
  if (L.hat === "crown") { g.fillStyle = "#ffd23a"; g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.8); for (let i = 0; i <= 4; i++) g.lineTo(x - r * 0.7 + i * r * 0.35, y - r * (i % 2 ? 1.15 : 1.5)); g.lineTo(x + r * 0.7, y - r * 0.8); g.fill(); }
  if (L.hat === "bandana") { g.fillStyle = L.band || "#e0302a"; g.beginPath(); g.arc(x, y, r * 1.03, Math.PI, Math.PI * 2); g.fill(); }
  if (L.kind === "alien") { g.strokeStyle = skin; g.lineWidth = 4 * s; for (const k of [-0.4, 0.4]) { g.beginPath(); g.moveTo(x + k * r, y - r * 1.3); g.lineTo(x + k * r * 1.6, y - r * 2.0); g.stroke(); g.fillStyle = "#ffd23a"; g.beginPath(); g.arc(x + k * r * 1.6, y - r * 2.0, 6 * s, 0, Math.PI * 2); g.fill(); } }
  // face (on the side it faces)
  const ex = x + f * r * 0.35, ey = y - r * 0.1, sep = r * 0.38;
  g.fillStyle = "#1a1a1a"; g.strokeStyle = "#1a1a1a"; g.lineWidth = 3.5 * s; g.lineCap = "round";
  const eyes = (fn) => { for (const k of [-1, 1]) fn(ex + k * sep * 0.55, ey); };
  if (A.ko || face === "dizzy") eyes((px, py) => { g.beginPath(); g.moveTo(px - 6 * s, py - 6 * s); g.lineTo(px + 6 * s, py + 6 * s); g.moveTo(px + 6 * s, py - 6 * s); g.lineTo(px - 6 * s, py + 6 * s); g.stroke(); });
  else if (face === "happy") eyes((px, py) => { g.beginPath(); g.arc(px, py + 2 * s, 6 * s, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); });
  else if (face === "hurt") eyes((px, py) => { g.beginPath(); g.moveTo(px - 6 * s, py - 4 * s); g.lineTo(px + 6 * s, py); g.lineTo(px - 6 * s, py + 4 * s); g.stroke(); });
  else { const big = L.kind === "alien" ? 1.6 : 1; eyes((px, py) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(px, py, 7 * s * big, 0, Math.PI * 2); g.fill(); g.fillStyle = L.eyeC || "#1a1a1a"; g.beginPath(); g.arc(px + f * 2 * s, py, 4 * s * big, 0, Math.PI * 2); g.fill(); }); if (face === "angry" || L.angry) { g.beginPath(); g.moveTo(ex - sep, ey - 13 * s); g.lineTo(ex - 3 * s, ey - 7 * s); g.moveTo(ex + sep, ey - 13 * s); g.lineTo(ex + 3 * s, ey - 7 * s); g.stroke(); } }
  if (L.glasses) { g.strokeStyle = "#555"; g.lineWidth = 2.5 * s; eyes((px, py) => { g.beginPath(); g.arc(px, py, 9 * s, 0, Math.PI * 2); g.stroke(); }); }
  if (L.mask) return;
  // mouth: talks while there's a line
  const talking = A.sayText && M.t < A.sayEnd, mx = ex, my = y + r * 0.42;
  if (L.beard) { g.fillStyle = L.beard; g.beginPath(); g.arc(x + f * r * 0.15, y + r * 0.35, r * 0.75, 0, Math.PI); g.fill(); }
  if (L.mustache) { g.fillStyle = L.mustache; g.beginPath(); g.ellipse(mx - 7 * s, my - 8 * s, 10 * s, 5 * s, 0.3, 0, Math.PI * 2); g.ellipse(mx + 7 * s, my - 8 * s, 10 * s, 5 * s, -0.3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#5a1a1a";
  if (talking && Math.sin(M.t * 22) > -0.2) { g.beginPath(); g.ellipse(mx, my, 8 * s, 6 * s + Math.abs(Math.sin(M.t * 18)) * 5 * s, 0, 0, Math.PI * 2); g.fill(); }
  else if (face === "hurt" || A.ko) { g.beginPath(); g.ellipse(mx, my, 7 * s, 9 * s, 0, 0, Math.PI * 2); g.fill(); }
  else if (face === "happy") { g.beginPath(); g.arc(mx, my - 4 * s, 10 * s, 0.15, Math.PI - 0.15); g.fill(); }
  else { g.strokeStyle = "#5a1a1a"; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(mx - 8 * s, my); g.lineTo(mx + 8 * s, my - (face === "angry" ? -2 : 1) * s); g.stroke(); }
}
function drawWeapon(g, L, a, f, s, M) {
  const [dx, dy] = dirv(a.ang, f), x = a.hx, y = a.hy, w = L.weapon, len = (w === "saber" ? 120 : w === "sword" || w === "katana" ? 105 : w === "spoon" ? 95 : w === "pin" ? 70 : w === "staff" ? 140 : 80) * s;
  const tx = x + dx * len, ty = y + dy * len;
  g.lineCap = "round";
  if (w === "saber") { g.save(); g.shadowColor = L.wc || "#3ad0ff"; g.shadowBlur = 24; g.strokeStyle = L.wc || "#3ad0ff"; g.lineWidth = 12 * s; g.beginPath(); g.moveTo(x + dx * 14 * s, y + dy * 14 * s); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = "#fff"; g.lineWidth = 5 * s; g.stroke(); g.restore(); g.strokeStyle = "#555"; g.lineWidth = 9 * s; g.beginPath(); g.moveTo(x - dx * 10 * s, y - dy * 10 * s); g.lineTo(x + dx * 14 * s, y + dy * 14 * s); g.stroke(); return; }
  if (w === "sword" || w === "katana") { g.strokeStyle = "#e6ecf2"; g.lineWidth = (w === "katana" ? 6 : 9) * s; g.beginPath(); g.moveTo(x + dx * 12 * s, y + dy * 12 * s); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = w === "katana" ? "#1a1a1a" : "#d4af37"; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(x - dx * 12 * s, y - dy * 12 * s); g.lineTo(x + dx * 10 * s, y + dy * 10 * s); g.stroke(); g.beginPath(); g.moveTo(x + dx * 10 * s - dy * 14 * s, y + dy * 10 * s + dx * 14 * s); g.lineTo(x + dx * 10 * s + dy * 14 * s, y + dy * 10 * s - dx * 14 * s); g.stroke(); return; }
  if (w === "pin") { g.strokeStyle = "#c89a5a"; g.lineWidth = 16 * s; g.beginPath(); g.moveTo(x - dx * 6 * s, y - dy * 6 * s); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = "#8a5a2a"; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + dx * 14 * s, ty + dy * 14 * s); g.stroke(); return; }
  if (w === "pan") { g.strokeStyle = "#2a2a2e"; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * 40 * s, y + dy * 40 * s); g.stroke(); g.fillStyle = "#3a3a40"; g.beginPath(); g.arc(x + dx * 62 * s, y + dy * 62 * s, 24 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#55565e"; g.beginPath(); g.arc(x + dx * 62 * s, y + dy * 62 * s, 16 * s, 0, Math.PI * 2); g.fill(); return; }
  if (w === "spoon") { g.strokeStyle = "#c8ccd2"; g.lineWidth = 8 * s; g.beginPath(); g.moveTo(x - dx * 10 * s, y - dy * 10 * s); g.lineTo(tx, ty); g.stroke(); g.fillStyle = "#d8dde3"; g.beginPath(); g.ellipse(tx + dx * 14 * s, ty + dy * 14 * s, 14 * s, 22 * s, Math.atan2(dy, dx) + Math.PI / 2, 0, Math.PI * 2); g.fill(); return; }
  if (w === "staff") { g.strokeStyle = "#8a5a2a"; g.lineWidth = 8 * s; g.beginPath(); g.moveTo(x - dx * 40 * s, y - dy * 40 * s); g.lineTo(tx, ty); g.stroke(); g.fillStyle = L.wc || "#a64bf4"; g.shadowColor = L.wc || "#a64bf4"; g.shadowBlur = 20; g.beginPath(); g.arc(tx, ty, 12 * s, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
}
// a big friendly-ish dragon (look.kind = "dragon")
function drawDragon(g, A, M) {
  const s = A.s, f = A.facing, t = M.t, L = A.look, c = L.body || "#3aa04a", belly = L.belly || "#e8d070";
  const x = A.x, y = A.y - A.air; g.save(); g.globalAlpha = A.alpha;
  g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(A.x, A.y + 4, 220 * s, 22 * s, 0, 0, Math.PI * 2); g.fill();
  g.translate(x, y); g.rotate(A.rot); g.scale(f, 1);
  const live = A.act && !A.ko && t - A.act.t0 < A.act.d, act = live ? A.act.name : "", k = live ? clamp((t - A.act.t0) / A.act.d, 0, 1) : 0;
  const roar = act === "roar" || act === "fire", tail = act === "tail" ? Math.sin(k * Math.PI) : 0, hurt = A.hurtEnd > t || A.ko;
  // wings
  const flap = Math.sin(t * (A.air ? 10 : 2.5)) * (A.air ? 0.6 : 0.15);
  g.fillStyle = shade(c, 0.7); for (const side of [-1, 1]) { g.save(); g.translate(-20 * s, -230 * s); g.rotate(-0.5 + flap * side * 0.4); g.beginPath(); g.moveTo(0, 0); g.lineTo(-160 * s, -150 * s); g.lineTo(-60 * s, -40 * s); g.lineTo(-180 * s, -40 * s); g.lineTo(-40 * s, 20 * s); g.fill(); g.restore(); }
  // tail
  g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = 46 * s; g.beginPath(); g.moveTo(-120 * s, -120 * s); g.quadraticCurveTo(-260 * s, -60 * s + tail * -120 * s, -330 * s - tail * 60 * s, -150 * s - tail * 120 * s); g.stroke();
  g.fillStyle = shade(c, 0.6); g.beginPath(); g.moveTo(-330 * s - tail * 60 * s, -150 * s - tail * 120 * s); g.lineTo(-380 * s - tail * 60 * s, -190 * s - tail * 120 * s); g.lineTo(-360 * s - tail * 60 * s, -120 * s - tail * 120 * s); g.fill();
  // legs
  g.fillStyle = shade(c, 0.85); for (const lx of [-90, 70]) { roundRect(g, (lx - 28) * s, -90 * s, 56 * s, 92 * s, 18 * s); g.fill(); }
  // body + belly
  g.fillStyle = c; g.beginPath(); g.ellipse(-10 * s, -150 * s, 160 * s, 100 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = belly; g.beginPath(); g.ellipse(30 * s, -130 * s, 100 * s, 66 * s, 0.15, 0, Math.PI * 2); g.fill();
  // back spikes
  g.fillStyle = shade(c, 0.6); for (let i = 0; i < 6; i++) { const sx = -130 * s + i * 45 * s; g.beginPath(); g.moveTo(sx, -228 * s + Math.abs(i - 2.5) * 6 * s); g.lineTo(sx + 18 * s, -280 * s + Math.abs(i - 2.5) * 10 * s); g.lineTo(sx + 36 * s, -228 * s + Math.abs(i - 2.5) * 6 * s); g.fill(); }
  // neck + head
  const nx = 120 * s, ny = -300 * s + (roar ? -20 * s : 0) + Math.sin(t * 2) * 6 * s;
  g.strokeStyle = c; g.lineWidth = 60 * s; g.beginPath(); g.moveTo(80 * s, -190 * s); g.quadraticCurveTo(140 * s, -240 * s, nx, ny); g.stroke();
  g.fillStyle = c; roundRect(g, nx - 50 * s, ny - 55 * s, 150 * s, 80 * s, 30 * s); g.fill();
  const jaw = roar ? 30 * s : hurt ? 14 * s : 4 * s; g.fillStyle = shade(c, 0.85); roundRect(g, nx - 30 * s, ny + 10 * s + jaw, 125 * s, 34 * s, 14 * s); g.fill();
  g.fillStyle = "#7a1a1a"; if (jaw > 6 * s) g.fillRect(nx - 20 * s, ny + 20 * s, 110 * s, jaw); g.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(nx + (i * 22) * s, ny + 22 * s); g.lineTo(nx + (i * 22 + 8) * s, ny + 34 * s); g.lineTo(nx + (i * 22 + 16) * s, ny + 22 * s); g.fill(); }
  g.fillStyle = shade(c, 0.55); for (const hx of [-30, 0]) { g.beginPath(); g.moveTo(nx + hx * s, ny - 45 * s); g.lineTo(nx + (hx - 30) * s, ny - 100 * s); g.lineTo(nx + (hx + 14) * s, ny - 50 * s); g.fill(); }
  // eye (big + sad when it wants to be friends)
  const sad = A.face === "sad", happy = A.face === "happy";
  g.fillStyle = "#fff"; g.beginPath(); g.arc(nx + 40 * s, ny - 18 * s, (sad ? 22 : 16) * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = hurt ? "#1a1a1a" : L.eye || "#ff7a1a"; if (hurt) { g.lineWidth = 4 * s; g.strokeStyle = "#1a1a1a"; g.beginPath(); g.moveTo(nx + 30 * s, ny - 28 * s); g.lineTo(nx + 50 * s, ny - 8 * s); g.moveTo(nx + 50 * s, ny - 28 * s); g.lineTo(nx + 30 * s, ny - 8 * s); g.stroke(); }
  else if (happy) { g.lineWidth = 5 * s; g.strokeStyle = "#1a1a1a"; g.beginPath(); g.arc(nx + 40 * s, ny - 12 * s, 12 * s, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  else { g.beginPath(); g.ellipse(nx + 44 * s, ny - 18 * s, (sad ? 14 : 7) * s, (sad ? 16 : 13) * s, 0, 0, Math.PI * 2); g.fill(); if (sad) { g.fillStyle = "#fff"; g.beginPath(); g.arc(nx + 48 * s, ny - 24 * s, 5 * s, 0, Math.PI * 2); g.fill(); } }
  if (!sad && !happy && !hurt) { g.strokeStyle = "#1a1a1a"; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(nx + 20 * s, ny - 40 * s); g.lineTo(nx + 62 * s, ny - 30 * s); g.stroke(); }
  g.fillStyle = "#1a1a1a"; g.beginPath(); g.arc(nx + 92 * s, ny - 22 * s, 4 * s, 0, Math.PI * 2); g.fill();
  g.restore();
  // fire breath comes out of its mouth (world space)
  A.mouth = { x: x + f * (nx + 100 * s), y: y + ny + 16 * s };
}
function drawProj(g, p) {
  const k = clamp(p.age / p.d, 0, 1), x = lerp(p.x0, p.x1, k), y = lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * p.arc, s = p.size;
  g.save(); g.translate(x, y);
  if (p.kind === "fireball") { g.shadowColor = "#ff7a1a"; g.shadowBlur = 40; g.fillStyle = "#ffcf4a"; g.beginPath(); g.arc(0, 0, 26 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#ff5a1a"; for (let i = 1; i < 5; i++) { g.globalAlpha = 0.6 - i * 0.12; g.beginPath(); g.arc(-(p.x1 - p.x0 > 0 ? 1 : -1) * i * 22 * s, Math.sin(p.age * 20 + i) * 6, (26 - i * 4) * s, 0, Math.PI * 2); g.fill(); } }
  else if (p.kind === "energy") { g.shadowColor = p.color || "#3ad0ff"; g.shadowBlur = 50; g.fillStyle = p.color || "#3ad0ff"; g.beginPath(); g.arc(0, 0, 34 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, 18 * s, 0, Math.PI * 2); g.fill(); }
  else if (p.kind === "shuriken") { g.rotate(p.age * 30); g.fillStyle = "#c8ccd2"; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -6); g.lineTo(26 * s, 0); g.lineTo(0, 6); g.fill(); } g.fillStyle = "#333"; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill(); }
  else if (p.kind === "fist") { g.scale(p.x1 > p.x0 ? 1 : -1, 1); g.fillStyle = "#b8c0c8"; roundRect(g, -30 * s, -22 * s, 54 * s, 44 * s, 14 * s); g.fill(); g.fillStyle = "#ff7a1a"; g.beginPath(); g.moveTo(-30 * s, -12 * s); g.lineTo(-70 * s - Math.random() * 20, 0); g.lineTo(-30 * s, 12 * s); g.fill(); }
  else if (p.kind === "pie") { g.rotate(p.age * 8); g.fillStyle = "#c8903a"; g.beginPath(); g.ellipse(0, 0, 32 * s, 14 * s, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff8f0"; g.beginPath(); g.ellipse(0, -6 * s, 28 * s, 10 * s, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e0203a"; g.beginPath(); g.arc(0, -12 * s, 5 * s, 0, Math.PI * 2); g.fill(); }
  else if (p.kind === "yarn") { g.rotate(p.age * 12); g.fillStyle = "#ff5ad8"; g.beginPath(); g.arc(0, 0, 22 * s, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#c0308a"; g.lineWidth = 3; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 8, 0, 18 * s, -1, 1); g.stroke(); } }
  else if (p.kind === "tomato") { g.fillStyle = "#e0302a"; g.beginPath(); g.arc(0, 0, 18 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#3aa04a"; g.fillRect(-4, -22 * s, 8, 8); }
  else if (p.kind === "noodles") { g.rotate(p.age * 6); g.strokeStyle = "#f4d88a"; g.lineWidth = 5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-30, -10 + i * 4); g.bezierCurveTo(-10, -30 + i * 6, 10, 20 - i * 6, 30, -6 + i * 4); g.stroke(); } }
  else if (p.kind === "asteroid") { g.rotate(p.age * 3); g.fillStyle = "#6a5a4a"; g.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = (60 + (i % 3) * 12) * s; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.fillStyle = "#4a3e32"; g.beginPath(); g.arc(14, -10, 14 * s, 0, Math.PI * 2); g.fill(); }
  else if (p.kind === "meatball") { g.rotate(p.age * 4); g.fillStyle = "#7a3a1a"; g.beginPath(); g.arc(0, 0, 70 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e0302a"; g.beginPath(); g.arc(-10, -30, 40 * s, 0, Math.PI); g.fill(); }
  else if (p.kind === "cookie") { g.rotate(p.age * 5); g.fillStyle = "#c8903a"; g.beginPath(); g.arc(0, 0, 18 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#3a2010"; for (const [a, b] of [[-6, -4], [5, 2], [-2, 7]]) { g.beginPath(); g.arc(a, b, 3, 0, Math.PI * 2); g.fill(); } }
  g.restore();
}
function drawFx(g, f, M) {
  const k = f.age / f.life;
  g.save();
  if (f.kind === "pow") { const sc = f.s * (k < 0.2 ? easeOut(k / 0.2) * 1.2 : 1.2 - 0.2 * k); g.translate(f.x, f.y); g.rotate(f.rot); g.scale(sc, sc); g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; g.fillStyle = "#ffd23a"; g.strokeStyle = "#e0302a"; g.lineWidth = 6; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 46 : 80; g.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); if (f.word) { g.font = "900 40px 'Russo One', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 7; g.strokeStyle = "#1a1a1a"; g.strokeText(f.word, 0, 2); g.fillStyle = "#e0302a"; g.fillText(f.word, 0, 2); } }
  else if (f.kind === "spark") { g.strokeStyle = f.c; g.lineWidth = 4; g.globalAlpha = 1 - k; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x - f.vx * 0.04, f.y - f.vy * 0.04); g.stroke(); }
  else if (f.kind === "debris" || f.kind === "conf") { g.fillStyle = f.c; g.globalAlpha = 1 - k * k; g.translate(f.x, f.y); g.rotate(f.age * (f.spin || 8)); g.fillRect(-f.r / 2, -f.r / (f.kind === "conf" ? 4 : 2), f.r, f.kind === "conf" ? f.r / 2 : f.r); }
  else if (f.kind === "puff") { g.globalAlpha = 1; g.fillStyle = f.c + (0.6 * (1 - k)).toFixed(2) + ")"; g.beginPath(); g.arc(f.x, f.y, f.r * (1 + k), 0, Math.PI * 2); g.fill(); }
  else if (f.kind === "ball") { const r = f.r * easeOut(k * 1.6); const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); gr.addColorStop(0, `rgba(255,255,220,${1 - k})`); gr.addColorStop(0.4, `rgba(255,190,60,${1 - k})`); gr.addColorStop(0.75, `rgba(230,70,20,${(1 - k) * 0.9})`); gr.addColorStop(1, "rgba(60,30,20,0)"); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.fill(); }
  else if (f.kind === "slash") { g.translate(f.x, f.y); g.scale(f.dir * f.s, f.s); g.globalAlpha = 1 - k; g.strokeStyle = f.c; g.shadowColor = f.c; g.shadowBlur = 20; g.lineWidth = 14 * (1 - k) + 2; g.beginPath(); g.arc(0, 0, 110, -1.6 + k * 0.5, 0.9 + k * 0.5); g.stroke(); }
  else if (f.kind === "beam") { g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1; g.shadowColor = f.c; g.shadowBlur = 30; g.strokeStyle = f.c; g.lineCap = "round"; g.lineWidth = f.w * (1 + Math.sin(f.age * 60) * 0.15); g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke(); g.strokeStyle = "#fff"; g.lineWidth = f.w * 0.4; g.stroke(); }
  else if (f.kind === "fire") { for (let i = 0; i < 26; i++) { const q = ((i / 26) + f.age * 1.6) % 1, x = lerp(f.x, f.x2, q) + Math.sin(i * 7 + f.age * 20) * 20 * q, y = lerp(f.y, f.y2, q) + Math.cos(i * 5 + f.age * 18) * 26 * q; g.globalAlpha = (1 - q) * (k > 0.85 ? (1 - k) / 0.15 : 1); g.fillStyle = q < 0.3 ? "#fff3a0" : q < 0.6 ? "#ffb02a" : "#ff4a1a"; g.beginPath(); g.arc(x, y, 18 + q * 60, 0, Math.PI * 2); g.fill(); } }
  else if (f.kind === "stars") { const A = M.actors[f.who]; if (A) { const cx = A.x, cy = A.y - (A.ko ? 60 : 200) * A.s - A.air; for (let i = 0; i < 4; i++) { const a = M.t * 4 + i * Math.PI / 2; star(g, cx + Math.cos(a) * 50, cy + Math.sin(a) * 14, 12, i % 2 ? "#ffd23a" : "#fff"); } } }
  else if (f.kind === "twinkle") { g.globalAlpha = 1 - k; star(g, f.x, f.y, 10 + Math.sin(k * 20) * 8, "#fff"); }
  else if (f.kind === "bolt") { let rs = f.seed * 1000; const r = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280); g.strokeStyle = "#e8f6ff"; g.shadowColor = "#7ad0ff"; g.shadowBlur = 30; g.lineWidth = 8; g.globalAlpha = 1 - k; g.beginPath(); let x = f.x + (r() - 0.5) * 200, y = 0; g.moveTo(x, y); while (y < f.y) { x += (r() - 0.5) * 80; y += 40 + r() * 40; g.lineTo(x, Math.min(y, f.y)); } g.stroke(); }
  else if (f.kind === "heart") { g.globalAlpha = 1 - k; g.fillStyle = "#ff4a7a"; g.translate(f.x, f.y); g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-22, -8, -10, -24, 0, -12); g.bezierCurveTo(10, -24, 22, -8, 0, 8); g.fill(); }
  else if (f.kind === "text") { g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1; g.font = `900 ${f.size}px 'Russo One', Impact, sans-serif`; g.textAlign = "center"; g.lineWidth = 8; g.strokeStyle = "#000"; g.strokeText(f.text, f.x, f.y - k * 30); g.fillStyle = f.c; g.fillText(f.text, f.x, f.y - k * 30); }
  else if (f.kind === "speed") { g.globalAlpha = 0.55 * (1 - k); g.strokeStyle = "#fff"; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2 + f.age, r1 = 260 + ((i * 97) % 100), r2 = 900; g.lineWidth = 2 + (i % 3) * 2; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); g.lineTo(W / 2 + Math.cos(a) * r2, H / 2 + Math.sin(a) * r2); g.stroke(); } }
  g.restore();
}
function star(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
function drawBubble(g, A, M) {
  const s = A.s, x = A.x + A.facing * 30, y = A.y - (A.look.kind === "dragon" ? 430 : 230) * s - A.air;
  g.font = "bold 26px Inter, Arial, sans-serif"; const words = A.sayText.split(" "), lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).length > 22 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; } lines.push(cur);
  const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 36, bh = lines.length * 32 + 22;
  g.fillStyle = "#fff"; g.strokeStyle = "#1a1a1a"; g.lineWidth = 4; roundRect(g, x - bw / 2, y - bh, bw, bh, 18); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 14, y - 2); g.lineTo(A.x, y + 30); g.lineTo(x + 14, y - 2); g.fill(); g.beginPath(); g.moveTo(x - 14, y); g.lineTo(A.x, y + 30); g.lineTo(x + 14, y); g.stroke();
  g.fillStyle = "#1a1a1a"; g.textAlign = "center"; g.textBaseline = "middle"; lines.forEach((l, i) => g.fillText(l, x, y - bh + 26 + i * 32));
}
function drawTitle(g, T, k) {
  const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1, sc = 0.8 + 0.2 * easeOut(k / 0.2);
  g.save(); g.globalAlpha = a; g.translate(W / 2, T.y ?? H / 2 - 30); g.scale(sc, sc);
  g.font = `900 ${T.size}px 'Russo One', Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = T.size / 9; g.strokeStyle = "#1a1a1a"; g.lineJoin = "round";
  g.strokeText(T.text, 0, 0); const gr = g.createLinearGradient(0, -T.size / 2, 0, T.size / 2); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.5, T.color); gr.addColorStop(1, shade(T.color.length === 7 ? T.color : "#ffd23a", 0.6)); g.fillStyle = gr; g.fillText(T.text, 0, 0);
  if (T.sub) { g.font = "bold 34px Inter, Arial, sans-serif"; g.lineWidth = 6; g.strokeText(T.sub, 0, T.size * 0.75); g.fillStyle = "#fff"; g.fillText(T.sub, 0, T.size * 0.75); }
  g.restore();
}
export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------------------------------------------------------------- backgrounds (drawn in screen space with a little parallax)
const par = (c, k) => -(c.x - W / 2) * k;
function sky(g, top, bot) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
let seedR = 1; const sr = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const BACKGROUNDS = {
  city(g, t, c) {
    sky(g, "#0a0f2a", "#3a2a5a"); g.fillStyle = "#fff8d0"; g.beginPath(); g.arc(980 + par(c, 0.05), 150, 70, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + sr(i) * 0.7})`; g.fillRect((sr(i) * W * 1.2 + par(c, 0.02)) % W, sr(i + 9) * 300, 2, 2); }
    for (let layer = 0; layer < 2; layer++) { const k = layer ? 0.35 : 0.15, base = layer ? 560 : 500; g.fillStyle = layer ? "#1a1430" : "#2a2048"; for (let i = -2; i < 14; i++) { const bw = 90 + sr(i + layer * 40) * 90, bh = 150 + sr(i * 3 + layer) * 250, bx = i * 130 + par(c, k); g.fillRect(bx, base - bh, bw, bh + 300); g.fillStyle = "rgba(255,220,120,0.55)"; for (let wy = base - bh + 20; wy < base; wy += 30) for (let wx = bx + 10; wx < bx + bw - 14; wx += 24) if (sr(wx * 7 + wy) > 0.5) g.fillRect(wx, wy, 10, 14); g.fillStyle = layer ? "#1a1430" : "#2a2048"; } }
  },
  dojo(g, t, c) {
    sky(g, "#f0dcb0", "#d8b880"); const p = par(c, 0.4);
    g.fillStyle = "#8a5a2a"; for (let i = -1; i < 12; i++) g.fillRect(i * 160 + p % 160, 0, 18, H);
    g.fillStyle = "rgba(255,250,235,0.85)"; for (let i = -1; i < 12; i++) for (let j = 0; j < 3; j++) g.fillRect(i * 160 + 24 + p % 160, 60 + j * 150, 130, 130);
    g.strokeStyle = "#8a5a2a"; g.lineWidth = 3; for (let i = -1; i < 12; i++) for (let j = 0; j < 3; j++) { g.strokeRect(i * 160 + 24 + p % 160, 60 + j * 150, 130, 130); }
    for (let i = 0; i < 4; i++) { const lx = 200 + i * 300 + p * 0.5, ly = 90 + Math.sin(t * 1.5 + i) * 6; g.fillStyle = "#e0302a"; g.beginPath(); g.ellipse(lx, ly, 34, 44, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,200,80,0.35)"; g.beginPath(); g.arc(lx, ly, 70, 0, Math.PI * 2); g.fill(); }
  },
  space(g, t, c) {
    g.fillStyle = "#05030f"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + sr(i) * 0.7})`; const s = sr(i + 3) < 0.1 ? 3 : 1.5; g.fillRect(((sr(i) * W * 1.3 + par(c, 0.03) - t * 6 * sr(i + 1)) % W + W) % W, sr(i + 9) * H, s, s); }
    const pg = g.createRadialGradient(1000 + par(c, 0.08), 180, 20, 1000 + par(c, 0.08), 180, 160); pg.addColorStop(0, "#ff9aea"); pg.addColorStop(1, "#5a1a8a"); g.fillStyle = pg; g.beginPath(); g.arc(1000 + par(c, 0.08), 180, 150, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,200,255,0.6)"; g.lineWidth = 8; g.beginPath(); g.ellipse(1000 + par(c, 0.08), 180, 240, 40, -0.3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(120,80,200,0.25)"; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(300 + i * 250 + par(c, 0.05), 250 + i * 40, 300, 80, 0.3, 0, Math.PI * 2); g.fill(); }
    // the alien crowd in the stands
    for (let i = 0; i < 26; i++) { const x = i * 52 + par(c, 0.25) % 52, y = 470 + Math.abs(Math.sin(t * 6 + i)) * -8 * (sr(i) > 0.5 ? 1 : 0); g.fillStyle = ["#7be03a", "#3ad0ff", "#ff7ad8", "#ffd23a"][i % 4]; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = "#000"; g.fillRect(x - 6, y - 4, 4, 5); g.fillRect(x + 2, y - 4, 4, 5); }
    g.fillStyle = "#2a2440"; g.fillRect(0, 480, W, 40);
  },
  desert(g, t, c) {
    sky(g, "#ff9a5a", "#ffd88a"); g.fillStyle = "#fff0b0"; g.beginPath(); g.arc(300 + par(c, 0.05), 200, 80, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c86a3a"; g.beginPath(); g.moveTo(0, 460); for (let x = 0; x <= W; x += 80) g.lineTo(x + par(c, 0.15) % 80, 360 + sr(x) * 80); g.lineTo(W, 600); g.lineTo(0, 600); g.fill();
    // the saloon
    const sx = 760 + par(c, 0.45); g.fillStyle = "#8a5a2a"; g.fillRect(sx, 240, 420, 360); g.fillStyle = "#6a4020"; g.fillRect(sx - 20, 200, 460, 70); g.fillStyle = "#ffd88a"; g.font = "900 44px 'Rye', 'Russo One', serif"; g.textAlign = "center"; g.fillText("SALOON", sx + 210, 248);
    g.fillStyle = "#3a2010"; for (const wx of [40, 300]) g.fillRect(sx + wx, 320, 80, 90); g.fillStyle = "#6a4020"; g.fillRect(sx + 160, 400, 100, 200); g.fillStyle = "#c89a5a"; g.fillRect(sx + 165, 430, 42, 90); g.fillRect(sx + 213, 430, 42, 90);
    g.fillStyle = "#3aa04a"; const cx = 150 + par(c, 0.5); g.fillRect(cx, 420, 26, 180); g.fillRect(cx - 40, 470, 40, 18); g.fillRect(cx - 40, 430, 18, 50); g.fillRect(cx + 26, 450, 40, 18); g.fillRect(cx + 48, 410, 18, 50);
    // a tumbleweed rolls by
    const tw = ((t * 160) % (W + 400)) - 200; g.strokeStyle = "#a8803a"; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(tw, 570, 26, i + t * 6, i + t * 6 + 2); g.stroke(); }
  },
  volcano(g, t, c) {
    sky(g, "#2a0a0a", "#a02a0a"); const p = par(c, 0.12);
    g.fillStyle = "#3a1a10"; g.beginPath(); g.moveTo(200 + p, 600); g.lineTo(560 + p, 150); g.lineTo(720 + p, 150); g.lineTo(1100 + p, 600); g.fill();
    g.fillStyle = "#ff7a1a"; g.beginPath(); g.moveTo(560 + p, 150); g.lineTo(720 + p, 150); g.lineTo(700 + p, 190); g.lineTo(600 + p, 210); g.fill();
    for (let i = 0; i < 4; i++) { const y = 150 + ((t * 60 + i * 120) % 400); g.fillStyle = "#ff9a2a"; g.fillRect(600 + p + Math.sin(i * 3) * 30, y, 14, 60); }
    g.fillStyle = "rgba(80,40,40,0.6)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(640 + p + Math.sin(t + i) * 40, 120 - ((t * 30 + i * 40) % 200), 40 + i * 10, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = (sr(i) * W + t * 30 * (sr(i + 1) - 0.5)) % W, y = H - ((t * 80 * (0.5 + sr(i + 2)) + sr(i + 3) * H) % H); g.fillStyle = "#ffb02a"; g.fillRect(x, y, 3, 3); }
  },
  kitchen(g, t, c) {
    const p = par(c, 0.35); g.fillStyle = "#f6f0e2"; g.fillRect(0, 0, W, H);
    for (let y = 0; y < 420; y += 40) for (let x = -40; x < W + 40; x += 40) { g.fillStyle = (x / 40 + y / 40) % 2 ? "#e8f4ff" : "#ffffff"; g.fillRect(x + p % 40, y, 40, 40); }
    g.fillStyle = "#c8ccd2"; g.fillRect(0, 380, W, 50); g.fillStyle = "#8a5a2a"; g.fillRect(0, 430, W, 180);
    for (let i = 0; i < 5; i++) { const x = 100 + i * 260 + p; g.fillStyle = "#555"; g.fillRect(x, 330, 120, 50); g.fillStyle = "#e0302a"; g.beginPath(); g.ellipse(x + 60, 330, 60, 10, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(x + 60 + Math.sin(t * 2 + i) * 10, 300 - ((t * 30 + i * 20) % 80), 16, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#ffd23a"; g.font = "900 46px 'Russo One', sans-serif"; g.textAlign = "center"; g.fillText("🍝 CHEF BATTLE ARENA 🍝", W / 2 + p * 0.4, 110);
  },
};
BACKGROUNDS.city.ground = (g, t, c) => { g.fillStyle = "#2a2a34"; g.fillRect(-2000, 600, 6000, 400); g.fillStyle = "#3a3a46"; g.fillRect(-2000, 596, 6000, 10); for (let x = -2000; x < 4000; x += 300) { g.fillStyle = "#4a4a58"; g.fillRect(x, 560, 40, 40); } };
BACKGROUNDS.dojo.ground = (g) => { g.fillStyle = "#c8945a"; g.fillRect(-2000, 600, 6000, 400); g.strokeStyle = "#a8743a"; g.lineWidth = 3; for (let x = -2000; x < 4000; x += 120) { g.beginPath(); g.moveTo(x, 600); g.lineTo(x - 60, 760); g.stroke(); } };
BACKGROUNDS.space.ground = (g) => { g.fillStyle = "#4a4a68"; g.fillRect(-2000, 600, 6000, 400); g.fillStyle = "#3ad0ff"; g.fillRect(-2000, 600, 6000, 6); for (let x = -2000; x < 4000; x += 160) { g.fillStyle = "#5a5a80"; g.fillRect(x, 620, 100, 20); } };
BACKGROUNDS.desert.ground = (g) => { g.fillStyle = "#e8b86a"; g.fillRect(-2000, 600, 6000, 400); g.fillStyle = "#d8a050"; for (let x = -2000; x < 4000; x += 90) g.fillRect(x, 640 + (x % 3) * 20, 40, 6); };
BACKGROUNDS.volcano.ground = (g, t) => { g.fillStyle = "#2a1a14"; g.fillRect(-2000, 600, 6000, 400); g.fillStyle = "#ff5a1a"; for (let x = -2000; x < 4000; x += 230) { g.globalAlpha = 0.6 + Math.sin(t * 3 + x) * 0.3; g.fillRect(x, 640, 120, 10); } g.globalAlpha = 1; };
BACKGROUNDS.kitchen.ground = (g) => { for (let x = -2000; x < 4000; x += 80) for (let y = 600; y < 1000; y += 80) { g.fillStyle = ((x + y) / 80) % 2 ? "#1a1a1a" : "#f2f2f2"; g.fillRect(x, y, 80, 80); } };

// ---------------------------------------------------------------- writing a movie: a Script keeps a time cursor
export class Script {
  constructor() { this.t = 0; this.ev = []; }
  at(t) { this.t = t; return this; }
  wait(d) { this.t += d; return this; }
  e(type, o = {}) { this.ev.push({ t: this.t, type, ...o }); return this; }
  show(who, x, facing = 1, base = "idle", y) { return this.e("show", { who, x, facing, base, y }); }
  hide(who) { return this.e("hide", { who }); }
  face(who, dir) { return this.e("face", { who, dir }); }
  base(who, b) { return this.e("base", { who, base: b }); }
  move(who, x, d, anim = "run", y) { return this.e("move", { who, x, d, anim, y }); }
  walk(who, x, d) { return this.move(who, x, d, "walk"); }
  jump(who, x, d, h = 200, flip = 0, pose, o = {}) { this.e("jump", { who, x, d, h, flip, pose, ...o }); return this.e("sfx", { name: "jump" }); }
  look(who, v) { return this.e("look", { who, v }); }
  act(who, pose, d = 0.4, hold) { return this.e("act", { who, pose, d, hold }); }
  hit(who, dir, power = 1, sound, word) { return this.e("hit", { who, dir, power, sound, word }); }
  ko(who, dir, power = 1, sky = false) { return this.e("ko", { who, dir, power, sky }); }
  up(who) { return this.e("up", { who }); }
  say(who, text, d = 2.4, silent = false) { return this.e("say", { who, text, d, silent }); }
  mood(who, face) { return this.e("face2", { who, face }); }
  sfx(name) { return this.e("sfx", { name }); }
  cam(z, x, y, d = 0.6) { return this.e("cam", { z, x, y, d }); }
  shake(a) { return this.e("shake", { a }); }
  flash(color) { return this.e("flash", { color }); }
  slow(f, d) { return this.e("slow", { f, d }); }
  title(text, d = 2.5, sub, color, size, y) { return this.e("title", { text, d, sub, color, size, y }); }
  fx(kind, o = {}) { return this.e("fx", { kind, ...o }); }
  proj(kind, from, to, d, o = {}) { return this.e("proj", { kind, from, to, d, ...o }); }
  glow(who, v) { return this.e("glow", { who, v }); }
  // a flurry: a hits b n times (alternating fists), b gets knocked back a little each time
  combo(a, b, n = 3, gap = 0.3, dir = 1) { for (let i = 0; i < n; i++) { this.act(a, i % 2 ? "punch2" : "punch", gap * 1.1); this.wait(gap * 0.4); this.hit(b, dir, 0.45 + (i === n - 1 ? 0.6 : 0)); this.wait(gap * 0.6); } return this; }
  // a and b clash weapons: sparks between them
  clash(a, b, x, y, n = 3, gap = 0.35, sound = "clang") { for (let i = 0; i < n; i++) { this.act(a, "slash", gap); this.act(b, "block", gap); this.wait(gap * 0.45); this.sfx(sound); this.fx("slash", { x, y: y - 20, dir: i % 2 ? -1 : 1, s: 0.8 }); this.fx("sparks", { x, y }); this.wait(gap * 0.55); [a, b] = [b, a]; } return this; }
  get events() { return this.ev; }
}
