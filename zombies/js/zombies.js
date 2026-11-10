// ZOMBIE SIEGE: the goofy blocky zombies. All zombies share a few InstancedMeshes (one per body part),
// so 100 zombies cost about 10 draw calls.
import * as THREE from "/create/vendor/three.module.js";
import { mergeGeometries } from "/create/vendor/BufferGeometryUtils.js";

// hp, speed (m/s), r (hit/collide radius), s (size), dmg (per bite), coins, score
export const ZTYPES = {
  walker: { name: "Zombie", hp: 60, speed: 2.3, r: 0.5, s: 1, dmg: 9, coins: 5, score: 10, mass: 1, skin: 0x86cf4f, shirt: 0x4f7fd0, pants: 0x6a5236, body: [1, 1, 1] },
  runner: { name: "Runner", hp: 34, speed: 4.4, r: 0.45, s: 0.88, dmg: 6, coins: 6, score: 15, mass: 0.8, skin: 0xb6ea5c, shirt: 0xf07a3a, pants: 0x2e3c66, body: [0.85, 1, 0.9] },
  tank: { name: "Big Tank", hp: 300, speed: 1.65, r: 0.9, s: 1.6, dmg: 18, coins: 15, score: 40, mass: 4, skin: 0x5ea83e, shirt: 0x8a4ac0, pants: 0x3a3a4a, body: [1.3, 1.05, 1.2], hat: "helmet" },
  boomer: { name: "Boomer", hp: 55, speed: 2.0, r: 0.62, s: 1.1, dmg: 0, coins: 8, score: 25, mass: 1.5, skin: 0xb0ff4a, shirt: 0x7dff3a, pants: 0x4a6a2a, body: [1.7, 1.2, 1.6] },
  boss: { name: "KING ROTSWORTH", hp: 2200, speed: 2.0, r: 1.65, s: 3.0, dmg: 26, coins: 120, score: 600, mass: 30, skin: 0x4f9c3a, shirt: 0xc0303a, pants: 0x2a2a3a, body: [1.25, 1.05, 1.15], hat: "crown" },
};

const box = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
// parts (in a 1-size zombie, facing +z): legs/arms pivot at the top
const G = {
  leg: box(0.28, 0.8, 0.3, 0, -0.4, 0),
  body: box(0.75, 0.8, 0.46),
  head: box(0.62, 0.56, 0.56),
  arm: box(0.22, 0.75, 0.22, 0, -0.375, 0),
  // face parts are in head space
  white: mergeGeometries([box(0.24, 0.24, 0.06, -0.15, 0.06, 0.29), box(0.17, 0.17, 0.06, 0.16, 0.05, 0.29), box(0.08, 0.1, 0.05, 0.07, -0.12, 0.3)]),
  dark: mergeGeometries([box(0.09, 0.09, 0.05, -0.12, 0.03, 0.32), box(0.07, 0.07, 0.05, 0.18, 0.08, 0.32), box(0.32, 0.07, 0.04, 0, -0.15, 0.295), box(0.06, 0.12, 0.04, -0.17, 0.27, 0.0)]),
  helmet: (() => { const g = new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.7, 1.05); g.translate(0, 0.24, 0); return mergeGeometries([g.toNonIndexed(), box(0.86, 0.05, 0.9, 0, 0.25, 0.05).toNonIndexed()]); })(),
  crown: (() => {
    const parts = [new THREE.CylinderGeometry(0.36, 0.36, 0.16, 10, 1, true).translate(0, 0.36, 0).toNonIndexed()];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, c = new THREE.ConeGeometry(0.09, 0.22, 4).toNonIndexed(); c.translate(Math.sin(a) * 0.33, 0.55, Math.cos(a) * 0.33); parts.push(c); }
    return mergeGeometries(parts);
  })(),
};

const _base = new THREE.Matrix4(), _loc = new THREE.Matrix4(), _out = new THREE.Matrix4(), _head = new THREE.Matrix4();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _w = new THREE.Color(1, 1, 1);
const _skin = new THREE.Color(), _shirt = new THREE.Color(), _pants = new THREE.Color();

