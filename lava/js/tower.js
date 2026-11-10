// LAVA TOWER: the endless tower. Sections are stacked around a square core; each section runs along one side of the
// core (from one corner landing to the next) and is one mini challenge, picked at random and harder the higher you go.
// All platforms are axis-aligned boxes (so collision stays simple and solid).
import * as THREE from "/create/vendor/three.module.js";

export const R = 12;           // the path runs this far from the middle of the tower
export const CORE = 8;         // the core is a square, this far from the middle
export const CHECK_EVERY = 4;  // a checkpoint flag every 4 sections
const CORNERS = [[-R, -R], [R, -R], [R, R], [-R, R]];
const COLORS = [0xff4d6d, 0xff9f1c, 0xffd60a, 0x5bd74a, 0x2ec4f0, 0x4d7cff, 0x9b5de5, 0xff70c8, 0x23d5ab, 0xff6b35];
export const NAMES = {
  jumps: "Jump Path", beams: "Balance Beams", moving: "Moving Platforms", spin: "Spinning Bars", fall: "Falling Tiles",
  vanish: "Blinking Tiles", pads: "Jump Pads", belt: "Conveyor Belts", zig: "Zigzag Climb",
};

// ---------------------------------------------------------------- textures (made in code)
function studTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#e9e9e9"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64);
  g.fillStyle = "#c4c4c4"; g.fillRect(0, 61, 64, 3); g.fillRect(61, 0, 3, 64);
  const grd = g.createRadialGradient(28, 28, 2, 32, 32, 15); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.8, "#f2f2f2"); grd.addColorStop(1, "#bdbdbd");
  g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 13, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function arrowTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#2b2b33"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#ffd60a"; g.beginPath(); g.moveTo(12, 14); g.lineTo(40, 32); g.lineTo(12, 50); g.lineTo(22, 32); g.closePath(); g.fill();
  g.fillStyle = "#3a3a44"; g.fillRect(0, 0, 64, 4); g.fillRect(0, 60, 64, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function padTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, "#fffbd0"); grd.addColorStop(0.45, "#7dff6a"); grd.addColorStop(1, "#159a3a");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#0b6a24"; g.lineWidth = 8;
  for (const y of [40, 68, 96]) { g.beginPath(); g.moveTo(34, y); g.lineTo(64, y - 22); g.lineTo(94, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const TEX = { stud: studTexture(), arrow: arrowTexture(), pad: padTexture() };

const mats = new Map();
export function mat(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : "");
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, map: TEX.stud, roughness: 0.62, metalness: 0.0, ...(extra || {}) }));
  return mats.get(key);
}
// A box whose texture repeats once per metre on every face (so the studs are all the same size).
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const [a, b] = nx > 0.5 ? [d, h] : ny > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, uv.getX(i) * a, uv.getY(i) * b);
  }
  return g;
}

// ---------------------------------------------------------------- random numbers you can repeat (for the thumbnail)
export function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- the challenges (in "side" coordinates)
// u = along the side (0 = start corner, 24 = end corner), v = sideways (+ = away from the core), t = height of the top.
// Each returns { parts, H } where H = how much higher the end corner is than the start.
const U0 = 2.6, U1 = 21.4; // free space between the two corner landings

// Spread platforms (half-length s each, along u) evenly over the side with the gaps in between.
function chain(r, s, gap, rise, vZig, type, extra = {}) {
  const n = Math.max(1, Math.round((U1 - U0 - gap) / (2 * s + gap)));
  const g = (U1 - U0 - n * 2 * s) / (n + 1);
  const parts = []; let t = 0, v = 0;
  for (let i = 0; i < n; i++) {
    t += r.range(rise[0], rise[1]);
    v = vZig ? (i === 0 ? r.range(-vZig, vZig) : Math.max(-2.2, Math.min(2.4, v + r.sign() * r.range(vZig * 0.5, vZig)))) : 0;
    parts.push({ type, u: U0 + g + s + i * (2 * s + g), v, t, su: s, sv: extra.sv || s, sh: extra.sh || 0.35, i, n, ...extra });
  }
  return { parts, H: t + r.range(rise[0], rise[1]) };
}

