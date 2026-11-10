// THE BACKROOMS: the four levels. Each build(seed) returns a level the game (main.js) runs:
//   {name, sub, group (everything to draw), boxes (solid, {x0,x1,y0,y1,z0,z1}), floorY, water ([{x0,x1,z0,z1,top}]),
//    grid (maze cells for monsters to find their way), start {x,z,yaw}, exit {x,z,r}, monsters [{kind, x, z}],
//    rocks [{x,y,z}], fog, sky, hemi}
// Mazes are new every time you play a level. Sizes are in meters (you are 1.8 m tall).
import * as THREE from "/create/vendor/three.module.js";
import { mergeGeometries } from "/create/vendor/BufferGeometryUtils.js";

export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- textures (painted in code)
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const noise = (x, n, a, b, r) => { for (let i = 0; i < n; i++) { x.fillStyle = r() < 0.5 ? a : b; const s = 1 + r() * 3; x.fillRect(r() * 512, r() * 512, s, s); } };
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const r = rng(name.length * 977);
  const T = {
    wallpaper: () => canvasTex(256, (x, s) => { // mono-yellow wallpaper with faint stripes and a little pattern
      x.fillStyle = "#cdb85e"; x.fillRect(0, 0, s, s);
      for (let i = 0; i < s; i += 32) { x.fillStyle = "rgba(150,125,40,0.22)"; x.fillRect(i, 0, 3, s); }
      x.strokeStyle = "rgba(140,115,35,0.25)"; x.lineWidth = 2;
      for (let y = 8; y < s; y += 32) for (let i = 16; i < s; i += 32) { x.beginPath(); x.moveTo(i - 5, y); x.lineTo(i, y + 6); x.lineTo(i + 5, y); x.stroke(); }
      for (let i = 0; i < 6; i++) { const cx = r() * s, cy = r() * s, g = x.createRadialGradient(cx, cy, 1, cx, cy, 40); g.addColorStop(0, "rgba(120,95,30,0.18)"); g.addColorStop(1, "rgba(120,95,30,0)"); x.fillStyle = g; x.fillRect(0, 0, s, s); }
    }),
    carpet: () => canvasTex(256, (x, s) => { x.fillStyle = "#9a8642"; x.fillRect(0, 0, s, s); for (let i = 0; i < 5000; i++) { x.fillStyle = r() < 0.5 ? "rgba(70,55,20,0.25)" : "rgba(190,170,90,0.2)"; x.fillRect(r() * s, r() * s, 1.5, 1.5); } for (let i = 0; i < 4; i++) { x.fillStyle = "rgba(60,48,18,0.12)"; x.beginPath(); x.ellipse(r() * s, r() * s, 20 + r() * 40, 12 + r() * 30, r() * 3, 0, 7); x.fill(); } }),
    ceiling: () => canvasTex(128, (x, s) => { x.fillStyle = "#d8d2b8"; x.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { x.fillStyle = "rgba(120,110,80,0.25)"; x.fillRect(r() * s, r() * s, 1, 1); } x.strokeStyle = "#8a8266"; x.lineWidth = 3; x.strokeRect(0, 0, s, s); }),
    tile: () => canvasTex(256, (x, s) => { x.fillStyle = "#b9d3d8"; x.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 7 === 0 ? "#eef6f7" : "#f8fbfb"; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); } }),
    water: () => canvasTex(256, (x, s) => { x.fillStyle = "#3fb4d0"; x.fillRect(0, 0, s, s); x.strokeStyle = "rgba(220,255,255,0.45)"; x.lineWidth = 2; for (let i = 0; i < 40; i++) { x.beginPath(); const cx = r() * s, cy = r() * s; x.moveTo(cx, cy); x.bezierCurveTo(cx + 20, cy - 10, cx + 30, cy + 15, cx + 50, cy); x.stroke(); } }),
    party: () => canvasTex(256, (x, s) => { x.fillStyle = "#5b2d7a"; x.fillRect(0, 0, s, s); for (let i = 0; i < s; i += 64) { x.fillStyle = "#6c3a92"; x.fillRect(i, 0, 26, s); } const cs = ["#ff4fa3", "#ffd531", "#3fe0b0", "#4fb0ff", "#ff7a1a"]; for (let i = 0; i < 70; i++) { x.fillStyle = cs[i % 5]; x.save(); x.translate(r() * s, r() * s); x.rotate(r() * 3); x.fillRect(-4, -2, 8, 4); x.restore(); } }),
    partyfloor: () => canvasTex(256, (x, s) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? "#d93a5a" : "#f4e9d8"; x.fillRect(i * 64, j * 64, 64, 64); } const cs = ["#ff4fa3", "#ffd531", "#3fe0b0", "#4fb0ff"]; for (let i = 0; i < 50; i++) { x.fillStyle = cs[i % 4]; x.fillRect(r() * s, r() * s, 5, 3); } }),
    exit: () => canvasTex(256, (x) => { x.fillStyle = "#0a3a12"; x.fillRect(0, 0, 256, 96); x.fillStyle = "#4dff6a"; x.font = "bold 72px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("EXIT", 128, 50); }, false),
    escape: () => canvasTex(256, (x) => { x.fillStyle = "#3a2a00"; x.fillRect(0, 0, 256, 96); x.fillStyle = "#ffd531"; x.font = "bold 56px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("ESCAPE", 128, 50); }, false),
    birthday: () => canvasTex(512, (x) => { x.fillStyle = "#ff4fa3"; x.fillRect(0, 0, 512, 96); x.fillStyle = "#fff"; x.font = "bold 54px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("HAPPY BIRTHDAY =)", 256, 50); }, false),
  };
  TEX[name] = T[name]();
  return TEX[name];
}
const MAT = {};
function mat(name) {
  if (MAT[name]) return MAT[name];
  const m = {
    wall: () => new THREE.MeshLambertMaterial({ map: tex("wallpaper") }),
    carpet: () => new THREE.MeshLambertMaterial({ map: tex("carpet") }),
    ceiling: () => new THREE.MeshLambertMaterial({ map: tex("ceiling") }),
    light: () => new THREE.MeshBasicMaterial({ color: 0xfffbe6 }),
    tile: () => new THREE.MeshLambertMaterial({ map: tex("tile") }),
    party: () => new THREE.MeshLambertMaterial({ map: tex("party") }),
    partyfloor: () => new THREE.MeshLambertMaterial({ map: tex("partyfloor") }),
    dark: () => new THREE.MeshLambertMaterial({ color: 0x3a3228 }),
  }[name]();
  MAT[name] = m;
  return m;
}

// A box whose picture is tiled by its real size (uvs from world positions), so long walls don't stretch the wallpaper.
function boxGeo(x0, y0, z0, x1, y1, z1, size) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const u = nx > 0.5 ? p.getZ(i) : p.getX(i), v = ny > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, u / size, v / size);
  }
  return g;
}
// Collects boxes by material and merges them into a few big meshes (fast to draw).
function builder() {
  const parts = new Map(), boxes = [];
  return {
    boxes,
    add(m, x0, y0, z0, x1, y1, z1, size = 2.5, solid = true) {
      if (!parts.has(m)) parts.set(m, []);
      parts.get(m).push(boxGeo(x0, y0, z0, x1, y1, z1, size));
      if (solid) boxes.push({ x0, x1, y0, y1, z0, z1 });
    },
    done(group) {
      for (const [m, list] of parts) {
        for (let i = 0; i < list.length; i += 400) {
          const mesh = new THREE.Mesh(mergeGeometries(list.slice(i, i + 400)), mat(m));
          mesh.receiveShadow = false; group.add(mesh);
        }
      }
    },
  };
}

