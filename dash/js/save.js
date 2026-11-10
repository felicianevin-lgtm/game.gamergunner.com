// TURBO DASH: what is saved in this browser (coins, best score, the shop, missions).
const KEY = "gv_dash";

export const RUNNERS = [
  { id: "dash", name: "Dash", cost: 0, skin: 0xffc999, shirt: 0xff7a1a, pants: 0x2a4bd6, shoes: 0xffffff, hair: 0x5a3a1a, hat: "cap", hatColor: 0x18c8ff },
  { id: "zippy", name: "Zippy", cost: 600, skin: 0xe9a87c, shirt: 0x39e36b, pants: 0x232a3a, shoes: 0xffe14a, hair: 0x1a1a1a, hat: "band", hatColor: 0xff3fa0 },
  { id: "blaze", name: "Blaze", cost: 1500, skin: 0xb97a50, shirt: 0xff3030, pants: 0x1f1f24, shoes: 0xff9a1a, hair: 0xff7a00, hat: "spikes", hatColor: 0xff7a00 },
  { id: "frosty", name: "Frosty", cost: 3000, skin: 0xf1d6c4, shirt: 0x7fe8ff, pants: 0xf4f8ff, shoes: 0x3a8aff, hair: 0xffffff, hat: "beanie", hatColor: 0x3a6aff },
  { id: "robo", name: "Robo Kid", cost: 6000, skin: 0xb8c4d0, shirt: 0x56657a, pants: 0x394350, shoes: 0xff4a4a, hair: 0xb8c4d0, hat: "antenna", hatColor: 0xff4a4a, eyes: 0x40ffff },
  { id: "gold", name: "Gold Rush", cost: 15000, skin: 0xffd76a, shirt: 0xffc21a, pants: 0xe0a000, shoes: 0xfff2a0, hair: 0xffc21a, hat: "crown", hatColor: 0xffe066 },
];
export const TRAILS = [
  { id: "none", name: "No trail", cost: 0, colors: [] },
  { id: "neon", name: "Neon Zap", cost: 400, colors: [0x30f0ff, 0x3a7bff, 0xffffff] },
  { id: "fire", name: "Fire Feet", cost: 1200, colors: [0xffe14a, 0xff8a1a, 0xff2a2a] },
  { id: "rainbow", name: "Rainbow Road", cost: 2500, colors: [0xff3a3a, 0xffa21a, 0xfff03a, 0x3aff6a, 0x3ab8ff, 0xb03aff] },
  { id: "stars", name: "Stardust", cost: 4000, colors: [0xffffff, 0xfff07a, 0xd0a0ff, 0x9af0ff] },
];
export const UPGRADES = [
  { id: "magnet", name: "Coin Magnet", icon: "🧲", per: 2 },
  { id: "jetpack", name: "Jetpack", icon: "🚀", per: 1 },
  { id: "x2", name: "2x Score", icon: "✖2", per: 2 },
  { id: "sneakers", name: "Super Sneakers", icon: "👟", per: 2 },
  { id: "shield", name: "Shield", icon: "🛡️", per: 3 },
];
export const UP_COST = [250, 600, 1500, 3000, 6000];
export const UP_MAX = 5;

const MK = {
  coins: { run: true, n: (l) => 100 + l * 125, text: (n) => `Collect ${n} coins in one run` },
  jumps: { run: true, n: (l) => 10 + l * 10, text: (n) => `Jump ${n} times in one run` },
  slides: { run: true, n: (l) => 6 + l * 6, text: (n) => `Slide ${n} times in one run` },
  dist: { run: true, n: (l) => 500 + l * 500, text: (n) => `Run ${n} m in one run` },
  score: { run: true, n: (l) => 1500 + l * 2500, text: (n) => `Score ${n} points in one run` },
  tops: { run: true, n: (l) => 2 + l * 2, text: (n) => `Run on top of ${n} trams in one run` },
  lanes: { run: true, n: (l) => 25 + l * 20, text: (n) => `Switch lanes ${n} times in one run` },
  jetpacks: { run: false, n: (l) => 1 + l * 2, text: (n) => (n === 1 ? "Use a jetpack" : `Use ${n} jetpacks`) },
  powers: { run: false, n: (l) => 3 + l * 3, text: (n) => `Grab ${n} power-ups` },
  bank: { run: false, n: (l) => 500 + l * 1000, text: (n) => `Collect ${n} coins in total` },
};
// what each mission counts during a run
export const runValue = (kind, r) => ({ coins: r.coins, jumps: r.jumps, slides: r.slides, dist: Math.floor(r.dist), score: Math.floor(r.score), tops: r.tops, lanes: r.lanes, jetpacks: r.jetpacks, powers: r.powers, bank: r.coins })[kind] || 0;

function fresh() {
  return { coins: 0, best: 0, bestDist: 0, mult: 1, runs: 0, runner: "dash", trail: "none", own: ["dash", "none"], up: { magnet: 0, jetpack: 0, x2: 0, sneakers: 0, shield: 0 }, lv: {}, missions: [], muted: false };
}
export const S = load();
function load() {
  let s = fresh();
  try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && typeof j === "object") s = { ...s, ...j, up: { ...s.up, ...(j.up || {}) }, lv: { ...(j.lv || {}) } }; } catch {}
  if (!Array.isArray(s.own)) s.own = ["dash", "none"];
  if (!Array.isArray(s.missions)) s.missions = [];
  s.missions = s.missions.filter((m) => m && MK[m.kind]);
  while (s.missions.length < 3) s.missions.push(newMission(s));
  return s;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
function newMission(s = S) {
  const have = s.missions.map((m) => m.kind);
  const kinds = Object.keys(MK).filter((k) => !have.includes(k));
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const l = s.lv[kind] || 0;
  return { kind, n: MK[kind].n(l), prog: 0, base: 0 };
}
export const missionText = (m) => MK[m.kind].text(m.n);
// how far along a mission is (r = this run's stats, or null between runs)
export function missionValue(m, r) {
  const run = MK[m.kind].run;
  const now = r ? runValue(m.kind, r) - m.base : 0;
  return Math.min(m.n, run ? Math.max(0, now) : m.prog + Math.max(0, now));
}
export function runStart() { for (const m of S.missions) m.base = 0; }
// check missions during a run; returns the ones that just got done
export function checkMissions(r) {
  const done = [];
  for (let i = 0; i < S.missions.length; i++) {
    const m = S.missions[i];
    if (missionValue(m, r) >= m.n) {
      done.push(missionText(m));
      S.lv[m.kind] = (S.lv[m.kind] || 0) + 1; S.mult = Math.min(30, S.mult + 1);
      const nm = newMission(); nm.base = runValue(nm.kind, r); S.missions[i] = nm;
    }
  }
  if (done.length) save();
  return done;
}
export function runEnd(r) {
  for (const m of S.missions) { if (!MK[m.kind].run) m.prog = missionValue(m, r); m.base = 0; }
  S.coins += r.coins; S.runs++;
  let newBest = false;
  if (Math.floor(r.score) > S.best) { S.best = Math.floor(r.score); newBest = true; }
  S.bestDist = Math.max(S.bestDist, Math.floor(r.dist));
  save();
  return newBest;
}
export function durations(base) {
  const o = {};
  for (const u of UPGRADES) o[u.id] = base[u.id] + (S.up[u.id] || 0) * u.per;
  return o;
}
