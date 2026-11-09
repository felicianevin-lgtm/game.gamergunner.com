// TEXTURES on blocks and other parts (GunnerVerse Studio): obj.tex = a built-in texture (TEXTURES, drawn right here,
// nothing to download) or "f:<file id>" = a picture you imported; obj.texS = how many studs one copy covers (default 4).
// The picture repeats over every side at the same size, so a long wall gets more bricks instead of stretched ones.
// Drag a texture from Toolbox > 🧱 Textures (or a picture from your computer) onto a part, or pick one in Properties.
import * as THREE from "../vendor/three.module.js";
import { pictureTexture } from "./files.js";

const brickRows = (g, w, h, rows, mortar, colors) => {
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  const rh = h / rows;
  for (let r = 0; r < rows; r++) for (let i = -1; i < 4; i++) {
    const bw = w / 2, x = i * bw + (r % 2 ? bw / 2 : 0);
    g.fillStyle = colors[(r * 7 + i * 3 + 8) % colors.length]; g.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
  }
};
const speckle = (g, w, h, n, colors, size) => { for (let i = 0; i < n; i++) { g.fillStyle = colors[i % colors.length]; const s = (size || 3) * (0.5 + Math.random()); g.fillRect(Math.random() * w, Math.random() * h, s, s); } };
export const TEXTURES = {
  brick: { label: "Brick", icon: "🧱", draw: (g, w, h) => brickRows(g, w, h, 4, "#d9cfc4", ["#b0442e", "#9c3a27", "#c2533a", "#a4402c"]) },
  wood: { label: "Wood planks", icon: "🪵", draw: (g, w, h) => {
    const cs = ["#a8743f", "#9a6836", "#b37c45", "#8f5f31"];
    for (let i = 0; i < 4; i++) { g.fillStyle = cs[i]; g.fillRect(0, i * h / 4, w, h / 4); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, i * h / 4, w, 2); g.fillRect(((i * 53) % w), i * h / 4, 2, h / 4); }
    g.strokeStyle = "rgba(60,30,10,.25)"; g.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 3, (2 * w) / 3, y - 3, w, y); g.stroke(); } } },
  stone: { label: "Stone", icon: "🪨", draw: (g, w, h) => { g.fillStyle = "#8d9096"; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, ["#7a7d83", "#a0a3a8", "#6c6f74", "#b3b5b9"], 4); } },
  cobble: { label: "Cobblestone", icon: "🧱", draw: (g, w, h) => {
    g.fillStyle = "#4a4d52"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = ["#8a8d92", "#7b7e83", "#9a9da1"][(x + y * 2) % 3]; g.beginPath(); g.ellipse(x * w / 4 + w / 8 + (y % 2) * 6, y * h / 4 + h / 8, w / 9, h / 10, (x + y) * 0.4, 0, Math.PI * 2); g.fill(); } } },
  grass: { label: "Grass", icon: "🌱", draw: (g, w, h) => { g.fillStyle = "#4f9a34"; g.fillRect(0, 0, w, h); speckle(g, w, h, 1400, ["#5fb03e", "#437f2c", "#6cc048", "#3d7428"], 3); } },
  dirt: { label: "Dirt", icon: "🟫", draw: (g, w, h) => { g.fillStyle = "#7a5233"; g.fillRect(0, 0, w, h); speckle(g, w, h, 1000, ["#6b462b", "#8a5e3c", "#5c3c24", "#957048"], 4); } },
  sand: { label: "Sand", icon: "🏖️", draw: (g, w, h) => { g.fillStyle = "#e3cf98"; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, ["#d6bf86", "#eedcab", "#cdb47a"], 2); } },
  snow: { label: "Snow", icon: "❄️", draw: (g, w, h) => { g.fillStyle = "#f2f6fb"; g.fillRect(0, 0, w, h); speckle(g, w, h, 500, ["#dfe8f2", "#ffffff", "#d3deea"], 4); } },
  water: { label: "Water", icon: "🌊", draw: (g, w, h) => {
    g.fillStyle = "#2a74c9"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const y = i * h / 6 + 10; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 12 + i) * 4); g.stroke(); } } },
  lava: { label: "Lava", icon: "🌋", draw: (g, w, h) => {
    g.fillStyle = "#3a0d05"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const r = 6 + Math.random() * 16; const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, "#ffe066"); gr.addColorStop(0.5, "#ff6a00"); gr.addColorStop(1, "rgba(200,30,0,0)"); g.save(); g.translate(Math.random() * w, Math.random() * h); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); g.restore(); } } },
  metal: { label: "Metal plate", icon: "🔩", draw: (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#b9bec6"); gr.addColorStop(1, "#8e949c"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeRect(1, 1, w - 2, h - 2); g.fillStyle = "#6b7078"; for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); } } },
  diamond: { label: "Diamond plate", icon: "💠", draw: (g, w, h) => {
    g.fillStyle = "#9aa1aa"; g.fillRect(0, 0, w, h); g.fillStyle = "#c9ced5";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.save(); g.translate(x * w / 8 + 8, y * h / 8 + 8); g.rotate((x + y) % 2 ? 0.7 : -0.7); g.fillRect(-6, -1.5, 12, 3); g.restore(); } } },
  tiles: { label: "Tiles", icon: "⬜", draw: (g, w, h) => { g.fillStyle = "#c9ccd1"; g.fillRect(0, 0, w, h); g.fillStyle = "#f4f5f7"; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillRect(x * w / 4 + 2, y * h / 4 + 2, w / 4 - 4, h / 4 - 4); } },
  checker: { label: "Checkers", icon: "🏁", draw: (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#111" : "#f4f4f4"; g.fillRect(x * w / 4, y * h / 4, w / 4, h / 4); } } },
  leaves: { label: "Leaves", icon: "🍃", draw: (g, w, h) => {
    g.fillStyle = "#2f6e27"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.fillStyle = ["#3f8a33", "#4fa23e", "#2a5f22", "#5bb447"][i % 4]; g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 6); g.beginPath(); g.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); g.fill(); g.restore(); } } },
  bark: { label: "Tree bark", icon: "🌳", draw: (g, w, h) => { g.fillStyle = "#5b3b22"; g.fillRect(0, 0, w, h); g.strokeStyle = "#3e2716"; g.lineWidth = 3; for (let i = 0; i < 14; i++) { const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, h / 3, x - 6, (2 * h) / 3, x + 3, h); g.stroke(); } } },
  carpet: { label: "Carpet", icon: "🟥", draw: (g, w, h) => { g.fillStyle = "#9c1f2e"; g.fillRect(0, 0, w, h); speckle(g, w, h, 1600, ["#a8283a", "#8a1726", "#b33244"], 2); g.strokeStyle = "#e0b04a"; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20); } },
  glow: { label: "Sci-fi panel", icon: "🟦", draw: (g, w, h) => { g.fillStyle = "#1a2433"; g.fillRect(0, 0, w, h); g.strokeStyle = "#3ad1ff"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); g.beginPath(); g.moveTo(6, h / 2); g.lineTo(w / 3, h / 2); g.lineTo(w / 2, h / 3); g.lineTo(w - 6, h / 3); g.stroke(); } },
};

