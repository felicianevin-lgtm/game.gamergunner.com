// 🎒 STARTING WEAPONS for GunnerVerse Studio games. The maker picks what the player starts with ("Player starts with",
// top left of the studio, editor.js): up to 4 from the list below, or their own (✨ Create your own: a name, a look
// and a color, plus a normal game script with onAttack() that says what it does, scripts.js).
// Saved in the game as settings.start = [weapon ids] and settings.arms = [{id, name, look, color, script}] (game.js).
// play.js puts them in the player's hand: 1-4 switches, click or Q attacks. All made-up weapons, no real ones.
import * as THREE from "../vendor/three.module.js";

export const MAX_START = 4, MAX_ARMS = 12;

// kind: melee (swings, hits everything in front) or ranged (shoots). dmg per hit, cd = seconds between attacks,
// range (melee reach / how far a shot flies), sp = shot speed, grav = shots fall, n = shots at once (spread),
// boom = splash radius, freeze = seconds a hit monster stands still, kb = knockback.
export const WEAPONS = {
  bat:      { name: "Wooden Bat",      icon: "🏏", kind: "melee",  look: "bat",      color: "#b07a44", dmg: 20, cd: 0.45, range: 4.2, kb: 16, desc: "Bonk! Big knockback" },
  sword:    { name: "Iron Sword",      icon: "🗡️", kind: "melee",  look: "sword",    color: "#cfd6de", dmg: 30, cd: 0.5,  range: 4.6, kb: 10, desc: "A trusty blade" },
  axe:      { name: "Battle Axe",      icon: "🪓", kind: "melee",  look: "axe",      color: "#9aa3ad", dmg: 45, cd: 0.85, range: 4.4, kb: 12, desc: "Slow but strong" },
  hammer:   { name: "Thunder Hammer",  icon: "🔨", kind: "melee",  look: "hammer",   color: "#5f6b78", dmg: 55, cd: 1.1,  range: 4.4, kb: 24, boom: 4, desc: "Smash the ground" },
  glow:     { name: "Glow Blade",      icon: "✨", kind: "melee",  look: "glow",     color: "#38e8ff", dmg: 40, cd: 0.4,  range: 5,   kb: 8,  desc: "A blade of pure light" },
  spear:    { name: "Long Spear",      icon: "🔱", kind: "melee",  look: "spear",    color: "#c9a25a", dmg: 28, cd: 0.6,  range: 6.5, kb: 9,  desc: "Hits from far away" },
  slingshot:{ name: "Slingshot",       icon: "🪨", kind: "ranged", look: "slingshot",color: "#8b5a2b", dmg: 12, cd: 0.45, range: 60,  sp: 55, grav: 18, desc: "Pebbles that drop" },
  bow:      { name: "Hunter Bow",      icon: "🏹", kind: "ranged", look: "bow",      color: "#7a4a22", dmg: 30, cd: 0.8,  range: 110, sp: 80, grav: 10, desc: "Arrows fly far" },
  zapper:   { name: "Zap Pistol",      icon: "⚡", kind: "ranged", look: "pistol",   color: "#ffd25a", dmg: 15, cd: 0.25, range: 80,  sp: 110, desc: "Quick little zaps" },
  pulse:    { name: "Pulse Rifle",     icon: "🔷", kind: "ranged", look: "rifle",    color: "#4aa8ff", dmg: 9,  cd: 0.11, range: 90,  sp: 140, desc: "Fast, fast, fast" },
  scatter:  { name: "Scatter Blaster", icon: "💥", kind: "ranged", look: "scatter",  color: "#ff7a1a", dmg: 10, cd: 0.9,  range: 35,  sp: 90, n: 6, desc: "6 shots at once, up close" },
  snow:     { name: "Snowball Tosser", icon: "❄️", kind: "ranged", look: "launcher", color: "#e8f4ff", dmg: 6,  cd: 0.35, range: 60,  sp: 50, grav: 14, freeze: 1, desc: "Slows them down" },
  freeze:   { name: "Freeze Ray",      icon: "🧊", kind: "ranged", look: "ray",      color: "#8ff0ff", dmg: 5,  cd: 0.7,  range: 70,  sp: 100, freeze: 3, desc: "Frozen for 3 seconds" },
  rocket:   { name: "Boom Tube",       icon: "🚀", kind: "ranged", look: "tube",     color: "#4b6b3a", dmg: 60, cd: 1.6,  range: 120, sp: 55, boom: 7, desc: "Big boom, slow reload" },
  wand:     { name: "Spark Wand",      icon: "🪄", kind: "ranged", look: "wand",     color: "#a64bf4", dmg: 20, cd: 0.5,  range: 70,  sp: 70, desc: "Magic sparks" },
};

