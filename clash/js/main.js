// CLASH: a multiplayer sorcerer fighting game on GunnerVerse (game.gamergunner.com/clash/).
// Everyone playing Clash lands on the same live server (relay live.js, key "clash", 16 per server). Pick a fighter, spawn
// somewhere random, fight; when you're KO'd you pick again. Alone on a server? Two practice bots fight you.
// Each game moves its own fighter and decides its own hits (moves.js); the player who gets hit takes the damage.
import * as THREE from "/create/vendor/three.module.js";
import { joinLive, newCode } from "/create/js/net.js";
import { FIGHTERS, FIGHTER_IDS, buildFighter, animateFighter, fighterPicture } from "./fighters.js";
import { buildArena } from "./arena.js";
import { castMove, castData, hitFx, fwdOf, aimTarget, burst, wave } from "./moves.js";
import { sfx, unlockSound } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const MAX_HP = 150, WALK = 19, JUMP = 23, GRAVITY = 62, DASH_SPEED = 58, DASH_TIME = 0.22, DASH_CD = 1.5;
const ULT_PER_SEC = 1.0, ULT_PER_DMG = 0.55, DOM_PER_ULT = 34, DOM_PER_SEC = 0.12, DOM_PER_DMG = 0.06;

// ---------------------------------------------------------------- the 3D world
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
const arena = buildArena(scene);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------------------------------------------------------------- fighters (me, other players, practice bots)
let me = null, myId = 0, myName = "You", myKills = 0, lastChar = "";
const remotes = new Map(); // server id -> fighter
let bots = [];
const effects = [];
function makeFighter(kind, id, name, char) {
  const f = { kind, id, name, char, g: null, pos: V(), vel: V(), facing: 0, hp: MAX_HP, grounded: true, mode: "idle", rag: 0, ragging: false, stun: 0, slow: 0, frz: 0, iframes: 0,
    lockT: 0, poseT: 0, pose: "", dashT: 0, dashV: V(), dashCd: 0, block: false, dead: false, deadT: 0, punchT: 0, punchSide: 0, punchKick: false, combo: 0, comboT: 0, m1cd: 0,
    cds: { 1: 0, 2: 0, 3: 0, 4: 0 }, ult: 0, dom: 0, infinity: 0, armor: 0, trapT: 0, trapC: null, dmgMul: 1, takeMul: 1, titan: 0, garden: 0, meteor: false, fxn: 0, kills: 0, lastBy: null, hurtT: 99, tag: null, tagKey: "", tpos: V(), tface: 0 };
  if (char) setChar(f, char);
  return f;
}
function setChar(f, char) {
  if (f.g) scene.remove(f.g);
  f.char = char;
  f.g = buildFighter(char);
  f.g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(f.g);
  if (f.kind !== "me") { f.tag = overhead(); f.tag.position.y = 6.6; f.g.add(f.tag); f.tagKey = ""; }
}
function removeFighter(f) { if (f.g) scene.remove(f.g); f.g = null; }
const all = () => [...(me ? [me] : []), ...remotes.values(), ...bots];

// A name + health bar over someone's head.
function overhead() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 80;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(4, 1.25, 1); s.renderOrder = 10; s.userData.c = c;
  return s;
}
function drawOverhead(f) {
  const key = f.name + "|" + Math.ceil(f.hp) + "|" + f.char;
  if (!f.tag || key === f.tagKey) return;
  f.tagKey = key;
  const c = f.tag.userData.c, x = c.getContext("2d"), F = FIGHTERS[f.char];
  x.clearRect(0, 0, 256, 80);
  x.font = "bold 26px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 5; x.strokeStyle = "rgba(0,0,0,0.8)"; x.strokeText(f.name, 128, 22, 240); x.fillStyle = F ? F.color : "#fff"; x.fillText(f.name, 128, 22, 240);
  x.fillStyle = "rgba(0,0,0,0.7)"; x.fillRect(28, 46, 200, 18);
  const k = Math.max(0, f.hp / MAX_HP);
  x.fillStyle = k > 0.5 ? "#3fe06a" : k > 0.25 ? "#ffc531" : "#ff3b3b"; x.fillRect(31, 49, 194 * k, 12);
  f.tag.material.map.needsUpdate = true;
}

// ---------------------------------------------------------------- what moves.js uses (G)
let shakeAmt = 0;
const G = {
  scene, arena,
  add(e) { effects.push(e); },
  targets(c) { return all().filter((t) => t !== c && !t.dead && t.g && t.g.visible); },
  hit: dealHit,
  pop(caster, f, at) { if (caster === me) send({ k: "pop", f, p: at.toArray().map((v) => Math.round(v * 100) / 100) }); },
  byId(id) { if (id == null) return null; if (me && id === myId) return me; return remotes.get(id) || bots.find((b) => b.id === id) || null; },
  sound(name, pos) { sfx(name, pos ? Math.max(0, 1 - camera.position.distanceTo(pos) / 140) : 1); },
  shake(a, pos) { const d = pos ? camera.position.distanceTo(pos) : 0; shakeAmt = Math.max(shakeAmt, a * Math.max(0, 1 - d / 90)); },
  text(pos, str, color, scale) { floatText(pos, str, color, scale); },
  banner(title, sub, color) { showBanner(title, sub, color); },
  // the camera swings around to watch the caster (only on the caster's own screen), the world goes dim
  cine(caster, secs) { if (caster === me) cine = { t: secs, total: secs }; dim(Math.min(1.4, secs + 0.3), caster.pos); },
  // DOMAIN EXPANSION: blackout, the name, the caster's hand sign up close, and everyone inside is trapped until it ends
  domainIntro(caster, pos, name, color, secs) {
    showBanner("DOMAIN EXPANSION", name, color); G.sound("domain", pos); G.shake(0.8, pos);
    if (!me || caster === me || me.pos.distanceTo(pos) < 70) { const b = $("black"); b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); }
    if (caster === me) cine = { t: 1.1, total: 1.1 };
    for (const f of [me, ...bots]) if (f && f !== caster && !f.dead && Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z) < 24) {
      f.trapT = secs; f.trapC = pos.clone();
      if (f === me) setTimeout(() => showToast("You're trapped in the domain!", color), 900);
    }
  },
};
let cine = null; // {t, total} while the camera is doing a cinematic
function dim(secs, pos) { if (me && pos && me.pos.distanceTo(pos) > 80) return; const d = $("dim"); d.style.animationDuration = secs + "s"; d.classList.remove("on"); void d.offsetWidth; d.classList.add("on"); }
// Hit-stop: big hits freeze the action for a split second (and flash an impact frame)
let hitStop = 0;
function impact(h, mine) {
  if (!(h.rag >= 1 || h.dmg >= 14 || h.fx === "spark")) return;
  hitStop = Math.max(hitStop, h.ub || h.fx === "spark" ? 0.13 : 0.08);
  if (h.ub || h.fx === "spark" || h.dmg >= 30) { const x = $("impact"); x.classList.remove("on"); void x.offsetWidth; x.classList.add("on"); }
}

