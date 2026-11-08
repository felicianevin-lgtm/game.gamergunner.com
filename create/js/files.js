// IMPORTED FILES for GunnerVerse Studio: pictures (PNG / JPG / WEBP / GIF) and 3D models (GLB / GLTF / FBX / OBJ) that
// players bring in from their computer. Saved in THIS browser (IndexedDB "gv_files", store "files"):
//   id -> {id, name, type: png / jpeg / glb / gltf / fbx / obj, kind: image / model, bytes: ArrayBuffer, size, at, sid?}
// A game lists the files it uses in game.files = {id: {name, type, sid?}}; sid = the file's id on the relay (Publish
// uploads files that don't have one yet, relay files.js). Published games load files from the relay instead.
// Pictures are shrunk to 1024 px at most when imported. Models must be 5 MB or less, and a model can't pull anything
// from the internet (everything it needs has to be inside the file).
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { OBJLoader } from "../vendor/OBJLoader.js";
import { FBXLoader } from "../vendor/FBXLoader.js";
import * as SkeletonUtils from "../vendor/SkeletonUtils.js";
import { RELAY } from "./net.js";

export const MAX_MODEL = 5 * 1024 * 1024, MAX_PICTURE_IN = 25 * 1024 * 1024, MAX_FILES = 30;
const EXT = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "png", gif: "png", glb: "glb", gltf: "gltf", fbx: "fbx", obj: "obj" };
export const MIME = { png: "image/png", jpeg: "image/jpeg", glb: "model/gltf-binary", gltf: "model/gltf+json", fbx: "application/octet-stream", obj: "text/plain" };
export const ACCEPT = ".glb,.gltf,.fbx,.obj,.png,.jpg,.jpeg,.webp,.gif";
export const isModel = (type) => ["glb", "gltf", "fbx", "obj"].includes(type);

// ---------------------------------------------------------------- the browser's file store
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((ok, bad) => {
    const r = indexedDB.open("gv_files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files", { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => {
    const t = d.transaction("files", mode), s = t.objectStore("files");
    const r = fn(s);
    t.oncomplete = () => ok(r && "result" in r ? r.result : undefined);
    t.onerror = () => bad(t.error);
  });
}
const mem = new Map();   // id -> record (bytes loaded)
const urls = new Map();  // id -> object URL (pictures)
const remote = new Map(); // id -> relay sid (published games)

export async function getFile(id) {
  if (mem.has(id)) return mem.get(id);
  const rec = await tx("readonly", (s) => s.get(id)).catch(() => null);
  if (rec) mem.set(id, rec);
  return rec || null;
}
export async function listFiles() {
  const all = (await tx("readonly", (s) => s.getAll()).catch(() => [])) || [];
  return all.map(({ id, name, type, kind, size, at, sid }) => ({ id, name, type, kind, size, at, sid })).sort((a, b) => b.at - a.at);
}
export async function setSid(id, sid) {
  const rec = await getFile(id);
  if (!rec) return;
  rec.sid = sid;
  await tx("readwrite", (s) => s.put(rec)).catch(() => {});
}
export async function deleteFile(id) { mem.delete(id); await tx("readwrite", (s) => s.delete(id)).catch(() => {}); }

// Bring in a file from the computer. Returns the record (without bytes) or throws an Error with a kid-friendly message.
export async function importFile(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = EXT[ext];
  if (!type) throw new Error("GunnerVerse can't open ." + ext + " files. Use a picture (PNG, JPG) or a 3D model (GLB, GLTF, FBX, OBJ).");
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[^\w \-]/g, "").slice(0, 30) || "Imported";
  let bytes, kind = isModel(type) ? "model" : "image";
  if (kind === "model") {
    if (file.size > MAX_MODEL) throw new Error("That model is " + (file.size / 1048576).toFixed(1) + " MB. Models can be up to 5 MB. Look for a \"low poly\" version!");
    bytes = await file.arrayBuffer();
    await parseModel(type, bytes); // (make sure it really opens)
  } else {
    if (file.size > MAX_PICTURE_IN) throw new Error("That picture is too big.");
    bytes = await shrinkPicture(file, type);
  }
  const rec = { id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36), name, type: kind === "image" ? bytes.type : type, kind, bytes: bytes.buf || bytes, size: (bytes.buf || bytes).byteLength, at: Date.now() };
  await tx("readwrite", (s) => s.put(rec));
  mem.set(rec.id, rec);
  return { id: rec.id, name, type: rec.type, kind, size: rec.size };
}

// Pictures: at most 1024 px, PNG when it's small enough (keeps see-through parts), otherwise JPG.
async function shrinkPicture(file, type) {
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That picture couldn't be opened. Try a JPG or PNG.")); i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(img.src);
  const blob = (t, q) => new Promise((ok) => cv.toBlob(ok, t, q));
  let b = type === "png" ? await blob("image/png") : null, out = "png";
  if (!b || b.size > 900000) { b = await blob("image/jpeg", 0.86); out = "jpeg"; }
  return { buf: await b.arrayBuffer(), type: out };
}

