// Forge 3D: a free, easy 3D model + map maker. Standalone app (three.js from a pinned CDN version).
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";
import { TransformControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/TransformControls.js/+esm";
import * as P from "./poly.js";
import { exportGLTF, exportOBJ, exportFBX, download } from "./exporters.js";
import { icon } from "./icons.js";

const $ = (id) => document.getElementById(id);
const canvas = $("view"), vp = $("viewport");
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const CTRL = isMac ? "⌘" : "Ctrl";

// ---------------------------------------------------------------- state
const S = {
  tool: "select", mode: "object", emode: "f", sel: [], eo: null, esel: new Set(),
  snap: true, grid: 0.5, xray: false, space: "world", level: 0,
  speed: 6, yaw: -0.65, pitch: -0.42, keys: new Set(), ctrlCombo: false,
  wall: { h: 3, t: 0.2 }, chain: null, floorStart: null, lastOp: null, hideGrid: false,
};
let nextId = 1;

// ---------------------------------------------------------------- three.js setup
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2e37);
scene.fog = new THREE.Fog(0x2a2e37, 120, 260);
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1000);
camera.rotation.order = "YXZ"; camera.position.set(6, 5, 8);
scene.add(new THREE.HemisphereLight(0xe6eeff, 0x3b342b, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
scene.add(sun, sun.target);
const grid = new THREE.Group();
const g1 = new THREE.GridHelper(200, 200, 0x3c414d, 0x343843); g1.material.transparent = true; g1.material.opacity = 0.8;
const g2 = new THREE.GridHelper(200, 20, 0x4a5060, 0x4a5060);
grid.add(g1, g2); grid.position.y = -0.003; // just under floors built at height 0
const axisLine = (a, b, c) => { const g = new THREE.BufferGeometry().setFromPoints([a, b]); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: c })); };
grid.add(axisLine(new THREE.Vector3(-100, 0.002, 0), new THREE.Vector3(100, 0.002, 0), 0xc94a4a), axisLine(new THREE.Vector3(0, 0.002, -100), new THREE.Vector3(0, 0.002, 100), 0x4a7ad0));
scene.add(grid);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.25 }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -0.001; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

const world = new THREE.Group(); world.userData.isWorld = true; scene.add(world);
const helpers = new THREE.Group(); scene.add(helpers);
const outlines = new THREE.Group(); helpers.add(outlines);
const editG = new THREE.Group(); editG.matrixAutoUpdate = false; helpers.add(editG);
const ghost = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x3ea6ff, transparent: true, opacity: 0.45, depthWrite: false }));
ghost.visible = false; helpers.add(ghost);
const cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0xffb03a, side: THREE.DoubleSide, depthTest: false }));
cursorRing.rotation.x = -Math.PI / 2; cursorRing.renderOrder = 10; cursorRing.visible = false; helpers.add(cursorRing);

const tc = new TransformControls(camera, canvas);
const tcHelper = tc.getHelper ? tc.getHelper() : tc; scene.add(tcHelper);
const pivot = new THREE.Object3D(); scene.add(pivot);
tc.setSize(0.9);

// little axis widget in the corner
const axScene = new THREE.Scene(), axCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
for (const [d, c, l] of [[[1, 0, 0], 0xff5d5d, "X"], [[0, 1, 0], 0x7ee07e, "Y"], [[0, 0, 1], 0x6fa8ff, "Z"]]) {
  axScene.add(axisLine(new THREE.Vector3(), new THREE.Vector3(...d), c));
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
  x.fillStyle = "#" + c.toString(16).padStart(6, "0"); x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill();
  x.fillStyle = "#111"; x.font = "bold 36px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(l, 32, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); sp.position.set(...d).multiplyScalar(1.25); sp.scale.setScalar(0.55); axScene.add(sp);
}

// ---------------------------------------------------------------- objects
const PALETTE = ["#c9ced6", "#ffffff", "#7a808c", "#2b2f36", "#e53935", "#ff7a2f", "#ffc928", "#9ccc3c", "#2e9e4f", "#25b7b7", "#3e8cff", "#2c4fb8", "#8e5be8", "#e05bbd", "#8b5a2b", "#c79a63", "#d9d4cc", "#9fd8ff"];
function makeMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: o.c || "#c9ced6", roughness: o.r ?? 0.7, metalness: o.m ?? 0, side: THREE.FrontSide });
  setOpacity(m, o.o ?? 1); return m;
}
function setOpacity(m, v) { m.opacity = v; m.transparent = v < 1; m.depthWrite = v >= 1; m.needsUpdate = true; }
function makeMesh(poly, o = {}) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), makeMat(o.mat));
  mesh.userData = { fid: o.id || nextId++, kind: "mesh", poly, smooth: !!o.smooth, param: o.param || null, openingOf: o.openingOf };
  mesh.name = o.name || "Mesh"; mesh.castShadow = mesh.receiveShadow = true;
  rebuild(mesh); return mesh;
}
function makeGroup(name, id) { const g = new THREE.Group(); g.name = name || "Group"; g.userData = { fid: id || nextId++, kind: "group" }; return g; }
function rebuild(o) {
  const { geometry, triFace } = P.toGeometry(o.userData.poly, o.userData.smooth);
  o.geometry.dispose(); o.geometry = geometry; o.userData.triFace = triFace;
}
function uniqueName(base) {
  const names = new Set(); world.traverse((o) => names.add(o.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(base + " " + i)) return base + " " + i;
}
const isObj = (o) => o && o.userData && o.userData.fid;
const kids = (o) => o.children.filter(isObj);
function byId(id) { let r = null; world.traverse((o) => { if (o.userData.fid === id) r = o; }); return r; }
function disposeTree(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }
function allObjects() { const a = []; world.traverse((o) => { if (isObj(o)) a.push(o); }); return a; }

// ---------------------------------------------------------------- save format (also used for undo)
function serObj(o) {
  const d = { id: o.userData.fid, name: o.name, kind: o.userData.kind, p: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray() };
  if (!o.visible) d.hidden = 1;
  if (o.userData.kind === "mesh") {
    const m = o.material;
    d.poly = P.clone(o.userData.poly); d.smooth = o.userData.smooth ? 1 : 0;
    if (o.userData.param) d.param = JSON.parse(JSON.stringify(o.userData.param));
    if (o.userData.openingOf) d.openingOf = o.userData.openingOf;
    d.mat = { c: "#" + m.color.getHexString(), r: m.roughness, m: m.metalness, o: m.userData.oldOp ?? m.opacity };
  }
  const ch = kids(o); if (ch.length) d.ch = ch.map(serObj);
  return d;
}
function deserObj(d, freshIds) {
  const id = freshIds ? nextId++ : d.id;
  const o = d.kind === "mesh" ? makeMesh(P.clone(d.poly), { id, name: d.name, smooth: d.smooth, param: d.param ? JSON.parse(JSON.stringify(d.param)) : null, mat: d.mat, openingOf: d.openingOf }) : makeGroup(d.name, id);
  o.position.fromArray(d.p); o.quaternion.fromArray(d.q); o.scale.fromArray(d.s); o.visible = !d.hidden;
  for (const c of d.ch || []) o.add(deserObj(c, freshIds));
  if (!freshIds) nextId = Math.max(nextId, id + 1);
  return o;
}
const serialize = () => ({ app: "forge3d", version: 1, name: $("projname").value, objects: kids(world).map(serObj) });
function loadData(data) {
  for (const c of kids(world)) { c.removeFromParent(); disposeTree(c); }
  for (const d of data.objects || []) world.add(deserObj(d, false));
  if (data.name) $("projname").value = data.name;
}
function snapshot() {
  return { data: serialize(), sel: S.sel.map((o) => o.userData.fid), mode: S.mode, emode: S.emode, esel: [...S.esel], eo: S.eo ? S.eo.userData.fid : null };
}
function restore(sn) {
  loadData(sn.data);
  S.sel = sn.sel.map(byId).filter(Boolean);
  const eo = sn.eo && byId(sn.eo);
  if (sn.mode === "edit" && eo) { S.mode = "edit"; S.eo = eo; S.emode = sn.emode; S.esel = new Set(sn.esel); editLook(eo, true); }
  else { S.mode = "object"; S.eo = null; S.esel = new Set(); }
  refreshAll();
}

// ---------------------------------------------------------------- undo / redo + autosave
const hist = { list: [], i: -1 };
function commit(label) {
  hist.list.length = hist.i + 1; hist.list.push({ label, sn: snapshot() });
  if (hist.list.length > 80) hist.list.shift(); hist.i = hist.list.length - 1;
  scheduleAutosave(); updateHistButtons();
}
function undo() {
  if (hist.i <= 0) return toast("Nothing to undo.");
  const label = hist.list[hist.i].label; hist.i--; restoreKeepEdit(hist.list[hist.i].sn); S.lastOp = null; showLastOp(); toast("Undo: " + label); scheduleAutosave(); updateHistButtons();
}
function redo() {
  if (hist.i >= hist.list.length - 1) return toast("Nothing to redo.");
  hist.i++; restoreKeepEdit(hist.list[hist.i].sn); S.lastOp = null; showLastOp(); toast("Redo: " + hist.list[hist.i].label); scheduleAutosave(); updateHistButtons();
}
function restoreKeepEdit(sn) { // undo/redo while editing a shape stays in Edit mode
  const eoId = S.mode === "edit" && S.eo ? S.eo.userData.fid : null, em = S.emode;
  restore(sn);
  const o = eoId && byId(eoId);
  if (o && S.mode !== "edit" && o.userData.kind === "mesh" && !o.userData.param) { S.mode = "edit"; S.eo = o; S.sel = [o]; S.emode = em; S.esel = new Set(); editLook(o, true); refreshAll(); }
}
const idb = {
  db: null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open("forge3d", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(this.db = r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
};
let saveTimer = 0;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = 0; idb.set("autosave", { t: Date.now(), data: serialize() }).catch((e) => toast("Autosave failed: " + e.message, true)); }, 700);
}

