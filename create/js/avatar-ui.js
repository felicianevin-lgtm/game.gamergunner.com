// The AVATAR page on the GunnerVerse home page (#/avatar in site/hub.js loads this file when it's needed): a 3D preview
// you can spin, and tabs of cosmetics (body, face, hair, hats, shirts, pants, face stuff, back, hand) with colors.
// 🎨 Draw: paint your own shirt or pants, pixel by pixel. 🛠️ Build: make your own hats and gear out of shapes
// (your creations wait in this browser, "gv_made"; up to MAX_WORN are worn and go with your avatar).
// Every change saves right away (avatar.js saveAvatar); hub.js also sends it to your account.
import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { TransformControls } from "../vendor/TransformControls.js";
import { buildAvatar, animateAvatar, loadAvatar, saveAvatar, sanitizeAvatar, sanitizeMade, randomAvatar, avatarPicture, DEFAULT_AVATAR, PALETTE,
  TOPS, FACES, HAIR, HATS, EYES, BACK, HAND, BUILDS, ART, DRAW_COLORS, SHAPES, ATTACH, MAX_WORN, MAX_PIECES } from "./avatar.js";

export { avatarPicture, loadAvatar, sanitizeAvatar };

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TABS = [
  { k: "body", icon: "🧍", label: "Body", items: ["build", BUILDS], colors: [["skin", "Skin"]] },
  { k: "face", icon: "😀", label: "Face", items: ["face", FACES] },
  { k: "hair", icon: "💇", label: "Hair", items: ["hair", HAIR], colors: [["hairColor", "Hair color"]] },
  { k: "hat", icon: "🎩", label: "Hats", items: ["hat", HATS], colors: [["hatColor", "Hat color"]] },
  { k: "top", icon: "👕", label: "Shirts", items: ["top", TOPS], colors: [["shirt", "Shirt color"], ["accent", "Design color"]] },
  { k: "pants", icon: "👖", label: "Pants", colors: [["pants", "Pants color"], ["shoes", "Shoe color"]] },
  { k: "eyes", icon: "🕶️", label: "Face stuff", items: ["eyes", EYES] },
  { k: "back", icon: "🎒", label: "Back", items: ["back", BACK], colors: [["accent", "Color"]] },
  { k: "hand", icon: "🗡️", label: "Hand", items: ["hand", HAND] },
  { k: "draw", icon: "🎨", label: "Draw" },
  { k: "make", icon: "🛠️", label: "Build" },
];
const SHAPE_ICON = { box: "🟫", ball: "⚪", cyl: "🛢️", cone: "🔺", dome: "🥣", ring: "⭕", wedge: "📐", star: "⭐", heart: "❤️" };
const MAX_LOCKER = 30;
function loadLocker() { try { const l = JSON.parse(localStorage.getItem("gv_made") || "[]"); return Array.isArray(l) ? l.map((m) => { const s = sanitizeMade(m); return s && { ...s, n: String(m.n || "My cosmetic").slice(0, 24) }; }).filter(Boolean) : []; } catch { return []; } }
function saveLocker(l) { try { localStorage.setItem("gv_made", JSON.stringify(l.slice(0, MAX_LOCKER))); } catch {} }
const newId = () => Math.random().toString(36).slice(2, 10);

