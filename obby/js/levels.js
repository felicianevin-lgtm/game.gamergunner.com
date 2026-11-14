// MEGA OBBY: the course. 200 stages, made the same way every time from the stage number (no level files).
// Each stage starts on a checkpoint pad and ends where the next stage's pad begins. It's built in its own "local"
// space (forward = +z, up = +y) and then turned to face the way the course is going: the course goes +z for 10
// stages, then +x for 10, then +z... (only 90° turns, so every box stays a plain axis-aligned box).
//
// A part: { k: kind, x, y, z (centre, world), w, h, d (size, world), c: colour, ...extra }
//   solid   a normal block                      kill    touch it and you go back to your checkpoint (red neon)
//   check   a checkpoint pad (s = stage number) vanish  disappears a moment after you touch it, comes back later
//   ktile   a checker tile that kills (red)     mover   slides back and forth (ax "x"/"z", amp, sp, ph)
//   spin    a red bar spinning round (len, sp)  laser   a red beam that blinks on and off (per, on, ph)
//   pad     a jump pad (pw = how high)          belt    a conveyor (bx, bz = push speed)
//   fall    drops after you stand on it         ramp    a slide (dir "x"/"z" + sign, y0 at the start, y1 at the end)
//   finish  the end of the course (the magic carpet!)

export const STAGES = 200;
export const PAD_LEN = 6;

export const ZONES = [
  { name: "Grassy Hills", sky: 0x8fd3ff, fog: 0xbfe6ff, a: 0x5bd16a, b: 0x8a6b4a, c: 0xffd23f },
  { name: "Candy Land", sky: 0xffc6ea, fog: 0xffe0f3, a: 0xff7ac8, b: 0x8ae0ff, c: 0xfff07a },
  { name: "Frozen Peaks", sky: 0xbfe8ff, fog: 0xe6f6ff, a: 0xdff4ff, b: 0x6fb8ff, c: 0x9ad8ff },
  { name: "Desert Ruins", sky: 0xffd9a0, fog: 0xffe8c4, a: 0xe8b86a, b: 0xb07a3a, c: 0x5fd0c0 },
  { name: "Lava Caves", sky: 0x3a1410, fog: 0x5a2010, a: 0x5a4a48, b: 0x2a2224, c: 0xffa040 },
  { name: "Jungle Temple", sky: 0x9adf9a, fog: 0xc8f0c0, a: 0x3aa04a, b: 0x7a6a40, c: 0xf0e070 },
  { name: "Neon City", sky: 0x0a0a24, fog: 0x14143a, a: 0x3a3aff, b: 0x1a1a3a, c: 0x3affe0 },
  { name: "Outer Space", sky: 0x020208, fog: 0x080818, a: 0x8a8aa8, b: 0x3a3a5a, c: 0xc08aff },
];
export const zoneOf = (s) => ZONES[Math.min(ZONES.length - 1, Math.floor((Math.max(1, s) - 1) / 25))];

