// MUD VALLEY RP: bolt-on mods. Truck mods (light bars, running boards, antennas, a front bumper winch),
// dirt bike mods (tapered bars, bar pads, grips, supermoto wheels, graphic kits) and dirt bike helmets.
// addMods(C, car) runs while a model is being built (vehicles.js buildCar), before everything gets glued together.
import * as THREE from "/create/vendor/three.module.js";

// ---------------------------------------------------------------- what the shop sells
export const LIGHTBARS = [
  { name: "No light bar", price: 0 },
  { name: "40\" roof light bar", price: 450, desc: "A long LED bar on the roof. Lights up the trail at night (L)." },
  { name: "50\" roof bar + cube pods", price: 750, desc: "A huge roof bar plus two cube lights on the hood." },
  { name: "Bumper light bar", price: 350, desc: "A low LED bar in the front bumper." },
];
export const BOARDS = [
  { name: "No running boards", price: 0 },
  { name: "Black running boards", price: 300, desc: "Step bars down both sides." },
  { name: "Chrome nerf bars", price: 450, desc: "Shiny round step tubes." },
  { name: "Power drop steps", price: 900, desc: "Wide steps that look like they fold out." },
];
export const ANTENNAS = [
  { name: "No antenna", price: 0 },
  { name: "CB whip antenna", price: 120, desc: "A tall bendy CB radio antenna." },
  { name: "Dual CB whips", price: 200, desc: "Two whips, one on each side." },
  { name: "LED whip with a flag", price: 260, desc: "A glowing whip with a safety flag. Looks awesome at night!" },
];
export const WINCH_PRICE = 1200;
// dirt bike stuff
export const BAR_COLORS = [{ name: "Silver", c: 0xc8ccd2 }, { name: "Black", c: 0x1e1f24 }, { name: "Gold", c: 0xe0b020 }, { name: "Red", c: 0xd0202a }, { name: "Blue", c: 0x2a6ad0 }, { name: "Orange", c: 0xff7a1a }];
export const PAD_COLORS = [{ name: "Red", c: 0xd0202a }, { name: "Black", c: 0x1e1f24 }, { name: "Blue", c: 0x2a6ad0 }, { name: "Yellow", c: 0xffd23a }, { name: "Green", c: 0x3ac04a }, { name: "White", c: 0xf2f2f2 }];
export const GRIP_COLORS = [{ name: "Black", c: 0x1e1f24 }, { name: "Red", c: 0xd0202a }, { name: "Blue", c: 0x2a6ad0 }, { name: "Neon green", c: 0x6aff3a }, { name: "Orange", c: 0xff7a1a }, { name: "Pink", c: 0xff5ad8 }];
export const BAR_PRICE = 180, PAD_PRICE = 60, GRIP_PRICE = 40, MOTO_PRICE = 1100, KIT_PRICE = 350;
export const KITS = [
  { name: "No graphics", desc: "Plain plastics in your paint color." },
  { name: "Factory Stripes", desc: "Two bold racing stripes." },
  { name: "Tiger Claw", desc: "Wild slashes down the sides." },
  { name: "Camo", desc: "Blotchy hunting camo." },
  { name: "Checkered Flag", desc: "Race-day checkers." },
  { name: "Lightning", desc: "Zig-zag bolts." },
];
export const KIT_COLORS = [0xffffff, 0x1a1a22, 0xffd23a, 0x6aff3a, 0xff5ad8, 0x3ad0ff, 0xff7a1a, 0xe0203a];
export const HELMETS = [
  { name: "No helmet", c: null },
  { name: "Race White", c: 0xf2f2f2, c2: 0xe0203a }, { name: "Midnight Black", c: 0x1e1f24, c2: 0xffd23a }, { name: "Fire Red", c: 0xd0202a, c2: 0xffffff },
  { name: "Factory Blue", c: 0x2a6ad0, c2: 0xffffff }, { name: "Highlighter", c: 0xd8ff3a, c2: 0x1e1f24 }, { name: "Bubblegum", c: 0xff5ad8, c2: 0xffffff }, { name: "Orange Crush", c: 0xff7a1a, c2: 0x1e1f24 },
];
export const HELMET_PRICE = 150;
// who can have what
export const isTruckish = (v) => !v.bike && !v.quad && !v.mower && !v.heavy && !v.police;
export const canWinch = (v) => !v.bike && !v.mower;
export const hasHelmet = (v) => !!(v.bike || v.quad);
// a fresh helmet for dirt bikes + quads (you can take it off in the shop)
export const helmetOf = (car, v) => (hasHelmet(v) ? car.helmet ?? 1 : 0);

