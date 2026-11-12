// MUD VALLEY RP: puts the whole valley together. Sky, sun, the land, town, houses, forests, rocks, racetrack stuff
// and the glowing circles you drive into to do things.
import * as THREE from "/create/vendor/three.module.js";
import { HALF, EDGE, FLATS, PLACES, HOUSES, riverX, RIVER_W, MOUNTAIN, POND, ATMS, PAWNS } from "./layout.js";
import { buildGround, buildGroundMeshes, hAt, surfaceAt, SURF, TRACKS, PATHS, fbm, samplePath, addPlatform } from "./terrain.js";
import * as B from "./build.js";
import { addCircle } from "./colliders.js";
import { bakeGroup } from "./vehicles.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const TOWN_Y = 1, LAWN = 0.14;

// ---------------------------------------------------------------- sky + light
export function makeSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(820, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d98f0) }, mid: { value: new THREE.Color(0x8fcaff) }, bot: { value: new THREE.Color(0xd8efff) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(c, 1.0); }",
  }));
  sky.renderOrder = -1; scene.add(sky);
  // the sun: a soft glowing ball
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, "#fffef0"); r.addColorStop(0.25, "#fff4c0"); r.addColorStop(0.5, "rgba(255,240,180,0.35)"); r.addColorStop(1, "rgba(255,240,180,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.set(160, 160, 1); sky.add(sunSprite); sunSprite.position.set(0.42, 0.72, 0.5).normalize().multiplyScalar(760);
  scene.fog = new THREE.Fog(0xcfe9ff, 200, 820);
  const hemi = new THREE.HemisphereLight(0xd8eeff, 0x6a8a4a, 1.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.7);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 320 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun); scene.add(sun.target);
  const SUN_DIR = new THREE.Vector3(0.42, 0.72, 0.5).normalize();
  // the sun's shadow box follows you around
  const follow = (x, y, z) => {
    const s = 140 / 2048 * 2; x = Math.round(x / s) * s; z = Math.round(z / s) * s; // (snapping stops shadows shimmering)
    sun.target.position.set(x, y, z); sun.position.set(x + SUN_DIR.x * 150, y + SUN_DIR.y * 150, z + SUN_DIR.z * 150);
  };
  return { sky, sun, hemi, follow };
}

// ---------------------------------------------------------------- the town
const BLOCK_X = [[-108, -74.5], [-65.5, -5.5], [5.5, 65.5], [74.5, 108]], BLOCK_Z = [[-96, -64.5], [-55.5, -5.5], [5.5, 55.5], [64.5, 96]];
function town(scene) {
  const b = new B.Batch(), y = TOWN_Y + LAWN;
  // sidewalks and lawns for every block
  b.at(0, TOWN_Y, 0);
  for (const [x0, x1] of BLOCK_X) for (const [z0, z1] of BLOCK_Z) {
    b.box(x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0xcac7c0);
    b.box(x1 - x0 - 4, 0.14, z1 - z0 - 4, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x6cc04a);
  }
  // street lamps and trees along the main streets
  for (let x = -100; x <= 100; x += 20) for (const z of [-7.5, 7.5]) if (Math.abs(x) > 8 && Math.abs(Math.abs(x) - 70) > 6 && !(Math.abs(x) > 10 && Math.abs(x) < 62) && !(x > 76 && x < 106 && z < 0)) { b.at(x, TOWN_Y + 0.12, z, z < 0 ? 0 : Math.PI); B.tree(b, 3.6, 0, 0.75, 1); }
  for (let z = -90; z <= 90; z += 20) for (const x of [-7.5, 7.5]) if (Math.abs(z) > 8 && Math.abs(Math.abs(z) - 60) > 6) { b.at(x, TOWN_Y + 0.12, z, x < 0 ? Math.PI / 2 : -Math.PI / 2); B.tree(b, 3.6, 0, 0.75, 1); }
  b.finish(scene);
  // the buildings (each is turned to face its street)
  const place = (fn, x, z, yaw, ...a) => { b.at(x, y, z, yaw); fn(scene, b, ...a); };
  place(B.dealership, -36, -41, 0);
  place(B.customs, 36, -41, 0);
  place(B.jobCenter, -36, 41, Math.PI);
  place(B.postOffice, 22, 40, Math.PI);
  place(B.pizza, 51, 40, Math.PI);
  place(B.gasAndWash, 91, -30, 0);
  place(B.diner, 91, 38, Math.PI);
  place(B.townHall, -91, -36, 0);
  place(B.parkingLot, -91, 30.5, 0);
  place(B.school, 18, -82, 0);
  place(B.hardware, 90, -82, 0);
  place(B.waterTower, -18, -84, 0);
  place(B.park, -91, -80, 0);
  [[-40, -80, 0], [42, -80, 0], [-90, 80, Math.PI], [-40, 80, Math.PI], [-18, 80, Math.PI], [18, 80, Math.PI], [40, 80, Math.PI], [90, 80, Math.PI]].forEach(([x, z, yaw], k) => place(B.smallHouse, x, z, yaw, k));
  b.finish(scene);
}

