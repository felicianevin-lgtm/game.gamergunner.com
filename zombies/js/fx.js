// ZOMBIE SIEGE: effects. Everything is pooled (made once, reused) so big fights stay smooth.
import * as THREE from "/create/vendor/three.module.js";

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

// A pool of little 3D pieces (confetti, smoke balls, sparks) drawn with one InstancedMesh.
class Pool {
  constructor(scene, geo, mat, cap, shadow = false) {
    this.cap = cap; this.n = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = shadow;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, _c.set(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    const F = (k) => new Float32Array(cap * k);
    this.pos = F(3); this.vel = F(3); this.rot = F(3); this.spin = F(3); this.col = F(3);
    this.size = F(1); this.life = F(1); this.max = F(1); this.grav = F(1); this.drag = F(1); this.mode = new Uint8Array(cap);
  }
  // mode 0: shrink to nothing; 1: puff (grow fast then shrink); 2: streak along velocity (sparks)
  add(x, y, z, vx, vy, vz, size, life, color, grav = 0, drag = 0, mode = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++, i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.rot[i3] = Math.random() * 6; this.rot[i3 + 1] = Math.random() * 6; this.rot[i3 + 2] = Math.random() * 6;
    this.spin[i3] = (Math.random() - 0.5) * 14; this.spin[i3 + 1] = (Math.random() - 0.5) * 14; this.spin[i3 + 2] = (Math.random() - 0.5) * 14;
    _c.set(color); this.col[i3] = _c.r; this.col[i3 + 1] = _c.g; this.col[i3 + 2] = _c.b;
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.mode[i] = mode;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(--this.n, i); continue; }
      const i3 = i * 3, d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 2] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.04 && this.grav[i] > 0) { this.pos[i3 + 1] = 0.04; this.vel[i3 + 1] *= -0.3; this.vel[i3] *= 0.5; this.vel[i3 + 2] *= 0.5; this.spin[i3] *= 0.5; this.spin[i3 + 2] *= 0.5; }
      this.rot[i3] += this.spin[i3] * dt; this.rot[i3 + 1] += this.spin[i3 + 1] * dt; this.rot[i3 + 2] += this.spin[i3 + 2] * dt;
      i++;
    }
  }
  copy(a, b) {
    const a3 = a * 3, b3 = b * 3;
    for (const arr of [this.pos, this.vel, this.rot, this.spin, this.col]) { arr[b3] = arr[a3]; arr[b3 + 1] = arr[a3 + 1]; arr[b3 + 2] = arr[a3 + 2]; }
    for (const arr of [this.size, this.life, this.max, this.grav, this.drag, this.mode]) arr[b] = arr[a];
  }
  draw() {
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, t = this.life[i] / this.max[i], m = this.mode[i];
      let s = this.size[i];
      if (m === 0) s *= Math.min(1, t * 3);
      else if (m === 1) s *= Math.min(1, (1 - t) * 6) * (0.4 + 0.6 * t);
      if (m === 2) {
        const vx = this.vel[i3], vy = this.vel[i3 + 1], vz = this.vel[i3 + 2], sp = Math.hypot(vx, vy, vz) || 1;
        _q.setFromUnitVectors(_p.set(0, 0, 1), _s.set(vx / sp, vy / sp, vz / sp));
        _m.compose(_p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]), _q, _s.set(s * t, s * t, s * (1 + sp * 0.05) * 3 * t));
      } else _m.compose(_p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]), _q.setFromEuler(_e.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2])), _s.set(s, m === 0 ? s * 0.35 : s, s));
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.setRGB(this.col[i3], this.col[i3 + 1], this.col[i3 + 2]));
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.n = 0; }
}

