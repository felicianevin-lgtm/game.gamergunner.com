// TURBO DASH track generator: pure logic (no three.js), so it can be tested in Node too.
// The track is a list of "patterns" (templates). Every pattern is built so it can always be survived:
// there is always a free lane, a ramp, a jump or a slide, and patterns are spaced by how fast you go.
// Track coordinates: z = meters along the track (the runner is at z = distance), lanes 0 / 1 / 2 (left / middle / right).
export const LANES = [-2.4, 0, 2.4];
export const TILE = 4;
export const TRAIN_TOP = 3.0, CRATE_TOP = 2.2, BARRIER_TOP = 1.0, BAR_LOW = 1.25, BAR_TOP = 4.6;
export const POWERS = ["magnet", "shield", "jetpack", "x2", "sneakers"];
export const THEME_LEN = 1000;
export const themeAt = (z) => Math.floor(Math.max(0, z) / THEME_LEN) % 4;
// Speed only depends on distance (so the generator knows how much room to leave).
export function speedAt(d) { return Math.min(31, 13 + 18 * (1 - Math.exp(-Math.max(0, d) / 2000))); }
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clampL = (l) => Math.max(0, Math.min(2, l));

export class Gen {
  constructor(seed) {
    this.r = rng(seed);
    this.objs = []; this.coins = []; this.powers = [];
    this.z = 34; this.id = 0; this.nextPower = 170 + this.r() * 80; this.last = ""; this.last2 = "";
    this.coinLine(1, 10, 30);
  }
  ri(n) { return Math.floor(this.r() * n); }
  pick(a) { return a[this.ri(a.length)]; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  add(o) { o.id = ++this.id; o.dead = false; this.objs.push(o); return o; }
  box(lane, z0, z1, top, look, extra) { return this.add({ kind: "box", lane, z0, z1, top, look, ...extra }); }
  bar(lane, z0) { return this.add({ kind: "bar", lane, z0, z1: z0 + 0.6, top: BAR_TOP, look: "bar" }); }
  ramp(lane, z0, len, h) { return this.add({ kind: "ramp", lane, z0, z1: z0 + len, h, look: "ramp" }); }
  gap(z0, z1) { return this.add({ kind: "gap", lane: -1, z0, z1, look: "gap" }); }
  coin(lane, z, y = 0.9) { this.coins.push({ lane, x: LANES[lane], z, y, got: false, fly: false }); }
  coinLine(lane, z0, z1, step = 2.6, y = 0.9) { for (let z = z0; z <= z1 + 0.01; z += step) this.coin(lane, z, y); }
  coinArc(lane, zc, half = 5.5, h = 1.9, base = 0.9) { for (let i = -3; i <= 3; i++) { const t = (i / 3) * half; this.coin(lane, zc + t, base + h * (1 - (t / half) ** 2)); } }
  power(lane, z, type) { this.powers.push({ lane, x: LANES[lane], z, y: 1.3, type, got: false }); }
  powerType() { const w = [["magnet", 30], ["shield", 20], ["jetpack", 16], ["x2", 18], ["sneakers", 16]]; let t = this.r() * 100; for (const [k, v] of w) { if ((t -= v) < 0) return k; } return "magnet"; }

  fill(until) { while (this.z < until) this.next(); }
  next() {
    const nO = this.objs.length, nC = this.coins.length;
    const z0 = this.z, s = speedAt(z0), diff = Math.min(1, z0 / 3000);
    const gapLen = (s * 0.6 + 6) * (1.1 + this.r() * 0.5) + (1 - diff) * 8;
    const start = z0 + gapLen;
    let res, name;
    if (start > this.nextPower) { name = "power"; res = this.tPower(start, s, diff); this.nextPower = start + 260 + this.r() * 220; }
    else {
      const T = [["barriers", 3], ["mixed", z0 > 150 ? 1 + 2 * diff : 0], ["trains", z0 > 60 ? 3 : 0], ["gap", z0 > 250 ? 1.2 : 0],
        ["oncoming", z0 > 450 ? 0.6 + 1.4 * diff : 0], ["slalom", z0 > 350 ? 0.6 + 1.6 * diff : 0], ["coins", 1.2]]
        .filter(([n]) => !(n === this.last && n === this.last2));
      let tot = T.reduce((a, b) => a + b[1], 0), t = this.r() * tot; name = T[0][0];
      for (const [n, w] of T) { if ((t -= w) < 0) { name = n; break; } }
      res = this["t_" + name](start, s, diff);
    }
    this.last2 = this.last; this.last = name;
    // coins lead the way into the safe lane
    if (this.r() < 0.7 && start - 4 > z0 + 6) this.coinLine(res.safe, Math.max(z0 + 4, start - 22), start - 4);
    this.z = start + res.len;
    // keep both lists sorted (each pattern comes after the one before, so sorting the new part is enough)
    const so = this.objs.splice(nO).sort((a, b) => a.z0 - b.z0); for (const o of so) this.objs.push(o);
    const sc = this.coins.splice(nC).sort((a, b) => a.z - b.z); for (const c of sc) this.coins.push(c);
  }

  t_barriers(z, s, diff) {
    const n = this.r() < 0.35 + diff * 0.3 ? (this.r() < 0.4 ? 3 : 2) : 1;
    const lanes = this.shuffle([0, 1, 2]).slice(0, n);
    for (const l of lanes) this.box(l, z, z + 0.5, BARRIER_TOP, "barrier");
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    let safe, len = 0.5;
    if (free.length && this.r() < 0.5) { safe = this.pick(free); this.coinLine(safe, z - 6, z + 8); }
    else { safe = this.pick(lanes); this.coinArc(safe, z + 0.25); }
    if (diff > 0.15 && this.r() < 0.45) {
      const z2 = z + s * 0.75 + 4, l2 = this.ri(3);
      this.box(l2, z2, z2 + 0.5, BARRIER_TOP, "barrier"); this.coinArc(l2, z2 + 0.25); len = z2 + 0.5 - z;
    }
    return { len, safe };
  }
  t_mixed(z, s, diff) {
    const types = this.pick([["bar", "barrier", null], ["bar", "bar", "barrier"], ["bar", "barrier", "barrier"], ["bar", null, null], ["bar", "bar", null], ["bar", "bar", "bar"]]);
    const lanes = this.shuffle([0, 1, 2]);
    types.forEach((t, i) => { if (t === "bar") this.bar(lanes[i], z); else if (t === "barrier") this.box(lanes[i], z, z + 0.5, BARRIER_TOP, "barrier"); });
    let safe;
    const fi = types.indexOf(null);
    if (fi >= 0) { safe = lanes[fi]; this.coinLine(safe, z - 5, z + 8); }
    else if (types.includes("barrier")) { safe = lanes[types.indexOf("barrier")]; this.coinArc(safe, z + 0.25); }
    else safe = lanes[0];
    const bl = lanes[types.indexOf("bar")]; this.coinLine(bl, z - 3, z + 3.6, 1.6, 0.55); // slide under for coins
    return { len: 0.6, safe };
  }
  t_trains(z, s, diff) {
    const k = diff < 0.12 ? 1 + (this.r() < 0.5 ? 1 : 0) : 1 + this.ri(3);
    const lanes = this.shuffle([0, 1, 2]).slice(0, k);
    const rampI = k === 3 || this.r() < 0.5 ? 0 : -1;
    let end = z, rampLane = -1;
    lanes.forEach((l, i) => {
      const cars = 2 + this.ri(2 + Math.round(diff * 2)), len = cars * 8;
      const tz = z + 8 + (i === rampI ? 0 : this.r() * 6);
      if (i === rampI) {
        rampLane = l; this.ramp(l, z, 8, TRAIN_TOP);
        for (let c = z + 1; c < tz + len - 1; c += 2.6) this.coin(l, c, (c < z + 8 ? ((c - z) / 8) * TRAIN_TOP : TRAIN_TOP) + 0.9);
      }
      this.box(l, tz, tz + len, TRAIN_TOP, "train", { cars });
      end = Math.max(end, tz + len);
    });
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    for (const l of free) {
      if (this.r() < 0.6) this.coinLine(l, z + 2, Math.min(end - 2, z + 30));
      if (k === 2 && end - z > 30 && this.r() < 0.5) { // something to hop over in the corridor
        const oz = z + 14 + this.r() * (end - z - 24);
        if (this.r() < 0.5) this.box(l, oz, oz + 0.5, BARRIER_TOP, "barrier"); else this.bar(l, oz);
      }
    }
    const safe = rampLane >= 0 && (this.r() < 0.6 || !free.length) ? rampLane : free.length ? this.pick(free) : rampLane;
    return { len: end - z, safe };
  }
  t_gap(z, s, diff) {
    const gz = Math.ceil((z + 2) / TILE) * TILE;
    this.gap(gz, gz + TILE);
    const l = this.ri(3); this.coinArc(l, gz + 2, 5.5, 1.6);
    return { len: gz + TILE - z + 3, safe: l };
  }
  t_oncoming(z, s, diff) {
    const n = diff > 0.45 && this.r() < 0.45 ? 2 : 1;
    const lanes = this.shuffle([0, 1, 2]);
    let last = z;
    for (let i = 0; i < n; i++) {
      const meet = z + 8 + i * (s * 0.6 + 4), K = 0.8, VL = 12, X = 50;
      this.box(lanes[i], meet, meet + VL / (1 + K), TRAIN_TOP, "truck", { meet, k: K, vlen: VL, park: X });
      last = meet + X * K + VL + 2; // (the parked truck waits up ahead, so nothing else is put in its way)
    }
    const safe = lanes[2];
    this.coinLine(safe, z - 2, z + 26);
    return { len: last - z, safe };
  }
  t_slalom(z, s, diff) {
    const rows = 3 + (diff > 0.5 ? this.ri(2) : 0), sp = s * 0.5 + 8;
    let f = this.ri(3), zz = z; const safe = f;
    for (let i = 0; i < rows; i++) {
      for (let l = 0; l < 3; l++) if (l !== f) this.box(l, zz, zz + 2, CRATE_TOP, "crate");
      this.coinLine(f, zz - 2.5, zz + 3, 2.2);
      if (i < rows - 1) {
        const nf = clampL(f + this.pick([-1, 1, 1, -1, 0]));
        if (nf !== f) this.coinLine(nf, zz + 6, zz + sp - 4, 2.6);
        f = nf; zz += sp;
      }
    }
    return { len: zz + 2 - z, safe };
  }
  t_coins(z, s, diff) {
    if (this.r() < 0.5) { const l = this.ri(3); this.coinLine(l, z, z + 26); return { len: 26, safe: l }; }
    let l = this.ri(3), zz = z; const safe = l;
    for (let i = 0; i < 3; i++) { this.coinLine(l, zz, zz + 8); zz += 11; l = clampL(l + this.pick([-1, 1])); }
    return { len: zz - z, safe };
  }
  tPower(z, s, diff) {
    const l = this.ri(3);
    this.coinLine(l, z, z + 10); this.power(l, z + 14, this.powerType()); this.coinLine(l, z + 18, z + 28);
    if (diff > 0.1 && this.r() < 0.6) { const o = clampL(l + this.pick([-1, 1])); if (o !== l) this.box(o, z + 14, z + 14.5, BARRIER_TOP, "barrier"); }
    return { len: 30, safe: l };
  }
}
