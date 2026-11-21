// MUD VALLEY RP: how things move. Arcade driving (gas, brakes, steering, drifting, hills, jumps, mud, water)
// and walking around on foot. Not a real simulator, just fun!
import { groundAt as terrainAt, surfaceAt, SURF, normalAt, mudDepthAt, hAt } from "./terrain.js";
// extra things you can drive on top of (trailer ramps + decks): main.js sets this
let PLAT = null;
export function setPlatforms(fn) { PLAT = fn; }
function groundAt(x, z) { const g = terrainAt(x, z); return PLAT ? Math.max(g, PLAT(x, z)) : g; }
import { WATER_Y, EDGE } from "./layout.js";
import { pushOut } from "./colliders.js";
import { tune } from "./vehicles.js";
import * as THREE from "/create/vendor/three.module.js";

export const G = 24; // gravity (a bit stronger than real life so jumps feel snappy)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const N = new THREE.Vector3();

// a driving body for an owned (or AI) vehicle
export function makeBody(car, model) {
  return {
    car, model, t: tune(car), x: car.x, y: groundAt(car.x, car.z), z: car.z, yaw: car.yaw, vx: 0, vy: 0, vz: 0,
    yawRate: 0, steer: 0, air: false, airT: 0, pitch: 0, roll: 0, bodyPitch: 0, bodyRoll: 0, susp: 0, suspV: 0,
    vf: 0, surf: 0, depth: 0, flipped: false, slip: 0, thr: 0, boost: 0, wheelDrop: [0, 0, 0, 0, 0, 0], land: 0, hit: 0, splash: 0,
    wheelie: false, wa: 0, wheelieT: 0, wheelieDone: 0, offGas: 0, burn: false,
    mudD: 0, mudT: 0, sink: 0, spin: 0, stuckT: 0, lastThr: 0, rockT: 0, flood: 0, floodT: 0, rutD: 0,
  };
}
export const retune = (b) => { b.t = tune(b.car); };

// how good a vehicle is on this ground: [top speed, speeding up, grip]
function surfaceK(t, s) {
  switch (s) {
    case SURF.ROAD: case SURF.TOWN: return [1, 1, 1];
    case SURF.DIRT: case SURF.TRACK: case SURF.ROCK: return [t.off.dirt, 0.45 + 0.55 * t.off.dirt, 0.68 + 0.3 * t.off.dirt];
    case SURF.MUD: return [t.off.mud * 0.85, 0.25 + 0.6 * t.off.mud, 0.42 + 0.4 * t.off.mud];
    case SURF.WATER: return [0.45 + 0.4 * t.off.mud, 0.3 + 0.5 * t.off.mud, 0.5];
    default: return [t.off.grass, 0.4 + 0.6 * t.off.grass, 0.62 + 0.32 * t.off.grass]; // grass, sand
  }
}