export const TYPE_NAMES = {
  jumps: "Jump Blocks", kill: "Kill Bricks", vanish: "Vanishing Tiles", checker: "Checkerboard", slide: "Big Slide",
  movers: "Moving Platforms", spin: "Spinners", lasers: "Lasers", climb: "Tower Climb", beams: "Balance Beams",
  pads: "Jump Pads", belts: "Conveyors", fall: "Falling Floor", mix: "Mega Mix",
};
// which obstacle each stage is (the first few are easy, then everything mixes)
const POOL = ["jumps", "kill", "vanish", "checker", "slide", "movers", "spin", "lasers", "climb", "beams", "pads", "belts", "fall"];
export function stageType(s) {
  if (s === STAGES) return "mix";
  const intro = ["jumps", "kill", "jumps", "vanish", "checker", "slide", "movers", "kill", "climb", "spin", "beams", "lasers", "pads", "belts", "fall"];
  if (s <= intro.length) return intro[s - 1];
  if (s % 10 === 0) return "mix";
  // spread the types out so the same one doesn't come twice in a row
  const r = rng(s * 7919 + 13); let t = POOL[Math.floor(r() * POOL.length)];
  if (t === stageType(s - 1)) t = POOL[(POOL.indexOf(t) + 1 + Math.floor(r() * 5)) % POOL.length];
  return t;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- one stage, in its own local space
// returns { parts (local), len, dy }: the next pad starts at local (0, dy, len)
function buildLocal(s) {
  const r = rng(s * 1013 + 7), d = Math.min(1, (s - 1) / (STAGES - 1)), Z = zoneOf(s), P = [];
  const R = (a, b) => a + r() * (b - a);
  // a box by its TOP surface (y = where you stand)
  const box = (k, x, top, z, w, h, dd, c, extra) => { P.push({ k, x, y: top - h / 2, z, w, h, d: dd, c, ...(extra || {}) }); return P[P.length - 1]; };
  const kill = (x, y, z, w, h, dd, extra) => P.push({ k: "kill", x, y, z, w, h, d: dd, c: 0xff2a2a, ...(extra || {}) });
  box("check", 0, 0, PAD_LEN / 2, 8, 1, PAD_LEN, Z.c, { s });
  let z = PAD_LEN, y = 0;
  const T = stageType(s);
  const gap = () => R(1.6, 2.4) + d * 3.0; // (you can jump about 7.5 m)
  const size = () => Math.max(1.5, R(3.2, 4) - d * 2.1);
  const run = (type) => {
    switch (type) {
      case "jumps": {
        const n = 5 + Math.floor(d * 4);
        for (let i = 0; i < n; i++) { const g = gap(), sz = size(); z += g + sz / 2; y += R(-0.4, 1.0); box("solid", R(-1, 1) * (1 + d), y, z, sz, 1.2, sz, i % 2 ? Z.a : Z.b); z += sz / 2; }
        z += gap(); break;
      }
      case "kill": {
        const n = 4 + Math.floor(d * 5), L = n * 5 + 4;
        box("solid", 0, y, z + L / 2, 5, 1, L, Z.b);
        for (let i = 0; i < n; i++) {
          const kz = z + 4 + i * 5, h = R(0.5, 0.9) + d * 0.6;
          if (d > 0.3 && r() < 0.4) kill(0, y + h / 2, kz, 2, h, 0.6, { k: "kill", mv: { ax: "x", amp: 1.6, sp: 1.2 + d * 2, ph: r() * 6 } });
          else if (r() < 0.5) { kill(0, y + h / 2, kz, 5, h, 0.6); }
          else { const side = r() < 0.5 ? -1 : 1; kill(side * 1.25, y + 1.2, kz, 2.5, 2.4, 0.6); }
        }
        z += L; z += gap(); break;
      }
      case "vanish": {
        const n = 6 + Math.floor(d * 5), sz = Math.max(1.8, 3.2 - d * 1.2);
        let x = 0;
        for (let i = 0; i < n; i++) { z += sz + R(0.6, 1.4) + d * 1.6; x = Math.max(-3, Math.min(3, x + R(-2, 2))); y += R(-0.3, 0.6); box("vanish", x, y, z, sz, 0.5, sz, 0x6ad0ff, { t: 0.55 - d * 0.25 }); }
        z += sz / 2 + gap(); break;
      }
      case "checker": {
        const cols = 5, rows = 8 + Math.floor(d * 6), t = 2.4, W = cols * t;
        // carve a safe black path from the front to the back, then make tiles red
        const safe = new Set(); let c = 2;
        for (let row = 0; row < rows; row++) { safe.add(row * cols + c); if (r() < 0.6) { const nc = Math.max(0, Math.min(cols - 1, c + (r() < 0.5 ? -1 : 1))); safe.add(row * cols + nc); c = nc; } }
        const red = 0.35 + d * 0.4;
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          const isRed = !safe.has(row * cols + col) && r() < red;
          box(isRed ? "ktile" : "solid", -W / 2 + t / 2 + col * t, y, z + t / 2 + row * t, t, 0.6, t, isRed ? 0xff2a2a : ((row + col) % 2 ? 0x1a1a1e : 0x2c2c32));
        }
        z += rows * t; z += 1.2; box("solid", 0, y, z + 1, 6, 1, 2, Z.b); z += 2 + gap() * 0.7; break;
      }
      case "slide": {
        const L = 22 + d * 16, drop = 7 + d * 6;
        box("solid", 0, y, z + 2, 6, 1, 4, Z.b); z += 4;
        P.push({ k: "ramp", x: 0, y: y - drop / 2, z: z + L / 2, w: 6, h: drop, d: L, c: 0x9ae8ff, dir: "z", y0: y, y1: y - drop });
        // rails
        for (const sx of [-1, 1]) P.push({ k: "rail", x: sx * 3.15, y: y - drop / 2 + 0.4, z: z + L / 2, w: 0.3, h: 0.8, d: L, c: Z.c, dir: "z", y0: y + 0.4, y1: y - drop + 0.4 });
        // things to dodge on the slide (later stages)
        const nk = Math.floor(d * 5);
        for (let i = 0; i < nk; i++) { const f = 0.25 + (i / Math.max(1, nk)) * 0.6, kz = z + L * f, ky = y - drop * f; kill(r() < 0.5 ? -1.5 : 1.5, ky + 0.5, kz, 2.4, 0.9, 0.6); }
        z += L; y -= drop;
        box("solid", 0, y, z + 4, 7, 1, 8, Z.a); z += 8; z += gap(); break;
      }
      case "movers": {
        const n = 4 + Math.floor(d * 3);
        for (let i = 0; i < n; i++) { const sz = Math.max(2.4, 4 - d * 1.4); z += 2 + d * 1.5 + sz / 2; box("mover", 0, y, z, sz, 0.8, sz, Z.c, { mv: { ax: "x", amp: 3 + d * 2.5, sp: 0.8 + d * 1.2, ph: r() * 6 } }); z += sz / 2; }
        z += 2.5; break;
      }
      case "spin": {
        const n = 2 + Math.floor(d * 3), L = n * 10 + 2;
        box("solid", 0, y, z + L / 2, 12, 1, L, Z.b);
        for (let i = 0; i < n; i++) { const cz = z + 6 + i * 10; box("solid", 0, y + 0.8, cz, 1.2, 0.8, 1.2, 0x555560); P.push({ k: "spin", x: 0, y: y + 0.55, z: cz, len: 5.6, half: 0.3, sp: (r() < 0.5 ? -1 : 1) * (1.2 + d * 1.6), a: r() * 6 }); }
        z += L + gap(); break;
      }
      case "lasers": {
        const n = 4 + Math.floor(d * 4), L = n * 4.5 + 4;
        box("solid", 0, y, z + L / 2, 5, 1, L, 0x2a2a34);
        for (let i = 0; i < n; i++) {
          const lz = z + 4 + i * 4.5;
          for (const sx of [-1, 1]) box("solid", sx * 2.9, y + 3, lz, 0.6, 3, 0.6, 0x555560);
          P.push({ k: "laser", x: 0, y: y + 1.2, z: lz, w: 5, h: 2.4, d: 0.25, c: 0xff2040, per: 2.6 - d * 0.8, on: 0.5 + d * 0.15, ph: i * 0.37 });
        }
        z += L + gap() * 0.6; break;
      }
      case "climb": {
        const n = 6 + Math.floor(d * 4); let x = 0;
        for (let i = 0; i < n; i++) { const sz = Math.max(1.6, 3 - d * 1.1); z += sz / 2 + R(0.8, 1.6) + d; x = Math.max(-3, Math.min(3, x + (r() < 0.5 ? -1.8 : 1.8))); y += 1.3 + d * 0.5; box("solid", x, y, z, sz, 3, sz, i % 2 ? Z.a : Z.c); z += sz / 2; }
        z += gap(); break;
      }
      case "beams": {
        const n = 3 + Math.floor(d * 3), wdt = Math.max(0.55, 1.2 - d * 0.6); let x = 0;
        box("solid", 0, y, z + 1, 3, 0.5, 2, Z.c); z += 2;
        for (let i = 0; i < n; i++) {
          const L = 7 + r() * 4;
          box("solid", x, y, z + L / 2, wdt, 0.5, L, 0xb08a5a);
          if (d > 0.25 && r() < 0.6) kill(x, y + 0.45, z + L / 2, 0.8, 0.8, 0.8, { mv: { ax: "z", amp: L * 0.32, sp: 0.9 + d * 1.5, ph: r() * 6 } });
          z += L;
          const nx = (i % 2 ? -1 : 1) * R(1, 2.5);
          box("solid", (x + nx) / 2, y, z + 0.9, Math.abs(nx - x) + wdt + 1.2, 0.5, 1.8, Z.c); z += 1.8; x = nx;
        }
        z += gap() * 0.6; break;
      }
      case "pads": {
        const n = 3 + Math.floor(d * 2);
        for (let i = 0; i < n; i++) {
          z += gap() * 0.6 + 1.5; box("solid", 0, y, z, 3, 1, 3, Z.b); box("pad", 0, y + 0.25, z, 2, 0.25, 2, 0x3aff6a, { pw: 23 + d * 3 }); z += 1.5;
          const g = 7 + d * 3; z += g; y += 3 + r() * 2.5; box("solid", R(-1, 1), y, z + 2, 4, 1, 4, Z.a); z += 4;
        }
        z += gap(); break;
      }
      case "belts": {
        const n = 3 + Math.floor(d * 3);
        for (let i = 0; i < n; i++) {
          const L = 8 + r() * 4, back = r() < 0.5;
          const sp = 3 + d * 4;
          box("belt", 0, y, z + L / 2, 4, 0.8, L, 0x333340, back ? { bx: 0, bz: -sp } : { bx: (r() < 0.5 ? -1 : 1) * sp, bz: 0 });
          if (r() < 0.3 + d * 0.5) kill(R(-1, 1), y + 0.4, z + L / 2, 1.2, 0.8, 0.6);
          z += L; z += 1.5 + d * 2;
        }
        z += 1; break;
      }
      case "fall": {
        const n = 7 + Math.floor(d * 6), sz = Math.max(1.8, 3 - d);
        let x = 0;
        for (let i = 0; i < n; i++) { z += sz + 0.6 + d * 1.4; x = Math.max(-2.5, Math.min(2.5, x + R(-1.6, 1.6))); box("fall", x, y, z, sz, 0.6, sz, 0xd0a060, { t: 0.7 - d * 0.35 }); }
        z += sz / 2 + gap(); break;
      }
    }
  };
  if (T === "mix") { const a = POOL[Math.floor(r() * POOL.length)]; let b = POOL[Math.floor(r() * POOL.length)]; if (b === a) b = POOL[(POOL.indexOf(a) + 3) % POOL.length]; run(a); box("solid", 0, y, z + 2, 6, 1, 4, Z.b); z += 4 + 2; run(b); }
  else run(T);
  return { parts: P, len: z, dy: y, type: T };
}

