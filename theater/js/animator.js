// MOVIE THEATER: the Animation Studio. A super easy flip-book animator: draw a picture, press "Copy frame", change it a
// little, and again... then press Play! Pen, marker, eraser, paint bucket, stickers, a "ghost" of the last frame
// (onion skin), a sound for any frame, 3 speeds. Your films save in this browser and play in the "Your Films" theater.
import { SOUNDS, sfx, audio } from "./sfx.js";

export const AW = 640, AH = 360, MAX_FRAMES = 60;
const KEY = "gv_theater_films";
const COLORS = ["#111111", "#ffffff", "#9aa0aa", "#e0302a", "#ff7a1a", "#ffd23a", "#7be03a", "#1fae45", "#13c4c4", "#2f7df6", "#1d2a52", "#a64bf4", "#ff4fa3", "#8b5a2b", "#f6d7b8", "#3a2010"];
const STICKERS = ["💥", "⭐", "🔥", "💨", "💧", "❤️", "⚡", "😀", "😡", "😱", "🥷", "🤖", "🐉", "👽", "👑", "🍕", "🌳", "🏠", "☁️", "🌙"];
const SOUND_LIST = ["", "punch", "kick", "whoosh", "boom", "laser", "clang", "jump", "bonk", "boing", "splat", "cheer", "laugh", "roar", "zap", "ding", "gong", "fire"];
const FPS = [{ n: "🐢 Slow", v: 4 }, { n: "🚶 Normal", v: 8 }, { n: "🚀 Fast", v: 12 }];
export function loadFilms() { try { const l = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } }
function saveFilms(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// a starter film so "Your Films" is never empty: two stick fighters, drawn in code (the same way you'd draw them)
export function starterFilm() {
  const frames = [], c = document.createElement("canvas"); c.width = AW; c.height = AH; const g = c.getContext("2d");
  const stick = (x, y, col, pose, face = 1) => {
    g.strokeStyle = col; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.arc(x, y - 110, 18, 0, Math.PI * 2); g.stroke(); // head
    g.beginPath(); g.moveTo(x, y - 92); g.lineTo(x, y - 40); g.stroke(); // body
    const arm = (a, l = 40) => { g.beginPath(); g.moveTo(x, y - 82); g.lineTo(x + Math.sin(a) * l * face, y - 82 + Math.cos(a) * l); g.stroke(); };
    const leg = (a) => { g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + Math.sin(a) * 44 * face, y - 40 + Math.cos(a) * 44); g.stroke(); };
    if (pose === "punch") { arm(1.57, 52); arm(0.6); leg(0.4); leg(-0.3); }
    else if (pose === "kick") { arm(2.4); arm(-0.6); leg(1.5); leg(-0.1); }
    else if (pose === "hurt") { arm(-1.2); arm(-0.6); leg(0.5); leg(-0.5); }
    else if (pose === "down") { g.save(); g.translate(x, y); g.rotate(-1.4 * face); g.translate(-x, -y); arm(-1); arm(1); leg(0.3); leg(-0.3); g.restore(); }
    else if (pose === "win") { arm(2.9); arm(-2.9); leg(0.3); leg(-0.3); }
    else { arm(0.5); arm(-0.5); leg(0.35); leg(-0.35); }
  };
  const shot = (redX, redPose, blueX, bluePose, extra, snd = "") => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, AW, AH); g.fillStyle = "#cfe8ff"; g.fillRect(0, 0, AW, 240); g.fillStyle = "#7be03a"; g.fillRect(0, 300, AW, 60);
    g.fillStyle = "#ffd23a"; g.beginPath(); g.arc(560, 60, 30, 0, Math.PI * 2); g.fill();
    stick(redX, 300, "#e0302a", redPose, 1); stick(blueX, 300, "#2f7df6", bluePose, -1);
    if (extra) { g.font = "54px serif"; g.textAlign = "center"; g.fillText(extra[0], extra[1], extra[2]); }
    frames.push({ img: c.toDataURL("image/webp", 0.8), snd });
  };
  for (let i = 0; i < 4; i++) shot(120 + i * 30, "", 520 - i * 30, "");
  shot(240, "punch", 400, "", ["💥", 330, 190], "punch"); shot(240, "", 410, "hurt");
  shot(250, "", 400, "punch", ["💥", 320, 190], "punch"); shot(235, "hurt", 400, "");
  shot(250, "kick", 380, "", ["💥", 330, 240], "kick"); shot(250, "", 420, "hurt", ["⭐", 420, 150]);
  shot(250, "", 470, "hurt", ["💨", 420, 230], "whoosh"); shot(250, "", 520, "down", ["💫", 520, 200], "boom");
  for (let i = 0; i < 3; i++) shot(250, "win", 520, "down", ["⭐", 250, 120 - i * 10], i ? "" : "cheer");
  return { id: "starter", title: "Stick Fight (example)", fps: 6, frames, made: Date.now() };
}

