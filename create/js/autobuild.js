// ⚡ AUTO BUILD (in the script editor, locked with the 2468 code): type what you want in plain words, and this writes
// the GunnerVerse script for you. It's not an AI and nothing gets sent anywhere: it reads your sentences, finds the
// WHEN (click, touch, a key, getting close, a timer, the start, a 🧰 tool) and the DO WHAT (open, hide, spin, chase,
// teleport, sounds, colors, win, build 30 trees...) and the names of the things in your game, then puts the code together.
// autoScript(want, { kind, meName, things: [{ name, kind, type }] }) -> { code, got: [what it understood], missed: [words it didn't] }

const SOUNDS = ["beep", "coin", "jump", "boom", "door", "alarm", "scream", "win", "lose", "click"];
const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "white", "black", "gray", "grey", "brown", "gold", "cyan"];
const SKIES = ["day", "sunset", "night", "space", "backrooms"];
const BUILDS = ["block", "ball", "cylinder", "wedge", "plate", "coin", "light", "lava", "jumppad", "crate", "barrel", "cone", "rock", "bush", "tree", "pine", "sign", "checkpoint", "door", "stairs", "fence", "wall", "spinner", "mover"];
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, half: 0.5 };
const KEYNAMES = { space: " ", spacebar: " ", enter: "Enter", shift: "Shift" };

const q = (s) => JSON.stringify(s);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function num(s, def) {
  const m = s.match(/(-?\d+(?:\.\d+)?)/); if (m) return +m[1];
  const w = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|hundred|half)\b/);
  return w ? WORDNUM[w[1]] : def;
}
// words in "quotes" (or after "say"/"message"), kept as the kid typed them
function words(orig, after) {
  const m = orig.match(/["“'‘]([^"”'’]{1,80})["”'’]/); if (m) return m[1];
  if (after) { const a = orig.match(new RegExp("\\b(?:" + after + ")\\b[:,]?\\s*(?:a message\\s*)?(?:that says\\s*|saying\\s*)?(.+)$", "i")); if (a && a[1].trim()) return a[1].trim().replace(/[.!?]+$/, "") + (/[!?]$/.test(a[1].trim()) ? a[1].trim().slice(-1) : ""); }
  return null;
}

