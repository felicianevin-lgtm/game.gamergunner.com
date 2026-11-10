// ZOMBIE SIEGE: the arena (a fenced town square), what blocks things, and the zombies' path-finding.
import * as THREE from "/create/vendor/three.module.js";
import { mergeGeometries } from "/create/vendor/BufferGeometryUtils.js";

export const HX = 30, HZ = 22; // the fence: x from -30 to 30, z from -22 to 22
export const GATE = 2.6; // half width of each gate
// zombies come in from just outside the four gates
export const GATES = [
  { x: 0, z: -HZ - 4, ax: "x" }, { x: 0, z: HZ + 4, ax: "x" },
  { x: -HX - 4, z: 0, ax: "z" }, { x: HX + 4, z: 0, ax: "z" },
];

// ---------------------------------------------------------------- one big merged mesh for all the scenery (few draw calls)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
class Builder {
  constructor() { this.parts = []; }
  add(geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, jitter = 0.04) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(_m);
    _c.set(color); const k = 1 + (Math.random() - 0.5) * jitter * 2;
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
  }
  box(w, h, d, color, x, y, z, ry = 0, jitter) { this.add(BOX, color, x, y, z, 0, ry, 0, w, h, d, jitter); }
  mesh(mat) { const m = new THREE.Mesh(mergeGeometries(this.parts), mat); this.parts = []; return m; }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const CONE4 = new THREE.ConeGeometry(1, 1, 4);

