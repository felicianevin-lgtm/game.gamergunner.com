// MUD VALLEY RP: blocky people. You (when you walk around), riders on bikes and ATVs, taxi riders, cops, robbers and the folks at job spots.
// People can hold things (a fishing rod, a blaster), get knocked out (stars spin around their head!) and pose for a photo with a fish.
import * as THREE from "/create/vendor/three.module.js";

const mat = (color) => new THREE.MeshLambertMaterial({ color });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
export const LOOKS = {
  you: { skin: 0xffc999, shirt: 0x2f8ae0, pants: 0x2a3550, shoes: 0xffffff, hair: 0x5a3a1a, cap: 0xff5a1a },
  cop: { skin: 0xe9b48a, shirt: 0x1f3f8a, pants: 0x1a2440, shoes: 0x111111, hair: 0x2a1a0a, cap: 0x14285a, badge: true },
  robber: { skin: 0xf1c8a4, shirt: 0x2a2a2a, pants: 0x3a3a4a, shoes: 0x222222, hair: 0x111111, cap: null, mask: 0x222226, stripes: true },
  npc: [
    { skin: 0xe9a87c, shirt: 0x39c36b, pants: 0x3a3a4a, shoes: 0x222222, hair: 0x1a1a1a, cap: null },
    { skin: 0xb97a50, shirt: 0xff5a8a, pants: 0x2a4bd6, shoes: 0xffffff, hair: 0x2a1a0a, cap: 0xffd23a },
    { skin: 0xf1d6c4, shirt: 0xffd23a, pants: 0x5a3a2a, shoes: 0x6a3a1a, hair: 0xd8a040, cap: null },
    { skin: 0x8a5a3a, shirt: 0x9a5aff, pants: 0x222a3a, shoes: 0xff4a4a, hair: 0x111111, cap: 0x3a3a3a },
    { skin: 0xffd0a8, shirt: 0xffffff, pants: 0x3a6a3a, shoes: 0x3a2a1a, hair: 0xb0b0b0, cap: 0x3a7a3a },
  ],
};
// your look for a career: cops wear the blue uniform, robbers a striped shirt (and a ski mask if you bought one)
export function lookFor(role, masked) {
  if (role === "cop") return LOOKS.cop;
  if (role === "robber") return { ...LOOKS.you, shirt: 0x2a2a2a, stripes: true, cap: masked ? null : 0x2a2a2a, mask: masked ? 0x222226 : null };
  return LOOKS.you;
}

