// MUD VALLEY RP: play with friends! A lobby = a room on the GunnerVerse relay (relay/src/index.js, rooms with ?k=mv).
// You see your friends walking and driving (with name tags) and you can text each other on the phone:
//  - quick texts (8 presets, the relay's "qc"), "Send my location" (a map pin + waypoint, the relay's "mvpin"),
//  - typing only if you turn chat on (Settings), and only through the relay's filtered "chat" (80 characters,
//    no links or phone numbers, bad words starred out, one message every 1.5 s).
// Money, robbers, cops, jobs and saves all stay on your own computer: only where you are + what you drive is shared.
import * as THREE from "/create/vendor/three.module.js";
import { RELAY, account } from "/create/js/net.js";
import { makePerson } from "./character.js";
import { buildCar, animateCar, vehicleById } from "./vehicles.js";
import { groundAt } from "./terrain.js";
import { S, save } from "./save.js";

export const QUICK = ["Meet me here!", "Race me!", "Need a tow!", "Cops are coming!", "Let’s go fishing!", "Follow me!", "Nice ride!", "Be right back!"];
const ERRORS = { notfound: "Nobody is in a lobby with that code.", taken: "That code is taken. Try again!", full: "That lobby is full (8 players).", otherroom: "That code is for a different game.", banned: "You can’t join that lobby.", locked: "That lobby is locked.", badmode: "Something went wrong.", expired: "You were gone too long. Join again!", gbanned: "You can’t play online right now.", slowdown: "Too many tries. Wait a minute!" };
const hex = (c) => c.toString(16).padStart(6, "0");
const unhex = (s) => parseInt(s || "888888", 16);
const newCode = () => String(10000000 + Math.floor(Math.random() * 89999999));

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
        this.id = m.id; this.name = m.n; this.host = m.h; this.rt = m.rt || ""; this.status = "in"; this.chatRoom = m.cr !== 0;
        if (!m.re) { this.clearPlayers(); for (const p of m.players || []) this.addPlayer(p); this.say("", "You joined lobby " + this.code + " as " + m.n + ".", "sys"); }
        this.sendLook(); this.lastCar = null; A.changed(); break;
      case "join": this.addPlayer(m); this.say("", m.n + " joined the lobby! 👋", "sys"); A.toast("👋 " + m.n + " joined", "", "good", 2500); break;
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
    const P = { id: p.id, n: p.n, k: p.k, v: p.v || "", away: !!p.a, model: null, car: null, tag: null };
    this.players.set(p.id, P); this.rebuild(P); this.api.changed();
  }
  removePlayer(id) { const p = this.players.get(id); if (!p) return; this.dispose(p); this.players.delete(id); this.api.changed(); }
  clearPlayers() { for (const p of this.players.values()) this.dispose(p); this.players.clear(); }
  dispose(p) { const sc = this.api.scene; if (p.model) sc.remove(p.model.root); if (p.car) sc.remove(p.car.root); if (p.tag) sc.remove(p.tag); p.model = p.car = p.tag = null; }
  // (re)build a friend's person + ride from their look and car messages
  rebuild(p) {
    this.dispose(p);
    const k = Array.isArray(p.k) ? p.k : [];
    const look = { shirt: unhex(k[0] || "2f8ae0"), pants: unhex(k[1] || "2a3550"), skin: unhex(k[2] || "ffc999"), hair: unhex(k[4] || "5a3a1a"), cap: k[5] && k[5] !== "000000" ? unhex(k[5]) : null, shoes: unhex(k[6] || "ffffff") };
    p.model = makePerson(look); this.api.scene.add(p.model.root);
    const parts = (p.v || "").split("|");
    if (parts.length === 3 && vehicleById(parts[1]).id === parts[1]) {
      p.car = buildCar({ id: parts[1], paint: unhex(parts[2]), rims: "chrome", tires: "street", engine: 0, limit: 1, lift: 0, neon: 0, dirt: 0 }, { driver: look });
      this.api.scene.add(p.car.root); p.model.root.visible = false;
    }
    p.tag = tag(p.n); this.api.scene.add(p.tag);
  }
  sendLook() {
    const L = this.api.look();
    this.send({ t: "look", k: [hex(L.shirt), hex(L.pants), hex(L.skin), "000000", hex(L.hair), L.cap ? hex(L.cap) : "000000", hex(L.shoes)] });
  }
  // texts
  quick(i) { if (!this.on) return; this.send({ t: "qc", q: i }); }
  chat(text) { if (!this.on || !S.chatOn) return; text = String(text || "").trim().slice(0, 80); if (text) this.send({ t: "chat", m: text }); }
  sendPin() { if (!this.on) return; const me = this.api.me(); this.send({ t: "mvpin", p: [Math.round(me.x * 10) / 10, 0, Math.round(me.z * 10) / 10] }); }
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
  }
  draw(dt, time) {
    for (const p of this.players.values()) {
      if (p.tx === undefined || !p.model) continue;
      const k = Math.min(1, dt * 10);
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
      let dr = p.tr - p.r; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); p.r += dr * k;
      if (p.car) { p.car.root.position.set(p.x, p.y + 0.06, p.z); p.car.root.rotation.set(0, p.r, 0); animateCar(p.car, { speed: p.walk ? 8 : 0, steer: 0 }, dt); p.tag.position.set(p.x, p.y + 3.4, p.z); }
      else { const g = Math.max(p.y, groundAt(p.x, p.z) - 0.2); p.model.root.position.set(p.x, g, p.z); p.model.root.rotation.y = p.r; p.model.pose(p.walk ? "walk" : "stand", time); p.tag.position.set(p.x, g + 2.5, p.z); }
      p.tag.material.opacity = p.away ? 0.4 : 1;
    }
  }
  dots() { const out = []; for (const p of this.players.values()) if (p.x !== undefined) out.push({ x: p.x, z: p.z, n: p.n }); return out; }
}