// Glowing line pieces: bullets, tracers, laser beams.
class Streaks {
  constructor(scene, cap) {
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, 0.5);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, _c.set(1, 1, 1));
    this.cap = cap; this.n = 0; scene.add(this.mesh);
    this.fading = []; // {x0,y0,z0,x1,y1,z1,w,life,max,color}
  }
  begin() { this.n = 0; }
  line(x0, y0, z0, x1, y1, z1, w, color) {
    if (this.n >= this.cap) return;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz); if (len < 1e-4) return;
    _q.setFromUnitVectors(_p.set(0, 0, 1), _s.set(dx / len, dy / len, dz / len));
    _m.compose(_p.set(x0, y0, z0), _q, _s.set(w, w, len));
    this.mesh.setMatrixAt(this.n, _m); this.mesh.setColorAt(this.n, _c.set(color)); this.n++;
  }
  fade(x0, y0, z0, x1, y1, z1, w, life, color) { this.fading.push({ x0, y0, z0, x1, y1, z1, w, life, max: life, color }); }
  update(dt) {
    for (let i = this.fading.length - 1; i >= 0; i--) { const f = this.fading[i]; f.life -= dt; if (f.life <= 0) this.fading.splice(i, 1); }
  }
  end() {
    for (const f of this.fading) { const t = f.life / f.max; this.line(f.x0, f.y0, f.z0, f.x1, f.y1, f.z1, f.w * t, f.color); }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
}

// Flat rings on the ground (shockwaves).
class Rings {
  constructor(scene, cap = 16) {
    this.list = [];
    const geo = new THREE.RingGeometry(0.82, 1, 48); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < cap; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 2; scene.add(m); this.list.push({ m, life: 0, max: 1, r0: 0, r1: 1 });
    }
  }
  add(x, z, r0, r1, life, color, y = 0.08) {
    const r = this.list.find((q) => q.life <= 0) || this.list[0];
    r.life = r.max = life; r.r0 = r0; r.r1 = r1; r.m.position.set(x, y, z); r.m.material.color.set(color); r.m.visible = true;
  }
  update(dt) {
    for (const r of this.list) {
      if (r.life <= 0) continue;
      r.life -= dt; if (r.life <= 0) { r.m.visible = false; continue; }
      const t = 1 - r.life / r.max, e = 1 - (1 - t) * (1 - t), s = r.r0 + (r.r1 - r.r0) * e;
      r.m.scale.set(s, 1, s); r.m.material.opacity = (1 - t) * 0.9;
    }
  }
}

