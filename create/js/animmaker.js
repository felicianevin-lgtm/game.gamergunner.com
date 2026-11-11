// 🎞️ THE ANIMATION MAKER (Properties > My animations > ＋ Add animation): a timeline under a 3D preview of the thing.
// Pick a moment on the timeline, then drag the thing (Move / Turn / Size, or type numbers) to pose it there: that's a
// keyframe ◆. ▶ Play glides between them. Then pick when it plays in the game (keyanim.js ANIM_WHEN) and how it ends.
// 🦴 BONES: pick a bone in the list and turn just that bone (an arm, a hand, a head...), so you can puppet it.
//   Meshes (editor.js Mesh together) get bones here: ＋ Add bone, click the pieces it moves, drag the ball to where it
//   bends. Imported models with a skeleton show their own bones.
// openAnimMaker(o, anim, ctx): anim = the one to change (or null for a new one);
//   ctx = {openModal(html), closeModal(), buttons: [{id, name}] (GUI buttons), preset: a "when" for a new one,
//          bonesOnly: just the bones (no timeline), onSave(anim), onBones(bones) (a mesh's bones changed)}
import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { TransformControls } from "../vendor/TransformControls.js";
import { buildObject } from "./world.js";
import { ANIM_WHEN, ANIM_END, LOOPS, MAX_KEYS, MAX_LEN, newAnim, sanitizeAnims, sampleAnim, applyPose, applyBones, boneList, restOf } from "./keyanim.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R2D = 180 / Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;
const snap = (t) => Math.round(t * 20) / 20; // (moments snap to 0.05 s)
const rid = () => Math.random().toString(36).slice(2, 10);
const opts = (table, v) => Object.entries(table).map(([k, l]) => '<option value="' + esc(k) + '"' + (k === v ? " selected" : "") + ">" + esc(l) + "</option>").join("");
const MAX_BONES = 40;

