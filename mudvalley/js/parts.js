// MUD VALLEY RP: car parts. Buy them at Valley Parts (the counter on the side of Mud & Chrome) or on the 📦 SkyDrop app
// (a delivery drone flies them to you and drops a box at your feet), then build your own ride in your garage:
// a frame + a motor + tires + a seat (+ body panels for the bigger frames).
import * as THREE from "/create/vendor/three.module.js";
import { S, save } from "./save.js";
import { groundAt } from "./terrain.js";

export const PARTS = [
  // frames (what you are building: it decides the shape)
  { id: "f_quad", kind: "frame", name: "Quad Frame", price: 500, icon: "🛞", model: "atv", desc: "Builds a quad. Needs a seat." },
  { id: "f_bike", kind: "frame", name: "Dirt Bike Frame", price: 600, icon: "🏍️", model: "bike", desc: "Builds a dirt bike. Needs a seat." },
  { id: "f_buggy", kind: "frame", name: "Dune Buggy Frame", price: 900, icon: "🏎️", model: "buggy", body: true, desc: "Builds a buggy. Needs a seat + body panels." },
  { id: "f_mini", kind: "frame", name: "Mini Truck Frame", price: 700, icon: "🚚", model: "minitruck", body: true, desc: "Builds a little work truck. Needs a seat + body panels." },
  { id: "f_jeep", kind: "frame", name: "Trail Jeep Frame", price: 1400, icon: "🚙", model: "jeep", body: true, desc: "Builds an off-road jeep. Needs a seat + body panels." },
  { id: "f_truck", kind: "frame", name: "Pickup Truck Frame", price: 1600, icon: "🛻", model: "pickup", body: true, desc: "Builds a shiny pickup (no rust!). Needs a seat + body panels." },
  { id: "f_crew", kind: "frame", name: "Crew Cab 1500 Frame", price: 5200, icon: "🛻", model: "crew", body: true, desc: "Builds a big full-size crew cab pickup. Needs a seat + body panels." },
  { id: "f_fox", kind: "frame", name: "80s Hatchback Frame", price: 4200, icon: "🏎️", model: "foxhatch", body: true, desc: "Builds a boxy 80s V8 hatchback. Needs a seat + body panels." },
  { id: "f_squad", kind: "frame", name: "Sport Quad Frame", price: 1400, icon: "🛞", model: "sportquad", desc: "Builds a fast sport quad. Needs a seat." },
  { id: "f_bquad", kind: "frame", name: "Big Quad Frame", price: 1900, icon: "🛞", model: "bigquad", desc: "Builds a big muddy quad with racks. Needs a seat." },
  { id: "f_pit", kind: "frame", name: "Pit Bike Frame", price: 300, icon: "🏍️", model: "pitbike", desc: "Builds a little pit bike. Needs a seat." },
  { id: "f_sxs", kind: "frame", name: "Side-by-Side Frame", price: 6000, icon: "🏎️", model: "sxs", body: true, desc: "Builds a long-travel side-by-side. Needs a seat + body panels." },
  { id: "f_sxs4", kind: "frame", name: "4-Door Side-by-Side Frame", price: 7500, icon: "🏎️", model: "sxs4", body: true, desc: "Builds the 4-seat, 4-door side-by-side. Needs a seat + body panels." },
  { id: "f_125", kind: "frame", name: "125 Dirt Bike Frame", price: 450, icon: "🏍️", model: "bike125", desc: "Builds a 125cc dirt bike. Needs a seat." },
  { id: "f_sport", kind: "frame", name: "Sport Bike Frame", price: 2400, icon: "🏍️", model: "sport300", body: true, desc: "Builds a 300 sport bike. Needs a seat + body panels (the fairing)." },
  { id: "f_superbike", kind: "frame", name: "Superbike Frame", price: 7000, icon: "🏍️", model: "super1000", body: true, desc: "Builds a 1000cc superbike. Needs a seat + body panels (the fairing)." },
  { id: "f_450", kind: "frame", name: "Race Bike Frame", price: 1700, icon: "🏍️", model: "bike450", desc: "Builds a race dirt bike. Needs a seat." },
  { id: "f_ranch", kind: "frame", name: "Dually Truck Frame", price: 3800, icon: "🛻", model: "ranch", body: true, desc: "Builds a big ranch dually. Needs a seat + body panels." },
  { id: "f_sports", kind: "frame", name: "Sports Car Frame", price: 4800, icon: "🏎️", model: "sports", body: true, desc: "Builds a fast street car. Needs a seat + body panels." },
  { id: "f_trail", kind: "frame", name: "Lifted 4x4 Frame", price: 6400, icon: "🚙", model: "trailboss", body: true, desc: "Builds a lifted 4x4 truck. Needs a seat + body panels." },
  { id: "f_dump", kind: "frame", name: "Dump Truck Frame", price: 7200, icon: "🚚", model: "dumper", body: true, desc: "Builds a gravel dump truck. Needs a seat + body panels." },
  { id: "f_monster", kind: "frame", name: "Monster Truck Frame", price: 8800, icon: "🚜", model: "monster", body: true, desc: "Builds a monster truck! Needs a seat + body panels." },
  { id: "f_pre", kind: "frame", name: "Trophy Truck Frame", price: 11000, icon: "🛻", model: "prerunner", body: true, desc: "Builds a desert trophy truck. Needs a seat + body panels." },
  { id: "f_swamp", kind: "frame", name: "6x6 Swamp Frame", price: 12800, icon: "🚛", model: "swamp", body: true, desc: "Builds a 6-wheel swamp crawler. Needs a seat + body panels." },
  { id: "f_hyper", kind: "frame", name: "Supercar Frame", price: 18000, icon: "🏎️", model: "hyper", body: true, desc: "Builds the fastest car there is. Needs a seat + body panels." },
  // motors (how fast it goes: same levels as the engine upgrades at Mud & Chrome)
  { id: "m_putt", kind: "motor", name: "Putt-Putt Motor", price: 150, icon: "⚙️", lv: 0, desc: "A tiny motor. It goes... slowly." },
  { id: "m_street", kind: "motor", name: "Street 4 Motor", price: 500, icon: "⚙️", lv: 1, desc: "A good everyday motor." },
  { id: "m_turbo", kind: "motor", name: "Turbo 6 Motor", price: 1200, icon: "🌀", lv: 2, desc: "Turbo power + a hood scoop." },
  { id: "m_v8", kind: "motor", name: "Big Block V8", price: 2600, icon: "🔥", lv: 3, desc: "Loud and fast, with big exhausts." },
  { id: "m_v12", kind: "motor", name: "Monster V12", price: 5200, icon: "💥", lv: 4, desc: "The fastest motor there is. Flames!" },
  // tires
  { id: "t_street", kind: "tires", name: "Street Tires (set)", price: 120, icon: "⚫", tires: "street", desc: "Fast on roads." },
  { id: "t_at", kind: "tires", name: "All-Terrain Tires (set)", price: 300, icon: "⚫", tires: "allterrain", desc: "Good on dirt and grass." },
  { id: "t_mud", kind: "tires", name: "Mud Tires (set)", price: 500, icon: "⚫", tires: "mud", desc: "Huge knobby mud tires." },
  // the rest
  { id: "p_seat", kind: "seat", name: "Seat", price: 80, icon: "💺", desc: "Every ride needs one!" },
  { id: "p_body", kind: "body", name: "Body Panels", price: 250, icon: "🧱", desc: "Doors, hood, fenders. Buggies, jeeps and trucks need them." },
  { id: "p_lift", kind: "extra", name: "Lift Kit", price: 400, icon: "⬆️", desc: "Optional: builds your ride lifted up." },
];
export const partById = (id) => PARTS.find((p) => p.id === id);
export const KINDS = [["frame", "🔩 Frames"], ["motor", "⚙️ Motors"], ["tires", "⚫ Tires"], ["seat", "💺 Seats"], ["body", "🧱 Body"], ["extra", "⬆️ Extras"]];
export const SHIP_FEE = (sub) => 60 + Math.round(sub * 0.1); // (SkyDrop drone delivery: $60 + 10%)
export const have = (id) => (S.parts && S.parts[id]) || 0;
export function addPart(id, n = 1) { if (!S.parts) S.parts = {}; S.parts[id] = (S.parts[id] || 0) + n; if (S.parts[id] <= 0) delete S.parts[id]; }