// ---------------------------------------------------------------- selection display
const outlineMat = new THREE.LineBasicMaterial({ color: 0xff8a1a }), activeMat = new THREE.LineBasicMaterial({ color: 0xffd36b });
function refreshOutlines() {
  for (const c of [...outlines.children]) { c.geometry.dispose(); c.removeFromParent(); }
  if (S.mode === "edit") return;
  S.sel.forEach((o, i) => o.traverse((m) => {
    if (!m.isMesh || !m.userData.poly) return;
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), i === S.sel.length - 1 ? activeMat : outlineMat);
    l.matrixAutoUpdate = false; l.userData.src = m; outlines.add(l);
  }));
}
const edgeLineMat = new THREE.LineBasicMaterial({ vertexColors: true });
const vertMat = new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true });
const faceSelMat = new THREE.MeshBasicMaterial({ color: 0xff9a2a, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide });
let editEdges = [];
function refreshEditOverlay() {
  for (const c of [...editG.children]) { c.geometry.dispose(); c.removeFromParent(); }
  if (S.mode !== "edit" || !S.eo) return;
  const m = S.eo.userData.poly, vs = P.selVerts(m, S.emode, S.esel);
  const hot = new THREE.Color(0xffa733), cold = new THREE.Color(0x14161a), wire = new THREE.Color(0x0b0d10);
  editEdges = P.allEdges(m);
  const lp = [], lc = [];
  for (const [a, b] of editEdges) {
    lp.push(...m.v[a], ...m.v[b]);
    const on = S.emode === "e" ? S.esel.has(P.ekey(a, b)) : vs.has(a) && vs.has(b);
    const c = on ? hot : wire; lc.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
  editG.add(new THREE.LineSegments(lg, edgeLineMat));
  const pp = [], pc = [];
  m.v.forEach((p, i) => { pp.push(...p); const c = vs.has(i) ? hot : cold; pc.push(c.r, c.g, c.b); });
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute("color", new THREE.Float32BufferAttribute(pc, 3));
  vertMat.size = S.emode === "v" ? 9 : 5; vertMat.depthTest = edgeLineMat.depthTest = !S.xray;
  editG.add(new THREE.Points(pg, vertMat));
  const sf = S.emode === "f" ? [...S.esel].filter((i) => m.f[i]) : m.f.map((f, i) => (f.every((v) => vs.has(v)) ? i : -1)).filter((i) => i >= 0);
  if (sf.length) editG.add(new THREE.Mesh(P.toGeometry({ v: m.v, f: sf.map((i) => m.f[i]) }).geometry, faceSelMat));
}
function editLook(o, on) {
  const m = o.material; m.polygonOffset = on; m.polygonOffsetFactor = on ? 1 : 0; m.polygonOffsetUnits = on ? 1 : 0;
  if (on && S.xray) { m.userData.oldOp = m.opacity; setOpacity(m, Math.min(m.opacity, 0.45)); }
  else if (m.userData.oldOp !== undefined) { setOpacity(m, m.userData.oldOp); delete m.userData.oldOp; }
  m.needsUpdate = true;
}

// ---------------------------------------------------------------- gizmo
const GIZMO_TOOLS = { move: "translate", rotate: "rotate", scale: "scale" };
function selRoots() { // selected objects without ones whose parent is also selected
  const set = new Set(S.sel);
  return S.sel.filter((o) => { for (let p = o.parent; p && !p.userData.isWorld; p = p.parent) if (set.has(p)) return false; return true; });
}
function editSelWorld() {
  const m = S.eo.userData.poly, vs = [...P.selVerts(m, S.emode, S.esel)];
  S.eo.updateWorldMatrix(true, false);
  return { vs, pts: vs.map((i) => new THREE.Vector3(...m.v[i]).applyMatrix4(S.eo.matrixWorld)) };
}
function updateGizmo() {
  if (tc.dragging) return;
  const mode = GIZMO_TOOLS[S.tool];
  let ok = false;
  if (mode && S.mode === "object" && S.sel.length) {
    const roots = selRoots(), c = new THREE.Vector3(), w = new THREE.Vector3();
    roots.forEach((o) => { o.getWorldPosition(w); c.add(w); }); c.divideScalar(roots.length);
    pivot.position.copy(c);
    if (S.space === "local" || mode === "scale") S.sel[S.sel.length - 1].getWorldQuaternion(pivot.quaternion); else pivot.quaternion.identity();
    ok = true;
  } else if (mode && S.mode === "edit" && S.eo && S.esel.size) {
    const { pts } = editSelWorld(); if (pts.length) {
      const c = new THREE.Vector3(); pts.forEach((p) => c.add(p)); pivot.position.copy(c.divideScalar(pts.length));
      if (S.space === "local" || mode === "scale") S.eo.getWorldQuaternion(pivot.quaternion); else pivot.quaternion.identity();
      ok = true;
    }
  }
  pivot.scale.set(1, 1, 1); pivot.updateMatrixWorld(true);
  if (ok) { tc.setMode(mode); tc.setSpace(mode === "scale" ? "local" : S.space); tc.attach(pivot); applySnap(); } else tc.detach();
}
function applySnap() {
  tc.setTranslationSnap(S.snap ? S.grid : null);
  tc.setRotationSnap(S.snap ? THREE.MathUtils.degToRad(15) : null);
  tc.setScaleSnap(S.snap ? 0.1 : null);
}
let drag = null;
tc.addEventListener("dragging-changed", (e) => {
  if (e.value) {
    pivot.updateMatrixWorld(true);
    drag = { inv: pivot.matrixWorld.clone().invert() };
    if (S.mode === "object") drag.objs = selRoots().map((o) => { o.updateWorldMatrix(true, false); return { o, w: o.matrixWorld.clone() }; });
    else { const { vs, pts } = editSelWorld(); drag.vs = vs; drag.pts = pts; drag.invObj = S.eo.matrixWorld.clone().invert(); }
  } else if (drag) {
    drag = null;
    commit(S.tool === "move" ? "Move" : S.tool === "rotate" ? "Rotate" : "Scale");
    S.lastOp = null; showLastOp(); renderProps(); updateGizmo();
  }
});
const tmpM = new THREE.Matrix4(), tmpM2 = new THREE.Matrix4();
tc.addEventListener("objectChange", () => {
  if (!drag) return;
  pivot.updateMatrixWorld(true);
  const M = tmpM.multiplyMatrices(pivot.matrixWorld, drag.inv);
  if (drag.objs) {
    for (const { o, w } of drag.objs) {
      o.parent.updateWorldMatrix(true, false);
      tmpM2.copy(o.parent.matrixWorld).invert().multiply(M).multiply(w);
      tmpM2.decompose(o.position, o.quaternion, o.scale);
    }
    updateTransformFields();
  } else {
    const m = S.eo.userData.poly, p = new THREE.Vector3();
    drag.vs.forEach((vi, k) => { p.copy(drag.pts[k]).applyMatrix4(M).applyMatrix4(drag.invObj); m.v[vi] = [p.x, p.y, p.z]; });
    rebuild(S.eo); refreshEditOverlay();
  }
});
tc.addEventListener("mouseDown", () => { gizmoGrab = true; });
let gizmoGrab = false;

// ---------------------------------------------------------------- picking
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function vpSize() { return { w: vp.clientWidth, h: vp.clientHeight }; }
function setRay(x, y) { const { w, h } = vpSize(); ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1); ray.setFromCamera(ndc, camera); return ray; }
function local(ev) { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
function visibleMeshes() { const a = []; world.traverseVisible((o) => { if (o.isMesh && o.userData.poly) a.push(o); }); return a; }
function hitObjects(x, y) { setRay(x, y); return ray.intersectObjects(visibleMeshes(), false); }
function pickTarget(o) { let top = null; for (let p = o; p && !p.userData.isWorld; p = p.parent) if (p.userData.kind === "group") top = p; return top || o; }
function toScreen(v) { const { w, h } = vpSize(); const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, z: p.z }; }
function unblocked(pt) { // can the camera see this world point (not hidden behind the edited mesh)?
  if (S.xray) return true;
  const d = pt.clone().sub(camera.position), L = d.length(); ray.set(camera.position, d.normalize());
  const h = ray.intersectObject(S.eo, false)[0]; return !h || h.distance > L - (0.002 + L * 0.002);
}
function groundAt(x, y, level = S.level) {
  setRay(x, y); const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -level), p) ? p : null;
}
const sn = (x, step = S.grid) => (S.snap ? Math.round(x / step) * step : Math.round(x * 100) / 100);

