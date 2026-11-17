// THE BACKROOMS: the five levels. Each build(seed) returns a level the game (main.js) runs:
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
    // the Parking Garage: stained concrete, a dark floor with oil spots and tire marks, painted cinder blocks, hazard stripes
    concrete: () => canvasTex(256, (x, s) => {
      x.fillStyle = "#8d8f8e"; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 6000; i++) { x.fillStyle = r() < 0.5 ? "rgba(40,40,40,0.18)" : "rgba(210,210,205,0.14)"; x.fillRect(r() * s, r() * s, 1.5, 1.5); }
      for (let i = 0; i < 7; i++) { const cx = r() * s, g = x.createLinearGradient(cx, 0, cx + 8, s); g.addColorStop(0, "rgba(50,45,35,0.25)"); g.addColorStop(1, "rgba(50,45,35,0)"); x.fillStyle = g; x.fillRect(cx, 0, 6 + r() * 10, s); } // (water stains running down)
      x.strokeStyle = "rgba(30,30,30,0.35)"; x.lineWidth = 2; x.strokeRect(0, 0, s, s);
    }),
    gfloor: () => canvasTex(256, (x, s) => {
      x.fillStyle = "#4a4c4e"; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 7000; i++) { x.fillStyle = r() < 0.5 ? "rgba(20,20,20,0.25)" : "rgba(150,150,150,0.12)"; x.fillRect(r() * s, r() * s, 1.5, 1.5); }
      for (let i = 0; i < 5; i++) { const cx = r() * s, cy = r() * s, g = x.createRadialGradient(cx, cy, 2, cx, cy, 30 + r() * 30); g.addColorStop(0, "rgba(8,8,10,0.55)"); g.addColorStop(1, "rgba(8,8,10,0)"); x.fillStyle = g; x.fillRect(0, 0, s, s); } // (oil)
      x.strokeStyle = "rgba(15,15,15,0.18)"; x.lineWidth = 9; for (let i = 0; i < 3; i++) { x.beginPath(); const y = r() * s; x.moveTo(0, y); x.bezierCurveTo(80, y + 40, 170, y - 40, s, y + 10); x.stroke(); } // (tire marks)
    }),
    cinder: () => canvasTex(256, (x, s) => {
      x.fillStyle = "#a9b0a2"; x.fillRect(0, 0, s, s);
      x.fillStyle = "rgba(60,64,56,0.55)"; for (let y = 0; y < s; y += 32) { x.fillRect(0, y, s, 3); for (let i = ((y / 32) % 2) * 32; i < s; i += 64) x.fillRect(i, y, 3, 32); }
      for (let i = 0; i < 2500; i++) { x.fillStyle = "rgba(70,70,60,0.18)"; x.fillRect(r() * s, r() * s, 1.5, 1.5); }
    }),
    hazard: () => canvasTex(128, (x, s) => { x.fillStyle = "#e0b81c"; x.fillRect(0, 0, s, s); x.fillStyle = "#151515"; for (let i = -s; i < s * 2; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 - s, s); x.lineTo(i - s, s); x.fill(); } }),
    b3: () => canvasTex(128, (x) => { x.fillStyle = "#1d3b6a"; x.fillRect(0, 0, 128, 128); x.fillStyle = "#f2f2f2"; x.font = "bold 70px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("B3", 64, 68); }, false),
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
    concrete: () => new THREE.MeshLambertMaterial({ map: tex("concrete") }),
    gfloor: () => new THREE.MeshLambertMaterial({ map: tex("gfloor") }),
    gceiling: () => new THREE.MeshLambertMaterial({ map: tex("concrete"), color: 0x6c6e70 }),
    cinder: () => new THREE.MeshLambertMaterial({ map: tex("cinder") }),
    hazard: () => new THREE.MeshLambertMaterial({ map: tex("hazard") }),
    paint: () => new THREE.MeshLambertMaterial({ color: 0xd8c040 }),
    tube: () => new THREE.MeshBasicMaterial({ color: 0xdcecff }),
    metal: () => new THREE.MeshLambertMaterial({ color: 0x4d555c }),
    shelf: () => new THREE.MeshLambertMaterial({ color: 0x6f7378 }),
    cardboard: () => new THREE.MeshLambertMaterial({ color: 0xa27c4e }),
    wood: () => new THREE.MeshLambertMaterial({ color: 0x6b4b2e }),
    glass: () => new THREE.MeshLambertMaterial({ color: 0x1a2128 }),
    tire: () => new THREE.MeshLambertMaterial({ color: 0x141414 }),
  }[name]?.() || new THREE.MeshLambertMaterial({ color: Number(name.split(":")[1]) || 0x777777 }); // ("car:0x2a4f80" = a car's paint)
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

// Builds a maze level (the Lobby, the Party rooms, the final level). style = {wall, floor, ceiling, cell, h, flicker}
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
    if (r() < (style.flicker || 0.12)) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0xfffbe6 })); m.position.set(cx, Hh - 0.03, cz); group.add(m); flicker.push(m); }
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


