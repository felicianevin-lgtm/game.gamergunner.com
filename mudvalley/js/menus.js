// MUD VALLEY RP: the shop screens and menus. Dealership, customize shop, houses + garage, job board, races, phone, map.
import { VEHICLES, vehicleById, statBars, tune, PAINTS, RIMS, TIRES, ENGINE_COST, LIFT_COST, NEONS, PRICES } from "./vehicles.js";
import { TRAILERS, trailerById } from "./trailer.js";
import { HOUSES, PLACES } from "./layout.js";
import { JOB_TYPES } from "./jobs.js";
import { RACES } from "./races.js";
import { S, money, slots, save } from "./save.js";
import { SFX } from "./sfx.js";
import * as H from "./hud.js";
import { GEAR, BLASTERS, RANKS, rankOf, nextRank, lootCap, BOOK_PAY } from "./crime.js";
import { RODS, FISH, fishById, fishValue, coolerValue, COOLER, RARITY_COLOR } from "./fishing.js";
import { QUICK } from "./mp.js";
import { itemById, packCap } from "./npcs.js";

const $ = (id) => document.getElementById(id);
let GM = null;
const ICON = { pickup: "🛻", atv: "🏍️", bike: "🏍️", jeep: "🚙", buggy: "🏎️", sports: "🏎️", hauler: "🚚", monster: "🚜", hyper: "🏎️", utility: "🛒", flatbed: "🚛" };
ICON.atv = "🛵";
const hex = (c) => "#" + c.toString(16).padStart(6, "0");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const bars = (st) => `<div class="stats"><span>Speed</span><div class="bar"><i style="width:${st.speed * 100}%"></i></div><span>Acceleration</span><div class="bar"><i style="width:${st.accel * 100}%"></i></div><span>Off-road</span><div class="bar g"><i style="width:${st.offroad * 100}%"></i></div><span>Handling</span><div class="bar b"><i style="width:${st.handling * 100}%"></i></div></div>`;
const mph = (ms) => Math.round(ms * 2.237);

function side(html, panel) {
  GM.G.mode = "side"; GM.G.panel = panel;
  $("sideBox").innerHTML = `<button type="button" class="closeX" data-a="close">✕</button>` + html;
  $("side").classList.remove("hidden"); $("side").scrollTop = 0;
}
function modal(html, cls = "") {
  GM.G.mode = "modal"; GM.G.panel = null;
  $("modalBox").className = "box " + cls;
  $("modalBox").innerHTML = (cls.includes("noX") ? "" : `<button type="button" class="closeX" data-a="close">✕</button>`) + html;
  $("modal").classList.remove("hidden"); $("modal").scrollTop = 0;
}
function close() {
  $("side").classList.add("hidden"); $("modal").classList.add("hidden");
  const G = GM.G; G.mode = G.race ? "race" : "play"; G.panel = null; G.houseView = null;
  GM.showroom(null);
  $("canvas").focus();
}
// clicks on any [data-a] button go to the current screen's handler
let onAct = () => {};
function wire() {
  for (const box of ["sideBox", "modalBox"]) $(box).addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
    if (b.dataset.a === "close") { SFX.click(); close(); return; }
    onAct(b.dataset.a, b.dataset.v, b);
  });
  $("sideBox").addEventListener("input", (e) => { if (e.target.dataset.a) onAct(e.target.dataset.a, e.target.value, e.target, true); });
}

// ---------------------------------------------------------------- dealership
let dSel = "atv", dTab = "rides";
function dealer() {
  if (!VEHICLES.some((v) => v.id === dSel) && !trailerById(dSel)) dSel = "atv";
  const own = (id) => S.cars.filter((c) => c.id === id).length;
  const list = dTab === "rides" ? VEHICLES.filter((v) => !v.police && (v.price > 0 || own(v.id))) : TRAILERS;
  if (!list.some((v) => v.id === dSel)) dSel = list[0].id;
  const v = vehicleById(dSel), T = trailerById(dSel), it = T || v;
  const st = T ? null : statBars(v.id);
  const full = !T && S.cars.length >= slots();
  const canBuy = S.money >= it.price && !full;
  side(`<h2>VALLEY MOTORS</h2><div class="bank">${money(S.money)}</div> <span class="note">Garage: ${S.cars.length} / ${slots()} rides</span>
    <div class="tabs"><button type="button" data-a="tab" data-v="rides" class="${dTab === "rides" ? "on" : ""}">🚗 Rides</button><button type="button" data-a="tab" data-v="trailers" class="${dTab === "trailers" ? "on" : ""}">🚛 Trailers</button></div>
    <h3>${ICON[it.id] || "🚗"} ${esc(it.name)}</h3><p class="sub">${esc(it.desc)}</p>
    ${st ? bars(st) + `<p class="note">Top speed: <b>${mph(tune({ id: v.id, tires: "street", engine: 0, limit: 1, lift: 0 }).top)} mph</b> on the road. ${v.tow >= 2 ? "Can pull any trailer." : v.tow === 1 ? "Can pull the small trailer." : "Can't pull trailers."} ${v.size <= 2 ? "Fits on a trailer." : ""}</p>` : `<p class="note">Room for <b>${T.cap}</b> small rides${T.maxSize > 1 ? " (a car takes 2)" : ""}.</p>`}
    <div class="btns"><button type="button" class="big" data-a="buy" ${canBuy ? "" : "disabled"}>${it.price ? "BUY " + money(it.price) : "FREE"}</button>
    ${full ? `<span class="note">Garage full! Buy a bigger house.</span>` : S.money < it.price ? `<span class="note">You need ${money(it.price - S.money)} more. Do jobs!</span>` : ""}</div>
    <div class="list">${list.map((x) => `<button type="button" class="item ${x.id === dSel ? "sel" : ""}" data-a="sel" data-v="${x.id}"><span class="ico">${ICON[x.id] || "🚗"}</span><span class="nm"><b>${esc(x.name)}${!T && own(x.id) ? `<span class="tag">OWNED${own(x.id) > 1 ? " x" + own(x.id) : ""}</span>` : ""}</b><small>${esc(x.desc).slice(0, 70)}...</small></span><span class="pr">${x.price ? money(x.price) : "FREE"}</span></button>`).join("")}</div>`, "dealer");
  GM.showroom(it.id);
  onAct = (a, val) => {
    if (a === "tab") { dTab = val; dSel = val === "rides" ? "atv" : "utility"; SFX.click(); dealer(); }
    if (a === "sel") { dSel = val; SFX.click(); dealer(); }
    if (a === "buy") { if (T ? GM.buyTrailer(T.id) : GM.buyCar(v.id)) { if (T) dealer(); else close(); } }
  };
}

