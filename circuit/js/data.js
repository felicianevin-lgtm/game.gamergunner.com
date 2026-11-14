// CIRCUIT SIEGE: everything the game knows about. Robot towers (6 rarities + the OMEGA), robot enemies, bosses,
// the maps (their paths), crates and rewards. Pure data: no three.js in here, so the match simulation (sim.js) can use it.

export const RARITIES = [
  { id: "common", name: "Common", color: "#b8c2cc", hex: 0xb8c2cc, size: 1.0, limit: 8 },
  { id: "uncommon", name: "Uncommon", color: "#4adf6a", hex: 0x4adf6a, size: 1.15, limit: 6 },
  { id: "rare", name: "Rare", color: "#3a9aff", hex: 0x3a9aff, size: 1.3, limit: 5 },
  { id: "epic", name: "Epic", color: "#b05aff", hex: 0xb05aff, size: 1.5, limit: 4 },
  { id: "legendary", name: "Legendary", color: "#ffc42a", hex: 0xffc42a, size: 1.75, limit: 3 },
  { id: "mythic", name: "Mythic", color: "#ff3a6a", hex: 0xff3a6a, size: 2.05, limit: 2 },
  { id: "omega", name: "OMEGA", color: "#3affe0", hex: 0x3affe0, size: 2.5, limit: 1 },
];

// robot towers. cost = in-match $ to place one. kind: gun (one target), splash (hits around the target), chain (jumps
// to more robots), slow (freezes them down), sniper (huge range, hits the strongest), multi (several targets at once),
// beam (hits EVERY robot in range). n = how many targets (chain / multi / beam). sr = splash radius. sl = slow amount.
export const TOWERS = [
  { id: "bolt", name: "Bolt Bot", r: 0, cost: 50, dmg: 4, rng: 7, rate: 2, kind: "gun", desc: "A little blaster bot. Cheap and reliable." },
  { id: "scrap", name: "Scrap Lobber", r: 0, cost: 80, dmg: 6, rng: 6, rate: 0.8, kind: "splash", sr: 2, desc: "Lobs junk that hits everything around it." },
  { id: "zap", name: "Zap Drone", r: 1, cost: 150, dmg: 5, rng: 7, rate: 1.2, kind: "chain", n: 3, desc: "Lightning that jumps to 3 robots." },
  { id: "scout", name: "Laser Scout", r: 1, cost: 120, dmg: 2.5, rng: 8, rate: 5, kind: "gun", desc: "Super fast laser pew-pew." },
  { id: "frost", name: "Frost Bot", r: 2, cost: 200, dmg: 2, rng: 7, rate: 1.5, kind: "slow", sr: 1.6, sl: 0.4, desc: "Freezes robots so they slow down." },
  { id: "rocket", name: "Rocket Rig", r: 2, cost: 300, dmg: 18, rng: 10, rate: 0.6, kind: "splash", sr: 2.5, desc: "Big rockets with a big boom." },
  { id: "tesla", name: "Tesla Titan", r: 3, cost: 550, dmg: 12, rng: 8, rate: 1, kind: "chain", n: 6, desc: "A giant coil. Lightning hits 6 robots." },
  { id: "sniper", name: "Plasma Sniper", r: 3, cost: 500, dmg: 70, rng: 22, rate: 0.4, kind: "sniper", desc: "Huge range. Always shoots the toughest robot." },
  { id: "cannon", name: "Mech Cannon", r: 4, cost: 1000, dmg: 60, rng: 11, rate: 0.5, kind: "splash", sr: 3.5, desc: "A walking cannon mech. MASSIVE explosions." },
  { id: "hydra", name: "Hydra Mech", r: 4, cost: 1200, dmg: 10, rng: 10, rate: 3, kind: "multi", n: 4, desc: "Four laser heads, four targets, super fast." },
  { id: "nova", name: "Nova Colossus", r: 5, cost: 2500, dmg: 25, rng: 12, rate: 2, kind: "beam", n: 10, desc: "A giant robot that blasts EVERY robot near it." },
  { id: "quantum", name: "Quantum Warden", r: 5, cost: 2200, dmg: 40, rng: 13, rate: 1.5, kind: "multi", n: 3, sl: 0.6, desc: "Quantum beams that hit 3 robots and freeze them." },
  { id: "omega", name: "OMEGA PRIME", r: 6, cost: 5000, dmg: 120, rng: 18, rate: 3, kind: "beam", n: 14, sl: 0.5, desc: "The reward for reaching wave 100 in Endless. Beyond overpowered." },
];
export const towerById = (id) => TOWERS.find((t) => t.id === id);
// upgrades: 3 levels on top of level 1. Price = the tower's cost x these, each level hits harder, further, faster
export const UP_COST = [0.6, 1.0, 1.6];
export function towerStats(T, lv) { const k = Math.pow(1.35, lv), dmg = T.dmg * k, rng = T.rng * (1 + 0.08 * lv), rate = T.rate * (1 + 0.12 * lv); return { dmg, rng, rate }; }

