// MUD VALLEY RP: buildings and houses, made from boxes, cylinders and roofs.
// Everything still (that never moves) goes into a "Batch" that glues it all into a few big meshes, so it draws fast on a Chromebook.
import * as THREE from "/create/vendor/three.module.js";
import { merge } from "./terrain.js";
import { addBox, addCircle } from "./colliders.js";

const MAT = {};
function mats() {
  if (MAT.solid) return MAT;
  MAT.solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.glass = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: 0xffffff });
  MAT.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  return MAT;
}
const col = new THREE.Color(), M = new THREE.Matrix4(), E = new THREE.Euler(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);

// a triangle roof shape (w wide, h tall, d deep)
export function prismGeo(w, h, d) {
  const A = [-w / 2, 0, d / 2], B = [w / 2, 0, d / 2], C = [0, h, d / 2], A2 = [-w / 2, 0, -d / 2], B2 = [w / 2, 0, -d / 2], C2 = [0, h, -d / 2];
  const t = [A, B, C, A2, C2, B2, A, C, A2, C, C2, A2, B, B2, C, B2, C2, C];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(t.flat(), 3)); g.computeVertexNormals();
  return g;
}

export class Batch {
  constructor() { this.parts = { solid: [], glass: [], glow: [] }; this.frame = new THREE.Matrix4(); }
  // where the next things go: a spot + which way it faces (everything after is "local" to this)
  at(x, y, z, yaw = 0) { this.frame.makeRotationY(yaw).setPosition(x, y, z); this.fx = x; this.fy = y; this.fz = z; this.fyaw = yaw; return this; }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, kind = "solid", sx = 1, sy = 1, sz = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE.set(sx, sy, sz)).premultiply(this.frame);
    g.applyMatrix4(M);
    col.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.deleteAttribute("uv");
    this.parts[kind].push(g);
    return this;
  }
  // a box sitting on y (its bottom), centered on x/z
  box(w, h, d, x, y, z, color, kind = "solid", ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry, 0, kind); }
  cyl(r, h, x, y, z, color, seg = 10, kind = "solid", rTop = r) { return this.add(new THREE.CylinderGeometry(rTop, r, h, seg), color, x, y + h / 2, z, 0, 0, 0, kind); }
  ball(r, x, y, z, color, kind = "solid", det = 0) { return this.add(new THREE.IcosahedronGeometry(r, det), color, x, y, z, 0, 0, 0, kind); }
  roof(w, h, d, x, y, z, color, ry = 0) { return this.add(prismGeo(w, h, d), color, x, y, z, 0, ry, 0); }
  // a solid thing you bump into (in local spots, like the parts)
  solid(x, z, hx, hz, top = 99, ry = 0) {
    const c = Math.cos(this.fyaw), s = Math.sin(this.fyaw);
    addBox(this.fx + x * c + z * s, this.fz - x * s + z * c, hx, hz, this.fyaw + ry, this.fy + top);
    return this;
  }
  post(x, z, r, top = 99) { const c = Math.cos(this.fyaw), s = Math.sin(this.fyaw); addCircle(this.fx + x * c + z * s, this.fz - x * s + z * c, r, this.fy + top); return this; }
  // world spot of a local point
  world(x, z) { const c = Math.cos(this.fyaw), s = Math.sin(this.fyaw); return { x: this.fx + x * c + z * s, z: this.fz - x * s + z * c }; }
  finish(scene) {
    mats(); const out = [];
    for (const k of ["solid", "glass", "glow"]) {
      if (!this.parts[k].length) continue;
      const m = new THREE.Mesh(merge(this.parts[k]), MAT[k]);
      m.castShadow = k !== "glow"; m.receiveShadow = k !== "glow"; scene.add(m); out.push(m);
    }
    this.parts = { solid: [], glass: [], glow: [] };
    return out;
  }
}

// ---------------------------------------------------------------- signs with words on them
export function signTex(text, w = 512, h = 128, bg = "#ffffff", fg = "#1a1a2a", opts = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = h * 0.08; g.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08); }
  const lines = String(text).split("\n");
  let fs = opts.size || h * (lines.length > 1 ? 0.36 : 0.62);
  g.font = `${opts.weight || ""} ${fs}px "Russo One", Impact, sans-serif`;
  const maxW = Math.max(...lines.map((l) => g.measureText(l).width));
  if (maxW > w * 0.92) { fs *= (w * 0.92) / maxW; g.font = `${opts.weight || ""} ${fs}px "Russo One", Impact, sans-serif`; }
  g.textAlign = "center"; g.textBaseline = "middle";
  lines.forEach((l, i) => {
    const y = h / 2 + (i - (lines.length - 1) / 2) * fs * 1.12;
    if (opts.stroke) { g.lineWidth = fs * 0.16; g.strokeStyle = opts.stroke; g.lineJoin = "round"; g.strokeText(l, w / 2, y); }
    g.fillStyle = fg; g.fillText(l, w / 2, y);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function sign(scene, text, w, h, x, y, z, yaw, opts = {}) {
  const tex = signTex(text, opts.px || 512, Math.round((opts.px || 512) * (h / w)), opts.bg ?? "#ffffff", opts.fg || "#1a1a2a", opts);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !opts.bg, color: opts.glow ? 0xffffff : 0xeeeeee });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = yaw; scene.add(m);
  if (opts.back) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); b.rotation.y = Math.PI; m.add(b); b.position.z = -0.02; }
  return m;
}
// a sign placed with a batch's local spot
export function bsign(scene, b, text, w, h, x, y, z, opts = {}) {
  const p = b.world(x, z); return sign(scene, text, w, h, p.x, b.fy + y, p.z, b.fyaw + (opts.turn || 0), opts);
}

// ---------------------------------------------------------------- little helpers
function windows(b, w, y, z, n, h = 1.6, ww = 1.6, color = 0x9fd6f5, frame = 0xffffff) {
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5);
    b.box(ww + 0.3, h + 0.3, 0.12, x, y - 0.15, z, frame);
    b.box(ww, h, 0.16, x, y, z, color, "glass");
  }
}
export function tree(b, x, z, s = 1, kind = 0) {
  b.cyl(0.25 * s, 1.6 * s, x, 0, z, 0x7a5232, 6);
  if (kind === 1) { b.ball(1.5 * s, x, 2.6 * s, z, 0x4fa83a); b.ball(1.1 * s, x + 0.6 * s, 3.3 * s, z + 0.3 * s, 0x5cbc44); }
  else { b.add(new THREE.ConeGeometry(1.6 * s, 2.8 * s, 7), 0x2f8a3c, x, 2.6 * s, z); b.add(new THREE.ConeGeometry(1.15 * s, 2.2 * s, 7), 0x3a9a46, x, 3.9 * s, z); }
  b.post(x, z, 0.45 * s, 6 * s);
}
function fence(b, x0, z0, x1, z1, color = 0xf4f4f0, h = 1.1) {
  const l = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(l / 2.4)), ry = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) { const t = i / n; b.box(0.18, h, 0.18, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, color); }
  for (const y of [h * 0.45, h * 0.85]) b.add(new THREE.BoxGeometry(0.08, 0.14, l), color, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ry, 0);
}
function lamp(b, x, z) { b.cyl(0.12, 5.5, x, 0, z, 0x40444c, 6); b.box(1.4, 0.2, 0.4, x + 0.5, 5.4, z, 0x40444c); b.box(0.6, 0.12, 0.3, x + 1, 5.3, z, 0xfff2c0, "glow"); b.post(x, z, 0.25, 6); }
function bench(b, x, z, ry = 0) { b.add(new THREE.BoxGeometry(2, 0.12, 0.6), 0xa0703a, x, 0.5, z, 0, ry); b.add(new THREE.BoxGeometry(2, 0.5, 0.1), 0xa0703a, x - Math.sin(ry + Math.PI / 2) * 0 + Math.sin(ry) * -0.28, 0.85, z + Math.cos(ry) * -0.28, 0, ry); }
function tires(b, x, z, n = 4) { for (let i = 0; i < n; i++) b.add(new THREE.TorusGeometry(0.45, 0.2, 6, 10), 0x26262a, x, 0.2 + i * 0.38, z, Math.PI / 2); }
function drum(b, x, z, color = 0xd0402a) { b.cyl(0.45, 1.2, x, 0, z, color, 10); b.cyl(0.47, 0.08, x, 0.4, z, 0x333333, 10); }
function hay(b, x, z, ry = 0) { b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 10), 0xe6c35a, x, 0.75, z, Math.PI / 2, ry, 0); }
function bunting(b, x0, y0, z0, x1, y1, z1) {
  const l = Math.hypot(x1 - x0, z1 - z0), n = Math.round(l / 1.2), ry = Math.atan2(x1 - x0, z1 - z0), cols = [0xff3a3a, 0xffd23a, 0x3aa0ff, 0x4adf6a, 0xff7ad8];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 0.8;
    b.add(new THREE.ConeGeometry(0.35, 0.8, 3), cols[i % cols.length], x0 + (x1 - x0) * t, y - 0.3, z0 + (z1 - z0) * t, Math.PI, ry, 0, "solid", 1, 1, 0.15);
  }
}
const PAINTS = [[0xf4e3b5, 0x8a4a2a], [0xb8e0f0, 0x3a4a6a], [0xf2c4c4, 0x5a3a3a], [0xd8f0c0, 0x3a5a3a], [0xfff2a0, 0x8a3a2a], [0xe0d0f4, 0x4a3a6a], [0xf0f0f0, 0x2a5a8a], [0xffd8a8, 0x6a3a1a]];

