// FREE ASSETS for GunnerVerse Studio. Every asset is built in code from simple shapes (nothing to download, nothing to
// license). Each one is modeled at its `base` size with its bottom at y = 0 and centered on x / z; the editor scales it
// to the object's `size`. `colliders(size)` lists the solid boxes (in real size, around the object's origin) when they
// aren't just the whole box: a house has walls with a doorway, a ramp has a slope, a tree only its trunk.
//   box: {c: [x, y, z] center, h: [x, y, z] half size, rx: tilt around X (radians, for slopes)}
// `b` is the behavior a new copy starts with (see BEHAVIORS), `solid: false` = players walk through it.
import * as THREE from "../vendor/three.module.js";

// ---------------------------------------------------------------- materials
const matCache = new Map();
export function material(color, kind) {
  const key = color + "|" + (kind || "plastic");
  let m = matCache.get(key);
  if (m) return m;
  const c = new THREE.Color(color);
  if (kind === "neon") m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.4 });
  else if (kind === "metal") m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: 0.3 });
  else if (kind === "smooth") m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.22 });
  else if (kind === "glass") m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.08, transparent: true, opacity: 0.45, depthWrite: false });
  else if (kind === "grass") m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, map: gridTexture() });
  else m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  matCache.set(key, m);
  return m;
}
export const MATERIALS = [["plastic", "Plastic"], ["smooth", "Smooth"], ["metal", "Metal"], ["neon", "Neon (glows)"], ["glass", "Glass"], ["grass", "Grid"]];

let gridTex = null;
function gridTexture() { // the faint studio grid on baseplates (tiles every 4 studs)
  if (gridTex) return gridTex;
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(0,0,0,0.13)"; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64);
  gridTex = new THREE.CanvasTexture(cv);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.colorSpace = THREE.SRGBColorSpace;
  gridTex.anisotropy = 4;
  return gridTex;
}
// Grid-textured parts need their own texture repeat (it depends on the part's size).
export function gridMaterialFor(color, size) {
  const m = material(color, "grass").clone();
  m.map = gridTexture().clone(); m.map.needsUpdate = true;
  m.map.repeat.set(Math.max(1, size[0] / 4), Math.max(1, size[2] / 4));
  return m;
}

