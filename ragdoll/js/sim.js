// SPLAT LAB simulation: our own verlet physics (points + sticks + capsule/polygon collisions), the floppy people,
// damage (wounds, broken bones, limbs coming off), blood (drops, splats, drips, pools that stay), fire and explosions.
export const WW = 1600, WH = 900, G = 1500;
const OUT = "#1b1424";
export const W = {
  bodies: [], pins: [], segs: [], drops: [], pools: [], drips: [], chunks: [], flames: [], fires: [], fx: [], texts: [],
  time: 0, hPrev: 1 / 180, shake: 0, gore: true, grab: null, dctx: null, nid: 1, sfx: {}, preview: false,
};
const R = Math.random;
export const rnd = (a, b) => a + R() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const S = (n, ...a) => W.sfx[n] && W.sfx[n](...a);

// ---------------------------------------------------------------- building blocks
export function newBody(kind, def) {
  const b = { id: W.nid++, kind, def, ps: [], ss: [], shapes: [], x0: 0, y0: 0, x1: 0, y1: 0, mass: 0, static: false, born: W.time };
  W.bodies.push(b); return b;
}
export function pt(b, x, y, r, m, o = {}) {
  const p = { x, y, px: x, py: y, r, m, im: m > 0 ? 1 / m : 0, body: b, fr: o.fr ?? 0.5, bounce: o.bounce || 0, part: o.part ?? -1, g: o.g ?? 1,
    gone: false, ground: 0, skew: null, nc: !!o.nc, sharp: !!o.sharp, point: !!o.point };
  b.ps.push(p); b.mass += m; return p;
}
export function stick(b, a, c, o = {}) {
  const s = { a, b: c, len: o.len ?? Math.hypot(c.x - a.x, c.y - a.y), k: o.k ?? 1, min: !!o.min, brk: o.brk || 0, tough: o.tough || 80, dmg: 0, on: true, part: o.part ?? -1 };
  b.ss.push(s); return s;
}
export function cap(b, a, c, r, o = {}) { const s = { t: "cap", a, b: c, r, body: b, part: -1, fr: 0.5, ...o }; b.shapes.push(s); return s; }
export function poly(b, pts, o = {}) { const s = { t: "poly", pts, body: b, r: 0, part: -1, fr: 0.6, ...o }; b.shapes.push(s); return s; }
export function rigid(b, list, k = 1) { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) stick(b, list[i], list[j], { k }); }
export function removeBody(b) {
  const i = W.bodies.indexOf(b); if (i >= 0) W.bodies.splice(i, 1);
  for (const p of b.ps) p.gone = true; // (ropes tied to it let go)
  W.pins = W.pins.filter((pin) => { const keep = pin.p.body !== b && pin.sh.body !== b; if (!keep) pin.p.skew = null; return keep; });
  if (W.grab && W.grab.body === b) W.grab = null;
}
export function addVel(p, vx, vy) { if (p.im) { p.px -= vx * W.hPrev; p.py -= vy * W.hPrev; } }
export const vel = (p) => [(p.x - p.px) / W.hPrev, (p.y - p.py) / W.hPrev];
export function moveBody(b, dx, dy) { for (const p of b.ps) { p.x += dx; p.y += dy; p.px += dx; p.py += dy; } }
export function rotateBody(b, ang, cx, cy) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const p of b.ps) {
    if (!p.im) continue;
    for (const k of [["x", "y"], ["px", "py"]]) { const dx = p[k[0]] - cx, dy = p[k[1]] - cy; p[k[0]] = cx + dx * c - dy * s; p[k[1]] = cy + dx * s + dy * c; }
  }
}
export function center(b) { let x = 0, y = 0, n = 0; for (const p of b.ps) if (!p.gone) { x += p.x; y += p.y; n++; } return n ? [x / n, y / n] : [0, 0]; }

// ---------------------------------------------------------------- the step
export function step(h) {
  W.time += h;
  const ratio = h / W.hPrev; W.hPrev = h;
  const maxd = 3600 * h;
  for (const b of W.bodies) {
    if (b.pre) b.pre(b, h);
    for (const p of b.ps) {
      if (p.gone || !p.im) continue;
      let vx = (p.x - p.px) * ratio * 0.9995, vy = (p.y - p.py) * ratio * 0.9995;
      const d2 = vx * vx + vy * vy; if (d2 > maxd * maxd) { const k = maxd / Math.sqrt(d2); vx *= k; vy *= k; }
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + G * h * h * p.g;
      if (p.ground > 0) p.ground -= h;
    }
  }
  constraints(2);
  collideAll(h);
  constraints(2);
  for (let i = W.bodies.length - 1; i >= 0; i--) {
    const b = W.bodies[i]; if (b.post) b.post(b, h);
    if (b.kill || (!b.static && (b.y0 > WH + 300 || b.x1 < -300 || b.x0 > WW + 300 || b.allGone))) removeBody(b);
  }
}
function constraints(n) {
  for (let it = 0; it < n; it++) {
    for (const b of W.bodies) for (const s of b.ss) if (s.on) solveStick(b, s);
    for (let i = W.pins.length - 1; i >= 0; i--) solvePin(W.pins[i], i);
    if (W.grab) grabSolve();
    for (const b of W.bodies) if (b.solve) b.solve(b);
  }
}
function solveStick(body, s) {
  const a = s.a, b = s.b;
  if (a.gone || b.gone) { s.on = false; return; }
  const w = a.im + b.im; if (!w) return;
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
  if (s.min && d >= s.len) return;
  if (d < 1e-6) return;
  const strain = d - s.len;
  if (s.brk && strain > s.brk) { s.dmg += strain - s.brk; if (s.dmg > s.tough && body.kind === "rag") { sever(body, s.part, true); return; } }
  const diff = (strain / d) * s.k, ka = (a.im / w) * diff, kb = (b.im / w) * diff;
  a.x += dx * ka; a.y += dy * ka; b.x -= dx * kb; b.y -= dy * kb;
}
function solvePin(pin, i) {
  const p = pin.p, a = pin.sh.a, b = pin.sh.b, t = pin.t;
  if (p.gone || a.gone || b.gone || !W.bodies.includes(p.body)) { p.skew = null; W.pins.splice(i, 1); return; }
  const qx = a.x + (b.x - a.x) * t, qy = a.y + (b.y - a.y) * t, dx = qx - p.x, dy = qy - p.y, d = Math.hypot(dx, dy);
  if (d > 34) { p.skew = null; W.pins.splice(i, 1); if (p.body.kind === "rag") { bleedBurst(p.body, p.x, p.y, -dx / d, -dy / d, 12); S("rip"); } return; }
  const wa = 1 - t, wb = t, w = p.im + a.im * wa * wa + b.im * wb * wb; if (!w) return;
  const l = 0.8 / w;
  p.x += dx * l * p.im; p.y += dy * l * p.im;
  a.x -= dx * l * a.im * wa; a.y -= dy * l * a.im * wa; b.x -= dx * l * b.im * wb; b.y -= dy * l * b.im * wb;
}
function grabSolve() {
  const g = W.grab;
  if (g.rigid) {
    const c = Math.cos(g.ang), s = Math.sin(g.ang), k = g.k;
    for (const o of g.offs) {
      const p = o.p; if (p.gone || !p.im) continue;
      const tx = g.tx + o.dx * c - o.dy * s, ty = g.ty + o.dx * s + o.dy * c;
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
    }
  } else {
    const p = g.p; if (p.gone) { W.grab = null; return; }
    let dx = (g.tx - p.x) * 0.3, dy = (g.ty - p.y) * 0.3; const d = Math.hypot(dx, dy), mx = 650 * W.hPrev; // (a yank can only go so fast)
    if (d > mx) { dx *= mx / d; dy *= mx / d; }
    p.x += dx; p.y += dy;
  }
}

