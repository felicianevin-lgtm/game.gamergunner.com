// MUD VALLEY RP: controls. Keyboard, mouse (drag to look around, wheel to zoom) and touch (stick + buttons).
const held = new Set(), tapped = new Set();
export const look = { dx: 0, dy: 0, zoom: 0, lastT: -99 }; // camera drag since the last frame
export const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
export const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window || new URLSearchParams(location.search).has("touch");
let blockKeys = () => false;
// ---- your own controls (📱 Phone → ⚙️ Settings → 🎮 Controls). The game still thinks in its normal keys; a key you
// picked is turned into the normal one here, and a normal key you moved somewhere else stops doing that thing.
export const ACTIONS = [
  ["KeyW", "Gas / walk forward"], ["KeyS", "Brake / back up"], ["KeyA", "Steer / walk left"], ["KeyD", "Steer / walk right"],
  ["Space", "Jump / handbrake"], ["ShiftLeft", "Run"], ["KeyE", "Use / talk / open"], ["KeyF", "Get in / out"],
  ["KeyT", "Hitch / wheelie / close door"], ["KeyQ", "Use your item"], ["KeyX", "Switch item"], ["KeyH", "Horn"],
  ["KeyG", "Siren"], ["KeyR", "Reset your ride"], ["KeyM", "Map"], ["KeyP", "Phone"],
  ["ArrowLeft", "Camera left"], ["ArrowRight", "Camera right"], ["ArrowUp", "Camera up"], ["ArrowDown", "Camera down"],
];
const CKEY = "mv_controls";
export const controls = (() => { try { return Object.assign({ keys: {}, sens: 1, invert: false }, JSON.parse(localStorage.getItem(CKEY) || "{}")); } catch { return { keys: {}, sens: 1, invert: false }; } })();
let trans = {};
function rebuildKeys() {
  trans = {}; const used = new Set(ACTIONS.map(([d]) => controls.keys[d] || d));
  for (const [d] of ACTIONS) { const u = controls.keys[d] || d; if (u !== d) trans[u] = d; if (!used.has(d)) trans[d] = "-"; }
}
rebuildKeys();
export function saveControls() { try { localStorage.setItem(CKEY, JSON.stringify(controls)); } catch {} rebuildKeys(); }
export const keyOf = (d) => controls.keys[d] || d;
// set an action's key (if another action had it, they swap)
export function bindKey(d, code) {
  const other = ACTIONS.find(([x]) => x !== d && keyOf(x) === code);
  if (other) controls.keys[other[0]] = keyOf(d);
  controls.keys[d] = code;
  for (const [x] of ACTIONS) if (controls.keys[x] === x) delete controls.keys[x];
  saveControls();
}
export function resetControls() { controls.keys = {}; controls.sens = 1; controls.invert = false; saveControls(); }
export const keyName = (c) => ({ Space: "Space", ShiftLeft: "Shift", ShiftRight: "R-Shift", ControlLeft: "Ctrl", AltLeft: "Alt", Tab: "Tab", Enter: "Enter", Backspace: "Back", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", CapsLock: "Caps" })[c] || c.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ");
let capture = null;
export function captureKey(cb) { capture = cb; }
const tr = (c) => trans[c] || c;

export function initInput(canvas, opts = {}) {
  blockKeys = opts.block || blockKeys;
  addEventListener("keydown", (e) => {
    if (capture) { e.preventDefault(); e.stopPropagation(); const cb = capture; capture = null; cb(e.code); return; } // (picking a new key)
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
    const code = tr(e.code); if (code === "-") return;
    if (!e.repeat) tapped.add(code);
    held.add(code);
    opts.onKey && opts.onKey(code);
  }, true);
  addEventListener("keyup", (e) => held.delete(tr(e.code)));
  addEventListener("blur", () => held.clear());
  // mouse: hold a button and move to look around
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    opts.onTap && opts.onTap();
    if (e.pointerType === "mouse") { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
    // touch: left side = stick, right side = look around
    if (e.clientX < innerWidth * 0.45 && stick.id === null) {
      stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
      const el = document.getElementById("stickL"); el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px"; el.classList.add("on");
    } else if (!drag) drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), R = 55;
      if (l > R) { dx *= R / l; dy *= R / l; }
      stick.x = dx / R; stick.y = dy / R; document.querySelector("#stickL i").style.transform = `translate(${dx}px,${dy}px)`;
      return;
    }
    if (drag && (drag.id === undefined || drag.id === e.pointerId)) { look.dx += e.clientX - drag.x; look.dy += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; look.lastT = performance.now(); }
  });
  const up = (e) => {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; const el = document.getElementById("stickL"); el.classList.remove("on"); el.firstElementChild.style.transform = ""; el.style.left = el.style.top = ""; }
    if (drag && (drag.id === undefined || drag.id === e.pointerId)) drag = null;
  };
  addEventListener("pointerup", up); addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => { look.zoom += Math.sign(e.deltaY); }, { passive: true });
  // the on-screen buttons act like keys
  document.querySelectorAll("#tBtns button").forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); opts.onTap && opts.onTap(); tapped.add(k); held.add(k); b.classList.add("on"); opts.onKey && opts.onKey(k); });
    const rel = () => { held.delete(k); b.classList.remove("on"); };
    b.addEventListener("pointerup", rel); b.addEventListener("pointercancel", rel); b.addEventListener("pointerleave", rel);
  });
}
export const isHeld = (c) => !blockKeys() && held.has(c);
// (for tests: pretend a key is held down / was just pressed)
export function forceHeld(c, on) { if (on) held.add(c); else held.delete(c); }
export function forceTap(c) { tapped.add(c); }
// true once per press
export function pressed(c) { if (!tapped.has(c)) return false; tapped.delete(c); return !blockKeys(); }
export function clearTaps() { tapped.clear(); }
// steering (-1 left .. 1 right) and gas (-1 brake .. 1 gas), from keys or the stick
export function drive() {
  let steer = 0, thr = 0;
  if (isHeld("KeyA")) steer -= 1;
  if (isHeld("KeyD")) steer += 1;
  if (isHeld("KeyW")) thr += 1;
  if (isHeld("KeyS")) thr -= 1;
  if (stick.id !== null && !blockKeys()) { steer += stick.x * 1.15; thr += -stick.y * 1.2; }
  const burn = isHeld("KeyW") && isHeld("KeyS"); // (gas + brake together = burnout)
  return { steer: Math.max(-1, Math.min(1, steer)), thr: Math.max(-1, Math.min(1, thr)), hand: isHeld("Space"), burn };
}
// the arrow keys turn the camera: x = left/right, y = up/down
export function arrowLook() { return { x: (isHeld("ArrowRight") ? 1 : 0) - (isHeld("ArrowLeft") ? 1 : 0), y: (isHeld("ArrowUp") ? 1 : 0) - (isHeld("ArrowDown") ? 1 : 0) }; }
// walking: x = right, y = forward
export function walk() {
  let x = 0, y = 0;
  if (isHeld("KeyA")) x -= 1;
  if (isHeld("KeyD")) x += 1;
  if (isHeld("KeyW")) y += 1;
  if (isHeld("KeyS")) y -= 1;
  if (stick.id !== null && !blockKeys()) { x += stick.x; y -= stick.y; }
  return { x, y, run: isHeld("ShiftLeft") || isHeld("ShiftRight") || (stick.id !== null && Math.hypot(stick.x, stick.y) > 0.92) };
}
