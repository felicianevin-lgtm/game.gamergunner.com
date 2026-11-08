// PLAY TEST for GunnerVerse Studio: runs a game (game.js) in the same 3D world. A blocky player with simple physics
// (gravity + pushing out of solid boxes), a third-person camera, cars you drive with E, and every behavior from
// assets.js BEHAVIORS: coins, checkpoints, lava, jump pads, spinners, moving platforms, doors, talking characters, finish.
// The player is three spheres stacked up (feet, middle, head); solid things are boxes (world.js worldBoxes).
// Screen GUI (gui.js) shows on top: buttons run their action (open / close a GUI, show / hide a part, look through a
// Security Camera...), the Developer Menu button asks for its code and then opens the dev menu (fly, super speed, super
// jump, no lava, teleport to the finish, collect every coin). Switch parts turn the part or GUI they point at on / off.
// SCRIPTS (scripts.js) run in a locked sandbox: each frame they get the player and what moved, and send back commands
// (applyScripts() below checks every one). Text they show goes through the chat word filter (filter.js).
// The player is your avatar from the home page (avatar.js).
import * as THREE from "../vendor/three.module.js";
import { buildObject, worldBoxes, boundsBox } from "./world.js";
import { renderGui } from "./gui.js";
import { startScripts } from "./scripts.js";
import { filterText } from "./filter.js";
import { buildAvatar, animateAvatar, loadAvatar } from "./avatar.js";
import { fileUrl, updateMixers, clearMixers } from "./files.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D2R = Math.PI / 180;
const RADIUS = 0.6, SPHERES = [0.6, 1.5, 2.4]; // the player's body (heights above the feet)

