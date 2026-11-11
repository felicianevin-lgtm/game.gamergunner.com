// The 3D world both the editor and Play use: renderer, sky, sun, and turning a game object (game.js) into meshes.
import * as THREE from "../vendor/three.module.js";
import { BY_TYPE, gridMaterialFor, material } from "./assets.js";
import { applyTexture } from "./textures.js";
import { loadModel, modelCopy, pictureTexture, fileType } from "./files.js";

// See-through parts (transp = 0..100 %): their own copies of the materials, faded.
function seeThrough(root, transp) {
  const k = 1 - Math.min(100, transp) / 100;
  root.traverse((m) => {
    if (!m.isMesh || !m.material || m.userData.faded) return;
    m.userData.faded = true;
    m.material = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const c = x.clone(); c.transparent = true; c.opacity = (x.opacity ?? 1) * k; c.depthWrite = k > 0.6; return c; });
    if (m.material.length === 1) m.material = m.material[0];
    m.castShadow = k > 0.5;
  });
}
// Imported models load in the background: a see-through box stands in until the model is ready (red if it's missing).
function addModel(inner, o, fade) {
  const ph = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2f7df6, wireframe: true }));
  ph.position.y = 0.5;
  inner.add(ph);
  if (!o.file) { ph.material.color.set(0xff3030); return; }
  loadModel(o.file, fileType(o.file)).then((info) => {
    inner.remove(ph);
    const m = modelCopy(info, o.anim);
    if (o.transp > 0) fade(m, o.transp);
    inner.add(m);
    inner.userData.copy = m;
  }).catch(() => ph.material.color.set(0xff3030));
}
// Imported pictures: shown on the front and back of a thin board.
function addPicture(inner, o) {
  if (!o.file) return;
  pictureTexture(o.file, (tex) => {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    for (const z of [-0.11, 0.11]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), mat);
      p.position.set(0, 1.5, z); if (z < 0) p.rotation.y = Math.PI;
      inner.add(p);
    }
  });
}

const SKY = {
  day: { top: "#5aa9ff", fog: "#bfe3ff", sun: "#fff4dc", sunI: 2.4, hemi: 1.0, ground: "#4a6b3a" },
  sunset: { top: "#5b3f8a", fog: "#ffb27a", sun: "#ffb070", sunI: 2.0, hemi: 0.8, ground: "#5a4030" },
  night: { top: "#060b1f", fog: "#1a2340", sun: "#9db4ff", sunI: 0.8, hemi: 0.45, ground: "#151a26" },
  space: { top: "#000000", fog: "#0b0618", sun: "#ffffff", sunI: 2.0, hemi: 0.5, ground: "#120a20" },
  backrooms: { top: "#b8a75a", fog: "#a89850", sun: "#fff3c0", sunI: 0.35, hemi: 2.1, ground: "#7a6c3a", near: 25, far: 150, light: "#fff0b8" }, // (indoors: soft yellow light everywhere, fog hides how far it goes)
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); // (keeps the picture for thumbnails)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 4000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
  let stars = null;

  const world = {
    THREE, renderer, scene, camera, sun,
    root: new THREE.Group(),
    setSky(name, building) { // (building = the studio: fog much farther away, so you can see the whole map)
      const s = SKY[name] || SKY.day;
      scene.background = skyTexture(s.top, s.fog);
      scene.fog = new THREE.Fog(s.fog, (s.near || 180) * (building && s.near ? 6 : 1), (s.far || 900) * (building && s.far ? 4 : 1));
      hemi.color.set(s.light || (s.top === "#000000" ? "#8888aa" : s.fog)); hemi.groundColor.set(s.ground); hemi.intensity = s.hemi;
      sun.color.set(s.sun); sun.intensity = s.sunI;
      if (stars) { scene.remove(stars); stars = null; }
      if (name === "night" || name === "space") scene.add(stars = makeStars(name === "space" ? 1600 : 700));
    },
    // Keep the sun's shadow box around what the camera looks at.
    follow(target) {
      sun.position.copy(target).addScaledVector(sunDir, 150);
      sun.target.position.copy(target);
      if (stars) stars.position.copy(camera.position);
    },
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    },
  };
  scene.add(world.root);
  return world;
}

function skyTexture(top, bottom) {
  const cv = document.createElement("canvas"); cv.width = 2; cv.height = 256;
  const g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.62, bottom); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeStars(n) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(1500);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
}

