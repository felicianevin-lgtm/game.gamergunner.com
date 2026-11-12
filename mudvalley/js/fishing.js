// MUD VALLEY RP: fishing! Buy a rod at the Bait & Tackle by Lily Pond, hold it (X), walk up to the water and press Q.
// Cast (arm swing, the line flies out, the bobber plops in with a splash ring) -> wait (the bobber bobs) ->
// BITE! (the bobber dips and a "!" pops up: press Q fast) -> reel (hold Q to pull, let go to ease off: keep the
// marker in the green zone and don't snap the line) -> show off your catch! Sell fish at the Bait & Tackle.
import * as THREE from "/create/vendor/three.module.js";
import { WATER_Y, POND } from "./layout.js";
import { hAt, onPlatform } from "./terrain.js";
import { makeFish } from "./character.js";
import { S, save, money } from "./save.js";
import { SFX } from "./sfx.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);

export const RODS = [
  { id: "basic", name: "Basic Rod", price: 150, color: 0x3a7ad0, bite: [6, 13], window: 0.9, power: 1, rare: 0, desc: "A simple rod. Good for minnows and perch." },
  { id: "good", name: "Good Rod", price: 600, color: 0x2aa04a, bite: [4, 9], window: 1.1, power: 1.3, rare: 0.6, desc: "Bites come faster, reeling is easier, and you can hook Golden Carp." },
  { id: "pro", name: "Pro Rod", price: 2000, color: 0xd4af37, bite: [2.5, 6], window: 1.35, power: 1.7, rare: 1.3, desc: "The best! Super easy reeling, and the only rod strong enough for legendary fish." },
];
export const rodById = (id) => RODS.find((r) => r.id === id) || null;
// where: "pond", "river" or "both". minRod: 0 basic, 1 good, 2 pro. w = weight range in pounds
export const FISH = [
  { id: "minnow", name: "Mud Minnow", rarity: "Common", w: [0.1, 0.4], price: 12, color: 0x9a8a6a, where: "both", weight: 30 },
  { id: "perch", name: "Sunny Perch", rarity: "Common", w: [0.3, 1.2], price: 28, color: 0xf0c040, where: "pond", weight: 26 },
  { id: "bass", name: "Valley Bass", rarity: "Uncommon", w: [1, 4], price: 55, color: 0x5a9a3a, where: "both", weight: 16 },
  { id: "trout", name: "Rainbow Trout", rarity: "Uncommon", w: [0.8, 3.5], price: 70, color: 0xff8aa8, where: "river", weight: 18 },
  { id: "catfish", name: "Whisker Catfish", rarity: "Rare", w: [3, 12], price: 110, color: 0x6a6a7a, where: "both", weight: 8 },
  { id: "pike", name: "Silver Pike", rarity: "Rare", w: [2, 9], price: 150, color: 0xc8d8e0, where: "river", weight: 7 },
  { id: "carp", name: "Golden Carp", rarity: "Epic", w: [2, 8], price: 320, color: 0xffc42a, where: "pond", weight: 3, minRod: 1 },
  { id: "koi", name: "Crystal Koi", rarity: "Epic", w: [1, 5], price: 600, color: 0x9af0ff, where: "pond", weight: 1.6, minRod: 2 },
  { id: "monster", name: "Mud Monster Catfish", rarity: "Legendary", w: [15, 40], price: 1500, color: 0x4a3a2a, where: "both", weight: 0.7, minRod: 2 },
  { id: "boot", name: "Rusty Old Boot", rarity: "Junk", w: [1, 1], price: 1, color: 0x6a4a2a, where: "both", weight: 5 },
];
export const fishById = (id) => FISH.find((f) => f.id === id);
export const RARITY_COLOR = { Junk: "#a08a6a", Common: "#e8e8e8", Uncommon: "#7aff5a", Rare: "#6ad0ff", Epic: "#d08aff", Legendary: "#ffd23a" };
const DIFF = { Junk: 0.15, Common: 0.3, Uncommon: 0.5, Rare: 0.7, Epic: 0.85, Legendary: 1 };
export const COOLER = 30; // how many fish you can carry before you have to sell
export function fishValue(f) { const F = fishById(f.id); if (!F) return 0; const k = F.w[1] > F.w[0] ? (f.w - F.w[0]) / (F.w[1] - F.w[0]) : 1; return Math.max(1, Math.round(F.price * (0.6 + 0.8 * k))); }
export const coolerValue = () => S.fish.reduce((s, f) => s + fishValue(f), 0);
const isWater = (x, z) => hAt(x, z) < WATER_Y - 0.25 && !onPlatform(x, z);