// one step of driving. inp = { thr: -1..1 (gas / brake+reverse), steer: -1..1 (right is +), hand: handbrake }
export function stepCar(b, inp, dt) {
  const t = b.t, M = b.model;
  if (t.boat) return stepBoat(b, inp, dt);
  b.hit = 0; b.land = 0;
  // flooded engine (the air intake went under water or mud): it dies until you get out of there (a snorkel helps!)
  const thr = b.flipped || b.flood > 0.5 ? 0 : inp.thr, steerIn = b.flipped ? 0 : inp.steer;
  b.thr = thr;
  // dirt bikes + quads: burnouts (hold W and S together) and wheelies (T, then keep holding W)
  const tricks = t.wheelie && !b.flipped;
  b.burn = tricks && !!inp.burn && !b.air;
  if (tricks && inp.wheelie) { b.wheelie = !b.wheelie; if (b.wheelie) b.offGas = 0; }
  if (b.wheelie) {
    b.offGas = thr > 0.1 || b.air ? 0 : b.offGas + dt;
    if (!tricks || b.burn || b.offGas > 0.3 || thr < -0.1) b.wheelie = false;
  }
  const waTarget = b.wheelie ? (t.quad ? 0.5 : 0.66) + Math.sin(performance.now() / 260) * 0.05 : 0;
  b.wa += (waTarget - b.wa) * Math.min(1, dt * (b.wheelie ? 3.2 : 7));
  if (b.wa < 0.004) b.wa = 0;
  if (b.wa > 0.35 && !b.air) b.wheelieT += dt;
  else if (!b.wheelie && b.wa < 0.15) { if (b.wheelieT > 0) { b.wheelieDone = b.wheelieT; if (b.wheelieT > 0.4) b.suspV -= 2.5; } b.wheelieT = 0; }
  const gy = groundAt(b.x, b.z);
  b.surf = surfaceAt(b.x, b.z); b.depth = b.surf === SURF.MUD ? 0 : Math.max(0, WATER_Y - gy);
  if (b.depth > 0.12) b.surf = SURF.WATER;
  let [kSpd, kAcc, kGrip] = surfaceK(t, b.surf);
  // MUD: the deeper it is, the more it grabs you. Good mud tires + lift + big wheels plow through, street cars bog down.
  b.mudD = b.surf === SURF.MUD && !b.air ? mudDepthAt(b.x, b.z) : 0;
  const md = b.mudD, bad = Math.max(0.35, 1.12 - t.off.mud); // (bad = how much this ride hates mud)
  if (md > 0) { const k = 1 / (1 + md * 1.5 * bad); kSpd *= k; kAcc *= 0.55 + 0.45 * k; kGrip *= 1 - 0.3 * Math.min(1, md); }
  // muddy tires slip a little on the road until the mud flies off
  const tm = (b.car && b.car.tmud) || 0; if (tm > 0.05 && (b.surf === SURF.ROAD || b.surf === SURF.TOWN)) kGrip *= 1 - 0.18 * tm;
  // flooding: water or mud up over the air intake (snorkels raise it way up)
  const sub = Math.max(b.surf === SURF.WATER ? b.depth : 0, md);
  b.flood = sub > (t.intake || 1) && !b.air ? Math.min(1, b.flood + dt * 1.5) : Math.max(0, b.flood - dt * 0.6);
  b.floodT = b.flood > 0.5 ? b.floodT + dt : 0;
  // overheating (4-wheelers): the radiator sits down low and clogs with mud. Hot = half power until it cools off.
  if (t.quad) {
    const hot = md > 0.25 && !t.rad ? (0.05 + md * 0.12 + (thr > 0.5 ? 0.06 : 0)) : -0.07;
    b.heat = Math.max(0, Math.min(1.25, (b.heat || 0) + hot * dt)); if (b.heat > 1) { kAcc *= 0.5; kSpd *= 0.75; }
  } else b.heat = 0;
  b.steer += (steerIn - b.steer) * Math.min(1, dt * 7);
  if (!b.air) {
    // steering: turns faster at medium speed, slower at very high speed
    const sp = Math.hypot(b.vx, b.vz), fwdSign = b.vf < -0.3 ? -1 : 1;
    const curve = t.pivot ? 1 : sp < 5 ? sp / 5 : 1 - 0.42 * Math.min(1, (sp - 5) / (t.top * 0.9 + 1)); // (zero-turn mowers + skid steers spin in place)
    let target = -b.steer * t.turn * curve * fwdSign * (inp.hand ? 1.45 : 1) * (b.wa > 0.2 ? 0.45 : 1);
    if (b.burn) target = -b.steer * 2.6; // (a burnout + steering = spin around in a circle)
    b.yawRate += (target - b.yawRate) * Math.min(1, dt * 10);
    b.yaw += b.yawRate * dt;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
    let vf = b.vx * fx + b.vz * fz, vs = b.vx * sx + b.vz * sz;
    const top = t.top * kSpd;
    if (b.burn) { vf *= Math.exp(-6 * dt); }
    else if (thr > 0.05) {
      if (vf < -0.5) vf += 24 * thr * dt;
      else vf += t.acc * kAcc * thr * Math.max(0.06, 1 - (vf / Math.max(1, top)) ** 2) * dt;
    } else if (thr < -0.05) {
      if (vf > 0.5) vf -= 22 * (t.brake || 1) * -thr * dt;
      else vf = Math.max(vf - t.acc * 0.55 * kAcc * -thr * dt, -Math.max(5, top * 0.32));
    } else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.4 + (1 - kSpd) * 7) * dt);
    if (vf > top) vf -= (vf - top) * Math.min(1, 2.2 * dt);
    if (inp.hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    if (b.depth > 0.2) vf -= vf * Math.min(1, b.depth * 1.6 * dt);
    b.spin = 0;
    if (md > 0) {
      b.mudT += dt;
      vf -= vf * Math.min(1, (0.25 + md * 0.9) * bad * dt); // the mud sucks at the tires
      // gas in the mud: the wheels spin + throw mud (roost), the back end wiggles (fishtail)
      if (thr > 0.25) {
        b.spin = thr * Math.max(0, 1 - Math.abs(vf) / Math.max(4, top * 0.6)) * Math.min(1, 0.4 + md);
        const wig = (Math.sin(b.mudT * 3.3) + 0.6 * Math.sin(b.mudT * 7.9 + 1.3)) * thr * Math.min(1, sp / 8) * bad;
        b.yawRate += wig * (t.bike ? 1.2 : 2.2) * dt;
      }
      // stuck in deep mud? rock it: go forward, then back, then forward (W, S, W) to bounce out
      const s0 = Math.sign(b.lastThr), s1 = thr > 0.3 ? 1 : thr < -0.3 ? -1 : 0;
      if (s1 && s0 && s1 !== s0 && b.rockT < 0.9 && sp < 3) { vf += s1 * (1.6 + 2.2 * t.off.mud); b.suspV += 1.2; b.rocked = 0.5; }
      if (s1) { if (s1 !== s0) b.rockT = 0; b.lastThr = s1; }
      b.rockT += dt;
      b.stuckT = md > 0.35 && sp < 1.2 && Math.abs(thr) > 0.3 ? b.stuckT + dt : Math.max(0, b.stuckT - dt * 2);
    } else { b.stuckT = 0; b.lastThr = 0; }
    b.rocked = Math.max(0, (b.rocked || 0) - dt);
    const grip = t.grip * kGrip * (inp.hand ? 0.13 : 1);
    vs *= Math.exp(-grip * dt);
    b.slip = b.burn ? 9 : Math.max(Math.abs(vs), b.spin * 8);
    b.vf = vf;
    b.vx = fx * vf + sx * vs; b.vz = fz * vf + sz * vs;
    // hills pull you back (or help you roll down). Off-road rides (good "crawl") grip and crawl up steep hills;
    // road cars run out of grip on steep slopes, spin their wheels and slide back down.
    normalAt(b.x, b.z, N);
    const sl = Math.hypot(N.x, N.z), up = -(N.x * fx + N.z * fz), assist = 0.75 * t.crawl;
    const climbing = thr > 0.05 && up > 0.03;
    const k = G * (climbing ? 1 - assist : 1 - 0.3 * assist);
    b.vx += N.x * k * dt; b.vz += N.z * k * dt;
    const maxSl = (0.3 + 0.75 * t.crawl) * (b.surf === SURF.MUD ? 0.8 : b.surf === SURF.WATER ? 0.85 : 1);
    b.spinOut = 0;
    if (climbing && sl > maxSl) {
      const ex = Math.min(0.6, sl - maxSl);
      b.vx += N.x * G * ex * 3 * dt; b.vz += N.z * G * ex * 3 * dt; // too steep: the wheels spin and you slide back
      b.spinOut = ex; b.slip = Math.max(b.slip, 6);
    }
    b.boost = thr > 0.5 ? Math.min(1, b.boost + dt * 2) : Math.max(0, b.boost - dt * 3);
    // little bumps on rough ground
    if (b.surf !== SURF.ROAD && b.surf !== SURF.TOWN) b.suspV += (Math.random() - 0.5) * Math.min(1, sp / 12) * 18 * dt;
  } else {
    // in the air: you can still twist a bit, and tilt the nose with gas / brake
    b.yaw += -steerIn * 1.4 * dt;
    b.vx *= 1 - 0.05 * dt; b.vz *= 1 - 0.05 * dt;
    b.pitch += (thr * 0.8 - b.pitch * 1.2) * dt;
    b.airT += dt;
  }
  if (b.flipped) { b.vx *= Math.exp(-3 * dt); b.vz *= Math.exp(-3 * dt); }
  // move
  // (the fence around the valley is an invisible wall)
  const nx0 = b.x + b.vx * dt, nz0 = b.z + b.vz * dt;
  b.x = clamp(nx0, -EDGE, EDGE); b.z = clamp(nz0, -EDGE, EDGE);
  if (b.x !== nx0) { b.hit = Math.max(b.hit, Math.abs(b.vx)); b.vx *= -0.3; b.atEdge = 1; }
  if (b.z !== nz0) { b.hit = Math.max(b.hit, Math.abs(b.vz)); b.vz *= -0.3; b.atEdge = 1; }
  const gn = groundAt(b.x, b.z);
  if (!b.air) {
    const freeY = b.y + (b.vy - G * t.air * dt) * dt;
    if (freeY > gn + 0.09 && b.vy > 2) { b.air = true; b.airT = 0; b.vy -= G * t.air * dt; b.y = freeY; }
    else { b.vy = clamp((gn - b.y) / dt, -12, 16); b.y = gn; }
  } else {
    b.vy -= G * t.air * dt; b.y += b.vy * dt;
    if (b.y <= gn) {
      const impact = -b.vy;
      b.y = gn; b.air = false; b.land = impact; b.suspV -= Math.min(impact, 20) * 0.12; b.vy = 0;
      // land at a crazy angle = tip over
      if (Math.abs(b.pitch) > 1.15 || Math.abs(b.roll) > 1.1) b.flipped = true;
      b.pitch = clamp(b.pitch, -0.5, 0.5);
    }
  }
  // bump into buildings, trees, rocks...
  const len = M ? M.len : 4, wid = M ? M.wid : 2;
  const circles = len > 3 ? [len * 0.27, -len * 0.27] : [0];
  const r = len > 3 ? wid * 0.5 : Math.max(len, wid) * 0.42;
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  for (const off of circles) {
    const cx = b.x + fx * off, cz = b.z + fz * off, p = pushOut(cx, cz, r, b.y + 0.5);
    if (!p.hit) continue;
    b.x += p.x - cx; b.z += p.z - cz;
    const vn = b.vx * p.nx + b.vz * p.nz;
    if (vn < 0) { b.vx -= p.nx * vn * 1.35; b.vz -= p.nz * vn * 1.35; b.hit = Math.max(b.hit, -vn); b.yawRate *= 0.5; }
  }
  // tilt the vehicle to match the ground under its wheels
  const hl = len * 0.36, hw = wid * 0.4, sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
  const hF = groundAt(b.x + fx * hl, b.z + fz * hl), hB = groundAt(b.x - fx * hl, b.z - fz * hl);
  const hL = groundAt(b.x + sx * hw, b.z + sz * hw), hR = groundAt(b.x - sx * hw, b.z - sz * hw);
  if (!b.air) {
    const tp = Math.atan2(hF - hB, hl * 2), tr = Math.atan2(hL - hR, hw * 2);
    b.pitch += (tp - b.pitch) * Math.min(1, dt * 14);
    b.roll += ((b.flipped ? 1.55 : t.bike ? clamp(-b.yawRate * b.vf * 0.028, -0.42, 0.42) : tr) - b.roll) * Math.min(1, dt * (b.flipped ? 4 : 12));
    // tipping over on a super steep side slope
    if (!t.bike && Math.abs(tr) > 0.88 && Math.hypot(b.vx, b.vz) > 4) b.flipped = true;
    b.y = Math.max(b.y, (hF + hB) / 2 - 0.15);
  } else if (t.bike) b.roll *= 1 - dt * 2;
  // sinking: sit still in deep mud and you slowly settle down into it
  { const sp2 = Math.hypot(b.vx, b.vz), want = md > 0.15 ? Math.min(0.2, md * 0.15) * (sp2 < 1.5 ? 1 : 0.35) : 0; b.sink += (want - b.sink) * Math.min(1, dt * (want > b.sink ? 0.5 : 3)); }
  // body lean (the body sways a bit on its springs)
  const tbp = b.air || !(t.bike || t.quad) ? 0 : clamp(-thr * 0.03 * (b.vf > 0 ? 1 : -1) + (inp.hand ? 0.04 : 0), -0.06, 0.06); // (trucks + cars stay level)
  const tbr = b.air || t.bike ? 0 : clamp(b.yawRate * b.vf * 0.008, -0.09, 0.09);
  b.bodyPitch += (tbp - b.bodyPitch) * Math.min(1, dt * 5); b.bodyRoll += (tbr - b.bodyRoll) * Math.min(1, dt * 5);
  b.suspV += (-b.susp * 140 - b.suspV * 11) * dt; b.susp = clamp(b.susp + b.suspV * dt, -0.32, 0.25);
  // each wheel reaches down to the ground
  if (M) M.wheels.forEach((w, i) => {
    if (b.air) { b.wheelDrop[i] = Math.max(b.wheelDrop[i] - dt * 2, -0.25); return; }
    if (b.wa > 0.03 && w.front) { b.wheelDrop[i] = 0; return; } // (the front wheel is up in the air)
    const wx = b.x + fx * w.z + sx * w.x, wz = b.z + fz * w.z + sz * w.x;
    const plane = b.y + Math.tan(b.pitch) * w.z + Math.tan(b.roll) * w.x;
    b.wheelDrop[i] = clamp(groundAt(wx, wz) - plane, -0.25, 0.25);
  });
  return b;
}
// ---------------------------------------------------------------- boats: float on the lake, plane at speed, crawl on land
export function stepBoat(b, inp, dt) {
  const t = b.t;
  b.hit = 0; b.land = 0; b.air = false; b.wa = 0; b.wheelie = false; b.burn = false; b.mudD = 0; b.flood = 0; b.floodT = 0;
  const bottom = hAt(b.x, b.z), depth = WATER_Y - bottom, afloat = depth > 0.45;
  b.depth = Math.max(0, depth); b.surf = afloat ? SURF.WATER : surfaceAt(b.x, b.z); b.beached = !afloat;
  const thr = b.flipped ? 0 : inp.thr, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
  let vf = b.vx * fx + b.vz * fz, vs = b.vx * sx + b.vz * sz;
  const sp = Math.hypot(b.vx, b.vz), top = afloat ? t.top : 2.2;
  b.steer += (inp.steer - b.steer) * Math.min(1, dt * 5);
  // the outboard turns the boat (even slow), more at speed; it slides a bit in turns
  const target = -b.steer * t.turn * (afloat ? Math.min(1, 0.35 + sp / 7) : 0.4) * (vf < -0.3 ? -1 : 1);
  b.yawRate += (target - b.yawRate) * Math.min(1, dt * (afloat ? 3.5 : 6)); b.yaw += b.yawRate * dt;
  if (thr > 0.05) vf += t.acc * (afloat ? 1 : 0.25) * thr * Math.max(0.05, 1 - (vf / Math.max(1, top)) ** 2) * dt;
  else if (thr < -0.05) vf = vf > 0.5 ? vf - 9 * -thr * dt : Math.max(vf - t.acc * 0.4 * -thr * dt, -Math.min(5, top * 0.3));
  vf -= vf * Math.min(1, (afloat ? 0.22 : 2.5) * dt); // water drag (and land = dragging the hull)
  if (vf > top) vf -= (vf - top) * Math.min(1, 3 * dt);
  vs *= Math.exp(-(afloat ? 1.7 : 6) * dt);
  b.vf = vf; b.slip = Math.abs(vs); b.vx = fx * vf + sx * vs; b.vz = fz * vf + sz * vs;
  b.boost = thr > 0.5 ? Math.min(1, b.boost + dt * 2) : Math.max(0, b.boost - dt * 3);
  const nx0 = b.x + b.vx * dt, nz0 = b.z + b.vz * dt;
  b.x = clamp(nx0, -EDGE, EDGE); b.z = clamp(nz0, -EDGE, EDGE);
  // bump into docks, rocks, trees...
  const M = b.model, len = M ? M.len : 6, wid = M ? M.wid : 2.3;
  for (const off of [len * 0.28, -len * 0.28]) {
    const cx = b.x + fx * off, cz = b.z + fz * off, p = pushOut(cx, cz, wid * 0.5, (afloat ? WATER_Y : bottom) + 0.4);
    if (!p.hit) continue;
    b.x += p.x - cx; b.z += p.z - cz;
    const vn = b.vx * p.nx + b.vz * p.nz; if (vn < 0) { b.vx -= p.nx * vn * 1.3; b.vz -= p.nz * vn * 1.3; b.hit = Math.max(b.hit, -vn); b.yawRate *= 0.5; }
  }
  // float (with little waves), the bow rises when it gets up on plane, and it leans into turns
  const bob = afloat ? Math.sin(performance.now() / 700 + b.x * 0.3) * 0.04 * (1 - Math.min(1, sp / 12)) : 0;
  const wantY = afloat ? WATER_Y - 0.32 + bob : bottom;
  b.y += (Math.max(wantY, bottom) - b.y) * Math.min(1, dt * (afloat ? 4 : 12)); b.vy = 0;
  const k = Math.min(1, Math.max(0, vf) / Math.max(1, t.top));
  const pt = afloat ? 0.13 * Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5) * (1 - 0.6 * Math.max(0, k - 0.45) / 0.55) + Math.sin(performance.now() / 900) * 0.01 : 0;
  b.pitch += (pt - b.pitch) * Math.min(1, dt * 2.5);
  const rl = afloat ? clamp(-b.yawRate * sp * 0.018, -0.2, 0.2) + Math.sin(performance.now() / 1100 + 1) * 0.012 : 0;
  b.roll += (rl - b.roll) * Math.min(1, dt * 3);
  b.bodyPitch = 0; b.bodyRoll = 0; b.susp = 0; b.suspV = 0; b.sink = 0;
  return b;
}

