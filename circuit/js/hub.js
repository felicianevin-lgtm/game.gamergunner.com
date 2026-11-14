// CIRCUIT SIEGE: the HUB. A floating world of black platforms with glowing green edges and guardrails (you can't fall off).
//   - You spawn on the big round platform. Bridges go out west / east / south to the 3 maps, each with queue pads for
//     2, 4 and 8 players.
//   - Stairs go up north to the upper deck: turn RIGHT for the Crate Room (open crates), LEFT for the Trading Area.
//   - More stairs straight ahead go up to the ENDLESS deck (its own pads).
import * as THREE from "/create/vendor/three.module.js";
import { MAPS, PAD_SIZES, RARITIES, CRATES } from "./data.js";
import { box, cyl, mat, label, avatarModel } from "./models.js";

const G = 0x3aff6a; // the glow green
// walkable floors: circles, rectangles and ramps (stairs). y = the floor height (ramps go from y0 at z0 to y1 at z1)
const F = [
  { c: [0, 0], r: 16, y: 0, name: "spawn" },
  { x: [-40, -15.5], z: [-3, 3], y: 0 }, { x: [15.5, 40], z: [-3, 3], y: 0 }, { x: [-3, 3], z: [15.5, 40], y: 0 }, // bridges to the maps
  { c: [-50, 0], r: 11, y: 0, name: "map0" }, { c: [50, 0], r: 11, y: 0, name: "map1" }, { c: [0, 50], r: 11, y: 0, name: "map2" },
  { x: [-5, 5], z: [-31, -15.5], y0: 0, y1: 8, ramp: true }, // stairs up
  { x: [-14, 14], z: [-43, -31], y: 8, name: "deck" },
  { x: [14, 30.5], z: [-40, -34], y: 8 }, { x: [-30.5, -14], z: [-40, -34], y: 8 }, // to the Crate Room (right) + the Trading Area (left)
  { x: [30, 54], z: [-50, -24], y: 8, name: "crates" }, { x: [-54, -30], z: [-50, -24], y: 8, name: "trade" },
  { x: [-5, 5], z: [-59, -42.5], y0: 8, y1: 16, ramp: true }, // stairs up to Endless
  { c: [0, -73], r: 14.5, y: 16, name: "endless" },
];
const inF = (f, x, z) => (f.c ? (x - f.c[0]) ** 2 + (z - f.c[1]) ** 2 <= f.r * f.r : x >= f.x[0] && x <= f.x[1] && z >= f.z[0] && z <= f.z[1]);
const yOf = (f, z) => (f.ramp ? f.y0 + (f.y1 - f.y0) * ((f.z[1] - z) / (f.z[1] - f.z[0])) : f.y);
// the floor under (x, z) that you can stand on from height y (null = nothing: the guardrail stops you)
export function floorAt(x, z, y) { let best = null; for (const f of F) { if (!inF(f, x, z)) continue; const h = yOf(f, z); if (h <= y + 0.7 && (best === null || h > best)) best = h; } return best; }
export function zoneAt(x, z, y) { for (const f of F) if (f.name && inF(f, x, z) && Math.abs(yOf(f, z) - y) < 1.5) return f.name; return ""; }

// the queue pads: 3 per map (2, 4, 8 players) + 3 on the Endless deck
export const PADS = [];
{
  const spots = [[-55, 0, 0, 1], [55, 0, 0, 1], [0, 55, 1, 0]]; // (each map platform's far side, and which way the row goes)
  MAPS.filter((m) => !m.endless).forEach((m, mi) => { const [cx, cz, ax, az] = spots[mi]; PAD_SIZES.forEach((n, k) => PADS.push({ id: PADS.length, map: m.id, cap: n, x: cx + ax * (k - 1) * 6, z: cz + az * (k - 1) * 6, y: 0 })); });
  PAD_SIZES.forEach((n, k) => PADS.push({ id: PADS.length, map: "endless", cap: n, x: (k - 1) * 7, z: -78, y: 16 }));
}
export const CRATE_SPOTS = CRATES.map((c, i) => ({ r: c.r, x: 36 + (i % 3) * 7, z: i < 3 ? -44 : -31, y: 8 }));
export const TRADE_SPOT = { x: -42, z: -37, y: 8 }; // the trade terminal
export const LOCKER_SPOT = { x: 0, z: 6, y: 0 }; // your tower locker (loadout) on the spawn platform

