// AVATARS: your GunnerVerse character, made on the home page's Avatar page (site/hub.js) and used as your player in
// every Studio game (play.js). Everything is built from simple shapes in code (original designs, nothing to download).
// Saved in this browser (localStorage "gv_avatar") and on your account (relay social.js /social/avatar), so friends see it.
//   {skin, shirt, pants, shoes, accent (pattern color), top (TOPS), face (FACES), hair (HAIR), hairColor,
//    hat (HATS), hatColor, eyes (EYES), back (BACK), hand (HAND), build (BUILDS),
//    art / pantsArt (your own shirt / pants drawing, ART x ART pixels), made (up to MAX_WORN cosmetics you built),
//    suit (SUITS: a whole-body suit that replaces everything; won by beating a game, see unlockSuit)}
// The body is about 3.3 studs tall, feet at y = 0, facing -z (like cars), with limbs for the walk animation.
import * as THREE from "../vendor/three.module.js";

export const TOPS = { plain: "Plain", belt: "Runner suit", stripes: "Stripes", bolt: "Lightning", star: "Star", heart: "Heart", gv: "GV logo", seven: "Jersey #7", hoodie: "Hoodie", tux: "Tuxedo", overalls: "Overalls", draw: "🎨 My drawing" };
export const FACES = { smile: "Smile", grin: "Big grin", happy: "Happy", wink: "Wink", cool: "Cool", surprised: "Surprised", angry: "Grumpy", sleepy: "Sleepy", tongue: "Silly", robot: "Robot", none: "No face" };
export const HAIR = { none: "None", short: "Short", spiky: "Spiky", long: "Long", ponytail: "Ponytail", curly: "Curly", mohawk: "Mohawk", bun: "Bun", side: "Side swoop" };
export const HATS = { none: "None", helmet: "Runner helmet", cap: "Cap", backcap: "Backwards cap", beanie: "Beanie", crown: "Crown", tophat: "Top hat", cowboy: "Cowboy hat",
  party: "Party hat", viking: "Viking helmet", wizard: "Wizard hat", headphones: "Headphones", halo: "Halo", bunny: "Bunny ears", cat: "Cat ears", chef: "Chef hat", horns: "Horns", astro: "Space helmet" };
export const EYES = { none: "None", visor: "Glowing visor", glasses: "Glasses", shades: "Sunglasses", three: "3D glasses", patch: "Eye patch", ninja: "Ninja mask", goggles: "Goggles" };
export const BACK = { none: "None", backpack: "Backpack", cape: "Cape", wings: "Angel wings", dragon: "Dragon wings", jetpack: "Jetpack", swordback: "Sword", guitar: "Guitar", shell: "Turtle shell" };
export const HAND = { none: "None", sword: "Sword", icecream: "Ice cream", flag: "Flag", wand: "Magic wand", flashlight: "Flashlight", trophy: "Trophy", balloon: "Balloon" };
export const BUILDS = { normal: "Normal", small: "Small", tall: "Tall", wide: "Strong" };
// Suits change your whole avatar. They're prizes: the Backrooms game (site/backrooms) unlocks both when you escape.
export const SUITS = { none: "No suit", hazmat: "Backrooms hazmat suit", monster: "Backrooms monster" };
export const SUIT_FROM = { hazmat: "Escape the Backrooms to unlock", monster: "Escape the Backrooms to unlock" };
export function suitsUnlocked() { try { const l = JSON.parse(localStorage.getItem("gv_unlocks") || "[]"); return Array.isArray(l) ? l.filter((k) => SUITS[k]) : []; } catch { return []; } }
export function unlockSuit(k) { if (!SUITS[k]) return; const l = suitsUnlocked(); if (!l.includes(k)) { l.push(k); try { localStorage.setItem("gv_unlocks", JSON.stringify(l)); } catch {} } }
export const PALETTE = ["#f6d7b8", "#e0a878", "#c68a5a", "#8d5a3a", "#5a3a26", "#ffffff", "#a3a8b0", "#2b2f36", "#111111", "#1b2420", "#e8261c", "#ff7a1a", "#ffc531",
  "#1fae45", "#7be03a", "#13c4c4", "#2f7df6", "#1d2a52", "#a64bf4", "#ff4fa3", "#8b5a2b", "#d4af37", "#39ff6a", "#ff9ecb"];
export const PARTS = { top: TOPS, face: FACES, hair: HAIR, hat: HATS, eyes: EYES, back: BACK, hand: HAND, build: BUILDS, suit: SUITS };
const COLORS = ["skin", "shirt", "pants", "shoes", "accent", "hairColor", "hatColor"];

export const DEFAULT_AVATAR = { skin: "#e0a878", shirt: "#1b2420", pants: "#1b2420", shoes: "#111111", accent: "#1fae45", top: "belt", face: "smile", hair: "none", hairColor: "#5a3a26",
  hat: "helmet", hatColor: "#1fae45", eyes: "visor", back: "none", hand: "none", build: "normal", suit: "none" };

