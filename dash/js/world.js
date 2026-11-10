// TURBO DASH 3D world: sky, themes, the rooftop track, scenery, obstacles, coins, the runner, Bolt the robot, effects.
// Everything is pooled (made once, reused) so the endless track never stutters.
import * as THREE from "/create/vendor/three.module.js";
import { mergeGeometries } from "/create/vendor/BufferGeometryUtils.js";
import { LANES, TRAIN_TOP, BAR_LOW, BAR_TOP, THEME_LEN, themeAt, rng } from "./gen.js";

export const VIEW = 210;
const TL = 16; // track tile length (made of four 4 m pieces; a gap removes one piece)
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R = rng(12345);
const rr = (a, b) => a + R() * (b - a);
const pick = (a) => a[Math.floor(R() * a.length)];

// ------------------------------------------------------------------ renderer
export const canvas = document.getElementById("canvas");
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 520);
scene.fog = new THREE.Fog(0x6a2a7a, 70, VIEW);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-4, 10, 6); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(3, 4, -8); scene.add(fill); // (lights the runner's face for the menu)
export const track = new THREE.Group(); scene.add(track);
let portrait = false;
export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; portrait = w < h * 0.9; camera.updateProjectionMatrix();
}
export function render() { renderer.render(scene, camera); }

// ------------------------------------------------------------------ textures (all drawn in code)
function ctex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
  return t;
}
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
export const dotTex = ctex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.7)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const starTex = ctex(64, 64, (g) => { g.fillStyle = "#fff"; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 11 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); });

// ------------------------------------------------------------------ themes
export const THEMES = [
  { name: "NEON CITY", low: 0x1a0834, top: 0x0d0426, mid: 0x4a1680, bot: 0xff5fa8, fog: 0x5e2378, hemi: [0xc8b0ff, 0x3a1850, 1.7], sun: 1.2, stars: 0.7,
    road: ["#272040", "#332b54", "#3ff3ff", "#ff4fd8"], col: "city", edge: 0x3ff3ff, train: ["#1b2a6b", "#3ff3ff", "#ff4fd8"], ramp: 0x3a3070, key: 0 },
  { name: "DESERT CANYON", low: 0x9a5a3a, top: 0x2a6ad0, mid: 0x86c0ff, bot: 0xffc27a, fog: 0xeab07c, hemi: [0xfff0d8, 0x9a5a30, 1.9], sun: 1.9, stars: 0,
    road: ["#b8733e", "#c98650", "#fff0b8", "#ff6a2a"], col: "desert", edge: 0xffa030, train: ["#8a3a1a", "#ffcf5a", "#3a1a0a"], ramp: 0x8a5a2a, key: 2 },
  { name: "CANDY LAND", low: 0xe0a0d0, top: 0x5ec0ff, mid: 0xb4e4ff, bot: 0xffc0ea, fog: 0xffd2ee, hemi: [0xffffff, 0xff9ad0, 1.9], sun: 1.4, stars: 0,
    road: ["#ff8cc6", "#ffb0d8", "#ffffff", "#5affd0"], col: "candy", edge: 0xff3fa0, train: ["#ff5fae", "#ffffff", "#7a2a5a"], ramp: 0xff7ab8, key: 5 },
  { name: "SPACE STATION", low: 0x04050e, top: 0x000005, mid: 0x0a0c2c, bot: 0x2c3c90, fog: 0x161c46, hemi: [0xa0c0ff, 0x202040, 1.5], sun: 1.5, stars: 1,
    road: ["#353b4c", "#444c62", "#4af0ff", "#ffcc33"], col: "space", edge: 0x4af0ff, train: ["#d8dde6", "#ff8a1a", "#2a2e3a"], ramp: 0x58607a, key: -3 },
];
function roadTex(t) {
  const [a, b, lane, edge] = t.road;
  return ctex(256, 256, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? b : a; g.globalAlpha = 0.5; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
    g.globalAlpha = 1;
    // panels
    g.strokeStyle = b; g.lineWidth = 4; g.strokeRect(0, 0, 256, 256);
    // lane lines (dashed)
    g.fillStyle = lane; g.shadowColor = lane; g.shadowBlur = 10;
    for (const x of [88, 168]) g.fillRect(x - 3, 40, 6, 176);
    g.fillStyle = edge; g.shadowColor = edge;
    g.fillRect(6, 0, 7, 256); g.fillRect(243, 0, 7, 256);
    g.shadowBlur = 0;
  });
}
function colTex(kind) {
  return ctex(128, 128, (g) => {
    if (kind === "city") {
      g.fillStyle = "#1a1430"; g.fillRect(0, 0, 128, 128);
      for (let y = 6; y < 128; y += 16) for (let x = 6; x < 128; x += 16) { g.fillStyle = Math.random() < 0.45 ? pick(["#ffd86a", "#6af0ff", "#ff7ad8", "#fff2c0"]) : "#2a2048"; g.fillRect(x, y, 9, 10); }
    } else if (kind === "desert") {
      for (let y = 0; y < 128; y += 8) { g.fillStyle = pick(["#b0582a", "#c46a32", "#d88a4a", "#a04a22", "#e09a5a"]); g.fillRect(0, y, 128, 8); }
    } else if (kind === "candy") {
      g.fillStyle = "#f2d29a"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#d9ae6a"; g.lineWidth = 4;
      for (let i = -128; i < 256; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
    } else {
      g.fillStyle = "#2a3040"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#3c4458"; g.lineWidth = 3;
      for (let y = 0; y < 128; y += 32) g.strokeRect(2, y + 2, 124, 28);
      for (let y = 14; y < 128; y += 32) { g.fillStyle = Math.random() < 0.6 ? "#4af0ff" : "#ffcc33"; g.fillRect(16, y, 10, 4); g.fillRect(100, y, 10, 4); }
    }
  }, 2, 10);
}
// tile materials per theme: [road, column, edge]
const TILE_MATS = THEMES.map((t) => [
  new THREE.MeshLambertMaterial({ map: roadTex(t) }),
  new THREE.MeshLambertMaterial({ map: colTex(t.col), emissive: t.col === "city" || t.col === "space" ? 0xffffff : 0x000000, emissiveMap: t.col === "city" || t.col === "space" ? null : null, emissiveIntensity: 0 }),
  new THREE.MeshBasicMaterial({ color: t.edge }),
]);
// city / space buildings: windows glow
for (const i of [0, 3]) { const m = TILE_MATS[i][1]; m.emissiveMap = m.map; m.emissiveIntensity = 0.85; }

// ------------------------------------------------------------------ sky
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, low: { value: new THREE.Color() } },
  vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 low; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(low, bot, smoothstep(-0.16, 0.0, h)); c = mix(c, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.22, 0.75, h)); gl_FragColor = vec4(c, 1.0); }",
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
const skyGroup = new THREE.Group(); scene.add(skyGroup);
const starGeo = new THREE.BufferGeometry(); {
  const p = []; for (let i = 0; i < 700; i++) { const a = R() * Math.PI * 2, e = Math.asin(rr(0.02, 1)); p.push(Math.cos(a) * Math.cos(e) * 430, Math.sin(e) * 430, Math.sin(a) * Math.cos(e) * 430); }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
skyGroup.add(new THREE.Points(starGeo, starMat));
// far-away things for each theme (moon + skyline, sun + mesas, rainbow + clouds, planets)
const farGroups = THEMES.map(() => { const g = new THREE.Group(); skyGroup.add(g); return g; });
function farMat(opt) { const m = new THREE.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false, ...opt }); m.userData.base = opt.opacity ?? 1; return m; }
function farPlane(g, texture, w, h, x, y, z, opacity = 1) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), farMat({ map: texture, opacity })); m.position.set(x, y, z); m.lookAt(0, y, 0); g.add(m); return m; }
function skyline(colA, colB, lights, kind) {
  return ctex(1024, 256, (g) => {
    g.clearRect(0, 0, 1024, 256);
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? colB : colA;
      let x = 0;
      while (x < 1024) {
        const w = 30 + Math.random() * 70, h = (layer ? 60 : 110) + Math.random() * (layer ? 80 : 120);
        if (kind === "mesa") { g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 12, 256 - h); g.lineTo(x + w * 2 - 12, 256 - h); g.lineTo(x + w * 2, 256); g.fill(); x += w * 2 + Math.random() * 60; continue; }
        g.fillRect(x, 256 - h, w, h);
        if (lights) for (let i = 0; i < 12; i++) { g.fillStyle = pick(lights); g.fillRect(x + 4 + Math.random() * (w - 10), 256 - h + 6 + Math.random() * (h - 12), 3, 4); g.fillStyle = layer ? colB : colA; }
        x += w + 2;
      }
    }
  });
}
{ // city
  const g = farGroups[0];
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex(128, 128, (c) => { const r = c.createRadialGradient(64, 64, 20, 64, 64, 64); r.addColorStop(0, "#fff4fb"); r.addColorStop(0.55, "#ffd0ec"); r.addColorStop(0.62, "rgba(255,150,220,0.5)"); r.addColorStop(1, "rgba(255,120,200,0)"); c.fillStyle = r; c.fillRect(0, 0, 128, 128); }), transparent: true, fog: false, depthWrite: false }));
  moon.material.userData.base = 1; moon.scale.set(90, 90, 1); moon.position.set(-130, 120, -360); g.add(moon);
  const sk = skyline("#2a0e4a", "#170830", ["#ff7ad8", "#6af0ff", "#ffd86a"]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; farPlane(g, sk, 420, 105, Math.sin(a) * 400, 40, -Math.cos(a) * 400); }
}
{ // desert
  const g = farGroups[1];
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex(128, 128, (c) => { const r = c.createRadialGradient(64, 64, 10, 64, 64, 64); r.addColorStop(0, "#fffbe0"); r.addColorStop(0.3, "#ffe08a"); r.addColorStop(0.45, "rgba(255,190,90,0.5)"); r.addColorStop(1, "rgba(255,160,80,0)"); c.fillStyle = r; c.fillRect(0, 0, 128, 128); }), transparent: true, fog: false, depthWrite: false }));
  s.material.userData.base = 1; s.scale.set(150, 150, 1); s.position.set(90, 60, -380); g.add(s);
  const sk = skyline("#b0603a", "#8a4a30", null, "mesa");
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; farPlane(g, sk, 420, 105, Math.sin(a) * 400, 30, -Math.cos(a) * 400); }
}
{ // candy
  const g = farGroups[2];
  const rb = ctex(512, 256, (c) => { const cols = ["#ff5a5a", "#ffa23a", "#fff05a", "#5aff8a", "#5ab8ff", "#b05aff"]; c.lineWidth = 16; cols.forEach((k, i) => { c.strokeStyle = k; c.beginPath(); c.arc(256, 256, 230 - i * 16, Math.PI, 0); c.stroke(); }); });
  farPlane(g, rb, 520, 260, 60, 60, -400, 0.8);
  const cloud = ctex(256, 128, (c) => { c.fillStyle = "#fff"; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(50 + i * 26, 70 + Math.sin(i * 1.7) * 14, 34, 0, 7); c.fill(); } });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloud, transparent: true, fog: false, depthWrite: false, color: pick([0xffffff, 0xffe0f4, 0xe0f4ff]) })); s.material.userData.base = 1; s.scale.set(90, 45, 1); s.position.set(Math.sin(a) * 380, 90 + R() * 70, -Math.cos(a) * 380); g.add(s); }
}
{ // space
  const g = farGroups[3];
  const pl = new THREE.Mesh(new THREE.SphereGeometry(55, 32, 16), farMat({ map: ctex(256, 128, (c) => { for (let y = 0; y < 128; y += 6) { c.fillStyle = pick(["#ff9a5a", "#ffb87a", "#e0704a", "#ffd0a0"]); c.fillRect(0, y, 256, 6); } }) }));
  pl.position.set(-150, 110, -340); g.add(pl);
  const ring = new THREE.Mesh(new THREE.RingGeometry(70, 100, 48), farMat({ color: 0xffd8a0, opacity: 0.6, side: THREE.DoubleSide }));
  ring.position.copy(pl.position); ring.rotation.set(1.2, 0.3, 0.2); g.add(ring);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), farMat({ map: ctex(256, 128, (c) => { c.fillStyle = "#2a6aff"; c.fillRect(0, 0, 256, 128); c.fillStyle = "#3adf7a"; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(Math.random() * 256, Math.random() * 128, 10 + Math.random() * 25, 6 + Math.random() * 14, 0, 0, 7); c.fill(); } }) }));
  earth.position.set(170, 70, -320); g.add(earth);
}
const farMats = farGroups.map((g) => { const a = []; g.traverse((o) => { if (o.material) a.push(o.material); }); return a; });