// ---------------------------------------------------------------- little helpers
const mats = {};
function lam(c) { const k = "l" + c; return mats[k] || (mats[k] = new THREE.MeshLambertMaterial({ color: c })); }
function shiny(c) { const k = "p" + c; return mats[k] || (mats[k] = new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: 0x999999 })); }
const GLOWG = new THREE.MeshBasicMaterial({ color: 0x6aff3a });
function bx(p, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; }
function rod(p, a, b, r, mat, r2 = r, seg = 8) { const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, d.length(), seg), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(m); return m; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// where the body is: shoot rays at the model to find the roof, the front bumper and the sides
const ray = new THREE.Raycaster();
function probe(C) {
  const skip = new Set(); if (C.rider) C.rider.root.traverse((o) => skip.add(o));
  const meshes = []; C.body.updateMatrixWorld(true);
  C.body.traverse((o) => { if (o.isMesh && !skip.has(o) && o.visible) meshes.push(o); });
  const inv = new THREE.Matrix4().copy(C.body.matrixWorld).invert();
  const hit = (from, dir) => { ray.set(from.clone().applyMatrix4(C.body.matrixWorld), dir.clone().transformDirection(C.body.matrixWorld)); ray.far = 40; const h = ray.intersectObjects(meshes, false)[0]; return h ? h.point.applyMatrix4(inv) : null; };
  const fw = C.wheels.filter((w) => w.front), rw = C.wheels.filter((w) => !w.front);
  const fz = fw.length ? fw[0].z : C.len / 3, rz = rw.length ? Math.min(...rw.map((w) => w.z)) : -C.len / 3, wr = C.wheels[0] ? C.wheels[0].r0 : 0.4;
  // the roof: straight down, over the seats (a little forward of the driver)
  let roof = null; for (const z of [C.seat.z + 0.25, C.seat.z, C.seat.z + 0.5, C.seat.z - 0.3]) { const p = hit(V3(0, 12, z), V3(0, -1, 0)); if (p && p.y > C.seat.y + 0.3) { roof = p; break; } }
  // the front: from way out in front, back toward the truck, at bumper height
  let front = null; for (const y of [wr * 1.25, wr * 1.6, wr, wr * 2]) { const p = hit(V3(0, y, 20), V3(0, 0, -1)); if (p) { front = p; break; } }
  // the side (between the wheels, at door-bottom height)
  let side = null; const mz = (fz + rz) / 2; for (const y of [wr * 1.5, wr * 1.8, wr * 2.2]) { const p = hit(V3(10, y, mz), V3(-1, 0, 0)); if (p) { side = p; break; } }
  return { roof, front, side, fz, rz, wr };
}

// ---------------------------------------------------------------- add every mod this car has
export function addMods(C, car, v) {
  const g = new THREE.Group(); g.name = "mods"; C.body.add(g); C.mods = g;
  if (car.lbar || car.boards || car.antenna || car.winch) truckMods(C, car, v, g);
  if (v.bike) bikeMods(C, car);
  if (car.snork && !v.bike && !v.boat && !v.mower) snorkel(C, v, g);
  if (C.rider && hasHelmet(v)) helmet(C, helmetOf(car, v));
}

