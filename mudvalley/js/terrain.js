// MUD VALLEY RP: the ground. Builds the hills, the river, the roads and trails, mud pits and jumps,
// and answers "how high is the ground here?" and "is this road, dirt or mud?" for the driving physics.
import * as THREE from "/create/vendor/three.module.js";
import { bakeGroup } from "./vehicles.js";
import { HALF, EDGE, WATER_Y, riverX, RIVER_W, FORD_Z, MOUNTAIN, MANSION_HILL, POND, LAKE, FROST, RING_R, SPOKES, FLATS, ROADS, TRAILS, MUDS, RAMPS, MOTO_TRACK, SPEEDWAY, DRIFT_TRACK } from "./layout.js";

export const CELL = 5, N = (HALF * 2) / CELL; // the height grid: N x N squares of 5 m
const V = N + 1;
const H = new Float32Array(V * V);
// what the ground is made of, on a finer 2 m grid
export const SURF = { GRASS: 0, ROAD: 1, DIRT: 2, MUD: 3, WATER: 4, SAND: 5, ROCK: 6, TRACK: 7, TOWN: 8 };
const SC = 2, SN = (HALF * 2) / SC;
const S = new Uint8Array(SN * SN);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- smooth random bumps (value noise)
function hash(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, z, oct = 4) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let k = 0; k < oct; k++) { s += a * vnoise(x * f + k * 17.3, z * f - k * 9.1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const gauss = (x, z, m) => m.h * Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (2 * m.s * m.s));
const WATERS = [POND, LAKE];

// ---------------------------------------------------------------- the new lands outside the old valley
// how much of each land a spot is in: [outside the valley, east desert, west woods, south plains, north mountains]
const BW = [0, 0, 0, 0, 0];
export function biome(x, z) {
  const r = Math.hypot(x, z) || 1;
  BW[0] = smooth(560, 820, Math.max(Math.abs(x), Math.abs(z)));
  BW[1] = Math.max(0, x / r) ** 2; BW[2] = Math.max(0, -x / r) ** 2; BW[3] = Math.max(0, z / r) ** 2; BW[4] = Math.max(0, -z / r) ** 2;
  return BW;
}
export const desertAt = (x, z) => { const b = biome(x, z); return b[0] * b[1]; };
// 1 right next to the big highways (the hills and mountains make room for them), 0 far away
function corridor(x, z) {
  let d = Math.abs(Math.hypot(x, z) - RING_R);
  for (const [[x0, z0], [x1, z1]] of SPOKES) {
    const dx = x1 - x0, dz = z1 - z0, t = clamp(((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - x0 - dx * t, z - z0 - dz * t));
  }
  return 1 - smooth(25, 120, d);
}
function outerH(x, z) {
  const b = biome(x, z), out = b[0];
  if (out <= 0) return 0;
  const cor = corridor(x, z);
  let h = 0;
  if (b[1] > 0.01) { // Red Rock Desert: flat sand, rolling dunes and tall red rock mesas
    const n = fbm(x / 260 + 40, z / 260, 3), mesa = smooth(0.2, 0.27, n) * 38 + smooth(0.42, 0.47, n) * 22;
    h += b[1] * (2 + 2.2 * Math.sin(x / 31 + Math.sin(z / 47) * 2) * Math.sin(z / 23) + mesa * (1 - 0.95 * cor));
  }
  if (b[4] > 0.01) { // Frostpine Mountains: big snowy ridges
    const rg = 1 - Math.abs(fbm(x / 300 - 20, z / 300 + 9, 4));
    h += b[4] * (8 + (rg * rg * 120 * smooth(700, 1100, -z) + gauss(x, z, FROST)) * (1 - 0.9 * cor));
  }
  if (b[2] > 0.01) h += b[2] * (6 + 24 * fbm(x / 160 - 3, z / 160 + 5, 3) * (1 - 0.6 * cor)); // the Big Woods: rolling forest hills
  if (b[3] > 0.01) h += b[3] * (2 + 6 * fbm(x / 200 + 7, z / 200 - 1, 3)); // the south plains
  return out * h;
}

// the natural land before roads get cut in
function rawH(x, z) {
  let h = 3 + 4 * fbm(x / 150, z / 150, 3);
  h += smooth(150, 230, x) * 9 * fbm(x / 60 + 11, z / 60 - 7, 3); // bumpy off-road hills in the east
  h += smooth(EDGE - 18, HALF, Math.max(Math.abs(x), Math.abs(z))) * 95; // big hills all around the edge of the map
  h += outerH(x, z); // the new lands
  const mt = gauss(x, z, MOUNTAIN);
  h += mt + gauss(x, z, MANSION_HILL);
  h += smooth(0.08, 0.5, mt / MOUNTAIN.h) * (1 - smooth(0.8, 0.97, mt / MOUNTAIN.h)) * 9 * fbm(x / 34 + 5, z / 34 - 3, 3); // rocky bumps on the mountain sides
  const d = x - riverX(z);
  h -= 4 * Math.exp(-(d * d) / (2 * 35 * 35)); // the land dips down towards the river
  if (h < 0.4) h = 0.4 - (0.4 - h) * 0.15; // (low spots stay just above the water: no surprise puddles)
  return h;
}
function flatW(x, z, f) { // 1 inside a flat area, fading to 0 around it
  const dx = Math.abs(x - f.x) - f.hx, dz = Math.abs(z - f.z) - f.hz;
  const d = Math.max(dx, dz, 0);
  return 1 - smooth(0, f.b, d);
}
function landH(x, z) {
  let h = rawH(x, z);
  for (const f of FLATS) { const w = flatW(x, z, f); if (w > 0) h = lerp(h, f.fy, w); }
  // the river: a channel with a shallow ford where the trail crosses
  const d = Math.abs(x - riverX(z));
  if (d < RIVER_W + 16) {
    const deep = lerp(1.5, 0.45, 1 - smooth(10, 26, Math.abs(z - FORD_Z)));
    const bed = d < RIVER_W ? WATER_Y - deep * (1 - (d / RIVER_W) ** 2) : WATER_Y + 0.25 * ((d - RIVER_W) / 16);
    const w = 1 - smooth(RIVER_W, RIVER_W + 16, d);
    h = Math.min(h, lerp(h, bed, w)), h = d < RIVER_W ? Math.min(h, bed) : h;
  }
  // Lily Pond + Big Bass Lake: round bowls of water with sandy shores
  for (const P of WATERS) {
    const dp = Math.hypot(x - P.x, z - P.z), sh = P.r > 60 ? 30 : 14;
    if (dp < P.r + sh) {
      const bed = dp < P.r ? WATER_Y - 0.4 - (P.r > 60 ? 5 : 2.6) * (1 - (dp / P.r) ** 2) : WATER_Y + 0.3 + 2.4 * smooth(P.r, P.r + sh, dp);
      h = dp < P.r ? bed : Math.min(h, bed);
    }
  }
  return h;
}

// ---------------------------------------------------------------- paths: roads, trails and racetracks
// turns a few control points into a smooth curve with a point every `step` meters
export function samplePath(ctrl, closed = false, step = 3) {
  const P = ctrl.map((p) => ({ x: p[0], z: p[1] }));
  const n = P.length, out = [];
  const get = (i) => (closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z), m = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  if (!closed) out.push({ ...P[n - 1] });
  const x = out.map((p) => p.x), z = out.map((p) => p.z), cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]));
  const len = cum[cum.length - 1] + (closed ? Math.hypot(x[0] - x[x.length - 1], z[0] - z[z.length - 1]) : 0);
  return { x, z, cum, len, closed, n: out.length };
}

