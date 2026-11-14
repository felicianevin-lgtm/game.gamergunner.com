// MUD VALLEY RP: everyday traffic. Regular folks driving around on the paved roads near you (never on dirt trails).
// They keep to the right-hand lane, take turns at crossings (crime.js patrolDrive does the road-following), slow down
// for corners, brake for you, your friends and each other, and honk if you sit in their way. Cars far away vanish
// and new ones show up out of sight, so there are always a few around without slowing the game down.
import { roadNet } from "./terrain.js";
import { buildCar, animateCar, tune, PAINTS } from "./vehicles.js";
import { makeBody, stepCar, placeModel, speedOf } from "./physics.js";
import { LOOKS } from "./character.js";
import { SFX } from "./sfx.js";

const KINDS = ["pickup", "minitruck", "jeep", "sports", "ranch", "crew", "foxhatch", "trailboss", "crew", "pickup", "minitruck"];
const rnd = (a, b) => a + Math.random() * (b - a);

export class Traffic {
  // api: { scene, crime (for patrolDrive + bump), me() (crime's "me"), friends() ([{x, z, car}]), many() (how many cars) }
  constructor(api) { this.api = api; this.scene = api.scene; this.cars = []; this.spawnT = 1; }
  spawn(me) {
    const { roads } = roadNet(), cand = [];
    roads.forEach((R, r) => { for (let i = 2; i < R.n - 2; i += 3) { const d = Math.hypot(R.x[i] - me.x, R.z[i] - me.z); if (d > 120 && d < 240 && !R.bridge[i]) cand.push([r, i]); } });
    if (!cand.length) return;
    const [r, i] = cand[Math.floor(Math.random() * cand.length)], R = roads[r], dir = Math.random() < 0.5 ? 1 : -1;
    if (this.cars.some((c) => Math.hypot(c.b.x - R.x[i], c.b.z - R.z[i]) < 25)) return; // (not on top of another car)
    const id = KINDS[Math.floor(Math.random() * KINDS.length)];
    const car = { id, paint: PAINTS[Math.floor(Math.random() * PAINTS.length)], rims: "chrome", tires: "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: Math.random() * 0.25, x: R.x[i], z: R.z[i],
      yaw: Math.atan2(R.x[i + dir] - R.x[i], R.z[i + dir] - R.z[i]) };
    const m = buildCar(car, { driver: LOOKS.npc[Math.floor(Math.random() * LOOKS.npc.length)] }); this.scene.add(m.root);
    const b = makeBody(car, m), t = tune(car); b.t = { ...t, acc: t.acc * 0.8, off: { dirt: 0.8, grass: 0.7, mud: 0.5 }, crawl: 0.5 };
    this.cars.push({ m, b, r, i, dir, inJ: true, stunT: 0, stuckT: 0, backT: 0, waitT: 0, goT: 0, hornT: rnd(2, 5), life: 0, cruise: rnd(15, 20), chkT: rnd(0, 0.5) });
  }
  remove(c) { this.scene.remove(c.m.root); this.cars.splice(this.cars.indexOf(c), 1); }
  clear() { for (const c of this.cars.slice()) this.remove(c); }
  // how far the car is from the road it's following (the closest of the next few road points)
  offRoad(c) {
    const R = roadNet().roads[c.r]; let best = 1e9;
    for (let k = -6; k <= 6; k++) { const i = c.i + k; if (i < 0 || i >= R.n) continue; best = Math.min(best, Math.hypot(R.x[i] - c.b.x, R.z[i] - c.b.z)); }
    return best;
  }
  // something in the lane right ahead? (you, a friend, another car)
  blocked(c, me) {
    const b = c.b, hx = Math.sin(b.yaw), hz = Math.cos(b.yaw), look = 7 + speedOf(b) * 0.9;
    const ahead = (x, z, w) => { const dx = x - b.x, dz = z - b.z, f = dx * hx + dz * hz, s = Math.abs(dx * hz - dz * hx); return f > 0 && f < look && s < w; };
    if (!me.indoors && ahead(me.x, me.z, me.inCar ? 2.6 : 1.8)) return "you";
    for (const o of this.cars) if (o !== c && ahead(o.b.x, o.b.z, 2.2)) return "car";
    for (const f of this.api.friends()) if (f.x !== undefined && !f.room && ahead(f.x, f.z, f.car ? 2.6 : 1.8)) return "friend";
    return null;
  }
  update(dt, off) {
    const me = this.api.me(), crime = this.api.crime, want = off ? 0 : this.api.many();
    if (off) { if (this.cars.length) this.clear(); return; }
    this.spawnT -= dt;
    if (this.cars.length < want && this.spawnT <= 0) { this.spawnT = 1.2; this.spawn(me); }
    for (const c of this.cars.slice()) {
      const b = c.b; c.life += dt;
      const d = Math.hypot(b.x - me.x, b.z - me.z);
      if (d > 300 || (c.stuckCount || 0) > 4 || this.cars.length > want + 2) { this.remove(c); continue; }
      // stay on the road: drifted off (a corner, a bump)? aim for the closest road again. Way off and out of sight? swap it out.
      if ((c.chkT -= dt) <= 0) {
        c.chkT = 0.5; const off = this.offRoad(c);
        if (off > 20 && d > 60) { this.remove(c); continue; }
        if (off > 6) crime.attachRoad(c);
      }
      const why = c.goT > 0 ? null : this.blocked(c, me);
      if (c.goT > 0) c.goT -= dt;
      if (why) { // brake and wait (they wait for people; for another stuck car they squeeze past after a bit)
        const sp = speedOf(b); stepCar(b, { thr: sp > 0.6 ? -1 : 0, steer: 0, hand: sp < 0.6 }, dt);
        c.waitT += dt; c.hornT -= dt;
        if (why === "you" && c.hornT <= 0 && d < 45) { c.hornT = rnd(3, 6); SFX.horn(); }
        if (why === "car" && c.waitT > 2.5) { c.waitT = 0; c.goT = 1.5; } // (two cars stuck nose to nose: one squeezes by. People always get waited for.)
      } else { c.waitT = 0; crime.patrolDrive(c, dt, c.cruise); }
      // (bumping into you or your ride)
      if (!me.indoors) {
        if (me.inCar) { const hit = crime.bump(b, me.body, 1.6); if (hit > 9) { SFX.crash(hit / 4); this.api.shake && this.api.shake(0.3); } }
        else crime.bump(b, me.walker, 0.5);
      }
    }
  }
  draw(dt, time) { for (const c of this.cars) { placeModel(c.b); animateCar(c.m, { speed: speedOf(c.b), steer: c.b.steer, t: time, wheelDrop: c.b.wheelDrop }, dt); } }
  // their positions (so your ride bumps into them too)
  circles() { return this.cars.map((c) => ({ x: c.b.x, z: c.b.z, r: 1.6 })); }
}