// ---------------------------------------------------------------- the ground: a painted canvas
function groundTexture() {
  const W = 1024, H = 820, S = W / 100; // 100 x 80 meters
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const X = (x) => (x + 50) * S, Z = (z) => (z + 40) * S;
  g.fillStyle = "#4f9a3e"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#62b04c"; g.fillRect(X(-HX), Z(-HZ), HX * 2 * S, HZ * 2 * S);
  for (let i = 0; i < 2600; i++) { // grass speckles
    const x = Math.random() * W, y = Math.random() * H, r = 1 + Math.random() * 3;
    g.fillStyle = Math.random() < 0.5 ? "rgba(40,90,30,0.35)" : "rgba(150,210,90,0.35)"; g.fillRect(x, y, r, r * 2);
  }
  for (let i = 0; i < 26; i++) { // dirt patches
    const x = Math.random() * W, y = Math.random() * H; g.fillStyle = "rgba(120,90,50,0.22)";
    g.beginPath(); g.ellipse(x, y, 10 + Math.random() * 30, 6 + Math.random() * 16, Math.random() * 3, 0, 7); g.fill();
  }
  // stone paths to the four gates and out to the street
  const stone = (x0, z0, x1, z1) => {
    g.fillStyle = "#c8b896"; g.fillRect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S);
    g.strokeStyle = "rgba(90,75,55,0.35)"; g.lineWidth = 1.2;
    for (let x = Math.ceil(x0); x < x1; x += 1) { g.beginPath(); g.moveTo(X(x), Z(z0)); g.lineTo(X(x), Z(z1)); g.stroke(); }
    for (let z = Math.ceil(z0); z < z1; z += 1) { g.beginPath(); g.moveTo(X(x0), Z(z)); g.lineTo(X(x1), Z(z)); g.stroke(); }
  };
  stone(-2.5, -40, 2.5, 40); stone(-50, -2.5, 50, 2.5);
  // the round plaza
  g.save(); g.beginPath(); g.arc(X(0), Z(0), 11 * S, 0, 7); g.clip();
  g.fillStyle = "#d4c4a0"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(100,80,60,0.35)"; g.lineWidth = 1.3;
  for (let r = 1.2; r < 11; r += 1.2) { g.beginPath(); g.arc(X(0), Z(0), r * S, 0, 7); g.stroke(); }
  for (let a = 0; a < 48; a++) { const t = (a / 48) * Math.PI * 2; g.beginPath(); g.moveTo(X(Math.cos(t) * 2.6), Z(Math.sin(t) * 2.6)); g.lineTo(X(Math.cos(t) * 11), Z(Math.sin(t) * 11)); g.stroke(); }
  g.restore();
  g.strokeStyle = "#9a8a6a"; g.lineWidth = 4; g.beginPath(); g.arc(X(0), Z(0), 11 * S, 0, 7); g.stroke();
  // the street outside the fence
  g.fillStyle = "#4a4a52"; g.fillRect(0, Z(-HZ - 7), W, 4 * S); g.fillRect(0, Z(HZ + 3), W, 4 * S);
  g.fillRect(X(-HX - 7), 0, 4 * S, H); g.fillRect(X(HX + 3), 0, 4 * S, H);
  g.fillStyle = "#e8d070";
  for (let x = -50; x < 50; x += 3) { g.fillRect(X(x), Z(-HZ - 5.1), 1.4 * S, 0.2 * S); g.fillRect(X(x), Z(HZ + 4.9), 1.4 * S, 0.2 * S); }
  for (let z = -40; z < 40; z += 3) { g.fillRect(X(-HX - 5.1), Z(z), 0.2 * S, 1.4 * S); g.fillRect(X(HX + 4.9), Z(z), 0.2 * S, 1.4 * S); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- build it
export function buildArena(scene) {
  const group = new THREE.Group(); scene.add(group);
  const cols = []; // colliders: {t:"b", x0,x1,z0,z1} or {t:"c", x,z,r}
  const B = new Builder(), GLOW = new Builder();
  const boxCol = (x0, z0, x1, z1, extra = {}) => { const c = { t: "b", x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), ...extra }; cols.push(c); return c; };
  const circCol = (x, z, r, extra = {}) => { const c = { t: "c", x, z, r, ...extra }; cols.push(c); return c; };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 80), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = "ground"; group.add(ground);

  // the picket fence around the square, with four open gates
  const fenceRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    for (let s = 0.25; s < len; s += 0.5) B.add(BOX, 0xf4efe2, x0 + dx * s, 0.62, z0 + dz * s, 0, ry, 0, 0.32, 1.24, 0.1, 0.06); // pickets
    for (let s = 0.25; s < len; s += 0.5) B.add(CONE4, 0xf4efe2, x0 + dx * s, 1.32, z0 + dz * s, 0, ry + Math.PI / 4, 0, 0.2, 0.18, 0.2, 0.06);
    B.add(BOX, 0xd9d2c0, (x0 + x1) / 2, 0.42, (z0 + z1) / 2, 0, ry, 0, len, 0.12, 0.12); B.add(BOX, 0xd9d2c0, (x0 + x1) / 2, 0.98, (z0 + z1) / 2, 0, ry, 0, len, 0.12, 0.12);
    for (let s = 0; s <= len + 0.01; s += 2.5) B.add(BOX, 0xe6dccb, x0 + dx * Math.min(s, len), 0.75, z0 + dz * Math.min(s, len), 0, ry, 0, 0.22, 1.5, 0.22);
    boxCol(x0 - 0.15 * Math.abs(dz) - 0.001, z0 - 0.15 * Math.abs(dx) - 0.001, x1 + 0.15 * Math.abs(dz) + 0.001, z1 + 0.15 * Math.abs(dx) + 0.001, { fence: true });
  };
  fenceRun(-HX, -HZ, -GATE, -HZ); fenceRun(GATE, -HZ, HX, -HZ); fenceRun(-HX, HZ, -GATE, HZ); fenceRun(GATE, HZ, HX, HZ);
  fenceRun(-HX, -HZ, -HX, -GATE); fenceRun(-HX, GATE, -HX, HZ); fenceRun(HX, -HZ, HX, -GATE); fenceRun(HX, GATE, HX, HZ);
  // gate arches (the player can't leave, zombies can come in)
  for (const g of GATES) {
    const along = g.ax, fx = along === "x" ? 0 : Math.sign(g.x) * HX, fz = along === "x" ? Math.sign(g.z) * HZ : 0;
    for (const s of [-1, 1]) {
      const px = along === "x" ? s * (GATE + 0.2) : fx, pz = along === "x" ? fz : s * (GATE + 0.2);
      B.box(0.5, 3.2, 0.5, 0x7a5a3a, px, 1.6, pz); B.box(0.7, 0.3, 0.7, 0x5a3e28, px, 3.3, pz);
    }
    B.box(along === "x" ? GATE * 2 + 1.2 : 0.4, 0.45, along === "x" ? 0.4 : GATE * 2 + 1.2, 0x8a6a42, fx, 3.0, fz);
    B.box(along === "x" ? 2.6 : 0.16, 0.7, along === "x" ? 0.16 : 2.6, 0xcf3a2a, fx, 2.4, fz); // red warning sign
    GLOW.box(along === "x" ? 2.0 : 0.18, 0.12, along === "x" ? 0.18 : 2.0, 0xffe070, fx, 2.4, fz);
    if (along === "x") boxCol(-GATE, fz - 0.3, GATE, fz + 0.3, { playerOnly: true }); else boxCol(fx - 0.3, -GATE, fx + 0.3, GATE, { playerOnly: true });
  }

  // the fountain in the middle
  B.add(CYL, 0xb8ad98, 0, 0.35, 0, 0, 0, 0, 2.4, 0.7, 2.4); B.add(CYL, 0xd8cfb8, 0, 0.72, 0, 0, 0, 0, 2.45, 0.08, 2.45);
  B.add(CYL, 0x9a8f7a, 0, 1.2, 0, 0, 0, 0, 0.35, 1.6, 0.35); B.add(CYL, 0xc8bea8, 0, 2.0, 0, 0, 0, 0, 1.0, 0.25, 1.0); B.add(ICO, 0x9a8f7a, 0, 2.35, 0, 0, 0, 0, 0.35, 0.35, 0.35);
  GLOW.add(CYL, 0x3fb8e8, 0, 0.71, 0, 0, 0, 0, 2.1, 0.04, 2.1); GLOW.add(CYL, 0x6fd8ff, 0, 2.13, 0, 0, 0, 0, 0.85, 0.03, 0.85);
  circCol(0, 0, 2.45);

  const crate = (x, z, s = 1.1, y = 0) => {
    B.box(s, s, s, 0xc8914a, x, y + s / 2, z, 0, 0.1);
    B.box(s * 1.02, s * 0.14, s * 1.02, 0x8a5a2a, x, y + s * 0.15, z); B.box(s * 1.02, s * 0.14, s * 1.02, 0x8a5a2a, x, y + s * 0.85, z);
    B.add(BOX, 0x8a5a2a, x, y + s / 2, z + s * 0.51, 0, 0, Math.PI / 4, s * 1.25, s * 0.12, 0.04);
    B.add(BOX, 0x8a5a2a, x, y + s / 2, z - s * 0.51, 0, 0, Math.PI / 4, s * 1.25, s * 0.12, 0.04);
    if (y === 0) boxCol(x - s / 2, z - s / 2, x + s / 2, z + s / 2);
  };
  const car = (x, z, alongZ, color) => {
    const L = 4.4, Wd = 2.1, ry = alongZ ? Math.PI / 2 : 0;
    const P = (lx, lz) => alongZ ? [x - lz, z + lx] : [x + lx, z + lz];
    let p = P(0, 0); B.box(L, 0.8, Wd, color, p[0], 0.75, p[1], ry); // body
    p = P(-0.3, 0); B.box(2.3, 0.7, Wd * 0.88, color, p[0], 1.5, p[1], ry); // cabin
    p = P(-0.3, 0); B.box(2.32, 0.5, Wd * 0.9, 0x2a3a5a, p[0], 1.5, p[1], ry, 0.01); // windows
    p = P(-0.3, 0); B.box(2.0, 0.08, Wd * 0.8, color, p[0], 1.88, p[1], ry);
    for (const [wx, wz] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) { p = P(wx, wz); B.add(CYL, 0x222226, p[0], 0.42, p[1], Math.PI / 2, ry, 0, 0.42, 0.3, 0.42); B.add(CYL, 0xc0c0c8, p[0], 0.42, p[1], Math.PI / 2, ry, 0, 0.2, 0.32, 0.2); }
    for (const s of [-0.7, 0.7]) { p = P(2.2, s); GLOW.box(0.08, 0.2, 0.35, 0xfff2b0, p[0], 0.85, p[1], ry); p = P(-2.2, s); GLOW.box(0.08, 0.2, 0.35, 0xff4040, p[0], 0.85, p[1], ry); }
    if (alongZ) boxCol(x - Wd / 2, z - L / 2, x + Wd / 2, z + L / 2); else boxCol(x - L / 2, z - Wd / 2, x + L / 2, z + Wd / 2);
  };
  const tree = (x, z, s = 1) => {
    B.add(CYL6, 0x7a5232, x, 1.1 * s, z, 0, 0, 0, 0.32 * s, 2.2 * s, 0.32 * s);
    B.add(ICO, 0x3f9a3a, x, 2.9 * s, z, 0, Math.random() * 3, 0, 1.7 * s, 1.5 * s, 1.7 * s, 0.1);
    B.add(ICO, 0x52b046, x + 0.4 * s, 3.9 * s, z - 0.2 * s, 0, Math.random() * 3, 0, 1.2 * s, 1.1 * s, 1.2 * s, 0.1);
    B.add(ICO, 0x48a640, x - 0.6 * s, 3.4 * s, z + 0.4 * s, 0, Math.random() * 3, 0, 0.9 * s, 0.9 * s, 0.9 * s, 0.1);
    circCol(x, z, 0.55 * s);
  };
  const lamps = [];
  const lamp = (x, z) => {
    B.add(CYL6, 0x2e3440, x, 2.0, z, 0, 0, 0, 0.12, 4.0, 0.12); B.add(CYL6, 0x2e3440, x, 0.15, z, 0, 0, 0, 0.3, 0.3, 0.3);
    B.box(0.55, 0.12, 0.55, 0x2e3440, x, 4.35, z); GLOW.add(ICO, 0xfff0b0, x, 4.1, z, 0, 0, 0, 0.3, 0.3, 0.3);
    const L = new THREE.PointLight(0xffd08a, 0, 16, 1.4); L.position.set(x, 3.9, z); group.add(L); lamps.push(L);
    circCol(x, z, 0.25);
  };
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    for (let s = 0.2; s < len; s += 0.4) B.add(BOX, 0xa86a3a, x0 + dx * s, 0.55, z0 + dz * s, 0, ry, 0, 0.3, 1.1, 0.08, 0.1);
    B.add(BOX, 0x8a5430, (x0 + x1) / 2, 0.75, (z0 + z1) / 2, 0, ry, 0, len, 0.12, 0.1);
    boxCol(x0 - 0.15 * Math.abs(dz) - 0.001, z0 - 0.15 * Math.abs(dx) - 0.001, x1 + 0.15 * Math.abs(dz) + 0.001, z1 + 0.15 * Math.abs(dx) + 0.001);
  };
  const bench = (x, z, alongZ) => {
    const w = alongZ ? 0.6 : 1.8, d = alongZ ? 1.8 : 0.6;
    B.box(w, 0.1, d, 0xb0703a, x, 0.5, z); B.box(alongZ ? 0.1 : 1.8, 0.45, alongZ ? 1.8 : 0.1, 0xb0703a, x + (alongZ ? (x > 0 ? 0.3 : -0.3) : 0), 0.8, z + (alongZ ? 0 : (z > 0 ? 0.3 : -0.3)));
    B.box(w * 0.9, 0.45, d * 0.9, 0x3a3a40, x, 0.23, z);
    boxCol(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  };

  car(-15, -9, false, 0xe0463a); car(16, 10, true, 0x3a7ae0); car(13, -13, false, 0xf2c23a); car(-19, 12, true, 0x2fb8a8);
  crate(-6, -12); crate(-4.9, -12.3); crate(-5.5, -12.1, 0.9, 1.1);
  crate(7, 8.5); crate(8.15, 8.5); crate(7.55, 9.65); crate(7.6, 8.5, 0.9, 1.1);
  crate(22, -4); crate(-22, 4); crate(-23.1, 5.1); crate(20, -17); crate(-10, 17); crate(3.5, -17.5); crate(4.6, -17.5);
  crate(24, 6); crate(-13, -2.5);
  tree(-26, -17); tree(26, -17.5); tree(26, 17); tree(-12, -18.5, 0.9); tree(14, 18.5, 0.9); tree(-26, 7); tree(-6.5, 18.5, 0.8); tree(22, 1 + 6, 0.85); tree(-21, -4, 0.85);
  lamp(-7, -7); lamp(7, 7); lamp(-7, 7); lamp(7, -7);
  fence(-17, 1, -17, 6.5); fence(17, -6.5, 17, -1); fence(-9.5, 14.5, -4, 14.5); fence(5.5, -14.5, 11, -14.5);
  bench(-4.3, 0, true); bench(4.3, 0, true);
  // bushes (just pretty, they don't block)
  for (const [x, z] of [[-28, -20], [28, 20], [-28, 20], [28, -20], [-14, 20.5], [11, -20.5], [-27.5, -10], [27.5, 12]]) B.add(ICO, 0x3a8a34, x, 0.5, z, 0, Math.random() * 3, 0, 1.0, 0.8, 1.0, 0.12);

  // houses around the square (scenery outside the fence)
  const house = (x, z, ry, color, roof) => {
    B.box(8, 5, 6, color, x, 2.5, z, ry); B.add(CONE4, roof, x, 6.3, z, 0, ry + Math.PI / 4, 0, 6.2, 2.8, 5.2);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [lx, ly] of [[-2.2, 1.6], [2.2, 1.6], [-2.2, 3.6], [2.2, 3.6]]) GLOW.box(1.3, 1.1, 0.1, 0xffd27a, x + c * lx + s * 3.02, ly + 0.2, z - s * lx + c * 3.02, ry);
    B.box(1.2, 2.2, 0.12, 0x6a3a22, x + s * 3.03, 1.1, z + c * 3.03, ry);
  };
  const HC = [[0xe8a0a0, 0x8a3a3a], [0xa0c8e8, 0x3a4a7a], [0xf0e0a0, 0x7a5a2a], [0xb8e0a8, 0x3a6a3a], [0xd8b8f0, 0x5a3a7a]];
  let hi = 0;
  for (const x of [-38, -26, -14, 14, 26, 38]) { const h = HC[hi++ % 5]; house(x, -HZ - 13, 0, h[0], h[1]); const h2 = HC[hi++ % 5]; house(x, HZ + 13, Math.PI, h2[0], h2[1]); }
  for (const z of [-12, 12]) { const h = HC[hi++ % 5]; house(-HX - 13, z, Math.PI / 2, h[0], h[1]); const h2 = HC[hi++ % 5]; house(HX + 13, z, -Math.PI / 2, h2[0], h2[1]); }

  const scenery = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scenery.name = "scenery"; scenery.castShadow = true; scenery.receiveShadow = true; group.add(scenery);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const glow = GLOW.mesh(glowMat); glow.name = "glow"; group.add(glow);

  // lights + sky
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a7a3a, 1.6); group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sun.position.set(-18, 30, 14); sun.target.position.set(0, 0, 0); group.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 36, bottom: -36, near: 5, far: 90 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  sun.shadow.camera.updateProjectionMatrix();
  scene.fog = new THREE.Fog(0x9fd8ff, 45, 110);
  scene.background = new THREE.Color(0x9fd8ff);

  // day (0) to dusk (1)
  const SKY = [new THREE.Color(0x9fd8ff), new THREE.Color(0xf0a070), new THREE.Color(0x3a2a6a)];
  const sunC = [new THREE.Color(0xfff2d8), new THREE.Color(0xffa060), new THREE.Color(0xc080ff)];
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const mix3 = (arr, t, out) => t < 0.5 ? out.copy(arr[0]).lerp(arr[1], t * 2) : out.copy(arr[1]).lerp(arr[2], (t - 0.5) * 2);
  function setMood(t) {
    t = Math.max(0, Math.min(1, t));
    mix3(SKY, t, tmp); scene.background.copy(tmp); scene.fog.color.copy(tmp);
    mix3(sunC, t, tmp2); sun.color.copy(tmp2); sun.intensity = 2.7 - t * 1.6;
    hemi.color.setHex(0xcfe8ff).lerp(tmp.setHex(0x8a70c0), t); hemi.groundColor.setHex(0x5a7a3a).lerp(tmp.setHex(0x2a2a40), t); hemi.intensity = 1.6 - t * 0.6;
    sun.position.set(-18 - t * 10, 30 - t * 16, 14);
    const lampOn = Math.max(0, (t - 0.25) / 0.75);
    for (const L of lamps) L.intensity = lampOn * 40;
    glowMat.color.setScalar(0.75 + lampOn * 0.35);
  }
  setMood(0);
  return { group, cols, lamps, sun, hemi, setMood };
}

