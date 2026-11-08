// PLAY TEST for GunnerVerse Studio: runs a game (game.js) in the same 3D world. A blocky player with simple physics
// (gravity + pushing out of solid boxes), a third-person camera, cars you drive with E, and every behavior from
// assets.js BEHAVIORS: coins, checkpoints, lava, jump pads, spinners, moving platforms, doors, talking characters, finish.
// The player is three spheres stacked up (feet, middle, head); solid things are boxes (world.js worldBoxes).
import * as THREE from "../vendor/three.module.js";
import { buildObject, worldBoxes, boundsBox } from "./world.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D2R = Math.PI / 180;
const RADIUS = 0.6, SPHERES = [0.6, 1.5, 2.4]; // the player's body (heights above the feet)

export function startPlay(world, game, opts) {
  const { scene, camera } = world;
  const S = game.settings;
  world.setSky(S.sky);
  // The editor's objects come back when Play stops (editor.js rebuildAll).
  while (world.root.children.length) world.root.remove(world.root.children[0]);

  // ---------------------------------------------------------------- the things in the game
  const ents = game.objects.map((o) => {
    const g = buildObject(o);
    g.visible = o.visible;
    world.root.add(g);
    const e = { o, g, k: o.b.k, base: g.position.clone(), baseQ: g.quaternion.clone(), offset: new THREE.Vector3(), done: false, prevPos: g.position.clone(), prevQ: g.quaternion.clone() };
    e.moving = ["spin", "move", "door", "car"].includes(e.k);
    e.boxes = o.solid ? worldBoxes(o) : [];
    e.bounds = boundsBox(o);
    return e;
  });
  const solids = () => ents.filter((e) => e.boxes.length && !(e.k === "coin" && e.done));
  let lowest = Math.min(0, ...game.objects.map((o) => o.pos[1]));

  // ---------------------------------------------------------------- the player
  const player = makeAvatar();
  scene.add(player);
  const spawnEnt = ents.find((e) => e.k === "spawn");
  const spawnAt = spawnEnt ? new THREE.Vector3(spawnEnt.o.pos[0], spawnEnt.o.pos[1] + spawnEnt.o.size[1] + 0.2, spawnEnt.o.pos[2]) : new THREE.Vector3(0, 6, 0);
  let checkpoint = spawnAt.clone();
  const pos = spawnAt.clone(), vel = new THREE.Vector3();
  let grounded = false, groundEnt = null, facing = spawnEnt ? spawnEnt.o.rot[1] * D2R : 0;
  let camYaw = facing, camPitch = 0.35, camDist = 14; // (camera behind the player)
  let coins = 0, time = 0, won = false, driving = null, msgTimer = 0;
  const totalCoins = ents.filter((e) => e.k === "coin").reduce((n, e) => n + (Number(e.o.b.points) || 1), 0);

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (e.type === "keydown") {
      if (e.key === "Escape") { stop(); return; }
      if (k === "e" && !e.repeat) toggleCar();
      if (["w", "a", "s", "d", " ", "arrowleft", "arrowright", "arrowup", "arrowdown", "shift"].includes(k)) e.preventDefault();
      keys.add(k);
    } else keys.delete(k);
  };
  let drag = null;
  const canvas = world.renderer.domElement;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return; // (a finger on the joystick doesn't turn the camera)
    camYaw -= (e.clientX - drag.x) * 0.006; camPitch = Math.max(-0.2, Math.min(1.3, camPitch + (e.clientY - drag.y) * 0.005));
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
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
  canvas.focus();
  showMsg(game.name, 2);

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
    if (!won) time += dt;
    // moving things first (so riders move with them)
    for (const e of ents) {
      if (!e.moving || e === driving) continue;
      e.prevPos.copy(e.g.position); e.prevQ.copy(e.g.quaternion);
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
    if (groundEnt && groundEnt.moving && !driving) {
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
      if (e.done || e === driving) continue;
      const b = e.o.b;
      const hurts = e.k === "lava" || ((e.k === "spin" || e.k === "move") && b.hurts);
      if (!hurts && !["coin", "checkpoint", "finish", "jump"].includes(e.k)) continue;
      if (e.bounds.c.distanceToSquared(pos) > (e.bounds.h.length() + 4) ** 2) continue;
      const box = e.k === "spin" && e.boxes.length ? e.boxes[0] : e.bounds;
      if (!touches(box, 0.12)) continue;
      if (hurts) { respawn("Ouch! Back to the checkpoint"); break; }
      if (e.k === "coin") { e.done = true; e.g.visible = false; coins += Number(b.points) || 1; beep(990, 0.12, "square", 1500); }
      else if (e.k === "jump") { if (driving) driving.vy = Math.max(driving.vy || 0, Number(b.power) || 30); else { vel.y = Number(b.power) || 30; grounded = false; } beep(330, 0.25, "triangle", 900); }
      else if (e.k === "checkpoint") { const cp = new THREE.Vector3(e.o.pos[0], e.o.pos[1] + e.o.size[1] + 0.2, e.o.pos[2]); if (cp.distanceTo(checkpoint) > 0.5) { checkpoint.copy(cp); showMsg("Checkpoint!"); beep(660, 0.2, "triangle", 990); } }
      else if (e.k === "finish" && !won) { won = true; showMsg((b.message || "You win!") + "\n" + fmt(time) + (totalCoins ? "  ·  🪙 " + coins + " / " + totalCoins : ""), 999); beep(523, 0.15, "square"); setTimeout(() => beep(784, 0.3, "square"), 150); }
    }
    // spinning coins
    for (const e of ents) if (e.k === "coin" && !e.done) e.g.quaternion.copy(e.baseQ).premultiply(q.setFromAxisAngle(Y, time * 2.5));

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
    world.follow(follow);

    // HUD
    $("hudCoins").textContent = "🪙 " + coins + (totalCoins ? " / " + totalCoins : "");
    $("hudTime").textContent = "⏱ " + fmt(time);
    if (msgTimer > 0 && (msgTimer -= dt) <= 0) $("hudMsg").classList.remove("show");
    drawBubbles();
  }

  function movePlayer(dt) {
    const f = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0), s = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
    const want = new THREE.Vector3();
    if (f || s) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw); // camera forward on the ground
      want.set(fx * f - fz * s, 0, fz * f + fx * s).normalize().multiplyScalar(S.walk * (keys.has("shift") ? 1.5 : 1));
      facing += angleDiff(facing, Math.atan2(-want.x, -want.z)) * Math.min(1, dt * 12);
    }
    const acc = grounded ? 12 : 4;
    vel.x += (want.x - vel.x) * Math.min(1, dt * acc); vel.z += (want.z - vel.z) * Math.min(1, dt * acc);
    if (keys.has(" ") && grounded) { vel.y = S.jump; grounded = false; beep(440, 0.08, "square", 660); }
    vel.y -= S.gravity * dt;
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
      if (e.k !== "npc" || !e.g.visible) continue;
      if (e.bounds.c.distanceTo(pos) > 10 || driving) continue;
      _v.set(e.g.position.x, e.g.position.y + e.o.size[1] + 0.6, e.g.position.z).project(camera);
      if (_v.z > 1) continue;
      html += '<div class="bubble" style="left:' + ((_v.x + 1) / 2 * rect.width) + "px;top:" + ((1 - _v.y) / 2 * rect.height) + 'px"><b>' + esc(e.o.name) + "</b>" + esc(e.o.text || "...") + "</div>";
    }
    const box = $("bubbles");
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  let running = true;
  function stop() {
    if (!running) return;
    running = false;
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); window.removeEventListener("blur", blur);
    canvas.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("wheel", onWheel);
    scene.remove(player);
    if (touchUI) touchUI.remove();
    while (world.root.children.length) world.root.remove(world.root.children[0]);
    $("hud").classList.add("hidden"); $("hudMsg").classList.remove("show"); $("bubbles").innerHTML = "";
    $("hudHelp").textContent = "W A S D move · Space jump · drag or arrows to look · E: car · Esc: stop";
    try { if (ac) ac.close(); } catch {}
    opts.onStop();
  }
  return { update, stop, pos, vel, get coins() { return coins; }, get won() { return won; }, get driving() { return driving ? driving.o.name : ""; }, get checkpoint() { return checkpoint; } }; // (pos / vel etc. for testing)
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

