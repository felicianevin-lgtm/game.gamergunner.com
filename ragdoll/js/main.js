// SPLAT LAB: a 2D physics ragdoll sandbox for GunnerVerse. Spawn floppy people and stuff, then mess with them.
import { W, WW, WH, step, frame, removeBody, hurt, heal, ignite, explode, addVel, vel, rnd } from "./sim.js";
import { drawPools, drawDrops, drawChunks, drawFlames, drawFx, drawTexts, OUT } from "./draw.js";
import { CATS, ITEMS, ITEM, drawBody, spawnItem } from "./items.js";
import { MAPS, segsOf } from "./maps.js";
import { SFX, audio, setMuted, isMuted } from "./sfx.js";

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const cv = $("canvas"), ctx = cv.getContext("2d");
W.sfx = SFX;
const store = { get(k, d) { try { const v = localStorage.getItem("gv_splatlab_" + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem("gv_splatlab_" + k, JSON.stringify(v)); } catch {} } };

// ---------------------------------------------------------------- canvases
const decal = document.createElement("canvas"); decal.width = WW; decal.height = WH; W.dctx = decal.getContext("2d");
const bg = document.createElement("canvas"); const bctx = bg.getContext("2d");
let map = MAPS.find((m) => m.id === store.get("map", "lab")) || MAPS[0];
let SC = 1, OX = 0, OY = 0, DPR = 1, bgQ = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR);
  SC = Math.min(cv.width / WW, cv.height / WH); OX = (cv.width - WW * SC) / 2; OY = (cv.height - WH * SC) / 2;
  const q = Math.min(2, Math.max(0.5, SC)); if (Math.abs(q - bgQ) > 0.01) { bgQ = q; drawBg(); }
}
function drawBg() { bg.width = Math.round(WW * bgQ); bg.height = Math.round(WH * bgQ); bctx.setTransform(bgQ, 0, 0, bgQ, 0, 0); map.draw(bctx); }
addEventListener("resize", resize);

function setMap(m) {
  map = m; store.set("map", m.id); W.segs = segsOf(m); clearAll(); drawBg();
}
function clean() { W.dctx.clearRect(0, 0, WW, WH); W.pools.length = 0; W.drops.length = 0; W.drips.length = 0; W.chunks.length = 0; for (const b of W.bodies) { b.bloody = 0; if (b.parts) for (const q of b.parts) q.bloody = 0; } }
function clearAll() { for (const b of [...W.bodies]) removeBody(b); W.pins.length = 0; W.fires.length = 0; W.flames.length = 0; W.fx.length = 0; W.texts.length = 0; W.grab = null; clean(); }

// ---------------------------------------------------------------- state + UI
let tool = "drag", spawnDef = null, paused = false, slow = false, started = false, cat = "people";
let hintT = 0, mouse = { x: WW / 2, y: WH / 2, in: false }, lastTap = { b: null, t: 0 };
W.gore = store.get("gore", true);
const HINT = {
  drag: "Drag people and things to throw them. Double-tap a thing (or right-click it) to USE it.",
  fire: "🔥 Tap someone or something to set it on fire.", boom: "💥 Tap anywhere to blow it up!",
  heal: "💉 Tap a person to heal them (lost arms and legs stay lost).", del: "🗑️ Tap a thing to delete it.",
};
function setTool(t) {
  tool = t; if (t !== "drag") spawnDef = null;
  document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
  updateHint();
}
function updateHint() {
  $("bSpawn").textContent = spawnDef ? "＋ " + spawnDef.name : "＋ Spawn";
  $("bSpawn").classList.toggle("on", !!spawnDef);
  clearTimeout(hintT); $("hint").classList.remove("fade"); hintT = setTimeout(() => $("hint").classList.add("fade"), 7000);
  $("hint").textContent = spawnDef ? `Tap empty space to place a ${spawnDef.name}${spawnDef.usable ? " · double-tap it to USE" : ""}. ✋ = stop placing.` : HINT[tool];
}
document.querySelectorAll(".tool").forEach((b) => b.addEventListener("click", () => { SFX.click(); setTool(b.dataset.tool); }));