// ---------------------------------------------------------------- town buildings (they all face +z before turning)
export function dealership(scene, b) {
  // a giant glass showroom (56 m wide) with a big car lot out front
  b.box(56, 11, 26, 0, 0, 0, 0xf2f4f7).solid(0, 0, 28, 13);
  b.box(50, 8.2, 0.3, 0, 0.8, 13.05, 0x7fc8f0, "glass");
  for (const x of [-25, -12.5, 0, 12.5, 25]) b.box(1, 9.6, 0.7, x, 0, 13.3, 0xffffff);
  b.box(58, 0.8, 29.5, 0, 11, 1.5, 0x2a6fd6); b.box(56.4, 0.8, 26.4, 0, 9.6, 0, 0x2a6fd6);
  b.box(58.2, 0.18, 0.3, 0, 11.2, 16.3, 0xbfe6ff, "glow");
  // the car lot: lines, a spinning stage in the middle and 4 show pads
  b.box(56, 0.06, 22, 0, 0.01, 24, 0x3c3f46);
  for (let i = -4; i <= 4; i++) if (i) b.box(0.25, 0.08, 4, i * 6, 0.02, 33, 0xffffff);
  b.cyl(4.6, 0.3, 0, 0, 23, 0xdde2ea, 28); b.add(new THREE.CylinderGeometry(4.75, 4.75, 0.14, 28, 1, true), 0x5ad0ff, 0, 0.2, 23, 0, 0, 0, "glow");
  for (const [x, z] of DEALER_PADS) { b.cyl(3.6, 0.4, x, 0, z, 0xf0f0f0, 20); b.add(new THREE.CylinderGeometry(3.7, 3.7, 0.12, 20, 1, true), 0xffd23a, x, 0.3, z, 0, 0, 0, "glow"); }
  for (const [x, z] of [[-27.5, 34.5], [27.5, 34.5], [-27.5, 14], [27.5, 14]]) { b.cyl(0.12, 9, x, 0, z, 0xcccccc, 6); b.post(x, z, 0.3, 9); }
  bunting(b, -27.5, 8.8, 14, -27.5, 8.8, 34.5); bunting(b, 27.5, 8.8, 14, 27.5, 8.8, 34.5); bunting(b, -27.5, 8.8, 34.5, 27.5, 8.8, 34.5);
  for (const [x, c] of [[-12, 0xff3a3a], [0, 0xffd23a], [12, 0x3aa0ff]]) { b.cyl(0.14, 13, x, 0, -14, 0xdddddd, 6); b.add(new THREE.BoxGeometry(0.05, 2, 3), c, x, 11.8, -12.4); }
  bsign(scene, b, "VALLEY MOTORS", 38, 5, 0, 14, 16.4, { bg: "#2a6fd6", fg: "#ffffff", stroke: "#123a7a" });
  bsign(scene, b, "TRUCKS • QUADS • BIKES • CARS", 30, 2.2, 0, 8.6, 13.25, { bg: "#ffd23a", fg: "#2a2a2a" });
  bsign(scene, b, "NEW & USED RIDES", 16, 2, 0, 7, -13.1, { bg: "#ffd23a", fg: "#2a2a2a", turn: Math.PI });
}
// where the 4 show rides sit on the lot (local spots, in front of the showroom)
export const DEALER_PADS = [[-15, 19], [15, 19], [-22, 28], [22, 28]];
export function customs(scene, b) {
  b.box(46, 8, 22, 0, 0, 0, 0x8a96a3).solid(0, 0, 23, 11);
  for (let x = -22; x <= 22; x += 2.2) b.box(0.3, 7, 0.2, x, 0, -11.05, 0x7a8693);
  b.box(46.4, 1.1, 22.4, 0, 7, 0, 0xff8a1a); b.box(47, 0.5, 23, 0, 8, 0, 0x55606a);
  for (const x of [-14, 0, 14]) {
    if (x === 0) { b.box(10, 6.2, 0.3, x, 0, 10.9, 0x22262c); b.box(0.6, 3, 3, x - 3, 0, 8, 0xffd23a); b.box(0.6, 3, 3, x + 3, 0, 8, 0xffd23a); }
    else { b.box(10, 6.2, 0.3, x, 0, 11.05, 0xc8ccd2); for (let y = 0.5; y < 6; y += 0.6) b.box(10, 0.08, 0.36, x, y, 11.05, 0xa8adb5); }
    b.box(10.8, 0.5, 0.5, x, 6.2, 11.1, 0xff8a1a);
  }
  // the lift pad where cars get customized
  b.box(8, 0.06, 10, 0, 0.01, 21, 0xffd23a); b.box(7, 0.08, 9, 0, 0.02, 21, 0x2c2f36);
  for (let i = 0; i < 6; i++) b.box(0.5, 0.1, 9.6, -3.75, 0.02, 21, i % 2 ? 0xffd23a : 0x111111);
  tires(b, 25, 6); tires(b, 25, 8, 3); tires(b, 26.5, 7, 5); drum(b, -25, 6); drum(b, -25, 7.2, 0x2a7ad0); drum(b, -26.2, 6.6);
  b.box(2.2, 1.6, 1, -25, 0, 2, 0xd0302a); b.post(25.5, 7, 1.5, 2); b.post(-25.5, 6.6, 1.4, 1.3);
  bsign(scene, b, "MUD & CHROME\nCUSTOMS", 26, 5, 0, 10.7, 11.5, { bg: "#22262c", fg: "#ff8a1a", stroke: "#000000" });
  b.box(27, 5.4, 0.3, 0, 8.1, 11.3, 0x111111);
}
export function jobCenter(scene, b) {
  b.box(36, 7, 20, 0, 0, 0, 0xb5523b).solid(0, 0, 18, 10);
  b.box(36.6, 0.8, 20.6, 0, 7, 0, 0xf2eee4); b.roof(36, 2.6, 20, 0, 7.8, 0, 0x5a5f6a);
  windows(b, 30, 4.2, 10.05, 6, 1.8, 2.4); b.box(5, 4.2, 0.2, 0, 0, 10.1, 0x6a3a22);
  for (const x of [-6, -3, 3, 6]) b.cyl(0.45, 6.8, x, 0, 11.5, 0xf8f6f0, 10);
  b.box(14, 0.5, 4, 0, 0, 12, 0xd8d4cc); b.box(14.6, 0.6, 4.6, 0, 6.8, 11.8, 0xf2eee4);
  b.cyl(0.12, 12, 15, 0, 13, 0xdddddd, 6); b.add(new THREE.BoxGeometry(0.05, 1.8, 3), 0xffd23a, 15, 11, 14.5); b.post(15, 13, 0.3, 12);
  bsign(scene, b, "JOB CENTER", 16, 2.4, 0, 9.6, 10.6, { bg: "#ffd23a", fg: "#3a2a0a" });
  // the big job board out front
  b.box(0.4, 6, 0.4, -5, 0, 20, 0x6a4a2a); b.box(0.4, 6, 0.4, 5, 0, 20, 0x6a4a2a); b.box(10.6, 5, 0.4, 0, 2.2, 20, 0x6a4a2a);
  b.post(-5, 20, 0.4, 6); b.post(5, 20, 0.4, 6);
  bsign(scene, b, "JOBS!\n$ EARN CASH $", 10, 4.4, 0, 4.7, 20.25, { bg: "#2a7a3a", fg: "#ffffff", stroke: "#0a3a0a" });
}
export function postOffice(scene, b) {
  b.box(22, 6, 18, 0, 0, 0, 0xf4f4f0).solid(0, 0, 11, 9); b.box(22.2, 2.2, 18.2, 0, 0, 0, 0x3a6ec8);
  b.box(22.8, 0.6, 18.8, 0, 6, 0, 0x3a6ec8); windows(b, 18, 3.6, 9.05, 4, 1.4, 2.2); b.box(3.6, 3.6, 0.2, 0, 0, 9.1, 0x2a4a8a);
  b.cyl(0.1, 9, -8, 0, 11, 0xdddddd, 6); b.add(new THREE.BoxGeometry(0.05, 1.4, 2.2), 0x3a6ec8, -8, 8, 12.1);
  b.box(1, 1.3, 0.8, 6, 0, 11.5, 0x2a5ab8); b.box(1, 0.2, 0.8, 6, 1.3, 11.5, 0x1a3a7a); b.post(6, 11.5, 0.6, 1.5);
  bsign(scene, b, "POST OFFICE", 14, 2, 0, 7.6, 9.3, { bg: "#3a6ec8", fg: "#ffffff" });
}
export function pizza(scene, b) {
  b.box(20, 6, 18, 0, 0, 0, 0xf3e3c3).solid(0, 0, 10, 9); b.box(20.6, 0.6, 18.6, 0, 6, 0, 0x8a2a1a);
  for (let i = 0; i < 10; i++) b.add(new THREE.BoxGeometry(2, 0.12, 2.4), i % 2 ? 0xffffff : 0xe0302a, -9 + i * 2, 4.2, 10.1, 0.5, 0, 0);
  windows(b, 16, 2.4, 9.05, 3, 1.8, 3.2, 0xffe9a8); b.box(2.6, 3.4, 0.2, 7.5, 0, 9.1, 0x6a2a1a);
  b.cyl(4, 0.5, 0, 6.6, 0, 0xf0b040, 16); b.cyl(3.6, 0.2, 0, 7.1, 0, 0xffd860, 16);
  for (let i = 0; i < 7; i++) { const a = i * 0.9; b.cyl(0.5, 0.12, Math.cos(a) * 2.2, 7.3, Math.sin(a) * 2.2, 0xc8301a, 8); }
  bench(b, -6, 12); bench(b, 3, 12);
  bsign(scene, b, "PIZZA PETE'S", 14, 2.2, 0, 8.2, 9.4, { bg: "#e0302a", fg: "#ffffff", stroke: "#6a0a0a" });
}
export function gasAndWash(scene, b) {
  // (local spot is the middle of the block)
  b.box(18, 0.8, 12, -4, 5.4, -10, 0xffffff); b.box(18.2, 0.4, 12.2, -4, 5.2, -10, 0xe0302a);
  for (const [x, z] of [[-12, -15], [4, -15], [-12, -5], [4, -5]]) { b.box(0.5, 5.4, 0.5, x, 0, z, 0xdddddd); b.solid(x, z, 0.4, 0.4, 6); }
  for (const x of [-8, 0]) { b.box(1.2, 1.8, 0.8, x, 0, -10, 0xe0302a); b.box(1, 0.6, 0.85, x, 1.1, -10, 0xffffff, "glow"); b.solid(x, -10, 0.7, 0.5, 2); }
  b.box(10, 5, 8, 9, 0, -20, 0xf4f0e8).solid(9, -20, 5, 4); b.box(10.4, 0.6, 8.4, 9, 5, -20, 0xe0302a); windows(b, 8, 2.4, -15.95, 2, 1.8, 3);
  bsign(scene, b, "GAS", 5, 1.6, -4, 6.6, -3.9, { bg: "#e0302a", fg: "#ffffff" });
  // the car wash arch (drive under it and press E)
  b.box(0.8, 5.2, 7, -4.5, 0, 11, 0x5a9ad8).solid(-4.5, 11, 0.4, 3.5); b.box(0.8, 5.2, 7, 4.5, 0, 11, 0x5a9ad8).solid(4.5, 11, 0.4, 3.5);
  b.box(10, 0.8, 7, 0, 5.2, 11, 0x3a7ac8);
  for (const s of [-1, 1]) for (const z of [9, 13]) b.cyl(0.7, 4.4, s * 3.4, 0.3, z, 0x3ac8ff, 10);
  for (let i = 0; i < 8; i++) b.ball(0.5 + Math.random() * 0.4, -4 + Math.random() * 8, 5.9 + Math.random() * 0.4, 8 + Math.random() * 6, 0xffffff);
  bsign(scene, b, "CAR WASH", 9, 1.5, 0, 6.8, 14.55, { bg: "#3a7ac8", fg: "#ffffff" });
}
export function diner(scene, b) {
  b.box(24, 5, 14, 0, 0, 0, 0xd8dde3).solid(0, 0, 12, 7); b.box(24.2, 1, 14.2, 0, 1.6, 0, 0xe0304a); b.box(24.6, 0.5, 14.6, 0, 5, 0, 0x9aa4b0);
  windows(b, 20, 3.4, 7.05, 5, 1.6, 3, 0xbfe8ff, 0xe0e4ea); b.box(2.4, 3.4, 0.2, 9, 0, 7.1, 0x8a2a2a);
  b.cyl(2.4, 0.6, 0, 5.5, 0, 0xe0a050, 14); b.cyl(2.5, 0.7, 0, 6.1, 0, 0x6a3a1a, 14); b.cyl(2.7, 0.12, 0, 6.8, 0, 0xffd23a, 4); b.add(new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0a050, 0, 6.9, 0);
  bsign(scene, b, "DINER", 8, 2, -5, 6.4, 7.4, { bg: "#e0304a", fg: "#fff4a0", glow: true });
}
export function townHall(scene, b) {
  b.box(26, 8, 16, 0, 0, 0, 0xf6f2e8).solid(0, 0, 13, 8); b.roof(27, 3, 17, 0, 8, 0, 0x6a7a8a);
  for (let x = -9; x <= 9; x += 3) b.cyl(0.5, 7.6, x, 0, 9, 0xffffff, 10);
  b.box(22, 0.8, 3, 0, 7.6, 9, 0xf6f2e8); b.roof(22, 2, 3, 0, 8.4, 9, 0xf6f2e8, 0); b.box(20, 0.5, 4, 0, 0, 10, 0xdedad0);
  windows(b, 22, 4.5, 8.05, 5, 2.4, 1.6);
  b.box(5, 8, 5, 0, 8, -2, 0xf6f2e8); b.add(new THREE.ConeGeometry(3.8, 4, 4), 0x3a5a8a, 0, 18, -2, 0, Math.PI / 4);
  b.cyl(1.5, 0.2, 0, 13, 0.5, 0xffffff, 16, "glow"); b.add(new THREE.BoxGeometry(0.15, 1.2, 0.1), 0x222222, 0, 13.4, 0.65); b.add(new THREE.BoxGeometry(0.9, 0.15, 0.1), 0x222222, 0.35, 13.1, 0.65);
  // (the clock face is a flat disc turned to face the street)
  bsign(scene, b, "TOWN HALL", 10, 1.4, 0, 9.9, 10.6, { bg: "#f6f2e8", fg: "#3a4a6a" });
}
export function parkingLot(scene, b) {
  b.box(30, 0.06, 46, 0, 0.01, 0, 0x3c3f46);
  for (let i = 0; i < 5; i++) { b.box(0.25, 0.08, 6, -12 + i * 6, 0.02, 12, 0xffffff); b.box(0.25, 0.08, 6, -12 + i * 6, 0.02, -2, 0xffffff); }
  b.box(3, 3, 3, 12, 0, -19, 0xf2c94a).solid(12, -19, 1.5, 1.5); b.roof(3.6, 1.2, 3.6, 12, 3, -19, 0xe0302a); windows(b, 2, 1.6, -17.45, 1, 1, 1.6);
  bsign(scene, b, "TOWN PARKING", 8, 1.6, 0, 3.4, -21.5, { bg: "#2a6fd6", fg: "#ffffff", turn: Math.PI, back: true });
  b.box(0.2, 3.4, 0.2, -4, 0, -21.5, 0x888888); b.box(0.2, 3.4, 0.2, 4, 0, -21.5, 0x888888);
}
export function smallHouse(scene, b, k = 0) {
  const [wall, roofC] = PAINTS[k % PAINTS.length];
  const w = 11 + (k % 3), d = 9;
  b.box(w, 4, d, 0, 0, 0, wall).solid(0, 0, w / 2, d / 2);
  if (k % 2) { b.box(w * 0.5, 3.4, d, w * 0.25, 4, 0, wall); b.roof(w * 0.5 + 0.8, 2.2, d + 0.8, w * 0.25, 7.4, 0, roofC); b.roof(w * 0.5 + 0.8, 1.6, d + 0.8, -w * 0.25, 4, 0, roofC); windows(b, w * 0.5, 5.8, d / 2 + 0.05, 2, 1.2, 1.4); }
  else b.roof(w + 0.8, 3, d + 0.8, 0, 4, 0, roofC);
  windows(b, w, 2.2, d / 2 + 0.05, 3, 1.3, 1.5); b.box(1.6, 2.8, 0.2, w / 2 - 2, 0, d / 2 + 0.06, 0x7a4a2a);
  b.box(3, 0.3, 2, w / 2 - 2, 0, d / 2 + 1, 0xc8c0b0);
  fence(b, -w / 2 - 1, d / 2 + 4, w / 2 - 4, d / 2 + 4); b.solid(0, d / 2 + 4, w / 2, 0.2, 1.2);
  b.box(1, 1.2, 0.6, w / 2 + 0.5, 0, d / 2 + 4, 0x3a6ec8);
  tree(b, -w / 2 - 2.5, -2, 0.9, 1);
}
export function school(scene, b) {
  b.box(20, 7, 14, 0, 0, 0, 0xe8b07a).solid(0, 0, 10, 7); b.box(20.4, 0.8, 14.4, 0, 7, 0, 0xffffff);
  windows(b, 18, 2.2, 7.05, 5, 1.4, 2.2); windows(b, 18, 5, 7.05, 5, 1.4, 2.2); b.box(3, 3, 0.2, 0, 0, 7.1, 0x2a5a8a);
  b.box(3, 3, 3, 0, 7.8, 0, 0xe8b07a); b.add(new THREE.ConeGeometry(2.4, 2.4, 4), 0xc0302a, 0, 12, 0, 0, Math.PI / 4); b.ball(0.6, 0, 9.4, 1.6, 0xffd23a);
  bsign(scene, b, "VALLEY SCHOOL", 9, 1.3, 0, 6.1, 7.3, { bg: "#ffffff", fg: "#c0302a" });
}
export function hardware(scene, b) {
  b.box(22, 6, 14, 0, 0, 0, 0x6a8a5a).solid(0, 0, 11, 7); b.box(22.4, 1, 14.4, 0, 6, 0, 0xffb020);
  windows(b, 20, 2.4, 7.05, 4, 2, 3.2, 0xbfe8ff, 0xffb020); b.box(3, 3.4, 0.2, 0, 0, 7.1, 0x3a3a3a);
  for (let i = 0; i < 4; i++) b.box(1.4, 0.8, 0.9, -8 + i * 1.6, 0, 9, [0xd04030, 0x3a7ad0, 0xf0c030, 0x40a050][i]);
  bsign(scene, b, "VALLEY HARDWARE", 14, 1.8, 0, 7.6, 7.5, { bg: "#ffb020", fg: "#2a2a2a" });
}
export function waterTower(scene, b) {
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { b.add(new THREE.CylinderGeometry(0.25, 0.25, 14, 6), 0x8aa0b0, x * 0.85, 7, z * 0.85, z * 0.07, 0, -x * 0.07); b.post(x * 0.7, z * 0.7, 0.4, 14); }
  b.cyl(4.6, 6, 0, 13, 0, 0x8ac0e0, 16); b.add(new THREE.ConeGeometry(5, 2.4, 16), 0x6a9ab8, 0, 20.2, 0);
  bsign(scene, b, "MUD VALLEY", 7, 1.6, 0, 16, 4.65, { bg: null, fg: "#1a3a6a", px: 256 });
}
export function park(scene, b) {
  b.box(28, 0.08, 26, 0, 0.01, 0, 0x5cbf4a);
  b.cyl(4, 0.7, 0, 0, 0, 0xc8c0b0, 16); b.cyl(3.4, 0.2, 0, 0.6, 0, 0x4ab8f0, 16, "glass"); b.cyl(0.6, 2.4, 0, 0, 0, 0xc8c0b0, 8); b.cyl(1.4, 0.3, 0, 2.2, 0, 0xc8c0b0, 12); b.ball(0.5, 0, 2.9, 0, 0x8ad8ff, "glass");
  b.post(0, 0, 4, 1);
  for (const [x, z] of [[-10, -8], [10, -8], [-10, 8], [10, 8], [-4, -10], [6, 10]]) tree(b, x, z, 1.1, 1);
  bench(b, -6, 4); bench(b, 6, -4, Math.PI);
}

