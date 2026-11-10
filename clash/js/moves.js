// CLASH moves: what each fighter's 1 / 2 / ULTIMATE (3) / DOMAIN (4) does. Every game shows every move (the effects),
// but only the game of whoever used it decides who got hit (owner = the caster is me or one of my practice bots):
// G.hit(caster, target, hit) sends the hit to that player's game, which takes the damage (main.js applyHit).
// hit = {dmg, kb: [x, y, z] push, rag: seconds knocked flying, stun, slow, frz (frozen), set: 1 = push replaces speed,
//        ub: 1 = goes through blocking, fx: "hit" | "big" | "spark" | "slash" | "shadow" | "fire"}
import * as THREE from "/create/vendor/three.module.js";
import { toon } from "./fighters.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const fwdOf = (d) => V(Math.sin(d), 0, Math.cos(d));
export const DOMAIN_R = 24;

// ---------------------------------------------------------------- little effect helpers
function mat(color, op = 0.9, add = true, side) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: side || THREE.FrontSide, fog: false });
  m.userData.own = true;
  return m;
}
const SPH = new THREE.SphereGeometry(1, 20, 14), RING = new THREE.RingGeometry(0.85, 1, 48), CUBE = new THREE.BoxGeometry(1, 1, 1);
SPH.userData.keep = RING.userData.keep = CUBE.userData.keep = true;
function ball(G, color, r, op, add) { const m = new THREE.Mesh(SPH, mat(color, op, add)); m.scale.setScalar(r); G.scene.add(m); return m; }
function flatRing(G, color, pos, op = 0.9) { const m = new THREE.Mesh(RING, mat(color, op, true, THREE.DoubleSide)); m.rotation.x = -Math.PI / 2; m.position.copy(pos); G.scene.add(m); return m; }
// An effect: run(dt, age) every frame until it returns false (or life runs out); everything in objs is removed after.
function effect(G, life, run, objs = []) {
  const e = { age: 0, life, objs, run, done: false, key: null, pop: null };
  G.add(e);
  return e;
}
// sparks flying out of a point
export function burst(G, pos, color, n = 14, speed = 14, life = 0.5, size = 0.35) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(CUBE, mat(color, 1)); m.scale.setScalar(size * (0.5 + Math.random()));
    m.position.copy(pos); G.scene.add(m);
    const v = V(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    parts.push({ m, v });
  }
  effect(G, life, (dt, age) => {
    for (const p of parts) { p.m.position.addScaledVector(p.v, dt); p.v.y -= 20 * dt; p.m.rotation.x += dt * 9; p.m.material.opacity = 1 - age / life; }
  }, parts.map((p) => p.m));
}
// a flat ring that grows and fades
export function wave(G, pos, color, r0, r1, life, op = 0.9) {
  const m = flatRing(G, color, pos.clone().setY(pos.y + 0.15), op);
  effect(G, life, (dt, age) => { const k = age / life; m.scale.setScalar(r0 + (r1 - r0) * (1 - (1 - k) * (1 - k))); m.material.opacity = op * (1 - k); }, [m]);
}
// a ball that blows up and fades
export function boom(G, pos, color, r, life = 0.5, op = 0.85) {
  const m = ball(G, color, 0.1, op); m.position.copy(pos);
  const core = ball(G, 0xffffff, 0.1, op); core.position.copy(pos);
  effect(G, life, (dt, age) => { const k = age / life, s = r * (1 - (1 - k) ** 3); m.scale.setScalar(s); core.scale.setScalar(s * 0.55); m.material.opacity = op * (1 - k); core.material.opacity = op * (1 - k) ** 2; }, [m, core]);
}
// a jagged lightning bolt between two points (fades fast)
export function bolt(G, a, b, color, life = 0.25, width = 0.25) {
  const pts = [a.clone()], n = 7;
  for (let i = 1; i < n; i++) pts.push(a.clone().lerp(b, i / n).add(V((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6)));
  pts.push(b.clone());
  const objs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], len = p.distanceTo(q), m = new THREE.Mesh(CUBE, mat(color, 1));
    m.scale.set(width, width, len); m.position.copy(p).lerp(q, 0.5); m.lookAt(q); G.scene.add(m); objs.push(m);
  }
  effect(G, life, (dt, age) => { for (const m of objs) m.material.opacity = 1 - age / life; }, objs);
}
// a thin slash line (a quick white-red cut through the air)
export function slashLine(G, pos, color, len = 6, life = 0.22) {
  const m = new THREE.Mesh(CUBE, mat(color, 1)); m.position.copy(pos);
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  m.scale.set(0.12, 0.12, 0.1); G.scene.add(m);
  const w = new THREE.Mesh(CUBE, mat(0xffffff, 1)); w.scale.set(0.5, 0.5, 1); m.add(w);
  effect(G, life, (dt, age) => { const k = age / life; m.scale.z = len * Math.min(1, k * 4); m.material.opacity = w.material.opacity = 1 - k; }, [m]);
}
// The hit effect everyone sees on whoever got hit.
export function hitFx(G, pos, fx) {
  const p = pos.clone().setY(pos.y + 2.8);
  if (fx === "spark") { for (let i = 0; i < 5; i++) bolt(G, p, p.clone().add(V((Math.random() - 0.5) * 9, (Math.random() - 0.3) * 7, (Math.random() - 0.5) * 9)), i % 2 ? 0xff1030 : 0x220008, 0.35, 0.35); boom(G, p, 0xff1030, 4, 0.35); G.text(pos, "SPARK!", "#ff2a3a", 1.2); G.shake(0.9, pos); G.sound("spark", pos); return; }
  if (fx === "slash") { for (let i = 0; i < 2; i++) slashLine(G, p, 0xff2040, 5); G.sound("slash", pos); return; }
  if (fx === "shadow") { burst(G, p, 0x3fe0b0, 10, 10, 0.4, 0.3); burst(G, p, 0x05080a, 8, 8, 0.5, 0.4); G.sound("hit", pos); return; }
  if (fx === "fire") { burst(G, p, 0xff7a1a, 14, 14, 0.5); G.sound("hit", pos); return; }
  if (fx === "big") { boom(G, p, 0xffe08a, 3.5, 0.3); burst(G, p, 0xffffff, 16, 20, 0.5); G.shake(0.6, pos); G.sound("bighit", pos); return; }
  burst(G, p, 0xfff2a0, 8, 12, 0.3, 0.25); G.sound("hit", pos);
}