function clickSelect(x, y, add) {
  if (S.mode === "object") {
    const h = hitObjects(x, y)[0];
    if (!h) { if (!add) setSel([]); return; }
    const t = pickTarget(h.object);
    if (add) setSel(S.sel.includes(t) ? S.sel.filter((o) => o !== t) : [...S.sel, t]); else setSel([t]);
    return;
  }
  const m = S.eo.userData.poly; S.eo.updateWorldMatrix(true, false); const W = S.eo.matrixWorld;
  let found = null;
  if (S.emode === "f") {
    setRay(x, y); const h = ray.intersectObject(S.eo, false)[0];
    if (h) found = S.eo.userData.triFace[h.faceIndex];
  } else if (S.emode === "v") {
    let best = 14;
    m.v.forEach((p, i) => { const w = new THREE.Vector3(...p).applyMatrix4(W), s = toScreen(w), d = Math.hypot(s.x - x, s.y - y); if (s.z < 1 && d < best && unblocked(w)) { best = d; found = i; } });
  } else {
    let best = 10;
    for (const [a, b] of editEdges) {
      const A = new THREE.Vector3(...m.v[a]).applyMatrix4(W), B = new THREE.Vector3(...m.v[b]).applyMatrix4(W), sa = toScreen(A), sb = toScreen(B);
      if (sa.z > 1 || sb.z > 1) continue;
      const dx = sb.x - sa.x, dy = sb.y - sa.y, t = Math.max(0, Math.min(1, ((x - sa.x) * dx + (y - sa.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(sa.x + dx * t - x, sa.y + dy * t - y);
      if (d < best && unblocked(A.clone().lerp(B, t))) { best = d; found = P.ekey(a, b); }
    }
  }
  if (found === null || found === undefined) { if (!add) S.esel = new Set(); }
  else if (add) { if (S.esel.has(found)) S.esel.delete(found); else S.esel.add(found); }
  else S.esel = new Set([found]);
  editSelChanged();
}
function boxSelect(r, add) {
  const inR = (s) => s.z < 1 && s.x >= r.x0 && s.x <= r.x1 && s.y >= r.y0 && s.y <= r.y1;
  if (S.mode === "object") {
    const picked = new Set(add ? S.sel : []);
    for (const o of visibleMeshes()) { const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); if (inR(toScreen(c))) picked.add(pickTarget(o)); }
    setSel([...picked]); return;
  }
  const m = S.eo.userData.poly, W = S.eo.matrixWorld, ws = m.v.map((p) => new THREE.Vector3(...p).applyMatrix4(W));
  const vin = ws.map((w) => inR(toScreen(w)) && unblocked(w));
  const out = add ? new Set(S.esel) : new Set();
  if (S.emode === "v") vin.forEach((ok, i) => ok && out.add(i));
  else if (S.emode === "e") { for (const [a, b] of editEdges) if (vin[a] && vin[b]) out.add(P.ekey(a, b)); }
  else m.f.forEach((f, fi) => { const c = new THREE.Vector3(...P.faceCenter(m, f)).applyMatrix4(W); if (inR(toScreen(c)) && unblocked(c)) out.add(fi); });
  S.esel = out; editSelChanged();
}

// ---------------------------------------------------------------- selection + modes
function setSel(list) { S.sel = list; refreshAll(); }
function editSelChanged() { refreshEditOverlay(); updateGizmo(); renderProps(); }
function refreshAll() { refreshOutlines(); refreshEditOverlay(); updateGizmo(); renderOutliner(); renderProps(); renderToolbar(); renderTop(); updateHint(); }
function setTool(t) {
  if (S.chain || S.floorStart) { S.chain = null; S.floorStart = null; }
  S.tool = t; ghost.visible = cursorRing.visible = false;
  vp.classList.toggle("placing", ["wall", "floor", "door", "window"].includes(t));
  updateGizmo(); renderToolbar(); updateHint();
}
function enterEdit() {
  const o = S.sel[S.sel.length - 1];
  if (!o || o.userData.kind !== "mesh") return toast("Pick one object (not a group) first, then press Tab to edit its shape.", true);
  if (o.userData.param) {
    o.userData.param = null; o.name = o.name.replace(/^(Wall|Stairs|Floor)/, "$1 mesh");
    toast("This " + (o.name.split(" ")[0]).toLowerCase() + " is now a normal mesh, so you can edit its shape (its wall/stairs settings are gone).");
  }
  S.mode = "edit"; S.eo = o; S.sel = [o]; S.esel = new Set(); editLook(o, true);
  if (!GIZMO_TOOLS[S.tool] && S.tool !== "select") S.tool = "select";
  refreshAll();
}
function exitEdit() {
  if (S.eo) editLook(S.eo, false);
  S.mode = "object"; S.eo = null; S.esel = new Set(); refreshAll();
}
function setEMode(e) {
  if (S.mode !== "edit") return;
  S.esel = P.convertSel(S.eo.userData.poly, S.emode, e, S.esel); S.emode = e; refreshAll();
}

// ---------------------------------------------------------------- adding things
function placePoint() { // a spot on the floor in front of the camera
  const { w, h } = vpSize(); let p = groundAt(w / 2, h / 2);
  if (!p || p.distanceTo(camera.position) > 30) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
    p = camera.position.clone().addScaledVector(f, 8); p.y = S.level;
  }
  const at = new THREE.Vector3(sn(p.x, Math.max(S.grid, 0.5)), S.level, sn(p.z, Math.max(S.grid, 0.5)));
  // don't drop it inside something that is already there: slide sideways until the spot is free
  const r = new THREE.Vector3(Math.cos(S.yaw), 0, -Math.sin(S.yaw)), ax = Math.abs(r.x) > Math.abs(r.z) ? new THREE.Vector3(Math.sign(r.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(r.z));
  const boxes = visibleMeshes().map((o) => new THREE.Box3().setFromObject(o));
  for (let i = 0; i < 30; i++) {
    const probe = new THREE.Box3(new THREE.Vector3(at.x - 0.45, at.y + 0.05, at.z - 0.45), new THREE.Vector3(at.x + 0.45, at.y + 0.95, at.z + 0.45));
    if (!boxes.some((b) => b.intersectsBox(probe))) break;
    at.addScaledVector(ax, 1.5);
  }
  return at;
}
function sitOnFloor(o, at) { const box = new THREE.Box3().setFromBufferAttribute(o.geometry.getAttribute("position")); o.position.set(at.x, at.y - box.min.y, at.z); }
const PRIMS = {
  cube: { name: "Cube", make: () => P.box() },
  sphere: { name: "Sphere", smooth: true, defs: [["segments", "Segments", 3, 64, 1, 16], ["rings", "Rings", 2, 48, 1, 10]], make: (p) => P.sphere(0.5, p.segments, p.rings) },
  cylinder: { name: "Cylinder", smooth: true, defs: [["sides", "Sides", 3, 64, 1, 16], ["height", "Height", 0.1, 10, 0.1, 1]], make: (p) => P.cylinder(0.5, p.height, p.sides) },
  plane: { name: "Plane", defs: [["size", "Size", 0.5, 50, 0.5, 2]], make: (p) => P.plane(p.size) },
  cone: { name: "Cone", smooth: true, defs: [["sides", "Sides", 3, 64, 1, 16], ["height", "Height", 0.1, 10, 0.1, 1]], make: (p) => P.cone(0.5, p.height, p.sides) },
  torus: { name: "Torus", smooth: true, defs: [["segments", "Segments", 3, 64, 1, 24], ["sides", "Sides", 3, 32, 1, 12], ["thick", "Thickness", 0.02, 0.45, 0.01, 0.18]], make: (p) => P.torus(0.5, p.thick, p.segments, p.sides) },
  ramp: { name: "Ramp", defs: [["w", "Width", 0.5, 20, 0.5, 2], ["h", "Height", 0.1, 10, 0.1, 1], ["d", "Length", 0.5, 30, 0.5, 3]], make: (p) => P.ramp(p.w, p.h, p.d) },
};
function addPrim(kind) {
  if (S.mode === "edit") exitEdit();
  const def = PRIMS[kind], at = placePoint();
  const params = Object.fromEntries((def.defs || []).map((d) => [d[0], d[5]]));
  runOp("Add " + def.name, def.defs || [], params, (p) => {
    const o = makeMesh(def.make(p), { name: uniqueName(def.name), smooth: def.smooth });
    sitOnFloor(o, at); world.add(o); S.sel = [o];
    if (!GIZMO_TOOLS[S.tool]) S.tool = "move";
  });
}
function addStairs() {
  if (S.mode === "edit") exitEdit();
  const at = placePoint();
  runOp("Add Stairs", [["steps", "Steps", 2, 40, 1, 10], ["width", "Width", 0.5, 10, 0.1, 1.5], ["height", "Height", 0.5, 12, 0.1, 3], ["depth", "Length", 0.5, 20, 0.1, 4]],
    { steps: 10, width: 1.5, height: 3, depth: 4 }, (p) => {
      const param = { kind: "stairs", ...p };
      const o = makeMesh(P.buildParam(param), { name: uniqueName("Stairs"), param, mat: { c: "#b9b2a6" } });
      o.position.copy(at); world.add(o); S.sel = [o]; if (!GIZMO_TOOLS[S.tool]) S.tool = "move";
    });
}
function makeWall(a, b) {
  const d = b.clone().sub(a), L = Math.hypot(d.x, d.z);
  const param = { kind: "wall", length: +L.toFixed(3), height: S.wall.h, thickness: S.wall.t, openings: [] };
  const o = makeMesh(P.buildParam(param), { name: uniqueName("Wall"), param, mat: { c: "#d9d4cc", r: 0.85 } });
  o.position.copy(a); o.rotation.y = Math.atan2(-d.z, d.x); world.add(o); return o;
}
function makeFloor(a, b) {
  const w = Math.abs(b.x - a.x), d = Math.abs(b.z - a.z);
  const param = { kind: "floor", w: +w.toFixed(3), d: +d.toFixed(3), t: 0.2 };
  const o = makeMesh(P.buildParam(param), { name: uniqueName("Floor"), param, mat: { c: "#9a8f80", r: 0.9 } });
  o.position.set((a.x + b.x) / 2, S.level, (a.z + b.z) / 2); world.add(o); return o;
}
const OPEN = { door: { w: 1, h: 2.1, sill: 0 }, window: { w: 1.2, h: 1.2, sill: 0.9 } };
function openingFor(wall, x, type) {
  const p = wall.userData.param, d = OPEN[type];
  if (p.length < d.w + 0.1) return { err: "That wall is too short for a " + type + " (it needs " + (d.w + 0.1).toFixed(1) + " m)." };
  const at = Math.max(d.w / 2 + 0.05, Math.min(p.length - d.w / 2 - 0.05, sn(x, Math.min(S.grid, 0.25))));
  if ((p.openings || []).some((o) => Math.abs(o.at - at) < (o.w + d.w) / 2)) return { err: "There's already a door or window there." };
  return { o: { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, at, w: d.w, h: Math.min(d.h, p.height - 0.1), sill: d.sill } };
}
function addOpening(wall, op) {
  wall.userData.param.openings.push(op); wall.userData.poly = P.buildParam(wall.userData.param); rebuild(wall);
  const glass = op.type === "window";
  const pw = op.w - 0.04, ph = op.h - (glass ? 0.04 : 0.02), pt = glass ? 0.03 : 0.05;
  const panel = makeMesh(P.box(pw, ph, pt, -pw / 2, 0, -pt / 2), { name: glass ? "Window glass" : "Door", openingOf: op.id,
    mat: glass ? { c: "#9fd8ff", r: 0.05, m: 0.1, o: 0.35 } : { c: "#8b5a2b", r: 0.6 } });
  panel.castShadow = !glass; wall.add(panel); syncPanels(wall);
}
function syncPanels(wall) {
  const p = wall.userData.param; if (!p || p.kind !== "wall") return;
  for (const c of [...kids(wall)]) {
    if (!c.userData.openingOf) continue;
    const op = p.openings.find((o) => o.id === c.userData.openingOf);
    if (!op) { c.removeFromParent(); disposeTree(c); continue; }
    const glass = op.type === "window", pw = op.w - 0.04, ph = op.h - (glass ? 0.04 : 0.02), pt = glass ? 0.03 : 0.05;
    c.userData.poly = P.box(pw, ph, pt, -pw / 2, 0, -pt / 2); rebuild(c);
    c.position.set(op.at, op.sill + (glass ? 0.02 : 0.01), 0); c.quaternion.identity(); c.scale.set(1, 1, 1);
  }
}

// ---------------------------------------------------------------- operations with an "adjust last action" panel
function runOp(label, defs, params, fn) {
  const before = snapshot();
  fn(params);
  refreshAll(); commit(label);
  S.lastOp = defs.length ? { label, defs, params: { ...params }, fn, before } : null; showLastOp();
}
function rerunLastOp() {
  const L = S.lastOp; if (!L) return;
  const tool = S.tool;
  restore(L.before); S.tool = tool; L.fn(L.params); refreshAll();
  hist.list[hist.i] = { label: L.label, sn: snapshot() }; scheduleAutosave();
}
function showLastOp() {
  const el = $("lastop"), L = S.lastOp;
  if (!L) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.innerHTML = "<h3>" + esc(L.label) + ' <span class="h-tools"><button id="lo-x" data-tip="Close this box (the change stays)">✕</button></span></h3>' +
    L.defs.map(([k, name, min, max, step]) => '<div class="prow"><span>' + name + '</span><div style="display:grid;grid-template-columns:1fr 58px;gap:6px"><input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + L.params[k] + '"><input type="number" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + L.params[k] + '"></div></div>').join("") +
    '<div class="note">Change these to adjust what you just did.</div>';
  el.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
    const v = +inp.value; if (!isFinite(v)) return; L.params[inp.dataset.k] = v;
    el.querySelectorAll('input[data-k="' + inp.dataset.k + '"]').forEach((o) => { if (o !== inp) o.value = v; });
    rerunLastOp();
  }));
  $("lo-x").onclick = () => { S.lastOp = null; showLastOp(); };
}
function editOp(label, fn, defs = [], params = {}) {
  if (S.mode !== "edit") return toast("That works in Edit mode: pick an object and press Tab.", true);
  const test = P.clone(S.eo.userData.poly), r = fn(test, S.emode, new Set(S.esel), params);
  if (!r || !("sel" in r) && !r.changed) return toast(r ? r.msg : "Nothing happened.", true);
  runOp(label, defs, params, (p) => {
    const res = fn(S.eo.userData.poly, S.emode, S.esel, p);
    if (res.mode) S.emode = res.mode; if (res.sel) S.esel = res.sel; rebuild(S.eo); toast(res.msg);
  });
}
const EDIT_OPS = {
  extrude: () => { editOp("Extrude", P.extrude, [["amount", "Distance", -5, 5, 0.05, 0.5]], { amount: 0.5 }); if (S.mode === "edit") setTool("move"); },
  inset: () => editOp("Inset", P.inset, [["amount", "Amount", 0.02, 0.9, 0.01, 0.25]], { amount: 0.25 }),
  loopcut: () => editOp("Loop Cut", P.loopCut, [["cuts", "Cuts", 1, 12, 1, 1]], { cuts: 1 }),
  subdivide: () => editOp("Subdivide", P.subdivide),
  bevel: () => editOp("Bevel", P.bevel, [["amount", "Width", 0.01, 2, 0.01, 0.1]], { amount: 0.1 }),
  merge: () => editOp("Merge", P.mergeVerts),
  flip: () => editOp("Flip", (m, mo, s) => ({ ...P.flip(m, mo, s), sel: s })),
  dupfaces: () => { editOp("Duplicate faces", P.dupFaces); if (S.mode === "edit") setTool("move"); },
  delete: () => editOp("Delete", P.deleteSel),
};

// ---------------------------------------------------------------- object commands
function cmdDelete() {
  if (S.mode === "edit") return EDIT_OPS.delete();
  const roots = selRoots(); if (!roots.length) return toast("Nothing selected.", true);
  for (const o of roots) { o.removeFromParent(); disposeTree(o); }
  S.sel = []; refreshAll(); commit("Delete"); toast("Deleted " + roots.length + " object" + (roots.length > 1 ? "s" : "") + ".");
}
function cmdDuplicate() {
  if (S.mode === "edit") return EDIT_OPS.dupfaces();
  const roots = selRoots(); if (!roots.length) return toast("Pick something to duplicate.", true);
  const copies = roots.map((o) => { const c = deserObj(serObj(o), true); renameTree(c); c.position.x += Math.max(S.grid, 1); o.parent.add(c); return c; });
  S.sel = copies; if (!GIZMO_TOOLS[S.tool]) S.tool = "move";
  refreshAll(); commit("Duplicate"); toast("Copy made (moved 1 step along X). Drag the arrows to place it.");
}
function renameTree(o) { o.traverse((c) => { if (isObj(c) && !c.userData.openingOf) c.name = uniqueName(c.name.replace(/ \d+$/, "")); }); }
function cmdArray() {
  if (S.mode === "edit") exitEdit();
  const roots = selRoots(); if (!roots.length) return toast("Pick the object(s) to copy in a row first.", true);
  const box = new THREE.Box3(); roots.forEach((o) => box.expandByObject(o)); const size = box.getSize(new THREE.Vector3());
  const ids = roots.map((o) => o.userData.fid);
  runOp("Array", [["count", "Copies", 1, 50, 1, 3], ["x", "Step X", -20, 20, 0.1, +Math.max(0.5, size.x).toFixed(2)], ["y", "Step Y", -20, 20, 0.1, 0], ["z", "Step Z", -20, 20, 0.1, 0]],
    { count: 3, x: +Math.max(0.5, size.x).toFixed(2), y: 0, z: 0 }, (p) => {
      const src = ids.map(byId).filter(Boolean), made = [];
      for (let i = 1; i <= p.count; i++) for (const o of src) {
        const c = deserObj(serObj(o), true); renameTree(c); c.position.x += p.x * i; c.position.y += p.y * i; c.position.z += p.z * i; o.parent.add(c); made.push(c);
      }
      S.sel = [...src, ...made];
    });
}
const MIR = { x: new THREE.Matrix4().makeScale(-1, 1, 1), y: new THREE.Matrix4().makeScale(1, -1, 1), z: new THREE.Matrix4().makeScale(1, 1, -1) };
function mirrorKids(o, axis) { // flip everything below o in o's own space
  if (o.userData.poly) { P.mirrorMesh(o.userData.poly, axis); if (o.userData.param) o.userData.param = null; rebuild(o); }
  for (const c of kids(o)) { tmpM.compose(c.position, c.quaternion, c.scale); tmpM.premultiply(MIR[axis]).multiply(MIR[axis]); tmpM.decompose(c.position, c.quaternion, c.scale); mirrorKids(c, axis); }
}
function cmdMirror(axis, copy) {
  if (S.mode === "edit") { // mirror the picked part of the mesh in place
    const m = S.eo.userData.poly, vs = [...P.selVerts(m, S.emode, S.esel)];
    if (!vs.length) return toast("Pick vertices, edges or faces to mirror.", true);
    const a = "xyz".indexOf(axis), c = vs.reduce((s, i) => s + m.v[i][a], 0) / vs.length;
    return runOp("Mirror " + axis.toUpperCase(), [], {}, () => {
      vs.forEach((i) => { S.eo.userData.poly.v[i][a] = 2 * c - S.eo.userData.poly.v[i][a]; });
      const sel = S.emode === "f" ? S.esel : null; S.eo.userData.poly.f.forEach((f, fi) => { if (sel ? sel.has(fi) : f.every((i) => vs.includes(i))) f.reverse(); });
      rebuild(S.eo);
    });
  }
  const roots = selRoots(); if (!roots.length) return toast("Pick something to mirror.", true);
  runOp((copy ? "Mirror copy " : "Flip ") + axis.toUpperCase(), [], {}, () => {
    const out = [];
    for (const o of roots) {
      let t = o;
      if (copy) {
        t = deserObj(serObj(o), true); renameTree(t); o.parent.add(t);
        o.updateWorldMatrix(true, false); o.parent.updateWorldMatrix(true, false);
        tmpM.copy(MIR[axis]).multiply(o.matrixWorld).multiply(MIR[axis]); // across the world center line, kept un-flipped
        tmpM.premultiply(tmpM2.copy(o.parent.matrixWorld).invert()); tmpM.decompose(t.position, t.quaternion, t.scale);
      }
      mirrorKids(t, axis); out.push(t);
    }
    S.sel = copy ? out : roots;
  });
  toast(copy ? "Mirrored copy made on the other side of the " + axis.toUpperCase() + " center line." : "Flipped along " + axis.toUpperCase() + ".");
}
function cmdGroup() {
  if (S.mode === "edit") exitEdit();
  const roots = selRoots(); if (!roots.length) return toast("Pick 1 or more objects to group (Shift+click to pick more).", true);
  const parent = roots[0].parent, g = makeGroup(uniqueName("Group")), c = new THREE.Vector3(), w = new THREE.Vector3();
  roots.forEach((o) => { o.getWorldPosition(w); c.add(w); }); c.divideScalar(roots.length);
  parent.add(g); parent.updateWorldMatrix(true, false); g.position.copy(parent.worldToLocal(c)); g.updateWorldMatrix(true, false);
  roots.forEach((o) => g.attach(o));
  S.sel = [g]; refreshAll(); commit("Group"); toast("Grouped " + roots.length + ". Click any part to pick the whole group; use the Outliner to pick one piece.");
}
function cmdUngroup() {
  const gs = S.sel.filter((o) => o.userData.kind === "group"); if (!gs.length) return toast("Pick a group to ungroup.", true);
  const freed = [];
  for (const g of gs) { const p = g.parent; for (const c of kids(g)) { p.attach(c); freed.push(c); } g.removeFromParent(); }
  S.sel = freed; refreshAll(); commit("Ungroup");
}
function cmdJoin() {
  if (S.mode === "edit") exitEdit();
  const meshes = S.sel.filter((o) => o.userData.kind === "mesh"); const A = meshes[meshes.length - 1];
  if (meshes.length < 2) return toast("Pick 2 or more objects (Shift+click). The last one you pick keeps its color.", true);
  runOp("Join", [], {}, () => {
    A.updateWorldMatrix(true, false); const inv = A.matrixWorld.clone().invert(), m = A.userData.poly;
    for (const B of meshes) {
      if (B === A) continue; B.updateWorldMatrix(true, false);
      const M = inv.clone().multiply(B.matrixWorld), flip = M.determinant() < 0, o = m.v.length, v = new THREE.Vector3();
      for (const p of B.userData.poly.v) { v.set(...p).applyMatrix4(M); m.v.push([v.x, v.y, v.z]); }
      for (const f of B.userData.poly.f) { const nf = f.map((i) => i + o); m.f.push(flip ? nf.reverse() : nf); }
      for (const c of kids(B)) A.parent.attach(c);
      B.removeFromParent(); disposeTree(B);
    }
    A.userData.param = null; rebuild(A); S.sel = [A];
  });
  toast("Joined into " + A.name + ".");
}
function cmdSeparate() {
  if (S.mode !== "edit") return toast("Separate works in Edit mode: pick faces, then press P.", true);
  const test = P.clone(S.eo.userData.poly);
  if (!P.splitOff(test, S.emode, new Set(S.esel))) return toast("Pick some (not all) faces to split off into a new object.", true);
  runOp("Separate", [], {}, () => {
    const part = P.splitOff(S.eo.userData.poly, S.emode, S.esel); rebuild(S.eo);
    const n = makeMesh(part, { name: uniqueName(S.eo.name + " part"), smooth: S.eo.userData.smooth, mat: { c: "#" + S.eo.material.color.getHexString(), r: S.eo.material.roughness, m: S.eo.material.metalness, o: S.eo.material.opacity } });
    n.position.copy(S.eo.position); n.quaternion.copy(S.eo.quaternion); n.scale.copy(S.eo.scale); S.eo.parent.add(n);
    S.esel = new Set();
  });
  toast("Split the picked faces off into a new object.");
}
function cmdHide(show) {
  if (show) { allObjects().forEach((o) => { o.visible = true; }); } else { if (!S.sel.length) return; S.sel.forEach((o) => { o.visible = false; }); S.sel = []; }
  refreshAll(); commit(show ? "Show all" : "Hide");
}
function selectAll() {
  if (S.mode === "edit") { S.esel = P.selectAllOf(S.eo.userData.poly, S.emode); editSelChanged(); }
  else setSel(kids(world).filter((o) => o.visible));
}
function focusSel() {
  const box = new THREE.Box3();
  if (S.mode === "edit" && S.esel.size) editSelWorld().pts.forEach((p) => box.expandByPoint(p));
  else (S.sel.length ? S.sel : kids(world)).forEach((o) => box.expandByObject(o));
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), r = Math.max(1.2, box.getSize(new THREE.Vector3()).length() / 2);
  const f = new THREE.Vector3(-Math.sin(S.yaw) * Math.cos(S.pitch), Math.sin(S.pitch), -Math.cos(S.yaw) * Math.cos(S.pitch));
  camera.position.copy(c).addScaledVector(f, -r * 2.4);
}
function resetView() { camera.position.set(6, 5, 8); S.yaw = -0.65 + 0.0; S.pitch = -0.42; lookAt(new THREE.Vector3(0, 0.5, 0)); }
function lookAt(t) { const d = t.clone().sub(camera.position).normalize(); S.yaw = Math.atan2(-d.x, -d.z); S.pitch = Math.asin(Math.max(-1, Math.min(1, d.y))); }

