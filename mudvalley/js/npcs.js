// MUD VALLEY RP: people walking around town, loot bags and your backpack. (Still cartoon: a splatted person is just
// knocked out, seeing stars, then gets up and runs off.)
//  - Civilians walk along the sidewalks near you (they come and go as you move, so there are always some around).
//    Shots nearby make them run; they hop out of the way of fast cars.
//  - Splat one and they drop a little backpack with their stuff (wallets, phones, watches...). Walk over it and press E:
//    it all goes in YOUR backpack. Sell backpack stuff at any Pawn Shop (all around the map).
//  - Knocked out yourself? You drop your backpack where you fell (go back and grab it). Busted by the cops? They
//    confiscate it (crime.js bust).
// Civilians use a light 7-box body (makeCivilian) so lots of them stay fast on a Chromebook.
import * as THREE from "/create/vendor/three.module.js";
import { groundAt, roadPoints, waterDepth } from "./terrain.js";
import { pushOut } from "./colliders.js";
import { S, save, money } from "./save.js";
import { SFX } from "./sfx.js";

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// stuff people carry (what a Pawn Shop pays: a random price in the range, fixed when you pick it up)
export const ITEMS = [
  { id: "wallet", name: "Wallet", icon: "👛", v: [40, 120], w: 10 },
  { id: "phone", name: "Phone", icon: "📱", v: [80, 200], w: 8 },
  { id: "shades", name: "Cool Sunglasses", icon: "🕶️", v: [30, 80], w: 7 },
  { id: "headphones", name: "Headphones", icon: "🎧", v: [60, 140], w: 6 },
  { id: "watch", name: "Gold Watch", icon: "⌚", v: [150, 300], w: 4 },
  { id: "console", name: "Game Console", icon: "🎮", v: [200, 350], w: 3 },
  { id: "chain", name: "Gold Chain", icon: "📿", v: [250, 500], w: 2 },
  { id: "ring", name: "Diamond Ring", icon: "💍", v: [400, 800], w: 1 },
];
const W = ITEMS.reduce((a, i) => a + i.w, 0);
function randomItem() { let r = Math.random() * W; for (const it of ITEMS) { r -= it.w; if (r <= 0) return it; } return ITEMS[0]; }
export const itemById = (id) => ITEMS.find((i) => i.id === id) || ITEMS[0];
export const packCap = () => (S.gear.duffel ? 16 : 10);
const newItem = () => { const it = randomItem(); return { id: it.id, v: Math.round(rnd(it.v[0], it.v[1]) / 5) * 5 }; };

