// SPLAT LAB items: everything in the spawn menu. Each item builds a body out of points + sticks, draws itself,
// and can have a "use" (double-tap it, right-click it, or press F / USE while holding it).
import { W, WH, newBody, pt, stick, cap, poly, rigid, center, vel, addVel, shoot, explode, spark, flame, ignite, hurt, sever, gib, gibAll,
  bleedBurst, floorBelow, ceilAbove, spawnPerson, rnd, clamp } from "./sim.js";
import { OUT, shade, capsule, disc, drawPerson } from "./draw.js";
const S = (n, ...a) => W.sfx[n] && W.sfx[n](...a);
const R = Math.random;

export const CATS = [
  { id: "people", name: "People", icon: "🧍" }, { id: "melee", name: "Melee", icon: "🗡️" }, { id: "guns", name: "Blasters", icon: "🔫" },
  { id: "boom", name: "Explosives", icon: "💣" }, { id: "machines", name: "Machines", icon: "⚙️" }, { id: "vehicles", name: "Vehicles", icon: "🚗" },
  { id: "props", name: "Props", icon: "📦" },
];

// ---------------------------------------------------------------- helpers
function localFrame(ctx, a, c, flip = true) {
  const ang = Math.atan2(c.y - a.y, c.x - a.x); ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
  if (flip && Math.cos(ang) < 0) ctx.scale(1, -1);
  return Math.hypot(c.x - a.x, c.y - a.y);
}
function shape(ctx, pts, fill, line = OUT, lw = 2) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.stroke(); } }
function rrect(ctx, x, y, w, h, r, fill, line = OUT) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); if (line) { ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke(); } }
function bloodOn(ctx, b, fn) { if (b.bloody > 0 && W.gore) { ctx.globalAlpha = Math.min(0.75, b.bloody * 0.75); fn(); ctx.globalAlpha = 1; } }
function polyPath(ctx, ps) { ctx.beginPath(); ctx.moveTo(ps[0].x, ps[0].y); for (const p of ps) ctx.lineTo(p.x, p.y); ctx.closePath(); }
function stickItem(def, x, y, len, r, ma, mb, f = 1, o = {}) {
  const b = newBody("obj", def);
  const a = pt(b, x - (f * len) / 2, y, r, ma, { fr: 0.5 }), c = pt(b, x + (f * len) / 2, y, o.rb || r, mb, { fr: 0.5, sharp: o.sharp, point: o.point });
  if (o.sharp) a.sharp = false;
  stick(b, a, c);
  cap(b, a, c, r, { sharp: o.sharp, point: o.point, fr: 0.5 });
  return b;
}
function box(def, x, y, w, h, m, o = {}) {
  const b = newBody("obj", def);
  const ps = [pt(b, x - w / 2, y - h / 2, 3, m), pt(b, x + w / 2, y - h / 2, 3, m), pt(b, x + w / 2, y + h / 2, 3, m), pt(b, x - w / 2, y + h / 2, 3, m)];
  rigid(b, ps); poly(b, ps, { fr: o.fr ?? 0.7 });
  return b;
}
function fuseTick(b, h, power, beepGap) {
  if (!(b.fuse > 0)) return;
  b.fuse -= h; b.beep = (b.beep || 0) - h;
  if (beepGap && b.beep <= 0) { S("beep"); b.beep = Math.max(0.08, Math.min(beepGap, b.fuse * 0.3)); b.blink = 0.08; }
  if (b.fuse <= 0 && !b.kill) { b.kill = true; const [x, y] = center(b); explode(x, y, power, { self: b }); if (b.def.after) b.def.after(b, x, y); }
}
function arm(b, t) { if (!b.kill) b.fuse = b.fuse > 0 ? Math.min(b.fuse, t) : t; }
function firePatch(x, y, life = 6, r = 34) { W.fires.push({ x, y: floorBelow(x, y - 10), life, r }); }
const person = (kind) => (x, y, f, def) => { const fl = floorBelow(x, y - 70); if (y + 58 > fl) y = fl - 58; return spawnPerson(x, y, kind, f, def); };