// ---------------------------------------------------------------- files
const fileBase = () => ($("projname").value.trim() || "My Model").replace(/[^A-Za-z0-9 _\-]+/g, "").replace(/\s+/g, "_") || "Forge";
const round = (k, v) => (typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v);
function saveProject() { download(fileBase() + ".forge.json", JSON.stringify(serialize(), round), "application/json"); toast("Saved " + fileBase() + ".forge.json to your Downloads. Open it later with File → Open project."); }
function openProject(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result); if (d.app !== "forge3d") throw new Error("That isn't a Forge 3D project file.");
      if (S.mode === "edit") exitEdit(); loadData(d); S.sel = []; refreshAll(); commit("Open project"); S.lastOp = null; showLastOp(); focusSel(); toast("Opened " + file.name + ".");
    } catch (e) { toast("Couldn't open it: " + e.message, true); }
  };
  r.readAsText(file);
}
function newProject() {
  modal('<h2>Start a new project?</h2><p>This clears the scene. Save first (File → Save project) if you want to keep this one.</p><div class="row"><span></span><span><button id="m-no">Cancel</button> <button class="primary" id="m-yes">Clear it</button></span></div>');
  $("m-no").onclick = closeModal;
  $("m-yes").onclick = () => { closeModal(); if (S.mode === "edit") exitEdit(); loadData({ objects: [] }); $("projname").value = "My Model"; S.sel = []; refreshAll(); commit("New project"); };
}
function exportRoots(onlySel) { return onlySel ? selRoots() : kids(world).filter((o) => o.visible); }
function cleanCopy(o) { // a plain three.js copy for the glTF exporter (no editor data)
  let c;
  if (o.isMesh) {
    const m = o.material, mat = new THREE.MeshStandardMaterial({ name: o.name + " material", color: m.color.clone(), roughness: m.roughness, metalness: m.metalness, transparent: m.opacity < 1, opacity: m.opacity });
    c = new THREE.Mesh(o.geometry, mat);
  } else c = new THREE.Group();
  c.name = o.name; c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale); c.visible = o.visible;
  for (const k of kids(o)) if (k.visible) c.add(cleanCopy(k));
  return c;
}
async function doExport(kind, onlySel) {
  if (S.mode === "edit") exitEdit();
  const roots = exportRoots(onlySel);
  if (!roots.length) return toast(onlySel ? "Nothing is selected to export." : "The scene is empty.", true);
  const base = fileBase();
  try {
    if (kind === "glb" || kind === "gltf") {
      const out = await exportGLTF(roots.map(cleanCopy), kind === "glb");
      download(base + "." + kind, out, kind === "glb" ? "model/gltf-binary" : "model/gltf+json");
    } else if (kind === "obj") {
      const { obj, mtl } = exportOBJ(roots, base); download(base + ".obj", obj, "text/plain"); setTimeout(() => download(base + ".mtl", mtl, "text/plain"), 400);
    } else if (kind === "fbx") download(base + ".fbx", exportFBX(roots), "application/octet-stream");
    toast("Exported " + base + "." + kind + (kind === "obj" ? " + .mtl" : "") + " to your Downloads.");
  } catch (e) { console.error(e); toast("Export failed: " + e.message, true); }
}
window.__forge = { doExport, exportGLTF, cleanCopy, exportRoots, exportOBJ, exportFBX, serialize, S, world, camera, P, addPrim, enterEdit, exitEdit, setEMode, selectAll, EDIT_OPS, clickSelect, commit, undo, redo, hist };

// ---------------------------------------------------------------- input: camera flying + clicks
let press = null, look = null, pan = null;
const MOVE = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space", "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  closeMenu();
  const p = local(e);
  if (e.button === 2) { look = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); vp.classList.add("looking"); return; }
  if (e.button === 1) { e.preventDefault(); pan = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0) return;
  if (gizmoGrab || tc.dragging || (tc.object && tc.axis)) { gizmoGrab = false; return; }
  if (placeClick(p)) return;
  press = { x: p.x, y: p.y, add: e.shiftKey || e.ctrlKey || e.metaKey, box: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  const p = local(e);
  if (look) {
    const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 0) look.moved = true;
    S.yaw -= dx * 0.0042; S.pitch = Math.max(-1.55, Math.min(1.55, S.pitch - dy * 0.0042));
  }
  if (pan) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y; pan.x = e.clientX; pan.y = e.clientY;
    const k = 0.004 * Math.max(2, S.speed * 1.5); const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(r, -dx * k).addScaledVector(u, dy * k);
  }
  if (press) {
    if (!press.box && Math.hypot(p.x - press.x, p.y - press.y) > 5) press.box = true;
    if (press.box) { const b = $("boxsel"); Object.assign(b.style, { display: "block", left: Math.min(p.x, press.x) + "px", top: Math.min(p.y, press.y) + "px", width: Math.abs(p.x - press.x) + "px", height: Math.abs(p.y - press.y) + "px" }); }
  }
  placeHover(p);
});
canvas.addEventListener("pointerup", (e) => {
  const p = local(e);
  if (e.button === 2 && look) {
    vp.classList.remove("looking");
    if (!look.moved && (S.chain || S.floorStart)) { S.chain = null; S.floorStart = null; ghost.visible = false; updateHint(); toast("Stopped drawing."); }
    look = null; return;
  }
  if (e.button === 1) { pan = null; return; }
  if (e.button === 0 && press) {
    $("boxsel").style.display = "none";
    if (press.box) boxSelect({ x0: Math.min(p.x, press.x), x1: Math.max(p.x, press.x), y0: Math.min(p.y, press.y), y1: Math.max(p.y, press.y) }, press.add);
    else clickSelect(p.x, p.y, press.add);
    press = null;
  }
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (look) { S.speed = Math.max(1, Math.min(40, S.speed * (e.deltaY < 0 ? 1.15 : 0.87))); $("speed").value = Math.round(S.speed); toast("Fly speed " + Math.round(S.speed)); return; }
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  camera.position.addScaledVector(f, -Math.sign(e.deltaY) * Math.min(4, Math.abs(e.deltaY) * 0.01) * Math.max(1, S.speed * 0.25));
}, { passive: false });

const typing = (e) => { const t = e.target; return t && (t.tagName === "INPUT" && !["range", "checkbox", "color", "button"].includes(t.type) || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };
window.addEventListener("keydown", (e) => {
  if (typing(e)) { if (e.key === "Escape" || e.key === "Enter") e.target.blur(); return; }
  if (!$("modal").classList.contains("hidden")) { if (e.key === "Escape") closeModal(); return; }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !/^Control|^Meta/.test(e.code)) S.ctrlCombo = true;
  if (/^(Control|Shift)/.test(e.code)) { S.keys.add(e.code); return; }
  if (MOVE.has(e.code) && !mod && !e.altKey) { S.keys.add(e.code); if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault(); return; }
  const k = e.code, sh = e.shiftKey;
  const hk = (fn) => { e.preventDefault(); fn(); };
  if (mod) {
    if (k === "KeyZ") return hk(sh ? redo : undo);
    if (k === "KeyY") return hk(redo);
    if (k === "KeyS") return hk(saveProject);
    if (k === "KeyO") return hk(() => $("openfile").click());
    if (k === "KeyD") return hk(cmdDuplicate);
    if (k === "KeyA") return hk(selectAll);
    if (k === "KeyG") return hk(sh ? cmdUngroup : cmdGroup);
    if (k === "KeyJ") return hk(cmdJoin);
    if (k === "KeyE") return hk(EDIT_OPS.extrude);
    return;
  }
  if (e.altKey) { if (k === "KeyH") hk(() => cmdHide(true)); return; }
  switch (k) {
    case "Tab": return hk(() => (sh ? toggleSnap() : S.mode === "edit" ? exitEdit() : enterEdit()));
    case "Digit1": return setEMode("v"); case "Digit2": return setEMode("e"); case "Digit3": return setEMode("f");
    case "KeyV": return setTool("select"); case "KeyG": return setTool("move"); case "KeyR": return setTool("rotate"); case "KeyT": return setTool("scale");
    case "KeyX": case "Delete": case "Backspace": return hk(cmdDelete);
    case "KeyF": return focusSel(); case "KeyH": return cmdHide(false); case "Home": return resetView();
    case "KeyZ": return toggleXray();
    case "KeyI": return EDIT_OPS.inset(); case "KeyL": return EDIT_OPS.loopcut(); case "KeyU": return EDIT_OPS.subdivide();
    case "KeyB": return EDIT_OPS.bevel(); case "KeyM": return EDIT_OPS.merge(); case "KeyN": return EDIT_OPS.flip(); case "KeyP": return cmdSeparate();
    case "Enter": if (S.chain || S.floorStart) { S.chain = null; S.floorStart = null; ghost.visible = false; updateHint(); } return;
    case "Escape":
      if (S.chain || S.floorStart) { S.chain = null; S.floorStart = null; ghost.visible = false; updateHint(); return; }
      if (S.lastOp) { S.lastOp = null; showLastOp(); return; }
      if (["wall", "floor", "door", "window"].includes(S.tool)) return setTool("select");
      if (S.mode === "edit") { S.esel = new Set(); return editSelChanged(); }
      return setSel([]);
    case "F1": return hk(() => tutorial(0));
  }
  if (e.key === "?") tutorial(0);
});
window.addEventListener("keyup", (e) => { S.keys.delete(e.code); if (/^Control|^Meta/.test(e.code)) S.ctrlCombo = false; });
window.addEventListener("blur", () => { S.keys.clear(); look = pan = null; vp.classList.remove("looking"); });
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("button"); if (b) b.blur(); });

