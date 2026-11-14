// MUD VALLEY RP: jobs = how you make money! Pick one at the Job Center (or on your phone),
// drive to the pickup, then drop it off. Faster = bonus cash. No crashes = more bonus cash.
import { PLACES, ADDRESSES, HOUSES } from "./layout.js";

const P = (id) => ({ id, name: PLACES[id].name, x: PLACES[id].x, z: PLACES[id].z });
const SPOTS = {
  post: P("post"), pizza: P("pizza"), jobs: P("jobs"), diner: P("diner"), townhall: P("townhall"),
  ranger: P("ranger"), farm: P("farm"), lumber: P("lumber"), build: P("build"), camp: P("camp"), moto: P("moto"), speedway: P("speedway"),
  dock: { id: "dock", name: "Fishing Dock", x: 134, z: -40 }, customs: { id: "customs", name: "Mud & Chrome Customs", x: 36, z: -18 },
};
const HOMES = HOUSES.filter((h) => h.id !== "lot").map((h) => ({ id: h.id, name: h.name, x: h.garage.x, z: h.garage.z }));
const ADDR = ADDRESSES.map((a) => ({ ...a }));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const round5 = (n) => Math.round(n / 5) * 5;

// every kind of job. needs: "tow" = a truck that can tow, "trailer" = a trailer hitched to you
export const JOB_TYPES = {
  delivery: { name: "Package Delivery", icon: "📦", color: "#c08a50", base: 90, perM: 0.5, timeK: 1, desc: "Grab a package at the Post Office and drop it off.",
    make: () => ({ from: SPOTS.post, to: pick([...ADDR, ...HOMES, SPOTS.diner, SPOTS.farm, SPOTS.camp, SPOTS.ranger, SPOTS.build]) }) },
  pizza: { name: "Pizza Delivery", icon: "🍕", color: "#ff5a3a", base: 110, perM: 0.55, timeK: 0.78, desc: "Hot pizza! Deliver it fast. (Extra tips on a dirt bike or ATV!)",
    make: () => ({ from: SPOTS.pizza, to: pick([...ADDR, ...HOMES, SPOTS.moto, SPOTS.speedway, SPOTS.dock]) }) },
  taxi: { name: "Taxi Ride", icon: "🚕", color: "#ffd23a", base: 100, perM: 0.65, timeK: 1, desc: "Pick someone up and drive them where they want to go. Smooth ride = bigger tip!",
    make: () => { const all = [...ADDR, SPOTS.diner, SPOTS.townhall, SPOTS.jobs, SPOTS.moto, SPOTS.speedway, SPOTS.farm, SPOTS.dock, ...HOMES]; const a = pick(all); let b = pick(all); while (b === a) b = pick(all); return { from: a, to: b }; } },
  tow: { name: "Tow Truck Job", icon: "🪝", color: "#ff8a1a", base: 300, perM: 0.75, timeK: 1.25, needs: "tow", desc: "A car broke down! Drive a truck to it, press T to hook it up, and tow it to Mud & Chrome Customs.",
    make: (api) => ({ from: api.roadsideSpot(), to: SPOTS.customs }) },
  haul: { name: "Hauling Job", icon: "🚛", color: "#7ad04a", base: 380, perM: 0.95, timeK: 1.3, needs: "trailer", desc: "Load up your trailer and haul the cargo. The best paying job!",
    make: () => { const from = pick([SPOTS.lumber, SPOTS.farm, SPOTS.build]); const to = pick([SPOTS.build, SPOTS.ranger, SPOTS.camp, SPOTS.townhall, SPOTS.moto, SPOTS.farm, SPOTS.lumber].filter((s) => s !== from)); return { from, to, cargo: from === SPOTS.lumber ? "logs" : from === SPOTS.farm ? "hay" : "crates" }; } },
  supply: { name: "Mountain Supply Run", icon: "⛰️", color: "#5ad87a", base: 320, perM: 0.6, timeK: 1.5, desc: "The Ranger Station on top of the mountain needs supplies. Off-road vehicles recommended!",
    make: () => ({ from: SPOTS.jobs, to: pick([SPOTS.ranger, SPOTS.ranger, SPOTS.camp]) }) },
};