// ---------------------------------------------------------------- hits
function dealHit(caster, target, hit) {
  if (!target || target.dead) return;
  const h = { ...hit, dmg: Math.round(hit.dmg * (caster.dmgMul || 1) * (caster.kind === "bot" ? 0.6 : 1) * 10) / 10 };
  if (target.kind === "remote") {
    if (target.infinity > 0 && !h.ub) { floatText(target.pos.clone().add(V(0, 5, 0)), "∞", "#7fe8ff", 1.1); return; } // (their Infinity Wall is up)
    send({ k: "hit", to: target.id, dmg: h.dmg, kb: h.kb, rag: h.rag, stun: h.stun, slow: h.slow, frz: h.frz, set: h.set, ub: h.ub, fx: h.fx });
    if (h.fx !== "") hitFx(G, target.pos, h.fx || "hit");
    if (h.dmg >= 1) floatText(target.pos.clone().add(V(0, 5, 0)), String(Math.round(h.dmg)), "#ffffff", 0.8);
  } else applyHit(target, h, caster);
  if (caster === me && target.kind === "remote") impact(h);
  if (caster === me) { me.ult = Math.min(100, me.ult + h.dmg * ULT_PER_DMG); me.dom = Math.min(100, me.dom + h.dmg * DOM_PER_DMG); }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
function applyHit(f, h, by) {
  if (f.dead || f.iframes > 0) return;
  let dmg = clamp(h.dmg, 0, 80) * f.takeMul;
  let kb = Array.isArray(h.kb) ? V(clamp(h.kb[0], -80, 80), clamp(h.kb[1], -80, 80), clamp(h.kb[2], -80, 80)) : V();
  let rag = clamp(h.rag, 0, 3), stun = clamp(h.stun, 0, 2);
  if (f.infinity > 0 && !h.ub) { floatText(f.pos.clone().add(V(0, 5, 0)), "∞", "#7fe8ff", 1.1); G.sound("block", f.pos); return; } // (Infinity Wall: nothing reaches you)
  if (f.armor > 0) { dmg *= 0.5; kb.multiplyScalar(0.2); rag = 0; stun = 0; }
  const blocked = f.block && !h.ub && by && (() => { const d = V(by.pos.x - f.pos.x, 0, by.pos.z - f.pos.z).normalize(); return d.dot(fwdOf(f.facing)) > 0.1; })();
  if (blocked) { dmg *= 0.2; kb.multiplyScalar(0.25); rag = 0; stun = 0; G.sound("block", f.pos); floatText(f.pos.clone().add(V(0, 5, 0)), "BLOCKED", "#9fd0ff", 0.8); }
  else if (h.fx !== "") hitFx(G, f.pos, h.fx || "hit");
  f.hp = Math.max(0, f.hp - dmg); f.hurtT = 0;
  if (!blocked && (f === me || by === me)) impact({ ...h, dmg, rag });
  f.lastBy = by ? { id: by.kind === "remote" ? by.id : 0, name: by.name, me: by === me } : null;
  if (f.titan > 0) { kb.multiplyScalar(0.4); rag = 0; }
  if (h.set) { f.vel.x = kb.x; f.vel.z = kb.z; f.vel.y = Math.max(f.vel.y, kb.y); } else f.vel.add(kb);
  if (kb.y > 0.5) f.grounded = false;
  if (stun) f.stun = Math.max(f.stun, stun);
  if (h.slow) f.slow = Math.max(f.slow, clamp(h.slow, 0, 2));
  if (h.frz) f.frz = Math.max(f.frz, clamp(h.frz, 0, 2.5));
  if (rag) { f.rag = Math.max(f.rag, rag); f.ragging = true; f.dashT = 0; f.lockT = 0; f.poseT = 0; f.meteor = false; f.block = false; }
  if (f === me) { if (!blocked) { floatText(f.pos.clone().add(V(0, 5, 0)), "-" + Math.round(dmg), "#ff5a5a", 0.9); $("hurt").classList.remove("on"); void $("hurt").offsetWidth; $("hurt").classList.add("on"); } }
  else if (by === me && dmg >= 1) floatText(f.pos.clone().add(V(0, 5, 0)), String(Math.round(dmg)), "#ffffff", 0.8);
  if (f.hp <= 0) die(f);
}
function die(f) {
  if (f.dead) return;
  f.dead = true; f.hp = 0; f.ragging = true; f.rag = Math.max(f.rag, 1); f.deadT = 0; f.block = false;
  G.sound("ko", f.pos);
  const by = f.lastBy;
  feed(by ? by.name : "", f.name, by ? (by.me ? FIGHTERS[me.char].color : "#fff") : "#fff");
  if (by && by.me && f !== me) gotKill(f.name);
  if (f === me) {
    send({ k: "ko", by: by ? by.id : 0, bn: by ? by.name : "" });
    setTimeout(() => openMenu(by ? "You were KO'd by " + by.name + "!" : "You were KO'd!"), 2600);
  }
}
function gotKill(name) { myKills++; if (me) me.kills = myKills; showToast("💥 You KO'd " + name + "!", FIGHTERS[me ? me.char : "nova"].color); }

// ---------------------------------------------------------------- the fighter's body (me + bots move here)
const L = (k, dt) => 1 - Math.exp(-k * dt);
function stepBody(f, dt, input) {
  for (const k of ["stun", "slow", "frz", "iframes", "rag", "lockT", "poseT", "comboT", "m1cd", "dashCd", "garden", "infinity", "armor", "trapT"]) f[k] = Math.max(0, f[k] - dt);
  f.hurtT += dt;
  const cdRate = f.garden > 0 ? 2 : 1;
  for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - dt * cdRate);
  if (!f.dead) {
    f.ult = Math.min(100, f.ult + ULT_PER_SEC * dt * (f.kind === "bot" ? 1.5 : 1)); f.dom = Math.min(100, f.dom + DOM_PER_SEC * dt);
    if (f.hurtT > 7 && f.hp < MAX_HP) f.hp = Math.min(MAX_HP, f.hp + 4 * dt); // (heals slowly out of a fight)
  }
  if (f.punchT > 0) { f.punchT += dt * 3.6; if (f.punchT >= 1) { f.punchT = 0; f.punchKick = false; } }
  if (f.poseT <= 0) f.pose = "";
  const busy = f.dead || f.ragging || f.frz > 0 || f.stun > 0;
  if (busy || !f.grounded) f.block = false;
  // where it wants to go
  const want = V();
  if (!busy && f.lockT <= 0 && input.move.lengthSq() > 0.01) {
    want.copy(input.move).multiplyScalar(WALK * (f.slow > 0 ? 0.45 : 1) * (f.block ? 0.4 : 1) * (f.titan > 0 ? 1.1 : 1));
  }
  if (!busy && input.face != null) f.facing = input.face;
  else if (!busy && want.lengthSq() > 1 && f.dashT <= 0) { let d = Math.atan2(want.x, want.z) - f.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); f.facing += d * L(16, dt); }
  if (f.dashT > 0) { f.dashT -= dt; f.vel.x = f.dashV.x; f.vel.z = f.dashV.z; if (f.vel.y < 0) f.vel.y = 0; }
  else if (f.ragging) { if (f.grounded) { const k = L(3.5, dt); f.vel.x -= f.vel.x * k; f.vel.z -= f.vel.z * k; } }
  else if (f.grounded) { const k = L(busy ? 5 : 14, dt); f.vel.x += (want.x - f.vel.x) * k; f.vel.z += (want.z - f.vel.z) * k; }
  else { const k = L(f.meteor ? 0.5 : 3, dt); f.vel.x += (want.x - f.vel.x) * k * (want.lengthSq() > 0 ? 1 : 0.3); f.vel.z += (want.z - f.vel.z) * k * (want.lengthSq() > 0 ? 1 : 0.3); }
  if (input.jump && f.grounded && !busy && f.lockT <= 0) { f.vel.y = JUMP; f.grounded = false; if (f === me) G.sound("jump"); }
  f.vel.y -= GRAVITY * dt * (f.frz > 0 && !f.grounded ? 0.3 : 1);
  if (f.frz > 0 && f.grounded) { f.vel.x *= 0.5; f.vel.z *= 0.5; }
  const prevY = f.pos.y;
  f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt;
  arena.collide(f.pos, 0.9 * (f.titan > 0 ? 1.4 : 1), 5, f.grounded);
  if (f.trapT > 0 && f.trapC) { // (trapped in a domain: you can't get out until it ends)
    const dx = f.pos.x - f.trapC.x, dz = f.pos.z - f.trapC.z, d = Math.hypot(dx, dz), R = 22.5;
    if (d > R) { f.pos.x = f.trapC.x + dx * R / d; f.pos.z = f.trapC.z + dz * R / d; const out = (f.vel.x * dx + f.vel.z * dz) / d; if (out > 0) { f.vel.x -= dx / d * out; f.vel.z -= dz / d * out; } }
  }
  f.pos.y += f.vel.y * dt;
  const floor = arena.floorAt(f.pos.x, f.pos.z, Math.max(prevY, f.pos.y));
  if (f.pos.y <= floor) {
    if (!f.grounded && f.vel.y < -30 && f.ragging) { f.vel.y = -f.vel.y * 0.3; f.pos.y = floor; if (f.vel.y > 6) G.sound("land", f.pos); else { f.vel.y = 0; f.grounded = true; } }
    else { if (!f.grounded && f.vel.y < -20 && f === me) G.sound("land"); f.pos.y = floor; f.vel.y = 0; f.grounded = true; }
  } else if (f.pos.y > floor + 0.05) f.grounded = false;
  if (f.ragging && f.rag <= 0 && f.grounded && !f.dead) { f.ragging = false; f.iframes = Math.max(f.iframes, 0.5); }
  if (f.pos.y < -30) { f.pos.copy(arena.spawnPoint()); f.vel.set(0, 0, 0); }
  // what it looks like it's doing
  const sp = Math.hypot(f.vel.x, f.vel.z);
  f.mode = f.dead ? (f.grounded ? "dead" : "rag") : f.ragging ? "rag" : f.dashT > 0 ? "dash" : f.block ? "block" : !f.grounded ? "air" : sp > 2 ? "run" : "idle";
}

