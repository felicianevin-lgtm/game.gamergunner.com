// SPLAT LAB drawing: the floppy people (simple cartoon shapes), wounds, blood pools, drops, bits, fire and effects.
import { W, woundPos, attached } from "./sim.js";
export const OUT = "#1b1424";
const SH = {};
export function shade(hex, amt) {
  const key = hex + "|" + amt.toFixed(2); if (SH[key]) return SH[key];
  let h = hex.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return (SH[key] = `rgb(${r | 0},${g | 0},${b | 0})`);
}
export function capsule(ctx, a, b, r, col, outline = true) {
  ctx.lineCap = "round";
  if (outline) { ctx.strokeStyle = OUT; ctx.lineWidth = r * 2 + 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = r * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke();
}
export function disc(ctx, x, y, r, col, outline = true) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
  if (outline) { ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); }
  ctx.fillStyle = col; ctx.fill();
}
// flat rectangle body part from a to b (r = half thickness)
export function slab(ctx, a, b, r, col, outline = true, ext = 0.55) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(dy, dx));
  ctx.beginPath(); ctx.roundRect(-r * ext, -r, len + r * ext * 2, r * 2, Math.min(3, r * 0.45));
  ctx.fillStyle = col; ctx.fill(); if (outline) { ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
const partCol = (L, i) => (i === 0 || i === 4 || i === 6 ? L.skin : i <= 3 || i === 5 ? L.shirt : L.pants);

export function drawPerson(ctx, b) {
  const L = b.look, f = b.face, P = b.parts;
  const back = f > 0 ? [5, 6, 9, 10] : [3, 4, 7, 8], front = f > 0 ? [7, 8, 3, 4] : [9, 10, 5, 6];
  const order = [back[0], back[1], back[2], back[3], 2, 1, front[0], front[1], 0, front[2], front[3]];
  for (const i of order) {
    const q = P[i]; if (q.gone) continue;
    const dark = back.includes(i) ? -0.22 : 0, col = shade(partCol(L, i), dark - q.char * 0.75);
    if (i === 0) drawHead(ctx, b, q, col);
    else {
      const r = i <= 2 ? q.r * 1.05 : q.r;
      if (i === 2) { slab(ctx, q.a, q.b, r, col); const mx = q.a.x + (q.b.x - q.a.x) * 0.62, my = q.a.y + (q.b.y - q.a.y) * 0.62; slab(ctx, { x: mx, y: my }, q.b, r, shade(L.pants, dark - q.char * 0.7), true, 0.7); }
      else slab(ctx, q.a, q.b, r, col);
      if (i === 4 || i === 6) slab(ctx, q.b, { x: q.b.x + (q.b.x - q.a.x) * 0.18, y: q.b.y + (q.b.y - q.a.y) * 0.18 }, q.r * 1.15, shade(L.skin, dark - q.char * 0.75), true, 0.6);
      if (i === 8 || i === 10) { const dx = q.b.x - q.a.x, dy = q.b.y - q.a.y, d = Math.hypot(dx, dy) || 1, fx = -dy / d * f, fy = dx / d * f; slab(ctx, { x: q.b.x - fx * 3, y: q.b.y - fy * 3 }, { x: q.b.x + fx * 9, y: q.b.y + fy * 9 }, q.r * 0.8, shade(L.shoe, dark)); }
      if (b.kindName === "dummy" && (i === 1 || i === 7 || i === 9)) { const mx = (q.a.x + q.b.x) / 2, my = (q.a.y + q.b.y) / 2; dummyMark(ctx, mx, my, q.r * 0.55); }
      if (q.bloody > 0 && b.bc && W.gore) { ctx.globalAlpha = Math.min(0.55, q.bloody * 0.55); slab(ctx, q.a, q.b, r * 0.8, b.bc[1], false); ctx.globalAlpha = 1; }
    }
    for (const w of q.wounds) drawWound(ctx, b, q, w);
  }
}
function dummyMark(ctx, x, y, r) {
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, 0, Math.PI / 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, Math.PI, Math.PI * 1.5); ctx.fill();
}
function drawHead(ctx, b, q, col) {
  const h = q.a, neck = b.ps[1], r = q.r, L = b.look;
  if (attached(b, 0) && !neck.gone) b.headAng = Math.atan2(h.y - neck.y, h.x - neck.x) + Math.PI / 2;
  else b.headAng = (b.headAng || 0) + (h.x - h.px) / r;
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(b.headAng); ctx.scale(b.face, 1);
  ctx.beginPath(); ctx.roundRect(-r, -r, r * 2, r * 2, 4); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  const k = b.kindName, st = b.state, burning = b.parts.some((p) => p.burn > 0), hurt = burning || b.pain > 0.35;
  if (L.hair && L.style) {
    ctx.fillStyle = shade(L.hair, -q.char * 0.7);
    if (L.style === 1) { ctx.fillRect(-r, -r, r * 2, r * 0.6); ctx.fillRect(-r, -r, r * 0.55, r * 1.1); }
    else if (L.style === 2) { ctx.beginPath(); ctx.moveTo(-r, -r * 0.4); for (let i = 0; i <= 4; i++) { ctx.lineTo(-r + (i * r) / 2, -r - (i % 2 ? 0 : 6)); } ctx.lineTo(r, -r * 0.5); ctx.lineTo(-r, -r * 0.4); ctx.fill(); ctx.fillRect(-r, -r, r * 2, r * 0.5); }
    else if (L.style === 3) { ctx.fillRect(-r, -r, r * 2, r * 0.35); }
  }
  if (k === "robo") {
    ctx.fillStyle = OUT; ctx.fillRect(-1, -r - 9, 2, 8); ctx.fillStyle = st === "dead" ? "#555" : "#ff4d4d"; ctx.beginPath(); ctx.arc(0, -r - 10, 2.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = st === "dead" ? "#223" : st === "ko" ? "#356" : "#53f2ff"; ctx.fillRect(1, -6, 11, 6);
    if (st === "dead") { ctx.strokeStyle = "#f55"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(11, -1); ctx.moveTo(2, -1); ctx.lineTo(11, -5); ctx.stroke(); }
    ctx.restore(); return;
  }
  if (k === "dummy") dummyMark(ctx, -4, -1, 4.5);
  if (k === "goo") { ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(-4, -6, 3, 2, -0.5, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = OUT; ctx.fillStyle = OUT; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  const eye = (x, y) => {
    if (st === "dead") { ctx.beginPath(); ctx.moveTo(x - 2.2, y - 2.2); ctx.lineTo(x + 2.2, y + 2.2); ctx.moveTo(x - 2.2, y + 2.2); ctx.lineTo(x + 2.2, y - 2.2); ctx.stroke(); }
    else if (st === "ko" || (b.blink % 4 < 0.12 && !hurt)) { ctx.beginPath(); ctx.moveTo(x - 2.2, y); ctx.lineTo(x + 2.2, y); ctx.stroke(); }
    else if (hurt) { ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 1.5, y); ctx.lineTo(x - 2, y + 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 6.283); ctx.fill(); }
  };
  b.blink = (b.blink || 0) + 1 / 60;
  eye(3, -3); eye(9, -3);
  if (st === "dead") { ctx.beginPath(); ctx.moveTo(3, 6); ctx.lineTo(6, 5); ctx.lineTo(9, 6.5); ctx.stroke(); }
  else if (hurt || st === "ko") { ctx.beginPath(); ctx.ellipse(7, 6, 2.6, hurt ? 3.4 : 1.6, 0, 0, 6.283); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(4, 5.5); ctx.quadraticCurveTo(7, 7.5, 10, 5); ctx.stroke(); }
  ctx.restore();
}
function drawWound(ctx, b, q, w) {
  const [x, y, nx, ny] = woundPos(q, w), s = w.size;
  const dark = b.bc ? (b.bc === undefined ? "#400" : shade(b.bc[1], -0.55)) : b.kindName === "dummy" ? "#5a4630" : "#222";
  if (!W.gore && w.kind !== "bruise") { if (w.kind === "stump") disc(ctx, x, y, q.r * 0.9, "#333", false); return; }
  if (w.kind === "stump") {
    ctx.fillStyle = b.bc ? b.bc[0] : b.kindName === "dummy" ? "#f6f1e4" : "#333"; ctx.beginPath(); ctx.arc(x, y, q.r * 0.95, 0, 6.283); ctx.fill();
    ctx.fillStyle = b.bc ? shade(b.bc[0], -0.35) : "#bbb"; ctx.beginPath(); ctx.arc(x + nx, y + ny, q.r * 0.6, 0, 6.283); ctx.fill();
    ctx.fillStyle = b.kindName === "robo" ? "#ffcf3f" : "#f3ead7"; ctx.beginPath(); ctx.arc(x + nx * 1.5, y + ny * 1.5, q.r * 0.32, 0, 6.283); ctx.fill();
  } else if (w.kind === "hole" || w.kind === "stab") {
    const r = (w.kind === "stab" ? 3.4 : 2.5) * s;
    ctx.fillStyle = b.bc ? b.bc[1] : dark; ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 6.283); ctx.fill();
  } else if (w.kind === "cut") {
    const tx = -ny, ty = nx, l = 6 * s, c = Math.cos(w.ang - 1.5) * 0.5;
    ctx.lineCap = "round"; ctx.strokeStyle = dark; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(x - (tx + nx * c) * l, y - (ty + ny * c) * l); ctx.lineTo(x + (tx + nx * c) * l, y + (ty + ny * c) * l); ctx.stroke();
    ctx.strokeStyle = b.bc ? b.bc[2] : "#f6f1e4"; ctx.lineWidth = 1.2; ctx.stroke();
  } else if (w.kind === "bruise") {
    ctx.fillStyle = "rgba(90,40,120,0.35)"; ctx.beginPath(); ctx.arc(x, y, 4.5 * s, 0, 6.283); ctx.fill();
  }
}

// ---------------------------------------------------------------- blood, bits, fire, effects
export function drawPools(ctx) {
  for (const p of W.pools) {
    const w = p.w, hh = Math.max(1.6, w * 0.045);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
    ctx.fillStyle = shade(p.col, -0.35); ctx.beginPath(); ctx.ellipse(0, 0.5, w / 2 + 1.5, hh + 1, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, hh, 0, 0, 6.283); ctx.fill();
    if (w > 14) { ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.ellipse(-w * 0.15, -hh * 0.35, w * 0.16, hh * 0.3, 0, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
}
export function drawDrops(ctx) {
  ctx.lineCap = "round";
  for (const d of W.drops) {
    ctx.strokeStyle = d.col; ctx.lineWidth = d.s * 1.3;
    ctx.beginPath(); ctx.moveTo(d.x - d.vx * 0.012, d.y - d.vy * 0.012); ctx.lineTo(d.x, d.y + 0.01); ctx.stroke();
  }
}
export function drawChunks(ctx) {
  for (const k of W.chunks) {
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(0, 0, k.r + 1.3, k.r * 0.72 + 1.3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = k.col; ctx.beginPath(); ctx.ellipse(0, 0, k.r, k.r * 0.72, 0, 0, 6.283); ctx.fill();
    if (k.bone) { ctx.fillStyle = "#f3ead7"; ctx.beginPath(); ctx.ellipse(k.r * 0.3, 0, k.r * 0.45, k.r * 0.25, 0, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
}
export function drawFlames(ctx) {
  ctx.globalCompositeOperation = "lighter";
  for (const f of W.flames) {
    const t = f.life / f.max;
    ctx.fillStyle = t > 0.62 ? "rgba(255,230,140," + t * 0.8 + ")" : t > 0.32 ? "rgba(255,150,40," + (t + 0.2) + ")" : "rgba(210,60,20," + t * 1.5 + ")";
    ctx.beginPath(); ctx.arc(f.x, f.y, f.s * (0.45 + t * 0.55), 0, 6.283); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}
export function drawFx(ctx) {
  for (const e of W.fx) {
    const t = e.life / e.max;
    if (e.t === "smoke") { ctx.fillStyle = `rgba(60,56,64,${0.38 * t})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s * (1.6 - t * 0.6), 0, 6.283); ctx.fill(); }
  }
  ctx.globalCompositeOperation = "lighter";
  for (const e of W.fx) {
    const t = e.life / e.max;
    if (e.t === "tracer") { ctx.strokeStyle = `rgba(255,240,170,${t})`; ctx.lineWidth = e.w; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke(); }
    else if (e.t === "flash") { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.fillStyle = `rgba(255,220,120,${t})`; ctx.beginPath(); ctx.moveTo(0, -6 * e.s); ctx.lineTo(22 * e.s, 0); ctx.lineTo(0, 6 * e.s); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(2, 0, 7 * e.s, 0, 6.283); ctx.fill(); ctx.restore(); }
    else if (e.t === "spark") { ctx.strokeStyle = `rgba(255,210,90,${t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - e.vx * 0.025, e.y - e.vy * 0.025); ctx.stroke(); }
    else if (e.t === "boom") { const r = e.r * (1.1 - t * 0.5), g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r); g.addColorStop(0, `rgba(255,255,230,${t})`); g.addColorStop(0.35, `rgba(255,200,80,${t})`); g.addColorStop(0.7, `rgba(255,90,20,${t * 0.6})`); g.addColorStop(1, "rgba(255,60,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 6.283); ctx.fill(); }
    else if (e.t === "ring") { ctx.strokeStyle = `rgba(255,255,255,${t * 0.6})`; ctx.lineWidth = 4 * t; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - t), 0, 6.283); ctx.stroke(); }
  }
  ctx.globalCompositeOperation = "source-over";
}
export function drawTexts(ctx) {
  ctx.textAlign = "center"; ctx.font = "800 18px Inter, sans-serif"; ctx.lineJoin = "round";
  for (const t of W.texts) { ctx.globalAlpha = Math.min(1, t.life * 2); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y); }
  ctx.globalAlpha = 1;
}