// spawn menu (with little pictures of every item)
function buildSpawnMenu() {
  $("cats").innerHTML = CATS.map((c) => `<button type="button" data-cat="${c.id}" class="${c.id === cat ? "on" : ""}">${c.icon} ${c.name}</button>`).join("");
  $("cats").querySelectorAll("button").forEach((b) => b.onclick = () => { cat = b.dataset.cat; SFX.click(); buildSpawnMenu(); });
  const grid = $("grid"); grid.innerHTML = "";
  for (const d of ITEMS.filter((d) => d.cat === cat)) {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "item" + (spawnDef === d ? " on" : "");
    const c = document.createElement("canvas"); c.width = 132; c.height = 96; icon(c, d);
    btn.append(c); btn.insertAdjacentHTML("beforeend", `<b>${d.name}</b><small>${d.desc}</small>`);
    btn.onclick = () => { spawnDef = d; setTool("drag"); spawnDef = d; updateHint(); closePanels(); SFX.click(); };
    grid.append(btn);
  }
}
const iconCache = {};
function icon(c, d) {
  const g = c.getContext("2d");
  if (iconCache[d.id]) { g.drawImage(iconCache[d.id], 0, 0); return; }
  const saved = W.bodies, savedT = W.time; W.bodies = []; W.preview = true;
  d.spawn(0, 0, 1, d); const bodies = W.bodies; W.bodies = saved; W.preview = false; W.time = savedT;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const b of bodies) for (const p of b.ps) { x0 = Math.min(x0, p.x - p.r); y0 = Math.min(y0, p.y - p.r); x1 = Math.max(x1, p.x + p.r); y1 = Math.max(y1, p.y + p.r); }
  if (d.id === "spikes" || d.id === "flamer") y0 -= 40;
  if (d.id === "saw") { x0 = -48; x1 = 48; y0 = -48; y1 = 62; }
  const s = Math.min((c.width - 16) / (x1 - x0), (c.height - 14) / (y1 - y0), 2.2);
  g.save(); g.translate(c.width / 2 - ((x0 + x1) / 2) * s, c.height / 2 - ((y0 + y1) / 2) * s); g.scale(s, s);
  for (const b of bodies) { if (d.id === "car" || d.id === "truck") b.rot = 0; try { drawBody(g, b); } catch (e) { console.warn(d.id, e); } }
  g.restore();
  iconCache[d.id] = c;
}
function openPanel(id) { closePanels(); $(id).classList.remove("hidden"); if (id === "spawn") buildSpawnMenu(); if (id === "maps") buildMaps(); }
function closePanels() { for (const id of ["spawn", "maps"]) $(id).classList.add("hidden"); }
const panelOpen = () => !$("spawn").classList.contains("hidden") || !$("maps").classList.contains("hidden") || !$("menu").classList.contains("hidden");
$("bSpawn").onclick = () => { SFX.click(); openPanel("spawn"); };
$("spClose").onclick = closePanels; $("mapClose").onclick = closePanels;
for (const id of ["spawn", "maps"]) $(id).addEventListener("pointerdown", (e) => { if (e.target.id === id) closePanels(); });
function buildMaps() {
  $("mapList").innerHTML = MAPS.map((m) => `<button type="button" data-map="${m.id}" class="${m === map ? "on" : ""}"><span>${m.icon}</span><b>${m.name}</b><small>${m.desc}</small></button>`).join("");
  $("mapList").querySelectorAll("button").forEach((b) => b.onclick = () => { setMap(MAPS.find((m) => m.id === b.dataset.map)); closePanels(); SFX.click(); starter(); });
}
$("bMap").onclick = () => { SFX.click(); openPanel("maps"); };
$("bSlow").onclick = () => toggleSlow(); $("bPause").onclick = () => togglePause();
$("bClean").onclick = () => { clean(); SFX.click(); }; $("bClear").onclick = () => { clearAll(); SFX.click(); };
function toggleSlow() { slow = !slow; $("bSlow").classList.toggle("on", slow); SFX.click(); }
function togglePause() { paused = !paused; $("bPause").textContent = paused ? "▶" : "⏸"; $("bPause").classList.toggle("on", paused); SFX.click(); }
function syncMute() { const m = isMuted(); $("bMute").textContent = m ? "🔇" : "🔊"; $("mMute").textContent = m ? "🔇 Sound off" : "🔊 Sound on"; }
$("bMute").onclick = $("mMute").onclick = () => { setMuted(!isMuted()); store.set("muted", isMuted()); syncMute(); };
setMuted(store.get("muted", false)); syncMute();
function syncGore() { $("mGore").textContent = W.gore ? "🩸 Blood: ON" : "🩸 Blood: OFF"; }
$("mGore").onclick = () => { W.gore = !W.gore; store.set("gore", W.gore); syncGore(); if (!W.gore) clean(); }; syncGore();
$("bMenu").onclick = () => { $("menu").classList.remove("hidden"); $("play").textContent = "▶ Keep playing"; };
$("play").onclick = () => { audio(); $("menu").classList.add("hidden"); $("ui").classList.remove("hidden"); if (!started) { started = true; starter(); } };
function starter() { if (W.bodies.length) return; const xs = [520, 800, 1080]; xs.forEach((x, i) => { const y = floorY(x) - 60; spawnItem(ITEM[["buddy", "buddy", "brute"][i]], x, y, x < WW / 2 ? 1 : -1); }); }
const floorY = (x) => { let best = WH; for (const s of W.segs) { const lo = Math.min(s.ax, s.bx), hi = Math.max(s.ax, s.bx); if (hi - lo < 1 || x < lo || x > hi) continue; const y = s.ay + ((x - s.ax) / (s.bx - s.ax)) * (s.by - s.ay) - s.r; if (y < best && y > 30) best = y; } return best; };