// ---------------------------------------------------------------- mazes
// A maze of W x H rooms (cell meters wide). east[i][j] = wall between (i,j) and (i+1,j); south[i][j] = between (i,j) and (i,j+1).
function maze(W, H, r, open) {
  const east = [], south = [], seen = [];
  for (let i = 0; i < W; i++) { east.push(Array(H).fill(true)); south.push(Array(H).fill(true)); seen.push(Array(H).fill(false)); }
  const path = [[0, 0]]; seen[0][0] = true;
  while (path.length) {
    const [i, j] = path[path.length - 1];
    const next = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H && !seen[a][b]);
    if (!next.length) { path.pop(); continue; }
    const [a, b] = next[Math.floor(r() * next.length)];
    if (a > i) east[i][j] = false; else if (a < i) east[a][b] = false; else if (b > j) south[i][j] = false; else south[a][b] = false;
    seen[a][b] = true; path.push([a, b]);
  }
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { if (r() < open) east[i][j] = false; if (r() < open) south[i][j] = false; }
  return { W, H, east, south };
}
// Rooms you can step to from (i, j).
export function neighbors(g, i, j) {
  const out = [];
  if (i < g.W - 1 && !g.east[i][j]) out.push([i + 1, j]);
  if (i > 0 && !g.east[i - 1][j]) out.push([i - 1, j]);
  if (j < g.H - 1 && !g.south[i][j]) out.push([i, j + 1]);
  if (j > 0 && !g.south[i][j - 1]) out.push([i, j - 1]);
  return out;
}
// Steps from (i, j) to every room (-1 = can't get there).
export function distances(g, i0, j0) {
  const d = Array.from({ length: g.W }, () => Array(g.H).fill(-1)), q = [[i0, j0]];
  d[i0][j0] = 0;
  while (q.length) { const [i, j] = q.shift(); for (const [a, b] of neighbors(g, i, j)) if (d[a][b] < 0) { d[a][b] = d[i][j] + 1; q.push([a, b]); } }
  return d;
}

