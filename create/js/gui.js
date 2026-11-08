// SCREEN GUI for GunnerVerse Studio games: things drawn on the screen (not in the 3D world), shown in the editor as a
// preview and live in Play. Stored in game.gui = [item]:
//   {id, kind: label / button / devmenu, name, text, pos (one of GUI_SPOTS), color, size: s / m / l,
//    action (buttons: BUTTON_ACTIONS), message (for "message"), code (devmenu: the code that opens it)}
// A Developer Menu button asks for its code in Play; the right code opens the dev menu (play.js).
export const GUI_SPOTS = { tl: "Top left", tc: "Top middle", tr: "Top right", ml: "Middle left", mc: "Center", mr: "Middle right", bl: "Bottom left", bc: "Bottom middle", br: "Bottom right" };
export const GUI_KINDS = {
  label: { label: "Text Label", icon: "🔤", text: "Welcome to my game!", color: "#0e1513" },
  button: { label: "Button", icon: "🔘", text: "Super Speed!", color: "#1fae45" },
  devmenu: { label: "Developer Menu", icon: "🛠️", text: "🛠 DEV", color: "#a64bf4" },
};
export const BUTTON_ACTIONS = { message: "Show a message", spawn: "Go back to checkpoint", speed: "Super speed on / off", jump: "Super jump on / off", gravity: "Low gravity on / off" };
export const GUI_SIZES = { s: "Small", m: "Medium", l: "Big" };
const MAX_GUI = 20;

export function newGui(kind, existing) {
  const k = GUI_KINDS[kind] || GUI_KINDS.label;
  const taken = new Set((existing || []).map((g) => g.pos));
  const pos = kind === "devmenu" ? "tr" : kind === "label" ? "tc" : ["bc", "ml", "mr", "bl", "br", "tc"].find((p) => !taken.has(p)) || "bc";
  const g = { id: Math.random().toString(36).slice(2, 10), kind: GUI_KINDS[kind] ? kind : "label", name: k.label, text: k.text, pos, color: k.color, size: "m" };
  if (kind === "button") { g.action = "speed"; g.message = "Hello!"; }
  if (kind === "devmenu") g.code = String(Math.floor(1000 + Math.random() * 9000));
  return g;
}

export function sanitizeGui(list) {
  const out = [];
  for (const g of Array.isArray(list) ? list.slice(0, MAX_GUI) : []) {
    if (!g || !GUI_KINDS[g.kind]) continue;
    const c = { id: String(g.id || Math.random().toString(36).slice(2, 10)).replace(/[^a-z0-9]/gi, "").slice(0, 16), kind: g.kind,
      name: String(g.name || GUI_KINDS[g.kind].label).slice(0, 40), text: String(g.text == null ? GUI_KINDS[g.kind].text : g.text).slice(0, 40),
      pos: GUI_SPOTS[g.pos] ? g.pos : "tc", color: /^#[0-9a-fA-F]{6}$/.test(g.color || "") ? g.color : GUI_KINDS[g.kind].color, size: GUI_SIZES[g.size] ? g.size : "m" };
    if (g.kind === "button") { c.action = BUTTON_ACTIONS[g.action] ? g.action : "message"; c.message = String(g.message == null ? "Hello!" : g.message).slice(0, 80); }
    if (g.kind === "devmenu") c.code = String(g.code || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "1234";
    out.push(c);
  }
  return out;
}

// Light or dark text for a background color.
function ink(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? "#111" : "#fff"; }
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Draw the GUI into a layer (one stack per screen spot). opts: {selected, onClick(item, element)}
export function renderGui(layer, list, opts) {
  opts = opts || {};
  const zones = {};
  layer.innerHTML = Object.keys(GUI_SPOTS).map((p) => '<div class="gui-zone z-' + p + '"></div>').join("");
  layer.querySelectorAll(".gui-zone").forEach((z) => (zones[z.className.split("z-")[1]] = z));
  for (const g of list || []) {
    const el = document.createElement(g.kind === "label" ? "div" : "button");
    el.className = "gui-item gui-" + g.kind + " gs-" + g.size + (opts.selected === g.id ? " gui-sel" : "");
    if (el.tagName === "BUTTON") el.type = "button";
    el.style.background = g.kind === "label" ? hexA(g.color, 0.82) : g.color;
    el.style.color = ink(g.color);
    el.innerHTML = esc(g.text);
    el.dataset.id = g.id;
    if (opts.onClick) el.addEventListener("click", (e) => { e.stopPropagation(); opts.onClick(g, el); });
    zones[g.pos].appendChild(el);
  }
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