// Drawings (🎨 Draw on the Avatar page): ART x ART pixels, one hex digit each: 0 = no paint, 1-f = DRAW_COLORS.
export const ART = 32;
export const DRAW_COLORS = [null, "#111111", "#ffffff", "#a3a8b0", "#e8261c", "#ff7a1a", "#ffc531", "#7be03a", "#1fae45", "#13c4c4", "#2f7df6", "#1d2a52", "#a64bf4", "#ff4fa3", "#8b5a2b", "#f6d7b8"];
// Cosmetics you build (🛠️ Build): {i (id), a (ATTACH), b: [pieces]}; a piece is
//   {s (SHAPES), c "#rrggbb", p [x,y,z] from where it's attached, k [w,h,d] size, r [x,y,z] degrees, g 1 = glows, m 1 = shiny}
export const SHAPES = { box: "Block", ball: "Ball", cyl: "Tube", cone: "Cone", dome: "Dome", ring: "Ring", wedge: "Ramp", star: "Star", heart: "Heart" };
export const ATTACH = { head: "Head", body: "Body", hand: "Right hand", handL: "Left hand" };
export const MAX_WORN = 3, MAX_PIECES = 16;

const num = (v, lo, hi, d, step) => { v = Number(v); if (!Number.isFinite(v)) return d; v = Math.min(hi, Math.max(lo, v)); return Math.round(v / step) * step; };
const r2 = (v) => Math.round(v * 100) / 100;
export function sanitizeMade(m) {
  if (!m || typeof m !== "object" || !ATTACH[m.a] || !Array.isArray(m.b)) return null;
  const b = m.b.slice(0, MAX_PIECES).filter((p) => p && SHAPES[p.s]).map((p) => {
    const v = (arr, i, lo, hi, d, step) => r2(num(Array.isArray(arr) ? arr[i] : d, lo, hi, d, step));
    const out = { s: p.s, c: /^#[0-9a-fA-F]{6}$/.test(p.c || "") ? p.c.toLowerCase() : "#ffc531",
      p: [0, 1, 2].map((i) => v(p.p, i, -2.5, 2.5, 0, 0.01)), k: [0, 1, 2].map((i) => v(p.k, i, 0.05, 3, 0.4, 0.01)), r: [0, 1, 2].map((i) => v(p.r, i, -180, 180, 0, 1)) };
    if (p.g) out.g = 1;
    if (p.m) out.m = 1;
    return out;
  });
  if (!b.length) return null;
  return { i: /^[a-z0-9]{1,10}$/.test(m.i || "") ? m.i : "x", a: m.a, b };
}
const okArt = (s) => typeof s === "string" && s.length === ART * ART && /^[0-9a-f]+$/.test(s) && /[1-9a-f]/.test(s);