// ---------------------------------------------------------------- collisions
function collideAll(h) {
  const B = W.bodies;
  for (const b of B) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
    for (const p of b.ps) { if (p.gone) continue; any = true; if (p.x - p.r < x0) x0 = p.x - p.r; if (p.x + p.r > x1) x1 = p.x + p.r; if (p.y - p.r < y0) y0 = p.y - p.r; if (p.y + p.r > y1) y1 = p.y + p.r; }
    b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1; b.allGone = !any;
    if (!b.static) for (const p of b.ps) if (!p.gone && p.im && !p.nc) collideWorld(p, h);
  }
  for (let i = 0; i < B.length; i++) {
    const A = B[i];
    for (let j = i + 1; j < B.length; j++) {
      const C = B[j];
      if (A.static && C.static) continue;
      if (A.x1 < C.x0 - 2 || C.x1 < A.x0 - 2 || A.y1 < C.y0 - 2 || C.y1 < A.y0 - 2) continue;
      if (!A.static) pairPS(A, C, h);
      if (!C.static) pairPS(C, A, h);
    }
  }
}
function pairPS(A, C, h) {
  for (const p of A.ps) {
    if (p.gone || !p.im || p.nc) continue;
    if (p.x + p.r < C.x0 || p.x - p.r > C.x1 || p.y + p.r < C.y0 || p.y - p.r > C.y1) continue;
    for (const sh of C.shapes) { if (sh.off || (p.skew && p.skew.sh === sh)) continue; if (sh.t === "cap") colCap(p, sh, h); else colPoly(p, sh, h); }
  }
}
function colCap(p, sh, h) {
  const a = sh.a, b = sh.b; if (a.gone || b.gone) return;
  const ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey;
  let t = L2 > 1e-9 ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = a.x + ex * t, qy = a.y + ey * t;
  let nx = p.x - qx, ny = p.y - qy; const d2 = nx * nx + ny * ny, Rr = p.r + sh.r;
  if (d2 >= Rr * Rr) return;
  const d = Math.sqrt(d2); if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
  resolve(p, a, b, t, nx, ny, Rr - d, sh, h);
}
function colPoly(p, sh, h) {
  const pts = sh.pts, n = pts.length; let cx = 0, cy = 0;
  for (const q of pts) { if (q.gone) return; cx += q.x; cy += q.y; } cx /= n; cy /= n;
  let best = -1e9, bi = -1, bnx = 0, bny = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1;
    let nx = ey / L, ny = -ex / L; if ((a.x - cx) * nx + (a.y - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const sd = (p.x - a.x) * nx + (p.y - a.y) * ny;
    if (sd > p.r) return;
    if (sd > best) { best = sd; bi = i; bnx = nx; bny = ny; }
  }
  const a = pts[bi], b = pts[(bi + 1) % n], ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey || 1;
  let t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  resolve(p, a, b, t, bnx, bny, p.r - best, sh, h);
}
function resolve(p, a, b, t, nx, ny, pen, sh, h) {
  const wa = 1 - t, wb = t, w = p.im + a.im * wa * wa + b.im * wb * wb; if (!w) return;
  const rvx = (p.x - p.px - ((a.x - a.px) * wa + (b.x - b.px) * wb)) / h, rvy = (p.y - p.py - ((a.y - a.py) * wa + (b.y - b.py) * wb)) / h;
  const vn = rvx * nx + rvy * ny;
  const l = pen / w;
  p.x += nx * l * p.im; p.y += ny * l * p.im;
  if (a.im) { a.x -= nx * l * a.im * wa; a.y -= ny * l * a.im * wa; }
  if (b.im) { b.x -= nx * l * b.im * wb; b.y -= ny * l * b.im * wb; }
  // friction (takes away some of the sliding)
  const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, f = Math.min(p.fr, sh.fr) * 0.5 * h * vt / w;
  p.px += tx * f * p.im; p.py += ty * f * p.im;
  if (a.im) { a.px -= tx * f * a.im * wa; a.py -= ty * f * a.im * wa; }
  if (b.im) { b.px -= tx * f * b.im * wb; b.py -= ty * f * b.im * wb; }
  if (ny < -0.45) p.ground = 0.12;
  if (sh.body.def && sh.body.def.touch) sh.body.def.touch(sh.body, p, h, sh);
  if (vn < -140) contact(p, sh, -vn, nx, ny, t, rvx, rvy, h);
}
function collideWorld(p, h) {
  for (const s of W.segs) {
    const ex = s.bx - s.ax, ey = s.by - s.ay, L2 = ex * ex + ey * ey;
    let t = L2 ? ((p.x - s.ax) * ex + (p.y - s.ay) * ey) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = s.ax + ex * t, qy = s.ay + ey * t; let nx = p.x - qx, ny = p.y - qy;
    const d2 = nx * nx + ny * ny, Rr = p.r + s.r; if (d2 >= Rr * Rr) continue;
    const d = Math.sqrt(d2); if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
    p.x += nx * (Rr - d); p.y += ny * (Rr - d);
    let vx = p.x - p.px, vy = p.y - p.py; const vn = vx * nx + vy * ny, sp = -vn / h;
    if (vn < 0) { vx -= nx * vn * (1 + p.bounce); vy -= ny * vn * (1 + p.bounce); }
    const vt = vx * -ny + vy * nx, f = Math.min(1, p.fr * (p.bounce ? 0.2 : 1)) * (p.fr > 0.9 ? 0.9 : 0.35);
    const grip = Math.abs(vt) < (p.fr > 0.9 ? 70 : 30) * h && !p.bounce ? 1 : f; // (things at rest stay put: no sliding around)
    vx -= -ny * vt * grip; vy -= nx * vt * grip;
    p.px = p.x - vx; p.py = p.y - vy;
    if (sp > 140) contact(p, null, sp, nx, ny, 0, 0, 0, h);
    if (ny < -0.45) p.ground = 0.12;
  }
}

// a hit between particle p and shape sh (or the world when sh is null), sp = how fast they smacked together
function contact(p, sh, sp, nx, ny, t, rvx, rvy, h) {
  const A = p.body, Bd = sh ? sh.body : null;
  if (A.kind === "rag" && p.part >= 0) {
    let massF = p.part >= 7 && ny < -0.5 ? 0.7 : 1.3, sharp = false, point = false; // (legs are made for landing)
    if (Bd) {
      massF = clamp(Bd.mass / 2.5, 0.35, 4);
      sharp = sh.sharp; point = sh.point && t > 0.78;
      if (Bd.kind === "rag") massF = 0.8;
    }
    if (point && !p.skew && sp > (sh.b.im === 0 ? 260 : 330)) {
      const ax = sh.b.x - sh.a.x, ay = sh.b.y - sh.a.y, al = Math.hypot(ax, ay) || 1, sp2 = Math.hypot(rvx, rvy) || 1;
      if ((rvx * ax + rvy * ay) / (al * sp2) < -0.55) { skewer(p, sh, Math.max(0.45, t - 0.2), sp); }
    }
    if (Bd && Bd.kind !== "rag" && Bd.mass > 6 && sp > 170) A.down = Math.max(A.down, Math.min(1.5, sp / 500)); // (big things knock you over)
    if (sharp && sp > 200) { hurt(A, p.part, (sp - 160) * 0.05 * Math.max(1, massF), { type: "cut", x: p.x - nx * p.r, y: p.y - ny * p.r, dx: -nx, dy: -ny, sever: sp > 620 && R() < 0.38 }); if (A.bc) Bd.bloody = Math.min(1, (Bd.bloody || 0) + 0.2); }
    else if (sp > 430) hurt(A, p.part, Math.min(120, (sp - 430) * 0.065 * massF), { type: "blunt", x: p.x - nx * p.r, y: p.y - ny * p.r, dx: -nx, dy: -ny });
  }
  if (Bd && Bd.kind === "rag" && sh.part >= 0 && A.kind !== "rag") {
    const massF = clamp(A.mass / 2.5, 0.35, 4);
    if (A.mass > 6 && sp > 170) Bd.down = Math.max(Bd.down, Math.min(1.5, sp / 500));
    if (p.sharp && sp > 200) { hurt(Bd, sh.part, (sp - 160) * 0.05 * Math.max(1, massF), { type: "cut", x: p.x, y: p.y, dx: nx, dy: ny, sever: sp > 620 && R() < 0.38 }); if (Bd.bc) A.bloody = Math.min(1, (A.bloody || 0) + 0.2); }
    else if (sp > 430) hurt(Bd, sh.part, Math.min(120, (sp - 430) * 0.065 * massF), { type: "blunt", x: p.x, y: p.y, dx: nx, dy: ny });
  }
  if (A.def && A.def.impact) A.def.impact(A, sp, p, Bd);
  if (Bd && Bd.def && Bd.def.impact) Bd.def.impact(Bd, sp, null, A);
  if (sp > 380) { const v = Math.min(1.5, sp / 1200); if (A.kind === "rag" || (Bd && Bd.kind === "rag")) S("thud", v); else if (A.def && A.def.metal) S("clank", v); else S("thud", v * 0.6); }
}

// ---------------------------------------------------------------- people
const PARENT = [1, -1, 1, 1, 3, 1, 5, 2, 7, 2, 9];
// [x, y, radius, mass, part]  (hip at 0,0; y goes down)
const RP = [
  [0, -62, 13, 1.3, 0], [0, -46, 7, 1.6, 1], [0, -23, 10, 2.2, 1], [0, 0, 9, 2.2, 2],
  [0, -46, 5, 0.6, 3], [3, -24, 5, 0.5, 3], [3, -24, 5, 0.5, 4], [4, -3, 5, 0.6, 4],
  [0, -46, 5, 0.6, 5], [-3, -24, 5, 0.5, 5], [-3, -24, 5, 0.5, 6], [-4, -3, 5, 0.6, 6],
  [0, 0, 7, 1, 7], [5, 26, 6, 0.9, 7], [5, 26, 6, 0.9, 8], [10, 52, 6, 1, 8],
  [0, 0, 7, 1, 9], [-5, 26, 6, 0.9, 9], [-5, 26, 6, 0.9, 10], [-10, 52, 6, 1, 10],
];
// [a, b, kind, part it cuts off]
const RS = [
  [1, 0, "j", 0], [1, 2, "b"], [2, 3, "b"], [1, 3, "b"],
  [1, 4, "j", 3], [4, 5, "b"], [5, 6, "j", 4], [6, 7, "b"],
  [1, 8, "j", 5], [8, 9, "b"], [9, 10, "j", 6], [10, 11, "b"],
  [3, 12, "j", 7], [12, 13, "b"], [13, 14, "j", 8], [14, 15, "b"],
  [3, 16, "j", 9], [16, 17, "b"], [17, 18, "j", 10], [18, 19, "b"],
];
const PARTS = [[0, 0, 13], [1, 2, 11], [2, 3, 11], [4, 5, 5.5], [6, 7, 5], [8, 9, 5.5], [10, 11, 5], [12, 13, 7.5], [14, 15, 6.5], [16, 17, 7.5], [18, 19, 6.5]];
const HP = [70, 130, 120, 45, 40, 45, 40, 60, 55, 60, 55];
const NAMES = ["Bob", "Dave", "Gary", "Steve", "Lou", "Moe", "Ned", "Phil", "Rex", "Sal", "Tod", "Vic", "Walt", "Zed", "Hank", "Earl", "Gus", "Jim", "Kip", "Norm", "Otto", "Ray", "Stan", "Ted"];
export const BLOOD = { red: ["#b3101e", "#8e0a16", "#c8182c"], goo: ["#43c21b", "#2f9a10", "#6be03a"], oil: ["#151318", "#222026", "#2c2a33"] };
const SHIRTS = ["#3a86ff", "#ff5d8f", "#ffbe0b", "#06d6a0", "#8338ec", "#fb5607", "#2ec4b6", "#e63946", "#f4f1de", "#4cc9f0"];
const PANTS = ["#264653", "#3d405b", "#22223b", "#5e503f", "#1d3557", "#463f3a"];
const SKINS = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#f5cba7"];
const HAIRS = ["#2b1d0e", "#5a3a1a", "#e8c26b", "#111", "#a33b20", "#777"];
const pick = (a) => a[(R() * a.length) | 0];

export function spawnPerson(x, y, kind = "buddy", face = 1, def = null) {
  const b = newBody("rag", def);
  const sc = kind === "brute" ? 1.17 : 1, mm = kind === "brute" ? 1.6 : kind === "robo" ? 1.3 : 1;
  b.sc = sc; b.face = face; b.kindName = kind;
  b.name = (kind === "robo" ? "Robo-" : kind === "dummy" ? "Dummy " : kind === "goo" ? "Goo " : "") + pick(NAMES);
  for (const r of RP) pt(b, x + r[0] * sc * face, y + r[1] * sc, r[2] * sc, r[3] * mm, { part: r[4], fr: r[4] === 8 || r[4] === 10 ? 0.95 : 0.6 });
  const P = b.ps;
  b.joint = [];
  for (const s of RS) {
    if (s[2] === "j") b.joint[s[3]] = stick(b, P[s[0]], P[s[1]], { brk: s[3] === 0 ? 10 : 12, tough: kind === "dummy" ? 50 : 110 * mm, part: s[3] });
    else stick(b, P[s[0]], P[s[1]], { k: s[0] === 1 && s[1] === 3 ? 0.6 : 1 });
  }
  stick(b, P[4], P[7], { len: 28 * sc, min: true }); stick(b, P[8], P[11], { len: 28 * sc, min: true });
  stick(b, P[12], P[15], { len: 36 * sc, min: true }); stick(b, P[16], P[19], { len: 36 * sc, min: true });
  stick(b, P[0], P[2], { len: 30 * sc, min: true }); stick(b, P[0], P[3], { len: 50 * sc, min: true });
  b.parts = PARTS.map((d, i) => {
    const part = { i, a: P[d[0]], b: P[d[1]], r: d[2] * sc, hp: HP[i] * mm * (kind === "dummy" ? 0.7 : 1), max: HP[i] * mm, wounds: [], bloody: 0, char: 0, burn: 0, broken: false, cut: false, gone: false, cd: 0 };
    part.sh = cap(b, part.a, part.b, part.r, { part: i, fr: 0.6 });
    return part;
  });
  b.bc = kind === "dummy" ? null : kind === "robo" ? BLOOD.oil : kind === "goo" ? BLOOD.goo : BLOOD.red;
  b.look = kind === "dummy" ? { skin: "#ffd166", shirt: "#ffd166", pants: "#ffd166", shoe: "#333", hair: null, style: 0 }
    : kind === "robo" ? { skin: "#9aa5b1", shirt: "#6c7a89", pants: "#4b5563", shoe: "#2d3436", hair: null, style: 0 }
    : kind === "goo" ? { skin: "#7ddc4a", shirt: "#7ddc4a", pants: "#3f8f1e", shoe: "#265c10", hair: null, style: 0 }
    : kind === "brute" ? { skin: pick(SKINS), shirt: pick(["#5c4033", "#2d6a4f", "#9d0208", "#333"]), pants: pick(PANTS), shoe: "#2a1a10", hair: pick(HAIRS), style: 3 }
    : { skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), shoe: "#2a2a2a", hair: pick(HAIRS), style: 1 + ((R() * 3) | 0) };
  b.state = "alive"; b.blood = 100; b.shock = 0; b.str = 1; b.down = 0; b.pain = 0; b.air = 0; b.deadT = 0; b.blink = R() * 4;
  b.post = ragPost; b.solve = ragSolve; b.rest = b.ps.map((p) => [p.x, p.y]);
  return b;
}
export function attached(b, i) { let j = i; while (j >= 0) { const q = b.parts[j]; if (q.gone || q.cut) return false; j = PARENT[j]; } return true; }
const legOK = (b, i) => attached(b, i + 1) && !b.parts[i].broken && !b.parts[i + 1].broken;
function nudge(p, tx, ty, f) { if (p.gone) return; p.x += (tx - p.x) * f; p.y += (ty - p.y) * f; }
// (moves a point without giving it speed)
function shift(p, tx, ty, f) { if (p.gone) return; const dx = (tx - p.x) * f, dy = (ty - p.y) * f; p.x += dx; p.y += dy; p.px += dx; p.py += dy; }