export class Fishing {
  constructor(api) {
    this.api = api; const scene = api.scene;
    this.state = "idle"; this.t = 0;
    // the bobber (red + white)
    const bob = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xff3a2a }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 5), new THREE.MeshLambertMaterial({ color: 0xff3a2a })); stick.position.y = 0.2;
    bob.add(top, bot, stick); bob.visible = false; scene.add(bob); this.bob = bob;
    // the fishing line
    this.N = 24;
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf8f8f8 })); this.line.frustumCulled = false; this.line.visible = false; scene.add(this.line);
    // splash rings on the water
    this.rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); r.userData.t = 9; scene.add(r); return r; });
    // the "!" when a fish bites
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#ffd23a"; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = "#3a2a00"; g.stroke();
    g.fillStyle = "#3a2a00"; g.font = "bold 90px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", 64, 70);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    this.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, fog: false })); this.bang.scale.set(1.1, 1.1, 1); this.bang.visible = false; this.bang.renderOrder = 5; scene.add(this.bang);
    this.held = null; // the fish you're holding up
    this.tmp = new THREE.Vector3();
  }
  get busy() { return this.state !== "idle"; }
  get rod() { return rodById(S.rod); }
  // the water spot in front of you (null = no water there)
  waterAhead() {
    const me = this.api.me(), fx = Math.sin(me.yaw), fz = Math.cos(me.yaw);
    for (const d of [11, 9, 13, 7, 15, 5]) { const x = me.x + fx * d, z = me.z + fz * d; if (isWater(x, z) && isWater(x - fx * 1.5, z - fz * 1.5)) return { x, z, d }; }
    return null;
  }
  // Q
  press() {
    if (!this.rod) { this.api.toast("No fishing rod", "Buy one at the Bait & Tackle by Lily Pond.", "warn"); return; }
    if (this.state === "idle") {
      const w = this.waterAhead();
      if (!w) { SFX.nope(); this.api.toast("Face the water!", "Walk up to the edge of the pond or the river (or out on a dock) and look at the water.", "warn"); return; }
      if (S.fish.length >= COOLER) { SFX.nope(); this.api.toast("Your cooler is full!", "Sell your fish at the Bait & Tackle first.", "warn"); return; }
      this.target = w; this.pond = Math.hypot(w.x - POND.x, w.z - POND.z) < POND.r + 3; this.state = "cast"; this.t = 0; return;
    }
    if (this.state === "bite") { this.startReel(); return; }
    if (this.state === "wait") { this.api.toast("Reeled in", "Nothing yet. Cast again!", ""); this.cancel(); }
  }
  cancel() {
    this.state = "idle"; this.bob.visible = false; this.line.visible = false; this.bang.visible = false; this.reel = null;
    if (this.held) { this.api.person().hold(this.api.rodModel()); this.held = null; }
    const r = this.api.rodModel(); if (r) r.userData.bend(0);
  }
  pickFish() {
    const rodI = RODS.indexOf(this.rod), rare = this.rod.rare;
    const pool = FISH.filter((f) => (f.where === "both" || f.where === (this.pond ? "pond" : "river")) && (f.minRod || 0) <= rodI);
    const wt = (f) => f.weight * (["Rare", "Epic", "Legendary"].includes(f.rarity) ? 1 + rare : 1);
    let r = Math.random() * pool.reduce((s, f) => s + wt(f), 0);
    for (const f of pool) { r -= wt(f); if (r <= 0) return f; }
    return pool[0];
  }
  startReel() {
    const F = this.pickFish(), d = DIFF[F.rarity], pw = this.rod.power;
    this.reel = { F, w: Math.round(rnd(F.w[0], F.w[1]) * 10) / 10, d, m: 0.3, v: 0, zone: 0.5, zv: 0, width: clamp(0.36 - d * 0.16 + (pw - 1) * 0.14, 0.14, 0.5), speed: 0.22 + d * 0.55, p: 0.3, rate: 0.24 * pw * (1.15 - d * 0.45), snapT: 0, t: 0 };
    this.state = "reel"; this.bang.visible = false; SFX.pickup();
  }
  update(dt, qHeld) {
    this.t += dt;
    const R = this.reel;
    if (this.state === "cast" && this.t > 0.42) { this.state = "fly"; this.t = 0; SFX.cast(); }
    else if (this.state === "fly" && this.t > 0.55) { this.state = "wait"; this.t = 0; this.biteT = rnd(this.rod.bite[0], this.rod.bite[1]); this.nibT = rnd(1, 3); SFX.plop(); this.ring(); this.api.fx.splash(this.target.x, WATER_Y + 0.1, this.target.z, 6, 0.4); }
    else if (this.state === "wait") {
      this.biteT -= dt; this.nibT -= dt;
      if (this.nibT <= 0) { this.nibT = rnd(1.2, 3); this.dip = 0.35; } // a little nibble...
      if (this.biteT <= 0) { this.state = "bite"; this.t = 0; this.dip = 1; SFX.bite(); this.ring(); }
    } else if (this.state === "bite") {
      if (this.t > this.rod.window) { this.state = "wait"; this.t = 0; this.biteT = rnd(this.rod.bite[0], this.rod.bite[1]); this.nibT = 2; this.bang.visible = false; SFX.nope(); this.api.toast("Too slow!", "The fish stole the bait. Wait for the next bite...", "warn", 2400); }
    } else if (this.state === "reel") {
      R.t += dt;
      // hold Q to pull the marker up, let go and it slides back down
      R.v += (qHeld ? 2.6 : -2.2) * dt; R.v *= 1 - dt * 2.2; R.m = clamp(R.m + R.v * dt, 0, 1); if (R.m === 0 || R.m === 1) R.v *= -0.2;
      // the fish swims around (the green zone moves)
      R.zv += (Math.random() - 0.5) * R.speed * 6 * dt; R.zv = clamp(R.zv, -R.speed, R.speed); R.zone += R.zv * dt;
      if (R.zone < R.width / 2 || R.zone > 1 - R.width / 2) { R.zv *= -1; R.zone = clamp(R.zone, R.width / 2, 1 - R.width / 2); }
      const inZone = Math.abs(R.m - R.zone) < R.width / 2;
      R.p = clamp(R.p + (inZone ? R.rate : -0.1) * dt, 0, 1);
      if (qHeld && Math.random() < 0.3) SFX.reel();
      if (R.m > 0.97) { R.snapT += dt; if (R.snapT > 0.8) { SFX.snap(); this.api.toast("SNAP! The line broke", "Don’t pull so hard! Let go of Q when the marker gets to the red end.", "warn", 3600); this.cancel(); return; } } else R.snapT = Math.max(0, R.snapT - dt);
      if (R.p >= 1) this.caught();
      else if (R.p <= 0) { SFX.nope(); this.api.toast("It got away!", "Keep the marker in the green zone.", "warn"); this.cancel(); }
    } else if (this.state === "caught" && this.t > 2.8) {
      this.cancel();
    }
    this.dip = Math.max(0, (this.dip || 0) - dt * 2.5);
  }
  caught() {
    const R = this.reel, F = R.F, f = { id: F.id, w: R.w };
    this.state = "caught"; this.t = 0; this.line.visible = false; this.bob.visible = false;
    S.fish.push(f); S.stats.fish++;
    const log = S.fishLog[F.id] || (S.fishLog[F.id] = { n: 0, best: 0 }); log.n++; const best = f.w > log.best; log.best = Math.max(log.best, f.w);
    // hold it up!
    const fish = makeFish(F.color, clamp(0.6 + Math.sqrt(f.w) * 0.25, 0.5, 2.2)); fish.rotation.set(0, Math.PI / 2, Math.PI / 2); this.held = fish; this.api.person().hold(fish);
    SFX.fish(); this.api.fx.splash(this.api.me().x + Math.sin(this.api.me().yaw) * 2, WATER_Y + 0.2, this.api.me().z + Math.cos(this.api.me().yaw) * 2, 12, 0.7);
    this.api.banner(F.name.toUpperCase() + "!", (F.rarity === "Junk" ? "Ha! " : "") + f.w + " lb · " + F.rarity + " · worth " + money(fishValue(f)) + (best && log.n > 1 ? " · NEW RECORD!" : log.n === 1 ? " · NEW FISH!" : ""));
    this.reel = null; save();
  }
  ring() { for (const r of this.rings) if (r.userData.t > 1) { r.userData.t = 0; r.position.set(this.target.x, WATER_Y + 0.04, this.target.z); return; } }
  // the line from the rod tip to the bobber
  drawLine(tip, end, sag) {
    const a = this.line.geometry.attributes.position;
    for (let i = 0; i < this.N; i++) { const k = i / (this.N - 1); a.setXYZ(i, tip.x + (end.x - tip.x) * k, tip.y + (end.y - tip.y) * k - Math.sin(k * Math.PI) * sag, tip.z + (end.z - tip.z) * k); }
    a.needsUpdate = true; this.line.visible = true;
  }
  draw(dt, time) {
    for (const r of this.rings) { r.userData.t += dt; const k = r.userData.t; r.scale.setScalar(1 + k * 4); r.material.opacity = Math.max(0, 0.8 - k * 0.8); }
    const P = this.api.person(), me = this.api.me(), rod = this.api.rodModel();
    // poses
    if (this.state === "cast") P.pose("cast", time, Math.min(1, this.t / 0.55));
    else if (this.state === "fly") P.pose("cast", time, Math.min(1, 0.76 + this.t * 0.5));
    else if (this.state === "wait" || this.state === "bite") P.pose("rod", time);
    else if (this.state === "reel") P.pose("reel", time, this.reel.m);
    else if (this.state === "caught") P.pose("show", time);
    if (rod) rod.userData.bend(this.state === "reel" ? 0.25 + this.reel.m * 0.9 : this.state === "bite" ? 0.35 : 0);
    if (this.state === "idle" || this.state === "cast" || this.state === "caught" || !rod) { if (this.state !== "cast") this.line.visible = false; this.bang.visible = false; return; }
    P.root.updateMatrixWorld(true);
    const tip = rod.userData.tip.getWorldPosition(this.tmp).clone(), tg = this.target;
    let bx = tg.x, bz = tg.z, by = WATER_Y + 0.05;
    if (this.state === "fly") {
      // the bobber flies out in an arc
      const k = Math.min(1, this.t / 0.55); bx = tip.x + (tg.x - tip.x) * k; bz = tip.z + (tg.z - tip.z) * k; by = tip.y + (WATER_Y - tip.y) * k + Math.sin(k * Math.PI) * 3.2;
    } else if (this.state === "wait" || this.state === "bite") {
      by += Math.sin(time * 3) * 0.04 - this.dip * 0.22;
      if (this.state === "bite") { bx += Math.sin(time * 30) * 0.06; }
    } else if (this.state === "reel") {
      // the fish fights (zig-zag) and slowly gets pulled in
      const k = this.reel.p * 0.6; bx = tg.x + (me.x - tg.x) * k + Math.sin(time * 5) * 0.4 * (1 - this.reel.p); bz = tg.z + (me.z - tg.z) * k + Math.cos(time * 4) * 0.4 * (1 - this.reel.p); by = WATER_Y - 0.05 + Math.sin(time * 9) * 0.05;
      if (Math.random() < 0.08) this.api.fx.splash(bx, WATER_Y + 0.1, bz, 2, 0.3);
    }
    this.bob.visible = true; this.bob.position.set(bx, by, bz); this.bob.rotation.z = this.state === "bite" ? Math.sin(time * 25) * 0.4 : 0;
    const sag = this.state === "reel" ? 0.05 * (1 - this.reel.m) : this.state === "fly" ? 0.2 : 0.9;
    this.drawLine(tip, { x: bx, y: by + 0.2, z: bz }, sag);
    this.bang.visible = this.state === "bite"; if (this.bang.visible) { this.bang.position.set(me.x, me.y + 3 + Math.abs(Math.sin(time * 10)) * 0.2, me.z); }
  }
  // HUD info for the reel mini game
  hud() { return this.reel && this.state === "reel" ? { m: this.reel.m, zone: this.reel.zone, width: this.reel.width, p: this.reel.p, snap: this.reel.snapT, name: "?" } : null; }
  sellAll() { const n = coolerValue(), c = S.fish.length; S.fish = []; return { n, c }; }
}
