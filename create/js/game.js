// A GunnerVerse Studio GAME is plain JSON, saved in this browser (localStorage). Publish (editor.js) sends a copy to the
// relay (publish.js) and remembers the published id in `pub`:
//   {v: 1, id, name, created, updated, pub?, settings: {sky, gravity, walk, jump}, objects: [obj, ...]}
//   obj = {id, type (assets.js), name, pos: [x, y, z] (bottom center), rot: [x, y, z] degrees, size: [x, y, z],
//          color, mat, solid, visible, transp (see-through %), b: {k: behavior, ...settings}, text, file + anim (imported models / pictures)}
//   gui = [item] (gui.js), files = {id: {name, type, sid?}} (imported files, files.js),
//   scripts = [{id, name, on: the object or GUI id it's inside ("" = the whole game), code: JavaScript}] (scripts.js)
// Storage: "gv_studio_list" = [{id, name, updated}] newest first, "gv_studio_game_<id>" = the game.
import { BY_TYPE, BEHAVIORS } from "./assets.js";
import { sanitizeGui } from "./gui.js";
import { sanitizeMonster, monsterSize } from "./monster.js";
import { BACKROOMS_CODE } from "./scripts.js";
import { sanitizeMotion } from "./motion.js";
import { sanitizeChase, sanitizeScare } from "./scare.js";
import { sanitizeAnims } from "./keyanim.js";
import { okTex } from "./textures.js";

export const SKIES = { day: "Sunny day", sunset: "Sunset", night: "Night", space: "Space", backrooms: "Backrooms (yellow fog)" };
export const DEFAULT_SETTINGS = { sky: "day", gravity: 70, walk: 14, jump: 26 };
export const MAX_SCRIPTS = 40, MAX_SCRIPT_CHARS = 20000;
const LIST_KEY = "gv_studio_list", GAME_KEY = "gv_studio_game_";

export function uid() { return Math.random().toString(36).slice(2, 10); }
export const r2 = (n) => Math.round(n * 100) / 100;

export function newObj(type, pos, extra) {
  const a = BY_TYPE[type] || BY_TYPE.block;
  const o = { id: uid(), type: a.type, name: a.label, pos: (pos || [0, 0, 0]).map(r2), rot: [0, 0, 0], size: a.base.slice(),
    color: a.color, mat: a.mat || "plastic", solid: a.solid !== false, visible: true, b: { k: "none" } };
  if (a.b) o.b = { ...a.b };
  fillBehavior(o);
  if (a.text) o.text = a.text;
  return Object.assign(o, extra || {});
}

// Make sure a behavior has all of its settings (new behaviors start with their defaults).
export function fillBehavior(o) {
  const def = BEHAVIORS[o.b && o.b.k] || BEHAVIORS.none;
  if (!o.b || !BEHAVIORS[o.b.k]) o.b = { k: "none" };
  for (const [key, , , dflt] of def.params || []) if (o.b[key] === undefined) o.b[key] = dflt;
}