// The looks a home-made weapon can have (and whether it swings or shoots).
export const LOOKS = {
  sword: { name: "Sword", icon: "🗡️", kind: "melee" }, axe: { name: "Axe", icon: "🪓", kind: "melee" }, hammer: { name: "Hammer", icon: "🔨", kind: "melee" },
  bat: { name: "Bat", icon: "🏏", kind: "melee" }, glow: { name: "Glow blade", icon: "✨", kind: "melee" }, spear: { name: "Spear", icon: "🔱", kind: "melee" },
  staff: { name: "Magic staff", icon: "🦯", kind: "ranged" }, wand: { name: "Wand", icon: "🪄", kind: "ranged" }, pistol: { name: "Blaster", icon: "🔫", kind: "ranged" },
  rifle: { name: "Long blaster", icon: "🔷", kind: "ranged" }, scatter: { name: "Wide blaster", icon: "💥", kind: "ranged" }, ray: { name: "Ray gun", icon: "🧊", kind: "ranged" },
  tube: { name: "Launcher tube", icon: "🚀", kind: "ranged" }, launcher: { name: "Snow launcher", icon: "❄️", kind: "ranged" }, bow: { name: "Bow", icon: "🏹", kind: "ranged" },
  slingshot: { name: "Slingshot", icon: "🪨", kind: "ranged" }, orb: { name: "Power glove", icon: "🥊", kind: "ranged" },
};

