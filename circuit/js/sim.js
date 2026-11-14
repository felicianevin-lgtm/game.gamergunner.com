// CIRCUIT SIEGE: one match (a map + its waves), as plain numbers. It runs in fixed steps (20 a second) and only uses
// + - * / and square roots, so every player's computer comes up with EXACTLY the same robots from the same seed and the
// same commands (place / upgrade / sell / skip / dev spawns), which the match host stamps with the step to apply them on.
// That's how friends see the same game without sending every robot over the internet.
import { TOWERS, towerById, ENEMIES, RARITIES, PATH_W, UP_COST, waveList, START_CASH } from "./data.js";

export const TICK = 0.05; // seconds per step
const pow = (k, n) => { let v = 1; for (let i = 0; i < n; i++) v *= k; return v; };
export function statsOf(T, lv) { return { dmg: T.dmg * pow(1.35, lv), rng: T.rng * (1 + 0.08 * lv), rate: T.rate * (1 + 0.12 * lv) }; }

export class Sim {
  // M = the map, seed = the same number on every computer, ids = the players (their relay ids; 0 = playing alone)
  constructor(M, seed, ids) {
    this.M = M; this.seed = seed; this.tick = 0; this.wave = 0; this.phase = "build"; this.nextWave = 12 / TICK; // (12 s to set up first)
    this.queue = []; this.enemies = []; this.towers = []; this.nextE = 1; this.nextT = 1;
    this.baseMax = 100; this.base = 100; this.over = false; this.won = false; this.kills = 0; this.bossKills = 0; this.cleared = 0; this.omega = false;
    this.players = {}; for (const id of ids) this.addPlayer(id);
    this.events = []; // (things the screen should show: shots, booms, deaths. Drained by match.js every frame.)
    // the path: points + how far along each one is
    this.P = M.path.map(([x, z]) => ({ x, z })); this.L = [0];
    for (let i = 1; i < this.P.length; i++) { const a = this.P[i - 1], b = this.P[i]; this.L.push(this.L[i - 1] + Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z))); }
    this.len = this.L[this.L.length - 1];
  }
  addPlayer(id) { if (!this.players[id]) this.players[id] = { cash: START_CASH, dmg: 0, kills: 0, spent: 0 }; }
  // where along the path (distance d) -> {x, z}
  at(d) {
    const L = this.L, P = this.P; let i = 1; while (i < L.length - 1 && L[i] < d) i++;
    const a = P[i - 1], b = P[i], k = Math.max(0, Math.min(1, (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1)));
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
  }
  // how close a spot is to the path (for placing towers)
  pathDist(x, z) {
    let best = 1e9; const P = this.P;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)), px = a.x + dx * t - x, pz = a.z + dz * t - z;
      best = Math.min(best, Math.sqrt(px * px + pz * pz));
    }
    return best;
  }
  // can player o put tower T at x, z? (returns why not, or null)
  canPlace(o, T, x, z) {
    const p = this.players[o]; if (!p) return "You're not in this match.";
    if (!T) return "?";
    const R = RARITIES[T.r], foot = 0.9 * R.size, [hx, hz] = this.M.size;
    if (Math.abs(x) > hx - foot || Math.abs(z) > hz - foot) return "Too close to the edge.";
    if (this.pathDist(x, z) < PATH_W / 2 + foot) return "Can't build on the path!";
    for (const t of this.towers) { const f2 = 0.9 * RARITIES[towerById(t.id).r].size; if ((t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) < (foot + f2) * (foot + f2)) return "Too close to another tower."; }
    if (this.towers.filter((t) => t.o === o && t.id === T.id).length >= R.limit) return "You can only place " + R.limit + " " + T.name + (R.limit > 1 ? "s" : "") + ".";
    if (p.cash < T.cost) return "Not enough cash.";
    return null;
  }
  // ---- commands (the same list on every computer, applied on the same step)
  apply(c) {
    const p = this.players[c.o];
    if (c.a === "join") { this.addPlayer(c.o); return; }
    if (!p || this.over) return;
    if (c.a === "p") { const T = towerById(c.w); if (!T || this.canPlace(c.o, T, c.x, c.z)) return; p.cash -= T.cost; p.spent += T.cost; const t = { u: this.nextT++, id: T.id, o: c.o, x: c.x, z: c.z, lv: 0, cd: 0, spent: T.cost, mode: T.kind === "sniper" ? "strong" : "first", aim: 0 }; this.towers.push(t); this.events.push({ k: "place", t }); }
    else if (c.a === "u") { const t = this.towers.find((q) => q.u === c.i && q.o === c.o); if (!t || t.lv >= 3) return; const T = towerById(t.id), cost = Math.round(T.cost * UP_COST[t.lv]); if (p.cash < cost) return; p.cash -= cost; t.spent += cost; t.lv++; this.events.push({ k: "up", t }); }
    else if (c.a === "s") { const i = this.towers.findIndex((q) => q.u === c.i && q.o === c.o); if (i < 0) return; const t = this.towers[i]; p.cash += Math.round(t.spent * 0.6); this.towers.splice(i, 1); this.events.push({ k: "sell", t }); }
    else if (c.a === "m") { const t = this.towers.find((q) => q.u === c.i && q.o === c.o); if (t && ["first", "last", "strong", "close"].includes(c.m)) t.mode = c.m; }
    else if (c.a === "k") { if (this.phase === "build" && this.wave > 0 && this.tick < this.nextWave) { for (const id in this.players) this.players[id].cash += 10 + this.wave; this.nextWave = this.tick; } else if (this.wave === 0) this.nextWave = this.tick; }
    // the dev menu (checked by the relay with the dev code): spawn robots, give cash, fix the core, jump to a wave
    else if (c.a === "d") {
      if (c.k === "spawn" && ENEMIES[c.e]) for (let i = 0; i < Math.min(50, c.n || 1); i++) this.queue.push({ t: this.tick + i * 6, e: c.e, m: c.m || 1 });
      if (c.k === "cash") p.cash += Math.max(0, Math.min(1e7, c.n || 0));
      if (c.k === "heal") this.base = this.baseMax;
      if (c.k === "wave" && c.n > 0) { this.wave = Math.max(0, Math.min(this.M.endless ? 999 : this.M.waves, (c.n | 0) - 1)); this.enemies = []; this.queue = []; this.phase = "build"; this.nextWave = this.tick + 40; }
    }
  }
  // ---- one step
  step() {
    if (this.over) return;
    this.tick++;
    const M = this.M;
    // waves
    if (this.phase === "build" && this.tick >= this.nextWave) {
      this.wave++; this.phase = "run";
      const list = waveList(M, this.wave, this.seed); let t = this.tick;
      for (const [e, m] of list) { this.queue.push({ t, e, m }); t += ENEMIES[e].boss ? 40 : Math.max(5, 16 - Math.floor(this.wave / 4)); }
      this.events.push({ k: "wave", w: this.wave, boss: list.some(([e]) => ENEMIES[e].boss) });
      if (M.endless && this.wave === 100 && !this.omega) { this.omega = true; this.events.push({ k: "omega" }); }
    }
    for (let i = this.queue.length - 1; i >= 0; i--) { const q = this.queue[i]; if (q.t <= this.tick) { this.queue.splice(i, 1); this.spawn(q.e, q.m, 0); } }
    // robots walk (slowed ones walk slower); medics + the titan repair their friends
    for (const e of this.enemies) {
      const E = ENEMIES[e.e], sl = e.slowT > 0 ? 1 - e.slow : 1; if (e.slowT > 0) e.slowT--;
      e.d += E.spd * sl * TICK;
      if (E.heal && this.tick % 10 === 0) for (const f of this.enemies) { const dx = f.x - e.x, dz = f.z - e.z; if (dx * dx + dz * dz < 12 && f.hp < f.max) f.hp = Math.min(f.max, f.hp + E.heal * (E.boss ? 1 : f.max / 60)); }
      const p = this.at(e.d); e.x = p.x; e.z = p.z;
    }
    // robots that got through hit your core
    for (let i = this.enemies.length - 1; i >= 0; i--) { const e = this.enemies[i]; if (e.d >= this.len) { this.enemies.splice(i, 1); this.base -= ENEMIES[e.e].hit; this.events.push({ k: "leak", e }); } }
    if (this.base <= 0) { this.base = 0; this.over = true; this.events.push({ k: "over" }); return; }
    // towers shoot
    for (const t of this.towers) {
      const T = towerById(t.id), S = statsOf(T, t.lv); t.cd--;
      if (t.cd > 0) continue;
      const inR = []; const r2 = S.rng * S.rng;
      for (const e of this.enemies) { const dx = e.x - t.x, dz = e.z - t.z; if (dx * dx + dz * dz <= r2) inR.push(e); }
      if (!inR.length) continue;
      t.cd = Math.max(1, Math.round(1 / (S.rate * TICK)));
      const order = this.order(inR, T.kind === "sniper" ? "strong" : t.mode, t);
      const hit = (e, dmg) => this.hurt(e, dmg, t);
      const first = order[0]; t.aimX = first.x; t.aimZ = first.z;
      if (T.kind === "gun" || T.kind === "sniper") { hit(first, S.dmg); this.events.push({ k: "shot", t, to: [[first.x, first.z]] }); }
      else if (T.kind === "splash" || T.kind === "slow") {
        const sr2 = T.sr * T.sr * (1 + 0.1 * t.lv), to = [[first.x, first.z]];
        for (const e of this.enemies.slice()) { const dx = e.x - first.x, dz = e.z - first.z; if (dx * dx + dz * dz <= sr2) { if (T.sl) { e.slow = Math.max(e.slow || 0, T.sl); e.slowT = 40; } hit(e, S.dmg); } }
        this.events.push({ k: T.kind === "slow" ? "frost" : "boom", t, to, r: T.sr });
      } else if (T.kind === "chain") {
        const to = []; let cur = first; const done = new Set();
        for (let i = 0; i < T.n + t.lv && cur; i++) {
          done.add(cur); to.push([cur.x, cur.z]); hit(cur, S.dmg * (1 - i * 0.08));
          let nx = null, nd = 36; for (const e of this.enemies) { if (done.has(e)) continue; const dx = e.x - cur.x, dz = e.z - cur.z, d2 = dx * dx + dz * dz; if (d2 < nd) { nd = d2; nx = e; } }
          cur = nx;
        }
        this.events.push({ k: "zap", t, to });
      } else if (T.kind === "multi" || T.kind === "beam") {
        const to = [];
        for (const e of order.slice(0, T.n + t.lv)) { to.push([e.x, e.z]); if (T.sl) { e.slow = Math.max(e.slow || 0, T.sl); e.slowT = 30; } hit(e, S.dmg); }
        this.events.push({ k: T.kind === "beam" ? "beam" : "multi", t, to });
      }
    }
    // dead robots: cash for everyone, splitters break apart
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]; if (e.hp > 0) continue;
      const E = ENEMIES[e.e]; this.enemies.splice(i, 1); this.kills++;
      for (const id in this.players) this.players[id].cash += Math.round(E.$ * (1 + this.wave * 0.02));
      if (e.by !== undefined && this.players[e.by]) this.players[e.by].kills++;
      if (E.split) for (let k = 0; k < E.split[1]; k++) this.spawn(E.split[0], e.m * (E.boss ? 1.5 : 1), Math.max(0, e.d - k * 0.7));
      if (E.boss) { this.bossKills++; this.events.push({ k: "bosskill", e }); if (!M.endless && this.wave === M.waves + 1) { this.won = true; } }
      this.events.push({ k: "die", e });
    }
    // wave over: everything spawned + destroyed
    if (this.phase === "run" && !this.queue.length && !this.enemies.length) {
      this.cleared = this.wave; this.phase = "build"; this.nextWave = this.tick + 8 / TICK;
      for (const id in this.players) this.players[id].cash += 20 + this.wave * 4;
      this.events.push({ k: "clear", w: this.wave });
      if (this.won || (!M.endless && this.wave >= M.waves + 1)) { this.won = true; this.over = true; this.events.push({ k: "win" }); }
    }
  }
  spawn(e, m, d) {
    const E = ENEMIES[e], hp = E.hp * m, p = this.at(d);
    const en = { id: this.nextE++, e, hp, max: hp, sh: (E.sh || 0) * m, shMax: (E.sh || 0) * m, d, x: p.x, z: p.z, m, slow: 0, slowT: 0 };
    this.enemies.push(en); this.events.push({ k: "spawn", e: en }); return en;
  }
  hurt(e, dmg, t) {
    const E = ENEMIES[e.e]; let d = Math.max(dmg * 0.2, dmg - (E.ar || 0));
    if (e.sh > 0) { const s = Math.min(e.sh, d); e.sh -= s; d -= s; }
    const real = Math.min(e.hp, d); e.hp -= d; if (e.hp <= 0) e.by = t.o;
    const p = this.players[t.o]; if (p) p.dmg += real;
  }
  order(list, mode, t) {
    const L = list.slice();
    if (mode === "first") L.sort((a, b) => b.d - a.d || a.id - b.id);
    else if (mode === "last") L.sort((a, b) => a.d - b.d || a.id - b.id);
    else if (mode === "strong") L.sort((a, b) => (b.hp + b.sh) - (a.hp + a.sh) || a.id - b.id);
    else L.sort((a, b) => ((a.x - t.x) * (a.x - t.x) + (a.z - t.z) * (a.z - t.z)) - ((b.x - t.x) * (b.x - t.x) + (b.z - t.z) * (b.z - t.z)) || a.id - b.id);
    return L;
  }
  // a quick fingerprint of the match (the host sends it now and then: if yours is different, you re-sync)
  hash() { let h = this.base * 7 + this.wave * 131 + this.towers.length * 17 + this.enemies.length * 3; for (const e of this.enemies) h = (h * 31 + Math.round(e.hp) + e.id) % 1000000007; return h; }
}