// ---------------------------------------------------------------- attacks
const busyNow = (f) => f.dead || f.ragging || f.frz > 0 || f.stun > 0 || f.lockT > 0;
function faceNearest(f, range, angle = 1.1) { const t = aimTarget(G, f, range, angle); if (t) f.facing = Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z); return t; }
function m1(f) {
  if (busyNow(f) || f.m1cd > 0 || f.block || f.dashT > 0) return;
  if (f.comboT <= 0) f.combo = 0;
  const n = ++f.combo;
  f.m1cd = n >= 4 ? 0.85 : 0.3; f.comboT = 1.1;
  if (n >= 4) f.combo = 0;
  if (f.kind === "bot" || !shiftLock) { if (!faceNearest(f, 8, Math.PI)) faceNearest(f, 14); } // (turns to whoever is right next to you)
  f.punchT = 0.001; f.punchSide = n % 2; f.punchKick = n === 4;
  G.sound("swing", f.pos);
  if (f === me) send({ k: "m1", n });
  const fw = fwdOf(f.facing);
  if (f.grounded) { f.vel.x += fw.x * 7; f.vel.z += fw.z * 7; }
  for (const t of G.targets(f)) {
    const d = V(t.pos.x - f.pos.x, 0, t.pos.z - f.pos.z), len = d.length();
    if (len > 5.4 * (f.titan > 0 ? 1.5 : 1) || Math.abs(t.pos.y - f.pos.y) > 4 || (len > 0.5 && d.dot(fw) / len < 0.3)) continue;
    dealHit(f, t, n === 4 ? { dmg: 9, kb: [fw.x * 26, 11, fw.z * 26], rag: 0.9, fx: "big" } : { dmg: 5, stun: 0.45, kb: [fw.x * 5, 0, fw.z * 5], fx: "hit" });
  }
}
function dash(f, dir) {
  if (busyNow(f) || f.dashCd > 0 || f.block) return;
  const d = dir && dir.lengthSq() > 0.01 ? dir.clone().normalize() : fwdOf(f.facing);
  f.dashT = DASH_TIME; f.dashV.copy(d).multiplyScalar(DASH_SPEED); f.dashCd = DASH_CD; f.iframes = Math.max(f.iframes, 0.2);
  G.sound("dash", f.pos);
  burst(G, f.pos.clone().add(V(0, 2.5, 0)), 0xffffff, 6, 5, 0.3, 0.3);
}
function cast(f, key) {
  if (busyNow(f) || f.block || f.dashT > 0 || f.meteor) return false;
  const mv = FIGHTERS[f.char].moves.find((m) => m.key === key);
  if (!mv) return false;
  if (mv.ult) { if (f.ult < 100) { if (f === me) showToast("Ultimate is charging: " + Math.floor(f.ult) + "%", "#aaa"); return false; } f.ult = 0; f.dom = Math.min(100, f.dom + DOM_PER_ULT); }
  else if (mv.dom) { if (f.dom < 100) { if (f === me) showToast((f.char === "rook" ? "Awakening" : "Domain") + " is charging: " + Math.floor(f.dom) + "%", "#aaa"); return false; } if (f.titan > 0) return false; f.dom = 0; }
  else { if (f.cds[key] > 0) return false; f.cds[key] = mv.cd; }
  if (f.kind === "bot" || !shiftLock) faceNearest(f, 45);
  const data = castData(G, f, key);
  data.f = ++f.fxn;
  castMove(G, f, key, data, true);
  if (f === me) send({ k: "cast", m: key, ...data });
  return true;
}

