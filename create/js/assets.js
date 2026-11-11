// FREE ASSETS for GunnerVerse Studio. Every asset is built in code from simple shapes (nothing to download, nothing to
// license). Each one is modeled at its `base` size with its bottom at y = 0 and centered on x / z; the editor scales it
// to the object's `size`. `colliders(size)` lists the solid boxes (in real size, around the object's origin) when they
// aren't just the whole box: a house has walls with a doorway, a ramp has a slope, a tree only its trunk.
//   box: {c: [x, y, z] center, h: [x, y, z] half size, rx: tilt around X (radians, for slopes)}
// `b` is the behavior a new copy starts with (see BEHAVIORS), `solid: false` = players walk through it.
import * as THREE from "../vendor/three.module.js";
import { monsterInner } from "./monster.js";

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
// A vehicle part from its side outline: pts = [z, y] corners going around (front is -z), or {arch: [z, y, r]} for a
// wheel arch cut up into the bottom edge. Pushed out to `width` (centered on x = xo) with soft rounded edges.
function sideBody(g, pts, width, mat, bevel, xo) {
  const sh = new THREE.Shape(), out = [];
  for (const p of pts) {
    if (Array.isArray(p)) { out.push([-p[0], p[1]]); continue; }
    const [cz, cy, r] = p.arch;
    for (let i = 0; i <= 14; i++) { const a = Math.PI + 0.4 - (Math.PI + 0.8) * i / 14; out.push([-(cz + r * Math.cos(a)), cy + r * Math.sin(a)]); }
  }
  out.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const b = bevel || 0, depth = Math.max(0.01, width - 2 * b);
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
  geo.rotateY(Math.PI / 2); geo.translate(-depth / 2 + (xo || 0), 0, 0);
  return mesh(g, geo, mat);
}
// A real-looking wheel: tire, metal rim with spokes and a hub (chunky = big tread blocks, knobby = dirt bike knobs + thin spokes).
function carWheel(g, x, y, z, r, w, chunky, knobby) {
  const w0 = new THREE.Group(); w0.position.set(x, y, z); g.add(w0);
  const tire = M("#15171a"), rimM = M(knobby ? "#2b2d31" : "#c9ced6", "metal");
  cyl(w0, r * 0.97, r * 0.97, w, tire, 0, 0, 0, 28).rotation.z = Math.PI / 2;
  const edge = new THREE.TorusGeometry(r * 0.8, Math.min(r * 0.18, w * 0.35), 8, 28);
  for (const s of [-1, 1]) { const t = mesh(w0, edge, tire, s * w * 0.32, 0, 0); t.rotation.y = Math.PI / 2; }
  if (chunky || knobby) { const n = knobby ? 22 : 18, kb = new THREE.BoxGeometry(knobby ? w * 0.9 : w * 1.02, r * 0.1, r * (knobby ? 0.12 : 0.22));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = mesh(w0, kb, tire, 0, Math.cos(a) * r, Math.sin(a) * r); k.rotation.x = -a; } }
  cyl(w0, r * 0.6, r * 0.6, w + 0.02, rimM, 0, 0, 0, 20).rotation.z = Math.PI / 2;
  const n = knobby ? 12 : 5, sg = new THREE.BoxGeometry(w + 0.05, r * 0.55, r * (knobby ? 0.03 : 0.12));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, s = mesh(w0, sg, M(knobby ? "#c9ced6" : "#8d939b", "metal"), 0, Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28); s.rotation.x = -a; }
  cyl(w0, r * 0.17, r * 0.17, w + 0.08, M("#e8e8e8", "metal"), 0, 0, 0, 12).rotation.z = Math.PI / 2;
  return w0;
}
// A black fender flare over a wheel (half a ring on the side of the body).
function archFlare(g, cz, cy, r, x, mat) {
  const f = mesh(g, new THREE.TorusGeometry(r * 1.08, r * 0.11, 6, 18, Math.PI), mat, x, cy, cz);
  f.rotation.y = Math.PI / 2; f.scale.z = 1.6;
  return f;
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

  // ----- vehicles (drive with E in Play). Bodies are side outlines (sideBody) pushed out to the car's width, with
  // real wheel arches, glass cabins, lights, bumpers and mirrors.
  { type: "car", label: "Sports Car", icon: "🏎️", cat: "Vehicles", base: [4.4, 2, 8], color: "#e8261c", b: { k: "car", speed: 40 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth"), glass = M("#1b2430", "smooth"), black = M("#141518"), chrome = M("#c9ced6", "metal");
      sideBody(g, [[-4.0, 0.32], [-3.3, 0.24], { arch: [-2.55, 0.52, 0.62] }, { arch: [2.45, 0.52, 0.62] }, [3.95, 0.3], [4.05, 0.72], [3.95, 1.08], [2.8, 1.18], [-0.9, 1.2], [-3.7, 1.04], [-4.1, 0.66]], 4.2, paint, 0.06);
      sideBody(g, [[-1.0, 1.12], [0.2, 1.8], [1.65, 1.8], [2.95, 1.12]], 3.5, glass, 0.04);              // windows
      sideBody(g, [[0.1, 1.78], [0.25, 1.88], [1.55, 1.88], [1.72, 1.78]], 3.56, paint, 0.02);         // roof
      box(g, 3.56, 0.6, 0.12, paint, 0, 1.47, 0.95);                                                     // middle pillar
      box(g, 3.0, 0.22, 0.1, black, 0, 0.55, -4.06); box(g, 2.0, 0.12, 0.08, M("#2a2d33", "metal"), 0, 0.78, -4.08); // grille
      for (const s of [-1, 1]) {
        box(g, 0.85, 0.2, 0.1, M("#fff6c4", "neon"), s * 1.45, 0.86, -4.02);                             // headlights
        box(g, 0.9, 0.18, 0.1, M("#ff2a2a", "neon"), s * 1.4, 0.92, 4.02);                               // tail lights
        box(g, 0.28, 0.16, 0.3, paint, s * 1.95, 1.3, -0.6); box(g, 0.05, 0.12, 0.22, M("#9fb6c8", "metal"), s * 2.1, 1.3, -0.6); // mirrors
        cyl(g, 0.09, 0.09, 0.3, chrome, s * 0.7, 0.35, 4.02, 10).rotation.x = Math.PI / 2;            // exhausts
        box(g, 0.1, 0.42, 0.12, black, s * 1.5, 1.32, 3.6);                                              // spoiler posts
      }
      box(g, 3.9, 0.08, 0.55, black, 0, 1.55, 3.65);                                                     // spoiler
      box(g, 0.9, 0.3, 0.04, M("#f2f2f2"), 0, 0.62, 4.0);                                                // number plate
      for (const [x, z] of [[-1.8, -2.55], [1.8, -2.55], [-1.8, 2.45], [1.8, 2.45]]) carWheel(g, x, 0.52, z, 0.52, 0.5);
      return g;
    } },
  { type: "truck", label: "Monster Truck", icon: "🛻", cat: "Vehicles", base: [5, 3.4, 9], color: "#1f8f3a", b: { k: "car", speed: 32 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth"), glass = M("#1b2430", "smooth"), black = M("#141518"), chrome = M("#c9ced6", "metal");
      box(g, 2.2, 0.35, 7.6, black, 0, 1.25, 0);                                                         // frame
      for (const z of [-2.8, 2.8]) { cyl(g, 0.16, 0.16, 4.2, chrome, 0, 1.2, z, 10).rotation.z = Math.PI / 2; box(g, 0.3, 0.6, 0.3, M("#e8c331", "metal"), 0, 1.55, z); } // axles + springs
      sideBody(g, [[-4.2, 1.55], { arch: [-2.8, 1.45, 1.15] }, { arch: [2.8, 1.45, 1.15] }, [4.25, 1.55], [4.25, 2.55], [-0.2, 2.55], [-2.3, 2.62], [-4.15, 2.45], [-4.3, 2.0]], 4.3, paint, 0.08);
      sideBody(g, [[-2.25, 2.58], [-1.45, 3.5], [0.45, 3.5], [0.6, 2.58]], 3.9, glass, 0.04);         // cab windows
      sideBody(g, [[-1.55, 3.45], [-1.42, 3.58], [0.42, 3.58], [0.56, 3.45]], 3.96, paint, 0.03);     // cab roof
      box(g, 3.96, 0.9, 0.14, paint, 0, 3.0, -0.35);                                                     // middle pillar
      box(g, 3.6, 0.12, 3.4, M("#26282d"), 0, 2.5, 2.4);                                                 // truck bed floor
      for (const s of [-1, 1]) {
        box(g, 0.12, 0.5, 3.5, paint, s * 2.08, 2.8, 2.4);                                               // bed sides
        box(g, 0.9, 0.32, 0.1, M("#fff6c4", "neon"), s * 1.45, 2.15, -4.32);                             // headlights
        box(g, 0.5, 0.4, 0.1, M("#ff2a2a", "neon"), s * 1.75, 2.25, 4.3);                                // tail lights
        box(g, 0.25, 0.3, 0.35, black, s * 2.15, 2.95, -2.0);                                            // mirrors
        for (const z of [-2.8, 2.8]) archFlare(g, z, 1.45, 1.15, s * 2.12, black);                       // fender flares
      }
      box(g, 3.6, 0.12, 0.12, chrome, 0, 3.75, -0.9); for (const x of [-1.2, -0.4, 0.4, 1.2]) box(g, 0.35, 0.22, 0.18, M("#fff6c4", "neon"), x, 3.88, -0.9); // light bar
      box(g, 3.7, 0.5, 0.12, paint, 0, 2.8, 4.18);                                                       // tailgate
      box(g, 3.4, 0.45, 0.3, chrome, 0, 1.75, -4.4); box(g, 2.2, 0.4, 0.08, M("#2a2d33", "metal"), 0, 2.15, -4.32); // bumper + grille
      for (const [x, z] of [[-2.1, -2.8], [2.1, -2.8], [-2.1, 2.8], [2.1, 2.8]]) carWheel(g, x, 1.15, z, 1.15, 0.95, true);
      return g;
    } },
  { type: "kart", label: "Go-Kart", icon: "🛞", cat: "Vehicles", base: [3, 1.4, 4.4], color: "#ffc531", b: { k: "car", speed: 46 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth"), black = M("#141518"), chrome = M("#c9ced6", "metal");
      box(g, 1.3, 0.12, 3.9, M("#2a2d33", "metal"), 0, 0.25, 0);                                         // chassis
      sideBody(g, [[-2.15, 0.28], [-0.4, 0.28], [-0.2, 0.5], [-1.9, 0.62]], 1.1, paint, 0.05);          // nose
      for (const s of [-1, 1]) sideBody(g, [[-0.6, 0.25], [1.2, 0.25], [1.1, 0.55], [-0.4, 0.55]], 0.35, paint, 0.04, s * 0.85); // side pods
      box(g, 0.9, 0.12, 0.8, black, 0, 0.45, 0.55); box(g, 0.9, 0.75, 0.14, black, 0, 0.82, 0.98);      // seat
      cyl(g, 0.05, 0.05, 0.55, chrome, 0, 0.62, -0.45, 8).rotation.x = -0.9;                              // steering column
      const sw = mesh(g, new THREE.TorusGeometry(0.24, 0.045, 8, 20), black, 0, 0.83, -0.62); sw.rotation.x = -0.6; // steering wheel
      box(g, 0.75, 0.45, 0.55, M("#3a3d42", "metal"), 0.35, 0.5, 1.55); cyl(g, 0.07, 0.07, 0.5, chrome, 0.7, 0.55, 1.95, 8).rotation.x = Math.PI / 2; // engine + exhaust
      box(g, 2.6, 0.18, 0.25, black, 0, 0.32, -2.05); box(g, 2.6, 0.18, 0.25, black, 0, 0.32, 2.1);       // bumpers
      box(g, 0.6, 0.35, 0.04, M("#f2f2f2"), 0, 0.5, -2.2);                                                 // number plate
      for (const [x, z, r] of [[-1.22, -1.4, 0.34], [1.22, -1.4, 0.34], [-1.25, 1.5, 0.42], [1.25, 1.5, 0.42]]) carWheel(g, x, r, z, r, r > 0.4 ? 0.5 : 0.36);
      return g;
    } },
  { type: "dirtbike", label: "Dirt Bike", icon: "🏍️", cat: "Vehicles", base: [1.1, 2.2, 3.6], color: "#ff7a1a", b: { k: "car", speed: 52 },
    build: (o) => {
      const g = new THREE.Group(), paint = M(o.color, "smooth"), black = M("#141518"), chrome = M("#c9ced6", "metal"), white = M("#f2f2f2", "smooth");
      for (const z of [-1.25, 1.25]) carWheel(g, 0, 0.58, z, 0.58, 0.24, true, true);                    // knobby wheels
      for (const s of [-1, 1]) cyl(g, 0.045, 0.045, 1.35, chrome, s * 0.16, 1.15, -1.0, 10).rotation.x = -0.45; // front forks
      sideBody(g, [[-1.62, 1.18], [-1.15, 1.32], [-0.75, 1.2], [-1.2, 1.12]], 0.36, white, 0.03);       // front fender
      cyl(g, 0.05, 0.05, 0.95, black, 0, 1.75, -0.78, 10).rotation.z = Math.PI / 2;                       // handlebar
      for (const s of [-1, 1]) cyl(g, 0.06, 0.06, 0.18, M("#2b2b2b"), s * 0.44, 1.75, -0.78, 10).rotation.z = Math.PI / 2; // grips
      sideBody(g, [[-0.95, 1.65], [-0.75, 1.82], [-0.15, 1.6], [-0.6, 1.3]], 0.12, white, 0.02);        // number board
      sideBody(g, [[-0.7, 1.25], [-0.65, 1.62], [0.2, 1.55], [0.35, 1.25]], 0.55, paint, 0.06);         // tank + shrouds
      sideBody(g, [[0.0, 1.5], [0.15, 1.6], [1.55, 1.42], [1.5, 1.32]], 0.42, black, 0.05);              // seat
      sideBody(g, [[1.0, 1.32], [1.55, 1.42], [1.95, 1.35], [1.5, 1.18]], 0.34, paint, 0.03);           // rear fender
      box(g, 0.42, 0.5, 0.6, M("#3a3d42", "metal"), 0, 0.85, -0.05); box(g, 0.5, 0.25, 0.4, M("#55585e", "metal"), 0, 0.62, -0.1); // engine
      cyl(g, 0.05, 0.05, 1.1, M("#2a2d33", "metal"), 0, 1.05, -0.55, 8).rotation.x = 0.7;                 // frame
      for (const s of [-1, 1]) box(g, 0.06, 0.08, 1.25, M("#2a2d33", "metal"), s * 0.15, 0.72, 0.65).rotation.x = -0.06; // swingarm
      cyl(g, 0.07, 0.07, 1.5, chrome, 0.24, 1.0, 0.75, 10).rotation.x = Math.PI / 2 - 0.25;              // exhaust
      box(g, 0.08, 0.32, 0.04, M("#ff2a2a", "neon"), 0, 1.38, 1.92); box(g, 0.16, 0.1, 0.06, M("#fff6c4", "neon"), 0, 1.55, -1.02); // lights
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
  { type: "monster", label: "Monster", icon: "👾", cat: "Gameplay", hidden: true, base: [1, 1, 1], color: "#a64bf4", text: "",
    build: (o) => monsterInner(o.mon) }, // (made with ＋ Add > Make a Monster: monster.js)
  // 🧩 A MESH: pieces glued into one thing (select some, right-click > Mesh together). obj.parts = the pieces (like
  // objects, measured from the mesh's bottom middle when it was made, at obj.mb = its size then), obj.bones = its 🦴
  // bones. world.js buildMesh builds it; every solid piece is solid.
  { type: "mesh", label: "Mesh", icon: "🧩", cat: "Parts", hidden: true, base: [1, 1, 1], color: "#a3a8b0",
    build: () => new THREE.Group(), colliders: (size, o) => meshColliders(size, o) },
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
export const NOT_IN_MESH = new Set(["mesh", "monster", "model"]); // (those can't be pieces of a mesh)
const _D2R = Math.PI / 180, _AX = new THREE.Vector3(1, 0, 0);
function meshColliders(size, o) {
  if (!o || !Array.isArray(o.parts)) return [];
  const mb = o.mb || [1, 1, 1], k = [size[0] / mb[0], size[1] / mb[1], size[2] / mb[2]], out = [];
  for (const p of o.parts) {
    const A = BY_TYPE[p.type]; if (!A || p.solid === false || NOT_IN_MESH.has(p.type)) continue;
    const list = A.colliders ? A.colliders(p.size) : [{ c: [0, p.size[1] / 2, 0], h: [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2] }];
    const pq = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rot[0] * _D2R, p.rot[1] * _D2R, p.rot[2] * _D2R));
    for (const b of list) {
      const c = new THREE.Vector3(b.c[0], b.c[1], b.c[2]).applyQuaternion(pq).add(new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]));
      const q = pq.clone(); if (b.rx) q.multiply(new THREE.Quaternion().setFromAxisAngle(_AX, b.rx));
      out.push({ c: [c.x * k[0], c.y * k[1], c.z * k[2]], h: [b.h[0] * k[0], b.h[1] * k[1], b.h[2] * k[2]], q });
    }
  }
  return out;
}

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
