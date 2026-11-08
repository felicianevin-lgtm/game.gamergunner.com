// SCREEN GUI for GunnerVerse Studio games: things drawn on the screen (not in the 3D world), shown in the editor (drag
// them anywhere) and live in Play. Stored in game.gui = [item]:
//   {id, kind (GUI_KINDS), name, text, x, y (the item's middle, in % of the screen), w, h (% of the screen: panels and
//    pictures), color, size: s / m / l (buttons + labels), transp (see-through %), visible (shown when the game starts), parent (a panel's id:
//    it moves, shows and hides with that panel), close (panels: a ✕ button), file (pictures: files.js id),
//    action (buttons: BUTTON_ACTIONS), message, target (the GUI or part the action uses), code (devmenu)}
// Older games used `pos` (one of 9 spots): sanitizeGui turns that into x / y.
// A Developer Menu button asks for its code in Play; the right code opens the dev menu (play.js).
export const GUI_SPOTS = { tl: [12, 12, "Top left"], tc: [50, 12, "Top middle"], tr: [88, 12, "Top right"], ml: [12, 50, "Middle left"], mc: [50, 50, "Center"], mr: [88, 50, "Middle right"],
  bl: [12, 84, "Bottom left"], bc: [50, 84, "Bottom middle"], br: [88, 84, "Bottom right"] };
export const GUI_KINDS = {
  label: { label: "Text Label", icon: "🔤", text: "Welcome to my game!", color: "#0e1513" },
  button: { label: "Button", icon: "🔘", text: "Click me!", color: "#1fae45" },
  frame: { label: "Panel (a box)", icon: "🟪", text: "My Panel", color: "#1d2a52" },
  image: { label: "Picture", icon: "🖼️", text: "", color: "#000000" },
  devmenu: { label: "Developer Menu", icon: "🛠️", text: "🛠 DEV", color: "#a64bf4" },
};
export const BUTTON_ACTIONS = {
  none: "Nothing (a script does it)",
  gui: "Open / close a GUI",
  part: "Show / hide a part",
  camera: "Look through a camera",
  message: "Show a message",
  spawn: "Go back to checkpoint",
  speed: "Super speed on / off",
  jump: "Super jump on / off",
  gravity: "Low gravity on / off",
};
export const NEEDS_TARGET = { gui: "GUI", part: "Part", camera: "Camera" };
export const GUI_SIZES = { s: "Small", m: "Medium", l: "Big" };
export const MAX_GUI = 40;
const rid = () => Math.random().toString(36).slice(2, 10);
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 10) / 10)) : d; };

export function newGui(kind, existing) {
  const k = GUI_KINDS[kind] || GUI_KINDS.label;
  kind = GUI_KINDS[kind] ? kind : "label";
  const g = { id: rid(), kind, name: k.label.split(" (")[0], text: k.text, x: 50, y: 50, color: k.color, size: "m", visible: true, parent: "" };
  const n = (existing || []).filter((x) => x.kind === kind).length;
  if (kind === "label") g.y = 12;
  if (kind === "button") { g.y = 84; g.x = 50 + ((n % 5) - 2) * 18; g.action = "message"; g.message = "Hello!"; g.target = ""; }
  if (kind === "devmenu") { g.x = 88; g.y = 20; g.code = String(Math.floor(1000 + Math.random() * 9000)); }
  if (kind === "frame") { g.w = 40; g.h = 46; g.close = true; }
  if (kind === "image") { g.w = 30; g.h = 30; g.file = ""; }
  return g;
}