// ---------------------------------------------------------------- houses you can buy
export function camper(scene, b) {
  // a rusty old camper, a lawn chair and a campfire. Not fancy!
  b.box(9, 3, 3.6, 0, 0.6, 0, 0xe8e2d0).solid(0, 0, 4.6, 1.9); b.box(9.1, 0.6, 3.7, 0, 1.4, 0, 0x7ab0a0); b.box(9.1, 0.25, 3.7, 0, 3.6, 0, 0xb8ae98);
  b.box(2.2, 1.2, 3.4, -5, 0.6, 0, 0xe8e2d0); b.add(new THREE.BoxGeometry(2.4, 1.6, 3.4), 0xe8e2d0, -4.6, 2.2, 0, 0, 0, 0.5);
  for (const [x, z, s] of [[2, 1.86, 1.2], [-1.5, -1.86, 0.9], [3.6, -1.86, 1], [-3, 1.86, 0.8]]) b.box(s, s * 0.7, 0.06, x, 1.6 + Math.random(), z, 0x9a5a2a); // rust spots
  windows(b, 7, 2.4, 1.85, 2, 0.9, 1.4, 0xb8d8e0, 0xc8c2b0); b.box(1, 2.2, 0.1, 2.8, 0.7, 1.86, 0x8a8478);
  for (const x of [-2, 2]) b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 10), 0x2a2a2a, x, 0.45, 1.6, Math.PI / 2, 0, 0, "solid", 1, 1, 0.75);
  b.box(0.8, 0.6, 0.8, -3, 0, 2.4, 0x8a8a8a); b.box(0.8, 0.6, 0.8, 3, 0, 2.4, 0x8a8a8a); b.box(1.2, 0.3, 0.8, 2.8, 0, 2.5, 0x9a9a9a);
  // the yard
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; b.ball(0.35, 0 + Math.cos(a) * 1, 0.2, 6 + Math.sin(a) * 1, 0x8a8a8a); }
  b.add(new THREE.BoxGeometry(0.2, 0.2, 1.4), 0x6a4a2a, 0, 0.3, 6, 0, 0.6); b.add(new THREE.BoxGeometry(0.2, 0.2, 1.4), 0x6a4a2a, 0, 0.3, 6, 0, -0.6);
  b.ball(0.35, 0, 0.5, 6, 0xff8a1a, "glow"); b.ball(0.22, 0.1, 0.85, 6, 0xffd23a, "glow");
  b.box(0.9, 0.08, 0.9, -3, 0.5, 6.5, 0x3aa0ff); b.box(0.9, 0.9, 0.08, -3, 0.5, 6.1, 0x3aa0ff);
  b.cyl(0.08, 2.4, 6, 0, 3, 0x6a6a6a, 5); b.cyl(0.08, 2.4, 6, 0, 9, 0x6a6a6a, 5); b.add(new THREE.BoxGeometry(0.02, 0.02, 6), 0xffffff, 6, 2.3, 6);
  for (const [z, c] of [[4.4, 0xff5a5a], [5.6, 0x5a8aff], [7, 0xffd23a]]) b.box(0.05, 0.8, 0.7, 6, 1.5, z, c);
  b.box(1.4, 0.8, 0.9, -6, 0, 3, 0x6a7a5a); tires(b, -6, 4.8, 2);
  tree(b, -8, -4, 1.2); tree(b, 5, -5, 1.1); tree(b, -2, -6, 1.3);
}
export function cabin(scene, b) {
  for (let y = 0; y < 4.2; y += 0.42) { b.add(new THREE.CylinderGeometry(0.24, 0.24, 13, 7), y % 0.84 < 0.4 ? 0x9a6a3a : 0x8a5a30, 0, y + 0.22, 4.3, 0, 0, Math.PI / 2); b.add(new THREE.CylinderGeometry(0.24, 0.24, 13, 7), 0x8a5a30, 0, y + 0.22, -4.3, 0, 0, Math.PI / 2); b.add(new THREE.CylinderGeometry(0.24, 0.24, 9, 7), 0x9a6a3a, 6.3, y + 0.22, 0, Math.PI / 2); b.add(new THREE.CylinderGeometry(0.24, 0.24, 9, 7), 0x9a6a3a, -6.3, y + 0.22, 0, Math.PI / 2); }
  b.box(12.4, 4.2, 8.4, 0, 0, 0, 0x7a4e28).solid(0, 0, 6.5, 4.5);
  b.roof(14, 3.4, 10.4, 0, 4.2, 0, 0x2f6a3a); b.box(1.2, 5, 1.2, 4, 4, -1, 0x8a8a8a); b.box(1.5, 0.4, 1.5, 4, 9, -1, 0x6a6a6a);
  windows(b, 12, 2.3, 4.6, 2, 1.3, 1.6, 0xffe9a8, 0x5a3a1a); b.box(1.6, 3, 0.2, 0, 0, 4.6, 0x5a3a1a);
  b.box(12, 0.3, 3, 0, 0, 6, 0xa07040); for (const x of [-5.8, -2, 2, 5.8]) b.cyl(0.18, 3, x, 0, 7.3, 0x8a5a30, 6);
  b.add(prismGeo(13, 1.2, 3.4), 0x2f6a3a, 0, 3, 6, 0, 0, 0, "solid", 1, 1, 1);
  // a little garage shed
  b.box(5, 3.6, 6, 10.5, 0, -1, 0x9a6a3a).solid(10.5, -1, 2.5, 3); b.roof(5.8, 1.6, 6.8, 10.5, 3.6, -1, 0x2f6a3a); b.box(4, 3, 0.15, 10.5, 0, 2.05, 0xc8b090);
  bench(b, -3, 6.5); b.box(1.8, 0.6, 1, -8.5, 0, 3, 0x7a5a3a); for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 6), 0xb08050, -8.5, 0.8 + i * 0.05, 3 + (i - 1.5) * 0.25, 0, 0, Math.PI / 2);
  tree(b, -9, -4, 1.3); tree(b, -6, -8, 1.2); tree(b, 3, -9, 1.4); tree(b, 14, -7, 1.2);
}
export function familyHouse(scene, b) {
  b.box(14, 7, 10, 0, 0, 0, 0xa8d4ec).solid(0, 0, 7, 5);
  for (let y = 0.4; y < 7; y += 0.5) b.box(14.1, 0.06, 10.1, 0, y, 0, 0x98c4dc);
  b.roof(15, 3.6, 11, 0, 7, 0, 0x5a6270); b.box(14.3, 0.4, 10.3, 0, 3.4, 0, 0xffffff);
  windows(b, 14, 1.9, 5.05, 3, 1.4, 1.6); windows(b, 14, 5.2, 5.05, 3, 1.4, 1.6);
  b.box(1.8, 2.8, 0.2, -1.5, 0, 5.1, 0xd0402a); b.box(6, 0.3, 2.4, -2, 0, 6.2, 0xe8e4dc);
  b.add(prismGeo(6.6, 1.2, 2.6), 0x5a6270, -2, 3, 6.3); for (const x of [-4.8, 0.8]) b.cyl(0.15, 3, x, 0, 7.2, 0xffffff, 6);
  // 2-car garage on the side
  b.box(8, 4, 9, 11, 0, 0.5, 0xa8d4ec).solid(11, 0.5, 4, 4.5); b.roof(8.8, 2.2, 9.8, 11, 4, 0.5, 0x5a6270);
  for (const x of [9, 13]) { b.box(3.4, 3, 0.15, x, 0, 5.05, 0xffffff); for (let y = 0.5; y < 3; y += 0.5) b.box(3.4, 0.05, 0.2, x, y, 5.05, 0xdddddd); }
  b.box(8, 0.06, 7, 11, 0.01, 9, 0x8a8a8a);
  // backyard pool and fence
  b.box(8, 0.3, 5, -2, 0, -10, 0xf0f0f0); b.box(7, 0.32, 4, -2, 0, -10, 0x3ac0f0, "glass"); b.post(-2, -10, 3.5, 0.4);
  fence(b, -9, -15, 6, -15); fence(b, -9, -15, -9, -5); fence(b, 6, -15, 6, -5);
  tree(b, -10, 5, 1.2, 1); tree(b, 6, 9, 0.9, 1);
  b.box(1, 1.2, 0.6, 3, 0, 9, 0x3a6ec8);
}
export function farmhouse(scene, b) {
  // the farmhouse
  b.box(14, 7, 10, 0, 0, 0, 0xf4f0e6).solid(0, 0, 7, 5); b.roof(15, 4, 11, 0, 7, 0, 0xb83a2a);
  windows(b, 14, 2, 5.05, 3, 1.4, 1.5, 0xbfe8ff, 0x6a6a6a); windows(b, 14, 5.2, 5.05, 3, 1.4, 1.5, 0xbfe8ff, 0x6a6a6a);
  b.box(1.8, 2.8, 0.2, 0, 0, 5.1, 0x6a3a1a); b.box(14, 0.3, 3, 0, 0, 6.5, 0xb89a70); b.add(prismGeo(15, 1, 3.4), 0xb83a2a, 0, 3, 6.6);
  for (const x of [-6.5, -2, 2, 6.5]) b.cyl(0.15, 3, x, 0, 7.8, 0xffffff, 6);
  b.box(1.2, 4, 1.2, -4, 7, -2, 0x9a5a3a);
}
export function barn(scene, b) {
  b.box(16, 7, 14, 0, 0, 0, 0xc0302a).solid(0, 0, 8, 7);
  b.add(prismGeo(17, 5, 15), 0x6a6a72, 0, 7, 0); b.box(16.2, 0.4, 14.2, 0, 7, 0, 0xffffff);
  b.box(7, 6, 0.2, 0, 0, 7.05, 0x8a2018); b.add(new THREE.BoxGeometry(0.3, 8.4, 0.25), 0xffffff, 0, 3, 7.15, 0, 0, 0.7); b.add(new THREE.BoxGeometry(0.3, 8.4, 0.25), 0xffffff, 0, 3, 7.15, 0, 0, -0.7);
  b.box(7.4, 0.3, 0.3, 0, 6, 7.15, 0xffffff); b.box(0.3, 6, 0.3, -3.6, 0, 7.15, 0xffffff); b.box(0.3, 6, 0.3, 3.6, 0, 7.15, 0xffffff);
  b.box(2.4, 2, 0.2, 0, 9, 7.05, 0x8a2018);
  b.cyl(3, 14, 12, 0, -3, 0xd8d8dc, 16).post(12, -3, 3); b.add(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xb83a2a, 12, 14, -3);
  for (let i = 0; i < 6; i++) hay(b, -11 + (i % 3) * 1.4, 4 + Math.floor(i / 3) * 1.8);
  b.solid(-9.6, 5, 2.4, 2, 1.6);
}
export function mansion(scene, b) {
  // the best house in Mud Valley: white boxes, huge glass walls, wood panels, a glowing pool and a 4-car garage
  const W = 0xf6f6f4, D = 0x2a2c32, WOOD = 0xa8703a, G = 0x8fd0f0;
  b.box(30, 0.6, 22, 0, 0, -2, 0xd8d4cc); // stone base
  b.box(28, 5, 18, 0, 0.6, -3, W).solid(0, -3, 14, 9);
  b.box(26, 4, 0.2, 0, 1, 6.05, G, "glass"); for (let x = -12; x <= 12; x += 4) b.box(0.3, 4.6, 0.4, x, 0.6, 6.1, D);
  b.box(30, 0.6, 21, 0, 5.6, -2, D); b.box(30.2, 0.12, 21.2, 0, 5.4, -2, 0xffe9b0, "glow");
  // the top floor sticks out over the pool
  b.box(20, 4.6, 14, 4, 6.2, -1, W); b.box(18, 3.6, 0.2, 4, 6.7, 6.05, G, "glass"); b.box(0.2, 3.6, 12, 14.05, 6.7, -1, G, "glass");
  b.box(4, 4.6, 0.3, -4.2, 6.2, 6.1, WOOD); for (let y = 6.4; y < 10.6; y += 0.5) b.box(4.05, 0.06, 0.35, -4.2, y, 6.12, 0x8a5a2a);
  b.box(22, 0.5, 16, 4, 10.8, -1, D); b.box(22.2, 0.1, 16.2, 4, 10.7, -1, 0xffe9b0, "glow");
  b.box(8, 3.8, 8, -9, 6.2, -6, W); b.box(0.2, 2.8, 6, -13.05, 6.7, -6, G, "glass"); b.box(9, 0.4, 9, -9, 10, -6, D);
  // front door
  b.box(3, 3.8, 0.4, -4, 0.6, 6.2, WOOD); b.box(6, 0.2, 3, -4, 0.6, 7.6, 0xd8d4cc); b.box(6.4, 0.3, 3.4, -4, 4.4, 7.4, D);
  // 4-car garage
  b.box(18, 4.4, 10, -24, 0, -1, W).solid(-24, -1, 9, 5); b.box(19, 0.5, 11, -24, 4.4, -1, D);
  for (let i = 0; i < 4; i++) { b.box(3.6, 3.2, 0.15, -30.6 + i * 4.4, 0.1, 4.05, 0x50545c); for (let y = 0.4; y < 3.2; y += 0.4) b.box(3.6, 0.04, 0.2, -30.6 + i * 4.4, y, 4.05, 0x40444a); b.box(3.6, 0.12, 0.2, -30.6 + i * 4.4, 3.4, 4.1, 0xffe9b0, "glow"); }
  b.box(18, 0.06, 12, -24, 0.01, 10, 0xc8c4bc);
  // infinity pool with lights, loungers and palms
  b.box(16, 0.6, 7, 8, 0, 12, 0xf0f0ee); b.box(15, 0.62, 6, 8, 0, 12, 0x2ad0ff, "glass"); b.box(15.2, 0.06, 6.2, 8, 0.3, 12, 0x6af0ff, "glow"); b.post(8, 12, 4.5, 0.6);
  for (const x of [2, 5, 8]) { b.add(new THREE.BoxGeometry(0.9, 0.2, 2.2), 0xffffff, x, 0.5, 17, -0.15); b.add(new THREE.BoxGeometry(0.9, 0.7, 0.2), 0xffffff, x, 0.8, 16, 0.6); }
  for (const [x, z] of [[17, 15], [-1, 16], [17, 6]]) palm(b, x, z);
  // driveway lights and a fountain
  for (const x of [-34, -16]) { b.box(0.8, 2.2, 0.8, x, 0, 17, W); b.box(0.9, 0.5, 0.9, x, 2.2, 17, 0xffe9b0, "glow"); b.solid(x, 17, 0.5, 0.5, 3); }
  b.cyl(3, 0.6, -24, 0, 18, 0xe8e4dc, 16); b.cyl(2.6, 0.62, -24, 0, 18, 0x4ab8f0, 16, "glass"); b.cyl(0.4, 2, -24, 0, 18, 0xe8e4dc, 8); b.ball(0.6, -24, 2.3, 18, 0x9ae8ff, "glass"); b.post(-24, 18, 3, 1);
  for (const [x, z] of [[-34, -8], [18, -10], [-14, -12], [20, 2]]) tree(b, x, z, 1.1, 1);
  for (let x = -14; x <= 18; x += 2) b.box(1.6, 0.6, 1, x, 0, -13.5, 0x4a9a3a);
}
function palm(b, x, z) {
  for (let i = 0; i < 5; i++) b.add(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.26 - i * 0.02, 1.3, 6), 0x9a7a4a, x + i * 0.12, 0.65 + i * 1.25, z, 0, 0, -0.08);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.add(new THREE.BoxGeometry(0.6, 0.08, 3.2), 0x3aa83a, x + 0.6 + Math.cos(a) * 1.4, 6.1, z + Math.sin(a) * 1.4, 0.35, -a + Math.PI / 2, 0); }
  b.post(x, z, 0.4, 7);
}