export const PATHS = []; // every road / trail / track: { kind, w, x[], z[], e[] (height), bridge[] }
export const TRACKS = {}; // moto, speedway, summit (for races)
export const RAMP_LIST = []; // all jumps (with the motocross ones)
const BRIDGES = [];
const MUD_LIST = [];

// ---------------------------------------------------------------- build everything (called once)
export function buildGround() {
  for (const f of FLATS) f.fy = f.y ?? rawH(f.x, f.z);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) H[j * V + i] = landH(-HALF + i * CELL, -HALF + j * CELL);
  // mud pits sit in little flat dips
  for (const m of MUDS) { m.y = 0; let c = 0; for (let a = 0; a < 8; a++) { m.y += hAt(m.x + Math.cos(a) * m.r, m.z + Math.sin(a) * m.r); c++; } m.y /= c; MUD_LIST.push(m); }

  const add = (def, kind) => {
    const p = samplePath(def.pts, !!def.loop || kind === "track" || kind === "speedway", 3);
    p.kind = kind; p.w = def.w; p.town = !!def.town; p.main = !!def.main; p.name = def.name;
    p.e = []; p.bridge = []; p.ford = [];
    for (let i = 0; i < p.n; i++) {
      const d = Math.abs(p.x[i] - riverX(p.z[i]));
      p.bridge.push(d < RIVER_W + 9 && !def.ford); p.ford.push(d < RIVER_W + 6 && !!def.ford);
      p.e.push(hAt(p.x[i], p.z[i]));
    }
    // smooth the height along the road so it doesn't go bumpy
    const passes = p.town ? 0 : 10;
    for (let k = 0; k < passes; k++) {
      const e = p.e.slice();
      for (let i = 0; i < p.n; i++) {
        const a = p.closed ? e[(i - 1 + p.n) % p.n] : e[Math.max(0, i - 1)], c = p.closed ? e[(i + 1) % p.n] : e[Math.min(p.n - 1, i + 1)];
        p.e[i] = (a + 2 * e[i] + c) / 4;
      }
    }
    // a bridge goes straight across the river
    for (let i = 0; i < p.n; i++) if (p.bridge[i]) {
      let a = i; while (a > 0 && p.bridge[a]) a--;
      let b = i; while (b < p.n - 1 && p.bridge[b]) b++;
      p.e[i] = Math.max(WATER_Y + 2.4, lerp(p.e[a], p.e[b], (p.cum[i] - p.cum[a]) / Math.max(1, p.cum[b] - p.cum[a])));
    }
    // ramps up to each end of a bridge (no step where the bridge starts)
    if (p.bridge.some((v) => v)) {
      for (let i = 0; i < p.n; i++) if (!p.bridge[i]) {
        let best = 1e9, top = 0;
        for (let k = 0; k < p.n; k++) if (p.bridge[k]) { const d = Math.abs(p.cum[i] - p.cum[k]); if (d < best) { best = d; top = p.e[k]; } }
        p.e[i] = Math.max(p.e[i], top - best * 0.07);
      }
      BRIDGES.push(p);
    }
    p.minX = Math.min(...p.x); p.maxX = Math.max(...p.x); p.minZ = Math.min(...p.z); p.maxZ = Math.max(...p.z);
    PATHS.push(p);
    return p;
  };
  for (const r of ROADS) add(r, "road");
  for (const t of TRAILS) add(t, "trail");
  TRACKS.moto = add({ pts: MOTO_TRACK, w: 12 }, "track");
  { let bi = 0, bd = 1e9; for (let i = 0; i < TRACKS.moto.n; i++) { const d = (TRACKS.moto.x[i] - 247) ** 2 + (TRACKS.moto.z[i] + 12) ** 2; if (d < bd) { bd = d; bi = i; } } TRACKS.moto.start0 = bi; }
  TRACKS.speedway = add({ pts: SPEEDWAY, w: 16 }, "speedway");
  TRACKS.summit = PATHS.find((p) => p.name === "mountain");
  TRACKS.single = PATHS.find((p) => p.name === "single");
  TRACKS.drift = add({ pts: DRIFT_TRACK, w: 15 }, "speedway");
  flattenPaths();
  for (const m of MUD_LIST) dig(m);
  // the road's height = the ground under it (bridges keep their deck height), so what you see is what you drive on
  for (const p of PATHS) for (let i = 0; i < p.n; i++) p.e[i] = p.bridge[i] ? Math.max(p.e[i], hAt(p.x[i], p.z[i])) : hAt(p.x[i], p.z[i]);
  // jumps on the motocross track
  const mt = TRACKS.moto;
  // (dirt "tabletop" jumps: up, a flat top, then a smooth landing slope). They only go on straight parts of the track,
  // so you always land back on the track (never off into the hay bales or out of the park).
  {
    const head = (i) => { const a = ((i % mt.n) + mt.n) % mt.n, b = (a + 1) % mt.n; return Math.atan2(mt.x[b] - mt.x[a], mt.z[b] - mt.z[a]); };
    const turn = (i) => { let m = 0; const h0 = head(i); for (let k = -2; k <= 16; k++) { const d = head(i + k); m = Math.max(m, Math.abs(Math.atan2(Math.sin(d - h0), Math.cos(d - h0)))); } return m; };
    const picks = [], hs = [2.0, 2.4, 2.2, 2.0, 2.3];
    for (let i = 0; i < mt.n && picks.length < 5; i++) {
      const ds = Math.min(Math.abs(i - mt.start0), mt.n - Math.abs(i - mt.start0));
      if (turn(i) > 0.3 || ds < 8) continue;
      if (picks.some((q) => Math.min(Math.abs(q - i), mt.n - Math.abs(q - i)) < mt.n / 7)) continue;
      picks.push(i);
    }
    picks.forEach((i, k) => { const j = (i + 2) % mt.n; RAMP_LIST.push({ x: mt.x[i], z: mt.z[i], yaw: Math.atan2(mt.x[j] - mt.x[i], mt.z[j] - mt.z[i]), len: 7, top: 4, down: 9, w: 11.5, h: hs[k], track: true }); });
  }
  { const i = Math.floor(0.66 * mt.n); const m = { x: mt.x[i], z: mt.z[i], r: 7 }; m.y = hAt(m.x, m.z); dig(m); MUD_LIST.push(m); }
  for (const r of RAMPS) RAMP_LIST.push({ ...r });
  for (const r of RAMP_LIST) { r.top = r.top || 0; r.down = r.down || 0; r.total = r.len + r.top + r.down; r.c = Math.cos(r.yaw); r.s = Math.sin(r.yaw); r.cx = r.x + r.s * r.total / 2; r.cz = r.z + r.c * r.total / 2; r.br = Math.hypot(r.total / 2, r.w / 2) + 1; }
  paintSurfaces();
  // spots on roads + trails (for putting lost vehicles back somewhere safe)
  for (const p of PATHS) if (p.kind !== "speedway" && p.kind !== "track") for (let i = 2; i < p.n - 2; i += 3) if (!p.bridge[i] && !p.ford[i] && hAt(p.x[i], p.z[i]) > WATER_Y + 0.4) {
    const j = i + 1; ROAD_PTS.push({ x: p.x[i], z: p.z[i], yaw: Math.atan2(p.x[j] - p.x[i], p.z[j] - p.z[i]), road: p.kind === "road" });
  }
}
const ROAD_PTS = [];
const inChannel = (x, z) => Math.abs(x - riverX(z)) < RIVER_W + 1.5;
// the nearest safe spot on a road or trail (roadsOnly: paved roads only)
export function nearestRoad(x, z, roadsOnly = false) {
  let b = null, bd = 1e18;
  for (const p of ROAD_PTS) { if (roadsOnly && !p.road) continue; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = p; } }
  return b || { x: 0, z: 0, yaw: 0 };
}
export const roadPoints = () => ROAD_PTS;