// Clean up a game loaded from storage (or, later, from someone else): unknown things are dropped, numbers clamped.
export function sanitize(g) {
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const out = { v: 1, id: String(g.id || uid()).slice(0, 20), name: String(g.name || "My Game").slice(0, 40), created: g.created || Date.now(), updated: g.updated || Date.now(),
    settings: { ...DEFAULT_SETTINGS }, objects: [] };
  if (/^[a-z0-9]{12}$/.test(g.shared || "")) out.shared = g.shared; // (👥 a shared studio: its id on the relay, collab.js)
  if (/^[a-z0-9]{8,16}$/.test(g.pub || "")) out.pub = g.pub; // (published: the game's id on the GunnerVerse home page)
  if (g.desc) out.desc = String(g.desc).slice(0, 300);
  out.gui = sanitizeGui(g.gui); // (screen GUI: labels, buttons, panels, pictures, the dev menu button)
  out.files = {};
  for (const [id, f] of Object.entries(g.files && typeof g.files === "object" ? g.files : {}).slice(0, 40)) {
    if (!/^[a-z0-9]{6,40}$/i.test(id) || !f || !/^(png|jpeg|glb|gltf|fbx|obj)$/.test(f.type)) continue;
    out.files[id] = { name: String(f.name || "Imported").slice(0, 30), type: f.type };
    if (/^[a-z0-9]{8,32}$/.test(f.sid || "")) out.files[id].sid = f.sid;
  }
  out.scripts = [];
  for (const sc of Array.isArray(g.scripts) ? g.scripts.slice(0, MAX_SCRIPTS) : []) {
    if (!sc || typeof sc.code !== "string") continue;
    out.scripts.push({ id: String(sc.id || uid()).replace(/[^a-z0-9]/gi, "").slice(0, 16) || uid(), name: String(sc.name || "Script").slice(0, 40),
      on: /^[a-z0-9]{1,20}$/i.test(sc.on || "") ? sc.on : "", code: sc.code.slice(0, MAX_SCRIPT_CHARS) });
  }
  const s = g.settings || {};
  out.settings.sky = SKIES[s.sky] ? s.sky : "day";
  out.settings.gravity = num(s.gravity, 10, 200, 70); out.settings.walk = num(s.walk, 4, 60, 14); out.settings.jump = num(s.jump, 5, 80, 26);
  for (const o of (g.objects || []).slice(0, 2000)) {
    if (!o || !BY_TYPE[o.type]) continue;
    const c = newObj(o.type);
    c.id = String(o.id || uid()).slice(0, 20);
    c.name = String(o.name || c.name).slice(0, 40);
    c.pos = [0, 1, 2].map((i) => num(o.pos && o.pos[i], -5000, 5000, 0));
    c.rot = [0, 1, 2].map((i) => num(o.rot && o.rot[i], -360, 360, 0));
    c.size = [0, 1, 2].map((i) => num(o.size && o.size[i], 0.1, 1024, c.size[i]));
    c.color = /^#[0-9a-fA-F]{6}$/.test(o.color || "") ? o.color : c.color;
    c.mat = ["plastic", "smooth", "metal", "neon", "glass", "grass"].includes(o.mat) ? o.mat : c.mat;
    c.solid = o.solid !== false; c.visible = o.visible !== false;
    if (o.b && BEHAVIORS[o.b.k]) {
      c.b = { k: o.b.k };
      for (const [key, , kind, dflt] of BEHAVIORS[o.b.k].params || []) {
        const v = o.b[key];
        c.b[key] = kind === "number" ? num(v, -1000, 1000, dflt) : kind === "check" ? !!v : kind === "axis" ? (["x", "y", "z"].includes(v) ? v : dflt) : String(v == null ? dflt : v).slice(0, 80);
      }
    } else c.b = { k: "none" };
    if (o.type === "monster") c.mon = sanitizeMonster(o.mon); // (the monster's recipe, monster.js)
    if (Number(o.transp) > 0) c.transp = Math.min(100, Math.round(Number(o.transp))); // (see-through %, 100 = invisible)
    if (/^[a-z0-9]{6,40}$/i.test(o.file || "")) c.file = o.file;
    if (okTex(o.tex)) { c.tex = o.tex; if (Number(o.texS) > 0) c.texS = Math.min(64, Math.max(0.25, Number(o.texS))); if (o.texFit === "stretch") c.texFit = "stretch"; } // (🧱 a texture - textures.js)
    if (typeof o.anim === "string" && o.anim) c.anim = o.anim.slice(0, 60);
    if (o.mo) c.mo = sanitizeMotion(o.mo); // (Animation settings: walk style, standing move, when, speed - motion.js)
    if (o.xray) c.xray = true; // (see through it while building - editor.js)
    if (typeof o.bump === "boolean") c.bump = o.bump; // (walls stop it when it moves; monsters do unless this is false)
    if (o.chase) c.chase = sanitizeChase(o.chase); // (👾 it chases players - scare.js)
    if (o.scare) c.scare = sanitizeScare(o.scare); // (😱 jump scare - scare.js)
    if (o.anims) { const an = sanitizeAnims(o.anims); if (an) c.anims = an; } // (🎞️ my animations: keyframes - keyanim.js)
    if (typeof o.text === "string" || BY_TYPE[o.type].text) c.text = String(o.text == null ? BY_TYPE[o.type].text || "" : o.text).slice(0, 120);
    out.objects.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- saving (this browser)
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
export function listGames() { try { return JSON.parse(safeGet(LIST_KEY) || "[]"); } catch { return []; } }
export function loadGame(id) { try { const g = JSON.parse(safeGet(GAME_KEY + id) || "null"); return g ? sanitize(g) : null; } catch { return null; } }
export function saveGame(g) {
  g.updated = Date.now();
  if (!safeSet(GAME_KEY + g.id, JSON.stringify(g))) return false;
  const list = listGames().filter((x) => x.id !== g.id);
  list.unshift({ id: g.id, name: g.name, updated: g.updated });
  return safeSet(LIST_KEY, JSON.stringify(list.slice(0, 100)));
}
export function deleteGame(id) {
  try { localStorage.removeItem(GAME_KEY + id); } catch {}
  safeSet(LIST_KEY, JSON.stringify(listGames().filter((x) => x.id !== id)));
}

// ---------------------------------------------------------------- starter templates
function baseplate() { return newObj("block", [0, -2, 0], { name: "Baseplate", size: [256, 2, 256], color: "#5fa84f", mat: "grass" }); }
export const TEMPLATES = {
  baseplate: { label: "Baseplate", icon: "🟩", desc: "Empty grass. Build anything!", make: () => [baseplate(), newObj("spawn", [0, 0, 0])] },
  obby: { label: "Obby", icon: "🧗", desc: "Jump across platforms, dodge lava, reach the finish.",
    make: () => {
      const o = [baseplate(), newObj("spawn", [0, 0, 0])];
      o.push(newObj("lava", [0, 0, -42], { name: "Lava Floor", size: [40, 0.6, 70] }));
      const steps = [[0, 0.5, -7], [4, 2, -13], [-1, 3.5, -19], [4, 5, -25], [-2, 6.5, -31]];
      steps.forEach((p, i) => o.push(newObj("block", p, { name: "Step " + (i + 1), size: [5, 1, 5], color: ["#2f7df6", "#a64bf4", "#ff7a1a", "#13c4c4", "#ff4fa3"][i] })));
      o.push(newObj("checkpoint", [-2, 7.5, -38]));
      o.push(newObj("mover", [-2, 7.5, -46], { b: { k: "move", axis: "x", distance: 10, speed: 4, hurts: false } }));
      o.push(newObj("plate", [6, 7.5, -57], { size: [10, 1, 10] }));
      o.push(newObj("spinner", [6, 8.5, -54], { size: [7, 2, 1] }));
      o.push(newObj("jumppad", [6, 8.5, -60], { b: { k: "jump", power: 34 } }));
      o.push(newObj("plate", [6, 13, -73], { name: "Goal", color: "#ffc531", size: [12, 1, 12] }));
      o.push(newObj("finish", [6, 14, -76]));
      for (const p of [[4, 3.5, -13], [4, 6.5, -25], [-2, 9.5, -46], [6, 15.5, -71]]) o.push(newObj("coin", p));
      o.push(newObj("sign", [7, 0, 1], { text: "Reach the finish! Don't touch the lava!" }));
      return o;
    } },
  racing: { label: "Racing", icon: "🏁", desc: "Cars, ramps and coins. Press E to drive.",
    make: () => {
      const o = [baseplate(), newObj("spawn", [0, 0, 0])];
      o.push(newObj("car", [-6, 0, -6])); o.push(newObj("kart", [6, 0, -6])); o.push(newObj("dirtbike", [12, 0, -6]));
      o.push(newObj("block", [0, -0.9, -70], { name: "Road", size: [16, 1, 130], color: "#3a3d42" }));
      o.push(newObj("wedge", [0, 0, -45], { size: [10, 3, 10] }));
      o.push(newObj("wedge", [0, 0, -95], { size: [10, 4, 12] }));
      for (let i = 0; i < 6; i++) o.push(newObj("coin", [0, 2 + (i === 1 || i === 4 ? 4 : 0), -25 - i * 16]));
      for (let i = 0; i < 8; i++) { o.push(newObj("cone", [-9, 0, -15 - i * 16])); o.push(newObj("cone", [9, 0, -15 - i * 16])); }
      o.push(newObj("finish", [0, 0, -132], { size: [18, 8, 1.5] }));
      o.push(newObj("tree", [-20, 0, -40])); o.push(newObj("pine", [22, 0, -70])); o.push(newObj("tree", [-18, 0, -110]));
      return o;
    } },
};
// (not on the starter list: Gunner's own Backrooms game is made from the link create/?new=backrooms - editor.js)
const BACKROOMS = { label: "Backrooms", icon: "🟨", desc: "Endless yellow rooms, buzzing lights and something lurking. Find the Almond Water! (A new maze every time.)",
  sky: "backrooms", scripts: () => [{ id: uid(), name: "Backrooms", on: "", code: BACKROOMS_CODE }], make: backrooms };

// THE BACKROOMS (made from the link create/?new=backrooms): just a spawn point and the Entity. Its script
// (scripts.js BACKROOMS_CODE) builds the whole maze with build() when the game starts, a new one every time.
function backrooms() {
  const mon = sanitizeMonster({ body: "lanky", color: "#0c0c0e", color2: "#1b1b20", eyeColor: "#f4f4ff", eyes: 0, legs: 2, arms: 2, heads: 1, claws: true, height: 9.5, width: 0.8 });
  return [
    newObj("spawn", [0, 0, 0]),
    newObj("sign", [4, 0, -4], { text: "Press Play: the script builds the Backrooms (a new maze every time)" }),
    newObj("monster", [20, 0, 20], { name: "Entity", mon, text: "The Entity", size: monsterSize(mon),
      mo: { g: "stalk", i: "look", w: "move", sp: 1 }, chase: { sp: 8, dmg: 34, r: 0, face: 1, snd: "glitch", see: 1 } }),
  ];
}

export function makeGame(templateKey, name) {
  const t = TEMPLATES[templateKey] || (templateKey === "backrooms" ? BACKROOMS : TEMPLATES.baseplate);
  return { v: 1, id: uid(), name: name || (t === BACKROOMS ? "The Backrooms" : "My " + t.label + " Game"), created: Date.now(), updated: Date.now(), settings: { ...DEFAULT_SETTINGS, ...(t.sky ? { sky: t.sky } : {}) }, objects: t.make(), gui: [], files: {}, scripts: t.scripts ? t.scripts() : [] };
}