function fly(dt) {
  const k = S.keys; if (!k.size) return;
  const fast = k.has("ShiftLeft") || k.has("ShiftRight") ? 3 : 1, v = S.speed * fast * dt;
  const f = new THREE.Vector3(-Math.sin(S.yaw) * Math.cos(S.pitch), Math.sin(S.pitch), -Math.cos(S.yaw) * Math.cos(S.pitch));
  const r = new THREE.Vector3(Math.cos(S.yaw), 0, -Math.sin(S.yaw));
  const m = new THREE.Vector3();
  if (k.has("KeyW") || k.has("ArrowUp")) m.add(f); if (k.has("KeyS") || k.has("ArrowDown")) m.sub(f);
  if (k.has("KeyD") || k.has("ArrowRight")) m.add(r); if (k.has("KeyA") || k.has("ArrowLeft")) m.sub(r);
  if (k.has("KeyE") || k.has("Space")) m.y += 1;
  if (k.has("KeyQ") || ((k.has("ControlLeft") || k.has("ControlRight")) && !S.ctrlCombo)) m.y -= 1;
  if (m.lengthSq()) camera.position.addScaledVector(m.normalize(), v);
}

// ---------------------------------------------------------------- map tools (walls, floors, doors, windows)
function snapPt(p) { return new THREE.Vector3(sn(p.x), S.level, sn(p.z)); }
function placeClick(pt) {
  const t = S.tool;
  if (t === "wall" || t === "floor") {
    const g = groundAt(pt.x, pt.y); if (!g) return true; const p = snapPt(g);
    if (t === "wall") {
      if (!S.chain) { S.chain = p; toast("Now click where this wall ends. Keep clicking to add more walls. Right-click or Enter to stop."); }
      else if (p.distanceTo(S.chain) > 0.05) { const w = makeWall(S.chain, p); S.sel = [w]; refreshAll(); commit("Wall"); S.chain = p; }
    } else {
      if (!S.floorStart) { S.floorStart = p; toast("Now click the opposite corner of the floor."); }
      else if (Math.abs(p.x - S.floorStart.x) > 0.05 && Math.abs(p.z - S.floorStart.z) > 0.05) { const f = makeFloor(S.floorStart, p); S.floorStart = null; ghost.visible = false; S.sel = [f]; refreshAll(); commit("Floor"); }
    }
    updateHint(); return true;
  }
  if (t === "door" || t === "window") {
    const h = hitObjects(pt.x, pt.y).find((x) => x.object.userData.param?.kind === "wall");
    if (!h) { toast("Click on a wall (one made with the Wall tool) to put a " + t + " in it.", true); return true; }
    const wall = h.object, lp = wall.worldToLocal(h.point.clone()), r = openingFor(wall, lp.x, t);
    if (r.err) { toast(r.err, true); return true; }
    addOpening(wall, r.o); S.sel = [wall]; refreshAll(); commit("Add " + t); toast("Added a " + t + ". Change its size or spot in the Properties panel.");
    return true;
  }
  return false;
}
function placeHover(pt) {
  const t = S.tool; cursorRing.visible = false; if (!["wall", "floor", "door", "window"].includes(t)) return;
  if (t === "door" || t === "window") {
    const h = hitObjects(pt.x, pt.y).find((x) => x.object.userData.param?.kind === "wall");
    if (!h) { ghost.visible = false; return; }
    const wall = h.object, lp = wall.worldToLocal(h.point.clone()), r = openingFor(wall, lp.x, t);
    if (r.err) { ghost.visible = false; return; }
    const o = r.o, T = wall.userData.param.thickness + 0.04;
    setGhost(P.box(o.w, o.h, T, o.at - o.w / 2, o.sill, -T / 2), wall.matrixWorld); return;
  }
  const g = groundAt(pt.x, pt.y); if (!g) return; const p = snapPt(g);
  cursorRing.position.set(p.x, p.y + 0.01, p.z); cursorRing.visible = true;
  if (t === "wall" && S.chain) {
    const d = p.clone().sub(S.chain), L = Math.hypot(d.x, d.z);
    if (L < 0.01) { ghost.visible = false; return; }
    const m = new THREE.Matrix4().compose(S.chain, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-d.z, d.x)), new THREE.Vector3(1, 1, 1));
    setGhost(P.box(L, S.wall.h, S.wall.t, 0, 0, -S.wall.t / 2), m); $("st-hint").textContent = "Wall length: " + L.toFixed(2) + " m. Click to place it, right-click or Enter to stop.";
  } else if (t === "floor" && S.floorStart) {
    const a = S.floorStart, w = Math.abs(p.x - a.x), d = Math.abs(p.z - a.z);
    setGhost(P.box(Math.max(w, 0.01), 0.2, Math.max(d, 0.01), Math.min(a.x, p.x), S.level - 0.2, Math.min(a.z, p.z)), new THREE.Matrix4());
    $("st-hint").textContent = "Floor: " + w.toFixed(2) + " × " + d.toFixed(2) + " m. Click to place it.";
  } else ghost.visible = false;
}
function setGhost(poly, matrix) {
  ghost.geometry.dispose(); ghost.geometry = P.toGeometry(poly).geometry;
  ghost.matrixAutoUpdate = false; ghost.matrix.copy(matrix); ghost.visible = true;
}

// ---------------------------------------------------------------- UI helpers
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
let toastT = 0;
function toast(msg, warn) { const t = $("toast"); t.textContent = msg; t.className = "show" + (warn ? " warn" : ""); clearTimeout(toastT); toastT = setTimeout(() => { t.className = ""; }, warn ? 4200 : 3000); }
function modal(html) { $("modalcard").innerHTML = html; $("modal").classList.remove("hidden"); }
function closeModal() { $("modal").classList.add("hidden"); }
$("modal").addEventListener("pointerdown", (e) => { if (e.target.id === "modal") closeModal(); });

// tooltips: any element with data-tip
let tipT = 0, tipEl = null;
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest && e.target.closest("[data-tip]");
  if (el === tipEl) return; tipEl = el; clearTimeout(tipT); $("tip").classList.remove("show");
  if (!el) return;
  tipT = setTimeout(() => {
    const t = $("tip"); t.innerHTML = el.dataset.tip; t.classList.add("show");
    const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.right + 8, y = r.top + r.height / 2 - th / 2;
    if (x + tw > innerWidth - 4) { x = Math.min(innerWidth - tw - 4, Math.max(4, r.left + r.width / 2 - tw / 2)); y = r.bottom + 8; }
    if (y + th > innerHeight - 4) y = r.top - th - 8;
    t.style.left = x + "px"; t.style.top = Math.max(4, y) + "px";
  }, 350);
});
document.addEventListener("pointerdown", () => { clearTimeout(tipT); $("tip").classList.remove("show"); });
const kbd = (s) => (s ? " <kbd>" + s + "</kbd>" : "");
const tipOf = (name, key, text) => "<b>" + name + "</b>" + kbd(key) + (text ? "<br>" + text : "");