// Builds a maze level (the Lobby, the Party rooms, the final level). style = {wall, floor, ceiling, cell, h}
function mazeLevel(seed, W, H, style, open) {
  const r = rng(seed), g = maze(W, H, r, open), C = style.cell, Hh = style.h, T = 0.3;
  const group = new THREE.Group(), B = builder();
  const x0 = -W * C / 2, z0 = -H * C / 2, X1 = -x0, Z1 = -z0;
  B.add(style.floor, x0 - 1, -0.5, z0 - 1, X1 + 1, 0, Z1 + 1, 3, false);
  B.add(style.ceiling, x0 - 1, Hh, z0 - 1, X1 + 1, Hh + 0.3, Z1 + 1, 1.2, false);
  // outside walls
  B.add(style.wall, x0 - T, 0, z0 - T, X1 + T, Hh, z0); B.add(style.wall, x0 - T, 0, Z1, X1 + T, Hh, Z1 + T);
  B.add(style.wall, x0 - T, 0, z0, x0, Hh, Z1); B.add(style.wall, X1, 0, z0, X1 + T, Hh, Z1);
  // inside walls (walls in a row become one)
  for (let i = 0; i < W - 1; i++) { let j = 0; while (j < H) { if (!g.east[i][j]) { j++; continue; } let k = j; while (k + 1 < H && g.east[i][k + 1]) k++; const x = x0 + (i + 1) * C; B.add(style.wall, x - T / 2, 0, z0 + j * C - T / 2, x + T / 2, Hh, z0 + (k + 1) * C + T / 2); j = k + 1; } }
  for (let j = 0; j < H - 1; j++) { let i = 0; while (i < W) { if (!g.south[i][j]) { i++; continue; } let k = i; while (k + 1 < W && g.south[k + 1][j]) k++; const z = z0 + (j + 1) * C; B.add(style.wall, x0 + i * C - T / 2, 0, z - T / 2, x0 + (k + 1) * C + T / 2, Hh, z + T / 2); i = k + 1; } }
  // ceiling lights (some flicker)
  const flicker = [], lightGeo = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if ((i + j) % 2 === 0 || r() < 0.3) {
    const cx = x0 + (i + 0.5) * C, cz = z0 + (j + 0.5) * C;
    if (r() < 0.12) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0xfffbe6 })); m.position.set(cx, Hh - 0.03, cz); group.add(m); flicker.push(m); }
    else lightGeo.push(boxGeo(cx - 0.6, Hh - 0.05, cz - 1.2, cx + 0.6, Hh, cz + 1.2, 1));
  }
  if (lightGeo.length) group.add(new THREE.Mesh(mergeGeometries(lightGeo), new THREE.MeshBasicMaterial({ color: style.lightColor || 0xfffbe6 })));
  B.done(group);
  const grid = { ...g, x0, z0, cell: C };
  const far = distances(g, 0, 0);
  let ei = 0, ej = 0;
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (far[i][j] > far[ei][ej]) { ei = i; ej = j; }
  const cellPos = (i, j) => ({ x: x0 + (i + 0.5) * C, z: z0 + (j + 0.5) * C });
  return { r, g, grid, group, boxes: B.boxes, cellPos, far, exitCell: [ei, ej], flicker, x0, z0, C, Hh };
}
// The glowing EXIT door on the wall of a room (on whichever side has a wall).
function exitDoor(L, i, j, label = "exit") {
  const { grid, cellPos, group, C } = L, p = cellPos(i, j);
  const sides = [[0, -1, !grid.south[i][j - 1] && j > 0], [0, 1, !grid.south[i][j] && j < grid.H - 1], [-1, 0, i > 0 && !grid.east[i - 1][j]], [1, 0, i < grid.W - 1 && !grid.east[i][j]]];
  const side = sides.find((s) => !s[2]) || [0, -1];
  const [dx, dz] = side, wx = p.x + dx * (C / 2 - 0.2), wz = p.z + dz * (C / 2 - 0.2);
  const door = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.15), new THREE.MeshLambertMaterial({ color: 0x5a4a32 }));
  frame.position.y = 1.2; door.add(frame);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.15), new THREE.MeshBasicMaterial({ color: label === "escape" ? 0xfff0a0 : 0xe8fff0 }));
  glow.position.set(0, 1.1, 0.08); door.add(glow);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: tex(label) }));
  sign.position.set(0, 2.65, 0.08); door.add(sign);
  door.position.set(wx, 0, wz); door.rotation.y = Math.atan2(-dx, -dz);
  group.add(door);
  const light = new THREE.PointLight(label === "escape" ? 0xffd531 : 0x6dff8a, 6, 9, 1.5); light.position.set(wx - dx * 1.2, 2, wz - dz * 1.2); group.add(light);
  return { x: wx - dx * 0.8, z: wz - dz * 0.8, r: 1.4 };
}
// A spot in a room far from (i0, j0) for a monster
function farCells(L, min, n) {
  const out = [];
  for (let i = 0; i < L.g.W; i++) for (let j = 0; j < L.g.H; j++) if (L.far[i][j] >= min) out.push([i, j]);
  for (let k = out.length - 1; k > 0; k--) { const m = Math.floor(L.r() * (k + 1)); [out[k], out[m]] = [out[m], out[k]]; }
  return out.slice(0, n);
}

