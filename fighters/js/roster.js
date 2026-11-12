// BONK BRAWLERS fighters: who they are, their special moves, and how to draw them (all cartoon shapes drawn in code).
// A fighter is a little puppet: hip, two legs, a body, a big head and two arms. A "pose" says the angle of every limb
// (angles start pointing straight down; bigger numbers swing the limb forward, PI = straight up).

export const ROSTER = [
  {
    id: "rex", name: "REX RUMBLE", tag: "A kid in a dino suit who never takes it off", kind: "rex",
    scale: 1.05, speed: 3.3, jump: 15.5, power: 1.08, hp: 1050, limbW: 14,
    look: { skin: "#f4c49c", shirt: "#3cb54a", shirt2: "#23772e", belly: "#ffe27a", pants: "#2c8a39", shoes: "#1d5a25", hand: "#3cb54a", eye: "#3a2410" },
    specials: {
      proj: { name: "Roar Wave", shape: "ring", speed: 6.5, dmg: 65, size: 1, color: "#9dff8a" },
      fwd: { name: "Tail Spin", pose: "spin", vx: 6, dur: 24, dmg: 35, hits: 3 },
      rise: { name: "Dino Stomp", pose: "stomp", vy: -14, vx: 3.5, dmg: 100, hits: 1 },
    },
    super: { name: "METEOR ROAR", type: "proj", shape: "ring", size: 2.4, speed: 7, dmg: 60, hits: 5, color: "#c4ff5a" },
  },
  {
    id: "penny", name: "PIXEL PENNY", tag: "Robot girl with rocket boots", kind: "penny",
    scale: 0.95, speed: 3.7, jump: 16.5, power: 0.95, hp: 950, limbW: 12,
    look: { skin: "#cfd8e3", shirt: "#22c3e6", shirt2: "#1286a3", pants: "#8a97a8", shoes: "#3c4656", hand: "#aab6c6", eye: "#00f0ff" },
    specials: {
      proj: { name: "Byte Blaster", shape: "pixel", speed: 9, dmg: 55, size: 1, color: "#3df5ff" },
      fwd: { name: "Rocket Boots", pose: "rocket", vx: 10, dur: 18, dmg: 80, hits: 1, knock: true },
      rise: { name: "Spring Coil", pose: "rise", vy: -16, vx: 2, dmg: 110, hits: 1 },
    },
    super: { name: "MEGA LASER", type: "proj", shape: "laser", size: 2, speed: 16, dmg: 55, hits: 6, color: "#3df5ff" },
  },
  {
    id: "chef", name: "CHEF CHOMPERS", tag: "Big chef, bigger frying pan", kind: "chef",
    scale: 1.12, speed: 2.9, jump: 14.5, power: 1.15, hp: 1100, limbW: 15, torsoW: 1.3,
    look: { skin: "#f6c7a6", shirt: "#ffffff", shirt2: "#d9dde3", pants: "#555c66", shoes: "#2a2a2a", hand: "#f6c7a6", eye: "#2a1a10", scarf: "#e63946" },
    specials: {
      proj: { name: "Meatball Toss", shape: "meatball", speed: 6, vy: -7, g: 0.32, dmg: 75, size: 1, color: "#8b4a2b" },
      fwd: { name: "Pan Slam", pose: "pan", vx: 4, dur: 14, dmg: 110, hits: 1, knock: true, type: "over" },
      rise: { name: "Pizza Spin", pose: "twirl", vy: -12, vx: 2, dmg: 40, hits: 3 },
    },
    super: { name: "GIANT PIZZA", type: "proj", shape: "pizza", size: 2.4, speed: 6, dmg: 60, hits: 5, color: "#ffb703" },
  },
  {
    id: "ninja", name: "NOODLE NINJA", tag: "Super fast, loves noodles", kind: "ninja",
    scale: 0.98, speed: 4.0, jump: 17, power: 0.95, hp: 950, limbW: 12,
    look: { skin: "#f1c27d", shirt: "#5b3a9e", shirt2: "#3d2570", pants: "#4a2e86", shoes: "#24163f", hand: "#3d2570", eye: "#1a1030", band: "#ff4d6d" },
    specials: {
      proj: { name: "Star Toss", shape: "star", speed: 11, dmg: 50, size: 1, color: "#d8d2ff" },
      fwd: { name: "Shadow Slide", pose: "slide", vx: 11, dur: 16, dmg: 70, hits: 1, knock: true, type: "low" },
      rise: { name: "Leaf Flip", pose: "flip", vy: -15, vx: 3, dmg: 100, hits: 1 },
    },
    super: { name: "HUNDRED SHADOWS", type: "rush", pose: "rush", vx: 8, dur: 42, dmg: 45, hits: 6 },
  },
  {
    id: "granny", name: "GRANNY GALE", tag: "Sweet grandma, stormy umbrella", kind: "granny",
    scale: 0.92, speed: 3.5, jump: 15, power: 1.0, hp: 1000, limbW: 12,
    look: { skin: "#f5d0b5", shirt: "#ff8fb1", shirt2: "#d9628a", skirt: "#9b7fd6", pants: "#f0e6dc", shoes: "#6b3e2e", hand: "#f5d0b5", eye: "#2a1a10", hair: "#e9e9f2" },
    specials: {
      proj: { name: "Grumpy Gust", shape: "gust", speed: 5, dmg: 65, size: 1.2, color: "#cfefff" },
      fwd: { name: "Umbrella Poke", pose: "poke", vx: 7, dur: 14, dmg: 85, hits: 1 },
      rise: { name: "Twirl Lift", pose: "twirl", vy: -13, vx: 1.5, dmg: 40, hits: 3 },
    },
    super: { name: "TEA-TIME TORNADO", type: "proj", shape: "tornado", size: 2, speed: 4, dmg: 50, hits: 7, color: "#cfefff" },
  },
  {
    id: "bob", name: "BOULDER BOB", tag: "A slow, friendly, VERY hard rock", kind: "bob",
    scale: 1.18, speed: 2.6, jump: 13.5, power: 1.25, hp: 1200, limbW: 20, torsoW: 1.35,
    look: { skin: "#9a8f84", shirt: "#8a7f74", shirt2: "#6c625a", pants: "#7a7066", shoes: "#5a5149", hand: "#a59a8e", eye: "#ffb020", moss: "#6fbf4a" },
    specials: {
      proj: { name: "Pebble Shot", shape: "pebble", speed: 8, dmg: 60, size: 1, color: "#9a8f84" },
      fwd: { name: "Rolling Rock", pose: "roll", vx: 8, dur: 26, dmg: 45, hits: 3 },
      rise: { name: "Quake Jump", pose: "stomp", vy: -12, vx: 3, dmg: 110, hits: 1 },
    },
    super: { name: "AVALANCHE ROLL", type: "rush", pose: "roll", vx: 10, dur: 50, dmg: 50, hits: 6 },
  },
];