// ---------------------------------------------------------------- picking + grabbing
function toWorld(e) { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * DPR - OX) / SC, ((e.clientY - r.top) * DPR - OY) / SC]; }
function segD(px, py, a, b) { const ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey; let t = L2 ? ((px - a.x) * ex + (py - a.y) * ey) / L2 : 0; t = Math.max(0, Math.min(1, t)); return [Math.hypot(px - a.x - ex * t, py - a.y - ey * t), t]; }
function pick(x, y, any = false, reach = 26) {
  let best = null, bd = reach;
  for (let i = W.bodies.length - 1; i >= 0; i--) {
    const b = W.bodies[i];
    if (b.static && !any) continue;
    if (x < b.x0 - 60 || x > b.x1 + 60 || y < b.y0 - 60 || y > b.y1 + 60) continue;
    for (const sh of b.shapes) {
      if (sh.off) continue;
      let d;
      if (sh.t === "cap") d = segD(x, y, sh.a, sh.b)[0] - sh.r;
      else { let inside = true, md = 1e9; const n = sh.pts.length; let cx = 0, cy = 0; for (const p of sh.pts) { cx += p.x; cy += p.y; } cx /= n; cy /= n; for (let k = 0; k < n; k++) { const a = sh.pts[k], c = sh.pts[(k + 1) % n]; md = Math.min(md, segD(x, y, a, c)[0]); let nx = c.y - a.y, ny = -(c.x - a.x); if ((a.x - cx) * nx + (a.y - cy) * ny < 0) { nx = -nx; ny = -ny; } if ((x - a.x) * nx + (y - a.y) * ny > 0) inside = false; } d = inside ? -1 : md; }
      if (d < bd) { bd = d; best = { b, sh }; }
    }
  }
  return best;
}
function startGrab(hit, x, y) {
  const b = hit.b;
  if (b.kind === "rag") { const sh = hit.sh, [, t] = segD(x, y, sh.a, sh.b); W.grab = { body: b, p: t < 0.5 ? sh.a : sh.b, tx: x, ty: y, rigid: false }; }
  else if (b.ball) W.grab = { body: b, p: b.ball, tx: x, ty: y, rigid: false };
  else W.grab = { body: b, rigid: true, tx: x, ty: y, ang: 0, k: b.mass > 18 ? 0.16 : 0.3, offs: b.ps.filter((p) => p.im).map((p) => ({ p, dx: p.x - x, dy: p.y - y })) };
  $("hold").classList.toggle("hidden", !(W.grab.rigid && matchMedia("(pointer: coarse)").matches));
  $("hUse").classList.toggle("dim", !(b.def && b.def.use) && b.kind !== "rag");
}
function release() { W.grab = null; $("hold").classList.add("hidden"); }
function rotateHeld(a) { if (W.grab && W.grab.rigid) W.grab.ang += a; }
function useBody(b) {
  if (!b) return;
  if (b.kind === "rag") { if (b.state === "alive") { for (const p of b.ps) addVel(p, 0, -620); W.texts.push({ x: b.ps[0].x, y: b.ps[0].y - 26, txt: "hup!", col: "#fff", life: 0.8 }); } return; }
  if (b.def && b.def.use) b.def.use(b);
}
function hoveredBody() { if (W.grab) return W.grab.body; const h = pick(mouse.x, mouse.y, false, 30); return h ? h.b : null; }