// ---------------------------------------------------------------- objects
const D2R = Math.PI / 180;
export function buildObject(o) {
  const a = BY_TYPE[o.type];
  const inner = a.build(o);
  if (o.type === "mesh") buildMesh(inner, o);
  if (o.mat === "grass" && o.type !== "mesh") { // the grid texture repeats with the part's size
    const gm = gridMaterialFor(o.color, o.size), plain = material(o.color, "grass");
    inner.traverse((m) => { if (m.isMesh && m.material === plain) m.material = gm; });
  }
  inner.scale.set(o.size[0] / a.base[0], o.size[1] / a.base[1], o.size[2] / a.base[2]);
  if (o.tex && !inner.userData.model && !inner.userData.picture && o.type !== "mesh") applyTexture(inner, o); // (🧱 textures.js)
  const g = new THREE.Group();
  g.add(inner);
  if (inner.userData.model) addModel(inner, o, seeThrough);
  if (inner.userData.picture) addPicture(inner, o);
  if (o.transp > 0) seeThrough(inner, o.transp);
  if (o.b && o.b.k === "light") { // (a glowing part lights up what's around it)
    const l = new THREE.PointLight(o.color, Math.max(0, Number(o.b.power) || 0) * 6, Math.max(1, Number(o.b.range) || 30), 1);
    l.position.set(0, o.size[1] / 2, 0);
    g.add(l);
  }
  g.userData.id = o.id;
  g.userData.inner = inner;
  placeObject(g, o);
  return g;
}
// 🧩 A mesh's pieces, each hanging from its 🦴 bone (if it has one): a bone is a joint at `at` that turns the pieces
// it holds (and the bones under it). inner.userData.bones = Map(bone id -> its joint), for keyanim.js boneList.
function buildMesh(inner, o) {
  const mb = o.mb || [1, 1, 1], sub = new THREE.Group();
  sub.scale.set(1 / mb[0], 1 / mb[1], 1 / mb[2]);
  inner.add(sub);
  const bones = Array.isArray(o.bones) ? o.bones : [], byId = new Map(bones.map((b) => [b.id, b])), made = new Map(), owner = new Map();
  for (const b of bones) for (const i of b.parts || []) if (!owner.has(i)) owner.set(i, b.id);
  const joint = (id, depth) => {
    if (!id || !byId.has(id) || depth > 40) return sub;
    if (made.has(id)) return made.get(id);
    const b = byId.get(id), up = byId.has(b.parent) ? byId.get(b.parent).at : [0, 0, 0];
    const n = new THREE.Group(); n.name = b.name; n.userData.boneId = id;
    n.position.set(b.at[0] - up[0], b.at[1] - up[1], b.at[2] - up[2]);
    joint(b.parent, depth + 1).add(n); made.set(id, n);
    return n;
  };
  for (const b of bones) joint(b.id, 0);
  (o.parts || []).forEach((p, i) => {
    if (!BY_TYPE[p.type] || BY_TYPE[p.type] === BY_TYPE.mesh) return;
    const pg = buildObject({ ...p, id: "", b: { k: "none" } });
    delete pg.userData.id; pg.userData.part = i;
    const bid = owner.get(i), at = bid ? byId.get(bid).at : null;
    if (at) pg.position.sub(new THREE.Vector3(at[0], at[1], at[2]));
    joint(bid, 0).add(pg);
  });
  inner.userData.bones = made;
  inner.userData.meshRoot = sub;
}
export function placeObject(g, o) {
  g.position.set(o.pos[0], o.pos[1], o.pos[2]);
  g.rotation.set(o.rot[0] * D2R, o.rot[1] * D2R, o.rot[2] * D2R);
}

// The solid boxes of an object in the world: [{c: Vector3 center, q: Quaternion, h: Vector3 half size}].
const _q = new THREE.Quaternion(), _qx = new THREE.Quaternion(), _e = new THREE.Euler(), _X = new THREE.Vector3(1, 0, 0);
export function worldBoxes(o, pos, quat) {
  const a = BY_TYPE[o.type];
  const list = a.colliders ? a.colliders(o.size, o) : [{ c: [0, o.size[1] / 2, 0], h: [o.size[0] / 2, o.size[1] / 2, o.size[2] / 2] }];
  const q = quat || _q.setFromEuler(_e.set(o.rot[0] * D2R, o.rot[1] * D2R, o.rot[2] * D2R));
  const p = pos || new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]);
  return list.map((b) => {
    const bq = q.clone();
    if (b.q) bq.multiply(b.q); // (a mesh's turned pieces)
    else if (b.rx) bq.multiply(_qx.setFromAxisAngle(_X, b.rx));
    return { c: new THREE.Vector3(b.c[0], b.c[1], b.c[2]).applyQuaternion(q).add(p), q: bq, h: new THREE.Vector3(b.h[0], b.h[1], b.h[2]) };
  });
}
// The whole object's box (used for touching coins, lava, checkpoints...).
export function boundsBox(o, pos, quat) {
  const q = quat || new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rot[0] * D2R, o.rot[1] * D2R, o.rot[2] * D2R));
  const p = pos || new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]);
  return { c: new THREE.Vector3(0, o.size[1] / 2, 0).applyQuaternion(q).add(p), q, h: new THREE.Vector3(o.size[0] / 2, o.size[1] / 2, o.size[2] / 2) };
}
