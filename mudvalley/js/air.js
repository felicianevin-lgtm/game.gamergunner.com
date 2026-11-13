// MUD VALLEY RP: the 5-STAR team. When you're at ★★★★★ the cops bring out the big stuff:
//  - 🛸 Missile drones: little quad drones that follow you and fire SLOW missiles (smoke trail + a blinking red tip).
//    The missile only steers for a moment, then flies straight, so swerve or side-step and it whooshes past!
//  - 🏃 Foot cops: cops that jump out and run after you. If one gets right next to you, they raise their taser
//    (you hear a beep) and zap you = busted. Run, jump in a car, or knock them over with your gun.
//  - 🚁 The police helicopter: a spotlight that follows you (while it's on you, the cops always know where you are)
//    and a gunner that sprays the ground from above. A red ring shows up first: get out of the ring!
// Getting hit by a blast never "kills" you: in a car it slams your ride around, on foot you see stars for a second.
// The drones and the helicopter can be shot down (they come back later). Everything leaves when the stars go below 5.
import * as THREE from "/create/vendor/three.module.js";
import { groundAt, hAt } from "./terrain.js";
import { makeWalker, stepWalker } from "./physics.js";
import { makePerson, LOOKS, makeTaser } from "./character.js";
import { S } from "./save.js";
import { SFX } from "./sfx.js";

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const boxM = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

export const AIR = {
  drones: 2, droneHP: 2, droneFire: [5.5, 8], droneH: 13, droneBack: 14, // (seconds before a shot-down drone comes back)
  missileSpeed: 19, missileSteer: 1.4, missileAim: 1.3, missileLife: 7, blast: 4.2,
  footCops: 3, footSpeed: 0.86, taseRange: 2.3, taseWind: 0.65,
  heliH: 30, heliSpeed: 24, heliHP: 8, heliFire: [5, 7], heliBack: 25, ringWarn: 1.4, ringR: 4.2, spot: 34,
};