const LOOKS = [[0x39c36b, 0x3a3a4a, 0xe9a87c, 0x1a1a1a], [0xff5a8a, 0x2a4bd6, 0xb97a50, 0x2a1a0a], [0xffd23a, 0x5a3a2a, 0xf1d6c4, 0xd8a040], [0x3a8ad0, 0x2a2a2a, 0x8a5a3a, 0x111111], [0xffffff, 0x4a6a3a, 0xffc999, 0x8a4a2a], [0xa04ad8, 0x3a3a4a, 0xe0b090, 0x3a2a1a], [0xff8a1a, 0x1a2a4a, 0x6a4028, 0x0a0a0a], [0xe0303a, 0x6a6a72, 0xf4c8a8, 0xc04a1a]];
const MATS = new Map(); const mat = (c) => MATS.get(c) || (MATS.set(c, new THREE.MeshLambertMaterial({ color: c })), MATS.get(c));
const BOX = new THREE.BoxGeometry(1, 1, 1);
function part(c, w, h, d, x, y, z, parent) { const m = new THREE.Mesh(BOX, mat(c)); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; }
// a light person: 7 boxes (torso, head, hair, 2 arms, 2 legs) on swinging joints
export function makeCivilian(L = pick(LOOKS)) {
  const [shirt, pants, skin, hair] = L, root = new THREE.Group(), hip = new THREE.Group(); hip.position.y = 0.88; root.add(hip);
  part(shirt, 0.5, 0.62, 0.3, 0, 0.31, 0, hip); part(skin, 0.36, 0.36, 0.34, 0, 0.82, 0, hip); part(hair, 0.38, 0.12, 0.36, 0, 1.03, -0.01, hip);
  const legs = [-1, 1].map((s) => { const g = new THREE.Group(); g.position.set(s * 0.13, 0, 0); hip.add(g); part(pants, 0.2, 0.86, 0.22, 0, -0.43, 0, g); return g; });
  const arms = [-1, 1].map((s) => { const g = new THREE.Group(); g.position.set(s * 0.34, 0.58, 0); hip.add(g); part(shirt, 0.16, 0.6, 0.18, 0, -0.28, 0, g); return g; });
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const P = { root, hip, legs, arms };
  P.pose = (kind, t, k = 1) => {
    hip.position.y = 0.88; hip.rotation.set(0, 0, 0); hip.position.z = 0;
    for (const a of arms) a.rotation.set(0, 0, 0); for (const l of legs) l.rotation.set(0, 0, 0);
    if (kind === "walk" || kind === "run") {
      const f = kind === "run" ? 11 : 7, s = Math.sin(t * f) * (kind === "run" ? 0.9 : 0.55) * k;
      legs[0].rotation.x = s; legs[1].rotation.x = -s; arms[0].rotation.x = -s; arms[1].rotation.x = s;
      if (kind === "run") { hip.rotation.x = 0.15; arms[0].rotation.z = -0.3; arms[1].rotation.z = 0.3; }
    } else if (kind === "panic") { // running with hands up, screaming
      const s = Math.sin(t * 12) * 0.9; legs[0].rotation.x = s; legs[1].rotation.x = -s; arms[0].rotation.z = -2.7 + s * 0.2; arms[1].rotation.z = 2.7 - s * 0.2;
    } else if (kind === "ko") { // flat on their back
      hip.rotation.x = -Math.PI / 2; hip.position.y = 0.2; hip.position.z = -0.4; arms[0].rotation.z = -1.2; arms[1].rotation.z = 1.2;
    } else if (kind === "dodge") { legs[0].rotation.x = 0.6; legs[1].rotation.x = -0.4; arms[0].rotation.z = -1.4; arms[1].rotation.z = 1.4; hip.position.y = 1.05; }
  };
  return P;
}
// a dropped backpack (bobs + spins a little so you can spot it)
function makeBag(mine) {
  const g = new THREE.Group();
  part(mine ? 0x3a6ad0 : 0x8a5a2a, 0.55, 0.6, 0.32, 0, 0.3, 0, g); part(mine ? 0x2a4a9a : 0x6a4020, 0.45, 0.25, 0.12, 0, 0.18, 0.2, g); part(0x222222, 0.42, 0.06, 0.06, 0, 0.62, 0, g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: mine ? 0x6ab0ff : 0xffd23a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.ring = ring; return g;
}

export class NPCs {
  constructor(api) {
    this.api = api; // { scene, me() {x,y,z,vx,vz,inCar,speed,yaw}, toast, crime, quality }
    this.civs = []; this.bags = []; this.spawnT = 0;
    this.max = api.quality() ? 16 : 7;
    this.stars = new THREE.Group();
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe14a : 0xffffff })); s.position.set(Math.cos(i * 1.256) * 0.55, 0, Math.sin(i * 1.256) * 0.55); this.stars.add(s); }
  }
  // ------------------------------------------------------------ people come and go around you
  spawn() {
    const me = this.api.me(), pts = roadPoints();
    for (let tries = 0; tries < 12; tries++) {
      const i = Math.floor(Math.random() * pts.length), p = pts[i], d = Math.hypot(p.x - me.x, p.z - me.z);
      if (!p.road || d < 45 || d > 130) continue;
      const side = Math.random() < 0.5 ? 1 : -1, off = rnd(5, 7), sx = Math.cos(p.yaw) * side, sz = -Math.sin(p.yaw) * side;
      const x = p.x + sx * off, z = p.z + sz * off;
      if (waterDepth(x, z) > 0.1 || pushOut(x, z, 0.5, groundAt(x, z) + 0.3).hit) continue;
      const m = makeCivilian(); this.api.scene.add(m.root);
      const n = 1 + Math.floor(Math.random() * Math.random() * 3);
      const c = { m, x, z, y: groundAt(x, z), yaw: 0, i, dir: Math.random() < 0.5 ? 1 : -1, side, off, state: "walk", t: Math.random() * 5, koT: 0, fleeT: 0, items: Array.from({ length: n }, newItem), speed: rnd(1.2, 1.7), goal: null };
      this.nextGoal(c); this.civs.push(c); return c;
    }
    return null;
  }
  nextGoal(c) {
    const pts = roadPoints(); let j = c.i + c.dir * 4;
    if (j < 0 || j >= pts.length || Math.hypot(pts[j].x - pts[c.i].x, pts[j].z - pts[c.i].z) > 30) { c.dir = -c.dir; j = c.i + c.dir * 4; if (j < 0 || j >= pts.length) j = c.i; }
    c.i = j; const p = pts[j], sx = Math.cos(p.yaw) * c.side, sz = -Math.sin(p.yaw) * c.side;
    c.goal = { x: p.x + sx * c.off, z: p.z + sz * c.off };
  }
  remove(c) { this.api.scene.remove(c.m.root); this.civs.splice(this.civs.indexOf(c), 1); }
  clear() { for (const c of this.civs.slice()) this.remove(c); }
  // ------------------------------------------------------------ things happening near them
  // a shot / a splat at (x, z): everyone close runs away from it
  alarm(x, z, r = 22) { for (const c of this.civs) if (c.state !== "ko" && Math.hypot(c.x - x, c.z - z) < r) { c.state = "flee"; c.fleeT = rnd(5, 8); c.fx = x; c.fz = z; } }
  // splatted by a blaster / taser (crime.js hit)
  knock(c, byRole) {
    if (c.state === "ko") return;
    c.state = "ko"; c.koT = 20; SFX.stun(); SFX.bonk();
    this.alarm(c.x, c.z, 30);
    if (byRole === "cop") { const f = Math.min(S.money, 100); S.money -= f; this.api.bumpMoney(); this.api.toast("Hey! That’s a civilian!", "Cops don’t shoot regular people. Fine: -" + money(f), "warn", 3200); save(); return; }
    if (c.items.length) { this.dropBag(c.x + rnd(-0.6, 0.6), c.z + rnd(-0.6, 0.6), c.items, false); c.items = []; }
    this.api.toast("They dropped their stuff!", "Walk over to the backpack and press E. Sell it at a Pawn Shop. 🎒", "good", 3000);
    if (S.role !== "cop") this.api.crime.setWanted(S.wanted + 1);
  }
  dropBag(x, z, items, mine) {
    if (!items.length) return;
    const m = makeBag(mine); const y = groundAt(x, z); m.position.set(x, y, z); this.api.scene.add(m);
    this.bags.push({ x, z, y, items: items.slice(), m, life: mine ? 180 : 120, mine });
  }
  // you got knocked out: your backpack falls off (outdoors only)
  dropMine(x, z) {
    if (!S.backpack.length) return;
    this.dropBag(x, z, S.backpack, true); const n = S.backpack.length; S.backpack = []; save();
    this.api.toast("🎒 You dropped your backpack!", n + " things fell out. Go back and grab them (blue ring)!", "warn", 4200);
  }
  confiscate() { for (const b of this.bags.slice()) if (b.mine) this.removeBag(b); }
  removeBag(b) { this.api.scene.remove(b.m); this.bags.splice(this.bags.indexOf(b), 1); }
  // E near a bag
  bagAction(me) {
    for (const b of this.bags) {
      if (Math.hypot(b.x - me.x, b.z - me.z) > 2.3) continue;
      if (S.backpack.length >= packCap()) return { text: "Your backpack is full! (" + packCap() + ") Sell stuff at a Pawn Shop", warn: true, fn: () => SFX.nope() };
      return { text: "Pick up " + (b.mine ? "your" : "the") + " backpack (" + b.items.length + " thing" + (b.items.length === 1 ? "" : "s") + ")", fn: () => this.take(b) };
    }
    return null;
  }
  take(b) {
    const room = packCap() - S.backpack.length, got = b.items.splice(0, room);
    S.backpack.push(...got); SFX.pickup(); SFX.cash();
    this.api.toast("🎒 +" + got.map((i) => itemById(i.id).icon).join(" "), "Backpack: " + S.backpack.length + " / " + packCap() + (b.items.length ? " (full! some stuff is still on the ground)" : ""), "cash", 2800);
    if (!b.items.length) this.removeBag(b);
    save();
  }
  // who your blaster can hit (crime.js targets)
  targets() { const out = []; for (const c of this.civs) if (c.state !== "ko") out.push({ kind: "civ", ref: c, x: c.x, y: c.y, z: c.z, vx: 0, vz: 0, r: 0.6 }); return out; }

  // ------------------------------------------------------------ every step
  update(dt, hidden) {
    const me = this.api.me();
    // keep the crowd topped up (not indoors, not during races)
    this.spawnT -= dt;
    if (!hidden && this.spawnT <= 0 && this.civs.length < this.max) { this.spawnT = 0.4; this.spawn(); }
    for (const c of this.civs.slice()) {
      c.t += dt;
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      if (d > 170 || (hidden && d > 60)) { this.remove(c); continue; }
      if (c.state === "ko") { c.koT -= dt; if (c.koT <= 0) { c.state = "flee"; c.fleeT = 10; c.fx = me.x; c.fz = me.z; } continue; }
      // a fast car coming right at them: jump out of the way (or get bonked)
      // (the whole car counts, not just its middle, and only some people are quick enough to hop away)
      if (me.inCar && me.speed > 3 && d < 14) {
        const tx = c.x - me.x, tz = c.z - me.z, fx = Math.sin(me.yaw), fz = Math.cos(me.yaw);
        const along = tx * fx + tz * fz, side = tx * fz - tz * fx, half = (me.len || 4) / 2, hw = ((me.car && me.car.m.wid) || 2) / 2;
        if (Math.abs(along) < half + 0.5 && Math.abs(side) < hw + 0.5) {
          c.state = "ko"; c.koT = 4; const k = Math.min(3, me.speed * 0.12); c.x += fx * k; c.z += fz * k; // (bonked a little way along)
          SFX.bonk(); this.api.toast("Bonk!", "Watch out for people!", "warn", 1400); continue;
        }
        if (c.quick === undefined) c.quick = Math.random() < 0.4;
        const vel = (tx * me.vx + tz * me.vz) / (me.speed || 1), lat = Math.abs(tx * me.vz - tz * me.vx) / (me.speed || 1);
        if (c.quick && me.speed > 8 && vel > half + 1 && vel < 8 && lat < hw + 1.2) {
          const px = -me.vz / me.speed, pz = me.vx / me.speed, sg = tx * px + tz * pz >= 0 ? 1 : -1;
          c.x += px * sg * 3.2 * dt; c.z += pz * sg * 3.2 * dt; c.dodge = 0.4;
        }
      }
      let mx = 0, mz = 0, sp = c.speed;
      if (c.state === "flee") { c.fleeT -= dt; mx = c.x - c.fx; mz = c.z - c.fz; sp = 5.2; if (c.fleeT <= 0) { c.state = "walk"; this.nextGoal(c); } }
      else { if (!c.goal || Math.hypot(c.goal.x - c.x, c.goal.z - c.z) < 1.2) this.nextGoal(c); mx = c.goal.x - c.x; mz = c.goal.z - c.z; }
      const l = Math.hypot(mx, mz) || 1; c.x += mx / l * sp * dt; c.z += mz / l * sp * dt;
      const y = groundAt(c.x, c.z), r = pushOut(c.x, c.z, 0.4, y + 0.3);
      if (r.hit) { c.x = r.x; c.z = r.z; if (c.state === "walk") { c.stuck = (c.stuck || 0) + dt; if (c.stuck > 1.5) { c.dir = -c.dir; c.stuck = 0; this.nextGoal(c); } } }
      if (waterDepth(c.x, c.z) > 0.4) { c.dir = -c.dir; this.nextGoal(c); }
      c.y = y; c.yaw += wrap(Math.atan2(mx, mz) - c.yaw) * Math.min(1, dt * 8);
      if (c.dodge > 0) c.dodge -= dt;
    }
    for (const b of this.bags.slice()) { b.life -= dt; if (b.life <= 0 || Math.hypot(b.x - me.x, b.z - me.z) > 400) this.removeBag(b); }
  }
  draw(time) {
    let ko = null;
    for (const c of this.civs) {
      c.m.root.position.set(c.x, c.y, c.z); c.m.root.rotation.y = c.yaw;
      c.m.pose(c.state === "ko" ? "ko" : c.dodge > 0 ? "dodge" : c.state === "flee" ? (c.fleeT > 3 ? "panic" : "run") : "walk", c.t);
      if (c.state === "ko" && c.koT > 4 && !ko) ko = c;
    }
    // stars over the closest knocked-out person
    if (ko) { if (!this.stars.parent) this.api.scene.add(this.stars); this.stars.position.set(ko.x, ko.y + 0.7, ko.z); this.stars.rotation.y = time * 4; }
    else if (this.stars.parent) this.api.scene.remove(this.stars);
    for (const b of this.bags) { b.m.rotation.y = time * 1.5; b.m.position.y = b.y + 0.1 + Math.abs(Math.sin(time * 3)) * 0.15; b.m.userData.ring.material.opacity = 0.45 + Math.sin(time * 5) * 0.25; }
  }
}