export function sanitizeAvatar(a) {
  const out = { ...DEFAULT_AVATAR };
  if (!a || typeof a !== "object") return out;
  for (const k of COLORS) if (/^#[0-9a-fA-F]{6}$/.test(a[k] || "")) out[k] = a[k].toLowerCase();
  for (const [k, list] of Object.entries(PARTS)) if (list[a[k]]) out[k] = a[k];
  if (okArt(a.art)) out.art = a.art;
  else if (out.top === "draw") out.top = "plain";
  if (okArt(a.pantsArt)) out.pantsArt = a.pantsArt;
  const made = Array.isArray(a.made) ? a.made.map(sanitizeMade).filter(Boolean).slice(0, MAX_WORN) : [];
  if (made.length) out.made = made;
  return out;
}
export function loadAvatar() { try { return sanitizeAvatar(JSON.parse(localStorage.getItem("gv_avatar") || "null")); } catch { return { ...DEFAULT_AVATAR }; } }
export function saveAvatar(a) { try { localStorage.setItem("gv_avatar", JSON.stringify(sanitizeAvatar(a))); } catch {} }
export function randomAvatar() {
  const pick = (o) => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
  const col = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const a = { skin: PALETTE[Math.floor(Math.random() * 5)], shirt: col(), pants: col(), shoes: col(), accent: col(), hairColor: col(), hatColor: col() };
  for (const [k, list] of Object.entries(PARTS)) a[k] = pick(list);
  if (Math.random() < 0.4) a.hat = "none";
  if (Math.random() < 0.5) a.back = "none";
  if (Math.random() < 0.6) a.hand = "none";
  a.suit = "none";
  if (Math.random() < 0.5) a.eyes = "none";
  a.face = a.face === "none" ? "smile" : a.face;
  return sanitizeAvatar(a);
}

// ---------------------------------------------------------------- textures (faces and shirt patterns, drawn on canvases)
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (texCache.size > 150) { const [k0, t0] = texCache.entries().next().value; texCache.delete(k0); t0.dispose(); } // (drawings make a new one per change)
  texCache.set(key, t);
  return t;
}
// a drawing on top of a base color, sharp pixels (part = [repeat x, offset x] shows only part of it, for one pants leg)
function artTex(art, base, part) {
  const t = canvasTex("art:" + base + art, 128, 128, (g, w) => {
    const s = w / ART;
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    for (let i = 0; i < ART * ART; i++) { const c = DRAW_COLORS[parseInt(art[i], 16)]; if (c) { g.fillStyle = c; g.fillRect((i % ART) * s, Math.floor(i / ART) * s, s, s); } }
  });
  t.magFilter = THREE.NearestFilter;
  if (!part) return t;
  return canvasTexPart(t, part);
}
const partCache = new Map();
function canvasTexPart(t, [rx, ox]) {
  const key = t.uuid + rx + ":" + ox;
  if (partCache.has(key)) return partCache.get(key);
  const c = t.clone(); c.repeat.set(rx, 1); c.offset.set(ox, 0); c.needsUpdate = true;
  if (partCache.size > 120) { const [k0, c0] = partCache.entries().next().value; partCache.delete(k0); c0.dispose(); }
  partCache.set(key, c);
  return c;
}
function faceTex(face) {
  return canvasTex("face:" + face, 128, 128, (g) => {
    g.fillStyle = "#1a1a1a"; g.strokeStyle = "#1a1a1a"; g.lineWidth = 7; g.lineCap = "round";
    const eye = (x, y, r) => { g.beginPath(); g.arc(x, y, r || 8, 0, Math.PI * 2); g.fill(); };
    const arc = (x, y, r, a, b) => { g.beginPath(); g.arc(x, y, r, a, b); g.stroke(); };
    const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    if (face === "none") return;
    if (face === "robot") { g.fillStyle = "#39d0ff"; g.fillRect(28, 38, 24, 14); g.fillRect(76, 38, 24, 14); g.fillStyle = "#1a1a1a"; for (let i = 0; i < 5; i++) g.fillRect(34 + i * 13, 84, 8, 10); return; }
    if (face === "wink") { eye(44, 50); line(74, 50, 92, 50); }
    else if (face === "cool") { g.fillRect(24, 40, 36, 16); g.fillRect(68, 40, 36, 16); g.fillRect(56, 44, 16, 5); }
    else if (face === "sleepy") { arc(44, 46, 10, 0.2, Math.PI - 0.2); arc(84, 46, 10, 0.2, Math.PI - 0.2); }
    else if (face === "angry") { eye(44, 54); eye(84, 54); line(30, 36, 56, 46); line(98, 36, 72, 46); }
    else if (face === "surprised") { eye(44, 48, 10); eye(84, 48, 10); }
    else if (face === "happy") { arc(44, 54, 10, Math.PI + 0.3, -0.3); arc(84, 54, 10, Math.PI + 0.3, -0.3); }
    else { eye(44, 50); eye(84, 50); }
    if (face === "grin" || face === "happy") { g.beginPath(); g.moveTo(34, 76); g.quadraticCurveTo(64, 112, 94, 76); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.fillRect(44, 77, 40, 7); }
    else if (face === "surprised") { g.beginPath(); g.arc(64, 88, 9, 0, Math.PI * 2); g.fill(); }
    else if (face === "angry" || face === "sleepy") line(48, 90, 80, 90);
    else if (face === "tongue") { arc(64, 74, 22, 0.35, Math.PI - 0.35); g.fillStyle = "#ff6f8e"; g.beginPath(); g.ellipse(70, 96, 9, 11, 0, 0, Math.PI * 2); g.fill(); }
    else arc(64, 70, 24, 0.35, Math.PI - 0.35);
    if (face === "happy") { g.fillStyle = "rgba(255,100,120,0.45)"; eye(26, 72, 9); eye(102, 72, 9); }
  });
}
function topTex(top, shirt, accent) {
  return canvasTex("top:" + top + shirt + accent, 128, 128, (g, w, h) => {
    g.fillStyle = shirt; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.strokeStyle = accent;
    if (top === "stripes") for (let y = 8; y < h; y += 28) g.fillRect(0, y, w, 12);
    else if (top === "belt") g.fillRect(0, 104, w, 18);
    else if (top === "bolt") { g.beginPath(); g.moveTo(72, 10); g.lineTo(38, 70); g.lineTo(62, 70); g.lineTo(50, 118); g.lineTo(92, 52); g.lineTo(66, 52); g.closePath(); g.fill(); }
    else if (top === "star") { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 42, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill(); }
    else if (top === "heart") { g.beginPath(); g.moveTo(64, 104); g.bezierCurveTo(10, 66, 30, 18, 64, 44); g.bezierCurveTo(98, 18, 118, 66, 64, 104); g.fill(); }
    else if (top === "gv" || top === "seven") { g.font = "bold " + (top === "gv" ? 58 : 80) + "px Arial Black, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(top === "gv" ? "GV" : "7", 64, 68); }
    else if (top === "hoodie") { g.fillRect(40, 0, 6, 70); g.fillRect(82, 0, 6, 70); g.fillRect(30, 80, 68, 30); }
    else if (top === "tux") { g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(64, 110); g.closePath(); g.fill(); g.fillStyle = accent; g.beginPath(); g.moveTo(48, 14); g.lineTo(64, 22); g.lineTo(80, 14); g.lineTo(80, 32); g.lineTo(64, 24); g.lineTo(48, 32); g.closePath(); g.fill(); }
    else if (top === "overalls") { g.fillRect(24, 50, 80, 78); g.fillRect(28, 0, 14, 56); g.fillRect(86, 0, 14, 56); }
  });
}

// ---------------------------------------------------------------- building the character
const matCache = new Map();
function M(c, opts) {
  const key = c + JSON.stringify(opts || 0);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...(opts || {}) }));
  return matCache.get(key);
}
function part(parent, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; parent.add(m); return m; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 18);
const S = (r) => new THREE.SphereGeometry(r, 18, 12);

