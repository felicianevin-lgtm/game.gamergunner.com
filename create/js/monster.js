// MONSTER MAKER for GunnerVerse Studio: type what your monster looks like ("a giant purple spider with glowing red
// eyes and horns") and it gets built from simple shapes. No AI and nothing online: describe() reads the words it knows
// (colors, sizes, body types like spider / dragon / ghost / robot / slime, and parts like horns, wings, tail, teeth,
// tentacles, "three eyes", "six legs"), and anything you don't say is picked from the description itself, so the same
// words always make the same monster. A monster is an object of type "monster" with obj.mon = its recipe (MON_KEYS) and
// obj.text = the description. world.js builds it (buildMonster), scaled to the object's Size.
import * as THREE from "../vendor/three.module.js";

export const MON_KEYS = { // recipe: key -> [kind, ...]  (game.js + the relay keep only these)
  body: ["pick", "round", "tall", "long", "box", "blob"], color: ["color"], color2: ["color"], eyeColor: ["color"],
  eyes: ["num", 0, 9], legs: ["num", 0, 8], arms: ["num", 0, 6], heads: ["num", 1, 3], horns: ["num", 0, 6], tentacles: ["num", 0, 8],
  wings: ["bool"], tail: ["bool"], spikes: ["bool"], teeth: ["bool"], antennae: ["bool"], ears: ["bool"], fins: ["bool"],
  glow: ["bool"], ghost: ["bool"], metal: ["bool"], slime: ["bool"], bones: ["bool"], float: ["bool"], height: ["num", 0.5, 30],
};
const COLORS = { red: "#e8261c", blue: "#2f7df6", green: "#1fae45", purple: "#a64bf4", pink: "#ff4fa3", orange: "#ff7a1a", yellow: "#ffc531", black: "#1a1a1f",
  white: "#f2f2f2", gray: "#8a8f98", grey: "#8a8f98", brown: "#7a4f2a", gold: "#d4af37", silver: "#c9ced6", cyan: "#13c4c4", teal: "#139a8a", lime: "#7be03a",
  dark: "#2a1f33", violet: "#7b3fd0", maroon: "#6b1020", navy: "#1d2a6b", tan: "#c9a46b" };
const NUMS = { a: 1, an: 1, one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, many: 7, lots: 7, hundred: 9 };
const KINDS = { // body types: the recipe bits each one starts with
  spider: { body: "round", legs: 8, eyes: 6, teeth: true }, tarantula: { body: "round", legs: 8, eyes: 8, ears: true },
  dragon: { body: "long", legs: 4, wings: true, tail: true, horns: 2, teeth: true, spikes: true }, dinosaur: { body: "long", legs: 2, tail: true, teeth: true, arms: 2 },
  ghost: { body: "tall", legs: 0, arms: 2, ghost: true, float: true, color: "#f2f2f2" }, robot: { body: "box", legs: 2, arms: 2, metal: true, antennae: true, color: "#c9ced6" },
  slime: { body: "blob", legs: 0, slime: true, eyes: 2 }, blob: { body: "blob", legs: 0, slime: true }, jelly: { body: "blob", legs: 0, slime: true, tentacles: 6 },
  skeleton: { body: "tall", legs: 2, arms: 2, bones: true, color: "#efe8d8" }, zombie: { body: "tall", legs: 2, arms: 2, color: "#6fae5a", color2: "#4a3b6b" },
  octopus: { body: "round", legs: 0, tentacles: 8, float: false }, squid: { body: "tall", legs: 0, tentacles: 8 }, alien: { body: "tall", legs: 2, arms: 2, eyes: 3, antennae: true, color: "#7be03a" },
  bug: { body: "long", legs: 6, antennae: true }, beetle: { body: "round", legs: 6, antennae: true, metal: true }, ant: { body: "long", legs: 6, antennae: true },
  worm: { body: "long", legs: 0 }, snake: { body: "long", legs: 0, teeth: true, tail: true }, bear: { body: "round", legs: 4, ears: true, teeth: true },
  wolf: { body: "long", legs: 4, ears: true, tail: true, teeth: true }, dog: { body: "long", legs: 4, ears: true, tail: true }, cat: { body: "long", legs: 4, ears: true, tail: true },
  bat: { body: "round", legs: 2, wings: true, ears: true, float: true }, bird: { body: "round", legs: 2, wings: true, tail: true }, fish: { body: "long", legs: 0, fins: true, tail: true, float: true },
  shark: { body: "long", legs: 0, fins: true, tail: true, teeth: true, float: true, color: "#8a8f98" }, cyclops: { body: "tall", legs: 2, arms: 2, eyes: 1, horns: 1 },
  eyeball: { body: "round", legs: 0, eyes: 1, float: true, color: "#f2f2f2" }, troll: { body: "tall", legs: 2, arms: 2, ears: true, teeth: true }, goblin: { body: "tall", legs: 2, arms: 2, ears: true, color: "#7be03a" },
  demon: { body: "tall", legs: 2, arms: 2, horns: 2, tail: true, wings: true, color: "#e8261c" }, yeti: { body: "tall", legs: 2, arms: 2, color: "#f2f2f2", teeth: true },
  crab: { body: "round", legs: 6, arms: 2, eyes: 2, antennae: true, color: "#e8261c" }, mummy: { body: "tall", legs: 2, arms: 2, color: "#e6d8b0" }, pumpkin: { body: "round", legs: 2, arms: 2, color: "#ff7a1a", teeth: true, glow: true },
  monster: {}, creature: {}, beast: {},
};
const ALIASES = { spiders: "spider", dragons: "dragon", ghosts: "ghost", robots: "robot", slimes: "slime", skeletons: "skeleton", zombies: "zombie", aliens: "alien", bugs: "bug", insect: "bug", insects: "bug",
  worms: "worm", snakes: "snake", wolves: "wolf", dino: "dinosaur", trex: "dinosaur", bats: "bat", birds: "bird", sharks: "shark", eye: "eyeball", eyeballs: "eyeball", gremlin: "goblin", ogre: "troll", devil: "demon",
  bigfoot: "yeti", crabs: "crab", jellyfish: "jelly", kitty: "cat", puppy: "dog", bones: "skeleton", animatronic: "robot", cyborg: "robot", mech: "robot" };

