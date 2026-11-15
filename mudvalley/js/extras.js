// MUD VALLEY RP: the newer stuff, all in one place.
//  - dirt bike + quad air tricks (1 Superman, 2 Whip, 3 Backflip, 4 Can-Can, 5 Front Flip) with combos + cash
//  - the front bumper winch (J): hooks a tree / rock / pole and pulls you out of the mud
//  - headlights + light bars (L), on by themselves when it gets dark
//  - lawn mowers that really cut the grass (B = blades), and you get paid for it
//  - the skid steer bucket + the excavator digging (T)
//  - the day + night clock and the country radio (N)
import * as THREE from "/create/vendor/three.module.js";
import { vehicleById } from "./vehicles.js";
import { canWinch } from "./mods.js";
import { near } from "./colliders.js";
import { groundAt, SURF } from "./terrain.js";
import { SFX } from "./sfx.js";
import { Grass } from "./grass.js";
import { Radio } from "./radio.js";

export const TRICKS = {
  Digit1: { name: "SUPERMAN", dur: 0.9, cash: 60 },
  Digit2: { name: "WHIP", dur: 0.75, cash: 40 },
  Digit3: { name: "BACKFLIP", dur: 1.15, cash: 150 },
  Digit4: { name: "CAN-CAN", dur: 0.8, cash: 50 },
  Digit5: { name: "FRONT FLIP", dur: 1.25, cash: 200 },
};
export const DAY_SEC = 1080; // one whole day = 18 minutes of play (nights go by faster)
const ease = (p) => p * p * (3 - 2 * p);
const UP = new THREE.Vector3(0, 1, 0);

