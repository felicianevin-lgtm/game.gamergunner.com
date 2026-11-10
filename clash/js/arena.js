// The CLASH battleground: a huge open ruin under a sunset sky. Every game builds the same map (fixed random seed), so
// everyone sees the same walls. Solid things are boxes (x0..x1, y0..y1, z0..z1) for walking, hiding and stopping blasts.
import * as THREE from "/create/vendor/three.module.js";
import { toon } from "./fighters.js";

export const ARENA_R = 175; // you can't walk past this (cliffs all around)

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function groundTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#6f8f4e"; x.fillRect(0, 0, 512, 512);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? "rgba(40,70,30,0.25)" : "rgba(150,170,90,0.2)"; x.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function stoneTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#b9b2a4"; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(60,55,50,0.55)"; x.lineWidth = 3;
  for (let y = 0; y < 256; y += 64) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); for (let i = 0; i < 4; i++) { const xx = ((y / 64) % 2) * 32 + i * 64; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 64); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildArena(scene) {
  const boxes = [], solid = new THREE.Group(); // (solid = what the camera can't look through)
  scene.add(solid);
  // sky: a big gradient ball (purple on top, orange near the ground)
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {},
    vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec3 v; void main(){ float h = clamp(v.y, -0.1, 1.0); vec3 top = vec3(0.16,0.12,0.38), mid = vec3(0.95,0.45,0.35), low = vec3(1.0,0.78,0.45); vec3 c = h < 0.12 ? mix(low, mid, h / 0.12) : mix(mid, top, pow((h - 0.12) / 0.88, 0.6)); gl_FragColor = vec4(c, 1.0); }" });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }));
  sunBall.position.set(-500, 120, -600); scene.add(sunBall);
  scene.fog = new THREE.Fog(0xe9a07a, 120, 520);
  scene.add(new THREE.HemisphereLight(0xffd8c0, 0x4a5a3a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(-60, 120, -70); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = sun.shadow.camera; S.left = S.bottom = -70; S.right = S.top = 70; S.near = 1; S.far = 400;
  scene.add(sun, sun.target);

  // ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 60, 64), new THREE.MeshToonMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const stone = new THREE.MeshToonMaterial({ map: stoneTexture() }), dark = toon("#7e766a");

  function block(x, y, z, w, h, d, mat, rotY) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || stone);
    m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
    if (mat === stone || !mat) { m.material = stone.clone(); m.material.map = stone.map.clone(); m.material.map.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 6)), Math.max(1, Math.round(h / 6))); m.material.map.needsUpdate = true; }
    if (rotY) m.rotation.y = rotY;
    solid.add(m);
    // (turned blocks still collide as their un-turned box: only small turns are used)
    boxes.push({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2 });
    return m;
  }

  // the temple in the middle: a big raised floor with steps on all four sides, and a gate
  block(0, 0, 0, 36, 3, 36);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 0; i < 3; i++) {
    const out = 18 + 1.5 + i * 3;
    block(dx * out, 0, dz * out, dx ? 3 : 14, 3 - (i + 1) * 0.9 + 0.3, dz ? 3 : 14);
  }
  for (const s of [-1, 1]) { block(s * 8, 3, -12, 3, 12, 3, toon("#c8323a")); }
  block(0, 15, -12, 22, 1.6, 3.4, toon("#2a1d1d")); block(0, 13.2, -12, 19, 1, 2.4, toon("#c8323a"));
  // a ring of pillars, some broken
  const r = rng(1234);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, rr = 52, h = r() < 0.35 ? 4 + r() * 5 : 16 + r() * 6;
    block(Math.cos(a) * rr, 0, Math.sin(a) * rr, 4, h, 4);
    if (h > 12) block(Math.cos(a) * rr, h, Math.sin(a) * rr, 5.5, 1.2, 5.5, dark);
  }
  // ruined walls, houses and rocks all over the field (cover to hide behind)
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 75 + r() * 85, x = Math.cos(a) * d, z = Math.sin(a) * d, kind = r();
    if (kind < 0.45) { const long = 14 + r() * 18, h = 5 + r() * 7; if (r() < 0.5) block(x, 0, z, long, h, 2.5); else block(x, 0, z, 2.5, h, long); }
    else if (kind < 0.7) { // a broken house: three walls and a doorway
      const w = 16 + r() * 6, h = 8;
      block(x, 0, z - w / 2, w, h, 1.5); block(x - w / 2, 0, z, 1.5, h, w); block(x + w / 2, 0, z, 1.5, h, w);
      block(x - w / 3, 0, z + w / 2, w / 3, h, 1.5); block(x + w / 3, 0, z + w / 2, w / 3, h, 1.5);
      block(x, h, z, w + 1.5, 1, w + 1.5, dark);
    } else { // a rock
      const s = 5 + r() * 7, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.62, 0), toon("#8a8579"));
      rock.position.set(x, s * 0.35, z); rock.rotation.set(r(), r() * 3, r()); rock.castShadow = rock.receiveShadow = true; solid.add(rock);
      boxes.push({ x0: x - s * 0.45, x1: x + s * 0.45, y0: 0, y1: s * 0.8, z0: z - s * 0.45, z1: z + s * 0.45 });
    }
  }
  // blossom trees
  const trunkM = toon("#5a3a28"), leafM = [toon("#ffb7d2"), toon("#ff9cc2"), toon("#ffd0e2")];
  for (let i = 0; i < 34; i++) {
    const a = r() * Math.PI * 2, d = 40 + r() * 130, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (boxes.some((b) => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue;
    const h = 7 + r() * 5, t = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, h, 7), trunkM);
    t.position.set(x, h / 2, z); t.castShadow = true; scene.add(t);
    for (let j = 0; j < 4; j++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + r() * 1.8, 0), leafM[j % 3]); l.position.set(x + (r() - 0.5) * 4, h + (r() - 0.3) * 2.5, z + (r() - 0.5) * 4); l.castShadow = true; scene.add(l); }
    boxes.push({ x0: x - 0.8, x1: x + 0.8, y0: 0, y1: h, z0: z - 0.8, z1: z + 0.8 });
  }
  // cliffs all around the edge
  const cliffM = toon("#7a6a5c");
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, h = 30 + r() * 40, c = new THREE.Mesh(new THREE.ConeGeometry(14 + r() * 8, h, 6), cliffM);
    c.position.set(Math.cos(a) * (ARENA_R + 18), h / 2 - 2, Math.sin(a) * (ARENA_R + 18)); c.rotation.y = r() * 3; scene.add(c);
  }

  // The floor height under (x, z) for something whose feet are at y (stands on top of boxes it's above).
  function floorAt(x, z, y, rad = 0.8) {
    let f = 0;
    for (const b of boxes) if (x > b.x0 - rad * 0.5 && x < b.x1 + rad * 0.5 && z > b.z0 - rad * 0.5 && z < b.z1 + rad * 0.5 && b.y1 <= y + 1.2 && b.y1 > f) f = b.y1;
    return f;
  }
  // Push a body (feet at p, radius rad, height h) out of any box it walked into. Low steps (1.2) are climbed instead.
  function collide(p, rad, h, grounded) {
    for (const b of boxes) {
      if (p.y >= b.y1 - 0.01 || p.y + h <= b.y0) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      if (grounded && b.y1 - p.y <= 1.2) { p.y = b.y1; continue; } // a step
      if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (rad - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // inside: out the nearest side
        const o = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        p.x += o[1] * (o[0] + rad); p.z += o[2] * (o[0] + rad);
      }
    }
    const d = Math.hypot(p.x, p.z);
    if (d > ARENA_R) { p.x *= ARENA_R / d; p.z *= ARENA_R / d; }
  }
  const inside = (p) => boxes.some((b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y > b.y0 && p.y < b.y1);
  // A random open place to start (never inside a wall).
  function spawnPoint() {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * (ARENA_R - 40), x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!boxes.some((b) => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 3, 0);
  }
  return { boxes, solid, sun, floorAt, collide, inside, spawnPoint };
}