// one canvas per built-in texture (made the first time it's used)
const made = new Map();
export function textureCanvas(key) {
  if (made.has(key)) return made.get(key);
  const T = TEXTURES[key]; if (!T) return null;
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  const seed = Math.random; let s = key.length * 99991; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); // (the same speckles every time)
  try { T.draw(g, 128, 128); } finally { Math.random = seed; }
  made.set(key, cv);
  return cv;
}
export function texturePicture(key) { const c = textureCanvas(key); return c ? c.toDataURL() : ""; }
export function okTex(v) { return typeof v === "string" && (TEXTURES[v] || /^f:[a-z0-9]{6,40}$/i.test(v)) ? v : ""; }

// Every surface gets texture coordinates measured in studs (each side uses the two directions it faces across),
// so the texture is the same size everywhere: inner = the built part (scaled to its size).
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3();
function studUVs(mesh, inner, texS) {
  const src = mesh.geometry, pos = src.attributes.position, nor = src.attributes.normal;
  if (!pos || !nor) return src;
  const g = src.clone();
  mesh.updateWorldMatrix(true, false); inner.updateWorldMatrix(true, false);
  _m.copy(inner.matrixWorld).invert().multiply(mesh.matrixWorld).premultiply(new THREE.Matrix4().makeScale(inner.scale.x, inner.scale.y, inner.scale.z));
  _nm.getNormalMatrix(_m);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(_m); _n.fromBufferAttribute(nor, i).applyMatrix3(_nm);
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    let u, v;
    if (ay >= ax && ay >= az) { u = _v.x; v = _v.z; } else if (ax >= az) { u = _v.z * Math.sign(_n.x || 1); v = _v.y; } else { u = -_v.x * Math.sign(_n.z || 1); v = _v.y; }
    uv[i * 2] = u / texS; uv[i * 2 + 1] = v / texS;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}
// Put o.tex on a built part (world.js buildObject calls this after it's sized).
export function applyTexture(inner, o) {
  const key = okTex(o.tex); if (!key) return;
  const texS = Math.max(0.25, Math.min(64, Number(o.texS) || 4));
  const meshes = []; inner.traverse((m) => { if (m.isMesh && !m.userData.noTex) meshes.push(m); });
  const put = (base) => {
    for (const m of meshes) {
      m.geometry = studUVs(m, inner, texS);
      const t = base.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const c = x.clone(); c.map = t; return c; });
      m.material = mats.length === 1 ? mats[0] : mats;
    }
  };
  if (key.startsWith("f:")) pictureTexture(key.slice(2), (t) => put(t));
  else { const t = new THREE.CanvasTexture(textureCanvas(key)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; put(t); }
}
