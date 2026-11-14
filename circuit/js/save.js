// CIRCUIT SIEGE: what's saved in this browser. Your bolts (money for crates), the robot towers you own (and how many),
// your loadout (up to 5 tower types you bring into a match) and your stats.
import { towerById } from "./data.js";

const KEY = "gv_circuit";
function fresh() {
  return { v: 1, bolts: 150, inv: { bolt: 1, scrap: 1 }, loadout: ["bolt", "scrap"], color: 0x3aff6a,
    stats: { matches: 0, wins: 0, waves: 0, kills: 0, crates: 0, bestEndless: 0, bosses: 0, trades: 0 }, omega: false, muted: false };
}
export const S = (() => {
  let s = fresh();
  try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && j.v === 1) s = { ...s, ...j, stats: { ...s.stats, ...(j.stats || {}) }, inv: { ...(j.inv || {}) } }; } catch {}
  for (const id of Object.keys(s.inv)) if (!towerById(id) || !(s.inv[id] > 0)) delete s.inv[id];
  if (!Array.isArray(s.loadout)) s.loadout = [];
  s.loadout = s.loadout.filter((id) => s.inv[id] > 0).slice(0, 5);
  if (!s.loadout.length) s.loadout = Object.keys(s.inv).slice(0, 5);
  s.bolts = Math.max(0, Math.floor(+s.bolts || 0));
  return s;
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
export function addTower(id, n = 1) { if (!towerById(id)) return; S.inv[id] = (S.inv[id] || 0) + n; if (S.loadout.length < 5 && !S.loadout.includes(id)) S.loadout.push(id); save(); }
export function removeTower(id, n = 1) { S.inv[id] = Math.max(0, (S.inv[id] || 0) - n); if (!S.inv[id]) { delete S.inv[id]; S.loadout = S.loadout.filter((x) => x !== id); } save(); }
export const fmt = (n) => Math.floor(n).toLocaleString("en-US");
