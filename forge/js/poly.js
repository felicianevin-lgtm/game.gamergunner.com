// Forge 3D: editable polygon meshes.
// A mesh is { v: [[x,y,z], ...], f: [[i,j,k,(l...)], ...] }. Faces are counter-clockwise seen from outside.
// Everything here is plain data (no three.js), so it is easy to save, undo and export.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";

export const clone = (m) => ({ v: m.v.map((p) => p.slice()), f: m.f.map((f) => f.slice()) });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const ekey = (a, b) => (a < b ? a + "_" + b : b + "_" + a);

export function faceNormal(m, f) { // Newell's method (works for any polygon)
  let n = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const a = m.v[f[i]], b = m.v[f[(i + 1) % f.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm(n);
}
export function faceCenter(m, f) {
  const c = [0, 0, 0]; for (const i of f) { c[0] += m.v[i][0]; c[1] += m.v[i][1]; c[2] += m.v[i][2]; }
  return mul(c, 1 / f.length);
}
export function edgeFaces(m) { // edge key -> list of face indices
  const map = new Map();
  m.f.forEach((f, fi) => { for (let i = 0; i < f.length; i++) { const k = ekey(f[i], f[(i + 1) % f.length]); if (!map.has(k)) map.set(k, []); map.get(k).push(fi); } });
  return map;
}
export function allEdges(m) { return [...edgeFaces(m).keys()].map((k) => k.split("_").map(Number)); }

// drop unused vertices and degenerate faces; returns old->new index map
export function cleanup(m) {
  m.f = m.f.map((f) => f.filter((v, i) => v !== f[(i + 1) % f.length])).filter((f) => new Set(f).size >= 3);
  const used = new Map(); const nv = [];
  for (const f of m.f) for (let i = 0; i < f.length; i++) { if (!used.has(f[i])) { used.set(f[i], nv.length); nv.push(m.v[f[i]]); } f[i] = used.get(f[i]); }
  m.v = nv; return used;
}

// ---------- primitives (sizes match Unity's defaults where there is one) ----------
export function box(w = 1, h = 1, d = 1, x0 = -w / 2, y0 = -h / 2, z0 = -d / 2) {
  const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
  return { v: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]] };
}
export function plane(s = 2) { const h = s / 2; return { v: [[-h, 0, -h], [-h, 0, h], [h, 0, h], [h, 0, -h]], f: [[0, 1, 2, 3]] }; }
export function sphere(r = 0.5, seg = 16, rings = 10) {
  const v = [[0, r, 0]], f = [];
  for (let i = 1; i < rings; i++) { const p = (i / rings) * Math.PI; for (let j = 0; j < seg; j++) { const t = (j / seg) * Math.PI * 2; v.push([r * Math.sin(p) * Math.cos(t), r * Math.cos(p), -r * Math.sin(p) * Math.sin(t)]); } }
  v.push([0, -r, 0]); const bot = v.length - 1, ring = (i, j) => 1 + (i - 1) * seg + (j % seg);
  for (let j = 0; j < seg; j++) f.push([0, ring(1, j), ring(1, j + 1)]);
  for (let i = 1; i < rings - 1; i++) for (let j = 0; j < seg; j++) f.push([ring(i, j), ring(i + 1, j), ring(i + 1, j + 1), ring(i, j + 1)]);
  for (let j = 0; j < seg; j++) f.push([ring(rings - 1, j), bot, ring(rings - 1, j + 1)]);
  return { v, f };
}
export function cylinder(r = 0.5, h = 1, seg = 16, rTop = r) {
  const v = [], f = [];
  for (let j = 0; j < seg; j++) { const t = (j / seg) * Math.PI * 2; v.push([r * Math.cos(t), -h / 2, -r * Math.sin(t)]); }
  if (rTop > 0) {
    for (let j = 0; j < seg; j++) { const t = (j / seg) * Math.PI * 2; v.push([rTop * Math.cos(t), h / 2, -rTop * Math.sin(t)]); }
    for (let j = 0; j < seg; j++) f.push([j, (j + 1) % seg, seg + ((j + 1) % seg), seg + j]);
    f.push([...Array(seg).keys()].map((j) => seg + j)); // top
  } else {
    v.push([0, h / 2, 0]); for (let j = 0; j < seg; j++) f.push([j, (j + 1) % seg, seg]);
  }
  f.push([...Array(seg).keys()].reverse()); // bottom
  return { v, f };
}
export const cone = (r = 0.5, h = 1, seg = 16) => cylinder(r, h, seg, 0);
export function torus(R = 0.5, r = 0.18, seg = 24, sides = 12) {
  const v = [], f = [];
  for (let i = 0; i < seg; i++) { const u = (i / seg) * Math.PI * 2; for (let j = 0; j < sides; j++) { const w = (j / sides) * Math.PI * 2; const rr = R + r * Math.cos(w); v.push([rr * Math.cos(u), r * Math.sin(w), -rr * Math.sin(u)]); } }
  const id = (i, j) => (i % seg) * sides + (j % sides);
  for (let i = 0; i < seg; i++) for (let j = 0; j < sides; j++) f.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
  return { v, f };
}
export function ramp(w = 1, h = 1, d = 2) { // a wedge: low at the front (+z), high at the back
  const x = w / 2;
  return { v: [[-x, 0, d / 2], [x, 0, d / 2], [x, 0, -d / 2], [-x, 0, -d / 2], [x, h, -d / 2], [-x, h, -d / 2]],
    f: [[0, 3, 2, 1], [0, 1, 4, 5], [3, 5, 4, 2], [0, 5, 3], [1, 2, 4]] };
}
export function merge(list) { // many meshes -> one
  const out = { v: [], f: [] };
  for (const m of list) { const o = out.v.length; out.v.push(...m.v.map((p) => p.slice())); out.f.push(...m.f.map((f) => f.map((i) => i + o))); }
  return out;
}

