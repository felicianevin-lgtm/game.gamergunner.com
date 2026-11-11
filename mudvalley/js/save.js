// MUD VALLEY RP: what is saved in this browser. Your money, your rides (and their upgrades + where you parked them),
// trailers, houses, best race times and stats.
import { newCar } from "./vehicles.js";
import { HOUSES } from "./layout.js";

const KEY = "gv_mudvalley";
export const START_MONEY = 800;

function fresh() {
  const truck = newCar("pickup", 1); Object.assign(truck, { x: -94, z: 32, yaw: Math.PI });
  return {
    v: 1, money: START_MONEY, cars: [truck], trailers: [], houses: ["lot"], home: "lot", nextId: 2,
    driving: 1, px: -90, pz: 24, best: {}, wins: {}, stats: { jobs: 0, earned: 0, races: 0, bigAir: 0, played: 0 }, intro: false, muted: false,
  };
}
export const S = load();
function load() {
  let s = fresh();
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (j && typeof j === "object" && j.v === 1) s = { ...s, ...j, stats: { ...s.stats, ...(j.stats || {}) }, best: { ...(j.best || {}) }, wins: { ...(j.wins || {}) } };
  } catch {}
  if (!Array.isArray(s.cars) || !s.cars.length) s.cars = fresh().cars;
  if (!Array.isArray(s.trailers)) s.trailers = [];
  if (!Array.isArray(s.houses) || !s.houses.includes("lot")) s.houses = ["lot", ...(Array.isArray(s.houses) ? s.houses : [])];
  s.money = Math.max(0, Math.floor(+s.money || 0));
  return s;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
export function wipe() { try { localStorage.removeItem(KEY); } catch {} }
export const uid = () => S.nextId++;
// garage room: your best house decides how many vehicles you can own
export const slots = () => Math.max(...S.houses.map((id) => (HOUSES.find((h) => h.id === id) || HOUSES[0]).slots));
export const carByUid = (u) => S.cars.find((c) => c.uid === u);
export function pay(n) { S.money += Math.round(n); S.stats.earned += Math.max(0, Math.round(n)); }
export function spend(n) { if (S.money < n) return false; S.money -= n; return true; }
export const money = (n) => "$" + Math.floor(n).toLocaleString("en-US");