// ---------------------------------------------------------------- who gets hit (only the caster's game asks)
function targetsNear(G, caster, center, r, already) {
  return G.targets(caster).filter((t) => !(already && already.has(t)) && Math.hypot(t.pos.x - center.x, t.pos.z - center.z) <= r + 0.9 && t.pos.y < center.y + r + 1 && t.pos.y + 5 > center.y - r);
}
function away(from, to, out, up) { const d = V(to.x - from.x, 0, to.z - from.z); if (d.lengthSq() < 0.01) d.set(Math.random() - 0.5, 0, Math.random() - 0.5); d.normalize().multiplyScalar(out); return [d.x, up, d.z]; }
// The nearest enemy in front of the caster (within range and angle), or null: for moves that aim by themselves.
export function aimTarget(G, caster, range, maxAngle) {
  const f = fwdOf(caster.facing);
  let best = null, bd = Infinity;
  for (const t of G.targets(caster)) {
    const d = V(t.pos.x - caster.pos.x, 0, t.pos.z - caster.pos.z), len = d.length();
    if (len > range || len < 0.01) continue;
    if (Math.acos(Math.max(-1, Math.min(1, d.dot(f) / len))) > maxAngle) continue;
    if (len < bd) { bd = len; best = t; }
  }
  return best;
}

// ---------------------------------------------------------------- domains (shared: the big see-through dome)
function dome(G, pos, color, op, life, extra) {
  const d = new THREE.Mesh(SPH, mat(color, 0, false, THREE.BackSide)); d.position.copy(pos); G.scene.add(d);
  const shell = new THREE.Mesh(SPH, mat(color, 0, true)); shell.position.copy(pos); G.scene.add(shell);
  const objs = [d, shell, ...(extra || [])];
  return { objs, update(age) {
    const grow = Math.min(1, age / 0.8), fade = age > life - 0.6 ? (life - age) / 0.6 : 1, r = DOMAIN_R * (1 - (1 - grow) ** 3);
    d.scale.setScalar(Math.max(0.1, r)); shell.scale.setScalar(Math.max(0.1, r * 1.002));
    d.material.opacity = op * fade; shell.material.opacity = 0.18 * fade;
    return fade;
  } };
}
function domainTick(G, caster, owner, pos, every, hit, st) {
  if (!owner) return;
  st.tick = (st.tick || 0) - st.dt;
  if (st.tick > 0) return;
  st.tick = every;
  for (const t of targetsNear(G, caster, pos, DOMAIN_R)) G.hit(caster, t, typeof hit === "function" ? hit(t) : hit);
}