// ---------- map pieces (parametric: rebuilt from their settings) ----------
export function buildParam(p) {
  if (p.kind === "wall") {
    const H = p.height, T = p.thickness, L = p.length, parts = [];
    const ops = (p.openings || []).map((o) => ({ ...o, a: Math.max(0, o.at - o.w / 2), b: Math.min(L, o.at + o.w / 2) })).sort((a, b) => a.a - b.a);
    let x = 0;
    for (const o of ops) {
      if (o.a > x + 1e-4) parts.push(box(o.a - x, H, T, x, 0, -T / 2));
      const top = Math.min(H, (o.sill || 0) + o.h);
      if (H - top > 1e-4) parts.push(box(o.b - o.a, H - top, T, o.a, top, -T / 2));
      if ((o.sill || 0) > 1e-4) parts.push(box(o.b - o.a, o.sill, T, o.a, 0, -T / 2));
      x = Math.max(x, o.b);
    }
    if (L - x > 1e-4) parts.push(box(L - x, H, T, x, 0, -T / 2));
    return merge(parts.length ? parts : [box(0.01, H, T, 0, 0, -T / 2)]);
  }
  if (p.kind === "stairs") {
    const parts = [], rise = p.height / p.steps, run = p.depth / p.steps;
    for (let i = 0; i < p.steps; i++) parts.push(box(p.width, rise * (i + 1), run, -p.width / 2, 0, -run * (i + 1)));
    return merge(parts);
  }
  if (p.kind === "floor") return box(p.w, p.t, p.d, -p.w / 2, -p.t, -p.d / 2);
  return box();
}

// ---------- three.js geometry ----------
function triangulate(m, f, n) {
  if (f.length === 3) return [[f[0], f[1], f[2]]];
  if (f.length === 4) { // split along the shorter diagonal
    const d0 = len(sub(m.v[f[0]], m.v[f[2]])), d1 = len(sub(m.v[f[1]], m.v[f[3]]));
    return d0 <= d1 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [[f[1], f[2], f[3]], [f[1], f[3], f[0]]];
  }
  // project to 2D and earcut (handles concave faces)
  const ax = Math.abs(n[0]) > 0.5 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(ax, n)), w = cross(n, u);
  const pts = f.map((i) => { const p = m.v[i]; return new THREE.Vector2(p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * w[0] + p[1] * w[1] + p[2] * w[2]); });
  if (THREE.ShapeUtils.isClockWise(pts)) { const t = THREE.ShapeUtils.triangulateShape(pts.slice().reverse(), []); return t.map((tr) => tr.map((k) => f[f.length - 1 - k]).reverse()); }
  return THREE.ShapeUtils.triangulateShape(pts, []).map((tr) => tr.map((k) => f[k]));
}