// ---------------------------------------------------------------- models
function droneModel() {
  const g = new THREE.Group(), dark = lam(0x23262e), blue = lam(0x2a5ad8), white = lam(0xe8ecf2);
  const body = boxM(1.1, 0.35, 1.1, dark); g.add(body);
  const top = boxM(0.7, 0.18, 0.7, blue); top.position.y = 0.25; g.add(top);
  const stripe = boxM(1.12, 0.08, 0.3, white); stripe.position.y = 0.05; g.add(stripe);
  const props = [];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = boxM(0.12, 0.08, 1.0, dark); arm.position.set(x * 0.55, 0.1, z * 0.55); arm.rotation.y = Math.atan2(x, z); g.add(arm);
    const p = boxM(1.0, 0.03, 0.12, lam(0x9aa0aa)); p.position.set(x * 0.85, 0.22, z * 0.85); g.add(p); props.push(p);
  }
  // the missile pod under it + a blinking light
  const pod = boxM(0.3, 0.25, 0.7, lam(0x555a66)); pod.position.set(0, -0.3, 0.1); g.add(pod);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), basic(0xff2a2a)); red.position.set(0, -0.1, 0.58); g.add(red);
  const blu = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), basic(0x3a8aff)); blu.position.set(0, 0.38, 0); g.add(blu);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root: g, props, red, blu };
}
function missileModel() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 8).rotateX(Math.PI / 2), lam(0xd8dce4)); g.add(tube);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 8).rotateX(Math.PI / 2), basic(0xff3030)); nose.position.z = 0.72; g.add(nose);
  for (let i = 0; i < 4; i++) { const f = boxM(0.02, 0.28, 0.25, lam(0x3a3a44)); f.position.z = -0.45; f.rotation.z = (i * Math.PI) / 2; f.position.x = Math.sin(i * Math.PI / 2) * 0.14; f.position.y = Math.cos(i * Math.PI / 2) * 0.14; g.add(f); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8).rotateX(-Math.PI / 2), basic(0xffb030, { transparent: true, opacity: 0.85 })); flame.position.z = -0.85; g.add(flame);
  return { root: g, nose, flame };
}
function heliModel() {
  const g = new THREE.Group(), navy = lam(0x1a2c66), white = lam(0xf0f2f6), dark = lam(0x22252c), glass = lam(0x9ad0ff, { transparent: true, opacity: 0.7 });
  const cab = boxM(2.4, 2.0, 4.0, navy); cab.position.y = 0; g.add(cab);
  const band = boxM(2.44, 0.5, 4.04, white); band.position.y = -0.2; g.add(band);
  const nose = boxM(2.1, 1.5, 1.2, glass); nose.position.set(0, 0.1, 2.5); g.add(nose);
  const boom = boxM(0.5, 0.5, 5.2, navy); boom.position.set(0, 0.4, -4.4); g.add(boom);
  const fin = boxM(0.15, 1.6, 1.0, white); fin.position.set(0, 1.0, -6.8); g.add(fin);
  const tailR = boxM(0.06, 1.6, 0.18, dark); tailR.position.set(0.3, 0.8, -6.8); g.add(tailR);
  for (const s of [-1, 1]) { const sk = boxM(0.15, 0.15, 4.2, dark); sk.position.set(s * 1.2, -1.5, 0.2); g.add(sk); for (const z of [-1, 1.2]) { const l = boxM(0.1, 0.6, 0.1, dark); l.position.set(s * 1.1, -1.2, z); g.add(l); } }
  const mast = boxM(0.3, 0.5, 0.3, dark); mast.position.y = 1.25; g.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.55;
  for (let i = 0; i < 4; i++) { const b = boxM(7.5, 0.06, 0.32, dark); b.position.x = 3.75; const arm = new THREE.Group(); arm.rotation.y = (i * Math.PI) / 2; arm.add(b); rotor.add(arm); }
  g.add(rotor);
  // the gun under the nose + the searchlight
  const gun = boxM(0.25, 0.25, 1.1, dark); gun.position.set(0.7, -1.1, 1.6); g.add(gun);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 10), basic(0xfff6c0)); lamp.position.set(-0.7, -1.15, 1.6); g.add(lamp);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), basic(0xff2a2a)); red.position.set(-1.3, 0.3, 0); g.add(red);
  const blu = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), basic(0x3a8aff)); blu.position.set(1.3, 0.3, 0); g.add(blu);
  g.traverse((o) => { if (o.isMesh && o !== nose) o.castShadow = true; });
  return { root: g, rotor, tailR, red, blu, gunTip: new THREE.Vector3(0.7, -1.1, 2.2) };
}
// a soft glowing cone (the searchlight beam) and the bright circle where it lands
function beamModel() {
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1, 1, 18, 1, true).translate(0, -0.5, 0), basic(0xfff3b0, { transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), basic(0xfff3b0, { transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  cone.frustumCulled = spot.frustumCulled = false; cone.renderOrder = spot.renderOrder = 5;
  return { cone, spot };
}
// the red warning ring on the ground (where the helicopter is about to shoot)
function ringModel() {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), basic(0xff2a2a, { transparent: true, opacity: 0.85, depthWrite: false }));
  const f = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), basic(0xff2a2a, { transparent: true, opacity: 0.18, depthWrite: false }));
  g.add(r, f); g.userData = { r, f }; g.visible = false; return g;
}
function starsModel() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), basic(i % 2 ? 0xffe14a : 0xffffff)); s.position.set(Math.cos(i * 1.256) * 0.5, 0, Math.sin(i * 1.256) * 0.5); g.add(s); }
  g.visible = false; g.position.y = 2.1; return g;
}

// ---------------------------------------------------------------- the 5-star team
export class SkyForce {
  constructor(crime) {
    this.crime = crime; this.api = crime.api; this.scene = crime.scene;
    this.drones = []; this.missiles = []; this.foot = []; this.heli = null; this.rings = []; this.on = false; this.t = 0;
    this.droneBackT = 0; this.heliBackT = 0; this.footT = 0; this.told = {};
    this.beam = beamModel(); this.scene.add(this.beam.cone, this.beam.spot); this.beam.cone.visible = this.beam.spot.visible = false;
    this.spotOn = false; // (is the helicopter's light on you right now?)
  }
  get active() { return this.on; }
  // ------------------------------------------------ who your gun can hit (crime.targets adds these)
  targets() {
    const out = [];
    for (const d of this.drones) if (!d.dead && !d.leaving) out.push({ kind: "drone", air: true, ref: d, x: d.x, y: d.y - 1.8, z: d.z, vx: d.vx, vz: d.vz, r: 1.2 });
    const h = this.heli; if (h && !h.dead && !h.leaving) out.push({ kind: "heli", air: true, ref: h, x: h.x, y: h.y - 2.5, z: h.z, vx: h.vx, vz: h.vz, r: 3 });
    for (const f of this.foot) if (f.koT <= 0 && !f.leaving) out.push({ kind: "footcop", air: true, ref: f, x: f.w.x, y: f.w.y, z: f.w.z, vx: f.w.vx, vz: f.w.vz, r: 0.9 });
    return out;
  }
  hit(t, s) {
    const fx = this.api.fx;
    if (t.kind === "drone") {
      const d = t.ref; d.hp -= s.splash ? 2 : 1; fx.sparks(d.x, d.y, d.z, 10); SFX.ricochet();
      if (d.hp <= 0) this.downDrone(d);
    } else if (t.kind === "heli") {
      const h = t.ref; h.hp -= s.splash ? 2 : 1; fx.sparks(h.x, h.y - 1, h.z, 12); SFX.ricochet();
      if (h.hp <= 0) { h.leaving = true; h.smoking = true; this.heliBackT = AIR.heliBack; SFX.crash(8); this.api.toast("🚁 You hit the helicopter!", "It’s flying away smoking! (It’ll be back...)", "good", 3200); }
    } else if (t.kind === "footcop") {
      const f = t.ref; this.crime.bleed(f.w.x, f.w.y + 1.2, f.w.z); this.koFoot(f, s.stun + 2);
    }
  }
  koFoot(f, time) { f.koT = Math.max(f.koT, time); f.wind = 0; f.stars.visible = true; SFX.stun(); }
  downDrone(d) {
    d.dead = true; d.fall = true; d.vy = 0; this.droneBackT = AIR.droneBack; SFX.crash(6); this.api.fx.sparks(d.x, d.y, d.z, 20);
    this.api.toast("🛸 Drone down!", "Nice shot! Another one will come later...", "good", 2400);
  }

