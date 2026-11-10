// LAVA TOWER: your blocky climber (procedural run / jump animation) and the shop cosmetics (colours + hats).
import * as THREE from "/create/vendor/three.module.js";
import { boxGeo, TEX } from "./tower.js";

export const SKINS = [
  { id: "red", name: "Fire Red", color: 0xff3b3b, pants: 0x3a3f55, price: 0 },
  { id: "blue", name: "Ocean Blue", color: 0x2e8bff, pants: 0x23304f, price: 20 },
  { id: "green", name: "Slime Green", color: 0x46d146, pants: 0x2d4a2d, price: 20 },
  { id: "pink", name: "Bubblegum", color: 0xff6ec7, pants: 0x5a2f5a, price: 40 },
  { id: "purple", name: "Grape", color: 0x9b5de5, pants: 0x2f2550, price: 40 },
  { id: "black", name: "Ninja", color: 0x24242c, pants: 0x111116, price: 75 },
  { id: "gold", name: "Golden", color: 0xffc928, pants: 0x8a6a10, price: 150, shiny: true },
];
export const HATS = [
  { id: "none", name: "No hat", icon: "🙂", price: 0 },
  { id: "cap", name: "Cap", icon: "🧢", price: 25 },
  { id: "party", name: "Party Hat", icon: "🥳", price: 50 },
  { id: "top", name: "Top Hat", icon: "🎩", price: 80 },
  { id: "horns", name: "Viking", icon: "⚔️", price: 100 },
  { id: "prop", name: "Propeller", icon: "🚁", price: 120 },
  { id: "crown", name: "Crown", icon: "👑", price: 200 },
];

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, map: TEX.stud, ...extra });
const plain = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

