// LAST TRAIN WEST: the desert, the railroad and everything along it.
// The track runs straight along +X from the depot (x = 0) to Sundown Station (x = LEN). Towns, two forts, cabins,
// wagons and coal depots sit beside it. Everything is built from code (boxes + a few shapes) when you get close,
// and thrown away once it's far behind the train.
import * as THREE from "/create/vendor/three.module.js";

export const LEN = 12000; // meters of track (12 km)
export const DECK = 1.25; // the top of the train's floor
const CH = 200; // ground chunk length

// ---------------------------------------------------------------- a seeded random (the same world every run)
let seed = 1;
export const srand = (s) => { seed = s >>> 0 || 1; };
export const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + rnd() * (b - a);

// ---------------------------------------------------------------- the places along the line
export const TOWNS = [
  { x: 1500, name: "Dry Gulch" },
  { x: 3700, name: "Copperhead" },
  { x: 7300, name: "Last Chance" },
  { x: 10100, name: "Rattler Flats" },
];
export const FORTS = [{ x: 5300, side: -1, name: "Fort Cinder" }];
export const KEEPS = [{ x: 8700, side: 1, name: "Crimson Keep" }];
const FLAT = [[0, 120, 70], ...TOWNS.map((t) => [t.x - 30, t.x + 250, 80]), ...FORTS.map((f) => [f.x - 40, f.x + 80, 110]), ...KEEPS.map((f) => [f.x - 50, f.x + 90, 120]), [LEN - 120, LEN + 200, 80]];

const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
export function groundH(x, z) {
  const az = Math.abs(z);
  let h = Math.sin(x * 0.011 + z * 0.006) * 2.2 + Math.sin(x * 0.027 - z * 0.019) * 1.2 + Math.sin(z * 0.031 + 1.7) * 0.9 + Math.sin(x * 0.0021) * 4;
  h = Math.max(0, h + 3) * Math.min(1, Math.max(0, (az - 9) / 45)); // (flat near the track, dunes further out)
  // tall mesas far out
  const m = Math.sin(x * 0.0043 + 1.3) * Math.sin(z * 0.02);
  if (az > 120 && m > 0.55) h += (m - 0.55) * 60 * Math.min(1, (az - 120) / 30);
  for (const [a, b, w] of FLAT) if (x > a - 60 && x < b + 60 && az < w + 40) {
    const kx = Math.min(1, Math.max(0, Math.max(a - x, x - b) / 60)), kz = Math.min(1, Math.max(0, (az - w) / 40));
    h *= Math.max(kx, kz);
  }
  return h;
}

// ---------------------------------------------------------------- shared materials
const L = (c) => new THREE.MeshLambertMaterial({ color: c });
export const MAT = {
  sand: new THREE.MeshLambertMaterial({ vertexColors: true }),
  rail: new THREE.MeshPhongMaterial({ color: 0x8a8a90, shininess: 50 }), tie: L(0x4a3426), ballast: L(0x8a7a68),
  wood: L(0x8a5a34), woodD: L(0x5a3a22), woodL: L(0xb08050), plank: L(0x9a6a3a), roof: L(0x4a3428), red: L(0x8a2a22),
  stone: L(0x8a8478), stoneD: L(0x5a5650), keep: L(0x3a3236), keepD: L(0x2a2428), iron: L(0x3a3a40), gold: new THREE.MeshPhongMaterial({ color: 0xffc83a, shininess: 80, emissive: 0x3a2a00 }),
  cactus: L(0x4a7a3a), rock: L(0x9a7a5a), bone: L(0xe8e0c8), glass: new THREE.MeshBasicMaterial({ color: 0x1a1a22 }), lamp: new THREE.MeshBasicMaterial({ color: 0xffd080 }),
  canvas: L(0xe8dcc0), coal: L(0x222226), counter: L(0x6a4428), green: L(0x3a5a3a),
};

