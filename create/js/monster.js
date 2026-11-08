// MONSTER MAKER for GunnerVerse Studio: type what your monster looks like ("a giant purple spider with glowing red
// eyes and horns") and it gets built from smooth shapes. No AI and nothing online: describe() reads the words it knows
// (colors, sizes, ~100 kinds of creature like spider / dragon / ghost / robot / slime / scorpion / werewolf, parts like
// horns, wings, tail, claws, teeth, tentacles, patterns like spots and stripes, counts like "three eyes" / "six legs"),
// tells you which words it didn't know, and picks the rest from the description itself (same words = same monster).
// A monster is an object of type "monster" with obj.mon = its recipe (MON_KEYS) and obj.text = the description.
// world.js builds it (monsterInner), scaled to the object's Size.
import * as THREE from "../vendor/three.module.js";

export const MON_KEYS = { // recipe: key -> [kind, ...]  (game.js + the relay keep only these)
  body: ["pick", "round", "tall", "long", "box", "blob", "spider", "ghost"], color: ["color"], color2: ["color"], eyeColor: ["color"],
  pattern: ["pick", "none", "spots", "stripes", "scales", "patches"],
  hat: ["pick", "none", "tophat", "crown", "cap", "party", "wizard", "witch", "cowboy", "helmet", "bow", "halo", "chef", "headphones"],
  eyes: ["num", 0, 9], legs: ["num", 0, 8], arms: ["num", 0, 6], heads: ["num", 1, 3], horns: ["num", 0, 6], tentacles: ["num", 0, 8],
  wings: ["bool"], tail: ["bool"], spikes: ["bool"], teeth: ["bool"], fangs: ["bool"], claws: ["bool"], antennae: ["bool"], ears: ["bool"], longEars: ["bool"],
  fins: ["bool"], snout: ["bool"], stinger: ["bool"], pincers: ["bool"], bigEye: ["bool"], fur: ["bool"], cute: ["bool"], angry: ["bool"],
  glow: ["bool"], ghost: ["bool"], metal: ["bool"], slime: ["bool"], bones: ["bool"], rock: ["bool"], float: ["bool"],
  height: ["num", 0.5, 30], width: ["num", 0.6, 1.8],
};
const COLORS = { red: "#e8261c", crimson: "#b0102a", scarlet: "#ff2a1a", blue: "#2f7df6", navy: "#1d2a6b", sky: "#6fc3ff", green: "#1fae45", emerald: "#0f9d58",
  lime: "#7be03a", olive: "#6b7a2a", purple: "#a64bf4", violet: "#7b3fd0", lavender: "#b9a0f0", magenta: "#e0249a", pink: "#ff4fa3", orange: "#ff7a1a",
  yellow: "#ffc531", gold: "#d4af37", golden: "#d4af37", black: "#1a1a1f", white: "#f2f2f2", gray: "#8a8f98", grey: "#8a8f98", silver: "#c9ced6",
  brown: "#7a4f2a", tan: "#c9a46b", beige: "#d9c7a0", bronze: "#a0682a", copper: "#b56a3a", cyan: "#13c4c4", teal: "#139a8a", turquoise: "#2fd0c0",
  aqua: "#3fe0e0", maroon: "#6b1020", dark: "#2a1f33", shadow: "#1e1828", blood: "#8a0a10", ice: "#bfe8ff", icy: "#bfe8ff", fire: "#ff5a10", fiery: "#ff5a10",
  lava: "#ff4b12", toxic: "#9cff2a", rainbow: "#ff4fa3", neon: "#39ff6a", rust: "#a0461a", rusty: "#a0461a", mint: "#8ff0c0", peach: "#ffb08a", cream: "#f3e8d0" };