// returns { geometry, triFace } (triFace[t] = the face a triangle came from)
// normal for every corner of every face: flat, or smooth across faces that meet at less than 45 degrees ("auto smooth")
export function cornerNormals(m, smooth) {
  const fn = m.f.map((f) => faceNormal(m, f));
  if (!smooth) return m.f.map((f, fi) => f.map(() => fn[fi]));
  const vf = m.v.map(() => []); m.f.forEach((f, fi) => f.forEach((i) => vf[i].push(fi)));
  const lim = Math.cos(Math.PI / 4);
  return m.f.map((f, fi) => f.map((i) => {
    let s = [0, 0, 0]; const n = fn[fi];
    for (const g of vf[i]) { const o = fn[g]; if (o[0] * n[0] + o[1] * n[1] + o[2] * n[2] >= lim) s = add(s, o); }
    return norm(s);
  }));
}
export function faceUVAxes(n) { const an = n.map(Math.abs); return an[0] >= an[1] && an[0] >= an[2] ? [2, 1] : an[1] >= an[2] ? [0, 2] : [0, 1]; }

export function toGeometry(m, smooth = false) {
  const pos = [], nor = [], uv = [], triFace = [];
  const fn = m.f.map((f) => faceNormal(m, f)), cn = cornerNormals(m, smooth);
  m.f.forEach((f, fi) => {
    const n = fn[fi], [a, b] = faceUVAxes(n), corner = new Map(f.map((v, k) => [v, cn[fi][k]]));
    for (const tri of triangulate(m, f, n)) {
      for (const i of tri) {
        const p = m.v[i]; pos.push(p[0], p[1], p[2]);
        const nn = corner.get(i); nor.push(nn[0], nn[1], nn[2]);
        uv.push(p[a], p[b]);
      }
      triFace.push(fi);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, triFace };
}

// ---------- edit operations: each takes (mesh, selection, params) and returns { msg, sel } ----------
// sel = { v: Set, e: Set(edge keys), f: Set(face index) } in the mode that is active
export function selVerts(m, mode, sel) {
  const s = new Set();
  if (mode === "v") sel.forEach((i) => s.add(i));
  if (mode === "e") sel.forEach((k) => k.split("_").forEach((i) => s.add(+i)));
  if (mode === "f") sel.forEach((fi) => m.f[fi] && m.f[fi].forEach((i) => s.add(i)));
  return s;
}
function facesFromSel(m, mode, sel) {
  if (mode === "f") return new Set([...sel].filter((fi) => m.f[fi]));
  const vs = selVerts(m, mode, sel), out = new Set();
  m.f.forEach((f, fi) => { if (f.every((i) => vs.has(i))) out.add(fi); });
  return out;
}

export function extrude(m, mode, sel, { amount = 0.5 } = {}) {
  if (mode === "e") return extrudeEdges(m, sel, amount);
  const S = facesFromSel(m, mode, sel);
  if (!S.size) return { msg: "Pick some faces (or edges on an open side) to extrude." };
  const count = new Map();
  for (const fi of S) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) { const k = ekey(f[i], f[(i + 1) % f.length]); count.set(k, (count.get(k) || 0) + 1); } }
  let n = [0, 0, 0]; for (const fi of S) n = add(n, faceNormal(m, m.f[fi])); n = norm(n);
  const dup = new Map();
  const D = (i) => { if (!dup.has(i)) { dup.set(i, m.v.length); m.v.push(add(m.v[i], mul(n, amount))); } return dup.get(i); };
  const side = [];
  for (const fi of S) {
    const f = m.f[fi];
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; if (count.get(ekey(a, b)) === 1) side.push([a, b, D(b), D(a)]); }
  }
  for (const fi of S) m.f[fi] = m.f[fi].map(D);
  m.f.push(...side);
  return { msg: "Extruded " + S.size + " face" + (S.size > 1 ? "s" : "") + ". Drag the arrows to pull it further.", mode: "f", sel: new Set(S) };
}
function extrudeEdges(m, sel, amount) {
  const ef = edgeFaces(m), dirs = new Map(), edges = [];
  for (const k of sel) {
    const fs = ef.get(k); if (!fs || fs.length !== 1) continue;
    const f = m.f[fs[0]], [p, q] = k.split("_").map(Number);
    let a = p, b = q; for (let i = 0; i < f.length; i++) if (f[i] === q && f[(i + 1) % f.length] === p) { a = q; b = p; }
    const out = norm(cross(sub(m.v[b], m.v[a]), faceNormal(m, f)));
    edges.push([a, b]); for (const v of [a, b]) dirs.set(v, add(dirs.get(v) || [0, 0, 0], out));
  }
  if (!edges.length) return { msg: "Edge extrude works on open edges (the border of a plane or a hole). Pick faces to extrude a solid." };
  const dup = new Map();
  for (const [v, d] of dirs) { dup.set(v, m.v.length); m.v.push(add(m.v[v], mul(norm(d), amount))); }
  const ns = new Set();
  for (const [a, b] of edges) { m.f.push([a, dup.get(a), dup.get(b), b]); ns.add(ekey(dup.get(a), dup.get(b))); }
  return { msg: "Extruded " + edges.length + " edge" + (edges.length > 1 ? "s" : "") + ".", mode: "e", sel: ns };
}