// speed limits: 35 mph on town streets, 55 mph on the highways (0 = not on a paved road)
export const LIMIT_TOWN = 35, LIMIT_HWY = 55;
export function speedLimitAt(x, z) {
  for (const p of PATHS) {
    if (p.kind !== "road") continue;
    const r = p.w / 2 + 3;
    if (x < p.minX - r || x > p.maxX + r || z < p.minZ - r || z > p.maxZ + r) continue;
    for (let i = 0; i < p.n; i++) if (Math.abs(p.x[i] - x) < r && Math.abs(p.z[i] - z) < r) return p.town ? LIMIT_TOWN : LIMIT_HWY;
  }
  return 0;
}
// the paved roads as a network: for every spot on a road, the spots on other roads it touches (junctions)
let NET = null;
export function roadNet() {
  if (NET) return NET;
  const roads = PATHS.filter((p) => p.kind === "road"), C = 8, grid = new Map(), key = (i, j) => i * 100000 + j;
  roads.forEach((p, a) => { for (let i = 0; i < p.n; i++) { const k = key(Math.floor(p.x[i] / C), Math.floor(p.z[i] / C)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([a, i]); } });
  const links = roads.map((p, a) => Array.from({ length: p.n }, (_, i) => {
    const best = new Map(), gx = Math.floor(p.x[i] / C), gz = Math.floor(p.z[i] / C);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const [b, j] of grid.get(key(gx + dx, gz + dz)) || []) {
      if (b === a) continue;
      const d = Math.hypot(roads[b].x[j] - p.x[i], roads[b].z[j] - p.z[i]);
      if (d < 7 && (!best.has(b) || d < best.get(b)[1])) best.set(b, [j, d]);
    }
    return [...best].map(([b, [j]]) => [b, j]);
  }));
  return (NET = { roads, links });
}