// a kid made of boxes. Returns { root, parts, pose(kind, t), setLook(look), hold(item) }
export function makePerson(look = LOOKS.you, scale = 1) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hip = new THREE.Group(); hip.position.y = 0.9; body.add(hip);
  const m = { skin: mat(look.skin), shirt: mat(look.shirt), pants: mat(look.pants), shoes: mat(look.shoes), hair: mat(look.hair), cap: mat(look.cap || 0), mask: mat(look.mask || 0x222226), stripe: mat(0xf4f4f4) };
  const torso = box(0.62, 0.7, 0.36, m.shirt); torso.position.y = 0.35; hip.add(torso);
  const stripes = new THREE.Group(); hip.add(stripes);
  for (const y of [0.15, 0.35, 0.55]) { const s = box(0.64, 0.07, 0.38, m.stripe); s.position.y = y; stripes.add(s); }
  const badge = box(0.12, 0.14, 0.03, new THREE.MeshBasicMaterial({ color: 0xffd23a })); badge.position.set(-0.16, 0.5, 0.19); hip.add(badge);
  const head = new THREE.Group(); head.position.y = 0.95; hip.add(head);
  const face = box(0.5, 0.5, 0.48, m.skin); face.position.y = 0.06; head.add(face);
  const hair = box(0.54, 0.16, 0.52, m.hair); hair.position.set(0, 0.32, -0.02); head.add(hair);
  for (const x of [-0.12, 0.12]) { const e = box(0.08, 0.1, 0.02, mat(0x1a1a2a)); e.position.set(x, 0.1, 0.245); head.add(e); }
  const smile = box(0.18, 0.04, 0.02, mat(0x8a3a2a)); smile.position.set(0, -0.07, 0.245); head.add(smile);
  const capG = new THREE.Group(); head.add(capG);
  { const c = box(0.56, 0.16, 0.54, m.cap); c.position.y = 0.38; capG.add(c); const bill = box(0.5, 0.05, 0.28, m.cap); bill.position.set(0, 0.32, 0.36); capG.add(bill); }
  // a ski mask (with eye holes, so you can still see the eyes)
  const maskG = new THREE.Group(); head.add(maskG);
  { const top = box(0.54, 0.22, 0.52, m.mask); top.position.y = 0.24; maskG.add(top); const low = box(0.54, 0.2, 0.52, m.mask); low.position.y = -0.1; maskG.add(low); for (const x of [-0.25, 0.25]) { const sd = box(0.06, 0.14, 0.52, m.mask); sd.position.set(x, 0.07, 0); maskG.add(sd); } const pom = box(0.16, 0.12, 0.16, m.stripe); pom.position.y = 0.4; maskG.add(pom); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.41, 0.66, 0); hip.add(a);
    const am = box(0.2, 0.62, 0.22, m.shirt); am.position.y = -0.26; a.add(am);
    const hand = box(0.18, 0.14, 0.18, m.skin); hand.position.y = -0.62; a.add(hand); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.16, 0, 0); hip.add(l);
    const lm = box(0.24, 0.72, 0.28, m.pants); lm.position.y = -0.4; l.add(lm);
    const sh = box(0.26, 0.14, 0.36, m.shoes); sh.position.set(0, -0.82, 0.04); l.add(sh); legs.push(l);
  }
  // the right hand holds things. The item's +z points out of the fist (along the arm when the arm is raised forward)
  const hand = new THREE.Group(); hand.position.set(0, -0.66, 0.02); hand.rotation.x = Math.PI / 2; arms[1].add(hand);
  // knocked-out stars that spin around the head
  const stars = new THREE.Group(); stars.position.y = 0.62; head.add(stars); stars.visible = false;
  for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe14a : 0xffffff })); st.position.set(Math.cos(i * 1.57) * 0.42, 0, Math.sin(i * 1.57) * 0.42); stars.add(st); }
  root.scale.setScalar(scale);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const P = { root, body, hip, head, arms, legs, torso, hand, stars, item: null };
  P.setLook = (lk) => {
    m.skin.color.setHex(lk.skin); m.shirt.color.setHex(lk.shirt); m.pants.color.setHex(lk.pants); m.shoes.color.setHex(lk.shoes); m.hair.color.setHex(lk.hair);
    capG.visible = !!lk.cap && !lk.mask; if (lk.cap) m.cap.color.setHex(lk.cap);
    maskG.visible = !!lk.mask; if (lk.mask) m.mask.color.setHex(lk.mask);
    stripes.visible = !!lk.stripes; badge.visible = !!lk.badge; hair.visible = !lk.mask;
  };
  P.setLook(look);
  // put a thing in the right hand (null = empty hands)
  P.hold = (obj) => { if (P.item === obj) return; if (P.item) hand.remove(P.item); P.item = obj || null; if (obj) hand.add(obj); };
  // poses: "stand", "walk", "run", "sit" (driving), "ride" (on a bike/ATV), "wave", "jump", "cheer",
  // "aim" (gun), "rod" (holding a rod), "cast" (amt = 0..1 through the throw), "reel", "show" (holding up a fish),
  // "ko" (knocked out on the ground), "handsup", "cuffed"
  P.pose = (kind, t = 0, amt = 1) => {
    const sw = Math.sin(t * (kind === "run" ? 11 : 8)) * amt;
    hip.position.y = 0.9; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); head.rotation.set(0, 0, 0);
    stars.visible = kind === "ko";
    for (const a of arms) a.rotation.set(0, 0, 0);
    for (const l of legs) l.rotation.set(0, 0, 0);
    if (kind === "walk" || kind === "run") {
      const k = kind === "run" ? 0.9 : 0.6;
      legs[0].rotation.x = sw * k; legs[1].rotation.x = -sw * k; arms[0].rotation.x = -sw * k; arms[1].rotation.x = sw * k;
      hip.position.y = 0.9 + Math.abs(Math.cos(t * (kind === "run" ? 11 : 8))) * 0.06 * amt;
      body.rotation.x = kind === "run" ? 0.12 : 0;
      if (P.item) arms[1].rotation.x = -0.9; // (carry the thing out in front)
    } else if (kind === "sit" || kind === "ride") {
      legs[0].rotation.x = legs[1].rotation.x = kind === "ride" ? -1.25 : -1.5;
      arms[0].rotation.x = arms[1].rotation.x = kind === "ride" ? -1.15 : -1.3; arms[0].rotation.z = 0.1; arms[1].rotation.z = -0.1;
      hip.position.y = 0.0; body.rotation.x = kind === "ride" ? 0.25 : 0;
    } else if (kind === "wave") {
      arms[1].rotation.z = 2.6 + Math.sin(t * 9) * 0.35;
    } else if (kind === "jump") {
      legs[0].rotation.x = 0.5; legs[1].rotation.x = -0.3; arms[0].rotation.z = 0.5; arms[1].rotation.z = -0.5; arms[0].rotation.x = arms[1].rotation.x = -0.4;
    } else if (kind === "cheer") {
      arms[0].rotation.z = -2.6 - Math.sin(t * 10) * 0.3; arms[1].rotation.z = 2.6 + Math.sin(t * 10) * 0.3;
      hip.position.y = 0.9 + Math.abs(Math.sin(t * 10)) * 0.12;
    } else if (kind === "aim") {
      arms[1].rotation.x = -1.5; arms[0].rotation.x = -1.3; arms[0].rotation.z = -0.35; body.rotation.y = 0.12;
    } else if (kind === "rod") {
      arms[1].rotation.x = -0.75; arms[0].rotation.x = -0.6; arms[0].rotation.z = -0.3; hip.position.y = 0.9 + Math.sin(t * 2) * 0.01;
    } else if (kind === "cast") {
      // swing back over the shoulder, then whip forward
      const a = amt < 0.45 ? -0.75 - (amt / 0.45) * 2.35 : -3.1 + ((amt - 0.45) / 0.55) * 2.55;
      arms[1].rotation.x = a; arms[0].rotation.x = -0.5; body.rotation.y = amt < 0.45 ? 0.35 * (amt / 0.45) : 0.35 * (1 - (amt - 0.45) / 0.55);
      body.rotation.x = amt > 0.45 ? 0.12 : -0.08; legs[0].rotation.x = 0.25; legs[1].rotation.x = -0.15;
    } else if (kind === "reel") {
      arms[1].rotation.x = -0.9 - amt * 0.35; arms[0].rotation.x = -1.0 + Math.sin(t * 22) * 0.25 * amt; arms[0].rotation.z = -0.35;
      body.rotation.x = -0.18 * amt; legs[0].rotation.x = 0.3; legs[1].rotation.x = -0.2;
    } else if (kind === "show") {
      arms[0].rotation.x = arms[1].rotation.x = -2.6; arms[0].rotation.z = -0.25; arms[1].rotation.z = 0.25;
      hip.position.y = 0.9 + Math.abs(Math.sin(t * 6)) * 0.08; head.rotation.x = -0.15;
    } else if (kind === "ko") {
      // flat on your back, seeing stars
      body.rotation.x = -Math.PI / 2; body.position.set(0, 0.28, -0.75); hip.position.y = 0.0;
      arms[0].rotation.z = 1.2; arms[1].rotation.z = -1.2; legs[0].rotation.z = 0.2; legs[1].rotation.z = -0.2;
      stars.rotation.y = t * 4; head.rotation.z = Math.sin(t * 3) * 0.3;
    } else if (kind === "handsup") {
      arms[0].rotation.z = -2.9; arms[1].rotation.z = 2.9; hip.position.y = 0.9 + Math.sin(t * 6) * 0.02;
    } else if (kind === "cuffed") {
      arms[0].rotation.x = arms[1].rotation.x = 0.55; arms[0].rotation.z = -0.35; arms[1].rotation.z = 0.35; head.rotation.x = 0.25;
    } else {
      arms[0].rotation.z = 0.06; arms[1].rotation.z = -0.06;
      hip.position.y = 0.9 + Math.sin(t * 2) * 0.01;
      if (P.item) arms[1].rotation.x = -0.5;
    }
    // guns + tasers always point straight ahead (level with the ground), whatever the arm is doing
    if (P.item && P.item.userData.level) P.item.rotation.x = -(Math.PI / 2 + arms[1].rotation.x) * Math.cos(arms[1].rotation.z);
  };
  P.pose("stand");
  return P;
}