export function buildAvatar(cfg) {
  const a = sanitizeAvatar(cfg);
  if (a.suit !== "none") return buildSuit(a.suit);
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const skin = M(a.skin), shirt = M(a.shirt), pants = M(a.pants), shoes = M(a.shoes), acc = M(a.accent), hairM = M(a.hairColor, { roughness: 0.85 }), hatM = M(a.hatColor);
  const glow = (c) => M(c, { emissive: new THREE.Color(c), emissiveIntensity: 0.8 });
  const drawn = a.top === "draw" && a.art;
  const front = new THREE.MeshStandardMaterial({ map: drawn ? artTex(a.art, a.shirt) : topTex(a.top, a.shirt, a.accent), roughness: 0.6 });
  // limbs hang from pivots so they can swing
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  legL.position.set(-0.32, 1.2, 0); legR.position.set(0.32, 1.2, 0); armL.position.set(-0.95, 2.25, 0); armR.position.set(0.95, 2.25, 0);
  // a pants drawing: the left half of the picture on the leg you see on the left (from the front, and from behind)
  const legMats = (L) => {
    if (!a.pantsArt) return pants;
    const half = (ox) => new THREE.MeshStandardMaterial({ map: artTex(a.pantsArt, a.pants, [0.5, ox]), roughness: 0.6 });
    return [pants, pants, pants, pants, half(L === legL ? 0 : 0.5), half(L === legL ? 0.5 : 0)];
  };
  for (const L of [legL, legR]) { part(L, B(0.55, 1.0, 0.6), legMats(L), 0, -0.5, 0); part(L, B(0.6, 0.22, 0.72), shoes, 0, -1.09, -0.05); }
  for (const A of [armL, armR]) { part(A, B(0.45, 0.8, 0.5), shirt, 0, -0.4, 0); part(A, B(0.42, 0.3, 0.47), skin, 0, -0.95, 0); }
  body.add(legL, legR, armL, armR);
  // torso: the front shows the shirt pattern (a drawing shows on the back too)
  const torsoMats = [shirt, shirt, shirt, shirt, drawn ? front : shirt, front]; // (box faces: +x, -x, +y, -y, +z, -z; the front is -z)
  const torso = new THREE.Mesh(B(1.4, 1.15, 0.75), torsoMats); torso.position.set(0, 1.78, 0); torso.castShadow = true; body.add(torso);
  if (a.top === "hoodie") part(body, B(1.1, 0.5, 0.4), shirt, 0, 2.3, 0.5);
  // head
  const head = new THREE.Group(); head.position.set(0, 2.78, 0); body.add(head);
  part(head, B(0.9, 0.85, 0.85), skin, 0, 0, 0);
  const faceP = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.82), new THREE.MeshBasicMaterial({ map: faceTex(a.face), transparent: true, depthWrite: false }));
  faceP.position.set(0, -0.02, -0.431); faceP.rotation.y = Math.PI; head.add(faceP);
  buildHair(head, a.hair, hairM);
  buildHat(head, a.hat, hatM, a, glow);
  buildEyes(head, a.eyes, glow);
  buildBack(body, a.back, acc, M);
  buildHand(armR, a.hand, M, glow);
  const at = { head, body: new THREE.Group(), hand: new THREE.Group(), handL: new THREE.Group() };
  at.body.position.set(0, 1.78, 0); body.add(at.body);
  at.hand.position.set(0, -1.05, -0.15); armR.add(at.hand);
  at.handL.position.set(0, -1.05, -0.15); armL.add(at.handL);
  for (const m of a.made || []) at[m.a].add(buildMade(m));
  const k ={ normal: [1, 1, 1], small: [0.85, 0.82, 0.85], tall: [0.95, 1.15, 0.95], wide: [1.18, 1.02, 1.12] }[a.build];
  body.scale.set(k[0], k[1], k[2]);
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.t = 0;
  return g;
}
// A whole-body suit (SUITS): same limbs as a normal avatar, so it walks the same way.
function buildSuit(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group(), head = new THREE.Group();
  legL.position.set(-0.32, 1.2, 0); legR.position.set(0.32, 1.2, 0); armL.position.set(-0.95, 2.25, 0); armR.position.set(0.95, 2.25, 0); head.position.set(0, 2.85, 0);
  body.add(legL, legR, armL, armR, head);
  if (kind === "hazmat") {
    const suit = M("#e8c21a", { roughness: 0.75 }), rubber = M("#262626", { roughness: 0.95 }), dark = M("#111111");
    const lens = M("#9fd8ff", { roughness: 0.1, metalness: 0.3, emissive: new THREE.Color("#2a5878"), emissiveIntensity: 0.6 });
    for (const L of [legL, legR]) { part(L, B(0.62, 1.0, 0.66), suit, 0, -0.5, 0); part(L, B(0.68, 0.34, 0.8), rubber, 0, -1.05, -0.05); }
    for (const A of [armL, armR]) { part(A, B(0.52, 0.8, 0.56), suit, 0, -0.4, 0); part(A, B(0.48, 0.36, 0.52), rubber, 0, -0.95, 0); }
    part(body, B(1.52, 1.22, 0.86), suit, 0, 1.78, 0);
    part(body, B(1.54, 0.14, 0.88), rubber, 0, 1.25, 0);
    part(body, B(0.08, 1.1, 0.04), dark, 0, 1.8, -0.44);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: hazardTex(), transparent: true }));
    sign.position.set(0.38, 2.05, -0.44); sign.rotation.y = Math.PI; body.add(sign);
    part(body, C(0.24, 0.24, 0.95), M("#b8bcc4", { metalness: 0.6, roughness: 0.3 }), 0, 1.9, 0.6);
    part(head, S(0.6), suit, 0, 0.02, 0).scale.set(1, 1.08, 1); // hood
    part(head, S(0.45), dark, 0, -0.06, -0.36).scale.set(1, 0.92, 0.62); // gas mask
    for (const s of [-1, 1]) { part(head, C(0.14, 0.14, 0.08), lens, s * 0.19, 0.06, -0.64).rotation.x = Math.PI / 2; part(head, new THREE.TorusGeometry(0.15, 0.03, 6, 16), rubber, s * 0.19, 0.06, -0.66); }
    part(head, C(0.17, 0.2, 0.32), rubber, 0, -0.32, -0.66).rotation.x = Math.PI / 2; // filter
    part(head, C(0.2, 0.2, 0.05), M("#5a5a5a"), 0, -0.32, -0.83).rotation.x = Math.PI / 2;
  } else {
    const skin = M("#15120f", { roughness: 0.95 }), bone = M("#d9d4c6"), eye = M("#f4f4ff", { emissive: new THREE.Color("#f4f4ff"), emissiveIntensity: 1.2 }), mouth = M("#050404");
    for (const L of [legL, legR]) { part(L, B(0.3, 1.15, 0.32), skin, 0, -0.55, 0); for (let i = -1; i <= 1; i++) part(L, new THREE.ConeGeometry(0.06, 0.3, 5), bone, i * 0.1, -1.12, -0.25).rotation.x = -Math.PI / 2; }
    for (const A of [armL, armR]) { part(A, B(0.26, 1.45, 0.26), skin, 0, -0.72, 0); for (let i = -1; i <= 1; i++) part(A, new THREE.ConeGeometry(0.05, 0.45, 5), bone, i * 0.08, -1.6, -0.02).rotation.x = Math.PI; }
    part(body, B(0.95, 1.25, 0.55), skin, 0, 1.85, 0).rotation.x = -0.12;
    for (let i = 0; i < 4; i++) part(body, new THREE.ConeGeometry(0.08, 0.3, 5), bone, 0, 1.4 + i * 0.3, 0.32).rotation.x = Math.PI / 2; // spine
    part(head, B(0.62, 0.95, 0.6), skin, 0, 0.05, 0);
    for (const s of [-1, 1]) part(head, S(0.07), eye, s * 0.15, 0.2, -0.31);
    part(head, B(0.46, 0.14, 0.05), mouth, 0, -0.2, -0.3);
    for (let i = 0; i < 6; i++) part(head, B(0.04, 0.07, 0.03), bone, -0.18 + i * 0.072, -0.17, -0.33); // teeth
    for (let i = 0; i < 9; i++) part(i < 5 ? head : body, B(0.06, 0.9 + (i % 3) * 0.35, 0.06), skin, (i % 5 - 2) * 0.13, i < 5 ? -0.75 : 1.2, i < 5 ? 0.15 : 0.3).rotation.x = 0.1 * (i % 3); // dangly strands
  }
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.t = 0;
  return g;
}
let hazardPic = null;
function hazardTex() {
  if (hazardPic) return hazardPic;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  x.fillStyle = "#111"; x.beginPath(); x.moveTo(32, 4); x.lineTo(62, 58); x.lineTo(2, 58); x.closePath(); x.fill();
  x.fillStyle = "#e8c21a"; x.beginPath(); x.moveTo(32, 14); x.lineTo(54, 53); x.lineTo(10, 53); x.closePath(); x.fill();
  x.fillStyle = "#111"; x.font = "bold 30px sans-serif"; x.textAlign = "center"; x.fillText("!", 32, 50);
  hazardPic = new THREE.CanvasTexture(c); hazardPic.colorSpace = THREE.SRGBColorSpace;
  return hazardPic;
}
function buildHair(h, hair, m) {
  if (hair === "none") return;
  if (hair !== "mohawk") part(h, B(0.96, 0.22, 0.92), m, 0, 0.47, 0.02);
  if (hair === "short" || hair === "side") { part(h, B(0.96, 0.5, 0.2), m, 0, 0.2, 0.42); part(h, B(0.12, 0.45, 0.88), m, -0.47, 0.18, 0.02); part(h, B(0.12, 0.45, 0.88), m, 0.47, 0.18, 0.02); }
  if (hair === "side") { const s = part(h, B(0.7, 0.2, 0.2), m, -0.12, 0.4, -0.45); s.rotation.z = 0.25; }
  if (hair === "spiky") for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const s = part(h, new THREE.ConeGeometry(0.16, 0.42, 6), m, i * 0.3, 0.72, j * 0.28); s.rotation.set(j * 0.3, 0, -i * 0.3); }
  if (hair === "long" || hair === "ponytail" || hair === "curly" || hair === "bun") { part(h, B(0.98, 0.7, 0.24), m, 0, 0.1, 0.43); part(h, B(0.14, 0.6, 0.9), m, -0.48, 0.15, 0); part(h, B(0.14, 0.6, 0.9), m, 0.48, 0.15, 0); }
  if (hair === "long") part(h, B(0.98, 0.9, 0.24), m, 0, -0.55, 0.43);
  if (hair === "ponytail") { const p = part(h, C(0.13, 0.08, 0.8, 8), m, 0, -0.1, 0.62); p.rotation.x = 0.4; }
  if (hair === "bun") part(h, S(0.26), m, 0, 0.62, 0.3);
  if (hair === "curly") for (let i = 0; i < 9; i++) part(h, S(0.2), m, Math.cos(i * 0.7) * 0.42, 0.5 + (i % 2) * 0.08, Math.sin(i * 0.7) * 0.38 + 0.05);
  if (hair === "mohawk") for (let i = 0; i < 4; i++) part(h, B(0.16, 0.36, 0.22), m, 0, 0.6, -0.3 + i * 0.22);
}
function buildHat(h, hat, m, a, glow) {
  if (hat === "none") return;
  if (hat === "helmet") { part(h, B(1.0, 0.45, 0.95), m, 0, 0.45, 0); return; }
  if (hat === "cap" || hat === "backcap") { part(h, B(0.96, 0.3, 0.92), m, 0, 0.55, 0); part(h, B(0.8, 0.06, 0.45), m, 0, 0.42, hat === "cap" ? -0.62 : 0.62); return; }
  if (hat === "beanie") { part(h, C(0.42, 0.5, 0.45, 16), m, 0, 0.6, 0); part(h, S(0.14), M("#ffffff"), 0, 0.9, 0); return; }
  if (hat === "crown") { const gold = M("#ffc531", { metalness: 0.7, roughness: 0.3 }); part(h, C(0.5, 0.5, 0.25, 16, true), gold, 0, 0.55, 0); for (let i = 0; i < 6; i++) part(h, new THREE.ConeGeometry(0.1, 0.25, 4), gold, Math.cos(i * 1.05) * 0.45, 0.78, Math.sin(i * 1.05) * 0.45); part(h, S(0.07), glow("#e8261c"), 0, 0.56, -0.5); return; }
  if (hat === "tophat") { part(h, C(0.62, 0.62, 0.06, 20), m, 0, 0.45, 0); part(h, C(0.4, 0.4, 0.75, 20), m, 0, 0.84, 0); part(h, C(0.41, 0.41, 0.1, 20), M(a.accent), 0, 0.55, 0); return; }
  if (hat === "cowboy") { part(h, C(0.85, 0.85, 0.06, 20), m, 0, 0.46, 0); part(h, C(0.36, 0.42, 0.42, 16), m, 0, 0.68, 0); return; }
  if (hat === "party") { part(h, new THREE.ConeGeometry(0.32, 0.8, 16), m, 0, 0.82, 0); part(h, S(0.1), M("#ffffff"), 0, 1.24, 0); return; }
  if (hat === "wizard") { part(h, C(0.7, 0.7, 0.05, 20), m, 0, 0.45, 0); const c = part(h, new THREE.ConeGeometry(0.42, 1.1, 16), m, 0, 1.0, 0.08); c.rotation.x = 0.15; part(h, S(0.09), glow("#ffc531"), 0, 0.85, -0.38); return; }
  if (hat === "viking") { part(h, new THREE.SphereGeometry(0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M("#a3a8b0", { metalness: 0.6, roughness: 0.4 }), 0, 0.38, 0); for (const s of [-1, 1]) { const c = part(h, new THREE.ConeGeometry(0.1, 0.5, 8), M("#f3e8d0"), s * 0.56, 0.62, 0); c.rotation.z = -s * 0.7; } return; }
  if (hat === "headphones") { part(h, B(1.1, 0.12, 0.16), m, 0, 0.5, 0); for (const s of [-1, 1]) part(h, C(0.18, 0.18, 0.12, 14), m, s * 0.5, 0.0, 0).rotation.z = Math.PI / 2; return; }
  if (hat === "halo") { const t = part(h, new THREE.TorusGeometry(0.36, 0.05, 8, 24), glow("#ffe680"), 0, 0.85, 0); t.rotation.x = Math.PI / 2; return; }
  if (hat === "bunny" || hat === "cat") {
    for (const s of [-1, 1]) {
      if (hat === "bunny") { part(h, B(0.16, 0.7, 0.08), m, s * 0.22, 0.8, 0); part(h, B(0.08, 0.5, 0.02), M("#ff9ecb"), s * 0.22, 0.8, -0.05); }
      else { const c = part(h, new THREE.ConeGeometry(0.16, 0.3, 4), m, s * 0.3, 0.55, 0); c.rotation.y = Math.PI / 4; }
    }
    return;
  }
  if (hat === "chef") { part(h, C(0.42, 0.42, 0.3, 16), M("#ffffff"), 0, 0.55, 0); part(h, S(0.5), M("#ffffff"), 0, 0.85, 0); return; }
  if (hat === "horns") { for (const s of [-1, 1]) { const c = part(h, new THREE.ConeGeometry(0.1, 0.4, 8), M("#e8261c"), s * 0.32, 0.6, -0.1); c.rotation.z = -s * 0.35; } return; }
  if (hat === "astro") { part(h, S(0.72), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false }), 0, 0, 0); part(h, C(0.6, 0.6, 0.12, 20), M("#ffffff"), 0, -0.55, 0); }
}
function buildEyes(h, eyes, glow) {
  if (eyes === "none") return;
  const z = -0.45;
  if (eyes === "visor") { part(h, B(0.95, 0.26, 0.12), glow("#39ff6a"), 0, 0.1, z); return; }
  if (eyes === "glasses" || eyes === "shades" || eyes === "three" || eyes === "goggles") {
    const frame = M(eyes === "goggles" ? "#8b5a2b" : "#111111");
    part(h, B(0.92, 0.07, 0.06), frame, 0, 0.16, z);
    [[-0.2, eyes === "three" ? "#e8261c" : null], [0.2, eyes === "three" ? "#2f7df6" : null]].forEach(([x, c]) => {
      const lensC = c || (eyes === "shades" ? "#111111" : eyes === "goggles" ? "#9fdcff" : "#cfe8ff");
      part(h, B(0.3, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: lensC, transparent: eyes !== "shades", opacity: eyes === "shades" ? 1 : 0.55, roughness: 0.1 }), x, 0.06, z - 0.01);
    });
    if (eyes === "goggles") part(h, B(0.96, 0.1, 0.9), frame, 0, 0.06, 0);
    return;
  }
  if (eyes === "patch") { part(h, B(0.26, 0.22, 0.05), M("#111111"), 0.2, 0.08, z); const s = part(h, B(1.0, 0.04, 0.04), M("#111111"), 0, 0.14, z + 0.01); s.rotation.z = -0.2; return; }
  if (eyes === "ninja") part(h, B(0.94, 0.34, 0.9), M("#111111"), 0, -0.24, 0);
}
function buildBack(b, back, acc, M) {
  if (back === "none") return;
  const z = 0.4;
  if (back === "backpack") { part(b, B(1.0, 1.0, 0.45), acc, 0, 1.8, z + 0.2); part(b, B(0.8, 0.4, 0.15), M("#2b2f36"), 0, 1.6, z + 0.48); return; }
  if (back === "cape") { const c = part(b, B(1.3, 2.0, 0.06), acc, 0, 1.4, z + 0.05); c.rotation.x = 0.12; return; }
  if (back === "wings" || back === "dragon") {
    const m = back === "wings" ? M("#ffffff") : acc;
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 1.4, 0.7); sh.lineTo(s * 1.2, -0.2); sh.lineTo(s * 1.4, -0.6); sh.lineTo(s * 0.6, -0.5); sh.closePath();
      const w = part(b, new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: m.color, side: THREE.DoubleSide, roughness: 0.6 }), s * 0.3, 2.0, z + 0.1);
      w.rotation.y = s * 0.35;
    }
    return;
  }
  if (back === "jetpack") { for (const s of [-1, 1]) { part(b, C(0.22, 0.22, 1.0, 14), M("#a3a8b0", { metalness: 0.7, roughness: 0.3 }), s * 0.3, 1.85, z + 0.25); part(b, new THREE.ConeGeometry(0.16, 0.35, 12), M("#ff7a1a", { emissive: new THREE.Color("#ff7a1a"), emissiveIntensity: 1 }), s * 0.3, 1.2, z + 0.25).rotation.x = Math.PI; } return; }
  if (back === "swordback") { const s = part(b, B(0.12, 2.0, 0.06), M("#d8dde4", { metalness: 0.8, roughness: 0.2 }), 0, 2.0, z + 0.12); s.rotation.z = 0.6; return; }
  if (back === "guitar") { const gr = new THREE.Group(); gr.position.set(0, 1.8, z + 0.15); gr.rotation.z = -0.6; b.add(gr); part(gr, B(0.8, 0.9, 0.18), acc, 0, -0.3, 0); part(gr, B(0.14, 1.1, 0.1), M("#5b3a22"), 0, 0.6, 0); return; }
  if (back === "shell") part(b, new THREE.SphereGeometry(0.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M("#3f8f3a"), 0, 1.75, z - 0.1).rotation.x = -Math.PI / 2;
}
function buildHand(arm, hand, M, glow) {
  if (hand === "none") return;
  const h = new THREE.Group(); h.position.set(0, -1.05, -0.15); arm.add(h);
  if (hand === "sword") { part(h, B(0.1, 1.6, 0.05), M("#d8dde4", { metalness: 0.8, roughness: 0.2 }), 0, 0.1, -0.4).rotation.x = -Math.PI / 2 + 0.3; return; }
  if (hand === "icecream") { part(h, new THREE.ConeGeometry(0.16, 0.45, 12), M("#d9a35c"), 0, 0.15, -0.1).rotation.x = Math.PI; part(h, S(0.2), M("#ff9ecb"), 0, 0.45, -0.1); return; }
  if (hand === "flag") { part(h, C(0.04, 0.04, 1.6, 8), M("#a3a8b0"), 0, 0.6, -0.1); part(h, B(0.06, 0.45, 0.7), M("#e8261c"), 0, 1.15, -0.45); return; }
  if (hand === "wand") { part(h, C(0.04, 0.04, 0.8, 8), M("#2b2f36"), 0, 0.3, -0.2).rotation.x = -0.6; part(h, S(0.09), glow("#ffe680"), 0, 0.62, -0.42); return; }
  if (hand === "flashlight") { part(h, C(0.1, 0.13, 0.55, 12), M("#2b2f36"), 0, 0.05, -0.25).rotation.x = Math.PI / 2; part(h, C(0.1, 0.1, 0.02, 12), glow("#fff7c0"), 0, 0.05, -0.53).rotation.x = Math.PI / 2; return; }
  if (hand === "trophy") { const gold = M("#ffc531", { metalness: 0.7, roughness: 0.3 }); part(h, C(0.22, 0.1, 0.3, 14), gold, 0, 0.3, -0.1); part(h, B(0.2, 0.08, 0.2), gold, 0, 0.1, -0.1); return; }
  if (hand === "balloon") { part(h, C(0.01, 0.01, 2.2, 4), M("#ffffff"), 0, 1.1, 0); part(h, S(0.4), M("#e8261c", { roughness: 0.3 }), 0, 2.4, 0); }
}
// ---------------------------------------------------------------- cosmetics you built (🛠️ Build): pieces of simple shapes
const shapeGeo = new Map();
function flat(sh) { const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 10 }); g.center(); const b = new THREE.Box3().setFromBufferAttribute(g.attributes.position), s = b.getSize(new THREE.Vector3()); g.scale(1 / s.x, 1 / s.y, 1); return g; }
function geoOf(s) {
  if (shapeGeo.has(s)) return shapeGeo.get(s);
  let g;
  if (s === "ball") g = new THREE.SphereGeometry(0.5, 20, 14);
  else if (s === "cyl") g = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
  else if (s === "cone") g = new THREE.ConeGeometry(0.5, 1, 20);
  else if (s === "dome") { g = new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, -0.25, 0); g.scale(1, 2, 1); }
  else if (s === "ring") { g = new THREE.TorusGeometry(0.4, 0.1, 10, 28); g.rotateX(Math.PI / 2); }
  else if (s === "wedge") { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1, 0); sh.lineTo(0, 1); sh.closePath(); g = flat(sh); g.rotateY(Math.PI / 2); }
  else if (s === "star") { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5, an = Math.PI / 2 + (i * Math.PI) / 5; i ? sh.lineTo(Math.cos(an) * r, Math.sin(an) * r) : sh.moveTo(Math.cos(an) * r, Math.sin(an) * r); } g = flat(sh); }
  else if (s === "heart") { const sh = new THREE.Shape(); sh.moveTo(0, -0.5); sh.bezierCurveTo(-0.9, 0.05, -0.45, 0.75, 0, 0.3); sh.bezierCurveTo(0.45, 0.75, 0.9, 0.05, 0, -0.5); g = flat(sh); }
  else g = new THREE.BoxGeometry(1, 1, 1);
  shapeGeo.set(s, g);
  return g;
}
const D2R = Math.PI / 180;
export function buildMade(m) {
  const root = new THREE.Group(); root.userData.madeI = m.i; // (the Build tab finds the one you're making)
  for (const p of m.b) {
    const mat = M(p.c, { ...(p.m ? { metalness: 0.75, roughness: 0.25 } : {}), ...(p.g ? { emissive: new THREE.Color(p.c), emissiveIntensity: 0.8 } : {}), side: THREE.DoubleSide });
    const mesh = part(root, geoOf(p.s), mat, p.p[0], p.p[1], p.p[2]); mesh.userData.piece = root.children.length - 1;
    mesh.scale.set(p.k[0], p.k[1], p.k[2]);
    mesh.rotation.set(p.r[0] * D2R, p.r[1] * D2R, p.r[2] * D2R);
  }
  return root;
}