// ---------------------------------------------------------------- poses
const P = (lean, legF, legB, armF, armB, extra) => Object.assign({ lean, legF, legB, armF, armB, rot: 0, air: 0, lie: 0, spin: 0, bob: 0 }, extra || {});
const IDLE = (t) => P(0.08, [0.3, 0.35], [-0.25, 0.3], [0.7, 1.9], [0.3, 2.2], { bob: Math.sin(t * 0.12) * 1.6 });
const CROUCH = () => P(0.25, [1.35, 2.3], [0.8, 2.2], [1.0, 1.6], [0.6, 2.0]);
const AIR = () => P(0.1, [1.1, 1.9], [0.3, 1.5], [1.3, 1.2], [0.9, 1.6], { air: 1 });
const LIE = () => P(0, [0.15, 0.1], [-0.1, 0.15], [2.9, 0.2], [2.5, 0.3], { lie: 1 });

// the pose a fighter wants right now (main.js blends toward it so moves look smooth)
export function poseFor(f, t) {
  const st = f.state;
  switch (st) {
    case "walk": {
      const w = f.walkT * 0.22, p = IDLE(t);
      p.legF = [0.3 + Math.sin(w) * 0.45, 0.35 + Math.max(0, Math.cos(w)) * 0.6];
      p.legB = [-0.25 - Math.sin(w) * 0.45, 0.3 + Math.max(0, -Math.cos(w)) * 0.6];
      p.bob = Math.abs(Math.sin(w)) * -2; return p;
    }
    case "crouch": return CROUCH();
    case "jumpsquat": case "land": case "getup": return P(0.15, [0.9, 1.6], [0.5, 1.5], [0.9, 1.7], [0.5, 2.0]);
    case "air": return AIR();
    case "block": return f.crouching ? Object.assign(CROUCH(), { armF: [1.9, 2.6], armB: [1.7, 2.7], lean: 0.1 }) : P(-0.05, [0.25, 0.3], [-0.35, 0.3], [1.9, 2.6], [1.7, 2.7]);
    case "hit": return f.crouching ? Object.assign(CROUCH(), { lean: -0.3, armF: [-0.2, 0.6], armB: [-0.5, 0.5] }) : P(-0.45, [0.15, 0.2], [-0.4, 0.3], [-0.3, 0.6], [-0.6, 0.5]);
    case "fall": case "ko": if (f.grounded && f.st > 0) return LIE(); return P(-0.4, [0.8, 0.4], [0.3, 0.3], [2.6, 0.3], [2.2, 0.4], { air: 1, rot: -0.7 });
    case "down": return LIE();
    case "win": return P(0, [0.35, 0.2], [-0.35, 0.2], [3.0, 0.15], [0.5, 2.3], { bob: Math.abs(Math.sin(t * 0.15)) * -6 });
    case "sad": return P(0.35, [0.2, 0.2], [-0.2, 0.2], [0.1, 0.2], [-0.1, 0.2]);
    case "attack": return f.move ? attackPose(f, t) : IDLE(t);
  }
  return IDLE(t);
}