const GEN = {
  jumps(r, df) {
    const s = lerp(1.35, 0.8, df) * r.range(0.9, 1.1);
    return chain(r, s, lerp(1.9, 3.0, df), [0.3, lerp(0.8, 1.2, df)], 1.6, "plain");
  },
  beams(r, df) {
    const sv = lerp(0.42, 0.26, df), n = df > 0.5 ? 3 : 2, gap = lerp(1.2, 2.0, df), s = (U1 - U0 - gap * (n + 1)) / (2 * n);
    const parts = []; let t = 0, v = r.range(-1, 1);
    for (let i = 0; i < n; i++) {
      t += r.range(0.4, 0.9); v = i ? Math.max(-2, Math.min(2.2, v + r.sign() * r.range(0.8, 1.6))) : v;
      parts.push({ type: "plain", u: U0 + gap + s + i * (2 * s + gap), v, t, su: s, sv, sh: 0.25 });
    }
    return { parts, H: t + r.range(0.4, 0.9) };
  },
  moving(r, df) {
    const parts = [], period = lerp(3.6, 2.4, df), n = 3, gap = 2.2;
    const s = (U1 - U0 - gap * (n + 1)) / (2 * n);
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += r.range(0.3, 0.8);
      const u = U0 + gap + s + i * (2 * s + gap), still = i === 1 && df < 0.6;
      const axis = r.pick(df > 0.3 ? ["v", "v", "y", "u"] : ["v", "y"]);
      parts.push({ type: still ? "plain" : "mover", u, v: 0, t, su: Math.min(s, 1.25), sv: 1.25, sh: 0.3, axis, amp: axis === "y" ? 1.3 : axis === "u" ? 1.1 : lerp(2.2, 2.8, df), period, phase: r() * 6.28 });
    }
    return { parts, H: t + r.range(0.6, 1.0) };
  },
  spin(r, df) {
    const n = df > 0.4 ? 2 : 1, gap = 2.0, s = (U1 - U0 - gap * (n + 1)) / (2 * n), parts = []; let t = 0;
    for (let i = 0; i < n; i++) {
      t += r.range(0.3, 0.8);
      const u = U0 + gap + s + i * (2 * s + gap);
      parts.push({ type: "plain", u, v: 0, t, su: s, sv: 1.7, sh: 0.4, color: 0xe6eaf2 });
      parts.push({ type: "spinner", u, v: 0, t, len: 2.05, speed: lerp(1.5, 2.8, df) * r.sign(), phase: r() * 6.28 });
    }
    return { parts, H: t + r.range(0.5, 0.9) };
  },
  fall(r, df) {
    return chain(r, lerp(1.1, 0.85, df), lerp(1.3, 2.0, df), [0.0, 0.5], 1.4, "fall", { sh: 0.25, delay: lerp(0.6, 0.38, df) });
  },
  vanish(r, df) {
    const c = chain(r, lerp(1.15, 0.9, df), lerp(1.5, 2.2, df), [0.1, 0.7], 1.2, "vanish", { sh: 0.25 });
    const period = lerp(3.4, 2.6, df);
    for (const p of c.parts) { p.period = period; p.phase = (p.i / p.n) * period * 0.6; }
    return c;
  },
  pads(r, df) {
    const parts = [], n = 2, gap = 2.0;
    const s = (U1 - U0 - gap * (2 * n + 1)) / (4 * n);
    let t = 0, u = U0 + gap;
    for (let i = 0; i < n; i++) {
      t += r.range(0, 0.4);
      parts.push({ type: "pad", u: u + s, v: 0, t, su: s, sv: 1.2, sh: 0.35 }); u += 2 * s + gap;
      t += r.range(4.6, 5.6);
      parts.push({ type: "plain", u: u + s, v: 0, t, su: s, sv: 1.4, sh: 0.4 }); u += 2 * s + gap;
    }
    return { parts, H: t + r.range(0.3, 0.8) };
  },
  belt(r, df) {
    const parts = [], n = 2, gap = lerp(1.6, 2.2, df), s = (U1 - U0 - gap * (n + 1)) / (2 * n); let t = 0;
    for (let i = 0; i < n; i++) {
      t += r.range(0.3, 0.8);
      const dir = r.pick(["back", "back", "side"]), sp = lerp(2.6, 4.6, df);
      parts.push({ type: "belt", u: U0 + gap + s + i * (2 * s + gap), v: 0, t, su: s, sv: 1.3, sh: 0.35, bu: dir === "back" ? -sp : 0, bv: dir === "side" ? sp * r.sign() : 0 });
    }
    return { parts, H: t + r.range(0.5, 0.9) };
  },
  zig(r, df) {
    const parts = [], s = lerp(0.8, 0.6, df), n = 7, step = (U1 - U0) / (n + 0.4); let t = 0;
    for (let i = 0; i < n; i++) {
      t += r.range(0.9, lerp(1.1, 1.35, df));
      const wall = i % 2 === 0;
      parts.push({ type: "plain", u: U0 + step * (i + 0.7), v: wall ? -(R - CORE) + s + 0.02 : r.range(0.2, 1.2), t, su: s, sv: s, sh: 0.3, color: wall ? 0xffffff : undefined });
    }
    return { parts, H: t + r.range(0.6, 1.0) };
  },
};
const UNLOCK = [["jumps", 0], ["beams", 1], ["moving", 2], ["spin", 3], ["fall", 3], ["pads", 4], ["belt", 4], ["vanish", 5], ["zig", 5]];

