// CIRCUIT SIEGE: the robots. Tower robots (they get bigger and fancier the rarer they are), enemy robots (every kind looks
// different), bosses, and the little robot avatars players walk around the hub as. All made of boxes with glowing parts.
import * as THREE from "/create/vendor/three.module.js";
import { RARITIES, towerById, ENEMIES } from "./data.js";

const cache = new Map();
export const mat = (c, glow) => { const k = c + (glow ? "g" : ""); if (!cache.has(k)) cache.set(k, glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c })); return cache.get(k); };
const metal = (c) => { const k = "m" + c; if (!cache.has(k)) cache.set(k, new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x666666 })); return cache.get(k); };
export function box(g, w, h, d, x, y, z, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
export function cyl(g, r, h, x, y, z, m, seg = 12, r2 = r) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), m); o.position.set(x, y, z); g.add(o); return o; }
export function ball(g, r, x, y, z, m) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); o.position.set(x, y, z); g.add(o); return o; }

// ---------------------------------------------------------------- towers
// returns { root, head (turns to aim), muzzle (where shots come out), ring (shows the owner / selection) }
export function towerModel(id, lv = 0) {
  const T = towerById(id), R = RARITIES[T.r], s = R.size, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rc = R.hex, dark = metal(0x2a2d33), gray = metal(0x6a707a), lite = metal(0xb8c0c8), glow = mat(rc, true);
  // the base: a hex pad that glows in the rarity color
  cyl(body, 0.95, 0.25, 0, 0.12, 0, dark, 6); cyl(body, 0.98, 0.06, 0, 0.27, 0, glow, 6);
  const head = new THREE.Group(); head.position.y = 0.3; body.add(head);
  const muzzle = new THREE.Object3D();
  const k = T.kind;
  if (id === "bolt") { box(head, 0.6, 0.6, 0.6, 0, 0.5, 0, gray); box(head, 0.5, 0.12, 0.05, 0, 0.62, 0.31, glow); box(head, 0.14, 0.14, 0.6, 0, 0.45, 0.5, dark); muzzle.position.set(0, 0.45, 0.85); }
  else if (id === "scrap") { box(head, 0.7, 0.4, 0.7, 0, 0.35, 0, metal(0x7a5a3a)); const arm = box(head, 0.12, 0.8, 0.12, 0, 0.8, -0.1, gray); arm.rotation.x = -0.5; box(head, 0.35, 0.2, 0.35, 0, 1.15, 0.15, dark); box(head, 0.3, 0.08, 0.3, 0, 1.28, 0.15, glow); muzzle.position.set(0, 1.2, 0.2); }
  else if (id === "zap") { ball(head, 0.35, 0, 0.9, 0, lite); for (const s2 of [-1, 1]) { const r = box(head, 0.7, 0.04, 0.14, s2 * 0.5, 0.95, 0, dark); r.rotation.y = 0.4 * s2; } ball(head, 0.14, 0, 0.9, 0.3, glow); cyl(head, 0.05, 0.6, 0, 0.35, 0, gray); muzzle.position.set(0, 0.9, 0.35); }
  else if (id === "scout") { box(head, 0.4, 0.8, 0.4, 0, 0.5, 0, lite); box(head, 0.36, 0.14, 0.05, 0, 0.8, 0.21, glow); box(head, 0.08, 0.08, 0.7, 0.15, 0.6, 0.4, dark); box(head, 0.08, 0.08, 0.7, -0.15, 0.6, 0.4, dark); muzzle.position.set(0, 0.6, 0.8); }
  else if (id === "frost") { box(head, 0.7, 0.7, 0.7, 0, 0.45, 0, metal(0xd8f4ff)); for (let i = 0; i < 4; i++) { const c = box(head, 0.12, 0.5, 0.12, Math.cos(i * 1.57) * 0.35, 1.0, Math.sin(i * 1.57) * 0.35, mat(0x9af0ff, true)); c.rotation.z = 0.3; } ball(head, 0.18, 0, 0.95, 0, glow); muzzle.position.set(0, 0.95, 0.3); }
  else if (id === "rocket") { box(head, 0.8, 0.5, 0.8, 0, 0.35, 0, metal(0x5a6a4a)); for (const x of [-0.25, 0.25]) for (const y of [0.75, 1.0]) { cyl(head, 0.1, 0.5, x, y, 0.1, dark).rotation.x = Math.PI / 2; ball(head, 0.07, x, y, 0.38, mat(0xff5a1a, true)); } muzzle.position.set(0, 0.9, 0.45); }
  else if (id === "tesla") { cyl(head, 0.45, 0.5, 0, 0.3, 0, dark, 10); for (let i = 0; i < 4; i++) cyl(head, 0.38 - i * 0.06, 0.1, 0, 0.65 + i * 0.25, 0, i % 2 ? lite : metal(0xc8853a), 14); ball(head, 0.3, 0, 1.75, 0, glow); muzzle.position.set(0, 1.75, 0); }
  else if (id === "sniper") { box(head, 0.5, 0.9, 0.5, 0, 0.5, 0, dark); box(head, 0.45, 0.14, 0.05, 0, 0.85, 0.26, glow); box(head, 0.1, 0.1, 1.6, 0, 0.75, 0.9, lite); box(head, 0.18, 0.18, 0.18, 0, 0.75, 1.7, glow); muzzle.position.set(0, 0.75, 1.8); }
  else if (id === "cannon") { for (const x of [-0.35, 0.35]) box(body, 0.22, 0.7, 0.3, x, 0.6, 0, gray); box(head, 0.9, 0.6, 0.8, 0, 0.9, 0, metal(0x4a4e58)); cyl(head, 0.22, 1.1, 0, 0.95, 0.75, dark).rotation.x = Math.PI / 2; box(head, 0.7, 0.12, 0.05, 0, 1.1, 0.41, glow); muzzle.position.set(0, 0.95, 1.35); }
  else if (id === "hydra") { box(head, 0.8, 0.6, 0.8, 0, 0.5, 0, metal(0x3a3d44)); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78, nx = Math.cos(a) * 0.45, nz = Math.sin(a) * 0.45; const n = cyl(head, 0.07, 0.6, nx, 1.05, nz, gray); n.rotation.z = -nx * 0.6; n.rotation.x = nz * 0.6; ball(head, 0.16, nx * 1.4, 1.35, nz * 1.4, mat(0xffd23a, true)); } muzzle.position.set(0, 1.3, 0.5); }
  else if (id === "nova") { // a giant robot: legs, a chest core, shoulders, a head with a visor
    for (const x of [-0.3, 0.3]) box(body, 0.22, 0.8, 0.28, x, 0.65, 0, gray);
    box(head, 0.9, 0.8, 0.55, 0, 1.15, 0, metal(0x2a2a3a)); ball(head, 0.2, 0, 1.2, 0.28, glow); for (const x of [-0.6, 0.6]) { box(head, 0.35, 0.3, 0.35, x, 1.45, 0, lite); box(head, 0.18, 0.6, 0.18, x, 1.0, 0, gray); }
    box(head, 0.45, 0.35, 0.4, 0, 1.75, 0, lite); box(head, 0.4, 0.08, 0.05, 0, 1.78, 0.21, glow); muzzle.position.set(0, 1.2, 0.35);
  } else if (id === "quantum") { box(head, 0.6, 1.2, 0.6, 0, 0.8, 0, metal(0x1a1a2a)); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.12, 0.035, 6, 24), glow); r.position.y = 0.9 + i * 0.25; r.rotation.x = Math.PI / 2 + i * 0.4; r.name = "spin"; head.add(r); } ball(head, 0.22, 0, 1.6, 0, glow); muzzle.position.set(0, 1.6, 0); }
  else if (id === "omega") { // the wave-100 prize: a huge robot with wings of light
    for (const x of [-0.35, 0.35]) box(body, 0.28, 1.0, 0.32, x, 0.75, 0, metal(0x1a1a1e));
    box(head, 1.1, 1.0, 0.7, 0, 1.45, 0, metal(0x101014)); ball(head, 0.28, 0, 1.5, 0.36, glow); box(head, 1.0, 0.06, 0.05, 0, 1.85, 0.36, glow);
    for (const x of [-1, 1]) { const w = box(head, 1.1, 0.08, 0.5, x * 1.0, 1.8, -0.3, glow); w.rotation.z = x * 0.4; box(head, 0.4, 0.4, 0.4, x * 0.75, 1.8, 0, lite); }
    box(head, 0.55, 0.45, 0.5, 0, 2.2, 0, lite); box(head, 0.5, 0.1, 0.05, 0, 2.25, 0.26, mat(0xff3a3a, true)); muzzle.position.set(0, 1.5, 0.45);
  }
  // level pips (upgrades) on the base
  const pips = new THREE.Group(); body.add(pips);
  for (let i = 0; i < 3; i++) { const p = box(pips, 0.14, 0.08, 0.14, -0.25 + i * 0.25, 0.3, 0.72, mat(0xffd23a, true)); p.visible = i < lv; }
  head.add(muzzle);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.18, 32), new THREE.MeshBasicMaterial({ color: 0x3aff6a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root: g, head, muzzle, ring, pips, size: s };
}
export function setPips(m, lv) { m.pips.children.forEach((p, i) => (p.visible = i < lv)); }

