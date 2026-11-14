// CIRCUIT SIEGE: talking to the GunnerVerse relay (relay/src/index.js, rooms with ?k=td).
//  - The HUB: one shared room everybody walks around in. The game tries a short list of hub codes with ?mode=auto
//    (join it, or open it if nobody's there) until one has room.
//  - A MATCH: a fresh 8-digit room made by the pad's leader; everyone on the pad joins it.
import { RELAY, account } from "/create/js/net.js";

export const HUB_CODES = Array.from({ length: 12 }, (_, i) => String(7380 + i));
export class Conn {
  // on(msg) gets every message; done(why) when it closes for good
  constructor(code, mode, on, done) {
    this.code = code; this.on = on; this.done = done; this.id = 0; this.host = 0; this.open = false; this.closing = false;
    const a = account();
    try { this.ws = new WebSocket(RELAY.replace(/^http/, "ws") + "/room/" + code + "?mode=" + mode + "&k=td" + (a ? "&t=" + encodeURIComponent(a.t) : "")); }
    catch { setTimeout(() => done("net"), 0); return; }
    this.ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === "welcome") { this.id = m.id; this.host = m.h; this.name = m.n; this.open = true; } if (m.t === "host") this.host = m.id; if (m.t === "error") this.err = m.e; this.on(m); };
    this.ws.onclose = () => { this.open = false; if (!this.closing) this.done(this.err || "closed"); };
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.closing = true; try { this.send({ t: "bye" }); this.ws.close(); } catch {} }
  get isHost() { return this.id && this.id === this.host; }
}
// find a hub room with space: try each code; "full" / "otherroom" (a code some other game uses) -> the next one
export function joinHub(on, done, start = 0) {
  let i = start, conn = null;
  const tryNext = () => {
    if (i >= HUB_CODES.length) { done("full"); return; }
    const code = HUB_CODES[i++];
    let welcomed = false;
    conn = new Conn(code, "auto", (m) => { if (m.t === "welcome") welcomed = true; if (m.t === "error" && ["full", "otherroom", "taken", "locked", "notfound"].includes(m.e)) { conn.closing = true; tryNext(); return; } on(m, conn); }, (why) => { if (!welcomed && why !== "slowdown" && why !== "gbanned") return; done(why); });
  };
  tryNext();
  return { get conn() { return conn; } };
}
export const newCode = () => String(10000000 + Math.floor(Math.random() * 89999999));