let activePtr = null;
cv.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("pointerdown", (e) => {
  if (!started || panelOpen()) return;
  audio();
  const [x, y] = toWorld(e); mouse = { x, y, in: true };
  if (e.button === 2) { const h = pick(x, y, true, 30); if (h) useBody(h.b); return; }
  if (activePtr !== null) return;
  activePtr = e.pointerId; cv.setPointerCapture(e.pointerId);
  if (tool === "drag") {
    const h = pick(x, y);
    if (h) {
      const now = performance.now();
      if (lastTap.b === h.b && now - lastTap.t < 340) { useBody(h.b); lastTap.b = null; } else lastTap = { b: h.b, t: now };
      startGrab(h, x, y);
    } else if (spawnDef) {
      if (y > -10 && y < WH && x > 0 && x < WW) spawnItem(spawnDef, x, y, x < WW / 2 ? 1 : -1);
    }
  } else if (tool === "fire") {
    const h = pick(x, y, true, 30);
    if (h) { let near = null, nd = 1e9; for (const p of h.b.ps) { const d = Math.hypot(p.x - x, p.y - y); if (!p.gone && d < nd) { nd = d; near = p; } } ignite(h.b, near); }
    else { W.fires.push({ x, y: floorY(x) < y + 120 ? floorY(x) : y, life: 5, r: 30 }); SFX.fire(); }
  } else if (tool === "boom") explode(x, y, 1);
  else if (tool === "heal") { const h = pick(x, y, false, 40); if (h && h.b.kind === "rag" && heal(h.b)) SFX.heal(); }
  else if (tool === "del") { const h = pick(x, y, true, 20); if (h) { removeBody(h.b); SFX.click(); } }
});
cv.addEventListener("pointermove", (e) => {
  const [x, y] = toWorld(e); if (e.pointerId === activePtr || activePtr === null) mouse = { x, y, in: true };
  if (W.grab && e.pointerId === activePtr) { W.grab.tx = x; W.grab.ty = y; }
});
const up = (e) => { if (e.pointerId !== activePtr) return; activePtr = null; release(); };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
cv.addEventListener("pointerleave", () => { mouse.in = false; });
cv.addEventListener("wheel", (e) => { if (W.grab) { e.preventDefault(); rotateHeld(Math.sign(e.deltaY) * 0.14); } }, { passive: false });
// touch buttons for the held thing
let rotTimer = null;
for (const [id, a] of [["hL", -0.07], ["hR", 0.07]]) {
  $(id).addEventListener("pointerdown", (e) => { e.preventDefault(); rotateHeld(a); clearInterval(rotTimer); rotTimer = setInterval(() => rotateHeld(a), 30); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $(id).addEventListener(ev, () => clearInterval(rotTimer));
}
$("hUse").addEventListener("pointerdown", (e) => { e.preventDefault(); if (W.grab) useBody(W.grab.body); });

addEventListener("keydown", (e) => {
  if (!started) return;
  const k = e.key.toLowerCase();
  if (k === "escape") { if (panelOpen() && $("menu").classList.contains("hidden")) closePanels(); else { spawnDef = null; setTool("drag"); } return; }
  if (panelOpen()) return;
  if (k === "q") rotateHeld(-0.15); else if (k === "e") rotateHeld(0.15);
  else if (k === "f" || k === " ") { e.preventDefault(); useBody(hoveredBody()); }
  else if (k === "tab" || k === "b") { e.preventDefault(); openPanel("spawn"); }
  else if (k === "s") toggleSlow(); else if (k === "p") togglePause();
  else if (k === "c") clean(); else if (k === "x") clearAll(); else if (k === "m") openPanel("maps");
  else if (k === "delete" || k === "backspace") { const b = hoveredBody(); if (b) removeBody(b); }
  else if ("12345".includes(k)) setTool(["drag", "fire", "boom", "heal", "del"][+k - 1]);
});

// ---------------------------------------------------------------- info card (who you're pointing at)
const bar = (v, n = 10) => "█".repeat(Math.round(v * n)) + "░".repeat(n - Math.round(v * n));
let infoTxt = "";
function updateInfo() {
  const b = mouse.in || W.grab ? hoveredBody() : null;
  let t = "";
  if (b && b.kind === "rag") {
    const burning = b.parts.some((q) => q.burn > 0), lost = b.parts.filter((q) => q.cut || q.gone).length;
    const st = b.state === "dead" ? "💀 Dead" : b.state === "ko" ? "💫 Knocked out" : burning ? "🔥 ON FIRE" : b.blood < 60 || b.pain > 0.4 ? "🤕 Hurt" : "🙂 OK";
    t = `<b>${b.name}</b> · ${st}<br><code>Blood [${bar(b.blood / 100)}] ${Math.round(b.blood)}%</code>` + (b.state !== "dead" ? `<br><code>Awake [${bar(1 - Math.min(1, b.shock / 100))}]</code>` : "") + (lost ? `<br>Missing ${lost} part${lost > 1 ? "s" : ""}` : "");
  } else if (b && b.def) t = `<b>${b.def.name}</b>${b.def.usable ? " · double-tap = USE" + (b.on !== undefined ? (b.on ? " (ON)" : " (OFF)") : "") : ""}`;
  if (t !== infoTxt) { infoTxt = t; $("info").innerHTML = t; $("info").classList.toggle("hidden", !t); }
}

// ---------------------------------------------------------------- render
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#07060c"; ctx.fillRect(0, 0, cv.width, cv.height);
  const sx = W.shake ? rnd(-W.shake, W.shake) * SC : 0, sy = W.shake ? rnd(-W.shake, W.shake) * SC : 0;
  ctx.setTransform(SC, 0, 0, SC, OX + sx, OY + sy);
  if (cam) { ctx.translate(WW / 2, WH / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); } // (test zoom only)
  ctx.drawImage(bg, 0, 0, WW, WH);
  ctx.drawImage(decal, 0, 0);
  drawPools(ctx);
  for (const pass of [0, 1, 2]) for (const b of W.bodies) { const k = b.static ? 0 : b.kind === "rag" ? 2 : 1; if (k === pass) drawBody(ctx, b); }
  drawChunks(ctx); drawFlames(ctx); drawDrops(ctx); drawFx(ctx); drawTexts(ctx);
  if (W.grab) {
    const g = W.grab, p = g.rigid ? null : g.p;
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    if (p) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(g.tx, g.ty); ctx.stroke(); }
    ctx.setLineDash([]); ctx.beginPath(); ctx.arc(g.tx, g.ty, 7, 0, 6.283); ctx.stroke();
  } else if (spawnDef && mouse.in && tool === "drag") { ctx.globalAlpha = 0.5; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 12, 0, 6.283); ctx.moveTo(mouse.x - 6, mouse.y); ctx.lineTo(mouse.x + 6, mouse.y); ctx.moveTo(mouse.x, mouse.y - 6); ctx.lineTo(mouse.x, mouse.y + 6); ctx.stroke(); ctx.globalAlpha = 1; }
  if (thumbTitle) {
    ctx.setTransform(SC, 0, 0, SC, OX, OY); ctx.textAlign = "center"; ctx.lineJoin = "round";
    ctx.font = "900 150px 'Russo One', sans-serif"; ctx.lineWidth = 22; ctx.strokeStyle = OUT; ctx.strokeText("SPLAT LAB", WW / 2, 190); ctx.fillStyle = "#7a0f22"; ctx.fillText("SPLAT LAB", WW / 2, 202); ctx.fillStyle = "#fff"; ctx.fillText("SPLAT LAB", WW / 2, 190);
    ctx.font = "800 44px Inter, sans-serif"; ctx.lineWidth = 10; ctx.strokeText("ragdoll physics sandbox", WW / 2, 262); ctx.fillStyle = "#ffd23f"; ctx.fillText("ragdoll physics sandbox", WW / 2, 262);
  }
  if (paused) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, WW, WH); ctx.font = "900 60px 'Russo One', sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.strokeText("PAUSED", WW / 2, 120); ctx.fillStyle = "#fff"; ctx.fillText("PAUSED", WW / 2, 120); }
  else if (slow) { ctx.font = "900 34px 'Russo One', sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.strokeText("SLOW-MO", WW / 2, 100); ctx.fillStyle = "#7df9ff"; ctx.fillText("SLOW-MO", WW / 2, 100); }
}