// a sign: words painted on a board
const signCache = {};
function signMat(text, bg = "#3a2416", fg = "#f4e2b8") {
  if (signCache[text]) return signCache[text];
  const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = fg; g.font = "bold 64px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  let s = 64; while (g.measureText(text).width > 470 && s > 20) { s -= 4; g.font = `bold ${s}px Georgia, serif`; }
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (signCache[text] = new THREE.MeshLambertMaterial({ map: t }));
}

// ---------------------------------------------------------------- building blocks
// a box that is also a wall (added to the collider list)
function solid(P, w, h, d, x, y, z, m, col = true) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); b.castShadow = true; b.receiveShadow = true; P.g.add(b);
  if (col) P.cols.push({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2 });
  return b;
}
const deco = (P, w, h, d, x, y, z, m) => solid(P, w, h, d, x, y, z, m, false);

// a western building: 4 walls with a door facing the track, a roof, a tall false front with a sign.
// face = -1 when the door is on the -Z side (the building is on the +Z side of the track) and +1 the other way.
function building(P, x, z, w, d, h, wallM, sign, face, kind) {
  const t = 0.3, dz = face * d / 2, door = 2.2, y = groundH(x, z);
  // front wall (with the door gap), back wall, sides
  const fw = (w - door) / 2;
  solid(P, fw, h, t, x - w / 2 + fw / 2, y, z + dz, wallM); solid(P, fw, h, t, x + w / 2 - fw / 2, y, z + dz, wallM);
  deco(P, door, h - 2.6, t, x, y + 2.6, z + dz, wallM);
  solid(P, w, h, t, x, y, z - dz, wallM);
  solid(P, t, h, d, x - w / 2, y, z, wallM); solid(P, t, h, d, x + w / 2, y, z, wallM);
  deco(P, w - 0.1, 0.1, d - 0.1, x, y, z, MAT.plank); // floor
  const roof = deco(P, w + 0.6, 0.25, d + 0.6, x, y + h, z, MAT.roof); roof.castShadow = true;
  // the tall false front + its sign
  deco(P, w + 0.2, 2.2, 0.25, x, y + h, z + dz + face * 0.1, wallM);
  if (sign) { const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1, 7), 1.6), signMat(sign)); s.position.set(x, y + h + 1.1, z + dz + face * 0.25); s.rotation.y = face > 0 ? 0 : Math.PI; P.g.add(s); }
  // a porch roof on posts + windows
  deco(P, w + 0.6, 0.15, 2.4, x, y + 3.0, z + dz + face * 1.3, MAT.woodD);
  for (const sx of [-1, 1]) deco(P, 0.2, 3, 0.2, x + sx * (w / 2), y, z + dz + face * 2.4, MAT.woodD);
  for (const sx of [-1, 1]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), MAT.glass); win.position.set(x + sx * w * 0.3, y + 1.8, z + dz + face * 0.17); win.rotation.y = face > 0 ? 0 : Math.PI; P.g.add(win); }
  // inside: a lamp, loot spots, a counter for shops
  const back = z - dz * 0.6;
  if (kind) {
    solid(P, Math.min(w - 2, 5), 1.1, 0.8, x, y, back + face * 0.6, MAT.counter);
    P.inter.push({ kind, x, z: back + face * 1.6, y, r: 2.4, name: sign });
  }
  for (let i = 0; i < 3; i++) P.spots.push({ x: x + rr(-w / 2 + 1, w / 2 - 1), z: z + rr(-d / 2 + 1, d / 2 - 1) * 0.6 + (kind ? face * 1.2 : 0), y });
  P.inside.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: y + h });
  return y;
}

