// MUD VALLEY RP: robbers and cops! (guns with bullet tracers, but nobody gets hurt for real: anyone who gets hit is just
// "knocked out" for a bit, seeing stars. Nobody gets hurt.)
//  - Robber career: buy gear at the Tool Barn, rob registers / ATMs / the jewelry store / the bank vault (hold E),
//    get a wanted level (1-5 stars), lose the cops, then stash your loot at the hideout to turn it into money.
//    Busted = jail (wait it out, or try a jail break).
//  - Cop career: sign up at the Police Station, get a uniform + a police cruiser, answer radio calls,
//    stop the getaway car (spike strips, bumping it, stun blaster, taser), cuff the robber (hold E) and book them at the station.
//  - In a lobby (mp.js), cop players and robber players can splat / tase each other: a wanted robber who gets zapped
//    by a cop player is busted; anyone else just sees stars for a moment.
//  - Robbing inside (hold-ups, splatting the teller, the vault door) is in heist.js. Civilians + backpacks: npcs.js.
//  - Traffic cops: 2 police cars patrol the roads near you. Speed past one (over 50 mph on a road) and they pull you
//    over: stop and you get a ticket ($150). Drive off and you're wanted!
import * as THREE from "/create/vendor/three.module.js";
import { PLACES, ATMS, HOUSES } from "./layout.js";
import { buildingById, INSIDE_SPOTS } from "./interiors.js";
import { groundAt, hAt, roadPoints, roadNet, speedLimitAt } from "./terrain.js";
import { buildCar, animateCar, vehicleById, tune } from "./vehicles.js";
import { makeBody, stepCar, placeModel, speedOf, makeWalker, stepWalker } from "./physics.js";
import { makePerson, LOOKS } from "./character.js";
import { S, save, pay, money } from "./save.js";
import { SFX, siren } from "./sfx.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------------------------------------------------------- shops
export const GEAR = [
  { id: "crowbar", name: "Crowbar", price: 300, icon: "🔧", desc: "Pry open ATMs." },
  { id: "lockpick", name: "Lockpick Set", price: 450, icon: "🗝️", desc: "Unlock the jewelry store display cases." },
  { id: "drill", name: "Super Drill", price: 1500, icon: "🌀", desc: "Drill open the bank vault (the big one!)." },
  { id: "duffel", name: "Big Duffel Bag", price: 800, icon: "👜", desc: "Carry way more loot: $5,000 instead of $1,500." },
  { id: "mask", name: "Ski Mask", price: 250, icon: "🎭", desc: "Robberies give 1 less star, and you lose the cops faster." },
];
// guns (made-up models). Real-looking with bullet tracers + a bang, but anyone hit is just knocked out for a few
// seconds (stars spin around their head). (The ids are the old blaster ids so saves keep what you bought.)
export const BLASTERS = [
  { id: "splat", name: "Ridgeback 9 Pistol", price: 500, tier: 0, rate: 0.45, range: 34, stun: 4, speed: 170, desc: "A compact 9mm handgun. Quick and easy." },
  { id: "rapid", name: "Hornet SMG", price: 1800, tier: 1, rate: 0.11, range: 30, stun: 2.5, speed: 170, desc: "Full-auto. Sprays bullets really fast." },
  { id: "long", name: "Longhorn Scoped Rifle", price: 3500, tier: 2, rate: 1.1, range: 90, stun: 6, speed: 260, desc: "Bolt-action with a scope. Hits from super far away." },
  { id: "mega", name: "Thunder Pump Shotgun", price: 6000, tier: 3, rate: 0.95, range: 26, stun: 8, speed: 150, splash: 3, desc: "One blast hits everybody in front of you." },
];
export const STUN_BLASTER = { id: "stun", name: "Police Sidearm", price: 0, tier: 0, rate: 0.45, range: 36, stun: 5, speed: 170, desc: "Every cop carries one." };
export const blasterById = (id) => BLASTERS.find((b) => b.id === id) || (id === "stun" ? STUN_BLASTER : null);
export const RANKS = [{ name: "Rookie", at: 0, mult: 1 }, { name: "Officer", at: 3, mult: 1.25 }, { name: "Sergeant", at: 8, mult: 1.5 }, { name: "Detective", at: 15, mult: 1.8 }, { name: "Chief", at: 25, mult: 2.2 }];
export const rankOf = (n = S.cop.arrests) => { let r = RANKS[0]; for (const k of RANKS) if (n >= k.at) r = k; return r; };
export const nextRank = (n = S.cop.arrests) => RANKS.find((k) => k.at > n) || null;
export const lootCap = () => (S.gear.duffel ? 5000 : 1500);
export const BOOK_PAY = 400;
export const TASER = { range: 13, rate: 1.3, stun: 7 };
export const TICKET = 150; // (speed limits: the signs on the roads, terrain.js speedLimitAt)

// important spots
const HEAD_START = 20; // seconds you get to run after a jail break, before the cops come after you
export const JAIL = { x: 449, z: -348, yaw: Math.PI }; // the jail cell (in the Police Station: you can see in through the bars)
export const JAIL_OUT = { x: 466, z: -326, yaw: 0 }; // where you come out
export const HOSPITAL = { x: 484, z: -326, yaw: 0 };
// things robbers can rob (hold E). room = inside which building (x, z are then room spots); ox, oz = the spot outside
const inside = (id, room, rest) => { const b = buildingById(room), p = INSIDE_SPOTS[id]; return { id, room, x: p.x, z: p.z, ox: b.dx, oz: b.dz, ...rest }; };
export const ROB_SPOTS = [
  inside("gas", "gas", { name: "the gas station register", icon: "🧾", tool: null, time: 3.5, loot: [120, 220], heat: 1, kind: "register" }),
  inside("cafe", "cafe", { name: "the Copper Cafe register", icon: "🧾", tool: null, time: 3.5, loot: [100, 200], heat: 1, kind: "register" }),
  ...ATMS.map((a, i) => ({ id: "atm" + i, name: "the ATM", icon: "🏧", x: a.x + Math.sin(a.yaw) * 1.3, z: a.z + Math.cos(a.yaw) * 1.3, tool: "crowbar", time: 5, loot: [200, 380], heat: 1, kind: "atm" })),
  ...[0, 1, 2].map((i) => inside("case" + i, "jewelry", { name: "a jewelry case", icon: "💎", tool: "lockpick", time: 3, loot: [300, 450], heat: 2, kind: "case" })),
  inside("vault", "bank", { name: "the bank vault door", icon: "🏦", tool: "drill", time: 12, loot: [0, 0], heat: 1, kind: "vault" }),
  inside("gold", "bank", { name: "the gold in the vault", icon: "🪙", tool: null, time: 3.5, loot: [2000, 3000], heat: 2, kind: "gold" }),
];
const TOOL_NAME = { crowbar: "a crowbar", lockpick: "a lockpick set", drill: "the Super Drill" };

// stars that spin above someone who got knocked out
function makeStars(scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * scale, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe14a : 0xffffff })); s.position.set(Math.cos(i * 1.256) * 0.7 * scale, 0, Math.sin(i * 1.256) * 0.7 * scale); g.add(s); }
  g.visible = false; return g;
}
// line of sight (no hill in the way)
function sees(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const k = i / n, x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k, y = a.y + 1.8 + (b.y - a.y) * k; if (hAt(x, z) > y) return false; }
  return true;
}

