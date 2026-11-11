// GunnerVerse Studio: the editor. Toolbox (free assets) on the left, the 3D world in the middle, Explorer + Properties
// on the right, tools along the top (＋ Add menu, Select / Move / Rotate / Scale, snap, undo, copy, delete, Publish, Play).
// Screen GUI (labels, buttons, panels, pictures, the Developer Menu button) lives in game.gui (gui.js): it shows over the
// 3D view (drag it anywhere, drag a panel's corner to resize) and in the Explorer under "ScreenGui".
// SCRIPTS (scripts.js) live inside parts / GUI things (or the whole game): they show in the Explorer under their thing,
// "＋ Add Script" is at the bottom of Properties, and clicking one opens the script editor (script-editor.js).
// IMPORTS (files.js): ＋ Add > Import (or drop a file on the world) brings in 3D models and pictures; they wait in the
// Toolbox's "My imports".
// Mouse: left click selects, RIGHT CLICK opens a menu (delete, copy, add script...), right-drag looks around,
// middle-drag pans, wheel zooms; W A S D Q E fly (Shift = faster).
// SHARED STUDIOS (collab.js, relay studio.js): 👥 Share lets friends build the same game live; every change saves on
// GunnerVerse by itself, and the people bar + colored boxes / name tags show who's in and what they're doing.
// Games save in this browser by themselves (game.js). Play test lives in play.js; script errors show in the Output box.
import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { TransformControls } from "../vendor/TransformControls.js";
import { ASSETS, BY_TYPE, BEHAVIORS, CATEGORIES, MATERIALS, SWITCH_HOW } from "./assets.js";
import { createWorld, buildObject, placeObject, boundsBox } from "./world.js";
import { SKIES, TEMPLATES, newObj, fillBehavior, sanitize, listGames, loadGame, saveGame, deleteGame, makeGame, r2, uid, MAX_SCRIPTS } from "./game.js";
import { startPlay } from "./play.js";
import { openPublish, uploadFiles } from "./publish.js";
import { GUI_KINDS, GUI_SPOTS, BUTTON_ACTIONS, GUI_SIZES, NEEDS_TARGET, MAX_GUI, newGui, renderGui } from "./gui.js";
import { ACCEPT, importFile, listFiles, deleteFile, useFiles, noteFile, loadPictures, fileUrl, startSize, animationNames, updateMixers, clearMixers, isModel } from "./files.js";
import { openScript, closeScript, scriptOpen, starterCode, flushScript } from "./script-editor.js";
import { api, account, RELAY } from "./net.js";
import { connectStudio, shareStudio, inviteTo, removeFrom, stopSharing, myStudios, SHARE_ERR as STUDIO_ERR } from "./collab.js";
import { GAITS, IDLES, WHEN, motionOf, sanitizeMotion, animateThing, animateRig, limbCount, LIMBS } from "./motion.js";
import { TEXTURES, texturePicture } from "./textures.js";
import { sanitizeAnims, animSummary, MAX_ANIMS } from "./keyanim.js";
import { openAnimMaker } from "./animmaker.js";
import { CHASE_SOUNDS, SCARE_FX, FLASHES, SCARE_SOUNDS, SCARE_WHEN, DEFAULT_CHASE, DEFAULT_SCARE, sanitizeChase, sanitizeScare, playScare } from "./scare.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D2R = Math.PI / 180;
const SWATCHES = ["#ffffff", "#a3a8b0", "#2b2f36", "#e8261c", "#ff7a1a", "#ffc531", "#1fae45", "#13c4c4", "#2f7df6", "#a64bf4", "#ff4fa3", "#8b5a2b"];
const SNAPS = [1, 0.5, 0.25, 0, 2, 4];

// ---------------------------------------------------------------- state
let game = null;
const groups = new Map();      // object id -> THREE.Group in the world
let selected = null;           // the selected object's (or GUI item's) id
let tool = "select";
let snapIndex = 0;
let undoStack = [], redoStack = [];
let dirty = false, saveTimer = 0, playing = null;
let category = "All";
const SHARED = "🌍 Shared"; // (Toolbox tab: things players shared, drawShared)
const TEX_CAT = "🧱 Textures"; // (Toolbox tab: textures to drag onto parts, drawTextures)
let shared = null, sharedAt = 0;
let collab = null, presT = 0, uploading = false; // (a shared studio, collab.js)
let myFiles = [];              // imported files in this browser (files.js listFiles)
let selScript = null;          // the script open in the script editor
const lastErr = new Map();     // script id -> the line its error was on in the last Play

const world = createWorld($("canvas"));
const { scene, camera, renderer } = world;
const canvas = $("canvas");
camera.position.set(28, 22, 34);

const orbit = new OrbitControls(camera, canvas);
orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
orbit.enableDamping = true; orbit.dampingFactor = 0.15;
orbit.screenSpacePanning = true;
orbit.maxDistance = 900;
orbit.target.set(0, 0, 0);

const transform = new TransformControls(camera, canvas);
transform.setSize(0.9);
scene.add(transform.getHelper());
transform.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; });

// The blue box around the selected object.
const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x2f7df6, depthTest: false, transparent: true }));
selBox.renderOrder = 999; selBox.visible = false;
scene.add(selBox);
const extraBoxes = []; // (one per other selected thing)

// ---------------------------------------------------------------- objects in the world
function obj(id) { return game.objects.find((o) => o.id === id) || null; }
function guiItem(id) { return (game.gui || []).find((g) => g.id === id) || null; }
function drawGui() { if (game) renderGui($("guiLayer"), game.gui, { edit: true, selected, fileUrl, hide: hiddenHere }); guiVisButton(); }
// GUI you've hidden on YOUR screen while you build (the eye buttons). Only you see this; the game, Play and scripts
// don't change, and nobody else in a shared studio is affected. Remembered on this computer, for each game.
let hideHere = new Set();
const hideKey = () => "gv_guihide_" + (game ? game.id : "");
function loadHideHere() { hideHere = new Set(); try { for (const id of JSON.parse(localStorage.getItem(hideKey()) || "[]")) hideHere.add(id); } catch {} }
function saveHideHere() { try { hideHere.size ? localStorage.setItem(hideKey(), JSON.stringify([...hideHere])) : localStorage.removeItem(hideKey()); } catch {} }
function hiddenHere(g) { return hideHere.has(g.id) || (!!g.parent && hideHere.has(g.parent)); }
function setHiddenHere(ids, hide) { for (const id of ids) hide ? hideHere.add(id) : hideHere.delete(id); saveHideHere(); drawGui(); drawTree(); }
function scriptsOf(id) { return (game.scripts || []).filter((x) => x.on === id); }
function rebuild(o) {
  const old = groups.get(o.id);
  if (old) { world.root.remove(old); disposeGroup(old); }
  const g = buildObject(o);
  if (o.xray) { // ("See through while building": a ceiling or roof you can look and click through in the studio; normal in Play)
    g.userData.xray = true;
    g.traverse((m) => { if (!m.isMesh || !m.material) return; m.material = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => { const c = x.clone(); c.transparent = true; c.opacity = 0.12; c.depthWrite = false; return c; }); if (m.material.length === 1) m.material = m.material[0]; m.castShadow = false; });
  }
  world.root.add(g);
  groups.set(o.id, g);
  if (selected === o.id && tool !== "select" && !many()) transform.attach(g);
  return g;
}
function disposeGroup(g) { g.traverse((m) => { if (m.isMesh && m.geometry) m.geometry.dispose(); }); }
function rebuildAll() {
  transform.detach();
  for (const g of groups.values()) { world.root.remove(g); disposeGroup(g); }
  groups.clear();
  clearMixers();
  for (const o of game.objects) rebuild(o);
  if (selected && !obj(selected) && !guiItem(selected)) selected = null;
  select(selected);
}

// ---------------------------------------------------------------- history + saving
function snapshot() { return JSON.stringify({ o: game.objects, s: game.settings, g: game.gui, sc: game.scripts || [] }); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift(); redoStack = []; updateButtons(); }
function restore(snap) {
  const d = JSON.parse(snap);
  game.objects = d.o; game.settings = d.s; game.gui = d.g || [];
  // scripts come back or go away, but what you typed in a script stays (the script editor has its own Ctrl+Z)
  const now = new Map((game.scripts || []).map((x) => [x.id, x]));
  game.scripts = (d.sc || []).map((x) => now.get(x.id) || x);
  if (scriptOpen() && !game.scripts.some((x) => x.id === scriptOpen())) closeScript();
  world.setSky(game.settings.sky, true); rebuildAll(); drawTree(); drawProps(); changed(true);
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateButtons(); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateButtons(); }
function changed(skipTree) {
  dirty = true;
  $("savedNote").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
  if (!skipTree) drawTree();
  if (collab) collabPush();
}
function saveNow(force) {
  clearTimeout(saveTimer);
  if (force === true) dirty = true;
  if (!game || !dirty) return;
  const ok = saveGame(game);
  dirty = !ok;
  $("savedNote").textContent = ok ? "Saved ✓" : "Couldn't save!";
  try { localStorage.setItem("gv_studio_last", game.id); } catch {}
}
window.addEventListener("beforeunload", saveNow);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveNow(); });

// ---------------------------------------------------------------- selecting + tools
// MANY AT ONCE: Shift / Ctrl + click (in the world or the Explorer) adds or takes away, and dragging a box over empty
// space picks everything inside it. Then the gizmo moves / turns / sizes them all together (around their middle),
// Ctrl+C / Ctrl+V copy and paste them (even into another game) and Ctrl+D puts copies right next to them.
const extra = new Set();        // the other selected things (selected is the last one clicked)
const pivot = new THREE.Object3D(); scene.add(pivot); // (the gizmo holds this when many are selected)
function many() { return !!selected && extra.size > 0; }
function selIds() { return selected && obj(selected) ? [selected, ...extra].filter((id) => obj(id)) : []; }
function select(id) {
  extra.clear();
  selected = id && (obj(id) || guiItem(id)) ? id : null;
  attachGizmo();
  drawTree(); drawProps(); updateButtons(); drawGui();
}
function selectMany(ids) {
  ids = [...new Set(ids)].filter((id) => obj(id));
  extra.clear();
  selected = ids.length ? ids[ids.length - 1] : null;
  for (const id of ids.slice(0, -1)) extra.add(id);
  attachGizmo();
  drawTree(); drawProps(); updateButtons(); drawGui();
}
function toggleSel(id) {
  if (!obj(id)) { select(id); return; }
  const ids = selIds();
  selectMany(ids.includes(id) ? ids.filter((x) => x !== id) : ids.concat(id));
}
function centerOf(ids) {
  const c = new THREE.Vector3(); let n = 0;
  for (const id of ids) { const g = groups.get(id); if (g) { c.add(g.position); n++; } }
  return n ? c.multiplyScalar(1 / n) : c;
}
function attachGizmo() {
  if (tool === "select" || !selected) { transform.detach(); return; }
  if (many()) { pivot.position.copy(centerOf(selIds())); pivot.quaternion.identity(); pivot.scale.set(1, 1, 1); pivot.updateMatrixWorld(); transform.attach(pivot); return; }
  const g = groups.get(selected);
  if (g) transform.attach(g); else transform.detach();
}
function setTool(t) {
  tool = t;
  document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
  if (t !== "select") transform.setMode(t);
  attachGizmo(); drawProps();
}
function applySnap() {
  const s = SNAPS[snapIndex];
  transform.setTranslationSnap(s || null);
  transform.setRotationSnap(s ? 15 * D2R : null);
  transform.setScaleSnap(s ? 0.25 : null);
  $("btnSnap").querySelector("span").textContent = s ? "Snap " + s : "Snap off";
  $("btnSnap").classList.toggle("on", !!s);
}
function updateButtons() {
  $("btnUndo").disabled = !undoStack.length; $("btnRedo").disabled = !redoStack.length;
  $("btnDup").disabled = !selected; $("btnDel").disabled = !selected;
  $("btnDup").title = many() ? "Copies right next to them (Ctrl+D)" : "Duplicate (Ctrl+D)";
}

// Move / rotate / scale with the gizmo.
let dragStartSize = null, manyStart = null;
transform.addEventListener("mouseDown", () => {
  pushUndo(); const o = obj(selected); dragStartSize = o ? o.size.slice() : null;
  manyStart = many() ? { p: pivot.position.clone(), list: selIds().map((id) => { const g = groups.get(id); return { id, p: g.position.clone(), q: g.quaternion.clone(), size: obj(id).size.slice() }; }) } : null;
});
const _dq = new THREE.Quaternion(), _off = new THREE.Vector3(), _e = new THREE.Euler();
transform.addEventListener("objectChange", () => {
  if (manyStart) { // (all of them, around their middle)
    _dq.copy(pivot.quaternion);
    for (const s of manyStart.list) {
      const o = obj(s.id), g = groups.get(s.id); if (!o || !g) continue;
      _off.copy(s.p).sub(manyStart.p).multiply(pivot.scale).applyQuaternion(_dq);
      g.position.copy(pivot.position).add(_off);
      g.quaternion.copy(_dq).multiply(s.q);
      _e.setFromQuaternion(g.quaternion);
      o.pos = [r2(g.position.x), r2(g.position.y), r2(g.position.z)];
      o.rot = [r2(_e.x / D2R), r2(_e.y / D2R), r2(_e.z / D2R)];
      if (tool === "scale") g.scale.set(Math.abs(pivot.scale.x), Math.abs(pivot.scale.y), Math.abs(pivot.scale.z)); // (the real sizes are set when you let go)
    }
    return;
  }
  const o = obj(selected), g = groups.get(selected);
  if (!o || !g) return;
  o.pos = [r2(g.position.x), r2(g.position.y), r2(g.position.z)];
  o.rot = [r2(g.rotation.x / D2R), r2(g.rotation.y / D2R), r2(g.rotation.z / D2R)];
  if (tool === "scale" && dragStartSize) o.size = [0, 1, 2].map((i) => r2(Math.max(0.1, dragStartSize[i] * Math.abs(g.scale.getComponent(i)))));
  drawProps(true);
});
transform.addEventListener("mouseUp", () => {
  if (manyStart) {
    if (tool === "scale") for (const s of manyStart.list) { const o = obj(s.id); if (!o) continue; o.size = [0, 1, 2].map((i) => r2(Math.max(0.1, s.size[i] * Math.abs(pivot.scale.getComponent(i))))); rebuild(o); }
    manyStart = null; attachGizmo(); changed(); drawProps(); return;
  }
  const o = obj(selected), g = groups.get(selected);
  if (o && g && tool === "scale") { g.scale.set(1, 1, 1); rebuild(o); }
  changed();
});