function fence(P, x0, x1, z, y = 0) {
  for (let x = x0; x <= x1; x += 2.5) deco(P, 0.15, 1.1, 0.15, x, y, z, MAT.woodD);
  deco(P, x1 - x0, 0.12, 0.08, (x0 + x1) / 2, y + 0.9, z, MAT.wood); deco(P, x1 - x0, 0.12, 0.08, (x0 + x1) / 2, y + 0.5, z, MAT.wood);
}
function coalPile(P, x, z) {
  const y = groundH(x, z), m = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 7), MAT.coal); m.position.set(x, y + 0.8, z); P.g.add(m);
  for (let i = 0; i < 4; i++) P.spots.push({ x: x + rr(-2.5, 2.5), z: z + rr(-2.5, 2.5), y, coal: true });
}
function wagon(P, x, z) {
  const y = groundH(x, z) + 0.6;
  solid(P, 4, 0.9, 2, x, y, z, MAT.wood);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 3.8, 10, 1, true, 0, Math.PI), MAT.canvas); top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.set(x, y + 0.9, z); P.g.add(top);
  for (const [a, b] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 14), MAT.woodD); w.position.set(x + a, y, z + b * 1.05); P.g.add(w); }
  P.spots.push({ x: x + rr(-1, 1), z: z + rr(-0.5, 0.5), y: y + 0.9 }, { x: x + 2.8, z, y: y - 0.6 });
}

// ---------------------------------------------------------------- each kind of place
function town(P, t) {
  const blocks = [
    ["SHERIFF", "sheriff", 9, 8, 4.4, MAT.woodL, 1], ["GENERAL STORE", "store", 10, 9, 4.6, MAT.wood, 1], ["GUNSMITH", "guns", 8, 8, 4.2, MAT.red, 1],
    ["BANK", "bank", 10, 9, 5, MAT.stone, -1], ["SALOON", null, 12, 10, 5.4, MAT.wood, -1], ["HOTEL", null, 10, 9, 6, MAT.woodL, -1],
  ];
  let xs = { 1: t.x, [-1]: t.x };
  for (const [sign, kind, w, d, h, m, side] of blocks) {
    const z = side * (18 + d / 2), x = xs[side] + w / 2;
    building(P, x, z, w, d, h, m, sign, -side, kind === "bank" ? null : kind);
    xs[side] += w + 5;
    if (kind === "bank") { solid(P, 2.2, 2.4, 1.2, x, 0, z + side * (d / 2 - 1.2), MAT.iron); P.inter.push({ kind: "vault", x, z: z + side * (d / 2 - 2.4), y: 0, r: 2.6, name: "Vault" }); P.vault = { x, z: z + side * (d / 2 - 2.6) }; }
  }
  // a station platform + water tower + coal by the track
  deco(P, 30, 0.9, 4, t.x + 40, 0, -6.2, MAT.plank);
  const tw = t.x + 70; for (const [a, b] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) deco(P, 0.3, 6, 0.3, tw + a, 0, -9 + b, MAT.woodD);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.2, 12), MAT.wood); tank.position.set(tw, 7.6, -9); tank.castShadow = true; P.g.add(tank);
  coalPile(P, t.x + 18, -9); coalPile(P, t.x + 100, 8);
  const st = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), signMat(t.name.toUpperCase())); st.position.set(t.x + 40, 3.2, -7.6); P.g.add(st);
  deco(P, 0.2, 3, 0.2, t.x + 36, 0, -7.7, MAT.woodD); deco(P, 0.2, 3, 0.2, t.x + 44, 0, -7.7, MAT.woodD);
  fence(P, t.x - 10, t.x + 8, -14); fence(P, xs[1] + 2, xs[1] + 30, 14);
  // a few houses further out
  for (let i = 0; i < 4; i++) { const side = i % 2 ? 1 : -1; building(P, t.x + 20 + i * 30, side * 52, 8, 7, 3.6, i % 2 ? MAT.woodL : MAT.wood, null, -side, null); }
  for (let i = 0; i < 10; i++) P.foes.push({ x: t.x + rr(0, 200), z: (rnd() < 0.5 ? -1 : 1) * rr(10, 45) });
}