const NUMS = { a: 1, an: 1, one: 1, single: 1, two: 2, double: 2, three: 3, triple: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, many: 7, lots: 7, hundred: 9, thousand: 9 };
// kinds of creature: the recipe bits each one starts with
const KINDS = {
  spider: { body: "spider", legs: 8, eyes: 6, fangs: true }, tarantula: { body: "spider", legs: 8, eyes: 8, fur: true, fangs: true },
  scorpion: { body: "long", legs: 6, arms: 2, pincers: true, tail: true, stinger: true, eyes: 2, color: "#1a1a1f" },
  dragon: { body: "long", legs: 4, wings: true, tail: true, horns: 2, teeth: true, spikes: true, snout: true, claws: true, pattern: "scales" },
  hydra: { body: "long", legs: 4, heads: 3, tail: true, teeth: true, snout: true, pattern: "scales" }, wyvern: { body: "long", legs: 2, wings: true, tail: true, snout: true, teeth: true },
  dinosaur: { body: "long", legs: 2, arms: 2, tail: true, teeth: true, snout: true, claws: true }, rex: { body: "long", legs: 2, arms: 2, tail: true, teeth: true, snout: true, claws: true },
  ghost: { body: "ghost", legs: 0, arms: 2, ghost: true, float: true, color: "#f2f2f2", eyes: 2 }, phantom: { body: "ghost", legs: 0, arms: 0, ghost: true, float: true, color: "#c0c8ff" },
  robot: { body: "box", legs: 2, arms: 2, metal: true, antennae: true, color: "#c9ced6" }, golem: { body: "box", legs: 2, arms: 2, rock: true, color: "#7a7f88", claws: false },
  slime: { body: "blob", legs: 0, slime: true, eyes: 2 }, blob: { body: "blob", legs: 0, slime: true }, ooze: { body: "blob", legs: 0, slime: true, color: "#9cff2a" },
  jelly: { body: "blob", legs: 0, slime: true, tentacles: 6, float: true }, skeleton: { body: "tall", legs: 2, arms: 2, bones: true, color: "#efe8d8" },
  zombie: { body: "tall", legs: 2, arms: 2, color: "#6fae5a", color2: "#4a3b6b", pattern: "patches" }, mummy: { body: "tall", legs: 2, arms: 2, color: "#e6d8b0", pattern: "stripes" },
  vampire: { body: "tall", legs: 2, arms: 2, fangs: true, wings: true, color: "#e9e0e8", color2: "#1a1a1f", eyeColor: "#e8261c" },
  werewolf: { body: "tall", legs: 2, arms: 2, fur: true, ears: true, snout: true, teeth: true, claws: true, tail: true, color: "#5a4636" },
  octopus: { body: "round", legs: 0, tentacles: 8 }, kraken: { body: "round", legs: 0, tentacles: 8, teeth: true, height: 14 }, squid: { body: "tall", legs: 0, tentacles: 8, float: true },
  alien: { body: "tall", legs: 2, arms: 2, eyes: 3, antennae: true, color: "#7be03a" }, martian: { body: "tall", legs: 2, arms: 2, eyes: 1, antennae: true, color: "#7be03a" },
  bug: { body: "long", legs: 6, antennae: true }, beetle: { body: "round", legs: 6, antennae: true, metal: true }, ant: { body: "long", legs: 6, antennae: true },
  bee: { body: "long", legs: 6, wings: true, antennae: true, stinger: true, pattern: "stripes", color: "#ffc531", color2: "#1a1a1f", float: true },
  wasp: { body: "long", legs: 6, wings: true, antennae: true, stinger: true, pattern: "stripes", color: "#ffc531", color2: "#1a1a1f", float: true },
  mosquito: { body: "long", legs: 6, wings: true, antennae: true, float: true }, dragonfly: { body: "long", legs: 6, wings: true, eyes: 2, float: true },
  butterfly: { body: "long", legs: 0, wings: true, antennae: true, float: true }, centipede: { body: "long", legs: 8, antennae: true, fangs: true, width: 0.7 },
  worm: { body: "long", legs: 0 }, snake: { body: "long", legs: 0, fangs: true, tail: true, snout: true, pattern: "scales", width: 0.7 },
  lizard: { body: "long", legs: 4, tail: true, snout: true, pattern: "scales" }, crocodile: { body: "long", legs: 4, tail: true, snout: true, teeth: true, pattern: "scales", color: "#4a7a3a" },
  frog: { body: "round", legs: 4, eyes: 2, color: "#4ac040" }, toad: { body: "round", legs: 4, eyes: 2, color: "#7a8a3a", pattern: "spots" }, turtle: { body: "round", legs: 4, tail: true, spikes: true },
  bear: { body: "round", legs: 4, ears: true, teeth: true, fur: true, color: "#7a4f2a" }, wolf: { body: "long", legs: 4, ears: true, tail: true, teeth: true, snout: true, fur: true },
  dog: { body: "long", legs: 4, ears: true, tail: true, snout: true }, cat: { body: "long", legs: 4, ears: true, tail: true }, tiger: { body: "long", legs: 4, ears: true, tail: true, pattern: "stripes", color: "#ff7a1a", color2: "#1a1a1f", teeth: true },
  lion: { body: "long", legs: 4, ears: true, tail: true, fur: true, color: "#d9a34a", teeth: true }, fox: { body: "long", legs: 4, ears: true, tail: true, snout: true, color: "#ff7a1a" },
  rat: { body: "long", legs: 4, ears: true, tail: true, snout: true, teeth: true, color: "#8a8f98" }, mouse: { body: "round", legs: 4, ears: true, tail: true, color: "#a3a8b0", cute: true },
  rabbit: { body: "round", legs: 4, longEars: true, tail: true, cute: true, color: "#f2f2f2" }, bunny: { body: "round", legs: 4, longEars: true, tail: true, cute: true, color: "#f2f2f2" },
  horse: { body: "long", legs: 4, tail: true, snout: true, ears: true }, unicorn: { body: "long", legs: 4, tail: true, snout: true, ears: true, horns: 1, color: "#f2f2f2", color2: "#ff4fa3" },
  cow: { body: "long", legs: 4, horns: 2, snout: true, pattern: "patches", color: "#f2f2f2", color2: "#1a1a1f" }, bull: { body: "long", legs: 4, horns: 2, snout: true, angry: true, color: "#5a3a26" },
  minotaur: { body: "tall", legs: 2, arms: 2, horns: 2, snout: true, fur: true, angry: true, color: "#5a3a26" }, gorilla: { body: "tall", legs: 2, arms: 2, fur: true, color: "#2a2a2a", width: 1.5 },
  ape: { body: "tall", legs: 2, arms: 2, fur: true, color: "#3a2a1a", width: 1.4 }, monkey: { body: "tall", legs: 2, arms: 2, ears: true, tail: true, color: "#7a4f2a" },
  bat: { body: "round", legs: 2, wings: true, ears: true, fangs: true, float: true, color: "#2a2a2a" }, bird: { body: "round", legs: 2, wings: true, tail: true },
  owl: { body: "round", legs: 2, wings: true, eyes: 2, ears: true, color: "#7a4f2a" }, penguin: { body: "round", legs: 2, wings: true, color: "#1a1a1f", color2: "#f2f2f2", cute: true },
  chicken: { body: "round", legs: 2, wings: true, color: "#f2f2f2" }, fish: { body: "long", legs: 0, fins: true, tail: true, float: true, pattern: "scales" },
  shark: { body: "long", legs: 0, fins: true, tail: true, teeth: true, snout: true, float: true, color: "#8a8f98", color2: "#f2f2f2" }, whale: { body: "long", legs: 0, fins: true, tail: true, float: true, height: 14, color: "#2f4f8a" },
  crab: { body: "round", legs: 6, arms: 2, pincers: true, eyes: 2, antennae: true, color: "#e8261c", color2: "#c01810", width: 1.5 }, lobster: { body: "long", legs: 6, arms: 2, pincers: true, antennae: true, tail: true, color: "#e8261c" },
  cyclops: { body: "tall", legs: 2, arms: 2, eyes: 1, horns: 1 }, eyeball: { body: "round", legs: 0, eyes: 1, bigEye: true, float: true, color: "#f2f2f2" },
  troll: { body: "tall", legs: 2, arms: 2, ears: true, teeth: true, width: 1.4, color: "#6b8a5a" }, ogre: { body: "tall", legs: 2, arms: 2, ears: true, teeth: true, width: 1.6, color: "#7a9a4a" },
  goblin: { body: "tall", legs: 2, arms: 2, ears: true, color: "#7be03a", fangs: true }, gremlin: { body: "round", legs: 2, arms: 2, ears: true, teeth: true, color: "#5a8a4a" },
  demon: { body: "tall", legs: 2, arms: 2, horns: 2, tail: true, wings: true, color: "#e8261c", fangs: true, angry: true }, imp: { body: "round", legs: 2, arms: 2, horns: 2, tail: true, wings: true, color: "#e8261c" },
  yeti: { body: "tall", legs: 2, arms: 2, color: "#f2f2f2", teeth: true, fur: true, width: 1.4 }, bigfoot: { body: "tall", legs: 2, arms: 2, color: "#5a3a26", fur: true, width: 1.4 },
  pumpkin: { body: "round", legs: 2, arms: 2, color: "#ff7a1a", teeth: true, glow: true, eyeColor: "#ffc531" }, mushroom: { body: "tall", legs: 2, color: "#e8261c", color2: "#f2f2f2", pattern: "spots" },
  snowman: { body: "tall", legs: 0, arms: 2, color: "#f2f2f2" }, clown: { body: "tall", legs: 2, arms: 2, color: "#f2f2f2", color2: "#e8261c", pattern: "spots", teeth: true },
  animatronic: { metal: true, eyes: 2, teeth: true }, teddy: { body: "round", legs: 2, arms: 2, ears: true, fur: true, cute: true, color: "#a0682a" },
  monster: {}, creature: {}, beast: {}, thing: {}, critter: {}, mutant: { pattern: "patches" },
};
const ALIASES = { spiders: "spider", dragons: "dragon", ghosts: "ghost", robots: "robot", slimes: "slime", skeletons: "skeleton", zombies: "zombie", aliens: "alien", bugs: "bug", insect: "bug",
  insects: "bug", worms: "worm", snakes: "snake", serpent: "snake", wolves: "wolf", dino: "dinosaur", trex: "rex", raptor: "dinosaur", bats: "bat", birds: "bird", sharks: "shark", eye: "eyeball",
  eyeballs: "eyeball", devil: "demon", crabs: "crab", jellyfish: "jelly", kitty: "cat", kitten: "cat", puppy: "dog", bones: "skeleton", cyborg: "robot", mech: "robot", android: "robot", droid: "robot",
  specter: "ghost", spirit: "ghost", poltergeist: "ghost", teddybear: "teddy", frankenstein: "zombie", gator: "crocodile", alligator: "crocodile", croc: "crocodile", octopi: "octopus",
  hornet: "wasp", fly: "mosquito", caterpillar: "centipede", millipede: "centipede", spiderling: "spider", gargoyle: "imp", goo: "ooze", pony: "horse", wolfman: "werewolf", dracula: "vampire" };
