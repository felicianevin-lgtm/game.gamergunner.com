// MUD VALLEY RP: the stuff drawn on top of the game. Money, speedometer, minimap, the big map, job box, hints and pop-up messages.
import { HALF, PLACES, HOUSES } from "./layout.js";
import { S, money } from "./save.js";

const $ = (id) => document.getElementById(id);
const cache = {};
const setT = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
export const fmtTime = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); };
export const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || "th");

// ---------------------------------------------------------------- pop-ups
export function toast(title, text = "", kind = "", ms = 3200) {
  const el = document.createElement("div"); el.className = "toast " + kind;
  el.innerHTML = `<b></b><span></span>`; el.firstChild.textContent = title; el.lastChild.textContent = text; if (!text) el.lastChild.remove();
  const box = $("toasts"); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 450); }, ms);
}
export function banner(big, small = "") {
  const b = $("banner"); $("bannerBig").textContent = big; $("bannerSmall").textContent = small; $("bannerSmall").style.display = small ? "" : "none";
  b.classList.remove("on"); void b.offsetWidth; b.classList.add("on");
}
export function count(t) { const c = $("count"); c.textContent = t; c.classList.remove("on"); void c.offsetWidth; c.classList.add("on"); }
export function flash(color = "#fff") { const f = $("flash"); f.style.background = color; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }
let lastHints = "";
export function hints(list) {
  const key = list.map((h) => h.key + h.text).join("|");
  if (key === lastHints) return; lastHints = key;
  $("hints").innerHTML = list.map((h) => `<div class="hint ${h.warn ? "warn" : ""} ${h.hot ? "hot" : ""}">${h.key ? `<kbd>${h.key}</kbd>` : ""}<span>${h.text}</span>${h.bar !== undefined ? `<em class="hbar"><i style="width:0%"></i></em>` : ""}</div>`).join("");
}
// the fill of a "hold E" progress bar (updated every frame without rebuilding the hints)
export function holdBar(p) { const i = document.querySelector("#hints .hbar i"); if (i) i.style.width = Math.round(Math.min(1, p) * 100) + "%"; }
export function bumpMoney() { const m = $("money"); m.classList.remove("pop"); void m.offsetWidth; m.classList.add("pop"); }