export class ZombieRenderer {
  constructor(scene, max = 160) {
    this.max = max;
    const mk = (geo, cap, color, opts = {}) => {
      const mat = opts.basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color, flatShading: true });
      const m = new THREE.InstancedMesh(geo, mat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = !opts.noShadow; m.count = 0;
      if (opts.colored) { for (let i = 0; i < cap; i++) m.setColorAt(i, _w); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      scene.add(m); return m;
    };
    this.leg = mk(G.leg, max * 2, 0xffffff, { colored: true });
    this.body = mk(G.body, max, 0xffffff, { colored: true });
    this.head = mk(G.head, max, 0xffffff, { colored: true });
    this.arm = mk(G.arm, max * 2, 0xffffff, { colored: true });
    this.white = mk(G.white, max, 0xffffff, { basic: true, noShadow: true });
    this.dark = mk(G.dark, max, 0x1a1a1a, { basic: true, noShadow: true });
    this.helmet = mk(G.helmet, max, 0xffc020);
    this.crown = mk(G.crown, 8, 0xffd23a);
    this.crown.material.emissive = new THREE.Color(0x553300);
  }
  // z: { x, y, z, yaw, type, phase, flash, squash, fuse, lunge, armUp, dead, tip }
  draw(list) {
    let n = 0, nh = 0, nc = 0;
    for (const z of list) {
      if (n >= this.max) break;
      const T = ZTYPES[z.type], s = T.s * (z.grow || 1);
      const swell = z.fuse > 0 ? 1 + z.fuse * 0.5 + Math.sin(z.fuse * 40) * 0.06 : 1;
      const sq = 1 - (z.squash || 0) * 0.18;
      _q.setFromEuler(_e.set(z.tip || 0, z.yaw, 0, "YXZ"));
      _base.compose(_p.set(z.x, z.y || 0, z.z), _q, _s.set(s * (2 - sq), s * sq, s * (2 - sq)));
      const ph = z.phase, sw = Math.sin(ph), walkAmt = z.walkAmt ?? 1;
      const flash = (z.flash || 0) * (z.type === "boss" ? 0.35 : 0.75);
      _skin.set(T.skin).lerp(_w, flash); _shirt.set(T.shirt); _pants.set(T.pants).lerp(_w, flash);
      if (z.fuse > 0) _shirt.lerp(_c.set(0xffff60), 0.5 + 0.5 * Math.sin(z.fuse * 30)); else if (z.type === "boomer") _shirt.lerp(_c.set(0xe0ff80), 0.25 + 0.25 * Math.sin(ph * 2));
      _shirt.lerp(_w, flash);
      const bob = Math.abs(Math.cos(ph)) * 0.08 * walkAmt;
      // legs
      for (let k = 0; k < 2; k++) {
        const a = (k ? sw : -sw) * 0.55 * walkAmt;
        _loc.compose(_p.set(k ? 0.17 : -0.17, 0.8 + bob, 0), _q.setFromEuler(_e.set(a, 0, 0)), _s.set(1, 1, 1));
        this.leg.setMatrixAt(n * 2 + k, _out.multiplyMatrices(_base, _loc)); this.leg.setColorAt(n * 2 + k, _pants);
      }
      // body (leaning forward like a zombie)
      const bs = T.body, lean = 0.18 + (z.lunge || 0) * 0.4;
      _loc.compose(_p.set(0, 1.2 + bob, 0), _q.setFromEuler(_e.set(lean, 0, Math.sin(ph * 0.5) * 0.06)), _s.set(bs[0] * swell, bs[1] * (swell * 0.5 + 0.5), bs[2] * swell));
      this.body.setMatrixAt(n, _out.multiplyMatrices(_base, _loc)); this.body.setColorAt(n, _shirt);
      // head: goofy wobble
      const hy = 1.6 + 0.3 * bs[1] + bob;
      _loc.compose(_p.set(0, hy, 0.12 + lean * 0.4), _q.setFromEuler(_e.set(0.1 + Math.sin(ph * 0.5 + 1) * 0.08, Math.sin(ph * 0.3) * 0.15, Math.sin(ph * 0.5) * 0.22)), _s.set(1, 1, 1));
      _head.multiplyMatrices(_base, _loc);
      this.head.setMatrixAt(n, _head); this.head.setColorAt(n, _skin);
      this.white.setMatrixAt(n, _head); this.dark.setMatrixAt(n, _head);
      if (T.hat === "helmet") this.helmet.setMatrixAt(nh++, _head);
      if (T.hat === "crown" && nc < 8) this.crown.setMatrixAt(nc++, _head);
      // arms reaching forward
      const up = z.armUp || 0;
      for (let k = 0; k < 2; k++) {
        const a = -Math.PI / 2 + (k ? sw : -sw) * 0.25 - up * 1.0 + (z.lunge || 0) * 0.5;
        _loc.compose(_p.set((k ? 0.5 : -0.5) * bs[0] * swell, 1.5 + bob, 0.05), _q.setFromEuler(_e.set(a, 0, (k ? -1 : 1) * 0.08)), _s.set(1, 1, 1));
        this.arm.setMatrixAt(n * 2 + k, _out.multiplyMatrices(_base, _loc)); this.arm.setColorAt(n * 2 + k, _skin);
      }
      n++;
    }
    this.leg.count = n * 2; this.arm.count = n * 2; this.body.count = this.head.count = this.white.count = this.dark.count = n;
    this.helmet.count = nh; this.crown.count = nc;
    for (const m of [this.leg, this.arm, this.body, this.head, this.white, this.dark, this.helmet, this.crown]) {
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