// ------------------------------------------------------------------ track tiles (8 m long; a 4 m gap removes half a tile)
function tileGeo(missing) {
  const sl = [], co = [], ed = [];
  for (let q = 0; q < 4; q++) {
    if (q === missing) continue;
    const zc = TL / 2 - (4 * q + 2); // (track goes toward -z)
    sl.push(new THREE.BoxGeometry(7.6, 0.5, 4).translate(0, -0.25, zc)); co.push(new THREE.BoxGeometry(7.0, 70, 4).translate(0, -35.5, zc));
    ed.push(new THREE.BoxGeometry(0.2, 0.24, 4).translate(-3.78, 0.08, zc), new THREE.BoxGeometry(0.2, 0.24, 4).translate(3.78, 0.08, zc));
  }
  return mergeGeometries([mergeGeometries(sl), mergeGeometries(co), mergeGeometries(ed)], true);
}
const TILE_GEO = [-1, 0, 1, 2, 3].map(tileGeo); // [whole tile, missing piece 0..3]
const tiles = [];
for (let i = 0; i < Math.ceil(VIEW / TL) + 14; i++) { const m = new THREE.Mesh(TILE_GEO[0], TILE_MATS[0]); m.visible = false; m.userData.idx = -999; track.add(m); tiles.push(m); }
function gapsIn(sim, a, b) { const out = []; for (const o of sim.gen.objs) { if (o.z0 >= b) break; if (o.kind === "gap" && o.z1 > a) out.push(o); } return out; }

