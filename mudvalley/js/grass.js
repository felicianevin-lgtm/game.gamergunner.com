// MUD VALLEY RP: real grass blades that wave in the wind, all around you, on every grassy spot in the valley.
// Lawn mowers cut it: a mowed patch gets short (or DEEP, down to the dirt), gets those light + dark lawn stripes,
// then slowly grows back. Grass is made in 16 m squares that are built as you drive and thrown away behind you.
import * as THREE from "/create/vendor/three.module.js";
import { groundAt, surfaceAt, SURF } from "./terrain.js";

const CH = 16, STEP = 0.55, CELL = 0.5; // (square size, space between tufts, mow grid size)
export const CUT_H = [0.2, 0.12, 0.06, 0.015]; // how tall the grass is after mowing at each deck height
const GROW = 0.0016; // m per second it grows back
const key = (i, j) => (i + 8000) * 16000 + (j + 8000);
let seed = 1; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

function tuftGeo(blades) {
  const pos = [], nor = [];
  for (let k = 0; k < blades; k++) {
    const a = (k / blades) * Math.PI + rnd() * 0.6, ca = Math.cos(a), sa = Math.sin(a), w = 0.045 + rnd() * 0.03;
    const ox = (rnd() - 0.5) * 0.22, oz = (rnd() - 0.5) * 0.22, h = 0.7 + rnd() * 0.3, lean = (rnd() - 0.5) * 0.25;
    // a blade: two triangles, wide at the bottom, a point at the top (a little bend in the middle)
    const P = [[-w, 0], [w, 0], [w * 0.55, 0.5 * h], [-w * 0.55, 0.5 * h], [0, h]];
    const v = P.map(([x, y]) => [ox + x * ca + lean * y * sa, y, oz - x * sa + lean * y * ca]);
    for (const [a1, b1, c1] of [[0, 1, 2], [0, 2, 3], [3, 2, 4]]) for (const q of [a1, b1, c1]) { pos.push(...v[q]); nor.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export class Grass {
  constructor(scene, low) {
    this.scene = scene; this.R = low ? 26 : 44; this.chunks = new Map(); this.cut = new Map(); this.time = 0; this.regrowT = 0;
    this.U = { time: { value: 0 }, center: { value: new THREE.Vector2() }, radius: { value: this.R } };
    this.geo = tuftGeo(low ? 3 : 5);
    const U = this.U;
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float time, radius; uniform vec2 center; varying float vH;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
vH = position.y;
vec4 wo = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float fade = smoothstep(radius, radius - 9.0, distance(wo.xz, center));
transformed *= vec3(1.0, fade, 1.0);
float bend = vH * vH;
transformed.x += sin(time * 1.6 + wo.x * 0.33 + wo.z * 0.21) * 0.11 * bend + sin(time * 4.1 + wo.z) * 0.02 * bend;
transformed.z += cos(time * 1.25 + wo.z * 0.29 - wo.x * 0.1) * 0.08 * bend;`);
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vH;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.5, 1.12, clamp(vH, 0.0, 1.0));")
        .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);"); // (both sides of a blade get lit the same)
    };
    this.mat.customProgramCacheKey = () => "grass";
    this.queue = [];
  }
  // how tall the grass is at a spot right now (1 = not mowed)
  heightAt(x, z, base) {
    const c = this.cut.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!c) return base;
    return Math.min(base, c.h + (this.time - c.t) * GROW);
  }
  makeChunk(ci, cj) {
    const x0 = ci * CH, z0 = cj * CH, n = Math.ceil(CH / STEP), list = [];
    seed = (ci * 7919 + cj * 104729) >>> 0 || 1;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x = x0 + (a + rnd()) * STEP, z = z0 + (b + rnd()) * STEP;
      const r1 = rnd(), r2 = rnd(), r3 = rnd();
      if (Math.abs(x) < 118 && Math.abs(z) < 108) continue; // (not in the middle of town)
      if (surfaceAt(x, z) !== SURF.GRASS) continue;
      list.push(x, groundAt(x, z), z, r1 * 6.283, 0.28 + r2 * 0.24, r3);
    }
    const count = list.length / 6;
    const ck = { ci, cj, data: new Float32Array(list), count, mesh: null, dirty: false, hasCut: false };
    if (count) {
      const m = new THREE.InstancedMesh(this.geo, this.mat, count); m.frustumCulled = true;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      ck.mesh = m; this.fill(ck);
      m.computeBoundingSphere(); m.boundingSphere.radius += 1; this.scene.add(m);
    }
    this.chunks.set(key(ci, cj), ck);
  }
  fill(ck) {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), d = ck.data;
    let anyCut = false;
    for (let i = 0; i < ck.count; i++) {
      const x = d[i * 6], y = d[i * 6 + 1], z = d[i * 6 + 2], base = d[i * 6 + 4], tint = d[i * 6 + 5];
      const c = this.cut.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      let h = base, stripe = 0, scalp = 0;
      if (c) { h = Math.min(base, c.h + (this.time - c.t) * GROW); if (h < base - 0.01) { anyCut = true; stripe = c.d ? 1 : -1; scalp = c.h < 0.05 ? 1 - h / 0.12 : 0; } }
      M.compose(v.set(x, y - 0.02, z), q.setFromAxisAngle(up, d[i * 6 + 3]), s.set(stripe ? 1.8 : 1, Math.max(0.02, h), stripe ? 1.8 : 1)); ck.mesh.setMatrixAt(i, M); // (short mowed grass spreads out into a carpet)
      col.setRGB(0.25 + tint * 0.07, 0.47 + tint * 0.1, 0.14 + tint * 0.04);
      if (stripe) { col.multiplyScalar(stripe > 0 ? 1.38 : 0.7); if (stripe > 0) col.offsetHSL(-0.02, 0, 0.02); }
      if (scalp > 0) col.lerp(new THREE.Color(0.55, 0.42, 0.26), Math.min(1, scalp));
      ck.mesh.setColorAt(i, col);
    }
    ck.mesh.instanceMatrix.needsUpdate = true; ck.mesh.instanceColor.needsUpdate = true; ck.hasCut = anyCut; ck.dirty = false;
  }
  update(dt, cx, cz, show) {
    this.time += dt; this.U.time.value = this.time; this.U.center.value.set(cx, cz);
    for (const ck of this.chunks.values()) if (ck.mesh) ck.mesh.visible = show;
    if (!show) return;
    // build the squares around you (closest first, a couple per frame), drop the far ones
    const r = this.R + 6, i0 = Math.floor((cx - r) / CH), i1 = Math.floor((cx + r) / CH), j0 = Math.floor((cz - r) / CH), j1 = Math.floor((cz + r) / CH);
    const want = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const dx = Math.max(0, Math.abs(cx - (i + 0.5) * CH) - CH / 2), dz = Math.max(0, Math.abs(cz - (j + 0.5) * CH) - CH / 2);
      if (dx * dx + dz * dz < r * r && !this.chunks.has(key(i, j))) want.push([dx * dx + dz * dz, i, j]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(2, want.length); k++) this.makeChunk(want[k][1], want[k][2]);
    for (const [k, ck] of this.chunks) {
      const dx = Math.max(0, Math.abs(cx - (ck.ci + 0.5) * CH) - CH / 2), dz = Math.max(0, Math.abs(cz - (ck.cj + 0.5) * CH) - CH / 2);
      if (dx * dx + dz * dz > (r + 20) ** 2) { if (ck.mesh) { this.scene.remove(ck.mesh); ck.mesh.dispose(); } this.chunks.delete(k); }
    }
    // mowed squares get redrawn (now, or every few seconds while they grow back)
    this.regrowT -= dt; const regrow = this.regrowT <= 0; if (regrow) this.regrowT = 3;
    for (const ck of this.chunks.values()) if (ck.mesh && (ck.dirty || (regrow && ck.hasCut))) this.fill(ck);
    // forget mowed spots that grew all the way back
    if (regrow && this.cut.size > 4000) for (const [k, c] of this.cut) if (c.h + (this.time - c.t) * GROW > 0.72) this.cut.delete(k);
  }
  // mow a strip w wide in front of (x, z) going toward yaw. Returns how many square meters of tall grass got cut.
  mow(x, z, yaw, w, lvl) {
    const ch = CUT_H[lvl] ?? CUT_H[1], sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    const d = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 0) : (fz > 0 ? 1 : 0);
    let cells = 0; const touched = new Set();
    for (let a = -w / 2; a <= w / 2; a += CELL * 0.8) for (let b = -0.35; b <= 0.35; b += CELL * 0.8) {
      const px = x + sx * a + fx * b, pz = z + sz * a + fz * b;
      if (surfaceAt(px, pz) !== SURF.GRASS || (Math.abs(px) < 118 && Math.abs(pz) < 108)) continue;
      const i = Math.floor(px / CELL), j = Math.floor(pz / CELL), k = key(i, j), c = this.cut.get(k);
      const now = c ? c.h + (this.time - c.t) * GROW : 0.7;
      if (now <= ch + 0.02 && c && c.d === d) continue;
      if (now > ch + 0.06) cells++;
      this.cut.set(k, { h: ch, t: this.time, d });
      touched.add(key(Math.floor(px / CH), Math.floor(pz / CH)));
    }
    for (const k of touched) { const ck = this.chunks.get(k); if (ck) ck.dirty = true; }
    return cells * CELL * CELL;
  }
}
