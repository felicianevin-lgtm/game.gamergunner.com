// ZOMBIE SIEGE: the blocky hero and the five gadgets they can hold.
import * as THREE from "/create/vendor/three.module.js";

const lam = (c, e) => { const m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); if (e) m.emissive = new THREE.Color(e); return m; };
const bas = (c) => new THREE.MeshBasicMaterial({ color: c });
function bx(parent, w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m;
}
function cy(parent, r, len, mat, x = 0, y = 0, z = 0, seg = 8) { // a cylinder lying along +z
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

// gun models (they point along +z); "muzzle" is how far forward the shot comes out
function makeGuns() {
  const guns = {};
  let g = new THREE.Group(); // blaster pistol: orange with a cyan glow
  bx(g, 0.16, 0.2, 0.42, lam(0xff8a2a), 0, 0, 0.12); bx(g, 0.13, 0.26, 0.13, lam(0x333344), 0, -0.17, -0.02);
  cy(g, 0.06, 0.2, lam(0x445566), 0, 0.02, 0.4); bx(g, 0.18, 0.06, 0.1, bas(0x5ff0ff), 0, 0.12, 0.08, false);
  guns.blaster = { g, muzzle: 0.52 };
  g = new THREE.Group(); // shotgun: chunky wood + double barrel
  bx(g, 0.18, 0.2, 0.5, lam(0x9a5a2a), 0, -0.02, -0.05); cy(g, 0.06, 0.62, lam(0x55555f), -0.05, 0.04, 0.5); cy(g, 0.06, 0.62, lam(0x55555f), 0.05, 0.04, 0.5);
  bx(g, 0.2, 0.12, 0.22, lam(0x6a3a1a), 0, -0.06, 0.32); bx(g, 0.14, 0.2, 0.12, lam(0x6a3a1a), 0, -0.16, -0.18);
  guns.shotgun = { g, muzzle: 0.85 };
  g = new THREE.Group(); // SMG: black + yellow stripes
  bx(g, 0.16, 0.2, 0.55, lam(0x2a2a30), 0, 0, 0.15); bx(g, 0.1, 0.32, 0.12, lam(0xffd23a), 0, -0.22, 0.2); bx(g, 0.17, 0.05, 0.4, lam(0xffd23a), 0, 0.1, 0.15);
  cy(g, 0.045, 0.22, lam(0x555560), 0, 0.02, 0.52); bx(g, 0.12, 0.22, 0.1, lam(0x2a2a30), 0, -0.16, -0.06);
  guns.smg = { g, muzzle: 0.66 };
  g = new THREE.Group(); // laser rail: white with glowing pink coils
  bx(g, 0.2, 0.22, 0.8, lam(0xf2f2f8), 0, 0, 0.25); for (let i = 0; i < 4; i++) cy(g, 0.13, 0.06, bas(0xff4af0), 0, 0, 0.1 + i * 0.16, 10);
  cy(g, 0.05, 0.3, lam(0x8888aa), 0, 0, 0.78); bx(g, 0.12, 0.24, 0.12, lam(0x8888aa), 0, -0.18, -0.05);
  guns.rail = { g, muzzle: 0.95 };
  g = new THREE.Group(); // rocket popper: green tube with a red tip
  cy(g, 0.15, 1.0, lam(0x4a8a3a), 0, 0.08, 0.2, 10); cy(g, 0.17, 0.12, lam(0x2a5a2a), 0, 0.08, 0.68, 10); cy(g, 0.17, 0.12, lam(0x2a5a2a), 0, 0.08, -0.28, 10);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), lam(0xff3a2a)); tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.08, 0.82); g.add(tip);
  bx(g, 0.12, 0.24, 0.12, lam(0x333340), 0, -0.14, 0.05);
  guns.rocket = { g, muzzle: 0.95 };
  return guns;
}