// ------------------------------------------------------------------ scenery (pools for each theme)
const box1 = new THREE.BoxGeometry(1, 1, 1), cyl1 = new THREE.CylinderGeometry(1, 1, 1, 12), sph1 = new THREE.SphereGeometry(1, 16, 12);
const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const blinkMat = basic(0xff2a2a);
function ad(g, m) { g.add(m); return m; }
// many little static parts -> one geometry (one draw call)
function bake(list) {
  return mergeGeometries(list.map(([geo, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => { const c = geo.clone(); c.scale(sx, sy, sz); if (rx) c.rotateX(rx); if (ry) c.rotateY(ry); if (rz) c.rotateZ(rz); c.translate(x, y, z); return c; }));
}
function mesh(geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; }
const WORDS = ["TURBO", "ZAP!", "GG", "BOOST", "PIXEL PIZZA", "GO GO", "DASH", "NEON", "WOW", "RUN!", "SNACKS", "ARCADE"];
function signTex(word, col) {
  return ctex(256, 96, (g) => { g.fillStyle = "#12061e"; g.fillRect(0, 0, 256, 96); g.strokeStyle = col; g.lineWidth = 6; g.shadowColor = col; g.shadowBlur = 14; g.strokeRect(6, 6, 244, 84); g.fillStyle = col; g.font = "bold 44px 'Russo One', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(word, 128, 50, 230); });
}
const NEON = [0xff4fd8, 0x3ff3ff, 0xffe14a, 0x7aff5a, 0xff7a2a, 0xa07aff];
const winTexBase = colTex("city");
function cityItem() {
  const g = new THREE.Group(), w = rr(5, 11), d = rr(6, 14), top = rr(-12, 36), h = top + 60;
  const t = winTexBase.clone(); t.repeat.set(w / 3.5, h / 7); t.needsUpdate = true;
  const tint = pick([0xffffff, 0xd8c8ff, 0xc8f0ff]);
  g.add(mesh(box1, lam(tint, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 }), w, h, d, 0, top - h / 2, 0));
  const nc = basic(pick(NEON));
  g.add(mesh(box1, lam(0x241a3a), w, 0.3, d, 0, top + 0.15, 0));
  g.add(new THREE.Mesh(bake([[box1, w + 0.3, 0.4, 0.3, 0, top + 0.2, d / 2], [box1, w + 0.3, 0.4, 0.3, 0, top + 0.2, -d / 2], [box1, 0.3, 0.4, d + 0.3, w / 2, top + 0.2, 0], [box1, 0.3, 0.4, d + 0.3, -w / 2, top + 0.2, 0]]), nc));
  if (R() < 0.45) { const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.34), basic(0xffffff, { map: signTex(pick(WORDS), hex(pick(NEON))) })); s.position.set(0, top + w * 0.25, 0); s.userData.face = true; g.add(s); }
  else if (R() < 0.5) { g.add(mesh(box1, lam(0x888899), 0.2, 6, 0.2, w * 0.2, top + 3, 0)); g.add(mesh(sph1, blinkMat, 0.35, 0.35, 0.35, w * 0.2, top + 6.1, 0)); }
  g.userData.half = w / 2; g.userData.len = d;
  return g;
}
const bandTex = ctex(64, 128, (g) => { for (let y = 0; y < 128; y += 8) { g.fillStyle = pick(["#b0582a", "#c46a32", "#d88a4a", "#a04a22", "#e8a464", "#9a4020"]); g.fillRect(0, y, 64, 8); } }, 3, 3);
const cactusMat = lam(0x3aa04a);
function cactus(s = 1) {
  return new THREE.Mesh(bake([[cyl1, 0.45 * s, 3.4 * s, 0.45 * s, 0, 1.7 * s, 0], [cyl1, 0.3 * s, 1.4 * s, 0.3 * s, 0.75 * s, 2.0 * s, 0], [cyl1, 0.3 * s, 0.6 * s, 0.3 * s, 0.45 * s, 1.4 * s, 0, 0, 0, Math.PI / 2],
    [cyl1, 0.28 * s, 1.1 * s, 0.28 * s, -0.7 * s, 2.5 * s, 0], [cyl1, 0.28 * s, 0.55 * s, 0.28 * s, -0.42 * s, 2.0 * s, 0, 0, 0, Math.PI / 2]]), cactusMat);
}
const mesaGeo = new THREE.CylinderGeometry(1, 1.2, 1, 8);
function desertItem() {
  const g = new THREE.Group(), k = R();
  if (k < 0.7) {
    const r = rr(3.5, 10), top = rr(-10, 24), h = top + 60;
    const t = bandTex.clone(); t.repeat.set(3, h / 10); t.needsUpdate = true;
    g.add(mesh(mesaGeo, lam(0xffffff, { map: t, flatShading: true }), r, h, r, 0, top - h / 2, 0));
    if (R() < 0.6) { const c = cactus(rr(0.8, 1.3)); c.position.set(rr(-r * 0.5, r * 0.5), top, rr(-r * 0.4, r * 0.4)); g.add(c); }
    g.userData.half = r; g.userData.len = r * 2;
  } else {
    const top = rr(-6, 6);
    g.add(mesh(new THREE.ConeGeometry(1, 1, 6), lam(0xc8783e, { flatShading: true }), rr(2, 4), top + 50, rr(2, 4), 0, top - 25, 0));
    g.userData.half = 3; g.userData.len = 6;
  }
  return g;
}
const stripeTex = (a, b, n = 8) => ctex(64, 64, (g) => { g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; for (let i = -64; i < 128; i += 64 / n * 2) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64 / n, 0); g.lineTo(i + 64 / n + 64, 64); g.lineTo(i + 64, 64); g.fill(); } });
const swirlTex = (a, b) => ctex(128, 128, (g) => { g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.strokeStyle = b; g.lineWidth = 9; g.beginPath(); for (let t = 0; t < 30; t += 0.1) g.lineTo(64 + Math.cos(t) * t * 2.1, 64 + Math.sin(t) * t * 2.1); g.stroke(); });
const CANDY = [["#ff4f9a", "#ffffff"], ["#4fc8ff", "#ffffff"], ["#ffd23a", "#ff6a2a"], ["#8a5aff", "#ffb0f0"], ["#3ae08a", "#ffffff"]];
const caneMat = lam(0xffffff, { map: stripeTex("#ffffff", "#ff3a4a", 4) }); caneMat.map.repeat.set(1, 6);
function candyItem() {
  const g = new THREE.Group(), k = R();
  if (k < 0.35) { // lollipop
    const top = rr(4, 22), [a, b] = pick(CANDY), r = rr(2.4, 4);
    g.add(mesh(cyl1, lam(0xffffff), 0.35, top + 30, 0.35, 0, top - (top + 30) / 2, 0));
    const disc = mesh(new THREE.CylinderGeometry(1, 1, 1, 28), [lam(a), lam(0xffffff, { map: swirlTex(a, b) }), lam(0xffffff, { map: swirlTex(a, b) })], r, 0.6, r, 0, top + r * 0.8, 0);
    disc.rotation.x = Math.PI / 2; g.add(disc);
    g.userData.half = r; g.userData.len = r * 2;
  } else if (k < 0.6) { // candy cane
    const top = rr(2, 18);
    g.add(mesh(cyl1, caneMat, 0.7, top + 30, 0.7, 0, top - (top + 30) / 2, 0));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.7, 10, 18, Math.PI), caneMat); hook.position.set(1.6, top, 0); g.add(hook);
    g.userData.half = 3.5; g.userData.len = 2;
  } else if (k < 0.8) { // gumdrop hill on a wafer
    const r = rr(4, 8), top = rr(-8, 2);
    g.add(mesh(box1, TILE_MATS[2][1], r * 1.8, 60, r * 1.8, 0, top - 30, 0));
    g.add(mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(pick([0xff5a9a, 0x5affb0, 0xffd23a, 0x9a7aff, 0x5ac8ff]), { emissive: 0x220011 }), r, r * 0.9, r, 0, top, 0));
    g.userData.half = r; g.userData.len = r * 2;
  } else { // cupcake tower
    const r = rr(3, 5), top = rr(-4, 14);
    g.add(mesh(new THREE.CylinderGeometry(1, 0.8, 1, 16), lam(0xffffff, { map: stripeTex("#ff8ac8", "#ffd0ea", 6) }), r, top + 50, r, 0, top - (top + 50) / 2, 0));
    g.add(mesh(sph1, lam(pick([0xfff0f6, 0xffc0e0, 0xc8f0ff])), r * 1.1, r * 0.7, r * 1.1, 0, top + r * 0.2, 0));
    g.add(mesh(sph1, lam(0xff2a3a), 0.6, 0.6, 0.6, 0, top + r * 0.85, 0));
    g.userData.half = r; g.userData.len = r * 2;
  }
  return g;
}
const metal = lam(0xd0d6e0), metalDark = lam(0x5a6276), glow = basic(0x4af0ff), glowY = basic(0xffcc33);
const panelTex = ctex(64, 64, (g) => { g.fillStyle = "#1a3a8a"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "#6ab0ff"; g.lineWidth = 2; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }, 4, 2);
const panelMat = lam(0xffffff, { map: panelTex, emissive: 0x2244aa, emissiveIntensity: 0.6 });
function spaceItem() {
  const g = new THREE.Group(), k = R();
  if (k < 0.35) { // module on a pylon
    const y = rr(2, 16), len = rr(8, 14);
    const m = mesh(cyl1, metal, 2.3, len, 2.3, 0, y, 0); m.rotation.x = Math.PI / 2; g.add(m);
    g.add(new THREE.Mesh(bake([-1, 0, 1].map((i) => [cyl1, 2.5, 0.5, 2.5, 0, y, i * len * 0.35, Math.PI / 2])), metalDark));
    g.add(mesh(box1, glow, 4.7, 0.25, len * 0.8, 0, y, 0));
    g.add(mesh(box1, metalDark, 0.8, 60, 0.8, 0, y - 30, 0));
    g.userData.half = 2.5; g.userData.len = len;
  } else if (k < 0.55) { // antenna + dish
    const top = rr(6, 24);
    g.add(mesh(cyl1, metalDark, 0.3, top + 40, 0.3, 0, top - (top + 40) / 2, 0));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 8, 0, Math.PI * 2, 0, 1.0), lam(0xeeeeee, { side: THREE.DoubleSide })); dish.position.set(0, top - 3, 0); dish.rotation.z = 0.9; g.add(dish);
    g.add(mesh(sph1, blinkMat, 0.4, 0.4, 0.4, 0, top + 0.3, 0));
    g.userData.half = 2.5; g.userData.len = 3;
  } else if (k < 0.75) { // solar panels
    const y = rr(0, 14);
    g.add(mesh(box1, metalDark, 0.5, 60, 0.5, 0, y - 30, 0));
    ad(g, mesh(box1, panelMat, 9, 0.2, 3.5, 0, y, 0)).rotation.x = 0.4;
    ad(g, mesh(box1, panelMat, 9, 0.2, 3.5, 0, y + 4, 0)).rotation.x = 0.4;
    g.add(mesh(box1, metalDark, 0.3, 4, 0.3, 0, y + 2, 0));
    g.userData.half = 4.5; g.userData.len = 4;
  } else if (k < 0.88) { // glass dome
    const r = rr(4, 7), top = rr(-6, 4);
    g.add(mesh(box1, metalDark, r * 2.2, 60, r * 2.2, 0, top - 30, 0));
    g.add(mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x8af0ff, { transparent: true, opacity: 0.45, emissive: 0x114466 }), r, r * 0.8, r, 0, top, 0));
    g.add(mesh(cyl1, glowY, r * 1.02, 0.3, r * 1.02, 0, top + 0.1, 0));
    g.userData.half = r; g.userData.len = r * 2;
  } else { // floating space rock
    const s = rr(1.5, 3.5);
    g.add(mesh(new THREE.IcosahedronGeometry(1, 0), lam(0x8a8478, { flatShading: true }), s, s * 0.8, s, 0, rr(3, 18), 0));
    g.userData.half = s; g.userData.len = s * 2; g.userData.spin = true;
  }
  return g;
}
const BUILD = [cityItem, desertItem, candyItem, spaceItem];
const scen = BUILD.map((b) => { const a = []; for (let i = 0; i < 40; i++) { const o = b(); o.visible = false; o.userData.busy = false; track.add(o); a.push(o); } return a; });
const scenLive = [];
const nextSide = [-1e9, -1e9];
function placeScenery(o, side, z) {
  o.visible = true; o.userData.busy = true; o.userData.z = z;
  const off = 5.6 + o.userData.half + R() * 14, near = 1 - Math.min(1, (off - o.userData.half - 5.6) / 12);
  o.position.set(side * off, -near * near * 16, -z); // (things right next to the track sit lower, so it feels like a rooftop)
  o.rotation.y = R() < 0.5 ? 0 : (R() - 0.5) * 0.3;
  o.traverse((c) => { if (c.userData.face) c.rotation.y = -side * Math.PI / 2; if (c.userData.faceX) c.rotation.z = side * Math.PI / 2; });
  // (in the desert, plain rock spires sometimes get their cactus)
  scenLive.push(o);
}
function updateScenery(d, back, ahead) {
  for (let i = scenLive.length - 1; i >= 0; i--) { const o = scenLive[i]; if (o.userData.z < d - back - 20 || o.userData.z > d + ahead + 40) { o.visible = false; o.userData.busy = false; scenLive.splice(i, 1); } }
  for (let s = 0; s < 2; s++) {
    if (nextSide[s] < d - back) nextSide[s] = d - back;
    while (nextSide[s] < d + ahead) {
      const z = nextSide[s], pool = scen[themeAt(z)];
      const free = pool.filter((o) => !o.userData.busy);
      if (!free.length) { nextSide[s] += 6; continue; }
      const o = pick(free); placeScenery(o, s ? 1 : -1, z + o.userData.len / 2);
      nextSide[s] += o.userData.len + rr(3, 10);
    }
  }
  for (const o of scenLive) if (o.userData.spin) o.rotation.y += 0.01;
}