// Left click picks the thing under the mouse.
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function hitAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  mouse.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(world.root.children, true);
  for (const h of hits) { let p = h.object; while (p && !p.userData.id) p = p.parent; if (p && !p.userData.xray) return { id: p.userData.id, point: h.point }; } // (see-through-while-building things: pick them in the Explorer)
  const ground = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ground) ? { id: null, point: ground } : null;
}
let downAt = null, rightAt = null;
let boxing = null, lastMouse = null; // (dragging a selection box; where the mouse was, for Paste)
canvas.addEventListener("pointerdown", (e) => {
  canvas.focus();
  if (e.button === 0) { downAt = { x: e.clientX, y: e.clientY }; boxing = transform.axis ? null : { x: e.clientX, y: e.clientY, add: e.shiftKey || e.ctrlKey || e.metaKey, on: false }; }
  if (e.button === 2) rightAt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointermove", (e) => {
  lastMouse = { x: e.clientX, y: e.clientY };
  if (!boxing || playing || transform.dragging || !(e.buttons & 1)) return;
  if (!boxing.on && Math.hypot(e.clientX - boxing.x, e.clientY - boxing.y) < 6) return;
  boxing.on = true;
  const r = $("view").getBoundingClientRect(), el = $("selRect");
  el.classList.remove("hidden");
  el.style.left = Math.min(e.clientX, boxing.x) - r.left + "px"; el.style.top = Math.min(e.clientY, boxing.y) - r.top + "px";
  el.style.width = Math.abs(e.clientX - boxing.x) + "px"; el.style.height = Math.abs(e.clientY - boxing.y) + "px";
});
// everything whose middle is inside the box (not huge things like the baseplate)
function boxSelect(x0, y0, x1, y1, add) {
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(), ids = add ? selIds() : [];
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  for (const o of game.objects) {
    const g = groups.get(o.id); if (!g || Math.max(o.size[0], o.size[2]) > 150) continue;
    v.copy(boundsBox(o, g.position, g.quaternion).c).project(camera);
    if (v.z > 1) continue;
    const sx = r.left + ((v.x + 1) / 2) * r.width, sy = r.top + ((1 - v.y) / 2) * r.height;
    if (sx >= ax && sx <= bx && sy >= ay && sy <= by && !ids.includes(o.id)) ids.push(o.id);
  }
  selectMany(ids);
}
canvas.addEventListener("pointerup", (e) => {
  if (e.button === 2 && rightAt && !playing) { // a right CLICK (not a drag to look around): the menu
    const moved = Math.hypot(e.clientX - rightAt.x, e.clientY - rightAt.y);
    rightAt = null;
    if (moved > 5) return;
    const h = hitAt(e.clientX, e.clientY);
    if (h && h.id && many() && selIds().includes(h.id)) { manyMenu(e.clientX, e.clientY); return; }
    if (h && h.id) { select(h.id); thingMenu(h.id, e.clientX, e.clientY); }
    return;
  }
  if (e.button !== 0 || !downAt || playing) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y), bx = boxing;
  downAt = null; boxing = null; $("selRect").classList.add("hidden");
  if (bx && bx.on) { boxSelect(bx.x, bx.y, e.clientX, e.clientY, bx.add); return; }
  if (moved > 5 || transform.dragging || (transform.axis && transform.object)) return;
  const h = hitAt(e.clientX, e.clientY);
  // (clicking the huge baseplate selects it like anything else; Esc clears; Shift / Ctrl + click adds or takes away)
  if ((e.shiftKey || e.ctrlKey || e.metaKey) && h && h.id) { toggleSel(h.id); return; }
  select(h && h.id ? h.id : null);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------------------------------------------------------- adding, copying, deleting
function addAsset(type, at, extra) {
  if (!game) return null;
  pushUndo();
  let p = at;
  if (!p) { const r = canvas.getBoundingClientRect(); const h = hitAt(r.left + r.width / 2, r.top + r.height / 2); p = h ? h.point : orbit.target.clone(); }
  const s = SNAPS[snapIndex] || 0;
  const snap = (v) => (s ? Math.round(v / s) * s : v);
  const o = newObj(type, [snap(p.x), r2(Math.max(p.y, -1000)), snap(p.z)], extra);
  // face the camera (vehicles and characters look toward you)
  const yaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) / D2R;
  if (["car", "truck", "kart", "dirtbike", "npc", "sign", "door", "finish", "model", "picture", "switch", "camera"].includes(type)) o.rot[1] = r2(Math.round((yaw + 180) / 15) * 15 % 360);
  o.name = uniqueName(o.name);
  game.objects.push(o);
  rebuild(o);
  if (tool === "select") setTool("translate");
  select(o.id);
  changed();
  return o;
}
function uniqueName(base) {
  const names = new Set(game.objects.map((o) => o.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(base + " " + i)) return base + " " + i;
}
function copyScripts(fromId, toId) {
  for (const sc of scriptsOf(fromId)) if (game.scripts.length < MAX_SCRIPTS) game.scripts.push({ ...sc, id: uid(), on: toId });
}
function duplicate() {
  if (many()) { dupNextTo("right"); return; }
  const gi = guiItem(selected);
  if (gi) {
    const kids = gi.kind === "frame" ? game.gui.filter((x) => x.parent === gi.id) : [];
    if (game.gui.length + 1 + kids.length > MAX_GUI) { alert("You can have up to " + MAX_GUI + " GUI things."); return; }
    pushUndo();
    const c = { ...gi, id: uid(), x: Math.min(100, gi.x + 3), y: Math.min(100, gi.y + 3) };
    game.gui.push(c); copyScripts(gi.id, c.id);
    for (const k of kids) { const kc = { ...k, id: uid(), parent: c.id, x: Math.min(100, k.x + 3), y: Math.min(100, k.y + 3) }; game.gui.push(kc); copyScripts(k.id, kc.id); }
    select(c.id); changed();
    return;
  }
  const o = obj(selected);
  if (!o) return;
  pushUndo();
  const c = JSON.parse(JSON.stringify(o));
  c.id = uid();
  c.name = uniqueName(o.name.replace(/ \d+$/, ""));
  c.pos = [r2(o.pos[0] + Math.max(1, Math.min(o.size[0], 8))), o.pos[1], o.pos[2]];
  game.objects.push(c);
  copyScripts(o.id, c.id);
  rebuild(c);
  select(c.id);
  changed();
}
function remove() {
  if (many()) { removeMany(); return; }
  const gi = guiItem(selected);
  if (gi) {
    pushUndo();
    const gone = new Set([gi.id, ...game.gui.filter((g) => g.parent === gi.id).map((g) => g.id)]); // (a panel takes what's inside it)
    game.gui = game.gui.filter((g) => !gone.has(g.id));
    dropScripts(gone);
    select(null); changed(); return;
  }
  const o = obj(selected);
  if (!o) return;
  pushUndo();
  game.objects = game.objects.filter((x) => x.id !== o.id);
  dropScripts(new Set([o.id]));
  transform.detach();
  const g = groups.get(o.id); if (g) { world.root.remove(g); disposeGroup(g); groups.delete(o.id); }
  select(null);
  changed();
}
// ---------------------------------------------------------------- many things: copies next to them, copy / paste, forests
const MAX_THINGS = 2000; // (relay publish.js takes games up to 2000 things)
function roomFor(n) { if (game.objects.length + n <= MAX_THINGS) return true; alert("A game can have up to " + MAX_THINGS + " things. This would make " + (game.objects.length + n) + "."); return false; }
// Copies of these objects, moved by off (a Vector3, or a function giving each one's new pos). Returns the new ids.
function copyObjects(list, off, scripts, files) {
  const made = [], ids = new Map();
  for (const o of list) {
    const c = JSON.parse(JSON.stringify(o));
    c.id = uid(); ids.set(o.id, c.id);
    c.name = uniqueName(o.name.replace(/ \d+$/, ""));
    if (typeof off === "function") off(c, o); else c.pos = [r2(o.pos[0] + off.x), r2(o.pos[1] + off.y), r2(o.pos[2] + off.z)];
    game.objects.push(c); made.push(c.id);
  }
  for (const sc of scripts || game.scripts.filter((x) => ids.has(x.on))) if (ids.has(sc.on) && game.scripts.length < MAX_SCRIPTS) game.scripts.push({ ...sc, id: uid(), on: ids.get(sc.on) });
  for (const [fid, f] of Object.entries(files || {})) if (!game.files[fid]) game.files[fid] = f;
  for (const id of made) rebuild(obj(id));
  return made;
}
function boxOf(ids) { const b = new THREE.Box3(); for (const id of ids) { const g = groups.get(id); if (g) b.union(new THREE.Box3().setFromObject(g)); } return b; }
// Ctrl+D with many: a copy of all of them right next to them, on the side you're looking at (press again: another row)
const DIRS = { right: "→ Right", left: "← Left", back: "↑ Behind", front: "↓ In front", up: "⬆ On top" };
function dupNextTo(dir) {
  const ids = selIds(); if (!ids.length || !roomFor(ids.length)) return;
  const size = boxOf(ids).getSize(new THREE.Vector3());
  camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize(); fwd.y = 0; fwd.normalize();
  let v = dir === "up" ? new THREE.Vector3(0, 1, 0) : (dir === "left" || dir === "right" ? right.clone().multiplyScalar(dir === "left" ? -1 : 1) : fwd.clone().multiplyScalar(dir === "front" ? -1 : 1));
  if (dir !== "up") v = Math.abs(v.x) > Math.abs(v.z) ? new THREE.Vector3(Math.sign(v.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(v.z)); // (along the grid)
  const step = v.clone().multiply(size).add(v.clone().multiplyScalar(SNAPS[snapIndex] ? 0 : 0.2));
  pushUndo();
  selectMany(copyObjects(ids.map(obj), step));
  changed();
}
function copySel() {
  const ids = selIds(); if (!ids.length) return;
  const set = new Set(ids), list = ids.map((id) => JSON.parse(JSON.stringify(obj(id))));
  const files = {}; for (const o of list) for (const f of [o.file, o.tex && o.tex.startsWith("f:") ? o.tex.slice(2) : ""]) if (f && game.files[f]) files[f] = game.files[f];
  const clip = { objects: list, scripts: game.scripts.filter((x) => set.has(x.on)), files };
  try { localStorage.setItem("gv_clip", JSON.stringify(clip)); } catch {}
  toast("📋 Copied " + ids.length + " thing" + (ids.length === 1 ? "" : "s") + ". Ctrl+V pastes where your mouse is.");
}
function pasteClip() {
  let clip = null; try { clip = JSON.parse(localStorage.getItem("gv_clip") || "null"); } catch {}
  if (!clip || !Array.isArray(clip.objects) || !clip.objects.length) { toast("Nothing copied yet. Select things and press Ctrl+C."); return; }
  const list = sanitize({ ...game, objects: clip.objects, scripts: [], gui: [] }).objects; // (cleaned like a loaded game)
  if (!list.length || !roomFor(list.length)) return;
  const r = canvas.getBoundingClientRect(), m = lastMouse || { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const h = hitAt(m.x, m.y), at = h ? h.point : orbit.target.clone();
  const cx = list.reduce((s, o) => s + o.pos[0], 0) / list.length, cz = list.reduce((s, o) => s + o.pos[2], 0) / list.length, y0 = Math.min(...list.map((o) => o.pos[1]));
  pushUndo();
  const snap = (v) => (SNAPS[snapIndex] ? Math.round(v / SNAPS[snapIndex]) * SNAPS[snapIndex] : v);
  const ids = copyObjects(list, (c, o) => { c.pos = [r2(o.pos[0] - cx + snap(at.x)), r2(o.pos[1] - y0 + at.y), r2(o.pos[2] - cz + snap(at.z))]; }, (clip.scripts || []).map((s) => ({ ...s, code: String(s.code || "").slice(0, 20000), name: String(s.name || "Script").slice(0, 40) })), clip.files);
  if (tool === "select") setTool("translate");
  selectMany(ids); changed();
}
// 🌲 Spread copies around (forests, rocks, crowds...): n copies of what's selected, scattered in a circle around them,
// each turned a random way (and a little bigger or smaller if you want), not on top of each other.
function spreadCopies(n, radius, sizes) {
  const src = selIds().map(obj); if (!src.length || !roomFor(n)) return;
  const c = centerOf(selIds()), taken = src.map((o) => [o.pos[0], o.pos[2], Math.max(o.size[0], o.size[2]) * 0.45]);
  pushUndo();
  const ids = [];
  for (let i = 0; i < n; i++) {
    const o = src[Math.floor(Math.random() * src.length)], k = sizes ? 0.75 + Math.random() * 0.55 : 1, rr = Math.max(o.size[0], o.size[2]) * 0.45 * k;
    let x = 0, z = 0, ok = false;
    for (let t = 0; t < 30 && !ok; t++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * radius;
      x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
      ok = taken.every(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) > (tr + rr) * 0.9);
    }
    taken.push([x, z, rr]);
    ids.push(...copyObjects([o], (cc) => { cc.pos = [r2(x), o.pos[1], r2(z)]; cc.rot = [o.rot[0], r2(Math.random() * 360), o.rot[2]]; cc.size = o.size.map((s) => r2(s * k)); }));
  }
  selectMany(selIds().concat(ids)); changed();
}
function removeMany() {
  const ids = new Set(selIds()); if (!ids.size) return;
  pushUndo();
  game.objects = game.objects.filter((x) => !ids.has(x.id));
  dropScripts(ids);
  transform.detach();
  for (const id of ids) { const g = groups.get(id); if (g) { world.root.remove(g); disposeGroup(g); groups.delete(id); } }
  select(null); changed();
}

// Properties when many things are selected
function drawManyProps(box) {
  const ids = selIds();
  $("propsFor").textContent = ids.length + " things";
  box.innerHTML = '<p class="note">' + ids.length + " things selected. Drag the gizmo to move, turn or size them all together. Shift / Ctrl + click adds or takes away.</p>" +
    '<div class="group-title">⧉ Copies right next to them</div><div class="many-dirs">' + Object.entries(DIRS).map(([k, v]) => '<button type="button" class="btn small ghost" data-dir="' + k + '">' + v + "</button>").join("") + "</div>" +
    '<p class="note">Press again to keep going: a whole row, wall or forest. (Ctrl+D does → Right.)</p>' +
    spreadBox() +
    '<div class="group-title">Look (all of them)</div><div class="swatches">' + SWATCHES.map((c) => '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join("") + "</div>" +
    '<div class="group-title">More</div><div class="many-dirs"><button type="button" class="btn small ghost" id="mCopy">📋 Copy (Ctrl+C)</button><button type="button" class="btn small ghost" id="mPaste">📥 Paste (Ctrl+V)</button><button type="button" class="btn small ghost" id="mFocus">🎯 Zoom to them</button><button type="button" class="btn small danger" id="mDel">🗑️ Delete all</button></div>';
  box.querySelectorAll("[data-dir]").forEach((b) => (b.onclick = () => dupNextTo(b.dataset.dir)));
  box.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { pushUndo(); for (const id of selIds()) { const o = obj(id); o.color = b.dataset.c; rebuild(o); } changed(); }));
  wireSpread(box);
  $("mCopy").onclick = copySel; $("mPaste").onclick = pasteClip; $("mDel").onclick = removeMany;
  $("mFocus").onclick = () => { const b = boxOf(selIds()), c = b.getCenter(new THREE.Vector3()), r = Math.max(8, b.getSize(new THREE.Vector3()).length()); const d = camera.position.clone().sub(orbit.target).normalize(); orbit.target.copy(c); camera.position.copy(c).addScaledVector(d, r); };
}
function spreadBox() {
  return '<div class="group-title">🌲 Spread copies around</div><p class="note">Copies scattered around them, each turned a different way. Great for forests, rocks and crowds.</p>' +
    row("How many", '<input type="number" id="spN" min="1" max="200" value="12">') + row("How far (studs)", '<input type="number" id="spR" min="4" max="500" value="40">') +
    row("Different sizes", '<input type="checkbox" id="spK" checked>') + '<button type="button" class="btn add-script" id="spGo">🌲 Spread them!</button>';
}
function wireSpread(box) {
  box.querySelector("#spGo").onclick = () => spreadCopies(clamp(box.querySelector("#spN").value, 1, 200, 12), clamp(box.querySelector("#spR").value, 4, 500, 40), box.querySelector("#spK").checked);
}
function dropScripts(ids) {
  if (scriptOpen() && ids.has((game.scripts.find((x) => x.id === scriptOpen()) || {}).on)) closeScript();
  game.scripts = game.scripts.filter((x) => !ids.has(x.on));
}

// ---------------------------------------------------------------- scripts
function thingName(id) { const t = obj(id) || guiItem(id); return t ? t.name : ""; }
function addScript(onId) {
  if (!game) return;
  if (game.scripts.length >= MAX_SCRIPTS) { alert("You can have up to " + MAX_SCRIPTS + " scripts."); return; }
  pushUndo();
  const t = onId ? obj(onId) || guiItem(onId) : null;
  const kind = !t ? "game" : t.kind === "label" ? "label" : "part";
  const sc = { id: uid(), name: "Script", on: t ? t.id : "", code: starterCode(kind, t ? t.name : "") };
  game.scripts.push(sc);
  changed();
  editScript(sc.id);
}
function editScript(id) {
  const sc = game.scripts.find((x) => x.id === id);
  if (!sc) return;
  if (playing) playing.stop();
  const t = sc.on ? obj(sc.on) || guiItem(sc.on) : null;
  selScript = id;
  openScript(sc, {
    where: t ? "inside " + t.name + " (me = " + t.name + ")" : "for the whole game",
    kind: !t ? "game" : guiItem(sc.on) ? "gui" : "part",
    errLine: lastErr.get(sc.id) || 0,
    meName: t ? t.name : "",
    things: () => game.objects.map((o) => ({ name: o.name, kind: "part", type: o.type })).concat((game.gui || []).map((g) => ({ name: g.name, kind: "gui", type: g.kind }))),
    onChange() { changed(); },
    onClose() { selScript = null; drawTree(); canvas.focus(); },
  });
  drawTree();
}
function removeScript(id) {
  const sc = game.scripts.find((x) => x.id === id);
  if (!sc || !confirm('Delete the script "' + sc.name + '"?')) return;
  pushUndo();
  if (scriptOpen() === id) closeScript();
  game.scripts = game.scripts.filter((x) => x.id !== id);
  changed(); drawProps();
}

// ---------------------------------------------------------------- the right-click menu
function showMenu(x, y, items) {
  const m = $("ctxMenu");
  m.innerHTML = items.map((it, i) => it === "-" ? '<div class="menu-sec"></div>' : '<button type="button" data-i="' + i + '" class="' + (it.danger ? "danger" : "") + '"><span class="mi">' + it.icon + "</span>" + esc(it.label) + "</button>").join("");
  m.classList.remove("hidden");
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 6) + "px"; m.style.top = Math.min(y, innerHeight - r.height - 6) + "px";
  m.querySelectorAll("button").forEach((b) => (b.onclick = () => { hideMenu(); items[+b.dataset.i].fn(); }));
}
function hideMenu() { $("ctxMenu").classList.add("hidden"); }
document.addEventListener("pointerdown", (e) => { if (!$("ctxMenu").contains(e.target)) hideMenu(); }, true);
window.addEventListener("blur", hideMenu);
function manyMenu(x, y) {
  const n = selIds().length;
  showMenu(x, y, [
    { icon: "⧉", label: "Copies next to them (Ctrl+D)", fn: () => dupNextTo("right") },
    { icon: "🌲", label: "Spread copies around…", fn: () => { const k = prompt("How many copies? (scattered around them, each turned a different way)", "12"); if (k) spreadCopies(clamp(k, 1, 200, 12), Math.max(30, boxOf(selIds()).getSize(new THREE.Vector3()).length() * 1.5), true); } },
    { icon: "📋", label: "Copy " + n + " things (Ctrl+C)", fn: copySel },
    "-", { icon: "🗑️", label: "Delete " + n + " things", danger: true, fn: removeMany },
  ]);
}
function thingMenu(id, x, y) {
  const g = guiItem(id), o = obj(id);
  if (!g && !o) return;
  const items = [
    { icon: "📜", label: "Add Script", fn: () => addScript(id) },
    { icon: "✏️", label: "Rename", fn: () => { select(id); const n = $(g ? "gName" : "pObjName"); if (n) { n.focus(); n.select(); } } },
    { icon: "⧉", label: "Duplicate", fn: () => { select(id); duplicate(); } },
    { icon: "📋", label: "Copy (Ctrl+C)", fn: () => { select(id); copySel(); } },
  ];
  if (o) items.push({ icon: "🌲", label: "Spread copies around…", fn: () => { select(id); const n = prompt("How many copies? (they're scattered around it, each turned a different way)", "12"); if (n) spreadCopies(clamp(n, 1, 200, 12), Math.max(20, Math.max(o.size[0], o.size[2]) * 6), true); } });
  if (o) items.push({ icon: "🎯", label: "Zoom to it", fn: () => { select(id); focusSelected(); } }, { icon: "🎬", label: "Animation…", fn: () => { select(id); openAnimator(o); } }, { icon: "🎞️", label: "Add animation…", fn: () => { select(id); makeAnim(o, null); } },
    { icon: "🌍", label: "Share to the Toolbox…", fn: () => { select(id); openShare(o); } });
  if (g) items.push({ icon: g.visible ? "🙈" : "👁️", label: g.visible ? "Hide at start" : "Show at start", fn: () => { pushUndo(); g.visible = !g.visible; changed(); drawGui(); drawProps(); } });
  items.push("-", { icon: "🗑️", label: "Delete", danger: true, fn: () => { select(id); remove(); } });
  showMenu(x, y, items);
}
function scriptMenu(id, x, y) {
  const sc = game.scripts.find((s2) => s2.id === id);
  if (!sc) return;
  showMenu(x, y, [
    { icon: "📜", label: "Open", fn: () => editScript(id) },
    { icon: "⧉", label: "Duplicate", fn: () => { if (game.scripts.length >= MAX_SCRIPTS) return; pushUndo(); game.scripts.push({ ...sc, id: uid(), name: sc.name + " copy" }); changed(); drawProps(); } },
    "-", { icon: "🗑️", label: "Delete script", danger: true, fn: () => removeScript(id) },
  ]);
}
function focusSelected() {
  const o = obj(selected);
  if (!o) return;
  const b = boundsBox(o);
  const r = Math.max(4, b.h.length() * 2.2);
  const dir = camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(b.c);
  camera.position.copy(b.c).addScaledVector(dir, r);
}