// ---------------------------------------------------------------- the snorkel kit: a tall black air intake pipe
// (quads: up beside the handlebars, higher than your head; trucks + side-by-sides: up the windshield post to the roof)
function snorkel(C, v, g) {
  const blk = lam(0x1a1a1e);
  let x, z, y0, y1;
  if (v.quad) { x = C.wid * 0.32; z = C.seat.z + 0.62; y0 = C.seat.y - 0.08; y1 = C.seat.y + 1.25; }
  else {
    const P = probe(C);
    x = (P.side ? Math.abs(P.side.x) : C.wid / 2) + 0.04; z = P.roof ? P.roof.z + 0.75 : C.seat.z + 1.0;
    y0 = (P.side ? P.side.y : 0.9) + 0.1; y1 = (P.roof ? P.roof.y : C.seat.y + 1.1) + 0.2;
  }
  rod(g, V3(x, y0, z), V3(x, y1, z - 0.05), 0.065, blk, 0.065, 10);
  rod(g, V3(x, y0 - 0.02, z + 0.02), V3(x - 0.18, y0 - 0.12, z + 0.1), 0.06, blk, 0.06, 8); // into the airbox
  rod(g, V3(x, y1 - 0.04, z - 0.05), V3(x, y1 + 0.08, z + 0.12), 0.065, blk, 0.07, 10); // the bend
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.2, 12), blk); head.rotation.x = Math.PI / 2; head.position.set(x, y1 + 0.1, z + 0.2); g.add(head); // the ram head
  bx(g, 0.16, 0.08, 0.02, x, y1 + 0.1, z + 0.31, lam(0x3a3d44));
  for (const t of [0.3, 0.65]) bx(g, 0.05, 0.05, 0.12, x - 0.03, y0 + (y1 - y0) * t, z - 0.06, lam(0x55585e)); // clamps
}