function attackPose(f, t) {
  const m = f.move, start = f.phase === "start";
  switch (m.pose) {
    case "jab": return start ? P(0.1, [0.35, 0.3], [-0.35, 0.3], [0.9, 2.2], [0.3, 2.2]) : P(0.22, [0.45, 0.3], [-0.4, 0.3], [1.62, 0.0], [0.4, 2.2]);
    case "kick": return start ? P(-0.1, [1.0, 1.8], [-0.2, 0.3], [0.8, 1.8], [0.3, 1.8]) : P(-0.3, [1.75, 0.05], [-0.15, 0.15], [0.9, 1.7], [0.2, 1.8]);
    case "cjab": return Object.assign(CROUCH(), start ? { armF: [0.9, 2.0] } : { armF: [1.55, 0], lean: 0.35 });
    case "sweep": return start ? CROUCH() : P(0.4, [1.5, 0.0], [0.9, 2.4], [0.6, 1.3], [-0.4, 1.0]);
    case "jpunch": return Object.assign(AIR(), start ? { armF: [0.8, 2.0] } : { armF: [1.25, 0], lean: 0.3 });
    case "jkick": return Object.assign(AIR(), start ? { legF: [0.9, 2.0] } : { legF: [1.25, 0.05], legB: [0.3, 1.6], lean: -0.1 });
    case "throw": return start ? P(-0.15, [0.4, 0.3], [-0.4, 0.3], [0.3, 1.0], [0.2, 1.0]) : P(0.25, [0.5, 0.3], [-0.45, 0.3], [1.6, 0.05], [1.5, 0.1]);
    case "rocket": return start ? CROUCH() : P(-0.35, [1.6, 0], [0.5, 1.4], [-0.6, 0.4], [-0.8, 0.4], { air: 1 });
    case "spin": return start ? CROUCH() : P(0.1, [0.4, 0.3], [-0.4, 0.3], [1.57, 0], [1.57, 0], { spin: 1 });
    case "twirl": return start ? CROUCH() : P(0, [0.3, 0.3], [-0.3, 0.3], [2.4, 0.1], [2.4, 0.1], { spin: 1, air: f.grounded ? 0 : 1 });
    case "slide": return start ? CROUCH() : P(0.4, [1.5, 0.0], [0.9, 2.4], [0.4, 1.0], [-0.6, 0.6]);
    case "roll": return start ? CROUCH() : P(0.6, [2.0, 2.8], [1.8, 2.8], [2.2, 2.6], [2.0, 2.6], { air: 1, rot: t * 0.45, ball: 1 });
    case "poke": return start ? P(-0.1, [0.4, 0.3], [-0.4, 0.3], [0.6, 1.8], [0.3, 2.0], { item: "umbrella" }) : P(0.3, [0.6, 0.2], [-0.5, 0.2], [1.57, 0], [0.3, 2.0], { item: "umbrella" });
    case "pan": return start ? P(-0.25, [0.4, 0.3], [-0.4, 0.3], [3.0, 0.4], [0.3, 2.0], { item: "pan" }) : P(0.35, [0.6, 0.3], [-0.5, 0.3], [1.35, 0], [0.3, 2.0], { item: "pan" });
    case "rise": return start ? CROUCH() : P(0.1, [0.9, 1.6], [0.2, 0.9], [3.0, 0.1], [0.6, 1.8], { air: 1 });
    case "stomp": return start ? CROUCH() : (f.vy < 0 ? P(0.1, [0.9, 1.6], [0.2, 0.9], [3.0, 0.1], [2.8, 0.2], { air: 1 }) : P(0, [0.1, 0.1], [-0.1, 0.1], [2.5, 0.5], [2.3, 0.5], { air: 1 }));
    case "flip": return start ? CROUCH() : P(0.1, [1.6, 0.1], [0.4, 1.5], [2.2, 0.4], [1.8, 0.4], { air: 1, rot: -Math.min(Math.PI * 2, (f.moveT - m.startup) * 0.4) });
    case "rush": { const a = (f.moveT >> 2) & 1; return start ? CROUCH() : P(0.3, [0.6, 0.3], [-0.5, 0.3], a ? [1.6, 0] : [0.8, 2.0], a ? [0.6, 2.0] : [1.6, 0], { blur: 1 }); }
  }
  return IDLE(t);
}

export function blendPose(cur, tgt, k) {
  if (!cur) return JSON.parse(JSON.stringify(tgt));
  const L = (a, b) => a + (b - a) * k;
  cur.lean = L(cur.lean, tgt.lean); cur.bob = L(cur.bob, tgt.bob); cur.air = tgt.air; cur.lie = tgt.lie; cur.spin = tgt.spin; cur.item = tgt.item; cur.ball = tgt.ball; cur.blur = tgt.blur;
  for (const k2 of ["legF", "legB", "armF", "armB"]) { cur[k2][0] = L(cur[k2][0], tgt[k2][0]); cur[k2][1] = L(cur[k2][1], tgt[k2][1]); }
  cur.rot = (tgt.ball || tgt.rot < -1.5 || Math.abs(tgt.rot - cur.rot) > 3) && !tgt.lie ? tgt.rot : L(cur.rot, tgt.rot);
  if (tgt.lie) cur.rot = L(cur.rot, 0);
  return cur;
}

// ---------------------------------------------------------------- drawing
const sin = Math.sin, cos = Math.cos;
function line(ctx, pts, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
}
function circ(ctx, x, y, r, col, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (col) { ctx.fillStyle = col; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); } }
function shade(hex, k) { // darker / lighter version of a color
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return "#" + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}