// ---------------------------------------------------------------- the rest of the valley
function placeAt(scene, fn, x, z, yaw, ...a) { const b = new B.Batch(); b.at(x, hAt(x, z), z, yaw); fn(scene, b, ...a); b.finish(scene); return b; }
function houses(scene) {
  const fns = { camper: B.camper, cabin: B.cabin, family: B.familyHouse, farm: B.farmhouse, mansion: B.mansion, small: (sc, b, h) => B.smallHouse(sc, b, h.look || 0) };
  const signs = {};
  for (const h of HOUSES) {
    if (fns[h.build]) placeAt(scene, fns[h.build], h.x, h.z, h.yaw, h);
    // the for-sale / home sign next to the garage spot
    const gy = hAt(h.garage.x, h.garage.z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const sx = h.garage.x + 4, sz = h.garage.z;
    post.position.set(sx, gy + 1.3, sz); scene.add(post);
    const s = B.sign(scene, "", 3.2, 1.6, sx, gy + 2.6, sz, h.yaw, { back: true });
    s.userData.house = h; signs[h.id] = s;
    addCircle(sx, sz, 0.3, gy + 3);
  }
  placeAt(scene, B.barn, 66, 254, Math.PI);
  // farm fields: rows of crops
  const b = new B.Batch(); b.at(0, 0, 0);
  for (let i = 0; i < 12; i++) { const x = -12 + i * 2.2; b.box(1.3, 0.5, 26, x, hAt(x, 226) - 0.05, 226, i % 4 < 2 ? 0x4aa83a : 0xd8c040); }
  for (let i = 0; i < 8; i++) { const z = 212 + i * 4; b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 10), 0xe6c35a, 20, hAt(20, z) + 0.75, z, Math.PI / 2, 0.4, 0); addCircle(20, z, 0.8, hAt(20, z) + 1.5); }
  b.finish(scene);
  return signs;
}
function outskirts(scene) {
  placeAt(scene, B.lumberYard, -304, -10, 0);
  placeAt(scene, B.construction, 100, -180, 0);
  placeAt(scene, B.rangerStation, -300, 289, 0);
  placeAt(scene, B.lookout, -280, 312, Math.PI);
  placeAt(scene, B.campground, 300, 158, 0);
  { const x = riverX(-40) - RIVER_W - 7; const bt = placeAt(scene, B.dock, x, -40, Math.PI / 2); addPlatform(x + 4.6, -40, 1.5, 5.2, Math.PI / 2, bt.fy + 0.8); }
  copperCreek(scene);
  // Lily Pond: the bait shop and a long dock out over the water
  placeAt(scene, B.baitShop, 404, 132, Math.PI / 2);
  { const x = POND.x - POND.r - 1, z = 146, bt = placeAt(scene, B.longDock, x, z, Math.PI / 2); addPlatform(x + 7.5, z, 1.5, 8, Math.PI / 2, bt.fy + 0.7); }
  placeAt(scene, B.hideout, -462, -262, Math.PI / 2);
  for (const a of ATMS) placeAt(scene, B.atm, a.x, a.z, a.yaw);
  // the fence all the way around the valley
  { const b = new B.Batch(); b.at(0, 0, 0); B.borderFence(b, EDGE + 3, hAt); b.finish(scene); }
  // the speedway: grandstand, start arch, tire walls
  const sw = TRACKS.speedway, sm = TRACKS.moto;
  const si = startIndex(sw, -60, -319), mi = startIndex(sm, 247, -12);
  sw.start = si; sm.start = mi;
  {
    const i = si, j = (i + 2) % sw.n, yaw = Math.atan2(sw.x[j] - sw.x[i], sw.z[j] - sw.z[i]);
    placeAt(scene, (s, b) => B.startArch(s, b, 18, "VALLEY SPEEDWAY"), sw.x[i], sw.z[i], yaw);
    // a grandstand full of fans on the outside of the start straight
    placeAt(scene, (s, b) => B.speedwayStuff(s, b, 70), sw.x[i] + 10, sw.z[i] - 17, 0);
  }
  {
    const i = mi, j = (i + 2) % sm.n, yaw = Math.atan2(sm.x[j] - sm.x[i], sm.z[j] - sm.z[i]);
    placeAt(scene, (s, b) => B.startArch(s, b, 13, "MOTOCROSS", { pole: 0x2a8a3a }), sm.x[i], sm.z[i], yaw);
  }
  // hay bales along the motocross track, tire stacks around the speedway
  const bales = [], tires = [];
  edgeObjects(sm, 6.0 + 1.6, 7, bales, 0.9);
  edgeObjects(sw, 8 + 1.4 + 3, 9, tires, 1.0, true);
  const baleMesh = inst(new THREE.CylinderGeometry(0.75, 0.75, 1.5, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe6c35a }), bales, 0.75);
  const tireMesh = inst(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 10), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), tires, 0.7);
  scene.add(baleMesh, tireMesh); scene.userData.bales = { mesh: baleMesh, list: bales };
  // direction signs on the highways
  const dir = (text, x, z, yaw) => { const y = hAt(x, z); const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), new THREE.MeshLambertMaterial({ color: 0x888888 })); p.position.set(x, y + 1.8, z); scene.add(p); B.sign(scene, text, 5, 1.3, x, y + 3.6, z, yaw, { bg: "#1f7a3a", fg: "#ffffff", back: true }); addCircle(x, z, 0.3, y + 4); };
  dir("MOTOCROSS →", 124, -9, 0); dir("↑ SPEEDWAY", 8, -112, Math.PI / 2); dir("FARM ↓", 8, 112, -Math.PI / 2); dir("← MANSION HILL", -124, -9, 0); dir("MOUNTAIN TRAIL", -118, 92, Math.PI / 4);
  dir("MUD BOWL →", 232, 182, -0.6); dir("← CAMPGROUND", 288, 140, 0);
  dir("↑ COPPER CREEK", 222, -14, -Math.PI / 2); dir("THUNDER PEAK ⛰", -138, 128, Math.PI / 4); dir("GOAT TRAIL (4x4)", -328, 36, 0.8);
  dir("LILY POND 🎣", 392, 100, Math.PI / 2); dir("CANYON RUN", 372, 344, 0.4); dir("TIMBER RIDGE", -356, -360, 0.6);
}
// ---------------------------------------------------------------- Copper Creek: bank, jewelry store, police station, shops
function copperCreek(scene) {
  placeAt(scene, B.bank, 330, -345, 0);
  placeAt(scene, B.jewelry, 366, -343, 0);
  placeAt(scene, B.policeStation, 428, -349, 0);
  placeAt(scene, B.hospital, 484, -344, 0);
  placeAt(scene, B.gearShop, 330, -300, Math.PI);
  placeAt(scene, B.blasterShop, 366, -300, Math.PI);
  placeAt(scene, (s, b) => B.smallShop(s, b, "COPPER CAFE", 0xf2e0c8, 0xc0602a), 418, -301, Math.PI);
  placeAt(scene, (s, b) => B.smallShop(s, b, "TOY TRAIN SHOP", 0xd8f0ff, 0x2a8ad0), 436, -301, Math.PI);
  for (const p of PAWNS) placeAt(scene, B.pawnShop, p.x, p.z, p.yaw);
  // (the two houses on Copper Lane are for sale: see HOUSES)
  // street lamps + trees along Main Street
  const b = new B.Batch();
  for (let x = 304; x <= 492; x += 22) for (const z of [-311, -325]) { if (Math.abs(x - 400) < 8) continue; b.at(x, hAt(x, z), z, z < -318 ? 0 : Math.PI); B.tree(b, 0, 0, 0.7, 1); }
  b.finish(scene);
  B.sign(scene, "WELCOME TO COPPER CREEK", 9, 1.6, 300, hAt(300, -330) + 4, -330, Math.PI / 2, { bg: "#c0602a", fg: "#ffffff", back: true });
}
function startIndex(p, x, z) { let bi = 0, bd = 1e9; for (let i = 0; i < p.n; i++) { const d = (p.x[i] - x) ** 2 + (p.z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; }
function edgeObjects(p, off, every, out, r, outsideOnly) {
  const step = Math.max(1, Math.round(every / 3));
  for (let i = 0; i < p.n; i += step) {
    const j = (i + 1) % p.n, tx = p.x[j] - p.x[i], tz = p.z[j] - p.z[i], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    if (Math.abs(i - p.start) < 6 || Math.abs(i - p.start) > p.n - 6) continue;
    for (const s of outsideOnly ? [1, -1] : [1, -1]) {
      const x = p.x[i] + nx * off * s, z = p.z[i] + nz * off * s;
      // skip spots that are on top of another part of the track
      if ([SURF.TRACK, SURF.ROAD, SURF.MUD].includes(surfaceAt(x, z))) continue;
      out.push({ x, z, yaw: Math.atan2(tx, tz) });
      addCircle(x, z, r, hAt(x, z) + 1.4);
    }
  }
}
function inst(geo, mat, list, lift) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  list.forEach((o, i) => { M.compose(new THREE.Vector3(o.x, hAt(o.x, o.z) + lift, o.z), q.setFromAxisAngle(up, o.yaw || 0), new THREE.Vector3(1, 1, 1)); m.setMatrixAt(i, M); });
  m.count = list.length; m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- forests and rocks (instanced: one draw for all of them)
function inFlat(x, z) { for (const f of FLATS) if (Math.abs(x - f.x) < f.hx + 6 && Math.abs(z - f.z) < f.hz + 6) return true; return false; }
function nearPath(x, z, d) { for (const [dx, dz] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) { const s = surfaceAt(x + dx, z + dz); if (s !== SURF.GRASS && s !== SURF.ROCK && s !== SURF.SAND) return true; } return false; }
function forestDensity(x, z) {
  const h = hAt(x, z);
  let d = Math.max(0, fbm(x / 90 + 3, z / 90 - 5, 3)) * 0.9;
  const dm = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z); if (dm > 40 && dm < 200 && h < 105) d += 0.45 * (1 - h / 140);
  if (x < -330 && z < -180) d += 0.5; // Timber Ridge woods
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 6) return 0;
  if (Math.hypot(x + 300, z + 10) < 90) d += 0.5;
  if (x > 200 && z > 60) d += 0.3 * (0.6 + fbm(x / 40, z / 40, 2));
  const rd = Math.abs(x - riverX(z)); if (rd > RIVER_W + 8 && rd < 45) d += 0.3;
  if (Math.hypot(x + 215, z + 128) < 80) d += 0.3;
  const m = Math.max(Math.abs(x), Math.abs(z)); if (m > EDGE + 40) return 0; if (m > 470) d += 0.4;
  return d;
}
function forests(scene) {
  const pines = [], rounds = [], rocks = [];
  let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let gz = -HALF + 2; gz < HALF; gz += 5) for (let gx = -HALF + 2; gx < HALF; gx += 5) {
    const x = gx + (rnd() - 0.5) * 4.6, z = gz + (rnd() - 0.5) * 4.6, r = rnd();
    if (Math.abs(x) < 118 && Math.abs(z) < 108) continue; // not in town
    const dens = forestDensity(x, z);
    if (r < dens * 0.4) {
      if (inFlat(x, z) || nearPath(x, z, 6)) continue;
      const s = 0.8 + rnd() * 0.7, h = hAt(x, z);
      (h > 20 || rnd() < 0.6 ? pines : rounds).push({ x, z, s, y: h, c: rnd() });
      addCircle(x, z, 0.5 * s, h + 7);
    } else if (r > 0.992 - (x > 180 ? 0.006 : 0) - (Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < 190 ? 0.01 : 0)) {
      if (Math.max(Math.abs(x), Math.abs(z)) > EDGE + 30) continue;
      if (inFlat(x, z) || nearPath(x, z, 5)) continue;
      const s = 0.6 + rnd() * 1.8; const h = hAt(x, z); rocks.push({ x, z, s, y: h, c: rnd() }); addCircle(x, z, s * 0.85, h + s * 1.1);
    }
  }
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  // (cut into 3 x 3 big squares: the computer skips the squares the camera can't see)
  const R = (HALF * 2) / 3, reg = (t) => Math.min(2, Math.floor((t.x + HALF) / R)) + 3 * Math.min(2, Math.floor((t.z + HALF) / R));
  const mats = {};
  const make = (geo, color, all, y, ys, cv) => {
    const mat = mats[color] || (mats[color] = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    for (let r = 0; r < 9; r++) {
      const list = all.filter((t) => reg(t) === r); if (!list.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => { M.compose(v.set(t.x, t.y + y * t.s, t.z), q.setFromAxisAngle(up, t.c * 6.28), sc.set(t.s, t.s * ys, t.s)); m.setMatrixAt(i, M); m.setColorAt(i, col.set(color).offsetHSL(cv ? (t.c - 0.5) * 0.04 : 0, 0, cv ? (t.c - 0.5) * 0.12 : 0)); });
      m.computeBoundingSphere(); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    }
  };
  const trunks = pines.concat(rounds);
  make(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6), 0x7a5232, trunks, 1.0, 1, false);
  make(new THREE.ConeGeometry(2.1, 3.6, 7), 0x2f8a3c, pines, 3.2, 1, true);
  make(new THREE.ConeGeometry(1.5, 2.9, 7), 0x3b9c48, pines, 5.0, 1, true);
  make(new THREE.IcosahedronGeometry(2.1, 0), 0x4fae3e, rounds, 3.6, 0.95, true);
  make(new THREE.DodecahedronGeometry(1, 0), 0x8f8a82, rocks, 0.35, 0.75, true);
  return { trees: trunks.length, rocks: rocks.length };
}
// big blue-ish mountains far away all around the valley
function farMountains(scene0) {
  const scene = new THREE.Group(); scene0.add(scene);
  const g = [], mat = new THREE.MeshLambertMaterial({ color: 0x7aa6a0, flatShading: true }), capMat = new THREE.MeshLambertMaterial({ color: 0xf4f8ff, flatShading: true });
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + Math.sin(i * 3.1) * 0.08, r = HALF + 200 + Math.sin(i * 1.7) * 50, h = 150 + Math.abs(Math.sin(i * 2.3)) * 140;
    const m = new THREE.Mesh(new THREE.ConeGeometry(150 + Math.cos(i) * 40, h, 7), mat); m.position.set(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r); m.rotation.y = i; scene.add(m); g.push(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry((150 + Math.cos(i) * 40) * 0.28, h * 0.28, 7), capMat); cap.position.set(m.position.x, h - 20 - h * 0.14 + 0.5, m.position.z); cap.rotation.y = i; if (h > 170) scene.add(cap);
  }
  bakeGroup(scene); for (const c of scene.children) c.castShadow = false;
  return g;
}
function clouds(scene) {
  const list = [], geo = new THREE.IcosahedronGeometry(1, 1), m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa8b8, flatShading: true, fog: false }), 140);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0;
  for (let c = 0; c < 20; c++) {
    const cx = (Math.sin(c * 12.9) * 0.5 + 0.5) * 1300 - 650, cz = (Math.sin(c * 78.2) * 0.5 + 0.5) * 1300 - 650, cy = 230 + (c % 4) * 15;
    for (let i = 0; i < 7 && k < 140; i++, k++) { const r = 8 + ((i * 37 + c * 11) % 9); M.compose(v.set(cx + (i - 3) * 9, cy + ((i * 7) % 5), cz + ((i * 13) % 7) - 3), q, s.set(r * 1.4, r * 0.8, r)); m.setMatrixAt(k, M); }
  }
  m.count = k; scene.add(m); list.push(m);
  return m;
}