// put the 3D model where the body is
export function placeModel(b) {
  const M = b.model; if (!M) return;
  // a wheelie tips the whole ride back around its back wheel
  const wa = b.wa || 0, rz = M.rearZ || 0;
  M.root.position.set(b.x + Math.sin(b.yaw) * rz * (1 - Math.cos(wa)), b.y + 0.06 - rz * Math.sin(wa), b.z + Math.cos(b.yaw) * rz * (1 - Math.cos(wa)));
  M.root.rotation.set(-b.pitch - wa - (b.tPitch || 0), b.yaw + (b.tYaw || 0), b.roll + (b.tRoll || 0), "YXZ"); // (t* = air tricks: flips + whips)
  M.lift.position.y = (M.liftY || 0) + b.susp - (b.sink || 0) * 0.6;
  M.root.position.y -= (b.sink || 0) * 0.4;
  M.lift.rotation.set(-b.bodyPitch, 0, b.bodyRoll);
}
// flip back onto your wheels
export function unflip(b) {
  b.flipped = false; b.pitch = 0; b.roll = 0; b.vx = b.vz = b.vy = 0; b.yawRate = 0; b.air = true; b.airT = 0;
  b.y = groundAt(b.x, b.z) + 1.2;
}
export const speedOf = (b) => Math.hypot(b.vx, b.vz);

