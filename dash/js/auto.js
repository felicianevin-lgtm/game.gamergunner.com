// Autopilot: plays TURBO DASH from the upcoming obstacles. Used by the tests (and ?test mode)
// to prove every generated pattern can be survived.
import { LANES } from "./gen.js";

const tmp = [];
export function autopilot(sim) {
  if (!sim.alive || sim.pw.jetpack > 0) return;
  const d = sim.d, s = sim.speed, y = sim.y;
  tmp.length = 0; const objs = sim.ahead(d - 1, d + s * 1.6 + 14, tmp);
  const ramps = objs.filter((o) => o.kind === "ramp");
  // how far until each lane is blocked by something you cannot jump or slide past
  const block = [Infinity, Infinity, Infinity];
  for (const o of objs) {
    if (o.dead || o.kind !== "box" || o.z1 < d - 0.4) continue;
    if (y >= o.top - 0.45) continue; // (already up there)
    if (o.top <= 1.01) continue; // a barrier: jump it
    const r = ramps.find((q) => q.lane === o.lane && Math.abs(q.z1 - o.z0) < 0.2);
    if (r && (d < r.z1 - 1.5 || (sim.lane === o.lane && d > r.z0 - 0.5))) continue; // a ramp goes up onto it
    block[o.lane] = Math.min(block[o.lane], Math.max(0, o.z0 - d));
  }
  const sideFree = (l) => !objs.some((o) => !o.dead && o.kind === "box" && o.lane === l && o.z0 < d + 0.8 + s * 0.12 && o.z1 > d - 0.8 && y < o.top - 0.45);
  const cur = sim.target, settled = Math.abs(sim.x - LANES[cur]) < 0.35;
  if (block[cur] < s * 0.9 + 6 && settled) {
    let best = cur, bestV = block[cur];
    for (const l of [cur - 1, cur + 1]) {
      if (l < 0 || l > 2 || !sideFree(l)) continue;
      let v = block[l];
      const far = l + (l - cur);
      if (far >= 0 && far <= 2 && block[l] > s * 0.3 + 2) v = Math.max(v, block[far]);
      if (v > bestV + 0.5) { best = l; bestV = v; }
    }
    if (best !== cur) sim.move(best - cur);
    else if (block[cur] < s * 0.2 + 1.2 && sim.onGround) sim.jump(); // boxed in: hop up on it
  }
  // jumps and slides for whatever is in the lanes we are in
  for (const o of objs) {
    if (o.dead) continue;
    const dist = o.z0 - d;
    if (o.kind === "gap") { if (dist < s * 0.1 + 0.8 && dist > -1 && sim.onGround) sim.jump(); continue; }
    const ax = Math.abs(sim.x - LANES[o.lane]);
    if (ax > 1.45 && o.lane !== sim.target) continue;
    if (o.kind === "box" && o.top <= 1.01 && dist < s * 0.13 + 1.0 && dist > -0.6 && y < 0.6) sim.jump();
    if (o.kind === "bar" && dist < s * 0.12 + 1.2 && dist > -0.6 && !(sim.sliding && sim.slideT > 0.2)) sim.slide();
  }
}
