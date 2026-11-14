// CIRCUIT SIEGE: the screens. The Crate Room (buy + open crates, with a spinning reveal), the Tower Locker (your towers
// and your 5-tower loadout), trading with other players, and the dev menu (code 2468).
import { TOWERS, towerById, RARITIES, CRATES, ENEMIES, rollCrate, MAPS } from "./data.js";
import { S, save, addTower, removeTower, fmt } from "./save.js";
import { SFX } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let API = null; // { players(): [{id, name}], tradeSend(to, o), giveSend(to, o), devCmd(c), inMatch(), myId() }
export function initUI(api) { API = api; $("panel").addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b && !b.disabled) onAct(b.dataset.a, b.dataset.v, b); }); }
let onAct = () => {};
export const isOpen = () => !$("panel").classList.contains("hidden");
export function close() { $("panel").classList.add("hidden"); $("panel").innerHTML = ""; onAct = () => {}; if (trade && trade.open) tradeCancel(true); }
function open(html, act) { $("panel").innerHTML = `<div class="box"><button type="button" class="x" data-a="close">✕</button>${html}</div>`; $("panel").classList.remove("hidden"); onAct = (a, v, b) => { if (a === "close") { SFX.click(); close(); return; } act(a, v, b); }; }
export function toast(t, k = "", ms = 2600) { const d = document.createElement("div"); d.className = "toast " + k; d.textContent = t; $("toasts").appendChild(d); setTimeout(() => d.classList.add("out"), ms); setTimeout(() => d.remove(), ms + 400); }
export function banner(t, c = "#3aff6a") { const m = $("banner"); m.textContent = t; m.style.color = c; m.classList.remove("show"); void m.offsetWidth; m.classList.add("show"); }
export function setBolts() { $("bolts").textContent = "⚡ " + fmt(S.bolts); }
const card = (T, extra = "") => { const R = RARITIES[T.r]; return `<div class="tcard" style="--rc:${R.color}"><b>${esc(T.name)}</b><small>${R.name}</small><span>💥${T.dmg} 🎯${T.rng} ⚡${T.rate}/s · $${fmt(T.cost)}</span>${extra}</div>`; };

