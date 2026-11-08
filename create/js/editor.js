// GunnerVerse Studio: the editor. Toolbox (free assets) on the left, the 3D world in the middle, Explorer + Properties
// on the right, tools along the top (Select / Move / Rotate / Scale, snap, undo, copy, delete, Play).
// Mouse: left click selects, right-drag looks around, middle-drag pans, wheel zooms; W A S D Q E fly (Shift = faster).
// Games save in this browser by themselves (game.js). Play test lives in play.js.
import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { TransformControls } from "../vendor/TransformControls.js";
import { ASSETS, BY_TYPE, BEHAVIORS, CATEGORIES, MATERIALS } from "./assets.js";
import { createWorld, buildObject, placeObject, boundsBox } from "./world.js";
import { SKIES, TEMPLATES, newObj, fillBehavior, sanitize, listGames, loadGame, saveGame, deleteGame, makeGame, r2 } from "./game.js";
import { startPlay } from "./play.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D2R = Math.PI / 180;
const SWATCHES = ["#ffffff", "#a3a8b0", "#2b2f36", "#e8261c", "#ff7a1a", "#ffc531", "#1fae45", "#13c4c4", "#2f7df6", "#a64bf4", "#ff4fa3", "#8b5a2b"];
const SNAPS = [1, 0.5, 0.25, 0, 2, 4];

// ---------------------------------------------------------------- state
let game = null;
const groups = new Map();      // object id -> THREE.Group in the world
let selected = null;           // the selected object's id
let tool = "select";
let snapIndex = 0;
let undoStack = [], redoStack = [];
let dirty = false, saveTimer = 0, playing = null;
let category = "All";

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

// ---------------------------------------------------------------- objects in the world
function obj(id) { return game.objects.find((o) => o.id === id) || null; }
function rebuild(o) {
  const old = groups.get(o.id);
  if (old) { world.root.remove(old); disposeGroup(old); }
  const g = buildObject(o);
  world.root.add(g);
  groups.set(o.id, g);
  if (selected === o.id && tool !== "select") transform.attach(g);
  return g;
}
function disposeGroup(g) { g.traverse((m) => { if (m.isMesh && m.geometry) m.geometry.dispose(); }); }
function rebuildAll() {
  transform.detach();
  for (const g of groups.values()) { world.root.remove(g); disposeGroup(g); }
  groups.clear();
  for (const o of game.objects) rebuild(o);
  if (selected && !obj(selected)) selected = null;
  select(selected);
}

// ---------------------------------------------------------------- history + saving
function snapshot() { return JSON.stringify({ o: game.objects, s: game.settings }); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 80) undoStack.shift(); redoStack = []; updateButtons(); }
function restore(snap) { const d = JSON.parse(snap); game.objects = d.o; game.settings = d.s; world.setSky(game.settings.sky); rebuildAll(); drawTree(); drawProps(); changed(true); }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateButtons(); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateButtons(); }
function changed(skipTree) {
  dirty = true;
  $("savedNote").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
  if (!skipTree) drawTree();
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!game || !dirty) return;
  const ok = saveGame(game);
  dirty = !ok;
  $("savedNote").textContent = ok ? "Saved ✓" : "Couldn't save!";
  try { localStorage.setItem("gv_studio_last", game.id); } catch {}
}
window.addEventListener("beforeunload", saveNow);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveNow(); });

// ---------------------------------------------------------------- selecting + tools
function select(id) {
  selected = id && obj(id) ? id : null;
  const g = selected && groups.get(selected);
  if (g && tool !== "select") transform.attach(g); else transform.detach();
  drawTree(); drawProps(); updateButtons();
}
function setTool(t) {
  tool = t;
  document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
  if (t !== "select") transform.setMode(t);
  select(selected);
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
}