// ---------------------------------------------------------------- level builders (Backrooms Survival builds its levels with these too)
// Monsters in a maze: mons = {clark: 1, bacteria: 2, partygoer: 1}. Each starts in a room at least `min` steps from where you start
// (closer if the maze is too small for that many).
function spawn(L, mons, min) {
  const list = [];
  for (const k of ["clark", "bacteria", "partygoer"]) for (let i = 0; i < (mons[k] || 0); i++) list.push(k);
  let cells = [];
  for (let m = min; m >= 2 && cells.length < list.length; m--) cells = farCells(L, m, list.length);
  return list.map((kind, i) => ({ kind, ...L.cellPos(...(cells[i % Math.max(1, cells.length)] || L.exitCell)) }));
}
const THEMES = {
  lobby: { style: { wall: "wall", floor: "carpet", ceiling: "ceiling" }, fog: [0xb8a75a, 3, 34], bg: 0xb8a75a, hemi: [0xfff3c0, 0x6a5a28, 1.6] },
  deep: { style: { wall: "wall", floor: "carpet", ceiling: "ceiling" }, fog: [0x8f7f3a, 3, 30], bg: 0x8f7f3a, hemi: [0xfff0b0, 0x4a3a18, 1.3] },
  dark: { style: { wall: "wall", floor: "carpet", ceiling: "ceiling", lightColor: 0xcfc28a, flicker: 0.4 }, fog: [0x2e2912, 2, 20], bg: 0x2e2912, hemi: [0xd8c890, 0x2a2210, 0.85] },
  red: { style: { wall: "wall", floor: "carpet", ceiling: "ceiling", lightColor: 0xff6a50, flicker: 0.25 }, fog: [0x4a0e0a, 2, 24], bg: 0x4a0e0a, hemi: [0xff9a80, 0x300808, 1.1] },
  party: { style: { wall: "party", floor: "partyfloor", ceiling: "ceiling", lightColor: 0xffe0f0 }, fog: [0x2a1030, 4, 40], bg: 0x2a1030, hemi: [0xffd8f0, 0x40204a, 1.5], party: true },
};
// A maze level. o = {W, H, theme: lobby | deep | dark | red | party, mons, min, open, final}
// Captain Clark is very tall, so a maze with him in it gets a higher ceiling.
export function mazeBuild(seed, o) {
  const T = THEMES[o.theme || "lobby"], mons = o.mons || {};
  const L = mazeLevel(seed, o.W, o.H, { ...T.style, cell: o.cell || (T.party ? 9 : 6), h: o.h || (mons.clark ? 4.6 : T.party ? 4 : 3.4) }, o.open ?? (T.party ? 0.42 : 0.25));
  const exit = exitDoor(L, ...L.exitCell, o.final ? "escape" : "exit");
  if (T.party) partyDecor(L);
  return { group: L.group, boxes: L.boxes, floorY: 0, water: [], grid: L.grid, flicker: L.flicker, start: { ...L.cellPos(0, 0), yaw: -Math.PI * 0.75 }, exit, final: !!o.final,
    monsters: spawn(L, mons, o.min ?? Math.floor((o.W + o.H) / 3)), rocks: [], fog: T.fog, bg: T.bg, hemi: T.hemi, ceilingH: L.Hh, party: !!T.party };
}
// Balloons, cakes and banners (Level Fun)
function partyDecor(L) {
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
}
// The Poolrooms. o = {len (meters of pool), crawlers (how many water monsters)}. More crawlers = a few more rocks to throw.
export function poolBuild(seed, o = {}) {
  const r = rng(seed), group = new THREE.Group(), B = builder();
  const W = 13, LEN = o.len || 150, FLOOR = -0.9, WTOP = -0.25, CEIL = 7, NC = o.crawlers || 1;
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
    if (n % 4 === 3 || r() < 0.15 + 0.06 * (NC - 1)) rocks.push({ x: x + (r() - 0.5) * (sx - 1), y: 0.15, z: z + sz / 2 + (r() - 0.5) * (sz - 1) });
    z += sz;
  }
  // pillars standing in the water (not on the path) and arches overhead
  for (let i = 0; i < 26 * LEN / 150; i++) {
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
  const wt = tex("water").clone(); wt.needsUpdate = true; wt.repeat.set(6, 40 * LEN / 150);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, LEN - 4), new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: 0.72, color: 0x9fe6f5 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, WTOP, 4 + (LEN - 4) / 2); group.add(water);
  // exit door at the far end
  const door = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.2), new THREE.MeshLambertMaterial({ color: 0xe8eef0 })); frame.position.y = 1.25; door.add(frame);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshBasicMaterial({ color: 0xe8fff0 })); glow.position.set(0, 1.12, -0.11); glow.rotation.y = Math.PI; door.add(glow);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: tex("exit") })); sign.position.set(0, 2.75, -0.11); sign.rotation.y = Math.PI; door.add(sign);
  door.position.set(0, 0, LEN + 9.8); group.add(door);
  const monsters = [];
  for (let k = 0; k < NC; k++) monsters.push({ kind: "crawler", x: (k % 2 ? 1 : -1) * (k ? 5 : 0), z: LEN * (NC === 1 ? 0.45 : 0.25 + 0.6 * k / (NC - 1)) });
  return { group, boxes: B.boxes, floorY: FLOOR, water: [{ x0: -W, x1: W, z0: 4, z1: LEN, top: WTOP }], grid: null, flicker: [],
    start: { x: 0, z: -4, yaw: Math.PI }, exit: { x: 0, z: LEN + 8.5, r: 1.6 }, monsters, rocks, waterMesh: water,
    fog: [0xcfeef3, 8, 70], bg: 0xcfeef3, hemi: [0xffffff, 0x7fc6d6, 2.1], ceilingH: CEIL, pool: { W, LEN, FLOOR, WTOP } };
}

