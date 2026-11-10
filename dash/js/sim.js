// TURBO DASH game rules: the runner, jumping / sliding / lanes, crashes, coins and power-ups.
// Pure logic (no three.js) so it runs in Node for the survivability test. main.js draws it.
import { Gen, LANES, speedAt, BAR_TOP } from "./gen.js";

export const GRAV = 62, JUMP_V = 17.5, SNEAK_V = 23, SLIDE_T = 0.62, JET_Y = 7.5, STEP = 0.45, HALF = 0.3;
export const BASE_DUR = { magnet: 8, x2: 10, jetpack: 5, sneakers: 9, shield: 12 };

export class Sim {
  constructor(seed, opt = {}) {
    this.gen = new Gen(seed); this.gen.fill(260);
    this.dur = opt.dur || BASE_DUR; this.baseMult = opt.mult || 1;
    this.d = 0; this.speed = speedAt(0); this.t = 0;
    this.x = 0; this.lane = 1; this.target = 1; this.from = 1;
    this.y = 0; this.vy = 0; this.onGround = true; this.floor = 0; this.slideT = 0; this.slideQ = false; this.jumpBuf = 0;
    this.pw = { magnet: 0, x2: 0, jetpack: 0, sneakers: 0, shield: 0 };
    this.invuln = 0; this.chaseT = 0; this.stumbleT = 0; this.lastTop = 0;
    this.alive = true; this.deadT = 0; this.cause = ""; this.god = false; this.killer = null;
    this.score = 0; this.coins = 0; this.streak = 0; this.lastCoinT = -9;
    this.stats = { jumps: 0, slides: 0, lanes: 0, coins: 0, tops: 0, powers: 0, jetpacks: 0, shields: 0 };
    this.air = []; // the coin trail in the sky (jetpack)
    this.near = []; this.oi = 0; this.ci = 0;
    this.ev = [];
  }
  get mult() { return this.baseMult * (this.pw.x2 > 0 ? 2 : 1); }
  get sliding() { return this.slideT > 0 && this.onGround; }
  emit(type, a) { this.ev.push({ type, a }); }

  // ---- input
  move(dir) {
    if (!this.alive) return;
    const t = this.target + dir;
    if (t < 0 || t > 2) { this.emit("bonk"); return; }
    this.from = this.target; this.target = t; this.stats.lanes++; this.emit("whoosh", dir);
  }
  setLane(n) { n = Math.max(0, Math.min(2, n | 0)); if (n !== this.target) this.move(Math.sign(n - this.target)); }
  jump() { if (this.alive) this.jumpBuf = 0.16; }
  slide() {
    if (!this.alive || this.pw.jetpack > 0) return;
    if (!this.onGround) { this.vy = Math.min(this.vy, -38); this.slideQ = true; this.jumpBuf = 0; this.emit("dive"); }
    else this.startSlide();
  }
  startSlide() { if (this.slideT <= 0) { this.stats.slides++; this.emit("slide"); } this.slideT = SLIDE_T; this.slideQ = false; this.jumpBuf = 0; }

  // objects around a stretch of track (z0-sorted list, so scan from a moving start index)
  ahead(a, b, out = []) {
    const o = this.gen.objs;
    for (let i = this.oi; i < o.length && o[i].z0 < b; i++) if (o[i].z1 > a) out.push(o[i]);
    return out;
  }
  // the floor height under the runner in a lane (-Infinity = a hole)
  surface(lane, d, y) {
    let g = 0, hole = false, sup = null;
    for (const o of this.near) {
      if (o.z1 < d - HALF || o.z0 > d + HALF || o.dead) continue;
      if (o.kind === "gap") { if (d > o.z0 + 0.35 && d < o.z1 - 0.35) hole = true; continue; }
      if (o.lane !== lane) continue;
      if (o.kind === "ramp") { const h = o.h * Math.min(1, Math.max(0, (d - o.z0) / (o.z1 - o.z0))); if (h > g) g = h; }
      else if (o.kind === "box" && y >= o.top - STEP - 0.01 && o.top > g) { g = o.top; sup = o; }
    }
    this.sup = sup;
    return hole && g === 0 ? -Infinity : g;
  }