// ---------------------------------------------------------------- enemies
export const VIS = 1.5; // (robots are drawn a bit bigger than they really are, so you can see them from up high)
export function enemyModel(e) {
  const E = ENEMIES[e], g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const c = metal(E.color), dark = metal(0x22242a), eye = mat(E.boss ? 0xff2a2a : 0xff3a3a, true), glow = mat(0x3aff6a, true);
  const legs = [];
  const leg = (x, h = 0.5) => { const l = new THREE.Group(); l.position.set(x, h, 0); b.add(l); box(l, 0.16, h, 0.2, 0, -h / 2, 0, dark); legs.push(l); };
  if (e === "drone") { ball(b, 0.35, 0, 1.2, 0, c); ball(b, 0.12, 0, 1.2, 0.3, eye); for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) { cyl(b, 0.25, 0.03, x, 1.42, z, mat(0x9adfff, true), 10); } }
  else if (e === "walker") { box(b, 0.6, 0.6, 0.45, 0, 0.85, 0, c); box(b, 0.4, 0.3, 0.35, 0, 1.3, 0, c); box(b, 0.3, 0.08, 0.05, 0, 1.32, 0.18, eye); leg(-0.17); leg(0.17); }
  else if (e === "runner") { box(b, 0.35, 0.45, 0.6, 0, 0.75, 0, c); const f = box(b, 0.3, 0.12, 0.25, 0, 1.0, 0.35, eye); f.rotation.x = 0.4; leg(-0.12, 0.55); leg(0.12, 0.55); box(b, 0.05, 0.4, 0.05, 0, 1.1, -0.3, glow); }
  else if (e === "shield") { box(b, 0.7, 0.7, 0.5, 0, 0.9, 0, c); box(b, 0.4, 0.1, 0.05, 0, 1.05, 0.26, eye); leg(-0.2); leg(0.2); const sh = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshBasicMaterial({ color: 0x3ab0ff, transparent: true, opacity: 0.25, depthWrite: false })); sh.position.y = 0.9; sh.name = "shield"; g.add(sh); }
  else if (e === "tank") { box(b, 1.1, 0.5, 1.3, 0, 0.45, 0, dark); box(b, 0.8, 0.45, 0.8, 0, 0.9, 0, c); cyl(b, 0.1, 0.9, 0, 0.95, 0.6, dark).rotation.x = Math.PI / 2; box(b, 0.5, 0.08, 0.05, 0, 1.0, 0.41, eye); for (const x of [-0.6, 0.6]) box(b, 0.2, 0.4, 1.4, x, 0.3, 0, metal(0x111114)); }
  else if (e === "splitter") { box(b, 0.5, 0.5, 0.5, -0.2, 0.9, 0, c); box(b, 0.5, 0.5, 0.5, 0.2, 0.9, 0, metal(0xffb04a)); box(b, 0.04, 0.6, 0.55, 0, 0.9, 0, glow); box(b, 0.5, 0.08, 0.05, 0, 1.0, 0.26, eye); leg(-0.2); leg(0.2); }
  else if (e === "mini") { box(b, 0.4, 0.4, 0.4, 0, 0.5, 0, c); box(b, 0.25, 0.06, 0.05, 0, 0.55, 0.21, eye); leg(-0.1, 0.3); leg(0.1, 0.3); }
  else if (e === "medic") { box(b, 0.6, 0.7, 0.5, 0, 0.9, 0, c); box(b, 0.36, 0.1, 0.05, 0, 1.0, 0.26, mat(0x3aff6a, true)); box(b, 0.1, 0.3, 0.05, 0, 0.85, 0.26, mat(0xff2a2a, true)); box(b, 0.3, 0.1, 0.05, 0, 0.85, 0.26, mat(0xff2a2a, true)); ball(b, 0.12, 0, 1.4, 0, mat(0x3aff6a, true)); leg(-0.17); leg(0.17); }
  else if (e === "heavy") { box(b, 1.2, 1.1, 0.8, 0, 1.3, 0, c); box(b, 0.6, 0.45, 0.55, 0, 2.05, 0, c); box(b, 0.5, 0.1, 0.05, 0, 2.1, 0.28, eye); for (const x of [-0.8, 0.8]) box(b, 0.35, 1.0, 0.4, x, 1.2, 0, dark); leg(-0.3, 0.75); leg(0.3, 0.75); }
  else { // bosses: a giant robot with spikes, glowing eyes and a crown of lights
    box(b, 1.4, 1.3, 1.0, 0, 1.6, 0, c); box(b, 0.8, 0.6, 0.7, 0, 2.6, 0, c); for (const x of [-0.2, 0.2]) box(b, 0.18, 0.12, 0.05, x, 2.65, 0.36, eye);
    for (const x of [-1.0, 1.0]) { box(b, 0.45, 1.2, 0.5, x, 1.5, 0, dark); box(b, 0.5, 0.5, 0.5, x, 2.25, 0, c); }
    for (let i = 0; i < 5; i++) { const s = box(b, 0.12, 0.4, 0.12, -0.3 + i * 0.15, 3.05, 0, mat(E.color, true)); s.rotation.z = (i - 2) * 0.15; }
    box(b, 1.0, 0.08, 0.05, 0, 1.8, 0.51, mat(E.color, true)); leg(-0.35, 0.95); leg(0.35, 0.95);
  }
  const vis = E.boss ? 1 : VIS; g.scale.setScalar(E.size * vis);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // health bar (and a blue shield bar) floating above
  const hb = new THREE.Group(); hb.position.y = (E.boss ? 3.6 : 2.0) * E.size + 0.3; g.add(hb); hb.scale.setScalar(1 / (E.size * vis));
  const bw = E.boss ? 3 : 1.1;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.16), new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })); bg.renderOrder = 5; hb.add(bg);
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.12), new THREE.MeshBasicMaterial({ color: E.boss ? 0xff2a6a : 0x3aff6a, depthTest: false })); fg.renderOrder = 6; fg.position.z = 0.001; hb.add(fg);
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.06), new THREE.MeshBasicMaterial({ color: 0x3ab0ff, depthTest: false })); sb.renderOrder = 7; sb.position.set(0, 0.11, 0.002); hb.add(sb);
  return { root: g, body: b, legs, hb, fg, sb, bw, fly: !!E.fly, shield: g.getObjectByName("shield") };
}