// ---------------------------------------------------------------- Toolbox
function drawCats() {
  $("cats").innerHTML = CATEGORIES.concat(TEX_CAT, "My imports", SHARED).map((c) => '<button type="button" data-cat="' + c + '" class="' + (c === category ? "on" : "") + '">' + c + "</button>").join("");
  $("cats").querySelectorAll("button").forEach((b) => (b.onclick = () => { category = b.dataset.cat; drawCats(); drawAssets(); }));
}
function drawAssets() {
  const q = $("assetSearch").value.trim().toLowerCase();
  if (category === "My imports") return drawImports(q);
  if (category === SHARED) return drawShared(q);
  if (category === TEX_CAT) return drawTextures(q);
  const list = ASSETS.filter((a) => !a.hidden && (category === "All" || a.cat === category) && (!q || (a.label + " " + a.cat).toLowerCase().includes(q)));
  $("assets").innerHTML = list.map((a) => '<div class="asset" draggable="true" data-type="' + a.type + '" title="' + esc(a.label) + '"><span class="ico">' + a.icon + '</span><span class="nm">' + esc(a.label) + "</span></div>").join("") ||
    '<p class="note">No assets match.</p>';
  $("assets").querySelectorAll(".asset[data-type]").forEach((el) => {
    el.onclick = () => addAsset(el.dataset.type);
    el.ondragstart = (e) => { e.dataTransfer.setData("text/gv-asset", el.dataset.type); e.dataTransfer.effectAllowed = "copy"; };
  });
}
$("assetSearch").oninput = drawAssets;
// 🧱 Textures: drag one onto a part (or click it to put it on what's selected). Your own pictures are here too.
function drawTextures(q) {
  const pics = myFiles.filter((f) => f.kind === "image" && (!q || f.name.toLowerCase().includes(q)));
  $("assets").innerHTML = '<p class="note tex-note">Drag a texture onto a block, or click one to put it on what\'s selected. You can also drag a picture from your computer right onto a block.</p>' +
    Object.entries(TEXTURES).filter(([, t]) => !q || t.label.toLowerCase().includes(q)).map(([k, t]) => '<div class="asset tex-tile" draggable="true" data-tex="' + k + '" title="' + esc(t.label) + '"><span class="ico"><img alt="" src="' + texturePicture(k) + '"></span><span class="nm">' + esc(t.label) + "</span></div>").join("") +
    pics.map((f) => '<div class="asset tex-tile" draggable="true" data-tex="f:' + f.id + '" title="' + esc(f.name) + '"><span class="ico"><img alt="" src="' + esc(fileUrl(f.id)) + '"></span><span class="nm">' + esc(f.name) + "</span></div>").join("") +
    '<div class="asset import-tile" id="texImp" title="Use a picture from your computer as a texture"><span class="ico">📥</span><span class="nm">Your own picture…</span></div>' +
    '<div class="asset import-tile" id="texOff" title="Take the texture off what\'s selected"><span class="ico">🚫</span><span class="nm">No texture</span></div>';
  $("assets").querySelectorAll("[data-tex]").forEach((el) => {
    el.ondragstart = (e) => { e.dataTransfer.setData("text/gv-tex", el.dataset.tex); e.dataTransfer.effectAllowed = "copy"; };
    el.onclick = () => { const ids = selIds(); if (!ids.length) { toast("Select a block first (or drag the texture onto it)."); return; } const f = myFiles.find((x) => "f:" + x.id === el.dataset.tex); if (f) useFile(f); setTexture(ids, el.dataset.tex); };
  });
  $("texImp").onclick = () => pickFile(async (file) => { const rec = await importIt(file); if (!rec || rec.kind !== "image") { if (rec) alert("That's a 3D model. Pick a picture (PNG or JPG)."); return; } useFile(rec); await refreshFiles(); drawTextures(""); if (selIds().length) setTexture(selIds(), "f:" + rec.id); }, ".png,.jpg,.jpeg,.webp,.gif");
  $("texOff").onclick = () => { if (selIds().length) setTexture(selIds(), ""); };
}
function texSelect(o) {
  const pics = myFiles.filter((f) => f.kind === "image"), cur = o.tex || "";
  const fid = cur.startsWith("f:") ? cur.slice(2) : "";
  return '<select id="pTex"><option value="">None</option>' + Object.entries(TEXTURES).map(([k, t]) => '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + t.icon + " " + esc(t.label) + "</option>").join("") +
    pics.map((f) => '<option value="f:' + f.id + '"' + ("f:" + f.id === cur ? " selected" : "") + ">🖼️ " + esc(f.name) + "</option>").join("") +
    (fid && !pics.some((f) => f.id === fid) ? '<option value="' + cur + '" selected>🖼️ ' + esc((game.files[fid] || {}).name || "Picture") + "</option>" : "") +
    '<option value="+">📥 Your own picture…</option></select>';
}
function texturable(o) { const a = BY_TYPE[o.type]; return !!a && o.type !== "model" && o.type !== "picture" && o.type !== "monster"; }
function setTexture(ids, tex) {
  const list = ids.map(obj).filter((o) => o && texturable(o));
  if (!list.length) { toast("Textures go on blocks, balls, ramps, walls and other parts."); return; }
  pushUndo();
  for (const o of list) {
    if (tex && !o.tex && o.type !== "baseplate") o.color = "#ffffff"; // (so you see the texture's own colors; change the color after to tint it)
    if (tex && tex.startsWith("f:") && o.tex !== tex) o.texFit = "stretch"; // (your own picture: one copy per side, like a poster; switch to Repeat in Properties)
    if (tex) o.tex = tex; else { delete o.tex; delete o.texS; delete o.texFit; }
    rebuild(o);
  }
  changed(); drawProps();
  toast(tex ? "🧱 Texture on " + list.length + " thing" + (list.length === 1 ? "" : "s") + "!" : "Texture taken off.");
}
function drawImports(q) {
  const list = myFiles.filter((f) => !q || f.name.toLowerCase().includes(q));
  $("assets").innerHTML = '<div class="asset import-tile" id="impTile" title="Bring in a 3D model or a picture from your computer"><span class="ico">📥</span><span class="nm">Import…</span></div>' +
    list.map((f) => '<div class="asset" data-file="' + f.id + '" title="' + esc(f.name) + " (" + (f.size / 1048576).toFixed(1) + ' MB) · right-click to delete"><span class="ico">' + (f.kind === "model" ? "📦" : '<img alt="" src="' + esc(fileUrl(f.id)) + '">') + '</span><span class="nm">' + esc(f.name) + "</span></div>").join("") +
    (myFiles.length ? "" : '<p class="note">Import 3D models (.glb .fbx .obj) or pictures (.png .jpg) from your computer. They wait here for any game.</p>');
  $("impTile").onclick = () => pickFile((f) => importAndPlace(f));
  $("assets").querySelectorAll("[data-file]").forEach((el) => {
    const f = myFiles.find((x) => x.id === el.dataset.file);
    el.onclick = () => placeFile(f);
    el.oncontextmenu = (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, [{ icon: "➕", label: "Add to my game", fn: () => placeFile(f) },
      "-", { icon: "🗑️", label: "Delete from My imports", danger: true, fn: async () => { if (!confirm('Delete "' + f.name + '" from My imports? Games already using it will show a red box.')) return; await deleteFile(f.id); await refreshFiles(); } }]); };
  });
}
// 🌍 Shared: things players shared with everyone (relay share.js). Click one to add it (its scripts, Animation settings
// and imported model come along); right-click to report it, or delete your own.
async function drawShared(q, fresh) {
  const box = $("assets");
  if (fresh || !shared || Date.now() - sharedAt > 60000) {
    box.innerHTML = '<p class="note">Loading things players shared…</p>';
    const r = await api("/hub/shared", {}).catch(() => ({ ok: false }));
    if (category !== SHARED) return;
    if (!r.ok) { box.innerHTML = '<p class="note">Couldn\'t reach GunnerVerse. Check your internet and try again.</p>'; return; }
    shared = r.items || []; sharedAt = Date.now();
  }
  const me = account(), mine = (it) => me && it.by.toLowerCase() === me.u.toLowerCase();
  const list = shared.filter((it) => !q || (it.name + " " + it.by + " " + ((BY_TYPE[it.type] || {}).label || "")).toLowerCase().includes(q));
  box.innerHTML = '<p class="note shared-note">Made by players, for everyone! Share yours: right-click a thing in your game › 🌍 Share to the Toolbox.</p>' +
    list.map((it) => '<div class="asset shared-tile" data-sid="' + esc(it.id) + '" title="' + esc(it.name) + " by " + esc(it.by) + " · added " + (it.uses || 0) + ' times · right-click for more"><span class="ico"><img alt="" loading="lazy" src="' + esc(RELAY + "/hub/sthumb/" + it.id) + '"></span><span class="nm">' + esc(it.name) + '</span><span class="by">' + (mine(it) ? "by you" : "by " + esc(it.by)) + "</span></div>").join("") +
    (list.length ? "" : '<p class="note">' + (q ? "Nothing shared matches." : "Nothing shared yet. Be the first!") + "</p>");
  box.querySelectorAll("[data-sid]").forEach((el) => {
    const it = shared.find((x) => x.id === el.dataset.sid);
    el.onclick = () => addShared(it);
    el.oncontextmenu = (e) => {
      e.preventDefault();
      const items = [{ icon: "➕", label: "Add to my game", fn: () => addShared(it) }, "-"];
      if (mine(it)) items.push({ icon: "🗑️", label: "Stop sharing it", danger: true, fn: async () => { if (!confirm('Stop sharing "' + it.name + '"? Games that already use it keep their copy.')) return; const r = await api("/hub/unshare", { t: me.t, id: it.id }).catch(() => ({ ok: false })); if (r.ok) drawShared(q, true); else alert("Couldn't remove it. Try again."); } });
      else items.push({ icon: "🚩", label: "Report it", fn: async () => { if (!me) { alert("Sign in on the home page first."); return; } const why = prompt('What\'s wrong with "' + it.name + '"?', ""); if (why == null) return; const r = await api("/hub/share-report", { t: me.t, id: it.id, why }).catch(() => ({ ok: false })); alert(r.ok ? "Thanks! The developer will look at it." : "Couldn't send the report. Try again."); } });
      showMenu(e.clientX, e.clientY, items);
    };
  });
}
async function addShared(it, at) {
  if (!game || !it) return;
  toast("🌍 Getting " + it.name + "…");
  const r = await api("/hub/shared-get", { id: it.id }).catch(() => ({ ok: false }));
  if (!r.ok || !r.thing || !r.thing.objects || !r.thing.objects[0]) { toast(""); alert(r.e === "nothing" ? "That one isn't shared anymore." : "Couldn't get it. Check your internet."); return; }
  const t = r.thing;
  game.files = game.files || {};
  for (const [fid, f] of Object.entries(t.files || {})) if (!game.files[fid] && f && f.sid) game.files[fid] = { name: f.name, type: f.type, sid: f.sid };
  useFiles(game.files);
  const src = sanitize({ objects: t.objects.slice(0, 1) }).objects[0];
  if (!src) { toast(""); return; }
  const { id: _id, pos: _pos, ...extra } = src;
  const o = addAsset(src.type, at, { ...extra, name: String(it.name || src.name).slice(0, 40) });
  if (o && Array.isArray(t.scripts)) {
    for (const sc of t.scripts) if (game.scripts.length < MAX_SCRIPTS && typeof sc.code === "string") game.scripts.push({ id: uid(), name: String(sc.name || "Script").slice(0, 40), on: o.id, code: sc.code.slice(0, 20000) });
    changed(); drawTree(); drawProps();
  }
  toast("✓ " + it.name + " added!", 2);
}
// A little picture of one thing, for its Shared Toolbox tile.
async function thingPicture(o) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  const sc = new THREE.Scene(); sc.background = new THREE.Color("#1a1530");
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, -6); sc.add(sun);
  const copy = buildObject({ ...JSON.parse(JSON.stringify(o)), pos: [0, 0, 0], rot: [0, 0, 0] }); sc.add(copy);
  for (let i = 0; i < 30 && copy.userData.inner.userData.model && !copy.userData.inner.userData.copy; i++) await new Promise((ok) => setTimeout(ok, 100)); // (imported models load first)
  const R = Math.max(...o.size), cam = new THREE.PerspectiveCamera(35, 1, 0.01, 5000);
  cam.position.set(R * 1.3, o.size[1] * 0.7 + R * 0.5, -R * 1.9); cam.lookAt(0, o.size[1] * 0.45, 0);
  r.render(sc, cam);
  const url = cv.toDataURL("image/jpeg", 0.8);
  r.dispose(); r.forceContextLoss();
  return url;
}
const SHARE_ERR = { signin: "Sign in on the home page first (it's free).", banned: "This account can't share things.", name: "Give it a name first!", thing: "That thing can't be shared.",
  toobig: "It's too big to share (its scripts are very long).", thumb: "The picture didn't work. Try again.", toomany: "You've shared 40 things already. Stop sharing one first (right-click it in 🌍 Shared).",
  slowdown: "That's a lot of sharing! Try again in a little while.", net: "Couldn't reach GunnerVerse. Check your internet." };