// The player: a blocky GunnerVerse runner (green helmet with a glowing visor, dark suit). Feet at y = 0, faces -z.
function makeAvatar() {
  const g = new THREE.Group();
  const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: e ? c : 0x000000, emissiveIntensity: e ? 0.8 : 0 });
  const part = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; (parent || g).add(b); return b; };
  const suit = mat(0x1b2420), green = mat(0x1fae45), skin = mat(0xe0a878);
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  legL.position.set(-0.32, 1.2, 0); legR.position.set(0.32, 1.2, 0); armL.position.set(-0.95, 2.25, 0); armR.position.set(0.95, 2.25, 0);
  part(0.55, 1.2, 0.6, suit, 0, -0.6, 0, legL); part(0.55, 1.2, 0.6, suit, 0, -0.6, 0, legR);
  part(0.45, 1.05, 0.5, suit, 0, -0.5, 0, armL); part(0.45, 1.05, 0.5, suit, 0, -0.5, 0, armR);
  part(0.4, 0.3, 0.45, skin, 0, -1.1, 0, armL); part(0.4, 0.3, 0.45, skin, 0, -1.1, 0, armR);
  g.add(legL, legR, armL, armR);
  part(1.4, 1.15, 0.75, suit, 0, 1.78, 0);
  part(1.42, 0.18, 0.77, green, 0, 1.3, 0);                       // belt stripe
  part(0.9, 0.85, 0.85, skin, 0, 2.78, 0);                         // head
  part(1.0, 0.45, 0.95, green, 0, 3.23, 0);                        // helmet
  part(0.95, 0.26, 0.12, mat(0x39ff6a, true), 0, 2.88, -0.45);     // visor (front = -z, like cars)
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.t = 0;
  return g;
}
function animateAvatar(g, dt, grounded, speed) {
  const L = g.userData.limbs;
  g.userData.t += dt * Math.min(1, speed / 6) * 10;
  const swing = grounded ? Math.sin(g.userData.t) * Math.min(0.8, speed / 14) : 0.5;
  L.legL.rotation.x = swing; L.legR.rotation.x = -swing; L.armL.rotation.x = -swing; L.armR.rotation.x = swing;
}
