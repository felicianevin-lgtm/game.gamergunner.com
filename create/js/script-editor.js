// The SCRIPT EDITOR in GunnerVerse Studio: opens over the 3D view when you click a script in the Explorer (or ＋ Add
// Script). Line numbers, colored code, Tab = 2 spaces, Enter keeps the indent, a typo check while you type, 📚 Examples
// to start from, and a list of every command (click one to put it in your script). See scripts.js for what runs.
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
    '<button class="tb" type="button" id="seHelpBtn">❓ <span>Commands</span></button><button class="tb" type="button" id="seClose">✕ <span>Close</span></button></div>' +
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