// ---------------------------------------------------------------- the network (relay live.js)
let net = null, server = null; // server = {code, create} on a private server (play with friends)
const send = (e) => { if (net) net.send({ t: "ev", e }); };
function startNet() {
  if (net) net.close();
  for (const f of remotes.values()) removeFighter(f);
  remotes.clear(); myId = 0;
  net = joinLive("clash", (m) => {
    if (m.t === "error") { if (m.e === "notfound") { $("menuNote").textContent = "Nobody is on server " + server.code + ". Check the code with your friend."; server = null; startNet(); } return; }
    if (m.t === "welcome") {
      myId = m.id; myName = m.n;
      for (const f of remotes.values()) removeFighter(f);
      remotes.clear();
      for (const p of m.players) { const f = makeFighter("remote", p.id, p.n, ""); remotes.set(p.id, f); if (p.s) remoteState(f, p.s, true); }
      updateBots(); refreshOnline();
    } else if (m.t === "join") { remotes.set(m.id, makeFighter("remote", m.id, m.n, "")); feedNote(m.n + " joined"); updateBots(); refreshOnline(); }
    else if (m.t === "leave") { const f = remotes.get(m.id); if (f) { removeFighter(f); remotes.delete(m.id); feedNote(f.name + " left"); } updateBots(); refreshOnline(); }
    else if (m.t === "s") { const f = remotes.get(m.id); if (f) remoteState(f, m, false); }
    else if (m.t === "ev") onEvent(remotes.get(m.id), m.e || {});
    else if (m.t === "reset") { for (const f of remotes.values()) removeFighter(f); remotes.clear(); myId = 0; updateBots(); refreshOnline(); }
  }, server);
  refreshOnline();
}
$("srvMake").onclick = () => { server = { code: newCode(), create: true }; $("menuNote").textContent = ""; startNet(); };
$("srvJoin").onsubmit = (e) => {
  e.preventDefault();
  const c = $("srvCode").value.replace(/\D/g, "");
  if (c.length !== 5) { $("srvCode").value = ""; $("srvCode").placeholder = "5 numbers"; return; }
  server = { code: c }; $("menuNote").textContent = ""; startNet();
};
$("srvPublic").onclick = () => { server = null; $("menuNote").textContent = ""; startNet(); };
function remoteState(f, s, snap) {
  const c = FIGHTERS[s.c] ? s.c : "";
  if (c !== f.char) { if (c) setChar(f, c); else { removeFighter(f); f.char = ""; } snap = true; }
  if (!Array.isArray(s.p)) return;
  f.tpos.set(s.p[0], s.p[1], s.p[2]); f.tface = s.r || 0; f.hp = Math.max(0, s.h || 0); f.kills = s.k || 0;
  const was = f.dead;
  f.mode = s.a || "idle"; f.dead = f.mode === "dead" || (f.hp <= 0 && f.char !== "");
  if (!f.dead && was) snap = true;
  f.block = f.mode === "block";
  if (snap || f.pos.distanceTo(f.tpos) > 30) { f.pos.copy(f.tpos); f.facing = f.tface; }
}
function onEvent(f, e) {
  if (!f || typeof e.k !== "string") return;
  if (e.k === "cast" && f.g && /^[1-4rg]$/.test(e.m) && Array.isArray(e.p)) { f.pos.set(e.p[0], e.p[1], e.p[2]); f.facing = Number(e.d) || 0; castMove(G, f, e.m, e, false); }
  else if (e.k === "m1" && f.g) { f.punchT = 0.001; f.punchSide = e.n % 2; f.punchKick = e.n === 4; G.sound("swing", f.pos); }
  else if (e.k === "pop") { const x = effects.find((x) => x.key === f.id + ":" + e.f); if (x && x.pop && Array.isArray(e.p)) x.pop(e.p); }
  else if (e.k === "hit") {
    if (me && e.to === myId && me.char) { if (f.pos.distanceTo(me.pos) < 120) applyHit(me, e, f); }
    else { const t = remotes.get(e.to); if (t && t.g && e.fx !== "") hitFx(G, t.pos, e.fx || "hit"); }
  } else if (e.k === "ko") {
    const killer = e.by === myId ? myName : String(e.bn || "").slice(0, 30);
    feed(killer, f.name, e.by === myId && me ? FIGHTERS[me.char].color : "#fff");
    if (e.by === myId) gotKill(f.name);
  }
}
function updateBots() {
  const alone = [...remotes.values()].length === 0;
  if (!alone && bots.length) { for (const b of bots) removeFighter(b); bots = []; showToast("A real player is here: practice bots left", "#9fd0ff"); }
  if (alone && !bots.length && me) spawnBots();
}
function spawnBots() {
  const pool = FIGHTER_IDS.filter((c) => c !== (me && me.char));
  const start = Math.floor(Math.random() * pool.length);
  bots = [0, 1].map((i) => { const b = makeFighter("bot", "b" + (i + 1), "Practice Bot " + (i + 1), pool[(start + i) % pool.length]); placeNear(b); return b; });
}
function placeNear(b) { const a = Math.random() * Math.PI * 2, at = (me ? me.pos : V()).clone().add(V(Math.cos(a) * 28, 0, Math.sin(a) * 28)); at.y = 0; arena.collide(at, 1, 5, false); at.y = arena.floorAt(at.x, at.z, 20); b.pos.copy(at); b.iframes = 1.5; }
function refreshOnline() {
  const n = [...remotes.values()].length + 1, code = net && net.code;
  $("online").innerHTML = (code ? "🔒 Private server <b>" + code + "</b> (tell your friends this code) · " : "🌍 Public server · ") + "👥 " + n + (n === 1 ? " player here (you + practice bots)" : " players here");
  $("srvPublic").classList.toggle("hidden", !code);
}

