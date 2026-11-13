// MUD VALLEY RP: going inside! Every house and building has a door: walk up to it and press E.
// To keep it fast on a Chromebook, only ONE room exists at a time: it's built (from a few merged boxes) when you walk in
// and thrown away when you walk out. Rooms are built far away from the valley (at POCKET), so the town never has to be
// drawn while you're inside.
import * as THREE from "/create/vendor/three.module.js";
import { HOUSES, PAWNS } from "./layout.js";
import { Batch, prismGeo } from "./build.js";
import { makePerson, LOOKS } from "./character.js";
import { S } from "./save.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const POCKET = { x: 5000, z: 5000 }; // where the room you're in gets built
export const ROOM_H = 4.4;

// ---------------------------------------------------------------- every building you can walk into
// x, z, yaw = where the building is (same as in world.js); door = the front door in the building's own directions;
// w, d = the room size; kind = what's inside; menu = the shop screen the counter opens
const T = (id, name, kind, x, z, yaw, door, w, d, extra = {}) => ({ id, name, kind, x, z, yaw, door, w, d, ...extra });
export const BUILDINGS = [
  T("dealer", "Valley Motors", "shop", -36, 41, Math.PI, [0, 13.6], 26, 16, { menu: "dealer", keeper: "Sales clerk", goods: "cars" }),
  T("customs", "Mud & Chrome Customs", "garage", 36, -41, 0, [0, 11.6], 20, 14, { keeper: "Mechanic" }),
  T("jobs", "Job Center", "shop", -36, -41, 0, [0, 10.6], 18, 12, { menu: "jobs", keeper: "Job counselor", goods: "papers" }),
  T("post", "Post Office", "shop", 22, 40, Math.PI, [0, 9.6], 14, 10, { keeper: "Mail clerk", goods: "boxes" }),
  T("pizza", "Pizza Pete’s", "diner", 51, 40, Math.PI, [7.5, 9.6], 14, 10, { keeper: "Pete" }),
  T("gas", "Gas Station Shop", "gas", 91, -30, 0, [9, -15.4], 10, 8, { keeper: "Cashier" }),
  T("diner", "Mud Valley Diner", "diner", 91, 38, Math.PI, [9, 7.6], 16, 10, { keeper: "Waiter" }),
  T("townhall", "Town Hall", "office", -91, -36, 0, [0, 9], 18, 12, { keeper: "The Mayor" }),
  T("school", "Valley School", "school", 18, -82, 0, [0, 7.6], 16, 10, { keeper: "Teacher" }),
  T("hardware", "Valley Hardware", "shop", 90, -82, 0, [0, 7.6], 16, 10, { keeper: "Clerk", goods: "tools" }),
  ...[[-40, -80, 0], [42, -80, 0], [-90, 80, Math.PI], [-40, 80, Math.PI], [-18, 80, Math.PI], [18, 80, Math.PI], [40, 80, Math.PI], [90, 80, Math.PI]].map(([x, z, yaw], k) => T("town" + k, "A neighbor’s house", "neighbor", x, z, yaw, [(11 + (k % 3)) / 2 - 2, 5.1], 11, 8)),
  T("lumber", "Lumber Yard Office", "office", -304, -10, 0, [14, -2.4], 8, 6, { keeper: "Foreman" }),
  T("ranger", "Ranger Station", "office", -300, 289, 0, [10, 3.6], 8, 6, { keeper: "Ranger" }),
  T("bait", "Bait & Tackle", "shop", 404, 132, Math.PI / 2, [0, 3.8], 9, 7, { menu: "bait", keeper: "Old fisher", goods: "fish" }),
  T("hideout", "Robber Hideout", "hideout", -462, -262, Math.PI / 2, [0, 4.1], 10, 8, { menu: "hideout" }),
  T("barn", "The Big Red Barn", "barn", 66, 254, Math.PI, [0, 7.6], 16, 12),
  T("bank", "Copper Creek Bank", "bank", 330, -345, 0, [0, 9.7], 20, 14, { keeper: "Bank teller" }),
  T("jewelry", "Sparkle Jewelry", "jewelry", 366, -343, 0, [0, 7.6], 16, 12, { keeper: "Jeweler" }),
  T("police", "Police Station", "police", 428, -349, 0, [-6, 9.6], 22, 14, { menu: "police", keeper: "Desk sergeant" }),
  T("hospital", "Hospital", "hospital", 484, -344, 0, [0, 8.6], 18, 12, { keeper: "Nurse" }),
  T("gear", "Tool Barn", "shop", 330, -300, Math.PI, [0, 7.6], 16, 12, { menu: "gear", keeper: "Shopkeeper", goods: "tools" }),
  T("blasters", "Gun Shop", "shop", 366, -300, Math.PI, [0, 7.6], 16, 12, { menu: "blasters", keeper: "Shopkeeper", goods: "blasters" }),
  T("cafe", "Copper Cafe", "cafe", 418, -301, Math.PI, [0, 6.6], 12, 10, { keeper: "Barista" }),
  T("toys", "Toy Train Shop", "shop", 436, -301, Math.PI, [0, 6.6], 12, 10, { keeper: "Toy maker", goods: "toys" }),
  ...PAWNS.map((p, i) => T("pawn" + i, "Pawn Shop", "shop", p.x, p.z, p.yaw, [0, 6.6], 12, 10, { menu: "pawn", keeper: "Pawn broker", goods: "pawn" })),
];
// the houses (you can tour any of them, and your own ones show your stuff)
const HOUSE_ROOM = { camper: [[2.8, 2.4], 9, 5], cabin: [[0, 5.2], 12, 8], family: [[-1.5, 5.6], 14, 10], farm: [[0, 5.6], 14, 10], mansion: [[-4, 6.8], 22, 14] };
for (const h of HOUSES) {
  if (!h.build) continue;
  const r = h.build === "small" ? [[(11 + ((h.look || 0) % 3)) / 2 - 2, 5.1], 11, 8] : HOUSE_ROOM[h.build];
  BUILDINGS.push(T("h_" + h.id, h.name, "home", h.x, h.z, h.yaw, r[0], r[1], r[2], { house: h }));
}
// world spot of a building's front door (and which way is "out")
for (const b of BUILDINGS) {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw), [lx, lz] = b.door;
  b.dx = b.x + lx * c + lz * s; b.dz = b.z - lx * s + lz * c; b.out = b.yaw;
}
export const buildingById = (id) => BUILDINGS.find((b) => b.id === id);