async function openShare(o) {
  if (!game || !o) return;
  const me = account(), scs = scriptsOf(o.id);
  openModal('<h2>🌍 Share to the Toolbox</h2><p>Everyone on GunnerVerse will see it in Toolbox › 🌍 Shared and can add it to their games. Keep it nice, and don\'t put your real name or where you live in it.</p>' +
    '<div class="share-row"><img id="shPic" alt="" class="share-pic"><div>' +
    '<label class="field"><span>Name</span><input type="text" id="shName" maxlength="30" value="' + esc(o.name) + '"></label>' +
    (scs.length ? '<label class="mon-check"><input type="checkbox" id="shScripts" checked> Share its ' + scs.length + " script" + (scs.length === 1 ? "" : "s") + " too</label>" : "") +
    (o.file ? '<p class="note">Its imported file goes along so others can use it.</p>' : "") +
    "</div></div><p class=\"err\" id=\"shErr\">" + (me ? "" : esc(SHARE_ERR.signin)) + "</p>" +
    '<div class="modal-actions"><button class="btn" id="shCancel" type="button">Cancel</button><button class="btn go" id="shGo" type="button"' + (me ? "" : " disabled") + ">🌍 Share it</button></div>");
  $("shCancel").onclick = closeModal;
  let pic = "";
  thingPicture(o).then((u) => { pic = u; if ($("shPic")) $("shPic").src = u; }).catch(() => {});
  $("shGo").onclick = async () => {
    const name = $("shName").value.trim(), go = $("shGo");
    if (name.length < 2) { $("shErr").textContent = SHARE_ERR.name; return; }
    go.disabled = true; $("shErr").textContent = "";
    try {
      if (!pic) pic = await thingPicture(o);
      const ids = o.file && game.files && game.files[o.file] ? [o.file] : [];
      if (ids.length) { await uploadFiles(game, me, ids, (t) => { go.textContent = t; }); saveNow(true); }
      go.textContent = "Sharing…";
      const files = Object.fromEntries(ids.map((id) => [id, game.files[id]]));
      const scripts = $("shScripts") && $("shScripts").checked ? scs.map((s) => ({ id: s.id, name: s.name, on: o.id, code: s.code })) : [];
      const r = await api("/hub/share", { t: me.t, name, thumb: pic, thing: { objects: [o], scripts, files } }).catch(() => ({ ok: false, e: "net" }));
      if (!r.ok) throw new Error(SHARE_ERR[r.e] || "Couldn't share it. Try again.");
      closeModal();
      shared = null; category = SHARED; drawCats(); drawAssets();
      toast("✓ Shared! Everyone can find it in Toolbox › 🌍 Shared.", 4);
    } catch (err) { $("shErr").textContent = err.message; go.disabled = false; go.textContent = "🌍 Share it"; }
  };
}
async function refreshFiles() { myFiles = await listFiles(); await loadPictures(Object.fromEntries(myFiles.map((f) => [f.id, f]))); if (category === "My imports") drawAssets(); }

// ---------------------------------------------------------------- importing models + pictures (files.js)
function pickFile(then, accept) {
  const inp = $("fileIn");
  inp.accept = accept || ACCEPT;
  inp.value = "";
  inp.onchange = () => { if (inp.files && inp.files[0]) then(inp.files[0]); };
  inp.click();
}
function toast(text, secs) { // (a message that goes away by itself, unless it's still working on something…)
  const t = $("toast"); t.textContent = text; t.classList.toggle("hidden", !text); clearTimeout(toast.tm);
  secs = secs || (/…$/.test(text) ? 0 : 3);
  if (secs) toast.tm = setTimeout(() => t.classList.add("hidden"), secs * 1000);
}
async function importIt(file) {
  toast("📥 Importing " + file.name + "…");
  try { const rec = await importFile(file); await refreshFiles(); toast("✓ " + rec.name + " imported! It's in Toolbox > My imports.", 3); return rec; }
  catch (err) { toast(""); alert(err.message || "That file couldn't be imported."); return null; }
}
async function importAndPlace(file, at) { const rec = await importIt(file); if (rec) await placeFile(myFiles.find((f) => f.id === rec.id) || rec, at); return rec; }
function useFile(f) { game.files = game.files || {}; if (!game.files[f.id]) game.files[f.id] = { name: f.name, type: f.type }; noteFile(f.id, f.type); }
async function placeFile(f, at) {
  if (!game || !f) return;
  useFile(f);
  if (f.kind === "model" || isModel(f.type)) {
    let size = [4, 5, 4];
    try { size = await startSize(f.id, f.type); } catch { alert("That model couldn't be opened."); return; }
    addAsset("model", at, { file: f.id, name: f.name, size, solid: true });
  } else {
    const img = new Image(); img.src = fileUrl(f.id);
    await img.decode().catch(() => {});
    const k = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.75;
    addAsset("picture", at, { file: f.id, name: f.name, size: [r2(Math.min(8, 4 / Math.max(k, 0.25))), r2(Math.min(8, 4 / Math.max(k, 0.25)) * k), 0.2] });
  }
}
const view = $("view");
view.addEventListener("dragover", (e) => { const t = [...e.dataTransfer.types]; if (t.includes("text/gv-asset") || t.includes("text/gv-tex") || t.includes("Files")) { e.preventDefault(); view.classList.add("drop-ok"); } });
view.addEventListener("dragleave", () => view.classList.remove("drop-ok"));
view.addEventListener("drop", (e) => {
  view.classList.remove("drop-ok");
  const tex = e.dataTransfer.getData("text/gv-tex");
  if (tex) { // 🧱 a texture dropped on a part (on any of the selected ones: all of them)
    e.preventDefault();
    const h = hitAt(e.clientX, e.clientY);
    if (!h || !h.id || !obj(h.id)) { toast("Drop a texture right onto a block or part."); return; }
    setTexture(many() && selIds().includes(h.id) ? selIds() : [h.id], tex);
    return;
  }
  if (e.dataTransfer.files && e.dataTransfer.files.length) { // a model or picture dropped from the computer
    e.preventDefault();
    const h = hitAt(e.clientX, e.clientY);
    const on = h && h.id && obj(h.id), pics = [...e.dataTransfer.files].filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    if (on && pics.length && texturable(on)) { // (a picture dropped ON a part: it becomes its texture)
      importIt(pics[0]).then((rec) => { if (rec && rec.kind === "image") { useFile(rec); setTexture(many() && selIds().includes(on.id) ? selIds() : [on.id], "f:" + rec.id); refreshFiles().catch(() => {}); } });
      return;
    }
    [...e.dataTransfer.files].slice(0, 5).reduce((p, f) => p.then(() => importAndPlace(f, h ? h.point : null)), Promise.resolve());
    return;
  }
  const type = e.dataTransfer.getData("text/gv-asset");
  if (!BY_TYPE[type]) return;
  e.preventDefault();
  const h = hitAt(e.clientX, e.clientY);
  addAsset(type, h ? h.point : null);
});

// ---------------------------------------------------------------- Explorer
function drawTree() {
  if (!game) return;
  $("objCount").textContent = game.objects.length + " thing" + (game.objects.length === 1 ? "" : "s");
  const scRows = (id, depth) => scriptsOf(id).map((sc) => '<div class="tree-row child script-row d' + depth + (sc.id === selScript ? " on" : "") + '" data-script="' + sc.id + '"><span class="ti">📜</span><span class="tn">' + esc(sc.name) + "</span></div>").join("");
  let html = '<div class="tree-row tree-root' + (selected ? "" : " on") + '" data-id=""><span class="ti">🌐</span><span class="tn">Workspace</span></div>';
  for (const o of game.objects) {
    const a = BY_TYPE[o.type], b = o.b && o.b.k !== "none" ? BEHAVIORS[o.b.k].label.split(" ")[0] : "";
    html += '<div class="tree-row child' + (o.id === selected || extra.has(o.id) ? " on" : "") + '" data-id="' + o.id + '"><span class="ti">' + a.icon + '</span><span class="tn">' + esc(o.name) + "</span>" +
      (b ? '<span class="tb2">' + esc(b) + "</span>" : "") + "</div>" + scRows(o.id, 2);
  }
  html += '<div class="tree-row tree-root gui-root" data-root="gui"><span class="ti">🖥️</span><span class="tn">ScreenGui</span></div>';
  const guiRow = (g, depth) => { const off = hiddenHere(g);
    return '<div class="tree-row child d' + depth + (g.id === selected ? " on" : "") + (g.visible ? "" : " faded") + '" data-id="' + g.id + '"><span class="ti">' + GUI_KINDS[g.kind].icon + '</span><span class="tn">' + esc(g.name) + "</span>" +
    (g.visible ? "" : '<span class="tb2">hidden</span>') +
    '<button type="button" class="tree-eye' + (off ? " off" : "") + '" data-eye="' + g.id + '" title="' + (off ? "Show it on my screen again" : "Hide it on my screen while I build (the game doesn't change)") + '">' + (off ? "🙈" : "👁️") + "</button></div>" + scRows(g.id, depth + 1); };
  for (const g of (game.gui || []).filter((x) => !x.parent)) {
    html += guiRow(g, 1);
    for (const k of game.gui.filter((x) => x.parent === g.id)) html += guiRow(k, 2);
  }
  if (!(game.gui || []).length) html += '<div class="tree-row child tree-empty">Add GUI from ＋ Add</div>';
  html += '<div class="tree-row tree-root" data-root="scripts"><span class="ti">📜</span><span class="tn">Game Scripts</span><button type="button" class="tree-add" id="addGameScript" title="Add a script for the whole game">＋</button></div>' + scRows("", 1);
  $("tree").innerHTML = html;
  $("tree").querySelectorAll(".tree-row[data-id]").forEach((r) => {
    r.onclick = (e) => { if ((e.shiftKey || e.ctrlKey || e.metaKey) && r.dataset.id) toggleSel(r.dataset.id); else select(r.dataset.id || null); };
    r.ondblclick = () => { if (r.dataset.id) { select(r.dataset.id); focusSelected(); } };
    r.oncontextmenu = (e) => { e.preventDefault(); if (r.dataset.id) { select(r.dataset.id); thingMenu(r.dataset.id, e.clientX, e.clientY); } else showMenu(e.clientX, e.clientY, [{ icon: "📜", label: "Add Game Script", fn: () => addScript("") }]); };
  });
  $("tree").querySelectorAll(".tree-row[data-script]").forEach((r) => {
    r.onclick = () => editScript(r.dataset.script);
    r.oncontextmenu = (e) => { e.preventDefault(); scriptMenu(r.dataset.script, e.clientX, e.clientY); };
  });
  const gr = $("tree").querySelector('[data-root="gui"]');
  gr.oncontextmenu = (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, Object.entries(GUI_KINDS).map(([k, v]) => ({ icon: v.icon, label: "Add " + v.label, fn: () => addGui(k) }))); };
  $("addGameScript").onclick = (e) => { e.stopPropagation(); addScript(""); };
  $("tree").querySelectorAll("[data-eye]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.eye; setHiddenHere([id], !hideHere.has(id)); }));
  const on = $("tree").querySelector(".tree-row.on.child");
  if (on) on.scrollIntoView({ block: "nearest" });
}