// ---------------------------------------------------------------- 🎒 WEAPON THINGS (obj.type "weapon", like a Tool)
// Picking a weapon (or ✨ building your own) puts a weapon thing in the world: it's in the Explorer (scripts go under
// it: me = the weapon), and its Properties set how it works. obj.w = {base: the built-in it started from ("" = home-made),
// look, mode: "swing" / "shoot", dmg, cd (seconds between), range, sp (shot speed), shot (shot color), fling (0 = off,
// 1-100 = how far whoever it hits flies), start (the player starts holding it; off = it lies there to pick up)}.
// A home-made one is built from parts (obj.parts, like a 🧩 mesh, world.js buildMesh): standing up, handle at the bottom.
export const MAX_HELD = 6;
export function sanitizeWeapon(w) {
  w = w && typeof w === "object" ? w : {};
  const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const B = WEAPONS[w.base] || null;
  const mode = w.mode === "shoot" || w.mode === "swing" ? w.mode : B ? (B.kind === "ranged" ? "shoot" : "swing") : "swing";
  return { base: B ? w.base : "", look: /^[a-z]{2,12}$/.test(w.look || "") ? w.look : B ? B.look : "built", mode,
    dmg: n(w.dmg, 0, 500, B ? B.dmg : 25), cd: n(w.cd, 0.05, 5, B ? B.cd : 0.5), range: n(w.range, 1, 300, B ? B.range : mode === "shoot" ? 80 : 4.6),
    sp: n(w.sp, 5, 300, B && B.sp ? B.sp : 80), shot: /^#[0-9a-f]{6}$/i.test(w.shot || "") ? w.shot : B ? B.color : "#ffd25a",
    fling: n(w.fling, 0, 100, 0), start: w.start !== false };
}
// A new weapon thing from the list (or a home-made one when id is "").
export function weaponObjectStats(id) { const B = WEAPONS[id]; return sanitizeWeapon(B ? { base: id } : { mode: "swing" }); }
// A weapon thing -> what play.js uses (def). o = the object (its parts, color, name).
export function weaponFromObject(o) {
  const w = sanitizeWeapon(o.w), B = WEAPONS[w.base] || {};
  const kind = w.mode === "shoot" ? "ranged" : "melee";
  const look = w.look === "built" ? "built" : (LOOKS[w.look] || WEAPONS[w.base]) ? w.look : kind === "ranged" ? "pistol" : "sword";
  return { id: "o" + o.id, obj: o, name: o.name, icon: B.icon || (LOOKS[look] || { icon: kind === "ranged" ? "🔫" : "🗡️" }).icon, kind, look, color: o.color,
    dmg: w.dmg, cd: w.cd, range: w.range, sp: w.sp, shotColor: w.shot, fling: w.fling, start: w.start,
    kb: B.kb || 8, boom: B.boom || 0, freeze: B.freeze || 0, grav: kind === "ranged" ? (B.grav || 0) : 0, n: kind === "ranged" ? (B.n || 1) : 1, thing: o.id };
}
export function weaponStarter(name) {
  return "// 🎒 This script is inside the weapon \"" + name + "\". Here, me means the weapon.\n\n" +
    "// when the player gets it (at the start of the game, or picking it up)\n" +
    "me.onEquip(function () {\n  say(\"You got the \" + me.name + \"!\")\n})\n\n" +
    "// every time the player uses it. aim.target = what you're aiming at (or null)\n" +
    "me.onAttack(function (aim) {\n  // shoot({ damage: 10, color: \"red\" })   // (an extra shot)\n})\n";
}

// A weapon id ("sword", or "c" + a home-made one's id) -> everything about it, or null.
export function weaponDef(game, id) {
  if (WEAPONS[id]) return { id, ...WEAPONS[id] };
  const c = ((game && game.settings && game.settings.arms) || []).find((a) => "c" + a.id === id);
  if (!c) return null;
  const L = LOOKS[c.look] || LOOKS.sword;
  return { id, name: c.name, icon: L.icon, kind: L.kind, look: c.look, color: c.color, custom: true, script: c.script, cd: L.kind === "melee" ? 0.5 : 0.35, range: L.kind === "melee" ? 4.6 : 80, dmg: 0 };
}
export function startingWeapons(game) { return ((game && game.settings && game.settings.start) || []).map((id) => weaponDef(game, id)).filter(Boolean).slice(0, MAX_START); }

// The starter script for a home-made weapon (a normal game script: it's in the Explorer and the script editor).
export function weaponCode(name) {
  return "// 🎒 " + name + ": what it does when the player uses it (click, or press Q).\n" +
    "// aim.target = the monster or part you're aiming at (or null). aim.x, aim.y, aim.z = right in front of you.\n" +
    "// shoot({ damage, speed, color, size, drop, freeze, boom }) fires a shot.  aim.target.damage(25) hurts a monster.\n\n" +
    "onAttack(function (aim) {\n  shoot({ damage: 20, speed: 80, color: \"purple\", size: 0.5 })\n  sound(\"click\")\n})\n";
}

// ---------------------------------------------------------------- the 3D models (held in the right hand)
// Built pointing forward along -z with the handle at the origin. Ranged ones get turned by the caller (held up to aim).
const mats = new Map();
function mat(color, glow) {
  const k = color + (glow ? "g" : "");
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: glow ? 0 : 0.35, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 1.6 : 0 }));
  return mats.get(k);
}
function box(g, w, h, d, color, x, y, z, glow) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, glow)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
function cyl(g, r1, r2, len, color, x, y, z, glow, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg || 10), mat(color, glow)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
const GRIP = "#3a2a1c", DARK = "#2a2f36";