// opts = {onStop(again): again = true when the player pressed "Try again", output(kind, text): the studio's Output box}
export function startPlay(world, game, opts) {
  const { scene, camera } = world;
  const S = game.settings;
  world.setSky(S.sky);
  // The editor's objects come back when Play stops (editor.js rebuildAll).
  while (world.root.children.length) world.root.remove(world.root.children[0]);
  clearMixers();

  // ---------------------------------------------------------------- the things in the game
  function makeEnt(o) {
    const g = buildObject(o);
    g.visible = o.visible;
    world.root.add(g);
    const e = { o, g, k: o.b.k, base: g.position.clone(), baseQ: g.quaternion.clone(), offset: new THREE.Vector3(), done: false, off: false, prevPos: g.position.clone(), prevQ: g.quaternion.clone() };
    e.moving = ["spin", "move", "door", "car"].includes(e.k);
    e.boxes = o.solid ? worldBoxes(o) : [];
    e.bounds = boundsBox(o);
    return e;
  }
  const ents = game.objects.map(makeEnt);
  // (switched off / hidden by a script: not shown, not solid, can't be touched)
  const solids = () => ents.filter((e) => e.boxes.length && !e.off && !(e.k === "coin" && e.done));
  let lowest = Math.min(0, ...game.objects.map((o) => o.pos[1]));

  // ---------------------------------------------------------------- the player
  const player = buildAvatar(loadAvatar());
  scene.add(player);
  const spawnEnt = ents.find((e) => e.k === "spawn");
  const spawnAt = spawnEnt ? new THREE.Vector3(spawnEnt.o.pos[0], spawnEnt.o.pos[1] + spawnEnt.o.size[1] + 0.2, spawnEnt.o.pos[2]) : new THREE.Vector3(0, 6, 0);
  let checkpoint = spawnAt.clone();
  const pos = spawnAt.clone(), vel = new THREE.Vector3();
  let grounded = false, groundEnt = null, facing = spawnEnt ? spawnEnt.o.rot[1] * D2R : 0;
  let camYaw = facing, camPitch = 0.35, camDist = 14; // (camera behind the player)
  let coins = 0, time = 0, won = false, lost = false, driving = null, msgTimer = 0, viewCam = null;
  const mods = { speed: false, jump: false, gravity: false, fly: false, god: false }; // (GUI buttons + dev menu)
  const sc = { speed: 1, jump: 1, frozen: false, health: 100, showHealth: false }; // (set by scripts)
  const totalCoins = ents.filter((e) => e.k === "coin").reduce((n, e) => n + (Number(e.o.b.points) || 1), 0);

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const onKey = (e) => {
    if (e.target && e.target.tagName === "INPUT") return; // (typing the dev menu code)
    const k = e.key.toLowerCase();
    if (e.type === "keydown") {
      if (e.key === "Escape") { stop(); return; }
      if (k === "e" && !e.repeat) toggleCar();
      if (host && wantKeys && !e.repeat) host.event("key", k === " " ? "space" : k);
      if (["w", "a", "s", "d", " ", "arrowleft", "arrowright", "arrowup", "arrowdown", "shift"].includes(k)) e.preventDefault();
      keys.add(k);
    } else keys.delete(k);
  };
  let drag = null;
  const canvas = world.renderer.domElement;
  let press = null;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; press = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return; // (a finger on the joystick doesn't turn the camera)
    camYaw -= (e.clientX - drag.x) * 0.006; camPitch = Math.max(-0.2, Math.min(1.3, camPitch + (e.clientY - drag.y) * 0.005));
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e) => {
    if (drag && e.pointerId === drag.id) drag = null;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) clickWorld(e.clientX, e.clientY);
    press = null;
  };
  // Clicking a part in the game: Switches and scripts with onClick.
  const pick = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function clickWorld(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    pick.setFromCamera(ndc, camera);
    for (const h of pick.intersectObjects(world.root.children, true)) {
      let p = h.object; while (p && !p.userData.id) p = p.parent;
      const e = p && entById.get(p.userData.id);
      if (!e || e.off || !e.g.visible) continue;
      if (h.distance > 80) return;
      if (e.k === "switch" && e.o.b.how !== "touch") flip(e);
      if (wantClick.has(e.o.id) && host) host.event("click", e.o.id);
      return;
    }
  }
  const onWheel = (e) => { camDist = Math.max(5, Math.min(40, camDist + e.deltaY * 0.02)); e.preventDefault(); };
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
  canvas.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  const blur = () => keys.clear();
  window.addEventListener("blur", blur);
  $("btnStop").onclick = stop;
  $("hud").classList.remove("hidden");
  const touchUI = (navigator.maxTouchPoints > 0 || "ontouchstart" in window) ? addTouchControls(keys, toggleCar) : null;
  if (touchUI) $("hudHelp").textContent = "Left stick: move · Jump · drag the screen to look";
  const guiLayer = document.createElement("div");
  guiLayer.className = "gui-layer in-play" + (touchUI ? " touch-on" : "");
  $("hud").appendChild(guiLayer);
  const gui = game.gui || [];
  const guiById = new Map(gui.map((g) => [g.id, g]));
  let guiDirty = true;
  function drawGui() { guiDirty = false; renderGui(guiLayer, gui, { onClick: (g, el, ev) => guiClick(g, el, ev), fileUrl }); }
  let devPanel = null;

  function toggle(key, onText, offText) { mods[key] = !mods[key]; showMsg(mods[key] ? onText : offText, 1.4); beep(mods[key] ? 660 : 330, 0.12, "triangle"); refreshDev(); }
  // Turn a part or a GUI thing on / off (Switches, buttons, scripts).
  function setOn(id, on) {
    const g = guiById.get(id);
    if (g) { if (g.visible !== on) { g.visible = on; guiDirty = true; if (host) host.event("vis", id, on); } return; }
    const e = entById.get(id);
    if (!e) return;
    e.off = !on; e.g.visible = on && e.o.visible;
    if (e === viewCam && !on) lookThrough(null);
    if (host) host.event("vis", id, on);
  }
  function isOn(id) { const g = guiById.get(id); if (g) return g.visible; const e = entById.get(id); return !!e && !e.off; }
  function flip(e) { const t = e.o.b.target; if (!t || !isKnown(t)) { showMsg("This switch isn't hooked up to anything yet", 1.6); return; } setOn(t, !isOn(t)); beep(520, 0.08, "square", 300); }
  const isKnown = (id) => guiById.has(id) || entById.has(id);
  function guiClick(g, el, ev) {
    canvas.focus();
    if (g.kind === "frame") { if (ev && ev.target && ev.target.dataset.close) { setOn(g.id, false); beep(400, 0.06, "square"); } else if (host) host.event("click", g.id); return; } // (panels: onClick scripts work too)
    if (host) host.event("click", g.id);
    if (g.kind === "button") {
      if (g.action === "message") showMsg(g.message || "Hello!", 2.2);
      else if (g.action === "spawn") respawn("Back to the checkpoint!");
      else if (g.action === "speed") toggle("speed", "Super speed ON!", "Super speed off");
      else if (g.action === "jump") toggle("jump", "Super jump ON!", "Super jump off");
      else if (g.action === "gravity") toggle("gravity", "Low gravity ON!", "Low gravity off");
      else if (g.action === "gui" || g.action === "part") { if (g.target && isKnown(g.target)) { setOn(g.target, !isOn(g.target)); beep(520, 0.06, "square"); } }
      else if (g.action === "camera") { const e = entById.get(g.target); if (e) lookThrough(viewCam === e ? null : e); }
    } else if (g.kind === "devmenu") openDev(g, el);
  }
  // Security cameras: the view jumps to the camera until you click again (or a script says camera.reset()).
  function lookThrough(e) {
    viewCam = e && !e.off ? e : null;
    $("hud").classList.toggle("cam-view", !!viewCam);
    $("camName").textContent = viewCam ? "📹 " + viewCam.o.name : "";
    beep(viewCam ? 900 : 500, 0.05, "square");
  }
  // The Developer Menu: first the code, then the powers. It opens next to its button.
  function openDev(g, el) {
    if (devPanel) { devPanel.remove(); devPanel = null; return; }
    devPanel = document.createElement("div");
    devPanel.className = "dev-panel";
    const r = el.getBoundingClientRect(), hr = $("hud").getBoundingClientRect();
    devPanel.style.left = Math.min(Math.max(8, r.left - hr.left + r.width / 2 - 100), hr.width - 216) + "px";
    devPanel.style.top = (r.bottom - hr.top + 280 > hr.height ? Math.max(8, r.top - hr.top - 288) : r.bottom - hr.top + 6) + "px";
    $("hud").appendChild(devPanel);
    if (devPanel.unlocked || g.unlocked) return refreshDev(g);
    devPanel.innerHTML = '<b>🛠 Developer Menu</b><p>Type the code:</p><form><input maxlength="12" autocomplete="off" inputmode="text" aria-label="Code"><button type="submit">Open</button></form><p class="dev-err"></p>';
    const input = devPanel.querySelector("input");
    input.focus();
    devPanel.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      if (input.value.trim() === g.code) { g.unlocked = true; beep(880, 0.15, "triangle", 1320); refreshDev(g); }
      else { devPanel.querySelector(".dev-err").textContent = "Wrong code!"; input.value = ""; beep(160, 0.25, "sawtooth"); }
    };
  }
  function refreshDev(g) {
    if (!devPanel || !devPanel.isConnected) return;
    if (g === undefined && !devPanel.querySelector("[data-dev]")) return;
    const b = (k, label) => '<button type="button" data-dev="' + k + '" class="' + (mods[k] ? "on" : "") + '">' + label + (k in mods ? (mods[k] ? " ✓" : "") : "") + "</button>";
    devPanel.innerHTML = '<b>🛠 Developer Menu</b>' + b("fly", "🕊 Fly") + b("speed", "⚡ Super speed") + b("jump", "🦘 Super jump") + b("god", "🛡 No lava") +
      b("finish", "🏁 Teleport to finish") + b("coins", "🪙 Collect all coins") + '<button type="button" data-dev="close" class="close">Close</button>';
    devPanel.querySelectorAll("[data-dev]").forEach((x) => (x.onclick = () => {
      const k = x.dataset.dev;
      if (k === "close") { devPanel.remove(); devPanel = null; canvas.focus(); return; }
      if (k === "fly") { if (driving) leaveCar(); toggle("fly", "Flying! Space = up, Shift = down", "Fly off"); }
      else if (k === "speed") toggle("speed", "Super speed ON!", "Super speed off");
      else if (k === "jump") toggle("jump", "Super jump ON!", "Super jump off");
      else if (k === "god") toggle("god", "No lava: you can't get hurt!", "Lava hurts again");
      else if (k === "finish") {
        const f = ents.find((e) => e.k === "finish");
        if (!f) { showMsg("This game has no Finish Line", 1.6); return; }
        if (driving) leaveCar();
        pos.set(f.bounds.c.x, f.o.pos[1] + 0.2, f.bounds.c.z); vel.set(0, 0, 0);
      } else if (k === "coins") {
        let n = 0;
        for (const e of ents) if (e.k === "coin" && !e.done) { e.done = true; e.g.visible = false; coins += Number(e.o.b.points) || 1; n++; }
        showMsg(n ? "Got " + n + " coin" + (n === 1 ? "" : "s") + "!" : "No coins left", 1.6); beep(990, 0.2, "square", 1500);
      }
      refreshDev();
    }));
  }
  canvas.focus();
  showMsg(game.name, 2);
  $("hud").insertAdjacentHTML("beforeend", '<div class="cam-overlay"><span id="camName"></span><small>Click the button again to go back</small></div>' +
    '<div class="end-box hidden" id="endBox"><b id="endText"></b><button type="button" class="play" id="btnAgain">↻ Try again</button></div>');
  $("btnAgain").onclick = () => stop(true);

  // ---------------------------------------------------------------- sounds (tiny beeps, no files)
  let ac = null;
  function beep(freq, len, type, slide) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + len);
      g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + len);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + len);
    } catch {}
  }

  // Sounds scripts can play (no files: all made with beeps and noise).
  let soundsThisSec = 0, soundSec = -1;
  function noise(len, freq, vol) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const n = ac.createBufferSource(), buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      n.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
      const g = ac.createGain(); g.gain.value = vol || 0.2;
      n.connect(f); f.connect(g); g.connect(ac.destination); n.start();
    } catch {}
  }
  function sound(name) {
    const sec = Math.floor(time);
    if (sec !== soundSec) { soundSec = sec; soundsThisSec = 0; }
    if (++soundsThisSec > 8) return;
    const later = (ms, f) => setTimeout(() => running && f(), ms);
    if (name === "coin") beep(990, 0.12, "square", 1500);
    else if (name === "jump") beep(330, 0.25, "triangle", 900);
    else if (name === "boom") { noise(0.7, 400, 0.35); beep(90, 0.5, "sine", 40); }
    else if (name === "door") { beep(140, 0.35, "sawtooth", 90); later(250, () => beep(220, 0.15, "square", 180)); }
    else if (name === "alarm") for (let i = 0; i < 4; i++) later(i * 300, () => beep(i % 2 ? 660 : 880, 0.25, "square"));
    else if (name === "scream") { noise(1.1, 3000, 0.3); beep(1400, 1.0, "sawtooth", 300); beep(1180, 1.0, "square", 250); }
    else if (name === "win") [523, 659, 784, 1046].forEach((f, i) => later(i * 130, () => beep(f, 0.2, "square")));
    else if (name === "lose") [392, 330, 262, 196].forEach((f, i) => later(i * 180, () => beep(f, 0.3, "triangle")));
    else if (name === "click") beep(1200, 0.03, "square");
    else beep(660, 0.12, "square");
  }

  function showMsg(text, secs) { $("hudMsg").textContent = text; $("hudMsg").classList.add("show"); msgTimer = secs || 1.6; }
  function respawn(why) {
    if (driving) leaveCar();
    pos.copy(checkpoint); vel.set(0, 0, 0);
    showMsg(why || "Oof!", 1.2);
    beep(220, 0.35, "sawtooth", 80);
  }

  // ---------------------------------------------------------------- cars
  function toggleCar() {
    if (driving) { leaveCar(); return; }
    let best = null, bd = 7;
    for (const e of ents) if (e.k === "car") { const d = e.bounds.c.distanceTo(pos); if (d < bd + Math.max(e.o.size[0], e.o.size[2]) / 2) { bd = d; best = e; } }
    if (!best) return;
    driving = best;
    best.speed = 0; best.vy = 0;
    best.yaw = best.g.rotation.y;
    player.visible = false;
    camDist = Math.max(camDist, 16);
    $("hudHelp").textContent = "W / S drive · A / D steer · Space brake · E: get out · Esc: stop";
  }
  function leaveCar() {
    const e = driving; driving = null;
    const side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw)).multiplyScalar(e.o.size[0] / 2 + 1.5);
    pos.copy(e.g.position).add(side); pos.y += 1; vel.set(0, 0, 0);
    player.visible = true;
    $("hudHelp").textContent = "W A S D move · Space jump · drag or arrows to look · E: car · Esc: stop";
  }

  // ---------------------------------------------------------------- collision
  const _p = new THREE.Vector3(), _local = new THREE.Vector3(), _iq = new THREE.Quaternion(), _n = new THREE.Vector3();
  // Push a sphere out of a box. Returns the push (world) or null.
  function pushOut(center, r, b) {
    _iq.copy(b.q).invert();
    _local.copy(center).sub(b.c).applyQuaternion(_iq);
    const cx = Math.max(-b.h.x, Math.min(b.h.x, _local.x)), cy = Math.max(-b.h.y, Math.min(b.h.y, _local.y)), cz = Math.max(-b.h.z, Math.min(b.h.z, _local.z));
    let dx = _local.x - cx, dy = _local.y - cy, dz = _local.z - cz;
    let d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r * r) return null;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), k = (r - d) / d;
      return _n.set(dx * k, dy * k, dz * k).applyQuaternion(b.q).clone();
    }
    // the center is inside the box: leave by the closest face
    const ox = b.h.x - Math.abs(_local.x), oy = b.h.y - Math.abs(_local.y), oz = b.h.z - Math.abs(_local.z);
    if (oy <= ox && oy <= oz) _n.set(0, Math.sign(_local.y || 1) * (oy + r), 0);
    else if (ox <= oz) _n.set(Math.sign(_local.x || 1) * (ox + r), 0, 0);
    else _n.set(0, 0, Math.sign(_local.z || 1) * (oz + r));
    return _n.applyQuaternion(b.q).clone();
  }
  function touches(b, extra) { // does the player (or the car they're driving) touch box b?
    if (driving) {
      const e = driving, r = carRadius(e), half = e.o.size[2] * 0.28;
      const fwd = _n.set(-Math.sin(e.yaw), 0, -Math.cos(e.yaw)).clone();
      for (const sgn of [1, -1]) if (pushOut(_p.copy(e.g.position).addScaledVector(fwd, half * sgn).setY(e.g.position.y + r), r + (extra || 0) + 0.3, b)) return true;
      return false;
    }
    for (const h of SPHERES) if (pushOut(_p.set(pos.x, pos.y + h, pos.z), RADIUS + (extra || 0), b)) return true;
    return false;
  }
  function carRadius(e) { return Math.min(e.o.size[0], e.o.size[1] * 1.4) * 0.42; }
  function collidePlayer() {
    grounded = false; groundEnt = null;
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (const e of solids()) {
        if (e === driving) continue;
        if (e.bounds.c.distanceToSquared(pos) > (e.bounds.h.length() + 4) ** 2) continue;
        for (const b of e.boxes) {
          for (const h of SPHERES) {
            const push = pushOut(_p.set(pos.x, pos.y + h, pos.z), RADIUS, b);
            if (!push) continue;
            any = true;
            const len = push.length(), ny = push.y / (len || 1);
            if (ny > 0.55) { grounded = true; groundEnt = e; if (vel.y < 0) vel.y = 0; pos.y += push.y; pos.x += push.x * 0.2; pos.z += push.z * 0.2; }
            else { pos.add(push); if (ny < -0.6 && vel.y > 0) vel.y = 0; }
          }
        }
      }
      if (!any) break;
    }
  }

  // ---------------------------------------------------------------- the loop
  const camTarget = new THREE.Vector3(), camDir = new THREE.Vector3(), camRay = new THREE.Raycaster(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const entById = new Map(ents.map((e) => [e.o.id, e]));
  function update(dt) {
    if (!running) return;
    if (!won && !lost) time += dt;
    // moving things first (so riders move with them); things scripts move count too
    for (const e of ents) if (e.moving || e.scripted) { e.prevPos.copy(e.g.position); e.prevQ.copy(e.g.quaternion); }
    applyScripts();
    for (const e of ents) {
      if (!e.moving || e === driving) continue;
      const b = e.o.b;
      if (e.k === "spin") e.g.quaternion.copy(e.baseQ).premultiply(q.setFromAxisAngle(Y, (time * (Number(b.speed) || 0)) * D2R));
      else if (e.k === "move") {
        const dist = Math.max(0.1, Number(b.distance) || 0), w = 2 * (Number(b.speed) || 0) / dist;
        const off = Math.sin(time * w) * dist / 2;
        e.g.position.copy(e.base); e.g.position[b.axis || "x"] += off;
      } else if (e.k === "door") {
        const near = e.bounds.c.distanceTo(_p.set(pos.x, pos.y + 1.5, pos.z)) < 7 + e.o.size[0] / 2;
        e.offset.y += ((near ? e.o.size[1] * 0.95 : 0) - e.offset.y) * Math.min(1, dt * 5);
        e.g.position.copy(e.base).add(e.offset);
      }
      if (e.k !== "car") refreshBoxes(e);
    }
    // ride along on whatever we stand on
    if (groundEnt && (groundEnt.moving || groundEnt.scripted) && !driving) {
      const e = groundEnt;
      const dq = e.g.quaternion.clone().multiply(e.prevQ.clone().invert());
      const rel = pos.clone().sub(e.prevPos).applyQuaternion(dq);
      pos.copy(e.g.position).add(rel);
      facing += Math.atan2(2 * (dq.w * dq.y + dq.x * dq.z), 1 - 2 * (dq.y * dq.y + dq.x * dq.x)) || 0;
    }
    if (keys.has("arrowleft")) camYaw += dt * 2.2; if (keys.has("arrowright")) camYaw -= dt * 2.2;
    if (keys.has("arrowup")) camPitch = Math.min(1.3, camPitch + dt * 1.2); if (keys.has("arrowdown")) camPitch = Math.max(-0.2, camPitch - dt * 1.2);

    if (driving) driveCar(dt);
    else {
      const steps = dt > 1 / 45 ? 2 : 1, h = dt / steps;
      for (let i = 0; i < steps; i++) movePlayer(h);
    }
    if ((driving ? driving.g.position.y : pos.y) < lowest - 60) respawn("You fell!");

    // touching things (on foot or in a car)
    for (const e of ents) {
      if (e.done || e === driving || e.off) continue;
      const b = e.o.b;
      const hurts = e.k === "lava" || ((e.k === "spin" || e.k === "move") && b.hurts);
      if (!hurts && !["coin", "checkpoint", "finish", "jump"].includes(e.k)) continue;
      if (e.bounds.c.distanceToSquared(pos) > (e.bounds.h.length() + 4) ** 2) continue;
      const box = e.k === "spin" && e.boxes.length ? e.boxes[0] : e.bounds;
      if (!touches(box, 0.12)) continue;
      if (hurts) { if (mods.god || won || lost) continue; respawn("Ouch! Back to the checkpoint"); break; }
      if (e.k === "coin") { e.done = true; e.g.visible = false; coins += Number(b.points) || 1; beep(990, 0.12, "square", 1500); }
      else if (e.k === "jump") { if (driving) driving.vy = Math.max(driving.vy || 0, Number(b.power) || 30); else { vel.y = Number(b.power) || 30; grounded = false; } beep(330, 0.25, "triangle", 900); }
      else if (e.k === "checkpoint") { const cp = new THREE.Vector3(e.o.pos[0], e.o.pos[1] + e.o.size[1] + 0.2, e.o.pos[2]); if (cp.distanceTo(checkpoint) > 0.5) { checkpoint.copy(cp); showMsg("Checkpoint!"); beep(660, 0.2, "triangle", 990); } }
      else if (e.k === "finish" && !won && !lost) { won = true; showMsg((b.message || "You win!") + "\n" + fmt(time) + (totalCoins ? "  ·  🪙 " + coins + " / " + totalCoins : ""), 999); beep(523, 0.15, "square"); setTimeout(() => beep(784, 0.3, "square"), 150); }
    }
    // monsters breathe (and ghosts bob): just the look, not where they really are
    for (const e of ents) if (e.k !== "car" && e.o.type === "monster" && e.g.userData.inner) { const m = e.g.userData.inner; m.position.y = Math.sin(time * 3 + e.base.x) * e.o.size[1] * (e.o.mon && e.o.mon.float ? 0.05 : 0.015); }
    // spinning coins
    for (const e of ents) if (e.k === "coin" && !e.done && !e.scripted) e.g.quaternion.copy(e.baseQ).premultiply(q.setFromAxisAngle(Y, time * 2.5));
    // touch Switches + parts whose scripts wait for a touch (they fire once each time you step on)
    for (const e of ents) {
      if (!(e.k === "switch" && e.o.b.how === "touch") && !wantTouch.has(e.o.id)) continue;
      const now = !e.off && e.bounds.c.distanceToSquared(pos) < (e.bounds.h.length() + 4) ** 2 && touches(e.bounds, 0.15);
      if (now && !e.touching) { if (e.k === "switch" && e.o.b.how === "touch") flip(e); if (host && wantTouch.has(e.o.id)) host.event("touch", e.o.id); }
      if (!now && e.touching && host && wantTouch.has(e.o.id)) host.event("untouch", e.o.id);
      e.touching = now;
    }
    if (host) host.tick(dt, { x: r3(pos.x), y: r3(pos.y), z: r3(pos.z), ry: r3(facing / D2R), coins, health: sc.health }, movedList());
    updateMixers(dt);
    if (guiDirty) drawGui();

    // the avatar + camera
    player.position.copy(pos); player.rotation.y = facing;
    animateAvatar(player, dt, grounded, Math.hypot(vel.x, vel.z));
    const follow = driving ? driving.g.position : pos;
    camTarget.copy(follow); camTarget.y += driving ? 2 : 2.4;
    if (driving) camYaw += angleDiff(camYaw, driving.yaw) * Math.min(1, dt * 2);
    // camera behind the player, pulled in front of any wall in between
    camDir.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
    let dist = camDist;
    camRay.set(camTarget, camDir); camRay.far = camDist;
    for (const h of camRay.intersectObjects(world.root.children, true)) {
      if (!h.object.visible || (h.object.material && h.object.material.transparent)) continue;
      let p = h.object; while (p && !p.userData.id) p = p.parent;
      const e = p && entById.get(p.userData.id);
      if (!e || !e.o.solid || !e.o.visible || e === driving) continue;
      dist = Math.max(1.5, h.distance - 0.4); break;
    }
    camera.position.copy(camTarget).addScaledVector(camDir, dist);
    camera.lookAt(camTarget);
    if (viewCam) { // looking through a Security Camera: from just in front of its lens
      camera.quaternion.copy(viewCam.g.quaternion);
      camera.position.copy(viewCam.g.position).add(_p.set(0, viewCam.o.size[1] * 0.64, -viewCam.o.size[2] * 0.55).applyQuaternion(viewCam.g.quaternion));
    }
    world.follow(viewCam ? viewCam.g.position : follow);

    // HUD
    $("hudCoins").textContent = "🪙 " + coins + (totalCoins ? " / " + totalCoins : "");
    $("hudTime").textContent = "⏱ " + fmt(time);
    if (sc.showHealth) { const hp = $("hudHealth"); hp.classList.remove("hidden"); hp.textContent = "❤ " + Math.ceil(sc.health); hp.classList.toggle("low", sc.health <= 30); }
    if (msgTimer > 0 && (msgTimer -= dt) <= 0) $("hudMsg").classList.remove("show");
    drawBubbles();
  }

  function movePlayer(dt) {
    const free = !sc.frozen && !won && !lost;
    const f = free ? (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0) : 0, s = free ? (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0) : 0;
    const want = new THREE.Vector3();
    if (f || s) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw); // camera forward on the ground
      want.set(fx * f - fz * s, 0, fz * f + fx * s).normalize().multiplyScalar(S.walk * (keys.has("shift") && !mods.fly ? 1.5 : 1) * (mods.speed ? 2.2 : 1) * sc.speed);
      facing += angleDiff(facing, Math.atan2(-want.x, -want.z)) * Math.min(1, dt * 12);
    }
    const acc = grounded ? 12 : 4;
    vel.x += (want.x - vel.x) * Math.min(1, dt * acc); vel.z += (want.z - vel.z) * Math.min(1, dt * acc);
    if (mods.fly) { // flying: no gravity, Space up, Shift down
      const up = (keys.has(" ") ? 1 : 0) - (keys.has("shift") ? 1 : 0);
      vel.y += (up * S.walk * (mods.speed ? 2.2 : 1) - vel.y) * Math.min(1, dt * 8);
    } else {
      if (keys.has(" ") && grounded && free) { vel.y = S.jump * (mods.jump ? 1.7 : 1) * Math.sqrt(sc.jump); grounded = false; beep(440, 0.08, "square", 660); }
      vel.y -= S.gravity * (mods.gravity ? 0.35 : 1) * dt;
    }
    vel.y = Math.max(vel.y, -120);
    pos.addScaledVector(vel, dt);
    collidePlayer();
  }

  function driveCar(dt) {
    const e = driving, top = Number(e.o.b.speed) || 40;
    const f = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0), s = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
    if (keys.has(" ")) e.speed *= Math.pow(0.02, dt);
    else if (f) e.speed += f * (f * e.speed < 0 ? 60 : 28) * dt;
    else e.speed *= Math.pow(0.4, dt);
    e.speed = Math.max(-top * 0.4, Math.min(top, e.speed));
    e.yaw -= s * dt * 1.9 * Math.max(-1, Math.min(1, e.speed / 10));
    e.vy = (e.vy || 0) - S.gravity * dt;
    const fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
    const p = e.g.position;
    p.addScaledVector(fwd, e.speed * dt); p.y += e.vy * dt;
    // the car is two balls (front + back) that bump into solid things
    const r = carRadius(e), half = e.o.size[2] * 0.28;
    let onGround = false;
    for (let pass = 0; pass < 3; pass++) for (const sgn of [1, -1]) {
      const c = p.clone().addScaledVector(fwd, half * sgn); c.y += r;
      for (const o of solids()) {
        if (o === e || o.bounds.c.distanceToSquared(c) > (o.bounds.h.length() + r + 2) ** 2) continue;
        for (const b of o.boxes) {
          const push = pushOut(c, r, b);
          if (!push) continue;
          const ny = push.y / (push.length() || 1);
          if (ny > 0.5) { onGround = true; if (e.vy < 0) e.vy = 0; p.y += push.y; }
          else { p.x += push.x; p.z += push.z; e.speed *= 0.6; if (ny < -0.5 && e.vy > 0) e.vy = 0; }
          c.add(push);
        }
      }
    }
    if (onGround && Math.abs(e.speed) > 1) e.vy = Math.min(e.vy, 0);
    e.g.rotation.set(0, e.yaw, 0);
    e.o.rot = [0, e.yaw / D2R, 0];
    refreshBoxes(e);
    pos.copy(p);
  }
  function refreshBoxes(e) {
    if (e.o.solid) e.boxes = worldBoxes(e.o, e.g.position, e.g.quaternion);
    e.bounds = boundsBox(e.o, e.g.position, e.g.quaternion);
  }

  // Talking characters: a speech bubble when you walk up.
  const _v = new THREE.Vector3();
  function drawBubbles() {
    let html = "";
    const rect = canvas.getBoundingClientRect();
    for (const e of ents) {
      if (e.k !== "npc" || !e.g.visible || e.off) continue;
      if (e.bounds.c.distanceTo(pos) > 10 || driving) continue;
      _v.set(e.g.position.x, e.g.position.y + e.o.size[1] + 0.6, e.g.position.z).project(camera);
      if (_v.z > 1) continue;
      html += '<div class="bubble" style="left:' + ((_v.x + 1) / 2 * rect.width) + "px;top:" + ((1 - _v.y) / 2 * rect.height) + 'px"><b>' + esc(e.o.name) + "</b>" + esc(e.o.text || "...") + "</div>";
    }
    const box = $("bubbles");
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  // ---------------------------------------------------------------- losing (a script said lose)
  function endScreen(loseText) {
    $("endBox").classList.toggle("hidden", loseText == null);
    if (loseText != null) $("endText").textContent = loseText;
  }

  // ---------------------------------------------------------------- scripts
  const wantClick = new Set(), wantTouch = new Set();
  let wantKeys = false, host = null, pending = [];
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const known = new Set(game.objects.map((o) => o.id).concat(gui.map((g) => g.id)));
  const scripts = (game.scripts || []).filter((x) => !x.on || known.has(x.on)); // (scripts inside deleted things don't run)
  if (scripts.length) {
    const things = ents.map((e) => ({ id: e.o.id, kind: "part", type: e.o.type, name: e.o.name, x: e.o.pos[0], y: e.o.pos[1], z: e.o.pos[2], ry: e.o.rot[1],
      sx: e.o.size[0], sy: e.o.size[1], sz: e.o.size[2], color: e.o.color, visible: true, solid: e.o.solid, text: e.o.text || "", transp: e.o.transp || 0 }))
      .concat(gui.map((g) => ({ id: g.id, kind: "gui", type: g.kind, name: g.name, x: g.x, y: g.y, z: 0, ry: 0, sx: g.w || 0, sy: g.h || 0, sz: 0, color: g.color, visible: g.visible, solid: false, text: g.text, transp: g.transp || 0 })));
    host = startScripts(scripts, things, { x: pos.x, y: pos.y, z: pos.z, coins, health: 100 }, {
      apply(c) { pending.push(...c.slice(0, 4000)); if (pending.length > 8000) pending = pending.slice(-8000); },
      fatal(text) { out("err", text); showMsg(text, 4); },
    });
  }
  function out(kind, text, where) { if (opts.output) opts.output(kind, text, where); } // (where = {id, line}: which script)
  // Moving things the scripts should know about (their positions change without the scripts doing it).
  const _eu = new THREE.Euler();
  function movedList() {
    const m = [];
    for (const e of ents) if (e.moving && !e.done) m.push([e.o.id, r3(e.g.position.x), r3(e.g.position.y), r3(e.g.position.z), r3(_eu.setFromQuaternion(e.g.quaternion, "YXZ").y / D2R)]);
    return m;
  }
  const NUM = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
  let clones = 0;
  function rebuildEnt(e) {
    const g2 = buildObject(e.o);
    g2.position.copy(e.g.position); g2.quaternion.copy(e.g.quaternion); g2.visible = e.g.visible;
    world.root.remove(e.g); world.root.add(g2); e.g = g2;
    refreshBoxes(e);
  }
  // Every command from the scripts, checked before it changes anything.
  function applyScripts() {
    if (!pending.length) return;
    const list = pending; pending = [];
    for (const c of list) {
      if (!Array.isArray(c)) continue;
      const [k, a, b, cc, d] = c;
      const e = typeof a === "string" ? entById.get(a) : null, g = typeof a === "string" ? guiById.get(a) : null;
      if (k === "pos") {
        if (g) { const x = NUM(b, -50, 150), y = NUM(cc, -50, 150); if (x != null && y != null) { g.x = x; g.y = y; guiDirty = true; } }
        else if (e && e !== driving) {
          const x = NUM(b, -5000, 5000), y = NUM(cc, -5000, 5000), z = NUM(d, -5000, 5000);
          if (x == null || y == null || z == null) continue;
          e.g.position.set(x, y, z); e.o.pos = [x, y, z]; e.base.copy(e.g.position); e.scripted = true; refreshBoxes(e);
        }
      } else if (k === "rot" && e && e !== driving) {
        const ry = NUM(b, -1e6, 1e6); if (ry == null) continue;
        e.g.rotation.set(e.o.rot[0] * D2R, ry * D2R, e.o.rot[2] * D2R); e.o.rot[1] = ry % 360; e.baseQ.copy(e.g.quaternion); e.scripted = true; refreshBoxes(e);
      }
      else if (k === "size" && e) { const s = [b, cc, d].map((v) => NUM(v, 0.1, 1024)); if (s.includes(null)) continue; e.o.size = s; rebuildEnt(e); }
      else if (k === "vis") { if (g || e) setOn(a, !!b); }
      else if (k === "transp") { const v = NUM(b, 0, 100); if (v == null) continue; if (g) { g.transp = v; guiDirty = true; } else if (e) { e.o.transp = v; rebuildEnt(e); } }
      else if (k === "solid" && e) { e.o.solid = !!b; e.boxes = e.o.solid ? worldBoxes(e.o, e.g.position, e.g.quaternion) : []; }
      else if (k === "color" && /^#[0-9a-f]{6}$/i.test(b)) { if (g) { g.color = b; guiDirty = true; } else if (e) { e.o.color = b; rebuildEnt(e); } }
      else if (k === "text") { const t = filterText(b, g ? 60 : 120); if (g) { g.text = t; guiDirty = true; } else if (e) { e.o.text = t; if (e.k !== "npc") rebuildEnt(e); } }
      else if (k === "anim" && e) { const m = e.g.userData.inner && e.g.userData.inner.userData.copy; if (m && m.userData.play) m.userData.play(String(b) || true); }
      else if (k === "want") { if (a === "click") wantClick.add(String(b)); else if (a === "touch") wantTouch.add(String(b)); else if (a === "keys") wantKeys = true; }
      else if (k === "clone" && e && typeof b === "string" && /^k\d{1,6}$/.test(b) && !entById.has(b) && clones < 300) {
        clones++;
        const o = JSON.parse(JSON.stringify(e.o)); o.id = b;
        const n = makeEnt(o); n.g.position.copy(e.g.position); n.g.quaternion.copy(e.g.quaternion); n.base.copy(n.g.position);
        ents.push(n); entById.set(b, n);
      } else if (k === "destroy") {
        if (e) { world.root.remove(e.g); ents.splice(ents.indexOf(e), 1); entById.delete(a); if (e === viewCam) lookThrough(null); if (groundEnt === e) groundEnt = null; }
        else if (g) { gui.splice(gui.indexOf(g), 1); guiById.delete(a); guiDirty = true; }
      }
      else if (k === "msg") showMsg(filterText(a, 200), NUM(b, 0.5, 30) || 2.2);
      else if (k === "print") out("print", String(a).slice(0, 500));
      else if (k === "err") out("err", "📜 " + String(a).slice(0, 40) + (b ? " (line " + b + ")" : "") + ": " + String(cc).slice(0, 300), { id: String(d || ""), line: +b || 0 });
      else if (k === "ptp") { const x = NUM(a, -5000, 5000), y = NUM(b, -5000, 5000), z = NUM(cc, -5000, 5000); if (x == null || y == null || z == null) continue; if (driving) leaveCar(); pos.set(x, y, z); vel.set(0, 0, 0); }
      else if (k === "prespawn") respawn("Back to the checkpoint!");
      else if (k === "pspeed") sc.speed = NUM(a, 0, 10) ?? 1;
      else if (k === "pjump") sc.jump = NUM(a, 0, 10) ?? 1;
      else if (k === "pfreeze") sc.frozen = !!a;
      else if (k === "pcoins") coins = Math.round(NUM(a, 0, 1e6) || 0);
      else if (k === "phealth") {
        sc.health = NUM(a, 0, 1000) ?? 100; sc.showHealth = true;
        if (sc.health <= 0) { sc.health = 100; if (!mods.god) respawn("Ouch! Out of health"); }
      }
      else if (k === "sound") sound(String(a));
      else if (k === "win" && !won && !lost) { won = true; showMsg(filterText(a, 120) || "You win!", 999); sound("win"); }
      else if (k === "lose" && !won && !lost) { lost = true; $("hudMsg").classList.remove("show"); endScreen(filterText(a, 120) || "Game over!"); sound("lose"); }
      else if (k === "sky" && ["day", "sunset", "night", "space"].includes(a)) world.setSky(a);
      else if (k === "cam") lookThrough(a ? entById.get(a) || null : null);
    }
  }

  let running = true;
  function stop(again) {
    if (!running) return;
    running = false;
    if (host) host.stop();
    if (devPanel) devPanel.remove();
    clearMixers();
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); window.removeEventListener("blur", blur);
    canvas.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("wheel", onWheel);
    scene.remove(player);
    if (touchUI) touchUI.remove();
    guiLayer.remove();
    while (world.root.children.length) world.root.remove(world.root.children[0]);
    $("hud").classList.add("hidden"); $("hud").classList.remove("cam-view"); $("hudMsg").classList.remove("show"); $("bubbles").innerHTML = "";
    $("hud").querySelectorAll(".cam-overlay, .end-box").forEach((x) => x.remove());
    $("hudHealth").classList.add("hidden");
    $("hudHelp").textContent = "W A S D move · Space jump · drag or arrows to look · E: car · Esc: stop";
    try { if (ac) ac.close(); } catch {}
    opts.onStop(again === true);
  }
  drawGui();
  return { update, stop, pos, vel, isOn, get health() { return sc.health; }, get lost() { return lost; }, get viewCam() { return viewCam ? viewCam.o.name : ""; }, get host() { return host; }, get coins() { return coins; }, get won() { return won; }, get driving() { return driving ? driving.o.name : ""; }, get checkpoint() { return checkpoint; } }; // (pos / vel etc. for testing)
}