// ---------------------------------------------------------------- Sublevel B3: the Parking Garage
// A huge, dark underground parking garage: big concrete pillars, rows of parked cars, buzzing lights. Little rooms
// (Storage, Electrical, Janitor, Office...) each have one door; the KEY is in one of them. The EXIT is locked until you
// have it. Skinwalkers wearing a mask of YOUR face (creatures.js) walk the garage looking for you.
// It's built on a grid of 5 m cells, like a maze with almost no walls, so monsters can find their way around the cars
// and in and out of the rooms. A cell with a car in it is closed off in the grid.
function signTex(text) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d"); x.fillStyle = "#1c2226"; x.fillRect(0, 0, 256, 64); x.strokeStyle = "#c9d2d8"; x.lineWidth = 4; x.strokeRect(4, 4, 248, 56);
  x.fillStyle = "#e8eef2"; x.font = "bold " + (text.length > 9 ? 30 : 38) + "px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const CAR_COLORS = ["car:0x2a4f80", "car:0x7a1f1f", "car:0x3c4a3a", "car:0xb9b9b4", "car:0x1d1d22", "car:0x6a5a3a", "car:0x4a5866"];
export function garageBuild(seed, o = {}) {
  for (let k = 0; k < 60; k++) { const L = garageTry(seed + k * 7919, o); if (L) return L; }
  return garageTry(seed, { ...o, rooms: 4, cars: false, force: true });
}
function garageTry(seed, o) {
  const r = rng(seed), W = o.W || 14, H = o.H || 14, C = 5, Hh = 4.4, T = 0.3;
  const east = [], south = [], room = [], car = [];
  for (let i = 0; i < W; i++) { east.push(Array(H).fill(false)); south.push(Array(H).fill(false)); room.push(Array(H).fill(-1)); car.push(Array(H).fill(false)); }
  const g = { W, H, east, south };
  const inG = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
  const shut = (i, j, a, b) => { if (!inG(a, b)) return; if (a !== i) east[Math.min(i, a)][j] = true; else south[i][Math.min(j, b)] = true; }; // (wall between two cells, in the grid)
  const nearStart = (i, j) => i < 3 && j < 3, nearExit = (i, j) => i > W - 4 && j > H - 3;
  // the little rooms (1 or 2 cells, never touching each other)
  const names = ["STORAGE", "ELECTRICAL", "JANITOR", "OFFICE", "SECURITY", "LOST + FOUND", "TICKETS", "MAINTENANCE", "BOILER ROOM"];
  for (let k = names.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [names[k], names[m]] = [names[m], names[k]]; }
  const rooms = [], nR = o.rooms || 7;
  for (let tries = 0; tries < 400 && rooms.length < nR; tries++) {
    const w = r() < 0.35 ? 2 : 1, h = w === 1 && r() < 0.3 ? 2 : 1;
    const i0 = Math.floor(r() * (W - w + 1)), j0 = Math.floor(r() * (H - h + 1));
    let ok = true;
    for (let i = i0 - 1; i <= i0 + w && ok; i++) for (let j = j0 - 1; j <= j0 + h && ok; j++) if (inG(i, j) && (room[i][j] >= 0 || nearStart(i, j) || nearExit(i, j))) ok = false;
    if (!ok) continue;
    const doors = []; // (a side of one of its cells that opens onto the garage, not onto the outside wall)
    for (let i = i0; i < i0 + w; i++) { if (j0 > 0) doors.push([i, j0, 0, -1]); if (j0 + h < H) doors.push([i, j0 + h - 1, 0, 1]); }
    for (let j = j0; j < j0 + h; j++) { if (i0 > 0) doors.push([i0, j, -1, 0]); if (i0 + w < W) doors.push([i0 + w - 1, j, 1, 0]); }
    const door = doors[Math.floor(r() * doors.length)], id = rooms.length;
    for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + h; j++) room[i][j] = id;
    rooms.push({ id, i0, j0, w, h, door, name: names[id % names.length] });
  }
  if (rooms.length < Math.min(nR, 4) && !o.force) return null;
  const isDoor = (R, i, j, dx, dz) => R.door[0] === i && R.door[1] === j && R.door[2] === dx && R.door[3] === dz;
  for (const R of rooms) for (let i = R.i0; i < R.i0 + R.w; i++) for (let j = R.j0; j < R.j0 + R.h; j++)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inG(i + dx, j + dz) && room[i + dx][j + dz] !== R.id && !isDoor(R, i, j, dx, dz)) shut(i, j, i + dx, j + dz);
  // rows of parked cars (aisles every 4th column so you can get through)
  const doorFront = (i, j) => rooms.some((R) => R.door[0] + R.door[2] === i && R.door[1] + R.door[3] === j);
  if (o.cars !== false) for (let j = 1; j < H - 1; j += 3) for (let i = 0; i < W; i++) {
    if (i % 4 === 0 || room[i][j] >= 0 || nearStart(i, j) || nearExit(i, j) || doorFront(i, j) || r() < 0.22) continue;
    car[i][j] = true;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) shut(i, j, a, b);
  }
  // every cell you can stand in has to be reachable from the start (else try another layout)
  const far = distances(g, 0, 0);
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (!car[i][j] && far[i][j] < 0 && !o.force) return null;

  // ---- build it
  const group = new THREE.Group(), B = builder(), x0 = -W * C / 2, z0 = -H * C / 2, X1 = -x0, Z1 = -z0;
  const cx0 = (i) => x0 + i * C, cz0 = (j) => z0 + j * C, mid = (i, j) => ({ x: x0 + (i + 0.5) * C, z: z0 + (j + 0.5) * C });
  B.add("gfloor", x0 - 1, -0.5, z0 - 1, X1 + 1, 0, Z1 + 1, 4, false);
  B.add("gceiling", x0 - 1, Hh, z0 - 1, X1 + 1, Hh + 0.3, Z1 + 1, 4, false);
  for (let j = 1; j < H; j++) B.add("gceiling", x0, Hh - 0.45, cz0(j) - 0.25, X1, Hh, cz0(j) + 0.25, 4, false); // (beams overhead)
  B.add("concrete", x0 - T, 0, z0 - T, X1 + T, Hh, z0, 4); B.add("concrete", x0 - T, 0, Z1, X1 + T, Hh, Z1 + T, 4);
  B.add("concrete", x0 - T, 0, z0, x0, Hh, Z1, 4); B.add("concrete", X1, 0, z0, X1 + T, Hh, Z1, 4);
  B.add("hazard", x0, 0, z0, X1, 0.5, z0 + 0.02, 1, false); B.add("hazard", x0, 0, Z1 - 0.02, X1, 0.5, Z1, 1, false); // (stripes along the bottom of the outside walls)
  B.add("hazard", x0, 0, z0, x0 + 0.02, 0.5, Z1, 1, false); B.add("hazard", X1 - 0.02, 0, z0, X1, 0.5, Z1, 1, false);
  // the rooms: cinder-block walls up to the ceiling, one doorway each with a sign over it
  const DW = 1.7; // (doorway width)
  const lintels = [];
  for (const R of rooms) for (let i = R.i0; i < R.i0 + R.w; i++) for (let j = R.j0; j < R.j0 + R.h; j++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inG(i + dx, j + dz) || room[i + dx][j + dz] === R.id) continue;
    const door = isDoor(R, i, j, dx, dz);
    if (dx) { // a wall running along z
      const x = dx > 0 ? cx0(i + 1) : cx0(i), a = cz0(j), b = cz0(j + 1), m = (a + b) / 2;
      if (!door) B.add("cinder", x - T / 2, 0, a - T / 2, x + T / 2, Hh, b + T / 2, 3);
      else { B.add("cinder", x - T / 2, 0, a - T / 2, x + T / 2, Hh, m - DW / 2, 3); B.add("cinder", x - T / 2, 0, m + DW / 2, x + T / 2, Hh, b + T / 2, 3); B.add("cinder", x - T / 2, 2.35, m - DW / 2, x + T / 2, Hh, m + DW / 2, 3, false); B.add("metal", x - T / 2 - 0.03, 0, m - DW / 2 - 0.08, x + T / 2 + 0.03, 2.35, m - DW / 2, 1, false); B.add("metal", x - T / 2 - 0.03, 0, m + DW / 2, x + T / 2 + 0.03, 2.35, m + DW / 2 + 0.08, 1, false); lintels.push({ R, x: x + dx * (T / 2 + 0.02), z: m, dx, dz }); }
    } else { // a wall running along x
      const z = dz > 0 ? cz0(j + 1) : cz0(j), a = cx0(i), b = cx0(i + 1), m = (a + b) / 2;
      if (!door) B.add("cinder", a - T / 2, 0, z - T / 2, b + T / 2, Hh, z + T / 2, 3);
      else { B.add("cinder", a - T / 2, 0, z - T / 2, m - DW / 2, Hh, z + T / 2, 3); B.add("cinder", m + DW / 2, 0, z - T / 2, b + T / 2, Hh, z + T / 2, 3); B.add("cinder", m - DW / 2, 2.35, z - T / 2, m + DW / 2, Hh, z + T / 2, 3, false); B.add("metal", m - DW / 2 - 0.08, 0, z - T / 2 - 0.03, m - DW / 2, 2.35, z + T / 2 + 0.03, 1, false); B.add("metal", m + DW / 2, 0, z - T / 2 - 0.03, m + DW / 2 + 0.08, 2.35, z + T / 2 + 0.03, 1, false); lintels.push({ R, x: m, z: z + dz * (T / 2 + 0.02), dx, dz }); }
    }
  }
  for (const d of lintels) { // the room's name over its door
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshBasicMaterial({ map: signTex(d.R.name), color: 0xb8c0c6 }));
    s.position.set(d.x, 2.75, d.z); s.rotation.y = Math.atan2(d.dx, d.dz); group.add(s);
  }
  // inside the rooms: metal shelves with boxes, desks, a bare bulb
  const solid = (x0_, y0, z0_, x1, y1, z1_) => B.boxes.push({ x0: x0_, x1, y0, y1, z0: z0_, z1: z1_ });
  const bulbs = [];
  const sides = (R, i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => !(inG(i + dx, j + dz) && room[i + dx][j + dz] === R.id) && !isDoor(R, i, j, dx, dz));
  // a piece of furniture against the (dx, dz) wall of cell (i, j): len along the wall, dep out from it
  const against = (i, j, dx, dz, len, dep) => {
    const p = mid(i, j), w0 = C / 2 - T / 2 - 0.05;
    if (dx) { const x = p.x + dx * w0, xa = Math.min(x, x - dx * dep), xb = Math.max(x, x - dx * dep); return { x0: xa, x1: xb, z0: p.z - len / 2, z1: p.z + len / 2, cx: (xa + xb) / 2, cz: p.z }; }
    const z = p.z + dz * w0, za = Math.min(z, z - dz * dep), zb = Math.max(z, z - dz * dep); return { x0: p.x - len / 2, x1: p.x + len / 2, z0: za, z1: zb, cx: p.x, cz: (za + zb) / 2 };
  };
  let keySpot = null;
  const byFar = rooms.slice().sort((a, b) => far[b.door[0]][b.door[1]] - far[a.door[0]][a.door[1]]);
  const keyRoom = byFar[Math.floor(r() * Math.max(1, Math.ceil(byFar.length / 2)))];
  for (const R of rooms) {
    let desk = false;
    for (let i = R.i0; i < R.i0 + R.w; i++) for (let j = R.j0; j < R.j0 + R.h; j++) {
      const p = mid(i, j); bulbs.push(boxGeo(p.x - 0.08, Hh - 0.35, p.z - 0.08, p.x + 0.08, Hh - 0.2, p.z + 0.08, 1));
      B.add("metal", p.x - 0.01, Hh - 0.2, p.z - 0.01, p.x + 0.01, Hh, p.z + 0.01, 1, false);
      const ws = sides(R, i, j);
      for (let k = ws.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [ws[k], ws[m]] = [ws[m], ws[k]]; }
      if (ws[0]) { // shelves
        const s = against(i, j, ws[0][0], ws[0][1], 3.0, 0.55); solid(s.x0, 0, s.z0, s.x1, 2.1, s.z1);
        const along = ws[0][0] ? "z" : "x";
        for (const e of [0, 1]) for (const f of [0, 1]) { const px = along === "z" ? (f ? s.x1 - 0.05 : s.x0) : (e ? s.x1 - 0.05 : s.x0), pz = along === "z" ? (e ? s.z1 - 0.05 : s.z0) : (f ? s.z1 - 0.05 : s.z0); B.add("shelf", px, 0, pz, px + 0.05, 2.1, pz + 0.05, 1, false); }
        for (const y of [0.15, 0.75, 1.35, 1.95]) {
          B.add("shelf", s.x0, y, s.z0, s.x1, y + 0.04, s.z1, 1, false);
          for (let b = 0; b < 3; b++) if (r() < 0.6) { const u = 0.25 + r() * 0.5, sz = 0.25 + r() * 0.2, bx = along === "z" ? s.cx : s.x0 + u * (s.x1 - s.x0), bz = along === "z" ? s.z0 + u * (s.z1 - s.z0) : s.cz; B.add("cardboard", bx - sz / 2, y + 0.04, bz - sz / 2, bx + sz / 2, y + 0.04 + sz * 0.8, bz + sz / 2, 1, false); }
        }
      }
      if (ws[1] && (!desk || r() < 0.3)) { // a desk (the key is on one of these)
        desk = true;
        const d = against(i, j, ws[1][0], ws[1][1], 1.5, 0.75); solid(d.x0, 0, d.z0, d.x1, 0.78, d.z1);
        B.add("wood", d.x0, 0.72, d.z0, d.x1, 0.78, d.z1, 1, false);
        for (const [a, b] of [[d.x0, d.z0], [d.x1 - 0.06, d.z0], [d.x0, d.z1 - 0.06], [d.x1 - 0.06, d.z1 - 0.06]]) B.add("metal", a, 0, b, a + 0.06, 0.72, b + 0.06, 1, false);
        if (R === keyRoom && !keySpot) keySpot = { x: d.cx, y: 0.86, z: d.cz };
      }
      if (r() < 0.6) { const p2 = mid(i, j), q = 1.4, bx = p2.x + (r() < 0.5 ? -q : q), bz = p2.z + (r() < 0.5 ? -q : q); B.add("cardboard", bx - 0.3, 0, bz - 0.3, bx + 0.3, 0.55, bz + 0.3, 1); } // (a box on the floor in a corner)
    }
    if (R === keyRoom && !keySpot) { const p = mid(R.door[0], R.door[1]); keySpot = { x: p.x, y: 0.12, z: p.z }; }
  }
  if (bulbs.length) group.add(new THREE.Mesh(mergeGeometries(bulbs), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })));
  // big concrete pillars at the corners of every other cell (B3 painted on them, hazard stripes at the bottom)
  const signM = new THREE.MeshLambertMaterial({ map: tex("b3") }), signG = new THREE.PlaneGeometry(0.5, 0.5);
  for (let i = 2; i < W; i += 2) for (let j = 2; j < H; j += 2) {
    if ([[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].some(([a, b]) => room[a][b] >= 0)) continue;
    const x = cx0(i), z = cz0(j), s = 0.45;
    B.add("concrete", x - s, 0, z - s, x + s, Hh, z + s, 2);
    B.add("hazard", x - s - 0.02, 0, z - s - 0.02, x + s + 0.02, 0.9, z + s + 0.02, 1, false);
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const m = new THREE.Mesh(signG, signM); m.position.set(x + dx * (s + 0.01), 2.3, z + dz * (s + 0.01)); m.rotation.y = Math.atan2(dx, dz); group.add(m); }
  }
  // the parked cars and the yellow lines between them
  for (let j = 1; j < H - 1; j += 3) for (let i = 0; i <= W; i++) {
    if ((inG(i, j) && room[i][j] >= 0) || (inG(i - 1, j) && room[i - 1][j] >= 0)) continue;
    const x = cx0(i); B.add("paint", x - 0.06, 0, cz0(j) + 0.4, x + 0.06, 0.012, cz0(j + 1) - 0.4, 1, false);
  }
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (car[i][j]) {
    const p = mid(i, j), col = CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], x = p.x + (r() - 0.5) * 0.5, z = p.z + (r() - 0.5) * 0.4, f = r() < 0.5 ? 1 : -1;
    B.add(col, x - 0.95, 0.28, z - 2.2, x + 0.95, 0.95, z + 2.2, 2); // body
    B.add("glass", x - 0.82, 0.95, z - 1.1 + f * 0.25, x + 0.82, 1.45, z + 1.1 + f * 0.25, 2); // cabin (dark windows)
    B.add(col, x - 0.84, 1.45, z - 0.95 + f * 0.25, x + 0.84, 1.52, z + 0.95 + f * 0.25, 2, false); // roof
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add("tire", x + sx * 0.97 - 0.13, 0, z + sz * 1.4 - 0.33, x + sx * 0.97 + 0.13, 0.62, z + sz * 1.4 + 0.33, 1, false);
    B.add("tube", x - 0.8, 0.62, z + f * 2.2 - 0.02 * f, x - 0.5, 0.78, z + f * 2.2 + 0.03 * f, 1, false); B.add("tube", x + 0.5, 0.62, z + f * 2.2 - 0.02 * f, x + 0.8, 0.78, z + f * 2.2 + 0.03 * f, 1, false);
  }
  // long fluorescent tubes (some flicker)
  const flicker = [], tubes = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (room[i][j] < 0 && ((i + j) % 2 === 0 || r() < 0.25)) {
    const p = mid(i, j);
    if (r() < 0.18) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 2.6), new THREE.MeshBasicMaterial({ color: 0xdcecff })); m.position.set(p.x, Hh - 0.5, p.z); group.add(m); flicker.push(m); }
    else tubes.push(boxGeo(p.x - 0.15, Hh - 0.54, p.z - 1.3, p.x + 0.15, Hh - 0.46, p.z + 1.3, 1));
  }
  if (tubes.length) group.add(new THREE.Mesh(mergeGeometries(tubes), new THREE.MeshBasicMaterial({ color: 0xdcecff })));
  B.done(group);
  // the EXIT: a big locked metal door in the far wall (red light). With the key it rolls up (green light).
  const ei = W - 1, ep = mid(ei, H - 1), ez = Z1;
  const door = new THREE.Group(); door.position.set(ep.x, 0, ez); group.add(door);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.0, 0.2), new THREE.MeshLambertMaterial({ color: 0x2a2f33 })); frame.position.set(0, 1.5, -0.05); door.add(frame);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), new THREE.MeshBasicMaterial({ color: 0xe8fff0 })); glow.position.set(0, 1.3, -0.16); glow.rotation.y = Math.PI; door.add(glow);
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.65, 0.08), new THREE.MeshLambertMaterial({ map: tex("concrete"), color: 0x6a7480 })); shutter.position.set(0, 1.32, -0.2); door.add(shutter);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: tex("exit") })); sign.position.set(0, 3.25, -0.12); sign.rotation.y = Math.PI; door.add(sign);
  const lockSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: signTex("LOCKED"), color: 0xff8a8a })); lockSign.position.set(0, 1.9, -0.25); lockSign.rotation.y = Math.PI; door.add(lockSign);
  const light = new THREE.PointLight(0xff3030, 5, 10, 1.5); light.position.set(ep.x, 2.4, ez - 1.6); group.add(light);
  const unlock = () => { light.color.set(0x6dff8a); lockSign.visible = false; door.userData.open = true; };
  door.userData.update = (dt) => { if (door.userData.open && shutter.position.y < 3.6) { shutter.position.y += dt * 1.4; shutter.scale.y = Math.max(0.05, 1 - (shutter.position.y - 1.32) / 2.4); } };
  // the KEY: a little gold key that glints
  if (!keySpot) keySpot = { ...mid(W - 2, 0), y: 0.12 };
  const key = new THREE.Group(), gold = new THREE.MeshLambertMaterial({ color: 0xffcf3a, emissive: 0x4a3600 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16), gold); ring.position.y = 0.09; key.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.02), gold); shaft.position.y = -0.03; key.add(shaft);
  for (const y of [-0.08, -0.04]) { const tt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.02), gold); tt.position.set(0.03, y, 0); key.add(tt); }
  key.position.set(keySpot.x, keySpot.y + 0.1, keySpot.z); group.add(key);
  const kl = new THREE.PointLight(0xffc840, 1.6, 3.2, 1.6); kl.position.set(keySpot.x, keySpot.y + 0.5, keySpot.z); group.add(kl);
  // the Skinwalkers start far from you, out in the garage
  const spots = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (!car[i][j] && room[i][j] < 0) spots.push([i, j]);
  const open = spots.concat(rooms.flatMap((R) => [[R.door[0], R.door[1]]]));
  const n = o.skinwalkers || 3, cand = spots.filter(([i, j]) => far[i][j] >= (o.min || 9));
  for (let k = cand.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [cand[k], cand[m]] = [cand[m], cand[k]]; }
  const monsters = [];
  for (let k = 0; k < n; k++) { const c = cand[k % Math.max(1, cand.length)] || [W - 1, 0]; monsters.push({ kind: "skinwalker", ...mid(c[0], c[1]) }); }
  return { group, boxes: B.boxes, floorY: 0, water: [], grid: { ...g, x0, z0, cell: C, open }, flicker, start: { ...mid(0, 0), yaw: -Math.PI * 0.75 },
    exit: { x: ep.x, z: ez - 0.9, r: 1.5 }, final: !!o.final, monsters, rocks: [], fog: [0x101214, 2, 26], bg: 0x101214, hemi: [0xc8d4e0, 0x1c1c1c, 1.05],
    ceilingH: Hh, garage: true, key: { x: keySpot.x, y: keySpot.y, z: keySpot.z, mesh: key, light: kl }, unlock, exitDoor: door, mapBg: "#26292d", mapWall: "#b9c0c8" };
}