// ---------------------------------------------------------------- practice bots (only when you're alone)
function botThink(b, dt) {
  const input = { move: V(), jump: false, face: null };
  if (b.dead) { b.deadT += dt; if (b.deadT > 4) { const n = makeFighter("bot", b.id, b.name, FIGHTER_IDS[(Math.random() * 4) | 0]); removeFighter(b); bots[bots.indexOf(b)] = n; placeNear(n); } return input; }
  const t = me && !me.dead && me.char ? me : null;
  b.think = (b.think || 0) - dt;
  if (!t) return input;
  const to = V(t.pos.x - b.pos.x, 0, t.pos.z - b.pos.z), d = to.length();
  if (d > 3.8) input.move.copy(to).normalize();
  if (b.strafe) input.move.add(V(-to.z, 0, to.x).normalize().multiplyScalar(b.strafe * 0.7)).normalize();
  if (d < 12) input.face = Math.atan2(to.x, to.z);
  if (b.think <= 0) {
    b.think = 0.25 + Math.random() * 0.3;
    b.strafe = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    if (t.punchT > 0 && d < 6 && Math.random() < 0.35) { b.block = true; b.blockT = 0.7; }
    else if (d < 5 && Math.random() < 0.8) m1(b);
    else if (b.ult >= 100 && d < 26) cast(b, "r");
    else if (d < 22 && Math.random() < 0.25) cast(b, "1234"[(Math.random() * 4) | 0]);
    else if (d > 10 && d < 40 && Math.random() < 0.2) dash(b, to.clone().normalize());
    if (t.pos.y > b.pos.y + 2 && Math.random() < 0.5) input.jump = true;
  }
  if (b.blockT > 0) { b.blockT -= dt; b.block = b.blockT > 0 && b.grounded; input.move.set(0, 0, 0); }
  return input;
}

