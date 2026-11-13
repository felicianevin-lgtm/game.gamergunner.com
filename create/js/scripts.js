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
    ["me.play(\"dance\")", "Play an animation: one you made in 🎞️ My animations (its name), walk / run / dance / wave / fly / stop, or an imported model's own animation"], ["me.clone()", "Make a copy (it starts in the same spot)"], ["me.destroy()", "Delete it from the game"],
    ["me.x", "Where it is: me.x, me.y, me.z (GUI: % across and down the screen)"]]],
  ["The player", [
    ["player.teleport(0, 10, 0)", "Send the player somewhere (or player.teleport(find(\"Spot\")))"], ["player.respawn()", "Back to the checkpoint"],
    ["player.speed = 2", "Run 2 times faster (1 = normal)"], ["player.jump = 2", "Jump 2 times higher"],
    ["player.damage(25)", "Hurt the player (health starts at 100)"], ["player.health = 100", "Set the health"],
    ["player.freeze()", "Stop the player from moving (player.unfreeze() lets go)"], ["player.coins", "How many coins they have"], ["player.x", "Where the player is: player.x, player.y, player.z"]]],
  ["Weapons 🎒", [
    ["onAttack(function (aim) {\n  \n})", "In a home-made weapon's script: runs when the player uses it. aim.target = what you aim at (or null), aim.x / aim.y / aim.z = in front of you"],
    ["shoot({ damage: 20, speed: 80, color: \"purple\", size: 0.5 })", "Fire a shot where the player aims (also: drop = falls, freeze = seconds frozen, boom = explosion size, count + spread = many shots)"],
    ["me.onEquip(function () {\n  \n})", "In a script inside a weapon: runs when the player gets it (at the start, or picking it up)"],
    ["me.onAttack(function (aim) {\n  \n})", "In a script inside a weapon: runs every time the player uses it"],
    ["me.damage(25)", "Hurt a monster (it has 100 health; 0 = defeated)"], ["me.onHit(function (damage) {\n  \n})", "Do something when a weapon hits this"]]],
  ["Studio tools 🧰", [
    ["addTool(\"Build a maze\", \"🗺️\", function () {\n  \n})", "Only in a Game Script: adds a button to the 🧰 Tools menu at the top of the studio. Clicking it runs this while you build, and what it builds stays in your game"]]],
  ["Finding things", [
    ["find(\"Door\")", "Get a part or GUI by its name (the name in the Explorer)"], ["findAll(\"Coin\")", "Get every thing with that name"],
    ["build(\"block\", { x: 0, y: 0, z: 0, width: 4, height: 6, depth: 1, color: \"#ff0000\" })", "Build a new part while the game runs (also: texture, textureSize, stretch, material, solid, name, turn). Types: block, ball, cylinder, wedge, coin, light, lava, crate..."]]],
  ["Time", [
    ["after(2, function () {\n  \n})", "Do something after 2 seconds"], ["every(1, function () {\n  \n})", "Do something every second"],
    ["onUpdate(function (dt) {\n  \n})", "Do something every frame (dt = seconds since the last frame)"], ["await wait(1)", "Wait 1 second, then keep going"]]],
  ["Keys, screen and sound", [
    ["onKey(\"f\", function () {\n  \n})", "Do something when a key is pressed"], ["say(\"Hello!\")", "Show a message in the middle of the screen"],
    ["print(\"hi\")", "Write in the Output box (for testing)"], ["sound(\"scream\")", "Sounds: beep coin jump boom door alarm scream win lose click"],
    ["camera.view(find(\"Camera 1\"))", "Look through a Security Camera (camera.reset() goes back)"]]],
  ["The game", [
    ["win(\"You win!\")", "The player wins"], ["lose(\"Game over!\")", "The player loses (they can try again)"], ["game.sky = \"night\"", "Change the sky: day, sunset, night, space, backrooms"],
    ["game.time", "Seconds since the game started"], ["random(1, 10)", "A random whole number"], ["shared.score = 0", "\"shared\" is the same for every script (keep scores here)"]]],
];