function fort(P, f) {
  const cx = f.x + 20, cz = f.side * 60, S = 44, H = 5.5, gate = 7, y = 0;
  const near = cz - f.side * S / 2, far = cz + f.side * S / 2;
  // log walls with the gate toward the track
  const part = (S - gate) / 2;
  solid(P, part, H, 1, cx - S / 2 + part / 2, y, near, MAT.woodD); solid(P, part, H, 1, cx + S / 2 - part / 2, y, near, MAT.woodD);
  deco(P, gate, 1.5, 1, cx, y + H - 1.5, near, MAT.woodD);
  solid(P, S, H, 1, cx, y, far, MAT.woodD); solid(P, 1, H, S, cx - S / 2, y, cz, MAT.woodD); solid(P, 1, H, S, cx + S / 2, y, cz, MAT.woodD);
  // pointy log tops
  for (let i = -S / 2; i <= S / 2; i += 1.5) for (const zz of [near, far]) { if (zz === near && Math.abs(i) < gate / 2) continue; const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 5), MAT.woodD); c.position.set(cx + i, H + 0.5, zz); P.g.add(c); }
  // corner towers with platforms
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const tx = cx + sx * S / 2, tz = cz + sz * S / 2; solid(P, 3.4, 8, 3.4, tx, y, tz, MAT.wood); deco(P, 4.2, 0.4, 4.2, tx, 8, tz, MAT.roof); const r = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2, 4), MAT.roof); r.position.set(tx, 9.4, tz); r.rotation.y = Math.PI / 4; P.g.add(r); }
  // a flag
  deco(P, 0.15, 12, 0.15, cx, 0, cz, MAT.iron); const fl = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), L(0x7a2a2a)); fl.material.side = THREE.DoubleSide; fl.position.set(cx + 1.5, 11, cz); P.g.add(fl);
  // inside: barracks + the armory (a gun locker), crates, a cannon
  building(P, cx - 9, far - f.side * 8, 14, 8, 4, MAT.wood, "BARRACKS", -f.side, null);
  building(P, cx + 11, far - f.side * 8, 9, 8, 4, MAT.stone, "ARMORY", -f.side, null);
  P.armory = { x: cx + 11, z: far - f.side * 8 };
  for (let i = 0; i < 6; i++) solid(P, 1.2, 1.2, 1.2, cx + rr(-14, 14), y, cz + rr(-8, 4) * f.side, MAT.wood);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3, 10), MAT.iron); can.rotation.x = Math.PI / 2; can.position.set(cx - 4, 1.1, near + f.side * 3); P.g.add(can);
  for (let i = 0; i < 8; i++) P.spots.push({ x: cx + rr(-18, 18), z: cz + rr(-16, 16), y: 0 });
  for (let i = 0; i < 14; i++) P.foes.push({ x: cx + rr(-18, 18), z: cz + rr(-18, 18), kind: "soldier" });
  P.name = f.name;
}

function keep(P, k) {
  const cx = k.x + 20, cz = k.side * 70, S = 54, H = 9, gate = 6, y = 0;
  const near = cz - k.side * S / 2, far = cz + k.side * S / 2, part = (S - gate) / 2;
  solid(P, part, H, 2, cx - S / 2 + part / 2, y, near, MAT.keep); solid(P, part, H, 2, cx + S / 2 - part / 2, y, near, MAT.keep);
  deco(P, gate, 3, 2, cx, y + H - 3, near, MAT.keep);
  solid(P, S, H, 2, cx, y, far, MAT.keep); solid(P, 2, H, S, cx - S / 2, y, cz, MAT.keep); solid(P, 2, H, S, cx + S / 2, y, cz, MAT.keep);
  for (let i = -S / 2; i <= S / 2; i += 2) for (const zz of [near, far]) if (!(zz === near && Math.abs(i) < gate / 2)) deco(P, 1, 1, 2.2, cx + i, H, zz, MAT.keepD);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const tx = cx + sx * S / 2, tz = cz + sz * S / 2; const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 14, 10), MAT.keep); t.position.set(tx, 7, tz); t.castShadow = true; P.g.add(t); P.cols.push({ x0: tx - 3, x1: tx + 3, y0: 0, y1: 14, z0: tz - 3, z1: tz + 3 }); const r = new THREE.Mesh(new THREE.ConeGeometry(3.8, 5, 10), MAT.red); r.position.set(tx, 16.5, tz); P.g.add(r); }
  // the great hall in the middle (the Baron waits inside)
  const hx = cx, hz = cz + k.side * 6;
  building(P, hx, hz, 22, 16, 8, MAT.keepD, "THE GREAT HALL", -k.side, null);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 10, 10), MAT.keep); tower.position.set(hx, 13, hz); P.g.add(tower);
  const sp = new THREE.Mesh(new THREE.ConeGeometry(3.2, 6, 10), MAT.red); sp.position.set(hx, 21, hz); P.g.add(sp);
  P.chest = { x: hx, z: hz + k.side * 5 };
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), MAT.bone); c.position.set(cx + rr(-20, 20), 1.1, near - k.side * rr(4, 20)); c.rotation.z = rr(-0.3, 0.3); P.g.add(c); }
  for (let i = 0; i < 6; i++) P.spots.push({ x: hx + rr(-9, 9), z: hz + rr(-6, 6), y: 0 });
  for (let i = 0; i < 10; i++) P.foes.push({ x: cx + rr(-22, 22), z: cz + rr(-22, 22), kind: rnd() < 0.5 ? "vamp" : "walker" });
  P.boss = { x: hx, z: hz };
  P.name = k.name;
}

