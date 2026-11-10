// TURBO DASH (game.gamergunner.com/dash/): a 3D endless runner over neon rooftops.
// Three lanes, jump / slide / switch lanes, coins, power-ups, missions and a shop. Four worlds that change every 1000 m.
// Files: gen.js (track patterns), sim.js (game rules), auto.js (autopilot for tests), world.js (3D), sfx.js (sound), save.js (saved stuff).
import * as THREE from "/create/vendor/three.module.js";
import { Sim, BASE_DUR } from "./sim.js";
import { autopilot } from "./auto.js";
import { themeAt, LANES } from "./gen.js";
import * as W from "./world.js";
import { SFX, audio, setMuted, music, musicKey, musicIntensity } from "./sfx.js";
import { S, save, RUNNERS, TRAILS, UPGRADES, UP_COST, UP_MAX, missionText, missionValue, checkMissions, runStart, runEnd, durations } from "./save.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const THUMB = Q.has("thumb"), TEST = Q.has("test");
const STEP = 1 / 60;

let sim = new Sim(7);
let state = "menu"; // menu | play | pause | dying | over | thumb
let time = 0, dieT = 0, curTheme = 0, autoOn = Q.has("auto"), god = false, frozen = TEST, overAt = 0, newBest = false;
const fmt = (n) => Math.floor(n).toLocaleString("en-US");

// ------------------------------------------------------------------ setup
W.resize();
addEventListener("resize", () => { W.resize(); if (state === "thumb") W.render(); });
setMuted(!!S.muted);
function applyStyle() {
  W.styleRunner(W.runner, RUNNERS.find((r) => r.id === S.runner) || RUNNERS[0]);
  W.setTrail((TRAILS.find((t) => t.id === S.trail) || TRAILS[0]).colors);
}
applyStyle();
const runStats = () => ({ coins: sim.coins, jumps: sim.stats.jumps, slides: sim.stats.slides, dist: sim.d, score: sim.score, tops: sim.stats.tops, lanes: sim.stats.lanes, jetpacks: sim.stats.jetpacks, powers: sim.stats.powers });
const panels = ["menu", "shop", "pause", "over"];
function show(id) { for (const p of panels) $(p).classList.toggle("hidden", p !== id); }

