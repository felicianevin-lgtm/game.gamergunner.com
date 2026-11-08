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