// Move / rotate / scale with the gizmo.
let dragStartSize = null;
transform.addEventListener("mouseDown", () => { pushUndo(); const o = obj(selected); dragStartSize = o ? o.size.slice() : null; });
transform.addEventListener("objectChange", () => {
  const o = obj(selected), g = groups.get(selected);
  if (!o || !g) return;
  o.pos = [r2(g.position.x), r2(g.position.y), r2(g.position.z)];
  o.rot = [r2(g.rotation.x / D2R), r2(g.rotation.y / D2R), r2(g.rotation.z / D2R)];
  if (tool === "scale" && dragStartSize) o.size = [0, 1, 2].map((i) => r2(Math.max(0.1, dragStartSize[i] * Math.abs(g.scale.getComponent(i)))));
  drawProps(true);
});
transform.addEventListener("mouseUp", () => {
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
  for (const h of hits) { let p = h.object; while (p && !p.userData.id) p = p.parent; if (p) return { id: p.userData.id, point: h.point }; }
  const ground = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ground) ? { id: null, point: ground } : null;
}
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { canvas.focus(); if (e.button === 0) downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (e.button !== 0 || !downAt || playing) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5 || transform.dragging || (transform.axis && transform.object)) return;
  const h = hitAt(e.clientX, e.clientY);
  // (clicking the huge baseplate selects it like anything else; Esc clears)
  select(h && h.id ? h.id : null);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------------------------------------------------------- adding, copying, deleting