// ---------------------------------------------------------------- the whole course (start of every stage, cached)
const starts = [];   // starts[s] = { x, y, z, dir (0 = +z, 1 = +x) }
function startOf(s) {
  if (starts[s]) return starts[s];
  if (s === 1) return (starts[1] = { x: 0, y: 0, z: 0, dir: 0 });
  const p = startOf(s - 1), L = buildLocal(s - 1), dir = Math.floor((s - 1) / 10) % 2;
  const pdir = p.dir;
  // move along the old stage's direction, then (if this stage turns) shift so the pads still line up
  const w = toWorld(pdir, 0, L.len);
  starts[s] = { x: p.x + w[0], y: p.y + L.dy, z: p.z + w[1], dir };
  return starts[s];
}
const toWorld = (dir, lx, lz) => (dir === 0 ? [lx, lz] : [lz, -lx]);
const axisW = (dir, ax) => (ax === "x" ? (dir === 0 ? "x" : "z") : (dir === 0 ? "z" : "x"));
const signW = (dir, ax) => (ax === "x" && dir === 1 ? -1 : 1);

// a stage, in the world: { s, type, parts, minY, start }
const cache = new Map();
export function stage(s) {
  if (cache.has(s)) return cache.get(s);
  const st = startOf(s), L = buildLocal(s), dir = st.dir;
  const parts = L.parts.map((p) => {
    const [wx, wz] = toWorld(dir, p.x, p.z), q = { ...p, x: st.x + wx, y: st.y + p.y, z: st.z + wz };
    if (dir === 1) { q.w = p.d; q.d = p.w; }
    if (p.mv) q.mv = { ...p.mv, ax: axisW(dir, p.mv.ax), amp: p.mv.amp * signW(dir, p.mv.ax) };
    if (p.k === "ramp" || p.k === "rail") { q.dir = axisW(dir, "z"); q.y0 = st.y + p.y0; q.y1 = st.y + p.y1; }
    if (p.k === "belt") { const [bx, bz] = toWorld(dir, p.bx, p.bz); q.bx = bx; q.bz = bz; }
    return q;
  });
  if (s === STAGES) { // the finish line, after the last stage
    const [wx, wz] = toWorld(dir, 0, L.len + 7);
    parts.push({ k: "finish", x: st.x + wx, y: st.y + L.dy - 0.5, z: st.z + wz, w: 14, h: 1, d: 14, c: 0xffd23f });
  }
  let minY = Infinity; for (const p of parts) minY = Math.min(minY, p.y - (p.h || 1) / 2);
  const out = { s, type: L.type, parts, minY, start: st, len: L.len, dir };
  cache.set(s, out);
  return out;
}
// where you stand at a checkpoint (and which way you face)
export function spawnOf(s) {
  if (s > STAGES) { const f = stage(STAGES).parts.find((p) => p.k === "finish"); return { x: f.x, y: f.y + f.h / 2, z: f.z, yaw: 0 }; }
  const st = startOf(s), [wx, wz] = toWorld(st.dir, 0, PAD_LEN / 2);
  return { x: st.x + wx, y: st.y, z: st.z + wz, yaw: st.dir === 0 ? 0 : Math.PI / 2 };
}