// ------------------------------------------------------------------ obstacles
const stripes = (a, b) => ctex(128, 32, (g) => { g.fillStyle = a; g.fillRect(0, 0, 128, 32); g.fillStyle = b; for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); } });
const barrierMat = lam(0xffffff, { map: stripes("#ffe14a", "#1a1a2a"), emissive: 0x332200 });
const postMat = lam(0xe8e8f0), lightMat = basic(0xff3a3a);
const slideTex = ctex(128, 192, (g) => {
  g.fillStyle = "#ff2a6a"; g.fillRect(0, 0, 128, 192);
  g.fillStyle = "#ffffff"; g.font = "bold 30px 'Russo One', Impact, sans-serif"; g.textAlign = "center"; g.fillText("SLIDE", 64, 42);
  g.lineWidth = 12; g.strokeStyle = "#fff"; g.lineJoin = "round";
  for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(30, 80 + i * 44); g.lineTo(64, 110 + i * 44); g.lineTo(98, 80 + i * 44); g.stroke(); }
  g.strokeStyle = "#ffe14a"; g.lineWidth = 8; g.strokeRect(4, 4, 120, 184);
});
const slideMat = lam(0xffffff, { map: slideTex, emissive: 0xffffff, emissiveMap: slideTex, emissiveIntensity: 0.35 });
function makeBarrier() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(bake([[box1, 2.15, 0.5, 0.22, 0, 0.72, 0], [box1, 2.15, 0.22, 0.22, 0, 0.25, 0]]), barrierMat));
  g.add(new THREE.Mesh(bake([-1, 1].flatMap((s) => [[box1, 0.14, 1.0, 0.14, s * 0.98, 0.5, 0], [box1, 0.5, 0.08, 0.5, s * 0.98, 0.04, 0]])), postMat));
  g.add(new THREE.Mesh(bake([-1, 1].map((s) => [sph1, 0.12, 0.12, 0.12, s * 0.98, 1.05, 0])), lightMat));
  g.userData.look = "barrier"; return g;
}
function makeBar() {
  const g = new THREE.Group(), mid = (BAR_LOW + BAR_TOP) / 2, h = BAR_TOP - BAR_LOW;
  g.add(new THREE.Mesh(bake([-1, 1].map((s) => [box1, 0.22, BAR_TOP + 0.3, 0.22, s * 1.08, (BAR_TOP + 0.3) / 2, 0])), postMat));
  g.add(mesh(box1, slideMat, 2.1, h, 0.2, 0, mid, 0));
  g.add(mesh(box1, basic(0xffe14a), 2.2, 0.12, 0.26, 0, BAR_LOW + 0.04, 0));
  g.userData.look = "bar"; return g;
}
function trainMats(t) {
  const [body, stripe, dark] = t.train;
  const side = ctex(256, 96, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 256, 96);
    g.fillStyle = dark; for (let x = 12; x < 256; x += 48) g.fillRect(x, 16, 34, 30);
    g.fillStyle = "rgba(255,255,255,0.35)"; for (let x = 12; x < 256; x += 48) g.fillRect(x + 4, 19, 8, 24);
    g.fillStyle = stripe; g.fillRect(0, 58, 256, 10); g.fillRect(0, 84, 256, 6);
  });
  const front = ctex(96, 96, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 96, 96);
    g.fillStyle = dark; g.fillRect(10, 10, 76, 36); g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(14, 13, 18, 30);
    g.fillStyle = stripe; g.fillRect(0, 58, 96, 8);
    g.fillStyle = "#fff8c0"; g.shadowColor = "#fff8c0"; g.shadowBlur = 10; g.beginPath(); g.arc(20, 78, 8, 0, 7); g.arc(76, 78, 8, 0, 7); g.fill();
  });
  const s = lam(0xffffff, { map: side }), f = lam(0xffffff, { map: front, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.25 }), top = lam(new THREE.Color(body).multiplyScalar(0.8));
  return [s, top, f];
}
const TRAIN_MATS = THEMES.map(trainMats);
const RAMP_MATS = THEMES.map((t) => lam(t.ramp, { map: ctex(64, 64, (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "rgba(255,240,120,0.95)"; g.lineWidth = 7; g.beginPath(); g.moveTo(12, 44); g.lineTo(32, 20); g.lineTo(52, 44); g.stroke(); }) }));
for (const m of RAMP_MATS) { m.map.repeat.set(1, 3); }
const carGeo = new THREE.BoxGeometry(2.3, 2.9, 7.7).translate(0, TRAIN_TOP - 1.45, 0);
carGeo.clearGroups(); carGeo.addGroup(0, 12, 0); carGeo.addGroup(12, 12, 1); carGeo.addGroup(24, 12, 2); // (sides, top+bottom, front+back)
const roofGeo = new THREE.BoxGeometry(2.0, 0.16, 7.2).translate(0, TRAIN_TOP - 0.08, 0);
const wheelGeo = new THREE.BoxGeometry(2.1, 0.3, 6.6).translate(0, 0.15, 0);
function makeCar() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(carGeo, TRAIN_MATS[0]); g.add(b); g.userData.body = b;
  g.add(new THREE.Mesh(wheelGeo, lam(0x22222a)));
  g.userData.look = "car"; return g;
}
const rampShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(8, 0), new THREE.Vector2(8, TRAIN_TOP), new THREE.Vector2(0, 0)]);
const rampGeo = new THREE.ExtrudeGeometry(rampShape, { depth: 2.2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-1.1, 0, 0);
{ // uvs: map the slope nicely (u across, v along)
  const p = rampGeo.attributes.position, uv = rampGeo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.1) / 2.2, -p.getZ(i) / 8);
}
function makeRamp() {
  const g = new THREE.Group(); const m = new THREE.Mesh(rampGeo, RAMP_MATS[0]); g.add(m); g.userData.body = m;
  const s = Math.atan2(TRAIN_TOP, 8), L = Math.hypot(8, TRAIN_TOP);
  for (const x of [-1.12, 1.12]) { const e = mesh(box1, basic(0xffe14a), 0.12, 0.12, L, x, TRAIN_TOP / 2, -4); e.rotation.x = s; g.add(e); }
  g.userData.look = "ramp"; return g;
}
const crateTex = ctex(64, 64, (g) => { g.fillStyle = "#1a8a8a"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "#5affea"; g.lineWidth = 5; g.strokeRect(3, 3, 58, 58); g.beginPath(); g.moveTo(6, 6); g.lineTo(58, 58); g.moveTo(58, 6); g.lineTo(6, 58); g.stroke(); });
const crateMats = [lam(0xffffff, { map: crateTex, emissive: 0x0a3030 }), lam(0xffcf8a, { map: crateTex, emissive: 0x302010 })];
function makeCrate() {
  const g = new THREE.Group();
  g.add(mesh(box1, crateMats[0], 2.1, 1.1, 2, 0, 0.55, -1));
  ad(g, mesh(box1, crateMats[1], 1.9, 1.1, 1.8, 0.05, 1.65, -1)).rotation.y = 0.12;
  g.userData.look = "crate"; return g;
}
const headGlow = new THREE.SpriteMaterial({ map: dotTex, color: 0xfff6c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
function makeTruck() {
  const g = new THREE.Group();
  g.add(mesh(box1, lam(0xff3a3a), 2.3, 2.5, 3, 0, 1.45, -1.5));
  g.add(mesh(box1, lam(0x1a2030), 2.0, 0.9, 0.1, 0, 2.05, 0.02));
  g.add(mesh(box1, lam(0xffffff, { map: stripes("#e8ecf4", "#c8d0dc") }), 2.4, 2.8, 9, 0, 1.6 + 0.0, -7.6));
  g.add(mesh(box1, lam(0x22222a), 2.2, 0.4, 11.5, 0, 0.2, -6));
  for (const x of [-0.75, 0.75]) { g.add(mesh(box1, basic(0xfff6c0), 0.45, 0.3, 0.05, x, 0.75, 0.03)); const s = new THREE.Sprite(headGlow); s.scale.set(2.2, 2.2, 1); s.position.set(x, 0.75, 0.4); g.add(s); }
  const siren = mesh(box1, basic(0xffaa00), 1.2, 0.2, 0.4, 0, 2.8, -1.5); g.add(siren);
  g.userData.look = "truck"; return g;
}
const lipMat = lam(0xffffff, { map: stripes("#ffe14a", "#ff2a4a"), emissive: 0xffffff, emissiveMap: stripes("#ffe14a", "#ff2a4a"), emissiveIntensity: 0.5 });
lipMat.map.repeat.set(6, 1); lipMat.emissiveMap.repeat.set(6, 1);
function makeGap() {
  const g = new THREE.Group();
  g.add(mesh(box1, lipMat, 7.62, 0.22, 0.6, 0, 0.06, 0.3));
  g.add(mesh(box1, lipMat, 7.62, 0.22, 0.6, 0, 0.06, -4.3));
  g.add(mesh(box1, basic(0x05010c), 7.0, 0.1, 4, 0, -14, -2)); // (dark down there)
  g.userData.look = "gap"; return g;
}
const POOLS = { barrier: [], bar: [], car: [], ramp: [], crate: [], truck: [], gap: [] };
const MAKERS = { barrier: makeBarrier, bar: makeBar, car: makeCar, ramp: makeRamp, crate: makeCrate, truck: makeTruck, gap: makeGap };
function take(kind) {
  let o = POOLS[kind].find((m) => !m.userData.busy);
  if (!o) { o = MAKERS[kind](); POOLS[kind].push(o); track.add(o); }
  o.userData.busy = true; o.visible = true; o.scale.set(1, 1, 1); o.rotation.set(0, 0, 0);
  return o;
}
function give(o) { o.userData.busy = false; o.visible = false; }
for (const [k, n] of [["gap", 3], ["barrier", 14], ["bar", 10], ["car", 40], ["ramp", 8], ["crate", 18], ["truck", 4]]) for (let i = 0; i < n; i++) give(take(k));
const live = new Set();
function bind(o, d) {
  const th = themeAt(o.z0);
  o.meshes = [];
  if (o.kind === "box" && o.look === "train") {
    for (let i = 0; i < o.cars; i++) { const c = take("car"); c.userData.body.material = TRAIN_MATS[th]; c.position.set(LANES[o.lane], 0, -(o.z0 + 4 + i * 8)); o.meshes.push(c); }
  } else if (o.kind === "box" && o.look === "crate") { const c = take("crate"); c.position.set(LANES[o.lane], 0, -o.z0); o.meshes.push(c); }
  else if (o.kind === "box" && o.look === "barrier") { const c = take("barrier"); c.position.set(LANES[o.lane], 0, -(o.z0 + 0.25)); o.meshes.push(c); }
  else if (o.kind === "box" && o.look === "truck") { const c = take("truck"); o.meshes.push(c); }
  else if (o.kind === "gap") { const c = take("gap"); c.position.set(0, 0, -o.z0); o.meshes.push(c); }
  else if (o.kind === "bar") { const c = take("bar"); c.position.set(LANES[o.lane], 0, -(o.z0 + 0.3)); o.meshes.push(c); }
  else if (o.kind === "ramp") { const c = take("ramp"); c.userData.body.material = RAMP_MATS[th]; c.position.set(LANES[o.lane], 0, -o.z0); o.meshes.push(c); }
  live.add(o);
}
function unbind(o) { for (const m of o.meshes || []) give(m); o.meshes = null; live.delete(o); }
export const truckFront = (o, d) => o.meet + Math.min(o.park, o.meet - d) * o.k;
function updateObstacles(sim, d, back, ahead) {
  for (const o of live) if (o.z1 < d - back - 15 || o.z0 > d + ahead + 30 || (o.dead && !o.smashT)) unbind(o);
  for (const o of sim.gen.objs) {
    if (o.z0 > d + ahead) break;
    if (o.meshes || o.dead || o.z1 < d - back - 10) continue;
    bind(o, d);
  }
  for (const o of live) {
    if (o.look === "truck") {
      const f = truckFront(o, d), m = o.meshes[0];
      m.position.set(LANES[o.lane], 0, -f);
      m.children[m.children.length - 1].material.color.setHex(Math.floor(performance.now() / 180) % 2 ? 0xffaa00 : 0xff3a1a);
    }
    if (o.dead && o.smashT) {
      o.smashT -= 1 / 60;
      for (const m of o.meshes) { m.scale.setScalar(Math.max(0.01, o.smashT * 3)); m.rotation.y += 0.3; m.position.y += 0.15; }
      if (o.smashT <= 0) { o.smashT = 0; unbind(o); }
    }
  }
}
export function smash(o) { if (o) o.smashT = 0.35; }

// ------------------------------------------------------------------ coins and power-ups
const coinTex = ctex(64, 64, (g) => { g.fillStyle = "#ffcf2a"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#ffe98a"; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 9 : 22; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); g.strokeStyle = "#e09a00"; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.stroke(); });
const coinGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.13, 20).rotateX(Math.PI / 2);
{ const gr = coinGeo.groups; const side = gr[0].count, caps = gr[1].count + gr[2].count; coinGeo.clearGroups(); coinGeo.addGroup(0, side, 0); coinGeo.addGroup(side, caps, 1); }
const coinMat = [lam(0xffb81a, { emissive: 0x7a4a00 }), lam(0xffffff, { map: coinTex, emissive: 0x6a4a00 })];
const COINS_MAX = 700;
const coins = new THREE.InstancedMesh(coinGeo, coinMat, COINS_MAX); coins.frustumCulled = false; coins.count = 0; track.add(coins);
const dummy = new THREE.Object3D();
let coinSpin = 0;
function updateCoins(sim, d, back, ahead, dt) {
  coinSpin += dt * 3.2;
  let n = 0;
  const add = (c) => {
    if (c.got || n >= COINS_MAX || c.z < d - back || c.z > d + ahead) return;
    dummy.position.set(c.x, c.y + (c.fly ? 0 : Math.sin(coinSpin * 1.3 + c.z * 0.4) * 0.08), -c.z);
    dummy.rotation.set(0, coinSpin + c.z * 0.25, 0); dummy.scale.setScalar(c.fly ? 0.8 : 1); dummy.updateMatrix();
    coins.setMatrixAt(n++, dummy.matrix);
  };
  const C = sim.gen.coins; for (let i = 0; i < C.length; i++) { if (C[i].z > d + ahead) break; add(C[i]); }
  for (const c of sim.air) add(c);
  coins.count = n; coins.instanceMatrix.needsUpdate = true;
}
const PCOL = { magnet: "#ff3a4a", shield: "#3a9aff", jetpack: "#ff8a1a", x2: "#b05aff", sneakers: "#2ad86a" };
export const POWER_NAMES = { magnet: "COIN MAGNET", shield: "SHIELD", jetpack: "JETPACK", x2: "2X SCORE", sneakers: "SUPER SNEAKERS" };
function drawIcon(g, type, s = 128) {
  const k = s / 128; g.save(); g.scale(k, k);
  const r = g.createRadialGradient(64, 54, 10, 64, 64, 62); r.addColorStop(0, "#ffffff"); r.addColorStop(0.25, PCOL[type]); r.addColorStop(1, "#1a1030");
  g.fillStyle = r; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = "#fff"; g.stroke();
  g.lineJoin = "round"; g.lineCap = "round";
  if (type === "magnet") {
    g.lineWidth = 22; g.strokeStyle = "#ff2a3a"; g.beginPath(); g.arc(64, 60, 24, Math.PI, 0, true); g.stroke();
    g.beginPath(); g.moveTo(40, 60); g.lineTo(40, 40); g.moveTo(88, 60); g.lineTo(88, 40); g.stroke();
    g.strokeStyle = "#e8eef8"; g.beginPath(); g.moveTo(40, 40); g.lineTo(40, 30); g.moveTo(88, 40); g.lineTo(88, 30); g.stroke();
  } else if (type === "shield") {
    g.fillStyle = "#e8f4ff"; g.beginPath(); g.moveTo(64, 22); g.lineTo(98, 34); g.quadraticCurveTo(98, 84, 64, 104); g.quadraticCurveTo(30, 84, 30, 34); g.closePath(); g.fill();
    g.fillStyle = "#3a8aff"; g.beginPath(); g.moveTo(64, 32); g.lineTo(88, 41); g.quadraticCurveTo(88, 78, 64, 93); g.closePath(); g.fill();
  } else if (type === "jetpack") {
    g.fillStyle = "#ffcf3a"; g.beginPath(); g.moveTo(52, 86); g.lineTo(64, 112); g.lineTo(76, 86); g.fill();
    g.fillStyle = "#e8eef8"; g.beginPath(); g.ellipse(64, 56, 16, 34, 0, 0, 7); g.fill();
    g.fillStyle = "#ff3a3a"; g.beginPath(); g.moveTo(48, 70); g.lineTo(36, 92); g.lineTo(52, 84); g.fill(); g.beginPath(); g.moveTo(80, 70); g.lineTo(92, 92); g.lineTo(76, 84); g.fill();
    g.fillStyle = "#3ab8ff"; g.beginPath(); g.arc(64, 50, 7, 0, 7); g.fill();
  } else if (type === "x2") {
    g.fillStyle = "#fff"; g.font = "bold 60px 'Russo One', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 8; g.strokeStyle = "#3a1060"; g.strokeText("2x", 64, 68); g.fillText("2x", 64, 68);
  } else {
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(28, 84); g.lineTo(30, 56); g.lineTo(54, 56); g.quadraticCurveTo(64, 74, 100, 76); g.quadraticCurveTo(108, 84, 100, 92); g.lineTo(30, 92); g.closePath(); g.fill();
    g.fillStyle = "#2ad86a"; g.fillRect(28, 86, 74, 7);
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(34, 54); g.quadraticCurveTo(28, 30, 48, 24); g.quadraticCurveTo(44, 40, 52, 54); g.fill();
  }
  g.restore();
}
export const ICON_URL = {};
const ICON_TEX = {};
for (const t of Object.keys(PCOL)) {
  const c = document.createElement("canvas"); c.width = c.height = 128; drawIcon(c.getContext("2d"), t);
  ICON_URL[t] = c.toDataURL(); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; ICON_TEX[t] = tx;
}
const powerPool = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON_TEX.magnet, transparent: true })); s.scale.set(1.5, 1.5, 1); g.add(s);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })); halo.scale.set(3.2, 3.2, 1); g.add(halo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 6, 28), basic(0xffffff)); g.add(ring);
  g.userData.s = s; g.userData.halo = halo; g.userData.ring = ring; g.visible = false; track.add(g); powerPool.push(g);
}
function updatePowers(sim, d, back, ahead, t) {
  let n = 0;
  for (const p of sim.gen.powers) {
    if (p.got || p.z < d - back || p.z > d + ahead || n >= powerPool.length) continue;
    const g = powerPool[n++]; g.visible = true;
    g.position.set(p.x, p.y + 0.3 + Math.sin(t * 3) * 0.2, -p.z);
    g.userData.s.material.map = ICON_TEX[p.type]; g.userData.halo.material.color.set(PCOL[p.type]);
    g.userData.ring.rotation.set(t * 2, t * 3, 0); g.userData.ring.material.color.set(PCOL[p.type]);
  }
  for (; n < powerPool.length; n++) powerPool[n].visible = false;
}

