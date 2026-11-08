// SCRIPTS for GunnerVerse Studio games: real JavaScript that players write (or start from an example) to make their game
// do anything. A script lives INSIDE a part or a GUI thing (that's `me`), or in the whole game (game.scripts, game.js).
//
// SAFETY: scripts in published games are written by other players, so they never run on the page itself. They run in a
// locked box: a hidden <iframe sandbox="allow-scripts"> (no access to the page, the account or saved games) with a
// Content-Security-Policy that blocks the internet, and inside it a Web Worker (so a loop that never ends can't freeze
// the game; play.js stops scripts that don't answer for 5 seconds). They only talk to the game with messages:
//   game -> scripts: init {things, scripts, p}, tick {dt, p (player), m (things the game moved), ev (clicks, touches, keys)}
//   scripts -> game: {t: "out", c: [commands]} after each tick (see apply() in play.js for the list of commands)
// Words a script shows on the screen go through the same bad-word / link filter as the rest of the game (play.js).

export const HELP = [
  ["This thing (me)", [
    ["me.onClick(function () {\n  \n})", "Do something when this is clicked (GUI buttons, or parts in the game)"],
    ["me.onTouch(function () {\n  \n})", "Do something when the player touches this part"],
    ["me.hide()", "Hide it (and walk through it)"], ["me.show()", "Show it again"], ["me.toggle()", "Hide it if it's showing, show it if it's hidden"],
    ["me.moveTo(0, 5, 0)", "Jump to a spot (x, y, z). Also works with a thing: me.moveTo(player)"],
    ["me.move(0, 1, 0)", "Move a little (x, y, z)"], ["me.forward(2)", "Move forward the way it's facing"],
    ["me.moveToward(player, 1)", "Step toward something"], ["me.follow(player, 6)", "Chase something forever (6 = speed). me.stop() stops"],
    ["me.turn(90)", "Turn (degrees)"], ["me.spin(90)", "Keep spinning (degrees every second)"], ["me.lookAt(player)", "Face something"],
    ["me.color = \"red\"", "Change the color (names like \"red\" or codes like \"#ff0000\")"], ["me.text = \"Hi!\"", "Change the words (signs, GUI)"],
    ["me.solid = false", "Let players walk through it"], ["me.transparency = 50", "See-through: 0 = solid, 100 = invisible (it's still there!)"], ["me.distanceTo(player)", "How far away something is"],
    ["me.play(\"Walk\")", "Play an animation (imported models)"], ["me.clone()", "Make a copy (it starts in the same spot)"], ["me.destroy()", "Delete it from the game"],
    ["me.x", "Where it is: me.x, me.y, me.z (GUI: % across and down the screen)"]]],
  ["The player", [
    ["player.teleport(0, 10, 0)", "Send the player somewhere (or player.teleport(find(\"Spot\")))"], ["player.respawn()", "Back to the checkpoint"],
    ["player.speed = 2", "Run 2 times faster (1 = normal)"], ["player.jump = 2", "Jump 2 times higher"],
    ["player.damage(25)", "Hurt the player (health starts at 100)"], ["player.health = 100", "Set the health"],
    ["player.freeze()", "Stop the player from moving (player.unfreeze() lets go)"], ["player.coins", "How many coins they have"], ["player.x", "Where the player is: player.x, player.y, player.z"]]],
  ["Finding things", [
    ["find(\"Door\")", "Get a part or GUI by its name (the name in the Explorer)"], ["findAll(\"Coin\")", "Get every thing with that name"]]],
  ["Time", [
    ["after(2, function () {\n  \n})", "Do something after 2 seconds"], ["every(1, function () {\n  \n})", "Do something every second"],
    ["onUpdate(function (dt) {\n  \n})", "Do something every frame (dt = seconds since the last frame)"], ["await wait(1)", "Wait 1 second, then keep going"]]],
  ["Keys, screen and sound", [
    ["onKey(\"f\", function () {\n  \n})", "Do something when a key is pressed"], ["say(\"Hello!\")", "Show a message in the middle of the screen"],
    ["print(\"hi\")", "Write in the Output box (for testing)"], ["sound(\"scream\")", "Sounds: beep coin jump boom door alarm scream win lose click"],
    ["camera.view(find(\"Camera 1\"))", "Look through a Security Camera (camera.reset() goes back)"]]],
  ["The game", [
    ["win(\"You win!\")", "The player wins"], ["lose(\"Game over!\")", "The player loses (they can try again)"], ["game.sky = \"night\"", "Change the sky: day, sunset, night, space"],
    ["game.time", "Seconds since the game started"], ["random(1, 10)", "A random whole number"], ["shared.score = 0", "\"shared\" is the same for every script (keep scores here)"]]],
];