// People hold whatever pose they are in (like an action figure). They never move by themselves:
// only when you drag a body part, throw them, or something hits them. Knocked out / dead = floppy,
// and when they wake up they keep the pose they landed in.
const CHAIN = { 0: [0], 3: [3, 4], 4: [3, 4], 5: [5, 6], 6: [5, 6], 7: [7, 8], 8: [7, 8], 9: [9, 10], 10: [9, 10] };
function ragSolve(b) {
  const P = b.ps, Rr = b.rest, g = W.grab;
  const free = g && g.body === b && !g.rigid ? CHAIN[g.p.part] || [] : [];
  if (free.length && free[0] !== 0 && b.str > 0.6 && b.air < 0.1) { // posing: drag an arm or leg and the rest of them stays planted
    const root = P[{ 3: 4, 5: 8, 7: 12, 9: 16 }[free[0]]], reach = free[0] >= 7 ? 64 : 56;
    if (Math.hypot(g.tx - root.x, g.ty - root.y) < reach) {
      if (!g.anchor) g.anchor = P.map((p) => [p.x, p.y]);
      for (let i = 0; i < P.length; i++) if (!P[i].gone && !free.includes(P[i].part)) { P[i].x = P[i].px = g.anchor[i][0]; P[i].y = P[i].py = g.anchor[i][1]; }
    } else g.anchor = null;
  }
  let M = 0, cx = 0, cy = 0, rx = 0, ry = 0; const idx = [];
  for (let i = 0; i < P.length; i++) { const p = P[i]; if (p.gone || !attached(b, p.part) || free.includes(p.part)) continue; idx.push(i); M += p.m; cx += p.m * p.x; cy += p.m * p.y; rx += p.m * Rr[i][0]; ry += p.m * Rr[i][1]; }
  if (M <= 0 || idx.length < 3) return;
  cx /= M; cy /= M; rx /= M; ry /= M;
  let A = 0, B = 0;
  for (const i of idx) { const p = P[i], ox = Rr[i][0] - rx, oy = Rr[i][1] - ry, qx = p.x - cx, qy = p.y - cy; A += p.m * (ox * qx + oy * qy); B += p.m * (ox * qy - oy * qx); }
  const th = Math.atan2(B, A), c = Math.cos(th), sn = Math.sin(th);
  const toRest = (p) => { const dx = p.x - cx, dy = p.y - cy; return [rx + c * dx + sn * dy, ry - sn * dx + c * dy]; };
  if (b.str < 0.4 || b.relax > 0) { for (let i = 0; i < P.length; i++) if (!P[i].gone) Rr[i] = toRest(P[i]); return; } // (floppy: the pose follows the body)
  for (let i = 0; i < P.length; i++) if (!P[i].gone && free.includes(P[i].part)) Rr[i] = toRest(P[i]); // (the limb you're moving gets its new pose)
  const k = 0.45 * b.str;
  for (const i of idx) { const p = P[i], ox = Rr[i][0] - rx, oy = Rr[i][1] - ry; p.x += (cx + c * ox - sn * oy - p.x) * k; p.y += (cy + sn * ox + c * oy - p.y) * k; }
}
function ragPost(b, h) {
  if (b.state === "alive") {
    let tgt = clamp((b.blood - 25) / 45, 0, 1) * clamp(1 - b.shock / 110, 0.15, 1);
    if (b.down > 0) tgt *= 0.06;
    b.str += (tgt - b.str) * Math.min(1, h * 4);
  } else b.str += (0 - b.str) * Math.min(1, h * 8);
  if (b.relax > 0) b.relax--;
  const held = !!(W.grab && W.grab.body === b); if (b.held && !held) b.relax = 3; b.held = held; // (after you let go, the new pose settles before it locks)
  b.down = Math.max(0, b.down - h); b.pain = Math.max(0, b.pain - h * 0.8);
  b.shock = Math.max(0, b.shock - h * (b.state === "ko" ? 7 : 10));
  if (b.state === "ko" && b.shock < 30 && b.blood >= 32 && !b.parts.some((q) => q.burn > 0)) { b.state = "alive"; b.down = 1.2; say(b, "...huh?", "#cde"); }
  for (const j of b.joint) if (j && j.dmg > 0) j.dmg = Math.max(0, j.dmg - h * 30);
  let grounded = false; for (const p of b.ps) if (p.ground > 0) { grounded = true; break; }
  b.air = grounded ? 0 : b.air + h;
}