export function openAnimMaker(o, anim, ctx) {
  const only = !!ctx.bonesOnly, isMesh = o.type === "mesh";
  const isNew = !anim;
  const A = JSON.parse(JSON.stringify(anim || newAnim(ctx.preset, ((o.anims || []).length || 0) + 1)));
  let head = only ? 0 : isNew ? Math.min(1, A.len) : A.keys.length > 1 ? A.keys[1].t : Math.min(1, A.len), playing = false, playFrom = 0, mode = "translate";
  let target = null;      // the bone being posed (its id), or null = the whole thing
  let editing = null;     // a mesh bone being set up (a copy of it), or null
  let bones = JSON.parse(JSON.stringify(o.bones || [])); // (a mesh's bones)
  const field = (label, inner) => '<label class="field"><span>' + label + "</span>" + inner + "</label>";
  const num3 = (k, label, step) => '<div class="ka-num" data-row="' + k + '"><span>' + label + '</span>' + [0, 1, 2].map((i) => '<input type="number" step="' + step + '" data-n="' + k + '" data-i="' + i + '" aria-label="' + label + " " + "xyz"[i] + '">').join("") + "</div>";
  ctx.openModal('<h2>' + (only ? "🦴 Bones · " : "🎞️ Animation · ") + esc(o.name) + '</h2>' +
    (only ? '<p>Bones are joints that turn pieces, like a shoulder turning an arm. Add a bone, click the pieces it moves, then drag the ball to where it bends. Then pose them in 🎞️ My animations.</p>'
      : '<p>Click a moment on the timeline, then drag the thing (or one of its 🦴 bones) to pose it there. Each pose is a ◆. Press ▶ Play to watch it glide from pose to pose.</p>') +
    '<div class="ka-main"><div class="ka-left">' +
    '<div class="mon-stage ka-stage"><canvas id="kaCanvas"></canvas>' +
    '<div class="ka-tools"><button type="button" data-mode="translate">✥ Move</button><button type="button" data-mode="rotate">⟳ Turn</button><button type="button" data-mode="scale">⤢ Size</button></div>' +
    '<div class="ka-hint" id="kaHint"></div></div>' +
    '<div id="kaTimeline"' + (only ? ' class="hidden"' : "") + '>' +
    '<div class="ka-bar"><button type="button" class="btn" id="kaPlay">▶ Play</button><button type="button" class="btn" id="kaStart" title="Back to the start">⏮</button><b id="kaTime"></b>' +
    '<span class="ka-gap"></span><button type="button" class="btn" id="kaKey">◆ Pose here</button><button type="button" class="btn" id="kaCopy" title="Copy the pose before this moment to here">⧉ Copy last pose</button><button type="button" class="btn" id="kaDel">🗑 Delete pose</button></div>' +
    '<div class="ka-track" id="kaTrack"><div class="ka-ruler" id="kaRuler"></div><div class="ka-keys" id="kaKeys"></div><div class="ka-head" id="kaHead"></div></div>' +
    '<div class="ka-nums">' + num3("p", "Move", 0.5) + num3("r", "Turn °", 15) + num3("s", "Size ×", 0.1) + "</div></div>" +
    '</div><div class="ka-side">' +
    '<div class="ka-bones"><div class="ka-bones-head"><b>🦴 Bones</b>' + (isMesh ? '<button type="button" class="btn small" id="kaAddBone">＋ Add bone</button>' : "") + '</div><div id="kaBoneList"></div><div id="kaBoneEdit"></div></div>' +
    (only ? "" :
      field("Name", '<input id="kaName" maxlength="30">') +
      field("How long (seconds)", '<input type="number" id="kaLen" min="0.2" max="' + MAX_LEN + '" step="0.1">') +
      field("When it plays", '<select id="kaWhen">' + opts(ANIM_WHEN, A.when) + "</select>") +
      '<div id="kaWhenMore"></div>' +
      field("When it's done", '<select id="kaEnd">' + opts(ANIM_END, A.end) + "</select>") +
      '<p class="note" id="kaNote"></p>') +
    "</div></div>" +
    '<div class="modal-actions">' + (only ? '<button class="btn go" id="kaCancel" type="button">✓ Done</button>' : '<button class="btn" id="kaCancel" type="button">Cancel</button><button class="btn go" id="kaSave" type="button">✓ Save animation</button>') + "</div>");
  $("modalBox").classList.add("wide");

  // ---------------------------------------------------------------- the 3D preview
  const cv = $("kaCanvas");
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.5)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, 4); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 20000);
  let copy = null, inner = null, list = [];
  const helpers = new THREE.Group(); sc.add(helpers);  // (yellow boxes around the pieces the bone being set up moves)
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false })); ball.renderOrder = 10; // (where that bone bends)
  function makeCopy() {
    if (copy) { sc.remove(copy); copy.traverse((m) => { if (m.isMesh && m.geometry) m.geometry.dispose(); }); }
    copy = buildObject({ ...JSON.parse(JSON.stringify(o)), pos: [0, 0, 0], bones: isMesh ? bones : o.bones });
    copy.visible = true; inner = copy.userData.inner; sc.add(copy);
    list = boneList(inner);
  }
  makeCopy();
  const base = { pos: new THREE.Vector3(), q: copy.quaternion.clone(), s: new THREE.Vector3(1, 1, 1) }, qInv = base.q.clone().invert();
  const startBox = new THREE.Box3().setFromObject(copy);
  const H = Math.max(0.5, startBox.getSize(new THREE.Vector3()).y), R = Math.max(1, ...o.size);
  const ghost = new THREE.Box3Helper(startBox, 0x6f8cff); ghost.material.transparent = true; ghost.material.opacity = 0.5; sc.add(ghost); // (where it starts)
  const grid = new THREE.GridHelper(R * 8, 16, 0x5a4f80, 0x2c2744); grid.position.y = startBox.min.y; sc.add(grid);
  const face = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.15, H * 0.07), 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3030 })); // (jump scares: the player's face)
  face.position.set(0, startBox.getCenter(new THREE.Vector3()).y, 0).add(new THREE.Vector3(0, 0, -2.2 * H).applyQuaternion(base.q)); sc.add(face);
  const mid = startBox.getCenter(new THREE.Vector3());
  const far = Math.max(2, startBox.getSize(new THREE.Vector3()).length()) * 1.25; // (close enough to see the arms and hands)
  cam.position.copy(mid).add(new THREE.Vector3(0.55, 0.35, -0.75).normalize().applyQuaternion(base.q).multiplyScalar(far));
  const orbit = new OrbitControls(cam, cv); orbit.target.copy(mid); orbit.update();
  const tc = new TransformControls(cam, cv); tc.setSpace("local"); sc.add(tc.getHelper());
  tc.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; });
  tc.addEventListener("objectChange", () => {
    if (editing) { editing.at = [r2(ball.position.x), r2(ball.position.y), r2(ball.position.z)]; return; }
    if (head > 0 && !playing) setKey(poseFromCopy());
  });
  const nodeOf = (id) => (list.find((b) => b.id === id) || {}).node || null;

  // ---------------------------------------------------------------- keys
  const keyAt = (t) => A.keys.find((k) => Math.abs(k.t - t) < 0.001) || null;
  const unwrap = (v, old) => { while (v - old > 180) v -= 360; while (v - old < -180) v += 360; return r2(v); }; // (keeps big spins: 720° stays 720°)
  function poseFromCopy() {
    const old = sampleAnim(A, head), out = { p: old.p.slice(), r: old.r.slice(), s: old.s.slice(), b: { ...(old.b || {}) } };
    if (target) {
      const n = nodeOf(target); if (!n) return out;
      const e = new THREE.Euler().setFromQuaternion(restOf(n).clone().invert().multiply(n.quaternion), "YXZ");
      const was = (old.b && old.b[target]) || [0, 0, 0];
      out.b[target] = [e.x * R2D, e.y * R2D, e.z * R2D].map((v, i) => unwrap(v, was[i]));
      return out;
    }
    const p = copy.position.clone().applyQuaternion(qInv);
    const e = new THREE.Euler().setFromQuaternion(qInv.clone().multiply(copy.quaternion), "YXZ");
    out.p = [r2(p.x), r2(p.y), r2(p.z)]; out.r = [e.x * R2D, e.y * R2D, e.z * R2D].map((v, i) => unwrap(v, old.r[i])); out.s = [r2(copy.scale.x), r2(copy.scale.y), r2(copy.scale.z)];
    return out;
  }
  function setKey(pose) {
    if (head <= 0) return;
    let k = keyAt(head);
    if (!k) {
      if (A.keys.length >= MAX_KEYS) { hint("That's the most poses one animation can have (" + (MAX_KEYS - 1) + ")."); return; }
      k = { t: head }; A.keys.push(k); A.keys.sort((a, b) => a.t - b.t);
    }
    k.p = pose.p.slice(); k.r = pose.r.slice(); k.s = pose.s.map((v) => Math.max(0.05, v));
    const b = {}; for (const [id, v] of Object.entries(pose.b || {})) if (v.some((x) => Math.abs(x) > 0.001) || A.keys.some((x) => x !== k && x.b && x.b[id])) b[id] = v.slice();
    if (Object.keys(b).length) k.b = b; else delete k.b;
    draw(true);
  }
  function hint(text) { $("kaHint").textContent = text; }

  // ---------------------------------------------------------------- the bones list
  function drawBones() {
    const items = [{ id: "", name: "🧍 The whole thing" }].concat(list.map((b) => ({ id: b.id, name: "🦴 " + b.name })));
    const meshBone = (id) => bones.find((b) => b.id === id);
    $("kaBoneList").innerHTML = (only && !list.length ? "" : items.map((b) => '<div class="ka-bone' + ((target || "") === b.id && !only ? " on" : "") + (editing && editing.id === b.id ? " edit" : "") + '" data-bone="' + esc(b.id) + '">' +
      '<span>' + esc(b.name) + "</span>" + (isMesh && b.id && meshBone(b.id) ? '<button type="button" class="btn small" data-bedit="' + esc(b.id) + '" title="Change which pieces it moves and where it bends">✏️</button><button type="button" class="btn small" data-bdel="' + esc(b.id) + '" title="Delete this bone">🗑</button>' : "") + "</div>").join("")) +
      (list.length ? "" : '<p class="note">' + (isMesh ? "No bones yet. ＋ Add bone, then click the pieces it moves (like an arm)." : o.type === "model" ? (inner.userData.copy ? "This model has no skeleton." : "Loading the model…") : "Only 🧩 meshes (select pieces > Mesh together) and imported models with a skeleton have bones.") + "</p>");
    $("kaBoneList").querySelectorAll("[data-bone]").forEach((el) => (el.onclick = (e) => { if (e.target.closest("button") || only || editing) return; target = el.dataset.bone || null; if (target && mode !== "rotate") mode = "rotate"; draw(); }));
    $("kaBoneList").querySelectorAll("[data-bedit]").forEach((b) => (b.onclick = () => startEdit(bones.find((x) => x.id === b.dataset.bedit))));
    $("kaBoneList").querySelectorAll("[data-bdel]").forEach((b) => (b.onclick = () => {
      const x = bones.find((y) => y.id === b.dataset.bdel); if (!x || !confirm('Delete the bone "' + x.name + '"?')) return;
      for (const y of bones) if (y.parent === x.id) y.parent = x.parent;
      bones = bones.filter((y) => y !== x); if (target === x.id) target = null;
      saveBones();
    }));
    // setting up a bone
    const ed = $("kaBoneEdit");
    if (!editing) { ed.innerHTML = ""; return; }
    ed.innerHTML = '<div class="ka-bedit">' + field("Bone name", '<input id="kaBName" maxlength="30" value="' + esc(editing.name) + '">') +
      field("It hangs from", '<select id="kaBParent"><option value="">(nothing: the mesh itself)</option>' + bones.filter((b) => b.id !== editing.id && !below(b.id, editing.id)).map((b) => '<option value="' + esc(b.id) + '"' + (b.id === editing.parent ? " selected" : "") + ">🦴 " + esc(b.name) + "</option>").join("") + "</select>") +
      '<p class="note">' + editing.parts.length + " piece" + (editing.parts.length === 1 ? "" : "s") + " picked. Click pieces in the picture to add or take them away. Drag the 🟡 ball to where it bends.</p>" +
      '<div class="many-dirs"><button type="button" class="btn small" id="kaBCancel">Cancel</button><button type="button" class="btn small go" id="kaBDone">✓ Done</button></div></div>';
    $("kaBName").oninput = (e) => { editing.name = e.target.value.slice(0, 30); };
    $("kaBParent").onchange = (e) => { editing.parent = e.target.value; };
    $("kaBCancel").onclick = () => { stopEdit(); draw(); };
    $("kaBDone").onclick = () => {
      editing.name = editing.name.trim() || "Bone";
      const i = bones.findIndex((b) => b.id === editing.id);
      if (i >= 0) bones[i] = editing; else bones.push(editing);
      for (const b of bones) if (b !== editing) b.parts = b.parts.filter((p) => !editing.parts.includes(p)); // (a piece hangs from one bone)
      const id = editing.id; stopEdit(); target = only ? null : id; saveBones();
    };
  }
  const below = (id, top) => { let b = bones.find((x) => x.id === id), n = 0; while (b && n++ < 50) { if (b.parent === top) return true; b = bones.find((x) => x.id === b.parent); } return false; };
  function saveBones() {
    // a bone's parent has to come before it (so they're kept in order)
    const out = [], left = bones.slice();
    while (left.length) { const i = left.findIndex((b) => !b.parent || out.some((x) => x.id === b.parent) || !left.some((x) => x.id === b.parent)); out.push(left.splice(i >= 0 ? i : 0, 1)[0]); }
    bones = out;
    if (ctx.onBones) ctx.onBones(JSON.parse(JSON.stringify(bones)));
    makeCopy(); draw();
  }
  function startEdit(b) {
    if (!isMesh) return;
    if (!b && bones.length >= MAX_BONES) { hint("That's the most bones a mesh can have (" + MAX_BONES + ")."); return; }
    stop(); head = only ? 0 : head;
    editing = b ? JSON.parse(JSON.stringify(b)) : { id: rid(), name: "Bone " + (bones.length + 1), parent: target && bones.some((x) => x.id === target) ? target : "", at: [0, 0, 0], parts: [], fresh: true };
    if (!b) { const c = new THREE.Box3().setFromObject(copy).getCenter(new THREE.Vector3()); const root = inner.userData.meshRoot; root.worldToLocal(c); editing.at = [r2(c.x), r2(c.y), r2(c.z)]; }
    draw();
  }
  function stopEdit() { editing = null; ball.removeFromParent(); helpers.clear(); }
  // clicking a piece while setting up a bone
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  cv.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener("pointerup", (e) => {
    if (!editing || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || tc.dragging) return;
    const b = cv.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    for (const h of ray.intersectObject(copy, true)) {
      let p = h.object; while (p && p.userData.part === undefined) p = p.parent;
      if (!p) continue;
      const i = p.userData.part, has = editing.parts.indexOf(i);
      if (has >= 0) editing.parts.splice(has, 1);
      else {
        editing.parts.push(i);
        if (editing.fresh && editing.parts.length === 1) { // (the first piece: it bends at that piece's top middle, like a shoulder)
          const bx = new THREE.Box3().setFromObject(p), top = new THREE.Vector3((bx.min.x + bx.max.x) / 2, bx.max.y, (bx.min.z + bx.max.z) / 2);
          inner.userData.meshRoot.worldToLocal(top); editing.at = [r2(top.x), r2(top.y), r2(top.z)];
        }
      }
      editing.fresh = false;
      draw(); return;
    }
  });

  // ---------------------------------------------------------------- drawing
  function draw(keepCopy) {
    const pose = sampleAnim(A, head);
    if (!keepCopy || playing || editing) { if (editing || only) { applyPose(copy, base, { p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] }); for (const b of list) b.node.quaternion.copy(restOf(b.node)); } else { applyPose(copy, base, pose); applyBones(inner, pose); } }
    if (!only) {
      $("kaTime").textContent = head.toFixed(2).replace(/0$/, "") + " s";
      $("kaHead").style.left = (head / A.len) * 100 + "%";
      $("kaKeys").innerHTML = A.keys.map((k, i) => '<button type="button" class="ka-key' + (i === 0 ? " first" : "") + (Math.abs(k.t - head) < 0.001 ? " on" : "") + '" data-k="' + i + '" style="left:' + (k.t / A.len) * 100 + '%" title="' + (i ? "Pose at " + k.t + " s (drag to move it)" : "Start: where it is in your world") + '">◆</button>').join("");
      let ruler = "";
      const step = A.len > 12 ? 2 : A.len > 5 ? 1 : 0.5;
      for (let t = 0; t <= A.len + 1e-6; t += step) ruler += '<span style="left:' + (t / A.len) * 100 + '%">' + r2(t) + "</span>";
      $("kaRuler").innerHTML = ruler;
      const k = keyAt(head);
      $("kaKey").disabled = head <= 0 || !!k; $("kaDel").disabled = !k || head <= 0; $("kaCopy").disabled = head <= 0;
      const tb = target ? (pose.b && pose.b[target]) || [0, 0, 0] : null;
      document.querySelectorAll(".ka-nums input").forEach((inp) => {
        const n = inp.dataset.n, i = +inp.dataset.i;
        inp.value = r2(tb ? (n === "r" ? tb[i] : n === "s" ? 1 : 0) : pose[n][i]);
        inp.disabled = head <= 0 || playing || !!editing || (!!target && n !== "r");
      });
      $("kaPlay").textContent = playing ? "⏸ Stop" : "▶ Play";
    }
    // the gizmo: on the ball (setting up a bone), a bone (turn only), or the whole thing
    if (editing) {
      const root = inner.userData.meshRoot; if (ball.parent !== root) root.add(ball);
      const rad = Math.max(0.08, H * 0.035); ball.scale.set(rad / (inner.scale.x * root.scale.x || 1), rad / (inner.scale.y * root.scale.y || 1), rad / (inner.scale.z * root.scale.z || 1));
      ball.position.set(...editing.at);
      if (tc.object !== ball) tc.attach(ball); tc.setMode("translate");
      helpers.clear();
      copy.updateMatrixWorld(true);
      copy.traverse((p) => { if (p.userData.part !== undefined && editing.parts.includes(p.userData.part)) helpers.add(new THREE.Box3Helper(new THREE.Box3().setFromObject(p), 0xffd23f)); });
    } else {
      ball.removeFromParent(); helpers.clear();
      const node = target ? nodeOf(target) : null;
      if (only || playing || head <= 0 || (target && !node)) tc.detach();
      else { const want = node || copy; if (tc.object !== want) tc.attach(want); }
      tc.setMode(target ? "rotate" : mode);
    }
    document.querySelectorAll(".ka-tools button").forEach((b) => { b.classList.toggle("on", !editing && (target ? b.dataset.mode === "rotate" : b.dataset.mode === mode)); b.disabled = !!editing || only || (!!target && b.dataset.mode !== "rotate"); });
    $("kaTimeline").classList.toggle("ka-off", !!editing);
    face.visible = A.when === "scare" && !only;
    const k = !only && keyAt(head);
    hint(editing ? "Click the pieces this bone moves (yellow boxes). Drag the 🟡 ball to where it bends." : only ? (list.length ? "Pick ✏️ on a bone to change it, or ＋ Add bone." : "") :
      playing ? "" : head <= 0 ? "0 s is where it starts (where you put it in your world). Click later on the timeline, then pose it." :
      target ? "Turn the rings to bend this bone." : A.when === "scare" ? "🔴 = the player's face in the jump scare. Move it toward the red ball to rush at them!" : k ? "Drag the arrows to change this pose." : "Drag the arrows to make a pose here.");
    drawBones();
    if (only) return;
    const w = $("kaWhen").value;
    $("kaEnd").disabled = !!LOOPS[w]; if (LOOPS[w]) $("kaEnd").value = "loop";
    const more = w === "time" ? field("After how many seconds", '<input type="number" id="kaAt" min="0" max="600" step="0.5" value="' + A.at + '">')
      : w === "button" ? field("Which button", '<select id="kaBtn"><option value="">(pick a button)</option>' + ctx.buttons.map((b) => '<option value="' + esc(b.id) + '"' + (b.id === A.btn ? " selected" : "") + ">🔘 " + esc(b.name) + "</option>").join("") + "</select>") + (ctx.buttons.length ? "" : '<p class="note">Add a Button from ＋ Add &gt; GUI first.</p>')
      : w === "near" ? field("How close (studs)", '<input type="number" id="kaR" min="1" max="100" step="1" value="' + A.r + '">')
      : w === "moving" ? '<p class="note">Make one step of a walk (like left leg forward, then right). It loops while it walks, chases or a script moves it, instead of the 🎬 walk styles.</p>'
      : w === "idle" ? '<p class="note">It loops while it stands still (breathing, looking around…).</p>' : "";
    if ($("kaWhenMore").dataset.w !== w) {
      $("kaWhenMore").innerHTML = more; $("kaWhenMore").dataset.w = w;
      if ($("kaAt")) $("kaAt").onchange = (e) => { A.at = Math.max(0, Math.min(600, +e.target.value || 0)); };
      if ($("kaBtn")) $("kaBtn").onchange = (e) => { A.btn = e.target.value; };
      if ($("kaR")) $("kaR").onchange = (e) => { A.r = Math.max(1, Math.min(100, +e.target.value || 8)); };
    }
    $("kaNote").innerHTML = (w === "script" ? "" : "Scripts can play it too: ") + '<code>me.play("' + esc(A.name) + '")</code>' + (["click", "touch", "near", "button"].includes(w) ? ". It plays again every time." : "");
  }

  // ---------------------------------------------------------------- the timeline
  if (!only) {
    const track = $("kaTrack");
    const timeAt = (x) => { const b = track.getBoundingClientRect(); return Math.max(0, Math.min(A.len, snap(((x - b.left) / b.width) * A.len))); };
    let dragKey = null;
    track.addEventListener("pointerdown", (e) => {
      if (editing) return;
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

    $("kaPlay").onclick = () => { if (editing) return; if (playing) { stop(); draw(); return; } playing = true; if (head >= A.len - 0.01) head = 0; playFrom = performance.now() - head * 1000; draw(); };
    $("kaStart").onclick = () => { stop(); head = 0; draw(); };
    $("kaKey").onclick = () => setKey(sampleAnim(A, head));
    $("kaCopy").onclick = () => { const before = A.keys.filter((k) => k.t < head - 0.001).pop(); if (before) setKey(sampleAnim(A, before.t)); };
    $("kaDel").onclick = () => { const k = keyAt(head); if (k && k.t > 0) { A.keys.splice(A.keys.indexOf(k), 1); draw(); } };
    document.querySelectorAll(".ka-nums input").forEach((inp) => (inp.onchange = () => {
      const pose = sampleAnim(A, head), next = { p: pose.p.slice(), r: pose.r.slice(), s: pose.s.slice(), b: { ...(pose.b || {}) } };
      const v = Number(inp.value) || 0, i = +inp.dataset.i;
      if (target) { if (inp.dataset.n === "r") { next.b[target] = (next.b[target] || [0, 0, 0]).slice(); next.b[target][i] = v; } }
      else next[inp.dataset.n][i] = v;
      setKey(next); draw();
    }));
    $("kaName").value = A.name;
    $("kaName").oninput = (e) => { A.name = e.target.value.slice(0, 30); draw(true); };
    $("kaLen").value = A.len;
    $("kaLen").onchange = (e) => {
      A.len = Math.max(0.2, Math.min(MAX_LEN, Math.round((+e.target.value || 2) * 10) / 10)); e.target.value = A.len;
      A.keys = A.keys.filter((k) => k.t <= A.len + 1e-6); head = Math.min(head, A.len); draw();
    };
    $("kaWhen").onchange = (e) => { A.when = e.target.value; if (A.when === "scare" && A.end === "loop") { A.end = "stay"; $("kaEnd").value = "stay"; } if (LOOPS[A.when]) A.end = "loop"; draw(true); };
    $("kaEnd").onchange = (e) => { A.end = e.target.value; };
  }
  document.querySelectorAll(".ka-tools button").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; if (mode !== "rotate") target = null; draw(); }));
  if ($("kaAddBone")) $("kaAddBone").onclick = () => startEdit(null);

  function stop() { playing = false; }
  let alive = true, waitBones = o.type === "model" && !list.length ? 40 : 0;
  function loop() {
    if (!alive || !cv.isConnected) { alive = false; tc.detach(); tc.dispose(); orbit.dispose(); r.dispose(); return; }
    requestAnimationFrame(loop);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w && h && cv.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (waitBones > 0 && inner.userData.copy && performance.now() % 500 < 20) { list = boneList(inner); if (list.length || --waitBones <= 0) { waitBones = 0; draw(); } } // (an imported model's skeleton shows up once it loads)
    if (playing) {
      let el = (performance.now() - playFrom) / 1000;
      if (el >= A.len) { if (A.end === "loop" || LOOPS[A.when]) { playFrom += A.len * 1000; el -= A.len; } else { playing = false; head = A.len; draw(); } }
      if (playing) { head = Math.min(A.len, el); draw(); }
    }
    r.render(sc, cam);
  }
  draw(); loop();

  const done = () => { alive = false; $("modalBox").classList.remove("wide"); ctx.closeModal(); };
  $("kaCancel").onclick = done;
  if ($("kaSave")) $("kaSave").onclick = () => {
    if (editing) { hint("Press ✓ Done on the bone first."); return; }
    const clean = sanitizeAnims([A]);
    if (!clean) return;
    if (clean[0].keys.length < 2) { hint("Make at least one pose first: click later on the timeline and drag the thing."); return; }
    if (A.when === "button" && !A.btn) { hint("Pick which button plays it (on the right)."); return; }
    done(); ctx.onSave(clean[0]);
  };
  if (only && isMesh && !bones.length) startEdit(null); // (straight to making the first bone)
}