// (the script in the Backrooms game from create/?new=backrooms, also in the Examples list: it builds the whole maze)
export const BACKROOMS_CODE = `// THE BACKROOMS MAZE BUILDER
// This script builds the whole Backrooms when the game starts: a NEW maze every time you play!
// Change these numbers to change your Backrooms:
const ROOMS = 19        // how many rooms across (use an odd number: you start in the middle). Bigger = more lost!
const ROOM = 14         // how wide each room is (studs)
const HEIGHT = 11       // how high the ceiling is
const OPEN = 0.35       // how many extra walls get knocked out (0 = a real maze, 0.6 = big open rooms)
const LIGHTS = 0.6      // how many rooms get a ceiling light (0 = none, 1 = every room)
const BOTTLES = 12      // how many Almond Water bottles are hidden

const SIZE = ROOMS * ROOM, HALF = SIZE / 2
function middle(i) { return -HALF + ROOM / 2 + i * ROOM }   // the middle of room number i
function chance(n) { return Math.random() < n }

// 1. the carpet and the ceiling
build("block", { name: "Carpet", x: 0, y: -1, z: 0, width: SIZE + 2, height: 1, depth: SIZE + 2, texture: "oldcarpet", textureSize: 6 })
build("block", { name: "Ceiling", x: 0, y: HEIGHT, z: 0, width: SIZE + 2, height: 1, depth: SIZE + 2, texture: "ceiling", textureSize: 4 })

// 2. carve a maze: start in the middle room and wander around knocking down walls (so every room can be reached)
const east = [], south = [], seen = []   // east[i][j] = a wall on the east side of room i, j (south = its south side)
for (let i = 0; i < ROOMS; i++) {
  east.push([]); south.push([]); seen.push([])
  for (let j = 0; j < ROOMS; j++) { east[i].push(true); south[i].push(true); seen[i].push(false) }
}
const start = Math.floor(ROOMS / 2)
const path = [[start, start]]
seen[start][start] = true
while (path.length > 0) {
  const [i, j] = path[path.length - 1]
  const next = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(function ([a, b]) {
    return a >= 0 && b >= 0 && a < ROOMS && b < ROOMS && !seen[a][b]
  })
  if (next.length === 0) { path.pop(); continue }
  const [a, b] = next[random(0, next.length - 1)]
  if (a > i) east[i][j] = false
  else if (a < i) east[a][b] = false
  else if (b > j) south[i][j] = false
  else south[a][b] = false
  seen[a][b] = true
  path.push([a, b])
}
// knock out some more walls so it feels like big, confusing rooms
for (let i = 0; i < ROOMS; i++) for (let j = 0; j < ROOMS; j++) {
  if (chance(OPEN)) east[i][j] = false
  if (chance(OPEN)) south[i][j] = false
}

// 3. build the walls (walls in a row become one long wall)
function wall(x, z, w, d) {
  build("block", { name: "Wall", x: x, y: 0, z: z, width: w, height: HEIGHT, depth: d, texture: "wallpaper", textureSize: 6 })
}
wall(0, -HALF, SIZE + 2, 1); wall(0, HALF, SIZE + 2, 1); wall(-HALF, 0, 1, SIZE); wall(HALF, 0, 1, SIZE)   // the outside
for (let i = 0; i < ROOMS - 1; i++) {
  let j = 0
  while (j < ROOMS) {
    if (!east[i][j]) { j++; continue }
    let k = j
    while (k + 1 < ROOMS && east[i][k + 1]) k++
    wall(middle(i) + ROOM / 2, (middle(j) + middle(k)) / 2, 1, (k - j + 1) * ROOM + 1)
    j = k + 1
  }
}
for (let j = 0; j < ROOMS - 1; j++) {
  let i = 0
  while (i < ROOMS) {
    if (!south[i][j]) { i++; continue }
    let k = i
    while (k + 1 < ROOMS && south[k + 1][j]) k++
    wall((middle(i) + middle(k)) / 2, middle(j) + ROOM / 2, (k - i + 1) * ROOM + 1, 1)
    i = k + 1
  }
}

// 4. pillars and buzzing ceiling lights
const lights = []
for (let i = 0; i < ROOMS; i++) for (let j = 0; j < ROOMS; j++) {
  if (chance(0.1) && !(i === start && j === start)) {
    build("block", { name: "Pillar", x: middle(i), y: 0, z: middle(j), width: 2, height: HEIGHT, depth: 2, texture: "wallpaper", textureSize: 6 })
  }
  if (chance(LIGHTS)) {
    lights.push(build("block", { name: "Ceiling Light", x: middle(i) + 3, y: HEIGHT - 0.15, z: middle(j), width: 3, height: 0.2, depth: 6, color: "#fff8dc", material: "neon", solid: false }))
  }
}

// 5. hide the Almond Water
for (let n = 0; n < BOTTLES; n++) {
  build("coin", { name: "Almond Water", x: middle(random(0, ROOMS - 1)) - 3, y: 1.5, z: middle(random(0, ROOMS - 1)) - 3 })
}

// 6. the Entity starts in a far corner... and hunts you
const entity = find("Entity")
entity.moveTo(middle(0), 0, middle(0))

game.sky = "backrooms"
say("You noclipped out of reality... Find all the Almond Water. Don't let the Entity find you!", 5)

// a random light blinks off for a moment
every(0.3, function () {
  const light = lights[random(0, lights.length - 1)]
  if (!light) return
  light.hide()
  after(random(1, 3) / 10, function () { light.show() })
})

// sometimes ALL the lights near you go dark...
every(15, function () {
  const near = lights.filter(function (light) { return light.distanceTo(player) < 25 })
  for (const light of near) light.hide()
  after(1.2, function () { for (const light of near) light.show() })
})

// a warning when the Entity gets close
let warned = false
every(1, function () {
  const d = entity.distanceTo(player)
  if (d < 25 && !warned) { warned = true; say("You hear something behind you...", 2); sound("alarm") }
  if (d > 40) warned = false
})

// drink all the Almond Water to wake up (delete this part if you want it to never end!)
every(0.5, function () {
  if (player.coins >= BOTTLES) win("You found all the Almond Water... and woke up!")
})
`;