// ---------------------------------------------------------------- Properties
function row(label, inner) { return '<div class="row"><label>' + label + "</label>" + inner + "</div>"; }
function xyz(key, v, step) { return '<div class="xyz">' + [0, 1, 2].map((i) => '<input type="number" step="' + step + '" data-k="' + key + '" data-i="' + i + '" value="' + v[i] + '" aria-label="' + key + " " + "xyz"[i] + '">').join("") + "</div>"; }
function drawProps(numbersOnly) {
  const box = $("props");
  if (guiItem(selected)) { if (!numbersOnly) drawGuiProps(box, guiItem(selected)); return; }
  const o = obj(selected);
  if (numbersOnly && o) { // (while dragging: just refresh the numbers)
    box.querySelectorAll("input[data-k]").forEach((inp) => { if (inp !== document.activeElement) inp.value = o[inp.dataset.k][+inp.dataset.i]; });
    return;
  }
  if (many()) { if (!numbersOnly) drawManyProps(box); return; }
  if (!o) {
    $("propsFor").textContent = "Workspace";
    const s = game.settings;
    box.innerHTML = '<p class="note">Settings for your whole game. Click something in the world or the Explorer to change it.</p>' +
      row("Game name", '<input type="text" id="pName" maxlength="40" value="' + esc(game.name) + '">') +
      row("Sky", '<select id="pSky">' + Object.entries(SKIES).map(([k, v]) => '<option value="' + k + '"' + (k === s.sky ? " selected" : "") + ">" + v + "</option>").join("") + "</select>") +
      '<div class="group-title">Players</div>' +
      row("Walk speed", '<input type="number" id="pWalk" min="4" max="60" value="' + s.walk + '">') +
      row("Jump power", '<input type="number" id="pJump" min="5" max="80" value="' + s.jump + '">') +
      row("Gravity", '<input type="number" id="pGrav" min="10" max="200" value="' + s.gravity + '">') +
      '<div class="group-title">Tips</div><p class="note">Add a Spawn Point so players know where to start, some Coins to collect, and a Finish Line to win. Press ▶ Play to try it.</p>' +
      scriptBox("");
    const set = (key, v) => { pushUndo(); game.settings[key] = v; changed(true); };
    $("pName").onchange = (e) => { game.name = e.target.value.trim() || "My Game"; $("gameName").value = game.name; changed(true); };
    $("pSky").onchange = (e) => { set("sky", e.target.value); world.setSky(e.target.value, true); };
    $("pWalk").onchange = (e) => set("walk", clamp(e.target.value, 4, 60, 14));
    $("pJump").onchange = (e) => set("jump", clamp(e.target.value, 5, 80, 26));
    $("pGrav").onchange = (e) => set("gravity", clamp(e.target.value, 10, 200, 70));
    wireScriptBox("");
    return;
  }
  const a = BY_TYPE[o.type];
  $("propsFor").textContent = o.name;
  const beh = BEHAVIORS[o.b.k] || BEHAVIORS.none;
  let html = row("Name", '<input type="text" id="pObjName" maxlength="40" value="' + esc(o.name) + '">') +
    '<div class="group-title">Place</div>' +
    row("Position", xyz("pos", o.pos, SNAPS[snapIndex] || 0.1)) + row("Rotation", xyz("rot", o.rot, 15)) + row("Size", xyz("size", o.size, 0.5)) +
    '<div class="group-title">Look</div>' +
    row("Color", '<input type="color" id="pColor" value="' + o.color + '">') +
    '<div class="row"><span></span><div class="swatches">' + SWATCHES.map((c) => '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join("") + "</div></div>" +
    row("Material", '<select id="pMat">' + MATERIALS.map(([k, v]) => '<option value="' + k + '"' + (k === o.mat ? " selected" : "") + ">" + v + "</option>").join("") + "</select>") +
    (texturable(o) ? row("Texture", texSelect(o)) + (o.tex ? row("Texture fit", '<select id="pTexFit"><option value="">🔁 Repeat (tiles)</option><option value="stretch"' + (o.texFit === "stretch" ? " selected" : "") + ">↔️ Stretch (one per side)</option></select>") +
      (o.texFit === "stretch" ? "" : row("Texture size", '<input type="number" id="pTexS" min="0.25" max="64" step="0.5" value="' + (o.texS || 4) + '" title="How many studs one copy of the texture covers (smaller = more, tinier bricks)">')) : "") : "") +
    row("Solid", '<input type="checkbox" id="pSolid"' + (o.solid ? " checked" : "") + ' title="Players bump into it">') +
    row("See-through", seeRow("pTransp", o.transp)) +
    row("Visible", '<input type="checkbox" id="pVisible"' + (o.visible ? " checked" : "") + ' title="Shown in Play (invisible walls are handy!)">') +
    row("Clear while building", '<input type="checkbox" id="pXray"' + (o.xray ? " checked" : "") + ' title="See and click through it in the studio (great for ceilings and roofs). It looks normal when you Play.">');
  if (a.text || o.b.k === "npc") html += row("Text", '<textarea id="pText" maxlength="120">' + esc(o.text || "") + "</textarea>");
  html += '<div class="group-title">Behavior</div>' +
    row("Does", '<select id="pBeh">' + Object.entries(BEHAVIORS).map(([k, v]) => '<option value="' + k + '"' + (k === o.b.k ? " selected" : "") + ">" + v.label + "</option>").join("") + "</select>");
  if (beh.note) html += '<p class="note">' + esc(beh.note) + "</p>";
  for (const [key, label, kind] of beh.params || []) {
    const v = o.b[key];
    if (kind === "number") html += row(label, '<input type="number" data-b="' + key + '" value="' + v + '">');
    else if (kind === "check") html += row(label, '<input type="checkbox" data-b="' + key + '"' + (v ? " checked" : "") + ">");
    else if (kind === "axis") html += row(label, '<select data-b="' + key + '">' + [["x", "Left / right"], ["z", "Forward / back"], ["y", "Up / down"]].map(([k2, t]) => '<option value="' + k2 + '"' + (k2 === v ? " selected" : "") + ">" + t + "</option>").join("") + "</select>");
    else if (kind === "target") html += row(label, targetSelect('data-b="' + key + '"', v, o.id, "any"));
    else if (kind === "how") html += row(label, '<select data-b="' + key + '">' + Object.entries(SWITCH_HOW).map(([k2, t]) => '<option value="' + k2 + '"' + (k2 === v ? " selected" : "") + ">" + t + "</option>").join("") + "</select>");
    else html += row(label, '<input type="text" maxlength="60" data-b="' + key + '" value="' + esc(v) + '">');
  }
  if (o.type === "model") html += '<div class="group-title">Imported model</div>' + row("Animation", '<select id="pAnim"><option value="">(none)</option>' + (o.anim ? '<option value="' + esc(o.anim) + '" selected>' + esc(o.anim === "*" ? "First animation" : o.anim) + "</option>" : "") + "</select>") +
    '<p class="note">' + esc((game.files[o.file] || {}).name || "Missing file") + ". Scripts can play animations too: me.play(\"Walk\")</p>";
  if (o.type === "picture") html += '<div class="group-title">Picture</div>' + row("Picture", pictureSelect("pPic", o.file));
  if (o.type === "monster") html += '<div class="group-title">Monster</div><p class="note">' + esc(o.text || "A monster") + '</p>';
  const mo = motionOf(o);
  html += '<div class="group-title">Animation</div><p class="note">' + (mo ? (GAITS[mo.g].icon + " " + esc(GAITS[mo.g].label) + " · " + IDLES[mo.i].icon + " " + esc(IDLES[mo.i].label) + " · " + esc(WHEN[mo.w])) : "No animation yet. Any thing can walk, dance, wave, hop…") + "</p>" +
    '<button type="button" class="btn add-script" id="pAnimate">🎬 Animation…</button>' +
    row("Walls stop it", '<input type="checkbox" id="pBump"' + (bumps(o) ? " checked" : "") + ' title="When a script moves it, it bumps into walls and stands on floors instead of going through">');
  html += myAnimsProps(o);
  html += monsterProps(o);
  html += '<div class="group-title">Asset</div><p class="note">' + a.icon + " " + esc(a.label) + " · " + esc(a.cat) + "</p>" + scriptBox(o.id);
  box.innerHTML = html;
  wireScriptBox(o.id);
  if ($("pAnim")) {
    animationNames(o.file).then((names) => {
      const sel = $("pAnim"); if (!sel) return;
      sel.innerHTML = '<option value="">(none)</option>' + (names.length ? '<option value="*">▶ First animation</option>' : "") + names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + "</option>").join("");
      sel.value = o.anim || "";
      if (!names.length) sel.insertAdjacentHTML("beforeend", "<option disabled>This model has no animations</option>");
    });
    $("pAnim").onchange = (e) => edit(() => { if (e.target.value) o.anim = e.target.value; else delete o.anim; }, true);
  }
  if ($("pTex")) $("pTex").onchange = (e) => {
    const v = e.target.value;
    if (v === "+") { e.target.value = o.tex || ""; pickFile(async (file) => { const rec = await importIt(file); if (rec && rec.kind === "image") { useFile(rec); await refreshFiles(); setTexture([o.id], "f:" + rec.id); } else if (rec) alert("That's a 3D model. Pick a picture (PNG or JPG)."); }, ".png,.jpg,.jpeg,.webp,.gif"); return; }
    const f = myFiles.find((x) => "f:" + x.id === v); if (f) useFile(f);
    setTexture([o.id], v);
  };
  if ($("pTexS")) $("pTexS").onchange = (e) => { pushUndo(); o.texS = clamp(e.target.value, 0.25, 64, 4); rebuild(o); changed(); };
  if ($("pTexFit")) $("pTexFit").onchange = (e) => { pushUndo(); for (const x of (many() ? selIds().map(obj) : [o]).filter((x) => x && x.tex)) { if (e.target.value) x.texFit = "stretch"; else delete x.texFit; rebuild(x); } changed(); drawProps(); };
  $("pAnimate").onclick = () => openAnimator(o);
  wireMyAnims(o);
  $("pBump").onchange = (e) => { pushUndo(); if (e.target.checked === (o.type === "monster" || !!o.chase)) delete o.bump; else o.bump = e.target.checked; changed(); };
  if ($("pPic")) wirePicture($("pPic"), o.file, (id) => edit(() => { o.file = id; }, true));
  wireMonsterProps(o);

  const edit = (fn, look) => { pushUndo(); fn(); if (look) rebuild(o); else placeObject(groups.get(o.id), o); changed(); };
  $("pObjName").onchange = (e) => { pushUndo(); o.name = e.target.value.trim() || a.label; $("propsFor").textContent = o.name; changed(); };
  box.querySelectorAll("input[data-k]").forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.k, i = +inp.dataset.i;
      let v = Number(inp.value); if (!Number.isFinite(v)) { inp.value = o[k][i]; return; }
      if (k === "size") v = Math.max(0.1, Math.min(1024, v));
      edit(() => { o[k][i] = r2(v); }, k === "size");
    };
  });
  const colorSet = (c) => edit(() => { o.color = c; }, true);
  $("pColor").onchange = (e) => colorSet(e.target.value);
  box.querySelectorAll(".swatches button").forEach((b) => (b.onclick = () => { colorSet(b.dataset.c); $("pColor").value = b.dataset.c; }));
  $("pMat").onchange = (e) => edit(() => { o.mat = e.target.value; }, true);
  $("pSolid").onchange = (e) => { pushUndo(); o.solid = e.target.checked; changed(); };
  $("pVisible").onchange = (e) => { pushUndo(); o.visible = e.target.checked; changed(); };
  $("pXray").onchange = (e) => { pushUndo(); if (e.target.checked) o.xray = true; else delete o.xray; rebuild(o); changed(); };
  wireSee("pTransp", (v) => edit(() => { if (v > 0) o.transp = v; else delete o.transp; }, true));
  if ($("pText")) $("pText").onchange = (e) => edit(() => { o.text = e.target.value.slice(0, 120); }, true);
  $("pBeh").onchange = (e) => { pushUndo(); o.b = { k: e.target.value }; fillBehavior(o); if (o.b.k === "npc" && o.text == null) o.text = "Hi!"; rebuild(o); changed(); drawProps(); };
  box.querySelectorAll("[data-b]").forEach((inp) => {
    inp.onchange = () => {
      pushUndo();
      const key = inp.dataset.b;
      o.b[key] = inp.type === "checkbox" ? inp.checked : inp.type === "number" ? clamp(inp.value, -1000, 1000, 0) : inp.value.slice(0, 60);
      changed();
      if (o.b.k === "light") rebuild(o);
    };
  });
}
// The See-through slider (0 = solid color, 100 = invisible).
function seeRow(id, v) { return '<div class="see-row"><input type="range" id="' + id + '" min="0" max="100" step="5" value="' + (v || 0) + '"><span id="' + id + 'N">' + (v || 0) + "%</span></div>"; }
function wireSee(id, set) {
  const r = $(id);
  r.oninput = () => { $(id + "N").textContent = r.value + "%"; };
  r.onchange = () => set(+r.value);
}
// A <select> of things to point at (Switch targets, button targets). what: any / gui / part / camera
function targetSelect(attr, v, self, what) {
  const opt = (id, label) => '<option value="' + id + '"' + (id === v ? " selected" : "") + ">" + esc(label) + "</option>";
  let html = "<select " + attr + ">" + opt("", "(pick one)");
  if (what === "any" || what === "part" || what === "camera") {
    const parts = game.objects.filter((o) => o.id !== self && (what !== "camera" || o.type === "camera"));
    html += '<optgroup label="' + (what === "camera" ? "Security Cameras" : "Parts") + '">' + parts.map((o) => opt(o.id, BY_TYPE[o.type].icon + " " + o.name)).join("") + "</optgroup>";
    if (what === "camera" && !parts.length) html += "<option disabled>Add a Security Camera first (Toolbox > Gameplay)</option>";
  }
  if (what === "any" || what === "gui") html += '<optgroup label="GUI">' + (game.gui || []).filter((g) => g.id !== self).map((g) => opt(g.id, GUI_KINDS[g.kind].icon + " " + g.name)).join("") + "</optgroup>";
  return html + "</select>";
}
// Imported pictures to choose from (+ import a new one).
function pictureSelect(id, v) {
  const pics = myFiles.filter((f) => f.kind === "image");
  return '<select id="' + id + '"><option value="">(pick a picture)</option>' + pics.map((f) => '<option value="' + f.id + '"' + (f.id === v ? " selected" : "") + ">" + esc(f.name) + "</option>").join("") +
    (v && !pics.some((f) => f.id === v) ? '<option value="' + v + '" selected>' + esc((game.files[v] || {}).name || "Picture") + "</option>" : "") + '<option value="+">📥 Import a new picture…</option></select>';
}
function wirePicture(sel, cur, set) {
  sel.onchange = () => {
    if (sel.value === "+") { sel.value = cur || ""; pickFile(async (f) => { const rec = await importIt(f); if (rec && rec.kind === "image") { useFile(rec); set(rec.id); drawProps(); } else if (rec) alert("That's a 3D model. Pick a picture (PNG or JPG)."); }, ".png,.jpg,.jpeg,.webp,.gif"); return; }
    const f = myFiles.find((x) => x.id === sel.value);
    if (f) useFile(f);
    set(sel.value);
  };
}
// The scripts inside a thing, and the ＋ Add Script button (at the bottom of Properties).
function scriptBox(id) {
  const list = scriptsOf(id);
  return '<div class="group-title">Scripts</div>' + list.map((sc) => '<button type="button" class="script-chip" data-open="' + sc.id + '">📜 ' + esc(sc.name) + "</button>").join("") +
    '<button type="button" class="btn add-script" id="addScriptBtn">＋ Add Script</button>' +
    '<p class="note">' + (id ? "Scripts make it do anything you want, with JavaScript." : "Game scripts run when the game starts. Use find(\"Name\") to get things.") + "</p>";
}
function wireScriptBox(id) {
  $("addScriptBtn").onclick = () => addScript(id);
  $("props").querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => editScript(b.dataset.open)));
}
function drawGuiProps(box, g) {
  $("propsFor").textContent = g.name;
  const sel = (id, opts, v) => '<select id="' + id + '">' + Object.entries(opts).map(([k, t]) => '<option value="' + k + '"' + (k === v ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select>";
  const frames = game.gui.filter((x) => x.kind === "frame" && x.id !== g.id);
  const sized = g.kind === "frame" || g.kind === "image";
  let html = row("Name", '<input type="text" id="gName" maxlength="40" value="' + esc(g.name) + '">');
  if (g.kind !== "image") html += row(g.kind === "label" ? "Text" : g.kind === "frame" ? "Title" : "Button text", '<input type="text" id="gText" maxlength="60" value="' + esc(g.text) + '">');
  html += row("Shown at start", '<input type="checkbox" id="gVis"' + (g.visible ? " checked" : "") + ' title="Untick to hide it until a button or script opens it">');
  if (g.kind !== "frame" && frames.length) html += row("Inside panel", '<select id="gParent"><option value="">(none)</option>' + frames.map((f) => '<option value="' + f.id + '"' + (f.id === g.parent ? " selected" : "") + ">" + esc(f.name) + "</option>").join("") + "</select>");
  html += '<div class="group-title">Where on the screen</div><p class="note">Drag it on the screen to move it' + (sized ? ". Drag its bottom-right corner to change its size." : ".") + "</p>" +
    row("Across / down", '<div class="xyz two"><input type="number" id="gX" min="0" max="100" step="1" value="' + g.x + '" aria-label="Across %"><input type="number" id="gY" min="0" max="100" step="1" value="' + g.y + '" aria-label="Down %"></div>') +
    '<div class="row"><label>Quick spots</label><div class="spot-grid">' + Object.entries(GUI_SPOTS).map(([k, t]) => '<button type="button" data-spot="' + k + '" title="' + t[2] + '" class="' + (t[0] === g.x && t[1] === g.y ? "on" : "") + '"></button>').join("") + "</div></div>";
  if (sized) html += row("Width / height", '<div class="xyz two"><input type="number" id="gW" min="3" max="100" step="1" value="' + g.w + '" aria-label="Width %"><input type="number" id="gH" min="3" max="100" step="1" value="' + g.h + '" aria-label="Height %"></div>');
  html += '<div class="group-title">Look</div>';
  if (g.kind === "image") html += row("Picture", pictureSelect("gFile", g.file));
  else html += row("Color", '<input type="color" id="gColor" value="' + g.color + '">') +
    '<div class="row"><span></span><div class="swatches">' + SWATCHES.map((c) => '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join("") + "</div></div>";
  if (!sized) html += row("Size", sel("gSize", GUI_SIZES, g.size));
  html += row("See-through", seeRow("gTransp", g.transp));
  if (g.kind === "frame") html += row("✕ close button", '<input type="checkbox" id="gClose"' + (g.close ? " checked" : "") + ">");
  if (g.kind === "button") {
    html += '<div class="group-title">When clicked</div>' + row("Does", sel("gAction", BUTTON_ACTIONS, g.action));
    if (g.action === "message") html += row("Message", '<input type="text" id="gMsg" maxlength="80" value="' + esc(g.message) + '">');
    if (NEEDS_TARGET[g.action]) html += row(NEEDS_TARGET[g.action], targetSelect('id="gTarget"', g.target, g.id, g.action));
    if (g.action === "gui") html += '<p class="note">Tip: make a Panel, untick "Shown at start", and this button opens it!</p>';
  }
  if (g.kind === "devmenu") {
    html += '<div class="group-title">Developer menu</div>' + row("Code", '<input type="text" id="gCode" maxlength="12" value="' + esc(g.code) + '">') +
      '<p class="note">In Play, this button asks for the code. The right code opens the dev menu: fly, super speed, super jump, no lava, teleport to the finish and collect every coin. Anyone who knows the code can use it, so keep it secret!</p>';
  }
  html += scriptBox(g.id);
  box.innerHTML = html;
  wireScriptBox(g.id);
  const set = (fn, redraw) => { pushUndo(); fn(); changed(); drawGui(); if (redraw) drawProps(); };
  $("gName").onchange = (e) => set(() => { g.name = e.target.value.trim() || GUI_KINDS[g.kind].label; $("propsFor").textContent = g.name; });
  if ($("gText")) { $("gText").oninput = (e) => { g.text = e.target.value.slice(0, 60); drawGui(); }; $("gText").onchange = (e) => set(() => { g.text = e.target.value.slice(0, 60); }); }
  $("gVis").onchange = (e) => set(() => { g.visible = e.target.checked; });
  if ($("gParent")) $("gParent").onchange = (e) => set(() => { g.parent = e.target.value; });
  const num = (id, key, lo, hi) => { $(id).onchange = (e) => { const v = clamp(e.target.value, lo, hi, g[key]); set(() => { g[key] = Math.round(v * 10) / 10; }, true); }; };
  num("gX", "x", 0, 100); num("gY", "y", 0, 100);
  if (sized) { num("gW", "w", 3, 100); num("gH", "h", 3, 100); }
  box.querySelectorAll("[data-spot]").forEach((b) => (b.onclick = () => { const t = GUI_SPOTS[b.dataset.spot]; moveGui(g, t[0], t[1]); }));
  if ($("gColor")) {
    $("gColor").onchange = (e) => set(() => { g.color = e.target.value; });
    box.querySelectorAll(".swatches button").forEach((b) => (b.onclick = () => { set(() => { g.color = b.dataset.c; }); $("gColor").value = b.dataset.c; }));
  }
  if ($("gFile")) wirePicture($("gFile"), g.file, (id) => set(() => { g.file = id; }));
  if ($("gSize")) $("gSize").onchange = (e) => set(() => { g.size = e.target.value; });
  wireSee("gTransp", (v) => set(() => { if (v > 0) g.transp = v; else delete g.transp; }));
  if ($("gClose")) $("gClose").onchange = (e) => set(() => { g.close = e.target.checked; });
  if ($("gAction")) $("gAction").onchange = (e) => set(() => { g.action = e.target.value; }, true);
  if ($("gTarget")) $("gTarget").onchange = (e) => set(() => { g.target = e.target.value; });
  if ($("gMsg")) $("gMsg").onchange = (e) => set(() => { g.message = e.target.value.slice(0, 80); });
  if ($("gCode")) $("gCode").onchange = (e) => { const v = e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12); if (!v) { e.target.value = g.code; return; } set(() => { g.code = v; }); e.target.value = v; };
}
// Move a GUI thing (a panel takes what's inside it along).
function moveGui(g, x, y) {
  pushUndo();
  const dx = x - g.x, dy = y - g.y;
  g.x = x; g.y = y;
  if (g.kind === "frame") for (const k of game.gui.filter((k2) => k2.parent === g.id)) { k.x = Math.round(Math.min(100, Math.max(0, k.x + dx)) * 10) / 10; k.y = Math.round(Math.min(100, Math.max(0, k.y + dy)) * 10) / 10; }
  changed(); drawGui(); drawProps();
}

// Drag GUI on the screen: hold and move it anywhere; a panel's / picture's corner handle resizes it.
let gdrag = null;
const guiLayer = $("guiLayer");
guiLayer.addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".gui-item");
  if (!el || e.button !== 0 || playing) return;
  e.preventDefault(); e.stopPropagation();
  const g = guiItem(el.dataset.id);
  if (!g) return;
  const kids = g.kind === "frame" ? game.gui.filter((k) => k.parent === g.id) : [];
  gdrag = { g, el, resize: !!e.target.dataset.handle, x0: e.clientX, y0: e.clientY, rect: guiLayer.getBoundingClientRect(), moved: false,
    kids: kids.map((k) => ({ k, el: guiLayer.querySelector('[data-id="' + k.id + '"]') })) };
  guiLayer.setPointerCapture(e.pointerId);
});
const r1 = (v) => Math.round(v * 10) / 10;
function dragValues(e) {
  const d = gdrag, dx = ((e.clientX - d.x0) / d.rect.width) * 100, dy = ((e.clientY - d.y0) / d.rect.height) * 100, g = d.g;
  if (d.resize) {
    const w = Math.min(100, Math.max(3, g.w + dx)), h = Math.min(100, Math.max(3, g.h + dy));
    return { x: r1(g.x + (w - g.w) / 2), y: r1(g.y + (h - g.h) / 2), w: r1(w), h: r1(h), dx: 0, dy: 0 };
  }
  const x = r1(Math.min(100, Math.max(0, g.x + dx))), y = r1(Math.min(100, Math.max(0, g.y + dy)));
  return { x, y, w: g.w, h: g.h, dx: x - g.x, dy: y - g.y };
}
guiLayer.addEventListener("pointermove", (e) => {
  if (!gdrag) return;
  if (!gdrag.moved && Math.hypot(e.clientX - gdrag.x0, e.clientY - gdrag.y0) < 4) return;
  gdrag.moved = true;
  const v = dragValues(e);
  gdrag.el.style.left = v.x + "%"; gdrag.el.style.top = v.y + "%";
  if (gdrag.resize) { gdrag.el.style.width = v.w + "%"; gdrag.el.style.height = v.h + "%"; }
  for (const { k, el } of gdrag.kids) if (el) { el.style.left = Math.min(100, Math.max(0, k.x + v.dx)) + "%"; el.style.top = Math.min(100, Math.max(0, k.y + v.dy)) + "%"; }
});
guiLayer.addEventListener("pointerup", (e) => {
  if (!gdrag) return;
  const d = gdrag, v = d.moved ? dragValues(e) : null;
  gdrag = null;
  if (!d.moved) { select(d.g.id); return; }
  if (d.resize) { pushUndo(); Object.assign(d.g, { x: v.x, y: v.y, w: v.w, h: v.h }); changed(); select(d.g.id); }
  else { select(d.g.id); moveGui(d.g, v.x, v.y); }
});
guiLayer.addEventListener("contextmenu", (e) => {
  const el = e.target.closest(".gui-item");
  if (!el) return;
  e.preventDefault();
  select(el.dataset.id); thingMenu(el.dataset.id, e.clientX, e.clientY);
});
// The 🖥️ GUI button: a list with a show / hide button for each GUI thing (on your screen only).
$("btnGuiVis").onclick = () => {
  const list = (game && game.gui) || [], r = $("btnGuiVis").getBoundingClientRect();
  if (!list.length) { showMenu(r.left, r.bottom + 4, [{ icon: "＋", label: "No GUI yet. Add some from ＋ Add", fn: () => {} }]); return; }
  const all = list.map((g) => g.id), anyOff = list.some((g) => hideHere.has(g.id));
  const row = (g, pad) => ({ icon: hiddenHere(g) ? "🙈" : "👁️", label: pad + g.name + (hiddenHere(g) ? "  (hidden for me)" : ""), fn: () => { setHiddenHere([g.id], !hideHere.has(g.id)); $("btnGuiVis").click(); } });
  const items = [];
  for (const g of list.filter((x) => !x.parent)) { items.push(row(g, "")); for (const k of list.filter((x) => x.parent === g.id)) items.push(row(k, "   ")); }
  items.push("-", anyOff ? { icon: "👁️", label: "Show all GUI", fn: () => setHiddenHere(all, false) } : { icon: "🙈", label: "Hide all GUI", fn: () => setHiddenHere(all, true) });
  showMenu(r.left, r.bottom + 4, items);
};
function guiVisButton() {
  const n = ((game && game.gui) || []).filter(hiddenHere).length;
  $("btnGuiVis").textContent = "🖥️ GUI" + (n ? " (" + n + " hidden)" : "") + " ▾";
  $("btnGuiVis").classList.toggle("off", n > 0);
  $("btnGuiVis").title = "Show or hide each GUI on your screen while you build";
}
function addGui(kind) {
  if (!game) return;
  game.gui = game.gui || [];
  if (game.gui.length >= MAX_GUI) { alert("You can have up to " + MAX_GUI + " GUI things."); return; }
  pushUndo();
  const g = newGui(kind, game.gui);
  const panel = guiItem(selected);  // (adding while a panel is selected puts it inside the panel)
  if (panel && panel.kind === "frame" && kind !== "frame") { g.parent = panel.id; g.x = panel.x; g.y = panel.y; }
  game.gui.push(g);
  select(g.id);
  changed();
}