// ---------------------------------------------------------------- toolbar
function tbtn(id, ic, label, key, text, on, fn, disabled) {
  return { id, html: '<button class="tbtn' + (on ? " on" : "") + '" data-id="' + id + '"' + (disabled ? " disabled" : "") + ' data-tip="' + esc(tipOf(label, key, text)) + '">' + icon(ic) + "<span>" + label + "</span></button>", fn };
}
function renderToolbar() {
  const T = S.tool, ed = S.mode === "edit", items = [];
  const sec = (title, list) => items.push({ title, list });
  sec("Tools", [
    tbtn("select", "select", "Select", "V", "Click to pick. Shift+click to pick more. Drag on empty space for a box.", T === "select", () => setTool("select")),
    tbtn("move", "move", "Move", "G", "Drag the colored arrows to move. Snap is on when the magnet is lit.", T === "move", () => setTool("move")),
    tbtn("rotate", "rotate", "Rotate", "R", "Drag the rings to turn it (15° steps with snap).", T === "rotate", () => setTool("rotate")),
    tbtn("scale", "scale", "Scale", "T", "Drag the handles to make it bigger or smaller. The middle handle scales evenly.", T === "scale", () => setTool("scale")),
  ]);
  if (!ed) {
    sec("Add", Object.entries(PRIMS).map(([k, d]) => tbtn("add-" + k, k, d.name, "", "Add a " + d.name.toLowerCase() + " in front of you, sitting on the floor.", false, () => addPrim(k))));
    sec("Map", [
      tbtn("floor", "floor", "Floor", "", "Click one corner, then the opposite corner.", T === "floor", () => setTool("floor")),
      tbtn("wall", "wall", "Wall", "", "Click to start, click again for each corner. Right-click or Enter to stop. Height " + S.wall.h + " m.", T === "wall", () => setTool("wall")),
      tbtn("door", "door", "Door", "", "Click on a wall to cut a door in it.", T === "door", () => setTool("door")),
      tbtn("window", "window", "Window", "", "Click on a wall to put a window in it.", T === "window", () => setTool("window")),
      tbtn("stairs", "stairs", "Stairs", "", "Add stairs. Change steps, width and height after.", false, addStairs),
      tbtn("array", "array", "Array", "", "Make a row of copies of what you picked (fences, pillars, seats...).", false, cmdArray),
    ]);
    sec("Object", [
      tbtn("dup", "duplicate", "Copy", CTRL + "+D", "Duplicate what you picked.", false, cmdDuplicate),
      tbtn("del", "trash", "Delete", "X", "Delete what you picked.", false, cmdDelete),
      tbtn("mirror", "mirror", "Mirror", "", "Flip it, or make a mirrored copy on the other side.", false, (ev) => openMenu("mirror", ev)),
      tbtn("join", "join", "Join", CTRL + "+J", "Combine 2+ picked objects into one.", false, cmdJoin),
      tbtn("group", "group", "Group", CTRL + "+G", "Put picked objects in a group so they move together.", false, cmdGroup),
      tbtn("edit", "mesh", "Edit", "Tab", "Edit the shape: vertices, edges and faces.", false, enterEdit),
    ]);
  } else {
    sec("Edit", [
      tbtn("extrude", "extrude", "Extrude", CTRL + "+E", "Pull the picked faces out to make new shape.", false, EDIT_OPS.extrude),
      tbtn("inset", "inset", "Inset", "I", "Make a smaller face inside each picked face.", false, EDIT_OPS.inset),
      tbtn("loopcut", "loopcut", "Loop Cut", "L", "Pick an edge, then cut a new ring of edges across it.", false, EDIT_OPS.loopcut),
      tbtn("subdiv", "subdivide", "Subdivide", "U", "Split faces into smaller ones (all faces if none picked).", false, EDIT_OPS.subdivide),
      tbtn("bevel", "bevel", "Bevel", "B", "Round off the picked edges with a slanted face.", false, EDIT_OPS.bevel),
      tbtn("merge", "merge", "Merge", "M", "Squash the picked vertices into one point.", false, EDIT_OPS.merge),
      tbtn("flip", "flip", "Flip", "N", "Turn faces inside out (if a face looks invisible).", false, EDIT_OPS.flip),
      tbtn("dupf", "duplicate", "Copy", CTRL + "+D", "Duplicate the picked faces.", false, EDIT_OPS.dupfaces),
      tbtn("sep", "separate", "Separate", "P", "Split the picked faces off into their own object.", false, cmdSeparate),
      tbtn("mirror", "mirror", "Mirror", "", "Mirror the picked part.", false, (ev) => openMenu("mirror", ev)),
      tbtn("del", "trash", "Delete", "X", "Delete the picked vertices, edges or faces.", false, cmdDelete),
      tbtn("done", "select", "Done", "Tab", "Go back to Object mode.", false, exitEdit),
    ]);
  }
  const fns = {};
  $("toolbar").innerHTML = items.map((s) => "<h4>" + s.title + "</h4>" + s.list.map((b) => { fns[b.id] = b.fn; return b.html; }).join("")).join("");
  $("toolbar").querySelectorAll(".tbtn").forEach((b) => { b.onclick = (ev) => fns[b.dataset.id](ev); });
}
function renderTop() {
  const ed = S.mode === "edit";
  $("modeseg").innerHTML = '<button class="' + (!ed ? "on" : "") + '" data-tip="' + esc(tipOf("Object mode", "Tab", "Pick, move and build whole objects.")) + '" id="m-obj">' + icon("cube") + "Object</button>" +
    '<button class="' + (ed ? "on" : "") + '" data-tip="' + esc(tipOf("Edit mode", "Tab", "Change the shape of one object: vertices, edges and faces.")) + '" id="m-edit">' + icon("vert") + "Edit</button>";
  $("m-obj").onclick = () => ed && exitEdit(); $("m-edit").onclick = () => !ed && enterEdit();
  $("emodeseg").style.display = ed ? "" : "none";
  $("emodeseg").innerHTML = [["v", "vert", "Vertex", "1", "Pick corner points."], ["e", "edge", "Edge", "2", "Pick lines between points."], ["f", "face", "Face", "3", "Pick flat sides."]]
    .map(([m, ic, n, k, t]) => '<button data-m="' + m + '" class="' + (S.emode === m ? "on" : "") + '" data-tip="' + esc(tipOf(n + " select", k, t)) + '">' + icon(ic) + n + "</button>").join("");
  $("emodeseg").querySelectorAll("button").forEach((b) => { b.onclick = () => setEMode(b.dataset.m); });
  $("snapseg").innerHTML = '<button class="toggle' + (S.snap ? " on" : "") + '" id="b-snap" data-tip="' + esc(tipOf("Snap", "Shift+Tab", "Moves jump in grid steps, turns in 15° steps.")) + '">' + icon("snap") + "Snap</button>" +
    '<select id="b-grid" data-tip="Grid step size (meters)">' + [0.1, 0.25, 0.5, 1, 2].map((g) => "<option" + (g === S.grid ? " selected" : "") + ">" + g + "</option>").join("") + "</select>" +
    '<button class="toggle' + (S.space === "local" ? " on" : "") + '" id="b-space" data-tip="' + esc(tipOf("Local axes", "", "Move/turn along the object's own directions instead of the world's.")) + '">' + icon(S.space === "local" ? "local" : "globe") + (S.space === "local" ? "Local" : "World") + "</button>" +
    '<button class="toggle' + (S.xray ? " on" : "") + '" id="b-xray" data-tip="' + esc(tipOf("X-ray", "Z", "See through the shape so you can pick points on the back.")) + '">' + icon("xray") + "X-ray</button>";
  $("b-snap").onclick = toggleSnap; $("b-xray").onclick = toggleXray;
  $("b-space").onclick = () => { S.space = S.space === "world" ? "local" : "world"; updateGizmo(); renderTop(); };
  $("b-grid").onchange = (e) => { S.grid = +e.target.value; applySnap(); e.target.blur(); };
  updateHistButtons();
}
function updateHistButtons() {
  $("histseg").innerHTML = '<button id="b-undo" data-tip="' + esc(tipOf("Undo", CTRL + "+Z")) + '"' + (hist.i <= 0 ? ' style="opacity:.4"' : "") + ">" + icon("undo") + "</button>" +
    '<button id="b-redo" data-tip="' + esc(tipOf("Redo", CTRL + "+Y")) + '"' + (hist.i >= hist.list.length - 1 ? ' style="opacity:.4"' : "") + ">" + icon("redo") + "</button>" +
    '<button id="b-help" data-tip="' + esc(tipOf("Help", "F1", "Show the quick tour again.")) + '">' + icon("help") + "</button>" +
    '<button id="b-fs" data-tip="' + esc(tipOf("Full screen", "", "Fill the whole screen. Press Esc twice to leave.")) + '">' + icon("fullscreen") + "</button>";
  $("b-undo").onclick = undo; $("b-redo").onclick = redo; $("b-help").onclick = () => tutorial(0); $("b-fs").onclick = fullscreen;
}
function toggleSnap() { S.snap = !S.snap; applySnap(); renderTop(); toast("Snap " + (S.snap ? "on" : "off")); }
function toggleXray() { S.xray = !S.xray; if (S.eo) { editLook(S.eo, false); editLook(S.eo, true); } refreshEditOverlay(); renderTop(); toast("X-ray " + (S.xray ? "on: you can pick through the shape" : "off")); }
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else { await document.documentElement.requestFullscreen(); if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Escape"]).catch(() => {}); }
  } catch (e) { toast("Full screen isn't allowed here.", true); }
}
function updateHint() {
  const H = {
    select: "Click to pick. Shift+click to pick more. Drag a box on empty space. Fly: WASD + right-drag to look, Q/E down/up.",
    move: "Drag an arrow to move along it, or a square to move flat. Hold nothing else: WASD still flies.",
    rotate: "Drag a ring to turn. Snap = 15° steps.", scale: "Drag a handle to resize. The center box scales evenly.",
    wall: S.chain ? "Click where the wall ends. Right-click or Enter to stop." : "Click on the grid where the wall starts.",
    floor: S.floorStart ? "Click the opposite corner." : "Click the first corner of the floor.",
    door: "Click on a wall to cut a door.", window: "Click on a wall to add a window.",
  };
  $("st-mode").textContent = S.mode === "edit" ? "EDIT MODE · " + { v: "Vertex", e: "Edge", f: "Face" }[S.emode] : "OBJECT MODE";
  $("st-hint").textContent = S.mode === "edit" && S.tool === "select" ? "Click to pick " + { v: "vertices", e: "edges", f: "faces" }[S.emode] + " (Shift+click for more, drag for a box). G moves them. Tab when done." : H[S.tool] || "";
  $("hint").textContent = "WASD fly · Right-drag look · Q/E down/up · Shift fast · F focus";
}

// ---------------------------------------------------------------- menus
const MENUS = {
  File: () => [["New project", "", newProject], ["Open project…", CTRL + "+O", () => $("openfile").click()], ["Save project", CTRL + "+S", saveProject], "-",
    ["Export for Unity…", "", exportDialog], ["Export GLB", "", () => doExport("glb")], ["Export OBJ + MTL", "", () => doExport("obj")], ["Export FBX", "", () => doExport("fbx")]],
  Edit: () => [["Undo", CTRL + "+Z", undo], ["Redo", CTRL + "+Y", redo], "-", ["Select all", CTRL + "+A", selectAll], ["Duplicate", CTRL + "+D", cmdDuplicate], ["Delete", "X", cmdDelete], "-",
    ["Group", CTRL + "+G", cmdGroup], ["Ungroup", CTRL + "+Shift+G", cmdUngroup], ["Join", CTRL + "+J", cmdJoin], ["Separate", "P", cmdSeparate], "-", ["Hide", "H", () => cmdHide(false)], ["Show all", "Alt+H", () => cmdHide(true)]],
  Add: () => Object.entries(PRIMS).map(([k, d]) => [d.name, "", () => addPrim(k)]),
  Map: () => [["Floor", "", () => setTool("floor")], ["Wall", "", () => setTool("wall")], ["Door", "", () => setTool("door")], ["Window", "", () => setTool("window")], ["Stairs", "", addStairs], ["Ramp", "", () => addPrim("ramp")], ["Array (row of copies)", "", cmdArray], "-",
    ["Building level: " + S.level + " m", "", () => levelDialog()], ["Wall height: " + S.wall.h + " m", "", () => levelDialog()]],
  View: () => [["Focus on selection", "F", focusSel], ["Reset view", "Home", resetView], [(S.xray ? "✓ " : "") + "X-ray", "Z", toggleXray], [(S.hideGrid ? "" : "✓ ") + "Grid", "", () => { S.hideGrid = !S.hideGrid; grid.visible = !S.hideGrid; }], ["Full screen", "", fullscreen]],
  Help: () => [["Quick tour", "F1", () => tutorial(0)], ["Keyboard shortcuts", "", shortcuts], ["Using your model in Unity", "", unityHelp]],
  mirror: () => (S.mode === "edit" ? [["Mirror X", "", () => cmdMirror("x")], ["Mirror Y", "", () => cmdMirror("y")], ["Mirror Z", "", () => cmdMirror("z")]] :
    [["Flip along X", "", () => cmdMirror("x")], ["Flip along Y", "", () => cmdMirror("y")], ["Flip along Z", "", () => cmdMirror("z")], "-",
      ["Mirror copy across X", "", () => cmdMirror("x", true)], ["Mirror copy across Z", "", () => cmdMirror("z", true)], ["Mirror copy across Y", "", () => cmdMirror("y", true)]]),
};
let menuOpen = null;
function openMenu(name, ev) {
  const pop = $("menupop"), src = ev.currentTarget || ev.target;
  if (menuOpen === name) return closeMenu();
  closeMenu(); menuOpen = name; src.classList && src.classList.add("open");
  const items = MENUS[name](), fns = [];
  pop.innerHTML = items.map((it) => (it === "-" ? "<hr>" : (fns.push(it[2]), '<button data-i="' + (fns.length - 1) + '"><span>' + esc(it[0]) + "</span><kbd>" + esc(it[1]) + "</kbd></button>"))).join("");
  pop.classList.remove("hidden");
  const r = src.getBoundingClientRect(); pop.style.left = (r.left < 100 ? r.right + 4 : r.left) + "px"; pop.style.top = (r.left < 100 ? r.top : r.bottom + 4) + "px";
  if (r.top + pop.offsetHeight > innerHeight) pop.style.top = Math.max(4, innerHeight - pop.offsetHeight - 6) + "px";
  pop.querySelectorAll("button").forEach((b) => { b.onclick = () => { closeMenu(); fns[+b.dataset.i](); }; });
}
function closeMenu() { menuOpen = null; $("menupop").classList.add("hidden"); document.querySelectorAll("#menus button.open, .tbtn.open").forEach((b) => b.classList.remove("open")); }
document.addEventListener("pointerdown", (e) => { if (menuOpen && !e.target.closest("#menupop") && !e.target.closest("#menus") && !e.target.closest(".tbtn")) closeMenu(); });
$("menus").innerHTML = ["File", "Edit", "Add", "Map", "View", "Help"].map((m) => '<button data-m="' + m + '">' + m + "</button>").join("");
$("menus").querySelectorAll("button").forEach((b) => { b.onclick = (e) => openMenu(b.dataset.m, e); b.onmouseenter = (e) => { if (menuOpen && menuOpen !== b.dataset.m) openMenu(b.dataset.m, e); }; });
$("exportbtn").onclick = exportDialog;
$("openfile").onchange = (e) => { if (e.target.files[0]) openProject(e.target.files[0]); e.target.value = ""; };
$("speed").oninput = (e) => { S.speed = +e.target.value; };
$("projname").onchange = () => scheduleAutosave();