export function sanitizeGui(list) {
  const out = [];
  for (const g of Array.isArray(list) ? list.slice(0, MAX_GUI) : []) {
    if (!g || !GUI_KINDS[g.kind]) continue;
    const K = GUI_KINDS[g.kind];
    const spot = GUI_SPOTS[g.pos];
    const c = { id: String(g.id || rid()).replace(/[^a-z0-9]/gi, "").slice(0, 16) || rid(), kind: g.kind,
      name: String(g.name || K.label).slice(0, 40), text: String(g.text == null ? K.text : g.text).slice(0, 60),
      x: num(g.x, 0, 100, spot ? spot[0] : 50), y: num(g.y, 0, 100, spot ? spot[1] : 50),
      color: /^#[0-9a-fA-F]{6}$/.test(g.color || "") ? g.color : K.color, size: GUI_SIZES[g.size] ? g.size : "m",
      visible: g.visible !== false, parent: /^[a-z0-9]{1,16}$/i.test(g.parent || "") ? g.parent : "" };
    if (g.kind === "button") {
      c.action = BUTTON_ACTIONS[g.action] ? g.action : "message";
      c.message = String(g.message == null ? "Hello!" : g.message).slice(0, 80);
      c.target = /^[a-z0-9]{1,20}$/i.test(g.target || "") ? g.target : "";
    }
    if (g.kind === "devmenu") c.code = String(g.code || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "1234";
    if (Number(g.transp) > 0) c.transp = Math.min(100, Math.round(Number(g.transp)));
    if (g.kind === "frame" || g.kind === "image") { c.w = num(g.w, 3, 100, 30); c.h = num(g.h, 3, 100, 30); }
    if (g.kind === "frame") c.close = g.close !== false;
    if (g.kind === "image") c.file = /^[a-z0-9]{6,40}$/i.test(g.file || "") ? g.file : "";
    out.push(c);
  }
  // a panel can't be inside a panel, and parents must exist
  const frames = new Set(out.filter((g) => g.kind === "frame").map((g) => g.id));
  for (const g of out) if (g.kind === "frame" || !frames.has(g.parent)) g.parent = "";
  return out;
}

// Light or dark text for a background color.
export function ink(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? "#111" : "#fff"; }
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }

// Is this item showing? (hidden itself, or inside a hidden panel)
export function guiShown(list, g) {
  if (!g.visible) return false;
  const p = g.parent && list.find((x) => x.id === g.parent);
  return !p || p.visible;
}

// Draw the GUI into a layer. Panels first (so things sit on top of them).
// opts: {edit (show hidden things faded, so you can still change them), selected, onClick(item, element), fileUrl(id)}
export function renderGui(layer, list, opts) {
  opts = opts || {};
  layer.innerHTML = "";
  const order = (list || []).filter((g) => g.kind === "frame").concat((list || []).filter((g) => g.kind !== "frame"));
  for (const g of order) {
    const shown = guiShown(list, g);
    if (!shown && !opts.edit) continue;
    const el = document.createElement(g.kind === "button" || g.kind === "devmenu" ? "button" : "div");
    el.className = "gui-item gui-" + g.kind + " gs-" + g.size + (opts.selected === g.id ? " gui-sel" : "") + (shown ? "" : " gui-off");
    if (el.tagName === "BUTTON") el.type = "button";
    el.style.left = g.x + "%"; el.style.top = g.y + "%";
    if (g.kind === "frame" || g.kind === "image") { el.style.width = g.w + "%"; el.style.height = g.h + "%"; }
    if (g.kind === "image") {
      const url = g.file && opts.fileUrl ? opts.fileUrl(g.file) : "";
      el.innerHTML = url ? '<img alt="" draggable="false" src="' + esc(url) + '">' : '<span class="gui-noimg">🖼️ Pick a picture</span>';
    } else {
      el.style.background = g.kind === "label" ? hexA(g.color, 0.82) : g.kind === "frame" ? hexA(g.color, 0.9) : g.color;
      el.style.color = ink(g.color);
      el.innerHTML = g.kind === "frame" ? (g.text ? '<div class="gui-title">' + esc(g.text) + "</div>" : "") + (g.close ? '<span class="gui-x" data-close="1">✕</span>' : "") : esc(g.text);
    }
    el.dataset.id = g.id;
    if (g.transp > 0) el.style.opacity = String(Math.max(0, 1 - g.transp / 100) * (shown ? 1 : 0.4));
    if (opts.selected === g.id && opts.edit && (g.kind === "frame" || g.kind === "image")) el.insertAdjacentHTML("beforeend", '<span class="gui-handle" data-handle="1" title="Drag to resize"></span>');
    if (opts.onClick) el.addEventListener("click", (e) => { e.stopPropagation(); opts.onClick(g, el, e); });
    layer.appendChild(el);
  }
}