  // ------------------------------------------------ turning on / off
  start() {
    if (this.on) return; this.on = true; this.droneBackT = 1.5; this.heliBackT = 3.5; this.footT = 2.5;
    this.api.toast("🚨 ★★★★★ MAXIMUM WANTED!", "Drones, a helicopter AND foot cops are coming! No teleporting now.", "warn", 5200);
  }
  stop(now) { // everyone leaves (now = vanish right away, e.g. busted)
    this.on = false; this.spotOn = false;
    for (const d of this.drones) d.leaving = true;
    if (this.heli) this.heli.leaving = true;
    for (const f of this.foot) f.leaving = true;
    for (const r of this.rings) r.done = true;
    if (now) this.clear();
  }
  clear() {
    for (const d of this.drones) this.scene.remove(d.m.root); this.drones = [];
    for (const m of this.missiles) this.scene.remove(m.m.root); this.missiles = [];
    for (const f of this.foot) this.scene.remove(f.p.root); this.foot = [];
    for (const r of this.rings) this.scene.remove(r.g); this.rings = [];
    if (this.heli) { this.scene.remove(this.heli.m.root); this.heli = null; }
    this.beam.cone.visible = this.beam.spot.visible = false; this.spotOn = false; this.on = false;
  }

  // ------------------------------------------------ spawning
  spawnDrone(me) {
    const a = rnd(0, Math.PI * 2), r = rnd(90, 120), x = me.x + Math.sin(a) * r, z = me.z + Math.cos(a) * r;
    const m = droneModel(); this.scene.add(m.root);
    const d = { m, x, z, y: groundAt(x, z) + AIR.droneH + 10, vx: 0, vz: 0, vy: 0, hp: AIR.droneHP, ang: a, fireT: rnd(3, 5), dead: false, leaving: false, life: 0, side: this.drones.length % 2 ? 1 : -1 };
    this.drones.push(d);
    if (!this.told.drone) { this.told.drone = 1; setTimeout(() => this.api.toast("🛸 MISSILE DRONES!", "When you hear the whoosh, SWERVE! The missiles fly slow.", "warn", 4000), 1200); }
  }
  spawnHeli(me) {
    const a = rnd(0, Math.PI * 2), x = me.x + Math.sin(a) * 160, z = me.z + Math.cos(a) * 160;
    const m = heliModel(); this.scene.add(m.root);
    this.heli = { m, x, z, y: Math.max(groundAt(x, z), hAt(x, z)) + AIR.heliH + 15, vx: 0, vz: 0, yaw: a + Math.PI, hp: AIR.heliHP, fireT: rnd(4, 6), lx: me.x, lz: me.z, dead: false, leaving: false, life: 0, bank: 0 };
    if (!this.told.heli) { this.told.heli = 1; setTimeout(() => this.api.toast("🚁 POLICE HELICOPTER!", "Its spotlight follows you. Watch for RED RINGS on the ground: get out of them!", "warn", 4500), 2600); }
  }
  spawnFoot(me) {
    // they hop out near the closest cop car (or come running from around a corner)
    let sx, sz; const cars = this.crime.cops.filter((c) => !c.leaving).sort((a, b) => Math.hypot(a.b.x - me.x, a.b.z - me.z) - Math.hypot(b.b.x - me.x, b.b.z - me.z));
    const c = cars[0];
    if (c && Math.hypot(c.b.x - me.x, c.b.z - me.z) < 70) { sx = c.b.x + Math.cos(c.b.yaw) * 2.4; sz = c.b.z - Math.sin(c.b.yaw) * 2.4; }
    else { const a = rnd(0, Math.PI * 2), r = rnd(38, 55); sx = me.x + Math.sin(a) * r; sz = me.z + Math.cos(a) * r; }
    const p = makePerson(LOOKS.cop); p.hold(makeTaser()); this.scene.add(p.root);
    const stars = starsModel(); p.root.add(stars);
    const w = makeWalker(sx, sz); w.isWalker = true;
    this.foot.push({ p, w, stars, koT: 0, wind: 0, cool: 1, t: 0, leaving: false, life: 0, speed: AIR.footSpeed * rnd(0.92, 1.05) });
    if (!this.told.foot) { this.told.foot = 1; this.api.toast("🏃 FOOT COPS!", "Don’t let them get right next to you, they have tasers!", "warn", 3600); }
  }

