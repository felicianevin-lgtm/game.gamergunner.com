// MUD VALLEY RP: play with friends! A lobby = a room on the GunnerVerse relay (relay/src/index.js, rooms with ?k=mv).
// You see your friends walking and driving (with name tags) and you can text each other on the phone:
//  - quick texts (8 presets, the relay's "qc"), "Send my location" (a map pin + waypoint, the relay's "mvpin"),
//  - typing (on unless you turn it off in Settings), only through the relay's filtered "chat" (80 characters,
//    no links or phone numbers, bad words starred out, one message every 1.5 s).
// Money, jobs and saves all stay on your own computer: only where you are, what you drive, your career (cop / robber /
// civilian + wanted stars: "mvrole") and your blaster shots are shared. Cops and robbers can splat / tase each other
// ("mvzap" goes only to the player who got hit; their own game decides what happens: crime.js zappedBy).
import * as THREE from "/create/vendor/three.module.js";
import { RELAY, account } from "/create/js/net.js";
import { makePerson, CLOTH_COLORS } from "./character.js";
import { buildingById } from "./interiors.js";
import { buildCar, animateCar, vehicleById } from "./vehicles.js";
import { groundAt } from "./terrain.js";
import { S, save } from "./save.js";
import { buildTrailer, trailerById, trailerBack } from "./trailer.js";
import { campModel, campItem } from "./camp.js";

export const QUICK = ["Meet me here!", "Race me!", "Need a tow!", "Cops are coming!", "Let’s go fishing!", "Follow me!", "Nice ride!", "Be right back!"];
const ERRORS = { notfound: "Nobody is in a lobby with that code.", taken: "That code is taken. Try again!", full: "That lobby is full (8 players).", otherroom: "That code is for a different game.", banned: "You can’t join that lobby.", locked: "That lobby is locked.", badmode: "Something went wrong.", expired: "You were gone too long. Join again!", gbanned: "You can’t play online right now.", slowdown: "Too many tries. Wait a minute!" };
const hex = (c) => c.toString(16).padStart(6, "0");
const unhex = (s) => parseInt(s || "888888", 16);
const newCode = () => String(10000000 + Math.floor(Math.random() * 89999999));
const ROLES = ["civ", "robber", "cop"];
// your parked rides / trailers / camp near you, as short text (the relay's "mvpark", 12 at most): kind|id|color|x|z|yaw|towing
// kind: c = a ride, t = a trailer, p = camp stuff. towing = 1: that trailer is hooked to the ride you're driving
// (an 8th part, y, is the height: for rides up in a truck bed or on a trailer deck)
const parkText = (k, id, c, x, z, yaw, h, y) => [k, id, hex(c ?? 0x888888), Math.round(x * 10) / 10, Math.round(z * 10) / 10, (Math.round(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 100) / 100), h ? 1 : 0, ...(y === undefined ? [] : [Math.round(y * 100) / 100])].join("|");
function parkModel(it) {
  if (it.k === "c") { if (vehicleById(it.id).id !== it.id) return null; const m = buildCar({ id: it.id, paint: it.c, rims: "chrome", tires: "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0 }); if (m.rider) m.rider.root.visible = false; return m.root; }
  if (it.k === "t") { if (!trailerById(it.id)) return null; const m = buildTrailer(it.id, it.c); if (m.awning) m.awning.visible = !it.h; return m.root; }
  if (it.k === "p") return campItem(it.id) ? campModel(it.id, it.c) : null;
  return null;
}
const tagText = (p) => (p.role === "cop" ? "👮 " : p.role === "robber" ? "🦹 " : "") + p.n + (p.role === "robber" && p.wanted ? " " + "★".repeat(p.wanted) : "");

// a floating name tag
function tag(text) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  g.font = "bold 30px sans-serif"; const w = Math.min(250, g.measureText(text).width + 24);
  g.fillStyle = "rgba(20,15,10,0.7)"; g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 18); g.fill();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128, 33, 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, transparent: true })); s.scale.set(3.2, 0.8, 1); s.renderOrder = 4;
  return s;
}