// ---------------------------------------------------------------- input (keyboard, mouse, Shift Lock, touch)
const keys = new Set();
let shiftLock = false, camYaw = 0, camPitch = 0.28, camDist = 15, wantJump = false;
let rDrag = null;
const typing = (e) => e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
addEventListener("keydown", (e) => {
  if (typing(e)) return;
  const k = e.key.toLowerCase();
  if (["w", "a", "s", "d", " ", "q", "f", "r", "g", "1", "2", "3", "4", "shift", "tab", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (!me || menuOpen) return;
  if (k === "shift") setShiftLock(!shiftLock);
  else if (k === " ") wantJump = true;
  else if (k === "q") dash(me, moveInput());
  else if (/^[1-4rg]$/.test(k)) cast(me, k);
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  unlockSound();
  if (menuOpen || !me) return;
  if (e.pointerType === "touch") { touchLook(e); return; }
  if (e.button === 0) m1(me);
  if (e.button === 2 && !shiftLock) { rDrag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener("pointermove", (e) => {
  if (shiftLock && document.pointerLockElement === canvas) { camYaw -= e.movementX * 0.0028; camPitch = Math.max(-0.45, Math.min(1.2, camPitch + e.movementY * 0.0022)); return; }
  if (rDrag && e.pointerType !== "touch") { camYaw -= (e.clientX - rDrag.x) * 0.006; camPitch = Math.max(-0.45, Math.min(1.2, camPitch + (e.clientY - rDrag.y) * 0.005)); rDrag = { x: e.clientX, y: e.clientY }; }
});
canvas.addEventListener("pointerup", () => (rDrag = null));
canvas.addEventListener("wheel", (e) => { camDist = Math.max(7, Math.min(32, camDist + e.deltaY * 0.02)); e.preventDefault(); }, { passive: false });
function setShiftLock(on) {
  shiftLock = on;
  $("lockBtn").classList.toggle("on", on); $("cross").classList.toggle("hidden", !on);
  $("lockBtn").textContent = on ? "🔒 Shift Lock: ON" : "🔓 Shift Lock: OFF";
  if (on && !touch) { try { canvas.requestPointerLock(); } catch {} }
  if (!on && document.pointerLockElement) document.exitPointerLock();
}
document.addEventListener("pointerlockchange", () => { if (!document.pointerLockElement && shiftLock && !touch) setShiftLock(false); });
$("lockBtn").onclick = () => setShiftLock(!shiftLock);
// joystick + camera drag for touch screens
const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
const stick = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0 };
function touchLook(e) {
  if (e.clientX < innerWidth * 0.4 && stick.id === null) { stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.dx = stick.dy = 0; showStick(true); }
  else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
}
addEventListener("pointermove", (e) => {
  if (e.pointerId === stick.id) { stick.dx = e.clientX - stick.x; stick.dy = e.clientY - stick.y; const l = Math.hypot(stick.dx, stick.dy); if (l > 60) { stick.dx *= 60 / l; stick.dy *= 60 / l; } showStick(true); }
  if (e.pointerId === look.id) { camYaw -= (e.clientX - look.x) * 0.008; camPitch = Math.max(-0.45, Math.min(1.2, camPitch + (e.clientY - look.y) * 0.006)); look.x = e.clientX; look.y = e.clientY; }
});
addEventListener("pointerup", (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; showStick(false); } if (e.pointerId === look.id) look.id = null; });
addEventListener("pointercancel", (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; showStick(false); } if (e.pointerId === look.id) look.id = null; });
function showStick(on) { const s = $("stick"); s.classList.toggle("hidden", !on); if (on) { s.style.left = stick.x + "px"; s.style.top = stick.y + "px"; s.firstElementChild.style.transform = "translate(" + stick.dx + "px," + stick.dy + "px)"; } }
function moveInput() {
  let fx = 0, fz = 0;
  if (keys.has("w")) fz += 1;
  if (keys.has("s")) fz -= 1;
  if (keys.has("d")) fx += 1;
  if (keys.has("a")) fx -= 1;
  if (stick.id !== null) { fx = stick.dx / 60; fz = -stick.dy / 60; }
  const f = V(-Math.sin(camYaw), 0, -Math.cos(camYaw)), r = V(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const m = f.multiplyScalar(fz).add(r.multiplyScalar(fx));
  if (m.lengthSq() > 1) m.normalize();
  return m;
}

// ---------------------------------------------------------------- HUD
const SLOTS = [
  { k: "m1", key: touch ? "TAP" : "🖱", name: "Punch", icon: "👊" },
  { k: "1" }, { k: "2" }, { k: "3" }, { k: "4" }, { k: "r" }, { k: "g" },
  { k: "q", key: "Q", name: "Dash", icon: "💨" },
  { k: "f", key: "F", name: "Block", icon: "🛡️" },
];
function buildSlots() {
  const F = FIGHTERS[me.char];
  $("slots").innerHTML = SLOTS.map((s) => {
    const mv = F.moves.find((m) => m.key === s.k) || null, name = mv ? mv.name : s.name, icon = mv ? mv.icon : s.icon;
    const tag = mv && mv.ult ? '<em class="tagu">ULTIMATE</em>' : mv && mv.dom ? '<em class="tagd">' + (me.char === "rook" ? "AWAKEN" : "DOMAIN") + "</em>" : "";
    return '<button type="button" class="slot' + (mv && (mv.ult || mv.dom) ? " big" : "") + '" data-k="' + s.k + '" title="' + esc(mv ? mv.desc : name) + '">' + tag +
      '<span class="key">' + (mv ? s.k.toUpperCase() : s.key) + '</span><span class="ico">' + icon + '</span><span class="nm">' + esc(name) + "</span>" +
      '<span class="cd"></span><span class="cdt"></span>' + (mv && (mv.ult || mv.dom) ? '<span class="meter"><i></i></span><span class="pct"></span>' : "") + "</button>";
  }).join("");
  $("slots").querySelectorAll(".slot").forEach((b) => {
    const k = b.dataset.k;
    b.onpointerdown = (e) => {
      e.preventDefault(); unlockSound();
      if (!me || me.dead) return;
      if (k === "m1") m1(me); else if (k === "q") dash(me, moveInput()); else if (k === "f") { b.held = true; } else cast(me, k);
    };
    b.onpointerup = b.onpointerleave = () => { b.held = false; };
  });
  $("hpName").textContent = myName + " · " + F.name;
  document.documentElement.style.setProperty("--me", F.color);
}
function updateHud() {
  if (!me) return;
  const F = FIGHTERS[me.char];
  $("hpFill").style.width = (me.hp / MAX_HP) * 100 + "%";
  $("hpText").textContent = Math.ceil(me.hp) + " / " + MAX_HP;
  $("slots").querySelectorAll(".slot").forEach((b) => {
    const k = b.dataset.k, cdEl = b.querySelector(".cd"), cdt = b.querySelector(".cdt");
    let left = 0, total = 1, ready = true;
    if (k === "m1") { left = me.m1cd; total = 0.85; }
    else if (k === "q") { left = me.dashCd; total = DASH_CD; }
    else if (k === "f") { ready = true; b.classList.toggle("active", me.block); }
    else {
      const mv = F.moves.find((m) => m.key === k);
      if (mv.ult || mv.dom) {
        const v = mv.ult ? me.ult : me.dom;
        b.querySelector(".meter i").style.width = v + "%";
        b.querySelector(".pct").textContent = v >= 100 ? "READY!" : Math.floor(v) + "%";
        ready = v >= 100; b.classList.toggle("ready", ready); b.classList.toggle("charging", !ready);
        cdEl.style.background = ""; cdt.textContent = "";
        return;
      }
      left = me.cds[k]; total = mv.cd;
    }
    const frac = Math.min(1, left / total);
    cdEl.style.background = left > 0 ? "conic-gradient(rgba(0,0,0,0.7) " + frac * 360 + "deg, rgba(0,0,0,0.15) 0)" : "";
    cdt.textContent = left > 0.05 && total > 1 ? left.toFixed(1) : "";
    b.classList.toggle("cool", left > 0);
  });
  // leaderboard
  const rows = all().filter((f) => f.char || f === me).map((f) => ({ n: f === me ? myName + " (you)" : f.name, k: f === me ? myKills : f.kills || 0, c: f.char, me: f === me, bot: f.kind === "bot" }))
    .sort((a, b) => b.k - a.k).slice(0, 10);
  const key = rows.map((r) => r.n + r.k + r.c).join("|");
  if (key !== $("lb").dataset.key) {
    $("lb").dataset.key = key;
    $("lb").innerHTML = "<b>KOs</b>" + rows.map((r) => '<div class="' + (r.me ? "me" : "") + '"><i style="background:' + (FIGHTERS[r.c] ? FIGHTERS[r.c].color : "#888") + '"></i><span>' + esc(r.n) + "</span><em>" + r.k + "</em></div>").join("");
  }
}
function feed(killer, victim, color) {
  const d = document.createElement("div");
  d.innerHTML = killer ? '<b style="color:' + color + '">' + esc(killer) + "</b> 💥 " + esc(victim) : esc(victim) + " was KO'd";
  $("feed").prepend(d); setTimeout(() => d.remove(), 6000);
  while ($("feed").children.length > 5) $("feed").lastChild.remove();
}
function feedNote(text) { const d = document.createElement("div"); d.className = "note"; d.textContent = text; $("feed").prepend(d); setTimeout(() => d.remove(), 4000); }
let toastT = null;
function showToast(text, color) { const t = $("toast"); t.textContent = text; t.style.color = color || "#fff"; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); }
let bannerT = null;
function showBanner(title, sub, color) {
  const b = $("banner"); b.innerHTML = "<small>" + esc(title) + "</small><b>" + esc(sub) + "</b>"; b.style.setProperty("--c", color);
  b.classList.remove("on"); void b.offsetWidth; b.classList.add("on");
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove("on"), 2600);
  $("flash").style.background = color; $("flash").classList.remove("on"); void $("flash").offsetWidth; $("flash").classList.add("on");
}
const floats = [];
function floatText(pos, str, color, scale = 1) {
  const d = document.createElement("div"); d.className = "float"; d.textContent = str; d.style.color = color; d.style.fontSize = 26 * scale + "px";
  $("floats").appendChild(d);
  floats.push({ d, pos: pos.clone().add(V((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5)), t: 0 });
}
const proj = V();
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; f.pos.y += dt * 3;
    proj.copy(f.pos).project(camera);
    if (f.t > 1 || proj.z > 1) { f.d.remove(); floats.splice(i, 1); continue; }
    f.d.style.transform = "translate(" + ((proj.x + 1) / 2 * innerWidth) + "px," + ((1 - proj.y) / 2 * innerHeight) + "px) translate(-50%,-50%) scale(" + (f.t < 0.1 ? 0.6 + f.t * 6 : 1.2 - f.t * 0.2) + ")";
    f.d.style.opacity = f.t > 0.7 ? (1 - f.t) / 0.3 : 1;
  }
}