// ---------------------------------------------------------------- the player avatars in the hub (little robots)
export function avatarModel(color = 0x3aff6a) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const dark = metal(0x1e2026), c = metal(color), glow = mat(color, true);
  box(b, 0.6, 0.7, 0.4, 0, 1.15, 0, dark); box(b, 0.5, 0.08, 0.05, 0, 1.3, 0.21, glow); // body + chest light
  const head = new THREE.Group(); head.position.y = 1.7; b.add(head); box(head, 0.5, 0.42, 0.45, 0, 0, 0, c); box(head, 0.4, 0.1, 0.05, 0, 0.03, 0.23, mat(0x101010)); for (const x of [-0.1, 0.1]) box(head, 0.08, 0.06, 0.06, x, 0.03, 0.24, glow);
  cyl(head, 0.02, 0.25, 0, 0.33, 0, dark); ball(head, 0.06, 0, 0.48, 0, glow); // antenna
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.4, 1.45, 0); b.add(a); box(a, 0.16, 0.6, 0.18, 0, -0.27, 0, c); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.15, 0.8, 0); b.add(l); box(l, 0.2, 0.75, 0.22, 0, -0.4, 0, dark); box(l, 0.24, 0.1, 0.32, 0, -0.78, 0.04, c); legs.push(l);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root: g, head, arms, legs, pose(walk, t) { const s = walk ? Math.sin(t * 9) * 0.7 : 0; legs[0].rotation.x = s; legs[1].rotation.x = -s; arms[0].rotation.x = -s; arms[1].rotation.x = s; b.position.y = walk ? Math.abs(Math.cos(t * 9)) * 0.05 : 0; } };
}

// a floating name / label (a sprite with text)
export function label(text, color = "#ffffff", w = 4, bg = "rgba(5,10,8,0.7)") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d");
  g.font = "bold 52px 'Russo One', sans-serif"; const tw = Math.min(500, g.measureText(text).width + 40);
  g.fillStyle = bg; g.beginPath(); g.roundRect((512 - tw) / 2, 8, tw, 80, 24); g.fill();
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 50, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(w, w * 96 / 512, 1);
  return s;
}