// ---------------------------------------------------------------- the levels
export const LEVELS = [
  { name: "Level 0", sub: "The Lobby", goal: "Find the EXIT. Something lives in these halls.", build(seed) {
    const L = mazeLevel(seed, 11, 11, { wall: "wall", floor: "carpet", ceiling: "ceiling", cell: 6, h: 3.4 }, 0.25);
    const exit = exitDoor(L, ...L.exitCell);
    const [mc] = farCells(L, 9, 1), m = L.cellPos(...(mc || L.exitCell));
    return { group: L.group, boxes: L.boxes, floorY: 0, water: [], grid: L.grid, flicker: L.flicker, start: { ...L.cellPos(0, 0), yaw: -Math.PI * 0.75 }, exit,
      monsters: [{ kind: "bacteria", ...m }], rocks: [], fog: [0xb8a75a, 3, 34], bg: 0xb8a75a, hemi: [0xfff3c0, 0x6a5a28, 1.6], ceilingH: L.Hh };
  } },
  { name: "Level 37", sub: "The Poolrooms", goal: "Cross on the platforms. DON'T touch the water unless you have to. Throw rocks to distract it.", build(seed) {
    const r = rng(seed), group = new THREE.Group(), B = builder();
    const W = 13, LEN = 150, FLOOR = -0.9, WTOP = -0.25, CEIL = 7;
    // the pool floor, walls and ceiling: white tiles everywhere
    B.add("tile", -W - 1, FLOOR - 0.5, -10, W + 1, FLOOR, LEN + 10, 2, false);
    B.add("tile", -W - 1, CEIL, -10, W + 1, CEIL + 0.3, LEN + 10, 2, false);
    B.add("tile", -W - 1, FLOOR, -10, -W, CEIL, LEN + 10, 2); B.add("tile", W, FLOOR, -10, W + 1, CEIL, LEN + 10, 2);
    B.add("tile", -W, FLOOR, -11, W, CEIL, -10, 2); B.add("tile", -W, FLOOR, LEN + 10, W, CEIL, LEN + 11, 2);
    // dry floors at the start and the end
    B.add("tile", -W, FLOOR, -10, W, 0, 4, 2); B.add("tile", -W, FLOOR, LEN, W, 0, LEN + 10, 2);
    // the platforms: mostly jumpable, but some gaps are too far, so you have to step in
    const rocks = [];
    let z = 4, x = 0, n = 0;
    const plats = [];
    while (z < LEN - 6) {
      n++;
      const big = n % 4 === 0, gap = big ? 5.5 + r() * 2 : 1.4 + r() * 1.6;
      z += gap;
      const sx = 2.6 + r() * 2, sz = 2.6 + r() * 2;
      x = Math.max(-W + 3, Math.min(W - 3, x + (r() - 0.5) * 6));
      if (z + sz > LEN - 1) break;
      B.add("tile", x - sx / 2, FLOOR, z, x + sx / 2, 0, z + sz, 2);
      plats.push({ x, z: z + sz / 2 });
      if (n % 4 === 3 || r() < 0.15) rocks.push({ x: x + (r() - 0.5) * (sx - 1), y: 0.15, z: z + sz / 2 + (r() - 0.5) * (sz - 1) });
      z += sz;
    }
    // pillars standing in the water (not on the path) and arches overhead
    for (let i = 0; i < 26; i++) {
      const px = (r() < 0.5 ? -1 : 1) * (6 + r() * (W - 7)), pz = 8 + r() * (LEN - 16);
      if (plats.some((p) => Math.abs(p.x - px) < 4 && Math.abs(p.z - pz) < 4)) continue;
      B.add("tile", px - 0.8, FLOOR, pz - 0.8, px + 0.8, CEIL, pz + 0.8, 2);
    }
    for (let zz = 10; zz < LEN; zz += 20) B.add("tile", -W, CEIL - 1.2, zz, W, CEIL, zz + 1.2, 2, false);
    // lights: long panels in the ceiling
    const lg = [];
    for (let zz = -6; zz < LEN + 8; zz += 8) for (const xx of [-6, 0, 6]) lg.push(boxGeo(xx - 0.8, CEIL - 0.05, zz - 1.6, xx + 0.8, CEIL, zz + 1.6, 1));
    group.add(new THREE.Mesh(mergeGeometries(lg), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    B.done(group);
    // the water (see-through, the pattern drifts)
    const wt = tex("water").clone(); wt.needsUpdate = true; wt.repeat.set(6, 40);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, LEN - 4), new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: 0.72, color: 0x9fe6f5 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, WTOP, 4 + (LEN - 4) / 2); group.add(water);
    // exit door at the far end
    const door = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.2), new THREE.MeshLambertMaterial({ color: 0xe8eef0 })); frame.position.y = 1.25; door.add(frame);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshBasicMaterial({ color: 0xe8fff0 })); glow.position.set(0, 1.12, -0.11); glow.rotation.y = Math.PI; door.add(glow);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: tex("exit") })); sign.position.set(0, 2.75, -0.11); sign.rotation.y = Math.PI; door.add(sign);
    door.position.set(0, 0, LEN + 9.8); group.add(door);
    return { group, boxes: B.boxes, floorY: FLOOR, water: [{ x0: -W, x1: W, z0: 4, z1: LEN, top: WTOP }], grid: null, flicker: [],
      start: { x: 0, z: -4, yaw: Math.PI }, exit: { x: 0, z: LEN + 8.5, r: 1.6 }, monsters: [{ kind: "crawler", x: 0, z: LEN * 0.45 }], rocks, waterMesh: water,
      fog: [0xcfeef3, 8, 70], bg: 0xcfeef3, hemi: [0xffffff, 0x7fc6d6, 2.1], ceilingH: CEIL, pool: { W, LEN, FLOOR, WTOP } };
  } },
  { name: "Level Fun", sub: "The Party Rooms  =)", goal: "Find the EXIT. If a Partygoer sees you... RUN.", build(seed) {
    const L = mazeLevel(seed, 9, 9, { wall: "party", floor: "partyfloor", ceiling: "ceiling", cell: 9, h: 4, lightColor: 0xffe0f0 }, 0.42);
    const exit = exitDoor(L, ...L.exitCell);
    // balloons, cakes and banners
    const cols = [0xff4fa3, 0xffd531, 0x3fe0b0, 0x4fb0ff, 0xff7a1a, 0xd94fff];
    const bg = new THREE.SphereGeometry(0.35, 14, 10);
    for (let i = 0; i < L.g.W; i++) for (let j = 0; j < L.g.H; j++) {
      const p = L.cellPos(i, j);
      if (L.r() < 0.55) for (let k = 0; k < 3 + Math.floor(L.r() * 4); k++) {
        const b = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ color: cols[Math.floor(L.r() * cols.length)] }));
        b.scale.y = 1.2; b.position.set(p.x + (L.r() - 0.5) * 7, 2.4 + L.r() * 1.2, p.z + (L.r() - 0.5) * 7); L.group.add(b);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, b.position.y - 0.4, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff })); s.position.set(b.position.x, (b.position.y - 0.4) / 2, b.position.z); L.group.add(s);
      }
      if (L.r() < 0.18 && (i || j)) { // a party table with a cake
        const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.0), new THREE.MeshLambertMaterial({ color: 0xffffff })); t.position.set(p.x + 2, 0.4, p.z + 2); L.group.add(t);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0xff9ecb })); c.position.set(p.x + 2, 0.95, p.z + 2); L.group.add(c);
        L.boxes.push({ x0: p.x + 1.2, x1: p.x + 2.8, y0: 0, y1: 0.8, z0: p.z + 1.5, z1: p.z + 2.5 });
      }
      if (L.r() < 0.15) { const ban = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: tex("birthday"), side: THREE.DoubleSide })); ban.position.set(p.x, 3.4, p.z); ban.rotation.y = L.r() * 3; L.group.add(ban); }
    }
    const spots = farCells(L, 5, 2); // (just two of them)
    return { group: L.group, boxes: L.boxes, floorY: 0, water: [], grid: L.grid, flicker: L.flicker, start: { ...L.cellPos(0, 0), yaw: -Math.PI * 0.75 }, exit,
      monsters: spots.map(([i, j]) => ({ kind: "partygoer", ...L.cellPos(i, j) })), rocks: [], fog: [0x2a1030, 4, 40], bg: 0x2a1030, hemi: [0xffd8f0, 0x40204a, 1.5], ceilingH: L.Hh };
  } },
  { name: "Level 0", sub: "The Deep Lobby", goal: "The biggest maze yet. Captain Clark is hunting you. Find the way OUT.", build(seed) {
    const L = mazeLevel(seed, 17, 17, { wall: "wall", floor: "carpet", ceiling: "ceiling", cell: 6, h: 3.4 }, 0.22);
    const exit = exitDoor(L, ...L.exitCell, "escape");
    const [mc] = farCells(L, 12, 1), m = L.cellPos(...(mc || L.exitCell));
    return { group: L.group, boxes: L.boxes, floorY: 0, water: [], grid: L.grid, flicker: L.flicker, start: { ...L.cellPos(0, 0), yaw: -Math.PI * 0.75 }, exit, final: true,
      monsters: [{ kind: "clark", ...m }], rocks: [], fog: [0x8f7f3a, 3, 30], bg: 0x8f7f3a, hemi: [0xfff0b0, 0x4a3a18, 1.3], ceilingH: L.Hh };
  } },
];