// ------------------------------------------------------------------ the runner (blocky cartoon kid)
function part(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; }
export function makeRunner() {
  const M = { skin: lam(0xffc999), shirt: lam(0xff7a1a), pants: lam(0x2a4bd6), shoes: lam(0xffffff, { emissive: 0x000000 }), hair: lam(0x5a3a1a), hat: lam(0x18c8ff), eye: basic(0xffffff), pupil: basic(0x111111), dark: lam(0x222230) };
  const g = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  const upper = new THREE.Group(); hips.add(upper);
  upper.add(part(box1, M.shirt, 0, 0.42, 0, 0.78, 0.8, 0.46));
  upper.add(part(box1, M.dark, 0, 0.05, 0, 0.8, 0.12, 0.48)); // belt
  const head = new THREE.Group(); head.position.y = 1.17; upper.add(head);
  head.add(part(box1, M.skin, 0, 0, 0, 0.64, 0.6, 0.58));
  for (const s of [-1, 1]) { head.add(part(box1, M.eye, s * 0.14, 0.05, -0.295, 0.14, 0.17, 0.02)); head.add(part(box1, M.pupil, s * 0.14 + 0.02, 0.03, -0.305, 0.07, 0.1, 0.02)); }
  head.add(part(box1, M.dark, 0, -0.15, -0.295, 0.22, 0.05, 0.02)); for (const s of [-1, 1]) head.add(part(box1, M.dark, s * 0.12, -0.12, -0.295, 0.05, 0.07, 0.02)); // (a smile)
  const hair = part(box1, M.hair, 0, 0.27, 0.04, 0.68, 0.16, 0.64); head.add(hair);
  head.add(part(box1, M.hair, 0, 0.08, 0.3, 0.68, 0.4, 0.06));
  const hats = new THREE.Group(); head.add(hats);
  const HATS = {
    cap: (() => { const h = new THREE.Group(); h.add(part(box1, M.hat, 0, 0.36, 0.02, 0.7, 0.18, 0.66)); h.add(part(box1, M.hat, 0, 0.3, -0.42, 0.62, 0.06, 0.32)); return h; })(),
    band: (() => { const h = new THREE.Group(); h.add(part(box1, M.hat, 0, 0.2, 0, 0.7, 0.1, 0.64)); h.add(part(box1, M.hat, 0.2, 0.18, 0.36, 0.12, 0.08, 0.2)); return h; })(),
    spikes: (() => { const h = new THREE.Group(); const c = new THREE.ConeGeometry(0.1, 0.32, 5); for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(c, M.hat); m.position.set(-0.25 + i * 0.1, 0.45, 0.05 + (i % 2) * 0.12); m.rotation.x = 0.4; h.add(m); } return h; })(),
    beanie: (() => { const h = new THREE.Group(); h.add(part(new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hat, 0, 0.22, 0.02, 1, 0.75, 0.96)); h.add(part(sph1, M.eye, 0, 0.55, 0.02, 0.1, 0.1, 0.1)); return h; })(),
    antenna: (() => { const h = new THREE.Group(); h.add(part(box1, M.dark, 0, 0.5, 0, 0.05, 0.4, 0.05)); h.add(part(sph1, M.hat, 0, 0.72, 0, 0.1, 0.1, 0.1)); return h; })(),
    crown: (() => { const h = new THREE.Group(); h.add(part(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10, 1, true), lam(0xffd23a, { side: THREE.DoubleSide, emissive: 0x553300 }), 0, 0.42, 0)); const c = new THREE.ConeGeometry(0.07, 0.16, 4); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const m = new THREE.Mesh(c, lam(0xffd23a, { emissive: 0x553300 })); m.position.set(Math.cos(a) * 0.32, 0.58, Math.sin(a) * 0.32); h.add(m); } h.add(part(sph1, basic(0xff3a6a), 0, 0.44, -0.34, 0.06, 0.06, 0.06)); return h; })(),
  };
  for (const k in HATS) { HATS[k].visible = false; hats.add(HATS[k]); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.5, 0.72, 0); upper.add(a);
    a.add(part(box1, M.shirt, 0, -0.16, 0, 0.26, 0.36, 0.28)); a.add(part(box1, M.skin, 0, -0.5, 0, 0.22, 0.36, 0.24));
    arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.2, 0, 0); hips.add(l);
    l.add(part(box1, M.pants, 0, -0.4, 0, 0.3, 0.8, 0.32)); l.add(part(box1, M.shoes, 0, -0.86, -0.08, 0.34, 0.2, 0.5));
    legs.push(l);
  }
  // jetpack on the back
  const jet = new THREE.Group(); jet.position.set(0, 0.45, 0.36); upper.add(jet);
  const flames = [];
  for (const s of [-1, 1]) {
    jet.add(part(cyl1, lam(0xdfe6ee), s * 0.2, 0, 0, 0.17, 0.7, 0.17)); jet.add(part(new THREE.ConeGeometry(0.17, 0.25, 10), lam(0xff3a3a), s * 0.2, 0.47, 0));
    const f = new THREE.Group(); f.position.set(s * 0.2, -0.38, 0); jet.add(f);
    const fo = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10), basic(0xff8a1a, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); fo.rotation.x = Math.PI; fo.position.y = -0.4; f.add(fo);
    const fi = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), basic(0xfff2a0, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fi.rotation.x = Math.PI; fi.position.y = -0.22; f.add(fi);
    flames.push(f);
  }
  jet.visible = false;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: dotTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2;
  const bubble = new THREE.Group();
  bubble.add(new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), basic(0x5ac8ff, { transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })));
  bubble.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.42, 1), basic(0x8ae8ff, { wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
  bubble.position.y = 1.05; bubble.visible = false; g.add(bubble);
  const R = { g, hips, upper, head, arms, legs, jet, flames, M, HATS, shadow, bubble, phase: 0, lean: 0, hair };
  return R;
}
export function styleRunner(Rn, st) {
  const M = Rn.M;
  M.skin.color.setHex(st.skin); M.shirt.color.setHex(st.shirt); M.pants.color.setHex(st.pants); M.shoes.color.setHex(st.shoes); M.hair.color.setHex(st.hair); M.hat.color.setHex(st.hatColor);
  M.eye.color.setHex(st.eyes || 0xffffff); M.pupil.color.setHex(st.eyes ? 0x003a44 : 0x111111);
  for (const k in Rn.HATS) Rn.HATS[k].visible = k === st.hat;
  Rn.hair.visible = st.hat !== "antenna";
}
// pose: { run, air, vy, slide, stumble, jet, dead, lean, speed }
export function poseRunner(Rn, p, dt) {
  Rn.phase += dt * (p.speed || 14) * 0.62;
  const ph = Rn.phase, L = Rn.legs, A = Rn.arms;
  let hipsY = 0.95 + Math.abs(Math.sin(ph)) * 0.08, upX = -0.12, upZ = 0, l0 = Math.sin(ph) * 1.0, l1 = -Math.sin(ph) * 1.0, a0 = -Math.sin(ph) * 0.95, a1 = Math.sin(ph) * 0.95, az0 = 0.1, az1 = -0.1, gx = 0, headX = 0;
  if (p.idle) { hipsY = 0.95 + Math.sin(ph * 0.3) * 0.02; upX = 0; l0 = l1 = 0; a0 = -0.15 + Math.sin(ph * 0.3) * 0.05; a1 = 0.15; az0 = 0.15; az1 = -0.15; }
  if (p.air) { const k = Math.max(-1, Math.min(1, p.vy / 15)); l0 = 1.2; l1 = 0.25 - k * 0.3; a0 = 2.6 - k * 0.4; a1 = 2.2 - k * 0.3; az0 = 0.5; az1 = -0.5; upX = -0.05; hipsY = 0.95; }
  if (p.slide) { hipsY = 0.42; upX = 1.15; l0 = 1.35; l1 = 1.2; a0 = 0.6; a1 = -0.3; az0 = 0.6; az1 = -0.6; headX = -0.7; }
  if (p.jet) { upX = -0.45; l0 = 0.2 + Math.sin(ph * 0.5) * 0.15; l1 = -0.15 - Math.sin(ph * 0.5) * 0.15; a0 = 2.9; a1 = 0.5; az0 = 0.2; az1 = -0.4; hipsY = 0.95; }
  if (p.stumble > 0) { upZ = Math.sin(p.stumble * 40) * 0.35; a0 = 2.5 + Math.sin(p.stumble * 50); a1 = 2.5 - Math.sin(p.stumble * 50); az0 = 1.0; az1 = -1.0; }
  if (p.dead) { gx = 1.4; a0 = 2.8; a1 = 2.8; az0 = 1.1; az1 = -1.1; l0 = 0.5; l1 = -0.2; upX = 0; hipsY = 0.95; }
  const k = Math.min(1, dt * 18);
  const lerp = (a, b) => a + (b - a) * k;
  Rn.hips.position.y = lerp(Rn.hips.position.y, hipsY);
  Rn.upper.rotation.x = lerp(Rn.upper.rotation.x, upX); Rn.upper.rotation.z = lerp(Rn.upper.rotation.z, upZ);
  Rn.head.rotation.x = lerp(Rn.head.rotation.x, headX);
  L[0].rotation.x = lerp(L[0].rotation.x, l0); L[1].rotation.x = lerp(L[1].rotation.x, l1);
  A[0].rotation.x = lerp(A[0].rotation.x, a0); A[1].rotation.x = lerp(A[1].rotation.x, a1);
  A[0].rotation.z = lerp(A[0].rotation.z, -az0); A[1].rotation.z = lerp(A[1].rotation.z, -az1);
  Rn.g.rotation.x = lerp(Rn.g.rotation.x, gx);
  Rn.g.rotation.z = lerp(Rn.g.rotation.z, -(p.lean || 0) * 0.05);
  Rn.g.rotation.y = lerp(Rn.g.rotation.y, (p.lean || 0) * 0.04);
  Rn.jet.visible = !!p.jet || !!p.jetShow;
  for (const f of Rn.flames) { const s = 0.8 + Math.random() * 0.5; f.scale.set(s, s * (1 + Math.random() * 0.4), s); }
}

// ------------------------------------------------------------------ Bolt the security robot (goofy chaser)
function makeRobot() {
  const g = new THREE.Group();
  const body = lam(0xc8d0dc), dark = lam(0x3a4252);
  g.add(part(sph1, body, 0, 1.3, 0, 0.8, 0.75, 0.7));
  g.add(part(box1, basic(0x1a2a6a), 0, 1.3, -0.62, 0.7, 0.35, 0.1));
  g.add(part(box1, basic(0xffe14a), 0, 1.32, -0.67, 0.5, 0.1, 0.02));
  g.add(part(box1, basic(0xffe14a), 0, 1.45, 0.66, 0.9, 0.16, 0.05)); g.add(part(box1, basic(0x1a2a6a), 0, 1.15, 0.66, 0.6, 0.22, 0.05)); // (back: SECURITY stripe)
  const head = new THREE.Group(); head.position.y = 2.1; g.add(head);
  head.add(part(sph1, body, 0, 0, 0, 0.55, 0.45, 0.5));
  const sirenR = part(cyl1, basic(0xff2a2a), -0.15, 0.48, 0, 0.13, 0.25, 0.13), sirenB = part(cyl1, basic(0x2a6aff), 0.15, 0.48, 0, 0.13, 0.25, 0.13);
  head.add(sirenR); head.add(sirenB);
  const pupils = [];
  for (const s of [-1, 1]) { head.add(part(sph1, basic(0xffffff), s * 0.2, 0.05, -0.38, 0.2, 0.22, 0.12)); const p = part(sph1, basic(0x111111), s * 0.2, 0.05, -0.49, 0.09, 0.09, 0.05); head.add(p); pupils.push(p); }
  head.add(part(box1, dark, 0, -0.2, -0.45, 0.3, 0.06, 0.05));
  const arms = [];
  for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.8, 1.5, 0); a.add(part(cyl1, dark, 0, -0.45, 0, 0.1, 0.9, 0.1)); a.add(part(sph1, lam(0xff8a1a), 0, -0.95, 0, 0.2, 0.2, 0.2)); g.add(a); arms.push(a); }
  g.add(part(cyl1, dark, 0, 0.5, 0, 0.12, 0.7, 0.12));
  const wheel = part(new THREE.TorusGeometry(0.35, 0.12, 8, 16), lam(0x222222), 0, 0.35, 0); wheel.rotation.y = Math.PI / 2; g.add(wheel);
  g.userData = { head, sirenR, sirenB, pupils, arms, wheel };
  return g;
}
const robot = makeRobot(); robot.visible = false; robot.scale.setScalar(0.72); scene.add(robot);
const robotState = { z: 14, show: 0 };

