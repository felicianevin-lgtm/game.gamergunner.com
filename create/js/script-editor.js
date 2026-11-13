// The SCRIPT EDITOR in GunnerVerse Studio: opens over the 3D view when you click a script in the Explorer (or ＋ Add
// Script). Line numbers, colored code, Tab = 2 spaces, Enter keeps the indent, a typo check while you type, 📚 Examples
// to start from, a list of every command (click one to put it in your script), and ✨ Make a script: pick "when" and
// "do what" from lists (your game's own parts and GUI) and it writes the code for you. 🤖 Ask an AI copies a full guide
// (every command, the rules, the names in your game) to paste into an AI chat like Gemini or ChatGPT; pasting the AI's
// answer back here drops the ``` marks and extra talk around the code. See scripts.js for what runs.
import { HELP, EXAMPLES, checkTypos } from "./scripts.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TOKENS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|\b(\d+(?:\.\d+)?)\b|\b(const|let|var|function|return|if|else|for|while|of|in|new|true|false|null|undefined|await|async|break|continue|this)\b|\b(me|player|find|findAll|all|say|print|after|every|wait|onUpdate|onKey|sound|win|lose|random|shared|game|camera)\b/g;

export function starterCode(kind, name) {
  if (kind === "game") return '// 📜 A script for the whole game.\n// Get things by their name with find("Name"). Try 📚 Examples, or click a command on the right!\n\nsay("Welcome to my game!")\n';
  if (kind === "label") return '// 📜 This script is inside "' + name + '". Here, me means this text label.\n\nme.text = "Hello from a script!"\n';
  return '// 📜 This script is inside "' + name + '". Here, me means "' + name + '".\n// Try 📚 Examples, or click a command on the right!\n\nme.onClick(function () {\n  say("You clicked " + me.name + "!")\n})\n';
}

let cur = null; // {script, onChange, onClose}
export function openScript(script, opts) {
  build();
  cur = { script, ...opts };
  $("seName").value = script.name;
  $("seOn").textContent = opts.where;
  $("seTa").value = script.code;
  $("scriptEd").classList.remove("hidden");
  paint(); check(); markError(opts.errLine || 0);
  $("seTa").focus();
  $("seTa").setSelectionRange(script.code.length, script.code.length);
  drawExamples(opts.kind);
}
export function closeScript() { if (!cur) return; const c = cur; cur = null; $("scriptEd").classList.add("hidden"); if (c.onClose) c.onClose(); }
export function scriptOpen() { return cur ? cur.script.id : null; }