export function weaponModel(look, color) {
  const g = new THREE.Group(), c = color || "#cfd6de";
  switch (look) {
    case "sword": box(g, 0.14, 0.14, 0.55, GRIP, 0, 0, 0.05); box(g, 0.7, 0.12, 0.14, "#c9a25a", 0, 0, -0.25); box(g, 0.2, 0.06, 1.9, c, 0, 0, -1.25); break;
    case "glow": box(g, 0.16, 0.16, 0.6, DARK, 0, 0, 0.05); box(g, 0.13, 0.13, 2.1, c, 0, 0, -1.3, true); break;
    case "axe": cyl(g, 0.07, 0.07, 2.1, GRIP, 0, 0, -0.6); box(g, 0.08, 0.75, 0.5, c, 0, 0.25, -1.4); break;
    case "hammer": cyl(g, 0.08, 0.08, 1.9, GRIP, 0, 0, -0.5); box(g, 0.55, 0.55, 0.95, c, 0, 0, -1.55); box(g, 0.6, 0.12, 0.12, "#ffd25a", 0, 0.3, -1.55, true); break;
    case "bat": cyl(g, 0.17, 0.07, 2.1, c, 0, 0, -0.85); break;
    case "spear": cyl(g, 0.06, 0.06, 3.2, GRIP, 0, 0, -1.1); { const t = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), mat(c)); t.rotation.x = -Math.PI / 2; t.position.set(0, 0, -2.95); g.add(t); } break;
    case "staff": cyl(g, 0.07, 0.07, 2.6, GRIP, 0, 0, -0.7); { const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mat(c, true)); s.position.set(0, 0, -2.1); g.add(s); } break;
    case "wand": cyl(g, 0.05, 0.04, 1.1, "#3b2416", 0, 0, -0.35); { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(c, true)); s.position.set(0, 0, -0.98); g.add(s); } break;
    case "pistol": box(g, 0.16, 0.42, 0.22, DARK, 0, -0.12, 0.05); box(g, 0.22, 0.24, 0.85, c, 0, 0.12, -0.2); cyl(g, 0.06, 0.06, 0.3, DARK, 0, 0.14, -0.75); break;
    case "rifle": box(g, 0.18, 0.4, 0.22, DARK, 0, -0.12, 0.05); box(g, 0.22, 0.26, 1.7, c, 0, 0.12, -0.45); box(g, 0.16, 0.2, 0.5, DARK, 0, 0.08, 0.6); cyl(g, 0.06, 0.06, 0.4, "#ffffff", 0, 0.14, -1.45, true); break;
    case "scatter": box(g, 0.18, 0.4, 0.22, DARK, 0, -0.12, 0.05); box(g, 0.34, 0.3, 1.2, c, 0, 0.12, -0.35); cyl(g, 0.16, 0.12, 0.3, DARK, 0, 0.12, -1.05); break;
    case "ray": box(g, 0.16, 0.4, 0.2, DARK, 0, -0.12, 0.05); { const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(c)); s.position.set(0, 0.14, -0.2); g.add(s); } cyl(g, 0.05, 0.1, 0.7, c, 0, 0.14, -0.7, true); break;
    case "tube": cyl(g, 0.22, 0.22, 2.0, c, 0, 0.18, -0.35); box(g, 0.14, 0.38, 0.2, DARK, 0, -0.1, 0.05); cyl(g, 0.25, 0.25, 0.16, DARK, 0, 0.18, -1.35); break;
    case "launcher": cyl(g, 0.2, 0.16, 1.4, c, 0, 0.14, -0.4); box(g, 0.14, 0.38, 0.2, "#4aa8ff", 0, -0.1, 0.05); break;
    case "bow": { const arc = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 20, Math.PI), mat(c)); arc.rotation.set(0, Math.PI / 2, Math.PI / 2); arc.position.set(0, 0, -0.35); g.add(arc); box(g, 0.02, 1.7, 0.02, "#eeeeee", 0, 0, 0.0); box(g, 0.04, 0.04, 1.2, "#c9a25a", 0, 0, -0.3); } break;
    case "slingshot": cyl(g, 0.06, 0.06, 0.6, c, 0, 0, -0.1); box(g, 0.5, 0.08, 0.08, c, 0, 0.18, -0.45); box(g, 0.08, 0.08, 0.4, c, -0.22, 0.3, -0.45); box(g, 0.08, 0.08, 0.4, c, 0.22, 0.3, -0.45); break;
    case "orb": box(g, 0.5, 0.5, 0.55, c, 0, 0, -0.15); { const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), mat("#ffffff", true)); s.position.set(0, 0, -0.5); g.add(s); } break;
    default: box(g, 0.2, 0.06, 1.8, c, 0, 0, -1);
  }
  return g;
}
// A weapon thing in the world (assets.js "weapon"): lying flat, pointing forward, bottom on the ground. base = [1, 1, 3].
export function worldWeaponModel(o) {
  const g = new THREE.Group(), m = weaponModel(sanitizeWeapon(o.w).look, o.color);
  m.position.set(0, 0.5, 1.4); g.add(m);
  return g;
}
// The model as the hand holds it: melee straight out, ranged turned so it points forward when the arm is held up.
// built(o) -> a group of a home-made weapon's parts (play.js passes world.js buildObject): built standing up, so
// its top points forward; it's shrunk to fit in a hand if it's huge.
export function heldModel(def, built) {
  const g = new THREE.Group();
  let m;
  if (def.look === "built" && def.obj && built) {
    const o = def.obj, b = built({ ...o, pos: [0, 0, 0], rot: [0, 0, 0] });
    const k = Math.min(1, 4 / Math.max(0.1, ...o.size));
    b.scale.multiplyScalar(k); b.position.y = -0.25 * k;
    m = new THREE.Group(); m.add(b);
    m.rotation.x = def.kind === "ranged" ? Math.PI : -Math.PI / 2;
    g.add(m); g.userData.kind = def.kind; return g;
  }
  m = weaponModel(def.look, def.color);
  g.add(m);
  if (def.kind === "ranged") m.rotation.x = -Math.PI / 2;
  g.userData.kind = def.kind;
  return g;
}
// Pose the right arm (after animateAvatar): ranged = held up to aim, melee = out in front; t = 0..1 of an attack.
export function poseArm(armR, kind, t) {
  if (kind === "ranged") armR.rotation.x = Math.PI / 2 - (t > 0 ? Math.sin(t * Math.PI) * 0.35 : 0); // (kick back)
  else armR.rotation.x = t > 0 ? (t < 0.3 ? 0.5 + (t / 0.3) * 2.3 : 2.8 - ((t - 0.3) / 0.7) * 2.6) : 0.5; // (up, then chop)
}

// A shot flying through the air (ranged weapons and shoot()).
export function shotModel(def) {
  const look = def.look, c = def.shotColor || def.color;
  if (look === "bow") { const g = new THREE.Group(); cyl(g, 0.04, 0.04, 1.3, "#c9a25a", 0, 0, 0); const t = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), mat("#cfd6de")); t.rotation.x = -Math.PI / 2; t.position.z = -0.7; g.add(t); return g; }
  if (look === "tube") { const g = new THREE.Group(); cyl(g, 0.16, 0.16, 0.8, "#cfd6de", 0, 0, 0); const t = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 8), mat("#e8261c")); t.rotation.x = -Math.PI / 2; t.position.z = -0.55; g.add(t); return g; }
  const r = def.shotSize || (look === "slingshot" ? 0.18 : look === "launcher" ? 0.3 : look === "scatter" ? 0.14 : 0.2);
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(look === "slingshot" ? "#8a8f96" : c, look !== "slingshot" && look !== "launcher"));
  if (look === "rifle" || look === "pistol" || look === "ray") m.scale.z = 3;
  return m;
}