function levelDialog() {
  modal('<h2>Map building settings</h2><p class="note">The Floor and Wall tools build on the building level. Set it to 3 to build a second story on top of 3 m walls.</p>' +
    '<div class="prow"><span>Level (m)</span><input type="number" id="lv" step="0.5" value="' + S.level + '"></div>' +
    '<div class="prow"><span>Wall height</span><input type="number" id="wh" step="0.1" min="0.5" value="' + S.wall.h + '"></div>' +
    '<div class="prow"><span>Wall thickness</span><input type="number" id="wt" step="0.05" min="0.05" value="' + S.wall.t + '"></div>' +
    '<div class="row"><span></span><button class="primary" id="m-ok">OK</button></div>');
  $("m-ok").onclick = () => { S.level = +$("lv").value || 0; S.wall.h = Math.max(0.5, +$("wh").value || 3); S.wall.t = Math.max(0.05, +$("wt").value || 0.2); closeModal(); renderToolbar(); toast("Building level " + S.level + " m, walls " + S.wall.h + " m tall."); };
}
function exportDialog() {
  modal('<h2>Export for Unity</h2><p class="note">Files go to your Downloads folder. 1 unit = 1 meter, so sizes match Unity.</p><div class="exp-list">' +
    '<button data-k="glb"><b>GLB (best)</b><span>One file with shapes, groups and colors. In Unity add the free official glTFast package once (Package Manager → Add package by name → <code>com.unity.cloud.gltfast</code>), then drag the .glb into Assets.</span></button>' +
    '<button data-k="fbx"><b>FBX</b><span>Unity opens it with nothing extra. Keeps groups, names, positions and colors. Tested importing into Unity 6.</span></button>' +
    '<button data-k="obj"><b>OBJ + MTL</b><span>Two files (.obj and .mtl), keep them together. Unity opens them with nothing extra. Each object keeps its name and color, but groups are flattened.</span></button>' +
    '<button data-k="gltf"><b>glTF (.gltf text)</b><span>Same as GLB but as text. Also needs glTFast in Unity.</span></button>' +
    '</div><label><input type="checkbox" id="exp-sel"' + (S.sel.length ? "" : " disabled") + "> Only the selected objects</label>" +
    '<div class="row"><span class="note">Save your project too (File → Save project) to keep editing later.</span><button id="m-no">Close</button></div>');
  $("m-no").onclick = closeModal;
  document.querySelectorAll(".exp-list button").forEach((b) => { b.onclick = () => { const only = $("exp-sel").checked; closeModal(); doExport(b.dataset.k, only); }; });
}
function unityHelp() {
  modal('<h2>Using your model in Unity</h2><div class="scroll"><ol>' +
    "<li><b>FBX or OBJ:</b> drag the file into your Unity project's Assets folder, then drag it into the scene. Done.</li>" +
    "<li><b>GLB:</b> once per project, open <i>Window → Package Manager</i>, click <b>+</b> → <i>Add package by name</i>, type <code>com.unity.cloud.gltfast</code> and press Add. Then drag .glb files into Assets like any model.</li>" +
    "<li><b>Colliders for maps:</b> select the model in Unity and add a <i>Mesh Collider</i> so players can walk on it.</li>" +
    "<li><b>Size:</b> 1 grid square here = 1 meter in Unity. A door is 2.1 m tall, walls 3 m.</li>" +
    '<li><b>Keep editing later:</b> save the project (File → Save project). Exported files can\'t be opened back in Forge 3D.</li></ol></div><div class="row"><span></span><button class="primary" id="m-no">Got it</button></div>');
  $("m-no").onclick = closeModal;
}
function shortcuts() {
  const rows = [["Fly", "W A S D"], ["Down / up", "Q / E  or  Ctrl / Space"], ["Look around", "Hold right mouse + drag"], ["Fly faster", "Hold Shift"], ["Change fly speed", "Right mouse + wheel"],
    ["Zoom", "Mouse wheel"], ["Pan", "Middle mouse drag"], ["Focus on selection", "F"], ["Select / Move / Rotate / Scale", "V / G / R / T"], ["Pick more", "Shift+click"], ["Box select", "Drag on empty space"],
    ["Select all", CTRL + "+A"], ["Edit mode on / off", "Tab"], ["Vertex / Edge / Face", "1 / 2 / 3"], ["Extrude", CTRL + "+E"], ["Inset", "I"], ["Loop cut", "L"], ["Subdivide", "U"], ["Bevel", "B"],
    ["Merge", "M"], ["Flip faces", "N"], ["Separate", "P"], ["Duplicate", CTRL + "+D"], ["Delete", "X or Delete"], ["Group / Ungroup", CTRL + "+G / " + CTRL + "+Shift+G"], ["Join", CTRL + "+J"],
    ["Hide / Show all", "H / Alt+H"], ["X-ray", "Z"], ["Snap on/off", "Shift+Tab"], ["Undo / Redo", CTRL + "+Z / " + CTRL + "+Y"], ["Save project", CTRL + "+S"], ["Stop drawing walls", "Right-click or Enter"]];
  modal('<h2>Keyboard shortcuts</h2><div class="scroll"><table>' + rows.map(([a, b]) => "<tr><td>" + a + "</td><td>" + b.split(" ").map((x) => (/^[\/or+&]+$|^or$|^Hold$|^mouse$|^drag$|^\+$/.test(x) ? x : "<kbd>" + esc(x) + "</kbd>")).join(" ") + "</td></tr>").join("") + '</table></div><div class="row"><span></span><button class="primary" id="m-no">Close</button></div>');
  $("m-no").onclick = closeModal;
}
const TOUR = [
  ["fly", "Welcome to Forge 3D!", "Make 3D models and game maps, then use them in Unity. First, <b>fly around</b> like a game: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move, hold the <b>right mouse button</b> and drag to look, <kbd>Q</kbd>/<kbd>E</kbd> to go down/up, hold <kbd>Shift</kbd> to go fast."],
  ["cube", "Add shapes", "Click a shape on the left (<b>Add</b>: cube, sphere, cylinder...). It appears on the floor in front of you. A box pops up so you can change its details."],
  ["move", "Pick and move", "<b>Click</b> an object to pick it (<kbd>Shift</kbd>+click for more). Use <b>Move</b> <kbd>G</kbd>, <b>Rotate</b> <kbd>R</kbd> and <b>Scale</b> <kbd>T</kbd> and drag the colored handles. The magnet (<b>Snap</b>) keeps things lined up on the grid. You can keep flying with WASD while you pick."],
  ["vert", "Change the shape", "Press <kbd>Tab</kbd> for <b>Edit mode</b>. Pick <b>vertices</b> <kbd>1</kbd>, <b>edges</b> <kbd>2</kbd> or <b>faces</b> <kbd>3</kbd>. Then try <b>Extrude</b> (pull a face out), <b>Inset</b>, <b>Loop Cut</b> and <b>Bevel</b>. Press <kbd>Tab</kbd> again when done."],
  ["wall", "Build maps", "Use the <b>Map</b> tools: <b>Floor</b> (click 2 corners), <b>Wall</b> (click corner to corner, right-click to stop), then click a wall with <b>Door</b> or <b>Window</b>. <b>Stairs</b> and <b>Array</b> (rows of copies) help too."],
  ["export", "Save and export", "Your work autosaves in this browser. <b>File → Save project</b> makes a file you can open later. The blue <b>Export</b> button makes GLB, FBX or OBJ files for Unity. Hover any button to see what it does and its shortcut. Press <kbd>F1</kbd> to see this again."],
];
function tutorial(i) {
  localStorage.setItem("forge3d.tour", "1");
  const [ic, title, text] = TOUR[i];
  modal('<div class="step">Quick tour · ' + (i + 1) + " of " + TOUR.length + '</div><div class="big">' + icon(ic) + "<div><h2>" + title + "</h2><p>" + text + "</p></div></div>" +
    '<div class="row"><div class="dots">' + TOUR.map((_, k) => '<i class="' + (k === i ? "on" : "") + '"></i>').join("") + "</div><span>" +
    (i > 0 ? '<button id="t-back">Back</button> ' : '<button id="t-skip">Skip</button> ') + '<button class="primary" id="t-next">' + (i === TOUR.length - 1 ? "Start building!" : "Next") + "</button></span></div>");
  if ($("t-back")) $("t-back").onclick = () => tutorial(i - 1);
  if ($("t-skip")) $("t-skip").onclick = () => { localStorage.setItem("forge3d.tour", "1"); closeModal(); };
  $("t-next").onclick = () => { if (i === TOUR.length - 1) { localStorage.setItem("forge3d.tour", "1"); closeModal(); } else tutorial(i + 1); };
}

// ---------------------------------------------------------------- outliner
const collapsed = new Set();
let dragRow = null;
function renderOutliner() {
  const el = $("outliner"), sel = new Set(S.sel), active = S.sel[S.sel.length - 1];
  const rows = [];
  const walk = (o, depth) => {
    const ch = kids(o), id = o.userData.fid, ic = o.userData.kind === "group" ? "folder" : o.userData.param ? { wall: "wall", stairs: "stairs", floor: "floor" }[o.userData.param.kind] : o.userData.openingOf ? (o.name.startsWith("Door") ? "door" : "window") : "mesh";
    rows.push('<div class="orow' + (sel.has(o) ? " sel" : "") + (o === active ? " active" : "") + (o.visible ? "" : " hid") + '" draggable="true" data-id="' + id + '" style="padding-left:' + (6 + depth * 14) + 'px">' +
      '<span class="tw" data-tw="' + id + '">' + (ch.length ? (collapsed.has(id) ? "▸" : "▾") : "") + "</span>" + icon(ic) + '<span class="nm">' + esc(o.name) + '</span><span class="eye" data-eye="' + id + '" data-tip="Hide / show">' + icon(o.visible ? "eye" : "eyeoff") + "</span></div>");
    if (!collapsed.has(id)) for (const c of ch) walk(c, depth + 1);
  };
  kids(world).forEach((o) => walk(o, 0));
  el.innerHTML = rows.join("") || '<div class="note" style="padding:8px 10px">Nothing here yet. Add a shape from the left.</div>';
  $("outliner-tools").innerHTML = '<button id="o-group" data-tip="' + esc(tipOf("Group", CTRL + "+G", "Put the picked objects in a group.")) + '">Group</button><button id="o-ungroup" data-tip="' + esc(tipOf("Ungroup", CTRL + "+Shift+G")) + '">Ungroup</button>';
  $("o-group").onclick = cmdGroup; $("o-ungroup").onclick = cmdUngroup;
  el.querySelectorAll(".orow").forEach((r) => {
    const o = byId(+r.dataset.id);
    r.onclick = (e) => {
      if (e.target.closest("[data-eye]")) { o.visible = !o.visible; if (!o.visible) S.sel = S.sel.filter((x) => x !== o); refreshAll(); commit(o.visible ? "Show" : "Hide"); return; }
      if (e.target.closest("[data-tw]")) { const id = o.userData.fid; if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); renderOutliner(); return; }
      if (S.mode === "edit") exitEdit();
      if (e.shiftKey || e.ctrlKey || e.metaKey) setSel(S.sel.includes(o) ? S.sel.filter((x) => x !== o) : [...S.sel, o]); else setSel([o]);
    };
    r.ondblclick = (e) => {
      if (e.target.closest("[data-eye]")) return;
      const nm = r.querySelector(".nm"); nm.innerHTML = '<input value="' + esc(o.name) + '">'; const inp = nm.querySelector("input"); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); if (v && v !== o.name) { o.name = v; commit("Rename"); } renderOutliner(); renderProps(); };
      inp.onblur = done; inp.onkeydown = (ev) => { if (ev.key === "Enter") inp.blur(); };
    };
    r.ondragstart = (e) => { dragRow = o; e.dataTransfer.effectAllowed = "move"; };
    r.ondragover = (e) => { if (dragRow && dragRow !== o && o.userData.kind === "group") { e.preventDefault(); r.classList.add("drop"); } };
    r.ondragleave = () => r.classList.remove("drop");
    r.ondrop = (e) => {
      e.preventDefault(); r.classList.remove("drop");
      if (!dragRow || dragRow === o) return; for (let p = o; p; p = p.parent) if (p === dragRow) return;
      o.attach(dragRow); dragRow = null; refreshAll(); commit("Move into group");
    };
  });
  el.ondragover = (e) => { if (dragRow && !e.target.closest(".orow")) e.preventDefault(); };
  el.ondrop = (e) => { if (dragRow && !e.target.closest(".orow")) { e.preventDefault(); world.attach(dragRow); dragRow = null; refreshAll(); commit("Move out of group"); } };
}