let built = false, checkTimer = 0, saveTimer = 0;
function build() {
  if (built) return;
  built = true;
  $("view").insertAdjacentHTML("beforeend",
    '<div class="script-ed hidden" id="scriptEd" role="dialog" aria-label="Script editor">' +
    '<div class="se-bar"><span class="se-ico">📜</span><input id="seName" maxlength="40" aria-label="Script name" spellcheck="false"><span class="se-on" id="seOn"></span>' +
    '<div class="se-drop"><button class="tb" type="button" id="seEx">📚 <span>Examples ▾</span></button><div class="se-menu hidden" id="seExMenu"></div></div>' +
    '<button class="tb se-make" type="button" id="seMake">✨ <span>Make a script</span></button><button class="tb se-ai" type="button" id="seAi">🤖 <span>Ask an AI</span></button><button class="tb" type="button" id="seHelpBtn">❓ <span>Commands</span></button><button class="tb" type="button" id="seClose">✕ <span>Close</span></button></div>' +
    '<div class="se-body"><div class="se-code"><div class="se-gutter" id="seGut"></div><div class="se-wrap"><pre class="se-hl" id="seHl" aria-hidden="true"></pre>' +
    '<textarea id="seTa" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Script code"></textarea></div></div>' +
    '<aside class="se-help" id="seHelp"></aside></div>' +
    '<div class="se-status" id="seStatus"></div></div>');
  $("seHelp").innerHTML = '<p class="se-tip">Click a command to put it in your script.</p>' + HELP.map(([group, items]) => '<div class="se-group">' + esc(group) + "</div>" +
    items.map(([code, desc]) => '<button type="button" class="se-cmd" data-code="' + esc(code) + '"><code>' + esc(code.split("\n")[0]) + "</code><small>" + esc(desc) + "</small></button>").join("")).join("");
  $("seHelp").querySelectorAll(".se-cmd").forEach((b) => (b.onclick = () => insert(b.dataset.code)));
  const ta = $("seTa");
  ta.addEventListener("input", () => { paint(); changed(); });
  ta.addEventListener("scroll", () => { $("seHl").scrollTop = ta.scrollTop; $("seHl").scrollLeft = ta.scrollLeft; $("seGut").scrollTop = ta.scrollTop; });
  ta.addEventListener("keydown", (e) => {
    e.stopPropagation(); // (keys here are for typing, not the studio's shortcuts)
    if (e.key === "Tab") { e.preventDefault(); insert("  "); }
    else if (e.key === "Enter") {
      const before = ta.value.slice(0, ta.selectionStart), line = before.slice(before.lastIndexOf("\n") + 1);
      let ind = line.match(/^\s*/)[0];
      if (/[{([]\s*$/.test(line)) ind += "  ";
      e.preventDefault(); insert("\n" + ind);
    } else if (e.key === "Escape") closeScript();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  });
  $("seName").addEventListener("keydown", (e) => e.stopPropagation());
  $("seName").onchange = () => { if (!cur) return; cur.script.name = $("seName").value.trim().slice(0, 40) || "Script"; $("seName").value = cur.script.name; save(); };
  $("seClose").onclick = closeScript;
  $("seHelpBtn").onclick = () => $("scriptEd").classList.toggle("no-help");
  $("seMake").onclick = openMaker;
  $("seAi").onclick = openAi;
  ta.addEventListener("paste", (e) => { // (an AI's answer: keep just the code)
    const text = e.clipboardData && e.clipboardData.getData("text/plain");
    const code = text && codeFromAnswer(text);
    if (code == null) return;
    e.preventDefault();
    insert(code);
    $("seStatus").className = "se-status good"; $("seStatus").textContent = "✓ Pasted just the code (the AI's ``` marks and extra words were left out).";
  });
  $("seEx").onclick = (e) => { e.stopPropagation(); $("seExMenu").classList.toggle("hidden"); };
  document.addEventListener("click", (e) => { if (built && !$("seExMenu").contains(e.target)) $("seExMenu").classList.add("hidden"); });
}
function drawExamples(kind) {
  const mine = (x) => (x.for === "part" && kind !== "game" && kind !== "gui") || (x.for === "gui" && kind === "gui") || (x.for === "game" && kind === "game");
  const list = EXAMPLES.filter(mine).concat(EXAMPLES.filter((x) => !mine(x)));
  $("seExMenu").innerHTML = list.map((x, i) => (i === EXAMPLES.filter(mine).length && i ? '<div class="menu-sec">More examples</div>' : "") +
    '<button type="button" data-i="' + EXAMPLES.indexOf(x) + '">' + esc(x.name) + "</button>").join("");
  $("seExMenu").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    $("seExMenu").classList.add("hidden");
    const ex = EXAMPLES[+b.dataset.i], ta = $("seTa");
    if (ta.value.trim() && !confirm('Replace your script with the "' + ex.name + '" example?')) return;
    ta.focus(); ta.select(); document.execCommand("insertText", false, ex.code) || (ta.value = ex.code);
    paint(); changed();
  }));
}
function insert(text) {
  const ta = $("seTa");
  ta.focus();
  if (!document.execCommand("insertText", false, text)) { // (keeps Ctrl+Z working; plain fallback otherwise)
    const a = ta.selectionStart;
    ta.setRangeText(text, a, ta.selectionEnd, "end");
  }
  paint(); changed();
}
function paint() {
  const code = $("seTa").value;
  let html = "", last = 0;
  code.replace(TOKENS, (m, com, str, num, kw, api, at) => {
    html += esc(code.slice(last, at));
    const c = com ? "c" : str ? "s" : num ? "n" : kw ? "k" : "a";
    html += '<span class="t' + c + '">' + esc(m) + "</span>";
    last = at + m.length;
    return m;
  });
  $("seHl").innerHTML = html + esc(code.slice(last)) + "\n";
  const n = code.split("\n").length;
  if ($("seGut").childElementCount !== n) $("seGut").innerHTML = Array.from({ length: n }, (_, i) => "<div>" + (i + 1) + "</div>").join("");
  markError(cur && cur.errLine || 0);
}
function markError(line) {
  $("seGut").querySelectorAll(".bad").forEach((d) => d.classList.remove("bad"));
  if (line && $("seGut").children[line - 1]) $("seGut").children[line - 1].classList.add("bad");
}
function changed() {
  clearTimeout(checkTimer); checkTimer = setTimeout(check, 350);
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 600);
}
function check() {
  const p = checkTypos($("seTa").value);
  $("seStatus").className = "se-status " + (p ? "bad" : "good");
  $("seStatus").textContent = p ? "⚠ Typo: " + p + " (check for a missing ) or } or quote)" : "✓ No typos. Press ▶ Play to try it!";
}
function save() {
  clearTimeout(saveTimer);
  if (!cur) return;
  cur.script.code = $("seTa").value.slice(0, 20000);
  if (cur.errLine) cur.errLine = 0;
  if (cur.onChange) cur.onChange();
}
export function flushScript() { if (cur) save(); }