// ---------------------------------------------------------------- things to hold
// a fishing rod in 3 pieces that can bend (rod.userData.bend(0..1)); tip = where the line comes out
export function makeRod(color = 0x3a7ad0) {
  const g = new THREE.Group(), segs = [], L = [0.8, 0.7, 0.6], cork = mat(0xc89a5a), blank = mat(color);
  const handle = box(0.07, 0.07, 0.42, cork); handle.position.z = 0.05; g.add(handle);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10), mat(0x9aa0aa)); reel.rotation.z = Math.PI / 2; reel.position.set(0, -0.1, 0.1); g.add(reel);
  const crank = box(0.02, 0.12, 0.02, mat(0x222222)); crank.position.set(0.05, -0.12, 0.1); g.add(crank);
  let parent = g, z0 = 0.26;
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group(); s.position.z = z0; parent.add(s);
    const r = 0.026 - i * 0.007, piece = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, L[i], 6), i === 2 ? mat(0xff4a3a) : blank); piece.rotation.x = Math.PI / 2; piece.position.z = L[i] / 2; s.add(piece);
    segs.push(s); parent = s; z0 = L[i];
  }
  const tip = new THREE.Object3D(); tip.position.z = L[2]; segs[2].add(tip);
  g.rotation.x = -0.45; // (rods point a bit upwards)
  g.userData = { tip, crank, bend: (k) => { for (let i = 0; i < 3; i++) segs[i].rotation.x = k * (0.18 + i * 0.16); } };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// a realistic-looking gun (made-up models, no real brands). tier 0 pistol, 1 SMG, 2 scoped rifle, 3 pump shotgun.