// ---------------------------------------------------------------- shape helpers (all add to group g)
function mesh(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}
const box = (g, w, h, d, mat, x, y, z) => mesh(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (g, rt, rb, h, mat, x, y, z, seg) => mesh(g, new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat, x, y, z);
const ball = (g, r, mat, x, y, z) => mesh(g, new THREE.SphereGeometry(r, 24, 16), mat, x, y, z);
const M = (c, k) => material(c, k);
function wheel(g, x, y, z, r, w) {
  const t = cyl(g, r, r, w, M("#1b1d20"), x, y, z, 18); t.rotation.z = Math.PI / 2;
  const h = cyl(g, r * 0.55, r * 0.55, w + 0.04, M("#c9ced6", "metal"), x, y, z, 14); h.rotation.z = Math.PI / 2;
}
function wedgeGeo(w, h, d) { // ramp: low at +z, high at -z
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(-d / 2, h); s.lineTo(-d / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.rotateY(Math.PI / 2); geo.translate(-w / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}
function textTexture(text, bg, fg) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
  const g = cv.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  const words = String(text || "").slice(0, 60).split(/\s+/); const lines = []; let line = "";
  let size = 64;
  g.font = "bold " + size + "px Arial Black, Arial, sans-serif";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > 470 && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  if (lines.length > 3) { size = 44; g.font = "bold " + size + "px Arial Black, Arial, sans-serif"; }
  lines.slice(0, 4).forEach((l, i) => g.fillText(l, 256, 128 + (i - (Math.min(lines.length, 4) - 1) / 2) * size * 1.1));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The ramp's walkable slope + its back wall, for the real size s.
function rampColliders(s) {
  const [sx, sy, sz] = s, t = 0.5, a = Math.atan2(sy, sz), L = Math.hypot(sy, sz);
  const n = [0, Math.cos(a), Math.sin(a)];
  return [
    { c: [0, sy / 2 - n[1] * t / 2, -n[2] * t / 2], h: [sx / 2, t / 2, L / 2], rx: a },
    { c: [0, sy / 2, -sz / 2 + 0.25], h: [sx / 2, sy / 2, 0.25] },
  ];
}

// ---------------------------------------------------------------- the library
export const CATEGORIES = ["All", "Parts", "Vehicles", "Nature", "Buildings", "Gameplay", "Decor"];

export const ASSETS = [
  // ----- parts (plain shapes kids color and size themselves)
  { type: "block", label: "Block", icon: "⬛", cat: "Parts", base: [4, 1, 4], color: "#a3a8b0",
    build: (o) => { const g = new THREE.Group(); box(g, 4, 1, 4, M(o.color, o.mat), 0, 0.5, 0); return g; } },
  { type: "ball", label: "Ball", icon: "⚪", cat: "Parts", base: [3, 3, 3], color: "#e8483a",
    build: (o) => { const g = new THREE.Group(); ball(g, 1.5, M(o.color, o.mat), 0, 1.5, 0); return g; } },
  { type: "cylinder", label: "Cylinder", icon: "🛢️", cat: "Parts", base: [3, 3, 3], color: "#2f7df6",
    build: (o) => { const g = new THREE.Group(); cyl(g, 1.5, 1.5, 3, M(o.color, o.mat), 0, 1.5, 0, 28); return g; } },
  { type: "wedge", label: "Ramp", icon: "📐", cat: "Parts", base: [4, 2, 4], color: "#ffb52e",
    build: (o) => { const g = new THREE.Group(); mesh(g, wedgeGeo(4, 2, 4), M(o.color, o.mat)); return g; },
    colliders: rampColliders },
  { type: "plate", label: "Platform", icon: "▭", cat: "Parts", base: [10, 1, 10], color: "#1fae45",
    build: (o) => { const g = new THREE.Group(); box(g, 10, 1, 10, M(o.color, o.mat), 0, 0.5, 0); return g; } },

  // ----- vehicles (drive with E in Play)
  { type: "car", label: "Sports Car", icon: "🏎️", cat: "Vehicles", base: [4.4, 2, 8], color: "#e8261c", b: { k: "car", speed: 40 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth");
      box(g, 4.2, 0.9, 7.6, paint, 0, 0.85, 0);
      box(g, 3.6, 0.8, 3.6, paint, 0, 1.6, -0.4);
      box(g, 3.4, 0.62, 3.3, M("#9fd3ff", "glass"), 0, 1.62, -0.4);
      box(g, 3.9, 0.12, 0.5, M("#111"), 0, 1.45, 3.55);          // spoiler
      box(g, 0.9, 0.3, 0.1, M("#fff6c4", "neon"), -1.4, 0.95, -3.81);
      box(g, 0.9, 0.3, 0.1, M("#fff6c4", "neon"), 1.4, 0.95, -3.81);
      box(g, 0.9, 0.25, 0.1, M("#ff2a2a", "neon"), -1.4, 0.95, 3.81);
      box(g, 0.9, 0.25, 0.1, M("#ff2a2a", "neon"), 1.4, 0.95, 3.81);
      for (const [x, z] of [[-2, -2.6], [2, -2.6], [-2, 2.5], [2, 2.5]]) wheel(g, x, 0.6, z, 0.6, 0.5);
      return g;
    } },
  { type: "truck", label: "Monster Truck", icon: "🛻", cat: "Vehicles", base: [5, 3.4, 9], color: "#1f8f3a", b: { k: "car", speed: 32 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth");
      box(g, 4.2, 1.1, 8.4, paint, 0, 1.95, 0);
      box(g, 3.8, 1.2, 3, paint, 0, 3.0, -1.6);
      box(g, 3.6, 0.9, 2.8, M("#9fd3ff", "glass"), 0, 3.05, -1.6);
      box(g, 3.2, 0.2, 3.6, M("#222"), 0, 2.6, 2.2);
      for (const [x, z] of [[-2.1, -2.8], [2.1, -2.8], [-2.1, 2.8], [2.1, 2.8]]) wheel(g, x, 1.15, z, 1.15, 0.9);
      box(g, 0.8, 0.3, 0.1, M("#fff6c4", "neon"), -1.4, 2.1, -4.21);
      box(g, 0.8, 0.3, 0.1, M("#fff6c4", "neon"), 1.4, 2.1, -4.21);
      return g;
    } },
  { type: "kart", label: "Go-Kart", icon: "🛞", cat: "Vehicles", base: [3, 1.4, 4.4], color: "#ffc531", b: { k: "car", speed: 46 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth");
      box(g, 2.2, 0.35, 4.2, paint, 0, 0.45, 0);
      box(g, 1.2, 0.8, 1.2, M("#222"), 0, 0.9, 0.6);           // seat
      cyl(g, 0.35, 0.35, 0.1, M("#222"), 0, 1.15, -0.5, 16).rotation.x = -1.1; // wheel
      box(g, 2.6, 0.2, 0.4, paint, 0, 0.5, -2.05);
      for (const [x, z] of [[-1.3, -1.4], [1.3, -1.4], [-1.3, 1.5], [1.3, 1.5]]) wheel(g, x, 0.42, z, 0.42, 0.45);
      return g;
    } },

  // ----- nature
  { type: "tree", label: "Tree", icon: "🌳", cat: "Nature", base: [6, 9, 6], color: "#2f9e44",
    build: (o) => {
      const g = new THREE.Group(), leaf = M(o.color, o.mat);
      cyl(g, 0.45, 0.6, 4, M("#7a4b2a"), 0, 2, 0, 10);
      ball(g, 2.6, leaf, 0, 5.6, 0); ball(g, 1.9, leaf, 1.4, 6.4, 0.6); ball(g, 1.8, leaf, -1.3, 6.2, -0.7); ball(g, 1.6, leaf, 0.2, 7.3, -0.3);
      return g;
    },
    colliders: (s) => [{ c: [0, s[1] * 0.25, 0], h: [s[0] * 0.09, s[1] * 0.25, s[2] * 0.09] }] },
  { type: "pine", label: "Pine Tree", icon: "🌲", cat: "Nature", base: [4.4, 10, 4.4], color: "#1d6b3a",
    build: (o) => {
      const g = new THREE.Group(), leaf = M(o.color, o.mat);
      cyl(g, 0.35, 0.45, 2.5, M("#6b4226"), 0, 1.25, 0, 10);
      cyl(g, 0, 2.2, 3.6, leaf, 0, 3.6, 0, 14); cyl(g, 0, 1.8, 3.2, leaf, 0, 5.6, 0, 14); cyl(g, 0, 1.3, 2.8, leaf, 0, 7.6, 0, 14);
      return g;
    },
    colliders: (s) => [{ c: [0, s[1] * 0.2, 0], h: [s[0] * 0.09, s[1] * 0.2, s[2] * 0.09] }] },
  { type: "rock", label: "Rock", icon: "🪨", cat: "Nature", base: [4, 2.6, 3.4], color: "#8a8f96",
    build: (o) => {
      const g = new THREE.Group();
      const geo = new THREE.DodecahedronGeometry(1.7, 0); geo.scale(1.15, 0.8, 1);
      mesh(g, geo, M(o.color, o.mat), 0, 1.3, 0).rotation.y = 0.6;
      return g;
    } },
  { type: "bush", label: "Bush", icon: "🌿", cat: "Nature", base: [3, 2, 3], color: "#38a84a", solid: false,
    build: (o) => { const g = new THREE.Group(), m = M(o.color, o.mat); ball(g, 1.1, m, -0.5, 1, 0); ball(g, 1.1, m, 0.6, 0.9, 0.3); ball(g, 0.9, m, 0, 1.3, -0.4); return g; } },
  { type: "flowers", label: "Flowers", icon: "🌷", cat: "Nature", base: [3, 0.8, 3], color: "#ff5fa2", solid: false,
    build: (o) => {
      const g = new THREE.Group();
      box(g, 3, 0.15, 3, M("#2f8f3a"), 0, 0.07, 0);
      const cols = [o.color, "#ffd23f", "#ffffff", "#a64bf4"];
      for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 0.9 + (i * 0.37 % 0.3), z = (Math.floor(i / 3) - 1) * 0.9; cyl(g, 0.04, 0.04, 0.5, M("#2f8f3a"), x, 0.35, z, 5); ball(g, 0.16, M(cols[i % 4]), x, 0.65, z); }
      return g;
    } },
  { type: "water", label: "Water", icon: "🌊", cat: "Nature", base: [12, 0.6, 12], color: "#2a8fff", solid: false, mat: "glass",
    build: (o) => { const g = new THREE.Group(); box(g, 12, 0.6, 12, M(o.color, o.mat || "glass"), 0, 0.3, 0).castShadow = false; return g; } },

  // ----- buildings
  { type: "house", label: "House", icon: "🏠", cat: "Buildings", base: [14, 10, 12], color: "#f2e3c6",
    build: (o) => {
      const g = new THREE.Group(), wall = M(o.color, o.mat), roof = M("#b8402e"), trim = M("#5b3a22");
      box(g, 14, 0.3, 12, M("#8a6a4a"), 0, 0.15, 0);                       // floor
      box(g, 14, 6, 0.5, wall, 0, 3, -5.75);                                 // back
      box(g, 0.5, 6, 12, wall, -6.75, 3, 0); box(g, 0.5, 6, 12, wall, 6.75, 3, 0); // sides
      box(g, 5.5, 6, 0.5, wall, -4.25, 3, 5.75); box(g, 5.5, 6, 0.5, wall, 4.25, 3, 5.75); // front, with a doorway
      box(g, 3, 1.6, 0.5, wall, 0, 5.2, 5.75);
      box(g, 3.2, 0.2, 0.6, trim, 0, 4.4, 5.75);
      for (const x of [-4.2, 4.2]) { box(g, 2, 1.6, 0.56, M("#9fd3ff", "glass"), x, 3.4, 5.75); box(g, 2.2, 0.15, 0.7, trim, x, 2.55, 5.8); }
      const r = new THREE.CylinderGeometry(0.01, 9.6, 4, 4, 1); r.rotateY(Math.PI / 4); r.scale(1, 1, 0.86);
      mesh(g, r, roof, 0, 8, 0);
      box(g, 1, 2.4, 1, M("#7a7a7a"), 4, 8.6, -2);                          // chimney
      return g;
    },
    colliders: (s) => {
      const k = [s[0] / 14, s[1] / 10, s[2] / 12];
      const B = (cx, cy, cz, hx, hy, hz) => ({ c: [cx * k[0], cy * k[1], cz * k[2]], h: [hx * k[0], hy * k[1], hz * k[2]] });
      return [B(0, 0.15, 0, 7, 0.15, 6), B(0, 3, -5.75, 7, 3, 0.25), B(-6.75, 3, 0, 0.25, 3, 6), B(6.75, 3, 0, 0.25, 3, 6),
        B(-4.25, 3, 5.75, 2.75, 3, 0.25), B(4.25, 3, 5.75, 2.75, 3, 0.25), B(0, 5.2, 5.75, 1.5, 0.8, 0.25), B(0, 6.2, 0, 7, 0.2, 6)];
    } },
  { type: "wall", label: "Wall", icon: "🧱", cat: "Buildings", base: [8, 6, 1], color: "#b5654a",
    build: (o) => { const g = new THREE.Group(); box(g, 8, 6, 1, M(o.color, o.mat), 0, 3, 0); box(g, 8.2, 0.3, 1.2, M("#d9d2c5"), 0, 6.05, 0); return g; } },
  { type: "fence", label: "Fence", icon: "🚧", cat: "Buildings", base: [8, 2, 0.4], color: "#f4f1ea",
    build: (o) => {
      const g = new THREE.Group(), m = M(o.color, o.mat);
      for (let i = 0; i < 5; i++) box(g, 0.3, 2, 0.3, m, -3.8 + i * 1.9, 1, 0);
      box(g, 8, 0.25, 0.2, m, 0, 1.5, 0); box(g, 8, 0.25, 0.2, m, 0, 0.7, 0);
      return g;
    } },
  { type: "stairs", label: "Stairs", icon: "🪜", cat: "Buildings", base: [4, 4, 8], color: "#a3a8b0",
    build: (o) => { const g = new THREE.Group(), m = M(o.color, o.mat); for (let i = 0; i < 8; i++) box(g, 4, 0.5 * (i + 1), 1, m, 0, 0.25 * (i + 1), 3.5 - i); return g; },
    colliders: (s) => { const out = [], st = s[2] / 8, hy = s[1] / 8; for (let i = 0; i < 8; i++) out.push({ c: [0, hy * (i + 1) / 2, s[2] / 2 - st * (i + 0.5)], h: [s[0] / 2, hy * (i + 1) / 2, st / 2] }); return out; } },
  { type: "bridge", label: "Bridge", icon: "🌉", cat: "Buildings", base: [6, 2.2, 16], color: "#8b5a2b",
    build: (o) => {
      const g = new THREE.Group(), m = M(o.color, o.mat);
      box(g, 6, 0.6, 16, m, 0, 0.3, 0);
      for (const x of [-2.85, 2.85]) { box(g, 0.3, 0.2, 16, m, x, 2.1, 0); for (let i = 0; i < 6; i++) box(g, 0.3, 1.6, 0.3, m, x, 1.4, -7.5 + i * 3); }
      return g;
    },
    colliders: (s) => [{ c: [0, s[1] * 0.14, 0], h: [s[0] / 2, s[1] * 0.14, s[2] / 2] }, { c: [-s[0] * 0.475, s[1] * 0.6, 0], h: [0.15, s[1] * 0.4, s[2] / 2] }, { c: [s[0] * 0.475, s[1] * 0.6, 0], h: [0.15, s[1] * 0.4, s[2] / 2] }] },
  { type: "tower", label: "Tower", icon: "🗼", cat: "Buildings", base: [6, 18, 6], color: "#6b7280",
    build: (o) => {
      const g = new THREE.Group(), m = M(o.color, o.mat);
      for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) box(g, 0.6, 16, 0.6, m, x, 8, z);
      for (const y of [4, 8, 12]) { box(g, 6, 0.3, 0.3, m, 0, y, -2.6); box(g, 6, 0.3, 0.3, m, 0, y, 2.6); }
      box(g, 6.4, 0.6, 6.4, M("#8b5a2b"), 0, 16.3, 0);
      box(g, 6.4, 1.2, 0.2, m, 0, 17.2, -3.1); box(g, 6.4, 1.2, 0.2, m, 0, 17.2, 3.1); box(g, 0.2, 1.2, 6.4, m, -3.1, 17.2, 0);
      return g;
    },
    colliders: (s) => { const k = s[1] / 18; return [{ c: [0, 16.3 * k, 0], h: [s[0] / 2, 0.3 * k, s[2] / 2] }, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ c: [a * s[0] * 0.43, 8 * k, b * s[2] * 0.43], h: [0.3, 8 * k, 0.3] }))]; } },

  // ----- gameplay
  { type: "spawn", label: "Spawn Point", icon: "🚩", cat: "Gameplay", base: [5, 0.6, 5], color: "#1fae45", b: { k: "spawn" },
    build: (o) => {
      const g = new THREE.Group();
      box(g, 5, 0.6, 5, M("#2b2f36"), 0, 0.3, 0);
      box(g, 4, 0.08, 4, M(o.color, "neon"), 0, 0.64, 0);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: textTexture("SPAWN", "#00000000", "#ffffff"), transparent: true }));
      t.rotation.x = -Math.PI / 2; t.position.y = 0.7; g.add(t);
      return g;
    } },
  { type: "coin", label: "Coin", icon: "🪙", cat: "Gameplay", base: [2, 2, 0.4], color: "#ffc531", solid: false, b: { k: "coin", points: 1 },
    build: (o) => { const g = new THREE.Group(); const c = cyl(g, 1, 1, 0.3, M(o.color, "metal"), 0, 1, 0, 28); c.rotation.x = Math.PI / 2; const s = cyl(g, 0.55, 0.55, 0.34, M("#ffe27a", "neon"), 0, 1, 0, 5); s.rotation.x = Math.PI / 2; return g; } },
  { type: "checkpoint", label: "Checkpoint", icon: "🏁", cat: "Gameplay", base: [5, 0.5, 5], color: "#2f7df6", b: { k: "checkpoint" },
    build: (o) => { const g = new THREE.Group(); box(g, 5, 0.5, 5, M("#2b2f36"), 0, 0.25, 0); box(g, 4.2, 0.06, 4.2, M(o.color, "neon"), 0, 0.53, 0); cyl(g, 0.12, 0.12, 4, M("#ddd", "metal"), 2.2, 2.5, -2.2, 8); box(g, 1.6, 1, 0.08, M(o.color, "neon"), 1.4, 4, -2.2); return g; } },
  { type: "finish", label: "Finish Line", icon: "🏆", cat: "Gameplay", base: [10, 7, 1.5], color: "#ffc531", b: { k: "finish" }, solid: false,
    build: (o) => {
      const g = new THREE.Group(), m = M(o.color, "metal");
      cyl(g, 0.35, 0.35, 7, m, -4.6, 3.5, 0, 12); cyl(g, 0.35, 0.35, 7, m, 4.6, 3.5, 0, 12);
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 32; const c = cv.getContext("2d");
      for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? "#111" : "#fff"; c.fillRect(i * 8, j * 8, 8, 8); }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      mesh(g, new THREE.BoxGeometry(9.2, 1.4, 0.3), new THREE.MeshStandardMaterial({ map: tx }), 0, 6.3, 0);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: textTexture("FINISH", "#00000000", "#ffc531"), transparent: true, side: THREE.DoubleSide }));
      t.position.set(0, 4.9, 0); g.add(t);
      return g;
    },
    colliders: (s) => [{ c: [-s[0] * 0.46, s[1] / 2, 0], h: [0.35, s[1] / 2, 0.35] }, { c: [s[0] * 0.46, s[1] / 2, 0], h: [0.35, s[1] / 2, 0.35] }] },
  { type: "lava", label: "Lava", icon: "🌋", cat: "Gameplay", base: [8, 1, 8], color: "#ff4b12", mat: "neon", b: { k: "lava" },
    build: (o) => { const g = new THREE.Group(); box(g, 8, 1, 8, M(o.color, o.mat || "neon"), 0, 0.5, 0); return g; } },
  { type: "jumppad", label: "Jump Pad", icon: "🦘", cat: "Gameplay", base: [4, 0.6, 4], color: "#a64bf4", b: { k: "jump", power: 30 },
    build: (o) => { const g = new THREE.Group(); box(g, 4, 0.4, 4, M("#2b2f36"), 0, 0.2, 0); cyl(g, 1.6, 1.8, 0.2, M(o.color, "neon"), 0, 0.5, 0, 24); return g; } },
  { type: "spinner", label: "Spinner Bar", icon: "🌀", cat: "Gameplay", base: [16, 2, 1], color: "#ff2a2a", mat: "neon", b: { k: "spin", speed: 90, hurts: true },
    build: (o) => { const g = new THREE.Group(); box(g, 16, 0.8, 0.8, M(o.color, o.mat || "neon"), 0, 1.4, 0); cyl(g, 0.6, 0.8, 1.8, M("#2b2f36", "metal"), 0, 0.9, 0, 16); return g; },
    colliders: (s) => [{ c: [0, s[1] * 0.7, 0], h: [s[0] / 2, s[1] * 0.2, s[2] * 0.4] }] },
  { type: "mover", label: "Moving Platform", icon: "↔️", cat: "Gameplay", base: [6, 1, 6], color: "#13c4c4", b: { k: "move", axis: "x", distance: 12, speed: 4 },
    build: (o) => { const g = new THREE.Group(); box(g, 6, 1, 6, M(o.color, o.mat), 0, 0.5, 0); box(g, 5, 0.06, 0.4, M("#ffffff", "neon"), 0, 1.03, 0); return g; } },
  { type: "door", label: "Door", icon: "🚪", cat: "Gameplay", base: [4, 7, 0.6], color: "#8b5a2b", b: { k: "door" },
    build: (o) => { const g = new THREE.Group(); box(g, 4, 7, 0.6, M(o.color, o.mat), 0, 3.5, 0); ball(g, 0.2, M("#ffc531", "metal"), 1.4, 3.4, 0.4); box(g, 3, 2.4, 0.08, M("#000000", "glass"), 0, 5, 0.3); return g; } },
  { type: "npc", label: "Character", icon: "🧍", cat: "Gameplay", base: [2, 3.2, 1.2], color: "#2f7df6", b: { k: "npc" }, text: "Hi! Welcome to my game!",
    build: (o) => {
      const g = new THREE.Group(), shirt = M(o.color, o.mat);
      box(g, 0.7, 1.2, 0.7, M("#2b2f36"), -0.4, 0.6, 0); box(g, 0.7, 1.2, 0.7, M("#2b2f36"), 0.4, 0.6, 0);
      box(g, 1.6, 1.2, 0.8, shirt, 0, 1.8, 0);
      box(g, 0.5, 1.1, 0.5, shirt, -1.05, 1.85, 0); box(g, 0.5, 1.1, 0.5, shirt, 1.05, 1.85, 0);
      box(g, 1, 0.9, 0.9, M("#e8b98f"), 0, 2.85, 0);
      box(g, 0.16, 0.16, 0.05, M("#111"), -0.22, 2.95, -0.46); box(g, 0.16, 0.16, 0.05, M("#111"), 0.22, 2.95, -0.46);
      return g;
    } },

  { type: "switch", label: "Wall Button", icon: "🔴", cat: "Gameplay", base: [1.6, 1.6, 0.5], color: "#e8261c", b: { k: "switch", target: "", how: "click" },
    build: (o) => { const g = new THREE.Group(); box(g, 1.6, 1.6, 0.25, M("#3a3d42", "metal"), 0, 0.8, 0.12); cyl(g, 0.5, 0.5, 0.3, M(o.color, o.mat === "plastic" ? "neon" : o.mat), 0, 0.8, -0.1, 20).rotation.x = Math.PI / 2; return g; } },
  { type: "camera", label: "Security Camera", icon: "📹", cat: "Gameplay", base: [1.2, 1.4, 2], color: "#d8dde4",
    build: (o) => { // looks toward -z (its front); a GUI button can "Look through" it
      const g = new THREE.Group();
      box(g, 0.5, 0.5, 0.2, M("#3a3d42", "metal"), 0, 1.15, 0.9); cyl(g, 0.08, 0.08, 0.6, M("#3a3d42", "metal"), 0, 1.0, 0.65, 8).rotation.x = Math.PI / 2;
      box(g, 0.9, 0.8, 1.5, M(o.color, o.mat), 0, 0.9, -0.05); cyl(g, 0.3, 0.3, 0.2, M("#111", "smooth"), 0, 0.9, -0.85, 18).rotation.x = Math.PI / 2;
      ball(g, 0.09, M("#ff2020", "neon"), 0.32, 1.22, -0.8);
      return g;
    } },
  { type: "light", label: "Light Bulb", icon: "💡", cat: "Gameplay", base: [1, 1.4, 1], color: "#fff2b0", solid: false, b: { k: "light", power: 3, range: 30 },
    build: (o) => { const g = new THREE.Group(); cyl(g, 0.25, 0.3, 0.4, M("#3a3d42", "metal"), 0, 1.2, 0, 12); ball(g, 0.45, M(o.color, "neon"), 0, 0.7, 0); return g; } },
  // (imported things: see files.js. They're added from ＋ Add > Import or the Toolbox's "My imports".)
  { type: "model", label: "Imported Model", icon: "📦", cat: "Imported", hidden: true, base: [1, 1, 1], color: "#ffffff",
    build: () => { const g = new THREE.Group(); g.userData.model = true; return g; } },
  { type: "picture", label: "Picture", icon: "🖼️", cat: "Imported", hidden: true, base: [4, 3, 0.2], color: "#ffffff",
    build: () => { const g = new THREE.Group(); g.userData.picture = true; box(g, 4, 3, 0.2, M("#2b2f36"), 0, 1.5, 0); return g; } },

  // ----- decor
  { type: "sign", label: "Sign", icon: "🪧", cat: "Decor", base: [5, 4, 0.4], color: "#8b5a2b", text: "My awesome game!",
    build: (o) => {
      const g = new THREE.Group(), m = M(o.color, o.mat);
      cyl(g, 0.15, 0.15, 2.2, m, -1.8, 1.1, 0, 8); cyl(g, 0.15, 0.15, 2.2, m, 1.8, 1.1, 0, 8);
      box(g, 5, 2, 0.3, m, 0, 3, 0);
      const t = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.7), new THREE.MeshBasicMaterial({ map: textTexture(o.text, "#f3e8d0", "#2b1a0e") }));
      t.position.set(0, 3, -0.16); t.rotation.y = Math.PI; g.add(t);
      const t2 = t.clone(); t2.position.z = 0.16; t2.rotation.y = 0; g.add(t2);
      return g;
    } },
  { type: "lamp", label: "Lamp Post", icon: "💡", cat: "Decor", base: [1.2, 7, 1.2], color: "#2b2f36",
    build: (o) => { const g = new THREE.Group(); cyl(g, 0.15, 0.25, 6.4, M(o.color, "metal"), 0, 3.2, 0, 10); ball(g, 0.55, M("#fff2b0", "neon"), 0, 6.6, 0); return g; },
    colliders: (s) => [{ c: [0, s[1] / 2, 0], h: [0.25, s[1] / 2, 0.25] }] },
  { type: "bench", label: "Bench", icon: "🪑", cat: "Decor", base: [4, 1.8, 1.6], color: "#8b5a2b",
    build: (o) => { const g = new THREE.Group(), m = M(o.color, o.mat); box(g, 4, 0.2, 1.4, m, 0, 0.9, 0); box(g, 4, 0.8, 0.15, m, 0, 1.4, 0.65); for (const x of [-1.7, 1.7]) box(g, 0.2, 0.9, 1.3, M("#2b2f36"), x, 0.45, 0); return g; } },
  { type: "crate", label: "Crate", icon: "📦", cat: "Decor", base: [2, 2, 2], color: "#b07a3b",
    build: (o) => { const g = new THREE.Group(), m = M(o.color, o.mat), d = M("#7a4f22"); box(g, 2, 2, 2, m, 0, 1, 0); for (const y of [0.1, 1.9]) { box(g, 2.04, 0.2, 0.2, d, 0, y, 0.92); box(g, 2.04, 0.2, 0.2, d, 0, y, -0.92); } return g; } },
  { type: "barrel", label: "Barrel", icon: "🛢️", cat: "Decor", base: [1.6, 2, 1.6], color: "#c0392b",
    build: (o) => { const g = new THREE.Group(); cyl(g, 0.8, 0.8, 2, M(o.color, o.mat), 0, 1, 0, 18); cyl(g, 0.82, 0.82, 0.12, M("#333", "metal"), 0, 0.4, 0, 18); cyl(g, 0.82, 0.82, 0.12, M("#333", "metal"), 0, 1.6, 0, 18); return g; } },
  { type: "cone", label: "Traffic Cone", icon: "🔺", cat: "Decor", base: [1, 1.4, 1], color: "#ff7a1a",
    build: (o) => { const g = new THREE.Group(); box(g, 1, 0.1, 1, M("#222"), 0, 0.05, 0); cyl(g, 0.05, 0.45, 1.3, M(o.color, o.mat), 0, 0.75, 0, 16); cyl(g, 0.3, 0.36, 0.2, M("#fff"), 0, 0.7, 0, 16); return g; } },
  { type: "sword", label: "Sword Display", icon: "🗡️", cat: "Decor", base: [1.2, 4, 1.2], color: "#7fd1ff",
    build: (o) => {
      const g = new THREE.Group();
      box(g, 1.2, 0.6, 1.2, M("#2b2f36"), 0, 0.3, 0);
      box(g, 0.3, 2.4, 0.08, M(o.color, "metal"), 0, 2.3, 0); box(g, 1, 0.16, 0.2, M("#ffc531", "metal"), 0, 1.05, 0); box(g, 0.16, 0.5, 0.16, M("#5b3a22"), 0, 0.75, 0);
      return g;
    } },
];