// lower the land along every road / trail / track to the road's own smooth height
function flattenPaths() {
  const BIN = 20, NB = (HALF * 2) / BIN, bins = Array.from({ length: NB * NB }, () => []);
  for (const p of PATHS) {
    const last = p.closed ? p.n : p.n - 1;
    for (let i = 0; i < last; i++) {
      const k = (i + 1) % p.n;
      if (p.ford[i] || p.ford[k]) continue;
      const br = p.bridge[i] || p.bridge[k];
      if (br && (inChannel(p.x[i], p.z[i]) || inChannel(p.x[k], p.z[k]))) continue; // (the bridge itself: leave the river alone)
      const reach = p.w / 2 + 15;
      const seg = { x0: p.x[i], z0: p.z[i], x1: p.x[k], z1: p.z[k], e0: p.e[i], e1: p.e[k], hw: p.w / 2, br };
      const bx0 = Math.floor((Math.min(seg.x0, seg.x1) - reach + HALF) / BIN), bx1 = Math.floor((Math.max(seg.x0, seg.x1) + reach + HALF) / BIN);
      const bz0 = Math.floor((Math.min(seg.z0, seg.z1) - reach + HALF) / BIN), bz1 = Math.floor((Math.max(seg.z0, seg.z1) + reach + HALF) / BIN);
      for (let bz = Math.max(0, bz0); bz <= Math.min(NB - 1, bz1); bz++) for (let bx = Math.max(0, bx0); bx <= Math.min(NB - 1, bx1); bx++) bins[bz * NB + bx].push(seg);
    }
  }
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    const bx = clamp(Math.floor((x + HALF) / BIN), 0, NB - 1), bz = clamp(Math.floor((z + HALF) / BIN), 0, NB - 1);
    let bw = 0, be = 0; const chan = inChannel(x, z);
    for (const s of bins[bz * NB + bx]) {
      if (s.br && chan) continue;
      const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - s.x0) * dx + (z - s.z0) * dz) / l2, 0, 1);
      const d = Math.hypot(x - (s.x0 + dx * t), z - (s.z0 + dz * t));
      const w = 1 - smooth(s.hw + 5.5, s.hw + 14, d); // (a wide flat shelf, so trails up the mountain stay flat side to side)
      if (w > bw) { bw = w; be = lerp(s.e0, s.e1, t); }
    }
    if (bw > 0) H[j * V + i] = lerp(H[j * V + i], be, bw);
  }
}
function dig(m) { // a mud pit: flatten a little circle, then scoop out the middle
  const i0 = Math.max(0, Math.floor((m.x - m.r - 8 + HALF) / CELL)), i1 = Math.min(V - 1, Math.ceil((m.x + m.r + 8 + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((m.z - m.r - 8 + HALF) / CELL)), j1 = Math.min(V - 1, Math.ceil((m.z + m.r + 8 + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, d = Math.hypot(x - m.x, z - m.z);
    if (d > m.r + 7) continue;
    const k = j * V + i;
    H[k] = lerp(H[k], m.y, 1 - smooth(m.r, m.r + 7, d));
    if (d < m.r) H[k] -= 0.7 * (1 - (d / m.r) ** 2);
  }
}

// ---------------------------------------------------------------- what the ground is made of
function stamp(x, z, r, code, keep) {
  const i0 = Math.floor((x - r + HALF) / SC), i1 = Math.floor((x + r + HALF) / SC), j0 = Math.floor((z - r + HALF) / SC), j1 = Math.floor((z + r + HALF) / SC);
  for (let j = Math.max(0, j0); j <= Math.min(SN - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(SN - 1, i1); i++) {
    const cx = -HALF + (i + 0.5) * SC, cz = -HALF + (j + 0.5) * SC;
    if ((cx - x) ** 2 + (cz - z) ** 2 > r * r) continue;
    if (keep && keep(S[j * SN + i])) continue;
    S[j * SN + i] = code;
  }
}
function paintSurfaces() {
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
    const x = -HALF + (i + 0.5) * SC, z = -HALF + (j + 0.5) * SC, h = hAt(x, z);
    let c = SURF.GRASS;
    if ((Math.abs(x) < 116 && Math.abs(z) < 106) || inCC(x, z)) c = SURF.TOWN;
    else if (Math.abs(x - riverX(z)) < RIVER_W + 5 || WATERS.some((P) => Math.abs(Math.hypot(x - P.x, z - P.z) - P.r - 3) < 6)) c = SURF.SAND;
    else if (h > 100 || slopeAt(x, z) > 0.95) c = SURF.ROCK;
    else if (desertAt(x, z) > 0.45) c = SURF.SAND; // desert sand
    S[j * SN + i] = c;
  }
  const order = [["trail", SURF.DIRT], ["track", SURF.TRACK], ["road", SURF.ROAD], ["speedway", SURF.ROAD]];
  for (const [kind, code] of order) for (const p of PATHS) if (p.kind === kind) for (let i = 0; i < p.n; i++) stamp(p.x[i], p.z[i], p.w / 2 + (kind === "speedway" ? 1.4 : 0.3), code);
  for (const m of MUD_LIST) stamp(m.x, m.z, m.r * 0.92, SURF.MUD, (c) => c === SURF.ROAD);
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
    const x = -HALF + (i + 0.5) * SC, z = -HALF + (j + 0.5) * SC;
    if (hAt(x, z) < WATER_Y - 0.05 && S[j * SN + i] !== SURF.ROAD) S[j * SN + i] = SURF.WATER;
  }
}

export const inCC = (x, z) => Math.abs(x - 400) < 104 && Math.abs(z + 318) < 48; // Copper Creek's paved town square
// ---------------------------------------------------------------- questions the game asks
// height of the bare land (exactly matches the triangles you see)
export function hAt(x, z) {
  const gx = clamp((x + HALF) / CELL, 0, N - 0.0001), gz = clamp((z + HALF) / CELL, 0, N - 0.0001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * V + i;
  const ha = H[k], hb = H[k + 1], hc = H[k + V], hd = H[k + V + 1];
  return fx + fz <= 1 ? ha + (hb - ha) * fx + (hc - ha) * fz : hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
}
function slopeAt(x, z) { return Math.hypot(hAt(x + 1.5, z) - hAt(x - 1.5, z), hAt(x, z + 1.5) - hAt(x, z - 1.5)) / 3; }
// how high a jump is at a spot (0 = not on a jump)
// the height of a jump at distance u along it
const rampH = (r, u) => (u < r.len ? (r.h * u) / r.len : u < r.len + r.top ? r.h : r.down ? r.h * (1 - (u - r.len - r.top) / r.down) : 0);
export function rampAt(x, z) {
  let best = 0;
  for (const r of RAMP_LIST) {
    if (Math.abs(x - r.cx) > r.br || Math.abs(z - r.cz) > r.br) continue;
    const dx = x - r.x, dz = z - r.z, u = dx * r.s + dz * r.c, v = dx * r.c - dz * r.s;
    if (u < 0 || u > r.total || Math.abs(v) > r.w / 2) continue;
    best = Math.max(best, rampH(r, u));
  }
  return best;
}
// the deck height of the nearest bridge piece (no gaps where the road bends a little)
function bridgeAt(x, z) {
  let best = -1e9, bd = 1e9;
  for (const p of BRIDGES) for (let i = 0; i < p.n - 1; i++) {
    if (!p.bridge[i] && !p.bridge[i + 1]) continue;
    const dx = p.x[i + 1] - p.x[i], dz = p.z[i + 1] - p.z[i], l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - p.x[i]) * dx + (z - p.z[i]) * dz) / l2, 0, 1);
    const d = Math.hypot(x - p.x[i] - dx * t, z - p.z[i] - dz * t);
    if (d < p.w / 2 + 0.6 && d < bd) { bd = d; best = lerp(p.e[i], p.e[i + 1], t); }
  }
  return best;
}
// flat wooden things you can stand and drive on (docks): { x, z, hx, hz, yaw, y = the top }
const PLATFORMS = [];
export function addPlatform(x, z, hx, hz, yaw, y) { PLATFORMS.push({ x, z, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), y, r: Math.hypot(hx, hz) }); }
function platformAt(x, z) {
  let best = -1e9;
  for (const p of PLATFORMS) {
    const dx = x - p.x, dz = z - p.z; if (Math.abs(dx) > p.r || Math.abs(dz) > p.r) continue;
    if (Math.abs(dx * p.c - dz * p.s) < p.hx && Math.abs(dx * p.s + dz * p.c) < p.hz) best = Math.max(best, p.y);
  }
  return best;
}
// the height you drive on: land, jumps, docks and the bridges
export function groundAt(x, z) {
  let h = hAt(x, z) + rampAt(x, z);
  if (PLATFORMS.length) { const p = platformAt(x, z); if (p > h) h = p; }
  const b = Math.abs(x - riverX(z)) < RIVER_W + 12 ? bridgeAt(x, z) : -1e9;
  return b > h - 0.5 ? Math.max(h, b) : h;
}
export const onPlatform = (x, z) => PLATFORMS.length > 0 && platformAt(x, z) > hAt(x, z);
export function surfaceAt(x, z) {
  if (rampAt(x, z) > 0) return SURF.DIRT;
  if (onPlatform(x, z)) return SURF.ROAD;
  const i = clamp(Math.floor((x + HALF) / SC), 0, SN - 1), j = clamp(Math.floor((z + HALF) / SC), 0, SN - 1);
  const s = S[j * SN + i];
  if (s === SURF.WATER && groundAt(x, z) > WATER_Y + 0.5) return SURF.ROAD; // on the bridge
  return s;
}
export const waterDepth = (x, z) => WATER_Y - groundAt(x, z);
export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = 1.2;
  return out.set(groundAt(x - e, z) - groundAt(x + e, z), 2 * e, groundAt(x, z - e) - groundAt(x, z + e)).normalize();
}
export const mudPits = () => MUD_LIST;