// The 2D layer on top: damage numbers, "+5" coins, health bars over zombies.
class Overlay {
  constructor(canvas) { this.cv = canvas; this.g = canvas.getContext("2d"); this.texts = []; this.bars = []; this.v = new THREE.Vector3(); this.dpr = 1; }
  resize(dpr) { this.dpr = dpr; this.cv.width = Math.round(innerWidth * dpr); this.cv.height = Math.round(innerHeight * dpr); }
  text(x, y, z, str, color = "#fff", size = 20, life = 0.8, vy = 1.6) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, z, str, color, size, life, max: life, vy, jx: (Math.random() - 0.5) * 0.6 });
  }
  update(dt) { for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94; if (t.life <= 0) this.texts.splice(i, 1); } }
  draw(camera) {
    const g = this.g, W = this.cv.width, H = this.cv.height, d = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.setTransform(d, 0, 0, d, 0, 0);
    const w = innerWidth, h = innerHeight;
    for (const b of this.bars) {
      this.v.set(b.x, b.y, b.z).project(camera); if (this.v.z > 1) continue;
      const sx = (this.v.x * 0.5 + 0.5) * w, sy = (-this.v.y * 0.5 + 0.5) * h, bw = b.w;
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(sx - bw / 2 - 1, sy - 1, bw + 2, 6);
      g.fillStyle = b.color; g.fillRect(sx - bw / 2, sy, bw * Math.max(0, b.f), 4);
    }
    this.bars.length = 0;
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    for (const t of this.texts) {
      this.v.set(t.x + t.jx, t.y, t.z).project(camera); if (this.v.z > 1) continue;
      const sx = (this.v.x * 0.5 + 0.5) * w, sy = (-this.v.y * 0.5 + 0.5) * h, k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      g.globalAlpha = Math.min(1, k * 3);
      g.font = `${Math.round(t.size * pop)}px "Russo One", Impact, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = "rgba(20,10,30,0.9)"; g.strokeText(t.str, sx, sy);
      g.fillStyle = t.color; g.fillText(t.str, sx, sy);
    }
    g.globalAlpha = 1;
  }
  clear() { this.texts.length = 0; this.bars.length = 0; }
}

export class FX {
  constructor(scene, overlayCanvas) {
    this.solid = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), 1400, false);
    this.puff = new Pool(scene, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777, flatShading: true }), 500);
    this.glow = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 900);
    this.streaks = new Streaks(scene, 600);
    this.rings = new Rings(scene);
    this.overlay = new Overlay(overlayCanvas);
  }
  update(dt) { this.solid.update(dt); this.puff.update(dt); this.glow.update(dt); this.streaks.update(dt); this.rings.update(dt); this.overlay.update(dt); }
  draw() { this.solid.draw(); this.puff.draw(); this.glow.draw(); }
  clear() { this.solid.clear(); this.puff.clear(); this.glow.clear(); this.streaks.fading.length = 0; this.overlay.clear(); for (const r of this.rings.list) { r.life = 0; r.m.visible = false; } }

  // ---- recipes
  confetti(x, y, z, n, power = 5) {
    const C = [0xff4a6a, 0xffd23a, 0x3ad0ff, 0x7dff5a, 0xff8a2a, 0xc070ff, 0xffffff];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = power * (0.4 + Math.random() * 0.8);
      this.solid.add(x, y, z, Math.cos(a) * s, 3 + Math.random() * power * 1.2, Math.sin(a) * s, 0.14 + Math.random() * 0.1, 1.2 + Math.random() * 0.8, C[(Math.random() * C.length) | 0], 14, 1.2, 0);
    }
  }
  smoke(x, y, z, n, size = 0.5, color = 0xf2f2f2, spread = 1, life = 0.7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = spread * (1 + Math.random() * 2.5);
      this.puff.add(x + Math.cos(a) * 0.2, y + Math.random() * 0.4, z + Math.sin(a) * 0.2, Math.cos(a) * s, 0.5 + Math.random() * 2, Math.sin(a) * s, size * (0.6 + Math.random() * 0.8), life * (0.7 + Math.random() * 0.6), color, -0.5, 3, 1);
    }
  }
  sparks(x, y, z, dx, dz, n, color = 0xffe070, power = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dz, dx) + (Math.random() - 0.5) * 2.2, s = power * (0.4 + Math.random() * 0.8);
      this.glow.add(x, y, z, Math.cos(a) * s, 1 + Math.random() * 4, Math.sin(a) * s, 0.06, 0.18 + Math.random() * 0.2, color, 12, 2, 2);
    }
  }
  burst(x, y, z, n, color, power = 9, size = 0.08) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = power * (0.5 + Math.random() * 0.6);
      this.glow.add(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s + 1, Math.sin(a) * Math.cos(b) * s, size, 0.3 + Math.random() * 0.3, color, 6, 2, 2);
    }
  }
  // a zombie goes POP: smoke + confetti + stars
  pop(x, z, s = 1, tint = 0x9cff6a) {
    this.smoke(x, 1.0 * s, z, Math.round(7 + s * 4), 0.55 * s, 0xf4f4f4, 1.2 * s, 0.6);
    this.smoke(x, 1.0 * s, z, Math.round(3 + s * 2), 0.45 * s, tint, 1.0 * s, 0.5);
    this.confetti(x, 1.1 * s, z, Math.round(14 + s * 10), 4 + s);
    this.burst(x, 1.0 * s, z, 8, 0xfff2a0, 8 * s);
  }
  boom(x, z, r, color = 0x9cff3a) {
    this.smoke(x, 0.6, z, 22, 1.1, color, r * 0.9, 0.9);
    this.smoke(x, 0.8, z, 12, 0.9, 0xffffff, r * 0.7, 0.7);
    this.burst(x, 0.8, z, 30, 0xffe070, r * 3.2, 0.12);
    this.rings.add(x, z, 0.5, r * 1.15, 0.45, color);
    this.rings.add(x, z, 0.3, r * 0.8, 0.3, 0xffffff);
  }
}