// ---------------------------------------------------------------- every frame
export function updateHud(g) {
  setT("money", money(S.money));
  setT("vehName", g.vehLabel);
  const mph = Math.round(g.speed * 2.237);
  setT("spdN", String(mph));
  $("spdArc").style.setProperty("--p", Math.min(1, g.speed / Math.max(20, g.topSpeed || 30)).toFixed(3));
  setT("gearN", g.driving ? (g.speed < 0.5 ? "N" : g.reverse ? "R" : "D" + (1 + Math.min(4, Math.floor((g.speed / Math.max(10, g.topSpeed)) * 5)))) : "");
  $("speedo").style.opacity = g.driving ? 1 : 0.35;
  const L = $("spdLim"), lim = g.driving ? g.limit || 0 : 0;
  if (L.dataset.v !== String(lim)) { L.dataset.v = String(lim); L.innerHTML = lim ? "SPEED<br>LIMIT<b>" + lim + "</b>" : ""; L.classList.toggle("on", !!lim); }
  L.classList.toggle("over", !!lim && mph > lim + 3);
  // the job box
  const j = g.job;
  $("jobBox").classList.toggle("hidden", !j);
  if (j) {
    setT("jobTitle", j.T.icon + " " + j.T.name);
    setT("jobGoal", j.goal);
    setT("jobPay", money(j.late ? j.pay / 2 : j.pay));
    setT("jobTime", j.stage > 0 ? "⏱ " + fmtTime(j.time - j.t) : "");
    $("jobTime").classList.toggle("late", !!j.late || (j.stage > 0 && j.time - j.t < 10));
  }
  // wanted stars, loot, cop calls
  const C = g.crime;
  if (C) {
    const show = C.wanted > 0 || C.loot > 0 || S.backpack.length > 0 || C.headStart > 0;
    $("crimeBox").classList.toggle("hidden", !show);
    if (show) {
      setT("stars", "★".repeat(C.wanted) + "☆".repeat(5 - C.wanted));
      $("stars").classList.toggle("flash", C.wanted > 0 && C.evade > 0);
      setT("lootTxt", [C.headStart ? "🏃 RUN! Alarm in " + C.headStart + "s" : "", C.loot ? "💰 Loot " + money(C.loot) + " / " + money(C.cap) : "", S.backpack.length ? "🎒 " + S.backpack.length + " / " + (S.gear.duffel ? 16 : 10) : ""].filter(Boolean).join("  ·  "));
      $("evade").style.display = C.wanted > 0 ? "" : "none";
      $("evade").firstElementChild.style.width = Math.round(C.evade * 100) + "%";
      setT("evadeTxt", C.wanted ? (C.hidden ? "Hiding... " : C.evade > 0 ? "Losing them... " : "SPOTTED! ") : "");
    }
    $("callBox").classList.toggle("hidden", !C.call);
    if (C.call) { setT("callTitle", "📻 " + C.call.what); setT("callGoal", { robbing: "Get there fast!", fleeing: "Stop the getaway car! (bump it, spike strips, stun it)", foot: "Catch the robber! Get close + hold E", ko: "They’re knocked out: hold E to cuff!", giveup: "They gave up: hold E to cuff!", cuffed: "Get in your police car (they hop in the back)", carried: "Drive to the Police Station + press E" }[C.call.state] || ""); }
    // jail
    $("jailUI").classList.toggle("hidden", !C.jail);
    if (C.jail) {
      const j = C.jail; setT("jailT", Math.ceil(j.t) + "s");
      $("jNeedle").style.left = (j.needle * 100).toFixed(1) + "%"; $("jZone").style.left = ((j.zone - 0.09) * 100).toFixed(1) + "%";
      setT("jailWins", "🔓 " + "●".repeat(j.wins) + "○".repeat(3 - j.wins));
    }
  }
  // the fishing reel mini game
  const R = g.reel;
  $("reelUI").classList.toggle("hidden", !R);
  if (R) {
    $("rZone").style.left = ((R.zone - R.width / 2) * 100).toFixed(1) + "%"; $("rZone").style.width = (R.width * 100).toFixed(1) + "%";
    $("rMark").style.left = (R.m * 100).toFixed(1) + "%"; $("rProg").style.width = (R.p * 100).toFixed(1) + "%";
    $("reelUI").classList.toggle("danger", R.m > 0.9);
  }
  setT("itemName", g.item ? "✋ " + g.item : "");
  // race info
  $("raceHud").classList.toggle("hidden", !g.race);
  if (g.race) { const r = g.race; setT("rPos", ordinal(r.place) + "/" + (r.ais.length + 1)); setT("rLap", r.T.closed ? Math.min(r.laps, r.lap + 1) + "/" + r.laps : "SPRINT"); setT("rTime", fmtTime(r.time)); }
  // the arrow that points where to go
  const tg = g.target;
  $("arrow").classList.toggle("hidden", !tg);
  if (tg) {
    const dx = tg.x - g.px, dz = tg.z - g.pz, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz) - g.camYaw; // 0 = straight ahead
    $("arrow").firstElementChild.style.transform = `rotate(${-ang}rad)`;
    setT("arrowD", d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km");
    $("arrow").className = tg.kind || "";
  }
}