// ---------------------------------------------------------------- collision helpers (everything is flat 2D on the ground)
// Push a circle (p.x, p.z, radius r) out of the colliders. Returns the last collider it hit that has hp (a barricade).
export function pushOut(p, r, cols, isPlayer) {
  let hitHp = null;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c.dead || (c.playerOnly && !isPlayer)) continue;
    if (c.t === "b") {
      if (p.x < c.x0 - r || p.x > c.x1 + r || p.z < c.z0 - r || p.z > c.z1 + r) continue;
      const cx = p.x < c.x0 ? c.x0 : p.x > c.x1 ? c.x1 : p.x, cz = p.z < c.z0 ? c.z0 : p.z > c.z1 ? c.z1 : p.z;
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else {
        const a = p.x - c.x0, b = c.x1 - p.x, e = p.z - c.z0, f = c.z1 - p.z, m = Math.min(a, b, e, f);
        if (m === a) p.x = c.x0 - r; else if (m === b) p.x = c.x1 + r; else if (m === e) p.z = c.z0 - r; else p.z = c.z1 + r;
      }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z, m = r + c.r, d2 = dx * dx + dz * dz;
      if (d2 >= m * m) continue;
      const d = Math.sqrt(d2) || 1e-4; p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m;
    }
    if (c.hp !== undefined) hitHp = c;
  }
  return hitHp;
}
// Does a circle overlap anything? (for placing barricades/turrets)
export function overlaps(x, z, r, cols) {
  for (const c of cols) {
    if (c.dead) continue;
    if (c.t === "b") { const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1)); if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; }
    else if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return true;
  }
  return false;
}
// First thing a shot from (x0,z0) to (x1,z1) hits: returns t in 0..1 (1 = nothing). Low things (barricades) and gates let shots through.
export function rayHit(x0, z0, x1, z1, cols) {
  const dx = x1 - x0, dz = z1 - z0; let best = 1;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c.dead || c.playerOnly || c.low) continue;
    if (c.t === "b") {
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (x0 < c.x0 || x0 > c.x1) continue; } else { let a = (c.x0 - x0) / dx, b = (c.x1 - x0) / dx; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (z0 < c.z0 || z0 > c.z1) continue; } else { let a = (c.z0 - z0) / dz, b = (c.z1 - z0) / dz; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) continue; }
      if (t0 < best) best = t0;
    } else {
      const fx = x0 - c.x, fz = z0 - c.z, A = dx * dx + dz * dz, Bq = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - c.r * c.r;
      if (C < 0) { best = 0; continue; }
      const disc = Bq * Bq - 4 * A * C; if (disc < 0 || A < 1e-12) continue;
      const t = (-Bq - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t < best) best = t;
    }
  }
  return best;
}

