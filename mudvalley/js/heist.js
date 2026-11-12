// MUD VALLEY RP: robbing INSIDE buildings (guns, but nobody gets hurt for real: anyone who gets hit just sees stars).
//  - Hold-ups: a robber holding a blaster walks up to the teller / cashier and holds E. They put their hands up,
//    go to the cash register, scoop out the cash and throw the bundles to you (each one lands in your loot bag).
//  - Splat the teller with your blaster (Q) and they're knocked out for a while: then you can empty the register.
//  - The bank vault: a big steel door that stays shut until you drill it open (Super Drill, hold E), then it swings
//    open and you can walk in and grab the gold (crime.js has the rob spots).
// Rooms are built by interiors.js; this adds the moving parts (vault door, register drawer, flying cash) to them.
import * as THREE from "/create/vendor/three.module.js";
import { POCKET, HOLDUP, VAULT } from "./interiors.js";
import { blasterById, STUN_BLASTER } from "./crime.js";
import { S, save, money } from "./save.js";
import { SFX } from "./sfx.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const KO_TIME = 22, COOLDOWN = 150;
const GREEN = 0x3aa04a;

// a bundle of cartoon cash: green bills with a white paper band
function bundle() {
  const g = new THREE.Group();
  const bills = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.17), new THREE.MeshLambertMaterial({ color: 0x5ac85a }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.18), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  g.add(bills, band); return g;
}
// the bank vault door: a thick steel slab with a giant round door, a spinning wheel and bolts. Its hinge is at x = 0.
function vaultDoor() {
  const W = VAULT.door1 - VAULT.door0, H = VAULT.doorH, g = new THREE.Group(), steel = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 }), dark = new THREE.MeshLambertMaterial({ color: 0x6a6e78 }), gold = new THREE.MeshLambertMaterial({ color: 0xffd23a });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.45), dark); slab.position.set(W / 2, H / 2, 0); g.add(slab);
  const round = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.3, 28), steel); round.rotation.x = Math.PI / 2; round.position.set(W / 2, H / 2, 0.3); g.add(round);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), gold); b.rotation.x = Math.PI / 2; b.position.set(W / 2 + Math.cos(a) * 1.15, H / 2 + Math.sin(a) * 1.15, 0.48); g.add(b); }
  const wheel = new THREE.Group(); wheel.position.set(W / 2, H / 2, 0.55); g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), gold); wheel.add(rim);
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), gold); s.rotation.z = (i / 3) * Math.PI; wheel.add(s); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 10), gold); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (const y of [0.5, H - 0.5]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.5), dark); h.position.set(-0.05, y, 0); g.add(h); } // hinges
  g.userData.wheel = wheel;
  return g;
}

