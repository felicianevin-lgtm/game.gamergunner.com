// MUD VALLEY RP: flying bits. Mud splatter, dust clouds, water splashes, confetti and sparks.
// All the little chunks are drawn together (instanced) so hundreds of them stay fast.
import * as THREE from "/create/vendor/three.module.js";
import { groundAt } from "./terrain.js";

const MAXC = 700, MAXP = 160;
export class FX {
  constructor(scene) {
    this.chunks = []; this.puffs = [];
    this.cm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), MAXC);
    this.pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }), MAXP);
    for (const m of [this.cm, this.pm]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.cm.setColorAt(0, new THREE.Color()); this.pm.setColorAt(0, new THREE.Color());
    this.M = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color(); this.e = new THREE.Euler();
  }
  chunk(x, y, z, vx, vy, vz, size, color, life = 1, grav = 1, spin = 6) {
    if (this.chunks.length >= MAXC) this.chunks.shift();
    this.chunks.push({ x, y, z, vx, vy, vz, size, color, life, max: life, grav, rx: Math.random() * 6, ry: Math.random() * 6, spin });
  }
  puff(x, y, z, vx, vy, vz, size, color, life = 1.2, grow = 2) {
    if (this.puffs.length >= MAXP) this.puffs.shift();
    this.puffs.push({ x, y, z, vx, vy, vz, size, color, life, max: life, grow });
  }
  // mud flying up behind the wheels
  mud(x, y, z, dx, dz, n = 3, power = 1) {
    for (let i = 0; i < n; i++) this.chunk(x, y + 0.2, z, -dx * (2 + Math.random() * 4) * power + (Math.random() - 0.5) * 3, (3 + Math.random() * 5) * power, -dz * (2 + Math.random() * 4) * power + (Math.random() - 0.5) * 3, 0.08 + Math.random() * 0.14, [0x5a3d24, 0x6a4a2c, 0x4a311c][i % 3], 0.9 + Math.random() * 0.5);
  }
  dust(x, y, z, n = 1, color = 0xc8a878, size = 0.7) { for (let i = 0; i < n; i++) this.puff(x + (Math.random() - 0.5), y + 0.3, z + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, size * (0.6 + Math.random() * 0.6), color, 0.9 + Math.random() * 0.6); }
  splash(x, y, z, n = 10, power = 1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = (1 + Math.random() * 4) * power; this.chunk(x, y, z, Math.cos(a) * s, (3 + Math.random() * 5) * power, Math.sin(a) * s, 0.08 + Math.random() * 0.12, [0xd8f4ff, 0x8ad0f0, 0xffffff][i % 3], 0.8 + Math.random() * 0.4); }
    this.puff(x, y + 0.3, z, 0, 1, 0, 1.2 * power, 0xffffff, 0.6, 2.5);
  }
  confetti(x, y, z, n = 40) {
    const cols = [0xff3a5a, 0xffd23a, 0x3aa0ff, 0x4adf6a, 0xff7ad8, 0xffffff];
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 6; this.chunk(x, y, z, Math.cos(a) * s, 5 + Math.random() * 8, Math.sin(a) * s, 0.1 + Math.random() * 0.08, cols[i % cols.length], 1.6 + Math.random(), 0.45, 12); }
  }
  // a red spray when somebody gets shot (drops that fall to the ground)
  blood(x, y, z, n = 14) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 3.5; this.chunk(x, y, z, Math.cos(a) * s, 1 + Math.random() * 3.5, Math.sin(a) * s, 0.05 + Math.random() * 0.07, [0xb0101a, 0x8a0a12, 0xd02028][i % 3], 0.5 + Math.random() * 0.4); } }
  sparks(x, y, z, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 6; this.chunk(x, y, z, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s, 0.06, [0xffe14a, 0xffa020, 0xffffff][i % 3], 0.35 + Math.random() * 0.3); } }
  smoke(x, y, z, n = 1) { for (let i = 0; i < n; i++) this.puff(x, y, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5, 0x8a8a8a, 1.6, 2.2); }
  update(dt) {
    const { M, q, v, s, c, e } = this;
    let n = 0;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const p = this.chunks[i];
      p.life -= dt; if (p.life <= 0) { this.chunks.splice(i, 1); continue; }
      p.vy -= 22 * p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav < 1) { p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; if (p.vy < -2.5) p.vy = -2.5; }
      const g = groundAt(p.x, p.z);
      if (p.y < g + p.size * 0.5) { p.y = g + p.size * 0.5; p.vy *= -0.25; p.vx *= 0.5; p.vz *= 0.5; }
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const k = Math.min(1, p.life / (p.max * 0.3));
      M.compose(v.set(p.x, p.y, p.z), q.setFromEuler(e.set(p.rx, p.ry, 0)), s.set(p.size * k, p.size * k * (p.grav < 1 ? 0.3 : 1), p.size * k));
      this.cm.setMatrixAt(n, M); this.cm.setColorAt(n, c.set(p.color)); n++;
    }
    this.cm.count = n; this.cm.instanceMatrix.needsUpdate = true; if (this.cm.instanceColor) this.cm.instanceColor.needsUpdate = true;
    n = 0;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt; if (p.life <= 0) { this.puffs.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - dt; p.vz *= 1 - dt;
      const t = 1 - p.life / p.max, sz = p.size * (1 + t * p.grow) * Math.min(1, (1 - t) * 3);
      M.compose(v.set(p.x, p.y, p.z), q.identity(), s.set(sz, sz * 0.8, sz));
      this.pm.setMatrixAt(n, M); this.pm.setColorAt(n, c.set(p.color)); n++;
    }
    this.pm.count = n; this.pm.instanceMatrix.needsUpdate = true; if (this.pm.instanceColor) this.pm.instanceColor.needsUpdate = true;
  }
}