// ---------------------------------------------------------------- the moves
// data = {p: where it started [x,y,z], d: facing, x: aimed point, t: target id, f: effect number}
export function castMove(G, caster, key, data, owner) {
  const c = caster.char, p0 = V(...data.p), d = data.d, fwd = fwdOf(d), hand = p0.clone().add(V(0, 3.2, 0)).addScaledVector(fwd, 1.6);
  const keyed = (e) => { e.key = caster.id + ":" + data.f; return e; };
  const pose = (name, secs) => { caster.pose = name; caster.poseT = secs; };
  const M = c + key;

  // ===== NOVA =====
  if (M === "nova1") { // Pull Orb: flies out, then hovers and drags everyone into it
    pose("point", 0.4); G.sound("orb", p0);
    const core = ball(G, 0x3d7bff, 1.1, 0.95), halo = ball(G, 0x9fd0ff, 1.8, 0.35), ring = flatRing(G, 0x6fb0ff, hand, 0.8);
    core.position.copy(hand); halo.position.copy(hand);
    const at = hand.clone(), st = { fly: true };
    effect(G, 2.4, (dt, age) => {
      if (st.fly) { // (flies about 15 studs, or stops at the first enemy it reaches)
        const nxt = at.clone().addScaledVector(fwd, 40 * dt);
        if (age > 0.38 || G.arena.inside(nxt) || targetsNear(G, caster, at, 3).length) st.fly = false; else at.copy(nxt);
      }
      core.position.copy(at); halo.position.copy(at); ring.position.copy(at);
      const s = st.fly ? 1 : 1 + Math.min(1, age * 2) * 0.6;
      core.scale.setScalar(1.1 * s); halo.scale.setScalar((1.8 + Math.sin(age * 20) * 0.3) * s);
      ring.scale.setScalar(4 + ((age * 12) % 10)); ring.material.opacity = 0.8 * (1 - ((age * 12) % 10) / 10); ring.rotation.z += dt * 3;
      if (!st.fly && owner) { st.dt = dt; st.tick = (st.tick || 0) - dt; if (st.tick <= 0) { st.tick = 0.2; for (const t of targetsNear(G, caster, at, 16)) { const k = away(t.pos, at, Math.min(18, t.pos.distanceTo(at) * 2.2), 3); G.hit(caster, t, { dmg: 3, kb: k, set: 1, stun: 0.3, fx: "" }); } } }
      if (age > 2.35) { boom(G, at, 0x6fb0ff, 5, 0.4); G.sound("blast", at); }
    }, [core, halo, ring]);
    return;
  }
  if (M === "nova2") { // Push Burst: a red bolt that blows enemies away
    pose("point", 0.35); G.sound("blast", p0);
    const core = ball(G, 0xff2a2a, 0.9, 1), halo = ball(G, 0xff8a60, 1.6, 0.4);
    const at = hand.clone(), hitAlready = new Set();
    const e = keyed(effect(G, 1.0, (dt, age) => {
      if (e.ended) return false;
      at.addScaledVector(fwd, 75 * dt); core.position.copy(at); halo.position.copy(at); halo.scale.setScalar(1.6 + Math.sin(age * 40) * 0.3);
      if (Math.random() < 0.7) burst(G, at, 0xff4030, 2, 4, 0.25, 0.3);
      if (owner) {
        const direct = targetsNear(G, caster, at, 1.6, hitAlready)[0];
        if (direct || G.arena.inside(at) || age > 0.85) {
          for (const t of targetsNear(G, caster, at, 5.5)) G.hit(caster, t, { dmg: t === direct ? 22 : 15, kb: away(at, t.pos, 38, 14).map((v, i) => (i === 1 ? v : v * 0.5 + fwd.getComponent(i) * 19)), rag: 1.4, fx: "big" });
          G.pop(caster, data.f, at); e.pop(at); return false;
        }
      }
    }, [core, halo]));
    e.pop = (p) => { e.ended = true; const q = V(...(p.toArray ? p.toArray() : p)); boom(G, q, 0xff3020, 6, 0.45); wave(G, q.clone().setY(Math.max(0, q.y - 3)), 0xff5040, 1, 9, 0.4); G.sound("boom", q); };
    return;
  }
  if (M === "nova3") { // Void Beam (ULTIMATE): red + blue -> a giant purple sphere
    pose("charge", 1.0); G.sound("charge", p0);
    if (owner) caster.lockT = 1.0;
    const red = ball(G, 0xff2a2a, 0.7, 1), blue = ball(G, 0x3d7bff, 0.7, 1), purple = ball(G, 0xa040ff, 0.1, 0.9), white = ball(G, 0xffffff, 0.1, 0.9);
    const trail = [], at = p0.clone().add(V(0, 3.4, 0)).addScaledVector(fwd, 2.5), hitAlready = new Set();
    effect(G, 2.9, (dt, age) => {
      if (age < 1.0) { // charging: red and blue spin around and smash together
        const a = age * 14, r = 2.4 * (1 - age);
        const side = V(Math.cos(d), 0, -Math.sin(d));
        red.position.copy(at).addScaledVector(side, Math.cos(a) * r).add(V(0, Math.sin(a) * r * 0.6, 0));
        blue.position.copy(at).addScaledVector(side, -Math.cos(a) * r).add(V(0, -Math.sin(a) * r * 0.6, 0));
        if (age > 0.8) { purple.position.copy(at); white.position.copy(at); purple.scale.setScalar((age - 0.8) * 15); white.scale.setScalar((age - 0.8) * 8); }
        return;
      }
      if (red.visible) { red.visible = blue.visible = false; G.sound("beam", at); G.shake(1.2, at); G.text(at, "VOID BEAM", "#c27bff", 1.2); }
      at.addScaledVector(fwd, 50 * dt);
      const s = 3.6 + Math.sin(age * 30) * 0.25;
      purple.position.copy(at); white.position.copy(at); purple.scale.setScalar(s); white.scale.setScalar(s * 0.6);
      if (trail.length < 26 && Math.random() < 0.8) { const t = ball(G, 0x8030ff, s * 0.9, 0.35); t.position.copy(at); trail.push({ m: t, a: age }); }
      for (const t of trail) { const k = (age - t.a) / 0.6; t.m.material.opacity = Math.max(0, 0.35 * (1 - k)); t.m.scale.setScalar(Math.max(0.01, s * 0.9 * (1 - k * 0.5))); }
      burst(G, at.clone().add(V((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)), 0xd090ff, 1, 6, 0.4, 0.4);
      if (owner) for (const t of targetsNear(G, caster, at, 4.6, hitAlready)) { hitAlready.add(t); G.hit(caster, t, { dmg: 45, kb: [fwd.x * 45, 20, fwd.z * 45], rag: 2.2, ub: 1, fx: "big" }); }
    }, [red, blue, purple, white]).objsLater = trail;
    return;
  }
  if (M === "nova4") { // Infinite Starfield (DOMAIN)
    pose("sign", 1.0); G.banner("DOMAIN EXPANSION", "Infinite Starfield", "#8b6cff", p0); G.sound("domain", p0);
    const starsG = new THREE.BufferGeometry(), pts = [];
    for (let i = 0; i < 500; i++) { const v = V(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(DOMAIN_R * (0.3 + Math.random() * 0.65)); pts.push(v.x, Math.abs(v.y), v.z); }
    starsG.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0, depthWrite: false, fog: false }); sm.userData.own = true;
    const stars = new THREE.Points(starsG, sm); stars.position.copy(p0); G.scene.add(stars);
    const D = dome(G, p0, 0x0a0a40, 0.82, 8, [stars]), st = {};
    effect(G, 8, (dt, age) => {
      const f = D.update(age); sm.opacity = f; stars.rotation.y += dt * 0.15;
      st.dt = dt;
      if (owner && !st.froze && age > 0.6) { st.froze = true; for (const t of targetsNear(G, caster, p0, DOMAIN_R)) G.hit(caster, t, { dmg: 6, frz: 1.8, ub: 1, fx: "" }); st.tick = 1.8; }
      if (st.froze) domainTick(G, caster, owner, p0, 0.5, { dmg: 4, slow: 0.7, ub: 1, fx: "" }, st);
    }, D.objs);
    return;
  }

  // ===== REND =====
  if (M === "rend1") { // Cleave Flurry: six slashes in front
    pose("sweep", 0.7);
    let n = 0;
    effect(G, 0.75, (dt, age) => {
      while (n < 6 && age > n * 0.11) {
        n++;
        const c2 = p0.clone().add(V(0, 2.8, 0)).addScaledVector(fwd, 5).add(V((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6));
        slashLine(G, c2, 0xff2a40, 8); G.sound("slash", c2);
        if (owner) for (const t of targetsNear(G, caster, p0.clone().addScaledVector(fwd, 5), 6)) G.hit(caster, t, { dmg: 4, stun: 0.35, kb: [fwd.x * 5, 1, fwd.z * 5], fx: "slash" });
      }
    });
    return;
  }
  if (M === "rend2") { // Rift Slash: a huge flying crescent
    pose("sweep", 0.4); G.sound("crescent", p0);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 6, 32, Math.PI), mat(0xff2a40, 0.95));
    const core = new THREE.Mesh(new THREE.TorusGeometry(4, 0.12, 6, 32, Math.PI), mat(0xffffff, 1)); cres.add(core);
    const at = p0.clone().add(V(0, 3, 0)).addScaledVector(fwd, 2), hitAlready = new Set();
    cres.position.copy(at); cres.rotation.set(0, d + Math.PI / 2, 0); cres.rotateX(-Math.PI / 2); G.scene.add(cres);
    effect(G, 1.3, (dt, age) => {
      at.addScaledVector(fwd, 58 * dt); cres.position.copy(at);
      cres.material.opacity = core.material.opacity = age > 1.1 ? (1.3 - age) * 5 : 1;
      if (G.arena.inside(at)) { boom(G, at, 0xff2a40, 4, 0.3); return false; }
      if (owner) for (const t of targetsNear(G, caster, at, 4.2, hitAlready)) { hitAlready.add(t); G.hit(caster, t, { dmg: 16, kb: [fwd.x * 30, 10, fwd.z * 30], rag: 1.2, fx: "slash" }); }
    }, [cres]);
    return;
  }
  if (M === "rend3") { // Hellfire Arrow (ULTIMATE)
    pose("bow", 1.0); G.sound("fire", p0);
    if (owner) caster.lockT = 0.75;
    const bowM = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 6, 24, Math.PI), mat(0xff7a1a, 1));
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 8), mat(0xffd060, 1)); arrow.rotation.x = Math.PI / 2;
    const arrowG = new THREE.Group(); arrowG.add(arrow); G.scene.add(bowM, arrowG);
    const flame = ball(G, 0xff5a10, 1, 0.6);
    const at = hand.clone(), e = keyed(effect(G, 2.6, (dt, age) => {
      if (e.ended) return false;
      if (age < 0.75) { // drawing the bow
        bowM.position.copy(hand); bowM.rotation.set(0, d, Math.PI / 2); arrowG.position.copy(hand).addScaledVector(fwd, -0.5 + age); arrowG.rotation.y = d;
        flame.position.copy(arrowG.position); flame.scale.setScalar(0.5 + age * 1.6);
        if (Math.random() < 0.6) burst(G, hand, 0xff7a1a, 1, 4, 0.3, 0.3);
        return;
      }
      if (bowM.visible) { bowM.visible = false; G.sound("fire", at); G.text(at, "HELLFIRE", "#ff7a1a", 1.1); }
      at.addScaledVector(fwd, 95 * dt); arrowG.position.copy(at); flame.position.copy(at); flame.scale.setScalar(1.3 + Math.sin(age * 40) * 0.3);
      burst(G, at, Math.random() < 0.5 ? 0xff5a10 : 0xffd060, 2, 5, 0.35, 0.45);
      if (owner) {
        const direct = targetsNear(G, caster, at, 2)[0];
        if (direct || G.arena.inside(at) || at.y < 0.4 || age > 2.4) { G.pop(caster, data.f, at); e.pop(at); return false; }
      }
    }, [bowM, arrowG, flame]));
    e.pop = (p) => {
      e.ended = true;
      const q = V(...(p.toArray ? p.toArray() : p)), ground = q.clone().setY(Math.max(0, q.y - 3));
      boom(G, q, 0xff5a10, 11, 0.7); boom(G, q, 0xffd060, 7, 0.5); wave(G, ground, 0xff7a1a, 2, 16, 0.6); G.shake(1.3, q); G.sound("boom", q);
      // a fire column that keeps burning for a bit
      const col = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 14, 20, 1, true), mat(0xff5a10, 0.5, true, THREE.DoubleSide)); col.position.copy(ground).add(V(0, 7, 0)); G.scene.add(col);
      const st = {};
      effect(G, 2.4, (dt, age) => { col.material.opacity = 0.5 * (1 - age / 2.4); col.rotation.y += dt * 2; if (Math.random() < 0.8) burst(G, ground.clone().add(V((Math.random() - 0.5) * 10, 0.5, (Math.random() - 0.5) * 10)), 0xff7a1a, 1, 8, 0.6, 0.5); st.dt = dt; if (owner) { st.tick = (st.tick ?? 0.4) - dt; if (st.tick <= 0) { st.tick = 0.4; for (const t of targetsNear(G, caster, ground, 8)) G.hit(caster, t, { dmg: 3, fx: "fire" }); } } }, [col]);
      if (owner) for (const t of targetsNear(G, caster, q, 10)) G.hit(caster, t, { dmg: 40, kb: away(q, t.pos, 40, 22), rag: 2, ub: 1, fx: "fire" });
    };
    return;
  }
  if (M === "rend4") { // Blood Shrine (DOMAIN)
    pose("sign", 1.0); G.banner("DOMAIN EXPANSION", "Blood Shrine", "#ff3b4e", p0); G.sound("domain", p0);
    const shrine = new THREE.Group(), red = toon("#8a0f1c"), black = toon("#140406");
    for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), red); pl.position.set(x, 4.5, z); shrine.add(pl); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 4), black); roof.position.y = 11; roof.rotation.y = Math.PI / 4; shrine.add(roof);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 1), toon("#ff3b4e", true)); mouth.position.set(0, 6, 3.2); shrine.add(mouth);
    shrine.position.copy(p0).addScaledVector(fwd, 15); shrine.rotation.y = d + Math.PI; // (looms in front of the caster, facing them) shrine.scale.setScalar(0.01); G.scene.add(shrine);
    const D = dome(G, p0, 0x3a0008, 0.78, 8, [shrine]), st = {};
    effect(G, 8, (dt, age) => {
      const f = D.update(age); shrine.scale.setScalar(Math.max(0.01, Math.min(1, age / 0.9) * f));
      if (Math.random() < 0.5) slashLine(G, p0.clone().add(V((Math.random() - 0.5) * 36, 1 + Math.random() * 8, (Math.random() - 0.5) * 36)), 0xff2a40, 7);
      st.dt = dt;
      if (age > 0.6) domainTick(G, caster, owner, p0, 0.4, () => ({ dmg: 5, stun: 0.2, kb: [(Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6], ub: 1, fx: "slash" }), st);
    }, D.objs);
    return;
  }

  // ===== ROOK =====
  if (M === "rook1") { // Rush Punch: dash in; sometimes it SPARKS
    pose("point", 0.35); G.sound("dash", p0);
    if (owner) { caster.dashT = 0.28; caster.dashV = fwd.clone().multiplyScalar(62); caster.lockT = 0.3; }
    let done = false;
    effect(G, 0.4, (dt) => {
      if (Math.random() < 0.8) burst(G, caster.pos.clone().add(V(0, 2.5, 0)), 0xffb060, 2, 3, 0.3, 0.4);
      if (!owner || done) return;
      const t = targetsNear(G, caster, caster.pos.clone().addScaledVector(fwdOf(caster.facing), 2), 2.6)[0];
      if (t) {
        done = true; caster.dashT = 0;
        const crit = Math.random() < 0.3;
        G.hit(caster, t, crit ? { dmg: 35, kb: [fwd.x * 42, 14, fwd.z * 42], rag: 1.6, fx: "spark" } : { dmg: 14, kb: [fwd.x * 22, 6, fwd.z * 22], rag: 0.6, fx: "big" });
      }
    });
    return;
  }
  if (M === "rook2") { // Quake Slam
    pose("slam", 0.6);
    if (owner) caster.lockT = 0.5;
    let slammed = false;
    effect(G, 0.6, (dt, age) => {
      if (slammed || age < 0.32) return;
      slammed = true;
      const at = caster.kind === "remote" ? p0 : caster.pos.clone();
      wave(G, at, 0xffb060, 1, 12, 0.5); wave(G, at, 0xffffff, 1, 8, 0.35); G.shake(0.8, at); G.sound("slam", at);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), toon("#8a8579")); rock.position.copy(at).add(V(Math.cos(a) * 3, 0.5, Math.sin(a) * 3)); G.scene.add(rock); const v = V(Math.cos(a) * 8, 14 + Math.random() * 6, Math.sin(a) * 8); effect(G, 0.9, (dt2) => { rock.position.addScaledVector(v, dt2); v.y -= 40 * dt2; rock.rotation.x += dt2 * 6; }, [rock]); }
      if (owner) for (const t of targetsNear(G, caster, at, 10)) G.hit(caster, t, { dmg: 12, kb: away(at, t.pos, 16, 26), rag: 1.2, fx: "big" });
    });
    return;
  }
  if (M === "rook3") { // Meteor Drop (ULTIMATE)
    pose("slam", 3); G.sound("jump", p0); G.text(p0, "METEOR DROP", "#ff8a1f", 1.1);
    if (owner) { caster.vel.set(fwd.x * 20, 46, fwd.z * 20); caster.grounded = false; caster.meteor = true; }
    const fireBall = ball(G, 0xff5a10, 2.2, 0.55);
    const e = keyed(effect(G, 4, (dt, age) => {
      if (e.ended) return false;
      fireBall.position.copy(caster.pos).add(V(0, 2.5, 0)); fireBall.scale.setScalar(2.2 + Math.sin(age * 30) * 0.3);
      if (Math.random() < 0.8) burst(G, fireBall.position, 0xff7a1a, 2, 5, 0.4, 0.5);
      if (owner && age > 0.3 && caster.grounded) { const at = caster.pos.clone(); G.pop(caster, data.f, at); e.pop(at); return false; }
      if (owner && age > 0.6 && caster.vel.y < 0) caster.vel.y = Math.min(caster.vel.y, -60); // (crashes down fast)
    }, [fireBall]));
    e.pop = (p) => {
      e.ended = true; caster.meteor = false; caster.poseT = 0.3;
      const q = V(...(p.toArray ? p.toArray() : p));
      boom(G, q.clone().add(V(0, 1, 0)), 0xff7a1a, 13, 0.6); wave(G, q, 0xffd060, 2, 18, 0.7); wave(G, q, 0x3a2a20, 2, 12, 1.4, 0.7); G.shake(1.6, q); G.sound("boom", q); G.sound("slam", q);
      if (owner) for (const t of targetsNear(G, caster, q, 13)) G.hit(caster, t, { dmg: 40, kb: away(q, t.pos, 36, 24), rag: 2, ub: 1, fx: "big" });
    };
    return;
  }
  if (M === "rook4") { // Titan Awakening: grow huge for 10 seconds
    pose("flex", 1.0); G.banner("AWAKENING", "Titan", "#ff8a1f", p0); G.sound("domain", p0); G.shake(1, p0);
    const aura = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 9, 16, 1, true), mat(0xff8a1f, 0.35, true, THREE.DoubleSide)); G.scene.add(aura);
    caster.titan = 10;
    if (owner) { caster.dmgMul = 1.5; caster.takeMul = 0.5; }
    effect(G, 10, (dt, age) => {
      if (!caster.g) return false; // (switched fighter / left)
      const s = Math.min(1, age / 0.6) * (age > 9.5 ? (10 - age) * 2 : 1);
      caster.g.scale.setScalar(1 + 0.6 * s);
      aura.position.copy(caster.pos).add(V(0, 4.5 * (1 + 0.6 * s), 0)); aura.scale.setScalar(1 + 0.6 * s); aura.rotation.y += dt * 4; aura.material.opacity = 0.25 + Math.sin(age * 20) * 0.1;
      if (Math.random() < 0.4) burst(G, caster.pos.clone().add(V((Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4)), 0xffb060, 1, 6, 0.5, 0.4);
      if (age > 9.9 || caster.dead) { caster.g.scale.setScalar(1); caster.titan = 0; if (owner) { caster.dmgMul = 1; caster.takeMul = 1; } return false; }
    }, [aura]);
    return;
  }

  // ===== SHADE =====
  if (M === "shade1") { // Shadow Hounds
    pose("sign", 0.5); G.sound("howl", p0);
    const target = G.byId(data.t), side = V(Math.cos(d), 0, -Math.sin(d));
    for (const s of [-1, 1]) {
      const wolf = new THREE.Group(), bodyM = toon("#07090b"), eyeM = toon("#3fe0b0", true);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 2.6), bodyM); b.position.y = 1.3; wolf.add(b);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.1), bodyM); h.position.set(0, 1.8, 1.6); wolf.add(h);
      for (const ex of [-0.22, 0.22]) { const e2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), eyeM); e2.position.set(ex, 1.95, 2.16); wolf.add(e2); }
      for (const ex of [-0.3, 0.3]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), bodyM); ear.position.set(ex, 2.4, 1.4); wolf.add(ear); }
      const legs = [];
      for (const [lx, lz] of [[-0.4, 0.9], [0.4, 0.9], [-0.4, -0.9], [0.4, -0.9]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.3), bodyM); l.position.set(lx, 0.5, lz); wolf.add(l); legs.push(l); }
      wolf.position.copy(p0).addScaledVector(side, s * 2.5); wolf.rotation.y = d; G.scene.add(wolf);
      burst(G, wolf.position, 0x3fe0b0, 8, 6, 0.5);
      let bit = false;
      effect(G, 3, (dt, age) => {
        const goal = target && !target.dead ? target.pos : wolf.position.clone().addScaledVector(fwdOf(wolf.rotation.y), 10);
        const to = V(goal.x - wolf.position.x, 0, goal.z - wolf.position.z), dist = to.length();
        if (dist > 0.1) { const want = Math.atan2(to.x, to.z); let df = want - wolf.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); wolf.rotation.y += df * Math.min(1, dt * 8); }
        wolf.position.addScaledVector(fwdOf(wolf.rotation.y), 36 * dt); wolf.position.y = 0;
        legs.forEach((l, i) => (l.rotation.x = Math.sin(age * 30 + i * 1.6) * 0.8));
        if (owner && !bit) { const t = targetsNear(G, caster, wolf.position, 2.2)[0]; if (t) { bit = true; G.hit(caster, t, { dmg: 8, stun: 0.5, kb: [fwdOf(wolf.rotation.y).x * 8, 3, fwdOf(wolf.rotation.y).z * 8], fx: "shadow" }); } }
        if (bit || age > 2.9 || (target && dist < 1.5)) { burst(G, wolf.position.clone().add(V(0, 1.2, 0)), 0x05080a, 10, 7, 0.5, 0.5); return false; }
      }, [wolf]);
    }
    return;
  }
  if (M === "shade2") { // Shadow Step: sink into the shadows, come out behind someone and kick
    pose("sign", 0.25); G.sound("shadow", p0);
    const puddle = (at) => { const m = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), mat(0x020304, 0.9, false)); m.rotation.x = -Math.PI / 2; m.position.copy(at).setY(at.y + 0.08); G.scene.add(m); burst(G, at.clone().add(V(0, 1, 0)), 0x3fe0b0, 10, 7, 0.5, 0.35); effect(G, 1.2, (dt, age) => { m.material.opacity = 0.9 * (1 - age / 1.2); }, [m]); };
    puddle(p0);
    const e = keyed(effect(G, 0.6, () => !e.ended));
    e.pop = (p) => { e.ended = true; puddle(V(...(p.toArray ? p.toArray() : p))); };
    if (owner) {
      const t = aimTarget(G, caster, 30, 1.1);
      let to;
      if (t) { const dir = V(t.pos.x - caster.pos.x, 0, t.pos.z - caster.pos.z).normalize(); to = t.pos.clone().addScaledVector(dir, 2.6); caster.facing = Math.atan2(-dir.x, -dir.z); }
      else to = caster.pos.clone().addScaledVector(fwd, 15);
      caster.pos.copy(to); G.arena.collide(caster.pos, 0.9, 5, true); caster.vel.set(0, 0, 0);
      G.pop(caster, data.f, caster.pos); e.pop(caster.pos.clone());
      if (t) { caster.punchT = 0.01; caster.punchKick = true; const dir = fwdOf(caster.facing); G.hit(caster, t, { dmg: 12, kb: [dir.x * 26, 9, dir.z * 26], rag: 0.9, fx: "shadow" }); }
    }
    return;
  }
  if (M === "shade3") { // Great Serpent (ULTIMATE)
    pose("sign", 0.8); G.sound("shadow", p0);
    const at = V(...data.x), pool = new THREE.Mesh(new THREE.CircleGeometry(7, 32), mat(0x020304, 0, false)); pool.rotation.x = -Math.PI / 2; pool.position.copy(at).setY(at.y + 0.08); G.scene.add(pool);
    const rim = flatRing(G, 0x3fe0b0, at.clone().setY(at.y + 0.1), 0); rim.scale.setScalar(7);
    const snake = new THREE.Group(), segs = [], bodyM = toon("#07090b");
    for (let i = 0; i < 16; i++) { const r = 2.6 - i * 0.1, s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), bodyM); snake.add(s); segs.push(s); }
    for (const ex of [-0.9, 0.9]) { const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), toon("#3fe0b0", true)); e2.position.set(ex, 0.8, 1.9); segs[0].add(e2); }
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 6), bodyM); jaw.rotation.x = Math.PI / 2; jaw.position.z = 2.4; segs[0].add(jaw);
    snake.position.copy(at); snake.rotation.y = d; snake.visible = false; G.scene.add(snake);
    let rose = false;
    effect(G, 2.6, (dt, age) => {
      pool.material.opacity = Math.min(0.95, age * 3) * (age > 2.2 ? (2.6 - age) * 2.5 : 1); rim.material.opacity = pool.material.opacity * 0.8;
      if (age < 0.55) return;
      if (!rose) { rose = true; snake.visible = true; G.sound("serpent", at); G.shake(1.4, at); wave(G, at, 0x3fe0b0, 2, 14, 0.6); burst(G, at.clone().add(V(0, 1, 0)), 0x05080a, 24, 18, 0.8, 0.7); G.text(at, "GREAT SERPENT", "#3fe0b0", 1.1);
        if (owner) for (const t of targetsNear(G, caster, at, 6.5)) G.hit(caster, t, { dmg: 38, kb: away(at, t.pos, 10, 42), rag: 2.2, ub: 1, fx: "shadow" }); }
      const k = Math.min(1, (age - 0.55) / 0.5), sink = age > 1.9 ? Math.min(1, (age - 1.9) / 0.6) : 0;
      segs.forEach((s, i) => { const u = i / segs.length, h = (1 - u) * 18 * k * (1 - sink); s.position.set(Math.sin(u * 4 + age * 3) * 1.5, h - 2 - sink * 6, -Math.sin(u * Math.PI) * 6 * k); });
    }, [pool, rim, snake]);
    return;
  }
  if (M === "shade4") { // Shadow Garden (DOMAIN)
    pose("sign", 1.0); G.banner("DOMAIN EXPANSION", "Shadow Garden", "#3fe0b0", p0); G.sound("domain", p0);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(DOMAIN_R, 48), mat(0x010203, 0, false)); floor.rotation.x = -Math.PI / 2; floor.position.copy(p0).setY(p0.y + 0.1); G.scene.add(floor);
    const tendrils = [];
    for (let i = 0; i < 26; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.45, 6 + Math.random() * 5, 5), toon("#07090b")); const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (DOMAIN_R - 6); t.position.copy(p0).add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); t.userData.ph = Math.random() * 6; G.scene.add(t); tendrils.push(t); }
    const D = dome(G, p0, 0x02130e, 0.75, 9, [floor, ...tendrils]), st = {};
    if (owner) caster.garden = 9;
    effect(G, 9, (dt, age) => {
      const f = D.update(age); floor.material.opacity = 0.95 * f;
      for (const t of tendrils) { t.scale.y = Math.min(1, age * 1.5) * f; t.position.y = p0.y + t.geometry.parameters.height * 0.5 * t.scale.y - 0.3; t.rotation.z = Math.sin(age * 2 + t.userData.ph) * 0.35; t.rotation.x = Math.cos(age * 1.7 + t.userData.ph) * 0.35; }
      st.dt = dt;
      if (age > 0.6) domainTick(G, caster, owner, p0, 0.5, { dmg: 4, slow: 0.8, stun: 0.15, ub: 1, fx: "shadow" }, st);
    }, D.objs);
    return;
  }
}

// What the caster needs to send so everyone else can show the move (aim point / target picked by the owner's game).
export function castData(G, caster, key) {
  const data = { p: caster.pos.toArray().map((v) => Math.round(v * 100) / 100), d: Math.round(caster.facing * 1000) / 1000 };
  if (caster.char === "shade" && key === "1") { const t = aimTarget(G, caster, 70, 1.2); if (t) data.t = t.id; }
  if (caster.char === "shade" && key === "3") {
    const t = aimTarget(G, caster, 55, 0.9), x = t ? t.pos.clone() : caster.pos.clone().addScaledVector(fwdOf(caster.facing), 20);
    x.y = G.arena.floorAt(x.x, x.z, x.y + 0.5); data.x = x.toArray().map((v) => Math.round(v * 100) / 100);
  }
  return data;
}