// ---------------------------------------------------------------- places outside town
export function lumberYard(scene, b) {
  b.box(14, 0.4, 10, 0, 0, 0, 0x8a7a5a); for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) { b.box(0.5, 5, 0.5, x, 0, z, 0x6a4a2a); b.post(x, z, 0.35, 5); }
  b.roof(15, 2, 11, 0, 5, 0, 0x5a6a7a, Math.PI / 2 * 0);
  b.cyl(1.2, 0.3, 0, 1.4, 0, 0xc8c8d0, 16); b.box(5, 1.2, 1.4, 0, 0.4, 0, 0x7a5a3a);
  for (let p = 0; p < 3; p++) {
    const px = -14 + p * 12, pz = 14;
    for (let r = 0; r < 4; r++) for (let i = 0; i < 5 - r; i++) b.add(new THREE.CylinderGeometry(0.55, 0.55, 8, 8), [0x9a6a3a, 0x8a5a30, 0xa87a48][(i + r) % 3], px - 2.2 + i * 1.1 + r * 0.55, 0.55 + r * 0.95, pz, Math.PI / 2, 0, 0);
    b.solid(px, pz, 3, 4.2, 4);
  }
  b.box(8, 3.4, 6, 14, 0, -6, 0x9a6a3a).solid(14, -6, 4, 3); b.roof(8.8, 1.8, 6.8, 14, 3.4, -6, 0x3a5a3a); windows(b, 8, 1.8, -2.95, 2, 1, 1.4, 0xffe9a8, 0x5a3a1a);
  bsign(scene, b, "LUMBER YARD", 9, 1.6, 0, 7.6, 0, { bg: "#6a4a2a", fg: "#ffe9a8", back: true });
  for (let i = 0; i < 6; i++) tree(b, -24 + i * 9, -18, 1.3);
}
export function construction(scene, b) {
  b.box(26, 0.3, 18, 0, 0, 0, 0xb8a888);
  const beam = 0xe0a020;
  for (let fl = 0; fl < 3; fl++) for (const [x, z] of [[-8, -5], [0, -5], [8, -5], [-8, 5], [0, 5], [8, 5]]) b.box(0.5, 4, 0.5, x, fl * 4, z, beam);
  for (let fl = 1; fl <= 3; fl++) { b.box(16.5, 0.4, 0.5, 0, fl * 4, -5, beam); b.box(16.5, 0.4, 0.5, 0, fl * 4, 5, beam); for (const x of [-8, 0, 8]) b.box(0.5, 0.4, 10.5, x, fl * 4, 0, beam); }
  b.box(16, 0.3, 10, 0, 4, 0, 0xa0a0a0); b.solid(0, 0, 8.5, 5.5);
  // the tower crane
  b.box(1.4, 30, 1.4, 14, 0, -8, 0xffc020).post(14, -8, 1.2); for (let y = 2; y < 30; y += 2) b.box(1.5, 0.1, 1.5, 14, y, -8, 0x8a6a10);
  b.box(30, 1, 1, 6, 30, -8, 0xffc020); b.box(4, 2, 2, 21, 28, -8, 0x6a6a6a); b.box(2, 2, 2, 14, 30.8, -8, 0x3a6ec8);
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 18, 4), 0x222222, -6, 21.5, -8); b.box(2, 1, 2, -6, 12, -8, 0x8a6a3a);
  for (let i = 0; i < 6; i++) b.add(new THREE.ConeGeometry(0.3, 0.8, 8), 0xff6a1a, -12 + i * 2, 0.4, 10);
  b.add(new THREE.ConeGeometry(4, 3, 7), 0x9a7a4a, -15, 1.2, -6); b.post(-15, -6, 3.4, 2.5);
  b.box(1.4, 2.4, 1.4, 12, 0, 8, 0x3a8ad0); b.solid(12, 8, 0.7, 0.7);
  bsign(scene, b, "CONSTRUCTION SITE", 10, 1.6, -10, 2.2, 9.6, { bg: "#ffc020", fg: "#222222" });
  b.box(0.2, 2.4, 0.2, -14.5, 0, 9.6, 0x888888); b.box(0.2, 2.4, 0.2, -5.5, 0, 9.6, 0x888888);
}
export function rangerStation(scene, b) {
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) { b.box(0.4, 8, 0.4, x, 0, z, 0x7a5232); b.post(x, z, 0.4, 8); }
  b.box(7, 0.4, 7, 0, 8, 0, 0x8a5a30); b.box(6, 3, 6, 0, 8.4, 0, 0x9a6a3a); b.add(new THREE.ConeGeometry(5.6, 2.6, 4), 0x2f6a3a, 0, 12.7, 0, 0, Math.PI / 4);
  for (const z of [3.05, -3.05]) b.box(4.6, 1.4, 0.12, 0, 9.6, z, 0x9fd6f5, "glass");
  b.box(8, 3.2, 6, 10, 0, 0, 0x8a5a30).solid(10, 0, 4, 3); b.roof(8.8, 1.8, 6.8, 10, 3.2, 0, 0x2f6a3a);
  b.cyl(0.1, 9, -6, 0, 4, 0xdddddd, 6); b.add(new THREE.BoxGeometry(0.05, 1.4, 2.2), 0x3aa04a, -6, 8, 5.1);
  bsign(scene, b, "RANGER STATION", 8, 1.4, 10, 2.4, 3.1, { bg: "#2f6a3a", fg: "#ffffff" });
}
export function campground(scene, b) {
  const cols = [0xff6a3a, 0x3a9aff, 0x4adf6a, 0xffd23a];
  for (let i = 0; i < 4; i++) { const a = i * 1.5 + 0.4, x = Math.cos(a) * 9, z = Math.sin(a) * 9; b.add(prismGeo(3, 2.2, 3.4), cols[i], x, 0, z, 0, -a); b.post(x, z, 1.8, 2); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.ball(0.35, Math.cos(a), 0.2, Math.sin(a), 0x8a8a8a); }
  b.ball(0.45, 0, 0.5, 0, 0xff8a1a, "glow"); b.ball(0.28, 0, 0.95, 0, 0xffe04a, "glow");
  b.box(2.4, 0.15, 1.2, 4, 0.8, -3, 0x9a6a3a); b.box(2.4, 0.12, 0.4, 4, 0.45, -2.2, 0x9a6a3a); b.box(2.4, 0.12, 0.4, 4, 0.45, -3.8, 0x9a6a3a);
}
export function dock(scene, b) {
  for (let i = 0; i < 9; i++) b.box(3, 0.2, 1.1, 0, 0.6, i * 1.15, 0xa07848);
  for (let i = 0; i < 9; i += 2) for (const x of [-1.4, 1.4]) b.cyl(0.15, 3, x, -2, i * 1.15, 0x7a5a30, 6);
  b.add(new THREE.BoxGeometry(1.4, 0.6, 3.6), 0xe04a3a, 2.6, -0.9, 7, 0, 0.3, 0); b.add(new THREE.BoxGeometry(1.2, 0.1, 3.2), 0xffffff, 2.6, -0.6, 7, 0, 0.3, 0);
  bench(b, -2.6, 1.5);
}
export function speedwayStuff(scene, b, len = 60) {
  // a grandstand full of colorful seats
  for (let r = 0; r < 6; r++) {
    b.box(len, 0.7, 1.4, 0, r * 0.7, -r * 1.4, 0xb8bcc4);
    for (let i = 0; i < len / 1.2; i++) b.box(0.8, 0.4, 0.6, -len / 2 + 0.6 + i * 1.2, r * 0.7 + 0.7, -r * 1.4, [0xff3a5a, 0x3aa0ff, 0xffd23a, 0x4adf6a, 0xffffff][(i * 7 + r * 3) % 5]);
  }
  b.box(len, 6, 0.4, 0, 0, -8.6, 0x9aa0aa); b.box(len + 1, 0.4, 10, 0, 7, -4, 0xe0302a);
  for (const x of [-len / 2, len / 2]) b.box(0.4, 7, 0.4, x, 0, 0.4, 0x777777);
  b.solid(0, -4, len / 2, 4.6);
}
export function startArch(scene, b, w, text, opts = {}) {
  for (const s of [-1, 1]) { b.box(1, 7, 1, s * (w / 2 + 0.8), 0, 0, opts.pole || 0xe0302a); b.post(s * (w / 2 + 0.8), 0, 0.8, 7); }
  b.box(w + 2.6, 1.8, 0.8, 0, 6.6, 0, opts.pole || 0xe0302a);
  const t = signTex(text, 1024, 128, null, "#ffffff", { stroke: "#000000" });
  const chk = document.createElement("canvas"); chk.width = 512; chk.height = 64; const g = chk.getContext("2d");
  for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#111" : "#fff"; g.fillRect(i * 16, j * 16, 16, 16); }
  const ct = new THREE.CanvasTexture(chk); ct.colorSpace = THREE.SRGBColorSpace;
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 2.4, 1.6), new THREE.MeshLambertMaterial({ map: ct })); const p = b.world(0, side * 0.42);
    m.position.set(p.x, b.fy + 7.5, p.z); m.rotation.y = b.fyaw + (side < 0 ? Math.PI : 0); scene.add(m);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(w + 2, (w + 2) / 8), new THREE.MeshBasicMaterial({ map: t, transparent: true })); s2.position.set(p.x, b.fy + 9.4, p.z); s2.rotation.y = m.rotation.y; scene.add(s2);
  }
}