// ---------------------------------------------------------------- damage
export function hurt(b, pi, dmg, o = {}) {
  if (!b || b.kind !== "rag" || dmg <= 0.5 || pi < 0) return;
  const pt_ = b.parts[pi]; if (!pt_ || pt_.gone) return;
  const type = o.type || "blunt";
  pt_.hp -= dmg;
  b.shock += dmg * (pi === 0 ? 2.3 : pi <= 2 ? 1.1 : 0.6);
  b.pain = Math.min(1, b.pain + dmg * 0.04);
  if (dmg > 12) b.down = Math.max(b.down, Math.min(2.5, dmg * 0.035));
  const x = o.x ?? (pt_.a.x + pt_.b.x) / 2, y = o.y ?? (pt_.a.y + pt_.b.y) / 2;
  const fresh = W.time - pt_.cd > 0.06; if (fresh) pt_.cd = W.time;
  if (type !== "burn" && fresh) {
    if (type === "shot") addWound(b, pi, x, y, "hole", 1.5);
    else if (type === "stab") addWound(b, pi, x, y, "stab", 2.4);
    else if (type === "cut" && dmg > 4) addWound(b, pi, x, y, "cut", 0.7 + dmg * 0.025);
    else if (type === "blunt" && dmg > 45) addWound(b, pi, x, y, "hole", 0.8);
    else if (type === "blast" && dmg > 25) addWound(b, pi, x, y, "hole", 1.1);
    else if (type === "blunt" && dmg > 14) addWound(b, pi, x, y, "bruise", 0);
    if (type !== "blunt" || dmg > 25) bleedBurst(b, x, y, o.dx || 0, o.dy || -1, Math.min(34, dmg * (type === "shot" ? 0.7 : 0.45)));
    if (type === "cut") S("slice"); else if (type === "shot") S("hitBody"); else if (dmg > 25) S("splat", dmg / 50);
  }
  if ((type === "blunt" || type === "blast") && pi >= 3 && !pt_.broken && pt_.hp < pt_.max * 0.4) { pt_.broken = true; S("crunch"); }
  if (pt_.hp < -pt_.max * (type === "blast" ? 0.5 : type === "burn" ? 99 : 1.4)) gib(b, pi, o.dx || 0, o.dy || 0);
  else if ((o.sever || (type === "cut" && dmg > 20 && R() < 0.15 + dmg / 140)) && b.joint[pi]) sever(b, pi);
  vitals(b);
}
export function addWound(b, pi, x, y, kind, bleed) {
  const q = b.parts[pi]; if (!q || q.gone) return;
  const ex = q.b.x - q.a.x, ey = q.b.y - q.a.y, L2 = ex * ex + ey * ey;
  let t = L2 > 1 ? ((x - q.a.x) * ex + (y - q.a.y) * ey) / L2 : 0.5; t = kind === "stump" ? t : clamp(t, 0.1, 0.9);
  const L = Math.sqrt(L2) || 1, side = L2 > 1 ? ((x - q.a.x) * -ey + (y - q.a.y) * ex) / L : x - q.a.x;
  const o = kind === "stump" ? 0 : clamp(side / q.r, -0.75, 0.75);
  if (!b.bc) bleed = 0;
  const near = q.wounds.find((w) => w.kind === kind && Math.abs(w.t - t) < 0.12 && Math.abs(w.o - o) < 0.4);
  if (near) { near.bleed = Math.min(6, near.bleed + bleed * 0.6); near.size = Math.min(1.8, near.size + 0.15); }
  else { q.wounds.push({ t, o, kind, bleed, size: rnd(0.8, 1.2), ang: R() * 3, acc: 0 }); if (q.wounds.length > 7) q.wounds.shift(); }
  if (bleed > 0) q.bloody = Math.min(1, q.bloody + 0.22);
}
export function woundPos(q, w) {
  const ex = q.b.x - q.a.x, ey = q.b.y - q.a.y, L = Math.hypot(ex, ey) || 1, nx = -ey / L, ny = ex / L;
  if (q.a === q.b) { const a = w.ang * 2; return [q.a.x + Math.cos(a) * q.r * w.o, q.a.y + Math.sin(a) * q.r * w.o, Math.cos(a), Math.sin(a)]; }
  const x = q.a.x + ex * w.t + nx * w.o * q.r, y = q.a.y + ey * w.t + ny * w.o * q.r;
  if (w.kind === "stump") return [x, y, w.t < 0.5 ? -ex / L : ex / L, w.t < 0.5 ? -ey / L : ey / L];
  return [x, y, nx * Math.sign(w.o || 1), ny * Math.sign(w.o || 1)];
}
export function sever(b, pi, ripped = false) {
  const j = b.joint[pi], q = b.parts[pi]; if (!j || !j.on || q.cut || q.gone) return;
  j.on = false; q.cut = true;
  const par = b.parts[PARENT[pi]];
  if (b.bc) {
    addWound(b, pi, j.b.x, j.b.y, "stump", 3.5);
    if (par && !par.gone) addWound(b, par.i, j.a.x, j.a.y, "stump", 4);
    const dx = j.b.x - j.a.x, dy = j.b.y - j.a.y, d = Math.hypot(dx, dy) || 1;
    bleedBurst(b, j.a.x, j.a.y, dx / d, dy / d, 26); bleedBurst(b, j.b.x, j.b.y, -dx / d, -dy / d, 16);
  }
  b.shock += 60; b.pain = 1;
  S(ripped ? "rip" : "slice"); S("splat", 1.2);
  if (pi === 0) die(b); else vitals(b);
}
export function gib(b, pi, dx = 0, dy = 0) {
  const q = b.parts[pi]; if (!q || q.gone) return;
  if (pi === 1 || pi === 2) { gibAll(b, dx, dy); return; }
  if (b.joint[pi] && !q.cut) sever(b, pi);
  q.gone = true; q.sh.off = true;
  for (const p of b.ps) if (p.part === pi) p.gone = true;
  for (let c = 0; c < PARENT.length; c++) if (PARENT[c] === pi && b.joint[c]) { const cq = b.parts[c]; if (!cq.cut && !cq.gone) { cq.cut = true; b.joint[c].on = false; if (b.bc) addWound(b, c, b.joint[c].b.x, b.joint[c].b.y, "stump", 2.5); } }
  meat(b, (q.a.x + q.b.x) / 2, (q.a.y + q.b.y) / 2, pi === 0 ? 8 : 5, dx, dy);
  S("pop");
  if (pi === 0) die(b); else vitals(b);
}
export function gibAll(b, dx = 0, dy = 0) {
  for (const q of b.parts) if (!q.gone) { meat(b, (q.a.x + q.b.x) / 2, (q.a.y + q.b.y) / 2, q.i <= 2 ? 6 : 3, dx, dy); q.gone = true; q.sh.off = true; }
  for (const p of b.ps) p.gone = true;
  S("pop"); S("splat", 2);
  if (b.state !== "dead") die(b);
}
function meat(b, x, y, n, dx, dy) {
  const bc = b.bc;
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, s = rnd(150, 520);
    const col = b.kindName === "robo" ? pick(["#6c7a89", "#9aa5b1", "#4b5563"]) : b.kindName === "dummy" ? pick(["#ffd166", "#f6f1e4", "#e9c46a"]) : bc === BLOOD.goo ? pick(["#7ddc4a", "#4fb52a", "#a6f07a"]) : pick(["#c0392b", "#a52a2a", "#d35454", "#8e1b1b"]);
    W.chunks.push({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: Math.cos(a) * s + dx * 400, vy: Math.sin(a) * s - 250 + dy * 400, r: rnd(3, 7), rot: R() * 6, vr: rnd(-12, 12), col, bone: !bc || R() < 0.3, bc, rest: 0 });
  }
  while (W.chunks.length > 180) W.chunks.shift();
  if (bc) bleedBurst(b, x, y, dx, dy - 0.5, 40, 1.5);
}
function vitals(b) {
  if (b.state === "dead") return;
  const P = b.parts;
  if (P[0].gone || P[0].cut || P[0].hp <= 0 || P[1].hp <= 0 || P[2].hp <= 0 || P[1].gone || P[2].gone || b.blood <= 0) die(b);
  else if ((b.shock >= 100 || b.blood < 28) && b.state !== "ko") { b.state = "ko"; say(b, "KO!", "#ffd23f"); S("ko"); }
}
export function die(b) { if (b.state === "dead") return; b.state = "dead"; b.deadT = W.time; say(b, "💀", "#fff"); S("die"); }
export function heal(b) {
  if (b.kind !== "rag" || b.parts[0].gone || b.parts[0].cut || b.parts[1].gone) return false;
  for (const q of b.parts) { q.hp = q.max; q.wounds = q.wounds.filter((w) => w.kind === "stump").map((w) => ({ ...w, bleed: 0 })); q.bloody = 0; q.burn = 0; q.char *= 0.3; q.broken = false; }
  b.blood = 100; b.shock = 0; b.state = "alive"; b.down = 0.6; b.pain = 0; say(b, "+ healed", "#7dffb3");
  return true;
}
function say(b, txt, col) { const h = b.ps[0].gone ? b.ps[1] : b.ps[0]; W.texts.push({ x: h.x, y: h.y - 26, txt, col, life: 1.4 }); }
export function ignite(b, p) {
  if (b.kind === "rag") { const q = b.parts[p ? Math.max(0, p.part) : 1]; if (q && !q.gone) { if (q.burn <= 0) S("fire"); q.burn = Math.max(q.burn, 6); } }
  else if (b.def && b.def.flammable && !(b.burn > 0)) { b.burn = b.def.flammable; S("fire"); }
}
export function floorBelow(x, y) {
  if (W.preview) return y + 60;
  let best = WH;
  for (const s of W.segs) {
    const lo = Math.min(s.ax, s.bx), hi = Math.max(s.ax, s.bx); if (hi - lo < 1 || x < lo || x > hi) continue;
    const yy = s.ay + ((x - s.ax) / (s.bx - s.ax)) * (s.by - s.ay) - s.r;
    if (yy >= y - 6 && yy < best) best = yy;
  }
  return best;
}
export function ceilAbove(x, y) {
  if (W.preview) return y - 150;
  let best = 0;
  for (const s of W.segs) {
    const lo = Math.min(s.ax, s.bx), hi = Math.max(s.ax, s.bx); if (hi - lo < 1 || x < lo || x > hi) continue;
    const yy = s.ay + ((x - s.ax) / (s.bx - s.ax)) * (s.by - s.ay) + s.r;
    if (yy <= y + 6 && yy > best) best = yy;
  }
  return best;
}
function skewer(p, sh, t, sp) {
  if (W.pins.filter((q) => q.sh === sh).length >= 4) return;
  sh.body.bloody = Math.min(1, (sh.body.bloody || 0) + 0.35);
  const pin = { p, sh, t }; W.pins.push(pin); p.skew = pin;
  hurt(p.body, p.part, 18 + sp * 0.02, { type: "stab", x: p.x, y: p.y, dx: 0, dy: 1 });
  S("splat", 1.2);
}