// ---------------------------------------------------------------- the fighter select menu
let menuOpen = true;
function buildMenu() {
  $("cards").innerHTML = FIGHTER_IDS.map((id) => {
    const F = FIGHTERS[id];
    return '<button type="button" class="card" data-id="' + id + '" style="--c:' + F.color + ";--b1:" + F.bg[0] + ";--b2:" + F.bg[1] + '">' +
      '<span class="pic"><img alt="" src="' + fighterPicture(id, 360, 420) + '"></span><span class="who"><b>' + esc(F.name) + "</b><small>" + esc(F.title) + "</small></span>" +
      '<span class="mv">' + F.moves.map((m) => '<span title="' + esc(m.desc) + '"><kbd>' + m.key.toUpperCase() + "</kbd>" + m.icon + " " + esc(m.name) + (m.ult ? " <em>ULT</em>" : m.dom ? " <em>" + (id === "rook" ? "AWAKEN" : "DOMAIN") + "</em>" : "") + "</span>").join("") + "</span></button>";
  }).join("");
  $("cards").querySelectorAll(".card").forEach((c) => (c.onclick = () => { unlockSound(); sfx("pick"); spawn(c.dataset.id); }));
}
function openMenu(note) {
  menuOpen = true;
  $("menu").classList.remove("hidden"); $("hud").classList.add("hidden");
  $("menuNote").textContent = note || "";
  if (shiftLock) setShiftLock(false);
  if (me) { removeFighter(me); me = null; }
  for (const b of bots) removeFighter(b);
  bots = [];
  refreshOnline();
}
function spawn(char) {
  if (me) removeFighter(me);
  me = makeFighter("me", myId, myName, char);
  lastChar = char;
  me.pos.copy(arena.spawnPoint()); me.pos.y = arena.floorAt(me.pos.x, me.pos.z, 30);
  me.iframes = 2.5; me.kills = myKills; me.facing = Math.atan2(-me.pos.x, -me.pos.z); camYaw = me.facing + Math.PI;
  menuOpen = false;
  $("menu").classList.add("hidden"); $("hud").classList.remove("hidden");
  buildSlots();
  wave(G, me.pos, new THREE.Color(FIGHTERS[char].color).getHex(), 1, 8, 0.6);
  burst(G, me.pos.clone().add(V(0, 2, 0)), new THREE.Color(FIGHTERS[char].color).getHex(), 18, 12, 0.6);
  G.sound("ready");
  showToast(FIGHTERS[char].name + ": " + FIGHTERS[char].title, FIGHTERS[char].color);
  updateBots();
  canvas.focus();
}
$("switchBtn").onclick = () => { if (!me) return; if (me.hurtT < 8) { showToast("You can switch after 8 seconds without getting hit", "#ffc531"); return; } openMenu(""); };