// the robbery spots that are INSIDE buildings (room coordinates: 0, 0 = the middle of the room, the door is at +z)
export const INSIDE_SPOTS = {
  gas: { x: 1.2, z: -0.6 }, cafe: { x: 1.2, z: -1.6 },
  case0: { x: -4, z: 0.9 }, case1: { x: 0, z: 0.9 }, case2: { x: 4, z: 0.9 },
  vault: { x: 5.5, z: -3.5 }, // (in front of the vault door: drill it open)
  gold: { x: 5.5, z: -5.6 }, // (inside the vault, once the door is open)
};
// the vault room in the bank (room coordinates): its doorway, where the door's hinge is
export const VAULT = { x0: 2, z: -4.4, door0: 4, door1: 7, doorH: 3 };
// people behind a counter you can hold up (heist.js): loot range, how many stars, what they're called
export const HOLDUP = {
  bank: { loot: [600, 900], heat: 2, who: "teller" }, jewelry: { loot: [400, 650], heat: 2, who: "jeweler" },
  gas: { loot: [150, 260], heat: 1, who: "cashier" }, cafe: { loot: [150, 260], heat: 1, who: "barista" }, diner: { loot: [150, 260], heat: 1, who: "waiter" },
  pizza: { loot: [150, 260], heat: 1, who: "pizza guy" }, toys: { loot: [150, 260], heat: 1, who: "toy maker" }, hardware: { loot: [180, 300], heat: 1, who: "clerk" }, post: { loot: [120, 220], heat: 1, who: "mail clerk" },
};
export const JAIL_SPOT = { x: -7.2, z: -4.6 }; // inside the police station: the first jail cell