export class Extras {
  // api: { toast, pay, bumpMoney, money, fx, S, save, low, inRace, radioText }
  constructor(scene, api) {
    this.scene = scene; this.api = api;
    this.grass = new Grass(scene, api.low);
    this.radio = new Radio((song, st) => {
      if (song.dj) api.toast("📻 " + st.name, song.dj, "", 3800);
      setTimeout(() => { if (this.radio.song === song) api.toast("📻 Now playing", "“" + song.title + "” · " + song.artist, "", 3200); }, song.dj ? 4000 : 0);
      api.radioText("📻 " + st.name + " · " + song.title);
    });
    // headlights: one bright spotlight that rides on the front of whatever you drive
    this.spot = new THREE.SpotLight(0xfff4e0, 0, 90, 0.55, 0.55, 1); this.spotT = new THREE.Object3D();
    this.spot.target = this.spotT; scene.add(this.spot, this.spotT); this.lightsUser = null; this.lit = false;
    // the winch cable
    const cg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.cable = new THREE.Line(cg, new THREE.LineBasicMaterial({ color: 0x1a1a1a })); this.cable.visible = false; this.cable.frustumCulled = false; scene.add(this.cable);
    this.winch = null; this.trick = null; this.combo = []; this.mowed = 0; this.mowSnd = 0; this.dark = 0; this.whirT = 0;
  }
  // ---------------------------------------------------------------- the clock
  clock(dt) {
    const S = this.api.S; if (S.tod == null) S.tod = 0.33;
    if ((S.dayMode || 0) === 1) S.tod = 0.46; else if (S.dayMode === 2) S.tod = 0.0;
    else { const night = S.tod < 0.22 || S.tod > 0.8; S.tod = (S.tod + (dt / DAY_SEC) * (night ? 2.2 : 1)) % 1; }
    return S.tod;
  }
  timeText() { const S = this.api.S, m = Math.floor((S.tod ?? 0.33) * 24 * 60), h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + (h < 12 ? " AM" : " PM"); }
  // ---------------------------------------------------------------- keys (call once per tick)
  keys(pressed, c) {
    const api = this.api;
    if (pressed("KeyN")) { const s = this.radio.cycle(); if (s === null && this.radio.on < 0) api.toast("📻 Radio off", "", "", 1200); }
    if (pressed("KeyL")) { this.lightsUser = !this.lit; SFX.lights(); api.toast(this.lightsUser ? "💡 Lights ON" : "Lights off", "", "", 1100); }
    if (!c) return;
    const v = vehicleById(c.s.id), b = c.b;
    if (pressed("KeyB")) {
      if (v.mower) { c.blades = !c.blades; SFX.click(); api.toast(c.blades ? "🌱 Blades ON" : "Blades off", c.blades ? "Drive over the grass to mow it. You get paid for every lawn!" : "", c.blades ? "good" : "", 2200); }
      else SFX.nope();
    }
    if (pressed("KeyJ")) { if (this.winch) this.stopWinch("Winch off"); else this.startWinch(c, v); }
    for (const k in TRICKS) if (pressed(k)) this.startTrick(c, v, k);
    if (pressed("Digit9")) { const ks = Object.keys(TRICKS); this.startTrick(c, v, ks[Math.floor(Math.random() * ks.length)]); }
  }
  // ---------------------------------------------------------------- after the car moved this tick
  tick(dt, c, cam) {
    const api = this.api;
    if (this.winch && (!c || c !== this.winch.c)) this.stopWinch();
    if (!c) { this.trick = null; return; }
    const v = vehicleById(c.s.id), b = c.b;
    // ---- tricks
    this.stepTrick(dt, c, b);
    // ---- winch pull
    if (this.winch) {
      const W = this.winch, dx = W.x - b.x, dz = W.z - b.z, d = Math.hypot(dx, dz); W.t += dt;
      if (d < 4.2 || W.t > 20) this.stopWinch(d < 4.2 ? "🪝 Winched out!" : "Winch off");
      else {
        const k = Math.min(1, dt * 4), sp = 4.2; b.vx += (dx / d * sp - b.vx) * k; b.vz += (dz / d * sp - b.vz) * k;
        if (b.flipped) b.flipped = false;
        let ty = Math.atan2(dx, dz) - b.yaw; ty = Math.atan2(Math.sin(ty), Math.cos(ty)); if (Math.abs(ty) < 1.4) b.yaw += ty * Math.min(1, dt * 0.8);
        this.whirT -= dt; if (this.whirT <= 0) { this.whirT = 0.24; SFX.winch(); }
      }
    }
    // ---- mowing
    if (v.mower && c.blades && !b.air && c.m.deck) {
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), x = b.x + fx * c.m.deck.z, z = b.z + fz * c.m.deck.z;
      const lvl = c.s.cut ?? (c.s.id === "mudmower" || c.s.id === "racemower" ? 0 : 1);
      const a = this.grass.mow(x, z, b.yaw, c.m.deck.w, lvl);
      if (a > 0) {
        this.mowed += a; if (Math.random() < 0.6) api.fx.dust(x - fx * 0.6 + Math.cos(b.yaw) * 0.7, b.y + 0.2, z - fz * 0.6 - Math.sin(b.yaw) * 0.7, 1, lvl >= 3 ? 0x8a6a40 : 0x7ac04a, 0.35);
        if (this.mowed >= 40 && !api.inRace()) { const cash = Math.floor(this.mowed / 4); this.mowed -= cash * 4; api.pay(cash); api.bumpMoney(); api.toast("🌱 Fresh cut!", "+" + api.money(cash) + " for mowing. Nice stripes!", "cash", 1800); api.S.stats.mowed = (api.S.stats.mowed || 0) + cash * 4; }
      }
      this.mowSnd -= dt; if (this.mowSnd <= 0) { this.mowSnd = 0.2; SFX.mow(); }
    }
    // ---- heavy equipment: dirt flies when the excavator digs
    if (c.dig && c.m.bucket && Math.random() < dt * 3) { const p = c.m.bucket.getWorldPosition(new THREE.Vector3()); if (p.y < groundAt(p.x, p.z) + 0.8) api.fx.dust(p.x, p.y, p.z, 3, 0x8a6a40, 0.5); }
  }
  // ---------------------------------------------------------------- air tricks
  startTrick(c, v, k) {
    const b = c.b;
    if (!(v.bike || v.quad) || this.trick || b.flipped) return;
    if (!b.air || b.airT < 0.1) { this.api.toast("Tricks are for the air!", "Hit a jump, then press 1-5 while you fly.", "", 1600); return; }
    this.trick = { k, ...TRICKS[k], t: 0 }; SFX.jump();
  }
  stepTrick(dt, c, b) {
    const T = this.trick;
    if (T) {
      T.t += dt; const p = Math.min(1, T.t / T.dur);
      b.tPitch = T.k === "Digit3" ? ease(p) * Math.PI * 2 : T.k === "Digit5" ? -ease(p) * Math.PI * 2 : 0;
      b.tYaw = T.k === "Digit2" ? Math.sin(Math.PI * p) * 0.9 : 0; b.tRoll = T.k === "Digit2" ? Math.sin(Math.PI * p) * 0.75 : 0;
      if (!b.air) { // landed in the middle of a trick
        if (p < 0.86) { this.bail(c, b); return; }
        this.combo.push(T); this.trick = null;
      } else if (p >= 1) { this.combo.push(T); this.trick = null; SFX.trick(); this.api.toast("✅ " + T.name + "!", this.combo.length > 1 ? "COMBO x" + this.combo.length : "Now stick the landing!", "good", 900); }
    }
    if (!this.trick) { b.tPitch = 0; b.tYaw = 0; b.tRoll = 0; }
    if (!b.air && this.combo.length && !this.trick) {
      const list = this.combo; this.combo = [];
      if (b.flipped) return;
      const n = list.length, cash = Math.round(list.reduce((s, q) => s + q.cash, 0) * (1 + 0.5 * (n - 1)));
      if (!this.api.inRace()) { this.api.pay(cash); this.api.bumpMoney(); }
      this.api.toast("🤘 " + list.map((q) => q.name).join(" + "), (n > 1 ? "x" + n + " COMBO! " : "Landed it! ") + (this.api.inRace() ? "" : "+" + this.api.money(cash)), "cash", 2600);
      SFX.air(); this.api.S.stats.tricks = (this.api.S.stats.tricks || 0) + n;
    }
  }
  bail(c, b) {
    this.trick = null; this.combo = []; b.tPitch = b.tYaw = b.tRoll = 0; b.flipped = true; b.pitch = 0.4; b.roll = 1.2;
    SFX.bail(); this.api.toast("💥 BAILED!", "Finish the trick before you land. Press R to get back up.", "warn", 2200);
  }
  hint(c) {
    if (!c) return null;
    const v = vehicleById(c.s.id), b = c.b;
    if ((v.bike || v.quad) && b.air && b.airT > 0.1 && !b.flipped) return this.trick ? "🤸 " + this.trick.name + "..." : "TRICK! 1 Superman · 2 Whip · 3 Backflip · 4 Can-Can · 5 Front Flip";
    return null;
  }
  // ---------------------------------------------------------------- winch
  startWinch(c, v) {
    const api = this.api;
    if (!canWinch(v) || !c.s.winch) { SFX.nope(); api.toast("No winch", v.bike || v.mower ? "This ride can't have a winch." : "Bolt one on at Mud & Chrome (🔦 tab).", "warn", 2200); return; }
    const b = c.b, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); let best = null, bs = 1e9;
    for (const o of near(b.x, b.z, 32)) {
      const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz); if (d < 4.5 || d > 32) continue;
      const f = (dx * fx + dz * fz) / d, s = d * (f > 0.3 ? 1 : 2.2) * (o.box ? 1.6 : 1);
      if (s < bs) { bs = s; best = o; }
    }
    if (!best) { SFX.nope(); api.toast("Nothing to hook onto", "Get within 30 m of a tree, a rock or a pole, then press J.", "warn", 2400); return; }
    this.winch = { c, x: best.x, z: best.z, y: groundAt(best.x, best.z) + 0.9, t: 0 }; SFX.hitch();
    api.toast("🪝 Winch hooked!", "Pulling you out... J = let go", "good", 2000);
  }
  stopWinch(msg) { if (!this.winch) return; this.winch = null; this.cable.visible = false; if (msg) { SFX.hitch(); this.api.toast(msg, "", "good", 1400); } }
  // T on heavy equipment
  heavyT(c) {
    if (c.s.id === "skidsteer") { c.armUp = !c.armUp; SFX.hitch(); }
    else { c.dig = !c.dig; SFX.click(); }
  }
  // ---------------------------------------------------------------- every frame
  draw(dt, c, camPos, t, showGrass) {
    this.grass.update(dt, camPos.x, camPos.z, showGrass);
    // lights
    const auto = this.dark > 0.45, want = this.lightsUser ?? auto;
    if (this.lightsUser != null && auto === this.lightsUser) this.lightsUser = null; // (back to automatic once it matches)
    this.lit = !!want;
    for (const v of [c]) if (v && v.m.ledMat) v.m.ledMat.color.setHex(this.lit ? 0xffffff : 0x8a8e96);
    if (c && this.lit) {
      const b = c.b, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), L = c.m.len / 2, bar = c.m.lightbar && c.m.lightbar.length;
      this.spot.position.set(b.x + fx * (L + 0.2), b.y + 1.0, b.z + fz * (L + 0.2));
      this.spotT.position.set(b.x + fx * (L + 22), groundAt(b.x + fx * (L + 22), b.z + fz * (L + 22)), b.z + fz * (L + 22));
      this.spot.angle = bar ? 0.85 : 0.55; this.spot.intensity = (bar ? 900 : 520) * Math.max(0.25, this.dark); this.spot.distance = bar ? 110 : 80;
    } else this.spot.intensity = 0;
    if (!c) { this.cable.visible = false; return; }
    const M = c.m;
    // winch cable
    if (this.winch && M.winchAt) {
      const a = M.body.localToWorld(M.winchAt.clone()), p = this.cable.geometry.attributes.position;
      p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, this.winch.x, this.winch.y, this.winch.z); p.needsUpdate = true; this.cable.visible = true;
    }
    // trick poses for the rider
    const R = M.rider;
    if (R) {
      if (!M.riderBase) M.riderBase = { p: R.root.position.clone(), rx: R.root.rotation.x, ry: R.root.rotation.y, rz: R.root.rotation.z };
      const B = M.riderBase, T = this.trick, p = T ? Math.min(1, T.t / T.dur) : 0, s = T ? Math.sin(Math.PI * p) : 0;
      R.root.position.copy(B.p); R.root.rotation.set(B.rx, B.ry, B.rz);
      if (T && T.k === "Digit1") { R.root.position.y += 0.35 * s; R.root.position.z -= 0.55 * s; R.root.rotation.x = B.rx + 1.3 * s; }
      if (T && T.k === "Digit4") { R.root.position.x += 0.3 * s; R.root.rotation.z = B.rz + 0.7 * s; }
    }
    // heavy equipment
    const k = Math.min(1, dt * 3);
    if (M.arm) { M.arm.rotation.x += ((c.armUp ? -0.95 : 0) - M.arm.rotation.x) * k; if (M.bucket) M.bucket.rotation.x += ((c.armUp ? 0.55 : 0) - M.bucket.rotation.x) * k; }
    if (M.boom) {
      c.digT = (c.digT || 0) + (c.dig ? dt : 0); const d = c.digT, on = c.dig ? 1 : 0;
      M.upper.rotation.y += ((on ? Math.sin(d * 0.45) * 1.1 : 0) - M.upper.rotation.y) * k;
      M.boom.rotation.x += ((on ? -0.25 + Math.sin(d * 1.3) * 0.35 : 0) - M.boom.rotation.x) * k;
      M.stick.rotation.x += ((on ? Math.sin(d * 1.3 + 1) * 0.55 : 0) - M.stick.rotation.x) * k;
      M.bucket.rotation.x += ((on ? Math.sin(d * 1.3 + 2) * 0.8 : 0) - M.bucket.rotation.x) * k;
      if (R && M.riderBase) { const q = M.riderBase.p.clone().sub(M.upper.position).applyAxisAngle(UP, M.upper.rotation.y).add(M.upper.position); R.root.position.copy(q); R.root.rotation.y = M.riderBase.ry + M.upper.rotation.y; }
    }
    if (M.whipFlag) M.whipFlag.rotation.y = Math.PI / 2 + Math.sin(t * 9) * 0.35;
  }
  radioText() { const st = this.radio.station; return st && this.radio.song ? "📻 " + st.name + " · " + this.radio.song.title : ""; }
}