function truckMods(C, car, v, g) {
  const P = probe(C), wid = C.wid;
  const roofY = P.roof ? P.roof.y : C.seat.y + 1.1, roofZ = P.roof ? P.roof.z : C.seat.z + 0.2;
  const frontZ = P.front ? P.front.z : C.len / 2, bumpY = P.front ? P.front.y : P.wr * 1.25;
  const sideX = P.side ? Math.abs(P.side.x) : wid / 2;
  const roofW = Math.min(wid * 0.92, 2.0), LED = C.ledMat = new THREE.MeshBasicMaterial({ color: 0x8a8e96 });
  C.lightbar = [];
  // ---- light bars
  if (car.lbar === 1 || car.lbar === 2) {
    const big = car.lbar === 2, w = big ? Math.min(roofW + 0.12, 2.05) : Math.min(roofW * 0.85, 1.55), y = roofY + 0.16, z = roofZ + 0.15;
    bx(g, w, 0.13, 0.16, 0, y, z, lam(0x1e1f24)); const led = bx(g, w - 0.08, 0.08, 0.02, 0, y, z + 0.085, LED); C.lightbar.push(led);
    for (let i = 0; i < Math.round(w / 0.12); i++) bx(g, 0.01, 0.085, 0.025, -w / 2 + 0.06 + i * 0.12, y, z + 0.09, lam(0x55585e)); // little cells
    for (const s of [-1, 1]) { bx(g, 0.05, 0.16, 0.05, s * (w / 2 - 0.12), y - 0.12, z - 0.02, lam(0x1e1f24)); bx(g, 0.12, 0.03, 0.12, s * (w / 2 - 0.12), y - 0.2, z - 0.02, lam(0x1e1f24)); } // mounts
    if (big && C.hood) for (const s of [-1, 1]) { // cube pods on the hood corners
      const px = s * Math.min(0.62, wid * 0.32), py = C.hood.y + 0.12, pz = C.hood.z + 0.5;
      bx(g, 0.16, 0.16, 0.14, px, py, pz, lam(0x1e1f24)); C.lightbar.push(bx(g, 0.12, 0.12, 0.02, px, py, pz + 0.075, LED)); bx(g, 0.04, 0.1, 0.04, px, py - 0.12, pz, lam(0x1e1f24));
    }
  }
  if (car.lbar === 3) {
    const w = Math.min(wid * 0.62, 1.3), y = bumpY + 0.02, z = frontZ + 0.07;
    bx(g, w, 0.11, 0.12, 0, y, z, lam(0x1e1f24)); C.lightbar.push(bx(g, w - 0.06, 0.07, 0.02, 0, y, z + 0.065, LED));
  }
  // ---- running boards (only on things with doors)
  if (car.boards && !v.open && P.side) {
    const len = Math.max(0.6, P.fz - P.rz - P.wr * 2 - 0.3), z = (P.fz + P.rz) / 2, y = Math.max(0.32, P.wr * 0.85);
    for (const s of [-1, 1]) {
      const x = s * (sideX + 0.13);
      if (car.boards === 1) { bx(g, 0.24, 0.05, len, x, y, z, lam(0x1e1f24)); bx(g, 0.2, 0.012, len - 0.06, x, y + 0.03, z, lam(0x3a3d44)); }
      if (car.boards === 2) rod(g, V3(x, y, z - len / 2), V3(x, y, z + len / 2), 0.045, shiny(0xd8dde3), 0.045, 10);
      if (car.boards === 3) { bx(g, 0.3, 0.05, len, x + s * 0.03, y - 0.04, z, lam(0x2a2b30)); bx(g, 0.28, 0.012, len - 0.06, x + s * 0.03, y - 0.01, z, shiny(0x8a8d92)); }
      for (const k of [-1, 1]) bx(g, 0.18, 0.05, 0.05, s * (sideX + 0.04), y + 0.02, z + k * (len / 2 - 0.15), lam(0x1e1f24)); // brackets
    }
  }
  // ---- antennas (on the back corner of the cab, or the back of an open ride)
  if (car.antenna) {
    const spots = car.antenna === 2 ? [-1, 1] : [1], az = Math.min(roofZ - 0.9, C.seat.z - 0.5), ay = Math.max(C.seat.y + 0.15, (P.side ? P.side.y : 0.8) + 0.35);
    for (const s of spots) {
      const x = s * Math.max(0.3, sideX - 0.08);
      bx(g, 0.08, 0.05, 0.08, x, ay, az, lam(0x1e1f24));
      const tall = car.antenna === 3 ? 1.9 : 1.55;
      const whip = rod(g, V3(x, ay, az), V3(x, ay + tall, az - 0.12), car.antenna === 3 ? 0.012 : 0.008, car.antenna === 3 ? GLOWG : lam(0x111111), car.antenna === 3 ? 0.012 : 0.004, 5);
      whip.name = "whip";
      if (car.antenna === 1 || car.antenna === 2) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), lam(0x111111)); tip.position.set(x, ay + tall, az - 0.12); g.add(tip); }
      if (car.antenna === 3) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshLambertMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })); f.position.set(x, ay + tall - 0.15, az - 0.12 - 0.17); f.rotation.y = Math.PI / 2; f.name = "flag"; g.add(f); C.whipFlag = f; }
    }
  }
  // ---- the front bumper winch: a drum with steel cable, a fairlead and a hook
  if (car.winch && canWinch(v)) {
    const y = Math.max(0.3, bumpY - 0.02), z = frontZ + 0.05, quad = v.quad;
    const k = quad ? 0.6 : 1;
    bx(g, 0.62 * k, 0.24 * k, 0.24 * k, 0, y, z, lam(0x1e1f24)); // the winch body
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * k, 0.09 * k, 0.4 * k, 10), shiny(0x9aa0a8)); drum.rotation.z = Math.PI / 2; drum.position.set(0, y + 0.02, z + 0.08 * k); g.add(drum);
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.095 * k, 0.012, 4, 10), lam(0x6a6d72)); r.rotation.y = Math.PI / 2; r.position.set(-0.15 * k + i * 0.06 * k, y + 0.02, z + 0.08 * k); g.add(r); }
    bx(g, 0.26 * k, 0.1 * k, 0.04, 0, y, z + 0.2 * k, shiny(0x8a8d92)); // fairlead
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05 * k, 0.014, 5, 10, Math.PI * 1.5), lam(0xd0202a)); hook.position.set(0, y - 0.06 * k, z + 0.24 * k); g.add(hook);
    C.winchAt = V3(0, y, z + 0.24 * k);
  }
}

