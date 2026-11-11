// MUD VALLEY RP: blocky people. You (when you walk around), riders on bikes and ATVs, taxi riders and the folks at job spots.
import * as THREE from "/create/vendor/three.module.js";

const box = (w, h, d, color) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
export const LOOKS = {
  you: { skin: 0xffc999, shirt: 0x2f8ae0, pants: 0x2a3550, shoes: 0xffffff, hair: 0x5a3a1a, cap: 0xff5a1a },
  npc: [
    { skin: 0xe9a87c, shirt: 0x39c36b, pants: 0x3a3a4a, shoes: 0x222222, hair: 0x1a1a1a, cap: null },
    { skin: 0xb97a50, shirt: 0xff5a8a, pants: 0x2a4bd6, shoes: 0xffffff, hair: 0x2a1a0a, cap: 0xffd23a },
    { skin: 0xf1d6c4, shirt: 0xffd23a, pants: 0x5a3a2a, shoes: 0x6a3a1a, hair: 0xd8a040, cap: null },
    { skin: 0x8a5a3a, shirt: 0x9a5aff, pants: 0x222a3a, shoes: 0xff4a4a, hair: 0x111111, cap: 0x3a3a3a },
    { skin: 0xffd0a8, shirt: 0xffffff, pants: 0x3a6a3a, shoes: 0x3a2a1a, hair: 0xb0b0b0, cap: 0x3a7a3a },
  ],
};

// a kid made of boxes. Returns { root, parts, pose(kind, t) }
export function makePerson(look = LOOKS.you, scale = 1) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hip = new THREE.Group(); hip.position.y = 0.9; body.add(hip);
  const torso = box(0.62, 0.7, 0.36, look.shirt); torso.position.y = 0.35; hip.add(torso);
  const head = new THREE.Group(); head.position.y = 0.95; hip.add(head);
  const face = box(0.5, 0.5, 0.48, look.skin); face.position.y = 0.06; head.add(face);
  const hair = box(0.54, 0.16, 0.52, look.hair); hair.position.set(0, 0.32, -0.02); head.add(hair);
  for (const x of [-0.12, 0.12]) { const e = box(0.08, 0.1, 0.02, 0x1a1a2a); e.position.set(x, 0.1, 0.245); head.add(e); }
  const smile = box(0.18, 0.04, 0.02, 0x8a3a2a); smile.position.set(0, -0.07, 0.245); head.add(smile);
  if (look.cap) { const c = box(0.56, 0.16, 0.54, look.cap); c.position.y = 0.38; head.add(c); const bill = box(0.5, 0.05, 0.28, look.cap); bill.position.set(0, 0.32, 0.36); head.add(bill); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.41, 0.66, 0); hip.add(a);
    const am = box(0.2, 0.62, 0.22, look.shirt); am.position.y = -0.26; a.add(am);
    const hand = box(0.18, 0.14, 0.18, look.skin); hand.position.y = -0.62; a.add(hand); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.16, 0, 0); hip.add(l);
    const lm = box(0.24, 0.72, 0.28, look.pants); lm.position.y = -0.4; l.add(lm);
    const sh = box(0.26, 0.14, 0.36, look.shoes); sh.position.set(0, -0.82, 0.04); l.add(sh); legs.push(l);
  }
  root.scale.setScalar(scale);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const P = { root, body, hip, head, arms, legs, torso };
  // poses: "stand", "walk", "run", "sit" (driving), "ride" (on a bike/ATV), "wave", "jump"
  P.pose = (kind, t = 0, amt = 1) => {
    const sw = Math.sin(t * (kind === "run" ? 11 : 8)) * amt;
    hip.position.y = 0.9; body.rotation.set(0, 0, 0);
    if (kind === "walk" || kind === "run") {
      const k = kind === "run" ? 0.9 : 0.6;
      legs[0].rotation.x = sw * k; legs[1].rotation.x = -sw * k; arms[0].rotation.x = -sw * k; arms[1].rotation.x = sw * k;
      arms[0].rotation.z = arms[1].rotation.z = 0; hip.position.y = 0.9 + Math.abs(Math.cos(t * (kind === "run" ? 11 : 8))) * 0.06 * amt;
      body.rotation.x = kind === "run" ? 0.12 : 0;
    } else if (kind === "sit" || kind === "ride") {
      legs[0].rotation.x = legs[1].rotation.x = kind === "ride" ? -1.25 : -1.5;
      arms[0].rotation.x = arms[1].rotation.x = kind === "ride" ? -1.15 : -1.3; arms[0].rotation.z = 0.1; arms[1].rotation.z = -0.1;
      hip.position.y = 0.0; body.rotation.x = kind === "ride" ? 0.25 : 0;
    } else if (kind === "wave") {
      legs[0].rotation.x = legs[1].rotation.x = 0; arms[0].rotation.x = 0; arms[0].rotation.z = 0;
      arms[1].rotation.x = 0; arms[1].rotation.z = 2.6 + Math.sin(t * 9) * 0.35;
    } else if (kind === "jump") {
      legs[0].rotation.x = 0.5; legs[1].rotation.x = -0.3; arms[0].rotation.z = 0.5; arms[1].rotation.z = -0.5; arms[0].rotation.x = arms[1].rotation.x = -0.4;
    } else if (kind === "cheer") {
      legs[0].rotation.x = legs[1].rotation.x = 0; arms[0].rotation.z = -2.6 - Math.sin(t * 10) * 0.3; arms[1].rotation.z = 2.6 + Math.sin(t * 10) * 0.3; arms[0].rotation.x = arms[1].rotation.x = 0;
      hip.position.y = 0.9 + Math.abs(Math.sin(t * 10)) * 0.12;
    } else {
      legs[0].rotation.x = legs[1].rotation.x = 0; arms[0].rotation.x = arms[1].rotation.x = 0; arms[0].rotation.z = 0.06; arms[1].rotation.z = -0.06;
      hip.position.y = 0.9 + Math.sin(t * 2) * 0.01;
    }
  };
  P.pose("stand");
  return P;
}