// little words that don't change anything (so they're not listed as "I didn't know")
const SKIP = new Set(("a an the with and or of on in to its it is has have having that this my his her their very really super so too like looks look looking kinda kind sort " +
  "but also plus made out from at by for big small eye eyes leg legs arm arms head heads headed horn horns tentacle tentacles no lots lot many some few more covered all over " +
  "which who can could would will be being been was were are am i me you he she they them our your guy dude thing things body face mouth nose skin color colored colour part parts back front side sides top bottom " +
  "got wears wearing holding hold thats hes shes its whos spots spot spotted stripes striped stripy scales scaly patches patchy dots dotted belly eyed legged armed horned").split(" "));

// Same words -> same monster: a small random-number maker seeded from the description.
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

// Words -> {mon: recipe, words: [what it understood], unknown: [words it didn't know]}
export function describe(text, reroll) {
  const raw = String(text || "").toLowerCase().replace(/['’]/g, "").slice(0, 300);
  const rnd = seeded(raw + (reroll ? "#" + reroll : ""));
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const words = raw.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const got = [], used = new Set();
  const palette = Object.values(COLORS).slice(0, 30);
  const m = { body: pick(["round", "tall", "long", "blob"]), color: pick(palette), eyes: pick([2, 2, 2, 3, 1, 4]), legs: 0, arms: 0, heads: 1, horns: 0, tentacles: 0, height: 4, width: 1, pattern: "none" };
  m.legs = m.body === "blob" ? 0 : pick([2, 4, 4, 6]);
  if (m.body === "tall") { m.legs = 2; m.arms = 2; }
  m.color2 = pick(palette); m.eyeColor = pick(["#111111", "#111111", "#2f7df6", "#1fae45", "#ff7a1a"]);
  if (rnd() < 0.4) m.horns = pick([1, 2, 2]);
  if (rnd() < 0.35) m.teeth = true;
  if (rnd() < 0.25) m.spikes = true;
  if (rnd() < 0.3) m.pattern = pick(["spots", "stripes", "patches"]);
  if (rnd() < 0.3) m.claws = true;
  // kinds of creature (the last one named wins; "animatronic bear" = a metal bear)
  for (const w of words) {
    const k = KINDS[w] ? w : ALIASES[w] || (w.endsWith("s") && KINDS[w.slice(0, -1)] ? w.slice(0, -1) : "");
    if (k && KINDS[k]) {
      if (Object.keys(KINDS[k]).length > 3) { if (KINDS[k].eyes == null) m.eyes = 2; m.pattern = "none"; m.horns = 0; m.spikes = false; m.arms = 0; m.claws = false; m.teeth = false; } // (a named creature: no random extras)
      Object.assign(m, KINDS[k]); got.push(k); used.add(w);
    }
  }
  // counts: "three eyes", "6 legs", "two headed"
  const COUNT = { eye: "eyes", eyes: "eyes", eyed: "eyes", leg: "legs", legs: "legs", legged: "legs", arm: "arms", arms: "arms", armed: "arms", head: "heads", heads: "heads", headed: "heads",
    horn: "horns", horns: "horns", horned: "horns", tentacle: "tentacles", tentacles: "tentacles" };
  for (let i = 0; i < words.length; i++) {
    const key = COUNT[words[i]];
    if (!key) continue;
    let n = null;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) { const v = /^\d+$/.test(words[j]) ? +words[j] : NUMS[words[j]]; if (v != null) { n = v; used.add(words[j]); break; } if (words[j] === "no") { n = 0; break; } }
    if (n == null) continue; // ("eyes" with no number: keep what it has)
    const lim = MON_KEYS[key];
    m[key] = Math.max(lim[1], Math.min(lim[2], n));
    if (key === "legs" && m.legs) m.float = false;
    got.push(n + " " + key);
  }
  // colors: "red eyes" colors the eyes, "purple spots" the second color, otherwise the body
  let bodyColored = false;
  for (let i = 0; i < words.length; i++) {
    const c = COLORS[words[i]];
    if (!c) continue;
    used.add(words[i]);
    const next = words[i + 1] || "", next2 = words[i + 2] || "";
    if (/^eye/.test(next) || (/^(glowing|shiny|beady)$/.test(next) && /^eye/.test(next2))) { m.eyeColor = c; got.push(words[i] + " eyes"); }
    else if (/^(spots?|stripes?|belly|horns?|spikes?|wings?|tail|patch|patches|dots|scales|claws|teeth|fur|hair)$/.test(next) || bodyColored) { m.color2 = c; got.push(words[i] + " " + (next || "details")); }
    else { m.color = c; bodyColored = true; got.push(words[i]); }
  }
  if (/rainbow/.test(raw)) { m.color = "#ff4fa3"; m.color2 = "#2f7df6"; m.pattern = "stripes"; }
  if (/\b(fire|fiery|lava|flaming|burning|flame)\b/.test(raw)) { m.glow = true; m.eyeColor = "#ffc531"; got.push("fire"); }
  if (/\b(ice|icy|frozen|frost|crystal)\b/.test(raw)) { m.ghost = true; got.push("ice"); }
  const has = (re, f, label) => { const hit = raw.match(re); if (hit) { f(); got.push(label); hit[0].split(" ").forEach((w) => used.add(w)); } };
  has(/\b(tiny|little|mini|teeny|itty)\b/, () => (m.height = 1.6), "tiny"); has(/\bsmall\b/, () => (m.height = 2.6), "small");
  has(/\b(big|large|tall)\b/, () => (m.height = Math.max(m.height, 7)), "big"); has(/\b(huge|giant|enormous|massive|gigantic|colossal|titan|mega|humongous)\b/, () => (m.height = 14), "giant");
  has(/\b(fat|chubby|chunky|wide|round|plump|thicc|thick|buff|strong|muscly|muscular)\b/, () => (m.width = 1.5), "chunky"); has(/\b(skinny|thin|slim|lanky|bony)\b/, () => (m.width = 0.7), "skinny");
  has(/\bhorn/, () => (m.horns = m.horns || 2), "horns"); has(/\bwing/, () => (m.wings = true), "wings"); has(/\btail/, () => (m.tail = true), "tail");
  has(/\b(spikes?|spiky|spikey|spines?|spiny|thorns?|thorny)\b/, () => (m.spikes = true), "spikes"); has(/\b(teeth|tooth|toothy|sharp|jaws?|chomp|chomper)\b/, () => (m.teeth = true), "teeth");
  has(/\b(fangs?|fanged)\b/, () => (m.fangs = true), "fangs"); has(/\b(claws?|clawed|talons?)\b/, () => (m.claws = true), "claws"); has(/\b(pincers?|nippers?)\b/, () => (m.pincers = true), "pincers");
  has(/\b(tentacle)/, () => (m.tentacles = m.tentacles || 6), "tentacles"); has(/\b(antenna|antennae|antennas|feelers)\b/, () => (m.antennae = true), "antennae");
  has(/\b(ears?)\b/, () => (m.ears = true), "ears"); has(/\b(long ears|bunny ears|floppy ears)\b/, () => (m.longEars = true), "long ears");
  has(/\b(furry|fluffy|hairy|fuzzy|shaggy|fur)\b/, () => (m.fur = true), "furry"); has(/\b(fins?|finned)\b/, () => (m.fins = true), "fins");
  has(/\b(snout|nose|muzzle|beak)\b/, () => (m.snout = true), "snout"); has(/\b(stinger|sting|stinging)\b/, () => (m.stinger = m.tail = true), "stinger");
  has(/\b(spots?|spotted|dots|dotted|polka)\b/, () => (m.pattern = "spots"), "spots"); has(/\b(stripes?|striped|stripy|stripey)\b/, () => (m.pattern = "stripes"), "stripes");
  has(/\b(scales|scaly|scaled|reptile)\b/, () => (m.pattern = "scales"), "scales"); has(/\b(patches|patchy|stitched|stitches)\b/, () => (m.pattern = "patches"), "patches");
  has(/\b(glow|glowing|glows|neon|laser|bright|radioactive|toxic)\b/, () => (m.glow = true), "glowing"); has(/\b(see through|seethrough|transparent|invisible|translucent|clear)\b/, () => (m.ghost = true), "see-through");
  has(/\b(metal|metallic|steel|iron|mechanical|armor|armored|armoured|chrome|robotic)\b/, () => (m.metal = true), "metal"); has(/\b(slimy|gooey|goo|jelly|squishy|sticky|gross)\b/, () => (m.slime = true), "slimy");
  has(/\b(rock|rocky|stone|boulder|crystal)\b/, () => (m.rock = true), "rocky"); has(/\b(bone|bony|skull|skeletal)\b/, () => (m.bones = true), "bones");
  has(/\b(float|floating|flying|flies|hover|hovering|levitating)\b/, () => { m.float = true; }, "floating");
  has(/\b(scary|creepy|evil|angry|mean|terrifying|horror|spooky|nightmare|haunted|deadly|killer|fierce|savage|vicious)\b/, () => { m.teeth = true; m.angry = true; m.glow = true; if (m.eyeColor === "#111111") m.eyeColor = "#ff2020"; }, "scary");
  has(/\b(cute|friendly|happy|baby|adorable|sweet|kawaii|nice|silly|goofy)\b/, () => { m.teeth = false; m.fangs = false; m.angry = false; m.spikes = false; m.cute = true; m.height = Math.min(m.height, 3); }, "cute");
  const HATS = { "top hat": "tophat", tophat: "tophat", crown: "crown", tiara: "crown", cap: "cap", "baseball cap": "cap", "party hat": "party", wizard: "wizard", witch: "witch",
    "witch hat": "witch", cowboy: "cowboy", helmet: "helmet", bow: "bow", halo: "halo", chef: "chef", headphones: "headphones" };
  for (const [w, h] of Object.entries(HATS)) if (new RegExp("\\b" + w + "\\b").test(raw)) { m.hat = h; got.push(w); w.split(" ").forEach((x) => used.add(x)); used.add("hat"); }
  has(/\bno legs\b/, () => { m.legs = 0; }, "no legs"); has(/\bno eyes\b/, () => { m.eyes = 0; }, "no eyes"); has(/\bno arms\b/, () => { m.arms = 0; }, "no arms");
  if (m.glow && m.eyeColor === "#111111") m.eyeColor = "#ff2020";
  if (!m.legs && !m.tentacles && !["blob", "long", "ghost"].includes(m.body)) m.float = true;
  const unknown = words.filter((w) => !used.has(w) && !SKIP.has(w) && !KINDS[w] && !ALIASES[w] && !COLORS[w] && NUMS[w] == null && !/^\d+$/.test(w) && w.length > 2);
  const kind = got.filter((w) => KINDS[w] && Object.keys(KINDS[w]).length).pop() || "";
  return { mon: sanitizeMonster(m), words: [...new Set(got)], unknown: [...new Set(unknown)].slice(0, 8), kind };
}
export function sanitizeMonster(m) {
  const out = {};
  if (!m || typeof m !== "object") m = {};
  for (const [k, spec] of Object.entries(MON_KEYS)) {
    const v = m[k];
    if (spec[0] === "pick") out[k] = spec.indexOf(v) > 0 ? v : spec[1];
    else if (spec[0] === "color") out[k] = /^#[0-9a-fA-F]{6}$/.test(v || "") ? v.toLowerCase() : k === "eyeColor" ? "#111111" : "#a64bf4";
    else if (spec[0] === "num") out[k] = Number.isFinite(+v) && v !== "" && v != null ? Math.max(spec[1], Math.min(spec[2], Math.round(+v * 10) / 10)) : k === "heads" || k === "width" ? 1 : k === "height" ? 4 : 0;
    else out[k] = !!v;
  }
  for (const k of ["eyes", "legs", "arms", "heads", "horns", "tentacles"]) out[k] = Math.round(out[k]);
  return out;
}
export const SURPRISE = ["a giant purple spider with glowing red eyes", "a cute pink slime with big eyes", "a scary green dragon with spikes and wings", "a metal robot with three eyes and antennae",
  "a spooky ghost with glowing blue eyes", "a tiny orange crab with big claws", "a huge black werewolf with red eyes", "a two headed yellow dinosaur", "a floating eyeball with tentacles",
  "a blue alien with four arms", "a creepy skeleton with horns", "a rainbow jelly with tentacles", "a big furry yeti with sharp teeth", "a gold beetle with wings",
  "an animatronic bear with glowing eyes", "a fire scorpion with a giant stinger", "a spotted toad with three eyes", "a cute white bunny with long ears", "a striped tiger with fangs", "a stone golem with glowing green eyes"];

// ---------------------------------------------------------------- building it (feet at y = 0, facing -z)
// Skin: the body color with soft shading and the pattern (spots / stripes / scales / patches) in the second color.
const texCache = new Map();
function skinTexture(c1, c2, pattern, fur) {
  const key = c1 + c2 + pattern + fur;
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const g = cv.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, shade(c1, -0.18)); grad.addColorStop(0.55, c1); grad.addColorStop(1, shade(c1, 0.22));
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = c2;
  if (pattern === "spots") for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(r() * 256, r() * 256, 8 + r() * 16, 6 + r() * 12, r() * 3, 0, Math.PI * 2); g.fill(); }
  else if (pattern === "stripes") for (let y = 10; y < 256; y += 38) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x / 30) * 6); for (let x = 256; x >= 0; x -= 32) g.lineTo(x, y + 14 + Math.sin(x / 30) * 6); g.fill(); }
  else if (pattern === "scales") { g.strokeStyle = shade(c1, -0.35); g.lineWidth = 2; for (let y = 0; y < 270; y += 14) for (let x = (y / 14) % 2 ? 0 : 9; x < 270; x += 18) { g.beginPath(); g.arc(x, y, 9, 0, Math.PI); g.stroke(); } }
  else if (pattern === "patches") for (let i = 0; i < 8; i++) { g.beginPath(); const x = r() * 256, y = r() * 256; g.moveTo(x, y); for (let k = 0; k < 7; k++) g.lineTo(x + Math.cos(k) * (18 + r() * 22), y + Math.sin(k) * (18 + r() * 22)); g.fill(); }
  if (fur) { g.globalAlpha = 0.18; for (let i = 0; i < 1600; i++) { g.fillStyle = r() < 0.5 ? "#000" : "#fff"; g.fillRect(r() * 256, r() * 256, 1, 4 + r() * 5); } g.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
function shade(hex, k) { const c = new THREE.Color(hex); return "#" + (k < 0 ? c.multiplyScalar(1 + k) : c.lerp(new THREE.Color(1, 1, 1), k)).getHexString(); }

export function buildMonster(mon) {
  const m = sanitizeMonster(mon);
  const g = new THREE.Group();
  // ---- materials
  const base = { roughness: m.metal ? 0.28 : m.slime ? 0.12 : m.rock ? 0.95 : m.fur ? 0.95 : 0.6, metalness: m.metal ? 0.75 : 0,
    transparent: m.ghost || m.slime, opacity: m.ghost ? 0.55 : m.slime ? 0.82 : 1, flatShading: m.rock || m.bones };
  const skin = new THREE.MeshStandardMaterial({ ...base, map: skinTexture(m.color, m.color2, m.pattern, m.fur), emissive: m.ghost && m.glow ? new THREE.Color(m.color) : new THREE.Color(0), emissiveIntensity: 0.25 });
  const plain = new THREE.MeshStandardMaterial({ ...base, color: m.color });
  const accent = new THREE.MeshStandardMaterial({ ...base, color: m.color2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a0d12, roughness: 0.9 }), white = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.35 });
  const horn = new THREE.MeshStandardMaterial({ color: m.metal ? "#3a3d42" : shade(m.color2 === m.color ? "#e8dcc0" : m.color2, -0.05), roughness: 0.45, metalness: m.metal ? 0.6 : 0 });
  const tongue = new THREE.MeshStandardMaterial({ color: 0xd04060, roughness: 0.5 });
  const eyeM = new THREE.MeshStandardMaterial({ color: m.eyeColor, emissive: m.glow ? new THREE.Color(m.eyeColor) : new THREE.Color(0), emissiveIntensity: m.glow ? 1.6 : 0, roughness: 0.15 });
  const seg = m.rock ? 7 : 24;
  const add = (parent, geo, material, x, y, z) => { const o = new THREE.Mesh(geo, material); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const sphere = new Map(); // (shared ball shapes keep big monsters light)
  const ballGeo = (r) => { const k = Math.round(r * 200) / 200; if (!sphere.has(k)) sphere.set(k, new THREE.SphereGeometry(Math.max(k, 0.005), seg, Math.max(6, (seg * 0.7) | 0))); return sphere.get(k); };
  const ball = (parent, r, material, x, y, z, sx, sy, sz) => { const o = add(parent, ballGeo(r), material, x, y, z); if (sx) o.scale.set(sx, sy, sz); return o; };
  // a smooth tapered tube along a curve (legs, tails, tentacles, horns), with rounded ends
  const chain = (parent, pts, r0, r1, material, n, tip) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const N = Math.max(8, Math.min(48, n || 16)), R = m.rock ? 6 : 12;
    const geo = new THREE.TubeGeometry(curve, N, 1, R, false), pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / (R + 1)), t = ring / N;
      curve.getPointAt(t, c); v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(r0 + (r1 - r0) * t).add(c);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    add(parent, geo, material);
    ball(parent, r0, material, ...curve.getPointAt(0).toArray()); ball(parent, r1, material, ...curve.getPointAt(1).toArray());
    if (tip) { const end = curve.getPoint(1), dir = curve.getTangent(1), tr = Math.max(r1, 0.03); const c = add(parent, new THREE.ConeGeometry(tr * 1.2, tr * 5, 10), tip, ...end.toArray()); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); c.position.addScaledVector(dir, tr * 2); }
    return curve;
  };
  const W = m.width;
  // ---- body shapes (sizes before the whole thing is scaled to its Size)
  const legLen = m.legs ? ({ tall: 1.1, box: 1.1, spider: 0.5, ghost: 0 }[m.body] ?? 0.75) : 0;
  const lift = m.float ? 1.0 : m.tentacles && !m.legs ? 0.8 : legLen;
  const body = new THREE.Group(); g.add(body);
  let headAt, headR, neck = null, top, tailFrom, legRing; // (where things attach)
  if (m.body === "tall") {
    body.position.y = lift + 1.15;
    ball(body, 0.62, skin, 0, -0.2, 0, W, 1.5, 0.85); ball(body, 0.5, skin, 0, 0.55, 0, W * 1.15, 0.8, 0.85); // belly + chest
    headR = 0.52; headAt = new THREE.Vector3(0, 1.25, -0.05); top = 1.25 + headR; tailFrom = [0, -0.6, 0.45];
    legRing = { y: -0.9, x: 0.32 * W, z: 0 };
  } else if (m.body === "box") {
    body.position.y = lift + 1.1;
    add(body, new THREE.BoxGeometry(1.5 * W, 1.9, 1.1), m.rock ? skin : plain);
    if (m.metal) { add(body, new THREE.BoxGeometry(0.9 * W, 0.7, 0.05), dark, 0, 0.2, -0.56); for (let i = 0; i < 3; i++) ball(body, 0.07, eyeM, -0.3 + i * 0.3, -0.45, -0.57); }
    headR = 0.55; headAt = new THREE.Vector3(0, 1.4, 0); top = 1.4 + headR; tailFrom = [0, -0.6, 0.55]; legRing = { y: -0.95, x: 0.42 * W, z: 0 };
  } else if (m.body === "long") {
    body.position.y = lift + 0.75;
    ball(body, 0.7, skin, 0, 0, -0.55, W, 0.95, 1.05); ball(body, 0.68, skin, 0, -0.03, 0.55, W * 0.95, 0.9, 1.05); // chest + hips
    headR = 0.5; neck = [[0, 0.2, -1.05], [0, 0.55, -1.45]]; headAt = new THREE.Vector3(0, 0.75, -1.65); top = 0.75 + headR; tailFrom = [0, 0.05, 1.2];
    legRing = { y: -0.45, x: 0.45 * W, z: 0.65 };
  } else if (m.body === "spider") {
    body.position.y = lift + 0.8;
    ball(body, 0.95, skin, 0, 0.25, 0.85, W, 0.85, 1.1); ball(body, 0.55, skin, 0, 0, -0.25, W, 0.8, 1); // abdomen + front
    headR = 0; headAt = new THREE.Vector3(0, 0.05, -0.62); top = 0.5; tailFrom = [0, 0.2, 1.8]; legRing = { y: -0.05, x: 0.4 * W, z: 0.35 };
  } else if (m.body === "ghost") {
    body.position.y = lift + 1.2;
    // one smooth bell shape (round on top, flowing out at the bottom) with a wavy hem
    const prof = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, y = 1.1 - t * 2.1; prof.push(new THREE.Vector2(Math.max(0.001, t < 0.4 ? Math.sin((t / 0.4) * Math.PI / 2) * 0.75 : 0.75 + (t - 0.4) * 0.45) * W, y)); }
    const bell = new THREE.LatheGeometry(prof, 40), p = bell.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.85) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + Math.sin(a * 6) * 0.14); }
    bell.computeVertexNormals();
    add(body, bell, new THREE.MeshStandardMaterial({ ...base, map: skin.map, side: THREE.DoubleSide, emissive: skin.emissive, emissiveIntensity: 0.25 }));
    headR = 0; headAt = new THREE.Vector3(0, 0.45, -0.7 * W); top = 1.1; tailFrom = null; legRing = { y: -1, x: 0.3, z: 0 };
  } else if (m.body === "blob") {
    body.position.y = 0.95;
    ball(body, 1.1, skin, 0, 0, 0, W * 1.15, 0.85, 1.1);
    for (let i = 0; i < 6; i++) { const a = i * 1.05; ball(body, 0.28, skin, Math.cos(a) * 1.05 * W, -0.62, Math.sin(a) * 1.0, 1, 0.6, 1); } // drips
    headR = 0; headAt = new THREE.Vector3(0, 0.2, -0.92); top = 0.95; tailFrom = [0, -0.2, 1.1]; legRing = { y: -0.7, x: 0.5, z: 0.4 };
  } else { // round
    body.position.y = lift + 1.0;
    ball(body, 1.0, skin, 0, 0, 0, W * 1.1, 1.0, 1.05);
    headR = 0; headAt = new THREE.Vector3(0, 0.25, -0.98); top = 0.95; tailFrom = [0, -0.2, 1.0]; legRing = { y: -0.7, x: 0.55 * W, z: 0.45 };
  }
  if (neck && m.heads === 1) chain(body, [...neck, headAt.toArray()], 0.32 * W, 0.28, skin, 10);
  if (m.bones) for (let i = 0; i < 4; i++) { const r = add(body, new THREE.TorusGeometry(0.55 * W, 0.05, 6, 20, Math.PI * 1.3), white, 0, 0.35 - i * 0.22, 0); r.rotation.set(Math.PI / 2, 0, Math.PI * 0.85); }
  // ---- heads
  const heads = [];
  for (let i = 0; i < m.heads; i++) {
    const spread = (i - (m.heads - 1) / 2);
    const h = new THREE.Group(); h.position.copy(headAt); h.position.x += spread * (headR ? headR * 2.1 : 0.75);
    if (m.heads > 1 && neck) chain(body, [[spread * 0.2, 0.3, -0.95], [spread * 0.6, 0.55, -1.35], h.position.toArray()], 0.24, 0.22, skin, 9);
    if (m.heads > 1 && !headR) h.rotation.y = -spread * 0.35;
    body.add(h);
    const hr = headR || 0;
    if (hr) {
      if (m.body === "box") add(h, new THREE.BoxGeometry(hr * 1.9, hr * 1.6, hr * 1.6), m.rock ? skin : plain);
      else ball(h, hr, skin, 0, 0, 0, 1.05, 0.95, 1);
      if (m.snout) { ball(h, hr * 0.62, skin, 0, -hr * 0.22, -hr * 0.85, 0.9, 0.7, 1.15); ball(h, hr * 0.09, dark, -hr * 0.18, -hr * 0.08, -hr * 1.48); ball(h, hr * 0.09, dark, hr * 0.18, -hr * 0.08, -hr * 1.48); }
    }
    heads.push({ h, r: hr });
  }
  // ---- faces: eyes (white, colored iris, pupil, a shine), brows, mouth with teeth / fangs
  for (const { h, r } of heads) {
    const front = r ? -r * 0.86 : 0, face = r || 0.55, n = m.eyes;
    const rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
    let er = m.bigEye && n === 1 ? (r || 1) * 0.92 : n === 1 ? face * 0.55 : Math.max(face * 0.13, face * (0.34 - n * 0.025));
    if (m.cute) er *= 1.3;
    const span = face * (n > 2 ? 1.25 : 0.95);
    const eyeY = (r ? r * 0.18 : face * 0.25) + (m.snout && r ? r * 0.1 : 0);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
      const x = inRow === 1 ? 0 : (col / (inRow - 1) - 0.5) * span;
      const y = eyeY + (rows > 1 ? (0.5 - row) * er * 2.3 : 0);
      const eye = new THREE.Group(); eye.position.set(x, y, front - 0.02); eye.rotation.y = x * 0.6; h.add(eye);
      if (m.metal && !m.cute) { add(eye, new THREE.CylinderGeometry(er, er, er * 0.5, 20), dark).rotation.x = Math.PI / 2; ball(eye, er * 0.6, eyeM, 0, 0, -er * 0.2); continue; }
      if (m.bigEye) { // the whole body is the eyeball: just a big iris and pupil on its front
        eye.position.z = front - 0.02;
        ball(eye, 0.5, eyeM, 0, 0, 0, 1, 1, 0.3); ball(eye, 0.22, dark, 0, 0, -0.1, 1, 1, 0.3); ball(eye, 0.08, white, 0.14, 0.15, -0.16);
        continue;
      }
      ball(eye, er, white, 0, 0, 0);
      ball(eye, er * 0.62, eyeM, 0, 0, -er * 0.64, 1, 1, 0.6);
      ball(eye, er * (m.angry ? 0.22 : 0.34), dark, 0, 0, -er * 0.88, m.angry ? 0.5 : 1, 1, 0.5);
      ball(eye, er * 0.12, white, er * 0.25, er * 0.28, -er * 1.0);
      if (m.angry) { const b = add(eye, new THREE.BoxGeometry(er * 2.3, er * 0.35, er * 0.5), m.body === "box" ? dark : accent, 0, er * 0.95, -er * 0.4); b.rotation.z = x > 0.01 ? 0.45 : x < -0.01 ? -0.45 : 0; }
    }
    if (m.cute) for (const s of [-1, 1]) ball(h, face * 0.13, new THREE.MeshStandardMaterial({ color: 0xff8aa8, transparent: true, opacity: 0.6 }), s * face * 0.55, eyeY - er * 1.3, front + 0.02, 1, 0.6, 0.3);
    // mouth: a dark smile (or frown), teeth along it, a tongue
    const mw = face * (m.cute ? 0.5 : 0.95), my = (r ? -r * 0.42 : -face * 0.35) - (m.snout && r ? r * 0.12 : 0), mz = (m.snout && r ? -r * 1.15 : front) - 0.02;
    if (m.teeth || m.fangs || n === 0 || m.cute) {
      const mouth = add(h, new THREE.TorusGeometry(mw * 0.5, mw * (m.teeth ? 0.16 : 0.06), 8, 24, Math.PI), dark, 0, my + mw * 0.3, mz);
      mouth.rotation.z = m.angry ? 0 : Math.PI; mouth.scale.y = m.teeth ? 0.75 : 0.6;
      if (m.teeth && !m.cute) {
        ball(h, mw * 0.18, tongue, 0, my + (m.angry ? mw * 0.32 : -mw * 0.05), mz + 0.03, 1.4, 0.5, 0.6);
        const k = 7;
        for (let i = 0; i < k; i++) {
          const a = Math.PI * (0.12 + 0.76 * (i / (k - 1))), tx = Math.cos(a) * mw * 0.5, ty = my + mw * 0.3 + (m.angry ? 1 : -1) * Math.sin(a) * mw * 0.5 * 0.75;
          const t = add(h, new THREE.ConeGeometry(mw * 0.07, mw * 0.2, 5), white, tx, ty + (m.angry ? -mw * 0.06 : mw * 0.06), mz - 0.04); t.rotation.z = m.angry ? 0 : Math.PI;
        }
      }
    }
    if (m.fangs) for (const s of [-1, 1]) { const f = add(h, new THREE.ConeGeometry(mw * 0.1, mw * 0.42, 8), white, s * mw * 0.28, my + mw * 0.05, mz - 0.05); f.rotation.x = Math.PI; }
    // horns (curved), antennae, ears
    const hz = r ? r * 0.1 : 0.15, topY = top - headAt.y; // (the top of the head / body, measured from the face)
    for (let i = 0; i < m.horns; i++) {
      const x = m.horns === 1 ? 0 : (i / (m.horns - 1) - 0.5) * face * 1.3, out = Math.sign(x), b0 = [x, topY - face * 0.12, hz];
      chain(h, [b0, [x + out * face * 0.35, b0[1] + face * 0.45, hz + face * 0.1], [x + out * face * 0.5, b0[1] + face * 0.75, hz + face * 0.35]], face * 0.16, face * 0.04, horn, 12, horn);
    }
    if (m.hat !== "none" && h === heads[0].h) addHat(h, m.hat, face, topY, hz);
    if (m.antennae) for (const s of [-1, 1]) { const tip = chain(h, [[s * face * 0.25, topY - 0.05, hz], [s * face * 0.5, topY + 0.5, hz - 0.15], [s * face * 0.85, topY + 0.75, hz - 0.35]], 0.035, 0.03, dark, 14).getPoint(1); ball(h, 0.1, eyeM, ...tip.toArray()); }
    if (m.ears || m.longEars) for (const s of [-1, 1]) {
      const ey = topY - face * 0.15, len = m.longEars ? face * 1.4 : face * 0.55;
      if (m.cute && !m.longEars) { ball(h, face * 0.28, skin, s * face * 0.7, ey, hz, 1, 1, 0.4); ball(h, face * 0.16, accent, s * face * 0.7, ey, hz - face * 0.08, 1, 1, 0.3); }
      else if (m.longEars) { const e = add(h, new THREE.CapsuleGeometry(face * 0.17, len, 6, 14), skin, s * face * 0.32, ey + len * 0.55, hz); e.rotation.z = -s * 0.18; e.scale.z = 0.45; ball(h, face * 0.1, accent, s * face * 0.33, ey + len * 0.55, hz - face * 0.07, 1, len / (face * 0.25), 0.3).rotation.z = -s * 0.18; }
      else { const e = add(h, new THREE.ConeGeometry(face * 0.24, len, 12), skin, s * face * 0.6, ey + len * 0.4, hz); e.rotation.z = -s * 0.35; e.scale.z = 0.45; }
    }
  }
  // ---- hats (on the first head)
  function addHat(h, hat, f, y, z) {
    const hm = (c, k) => new THREE.MeshStandardMaterial({ color: c, roughness: k == null ? 0.6 : k, metalness: c === "#d4af37" ? 0.7 : 0 });
    const black = hm("#1a1a1f"), band = hm(m.color2);
    const grp = new THREE.Group(); grp.position.set(0, y - f * 0.08, z * 0.5); h.add(grp);
    const cyl = (rt, rb, ht, mat, yy) => add(grp, new THREE.CylinderGeometry(rt * f, rb * f, ht * f, 28), mat, 0, yy * f, 0);
    if (hat === "tophat") { cyl(1.0, 1.0, 0.06, black, 0.03); cyl(0.62, 0.62, 1.1, black, 0.6); cyl(0.63, 0.63, 0.16, band, 0.15); }
    else if (hat === "crown") { const gold = hm("#d4af37", 0.3); cyl(0.6, 0.6, 0.35, gold, 0.17); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(grp, new THREE.ConeGeometry(0.1 * f, 0.35 * f, 6), gold, Math.cos(a) * 0.55 * f, 0.5 * f, Math.sin(a) * 0.55 * f); } ball(grp, 0.08 * f, hm("#e8261c", 0.2), 0, 0.18 * f, -0.6 * f); }
    else if (hat === "cap") { const c = hm(m.color2); ball(grp, 0.62 * f, c, 0, 0.05 * f, 0, 1, 0.55, 1); add(grp, new THREE.CylinderGeometry(0.42 * f, 0.42 * f, 0.04 * f, 24, 1, false, Math.PI * 0.5, Math.PI), c, 0, 0.05 * f, -0.45 * f).scale.z = 1.4; }
    else if (hat === "party") { add(grp, new THREE.ConeGeometry(0.4 * f, 1.0 * f, 24), hm(m.color2), 0, 0.5 * f, 0); ball(grp, 0.1 * f, hm("#ffffff"), 0, 1.02 * f, 0); }
    else if (hat === "wizard" || hat === "witch") { const c = hm(hat === "witch" ? "#1a1a1f" : "#2f4fd0"); cyl(1.0, 1.0, 0.05, c, 0.02); const cone = add(grp, new THREE.ConeGeometry(0.55 * f, 1.5 * f, 24), c, 0, 0.75 * f, 0.1 * f); cone.rotation.x = 0.25; if (hat === "wizard") ball(grp, 0.08 * f, hm("#ffc531", 0.2), 0.2 * f, 0.6 * f, -0.4 * f); else cyl(0.56, 0.56, 0.12, hm("#a64bf4"), 0.12); }
    else if (hat === "cowboy") { const c = hm("#8b5a2b"); const brim = cyl(1.25, 1.25, 0.05, c, 0.03); brim.scale.z = 0.8; cyl(0.55, 0.62, 0.65, c, 0.36); cyl(0.63, 0.63, 0.1, black, 0.1); }
    else if (hat === "helmet") ball(grp, 0.78 * f, hm(m.metal ? "#c9ced6" : m.color2, 0.3), 0, -0.05 * f, 0, 1, 0.75, 1);
    else if (hat === "bow") { const c = hm("#ff4fa3"); ball(grp, 0.12 * f, c, 0.3 * f, 0.08 * f, 0); for (const sx of [-1, 1]) ball(grp, 0.22 * f, c, 0.3 * f + sx * 0.25 * f, 0.08 * f, 0, 1.2, 0.8, 0.4); }
    else if (hat === "halo") { const t = add(grp, new THREE.TorusGeometry(0.5 * f, 0.07 * f, 10, 32), new THREE.MeshStandardMaterial({ color: "#ffe680", emissive: new THREE.Color("#ffd040"), emissiveIntensity: 1 }), 0, 0.45 * f, 0); t.rotation.x = Math.PI / 2; }
    else if (hat === "chef") { const w2 = hm("#ffffff"); cyl(0.5, 0.5, 0.45, w2, 0.22); ball(grp, 0.62 * f, w2, 0, 0.65 * f, 0, 1, 0.75, 1); }
    else if (hat === "headphones") { const c = hm(m.color2); const t = add(grp, new THREE.TorusGeometry(0.85 * f, 0.07 * f, 8, 24, Math.PI), c, 0, -0.35 * f, 0); for (const sx of [-1, 1]) { const e = add(grp, new THREE.CylinderGeometry(0.25 * f, 0.25 * f, 0.18 * f, 20), black, sx * 0.85 * f, -0.4 * f, 0); e.rotation.z = Math.PI / 2; } }
  }
  // ---- legs: tapered, with a knee, a foot and (maybe) claws
  const limbM = m.bones ? white : skin;
  const footAt = (fx, fz, r) => { ball(g, r * 1.3, limbM, fx, r * 0.9, fz - r * 0.4, 1, 0.65, 1.4); if (m.claws) for (let c = -1; c <= 1; c++) { const k = add(g, new THREE.ConeGeometry(r * 0.28, r * 0.9, 6), horn, fx + c * r * 0.55, r * 0.5, fz - r * 1.9); k.rotation.x = -Math.PI / 2 - 0.3; } };
  if (m.legs) {
    const by = body.position.y;
    if (m.legs <= 2 && ["tall", "box", "ghost"].includes(m.body)) for (const s of [-1, 1]) { const x = s * legRing.x; chain(g, [[x, by + legRing.y, 0], [x * 1.05, (by + legRing.y) * 0.5, -0.08], [x * 1.08, 0.25, 0]], 0.24 * W, 0.18, limbM, 12); footAt(x * 1.08, 0, 0.2); }
    else for (let i = 0; i < m.legs; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), per = Math.ceil(m.legs / 2), spidery = m.legs >= 6 && !m.pincers;
      const z = per === 1 ? 0 : (k / (per - 1) - 0.5) * (m.body === "long" ? 2.1 : legRing.z * 2.6) + (m.body === "spider" ? 0.1 : 0);
      const hip = [side * legRing.x, by + legRing.y + (spidery ? 0.25 : 0), z];
      if (spidery) chain(g, [hip, [side * (legRing.x + 0.9), by + 0.85, z * 1.15], [side * (legRing.x + 1.6), by * 0.55, z * 1.35], [side * (legRing.x + 1.85), 0.05, z * 1.5]], 0.11, 0.04, limbM, 18, m.claws ? horn : null);
      else { const knee = [side * (legRing.x + 0.12), hip[1] * 0.5, z - 0.1]; chain(g, [hip, knee, [side * (legRing.x + 0.1), 0.22, z]], 0.24 * W, 0.16, limbM, 12); footAt(side * (legRing.x + 0.1), z, 0.18); }
    }
  }
  // ---- arms from the shoulders, with hands (or crab pincers)
  for (let i = 0; i < m.arms; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), by = body.position.y;
    const sy = by + (["long", "spider", "round", "blob"].includes(m.body) ? 0.1 : 0.75) - k * 0.38;
    const sx = side * (m.body === "long" ? 0.55 * W : m.body === "box" ? 0.85 * W : 0.66 * W), sz = m.body === "long" ? -0.85 : 0;
    const hand = [sx + side * 0.55, sy - (m.body === "long" ? 0.15 : 0.95), sz - 0.75];
    chain(g, [[sx, sy, sz], [sx + side * 0.5, sy - 0.45, sz - 0.1], hand], 0.17 * W, 0.12, limbM, 12);
    if (m.pincers) {
      ball(g, 0.26, accent, hand[0], hand[1], hand[2] - 0.15, 1, 0.8, 1.4);
      for (const t of [-1, 1]) { const p = add(g, new THREE.ConeGeometry(0.1, 0.45, 8), accent, hand[0] + t * 0.08, hand[1], hand[2] - 0.55); p.rotation.x = -Math.PI / 2; p.rotation.z = t * 0.25; }
    } else {
      ball(g, 0.16, m.metal ? dark : limbM, ...hand);
      if (m.claws) for (let c = -1; c <= 1; c++) { const k2 = add(g, new THREE.ConeGeometry(0.04, 0.24, 6), horn, hand[0] + c * 0.07, hand[1] - 0.18, hand[2] - 0.06); k2.rotation.x = Math.PI + 0.3; }
    }
  }
  // ---- tentacles: tapered, curling outward
  for (let i = 0; i < m.tentacles; i++) {
    const a = (i / m.tentacles) * Math.PI * 2, r = 0.55 * W, by = body.position.y;
    const p = (d, y, curl) => [Math.cos(a) * d - Math.sin(a) * curl, y, Math.sin(a) * d + Math.cos(a) * curl];
    chain(g, [p(r, by - 0.6, 0), p(r * 1.5, by * 0.55, 0.1), p(r * 2.2, 0.35, 0.4), p(r * 2.4, 0.12, 0.9), p(r * 2.0, 0.08, 1.2)], 0.17, 0.035, m.body === "blob" ? skin : accent, 22);
  }
  // ---- back: spikes, wings, tail (+ stinger), fins, fur tufts
  if (m.spikes) { const n = m.body === "long" ? 7 : 5; for (let i = 0; i < n; i++) { const t = i / (n - 1), sz = 0.18 + Math.sin(t * Math.PI) * 0.22;
    const s = add(body, new THREE.ConeGeometry(sz * 0.5, sz * 2, 8), m.bones ? white : accent, 0, (m.body === "long" ? 0.6 : top * 0.9) + Math.sin(t * Math.PI) * 0.08, (t - 0.5) * (m.body === "long" ? 1.9 : 1.2) + (m.body === "spider" ? 0.85 : 0)); s.rotation.x = 0.25; } }
  if (m.wings) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.45 * W, m.body === "long" ? 0.4 : top * 0.65, m.body === "long" ? -0.3 : 0.25); w.rotation.y = s * 0.35; w.rotation.z = s * -0.15; body.add(w);
    const span = 2.3, tips = [[s * span, 1.15], [s * span * 0.95, 0.15], [s * span * 0.7, -0.55]];
    for (const [x, y] of tips) chain(w, [[0, 0, 0], [x * 0.45, y * 0.6 + 0.35, 0.05], [x, y, 0.08]], 0.06, 0.025, horn, 12);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(tips[0][0], tips[0][1]);
    for (let j = 0; j < tips.length - 1; j++) { const [x1, y1] = tips[j], [x2, y2] = tips[j + 1]; sh.quadraticCurveTo((x1 + x2) / 2 * 0.82, (y1 + y2) / 2 * 0.82 - 0.05, x2, y2); }
    sh.quadraticCurveTo(s * 0.6, -0.6, 0, -0.35); sh.closePath();
    add(w, new THREE.ShapeGeometry(sh, 16), new THREE.MeshStandardMaterial({ color: m.color2, side: THREE.DoubleSide, roughness: 0.7, transparent: true, opacity: m.ghost ? 0.4 : 0.88 }), 0, 0, 0.06);
  }
  if (m.tail && tailFrom) {
    const by = body.position.y, [tx, ty, tz] = tailFrom;
    chain(g, [[tx, by + ty, tz], [tx, by + ty - 0.2, tz + 0.7], [tx, Math.max(0.3, by * 0.5), tz + 1.4], [tx, by * 0.55 + (m.stinger ? 1.2 : 0.2), tz + 2.1]], 0.28 * W, m.stinger ? 0.09 : 0.05, skin, 26, m.stinger ? null : null);
    if (m.stinger) { const tip = [tx, by * 0.55 + 1.2, tz + 2.1]; ball(g, 0.2, accent, tip[0], tip[1] + 0.12, tip[2] - 0.1, 1, 1.3, 1); const st = add(g, new THREE.ConeGeometry(0.07, 0.45, 8), dark, tip[0], tip[1] + 0.05, tip[2] - 0.38); st.rotation.x = -Math.PI / 2 - 0.4; }
  }
  if (m.fins) { const f = add(body, new THREE.ConeGeometry(0.4, 1.0, 3), accent, 0, top * 0.7 + 0.3, 0.1); f.scale.z = 0.25; f.rotation.x = 0.3;
    for (const s of [-1, 1]) { const p = add(body, new THREE.ConeGeometry(0.28, 0.75, 3), accent, s * 0.75 * W, -0.25, -0.35); p.rotation.z = s * 1.9; p.scale.z = 0.25; } }
  if (m.fur && !m.metal && !m.slime) for (let i = 0; i < 9; i++) { const a = i * 0.7, t = add(body, new THREE.ConeGeometry(0.1, 0.32, 5), skin, Math.cos(a) * 0.35 * W, top * 0.85 + (i % 3) * 0.04, Math.sin(a) * 0.35 + (m.body === "long" ? 0.2 : 0)); t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
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