// ---------------------------------------------------------------- Copper Creek (the second town) and the new places
// a simple shop: walls, a big window, an awning and a sign. (front faces +z before turning)
export function shop(scene, b, text, wall, trim, w = 18, d = 14, h = 6, signOpts = {}) {
  b.box(w, h, d, 0, 0, 0, wall).solid(0, 0, w / 2, d / 2);
  b.box(w + 0.6, 0.6, d + 0.6, 0, h, 0, trim);
  windows(b, w - 4, 2.4, d / 2 + 0.05, 2, 2, (w - 8) / 2.4, 0xbfe8ff, trim); b.box(2.4, 3.4, 0.2, 0, 0, d / 2 + 0.1, 0x3a3a3a);
  for (let i = 0; i < 8; i++) b.add(new THREE.BoxGeometry(w / 8, 0.12, 2.2), i % 2 ? 0xffffff : trim, -w / 2 + w / 16 + (i * w) / 8, 3.9, d / 2 + 1.0, 0.45, 0, 0); // (slopes down and away from the wall)
  bsign(scene, b, text, Math.min(w - 2, 16), 2.2, 0, h - 1.4, d / 2 + 0.35, { bg: signOpts.bg || "#ffffff", fg: signOpts.fg || "#222222", stroke: signOpts.stroke });
}
export function bank(scene, b) {
  b.box(26, 9, 18, 0, 0, 0, 0xe8e2d4).solid(0, 0, 13, 9); b.roof(27, 3, 19, 0, 9, 0, 0x6a7a6a);
  b.box(22, 0.8, 4, 0, 0, 10.4, 0xdedad0); b.box(22, 1, 3, 0, 8, 10.2, 0xe8e2d4); b.roof(22, 2.2, 3, 0, 9, 10.2, 0xe8e2d4);
  for (let x = -9; x <= 9; x += 3) b.cyl(0.55, 7.2, x, 0.8, 11, 0xffffff, 10);
  // big closed double doors (wood + glass, brass handles). The vault is deep inside (interiors.js).
  b.box(4.4, 5.4, 0.3, 0, 0.8, 9.05, 0x5a3a1a); b.box(0.1, 5.2, 0.34, 0, 0.8, 9.05, 0x2a1a0a);
  for (const sx of [-1, 1]) { b.box(1.5, 2.2, 0.34, sx * 1.05, 3.1, 9.05, 0xbfe8ff, "glass"); b.box(0.12, 0.7, 0.42, sx * 0.3, 2.5, 9.05, 0xffd23a); b.box(1.6, 0.12, 0.36, sx * 1.05, 2.2, 9.05, 0x2a1a0a); }
  b.box(5, 0.4, 0.5, 0, 6.2, 9.1, 0xc8b070);
  bsign(scene, b, "COPPER CREEK BANK", 18, 1.8, 0, 8.6, 11.8, { bg: "#2a6a4a", fg: "#ffe9a8" });
  bsign(scene, b, "$", 3, 3, 0, 11.2, 9.7, { bg: null, fg: "#ffd23a", px: 128, stroke: "#3a2a00" });
}
export function jewelry(scene, b) {
  shop(scene, b, "SPARKLE JEWELRY", 0xf4e4f8, 0x9a4ad8, 18, 14, 6, { bg: "#9a4ad8", fg: "#ffffff" });
  // glass cases with glowing gems in front of the window
  for (const x of [-5, 0, 5]) { b.box(3, 1, 1.4, x, 0, 9, 0xddddee); b.box(2.6, 0.7, 1.1, x, 1, 9, 0xbfe8ff, "glass"); for (let i = 0; i < 3; i++) b.ball(0.18, x - 0.8 + i * 0.8, 1.35, 9, [0x6af0ff, 0xff5ad8, 0x7aff5a][i], "glow"); b.solid(x, 9, 1.5, 0.7, 1.8); }
}
export function policeStation(scene, b) {
  b.box(30, 8, 18, 0, 0, 0, 0xf2f2f4).solid(0, 0, 15, 9); b.box(30.6, 1, 18.6, 0, 8, 0, 0x2a4ac8); b.box(30.2, 1.6, 18.2, 0, 0, 0, 0x2a4ac8);
  windows(b, 24, 4.6, 9.05, 6, 1.6, 2.2, 0xbfe8ff, 0x2a4ac8); b.box(4, 3.8, 0.2, -6, 0, 9.1, 0x1a2a6a);
  b.box(8, 0.4, 4, -6, 3.9, 10.5, 0x2a4ac8); for (const x of [-9.6, -2.4]) b.cyl(0.18, 3.9, x, 0, 12.2, 0xdddddd, 6);
  // the jail wing with bars
  // (an open cell you can see into through the bars)
  b.box(12, 6, 6, 21, 0, -6, 0xb8bcc4).solid(21, -6, 6, 3); b.box(12.4, 0.5, 8.4, 21, 5.6, 1, 0x9a9ea8);
  for (const x of [15.2, 26.8]) { b.box(0.4, 6, 8, x, 0, 1, 0xb8bcc4); b.solid(x, 1, 0.2, 4); }
  b.box(11.2, 0.1, 8, 21, 0.02, 1, 0x8a8a92); b.box(2.4, 0.5, 0.9, 24.5, 0.1, -2.4, 0x8a6a4a); // the floor and a bench
  b.solid(21, 5.1, 6, 0.2);
  for (let x = 16; x <= 26; x += 0.8) b.box(0.12, 4.2, 0.12, x, 0.6, 5.1, 0x3a3a44);
  b.box(10.4, 0.25, 0.3, 21, 4.8, 5.1, 0x3a3a44); b.box(10.4, 0.25, 0.3, 21, 0.6, 5.1, 0x3a3a44);
  // a flag and a light bar on the roof
  b.cyl(0.12, 12, -16, 0, 12, 0xdddddd, 6); b.add(new THREE.BoxGeometry(0.05, 1.6, 2.6), 0x2a4ac8, -16, 11, 13.4); b.post(-16, 12, 0.3, 12);
  b.box(3, 0.6, 0.8, 0, 9, 0, 0x222222); b.box(1.3, 0.5, 0.7, -0.75, 9.5, 0, 0xff2a2a, "glow"); b.box(1.3, 0.5, 0.7, 0.75, 9.5, 0, 0x2a6aff, "glow");
  bsign(scene, b, "POLICE", 12, 2.2, -6, 6.6, 9.4, { bg: "#2a4ac8", fg: "#ffffff" });
  bsign(scene, b, "JAIL", 5, 1.4, 21, 5.6, 5.3, { bg: "#3a3a44", fg: "#ffd23a" });
  // parking spots out front
  b.box(26, 0.06, 10, -2, 0.01, 17, 0x3c3f46); for (let i = 0; i < 5; i++) b.box(0.25, 0.08, 6, -12 + i * 5, 0.02, 17, 0xffffff);
}
export function hospital(scene, b) {
  b.box(24, 10, 16, 0, 0, 0, 0xffffff).solid(0, 0, 12, 8); b.box(24.4, 0.6, 16.4, 0, 10, 0, 0xe04a4a);
  windows(b, 20, 3, 8.05, 5, 1.6, 2.4); windows(b, 20, 6.8, 8.05, 5, 1.6, 2.4); b.box(4, 3.6, 0.2, 0, 0, 8.1, 0x6ad0ff, "glass");
  b.box(1.2, 4, 0.3, 0, 10.6, 0, 0xe03a3a); b.box(4, 1.2, 0.3, 0, 12, 0, 0xe03a3a);
  bsign(scene, b, "HOSPITAL", 10, 1.8, 0, 8.8, 8.3, { bg: "#ffffff", fg: "#e03a3a" });
}
export function gearShop(scene, b) {
  // the Tool Barn: a red barn shop full of tools
  b.box(18, 7, 14, 0, 0, 0, 0xb84a2a).solid(0, 0, 9, 7); b.add(prismGeo(19, 4, 15), 0x5a5a62, 0, 7, 0);
  b.box(6, 5, 0.2, 0, 0, 7.05, 0x7a2a18); b.add(new THREE.BoxGeometry(0.3, 6.6, 0.25), 0xffffff, 0, 2.5, 7.15, 0, 0, 0.75); b.add(new THREE.BoxGeometry(0.3, 6.6, 0.25), 0xffffff, 0, 2.5, 7.15, 0, 0, -0.75);
  for (const [x, c] of [[-6.5, 0xffb020], [6.5, 0x3a7ad0]]) { b.box(1.8, 1.2, 1, x, 0, 8.4, c); b.box(1.8, 0.2, 1, x, 1.2, 8.4, 0x333333); }
  b.add(new THREE.BoxGeometry(0.3, 3.2, 0.3), 0x9a9aa0, 9.6, 4, 7.4, 0, 0, 0.6); b.box(0.9, 0.5, 0.4, 10.3, 5.2, 7.4, 0x6a6a72); // a giant wrench
  bsign(scene, b, "TOOL BARN", 12, 2, 0, 9.0, 7.3, { bg: "#ffb020", fg: "#3a1a00" });
}
export function blasterShop(scene, b) {
  shop(scene, b, "GUN SHOP", 0xd8d2c4, 0x3a3a3a, 18, 14, 6, { bg: "#2a2a2a", fg: "#ffd23a", stroke: "#000000" });
  // paint splats all over the walls
  const cols = [0x3ad0ff, 0x7aff5a, 0xff8a1a, 0x9a5aff, 0xff3a5a];
  for (let i = 0; i < 12; i++) b.add(new THREE.CylinderGeometry(0.5 + (i % 3) * 0.3, 0.5 + (i % 3) * 0.3, 0.05, 9), cols[i % 5], -8 + (i * 1.47) % 16, 1 + ((i * 2.3) % 4.6), 7.06, Math.PI / 2, 0, 0);
  b.box(2, 0.2, 2, 6, 6.6, 0, 0x3ad0ff); b.ball(1.2, 6, 7.8, 0, 0xff5ad8);
}
// a pawn shop: a small shop on a stone base (it sits on hills) with the three golden balls hanging out front
export function pawnShop(scene, b) {
  b.box(14.6, 3, 12.6, 0, -3, 0, 0x8a8478);
  smallShop(scene, b, "PAWN SHOP", 0xe8dcc0, 0x2a7a3a);
  b.box(0.2, 0.2, 2.2, 5.5, 5.4, 6.9, 0x3a3a3a); for (const [x, y] of [[5.1, 4.5], [5.9, 4.5], [5.5, 3.9]]) b.ball(0.32, x, y, 7.8, 0xffd23a, "glow");
  bsign(scene, b, "$ WE BUY STUFF $", 8, 1, 0, 3.4, 6.25, { bg: "#ffd23a", fg: "#2a3a1a" });
}
export function smallShop(scene, b, text, wall, trim) { shop(scene, b, text, wall, trim, 14, 12, 5, { bg: "#" + trim.toString(16).padStart(6, "0"), fg: "#ffffff" }); }
export function baitShop(scene, b) {
  b.box(8, 3.6, 6, 0, 0, 0, 0x6a9a7a).solid(0, 0, 4, 3); b.roof(9, 1.8, 7, 0, 3.6, 0, 0x3a5a4a);
  b.box(8, 0.3, 2.4, 0, 0, 4.2, 0xa07848); for (const x of [-3.7, 3.7]) b.cyl(0.12, 3.4, x, 0, 5.2, 0x7a5a30, 6);
  b.box(3, 1, 0.8, -1.5, 0, 4.4, 0x5a8aaa); b.box(1, 1.2, 0.8, 2.5, 0, 4.4, 0xffffff); b.box(1, 0.3, 0.8, 2.5, 1.2, 4.4, 0x3a8ad0); // a cooler + a bait fridge
  bsign(scene, b, "BAIT & TACKLE", 7, 1.3, 0, 4.9, 3.15, { bg: "#3a8ad0", fg: "#ffffff" });
  b.add(new THREE.TorusGeometry(0.6, 0.15, 6, 12, Math.PI * 1.5), 0xff7aa8, 3.2, 4.2, 3.2, 0, 0, 0.6); // a giant worm
}
export function longDock(scene, b, len = 16) {
  for (let i = 0; i < len / 1.15; i++) b.box(3, 0.2, 1.1, 0, 0.5, i * 1.15, 0xa07848);
  for (let i = 0; i < len / 1.15; i += 3) for (const x of [-1.4, 1.4]) b.cyl(0.15, 3.5, x, -2.8, i * 1.15, 0x7a5a30, 6);
  bench(b, -1.2, len - 2, Math.PI / 2);
}
export function hideout(scene, b) {
  // a wobbly old shack in the woods (the secret clubhouse of the Mud Valley robbers)
  b.box(9, 4, 7, 0, 0, 0, 0x7a6a50).solid(0, 0, 4.5, 3.5); b.add(prismGeo(10, 2, 8), 0x5a4a3a, 0, 4, 0, 0, 0, 0.06);
  for (let i = 0; i < 8; i++) b.box(0.9, 3.8, 0.1, -3.9 + i * 1.1, 0.1, 3.56, [0x8a7a5a, 0x6a5a40][i % 2]);
  b.box(1.4, 2.6, 0.12, 0, 0, 3.62, 0x3a2a1a); b.add(new THREE.BoxGeometry(1.6, 0.25, 0.14), 0x9a8a6a, 2.5, 2.4, 3.64, 0, 0, 0.5); b.add(new THREE.BoxGeometry(1.6, 0.25, 0.14), 0x9a8a6a, 2.5, 2.4, 3.64, 0, 0, -0.5);
  for (let i = 0; i < 3; i++) b.box(1, 0.8, 0.8, -6 + i * 0.3, i * 0.8, 2, 0x8a6a3a); // crates
  b.box(1.2, 0.9, 0.9, 5.6, 0, 1.6, 0x5a4a8a); b.solid(-5.7, 2, 0.7, 0.6, 2.4);
  bsign(scene, b, "HIDEOUT\nKEEP OUT!", 3.6, 1.6, 0, 3.4, 3.7, { bg: "#3a2a1a", fg: "#ffd23a" });
}
export function lookout(scene, b) {
  // a tall wooden lookout tower with a telescope (you can see all of Mud Valley from up here!)
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { b.add(new THREE.CylinderGeometry(0.2, 0.25, 9, 6), 0x7a5232, x * 0.85, 4.5, z * 0.85, z * 0.05, 0, -x * 0.05); b.post(x * 0.85, z * 0.85, 0.3, 9); }
  b.box(5.4, 0.3, 5.4, 0, 9, 0, 0x9a6a3a); for (const s of [-1, 1]) { b.box(5.4, 1, 0.12, 0, 9.3, s * 2.65, 0x8a5a30); b.box(0.12, 1, 5.4, s * 2.65, 9.3, 0, 0x8a5a30); }
  b.add(new THREE.ConeGeometry(4.2, 2, 4), 0x2f6a3a, 0, 12.6, 0, 0, Math.PI / 4); for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) b.box(0.15, 2.2, 0.15, x, 9.3, z, 0x7a5232);
  b.add(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 8), 0x3a3a44, 1.2, 10.6, 1.2, 1.2, 0, 0); b.cyl(0.05, 1, 1.2, 9.3, 1.2, 0x222222, 5);
  // a ladder
  for (let y = 0.5; y < 9; y += 0.6) b.box(1, 0.1, 0.1, 0, y, 2.9, 0x8a5a30);
  b.box(0.1, 9, 0.1, -0.5, 0, 2.9, 0x7a5232); b.box(0.1, 9, 0.1, 0.5, 0, 2.9, 0x7a5232);
  bsign(scene, b, "THUNDER PEAK", 6, 1.2, 0, 1.6, 4.2, { bg: "#2f6a3a", fg: "#ffffff", back: true });
}
export function atm(scene, b) {
  b.box(1.1, 2, 0.7, 0, 0, 0, 0x2a8a5a).solid(0, 0, 0.55, 0.35, 2); b.box(0.8, 0.5, 0.05, 0, 1.3, 0.36, 0x6af0ff, "glow"); b.box(0.6, 0.08, 0.1, 0, 0.9, 0.38, 0x222222);
  bsign(scene, b, "ATM", 0.9, 0.3, 0, 1.75, 0.37, { bg: "#ffd23a", fg: "#1a3a1a", px: 128 });
}
// the wooden fence all the way around the valley (gh = ground height)
export function borderFence(b, half, gh) {
  for (const side of [0, 1, 2, 3]) {
    for (let t = -half; t < half; t += 6) {
      const p = (u) => (side === 0 ? [u, -half] : side === 1 ? [half, u] : side === 2 ? [-u, half] : [-half, -u]);
      const [x0, z0] = p(t), [x1, z1] = p(t + 6), y0 = gh(x0, z0), y1 = gh(x1, z1);
      b.add(new THREE.BoxGeometry(0.3, 1.8, 0.3), 0x8a6a42, x0, y0 + 0.7, z0);
      const flat = Math.hypot(x1 - x0, z1 - z0), l = Math.hypot(flat, y1 - y0), ry = Math.atan2(x1 - x0, z1 - z0), rx = -Math.atan2(y1 - y0, flat);
      for (const y of [0.6, 1.3]) b.add(new THREE.BoxGeometry(0.12, 0.22, l).rotateX(rx).rotateY(ry), y > 1 ? 0xffd23a : 0xa07848, (x0 + x1) / 2, (y0 + y1) / 2 + y, (z0 + z1) / 2);
    }
  }
}