// ------------------------------------------------------------------ a run
function start(seed) {
  audio();
  sim = new Sim(seed ?? ((Math.random() * 1e9) | 0), { dur: durations(BASE_DUR), mult: S.mult });
  sim.god = god;
  W.resetWorld(); runStart(); applyStyle();
  state = "play"; dieT = 0; curTheme = 0;
  show(null); $("hud").classList.remove("hidden");
  music(true, W.THEMES[0].key); musicIntensity(0);
  banner(W.THEMES[0].name, "GO GO GO!");
  W.syncWorld(sim, STEP, { snap: true, t: time });
  updateHud(true);
  $("canvas").focus();
}
function tick() {
  time += STEP;
  if (state === "play") {
    if (autoOn) autopilot(sim);
    sim.step(STEP);
    events();
    for (const m of checkMissions(runStats())) { toast("MISSION DONE!", `${m} · multiplier now x${S.mult}`, "good"); SFX.mission(); sim.baseMult = S.mult; }
    const th = themeAt(sim.d);
    if (th !== curTheme) { curTheme = th; banner(W.THEMES[th].name, Math.floor(sim.d / 1000) * 1000 + " m!"); SFX.theme(); musicKey(W.THEMES[th].key); }
    for (const o of sim.ahead(sim.d, sim.d + 90, [])) if (o.look === "truck" && !o.honk && sim.d > o.meet - o.park - 1) { o.honk = true; SFX.horn(); }
    musicIntensity(Math.min(1, (sim.speed - 13) / 12));
    if (!sim.alive) { state = "dying"; dieT = 0; }
  } else if (state === "dying") {
    sim.step(STEP); events(); dieT += STEP;
    if (sim.cause === "fell") sim.y -= 9 * STEP;
    if (dieT > 1.15) gameOver();
  }
}
const CAUSE = {
  barrier: ["OOF!", "You tripped over a barrier. Jump over them!"],
  bar: ["BONK!", "You bonked a SLIDE sign. Slide under those!"],
  train: ["SMACK!", "You ran into a tram. Use the ramps to get on top!"],
  truck: ["BEEP BEEP!", "A truck was driving right at you. Switch lanes!"],
  crate: ["CRASH!", "You smashed into the crates. Dodge sideways!"],
  fell: ["WHOOPS!", "You fell off the roof. Jump over the gaps!"],
  caught: ["CAUGHT!", "Bolt the security bot got you! Two bumps in a row is too many."],
};
function events() {
  for (const e of sim.ev) {
    const a = e.a;
    switch (e.type) {
      case "coin": SFX.coin(a.streak); W.burst(a.x, a.y, sim.d - a.z, 0xffe14a, 4, 3, { life: 0.35, size: 0.32, star: true }); popCoins(); break;
      case "jump": SFX.jump(a); W.burst(sim.x, sim.y + 0.1, 0.3, 0xffffff, 4, 1.6, { life: 0.3, size: 0.45, stick: true }); break;
      case "land": SFX.land(); break;
      case "slide": SFX.slide(); W.burst(sim.x, sim.y + 0.15, 0.4, 0xffffff, 6, 1.2, { life: 0.35, size: 0.5, stick: true }); break;
      case "dive": SFX.dive(); break;
      case "whoosh": SFX.whoosh(a); break;
      case "bonk": SFX.bonk(); W.shake(0.6); break;
      case "power": SFX.power(); if (a === "jetpack") SFX.jet(); toast(W.POWER_NAMES[a] + "!", { magnet: "Coins fly to you!", shield: "One free crash!", jetpack: "Fly over everything!", x2: "Double points!", sneakers: "Super high jumps!" }[a], "power", W.ICON_URL[a]);
        W.burst(sim.x, sim.y + 1.2, 0, 0xffffff, 18, 6, { life: 0.6, size: 0.45, star: true, colors: [0xffe14a, 0xff4fd8, 0x3ff3ff] }); break;
      case "powerEnd": SFX.powerEnd(); break;
      case "shield": SFX.shield(); W.smash(a); W.burst(sim.x, sim.y + 1, -1, 0x5ac8ff, 26, 8, { life: 0.6, size: 0.55 }); W.shake(1); flash("#5ac8ff"); toast("SHIELD SAVED YOU!", "", "power", W.ICON_URL.shield); break;
      case "stumble": SFX.stumble(); setTimeout(() => SFX.robot(), 280); W.shake(1.1); toast("WHOA!", "Bolt the security bot is chasing you! Don't bump again!", "warn"); break;
      case "crash": if (a === "caught") SFX.caught(); else SFX.crash(); W.shake(a === "fell" ? 0.6 : 2.2); flash(a === "caught" ? "#ffd23a" : "#ff3a3a"); music(false);
        W.burst(sim.x, sim.y + 1.6, -0.5, 0xffe14a, 16, 5, { life: 0.8, size: 0.6, star: true, colors: [0xffe14a, 0xffffff] }); break;
    }
  }
  sim.ev.length = 0;
}
function gameOver() {
  state = "over"; overAt = performance.now();
  newBest = runEnd(runStats());
  const [t, why] = CAUSE[sim.cause] || ["CRASH!", ""];
  $("overTitle").textContent = t; $("overWhy").textContent = why;
  $("oScore").textContent = fmt(sim.score); $("oCoins").textContent = fmt(sim.coins); $("oDist").textContent = fmt(sim.d) + " m";
  $("oBest").textContent = fmt(S.best); $("newBest").classList.toggle("hidden", !newBest);
  renderMissions($("oMissions"), null);
  $("oBank").textContent = fmt(S.coins);
  $("hud").classList.add("hidden"); show("over");
  if (newBest) SFX.mission();
}
function toMenu() {
  state = "menu"; music(false);
  sim = new Sim(7); W.resetWorld(); applyStyle();
  $("hud").classList.add("hidden"); renderMenu(); show("menu");
}
function setPause(p) {
  if (p && state === "play") { state = "pause"; music(false); show("pause"); }
  else if (!p && state === "pause") { state = "play"; music(true); show(null); $("canvas").focus(); }
}