// ------------------------------------------------------------------ particles, trail, speed lines
const parts = [];
for (let i = 0; i < 160; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); parts.push({ s, life: 0, max: 1, v: V3(), stick: false, grow: 0, size: 1 }); }
let pi = 0;
export function spawn(x, y, z, vx, vy, vz, color, life, size, opt = {}) {
  const p = parts[pi = (pi + 1) % parts.length];
  p.s.visible = true; p.s.position.set(x, y, z); p.v.set(vx, vy, vz); p.life = p.max = life; p.size = size; p.stick = !!opt.stick; p.grow = opt.grow || 0; p.grav = opt.grav || 0;
  p.s.material.map = opt.star ? starTex : dotTex; p.s.material.color.setHex(color); p.s.material.opacity = 1; p.s.scale.setScalar(size);
}
export function burst(x, y, z, color, n = 10, speed = 4, opt = {}) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * 2 - 1; spawn(x, y, z, Math.cos(a) * speed * (1 - b * b) ** 0.5, b * speed + (opt.up || 0), Math.sin(a) * speed * 0.6, opt.colors ? pick(opt.colors) : color, opt.life || 0.5, opt.size || 0.35, opt); }
}
function updateParticles(dt, speed) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.v.y -= p.grav * dt;
    p.s.position.addScaledVector(p.v, dt);
    if (p.stick) p.s.position.z += speed * dt;
    const k = p.life / p.max; p.s.material.opacity = k; p.s.scale.setScalar(p.size * (1 + p.grow * (1 - k)));
  }
}
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const lineGeo = new THREE.BoxGeometry(0.035, 0.035, 5);
const lines = [];
const lineIM = new THREE.InstancedMesh(lineGeo, lineMat, 44); lineIM.frustumCulled = false; lineIM.visible = false; scene.add(lineIM);
for (let i = 0; i < 44; i++) lines.push({ a: 0, r: 0, z: 0 });
function resetLine(l, first) { l.a = Math.random() * Math.PI * 2; l.r = 2.5 + Math.random() * 5; l.z = first ? -Math.random() * 60 : -60 - Math.random() * 10; }
lines.forEach((l) => resetLine(l, true));
function updateLines(dt, speed, k, cx, cy, cz) {
  lineMat.opacity = k * 0.55;
  lineIM.visible = k > 0.01;
  if (!lineIM.visible) return;
  lines.forEach((l, i) => {
    l.z += speed * 2.6 * dt; if (l.z > 6) resetLine(l, false);
    dummy.position.set(cx + Math.cos(l.a) * l.r * 1.3, cy + Math.sin(l.a) * l.r * 0.8, cz - 6 + l.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    lineIM.setMatrixAt(i, dummy.matrix);
  });
  lineIM.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ themes blending
const cA = new THREE.Color(), cB = new THREE.Color();
let themeW = [1, 0, 0, 0];
function blendTheme(d) {
  const cur = themeAt(d), B = (Math.floor(d / THEME_LEN) + 1) * THEME_LEN, nxt = (cur + 1) % 4;
  let t = (d - (B - 170)) / 190; t = Math.max(0, Math.min(1, t)); t = t * t * (3 - 2 * t);
  themeW = [0, 0, 0, 0]; themeW[cur] += 1 - t; themeW[nxt] += t;
  const a = THEMES[cur], b = THEMES[nxt];
  const mix = (ka, kb, out) => out.setHex(ka).lerp(cB.setHex(kb), t);
  mix(a.top, b.top, skyMat.uniforms.top.value); mix(a.mid, b.mid, skyMat.uniforms.mid.value); mix(a.bot, b.bot, skyMat.uniforms.bot.value); mix(a.low, b.low, skyMat.uniforms.low.value);
  mix(a.fog, b.fog, scene.fog.color);
  mix(a.hemi[0], b.hemi[0], hemi.color); mix(a.hemi[1], b.hemi[1], hemi.groundColor); hemi.intensity = a.hemi[2] + (b.hemi[2] - a.hemi[2]) * t;
  sun.intensity = a.sun + (b.sun - a.sun) * t;
  starMat.opacity = a.stars + (b.stars - a.stars) * t;
  farGroups.forEach((g, i) => { g.visible = themeW[i] > 0.01; for (const m of farMats[i]) m.opacity = (m.userData.base ?? 1) * themeW[i]; });
  return cur;
}

// ------------------------------------------------------------------ per frame
export const runner = makeRunner(); scene.add(runner.g); scene.add(runner.shadow);
let trailCols = [], trailT = 0;
export function setTrail(colors) { trailCols = colors || []; }
const cam = { x: 0, y: 4, z: 7, shake: 0, lookY: 1.5 };
export function shake(v) { cam.shake = Math.max(cam.shake, v); }
export function resetWorld() {
  for (const o of [...live]) unbind(o);
  for (const o of scenLive) { o.visible = false; o.userData.busy = false; } scenLive.length = 0;
  nextSide[0] = nextSide[1] = -1e9;
  for (const t of tiles) t.userData.idx = -999;
  robotState.show = 0; robotState.z = 14; robot.visible = false;
  for (const p of parts) { p.life = 0; p.s.visible = false; }
  cam.shake = 0;
}
function updateTiles(sim, d, back, ahead) {
  const i0 = Math.floor((d - back) / TL), i1 = Math.floor((d + ahead) / TL);
  const want = new Set(); for (let i = i0; i <= i1; i++) want.add(i);
  const have = new Set(), free = [];
  for (const t of tiles) { if (want.has(t.userData.idx)) have.add(t.userData.idx); else free.push(t); }
  for (let i = i0; i <= i1; i++) {
    if (have.has(i) || !free.length) continue;
    const t = free.pop(); t.userData.idx = i;
    const z = i * TL, th = themeAt(z + TL / 2);
    let geo = TILE_GEO[0], vis = true;
    for (const gp of gapsIn(sim, z, z + TL)) { const q = Math.round((gp.z0 - z) / 4); if (q >= 0 && q < 4) geo = TILE_GEO[q + 1]; }
    t.geometry = geo; t.material = TILE_MATS[th]; t.position.set(0, 0, -(z + TL / 2)); t.visible = vis;
  }
  for (const t of free) if (!want.has(t.userData.idx)) t.visible = false;
}
// opts: { back, ahead, menu, chase, t }
export function syncWorld(sim, dt, opts = {}) {
  const d = sim.d, back = opts.back ?? 12, ahead = opts.ahead ?? VIEW, speed = sim.alive && !opts.menu ? sim.speed : 0, t = opts.t || 0;
  track.position.z = d;
  const theme = blendTheme(d);
  updateTiles(sim, d, back, ahead);
  updateScenery(d, back, ahead);
  updateObstacles(sim, d, back, ahead);
  updateCoins(sim, d, back, ahead, dt);
  updatePowers(sim, d, back, ahead, t);
  blinkMat.color.setHex(Math.floor(t * 2) % 2 ? 0xff2a2a : 0x551010);
  // the runner
  const Rn = runner;
  Rn.g.position.set(sim.x, sim.y, 0);
  const lean = (LANES[sim.target] - sim.x);
  poseRunner(Rn, { idle: opts.menu, air: !sim.onGround && sim.pw.jetpack <= 0, vy: sim.vy, slide: sim.sliding, stumble: sim.stumbleT, jet: sim.pw.jetpack > 0, dead: !sim.alive && sim.cause !== "fell", lean, speed: speed || 6, jetShow: opts.jetShow }, dt);
  const fl = sim.floor === -Infinity ? -40 : sim.floor;
  Rn.shadow.position.set(sim.x, fl + 0.03, 0); Rn.shadow.material.opacity = Math.max(0, 0.45 - (sim.y - fl) * 0.06); Rn.shadow.visible = sim.floor !== -Infinity;
  Rn.bubble.visible = sim.pw.shield > 0 && (sim.pw.shield > 2 || Math.floor(t * 8) % 2 === 0);
  Rn.bubble.rotation.y += dt * 1.2; Rn.bubble.rotation.x += dt * 0.7;
  const blink = sim.invuln > 0 && sim.alive && Math.floor(t * 14) % 2 === 0;
  Rn.upper.visible = !blink;
  Rn.M.shoes.emissive.setHex(sim.pw.sneakers > 0 ? 0x22ff66 : 0x000000);
  // trail behind the feet
  trailT -= dt;
  if (trailCols.length && speed > 0 && trailT <= 0) {
    trailT = 0.04;
    const y = sim.y + (sim.pw.jetpack > 0 ? 0.2 : 0.12);
    spawn(sim.x + (Math.random() - 0.5) * 0.4, y, 0.4, 0, 0.3, 0, pick(trailCols), 0.45, 0.42, { stick: true, star: trailCols.length === 4 && Math.random() < 0.5 });
  }
  if (sim.pw.jetpack > 0 && speed > 0 && Math.random() < 0.5) spawn(sim.x + (Math.random() - 0.5) * 0.4, sim.y + 0.5, 0.75, 0, -5, 1, pick([0xff6a1a, 0xffa21a, 0x888888]), 0.3, 0.32, { stick: true, grow: 1 });
  if (sim.pw.magnet > 0 && Math.random() < 0.3) spawn(sim.x + (Math.random() - 0.5) * 3, sim.y + 1 + (Math.random() - 0.5) * 2, -2 - Math.random() * 6, 0, 0, 6, 0xff5a6a, 0.3, 0.2);
  // Bolt the robot
  const R2 = robotState, chasing = (sim.chaseT > 0 && sim.alive) || (!sim.alive && sim.cause === "caught");
  R2.show += ((chasing ? 1 : 0) - R2.show) * Math.min(1, dt * 4);
  robot.visible = R2.show > 0.02;
  if (robot.visible) {
    const tz = !sim.alive && sim.cause === "caught" ? 0.8 : 1.9;
    R2.z += ((chasing ? tz : 14) - R2.z) * Math.min(1, dt * 4);
    robot.position.set(sim.x + (sim.alive ? (sim.x > 0.5 ? -1.25 : 1.25) : 0.6), Math.max(0, sim.floor === -Infinity ? 0 : sim.floor) + Math.abs(Math.sin(t * 12)) * 0.12, R2.z);
    robot.rotation.y = Math.sin(t * 6) * 0.15;
    const u = robot.userData;
    u.arms[0].rotation.x = 2.6 + Math.sin(t * 14) * 0.6; u.arms[1].rotation.x = 2.6 - Math.sin(t * 14) * 0.6;
    u.sirenR.material.color.setHex(Math.floor(t * 8) % 2 ? 0xff2a2a : 0x550000); u.sirenB.material.color.setHex(Math.floor(t * 8) % 2 ? 0x110a44 : 0x3a7aff);
    for (const p of u.pupils) { p.position.x = Math.sign(p.position.x) * 0.2 + Math.sin(t * 23 + p.position.x * 9) * 0.06; p.position.y = 0.05 + Math.cos(t * 19) * 0.05; }
    u.wheel.rotation.x += dt * 20;
  }
  updateParticles(dt, speed);
  // camera
  const jet = sim.pw.jetpack > 0;
  const hEff = jet ? sim.y : Math.max(0, sim.floor === -Infinity ? 0 : Math.min(sim.y, sim.floor + 2.5));
  let tx = sim.x * 0.72, ty = (portrait ? 5.4 : 4.3) + hEff * 0.85 + (jet ? 0.6 : 0), tz = portrait ? 8.6 : 7.2;
  if (!sim.alive && sim.cause === "fell") ty = 3 + Math.max(sim.y, -8) * 0.3;
  if (opts.menu) { const a = Math.sin(t * 0.22) * 0.35 + 0.45; tx = sim.x + Math.sin(a) * 6.2; ty = 2.3; tz = -Math.cos(a) * 6.2; }
  const k = opts.snap ? 1 : Math.min(1, dt * 7);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * Math.min(1, dt * 5); cam.z += (tz - cam.z) * k;
  cam.shake = Math.max(0, cam.shake - dt * 1.8);
  const sh = cam.shake * cam.shake;
  camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z);
  const ly = opts.menu ? 1.6 : 1.2 + hEff * 0.75;
  cam.lookY += (ly - cam.lookY) * Math.min(1, dt * 6);
  camera.lookAt(opts.menu ? sim.x + (portrait ? 0 : 2.4) : sim.x * 0.5, cam.lookY, opts.menu ? 0 : -9);
  const fov = (portrait ? 80 : 64) + (speed > 0 ? (speed - 13) * 0.45 : 0) + (jet ? 4 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position); skyGroup.position.copy(camera.position);
  const lk = opts.lines ?? (speed > 0 ? Math.max(0, Math.min(1, (speed - 19) / 8)) + (jet ? 0.6 : 0) : 0);
  updateLines(dt, Math.max(speed, 20), Math.min(1, lk), camera.position.x, camera.position.y - 1, opts.lineZ || 0);
  return theme;
}
// Thumbnail: a hand-placed camera
export function setCamera(px, py, pz, lx, ly, lz, fov) { camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.fov = fov; camera.updateProjectionMatrix(); sky.position.copy(camera.position); skyGroup.position.copy(camera.position); }
export { robot };