// ---------------------------------------------------------------- the five levels of The Backrooms
export const LEVELS = [
  { name: "Level 0", sub: "The Lobby", goal: "Find the EXIT. Something lives in these halls.",
    build: (seed) => mazeBuild(seed, { W: 11, H: 11, theme: "lobby", mons: { bacteria: 1 }, min: 9 }) },
  { name: "Level 37", sub: "The Poolrooms", goal: "Cross on the platforms. DON'T touch the water unless you have to. Throw rocks to distract it.",
    build: (seed) => poolBuild(seed, { len: 150, crawlers: 1 }) },
  { name: "Level Fun", sub: "The Party Rooms  =)", goal: "Find the EXIT. If a Partygoer sees you... RUN.",
    build: (seed) => mazeBuild(seed, { W: 9, H: 9, theme: "party", mons: { partygoer: 2 }, min: 5 }) },
  { name: "Sublevel B3", sub: "The Parking Garage", goal: "The EXIT is locked. Find the KEY in one of the little rooms. Skinwalkers are looking for you... and they're wearing YOUR face.",
    build: (seed) => garageBuild(seed, { W: 14, H: 14, skinwalkers: 3, min: 9 }) },
  { name: "Level 0", sub: "The Deep Lobby", goal: "The biggest maze yet. Captain Clark is hunting you. Find the way OUT.",
    build: (seed) => mazeBuild(seed, { W: 17, H: 17, theme: "deep", mons: { clark: 1 }, min: 12, open: 0.22, final: true }) },
];