// ---------------------------------------------------------------- camera
const camRay = new THREE.Raycaster(), camTarget = V(), camOff = V();
let menuSpin = 0;
function updateCamera(dt) {
  if (!me) { menuSpin += dt * 0.08; camera.position.set(Math.cos(menuSpin) * 95, 38, Math.sin(menuSpin) * 95); camera.lookAt(0, 6, 0); return; }
  camTarget.copy(me.pos); camTarget.y += 4.4 * (me.titan > 0 ? 1.4 : 1);
  camOff.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
  if (shiftLock) camTarget.add(V(Math.cos(camYaw), 0, -Math.sin(camYaw)).multiplyScalar(2.2));
  let dist = camDist * (me.titan > 0 ? 1.3 : 1);
  camRay.set(camTarget, camOff); camRay.far = dist;
  const hit = camRay.intersectObjects(arena.solid.children, false)[0];
  if (hit) dist = Math.max(2.5, hit.distance - 0.6);
  camera.position.copy(camTarget).addScaledVector(camOff, dist);
  if (camera.position.y < 0.6) camera.position.y = 0.6;
  camera.lookAt(camTarget);
  if (cine && cine.t > 0) { // a cinematic: swing around in front of me, close up, then back
    cine.t -= dt;
    const u = 1 - cine.t / cine.total, w = Math.min(1, u / 0.2, (1 - u) / 0.25) ** 2, fw = fwdOf(me.facing);
    const s = me.titan > 0 ? 1.6 : 1, look = me.pos.clone().add(V(0, 3.1 * s, 0));
    const cp = me.pos.clone().addScaledVector(fw, 6.5 * s).add(V(-fw.z * 3.5 * s, 3.4 * s + u * 0.8, fw.x * 3.5 * s)).lerp(look, u * 0.15);
    camera.position.lerp(cp, Math.max(0, w));
    const lk = camTarget.clone().lerp(look, Math.max(0, w)); camera.lookAt(lk);
    if (cine.t <= 0) cine = null;
  }
  if (shakeAmt > 0.01) { camera.position.add(V((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt)); shakeAmt *= Math.exp(-dt * 7); }
  arena.sun.position.set(me.pos.x - 60, 120, me.pos.z - 70); arena.sun.target.position.copy(me.pos);
}

// ---------------------------------------------------------------- every frame
let sendT = 0;
function showFighter(f, dt) {
  if (!f.g) return;
  f.g.visible = !(f.kind === "remote" && !f.char);
  f.g.position.copy(f.pos); f.g.rotation.y = f.facing;
  const sp = Math.hypot(f.vel.x, f.vel.z);
  animateFighter(f.g, { mode: f.mode, speed: f.mode === "rag" ? sp + Math.abs(f.vel.y) : sp, punch: f.punchT, side: f.punchSide, kick: f.punchKick, pose: f.poseT > 0 ? f.pose : "", low: f.grounded }, dt);
  // flicker while you can't be hit (just spawned / getting up)
  f.g.visible = f.g.visible && !(f.iframes > 0.3 && f.kind !== "remote" && Math.floor(f.iframes * 12) % 2 === 0 && !f.dead);
  if (f.frz > 0 && Math.random() < 0.15) burst(G, f.pos.clone().add(V(0, 3, 0)), 0x9fd0ff, 1, 3, 0.4, 0.3);
  drawOverhead(f);
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.05);
  if (hitStop > 0) { hitStop -= dt; dt *= 0.05; } // (frozen for a split second on a big hit)
  tick(dt);
  renderer.render(scene, camera);
}
function tick(dt) {
  // arrow keys turn the camera (so does the mouse)
  if (!menuOpen) {
    if (keys.has("arrowleft")) camYaw += dt * 2.4; if (keys.has("arrowright")) camYaw -= dt * 2.4;
    if (keys.has("arrowup")) camPitch = Math.min(1.2, camPitch + dt * 1.3); if (keys.has("arrowdown")) camPitch = Math.max(-0.45, camPitch - dt * 1.3);
  }
  // me
  if (me) {
    const holdBlock = keys.has("f") || [...$("slots").querySelectorAll('.slot[data-k="f"]')].some((b) => b.held);
    me.block = holdBlock && !busyNow(me) && me.grounded && me.dashT <= 0;
    const input = { move: moveInput(), jump: wantJump || keys.has(" "), face: shiftLock ? camYaw + Math.PI : null };
    wantJump = false;
    stepBody(me, dt, input);
    if (me.dead) me.deadT += dt;
    sendT -= dt;
    if (sendT <= 0 && net) { sendT = 1 / 15; net.send({ t: "s", p: me.pos.toArray().map((v) => Math.round(v * 100) / 100), r: Math.round(me.facing * 1000) / 1000, a: me.mode, h: Math.ceil(me.hp), c: me.char, k: myKills }); }
  } else if (net) { sendT -= dt; if (sendT <= 0) { sendT = 0.5; net.send({ t: "s", p: [0, -50, 0], r: 0, a: "menu", h: 0, c: "", k: myKills }); } }
  // other players: glide to where they really are
  for (const f of remotes.values()) {
    const last = f.pos.clone();
    f.pos.lerp(f.tpos, L(14, dt));
    let d = f.tface - f.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); f.facing += d * L(14, dt);
    f.vel.copy(f.pos).sub(last).divideScalar(Math.max(dt, 1e-4));
    if (f.punchT > 0) { f.punchT += dt * 3.6; if (f.punchT >= 1) f.punchT = 0; }
    f.poseT = Math.max(0, f.poseT - dt); f.infinity = Math.max(0, f.infinity - dt); f.armor = Math.max(0, f.armor - dt);
    f.grounded = f.mode !== "air" && f.mode !== "rag";
    showFighter(f, dt);
  }
  // bots
  for (const b of [...bots]) { const input = botThink(b, dt); if (bots.includes(b)) { stepBody(b, dt, input); showFighter(b, dt); } }
  if (me) showFighter(me, dt);
  // effects
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.age += dt;
    let alive = e.age < e.life;
    if (alive && e.run(dt, e.age) === false) alive = false;
    if (!alive) { for (const o of [...e.objs, ...(e.objsLater || []).map((x) => x.m || x)]) { scene.remove(o); o.traverse((m) => { if (m.material && m.material.userData.own) m.material.dispose(); if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose(); }); } effects.splice(i, 1); }
  }
  updateCamera(dt);
  updateHud();
  updateFloats(dt);
}

// ---------------------------------------------------------------- start
$("controls").innerHTML = touch
  ? "Left side: move · Right side: drag to look · Tap the buttons to punch, use moves, dash and block"
  : "<b>WASD</b> move · <b>Space</b> jump · <b>Click</b> punch (4-hit combo) · <b>1 2 3 4</b> moves · <b>R</b> ultimate · <b>G</b> domain expansion · <b>Q</b> dash (hold A / D to dodge sideways) · <b>F</b> block · <b>Shift</b> Shift Lock · <b>Right-drag</b> or <b>arrow keys</b> look · <b>Wheel</b> zoom";
if (touch) document.body.classList.add("touch");
buildMenu();
openMenu("");
startNet();
requestAnimationFrame(frame);
window.CLASH = { get me() { return me; }, remotes, get bots() { return bots; }, cast, m1, dash, spawn, applyHit, G, get myId() { return myId; }, effects, keys, step(n) { for (let i = 0; i < n; i++) tick(1 / 60); } }; // (for testing)