// ------------------------------------------------------------------ HUD
const PW = ["magnet", "shield", "jetpack", "x2", "sneakers"];
const bars = {};
for (const k of PW) {
  const row = document.createElement("div"); row.className = "pbar hidden";
  row.innerHTML = `<img alt="" src="${W.ICON_URL[k]}"><div><i></i></div>`;
  $("powerBars").appendChild(row); bars[k] = row;
}
let lastScore = -1, lastCoins = -1, lastMult = -1;
function updateHud(force) {
  const sc = Math.floor(sim.score);
  if (sc !== lastScore || force) { $("score").textContent = fmt(sc); lastScore = sc; }
  if (sim.coins !== lastCoins || force) { $("coinN").textContent = fmt(sim.coins); lastCoins = sim.coins; }
  $("distN").textContent = fmt(sim.d) + " m";
  if (sim.mult !== lastMult || force) { $("multi").textContent = "x" + sim.mult; $("multi").classList.toggle("hot", sim.pw.x2 > 0); lastMult = sim.mult; }
  for (const k of PW) {
    const on = sim.pw[k] > 0; bars[k].classList.toggle("hidden", !on);
    if (on) { const f = sim.pw[k] / sim.dur[k]; bars[k].querySelector("i").style.width = (f * 100).toFixed(1) + "%"; bars[k].classList.toggle("low", sim.pw[k] < 1.5); }
  }
  $("chase").classList.toggle("on", sim.chaseT > 0 && sim.alive);
}
function popCoins() { const c = $("coinBox"); c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }
let toastQ = [], toastBusy = false;
function toast(title, sub, kind = "", icon = "") { toastQ.push({ title, sub, kind, icon }); if (toastQ.length > 3) toastQ.shift(); if (!toastBusy) nextToast(); }
function nextToast() {
  const t = toastQ.shift(); if (!t) { toastBusy = false; return; }
  toastBusy = true; const el = $("toast");
  el.className = "toast " + t.kind; el.innerHTML = (t.icon ? `<img alt="" src="${t.icon}">` : "") + `<div><b></b><span></span></div>`;
  el.querySelector("b").textContent = t.title; el.querySelector("span").textContent = t.sub;
  void el.offsetWidth; el.classList.add("on");
  setTimeout(() => { el.classList.remove("on"); setTimeout(nextToast, 250); }, 1700);
}
function banner(big, small) { const b = $("banner"); b.innerHTML = `<small></small><b></b>`; b.querySelector("small").textContent = small || ""; b.querySelector("b").textContent = big; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); }
function flash(col) { const f = $("flash"); f.style.background = col; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }

// ------------------------------------------------------------------ menus
function renderMissions(el, r) {
  el.innerHTML = "";
  for (const m of S.missions) {
    const v = missionValue(m, r), li = document.createElement("li");
    li.innerHTML = `<span></span><div class="mbar"><i style="width:${((v / m.n) * 100).toFixed(0)}%"></i></div><em>${fmt(v)} / ${fmt(m.n)}</em>`;
    li.querySelector("span").textContent = missionText(m);
    el.appendChild(li);
  }
}
function renderMenu() {
  $("mBest").textContent = fmt(S.best); $("mCoins").textContent = fmt(S.coins); $("mMult").textContent = "x" + S.mult;
  renderMissions($("mMissions"), null);
  $("muteBtn").textContent = S.muted ? "🔇 Sound off" : "🔊 Sound on";
  $("bMute").textContent = S.muted ? "🔇" : "🔊";
}
let shopTab = "runners";
function mini(r) { return `<div class="mini" style="--skin:${hx(r.skin)};--shirt:${hx(r.shirt)};--pants:${hx(r.pants)};--hat:${hx(r.hatColor)};--shoes:${hx(r.shoes)}"><i class="h"></i><i class="hd"></i><i class="b"></i><i class="p"></i><i class="s"></i></div>`; }
const hx = (n) => "#" + n.toString(16).padStart(6, "0");
function renderShop() {
  $("sCoins").textContent = fmt(S.coins);
  for (const b of document.querySelectorAll(".tabs button")) b.classList.toggle("on", b.dataset.tab === shopTab);
  const g = $("shopGrid"); g.innerHTML = "";
  const card = (html, btn, cls, act) => { const d = document.createElement("div"); d.className = "card " + (cls || ""); d.innerHTML = html; const b = document.createElement("button"); b.type = "button"; b.innerHTML = btn; b.onclick = act; d.appendChild(b); g.appendChild(d); return b; };
  if (shopTab === "runners" || shopTab === "trails") {
    const list = shopTab === "runners" ? RUNNERS : TRAILS, key = shopTab === "runners" ? "runner" : "trail";
    for (const it of list) {
      const own = S.own.includes(it.id), using = S[key] === it.id;
      const pic = shopTab === "runners" ? mini(it) : `<div class="swatch" style="background:${it.colors.length ? `linear-gradient(90deg,${it.colors.map(hx).join(",")})` : "repeating-linear-gradient(45deg,#333 0 6px,#444 6px 12px)"}"></div>`;
      const b = card(`${pic}<b>${it.name}</b>`, using ? "✓ Using" : own ? "Use" : `🪙 ${fmt(it.cost)}`, using ? "using" : "", () => {
        if (using) return;
        if (!own) { if (S.coins < it.cost) { SFX.nope(); return; } S.coins -= it.cost; S.own.push(it.id); SFX.buy(); } else SFX.click();
        S[key] = it.id; save(); applyStyle(); renderShop();
      });
      if (!own && S.coins < it.cost) b.classList.add("poor");
    }
  } else {
    for (const u of UPGRADES) {
      const lv = S.up[u.id] || 0, base = BASE_DUR[u.id], maxed = lv >= UP_MAX, cost = UP_COST[lv];
      const pips = Array.from({ length: UP_MAX }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
      const b = card(`<img class="uicon" alt="" src="${W.ICON_URL[u.id]}"><b>${u.name}</b><div class="pips">${pips}</div><small>${base + lv * u.per}s${maxed ? " (max!)" : ` → ${base + (lv + 1) * u.per}s`}</small>`, maxed ? "MAX" : `🪙 ${fmt(cost)}`, "", () => {
        if (maxed) return;
        if (S.coins < cost) { SFX.nope(); return; }
        S.coins -= cost; S.up[u.id] = lv + 1; save(); SFX.buy(); renderShop();
      });
      if (maxed) b.disabled = true; else if (S.coins < cost) b.classList.add("poor");
    }
  }
}
$("play").onclick = () => { SFX.click(); start(); };
$("again").onclick = () => start();
$("toMenu").onclick = () => toMenu();
$("quit").onclick = () => { state = "over"; toMenu(); };
$("resume").onclick = () => setPause(false);
$("shopBtn").onclick = () => { audio(); SFX.click(); renderShop(); show("shop"); };
$("oShop").onclick = () => { SFX.click(); toMenu(); renderShop(); show("shop"); };
$("shopBack").onclick = () => { SFX.click(); renderMenu(); show("menu"); };
for (const b of document.querySelectorAll(".tabs button")) b.onclick = () => { shopTab = b.dataset.tab; SFX.click(); renderShop(); };
function toggleMute() { S.muted = !S.muted; save(); setMuted(S.muted); renderMenu(); if (!S.muted) { audio(); SFX.click(); } }
$("muteBtn").onclick = toggleMute; $("bMute").onclick = (e) => { e.stopPropagation(); toggleMute(); };
$("bPause").onclick = (e) => { e.stopPropagation(); setPause(true); };

// ------------------------------------------------------------------ input
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
  audio();
  if (state === "play") {
    if (e.repeat) return;
    if (k === "a" || k === "arrowleft") sim.move(-1);
    else if (k === "d" || k === "arrowright") sim.move(1);
    else if (k === "w" || k === "arrowup" || k === " ") sim.jump();
    else if (k === "s" || k === "arrowdown") sim.slide();
    else if (k === "p" || k === "escape") setPause(true);
    else if (k === "m") toggleMute();
  } else if (state === "pause") { if (k === "p" || k === "escape" || k === " " || k === "enter") setPause(false); }
  else if (state === "over") { if ((k === " " || k === "enter") && performance.now() - overAt > 450) start(); else if (k === "escape") toMenu(); }
  else if (state === "menu" && !$("menu").classList.contains("hidden")) { if (k === " " || k === "enter") start(); }
});
// swipes
let sw = null;
const cv = $("canvas");
cv.addEventListener("pointerdown", (e) => { audio(); if (state !== "play") return; sw = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false }; });
addEventListener("pointermove", (e) => {
  if (!sw || sw.id !== e.pointerId || sw.done || state !== "play") return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, th = Math.max(22, Math.min(innerWidth, innerHeight) * 0.045);
  if (Math.hypot(dx, dy) < th) return;
  sw.done = true;
  if (Math.abs(dx) > Math.abs(dy)) sim.move(dx > 0 ? 1 : -1); else if (dy < 0) sim.jump(); else sim.slide();
});
const endSw = (e) => { if (sw && sw.id === e.pointerId) sw = null; };
addEventListener("pointerup", endSw); addEventListener("pointercancel", endSw);
if (navigator.maxTouchPoints > 0 || "ontouchstart" in window) document.body.classList.add("touch");
if (!TEST) {
  document.addEventListener("visibilitychange", () => { if (document.hidden) setPause(true); });
  addEventListener("blur", () => setPause(true));
}