// Same words -> same monster: a small random-number maker seeded from the description.
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

// Words -> {mon: recipe, words: [what it understood]}
export function describe(text, reroll) {
  const raw = String(text || "").toLowerCase().slice(0, 300);
  const rnd = seeded(raw + (reroll ? "#" + reroll : ""));
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const words = raw.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const got = [];
  const m = { body: pick(["round", "tall", "long", "blob"]), color: pick(Object.values(COLORS)), eyes: pick([1, 2, 2, 2, 3, 4]), legs: 0, arms: 0, heads: 1, horns: 0, tentacles: 0, height: 4 };
  m.legs = m.body === "blob" ? 0 : pick([2, 4, 4, 6]);
  if (m.body === "tall") { m.legs = 2; m.arms = 2; }
  m.color2 = pick(Object.values(COLORS)); m.eyeColor = "#111111";
  if (rnd() < 0.4) m.horns = pick([1, 2, 2]);
  if (rnd() < 0.3) m.teeth = true;
  if (rnd() < 0.2) m.spikes = true;
  // body types (the last one named wins)
  for (const w of words) { const k = KINDS[w] ? w : ALIASES[w]; if (k && KINDS[k]) { if (Object.keys(KINDS[k]).length && KINDS[k].eyes == null) m.eyes = 2; Object.assign(m, KINDS[k]); got.push(k); } }
  // numbers: "three eyes", "6 legs", "two heads"
  const COUNT = { eye: "eyes", eyes: "eyes", leg: "legs", legs: "legs", arm: "arms", arms: "arms", head: "heads", heads: "heads", headed: "heads", horn: "horns", horns: "horns", tentacle: "tentacles", tentacles: "tentacles" };
  for (let i = 0; i < words.length; i++) {
    const key = COUNT[words[i]];
    if (!key) continue;
    let n = null;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) { const v = /^\d+$/.test(words[j]) ? +words[j] : NUMS[words[j]]; if (v != null) { n = v; break; } if (words[j] === "no") { n = 0; break; } }
    if (n == null) continue; // ("eyes" with no number: keep what it has)
    const lim = MON_KEYS[key];
    m[key] = Math.max(lim[1], Math.min(lim[2], n));
    if (key === "legs" && m.legs) m.float = false;
    got.push(n + " " + key);
  }
  // colors: "red eyes" colors the eyes, "with purple spots" the second color, otherwise the body
  let bodyColored = false;
  for (let i = 0; i < words.length; i++) {
    const c = COLORS[words[i]];
    if (!c) continue;
    const next = words[i + 1] || "";
    if (/^eyes?$/.test(next)) { m.eyeColor = c; m.glow = m.glow || /glow/.test(raw); got.push(words[i] + " eyes"); }
    else if (/^(spots?|stripes?|belly|horns?|spikes?|wings?|tail|patches|dots)$/.test(next) || bodyColored) { m.color2 = c; got.push(words[i] + " " + (next || "details")); }
    else { m.color = c; bodyColored = true; got.push(words[i]); }
  }
  if (/rainbow/.test(raw)) { m.color = "#ff4fa3"; m.color2 = "#2f7df6"; got.push("rainbow"); }
  const has = (re, f, label) => { if (re.test(raw)) { f(); got.push(label); } };
  has(/\b(tiny|little|mini)\b/, () => (m.height = 1.6), "tiny"); has(/\bsmall\b/, () => (m.height = 2.6), "small");
  has(/\b(big|large|tall)\b/, () => (m.height = 7), "big"); has(/\b(huge|giant|enormous|massive|gigantic|colossal)\b/, () => (m.height = 14), "giant");
  has(/\bhorn/, () => (m.horns = m.horns || 2), "horns"); has(/\bwing/, () => (m.wings = true), "wings"); has(/\btail/, () => (m.tail = true), "tail");
  has(/\b(spike|spiky|spikey|spines?|thorn)/, () => (m.spikes = true), "spikes"); has(/\b(teeth|fangs?|sharp|jaws?|chomp)/, () => (m.teeth = true), "teeth");
  has(/\b(tentacle)/, () => (m.tentacles = m.tentacles || 6), "tentacles"); has(/\b(antenna|antennae|antennas|feelers)\b/, () => (m.antennae = true), "antennae");
  has(/\b(ears?|furry|fluffy|hairy|fuzzy)\b/, () => (m.ears = true), "ears"); has(/\b(fins?)\b/, () => (m.fins = true), "fins");
  has(/\b(glow|glowing|neon|shiny eyes|laser)/, () => (m.glow = true), "glowing"); has(/\b(see through|seethrough|transparent|invisible|spooky)\b/, () => (m.ghost = true), "see-through");
  has(/\b(metal|steel|iron|mechanical|armor|armored)\b/, () => (m.metal = true), "metal"); has(/\b(slimy|gooey|goo|jelly|squishy)\b/, () => (m.slime = true), "slimy");
  has(/\b(float|floating|flying|hover|hovering)\b/, () => { m.float = true; }, "floating");
  has(/\b(scary|creepy|evil|angry|mean|terrifying|horror)\b/, () => { m.teeth = true; m.glow = true; if (m.eyeColor === "#111111") m.eyeColor = "#ff2020"; }, "scary");
  has(/\b(cute|friendly|happy|baby|adorable|sweet)\b/, () => { m.teeth = false; m.spikes = false; m.ears = true; m.height = Math.min(m.height, 3); }, "cute");
  has(/\bno legs\b/, () => { m.legs = 0; }, "no legs"); has(/\bno eyes\b/, () => { m.eyes = 0; }, "no eyes");
  if (m.glow && m.eyeColor === "#111111") m.eyeColor = "#ff2020";
  if (!m.legs && !m.tentacles && m.body !== "blob" && m.body !== "long") m.float = true;
  return { mon: sanitizeMonster(m), words: [...new Set(got)] };
}
export function sanitizeMonster(m) {
  const out = {};
  if (!m || typeof m !== "object") m = {};
  for (const [k, spec] of Object.entries(MON_KEYS)) {
    const v = m[k];
    if (spec[0] === "pick") out[k] = spec.includes(v) && v !== "pick" ? v : spec[1];
    else if (spec[0] === "color") out[k] = /^#[0-9a-fA-F]{6}$/.test(v || "") ? v.toLowerCase() : k === "eyeColor" ? "#111111" : "#a64bf4";
    else if (spec[0] === "num") out[k] = Number.isFinite(+v) ? Math.max(spec[1], Math.min(spec[2], Math.round(+v * 10) / 10)) : k === "heads" ? 1 : k === "height" ? 4 : 0;
    else out[k] = !!v;
  }
  out.eyes = Math.round(out.eyes); out.legs = Math.round(out.legs); out.arms = Math.round(out.arms); out.heads = Math.round(out.heads); out.horns = Math.round(out.horns); out.tentacles = Math.round(out.tentacles);
  return out;
}
export const SURPRISE = ["a giant purple spider with glowing red eyes", "a cute pink slime with big eyes", "a scary green dragon with spikes", "a metal robot with three eyes and antennae",
  "a spooky ghost with glowing blue eyes", "a tiny orange crab", "a huge black wolf with red eyes", "a two headed yellow dinosaur", "a floating eyeball with tentacles",
  "a blue alien with four arms", "a creepy skeleton with horns", "a rainbow jelly with tentacles", "a big furry yeti with sharp teeth", "a gold beetle with wings"];