export function autoScript(want, info) {
  const hasMe = info.kind !== "game";
  const names = (info.things || []).map((t) => t.name).filter((n) => n && n.length > 1).sort((a, b) => b.length - a.length);
  const nameRes = names.map((n) => [n, new RegExp("(^|[^a-z0-9])" + reEsc(n.toLowerCase()) + "($|[^a-z0-9])")]);
  const thingOf = (n) => (info.things || []).find((t) => t.name === n);
  const ref = (n) => (hasMe && n === info.meName ? "me" : "find(" + q(n) + ")");
  const named = (c) => { for (const [n, r] of nameRes) if (r.test(c)) return n; return null; };
  const got = [], missed = [], blocks = [];

  // ---- split into sentences, then find each sentence's WHEN
  const sentences = String(want || "").replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const sent of sentences) {
    const low = sent.toLowerCase();
    let trig = null, m;
    if (/\b(tool|map builder|builder button)\b/.test(low) && !hasMe) trig = { k: "tool" };
    else if (/\bwhen (?:i |you |the player )?(?:attack|swing|shoot|fire|use (?:it|this|the weapon))\b|\bon attack\b/.test(low)) trig = { k: "attack" };
    else if (/\bwhen (?:it(?:'s| is| gets)?|this(?: is| gets)?|the \w+ (?:is|gets)) hit\b|\bgets hit\b/.test(low)) trig = { k: "hit" };
    else if ((m = low.match(/\b(?:press(?:es)?|hit|push(?:es)?|tap)\s+(?:the\s+)?["']?([a-z0-9]|space(?:bar)?|enter|shift)["']?(?:\s+key)?\b/)) || (m = low.match(/\b["']?([a-z0-9]|space(?:bar)?|enter|shift)["']?\s+key\b/))) trig = { k: "key", x: KEYNAMES[m[1]] || m[1] };
    else if (/\b(click|clicks|clicked|clicking|tap|taps|tapped|press(?:es|ed)? (?:it|this|on|the button)|push(?:es|ed)? the button)\b/.test(low)) trig = { k: "click" };
    else if (/\b(touch|touches|touched|touching|step(?:s|ped)? on|walk(?:s|ed)? (?:into|on)|land(?:s|ed)? on|bump(?:s|ed)? into|run(?:s)? into)\b/.test(low)) trig = { k: "touch" };
    else if (/\b(gets? (?:close|near)|comes? (?:close|near)|goes? near|near (?:it|this|the)|is close to)\b/.test(low)) trig = { k: "near", x: num(low.replace(/.*\bwithin\b/, ""), 10) };
    else if ((m = low.match(/\bevery\s+([\w.]+\s+)?seconds?\b/)) || /\bevery second\b|\bover and over\b/.test(low)) trig = { k: "every", x: m && m[1] ? num(m[1], 1) : 1 };
    else if ((m = low.match(/\b(?:after|in|wait)\s+([\w.]+)\s+seconds?\b/))) trig = { k: "after", x: num(m[1], 3) };
    else trig = { k: "start" };

    // the part of the sentence that says WHAT to do (drop the "when..." part)
    let act = sent;
    const comma = sent.indexOf(",");
    const lead = /^(when|whenever|if|after|every|once|each time|in \d|as soon as)\b/i.test(sent);
    if (lead && comma > 0) act = sent.slice(comma + 1);
    else if (lead && trig.k !== "start") act = sent.replace(/^(when(ever)?|if|once|each time|as soon as)\b.*?\b(click(ed|s)?|touch(es|ed)?|press(es|ed)?\s+\S+(\s+key)?|hit|near|close|attack|shoot)\b\s*(it|this|on it)?\s*/i, "").replace(/^(after|in)\s+\S+\s+seconds?\s*/i, "").replace(/^every\s+(\S+\s+)?seconds?\s*/i, "");
    else { const w = sent.search(/\s(when(ever)?|if|after \S+ seconds?|every (\S+ )?seconds?)\s/i); if (w > 0 && trig.k !== "start") act = sent.slice(0, w); }
    if (trig.k === "tool") act = act.replace(/\b(make|add|give me)?\s*(a|an)?\s*(tool|map builder|builder button)\s*(that|to|which)?\s*/i, "");

    // who the WHEN is about (click this / touch the Lava)
    const trigText = act === sent ? sent : sent.slice(0, Math.max(0, sent.length - act.length));
    const subjName = named((trigText || sent).toLowerCase());
    let subj = subjName ? ref(subjName) : hasMe ? "me" : null;
    if ((trig.k === "click" || trig.k === "touch" || trig.k === "near" || trig.k === "hit") && !subj) {
      missed.push("“" + sent + "” (which thing? use its name from the Explorer)"); continue;
    }

    // ---- the DO WHAT part: split into little pieces at commas / and / then
    const pieces = act.split(/,|;|\band then\b|\bthen\b|\band also\b|\balso\b|\band\b(?!\s+close\b)(?!\s+(?:off|out)\b)/i).map((p) => p.trim()).filter((p) => p && !/^(and|then|it)$/i.test(p));
    const lines = [], says = [];
    let it = subj, wasBuild = false;
    for (const p of pieces) {
      const r = doWhat(p, { it, hasMe, named, ref, thingOf, trig, wasBuild });
      wasBuild = !!(r && r.say.startsWith("🧱"));
      if (r) { lines.push(...r.lines); got.push(r.say); says.push(r.say); if (r.it) it = r.it; }
      else missed.push("“" + p + "”");
    }
    if (!lines.length) continue;
    blocks.push({ trig, subj, lines, sent, says });
  }

  // ---- put it together (same WHEN = one block)
  const merged = [];
  for (const b of blocks) {
    const same = merged.find((x) => x.trig.k === b.trig.k && x.trig.x === b.trig.x && x.subj === b.subj && b.trig.k !== "tool");
    if (same) { same.lines.push(...b.lines); same.sent += " " + b.sent; } else merged.push({ ...b, lines: [...b.lines] });
  }
  const ind = (ls, n = 1) => ls.map((l) => l.split("\n").map((x) => "  ".repeat(n) + x).join("\n")).join("\n");
  let code = "// ⚡ Auto Build: " + String(want || "").replace(/\s+/g, " ").trim().slice(0, 140) + "\n";
  for (const b of merged) {
    const { trig: t, subj: s, lines } = b;
    code += "\n// " + b.sent.slice(0, 120) + "\n";
    if (t.k === "start") code += lines.join("\n") + "\n";
    else if (t.k === "click") code += s + ".onClick(function () {\n" + ind(lines) + "\n})\n";
    else if (t.k === "touch") code += s + ".onTouch(function () {\n" + ind(lines) + "\n})\n";
    else if (t.k === "hit") code += s + ".onHit(function (damage) {\n" + ind(lines) + "\n})\n";
    else if (t.k === "attack") code += (hasMe ? "me.onAttack" : "onAttack") + "(function (aim) {\n" + ind(lines) + "\n})\n";
    else if (t.k === "key") code += "onKey(" + q(t.x) + ", function () {\n" + ind(lines) + "\n})\n";
    else if (t.k === "after") code += "after(" + t.x + ", function () {\n" + ind(lines) + "\n})\n";
    else if (t.k === "every") code += "every(" + t.x + ", function () {\n" + ind(lines) + "\n})\n";
    else if (t.k === "near") { const v = "wasNear" + (merged.indexOf(b) || ""); code += "let " + v + " = false\nonUpdate(function () {\n  const near = " + s + ".distanceTo(player) < " + t.x + "\n  if (near && !" + v + ") {\n" + ind(lines, 2) + "\n  }\n  " + v + " = near\n})\n"; }
    else if (t.k === "tool") { const nm = b.says.map((x, i) => x.replace(/^\S+\s+/, "").replace(i ? /^Build / : /^$/, "")).join(" + ").slice(0, 40); code += "addTool(" + q(nm || "My tool") + ", \"🧰\", function () {\n" + ind(lines) + "\n  say(\"Built it!\")\n})\n"; }
  }
  return { code, got, missed, empty: !merged.length };
}

// one little piece of "do what" -> { lines, say, it }
function doWhat(p, c) {
  const o = p.replace(/^(to|please|i want( it)?( to)?|make it so|it should|it will|it'll|should|will|let'?s|can you)\s+/i, "").trim();
  const l = o.toLowerCase();
  const nm = c.named(l);
  // "the Shop" -> find("Shop"); "it"/"this" -> what we were just talking about
  const T = nm ? c.ref(nm) : c.it || (c.hasMe ? "me" : null);
  const label = nm || (T === "me" ? "this" : "it");
  const player = /\b(me|i|myself|the player|player|you|them|everyone)\b/.test(l) && !nm;
  const color = COLORS.find((x) => new RegExp("\\b" + x + "\\b").test(l));
  const N = (d) => num(l, d);
  const one = (line, say, it) => ({ lines: [line], say, it });
  const needT = (fn) => (T ? fn() : null);

  // 🧰 build lots of things (tools, or at the start)
  let m = (c.wasBuild && !/\b(build|spawn|make|create|place|add|put)/.test(l) ? "build " + l : l).match(/\b(?:build|spawn|make|create|place|add|put)s?\s+(?:a\s+(?:bunch|lot|ton)\s+of\s+|lots of\s+|some\s+|many\s+)?(?:(\d+|\w+)\s+)?(?:\w+\s+)?(blocks?|balls?|cylinders?|wedges?|plates?|coins?|lights?|lava|jump ?pads?|crates?|barrels?|cones?|rocks?|bush(?:es)?|trees?|pines?|signs?|checkpoints?|doors?|stairs|fences?|walls?|spinners?|movers?|forest)\b/);
  if (m) {
    let type = m[2].replace(/\s/g, "").replace(/es$/, (x) => (m[2] === "bushes" ? "" : x)).replace(/s$/, "");
    if (m[2] === "bushes") type = "bush"; if (type === "stair") type = "stairs"; if (type === "forest") type = "tree";
    if (!BUILDS.includes(type)) type = "block";
    const n = Math.min(500, Math.max(1, num(m[1] || "", m[2] === "forest" ? 40 : /s$|es$/.test(m[2]) ? 20 : 1)));
    const name = type[0].toUpperCase() + type.slice(1) + (n > 1 ? "s" : "");
    const opts = "name: " + q(name) + ", x: " + (n > 1 ? "random(-80, 80)" : "0") + ", y: 0, z: " + (n > 1 ? "random(-80, 80)" : "0") + (color ? ", color: " + q(color) : "");
    return { lines: [n > 1 ? "for (let i = 0; i < " + n + "; i++) {\n  build(" + q(type) + ", { " + opts + " })\n}" : "build(" + q(type) + ", { " + opts + " })"], say: "🧱 Build " + n + " " + type + (n > 1 ? "s" : "") };
  }
  if (/\b(delete|remove|destroy|clear)\s+(all|every)\b/.test(l) && nm) return one("for (const t of findAll(" + q(nm) + ")) t.destroy()", "🗑️ Delete every " + nm);

  // words on the screen
  if (/\b(change|set)\b.*\b(text|words|label|sign)\b.*\bto\b/.test(l)) { const w = (o.match(/\bto\b\s+(.+)$/i) || [])[1]; return needT(() => one(T + ".text = " + q(words(o) || (w || "Hi!").replace(/["“”]/g, "")), "✏️ Change the words on " + label)); }
  if (/\b(say|says|message|tell (?:me|them|the player)|pop ?up|show the words)\b/.test(l)) return one("say(" + q(words(o, "says?|message|tell (?:me|them|the player)|pop ?ups?|show the words") || "Hello!") + ")", "💬 Show a message");
  if (/\b(print|output)\b/.test(l)) return one("print(" + q(words(o, "print|output") || "hi") + ")", "🖨️ Print in the Output box");
  // win / lose / hurt / heal
  if (/\b(win|wins|won|victory)\b/.test(l)) return one("win(" + q(words(o) || "You win!") + ")", "🏆 The player wins");
  if (/\b(lose|loses|lost|game over)\b/.test(l)) return one("lose(" + q(words(o) || "Game over!") + ")", "💀 The player loses");
  if (/\b(kill|kills|die|dies|instakill|insta-kill)\b/.test(l)) return one("player.damage(100)", "☠️ Kill the player");
  if (/\b(hurt|hurts|damage|damages|harm|harms)\b/.test(l)) { if (nm && !player) return one(T + ".damage(" + N(25) + ")", "💥 Hurt " + label + " " + N(25)); return one("player.damage(" + N(25) + ")", "💥 Hurt the player " + N(25)); }
  if (/\b(heal|heals|full health|health back)\b/.test(l)) return one("player.health = " + N(100), "❤️ Heal the player");
  if (/\b(respawn|checkpoint|start over)\b/.test(l)) return one("player.respawn()", "↩️ Respawn the player");
  // sounds (before "play" animations)
  const snd = SOUNDS.find((x) => new RegExp("\\b" + x + "\\b").test(l)) || (/\bexplo/.test(l) ? "boom" : /\bscream|scary|jump ?scare/.test(l) ? "scream" : null);
  if (/\b(sound|noise|sfx)\b/.test(l) || (/\bplay\b/.test(l) && snd)) return one("sound(" + q(snd || "beep") + ")", "🔊 Play the " + (snd || "beep") + " sound");
  // teleport
  if (/\b(teleport|tp|warp|send|take)\b/.test(l)) {
    const xyz = l.match(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/);
    if (xyz) return one("player.teleport(" + xyz[1] + ", " + xyz[2] + ", " + xyz[3] + ")", "✨ Teleport the player");
    if (nm) return one("player.teleport(" + c.ref(nm) + ")", "✨ Teleport the player to " + nm);
    return null;
  }
  // show / hide
  if (/\b(toggle|open (?:and|or|\/) ?close|open\/close|show (?:and|or) hide|show\/hide)\b/.test(l)) return needT(() => one(T + ".toggle()", "🔁 Open/close " + label));
  if (/\b(see[- ]?through|transparent|ghost|fade)\b/.test(l)) return needT(() => one(T + ".transparency = " + N(70), "👻 Make " + label + " see-through"));
  if (/\b(walk through|not solid|no ?clip|go through)\b/.test(l)) return needT(() => one(T + ".solid = false", "🚪 Let players walk through " + label));
  if (/\b(solid)\b/.test(l)) return needT(() => one(T + ".solid = true", "🧱 Make " + label + " solid"));
  if (/\b(close|closes|hide|hides|disappear|disappears|vanish|vanishes|invisible|go away|goes away)\b/.test(l)) return needT(() => one(T + ".hide()", "🙈 Hide " + label));
  if (/\b(open|opens|show|shows|appear|appears|visible|unhide|come back|comes back|pop up)\b/.test(l)) return needT(() => one(T + ".show()", "👀 Show " + label));
  // moving + turning
  if (/\b(spin|spins|spinning|rotate|rotates|rotating)\b/.test(l)) return needT(() => one(T + ".spin(" + N(90) + ")", "🌀 Spin " + label));
  if (/\bturn(s)?\s+(around|\d+|left|right)/.test(l)) { const d = /around/.test(l) ? 180 : /left/.test(l) ? -90 : N(90); return needT(() => one(T + ".turn(" + d + ")", "↪️ Turn " + label)); }
  if (/\b(chase|chases|follow|follows|hunt|hunts|come after|comes after)\b/.test(l)) return needT(() => one(T + ".follow(player, " + N(6) + ")", "🏃 " + label + " chases the player"));
  if (/\bstop(s)?\b/.test(l) && !/\bstop the player\b/.test(l)) return needT(() => one(T + ".stop()", "✋ Stop " + label));
  if (/\b(look at|face|faces)\b/.test(l)) return needT(() => one(T + ".lookAt(player)", "👁️ " + label + " looks at the player"));
  if ((m = l.match(/\bmove(?:s)?\s+(?:it\s+|this\s+)?(up|down|left|right|forward|forwards|back|backward|backwards)\b/)) || (m = l.match(/\bgo(?:es)?\s+(up|down)\b/))) {
    const d = N(m[1] === "up" || m[1] === "down" ? 5 : 3), v = { up: [0, d, 0], down: [0, -d, 0], left: [-d, 0, 0], right: [d, 0, 0], back: [0, 0, d], backward: [0, 0, d], backwards: [0, 0, d] }[m[1]];
    return needT(() => one(v ? T + ".move(" + v.join(", ") + ")" : T + ".forward(" + d + ")", "➡️ Move " + label + " " + m[1]));
  }
  if (/\b(come to me|move to me|go to the player|move to the player|come here)\b/.test(l)) return needT(() => one(T + ".moveTo(player)", "📍 Move " + label + " to the player"));
  // player powers
  if (/\b(freeze|freezes|frozen)\b/.test(l) && !/\bunfreeze\b/.test(l)) return one("player.freeze()", "🧊 Freeze the player");
  if (/\bunfreeze|let (?:me|them|the player) go\b/.test(l)) return one("player.unfreeze()", "🔥 Unfreeze the player");
  if (/\b(slow|slower)\b/.test(l)) return one("player.speed = " + N(0.5), "🐢 Make the player slow");
  if (/\b(fast|faster|speed|super speed|run faster|zoom)\b/.test(l)) return one("player.speed = " + N(2), "⚡ Super speed");
  if (/\b(jump|jumps)\b.*\b(higher|high|super|more|times)\b|\bsuper jump\b|\bhigh jump\b/.test(l)) return one("player.jump = " + N(2), "🦘 Jump higher");
  // color
  if (/\brainbow\b/.test(l)) return needT(() => one(T + ".color = [\"red\", \"orange\", \"yellow\", \"green\", \"blue\", \"purple\"][random(0, 5)]", "🌈 Random rainbow color on " + label));
  if (color && /\b(color|colour|turn|turns|make|paint|change|changes|go|goes|become|becomes)\b/.test(l)) return needT(() => one(T + ".color = " + q(color === "grey" ? "gray" : color), "🎨 Make " + label + " " + color));
  // score, sky, animations, copies, deleting
  if (/\b(score|point|points)\b/.test(l)) return one("shared.score = (shared.score || 0) + " + N(1) + "\nsay(\"Score: \" + shared.score)", "⭐ Add " + N(1) + " to the score");
  const sky = SKIES.find((x) => new RegExp("\\b" + x + "\\b").test(l));
  if (sky && /\b(sky|time|make it|turn|change|becomes?|nighttime|daytime)\b/.test(l)) return one("game.sky = " + q(sky), "🌌 Make the sky " + sky);
  if ((m = l.match(/\b(dance|dances|wave|waves|fly|flies)\b/)) || /\banimation\b/.test(l)) { const a = m ? { dance: "dance", dances: "dance", wave: "wave", waves: "wave", fly: "fly", flies: "fly" }[m[1]] : "dance"; return needT(() => one(T + ".play(" + q(a) + ")", "💃 " + label + " plays the " + a + " animation")); }
  if (/\b(shoot|shoots|fire|fires|blast|blasts)\b/.test(l)) return one("shoot({ damage: " + N(20) + ", speed: 80, color: " + q(color || "yellow") + ", size: 0.5" + (/\bexplo|boom\b/.test(l) ? ", boom: 4" : "") + " })", "🔫 Shoot a shot");
  if (/\b(clone|copy|duplicate)\b/.test(l)) return needT(() => one(T + ".clone()", "📄 Make a copy of " + label));
  if (/\b(explode|explodes|blow up|blows up)\b/.test(l)) return needT(() => ({ lines: ["sound(\"boom\")", T + ".destroy()"], say: "💥 Blow up " + label }));
  if (/\b(delete|deletes|destroy|destroys|remove|removes|break|breaks)\b/.test(l)) return needT(() => one(T + ".destroy()", "🗑️ Delete " + label));
  if (/\b(bigger|grow|grows|smaller|shrink|shrinks)\b/.test(l)) return null;
  return null;
}