export function inset(m, mode, sel, { amount = 0.25 } = {}) {
  const S = [...facesFromSel(m, mode, sel)];
  if (!S.length) return { msg: "Pick faces to inset." };
  const t = Math.min(0.95, Math.max(0.01, amount)), ns = new Set();
  for (const fi of S) {
    const f = m.f[fi], c = faceCenter(m, f), w = f.map((i) => { m.v.push(lerp(m.v[i], c, t)); return m.v.length - 1; });
    for (let i = 0; i < f.length; i++) { const j = (i + 1) % f.length; m.f.push([f[i], f[j], w[j], w[i]]); }
    m.f[fi] = w; ns.add(fi);
  }
  return { msg: "Inset " + S.length + " face" + (S.length > 1 ? "s" : "") + ".", mode: "f", sel: ns };
}

// insert points into every face edge that has them (keeps neighbours connected)
function insertEdgePoints(m, pts, skip = new Set()) {
  m.f.forEach((f, fi) => {
    if (skip.has(fi)) return;
    const out = [];
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length]; out.push(a);
      const p = pts.get(ekey(a, b)); if (p) out.push(...(a < b ? p : p.slice().reverse()));
    }
    m.f[fi] = out;
  });
}
function edgePoints(m, pts, a, b, n) { // n points along a->b, stored low->high index
  const k = ekey(a, b);
  if (!pts.has(k)) { const lo = Math.min(a, b), hi = Math.max(a, b), arr = []; for (let i = 1; i <= n; i++) { m.v.push(lerp(m.v[lo], m.v[hi], i / (n + 1))); arr.push(m.v.length - 1); } pts.set(k, arr); }
  const arr = pts.get(k); return a < b ? arr : arr.slice().reverse();
}

