// MUD VALLEY RP: puts the whole valley together. Sky, sun, the land, town, houses, forests, rocks, racetrack stuff
// and the glowing circles you drive into to do things.
import * as THREE from "/create/vendor/three.module.js";
import { HALF, EDGE, FLATS, PLACES, HOUSES, riverX, RIVER_W, MOUNTAIN, POND, LAKE, ATMS, PAWNS, WATER_Y, MUDS } from "./layout.js";
import { buildGround, buildGroundMeshes, hAt, surfaceAt, SURF, TRACKS, PATHS, fbm, samplePath, addPlatform, roadNet, groundAt, LIMIT_TOWN, LIMIT_HWY, biome, desertAt, merge, mudPits } from "./terrain.js";
import * as B from "./build.js";
import { addCircle, pushOut } from "./colliders.js";
import { bakeGroup, buildCar, vehicleById } from "./vehicles.js";
import { mergeGeometries } from "/create/vendor/BufferGeometryUtils.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const TOWN_Y = 1, LAWN = 0.14;

// ---------------------------------------------------------------- sky + light
export function makeSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(820, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d98f0) }, mid: { value: new THREE.Color(0x8fcaff) }, bot: { value: new THREE.Color(0xd8efff) }, lin: { value: 0 } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top, mid, bot; uniform float lin; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.15, h)); gl_FragColor = vec4(mix(c, pow(c, vec3(2.2)), lin), 1.0); }",
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
  let box = 70, size = 2048;
  const setShadow = (sz, bx) => {
    if (!sz) return; box = bx; size = sz;
    Object.assign(sun.shadow.camera, { left: -bx, right: bx, top: bx, bottom: -bx }); sun.shadow.camera.updateProjectionMatrix();
    if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.normalBias = bx > 80 ? 0.04 : 0.05;
  };
  // Ultra: the sun + moon are much brighter than white (that makes them glow and throw rays)
  let kSun = 1, kHemi = 1;
  const setHDR = (on) => { sunSprite.material.color.setScalar(on ? 3 : 1); sky.material.uniforms.lin.value = on ? 1 : 0; moon.material.color.setScalar(on ? 1.8 : 1); kSun = on ? 1.3 : 1; kHemi = on ? 0.78 : 1; }; // (Ultra: stronger sun, deeper shade)
  const sunAt = (v) => (sunSprite.visible && sunSprite.position.y > 0 ? sunSprite.getWorldPosition(v) : null);
  const follow = (x, y, z) => {
    const s = box * 2 / size * 2; x = Math.round(x / s) * s; z = Math.round(z / s) * s; // (snapping stops shadows shimmering)
    sun.target.position.set(x, y, z); sun.position.set(x + SUN_DIR.x * 150, y + SUN_DIR.y * 150, z + SUN_DIR.z * 150);
  };
  // ---- day + night: stars, a moon, and colors for every time of day
  const starG = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 1600; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u), y = Math.abs(u) * 0.95 + 0.05; sp.push(r * Math.cos(a) * 780, y * 780, r * Math.sin(a) * 780); }
  starG.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.add(stars);
  const mc = document.createElement("canvas"); mc.width = mc.height = 128; const mg = mc.getContext("2d");
  const mr = mg.createRadialGradient(64, 64, 4, 64, 64, 64); mr.addColorStop(0, "#ffffff"); mr.addColorStop(0.3, "#eef2ff"); mr.addColorStop(0.36, "rgba(200,215,255,0.35)"); mr.addColorStop(1, "rgba(200,215,255,0)");
  mg.fillStyle = mr; mg.fillRect(0, 0, 128, 128); mg.fillStyle = "rgba(160,170,200,0.5)"; for (const [x, y, r] of [[54, 56, 7], [72, 70, 5], [66, 50, 4]]) { mg.beginPath(); mg.arc(x, y, r, 0, 7); mg.fill(); }
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), fog: false, depthWrite: false, transparent: true }));
  moon.scale.set(90, 90, 1); sky.add(moon);
  const K = (h) => new THREE.Color(h);
  const DAY = { top: K(0x3d98f0), mid: K(0x8fcaff), bot: K(0xd8efff), fog: K(0xcfe9ff), sun: K(0xfff2d8), sunI: 2.7, sky: K(0xd8eeff), gnd: K(0x6a8a4a), hemi: 1.55 };
  const DUSK = { top: K(0x2c4a8a), mid: K(0xff9a6a), bot: K(0xffc890), fog: K(0xe6a888), sun: K(0xffa060), sunI: 1.5, sky: K(0xffc8a0), gnd: K(0x5a5a3a), hemi: 0.95 };
  const NIGHT = { top: K(0x03060f), mid: K(0x0a1430), bot: K(0x18233e), fog: K(0x101a30), sun: K(0x9ab0ff), sunI: 0.4, sky: K(0x5a70b0), gnd: K(0x1a221a), hemi: 0.42 };
  const mix = (A, B, t) => { const o = {}; for (const k in A) o[k] = typeof A[k] === "number" ? A[k] + (B[k] - A[k]) * t : A[k].clone().lerp(B[k], t); return o; };
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const U = sky.material.uniforms, sunPos = new THREE.Vector3();
  // tod: 0 = midnight, 0.25 = 6 AM, 0.5 = noon, 0.75 = 6 PM. Returns how dark it is (0 = day, 1 = night).
  const update = (tod) => {
    const a = (tod - 0.25) * Math.PI * 2, e = Math.sin(a);
    sunPos.set(Math.cos(a) * 0.8, e, 0.45).normalize();
    const P = e > 0.05 ? mix(DUSK, DAY, sm(0.05, 0.35, e)) : mix(NIGHT, DUSK, sm(-0.22, 0.05, e));
    U.top.value.copy(P.top); U.mid.value.copy(P.mid); U.bot.value.copy(P.bot); scene.fog.color.copy(P.fog);
    hemi.color.copy(P.sky); hemi.groundColor.copy(P.gnd); hemi.intensity = P.hemi * kHemi;
    // the light comes from the sun in the day and from the moon at night
    const moonUp = e < -0.02; SUN_DIR.copy(moonUp ? sunPos.clone().negate() : sunPos); if (SUN_DIR.y < 0.25) { SUN_DIR.y = 0.25; SUN_DIR.normalize(); }
    sun.color.copy(P.sun); sun.intensity = kSun * P.sunI * (moonUp ? 1 : sm(-0.02, 0.12, e) * 0.8 + 0.2);
    sunSprite.position.copy(sunPos).multiplyScalar(760); sunSprite.visible = e > -0.12;
    moon.position.copy(sunPos).multiplyScalar(-760); moon.visible = e < 0.12;
    stars.material.opacity = sm(0.02, -0.25, e);
    return 1 - sm(-0.2, 0.12, e);
  };
  return { sky, sun, hemi, follow, update, setShadow, setHDR, sunAt };
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
  // Valley Motors is right across the street from Town Parking (where you start), facing Main Street
  place(B.dealership, -36, 41, Math.PI);
  showRides(scene, b);
  place(B.customs, 36, -41, 0);
  place(B.jobCenter, -36, -41, 0);
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