// ------------------------------------------------------------------ loop
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (state === "thumb") return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (frozen) { W.render(); return; }
  if (state === "play" || state === "dying") {
    acc += dt; let n = 0;
    while (acc >= STEP && n < 5) { tick(); acc -= STEP; n++; }
    if (n >= 5) acc = 0;
    visuals(dt);
  } else if (state === "menu" || state === "over") { time += dt; visuals(dt); }
  else W.render();
}
function visuals(dt) {
  W.syncWorld(sim, dt, { t: time, menu: state === "menu", back: state === "menu" ? 130 : 12, ahead: state === "menu" ? 40 : W.VIEW });
  if (state === "play" || state === "dying") updateHud();
  W.render();
}

// ------------------------------------------------------------------ thumbnail mode (?thumb): a posed action shot + title
function thumbnail() {
  state = "thumb"; W.resetWorld(); show(null); $("hud").classList.add("hidden"); $("thumbTitle").classList.remove("hidden");
  sim = new Sim(5);
  const g = sim.gen, D = 470;
  g.objs.length = 0; g.coins.length = 0; g.powers.length = 0; g.z = 1e9; sim.oi = 0; sim.ci = 0;
  sim.d = D; sim.x = 0; sim.target = 1; sim.y = 1.75; sim.vy = 2; sim.onGround = false; sim.floor = 0; sim.speed = 26;
  g.box(1, D - 0.55, D - 0.05, 1.0, "barrier");
  for (let i = 0; i < 4; i++) { g.coin(1, D + 0.6 + i * 0.8, 4.75 + i * 0.3); g.coins[g.coins.length - 1].x = -1.35 - i * 0.55; }
  g.ramp(2, D - 40, 8, 3.0); g.box(2, D - 32, D - 8, 3.0, "train", { cars: 3 });
  for (let z = D - 38; z < D - 9; z += 2.6) g.coin(2, z, z < D - 32 ? ((z - (D - 40)) / 8) * 3 + 0.9 : 3.9);
  g.bar(0, D - 46); g.coinLine(0, D - 30, D - 6, 2.4, 0.9);
  g.box(0, D - 60, D - 52, 3.0, "truck", { meet: D - 60, k: 0.8, vlen: 12, park: 0 });
  g.box(1, D - 34, D - 33.5, 1.0, "barrier"); g.coinLine(1, D - 60, D - 38, 2.6);
  g.power(1, D - 24, "jetpack"); g.powers[0].y = 1.7;
  g.objs.sort((a, b) => a.z0 - b.z0); g.coins.sort((a, b) => a.z - b.z);
  W.styleRunner(W.runner, RUNNERS[0]); W.setTrail(TRAILS[2].colors);
  const opts = { back: 170, ahead: 14, t: 1.3, lines: 1, lineZ: 34, snap: true };
  for (let i = 0; i < 40; i++) W.syncWorld(sim, 1 / 30, opts);
  // a fiery trail behind the feet and sparkles around the coins
  for (let i = 0; i < 70; i++) { const k = i / 70; W.spawn(k * k * 4.2 + (Math.random() - 0.5) * 0.3, 1.9 - k * 1.7 + Math.sin(k * 3.5) * 0.6, 0.3 + k * 16, 0, 0, 0, [0xffe14a, 0xff8a1a, 0xff3a2a][i % 3], 1, 0.85 - k * 0.45); }
  for (let i = 0; i < 14; i++) { const z = 1.2 + Math.random() * 18; W.spawn((Math.random() - 0.5) * 1.6, 1 + Math.random() * 3.4, z, 0, 0, 0, 0xfff2a0, 1, 0.35, { star: true }); }
  W.runner.g.rotation.z = 0.12; W.runner.upper.rotation.x = -0.3; W.runner.head.rotation.x = -0.15;
  const cam = () => W.setCamera(1.0, 1.1, -8.4, 2.0, 3.0, 0, 42);
  cam(); W.render();
  document.body.classList.add("thumb");
  requestAnimationFrame(() => { cam(); W.render(); });
}