  // ------------------------------------------------ every step
  update(dt) {
    this.t += dt;
    const me = this.api.me(), cr = this.crime;
    const busy = cr.jail || me.indoors; // (they wait outside, they don't come in)
    const want = S.wanted >= 5 && !cr.jail;
    if (want && !this.on) this.start(); else if (!want && this.on) this.stop(!!cr.jail);
    if (!this.on && !this.drones.length && !this.heli && !this.foot.length && !this.missiles.length && !this.rings.length) return;
    const hidden = cr.hidden || me.indoors;
    // spawning (only while you're at 5 stars)
    if (this.on && !busy) {
      if (this.drones.filter((d) => !d.dead && !d.leaving).length < AIR.drones && (this.droneBackT -= dt) <= 0) { this.spawnDrone(me); this.droneBackT = 2.5; }
      if (!this.heli && (this.heliBackT -= dt) <= 0) this.spawnHeli(me);
      if (this.foot.filter((f) => !f.leaving).length < AIR.footCops && (this.footT -= dt) <= 0) { this.spawnFoot(me); this.footT = 4; }
    }
    this.updateDrones(dt, me, busy || hidden);
    this.updateMissiles(dt, me);
    this.updateHeli(dt, me, busy, hidden);
    this.updateRings(dt, me);
    this.updateFoot(dt, me, busy);
  }
  // ---- drones: circle around you a little way off, then pop a missile at you
  updateDrones(dt, me, quiet) {
    for (const d of this.drones.slice()) {
      d.life += dt;
      if (d.fall) { // shot down: tumble to the ground, then boom
        d.vy -= 20 * dt; d.y += d.vy * dt; d.m.root.rotation.x += dt * 6; d.m.root.rotation.z += dt * 4;
        if (this.t % 0.05 < dt) this.api.fx.puff(d.x, d.y, d.z, 0, 0.5, 0, 0.6, 0x333333, 1, 1.5);
        if (d.y <= groundAt(d.x, d.z) + 0.3) { this.boom(d.x, groundAt(d.x, d.z) + 0.3, d.z, 0.7, false); this.scene.remove(d.m.root); this.drones.splice(this.drones.indexOf(d), 1); }
        continue;
      }
      let tx, ty, tz;
      if (d.leaving) { tx = d.x + d.vx; tz = d.z + d.vz; ty = d.y + 30; if (d.y > groundAt(d.x, d.z) + 60 || d.life > 60) { this.scene.remove(d.m.root); this.drones.splice(this.drones.indexOf(d), 1); continue; } }
      else {
        d.ang += dt * 0.35 * d.side;
        const R = 22 + Math.sin(this.t * 0.6 + d.side) * 4;
        tx = me.x + (me.vx || 0) * 0.8 + Math.sin(d.ang) * R; tz = me.z + (me.vz || 0) * 0.8 + Math.cos(d.ang) * R;
        ty = Math.max(groundAt(tx, tz), groundAt(d.x, d.z)) + AIR.droneH + Math.sin(this.t * 1.7 + d.side) * 1.2;
      }
      // fly there (smooth, a bit floaty)
      const ax = clamp((tx - d.x) * 1.4 - d.vx * 1.6, -30, 30), az = clamp((tz - d.z) * 1.4 - d.vz * 1.6, -30, 30);
      d.vx += ax * dt; d.vz += az * dt; const sp = Math.hypot(d.vx, d.vz), mx = 34; if (sp > mx) { d.vx *= mx / sp; d.vz *= mx / sp; }
      d.x += d.vx * dt; d.z += d.vz * dt; d.y += (ty - d.y) * Math.min(1, dt * 1.8);
      const floor = Math.max(groundAt(d.x, d.z), hAt(d.x, d.z)) + 4; if (d.y < floor) d.y = floor;
      // shoot
      if (!d.leaving && this.on && !quiet) {
        d.fireT -= dt;
        const dist = Math.hypot(me.x - d.x, me.z - d.z);
        if (d.fireT <= 0 && dist < 70) { d.fireT = rnd(AIR.droneFire[0], AIR.droneFire[1]); this.fireMissile(d, me); }
      }
    }
  }
  fireMissile(d, me) {
    // don't fire if another missile is already almost on you (keep it fair)
    if (this.missiles.length >= 2) { d.fireT = 1.5; return; }
    const m = missileModel(); this.scene.add(m.root);
    const ty = me.y + 1, dx = me.x - d.x, dy = ty - (d.y - 0.4), dz = me.z - d.z, l = Math.hypot(dx, dy, dz) || 1, sp = AIR.missileSpeed;
    this.missiles.push({ m, x: d.x, y: d.y - 0.4, z: d.z, vx: dx / l * sp * 0.6, vy: dy / l * sp * 0.6, vz: dz / l * sp * 0.6, life: AIR.missileLife, aim: AIR.missileAim, smokeT: 0 });
    SFX.air(); SFX.pop();
  }
  updateMissiles(dt, me) {
    for (const m of this.missiles.slice()) {
      m.life -= dt; m.aim -= dt;
      const sp0 = Math.hypot(m.vx, m.vy, m.vz) || 1, sp = Math.min(AIR.missileSpeed, sp0 + 12 * dt);
      let dx = m.vx / sp0, dy = m.vy / sp0, dz = m.vz / sp0;
      // it only steers at the start, then it goes straight (that's how you dodge it!)
      if (m.aim > 0) {
        const tx = me.x - m.x, ty = me.y + 0.9 - m.y, tz = me.z - m.z, tl = Math.hypot(tx, ty, tz) || 1;
        const k = Math.min(1, AIR.missileSteer * dt);
        dx += (tx / tl - dx) * k; dy += (ty / tl - dy) * k; dz += (tz / tl - dz) * k; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      }
      m.vx = dx * sp; m.vy = dy * sp; m.vz = dz * sp;
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      // smoke trail
      m.smokeT -= dt; if (m.smokeT <= 0) { m.smokeT = 0.035; this.api.fx.puff(m.x - dx * 0.9, m.y - dy * 0.9, m.z - dz * 0.9, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.32, Math.random() < 0.3 ? 0xd0d0d0 : 0x9a9a9a, 1.1, 2.4); }
      const gy = groundAt(m.x, m.z), near = Math.hypot(me.x - m.x, me.z - m.z) < (me.inCar ? 2.3 : 1.3) && m.y > me.y - 0.5 && m.y < me.y + (me.inCar ? 2.6 : 2.2);
      if (near || m.y < gy + 0.2 || m.y < hAt(m.x, m.z) || m.life <= 0) {
        this.boom(m.x, Math.max(m.y, gy + 0.3), m.z, 1, true);
        this.scene.remove(m.m.root); this.missiles.splice(this.missiles.indexOf(m), 1);
      }
    }
  }
  // ---- the helicopter: hovers above you, the light follows you, every few seconds it sprays a red-ring spot
  updateHeli(dt, me, busy, hidden) {
    const h = this.heli; this.spotOn = false;
    if (!h) { this.beam.cone.visible = this.beam.spot.visible = false; return; }
    h.life += dt;
    if (h.leaving) {
      const a = h.yaw; h.vx += (Math.sin(a) * 30 - h.vx) * dt; h.vz += (Math.cos(a) * 30 - h.vz) * dt; h.x += h.vx * dt; h.z += h.vz * dt; h.y += dt * 4;
      if (h.smoking && this.t % 0.06 < dt) this.api.fx.puff(h.x, h.y, h.z, 0, 1, 0, 1, 0x2a2a2a, 2, 2);
      this.beam.cone.visible = this.beam.spot.visible = false;
      if (Math.hypot(h.x - me.x, h.z - me.z) > 260 || h.life > 90) { this.scene.remove(h.m.root); this.heli = null; }
      return;
    }
    // aim the light at you (it drifts a bit behind, so fast driving can shake it off)
    const k = Math.min(1, dt * (hidden ? 0.3 : 1.6));
    if (!hidden) { h.lx += (me.x - h.lx) * k; h.lz += (me.z - h.lz) * k; }
    // fly to a spot a little behind + above the light
    const tx = h.lx - (me.vx || 0) * 0.4 + Math.sin(this.t * 0.25) * 12, tz = h.lz - (me.vz || 0) * 0.4 + Math.cos(this.t * 0.25) * 12;
    const ax = clamp((tx - h.x) * 0.6 - h.vx * 0.9, -14, 14), az = clamp((tz - h.z) * 0.6 - h.vz * 0.9, -14, 14);
    h.vx += ax * dt; h.vz += az * dt; const sp = Math.hypot(h.vx, h.vz); if (sp > AIR.heliSpeed) { h.vx *= AIR.heliSpeed / sp; h.vz *= AIR.heliSpeed / sp; }
    h.x += h.vx * dt; h.z += h.vz * dt;
    const ty = Math.max(groundAt(h.x, h.z), hAt(h.x, h.z), groundAt(h.lx, h.lz)) + AIR.heliH; h.y += (ty - h.y) * Math.min(1, dt * 0.8);
    const want = Math.atan2(h.lx - h.x, h.lz - h.z); h.yaw += wrap(want - h.yaw) * Math.min(1, dt * 1.2);
    h.bank += ((-(ax * Math.cos(h.yaw) - az * Math.sin(h.yaw)) * 0.03) - h.bank) * Math.min(1, dt * 3);
    // the spotlight: is it on you?
    const gx = h.lx, gz = h.lz, gy = groundAt(gx, gz);
    const onYou = !hidden && !busy && Math.hypot(me.x - gx, me.z - gz) < 7 && Math.hypot(me.x - h.x, me.z - h.z) < AIR.spot + 20;
    this.spotOn = onYou;
    h.beam = { gx, gy, gz };
    // shooting from above
    if (this.on && !busy && !hidden) {
      h.fireT -= dt;
      if (h.fireT <= 0 && Math.hypot(me.x - h.x, me.z - h.z) < 70 && !this.rings.some((r) => !r.done)) {
        h.fireT = rnd(AIR.heliFire[0], AIR.heliFire[1]);
        // aim where you're GOING to be (a little), so you have to change direction
        const lead = me.inCar ? 0.9 : 0.5;
        this.addRing(me.x + (me.vx || 0) * lead, me.z + (me.vz || 0) * lead);
      }
    }
  }
  addRing(x, z) {
    const g = ringModel(); this.scene.add(g); g.position.set(x, groundAt(x, z) + 0.15, z); g.scale.setScalar(AIR.ringR); g.visible = true;
    this.rings.push({ g, x, z, t: 0, shots: 0, done: false });
    SFX.beep();
  }
  updateRings(dt, me) {
    const h = this.heli;
    for (const r of this.rings.slice()) {
      r.t += dt;
      const blink = r.t < AIR.ringWarn ? 0.5 + 0.5 * Math.sin(r.t * (8 + r.t * 10)) : 1;
      r.g.userData.r.material.opacity = 0.5 + 0.45 * blink; r.g.userData.f.material.opacity = 0.12 + 0.18 * blink;
      // after the warning: a burst of 8 rounds rains down inside the ring
      if (!r.done && r.t > AIR.ringWarn && h && !h.leaving) {
        const want = Math.floor((r.t - AIR.ringWarn) / 0.07);
        while (r.shots < Math.min(8, want)) {
          r.shots++;
          const a = Math.random() * 6.28, q = Math.sqrt(Math.random()) * AIR.ringR * 0.9, ix = r.x + Math.cos(a) * q, iz = r.z + Math.sin(a) * q, iy = groundAt(ix, iz);
          const gun = h.m.gunTip.clone().applyMatrix4(h.m.root.matrixWorld);
          const l = Math.hypot(ix - gun.x, iy - gun.y, iz - gun.z) || 1, sp = 160;
          this.crime.shots.push({ x: gun.x, y: gun.y, z: gun.z, vx: (ix - gun.x) / l * sp, vy: (iy - gun.y) / l * sp, vz: (iz - gun.z) / l * sp, life: l / sp + 0.05, mine: false, vis: true, stun: 0, splash: 0, color: 0xffb060 });
          this.crime.muzzle(gun.x, gun.y, gun.z, 1); SFX.bang(1);
          setTimeout(() => { this.api.fx.dust(ix, iy, iz, 2, 0xb0a080, 0.6); this.api.fx.sparks(ix, iy + 0.1, iz, 4); }, l / sp * 1000);
        }
        if (r.shots >= 8 && !r.hitDone) {
          r.hitDone = true;
          // did it get you? (only if you're still inside the ring)
          if (Math.hypot(me.x - r.x, me.z - r.z) < AIR.ringR && !me.indoors) this.hurt(r.x, r.z, 0.8, "🚁 The helicopter got you!");
          r.done = true;
        }
      } else if (!r.done && r.t > AIR.ringWarn && (!h || h.leaving)) r.done = true;
      if (r.done) { r.g.scale.setScalar(AIR.ringR * (1 + (r.fade = (r.fade || 0) + dt) * 0.8)); r.g.userData.r.material.opacity *= Math.max(0, 1 - r.fade * 3); if (r.fade > 0.35) { this.scene.remove(r.g); this.rings.splice(this.rings.indexOf(r), 1); } }
    }
  }
  // ---- cops on foot: run at you, raise the taser when close (beep!), then ZAP
  updateFoot(dt, me, busy) {
    const cr = this.crime;
    for (const f of this.foot.slice()) {
      f.t += dt; f.life += dt; f.cool -= dt;
      const w = f.w, dx = me.x - w.x, dz = me.z - w.z, d = Math.hypot(dx, dz) || 1;
      if (f.leaving || d > 160) {
        if (d > 160 || f.life > 50 || (f.leaving && d > 70)) { this.scene.remove(f.p.root); this.foot.splice(this.foot.indexOf(f), 1); continue; }
        stepWalker(w, -dx / d, -dz / d, false, false, dt); f.p.pose("walk", f.t, 1);
      } else if (f.koT > 0) {
        f.koT -= dt; stepWalker(w, 0, 0, false, false, dt); f.p.pose("ko", f.t); f.stars.rotation.y += dt * 4; if (f.koT <= 0) f.stars.visible = false;
      } else if (busy) {
        stepWalker(w, d > 9 ? dx / d : 0, d > 9 ? dz / d : 0, false, false, dt); f.p.pose(w.moving > 0.5 ? "walk" : "stand", f.t, 1);
      } else {
        // run right at you (a tiny bit slower than you, so you can get away)
        const run = d > 2;
        stepWalker(w, run ? dx / d * f.speed : 0, run ? dz / d * f.speed : 0, true, false, dt); // (a bit slower than a running kid)
        // your car runs them over? they get bonked
        if (me.inCar && d < 2.6 && Math.hypot(me.vx || 0, me.vz || 0) > 6) { this.koFoot(f, 5); SFX.bonk(); this.api.fx.dust(w.x, w.y, w.z, 3); w.vx += (me.vx || 0) * 0.5; w.vz += (me.vz || 0) * 0.5; continue; }
        // taser: wind up first (you get a moment to run!)
        if (!me.inCar && !cr.ko && d < AIR.taseRange + 0.4 && f.cool <= 0) {
          if (f.wind === 0) { f.wind = 0.0001; SFX.beep(); }
          f.wind += dt;
          if (f.wind > AIR.taseWind) {
            f.wind = 0; f.cool = 2;
            if (d < AIR.taseRange + 0.6) { cr.zapBolt({ x: w.x, y: w.y + 1.3, z: w.z }, { x: me.x, y: me.y + 1, z: me.z }); SFX.zap(3); cr.knockOut("cop", false); }
            else { SFX.zap(1); }
          }
        } else if (f.wind > 0 && d > AIR.taseRange + 1.5) f.wind = 0; // (you got away)
        // stopped in a car with a cop right at your door: they help the cop cars catch you
        if (me.inCar && d < 4 && me.speed < 3) cr.bustT += dt * 0.6;
        f.p.pose(f.wind > 0 ? "aim" : w.moving > 0.5 ? "run" : "stand", f.t, 1);
      }
      f.p.root.position.set(w.x, w.y, w.z);
      if (f.koT <= 0) f.p.root.rotation.y = f.wind > 0 || d < 4 ? Math.atan2(dx, dz) : Math.atan2(w.vx, w.vz) || f.p.root.rotation.y;
    }
  }
  // ---- an explosion. hurts = it can get you
  boom(x, y, z, size, hurts) {
    const fx = this.api.fx;
    fx.sparks(x, y, z, Math.round(16 * size));
    for (let i = 0; i < 7 * size; i++) fx.puff(x + rnd(-1, 1), y + rnd(0, 1), z + rnd(-1, 1), rnd(-2, 2), rnd(1, 3.5), rnd(-2, 2), rnd(0.8, 1.4) * size, [0xff8a20, 0xffc040, 0x555555, 0x333333][i % 4], rnd(0.6, 1.2), 2.2);
    fx.dust(x, groundAt(x, z), z, 3, 0x7a6a50, 1.2 * size);
    const cr = this.crime, gy = groundAt(x, z); if (cr.splats.length >= 60) cr.splats.shift(); cr.splats.push({ x, z, y: gy + 0.05, r: 1.4 * size, life: 12, color: 0x1a1a1a });
    SFX.bang(3); SFX.crash(7 * size);
    const me = this.api.me(), d = Math.hypot(me.x - x, me.z - z);
    if (d < 40) this.api.shake(Math.max(0.1, 0.6 * size * (1 - d / 40)));
    if (hurts && !me.indoors && d < AIR.blast && Math.abs(me.y - y) < 4) this.hurt(x, z, 1, "🚀 BOOM! A missile got you!");
    // it can knock the foot cops over too
    for (const f of this.foot) if (Math.hypot(f.w.x - x, f.w.z - z) < AIR.blast) this.koFoot(f, 4);
  }
  // you got hit by a blast: in a car it slams your ride around, on foot you see stars for a moment
  hurt(x, z, k, msg) {
    const cr = this.crime; if (cr.jail || cr.ko) return;
    const me = this.api.me(), dx = me.x - x, dz = me.z - z, l = Math.hypot(dx, dz) || 1, nx = dx / l, nz = dz / l;
    if (me.inCar && me.body) {
      const b = me.body; b.vx = b.vx * 0.35 + nx * 7 * k; b.vz = b.vz * 0.35 + nz * 7 * k; b.vy = Math.max(b.vy || 0, 5.5 * k); b.air = true; b.yawRate = (b.yawRate || 0) + rnd(-2.5, 2.5) * k;
      this.api.shake(0.7); this.api.fx.sparks(b.x, b.y + 1, b.z, 16);
      if ((this.toastT || 0) < this.t) { this.toastT = this.t + 3; this.api.toast(msg, "Your ride got knocked around! Keep moving!", "warn", 2000); }
    } else {
      const w = me.walker; if (w && w.vx !== undefined) { w.vx = nx * 8 * k; w.vz = nz * 8 * k; w.vy = 6 * k; w.air = true; }
      cr.knockOut("cop", true);
    }
  }