// ---------------------------------------------------------------- blood
export function bleedBurst(b, x, y, dx, dy, n, spd = 1) {
  if (!W.gore || !b.bc || W.preview) return;
  n = Math.min(60, n | 0);
  for (let i = 0; i < n; i++) {
    const s = rnd(60, 380) * spd, a = Math.atan2(dy, dx) + rnd(-0.9, 0.9);
    drop(x, y, Math.cos(a) * s + rnd(-40, 40), Math.sin(a) * s - rnd(0, 120), rnd(1.5, 3.6), pick(b.bc));
  }
}
export function drop(x, y, vx, vy, s, col) {
  if (!W.gore) return;
  W.drops.push({ x, y, vx, vy, s, col });
  if (W.drops.length > 900) W.drops.splice(0, W.drops.length - 900);
}
function segHit(x, y, pad) {
  for (const s of W.segs) {
    const ex = s.bx - s.ax, ey = s.by - s.ay, L2 = ex * ex + ey * ey;
    let t = L2 ? ((x - s.ax) * ex + (y - s.ay) * ey) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = s.ax + ex * t, qy = s.ay + ey * t, dx = x - qx, dy = y - qy, d = Math.hypot(dx, dy);
    if (d < s.r + pad) { const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1; return { s, x: qx + nx * s.r, y: qy + ny * s.r, nx, ny }; }
  }
  return null;
}
function land(d, hit) {
  const c = W.dctx; if (!c) return;
  const sp = Math.hypot(d.vx, d.vy);
  c.fillStyle = d.col; c.globalAlpha = 0.9;
  c.beginPath(); c.arc(hit.x, hit.y, d.s * rnd(0.9, 1.5), 0, 6.283); c.fill();
  const tx = -hit.ny, ty = hit.nx, along = (d.vx * tx + d.vy * ty) / (sp || 1);
  for (let i = 0; i < (sp > 500 ? 3 : 1); i++) { const o = (along + rnd(-0.6, 0.6)) * rnd(3, 14); c.beginPath(); c.arc(hit.x + tx * o, hit.y + ty * o, d.s * rnd(0.3, 0.7), 0, 6.283); c.fill(); }
  c.globalAlpha = 1;
  if (hit.ny < -0.6) addPool(hit.x, hit.y, d.s * d.s, d.col, hit.s, hit.nx, hit.ny);
  else if (Math.abs(hit.nx) > 0.6 && R() < 0.35) W.drips.push({ x: hit.x, y: hit.y, vol: d.s * 1.4, col: d.col, s: hit.s });
}
function addPool(x, y, vol, col, seg, nx, ny) {
  for (const p of W.pools) if (p.col === col && p.seg === seg && Math.abs(p.x - x) < p.tw * 0.5 + 6) { p.vol += vol; p.tw = Math.min(170, 6 + Math.sqrt(p.vol) * 2.2); return; }
  W.pools.push({ x, y, vol, col, seg, w: 2, tw: 6 + Math.sqrt(vol) * 2.2, ang: Math.atan2(-nx, ny) + Math.PI });
  if (W.pools.length > 140) W.pools.shift();
}