export class Jobs {
  constructor(api) { this.api = api; this.offers = []; this.active = null; this.refill(); }
  makeOffer(type) {
    const T = JOB_TYPES[type], o = T.make(this.api), d = dist(o.from, o.to) * 1.25 + 40;
    return { type, ...o, pay: round5(T.base + d * T.perM), time: Math.round((d / 13 + 35) * T.timeK + (type === "supply" ? 40 : 0)), dist: Math.round(d) };
  }
  refill() {
    const want = ["delivery", "pizza", "taxi"];
    const rest = Object.keys(JOB_TYPES);
    while (this.offers.length < 6) {
      const have = this.offers.map((o) => o.type);
      const t = want.find((w) => !have.includes(w)) || pick(rest.filter((r) => have.filter((h) => h === r).length < 2));
      this.offers.push(this.makeOffer(t));
    }
  }
  // can you do this job right now? (returns a reason if not)
  blocked(o) {
    const T = JOB_TYPES[o.type];
    if (T.needs === "tow" && !this.api.canTow()) return "Needs a truck that can tow (Pickup, 4x4, Hauler or Monster Truck)";
    if (T.needs === "trailer" && !this.api.trailer()) return "Hitch a trailer to your truck first (press T near it)";
    return null;
  }
  take(i) {
    const o = this.offers[i]; if (!o || this.active) return false;
    const why = this.blocked(o); if (why) { this.api.toast("Can't take that job", why, "warn"); return false; }
    this.offers.splice(i, 1);
    this.active = { ...o, stage: 0, t: 0, crashes: 0, late: false, T: JOB_TYPES[o.type] };
    this.api.started(this.active);
    this.refill();
    return true;
  }
  cancel() { if (!this.active) return; this.api.ended(this.active, false); this.active = null; }
  target() { const j = this.active; return j ? (j.stage === 0 ? j.from : j.to) : null; }
  crash() { if (this.active && this.active.stage > 0) this.active.crashes++; }
  update(dt) {
    const j = this.active; if (!j) return;
    if (j.stage > 0) { j.t += dt; if (!j.late && j.t > j.time) { j.late = true; this.api.toast("Time's up!", "Finish anyway: you still get half pay.", "warn"); } }
    const tg = this.target(), pos = this.api.pos(), b = this.api.body();
    const near = dist(pos, tg) < (j.type === "tow" && j.stage === 0 ? 12 : 7.5), slow = !b || Math.hypot(b.vx, b.vz) < 5;
    if (j.stage === 0) {
      if (j.type === "tow") { if (this.api.towHooked()) this.pickedUp(); return; }
      if (!near || !slow || !b) return;
      if (j.type === "haul") { const tr = this.api.trailer(); if (!tr) { this.api.hint("You need a trailer hitched to pick up cargo!"); return; } if (tr.loaded.length) { this.api.hint("Unload the vehicles from your trailer first!"); return; } }
      this.pickedUp();
    } else if (near && slow && b) {
      if (j.type === "tow" && !this.api.towHooked()) return;
      if (j.type === "haul" && !(this.api.trailer() && this.api.trailer().cargo)) return;
      this.finish();
    }
  }
  pickedUp() { const j = this.active; j.stage = 1; j.t = 0; this.api.pickedUp(j); }
  finish() {
    const j = this.active, base = j.pay;
    let pay = j.late ? Math.round(base / 2) : base;
    const bonus = [];
    if (!j.late) { const b = round5(base * 0.3 * Math.max(0, 1 - j.t / j.time)); if (b > 0) { bonus.push(["Speed bonus", b]); pay += b; } }
    if (j.crashes === 0) { const b = round5(base * 0.15); bonus.push([j.type === "taxi" ? "Smooth ride tip" : "No crashes", b]); pay += b; }
    if (j.type === "pizza" && ["bike", "atv", "bike450", "sportquad", "bigquad", "pitbike", "bike125", "sport300", "super1000"].includes(this.api.vehicleId())) { const b = round5(base * 0.25); bonus.push(["Bike tip", b]); pay += b; }
    this.active = null;
    this.api.ended(j, true, pay, bonus);
  }
}