// ---------------------------------------------------------------- walking
export function makeWalker(x, z) { return { x, z, y: groundAt(x, z), vx: 0, vz: 0, vy: 0, yaw: 0, air: false, t: 0, moving: 0 }; }
// mx/mz = which way to go (already turned to match the camera), run = going fast, jump = jump now
export function stepWalker(p, mx, mz, run, jump, dt) {
  let sp = run ? 10 : 6.5; const l = Math.hypot(mx, mz);
  // steep hills slow you down a bit (but you can always keep walking up)
  if (l > 0.1 && !p.air) { normalAt(p.x, p.z, N); const up = -(N.x * mx + N.z * mz) / l; if (up > 0.45) sp *= Math.max(0.5, 1 - (up - 0.45) * 1.1); }
  const tx = l > 0.1 ? (mx / Math.max(1, l)) * sp : 0, tz = l > 0.1 ? (mz / Math.max(1, l)) * sp : 0;
  const k = Math.min(1, dt * (p.air ? 3 : 12));
  p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
  if (l > 0.1) { const ty = Math.atan2(mx, mz); let d = ty - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * Math.min(1, dt * 12); }
  p.x = clamp(p.x + p.vx * dt, -EDGE, EDGE); p.z = clamp(p.z + p.vz * dt, -EDGE, EDGE);
  const r = pushOut(p.x, p.z, 0.4, p.y + 0.3);
  if (r.hit) {
    p.x = r.x; p.z = r.z;
    // a low ledge (a rock, a fence, a hay bale...) in the way? hop up over it instead of getting stuck
    if (!p.air && l > 0.1 && r.top - p.y < 1.7 && r.top - p.y > 0.25 && !p.noHop) { p.vy = 8; p.air = true; p.hopped = true; }
  }
  const g = groundAt(p.x, p.z), water = WATER_Y - g;
  if (jump && !p.air) { p.vy = 8.5; p.air = true; }
  if (p.air) { p.vy -= G * dt; p.y += p.vy * dt; if (p.y <= g) { p.y = g; p.air = false; p.vy = 0; } }
  else { if (p.y - g > 0.6) { p.air = true; p.vy = 0; } else p.y = g; }
  if (water > 0.6) { p.y = Math.max(p.y, WATER_Y - 0.6); p.air = false; } // wading through the river
  p.moving = Math.hypot(p.vx, p.vz); p.t += dt;
  return p;
}

// two moving things bump each other apart (cars, you, parked cars)
export function bumpPair(a, ra, b, rb, fixedB) {
  const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), m = ra + rb;
  if (d >= m || d < 1e-5) return 0;
  const nx = dx / d, nz = dz / d, pen = m - d;
  if (fixedB) { a.x += nx * pen; a.z += nz * pen; }
  else { a.x += nx * pen * 0.5; a.z += nz * pen * 0.5; b.x -= nx * pen * 0.5; b.z -= nz * pen * 0.5; }
  const rv = ((a.vx || 0) - (b.vx || 0)) * nx + ((a.vz || 0) - (b.vz || 0)) * nz;
  if (rv < 0) {
    const j = rv * (fixedB ? 1.3 : 0.65);
    if (a.vx !== undefined) { a.vx -= nx * j; a.vz -= nz * j; }
    if (!fixedB && b.vx !== undefined) { b.vx += nx * j; b.vz += nz * j; }
  }
  return -rv;
}