// ---------------------------------------------------------------- glowing circles + floating icons where you press E
function iconSprite(emoji, color) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.fillStyle = color; g.beginPath(); g.arc(64, 58, 50, 0, 7); g.fill();
  g.lineWidth = 7; g.strokeStyle = "#ffffff"; g.stroke();
  g.beginPath(); g.moveTo(48, 100); g.lineTo(80, 100); g.lineTo(64, 124); g.fill();
  g.font = "60px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(emoji, 64, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false })); s.scale.set(3.2, 3.2, 1);
  return s;
}
// repaint a marker's floating icon (houses turn green when they're yours)
export function recolorMarker(mk, color, emoji) {
  const old = mk.icon; const s = iconSprite(emoji, color); s.position.copy(old.position); mk.g.remove(old); old.material.map.dispose(); mk.g.add(s); mk.icon = s;
}
export function makeMarker(scene, x, z, r, color, emoji) {
  const y = hAt(x, z) + (Math.abs(x) < 116 && Math.abs(z) < 106 ? LAWN : 0);
  const g = new THREE.Group(); g.position.set(x, y + 0.2, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.5, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r - 0.5, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false })); fill.rotation.x = -Math.PI / 2; g.add(fill);
  const icon = iconSprite(emoji, typeof color === "string" ? color : "#" + new THREE.Color(color).getHexString()); icon.position.y = 6; g.add(icon);
  scene.add(g);
  return { g, ring, icon, x, z, r };
}