function addAsset(type, at) {
  if (!game) return;
  pushUndo();
  let p = at;
  if (!p) { const r = canvas.getBoundingClientRect(); const h = hitAt(r.left + r.width / 2, r.top + r.height / 2); p = h ? h.point : orbit.target.clone(); }
  const s = SNAPS[snapIndex] || 0;
  const snap = (v) => (s ? Math.round(v / s) * s : v);
  const o = newObj(type, [snap(p.x), r2(Math.max(p.y, -1000)), snap(p.z)]);
  // face the camera (vehicles and characters look toward you)
  const yaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) / D2R;
  if (["car", "truck", "kart", "npc", "sign", "door", "finish"].includes(type)) o.rot[1] = r2(Math.round((yaw + 180) / 15) * 15 % 360);
  o.name = uniqueName(o.name);
  game.objects.push(o);
  rebuild(o);
  if (tool === "select") setTool("translate");
  select(o.id);
  changed();
}
function uniqueName(base) {
  const names = new Set(game.objects.map((o) => o.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(base + " " + i)) return base + " " + i;
}
function duplicate() {
  const o = obj(selected);
  if (!o) return;
  pushUndo();
  const c = JSON.parse(JSON.stringify(o));
  c.id = Math.random().toString(36).slice(2, 10);
  c.name = uniqueName(o.name.replace(/ \d+$/, ""));
  c.pos = [r2(o.pos[0] + Math.max(1, Math.min(o.size[0], 8))), o.pos[1], o.pos[2]];
  game.objects.push(c);
  rebuild(c);
  select(c.id);
  changed();
}
function remove() {
  const o = obj(selected);
  if (!o) return;
  pushUndo();
  game.objects = game.objects.filter((x) => x.id !== o.id);
  transform.detach();
  const g = groups.get(o.id); if (g) { world.root.remove(g); disposeGroup(g); groups.delete(o.id); }
  select(null);
  changed();
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
  $("cats").innerHTML = CATEGORIES.map((c) => '<button type="button" data-cat="' + c + '" class="' + (c === category ? "on" : "") + '">' + c + "</button>").join("");
  $("cats").querySelectorAll("button").forEach((b) => (b.onclick = () => { category = b.dataset.cat; drawCats(); drawAssets(); }));
}
function drawAssets() {
  const q = $("assetSearch").value.trim().toLowerCase();
  const list = ASSETS.filter((a) => (category === "All" || a.cat === category) && (!q || (a.label + " " + a.cat).toLowerCase().includes(q)));
  $("assets").innerHTML = list.map((a) => '<div class="asset" draggable="true" data-type="' + a.type + '" title="' + esc(a.label) + '"><span class="ico">' + a.icon + '</span><span class="nm">' + esc(a.label) + "</span></div>").join("") ||
    '<p class="note">No assets match.</p>';
  $("assets").querySelectorAll(".asset").forEach((el) => {
    el.onclick = () => addAsset(el.dataset.type);
    el.ondragstart = (e) => { e.dataTransfer.setData("text/gv-asset", el.dataset.type); e.dataTransfer.effectAllowed = "copy"; };
  });
}
$("assetSearch").oninput = drawAssets;
const view = $("view");
view.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/gv-asset")) { e.preventDefault(); view.classList.add("drop-ok"); } });
view.addEventListener("dragleave", () => view.classList.remove("drop-ok"));
view.addEventListener("drop", (e) => {
  view.classList.remove("drop-ok");
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
  let html = '<div class="tree-row tree-root' + (selected ? "" : " on") + '" data-id=""><span class="ti">🌐</span><span class="tn">Workspace</span></div>';
  for (const o of game.objects) {
    const a = BY_TYPE[o.type], b = o.b && o.b.k !== "none" ? BEHAVIORS[o.b.k].label.split(" ")[0] : "";
    html += '<div class="tree-row child' + (o.id === selected ? " on" : "") + '" data-id="' + o.id + '"><span class="ti">' + a.icon + '</span><span class="tn">' + esc(o.name) + "</span>" +
      (b ? '<span class="tb2">' + esc(b) + "</span>" : "") + "</div>";
  }
  $("tree").innerHTML = html;
  $("tree").querySelectorAll(".tree-row").forEach((r) => {
    r.onclick = () => select(r.dataset.id || null);
    r.ondblclick = () => { if (r.dataset.id) { select(r.dataset.id); focusSelected(); } };
  });
  const on = $("tree").querySelector(".tree-row.on.child");
  if (on) on.scrollIntoView({ block: "nearest" });
}

// ---------------------------------------------------------------- Properties
function row(label, inner) { return '<div class="row"><label>' + label + "</label>" + inner + "</div>"; }
function xyz(key, v, step) { return '<div class="xyz">' + [0, 1, 2].map((i) => '<input type="number" step="' + step + '" data-k="' + key + '" data-i="' + i + '" value="' + v[i] + '" aria-label="' + key + " " + "xyz"[i] + '">').join("") + "</div>"; }
function drawProps(numbersOnly) {
  const box = $("props");
  const o = obj(selected);
  if (numbersOnly && o) { // (while dragging: just refresh the numbers)
    box.querySelectorAll("input[data-k]").forEach((inp) => { if (inp !== document.activeElement) inp.value = o[inp.dataset.k][+inp.dataset.i]; });
    return;
  }
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
      '<div class="group-title">Tips</div><p class="note">Add a Spawn Point so players know where to start, some Coins to collect, and a Finish Line to win. Press ▶ Play to try it.</p>';
    const set = (key, v) => { pushUndo(); game.settings[key] = v; changed(true); };
    $("pName").onchange = (e) => { game.name = e.target.value.trim() || "My Game"; $("gameName").value = game.name; changed(true); };
    $("pSky").onchange = (e) => { set("sky", e.target.value); world.setSky(e.target.value); };
    $("pWalk").onchange = (e) => set("walk", clamp(e.target.value, 4, 60, 14));
    $("pJump").onchange = (e) => set("jump", clamp(e.target.value, 5, 80, 26));
    $("pGrav").onchange = (e) => set("gravity", clamp(e.target.value, 10, 200, 70));
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
    row("Solid", '<input type="checkbox" id="pSolid"' + (o.solid ? " checked" : "") + ' title="Players bump into it">') +
    row("Visible", '<input type="checkbox" id="pVisible"' + (o.visible ? " checked" : "") + ' title="Shown in Play (invisible walls are handy!)">');
  if (a.text || o.b.k === "npc") html += row("Text", '<textarea id="pText" maxlength="120">' + esc(o.text || "") + "</textarea>");
  html += '<div class="group-title">Behavior</div>' +
    row("Does", '<select id="pBeh">' + Object.entries(BEHAVIORS).map(([k, v]) => '<option value="' + k + '"' + (k === o.b.k ? " selected" : "") + ">" + v.label + "</option>").join("") + "</select>");
  if (beh.note) html += '<p class="note">' + esc(beh.note) + "</p>";
  for (const [key, label, kind] of beh.params || []) {
    const v = o.b[key];
    if (kind === "number") html += row(label, '<input type="number" data-b="' + key + '" value="' + v + '">');
    else if (kind === "check") html += row(label, '<input type="checkbox" data-b="' + key + '"' + (v ? " checked" : "") + ">");
    else if (kind === "axis") html += row(label, '<select data-b="' + key + '">' + [["x", "Left / right"], ["z", "Forward / back"], ["y", "Up / down"]].map(([k2, t]) => '<option value="' + k2 + '"' + (k2 === v ? " selected" : "") + ">" + t + "</option>").join("") + "</select>");
    else html += row(label, '<input type="text" maxlength="60" data-b="' + key + '" value="' + esc(v) + '">');
  }
  html += '<div class="group-title">Asset</div><p class="note">' + a.icon + " " + esc(a.label) + " · " + esc(a.cat) + "</p>";
  box.innerHTML = html;

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
  if ($("pText")) $("pText").onchange = (e) => edit(() => { o.text = e.target.value.slice(0, 120); }, true);
  $("pBeh").onchange = (e) => { pushUndo(); o.b = { k: e.target.value }; fillBehavior(o); if (o.b.k === "npc" && o.text == null) o.text = "Hi!"; changed(); drawProps(); };
  box.querySelectorAll("[data-b]").forEach((inp) => {
    inp.onchange = () => {
      pushUndo();
      const key = inp.dataset.b;
      o.b[key] = inp.type === "checkbox" ? inp.checked : inp.type === "number" ? clamp(inp.value, -1000, 1000, 0) : inp.value.slice(0, 60);
      changed();
    };
  });
}
function clamp(v, lo, hi, d) { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }

// ---------------------------------------------------------------- My games
function openModal(html) { $("modalBox").innerHTML = html; $("modal").classList.remove("hidden"); }
function closeModal() { $("modal").classList.add("hidden"); $("modalBox").innerHTML = ""; }
$("modal").addEventListener("click", (e) => { if (e.target === $("modal") && game) closeModal(); });
function openGames(first) {
  saveNow();
  const list = listGames();
  openModal('<h2>' + (first ? "Welcome to GunnerVerse Studio!" : "My games") + "</h2>" +
    "<p>" + (first ? "Pick a starter to build your first game. You can change everything." : "Your games are saved in this browser.") + "</p>" +
    '<div class="templates">' + Object.entries(TEMPLATES).map(([k, t]) => '<div class="template" data-t="' + k + '" role="button" tabindex="0"><span class="ico">' + t.icon + "</span><b>New " + esc(t.label) + "</b><small>" + esc(t.desc) + "</small></div>").join("") + "</div>" +
    (list.length ? '<div class="game-list">' + list.map((g) => '<div class="game-item' + (game && g.id === game.id ? " on" : "") + '"><b>' + esc(g.name) + "</b><small>" + new Date(g.updated).toLocaleDateString() + "</small>" +
      '<button class="btn go" data-open="' + g.id + '">Open</button><button class="btn danger" data-del="' + g.id + '">Delete</button></div>').join("") + "</div>" : "") +
    (game ? '<div class="modal-actions"><button class="btn" id="mClose">Close</button></div>' : ""));
  $("modalBox").querySelectorAll(".template").forEach((t) => (t.onclick = t.onkeydown = (e) => { if (e.type === "keydown" && e.key !== "Enter") return; openGame(makeGame(t.dataset.t)); dirty = true; saveNow(); closeModal(); }));
  $("modalBox").querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { const g = loadGame(b.dataset.open); if (g) { openGame(g); closeModal(); } }));
  $("modalBox").querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const item = listGames().find((x) => x.id === b.dataset.del);
    if (!item || !confirm('Delete "' + item.name + '"? This can\'t be undone.')) return;
    deleteGame(item.id);
    if (game && game.id === item.id) game = null;
    openGames(!game);
  }));
  if ($("mClose")) $("mClose").onclick = closeModal;
}
function openGame(g) {
  game = sanitize(g);
  undoStack = []; redoStack = [];
  selected = null;
  $("gameName").value = game.name;
  world.setSky(game.settings.sky);
  rebuildAll();
  const sp = game.objects.find((o) => o.b.k === "spawn");
  orbit.target.set(sp ? sp.pos[0] : 0, 0, sp ? sp.pos[2] : 0);
  camera.position.set(orbit.target.x + 28, 22, orbit.target.z + 34);
  drawTree(); drawProps(); updateButtons();
  $("savedNote").textContent = "Saved ✓";
  try { localStorage.setItem("gv_studio_last", game.id); } catch {}
}
$("gameName").onchange = (e) => { if (!game) return; game.name = e.target.value.trim() || "My Game"; e.target.value = game.name; changed(true); if (!selected) drawProps(); };