// ---------------------------------------------------------------- 🤖 Ask an AI
// An AI's answer usually has words around ```javascript ... ``` blocks. Returns the code inside (all blocks), or null
// when there are no ``` marks (plain code: paste it as it is).
export function codeFromAnswer(text) {
  const blocks = [...text.matchAll(/```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\s+$/, ""));
  return blocks.length ? blocks.join("\n\n") + "\n" : null;
}
// The guide for the AI: what GunnerVerse scripts are, every command, the rules, and this game's names.
export function aiGuide(want, info) {
  const lines = [];
  lines.push("You are helping a kid write a script for a game made in GunnerVerse Studio (a 3D game maker in the web browser, a bit like Roblox Studio but with JavaScript).");
  lines.push("Please write ONE JavaScript script that does this:", "", ">>> " + (want.trim() || "(describe what the script should do here)"), "");
  lines.push("RULES (very important):",
    "- This is NOT a web page. There is no document, window, HTML, canvas, localStorage, fetch, import, require, alert or THREE. Only use the commands listed below.",
    "- The script runs once when the game starts. Use me.onClick / me.onTouch / onKey / after / every / onUpdate to make things happen later.",
    "- Get parts and GUI by their exact name with find(\"Name\") (names are case-sensitive; use the names in the list below).",
    "- Positions are studs: x = left/right, y = up, z = forward/back. A part's x, y, z is the middle of its BOTTOM. The ground is usually at y = 0.",
    "- For GUI things (buttons, labels, panels, pictures) x and y are percent of the screen (0 to 100), measured to the middle.",
    "- Angles are degrees. Things face toward -z.",
    "- Keep it simple and add short comments a kid can understand. Use function () { } (not arrow functions) so it's easy to read.",
    "- Answer with the code in ONE ```javascript block.", "");
  lines.push("THIS SCRIPT IS " + (info.kind === "game" ? "a game script: there is no `me` (me is null). Use find(\"Name\")." : "inside \"" + info.meName + "\" (a " + (info.kind === "gui" ? "GUI thing" : "part") + "), so `me` means \"" + info.meName + "\"."), "");
  lines.push("COMMANDS YOU CAN USE:");
  for (const [group, items] of HELP) {
    lines.push("", "## " + group);
    for (const [code, desc] of items) lines.push("- " + code.replace(/\n\s*\n/g, " ... ").replace(/\n/g, " ") + "   // " + desc);
  }
  lines.push("", "Also: me.name, me.visible, me.text, me.color, me.rotation, me.size, me.resize(x, y, z), me.onTouchEnd(fn), player.rotation, findAll(\"Name\"), all(), wait(seconds) inside an async function, console.log(...) (= print).");
  lines.push("Thing methods work on anything from find(): find(\"Door\").hide(), find(\"Shop\").toggle(), find(\"Monster\").follow(player, 6).");
  const things = info.things || [];
  if (things.length) {
    lines.push("", "THE THINGS IN THIS GAME (name - what it is):");
    for (const t of things.slice(0, 150)) lines.push("- \"" + t.name + "\" - " + (t.kind === "gui" ? "GUI " + ({ frame: "panel", image: "picture", devmenu: "developer menu button" }[t.type] || t.type) : "part (" + t.type + ")"));
  }
  // 🧰 Studio Tools (scripts.js addTool, editor.js runTool): what the AI must do when the kid asks for a tool or a map builder
  lines.push("", "IF THE KID ASKS FOR A TOOL, A MAP BUILDER, OR SOMETHING THAT BUILDS WHILE THEY'RE MAKING THE GAME (not while playing):",
    "GunnerVerse Studio has a 🧰 Tools menu at the top of the studio. A script adds buttons to it with addTool. Follow these steps:",
    "1. It MUST be a Game Script (in the \"Game Scripts\" folder of the Explorer, not inside a part or GUI). Tools in any other script don't work: tell the kid to right-click the script and pick \"Move to Game Scripts\" if it's in the wrong place.",
    "2. Register each tool with:  addTool(\"Tool name\", \"🗺️\", function () { ... })   (name, one emoji icon, a function). The tool's name shows in the Tools menu.",
    "3. Inside the function, build the map with build(type, { name, x, y, z, width, height, depth, color, texture, turn, solid }) in loops. Use random(a, b) for variety. Give the parts a shared name (like \"Forest\") so another tool can find them later with findAll(\"Forest\") and .destroy() them.",
    "4. You can also change things that are already in the game: find(\"Name\").moveTo(x, y, z), .color = \"red\", .resize(x, y, z), .destroy().",
    "5. Finish with say(\"Built it!\") so the kid sees it worked.",
    "6. Tell the kid: paste it into a Game Script, then click 🧰 Tools at the top of the studio and pick the tool. What it builds stays in the game (Ctrl+Z takes it back). Tools do nothing when you press Play.",
    "- Keep builds under about 1500 parts (the whole game can have 2000). Types for build: block, ball, cylinder, wedge, plate, coin, light, lava, jumppad, crate, barrel, cone, rock, bush, tree, pine, sign, checkpoint, door, stairs, fence, wall, spinner, mover.",
    "- Example tool:", "```javascript", "addTool(\"Build a forest\", \"🌲\", function () {", "  for (let i = 0; i < 40; i++) {", "    build(\"tree\", { name: \"Forest\", x: random(-80, 80), y: 0, z: random(-80, 80) })", "  }", "  say(\"Built a forest!\")", "})", "```");
  if (info.code && info.code.trim()) lines.push("", "THE SCRIPT SO FAR (change or add to it):", "```javascript", info.code.trim(), "```");
  lines.push("", "EXAMPLE of a correct GunnerVerse script:", "```javascript", "// When this button is clicked, open or close the panel named \"Shop\"", "me.onClick(function () {", "  find(\"Shop\").toggle()", "  sound(\"click\")", "})", "```");
  return lines.join("\n");
}
// 🔒 Ask an AI is locked with a code (only the owner of this studio uses it). It's a soft lock: the code is in the page.
const AI_CODE = "2468";
function aiUnlocked() { try { return sessionStorage.getItem("gv_ai_ok") === "1"; } catch { return false; } }
function askCode(then) {
  const box = document.createElement("div");
  box.className = "se-maker";
  box.innerHTML = '<div class="se-mk-box se-ai-box" role="dialog" aria-label="Code"><h3>🔒 Ask an AI</h3><p>Type the code to open the script builder.</p>' +
    '<form id="aiLock"><input id="aiCode" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="Code" style="font-size:20px;letter-spacing:.2em;text-align:center;width:140px">' +
    '<p class="se-ai-msg" id="aiLockMsg"></p><div class="se-mk-btns"><button class="tb" type="button" id="aiLockNo">Close</button><button class="tb se-make">Open</button></div></form></div>';
  $("scriptEd").appendChild(box);
  const q = (id) => box.querySelector("#" + id);
  box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") box.remove(); });
  q("aiLockNo").onclick = () => { box.remove(); $("seTa").focus(); };
  q("aiLock").onsubmit = (e) => {
    e.preventDefault();
    if (q("aiCode").value.trim() !== AI_CODE) { q("aiLockMsg").textContent = "Wrong code!"; q("aiCode").value = ""; q("aiCode").focus(); return; }
    try { sessionStorage.setItem("gv_ai_ok", "1"); } catch {}
    box.remove(); then();
  };
  q("aiCode").focus();
}
function openAi() {
  if (!cur) return;
  if (!aiUnlocked()) { askCode(openAi); return; }
  const box = document.createElement("div");
  box.className = "se-maker";
  box.innerHTML = '<div class="se-mk-box se-ai-box" role="dialog" aria-label="Ask an AI"><h3>🤖 Ask an AI</h3>' +
    '<p>AIs like Gemini or ChatGPT don\'t know GunnerVerse yet. This copies a guide that teaches the AI every GunnerVerse command and the names of the things in your game.</p>' +
    '<label>What should the script do?<textarea id="aiWant" rows="3" maxlength="600" placeholder="Example: when I click this button, open the panel called Shop and play a sound"></textarea></label>' +
    '<ol class="se-ai-steps"><li>Type what you want above, then press <b>📋 Copy for AI</b>.</li><li>Paste it into the AI chat (Ctrl+V) and send it.</li>' +
    '<li>Copy the AI\'s answer, close this box, click in your script and paste (Ctrl+V). The code gets picked out for you.</li><li>Press ▶ Play to try it. If the Output box shows an error, copy the error to the AI and ask it to fix it.</li></ol>' +
    '<details><summary>See the guide</summary><textarea id="aiText" rows="10" readonly></textarea></details>' +
    '<p class="se-ai-msg" id="aiMsg"></p>' +
    '<div class="se-mk-btns"><button class="tb" type="button" id="aiNo">Close</button><button class="tb se-make" type="button" id="aiGo">📋 Copy for AI</button></div></div>';
  $("scriptEd").appendChild(box);
  const q = (id) => box.querySelector("#" + id);
  const make = () => aiGuide(q("aiWant").value, { kind: cur.kind, meName: cur.meName, things: cur.things ? cur.things() : [], code: $("seTa").value.replace(/^\/\/ 📜.*\n?/gm, "") });
  const refresh = () => { q("aiText").value = make(); };
  q("aiWant").oninput = refresh; refresh();
  box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") box.remove(); });
  q("aiNo").onclick = () => { box.remove(); $("seTa").focus(); };
  q("aiGo").onclick = async () => {
    refresh();
    let ok = false;
    try { await navigator.clipboard.writeText(q("aiText").value); ok = true; } catch {}
    if (!ok) { box.querySelector("details").open = true; q("aiText").select(); ok = document.execCommand("copy"); }
    q("aiMsg").textContent = ok ? "✓ Copied! Now paste it into the AI chat." : "Select all the guide text above and copy it (Ctrl+C).";
  };
  q("aiWant").focus();
}

// ---------------------------------------------------------------- ✨ Make a script (writes the code for you)
const WHEN = {
  click: ["When this is clicked", (b) => "me.onClick(function () {\n" + b + "})\n"],
  touch: ["When the player touches this", (b) => "me.onTouch(function () {\n" + b + "})\n"],
  key: ["When a key is pressed", (b, x) => "onKey(" + JSON.stringify(x || "f") + ", function () {\n" + b + "})\n"],
  start: ["When the game starts", (b) => b.replace(/^  /gm, "")],
  after: ["After some seconds", (b, x) => "after(" + (+x || 3) + ", function () {\n" + b + "})\n"],
  every: ["Every few seconds", (b, x) => "every(" + (+x || 1) + ", function () {\n" + b + "})\n"],
};
const DO = {
  toggle: ["Open / close it (show or hide)", "any", (t) => t + ".toggle()"],
  show: ["Show it", "any", (t) => t + ".show()"],
  hide: ["Hide it", "any", (t) => t + ".hide()"],
  say: ["Show a message", "text", (t, x) => "say(" + JSON.stringify(x || "Hello!") + ")"],
  sound: ["Play a sound", "sound", (t, x) => "sound(" + JSON.stringify(x || "beep") + ")"],
  teleport: ["Teleport the player to it", "part", (t) => "player.teleport(" + t + ")"],
  spin: ["Make it spin", "part", (t) => t + ".spin(90)"],
  color: ["Change its color", "color", (t, x) => t + ".color = " + JSON.stringify(x || "red")],
  see: ["Make it see-through", "any", (t) => t + ".transparency = 70"],
  chase: ["Make it chase the player", "part", (t) => t + ".follow(player, 6)"],
  speed: ["Super speed for the player", "none", () => "player.speed = 2"],
  hurt: ["Hurt the player", "none", () => "player.damage(25)"],
  win: ["The player wins", "text", (t, x) => "win(" + JSON.stringify(x || "You win!") + ")"],
  lose: ["The player loses", "text", (t, x) => "lose(" + JSON.stringify(x || "Game over!") + ")"],
};
const SOUNDS = ["beep", "coin", "jump", "boom", "door", "alarm", "scream", "win", "lose", "click"];
const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "white", "black"];
function openMaker() {
  if (!cur) return;
  const things = cur.things ? cur.things() : [];
  const hasMe = cur.kind !== "game";
  const box = document.createElement("div");
  box.className = "se-maker";
  const opt = (v, t) => '<option value="' + esc(v) + '">' + esc(t) + "</option>";
  box.innerHTML = '<div class="se-mk-box" role="dialog" aria-label="Make a script"><h3>✨ Make a script</h3><p>Pick what happens, and the code gets written for you.</p>' +
    '<label>When…<select id="mkWhen">' + Object.entries(WHEN).filter(([k]) => hasMe || (k !== "click" && k !== "touch")).filter(([k]) => k !== "touch" || cur.kind === "part").map(([k, v]) => opt(k, v[0])).join("") + "</select></label>" +
    '<label id="mkXW" class="hidden"><span id="mkXWl"></span><input id="mkXWin" maxlength="10"></label>' +
    '<label>Do this…<select id="mkDo">' + Object.entries(DO).map(([k, v]) => opt(k, v[0])).join("") + "</select></label>" +
    '<label id="mkTL">To…<select id="mkT"></select></label>' +
    '<label id="mkXL" class="hidden"><span id="mkXLl"></span><input id="mkX" maxlength="80"><select id="mkXs" class="hidden"></select></label>' +
    '<pre class="se-mk-code" id="mkCode"></pre>' +
    '<div class="se-mk-btns"><button class="tb" type="button" id="mkNo">Cancel</button><button class="tb se-make" type="button" id="mkGo">✓ Add to my script</button></div></div>';
  $("scriptEd").appendChild(box);
  const q = (id) => box.querySelector("#" + id);
  function targets(kind) {
    const list = things.filter((t) => kind === "any" || (kind === "part" ? t.kind === "part" : true));
    return (hasMe ? opt("me", "This thing (" + cur.meName + ")") : "") +
      '<optgroup label="GUI">' + list.filter((t) => t.kind === "gui").map((t) => opt(t.name, "🖥️ " + t.name)).join("") + "</optgroup>" +
      '<optgroup label="Parts">' + list.filter((t) => t.kind === "part").map((t) => opt(t.name, t.name)).join("") + "</optgroup>";
  }
  function code() {
    const w = q("mkWhen").value, d = DO[q("mkDo").value];
    const tv = q("mkT").value, target = tv === "me" ? "me" : "find(" + JSON.stringify(tv) + ")";
    const extra = d[1] === "sound" || d[1] === "color" ? q("mkXs").value : q("mkX").value;
    const line = d[2](target, extra);
    return "\n// ✨ " + WHEN[w][0] + ": " + d[0].toLowerCase() + (d[1] === "any" || d[1] === "part" ? " (" + (tv === "me" ? cur.meName : tv) + ")" : "") + "\n" + WHEN[w][1]("  " + line + "\n", q("mkXWin").value);
  }
  function update(fresh) {
    const w = q("mkWhen").value, d = DO[q("mkDo").value];
    q("mkXW").classList.toggle("hidden", !["key", "after", "every"].includes(w));
    q("mkXWl").textContent = w === "key" ? "Which key?" : "How many seconds?";
    if (fresh === "when") q("mkXWin").value = w === "key" ? "f" : w === "every" ? "1" : "3";
    q("mkTL").classList.toggle("hidden", !["any", "part"].includes(d[1]));
    if (fresh === "do") { const keep = q("mkT").value; q("mkT").innerHTML = targets(d[1]); if ([...q("mkT").options].some((o) => o.value === keep)) q("mkT").value = keep; }
    const pick = d[1] === "sound" || d[1] === "color", txt = d[1] === "text";
    q("mkXL").classList.toggle("hidden", !pick && !txt);
    q("mkX").classList.toggle("hidden", !txt); q("mkXs").classList.toggle("hidden", !pick);
    q("mkXLl").textContent = d[1] === "sound" ? "Which sound?" : d[1] === "color" ? "Which color?" : "The words";
    if (fresh === "do" && pick) q("mkXs").innerHTML = (d[1] === "sound" ? SOUNDS : COLORS).map((x) => opt(x, x)).join("");
    if (fresh === "do" && txt) q("mkX").value = q("mkDo").value === "win" ? "You win!" : q("mkDo").value === "lose" ? "Game over!" : "Hello!";
    q("mkCode").textContent = code().trim();
  }
  q("mkT").innerHTML = targets("any");
  // a GUI button's script most likely opens a panel
  const panel = things.find((t) => t.kind === "gui" && t.type === "frame");
  if (panel) q("mkT").value = panel.name;
  q("mkWhen").onchange = () => update("when"); q("mkDo").onchange = () => update("do");
  for (const id of ["mkT", "mkX", "mkXs", "mkXWin"]) { q(id).oninput = () => update(); q(id).onchange = () => update(); }
  box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") box.remove(); });
  q("mkNo").onclick = () => box.remove();
  q("mkGo").onclick = () => {
    const ta = $("seTa"), add = code();
    box.remove();
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    if (!document.execCommand("insertText", false, (ta.value.endsWith("\n") || !ta.value ? "" : "\n") + add)) ta.value += add;
    paint(); changed();
  };
  update("when"); update("do");
}