// ---------------------------------------------------------------- building a room
const WALL = { shop: 0xf2ece0, garage: 0xb8bcc4, diner: 0xffe9c8, gas: 0xf4f0e8, office: 0xe8e2d4, school: 0xffe2b0, neighbor: 0xd8ecf8, hideout: 0x7a6a50, barn: 0xb84a2a, bank: 0xe8e2d4, jewelry: 0xf4e4f8, police: 0xdfe6f4, hospital: 0xf4fbff, cafe: 0xf2e0c8, home: 0xf4ead8 };
const FLOOR = { shop: 0xc8b090, garage: 0x6a6e78, diner: 0xd8d0c0, gas: 0xd0d0d0, office: 0x9a6a3a, school: 0xb08a5a, neighbor: 0xa8784a, hideout: 0x5a4a3a, barn: 0xc8a050, bank: 0xd8d0c0, jewelry: 0xe0d8f0, police: 0x9aa0aa, hospital: 0xd8e8f0, cafe: 0x9a6a3a, home: 0xa8784a };
function room(B, w, d, kind) {
  const b = new Batch(); b.at(0, 0, 0);
  const wall = WALL[kind] || 0xeeeeee, H = ROOM_H;
  b.box(w, 0.1, d, 0, -0.1, 0, FLOOR[kind] || 0xaaaaaa);
  if (kind !== "barn" && kind !== "garage") for (let i = -w / 2 + 1; i < w / 2; i += 2) b.box(0.05, 0.012, d, i, 0, 0, (FLOOR[kind] || 0xaaaaaa) - 0x181818 > 0 ? (FLOOR[kind] || 0xaaaaaa) & 0xdedede : 0x555555); // floor boards
  b.box(w + 0.4, 0.2, d + 0.4, 0, H, 0, kind === "hideout" ? 0x5a4a3a : 0xfafafa); // ceiling
  b.box(w + 0.4, H, 0.2, 0, 0, -d / 2 - 0.1, wall); // back wall
  b.box(0.2, H, d, -w / 2 - 0.1, 0, 0, wall); b.box(0.2, H, d, w / 2 + 0.1, 0, 0, wall); // side walls
  // the front wall, with the door (a 2 m gap) in the middle
  const half = (w - 2) / 2;
  b.box(half, H, 0.2, -w / 2 + half / 2, 0, d / 2 + 0.1, wall); b.box(half, H, 0.2, w / 2 - half / 2, 0, d / 2 + 0.1, wall); b.box(2, H - 2.8, 0.2, 0, 2.8, d / 2 + 0.1, wall);
  b.box(1.8, 2.7, 0.08, 0, 0, d / 2 + 0.25, 0x7a4a2a); b.box(0.12, 0.12, 0.1, 0.6, 1.3, d / 2 + 0.18, 0xffd23a); // the door (shut behind you)
  b.box(2.4, 0.04, 1, 0, 0, d / 2 - 0.6, 0xc03a3a); // welcome mat
  // windows (bright panes) + ceiling lights
  for (const s of [-1, 1]) for (let z = -d / 2 + 2.5; z < d / 2 - 1.5; z += 4) b.box(0.06, 1.4, 1.6, s * (w / 2 - 0.01), 1.4, z, 0xbfe8ff, "glow");
  for (let x = -w / 2 + 3; x < w / 2 - 1; x += 6) for (let z = -d / 2 + 2.5; z < d / 2; z += 6) b.box(1.2, 0.08, 1.2, x, H - 0.1, z, 0xfff6d8, "glow");
  // a baseboard
  b.box(w, 0.2, 0.06, 0, 0, -d / 2 + 0.03, 0x8a6a4a);
  return b;
}
const solid = (C, x, z, hx, hz) => C.push({ x, z, hx, hz });
// furniture pieces
function counter(b, C, x, z, len, color = 0x8a5a30, top = 0xe8e2d4) { b.box(len, 1.05, 0.8, x, 0, z, color); b.box(len + 0.2, 0.08, 1, x, 1.05, z, top); solid(C, x, z, len / 2, 0.45); }
function shelf(b, C, x, z, len, goods, rot = 0) {
  const sx = rot ? 0.5 : len, sz = rot ? len : 0.5;
  b.box(sx, 2.4, sz, x, 0, z, 0x9a7a52); for (const y of [0.5, 1.2, 1.9]) b.box(sx + 0.05, 0.06, sz + 0.05, x, y, z, 0x7a5a32);
  const cols = { tools: [0xff8a1a, 0x3a7ad0, 0xc8ccd2, 0xffd23a], blasters: [0x2a2c30, 0x3a3d42, 0x6a4426, 0x141416], fish: [0x3a8ad0, 0xff7aa8, 0xc8a060, 0x2aa04a], toys: [0xff3a3a, 0x3aa0ff, 0xffd23a, 0x4adf6a], boxes: [0xb08a5a, 0x9a7448, 0xc8a070], papers: [0xffffff, 0xf4f0c8], cars: [0xe0203a, 0x2a7ad0, 0xffd23a], pawn: [0xffd23a, 0xc8ccd2, 0x2a2a2a, 0x8a4ad8, 0xe0203a] }[goods] || [0xd04030, 0x3a7ad0, 0xf0c030, 0x40a050];
  for (const y of [0.56, 1.26, 1.96]) for (let i = 0; i < 5; i++) { const t = -0.4 + i * 0.2; b.box(rot ? 0.3 : 0.3, 0.38, rot ? 0.3 : 0.3, x + (rot ? 0 : t * len), y, z + (rot ? t * len : 0), cols[(i + Math.round(y * 3)) % cols.length]); }
  solid(C, x, z, sx / 2, sz / 2);
}
function table(b, C, x, z, s = 1, color = 0xa0703a, chairs = 2) {
  b.box(1.4 * s, 0.08, 1 * s, x, 0.75, z, color); b.box(0.12, 0.75, 0.12, x, 0, z, 0x5a3a1a);
  for (let i = 0; i < chairs; i++) { const cx = x + (i % 2 ? 1 : -1) * 0.95 * s; b.box(0.5, 0.45, 0.5, cx, 0, z, 0x7a4a2a); b.box(0.08, 0.6, 0.5, cx + (i % 2 ? 0.25 : -0.25), 0.45, z, 0x7a4a2a); }
  solid(C, x, z, 0.8 * s + (chairs ? 0.5 : 0), 0.55 * s);
}
function sofa(b, C, x, z, color = 0x3a6ec8, rotY = 0) { b.add(new THREE.BoxGeometry(2.6, 0.5, 1), color, x, 0.25, z, 0, rotY); b.add(new THREE.BoxGeometry(2.6, 0.7, 0.3), color, x - Math.sin(rotY) * 0.4, 0.6, z - Math.cos(rotY) * 0.4, 0, rotY); solid(C, x, z, 1.3, 0.6); }
function bed(b, C, x, z, color = 0xff8aa8) { b.box(2, 0.5, 2.6, x, 0, z, 0x8a5a30); b.box(1.9, 0.25, 2.5, x, 0.5, z, 0xffffff); b.box(1.9, 0.12, 1.8, x, 0.75, z + 0.35, color); b.box(1.4, 0.2, 0.5, x, 0.75, z - 0.9, 0xffffff); b.box(2, 1.2, 0.15, x, 0, z - 1.3, 0x8a5a30); solid(C, x, z, 1, 1.35); }
function plant(b, C, x, z) { b.cyl(0.3, 0.5, x, 0, z, 0xc06a3a, 8); b.ball(0.55, x, 1.0, z, 0x3aa04a); solid(C, x, z, 0.3, 0.3); }
function rug(b, x, z, w, d, color) { b.box(w, 0.02, d, x, 0, z, color); }

