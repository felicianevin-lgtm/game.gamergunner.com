// Talking to the GunnerVerse relay from the studio and the play page (same address rules as the home page, hub.js):
// ?relay=http://localhost:8788 tests against a local relay and is remembered for this tab.
const PROD_RELAY = "https://gamergunner-relay.gamergunner-relay.workers.dev";
let relayParam = new URLSearchParams(location.search).get("relay");
try { if (relayParam) sessionStorage.setItem("gg_relay", relayParam); else relayParam = sessionStorage.getItem("gg_relay"); } catch {}
export const RELAY = (relayParam || PROD_RELAY).replace(/^ws/, "http").replace(/\/$/, "");

export function api(path, body) {
  return fetch(RELAY + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
}
// The player's account, shared with the home page and the game (localStorage "gg_account").
export function account() {
  try {
    const a = JSON.parse(localStorage.getItem("gg_account") || "null");
    if (a && /^[A-Za-z0-9_]{3,16}$/.test(a.u) && /^[0-9a-f]{16,64}$/.test(a.t)) return a;
  } catch {}
  return null;
}
// "@/hub/thumb/..." (a player game's picture on the relay) -> a full address.
export function thumbUrl(t) { return t && t[0] === "@" ? RELAY + t.slice(1) : t; }

// A live server (relay live.js): everyone playing the same game (key = game id, or "clash") is put together. A full
// server sends the game to the next one; a dropped connection comes back by itself (on({t:"reset"}) first, so the
// game can forget the old players). Returns {send(obj), id, close()}.
export function joinLive(key, on) {
  let ws = null, sn = 1, closed = false, id = 0, tries = 0, full = false;
  function connect() {
    const a = account();
    ws = new WebSocket(RELAY.replace(/^http/, "ws") + "/live/" + key + "?s=" + sn + (a ? "&t=" + a.t : ""));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "error") { if (m.e === "full" && sn < 40) { sn++; full = true; } else if (m.e !== "full") closed = true; return; }
      if (m.t === "welcome") { id = m.id; tries = 0; }
      on(m);
    };
    ws.onclose = () => {
      if (closed) return;
      if (full) { full = false; connect(); return; }
      id = 0; on({ t: "reset" });
      setTimeout(() => { if (!closed) connect(); }, Math.min(10000, 1000 * 2 ** tries++));
    };
  }
  connect();
  return {
    send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
    get id() { return id; },
    close() { closed = true; try { ws.close(); } catch {} },
  };
}