export function subdivide(m, mode, sel) {
  let S = [...facesFromSel(m, mode, sel)];
  if (!S.length) S = m.f.map((_, i) => i);
  const pts = new Map(), Sset = new Set(S), newFaces = [], ns = new Set();
  for (const fi of S) {
    const f = m.f[fi], c = faceCenter(m, f), mids = f.map((a, i) => edgePoints(m, pts, a, f[(i + 1) % f.length], 1)[0]);
    if (f.length === 3) { newFaces.push([f[0], mids[0], mids[2]], [mids[0], f[1], mids[1]], [mids[2], mids[1], f[2]], [mids[0], mids[1], mids[2]]); continue; }
    m.v.push(c); const ci = m.v.length - 1;
    for (let i = 0; i < f.length; i++) newFaces.push([f[i], mids[i], ci, mids[(i + f.length - 1) % f.length]]);
  }
  insertEdgePoints(m, pts, Sset);
  m.f = m.f.filter((_, i) => !Sset.has(i));
  const start = m.f.length; m.f.push(...newFaces);
  for (let i = start; i < m.f.length; i++) ns.add(i);
  return { msg: "Subdivided " + S.length + " face" + (S.length > 1 ? "s" : "") + " into " + newFaces.length + ".", mode: "f", sel: ns };
}

export function loopCut(m, mode, sel, { cuts = 1 } = {}) {
  let start = null;
  if (mode === "e" && sel.size) start = [...sel][0].split("_").map(Number);
  if (!start && mode === "f" && sel.size) { const f = m.f[[...sel][0]]; if (f) start = [f[0], f[1]]; }
  if (!start) return { msg: "Pick one edge first (Edge mode, key 2). The cut goes across it, all the way around." };
  const ef = edgeFaces(m), pts = new Map(), done = new Set(), N = Math.max(1, Math.min(20, cuts | 0)), splits = [];
  const walk = (a, b, fromFace) => {
    let fi = (ef.get(ekey(a, b)) || []).find((x) => x !== fromFace && !done.has(x));
    while (fi !== undefined && m.f[fi].length === 4 && !done.has(fi)) {
      done.add(fi);
      const f = m.f[fi]; let i = 0;
      for (; i < 4; i++) { const p = f[i], q = f[(i + 1) % 4]; if (ekey(p, q) === ekey(a, b)) break; }
      const p0 = f[i], p1 = f[(i + 1) % 4], p2 = f[(i + 2) % 4], p3 = f[(i + 3) % 4];
      splits.push({ fi, p0, p1, p2, p3 });
      edgePoints(m, pts, p0, p1, N); edgePoints(m, pts, p3, p2, N);
      a = p2; b = p3;
      const next = (ef.get(ekey(a, b)) || []).find((x) => x !== fi);
      fi = next;
    }
  };
  edgePoints(m, pts, start[0], start[1], N);
  walk(start[0], start[1], -1);
  walk(start[0], start[1], -1); // the other side (if the first walk did not come all the way round)
  if (!splits.length) return { msg: "Loop cut needs four-sided faces next to that edge." };
  const skip = new Set(splits.map((s) => s.fi)), newFaces = [], ns = new Set();
  for (const { p0, p1, p2, p3 } of splits) {
    const A = [p0, ...edgePoints(m, pts, p0, p1, N), p1], B = [p3, ...edgePoints(m, pts, p3, p2, N), p2];
    for (let k = 0; k <= N; k++) newFaces.push([A[k], A[k + 1], B[k + 1], B[k]]);
    for (let k = 1; k <= N; k++) ns.add(ekey(A[k], B[k]));
  }
  insertEdgePoints(m, pts, skip);
  m.f = m.f.filter((_, i) => !skip.has(i)); m.f.push(...newFaces);
  return { msg: "Loop cut through " + splits.length + " faces.", mode: "e", sel: ns };
}