export const EXAMPLES = [
  { name: "Open / close a panel", for: "gui", code: '// When this button is clicked, open (or close) the panel named "Shop".\n// (Change "Shop" to the name of YOUR panel.)\nme.onClick(function () {\n  find("Shop").toggle()\n  sound("click")\n})\n' },
  { name: "Click to open a door", for: "part", code: '// Click this part to open and close the part named "Door".\nconst door = find("Door")\n\nme.onClick(function () {\n  door.toggle()   // hidden = open, showing = closed\n  sound("door")\n})\n' },
  { name: "Chase the player", for: "part", code: '// This thing chases the player! (Great for an imported monster.)\nme.follow(player, 6)   // 6 = how fast\nme.play("Walk")        // imported characters: play a walk animation (if it has one)\n\nme.onTouch(function () {\n  sound("scream")\n  player.respawn()\n  say("It got you!")\n})\n' },
  { name: "Spin forever", for: "part", code: "// Spins around and around.\nme.spin(90)   // 90 degrees every second\n" },
  { name: "Drive back and forth", for: "part", code: "// Drives forward, then turns around every 3 seconds.\nevery(3, function () {\n  me.turn(180)\n})\n\nonUpdate(function (dt) {\n  me.forward(12 * dt)   // 12 studs every second\n})\n" },
  { name: "Countdown timer", for: "gui", code: '// Put this in a Text Label. Counts down, and you lose at 0.\nlet seconds = 60\n\nevery(1, function () {\n  seconds = seconds - 1\n  me.text = "⏱ " + seconds\n  if (seconds <= 0) lose("Time\'s up!")\n})\n' },
  { name: "Lava that hurts a little", for: "part", code: '// Touching this part takes away 25 health.\nme.onTouch(function () {\n  player.damage(25)\n  sound("boom")\n})\n' },
  { name: "Teleporter", for: "part", code: '// Touch this part to teleport to the part named "Exit".\nme.onTouch(function () {\n  player.teleport(find("Exit"))\n  sound("jump")\n})\n' },
  { name: "Flashlight (press F)", for: "game", code: '// Make a Light Bulb named "Flashlight". Press F to turn it on and off.\nconst light = find("Flashlight")\n\nonKey("f", function () {\n  light.toggle()\n  sound("click")\n})\n\n// keep it with the player\nonUpdate(function () {\n  light.moveTo(player.x, player.y + 3, player.z)\n})\n' },
  { name: "Blinking colors", for: "part", code: '// Changes color every half second.\nconst colors = ["red", "orange", "yellow", "green", "blue", "purple"]\nlet i = 0\n\nevery(0.5, function () {\n  me.color = colors[i]\n  i = (i + 1) % colors.length\n})\n' },
  { name: "Coin rain", for: "game", code: '// Every 2 seconds, a copy of the coin named "Coin" falls near the player.\nconst coin = find("Coin")\n\nevery(2, function () {\n  const c = coin.clone()\n  c.moveTo(player.x + random(-8, 8), player.y + 12, player.z + random(-8, 8))\n})\n' },
  { name: "Night guard (scary game)", for: "game", code: '// A scary night-guard game! You need:\n//  - a monster named "Monster" (try an imported model!)\n//  - a door named "Door" with a Wall Button (Switch) that turns it on / off\n//  - a Picture GUI named "Jumpscare" (hidden at start)\nconst monster = find("Monster")\nconst door = find("Door")\ngame.sky = "night"\nsay("Survive until 6 AM! Close the door when it comes!", 4)\n\nevery(3, function () {\n  if (door.visible && monster.distanceTo(door) < 8) return   // door closed: it waits\n  monster.moveToward(player, 3)                            // it sneaks closer...\n  monster.lookAt(player)\n  if (monster.distanceTo(player) < 5) {\n    sound("scream")\n    find("Jumpscare").show()\n    after(1.5, function () { lose("The monster got you!") })\n  }\n})\n\nafter(90, function () {\n  win("6 AM! You survived the night!")\n})\n' },
];