// ---------------------------------------------------------------- 🎬 Animation (motion.js) for ANY thing
// Pick a walk style and a standing-still move from the presets; the legs and arms are found by themselves and the
// preview shows it walking or standing. "Walls stop it" (obj.bump) is next to it in Properties.
// ---------------------------------------------------------------- 👾 Monster + 😱 Jump scare for ANY thing (scare.js)
// Tick a box in Properties and the settings show up right there. play.js does the chasing and the scares.
function monsterProps(o) {
  const slide = (k, label, lo, hi, step, v, show) => '<label class="slide"><span>' + label + ": <b data-show=\"" + k + '">' + show(v) + '</b></span><input type="range" data-sl="' + k + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + v + '"></label>';
  const chips = (k, list, v) => '<div class="chips">' + Object.entries(list).map(([key, l]) => '<button type="button" data-chip="' + k + '" data-v="' + key + '" class="' + (key === v ? "on" : "") + '"' + (l.note ? ' title="' + esc(l.note) + '"' : "") + ">" + (l.icon ? l.icon + " " + esc(l.label) : esc(l)) + "</button>").join("") + "</div>";
  const c = o.chase, s = o.scare;
  let html = '<div class="group-title">👾 Monster</div><label class="big-check"><input type="checkbox" id="pChase"' + (c ? " checked" : "") + "> It chases players</label>";
  if (c) html += '<div class="mon-box">' +
    slide("c.sp", "Speed", 1, 40, 0.5, c.sp, (v) => v + (v < 6 ? " (slow)" : v < 15 ? "" : " (fast!)")) +
    slide("c.dmg", "Damage per hit", 0, 100, 5, c.dmg, (v) => (v ? v + " of 100 health" : "none (it just chases)")) +
    '<label class="tick"><input type="checkbox" data-tick="c.see"' + (c.see ? " checked" : "") + "> 👀 Only chases when it can see you (walls hide you; it wanders, then searches where it last saw you)</label>" +
    slide("c.r", c.see ? "It can see you from" : "Starts chasing when you're closer than", 0, 150, 5, c.r, (v) => (v ? v + " studs" : c.see ? "90 studs" : "always chasing")) +
    '<div class="lbl">Sound when it hits</div>' + chips("c.snd", CHASE_SOUNDS, c.snd) +
    '<label class="tick"><input type="checkbox" data-tick="c.face"' + (c.face ? " checked" : "") + "> Turns to face you</label>" +
    '<p class="note">Walls stop it (see Animation above). Pick a walk in 🎬 Animation, its legs and arms move by themselves.</p></div>';
  else html += '<p class="note">Tick it and this hunts the player: speed, damage and more pop up here.</p>';
  html += '<div class="group-title">😱 Jump scare</div><label class="big-check"><input type="checkbox" id="pScare"' + (s ? " checked" : "") + "> Jump scare</label>";
  if (s) html += '<div class="mon-box">' +
    '<div class="lbl">When</div>' + chips("s.when", SCARE_WHEN, s.when) +
    (s.when === "near" ? slide("s.r", "How close", 2, 60, 1, s.r, (v) => v + " studs") : "") +
    '<div class="lbl">Animation</div>' + chips("s.fx", SCARE_FX, s.fx) +
    (s.fx === "mine" ? scareAnimPick(o, s) : "") +
    '<div class="lbl">Flash</div>' + chips("s.flash", FLASHES, s.flash) +
    '<div class="lbl">Sound</div>' + chips("s.snd", SCARE_SOUNDS, s.snd) +
    slide("s.secs", "How long", 0.5, 4, 0.1, s.secs, (v) => v + " s") +
    '<div class="lbl">What jumps out</div>' + pictureSelect("pScarePic", s.pic).replace("(pick a picture)", "This thing itself") +
    '<label class="tick"><input type="checkbox" data-tick="s.hide"' + (s.hide ? " checked" : "") + "> Hidden until it jumps out</label>" +
    '<label class="tick"><input type="checkbox" data-tick="s.again"' + (s.again ? " checked" : "") + "> Every time (not just once)</label>" +
    '<button type="button" class="btn add-script" id="pScareTry">▶ Try it</button></div>';
  else html += '<p class="note">Tick it, pick an animation, and press ▶ Try it.</p>';
  return html;
}
function wireMonsterProps(o) {
  const box = $("props");
  const target = (key) => (key[0] === "c" ? o.chase : o.scare);
  const save = (fn) => { pushUndo(); fn(); if (o.chase) o.chase = sanitizeChase(o.chase); if (o.scare) o.scare = sanitizeScare(o.scare); changed(); };
  $("pChase").onchange = (e) => save(() => {
    if (!e.target.checked) { delete o.chase; return; }
    o.chase = { ...DEFAULT_CHASE };
    if (!o.mo && o.type !== "monster") o.mo = sanitizeMotion({ g: "walk", i: "breathe", w: "move" }); // (so it walks, not slides)
  }) || drawProps();
  $("pScare").onchange = (e) => save(() => { if (e.target.checked) o.scare = { ...DEFAULT_SCARE }; else delete o.scare; }) || (rebuild(o), drawProps());
  box.querySelectorAll("[data-sl]").forEach((inp) => {
    const [w, k] = inp.dataset.sl.split("."), show = box.querySelector('[data-show="' + inp.dataset.sl + '"]');
    inp.oninput = () => { const v = Number(inp.value); target(w)[k] = v; show.textContent = { "c.sp": v + (v < 6 ? " (slow)" : v < 15 ? "" : " (fast!)"), "c.dmg": v ? v + " of 100 health" : "none (it just chases)", "c.r": v ? v + " studs" : o.chase && o.chase.see ? "90 studs" : "always chasing", "s.r": v + " studs", "s.secs": v + " s" }[inp.dataset.sl]; };
    inp.onchange = () => save(() => {});
  });
  box.querySelectorAll("[data-chip]").forEach((b) => (b.onclick = () => {
    const [w, k] = b.dataset.chip.split(".");
    if (w === "s" && k === "fx" && b.dataset.v === "mine" && !(o.anims || []).some((a) => a.when === "scare")) { // (no jump scare animation yet: make one)
      makeAnim(o, null, "scare", (a) => { o.scare.fx = "mine"; o.scare.anim = a.id; o.scare = sanitizeScare(o.scare); });
      return;
    }
    save(() => { target(w)[k] = b.dataset.v; if (w === "s" && k === "fx" && b.dataset.v === "mine" && !(o.anims || []).some((a) => a.id === o.scare.anim)) o.scare.anim = o.anims.find((a) => a.when === "scare").id; });
    drawProps(); if (w === "s" && k === "fx") tryScare(o);
  }));
  if ($("pScareAnim")) $("pScareAnim").onchange = (e) => { save(() => { o.scare.anim = e.target.value; }); tryScare(o); };
  if ($("pScareAnimEdit")) $("pScareAnimEdit").onclick = () => { const a = (o.anims || []).find((x) => x.id === o.scare.anim); makeAnim(o, a || null, "scare", (n) => { o.scare.anim = n.id; }); };
  box.querySelectorAll("[data-tick]").forEach((inp) => (inp.onchange = () => { const [w, k] = inp.dataset.tick.split("."); save(() => { target(w)[k] = inp.checked ? 1 : 0; }); }));
  if ($("pScarePic")) wirePicture($("pScarePic"), o.scare.pic, (id) => { save(() => { o.scare.pic = id; }); drawProps(); });
  if ($("pScareTry")) $("pScareTry").onclick = () => tryScare(o);
}
function tryScare(o) {
  if (!o.scare) return;
  let thing = null;
  try { if (!o.scare.pic) thing = buildObject(o); } catch {}
  playScare(thing, o, o.scare.pic ? fileUrl(o.scare.pic) : null);
}
// ---------------------------------------------------------------- 🎞️ My animations (keyframes: keyanim.js, the maker: animmaker.js)
function myAnimsProps(o) {
  const list = o.anims || [];
  return '<div class="group-title">🎞️ My animations</div>' +
    (list.length ? '<div class="ka-list">' + list.map((a) => '<div class="ka-row"><span><b>' + esc(a.name) + "</b><small>" + esc(animSummary(a, game.gui)) + "</small></span>" +
      '<button type="button" class="btn small" data-ka-edit="' + a.id + '" title="Change it">✏️</button><button type="button" class="btn small" data-ka-del="' + a.id + '" title="Delete it">🗑</button></div>').join("") + "</div>"
      : '<p class="note">Make it move however you want: pose it at different moments and it glides between them. Play it when the game starts, after some seconds, when a button is clicked, when it’s touched…</p>') +
    (list.length < MAX_ANIMS ? '<button type="button" class="btn add-script" id="pAddAnim">＋ Add animation</button>' : "");
}
function wireMyAnims(o) {
  if ($("pAddAnim")) $("pAddAnim").onclick = () => makeAnim(o, null);
  $("props").querySelectorAll("[data-ka-edit]").forEach((b) => (b.onclick = () => makeAnim(o, (o.anims || []).find((a) => a.id === b.dataset.kaEdit))));
  $("props").querySelectorAll("[data-ka-del]").forEach((b) => (b.onclick = () => {
    const a = (o.anims || []).find((x) => x.id === b.dataset.kaDel);
    if (!a || !confirm('Delete the animation "' + a.name + '"?')) return;
    pushUndo(); o.anims = o.anims.filter((x) => x !== a); if (!o.anims.length) delete o.anims;
    if (o.scare && o.scare.fx === "mine" && o.scare.anim === a.id) o.scare.fx = "lunge";
    changed(); drawProps();
  }));
}
// Open the maker; then = extra changes after it's saved (the jump scare picking it).
function makeAnim(o, a, preset, then) {
  if (!a && (o.anims || []).length >= MAX_ANIMS) { alert("A thing can have up to " + MAX_ANIMS + " animations."); return; }
  openAnimMaker(o, a || null, {
    openModal, closeModal, preset, buttons: (game.gui || []).filter((g) => g.kind === "button").map((g) => ({ id: g.id, name: g.name })),
    onSave(n) {
      pushUndo();
      const list = (o.anims || []).filter((x) => x.id !== n.id);
      const i = a ? (o.anims || []).findIndex((x) => x.id === a.id) : -1;
      list.splice(i >= 0 ? i : list.length, 0, n);
      o.anims = sanitizeAnims(list) || undefined; if (!o.anims) delete o.anims;
      if (then) then(n);
      changed(); drawProps();
    },
  });
}
function scareAnimPick(o, s) {
  const list = (o.anims || []);
  return '<div class="ka-scare"><select id="pScareAnim">' + list.map((a) => '<option value="' + a.id + '"' + (a.id === s.anim ? " selected" : "") + ">🎞️ " + esc(a.name) + "</option>").join("") + "</select>" +
    '<button type="button" class="btn small" id="pScareAnimEdit">✏️ Edit</button></div>';
}
function bumps(o) { return typeof o.bump === "boolean" ? o.bump : o.type === "monster" || !!o.chase; }
function openAnimator(o) {
  if (!game || !o) return;
  const had = motionOf(o);
  let mo = { ...(had || { g: "walk", i: "breathe", w: "move", sp: 1 }) }, walking = true;
  const chips = (id, table, key) => '<div class="chips anim-chips" id="' + id + '">' + Object.entries(table).map(([k, v]) => '<button type="button" data-k="' + k + '">' + v.icon + " " + esc(v.label) + "</button>").join("") + "</div>";
  openModal('<h2>🎬 Animation · ' + esc(o.name) + '</h2><p>Pick how it walks and what it does when it stands still. Its legs and arms are found by themselves.</p>' +
    '<div class="mon-grid"><div>' +
    '<div class="anim-label">Walk style</div>' + chips("anWalk", GAITS) +
    '<div class="anim-label">When it stands still</div>' + chips("anIdle", IDLES) +
    '<label class="field"><span>Plays</span><select id="anWhen">' + Object.entries(WHEN).map(([k, v]) => '<option value="' + k + '">' + esc(v) + "</option>").join("") + "</select></label>" +
    '<label class="field"><span>What moves</span><select id="anLimbs">' + Object.entries(LIMBS).map(([k, v]) => '<option value="' + k + '">' + esc(v) + "</option>").join("") + "</select></label>" +
    '<label class="field"><span>Speed <b id="anSpN"></b></span><input type="range" id="anSp" min="0.3" max="3" step="0.1"></label>' +
    '</div><div><div class="mon-stage"><canvas id="anCanvas"></canvas></div>' +
    '<div class="thumb-btns"><button class="btn" type="button" id="anPrevWalk">🚶 Walking</button><button class="btn" type="button" id="anPrevStand">🧍 Standing</button></div>' +
    '<p class="note" id="anFound">Looking for legs and arms…</p></div></div>' +
    '<p class="note">Scripts can change it while you play: me.play("run"), me.play("dance"), me.play("wave"), me.play("stop")</p>' +
    '<div class="modal-actions">' + (had ? '<button class="btn" id="anOff" type="button">No animation</button>' : "") + '<button class="btn" id="anCancel" type="button">Cancel</button><button class="btn go" id="anGo" type="button">✓ Use it</button></div>');
  const cv = $("anCanvas");
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, -6); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 4000);
  const copy = buildObject({ ...JSON.parse(JSON.stringify(o)), pos: [0, 0, 0], rot: [0, 0, 0] }), inner = copy.userData.inner;
  sc.add(copy);
  const R = Math.max(...o.size), floor = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 40), new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; sc.add(floor);
  cam.position.set(R * 1.1, o.size[1] * 0.75 + R * 0.35, -R * 1.9); cam.lookAt(0, o.size[1] * 0.45, 0);
  let alive = true, found = "";
  const paint = () => {
    $("anWalk").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === mo.g));
    $("anIdle").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === mo.i));
    $("anWhen").value = mo.w; $("anLimbs").value = mo.l || "all"; $("anSp").value = mo.sp; $("anSpN").textContent = mo.sp + "×";
    $("anPrevWalk").classList.toggle("on", walking); $("anPrevStand").classList.toggle("on", !walking);
  };
  $("anWalk").querySelectorAll("button").forEach((b) => (b.onclick = () => { mo.g = b.dataset.k; walking = true; paint(); }));
  $("anIdle").querySelectorAll("button").forEach((b) => (b.onclick = () => { mo.i = b.dataset.k; walking = false; paint(); }));
  $("anWhen").onchange = (e) => { mo.w = e.target.value; paint(); };
  $("anLimbs").onchange = (e) => { if (e.target.value === "all") delete mo.l; else mo.l = e.target.value; paint(); };
  $("anSp").oninput = (e) => { mo.sp = +e.target.value; paint(); };
  $("anPrevWalk").onclick = () => { walking = true; paint(); };
  $("anPrevStand").onclick = () => { walking = false; paint(); };
  function loop() {
    if (!alive || !cv.isConnected) { alive = false; r.dispose(); return; }
    requestAnimationFrame(loop);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w && h && cv.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    const t = performance.now() / 1000;
    copy.rotation.y = Math.sin(t * 0.4) * 0.7;
    animateThing(inner, o.size[1], t, walking ? 1 : 0, { ...mo, w: walking ? "always" : "idle" });
    const c = limbCount(inner), text = (c.legs || c.arms ? "✓ Found " + c.legs + " leg" + (c.legs === 1 ? "" : "s") + " and " + c.arms + " arm" + (c.arms === 1 ? "" : "s") + (c.rig ? " (monster joints)" : "") + ". They move with the walk."
      : inner.userData.model && !inner.userData.copy ? "Loading the model…" : "No legs or arms found, so the whole thing bobs, leans and sways. Imported characters with a skeleton get their legs and arms moved too.");
    if (text !== found) $("anFound").textContent = found = text;
    r.render(sc, cam);
  }
  paint(); loop();
  const done = () => { alive = false; closeModal(); };
  $("anCancel").onclick = done;
  if ($("anOff")) $("anOff").onclick = () => { done(); pushUndo(); delete o.mo; if (o.type === "monster") o.anim = "none"; rebuild(o); changed(); drawProps(); };
  $("anGo").onclick = () => { done(); pushUndo(); o.mo = sanitizeMotion(mo); if (o.type === "monster") o.anim = "auto"; rebuild(o); changed(); drawProps(); };
}