export class Crime {
  constructor(api) {
    this.api = api; const scene = (this.scene = api.scene);
    this.cops = []; this.shots = []; this.splats = []; this.spikes = []; this.call = null; this.callT = 12; this.t = 0;
    this.evadeT = 0; this.spawnT = 0; this.bustT = 0; this.jail = null; this.ko = null; this.fireT = 0; this.warnT = 0; this.hidden = false; this.vaultUntil = 0; this.carHits = 0;
    // the taser's lightning bolt (two zig-zag lines, redrawn every frame while it crackles)
    // (thick: 11 glowing sticks per line, a yellow glow + a white-hot middle)
    this.bolts = [[0xffe14a, 0.11, 0.5], [0xffffff, 0.045, 1]].map(([c, w, o]) => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o === 1 }), 11); m.userData.w = w; m.frustumCulled = false; m.visible = false; scene.add(m); return m; });
    this.bolt = null; this.patrols = []; this.pull = null; this.ticketCool = 0; this.patrolT = 0;
    for (const s of ROB_SPOTS) s.readyAt = 0;
    // bullet tracers (glowing streaks), muzzle flashes + bullet marks on the ground (instanced: one draw call each)
    this.shotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 80);
    this.splatMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }), 60);
    this.flashMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 20);
    for (const m of [this.shotMesh, this.splatMesh, this.flashMesh]) { m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color()); scene.add(m); }
    this.flashes = [];
    // a spike strip (copied each time a cop drops one)
    const sp = new THREE.Group(), dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), metal = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 }), yel = new THREE.MeshLambertMaterial({ color: 0xffd23a });
    const base = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.6), dark); base.position.y = 0.06; sp.add(base);
    for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), i % 2 ? metal : yel); c.position.set(-3.25 + i * 0.5, 0.25, 0); sp.add(c); }
    this.spikeModel = sp;
    // the beacon over the robbery (red)
    this.beacon = api.makeBeacon(0xff3a3a);
  }
  get wanted() { return S.wanted; }
  vaultOpen() { return this.t < this.vaultUntil; }
  lootCap() { return lootCap(); }
  // a hold-up or an emptied register (heist.js) is done: stars + the robbery counts
  robberyDone(heat, got, msg) {
    S.stats.robberies++;
    if (msg) { SFX.cash(); this.api.toast("+" + money(got) + " loot!", "Loot: " + money(S.loot) + " / " + money(lootCap()), "cash", 3000); }
    this.setWanted(S.wanted + Math.max(1, heat - (S.gear.mask ? 1 : 0)));
    save();
  }
  get role() { return S.role; }

  // ------------------------------------------------------------ careers
  setRole(r, quiet) {
    if (r === S.role) return null;
    if (S.wanted > 0) return "Lose the cops first! (You can’t switch while you’re wanted.)";
    if (this.jail) return "You’re in jail!";
    if (this.headStart > 0) return "You just broke out of jail! Run first!";
    if (r === "cop" && !S.cop.joined) return "Sign up at the Police Station in Copper Creek first.";
    if (S.role === "robber" && S.loot > 0) { this.api.toast("You dropped your loot", money(S.loot) + " left behind. (Stash it at the hideout next time!)", "warn"); S.loot = 0; }
    if (S.role === "cop") this.endCall(true);
    S.role = r; this.api.roleChanged(r);
    if (!quiet) {
      SFX.job();
      if (r === "cop") this.api.banner("ON DUTY", rankOf().name + " · listen to the radio for calls! (G = siren)");
      else if (r === "robber") this.api.banner("ROBBER", "Buy gear at the Tool Barn, then hold E to rob things!");
      else this.api.banner("CIVILIAN", "Back to regular life in Mud Valley.");
    }
    if (r === "cop") this.callT = 6;
    save(); return null;
  }
  joinPolice() { S.cop.joined = true; return this.setRole("cop"); }
  // at the Police Station you can always switch sides: your stars (and any loot) are wiped
  copAtStation() {
    if (this.jail) return "You’re in jail!";
    if (this.headStart > 0) return "You just broke out of jail! Run first!";
    S.cop.joined = true;
    if (S.wanted > 0) { const lost = S.loot; S.loot = 0; this.setWanted(0); for (const c of this.cops.slice()) this.removeCop(c); this.api.toast("You turned yourself in", (lost ? "The cops kept your " + money(lost) + " loot. " : "") + "Your record is clean. Welcome to the force!", "good", 4000); }
    return this.setRole("cop");
  }

  // ------------------------------------------------------------ wanted level + cops
  setWanted(n) {
    n = clamp(Math.round(n), 0, 5);
    const was = S.wanted; S.wanted = n; this.evadeT = 0;
    if (n > was && this.api.indoors()) this.alarmAt = this.api.roomId(); // (you can't hide in the place you just robbed)
    if (n === 0) this.alarmAt = null;
    if (n > was) { SFX.alarm(); this.api.toast("★".repeat(n) + " WANTED!", n >= 4 ? "Fast interceptors are coming!" : "The cops are coming! Lose them, then stash your loot at the hideout.", "warn", 3600); }
    if (n === 0 && was > 0) {
      for (const c of this.cops) c.leaving = true;
      if (!this.jail) { SFX.escape(); this.api.toast("You lost the cops!", S.loot ? "Now stash your " + money(S.loot) + " at the Robber Hideout." : "Phew!", "good", 4000); }
    }
  }
  copCount() { return [0, 1, 2, 3, 3, 4][S.wanted]; }
  spawnCop() {
    const me = this.api.me(), pts = roadPoints();
    let cand = pts.filter((p) => { const d = Math.hypot(p.x - me.x, p.z - me.z); return d > 110 && d < 200 && p.road; });
    if (!cand.length) cand = pts.filter((p) => Math.hypot(p.x - me.x, p.z - me.z) > 90);
    const p = cand[Math.floor(Math.random() * cand.length)] || { x: me.x + 120, z: me.z, yaw: 0 };
    const id = S.wanted >= 4 ? "interceptor" : "cruiser", v = vehicleById(id);
    const car = { id, paint: v.color, rims: "chrome", tires: "allterrain", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0, x: p.x, z: p.z, yaw: Math.atan2(me.x - p.x, me.z - p.z) };
    const m = buildCar(car, { driver: LOOKS.cop }); this.scene.add(m.root);
    const b = makeBody(car, m); const t = tune(car), k = 0.88 + 0.06 * S.wanted;
    b.t = { ...t, top: t.top * k, acc: t.acc * (0.9 + 0.08 * S.wanted), off: { dirt: 0.9, grass: 0.85, mud: 0.7 }, crawl: 0.8 };
    const stars = makeStars(1.4); stars.position.y = 2.6; m.root.add(stars);
    this.cops.push({ m, b, stars, stunT: 0, stuckT: 0, backT: 0, shootT: 2, seen: true, leaving: false, life: 0 });
  }
  removeCop(c) { this.scene.remove(c.m.root); this.cops.splice(this.cops.indexOf(c), 1); }

  // a computer driver: steer towards (tx, tz). stopNear = brake when closer than this
  aiDrive(n, tx, tz, dt, stopNear = 0) {
    const b = n.b, dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz), sp = speedOf(b);
    const diff = wrap(Math.atan2(dx, dz) - b.yaw);
    let thr = 1, steer = clamp(-diff * 2.2, -1, 1);
    if (n.backT > 0) { n.backT -= dt; thr = -1; steer = n.backSteer; }
    else {
      if (Math.abs(diff) > 2.0 && d < 30) { thr = -0.8; steer = clamp(diff * 2, -1, 1); }
      if (stopNear && d < stopNear) thr = sp > 2 ? -1 : 0;
      if (thr > 0.5 && sp < 1.2) { n.stuckT += dt; if (n.stuckT > 1.3) { n.backT = 1.2; n.backSteer = steer > 0 ? -1 : 1; n.stuckT = 0; n.stuckCount = (n.stuckCount || 0) + 1; } }
      else n.stuckT = Math.max(0, n.stuckT - dt * 0.5);
    }
    if (n.stunT > 0) { thr = 0; steer = 0; }
    if (n.spiked) b.vx *= 1 - dt * 0.6, b.vz *= 1 - dt * 0.6;
    stepCar(b, { thr, steer, hand: n.stunT > 0 }, dt);
    if (b.flipped) { b.flipped = false; b.pitch = b.roll = 0; } // (computer drivers flip back over right away)
  }
  // push a computer car and you apart (returns how hard you hit)
  bump(b, me, meR = 1.2) {
    const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz), m = 1.9 + meR;
    if (d >= m || d < 1e-3 || Math.abs((me.y || b.y) - b.y) > 3) return 0;
    const nx = dx / d, nz = dz / d, pen = m - d, mv = me.vx !== undefined && !me.isWalker;
    if (mv) { me.x += nx * pen * 0.5; me.z += nz * pen * 0.5; b.x -= nx * pen * 0.5; b.z -= nz * pen * 0.5; }
    else { me.x += nx * pen; me.z += nz * pen; }
    const rv = ((me.vx || 0) - b.vx) * nx + ((me.vz || 0) - b.vz) * nz;
    if (rv < 0) { const j = rv * 0.7; if (me.vx !== undefined) { me.vx -= nx * j; me.vz -= nz * j; } b.vx += nx * j; b.vz += nz * j; }
    return -rv;
  }

  // ------------------------------------------------------------ robbing (hold E)
  robAction(me) {
    if (S.role !== "robber" || this.jail || this.ko) return null;
    for (const s of ROB_SPOTS) {
      if ((s.room || null) !== (me.room || null) || Math.hypot(s.x - me.x, s.z - me.z) > (s.room ? 1.8 : 2.6)) continue;
      if (s.kind === "vault" && this.vaultOpen()) continue; // (it's already open: go grab the gold)
      if (s.kind === "gold" && !this.vaultOpen()) continue;
      if (this.t < s.readyAt) return { text: s.kind === "gold" ? "The vault is empty. Come back later!" : "Already robbed. Come back later!", warn: true, fn: () => SFX.nope() };
      if (s.tool && !S.gear[s.tool]) return { text: "Needs " + TOOL_NAME[s.tool] + " (Tool Barn)", warn: true, fn: () => { SFX.nope(); this.api.toast("You need " + TOOL_NAME[s.tool] + "!", "Buy one at the Tool Barn in Copper Creek.", "warn"); } };
      if (S.loot >= lootCap()) return { text: "Your bag is full! Stash it at the hideout", warn: true, fn: () => SFX.nope() };
      if (s.kind === "vault") return { id: "rob_vault", text: "Hold E: Drill open the vault door", hold: s.time, spot: s,
        start: () => { if (S.wanted < 1) { this.setWanted(1); this.api.toast("ALARM!", "The bank alarm is ringing! Drill fast!", "warn"); } },
        tick: () => { if (Math.random() < 0.3) SFX.drill(); },
        done: () => { this.vaultUntil = this.t + 240; s.readyAt = this.t + 240; this.api.openVault(); save(); } };
      const verb = { register: "Grab the cash", atm: "Pry open the ATM", case: "Pick the lock + grab the gems", gold: "Grab the gold bars" }[s.kind];
      return { id: "rob_" + s.id, text: "Hold E: " + verb, hold: s.time, spot: s,
        start: () => {},
        tick: (k) => { if (Math.random() < 0.12) (s.kind === "atm" ? SFX.pry : SFX.reel)(); },
        done: () => this.robbed(s) };
    }
    return null;
  }
  robbed(s) {
    const got = Math.min(lootCap() - S.loot, Math.round(rnd(s.loot[0], s.loot[1]) / 5) * 5);
    S.loot += got; S.stats.robberies++; s.readyAt = Math.max(s.readyAt, this.t + (s.kind === "gold" ? 240 : 150));
    (s.kind === "case" ? SFX.smash : SFX.cash)();
    const p = this.api.me(); this.api.fx.confetti(p.x, p.y + 2, p.z, 20);
    this.api.toast("+" + money(got) + " loot!", S.loot >= lootCap() ? "Your bag is full! Get to the hideout." : "Loot: " + money(S.loot) + " / " + money(lootCap()), "cash", 3400);
    this.setWanted(S.wanted + Math.max(1, s.heat - (S.gear.mask ? 1 : 0)));
    save();
  }
  stash() {
    if (S.wanted > 0) { SFX.nope(); this.api.toast("Lose the cops first!", "The hideout has to stay secret.", "warn"); return; }
    if (!S.loot) { SFX.nope(); this.api.toast("Nothing to stash", "Rob something first (hold E at a register, ATM, jewelry case or the vault).", "warn"); return; }
    const n = S.loot; pay(n); S.stats.stolen += n; S.loot = 0; SFX.cash(); this.api.bumpMoney();
    this.api.banner("LOOT STASHED!", "+" + money(n)); save();
  }

  // ------------------------------------------------------------ knocked out / busted / jail
  knockOut(why, soft, by) {
    if (this.ko || this.jail) return;
    this.api.exitCar(); SFX.stun();
    this.ko = { t: 0, why, soft: !!soft, by };
    if (!(why === "cop" && S.role === "robber" && S.wanted > 0) && !this.api.indoors()) { const me = this.api.me(); this.api.dropMine(me.x, me.z); }
    this.api.toast(by ? "HIT! " + by + " got you!" : "KNOCKED OUT!", soft ? "You see stars for a second..." : why === "cop" ? "You got hit! You see stars..." : "Bonk! You see stars...", "warn", 2400);
  }
  // a lobby friend zapped you (mp.js: they're a cop and you're a robber, or the other way around). k: 1 blaster, 2 taser
  zappedBy(p, k) {
    if (this.jail || this.ko || this.api.indoors()) return;
    const ok = (p.role === "cop" && S.role === "robber") || (p.role === "robber" && S.role === "cop"); if (!ok) return;
    const me = this.api.me(); if (Math.hypot((p.x ?? 1e9) - me.x, (p.z ?? 1e9) - me.z) > 90) return; // (they have to be near you)
    if (me.inCar && k === 1) { // in a car it takes 3 splats
      this.carHits = (this.carHits || 0) + 1; this.carHitT = 12; if (me.body) { me.body.vx *= 0.5; me.body.vz *= 0.5; } SFX.ricochet(); this.api.shake(0.35);
      if (this.carHits < 3) { this.api.toast("BANG!", p.n + " is shooting your ride! (" + (3 - this.carHits) + " more and you’re out)", "warn", 1800); return; }
    }
    this.carHits = 0;
    if (k === 1 && !me.inCar) this.bleed(me.x, me.y + 1.2, me.z);
    if (p.role === "cop" && S.wanted > 0) this.knockOut("cop", false, p.n); // (then busted!)
    else this.knockOut("player", true, p.n);
  }
  bust() {
    if (this.jail) return;
    const stars = S.wanted, lost = S.loot;
    S.loot = 0; S.stats.busted++;
    const bp = S.backpack.length; S.backpack = []; this.api.confiscate();
    if (bp) setTimeout(() => this.api.toast("🎒 Backpack confiscated!", "The cops took the " + bp + " thing" + (bp === 1 ? "" : "s") + " in your backpack.", "warn", 4000), 2600);
    this.setWanted(0);
    for (const c of this.cops.slice()) this.removeCop(c);
    this.api.exitCar(); this.ko = null;
    this.jail = { t: clamp(14 + stars * 7, 15, 50), wins: 0, needle: 0, zone: rnd(0.25, 0.75), cool: 0 };
    this.api.goJail();
    SFX.busted(); setTimeout(() => SFX.jail(), 900);
    this.api.banner("BUSTED!", lost ? "The cops took your " + money(lost) + " loot." : "Off to jail!");
    save();
  }
  // the jail break mini game: stop the needle in the green zone 3 times
  jailTry() {
    const j = this.jail; if (!j || j.cool > 0) return;
    j.cool = 0.35;
    if (Math.abs(j.needle - j.zone) < 0.09) { j.wins++; SFX.cuff(); j.zone = rnd(0.2, 0.8); if (j.wins >= 3) this.release(true); }
    else { j.wins = Math.max(0, j.wins - 1); j.t += 3; SFX.nope(); }
  }
  release(broke) {
    this.jail = null; this.api.leaveJail(JAIL_OUT);
    if (broke) { SFX.escape(); this.headStart = HEAD_START; this.api.banner("JAIL BREAK!", "RUN! The guards find your empty cell in " + HEAD_START + " seconds!"); }
    else { this.api.toast("You’re free!", "Time served. Try not to get caught next time!", "good", 4000); }
    save();
  }

  // ------------------------------------------------------------ shooting
  fire(aimYaw) {
    const bl = blasterById(S.blaster) || (S.role === "cop" ? STUN_BLASTER : null);
    if (!bl) { this.api.toast("No gun", "Buy one at the Gun Shop in Copper Creek.", "warn"); return false; }
    if (this.fireT > 0) return false;
    this.fireT = bl.rate;
    const me = this.api.me();
    // easy aiming: lock onto the nearest target in front of you
    let best = null, bd = bl.range;
    for (const t of this.targets()) {
      const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz); if (d > bl.range || d < 0.5) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - aimYaw)) > 0.5 || d > bd) continue; best = t; bd = d;
    }
    const ox = me.x + Math.sin(aimYaw) * 0.7, oz = me.z + Math.cos(aimYaw) * 0.7, oy = me.y + 1.35;
    let dx = Math.sin(aimYaw), dy = 0.04, dz = Math.cos(aimYaw);
    if (best) { const tx = best.x + (best.vx || 0) * bd / bl.speed, tz = best.z + (best.vz || 0) * bd / bl.speed, ty = best.y + 1; const l = Math.hypot(tx - ox, ty - oy, tz - oz); dx = (tx - ox) / l; dy = (ty - oy) / l; dz = (tz - oz) / l; }
    const col = 0xffe6a0;
    this.shots.push({ x: ox, y: oy, z: oz, vx: dx * bl.speed, vy: dy * bl.speed, vz: dz * bl.speed, life: bl.range / bl.speed + 0.05, mine: true, stun: bl.stun, splash: bl.splash || 0, color: col });
    if (bl.splash) for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.07 + (Math.random() - 0.5) * 0.04, ca = Math.cos(a), sa = Math.sin(a), ex = dx * ca + dz * sa, ez = -dx * sa + dz * ca; this.shots.push({ x: ox, y: oy, z: oz, vx: ex * bl.speed, vy: (dy + (Math.random() - 0.5) * 0.05) * bl.speed, vz: ez * bl.speed, life: bl.range / bl.speed, mine: false, vis: true, stun: 0, splash: 0, color: col }); }
    this.muzzle(ox, oy, oz, bl.tier); this.api.shake(0.06 + bl.tier * 0.04);
    SFX.bang(bl.tier); this.api.alarm(me.x, me.z, 30);
    this.api.shared(ox, oy, oz, ox + dx * bl.range, oy + dy * bl.range, oz + dz * bl.range, bl.tier);
    return true;
  }
  // a friend's shot (just to see it: their game decides who it hits)
  friendShot(p, x, w) {
    if (w === 15) { this.zapBolt({ x: p[0], y: p[1], z: p[2] }, { x: x[0], y: x[1], z: x[2] }); SFX.zap(3); return; }
    const l = Math.hypot(x[0] - p[0], x[1] - p[1], x[2] - p[2]) || 1, sp = 170;
    this.shots.push({ x: p[0], y: p[1], z: p[2], vx: (x[0] - p[0]) / l * sp, vy: (x[1] - p[1]) / l * sp, vz: (x[2] - p[2]) / l * sp, life: l / sp, mine: false, vis: true, stun: 0, splash: 0, color: 0xffe6a0 });
    this.muzzle(p[0], p[1], p[2], w || 0);
    const me = this.api.me(); if (Math.hypot(me.x - p[0], me.z - p[2]) < 120) SFX.bang(w || 0);
  }
  // ------------------------------------------------------------ the cop's taser: a crackling lightning bolt (short range)
  tase(aimYaw) {
    if (S.role !== "cop") return false;
    if (this.fireT > 0) return false; this.fireT = TASER.rate;
    const me = this.api.me();
    let best = null, bd = TASER.range;
    for (const t of this.targets()) { const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz); if (d > bd || d < 0.3 || Math.abs(wrap(Math.atan2(dx, dz) - aimYaw)) > 0.6) continue; best = t; bd = d; }
    const from = { x: me.x + Math.sin(aimYaw) * 0.6, y: me.y + 1.3, z: me.z + Math.cos(aimYaw) * 0.6 };
    const to = best ? { x: best.x, y: best.y + 1, z: best.z } : { x: me.x + Math.sin(aimYaw) * 5, y: me.y + 0.9, z: me.z + Math.cos(aimYaw) * 5 };
    this.zapBolt(from, to, best); SFX.zap(3); setTimeout(() => SFX.zap(2), 90);
    this.api.shared(from.x, from.y, from.z, to.x, to.y, to.z, 15);
    if (best) this.hit(best, { stun: TASER.stun, taser: true }); else this.api.toast("Missed!", "Get closer (" + TASER.range + " m) and face them.", "", 1400);
    return true;
  }
  zapBolt(from, to, target) { this.bolt = { from, to, t: 0, target }; }
  muzzle(x, y, z, tier = 0) { if (this.flashes.length >= 20) this.flashes.shift(); this.flashes.push({ x, y, z, life: 0.06, r: 0.13 + tier * 0.04 }); }
  // who can splat whom in a lobby: cops vs robbers only (civilians can't be hit and can't hit anyone)
  static canHit(a, b) { return (a === "cop" && b === "robber") || (a === "robber" && b === "cop"); }
  npcShoot(from, to, speed = 120) {
    const miss = Math.random() < 0.5 ? 0 : 1.6; // (NPC cops aren't great shots: about half of them miss)
    const ox = from.x, oy = from.y + 1.6, oz = from.z, tx = to.x + (Math.random() - 0.5) * 2 * miss, ty = to.y + 1, tz = to.z + (Math.random() - 0.5) * 2 * miss;
    const l = Math.hypot(tx - ox, ty - oy, tz - oz) || 1;
    this.shots.push({ x: ox, y: oy, z: oz, vx: (tx - ox) / l * speed, vy: (ty - oy) / l * speed, vz: (tz - oz) / l * speed, life: 0.6, mine: false, stun: 3, splash: 0, color: 0xffe6a0 });
    this.muzzle(ox, oy, oz, 0); SFX.bang(0);
  }
  // who your blaster can hit
  targets() {
    const out = [];
    for (const c of this.cops) out.push({ kind: "cop", ref: c, x: c.b.x, y: c.b.y, z: c.b.z, vx: c.b.vx, vz: c.b.vz, r: 2.2 });
    const r = this.call && this.call.robber;
    for (const t of this.api.civilians()) out.push(t);
    for (const p of this.api.friends()) if (Crime.canHit(S.role, p.role) && p.x !== undefined) out.push({ kind: "player", ref: p, x: p.x, y: p.y, z: p.z, vx: 0, vz: 0, r: p.car ? 2.2 : 0.8 });
    if (r) { if (r.state === "fleeing") out.push({ kind: "robcar", ref: r, x: r.car.b.x, y: r.car.b.y, z: r.car.b.z, vx: r.car.b.vx, vz: r.car.b.vz, r: 2.2 }); else if (r.w && r.state !== "cuffed" && r.state !== "carried") out.push({ kind: "robber", ref: r, x: r.w.x, y: r.w.y, z: r.w.z, vx: r.w.vx, vz: r.w.vz, r: 0.9 }); }
    return out;
  }
  // blood: a red spray + a puddle on the ground under them
  bleed(x, y, z, big) {
    this.api.fx.blood(x, y, z, big ? 20 : 14);
    const gy = groundAt(x, z); if (this.splats.length >= 60) this.splats.shift();
    this.splats.push({ x: x + rnd(-0.3, 0.3), z: z + rnd(-0.3, 0.3), y: gy + 0.04 + Math.random() * 0.01, r: big ? 0.75 : 0.5, life: 16, color: 0x7a0a10 });
  }
  hit(t, s) {
    if (t.kind === "civ" || t.kind === "robber" || (t.kind === "player" && !t.ref.car)) this.bleed(t.x, t.y + 1.2, t.z, !!s.splash);
    if (t.kind === "cop") {
      if (S.role !== "robber") { if (this.warnT <= 0) { this.warnT = 4; this.api.toast("Hey, that’s a cop!", "Only robbers fight the cops.", "warn"); } return; }
      t.ref.stunT = Math.max(t.ref.stunT, s.stun); SFX.stun();
    } else if (t.kind === "robcar") { t.ref.stunT = Math.max(t.ref.stunT || 0, s.stun * 0.7); t.ref.car.b.vx *= 0.4; t.ref.car.b.vz *= 0.4; SFX.stun(); }
    else if (t.kind === "robber") { const r = t.ref; if (r.state !== "ko") { r.state = "ko"; r.koT = s.stun + 2; SFX.stun(); this.api.toast(s.taser ? "ZAPPED! ⚡" : "Robber knocked out!", "Quick, cuff them! (hold E)", "good"); } }
    else if (t.kind === "civ") this.api.knockCiv(t.ref, S.role);
    else if (t.kind === "player") { const p = t.ref; if ((p.hitT || 0) > this.t) return; p.hitT = this.t + 0.5; this.api.zap(p.id, s.taser ? 2 : 1); SFX.stun(); this.api.toast((s.taser ? "⚡ ZAPPED " : "HIT! ") + p.n, p.role === "robber" && p.wanted > 0 ? "They’re wanted: that’s a bust!" : "They’re seeing stars!", "good", 1800); }
  }
  updateShots(dt) {
    const me = this.api.me(), tg = this.targets();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const n = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy, s.vz) * dt / 0.5)), h = dt / n;
      let done = false, hitT = null;
      for (let k = 0; k < n && !done; k++) {
        s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h;
        if (s.y < groundAt(s.x, s.z)) { done = true; break; }
        if (s.mine) { for (const t of tg) if (Math.hypot(t.x - s.x, t.z - s.z) < t.r + 0.45 && s.y > t.y - 0.6 && s.y < t.y + 3.3) { done = true; hitT = t; break; } }
        else if (!s.vis && !me.inCar && Math.hypot(me.x - s.x, me.z - s.z) < 0.8 && s.y > me.y && s.y < me.y + 2) { done = true; if (!this.ko && !this.jail) this.bleed(me.x, me.y + 1.2, me.z); this.knockOut("cop"); }
      }
      if (s.mine && done && s.splash) { for (const t of tg) if (Math.hypot(t.x - s.x, t.z - s.z) < s.splash) this.hit(t, s); }
      else if (hitT) this.hit(hitT, s);
      if (s.life <= 0 && !done) { this.shots.splice(i, 1); continue; }
      if (done) {
        this.shots.splice(i, 1); SFX.ricochet();
        const gy = groundAt(s.x, s.z);
        this.api.fx.sparks(s.x, Math.max(s.y, gy) + 0.1, s.z, hitT ? 3 : 6); if (!hitT) this.api.fx.dust(s.x, gy, s.z, 1, 0xb0a080, 0.35);
        if (!hitT && s.y < gy + 0.6) { if (this.splats.length >= 60) this.splats.shift(); this.splats.push({ x: s.x, z: s.z, y: gy + 0.05, r: 0.13, life: 8, color: 0x1a1a1a }); }
      }
    }
    for (let i = this.splats.length - 1; i >= 0; i--) { this.splats[i].life -= dt; if (this.splats[i].life <= 0) this.splats.splice(i, 1); }
  }

  // ------------------------------------------------------------ cop career: radio calls + NPC robbers
  callout() {
    const me = this.api.me();
    const spots = [...ROB_SPOTS.filter((s) => s.kind !== "case" && s.kind !== "gold").map((s) => (s.room ? { ...s, x: s.ox, z: s.oz } : s)), ...roadPoints().filter((_, i) => i % 23 === 0).map((p) => ({ x: p.x, z: p.z, name: "a car on the road", kind: "car" }))]
      .filter((s) => { const d = Math.hypot(s.x - me.x, s.z - me.z); return d > 90 && d < 420; });
    const s = spots[Math.floor(Math.random() * spots.length)]; if (!s) { this.callT = 10; return; }
    const what = { register: "Robbery at " + s.name.replace("the ", "the "), atm: "Someone is breaking into an ATM", vault: "BANK ROBBERY at Copper Creek Bank", car: "Car thief spotted" }[s.kind] || "Robbery in progress";
    // the robber + their getaway car
    const pts = roadPoints(); let gp = pts[0], gd = 1e18; for (const p of pts) { const d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2; if (d < gd && p.road) { gd = d; gp = p; } }
    const id = Math.random() < 0.5 ? "sports" : "pickup", v = vehicleById(id);
    const car = { id, paint: [0x2a2a2a, 0x6a3ad0, 0xe0203a, 0x1a1a22][Math.floor(Math.random() * 4)], rims: "black", tires: "allterrain", engine: 1, limit: 1, lift: 0, neon: 0, dirt: 0.2, x: gp.x, z: gp.z, yaw: gp.yaw };
    const m = buildCar(car, { driver: LOOKS.robber }); this.scene.add(m.root); m.rider.root.visible = false;
    const b = makeBody(car, m); const t = tune(car); b.t = { ...t, top: Math.min(t.top, 34) * (0.82 + 0.02 * rankOf().mult * 5), off: { dirt: 0.85, grass: 0.8, mud: 0.6 }, crawl: 0.7 };
    const p = makePerson(LOOKS.robber); p.root.position.set(s.x, groundAt(s.x, s.z), s.z); this.scene.add(p.root);
    const stars = makeStars(1.3); stars.position.y = 2.4; m.root.add(stars);
    const robber = { state: "robbing", p, w: makeWalker(s.x, s.z), car: { m, b, car, stunT: 0, stuckT: 0, backT: 0 }, stars, health: 3, t: 0, footT: 0, koT: 0, farT: 0, shootT: 3, fleeT: 0 };
    robber.w.isWalker = true;
    this.call = { spot: s, what, robber, t: 0, reward: 0 };
    SFX.radio(); this.api.toast("📻 " + what + "!", "Follow the red arrow. Stop the getaway car, then cuff the robber (hold E).", "warn", 5200);
    this.api.setBeacon(this.beacon, s);
  }
  endCall(silent) {
    const c = this.call; if (!c) return;
    const r = c.robber; this.scene.remove(r.p.root); r.p.root.parent && r.p.root.parent.remove(r.p.root); this.scene.remove(r.car.m.root);
    if (r.seat) r.seat.parent && r.seat.parent.remove(r.seat);
    this.call = null; this.api.setBeacon(this.beacon, null); this.callT = rnd(20, 40);
    if (!silent) save();
  }
  fleeTarget(r) {
    const me = this.api.me(), b = r.car.b; let best = null, bs = -1e9;
    for (const p of roadPoints()) {
      const dr = Math.hypot(p.x - b.x, p.z - b.z); if (dr < 60 || dr > 220) continue;
      const sc = Math.hypot(p.x - me.x, p.z - me.z) - 0.4 * dr + (p.road ? 30 : 0) + Math.random() * 40;
      if (sc > bs) { bs = sc; best = p; }
    }
    r.goal = best || { x: b.x + rnd(-100, 100), z: b.z + rnd(-100, 100) }; r.fleeT = 5;
  }
  updateCall(dt) {
    const c = this.call; if (!c) return;
    const r = c.robber, me = this.api.me(); c.t += dt; r.t += dt;
    const car = r.car, b = car.b;
    if (r.stunT > 0) r.stunT -= dt;
    car.stunT = r.stunT || 0; r.stars.visible = car.stunT > 0;
    if (r.state === "robbing") {
      r.p.pose("reel", r.t, 1); r.p.root.position.set(r.w.x, r.w.y, r.w.z);
      this.api.setBeacon(this.beacon, { x: r.w.x, z: r.w.z });
      if (Math.hypot(me.x - r.w.x, me.z - r.w.z) < 70 || c.t > 50) {
        r.state = "fleeing"; this.scene.remove(r.p.root); r.car.m.rider.root.visible = true; this.fleeTarget(r);
        SFX.radio(); this.api.toast("📻 The robber is getting away!", "Chase that car! Bump it, drop spike strips (Q) or stun it.", "warn", 4200);
      }
    } else if (r.state === "fleeing") {
      r.fleeT -= dt; if (r.fleeT <= 0 || Math.hypot(r.goal.x - b.x, r.goal.z - b.z) < 20) this.fleeTarget(r);
      this.aiDrive(car, r.goal.x, r.goal.z, dt);
      this.api.setBeacon(this.beacon, { x: b.x, z: b.z });
      // the player's car bumps the getaway car
      if (me.inCar) { const hit = this.bump(b, me.body, 1.6); if (hit > 5 && (r.bumpCool || 0) <= 0) { r.bumpCool = 0.8; r.health--; SFX.crash(hit / 4); this.api.fx.sparks(b.x, b.y + 1, b.z, 14); if (r.health > 0) this.api.toast("BUMP!", r.health + " more to stop it!", ""); } }
      r.bumpCool = (r.bumpCool || 0) - dt;
      // spike strips
      for (const sp of this.spikes) if (!r.spiked && Math.hypot(sp.x - b.x, sp.z - b.z) < 3.6) { r.spiked = car.spiked = true; SFX.pop(); this.api.fx.sparks(b.x, b.y + 0.4, b.z, 20); this.api.toast("SPIKED!", "Their tires are flat! The car is slowing down.", "good"); b.t = { ...b.t, top: b.t.top * 0.35 }; }
      const stopped = speedOf(b) < 2.5;
      r.slowT = stopped ? (r.slowT || 0) + dt : 0;
      if (r.health <= 0 || (r.spiked && r.slowT > 1.5) || (car.stuckCount || 0) > 5 || (car.stunT > 0 && Math.hypot(me.x - b.x, me.z - b.z) < 12 && stopped)) {
        // the robber jumps out and runs!
        r.state = "foot"; r.footT = 0; r.car.m.rider.root.visible = false;
        const sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw); r.w = makeWalker(b.x + sx * 2.2, b.z + sz * 2.2); r.w.isWalker = true; this.scene.add(r.p.root);
        this.api.toast("The robber jumped out!", "Catch them on foot: get close and hold E to cuff (or stun them!).", "warn", 4000);
      }
      if (Math.hypot(me.x - b.x, me.z - b.z) > 350) { r.farT += dt; if (r.farT > 15) { this.api.toast("📻 The robber got away...", "Better luck next call!", "warn"); this.endCall(); return; } } else r.farT = 0;
    } else if (r.state === "foot" || r.state === "ko" || r.state === "giveup") {
      if (r.state === "foot") {
        r.footT += dt;
        const dx = r.w.x - me.x, dz = r.w.z - me.z, d = Math.hypot(dx, dz) || 1;
        stepWalker(r.w, dx / d, dz / d, true, false, dt); r.w.vx *= 0.985; r.w.vz *= 0.985;
        r.p.pose("run", r.t, 1);
        if (r.footT > 14 || d < 1.6) { r.state = "giveup"; this.api.toast("“Okay, okay! I give up!”", "Hold E to cuff them.", "good"); }
        // sometimes they zap back (a stun goo ball you can dodge)
        r.shootT -= dt; if (!me.inCar && d < 14 && r.shootT <= 0) { r.shootT = 3.2; this.npcShoot(r.w, me, 20); }
      } else if (r.state === "ko") { r.koT -= dt; r.p.pose("ko", r.t); stepWalker(r.w, 0, 0, false, false, dt); if (r.koT <= 0) r.state = "giveup"; }
      else { stepWalker(r.w, 0, 0, false, false, dt); r.p.pose("handsup", r.t); }
      r.p.root.position.set(r.w.x, r.w.y, r.w.z); if (r.state === "foot") r.p.root.rotation.y = Math.atan2(r.w.vx, r.w.vz);
      this.api.setBeacon(this.beacon, { x: r.w.x, z: r.w.z });
    } else if (r.state === "cuffed") {
      // they follow you (in handcuffs)
      const dx = me.x - r.w.x, dz = me.z - r.w.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.8 && !me.inCar) stepWalker(r.w, dx / d, dz / d, d > 5, false, dt); else stepWalker(r.w, 0, 0, false, false, dt);
      if (d > 40) { r.w.x = me.x - dx / d * 2; r.w.z = me.z - dz / d * 2; r.w.y = groundAt(r.w.x, r.w.z); }
      r.p.pose(r.w.moving > 0.5 ? "walk" : "cuffed", r.t, 0.6); if (r.w.moving > 0.5) { r.p.arms[0].rotation.set(0.55, 0, -0.35); r.p.arms[1].rotation.set(0.55, 0, 0.35); }
      r.p.root.position.set(r.w.x, r.w.y, r.w.z); r.p.root.rotation.y = Math.atan2(dx, dz);
      const pc = this.api.policeCar();
      if (pc && me.inCar && me.car === pc && d < 12) this.seatRobber(pc);
      this.api.setBeacon(this.beacon, null);
    } else if (r.state === "carried") {
      const pc = this.api.policeCar(); if (!pc) { r.state = "cuffed"; }
    }
  }
  seatRobber(pc) {
    const r = this.call.robber; r.state = "carried";
    this.scene.remove(r.p.root);
    r.seat = makePerson(LOOKS.robber, 0.7); r.seat.pose("cuffed"); r.seat.legs[0].rotation.x = r.seat.legs[1].rotation.x = -1.5; r.seat.hip.position.y = 0;
    r.seat.root.position.set(-0.42, (pc.m.seat ? pc.m.seat.y : 0.3), -1.0); pc.m.body.add(r.seat.root);
    SFX.door(); this.api.toast("Robber is in the back seat", "Drive to the Police Station in Copper Creek to book them!", "good", 4200);
    this.api.setBeacon(this.beacon, PLACES.police);
  }
  cuffAction(me) {
    const r = this.call && this.call.robber;
    if (!r || S.role !== "cop" || me.inCar) return null;
    if (!["foot", "ko", "giveup"].includes(r.state) || Math.hypot(r.w.x - me.x, r.w.z - me.z) > 2.6) return null;
    return { id: "cuff", text: "Hold E: Put on the handcuffs", hold: 1.2, tick: () => {}, done: () => { r.state = "cuffed"; SFX.cuff(); this.api.toast("CUFFED!", "Get in your police car: they’ll hop in the back. Then drive to the station!", "good", 4200); } };
  }
  bookAction(me) {
    const r = this.call && this.call.robber;
    if (!r || S.role !== "cop" || !(r.state === "carried" || (r.state === "cuffed" && Math.hypot(r.w.x - me.x, r.w.z - me.z) < 10))) return null;
    if (Math.hypot(PLACES.police.x - me.x, PLACES.police.z - me.z) > PLACES.police.r + 2) return null;
    const pay0 = this.bookPay();
    return { text: "Book the robber (+" + money(pay0) + ")", fn: () => this.book() };
  }
  bookPay() { const c = this.call; return Math.round((BOOK_PAY + (c && c.spot.kind === "vault" ? 300 : 0) + Math.max(0, 150 - (c ? c.t : 0))) * rankOf().mult / 5) * 5; }
  book() {
    const n = this.bookPay(), before = rankOf();
    pay(n); S.cop.arrests++; S.stats.arrests++; SFX.cash(); this.api.bumpMoney();
    const after = rankOf();
    this.api.banner("ROBBER BOOKED!", "+" + money(n) + " · arrests: " + S.cop.arrests);
    if (after !== before) setTimeout(() => { SFX.win(); this.api.banner("PROMOTED!", "You’re now a " + after.name + "! Pay goes up." + (after.name === "Sergeant" ? " The Police Interceptor is unlocked!" : "")); if (after.at >= 8) S.cop.interceptor = true; save(); }, 3200);
    this.endCall();
  }
  // drop a spike strip behind your car (or in front of you on foot)
  dropSpikes() {
    if (S.role !== "cop") return false;
    if (S.cop.spikes <= 0) { SFX.nope(); this.api.toast("Out of spike strips", "Get more at the Police Station.", "warn"); return false; }
    const me = this.api.me(), back = me.inCar ? -(me.len / 2 + 2.5) : 2.5, yaw = me.yaw;
    const x = me.x + Math.sin(yaw) * back, z = me.z + Math.cos(yaw) * back;
    const m = this.spikeModel.clone(); m.position.set(x, groundAt(x, z), z); m.rotation.y = yaw + Math.PI / 2; this.scene.add(m);
    this.spikes.push({ x, z, m, life: 60 }); S.cop.spikes--; SFX.spikes();
    this.api.toast("Spike strip down!", S.cop.spikes + " left", "");
    return true;
  }

  // ------------------------------------------------------------ every step
  update(dt) {
    this.t += dt; this.fireT -= dt; this.warnT -= dt;
    if (this.carHits && (this.carHitT -= dt) <= 0) this.carHits = 0;
    const me = this.api.me();
    // jail
    if (this.jail) {
      const j = this.jail; j.t -= dt; j.cool -= dt; j.needle = 0.5 + 0.48 * Math.sin(this.t * (2.2 + j.wins * 0.6));
      if (j.t <= 0) this.release(false);
    }
    // just broke out of jail: a head start before the alarm goes off
    if (this.headStart > 0 && !this.jail) {
      const was = Math.ceil(this.headStart); this.headStart -= dt; const now = Math.ceil(this.headStart);
      if (now !== was && (now === 10 || now === 5)) this.api.toast("⏱️ " + now + " seconds!", "Get far away from the Police Station!", "warn", 1600);
      if (this.headStart <= 0) { this.headStart = 0; this.setWanted(2); this.api.toast("🚨 The guards found your empty cell!", "★★ The cops are looking for you!", "warn", 3600); }
    }
    // knocked out
    if (this.ko) {
      this.ko.t += dt;
      if (this.ko.t > 2.6) {
        const why = this.ko.why, soft = this.ko.soft; this.ko = null;
        if (soft) this.api.toast("You shook it off!", "", "good", 1500);
        else if (S.role === "robber" && S.wanted > 0) this.bust();
        else { this.api.teleport(HOSPITAL.x, HOSPITAL.z, HOSPITAL.yaw); this.api.toast("You woke up at the Hospital", "All better! Back to it.", "good", 4000); }
      }
    }
    // the cops (only chase wanted robbers)
    if (S.wanted > 0) {
      this.spawnT -= dt;
      if (this.cops.filter((c) => !c.leaving).length < this.copCount() && this.spawnT <= 0) { this.spawnCop(); this.spawnT = 3; }
    }
    let seen = false, sirenVol = 0, nearest = 1e9;
    const inAlarm = S.wanted > 0 && me.indoors && this.alarmAt && this.api.roomId() === this.alarmAt;
    this.hidden = S.wanted > 0 && !me.inCar && !inAlarm && (me.indoors || Math.hypot(me.x - PLACES.hideout.x, me.z - PLACES.hideout.z) < 9 || HOUSES.some((h) => S.houses.includes(h.id) && Math.hypot(me.x - h.garage.x, me.z - h.garage.z) < 6));
    // hiding inside? if a cop waits by the door long enough, they come in and get you
    if (S.wanted > 0 && me.indoors && !this.jail) {
      const at = this.cops.some((c) => !c.leaving && Math.hypot(c.b.x - me.x, c.b.z - me.z) < 30);
      this.doorT = at ? (this.doorT || 0) + dt : 0;
      if (at && this.doorT > 0.2 && this.doorT < 0.25) this.api.toast("🚓 The cops are waiting outside!", "They’ll come in soon... (sneak out and run, or wait it out)", "warn", 3600);
      if (this.doorT > 14) { this.doorT = 0; this.api.toast("“Police! You’re under arrest!”", "", "warn"); this.bust(); }
    } else this.doorT = 0;
    for (const c of this.cops.slice()) {
      const b = c.b; c.life += dt;
      if (c.stunT > 0) c.stunT -= dt;
      c.stars.visible = c.stunT > 0; c.stars.rotation.y += dt * 4;
      const d = Math.hypot(me.x - b.x, me.z - b.z); nearest = Math.min(nearest, d);
      if (c.leaving) {
        // drive away and disappear
        if (c.r === undefined || !c.leftRoad) { this.attachRoad(c); c.leftRoad = true; }
        this.patrolDrive(c, dt, 20);
        if (d > 160 || c.life > 40) { this.removeCop(c); continue; }
      } else {
        // can this cop see you?
        const can = !this.hidden && (d < 24 || (d < 150 && sees({ x: b.x, y: b.y, z: b.z }, me)));
        if (me.indoors) { this.aiDrive(c, me.x, me.z, dt, 9); continue; } // (park by the door and wait)
        c.seen = can; if (can) { seen = true; c.lastX = me.x; c.lastZ = me.z; c.searching = false; }
        else if (!c.searching && ((c.lastX !== undefined && Math.hypot(c.lastX - b.x, c.lastZ - b.z) < 16) || (c.stuckCount || 0) >= 2)) { c.searching = true; c.stuckCount = 0; this.attachRoad(c); }
        if (c.searching) { this.patrolDrive(c, dt, 20); continue; } // (lost you: cruise the roads looking for you)
        else if (c.top0 !== undefined && c.mode !== "pull") b.t.top = c.top0; // (full speed again when they spot you)
        const tx = can ? me.x + (me.vx || 0) * Math.min(1, d / 30) : c.lastX ?? me.x, tz = can ? me.z + (me.vz || 0) * Math.min(1, d / 30) : c.lastZ ?? me.z;
        this.aiDrive(c, tx, tz, dt, me.inCar ? 0 : 8);
        // too far behind (or stuck for good): a new cop car shows up closer
        if (d > 420 || (c.stuckCount || 0) > 6) { this.removeCop(c); continue; }
        if (!this.jail && !this.ko) {
          if (me.inCar) { const hit = this.bump(b, me.body, 1.6); if (hit > 9) { SFX.crash(hit / 4); this.api.shake(0.4); } }
          else this.bump(b, me.walker, 0.5);
          // caught: a cop car right next to you while you're stopped
          if (d < 6.5 && me.speed < 3 && c.stunT <= 0) this.bustT += dt / Math.max(1, this.cops.length * 0.7);
          // on foot: they zap you with stun goo
          c.shootT -= dt;
          if (!me.inCar && can && d < 26 && c.stunT <= 0 && c.shootT <= 0) { c.shootT = 1.8; this.npcShoot({ x: b.x, y: b.y, z: b.z }, me); }
        }
      }
      sirenVol = Math.max(sirenVol, 1 - d / 200);
    }
    if (!this.cops.some((c) => !c.leaving && Math.hypot(me.x - c.b.x, me.z - c.b.z) < 7)) this.bustT = Math.max(0, this.bustT - dt * 2);
    if (this.bustT > 1.6 && S.wanted > 0) { this.bustT = 0; this.bust(); }
    // losing the cops: nobody sees you for long enough
    if (S.wanted > 0 && !this.jail) {
      if (seen || this.doorT > 0 || inAlarm) this.evadeT = 0; else this.evadeT += dt * (S.gear.mask ? 1.5 : 1) * (this.hidden ? 2 : 1);
      if (this.evadeT > 6 + S.wanted * 2) this.setWanted(0);
    }
    this.updatePatrols(dt, me);
    // the player's own siren
    if (this.api.mySiren()) sirenVol = Math.max(sirenVol, 0.7);
    if (this.call && this.call.robber.state === "fleeing") sirenVol = Math.max(sirenVol, 0);
    siren(sirenVol);
    // cop shift: radio calls
    if (S.role === "cop" && !this.jail) { if (!this.call) { this.callT -= dt; if (this.callT <= 0) this.callout(); } else this.updateCall(dt); }
    // spike strips fade away after a while
    for (let i = this.spikes.length - 1; i >= 0; i--) { const s = this.spikes[i]; s.life -= dt; if (s.life <= 0) { this.scene.remove(s.m); this.spikes.splice(i, 1); } }
    this.updateShots(dt);
  }
  // ------------------------------------------------------------ traffic cops: patrol the roads, pull you over for speeding
  spawnPatrol(me) {
    const { roads } = roadNet(), cand = [];
    roads.forEach((R, r) => { for (let i = 2; i < R.n - 2; i += 4) { const d = Math.hypot(R.x[i] - me.x, R.z[i] - me.z); if (d > 140 && d < 260 && !R.bridge[i]) cand.push([r, i]); } });
    if (!cand.length) return;
    const [r, i] = cand[Math.floor(Math.random() * cand.length)], R = roads[r], dir = Math.random() < 0.5 ? 1 : -1, v = vehicleById("cruiser");
    const p = { x: R.x[i], z: R.z[i], yaw: Math.atan2(R.x[i + dir] - R.x[i], R.z[i + dir] - R.z[i]) };
    const car = { id: "cruiser", paint: v.color, rims: "chrome", tires: "allterrain", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0, x: p.x, z: p.z, yaw: p.yaw };
    const m = buildCar(car, { driver: LOOKS.cop }); this.scene.add(m.root);
    const b = makeBody(car, m), t = tune(car); b.t = { ...t, off: { dirt: 0.9, grass: 0.85, mud: 0.7 }, crawl: 0.8 };
    const stars = makeStars(1.4); stars.position.y = 2.6; m.root.add(stars);
    const c = { m, b, stars, stunT: 0, stuckT: 0, backT: 0, shootT: 2, seen: true, leaving: false, life: 0, mode: "patrol", r, i, dir, inJ: true };
    this.patrols.push(c);
  }
  // put a computer car on the nearest paved road, heading the way it's already pointing
  attachRoad(c) {
    const { roads } = roadNet(), b = c.b; let best = null, bd = 1e18;
    roads.forEach((R, r) => { for (let i = 0; i < R.n; i++) { const d = (R.x[i] - b.x) ** 2 + (R.z[i] - b.z) ** 2; if (d < bd) { bd = d; best = [r, i]; } } });
    const [r, i] = best, R = roads[r], j = Math.min(R.n - 1, i + 1), k = Math.max(0, j - 1);
    const dot = (R.x[j] - R.x[k]) * Math.sin(b.yaw) + (R.z[j] - R.z[k]) * Math.cos(b.yaw);
    c.r = r; c.i = i; c.dir = dot >= 0 ? 1 : -1; c.inJ = true;
  }
  // drive along the roads like a real driver: stay on your side, slow down for corners, sometimes turn at a crossing
  patrolDrive(c, dt, hwy = 20) {
    const { roads, links } = roadNet(), b = c.b, hx = Math.sin(b.yaw), hz = Math.cos(b.yaw);
    for (let guard = 0; guard < 60; guard++) {
      const R = roads[c.r], k = c.i;
      if (Math.hypot(R.x[k] - b.x, R.z[k] - b.z) > 12 && ((R.x[k] - b.x) * hx + (R.z[k] - b.z) * hz > 0 || guard > 0)) break; // (the spot to aim for is far enough ahead)
      const L = links[c.r][k], end = k + c.dir < 0 || k + c.dir >= R.n;
      // a crossing: maybe turn (decided once per crossing). At the end of a road you always turn (or U-turn if it's a dead end).
      if (L.length && (end || !c.inJ)) {
        c.inJ = true;
        if (end || Math.random() < 0.45) {
          const opts = [];
          for (const [nr, nj] of L) for (const nd of [1, -1]) {
            const N = roads[nr], a = nj + nd * 3; if (a < 0 || a >= N.n) continue;
            const dx = N.x[a] - N.x[nj], dz = N.z[a] - N.z[nj], dl = Math.hypot(dx, dz) || 1;
            if ((dx * hx + dz * hz) / dl > -0.4) opts.push([nr, nj, nd]); // (no turning straight back)
          }
          if (opts.length) { const [nr, nj, nd] = opts[Math.floor(Math.random() * opts.length)]; c.r = nr; c.i = nj; c.dir = nd; continue; }
        }
      } else if (!L.length) c.inJ = false;
      if (end) { c.dir = -c.dir; c.inJ = false; } // (a dead end: turn around)
      else c.i = k + c.dir;
    }
    const R = roads[c.r], k = c.i, k2 = Math.max(0, Math.min(R.n - 1, k + c.dir)), k0 = Math.max(0, Math.min(R.n - 1, k - c.dir));
    let dx = R.x[k2] - R.x[k0], dz = R.z[k2] - R.z[k0]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const lane = R.w * 0.24, tx = R.x[k] - dz * lane, tz = R.z[k] + dx * lane; // (the right-hand lane)
    // corners: slow down when the road ahead bends
    const turn = Math.abs(wrap(Math.atan2(tx - b.x, tz - b.z) - b.yaw));
    if (c.top0 === undefined) c.top0 = b.t.top;
    b.t.top = Math.min(c.top0, R.town ? 13 : hwy, turn > 0.7 ? 7 : turn > 0.35 ? 10 : 99);
    this.aiDrive(c, tx, tz, dt);
  }
  removePatrol(c) { this.scene.remove(c.m.root); this.patrols.splice(this.patrols.indexOf(c), 1); if (this.pull && this.pull.c === c) this.pull = null; }
  updatePatrols(dt, me) {
    this.ticketCool -= dt;
    const off = S.role === "cop" || this.jail || this.api.racing();
    // wanted: the patrol cars join the chase
    if (S.wanted > 0) { for (const c of this.patrols.slice()) { this.patrols.splice(this.patrols.indexOf(c), 1); c.mode = "chase"; this.cops.push(c); } this.pull = null; return; }
    this.patrolT -= dt;
    if (!off && !me.indoors && this.patrolT <= 0 && this.patrols.length < 2) { this.patrolT = 4; this.spawnPatrol(me); }
    for (const c of this.patrols.slice()) {
      const b = c.b, d = Math.hypot(me.x - b.x, me.z - b.z); c.life += dt;
      if (d > 420 || (off && d > 80)) { this.removePatrol(c); continue; }
      if (c.stunT > 0) c.stunT -= dt; c.stars.visible = c.stunT > 0; c.stars.rotation.y += dt * 4;
      if (c.mode === "patrol") {
        this.patrolDrive(c, dt, 21);
        if ((c.stuckCount || 0) > 4) { this.removePatrol(c); continue; }
        // speeding past a cop?
        const lim = !off && !this.pull && this.ticketCool <= 0 && me.inCar && d < 70 ? speedLimitAt(me.x, me.z) : 0;
        if (lim && this.api.onRoad() && me.speed * 2.237 > lim + 3 && sees({ x: b.x, y: b.y, z: b.z }, me)) {
          c.mode = "pull"; b.t.top = 40; this.pull = { c, t: 0, stopT: 0 }; SFX.radio(); SFX.alarm();
          this.api.toast("🚨 PULL OVER!", "You were going " + Math.round(me.speed * 2.237) + " mph in a " + lim + " zone. Stop your car and wait, or you’ll be WANTED!", "warn", 5000);
        }
      } else if (c.mode === "pull") {
        const P = this.pull; P.t += dt;
        this.aiDrive(c, me.x, me.z, dt, 9);
        if (me.inCar) this.bump(b, me.body, 1.6);
        if (me.speed < 1.5 && d < 18) P.stopT += dt; else P.stopT = Math.max(0, P.stopT - dt);
        if (P.stopT > 1.8) {
          const f = Math.min(S.money, TICKET); S.money -= f; S.stats.tickets = (S.stats.tickets || 0) + 1; this.api.bumpMoney(); SFX.nope();
          this.api.toast("🎫 Speeding ticket: -" + money(f), "“Slow down! Watch the speed limit signs: 35 in town, 55 on the highway.”", "warn", 4200);
          c.mode = "patrol"; this.pull = null; this.ticketCool = 30; this.attachRoad(c); save();
        } else if (P.t > 20 || d > 150) {
          this.pull = null; c.mode = "patrol"; this.attachRoad(c); this.api.toast("You ran from a traffic stop!", "Now the cops are after you for real!", "warn", 3600); this.setWanted(Math.max(1, S.wanted));
        }
      }
    }
  }
  // models + flying goo (every frame)
  draw(dt, time) {
    for (const c of this.patrols) { placeModel(c.b); animateCar(c.m, { speed: speedOf(c.b), steer: c.b.steer, siren: c.mode === "pull", t: time, wheelDrop: c.b.wheelDrop }, dt); }
    // the taser bolt: a jagged line that jumps around while it crackles (it follows whoever it hit)
    const B = this.bolt;
    if (B) {
      B.t += dt; const on = B.t < 0.45, tg = B.target;
      const to = tg ? (tg.kind === "robber" ? { x: tg.ref.w.x, y: tg.ref.w.y + 1, z: tg.ref.w.z } : tg.kind === "robcar" ? { x: tg.ref.car.b.x, y: tg.ref.car.b.y + 1, z: tg.ref.car.b.z } : tg.kind === "cop" ? { x: tg.ref.b.x, y: tg.ref.b.y + 1, z: tg.ref.b.z } : { x: tg.ref.x, y: tg.ref.y + 1, z: tg.ref.z }) : B.to;
      const pts = []; for (let i = 0; i < 12; i++) { const f = i / 11, j = i === 0 || i === 11 ? 0 : 0.45; pts.push(new THREE.Vector3(B.from.x + (to.x - B.from.x) * f + (Math.random() - 0.5) * j, B.from.y + (to.y - B.from.y) * f + (Math.random() - 0.5) * j, B.from.z + (to.z - B.from.z) * f + (Math.random() - 0.5) * j)); }
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3();
      for (const L of this.bolts) {
        L.visible = on; if (!on) continue;
        for (let i = 0; i < 11; i++) { d.subVectors(pts[i + 1], pts[i]); const len = d.length(); q.setFromUnitVectors(Z, d.normalize()); mid.addVectors(pts[i], pts[i + 1]).multiplyScalar(0.5); M.compose(mid, q, sc.set(L.userData.w, L.userData.w, len + L.userData.w)); L.setMatrixAt(i, M); }
        L.instanceMatrix.needsUpdate = true;
      }
      if (!on) this.bolt = null;
    }
    for (const c of this.cops) { placeModel(c.b); animateCar(c.m, { speed: speedOf(c.b), steer: c.b.steer, siren: !c.leaving || c.life < 3, t: time, wheelDrop: c.b.wheelDrop }, dt); }
    if (this.call) { const r = this.call.robber; if (r.state === "fleeing" || r.state === "robbing") { placeModel(r.car.b); animateCar(r.car.m, { speed: speedOf(r.car.b), steer: r.car.b.steer, wheelDrop: r.car.b.wheelDrop }, dt); r.stars.rotation.y += dt * 4; } }
    const M = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    const Z = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3();
    for (const s of this.shots) { const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, len = Math.min(3.2, sp * 0.018); dir.set(s.vx / sp, s.vy / sp, s.vz / sp); q.setFromUnitVectors(Z, dir); M.compose(v.set(s.x - dir.x * len / 2, s.y - dir.y * len / 2, s.z - dir.z * len / 2), q, sc.set(0.045, 0.045, len)); this.shotMesh.setMatrixAt(n, M); this.shotMesh.setColorAt(n, col.set(s.color)); n++; }
    q.identity();
    this.shotMesh.count = n; this.shotMesh.instanceMatrix.needsUpdate = true; if (this.shotMesh.instanceColor) this.shotMesh.instanceColor.needsUpdate = true;
    n = 0;
    for (const s of this.splats) { const k = Math.min(1, s.life / 2); M.compose(v.set(s.x, s.y, s.z), q, sc.set(s.r * k, 1, s.r * k)); this.splatMesh.setMatrixAt(n, M); this.splatMesh.setColorAt(n, col.set(s.color)); n++; }
    this.splatMesh.count = n; this.splatMesh.instanceMatrix.needsUpdate = true; if (this.splatMesh.instanceColor) this.splatMesh.instanceColor.needsUpdate = true;
    n = 0;
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.life -= dt; if (f.life <= 0) { this.flashes.splice(i, 1); continue; } q.setFromAxisAngle(Z, Math.random() * 6); M.compose(v.set(f.x, f.y, f.z), q, sc.setScalar(f.r * (0.7 + Math.random() * 0.6))); this.flashMesh.setMatrixAt(n, M); this.flashMesh.setColorAt(n, col.set(i % 2 ? 0xffd060 : 0xffa030)); n++; }
    this.flashMesh.count = n; this.flashMesh.instanceMatrix.needsUpdate = true; if (this.flashMesh.instanceColor) this.flashMesh.instanceColor.needsUpdate = true;
  }
  // what to show on the HUD
  hud() {
    const r = this.call && this.call.robber;
    return {
      headStart: this.headStart > 0 ? Math.ceil(this.headStart) : 0, wanted: S.wanted, evade: S.wanted ? clamp(this.evadeT / (6 + S.wanted * 2), 0, 1) : 0, hidden: this.hidden, loot: S.loot, cap: lootCap(),
      jail: this.jail, ko: !!this.ko, call: this.call ? { what: this.call.what, state: r.state } : null,
      target: this.call ? (r.state === "carried" || r.state === "cuffed" ? { x: PLACES.police.x, z: PLACES.police.z } : r.state === "fleeing" ? { x: r.car.b.x, z: r.car.b.z } : { x: r.w.x, z: r.w.z }) : null,
    };
  }
  // test helpers
  clearAll() { for (const c of this.cops.slice()) this.removeCop(c); for (const c of this.patrols.slice()) this.removePatrol(c); this.pull = null; this.endCall(true); this.setWanted(0); }
}