// ---------------------------------------------------------------- the box the scripts run in
// RUNTIME is turned into text (toString) and runs inside the sandbox, never on the page.
function RUNTIME(send) {
  "use strict";
  const things = new Map();
  const H = { click: new Map(), touch: new Map(), untouch: new Map(), key: new Map() };
  const updates = [], timers = [], follows = new Map(), spins = new Map(), errs = new Map();
  let out = [], now = 0, cur = null, nclone = 1, ended = false;
  const P = { x: 0, y: 0, z: 0, ry: 0, coins: 0, health: 100, speed: 1, jump: 1 };
  const shared = {}, missing = new Set();
  const R2D = 180 / Math.PI;
  const cmd = (...a) => { if (out.length < 4000) out.push(a); };
  const nice = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);

  function report(e, sc) {
    const s = sc || cur || { name: "Script" };
    const n = (errs.get(s) || 0) + 1; errs.set(s, n);
    if (n > 6) return;
    const st = String((e && e.stack) || "");
    const m = st.match(/<anonymous>:(\d+):\d+/) || st.match(/Function:(\d+):\d+/);
    let msg = String((e && e.message) || e).slice(0, 300);
    if (/Cannot read propert(y|ies) of (null|undefined)/.test(msg)) msg += ". (Something you used isn't there: check the names you typed.)";
    cmd("err", s.name, m ? Math.max(1, +m[1] - 2) : 0, n === 6 ? msg + " (stopped showing this error)" : msg);
  }
  function run(fn, sc, ...args) {
    if (!sc || (errs.get(sc) || 0) > 6) return;
    const prev = cur; cur = sc;
    try { const r = fn(...args); if (r && typeof r.then === "function") r.catch((e) => report(e, sc)); }
    catch (e) { report(e, sc); }
    finally { cur = prev; }
  }
  function need(fn, what) { if (typeof fn !== "function") throw new Error(what + " needs a function, like: " + what + "(function () { ... })"); }
  function on(map, id, fn, what) {
    need(fn, what);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push({ fn, sc: cur });
  }
  const spot = (t, y, z) => {
    if (t && typeof t === "object" && "x" in t) return { x: +t.x || 0, y: +t.y || 0, z: +t.z || 0 };
    return { x: +t || 0, y: +y || 0, z: +z || 0 };
  };
  const COLORS = { red: "#e8261c", orange: "#ff7a1a", yellow: "#ffc531", green: "#1fae45", lime: "#7be03a", blue: "#2f7df6", cyan: "#13c4c4", purple: "#a64bf4",
    pink: "#ff4fa3", white: "#ffffff", black: "#111111", gray: "#a3a8b0", grey: "#a3a8b0", brown: "#8b5a2b", gold: "#ffc531" };

  class Thing {
    constructor(s) { Object.defineProperty(this, "_s", { value: s }); }
    get name() { return this._s.name; }
    get kind() { return this._s.kind; }
    get type() { return this._s.type; }
    get x() { return this._s.x; } set x(v) { this.moveTo(v, this._s.y, this._s.z); }
    get y() { return this._s.y; } set y(v) { this.moveTo(this._s.x, v, this._s.z); }
    get z() { return this._s.z; } set z(v) { this.moveTo(this._s.x, this._s.y, v); }
    get rotation() { return this._s.ry; } set rotation(v) { this._s.ry = +v || 0; cmd("rot", this._s.id, this._s.ry); }
    get visible() { return this._s.visible; } set visible(v) { this._s.visible = !!v; cmd("vis", this._s.id, !!v); }
    get solid() { return this._s.solid; } set solid(v) { this._s.solid = !!v; cmd("solid", this._s.id, !!v); }
    get transparency() { return this._s.transp || 0; } set transparency(v) { this._s.transp = Math.max(0, Math.min(100, +v || 0)); cmd("transp", this._s.id, this._s.transp); }
    get color() { return this._s.color; }
    set color(v) { v = String(v).toLowerCase(); v = COLORS[v] || v; if (!/^#[0-9a-f]{6}$/.test(v)) throw new Error('Colors look like "red" or "#ff0000"'); this._s.color = v; cmd("color", this._s.id, v); }
    get text() { return this._s.text; } set text(v) { this._s.text = String(v); cmd("text", this._s.id, String(v).slice(0, 200)); }
    get size() { return [this._s.sx, this._s.sy, this._s.sz]; }
    resize(x, y, z) { this._s.sx = +x || 1; this._s.sy = +y || 1; this._s.sz = +z || 1; cmd("size", this._s.id, this._s.sx, this._s.sy, this._s.sz); return this; }
    show() { this.visible = true; return this; }
    hide() { this.visible = false; return this; }
    toggle() { this.visible = !this._s.visible; return this; }
    moveTo(x, y, z) { const p = spot(x, y, z); this._s.x = p.x; this._s.y = p.y; this._s.z = p.z; cmd("pos", this._s.id, nice(p.x), nice(p.y), nice(p.z)); return this; }
    move(dx, dy, dz) { return this.moveTo(this._s.x + (+dx || 0), this._s.y + (+dy || 0), this._s.z + (+dz || 0)); }
    forward(n) { const a = this._s.ry / R2D; return this.move(-Math.sin(a) * (+n || 0), 0, -Math.cos(a) * (+n || 0)); }
    turn(deg) { this.rotation = this._s.ry + (+deg || 0); return this; }
    lookAt(t) { const p = spot(t); if (p.x !== this._s.x || p.z !== this._s.z) this.rotation = Math.atan2(-(p.x - this._s.x), -(p.z - this._s.z)) * R2D; return this; }
    distanceTo(t) { const p = spot(t); return Math.hypot(p.x - this._s.x, p.y - this._s.y, p.z - this._s.z); }
    moveToward(t, n) {
      const p = spot(t), dx = p.x - this._s.x, dz = p.z - this._s.z, d = Math.hypot(dx, dz);
      if (d < 1e-6) return this;
      const k = Math.min(d, +n || 1) / d;
      return this.move(dx * k, 0, dz * k);
    }
    follow(t, speed) { follows.set(this, { t: t || player, speed: speed == null ? 6 : +speed || 0 }); return this; }
    spin(speed) { spins.set(this, speed == null ? 90 : +speed || 0); return this; }
    stop() { follows.delete(this); spins.delete(this); return this; }
    play(name) { cmd("anim", this._s.id, String(name == null ? "" : name).slice(0, 60)); return this; }
    onClick(fn) { on(H.click, this._s.id, fn, "onClick"); cmd("want", "click", this._s.id); return this; }
    onTouch(fn) { on(H.touch, this._s.id, fn, "onTouch"); cmd("want", "touch", this._s.id); return this; }
    onTouchEnd(fn) { on(H.untouch, this._s.id, fn, "onTouchEnd"); cmd("want", "touch", this._s.id); return this; }
    clone() {
      if (this._s.kind !== "part") throw new Error("Only parts can be cloned");
      const s = { ...this._s, id: "k" + nclone++ };
      things.set(s.id, s);
      cmd("clone", this._s.id, s.id);
      return new Thing(s);
    }
    destroy() { things.delete(this._s.id); follows.delete(this); spins.delete(this); cmd("destroy", this._s.id); }
    toString() { return this._s.name; }
  }
  const wrap = new Map();
  const get = (id) => { const s = things.get(id); if (!s) return null; if (!wrap.has(s)) wrap.set(s, new Thing(s)); return wrap.get(s); };

  const player = {
    get x() { return P.x; }, get y() { return P.y; }, get z() { return P.z; }, get rotation() { return P.ry; },
    get health() { return P.health; }, set health(v) { P.health = Math.max(0, Math.min(1000, +v || 0)); cmd("phealth", P.health); },
    get coins() { return P.coins; }, set coins(v) { P.coins = Math.max(0, Math.round(+v || 0)); cmd("pcoins", P.coins); },
    get speed() { return P.speed; }, set speed(v) { P.speed = Math.max(0, Math.min(10, +v || 0)); cmd("pspeed", P.speed); },
    get jump() { return P.jump; }, set jump(v) { P.jump = Math.max(0, Math.min(10, +v || 0)); cmd("pjump", P.jump); },
    get name() { return "Player"; }, get kind() { return "player"; },
    teleport(x, y, z) { const p = spot(x, y, z); if (x && typeof x === "object" && x._s) p.y += x._s.sy + 0.2; P.x = p.x; P.y = p.y; P.z = p.z; cmd("ptp", nice(p.x), nice(p.y), nice(p.z)); },
    respawn() { cmd("prespawn"); }, damage(n) { this.health = P.health - (+n || 0); },
    freeze() { cmd("pfreeze", true); }, unfreeze() { cmd("pfreeze", false); },
    distanceTo(t) { const p = spot(t); return Math.hypot(p.x - P.x, p.y - P.y, p.z - P.z); },
    toString() { return "Player"; },
  };
  const api = {
    player, shared,
    // (a name that isn't there: a friendly error, and a stand-in that does nothing, so the rest of the script keeps going)
    find(name) {
      name = String(name);
      for (const s of things.values()) if (s.name === name) return get(s.id);
      if (!missing.has(name)) { missing.add(name); report(new Error("There is nothing named \"" + name + "\" in your game. Check the name in the Explorer (capital letters count!)")); }
      return new Thing({ id: "", name, kind: "part", type: "", x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1, color: "#ffffff", visible: false, solid: false, text: "" });
    },
    findAll(name) { name = String(name); return [...things.values()].filter((s) => s.name === name).map((s) => get(s.id)); },
    all() { return [...things.keys()].map(get); },
    say(text, secs) { cmd("msg", String(text).slice(0, 200), Math.max(0.5, Math.min(30, +secs || 2.2))); },
    print(...a) { cmd("print", a.map((v) => (v && typeof v === "object" && !(v instanceof Thing) ? JSON.stringify(v) : String(v))).join(" ").slice(0, 500)); },
    after(secs, fn) { need(fn, "after"); const t = { at: now + Math.max(0, +secs || 0), fn, sc: cur }; timers.push(t); return { stop() { t.dead = true; } }; },
    every(secs, fn) { need(fn, "every"); const e = Math.max(0.05, +secs || 1); const t = { at: now + e, every: e, fn, sc: cur }; timers.push(t); return { stop() { t.dead = true; } }; },
    wait(secs) { return new Promise((res) => timers.push({ at: now + Math.max(0, +secs || 0), fn: res, sc: cur })); },
    onUpdate(fn) { need(fn, "onUpdate"); updates.push({ fn, sc: cur }); },
    onKey(key, fn) { need(fn, "onKey"); key = String(key).toLowerCase(); on(H.key, key === " " ? "space" : key, fn, "onKey"); cmd("want", "keys", ""); },
    sound(name) { cmd("sound", String(name).slice(0, 12)); },
    win(text) { if (!ended) { ended = true; cmd("win", String(text == null ? "You win!" : text).slice(0, 120)); } },
    lose(text) { if (!ended) { ended = true; cmd("lose", String(text == null ? "Game over!" : text).slice(0, 120)); } },
    random(a, b) { if (b == null) { b = a == null ? 1 : a; a = 0; } a = Math.ceil(+a || 0); b = Math.floor(+b || 0); return a + Math.floor(Math.random() * (b - a + 1)); },
    camera: { view(t) { cmd("cam", t && t._s ? t._s.id : ""); }, reset() { cmd("cam", ""); } },
    game: { get time() { return now; }, set sky(v) { cmd("sky", String(v)); }, win(t) { api.win(t); }, lose(t) { api.lose(t); } },
  };
  for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker"]) { try { self[k] = undefined; } catch {} }
  Object.assign(self, api);
  self.console = { log: api.print, warn: api.print, error: api.print, info: api.print };

  function fire(map, id, ...args) { for (const h of map.get(id) || []) run(h.fn, h.sc, ...args); }
  function start(d) {
    for (const s of d.things) things.set(s.id, s);
    Object.assign(P, d.p || {});
    const AsyncFunction = (async function () {}).constructor;
    for (const sc of d.scripts) {
      let fn;
      try { fn = new AsyncFunction("me", sc.code); }
      catch (e) { cmd("err", sc.name, 0, "Typo: " + e.message); continue; }
      run(fn, sc, sc.on ? get(sc.on) : null);
    }
  }
  function tick(d) {
    const dt = Math.min(1, Math.max(0, +d.dt || 0));
    now += dt;
    if (d.p) Object.assign(P, d.p);
    for (const [id, x, y, z, ry] of d.m || []) { const s = things.get(id); if (s) { s.x = x; s.y = y; s.z = z; s.ry = ry; } }
    for (const [kind, id, v] of d.ev || []) {
      if (kind === "vis") { const s = things.get(id); if (s) s.visible = !!v; }
      else if (kind === "key") fire(H.key, id);
      else if (H[kind]) fire(H[kind], id);
    }
    const due = timers.filter((t) => !t.dead && t.at <= now);
    for (const t of due) {
      if (t.every) t.at += t.every; else t.dead = true;
      run(t.fn, t.sc);
    }
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].dead) timers.splice(i, 1);
    for (const [t, f] of follows) {
      if (!things.has(t._s.id)) continue;
      const p = spot(f.t);
      if (t.distanceTo({ x: p.x, y: t.y, z: p.z }) > 0.8) { t.moveToward(p, f.speed * dt); t.lookAt(p); }
    }
    for (const [t, sp] of spins) if (things.has(t._s.id)) t.rotation = (t._s.ry + sp * dt) % 360;
    for (const u of updates) run(u.fn, u.sc, dt);
  }
  return function receive(d) {
    if (!d || typeof d !== "object") return;
    if (d.t === "init") start(d); else if (d.t === "tick") tick(d); else return;
    const c = out; out = [];
    send({ t: "out", c });
  };
}