export function bevel(m, mode, sel, { amount = 0.1 } = {}) {
  let edges = mode === "e" ? [...sel].map((k) => k.split("_").map(Number)) : [];
  if (mode === "f") { // bevel the edges around the picked faces' outline
    const S = facesFromSel(m, mode, sel), c = new Map();
    for (const fi of S) { const f = m.f[fi]; for (let i = 0; i < f.length; i++) { const k = ekey(f[i], f[(i + 1) % f.length]); c.set(k, (c.get(k) || 0) + 1); } }
    edges = [...c].filter(([, n]) => n === 1).map(([k]) => k.split("_").map(Number));
  }
  if (!edges.length) return { msg: "Pick edges to bevel (Edge mode, key 2)." };
  const used = new Set(), todo = [], skipped = [];
  for (const e of edges) { if (used.has(e[0]) || used.has(e[1])) { skipped.push(e); continue; } used.add(e[0]); used.add(e[1]); todo.push(e); }
  let did = 0; const ns = new Set();
  for (const [p, q] of todo) if (bevelEdge(m, p, q, amount, ns)) did++;
  let msg = did ? "Beveled " + did + " edge" + (did > 1 ? "s" : "") + "." : "That edge can't be beveled (it needs a face on both sides).";
  if (skipped.length) msg += " Skipped " + skipped.length + " edge(s) that touch another picked edge: bevel those one at a time.";
  return { msg, mode: "f", sel: ns };
}
function bevelEdge(m, p, q, d, ns) {
  const ef = edgeFaces(m), fs = ef.get(ekey(p, q));
  if (!fs || fs.length !== 2) return false;
  let F1 = fs[0], F2 = fs[1];
  const has = (f, a, b) => { for (let i = 0; i < f.length; i++) if (f[i] === a && f[(i + 1) % f.length] === b) return true; return false; };
  if (!has(m.f[F1], p, q)) [F1, F2] = [F2, F1]; // F1 runs p->q, F2 runs q->p
  const nAvg = norm(add(faceNormal(m, m.f[F1]), faceNormal(m, m.f[F2])));
  const other = (f, v, not) => { const i = f.indexOf(v), a = f[(i + 1) % f.length], b = f[(i + f.length - 1) % f.length]; return a === not ? b : a; };
  const slide = (v, toward) => { const dir = sub(m.v[toward], m.v[v]), L = len(dir); m.v.push(add(m.v[v], mul(dir, Math.min(d, L * 0.45) / (L || 1)))); return m.v.length - 1; };
  const n = {}; // new vertices per (vertex, face)
  for (const v of [p, q]) for (const F of [F1, F2]) n[v + "|" + F] = slide(v, other(m.f[F], v, v === p ? q : p));
  const fixFan = (v, nb1, nb2) => { // v's other faces: G1 next to F1, G2 next to F2
    const v1 = n[v + "|" + F1], v2 = n[v + "|" + F2], p1 = nb1, p2 = nb2;
    const G1 = (ef.get(ekey(v, p1)) || []).find((x) => x !== F1), G2 = (ef.get(ekey(v, p2)) || []).find((x) => x !== F2);
    m.f.forEach((f, fi) => {
      if (fi === F1 || fi === F2 || !f.includes(v)) return;
      if (fi === G1 && fi === G2) { const i = f.indexOf(v), before = f[(i + f.length - 1) % f.length]; m.f[fi] = f.flatMap((x) => (x === v ? (before === p1 ? [v1, v2] : [v2, v1]) : [x])); }
      else if (fi === G1) { const i = f.indexOf(v), before = f[(i + f.length - 1) % f.length]; m.f[fi] = f.flatMap((x) => (x === v ? (before === p1 ? [v1, v] : [v, v1]) : [x])); }
      else if (fi === G2) { const i = f.indexOf(v), before = f[(i + f.length - 1) % f.length]; m.f[fi] = f.flatMap((x) => (x === v ? (before === p2 ? [v2, v] : [v, v2]) : [x])); }
    });
    if (G1 !== G2) { const tri = [v1, v, v2]; if (dotN(m, tri, nAvg) < 0) tri.reverse(); m.f.push(tri); }
  };
  const nbP1 = other(m.f[F1], p, q), nbP2 = other(m.f[F2], p, q), nbQ1 = other(m.f[F1], q, p), nbQ2 = other(m.f[F2], q, p);
  fixFan(p, nbP1, nbP2); fixFan(q, nbQ1, nbQ2);
  m.f[F1] = m.f[F1].map((x) => (x === p ? n[p + "|" + F1] : x === q ? n[q + "|" + F1] : x));
  m.f[F2] = m.f[F2].map((x) => (x === p ? n[p + "|" + F2] : x === q ? n[q + "|" + F2] : x));
  const quad = [n[p + "|" + F1], n[p + "|" + F2], n[q + "|" + F2], n[q + "|" + F1]];
  if (dotN(m, quad, nAvg) < 0) quad.reverse();
  m.f.push(quad); ns.add(m.f.length - 1);
  return true;
}
function dotN(m, f, n) { const a = faceNormal(m, f); return a[0] * n[0] + a[1] * n[1] + a[2] * n[2]; }