// (🧰 the Studio Tools example: a map builder in the Tools menu)
export const MAP_TOOL_CODE = `// 🧰 MAP BUILDER TOOL
// This script adds buttons to the 🧰 Tools menu at the top of the studio.
// Click one and it builds right now, while you're building (not when you Play).
// Tools only work when this script is in GAME SCRIPTS.

// a field of trees and rocks around the middle of the map
addTool("Build a forest", "🌲", function () {
  for (let i = 0; i < 40; i++) {
    const x = random(-80, 80), z = random(-80, 80)
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue   // (keep the spawn clear)
    build(random(0, 3) === 0 ? "rock" : "tree", { name: "Forest", x: x, y: 0, z: z, turn: random(0, 359) })
  }
  say("Built a forest! (Ctrl+Z takes it back)")
})

// a walled arena with a platform in the middle
addTool("Build an arena", "🏟️", function () {
  const SIZE = 60, HIGH = 6
  build("block", { name: "Arena Wall", x: 0, y: 0, z: -SIZE / 2, width: SIZE, height: HIGH, depth: 2, color: "gray" })
  build("block", { name: "Arena Wall", x: 0, y: 0, z: SIZE / 2, width: SIZE, height: HIGH, depth: 2, color: "gray" })
  build("block", { name: "Arena Wall", x: -SIZE / 2, y: 0, z: 0, width: 2, height: HIGH, depth: SIZE, color: "gray" })
  build("block", { name: "Arena Wall", x: SIZE / 2, y: 0, z: 0, width: 2, height: HIGH, depth: SIZE, color: "gray" })
  build("block", { name: "Arena Middle", x: 0, y: 0, z: 0, width: 10, height: 2, depth: 10, color: "orange" })
  say("Built an arena!")
})

// take away everything the forest tool made
addTool("Clear the forest", "🧹", function () {
  for (const t of findAll("Forest")) t.destroy()
})
`;

