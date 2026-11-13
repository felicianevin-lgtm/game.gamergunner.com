// SPLAT LAB maps: the solid ground (capsule segments the physics uses) + a painted background.
import { WW, WH } from "./sim.js";
const OUT = "#1b1424";
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function groundFill(ctx, pts, top, bot) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.lineTo(WW + 40, WH + 40); ctx.lineTo(-40, WH + 40); ctx.closePath();
  const g = ctx.createLinearGradient(0, Math.min(...pts.filter((_, i) => i % 2)), 0, WH); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
}
const WALLS = [[-10, -600, -10, 900, 20], [1610, -600, 1610, 900, 20]];

export const MAPS = [
  { id: "lab", name: "Test Lab", icon: "🧪", desc: "A safe, clean test room. Not for long.",
    segs: [[-20, 860, 1620, 860, 20], [-20, -10, 1620, -10, 20], [150, 560, 430, 560, 8], ...WALLS],
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, "#3a3f58"); g.addColorStop(1, "#262a3d"); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 2; for (let x = 0; x < WW; x += 80) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 840); ctx.stroke(); } for (let y = 40; y < 840; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WW, y); ctx.stroke(); }
      // observation window
      ctx.fillStyle = "#11131d"; ctx.fillRect(560, 150, 480, 220); const wg = ctx.createLinearGradient(560, 150, 1040, 370); wg.addColorStop(0, "rgba(120,200,255,0.25)"); wg.addColorStop(1, "rgba(120,200,255,0.05)"); ctx.fillStyle = wg; ctx.fillRect(560, 150, 480, 220);
      ctx.fillStyle = "#1c2030"; for (const x of [640, 720, 900, 970]) { ctx.beginPath(); ctx.arc(x, 330, 22, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 26, 330, 52, 40); }
      ctx.strokeStyle = "#8d99ae"; ctx.lineWidth = 10; ctx.strokeRect(560, 150, 480, 220); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(800, 150); ctx.lineTo(800, 370); ctx.stroke();
      // signs
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(1180, 160, 300, 70); ctx.fillStyle = OUT; ctx.font = "900 40px 'Russo One', sans-serif"; ctx.textAlign = "center"; ctx.fillText("SPLAT LAB", 1330, 210);
      ctx.fillStyle = "#e5e5e5"; ctx.fillRect(1210, 260, 240, 46); ctx.fillStyle = "#c1121f"; ctx.font = "800 22px Inter, sans-serif"; ctx.fillText("TEST AREA 7", 1330, 292);
      ctx.fillStyle = "#2d3142"; ctx.fillRect(110, 140, 120, 90); ctx.fillStyle = "#7dff7d"; ctx.font = "700 14px monospace"; ctx.textAlign = "left"; ["SAFETY:", "[#.......] 10%", "MESS:", "[########] MAX"].forEach((t, i) => ctx.fillText(t, 118, 160 + i * 20));
      // hazard stripes + floor
      ctx.save(); ctx.beginPath(); ctx.rect(0, 812, WW, 28); ctx.clip(); ctx.fillStyle = "#ffd23f"; ctx.fillRect(0, 812, WW, 28); ctx.fillStyle = "#222"; for (let x = -40; x < WW + 40; x += 44) { ctx.beginPath(); ctx.moveTo(x, 840); ctx.lineTo(x + 22, 840); ctx.lineTo(x + 50, 812); ctx.lineTo(x + 28, 812); ctx.fill(); } ctx.restore();
      ctx.fillStyle = "#5c6378"; ctx.fillRect(0, 840, WW, 60); ctx.fillStyle = "#7c849b"; ctx.fillRect(0, 840, WW, 6); ctx.strokeStyle = "rgba(0,0,0,0.25)"; for (let x = 0; x < WW; x += 120) { ctx.beginPath(); ctx.moveTo(x, 846); ctx.lineTo(x, 900); ctx.stroke(); }
      ctx.fillStyle = "#1d2030"; ctx.fillRect(0, 0, WW, 10); for (let x = 200; x < WW; x += 400) { ctx.fillStyle = "#55596e"; ctx.fillRect(x - 40, 10, 80, 10); ctx.fillStyle = "rgba(255,255,220,0.9)"; ctx.fillRect(x - 34, 18, 68, 5); const lg = ctx.createLinearGradient(0, 20, 0, 400); lg.addColorStop(0, "rgba(255,255,220,0.10)"); lg.addColorStop(1, "rgba(255,255,220,0)"); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x - 34, 23); ctx.lineTo(x + 34, 23); ctx.lineTo(x + 160, 840); ctx.lineTo(x - 160, 840); ctx.fill(); }
      // shelf
      ctx.fillStyle = "#6c757d"; ctx.fillRect(170, 568, 10, 120); ctx.fillRect(400, 568, 10, 120); ctx.fillStyle = "#adb5bd"; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(142, 552, 296, 16, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#444a5e"; ctx.fillRect(0, 0, 8, WH); ctx.fillRect(WW - 8, 0, 8, WH);
    } },
  { id: "roof", name: "Rooftops", icon: "🌃", desc: "Two buildings at night with a big drop in between.",
    segs: [[-20, 600, 620, 600, 14], [620, 600, 620, 890, 14], [960, 520, 1620, 520, 14], [960, 520, 960, 890, 14], [-20, 890, 1620, 890, 14], ...WALLS],
    draw(ctx) {
      const r = rng(7);
      const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, "#0b1026"); g.addColorStop(0.6, "#2a1b4a"); g.addColorStop(1, "#4a2a5a"); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH);
      for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; ctx.fillRect(r() * WW, r() * 420, 2, 2); }
      ctx.fillStyle = "#fff6d5"; ctx.beginPath(); ctx.arc(1320, 130, 54, 0, 6.283); ctx.fill(); ctx.fillStyle = "#0b1026"; ctx.beginPath(); ctx.arc(1300, 118, 50, 0, 6.283); ctx.fill();
      for (let layer = 0; layer < 2; layer++) { let x = -20; while (x < WW) { const w = 60 + r() * 110, h = 160 + r() * 300 - layer * 80; ctx.fillStyle = layer ? "#1a1430" : "#251c40"; ctx.fillRect(x, 900 - h - 120 + layer * 60, w, h + 200); ctx.fillStyle = layer ? "rgba(255,210,120,0.55)" : "rgba(255,210,120,0.3)"; for (let wy = 900 - h - 100 + layer * 60; wy < 860; wy += 26) for (let wx = x + 8; wx < x + w - 10; wx += 18) if (r() < 0.35) ctx.fillRect(wx, wy, 8, 12); x += w + 6; } }
      // street
      ctx.fillStyle = "#2b2d33"; ctx.fillRect(0, 876, WW, 30); ctx.fillStyle = "#ffd23f"; for (let x = 640; x < 940; x += 60) ctx.fillRect(x, 888, 30, 4);
      // buildings you stand on
      const bld = (x0, x1, top, col) => { ctx.fillStyle = col; ctx.fillRect(x0, top, x1 - x0, WH - top); ctx.fillStyle = "rgba(0,0,0,0.18)"; for (let y = top + 10; y < WH; y += 18) ctx.fillRect(x0, y, x1 - x0, 2); ctx.fillStyle = "rgba(255,220,140,0.75)"; for (let y = top + 50; y < 860; y += 70) for (let x = x0 + 30; x < x1 - 40; x += 80) if (r() < 0.6) ctx.fillRect(x, y, 34, 40); ctx.fillStyle = "#6b4f4f"; ctx.fillRect(x0, top - 14, x1 - x0, 14); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.strokeRect(x0, top - 14, x1 - x0, WH); };
      bld(-20, 634, 600, "#8a4f3d"); bld(946, 1620, 520, "#5d6d7e");
      ctx.fillStyle = "#3b3b48"; ctx.fillRect(120, 540, 90, 46); ctx.fillStyle = "#555"; ctx.fillRect(130, 548, 70, 6); ctx.fillRect(130, 560, 70, 6);
      ctx.fillStyle = "#4a3b2f"; ctx.fillRect(1380, 400, 110, 90); ctx.fillRect(1395, 490, 8, 18); ctx.fillRect(1468, 490, 8, 18); ctx.beginPath(); ctx.moveTo(1370, 400); ctx.lineTo(1435, 360); ctx.lineTo(1500, 400); ctx.fill();
      ctx.fillStyle = "#ff4d6d"; ctx.font = "900 34px 'Russo One', sans-serif"; ctx.textAlign = "center"; ctx.fillText("OPEN 24/7", 1180, 470);
    } },
  { id: "canyon", name: "Canyon", icon: "🏜️", desc: "Hills, a ramp and a pit. Great for cars.",
    segs: [[-20, 800, 420, 800, 16], [420, 800, 700, 650, 16], [700, 650, 980, 650, 16], [980, 650, 1000, 870, 16], [1000, 870, 1300, 870, 16], [1300, 870, 1320, 720, 16], [1320, 720, 1620, 720, 16], ...WALLS],
    draw(ctx) {
      const r = rng(3);
      const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, "#3d2c8d"); g.addColorStop(0.45, "#e76f51"); g.addColorStop(1, "#f4a261"); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH);
      ctx.fillStyle = "#ffe8a3"; ctx.beginPath(); ctx.arc(400, 420, 70, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#9c4a3a"; ctx.beginPath(); ctx.moveTo(0, 620); [[80, 480], [260, 470], [300, 560], [520, 560], [560, 430], [760, 420], [800, 540], [1100, 540], [1150, 390], [1380, 380], [1420, 500], [1600, 500], [1600, 900], [0, 900]].forEach((p) => ctx.lineTo(p[0], p[1])); ctx.fill();
      ctx.fillStyle = "#7d3a2e"; ctx.beginPath(); ctx.moveTo(0, 700); for (let x = 0; x <= WW; x += 80) ctx.lineTo(x, 650 + Math.sin(x * 0.01) * 30 + r() * 20); ctx.lineTo(WW, 900); ctx.lineTo(0, 900); ctx.fill();
      groundFill(ctx, [-20, 784, 420, 784, 700, 634, 980, 634, 1000, 854, 1300, 854, 1320, 704, 1620, 704], "#e9c46a", "#b5833c");
      ctx.fillStyle = "rgba(120,70,30,0.35)"; for (let i = 0; i < 70; i++) { const x = r() * WW; ctx.beginPath(); ctx.arc(x, 820 + r() * 70, 2 + r() * 4, 0, 6.283); ctx.fill(); }
      const cactus = (x, y, s) => { ctx.fillStyle = "#2a9d8f"; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 8 * s, y - 70 * s, 16 * s, 70 * s, 8 * s); ctx.roundRect(x - 26 * s, y - 50 * s, 12 * s, 26 * s, 6 * s); ctx.roundRect(x + 14 * s, y - 58 * s, 12 * s, 30 * s, 6 * s); ctx.fill(); ctx.stroke(); ctx.fillRect(x - 20 * s, y - 30 * s, 14 * s, 8 * s); ctx.fillRect(x + 6 * s, y - 34 * s, 14 * s, 8 * s); };
      cactus(160, 786, 1); cactus(1480, 706, 0.8);
      ctx.fillStyle = "#6d4c41"; ctx.fillRect(1080, 760, 8, 94); ctx.fillStyle = "#f5ebe0"; ctx.fillRect(1040, 730, 90, 36); ctx.fillStyle = "#c1121f"; ctx.font = "900 18px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText("DANGER!", 1085, 755);
    } },
];
export function segsOf(map) { return map.segs.map((s) => ({ ax: s[0], ay: s[1], bx: s[2], by: s[3], r: s[4] })); }