export class Heist {
  constructor(api) {
    this.api = api; // { scene, crime, interiors, me() (your walker), toast, banner, bumpMoney, aim() }
    this.cur = null; this.hold = null; this.flying = []; this.bits = []; this.shots = [];
    this.bitMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 120);
    this.bitMesh.count = 0; this.bitMesh.frustumCulled = false; this.bitMesh.setColorAt(0, new THREE.Color()); api.scene.add(this.bitMesh);
    this.shotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 24);
    this.shotMesh.count = 0; this.shotMesh.frustumCulled = false; this.shotMesh.setColorAt(0, new THREE.Color()); api.scene.add(this.shotMesh);
    // big spinning stars over a knocked-out keeper (so you can see them over the counter)
    this.stars = new THREE.Group();
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe14a : 0xffffff })); s.position.set(Math.cos(i * 1.047) * 0.6, 0, Math.sin(i * 1.047) * 0.6); this.stars.add(s); }
    this.stars.visible = false; api.scene.add(this.stars);
    this.heldUp = {}; // building id -> crime time when it can be held up again
    this.ko = {}; // building id -> crime time when its keeper wakes up
  }
  get t() { return this.api.crime.t; }
  // ------------------------------------------------------------ a room was just built (interiors.js)
  enter(cur) {
    this.cur = cur; this.hold = null; this.flying.length = 0; this.shots.length = 0; cur.busy = false;
    const sc = this.api.scene, at = (m, x, y, z) => { m.position.set(POCKET.x + x, y, POCKET.z + z); sc.add(m); cur.extras.push(m); return m; };
    // the register drawer (slides out when they open it) + the stack of cash they'll grab
    if (cur.register) {
      const r = cur.register;
      cur.drawer = at(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.46), new THREE.MeshLambertMaterial({ color: 0x55555f })), r.x, 1.13, r.z);
      const cash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), new THREE.MeshLambertMaterial({ color: 0x5ac85a })); cash.position.y = 0.07; cur.drawer.add(cash);
    }
    if (cur.bd.id === "bank") {
      const d = vaultDoor(); at(d, VAULT.door0, 0, VAULT.z + 0.28); cur.vault = d;
      cur.vaultC = { x: (VAULT.door0 + VAULT.door1) / 2, z: VAULT.z, hx: (VAULT.door1 - VAULT.door0) / 2, hz: 0.3 };
      const open = this.api.crime.vaultOpen();
      d.rotation.y = open ? -1.75 : 0; if (!open) cur.C.push(cur.vaultC);
    }
    if (cur.keeper && this.t < (this.ko[cur.bd.id] || 0)) cur.busy = true; // (still seeing stars from last time)
  }
  leave() {
    if (this.hold && this.hold.paid && !this.hold.done) this.finish(); // (you ran off in the middle: you keep what you caught)
    for (const f of this.flying) this.api.scene.remove(f.m);
    this.cur = null; this.hold = null; this.flying.length = 0; this.shots.length = 0; this.bits.length = 0; this.stars.visible = false; this.bitMesh.count = 0; this.shotMesh.count = 0;
  }
  // the vault door swings open (after drilling)
  openVault() {
    const c = this.cur; if (!c || !c.vault) return;
    c.vaultAnim = 0; const i = c.C.indexOf(c.vaultC); if (i >= 0) c.C.splice(i, 1);
    SFX.alarm(); this.api.banner("THE VAULT IS OPEN!", "Walk in and grab the gold (hold E)!");
  }
  // ------------------------------------------------------------ helpers
  local() { const w = this.api.me(); return { x: w.x - POCKET.x, z: w.z - POCKET.z }; }
  keeperSpot() { const k = this.cur.keeper.root.position; return { x: k.x - POCKET.x, z: k.z - POCKET.z }; }
  canHold() { const c = this.cur; return !!(c && c.keeper && c.register && HOLDUP[c.bd.id]); }
  isKO() { return !!(this.cur && this.t < (this.ko[this.cur.bd.id] || 0)); }
  holding() { return !!(this.hold && !this.hold.done); }
  aimYaw() { const me = this.local(), k = this.keeperSpot(); return Math.atan2(k.x - me.x, k.z - me.z); }

  // ------------------------------------------------------------ E: hold them up / empty the register
  action(l) {
    const c = this.cur; if (!this.canHold() || S.role !== "robber") return null;
    const H = HOLDUP[c.bd.id], k = this.keeperSpot(), d = Math.hypot(k.x - l.x, k.z - l.z);
    if (this.hold) return null;
    if (this.isKO()) {
      const r = c.register; if (Math.hypot(r.x - l.x, r.z + 1 - l.z) > 2.2) return null;
      if (this.t < (this.heldUp[c.bd.id] || 0)) return { text: "The register is empty. Come back later!", warn: true, fn: () => SFX.nope() };
      if (S.loot >= this.api.crime.lootCap()) return { text: "Your bag is full! Stash it at the hideout", warn: true, fn: () => SFX.nope() };
      return { id: "register_" + c.bd.id, text: "Hold E: Empty the cash register", hold: 2.4, tick: () => { if (Math.random() < 0.15) SFX.reel(); }, done: () => { this.heldUp[c.bd.id] = this.t + COOLDOWN; const n = this.give(rnd(H.loot[0], H.loot[1])); this.api.crime.robberyDone(H.heat, n, true); } };
    }
    if (d > 6) return null;
    if (this.t < (this.heldUp[c.bd.id] || 0)) return { text: "The " + H.who + " has no cash left. Come back later!", warn: true, fn: () => SFX.nope() };
    if (S.equip !== "blaster" || !S.blaster) return { text: S.blaster ? "Take out your gun (X) to hold up the " + H.who : "Get a gun at the Gun Shop to hold up the " + H.who, warn: true, fn: () => SFX.nope() };
    if (S.loot >= this.api.crime.lootCap()) return { text: "Your bag is full! Stash it at the hideout", warn: true, fn: () => SFX.nope() };
    return { id: "holdup_" + c.bd.id, text: "Hold E: “Hands up! Give me the cash!”", hold: 0.8, tick: () => {}, done: () => this.startHold() };
  }
  startHold() {
    const c = this.cur, H = HOLDUP[c.bd.id];
    c.busy = true; this.heldUp[c.bd.id] = this.t + COOLDOWN;
    this.hold = { phase: "handsup", t: 0, throws: 0, total: Math.round(rnd(H.loot[0], H.loot[1]) / 5) * 5, paid: 0, H, done: false };
    SFX.alarm(); this.api.toast("“Okay, okay! Don’t shoot!”", "The " + H.who + " is getting the cash...", "warn", 3000);
  }
  give(n) { // add to the loot bag (up to the bag size), returns how much fit
    const cr = this.api.crime, got = Math.max(0, Math.min(cr.lootCap() - S.loot, Math.round(n / 5) * 5));
    S.loot += got; return got;
  }
  finish() {
    const h = this.hold; if (!h || h.done) return; h.done = true;
    this.api.crime.robberyDone(h.H.heat, h.paid, false);
  }

  // ------------------------------------------------------------ Q: your blaster indoors
  fire(yaw) {
    const c = this.cur; if (!c) return false;
    const bl = blasterById(S.blaster) || (S.role === "cop" ? STUN_BLASTER : null);
    if (!bl) { this.api.toast("No gun", "Buy one at the Gun Shop in Copper Creek.", "warn"); return false; }
    const cr = this.api.crime; if (cr.fireT > 0) return false; cr.fireT = bl.rate;
    const me = this.local();
    let dx = Math.sin(yaw), dy = 0, dz = Math.cos(yaw);
    if (c.keeper && !this.isKO()) { const k = this.keeperSpot(), kd = Math.hypot(k.x - me.x, k.z - me.z), a = Math.atan2(k.x - me.x, k.z - me.z); if (kd < bl.range && Math.abs(wrap(a - yaw)) < 0.6) { dx = (k.x - me.x) / kd; dz = (k.z - me.z) / kd; dy = -0.02; } }
    const col = 0xffe6a0, sp = 90;
    this.shots.push({ x: me.x + dx * 0.6, y: 1.35, z: me.z + dz * 0.6, vx: dx * sp, vy: dy * sp, vz: dz * sp, life: 0.5, color: col, stun: bl.stun });
    this.api.crime.muzzle(POCKET.x + me.x + dx * 0.7, 1.35, POCKET.z + me.z + dz * 0.7, bl.tier);
    SFX.bang(bl.tier); return true;
  }
  splatKeeper() {
    const c = this.cur, id = c.bd.id;
    if (id === "police") { SFX.nope(); this.api.toast("The desk sergeant ducked!", "Nice try. (You can’t shoot a cop in their own station.)", "warn"); return; }
    if (this.hold && !this.hold.done) this.finish();
    this.ko[id] = this.t + KO_TIME; c.busy = true; SFX.stun(); SFX.bonk();
    const H = HOLDUP[id];
    if (S.role === "robber") { this.api.crime.setWanted(S.wanted + 1); this.api.toast("BANG! The " + (H ? H.who : "shopkeeper") + " is seeing stars!", H && c.register ? "Quick: hold E at the cash register to empty it!" : "They’ll wake up soon...", "good", 3600); }
    else this.api.toast("Oops! 😵 They’re seeing stars.", "Only robbers get anything for that. They’ll wake up soon.", "warn", 3200);
  }

  // ------------------------------------------------------------ every step
  update(dt) {
    const c = this.cur; if (!c) return;
    const w = this.api.me(), me = this.local();
    // the vault door swinging open
    if (c.vault && c.vaultAnim !== undefined && c.vaultAnim < 1) { c.vaultAnim = Math.min(1, c.vaultAnim + dt / 1.6); const k = c.vaultAnim; c.vault.rotation.y = -1.75 * (k * k * (3 - 2 * k)); c.vault.userData.wheel.rotation.z = k * 9; }
    // goo balls flying across the room
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.life -= dt;
      let hit = false, wall = false; const n = Math.max(1, Math.ceil(90 * dt / 0.3)), h = dt / n;
      for (let k = 0; k < n && !hit && !wall; k++) {
        s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h;
        wall = Math.abs(s.x) > c.bd.w / 2 - 0.1 || Math.abs(s.z) > c.bd.d / 2 - 0.1 || s.y < 0.05 || s.y > 4.3 || s.life <= 0;
        if (c.keeper && !this.isKO()) { const kp = this.keeperSpot(); if (Math.hypot(kp.x - s.x, kp.z - s.z) < 0.55 && s.y < 2.1) hit = true; }
        if (c.vault && c.C.includes(c.vaultC) && Math.abs(s.z - VAULT.z) < 0.4 && s.x > VAULT.door0 && s.x < VAULT.door1) wall = true;
      }
      if (hit || wall) {
        this.shots.splice(i, 1); SFX.ricochet();
        for (let j = 0; j < 6; j++) this.bits.push({ x: POCKET.x + s.x, y: s.y, z: POCKET.z + s.z, vx: rnd(-2, 2), vy: rnd(1, 4), vz: rnd(-2, 2), life: 0.35, color: j % 2 ? 0xffd060 : 0x8a8a8a, spin: rnd(4, 9), r: 0, flat: false });
        if (hit) this.splatKeeper();
      }
    }
    // the keeper waking up
    if (c.keeper && c.busy && !this.hold && this.t >= (this.ko[c.bd.id] || 0)) { c.busy = false; c.keeper.root.position.set(POCKET.x + c.keeperAt.x, 0, POCKET.z + c.keeperAt.z); }
    // the hold-up
    const h = this.hold;
    if (h && c.keeper) {
      h.t += dt; this.api.aim();
      const P = c.keeper, kp = P.root.position, r = c.register, home = { x: POCKET.x + r.x, z: POCKET.z + c.keeperAt.z };
      const face = (x, z) => { P.root.rotation.y = Math.atan2(x - kp.x, z - kp.z); };
      if (Math.hypot(me.x - (kp.x - POCKET.x), me.z - (kp.z - POCKET.z)) > 12 && !h.done && h.phase !== "handsup") { this.finish(); this.api.toast("You ran off!", h.paid ? "You got " + money(h.paid) + "." : "No cash for you.", "warn"); }
      if (h.phase === "handsup") { face(w.x, w.z); P.pose("handsup", h.t); if (h.t > 1.0) { h.phase = "walk"; h.t = 0; } }
      else if (h.phase === "walk") {
        const dx = home.x - kp.x, dz = home.z - kp.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { h.phase = "grab"; h.t = 0; SFX.pickup(); }
        else { const s = Math.min(d, 2.4 * dt); kp.x += dx / d * s; kp.z += dz / d * s; face(home.x, home.z); P.pose("walk", h.t * 1.4, 1); }
      } else if (h.phase === "grab") {
        // turn to the register, the drawer pops open, scoop scoop scoop
        P.root.rotation.y = 0; P.pose("stand", h.t);
        const k = clamp(h.t / 0.3, 0, 1); if (c.drawer) c.drawer.position.z = POCKET.z + r.z - 0.4 * k;
        P.arms[0].rotation.x = P.arms[1].rotation.x = -0.75 + Math.sin(h.t * 12) * 0.25; P.body.rotation.x = 0.25; P.head.rotation.x = 0.3;
        if (h.t > 1.5) { h.phase = "throw"; h.t = 0; P.hold(bundle()); }
      } else if (h.phase === "throw") {
        // wind up over the shoulder, then fling the cash at you (3 throws)
        face(w.x, w.z); P.pose("stand", h.t);
        const tt = h.t, wind = tt < 0.3 ? tt / 0.3 : 0, swing = tt >= 0.3 ? clamp((tt - 0.3) / 0.12, 0, 1) : 0;
        P.arms[1].rotation.x = tt < 0.3 ? -0.5 - wind * 2.6 : -3.1 + swing * 2.3; P.body.rotation.y = tt < 0.3 ? 0.4 * wind : 0.4 - swing * 0.6; P.arms[0].rotation.x = -0.4;
        if (tt >= 0.36 && !h.released) {
          h.released = true; P.hold(null);
          const from = new THREE.Vector3(); P.hand.getWorldPosition(from);
          const to = new THREE.Vector3(w.x, 1.2, w.z), T = clamp(from.distanceTo(to) / 9, 0.35, 0.8), g = 9;
          const m = bundle(); m.position.copy(from); this.api.scene.add(m);
          const share = h.throws === 2 ? Math.max(0, h.total - h.paid - this.inAir()) : Math.round(h.total / 3 / 5) * 5; // (the last one is the rest)
          this.flying.push({ m, x: from.x, y: from.y, z: from.z, vx: (to.x - from.x) / T, vy: (to.y - from.y) / T + 0.5 * g * T, vz: (to.z - from.z) / T, g, t: 0, T, cash: share, spin: rnd(8, 14) });
          SFX.jump();
        }
        if (tt > 0.65) { h.throws++; h.t = 0; h.released = false; if (h.throws >= 3) { h.phase = "cower"; } else P.hold(bundle()); }
      } else if (h.phase === "cower") {
        face(w.x, w.z); P.pose("handsup", h.t); P.root.position.y = 0;
        if (c.drawer) c.drawer.position.z = POCKET.z + r.z - 0.4;
        if (!h.said && !this.flying.length) { h.said = true; this.api.toast("“That’s all of it! Please go!”", "", "", 2400); this.finish(); }
      }
    }
    // cash bundles flying at you
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]; f.t += dt; f.vy -= f.g * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.m.position.set(f.x, f.y, f.z); f.m.rotation.set(f.t * f.spin, f.t * f.spin * 0.6, 0); f.m.scale.setScalar(1.7);
      if (Math.random() < 0.45) this.bits.push({ x: f.x, y: f.y, z: f.z, vx: rnd(-0.6, 0.6), vy: rnd(-0.2, 0.6), vz: rnd(-0.6, 0.6), life: rnd(0.9, 1.4), color: 0x5ac85a, spin: rnd(3, 7), r: Math.random() * 6, flat: true }); // (loose bills flutter off it)
      if (f.t >= f.T) {
        this.api.scene.remove(f.m); this.flying.splice(i, 1);
        const got = this.give(f.cash); if (this.hold) this.hold.paid += got;
        SFX.cash(); this.api.bumpMoney && this.api.bumpMoney();
        for (let j = 0; j < 12; j++) this.bits.push({ x: w.x + rnd(-0.3, 0.3), y: 1.4, z: w.z + rnd(-0.3, 0.3), vx: rnd(-1.6, 1.6), vy: rnd(1.5, 3.5), vz: rnd(-1.6, 1.6), life: rnd(1.2, 1.8), color: j % 3 ? 0x5ac85a : 0x9ae89a, spin: rnd(3, 7), r: Math.random() * 6, flat: true });
        this.api.toast("+" + money(got) + " 💵", "Loot: " + money(S.loot) + " / " + money(this.api.crime.lootCap()), "cash", 1600);
      }
    }
    // bills fluttering down, goo drops
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i]; b.life -= dt; if (b.life <= 0) { this.bits.splice(i, 1); continue; }
      if (b.flat) { b.vy = Math.max(b.vy - 9 * dt, -0.9); b.vx *= 1 - dt * 1.5; b.vz *= 1 - dt * 1.5; b.x += (b.vx + Math.sin(b.life * 7 + b.r) * 0.6) * dt; } else { b.vy -= 12 * dt; b.x += b.vx * dt; }
      b.y = Math.max(0.02, b.y + b.vy * dt); b.z += b.vz * dt; b.r += b.spin * dt;
    }
  }
  inAir() { let n = 0; for (const f of this.flying) n += f.cash; return n; }
  draw(time) {
    const c = this.cur;
    const ko = !!(c && c.keeper && c.busy && !this.hold);
    if (ko) { c.keeper.pose("ko", time); c.keeper.root.position.y = 0; const p = c.keeper.root.position; this.stars.position.set(p.x, 1.75 + Math.sin(time * 3) * 0.08, p.z); this.stars.rotation.y = time * 3; } // (knocked out behind the counter)
    this.stars.visible = ko;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    let n = 0;
    for (const b of this.bits) { if (n >= 120) break; q.setFromEuler(e.set(b.r, b.r * 0.7, b.r * 0.3)); M.compose(v.set(b.x, b.y, b.z), q, s.setScalar(b.flat ? 1 : 0.6)); this.bitMesh.setMatrixAt(n, M); this.bitMesh.setColorAt(n, col.set(b.color)); n++; }
    this.bitMesh.count = n; this.bitMesh.instanceMatrix.needsUpdate = true; if (this.bitMesh.instanceColor) this.bitMesh.instanceColor.needsUpdate = true;
    n = 0; q.identity();
    const Z = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3();
    for (const sh of this.shots) { const sp = Math.hypot(sh.vx, sh.vy, sh.vz) || 1; dir.set(sh.vx / sp, sh.vy / sp, sh.vz / sp); q.setFromUnitVectors(Z, dir); M.compose(v.set(POCKET.x + sh.x - dir.x * 0.6, sh.y - dir.y * 0.6, POCKET.z + sh.z - dir.z * 0.6), q, s.set(0.04, 0.04, 1.2)); this.shotMesh.setMatrixAt(n, M); this.shotMesh.setColorAt(n, col.set(sh.color)); n++; }
    this.shotMesh.count = n; this.shotMesh.instanceMatrix.needsUpdate = true; if (this.shotMesh.instanceColor) this.shotMesh.instanceColor.needsUpdate = true;
  }
}