export function makeHero() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const skin = lam(0xf2c49a), hoodie = lam(0x23b5c8), jeans = lam(0x2a3a6a), shoe = lam(0xf4f4f4), cap = lam(0xe8402a), pack = lam(0xff9a2a);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.17, 0.82, 0); g.add(hip);
    bx(hip, 0.27, 0.62, 0.3, jeans, 0, -0.31, 0); bx(hip, 0.3, 0.2, 0.42, shoe, 0, -0.72, 0.05); bx(hip, 0.31, 0.06, 0.43, lam(0xe8402a), 0, -0.8, 0.05);
    legs.push(hip);
  }
  const torso = new THREE.Group(); torso.position.y = 0.82; g.add(torso);
  bx(torso, 0.72, 0.7, 0.42, hoodie, 0, 0.36, 0); bx(torso, 0.5, 0.1, 0.44, lam(0x1a8a9a), 0, 0.06, 0);
  bx(torso, 0.5, 0.55, 0.22, pack, 0, 0.4, -0.3); bx(torso, 0.3, 0.12, 0.1, lam(0xffd23a), 0, 0.5, -0.42, false);
  const head = new THREE.Group(); head.position.y = 0.98; torso.add(head);
  bx(head, 0.56, 0.54, 0.52, skin, 0, 0.27, 0);
  bx(head, 0.6, 0.18, 0.56, cap, 0, 0.56, 0); bx(head, 0.5, 0.06, 0.3, cap, 0, 0.5, 0.36); // red cap with a bill
  bx(head, 0.1, 0.13, 0.04, bas(0x1a1a22), -0.13, 0.3, 0.27, false); bx(head, 0.1, 0.13, 0.04, bas(0x1a1a22), 0.13, 0.3, 0.27, false);
  bx(head, 0.04, 0.04, 0.02, bas(0xffffff), -0.11, 0.33, 0.29, false); bx(head, 0.04, 0.04, 0.02, bas(0xffffff), 0.15, 0.33, 0.29, false);
  bx(head, 0.2, 0.05, 0.04, bas(0x8a3a2a), 0, 0.15, 0.27, false);
  bx(head, 0.58, 0.14, 0.54, lam(0x5a3a22), 0, 0.46, -0.02); // hair under the cap
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.45, 0.62, 0); torso.add(sh);
    bx(sh, 0.2, 0.55, 0.22, hoodie, 0, -0.26, 0); bx(sh, 0.18, 0.16, 0.18, skin, 0, -0.58, 0);
    arms.push(sh);
  }
  const gunPivot = new THREE.Group(); gunPivot.position.set(0.12, 0.42, 0.42); torso.add(gunPivot);
  const guns = makeGuns();
  for (const k in guns) { guns[k].g.visible = false; gunPivot.add(guns[k].g); }
  // muzzle flash: two crossed glowing planes + a ball
  const flash = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.12 : 0.36; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(r, 0); }
  const sg = new THREE.ShapeGeometry(star);
  const p1 = new THREE.Mesh(sg, fm); flash.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.9), fm); p2.rotation.x = Math.PI / 2; p2.position.z = 0.3; flash.add(p2);
  const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), fm); p3.rotation.y = Math.PI / 2; p3.position.z = 0.3; flash.add(p3);
  flash.visible = false; gunPivot.add(flash);
  // a soft blob shadow-ring under the hero so you can always find yourself
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), new THREE.MeshBasicMaterial({ color: 0x5ff0ff, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; root.add(ring);

  let cur = "blaster", flashT = 0;
  const H = {
    root, body: g, ring, guns,
    setGun(id) { for (const k in guns) guns[k].g.visible = k === id; cur = id; },
    muzzleLocal() { return guns[cur].muzzle; },
    flash(color) { flashT = 0.06; flash.visible = true; fm.color.set(color); flash.rotation.z = Math.random() * 6; const s = 0.8 + Math.random() * 0.6; flash.scale.set(s, s, s); flash.position.z = guns[cur].muzzle; },
    // speed 0..1 of running, t time, recoil 0..1, dash true/false
    animate(dt, speed, t, recoil, dashing) {
      const sw = Math.sin(t * 13) * speed;
      legs[0].rotation.x = sw * 0.8; legs[1].rotation.x = -sw * 0.8;
      g.position.y = Math.abs(Math.cos(t * 13)) * 0.07 * speed;
      torso.rotation.x = dashing ? 0.45 : 0.05 + speed * 0.08;
      // both arms hold the gun out front
      arms[1].rotation.set(-Math.PI / 2 + 0.1 + recoil * 0.5, 0, 0.1);
      arms[0].rotation.set(-Math.PI / 2 + 0.25 + recoil * 0.4, 0.6, 0, "YXZ");
      gunPivot.position.z = 0.42 - recoil * 0.15; gunPivot.rotation.x = -recoil * 0.35;
      head.rotation.y = Math.sin(t * 1.3) * 0.05;
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.visible = false; }
    },
    tip(a) { g.rotation.x = a; }, // falling over at game over
  };
  H.setGun("blaster");
  return H;
}

// placeable things: barricade (wood planks) and auto-turret
export function makeBarricade(alongZ) {
  const g = new THREE.Group(), wood = lam(0xb07a42), dark = lam(0x7a4e26), nail = lam(0xc0c0c8);
  const L = 2.4;
  for (let i = 0; i < 3; i++) { const b = bx(g, L, 0.22, 0.14, i === 1 ? dark : wood, 0, 0.2 + i * 0.3, (i - 1) * 0.06); b.rotation.z = (i - 1) * 0.06; b.receiveShadow = true; }
  for (const s of [-1, 1]) { bx(g, 0.18, 1.0, 0.5, dark, s * 1.0, 0.5, 0); bx(g, 0.06, 0.06, 0.06, nail, s * 1.0, 0.82, 0.26, false); }
  const cross = bx(g, L * 0.95, 0.16, 0.08, wood, 0, 0.5, 0.12); cross.rotation.z = 0.32;
  if (alongZ) g.rotation.y = Math.PI / 2;
  return g;
}
export function makeTurret() {
  const g = new THREE.Group(), metal = lam(0x6a7a8a), dark = lam(0x3a4450);
  for (let i = 0; i < 3; i++) { const l = bx(g, 0.1, 0.8, 0.1, dark, Math.sin(i * 2.1) * 0.32, 0.35, Math.cos(i * 2.1) * 0.32); l.rotation.set(Math.cos(i * 2.1) * 0.4, 0, -Math.sin(i * 2.1) * 0.4); }
  const head = new THREE.Group(); head.position.y = 0.85; g.add(head);
  bx(head, 0.55, 0.38, 0.6, metal, 0, 0, 0); bx(head, 0.4, 0.06, 0.62, lam(0x7dff5a), 0, 0.2, 0, false);
  cy(head, 0.07, 0.6, dark, -0.12, 0, 0.5); cy(head, 0.07, 0.6, dark, 0.12, 0, 0.5);
  bx(head, 0.3, 0.12, 0.05, bas(0x7dff5a), 0, 0.06, 0.31, false);
  return { g, head };
}