// ---------------------------------------------------------------- the tower
export class Tower {
  constructor(scene, seed) {
    this.scene = scene; this.r = rng(seed); this.sections = []; this.top = 0; this.next = 0; this.last = "";
    this.coreMat = mat(0x4a5272, { roughness: 0.85 });
    this.coreMat2 = mat(0x3d4461, { roughness: 0.85 });
    this.makeBase();
  }
  // The start: a big island at the first corner (this is also checkpoint 0).
  makeBase() {
    const sec = this.newSection(-30, 0, -1);
    const [cx, cz] = CORNERS[0];
    this.addBox(sec, { cx: cx - 1, cy: -15.6, cz: cz - 1, hx: 5, hy: 15, hz: 5 }, mat(0x6b7280), "plain");
    this.addBox(sec, { cx: cx - 1, cy: -0.3, cz: cz - 1, hx: 5.2, hy: 0.3, hz: 5.2 }, mat(0x5bd74a), "plain");
    sec.check = { n: 0, x: cx - 1, y: 0, z: cz - 1, reached: true };
    this.addCore(sec, -40, 0);
    this.sections.push(sec);
  }
  newSection(y0, y1, idx) {
    const group = new THREE.Group(); this.scene.add(group);
    return { idx, y0, y1, group, solids: [], spinners: [], coins: [], movers: [], belts: [], check: null, name: "", geos: [] };
  }
  addCore(sec, y0, y1) {
    const h = y1 - y0; if (h <= 0) return;
    const geo = boxGeo(CORE * 2, h, CORE * 2); sec.geos.push(geo);
    const m = new THREE.Mesh(geo, sec.idx % 2 ? this.coreMat : this.coreMat2); m.position.set(0, (y0 + y1) / 2, 0); sec.group.add(m);
    sec.solids.push({ minX: -CORE, maxX: CORE, minY: y0, maxY: y1, minZ: -CORE, maxZ: CORE, kind: "core", solid: true, dx: 0, dy: 0, dz: 0 });
    // a glowing trim band at the top of each core block
    const tg = boxGeo(CORE * 2 + 0.3, 0.35, CORE * 2 + 0.3); sec.geos.push(tg);
    const trim = new THREE.Mesh(tg, mat(COLORS[(sec.idx + 10) % COLORS.length], { emissive: COLORS[(sec.idx + 10) % COLORS.length], emissiveIntensity: 0.35 }));
    trim.position.set(0, y1 - 0.4, 0); sec.group.add(trim);
  }
  addBox(sec, b, material, kind, extra = {}) {
    const geo = boxGeo(b.hx * 2, b.hy * 2, b.hz * 2); sec.geos.push(geo);
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(b.cx, b.cy, b.cz); sec.group.add(mesh);
    const s = { minX: b.cx - b.hx, maxX: b.cx + b.hx, minY: b.cy - b.hy, maxY: b.cy + b.hy, minZ: b.cz - b.hz, maxZ: b.cz + b.hz, hx: b.hx, hy: b.hy, hz: b.hz, kind, solid: true, mesh, dx: 0, dy: 0, dz: 0, ...extra };
    sec.solids.push(s);
    return s;
  }
  // Make sure the tower reaches at least up to y.
  ensure(y) { while (this.top < y) this.build(); }
  build() {
    const idx = this.next++, r = this.r, df = Math.min(1, idx / 18);
    let type;
    if (idx === 0) type = "jumps";
    else {
      const pool = UNLOCK.filter(([k, at]) => idx >= at && k !== this.last).map(([k]) => k);
      // new kinds show up as soon as they unlock, so you meet them all early
      const fresh = UNLOCK.find(([k, at]) => at === idx && k !== this.last);
      type = fresh && r() < 0.7 ? fresh[0] : r.pick(pool);
    }
    this.last = type;
    const ci = idx % 4, [ax, az] = CORNERS[ci], [bx, bz] = CORNERS[(ci + 1) % 4];
    const dx = Math.sign(bx - ax), dz = Math.sign(bz - az), nx = dz, nz = -dx;
    const y0 = this.top, gen = GEN[type](r, df), y1 = y0 + gen.H;
    const sec = this.newSection(y0, y1, idx); sec.name = NAMES[type]; sec.type = type;
    const color = COLORS[(idx * 3 + 1) % COLORS.length], color2 = COLORS[(idx * 3 + 5) % COLORS.length];
    const W = (u, v, t) => ({ x: ax + dx * u + nx * v, y: y0 + t, z: az + dz * u + nz * v });
    const H = (su, sv) => (dx !== 0 ? { hx: su, hz: sv } : { hx: sv, hz: su });
    for (const p of gen.parts) {
      const w = W(p.u, p.v, p.t);
      if (p.type === "spinner") { this.addSpinner(sec, w, p, dx, dz); continue; }
      const h = H(p.su, p.sv), b = { cx: w.x, cy: w.y - p.sh, cz: w.z, hx: h.hx, hy: p.sh, hz: h.hz };
      if (p.type === "plain") this.addBox(sec, b, mat(p.color ?? (p.i % 2 ? color2 : color)), "plain");
      else if (p.type === "mover") {
        const ax2 = p.axis === "y" ? [0, 1, 0] : p.axis === "u" ? [dx, 0, dz] : [nx, 0, nz];
        const s = this.addBox(sec, b, mat(0x38d9ff), "mover", { base: [b.cx, b.cy, b.cz], axis: ax2, amp: p.amp, period: p.period, phase: p.phase });
        s.mesh.material = mat(0x38d9ff, { emissive: 0x0a4a66, emissiveIntensity: 0.4 }); sec.movers.push(s);
      } else if (p.type === "fall") {
        const s = this.addBox(sec, b, mat(0xd9a066), "fall", { base: [b.cx, b.cy, b.cz], state: 0, timer: 0, delay: p.delay });
        sec.movers.push(s);
      } else if (p.type === "vanish") {
        const m = new THREE.MeshStandardMaterial({ color: 0xc77dff, map: TEX.stud, roughness: 0.5, transparent: true, emissive: 0x5a1e8a, emissiveIntensity: 0.5 });
        const s = this.addBox(sec, b, m, "vanish", { period: p.period, phase: p.phase, ownMat: m });
        sec.movers.push(s);
      } else if (p.type === "pad") {
        this.addBox(sec, b, mat(0x3a3f55), "plain");
        const pb = { cx: w.x, cy: w.y + 0.08, cz: w.z, hx: h.hx * 0.8, hy: 0.08, hz: h.hz * 0.8 };
        const pad = this.addBox(sec, pb, new THREE.MeshStandardMaterial({ map: TEX.pad, emissive: 0x2aff4a, emissiveIntensity: 0.35, emissiveMap: TEX.pad }), "pad", { squash: 0 });
        sec.movers.push(pad);
      } else if (p.type === "belt") {
        const s = this.addBox(sec, b, mat(0x555a6e), "belt", { bx: dx * p.bu + nx * p.bv, bz: dz * p.bu + nz * p.bv });
        // the moving arrows on top
        const along = p.bu !== 0, aLen = along ? p.su * 2 : p.sv * 2, across = along ? p.sv * 2 : p.su * 2;
        const tex = TEX.arrow.clone(); tex.needsUpdate = true; tex.repeat.set(aLen / 1.3, across / 1.3);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(aLen * 0.98, across * 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
        sec.geos.push(plane.geometry);
        // point the arrows the way the belt pushes you
        plane.rotation.x = -Math.PI / 2; plane.rotation.z = Math.atan2(-s.bz, s.bx); plane.position.set(w.x, w.y + 0.01, w.z);
        sec.group.add(plane); s.tex = tex; s.speed = Math.hypot(s.bx, s.bz); sec.belts.push(s);
      }
      // coins float over some platforms
      if (p.type !== "pad" && r() < (p.type === "plain" ? 0.4 : 0.55)) this.addCoin(sec, w.x, w.y + 1.1, w.z);
      if (p.type === "pad") for (let k = 1; k <= 3; k++) this.addCoin(sec, w.x, w.y + 1.6 * k + 0.6, w.z);
    }
    // the landing at the end corner (a checkpoint every CHECK_EVERY sections)
    const isCheck = (idx + 1) % CHECK_EVERY === 0, hs = isCheck ? 2.6 : 2.1;
    const lb = { cx: bx, cy: y1 - 0.5, cz: bz, hx: hs, hy: 0.5, hz: hs };
    this.addBox(sec, lb, mat(isCheck ? 0xffffff : 0x8d99ae), "plain");
    if (isCheck) { sec.check = this.addFlag(sec, bx, y1, bz, (idx + 1) / CHECK_EVERY); sec.check.group.rotation.y = Math.atan2(dx, dz); }
    this.addCore(sec, y0, y1);
    this.sections.push(sec);
    this.top = y1;
  }
  addSpinner(sec, w, p, dx, dz) {
    const g = new THREE.Group(); g.position.set(w.x, w.y, w.z); sec.group.add(g);
    const pole = new THREE.Mesh(boxGeo(0.6, 0.9, 0.6), mat(0x2b2d42)); pole.position.y = 0.45; g.add(pole); sec.geos.push(pole.geometry);
    const arm = new THREE.Group(); arm.position.y = 0.45; g.add(arm);
    const barGeo = boxGeo(p.len * 2, 0.36, 0.36); sec.geos.push(barGeo);
    const bar = new THREE.Mesh(barGeo, mat(0xff2e2e, { emissive: 0x801010, emissiveIntensity: 0.6 })); arm.add(bar);
    for (const sx of [-1, 1]) { const tip = new THREE.Mesh(boxGeo(0.5, 0.5, 0.5), mat(0xffd60a)); tip.position.x = sx * p.len; arm.add(tip); sec.geos.push(tip.geometry); }
    // the pole is solid; the bar knocks you away
    sec.solids.push({ minX: w.x - 0.3, maxX: w.x + 0.3, minY: w.y, maxY: w.y + 0.9, minZ: w.z - 0.3, maxZ: w.z + 0.3, kind: "pole", solid: true, dx: 0, dy: 0, dz: 0 });
    sec.spinners.push({ x: w.x, y: w.y + 0.45, z: w.z, len: p.len, half: 0.22, a: p.phase, speed: p.speed, arm });
  }
  addFlag(sec, x, y, z, n) {
    const g = new THREE.Group(); g.position.set(x, y, z); sec.group.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.4, roughness: 0.3 }));
    pole.position.set(0, 1.7, 0); g.add(pole); sec.geos.push(pole.geometry);
    const flagGeo = new THREE.PlaneGeometry(1.5, 0.95, 8, 1); sec.geos.push(flagGeo);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, side: THREE.DoubleSide, emissive: 0x400000 });
    const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.78, 2.9, 0); g.add(flag);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat(0xffd60a, { emissive: 0x806000 })); ball.position.y = 3.45; g.add(ball); sec.geos.push(ball.geometry);
    return { n, x, y, z, reached: false, group: g, flag, flagMat, flagGeo, base: flagGeo.attributes.position.array.slice() };
  }
  addCoin(sec, x, y, z) {
    const m = new THREE.Mesh(COIN_GEO, COIN_MAT); m.position.set(x, y, z); m.rotation.x = Math.PI / 2; sec.group.add(m);
    sec.coins.push({ x, y, z, mesh: m, taken: false });
  }
  // Remove sections far under the lava (they can't be reached any more).
  prune(lavaY) { while (this.sections.length > 2 && this.sections[0].y1 < lavaY - 25) this.drop(this.sections.shift()); }
  drop(s) {
    this.scene.remove(s.group);
    for (const g of s.geos) g.dispose();
    for (const b of s.solids) if (b.ownMat) b.ownMat.dispose();
    for (const b of s.belts) b.tex.dispose();
  }
  destroy() { for (const s of this.sections) this.drop(s); this.sections = []; }
  // Move everything that moves. Each solid remembers how far it moved this step (dx/dy/dz) so it can carry you.
  update(t, dt, player) {
    for (const sec of this.sections) {
      for (const s of sec.movers) {
        const ox = s.minX, oy = s.minY, oz = s.minZ;
        if (s.kind === "mover") {
          const k = Math.sin((t / s.period) * Math.PI * 2 + s.phase) * s.amp;
          this.place(s, s.base[0] + s.axis[0] * k, s.base[1] + s.axis[1] * k, s.base[2] + s.axis[2] * k);
        } else if (s.kind === "fall") {
          if (s.state === 1) { s.timer -= dt; const j = 0.06; s.mesh.position.set(s.base[0] + (Math.random() - 0.5) * j, s.base[1] + (Math.random() - 0.5) * j, s.base[2] + (Math.random() - 0.5) * j); if (s.timer <= 0) { s.state = 2; s.timer = 3.2; s.vy = 0; s.solid = false; } }
          else if (s.state === 2) {
            s.vy -= 25 * dt; s.mesh.position.y += s.vy * dt; s.mesh.rotation.z += dt * 1.5; s.timer -= dt;
            if (s.timer <= 0) { s.state = 0; s.solid = true; s.mesh.position.set(...s.base); s.mesh.rotation.set(0, 0, 0); s.mesh.scale.setScalar(0.01); }
          } else if (s.mesh.scale.x < 1) s.mesh.scale.setScalar(Math.min(1, s.mesh.scale.x + dt * 4));
        } else if (s.kind === "vanish") {
          const ph = ((t + s.phase) % s.period) / s.period; // 0..0.62 there, then warning blink, then gone
          const on = ph < 0.62;
          s.solid = on;
          s.mesh.visible = ph < 0.66;
          s.ownMat.opacity = ph < 0.48 ? 1 : ph < 0.62 ? (Math.sin(t * 40) > 0 ? 0.95 : 0.35) : 0.18;
          if (ph > 0.9) { s.mesh.visible = true; s.ownMat.opacity = (ph - 0.9) * 6; }
        } else if (s.kind === "pad") {
          s.squash = Math.max(0, s.squash - dt * 4);
          s.mesh.scale.y = 1 + Math.sin(s.squash * Math.PI) * 1.5;
        }
        s.dx = s.minX - ox; s.dy = s.minY - oy; s.dz = s.minZ - oz;
      }
      for (const b of sec.belts) b.tex.offset.x -= dt * b.speed / 1.3;
      for (const sp of sec.spinners) { sp.a += sp.speed * dt; sp.arm.rotation.y = -sp.a; }
      for (const c of sec.coins) if (!c.taken) { c.mesh.rotation.z = t * 3 + c.x; c.mesh.position.y = c.y + Math.sin(t * 2.5 + c.z) * 0.12; }
      if (sec.check && sec.check.flag) {
        const a = sec.check.flagGeo.attributes.position, b = sec.check.base;
        for (let i = 0; i < a.count; i++) { const x = b[i * 3] + 0.75; a.setZ(i, Math.sin(t * 6 - x * 3) * 0.12 * x); }
        a.needsUpdate = true;
      }
    }
  }
  place(s, cx, cy, cz) {
    s.minX = cx - s.hx; s.maxX = cx + s.hx; s.minY = cy - s.hy; s.maxY = cy + s.hy; s.minZ = cz - s.hz; s.maxZ = cz + s.hz;
    s.mesh.position.set(cx, cy, cz);
  }
  // All the solid boxes near a height (from sections that overlap it).
  solidsNear(y, range, out) {
    out.length = 0;
    for (const sec of this.sections) if (sec.y1 + 6 > y - range && sec.y0 - 3 < y + range) for (const s of sec.solids) if (s.solid) out.push(s);
    return out;
  }
  sectionAt(y) { for (let i = this.sections.length - 1; i >= 0; i--) if (this.sections[i].y0 <= y + 0.5) return this.sections[i]; return this.sections[0]; }
  checkpoint(n) { for (const s of this.sections) if (s.check && s.check.n === n) return s.check; return null; }
}
const COIN_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20);
const COIN_MAT = new THREE.MeshStandardMaterial({ color: 0xffd84a, metalness: 0.15, roughness: 0.3, emissive: 0xffa000, emissiveIntensity: 0.45 });