// ---------------------------------------------------------------- loop
let last = performance.now(), frozen = false, cam = null, thumbTitle = false;
function simulate(dt) {
  const sdt = dt * (slow ? 0.25 : 1), n = Math.max(1, Math.min(6, Math.ceil(sdt / (1 / 170))));
  for (let i = 0; i < n; i++) step(sdt / n);
  frame(sdt);
}
function loop(t) {
  const dt = Math.min(1 / 30, (t - last) / 1000); last = t;
  if (!frozen && !paused && started && dt > 0) simulate(dt);
  render(); updateInfo();
  requestAnimationFrame(loop);
}

W.segs = segsOf(map); resize();
if (Q.has("thumb")) thumb();
requestAnimationFrame(loop);
setTool("drag");

// test hooks (the in-app browser pane slows down requestAnimationFrame, so tests step the game by hand)
window.__splat = { W, ITEM, MAPS, step(n = 1) { for (let i = 0; i < n; i++) simulate(1 / 60); render(); }, spawn: (id, x, y, f = 1) => spawnItem(ITEM[id], x, y, f), use: useBody, setMap: (id) => setMap(MAPS.find((m) => m.id === id)), set frozen(v) { frozen = v; }, set cam(v) { cam = v; render(); }, start() { $("play").click(); }, clear: clearAll };

// ---------------------------------------------------------------- the picture for the game card (?thumb)
function thumb() {
  started = true; $("menu").classList.add("hidden"); $("ui").classList.add("hidden");
  map = MAPS[0]; W.segs = segsOf(map); drawBg();
  const S = (id, x, y, f) => spawnItem(ITEM[id], x, y, f);
  S("spikes", 560, 800, 1); S("saw", 1010, 690, 1);
  S("buddy", 560, 520, 1); S("brute", 790, 780, -1); S("goo", 1010, 470, -1); S("robo", 1180, 780, -1);
  const gun = S("thumper", 380, 820, 1); gun.ps[1].y -= 22; gun.ps[1].py -= 22;
  for (let i = 0; i < 45; i++) simulate(1 / 60);
  ITEM.thumper.use(gun); explode(860, 836, 0.9);
  for (let i = 0; i < 9; i++) simulate(1 / 60);
  ITEM.thumper.use(gun);
  for (let i = 0; i < 2; i++) simulate(1 / 60);
  cam = { x: 790, y: 640, z: 1.75 }; frozen = true; thumbTitle = true; window.__thumbReady = true;
}