// ---------------------------------------------------------------- the Crate Room
export function crates(r0 = 0) {
  setBolts();
  open(`<h2>📦 CRATES</h2><p class="sub">Every crate has a robot tower inside. The <b>Normal Crate</b> is cheap but the good stuff is rare. The <b>Rare Crate</b> costs more, but it's WAY more likely to have Epic, Legendary and Mythic towers! You have <b>⚡ ${fmt(S.bolts)}</b> bolts (win waves to get more).</p>
    <div class="crates two">${CRATES.map((c, i) => `<div class="crate${i === r0 ? " pick" : ""}" style="--rc:${c.color}"><div class="cbox"></div><b>${c.name.toUpperCase()}</b><div class="odds">${c.odds.map((p, r) => p ? `<span style="color:${RARITIES[r].color}">${RARITIES[r].name} <b>${p}%</b></span>` : "").join("")}</div><button type="button" class="big" data-a="buy" data-v="${i}" ${S.bolts >= c.price ? "" : "disabled"}>⚡ ${fmt(c.price)}</button></div>`).join("")}</div><div id="reveal"></div>`, (a, v) => {
    if (a === "buy") {
      const C = CRATES[+v]; if (S.bolts < C.price) { SFX.nope(); return; }
      S.bolts -= C.price; S.stats.crates++; const id = rollCrate(+v); addTower(id); save(); setBolts();
      const T = towerById(id), R = RARITIES[T.r]; SFX.crate();
      setTimeout(() => $("reveal") && $("reveal").scrollIntoView({ behavior: "smooth", block: "center" }), 30);
      $("reveal").innerHTML = `<div class="rev spin" style="--rc:${C.color}"><div class="cbox big"></div><b>Opening...</b></div>`;
      setTimeout(() => { if (!$("reveal")) return; SFX.reveal(T.r); $("reveal").innerHTML = `<div class="rev pop r${T.r}" style="--rc:${R.color}"><small>${R.name.toUpperCase()}${T.r >= 4 ? "!!!" : T.r >= 3 ? "!" : ""}</small>${card(T, `<em>You have ${S.inv[id]}</em>`)}<button type="button" data-a="again" data-v="${v}">Open another</button></div>`; $("reveal").scrollIntoView({ behavior: "smooth", block: "center" }); for (const b of document.querySelectorAll('[data-a="buy"]')) b.disabled = S.bolts < CRATES[+b.dataset.v].price; }, 1300);
    }
    if (a === "again") { onAct("buy", v); }
  });
}
// ---------------------------------------------------------------- the Tower Locker (loadout)
export function locker() {
  const own = TOWERS.filter((t) => S.inv[t.id] > 0).sort((a, b) => b.r - a.r);
  open(`<h2>🗄 TOWER LOCKER</h2><p class="sub">Pick up to <b>5</b> towers to bring into matches (your loadout). Get more from crates!</p>
    <h3>Loadout (${S.loadout.length}/5)</h3><div class="tgrid">${S.loadout.map((id) => card(towerById(id), `<button type="button" data-a="un" data-v="${id}">Remove</button>`)).join("") || '<p class="note">Empty! Add a tower below.</p>'}</div>
    <h3>All your towers</h3><div class="tgrid">${own.map((T) => card(T, `<em>×${S.inv[T.id]}</em>${S.loadout.includes(T.id) ? "<button type=\"button\" disabled>Equipped</button>" : `<button type="button" data-a="eq" data-v="${T.id}" ${S.loadout.length >= 5 ? "disabled" : ""}>Equip</button>`}`)).join("")}</div>
    <h3>Stats</h3><p class="note">Matches ${S.stats.matches} · Wins ${S.stats.wins} · Waves ${fmt(S.stats.waves)} · Robots destroyed ${fmt(S.stats.kills)} · Bosses ${S.stats.bosses} · Best Endless wave ${S.stats.bestEndless} · Crates ${S.stats.crates} · Trades ${S.stats.trades}</p>`, (a, v) => {
    if (a === "eq" && S.loadout.length < 5 && !S.loadout.includes(v)) { S.loadout.push(v); save(); SFX.click(); locker(); }
    if (a === "un") { S.loadout = S.loadout.filter((x) => x !== v); save(); SFX.click(); locker(); }
  });
}
// ---------------------------------------------------------------- trading
// both players put towers (and bolts) on the table; when BOTH press Ready (with the same offers) the trade happens
let trade = null;
const offerHash = (o) => { let h = 7; for (const k of Object.keys(o.it).sort()) for (const ch of k + o.it[k]) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return (h + o.b * 17) % 2147483647; };
const offerList = (o) => Object.entries(o.it).filter(([, n]) => n > 0).map(([id, n]) => id + ":" + n);
export function tradeMenu() {
  const ps = API.players();
  open(`<h2>🔁 TRADE TERMINAL</h2><p class="sub">Pick a player in the hub to ask for a trade. You both put stuff on the table, and when you both press <b>READY</b>, it swaps.</p>
    <div class="list">${ps.length ? ps.map((p) => `<div class="item"><b>${esc(p.name)}</b><button type="button" data-a="ask" data-v="${p.id}">Ask to trade</button></div>`).join("") : '<p class="note">Nobody else is in the hub right now. (Play online with friends to trade!)</p>'}</div>`, (a, v) => {
    if (a === "ask") { API.tradeSend(+v, { k: "req" }); toast("Trade request sent!", "good"); SFX.click(); close(); }
  });
}
export function tradeMsg(m) {
  const who = (API.players().find((p) => p.id === m.id) || {}).name || "Someone";
  if (m.k === "req") {
    if (trade && trade.open) { API.tradeSend(m.id, { k: "no" }); return; }
    SFX.coin(); open(`<h2>🔁 TRADE?</h2><p class="sub"><b>${esc(who)}</b> wants to trade with you!</p><div class="btns"><button type="button" class="big" data-a="yes">YES</button><button type="button" data-a="no">No thanks</button></div>`, (a) => {
      if (a === "yes") { API.tradeSend(m.id, { k: "ok" }); startTrade(m.id, who); } else { API.tradeSend(m.id, { k: "no" }); close(); }
    });
  } else if (m.k === "ok") { if (!trade || !trade.open) startTrade(m.id, who); }
  else if (m.k === "no") toast(who + " said no to the trade.", "warn");
  else if (!trade || trade.with !== m.id) return;
  else if (m.k === "offer") { trade.them = { it: Object.fromEntries((m.it || []).map((s) => { const [id, n] = s.split(":"); return [id, +n]; })), b: m.b || 0 }; trade.myReady = trade.theyReady = false; drawTrade(); }
  else if (m.k === "ready") { trade.theyReady = !!m.r; trade.theirH = m.h; drawTrade(); maybeSwap(); }
  else if (m.k === "cancel") { toast(who + " cancelled the trade.", "warn"); trade.open = false; close(); }
}
function startTrade(id, who) { trade = { open: true, with: id, who, mine: { it: {}, b: 0 }, them: { it: {}, b: 0 }, myReady: false, theyReady: false }; drawTrade(); }
function sendOffer() { trade.myReady = trade.theyReady = false; API.tradeSend(trade.with, { k: "offer", it: offerList(trade.mine), b: trade.mine.b }); drawTrade(); }
function tradeCancel(silent) { if (!trade || !trade.open) return; trade.open = false; API.tradeSend(trade.with, { k: "cancel" }); if (!silent) close(); }
function drawTrade() {
  const t = trade, side = (o) => Object.entries(o.it).filter(([, n]) => n > 0).map(([id, n]) => `<span class="chip" style="--rc:${RARITIES[towerById(id).r].color}">${esc(towerById(id).name)} ×${n}</span>`).join("") + (o.b ? `<span class="chip">⚡ ${fmt(o.b)}</span>` : "") || '<span class="note">nothing yet</span>';
  const own = TOWERS.filter((T) => S.inv[T.id] > 0);
  const html = `<h2>🔁 TRADING WITH ${esc(t.who.toUpperCase())}</h2>
    <div class="trade"><div><h3>You give ${t.myReady ? "✅" : ""}</h3><div class="table">${side(t.mine)}</div></div><div><h3>${esc(t.who)} gives ${t.theyReady ? "✅" : ""}</h3><div class="table">${side(t.them)}</div></div></div>
    <h3>Add from your towers</h3><div class="list">${own.map((T) => `<div class="item"><b style="color:${RARITIES[T.r].color}">${esc(T.name)}</b><small>you have ${S.inv[T.id]}</small><button type="button" data-a="add" data-v="${T.id}" ${(t.mine.it[T.id] || 0) >= S.inv[T.id] ? "disabled" : ""}>+1</button><button type="button" data-a="rem" data-v="${T.id}" ${t.mine.it[T.id] ? "" : "disabled"}>-1</button></div>`).join("")}</div>
    <div class="btns">Bolts: <input id="trB" type="number" min="0" max="${S.bolts}" value="${t.mine.b}" style="width:110px"> <button type="button" data-a="bolts">Set bolts</button></div>
    <div class="btns"><button type="button" class="big" data-a="ready">${t.myReady ? "✅ READY (waiting...)" : "READY"}</button><button type="button" data-a="cancel">Cancel</button></div><p class="note">If anyone changes their side, both have to press Ready again.</p>`;
  open(html, (a, v) => {
    if (a === "add") { t.mine.it[v] = Math.min(S.inv[v] || 0, (t.mine.it[v] || 0) + 1); sendOffer(); }
    if (a === "rem") { t.mine.it[v] = Math.max(0, (t.mine.it[v] || 0) - 1); sendOffer(); }
    if (a === "bolts") { t.mine.b = Math.max(0, Math.min(S.bolts, Math.floor(+$("trB").value || 0))); sendOffer(); }
    if (a === "ready") { t.myReady = !t.myReady; API.tradeSend(t.with, { k: "ready", r: t.myReady ? 1 : 0, h: (offerHash(t.mine) * 7 + offerHash(t.them)) % 2147483647 }); drawTrade(); maybeSwap(); }
    if (a === "cancel") tradeCancel();
  });
}
function maybeSwap() {
  const t = trade; if (!t || !t.open || !t.myReady || !t.theyReady) return;
  if (t.theirH !== (offerHash(t.them) * 7 + offerHash(t.mine)) % 2147483647) return; // (their screen shows something different: wait)
  for (const [id, n] of Object.entries(t.mine.it)) if ((S.inv[id] || 0) < n) { toast("You don't have that anymore!", "warn"); tradeCancel(); return; }
  if (S.bolts < t.mine.b) { tradeCancel(); return; }
  for (const [id, n] of Object.entries(t.mine.it)) if (n > 0) removeTower(id, n);
  for (const [id, n] of Object.entries(t.them.it)) if (n > 0 && towerById(id)) addTower(id, n);
  S.bolts = S.bolts - t.mine.b + t.them.b; S.stats.trades++; save(); setBolts();
  t.open = false; SFX.win(); close(); banner("TRADE DONE!", "#3ad0ff");
}
// ---------------------------------------------------------------- the dev menu (code 2468)
const DEV = "2468";
let devCode = (() => { try { return sessionStorage.getItem("ct_dev") || ""; } catch { return ""; } })();
export const devOn = () => devCode === DEV;
export const getDevCode = () => devCode;
export function dev() {
  if (!devOn()) {
    open(`<h2>🛠 DEV</h2><p class="sub">Type the dev code:</p><input id="devIn" type="password" inputmode="numeric" maxlength="8" style="font-size:22px;width:9em;text-align:center"><div class="btns"><button type="button" class="big" data-a="unlock">UNLOCK</button></div><p class="note" id="devNote"></p>`, (a) => {
      if (a === "unlock") { const v = $("devIn").value.trim(); if (v === DEV) { devCode = v; try { sessionStorage.setItem("ct_dev", v); } catch {} SFX.coin(); dev(); } else { SFX.nope(); $("devNote").textContent = "❌ Wrong code."; } }
    });
    setTimeout(() => $("devIn") && $("devIn").focus(), 50); return;
  }
  const ps = API.players(), inM = API.inMatch(), towerOpts = TOWERS.map((t) => `<option value="${t.id}">${esc(t.name)} (${RARITIES[t.r].name})</option>`).join("");
  open(`<h2>🛠 DEV MENU</h2><p class="sub">⚡ ${fmt(S.bolts)} bolts</p>
    <h3>⚡ Bolts</h3><div class="btns"><input id="dvB" type="number" value="${S.bolts}" style="width:130px"><button type="button" data-a="setb">Set</button>${[1000, 10000, 100000].map((n) => `<button type="button" data-a="addb" data-v="${n}">+${fmt(n)}</button>`).join("")}</div>
    <h3>🤖 Give yourself a tower</h3><div class="btns"><select id="dvT">${towerOpts}</select><input id="dvN" type="number" value="1" min="1" max="99" style="width:60px"><button type="button" data-a="gives">Give me</button><button type="button" data-a="all">Give me EVERY tower</button></div>
    <h3>🎁 Give a player something</h3>${ps.length ? `<div class="btns"><select id="dvP">${ps.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select><select id="dvT2"><option value="">(just bolts)</option>${towerOpts}</select><input id="dvN2" type="number" value="1" min="1" max="99" style="width:60px"> bolts: <input id="dvB2" type="number" value="0" min="0" style="width:90px"><button type="button" data-a="givep">Give</button></div>` : '<p class="note">No other players in the hub right now.</p>'}
    ${inM ? `<h3>👾 In this match</h3><div class="btns"><select id="dvE">${Object.entries(ENEMIES).map(([id, e]) => `<option value="${id}">${esc(e.name)}${e.boss ? " (BOSS)" : ""}</option>`).join("")}</select> × <input id="dvEN" type="number" value="5" min="1" max="50" style="width:60px"> toughness × <input id="dvEM" type="number" value="1" min="0.1" max="100" step="0.1" style="width:60px"><button type="button" data-a="spawn">Spawn</button></div>
      <div class="btns"><button type="button" data-a="cash">+$10,000 match cash</button><button type="button" data-a="heal">❤ Fix the core</button> Jump to wave <input id="dvW" type="number" value="10" min="1" max="999" style="width:70px"><button type="button" data-a="wave">Go</button></div>` : '<p class="note">(Spawning robots and match cash show up here while you\'re in a match.)</p>'}
    <div class="btns"><button type="button" data-a="lock">🔒 Lock the dev menu</button></div>`, (a, v) => {
    if (a === "setb") { S.bolts = Math.max(0, Math.floor(+$("dvB").value || 0)); save(); setBolts(); SFX.coin(); dev(); }
    if (a === "addb") { S.bolts += +v; save(); setBolts(); SFX.coin(); dev(); }
    if (a === "gives") { addTower($("dvT").value, Math.max(1, Math.min(99, +$("dvN").value || 1))); SFX.coin(); toast("Added to your locker!", "good"); }
    if (a === "all") { for (const T of TOWERS) addTower(T.id, 1); SFX.reveal(5); toast("You got every tower!", "good"); }
    if (a === "givep") { const b = Math.max(0, Math.floor(+$("dvB2").value || 0)), i = $("dvT2").value; API.giveSend(+$("dvP").value, { c: devCode, ...(i ? { i, n: Math.max(1, Math.min(99, +$("dvN2").value || 1)) } : {}), ...(b ? { b } : {}) }); SFX.coin(); toast("Sent!", "good"); }
    if (a === "spawn") API.devCmd({ a: "d", k: "spawn", e: $("dvE").value, n: Math.max(1, Math.min(50, +$("dvEN").value || 1)), m: Math.max(0.1, Math.min(100, +$("dvEM").value || 1)) });
    if (a === "cash") API.devCmd({ a: "d", k: "cash", n: 10000 });
    if (a === "heal") API.devCmd({ a: "d", k: "heal" });
    if (a === "wave") API.devCmd({ a: "d", k: "wave", n: Math.max(1, +$("dvW").value || 1) });
    if (a === "lock") { devCode = ""; try { sessionStorage.removeItem("ct_dev"); } catch {} close(); }
  });
}
// a gift from the dev menu (relay checked the code)
export function gotGift(m) {
  if (m.e === "code") { toast("The server said the dev code is wrong.", "warn"); return; }
  if (m.i && towerById(m.i)) { addTower(m.i, m.n || 1); toast("🎁 You got " + (m.n || 1) + "× " + towerById(m.i).name + " from the dev!", "good", 4000); SFX.reveal(towerById(m.i).r); }
  if (m.b) { S.bolts += m.b; save(); setBolts(); toast("🎁 You got ⚡" + fmt(m.b) + " bolts from the dev!", "good", 4000); SFX.coin(); }
}
// ---------------------------------------------------------------- help
export function help() {
  open(`<h2>❓ HOW TO PLAY</h2><ul class="help">
    <li><b>Move</b>: WASD / arrows · <b>Jump</b>: Space · <b>Look around</b>: drag the mouse · <b>Use</b>: E · <b>Locker</b>: I · <b>Dev</b>: the 🛠 button</li>
    <li><b>Play a map</b>: walk over a bridge and stand on a glowing pad (2, 4 or 8 players). Everybody on the pad goes together when it fills up or the timer runs out. Alone works too!</li>
    <li><b>In a match</b>: you start with $100. Click a tower card, then click the floor to build. Robots give cash when you destroy them. Click a tower to upgrade or sell it. Don't let robots reach your core!</li>
    <li><b>Bosses</b>: the last wave of every map has a BOSS. Destroy it to win bonus bolts. In <b>Endless</b> there's a boss every 20 waves, and wave 100 unlocks the OMEGA PRIME.</li>
    <li><b>Crates</b>: go up the stairs and turn RIGHT. Spend bolts on the Normal Crate (cheap) or the Rare Crate (better chances at Epic, Legendary and Mythic) to get new robot towers. Then put them in your loadout at the Tower Locker.</li>
    <li><b>Trading</b>: up the stairs, turn LEFT. Use the Trade Terminal to trade towers and bolts with other players.</li></ul>`, () => {});
}
export { MAPS };
