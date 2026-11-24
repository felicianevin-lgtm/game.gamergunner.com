// MOVIE THEATER (game.gamergunner.com/theater/): walk around a fancy movie theater lobby, pick a theater door, sit down,
// and a 5-second countdown plays on the giant screen before the movie starts. 6 cartoon fight movies (films.js, drawn
// live by engine.js with sound effects + voices), a YOUR FILMS theater that plays the flip-books you make, and an
// Animation Studio (animator.js). Test hook: window.MT.
import * as THREE from "/create/vendor/three.module.js";
import { Movie, W, H, setSilent, roundRect } from "./engine.js";
import { FILMS } from "./films.js";
import { Animator, loadFilms, starterFilm, AW, AH } from "./animator.js";
import { audio, sfx, setMuted, isMuted, hush, stopMusic } from "./sfx.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const canvas = $("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });
function box(parent, w, h, d, x, y, z, m) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; }
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------------------------------------------------------------- the doors: 6 movies + YOUR FILMS + the Animation Studio
const DOORS = [
  ...FILMS.slice(0, 4).map((f, i) => ({ kind: "film", film: f, num: i + 1, x: -15 + i * 10, z: -15.6, yaw: 0 })),
  { kind: "film", film: FILMS[4], num: 5, x: -23.6, z: -5, yaw: Math.PI / 2 },
  { kind: "film", film: FILMS[5], num: 6, x: -23.6, z: 6, yaw: Math.PI / 2 },
  { kind: "yours", num: 7, x: 23.6, z: -5, yaw: -Math.PI / 2 },
  { kind: "studio", num: 0, x: 23.6, z: 6, yaw: -Math.PI / 2 },
];
// ---------------------------------------------------------------- posters (a real frame of the movie + the title)
function filmFrame(def, t) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  setSilent(true); const m = new Movie(def); while (m.t < t) m.update(1 / 30); m.draw(g); setSilent(false);
  return c;
}
function wrapText(g, text, x, y, maxW, lh) { const words = text.split(" "); let line = "", yy = y; for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } g.fillText(line, x, yy); }
const POSTER_T = { rooftop: 22.1, grandma: 23.05, galaxy: 35, dragon: 15.9, kitchen: 19.6, dojo: 20.7 };
function posterTex(D) {
  return canvasTex(512, 768, (g, w, h) => {
    if (D.kind === "film") {
      const F = D.film, P = F.poster, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.c1); gr.addColorStop(1, P.c2); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const fr = filmFrame(F, POSTER_T[F.id] || F.length / 2); g.drawImage(fr, 300, 60, 680, 600, 0, 120, 512, 452);
      const sh = g.createLinearGradient(0, 470, 0, 600); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.85)"); g.fillStyle = sh; g.fillRect(0, 470, w, 130); g.fillStyle = "rgba(0,0,0,0.85)"; g.fillRect(0, 600, w, 168);
      g.fillStyle = P.acc; g.font = "bold 22px Inter, Arial"; g.textAlign = "center"; g.fillText("GUNNERVERSE PICTURES PRESENTS", w / 2, 50);
      g.font = "900 54px 'Russo One', Impact, sans-serif"; g.lineWidth = 8; g.strokeStyle = "#000"; const lines = F.title.toUpperCase().split(" "), half = Math.ceil(lines.length / 2);
      const l1 = lines.slice(0, half).join(" "), l2 = lines.slice(half).join(" ");
      g.strokeText(l1, w / 2, 560); g.fillStyle = "#fff"; g.fillText(l1, w / 2, 560); if (l2) { g.strokeText(l2, w / 2, 614); g.fillStyle = P.acc; g.fillText(l2, w / 2, 614); }
      g.fillStyle = "#ddd"; g.font = "italic 21px Inter, Arial"; wrapText(g, F.tag, w / 2, 660, 460, 26);
      g.fillStyle = P.acc; g.font = "bold 18px Inter, Arial"; g.fillText(F.rating.toUpperCase(), w / 2, 746);
    } else if (D.kind === "yours") {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1a2a6a"); gr.addColorStop(1, "#0a0a1a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.font = "200px serif"; g.textAlign = "center"; g.fillText("🎞️", w / 2, 330); g.font = "900 66px 'Russo One', Impact"; g.fillStyle = "#ffd23a"; g.fillText("YOUR", w / 2, 480); g.fillText("FILMS", w / 2, 550);
      g.fillStyle = "#fff"; g.font = "24px Inter, Arial"; wrapText(g, "The movies YOU make in the Animation Studio play here!", w / 2, 620, 440, 30);
    } else {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ff7ad8"); gr.addColorStop(1, "#6a1a8a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.font = "200px serif"; g.textAlign = "center"; g.fillText("🎨", w / 2, 320); g.font = "900 56px 'Russo One', Impact"; g.fillStyle = "#fff"; g.fillText("ANIMATION", w / 2, 460); g.fillText("STUDIO", w / 2, 525);
      g.font = "24px Inter, Arial"; wrapText(g, "Draw your own cartoon, frame by frame. Super easy!", w / 2, 600, 440, 30);
    }
    g.strokeStyle = "#d4af37"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  });
}
function marqueeTex(D) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#120a10"; g.fillRect(0, 0, w, h);
    for (let x = 10; x < w; x += 22) for (const y of [8, h - 8]) { g.fillStyle = "#ffe9a0"; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    g.textAlign = "center"; g.fillStyle = "#ff5a5a"; g.font = "bold 22px Inter, Arial";
    g.fillText(D.kind === "studio" ? "★ MAKE YOUR OWN ★" : "THEATER " + D.num, w / 2, 42);
    g.fillStyle = "#ffd23a"; g.font = "900 40px 'Russo One', Impact"; const t = D.kind === "film" ? D.film.title.toUpperCase() : D.kind === "yours" ? "YOUR FILMS" : "ANIMATION STUDIO";
    g.fillText(t, w / 2, 92, w - 30);
  });
}
// ---------------------------------------------------------------- the lobby
const lobby = new THREE.Scene(); lobby.background = new THREE.Color(0x0e0610); lobby.fog = new THREE.Fog(0x0e0610, 30, 70);
lobby.add(new THREE.HemisphereLight(0xffe0d0, 0x302030, 1.0)); const lamb = new THREE.AmbientLight(0xffffff, 0.35); lobby.add(lamb);
{ const d = new THREE.DirectionalLight(0xfff0e0, 0.6); d.position.set(5, 20, 8); lobby.add(d); }
for (const [x, z, c] of [[-12, -8, 0xffc080], [12, -8, 0xffc080], [0, 4, 0xff9ad8], [-18, 8, 0x9ad0ff], [18, 8, 0x9ad0ff]]) { const p = new THREE.PointLight(c, 30, 26, 1.6); p.position.set(x, 6, z); lobby.add(p); }
const carpet = canvasTex(256, 256, (g) => { g.fillStyle = "#7a1424"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = "#c8962a"; g.beginPath(); g.arc(32 + i * 64, 32 + j * 64, 7, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#a01c34"; g.lineWidth = 3; g.strokeRect(8 + i * 64, 8 + j * 64, 48, 48); } });
carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(12, 8);
{ const f = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), new THREE.MeshLambertMaterial({ map: carpet })); f.rotation.x = -Math.PI / 2; lobby.add(f); }
{ const c = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), mat(0x1a0c1a)); c.rotation.x = Math.PI / 2; c.position.y = 8; lobby.add(c); }
const wallM = mat(0x3a1a4a), trimM = new THREE.MeshPhongMaterial({ color: 0xd4af37, shininess: 80 });
box(lobby, 48, 8, 0.4, 0, 4, -16, wallM); box(lobby, 48, 8, 0.4, 0, 4, 16, wallM); box(lobby, 0.4, 8, 32, -24, 4, 0, wallM); box(lobby, 0.4, 8, 32, 24, 4, 0, wallM);
for (const [w, d, x, z] of [[48, 0.5, 0, -15.75], [48, 0.5, 0, 15.75], [0.5, 32, -23.75, 0], [0.5, 32, 23.75, 0]]) { box(lobby, w, 0.25, d, x, 0.12, z, trimM); box(lobby, w, 0.2, d, x, 7.8, z, trimM); }
// rows of little ceiling lights
{ const g = new THREE.SphereGeometry(0.12, 8, 6), m = glowMat(0xfff0c0), n = 12 * 8, im = new THREE.InstancedMesh(g, m, n), M = new THREE.Matrix4(); let k = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) { M.makeTranslation(-22 + i * 4, 7.85, -14 + j * 4); im.setMatrixAt(k++, M); } lobby.add(im); }
// the front doors (glass) on the south wall + a big GUNNERPLEX sign
box(lobby, 10, 5, 0.3, 0, 2.5, 15.75, new THREE.MeshPhongMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.35, shininess: 120 }));
{ const t = canvasTex(1024, 192, (g, w, h) => { g.fillStyle = "#1a0a1a"; g.fillRect(0, 0, w, h); g.textAlign = "center"; g.font = "900 120px 'Russo One', Impact"; g.fillStyle = "#ff4fa3"; g.shadowColor = "#ff4fa3"; g.shadowBlur = 30; g.fillText("GUNNERPLEX", w / 2, 140); }); const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: t })); s.position.set(0, 6.4, 15.5); s.rotation.y = Math.PI; lobby.add(s); }
// the snack bar: a counter, a popcorn machine, a soda fountain, a menu board
{
  const C = new THREE.Group(); C.position.set(0, 0, 6); lobby.add(C);
  box(C, 12, 1.1, 1.6, 0, 0.55, 0, mat(0xd8a040)); box(C, 12.2, 0.12, 1.8, 0, 1.16, 0, trimM);
  box(C, 1.4, 2, 1.2, -3.5, 2.2, 0, new THREE.MeshPhongMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.6 })); box(C, 1.5, 0.3, 1.3, -3.5, 3.35, 0, mat(0xe0302a));
  for (let i = 0; i < 30; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(0xfff3a0)); p.position.set(-3.5 + (Math.random() - 0.5) * 1.1, 1.35 + Math.random() * 0.8, (Math.random() - 0.5) * 0.9); C.add(p); }
  box(C, 1.6, 1.4, 0.8, 3.5, 1.9, -0.2, mat(0x2a6ad0)); for (const x of [3.1, 3.5, 3.9]) box(C, 0.25, 0.4, 0.25, x, 1.4, 0.2, glowMat([0xe0302a, 0x7be03a, 0xffd23a][Math.round((x - 3.1) / 0.4)]));
  const menu = canvasTex(1024, 320, (g, w, h) => { g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, w, h); g.textAlign = "left"; g.fillStyle = "#ffd23a"; g.font = "900 64px 'Russo One', Impact"; g.fillText("🍿 SNACKS", 40, 80); g.font = "bold 40px Inter, Arial"; g.fillStyle = "#fff"; [["Popcorn", "$5"], ["Giant Soda", "$3"], ["Nachos", "$4"], ["Candy", "$2"]].forEach(([n, p], i) => { g.fillText(n, 40 + (i % 2) * 500, 170 + Math.floor(i / 2) * 80); g.fillStyle = "#7be03a"; g.fillText(p, 380 + (i % 2) * 500, 170 + Math.floor(i / 2) * 80); g.fillStyle = "#fff"; }); });
  const mb2 = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: menu })); mb2.position.set(0, 5.6, 0.5); C.add(mb2);
  box(C, 0.15, 5.4, 0.15, -3.6, 3.4, 0.5, trimM); box(C, 0.15, 5.4, 0.15, 3.6, 3.4, 0.5, trimM);
}
// blocky moviegoers hanging around the lobby
const PEOPLE = [];
function person(color) { const g = new THREE.Group(); box(g, 0.5, 0.8, 0.3, 0, 0.4, 0, mat(0x2a3550)); box(g, 0.6, 0.7, 0.35, 0, 1.15, 0, mat(color)); box(g, 0.42, 0.42, 0.42, 0, 1.75, 0, mat(0xf2c49b)); box(g, 0.44, 0.12, 0.44, 0, 1.98, 0, mat(0x3a2010)); return g; }
for (const [x, z, c, yaw] of [[-2, 9.2, 0xe0302a, Math.PI], [1.5, 9.6, 0x3a7ad0, Math.PI + 0.3], [-10, -6, 0x7be03a, 0.5], [9, -3, 0xffd23a, -1], [-16, 10, 0xa64bf4, 2], [15, 11, 0xff7a1a, 3]]) { const p = person(c); p.position.set(x, 0, z); p.rotation.y = yaw; lobby.add(p); PEOPLE.push(p); }
{ const p = person(0xffffff); p.position.set(0, 0, 4.6); lobby.add(p); PEOPLE.push(p); } // (the snack bar worker)
// build the doors
const PADS = [];
for (const D of DOORS) {
  const G = new THREE.Group(); G.position.set(D.x, 0, D.z); G.rotation.y = D.yaw; lobby.add(G);
  box(G, 3.6, 4.4, 0.3, 0, 2.2, 0, trimM); box(G, 3.0, 4.0, 0.32, 0, 2.0, 0.02, mat(0x120810));
  for (const s of [-0.75, 0.75]) { box(G, 1.4, 3.8, 0.1, s, 1.95, 0.2, mat(0x6a1a2a)); box(G, 0.08, 0.6, 0.12, s * 0.15 + (s > 0 ? 0.1 : -0.1), 1.9, 0.27, trimM); }
  const mq = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: marqueeTex(D) })); mq.position.set(0, 5.1, 0.2); G.add(mq);
  const po = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.3), new THREE.MeshBasicMaterial({ map: posterTex(D) })); po.position.set(3.2, 2.6, 0.22); G.add(po);
  box(G, 2.4, 3.5, 0.12, 3.2, 2.6, 0.14, trimM);
  const pad = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: D.kind === "studio" ? 0xff7ad8 : 0xffd23a, transparent: true, opacity: 0.7 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.03, 2.2); G.add(pad);
  G.updateMatrixWorld(true); const wp = pad.getWorldPosition(new THREE.Vector3());
  PADS.push({ D, x: wp.x, z: wp.z, pad });
}
// ---------------------------------------------------------------- the auditorium (one room, the screen shows whatever's playing)
const hall = new THREE.Scene(); hall.background = new THREE.Color(0x050208);
const hallLight = new THREE.AmbientLight(0xffe0d0, 0.9); hall.add(hallLight);
const screenGlow = new THREE.PointLight(0x9ab0ff, 0, 40, 1.2); screenGlow.position.set(0, 6, -8); hall.add(screenGlow);
const SCREEN = document.createElement("canvas"); SCREEN.width = W; SCREEN.height = H; const sg = SCREEN.getContext("2d");
const screenTex = new THREE.CanvasTexture(SCREEN); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
{
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })); scr.position.set(0, 7.4, -13); hall.add(scr);
  box(hall, 20.4, 12, 0.3, 0, 7.4, -13.25, mat(0x0a0a0a));
  const curtain = mat(0x8a0e1e); for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 10), curtain); c.position.set(s * (10.6 + i * 0.55), 7, -12.8 + i * 0.05); hall.add(c); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(28, 1.6, 1), curtain); top.position.set(0, 13.4, -12.6); hall.add(top);
  box(hall, 30, 0.2, 40, 0, 0, 2, mat(0x1a0a12)); box(hall, 30, 0.2, 40, 0, 15, 2, mat(0x0c060a));
  for (const s of [-1, 1]) { box(hall, 0.3, 15, 40, s * 15, 7.5, 2, mat(0x2a0a1a)); for (let z = -8; z <= 16; z += 6) { box(hall, 0.2, 1.4, 0.3, s * 14.8, 5, z, glowMat(0xffb060)); const l = new THREE.PointLight(0xffb060, 6, 9, 1.8); l.position.set(s * 14, 5, z); hall.add(l); l.userData.sconce = 1; } }
  box(hall, 30, 15, 0.3, 0, 7.5, 21, mat(0x2a0a1a));
  // stadium rows of red seats
  const seatB = new THREE.BoxGeometry(1.1, 1.2, 0.2), seatC = new THREE.BoxGeometry(1.1, 0.25, 0.9), rows = 9, per = 16, n = rows * per;
  const iB = new THREE.InstancedMesh(seatB, mat(0xb01e2e), n), iC = new THREE.InstancedMesh(seatC, mat(0x8a1424), n), M4 = new THREE.Matrix4(); let k = 0;
  for (let r = 0; r < rows; r++) { const y = r * 0.42, z = -3 + r * 1.7; box(hall, 30, y + 0.2, 1.7, 0, (y + 0.2) / 2, z + 0.3, mat(0x1a0a12)); for (let i = 0; i < per; i++) { const x = -11.25 + i * 1.5; M4.makeTranslation(x, y + 1.1, z + 0.6); iB.setMatrixAt(k, M4); M4.makeTranslation(x, y + 0.6, z + 0.15); iC.setMatrixAt(k, M4); k++; } }
  hall.add(iB, iC);
}
// the audience (dark shapes in the seats that bounce + laugh)
const CROWD = [];
for (let i = 0; i < 24; i++) {
  const r = Math.floor(Math.random() * 6), s = Math.floor(Math.random() * 16); if (r <= 4 && s >= 6 && s <= 9) continue;
  const g = new THREE.Group(), c = [0x2a2a3a, 0x3a2030, 0x203040, 0x302a20][i % 4];
  box(g, 0.8, 0.9, 0.5, 0, 0, 0, mat(c)); const h = box(g, 0.5, 0.5, 0.5, 0, 0.75, 0, mat(0x6a4a3a)); g.userData.head = h;
  g.position.set(-11.25 + s * 1.5, r * 0.42 + 1.25, -3 + r * 1.7 + 0.35); g.userData.ph = Math.random() * 6; hall.add(g); CROWD.push(g);
}
// ---------------------------------------------------------------- you (first person)
const me = { x: 0, z: 12.5, yaw: 0, pitch: -0.05, vx: 0, vz: 0 };
const keys = {}; let mode = "lobby", near = null;
addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
  keys[e.code] = true; audio();
  if ((e.code === "KeyE" || e.code === "Enter" || e.code === "Space") && mode === "lobby" && near) { e.preventDefault(); enter(near.D); }
  if (e.code === "Escape" && mode === "theater") leave();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
