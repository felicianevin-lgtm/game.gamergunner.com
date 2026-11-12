// MUD VALLEY RP: races! A dirt motocross track with jumps, a paved speedway and a race up the mountain.
// Computer racers follow the track (slowing down for curves), there's a 3-2-1-GO countdown, checkpoints, laps and prize money.
import * as THREE from "/create/vendor/three.module.js";
import { TRACKS, groundAt } from "./terrain.js";
import { buildCar, animateCar, PAINTS } from "./vehicles.js";
import { G } from "./physics.js";

export const RACES = [
  { id: "moto", name: "Mud Valley Motocross", track: "moto", laps: 3, place: "moto", ai: ["bike", "atv", "buggy", "bike", "atv"], speed: 21, prize: [1500, 800, 400], desc: "3 laps of dirt, jumps and a mud pit! Best with a dirt bike, ATV or buggy." },
  { id: "speedway", name: "Valley Speedway GP", track: "speedway", laps: 3, place: "speedway", ai: ["sports", "sports", "hyper", "sports", "sports"], speed: 38, prize: [2500, 1200, 600], desc: "3 fast laps on smooth pavement. You'll want a sports car!" },
  { id: "summit", name: "Summit Sprint", track: "summit", laps: 1, place: "summit", ai: ["jeep", "buggy", "monster", "atv"], speed: 17, prize: [2000, 1000, 500], desc: "Race up the twisty mountain trail all the way to the top! Off-road rides win here." },
];
export const raceById = (id) => RACES.find((r) => r.id === id);

