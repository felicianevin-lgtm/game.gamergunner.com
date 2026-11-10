// LAVA TOWER: the rising lava (an animated glowing shader), bubbles that pop on top, embers floating up, and a red glow.
import * as THREE from "/create/vendor/three.module.js";

const VERT = `
varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `
uniform float uTime; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
varying vec2 vUv; varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
void main() {
  vec2 p = vWorld.xz * 0.09;
  vec2 q = vec2(fbm(p + uTime * 0.05), fbm(p + vec2(5.2, 1.3) - uTime * 0.04));
  float n = fbm(p * 1.4 + q * 2.2 + uTime * 0.03);
  float n2 = fbm(p * 2.3 + q * 1.6 - uTime * 0.06);
  vec3 dark = vec3(0.30, 0.02, 0.0), mid = vec3(0.95, 0.22, 0.0), hot = vec3(1.0, 0.78, 0.22);
  vec3 col = mix(dark, mid, smoothstep(0.28, 0.62, n));
  float crack = 1.0 - smoothstep(0.0, 0.07, abs(n2 - 0.5));
  col = mix(col, hot, crack * 0.9 + smoothstep(0.62, 0.8, n) * 0.6);
  col += vec3(1.0, 0.45, 0.05) * pow(max(0.0, sin(n * 16.0 - uTime * 1.6)), 10.0) * 0.25;
  col *= 1.08;
  float d = length(vWorld - cameraPosition);
  float fogK = smoothstep(uFogNear, uFogFar, d) * 0.55;
  gl_FragColor = vec4(mix(col, uFog, fogK), 1.0);
  #include <colorspace_fragment>
}`;

export class Lava {
  constructor(scene) {
    this.scene = scene; this.y = -8;
    this.uni = { uTime: { value: 0 }, uFog: { value: new THREE.Color(0xff8a4a) }, uFogNear: { value: 40 }, uFogFar: { value: 180 } };
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uni });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 1, 1), m);
    this.mesh.rotation.x = -Math.PI / 2; scene.add(this.mesh);
    // a red glow just above the lava (follows you around) + a wide orange one from below
    this.glow = new THREE.PointLight(0xff4a10, 60, 34, 1.5); scene.add(this.glow);
    // embers: little glowing dots drifting up
    const N = 160, pos = new Float32Array(N * 3);
    this.emb = []; for (let i = 0; i < N; i++) this.emb.push({ x: 0, y: -999, z: 0, v: 1, w: Math.random() * 6 });
    const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.22, map: dot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.embers.frustumCulled = false; scene.add(this.embers);
    // bubbles: domes that swell on the surface and pop
    this.bub = [];
    const bg = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const bm = new THREE.MeshStandardMaterial({ color: 0xff7a10, emissive: 0xff5a00, emissiveIntensity: 0.9, roughness: 0.3 });
    for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(bg, bm); b.visible = false; scene.add(b); this.bub.push({ m: b, t: 1, life: 1, s: 1 }); }
    this.splash = [];
  }
  reset(y) { this.y = y; for (const e of this.emb) e.y = -999; }
  update(dt, t, focus, popped) {
    this.uni.uTime.value = t;
    this.mesh.position.set(focus.x, this.y, focus.z);
    this.glow.position.set(focus.x, this.y + 3, focus.z);
    // embers
    const arr = this.embers.geometry.attributes.position.array;
    this.emb.forEach((e, i) => {
      e.y += e.v * dt; e.w += dt;
      if (e.y > this.y + 26 || e.y < this.y - 1) { const a = Math.random() * 6.28, r = 2 + Math.random() * 30; e.x = focus.x + Math.cos(a) * r; e.z = focus.z + Math.sin(a) * r; e.y = this.y + Math.random() * (e.y < -900 ? 26 : 2); e.v = 1 + Math.random() * 2.5; }
      arr[i * 3] = e.x + Math.sin(e.w * 1.3) * 0.4; arr[i * 3 + 1] = e.y; arr[i * 3 + 2] = e.z + Math.cos(e.w) * 0.4;
    });
    this.embers.geometry.attributes.position.needsUpdate = true;
    // bubbles
    for (const b of this.bub) {
      b.t += dt;
      if (b.t >= b.life) {
        if (b.m.visible && popped) popped(b.m.position);
        const a = Math.random() * 6.28, r = 3 + Math.random() * 26;
        b.m.position.set(focus.x + Math.cos(a) * r, this.y, focus.z + Math.sin(a) * r);
        b.t = -Math.random() * 1.5; b.life = 0.8 + Math.random() * 1.2; b.s = 0.3 + Math.random() * 0.9; b.m.visible = false;
      } else if (b.t > 0) {
        b.m.visible = true; const k = b.t / b.life;
        b.m.scale.set(b.s * (0.3 + k), b.s * (0.2 + k * 0.9), b.s * (0.3 + k)); b.m.position.y = this.y - 0.1;
      }
    }
  }
}
function dot() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d"), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,255,220,1)"); r.addColorStop(0.35, "rgba(255,180,60,0.9)"); r.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