// robot enemies. hp, spd (m/s), $ = cash for everyone when it's destroyed, hit = damage to your core if it gets through,
// ar = armor (takes away from every hit), sh = shield (soaks damage first), split = what it breaks into, heal = repairs friends
export const ENEMIES = {
  walker: { name: "Scrap Walker", hp: 18, spd: 2.75, $: 4, hit: 2, size: 1, color: 0x8a96a3 },
  drone: { name: "Buzz Drone", hp: 10, spd: 4, $: 3, hit: 1, size: 0.8, color: 0x3ad0ff, fly: true },
  runner: { name: "Speedy", hp: 12, spd: 5.38, $: 5, hit: 2, size: 0.8, color: 0xffd23a },
  shield: { name: "Shield Bot", hp: 40, sh: 40, spd: 2.5, $: 10, hit: 3, size: 1.1, color: 0x3a9aff },
  tank: { name: "Tank Bot", hp: 90, spd: 1.62, $: 12, hit: 6, ar: 2, size: 1.4, color: 0x4a5a3a },
  splitter: { name: "Splitter", hp: 45, spd: 2.5, $: 8, hit: 3, size: 1.15, color: 0xff7a1a, split: ["mini", 2] },
  mini: { name: "Mini Bot", hp: 12, spd: 3.75, $: 2, hit: 1, size: 0.6, color: 0xffa04a },
  medic: { name: "Medic Bot", hp: 35, spd: 2.5, $: 10, hit: 3, size: 1, color: 0xf4f4f4, heal: 3 },
  heavy: { name: "Juggernaut", hp: 300, spd: 1.25, $: 35, hit: 15, ar: 5, size: 1.9, color: 0x6a1a1a },
  // bosses
  scrapking: { name: "THE SCRAP KING", hp: 2600, spd: 1.12, $: 300, hit: 100, ar: 3, size: 3.2, color: 0xb08a3a, boss: true, split: ["walker", 6] },
  neonlord: { name: "NEON OVERLORD", hp: 6500, sh: 2000, spd: 1.25, $: 600, hit: 100, ar: 4, size: 3.6, color: 0xff3ad8, boss: true, split: ["runner", 8] },
  titan: { name: "REACTOR TITAN", hp: 16000, spd: 1, $: 1200, hit: 100, ar: 6, size: 4.2, color: 0x3aff6a, boss: true, heal: 25, split: ["heavy", 3] },
  destroyer: { name: "OMEGA DESTROYER", hp: 9000, sh: 3000, spd: 1.12, $: 800, hit: 100, ar: 5, size: 4, color: 0xff2a2a, boss: true, split: ["tank", 4] },
};
// how much each robot "costs" when a wave is put together, and the first wave it can show up in
const WAVE_POOL = [["walker", 1, 1], ["drone", 1, 1], ["runner", 1.5, 3], ["shield", 3, 5], ["tank", 5, 7], ["splitter", 4, 9], ["medic", 4, 11], ["heavy", 12, 15]];