  // ------------------------------------------------ models (every frame)
  draw(dt, time) {
    for (const d of this.drones) {
      const r = d.m.root; r.position.set(d.x, d.y, d.z);
      if (!d.fall) { r.rotation.y = Math.atan2(d.vx, d.vz); r.rotation.x = clamp(Math.hypot(d.vx, d.vz) * 0.012, 0, 0.35); }
      for (const p of d.m.props) p.rotation.y += dt * 40;
      const blink = Math.sin(time * 9) > 0; d.m.red.visible = blink || d.fireT < 0.8; d.m.blu.visible = !blink;
    }
    for (const m of this.missiles) {
      const r = m.m.root; r.position.set(m.x, m.y, m.z); r.lookAt(m.x + m.vx, m.y + m.vy, m.z + m.vz);
      m.m.nose.visible = Math.sin(time * 22) > -0.3; m.m.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6);
    }
    const h = this.heli;
    if (h) {
      const r = h.m.root; r.position.set(h.x, h.y, h.z); r.rotation.set(0, h.yaw, 0); r.rotateZ(h.bank); r.rotateX(clamp(Math.hypot(h.vx, h.vz) * 0.006, 0, 0.18));
      h.m.rotor.rotation.y += dt * 28; h.m.tailR.rotation.x += dt * 40;
      const blink = Math.sin(time * 6) > 0; h.m.red.visible = blink; h.m.blu.visible = !blink;
      r.updateMatrixWorld();
      if (h.beam && !h.leaving) {
        const { cone, spot } = this.beam, lamp = new THREE.Vector3(-0.7, -1.15, 1.6).applyMatrix4(r.matrixWorld);
        const ex = h.beam.gx, ey = h.beam.gy + 0.2, ez = h.beam.gz, len = Math.hypot(ex - lamp.x, ey - lamp.y, ez - lamp.z) || 1, rad = 6;
        cone.visible = spot.visible = true;
        cone.position.copy(lamp); cone.scale.set(rad, len, rad);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3((ex - lamp.x) / len, (ey - lamp.y) / len, (ez - lamp.z) / len));
        spot.position.set(ex, ey, ez); spot.scale.setScalar(rad); spot.material.opacity = this.spotOn ? 0.42 : 0.26;
      }
    }
    for (const f of this.foot) if (f.wind > 0) { const it = f.p.item; if (it) it.scale.setScalar(1 + Math.sin(time * 40) * 0.12); } else if (f.p.item) f.p.item.scale.setScalar(1);
  }
  // for the HUD / tests
  info() { return { on: this.on, drones: this.drones.filter((d) => !d.dead).length, missiles: this.missiles.length, foot: this.foot.length, heli: !!this.heli, rings: this.rings.length, spotOn: this.spotOn }; }
}