export const EXAMPLES = [
  { name: "🧰 Map builder tool (Tools menu)", for: "game", code: MAP_TOOL_CODE },
  { name: "Backrooms maze builder", for: "game", code: BACKROOMS_CODE },
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
  const H = { click: new Map(), touch: new Map(), untouch: new Map(), key: new Map(), attack: new Map(), hit: new Map(), equip: new Map(), tool: new Map() };
  const updates = [], timers = [], follows = new Map(), spins = new Map(), errs = new Map();
  let out = [], now = 0, cur = null, nclone = 1, nbuild = 1, ended = false;
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
    else if (/\b(document|window|localStorage|THREE|require|alert|prompt)\b is not defined/.test(msg)) msg += ". (That's code for a web page, not GunnerVerse. Use me, find(\"Name\"), say(...) and the other commands. 🤖 Ask an AI explains them to the AI.)";
    cmd("err", s.name, m ? Math.max(1, +m[1] - 2) : 0, n === 6 ? msg + " (stopped showing this error)" : msg, s.id || "");
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
    onHit(fn) { on(H.hit, this._s.id, fn, "onHit"); cmd("want", "hit", this._s.id); return this; }
    onEquip(fn) { on(H.equip, this._s.id, fn, "onEquip"); return this; }   // (🎒 a weapon: the player got it)
    onAttack(fn) { on(H.attack, this._s.id, fn, "onAttack"); return this; } // (🎒 a weapon: the player used it)
    damage(n) { cmd("hurt", this._s.id, +n || 0); return this; }
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
    // build("block", {x, y, z, width, height, depth, color, texture, textureSize, stretch, material, solid, name, turn}): a new part (play.js checks it)
    build(type, o) {
      o = o && typeof o === "object" ? o : {};
      const n = (v, d) => (Number.isFinite(+v) && v !== null && v !== "" ? +v : d);
      const s = { id: "b" + nbuild++, kind: "part", type: String(type || "block"), name: String(o.name || type || "Part").slice(0, 40), x: n(o.x, P.x), y: n(o.y, 0), z: n(o.z, P.z), ry: n(o.turn, 0),
        sx: n(o.width, 4), sy: n(o.height, 1), sz: n(o.depth, 4), color: COLORS[String(o.color || "").toLowerCase()] || String(o.color || ""), visible: o.visible !== false, solid: o.solid !== false, text: String(o.text || "") };
      things.set(s.id, s);
      cmd("build", s.id, { type: s.type, name: s.name, pos: [s.x, s.y, s.z], ry: s.ry, size: [s.sx, s.sy, s.sz], color: s.color, tex: String(o.texture || ""), texS: n(o.textureSize, 0),
        fit: o.stretch ? "stretch" : "", mat: String(o.material || ""), solid: s.solid, visible: s.visible, text: s.text });
      return get(s.id);
    },
    all() { return [...things.keys()].map(get); },
    say(text, secs) { cmd("msg", String(text).slice(0, 200), Math.max(0.5, Math.min(30, +secs || 2.2))); },
    print(...a) { cmd("print", a.map((v) => (v && typeof v === "object" && !(v instanceof Thing) ? JSON.stringify(v) : String(v))).join(" ").slice(0, 500)); },
    after(secs, fn) { need(fn, "after"); const t = { at: now + Math.max(0, +secs || 0), fn, sc: cur }; timers.push(t); return { stop() { t.dead = true; } }; },
    every(secs, fn) { need(fn, "every"); const e = Math.max(0.05, +secs || 1); const t = { at: now + e, every: e, fn, sc: cur }; timers.push(t); return { stop() { t.dead = true; } }; },
    wait(secs) { return new Promise((res) => timers.push({ at: now + Math.max(0, +secs || 0), fn: res, sc: cur })); },
    onUpdate(fn) { need(fn, "onUpdate"); updates.push({ fn, sc: cur }); },
    // 🎒 a home-made weapon's script (weapons.js): runs when the player uses that weapon
    onAttack(fn) { need(fn, "onAttack"); on(H.attack, cur ? cur.on || cur.id : "", fn, "onAttack"); }, // (inside a weapon: that weapon; a game script: its own weapon)
    shoot(o) {
      o = o && typeof o === "object" ? o : {};
      let c = String(o.color || "purple").toLowerCase(); c = COLORS[c] || c; if (!/^#[0-9a-f]{6}$/.test(c)) c = "#a64bf4";
      cmd("shoot", { dmg: +o.damage || 0, sp: +o.speed || 80, color: c, size: +o.size || 0.25, drop: +o.drop || 0, freeze: +o.freeze || 0, boom: +o.boom || 0, spread: +o.spread || 0, n: +o.count || 1 });
    },
    // 🧰 STUDIO TOOLS: a Game Script can add buttons to the studio's 🧰 Tools menu (editor.js runTool). Clicking one runs
    // its function while you BUILD: what it builds (build(), destroy(), moveTo...) stays in the game. In Play it does nothing.
    addTool(name, icon, fn) {
      if (typeof icon === "function") { fn = icon; icon = "🧰"; }
      need(fn, "addTool");
      if (cur && cur.on) throw new Error("addTool only works in a Game Script. Right-click this script in the Explorer and pick \"Move to Game Scripts\".");
      name = String(name || "Tool").slice(0, 40);
      if (!H.tool.has(name)) H.tool.set(name, []);
      H.tool.get(name).push({ fn, sc: cur });
    },
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
      catch (e) { cmd("err", sc.name, 0, "Typo: " + e.message, sc.id); continue; }
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
      else if (kind === "attack") { const a = v && typeof v === "object" ? v : {}; fire(H.attack, id, { x: +a.x || 0, y: +a.y || 0, z: +a.z || 0, dx: +a.dx || 0, dz: +a.dz || 0, target: a.t ? get(a.t) : null }); }
      else if (kind === "hit") fire(H.hit, id, +v || 0);
      else if (kind === "equip") fire(H.equip, id);
      else if (kind === "tool") fire(H.tool, id);
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