// ---------------------------------------------------------------- customize shop
let cTab = "paint";
function customs() {
  const c = GM.mine(); if (!c) return;
  if (GM.G.panel !== "customs") { const b = c.b; b.x = 36; b.z = -20; b.yaw = 0; b.vx = b.vz = 0; b.flipped = false; b.y = 1.2; }
  const s = c.s, v = vehicleById(s.id), t = tune(s);
  const tabs = [["paint", "🎨 Paint"], ["wheels", "🛞 Wheels"], ["engine", "⚙️ Engine"], ["speed", "🎚️ Speed"], ["lift", "⬆️ Lift"], ["neon", "💡 Neon"]];
  let body = "";
  if (cTab === "paint") body = `<p class="note">Paint job: <b>${money(PRICES.paint)}</b> each</p><div class="swatches">${PAINTS.map((p) => `<button type="button" class="sw ${p === s.paint ? "on" : ""}" style="background:${hex(p)}" data-a="paint" data-v="${p}"></button>`).join("")}</div>`;
  if (cTab === "wheels") body = `<h3>Tires</h3><div class="opts">${TIRES.map((x) => `<button type="button" class="opt ${s.tires === x.id ? "on" : ""}" data-a="tires" data-v="${x.id}"><span>${x.name}<small>${x.desc}</small></span><em>${s.tires === x.id ? "✓" : x.price ? money(x.price) : "FREE"}</em></button>`).join("")}</div>
    <h3>Rims (${money(PRICES.rims)})</h3><div class="swatches">${RIMS.map((r) => `<button type="button" class="sw ${s.rims === r.id ? "on" : ""}" style="background:${hex(r.c)}" title="${r.name}" data-a="rims" data-v="${r.id}"></button>`).join("")}</div>`;
  if (cTab === "engine") body = `<p class="note">Faster engines = more top speed and quicker starts. Want it slower? Pick a lower level any time for free!</p><div class="opts">${ENGINE_COST.map((cost, i) => `<button type="button" class="opt ${s.engine === i ? "on" : ""}" data-a="engine" data-v="${i}"><span>${["Stock engine", "Stage 1 Turbo", "Stage 2 Turbo", "Stage 3 Super", "Stage 4 MONSTER (flames!)"][i]}<small>${i ? "+" + i * 6 + "% top speed, +" + i * 10 + "% acceleration" : "The engine it came with"}${i >= 2 ? " · hood scoop" : ""}${i >= 3 ? " · big exhausts" : ""}</small></span><em>${s.engine === i ? "✓" : i <= (s.maxEngine || s.engine) ? "FREE" : money(cost)}</em></button>`).join("")}</div>`;
  if (cTab === "speed") body = `<p class="note">The speed limiter makes your ride slower. Great for tricky trails, towing, or learning to drive. Free!</p>
    <h3>Top speed: <span id="limLbl">${mph(t.top)} mph</span> (${Math.round(s.limit * 100)}%)</h3><input type="range" min="30" max="100" step="5" value="${Math.round(s.limit * 100)}" data-a="limit">`;
  if (cTab === "lift") body = `<p class="note">A lift kit raises your ride: better off-road, a bit wobblier on the road.</p><div class="opts">${LIFT_COST.map((cost, i) => `<button type="button" class="opt ${s.lift === i ? "on" : ""}" data-a="lift" data-v="${i}"><span>${["Stock height", "Lift 1 (+15 cm)", "Lift 2 (+30 cm)", "Lift 3 (+45 cm)"][i]}</span><em>${s.lift === i ? "✓" : i <= (s.maxLift || s.lift) ? "FREE" : money(cost)}</em></button>`).join("")}</div>`;
  if (cTab === "neon") body = `<p class="note">Underglow lights! ${money(PRICES.neon)} for a new color.</p><div class="swatches">${NEONS.map((n, i) => `<button type="button" class="sw ${s.neon === i ? "on" : ""}" style="background:${n === null ? "repeating-linear-gradient(45deg,#333 0 6px,#555 6px 12px)" : hex(n)}" data-a="neon" data-v="${i}" title="${n === null ? "No neon" : ""}"></button>`).join("")}</div>`;
  side(`<h2>MUD & CHROME</h2><div class="bank">${money(S.money)}</div><h3>${ICON[s.id] || "🚗"} ${esc(v.name)}</h3>${bars(statBars(s.id, s))}
    <div class="tabs">${tabs.map(([k, n]) => `<button type="button" data-a="tab" data-v="${k}" class="${cTab === k ? "on" : ""}">${n}</button>`).join("")}</div>${body}
    <div class="btns"><button type="button" class="mid" data-a="close">✓ Done</button></div>`, "customs");
  onAct = (a, val, el, live) => {
    if (a === "tab") { cTab = val; SFX.click(); customs(); return; }
    if (a === "paint") { if (+val !== s.paint) GM.custom("paint", +val, PRICES.paint); }
    if (a === "rims") { if (val !== s.rims) GM.custom("rims", val, PRICES.rims); }
    if (a === "tires") { const x = TIRES.find((q) => q.id === val); if (val !== s.tires) GM.custom("tires", val, (s.ownTires || []).includes(val) ? 0 : x.price) && (s.ownTires = [...new Set([...(s.ownTires || ["street"]), val])]); }
    if (a === "engine") { const i = +val, free = i <= (s.maxEngine || s.engine); if (i !== s.engine && GM.custom("engine", i, free ? 0 : ENGINE_COST[i])) s.maxEngine = Math.max(s.maxEngine || 0, i); }
    if (a === "lift") { const i = +val, free = i <= (s.maxLift || s.lift); if (i !== s.lift && GM.custom("lift", i, free ? 0 : LIFT_COST[i])) s.maxLift = Math.max(s.maxLift || 0, i); }
    if (a === "neon") { const i = +val, owned = (s.ownNeon || [0]).includes(i); if (i !== s.neon && GM.custom("neon", i, owned ? 0 : PRICES.neon)) s.ownNeon = [...new Set([...(s.ownNeon || [0]), i])]; }
    if (a === "limit") { GM.custom("limit", +val / 100, 0); const l = $("limLbl"); if (l) l.textContent = mph(tune(s).top) + " mph"; if (live) return; }
    save(); customs();
  };
}

// ---------------------------------------------------------------- houses + garage
function house(h) {
  const own = S.houses.includes(h.id);
  GM.G.houseView = h;
  let html = `<h2>${esc(h.name)}</h2><div class="bank">${money(S.money)}</div><p class="sub">${esc(h.desc)}</p>`;
  if (!own) {
    html += `<p class="note">🚗 Garage room: <b>${h.slots} rides</b> (you have room for ${slots()} now)</p><div class="btns"><button type="button" class="big" data-a="buyHouse" ${S.money >= h.price ? "" : "disabled"}>BUY ${money(h.price)}</button>${S.money < h.price ? `<span class="note">You need ${money(h.price - S.money)} more.</span>` : ""}</div>
      <h3>All houses</h3><div class="list">${HOUSES.filter((x) => x.price).map((x) => `<div class="item ${x.id === h.id ? "sel" : ""}"><span class="ico">🏠</span><span class="nm"><b>${esc(x.name)}${S.houses.includes(x.id) ? '<span class="tag">YOURS</span>' : ""}</b><small>${x.slots} rides</small></span><span class="pr">${money(x.price)}</span></div>`).join("")}</div>`;
  } else {
    html += `<p class="note">${S.home === h.id ? "⭐ This is your home." : ""} Garage room: <b>${S.cars.length} / ${slots()}</b></p>
      ${S.home !== h.id ? `<div class="btns"><button type="button" class="small" data-a="home">⭐ Make this my home</button></div>` : ""}
      <h3>Your rides</h3><div class="list">${S.cars.map((c) => { const C = GM.G.CARS.get(c.uid), d = C ? Math.round(Math.hypot(C.b.x - h.garage.x, C.b.z - h.garage.z)) : 0, onTr = C && C.on; return `<div class="item"><span class="ico">${ICON[c.id]}</span><span class="nm"><b>${esc(vehicleById(c.id).name)}</b><small>${onTr ? "On a trailer" : d < 25 ? "Parked here" : d + " m away"}${C === GM.mine() ? " · you're driving it" : ""}</small></span>
        <span class="btns" style="margin:0"><button type="button" class="small" data-a="drive" data-v="${c.uid}">Drive</button>${d >= 25 || onTr ? `<button type="button" class="small" data-a="bring" data-v="${c.uid}">Bring here${d > 60 ? " $25" : ""}</button>` : ""}${S.cars.length > 1 && vehicleById(c.id).price ? `<button type="button" class="small" data-a="sell" data-v="${c.uid}">Sell ${money(vehicleById(c.id).price / 2)}</button>` : ""}</span></div>`; }).join("")}</div>
      ${S.trailers.length ? `<h3>Your trailers</h3><div class="list">${S.trailers.map((t) => { const T = GM.G.TRS.get(t.uid), d = Math.round(Math.hypot(T.x - h.garage.x, T.z - h.garage.z)); return `<div class="item"><span class="ico">${ICON[t.type]}</span><span class="nm"><b>${esc(trailerById(t.type).name)}</b><small>${T.hitched ? "Hitched to a truck" : d < 25 ? "Parked here" : d + " m away"} · ${T.loaded.length ? T.loaded.length + " ride(s) on it" : "empty"}</small></span>${d >= 25 ? `<button type="button" class="small" data-a="bringT" data-v="${t.uid}">Bring here</button>` : ""}</div>`; }).join("")}</div>` : ""}`;
  }
  side(html, "house");
  onAct = (a, val) => {
    if (a === "buyHouse") { GM.buyHouse(h); house(h); }
    if (a === "home") { GM.setHome(h.id); SFX.click(); house(h); }
    if (a === "drive") { GM.bringCar(+val, h, true); }
    if (a === "bring") { GM.bringCar(+val, h, false); house(h); }
    if (a === "bringT") { GM.bringTrailer(+val, h); house(h); }
    if (a === "sell") { const C = S.cars.find((c) => c.uid === +val); if (C && confirm("Sell your " + vehicleById(C.id).name + " for " + money(vehicleById(C.id).price / 2) + "?")) { GM.sellCar(+val); house(h); } }
  };
}

// ---------------------------------------------------------------- job board
function jobsPanel(fromPhone) {
  const J = GM.jobs;
  const act = J.active;
  const html = `<h2>💼 JOB BOARD</h2><p class="sub">Pick a job, drive to the <b style="color:#ffd23a">yellow arrow</b>, then drop it off. Be quick for a speed bonus. Don't crash for a no-crash bonus!</p>
    ${act ? `<div class="item sel"><span class="ico">${act.T.icon}</span><span class="nm"><b>Now: ${act.T.name}</b><small>${esc(act.goal || "")}</small></span><button type="button" class="small" data-a="quit">Quit job</button></div>` : ""}
    <div class="item"><span class="ico">👮</span><span class="nm"><b>Police Patrol ${S.role === "cop" ? '<span class="tag">ON DUTY</span>' : ""}</b><small>${S.cop.joined ? "Answer radio calls, chase getaway cars, cuff robbers. " + money(Math.round(BOOK_PAY * rankOf().mult)) + "+ per arrest (" + rankOf().name + ")." : "Sign up at the Police Station in Copper Creek. You get a uniform + a police car!"}</small></span>${S.cop.joined ? (S.role === "cop" ? `<button type="button" class="small" data-a="offduty">End shift</button>` : `<button type="button" class="mid" data-a="patrol">Start shift</button>`) : `<button type="button" class="small" data-a="gpsPolice">📍 GPS</button>`}</div>
    <div class="list jobs" style="margin-top:10px">${J.offers.map((o, i) => { const T = JOB_TYPES[o.type], why = J.blocked(o); return `<div class="item ${why ? "lock" : ""}"><span class="ico">${T.icon}</span><span class="nm"><b>${T.name}</b><small>${esc(o.from.name)} → ${esc(o.to.name)} · ${o.dist} m · ⏱ ${Math.round(o.time)} s${why ? "<br>🔒 " + esc(why) : ""}</small></span><span class="pr">${money(o.pay)}</span><button type="button" class="mid" data-a="take" data-v="${i}" ${act || why ? "disabled" : ""}>Take</button></div>`; }).join("")}</div>
    <div class="btns"><button type="button" class="small" data-a="new">🔄 New jobs</button><span class="note">Hauling (needs a trailer) and tow jobs (needs a truck) pay the most!</span></div>`;
  modal(html);
  onAct = (a, val) => {
    if (a === "take") { if (GM.takeJob(+val)) close(); }
    if (a === "quit") { GM.cancelJob(); jobsPanel(fromPhone); }
    if (a === "new") { J.offers = []; J.refill(); SFX.click(); jobsPanel(fromPhone); }
    if (a === "patrol") { if (GM.setRole("cop")) close(); }
    if (a === "offduty") { if (GM.setRole("civ")) jobsPanel(fromPhone); }
    if (a === "gpsPolice") { GM.setWaypoint({ x: PLACES.police.x, z: PLACES.police.z, name: "the Police Station" }); close(); }
  };
}

// ---------------------------------------------------------------- races
function raceInfo(def) {
  const c = GM.mine(), best = S.best[def.id];
  modal(`<h2>🏁 ${esc(def.name)}</h2><p class="sub">${esc(def.desc)}</p>
    <p class="note">${def.laps > 1 ? def.laps + " laps" : "Point to point"} · ${def.ai.length} other racers: ${def.ai.map((a) => ICON[a]).join(" ")}</p>
    <div class="list"><div class="item"><span class="ico">🥇</span><span class="nm"><b>1st place</b></span><span class="pr">${money(def.prize[0])}</span></div><div class="item"><span class="ico">🥈</span><span class="nm"><b>2nd place</b></span><span class="pr">${money(def.prize[1])}</span></div><div class="item"><span class="ico">🥉</span><span class="nm"><b>3rd place</b></span><span class="pr">${money(def.prize[2])}</span></div></div>
    <p class="note">🏆 Best time: <b>${best ? H.fmtTime(best) : "none yet"}</b> · Wins: <b>${S.wins[def.id] || 0}</b></p>
    <p class="note">Drive through the glowing hoops. Press <b>R</b> to get back on the track.</p>
    <div class="btns">${c ? `<button type="button" class="big" data-a="go">START RACE</button><span class="note">Racing in your ${esc(vehicleById(c.s.id).name)}</span>` : `<span class="note">Get in a vehicle to race!</span>`}</div>`);
  onAct = (a) => { if (a === "go") GM.startRace(def.id); };
}
function raceResults(r) {
  const st = r.standings(), me = st.findIndex((x) => !x.ai) + 1;
  modal(`<h2>${me === 1 ? "🏆 YOU WIN!" : "🏁 " + H.ordinal(me) + " PLACE"}</h2><p class="sub">${esc(r.def.name)} · Your time <b>${H.fmtTime(r.time)}</b>${r.newBest ? " · <b style='color:#7aff5a'>NEW BEST!</b>" : ""}</p>
    <div class="bank">+${money(r.prize || 0)}</div>
    <ol class="results">${st.map((x, i) => `<li class="${x.ai ? "" : "you"}"><span>${i + 1}. ${esc(x.name)}</span><span>${x.time ? H.fmtTime(x.time) : "still racing"}</span></li>`).join("")}</ol>
    <div class="btns"><button type="button" class="big" data-a="again">↻ Race again</button><button type="button" class="mid" data-a="done">Done</button></div>`, "noX");
  onAct = (a) => { const id = r.def.id; GM.quitRace(); close(); if (a === "again") GM.startRace(id); };
}

// ---------------------------------------------------------------- the phone
function phone(view = "home") {
  SFX.phone();
  const back = `<button type="button" class="small" data-a="view" data-v="home">← Back</button>`;
  let html = "";
  if (view === "home") html = `<h2>📱 PHONE</h2><div class="bank">${money(S.money)}</div>
    <div class="apps">${[["jobs", "💼", "Jobs"], ["career", S.role === "cop" ? "👮" : S.role === "robber" ? "🦹" : "🧑", "Career"], ["friends", "👥", "Lobby"], ["messages", "💬", "Messages" + (GM.mp.unread ? " (" + GM.mp.unread + ")" : "")], ["map", "🗺️", "Map"], ["rides", "🚗", "My Rides"], ["races", "🏁", "Races"], ["fishlog", "🐟", "Fish Log"], ["backpack", "🎒", "Backpack"], ["houses", "🏠", "Houses"], ["gps", "📍", "Places"], ["home", "🏡", "Go Home"], ["stats", "📊", "Stats"], ["settings", "⚙️", "Settings"], ["help", "❓", "Help"]].map(([v, i, n]) => `<button type="button" class="app" data-a="view" data-v="${v}"><i>${i}</i>${n}</button>`).join("")}</div>
    ${GM.G.race ? `<div class="btns"><button type="button" class="small" data-a="quitRace">🏳️ Quit the race</button></div>` : ""}`;
  if (view === "rides") html = `<h2>🚗 MY RIDES</h2>${back}<div class="list" style="margin-top:10px">${S.cars.map((c) => { const C = GM.G.CARS.get(c.uid); return `<div class="item"><span class="ico">${ICON[c.id]}</span><span class="nm"><b>${esc(vehicleById(c.id).name)}</b><small>${C.on ? "On a trailer" : C === GM.mine() ? "You're driving it" : "Parked"}</small></span>${C !== GM.mine() ? `<button type="button" class="small" data-a="gpsCar" data-v="${c.uid}">📍 GPS</button>` : ""}</div>`; }).join("")}</div><p class="note">To bring a ride to you, go to one of your houses (or Town Parking) and open the garage.</p>`;
  if (view === "races") html = `<h2>🏁 RACES</h2>${back}<div class="list" style="margin-top:10px">${RACES.map((r) => `<div class="item"><span class="ico">🏁</span><span class="nm"><b>${esc(r.name)}</b><small>1st: ${money(r.prize[0])} · Best: ${S.best[r.id] ? H.fmtTime(S.best[r.id]) : "—"} · Wins: ${S.wins[r.id] || 0}</small></span><button type="button" class="small" data-a="gpsPlace" data-v="${r.place}">📍 GPS</button></div>`).join("")}</div>`;
  if (view === "houses") html = `<h2>🏠 HOUSES</h2>${back}<div class="list" style="margin-top:10px">${HOUSES.filter((h) => h.price).map((h) => `<div class="item"><span class="ico">🏠</span><span class="nm"><b>${esc(h.name)}${S.houses.includes(h.id) ? '<span class="tag">YOURS</span>' : ""}</b><small>${h.slots} rides · ${esc(h.desc)}</small></span><span class="pr">${money(h.price)}</span><button type="button" class="small" data-a="gpsHouse" data-v="${h.id}">📍</button></div>`).join("")}</div>`;
  if (view === "gps") html = `<h2>📍 PLACES</h2>${back}<div class="list" style="margin-top:10px">${Object.entries(PLACES).map(([id, p]) => `<button type="button" class="item" data-a="gpsPlace" data-v="${id}"><span class="ico">${p.icon}</span><span class="nm"><b>${esc(p.name)}</b></span><span class="pr">📍</span></button>`).join("")}</div>`;
  if (view === "stats") html = `<h2>📊 STATS</h2>${back}<div class="list" style="margin-top:10px">${[["💵", "Money earned", money(S.stats.earned)], ["💼", "Jobs done", S.stats.jobs], ["🏁", "Races", S.stats.races], ["🏆", "Race wins", Object.values(S.wins).reduce((a, b) => a + b, 0)], ["🚀", "Big airs", S.stats.bigAir], ["🚗", "Rides owned", S.cars.length], ["🏠", "Houses", S.houses.length - 1], ["🐟", "Fish caught", S.stats.fish], ["🦹", "Robberies", S.stats.robberies], ["💰", "Loot stashed", money(S.stats.stolen)], ["🚔", "Times busted", S.stats.busted], ["👮", "Arrests", S.cop.arrests]].map(([i, n, v]) => `<div class="item"><span class="ico">${i}</span><span class="nm"><b>${n}</b></span><span class="pr">${v}</span></div>`).join("")}</div>`;
  if (view === "settings") html = `<h2>⚙️ SETTINGS</h2>${back}<div class="btns"><button type="button" class="mid" data-a="mute">${S.muted ? "🔇 Sound is OFF" : "🔊 Sound is ON"}</button></div>
    <h3>Texting friends</h3><p class="note">Quick texts and “send my location” always work in a lobby. Typing your own texts is <b>${S.chatOn ? "ON" : "OFF"}</b> (it’s filtered: no links, no phone numbers, no bad words). A grown-up can turn it off here.</p><div class="btns"><button type="button" class="small" data-a="chatOn">${S.chatOn ? "Turn typing OFF" : "Turn typing ON"}</button></div><h3>Start over</h3><p class="note">This deletes your money, rides and houses in this browser.</p><div class="btns"><button type="button" class="small" data-a="wipe">🗑️ Reset my game</button></div><p class="note"><a class="back" href="../#/">← Back to GunnerVerse</a></p>`;
  if (view === "help") html = `<h2>❓ HELP</h2>${back}${helpHtml()}`;
  if (view === "career") html = careerHtml(back);
  if (view === "friends") html = lobbyHtml(back);
  if (view === "messages") { GM.mp.unread = 0; html = messagesHtml(back); }
  phoneView = view;
  if (view === "fishlog") html = fishLogHtml(back);
  if (view === "backpack") html = `<h2>🎒 BACKPACK</h2>${back}<p class="sub">${S.backpack.length} / ${packCap()} things · worth about ${money(packValue())} at a Pawn Shop${S.gear.duffel ? "" : " (a Big Duffel Bag from the Tool Barn makes it bigger)"}</p>${packList(false)}<div class="btns"><button type="button" class="small" data-a="gpsPawn">📍 Nearest Pawn Shop</button></div>`;
  modal(html, "phone");
  onAct = (a, val) => {
    if (a === "view") { if (val === "jobs") return jobsPanel(true); if (val === "map") { close(); return map(); } if (val === "home") { goHome(); return; } phone(val); }
    if (a === "gpsPawn") { const me = GM.mePos(); let best = null; for (const [id, p] of Object.entries(PLACES)) if (id.startsWith("pawn") && (!best || Math.hypot(p.x - me.x, p.z - me.z) < Math.hypot(best.x - me.x, best.z - me.z))) best = p; GM.setWaypoint({ x: best.x, z: best.z, name: best.name }); close(); }
    if (a === "gpsCar") { const C = GM.G.CARS.get(+val); const p = C.on ? C.on : C.b; GM.setWaypoint({ x: p.x, z: p.z, name: "your " + vehicleById(C.s.id).name }); close(); }
    if (a === "gpsPlace") { const p = PLACES[val]; GM.setWaypoint({ x: p.x, z: p.z, name: p.name }); close(); }
    if (a === "gpsHouse") { const h = HOUSES.find((x) => x.id === val); GM.setWaypoint({ x: h.garage.x, z: h.garage.z, name: h.name }); close(); }
    if (a === "mute") { GM.muted(!S.muted); phone("settings"); }
    if (a === "wipe") { if (confirm("Really start over? Everything will be deleted!") && confirm("Are you SURE? This can't be undone.")) GM.wipe(); }
    if (a === "quitRace") { GM.quitRace(); close(); }
    if (a === "role") { if (GM.setRole(val)) phone("career"); }
    if (a === "chatOn") { S.chatOn = !S.chatOn; save(); phone("settings"); }
    if (a === "mpCreate") { GM.mp.create(); phone("friends"); }
    if (a === "mpJoin") { GM.mp.join(($("mpCode") || {}).value); phone("friends"); }
    if (a === "mpLeave") { GM.mp.leave(); phone("friends"); }
    if (a === "mpKick") { if (confirm("Remove this player from your lobby?")) GM.mp.kick(+val); }
    if (a === "mpMute") { const p = GM.mp.players.get(+val); if (p) { p.mutedByMe = !p.mutedByMe; GM.mp.mute(+val, p.mutedByMe); phone("friends"); } }
    if (a === "mpChatRoom") { GM.mp.setChatRoom(!GM.mp.chatRoom); GM.mp.chatRoom = !GM.mp.chatRoom; phone("friends"); }
    if (a === "qt") { GM.mp.quick(+val); SFX.phone(); }
    if (a === "pin") { GM.mp.sendPin(); SFX.phone(); }
    if (a === "send") { const i = $("mpText"); if (i && i.value.trim()) { GM.mp.chat(i.value); i.value = ""; SFX.phone(); } }
    if (a === "gpsPolice") { GM.setWaypoint({ x: PLACES.police.x, z: PLACES.police.z, name: "the Police Station" }); close(); }
    if (a === "gpsHideout") { GM.setWaypoint({ x: PLACES.hideout.x, z: PLACES.hideout.z, name: "the Robber Hideout" }); close(); }
    if (a === "gpsBait") { GM.setWaypoint({ x: PLACES.bait.x, z: PLACES.bait.z, name: "the Bait & Tackle" }); close(); }
  };
}
// ---------------------------------------------------------------- play with friends: the lobby + the Messages app
let phoneView = "home";
function lobbyHtml(back) {
  const M = GM.mp;
  if (M.status === "connecting") return `<h2>👥 LOBBY</h2>${back}<p class="sub">Connecting to lobby ${esc(M.code)}...</p><div class="btns"><button type="button" class="small" data-a="mpLeave">Cancel</button></div>`;
  if (!M.on) return `<h2>👥 PLAY WITH FRIENDS</h2>${back}<p class="sub">Make a lobby and tell your friends the code, or type a friend’s code to join them. You’ll see each other driving around Mud Valley and you can text (📱 Messages). Your money and stuff stay your own.</p>
    ${M.status === "error" ? `<p class="note" style="color:#ff9a7a">${esc(M.err || "")}</p>` : ""}
    <div class="btns"><button type="button" class="big" data-a="mpCreate">MAKE A LOBBY</button></div>
    <h3>Join a friend</h3><div class="btns"><input id="mpCode" inputmode="numeric" maxlength="8" placeholder="8-digit code" style="font:inherit;font-size:20px;width:170px;padding:8px;border-radius:10px;border:2px solid #6a4a28;text-align:center"><button type="button" class="mid" data-a="mpJoin">JOIN</button></div>`;
  const host = M.host === M.id;
  return `<h2>👥 LOBBY</h2>${back}<div class="bank" style="font-size:28px;letter-spacing:3px">${esc(M.code)}</div><p class="note">Tell your friends this code! You are <b>${esc(M.name)}</b>${host ? " (host)" : ""}.</p>
    <div class="list"><div class="item"><span class="ico">🙂</span><span class="nm"><b>${esc(M.name)} (you)</b></span></div>${[...M.players.values()].map((p) => `<div class="item"><span class="ico">${p.v ? "🚗" : "🚶"}</span><span class="nm"><b>${esc(p.n)}${p.id === M.host ? '<span class="tag">HOST</span>' : ""}</b><small>${p.away ? "Reconnecting..." : p.v ? "Driving a " + esc((p.v.split("|")[1] || "ride")) : "On foot"}</small></span>${host ? `<button type="button" class="small" data-a="mpMute" data-v="${p.id}">${p.mutedByMe ? "Unmute" : "Mute"}</button><button type="button" class="small" data-a="mpKick" data-v="${p.id}">Remove</button>` : ""}</div>`).join("")}</div>
    <div class="btns">${host ? `<button type="button" class="small" data-a="mpChatRoom">${M.chatRoom ? "Turn texting OFF for everyone" : "Turn texting ON"}</button>` : ""}<button type="button" class="small" data-a="view" data-v="messages">💬 Messages</button><button type="button" class="small" data-a="mpLeave">Leave lobby</button></div>`;
}
function messagesHtml(back) {
  const M = GM.mp;
  if (!M.on) return `<h2>💬 MESSAGES</h2>${back}<p class="sub">Join a lobby first (📱 Phone → Lobby) to text your friends.</p><div class="btns"><button type="button" class="mid" data-a="view" data-v="friends">👥 Lobby</button></div>`;
  return `<h2>💬 MESSAGES</h2>${back}<div class="msgs" id="msgList">${M.msgs.slice(-25).map((m) => m.kind === "sys" ? `<div class="msg sys">${esc(m.text)}</div>` : `<div class="msg ${m.from === "You" ? "me" : ""}"><b>${esc(m.from)}</b> ${esc(m.text)}</div>`).join("") || '<div class="msg sys">No messages yet. Say hi!</div>'}</div>
    <div class="qts">${QUICK.map((q, i) => `<button type="button" class="small" data-a="qt" data-v="${i}">${esc(q)}</button>`).join("")}</div>
    <div class="btns"><button type="button" class="mid" data-a="pin">📍 Send my location</button></div>
    ${S.chatOn ? `<div class="btns"><input id="mpText" maxlength="80" placeholder="Type a text (filtered)" style="flex:1;font:inherit;padding:8px;border-radius:10px;border:2px solid #4a5a70"><button type="button" class="mid" data-a="send">Send</button></div>` : `<p class="note">Typing is off. (Settings → Texting friends.)</p>`}`;
}
function mpChanged() {
  if (GM.G.mode !== "modal" || !$("modalBox").classList.contains("phone")) return;
  if (phoneView === "messages" || phoneView === "friends") {
    const t = $("mpText"), v = t ? t.value : null, f = document.activeElement === t;
    phone(phoneView); if (v !== null && $("mpText")) { $("mpText").value = v; if (f) $("mpText").focus(); }
    const l = $("msgList"); if (l) l.scrollTop = l.scrollHeight;
  }
}
// ---------------------------------------------------------------- careers (civilian / robber / cop)
function careerHtml(back) {
  const r = S.role, rk = rankOf(), nx = nextRank();
  const card = (id, ico, name, desc, extra = "") => `<div class="item ${r === id ? "sel" : ""}"><span class="ico">${ico}</span><span class="nm"><b>${name}${r === id ? '<span class="tag">NOW</span>' : ""}</b><small>${desc}</small>${extra}</span>${r === id ? "" : `<button type="button" class="mid" data-a="role" data-v="${id}" ${(id === "cop" && !S.cop.joined) || S.wanted ? "disabled" : ""}>Switch</button>`}</div>`;
  return `<h2>CAREER</h2>${back}<p class="note">You can be one thing at a time. ${S.wanted ? "<b style='color:#ff8a5a'>You’re wanted! Lose the cops before you switch.</b>" : ""}</p><div class="list">
    ${card("civ", "🧑", "Civilian", "Do jobs, race, fish, build your garage.")}
    ${card("robber", "🦹", "Robber", "Rob registers, ATMs, the jewelry store and the bank. Lose the cops, then stash your loot at the hideout.", `<small>Loot bag: ${money(S.loot)} / ${money(lootCap())} · Robberies: ${S.stats.robberies} · Busted: ${S.stats.busted}</small>`)}
    ${card("cop", "👮", "Police Officer", S.cop.joined ? "Answer radio calls, stop getaway cars and cuff robbers." : "Sign up at the Police Station in Copper Creek first!", S.cop.joined ? `<small>Rank: <b>${rk.name}</b> · Arrests: ${S.cop.arrests}${nx ? " · " + (nx.at - S.cop.arrests) + " more for " + nx.name : " · Top rank!"} · Pay: ${money(Math.round(BOOK_PAY * rk.mult))}+ per arrest</small>` : `<button type="button" class="small" data-a="gpsPolice">📍 GPS to the station</button>`)}
  </div>
  <h3>How it works</h3><p class="note">🦹 <b>Robbers:</b> buy tools at the Tool Barn (Copper Creek). Walk up to a red ring and <b>hold E</b>. Robbing gives you ⭐ wanted stars. Cops chase you! Get out of sight until the bar fills up, then go to the 🎭 Robber Hideout and stash your loot for cash. If they catch you: BUSTED (jail + you lose the loot).
  <br>👮 <b>Cops:</b> sign up at the 👮 Police Station. Press <b>G</b> for the siren, <b>Q</b> in the car to drop a spike strip. Bump the getaway car 3 times, spike it or stun it. Then <b>hold E</b> next to the robber to cuff them and drive them to the station.</p>
  <div class="btns"><button type="button" class="small" data-a="gpsHideout">📍 Hideout</button><button type="button" class="small" data-a="gpsPolice">📍 Police Station</button></div>`;
}
function fishLogHtml(back) {
  const n = Object.keys(S.fishLog).length;
  return `<h2>🐟 FISH LOG</h2>${back}<p class="note">Species found: <b>${n} / ${FISH.length}</b> · In your cooler: <b>${S.fish.length} / ${COOLER}</b> fish worth <b>${money(coolerValue())}</b></p>
    <div class="list">${FISH.map((f) => { const L = S.fishLog[f.id]; return `<div class="item"><span class="ico" style="filter:${L ? "none" : "grayscale(1) brightness(0.4)"}">${f.id === "boot" ? "🥾" : "🐟"}</span><span class="nm"><b>${L ? esc(f.name) : "???"}<span class="tag" style="background:${RARITY_COLOR[f.rarity]}">${f.rarity}</span></b><small>${L ? "Caught " + L.n + " · biggest " + L.best + " lb" : "Not caught yet"} · ${f.where === "both" ? "pond + river" : f.where === "pond" ? "Lily Pond" : "the river"}${f.minRod ? " · needs a " + RODS[f.minRod].name : ""}</small></span><span class="pr">${L ? "~" + money(f.price) : ""}</span></div>`; }).join("")}</div>
    <div class="btns"><button type="button" class="small" data-a="gpsBait">📍 Bait & Tackle</button></div>`;
}
// ---------------------------------------------------------------- Copper Creek shops + the police station + the hideout
function gear() {
  const html = `<h2>🧰 TOOL BARN</h2><div class="bank">${money(S.money)}</div><p class="sub">Robber gear! (Only robbers can use it to rob things. Switch careers in 📱 Phone → Career.)</p>
    <div class="list">${GEAR.map((g) => `<div class="item ${S.gear[g.id] ? "sel" : ""}"><span class="ico">${g.icon}</span><span class="nm"><b>${g.name}${S.gear[g.id] ? '<span class="tag">OWNED</span>' : ""}</b><small>${esc(g.desc)}</small></span>${S.gear[g.id] ? "" : `<button type="button" class="mid" data-a="buy" data-v="${g.id}" ${S.money >= g.price ? "" : "disabled"}>${money(g.price)}</button>`}</div>`).join("")}</div>
    <p class="note">🧾 Cash registers: no tool needed · 🏧 ATMs: crowbar · 💎 Jewelry cases: lockpick set · 🏦 Bank vault: Super Drill</p>`;
  side(html, "shop");
  onAct = (a, val) => { if (a === "buy") { GM.buyGear(GEAR.find((g) => g.id === val)); gear(); } };
}
function blasters() {
  const html = `<h2>🔫 GUN SHOP</h2><div class="bank">${money(S.money)}</div><p class="sub">Anyone you hit gets knocked out for a few seconds (they see stars, then get back up). Press <b>X</b> to hold your gun, <b>Q</b> to shoot. It aims for you!</p>
    <div class="list">${BLASTERS.map((b) => { const own = S.blasters.includes(b.id); return `<div class="item ${S.blaster === b.id ? "sel" : ""}"><span class="ico">${["🔫", "🔫", "🎯", "💥"][b.tier]}</span><span class="nm"><b>${b.name}${own ? '<span class="tag">' + (S.blaster === b.id ? "HOLDING" : "OWNED") + "</span>" : ""}</b><small>${esc(b.desc)} · range ${b.range} m · knocks out for ${b.stun}s</small></span>${own ? (S.blaster === b.id ? "" : `<button type="button" class="small" data-a="buy" data-v="${b.id}">Use</button>`) : `<button type="button" class="mid" data-a="buy" data-v="${b.id}" ${S.money >= b.price ? "" : "disabled"}>${money(b.price)}</button>`}</div>`; }).join("")}</div>`;
  side(html, "shop");
  onAct = (a, val) => { if (a === "buy") { GM.buyBlaster(BLASTERS.find((b) => b.id === val)); blasters(); } };
}
function bait() {
  const v = coolerValue();
  const html = `<h2>🪱 BAIT & TACKLE</h2><div class="bank">${money(S.money)}</div><p class="sub">Press <b>X</b> to hold your rod, face the water and press <b>Q</b> to cast. When the bobber dips and you see <b>!</b>, press <b>Q</b> fast. Then hold <b>Q</b> to reel (let go if the marker gets near the red!).</p>
    <div class="btns"><button type="button" class="big" data-a="sell" ${S.fish.length ? "" : "disabled"}>SELL ${S.fish.length} FISH ${money(v)}</button></div>
    ${S.fish.length ? `<p class="note">${S.fish.slice(-12).map((f) => esc(fishById(f.id).name) + " " + f.w + " lb (" + money(fishValue(f)) + ")").join(" · ")}${S.fish.length > 12 ? " ..." : ""}</p>` : ""}
    <h3>Fishing rods</h3><div class="list">${RODS.map((r) => { const own = S.rods.includes(r.id); return `<div class="item ${S.rod === r.id ? "sel" : ""}"><span class="ico">🎣</span><span class="nm"><b>${r.name}${own ? '<span class="tag">' + (S.rod === r.id ? "USING" : "OWNED") + "</span>" : ""}</b><small>${esc(r.desc)}</small></span>${own ? (S.rod === r.id ? "" : `<button type="button" class="small" data-a="rod" data-v="${r.id}">Use</button>`) : `<button type="button" class="mid" data-a="rod" data-v="${r.id}" ${S.money >= r.price ? "" : "disabled"}>${money(r.price)}</button>`}</div>`; }).join("")}</div>
    <p class="note">🐟 Lily Pond has perch, Golden Carp and Crystal Koi. The river has trout and pike. Legends say a Mud Monster Catfish lives in both...</p>`;
  side(html, "shop");
  onAct = (a, val) => { if (a === "sell") { GM.sellFish(); bait(); } if (a === "rod") { GM.buyRod(RODS.find((r) => r.id === val)); bait(); } };
}
// ---------------------------------------------------------------- pawn shops + your backpack (npcs.js)
const packList = (sell) => S.backpack.length ? `<div class="list">${S.backpack.map((it, i) => { const I = itemById(it.id); return `<div class="item"><span class="ico">${I.icon}</span><span class="nm"><b>${esc(I.name)}</b></span><span class="pr">${money(it.v)}</span>${sell ? `<button type="button" class="small" data-a="sell" data-v="${i}">Sell</button>` : ""}</div>`; }).join("")}</div>` : `<p class="note">Your backpack is empty. Knock people out (they drop their stuff) and pick up their backpacks with E.</p>`;
const packValue = () => S.backpack.reduce((a, it) => a + it.v, 0);
function pawn() {
  const html = `<h2>💰 PAWN SHOP</h2><div class="bank">${money(S.money)}</div><p class="sub">“I’ll buy anything in that backpack of yours. No questions asked!” 🎒 ${S.backpack.length} / ${packCap()}</p>
    <div class="btns"><button type="button" class="big" data-a="all" ${S.backpack.length ? "" : "disabled"}>SELL EVERYTHING ${money(packValue())}</button></div>${packList(true)}
    <p class="note">Careful: if the cops bust you, they take everything in your backpack. If you get knocked out, it falls on the ground.</p>`;
  side(html, "shop");
  onAct = (a, val) => { if (a === "sell") { GM.sellItem(+val); pawn(); } if (a === "all") { GM.sellItem(-1); pawn(); } };
}
function police() {
  const rk = rankOf(), nx = nextRank(), cop = S.role === "cop";
  let html = `<h2>👮 POLICE STATION</h2><div class="bank">${money(S.money)}</div>`;
  if (!S.cop.joined) html += `<p class="sub">Want to keep Mud Valley safe? Join the police! You get a uniform, a <b>police cruiser</b>, handcuffs, a sidearm, a taser, spike strips and a radio. Catch robbers for cash. The more you catch, the higher your rank (and your pay).</p><div class="btns"><button type="button" class="big" data-a="join">${S.wanted ? "TURN YOURSELF IN + JOIN" : "JOIN THE POLICE"}</button>${S.wanted ? '<span class="note">You’re wanted: you’ll lose your stars' + (S.loot ? " and your loot" : "") + ".</span>" : ""}</div>`;
  else {
    html += `<p class="sub">Rank: <b>${rk.name}</b> · Arrests: <b>${S.cop.arrests}</b>${nx ? " · " + (nx.at - S.cop.arrests) + " more to become " + nx.name : ""} · Pay per arrest: <b>${money(Math.round(BOOK_PAY * rk.mult))}+</b></p>
      <div class="btns">${cop ? `<button type="button" class="small" data-a="off">End shift (go civilian)</button>` : `<button type="button" class="big" data-a="on">${S.wanted ? "TURN YOURSELF IN + START SHIFT" : "START SHIFT"}</button>${S.wanted ? '<span class="note">You’re wanted: you’ll lose your stars' + (S.loot ? " and your loot" : "") + ".</span>" : ""}`}</div>
      <h3>Gear</h3><div class="list">
      <div class="item"><span class="ico">⛓️</span><span class="nm"><b>Spike strips: ${S.cop.spikes} / 3</b><small>In your car press Q to drop one behind you. Getaway cars that hit it slow way down.</small></span><button type="button" class="small" data-a="spikes" ${S.cop.spikes >= 3 ? "disabled" : ""}>Refill (free)</button></div>
      <div class="item"><span class="ico">🚓</span><span class="nm"><b>Police Cruiser${S.cop.car !== "interceptor" ? '<span class="tag">USING</span>' : ""}</b><small>Tough and steady.</small></span>${S.cop.car === "interceptor" ? `<button type="button" class="small" data-a="car" data-v="cruiser">Use</button>` : ""}</div>
      <div class="item ${S.cop.interceptor ? "" : "lock"}"><span class="ico">🏎️</span><span class="nm"><b>Police Interceptor${S.cop.car === "interceptor" ? '<span class="tag">USING</span>' : ""}</b><small>Super fast! Unlocks free at Sergeant rank (8 arrests), or buy it now.</small></span>${S.cop.interceptor ? (S.cop.car === "interceptor" ? "" : `<button type="button" class="small" data-a="car" data-v="interceptor">Use</button>`) : `<button type="button" class="mid" data-a="buyInt" ${S.money >= 15000 ? "" : "disabled"}>${money(15000)}</button>`}</div></div>
      <h3>Ranks</h3><p class="note">${RANKS.map((r) => (r === rk ? "<b style='color:#ffd23a'>" + r.name + "</b>" : r.name) + " (" + r.at + ")").join(" → ")}</p>`;
    if (cop && !GM.policeCar()) html += `<p class="note">Your police car is missing? <button type="button" class="small" data-a="car" data-v="${S.cop.car}">Bring my police car here</button></p>`;
  }
  side(html, "shop");
  onAct = (a, val) => {
    if (a === "join" || a === "on") { GM.copAtStation(); police(); }
    if (a === "off") { GM.setRole("civ"); police(); }
    if (a === "spikes") { GM.refillSpikes(); police(); }
    if (a === "car") { GM.copCar(val); police(); }
    if (a === "buyInt") { GM.buyInterceptor(); police(); }
  };
}
function hideout() {
  const rob = S.role === "robber";
  let html = `<h2>🎭 ROBBER HIDEOUT</h2><div class="bank">${money(S.money)}</div>`;
  if (!rob) html += `<p class="sub">A creaky old shack in the woods... There’s a sign: “Robbers only! Become a robber in 📱 Phone → Career.”</p><div class="btns"><button type="button" class="mid" data-a="become" ${S.wanted ? "disabled" : ""}>Become a robber</button></div>`;
  else html += `<p class="sub">Your secret hideout. Stash your loot here to turn it into real money. (The cops must NOT be chasing you!)</p>
    <div class="list"><div class="item"><span class="ico">💰</span><span class="nm"><b>Loot in your bag: ${money(S.loot)}</b><small>Bag size: ${money(lootCap())}${S.gear.duffel ? "" : " (a Big Duffel Bag holds $5,000)"}</small></span><button type="button" class="big" data-a="stash" ${S.loot && !S.wanted ? "" : "disabled"}>STASH</button></div></div>
    ${S.wanted ? `<p class="note" style="color:#ff9a7a">The cops are after you! Hide and lose them first.</p>` : ""}
    <p class="note">Total stolen: ${money(S.stats.stolen)} · Robberies: ${S.stats.robberies} · Busted: ${S.stats.busted}</p>`;
  side(html, "shop");
  onAct = (a) => { if (a === "stash") { GM.crime.stash(); hideout(); } if (a === "become") { GM.setRole("robber"); hideout(); } };
}
function goHome() {
  const h = HOUSES.find((x) => x.id === S.home) || HOUSES[0];
  if (GM.G.race) { H.toast("Not during a race!", "", "warn"); return; }
  close(); GM.G.goHome(h);
}
function helpHtml() {
  return `<div class="keys" style="margin-top:10px">
    <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Drive / walk (arrow keys work too). <b>S</b> brakes, then backs up.</span>
    <span><kbd>Space</kbd></span><span>Handbrake (drift!) · Jump when walking</span>
    <span><kbd>E</kbd></span><span>Use things: dealership, shops, garage, job board, races, load a trailer</span>
    <span><kbd>F</kbd></span><span>Get in / out of a vehicle</span>
    <span><kbd>T</kbd></span><span>Hitch / unhitch a trailer (back your truck up to it)</span>
    <span><kbd>R</kbd></span><span>Flip back over / back to the race track</span>
    <span><kbd>H</kbd></span><span>Horn!</span>
    <span><kbd>X</kbd></span><span>Switch what you hold: empty hands, blaster, fishing rod, spike strips</span>
    <span><kbd>Q</kbd></span><span>Use it: shoot the blaster · cast / hook / hold to reel the fishing rod · drop a spike strip (cops, also in the car)</span>
    <span><kbd>E</kbd> hold</span><span>Rob things (robbers) · put on handcuffs (cops)</span>
    <span><kbd>G</kbd></span><span>Police siren (in a police car)</span>
    <span><kbd>M</kbd></span><span>Map (tap a spot to set your GPS)</span>
    <span><kbd>P</kbd></span><span>Phone</span>
    <span>🖱️</span><span>Hold a mouse button + move to look around. Wheel to zoom.</span>
    <span>📱</span><span>On a phone: left thumb = stick, right side = look around, buttons for the rest.</span></div>
    <h3>Tips</h3><p class="note">📱 Phone → Career: be a 🧑 civilian, a 🦹 robber or a 👮 cop. 🎣 Fishing: Bait & Tackle at Lily Pond. ⛰️ Thunder Peak: drive up the Summit Sprint trail, or the steep Goat Trail in a 4x4. 🏙️ Copper Creek is up Route 9 from the Motocross Park. 💼 Jobs = money. 🛵 Buy an ATV or dirt bike for trails and mud. 🛒 Buy a trailer to carry them on your truck. 🔧 Mud tires help in mud. 🫧 Muddy? Use the car wash! 🏠 Better houses = more garage room. 🏁 Win races for big prizes.</p>`;
}

// ---------------------------------------------------------------- the big map
function map() {
  if (GM.G.mode === "map") return closeMap();
  GM.G.prevMode = GM.G.mode; GM.G.mode = "map"; $("mapView").classList.remove("hidden");
}
function closeMap() { $("mapView").classList.add("hidden"); GM.G.mode = GM.G.race ? "race" : "play"; }

// ---------------------------------------------------------------- welcome!
function intro() {
  modal(`<div class="intro"><h2>WELCOME TO MUD VALLEY!</h2><p class="sub">You just moved to town with an old pickup truck and <b style="color:#7aff5a">${money(S.money)}</b>. Time to build your dream garage!</p>
    <ol><li><b>🗺️ It’s a BIG valley:</b> Mud Valley town, Copper Creek, Thunder Peak, Lily Pond and lots of trails.</li><li><b>💼 Do jobs</b> at the Job Center (or on your 📱 phone) to make money.</li><li><b>🚗 Buy rides</b> at Valley Motors: ATVs, dirt bikes, 4x4s, sports cars, a monster truck...</li><li><b>🔧 Customize</b> them at Mud & Chrome: paint, mud tires, faster (or slower!) engines, lift kits, neon.</li><li><b>🛒 Get a trailer</b> to haul your ATV or dirt bike out to the trails.</li><li><b>🏠 Buy a house</b>, from a rusty camper all the way up to the Hilltop Mansion.</li><li><b>🏁 Race</b> at the Motocross Park, the Speedway and up the mountain!</li><li><b>👮 Be a cop or 🦹 a robber</b> (📱 Phone → Career), or go <b>🎣 fishing</b>.</li></ol>
    <p class="note" style="text-align:center">${document.body.classList.contains("touch") ? "🕹️ Left thumb drives · drag the right side to look around · <b>E</b> use · <b>F</b> get in/out · ⛔ brake · <b>T</b> trailer · ↻ flip · 📣 horn · 🎯 use item · 🔄 switch item" : "<b>WASD</b> drive · <b>Space</b> handbrake · <b>E</b> use things · <b>F</b> get in/out · <b>T</b> trailer · <b>R</b> flip · <b>H</b> horn · <b>X</b> switch item · <b>Q</b> use item · <b>G</b> siren · <b>M</b> map · <b>P</b> phone · hold the mouse to look around"}<br>(All the controls are in 📱 Phone → Help.)</p>
    <div class="btns" style="justify-content:center"><button type="button" class="big" data-a="go">LET'S DRIVE!</button></div></div>`, "noX");
  onAct = (a) => { if (a === "go") { S.intro = true; save(); close(); GM.setWaypoint({ x: PLACES.jobs.x, z: PLACES.jobs.z, name: "the Job Center" }); H.banner("MUD VALLEY", "Follow the purple arrow to the Job Center!"); } };
}

export const UI = { close, dealer, customs, house, jobs: jobsPanel, raceInfo, raceResults, phone, map, closeMap, intro, gear, blasters, bait, police, hideout, mpChanged, pawn };
export function initMenus(game) {
  GM = game; wire();
  $("mapClose").addEventListener("click", () => { SFX.click(); closeMap(); });
  $("bigMap").addEventListener("pointerdown", (e) => {
    const p = H.mapToWorld(e), ic = H.nearestIcon(p.x, p.z);
    GM.setWaypoint(ic ? { x: ic.x, z: ic.z, name: ic.name } : { x: p.x, z: p.z, name: "the map pin" });
    closeMap();
  });
}
