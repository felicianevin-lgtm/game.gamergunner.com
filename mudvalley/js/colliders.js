// MUD VALLEY RP: the things you can bump into (buildings, trees, rocks, poles), kept in a grid so checking is fast.
// Circles: { x, z, r, top }. Boxes: { x, z, hx, hz, c, s (turn), top }. top = how tall it is (you can jump over low stuff).
import { HALF } from "./layout.js";
const CELL = 16, NC = (HALF * 2) / CELL;
const grid = Array.from({ length: NC * NC }, () => []);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let stamp = 0;

function insert(o, r) {
  const i0 = clamp(Math.floor((o.x - r + HALF) / CELL), 0, NC - 1), i1 = clamp(Math.floor((o.x + r + HALF) / CELL), 0, NC - 1);
  const j0 = clamp(Math.floor((o.z - r + HALF) / CELL), 0, NC - 1), j1 = clamp(Math.floor((o.z + r + HALF) / CELL), 0, NC - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * NC + i].push(o);
}
export function addCircle(x, z, r, top = 99) { const o = { x, z, r, top, k: 0 }; insert(o, r); return o; }
export function addBox(x, z, hx, hz, yaw = 0, top = 99) { const o = { x, z, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), top, box: true, k: 0 }; insert(o, Math.hypot(hx, hz)); return o; }

// everything near (x, z)
export function near(x, z, r, out = []) {
  out.length = 0; stamp++;
  const i0 = clamp(Math.floor((x - r + HALF) / CELL), 0, NC - 1), i1 = clamp(Math.floor((x + r + HALF) / CELL), 0, NC - 1);
  const j0 = clamp(Math.floor((z - r + HALF) / CELL), 0, NC - 1), j1 = clamp(Math.floor((z + r + HALF) / CELL), 0, NC - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const o of grid[j * NC + i]) if (o.k !== stamp) { o.k = stamp; out.push(o); }
  return out;
}

// push a circle (x, z, r) out of anything it overlaps. Returns { x, z, nx, nz, hit } (hit = how deep it went)
const res = { x: 0, z: 0, nx: 0, nz: 0, hit: 0, top: 0 };
const list = [];
export function pushOut(x, z, r, y = 0) {
  res.hit = 0; res.nx = 0; res.nz = 0; res.top = -1e9;
  for (const o of near(x, z, r + 4, list)) {
    if (y > o.top) continue;
    if (o.box) {
      // into the box's own directions
      const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      const cx = clamp(lx, -o.hx, o.hx), cz = clamp(lz, -o.hz, o.hz);
      let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez), pen;
      if (d > 1e-6) { if (d >= r) continue; pen = r - d; ex /= d; ez /= d; }
      else { // the middle is inside: push out the nearest side
        const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
        if (px < pz) { ex = Math.sign(lx) || 1; ez = 0; pen = px + r; } else { ex = 0; ez = Math.sign(lz) || 1; pen = pz + r; }
      }
      const nx = ex * o.c + ez * o.s, nz = -ex * o.s + ez * o.c;
      x += nx * pen; z += nz * pen; res.nx += nx; res.nz += nz; res.hit = Math.max(res.hit, pen); res.top = Math.max(res.top, o.top);
    } else {
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
      if (d >= m) continue;
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0, pen = m - d;
      x += nx * pen; z += nz * pen; res.nx += nx; res.nz += nz; res.hit = Math.max(res.hit, pen); res.top = Math.max(res.top, o.top);
    }
  }
  const l = Math.hypot(res.nx, res.nz); if (l > 0) { res.nx /= l; res.nz /= l; }
  res.x = x; res.z = z;
  return res;
}