export class MP {
  constructor(api) {
    this.api = api; this.ws = null; this.code = ""; this.id = 0; this.name = ""; this.host = 0; this.status = "off";
    this.players = new Map(); this.msgs = []; this.unread = 0; this.sendT = 0; this.lastCar = null; this.rt = ""; this.closing = false; this.muted = false; this.chatRoom = true;
  }
  get on() { return this.status === "in"; }
  get copsOff() { return this.on && this.copsOn === false; }
  setCops(on) { this.send({ t: "mvcops", c: on ? 1 : 0 }); }
  create() { this.connect(newCode(), "create"); }
  join(code) { code = String(code || "").replace(/\D/g, ""); if (!/^(\d{6}|\d{8})$/.test(code)) { this.api.toast("Type the 8-digit code", "", "warn"); return; } this.connect(code, "join"); }
  connect(code, mode) {
    this.leave(true);
    this.code = code; this.status = "connecting"; this.closing = false;
    const a = account();
    let ws;
    try { ws = new WebSocket(RELAY.replace(/^http/, "ws") + "/room/" + code + "?mode=" + mode + "&k=mv" + (mode === "resume" ? "&rt=" + this.rt : "") + (a && mode !== "resume" ? "&t=" + encodeURIComponent(a.t) : "")); }
    catch { this.status = "off"; this.api.toast("Can’t go online", "", "warn"); return; }
    this.ws = ws;
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.onMsg(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.closing || this.status !== "in") { this.status = this.status === "in" ? "off" : this.status === "error" ? "error" : "off"; this.clearPlayers(); this.api.changed(); return; }
      // the connection dropped (sleep, Wi-Fi): come back with the resume token
      this.status = "connecting"; this.api.changed();
      setTimeout(() => { if (!this.closing && this.status === "connecting") this.connect(this.code, "resume"); }, 1500);
    };
  }
  leave(quiet) {
    if (this.ws) { this.closing = true; try { this.ws.send(JSON.stringify({ t: "bye" })); } catch {} try { this.ws.close(); } catch {} }
    this.ws = null; this.clearPlayers(); if (!quiet) { this.status = "off"; this.code = ""; this.api.changed(); }
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  say(from, text, kind = "") { this.msgs.push({ from, text, kind, t: Date.now() }); if (this.msgs.length > 40) this.msgs.shift(); this.unread++; this.api.changed(); }
  nameOf(id) { return id === this.id ? "You" : (this.players.get(id) || {}).n || "Someone"; }
  onMsg(m) {
    const A = this.api;
    switch (m.t) {
      case "welcome":
        this.id = m.id; this.name = m.n; this.host = m.h; this.rt = m.rt || ""; this.status = "in"; this.chatRoom = m.cr !== 0; this.copsOn = m.co !== 0; this.parkSent = ""; this.parkT = 0.3; this.roomSent = null; this.rideSent = null;
        if (!m.re) { this.clearPlayers(); for (const p of m.players || []) this.addPlayer(p); this.say("", "You joined lobby " + this.code + " as " + m.n + ".", "sys"); }
        this.sendLook(); this.sendRole(true); this.lastCar = null; A.changed(); break;
      case "join": this.addPlayer(m); this.say("", m.n + " joined the lobby! 👋", "sys"); A.toast("👋 " + m.n + " joined", "", "good", 2500); this.roleT = 0.5; this.parkSent = ""; this.parkT = 0.6; this.roomSent = null; this.rideSent = null; break;
      case "mvroom": { const p = this.players.get(m.id); if (p) p.room = typeof m.r === "string" ? m.r : ""; break; }
      case "mvride": { const p = this.players.get(m.id); if (p) { p.ride = m.d | 0; if (m.d === this.id) A.toast("🚗 " + p.n + " hopped in your ride!", "", "good", 2500); } break; }
      case "mvpark": { const p = this.players.get(m.id); if (p && Array.isArray(m.l)) this.setPark(p, m.l); break; }
      case "mvcops": { const was = this.copsOn; this.copsOn = !!m.c; if (was !== this.copsOn) { this.say("", m.c ? "🚓 The host turned the cops ON." : "🚫🚓 The host turned the cops OFF. No police in this lobby!", "sys"); A.toast(m.c ? "🚓 Cops are ON" : "🚫 Cops are OFF", m.c ? "" : "Nobody gets chased in this lobby.", m.c ? "warn" : "good", 3000); A.changed(); } break; }
      case "mvrole": { const p = this.players.get(m.id); if (p) { const r = ROLES[m.r] || "civ", w = m.w | 0; if (p.role !== r || p.wanted !== w) { p.role = r; p.wanted = w; this.retag(p); } } break; }
      case "mvzap": { const p = this.players.get(m.id); if (p) A.zapped(p, m.k); break; }
      case "mvbump": { const p = this.players.get(m.id); if (p && Array.isArray(m.v) && A.bumped) A.bumped(p, +m.v[0] || 0, +m.v[1] || 0); break; }
      case "shot": { const p = this.players.get(m.id); if (p && Array.isArray(m.p) && Array.isArray(m.x)) A.shot(m.p, m.x, m.w); break; }
      case "leave": { const p = this.players.get(m.id); if (p) { this.say("", p.n + " left.", "sys"); this.removePlayer(m.id); } break; }
      case "away": { const p = this.players.get(m.id); if (p) p.away = true; break; }
      case "back": { const p = this.players.get(m.id); if (p) p.away = false; break; }
      case "s": { const p = this.players.get(m.id); if (p) { p.tx = m.p[0]; p.ty = m.p[1]; p.tz = m.p[2]; p.tr = m.r; p.walk = !!m.w; if (p.x === undefined) { p.x = p.tx; p.y = p.ty; p.z = p.tz; p.r = p.tr; } } break; }
      case "look": { const p = this.players.get(m.id); if (p) { p.k = m.k; this.rebuild(p); } break; }
      case "car": { const p = this.players.get(m.id); if (p) { p.v = m.v; this.rebuild(p); } break; }
      case "qc": { const t = QUICK[m.q]; if (!t) break; this.say(this.nameOf(m.id), t, "qc"); if (m.id !== this.id) A.toast("💬 " + this.nameOf(m.id), t, "", 3000); break; }
      case "chat": if (S.chatOn) { this.say(this.nameOf(m.id), m.m, "chat"); if (m.id !== this.id) A.toast("💬 " + this.nameOf(m.id), m.m, "", 3000); } break;
      case "mvpin": { const who = this.nameOf(m.id); this.say(who, "📍 " + (m.id === this.id ? "You sent your location" : "Meet here!"), "pin"); if (m.id !== this.id) A.pin(who, m.p[0], m.p[2]); break; }
      case "host": this.host = m.id; this.say("", this.nameOf(m.id) + " is the lobby host now.", "sys"); break;
      case "muted": this.muted = !!m.c; A.toast(m.c ? "You were muted by the host" : "You can text again", "", m.c ? "warn" : "good"); break;
      case "chatroom": this.chatRoom = !!m.c; this.say("", m.c ? "Texting is on." : "The host turned texting off.", "sys"); break;
      case "kicked": this.closing = true; this.say("", "You were removed from the lobby.", "sys"); A.toast("You left the lobby", "The host removed you.", "warn"); break;
      case "error": this.status = "error"; this.err = ERRORS[m.e] || "Couldn’t connect (" + m.e + ")."; this.closing = true; A.toast("Lobby", this.err, "warn", 4000); A.changed(); break;
    }
  }
  addPlayer(p) {
    if (this.players.has(p.id)) return;
    const P = { id: p.id, n: p.n, k: p.k, v: p.v || "", away: !!p.a, model: null, car: null, tag: null, role: "civ", wanted: 0 };
    this.players.set(p.id, P); this.rebuild(P); this.api.changed();
  }
  removePlayer(id) { const p = this.players.get(id); if (!p) return; this.dispose(p); this.disposePark(p); this.players.delete(id); this.api.changed(); }
  clearPlayers() { for (const p of this.players.values()) { this.dispose(p); this.disposePark(p); } this.players.clear(); }
  dispose(p) { const sc = this.api.scene; if (p.model) sc.remove(p.model.root); if (p.car) sc.remove(p.car.root); if (p.tag) sc.remove(p.tag); p.model = p.car = p.tag = null; }
  disposePark(p) { for (const e of p.parkM || []) if (e) this.api.scene.remove(e.root); p.parkM = []; }
  // a friend's parked rides, trailers and camp (only rebuilds the ones that changed)
  setPark(p, list) {
    const items = list.slice(0, 14).map((t) => { const a = String(t).split("|"); return a.length === 7 || a.length === 8 ? { k: a[0], id: a[1], c: unhex(a[2]), x: +a[3], z: +a[4], yaw: +a[5], h: a[6] === "1", y: a.length === 8 ? +a[7] : null, key: a[0] + a[1] + a[2] + a[6] } : null; }).filter((it) => it && Number.isFinite(it.x) && Number.isFinite(it.z));
    p.parkM = p.parkM || [];
    for (let i = 0; i < Math.max(items.length, p.parkM.length); i++) {
      const it = items[i], e = p.parkM[i];
      if (e && (!it || e.key !== it.key)) { this.api.scene.remove(e.root); p.parkM[i] = null; }
      if (!it) continue;
      if (!p.parkM[i]) { const root = parkModel(it); if (!root) continue; this.api.scene.add(root); p.parkM[i] = { key: it.key, root, it }; }
      const E = p.parkM[i]; E.it = it;
      if (!it.h) { E.root.position.set(it.x, Number.isFinite(it.y) && it.y !== null ? it.y : groundAt(it.x, it.z) + (it.k === "p" ? 0 : 0.05), it.z); E.root.rotation.set(0, it.yaw, 0); }
    }
    p.parkM.length = items.length;
  }
  // (re)build a friend's person + ride from their look and car messages
  rebuild(p) {
    this.dispose(p);
    const k = Array.isArray(p.k) ? p.k : [];
    const g = String(k[3] || "000000"), d = (i) => parseInt(g[i], 16) || 0;
    const look = { shirt: unhex(k[0] || "2f8ae0"), pants: unhex(k[1] || "2a3550"), skin: unhex(k[2] || "ffc999"), hair: unhex(k[4] || "5a3a1a"), cap: k[5] && k[5] !== "000000" ? unhex(k[5]) : null, shoes: unhex(k[6] || "ffffff"),
      top: Math.min(5, d(0)), legs: Math.min(2, d(1)), hat: Math.min(3, d(2)), glasses: Math.min(2, d(4) >> 2), extra: d(4) & 3, acc: CLOTH_COLORS[d(5)] ?? 0xffffff };
    p.model = makePerson(look); this.api.scene.add(p.model.root);
    const parts = (p.v || "").split("|");
    if (parts.length === 3 && vehicleById(parts[1]).id === parts[1]) {
      p.car = buildCar({ id: parts[1], paint: unhex(parts[2]), rims: "chrome", tires: "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0 }, { driver: look });
      this.api.scene.add(p.car.root); p.model.root.visible = false;
    }
    p.tag = tag(tagText(p)); this.api.scene.add(p.tag);
  }
  retag(p) { if (!p.tag) return; this.api.scene.remove(p.tag); p.tag.material.map.dispose(); p.tag = tag(tagText(p)); this.api.scene.add(p.tag); this.api.changed(); }
  // your career + wanted stars (sent when they change, and every few seconds for people who just joined)
  sendRole(now) { if (!this.on) return; const r = ROLES.indexOf(S.role), w = S.wanted | 0; if (now || r !== this.lastRole || w !== this.lastWanted) { this.lastRole = r; this.lastWanted = w; this.roleT = 5; this.send({ t: "mvrole", r: Math.max(0, r), w }); } }
  zap(id, k) { this.send({ t: "mvzap", id, k }); }
  bump(id, vx, vz) { if (this.on) this.send({ t: "mvbump", id, v: [Math.round(vx * 10) / 10, Math.round(vz * 10) / 10] }); }
  // a friend's ride you're standing next to (to hop in): the player
  rideNear(x, z) { for (const p of this.players.values()) if (p.car && !p.away && !p.room && !p.ride && p.x !== undefined && Math.hypot(p.x - x, p.z - z) < p.car.len / 2 + 2.4) return p; return null; }
  // friends' cars as bump circles: [{ id, x, z, r, len }]
  carCircles() {
    const out = [];
    for (const p of this.players.values()) {
      if (!p.car || p.x === undefined || p.away || p.room) continue;
      const len = p.car.len, wid = p.car.wid, fx = Math.sin(p.r), fz = Math.cos(p.r);
      if (len <= 3) out.push({ id: p.id, x: p.x, z: p.z, y: p.y, r: Math.max(len, wid) * 0.45 });
      else for (const s of [0.26, -0.26]) out.push({ id: p.id, x: p.x + fx * len * s, z: p.z + fz * len * s, y: p.y, r: wid * 0.52 });
    }
    return out;
  }
  shot(p, x, w) { if (this.on) this.send({ t: "shot", p: p.map((v) => Math.round(v * 10) / 10), x: x.map((v) => Math.round(v * 10) / 10), w, h: 0 }); }
  sendLook() {
    const L = this.api.look();
    const ai = Math.max(0, CLOTH_COLORS.indexOf(L.acc ?? 0xffffff)), st = [L.top || 0, L.legs || 0, L.hat || 0, 0, ((L.glasses || 0) << 2) | (L.extra || 0), ai].map((v) => v.toString(16)).join("");
    this.send({ t: "look", k: [hex(L.shirt), hex(L.pants), hex(L.skin), st, hex(L.hair), L.cap ? hex(L.cap) : "000000", hex(L.shoes)] });
  }
  // texts
  quick(i) { if (!this.on) return; this.send({ t: "qc", q: i }); }
  chat(text) { if (!this.on || !S.chatOn) return; text = String(text || "").trim().slice(0, 80); if (text) this.send({ t: "chat", m: text }); }
  sendPin() { if (!this.on) return; const me = this.api.mapPos ? this.api.mapPos() : this.api.me(); this.send({ t: "mvpin", p: [Math.round(me.x * 10) / 10, 0, Math.round(me.z * 10) / 10] }); }
  kick(id) { this.send({ t: "kick", id }); }
  mute(id, c) { this.send({ t: "mute", id, c: c ? 1 : 0 }); }
  setChatRoom(c) { this.send({ t: "chatroom", c: c ? 1 : 0 }); }
  // every step: send where you are (10 times a second) and what you drive
  update(dt) {
    if (!this.on) return;
    this.sendT -= dt;
    const me = this.api.me();
    if (this.sendT <= 0) { this.sendT = 0.1; this.send({ t: "s", p: [me.x, me.y, me.z], r: me.yaw, w: me.moving ? 1 : 0, c: 0 }); }
    const v = me.car ? "w|" + me.car.id + "|" + hex(me.car.paint) : "";
    if (v !== this.lastCar) { this.lastCar = v; this.send({ t: "car", v }); }
    this.roleT = (this.roleT || 0) - dt; this.sendRole(this.roleT <= 0);
    // which room you're in ("" = outside) and whose ride you're sitting in (0 = none)
    const room = this.api.room ? this.api.room() : "", ride = this.api.riding ? this.api.riding() : 0;
    if (room !== this.roomSent) { this.roomSent = room; this.send({ t: "mvroom", r: room }); }
    if (ride !== this.rideSent) { this.rideSent = ride; this.send({ t: "mvride", d: ride }); }
    // your parked stuff: when it changes (checked every second), and again every 10 s for anyone who missed it
    this.parkT = (this.parkT ?? 0) - dt; this.parkAge = (this.parkAge || 0) + dt;
    if (this.parkT <= 0 && this.api.parked) {
      this.parkT = 1;
      const l = []; let size = 30; for (const q of this.api.parked()) { const t = parkText(...q); if (size + t.length + 3 > 500 || l.length >= 12) break; l.push(t); size += t.length + 3; } // (a relay message is 512 bytes at most)
      const str = l.join(";");
      if (str !== this.parkSent || this.parkAge > 10) { this.parkSent = str; this.parkAge = 0; this.send({ t: "mvpark", l }); }
    }
  }
  // where a passenger sits in a ride (car = the model, at x, y, z turned yaw)
  static seatAt(C, x, y, z, yaw) {
    const s = C.seat, lx = Math.abs(s.x) > 0.2 ? -s.x : 0, lz = Math.abs(s.x) > 0.2 ? s.z : s.z - 0.55, ly = (C.liftY || 0) + s.y + (Math.abs(s.x) > 0.2 ? 0 : 0.05);
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    return { x: x + lx * c + lz * sn, y: y + ly, z: z - lx * sn + lz * c };
  }
  draw(dt, time) {
    const myRoom = this.api.room ? this.api.room() : "";
    for (const p of this.players.values()) {
      if (p.tx === undefined || !p.model) continue;
      const here = (p.room || "") === myRoom;
      p.model.root.visible = here && !p.car; if (p.car) p.car.root.visible = here; p.tag.visible = here;
      for (const e of p.parkM || []) if (e) e.root.visible = !myRoom;
      if (!here) { p.x = p.tx; p.y = p.ty; p.z = p.tz; continue; }
      if (p.ride) { // (riding along in someone's ride)
        const dr = p.ride === this.id ? this.api.myRide && this.api.myRide() : this.players.get(p.ride), C = dr && (dr.car || dr.C);
        if (C && (dr.x !== undefined)) {
          const st = MP.seatAt(C, dr.x, (dr.y || 0) + (dr.C ? 0 : 0.06), dr.z, dr.r ?? dr.yaw);
          p.x = st.x; p.y = st.y; p.z = st.z; if (p.car) p.car.root.visible = false;
          p.model.root.visible = true; p.model.root.position.set(st.x, st.y, st.z); p.model.root.rotation.y = dr.r ?? dr.yaw; p.model.root.scale.setScalar(0.85); p.model.pose("sit", time);
          p.tag.position.set(st.x, st.y + 2.1, st.z); continue;
        }
      }
      p.model.root.scale.setScalar(1);
      const k = Math.min(1, dt * 10);
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
      let dr = p.tr - p.r; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); p.r += dr * k;
      if (p.car) { p.car.root.position.set(p.x, p.y + 0.06, p.z); p.car.root.rotation.set(0, p.r, 0); animateCar(p.car, { speed: p.walk ? 8 : 0, steer: 0 }, dt); p.tag.position.set(p.x, p.y + 3.4, p.z); }
      else { const g = myRoom ? p.y : Math.max(p.y, groundAt(p.x, p.z) - 0.2); p.model.root.position.set(p.x, g, p.z); p.model.root.rotation.y = p.r; p.model.pose(p.walk ? "walk" : "stand", time); p.tag.position.set(p.x, g + 2.5, p.z); }
      p.tag.material.opacity = p.away ? 0.4 : 1;
      for (const e of p.parkM || []) if (e && e.it.h) { // (their trailer, the bike in their truck bed...: placed relative to their ride)
        const it = e.it, cs = Math.cos(p.r), sn = Math.sin(p.r), x = p.x + it.x * cs + it.z * sn, z = p.z - it.x * sn + it.z * cs;
        e.root.visible = !!p.car; e.root.position.set(x, it.y !== null ? p.y + 0.06 + it.y : groundAt(x, z) + 0.05, z); e.root.rotation.set(0, p.r + it.yaw, 0);
      }
    }
  }
  dots() {
    const out = [];
    for (const p of this.players.values()) {
      if (p.x === undefined) continue;
      if (p.room) { const bd = buildingById(p.room); if (bd) out.push({ x: bd.dx, z: bd.dz, n: p.n, role: p.role }); continue; } // (inside: show them at the door)
      out.push({ x: p.x, z: p.z, n: p.n, role: p.role });
    }
    return out;
  }
  list() { return [...this.players.values()]; }
}