// ---------------------------------------------------------------- properties
const R2D = THREE.MathUtils.radToDeg, D2R = THREE.MathUtils.degToRad;
const fmt = (v) => +(+v).toFixed(3);
function vecRow(label, key, vals, step) {
  return '<div class="prow"><span>' + label + '</span><div class="vec">' + ["X", "Y", "Z"].map((a, i) => '<label><i>' + a + '</i><input type="number" step="' + step + '" data-v="' + key + i + '" value="' + fmt(vals[i]) + '"></label>').join("") + "</div></div>";
}
function numRow(label, key, val, step, min, max) { return '<div class="prow"><span>' + label + '</span><input type="number" data-n="' + key + '" step="' + step + '"' + (min !== undefined ? ' min="' + min + '"' : "") + (max !== undefined ? ' max="' + max + '"' : "") + ' value="' + fmt(val) + '"></div>'; }
function renderProps() {
  const el = $("props"), o = S.sel[S.sel.length - 1];
  if (S.mode === "edit" && S.eo) {
    const m = S.eo.userData.poly, n = S.esel.size, word = { v: "vertex", e: "edge", f: "face" }[S.emode];
    $("props-title").textContent = "Editing: " + S.eo.name;
    el.innerHTML = '<div class="pgroup"><b>Picked</b><div class="note">' + n + " " + (n === 1 ? word : word === "vertex" ? "vertices" : word + "s") + " picked · mesh has " + m.v.length + " vertices, " + m.f.length + " faces</div></div>" +
      (n ? editPosRow() : "") +
      '<div class="pgroup"><b>Shape tools</b><div class="pbtns">' + [["extrude", "Extrude"], ["inset", "Inset"], ["loopcut", "Loop Cut"], ["subdivide", "Subdivide"], ["bevel", "Bevel"], ["merge", "Merge"], ["flip", "Flip"], ["delete", "Delete"]].map(([k, l]) => '<button data-op="' + k + '">' + l + "</button>").join("") + "</div></div>" +
      '<div class="pgroup"><b>How to</b><div class="note">Pick with a click (<kbd>Shift</kbd> for more) or drag a box. <kbd>' + CTRL + '</kbd>+<kbd>A</kbd> picks all. Use Move/Rotate/Scale handles to change the picked part. Turn on <b>X-ray</b> (<kbd>Z</kbd>) to pick points on the back. <kbd>Tab</kbd> to finish.</div></div>';
    el.querySelectorAll("[data-op]").forEach((b) => { b.onclick = () => EDIT_OPS[b.dataset.op](); });
    el.querySelectorAll("[data-ep]").forEach((inp) => inp.addEventListener("change", () => {
      const a = +inp.dataset.ep, { vs, pts } = editSelWorld(); if (!vs.length) return;
      const c = pts.reduce((s, p) => s + p.getComponent(a), 0) / pts.length, d = +inp.value - c, inv = S.eo.matrixWorld.clone().invert();
      vs.forEach((vi, k) => { const p = pts[k].clone(); p.setComponent(a, p.getComponent(a) + d); p.applyMatrix4(inv); S.eo.userData.poly.v[vi] = [p.x, p.y, p.z]; });
      rebuild(S.eo); refreshEditOverlay(); updateGizmo(); commit("Move points");
    }));
    return;
  }
  if (!o) {
    $("props-title").textContent = "Properties";
    el.innerHTML = '<div class="note">Pick something to see its settings here.<br><br><b>Start:</b> add a shape from the left, or build a room with <b>Floor</b> and <b>Wall</b>.<br><br>Fly with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, look with the right mouse button.</div>';
    return;
  }
  $("props-title").textContent = S.sel.length > 1 ? S.sel.length + " objects picked" : "Properties";
  let h = '<div class="pgroup"><b>Object</b><div class="prow"><span>Name</span><input type="text" id="p-name" value="' + esc(o.name) + '"></div>' +
    vecRow("Position", "p", o.position.toArray(), S.snap ? S.grid : 0.1) +
    vecRow("Rotation°", "r", [R2D(o.rotation.x), R2D(o.rotation.y), R2D(o.rotation.z)], S.snap ? 15 : 1) +
    vecRow("Scale", "s", o.scale.toArray(), 0.1) + "</div>";
  const meshes = S.sel.filter((x) => x.isMesh);
  if (meshes.length) {
    const m = o.isMesh ? o.material : meshes[0].material;
    h += '<div class="pgroup"><b>Color & material' + (meshes.length > 1 ? " (all " + meshes.length + ")" : "") + '</b><div class="swatches">' + PALETTE.map((c) => '<button data-c="' + c + '" style="background:' + c + '" data-tip="' + c + '"></button>').join("") + "</div>" +
      '<div class="prow"><span>Color</span><input type="color" id="p-color" value="#' + m.color.getHexString() + '"></div>' +
      '<div class="prow"><span>Shiny</span><input type="range" id="p-rough" min="0" max="1" step="0.01" value="' + (1 - m.roughness) + '" data-tip="Left = matte, right = glossy"></div>' +
      '<div class="prow"><span>Metal</span><input type="range" id="p-metal" min="0" max="1" step="0.01" value="' + m.metalness + '"></div>' +
      '<div class="prow"><span>See-through</span><input type="range" id="p-op" min="0" max="0.9" step="0.01" value="' + (1 - m.opacity) + '" data-tip="Right = more see-through (glass, water)"></div>' +
      '<div class="prow"><span>Smooth</span><label><input type="checkbox" id="p-smooth"' + (meshes[0].userData.smooth ? " checked" : "") + '> smooth shading</label></div></div>';
  }
  const pr = o.userData.param;
  if (S.sel.length === 1 && pr) {
    if (pr.kind === "wall") {
      h += '<div class="pgroup"><b>Wall</b>' + numRow("Length", "length", pr.length, 0.1, 0.1) + numRow("Height", "height", pr.height, 0.1, 0.3) + numRow("Thickness", "thickness", pr.thickness, 0.05, 0.02) +
        (pr.openings.length ? "" : '<div class="note">Use the <b>Door</b> or <b>Window</b> tool and click this wall to add openings.</div>') +
        pr.openings.map((op, i) => '<div class="opening"><div class="top"><b>' + (op.type === "door" ? "Door" : "Window") + " " + (i + 1) + '</b><button data-delop="' + i + '">Remove</button></div>' +
          ["at|From start", "w|Width", "h|Height", "sill|From floor"].map((s) => { const [k, l] = s.split("|"); return '<div class="prow"><span>' + l + '</span><input type="number" step="0.05" data-op="' + i + "|" + k + '" value="' + fmt(op[k]) + '"></div>'; }).join("") + "</div>").join("") + "</div>";
    } else if (pr.kind === "stairs") h += '<div class="pgroup"><b>Stairs</b>' + numRow("Steps", "steps", pr.steps, 1, 2, 60) + numRow("Width", "width", pr.width, 0.1, 0.2) + numRow("Height", "height", pr.height, 0.1, 0.2) + numRow("Length", "depth", pr.depth, 0.1, 0.2) + "</div>";
    else if (pr.kind === "floor") h += '<div class="pgroup"><b>Floor</b>' + numRow("Width (X)", "w", pr.w, 0.1, 0.1) + numRow("Depth (Z)", "d", pr.d, 0.1, 0.1) + numRow("Thickness", "t", pr.t, 0.05, 0.02) + "</div>";
  }
  if (S.sel.length === 1 && o.isMesh) h += '<div class="pgroup"><b>Info</b><div class="note">' + o.userData.poly.v.length + " vertices · " + o.userData.poly.f.length + " faces" + (pr ? " · press Tab to edit the shape by hand (it becomes a normal mesh)" : "") + "</div></div>";
  if (S.sel.length === 1 && o.userData.kind === "group") h += '<div class="pgroup"><b>Group</b><div class="note">' + kids(o).length + ' things inside. Click any of them in the viewport to pick the whole group, or pick one piece in the Outliner.</div><div class="pbtns"><button id="p-ungroup">Ungroup</button></div></div>';
  el.innerHTML = h;
  // wiring
  $("p-name").onchange = (e) => { o.name = e.target.value.trim() || o.name; renderOutliner(); commit("Rename"); };
  el.querySelectorAll("[data-v]").forEach((inp) => inp.addEventListener("change", () => {
    const k = inp.dataset.v[0], i = +inp.dataset.v[1], v = +inp.value; if (!isFinite(v)) return;
    for (const t of selRoots()) {
      if (k === "p") t.position.setComponent(i, t === o ? v : t.position.getComponent(i) + v - o.position.getComponent(i));
      if (k === "r") { const r = [t.rotation.x, t.rotation.y, t.rotation.z]; r[i] = D2R(v); t.rotation.set(...r); }
      if (k === "s") t.scale.setComponent(i, v || 0.001);
    }
    refreshOutlines(); updateGizmo(); commit("Change " + { p: "position", r: "rotation", s: "scale" }[k]); updateTransformFields();
  }));
  const mats = () => meshes.map((x) => x.material);
  el.querySelectorAll("[data-c]").forEach((b) => { b.onclick = () => { mats().forEach((m) => m.color.set(b.dataset.c)); $("p-color").value = b.dataset.c; commit("Color"); }; });
  if ($("p-color")) {
    $("p-color").oninput = (e) => mats().forEach((m) => m.color.set(e.target.value)); $("p-color").onchange = () => commit("Color");
    $("p-rough").oninput = (e) => mats().forEach((m) => { m.roughness = 1 - +e.target.value; }); $("p-rough").onchange = () => commit("Material");
    $("p-metal").oninput = (e) => mats().forEach((m) => { m.metalness = +e.target.value; }); $("p-metal").onchange = () => commit("Material");
    $("p-op").oninput = (e) => mats().forEach((m) => setOpacity(m, 1 - +e.target.value)); $("p-op").onchange = () => commit("See-through");
    $("p-smooth").onchange = (e) => { meshes.forEach((x) => { x.userData.smooth = e.target.checked; rebuild(x); }); refreshOutlines(); commit("Smooth"); };
  }
  el.querySelectorAll("[data-n]").forEach((inp) => inp.addEventListener("change", () => {
    const v = +inp.value; if (!isFinite(v) || v <= 0) return renderProps();
    pr[inp.dataset.n] = inp.dataset.n === "steps" ? Math.round(v) : v;
    if (pr.kind === "wall") pr.openings.forEach((op) => { op.at = Math.min(op.at, pr.length - op.w / 2); op.h = Math.min(op.h, pr.height - op.sill - 0.05); });
    o.userData.poly = P.buildParam(pr); rebuild(o); syncPanels(o); refreshOutlines(); commit("Change " + pr.kind); renderProps();
  }));
  el.querySelectorAll("[data-op]").forEach((inp) => inp.addEventListener("change", () => {
    const [i, k] = inp.dataset.op.split("|"), v = +inp.value; if (!isFinite(v)) return;
    const op = pr.openings[+i]; op[k] = Math.max(k === "sill" ? 0 : 0.1, v);
    op.at = Math.max(op.w / 2, Math.min(pr.length - op.w / 2, op.at)); op.h = Math.min(op.h, pr.height - op.sill - 0.05);
    o.userData.poly = P.buildParam(pr); rebuild(o); syncPanels(o); refreshOutlines(); commit("Change opening"); renderProps();
  }));
  el.querySelectorAll("[data-delop]").forEach((b) => { b.onclick = () => { pr.openings.splice(+b.dataset.delop, 1); o.userData.poly = P.buildParam(pr); rebuild(o); syncPanels(o); refreshAll(); commit("Remove opening"); }; });
  if ($("p-ungroup")) $("p-ungroup").onclick = cmdUngroup;
}
function editPosRow() {
  const { pts } = editSelWorld(), c = new THREE.Vector3(); pts.forEach((p) => c.add(p)); c.divideScalar(pts.length || 1);
  return '<div class="pgroup"><b>Middle of picked (world)</b><div class="vec">' + ["X", "Y", "Z"].map((a, i) => '<label><i>' + a + '</i><input type="number" step="0.1" data-ep="' + i + '" value="' + fmt(c.getComponent(i)) + '"></label>').join("") + "</div></div>";
}
let fieldsT = 0;
function updateTransformFields() {
  if (fieldsT) return; fieldsT = requestAnimationFrame(() => {
    fieldsT = 0; const o = S.sel[S.sel.length - 1]; if (!o || S.mode !== "object") return;
    const vals = { p: o.position.toArray(), r: [R2D(o.rotation.x), R2D(o.rotation.y), R2D(o.rotation.z)], s: o.scale.toArray() };
    document.querySelectorAll("#props [data-v]").forEach((inp) => { if (document.activeElement !== inp) inp.value = fmt(vals[inp.dataset.v[0]][+inp.dataset.v[1]]); });
  });
}

// ---------------------------------------------------------------- render loop
function resize() {
  const { w, h } = vpSize(); renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(vp);
let last = performance.now(), frames = 0, fpsT = last;
function loop(now) {
  requestAnimationFrame(loop);
  frame(now, Math.min(0.05, (now - last) / 1000)); last = now;
}
window.__forge.step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame(performance.now(), dt); }; // for automated tests
function frame(now, dt) {
  fly(dt);
  camera.rotation.set(S.pitch, S.yaw, 0);
  camera.updateMatrixWorld();
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  const focus = camera.position.clone().addScaledVector(f, 12); focus.y = 0;
  sun.target.position.copy(focus); sun.position.copy(focus).add(new THREE.Vector3(25, 45, 18));
  world.updateMatrixWorld(true);
  for (const l of outlines.children) l.matrix.copy(l.userData.src.matrixWorld);
  if (S.eo) editG.matrix.copy(S.eo.matrixWorld);
  if (!tc.dragging && tc.object && S.mode === "object" && S.sel.length && !look) { /* keep the gizmo on the selection if moved by fields */ }
  const { w, h } = vpSize();
  renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.render(scene, camera);
  const s = 90; renderer.setScissorTest(true); renderer.setScissor(w - s - 8, 8, s, s); renderer.setViewport(w - s - 8, 8, s, s);
  axCam.position.set(0, 0, 4).applyQuaternion(camera.quaternion); axCam.quaternion.copy(camera.quaternion); renderer.autoClear = false; renderer.clearDepth(); renderer.render(axScene, axCam); renderer.autoClear = true;
  renderer.setScissorTest(false);
  frames++; if (now - fpsT > 1000) { const tris = renderer.info.render.triangles; $("st-info").textContent = Math.round(frames * 1000 / (now - fpsT)) + " fps · " + allObjects().length + " objects · cam " + camera.position.toArray().map((v) => v.toFixed(1)).join(", "); frames = 0; fpsT = now; void tris; }
}

// ---------------------------------------------------------------- start
window.addEventListener("beforeunload", (e) => { if (saveTimer) { idb.set("autosave", { t: Date.now(), data: serialize() }); e.preventDefault(); e.returnValue = ""; } });
async function start() {
  resize(); lookAt(new THREE.Vector3(0, 0.5, 0));
  let restored = false;
  try {
    const saved = await idb.get("autosave");
    if (saved && saved.data && saved.data.objects && saved.data.objects.length) { loadData(saved.data); restored = true; }
  } catch (e) { console.warn("autosave read failed", e); }
  if (!restored) { const c = makeMesh(P.box(), { name: "Cube" }); c.position.set(0, 0.5, 0); world.add(c); S.sel = [c]; }
  refreshAll(); commit("Start"); hist.list[0].label = "Start";
  requestAnimationFrame(loop);
  if (!localStorage.getItem("forge3d.tour")) tutorial(0);
  else if (restored) toast("Welcome back! Your last work was loaded (autosaved in this browser).");
}
start();