export class Animator {
  constructor(root, opts) {
    this.root = root; this.opts = opts || {};
    this.film = this.blank(); this.cur = 0; this.tool = "pen"; this.color = "#111111"; this.size = 6; this.sticker = "💥"; this.onion = true; this.playing = false; this.undo = [];
    this.build();
  }
  blank() { return { id: "f" + Date.now().toString(36), title: "My Movie", fps: 8, frames: [{ img: null, snd: "" }] }; }
  build() {
    const R = this.root;
    R.innerHTML = `<div class="an">
      <div class="anTop"><b>🎨 ANIMATION STUDIO</b><input id="anTitle" maxlength="30" value="My Movie" aria-label="Movie name"><button data-a="new">📄 New</button><button data-a="save" class="go">💾 Save</button><button data-a="films">📂 My Films</button><button data-a="close" class="x">✕</button></div>
      <div class="anMid">
        <div class="anTools">
          ${[["pen", "✏️", "Pen"], ["marker", "🖍️", "Marker"], ["eraser", "🧽", "Eraser"], ["fill", "🪣", "Fill"], ["sticker", "⭐", "Sticker"]].map(([k, i, n]) => `<button data-tool="${k}" title="${n}"><i>${i}</i>${n}</button>`).join("")}
          <button data-a="undo"><i>↩️</i>Undo</button><button data-a="clear"><i>🗑️</i>Clear</button>
        </div>
        <div class="anStage"><canvas id="anOnion" width="${AW}" height="${AH}"></canvas><canvas id="anCanvas" width="${AW}" height="${AH}"></canvas><div id="anHint">Draw here! Then press <b>📑 Copy frame</b>, change your drawing a little, and press <b>▶ Play</b>.</div></div>
        <div class="anSide">
          <div class="anColors">${COLORS.map((c) => `<button data-color="${c}" style="background:${c}"></button>`).join("")}</div>
          <div class="anSizes">${[3, 6, 12, 24].map((s) => `<button data-size="${s}"><span style="width:${s}px;height:${s}px"></span></button>`).join("")}</div>
          <div class="anStickers">${STICKERS.map((s) => `<button data-sticker="${s}">${s}</button>`).join("")}</div>
        </div>
      </div>
      <div class="anBottom">
        <button data-a="play" class="go big" id="anPlay">▶ Play</button>
        <button data-a="add">➕ New frame</button><button data-a="dup" class="go">📑 Copy frame</button><button data-a="del">✖ Delete frame</button>
        <label class="chk"><input type="checkbox" id="anOnionChk" checked> 👻 Ghost</label>
        <select id="anFps">${FPS.map((f) => `<option value="${f.v}">${f.n}</option>`).join("")}</select>
        <select id="anSnd" title="A sound when this frame shows">${SOUND_LIST.map((s) => `<option value="${s}">${s ? "🔊 " + s : "🔇 no sound"}</option>`).join("")}</select>
        <div class="anStrip" id="anStrip"></div>
      </div>
      <div class="anFilms hidden" id="anFilms"></div>
    </div>`;
    this.cv = R.querySelector("#anCanvas"); this.g = this.cv.getContext("2d", { willReadFrequently: true }); this.on = R.querySelector("#anOnion"); this.og = this.on.getContext("2d");
    R.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => { this.tool = b.dataset.tool; this.ui(); }));
    R.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { this.color = b.dataset.color; if (this.tool === "eraser" || this.tool === "sticker") this.tool = "pen"; this.ui(); }));
    R.querySelectorAll("[data-size]").forEach((b) => (b.onclick = () => { this.size = +b.dataset.size; this.ui(); }));
    R.querySelectorAll("[data-sticker]").forEach((b) => (b.onclick = () => { this.sticker = b.dataset.sticker; this.tool = "sticker"; this.ui(); }));
    R.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => this.action(b.dataset.a)));
    R.querySelector("#anOnionChk").onchange = (e) => { this.onion = e.target.checked; this.drawOnion(); };
    R.querySelector("#anFps").onchange = (e) => { this.film.fps = +e.target.value; };
    R.querySelector("#anSnd").onchange = (e) => { this.film.frames[this.cur].snd = e.target.value; if (e.target.value) { audio(); sfx(e.target.value); } this.strip(); };
    R.querySelector("#anTitle").oninput = (e) => { this.film.title = e.target.value.slice(0, 30) || "My Movie"; };
    // drawing
    let last = null;
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * AW, ((e.clientY - r.top) / r.height) * AH]; };
    this.cv.onpointerdown = (e) => {
      if (this.playing) return; e.preventDefault(); this.cv.setPointerCapture(e.pointerId); this.pushUndo(); R.querySelector("#anHint").style.display = "none";
      const [x, y] = pos(e);
      if (this.tool === "fill") { this.flood(x | 0, y | 0, this.color); this.store(); return; }
      if (this.tool === "sticker") { this.g.font = `${40 + this.size * 3}px serif`; this.g.textAlign = "center"; this.g.textBaseline = "middle"; this.g.fillText(this.sticker, x, y); this.store(); return; }
      last = [x, y]; this.line(x, y, x + 0.01, y);
    };
    this.cv.onpointermove = (e) => { if (!last) return; const [x, y] = pos(e); this.line(last[0], last[1], x, y); last = [x, y]; };
    this.cv.onpointerup = this.cv.onpointercancel = () => { if (last) { last = null; this.store(); } };
    this.show(0); this.ui();
  }
  line(x0, y0, x1, y1) {
    const g = this.g; g.save(); g.lineCap = "round"; g.lineJoin = "round";
    if (this.tool === "eraser") { g.globalCompositeOperation = "destination-out"; g.lineWidth = this.size * 3; }
    else { g.strokeStyle = this.color; g.lineWidth = this.tool === "marker" ? this.size * 2.5 : this.size; if (this.tool === "marker") g.globalAlpha = 0.6; }
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  }
  // paint bucket: fill the area of one color with the new color
  flood(x, y, hex) {
    const img = this.g.getImageData(0, 0, AW, AH), d = img.data, i0 = (y * AW + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    const c = parseInt(hex.slice(1), 16), nr = (c >> 16) & 255, ng = (c >> 8) & 255, nb = c & 255;
    if (tr === nr && tg === ng && tb === nb && ta === 255) return;
    const same = (i) => Math.abs(d[i] - tr) < 40 && Math.abs(d[i + 1] - tg) < 40 && Math.abs(d[i + 2] - tb) < 40 && Math.abs(d[i + 3] - ta) < 60;
    const st = [[x, y]];
    while (st.length) {
      let [px, py] = st.pop(); let i = (py * AW + px) * 4;
      while (px >= 0 && same(i)) { px--; i -= 4; } px++; i += 4; let up = false, dn = false;
      while (px < AW && same(i)) {
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
        if (py > 0) { const u = i - AW * 4; if (same(u)) { if (!up) { st.push([px, py - 1]); up = true; } } else up = false; }
        if (py < AH - 1) { const v = i + AW * 4; if (same(v)) { if (!dn) { st.push([px, py + 1]); dn = true; } } else dn = false; }
        px++; i += 4;
      }
    }
    this.g.putImageData(img, 0, 0);
  }
  pushUndo() { this.undo.push(this.g.getImageData(0, 0, AW, AH)); if (this.undo.length > 25) this.undo.shift(); }
  store() { this.film.frames[this.cur].img = this.cv.toDataURL("image/webp", 0.8); this.strip(); }
  // show a frame (and a faint "ghost" of the frame before it)
  show(i) {
    this.cur = Math.max(0, Math.min(this.film.frames.length - 1, i)); this.undo = [];
    const F = this.film.frames[this.cur]; this.g.clearRect(0, 0, AW, AH);
    if (F.img) { const im = new Image(); im.onload = () => { this.g.clearRect(0, 0, AW, AH); this.g.drawImage(im, 0, 0); }; im.src = F.img; }
    this.drawOnion(); this.strip();
    const sel = this.root.querySelector("#anSnd"); if (sel) sel.value = F.snd || "";
  }
  drawOnion() {
    this.og.fillStyle = "#ffffff"; this.og.fillRect(0, 0, AW, AH);
    const P = this.film.frames[this.cur - 1];
    if (this.onion && P && P.img && !this.playing) { const im = new Image(); im.onload = () => { this.og.fillStyle = "#ffffff"; this.og.fillRect(0, 0, AW, AH); this.og.globalAlpha = 0.25; this.og.drawImage(im, 0, 0); this.og.globalAlpha = 1; }; im.src = P.img; }
  }
  strip() {
    const S = this.root.querySelector("#anStrip"); if (!S) return;
    S.innerHTML = this.film.frames.map((f, i) => `<button class="fr ${i === this.cur ? "on" : ""}" data-fr="${i}">${f.img ? `<img alt="" src="${f.img}">` : ""}<small>${i + 1}${f.snd ? " 🔊" : ""}</small></button>`).join("");
    S.querySelectorAll("[data-fr]").forEach((b) => (b.onclick = () => { if (!this.playing) this.show(+b.dataset.fr); }));
    const on = S.querySelector(".on"); if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  ui() {
    const R = this.root;
    R.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === this.tool));
    R.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("on", b.dataset.color === this.color));
    R.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("on", +b.dataset.size === this.size));
    R.querySelectorAll("[data-sticker]").forEach((b) => b.classList.toggle("on", b.dataset.sticker === this.sticker && this.tool === "sticker"));
    R.querySelector("#anFps").value = String(this.film.fps); R.querySelector("#anTitle").value = this.film.title;
  }
  action(a) {
    audio();
    const F = this.film.frames;
    if (a === "close") { this.stop(); this.opts.onClose && this.opts.onClose(); }
    if (a === "undo") { const u = this.undo.pop(); if (u) { this.g.putImageData(u, 0, 0); this.store(); } }
    if (a === "clear") { this.pushUndo(); this.g.clearRect(0, 0, AW, AH); this.store(); }
    if (a === "add" || a === "dup") {
      if (F.length >= MAX_FRAMES) { this.note("That's the most frames (" + MAX_FRAMES + ")!"); return; }
      F.splice(this.cur + 1, 0, { img: a === "dup" ? F[this.cur].img : null, snd: "" }); this.show(this.cur + 1); sfx("ding");
    }
    if (a === "del") { if (F.length <= 1) { F[0] = { img: null, snd: "" }; this.show(0); return; } F.splice(this.cur, 1); this.show(this.cur - (this.cur >= F.length ? 1 : 0)); }
    if (a === "play") { if (this.playing) this.stop(); else this.play(); }
    if (a === "new") { if (confirm("Start a new movie? (Save this one first if you want to keep it!)")) { this.film = this.blank(); this.show(0); this.ui(); } }
    if (a === "save") this.save();
    if (a === "films") this.filmsList();
  }
  play() {
    this.playing = true; this.root.querySelector("#anPlay").textContent = "■ Stop"; let i = 0;
    const imgs = this.film.frames.map((f) => { const im = new Image(); if (f.img) im.src = f.img; return im; });
    this.og.fillStyle = "#fff"; this.og.fillRect(0, 0, AW, AH);
    const step = () => {
      if (!this.playing) return;
      const f = this.film.frames[i % this.film.frames.length]; this.g.clearRect(0, 0, AW, AH); if (f.img && imgs[i % imgs.length].complete) this.g.drawImage(imgs[i % imgs.length], 0, 0);
      if (f.snd) sfx(f.snd);
      this.cur = i % this.film.frames.length; this.strip(); i++;
      this.timer = setTimeout(step, 1000 / this.film.fps);
    };
    step();
  }
  stop() { if (!this.playing) return; this.playing = false; clearTimeout(this.timer); this.root.querySelector("#anPlay").textContent = "▶ Play"; this.show(this.cur); }
  save() {
    const l = loadFilms().filter((f) => f.id !== this.film.id); const copy = { ...this.film, made: Date.now() };
    l.unshift(copy);
    try { saveFilms(l.slice(0, 12)); sfx("cheer"); this.note("💾 Saved! Watch it in the YOUR FILMS theater."); this.opts.onSave && this.opts.onSave(); }
    catch { this.note("Out of room! Delete an old movie in 📂 My Films first."); }
  }
  filmsList() {
    const box = this.root.querySelector("#anFilms"), l = loadFilms();
    box.classList.remove("hidden");
    box.innerHTML = `<div class="anFilmsIn"><h3>📂 My Films</h3>${l.length ? l.map((f) => `<div class="row"><b>${esc(f.title)}</b><small>${f.frames.length} frames</small><button data-open="${f.id}">✏️ Edit</button><button data-watch="${f.id}" class="go">🎬 Watch in theater</button><button data-delf="${f.id}">🗑️</button></div>`).join("") : "<p>No movies saved yet. Draw one and press 💾 Save!</p>"}<button data-x="1">Close</button></div>`;
    box.querySelector("[data-x]").onclick = () => box.classList.add("hidden");
    box.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { const f = loadFilms().find((q) => q.id === b.dataset.open); if (f) { this.film = JSON.parse(JSON.stringify(f)); this.show(0); this.ui(); } box.classList.add("hidden"); }));
    box.querySelectorAll("[data-watch]").forEach((b) => (b.onclick = () => { box.classList.add("hidden"); this.stop(); this.opts.onWatch && this.opts.onWatch(b.dataset.watch); }));
    box.querySelectorAll("[data-delf]").forEach((b) => (b.onclick = () => { if (confirm("Delete this movie forever?")) { saveFilms(loadFilms().filter((q) => q.id !== b.dataset.delf)); this.filmsList(); } }));
  }
  note(t) { const n = document.createElement("div"); n.className = "anNote"; n.textContent = t; this.root.querySelector(".an").appendChild(n); setTimeout(() => n.remove(), 2600); }
}