// ------------------------------------------------------------------ test hook
window.TD = {
  step(n = 1) { for (let i = 0; i < n; i++) { tick(); W.syncWorld(sim, STEP, { t: time, menu: state === "menu" }); } updateHud(); },
  render() { W.syncWorld(sim, 0, { t: time, menu: state === "menu" }); updateHud(); W.render(); },
  start(seed = 1) { start(seed); },
  get state() { return state; }, get sim() { return sim; },
  get d() { return sim.d; }, get score() { return sim.score; }, get coins() { return sim.coins; }, get alive() { return sim.alive; },
  get speed() { return sim.speed; }, get curLane() { return sim.target; }, get x() { return sim.x; }, get y() { return sim.y; }, get pw() { return sim.pw; }, get cause() { return sim.cause; },
  get god() { return god; }, set god(v) { god = !!v; sim.god = god; },
  get auto() { return autoOn; }, set auto(v) { autoOn = !!v; },
  set frozen(v) { frozen = !!v; },
  lane(n) { sim.setLane(n); }, left() { sim.move(-1); }, right() { sim.move(1); }, jump() { sim.jump(); }, slide() { sim.slide(); },
  power(type) { sim.power({ type, got: false }); events(); },
  pause() { setPause(true); }, resume() { setPause(false); }, menu() { toMenu(); }, save: S, THREE,
  get info() { const r = W.renderer.info.render; return { calls: r.calls, triangles: r.triangles }; },
};

// ------------------------------------------------------------------ go
if (THUMB) { document.fonts && document.fonts.ready.then(() => { thumbnail(); }); thumbnail(); }
else if (TEST) { start(+(Q.get("seed") || 1)); requestAnimationFrame(frame); }
else { renderMenu(); show("menu"); requestAnimationFrame(frame); }