export function animateAvatar(g, dt, grounded, speed) {
  const L = g.userData.limbs;
  g.userData.t += dt * Math.min(1, speed / 6) * 10;
  const swing = grounded ? Math.sin(g.userData.t) * Math.min(0.8, speed / 14) : 0.5;
  L.legL.rotation.x = swing; L.legR.rotation.x = -swing; L.armL.rotation.x = -swing; L.armR.rotation.x = swing;
}

// ---------------------------------------------------------------- pictures of avatars (friends list, profile, top bar)
let shot = null;
const shotCache = new Map();
export function avatarPicture(cfg, size, full) {
  const key = JSON.stringify(sanitizeAvatar(cfg)) + size + (full ? "f" : "h");
  if (shotCache.has(key)) return shotCache.get(key);
  try {
    if (!shot) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
      const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-2, 4, -5); sc.add(d);
      shot = { r, sc, cam: new THREE.PerspectiveCamera(30, 1, 0.1, 50) };
    }
    shot.r.setSize(size, size, false);
    const av = buildAvatar(cfg);
    av.rotation.y = 0.35;
    shot.sc.add(av);
    if (full) { shot.cam.position.set(0, 1.9, -9.2); shot.cam.lookAt(0, 1.75, 0); }
    else { shot.cam.position.set(0, 2.95, -4.0); shot.cam.lookAt(0, 2.8, 0); }
    shot.r.render(shot.sc, shot.cam);
    shot.sc.remove(av);
    const url = shot.r.domElement.toDataURL("image/png");
    shotCache.set(key, url);
    return url;
  } catch { return ""; }
}