// ---------------------------------------------------------------- build it all
export function buildWorld(scene) {
  buildGround();
  const ground = buildGroundMeshes(scene);
  town(scene);
  const signs = houses(scene);
  outskirts(scene);
  const counts = forests(scene);
  farMountains(scene);
  const cl = clouds(scene);
  const markers = {};
  for (const [id, p] of Object.entries(PLACES)) if (p.r) markers[id] = makeMarker(scene, p.x, p.z, p.r, p.color, p.icon);
  for (const h of HOUSES) markers["house_" + h.id] = makeMarker(scene, h.garage.x, h.garage.z, 4, h.price ? "#ff5ad8" : "#7a8aa0", h.id === "lot" ? "🅿️" : "🏠");
  return { ground, signs, markers, clouds: cl, water: ground.userData.water, counts };
}
export function animateWorld(w, t, dt, cam, hide) {
  if (w.water) w.water.offset.y = -t * 0.12;
  w.clouds.position.x = Math.sin(t * 0.01) * 40;
  for (const k in w.markers) {
    const m = w.markers[k]; m.g.visible = !hide;
    m.icon.position.y = 6 + Math.sin(t * 2 + m.x) * 0.35; m.ring.material.opacity = 0.6 + Math.sin(t * 4) * 0.25;
    // (icons fade away when the camera gets really close, so they never fill the screen)
    if (cam) { const d = Math.hypot(cam.x - m.x, cam.z - m.z); m.icon.material.opacity = Math.max(0, Math.min(1, (d - 7) / 6)); m.icon.material.transparent = true; }
  }
}
export { samplePath, PATHS, clamp };
