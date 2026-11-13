// Other players in a published Studio game (live servers, net.js joinLive): their avatars walk around with you, with
// their names over their heads. Each player still has their own copy of the game (coins, doors, monsters).
import * as THREE from "../vendor/three.module.js";
import { buildAvatar, animateAvatar, sanitizeAvatar } from "./avatar.js";
import { joinLive } from "./net.js";
import { poseArm } from "./weapons.js";

// A name over someone's head (a little picture that always faces the camera).
export function nameTag(text, color) {
  const c = document.createElement("canvas"), x = c.getContext("2d");
  c.width = 256; c.height = 64;
  x.font = "bold 30px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  const w = Math.min(250, x.measureText(text).width + 24);
  x.fillStyle = "rgba(0,0,0,0.55)"; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 14); x.fill();
  x.fillStyle = color || "#ffffff"; x.fillText(text, 128, 33, 236);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(3.2, 0.8, 1); s.renderOrder = 10;
  return s;
}

// me() -> {p: THREE.Vector3, r: facing, air: true when not on the ground, look: avatar}; say(text) shows a message.
// server = {code, create} for a private server (play with friends, net.js joinLive); a code nobody is on falls back to public.
// arms (🎒 weapons, play.js): {held(id) -> a model for their hand, kind(id) -> "melee" / "ranged", attack(e): show their shots};
// me().c = the weapon I hold. send(e) tells the others something happened (an attack: {a: "atk", w, p, d}).
export function startOthers(scene, key, me, say, server, arms) {
  const list = new Map(); // id -> {g, tag, at, r, from}
  let sendT = 0, count = 1;
  function add(id, name, look) {
    remove(id);
    const g = buildAvatar(sanitizeAvatar(look || {}));
    const tag = nameTag(name); tag.position.y = 3.7; g.add(tag);
    g.visible = false; scene.add(g);
    list.set(id, { g, name, at: new THREE.Vector3(), r: 0, seen: false, last: new THREE.Vector3() });
  }
  function remove(id) { const o = list.get(id); if (o) { scene.remove(o.g); list.delete(id); } }
  function state(o, s) {
    if (!s || !Array.isArray(s.p)) return;
    o.at.set(s.p[0], s.p[1], s.p[2]); o.r = s.r || 0; o.air = s.a === "air";
    if (arms && (s.c || "") !== (o.c || "")) { // (what they hold changed)
      o.c = s.c || ""; if (o.held) o.held.parent && o.held.parent.remove(o.held);
      o.held = o.c ? arms.held(o.c) : null; o.kind = o.c ? arms.kind(o.c) : "";
      if (o.held) { o.held.position.set(0, -1.1, -0.12); o.g.userData.limbs.armR.add(o.held); }
    }
    if (!o.seen) { o.g.position.copy(o.at); o.g.rotation.y = o.r; o.seen = true; o.g.visible = true; }
  }
  const onMsg = (m) => {
    if (m.t === "error") { if (m.e === "notfound") { say("Nobody is on server " + server.code + ". You're on a public server."); server = null; net = joinLive(key, onMsg); } return; }
    if (m.t === "welcome") {
      for (const id of [...list.keys()]) remove(id);
      for (const p of m.players) { add(p.id, p.n, p.k); state(list.get(p.id), p.s); }
      count = m.players.length + 1;
      net.send({ t: "look", k: me().look });
      if (m.code && !m.players.length) say("🔒 Private server " + m.code + ". Tell your friends this code!"); else if (m.players.length) say(m.players.length === 1 ? "1 other player is here!" : m.players.length + " other players are here!");
    } else if (m.t === "join") { add(m.id, m.n, null); count++; say(m.n + " joined"); }
    else if (m.t === "leave") { const o = list.get(m.id); if (o) { say(o.name + " left"); remove(m.id); count--; } }
    else if (m.t === "look") { const o = list.get(m.id); if (o) { const keep = { at: o.at.clone(), r: o.r, seen: o.seen, c: o.c }; add(m.id, o.name, m.k); const n = list.get(m.id); if (keep.seen) state(n, { p: keep.at.toArray(), r: keep.r, c: keep.c }); } }
    else if (m.t === "s") { const o = list.get(m.id); if (o) state(o, m); }
    else if (m.t === "ev" && m.e && m.e.a === "atk") { const o = list.get(m.id); if (o) { o.atkT = 0.001; if (arms) arms.attack(m.e); } }
    else if (m.t === "reset") { for (const id of [...list.keys()]) remove(id); count = 1; }
  };
  let net = joinLive(key, onMsg, server);
  return {
    get count() { return count; },
    get code() { return net.code; }, // (a private server's code, "" on a public one)
    update(dt) {
      sendT -= dt;
      if (sendT <= 0) {
        sendT = 1 / 12;
        const m = me();
        net.send({ t: "s", p: [m.p.x, m.p.y, m.p.z], r: m.r, a: m.air ? "air" : "", h: 0, c: m.c || "" });
      }
      for (const o of list.values()) {
        if (!o.seen) continue;
        o.last.copy(o.g.position);
        o.g.position.lerp(o.at, Math.min(1, dt * 10));
        let d = o.r - o.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        o.g.rotation.y += d * Math.min(1, dt * 10);
        const sp = dt > 0 ? Math.hypot(o.g.position.x - o.last.x, o.g.position.z - o.last.z) / dt : 0;
        animateAvatar(o.g, dt, !o.air, sp);
        if (o.held) { if (o.atkT > 0) { o.atkT += dt / (o.kind === "ranged" ? 0.18 : 0.35); if (o.atkT >= 1) o.atkT = 0; } poseArm(o.g.userData.limbs.armR, o.kind, o.atkT || 0); }
      }
    },
    send(e) { net.send({ t: "ev", e }); },
    stop() { net.close(); for (const id of [...list.keys()]) remove(id); },
  };
}