// ---------------------------------------------------------------- the ＋ Add menu (top bar)
const QUICK = ["spawn", "coin", "lava", "jumppad", "checkpoint", "finish", "car", "tree"];
function drawAddMenu() {
  const part = ASSETS.filter((a) => a.cat === "Parts");
  const item = (attr, icon, label) => '<button type="button" ' + attr + '><span class="mi">' + icon + "</span>" + esc(label) + "</button>";
  $("addMenu").innerHTML =
    '<div class="menu-sec">Parts</div>' + part.map((a) => item('data-add="' + a.type + '"', a.icon, a.label)).join("") +
    '<div class="menu-sec">Quick assets</div>' + QUICK.map((t) => item('data-add="' + t + '"', BY_TYPE[t].icon, BY_TYPE[t].label)).join("") +
    '<div class="menu-sec">GUI (on the screen)</div>' + Object.entries(GUI_KINDS).map(([k, v]) => item('data-gui="' + k + '"', v.icon, "Add " + v.label)).join("") +
    '<div class="menu-sec">Scripts</div>' + item('data-script="1"', "📜", "Add Script (to what's selected)") +
    '<div class="menu-sec">From your computer</div>' + item('data-import="1"', "📥", "Import a 3D model or picture…") +
    '<div class="menu-sec"></div>' + item('data-more="1"', "🧰", "All assets (Toolbox)");
  $("addMenu").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    closeAddMenu();
    if (b.dataset.add) addAsset(b.dataset.add);
    else if (b.dataset.gui) addGui(b.dataset.gui);
    else if (b.dataset.script) addScript(selected || "");
    else if (b.dataset.import) pickFile((f) => importAndPlace(f));
    else { category = "All"; drawCats(); $("assetSearch").value = ""; drawAssets(); $("assetSearch").focus(); }
  }));
}
function closeAddMenu() { $("addMenu").classList.add("hidden"); $("btnAdd").classList.remove("on"); }
$("btnAdd").onclick = (e) => { e.stopPropagation(); const open = $("addMenu").classList.toggle("hidden"); $("btnAdd").classList.toggle("on", !open); };
document.addEventListener("click", (e) => { if (!$("addMenu").contains(e.target)) closeAddMenu(); });
document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest(".bar, .toolbox")) e.preventDefault(); });

function clamp(v, lo, hi, d) { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }

// ---------------------------------------------------------------- My games
function openModal(html) { $("modalBox").innerHTML = html; $("modal").classList.remove("hidden"); }
function closeModal() { $("modal").classList.add("hidden"); $("modalBox").innerHTML = ""; $("modalBox").classList.remove("wide"); }
$("modal").addEventListener("click", (e) => { if (e.target === $("modal") && game) closeModal(); });
function openGames(first) {
  saveNow();
  const list = listGames();
  openModal('<h2>' + (first ? "Welcome to GunnerVerse Studio!" : "My games") + "</h2>" +
    "<p>" + (first ? "Pick a starter to build your first game. You can change everything." : "Your games are saved in this browser.") + "</p>" +
    '<div class="templates">' + Object.entries(TEMPLATES).map(([k, t]) => '<div class="template" data-t="' + k + '" role="button" tabindex="0"><span class="ico">' + t.icon + "</span><b>New " + esc(t.label) + "</b><small>" + esc(t.desc) + "</small></div>").join("") + "</div>" +
    (list.length ? '<div class="game-list">' + list.map((g) => '<div class="game-item' + (game && g.id === game.id ? " on" : "") + '"><b>' + esc(g.name) + "</b><small>" + new Date(g.updated).toLocaleDateString() +
      ((loadGame(g.id) || {}).pub ? ' · <span class="pub-tag">🌐 On GunnerVerse</span>' : "") + "</small>" +
      '<button class="btn go" data-open="' + g.id + '">Open</button><button class="btn danger" data-del="' + g.id + '">Delete</button></div>').join("") + "</div>" : "") +
    '<div id="sharedList"></div>' +
    (game ? '<div class="modal-actions"><button class="btn" id="mClose">Close</button></div>' : ""));
  if (account()) myStudios().then((r) => { // (👥 games shared with me)
    const box = $("sharedList"); if (!box || !r.ok || !r.items.length) return;
    const mine = account().u.toLowerCase();
    box.innerHTML = '<h3>👥 Shared games</h3><div class="game-list">' + r.items.map((m) => '<div class="game-item' + (game && game.shared === m.sid ? " on" : "") + '"><b>' + esc(m.name) + "</b><small>" +
      (m.owner === mine ? "You shared it with " + m.members.length + (m.members.length === 1 ? " person" : " people") : "From @" + esc(m.ownerU)) + " · " + new Date(m.updated).toLocaleDateString() + '</small><button class="btn go" data-sh="' + m.sid + '">Open</button></div>').join("") + "</div>";
    box.querySelectorAll("[data-sh]").forEach((b) => (b.onclick = () => { const m = r.items.find((x) => x.sid === b.dataset.sh); if (m) { openSharedGame(m); closeModal(); } }));
  }).catch(() => {});
  $("modalBox").querySelectorAll(".template").forEach((t) => (t.onclick = t.onkeydown = (e) => { if (e.type === "keydown" && e.key !== "Enter") return; openGame(makeGame(t.dataset.t)); dirty = true; saveNow(); closeModal(); }));
  $("modalBox").querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { const g = loadGame(b.dataset.open); if (g) { openGame(g); closeModal(); } }));
  // Delete = gone for good: from this computer AND off GunnerVerse if it was published.
  $("modalBox").querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    const item = listGames().find((x) => x.id === b.dataset.del);
    if (!item) return;
    const pub = (loadGame(item.id) || {}).pub;
    if (!confirm('Delete "' + item.name + '" for good?' + (pub ? " It also comes off GunnerVerse, and its likes and plays are gone." : "") + " This can't be undone.")) return;
    if (pub) {
      const me = account();
      b.disabled = true; b.textContent = "Deleting…";
      const r = me ? await api("/hub/unpublish", { t: me.t, g: pub }).catch(() => null) : null;
      if (!r || (!r.ok && r.e !== "nogame")) {
        b.disabled = false; b.textContent = "Delete";
        if (!confirm(me ? (r && r.e === "notyours" ? "This game was published from a different account, so it can't come off GunnerVerse from here." : "Couldn't reach GunnerVerse to take it down.") + " Delete it from this computer anyway? (It would stay online.)"
          : "You're not signed in, so it can't come off GunnerVerse. Delete it from this computer anyway? (It would stay online.)")) return;
      }
    }
    deleteGame(item.id);
    if (game && game.id === item.id) game = null;
    openGames(!game);
  }));
  if ($("mClose")) $("mClose").onclick = closeModal;
}
function openGame(g) {
  closeScript();
  if (collab) { collab.close(); collab = null; drawPeople([], null); }
  game = sanitize(g);
  useFiles(game.files);
  loadPictures(game.files).then(() => { drawGui(); for (const o of game.objects) if (o.type === "picture") rebuild(o); });
  undoStack = []; redoStack = [];
  selected = null;
  $("gameName").value = game.name;
  world.setSky(game.settings.sky, true);
  rebuildAll();
  const sp = game.objects.find((o) => o.b.k === "spawn");
  orbit.target.set(sp ? sp.pos[0] : 0, 0, sp ? sp.pos[2] : 0);
  camera.position.set(orbit.target.x + 28, 22, orbit.target.z + 34);
  loadHideHere();
  drawTree(); drawProps(); updateButtons();
  $("savedNote").textContent = "Saved ✓";
  try { localStorage.setItem("gv_studio_last", game.id); } catch {}
  if (game.shared) startCollab();
}