// ---------------------------------------------------------------- building it (feet at y = 0, facing -z)
export function buildMonster(mon) {
  const m = sanitizeMonster(mon);
  const g = new THREE.Group();
  const mat = (c, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: m.metal ? 0.3 : m.slime ? 0.15 : 0.7, metalness: m.metal ? 0.7 : 0,
    transparent: m.ghost || m.slime, opacity: m.ghost ? 0.55 : m.slime ? 0.8 : 1, flatShading: m.bones, ...(extra || {}) });
  const skin = mat(m.color), skin2 = mat(m.color2), dark = mat("#1a1a1f"), white = mat("#f4f1e6");
  const eyeM = new THREE.MeshStandardMaterial({ color: m.eyeColor, emissive: m.glow ? new THREE.Color(m.eyeColor) : new THREE.Color(0), emissiveIntensity: m.glow ? 1.4 : 0, roughness: 0.2 });
  const add = (parent, geo, material, x, y, z) => { const o = new THREE.Mesh(geo, material); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; parent.add(o); return o; };
  const limb = (parent, from, to, r, material) => { // a stick from one point to another
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), len = a.distanceTo(b);
    const o = add(parent, new THREE.CylinderGeometry(r * 0.8, r, len, 8), material);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return o;
  };
  // body sizes (before the whole thing is scaled to its Size)
  const B = { round: [1.2, 1.0, 1.2], tall: [0.8, 1.3, 0.6], long: [0.8, 0.7, 1.6], box: [1.0, 1.1, 0.8], blob: [1.3, 0.9, 1.3] }[m.body];
  const legLen = m.legs ? (m.body === "tall" || m.body === "box" ? 1.1 : 0.8) : 0;
  const lift = m.float ? 0.9 : m.tentacles && !m.legs ? 0.7 : legLen;
  const cy = lift + B[1];
  const body = new THREE.Group(); body.position.y = cy; g.add(body);
  if (m.body === "box") add(body, new THREE.BoxGeometry(B[0] * 2, B[1] * 2, B[2] * 2), skin);
  else { const s = add(body, new THREE.SphereGeometry(1, m.bones ? 8 : 24, m.bones ? 6 : 16), skin); s.scale.set(B[0], B[1], B[2]); }
  if (m.bones) for (let i = -1; i <= 1; i++) { const r = add(body, new THREE.TorusGeometry(B[0] * 0.95, 0.06, 6, 16), white); r.rotation.x = Math.PI / 2; r.position.y = i * B[1] * 0.4; r.scale.z = B[2] / B[0]; }
  if (m.color2 !== m.color && !m.bones) { const belly = add(body, new THREE.SphereGeometry(1, 16, 12), skin2); belly.scale.set(B[0] * 0.7, B[1] * 0.7, 0.2); belly.position.z = -B[2] * 0.86; }
  // heads (in front for long bodies, on top otherwise)
  const headR = m.body === "blob" ? 0 : m.body === "long" ? 0.6 : m.body === "round" ? 0 : 0.6;
  const heads = [];
  for (let i = 0; i < m.heads; i++) {
    const off = (i - (m.heads - 1) / 2) * (headR ? headR * 2.1 : B[0] * 0.9);
    const h = new THREE.Group();
    if (!headR) { h.position.set(off * (m.heads > 1 ? 1 : 0), B[1] * 0.25, -B[2] * 0.92); } // (face right on the body)
    else if (m.body === "long") h.position.set(off, B[1] * 0.6, -B[2] - headR * 0.5);
    else h.position.set(off, B[1] + headR * 0.85, 0);
    body.add(h);
    if (headR) { if (m.body === "box") add(h, new THREE.BoxGeometry(headR * 1.8, headR * 1.6, headR * 1.6), skin); else add(h, new THREE.SphereGeometry(headR, 20, 14), skin); }
    heads.push(h);
  }
  const fz = (h) => (headR ? -headR * 0.92 : -0.12); // the front of a head
  for (const h of heads) {
    // eyes in a row (or two rows when there are lots)
    const n = m.eyes, rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows), er = n === 1 ? 0.32 : Math.max(0.1, 0.24 - n * 0.012);
    const span = headR ? headR * 1.3 : B[0] * 0.9;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
      const x = inRow === 1 ? 0 : (col / (inRow - 1) - 0.5) * span * (inRow > 2 ? 1 : 0.7);
      const y = (headR ? headR * 0.2 : 0.15) + (rows > 1 ? (0.5 - row) * er * 2.4 : 0);
      add(h, new THREE.SphereGeometry(er, 14, 10), white, x, y, fz(h));
      add(h, new THREE.SphereGeometry(er * 0.55, 12, 8), eyeM, x, y, fz(h) - er * 0.65);
    }
    if (m.teeth || n === 0) { // a mouth, with teeth
      const mw = headR ? headR * 1.1 : B[0] * 0.8, my = headR ? -headR * 0.4 : -0.35;
      add(h, new THREE.BoxGeometry(mw, mw * 0.3, 0.1), dark, 0, my, fz(h));
      if (m.teeth) for (let i = 0; i < 6; i++) { const t = add(h, new THREE.ConeGeometry(mw * 0.06, mw * 0.18, 4), white, (i / 5 - 0.5) * mw * 0.85, my + mw * 0.07, fz(h) - 0.06); t.rotation.x = Math.PI; }
    }
    const top = headR ? headR * 0.85 : B[1] * 0.85, hz = headR ? 0 : B[2] * 0.75;
    for (let i = 0; i < m.horns; i++) { const x = m.horns === 1 ? 0 : (i / (m.horns - 1) - 0.5) * (headR ? headR * 1.3 : B[0] * 1.2); const c = add(h, new THREE.ConeGeometry(0.12, 0.5, 8), skin2, x, top, hz); c.rotation.z = -x * 0.8; }
    if (m.antennae) for (const s of [-1, 1]) { limb(h, [s * 0.15, top - 0.1, hz], [s * 0.4, top + 0.6, hz - 0.1], 0.03, dark); add(h, new THREE.SphereGeometry(0.09, 10, 8), eyeM, s * 0.4, top + 0.62, hz - 0.1); }
    if (m.ears) for (const s of [-1, 1]) { const e = add(h, new THREE.ConeGeometry(0.16, 0.35, 4), skin, s * (headR ? headR * 0.65 : B[0] * 0.6), top - 0.05, hz); e.rotation.z = -s * 0.3; }
  }
  // legs around the bottom
  const legM = m.bones ? white : skin;
  if (m.legs) {
    if (m.legs <= 2 && (m.body === "tall" || m.body === "box")) for (const s of [-1, 1]) { limb(g, [s * B[0] * 0.45, cy - B[1] * 0.6, 0], [s * B[0] * 0.5, 0.05, 0], 0.16, legM); add(g, new THREE.BoxGeometry(0.34, 0.14, 0.5), m.metal ? dark : skin2, s * B[0] * 0.5, 0.07, -0.1); }
    else for (let i = 0; i < m.legs; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), per = Math.ceil(m.legs / 2);
      const z = per === 1 ? 0 : (k / (per - 1) - 0.5) * B[2] * 1.4;
      const hip = [side * B[0] * 0.7, cy - B[1] * 0.3, z], spidery = m.legs >= 6;
      const knee = [side * (B[0] + (spidery ? 0.9 : 0.15)), spidery ? cy + 0.3 : cy - B[1] * 0.6, z * (spidery ? 1.3 : 1)], foot = [side * (B[0] + (spidery ? 1.3 : 0.2)), 0.02, z * (spidery ? 1.5 : 1)];
      limb(g, hip, knee, spidery ? 0.07 : 0.16, legM); limb(g, knee, foot, spidery ? 0.06 : 0.14, legM);
    }
  }
  // arms from the shoulders
  for (let i = 0; i < m.arms; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), y = cy + B[1] * (0.45 - k * 0.35);
    const sh = [side * B[0] * 0.95, y, 0], el = [side * (B[0] + 0.5), y - 0.5, -0.3], hand = [side * (B[0] + 0.55), y - 0.9, -0.75];
    limb(g, sh, el, 0.12, legM); limb(g, el, hand, 0.1, legM); add(g, new THREE.SphereGeometry(0.15, 10, 8), m.metal ? dark : skin2, ...hand);
  }
  // tentacles hanging down
  for (let i = 0; i < m.tentacles; i++) {
    const a = (i / m.tentacles) * Math.PI * 2, r = B[0] * 0.65;
    const pts = [new THREE.Vector3(Math.cos(a) * r, cy - B[1] * 0.6, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * r * 1.3, cy * 0.5, Math.sin(a) * r * 1.3),
      new THREE.Vector3(Math.cos(a + 0.4) * r * 1.6, 0.25, Math.sin(a + 0.4) * r * 1.6), new THREE.Vector3(Math.cos(a + 0.7) * r * 1.9, 0.05, Math.sin(a + 0.7) * r * 1.9)];
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.1, 6), skin2);
  }
  if (m.spikes) for (let i = 0; i < 5; i++) { const t = i / 4; add(body, new THREE.ConeGeometry(0.13, 0.4, 6), skin2, 0, B[1] * (0.95 - Math.abs(t - 0.5) * 0.5), (t - 0.3) * B[2] * 1.4); }
  if (m.tail) { const pts = [new THREE.Vector3(0, cy - 0.1, B[2] * 0.85), new THREE.Vector3(0, cy - 0.3, B[2] + 0.6), new THREE.Vector3(0, cy * 0.6, B[2] + 1.3), new THREE.Vector3(0, cy * 0.7, B[2] + 1.9)];
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.13, 8), skin); add(g, new THREE.ConeGeometry(0.18, 0.4, 6), skin2, 0, cy * 0.72, B[2] + 2.05).rotation.x = Math.PI / 2; }
  if (m.wings) for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 1.8, 0.9); sh.lineTo(s * 1.6, 0); sh.lineTo(s * 1.9, -0.5); sh.lineTo(s * 0.9, -0.4); sh.closePath();
    const w = add(body, new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: m.color2, side: THREE.DoubleSide, roughness: 0.6, transparent: m.ghost, opacity: m.ghost ? 0.5 : 1 }), s * B[0] * 0.5, B[1] * 0.4, B[2] * 0.3);
    w.rotation.y = s * 0.5;
  }
  if (m.fins) { const f = add(body, new THREE.ConeGeometry(0.35, 0.8, 3), skin2, 0, B[1] + 0.25, 0); f.scale.z = 0.3; for (const s of [-1, 1]) { const p = add(body, new THREE.ConeGeometry(0.25, 0.6, 3), skin2, s * B[0], -B[1] * 0.2, -0.2); p.rotation.z = s * 1.7; p.scale.z = 0.3; } }
  return g;
}
// The monster scaled to fit a 1 x 1 x 1 box (bottom at 0, centered), like imported models: the object's Size sets its real size.
export function monsterInner(mon) {
  const raw = buildMonster(mon);
  const box = new THREE.Box3().setFromObject(raw), d = box.getSize(new THREE.Vector3());
  raw.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const fit = new THREE.Group(); fit.add(raw); fit.scale.set(1 / d.x, 1 / d.y, 1 / d.z);
  const inner = new THREE.Group(); inner.add(fit);
  inner.userData.dims = d; inner.userData.monster = true;
  return inner;
}
// The real size for a recipe: as tall as its height, with the shape's own width and depth.
export function monsterSize(mon) {
  const raw = buildMonster(mon), d = new THREE.Box3().setFromObject(raw).getSize(new THREE.Vector3()), k = sanitizeMonster(mon).height / d.y;
  return [d.x * k, d.y * k, d.z * k].map((v) => Math.max(0.2, Math.round(v * 100) / 100));
}