function cabin(P, x, z) {
  const side = Math.sign(z);
  building(P, x, z, 7, 6, 3.4, rnd() < 0.5 ? MAT.wood : MAT.woodL, null, -side, null);
  if (rnd() < 0.5) fence(P, x - 8, x + 8, z + side * 6);
  for (let i = 0; i < 2; i++) P.foes.push({ x: x + rr(-8, 8), z: z + rr(-8, 8) });
}
function mine(P, x, z) {
  const y = groundH(x, z), side = Math.sign(z);
  const hill = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.rock); hill.position.set(x, y - 1, z + side * 10); hill.scale.y = 0.7; P.g.add(hill);
  deco(P, 4, 4, 0.5, x, y, z + side * 0.2, MAT.woodD); deco(P, 3, 3, 0.3, x, y, z + side * 0.5, MAT.glass);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1), MAT.iron); c.position.set(x - 6 + i * 2, y + 0.6, z - side * 3); P.g.add(c); }
  for (let i = 0; i < 6; i++) P.spots.push({ x: x + rr(-7, 7), z: z - side * rr(2, 6), y, coal: true });
  P.foes.push({ x: x + 4, z: z - side * 4, kind: "brute" }, { x: x - 4, z: z - side * 5 });
}
function station(P) {
  const x = LEN;
  deco(P, 60, 0.9, 6, x + 10, 0, -6.6, MAT.plank);
  building(P, x + 10, -16, 20, 10, 6, MAT.woodL, "SUNDOWN STATION", 1, null);
  deco(P, 3, 1.5, 3, LEN + 60, 0, 0, MAT.red); // the buffer stop
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), MAT.lamp); l.position.set(x - 10 + i * 12, 3.2, -4.4); P.g.add(l); deco(P, 0.15, 3, 0.15, x - 10 + i * 12, 0, -4.4, MAT.iron); }
}

// ---------------------------------------------------------------- the list of everything (made once per run)
export function makePlaces() {
  srand(777);
  const list = [];
  const add = (x, type, data = {}) => list.push({ x, type, ...data, built: false });
  add(0, "depot");
  for (const t of TOWNS) add(t.x, "town", { t });
  for (const f of FORTS) add(f.x, "fort", { f });
  for (const k of KEEPS) add(k.x, "keep", { k });
  add(LEN, "station");
  const busy = (x) => list.some((p) => Math.abs(p.x - x) < (p.type === "town" ? 300 : p.type === "fort" || p.type === "keep" ? 150 : 50));
  for (let x = 250; x < LEN - 150; x += rr(90, 190)) {
    if (busy(x)) continue;
    const r = rnd(), side = rnd() < 0.5 ? -1 : 1;
    if (r < 0.42) add(x, "cabin", { z: side * rr(16, 40) });
    else if (r < 0.62) add(x, "wagon", { z: side * rr(8, 26) });
    else if (r < 0.8) add(x, "coal", { z: side * rr(7, 14) });
    else if (r < 0.9) add(x, "mine", { z: side * rr(28, 40) });
    else add(x, "camp", { z: side * rr(15, 30) });
  }
  list.sort((a, b) => a.x - b.x);
  return list;
}