// f: { def, x, y, face, pose, mood, flash, alt }
export function drawFighter(ctx, f, t) {
  if (!f.pose) return;
  const d = f.def, L = d.look, k = d.scale, p = f.pose, kind = d.kind;
  const TH = 30 * k, SH = 30 * k, TO = 44 * k, UA = 23 * k, FA = 23 * k, HR = 25 * k, LW = d.limbW * k, TW = 21 * k * (d.torsoW || 1);
  const leg = (a, b) => { const kx = sin(a) * TH, ky = cos(a) * TH, s = a - b; return [[0, 0], [kx, ky], [kx + sin(s) * SH, ky + cos(s) * SH]]; };
  const lf = leg(p.legF[0], p.legF[1]), lb = leg(p.legB[0], p.legB[1]);
  let hipY = p.lie ? -20 * k : p.ball ? -36 * k : p.air ? -(TH + SH) * 0.9 : -Math.max(lf[2][1], lb[2][1], 4);
  hipY += p.bob || 0;
  const sh = [sin(p.lean) * TO, -cos(p.lean) * TO];
  const arm = (a, b) => { const ex = sh[0] + sin(a) * UA, ey = sh[1] + cos(a) * UA, s = a + b; return [[sh[0], sh[1]], [ex, ey], [ex + sin(s) * FA, ey + cos(s) * FA]]; };
  const af = arm(p.armF[0], p.armF[1]), ab = arm(p.armB[0], p.armB[1]);
  const head = [sh[0] + sin(p.lean) * HR * 0.85, sh[1] - cos(p.lean) * HR * 0.85 - 4 * k];

  ctx.save();
  ctx.translate(f.x, f.y);
  // shadow on the floor
  if (!f.noShadow) { ctx.save(); ctx.scale(1, 0.25); circ(ctx, 0, (f.floorY - f.y) * 4, 34 * k, "rgba(0,0,0,0.28)"); ctx.restore(); }
  let sx = f.face;
  if (p.spin) sx *= cos(t * 0.6) || 0.01;
  ctx.scale(sx, 1);
  if (f.alt) ctx.filter = "hue-rotate(150deg) saturate(1.2)";
  ctx.translate(0, hipY);
  if (p.lie) ctx.rotate(-Math.PI / 2);
  else ctx.rotate(p.rot || 0);
  if (p.ball) ctx.translate(0, -10 * k);

  const dark = (c) => shade(c, -0.28);
  const limbCol = kind === "penny" ? L.pants : L.pants, armCol = L.shirt;
  // tail / back things
  if (kind === "rex") drawTail(ctx, k, t, L);
  if (kind === "ninja") drawRibbons(ctx, head, HR, k, t, L);
  // back arm + back leg (a bit darker)
  limb(ctx, ab, LW * 0.92, dark(kind === "bob" || kind === "penny" ? L.hand : armCol), dark(L.hand), LW * 0.62, kind);
  limb(ctx, lb, LW, dark(limbCol), dark(L.shoes), LW * 0.7, kind, true);
  // body
  drawTorso(ctx, sh, TW, k, L, kind, p);
  // front leg
  limb(ctx, lf, LW, limbCol, L.shoes, LW * 0.7, kind, true);
  if (kind === "granny") drawSkirt(ctx, k, L, p);
  // head
  drawHead(ctx, head, HR, k, L, kind, f, t);
  // front arm (+ item in hand)
  if (p.item) drawItem(ctx, af, k, p.item);
  limb(ctx, af, LW * 0.92, kind === "bob" || kind === "penny" ? L.hand : armCol, L.hand, LW * 0.62, kind);
  ctx.restore();
  if (f.flash > 0) { // white "got hit" flash
    ctx.save(); ctx.globalAlpha = Math.min(0.7, f.flash * 0.12); ctx.globalCompositeOperation = "lighter"; ctx.translate(f.x, f.y + hipY - 40 * k);
    circ(ctx, 0, 0, 55 * k, "#fff"); ctx.restore();
  }
}