  step(dt) {
    if (!this.alive) { this.deadT += dt; return; }
    this.t += dt;
    const s = this.speed = speedAt(this.d);
    this.d += s * dt;
    const d = this.d;
    this.gen.fill(d + 260);
    const O = this.gen.objs;
    while (this.oi < O.length && O[this.oi].z0 < d - 70) this.oi++;
    if (this.oi > 300) { O.splice(0, this.oi); this.oi = 0; }
    this.near.length = 0; this.ahead(d - 2, d + 2, this.near);

    // sideways (snappy, eases into the lane)
    const tx = LANES[this.target], dx = tx - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), Math.max(Math.abs(dx) * 16, 7) * dt);
    this.lane = Math.max(0, Math.min(2, Math.round(this.x / 2.4) + 1));

    // timers
    for (const k in this.pw) if (this.pw[k] > 0) {
      this.pw[k] -= dt;
      if (this.pw[k] <= 0) { this.pw[k] = 0; this.emit("powerEnd", k); if (k === "jetpack") { this.invuln = 1.6; this.vy = 0; this.onGround = false; } }
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.chaseT > 0) this.chaseT -= dt;
    if (this.stumbleT > 0) this.stumbleT -= dt;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;

    // up and down
    const g = this.surface(this.lane, d, this.y);
    const safe = this.god || this.invuln > 0 || this.pw.jetpack > 0;
    const floor = g === -Infinity && safe ? 0 : g;
    this.floor = floor;
    if (this.pw.jetpack > 0) {
      this.y += (JET_Y - this.y) * Math.min(1, dt * 3.5); this.vy = 0; this.onGround = false; this.slideT = 0; this.slideQ = false;
    } else {
      if (this.onGround) {
        if (floor >= this.y - 0.05) this.y = floor; // ramps and little steps
        else { this.onGround = false; if (this.vy > 0) this.vy = 0; }
      }
      if (this.onGround && this.jumpBuf > 0) {
        this.vy = this.pw.sneakers > 0 ? SNEAK_V : JUMP_V; this.onGround = false; this.slideT = 0; this.jumpBuf = 0;
        this.stats.jumps++; this.emit("jump", this.pw.sneakers > 0);
      }
      if (!this.onGround) {
        this.vy -= GRAV * (this.invuln > 0 && this.vy < 0 && this.pw.jetpack <= 0 ? 0.55 : 1) * dt;
        this.y += this.vy * dt;
        if (floor === -Infinity && this.y < -0.4) this.inHole = true;
        if (this.inHole && floor !== -Infinity && this.y < floor - 0.4) { this.die("fell", null); return; } // (hit the wall on the far side of the gap)
        if (this.vy <= 0 && this.y <= floor) {
          this.y = floor; this.vy = 0; this.onGround = true; this.emit("land");
          if (this.slideQ) this.startSlide();
        }
        if (floor === -Infinity && this.y < -2.2) { this.die("fell", null); return; }
      }
      if (this.slideT > 0) this.slideT -= dt;
      if (this.onGround && this.sup && this.sup.top >= 2.9 && this.sup.id !== this.lastTop) { this.lastTop = this.sup.id; this.stats.tops++; }
    }

    // hitting things
    if (this.pw.jetpack <= 0 && this.invuln <= 0 && !this.god) {
      for (const o of this.near) {
        if (o.dead || o.kind === "gap" || o.kind === "ramp") continue;
        if (o.z1 < d - HALF || o.z0 > d + HALF) continue;
        const ox = LANES[o.lane], ax = Math.abs(this.x - ox);
        let hit = false;
        if (o.kind === "box") hit = ax < 1.3 && this.y < o.top - STEP;
        else if (o.kind === "bar") hit = ax < 1.2 && !this.sliding && this.y < BAR_TOP;
        if (!hit) continue;
        const side = o.lane === this.target && this.target !== this.from && ax > 0.5;
        if (side) { if ((o.bumpUntil || 0) > this.t) continue; this.stumble(o); }
        else this.hit(o);
        if (!this.alive) return;
        break;
      }
    }

    // coins
    const cy = this.y + (this.sliding ? 0.45 : 0.9);
    const C = this.gen.coins;
    while (this.ci < C.length && C[this.ci].z < d - 8) this.ci++;
    if (this.ci > 400) { C.splice(0, this.ci); this.ci = 0; }
    for (let i = this.ci; i < C.length && C[i].z < d + 16; i++) this.coinCheck(C[i], d, cy, dt);
    for (const c of this.air) this.coinCheck(c, d, cy, dt);
    if (this.air.length && this.air[0].z < d - 10) this.air = this.air.filter((c) => c.z > d - 10 && !c.got);
    // power-ups
    for (const p of this.gen.powers) {
      if (p.got || p.z < d - 3 || p.z > d + 3) continue;
      if (Math.abs(p.z - d) < 1.1 && Math.abs(p.x - this.x) < 1.1 && Math.abs(p.y - cy) < 1.6) this.power(p);
    }
    if (this.gen.powers.length > 8) this.gen.powers = this.gen.powers.filter((p) => p.z > d - 20);

    this.score += s * dt * this.mult;
  }
  coinCheck(c, d, cy, dt) {
    if (c.got) return;
    if (c.fly) {
      const k = Math.min(1, dt * 14);
      c.z += (d + 0.3 - c.z) * k; c.x += (this.x - c.x) * k; c.y += (cy - c.y) * k;
      if (Math.abs(c.z - d) < 0.8 && Math.abs(c.x - this.x) < 0.8) this.collect(c);
      return;
    }
    if (this.pw.magnet > 0 && c.z < d + 15 && c.z > d - 1) { c.fly = true; return; }
    if (Math.abs(c.z - d) < 0.9 && Math.abs(c.x - this.x) < 1.0 && Math.abs(c.y - cy) < 1.25) this.collect(c);
  }
  collect(c) {
    c.got = true; this.coins++; this.stats.coins++;
    this.streak = this.t - this.lastCoinT < 0.5 ? this.streak + 1 : 0; this.lastCoinT = this.t;
    this.score += 5 * this.mult;
    this.emit("coin", { streak: this.streak, x: c.x, y: c.y, z: c.z });
  }
  power(p) {
    p.got = true; this.stats.powers++;
    this.pw[p.type] = this.dur[p.type];
    if (p.type === "jetpack") {
      this.stats.jetpacks++; this.slideT = 0; this.slideQ = false;
      const len = this.speed * this.dur.jetpack;
      for (let i = 0, z = this.d + 14; z < this.d + len - 8; i++, z += 3) {
        const lane = Math.max(0, Math.min(2, Math.round(1 + Math.sin(i * 0.22) * 1.3)));
        this.air.push({ lane, x: LANES[lane], z, y: JET_Y + 0.9, got: false, fly: false });
      }
    }
    this.emit("power", p.type);
  }
  hit(o) {
    if (this.pw.shield > 0) { this.pw.shield = 0; this.invuln = 1.0; o.dead = true; this.stats.shields++; this.emit("shield", o); return; }
    this.die(o.look, o);
  }
  stumble(o) {
    o.bumpUntil = this.t + 0.5;
    this.target = this.from; this.from = o.lane;
    if (this.chaseT > 0) {
      if (this.pw.shield > 0) { this.pw.shield = 0; this.invuln = 1.0; this.stats.shields++; this.emit("shield", null); this.chaseT = 3; return; }
      this.die("caught", o); return;
    }
    this.chaseT = 5; this.stumbleT = 0.5; this.emit("stumble");
  }
  die(cause, o) { this.alive = false; this.cause = cause; this.killer = o; this.emit("crash", cause); }
}