export class Climber {
  constructor() {
    this.root = new THREE.Group();        // at your feet, turns to face where you go
    this.body = new THREE.Group(); this.root.add(this.body); // (squash and stretch)
    this.shirt = std(0xff3b3b); this.pants = std(0x3a3f55); this.skin = plain(0xffd27a);
    const add = (geo, m, x, y, z, parent = this.body) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    // legs (pivot at the hip)
    this.legs = [-0.2, 0.2].map((x) => { const g = new THREE.Group(); g.position.set(x, 0.72, 0); this.body.add(g); add(boxGeo(0.36, 0.72, 0.4), this.pants, 0, -0.36, 0, g); add(boxGeo(0.38, 0.14, 0.46), plain(0x2b2b33), 0, -0.67, 0.03, g); return g; });
    add(boxGeo(0.82, 0.72, 0.44), this.shirt, 0, 1.08, 0);
    // arms (pivot at the shoulder)
    this.arms = [-0.55, 0.55].map((x) => { const g = new THREE.Group(); g.position.set(x, 1.38, 0); this.body.add(g); add(boxGeo(0.28, 0.7, 0.32), this.shirt, 0, -0.3, 0, g); add(boxGeo(0.27, 0.16, 0.3), this.skin, 0, -0.68, 0, g); return g; });
    // head + face
    this.head = new THREE.Group(); this.head.position.set(0, 1.46, 0); this.body.add(this.head);
    add(new THREE.BoxGeometry(0.56, 0.56, 0.56), this.skin, 0, 0.28, 0, this.head);
    const black = plain(0x1a1a22);
    for (const x of [-0.12, 0.12]) { add(new THREE.BoxGeometry(0.08, 0.13, 0.02), black, x, 0.33, 0.285, this.head); add(new THREE.BoxGeometry(0.035, 0.04, 0.01), plain(0xffffff), x + 0.015, 0.36, 0.297, this.head); }
    add(new THREE.BoxGeometry(0.2, 0.04, 0.02), black, 0, 0.17, 0.285, this.head);
    for (const x of [-0.12, 0.12]) add(new THREE.BoxGeometry(0.04, 0.04, 0.02), black, x, 0.19, 0.285, this.head);
    this.hatSlot = new THREE.Group(); this.hatSlot.position.y = 0.56; this.head.add(this.hatSlot);
    this.phase = 0; this.squash = 0; this.prop = null;
  }
  setLook(skinId, hatId) {
    const s = SKINS.find((k) => k.id === skinId) || SKINS[0];
    this.shirt.color.setHex(s.color); this.pants.color.setHex(s.pants);
    this.shirt.metalness = s.shiny ? 0.55 : 0; this.shirt.roughness = s.shiny ? 0.25 : 0.55;
    this.shirt.emissive.setHex(s.shiny ? 0x3a2a00 : 0x000000);
    while (this.hatSlot.children.length) this.hatSlot.remove(this.hatSlot.children[0]);
    this.prop = null;
    const h = this.hatSlot, add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); h.add(mesh); return mesh; };
    if (hatId === "cap") { add(new THREE.BoxGeometry(0.6, 0.18, 0.6), std(0x2e8bff), 0, 0.06, 0); add(new THREE.BoxGeometry(0.5, 0.05, 0.3), std(0x2e8bff), 0, -0.02, 0.4); }
    else if (hatId === "party") { const c = add(new THREE.ConeGeometry(0.24, 0.6, 12), plain(0xff4fa0), 0, 0.3, 0); c.rotation.z = 0.1; add(new THREE.SphereGeometry(0.08, 10, 8), plain(0xffe14d), 0.03, 0.62, 0); }
    else if (hatId === "top") { add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), plain(0x1d1d24), 0, 0.02, 0); add(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 20), plain(0x1d1d24), 0, 0.27, 0); add(new THREE.CylinderGeometry(0.275, 0.275, 0.08, 20), plain(0xff3b3b), 0, 0.1, 0); }
    else if (hatId === "crown") {
      const gold = plain(0xffcc22, { metalness: 0.7, roughness: 0.25, emissive: 0x4a3300 });
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 16, 1, true), gold, 0, 0.08, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, c = add(new THREE.ConeGeometry(0.07, 0.2, 6), gold, Math.sin(a) * 0.27, 0.26, Math.cos(a) * 0.27); c.rotation.set(0, a, 0); }
      add(new THREE.SphereGeometry(0.06, 8, 6), plain(0xff2050, { emissive: 0x500010 }), 0, 0.09, 0.3);
    } else if (hatId === "horns") {
      add(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), plain(0x9aa3b5, { metalness: 0.6, roughness: 0.3 }), 0, -0.04, 0);
      for (const sx of [-1, 1]) { const c = add(new THREE.ConeGeometry(0.08, 0.38, 8), plain(0xfff3d6), sx * 0.36, 0.12, 0); c.rotation.z = -sx * 1.0; }
    } else if (hatId === "prop") {
      add(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), plain(0xffd60a), 0, -0.03, 0);
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), plain(0x333333), 0, 0.33, 0);
      const p = new THREE.Group(); p.position.y = 0.44; h.add(p);
      for (const [c, r] of [[0xff3b3b, 0], [0x2e8bff, Math.PI / 2]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.1), plain(c)); b.rotation.y = r; p.add(b); }
      this.prop = p;
    }
  }
  // speed = how fast you're moving sideways, air = in the air, vy = up/down speed
  animate(dt, speed, air, vy, stunned) {
    const run = Math.min(1, speed / 7);
    if (!air) this.phase += dt * (4 + speed * 1.45);
    const sw = Math.sin(this.phase);
    let la, ra, ll, rl;
    if (stunned) { la = -2.6; ra = -2.4; ll = 0.6; rl = -0.6; this.body.rotation.x = -0.3; }
    else if (air) {
      const up = vy > 0;
      la = up ? -2.7 : -1.9; ra = up ? -0.3 : -1.6; ll = up ? -0.9 : -0.3; rl = up ? 0.5 : 0.35;
      this.body.rotation.x = 0;
    } else { la = sw * 1.1 * run; ra = -sw * 1.1 * run; ll = -sw * 1.0 * run; rl = sw * 1.0 * run; this.body.rotation.x = run * 0.12; }
    const k = 1 - Math.exp(-dt * 18);
    this.arms[0].rotation.x += (la - this.arms[0].rotation.x) * k; this.arms[1].rotation.x += (ra - this.arms[1].rotation.x) * k;
    this.legs[0].rotation.x += (ll - this.legs[0].rotation.x) * k; this.legs[1].rotation.x += (rl - this.legs[1].rotation.x) * k;
    this.arms[0].rotation.z = air ? -0.35 : -0.05; this.arms[1].rotation.z = air ? 0.35 : 0.05;
    this.body.position.y = air ? 0 : Math.abs(Math.cos(this.phase)) * 0.06 * run;
    this.squash = Math.max(0, this.squash - dt * 5);
    const s = Math.sin(this.squash * Math.PI) * 0.22;
    this.body.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
    if (this.prop) this.prop.rotation.y += dt * (air ? 30 : 8);
  }
  pose(name) { // fixed poses (thumbnail)
    if (name === "leap") { this.arms[0].rotation.set(-2.7, 0, -0.45); this.arms[1].rotation.set(-2.5, 0, 0.5); this.legs[0].rotation.x = -1.2; this.legs[1].rotation.x = 0.7; this.body.rotation.x = -0.1; this.head.rotation.x = -0.15; }
  }
}