// ---------------------------------------------------------------- once-per-frame updates (blood, fire, bits, effects)
export function frame(dt) {
  if (dt <= 0) return;
  for (const b of W.bodies) {
    if (b.kind === "rag") ragFrame(b, dt);
    else if (b.burn > 0) {
      b.burn -= dt; const [cx, cy] = center(b);
      for (let i = 0; i < 2; i++) flame(cx + rnd(-15, 15), cy + rnd(-12, 12), 1);
      for (const o of W.bodies) if (o !== b) for (const p of o.ps) if (!p.gone && Math.abs(p.x - cx) < 34 && Math.abs(p.y - cy) < 34 && R() < dt * 2) ignite(o, p);
      if (b.def && b.def.burnTick) b.def.burnTick(b, dt);
    }
  }
  // drops
  for (let i = W.drops.length - 1; i >= 0; i--) {
    const d = W.drops[i]; d.vy += G * dt;
    const steps = Math.min(4, 1 + ((Math.hypot(d.vx, d.vy) * dt) / 10) | 0); let hit = null;
    for (let k = 0; k < steps && !hit; k++) { d.x += (d.vx * dt) / steps; d.y += (d.vy * dt) / steps; hit = segHit(d.x, d.y, 1); }
    if (hit) { land(d, hit); W.drops.splice(i, 1); }
    else if (d.y > WH + 40 || d.x < -40 || d.x > WW + 40) W.drops.splice(i, 1);
  }
  // drips running down walls
  const c = W.dctx;
  for (let i = W.drips.length - 1; i >= 0; i--) {
    const d = W.drips[i], ny = d.y + (18 + d.vol * 4) * dt;
    if (c) { c.strokeStyle = d.col; c.lineWidth = Math.min(3, 0.8 + d.vol * 0.4); c.lineCap = "round"; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, ny); c.stroke(); }
    d.y = ny; d.vol -= dt * 0.5;
    const h = segHit(d.x, d.y + 3, 0);
    if (d.vol <= 0) W.drips.splice(i, 1);
    else if (!h) { W.drips.splice(i, 1); drop(d.x, d.y, 0, 20, Math.min(3.5, d.vol + 1), d.col); }
    else if (h.ny < -0.6) { addPool(d.x, h.y, d.vol * 3, d.col, h.s, h.nx, h.ny); W.drips.splice(i, 1); }
  }
  for (const p of W.pools) if (p.w < p.tw) p.w = Math.min(p.tw, p.w + dt * 26);
  // chunks
  for (const k of W.chunks) {
    if (k.rest > 1.5) continue;
    k.vy += G * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
    const h = segHit(k.x, k.y, k.r);
    if (h) {
      k.x = h.x + h.nx * k.r; k.y = h.y + h.ny * k.r;
      const vn = k.vx * h.nx + k.vy * h.ny;
      if (vn < 0) { k.vx -= h.nx * vn * 1.3; k.vy -= h.ny * vn * 1.3; k.vx *= 0.75; k.vy *= 0.75; k.vr *= 0.7; if (k.bc && -vn > 200) { const cc = W.dctx; if (cc) { cc.fillStyle = pick(k.bc); cc.beginPath(); cc.arc(h.x, h.y, k.r * 0.9, 0, 6.283); cc.fill(); } } }
      if (Math.hypot(k.vx, k.vy) < 30) k.rest += dt; else k.rest = 0;
    }
    if (k.bc && R() < dt * 6 && Math.hypot(k.vx, k.vy) > 150) drop(k.x, k.y, k.vx * 0.3, k.vy * 0.3, 1.6, pick(k.bc));
  }
  W.chunks = W.chunks.filter((k) => k.y < WH + 60);
  // ground fires
  for (let i = W.fires.length - 1; i >= 0; i--) {
    const f = W.fires[i]; f.life -= dt;
    if (R() < dt * 30 * Math.min(1, f.life)) flame(f.x + rnd(-f.r, f.r) * 0.7, f.y - 4, 1.2);
    for (const b of W.bodies) for (const p of b.ps) if (!p.gone && Math.abs(p.x - f.x) < f.r && p.y > f.y - f.r * 1.3 && p.y < f.y + 12 && R() < dt * 4) ignite(b, p);
    if (f.life <= 0) W.fires.splice(i, 1);
  }
  // flames
  for (let i = W.flames.length - 1; i >= 0; i--) { const f = W.flames[i]; f.life -= dt; f.vy -= 420 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.96; if (f.life <= 0) W.flames.splice(i, 1); }
  // effects + texts
  for (let i = W.fx.length - 1; i >= 0; i--) { const e = W.fx[i]; e.life -= dt; if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.g || 0) * dt; e.vx *= 1 - dt * (e.drag || 0); e.vy *= 1 - dt * (e.drag || 0); } if (e.life <= 0) W.fx.splice(i, 1); }
  for (let i = W.texts.length - 1; i >= 0; i--) { const t = W.texts[i]; t.life -= dt; t.y -= 30 * dt; if (t.life <= 0) W.texts.splice(i, 1); }
  W.shake = Math.max(0, W.shake - dt * 40);
}
export function flame(x, y, s = 1) { if (W.flames.length < 450) W.flames.push({ x, y, vx: rnd(-40, 40), vy: rnd(-120, -20), life: rnd(0.35, 0.7) * s, max: 0.7 * s, s: rnd(6, 12) * s }); }