// Touch screens: a joystick (left) that presses W A S D for you, and JUMP / CAR buttons (right).
// Dragging anywhere else on the screen still turns the camera (the canvas pointer handlers above).
function addTouchControls(keys, toggleCar) {
  const box = document.createElement("div");
  box.className = "touch";
  box.innerHTML = '<div class="stick" id="tStick"><div class="knob" id="tKnob"></div></div>' +
    '<button class="tbtn jump" id="tJump" type="button">JUMP</button><button class="tbtn car" id="tCar" type="button">CAR</button>';
  document.getElementById("hud").appendChild(box);
  const stick = box.querySelector("#tStick"), knob = box.querySelector("#tKnob");
  let sid = null;
  const setDir = (dx, dy) => {
    const set = (k, on) => (on ? keys.add(k) : keys.delete(k));
    set("w", dy < -0.35); set("s", dy > 0.35); set("a", dx < -0.35); set("d", dx > 0.35);
    knob.style.transform = "translate(" + dx * 34 + "px," + dy * 34 + "px)";
  };
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    setDir(dx, dy);
  };
  stick.addEventListener("pointerdown", (e) => { sid = e.pointerId; stick.setPointerCapture(sid); move(e); e.preventDefault(); });
  stick.addEventListener("pointermove", (e) => { if (e.pointerId === sid) move(e); });
  const end = (e) => { if (e.pointerId === sid) { sid = null; setDir(0, 0); } };
  stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
  const hold = (el, k) => {
    el.addEventListener("pointerdown", (e) => { keys.add(k); e.preventDefault(); });
    for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, () => keys.delete(k));
  };
  hold(box.querySelector("#tJump"), " ");
  box.querySelector("#tCar").addEventListener("pointerdown", (e) => { e.preventDefault(); toggleCar(); });
  return box;
}

function fmt(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + String(s).padStart(2, "0"); }
function angleDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