// ---------------------------------------------------------------- using files
// The game's files (so parts know each file's type). remote = true: a published game, files come from the relay.
const known = new Map();
export function useFiles(files, fromRelay) {
  remote.clear(); known.clear();
  for (const [id, f] of Object.entries(files || {})) {
    if (!f) continue;
    known.set(id, f.type);
    if (fromRelay && f.sid) remote.set(id, f.sid);
  }
}
export function noteFile(id, type) { known.set(id, type); }
export const fileType = (id) => known.get(id) || "";
export function clearMixers() { mixers.clear(); }
async function bytesOf(id) {
  if (remote.has(id)) {
    const r = await fetch(RELAY + "/hub/file/" + remote.get(id));
    if (!r.ok) throw new Error("missing");
    return r.arrayBuffer();
  }
  const rec = await getFile(id);
  if (!rec) throw new Error("missing");
  return rec.bytes;
}
// A picture's address (sync: "" until preloaded with loadPictures).
export function fileUrl(id) { return remote.has(id) ? RELAY + "/hub/file/" + remote.get(id) : urls.get(id) || ""; }
export async function loadPictures(files) {
  for (const [id, f] of Object.entries(files || {})) {
    if (isModel(f.type) || remote.has(id) || urls.has(id)) continue;
    const rec = await getFile(id);
    if (rec) urls.set(id, URL.createObjectURL(new Blob([rec.bytes], { type: MIME[rec.type] || "image/png" })));
  }
}

// Picture textures for 3D parts (cached).
const texCache = new Map();
export function pictureTexture(id, onReady) {
  if (texCache.has(id)) { const t = texCache.get(id); if (t.image) onReady(t); else t.userData.wait.push(onReady); return; }
  const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.userData.wait = [onReady];
  texCache.set(id, t);
  const go = (src) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { t.image = img; t.needsUpdate = true; t.userData.wait.forEach((f) => f(t)); t.userData.wait = []; }; img.src = src; };
  if (fileUrl(id)) go(fileUrl(id));
  else getFile(id).then((rec) => { if (rec) { urls.set(id, URL.createObjectURL(new Blob([rec.bytes], { type: MIME[rec.type] }))); go(urls.get(id)); } });
}

// ---------------------------------------------------------------- 3D models
// Nothing from the internet: a model only gets what's packed inside its file.
const offline = new THREE.LoadingManager();
offline.setURLModifier((u) => (/^(data|blob):/.test(u) ? u : "data:application/octet-stream;base64,"));
function parseModel(type, bytes) {
  return new Promise((ok, bad) => {
    const fail = () => bad(new Error("That model couldn't be opened. If it came with extra files, try a .glb version."));
    try {
      if (type === "glb" || type === "gltf") new GLTFLoader(offline).parse(bytes, "", (g) => ok({ scene: g.scene, animations: g.animations || [] }), fail);
      else if (type === "fbx") { const s = new FBXLoader(offline).parse(bytes, ""); ok({ scene: s, animations: s.animations || [] }); }
      else if (type === "obj") { const s = new OBJLoader(offline).parse(new TextDecoder().decode(bytes)); s.traverse((m) => { if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0xb0b6c0, roughness: 0.7 }); }); ok({ scene: s, animations: [] }); }
      else fail();
    } catch { fail(); }
  });
}
// The model scaled to fit a 1 x 1 x 1 box (bottom at 0, centered), so the object's Size sets its real size.
const models = new Map(); // id -> Promise<{tpl, animations, dims}>
export function loadModel(id, type) {
  if (!models.has(id)) models.set(id, bytesOf(id).then((b) => parseModel(type, b)).then(({ scene, animations }) => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), dims = box.getSize(new THREE.Vector3());
    const tpl = new THREE.Group(), fit = new THREE.Group();
    fit.add(scene);
    scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    fit.scale.set(1 / Math.max(dims.x, 1e-4), 1 / Math.max(dims.y, 1e-4), 1 / Math.max(dims.z, 1e-4));
    tpl.add(fit);
    scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return { tpl, animations, dims };
  }));
  return models.get(id);
}
// A copy of a model for one object (skinned characters need SkeletonUtils), with its animation player.
export function modelCopy(info, anim) {
  const copy = SkeletonUtils.clone(info.tpl);
  if (info.animations.length) {
    const mixer = new THREE.AnimationMixer(copy);
    copy.userData.mixer = mixer;
    copy.userData.play = (name) => {
      const clip = info.animations.find((a) => a.name === name) || (name === true ? info.animations[0] : null);
      mixer.stopAllAction();
      if (clip) mixer.clipAction(clip).play();
    };
    if (anim) copy.userData.play(anim === "*" ? true : anim);
    mixers.add(mixer);
  }
  return copy;
}
export const mixers = new Set();
export function updateMixers(dt) { for (const m of mixers) m.update(dt); }
export function animationNames(id) { return models.has(id) ? models.get(id).then((m) => m.animations.map((a) => a.name)) : Promise.resolve([]); }
// How big a model should start: about 5 studs tall (or 10 wide).
export async function startSize(id, type) {
  const { dims } = await loadModel(id, type);
  const k = Math.min(5 / Math.max(dims.y, 1e-4), 10 / Math.max(dims.x, dims.z, 1e-4));
  return [dims.x * k, dims.y * k, dims.z * k].map((v) => Math.max(0.1, Math.round(v * 100) / 100));
}