// ---------------------------------------------------------------- dirt bike: bars, bar pad, grips, supermoto wheels
function bikeMods(C, car) {
  // supermoto: smaller, wider street wheels (the bike drops a little)
  if (car.moto) for (const w of C.wheels) {
    const k = 0.86; w.r0 *= k; w.r = w.r0; w.pivot.position.y = w.r;
    if (w.model) w.spin.scale.set(w.spin.scale.x * 1.55, w.spin.scale.y * k, w.spin.scale.z * k); else w.spin.scale.set(1.5, k, k);
    if (w.knobs) w.knobs.visible = false;
  }
  // bars + pad + grips ride on the part that steers
  const st = C.steerG; if (!st) return;
  const box = new THREE.Box3(), tmp = new THREE.Box3(); st.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(st.matrixWorld).invert();
  for (const m of st.children) if (m.isMesh) { m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); box.union(tmp); }
  if (box.isEmpty()) return;
  // the handlebar is the widest thing near the top of the front end
  let maxX = 0, sy = 0, sz = 0, n = 0; const top = box.max.y, p = new THREE.Vector3();
  for (const m of st.children) if (m.isMesh) {
    const pos = m.geometry.attributes.position, mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) { p.fromBufferAttribute(pos, i).applyMatrix4(mm); if (p.y > top - 0.12) { maxX = Math.max(maxX, Math.abs(p.x)); if (Math.abs(p.x) > 0.12) { sy += p.y; sz += p.z; n++; } } }
  }
  if (!n || maxX < 0.15) return;
  const by = sy / n, bz = sz / n, half = maxX - 0.02;
  const barC = (BAR_COLORS[car.bars ?? 0] || BAR_COLORS[0]).c;
  // tapered bars: fat in the middle, skinny at the ends, with a little rise
  rod(st, V3(-0.12, by + 0.01, bz), V3(0.12, by + 0.01, bz), 0.02, shiny(barC), 0.02, 10);
  for (const s of [-1, 1]) rod(st, V3(s * 0.12, by + 0.01, bz), V3(s * half, by + 0.035, bz - 0.03), 0.02, shiny(barC), 0.0135, 10);
  // the bar pad (on the middle of the bars, no crossbar on tapered bars!)
  if ((car.pad ?? 0) >= 0) { const pc = (PAD_COLORS[car.pad ?? 0] || PAD_COLORS[0]).c; const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.2, 4, 10), lam(pc)); pad.rotation.z = Math.PI / 2; pad.position.set(0, by + 0.03, bz + 0.005); st.add(pad); bx(st, 0.12, 0.012, 0.086, 0, by + 0.074, bz + 0.005, lam(0xf2f2f2)); }
  // grips
  const gc = (GRIP_COLORS[car.grips ?? 0] || GRIP_COLORS[0]).c;
  for (const s of [-1, 1]) { rod(st, V3(s * (half - 0.13), by + 0.03, bz - 0.022), V3(s * (half + 0.005), by + 0.036, bz - 0.03), 0.021, lam(gc), 0.021, 10); bx(st, 0.012, 0.05, 0.05, s * (half + 0.01), by + 0.036, bz - 0.03, lam(0x1e1f24)); }
}