// shiny wet mud on top of every mud pit (the rides sink into it a bit)
function mudSurfaces(scene) {
  const geos = mudPits().map((m, i) => { const g = new THREE.CircleGeometry(m.r * 0.93, 26); g.rotateX(-Math.PI / 2); g.translate(m.x, m.y - 0.22 * (m.deep || 1) + (i % 3) * 0.01, m.z); return g; });
  if (!geos.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshPhongMaterial({ color: 0x4a301c, shininess: 70, specular: 0x5a4a3a }));
  mesh.receiveShadow = true; scene.add(mesh);
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
  placeAt(scene, B.campStore, 283, 140, Math.PI / 2);
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
  { const m2 = TRACKS.mx2; if (m2) edgeObjects(m2, 6.0 + 1.6, 8, bales, 0.9); }
  const baleMesh = inst(new THREE.CylinderGeometry(0.75, 0.75, 1.5, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe6c35a }), bales, 0.75);
  const tireMesh = inst(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 10), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), tires, 0.7);
  scene.add(baleMesh, tireMesh); scene.userData.bales = { mesh: baleMesh, list: bales };
  ridgeline(scene);
  abyss(scene);
  marina(scene);
  parkingLots(scene);
  // direction signs on the highways
  const dir = (text, x, z, yaw) => { const y = hAt(x, z); const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), new THREE.MeshLambertMaterial({ color: 0x888888 })); p.position.set(x, y + 1.8, z); scene.add(p); B.sign(scene, text, 5, 1.3, x, y + 3.6, z, yaw, { bg: "#1f7a3a", fg: "#ffffff", back: true }); addCircle(x, z, 0.3, y + 4); };
  dir("MOTOCROSS →", 124, -9, 0); dir("↑ SPEEDWAY", 8, -112, Math.PI / 2); dir("FARM ↓", 8, 112, -Math.PI / 2); dir("← MANSION HILL", -124, -9, 0); dir("MOUNTAIN TRAIL", -118, 92, Math.PI / 4);
  dir("MUD BOWL →", 232, 182, -0.6); dir("← CAMPGROUND", 288, 140, 0);
  dir("↑ COPPER CREEK", 222, -14, -Math.PI / 2); dir("THUNDER PEAK ⛰", -138, 128, Math.PI / 4); dir("GOAT TRAIL (4x4)", -328, 36, 0.8);
  dir("LILY POND 🎣", 392, 100, Math.PI / 2); dir("CANYON RUN", 372, 344, 0.4); dir("TIMBER RIDGE", -356, -360, 0.6);
  dir("RIDGELINE MX →", 488, 14, 0.4); dir("THE ABYSS", 92, 566, -Math.PI / 2); dir("MARINA 🚤", -300, 872, 0);
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
  placeAt(scene, (s, b) => B.smallShop(s, b, "THREADS CLOTHING", 0xffe4f2, 0xd04a9a), 304, -301, Math.PI);
  for (const p of PAWNS) placeAt(scene, B.pawnShop, p.x, p.z, p.yaw);
  // (the two houses on Copper Lane are for sale: see HOUSES)
  // street lamps + trees along Main Street
  const b = new B.Batch();
  for (let x = 304; x <= 492; x += 22) for (const z of [-311, -325]) { if (Math.abs(x - 400) < 8 || (Math.abs(x - 304) < 8 && z > -318)) continue; b.at(x, hAt(x, z), z, z < -318 ? 0 : Math.PI); B.tree(b, 0, 0, 0.7, 1); }
  b.finish(scene);
  B.sign(scene, "WELCOME TO COPPER CREEK", 9, 1.6, 300, hAt(300, -330) + 4, -330, Math.PI / 2, { bg: "#c0602a", fg: "#ffffff", back: true });
}
// ---------------------------------------------------------------- Ridgeline MX Park (a start arch + a big sign)
function ridgeline(scene) {
  const m = TRACKS.mx2; if (!m) return;
  const i = m.start0 || 0, j = (i + 2) % m.n, yaw = Math.atan2(m.x[j] - m.x[i], m.z[j] - m.z[i]);
  placeAt(scene, (s, b) => B.startArch(s, b, 13, "RIDGELINE MX", { pole: 0xe0702a }), m.x[i], m.z[i], yaw);
  const sy = hAt(600, 66);
  B.sign(scene, "RIDGELINE MX PARK\nBIG JUMPS + WHOOPS", 7, 2.2, 600, sy + 4.2, 66, Math.PI / 2 + 0.4, { bg: "#e0702a", fg: "#ffffff", back: true });
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x555555 })); p.position.set(600, sy + 2.1, 66); scene.add(p); addCircle(600, 66, 0.4, sy + 5);
}
// ---------------------------------------------------------------- The Abyss: warning signs + a ring of old tires around the deepest mud pit
function abyss(scene) {
  const A = MUDS.find((m) => m.abyss); if (!A) return;
  const sx = A.x - A.r - 6, sz = A.z - 7, y = hAt(sx, sz);
  B.sign(scene, "THE ABYSS\nSUPER DEEP MUD!\nSNORKEL NEEDED", 5.6, 2.6, sx, y + 3.6, sz, -Math.PI / 2, { bg: "#ffd23a", fg: "#1a1a1a", back: true });
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), new THREE.MeshLambertMaterial({ color: 0x777777 })); p.position.set(sx, y + 1.8, sz); scene.add(p); addCircle(sx, sz, 0.3, y + 4);
  const b = new B.Batch(); b.at(0, 0, 0);
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.4) continue; const x = A.x + Math.cos(a) * (A.r + 4), z = A.z + Math.sin(a) * (A.r + 4); b.cyl(0.7, 0.55, x, hAt(x, z), z, 0x222226, 10); }
  b.finish(scene);
}
// ---------------------------------------------------------------- Big Bass Lake Marina: a long dock, a boat ramp, the marina shop
export const MARINA = { x: LAKE.x + LAKE.r + 1, z: 880, boat: { x: LAKE.x + LAKE.r - 22, z: 898, yaw: -Math.PI / 2 } };
function marina(scene) {
  const x = MARINA.x, z = MARINA.z, bt = placeAt(scene, (s, b) => B.longDock(s, b, 26), x, z, -Math.PI / 2);
  addPlatform(x - 13, z, 1.5, 13.2, Math.PI / 2, bt.fy + 0.7);
  // a T at the end of the dock to tie boats up
  { const b = new B.Batch(); b.at(x - 26, bt.fy, z, 0); for (let i = 0; i < 7; i++) b.box(1.3, 0.2, 1.1, 0, 0.5, -3.6 + i * 1.2, 0xa07848); for (const zz of [-3.6, 3.6]) b.cyl(0.15, 3.5, 0, -2.8, zz, 0x7a5a30, 6); b.finish(scene); addPlatform(x - 26, z, 0.65, 4.2, 0, bt.fy + 0.7); }
  // the boat ramp: a concrete strip down into the water, next to the dock
  { const b = new B.Batch(); b.at(0, 0, 0); for (let k = 0; k < 10; k++) { const rx = x + 8 - k * 2.6, rz = z + 12; b.box(2.8, 0.12, 5, rx, Math.max(WATER_Y - 0.7, hAt(rx, rz)) - 0.06, rz, 0xb8b4aa); } b.finish(scene); }
  placeAt(scene, (s, b) => B.smallShop(s, b, "BIG BASS MARINA", 0xe8f4ff, 0x2a7ab0), x + 18, z - 14, -Math.PI / 2);
}
// ---------------------------------------------------------------- parking lots next to every business
// For each business: try spots around the building (sides, front, back) and use the first one that's flat, not on a
// road / water / mud, and doesn't hit anything solid. A lot is asphalt + paint (you drive right onto it).
const LOTS = [];
const BIZ = [
  [-36, 41, Math.PI], [36, -41, 0], [-36, -41, 0], [22, 40, Math.PI], [51, 40, Math.PI], [91, -30, 0], [91, 38, Math.PI], [18, -82, 0], [90, -82, 0], // town
  [-304, -10, 0], [100, -180, 0], [-300, 289, 0], [283, 140, Math.PI / 2], [404, 132, Math.PI / 2], // lumber, construction, ranger, camp store, bait
  [330, -345, 0], [366, -343, 0], [428, -349, 0], [484, -344, 0], [330, -300, Math.PI], [366, -300, Math.PI], [418, -301, Math.PI], [436, -301, Math.PI], [304, -301, Math.PI], // Copper Creek
];
export const lotCount = () => LOTS.length;
export const LOT_MISS = []; // (businesses with no room for a lot: for testing)
function parkingLots(scene) {
  const list = [...BIZ, ...PAWNS.map((p) => [p.x, p.z, p.yaw]), [MARINA.x + 18, MARINA.z - 14, -Math.PI / 2]];
  const b = new B.Batch(), town = (x, z) => Math.abs(x) < 116 && Math.abs(z) < 106;
  for (const [bx, bz, yaw] of list) {
    if (LOTS.some((L) => Math.hypot(L.x - bx, L.z - bz) < 26)) continue; // (a shop right next door already has one: share it)
    const inTown = town(bx, bz), sizes = inTown ? [[14, 10], [11, 8]] : [[19, 12], [13, 9]], tries = [];
    // spots all around the building (closest first), turned 2 ways, big lot first then a smaller one
    for (let d = 11; d <= 35; d += 3) for (let k = 0; k < 8; k++) for (const turn of [0, Math.PI / 2]) for (const [W, D] of sizes) tries.push([d, (k * Math.PI) / 4, turn, W, D]);
    tries.sort((a, b2) => a[0] + (a[3] < 14 ? 6 : 0) - (b2[0] + (b2[3] < 14 ? 6 : 0)));
    const n0 = LOTS.length;
    for (const [d, a, turn, W, D] of tries) {
      const ang = yaw + a, x = bx + Math.sin(ang) * d, z = bz + Math.cos(ang) * d, ly = yaw + turn;
      if (!lotOk(x, z, ly, W, D, inTown)) continue;
      const lo = inTown ? TOWN_Y + LAWN : lotLow(x, z, ly, W, D), y = inTown ? TOWN_Y + LAWN + 0.012 : lotTop(x, z, ly, W, D) + 0.03;
      b.at(x, y, z, ly);
      if (y - lo > 0.12) b.box(W + 0.6, y - lo + 0.25, D + 0.6, 0, lo - y - 0.25, 0, 0xa8a49a); // a leveled concrete pad on sloped ground
      b.box(W, 0.05, D, 0, 0, 0, 0x34363c);
      const n = Math.floor(W / 2.8), sp = (W - 1.6) / n;
      for (let k = 0; k <= n; k++) b.box(0.14, 0.06, D * 0.42, -W / 2 + 0.8 + k * sp, 0.003, D / 2 - D * 0.23, 0xf2f2f2); // stall lines
      for (let k = 0; k < n; k++) b.box(1.4, 0.14, 0.25, -W / 2 + 0.8 + (k + 0.5) * sp, 0, D / 2 - 0.6, 0xc8c4bc); // wheel stops
      b.box(1.0, 0.06, 1.0, -W / 2 + 1.6, 0.004, -D / 2 + 1.6, 0x2a6fd6); // a little blue square for the "P"
      if (y - lo > 0.12) addPlatform(x, z, W / 2 + 0.3, D / 2 + 0.3, ly, y + 0.05); // (you drive on the pad, not the slope under it)
      LOTS.push({ x, z, r: Math.hypot(W, D) / 2 });
      break;
    }
    if (n0 === LOTS.length) LOT_MISS.push([bx, bz]);
  }
  b.finish(scene);
}
function lotCorners(x, z, yaw, W, D) { const c = Math.cos(yaw), s = Math.sin(yaw), out = []; for (let i = -1; i <= 1; i += 0.5) for (let j = -1; j <= 1; j += 0.5) { const lx = (i * W) / 2, lz = (j * D) / 2; out.push([x + lx * c + lz * s, z - lx * s + lz * c]); } return out; }
function lotTop(x, z, yaw, W, D) { let m = -1e9; for (const [px, pz] of lotCorners(x, z, yaw, W, D)) m = Math.max(m, hAt(px, pz)); return m; }
function lotLow(x, z, yaw, W, D) { let m = 1e9; for (const [px, pz] of lotCorners(x, z, yaw, W, D)) m = Math.min(m, hAt(px, pz)); return m; }
const lotOk = (x, z, yaw, W, D, inTown) => !lotWhy(x, z, yaw, W, D, inTown);
export function lotWhy(x, z, yaw, W, D, inTown) {
  for (const L of LOTS) if (Math.hypot(x - L.x, z - L.z) < L.r + Math.hypot(W, D) / 2) return "lot";
  let lo = 1e9, hi = -1e9;
  for (const [px, pz] of lotCorners(x, z, yaw, W, D)) {
    const s = surfaceAt(px, pz); if (s === SURF.ROAD || s === SURF.WATER || s === SURF.MUD || s === SURF.TRACK || s === SURF.DIRT || (s === SURF.SAND && hAt(px, pz) < WATER_Y + 1)) return "surf" + s;
    if (inTown) { let blk = false; for (const [x0, x1] of BLOCK_X) for (const [z0, z1] of BLOCK_Z) if (px > x0 + 0.6 && px < x1 - 0.6 && pz > z0 + 0.6 && pz < z1 - 0.6) blk = true; if (!blk) return "block"; }
    const h = hAt(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h);
    if (pushOut(px, pz, 1.3, h + 0.5).hit > 0) return "solid";
  }
  return hi - lo < (inTown ? 0.45 : 1.6) ? "" : "slope" + (hi - lo).toFixed(1);
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
function inFlat(x, z) { for (const f of FLATS) if (Math.abs(x - f.x) < f.hx + 6 && Math.abs(z - f.z) < f.hz + 6) return true; for (const L of LOTS) if (Math.hypot(x - L.x, z - L.z) < L.r + 3) return true; return false; }
function nearPath(x, z, d) { for (const [dx, dz] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) { const s = surfaceAt(x + dx, z + dz); if (s !== SURF.GRASS && s !== SURF.ROCK && s !== SURF.SAND) return true; } return false; }
function forestDensity(x, z) {
  const h = hAt(x, z);
  let d = Math.max(0, fbm(x / 90 + 3, z / 90 - 5, 3)) * 0.9;
  const dm = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z); if (dm > 40 && dm < 200 && h < 105) d += 0.45 * (1 - h / 140);
  if (x < -330 && z < -180) d += 0.5; // Timber Ridge woods
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8) return 0;
  if (Math.hypot(x + 300, z + 10) < 90) d += 0.5;
  if (x > 200 && z > 60) d += 0.3 * (0.6 + fbm(x / 40, z / 40, 2));
  const rd = Math.abs(x - riverX(z)); if (rd > RIVER_W + 8 && rd < 45) d += 0.3;
  if (Math.hypot(x + 215, z + 128) < 80) d += 0.3;
  const m = Math.max(Math.abs(x), Math.abs(z)); if (m > EDGE + 40) return 0; if (m > 470 && m < 640) d += 0.3;
  const b = biome(x, z); // the new lands: thick woods in the west, pines up north, a few trees in the south, none in the desert
  if (b[0] > 0) d = d * (1 - b[0]) + b[0] * (b[2] * 0.85 + b[4] * (hAt(x, z) < 125 ? 0.5 : 0) + b[3] * 0.12);
  return d * (1 - Math.min(1, desertAt(x, z) * 1.6));
}
// tree shapes with shading baked in (darker inside + at the bottom, lighter tips)
function shade(g, f) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = f(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = Math.max(0.3, Math.min(1, k)); }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.deleteAttribute("uv"); return g;
}
// (kept very light: there are about 50,000 pines, 17,000 leafy trees and 9,000 bushes in the valley)
function pineGeo() {
  const parts = [[2.4, 2.9, 2.5], [1.75, 2.5, 4.0], [1.05, 2.1, 5.4]].map(([r, h, y], i) => {
    const g = new THREE.ConeGeometry(r, h, 7, 1, i > 0); const p = g.attributes.position; // (only the bottom layer needs a floor)
    for (let k = 0; k < p.count; k++) { const yy = p.getY(k); if (yy < -h / 2 + 0.01 && Math.hypot(p.getX(k), p.getZ(k)) > 0.1) { const a = Math.atan2(p.getZ(k), p.getX(k)); p.setY(k, yy - 0.2 - 0.18 * Math.sin(a * 3 + i)); const w = 1 + 0.1 * Math.sin(a * 5 + i * 2); p.setX(k, p.getX(k) * w); p.setZ(k, p.getZ(k) * w); } }
    g.translate(0, y, 0); return shade(g, (x, yy, z) => 0.6 + (yy - y + h / 2) / h * 0.4 + i * 0.04);
  });
  return merge(parts);
}
function roundGeo() {
  let sd = 9; const rr = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
  const blobs = [[0, 3.5, 0, 2.0], [0.55, 4.4, -0.35, 1.35]];
  const parts = blobs.map(([x, y, z, r]) => { const g = new THREE.IcosahedronGeometry(r, 0); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const s = 1 + (rr() - 0.5) * 0.2; p.setXYZ(k, p.getX(k) * s, p.getY(k) * s, p.getZ(k) * s); } g.translate(x, y, z); return shade(g, (a, b) => 0.62 + (b - 2.4) * 0.12 + rr() * 0.1); });
  return merge(parts);
}
function bushGeo() {
  const parts = [[0, 0.45, 0, 0.75], [0.45, 0.4, 0.25, 0.55]].map(([x, y, z, r]) => shade(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), (a, b) => 0.55 + b * 0.5));
  return merge(parts);
}
function forests(scene) {
  const pines = [], rounds = [], rocks = [], cacti = [], bushes = [];
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
    } else if (r > 0.45 && r < 0.45 + Math.min(0.05, dens * 0.06) && !desertAt(x, z)) { // a bush near the woods
      if (inFlat(x, z) || nearPath(x, z, 4)) continue;
      bushes.push({ x: x + (rnd() - 0.5) * 2, z: z + (rnd() - 0.5) * 2, s: 0.6 + rnd() * 0.7, y: hAt(x, z), c: rnd() });
    } else if (r > 0.6 && r < 0.6 + desertAt(x, z) * 0.012) { // cactus!
      if (inFlat(x, z) || nearPath(x, z, 5)) continue;
      const s = 0.8 + rnd() * 0.6, h = hAt(x, z); cacti.push({ x, z, s, y: h, c: rnd() }); addCircle(x, z, 0.4 * s, h + 4);
    } else if (r > 0.992 - (x > 180 ? 0.006 : 0) - (Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < 190 ? 0.01 : 0) - desertAt(x, z) * 0.006) {
      if (Math.max(Math.abs(x), Math.abs(z)) > EDGE + 30) continue;
      if (inFlat(x, z) || nearPath(x, z, 5)) continue;
      const s = 0.6 + rnd() * 1.8; const h = hAt(x, z); rocks.push({ x, z, s, y: h, c: rnd() }); addCircle(x, z, s * 0.85, h + s * 1.1);
    }
  }
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  // (cut into 12 x 12 big squares: the computer skips the squares the camera can't see)
  const NR = 12, R = (HALF * 2) / NR, reg = (t) => Math.min(NR - 1, Math.floor((t.x + HALF) / R)) + NR * Math.min(NR - 1, Math.floor((t.z + HALF) / R));
  const mats = {};
  const make = (geo, color, all, y, ys, cv, shadow = true) => {
    const vc = !!geo.attributes.color, mk = color + (vc ? "v" : "");
    const mat = mats[mk] || (mats[mk] = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, vertexColors: vc }));
    for (let r = 0; r < NR * NR; r++) {
      const list = all.filter((t) => reg(t) === r); if (!list.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => { M.compose(v.set(t.x, t.y + y * t.s, t.z), q.setFromAxisAngle(up, t.c * 6.28), sc.set(t.s, t.s * ys, t.s)); m.setMatrixAt(i, M); m.setColorAt(i, col.set(color).offsetHSL(cv ? (t.c - 0.5) * 0.04 : 0, 0, cv ? (t.c - 0.5) * 0.12 : 0)); });
      m.computeBoundingSphere(); m.castShadow = shadow; m.receiveShadow = true; scene.add(m);
    }
  };
  const trunks = pines.concat(rounds);
  make(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6), 0x7a5232, trunks, 1.0, 1, false);
  make(pineGeo(), 0x2f8a3c, pines, 0, 1, true);
  make(roundGeo(), 0x4fae3e, rounds, 0, 0.95, true);
  make(bushGeo(), 0x4a9a3a, bushes, 0, 1, true, false);
  make(new THREE.DodecahedronGeometry(1, 0), 0x8f8a82, rocks, 0.35, 0.75, true);
  // cacti: a tall stem + two arms
  make(new THREE.CylinderGeometry(0.32, 0.38, 3.6, 7), 0x3f8a3a, cacti, 1.8, 1, true);
  { const a = new THREE.CylinderGeometry(0.22, 0.22, 1.4, 6).translate(0.62, 0.5, 0), b = new THREE.CylinderGeometry(0.2, 0.2, 1.1, 6).translate(-0.58, 0.2, 0);
    const h1 = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 6).rotateZ(Math.PI / 2).translate(0.42, -0.1, 0), h2 = new THREE.CylinderGeometry(0.17, 0.17, 0.45, 6).rotateZ(Math.PI / 2).translate(-0.4, -0.3, 0);
    make(merge([a, b, h1, h2]), 0x3f8a3a, cacti, 2.0, 1, true); }
  return { trees: trunks.length, rocks: rocks.length, cacti: cacti.length };
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
  const list = [], geo = new THREE.IcosahedronGeometry(1, 1), m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa8b8, flatShading: true, fog: false }), 560);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0;
  for (let c = 0; c < 80; c++) {
    const cx = (Math.sin(c * 12.9) * 0.5 + 0.5) * 3800 - 1900, cz = (Math.sin(c * 78.2) * 0.5 + 0.5) * 3800 - 1900, cy = 230 + (c % 4) * 15;
    for (let i = 0; i < 7 && k < 560; i++, k++) { const r = 8 + ((i * 37 + c * 11) % 9); M.compose(v.set(cx + (i - 3) * 9, cy + ((i * 7) % 5), cz + ((i * 13) % 7) - 3), q, s.set(r * 1.4, r * 0.8, r)); m.setMatrixAt(k, M); }
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

// four shiny rides parked on the dealership's show pads (no drivers)
function showRides(scene, b) {
  const rides = [["trailboss", 0xd02030, 0.5], ["sportquad", 0xffd23a, -0.6], ["prerunner", 0xff7a1a, 0.35], ["swamp", 0x4a5a3a, -0.35]];
  B.DEALER_PADS.forEach(([x, z], k) => {
    const [id, paint, turn] = rides[k], v = vehicleById(id);
    const C = buildCar({ id, paint, rims: "chrome", tires: v.quad ? "mud" : "allterrain", engine: 3, limit: 1, lift: v.quad ? 0 : 1, neon: 0, dirt: 0 });
    C.body.remove(C.rider.root); C.rider = null;
    const p = b.world(x, z); C.root.position.set(p.x, b.fy + 0.4, p.z); C.root.rotation.y = b.fyaw + turn;
    for (const w of C.wheels) w.pivot.position.y = w.r;
    scene.add(C.root); addCircle(p.x, p.z, Math.max(C.len, C.wid) * 0.42, b.fy + 3);
  });
}

// ---------------------------------------------------------------- speed limit signs along every paved road (both directions)
function limitTex(n) {
  const c = document.createElement("canvas"); c.width = 160; c.height = 200; const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 160, 200); g.strokeStyle = "#111"; g.lineWidth = 8; g.strokeRect(10, 10, 140, 180);
  g.fillStyle = "#111"; g.textAlign = "center"; g.font = 'bold 30px "Russo One", Impact, sans-serif'; g.fillText("SPEED", 80, 52); g.fillText("LIMIT", 80, 86);
  g.font = 'bold 84px "Russo One", Impact, sans-serif'; g.fillText(String(n), 80, 168);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function speedSigns(scene) {
  const { roads, links } = roadNet(), posts = new B.Batch(), plates = { [LIMIT_TOWN]: [], [LIMIT_HWY]: [] }, mtx = new THREE.Matrix4();
  let count = 0;
  roads.forEach((p, r) => {
    const lim = p.town ? LIMIT_TOWN : LIMIT_HWY, every = p.town ? 70 : 150, last = p.cum[p.n - 1];
    for (const dir of [1, -1]) {
      let next = dir > 0 ? 14 : last - 14;
      for (let ii = 1; ii < p.n - 1; ii++) {
        const i = dir > 0 ? ii : p.n - 1 - ii;
        if (dir > 0 ? p.cum[i] < next : p.cum[i] > next) continue;
        if (p.bridge[i] || p.ford[i] || links[r][i].length || links[r][i + dir]?.length || links[r][i - dir]?.length) continue; // (not in a crossing or on a bridge)
        next = p.cum[i] + dir * every;
        let dx = p.x[i + dir] - p.x[i], dz = p.z[i + dir] - p.z[i]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const off = p.w / 2 + 1.7, x = p.x[i] - dz * off, z = p.z[i] + dx * off, y = groundAt(x, z), yaw = Math.atan2(-dx, -dz);
        posts.at(x, y, z, yaw); posts.box(0.12, 2.9, 0.12, 0, 0, -0.08, 0x9aa0aa); posts.box(0.96, 1.2, 0.05, 0, 1.8, -0.06, 0x8a9098);
        const g = new THREE.PlaneGeometry(0.9, 1.12); g.applyMatrix4(mtx.makeRotationY(yaw).setPosition(x, y + 2.4, z)); plates[lim].push(g);
        count++;
      }
    }
  });
  posts.finish(scene);
  for (const n of [LIMIT_TOWN, LIMIT_HWY]) if (plates[n].length) scene.add(new THREE.Mesh(mergeGeometries(plates[n]), new THREE.MeshLambertMaterial({ map: limitTex(n) })));
  return count;
}

// ---------------------------------------------------------------- build it all
export function buildWorld(scene) {
  buildGround();
  const ground = buildGroundMeshes(scene);
  mudSurfaces(scene);
  town(scene);
  const signs = houses(scene);
  outskirts(scene);
  const limitSigns = speedSigns(scene);
  const counts = forests(scene);
  farMountains(scene);
  const cl = clouds(scene);
  const markers = {};
  for (const [id, p] of Object.entries(PLACES)) if (p.r) markers[id] = makeMarker(scene, p.x, p.z, p.r, p.color, p.icon);
  for (const h of HOUSES) markers["house_" + h.id] = makeMarker(scene, h.garage.x, h.garage.z, 4, h.price ? "#ff5ad8" : "#7a8aa0", h.id === "lot" ? "🅿️" : "🏠");
  return { ground, signs, markers, clouds: cl, water: ground.userData.water, counts, limitSigns };
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