// ---------------------------------------------------------------- minimap + big map
let base = null;
export function setMapBase(c) { base = c; }
// the big map can zoom + move: it shows `span` meters around (cx, cz)
export const MAPV = { cx: 0, cz: 0, span: 1500, recenter: true };
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
export function mapPan(cx, cz) { const h = MAPV.span / 2; MAPV.cx = clampN(cx, -HALF + h, HALF - h); MAPV.cz = clampN(cz, -HALF + h, HALF - h); }
export function mapZoom(f, wx = MAPV.cx, wz = MAPV.cz) {
  const s = clampN(MAPV.span * f, 300, HALF * 2), k = s / MAPV.span;
  MAPV.span = s; mapPan(wx + (MAPV.cx - wx) * k, wz + (MAPV.cz - wz) * k);
}
const icons = () => {
  const out = [];
  for (const [id, p] of Object.entries(PLACES)) out.push({ id, x: p.x, z: p.z, icon: p.icon, color: p.color, name: p.name, big: !!p.r });
  for (const h of HOUSES) if (h.id !== "lot") out.push({ x: h.garage.x, z: h.garage.z, icon: "🏠", color: S.houses.includes(h.id) ? "#3ac04a" : "#ff5ad8", name: h.name + (S.houses.includes(h.id) ? " (yours)" : " (for sale)"), big: true });
  return out;
};
let ICONS = null;
// the career's main places glow on the maps: robbers = the Gun Shop, the Tool Barn, the bank + the
// hideout; cops = the Police Station
// (label, which side of the icon it goes on: the Copper Creek shops are close together)
export const HOT = { robber: { blasters: ["GUNS", "up"], gear: ["TOOLS", "left"], bank: ["BANK", "down"], hideout: ["HIDEOUT", "up"], ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => ["pawn" + i, ["PAWN", "up"]])) }, cop: { police: ["POLICE", "up"] } };
const hotOf = (ic) => (ic.id && HOT[S.role] && HOT[S.role][ic.id]) || null;
function glow(g, x, y, r, hot, t, big, labels) {
  // the pulsing gold ring (labels are saved and drawn after all the icons, so nothing covers them)
  if (labels === "label") {
    const label = hot[0], dir = hot[1];
    g.save(); const fs = big ? 14 : 11; g.font = "bold " + fs + "px sans-serif"; const w = g.measureText(label).width + 8, h = fs + 4;
    const cx = dir === "left" ? x - r - 6 - w / 2 : dir === "right" ? x + r + 6 + w / 2 : x, cy = dir === "down" ? y + r + 6 + h / 2 : dir === "up" ? y - r - 6 - h / 2 : y;
    g.fillStyle = "rgba(20,15,10,0.85)"; g.fillRect(cx - w / 2, cy - h / 2, w, h); g.fillStyle = "#ffd23a"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, cx, cy + 1); g.restore();
    return;
  }
  const k = 0.5 + 0.5 * Math.sin(t * 5);
  g.beginPath(); g.arc(x, y, r + 4 + k * 5, 0, 7); g.fillStyle = "rgba(255,210,58," + (0.25 + 0.25 * k) + ")"; g.fill();
  g.beginPath(); g.arc(x, y, r + 3, 0, 7); g.lineWidth = 3; g.strokeStyle = "#ffd23a"; g.stroke();
  if (hot && labels) labels.push([x, y, r, hot, big]);
}
function dot(g, x, y, r, fill, stroke = "#fff", lw = 2) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } }
function arrowShape(g, x, y, a, s, fill) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 0.4); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke(); g.restore(); }
export function drawMini(g) {
  if (!base) return;
  ICONS = ICONS || icons();
  const c = $("mini"), x = c.getContext("2d"), W = c.width, R = W / 2, view = 150; // meters from the middle to the edge
  const k = R / view, bk = base.width / (HALF * 2);
  const fx = Math.sin(g.camYaw), fz = Math.cos(g.camYaw), a = Math.atan2(-fx, -fz);
  x.save(); x.fillStyle = "#4a8a3a"; x.fillRect(0, 0, W, W);
  x.translate(R, R); x.rotate(a); x.scale(k / bk, k / bk);
  x.drawImage(base, -(g.px + HALF) * bk, -(g.pz + HALF) * bk);
  x.restore();
  const ca = Math.cos(a), sa = Math.sin(a);
  const toS = (wx, wz) => { const dx = (wx - g.px) * k, dz = (wz - g.pz) * k; return [R + dx * ca - dz * sa, R + dx * sa + dz * ca]; };
  x.font = "15px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  const labels = [];
  for (const ic of ICONS) {
    let [sx, sy] = toS(ic.x, ic.z); const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy);
    const hot = hotOf(ic);
    if (d > R - 10) { if (!ic.big && !hot) continue; sx = R + (dx / d) * (R - 10); sy = R + (dy / d) * (R - 10); }
    if (hot) glow(x, sx, sy, 10, d > R - 30 ? null : hot, performance.now() / 1000, false, labels);
    dot(x, sx, sy, hot ? 11 : 9, ic.color); x.fillText(ic.icon, sx, sy + 1);
  }
  for (const L of labels) glow(x, L[0], L[1], L[2], L[3], 0, L[4], "label");
  x.font = "15px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  for (const v of g.vehicles) { const [sx, sy] = toS(v.x, v.z); if (Math.hypot(sx - R, sy - R) < R - 4) dot(x, sx, sy, 4, "#6ad0ff", "#0a2a4a", 1.5); }
  const blink = Math.floor(performance.now() / 250) % 2;
  for (const v of g.friends || []) { const [sx, sy] = toS(v.x, v.z); if (Math.hypot(sx - R, sy - R) < R - 4) dot(x, sx, sy, 6, "#ffffff", "#ff8a1a", 2.5); }
  for (const v of g.pins || []) { let [sx, sy] = toS(v.x, v.z); const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy); if (d > R - 12) { sx = R + (dx / d) * (R - 12); sy = R + (dy / d) * (R - 12); } x.fillText("📍", sx, sy); }
  for (const v of g.cops || []) { const [sx, sy] = toS(v.x, v.z); if (Math.hypot(sx - R, sy - R) < R - 4) dot(x, sx, sy, 5, blink ? "#ff3a3a" : "#3a6aff", "#fff", 1.5); }
  const tg = g.target;
  if (tg) { let [sx, sy] = toS(tg.x, tg.z); const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy); if (d > R - 12) { sx = R + (dx / d) * (R - 12); sy = R + (dy / d) * (R - 12); } dot(x, sx, sy, 8, tg.kind === "gps" ? "#c86aff" : tg.kind === "race" ? "#6af0ff" : tg.kind === "crime" ? "#ff3a3a" : "#ffd23a", "#000", 2); }
  // you (always in the middle, pointing the way you face)
  arrowShape(x, R, R, -((g.pyaw || 0) - g.camYaw), 9, "#ff3a3a");
  const n = $("miniN");
  n.style.left = (R + Math.sin(a) * (R - 13)) * (c.clientWidth / W) + "px"; n.style.top = (R - Math.cos(a) * (R - 13)) * (c.clientWidth / W) - 8 + "px"; n.style.transform = "translateX(-50%)";
}
export function drawBigMap(g) {
  const c = $("bigMap"), x = c.getContext("2d"), W = c.width;
  if (MAPV.recenter) { MAPV.recenter = false; mapPan(g.px, g.pz); }
  const s = MAPV.span, x0 = MAPV.cx - s / 2, z0 = MAPV.cz - s / 2, k = W / s, bk = base.width / (HALF * 2);
  x.fillStyle = "#4a8a3a"; x.fillRect(0, 0, W, W);
  x.drawImage(base, (x0 + HALF) * bk, (z0 + HALF) * bk, s * bk, s * bk, 0, 0, W, W);
  const toS = (wx, wz) => [(wx - x0) * k, (wz - z0) * k];
  ICONS = icons();
  x.font = "18px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  for (const v of g.vehicles) { const [sx, sy] = toS(v.x, v.z); dot(x, sx, sy, 5, "#6ad0ff", "#0a2a4a", 2); }
  for (const t of g.trailerDots) { const [sx, sy] = toS(t.x, t.z); x.fillStyle = "#ffd23a"; x.fillRect(sx - 4, sy - 4, 8, 8); }
  const labels = [];
  for (const ic of ICONS) { const [sx, sy] = toS(ic.x, ic.z), hot = hotOf(ic); if (hot) glow(x, sx, sy, 16, hot, performance.now() / 1000, true, labels); dot(x, sx, sy, hot ? 16 : 13, ic.color, "#fff", 2.5); x.fillText(ic.icon, sx, sy + 1); }
  for (const L of labels) glow(x, L[0], L[1], L[2], L[3], 0, L[4], "label");
  x.font = "18px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  for (const v of g.cops || []) { const [sx, sy] = toS(v.x, v.z); dot(x, sx, sy, 6, "#3a6aff", "#ff3a3a", 2); }
  x.font = "bold 13px sans-serif";
  for (const v of g.friends || []) { const [sx, sy] = toS(v.x, v.z); dot(x, sx, sy, 7, "#ffffff", "#ff8a1a", 3); x.fillStyle = "#fff"; x.fillText(v.n, sx, sy - 14); }
  x.font = "22px sans-serif"; for (const v of g.pins || []) { const [sx, sy] = toS(v.x, v.z); x.fillText("📍", sx, sy - 6); x.font = "bold 12px sans-serif"; x.fillStyle = "#fff"; x.fillText(v.name, sx, sy + 12); x.font = "22px sans-serif"; }
  x.font = "18px sans-serif";
  if (g.target) { const [sx, sy] = toS(g.target.x, g.target.z); dot(x, sx, sy, 10, g.target.kind === "gps" ? "#c86aff" : g.target.kind === "crime" ? "#ff3a3a" : "#ffd23a", "#000", 3); x.font = "bold 14px sans-serif"; x.fillStyle = "#fff"; x.fillText("★", sx, sy + 1); x.font = "18px sans-serif"; }
  const [px, py] = toS(g.px, g.pz); arrowShape(x, px, py, Math.PI - (g.pyaw || 0), 12, "#ff3a3a");
  $("mapLegend").innerHTML = ICONS.filter((i, n, a) => a.findIndex((o) => o.name === i.name) === n).map((i) => `<span>${i.icon} ${i.name}</span>`).join("") + `<span>🔵 your rides</span><span>🟨 trailers</span><span>🚓 cops</span><span>💰 pawn shops (sell your backpack stuff)</span>`;
}
// big map click → world spot
export function mapToWorld(e) { const c = $("bigMap"), r = c.getBoundingClientRect(), s = MAPV.span; return { x: MAPV.cx - s / 2 + ((e.clientX - r.left) / r.width) * s, z: MAPV.cz - s / 2 + ((e.clientY - r.top) / r.height) * s }; }
export function nearestIcon(x, z, max = 25) { let b = null, bd = max; for (const i of ICONS || icons()) { const d = Math.hypot(i.x - x, i.z - z); if (d < bd) { bd = d; b = i; } } return b; }
