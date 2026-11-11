// 🎞️ THE ANIMATION MAKER (Properties > My animations > ＋ Add animation): a timeline under a 3D preview of the thing.
// Pick a moment on the timeline, then drag the thing (Move / Turn / Size, or type numbers) to pose it there: that's a
// keyframe ◆. ▶ Play glides between them. Then pick when it plays in the game (keyanim.js ANIM_WHEN) and how it ends.
// openAnimMaker(o, anim, ctx): anim = the one to change (or null for a new one);
//   ctx = {openModal(html), closeModal(), buttons: [{id, name}] (GUI buttons), preset: a "when" for a new one, onSave(anim)}
import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { TransformControls } from "../vendor/TransformControls.js";
import { buildObject } from "./world.js";
import { animateThing, motionOf, withPlay } from "./motion.js";
import { ANIM_WHEN, ANIM_END, WALKS, MAX_KEYS, MAX_LEN, newAnim, sanitizeAnims, sampleAnim, applyPose } from "./keyanim.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;
const snap = (t) => Math.round(t * 20) / 20; // (moments snap to 0.05 s)
const opts = (table, v) => Object.entries(table).map(([k, l]) => '<option value="' + esc(k) + '"' + (k === v ? " selected" : "") + ">" + esc(l) + "</option>").join("");