// what's in each kind of room. Returns { spots: [{x, z, r, act}], keeper: {x, z} }
function furnish(bd, b, C) {
  const w = bd.w, d = bd.d, k = bd.kind, spots = []; let keeper = null;
  const back = -d / 2;
  const shopCounter = (len = Math.min(8, w - 4)) => { counter(b, C, 0, back + 2.6, len); keeper = { x: 0, z: back + 1.6 }; if (bd.menu) spots.push({ x: 0, z: back + 3.6, r: 1.8, act: "menu" }); else spots.push({ x: 0, z: back + 3.6, r: 1.8, act: "chat" }); };
  if (k === "shop") {
    shopCounter();
    shelf(b, C, -w / 2 + 0.5, 0, Math.min(6, d - 4), bd.goods, 1); shelf(b, C, w / 2 - 0.5, 0, Math.min(6, d - 4), bd.goods, 1);
    if (w > 12) shelf(b, C, 0, back + 0.4, w - 6, bd.goods);
    if (bd.goods === "cars") { for (let i = 0; i < 3; i++) b.box(2.4, 1.6, 0.06, -6 + i * 6, 2.2, back + 0.05, [0xe0203a, 0x2a7ad0, 0xffd23a][i]); plant(b, C, -w / 2 + 1.5, d / 2 - 2); plant(b, C, w / 2 - 1.5, d / 2 - 2); }
    rug(b, 0, 1, 4, 3, 0x6a2a2a);
  } else if (k === "garage") {
    counter(b, C, -w / 2 + 4, back + 2, 5, 0x55606a, 0x8a96a3); keeper = { x: -w / 2 + 4, z: back + 1 }; spots.push({ x: -w / 2 + 4, z: back + 3, r: 1.8, act: "chat", say: "Drive your ride onto the yellow lift out front and press E to customize it!" });
    for (let i = 0; i < 3; i++) { b.cyl(0.45, 1.2, w / 2 - 1, 0, back + 1 + i * 1.1, [0xd0402a, 0x2a7ad0, 0x3a3a3a][i], 10); solid(C, w / 2 - 1, back + 1 + i * 1.1, 0.5, 0.5); }
    for (let i = 0; i < 4; i++) b.add(new THREE.TorusGeometry(0.45, 0.2, 6, 10), 0x26262a, 3, 0.2 + i * 0.38, back + 1.2, Math.PI / 2); solid(C, 3, back + 1.2, 0.7, 0.7);
    b.box(6, 0.06, 8, 2, 0, 1.5, 0xffd23a); b.box(5, 0.08, 7, 2, 0.01, 1.5, 0x2c2f36);
  } else if (k === "diner" || k === "cafe") {
    counter(b, C, 0, back + 2.4, Math.min(8, w - 4), 0xe0304a, 0xf4f4f4); keeper = { x: 0, z: back + 1.4 }; spots.push({ x: 0, z: back + 3.4, r: 1.8, act: "snack" });
    for (let i = 0; i < 4; i++) b.cyl(0.25, 0.75, -3 + i * 2, 0, back + 3.4, 0xd0d0d8, 8);
    for (const [x, z] of [[-w / 2 + 2.2, 1.2], [w / 2 - 2.2, 1.2], [-w / 2 + 2.2, d / 2 - 2], [w / 2 - 2.2, d / 2 - 2]]) if (Math.abs(z) < d / 2 - 1) table(b, C, x, z, 1, 0xffffff);
    if (k === "cafe") { b.box(1.2, 0.5, 0.6, 1.2, 1.1, back + 2.4, 0x2a8a5a); b.box(0.9, 0.3, 0.05, 1.2, 1.35, back + 2.1, 0x6af0ff, "glow"); }
  } else if (k === "gas") {
    counter(b, C, 0, back + 2.2, 5, 0xe0302a, 0xf4f4f4); keeper = { x: 0, z: back + 1.2 }; spots.push({ x: -1.6, z: back + 3.2, r: 1.4, act: "snack" });
    b.box(1.2, 0.5, 0.6, 1.2, 1.1, back + 2.2, 0x3a3a3a); b.box(0.9, 0.3, 0.05, 1.2, 1.35, back + 1.9, 0x7aff5a, "glow"); // the cash register
    shelf(b, C, -w / 2 + 0.5, 1, 4, "boxes", 1); b.box(1.4, 2, 0.8, w / 2 - 0.8, 0, 1, 0xffffff); b.box(1.2, 1.6, 0.05, w / 2 - 1.2, 0.2, 1, 0x6af0ff, "glass"); solid(C, w / 2 - 0.8, 1, 0.7, 0.4);
  } else if (k === "office") {
    b.box(3, 0.9, 1.2, 0, 0, back + 2.4, 0x6a4a2a); b.box(3.2, 0.08, 1.4, 0, 0.9, back + 2.4, 0x8a5a30); solid(C, 0, back + 2.4, 1.6, 0.7); keeper = { x: 0, z: back + 1.4 }; spots.push({ x: 0, z: back + 3.6, r: 1.8, act: "chat" });
    b.box(0.6, 0.4, 0.4, 0.8, 0.98, back + 2.4, 0x2a2a2a); b.box(3, 2, 0.05, 0, 1.6, back + 0.05, 0x5aa04a); // a big map on the wall
    if (w > 10) { sofa(b, C, -w / 2 + 2, d / 2 - 2.5, 0x7a5a3a); plant(b, C, w / 2 - 1, d / 2 - 1.5); }
  } else if (k === "school") {
    b.box(5, 2, 0.06, 0, 1, back + 0.05, 0x2a5a3a); b.box(3, 0.9, 1, 0, 0, back + 2, 0x8a5a30); solid(C, 0, back + 2, 1.5, 0.5); keeper = { x: 0, z: back + 1.2 }; spots.push({ x: 0, z: back + 3.2, r: 1.8, act: "chat" });
    for (let r = 0; r < 2; r++) for (let c = -2; c <= 2; c++) { const x = c * 2.6, z = back + 5 + r * 2.4; if (z > d / 2 - 2) continue; b.box(1.2, 0.75, 0.8, x, 0, z, 0xd8b070); b.box(0.5, 0.45, 0.5, x, 0, z + 0.7, 0x3a7ad0); solid(C, x, z, 0.6, 0.6); }
  } else if (k === "hospital") {
    shopCounter(6);
    for (let i = 0; i < Math.floor((w - 4) / 3.5); i++) { const x = -w / 2 + 2.5 + i * 3.5; bed(b, C, x, d / 2 - 2.6, 0x6ad0ff); b.box(0.06, 2.2, 2.6, x + 1.4, 0, d / 2 - 2.6, 0x9ad8ff); }
  } else if (k === "bank") {
    // the teller counter on the left (with little gates at both ends, so you can't walk behind it)
    counter(b, C, -4, back + 3, 8, 0x5a4a3a, 0xe8e2d4); for (let i = 0; i < 3; i++) b.box(0.06, 1, 2.2, -7 + i * 2.6, 1.1, back + 3, 0xbfe8ff, "glass"); keeper = { x: -4, z: back + 2 }; spots.push({ x: -4, z: back + 4, r: 1.8, act: "chat", say: "Welcome to Copper Creek Bank! Your money is safe with us." });
    for (const gx of [-9, 1]) { b.box(2, 1.05, 0.15, gx, 0, back + 3, 0x5a4a3a); b.box(2.1, 0.08, 0.3, gx, 1.05, back + 3, 0xe8e2d4); solid(C, gx, back + 3, 1, 0.3); }
    // the vault room on the right: thick steel walls all the way around. Its door (heist.js) stays shut until you
    // drill it open with the Super Drill.
    const V = VAULT, steel = 0x9aa0aa, zf = V.z;
    b.box(V.door0 - V.x0, ROOM_H, 0.5, (V.x0 + V.door0) / 2, 0, zf, steel); solid(C, (V.x0 + V.door0) / 2, zf, (V.door0 - V.x0) / 2, 0.3);
    b.box(w / 2 - V.door1, ROOM_H, 0.5, (V.door1 + w / 2) / 2, 0, zf, steel); solid(C, (V.door1 + w / 2) / 2, zf, (w / 2 - V.door1) / 2, 0.3);
    b.box(V.door1 - V.door0, ROOM_H - V.doorH, 0.5, (V.door0 + V.door1) / 2, V.doorH, zf, steel);
    b.box(0.5, ROOM_H, zf - back, V.x0, 0, (zf + back) / 2, steel); solid(C, V.x0, (zf + back) / 2, 0.3, (zf - back) / 2);
    b.box(V.door1 - V.door0 + 0.6, 0.3, 0.7, (V.door0 + V.door1) / 2, V.doorH, zf + 0.1, 0x6a6e78); // the door frame
    for (const x of [V.door0 - 0.15, V.door1 + 0.15]) b.box(0.3, V.doorH, 0.7, x, 0, zf + 0.1, 0x6a6e78);
    b.box(w / 2 - V.x0, 0.02, zf - back, (V.x0 + w / 2) / 2, 0.005, (zf + back) / 2, 0x7a7a84); // (a steel floor in the vault)
    // gold bars + money bags on the back wall
    for (let i = 0; i < 18; i++) b.box(0.6, 0.3, 0.32, 3.2 + (i % 6) * 0.95, Math.floor(i / 6) * 0.32 + 0.4, back + 0.45, 0xffd23a, "glow");
    b.box(6.2, 0.4, 0.8, 5.6, 0, back + 0.45, 0x5a4a3a); solid(C, 5.6, back + 0.45, 3.2, 0.45);
    for (const [x, s] of [[3, 1], [8.8, 1.2], [9.4, 0.9]]) { b.ball(0.38 * s, x, 0.38 * s, back + 1.4, 0x8a6a3a); b.ball(0.12 * s, x, 0.8 * s, back + 1.4, 0xc8a060); }
    b.box(1.2, 0.8, 0.06, 5.5, 3.2, zf + 0.36, 0xffd23a); b.box(1, 0.6, 0.07, 5.5, 3.2, zf + 0.37, 0x2a6a4a); // "VAULT" plate
    rug(b, -4, 2, 6, 4, 0x2a6a4a); plant(b, C, -w / 2 + 1, d / 2 - 1.5); plant(b, C, w / 2 - 1, d / 2 - 1.5);
  } else if (k === "jewelry") {
    counter(b, C, 0, back + 2.2, 6, 0x9a4ad8, 0xf4f4f4); keeper = { x: 0, z: back + 1.2 }; spots.push({ x: 0, z: back + 3.2, r: 1.6, act: "chat", say: "Look but don’t touch! (Robbers need a lockpick set for these cases.)" });
    for (const x of [-4, 0, 4]) { b.box(2.4, 1, 1, x, 0, 0, 0xddddee); b.box(2.2, 0.6, 0.9, x, 1, 0, 0xbfe8ff, "glass"); for (let i = 0; i < 3; i++) b.ball(0.16, x - 0.6 + i * 0.6, 1.3, 0, [0x6af0ff, 0xff5ad8, 0x7aff5a][i], "glow"); solid(C, x, 0, 1.2, 0.5); }
  } else if (k === "police") {
    // the front desk on the right, three jail cells on the left
    counter(b, C, 4.5, back + 5.4, 6, 0x2a4ac8, 0xe8e8f0); keeper = { x: 4.5, z: back + 4.4 }; spots.push({ x: 4.5, z: back + 6.6, r: 1.8, act: "menu" });
    for (let i = 0; i < 3; i++) {
      const cx = -9 + i * 3.6, cz = back + 2.2;
      b.box(0.15, ROOM_H, 4.4, cx - 1.8, 0, cz, 0x9aa0aa); solid(C, cx - 1.8, cz, 0.1, 2.2);
      for (let x = -1.6; x <= 1.6; x += 0.4) b.box(0.08, 3, 0.08, cx + x, 0, cz + 2.2, 0x3a3a44);
      b.box(3.6, 0.15, 0.15, cx, 3, cz + 2.2, 0x3a3a44); solid(C, cx, cz + 2.2, 1.8, 0.1);
      b.box(1.6, 0.45, 0.8, cx + 0.6, 0, cz - 1.4, 0x8a6a4a); // bench
    }
    b.box(0.15, ROOM_H, 4.4, 1, 0, back + 2.2, 0x9aa0aa); solid(C, 1, back + 2.2, 0.1, 2.2);
    b.box(3, 1.6, 0.05, 6, 2.2, back + 0.05, 0x1a2a6a); for (let i = 0; i < 4; i++) b.box(0.5, 0.6, 0.06, 4.9 + i * 0.75, 2.3, back + 0.08, 0xffffff); // a wanted board
    sofa(b, C, 6, d / 2 - 2.5, 0x2a4ac8);
  } else if (k === "hideout") {
    b.box(2.4, 0.8, 1.4, 0, 0, -0.5, 0x6a4a2a); b.box(1.6, 0.02, 1, 0, 0.81, -0.5, 0xe8dcb0); solid(C, 0, -0.5, 1.2, 0.7); spots.push({ x: 0, z: 0.8, r: 1.8, act: "menu" }); // a table with a secret map
    for (let i = 0; i < 5; i++) { b.box(0.9, 0.8, 0.9, -w / 2 + 0.8 + (i % 2) * 0.95, Math.floor(i / 2) * 0.8, back + 0.8, 0x8a6a3a); } solid(C, -w / 2 + 1.3, back + 0.8, 1, 0.5);
    sofa(b, C, w / 2 - 2, back + 1, 0x5a3a6a); b.box(0.6, 0.8, 0.6, w / 2 - 1, 0, d / 2 - 1.2, 0xffd23a); b.box(0.4, 0.3, 0.4, w / 2 - 1, 0.8, d / 2 - 1.2, 0x7aff5a, "glow"); solid(C, w / 2 - 1, d / 2 - 1.2, 0.3, 0.3);
  } else if (k === "barn") {
    for (let i = 0; i < 8; i++) { b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 10), 0xe6c35a, -w / 2 + 1.2 + (i % 4) * 1.5, 0.75 + Math.floor(i / 4) * 1.5, back + 1.2, Math.PI / 2); } solid(C, -w / 2 + 3.4, back + 1.2, 3, 0.8);
    for (let i = 0; i < 3; i++) { b.box(0.15, 1.2, 3, w / 2 - 3 - i * 2.4, 0, back + 2, 0x8a5a30); solid(C, w / 2 - 3 - i * 2.4, back + 2, 0.1, 1.5); }
    b.box(1.2, 0.8, 0.8, 0, 0, 0, 0xc8ccd2); solid(C, 0, 0, 0.6, 0.4);
  } else if (k === "home" || k === "neighbor") {
    const big = w >= 14;
    sofa(b, C, -w / 4, 0.8, k === "home" ? 0x3a6ec8 : 0x6aa04a); b.box(2.2, 1.3, 0.12, -w / 4, 0.9, back + 0.2, 0x111111); b.box(2, 1.1, 0.05, -w / 4, 1.0, back + 0.27, 0x3a6ad0, "glow"); b.box(2.4, 0.5, 0.5, -w / 4, 0, back + 0.4, 0x6a4a2a); solid(C, -w / 4, back + 0.4, 1.2, 0.3); // a TV
    rug(b, -w / 4, -0.8, 3.2, 2.6, 0xd86a3a);
    bed(b, C, w / 2 - 1.3, back + 1.6, k === "home" ? 0xff8aa8 : 0x8ad0ff);
    counter(b, C, w / 2 - 1.2, d / 2 - 2.4, 2, 0xd8d0c8, 0x9aa0aa); // kitchen
    table(b, C, -w / 4, d / 2 - 2, 0.9, 0xa0703a, 2);
    plant(b, C, -w / 2 + 0.6, back + 0.6);
    if (big) { plant(b, C, w / 2 - 0.6, 0); b.box(0.5, 2.2, 1.6, -w / 2 + 0.3, 0, -1, 0x8a5a30); solid(C, -w / 2 + 0.3, -1, 0.3, 0.8); }
    if (k === "neighbor") { keeper = { x: 0, z: 0 }; spots.push({ x: 0, z: 1, r: 1.8, act: "chat", say: "Hi neighbor! Nice to see you!" }); }
    else {
      const h = bd.house, own = S.houses.includes(h.id);
      spots.push({ x: w / 2 - 1.3, z: back + 3.3, r: 1.6, act: "sleep" });
      if (!own) { b.box(1.6, 1, 0.08, 0, 1.2, d / 2 - 0.3, 0xffffff); b.box(1.4, 0.8, 0.09, 0, 1.2, d / 2 - 0.3, 0xd0302a); spots.push({ x: 0, z: d / 2 - 1.6, r: 1.6, act: "tour" }); }
      else trophies(b, C, w, d);
    }
  }
  return { spots, keeper };
}
// your stuff: race trophies, fish on the wall and little models of all your rides
function trophies(b, C, w, d) {
  const back = -d / 2, x0 = w / 4 + 0.5;
  b.box(3.4, 0.08, 0.5, x0, 1.5, back + 0.3, 0x8a5a30); b.box(3.4, 0.08, 0.5, x0, 2.3, back + 0.3, 0x8a5a30);
  let n = 0; for (const id of Object.keys(S.wins)) for (let i = 0; i < Math.min(4, S.wins[id]); i++, n++) { if (n >= 8) break; const x = x0 - 1.4 + (n % 4) * 0.9, y = n < 4 ? 1.58 : 2.38; b.cyl(0.12, 0.08, x, y, back + 0.3, 0x8a6a1a, 8); b.cyl(0.05, 0.25, x, y + 0.08, back + 0.3, 0xffd23a, 6); b.cyl(0.08, 0.2, x, y + 0.33, back + 0.3, 0xffd23a, 8, "solid", 0.2); }
  const fishCols = { minnow: 0x9a8a6a, perch: 0xf0c040, bass: 0x5a9a3a, trout: 0xff8aa8, catfish: 0x6a6a7a, pike: 0xc8d8e0, carp: 0xffc42a, koi: 0x9af0ff, monster: 0x4a3a2a, boot: 0x6a4a2a };
  Object.keys(S.fishLog).slice(0, 6).forEach((id, i) => { const z = back + 1.5 + i * 1.2; if (z > d / 2 - 1) return; b.box(0.06, 0.6, 1, -w / 2 + 0.05, 1.8, z, 0x8a5a30); b.add(new THREE.SphereGeometry(0.2, 8, 6), fishCols[id] || 0x8ab0c0, -w / 2 + 0.2, 1.8, z, 0, 0, 0, "solid", 0.6, 0.9, 2); });
  // toy models of your rides on a table
  b.box(2.6, 0.75, 1, x0, 0, d / 2 - 4.2, 0x6a4a2a); solid(C, x0, d / 2 - 4.2, 1.3, 0.5);
  S.cars.slice(0, 6).forEach((c, i) => { const x = x0 - 1 + (i % 3) * 1, z = d / 2 - 4.4 + Math.floor(i / 3) * 0.45; b.box(0.5, 0.18, 0.28, x, 0.77, z, c.paint); b.box(0.28, 0.12, 0.24, x - 0.04, 0.95, z, 0x2a3a4a); });
  b.box(1.4, 1, 0.05, 0, 2.2, back + 0.05, 0x3aa04a); b.box(1.2, 0.8, 0.06, 0, 2.2, back + 0.07, 0xffd23a); // a "HOME" picture
}

