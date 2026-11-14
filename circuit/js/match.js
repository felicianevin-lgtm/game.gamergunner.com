// CIRCUIT SIEGE: playing a match. Draws the map (a floating black platform with a glowing path from the enemy portal
// to your core), the robots and towers from sim.js, shots and explosions, and the match HUD: cash, wave, core health,
// your tower cards, the tower panel (upgrade / sell / targeting) and the stats screen at the end.
// With friends: every command goes to the match host, who stamps it with a step number (relay "tdx"); everybody's sim
// applies it on that same step, so all the games stay the same. The host also sends its step ("tdt") so you keep up.
import * as THREE from "/create/vendor/three.module.js";
import { mapById, towerById, ENEMIES, RARITIES, PATH_W, UP_COST, matchBolts } from "./data.js";
import { Sim, TICK, statsOf } from "./sim.js";
import { towerModel, enemyModel, setPips, mat, box, cyl, label, VIS } from "./models.js";
import { S, fmt } from "./save.js";
import { SFX } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LEAD = 8; // the host applies commands this many steps later (so they reach everyone in time)

export class Match {
  // o: { renderer, camera, map, seed, ids, me, conn (null = alone), names {id: name}, done(result) }
  constructor(o) {
    this.o = o; this.M = mapById(o.map); this.me = o.me; this.conn = o.conn; this.names = o.names || {};
    this.sim = new Sim(this.M, o.seed, o.ids);
    this.scene = new THREE.Scene(); this.camera = o.camera;
    this.pending = new Map(); this.hostT = 0; this.hostAt = performance.now(); this.acc = 0; this.hostHash = new Map();
    this.towerM = new Map(); this.enemyM = new Map(); this.fx = []; this.sel = null; this.placing = null; this.ended = false; this.desync = false;
    this.cam = { x: 0, z: 4, yaw: 0, dist: 46, pitch: 0.95 };
    this.build(); this.hud();
  }
  get solo() { return !this.conn; }
  get host() { return this.solo || this.conn.isHost; }
  // ---------------------------------------------------------------- the 3D map
  build() {
    const sc = this.scene, M = this.M, [hx, hz] = M.size, col = M.color;
    sc.background = new THREE.Color(0x020604); sc.fog = new THREE.Fog(0x020604, 90, 190);
    sc.add(new THREE.HemisphereLight(0x9affc0, 0x0a1a10, 1.2)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(20, 40, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 }); sun.shadow.camera.updateProjectionMatrix(); sc.add(sun);
    // the floor: black tiles with a glowing grid
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#0b100d"; g.fillRect(0, 0, 64, 64); g.strokeStyle = "rgba(58,255,106,0.22)"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(hx, hz); t.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 1, hz * 2), [mat(0x16191c), mat(0x16191c), new THREE.MeshLambertMaterial({ map: t }), mat(0x16191c), mat(0x16191c), mat(0x16191c)]);
    floor.position.y = -0.5; floor.receiveShadow = true; sc.add(floor); this.floor = floor;
    for (const [x, z, w, d] of [[0, hz, hx * 2, 0.2], [0, -hz, hx * 2, 0.2], [hx, 0, 0.2, hz * 2], [-hx, 0, 0.2, hz * 2]]) box(sc, w, 0.15, d, x, 0.02, z, mat(col, true)); // glowing edge
    box(sc, hx * 1.6, 6, hz * 1.6, 0, -4, 0, mat(0x0c0e10)); // (the underside)
    // the path: a glowing strip along every segment, with round joints
    const P = this.sim.P;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], l = Math.hypot(b.x - a.x, b.z - a.z);
      const s = box(sc, PATH_W, 0.05, l, (a.x + b.x) / 2, 0.02, (a.z + b.z) / 2, mat(0x10261a)); s.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); s.receiveShadow = true;
      for (const o of [-1, 1]) { const e = box(sc, 0.12, 0.07, l, (a.x + b.x) / 2 + Math.cos(s.rotation.y) * o * PATH_W / 2, 0.03, (a.z + b.z) / 2 - Math.sin(s.rotation.y) * o * PATH_W / 2, mat(col, true)); e.rotation.y = s.rotation.y; }
    }
    for (const p of P) cyl(sc, PATH_W / 2, 0.05, p.x, 0.02, p.z, mat(0x10261a), 16);
    this.arrows = []; for (let d = 2; d < this.sim.len; d += 4) { const p = this.sim.at(d), q = this.sim.at(d + 0.5), a = box(sc, 0.5, 0.06, 0.18, p.x, 0.06, p.z, mat(col, true)); a.rotation.y = Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2; this.arrows.push(a); }
    // the robot portal (start) + your core (end)
    const s0 = P[0], s1 = P[P.length - 1];
    const portal = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 8, 32), mat(0xff3a3a, true)); portal.position.set(s0.x, 2.4, s0.z); portal.rotation.y = Math.atan2(P[1].x - s0.x, P[1].z - s0.z); sc.add(portal); this.portal = portal;
    const inner = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0x400010, side: THREE.DoubleSide })); portal.add(inner);
    this.core = new THREE.Group(); this.core.position.set(s1.x, 0, s1.z); sc.add(this.core);
    cyl(this.core, 2.4, 0.6, 0, 0.3, 0, mat(0x1a1d22), 8); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), mat(col, true)); cr.position.y = 2.6; this.core.add(cr); this.crystal = cr;
    for (let i = 0; i < 4; i++) { const p = box(this.core, 0.3, 2.4, 0.3, Math.cos(i * 1.57) * 2, 1.2, Math.sin(i * 1.57) * 2, mat(0x3a3f46)); p.castShadow = true; }
    const lb = label(this.M.name.toUpperCase(), "#" + col.toString(16).padStart(6, "0"), 10, "rgba(0,0,0,0.5)"); lb.position.set(0, 12, -hz - 4); sc.add(lb);
    // the void: floating cubes
    for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, d = 70 + Math.random() * 80, s = 1 + Math.random() * 4, b = box(sc, s, s, s, Math.cos(a) * d, -30 + Math.random() * 50, Math.sin(a) * d, mat(Math.random() < 0.75 ? 0x0f2a18 : col, Math.random() < 0.3)); b.rotation.set(Math.random(), Math.random(), 0); }
    // where you're about to place a tower: a see-through copy + its range circle
    this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0x3aff6a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); this.rangeRing.rotation.x = -Math.PI / 2; this.rangeRing.position.y = 0.08; this.rangeRing.visible = false; sc.add(this.rangeRing);
    this.rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x3aff6a, transparent: true, opacity: 0.08, depthWrite: false })); this.rangeFill.rotation.x = -Math.PI / 2; this.rangeFill.position.y = 0.07; this.rangeFill.visible = false; sc.add(this.rangeFill);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }
  // ---------------------------------------------------------------- the HUD
  hud() {
    const h = $("mhud"); h.classList.remove("hidden");
    h.innerHTML = `<div id="mTop"><div class="mStat"><small>WAVE</small><b id="mWave">0</b></div><div class="mStat"><small>CORE</small><div id="mBase"><i></i><span></span></div></div><div class="mStat"><small>CASH</small><b id="mCash">$0</b></div><div class="mStat"><small>KILLS</small><b id="mKills">0</b></div></div>
      <div id="mMsg"></div><div id="mBossBar" class="hidden"><b id="mBossName"></b><div><i></i></div></div>
      <div id="mPlayers"></div>
      <div id="mBar"><div id="mCards"></div><button type="button" id="mSkip">▶ START</button></div>
      <div id="mPanel" class="hidden"></div><div id="mTip">Click a tower card, then click the floor to build it · WASD/arrows move the camera · Q/E turn · mouse wheel zoom · Esc cancels</div>`;
    const lo = S.loadout.length ? S.loadout : ["bolt"];
    $("mCards").innerHTML = lo.map((id, i) => { const T = towerById(id), R = RARITIES[T.r]; return `<button type="button" class="mCard" data-w="${id}" style="--rc:${R.color}"><i>${i + 1}</i><b>${esc(T.name)}</b><small>${R.name}</small><em>$${fmt(T.cost)}</em><u></u></button>`; }).join("");
    $("mCards").onclick = (e) => { const b = e.target.closest(".mCard"); if (b) this.pick(b.dataset.w); };
    $("mSkip").onclick = () => this.cmd({ a: "k" });
  }
  pick(id) { if (this.ended) return; if (this.placing === id) { this.cancel(); return; } this.cancel(); this.placing = id; SFX.click(); const m = towerModel(id); m.root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } }); this.ghost = m; this.scene.add(m.root); }
  cancel() { this.placing = null; if (this.ghost) { this.scene.remove(this.ghost.root); this.ghost = null; } this.select(null); }
  select(t) { this.sel = t; if (!t) { $("mPanel").classList.add("hidden"); } else this.panel(); }
  panel() {
    const t = this.sim.towers.find((q) => q.u === this.sel); if (!t) { this.select(null); return; }
    const T = towerById(t.id), R = RARITIES[T.r], S0 = statsOf(T, t.lv), mine = t.o === this.me, up = t.lv < 3 ? Math.round(T.cost * UP_COST[t.lv]) : 0, cash = (this.sim.players[this.me] || {}).cash || 0;
    const key = [t.u, t.lv, t.mode, Math.floor(cash / 10), mine].join(); if (this.panelKey === key && !$("mPanel").classList.contains("hidden")) return; this.panelKey = key;
    $("mPanel").classList.remove("hidden");
    $("mPanel").innerHTML = `<h3 style="color:${R.color}">${esc(T.name)} <small>${R.name} · Level ${t.lv + 1}</small></h3><p>${esc(T.desc)}</p>
      <div class="mSt"><span>💥 ${S0.dmg.toFixed(1)} dmg</span><span>🎯 ${S0.rng.toFixed(1)} range</span><span>⚡ ${S0.rate.toFixed(2)}/s</span></div>
      ${mine ? `<div class="mBtns">${t.lv < 3 ? `<button type="button" data-a="u" ${cash >= up ? "" : "disabled"}>⬆ Upgrade $${fmt(up)}</button>` : `<button type="button" disabled>⭐ MAX</button>`}<button type="button" data-a="s">💲 Sell $${fmt(Math.round(t.spent * 0.6))}</button></div>
      <div class="mBtns small">${["first", "last", "strong", "close"].map((m) => `<button type="button" data-a="m" data-m="${m}" class="${t.mode === m ? "on" : ""}">${{ first: "First", last: "Last", strong: "Strongest", close: "Closest" }[m]}</button>`).join("")}</div>` : `<p class="mNote">Built by ${esc(this.names[t.o] || "a friend")}</p>`}`;
    $("mPanel").onclick = (e) => { const b = e.target.closest("button[data-a]"); if (!b || b.disabled) return; const a = b.dataset.a; this.cmd(a === "m" ? { a, i: t.u, m: b.dataset.m } : { a, i: t.u }); if (a === "s") this.select(null); this.panelKey = ""; };
  }
  // ---------------------------------------------------------------- commands
  cmd(c, devCode) {
    if (this.ended) return;
    if (this.solo) { this.schedule(this.sim.tick + 1, { ...c, o: this.me }); return; }
    this.conn.send({ t: "tdc", c, ...(devCode ? { dc: devCode } : {}) });
  }
  schedule(T, c) { if (!this.pending.has(T)) this.pending.set(T, []); this.pending.get(T).push(c); }
  // messages from the match room
  onMsg(m) {
    if (m.t === "tdc" && this.host) { const T = Math.max(this.sim.tick + LEAD, this.lastT || 0); this.lastT = T; this.conn.send({ t: "tdx", T, c: m.c }); }
    else if (m.t === "tdx") { if (this.hold > 0 && m.T === 1 && m.c.a === "join") this.hold--; if (m.T <= this.sim.tick) { this.lateFix(m); } else this.schedule(m.T, m.c); }
    else if (m.t === "tdt") { this.hostT = m.T; this.hostAt = performance.now(); if (m.h) { this.hostHash.set(m.T, m.h); if (this.hostHash.size > 60) this.hostHash.delete(this.hostHash.keys().next().value); } }
    else if (m.t === "leave") { this.toast((this.names[m.id] || "Someone") + " left the match", "warn"); }
  }
  lateFix(m) { this.sim.apply(m.c); } // (a command that came in a tiny bit late: use it right away)
  // ---------------------------------------------------------------- every frame
  update(dt, input) {
    // how many steps to run: alone / host = real time; others try to stay a few steps behind the host
    let steps = 0;
    if (this.host) { if (this.hold > 0 || this.waiting) this.acc = 0; this.acc += dt; while (this.acc >= TICK && steps < 8) { this.acc -= TICK; steps++; } if (this.hold > 0 || this.waiting) steps = 0; }
    else { const want = Math.min(this.hostT + 8, this.hostT + Math.floor((performance.now() - this.hostAt) / 1000 / TICK) - 8); steps = Math.max(0, Math.min(want - this.sim.tick, 40)); } // (never get ahead of a slow host)
    for (let i = 0; i < steps && !this.sim.over; i++) {
      const T = this.sim.tick + 1, list = this.pending.get(T); if (list) { for (const c of list) this.sim.apply(c); this.pending.delete(T); }
      this.sim.step();
      if (!this.host && this.sim.tick % 20 === 0 && this.hostHash.has(this.sim.tick)) { this.checks = (this.checks || 0) + 1; if (this.hostHash.get(this.sim.tick) !== this.sim.hash()) this.desync = true; } // (same fingerprint as the host on the same step?)
      if (this.host && !this.solo && this.sim.tick % 10 === 0) this.conn.send({ t: "tdt", T: this.sim.tick, h: this.sim.hash() });
    }
    this.camMove(dt, input);
    this.draw(dt);
    this.effects();
    this.hudTick();
    if (this.sim.over && !this.ended) this.finish();
  }
  camMove(dt, I) {
    const c = this.cam, sp = 26 * dt * (c.dist / 58), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const mx = (I.keys.KeyD || I.keys.ArrowRight ? 1 : 0) - (I.keys.KeyA || I.keys.ArrowLeft ? 1 : 0), mz = (I.keys.KeyS || I.keys.ArrowDown ? 1 : 0) - (I.keys.KeyW || I.keys.ArrowUp ? 1 : 0);
    c.x += (mx * fz + mz * fx) * sp; c.z += (-mx * fx + mz * fz) * sp;
    if (I.keys.KeyQ) c.yaw -= dt * 1.5; if (I.keys.KeyE) c.yaw += dt * 1.5;
    if (I.drag) { c.yaw -= I.drag.dx * 0.006; c.pitch = Math.max(0.45, Math.min(1.35, c.pitch + I.drag.dy * 0.004)); }
    if (I.wheel) { c.dist = Math.max(18, Math.min(95, c.dist * (I.wheel > 0 ? 1.1 : 0.9))); }
    const [hx, hz] = this.M.size; c.x = Math.max(-hx, Math.min(hx, c.x)); c.z = Math.max(-hz, Math.min(hz, c.z));
    const cam = this.camera; cam.position.set(c.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, Math.sin(c.pitch) * c.dist, c.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist); cam.lookAt(c.x, 0, c.z);
    // the mouse over the floor
    if (I.mouse) {
      this.ray.setFromCamera(new THREE.Vector2(I.mouse.x, I.mouse.y), cam); const p = new THREE.Vector3();
      this.hover = this.ray.ray.intersectPlane(this.plane, p) ? p : null;
    }
    if (I.click && this.hover) this.clickAt(this.hover);
    if (I.esc) this.cancel();
    if (I.num) { const id = S.loadout[I.num - 1]; if (id) this.pick(id); }
  }
  clickAt(p) {
    const x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10;
    if (this.placing) {
      const why = this.sim.canPlace(this.me, towerById(this.placing), x, z);
      if (why) { SFX.nope(); this.toast(why, "warn"); return; }
      this.cmd({ a: "p", w: this.placing, x, z }); SFX.place();
      return;
    }
    let best = null, bd = 9; for (const t of this.sim.towers) { const d = (t.x - x) ** 2 + (t.z - z) ** 2, r = RARITIES[towerById(t.id).r].size * 1.2; if (d < r * r && d < bd) { bd = d; best = t; } }
    this.select(best ? best.u : null); if (best) SFX.click();
  }
  // ---------------------------------------------------------------- drawing the sim
  draw(dt) {
    const sim = this.sim, t = performance.now() / 1000;
    // towers
    const live = new Set();
    for (const tw of sim.towers) {
      live.add(tw.u); let m = this.towerM.get(tw.u);
      if (!m) { m = towerModel(tw.id, tw.lv); m.root.position.set(tw.x, 0, tw.z); this.scene.add(m.root); m.ring.material = m.ring.material.clone(); m.ring.material.color.set(tw.o === this.me ? 0x3aff6a : 0x3ad0ff); this.towerM.set(tw.u, m); m.lv = tw.lv; }
      if (m.lv !== tw.lv) { setPips(m, tw.lv); m.lv = tw.lv; }
      if (tw.aimX !== undefined) { const want = Math.atan2(tw.aimX - tw.x, tw.aimZ - tw.z); let d = want - m.head.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.head.rotation.y += d * Math.min(1, dt * 12); }
      m.head.traverse((o) => { if (o.name === "spin") o.rotation.z += dt * 2; });
      m.ring.material.opacity = this.sel === tw.u ? 1 : 0.5;
    }
    for (const [u, m] of this.towerM) if (!live.has(u)) { this.scene.remove(m.root); this.towerM.delete(u); }
    // robots
    const seen = new Set();
    for (const e of sim.enemies) {
      seen.add(e.id); let m = this.enemyM.get(e.id);
      if (!m) { m = enemyModel(e.e); this.scene.add(m.root); this.enemyM.set(e.id, m); m.px = e.x; m.pz = e.z; m.root.position.set(e.x, 0, e.z); }
      const k = Math.min(1, dt * 14), nx = m.root.position.x + (e.x - m.root.position.x) * k, nz = m.root.position.z + (e.z - m.root.position.z) * k;
      const dx = nx - m.root.position.x, dz = nz - m.root.position.z; if (dx * dx + dz * dz > 1e-6) m.root.rotation.y = Math.atan2(dx, dz);
      m.root.position.set(nx, m.fly ? 0.4 + Math.sin(t * 4 + e.id) * 0.2 : 0, nz);
      const ph = t * 9 + e.id; m.legs.forEach((l, i) => (l.rotation.x = Math.sin(ph + i * Math.PI) * 0.6));
      const hp = Math.max(0, e.hp / e.max); m.fg.scale.x = Math.max(0.001, hp); m.fg.position.x = -m.bw * (1 - hp) / 2;
      const sh = e.shMax ? e.sh / e.shMax : 0; m.sb.visible = sh > 0; m.sb.scale.x = Math.max(0.001, sh); m.sb.position.x = -m.bw * (1 - sh) / 2; if (m.shield) m.shield.visible = sh > 0;
      m.hb.lookAt(this.camera.position);
      m.body.children.forEach((o) => { if (o.material && o.material.emissive) {} });
      if (e.slowT > 0) m.root.scale.setScalar(ENEMIES[e.e].size * (ENEMIES[e.e].boss ? 1 : VIS) * (1 + Math.sin(t * 20) * 0.02));
    }
    for (const [id, m] of this.enemyM) if (!seen.has(id)) { this.scene.remove(m.root); this.enemyM.delete(id); }
    this.portal.rotation.z += dt; this.crystal.rotation.y += dt * 1.2; this.crystal.position.y = 2.6 + Math.sin(t * 2) * 0.2;
    // placing: the see-through tower follows the mouse (red when you can't build there)
    if (this.ghost) {
      const p = this.hover, T = towerById(this.placing);
      this.ghost.root.visible = !!p; this.rangeRing.visible = this.rangeFill.visible = !!p;
      if (p) {
        const x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10, ok = !this.sim.canPlace(this.me, T, x, z), r = statsOf(T, 0).rng;
        this.ghost.root.position.set(x, 0, z); this.rangeRing.position.set(x, 0.08, z); this.rangeFill.position.set(x, 0.07, z); this.rangeRing.scale.setScalar(r); this.rangeFill.scale.setScalar(r);
        this.rangeRing.material.color.set(ok ? 0x3aff6a : 0xff3a3a); this.rangeFill.material.color.set(ok ? 0x3aff6a : 0xff3a3a);
      }
    } else if (this.sel) {
      const tw = sim.towers.find((q) => q.u === this.sel); if (tw) { const r = statsOf(towerById(tw.id), tw.lv).rng; this.rangeRing.visible = this.rangeFill.visible = true; this.rangeRing.position.set(tw.x, 0.08, tw.z); this.rangeFill.position.set(tw.x, 0.07, tw.z); this.rangeRing.scale.setScalar(r); this.rangeFill.scale.setScalar(r); this.rangeRing.material.color.set(0x3aff6a); this.rangeFill.material.color.set(0x3aff6a); }
    } else { this.rangeRing.visible = this.rangeFill.visible = false; }
    // fading effects
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t -= dt; if (f.grow) f.m.scale.setScalar(f.grow * (1 - f.t / f.t0) + 0.2); if (f.m.material) f.m.material.opacity = Math.max(0, f.t / f.t0) * (f.op || 1); if (f.vy) { f.m.position.y += f.vy * dt; } if (f.t <= 0) { this.scene.remove(f.m); if (f.m.geometry && !f.keep) f.m.geometry.dispose(); this.fx.splice(i, 1); } }
  }
  // shots, booms, coins: the sim's events turned into pictures + sounds
  effects() {
    const ev = this.sim.events; this.sim.events = [];
    if (ev.length > 300) ev.splice(0, ev.length - 300); // (catching up: skip most of the pictures)
    for (const e of ev) {
      if (e.k === "shot" || e.k === "zap" || e.k === "beam" || e.k === "multi") {
        const T = towerById(e.t.id), m = this.towerM.get(e.t.u), from = new THREE.Vector3(e.t.x, 1.2 * RARITIES[T.r].size, e.t.z);
        if (m) m.muzzle.getWorldPosition(from);
        const col = e.k === "zap" ? 0x9ad0ff : e.k === "beam" ? RARITIES[T.r].hex : T.id === "sniper" ? 0xff3ad8 : T.id === "scout" ? 0xff3a3a : 0xffe04a;
        let prev = from; const pts = e.k === "zap" ? [] : null;
        for (const [x, z] of e.to) { const to = new THREE.Vector3(x, 1, z); this.line(e.k === "zap" ? prev : from, to, col, e.k === "beam" || e.t.id === "sniper" ? 0.25 : 0.12); prev = to; }
        if (this.near(e.t)) (e.k === "zap" ? SFX.zap : e.k === "beam" ? SFX.beam : T.rate > 3 ? SFX.laser : SFX.pew)();
      } else if (e.k === "boom" || e.k === "frost") {
        const [x, z] = e.to[0], s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: e.k === "frost" ? 0x9af0ff : 0xff8a1a, transparent: true, opacity: 0.7, depthWrite: false }));
        s.position.set(x, 0.8, z); this.scene.add(s); this.fx.push({ m: s, t: 0.35, t0: 0.35, grow: e.r * 1.1, op: 0.7 });
        const m = this.towerM.get(e.t.u); if (m) { const from = new THREE.Vector3(); m.muzzle.getWorldPosition(from); this.line(from, new THREE.Vector3(x, 0.8, z), e.k === "frost" ? 0x9af0ff : 0xffb04a, 0.12); }
        if (this.near(e.t)) (e.k === "frost" ? SFX.frost : SFX.boom)();
      } else if (e.k === "die") {
        const E = ENEMIES[e.e.e], s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * E.size, 0), new THREE.MeshBasicMaterial({ color: 0x3aff6a, transparent: true, opacity: 0.8 }));
        s.position.set(e.e.x, 1, e.e.z); this.scene.add(s); this.fx.push({ m: s, t: 0.4, t0: 0.4, grow: 1.6 * E.size, op: 0.8 }); SFX.die();
        const c = label("+$" + Math.round(E.$ * (1 + this.sim.wave * 0.02)), "#ffd23a", 1.6, "rgba(0,0,0,0)"); c.position.set(e.e.x, 2.2, e.e.z); this.scene.add(c); this.fx.push({ m: c, t: 0.8, t0: 0.8, vy: 2 });
      } else if (e.k === "leak") { SFX.leak(); this.flash("#ff2a2a"); }
      else if (e.k === "wave") { SFX.wave(); this.banner(e.boss ? "⚠ BOSS WAVE " + e.w + " ⚠" : "WAVE " + e.w, e.boss ? "#ff3a6a" : "#3aff6a"); if (e.boss) SFX.boss(); }
      else if (e.k === "clear") { SFX.coin(); this.toast("Wave " + e.w + " cleared! +$" + (20 + e.w * 4) + " for everyone", "good"); }
      else if (e.k === "bosskill") { SFX.win(); this.banner("BOSS DESTROYED!", "#ffd23a"); }
      else if (e.k === "omega") { SFX.reveal(5); this.banner("WAVE 100! OMEGA PRIME UNLOCKED!", "#3affe0"); this.o.omega && this.o.omega(); }
      else if (e.k === "place" && e.t.o !== this.me) this.toast((this.names[e.t.o] || "A friend") + " built a " + towerById(e.t.id).name, "");
      else if (e.k === "place" && e.t.o === this.me) { if (this.placing && !this.o.shiftKeep) { /* keep placing the same kind */ } }
      else if (e.k === "up" && e.t.o === this.me) SFX.up();
      else if (e.k === "sell" && e.t.o === this.me) SFX.sell();
    }
  }
  near(t) { const c = this.cam; return (t.x - c.x) ** 2 + (t.z - c.z) ** 2 < 900; }
  line(a, b, col, w) {
    const d = new THREE.Vector3().subVectors(b, a), l = d.length(); if (l < 0.01) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, w, l), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, depthWrite: false }));
    m.position.copy(a).addScaledVector(d, 0.5); m.lookAt(b); this.scene.add(m); this.fx.push({ m, t: 0.12, t0: 0.12 });
  }
  // ---------------------------------------------------------------- the HUD every frame
  hudTick() {
    const sim = this.sim, p = sim.players[this.me] || { cash: 0 }, M = this.M;
    $("mWave").textContent = sim.wave + (M.endless ? "" : " / " + (M.waves + 1));
    $("mCash").textContent = "$" + fmt(p.cash); $("mKills").textContent = fmt(sim.kills);
    const k = sim.base / sim.baseMax; $("mBase").querySelector("i").style.width = k * 100 + "%"; $("mBase").querySelector("span").textContent = Math.ceil(sim.base) + " / " + sim.baseMax;
    for (const b of $("mCards").children) { const T = towerById(b.dataset.w), n = sim.towers.filter((t) => t.o === this.me && t.id === T.id).length; b.classList.toggle("off", p.cash < T.cost); b.classList.toggle("on", this.placing === T.id); b.querySelector("u").textContent = n + "/" + RARITIES[T.r].limit; }
    const sk = $("mSkip"), left = Math.max(0, Math.ceil((sim.nextWave - sim.tick) * TICK));
    sk.textContent = sim.wave === 0 ? "▶ START (" + left + ")" : sim.phase === "build" ? "⏩ NEXT WAVE (" + left + ")" : "⚔ WAVE " + sim.wave; sk.disabled = sim.phase !== "build";
    const boss = sim.enemies.find((e) => ENEMIES[e.e].boss); $("mBossBar").classList.toggle("hidden", !boss);
    if (boss) { $("mBossName").textContent = ENEMIES[boss.e].name; $("mBossBar").querySelector("i").style.width = Math.max(0, (boss.hp + boss.sh) / (boss.max + boss.shMax)) * 100 + "%"; }
    if (!this.solo) $("mPlayers").innerHTML = Object.keys(sim.players).map((id) => `<div>${+id === this.me ? "🟢 You" : "🔵 " + esc(this.names[id] || "Player")} · ${fmt(sim.players[id].dmg)} dmg</div>`).join("") + (this.desync ? '<div style="color:#ff9a7a">⚠ Out of sync with the host</div>' : "");
    if (this.sel) this.panel();
  }
  banner(t, c) { const m = $("mMsg"); m.textContent = t; m.style.color = c; m.classList.remove("show"); void m.offsetWidth; m.classList.add("show"); }
  toast(t, k) { this.o.toast && this.o.toast(t, k); }
  flash(c) { const f = $("flash"); f.style.background = c; f.style.opacity = 0.25; setTimeout(() => (f.style.opacity = 0), 90); }
  // ---------------------------------------------------------------- the end: the stats screen
  finish() {
    this.ended = true; this.cancel();
    const sim = this.sim, M = this.M, p = sim.players[this.me] || { dmg: 0, kills: 0 }, won = sim.won;
    const bolts = matchBolts(M, sim.cleared, sim.kills, sim.bossKills, won);
    (won ? SFX.win : SFX.lose)();
    const res = { map: M.id, won, bolts, waves: sim.cleared, kills: sim.kills, bossKills: sim.bossKills, dmg: p.dmg, omega: sim.omega };
    const best = M.endless ? Math.max(S.stats.bestEndless, sim.cleared) : 0;
    $("mhud").insertAdjacentHTML("beforeend", `<div id="mEnd"><div class="box">
      <h1 style="color:${won ? "#3aff6a" : "#ff3a6a"}">${won ? "VICTORY!" : M.endless ? "THE CORE FELL" : "DEFEATED"}</h1><p class="sub">${esc(M.name)}${M.endless ? " · Endless" : ""}${!won && !M.endless ? " · you didn't reach the boss, so you get less" : won ? " · you destroyed the boss: bonus bolts!" : ""}</p>
      <div class="stats">${[["🌊", "Waves cleared", sim.cleared], ["🤖", "Robots destroyed", fmt(sim.kills)], ["💥", "Your damage", fmt(p.dmg)], ["👑", "Bosses destroyed", sim.bossKills], ...(M.endless ? [["🏆", "Your best (Endless)", best]] : []), ["🛡", "Core left", Math.ceil(sim.base) + " / " + sim.baseMax]].map(([i, n, v]) => `<div><span>${i}</span><small>${n}</small><b>${v}</b></div>`).join("")}</div>
      <div class="reward">+${fmt(bolts)} ⚡ BOLTS</div>${sim.omega ? '<div class="reward" style="color:#3affe0">+ OMEGA PRIME (in your locker!)</div>' : ""}
      <button type="button" id="mBack" class="big">BACK TO THE HUB</button></div></div>`);
    $("mBack").onclick = () => this.o.done(res);
  }
  dispose() { $("mhud").classList.add("hidden"); $("mhud").innerHTML = ""; this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
}