export const BY_TYPE = Object.fromEntries(ASSETS.map((a) => [a.type, a]));

// What each behavior does in Play (see play.js) and the settings it shows in Properties.
export const BEHAVIORS = {
  none: { label: "None" },
  spawn: { label: "Spawn point", note: "Players start here." },
  coin: { label: "Coin", note: "Touch to collect.", params: [["points", "Points", "number", 1]] },
  checkpoint: { label: "Checkpoint", note: "Touch it, and you come back here after falling or touching lava." },
  finish: { label: "Finish (win!)", note: "Touch it to win the game.", params: [["message", "Win message", "text", "You win!"]] },
  lava: { label: "Lava (hurts)", note: "Touching it sends you back to your checkpoint." },
  jump: { label: "Jump pad", note: "Bounces you up.", params: [["power", "Power", "number", 30]] },
  spin: { label: "Spin", note: "Spins around.", params: [["speed", "Speed", "number", 90], ["hurts", "Hurts", "check", false]] },
  move: { label: "Move back and forth", note: "Players riding it move with it.", params: [["axis", "Direction", "axis", "x"], ["distance", "Distance", "number", 12], ["speed", "Speed", "number", 4], ["hurts", "Hurts", "check", false]] },
  door: { label: "Door (opens)", note: "Slides open when someone walks up to it." },
  npc: { label: "Talks", note: "Says its Text when you walk up to it." },
  car: { label: "Drivable car", note: "Walk up and press E to drive.", params: [["speed", "Top speed", "number", 40]] },
  switch: { label: "Switch (turns something on / off)", note: "Click it (or touch it) in the game to show or hide the thing you pick. Great for doors, lights and secret walls!",
    params: [["target", "Turns on / off", "target", ""], ["how", "Works when you", "how", "click"]] },
  light: { label: "Light (glows)", note: "Lights up everything around it. Looks best with the Night sky!", params: [["power", "Brightness", "number", 3], ["range", "How far", "number", 30]] },
};
export const SWITCH_HOW = { click: "Click it", touch: "Touch it" };