// ---------------------------------------------------------------- the interior manager
export class Interiors {
  constructor(api) { this.api = api; this.cur = null; }
  // the closest front door you could walk in (outdoors)
  doorNear(x, z, r = 2.8) { let best = null, bd = r; for (const b of BUILDINGS) { const d = Math.hypot(b.dx - x, b.dz - z); if (d < bd) { bd = d; best = b; } } return best; }
  // build the room and put you inside it, by the door (or at spot, e.g. a jail cell)
  enter(bd, spot) {
    if (this.cur) this.leaveRoom();
    const C = [], b = room(null, bd.w, bd.d, bd.kind), f = furnish(bd, b, C);
    // a cash register on the counter wherever there's somebody to hold up
    if (HOLDUP[bd.id] && f.keeper) { const rx = f.keeper.x - 1.6, rz = f.keeper.z + 1; b.box(0.7, 0.32, 0.5, rx, 1.13, rz, 0x3a3a44); b.box(0.5, 0.26, 0.05, rx, 1.5, rz - 0.18, 0x2a2a2a); b.box(0.44, 0.2, 0.06, rx, 1.53, rz - 0.15, 0x7aff5a, "glow"); f.register = { x: rx, z: rz }; }
    b.at(0, 0, 0);
    const meshes = b.finish(this.api.scene).map((m) => { m.castShadow = m.receiveShadow = false; m.position.x += POCKET.x; m.position.z += POCKET.z; return m; });
    let keeper = null;
    if (f.keeper && bd.keeper !== undefined || (f.keeper && bd.kind === "neighbor")) {
      const look = bd.kind === "police" ? LOOKS.cop : LOOKS.npc[(bd.id.length + bd.name.length) % LOOKS.npc.length];
      keeper = makePerson(look); keeper.root.position.set(POCKET.x + f.keeper.x, 0, POCKET.z + f.keeper.z); this.api.scene.add(keeper.root);
    }
    this.cur = { bd, meshes, C, spots: f.spots, keeper, t: 0, keeperAt: f.keeper, register: f.register || null, extras: [] };
    if (this.api.onEnter) this.api.onEnter(this.cur);
    const p = spot || { x: 0, z: bd.d / 2 - 1.3 };
    return { x: POCKET.x + p.x, z: POCKET.z + p.z, yaw: spot ? 0 : Math.PI };
  }
  leaveRoom() {
    const c = this.cur; if (!c) return null;
    for (const m of c.meshes) { this.api.scene.remove(m); m.geometry.dispose(); }
    if (c.keeper) this.api.scene.remove(c.keeper.root);
    for (const m of c.extras) this.api.scene.remove(m); // (things heist.js added: the vault door, the register drawer...)
    if (this.api.onLeave) this.api.onLeave(c);
    this.cur = null;
    const bd = c.bd; return { x: bd.dx + Math.sin(bd.out) * 1.6, z: bd.dz + Math.cos(bd.out) * 1.6, yaw: bd.out };
  }
  // room coordinates of a world spot
  local(p) { return { x: p.x - POCKET.x, z: p.z - POCKET.z }; }
  // walking inside: no hills, just walls and furniture
  step(p, mx, mz, run, jump, dt) {
    const c = this.cur, w = c.bd.w, d = c.bd.d;
    const sp = run ? 7 : 4.5, l = Math.hypot(mx, mz);
    const tx = l > 0.1 ? (mx / Math.max(1, l)) * sp : 0, tz = l > 0.1 ? (mz / Math.max(1, l)) * sp : 0, k = Math.min(1, dt * 12);
    p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
    if (l > 0.1) { const ty = Math.atan2(mx, mz); let dd = ty - p.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); p.yaw += dd * Math.min(1, dt * 12); }
    let x = p.x - POCKET.x + p.vx * dt, z = p.z - POCKET.z + p.vz * dt;
    x = clamp(x, -w / 2 + 0.4, w / 2 - 0.4); z = clamp(z, -d / 2 + 0.4, d / 2 - 0.4);
    for (const o of c.C) { // push out of furniture boxes
      const dx = x - o.x, dz = z - o.z, px = o.hx + 0.35 - Math.abs(dx), pz = o.hz + 0.35 - Math.abs(dz);
      if (px > 0 && pz > 0) { if (px < pz) x += Math.sign(dx || 1) * px; else z += Math.sign(dz || 1) * pz; }
    }
    p.x = x + POCKET.x; p.z = z + POCKET.z;
    if (jump && !p.air) { p.vy = 7; p.air = true; }
    if (p.air) { p.vy -= 24 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.air = false; p.vy = 0; } } else p.y = 0;
    p.moving = Math.hypot(p.vx, p.vz); p.t += dt;
  }
  // keep the camera inside the walls
  clampCam(px, py, pz) { const c = this.cur, w = c.bd.w, d = c.bd.d; return [clamp(px - POCKET.x, -w / 2 + 0.3, w / 2 - 0.3) + POCKET.x, clamp(py, 0.6, ROOM_H - 0.3), clamp(pz - POCKET.z, -d / 2 + 0.3, d / 2 - 0.3) + POCKET.z]; }
  draw(time, me) {
    const c = this.cur; if (!c || !c.keeper || c.busy) return; // (busy: heist.js is moving them)
    const k = c.keeper, d = Math.hypot(me.x - k.root.position.x, me.z - k.root.position.z);
    k.root.rotation.y = Math.atan2(me.x - k.root.position.x, me.z - k.root.position.z);
    k.pose(d < 4 ? "wave" : "stand", time);
  }
}