function ragFrame(b, dt) {
  const alive = b.state !== "dead";
  const beat = alive ? 0.65 + 0.35 * Math.sin(W.time * 9) : 0.35;
  const fade = b.state === "dead" ? Math.max(0, 1 - (W.time - b.deadT) / 28) : 1;
  let total = 0;
  for (const q of b.parts) {
    if (q.gone) continue;
    for (const w of q.wounds) {
      if (w.bleed <= 0) continue;
      const rate = w.bleed * fade * (w.kind === "stump" ? beat * 1.3 : 1);
      total += rate;
      w.bleed *= 1 - dt * 0.015;
      w.acc += rate * dt * (w.kind === "stump" ? 7 : 4);
      if (W.gore && b.bc) {
        while (w.acc >= 1) {
          w.acc -= 1;
          const [x, y, nx, ny] = woundPos(q, w), [vx, vy] = vel(q.a), s = w.kind === "stump" ? rnd(160, 420) * beat : rnd(20, 130);
          drop(x, y, vx * 0.6 + nx * s + rnd(-30, 30), vy * 0.6 + ny * s + rnd(-30, 20), rnd(1.4, w.kind === "stump" ? 3.4 : 2.6), pick(b.bc));
        }
      } else w.acc = 0;
    }
    if (q.burn > 0) {
      q.burn -= dt;
      hurt(b, q.i, 4.5 * dt, { type: "burn" });
      q.char = Math.min(1, q.char + dt * 0.07);
      if (R() < dt * 26) flame(q.a.x + (q.b.x - q.a.x) * R(), q.a.y + (q.b.y - q.a.y) * R(), 0.9);
      if (R() < dt * 0.6) { const n = [PARENT[q.i], ...PARENT.map((p, i) => (p === q.i ? i : -1))].filter((i) => i >= 0 && !b.parts[i].gone && attached(b, i) === attached(b, q.i)); if (n.length) { const o = b.parts[pick(n)]; o.burn = Math.max(o.burn, 4); } }
      if (R() < dt * 3) { const mx = (q.a.x + q.b.x) / 2, my = (q.a.y + q.b.y) / 2; for (const o of W.bodies) if (o !== b) for (const p of o.ps) if (!p.gone && Math.abs(p.x - mx) < 22 && Math.abs(p.y - my) < 22) { ignite(o, p); break; } }
      if (alive) b.pain = 1;
    }
  }
  if (alive) b.blood -= total * dt * 0.9;
  if (b.blood < 0) b.blood = 0;
  vitals(b);
}