export class World {
  constructor(scene) {
    this.scene = scene; this.places = makePlaces(); this.chunks = new Map(); this.cols = []; this.lamps = []; this.inter = []; this.inside = [];
    // the ground chunks share these
    this.cactusGeo = (() => { const a = new THREE.CylinderGeometry(0.35, 0.4, 3.2, 7).translate(0, 1.6, 0), b = new THREE.CylinderGeometry(0.22, 0.22, 1.4, 6).translate(0.7, 2.1, 0), c = new THREE.CylinderGeometry(0.2, 0.2, 1.1, 6).translate(-0.6, 1.8, 0); return mergeGeos([a, b, c]); })();
    this.rockGeo = new THREE.DodecahedronGeometry(1, 0);
    this.poleGeo = mergeGeos([new THREE.CylinderGeometry(0.12, 0.14, 7, 6).translate(0, 3.5, 0), new THREE.BoxGeometry(0.15, 0.15, 1.6).translate(0, 6.6, 0)]);
  }
  // build what's near the train, drop what's far behind
  update(px, onBuilt) {
    const c0 = Math.floor((px - 260) / CH), c1 = Math.floor((px + 520) / CH);
    for (let c = c0; c <= c1; c++) if (!this.chunks.has(c)) this.chunks.set(c, this.chunk(c));
    for (const [c, ck] of this.chunks) if (c < c0 - 1 || c > c1 + 1) { this.scene.remove(ck); ck.traverse((o) => o.geometry && !o.userData.shared && o.geometry.dispose()); this.chunks.delete(c); }
    for (const p of this.places) {
      const near = p.x > px - 300 && p.x < px + 450;
      if (near && !p.built) { this.build(p); onBuilt && onBuilt(p); }
      else if (!near && p.built && p.x < px - 300) this.unbuild(p);
    }
  }
  build(p) {
    srand(Math.floor(p.x * 13 + 7));
    const P = { g: new THREE.Group(), cols: [], lamps: [], inter: [], spots: [], foes: [], inside: [] };
    if (p.type === "town") town(P, p.t);
    else if (p.type === "fort") fort(P, p.f);
    else if (p.type === "keep") keep(P, p.k);
    else if (p.type === "station") station(P);
    else if (p.type === "cabin") cabin(P, p.x, p.z);
    else if (p.type === "wagon") wagon(P, p.x, p.z);
    else if (p.type === "coal") { coalPile(P, p.x, p.z); P.foes.push({ x: p.x + 5, z: p.z * 1.8 }); }
    else if (p.type === "mine") mine(P, p.x, p.z);
    else if (p.type === "camp") { const y = groundH(p.x, p.z); const t = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 6), MAT.canvas); t.position.set(p.x, y + 1.5, p.z); P.g.add(t); const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 6), MAT.red); f.position.set(p.x + 4, y + 0.3, p.z); P.g.add(f); for (let i = 0; i < 3; i++) P.spots.push({ x: p.x + rr(-4, 4), z: p.z + rr(-4, 4), y }); P.foes.push({ x: p.x + 6, z: p.z, kind: "runner" }, { x: p.x - 6, z: p.z }); }
    else if (p.type === "depot") { building(P, 20, -16, 12, 8, 4.5, MAT.woodL, "DEPOT", 1, "store"); deco(P, 40, 0.9, 4, 30, 0, -6.2, MAT.plank); coalPile(P, 60, -9); }
    this.scene.add(P.g);
    p.P = P; p.built = true;
    this.cols.push(...P.cols); this.lamps.push(...P.lamps); this.inter.push(...P.inter); this.inside.push(...P.inside);
  }
  unbuild(p) {
    const P = p.P; this.scene.remove(P.g); P.g.traverse((o) => o.geometry && o.geometry.dispose());
    const rm = (arr, sub) => { const s = new Set(sub); return arr.filter((a) => !s.has(a)); };
    this.cols = rm(this.cols, P.cols); this.lamps = rm(this.lamps, P.lamps); this.inter = rm(this.inter, P.inter); this.inside = rm(this.inside, P.inside);
    p.built = false; p.P = null; p.gone = true;
  }
  chunk(c) {
    const g = new THREE.Group(), x0 = c * CH;
    // the ground: a strip 600 m wide
    const geo = new THREE.PlaneGeometry(CH, 640, 40, 96); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + x0 + CH / 2, z = pos.getZ(i), h = groundH(x, z); pos.setY(i, h);
      const n = hash(Math.round(x), Math.round(z)) * 0.06, k = Math.min(1, h / 30);
      col[i * 3] = 0.86 - k * 0.25 + n; col[i * 3 + 1] = 0.68 - k * 0.25 + n; col[i * 3 + 2] = 0.45 - k * 0.18 + n;
      if (Math.abs(z) < 3.2) { col[i * 3] = 0.55; col[i * 3 + 1] = 0.5; col[i * 3 + 2] = 0.44; }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, MAT.sand); ground.position.x = x0 + CH / 2; ground.receiveShadow = true; g.add(ground);
    if (x0 < LEN + 100 && x0 + CH > -40) {
      const a = Math.max(x0, -40), b = Math.min(x0 + CH, LEN + 60), len = b - a, mid = (a + b) / 2;
      for (const z of [-0.75, 0.75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.1), MAT.rail); r.position.set(mid, 0.38, z); g.add(r); }
      const bal = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 3.4), MAT.ballast); bal.position.set(mid, 0.1, 0); bal.receiveShadow = true; g.add(bal);
      const n = Math.floor(len / 0.9), ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.12, 2.5), MAT.tie, n), m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m.makeTranslation(a + i * 0.9 + 0.45, 0.24, 0); ties.setMatrixAt(i, m); }
      ties.receiveShadow = true; g.add(ties);
    }
    // cacti, rocks, telegraph poles
    srand(c * 9176 + 3);
    const cac = new THREE.InstancedMesh(this.cactusGeo, MAT.cactus, 40), rock = new THREE.InstancedMesh(this.rockGeo, MAT.rock, 40), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let nc = 0, nr = 0;
    for (let i = 0; i < 70; i++) {
      const x = x0 + rnd() * CH, z = (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 200), k = rnd();
      if (this.places.some((p) => Math.abs(p.x + 60 - x) < 140 && (p.type === "town" || p.type === "fort" || p.type === "keep" || p.type === "station") && Math.abs(z) < 130)) continue;
      const y = groundH(x, z);
      if (k < 0.55 && nc < 40) { q.setFromAxisAngle(v.set(0, 1, 0), rnd() * 6); const sc = 0.7 + rnd() * 0.8; m.compose(v.set(x, y - 0.1, z), q, s.set(sc, sc, sc)); cac.setMatrixAt(nc++, m); }
      else if (nr < 40) { q.setFromAxisAngle(v.set(rnd(), 1, rnd()).normalize(), rnd() * 6); const sc = 0.5 + rnd() * 2.2; m.compose(v.set(x, y, z), q, s.set(sc, sc * 0.7, sc)); rock.setMatrixAt(nr++, m); }
    }
    cac.count = nc; rock.count = nr; cac.castShadow = rock.castShadow = true; cac.userData.shared = rock.userData.shared = true; g.add(cac, rock);
    if (x0 < LEN && x0 + CH > 0) { const poles = new THREE.InstancedMesh(this.poleGeo, MAT.woodD, 5); poles.userData.shared = true; for (let i = 0; i < 5; i++) { m.makeTranslation(x0 + i * 40 + 20, 0, -7.5); poles.setMatrixAt(i, m); } g.add(poles); }
    this.scene.add(g);
    return g;
  }
  // is a point inside a building? (rain of light from the sky doesn't reach in, and vampires don't burn there)
  indoors(x, z) { return this.inside.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1); }
}

function mergeGeos(list) {
  const pos = [], nor = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return g;
}
export { mergeGeos, signMat };
