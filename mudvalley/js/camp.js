// MUD VALLEY RP: camping! Buy tents and camp stuff at the Camp Store (by the Campground), then set up your camp
// ANYWHERE (📱 Phone → ⛺ Camp → Set up here). Walk up to your tent and press E to sleep in it, roast marshmallows at
// the campfire... Your camp stays where you put it (saved), and friends in your lobby see it too (mp.js).
import * as THREE from "/create/vendor/three.module.js";
import { groundAt } from "./terrain.js";
import { S, save } from "./save.js";

export const CAMP_ITEMS = [
  { id: "tent1", name: "Pup Tent", price: 250, icon: "⛺", tent: true, desc: "A little 2-person tent. Sleep in it anywhere!" },
  { id: "tent2", name: "Family Dome Tent", price: 800, icon: "⛺", tent: true, desc: "A big round dome tent with a rain fly. Room for the whole family." },
  { id: "tent3", name: "Big Cabin Tent", price: 1800, icon: "🏕️", tent: true, desc: "A giant tent shaped like a little cabin, with windows. Basically a house!" },
  { id: "fire", name: "Campfire Ring", price: 150, icon: "🔥", desc: "A ring of rocks with a crackling fire. Roast marshmallows!" },
  { id: "chairs", name: "Camp Chairs (2)", price: 120, icon: "🪑", desc: "Two folding chairs. Put them by the fire." },
  { id: "table", name: "Picnic Table", price: 300, icon: "🧺", desc: "A wooden picnic table with benches." },
  { id: "grill", name: "Camp Grill", price: 200, icon: "🍔", desc: "Grill burgers and hot dogs at your camp." },
  { id: "lantern", name: "Lantern Post", price: 90, icon: "🏮", desc: "A glowing lantern on a post so you can find your camp at night." },
];
export const campItem = (id) => CAMP_ITEMS.find((c) => c.id === id);
export const CAMP_MAX = 16; // how many things you can have set up at once
export const TENT_COLORS = [0xff6a3a, 0x3a9aff, 0x4adf6a, 0xffd23a, 0xe0203a, 0x6a3ad0, 0xff5ad8, 0x2ac0a0, 0x7a8a4a, 0xf4f4f4];

const mats = new Map();
const mat = (c, glow) => { const k = c + (glow ? "g" : ""); if (!mats.has(k)) mats.set(k, glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c })); return mats.get(k); };
function box(g, w, h, d, x, y, z, c, glow) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, glow)); m.position.set(x, y + h / 2, z); g.add(m); return m; }
function cyl(g, r, h, x, y, z, c, seg = 8) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(c)); m.position.set(x, y + h / 2, z); g.add(m); return m; }
// a tent "prism" (a triangle laid on its side): w wide, h tall, len long
function prism(g, w, h, len, x, y, z, c) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }), mat(c)); m.position.set(x, y, z - len / 2); g.add(m); return m;
}
const dark = (c) => new THREE.Color(c).multiplyScalar(0.55).getHex();