let drag = null;
canvas.addEventListener("pointerdown", (e) => { audio(); if (e.pointerType === "touch" && e.clientX < innerWidth * 0.4 && mode === "lobby") return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
addEventListener("pointermove", (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; me.yaw -= dx * 0.005; me.pitch = clamp(me.pitch - dy * 0.004, -1.1, 1.1); });
addEventListener("pointerup", (e) => { if (drag && e.pointerId === drag.id) drag = null; });
// touch joystick
const joy = { on: false, x: 0, y: 0, id: null }, jb = $("joy"), jk = $("joyKnob");
jb.addEventListener("pointerdown", (e) => { joy.on = true; joy.id = e.pointerId; jb.setPointerCapture(e.pointerId); joyMove(e); audio(); });
jb.addEventListener("pointermove", (e) => { if (joy.on && e.pointerId === joy.id) joyMove(e); });
jb.addEventListener("pointerup", () => { joy.on = false; joy.x = joy.y = 0; jk.style.transform = ""; });
function joyMove(e) { const r = jb.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = dy; jk.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; }
if ("ontouchstart" in window) document.body.classList.add("touch");
$("promptBtn").onclick = () => { audio(); if (near) enter(near.D); };
$("muteBtn").onclick = () => { audio(); setMuted(!isMuted()); $("muteBtn").textContent = isMuted() ? "🔇" : "🔊"; };
$("muteBtn").textContent = isMuted() ? "🔇" : "🔊";
$("leaveBtn").onclick = () => leave();
$("againBtn").onclick = () => { if (show) startShow(show.D, show.your); };
$("startBtn").onclick = () => { audio(); $("intro").classList.add("hidden"); };

// ---------------------------------------------------------------- entering a theater: sit down, lights dim, 5... 4... 3... 2... 1... MOVIE
let show = null, fade = 0;
function enter(D) {
  if (D.kind === "studio") return openStudio();
  if (D.kind === "yours") return pickYourFilm(D);
  startShow(D, null);
}
function startShow(D, your) {
  stopAll();
  mode = "theater"; fade = 1;
  show = { D, your, phase: "count", t: 0, movie: null, lastN: 6 };
  me.yaw = 0; me.pitch = 0.08;
  $("hud").classList.add("inTheater"); $("prompt").classList.add("hidden"); $("theaterHud").classList.remove("hidden"); $("againBtn").classList.add("hidden");
  $("nowTitle").textContent = your ? "🎞️ " + your.title : "🎬 " + D.film.title;
  sfx("projector");
}
function stopAll() { if (show && show.movie) show.movie.stop(); stopMusic(); hush(); if (show && show.timer) clearTimeout(show.timer); }
function leave() { stopAll(); show = null; mode = "lobby"; fade = 1; $("hud").classList.remove("inTheater"); $("theaterHud").classList.add("hidden"); $("picker").classList.add("hidden"); hallLight.intensity = 0.9; }
// the countdown, drawn like an old film leader: a sweeping hand, rings, a big number
function drawCountdown(t) {
  const n = Math.max(1, 5 - Math.floor(t)), k = t % 1, g = sg;
  g.fillStyle = "#2a2a2a"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#4a4a4a"; g.beginPath(); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, 900, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.fill();
  g.strokeStyle = "#e8e8e8"; g.lineWidth = 8; for (const r of [230, 270]) { g.beginPath(); g.arc(W / 2, H / 2, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  g.fillStyle = "#ffffff"; g.font = "900 300px 'Russo One', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), W / 2, H / 2 + 16);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`; g.fillRect(Math.random() * W, Math.random() * H, 2, Math.random() * 40); }
  g.fillStyle = "rgba(255,255,255,0.9)"; g.font = "bold 34px Inter, Arial"; g.fillText(show.your ? "YOUR FILM: " + show.your.title.toUpperCase() : "NOW SHOWING: " + show.D.film.title.toUpperCase(), W / 2, 60);
}
function drawEnd(title, t) { const g = sg; g.fillStyle = "#000"; g.fillRect(0, 0, W, H); g.globalAlpha = Math.min(1, t); g.fillStyle = "#ffd23a"; g.font = "900 110px 'Russo One', Impact"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("THE END", W / 2, H / 2 - 40); g.fillStyle = "#fff"; g.font = "bold 36px Inter, Arial"; g.fillText(title, W / 2, H / 2 + 60); g.font = "28px Inter, Arial"; g.fillStyle = "#aaa"; g.fillText("Thanks for watching! 🍿", W / 2, H / 2 + 120); g.globalAlpha = 1; }
// a flip-book you made: one picture at a time, with its sound
function drawYour(Y, t) {
  // (short flip-books loop so every movie plays for at least ~8 seconds)
  const n = Y.frames.length, loops = Math.max(1, Math.ceil((8 * Y.fps) / n)), i = Math.floor(t * Y.fps), k = Math.min(i, n * loops - 1) % n, F = Y.frames[k];
  const g = sg; g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  const im = Y.imgs[k]; if (im && im.complete && im.naturalWidth) g.drawImage(im, 0, 0, W, H);
  if (i !== show.lastFrame && i < n * loops) { show.lastFrame = i; if (F.snd) sfx(F.snd); }
  return i >= n * loops;
}
function updateShow(dt) {
  const S = show; S.t += dt;
  if (S.phase === "count") {
    hallLight.intensity = Math.max(0.12, hallLight.intensity - dt * 0.6);
    drawCountdown(S.t); const n = 5 - Math.floor(S.t); if (n !== S.lastN && n >= 1) { S.lastN = n; sfx("beep"); }
    if (S.t >= 5) {
      S.phase = "film"; S.t = 0; sfx("ding");
      if (S.your) { S.your.imgs = S.your.frames.map((f) => { const im = new Image(); if (f.img) im.src = f.img; return im; }); S.lastFrame = -1; }
      else { S.movie = new Movie(S.D.film); S.movie.start(); }
    }
  } else if (S.phase === "film") {
    if (S.your) { if (drawYour(S.your, S.t)) { S.phase = "end"; S.t = 0; sfx("cheer"); } }
    else { S.movie.update(dt); S.movie.draw(sg); if (S.movie.done) { S.phase = "end"; S.t = 0; sfx("cheer"); } }
  } else if (S.phase === "end") {
    drawEnd(S.your ? S.your.title : S.D.film.title, S.t); hallLight.intensity = Math.min(0.9, hallLight.intensity + dt * 0.4);
    if (S.t > 1.2) $("againBtn").classList.remove("hidden");
  }
  screenTex.needsUpdate = true;
  screenGlow.intensity = S.phase === "film" ? 18 : 6;
}
// ---------------------------------------------------------------- YOUR FILMS: pick one of your flip-books
function pickYourFilm(D) {
  let l = loadFilms(); const st = starterFilm();
  const box = $("picker"); box.classList.remove("hidden"); mode = "picker";
  box.innerHTML = `<div class="pickIn"><h2>🎞️ YOUR FILMS</h2><p>Pick a movie to watch on the big screen.</p><div class="pickList">${[...l, st].map((f, i) => `<button data-i="${i}"><b>${f.title.replace(/[<>&"]/g, "")}</b><small>${f.frames.length} frames${f.id === "starter" ? " · made by the theater" : ""}</small></button>`).join("")}</div>
    <div class="pickBtns"><button id="pickStudio">🎨 Make a new one</button><button id="pickClose">Close</button></div></div>`;
  const all = [...l, st];
  box.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { audio(); box.classList.add("hidden"); startShow(D, all[+b.dataset.i]); }));
  $("pickClose").onclick = () => { box.classList.add("hidden"); mode = "lobby"; };
  $("pickStudio").onclick = () => { box.classList.add("hidden"); mode = "lobby"; openStudio(); };
}
// ---------------------------------------------------------------- the Animation Studio (an overlay on top of the lobby)
let studio = null;
function openStudio() {
  mode = "studio"; $("studio").classList.remove("hidden"); $("prompt").classList.add("hidden");
  if (!studio) studio = new Animator($("studio"), {
    onClose: () => { $("studio").classList.add("hidden"); mode = "lobby"; },
    onWatch: (id) => { const f = loadFilms().find((q) => q.id === id); if (f) { $("studio").classList.add("hidden"); startShow(DOORS.find((d) => d.kind === "yours"), f); } },
  });
}
// ---------------------------------------------------------------- every frame
let last = performance.now(), T = 0;
const fwd = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  if (mode === "lobby") {
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y, s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x;
    if (keys.ArrowLeft) me.yaw += dt * 2.2; if (keys.ArrowRight) me.yaw -= dt * 2.2;
    const sp = keys.ShiftLeft ? 8 : 5, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    me.x += (fx * f - fz * s) * sp * dt; me.z += (fz * f + fx * s) * sp * dt;
    me.x = clamp(me.x, -23, 23); me.z = clamp(me.z, -15, 15);
    if (Math.abs(me.x) < 6.6 && me.z > 4.6 && me.z < 7.4) me.z = me.z < 6 ? 4.6 : 7.4; // (the snack counter)
    near = null; let bd = 1.6; for (const P of PADS) { const d = Math.hypot(P.x - me.x, P.z - me.z); P.pad.material.opacity = 0.45 + Math.sin(T * 4) * 0.25; if (d < bd) { bd = d; near = P; } }
    const pr = $("prompt"); if (near) { pr.classList.remove("hidden"); $("promptText").textContent = near.D.kind === "studio" ? "🎨 Animation Studio: make your own cartoon!" : near.D.kind === "yours" ? "🎞️ Your Films: watch the movies you made" : "🎬 " + near.D.film.title + ": " + near.D.film.rating; $("promptBtn").textContent = near.D.kind === "studio" ? "Go in (E)" : "Watch (E)"; } else pr.classList.add("hidden");
    for (const [i, p] of PEOPLE.entries()) p.position.y = Math.abs(Math.sin(T * 2 + i)) * 0.04;
    camera.position.set(me.x, 1.65, me.z);
    camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
    renderer.render(lobby, camera);
  } else if (mode === "theater") {
    updateShow(dt);
    for (const c of CROWD) { const ph = c.userData.ph; c.userData.head.position.y = 0.75 + (show.phase === "film" ? Math.abs(Math.sin(T * 7 + ph)) * 0.05 * (Math.sin(T * 0.7 + ph) > 0.6 ? 1 : 0) : 0); }
    camera.position.set(0.75, 4 * 0.42 + 2.3, -3 + 4 * 1.7 + 0.4);
    camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
    renderer.render(hall, camera);
  } else if (mode === "picker" || mode === "studio") {
    camera.position.set(me.x, 1.65, me.z); camera.rotation.set(me.pitch, me.yaw, 0, "YXZ"); renderer.render(lobby, camera);
  }
  if (fade > 0) { fade = Math.max(0, fade - dt * 2); $("fade").style.opacity = fade; }
}
// posters need the fonts first
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { $("loading").classList.add("hidden"); requestAnimationFrame(frame); });
window.MT = { me, enter: (i) => enter(DOORS[i]), leave, get show() { return show; }, get mode() { return mode; }, DOORS, renderer, camera, lobby, hall, skip: (t) => { if (show) show.t += t; }, FILMS };