const NAMES = ["Dusty Dan", "Muddy Max", "Zoom Zoe", "Turbo Tia", "Rocket Ray", "Speedy Sam", "Gravel Gus", "Nitro Nia"];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// a track starting at its start line: arrays + speed limits for the curves
function prepTrack(id) {
  const p = TRACKS[id];
  if (p._prep) return p._prep;
  const n = p.n, st = p.closed ? p.start || 0 : 0;
  const x = [], z = [];
  for (let i = 0; i < n; i++) { const k = (i + st) % n; x.push(p.x[k]); z.push(p.z[k]); }
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]));
  const len = cum[n - 1] + (p.closed ? Math.hypot(x[0] - x[n - 1], z[0] - z[n - 1]) : 0);
  // how fast you can take each curve (1 = full speed)
  const lim = new Array(n).fill(1), at = (i) => (p.closed ? (i + n) % n : clamp(i, 0, n - 1));
  for (let i = 0; i < n; i++) {
    const a = at(i - 3), b = at(i + 3), ax = x[i] - x[a], az = z[i] - z[a], bx = x[b] - x[i], bz = z[b] - z[i];
    const ang = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz)), dd = Math.hypot(ax, az) + Math.hypot(bx, bz);
    const R = dd / Math.max(0.01, ang);
    lim[i] = Math.sqrt(14 * R);
  }
  for (let pass = 0; pass < 3; pass++) for (let i = n - 1; i >= 0; i--) { const j = at(i + 1); const ds = Math.abs(cum[j] - cum[i]) || 3; lim[i] = Math.min(lim[i], Math.sqrt(lim[j] * lim[j] + 2 * 9 * ds)); }
  // checkpoints every ~45 m
  const cps = []; const K = Math.max(4, Math.round(len / 45));
  for (let k = 0; k < K; k++) { const s = (k / K) * len; let i = 0; while (i < n - 1 && cum[i + 1] <= s) i++; cps.push(i); }
  if (!p.closed) cps.push(n - 1);
  p._prep = { x, z, cum, len, n, lim, cps, closed: p.closed, w: p.w };
  return p._prep;
}
// a point along the track at distance s (+ side offset)
function along(T, s, off = 0) {
  s = T.closed ? ((s % T.len) + T.len) % T.len : clamp(s, 0, T.len);
  let lo = 0, hi = T.n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T.cum[m] <= s) lo = m; else hi = m - 1; }
  const i = lo, j = T.closed ? (i + 1) % T.n : Math.min(T.n - 1, i + 1);
  const seg = (j === 0 ? T.len : T.cum[j]) - T.cum[i] || 1, t = clamp((s - T.cum[i]) / seg, 0, 1);
  const x = T.x[i] + (T.x[j] - T.x[i]) * t, z = T.z[i] + (T.z[j] - T.z[i]) * t;
  let tx = T.x[j] - T.x[i], tz = T.z[j] - T.z[i]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
  return { x: x - tz * off, z: z + tx * off, yaw: Math.atan2(tx, tz), i, lim: T.lim[i] };
}
function nearestIdx(T, x, z, guess, win = 40) {
  let bi = guess, bd = 1e18;
  for (let k = -win; k <= win; k++) { const i = T.closed ? (guess + k + T.n) % T.n : clamp(guess + k, 0, T.n - 1); const d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi;
}

export class Race {
  constructor(scene, def, api) {
    this.scene = scene; this.def = def; this.api = api; this.T = prepTrack(def.track);
    this.state = "count"; this.t = -3.5; this.time = 0; this.ais = []; this.results = []; this.done = false;
    this.lap = 0; this.next = 1; this.lastCp = 0; this.pIdx = 0; this.finished = false; this.place = 0;
    const T = this.T, half = T.w / 2 - 1.6;
    // the starting grid: two rows behind the start line
    const grid = [];
    const g0 = T.closed ? -6 : 24;
    for (let k = 0; k <= def.ai.length; k++) grid.push({ s: g0 - Math.floor(k / 2) * 7, off: (k % 2 ? -1 : 1) * Math.min(2.6, half) });
    const pg = grid[grid.length - 1];
    const p0 = along(T, pg.s, pg.off); api.teleport(p0.x, p0.z, p0.yaw);
    const names = NAMES.slice().sort(() => Math.random() - 0.5);
    def.ai.forEach((id, k) => {
      const car = { id, paint: PAINTS[(k * 5 + 3) % PAINTS.length], rims: k % 2 ? "black" : "chrome", tires: "street", engine: 0, limit: 1, lift: 0, neon: k === 2 ? 2 : 0, dirt: 0 };
      const m = buildCar(car); scene.add(m.root);
      const g = grid[k], p = along(T, g.s, g.off);
      this.ais.push({ m, s: g.s, off: g.off, v: 0, skill: 0.86 + Math.random() * 0.1 - k * 0.012, y: groundAt(p.x, p.z), vy: 0, air: false, pitch: 0, yaw: p.yaw, x: p.x, z: p.z, name: names[k], done: false, ftime: 0, steer: 0 });
    });
    // the glowing hoop you drive through next
    this.hoop = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(T.w / 2 + 1.5, 0.35, 8, 40), new THREE.MeshBasicMaterial({ color: 0x6af0ff, transparent: true, opacity: 0.8 }));
    this.hoop.add(ring); this.hoopRing = ring; scene.add(this.hoop);
    this.placeHoop();
  }
  get laps() { return this.def.laps; }
  cpPos(k) { const T = this.T, i = T.cps[k]; return { x: T.x[i], z: T.z[i], i }; }
  placeHoop() {
    const T = this.T, c = this.cpPos(this.next), a = along(T, T.cum[c.i]);
    this.hoop.position.set(c.x, groundAt(c.x, c.z) + T.w / 2 - 1, c.z); this.hoop.rotation.y = a.yaw;
    const last = (!T.closed && this.next === T.cps.length - 1) || (T.closed && this.next === 0 && this.lap === this.laps - 1);
    this.hoopRing.material.color.set(last ? 0xffd23a : T.closed && this.next === 0 ? 0x7aff5a : 0x6af0ff);
  }
  progressOf(x, z) {
    const T = this.T; this.pIdx = nearestIdx(T, x, z, this.pIdx);
    let d = T.cum[this.pIdx] - T.cum[T.cps[this.lastCp]];
    if (T.closed) { if (d > T.len / 2) d -= T.len; if (d < -T.len / 2) d += T.len; }
    return this.lap * T.len + T.cum[T.cps[this.lastCp]] + clamp(d, -40, 70);
  }
  // put the player back on the track at the last checkpoint
  resetPos() { const T = this.T, a = along(T, T.cum[T.cps[this.lastCp]] + 2); return a; }
  update(dt, player) {
    const T = this.T, ev = [];
    this.t += dt;
    if (this.state === "count") {
      const before = Math.ceil(-this.t - dt), now = Math.ceil(-this.t);
      if (now !== before && now > 0 && now <= 3) ev.push({ type: "count", n: now });
      if (this.t >= 0) { this.state = "go"; ev.push({ type: "go" }); }
    } else if (!this.finished) this.time += dt;
    const going = this.state === "go";
    // the player: checkpoints and laps
    if (going && !this.finished) {
      const c = this.cpPos(this.next);
      if (Math.hypot(player.x - c.x, player.z - c.z) < T.w / 2 + 6) {
        this.lastCp = this.next;
        if (T.closed && this.next === 0) {
          this.lap++;
          if (this.lap >= this.laps) this.finishPlayer(ev); else ev.push({ type: "lap", lap: this.lap + 1 });
        } else if (!T.closed && this.next === T.cps.length - 1) this.finishPlayer(ev);
        else ev.push({ type: "cp" });
        this.next = T.closed ? (this.next + 1) % T.cps.length : this.next + 1;
        if (!this.finished) this.placeHoop();
      }
    }
    // the computer racers
    const pp = this.progressOf(player.x, player.z);
    for (const a of this.ais) {
      if (going || a.done) {
        const here = along(T, a.s), ahead = along(T, a.s + 8);
        let target = this.def.speed * a.skill * Math.min(1, Math.min(here.lim, ahead.lim) / this.def.speed);
        const gap = a.s - pp; // + means the AI is ahead of you
        if (!a.done) target *= gap > 25 ? 0.86 : gap < -35 ? 1.12 : 1;
        if (a.done) target *= 0.5;
        if (!a.air) a.v += clamp(target - a.v, -14 * dt, 9 * dt);
        a.s += a.v * dt;
        // drift a little side to side, and dodge the player
        const p = along(T, a.s, a.off);
        const dpx = player.x - p.x, dpz = player.z - p.z;
        if (dpx * dpx + dpz * dpz < 16) a.off += (a.off > 0 ? 1 : -1) * dt * 3;
        a.off = clamp(a.off + Math.sin(this.t * 0.7 + a.skill * 40) * dt * 0.4, -(T.w / 2 - 1.8), T.w / 2 - 1.8);
        a.x = p.x; a.z = p.z;
        let dy = p.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 8); a.steer = clamp(-dy * 3, -1, 1); // (same sign as the player: + = turning right)
        // gravity and jumps
        const gy = groundAt(a.x, a.z);
        if (!a.air) { const free = a.y + (a.vy - G * dt) * dt; if (free > gy + 0.09 && a.vy > 2) { a.air = true; a.y = free; a.vy -= G * dt; } else { a.vy = clamp((gy - a.y) / dt, -12, 16); a.y = gy; } }
        else { a.vy -= G * dt; a.y += a.vy * dt; if (a.y <= gy) { a.y = gy; a.air = false; a.vy = 0; ev.push({ type: "aiLand", a }); } }
        const f = along(T, a.s + 1.8), b = along(T, a.s - 1.8);
        const tp = a.air ? clamp(Math.atan2(a.vy, a.v) * 0.6, -0.5, 0.5) : Math.atan2(groundAt(f.x, f.z) - groundAt(b.x, b.z), 3.6);
        a.pitch += (tp - a.pitch) * Math.min(1, dt * 10);
        if (!a.done && (T.closed ? a.s >= this.laps * T.len : a.s >= T.len)) { a.done = true; a.ftime = this.time; this.results.push({ name: a.name, time: a.ftime, ai: true }); }
      }
      const m = a.m;
      m.root.position.set(a.x, a.y + 0.06, a.z); m.root.rotation.set(-a.pitch, a.yaw, m.id === "bike" ? a.steer * 0.3 : 0, "YXZ");
      animateCar(m, { speed: a.v, steer: a.steer, boost: 0 }, dt);
    }
    // what place are you in?
    let place = 1; for (const a of this.ais) if (a.done ? !this.finished || a.ftime < this.time : a.s > pp) place++;
    this.place = this.finished ? this.finishPlace : place;
    if (this.finished && !this.done) { this.doneT = (this.doneT || 0) + dt; if (this.doneT > 3.5) { this.done = true; ev.push({ type: "results" }); } }
    return ev;
  }
  finishPlayer(ev) {
    this.finished = true; this.finishPlace = this.results.length + 1;
    this.results.push({ name: "YOU", time: this.time, ai: false });
    this.hoop.visible = false;
    ev.push({ type: "finish", place: this.finishPlace, time: this.time });
  }
  // the full list (racers still going get placed by how far they got)
  standings() {
    const out = this.results.slice();
    const left = this.ais.filter((a) => !a.done).sort((a, b) => b.s - a.s);
    for (const a of left) out.push({ name: a.name, time: null, ai: true });
    return out;
  }
  dispose() { for (const a of this.ais) this.scene.remove(a.m.root); this.scene.remove(this.hoop); }
  nextCp() { return this.cpPos(this.next); }
}
