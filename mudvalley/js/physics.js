// MUD VALLEY RP: how things move. Arcade driving (gas, brakes, steering, drifting, hills, jumps, mud, water)
// and walking around on foot. Not a real simulator, just fun!
import { groundAt, surfaceAt, SURF, normalAt } from "./terrain.js";
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
  b.hit = 0; b.land = 0;
  const thr = b.flipped ? 0 : inp.thr, steerIn = b.flipped ? 0 : inp.steer;
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
  b.surf = surfaceAt(b.x, b.z); b.depth = Math.max(0, WATER_Y - gy);
  if (b.depth > 0.12) b.surf = SURF.WATER;
  const [kSpd, kAcc, kGrip] = surfaceK(t, b.surf);
  b.steer += (steerIn - b.steer) * Math.min(1, dt * 7);
  if (!b.air) {
    // steering: turns faster at medium speed, slower at very high speed
    const sp = Math.hypot(b.vx, b.vz), fwdSign = b.vf < -0.3 ? -1 : 1;
    const curve = sp < 5 ? sp / 5 : 1 - 0.42 * Math.min(1, (sp - 5) / (t.top * 0.9 + 1));
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
      if (vf > 0.5) vf -= 22 * -thr * dt;
      else vf = Math.max(vf - t.acc * 0.55 * kAcc * -thr * dt, -Math.max(5, top * 0.32));
    } else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.4 + (1 - kSpd) * 7) * dt);
    if (vf > top) vf -= (vf - top) * Math.min(1, 2.2 * dt);
    if (inp.hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
    if (b.depth > 0.2) vf -= vf * Math.min(1, b.depth * 1.6 * dt);
    const grip = t.grip * kGrip * (inp.hand ? 0.13 : 1);
    vs *= Math.exp(-grip * dt);
    b.slip = b.burn ? 9 : Math.abs(vs);
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
  // body lean (the body sways a bit on its springs)
  const tbp = b.air ? 0 : clamp(-thr * 0.03 * (b.vf > 0 ? 1 : -1) + (inp.hand ? 0.04 : 0), -0.06, 0.06);
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
// put the 3D model where the body is
export function placeModel(b) {
  const M = b.model; if (!M) return;
  // a wheelie tips the whole ride back around its back wheel
  const wa = b.wa || 0, rz = M.rearZ || 0;
  M.root.position.set(b.x + Math.sin(b.yaw) * rz * (1 - Math.cos(wa)), b.y + 0.06 - rz * Math.sin(wa), b.z + Math.cos(b.yaw) * rz * (1 - Math.cos(wa)));
  M.root.rotation.set(-b.pitch - wa, b.yaw, b.roll, "YXZ");
  M.lift.position.y = (M.liftY || 0) + b.susp;
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