// ---------------------------------------------------------------- textures made in code
function canvasTex(w, h, draw, rep = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, cols, size = 2) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, size, size); } }
const TEX = {};
function makeTextures() {
  TEX.road = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#4b4e57"; g.fillRect(0, 0, w, h); speckle(g, w, h, 500, ["#55585f", "#43464d", "#5c5f66"]);
    g.fillStyle = "#e8e8e8"; g.fillRect(2, 0, 3, h); g.fillRect(w - 5, 0, 3, h);
    g.fillStyle = "#ffcf2a"; g.fillRect(w / 2 - 2, 0, 4, h * 0.55);
  });
  TEX.street = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#4f525a"; g.fillRect(0, 0, w, h); speckle(g, w, h, 500, ["#585b62", "#474a51", "#5f6269"]);
    g.fillStyle = "rgba(240,240,240,0.7)"; g.fillRect(2, 0, 2, h); g.fillRect(w - 4, 0, 2, h);
  });
  TEX.dirt = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#a27a4e"; g.fillRect(0, 0, w, h); speckle(g, w, h, 700, ["#8f6a42", "#b48a5a", "#7d5c39", "#c09a6a"], 3);
    g.fillStyle = "rgba(90,60,30,0.35)"; g.fillRect(w * 0.22, 0, 7, h); g.fillRect(w * 0.68, 0, 7, h); // tire ruts
    g.fillStyle = "rgba(120,170,70,0.5)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() < 0.5 ? Math.random() * 6 : w - Math.random() * 6, Math.random() * h, 3, 5);
  });
  TEX.track = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#b5824e"; g.fillRect(0, 0, w, h); speckle(g, w, h, 800, ["#a07040", "#c8955c", "#8c6034", "#d2a46e"], 3);
    g.fillStyle = "rgba(100,64,30,0.3)"; for (let k = 0; k < 4; k++) g.fillRect(w * (0.15 + k * 0.22), 0, 5, h);
  });
  TEX.speedway = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#44474f"; g.fillRect(0, 0, w, h); speckle(g, w, h, 600, ["#4e5159", "#3c3f46", "#555860"]);
    for (let y = 0; y < h; y += 16) { g.fillStyle = (y / 16) % 2 ? "#e8e8e8" : "#e0302a"; g.fillRect(0, y, 6, 16); g.fillRect(w - 6, y, 6, 16); }
  });
  TEX.water = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = "#d4e6f0"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff"; g.globalAlpha = 0.7;
    for (let i = 0; i < 26; i++) { g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 1.5); }
  });
  TEX.mud = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = "#5a3d24"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = ["#4a311c", "#6a4a2c", "#3f2a18"][i % 3]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 7); g.fill(); }
  });
  TEX.wood = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = "#b98a4e"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { g.fillStyle = "#8a5f30"; g.fillRect(0, y, w, 1.5); }
    speckle(g, w, h, 120, ["#a6783f", "#c99a5e"], 2);
    g.fillStyle = "#ffcf2a"; g.fillRect(0, h - 10, w, 10); g.fillStyle = "#222"; for (let x = 0; x < w; x += 16) g.fillRect(x, h - 10, 8, 10);
  });
}
export const textures = () => TEX;