// ---------------------------------------------------------------- path-finding: a "flow field" from the player, shared by every zombie
export class Nav {
  constructor() {
    this.C = 1; this.OX = -37; this.OZ = -29; this.NX = 74; this.NZ = 58;
    const n = this.NX * this.NZ;
    this.cost = new Uint8Array(n); this.dist = new Float32Array(n);
    this.hk = new Float32Array(n * 8); this.hv = new Int32Array(n * 8); this.hn = 0;
    this.target = -1;
  }
  cell(x, z) { const i = Math.floor((x - this.OX) / this.C), j = Math.floor((z - this.OZ) / this.C); if (i < 0 || j < 0 || i >= this.NX || j >= this.NZ) return -1; return j * this.NX + i; }
  rebuild(cols) {
    const { NX, NZ, OX, OZ, C } = this;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = OX + (i + 0.5) * C, z = OZ + (j + 0.5) * C; let k = 1;
      for (const c of cols) {
        if (c.dead || c.playerOnly) continue;
        const pad = 0.45;
        let inside;
        if (c.t === "b") inside = x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad;
        else inside = (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2;
        if (inside) { if (c.hp !== undefined) k = Math.max(k, 12); else { k = 0; break; } }
        if (c.turret && inside) { k = 0; break; }
      }
      this.cost[j * NX + i] = k;
    }
    this.target = -1;
  }
  push(k, v) { // binary heap
    let i = this.hn++; const hk = this.hk, hv = this.hv;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
    hk[i] = k; hv[i] = v;
  }
  pop() {
    const hk = this.hk, hv = this.hv, top = hv[0]; this._k = hk[0];
    const n = --this.hn, k = hk[n], v = hv[n]; let i = 0;
    while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; }
    hk[i] = k; hv[i] = v; return top;
  }
  compute(px, pz, force) {
    const t = this.cell(px, pz); if (t < 0 || (t === this.target && !force)) return;
    this.target = t;
    const { NX, NZ, cost, dist } = this; dist.fill(1e9); dist[t] = 0; this.hn = 0; this.push(0, t);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (this.hn > 0) {
      const u = this.pop(), du = this._k; if (du > dist[u]) continue;
      const ui = u % NX, uj = (u / NX) | 0;
      for (let d = 0; d < 8; d++) {
        const ni = ui + D[d][0], nj = uj + D[d][1]; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const v = nj * NX + ni, c = cost[v]; if (!c) continue;
        if (d >= 4 && (!cost[uj * NX + ni] || !cost[nj * NX + ui])) continue; // no cutting corners
        const nd = du + D[d][2] * c; if (nd < dist[v]) { dist[v] = nd; this.push(nd, v); }
      }
    }
  }
  // Which way should a zombie at (x,z) walk? Writes a unit vector into out, or returns false (then walk straight at the player).
  dir(x, z, out) {
    const { NX, NZ, OX, OZ, C, cost, dist } = this;
    const i = Math.floor((x - OX) / C), j = Math.floor((z - OZ) / C);
    if (i < 0 || j < 0 || i >= NX || j >= NZ) return false;
    const here = j * NX + i; let best = dist[here], bi = -1, bj = -1;
    if (best >= 1e9) { best = 1e9; }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      if (di && dj && (!cost[j * NX + ni] || !cost[nj * NX + i])) continue;
      const v = dist[nj * NX + ni]; if (v < best) { best = v; bi = ni; bj = nj; }
    }
    if (bi < 0) return false;
    const tx = OX + (bi + 0.5) * C - x, tz = OZ + (bj + 0.5) * C - z, l = Math.hypot(tx, tz) || 1;
    out.x = tx / l; out.z = tz / l; return true;
  }
}