// ---------------------------------------------------------------- shared studios (collab.js)
function startCollab() {
  const sid = game.shared;
  collab = connectStudio(sid, {
    scene, camera,
    nameOf: (id) => thingName(id) || "something",
    boundsOf(id) {
      const o = obj(id), g = groups.get(id);
      if (!o || !g) return null;
      const b = boundsBox(o, g.position, g.quaternion);
      return { c: b.c, q: b.q, s: new THREE.Vector3(o.size[0] * g.scale.x, o.size[1] * g.scale.y, o.size[2] * g.scale.z) };
    },
    onWelcome(sg) { // (what GunnerVerse has is the real game: it goes on screen)
      if (!game || game.shared !== sid) return;
      for (const k of ["name", "settings", "objects", "gui", "files", "scripts"]) game[k] = sg[k];
      if (scriptOpen() && !game.scripts.some((x) => x.id === scriptOpen())) closeScript();
      useFiles(game.files);
      loadPictures(game.files).then(() => { drawGui(); for (const o of game.objects) if (o.type === "picture") rebuild(o); });
      undoStack = []; redoStack = []; updateButtons();
      $("gameName").value = game.name;
      if (!playing) { world.setSky(game.settings.sky, true); rebuildAll(); }
      drawTree(); drawProps(); drawGui();
      dirty = true; saveNow();
    },
    onEdit(m) {
      if (!game || game.shared !== sid) return;
      const r = collab.absorb(game, m);
      if (r.base.includes("files")) { useFiles(game.files); loadPictures(game.files).then(() => { drawGui(); for (const o of game.objects) if (o.type === "picture") rebuild(o); }); }
      if (r.base.includes("name")) $("gameName").value = game.name;
      if (!playing) {
        if (r.base.includes("settings")) world.setSky(game.settings.sky, true);
        for (const id of r.gone) { const g = groups.get(id); if (g) { if (transform.object === g) transform.detach(); world.root.remove(g); disposeGroup(g); groups.delete(id); } extra.delete(id); }
        for (const id of r.ids) { const o = obj(id); if (o && !(transform.dragging && (selected === id || extra.has(id)))) rebuild(o); }
        if (selected && !obj(selected) && !guiItem(selected)) select(null);
        else { drawTree(); if (selected && (r.ids.includes(selected) || r.scripts) && !transform.dragging) drawProps(); }
        if (r.base.includes("gui")) drawGui();
      }
      dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1200); // (this browser's copy too)
    },
    onPeople: drawPeople,
    onChat: drawChat,
    onError(e) {
      if (["removed", "stopped", "nostudio", "notinvited"].includes(e)) { // (you keep your own copy of the game)
        toast(e === "removed" ? "You were taken out of this shared game. You keep your own copy." : e === "stopped" ? "The owner stopped sharing this game. You keep your own copy." : "This shared game isn't there anymore. You keep your own copy.", 6);
        if (collab) { collab.close(); collab = null; }
        delete game.shared; dirty = true; saveNow(); drawPeople([], null);
      } else if (e === "signin") { toast("Sign in on the GunnerVerse home page to build this shared game with your friends.", 6); if (collab) { collab.close(); collab = null; } drawPeople([], null); }
    },
    onStatus(t) { $("savedNote").textContent = t; },
  });
}
// Things I imported go up to GunnerVerse first, so the others see them too.
async function collabPush() {
  if (!collab) return;
  const need = Object.keys(game.files || {}).filter((id) => !game.files[id].sid);
  if (need.length && !uploading) {
    const me = account();
    if (me) {
      uploading = true;
      try { await uploadFiles(game, me, need, (t) => toast(t)); toast(""); } catch (err) { toast(String(err.message || err), 6); }
      uploading = false;
      dirty = true; saveNow();
    }
  }
  if (collab) collab.push(game);
}
// The people bar: who this game is shared with, who's here right now (colored) and what they're doing.
let peopleNow = [];
function drawPeople(list, meta) {
  if (list) peopleNow = list;
  const bar = $("collabBar");
  meta = meta || (collab && collab.meta);
  if (!collab || !meta) { bar.classList.add("hidden"); bar.innerHTML = ""; $("chatBox").classList.add("hidden"); return; }
  $("chatBox").classList.remove("hidden");
  const me = account(), mine = me ? me.u.toLowerCase() : "";
  const everyone = [{ u: meta.owner, n: meta.ownerU, owner: true }, ...meta.members].filter((p) => p.u !== mine);
  const chips = everyone.map((p) => {
    const here = peopleNow.find((x) => x.u === p.u);
    return '<span class="pchip' + (here ? " on" : "") + '" title="' + esc(here ? (p.n || p.u) + " is " + here.doing : (p.n || p.u) + " isn't here right now") + '"' + (here ? ' style="--pc:' + here.c + '"' : "") + "><i></i>" + esc(p.n || p.u) + (p.owner ? " 👑" : "") +
      (here ? "<small>" + esc(here.doing) + "</small>" : "") + "</span>";
  }).join("");
  bar.innerHTML = '<button class="pchip share-open" type="button" title="Who this game is shared with">👥 Shared with</button>' + (chips || '<span class="pchip">nobody yet: tap 👥 Share to invite</span>');
  bar.classList.remove("hidden");
  bar.querySelector(".share-open").onclick = openSharing;
}
// 💬 Chat with the people in a shared game (bottom right; click the top to fold it away).
let chatUnread = 0;
function drawChat(lines, fresh) {
  const list = $("chatList");
  if (fresh) list.innerHTML = "";
  const me = account(), mine = me ? me.u.toLowerCase() : "";
  for (const l of lines) {
    const row = document.createElement("p");
    row.innerHTML = '<b style="color:' + esc(l.c || "#fff") + '">' + esc(l.n || l.u) + ":</b> " + esc(l.m);
    list.appendChild(row);
    if (!fresh && l.u !== mine && $("chatBox").classList.contains("closed")) chatUnread++;
  }
  while (list.children.length > 60) list.firstChild.remove();
  list.scrollTop = list.scrollHeight;
  $("chatNew").textContent = chatUnread; $("chatNew").classList.toggle("hidden", !chatUnread);
  if (fresh && !lines.length) list.innerHTML = '<p class="chat-empty">Say hi to the people building with you!</p>';
  else { const e = list.querySelector(".chat-empty"); if (e) e.remove(); }
}
$("chatHead").onclick = () => { const b = $("chatBox"); b.classList.toggle("closed"); if (!b.classList.contains("closed")) { chatUnread = 0; $("chatNew").classList.add("hidden"); $("chatIn").focus(); } };
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const t = $("chatIn").value.trim();
  if (!t || !collab) return;
  if (collab.say(t)) $("chatIn").value = ""; else toast("Not connected yet. Try again in a second.");
};
// 👥 Share: start sharing, invite people by @username, take people out, leave / stop sharing.
async function openSharing() {
  if (!game) return;
  const me = account();
  if (!me) { openModal('<h2>👥 Build together</h2><p>Sign in on the GunnerVerse home page first. Then you can share this game and build it with friends, live.</p><div class="modal-actions"><a class="btn go" href="../#/">Go sign in</a><button class="btn" id="mClose">Close</button></div>'); $("mClose").onclick = closeModal; return; }
  const mine = me.u.toLowerCase();
  if (!game.shared) {
    openModal('<h2>👥 Build together</h2><p>Share <b>' + esc(game.name) + "</b> and invite friends by their @username. Everyone builds the same game at the same time: you see what they change right away, a colored box around what they're working on, and their name.</p>" +
      "<p>It saves on GunnerVerse by itself after every change, so you can open it on any computer.</p>" +
      '<p class="share-err" id="shErr"></p><div class="modal-actions"><button class="btn" id="mClose">Not now</button><button class="btn go" id="shGo">👥 Start sharing</button></div>');
    $("mClose").onclick = closeModal;
    $("shGo").onclick = async () => {
      const b = $("shGo"); b.disabled = true; b.textContent = "Sharing…";
      try {
        const need = Object.keys(game.files || {}).filter((id) => !game.files[id].sid);
        if (need.length) await uploadFiles(game, me, need, (t) => { b.textContent = t; });
      } catch (err) { $("shErr").textContent = String(err.message || err); b.disabled = false; b.textContent = "👥 Start sharing"; return; }
      flushScript();
      const r = await shareStudio(game);
      if (!r.ok) { $("shErr").textContent = STUDIO_ERR[r.e] || "Couldn't share it."; b.disabled = false; b.textContent = "👥 Start sharing"; return; }
      game.shared = r.sid; dirty = true; saveNow();
      startCollab();
      openSharing();
    };
    return;
  }
  const meta = (collab && collab.meta) || (await myStudios().then((r) => (r.items || []).find((x) => x.sid === game.shared)).catch(() => null));
  if (!meta) { openModal('<h2>👥 Build together</h2><p>Connecting to the shared game…</p><div class="modal-actions"><button class="btn" id="mClose">Close</button></div>'); $("mClose").onclick = closeModal; return; }
  const owner = meta.owner === mine;
  const row2 = (p, isOwner) => '<div class="game-item"><b>' + esc(p.n || p.u) + " <small>@" + esc(p.u) + "</small>" + (isOwner ? " 👑" : "") + (p.u === mine ? " (you)" : "") + "</b>" +
    (peopleNow.some((x) => x.u === p.u) ? '<small class="here">● here now</small>' : "") +
    (owner && !isOwner ? '<button class="btn danger" data-rm="' + esc(p.u) + '">Take out</button>' : "") + "</div>";
  const quick = [["gamergunner", "@GamerGunner"]].filter(([u]) => u !== mine && meta.owner !== u && !meta.members.some((x) => x.u === u));
  openModal("<h2>👥 Shared with</h2><p>Everyone here can build this game with you. Changes save by themselves.</p>" +
    '<div class="game-list">' + row2({ u: meta.owner, n: meta.ownerU }, true) + meta.members.map((p) => row2(p, false)).join("") + "</div>" +
    (owner ? '<form class="share-add" id="shAdd"><input id="shUser" maxlength="17" placeholder="@username" autocomplete="off" spellcheck="false" aria-label="Username to invite"><button class="btn go" type="submit">＋ Invite</button></form>' +
      (quick.length ? '<div class="share-quick">Quick add: ' + quick.map(([u, n]) => '<button class="btn" type="button" data-q="' + u + '">＋ ' + n + "</button>").join("") + "</div>" : "") : "") +
    '<p class="share-err" id="shErr"></p><div class="modal-actions">' + (owner ? '<button class="btn danger" id="shStop">Stop sharing</button>' : '<button class="btn danger" id="shLeave">Leave this game</button>') + '<button class="btn" id="mClose">Close</button></div>');
  $("mClose").onclick = closeModal;
  const invite = async (u) => {
    const r = await inviteTo(game.shared, u);
    if (!r.ok) { $("shErr").textContent = STUDIO_ERR[r.e] || "Couldn't invite them."; return; }
    toast("Invited @" + u.replace(/^@/, "") + "! It shows up in their My games.", 5);
    openSharing();
  };
  if (owner) {
    $("shAdd").onsubmit = (e) => { e.preventDefault(); const u = $("shUser").value.trim(); if (u) invite(u); };
    $("modalBox").querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => invite(b.dataset.q)));
    $("modalBox").querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => { const r = await removeFrom(game.shared, b.dataset.rm); if (!r.ok) $("shErr").textContent = STUDIO_ERR[r.e] || "Couldn't do that."; else openSharing(); }));
    $("shStop").onclick = async () => {
      if (!confirm("Stop sharing? Everyone else is taken out (they keep their own copy). Your game stays here.")) return;
      const r = await stopSharing(game.shared);
      if (!r.ok) { $("shErr").textContent = STUDIO_ERR[r.e] || "Couldn't do that."; return; }
      if (collab) { collab.close(); collab = null; }
      delete game.shared; dirty = true; saveNow(); drawPeople([], null); closeModal(); toast("Not shared anymore. It's just yours again.");
    };
  } else $("shLeave").onclick = async () => {
    if (!confirm("Leave this shared game? You keep your own copy, but you won't see the others' changes anymore.")) return;
    const r = await removeFrom(game.shared, mine);
    if (!r.ok) { $("shErr").textContent = STUDIO_ERR[r.e] || "Couldn't do that."; return; }
    if (collab) { collab.close(); collab = null; }
    delete game.shared; dirty = true; saveNow(); drawPeople([], null); closeModal();
  };
}
// A shared game someone invited me to: open my copy of it (or make one).
function openSharedGame(meta) {
  const have = listGames().map((x) => loadGame(x.id)).find((g) => g && g.shared === meta.sid);
  if (have) { openGame(have); return; }
  const g = makeGame("baseplate", meta.name); g.objects = []; g.shared = meta.sid;
  openGame(g); dirty = true; saveNow();
}
$("gameName").onchange = (e) => { if (!game) return; game.name = e.target.value.trim() || "My Game"; e.target.value = game.name; changed(true); if (!selected) drawProps(); };

// ---------------------------------------------------------------- Play test
function play() {
  if (!game || playing) return;
  flushScript(); closeScript(); hideMenu();
  saveNow();
  transform.detach(); selBox.visible = false;
  clearOutput();
  const camSave = { p: camera.position.clone(), t: orbit.target.clone() };
  orbit.enabled = false;
  document.body.classList.add("playing");
  playing = startPlay(world, sanitize(JSON.parse(JSON.stringify(game))), {
    onStop(again) {
      playing = null;
      document.body.classList.remove("playing");
      orbit.enabled = true;
      camera.position.copy(camSave.p); orbit.target.copy(camSave.t);
      world.setSky(game.settings.sky, true);
      rebuildAll();
      canvas.focus();
      if (again) play();
    },
    output,
  });
}

// ---------------------------------------------------------------- the Output box (script errors and print())
function clearOutput() { $("outList").innerHTML = ""; $("output").classList.add("hidden"); lastErr.clear(); }
function output(kind, text, where) {
  const list = $("outList");
  if (list.childElementCount > 200) list.firstChild.remove();
  const sid = where && where.id && game.scripts.some((x) => x.id === where.id) ? where.id : "";
  if (sid && where.line && !lastErr.has(sid)) lastErr.set(sid, where.line);
  list.insertAdjacentHTML("beforeend", '<div class="out-' + kind + '">' + esc(text) + "</div>");
  list.scrollTop = list.scrollHeight;
  $("output").classList.remove("hidden");
  const div = list.lastChild;
  if (sid) { div.title = "Click to open this script"; div.onclick = () => { if (playing) playing.stop(); editScript(sid); }; }
}
$("outClose").onclick = () => $("output").classList.add("hidden");
$("outClear").onclick = () => { $("outList").innerHTML = ""; };

// ---------------------------------------------------------------- toolbar + keys
document.querySelectorAll(".tool").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
$("btnSnap").onclick = () => { snapIndex = (snapIndex + 1) % SNAPS.length; applySnap(); };
$("btnUndo").onclick = undo; $("btnRedo").onclick = redo; $("btnDup").onclick = duplicate; $("btnDel").onclick = remove;
$("btnPlay").onclick = play; $("btnGames").onclick = () => openGames(false); $("btnShare").onclick = openSharing;
$("btnPublish").onclick = () => {
  if (!game) return;
  saveNow();
  openPublish({ game, $, saveNow, openModal, closeModal,
    snapshot() { // the current view without the gizmo and the blue box
      const vis = [selBox.visible, transform.getHelper().visible];
      selBox.visible = false; transform.getHelper().visible = false;
      world.resize(); renderer.render(scene, camera);
      selBox.visible = vis[0]; transform.getHelper().visible = vis[1];
      return canvas;
    } });
};

const keys = new Set();
const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT"); };
window.addEventListener("keydown", (e) => {
  if (playing || !$("modal").classList.contains("hidden")) return;
  if (typing()) { if (e.key === "Escape") document.activeElement.blur(); return; }
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && k === "y") { e.preventDefault(); redo(); return; }
  if (ctrl && k === "d") { e.preventDefault(); duplicate(); return; }
  if (ctrl && k === "c") { e.preventDefault(); copySel(); return; }
  if (ctrl && k === "v") { e.preventDefault(); pasteClip(); return; }
  if (ctrl && k === "a") { e.preventDefault(); selectMany(game.objects.filter((o) => Math.max(o.size[0], o.size[2]) <= 150).map((o) => o.id)); return; }
  if (ctrl && k === "s") { e.preventDefault(); dirty = true; saveNow(); return; }
  if (ctrl) return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); return; }
  if (e.key === "Escape" && !$("addMenu").classList.contains("hidden")) { closeAddMenu(); return; }
  if (e.key === "Escape" && !$("ctxMenu").classList.contains("hidden")) { hideMenu(); return; }
  if (e.key === "F5") { e.preventDefault(); play(); return; }
  if (k === "1") setTool("select"); else if (k === "2") setTool("translate"); else if (k === "3") setTool("rotate"); else if (k === "4") setTool("scale");
  else if (k === "f") focusSelected();
  else if (k === "g") { snapIndex = (snapIndex + 1) % SNAPS.length; applySnap(); }
  else if (e.key === "Escape") select(null);
  else if ("wasdqe".includes(k) && k.length === 1) { keys.add(k); e.preventDefault(); }
  if (e.shiftKey) keys.add("shift");
});
window.addEventListener("keyup", (e) => { keys.delete(e.key.toLowerCase()); if (e.key === "Shift") keys.delete("shift"); });
window.addEventListener("blur", () => keys.clear());

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  world.resize();
  if (playing) { playing.update(dt); renderer.render(scene, camera); return; }
  updateMixers(dt);
  const now = clock.elapsedTime;
  for (const o of game ? game.objects : []) { // (things with animations do their standing-still move while you build)
    const mo = motionOf(o), gr = mo && groups.get(o.id);
    if (gr && gr.userData.inner && !(transform.dragging && selected === o.id)) animateThing(gr.userData.inner, o.size[1], now + (o.pos[0] % 7), 0, mo);
  }
  if (keys.size && !typing()) { // fly the camera
    camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize();
    move.set(0, 0, 0);
    if (keys.has("w")) move.add(fwd); if (keys.has("s")) move.sub(fwd);
    if (keys.has("d")) move.add(right); if (keys.has("a")) move.sub(right);
    if (keys.has("e")) move.y += 1; if (keys.has("q")) move.y -= 1;
    if (move.lengthSq()) { move.normalize().multiplyScalar(dt * (keys.has("shift") ? 90 : 35)); camera.position.add(move); orbit.target.add(move); }
  }
  orbit.update();
  const o = selected && obj(selected);
  if (o && many()) { // (the last one clicked, in a box like the others)
    const g = groups.get(o.id), b = boundsBox(o, g.position, g.quaternion);
    selBox.position.copy(b.c); selBox.quaternion.copy(b.q); selBox.scale.set(o.size[0] * g.scale.x + 0.08, o.size[1] * g.scale.y + 0.08, o.size[2] * g.scale.z + 0.08); selBox.visible = true;
  } else if (o) {
    const g = groups.get(o.id);
    const b = boundsBox(o, g ? g.position : null, g ? g.quaternion : null);
    const sc = g ? g.scale : new THREE.Vector3(1, 1, 1);
    selBox.position.copy(b.c); selBox.quaternion.copy(b.q);
    selBox.scale.set(o.size[0] * (tool === "scale" ? 1 : sc.x) + 0.08, o.size[1] * (tool === "scale" ? 1 : sc.y) + 0.08, o.size[2] * (tool === "scale" ? 1 : sc.z) + 0.08);
    if (tool === "scale" && transform.dragging && dragStartSize) selBox.scale.set(o.size[0] + 0.08, o.size[1] + 0.08, o.size[2] + 0.08);
    selBox.visible = true;
  } else selBox.visible = false;
  // a blue box around each of the others when many are selected
  let bi = 0;
  for (const id of extra) {
    const eo = obj(id), g = groups.get(id); if (!eo || !g) continue;
    let bx = extraBoxes[bi]; if (!bx) { bx = selBox.clone(); scene.add(bx); extraBoxes.push(bx); }
    const b = boundsBox(eo, g.position, g.quaternion);
    bx.position.copy(b.c); bx.quaternion.copy(b.q); bx.scale.set(eo.size[0] * g.scale.x + 0.08, eo.size[1] * g.scale.y + 0.08, eo.size[2] * g.scale.z + 0.08);

    bx.visible = true; bi++;
  }
  for (; bi < extraBoxes.length; bi++) extraBoxes[bi].visible = false;
  world.follow(orbit.target);
  if (collab) { collab.update(); sendPresence(); }
  renderer.render(scene, camera);
}
function sendPresence() {
  const now = performance.now(); if (now - presT < 250) return; presT = now;
  const half = (v) => Math.round(v * 2) / 2;
  const h2 = (($("modal").classList.contains("hidden") ? null : $("modalBox").querySelector("h2")) || {}).textContent || "";
  const a = document.hidden ? "away" : playing ? "play" : transform.dragging ? { translate: "move", rotate: "rotate", scale: "scale" }[tool] : scriptOpen() ? "script" : /monster/i.test(h2) ? "monster" : selected && guiItem(selected) ? "gui" : selected ? "select" : "look";
  const ids = selIds(), sc = scriptOpen() && (game.scripts || []).find((x) => x.id === scriptOpen());
  collab.presence({ s: ids.slice(0, 20), c: camera.position.toArray().map(half), f: orbit.target.toArray().map(half), a, o: sc ? sc.on || "" : selected || "" });
}
setInterval(() => { if (collab) sendPresence(); }, 1000); // (also while play testing / in another tab, when the frame above isn't drawn)

// ---------------------------------------------------------------- start
drawCats(); drawAssets(); drawAddMenu(); applySnap(); updateButtons();
refreshFiles().catch(() => {});
let last = null;
try { last = localStorage.getItem("gv_studio_last"); } catch {}
const g0 = last && loadGame(last);
if (/[?&]new=backrooms\b/.test(location.search)) { openGame(makeGame("backrooms")); dirty = true; saveNow(); history.replaceState(null, "", location.pathname + location.search.replace(/[?&]new=backrooms\b/, "").replace(/^&/, "?")); } // (the link that makes a Backrooms game - game.js BACKROOMS)
else if (g0) openGame(g0);
else { openGame(makeGame("baseplate")); dirty = false; openGames(true); }
frame();
// (handy for testing in the console: GVStudio.tick(60) runs 60 frames even when the tab is in the background)
window.GVStudio = { get game() { return game; }, get playing() { return playing; }, addAsset, select, play, world, addScript, addGui, editScript, placeFile, get myFiles() { return myFiles; }, refreshFiles,
  tick(n, dt) { for (let i = 0; i < (n || 1) && playing; i++) playing.update(dt || 1 / 60); world.resize(); renderer.render(scene, camera); } };