// ---------------------------------------------------------------- meshes
const tmpC = new THREE.Color();
function groundColor(x, z, h, out) {
  const n = fbm(x / 23, z / 23, 2);
  const i = clamp(Math.floor((x + HALF) / SC), 0, SN - 1), j = clamp(Math.floor((z + HALF) / SC), 0, SN - 1), s = S[j * SN + i];
  const sl = slopeAt(x, z);
  const de = s === SURF.SAND || s === SURF.ROCK || s === SURF.GRASS ? desertAt(x, z) : 0;
  if (de > 0.45 && (s === SURF.ROCK || sl > 0.45 || h > 17)) out.setRGB(0.55, 0.16, 0.07).lerp(tmpC.setRGB(0.74, 0.31, 0.12), 0.5 + 0.5 * Math.sin(h / 2.6)); // red rock mesas (with stripes)
  else if (de > 0.45 && s === SURF.SAND) out.setRGB(0.8 + n * 0.04, 0.42 + n * 0.04, 0.2); // red desert sand
  else if (s === SURF.SAND || s === SURF.WATER) out.setRGB(0.83, 0.75, 0.52);
  else if (s === SURF.DIRT || s === SURF.TRACK) out.setRGB(0.6, 0.45, 0.29);
  else if (s === SURF.MUD) out.setRGB(0.36, 0.25, 0.15);
  else if (s === SURF.ROAD) out.setRGB(0.42, 0.44, 0.38);
  else if (s === SURF.TOWN) { if (inCC(x, z)) out.setRGB(0.66, 0.62, 0.56); else out.setRGB(0.47, 0.72, 0.33); }
  else if (h > 132 + n * 8) out.setRGB(0.95, 0.96, 1.0); // snow on top of Thunder Peak
  else if (s === SURF.ROCK || sl > 0.95) out.setRGB(0.5, 0.47, 0.43);
  else if (sl > 0.6) out.setRGB(0.36, 0.56, 0.3).lerp(tmpC.setRGB(0.5, 0.47, 0.43), (sl - 0.6) / 0.35);
  else {
    out.setRGB(0.42 + n * 0.06, 0.72 + n * 0.08, 0.3 + n * 0.05); // grass
    if (h > 30) out.lerp(tmpC.setRGB(0.3, 0.55, 0.28), clamp((h - 30) / 40, 0, 1));
    if (h > 95) out.lerp(tmpC.setRGB(0.5, 0.47, 0.43), clamp((h - 95) / 30, 0, 1));
  }
  out.multiplyScalar(0.94 + hash(Math.floor(x), Math.floor(z)) * 0.12);
  return out;
}
export function buildGroundMeshes(scene) {
  makeTextures();
  const group = new THREE.Group(); scene.add(group);
  // the land, cut into 24 x 24 chunks so the computer only draws what the camera sees
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const CH = 24, cs = N / CH, col = new THREE.Color();
  for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CH; ci++) {
    const pos = [], cols = [], idx = [];
    for (let j = 0; j <= cs; j++) for (let i = 0; i <= cs; i++) {
      const gi = ci * cs + i, gj = cj * cs + j, x = -HALF + gi * CELL, z = -HALF + gj * CELL, h = H[gj * V + gi];
      pos.push(x, h, z); groundColor(x, z, h, col); cols.push(col.r, col.g, col.b);
    }
    const W = cs + 1;
    for (let j = 0; j < cs; j++) for (let i = 0; i < cs; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m);
  }
  // roads, trails and tracks: ribbons laid on top of the land
  const kinds = { road: [], street: [], trail: [], track: [], speedway: [] };
  PATHS.forEach((p, n) => {
    const k = p.kind === "road" ? (p.town && !p.main ? "street" : "road") : p.kind;
    kinds[k].push(ribbon(p, p.w / 2 + (p.kind === "speedway" ? 1.4 : 0), 0.1 + (k === "street" ? 0.02 : 0) + n * 0.0015));
  });
  for (const k in kinds) {
    if (!kinds[k].length) continue;
    const m = new THREE.Mesh(merge(kinds[k]), new THREE.MeshLambertMaterial({ map: TEX[k === "trail" ? "dirt" : k], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; group.add(m);
  }
  // the river
  {
    const pos = [], uv = [], idx = [];
    let row = 0;
    for (let z = -HALF - 10; z <= HALF + 10; z += 6, row++) {
      const x = riverX(z), w = RIVER_W + 5;
      pos.push(x - w, WATER_Y, z, x + w, WATER_Y, z); uv.push(0, z / 20, 2, z / 20);
      if (row) { const a = (row - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const water = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x2f9fd8, map: TEX.water, transparent: true, opacity: 0.84, shininess: 90, specular: 0xaaddff }));
    water.receiveShadow = true; group.add(water); group.userData.water = TEX.water;
  }
  // Lily Pond + Big Bass Lake
  for (const P of WATERS) {
    const g = new THREE.CircleGeometry(P.r + 4, P.r > 60 ? 72 : 40); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, k = P.r / 8; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
    const pond = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x2aa0c8, map: TEX.water, transparent: true, opacity: 0.86, shininess: 90, specular: 0xaaddff }));
    pond.position.set(P.x, WATER_Y, P.z); pond.receiveShadow = true; group.add(pond);
  }
  // mud pits: shiny brown puddles
  const mudMat = new THREE.MeshPhongMaterial({ map: TEX.mud, shininess: 60, specular: 0x5a4a3a });
  for (const m of MUD_LIST) {
    const g = new THREE.CircleGeometry(m.r + 0.6, 20); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; for (let i = 1; i < p.count; i++) { const k = 0.88 + hash(i, m.x | 0) * 0.2; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    const mesh = new THREE.Mesh(g, mudMat); mesh.position.set(m.x, m.y - 0.12, m.z); mesh.receiveShadow = true; group.add(mesh);
  }
  // jumps: wooden ramps with yellow + black stripes
  const rampGeos = [];
  for (const r of RAMP_LIST) if (!r.down) rampGeos.push(rampGeo(r));
  const ramps = new THREE.Mesh(merge(rampGeos), new THREE.MeshLambertMaterial({ map: TEX.wood, side: THREE.DoubleSide }));
  ramps.castShadow = ramps.receiveShadow = true; group.add(ramps);
  const mounds = RAMP_LIST.filter((r) => r.down).map(moundGeo);
  if (mounds.length) { const m = new THREE.Mesh(merge(mounds), new THREE.MeshLambertMaterial({ map: TEX.track, side: THREE.DoubleSide })); m.castShadow = m.receiveShadow = true; group.add(m); }
  // the bridge: a deck with railings
  for (const p of BRIDGES) { const g = bridgeMesh(p); group.add(g); bakeGroup(g); } // (glued into a few meshes: faster)
  return group;
}
// (the ribbon is 4 strips wide and every point sits right on the ground, the same height the cars drive on)
const ACROSS = [-1, -0.5, 0, 0.5, 1];
function ribbon(p, hw, lift) {
  const pos = [], uv = [], idx = [], A = ACROSS.length;
  const n = p.n + (p.closed ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const i = k % p.n, a = Math.max(0, i - 1), b = Math.min(p.n - 1, i + 1);
    const i0 = p.closed ? (i - 1 + p.n) % p.n : a, i1 = p.closed ? (i + 1) % p.n : b;
    let tx = p.x[i1] - p.x[i0], tz = p.z[i1] - p.z[i0]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx, v = (k < p.n ? p.cum[i] : p.len) / 8;
    for (const s of ACROSS) {
      const x = p.x[i] + nx * hw * s, z = p.z[i] + nz * hw * s;
      const y = p.bridge[i] && inChannel(p.x[i], p.z[i]) ? p.e[i] : groundAt(x, z);
      pos.push(x, y + lift, z); uv.push((s + 1) / 2, v);
    }
    if (k) { const q = (k - 1) * A; for (let c = 0; c < A - 1; c++) idx.push(q + c, q + c + 1, q + c + A, q + c + 1, q + c + A + 1, q + c + A); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the ribbon faces up (flip if the curve went the other way)
  const nrm = g.attributes.normal; if (nrm.getY(0) < 0) { g.setIndex(idx.map((v, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
  return g;
}
function rampGeo(r) {
  // corners: back-left, back-right, front-left, front-right
  const P = (u, v, up) => { const x = r.x + r.s * u + r.c * v, z = r.z + r.c * u - r.s * v; return [x, hAt(x, z) + (up ? (r.h * u) / r.len : -0.5), z]; };
  const hw = r.w / 2, L = r.len;
  const BL = P(0, -hw, 1), BR = P(0, hw, 1), FL = P(L, -hw, 1), FR = P(L, hw, 1), FLd = P(L, -hw, 0), FRd = P(L, hw, 0), BLd = P(0, -hw, 0), BRd = P(0, hw, 0);
  const tris = [], uvs = [];
  const quad = (a, b, c, d, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => { tris.push(...a, ...b, ...c, ...a, ...c, ...d); uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); };
  quad(BR, BL, FL, FR, 0, 1, 0, L / 6); // top
  quad(FR, FL, FLd, FRd, 0, 1, 0.84, 1); // front
  quad(BL, BLd, FLd, FL, 0, L / 6, 0, 0.3); quad(BRd, BR, FR, FRd, 0, L / 6, 0, 0.3); // sides
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
// a dirt tabletop jump: a smooth mound with sloped sides
function moundGeo(r) {
  const us = [0, r.len * 0.5, r.len, r.len + r.top, r.len + r.top + r.down * 0.5, r.total], hw = r.w / 2, pos = [], uv = [];
  const P = (u, v, hk) => { const x = r.x + r.s * u + r.c * v, z = r.z + r.c * u - r.s * v; return [x, hAt(x, z) + rampH(r, u) * hk - (hk ? 0 : 0.4), z]; };
  const tri = (a, b, c, ua, ub, uc) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
  for (let k = 0; k < us.length - 1; k++) {
    const u0 = us[k], u1 = us[k + 1];
    const a = P(u0, -hw, 1), b = P(u0, hw, 1), c = P(u1, hw, 1), d = P(u1, -hw, 1);
    tri(a, b, c, [0, u0 / 6], [1, u0 / 6], [1, u1 / 6]); tri(a, c, d, [0, u0 / 6], [1, u1 / 6], [0, u1 / 6]);
    // sloped sides (the mound spreads out at the bottom)
    for (const sd of [-1, 1]) {
      const t0 = P(u0, sd * hw, 1), t1 = P(u1, sd * hw, 1), b0 = P(u0, sd * (hw + 1.6 + rampH(r, u0) * 0.8), 0), b1 = P(u1, sd * (hw + 1.6 + rampH(r, u1) * 0.8), 0);
      tri(t0, b0, b1, [0, u0 / 6], [0.3, u0 / 6], [0.3, u1 / 6]); tri(t0, b1, t1, [0, u0 / 6], [0.3, u1 / 6], [0, u1 / 6]);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
function bridgeMesh(p) {
  const g = new THREE.Group(), deck = new THREE.MeshLambertMaterial({ color: 0x8a8a90 }), rail = new THREE.MeshLambertMaterial({ color: 0xd04030 });
  let a = p.bridge.indexOf(true), b = p.bridge.lastIndexOf(true);
  a = Math.max(0, a - 1); b = Math.min(p.n - 1, b + 1);
  for (let i = a; i < b; i++) {
    const dx = p.x[i + 1] - p.x[i], dz = p.z[i + 1] - p.z[i], l = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), y = (p.e[i] + p.e[i + 1]) / 2, pitch = -Math.atan2(p.e[i + 1] - p.e[i], l);
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1.2, 0.6, l + 0.1), deck); m.position.set(p.x[i] + dx / 2, y - 0.25, p.z[i] + dz / 2); m.rotation.set(pitch, yaw, 0, "YXZ"); m.castShadow = m.receiveShadow = true; g.add(m);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, l + 0.1), rail); r.position.set(m.position.x + Math.cos(yaw) * s * (p.w / 2 + 0.4), y + 0.5, m.position.z - Math.sin(yaw) * s * (p.w / 2 + 0.4)); r.rotation.set(pitch, yaw, 0, "YXZ"); r.castShadow = true; g.add(r);
    }
  }
  // stone pillars in the water
  const mid = Math.floor((a + b) / 2);
  for (const i of [Math.floor((a + mid) / 2), Math.floor((mid + b) / 2)]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6, p.w * 0.8), new THREE.MeshLambertMaterial({ color: 0x9a948a })); m.position.set(p.x[i], p.e[i] - 3.5, p.z[i]); m.rotation.y = Math.atan2(p.x[i + 1] - p.x[i], p.z[i + 1] - p.z[i]); g.add(m);
  }
  return g;
}
// glue lots of geometries together into one (fewer things to draw = faster)
export function merge(geos) {
  const attrs = ["position", "normal", "uv", "color"];
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const have = attrs.filter((a) => parts.every((g) => g.attributes[a]));
  const out = new THREE.BufferGeometry();
  for (const a of have) {
    const size = parts[0].attributes[a].itemSize, total = parts.reduce((s, g) => s + g.attributes[a].count * size, 0), arr = new Float32Array(total);
    let o = 0; for (const g of parts) { arr.set(g.attributes[a].array, o); o += g.attributes[a].count * size; }
    out.setAttribute(a, new THREE.BufferAttribute(arr, size));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

// ---------------------------------------------------------------- a painted picture of the whole map (for the minimap / big map)
export function mapCanvas(size = 512) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), col = new THREE.Color();
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = -HALF + ((px + 0.5) / size) * HALF * 2, z = -HALF + ((py + 0.5) / size) * HALF * 2, h = hAt(x, z);
    const s = S[clamp(Math.floor((z + HALF) / SC), 0, SN - 1) * SN + clamp(Math.floor((x + HALF) / SC), 0, SN - 1)];
    if (s === SURF.WATER) col.setRGB(0.25, 0.6, 0.9);
    else if (s === SURF.ROAD) col.setRGB(0.32, 0.33, 0.37);
    else if (s === SURF.TOWN) col.setRGB(0.62, 0.66, 0.6);
    else if (s === SURF.MUD) col.setRGB(0.4, 0.27, 0.15);
    else groundColor(x, z, h, col);
    const shade = clamp(1 + (hAt(x - 2, z - 2) - h) * 0.12, 0.7, 1.25); // hills get shading
    const k = (py * size + px) * 4;
    img.data[k] = Math.min(255, col.r * 255 * shade); img.data[k + 1] = Math.min(255, col.g * 255 * shade); img.data[k + 2] = Math.min(255, col.b * 255 * shade); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