// maps: a path (x, z points) the robots walk along from the portal to your core. waves = normal waves before the boss.
// diff = how much tougher the robots are. size = half the width / depth of the floor.
export const MAPS = [
  { id: "yard", name: "Scrap Yard", diff: 1, waves: 15, boss: "scrapking", size: [34, 26], color: 0x3aff6a,
    path: [[-32, -18], [-12, -18], [-12, 6], [8, 6], [8, -14], [24, -14], [24, 16], [-24, 16], [-24, 22]] },
  { id: "city", name: "Neon City", diff: 1.6, waves: 20, boss: "neonlord", size: [36, 28], color: 0xff3ad8,
    path: [[-34, 16], [-26, 16], [-26, -14], [-14, -14], [-14, 12], [-2, 12], [-2, -14], [10, -14], [10, 12], [22, 12], [22, -14], [32, -14]] },
  { id: "reactor", name: "Core Reactor", diff: 2.3, waves: 25, boss: "titan", size: [34, 34], color: 0x3ad0ff,
    path: [[-32, -28], [26, -28], [26, 20], [-20, 20], [-20, -14], [12, -14], [12, 6], [-4, 6]] },
  { id: "endless", name: "The Endless Grid", diff: 1.2, waves: Infinity, boss: "destroyer", endless: true, size: [38, 30], color: 0x3affe0,
    path: [[-36, -24], [30, -24], [30, -8], [-26, -8], [-26, 8], [30, 8], [30, 24], [-36, 24]] },
];
export const mapById = (id) => MAPS.find((m) => m.id === id);
export const PATH_W = 2.6; // how wide the glowing path is

// a tiny random number maker that always gives the same numbers for the same seed (so every player's game matches)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// what's in wave w on map M: a list of [enemy, hp multiplier] (bosses: on the last wave of a normal map, every 20 in Endless)
export function waveList(M, w, seed) {
  const R = rng(seed * 7919 + w * 104729), hpMul = (1 + 0.11 * (w - 1) + 0.0025 * (w - 1) * (w - 1)) * M.diff * (M.endless && w > 60 ? 1 + (w - 60) * 0.04 : 1);
  const out = [], pool = WAVE_POOL.filter((p) => w >= p[2]);
  let budget = (8 + w * 5 + w * w * 0.3) * (M.endless ? 1 : 0.9 + 0.1 * M.diff);
  const boss = M.endless ? w % 20 === 0 : w === M.waves + 1;
  if (boss) { out.push([M.endless ? "destroyer" : M.boss, M.endless ? 1 + (w / 20 - 1) * 0.8 : 1]); budget *= 0.5; }
  while (budget > 0 && out.length < 120) {
    const p = pool[Math.floor(R() * pool.length)];
    out.push([p[0], hpMul]); budget -= p[1];
  }
  if (boss) out.push(out.shift()); // (the boss comes last, after its escort)
  return out;
}

// crates (Crate Room): just 2. The Normal Crate is cheap and mostly Common / Uncommon, with a tiny chance of the good
// stuff; the Rare Crate costs more and has WAY better chances at Epic, Legendary and Mythic. odds = % for each rarity
// (Common, Uncommon, Rare, Epic, Legendary, Mythic)
export const CRATES = [
  { id: "normal", name: "Normal Crate", price: 150, color: "#3aff6a", hex: 0x3aff6a, odds: [60, 26, 9.5, 3.5, 0.8, 0.2] },
  { id: "rare", name: "Rare Crate", price: 1500, color: "#ff3ad8", hex: 0xff3ad8, odds: [0, 25, 35, 25, 11, 4] },
];
export function rollCrate(i, rand = Math.random) {
  const C = CRATES[i]; let x = rand() * 100, rr = 0;
  for (let r = 0; r < C.odds.length; r++) { if (x < C.odds[r]) { rr = r; break; } x -= C.odds[r]; rr = r; }
  const list = TOWERS.filter((t) => t.r === rr);
  return list[Math.floor(rand() * list.length)].id;
}
// bolts (your money for crates) at the end of a match
export function matchBolts(M, cleared, kills, bossKills, won) {
  if (M.endless) return Math.round(cleared * 15 + cleared * cleared * 0.5 + kills * 0.25 + bossKills * 250);
  return Math.round(cleared * 12 * M.diff + kills * 0.3 + (won ? 400 * M.diff : 0));
}
export const START_CASH = 100; // $ at the start of every match
export const PAD_SIZES = [2, 4, 8];