// opts = {onChange(avatar)}
export function mountAvatarEditor(box, opts) {
  let av = loadAvatar(), tab = "body";
  box.innerHTML = '<div class="av-wrap"><div class="av-stage"><canvas id="avCanvas" aria-label="Your avatar (drag to spin)"></canvas>' +
    '<div class="av-btns"><button class="btn" type="button" id="avRand">🎲 Random</button><button class="btn ghost" type="button" id="avReset">↺ Start over</button></div>' +
    '<p class="av-note">Drag to spin. Your avatar is you in every game made in GunnerVerse Studio. It saves by itself!</p></div>' +
    '<div class="av-pick"><div class="av-tabs" id="avTabs"></div><div class="av-items" id="avItems"></div></div></div>';
  const canvas = box.querySelector("#avCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-3, 6, -6); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 40), new THREE.MeshStandardMaterial({ color: 0x1fae45, roughness: 0.8 }));
  floor.position.y = -0.1; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const holder = new THREE.Group(); scene.add(holder);
  let model = null, yaw = 0.5, spin = 0.5, drag = null, last = performance.now(), alive = true, t = 0;
  let draft = null, sel = 0; // (🛠️ Build: the cosmetic being made, shown on the avatar until it's saved)
  let zoom = 0; // (0 = whole avatar, 1 = close to the head)
  // 🛠️ Build is a little studio: drag to look around, click a piece to pick it, then drag the arrows / rings / boxes
  // to move, turn or size it (like the Studio's gizmo).
  const orbit = new OrbitControls(camera, canvas);
  orbit.enabled = false; orbit.enableDamping = true; orbit.dampingFactor = 0.15; orbit.minDistance = 1.2; orbit.maxDistance = 14;
  orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  const gizmo = new TransformControls(camera, canvas);
  gizmo.setSize(0.75); gizmo.setSpace("local");
  scene.add(gizmo.getHelper());
  let gizmoMode = "translate", gizmoMesh = null;
  gizmo.addEventListener("dragging-changed", (e) => { orbit.enabled = !!draft && !e.value; });
  gizmo.addEventListener("objectChange", () => { // (the piece follows the gizmo; the sliders follow too)
    const P = draft && draft.b[sel], m = gizmoMesh; if (!P || !m) return;
    const R2 = (v) => Math.round(v * 100) / 100, cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    P.p = [0, 1, 2].map((i) => R2(cl(m.position.getComponent(i), -2.5, 2.5)));
    P.k = [0, 1, 2].map((i) => R2(cl(Math.abs(m.scale.getComponent(i)), 0.05, 3)));
    P.r = ["x", "y", "z"].map((a) => Math.round(m.rotation[a] * 180 / Math.PI));
    syncSliders();
  });
  gizmo.addEventListener("mouseUp", () => { rebuild(); });
  function attachPiece() {
    gizmo.detach(); gizmoMesh = null;
    if (!draft || !model) return;
    let root = null; model.traverse((o) => { if (o.userData.madeI === draft.i) root = o; });
    const m = root && root.children.find((c) => c.userData.piece === sel);
    if (m) { gizmoMesh = m; gizmo.setMode(gizmoMode); gizmo.attach(m); }
  }
  function startStudio() {
    const at = { head: [0, 2.9], body: [0, 1.8], hand: [0.95, 1.2], handL: [-0.95, 1.2] }[draft.a] || [0, 2];
    yaw = 0; holder.rotation.y = 0;
    orbit.target.set(at[0], at[1], 0);
    camera.position.set(at[0] + 2.2, at[1] + 1.1, draft.a === "head" ? -4.2 : -5.5);
    orbit.enabled = true; orbit.update();
  }
  function stopStudio() { gizmo.detach(); gizmoMesh = null; orbit.enabled = false; camera.userData.look = null; }
  let downAt = null; // (a click, not a drag, picks a piece)
  canvas.addEventListener("pointerdown", (e) => { downAt = draft && !gizmo.axis ? { x: e.clientX, y: e.clientY } : null; });
  canvas.addEventListener("pointerup", (e) => {
    if (!draft || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    downAt = null;
    const r = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    for (const h of ray.intersectObject(model, true)) {
      let o = h.object, piece = o.userData.piece;
      while (o && o.userData.madeI == null) o = o.parent;
      if (o && o.userData.madeI === draft.i && piece != null) { sel = piece; attachPiece(); drawItems(); return; }
    }
  });
  function rebuild() {
    if (model) holder.remove(model);
    let show = av;
    if (draft) show = sanitizeAvatar({ ...av, made: [draft].concat((av.made || []).filter((m) => m.i !== draft.i)).slice(0, MAX_WORN) });
    model = buildAvatar(show); holder.add(model);
    if (draft) attachPiece();
    box.querySelector(".av-wrap").classList.toggle("building", !!draft); // (phones: the preview stays on screen while you build)
  }
  function changed() { saveAvatar(av); av = loadAvatar(); rebuild(); if (opts && opts.onChange) opts.onChange(av); }
  canvas.addEventListener("pointerdown", (e) => { if (draft) return; drag = e.clientX; spin = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (drag == null || draft) return; yaw += (e.clientX - drag) * 0.012; drag = e.clientX; });
  canvas.addEventListener("pointerup", () => { drag = null; setTimeout(() => { if (drag == null && !draft) spin = 0.5; }, 1500); });
  const camAt = new THREE.Vector3(), lookAt = new THREE.Vector3();
  function frame(now) {
    if (!alive || !canvas.isConnected) { alive = false; renderer.dispose(); return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio()))) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (draft) { // (the little studio: you move the camera; the avatar stands still so the arrows match)
      orbit.update();
      if (model) { const L = model.userData.limbs; for (const k of ["legL", "legR", "armL", "armR"]) L[k].rotation.set(0, 0, 0); }
      renderer.render(scene, camera);
      return;
    }
    yaw += spin * dt;
    holder.rotation.y = yaw;
    // the camera slides closer to the head while you build a hat
    camAt.set(0, 2.2 + zoom * 0.9, -10 + zoom * 5); lookAt.set(0, 1.75 + zoom * 1.15, 0);
    camera.position.lerp(camAt, Math.min(1, dt * 6)); camera.userData.look = (camera.userData.look || lookAt.clone()).lerp(lookAt, Math.min(1, dt * 6)); camera.lookAt(camera.userData.look);
    if (model) { animateAvatar(model, dt, true, 0); model.userData.limbs.armR.rotation.x = Math.sin(t * 2) * 0.08; }
    renderer.render(scene, camera);
  }
  camera.position.set(0, 2.2, -10);
  requestAnimationFrame(frame);

  function drawTabs() {
    box.querySelector("#avTabs").innerHTML = TABS.map((x) => '<button type="button" data-tab="' + x.k + '" class="' + (x.k === tab ? "on" : "") + '"><span>' + x.icon + "</span>" + esc(x.label) + "</button>").join("");
    box.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => {
      if (draft && b.dataset.tab !== "make" && !confirm("Leave without saving your cosmetic?")) return;
      if (b.dataset.tab !== "make") { draft = null; zoom = 0; stopStudio(); rebuild(); }
      tab = b.dataset.tab; drawTabs(); drawItems();
    }));
  }
  function drawItems() {
    if (tab === "draw") return drawDraw();
    if (tab === "make") return draft ? drawEditor() : drawLocker();
    const T = TABS.find((x) => x.k === tab);
    let html = "";
    if (T.items) {
      const [key, list] = T.items;
      html += '<div class="av-grid">' + Object.entries(list).filter(([k]) => !(key === "top" && k === "draw" && !av.art)).map(([k, label]) => '<button type="button" data-set="' + key + '" data-v="' + k + '" class="' + (av[key] === k ? "on" : "") + '">' +
        (thumbs[key] ? '<img alt="" src="' + thumb(key, k) + '">' : "") + "<span>" + esc(label) + "</span></button>").join("") + "</div>";
      if (key === "top") html += '<p class="av-hint">Want your own design? Paint one in <button type="button" class="linkish" data-go="draw">🎨 Draw</button>.</p>';
    }
    if (tab === "pants" && av.pantsArt) html += '<p class="av-hint">Your pants drawing is on. Change it in <button type="button" class="linkish" data-go="draw">🎨 Draw</button>.</p>';
    if (tab === "hat") html += '<p class="av-hint">Build your own hat in <button type="button" class="linkish" data-go="make">🛠️ Build</button>.</p>';
    html += colorRows(T.colors);
    const box2 = items();
    box2.innerHTML = html;
    box2.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => { av[b.dataset.set] = b.dataset.v; changed(); drawItems(); }));
    wireColors(box2);
  }
  const items = () => box.querySelector("#avItems");
  function colorRows(list) {
    let html = "";
    for (const [key, label] of list || []) {
      html += '<div class="av-colors"><b>' + esc(label) + "</b><div>" + PALETTE.map((c) => '<button type="button" data-color="' + key + '" data-v="' + c + '" class="' + (av[key] === c ? "on" : "") + '" style="background:' + c + '" aria-label="' + c + '"></button>').join("") +
        '<label class="av-more" title="Any color"><input type="color" data-pick="' + key + '" value="' + av[key] + '">🎨</label></div></div>';
    }
    return html;
  }
  function wireColors(el) {
    el.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { av[b.dataset.color] = b.dataset.v; changed(); drawItems(); }));
    el.querySelectorAll("[data-pick]").forEach((inp) => (inp.onchange = () => { av[inp.dataset.pick] = inp.value; changed(); drawItems(); }));
    el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { tab = b.dataset.go; drawTabs(); drawItems(); }));
  }

  // ---------------------------------------------------------------- 🎨 Draw: your own shirt / pants
  let drawOn = "shirt", tool = "pen", ink = 1, brush = 1, mirror = false;
  const undo = [];
  function drawDraw() {
    const key = drawOn === "shirt" ? "art" : "pantsArt";
    let px = (av[key] || "0".repeat(ART * ART)).split("");
    const base = drawOn === "shirt" ? av.shirt : av.pants;
    const B = (k, v, label, on) => '<button type="button" class="chip' + (on ? " on" : "") + '" data-' + k + '="' + v + '">' + label + "</button>";
    items().innerHTML =
      '<div class="dr-top">' + B("on", "shirt", "👕 Shirt", drawOn === "shirt") + B("on", "pants", "👖 Pants", drawOn === "pants") + "</div>" +
      '<div class="dr-wrap"><canvas class="dr-pad" id="drPad" width="' + ART * 12 + '" height="' + ART * 12 + '" aria-label="Drawing pad"></canvas>' +
      '<div class="dr-side"><div class="dr-tools">' + B("tool", "pen", "✏️ Pen", tool === "pen") + B("tool", "erase", "🧽 Eraser", tool === "erase") + B("tool", "fill", "🪣 Fill", tool === "fill") + "</div>" +
      '<div class="dr-tools">' + [1, 2, 3].map((n) => B("brush", n, ["Thin", "Medium", "Thick"][n - 1], brush === n)).join("") + B("mirror", 1, "🪞 Mirror", mirror) + "</div>" +
      '<div class="dr-inks">' + DRAW_COLORS.map((c, i) => (c ? '<button type="button" data-ink="' + i + '" class="' + (ink === i ? "on" : "") + '" style="background:' + c + '" aria-label="' + c + '"></button>' : "")).join("") + "</div>" +
      '<div class="dr-tools"><button type="button" class="chip" id="drUndo">↶ Undo</button><button type="button" class="chip" id="drClear">🗑️ Clear</button></div>' +
      '<p class="av-hint">' + (drawOn === "shirt" ? "Your drawing goes on the front and back of your shirt." : "The left half goes on one leg, the right half on the other.") + " The empty squares show your " + (drawOn === "shirt" ? "shirt" : "pants") + " color.</p></div></div>" +
      colorRows(drawOn === "shirt" ? [["shirt", "Shirt color"]] : [["pants", "Pants color"]]);
    const el = items(), pad = el.querySelector("#drPad"), g = pad.getContext("2d"), S = pad.width / ART;
    function paint() {
      g.fillStyle = base; g.fillRect(0, 0, pad.width, pad.height);
      for (let i = 0; i < px.length; i++) { const c = DRAW_COLORS[parseInt(px[i], 16)]; if (c) { g.fillStyle = c; g.fillRect((i % ART) * S, Math.floor(i / ART) * S, S, S); } }
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1;
      for (let i = 1; i < ART; i++) { g.beginPath(); g.moveTo(i * S + 0.5, 0); g.lineTo(i * S + 0.5, pad.height); g.moveTo(0, i * S + 0.5); g.lineTo(pad.width, i * S + 0.5); g.stroke(); }
      if (drawOn === "pants") { g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 2; g.beginPath(); g.moveTo(pad.width / 2, 0); g.lineTo(pad.width / 2, pad.height); g.stroke(); }
    }
    const val = () => (tool === "erase" ? "0" : ink.toString(16));
    function dot(x, y) {
      const r = brush - 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (r > 1 && dx * dx + dy * dy > r * r + 1) continue;
        for (const xx of mirror ? [x + dx, ART - 1 - x - dx] : [x + dx]) { const yy = y + dy; if (xx >= 0 && yy >= 0 && xx < ART && yy < ART) px[yy * ART + xx] = val(); }
      }
    }
    function fill(x, y) {
      const from = px[y * ART + x], to = val();
      if (from === to) return;
      const stack = [[x, y]];
      while (stack.length) { const [a, b] = stack.pop(); if (a < 0 || b < 0 || a >= ART || b >= ART || px[b * ART + a] !== from) continue; px[b * ART + a] = to; stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
    }
    const cell = (e) => { const r = pad.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width) * ART), Math.floor(((e.clientY - r.top) / r.height) * ART)]; };
    let down = false, lastC = null;
    pad.onpointerdown = (e) => {
      e.preventDefault(); pad.setPointerCapture(e.pointerId);
      undo.push({ key, v: px.join("") }); if (undo.length > 40) undo.shift();
      const [x, y] = cell(e);
      if (tool === "fill") { fill(x, y); if (mirror) fill(ART - 1 - x, y); paint(); commit(); return; }
      down = true; lastC = [x, y]; dot(x, y); paint();
    };
    pad.onpointermove = (e) => {
      if (!down) return;
      const [x, y] = cell(e), [x0, y0] = lastC, n = Math.max(Math.abs(x - x0), Math.abs(y - y0));
      for (let i = 1; i <= n; i++) dot(Math.round(x0 + ((x - x0) * i) / n), Math.round(y0 + ((y - y0) * i) / n));
      lastC = [x, y]; paint();
    };
    pad.onpointerup = pad.onpointercancel = () => { if (!down) return; down = false; commit(); };
    function commit() {
      const s = px.join("");
      if (/[1-9a-f]/.test(s)) { av[key] = s; if (key === "art") av.top = "draw"; }
      else { delete av[key]; if (key === "art" && av.top === "draw") av.top = "plain"; }
      changed();
    }
    el.querySelectorAll("[data-on]").forEach((b) => (b.onclick = () => { drawOn = b.dataset.on; drawItems(); }));
    el.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => { tool = b.dataset.tool; drawItems(); }));
    el.querySelectorAll("[data-brush]").forEach((b) => (b.onclick = () => { brush = Number(b.dataset.brush); drawItems(); }));
    el.querySelectorAll("[data-mirror]").forEach((b) => (b.onclick = () => { mirror = !mirror; drawItems(); }));
    el.querySelectorAll("[data-ink]").forEach((b) => (b.onclick = () => { ink = Number(b.dataset.ink); if (tool === "erase") tool = "pen"; drawItems(); }));
    el.querySelector("#drUndo").onclick = () => { const u = undo.pop(); if (!u) return; if (u.key !== key) { undo.push(u); return; } px = u.v.split(""); paint(); commit(); };
    el.querySelector("#drClear").onclick = () => { if (!confirm("Clear your " + (drawOn === "shirt" ? "shirt" : "pants") + " drawing?")) return; undo.push({ key, v: px.join("") }); px = "0".repeat(ART * ART).split(""); paint(); commit(); };
    wireColors(el);
    paint();
  }

  // ---------------------------------------------------------------- 🛠️ Build: your own cosmetics out of shapes
  // the locker: 🧰 your creations (wear, change, delete, 🌍 publish) and 🌍 everyone's (published by players)
  let shelf = "mine", pub = null, pubAt = 0;
  const signedIn = () => !!(opts && opts.me && opts.me() && opts.me().t);
  const API_ERR = { signin: "Sign in first (top right) to publish.", name: "Give it a name (2 letters or more).", toomany: "You've published 40 things. Remove one first.", slowdown: "Slow down a little, then try again.", banned: "Your account can't publish right now.", thumb: "The picture didn't work. Try again.", thing: "That cosmetic didn't work. Add at least one shape." };
  function smallPic(m) { // (a little picture for everyone's shelf: your avatar wearing it, on a dark square)
    const src = avatarPicture({ ...DEFAULT_AVATAR, made: [m] }, 160, m.a !== "head");
    return new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.fillStyle = "#0b1210"; g.fillRect(0, 0, 128, 128); g.drawImage(i, 0, 0, 128, 128); ok(c.toDataURL("image/jpeg", 0.85)); }; i.onerror = () => ok(""); i.src = src; });
  }
  function drawLocker() {
    const tabs = '<div class="dr-top"><button type="button" class="chip' + (shelf === "mine" ? " on" : "") + '" data-shelf="mine">🧰 Mine</button><button type="button" class="chip' + (shelf === "all" ? " on" : "") + '" data-shelf="all">🌍 Everyone\'s</button></div>';
    if (shelf === "all") return drawEveryone(tabs);
    const locker = loadLocker(), worn = new Set((av.made || []).map((m) => m.i));
    items().innerHTML = tabs + '<p class="av-hint">Make your own hats, horns, wings, swords, anything! Stack shapes, drag them into place, and wear up to ' + MAX_WORN + " at once. 🌍 Publish one so everyone can wear it.</p>" +
      '<div class="av-grid mk-grid"><button type="button" id="mkNew" class="mk-new"><span class="mk-plus">＋</span><span>New cosmetic</span></button>' +
      locker.map((m) => '<div class="mk-item' + (worn.has(m.i) ? " on" : "") + '"><img alt="" src="' + avatarPicture({ ...av, made: [m] }, 96, m.a !== "head") + '"><span>' + esc(m.n) + "</span>" +
        '<div class="mk-acts"><button type="button" class="chip' + (worn.has(m.i) ? " on" : "") + '" data-wear="' + m.i + '">' + (worn.has(m.i) ? "✓ Wearing" : "Wear") + '</button><button type="button" class="chip" data-edit="' + m.i + '" title="Change it">✏️</button><button type="button" class="chip" data-pub="' + m.i + '" title="Publish it for everyone">🌍</button><button type="button" class="chip" data-del="' + m.i + '" title="Delete it">🗑️</button></div></div>').join("") + "</div>";
    const el = items();
    wireShelf(el);
    el.querySelector("#mkNew").onclick = () => {
      if (locker.length >= MAX_LOCKER) { alert("You have " + MAX_LOCKER + " cosmetics. Delete one to make a new one."); return; }
      draft = { i: newId(), n: "My cosmetic", a: "head", b: [{ s: "box", c: "#ffc531", p: [0, 0.6, 0], k: [0.8, 0.3, 0.8], r: [0, 0, 0] }] }; sel = 0; startEdit();
    };
    el.querySelectorAll("[data-wear]").forEach((b) => (b.onclick = () => {
      const m = locker.find((x) => x.i === b.dataset.wear); if (!m) return;
      let made = (av.made || []).filter((x) => x.i !== m.i);
      if (!worn.has(m.i)) { if (made.length >= MAX_WORN) { alert("You can wear " + MAX_WORN + " at once. Take one off first."); return; } made.push({ i: m.i, a: m.a, b: m.b }); }
      av.made = made; changed(); drawItems();
    }));
    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => { const m = locker.find((x) => x.i === b.dataset.edit); if (!m) return; draft = JSON.parse(JSON.stringify(m)); sel = 0; startEdit(); }));
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
      const m = locker.find((x) => x.i === b.dataset.del); if (!m || !confirm('Delete "' + m.n + '"?')) return;
      saveLocker(locker.filter((x) => x.i !== m.i)); av.made = (av.made || []).filter((x) => x.i !== m.i); changed(); drawItems();
    }));
    el.querySelectorAll("[data-pub]").forEach((b) => (b.onclick = async () => {
      const m = locker.find((x) => x.i === b.dataset.pub); if (!m) return;
      if (!signedIn() || !opts.api) { alert(API_ERR.signin); return; }
      const name = prompt("Publish it so everyone can find it in 🌍 Everyone's and wear it.\nWhat's it called?", m.n);
      if (name == null) return;
      b.disabled = true; b.textContent = "…";
      try {
        const r = await opts.api("/hub/share", { t: opts.me().t, kind: "cos", name: name.trim().slice(0, 30), thing: { made: { i: m.i, a: m.a, b: m.b } }, thumb: await smallPic(m) });
        if (r && r.ok) { pub = null; alert("🌍 Published! Everyone can wear it now. (It's in 🌍 Everyone's.)"); }
        else alert(API_ERR[r && r.e] || "That didn't work. Try again in a bit.");
      } catch { alert("Couldn't reach the server. Try again in a bit."); }
      drawItems();
    }));
  }
  function wireShelf(el) { el.querySelectorAll("[data-shelf]").forEach((b) => (b.onclick = () => { shelf = b.dataset.shelf; drawItems(); })); }
  async function drawEveryone(tabs) {
    const el = items();
    if (!opts || !opts.api) { el.innerHTML = tabs + '<p class="av-hint">Everyone\'s cosmetics show up on the GunnerVerse home page.</p>'; wireShelf(el); return; }
    if (!pub || Date.now() - pubAt > 60000) {
      el.innerHTML = tabs + '<p class="av-hint">Loading…</p>'; wireShelf(el);
      try { const r = await opts.api("/hub/shared", { kind: "cos" }); pub = r && r.ok ? r.items : []; pubAt = Date.now(); } catch { pub = null; }
      if (tab !== "make" || draft || shelf !== "all") return;
    }
    const me = opts.me && opts.me(), mine = me ? String(me.u).toLowerCase() : "";
    el.innerHTML = tabs + (!pub ? '<p class="av-hint">Couldn\'t load them. Try again in a bit.</p>' : !pub.length ? '<p class="av-hint">Nobody has published one yet. Be the first: make one in 🧰 Mine and press 🌍!</p>' :
      '<p class="av-hint">Cosmetics players made. Press Get it to put one in your locker (then wear it or change it).</p><div class="av-grid mk-grid">' +
      pub.map((c) => '<div class="mk-item"><img alt="" src="' + esc((opts.relay || "") + "/hub/sthumb/" + c.id) + '"><span>' + esc(c.name) + '</span><small class="mk-by">by @' + esc(c.by) + (c.uses ? " · " + c.uses + " got it" : "") + "</small>" +
        '<div class="mk-acts"><button type="button" class="chip" data-get="' + c.id + '">＋ Get it</button>' + (String(c.by).toLowerCase() === mine ? '<button type="button" class="chip" data-unpub="' + c.id + '" title="Take it down">🗑️</button>' : '<button type="button" class="chip" data-rep="' + c.id + '" title="Report it">🚩</button>') + "</div></div>").join("") + "</div>");
    wireShelf(el);
    el.querySelectorAll("[data-get]").forEach((b) => (b.onclick = async () => {
      const locker = loadLocker();
      if (locker.length >= MAX_LOCKER) { alert("Your locker is full (" + MAX_LOCKER + "). Delete one first."); return; }
      b.disabled = true;
      try {
        const r = await opts.api("/hub/shared-get", { id: b.dataset.get });
        const m = r && r.ok && r.thing && sanitizeMade(r.thing.made);
        if (!m) { alert("That one isn't there anymore."); b.disabled = false; return; }
        locker.unshift({ ...m, i: newId(), n: String(r.card.name || "Cosmetic").slice(0, 24) }); saveLocker(locker);
        b.textContent = "✓ In your locker";
      } catch { alert("Couldn't reach the server. Try again in a bit."); b.disabled = false; }
    }));
    el.querySelectorAll("[data-rep]").forEach((b) => (b.onclick = async () => {
      if (!signedIn()) { alert("Sign in to report."); return; }
      const why = prompt("What's wrong with it? (The GunnerVerse team will look.)", ""); if (why == null) return;
      try { await opts.api("/hub/share-report", { t: opts.me().t, id: b.dataset.rep, why: why.slice(0, 200) }); b.textContent = "✓ Reported"; b.disabled = true; } catch {}
    }));
    el.querySelectorAll("[data-unpub]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Take it down? People who already got it keep theirs.")) return;
      try { await opts.api("/hub/unshare", { t: opts.me().t, id: b.dataset.unpub }); pub = null; drawItems(); } catch {}
    }));
  }
  function startEdit() { spin = 0; zoom = draft.a === "head" ? 1 : 0; rebuild(); startStudio(); attachPiece(); drawItems(); }
  function syncSliders() {
    const P = draft && draft.b[sel]; if (!P) return;
    items().querySelectorAll("[data-sl]").forEach((inp) => { const [, w, i, , , , flip] = SL[Number(inp.dataset.sl)]; inp.value = (flip ? -1 : 1) * P[w][i]; });
  }
  const SL = [ // [label, which list, index, min, max, step, flip]  (the avatar faces -z, so "Front" is -z)
    ["Left ↔ Right", "p", 0, -2.5, 2.5, 0.02, true], ["Down ↔ Up", "p", 1, -2.5, 2.5, 0.02], ["Back ↔ Front", "p", 2, -2.5, 2.5, 0.02, true],
    ["Width", "k", 0, 0.05, 3, 0.01], ["Height", "k", 1, 0.05, 3, 0.01], ["Depth", "k", 2, 0.05, 3, 0.01],
    ["Tip forward", "r", 0, -180, 180, 1, true], ["Turn", "r", 1, -180, 180, 1], ["Lean sideways", "r", 2, -180, 180, 1],
  ];
  function drawEditor() {
    const P = draft.b[sel];
    items().innerHTML =
      '<div class="mk-head"><input id="mkName" maxlength="24" value="' + esc(draft.n) + '" aria-label="Name"><button type="button" class="btn" id="mkSave">✓ Save &amp; wear</button><button type="button" class="btn ghost" id="mkCancel">Cancel</button></div>' +
      '<div class="mk-row mk-modes"><b>Drag on the avatar</b>' + [["translate", "✥ Move"], ["rotate", "⟳ Turn"], ["scale", "⤢ Size"]].map(([k, v]) => '<button type="button" class="chip' + (gizmoMode === k ? " on" : "") + '" data-gm="' + k + '">' + v + "</button>").join("") +
      '<span class="mk-tip">Click a piece to pick it · drag empty space to look around · scroll to zoom</span></div>' +
      '<div class="mk-row"><b>Goes on</b>' + Object.entries(ATTACH).map(([k, v]) => '<button type="button" class="chip' + (draft.a === k ? " on" : "") + '" data-at="' + k + '">' + v + "</button>").join("") + "</div>" +
      '<div class="mk-row"><b>Add a shape</b>' + Object.entries(SHAPES).map(([k, v]) => '<button type="button" class="chip" data-add="' + k + '" title="' + v + '">' + SHAPE_ICON[k] + " " + v + "</button>").join("") + "</div>" +
      '<div class="mk-row"><b>Pieces</b>' + draft.b.map((p, i) => '<button type="button" class="chip piece' + (i === sel ? " on" : "") + '" data-sel="' + i + '"><i style="background:' + p.c + '"></i>' + SHAPE_ICON[p.s] + " " + (i + 1) + "</button>").join("") + "</div>" +
      (P ? '<div class="mk-piece"><div class="av-colors"><b>Color</b><div>' + PALETTE.map((c) => '<button type="button" data-pc="' + c + '" class="' + (P.c === c ? "on" : "") + '" style="background:' + c + '" aria-label="' + c + '"></button>').join("") +
        '<label class="av-more" title="Any color"><input type="color" id="mkPick" value="' + P.c + '">🎨</label></div></div>' +
        '<div class="mk-sliders">' + SL.map(([label, w, i, lo, hi, st, flip], n) => '<label><span>' + label + '</span><input type="range" data-sl="' + n + '" min="' + lo + '" max="' + hi + '" step="' + st + '" value="' + (flip ? -P[w][i] : P[w][i]) + '"></label>').join("") + "</div>" +
        '<div class="mk-row"><label class="tick"><input type="checkbox" id="mkGlow"' + (P.g ? " checked" : "") + '> ✨ Glows</label><label class="tick"><input type="checkbox" id="mkShiny"' + (P.m ? " checked" : "") + "> 🪙 Shiny metal</label></div>" +
        '<div class="mk-row"><button type="button" class="chip" id="mkCopy">⧉ Copy piece</button><button type="button" class="chip" id="mkMirror" title="A copy on the other side (for horns, ears, wings…)">🪞 Mirror copy</button><button type="button" class="chip" id="mkDel">🗑️ Delete piece</button></div></div>'
        : '<p class="av-hint">Add a shape to start.</p>') +
      '<p class="av-hint">Tip: pick "Goes on", then add shapes and slide them into place. Drag the avatar to see every side.</p>';
    const el = items(), redraw = () => { rebuild(); drawItems(); };
    el.querySelector("#mkName").oninput = (e) => { draft.n = e.target.value; };
    el.querySelectorAll("[data-at]").forEach((b) => (b.onclick = () => { draft.a = b.dataset.at; zoom = draft.a === "head" ? 1 : 0; redraw(); startStudio(); }));
    el.querySelectorAll("[data-gm]").forEach((b) => (b.onclick = () => { gizmoMode = b.dataset.gm; gizmo.setMode(gizmoMode); el.querySelectorAll("[data-gm]").forEach((x) => x.classList.toggle("on", x === b)); }));
    el.querySelectorAll("[data-sel]").forEach((b) => (b.ondblclick = () => { sel = Number(b.dataset.sel); attachPiece(); }));
    el.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
      if (draft.b.length >= MAX_PIECES) { alert("A cosmetic can have " + MAX_PIECES + " pieces."); return; }
      const y = draft.a === "head" ? 0.7 : 0, last = draft.b[sel];
      draft.b.push({ s: b.dataset.add, c: last ? last.c : "#ffc531", p: [0, y, draft.a === "body" ? 0.5 : 0], k: [0.4, 0.4, 0.4], r: [0, 0, 0] }); sel = draft.b.length - 1; redraw();
    }));
    el.querySelectorAll("[data-sel]").forEach((b) => (b.onclick = () => { sel = Number(b.dataset.sel); attachPiece(); drawItems(); }));
    el.querySelector("#mkCancel").onclick = () => { draft = null; zoom = 0; spin = 0.5; stopStudio(); rebuild(); drawItems(); };
    el.querySelector("#mkSave").onclick = () => {
      const clean = sanitizeMade(draft);
      if (!clean) { alert("Add at least one shape first."); return; }
      const item = { ...clean, i: draft.i, n: (draft.n || "").trim().slice(0, 24) || "My cosmetic" };
      const locker = loadLocker(), at = locker.findIndex((x) => x.i === item.i);
      if (at >= 0) locker[at] = item; else locker.unshift(item);
      saveLocker(locker);
      let made = (av.made || []).filter((x) => x.i !== item.i);
      made.unshift({ i: item.i, a: item.a, b: item.b }); av.made = made.slice(0, MAX_WORN);
      draft = null; zoom = 0; spin = 0.5; stopStudio(); changed(); drawItems();
    };
    if (!P) return;
    el.querySelectorAll("[data-pc]").forEach((b) => (b.onclick = () => { P.c = b.dataset.pc; redraw(); }));
    el.querySelector("#mkPick").onchange = (e) => { P.c = e.target.value; redraw(); };
    el.querySelectorAll("[data-sl]").forEach((inp) => (inp.oninput = () => { const [, w, i, , , , flip] = SL[Number(inp.dataset.sl)]; P[w][i] = (flip ? -1 : 1) * Number(inp.value); rebuild(); }));
    el.querySelector("#mkGlow").onchange = (e) => { if (e.target.checked) P.g = 1; else delete P.g; rebuild(); };
    el.querySelector("#mkShiny").onchange = (e) => { if (e.target.checked) P.m = 1; else delete P.m; rebuild(); };
    el.querySelector("#mkCopy").onclick = () => { if (draft.b.length >= MAX_PIECES) return; const c = JSON.parse(JSON.stringify(P)); c.p[0] = Math.min(2.5, c.p[0] + 0.3); draft.b.push(c); sel = draft.b.length - 1; redraw(); };
    el.querySelector("#mkMirror").onclick = () => { if (draft.b.length >= MAX_PIECES) return; const c = JSON.parse(JSON.stringify(P)); c.p[0] = -c.p[0]; c.r[1] = -c.r[1]; c.r[2] = -c.r[2]; draft.b.push(c); sel = draft.b.length - 1; redraw(); };
    el.querySelector("#mkDel").onclick = () => { draft.b.splice(sel, 1); sel = Math.max(0, Math.min(sel, draft.b.length - 1)); redraw(); };
  }

  // little pictures of each hat / hair / face / shirt: your avatar wearing it (made once, then remembered)
  const thumbs = { hat: 1, hair: 1, face: 1, eyes: 1, top: 1, back: 1, build: 1 };
  function thumb(key, v) { return avatarPicture({ ...av, [key]: v }, 96, key === "top" || key === "back" || key === "build"); }
  box.querySelector("#avRand").onclick = () => { const keep = { art: av.art, pantsArt: av.pantsArt }; av = randomAvatar(); Object.assign(av, keep); if (!av.art && av.top === "draw") av.top = "plain"; changed(); drawItems(); };
  box.querySelector("#avReset").onclick = () => { if (!confirm("Start over? (Your shirt drawing and the cosmetics you built stay saved, so you can put them back on.)")) return; av = { ...DEFAULT_AVATAR, art: av.art }; changed(); drawItems(); };
  rebuild(); drawTabs(); drawItems();
  return { set(a) { av = sanitizeAvatar(a); rebuild(); drawItems(); } };
}