// ---------------------------------------------------------------- the delivery drone + the box it drops
const mats = {};
function m(c) { return mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c })); }
function boxModel() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), m(0xc89a5a)); b.position.y = 0.35; g.add(b);
  for (const r of [0, Math.PI / 2]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.16), m(0x2a7ad0)); t.position.y = 0.35; t.rotation.y = r; g.add(t); }
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), m(0xffffff)); l.position.set(0.15, 0.71, 0.2); g.add(l);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function droneModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), m(0x2a2d33)); g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), m(0x2a7ad0)); top.position.y = 0.18; g.add(top);
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.0), m(0x3a3e46)); arm.position.set(x * 0.45, 0.05, z * 0.45); arm.rotation.y = Math.atan2(x, z); g.add(arm);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.45 })); r.position.set(x * 0.8, 0.14, z * 0.8); g.add(r); rotors.push(r);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0x3aff6a })); led.position.set(0, -0.12, 0.45); g.add(led);
  return { g, rotors, led };
}

export class Drops {
  constructor(api) { this.api = api; this.flights = []; this.boxes = []; for (const d of S.drops || []) this.placeBox(d); }
  // a new order: the drone takes off from far away and flies to you
  order(items) {
    const me = this.api.me(), a = Math.random() * Math.PI * 2, D = droneModel();
    const f = { items, x: me.x + Math.cos(a) * 90, z: me.z + Math.sin(a) * 90, y: groundAt(me.x, me.z) + 45, t: 0, state: "fly", D, box: boxModel() };
    f.box.position.y = -0.85; f.D.g.add(f.box); this.api.scene.add(f.D.g); this.flights.push(f);
  }
  placeBox(d) {
    const g = boxModel(); g.position.set(d.x, groundAt(d.x, d.z), d.z); g.rotation.y = d.yaw || 0; this.api.scene.add(g);
    this.boxes.push({ d, g, vy: 0, falling: false });
  }
  near(x, z, r = 2.6) { return this.boxes.find((b) => !b.falling && Math.hypot(b.d.x - x, b.d.z - z) < r) || null; }
  open(b) {
    for (const id of b.d.items) addPart(id);
    this.api.scene.remove(b.g); this.boxes.splice(this.boxes.indexOf(b), 1);
    S.drops = (S.drops || []).filter((x) => x !== b.d); save();
    return b.d.items;
  }
  update(dt) {
    const me = this.api.me();
    for (const f of this.flights.slice()) {
      f.t += dt; for (const r of f.D.rotors) r.rotation.y += dt * 40; f.D.led.visible = Math.floor(f.t * 4) % 2 === 0;
      if (f.state === "fly") {
        // fly to a spot right in front of you (it waits up high if you're inside a building)
        const fx = Math.sin(me.yaw || 0), fz = Math.cos(me.yaw || 0), tx = me.x + fx * 3, tz = me.z + fz * 3;
        const gy = groundAt(tx, tz), wantY = this.api.indoors() ? gy + 30 : gy + 9;
        const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz), sp = Math.min(22, 4 + d * 0.8);
        if (d > 0.3) { f.x += (dx / d) * Math.min(d, sp * dt); f.z += (dz / d) * Math.min(d, sp * dt); }
        f.y += (wantY - f.y) * Math.min(1, dt * 1.5);
        f.D.g.rotation.z = -Math.min(0.3, d * 0.01); f.D.g.rotation.y = Math.atan2(dx, dz);
        if (d < 0.6 && Math.abs(f.y - wantY) < 0.6 && !this.api.indoors()) {
          // let go of the box!
          f.D.g.remove(f.box); const d2 = { x: f.x, z: f.z, yaw: Math.random() * 6, items: f.items };
          f.box.position.set(f.x, f.y - 0.85, f.z); this.api.scene.add(f.box);
          this.boxes.push({ d: d2, g: f.box, vy: 0, falling: true });
          S.drops = [...(S.drops || []), d2]; save();
          f.state = "leave"; f.t = 0; this.api.dropped();
        }
      } else { f.y += dt * 9; f.x += dt * 6; if (f.t > 6) { this.api.scene.remove(f.D.g); this.flights.splice(this.flights.indexOf(f), 1); } }
      f.D.g.position.set(f.x, f.y, f.z);
    }
    for (const b of this.boxes) if (b.falling) {
      b.vy -= 22 * dt; b.g.position.y += b.vy * dt; b.g.rotation.y += dt * 2;
      const gy = groundAt(b.d.x, b.d.z); if (b.g.position.y <= gy) { b.g.position.y = gy; b.falling = false; this.api.landed(b.d.x, gy, b.d.z); }
    }
  }
  get busy() { return this.flights.length; }
}
