// LAST TRAIN WEST: talking to the GunnerVerse relay (relay/src/index.js, rooms with ?k=lt).
//  - The LOBBY: one shared room everybody walks around in (4-digit codes, ?mode=auto: join it or open it).
//  - A RUN: a fresh 8-digit room made by a pad's leader; everyone on that pad (4 at most) joins it.
// Without the relay (offline) the game still works: solo runs.
import { RELAY, account } from "/create/js/net.js";

export const LOBBY_CODES = Array.from({ length: 12 }, (_, i) => String(7480 + i));
export class Conn {
  // on(msg) gets every message; done(why) when it closes for good
  constructor(code, mode, on, done) {
    this.code = code; this.on = on; this.done = done; this.id = 0; this.host = 0; this.open = false; this.closing = false;
    const a = account(), name = localStorage.getItem("gv_name") || "";
    try { this.ws = new WebSocket(RELAY.replace(/^http/, "ws") + "/room/" + code + "?mode=" + mode + "&k=lt" + (a ? "&t=" + encodeURIComponent(a.t) : "") + (name ? "&d=" + encodeURIComponent(name) : "")); }
    catch { setTimeout(() => done("net"), 0); return; }
    this.ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "welcome") { this.id = m.id; this.host = m.h; this.name = m.n; this.open = true; }
      if (m.t === "host") this.host = m.id;
      if (m.t === "error") this.err = m.e;
      this.on(m);
    };
    this.ws.onerror = () => {};
    this.ws.onclose = () => { this.open = false; if (!this.closing) this.done(this.err || "closed"); };
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.closing = true; try { this.send({ t: "bye" }); this.ws.close(); } catch {} }
  get isHost() { return !!this.id && this.id === this.host; }
}
// find a lobby room with space: try each code; "full" / "otherroom" -> the next one
export function joinLobby(on, done) {
  let i = 0, conn = null;
  const tryNext = () => {
    if (i >= LOBBY_CODES.length) { done("full"); return; }
    const code = LOBBY_CODES[i++];
    let welcomed = false;
    conn = new Conn(code, "auto", (m) => {
      if (m.t === "welcome") welcomed = true;
      if (m.t === "error" && ["full", "otherroom", "taken", "locked", "notfound"].includes(m.e)) { conn.closing = true; tryNext(); return; }
      on(m, conn);
    }, (why) => { if (!welcomed && why !== "gbanned") { done(why); return; } done(why); });
    box.conn = conn;
  };
  const box = { conn: null, close() { if (conn) conn.close(); } };
  tryNext();
  return box;
}
// join a run's room: the leader opens it, everyone else joins (and tries again for a few seconds until it's open)
export function joinRun(code, leader, on, done) {
  let tries = 0, conn = null;
  const box = { conn: null, close() { if (conn) conn.close(); } };
  const go = () => {
    conn = new Conn(code, leader ? "create" : "join", (m) => {
      if (m.t === "error" && m.e === "notfound" && tries < 12) { conn.closing = true; tries++; setTimeout(go, 400); return; }
      on(m, conn);
    }, done);
    box.conn = conn;
  };
  go();
  return box;
}
export const newCode = () => String(10000000 + Math.floor(Math.random() * 89999999));
