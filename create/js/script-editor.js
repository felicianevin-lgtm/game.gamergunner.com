// The SCRIPT EDITOR in GunnerVerse Studio: opens over the 3D view when you click a script in the Explorer (or ＋ Add
// Script). Line numbers, colored code, Tab = 2 spaces, Enter keeps the indent, a typo check while you type, 📚 Examples
// to start from, a list of every command (click one to put it in your script), and ✨ Make a script: pick "when" and
// "do what" from lists (your game's own parts and GUI) and it writes the code for you. See scripts.js for what runs.
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
    '<button class="tb se-make" type="button" id="seMake">✨ <span>Make a script</span></button><button class="tb" type="button" id="seHelpBtn">❓ <span>Commands</span></button><button class="tb" type="button" id="seClose">✕ <span>Close</span></button></div>' +
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