// ---------------------------------------------------------------- guns + explosions
function segSeg(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y, rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry; let s, t;
  if (e < 1e-9) { s = clamp(-(d1x * rx + d1y * ry) / a, 0, 1); t = 0; }
  else {
    const c = d1x * rx + d1y * ry, bb = d1x * d2x + d1y * d2y, den = a * e - bb * bb;
    s = den > 1e-9 ? clamp((bb * f - c * e) / den, 0, 1) : 0; t = (bb * s + f) / e;
    if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - c) / a, 0, 1); }
  }
  const dx = p1x + d1x * s - (p2x + d2x * t), dy = p1y + d1y * s - (p2y + d2y * t);
  return [s, dx * dx + dy * dy];
}
export function shoot(x, y, dx, dy, o) {
  const L = o.range || 2200, ex = x + dx * L, ey = y + dy * L, hits = [];
  const test = (ax, ay, bx, by, r, info) => { const [s, d2] = segSeg(x, y, ex, ey, ax, ay, bx, by); if (d2 < r * r) hits.push({ s: s - Math.sqrt(r * r - d2) / L, ...info }); };
  for (const sg of W.segs) test(sg.ax, sg.ay, sg.bx, sg.by, sg.r, { wall: true });
  for (const b of W.bodies) {
    if (b === o.ignore || b.x1 < Math.min(x, ex) - 40 || b.x0 > Math.max(x, ex) + 40 || b.y1 < Math.min(y, ey) - 40 || b.y0 > Math.max(y, ey) + 40) continue;
    for (const sh of b.shapes) {
      if (sh.off) continue;
      if (sh.t === "cap") test(sh.a.x, sh.a.y, sh.b.x, sh.b.y, sh.r + 1, { b, sh });
      else for (let i = 0; i < sh.pts.length; i++) { const a = sh.pts[i], c = sh.pts[(i + 1) % sh.pts.length]; test(a.x, a.y, c.x, c.y, 2, { b, sh }); }
    }
  }
  hits.sort((a, b) => a.s - b.s);
  let pow = o.dmg, pierce = o.pierce || 1, end = L; const seen = new Set();
  for (const hh of hits) {
    if (hh.s < 0) hh.s = 0;
    const hx = x + dx * L * hh.s, hy = y + dy * L * hh.s;
    if (hh.wall) {
      end = L * hh.s; spark(hx, hy, -dx, -dy, 6); S("ric");
      const c = W.dctx; if (c) { c.fillStyle = "rgba(20,16,24,0.85)"; c.beginPath(); c.arc(hx, hy, 2.4, 0, 6.283); c.fill(); }
      break;
    }
    if (seen.has(hh.b)) continue; seen.add(hh.b);
    const b = hh.b;
    if (b.kind === "rag") {
      const q = b.parts[hh.sh.part];
      hurt(b, hh.sh.part, pow, { type: "shot", x: hx, y: hy, dx, dy, sever: o.sever && pow > 50 && R() < 0.5 });
      if (b.bc && W.gore) bleedBurst(b, hx, hy, dx, dy, pow * 0.4, 1.4);
      for (const p of [q.a, q.b]) addVel(p, dx * o.force * p.im * 0.5, dy * o.force * p.im * 0.5);
      if (pow > 90 && q.i >= 3 && R() < 0.5) sever(b, q.i);
      pow *= 0.55; if (--pierce <= 0) { end = L * hh.s; break; }
    } else {
      for (const p of hh.sh.t === "cap" ? [hh.sh.a, hh.sh.b] : hh.sh.pts) addVel(p, dx * o.force * 0.4 * p.im, dy * o.force * 0.4 * p.im);
      if (b.def && b.def.shot) b.def.shot(b, pow, hx, hy);
      spark(hx, hy, -dx, -dy, 5); if (b.def && b.def.metal) S("ric");
      if (!(b.def && b.def.soft)) { end = L * hh.s; break; }
      pow *= 0.6;
    }
  }
  W.fx.push({ t: "tracer", x, y, x2: x + dx * end, y2: y + dy * end, life: 0.07, max: 0.07, w: o.w || 2 });
  W.fx.push({ t: "flash", x, y, a: Math.atan2(dy, dx), life: 0.05, max: 0.05, s: o.flash || 1 });
}
export function spark(x, y, dx, dy, n) {
  for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + rnd(-1, 1), s = rnd(150, 600); W.fx.push({ t: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 1200, life: rnd(0.15, 0.35), max: 0.35 }); }
}
export function explode(x, y, power = 1, o = {}) {
  const Rr = 190 * power;
  W.shake = Math.min(26, W.shake + 12 * power);
  S("boom", power);
  W.fx.push({ t: "boom", x, y, r: Rr * 0.75, life: 0.35, max: 0.35 });
  W.fx.push({ t: "ring", x, y, r: Rr, life: 0.3, max: 0.3 });
  for (let i = 0; i < 14 * power; i++) { const a = R() * 6.283, s = rnd(30, 160); W.fx.push({ t: "smoke", x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, drag: 1.5, life: rnd(0.8, 1.8), max: 1.8, s: rnd(14, 32) * power }); }
  spark(x, y, 0, -1, 26 * power);
  for (let i = 0; i < 20 * power; i++) flame(x + rnd(-40, 40) * power, y + rnd(-30, 30) * power, 1.5);
  const c = W.dctx;
  if (c) { const g = c.createRadialGradient(x, y, 0, x, y, Rr * 0.45); g.addColorStop(0, "rgba(10,8,8,0.55)"); g.addColorStop(1, "rgba(10,8,8,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, Rr * 0.45, 0, 6.283); c.fill(); }
  for (const b of [...W.bodies]) {
    if (b === o.self || b.static) continue;
    for (const p of b.ps) {
      if (p.gone) continue;
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy); if (d > Rr) continue;
      const f = 1 - d / Rr, k = (f * 1700 * power) / Math.sqrt(Math.max(0.5, p.m));
      addVel(p, (dx / (d || 1)) * k, (dy / (d || 1)) * k - k * 0.25);
    }
    if (b.kind === "rag") {
      for (const q of b.parts) {
        if (q.gone) continue;
        const mx = (q.a.x + q.b.x) / 2, my = (q.a.y + q.b.y) / 2, dx = mx - x, dy = my - y, d = Math.hypot(dx, dy); if (d > Rr) continue;
        const f = 1 - d / Rr, nx = dx / (d || 1), ny = dy / (d || 1);
        if (f > 0.72 && power >= 1 && R() < 0.55) gib(b, q.i, nx, ny);
        else { hurt(b, q.i, f * 105 * power, { type: "blast", x: mx, y: my, dx: nx, dy: ny }); if (f > 0.45 && q.i >= 3 && R() < 0.35) sever(b, q.i); }
        if (f > 0.35 && R() < 0.6 && !q.gone) q.burn = Math.max(q.burn, 3 + f * 4);
        q.char = Math.min(1, q.char + f * 0.5);
      }
    } else {
      const [cx, cy] = center(b), d = Math.hypot(cx - x, cy - y);
      if (d < Rr && b.def && b.def.blast) b.def.blast(b, 1 - d / Rr);
      if (d < Rr * 0.6 && b.def && b.def.flammable && R() < 0.6) ignite(b, null);
    }
  }
}
