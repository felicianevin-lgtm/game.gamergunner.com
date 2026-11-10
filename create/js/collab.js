// SHARED STUDIOS (relay studio.js): building one game together, live. The editor (editor.js) calls push(game) after
// every change; only what changed goes to the relay (objects, scripts, name / settings / GUI / files), which saves it
// right away and passes it to everyone else in the studio. What others change comes back here, goes into the game,
// and the editor rebuilds just those things. Each person also sends where they're looking from, what they have
// selected and what they're doing; they show as a colored box around their selection and a name tag in the world,
// and in the people bar at the top.
import * as THREE from "../vendor/three.module.js";
import { RELAY, account } from "./net.js";
import { sanitize } from "./game.js";
import { nameTag } from "./others.js";

export const ACTION_WORDS = { look: "looking around", select: "selecting", move: "moving", rotate: "rotating", scale: "resizing", edit: "editing",
  script: "writing a script in", add: "adding things", delete: "deleting things", play: "play testing", gui: "editing the screen GUI", monster: "making a monster", away: "away" };
const J = (v) => JSON.stringify(v == null ? null : v);
const BASE = ["name", "settings", "gui", "files"];

// hooks: {scene, camera, boundsOf(id) -> {c, q, s} | null, nameOf(id), onWelcome(game, meta, you),
//         onEdit({ids, gone, scripts, base}), onPeople(list, meta), onError(e), onStatus(text)}
export function connectStudio(sid, hooks) {
  let ws = null, closed = false, tries = 0, meId = 0, meta = null, you = null, lastP = "", lastPAt = 0, timer = 0, pending = null, ready = false;
  const people = new Map(); // id -> {id, u, n, c, p, box, tag, tagText}
  const synced = { o: new Map(), sc: new Map(), b: {} }; // what the relay has (as JSON text), to find what changed

  function seed(game) {
    synced.o = new Map(game.objects.map((o) => [o.id, J(o)]));
    synced.sc = new Map((game.scripts || []).map((s) => [s.id, J(s)]));
    synced.b = {}; for (const k of BASE) synced.b[k] = J(game[k]);
  }
  function diff(game) {
    const m = { t: "ed" }, o = [], sc = [], b = {};
    const here = new Set();
    for (const x of game.objects) { here.add(x.id); const j = J(x); if (synced.o.get(x.id) !== j) { o.push(x); synced.o.set(x.id, j); } }
    const x = [...synced.o.keys()].filter((id) => !here.has(id)); for (const id of x) synced.o.delete(id);
    const hereSc = new Set();
    for (const s of game.scripts || []) { hereSc.add(s.id); const j = J(s); if (synced.sc.get(s.id) !== j) { sc.push(s); synced.sc.set(s.id, j); } }
    const xs = [...synced.sc.keys()].filter((id) => !hereSc.has(id)); for (const id of xs) synced.sc.delete(id);
    for (const k of BASE) { const j = J(game[k]); if (synced.b[k] !== j) { b[k] = game[k]; synced.b[k] = j; } }
    if (o.length) m.o = o; if (x.length) m.x = x; if (sc.length) m.sc = sc; if (xs.length) m.xs = xs; if (Object.keys(b).length) m.b = b;
    return Object.keys(m).length > 1 ? m : null;
  }
  // Send what changed (a big change goes in a few pieces so no message is too large).
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!pending || !ready || !ws || ws.readyState !== 1) return;
    const m = diff(pending); pending = null;
    if (!m) return;
    const objs = m.o || []; delete m.o;
    let first = true;
    for (let i = 0; i < objs.length || first; i += 150) {
      const part = first ? { ...m } : { t: "ed" };
      if (objs.length) part.o = objs.slice(i, i + 150);
      ws.send(JSON.stringify(part)); first = false;
    }
  }
  function push(game) { pending = game; if (!timer) timer = setTimeout(flush, 150); }

  // Put a change from someone else into the game. Returns what the editor has to rebuild.
  function absorb(game, m) {
    if (pending) flush(); // (my own changes go out first, so nothing of mine is lost)
    const ids = [], gone = [];
    if (Array.isArray(m.o)) {
      const clean = sanitize({ objects: m.o }).objects;
      for (const o of clean) {
        const i = game.objects.findIndex((x) => x.id === o.id);
        if (i >= 0) game.objects[i] = o; else game.objects.push(o);
        synced.o.set(o.id, J(o)); ids.push(o.id);
      }
    }
    if (Array.isArray(m.x)) { const set = new Set(m.x); game.objects = game.objects.filter((o) => !set.has(o.id)); for (const id of m.x) { synced.o.delete(id); gone.push(id); } }
    let scripts = false;
    if (Array.isArray(m.sc) || Array.isArray(m.xs)) {
      const map = new Map((game.scripts || []).map((s) => [s.id, s]));
      for (const s of sanitize({ scripts: m.sc || [] }).scripts) map.set(s.id, s);
      for (const id of m.xs || []) map.delete(id);
      game.scripts = [...map.values()];
      for (const s of game.scripts) synced.sc.set(s.id, J(s)); for (const id of m.xs || []) synced.sc.delete(id);
      scripts = true;
    }
    const base = [];
    if (m.b && typeof m.b === "object") {
      const c = sanitize({ ...game, objects: [], ...m.b });
      for (const k of BASE) if (k in m.b) { game[k] = c[k]; synced.b[k] = J(game[k]); base.push(k); }
    }
    return { ids, gone, scripts, base };
  }

  function connect() {
    const me = account();
    if (!me) { hooks.onError("signin"); return; }
    hooks.onStatus("Connecting…");
    ws = new WebSocket(RELAY.replace(/^http/, "ws") + "/studio/live/" + sid + "?t=" + encodeURIComponent(me.t));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "error") { closed = ["notinvited", "nostudio", "removed", "stopped", "signin"].includes(m.e); hooks.onError(m.e); return; }
      if (m.t === "welcome") {
        tries = 0; meId = m.id; meta = m.meta; you = m.you;
        clearPeople();
        for (const p of m.people) addPerson(p);
        const game = sanitize(m.game);
        seed(game); ready = true;
        hooks.onWelcome(game, meta, you);
        hooks.onStatus("Saved ✓ (shared)");
        lastP = ""; drawPeople();
        return;
      }
      if (m.t === "join") { addPerson(m); drawPeople(); return; }
      if (m.t === "leave") { removePerson(m.id); drawPeople(); return; }
      if (m.t === "meta") { meta = m.meta; drawPeople(); return; }
      if (m.t === "p") { const p = people.get(m.id); if (p) { p.p = m; drawPeople(); } return; }
      if (m.t === "ed") { const p = people.get(m.id); if (p) p.lastEdit = Date.now(); hooks.onEdit(m); return; }
    };
    ws.onclose = () => {
      ready = false;
      if (closed) return;
      hooks.onStatus("Reconnecting…");
      setTimeout(() => { if (!closed) connect(); }, Math.min(8000, 800 * 2 ** tries++));
    };
  }

  // ---------------------------------------------------------------- the other people: boxes, name tags, the bar
  const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  function addPerson(p) { if (p.id === meId) return; people.set(p.id, { id: p.id, u: p.u, n: p.n, c: p.c, p: p.p || null, boxes: [], tag: null, tagText: "" }); }
  function removePerson(id) { const p = people.get(id); if (!p) return; for (const b of p.boxes) hooks.scene.remove(b); if (p.tag) hooks.scene.remove(p.tag); people.delete(id); }
  function clearPeople() { for (const id of [...people.keys()]) removePerson(id); }
  function doing(p) {
    const a = (p.p && p.p.a) || "look", on = p.p && p.p.o ? hooks.nameOf(p.p.o) : "";
    return ACTION_WORDS[a] + (on && ["select", "move", "rotate", "scale", "edit", "script"].includes(a) ? " " + on : "");
  }
  // every frame: put the boxes and tags where they belong
  function update() {
    for (const p of people.values()) {
      const sel = (p.p && p.p.s) || [];
      let i = 0;
      for (const id of sel) {
        const b = hooks.boundsOf(id); if (!b) continue;
        let bx = p.boxes[i];
        if (!bx) { bx = new THREE.LineSegments(boxGeo, new THREE.LineBasicMaterial({ color: p.c, depthTest: false, transparent: true })); bx.renderOrder = 9; hooks.scene.add(bx); p.boxes.push(bx); }
        bx.position.copy(b.c); bx.quaternion.copy(b.q); bx.scale.copy(b.s).addScalar(0.25); bx.visible = true; i++;
      }
      for (; i < p.boxes.length; i++) p.boxes[i].visible = false;
      const text = (p.n || p.u) + " · " + doing(p);
      if (text !== p.tagText) { if (p.tag) hooks.scene.remove(p.tag); p.tag = nameTag(text, p.c); hooks.scene.add(p.tag); p.tagText = text; }
      const first = sel.length && hooks.boundsOf(sel[0]);
      const at = first ? first.c.clone().add(new THREE.Vector3(0, first.s.y / 2 + 1.6, 0)) : p.p && p.p.f ? new THREE.Vector3(...p.p.f).add(new THREE.Vector3(0, 2, 0)) : null;
      p.tag.visible = !!at && (!p.p || p.p.a !== "away");
      if (at) { p.tag.position.copy(at); const w = Math.min(14, Math.max(2.4, hooks.camera.position.distanceTo(at) * 0.09)); p.tag.scale.set(w, w / 4, 1); } // (about the same size on screen, near or far)
    }
  }
  function drawPeople() {
    const list = [...people.values()];
    hooks.onPeople(list.map((p) => ({ u: p.u, n: p.n, c: p.c, doing: doing(p), on: true })), meta, you);
  }
  // what I'm doing -> everyone else (when it changes, and every 3 s anyway)
  function presence(p) {
    if (!ready || !ws || ws.readyState !== 1) return;
    const text = JSON.stringify(p), now = Date.now();
    if (text === lastP && now - lastPAt < 3000) return;
    lastP = text; lastPAt = now;
    ws.send(JSON.stringify({ t: "p", ...p }));
  }

  connect();
  return {
    sid, push, flush, absorb, update, presence, doing,
    get meta() { return meta; }, get you() { return you; }, get ready() { return ready; },
    redraw: drawPeople,
    close() { closed = true; flush(); clearPeople(); try { ws && ws.close(); } catch {} },
  };
}

// The relay's routes for sharing (studio.js).
async function call(path, body) {
  const me = account();
  if (!me) return { ok: false, e: "signin" };
  try { return await (await fetch(RELAY + "/studio/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: me.t, ...body }) })).json(); }
  catch { return { ok: false, e: "net" }; }
}
export const shareStudio = (g) => call("share", { g });
export const inviteTo = (sid, u) => call("invite", { sid, u });
export const removeFrom = (sid, u) => call("remove", { sid, u });
export const stopSharing = (sid) => call("stop", { sid });
export const myStudios = () => call("list", {});
export const SHARE_ERR = { signin: "Sign in on the GunnerVerse home page first.", nouser: "There's no player with that username.", self: "That's you!", full: "A shared game can have up to 10 people.",
  notyours: "Only the owner can do that.", toomany: "You're in too many shared games (50).", net: "Couldn't reach GunnerVerse. Check your internet.", slowdown: "Slow down a little and try again.",
  banned: "This account can't share.", bad: "This game couldn't be shared.", toobig: "This game is too big to share.", nostudio: "This shared game isn't there anymore." };