function limb(ctx, pts, w, col, endCol, endR, kind, isLeg) {
  line(ctx, pts, w, col);
  if (kind === "penny") { circ(ctx, pts[1][0], pts[1][1], w * 0.45, "#5b6778"); }
  if (kind === "bob") { circ(ctx, pts[1][0], pts[1][1], w * 0.62, col); }
  const e = pts[2];
  if (isLeg) { // shoe
    ctx.fillStyle = endCol; ctx.beginPath(); ctx.ellipse(e[0] + endR * 0.5, e[1], endR * 1.25, endR * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  } else circ(ctx, e[0], e[1], endR * (kind === "bob" ? 1.45 : 1.15), endCol);
}

function drawTorso(ctx, sh, TW, k, L, kind, p) {
  ctx.save();
  ctx.rotate(p.lean);
  const h = 44 * k + 6 * k;
  ctx.translate(0, -h / 2 + 6 * k);
  ctx.fillStyle = L.shirt;
  if (kind === "bob") {
    ctx.beginPath(); ctx.moveTo(-TW * 1.05, -h * 0.45); ctx.lineTo(-TW * 0.6, -h * 0.62); ctx.lineTo(TW * 0.5, -h * 0.6); ctx.lineTo(TW * 1.08, -h * 0.25); ctx.lineTo(TW * 0.95, h * 0.45); ctx.lineTo(-TW * 0.9, h * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(L.shirt, -0.35); ctx.lineWidth = 2.5 * k; ctx.beginPath(); ctx.moveTo(-TW * 0.3, -h * 0.3); ctx.lineTo(-TW * 0.05, -h * 0.05); ctx.lineTo(-TW * 0.25, h * 0.2); ctx.moveTo(TW * 0.5, h * 0.1); ctx.lineTo(TW * 0.25, h * 0.3); ctx.stroke();
    circ(ctx, -TW * 0.5, -h * 0.5, 7 * k, L.moss); circ(ctx, -TW * 0.2, -h * 0.58, 6 * k, L.moss);
  } else if (kind === "penny") {
    rr(ctx, -TW, -h / 2, TW * 2, h, 10 * k); ctx.fill();
    ctx.fillStyle = L.shirt2; rr(ctx, -TW, h * 0.18, TW * 2, h * 0.32, 6 * k); ctx.fill();
    circ(ctx, TW * 0.25, -h * 0.12, 6 * k, "#fff36b", "#a08a00");
  } else {
    rr(ctx, -TW, -h / 2, TW * 2, h, TW * 0.8); ctx.fill();
    if (kind === "rex") { ctx.fillStyle = L.belly; ctx.beginPath(); ctx.ellipse(TW * 0.35, h * 0.05, TW * 0.55, h * 0.36, 0, 0, Math.PI * 2); ctx.fill(); }
    if (kind === "chef") {
      ctx.fillStyle = L.scarf; ctx.beginPath(); ctx.moveTo(-TW * 0.7, -h * 0.48); ctx.lineTo(TW * 0.8, -h * 0.48); ctx.lineTo(TW * 0.4, -h * 0.18); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) { circ(ctx, TW * 0.15, -h * 0.1 + i * h * 0.2, 2.6 * k, "#9aa3ad"); circ(ctx, TW * 0.6, -h * 0.1 + i * h * 0.2, 2.6 * k, "#9aa3ad"); }
    }
    if (kind === "ninja") { ctx.fillStyle = L.band; ctx.fillRect(-TW, h * 0.15, TW * 2, 7 * k); }
    if (kind === "granny") { ctx.fillStyle = L.shirt2; for (let i = 0; i < 3; i++) circ(ctx, TW * 0.55, -h * 0.25 + i * h * 0.22, 2.6 * k, "#fff"); }
  }
  ctx.restore();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawSkirt(ctx, k, L) {
  ctx.fillStyle = L.skirt; ctx.beginPath(); ctx.moveTo(-18 * k, -8 * k); ctx.lineTo(19 * k, -8 * k); ctx.lineTo(27 * k, 24 * k); ctx.lineTo(-25 * k, 24 * k); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(L.skirt, -0.25); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8 * k, -6 * k); ctx.lineTo(-11 * k, 22 * k); ctx.moveTo(8 * k, -6 * k); ctx.lineTo(11 * k, 22 * k); ctx.stroke();
}
function drawTail(ctx, k, t, L) {
  const w = sin(t * 0.15) * 6 * k;
  ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.moveTo(-6 * k, -18 * k); ctx.quadraticCurveTo(-40 * k, -8 * k + w, -62 * k, 10 * k + w); ctx.quadraticCurveTo(-36 * k, 6 * k, -4 * k, 6 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = L.belly; for (let i = 0; i < 3; i++) { const x = -22 * k - i * 13 * k, y = -10 * k + i * 5 * k + w * i / 3; ctx.beginPath(); ctx.moveTo(x - 5 * k, y); ctx.lineTo(x, y - 9 * k); ctx.lineTo(x + 5 * k, y); ctx.fill(); }
}
function drawRibbons(ctx, head, HR, k, t, L) {
  ctx.strokeStyle = L.band; ctx.lineWidth = 5 * k; ctx.lineCap = "round";
  for (let i = 0; i < 2; i++) {
    const x0 = head[0] - HR * 0.8, y0 = head[1] - HR * 0.3, w = sin(t * 0.25 + i * 1.7) * 8 * k;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 - 22 * k, y0 + w, x0 - 40 * k - i * 6 * k, y0 + 10 * k + i * 8 * k - w); ctx.stroke();
  }
}
function drawItem(ctx, af, k, item) {
  const h = af[2], a = Math.atan2(h[1] - af[1][1], h[0] - af[1][0]);
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(a);
  if (item === "pan") {
    ctx.fillStyle = "#6b4a2b"; ctx.fillRect(0, -4 * k, 30 * k, 8 * k);
    circ(ctx, 48 * k, 0, 22 * k, "#33373d"); circ(ctx, 48 * k, 0, 16 * k, "#4a5058");
  } else {
    ctx.strokeStyle = "#5a3a2a"; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.moveTo(-6 * k, 0); ctx.lineTo(62 * k, 0); ctx.stroke();
    ctx.fillStyle = "#8f5fd6"; ctx.beginPath(); ctx.moveTo(10 * k, -9 * k); ctx.lineTo(58 * k, -2 * k); ctx.lineTo(58 * k, 2 * k); ctx.lineTo(10 * k, 9 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#5a3a2a"; ctx.beginPath(); ctx.arc(-6 * k, 7 * k, 7 * k, -Math.PI / 2, Math.PI, true); ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx, hd, R, k, L, kind, f, t) {
  const [x, y] = hd, mood = f.mood || "normal";
  ctx.save(); ctx.translate(x, y);
  if (kind === "rex") {
    // spikes on the back of the hood
    ctx.fillStyle = L.belly; for (let i = 0; i < 4; i++) { const a = -2.0 - i * 0.42; ctx.beginPath(); ctx.moveTo(cos(a) * R * 0.9 - 5 * k, sin(a) * R * 0.9); ctx.lineTo(cos(a) * R * 1.35, sin(a) * R * 1.35); ctx.lineTo(cos(a) * R * 0.9 + 5 * k, sin(a) * R * 0.9 + 4 * k); ctx.fill(); }
    circ(ctx, 0, 0, R * 1.05, L.shirt);
    circ(ctx, R * 0.28, R * 0.12, R * 0.72, L.skin);
    ctx.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { const a = -2.3 + i * 0.42, cx = R * 0.28 + cos(a) * R * 0.72, cy = R * 0.12 + sin(a) * R * 0.72; ctx.beginPath(); ctx.moveTo(cx - 4 * k, cy); ctx.lineTo(cx, cy + 6 * k); ctx.lineTo(cx + 4 * k, cy); ctx.fill(); }
    face(ctx, R * 0.3, R * 0.15, R * 0.8, k, L, mood, t);
  } else if (kind === "penny") {
    ctx.strokeStyle = "#8a97a8"; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(-R * 0.1, -R * 0.9); ctx.lineTo(-R * 0.2, -R * 1.45); ctx.stroke();
    circ(ctx, -R * 0.2, -R * 1.5, 5 * k, (t >> 4) & 1 ? "#ff5d8f" : "#ff9dbb");
    ctx.fillStyle = L.skin; rr(ctx, -R, -R * 0.95, R * 2, R * 1.9, R * 0.55); ctx.fill();
    ctx.fillStyle = "#16202e"; rr(ctx, -R * 0.45, -R * 0.35, R * 1.35, R * 0.62, R * 0.3); ctx.fill();
    if (mood === "dizzy") { ctx.fillStyle = L.eye; ctx.font = `bold ${14 * k}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("@ @", R * 0.22, -R * 0.04); }
    else if (mood === "ouch") { line(ctx, [[R * -0.1, -R * 0.15], [R * 0.08, -R * 0.05], [R * -0.1, R * 0.05]], 3 * k, L.eye); line(ctx, [[R * 0.6, -R * 0.15], [R * 0.42, -R * 0.05], [R * 0.6, R * 0.05]], 3 * k, L.eye); }
    else { const hh = mood === "mad" ? R * 0.14 : R * 0.26; ctx.fillStyle = L.eye; ctx.fillRect(-R * 0.05, -R * 0.04 - hh / 2, R * 0.2, hh); ctx.fillRect(R * 0.48, -R * 0.04 - hh / 2, R * 0.2, hh); }
    ctx.fillStyle = "#ff9dbb"; circ(ctx, R * 0.75, R * 0.48, 4 * k, "rgba(255,120,170,0.6)");
    line(ctx, mood === "happy" ? [[R * 0.1, R * 0.5], [R * 0.35, R * 0.62], [R * 0.6, R * 0.5]] : [[R * 0.15, R * 0.55], [R * 0.55, R * 0.55]], 2.5 * k, "#5b6778");
  } else if (kind === "bob") {
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.moveTo(-R, -R * 0.2); ctx.lineTo(-R * 0.6, -R * 0.95); ctx.lineTo(R * 0.4, -R * 1.0); ctx.lineTo(R * 1.05, -R * 0.4); ctx.lineTo(R * 0.95, R * 0.7); ctx.lineTo(-R * 0.2, R * 0.95); ctx.lineTo(-R * 0.95, R * 0.55); ctx.closePath(); ctx.fill();
    circ(ctx, -R * 0.2, -R * 0.85, 7 * k, L.moss); circ(ctx, R * 0.2, -R * 0.92, 6 * k, L.moss); circ(ctx, -R * 0.55, -R * 0.7, 5 * k, L.moss);
    ctx.strokeStyle = shade(L.skin, -0.35); ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(-R * 0.7, R * 0.1); ctx.lineTo(-R * 0.4, R * 0.3); ctx.lineTo(-R * 0.5, R * 0.6); ctx.stroke();
    // brow ridge + glowing eyes
    ctx.fillStyle = shade(L.skin, -0.25); ctx.fillRect(-R * 0.15, -R * 0.42, R * 1.15, R * 0.2);
    if (mood === "dizzy") { ctx.fillStyle = L.eye; ctx.font = `bold ${16 * k}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("@ @", R * 0.42, -R * 0.08); }
    else { const g = mood === "ouch" ? 2 * k : 5 * k; ctx.fillStyle = L.eye; ctx.shadowColor = L.eye; ctx.shadowBlur = 8; ctx.fillRect(R * 0.05, -R * 0.15, R * 0.28, g); ctx.fillRect(R * 0.55, -R * 0.15, R * 0.28, g); ctx.shadowBlur = 0; }
    line(ctx, mood === "happy" ? [[R * 0.15, R * 0.4], [R * 0.45, R * 0.55], [R * 0.75, R * 0.4]] : [[R * 0.2, R * 0.48], [R * 0.7, R * 0.45]], 3 * k, shade(L.skin, -0.45));
  } else {
    if (kind === "granny") { circ(ctx, -R * 0.2, -R * 0.1, R * 1.08, L.hair); circ(ctx, -R * 0.35, -R * 1.05, R * 0.45, L.hair); }
    circ(ctx, 0, 0, R, L.skin);
    if (kind === "ninja") {
      ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.arc(0, 0, R * 1.03, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.skin; rr(ctx, -R * 0.2, -R * 0.42, R * 1.2, R * 0.55, R * 0.25); ctx.fill();
      ctx.fillStyle = L.band; ctx.fillRect(-R * 1.0, -R * 0.72, R * 2.0, R * 0.26);
      face(ctx, R * 0.42, -R * 0.15, R * 0.75, k, L, mood, t, true);
    } else {
      if (kind === "granny") { circ(ctx, -R * 0.15, -R * 0.62, R * 0.55, L.hair); }
      face(ctx, R * 0.35, 0, R, k, L, mood, t);
      if (kind === "granny") { // round glasses
        ctx.strokeStyle = "#7a5a2a"; ctx.lineWidth = 2 * k; circ(ctx, R * 0.08, -R * 0.1, R * 0.22, null, "#7a5a2a"); circ(ctx, R * 0.62, -R * 0.1, R * 0.22, null, "#7a5a2a");
        ctx.beginPath(); ctx.moveTo(R * 0.3, -R * 0.1); ctx.lineTo(R * 0.4, -R * 0.1); ctx.stroke();
      }
      if (kind === "chef") { // mustache + tall hat
        ctx.fillStyle = "#5a3a22"; ctx.beginPath(); ctx.ellipse(R * 0.2, R * 0.3, R * 0.28, R * 0.12, -0.2, 0, Math.PI * 2); ctx.ellipse(R * 0.62, R * 0.3, R * 0.28, R * 0.12, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillRect(-R * 0.8, -R * 1.25, R * 1.6, R * 0.5);
        circ(ctx, -R * 0.55, -R * 1.45, R * 0.45, "#fff"); circ(ctx, 0, -R * 1.65, R * 0.55, "#fff"); circ(ctx, R * 0.55, -R * 1.45, R * 0.45, "#fff");
        ctx.strokeStyle = "#e3e7ec"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 0.8); ctx.lineTo(-R * 0.3, -R * 1.3); ctx.moveTo(R * 0.3, -R * 0.8); ctx.lineTo(R * 0.3, -R * 1.3); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// eyes, brows, mouth for the "skin" faces
function face(ctx, cx, cy, R, k, L, mood, t, noMouth) {
  const ex1 = cx - R * 0.27, ex2 = cx + R * 0.27, ey = cy - R * 0.1, er = R * 0.17;
  if (mood === "dizzy") {
    for (const ex of [ex1, ex2]) { ctx.strokeStyle = L.eye; ctx.lineWidth = 2 * k; ctx.beginPath(); for (let a = 0; a < 12; a += 0.4) { const r = a * er / 12 * 1.2; ctx.lineTo(ex + cos(a + t * 0.3) * r, ey + sin(a + t * 0.3) * r); } ctx.stroke(); }
  } else if (mood === "ouch") {
    line(ctx, [[ex1 - er, ey - er * 0.8], [ex1 + er * 0.6, ey], [ex1 - er, ey + er * 0.8]], 2.6 * k, L.eye);
    line(ctx, [[ex2 + er, ey - er * 0.8], [ex2 - er * 0.6, ey], [ex2 + er, ey + er * 0.8]], 2.6 * k, L.eye);
  } else {
    const blink = (Math.floor(t / 6) % 40) === 0;
    for (const ex of [ex1, ex2]) {
      if (blink) { line(ctx, [[ex - er, ey], [ex + er, ey]], 2.5 * k, L.eye); continue; }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 1.25, 0, 0, Math.PI * 2); ctx.fill();
      circ(ctx, ex + er * 0.35, ey + er * 0.1, er * 0.6, L.eye); circ(ctx, ex + er * 0.5, ey - er * 0.2, er * 0.2, "#fff");
    }
    if (mood === "mad") { line(ctx, [[ex1 - er * 1.1, ey - er * 1.9], [ex1 + er * 1.1, ey - er * 1.2]], 3 * k, "#3a2410"); line(ctx, [[ex2 - er * 1.1, ey - er * 1.2], [ex2 + er * 1.1, ey - er * 1.9]], 3 * k, "#3a2410"); }
  }
  if (noMouth) return;
  const my = cy + R * 0.45;
  if (mood === "ouch" || mood === "dizzy") { circ(ctx, cx, my, R * 0.12, "#7a2e2e"); }
  else if (mood === "happy") { ctx.fillStyle = "#7a2e2e"; ctx.beginPath(); ctx.arc(cx, my - R * 0.05, R * 0.22, 0, Math.PI); ctx.fill(); }
  else if (mood === "mad") { line(ctx, [[cx - R * 0.18, my], [cx + R * 0.18, my - R * 0.04]], 2.6 * k, "#7a2e2e"); }
  else { ctx.strokeStyle = "#7a2e2e"; ctx.lineWidth = 2.4 * k; ctx.beginPath(); ctx.arc(cx, my - R * 0.12, R * 0.17, 0.3, Math.PI - 0.3); ctx.stroke(); }
  circ(ctx, cx + R * 0.5, cy + R * 0.25, R * 0.12, "rgba(255,110,110,0.35)");
}

// ---------------------------------------------------------------- projectiles
export function drawProj(ctx, p, t) {
  const s = p.size, c = p.color;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.dir, 1);
  switch (p.shape) {
    case "ring":
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = c; ctx.globalAlpha = 1 - i * 0.28; ctx.lineWidth = (7 - i * 1.5) * s; ctx.beginPath(); ctx.arc(-i * 14 * s, 0, (22 + i * 4) * s, -1.0, 1.0); ctx.stroke(); }
      break;
    case "pixel":
      ctx.rotate(t * 0.2);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? "#ffffff" : c; const a = i * 1.26; ctx.fillRect(cos(a) * 10 * s - 6 * s, sin(a) * 10 * s - 6 * s, 12 * s, 12 * s); }
      ctx.fillStyle = c; ctx.fillRect(-8 * s, -8 * s, 16 * s, 16 * s);
      break;
    case "laser": {
      const len = 160 * s, g = ctx.createLinearGradient(-len, 0, 30, 0); g.addColorStop(0, "rgba(61,245,255,0)"); g.addColorStop(1, c);
      ctx.fillStyle = g; rr(ctx, -len, -16 * s, len + 30 * s, 32 * s, 16 * s); ctx.fill();
      ctx.fillStyle = "#fff"; rr(ctx, -len * 0.8, -6 * s, len * 0.8 + 24 * s, 12 * s, 6 * s); ctx.fill();
      break;
    }
    case "meatball":
      ctx.rotate(t * 0.3); circ(ctx, 0, 0, 13 * s, c); circ(ctx, -4 * s, -4 * s, 4 * s, "#b5683f"); circ(ctx, 5 * s, 3 * s, 3 * s, "#5c2f1a"); circ(ctx, 3 * s, -7 * s, 2 * s, "#3fa34d");
      break;
    case "pizza":
      ctx.rotate(t * 0.25); circ(ctx, 0, 0, 30 * s, "#e9a23b"); circ(ctx, 0, 0, 25 * s, "#ffd166");
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4; circ(ctx, cos(a) * 15 * s, sin(a) * 15 * s, 5 * s, "#e63946"); }
      ctx.strokeStyle = "#e9a23b"; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-cos(i * 1.05) * 25 * s, -sin(i * 1.05) * 25 * s); ctx.lineTo(cos(i * 1.05) * 25 * s, sin(i * 1.05) * 25 * s); ctx.stroke(); }
      break;
    case "star":
      ctx.rotate(t * 0.5); ctx.fillStyle = c; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 * s : 15 * s, a = i * Math.PI / 4; ctx.lineTo(cos(a) * r, sin(a) * r); }
      ctx.closePath(); ctx.fill(); circ(ctx, 0, 0, 3 * s, "#5b3a9e");
      break;
    case "gust": case "tornado":
      ctx.strokeStyle = c; ctx.lineCap = "round";
      if (p.shape === "tornado") {
        for (let i = 0; i < 7; i++) { const y = -60 * s + i * 17 * s, w = (8 + i * 4) * s; ctx.lineWidth = 5; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(sin(t * 0.3 + i) * 6, y, w, 6 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = "#ff8fb1"; circ(ctx, sin(t * 0.3) * 20 * s, -30 * s, 5 * s, "#fff"); // (a teacup flying around!)
      } else {
        for (let i = 0; i < 3; i++) { ctx.lineWidth = 5 - i; ctx.globalAlpha = 0.9 - i * 0.2; ctx.beginPath(); ctx.arc(-i * 12 * s, (i - 1) * 9 * s, 14 * s, t * 0.3 + i, t * 0.3 + i + 4.2); ctx.stroke(); }
      }
      break;
    case "pebble":
      for (let i = 0; i < 3; i++) { const y = (i - 1) * 9 * s + sin(t * 0.4 + i) * 2, x = -i * 10 * s; ctx.fillStyle = i === 1 ? "#7d736a" : c; ctx.beginPath(); ctx.moveTo(x - 8 * s, y); ctx.lineTo(x - 3 * s, y - 7 * s); ctx.lineTo(x + 7 * s, y - 4 * s); ctx.lineTo(x + 8 * s, y + 4 * s); ctx.lineTo(x - 2 * s, y + 7 * s); ctx.closePath(); ctx.fill(); }
      break;
  }
  ctx.restore();
}

// a little head-and-shoulders picture for the character select
export function drawPortrait(cv, def, alt) {
  const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const f = { def, x: -4, y: 0, face: 1, pose: blendPose(null, IDLE(0)), mood: "normal", noShadow: true, alt, floorY: 0 };
  f.pose.bob = 0; f.pose.armF = [0.9, 1.9];
  const z = h / (def.kind === "chef" ? 135 : 112) / Math.sqrt(def.scale);
  ctx.save(); ctx.translate(w / 2, h + 62 * z * def.scale); ctx.scale(z, z);
  drawFighter(ctx, f, 0); ctx.restore();
}
