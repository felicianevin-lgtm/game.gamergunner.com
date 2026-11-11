// MUD VALLEY RP: the thumbnail picture (?thumb). A posed action shot on the motocross track:
// a dirt bike flying off a jump, a buggy on the ramp, an ATV splashing through mud, and a truck towing a trailer with an ATV.
import * as THREE from "/create/vendor/three.module.js";
import { RAMP_LIST, groundAt, textures } from "./terrain.js";
import { buildCar } from "./vehicles.js";
import { buildTrailer } from "./trailer.js";

export function pose({ scene, camera, renderer, sky, fx }) {
  const R = RAMP_LIST.filter((r) => r.track)[1];
  const fx2 = Math.sin(R.yaw), fz2 = Math.cos(R.yaw), sx = Math.cos(R.yaw), sz = -Math.sin(R.yaw);
  const at = (f, s) => ({ x: R.x + fx2 * f + sx * s, z: R.z + fz2 * f + sz * s });
  const car = (id, paint, extra = {}) => { const m = buildCar({ id, paint, rims: "chrome", tires: "mud", engine: 4, limit: 1, lift: 0, neon: 0, dirt: 0.15, ...extra }); scene.add(m.root); return m; };
  const put = (m, p, y, yaw, pitch = 0, roll = 0) => { m.root.position.set(p.x, y, p.z); m.root.rotation.set(-pitch, yaw, roll, "YXZ"); };
  camera.fov = 52; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const cp = at(R.total + 11, -9.5), look = at(R.len + 2, 1.5);
  camera.position.set(cp.x, groundAt(cp.x, cp.z) + 2.0, cp.z);
  camera.lookAt(look.x, groundAt(look.x, look.z) + 3.2, look.z);
  camera.updateMatrixWorld();
  // a spot on the ground under a point of the picture (x, y from -1 to 1)
  const onScreen = (nx, ny) => { const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize(); for (let t = 1; t < 300; t += 0.25) { const x = camera.position.x + v.x * t, y = camera.position.y + v.y * t, z = camera.position.z + v.z * t; if (y < groundAt(x, z)) return { x, z }; } return { x: camera.position.x, z: camera.position.z }; };
  // the dirt bike flying high
  const bike = car("bike", 0xff7a1a);
  const pb = at(R.len + R.top + 6.5, -2.2); put(bike, pb, groundAt(pb.x, pb.z) + R.h + 2.6, R.yaw - 1.05, 0.22, -0.55); // (a sideways "whip" trick!)
  bike.rider.arms[0].rotation.x = bike.rider.arms[1].rotation.x = -1.6;
  // the buggy launching off the ramp
  const bug = car("buggy", 0xffd23a, { neon: 1 });
  const pq = at(R.len - 1.5, -2.4); put(bug, pq, groundAt(pq.x, pq.z) + R.h * 0.85 + 0.15, R.yaw + 0.08, Math.atan2(R.h, R.len) + 0.06, 0.05);
  // the ATV splashing through a mud puddle
  const mud = new THREE.Mesh(new THREE.CircleGeometry(4.6, 18), new THREE.MeshPhongMaterial({ map: textures().mud, shininess: 60, specular: 0x5a4a3a }));
  const pm = at(R.total + 2, 3.4); mud.rotation.x = -Math.PI / 2; mud.position.set(pm.x, groundAt(pm.x, pm.z) + 0.1, pm.z); scene.add(mud);
  const atv = car("atv", 0x3aa04a, { dirt: 0.45 });
  const pa = at(R.total + 3, 3.2), ay = R.yaw - 0.25; put(atv, pa, groundAt(pa.x, pa.z) + 0.12, ay, 0.05, -0.08);
  // mud spraying up from the wheels in big arcs
  const bx = -Math.sin(ay), bz = -Math.cos(ay), cx = Math.cos(ay), cz = -Math.sin(ay), g0 = groundAt(pa.x, pa.z);
  for (let i = 0; i < 190; i++) {
    const side = Math.random() < 0.5 ? -1 : 1, t = 0.04 + Math.random() * 0.5;
    const back = 2 + Math.random() * 6, out = side * (1.5 + Math.random() * 4.5), up = 4 + Math.random() * 6;
    const x = pa.x + bx * (0.7 + back * t) + cx * (side * 0.7 + out * t), z = pa.z + bz * (0.7 + back * t) + cz * (side * 0.7 + out * t);
    const y = g0 + 0.3 + up * t - 11 * t * t;
    if (y < g0 + 0.15) continue;
    fx.chunk(x, y, z, 0, 0, 0, 0.07 + Math.random() * 0.17, [0x5a3d24, 0x6a4a2c, 0x4a311c, 0x7a5a3a][i % 4], 2, 0);
  }
  // dust behind the jump
  for (let i = 0; i < 12; i++) { const p = at(-2 - i * 1.6, (Math.random() - 0.5) * 4); fx.puff(p.x, groundAt(p.x, p.z) + 0.4 + Math.random(), p.z, 0, 0, 0, 1.1 + Math.random(), 0xd8b888, 3, 0.3); }
  // a pickup towing a trailer with an ATV and a dirt bike on it, on the grass next to the track
  const pt = onScreen(-0.62, -0.5), ahead = onScreen(-0.1, -0.42), ty = Math.atan2(ahead.x - pt.x, ahead.z - pt.z);
  const truck = car("pickup", 0xe0203a, { lift: 1, rims: "black" }); put(truck, pt, groundAt(pt.x, pt.z), ty);
  const tr = buildTrailer("utility"); scene.add(tr.root);
  const ptr = { x: pt.x - Math.sin(ty) * (2.62 + 4.4), z: pt.z - Math.cos(ty) * (2.62 + 4.4) };
  tr.root.position.set(ptr.x, groundAt(ptr.x, ptr.z) + 0.04, ptr.z); tr.root.rotation.set(-0.02, ty + 0.05, 0, "YXZ");
  const atv2 = buildCar({ id: "atv", paint: 0x3ad0ff, rims: "chrome", tires: "mud", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0 });
  const bike2 = buildCar({ id: "bike", paint: 0xff5ad8, rims: "gold", tires: "mud", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0 });
  tr.deck.add(atv2.root, bike2.root); atv2.root.position.set(0.62, 0.7, 0.2); bike2.root.position.set(-0.7, 0.7, 0.2);
  for (const m of [atv2, bike2]) if (m.rider) m.rider.root.visible = false;
  // a monster truck coming up behind
  const mon = car("monster", 0x2ac0a0);
  const pmn = at(-20, 3.5); put(mon, pmn, groundAt(pmn.x, pmn.z) + 0.1, R.yaw - 0.1, 0.05);
  fx.update(0.001);
  // a crisp, bright day
  scene.fog.near = 260; scene.fog.far = 1100;
  // move the hay bales that would block the camera
  const B = scene.userData.bales, M = new THREE.Matrix4();
  if (B) { B.list.forEach((o, i) => { if (Math.hypot(o.x - cp.x, o.z - cp.z) < 24) { B.mesh.getMatrixAt(i, M); M.scale(new THREE.Vector3(0, 0, 0)); B.mesh.setMatrixAt(i, M); } }); B.mesh.instanceMatrix.needsUpdate = true; }
  sky.sky.position.copy(camera.position); sky.follow(look.x, groundAt(look.x, look.z), look.z);
  const draw = () => renderer.render(scene, camera);
  draw(); requestAnimationFrame(draw);
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); draw(); });
  window.THUMB_READY = true; window.TH = { pt, ty, cam: camera.position.clone() };
}