const SANDBOX = (src) => '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:">' +
  "<script>(function () {\n" +
  "  var src = " + JSON.stringify(src) + ", w = null, recv = null;\n" +
  "  try { w = new Worker(URL.createObjectURL(new Blob([src + '\\nvar recv = RUNTIME(function (m) { postMessage(m); }); onmessage = function (e) { recv(e.data); };'], { type: 'text/javascript' })));\n" +
  "    w.onmessage = function (e) { parent.postMessage(e.data, '*'); };\n" +
  "    w.onerror = function (e) { parent.postMessage({ t: 'fatal', m: String(e.message || 'error') }, '*'); };\n" +
  "  } catch (e) { w = null; recv = (new Function(src + '; return RUNTIME;'))()(function (m) { parent.postMessage(m, '*'); }); }\n" +
  "  onmessage = function (e) { if (e.source !== parent) return; if (w) w.postMessage(e.data); else recv(e.data); };\n" +
  "  parent.postMessage({ t: 'hello', worker: !!w }, '*');\n" +
  "})();<\/script>";

// Start the scripts for one Play. things = [{id, kind: part / gui, type, name, x, y, z, ry, sx, sy, sz, color, visible, solid, text}]
// cb = {apply(commands), fatal(text)}. Returns {tick(dt, p, moved), event(kind, id, v), stop()}.
export function startScripts(scripts, things, p, cb) {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = SANDBOX(RUNTIME.toString());
  let ready = false, waiting = false, sentAt = 0, dead = false, dtSum = 0, events = [];
  const onMsg = (e) => {
    if (dead || e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
    const d = e.data;
    if (d.t === "hello") { ready = true; frame.contentWindow.postMessage({ t: "init", things, scripts, p }, "*"); waiting = true; sentAt = performance.now(); }
    else if (d.t === "out") { waiting = false; if (Array.isArray(d.c)) cb.apply(d.c); }
    else if (d.t === "fatal") cb.fatal("A script crashed: " + String(d.m).slice(0, 200));
  };
  window.addEventListener("message", onMsg);
  document.body.appendChild(frame);
  const host = {
    tick(dt, pl, moved) {
      if (dead || !ready) return;
      dtSum += dt;
      if (waiting) {
        if (performance.now() - sentAt > 5000) { host.stop(); cb.fatal("A script was stuck (maybe a loop that never ends), so the scripts were stopped."); }
        return;
      }
      frame.contentWindow.postMessage({ t: "tick", dt: dtSum, p: pl, m: moved, ev: events }, "*");
      dtSum = 0; events = []; waiting = true; sentAt = performance.now();
    },
    event(kind, id, v) { if (!dead && events.length < 200) events.push([kind, id, v]); },
    stop() { if (dead) return; dead = true; window.removeEventListener("message", onMsg); frame.remove(); },
  };
  return host;
}

// Quick typo check in the editor (compiling only: nothing runs). Returns "" or the problem.
export function checkTypos(code) {
  try { new (async function () {}).constructor("me", code); return ""; }
  catch (e) { return String(e.message || e); }
}