// ---------------------------------------------------------------- a full-face motocross helmet with a peak + goggles
function helmet(C, i) {
  const H = HELMETS[i]; if (!H || H.c == null) return;
  const head = C.rider.head; if (!head) return;
  for (const o of head.children) if (o !== C.rider.stars) o.visible = false; // (hair + hats go inside the helmet)
  const g = new THREE.Group(); g.name = "helmet"; head.add(g);
  const shell = shiny(H.c), accent = lam(H.c2);
  // a blocky helmet to fit a blocky head: a shell, a rounded top, a chin bar that sticks out, a peak and goggles
  bx(g, 0.6, 0.5, 0.6, 0, 0.07, -0.01, shell);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), shell); dome.scale.set(0.97, 0.42, 0.97); dome.position.set(0, 0.31, -0.01); g.add(dome);
  bx(g, 0.1, 0.06, 0.62, 0, 0.36, -0.01, accent); bx(g, 0.62, 0.08, 0.1, 0, 0.0, -0.29, accent); // stripes
  bx(g, 0.46, 0.2, 0.18, 0, -0.12, 0.33, shell, 0.2); bx(g, 0.3, 0.06, 0.04, 0, -0.13, 0.43, accent, 0.2); // chin bar + vents
  bx(g, 0.56, 0.035, 0.26, 0, 0.36, 0.38, shell, -0.25); bx(g, 0.5, 0.04, 0.05, 0, 0.33, 0.5, accent, -0.25); // the peak
  bx(g, 0.5, 0.16, 0.06, 0, 0.13, 0.3, lam(0x1e1f24)); bx(g, 0.42, 0.1, 0.03, 0, 0.13, 0.335, new THREE.MeshPhongMaterial({ color: 0xff9a2a, shininess: 140, specular: 0xffffff })); // goggles
  for (const s of [-1, 1]) bx(g, 0.03, 0.08, 0.5, s * 0.305, 0.13, 0.02, accent); // the goggle strap
}

// ---------------------------------------------------------------- graphic kits (painted right onto the plastics with a shader)
// The paint material learns a pattern from the model's own shape, so it works on every bike without needing a decal.
export function graphics(C, car) {
  const mat = C.paint; if (!mat || mat.userData.kitU) return;
  const U = { kit: { value: 0 }, kitCol: { value: new THREE.Color(0xffffff) } };
  mat.userData.kitU = U;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.kit = U.kit; sh.uniforms.kitCol = U.kitCol;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vKP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvKP = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vKP; uniform float kit; uniform vec3 kitCol;
float kh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(kh(i), kh(i + vec2(1,0)), f.x), mix(kh(i + vec2(0,1)), kh(i + vec2(1,1)), f.x), f.y); }
float kitMask(vec3 p){
  if (kit < 0.5) return 0.0;
  if (kit < 1.5) { float a = abs(abs(p.x) - 0.05); return step(a, 0.03); }
  if (kit < 2.5) { float s = sin(p.z * 22.0 + p.y * 16.0 + sin(p.z * 5.0) * 2.0); return step(0.72, s) * step(0.05, abs(p.x)); }
  if (kit < 3.5) { return step(0.55, kn(p.zy * 9.0 + p.x * 3.0)); }
  if (kit < 4.5) { vec2 q = floor(vec2(p.z, p.y) * 14.0); return mod(q.x + q.y, 2.0); }
  float z = p.y * 10.0 + abs(fract(p.z * 4.0) - 0.5) * 3.0; return step(0.8, abs(fract(z) - 0.5) * 2.0) * step(0.05, abs(p.x));
}`).replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, kitCol, kitMask(vKP) * 0.95);");
  };
  mat.customProgramCacheKey = () => "kit";
  mat.needsUpdate = true;
}
export function applyKit(C, car) {
  const U = C.paint && C.paint.userData.kitU; if (!U) return;
  U.kit.value = car.kit || 0; U.kitCol.value.setHex(KIT_COLORS[car.kitCol ?? 0] ?? 0xffffff);
}
// tune: supermoto wheels are fast + grippy on the road, bad in the dirt
export function modTune(car, out) {
  if (car.moto) { out.top *= 1.1; out.grip *= 1.18; out.off.dirt = Math.max(0.3, out.off.dirt - 0.18); out.off.grass = Math.max(0.3, out.off.grass - 0.15); out.off.mud = Math.max(0.15, out.off.mud - 0.3); out.crawl *= 0.85; }
  return out;
}