// a black floor with a glowing grid
let gridTex = null;
function floorMat() {
  if (!gridTex) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#0a0f0c"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "rgba(58,255,106,0.35)"; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
    g.strokeStyle = "rgba(58,255,106,0.12)"; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
    gridTex = new THREE.CanvasTexture(c); gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.colorSpace = THREE.SRGBColorSpace; gridTex.anisotropy = 4;
  }
  return gridTex;
}
function texMat(rx, rz) { const t = floorMat().clone(); t.needsUpdate = true; t.repeat.set(rx, rz); return new THREE.MeshLambertMaterial({ map: t }); }

export class Hub {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); scene.add(this.root); this.padRings = []; this.padLabels = [];
    this.build();
    this.others = new Map();
  }
  build() {
    const R = this.root, glow = mat(G, true), dark = mat(0x16191c), gray = mat(0x3a3f46);
    // sky stuff: far glowing pillars, floating cubes (lights are in main.js)
    for (const f of F) {
      if (f.c) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(f.r, f.r, 0.6, 48), [new THREE.MeshLambertMaterial({ color: 0x23272c }), texMat(f.r / 2, f.r / 2), dark]); top.position.set(f.c[0], f.y - 0.3, f.c[1]); top.receiveShadow = true; R.add(top);
        const under = new THREE.Mesh(new THREE.CylinderGeometry(f.r * 0.92, f.r * 0.3, 6, 24), gray); under.position.set(f.c[0], f.y - 3.6, f.c[1]); R.add(under);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(f.r, 0.12, 6, 64), glow); ring.rotation.x = Math.PI / 2; ring.position.set(f.c[0], f.y + 0.01, f.c[1]); R.add(ring);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(f.r * 0.55, 0.07, 6, 48), mat(0x1aa04a, true)); ring2.rotation.x = Math.PI / 2; ring2.position.set(f.c[0], f.y + 0.02, f.c[1]); R.add(ring2);
      } else if (f.ramp) {
        const n = 14, w = f.x[1] - f.x[0], d = (f.z[1] - f.z[0]) / n;
        for (let i = 0; i < n; i++) { const z = f.z[1] - (i + 0.5) * d, y = f.y0 + ((f.y1 - f.y0) * (i + 1)) / n; const s = box(R, w, 0.4, d + 0.02, (f.x[0] + f.x[1]) / 2, y - 0.2, z, dark); s.receiveShadow = true; box(R, w, 0.04, 0.08, (f.x[0] + f.x[1]) / 2, y + 0.01, z + d / 2 - 0.04, glow); }
        const len = Math.hypot(f.z[1] - f.z[0], f.y1 - f.y0), mid = { y: (f.y0 + f.y1) / 2 - 1.2, z: (f.z[0] + f.z[1]) / 2 };
        const beam = box(R, w * 0.6, 1.2, len, (f.x[0] + f.x[1]) / 2, mid.y, mid.z, gray); beam.rotation.x = -Math.atan2(f.y1 - f.y0, f.z[1] - f.z[0]);
      } else {
        const w = f.x[1] - f.x[0], d = f.z[1] - f.z[0], top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), [dark, dark, texMat(w / 4, d / 4), dark, dark, dark]);
        top.position.set((f.x[0] + f.x[1]) / 2, f.y - 0.3, (f.z[0] + f.z[1]) / 2); top.receiveShadow = true; R.add(top);
        box(R, w, 1.2, d * 0.5, (f.x[0] + f.x[1]) / 2, f.y - 1.2, (f.z[0] + f.z[1]) / 2, gray);
      }
    }
    // guardrails: posts + a glowing top rail all around every floor edge, with openings where floors join
    const rail = (pts, y) => {
      const keep = pts.map(([x, z, ox, oz]) => floorAt(x + ox * 0.9, z + oz * 0.9, y + 0.2) === null);
      for (let i = 0; i < pts.length; i++) {
        if (!keep[i]) continue; const [x, z] = pts[i];
        box(R, 0.12, 1.1, 0.12, x, y + 0.55, z, gray);
        const j = (i + 1) % pts.length; if (!keep[j] || (pts.closed === false && j === 0)) continue;
        const [x2, z2] = pts[j], l = Math.hypot(x2 - x, z2 - z); if (l > 3) continue;
        const r = box(R, l, 0.08, 0.08, (x + x2) / 2, y + 1.1, (z + z2) / 2, glow); r.rotation.y = -Math.atan2(z2 - z, x2 - x);
        const r2 = box(R, l, 0.05, 0.05, (x + x2) / 2, y + 0.55, (z + z2) / 2, mat(0x1a8a3a, true)); r2.rotation.y = r.rotation.y;
      }
    };
    for (const f of F) {
      const pts = [];
      if (f.c) { const n = Math.round(f.r * 2.4); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, ox = Math.cos(a), oz = Math.sin(a); pts.push([f.c[0] + ox * (f.r - 0.15), f.c[1] + oz * (f.r - 0.15), ox, oz]); } rail(pts, f.y); }
      else {
        const side = (x0, z0, x1, z1, ox, oz) => { const l = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(l / 2.2)), P = []; for (let i = 0; i <= n; i++) P.push([x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n), ox, oz]); P.closed = false; return P; };
        const [a, b] = f.x, [c, d] = f.z, yy = (z) => yOf(f, z);
        for (const [P, yv] of [[side(a + 0.15, c + 0.15, a + 0.15, d - 0.15, -1, 0), null], [side(b - 0.15, c + 0.15, b - 0.15, d - 0.15, 1, 0), null], [side(a + 0.15, c + 0.15, b - 0.15, c + 0.15, 0, -1), yy(c)], [side(a + 0.15, d - 0.15, b - 0.15, d - 0.15, 0, 1), yy(d)]]) {
          if (yv !== null || !f.ramp) rail(P, yv ?? f.y);
          else for (let i = 0; i < P.length - 1; i++) { const [x, z] = P[i], [x2, z2] = P[i + 1], y1 = yy(z), y2 = yy(z2); box(R, 0.12, 1.1, 0.12, x, y1 + 0.55, z, gray); const l = Math.hypot(z2 - z, y2 - y1), r = box(R, 0.08, 0.08, l, x, (y1 + y2) / 2 + 1.1, (z + z2) / 2, glow); r.rotation.x = -Math.atan2(y2 - y1, z2 - z); }
        }
      }
    }
    // the queue pads
    for (const p of PADS) {
      const M = MAPS.find((m) => m.id === p.map), col = M.color;
      cyl(R, 2.3, 0.15, p.x, p.y + 0.08, p.z, mat(0x0c1210), 32);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 6, 40), mat(col, true)); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, p.y + 0.18, p.z); R.add(ring); this.padRings.push(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 5, 32, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(p.x, p.y + 2.6, p.z); R.add(beam); p.beam = beam;
      const lb = label(p.cap + " PLAYERS · 0/" + p.cap, "#ffffff", 3.6); lb.position.set(p.x, p.y + 3.4, p.z); R.add(lb); this.padLabels.push(lb);
    }
    // signs (holograms)
    const sign = (t, c, x, y, z, w = 9) => { const s = label(t, c, w, "rgba(0,0,0,0.55)"); s.position.set(x, y, z); R.add(s); return s; };
    MAPS.filter((m) => !m.endless).forEach((m, i) => { const [x, z] = [[-50, 0], [50, 0], [0, 50]][i]; sign(m.name.toUpperCase(), "#" + m.color.toString(16).padStart(6, "0"), x, 6.5, z, 12); sign(m.waves + " waves + a BOSS · ×" + m.diff + " tough", "#cfe", x, 5, z, 9); });
    sign("ENDLESS", "#3affe0", 0, 24, -80, 14); sign("Bosses every 20 waves · Wave 100 = OMEGA PRIME", "#cfe", 0, 22.2, -80, 12);
    sign("CRATES →", "#ffd23a", 9, 12, -37, 6); sign("← TRADING", "#3ad0ff", -9, 12, -37, 6); sign("ENDLESS ↑", "#3affe0", 0, 12.5, -42, 6);
    sign("CRATE ROOM", "#ffd23a", 42, 14, -37, 10); sign("TRADING AREA", "#3ad0ff", -42, 14, -37, 10);
    sign("CIRCUIT SIEGE", "#3aff6a", 0, 9, -14, 16);
    // crate pedestals (one per rarity)
    this.crates = [];
    for (const c of CRATE_SPOTS) {
      const R0 = RARITIES[c.r]; cyl(R, 1.2, 1.0, c.x, c.y + 0.5, c.z, mat(0x16191c), 8);
      const g = new THREE.Group(); g.position.set(c.x, c.y + 1.9, c.z); R.add(g);
      box(g, 1.3, 1.3, 1.3, 0, 0, 0, mat(0x1a1d22)); for (const [x, y] of [[0, 0.66], [0, -0.66]]) box(g, 1.36, 0.1, 1.36, x, y, 0, mat(R0.hex, true)); for (const x of [-0.66, 0.66]) box(g, 0.1, 1.36, 1.36, x, 0, 0, mat(R0.hex, true));
      this.crates.push(g); const lb = sign(R0.name.toUpperCase() + " CRATE", R0.color, c.x, c.y + 3.6, c.z, 4.6);
    }
    // the trade terminal + booths, and the locker on the spawn platform
    const term = (x, y, z, c) => { box(R, 1.4, 1.6, 0.8, x, y + 0.8, z, mat(0x16191c)); box(R, 1.2, 0.8, 0.05, x, y + 1.3, z + 0.42, mat(c, true)); };
    term(TRADE_SPOT.x, TRADE_SPOT.y, TRADE_SPOT.z, 0x3ad0ff); sign("TRADE TERMINAL", "#3ad0ff", TRADE_SPOT.x, TRADE_SPOT.y + 2.6, TRADE_SPOT.z, 3.2);
    for (const [x, z] of [[-48, -30], [-36, -30], [-48, -45], [-36, -45]]) { box(R, 3, 1, 1.4, x, 8.5, z, mat(0x1a1d22)); box(R, 3.1, 0.06, 1.5, x, 9.02, z, mat(0x3ad0ff, true)); }
    term(LOCKER_SPOT.x, LOCKER_SPOT.y, LOCKER_SPOT.z, G); sign("TOWER LOCKER", "#3aff6a", LOCKER_SPOT.x, 2.6, LOCKER_SPOT.z, 3.2);
    // floating glowing cubes far away (the void)
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 120, s = 1 + Math.random() * 4; const c = box(R, s, s, s, Math.cos(a) * d, -20 + Math.random() * 60, Math.sin(a) * d, mat(Math.random() < 0.7 ? 0x0f2a18 : G, Math.random() < 0.3)); c.rotation.set(Math.random(), Math.random(), 0); }
    R.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.receiveShadow = true; });
  }
  // the pad labels: "4 PLAYERS · 2/4"
  setPadCount(i, n) {
    const p = PADS[i], old = this.padLabels[i]; if (old.userData.n === n) return;
    const lb = label(p.cap + " PLAYERS · " + n + "/" + p.cap + (n ? "  ⏳" : ""), n ? "#3aff6a" : "#ffffff", 3.6); lb.position.copy(old.position); lb.userData.n = n;
    this.root.remove(old); old.material.map.dispose(); this.root.add(lb); this.padLabels[i] = lb;
    p.beam.material.opacity = n ? 0.22 : 0.08;
  }
  padAt(x, z, y) { for (const p of PADS) if ((x - p.x) ** 2 + (z - p.z) ** 2 < 2.2 * 2.2 && Math.abs(y - p.y) < 1.2) return p.id; return -1; }
  animate(t) { this.crates.forEach((c, i) => { c.rotation.y = t * 0.8 + i; c.position.y = 9.9 + Math.sin(t * 2 + i) * 0.15; }); this.padRings.forEach((r, i) => (r.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.03))); }
  // ---- other players in the hub (little robots with name tags)
  addOther(id, name, color) {
    if (this.others.has(id)) return; const m = avatarModel(color || 0x3ad0ff), tag = label(name, "#ffffff", 3); this.scene.add(m.root); this.scene.add(tag);
    this.others.set(id, { m, tag, name, x: 0, y: 0, z: 0, r: 0, tx: 0, ty: 0, tz: 0, tr: 0, walk: false, seen: false });
  }
  removeOther(id) { const o = this.others.get(id); if (!o) return; this.scene.remove(o.m.root); this.scene.remove(o.tag); this.others.delete(id); }
  clearOthers() { for (const id of [...this.others.keys()]) this.removeOther(id); }
  moveOther(id, p, r, w) { const o = this.others.get(id); if (!o) return; o.tx = p[0]; o.ty = p[1]; o.tz = p[2]; o.tr = r; o.walk = !!w; if (!o.seen) { o.seen = true; o.x = o.tx; o.y = o.ty; o.z = o.tz; o.r = o.tr; } }
  drawOthers(dt, t) {
    for (const o of this.others.values()) {
      const k = Math.min(1, dt * 10); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; let d = o.tr - o.r; d = Math.atan2(Math.sin(d), Math.cos(d)); o.r += d * k;
      o.m.root.position.set(o.x, o.y, o.z); o.m.root.rotation.y = o.r; o.m.pose(o.walk, t); o.tag.position.set(o.x, o.y + 2.7, o.z); o.m.root.visible = o.tag.visible = o.seen;
    }
  }
}