// the 3D model of a camp thing (front = +z, where the tent door is)
export function campModel(id, c = 0xff6a3a) {
  const g = new THREE.Group();
  if (id === "tent1") {
    prism(g, 1.9, 1.35, 2.4, 0, 0, 0, c); prism(g, 0.9, 0.95, 0.04, 0, 0, 1.2, dark(c)); // the door
    for (const z of [-1.25, 1.25]) cyl(g, 0.025, 1.4, 0, 0, z, 0x9aa0aa, 5);
  } else if (id === "tent2") {
    const d = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c)); d.scale.set(1.15, 1.05, 1.15); g.add(d);
    const fly = new THREE.Mesh(new THREE.SphereGeometry(1.43, 14, 6, 0, Math.PI * 2, 0, Math.PI / 5.5), mat(0xf4f4f4)); fly.scale.set(1.15, 1.05, 1.15); g.add(fly);
    box(g, 0.9, 1.05, 0.1, 0, 0, 1.55, dark(c)); box(g, 1.2, 0.05, 0.8, 0, 0, 2.0, 0x8a7a5a); // door + a mat
  } else if (id === "tent3") {
    box(g, 3.2, 1.7, 2.8, 0, 0, 0, c); prism(g, 3.3, 0.9, 2.9, 0, 1.7, 0, dark(c));
    box(g, 1.0, 1.5, 0.06, 0, 0, 1.41, dark(c)); for (const x of [-1.6, 1.6]) box(g, 0.06, 0.5, 0.9, x, 0.9, 0, 0x2a3a4a);
    for (const x of [-1.0, 1.0]) box(g, 0.6, 0.5, 0.06, x, 0.9, 1.41, 0x2a3a4a);
  } else if (id === "fire") {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), mat(0x8a8a8a)); r.position.set(Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7); r.rotation.set(i, i * 2, 0); g.add(r); }
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), mat(0x6a4426)); l.position.set(0, 0.14, 0); l.rotation.set(Math.PI / 2, i * 1.05, 0.0); l.rotation.order = "YXZ"; g.add(l); }
    const fl = new THREE.Group(); fl.name = "flame"; g.add(fl);
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 7), mat(0xff7a1a, true)); f1.position.y = 0.55; fl.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 6), mat(0xffe04a, true)); f2.position.y = 0.48; fl.add(f2);
  } else if (id === "chairs") {
    for (const x of [-0.6, 0.6]) {
      for (const [dx, dz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) cyl(g, 0.02, 0.45, x + dx, 0, dz, 0x9aa0aa, 4);
      box(g, 0.5, 0.06, 0.45, x, 0.42, 0, c); const b = box(g, 0.5, 0.5, 0.05, x, 0.45, -0.24, c); b.rotation.x = -0.15;
      box(g, 0.06, 0.04, 0.4, x - 0.27, 0.62, 0, 0x2a2a2a); box(g, 0.06, 0.04, 0.4, x + 0.27, 0.62, 0, 0x2a2a2a);
    }
  } else if (id === "table") {
    box(g, 1.9, 0.08, 0.8, 0, 0.72, 0, 0xa0703a); for (const z of [-0.65, 0.65]) box(g, 1.9, 0.07, 0.3, 0, 0.42, z, 0xa0703a);
    for (const x of [-0.75, 0.75]) for (const s of [-1, 1]) { const l = box(g, 0.08, 0.85, 0.08, x, 0, s * 0.35, 0x7a5030); l.rotation.x = s * 0.35; }
  } else if (id === "grill") {
    for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) cyl(g, 0.025, 0.75, x, 0, z, 0x2a2a2a, 4);
    box(g, 0.8, 0.25, 0.55, 0, 0.75, 0, 0x2a2a2e); box(g, 0.75, 0.02, 0.5, 0, 1.0, 0, 0x6a6e78); box(g, 0.6, 0.03, 0.4, 0, 0.98, 0, 0xff5a1a, true);
    for (let i = 0; i < 3; i++) box(g, 0.14, 0.05, 0.14, -0.2 + i * 0.2, 1.02, 0, 0x6a3a1a); // burgers!
  } else if (id === "lantern") {
    cyl(g, 0.05, 1.7, 0, 0, 0, 0x5a3a1a, 6); box(g, 0.5, 0.05, 0.05, 0.2, 1.65, 0, 0x2a2a2a);
    box(g, 0.2, 0.3, 0.2, 0.4, 1.3, 0, 0xffe08a, true); box(g, 0.24, 0.04, 0.24, 0.4, 1.6, 0, 0x2a2a2a);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export class Camp {
  constructor(scene) { this.scene = scene; this.items = new Map(); for (const it of S.camp.set) this.spawn(it); }
  spawn(it) {
    const m = campModel(it.id, it.c); m.position.set(it.x, groundAt(it.x, it.z), it.z); m.rotation.y = it.yaw || 0;
    this.scene.add(m); this.items.set(it.u, { it, m, flame: m.getObjectByName("flame") });
  }
  buy(id, color) { S.camp.have[id] = (S.camp.have[id] || 0) + 1; if (color != null && campItem(id).tent) S.camp.color = color; save(); }
  // set something up a few steps in front of you
  setUp(id, me) {
    if (!(S.camp.have[id] > 0)) return "You don’t have one. Buy it at the Camp Store!";
    if (S.camp.set.length >= CAMP_MAX) return "Your camp is full (" + CAMP_MAX + " things). Pack something up first.";
    const d = id === "tent3" ? 4.2 : id === "tent2" ? 3.4 : 2.6, x = me.x + Math.sin(me.yaw) * d, z = me.z + Math.cos(me.yaw) * d;
    const it = { u: S.nextId++, id, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: Math.round((me.yaw + Math.PI) * 100) / 100, c: campItem(id).tent || id === "chairs" ? (S.camp.color ?? TENT_COLORS[0]) : undefined };
    S.camp.have[id]--; S.camp.set.push(it); this.spawn(it); save(); return null;
  }
  packUp(u) {
    const e = this.items.get(u); if (!e) return;
    this.scene.remove(e.m); this.items.delete(u);
    S.camp.set = S.camp.set.filter((it) => it.u !== u); S.camp.have[e.it.id] = (S.camp.have[e.it.id] || 0) + 1; save();
  }
  // the camp thing you're standing next to (for the E button)
  near(x, z) {
    let best = null, bd = 1e9;
    for (const e of this.items.values()) { const r = e.it.id === "tent3" ? 3.2 : e.it.id === "tent2" ? 2.8 : 2.2, d = Math.hypot(e.it.x - x, e.it.z - z); if (d < r && d < bd) { bd = d; best = e; } }
    return best;
  }
  draw(t) { for (const e of this.items.values()) if (e.flame) { const k = 0.85 + 0.2 * Math.sin(t * 13 + e.it.u) + 0.1 * Math.sin(t * 29); e.flame.scale.set(1 + 0.08 * Math.sin(t * 17), k, 1 + 0.08 * Math.cos(t * 15)); } }
}