// ---------------------------------------------------------------- the catalog
export const ITEMS = [
  // PEOPLE
  { id: "buddy", cat: "people", name: "Buddy", desc: "A regular floppy guy", spawn: person("buddy") },
  { id: "brute", cat: "people", name: "Big Brute", desc: "Bigger, heavier and tougher", spawn: person("brute") },
  { id: "dummy", cat: "people", name: "Test Dummy", desc: "Stuffed, no blood. Comes apart easy", spawn: person("dummy") },
  { id: "robo", cat: "people", name: "Robo Guy", desc: "Metal guy that leaks black oil", spawn: person("robo") },
  { id: "goo", cat: "people", name: "Goo Guy", desc: "Slimy guy with green goo inside", spawn: person("goo") },

  // MELEE
  { id: "blade", cat: "melee", name: "Long Blade", desc: "Sharp! Slices and stabs", metal: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 116, 4, 0.6, 0.5, f, { sharp: true, point: true }),
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); rrect(ctx, -4, -3.5, 28, 7, 3, "#6b3e1f"); rrect(ctx, 22, -10, 5, 20, 2, "#e9c46a"); shape(ctx, [27, -4, L - 16, -4.5, L + 3, 0, L - 16, 4.5, 27, 4], "#dfe6ee"); ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, -1); ctx.lineTo(L - 16, -1); ctx.stroke(); bloodOn(ctx, b, () => shape(ctx, [L * 0.45, -4.5, L - 16, -4.5, L + 3, 0, L - 16, 4.5, L * 0.55, 4], "#a3101c", null)); ctx.restore(); } },
  { id: "axe", cat: "melee", name: "Chopper Axe", desc: "Heavy head, big chops", metal: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 100, 5, 0.5, 1.6, f, { sharp: true, rb: 7 }),
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); rrect(ctx, -4, -3.5, L - 2, 7, 3, "#8a5a2b"); shape(ctx, [L - 22, -6, L - 4, -6, L + 4, -20, L + 10, -12, L + 10, 8, L + 4, 14, L - 4, 6, L - 22, 6], "#b8c2cc"); shape(ctx, [L + 4, -20, L + 10, -12, L + 10, 8, L + 4, 14], "#eef3f7", null); bloodOn(ctx, b, () => shape(ctx, [L + 2, -18, L + 10, -12, L + 10, 8, L + 2, 12], "#a3101c", null)); ctx.restore(); } },
  { id: "spear", cat: "melee", name: "Poker Spear", desc: "Long and pointy. Shish-kebab time", metal: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 176, 3.5, 0.6, 0.5, f, { point: true }),
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); rrect(ctx, -3, -3, L - 18, 6, 3, "#a0703c"); shape(ctx, [L - 24, -6, L + 4, 0, L - 24, 6, L - 20, 0], "#cfd8e0"); bloodOn(ctx, b, () => shape(ctx, [L - 12, -3.5, L + 4, 0, L - 12, 3.5], "#a3101c", null)); ctx.restore(); } },
  { id: "hammer", cat: "melee", name: "Bonk Hammer", desc: "Big heavy bonks, breaks bones", metal: true,
    spawn: (x, y, f, d) => { const b = stickItem(d, x, y, 92, 4, 0.5, 3.2, f); cap(b, b.ps[1], b.ps[1], 13, { fr: 0.5 }); return b; },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); rrect(ctx, -4, -3.5, L, 7, 3, "#7a4a22"); rrect(ctx, L - 11, -17, 22, 34, 4, "#6b7280"); rrect(ctx, L - 11, -17, 22, 7, 3, "#9ca3af", null); bloodOn(ctx, b, () => rrect(ctx, L + 4, -17, 7, 34, 3, "#a3101c", null)); ctx.restore(); } },
  { id: "bat", cat: "melee", name: "Slugger Bat", desc: "Wooden bat for home runs", flammable: 6,
    spawn: (x, y, f, d) => stickItem(d, x, y, 104, 6, 0.4, 0.9, f),
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); shape(ctx, [-5, -3.5, L * 0.4, -4.5, L + 5, -7.5, L + 6, 0, L + 5, 7.5, L * 0.4, 4.5, -5, 3.5], shade("#d4a373", -(b.char || 0))); rrect(ctx, -6, -4.5, 14, 9, 3, "#333"); bloodOn(ctx, b, () => shape(ctx, [L * 0.6, -6, L + 5, -7.5, L + 5, 7.5, L * 0.6, 6], "#a3101c", null)); ctx.restore(); } },

  // BLASTERS (made-up toy-looking blasters, no real guns)
  { id: "pea", cat: "guns", name: "Pea Popper", desc: "Small blaster. Tap USE to fire", metal: true, usable: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 40, 5, 0.6, 0.5, f),
    use(b) { fire(b, { dmg: 34, force: 380, recoil: 120, kind: 0 }); },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); shape(ctx, [2, 2, 12, 2, 8, 17, -2, 17], "#ff7b00"); rrect(ctx, -2, -7, L + 4, 10, 3, "#2ec4b6"); rrect(ctx, L - 4, -5, 9, 6, 2, "#1b4b5a"); ctx.restore(); } },
  { id: "buzz", cat: "guns", name: "Buzz Blaster", desc: "Automatic! USE turns it on / off", metal: true, usable: true,
    spawn: (x, y, f, d) => { const b = stickItem(d, x, y, 76, 5, 0.9, 0.7, f); b.pre = (b, h) => { if (b.on) { b.cool = (b.cool || 0) - h; if (b.cool <= 0) { b.cool = 0.085; fire(b, { dmg: 24, force: 260, recoil: 70, kind: 1, pierce: 2, spread: 0.035 }); } } }; return b; },
    use(b) { b.on = !b.on; S("click"); },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); shape(ctx, [-4, -4, 14, -6, 14, 8, -4, 10], "#3a0ca3"); shape(ctx, [L * 0.42, 2, L * 0.55, 2, L * 0.5, 20, L * 0.4, 20], "#222"); shape(ctx, [L * 0.25, 2, L * 0.35, 2, L * 0.3, 16, L * 0.22, 16], "#ff006e"); rrect(ctx, 12, -8, L * 0.66, 12, 3, "#7209b7"); rrect(ctx, L * 0.7, -5, L * 0.32, 6, 2, "#222"); ctx.fillStyle = b.on ? "#7dff7d" : "#444"; ctx.beginPath(); ctx.arc(L * 0.3, -2, 2.5, 0, 6.283); ctx.fill(); ctx.restore(); } },
  { id: "scatter", cat: "guns", name: "Scatter Blaster", desc: "Shoots a spray of pellets", metal: true, usable: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 72, 5, 1, 0.8, f),
    use(b) { for (let i = 0; i < 8; i++) fire(b, { dmg: 17, force: 200, recoil: i ? 0 : 420, kind: 2, spread: 0.13, quiet: i > 0, range: 900 }); },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); shape(ctx, [-4, -4, 20, -6, 20, 6, 4, 14, -4, 10], "#8d5524"); shape(ctx, [22, 2, 32, 2, 28, 15, 20, 15], "#5c3a1a"); rrect(ctx, 18, -8, L - 14, 7, 3, "#ffbe0b"); rrect(ctx, 18, -1, L - 14, 6, 3, "#fb5607"); rrect(ctx, L * 0.55, 3, L * 0.3, 7, 3, "#5c3a1a"); ctx.restore(); } },
  { id: "thumper", cat: "guns", name: "Thumper Cannon", desc: "Huge kick. Blasts through people", metal: true, usable: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 104, 6, 2, 1.6, f),
    use(b) { fire(b, { dmg: 130, force: 1800, recoil: 900, kind: 3, pierce: 4, sever: true, w: 5, flash: 2 }); W.shake = Math.min(20, W.shake + 6); },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); shape(ctx, [-6, -6, 24, -8, 24, 8, 6, 12, -6, 12], "#264653"); shape(ctx, [26, 4, 38, 4, 34, 20, 24, 20], "#1d3557"); rrect(ctx, 20, -10, L * 0.6, 16, 4, "#2a9d8f"); rrect(ctx, L * 0.62, -6, L * 0.4, 9, 3, "#1d3557"); rrect(ctx, L + 1, -8, 6, 13, 2, "#e9c46a"); rrect(ctx, 30, -20, 30, 8, 3, "#111"); ctx.fillStyle = "#53f2ff"; ctx.fillRect(56, -18, 3, 4); ctx.restore(); } },

  // EXPLOSIVES
  { id: "grenade", cat: "boom", name: "Pop Grenade", desc: "USE to start the 3 second fuse", usable: true, metal: true,
    spawn: (x, y, f, d) => { const b = newBody("obj", d), p = pt(b, x, y, 9, 0.8, { fr: 0.6, bounce: 0.25 }); cap(b, p, p, 9); b.pre = (b, h) => fuseTick(b, h, 1.1, 0.5); return b; },
    use(b) { if (!(b.fuse > 0)) { b.fuse = 3; S("click"); } }, shot(b) { arm(b, 0.05); }, blast(b) { arm(b, rnd(0.05, 0.2)); },
    draw(ctx, b) { const p = b.ps[0]; disc(ctx, p.x, p.y, 9, "#4f772d"); ctx.fillStyle = "#31572c"; ctx.fillRect(p.x - 6, p.y - 1, 12, 2); rrect(ctx, p.x - 3, p.y - 14, 6, 6, 1, "#888"); ctx.fillStyle = b.fuse > 0 && (b.blink = (b.blink || 0) - 1 / 60) > 0 ? "#ff3b3b" : b.fuse > 0 ? "#ffd23f" : "#444"; ctx.beginPath(); ctx.arc(p.x, p.y - 15, 2.5, 0, 6.283); ctx.fill(); } },
  { id: "barrel", cat: "boom", name: "Boom Barrel", desc: "Shoot it, burn it or slam it", flammable: 3, hp: 30,
    spawn: (x, y, f, d) => { const b = box(d, x, y, 40, 54, 1.4); b.hp = 30; b.pre = (b, h) => fuseTick(b, h, 1.35, 0); return b; },
    shot(b, dmg) { b.hp -= dmg; if (b.hp <= 0) arm(b, 0.02); }, impact(b, sp) { if (sp > 1100) arm(b, 0.04); }, blast(b) { arm(b, rnd(0.08, 0.25)); }, burnTick(b) { arm(b, 1.6); },
    after(b, x, y) { for (let i = 0; i < 3; i++) firePatch(x + rnd(-70, 70), y, 6); },
    draw(ctx, b) { const p = b.ps; polyPath(ctx, p); ctx.fillStyle = shade("#d62828", -(b.burn > 0 ? 0.3 : 0)); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.save(); ctx.translate((p[0].x + p[2].x) / 2, (p[0].y + p[2].y) / 2); ctx.rotate(Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x)); ctx.fillStyle = "#9d0208"; ctx.fillRect(-20, -16, 40, 4); ctx.fillRect(-20, 12, 40, 4); ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(9, 7); ctx.lineTo(-9, 7); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#222"; ctx.font = "900 11px Inter"; ctx.textAlign = "center"; ctx.fillText("!", 0, 5); ctx.restore(); } },
  { id: "pack", cat: "boom", name: "Blast Pack", desc: "USE = beep beep beep... BOOM", usable: true,
    spawn: (x, y, f, d) => { const b = box(d, x, y, 34, 20, 0.6); b.pre = (b, h) => fuseTick(b, h, 1.75, 0.35); return b; },
    use(b) { if (!(b.fuse > 0)) { b.fuse = 1.6; S("click"); } }, blast(b) { arm(b, rnd(0.05, 0.2)); },
    draw(ctx, b) { const p = b.ps; polyPath(ctx, p); ctx.fillStyle = "#e9c46a"; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); const [cx, cy] = center(b); ctx.fillStyle = "#222"; ctx.fillRect(cx - 9, cy - 5, 18, 10); ctx.fillStyle = b.fuse > 0 && (b.blink = (b.blink || 0) - 1 / 60) > 0 ? "#ff3b3b" : b.fuse > 0 ? "#5a0000" : "#ff5d5d"; ctx.fillRect(cx - 6, cy - 3, 12, 6); } },
  { id: "flask", cat: "boom", name: "Fire Flask", desc: "Smash it to make fire everywhere", usable: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 28, 6, 0.35, 0.35, f),
    use(b) { shatter(b); }, impact(b, sp) { if (sp > 520) shatter(b); }, blast(b) { shatter(b); }, shot(b) { shatter(b); },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1]); rrect(ctx, -6, -7, L * 0.75, 14, 5, "rgba(255,140,40,0.85)"); rrect(ctx, L * 0.6, -3.5, L * 0.45, 7, 2, "rgba(200,230,255,0.8)"); ctx.fillStyle = "#e9e1d0"; ctx.fillRect(L * 0.95, -3, 7, 6); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(-2, -5, L * 0.5, 2); ctx.restore(); } },
  { id: "mine", cat: "boom", name: "Floor Mine", desc: "Arms itself, then anyone who steps on it goes BOOM",
    spawn: (x, y, f, d) => { const b = box(d, x, y, 40, 10, 1.5); b.pre = (b, h) => fuseTick(b, h, 1.25, 0); return b; },
    touch(b, p) { if (W.time - b.born > 1.2 && p.body.kind === "rag" && !(b.fuse > 0)) { b.fuse = 0.12; S("beep"); } }, blast(b) { arm(b, 0.1); }, shot(b) { arm(b, 0.02); },
    draw(ctx, b) { const p = b.ps; polyPath(ctx, p); ctx.fillStyle = "#3d405b"; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); const [cx, cy] = center(b); const on = W.time - b.born > 1.2; ctx.fillStyle = on ? (Math.sin(W.time * 8) > 0 ? "#ff3b3b" : "#600") : "#777"; ctx.beginPath(); ctx.arc(cx, cy - 5, 3.5, 0, 6.283); ctx.fill(); } },

  // MACHINES
  { id: "spikes", cat: "machines", name: "Spike Strip", desc: "Drop people on it. Snaps to the floor",
    spawn(x, y, f, d) { const fy = floorBelow(x, y - 30), b = newBody("obj", d); b.static = true; b.spikes = [];
      for (let i = 0; i < 7; i++) { const bx = x - 66 + i * 22, a = pt(b, bx, fy - 6, 3, 0), t = pt(b, bx, fy - 40, 2, 0); b.spikes.push(cap(b, a, t, 3, { point: true, fr: 0.3 })); }
      const l = pt(b, x - 76, fy - 4, 4, 0), r = pt(b, x + 76, fy - 4, 4, 0); cap(b, l, r, 4, { fr: 0.6 }); b.fy = fy; return b; },
    draw(ctx, b) { const fy = b.fy; for (const s of b.spikes) { const x = s.a.x; shape(ctx, [x - 7, fy - 5, x, fy - 42, x + 7, fy - 5], "#c9d1d9"); shape(ctx, [x, fy - 42, x + 7, fy - 5, x + 2, fy - 5], "#8b949e", null); if (b.bloody > 0 && W.gore) { ctx.globalAlpha = Math.min(0.85, b.bloody); shape(ctx, [x - 4, fy - 24, x, fy - 42, x + 4, fy - 24], "#a3101c", null); ctx.globalAlpha = 1; } } rrect(ctx, b.ps[14].x - 4, fy - 9, 160, 9, 3, "#495057"); } },
  { id: "crusher", cat: "machines", name: "Crusher", desc: "Squish! USE turns it on / off", usable: true,
    spawn(x, y, f, d) { const fy = floorBelow(x, y - 20), cy = ceilAbove(x, Math.min(y, fy - 160)), b = newBody("obj", d); b.static = true; b.fy = fy; b.cy = cy; b.top = cy + 20; b.y = b.top; b.phase = "wait"; b.t = 0.6; b.on = true; b.cx = x;
      const hw = 82, hh = 46; b.press = [pt(b, x - hw, b.top, 3, 0), pt(b, x + hw, b.top, 3, 0), pt(b, x + hw, b.top + hh, 3, 0), pt(b, x - hw, b.top + hh, 3, 0)]; poly(b, b.press, { fr: 0.8 });
      for (const sx of [-1, 1]) { const a = pt(b, x + sx * (hw + 14), cy, 7, 0), c = pt(b, x + sx * (hw + 14), fy - 2, 7, 0); cap(b, a, c, 7); }
      b.pre = crusherTick; return b; },
    use(b) { b.on = !b.on; S("click"); },
    draw(ctx, b) { const p = b.press, x = b.cx; capsule(ctx, b.ps[4], b.ps[5], 7, "#ffbe0b"); capsule(ctx, b.ps[6], b.ps[7], 7, "#ffbe0b"); rrect(ctx, x - 9, b.cy - 4, 18, p[0].y - b.cy + 4, 3, "#adb5bd"); polyPath(ctx, p); ctx.fillStyle = "#495057"; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke(); ctx.save(); ctx.beginPath(); polyPath(ctx, p); ctx.clip(); ctx.fillStyle = "#ffd23f"; for (let i = -6; i < 10; i++) { ctx.beginPath(); ctx.moveTo(p[3].x + i * 22, p[3].y); ctx.lineTo(p[3].x + i * 22 + 11, p[3].y); ctx.lineTo(p[3].x + i * 22 + 25, p[3].y - 14); ctx.lineTo(p[3].x + i * 22 + 14, p[3].y - 14); ctx.fill(); } ctx.restore(); if (b.bloody > 0 && W.gore) { ctx.globalAlpha = Math.min(0.9, b.bloody); ctx.fillStyle = "#a3101c"; ctx.fillRect(p[3].x, p[3].y - 5, 164, 5); ctx.globalAlpha = 1; } ctx.fillStyle = b.on ? "#7dff7d" : "#ff4d4d"; ctx.beginPath(); ctx.arc(x + 60, p[0].y + 10, 4, 0, 6.283); ctx.fill(); } },
  { id: "saw", cat: "machines", name: "Spin Saw", desc: "A big spinning blade. USE turns it on / off", usable: true, metal: true,
    spawn(x, y, f, d) { const b = newBody("obj", d); b.static = true; const c = pt(b, x, y, 4, 0); cap(b, c, c, 40, { fr: 0.2 }); b.on = true; b.rot = 0; b.fy = floorBelow(x, y + 30); b.pre = (b, h) => { if (b.on) b.rot += h * 26; }; return b; },
    use(b) { b.on = !b.on; S("click"); },
    touch(b, p, h) { if (!b.on) return; const c = b.ps[0], dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1, tx = -dy / d, ty = dx / d; addVel(p, tx * 22, ty * 22); p.ground = 0; S("saw");
      if (p.body.kind === "rag") { const B = p.body; hurt(B, p.part, 2600 * h, { type: "cut", x: p.x, y: p.y, dx: tx, dy: ty }); B.down = Math.max(B.down, 1); if (R() < h * 30 && B.joint[p.part]) sever(B, p.part); if (B.bc && R() < h * 70) bleedBurst(B, c.x + dx / d * 40, c.y + dy / d * 40, tx, ty, 6, 1.8); if (B.bc) b.bloody = Math.min(1, (b.bloody || 0) + h * 2); }
      else if (R() < h * 20) spark(c.x + dx / d * 40, c.y + dy / d * 40, tx, ty, 2); },
    draw(ctx, b) { const c = b.ps[0]; if (b.fy > c.y) { rrect(ctx, c.x - 5, c.y, 10, b.fy - c.y, 2, "#6c757d"); rrect(ctx, c.x - 22, b.fy - 10, 44, 10, 3, "#495057"); } ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(b.rot); ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); ctx.lineTo(Math.cos(a + 0.13) * 37, Math.sin(a + 0.13) * 37); } ctx.closePath(); ctx.fillStyle = "#dee2e6"; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); if (b.bloody > 0 && W.gore) { ctx.globalAlpha = Math.min(0.8, b.bloody); ctx.strokeStyle = "#a3101c"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; } ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.283); ctx.fill(); ctx.fillStyle = "#495057"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.09) * 13, Math.sin(i * 2.09) * 13, 4, 0, 6.283); ctx.fill(); } disc(ctx, 0, 0, 7, "#ffbe0b"); ctx.restore(); } },
  { id: "flamer", cat: "machines", name: "Flame Jet", desc: "Shoots fire up. USE turns it on / off", usable: true,
    spawn(x, y, f, d) { const fy = floorBelow(x, y - 20), b = newBody("obj", d); b.static = true; b.on = true; b.fy = fy; const a = pt(b, x - 18, fy - 12, 3, 0), c = pt(b, x + 18, fy - 12, 3, 0); cap(b, a, c, 12); b.cx = x;
      b.pre = (b, h) => { if (!b.on) return; if (R() < h * 90) { W.flames.length < 450 && W.flames.push({ x: b.cx + rnd(-6, 6), y: b.fy - 26, vx: rnd(-40, 40), vy: rnd(-720, -480), life: rnd(0.35, 0.55), max: 0.55, s: rnd(9, 15) }); } if (R() < h * 8) S("fire");
        for (const o of W.bodies) { if (o === b || o.x1 < b.cx - 80 || o.x0 > b.cx + 80) continue; for (const p of o.ps) { if (p.gone) continue; const up = b.fy - p.y; if (up > 20 && up < 300 && Math.abs(p.x - b.cx) < 16 + up * 0.18) { if (R() < h * 10) ignite(o, p); addVel(p, 0, -5); } } } }; return b; },
    use(b) { b.on = !b.on; S("click"); },
    draw(ctx, b) { const x = b.cx, fy = b.fy; rrect(ctx, x - 26, fy - 22, 52, 22, 4, "#495057"); rrect(ctx, x - 9, fy - 32, 18, 12, 3, "#adb5bd"); ctx.fillStyle = b.on ? "#ff7b00" : "#333"; ctx.fillRect(x - 5, fy - 30, 10, 4); ctx.fillStyle = "#ffd23f"; for (let i = 0; i < 4; i++) ctx.fillRect(x - 22 + i * 12, fy - 8, 6, 4); } },
  { id: "wreck", cat: "machines", name: "Wrecking Ball", desc: "Heavy ball on a chain. Pull it back and let go!",
    spawn(x, y, f, d) { const top = ceilAbove(x, y - 40), b = newBody("obj", d); b.metal = true; const len = clamp(y - top, 140, 620), n = Math.max(4, Math.round(len / 34));
      let prev = pt(b, x, top, 4, 0); b.anchor = prev; b.chain = [prev];
      for (let i = 1; i <= n; i++) { const p = pt(b, x, top + (len * i) / n, 3, 0.4, { nc: true }); stick(b, prev, p); b.chain.push(p); prev = p; }
      const ball = pt(b, x, top + len + 30, 30, 26, { fr: 0.4 }); stick(b, prev, ball); b.chain.push(ball); cap(b, ball, ball, 30, { fr: 0.4 }); b.ball = ball; return b; },
    draw(ctx, b) { const c = b.chain; rrect(ctx, b.anchor.x - 16, b.anchor.y - 6, 32, 10, 3, "#495057"); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); for (const p of c) ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.strokeStyle = "#adb5bd"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); const p = b.ball; disc(ctx, p.x, p.y, 30, "#343a40"); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.arc(p.x - 9, p.y - 10, 10, 0, 6.283); ctx.fill(); if (b.bloody > 0 && W.gore) { ctx.globalAlpha = Math.min(0.7, b.bloody); ctx.fillStyle = "#a3101c"; ctx.beginPath(); ctx.arc(p.x + 8, p.y + 8, 16, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; } } },

  // VEHICLES
  { id: "car", cat: "vehicles", name: "Zoom Car", desc: "USE starts / stops the engine. Runs people over", usable: true, metal: true,
    spawn: (x, y, f, d) => car(d, x, y, f, 1), use: (b) => { b.on = !b.on; S("click"); }, draw: drawCar },
  { id: "truck", cat: "vehicles", name: "Monster Truck", desc: "Giant wheels. Crushes everything", usable: true, metal: true,
    spawn: (x, y, f, d) => car(d, x, y, f, 1.5), use: (b) => { b.on = !b.on; S("click"); }, draw: drawCar },

  // PROPS
  { id: "crate", cat: "props", name: "Wood Crate", desc: "A box. Burns nicely", flammable: 9,
    spawn: (x, y, f, d) => box(d, x, y, 54, 54, 1.3), burnTick(b) { b.char = Math.min(1, (b.char || 0) + 0.004); },
    draw(ctx, b) { const p = b.ps; polyPath(ctx, p); ctx.fillStyle = shade("#c68b4e", -(b.char || 0) * 0.8); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke(); ctx.strokeStyle = shade("#8a5a2b", -(b.char || 0) * 0.8); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[2].x, p[2].y); ctx.moveTo((p[0].x * 3 + p[3].x) / 4, (p[0].y * 3 + p[3].y) / 4); ctx.lineTo((p[1].x * 3 + p[2].x) / 4, (p[1].y * 3 + p[2].y) / 4); ctx.moveTo((p[3].x * 3 + p[0].x) / 4, (p[3].y * 3 + p[0].y) / 4); ctx.lineTo((p[2].x * 3 + p[1].x) / 4, (p[2].y * 3 + p[1].y) / 4); ctx.stroke(); } },
  { id: "beam", cat: "props", name: "Steel Beam", desc: "Long and heavy", metal: true,
    spawn: (x, y, f, d) => stickItem(d, x, y, 190, 9, 5, 5, f),
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1], false); rrect(ctx, -9, -9, L + 18, 18, 3, "#8d99ae"); ctx.fillStyle = "#5c677d"; ctx.fillRect(-7, -3, L + 14, 6); ctx.fillStyle = "#edf2f4"; for (let i = 6; i < L; i += 30) { ctx.beginPath(); ctx.arc(i, -6, 1.6, 0, 6.283); ctx.arc(i, 6, 1.6, 0, 6.283); ctx.fill(); } ctx.restore(); } },
  { id: "ball", cat: "props", name: "Bouncy Ball", desc: "Boing boing boing",
    spawn: (x, y, f, d) => { const b = newBody("obj", d), p = pt(b, x, y, 22, 0.8, { fr: 0.3, bounce: 0.82 }); cap(b, p, p, 22, { fr: 0.3 }); b.rot = 0; b.post = (b) => { b.rot += (p.x - p.px) / 22; }; b.col = ["#ff006e", "#3a86ff", "#ffbe0b", "#06d6a0"][(R() * 4) | 0]; return b; },
    draw(ctx, b) { const p = b.ps[0]; disc(ctx, p.x, p.y, 22, b.col); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.rot); ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 14, 0.3, 2.6); ctx.stroke(); ctx.restore(); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.arc(p.x - 8, p.y - 8, 5, 0, 6.283); ctx.fill(); } },
  { id: "anvil", cat: "props", name: "Heavy Anvil", desc: "Drop it on someone's head", metal: true,
    spawn: (x, y, f, d) => { const b = newBody("obj", d), ps = [pt(b, x - 30, y + 16, 3, 7), pt(b, x + 30, y + 16, 3, 7), pt(b, x + 38, y - 16, 3, 7), pt(b, x - 38, y - 16, 3, 7)]; rigid(b, ps); poly(b, ps, { fr: 0.8 }); return b; },
    draw(ctx, b) { const p = b.ps, ang = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x); const [cx, cy] = center(b); ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); shape(ctx, [-30, 16, 30, 16, 24, 6, 14, 4, 14, -6, 40, -8, 52, -16, -30, -16, -40, -8, -16, -6, -16, 4, -24, 6], "#3d405b"); ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(-30, -15, 70, 3); ctx.restore(); } },
  { id: "plank", cat: "props", name: "Plank", desc: "A light wooden board", flammable: 7,
    spawn: (x, y, f, d) => stickItem(d, x, y, 150, 5, 0.6, 0.6, f), burnTick(b) { b.char = Math.min(1, (b.char || 0) + 0.004); },
    draw(ctx, b) { const L = localFrame(ctx, b.ps[0], b.ps[1], false); rrect(ctx, -5, -5, L + 10, 10, 2, shade("#deb887", -(b.char || 0) * 0.8)); ctx.strokeStyle = "rgba(120,70,30,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(L * 0.6, -1); ctx.stroke(); ctx.restore(); } },
];
export const ITEM = Object.fromEntries(ITEMS.map((d) => [d.id, d]));

// ---------------------------------------------------------------- item logic
function fire(b, o) {
  const a = b.ps[0], c = b.ps[1]; let dx = c.x - a.x, dy = c.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  if (o.spread) { const t = Math.atan2(dy, dx) + rnd(-o.spread, o.spread); dx = Math.cos(t); dy = Math.sin(t); }
  shoot(c.x + dx * 6, c.y + dy * 6, dx, dy, { dmg: o.dmg, force: o.force, pierce: o.pierce || 1, ignore: b, sever: o.sever, w: o.w, flash: o.flash, range: o.range });
  if (o.recoil) for (const p of [a, c]) addVel(p, -dx * o.recoil, -dy * o.recoil - o.recoil * 0.15);
  if (!o.quiet) S("shot", o.kind);
  if (R() < 0.7) W.fx.push({ t: "spark", x: a.x + (c.x - a.x) * 0.5, y: a.y + (c.y - a.y) * 0.5, vx: -dy * 200 * (R() < 0.5 ? -1 : 1), vy: -220, g: 1500, life: 0.4, max: 0.4 }); // (shell flying out)
}
function shatter(b) {
  if (b.kill) return; b.kill = true;
  const [x, y] = center(b); S("whoosh"); S("fire");
  for (let i = 0; i < 40; i++) flame(x + rnd(-30, 30), y + rnd(-20, 20), 1.6);
  for (let i = 0; i < 4; i++) firePatch(x + rnd(-90, 90), y, rnd(5, 8), 38);
  for (const o of W.bodies) for (const p of o.ps) if (!p.gone && Math.hypot(p.x - x, p.y - y) < 110) ignite(o, p);
  for (let i = 0; i < 8; i++) W.fx.push({ t: "spark", x, y, vx: rnd(-300, 300), vy: rnd(-400, -50), g: 1500, life: 0.4, max: 0.4 });
}
function crusherTick(b, h) {
  const fy = b.fy, hh = 46, bottomStop = fy - 3 - hh;
  let v = 0;
  if (b.phase === "wait") { b.t -= h; if (b.t <= 0 && b.on) b.phase = "down"; }
  else if (b.phase === "down") { v = 950; b.y += v * h; if (b.y >= bottomStop) { b.y = bottomStop; b.phase = "hold"; b.t = 0.45; S("crush"); W.shake = Math.min(14, W.shake + 6); } }
  else if (b.phase === "hold") { b.t -= h; if (b.t <= 0) b.phase = "up"; }
  else if (b.phase === "up") { v = -220; b.y += v * h; if (b.y <= b.top) { b.y = b.top; b.phase = "wait"; b.t = 0.7; } }
  const p = b.press; for (const q of p) { q.px = q.x; q.py = q.y; }
  p[0].y = p[1].y = b.y; p[2].y = p[3].y = b.y + hh;
  if (b.phase !== "down" && b.phase !== "hold") return;
  const bot = b.y + hh, gap = fy - bot, x0 = b.cx - 84, x1 = b.cx + 84;
  for (const o of W.bodies) {
    if (o === b || o.static || o.x1 < x0 || o.x0 > x1) continue;
    for (const q of o.ps) {
      if (q.gone || q.x < x0 || q.x > x1 || q.y < bot - 6 || q.y > fy + 4) continue;
      if (gap < q.r * 2 + 3) {
        if (o.kind === "rag") { const part = q.part; if (part === 1 || part === 2) gibAll(o, 0, 0); else gib(o, part, (q.x < b.cx ? -1 : 1) * 0.8, 0.2); b.bloody = Math.min(1, (b.bloody || 0) + 0.5); if (o.bc) bleedBurst(o, q.x, fy - 4, q.x < b.cx ? -1 : 1, -0.25, 30, 2.2); }
        else { o.kill = true; const [cx, cy] = center(o); for (let i = 0; i < 6; i++) W.chunks.push({ x: cx + rnd(-15, 15), y: cy, vx: rnd(-400, 400), vy: rnd(-300, -50), r: rnd(3, 6), rot: R() * 6, vr: rnd(-10, 10), col: o.def.flammable ? "#a0703c" : "#6c757d", bone: false, bc: null, rest: 0 }); S("crunch"); if (o.def.blast) o.def.blast(o, 1); }
        break;
      }
    }
  }
}
function car(def, x, y, f, s) {
  const fl = floorBelow(x, y - 40); if (y + 22 * s > fl) y = fl - 22 * s;
  const b = newBody("obj", def), m = 4 * s * s, hw = 64 * s, bodyTop = y - 30 * s, bodyBot = y - 4 * s;
  const r0 = pt(b, x - hw, bodyBot, 3, m), r1 = pt(b, x + hw, bodyBot, 3, m), r2 = pt(b, x + hw, bodyTop, 3, m), r3 = pt(b, x - hw, bodyTop, 3, m);
  const c0 = pt(b, x - 34 * s * f, bodyTop, 3, m * 0.5), c1 = pt(b, x + 26 * s * f, bodyTop, 3, m * 0.5), c2 = pt(b, x + 12 * s * f, bodyTop - 24 * s, 3, m * 0.5), c3 = pt(b, x - 26 * s * f, bodyTop - 24 * s, 3, m * 0.5);
  rigid(b, [r0, r1, r2, r3, c0, c1, c2, c3]);
  poly(b, [r0, r1, r2, r3], { fr: 0.5 }); poly(b, [c0, c1, c2, c3], { fr: 0.5 });
  const wr = 16 * s, wl = pt(b, x - 40 * s, y + 6 * s, wr, 3 * s, { fr: 1 }), wR = pt(b, x + 40 * s, y + 6 * s, wr, 3 * s, { fr: 1 });
  for (const [w, near] of [[wl, [r0, r3, r1]], [wR, [r1, r2, r0]]]) for (const q of near) stick(b, w, q, { k: 0.35 });
  cap(b, wl, wl, wr, { fr: 1 }); cap(b, wR, wR, wr, { fr: 1 });
  b.face = f; b.on = false; b.rot = 0; b.wheels = [wl, wR]; b.s = s; b.col = s > 1 ? "#ff7b00" : ["#e63946", "#3a86ff", "#06d6a0", "#ffbe0b"][(R() * 4) | 0];
  b.pre = (b, h) => {
    if (!b.on) return;
    if (R() < h * 9) S("engine");
    for (const w of b.wheels) if (w.ground > 0) { const [vx] = vel(w), tgt = b.face * (b.s > 1 ? 650 : 850); addVel(w, clamp(tgt - vx, -160, 160) * h * 60, 0); }
  };
  b.post = (b) => { b.rot += (b.wheels[0].x - b.wheels[0].px) / b.wheels[0].r; };
  return b;
}
function drawCar(ctx, b) {
  const [r0, r1, r2, r3, c0, c1, c2, c3] = b.ps, s = b.s;
  polyPath(ctx, [c0, c1, c2, c3]); ctx.fillStyle = shade(b.col, -0.15); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "rgba(170,225,255,0.85)"; ctx.beginPath(); const lerp = (p, q, t) => [p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t];
  const w = [lerp(c0, c3, 0.25), lerp(c3, c2, 0.15), lerp(c3, c2, 0.85), lerp(c1, c2, 0.25)]; const mid0 = lerp(c0, c1, 0.12), mid1 = lerp(c0, c1, 0.88);
  ctx.moveTo(mid0[0] + (w[1][0] - mid0[0]) * 0.15, mid0[1] - 2); ctx.lineTo(w[1][0], w[1][1] + 3); ctx.lineTo(w[2][0], w[2][1] + 3); ctx.lineTo(mid1[0], mid1[1] - 2); ctx.closePath(); ctx.fill();
  polyPath(ctx, [r0, r1, r2, r3]); ctx.fillStyle = b.col; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  const front = b.face > 0 ? [r1, r2] : [r0, r3], back = b.face > 0 ? [r0, r3] : [r1, r2];
  ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(front[1].x + (front[0].x - front[1].x) * 0.3 - b.face * 4, front[1].y + (front[0].y - front[1].y) * 0.3, 4 * s, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#ff4d4d"; ctx.beginPath(); ctx.arc(back[1].x + (back[0].x - back[1].x) * 0.3 + b.face * 3, back[1].y + (back[0].y - back[1].y) * 0.3, 3 * s, 0, 6.283); ctx.fill();
  if (b.bloody > 0 && W.gore) { ctx.globalAlpha = Math.min(0.7, b.bloody); ctx.fillStyle = "#a3101c"; ctx.beginPath(); ctx.arc(front[0].x - b.face * 6, front[0].y - 8, 9 * s, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
  for (const wh of b.wheels) {
    disc(ctx, wh.x, wh.y, wh.r, "#222"); disc(ctx, wh.x, wh.y, wh.r * 0.55, "#adb5bd", false);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = b.rot + i * 2.09; ctx.moveTo(wh.x, wh.y); ctx.lineTo(wh.x + Math.cos(a) * wh.r * 0.5, wh.y + Math.sin(a) * wh.r * 0.5); } ctx.stroke();
  }
}

export function drawBody(ctx, b) {
  if (b.kind === "rag") drawPerson(ctx, b);
  else if (b.def && b.def.draw) b.def.draw(ctx, b);
}
export function spawnItem(def, x, y, f) { const b = def.spawn(x, y, f, def); S("spawn"); return b; }