export function deleteSel(m, mode, sel) {
  if (!sel.size) return { msg: "Nothing picked to delete." };
  if (mode === "f") { m.f = m.f.filter((_, i) => !sel.has(i)); }
  else if (mode === "e") { m.f = m.f.filter((f) => !f.some((a, i) => sel.has(ekey(a, f[(i + 1) % f.length])))); }
  else { m.f = m.f.filter((f) => !f.some((i) => sel.has(i))); }
  cleanup(m);
  return { msg: "Deleted.", sel: new Set() };
}
export function flip(m, mode, sel) {
  let S = [...facesFromSel(m, mode, sel)]; if (!S.length) S = m.f.map((_, i) => i);
  for (const fi of S) m.f[fi].reverse();
  return { msg: "Flipped " + S.length + " face" + (S.length > 1 ? "s" : "") + " (they now face the other way)." };
}
export function mergeVerts(m, mode, sel) {
  const vs = [...selVerts(m, mode, sel)]; if (vs.length < 2) return { msg: "Pick 2 or more vertices to merge." };
  let c = [0, 0, 0]; vs.forEach((i) => { c = add(c, m.v[i]); }); c = mul(c, 1 / vs.length);
  const keep = vs[0]; m.v[keep] = c; const set = new Set(vs);
  m.f = m.f.map((f) => f.map((i) => (set.has(i) ? keep : i)));
  const map = cleanup(m);
  return { msg: "Merged " + vs.length + " vertices into one.", mode: "v", sel: new Set([map.get(keep)].filter((x) => x !== undefined)) };
}
export function dupFaces(m, mode, sel) {
  const S = [...facesFromSel(m, mode, sel)]; if (!S.length) return { msg: "Pick faces to duplicate." };
  const map = new Map(), ns = new Set();
  for (const fi of S) { m.f.push(m.f[fi].map((i) => { if (!map.has(i)) { map.set(i, m.v.length); m.v.push(m.v[i].slice()); } return map.get(i); })); ns.add(m.f.length - 1); }
  return { msg: "Duplicated " + S.length + " face" + (S.length > 1 ? "s" : "") + ". Drag the arrows to move the copy.", mode: "f", sel: ns };
}
export function splitOff(m, mode, sel) { // returns the separated mesh (or null)
  const S = facesFromSel(m, mode, sel); if (!S.size || S.size === m.f.length) return null;
  const part = { v: m.v, f: m.f.filter((_, i) => S.has(i)).map((f) => f.slice()) };
  m.f = m.f.filter((_, i) => !S.has(i)); cleanup(m);
  const out = { v: part.v.map((p) => p.slice()), f: part.f }; cleanup(out); return out;
}
export function mirrorMesh(m, axis) { const a = "xyz".indexOf(axis); m.v.forEach((p) => { p[a] = -p[a]; }); m.f.forEach((f) => f.reverse()); }
export function selectAllOf(m, mode) {
  if (mode === "v") return new Set(m.v.map((_, i) => i));
  if (mode === "f") return new Set(m.f.map((_, i) => i));
  return new Set(edgeFaces(m).keys());
}
export function convertSel(m, from, to, sel) {
  if (from === to) return sel;
  const vs = selVerts(m, from, sel);
  if (to === "v") return vs;
  if (to === "e") { const s = new Set(); for (const k of edgeFaces(m).keys()) { const [a, b] = k.split("_").map(Number); if (vs.has(a) && vs.has(b)) s.add(k); } return s; }
  const s = new Set(); m.f.forEach((f, fi) => { if (f.every((i) => vs.has(i))) s.add(fi); }); return s;
}
