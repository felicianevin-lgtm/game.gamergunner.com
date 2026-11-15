// MUD VALLEY RP: the inside of trucks + cars, for first person (V): a dashboard with a speedometer and a tachometer
// that really move, a steering wheel that turns with you, seats, door panels, a center console + shifter, a little
// radio screen and a rear-view mirror. Built around where the driver's head is, so it fits every ride.
// (Only shown in first person, in your own ride.)
import * as THREE from "/create/vendor/three.module.js";

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
let MAT = null;
const mats = () => MAT || (MAT = {
  dash: L(0x4a4d55), pad: L(0x5a5d66), trim: L(0x24262c), seat: L(0x5a5a64), carpet: L(0x34343a),
  chrome: new THREE.MeshPhongMaterial({ color: 0xc8ccd2, shininess: 60 }), mirror: new THREE.MeshBasicMaterial({ color: 0x8aa6c0 }),
  screen: new THREE.MeshBasicMaterial({ color: 0x2a8ad8 }), needle: new THREE.MeshBasicMaterial({ color: 0xff3a1a }),
  speedo: new THREE.MeshBasicMaterial({ map: dial("MPH", 12, false) }), tach: new THREE.MeshBasicMaterial({ map: dial("RPM x1000", 8, true) }),
});

// a gauge face: dark, with white tick marks + numbers around 270°, a red zone on the tachometer
function dial(label, n, red) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#0d0f14"; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = "#9aa4b4"; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke();
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  if (red) { g.strokeStyle = "#e0302a"; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 100, a0 + span * 0.78, a0 + span); g.stroke(); }
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  for (let i = 0; i <= n * 2; i++) {
    const a = a0 + span * (i / (n * 2)), big = i % 2 === 0, r1 = big ? 86 : 96;
    g.strokeStyle = "#fff"; g.lineWidth = big ? 5 : 3; g.beginPath(); g.moveTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); g.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); g.stroke();
    if (big) { g.font = "bold 24px Inter, sans-serif"; g.fillText(String(red ? i / 2 : i * 5), 128 + Math.cos(a) * 66, 128 + Math.sin(a) * 66); }
  }
  g.font = "bold 20px Inter, sans-serif"; g.fillStyle = "#9ad0ff"; g.fillText(label, 128, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const box = (p, w, h, d, x, y, z, m, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; p.add(b); return b; };

// which rides get one (bikes, quads, mowers, diggers + the side-by-sides have their own)
export const wantsCockpit = (v) => !(v.bike || v.quad || v.mower || v.heavy || ["sxs", "sxs4", "swamp", "mudmower", "racemower", "ztmower", "lawntractor"].includes(v.id));

// C = the ride's model, eye = where the driver's eyes are (in the ride's body space), paint = the paint material
export function buildCockpit(C, eye, paint) {
  const M = mats(), g = new THREE.Group(); g.visible = false; C.body.add(g); C.cockpit = g;
  // (low cars: the little driver sits so low their eyes are under the hood line, so lift the eyes to see over it)
  if (C.hood && C.hood.z > 0 && eye.y < C.hood.y + 0.32) eye.y = C.hood.y + 0.32; // (only a hood in front: a mid-engine car's engine lid is behind you)
  C.eye = eye.clone().add(new THREE.Vector3(0, 0, -0.1)); // (first person looks from here: a bit back, to see the wheel + the dash)
  const E = eye, hw = Math.max(0.5, C.wid / 2 - 0.16), dx = Math.abs(E.x) > 0.2 ? E.x : 0, two = dx !== 0;
  const dz = E.z + 0.7, top = E.y - 0.32; // (the front of the dash + its top)
  // dashboard: the body, a padded top, the gauge hood in front of you, vents + the radio screen in the middle
  box(g, hw * 2, 0.36, 0.44, 0, top - 0.18, dz + 0.16, M.dash);
  box(g, hw * 2, 0.05, 0.5, 0, top + 0.01, dz + 0.12, M.pad, -0.12);
  box(g, 0.46, 0.09, 0.16, dx, top + 0.035, dz - 0.03, M.trim);
  if (two) { box(g, 0.26, 0.16, 0.03, 0, top - 0.14, dz - 0.07, M.trim); box(g, 0.22, 0.12, 0.02, 0, top - 0.13, dz - 0.085, M.screen); }
  for (const x of [-hw + 0.16, two ? -0.2 : -0.25, two ? 0.2 : 0.25, hw - 0.16]) for (let k = 0; k < 3; k++) box(g, 0.16, 0.012, 0.02, x, top - 0.04 - k * 0.025, dz - 0.07, M.trim); // air vents
  if (two) box(g, 0.42, 0.18, 0.03, -dx * 0.95, top - 0.2, dz - 0.07, M.pad); // glove box
  // gauges (they live in the gauge hood, so you see them between the wheel's spokes)
  C.gauges = [];
  for (const [ox, mat] of [[0.11, M.speedo], [-0.11, M.tach]]) {
    const gp = new THREE.Group(); gp.position.set(dx + (dx >= 0 ? ox : -ox), top - 0.035, dz - 0.115); gp.rotation.x = -0.25; gp.rotation.y = Math.PI; g.add(gp);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), mat); gp.add(face);
    const nd = new THREE.Group(); nd.position.z = 0.004; gp.add(nd);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07, 0.003), M.needle); pin.position.y = 0.032; nd.add(pin);
    C.gauges.push(nd);
  }
  // the steering wheel (tilted toward you) on its column; the "spin" part turns when you steer
  const W = new THREE.Vector3(dx, E.y - 0.33, E.z + 0.44);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), M.trim); col.position.set(dx, W.y - 0.05, W.z + 0.15); col.rotation.x = Math.PI / 2 - 0.45; g.add(col);
  const tilt = new THREE.Group(); tilt.position.copy(W); tilt.rotation.set(-0.45, Math.PI, 0); g.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin); C.wheelSpin = spin;
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 8, 28), M.trim));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), M.dash); hub.rotation.x = Math.PI / 2; spin.add(hub);
  for (const a of [0, Math.PI, -Math.PI / 2]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.015), M.dash); s.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); s.rotation.z = a; spin.add(s); }
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 12), M.chrome); badge.rotation.x = Math.PI / 2; badge.position.z = -0.022; spin.add(badge);
  // seats: a cushion, a back + a headrest, with a stripe in your paint color
  const seat = (x) => {
    box(g, 0.52, 0.14, 0.52, x, E.y - 0.8, E.z - 0.02, M.seat);
    box(g, 0.52, 0.7, 0.13, x, E.y - 0.42, E.z - 0.34, M.seat, -0.14);
    box(g, 0.18, 0.66, 0.02, x, E.y - 0.42, E.z - 0.27, paint, -0.14);
    box(g, 0.3, 0.2, 0.1, x, E.y + 0.03, E.z - 0.42, M.seat, -0.14);
  };
  seat(dx); if (two) seat(-dx);
  // center console + the shifter (between the seats), the floor
  if (two) { box(g, 0.24, 0.26, 0.8, 0, E.y - 0.78, E.z + 0.12, M.trim); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), M.chrome); st.position.set(0, E.y - 0.58, E.z + 0.3); g.add(st); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), M.trim); kn.position.set(0, E.y - 0.48, E.z + 0.3); g.add(kn); }
  box(g, hw * 2, 0.04, 1.5, 0, E.y - 0.93, E.z + 0.25, M.carpet);
  // door panels with arm rests + handles
  for (const s of [-1, 1]) {
    box(g, 0.05, 0.5, 1.1, s * hw, E.y - 0.58, E.z + 0.15, M.dash);
    box(g, 0.12, 0.06, 0.5, s * (hw - 0.07), E.y - 0.42, E.z + 0.05, M.pad);
    box(g, 0.02, 0.03, 0.12, s * (hw - 0.03), E.y - 0.3, E.z + 0.32, M.chrome);
    box(g, 0.02, 0.06, 0.6, s * (hw - 0.01), E.y - 0.7, E.z + 0.12, paint); // a paint-color stripe on the door
  }
  // rear-view mirror on the windshield
  box(g, 0.015, 0.12, 0.015, 0, E.y + 0.19, E.z + 0.6, M.trim);
  box(g, 0.26, 0.075, 0.03, 0, E.y + 0.12, E.z + 0.58, M.trim);
  box(g, 0.24, 0.06, 0.005, 0, E.y + 0.12, E.z + 0.564, M.mirror);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); // (the cab roof's shadow made it all black: light it like the sky does through the windows)
}

// every frame in first person: turn the wheel, move the needles
export function animateCockpit(C, st) {
  const top = C.topSpeed || 30;
  if (!C.cockpit || !C.cockpit.visible) return;
  C.wheelSpin.rotation.z = (st.steer || 0) * 2.2;
  const mph = Math.abs(st.speed || 0) * 2.237, f = Math.min(1, mph / (top * 2.237 || 60));
  const rpm = st.burn ? 0.85 + Math.random() * 0.05 : 0.12 + ((f * 4.2) % 1) * 0.62 + f * 0.12; // (it "shifts gears" as you speed up)
  const ang = (k) => Math.PI * 0.75 - k * Math.PI * 1.5; // (0 = the bottom left, 1 = the bottom right)
  C.gauges[0].rotation.z = ang(Math.min(1, mph / 120));
  C.gauges[1].rotation.z = ang(Math.min(1, rpm));
}