export function openAnimMaker(o, anim, ctx) {
  const isNew = !anim;
  const A = JSON.parse(JSON.stringify(anim || newAnim(ctx.preset, ((o.anims || []).length || 0) + 1)));
  let head = isNew ? Math.min(1, A.len) : A.keys.length > 1 ? A.keys[1].t : Math.min(1, A.len), playing = false, playFrom = 0, mode = "translate";
  const field = (label, inner) => '<label class="field"><span>' + label + "</span>" + inner + "</label>";
  const num3 = (k, label, step) => '<div class="ka-num"><span>' + label + '</span>' + [0, 1, 2].map((i) => '<input type="number" step="' + step + '" data-n="' + k + '" data-i="' + i + '" aria-label="' + label + " " + "xyz"[i] + '">').join("") + "</div>";
  ctx.openModal('<h2>🎞️ Animation · ' + esc(o.name) + '</h2>' +
    '<p>Click a moment on the timeline, then drag the thing to pose it there (or type numbers). Each pose is a ◆. Press ▶ Play to watch it glide from pose to pose.</p>' +
    '<div class="ka-main"><div class="ka-left">' +
    '<div class="mon-stage ka-stage"><canvas id="kaCanvas"></canvas>' +
    '<div class="ka-tools"><button type="button" data-mode="translate">✥ Move</button><button type="button" data-mode="rotate">⟳ Turn</button><button type="button" data-mode="scale">⤢ Size</button></div>' +
    '<div class="ka-hint" id="kaHint"></div></div>' +
    '<div class="ka-bar"><button type="button" class="btn" id="kaPlay">▶ Play</button><button type="button" class="btn" id="kaStart" title="Back to the start">⏮</button><b id="kaTime"></b>' +
    '<span class="ka-gap"></span><button type="button" class="btn" id="kaKey">◆ Pose here</button><button type="button" class="btn" id="kaCopy" title="Copy the pose before this moment to here">⧉ Copy last pose</button><button type="button" class="btn" id="kaDel">🗑 Delete pose</button></div>' +
    '<div class="ka-track" id="kaTrack"><div class="ka-ruler" id="kaRuler"></div><div class="ka-keys" id="kaKeys"></div><div class="ka-head" id="kaHead"></div></div>' +
    '<div class="ka-nums">' + num3("p", "Move", 0.5) + num3("r", "Turn °", 15) + num3("s", "Size ×", 0.1) + "</div>" +
    '</div><div class="ka-side">' +
    field("Name", '<input id="kaName" maxlength="30">') +
    field("How long (seconds)", '<input type="number" id="kaLen" min="0.2" max="' + MAX_LEN + '" step="0.1">') +
    field("When it plays", '<select id="kaWhen">' + opts(ANIM_WHEN, A.when) + "</select>") +
    '<div id="kaWhenMore"></div>' +
    field("When it's done", '<select id="kaEnd">' + opts(ANIM_END, A.end) + "</select>") +
    field("Legs and arms while it plays", '<select id="kaWalk">' + opts(WALKS, A.walk) + "</select>") +
    '<p class="note" id="kaNote"></p>' +
    "</div></div>" +
    '<div class="modal-actions"><button class="btn" id="kaCancel" type="button">Cancel</button><button class="btn go" id="kaSave" type="button">✓ Save animation</button></div>');
  $("modalBox").classList.add("wide");

  // ---------------------------------------------------------------- the 3D preview
  const cv = $("kaCanvas");
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, 4); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 20000);
  const copy = buildObject({ ...JSON.parse(JSON.stringify(o)), pos: [0, 0, 0] }), inner = copy.userData.inner;
  copy.visible = true; sc.add(copy);
  const base = { pos: new THREE.Vector3(), q: copy.quaternion.clone(), s: new THREE.Vector3(1, 1, 1) }, qInv = base.q.clone().invert();
  const startBox = new THREE.Box3().setFromObject(copy);
  const H = Math.max(0.5, startBox.getSize(new THREE.Vector3()).y), R = Math.max(1, ...o.size);
  const ghost = new THREE.Box3Helper(startBox, 0x6f8cff); ghost.material.transparent = true; ghost.material.opacity = 0.5; sc.add(ghost); // (where it starts)
  const grid = new THREE.GridHelper(R * 8, 16, 0x5a4f80, 0x2c2744); grid.position.y = startBox.min.y; sc.add(grid);
  const face = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.15, H * 0.07), 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3030 })); // (jump scares: the player's face)
  face.position.set(0, startBox.getCenter(new THREE.Vector3()).y, 0).add(new THREE.Vector3(0, 0, -2.2 * H).applyQuaternion(base.q)); sc.add(face);
  const mid = startBox.getCenter(new THREE.Vector3());
  cam.position.set(mid.x + R * 2.2, mid.y + R * 1.2, mid.z + R * 2.6);
  const orbit = new OrbitControls(cam, cv); orbit.target.copy(mid); orbit.update();
  const tc = new TransformControls(cam, cv); tc.setSpace("local"); sc.add(tc.getHelper());
  tc.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; });
  tc.addEventListener("objectChange", () => { if (head > 0 && !playing) setKey(poseFromCopy()); });

  // ---------------------------------------------------------------- keys
  const keyAt = (t) => A.keys.find((k) => Math.abs(k.t - t) < 0.001) || null;
  function poseFromCopy() {
    const old = sampleAnim(A, head);
    const p = copy.position.clone().applyQuaternion(qInv);
    const e = new THREE.Euler().setFromQuaternion(qInv.clone().multiply(copy.quaternion), "YXZ");
    const rr = [e.x * R2D, e.y * R2D, e.z * R2D].map((v, i) => { while (v - old.r[i] > 180) v -= 360; while (v - old.r[i] < -180) v += 360; return r2(v); }); // (keeps big spins: 720° stays 720°)
    return { p: [r2(p.x), r2(p.y), r2(p.z)], r: rr, s: [r2(copy.scale.x), r2(copy.scale.y), r2(copy.scale.z)] };
  }
  function setKey(pose) {
    if (head <= 0) return;
    let k = keyAt(head);
    if (!k) {
      if (A.keys.length >= MAX_KEYS) { hint("That's the most poses one animation can have (" + (MAX_KEYS - 1) + ")."); return; }
      k = { t: head }; A.keys.push(k); A.keys.sort((a, b) => a.t - b.t);
    }
    k.p = pose.p.slice(); k.r = pose.r.slice(); k.s = pose.s.map((v) => Math.max(0.05, v));
    draw(true);
  }
  function hint(text) { $("kaHint").textContent = text; }

  // ---------------------------------------------------------------- drawing
  function draw(keepCopy) {
    const pose = sampleAnim(A, head);
    if (!keepCopy || playing) applyPose(copy, base, pose);
    $("kaTime").textContent = head.toFixed(2).replace(/0$/, "") + " s";
    $("kaHead").style.left = (head / A.len) * 100 + "%";
    $("kaKeys").innerHTML = A.keys.map((k, i) => '<button type="button" class="ka-key' + (i === 0 ? " first" : "") + (Math.abs(k.t - head) < 0.001 ? " on" : "") + '" data-k="' + i + '" style="left:' + (k.t / A.len) * 100 + '%" title="' + (i ? "Pose at " + k.t + " s (drag to move it)" : "Start: where it is in your world") + '">◆</button>').join("");
    let ruler = "";
    const step = A.len > 12 ? 2 : A.len > 5 ? 1 : 0.5;
    for (let t = 0; t <= A.len + 1e-6; t += step) ruler += '<span style="left:' + (t / A.len) * 100 + '%">' + r2(t) + "</span>";
    $("kaRuler").innerHTML = ruler;
    const k = keyAt(head);
    $("kaKey").disabled = head <= 0 || !!k; $("kaDel").disabled = !k || head <= 0; $("kaCopy").disabled = head <= 0;
    document.querySelectorAll(".ka-nums input").forEach((inp) => { inp.value = r2(pose[inp.dataset.n][+inp.dataset.i]); inp.disabled = head <= 0 || playing; });
    $("kaPlay").textContent = playing ? "⏸ Stop" : "▶ Play";
    if (playing || head <= 0) tc.detach(); else if (tc.object !== copy) tc.attach(copy);
    tc.setMode(mode);
    document.querySelectorAll(".ka-tools button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
    face.visible = A.when === "scare";
    hint(playing ? "" : head <= 0 ? "0 s is where it starts (where you put it in your world). Click later on the timeline, then pose it." :
      A.when === "scare" ? "🔴 = the player's face in the jump scare. Move it toward the red ball to rush at them!" : k ? "Drag the arrows to change this pose." : "Drag the arrows to make a pose here.");
    const w = $("kaWhen").value;
    const more = w === "time" ? field("After how many seconds", '<input type="number" id="kaAt" min="0" max="600" step="0.5" value="' + A.at + '">')
      : w === "button" ? field("Which button", '<select id="kaBtn"><option value="">(pick a button)</option>' + ctx.buttons.map((b) => '<option value="' + esc(b.id) + '"' + (b.id === A.btn ? " selected" : "") + ">🔘 " + esc(b.name) + "</option>").join("") + "</select>") + (ctx.buttons.length ? "" : '<p class="note">Add a Button from ＋ Add &gt; GUI first.</p>')
      : w === "near" ? field("How close (studs)", '<input type="number" id="kaR" min="1" max="100" step="1" value="' + A.r + '">') : "";
    if ($("kaWhenMore").dataset.w !== w) {
      $("kaWhenMore").innerHTML = more; $("kaWhenMore").dataset.w = w;
      if ($("kaAt")) $("kaAt").onchange = (e) => { A.at = Math.max(0, Math.min(600, +e.target.value || 0)); };
      if ($("kaBtn")) $("kaBtn").onchange = (e) => { A.btn = e.target.value; };
      if ($("kaR")) $("kaR").onchange = (e) => { A.r = Math.max(1, Math.min(100, +e.target.value || 8)); };
    }
    $("kaNote").innerHTML = (w === "script" ? "" : "Scripts can play it too: ") + '<code>me.play("' + esc(A.name) + '")</code>' + (["click", "touch", "near", "button"].includes(w) ? ". It plays again every time." : "");
  }

  // ---------------------------------------------------------------- the timeline
  const track = $("kaTrack");
  const timeAt = (x) => { const b = track.getBoundingClientRect(); return Math.max(0, Math.min(A.len, snap(((x - b.left) / b.width) * A.len))); };
  let dragKey = null;
  track.addEventListener("pointerdown", (e) => {
    stop();
    const kb = e.target.closest(".ka-key");
    if (kb && +kb.dataset.k > 0) dragKey = A.keys[+kb.dataset.k];
    head = kb ? A.keys[+kb.dataset.k].t : timeAt(e.clientX);
    track.setPointerCapture(e.pointerId); draw();
  });
  track.addEventListener("pointermove", (e) => {
    if (!track.hasPointerCapture(e.pointerId)) return;
    const t = Math.max(0.05, timeAt(e.clientX));
    if (dragKey) { if (!A.keys.some((k) => k !== dragKey && Math.abs(k.t - t) < 0.001)) { dragKey.t = t; A.keys.sort((a, b) => a.t - b.t); head = t; } }
    else head = timeAt(e.clientX);
    draw();
  });
  track.addEventListener("pointerup", () => { dragKey = null; });

  // ---------------------------------------------------------------- buttons
  $("kaPlay").onclick = () => { if (playing) { stop(); draw(); return; } playing = true; if (head >= A.len - 0.01) head = 0; playFrom = performance.now() - head * 1000; draw(); };
  $("kaStart").onclick = () => { stop(); head = 0; draw(); };
  $("kaKey").onclick = () => setKey(sampleAnim(A, head));
  $("kaCopy").onclick = () => { const before = A.keys.filter((k) => k.t < head - 0.001).pop(); if (before) setKey(before); };
  $("kaDel").onclick = () => { const k = keyAt(head); if (k && k.t > 0) { A.keys.splice(A.keys.indexOf(k), 1); draw(); } };
  document.querySelectorAll(".ka-tools button").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; draw(); }));
  document.querySelectorAll(".ka-nums input").forEach((inp) => (inp.onchange = () => {
    const pose = sampleAnim(A, head), next = { p: pose.p.slice(), r: pose.r.slice(), s: pose.s.slice() };
    next[inp.dataset.n][+inp.dataset.i] = Number(inp.value) || 0;
    setKey(next); draw();
  }));
  $("kaName").value = A.name;
  $("kaName").oninput = (e) => { A.name = e.target.value.slice(0, 30); draw(true); };
  $("kaLen").value = A.len;
  $("kaLen").onchange = (e) => {
    A.len = Math.max(0.2, Math.min(MAX_LEN, Math.round((+e.target.value || 2) * 10) / 10)); e.target.value = A.len;
    A.keys = A.keys.filter((k) => k.t <= A.len + 1e-6); head = Math.min(head, A.len); draw();
  };
  $("kaWhen").onchange = (e) => { A.when = e.target.value; if (A.when === "scare" && A.end === "loop") { A.end = "stay"; $("kaEnd").value = "stay"; } draw(true); };
  $("kaEnd").onchange = (e) => { A.end = e.target.value; };
  $("kaWalk").onchange = (e) => { A.walk = e.target.value; };

  function stop() { if (!playing) return; playing = false; rest(); }
  function rest() { if (inner) animateThing(inner, o.size[1], 0, 0, { g: "walk", i: "none", w: "idle", sp: 1 }); }
  let alive = true;
  function loop() {
    if (!alive || !cv.isConnected) { alive = false; tc.detach(); tc.dispose(); orbit.dispose(); r.dispose(); return; }
    requestAnimationFrame(loop);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w && h && cv.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (playing) {
      let el = (performance.now() - playFrom) / 1000;
      if (el >= A.len) { if (A.end === "loop") { playFrom += A.len * 1000; el -= A.len; } else { playing = false; head = A.len; rest(); draw(); } }
      if (playing) { head = Math.min(A.len, el); draw(); }
      if (playing && A.walk && inner) animateThing(inner, o.size[1], el, 1, withPlay(motionOf(o), A.walk));
    }
    r.render(sc, cam);
  }
  draw(); loop();

  const done = () => { alive = false; $("modalBox").classList.remove("wide"); ctx.closeModal(); };
  $("kaCancel").onclick = done;
  $("kaSave").onclick = () => {
    const clean = sanitizeAnims([A]);
    if (!clean) return;
    if (clean[0].keys.length < 2) { hint("Make at least one pose first: click later on the timeline and drag the thing."); return; }
    if (A.when === "button" && !A.btn) { hint("Pick which button plays it (on the right)."); return; }
    done(); ctx.onSave(clean[0]);
  };
}