// (the hand holds it at the grip = the origin; it points down +z)
export function makeBlaster(tier = 0) {
  const g = new THREE.Group(), steel = mat(0x2a2c30), black = mat(0x141416), dark = mat(0x3a3d42), wood = mat(0x6a4426);
  const add = (w, h, d, m, x, y, z, rx = 0) => { const o = box(w, h, d, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const tube = (r, len, m, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m); o.rotation.x = Math.PI / 2; o.position.set(0, y, z); g.add(o); return o; };
  let tipZ = 0.3, tipY = 0.08;
  add(0.06, 0.17, 0.08, black, 0, -0.04, 0, 0.25); // grip
  add(0.012, 0.05, 0.06, black, 0, 0.0, 0.08); // trigger guard
  if (tier === 0) { // pistol
    add(0.055, 0.06, 0.24, dark, 0, 0.075, 0.07); add(0.05, 0.035, 0.2, steel, 0, 0.035, 0.06);
    tube(0.012, 0.03, black, 0.075, 0.2); add(0.01, 0.015, 0.012, black, 0, 0.112, 0.17); tipZ = 0.22; tipY = 0.075;
  } else if (tier === 1) { // SMG
    add(0.06, 0.09, 0.36, dark, 0, 0.07, 0.1); add(0.04, 0.16, 0.05, black, 0, -0.06, 0.16, -0.15); // magazine
    tube(0.016, 0.16, steel, 0.08, 0.34); add(0.02, 0.03, 0.22, black, 0, 0.12, 0.06);
    add(0.015, 0.05, 0.2, steel, 0, 0.06, -0.16); add(0.04, 0.09, 0.02, black, 0, 0.04, -0.26); tipZ = 0.43; tipY = 0.08;
  } else if (tier === 2) { // scoped rifle
    add(0.06, 0.08, 0.5, dark, 0, 0.07, 0.15); add(0.055, 0.1, 0.3, wood, 0, 0.03, -0.22, 0.1); // stock
    add(0.05, 0.06, 0.26, wood, 0, 0.04, 0.3); tube(0.014, 0.42, steel, 0.08, 0.6);
    tube(0.028, 0.26, black, 0.16, 0.12); tube(0.034, 0.03, black, 0.16, 0.25); tube(0.034, 0.03, black, 0.16, -0.0); add(0.02, 0.04, 0.03, black, 0, 0.125, 0.22); add(0.02, 0.04, 0.03, black, 0, 0.125, 0.02);
    add(0.035, 0.12, 0.04, black, 0, -0.04, 0.14); tipZ = 0.82; tipY = 0.08;
  } else { // pump shotgun
    add(0.065, 0.09, 0.3, dark, 0, 0.07, 0.08); add(0.06, 0.11, 0.32, wood, 0, 0.03, -0.22, 0.1);
    tube(0.022, 0.62, steel, 0.095, 0.5); tube(0.018, 0.5, black, 0.05, 0.42);
    add(0.06, 0.06, 0.16, wood, 0, 0.05, 0.42); tipZ = 0.82; tipY = 0.095;
  }
  const tip = new THREE.Object3D(); tip.position.set(0, tipY, tipZ); g.add(tip);
  g.userData = { tip, color: 0x2a2c30, level: true };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// a cartoon cop taser: chunky yellow + black, with two little prongs (fires a lightning bolt, nothing real!)
export function makeTaser() {
  const g = new THREE.Group(), y = mat(0xffd23a), k = mat(0x22222a), glow = new THREE.MeshBasicMaterial({ color: 0x9af0ff });
  const body = box(0.11, 0.14, 0.3, y); body.position.set(0, 0.07, 0.12); g.add(body);
  const grip = box(0.08, 0.18, 0.09, k); grip.position.set(0, -0.05, 0); grip.rotation.x = 0.3; g.add(grip);
  const front = box(0.12, 0.12, 0.06, k); front.position.set(0, 0.07, 0.29); g.add(front);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), glow); p.position.set(s * 0.035, 0.07, 0.33); g.add(p); }
  const tip = new THREE.Object3D(); tip.position.set(0, 0.07, 0.35); g.add(tip);
  g.userData = { tip, level: true };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// a cartoon fish to hold up (color + size)
export function makeFish(color = 0x8ab0c0, size = 1) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); body.scale.set(0.55, 0.9, 1.6); g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.26, 4), m); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.42; tail.scale.set(0.3, 1, 1); g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 3), m); fin.position.set(0, 0.2, 0); g.add(fin);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(s * 0.11, 0.05, 0.24); g.add(e); }
  g.scale.setScalar(size);
  return g;
}