// ---------------------------------------------------------------- Play test
function play() {
  if (!game || playing) return;
  saveNow();
  transform.detach(); selBox.visible = false;
  const camSave = { p: camera.position.clone(), t: orbit.target.clone() };
  orbit.enabled = false;
  document.body.classList.add("playing");
  playing = startPlay(world, sanitize(JSON.parse(JSON.stringify(game))), {
    onStop() {
      playing = null;
      document.body.classList.remove("playing");
      orbit.enabled = true;
      camera.position.copy(camSave.p); orbit.target.copy(camSave.t);
      world.setSky(game.settings.sky);
      rebuildAll();
      canvas.focus();
    },
  });
}

// ---------------------------------------------------------------- toolbar + keys
document.querySelectorAll(".tool").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
$("btnSnap").onclick = () => { snapIndex = (snapIndex + 1) % SNAPS.length; applySnap(); };
$("btnUndo").onclick = undo; $("btnRedo").onclick = redo; $("btnDup").onclick = duplicate; $("btnDel").onclick = remove;
$("btnPlay").onclick = play; $("btnGames").onclick = () => openGames(false);

const keys = new Set();
const typing = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT"); };
window.addEventListener("keydown", (e) => {
  if (playing || !$("modal").classList.contains("hidden")) return;
  if (typing()) { if (e.key === "Escape") document.activeElement.blur(); return; }
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && k === "y") { e.preventDefault(); redo(); return; }
  if (ctrl && k === "d") { e.preventDefault(); duplicate(); return; }
  if (ctrl && k === "s") { e.preventDefault(); dirty = true; saveNow(); return; }
  if (ctrl) return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); return; }
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
  if (o) {
    const g = groups.get(o.id);
    const b = boundsBox(o, g ? g.position : null, g ? g.quaternion : null);
    const sc = g ? g.scale : new THREE.Vector3(1, 1, 1);
    selBox.position.copy(b.c); selBox.quaternion.copy(b.q);
    selBox.scale.set(o.size[0] * (tool === "scale" ? 1 : sc.x) + 0.08, o.size[1] * (tool === "scale" ? 1 : sc.y) + 0.08, o.size[2] * (tool === "scale" ? 1 : sc.z) + 0.08);
    if (tool === "scale" && transform.dragging && dragStartSize) selBox.scale.set(o.size[0] + 0.08, o.size[1] + 0.08, o.size[2] + 0.08);
    selBox.visible = true;
  } else selBox.visible = false;
  world.follow(orbit.target);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- start
drawCats(); drawAssets(); applySnap(); updateButtons();
let last = null;
try { last = localStorage.getItem("gv_studio_last"); } catch {}
const g0 = last && loadGame(last);
if (g0) openGame(g0);
else { openGame(makeGame("baseplate")); dirty = false; openGames(true); }
frame();
// (handy for testing in the console: GVStudio.tick(60) runs 60 frames even when the tab is in the background)
window.GVStudio = { get game() { return game; }, get playing() { return playing; }, addAsset, select, play, world,
  tick(n, dt) { for (let i = 0; i < (n || 1) && playing; i++) playing.update(dt || 1 / 60); world.resize(); renderer.render(scene, camera); } };
