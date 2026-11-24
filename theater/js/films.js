// MOVIE THEATER: the movies. Each one is a Script (engine.js): a cast of cartoon actors + a list of timed events.
// Ground level is y = 600, the middle of the screen is x = 640.
import { Script } from "./engine.js";

const G = 600;
const MASKED_NINJA = { body: "#1a1a22", pants: "#1a1a22", mask: "#1a1a22", hat: "headband", band: "#e0302a", weapon: "katana", belt: "#e0302a", shoes: "#111" };

// ---------------------------------------------------------------- 1. ROOFTOP RUMBLE (no talking)
function rooftop() {
  const s = new Script();
  s.at(0).title("ROOFTOP RUMBLE", 3, "a GunnerVerse Pictures film", "#ff4a4a").cam(1.5, 900, 330).cam(1, 640, 360, 3);
  s.at(3).show("ninja", -80, 1).jump("ninja", 380, 1.0, 280, 1).sfx("whoosh");
  s.at(4.3).show("bot", 1450, -1).walk("bot", 900, 2);
  for (let i = 0; i < 4; i++) s.at(4.5 + i * 0.5).sfx("thud").shake(0.15);
  s.at(6.6).cam(1.8, 900, 420, 0.5).sfx("powerup").glow("bot", "#ff3a3a");
  s.at(7.6).cam(1.8, 380, 470, 0.4).act("ninja", "guard", 0.5, true);
  s.at(8.4).cam(1, 640, 360, 0.4).glow("bot", 0).act("bot", "cast", 0.9);
  s.at(8.6).jump("ninja", 560, 0.8, 230, 1).fx("beam", { x: 850, y: 420, x2: 120, y2: 430, c: "#ff3a3a", w: 16, d: 0.6 }).sfx("laser");
  s.at(9.2).fx("boom", { x: 160, y: 440 });
  s.at(9.8).move("ninja", 800, 0.3).fx("speed", { d: 0.4 }).sfx("whoosh");
  s.at(10.2);
  for (let i = 0; i < 3; i++) s.act("ninja", "slash", 0.3).wait(0.13).fx("slash", { x: 860, y: 450, dir: i % 2 ? -1 : 1 }).hit("bot", 1, 0.35, "clang", i === 2 ? "SHING!" : null).wait(0.2);
  s.at(11.5).act("bot", "punch", 0.5).wait(0.2).act("ninja", "block", 0.5).hit("ninja", -1, 1.1, "thud", "BLOCK!");
  s.at(12.6).act("bot", "cast", 0.7).sfx("powerup").wait(0.3).proj("fist", "bot", "ninja", 0.45, { sound: "whoosh" });
  s.at(13.35).act("ninja", "slash", 0.35).sfx("clang").fx("slash", { x: 560, y: 470, dir: 1, s: 1.3 }).proj("fist", [560, 470], [1300, -60], 0.7).wait(0.75).fx("twinkle", { x: 1250, y: 60 }).sfx("ding");
  s.at(14.3);
  for (let i = 0; i < 3; i++) s.act("ninja", "throw", 0.3).proj("shuriken", "ninja", "bot", 0.28, { sound: "swing" }).wait(0.28).hit("bot", 1, 0.3, "clang", "TINK!").wait(0.12);
  s.at(15.8).jump("bot", 880, 0.5, 70).wait(0.5).shake(0.8).fx("dust", { x: 880, y: G }).sfx("thud").jump("ninja", 520, 0.6, 130);
  s.at(17.2).move("bot", 470, 0.55).sfx("horn").jump("ninja", 1010, 0.75, 300, 1).wait(0.55).sfx("crash").shake(0.6).fx("dust", { x: 430, y: G });
  s.at(18.3).face("bot", 1).act("bot", "cast", 1.2).wait(0.2).fx("beam", { x: 560, y: 420, x2: 980, y2: 470, c: "#ff3a3a", w: 18, d: 0.9 }).sfx("laser").act("ninja", "block", 1.0).fx("sparks", { x: 980, y: 470 }).hit("ninja", 1, 0.5, "zap", "ZZZT!");
  s.at(19.8).cam(1.45, 1000, 430, 0.4).act("ninja", "charge", 1.2, true).glow("ninja", "#ff3a3a").sfx("powerup").fx("lightning", { x: 1030, y: G - 20 });
  s.at(21.1).cam(1, 640, 360, 0.3).slow(0.35, 1.3).jump("ninja", 640, 1.0, 330, 1).fx("speed", { d: 0.9 });
  s.at(22.0).act("ninja", "slash", 0.6).fx("slash", { x: 560, y: 430, dir: -1, s: 2.4, c: "#ff6a6a" }).sfx("clang").sfx("whoosh").flash().glow("ninja", 0);
  s.at(22.4).hit("bot", -1, 1.3, "clang", "SLASH!").act("bot", "dizzy", 1.6, true);
  for (let i = 0; i < 4; i++) s.at(22.8 + i * 0.3).fx("sparks", { x: 440 + i * 30, y: 380 + (i % 2) * 60, c: "#3ad0ff" }).sfx("zap");
  s.at(24.1).fx("bigboom", { x: 450, y: 430 }).hide("bot").fx("confetti", { x: 450, y: 450 });
  s.at(25.3).face("ninja", 1).cam(1.35, 640, 430, 0.8).act("ninja", "bow", 1.6);
  s.at(26.8).title("THE END", 3);
  return { id: "rooftop", title: "Rooftop Rumble", tag: "A ninja. A giant robot. One very bad night for the water tower.", rating: "No talking · Action", bg: "city", music: "action", length: 30.5,
    poster: { c1: "#0a0f2a", c2: "#7a1a3a", acc: "#ff4a4a" },
    cast: { ninja: { ...MASKED_NINJA }, bot: { kind: "robot", body: "#9aa4ae", pants: "#6a727c", shoes: "#3a3f46", scale: 1.3, eye: "#ff3a3a" } }, events: s.events };
}

// ---------------------------------------------------------------- 2. GRANDMA'S LAST STAND (talking, western)
function grandma() {
  const s = new Script();
  s.at(0).title("GRANDMA'S LAST STAND", 3.5, "a GunnerVerse Western", "#ffb03a", 96);
  s.at(0.2).show("granny", 760, -1, "sit");
  s.at(3.4).show("bart", -180, 1).show("slim", -300, 1).show("shorty", -80, 1).walk("bart", 240, 3).walk("slim", 360, 3.1).walk("shorty", 120, 2.9);
  for (let i = 0; i < 6; i++) s.at(3.6 + i * 0.45).sfx("ticktock");
  s.at(6.7).cam(1.3, 300, 420, 0.6).say("bart", "Listen up! This town belongs to the Muddy Boot Gang now!", 3.2);
  s.at(10).cam(1.4, 760, 430, 0.6).base("granny", "idle").say("granny", "Not on my watch, sonny.", 2.4);
  s.at(12.6).cam(1, 640, 360, 0.5).say("slim", "Ha! She's like a HUNDRED years old!", 2.6).sfx("laugh");
  s.at(15.3).say("granny", "A hundred and TWO. And I still bake the best pie in Texas.", 3.4);
  s.at(18.8).say("bart", "Get her, boys!", 1.6).sfx("horn");
  s.at(19.4).move("slim", 640, 0.7);
  s.at(20.0).act("granny", "slash", 0.45).wait(0.2).hit("slim", -1, 1.4, "bonk", "BONK!").wait(0.3).ko("slim", -1, 0.8).fx("stars", { who: "slim", d: 3.5 });
  s.at(21.6).say("shorty", "Eat PIE, granny!", 1.6).act("shorty", "throw", 0.4).proj("pie", "shorty", "granny", 0.75, { arc: 90, sound: "whoosh" });
  s.at(22.3).act("granny", "slash", 0.4).say("granny", "Batter UP!", 1.4).wait(0.1).sfx("bonk").proj("pie", "granny", "bart", 0.5, { arc: 40 });
  s.at(22.9).hit("bart", -1, 0.5, "splat", "SPLAT!").fx("splat", { x: 240, y: 470 }).look("bart", { beard: "#fff8f0", mustache: null }).sfx("crowdlaugh");
  s.at(24.2).cam(1.4, 260, 430, 0.4).mood("bart", "angry").say("bart", "THAT'S IT! Nobody pies Big Bart!", 2.6);
  s.at(26.9).cam(1, 640, 360, 0.3).move("bart", 620, 0.9).sfx("horn").act("granny", "throw", 0.4).proj("yarn", "granny", "bart", 0.45, { sound: "swing" });
  s.at(27.4).hit("bart", 1, 0.3, "boing", "TRIP!").jump("bart", 660, 0.5, 60, 0, "hurt");
  s.at(28.0).act("granny", "uppercut", 0.55).wait(0.25).ko("bart", -1, 1, true).sfx("boing").fx("speed", { d: 0.5 });
  s.at(29.9).fx("twinkle", { x: 220, y: 70 }).sfx("ding").hide("bart");
  s.at(30.7).say("shorty", "...uh...", 1.3);
  s.at(32.1).mood("granny", "happy").say("granny", "Now. Who wants COOKIES?", 2.3);
  s.at(34.6).say("shorty", "...me?", 1.4).proj("cookie", "granny", "shorty", 0.6, { arc: 60 });
  s.at(35.4).act("shorty", "cheer", 1.0).up("slim").say("slim", "Me too!", 1.5);
  s.at(36.2).base("shorty", "dance").base("slim", "dance").base("granny", "dance").sfx("cheer").fx("confetti", { x: 640, y: 200 });
  s.at(38.5).title("THE END", 3.2, "Grandma Rose will return");
  return { id: "grandma", title: "Grandma's Last Stand", tag: "Three outlaws. One grandma. Zero chance.", rating: "Talking · Comedy Western", bg: "desert", music: "western", length: 42,
    poster: { c1: "#ff9a5a", c2: "#6a2a10", acc: "#ffb03a" },
    cast: {
      granny: { name: "Grandma Rose", body: "#a64bf4", pants: "#7a3ab0", hair: "#e0e0e0", bun: true, glasses: true, shawl: "#ff7ad8", weapon: "pin", scale: 0.85, voice: 1.6, rate: 0.95 },
      bart: { name: "Big Bart", body: "#7a1a1a", pants: "#3a2a1a", hat: "cowboy", hatC: "#2a1a0a", mustache: "#3a2010", scale: 1.25, voice: 0.55, angry: true },
      slim: { name: "Slim", body: "#e0c060", pants: "#4a4a6a", hat: "cowboy", hatC: "#8a6a3a", scale: 1.05, voice: 1.1 },
      shorty: { name: "Shorty", body: "#3a8a4a", pants: "#5a3a2a", hat: "bandana", band: "#e0302a", scale: 0.8, voice: 1.5 },
    }, events: s.events };
}

// ---------------------------------------------------------------- 3. GALAXY GLADIATORS (space, some talking)
function galaxy() {
  const s = new Script();
  s.at(0).title("GALAXY GLADIATORS", 3.2, "Episode 7: The Final Round", "#3ad0ff");
  s.at(3.2).show("host", 640, 1, "idle", 380).e("float", { who: "host", v: 1 }).fx("smoke", { x: 640, y: 300, c: "rgba(120,200,255," }).sfx("teleport");
  s.at(3.8).say("host", "Welcome to the GALAXY GLADIATOR FINALS!", 3).sfx("cheer");
  s.at(7).say("host", "In this corner... CAPTAIN NOVA!", 2.4).show("nova", -100, 1).jump("nova", 330, 1, 260, 1).sfx("cheer");
  s.at(9.6).say("host", "And in THAT corner... ZIX THE DESTROYER!", 2.6).fx("smoke", { x: 950, y: 540, c: "rgba(255,80,200," }).show("zix", 950, -1).sfx("teleport");
  s.at(12.4).cam(1.5, 950, 430, 0.5).say("zix", "Prepare to be... ZIXED!", 2.2);
  s.at(14.7).cam(1.5, 330, 430, 0.5).say("nova", "That's not even a word.", 2.0);
  s.at(16.8).cam(1, 640, 360, 0.4).fx("smoke", { x: 640, y: 330 }).hide("host").sfx("gong").title("FIGHT!", 1.3, null, "#ff3a3a", 150);
  s.at(18).move("nova", 560, 0.45).move("zix", 720, 0.45).sfx("saber");
  s.at(18.5).clash("nova", "zix", 640, 470, 4, 0.36, "saber");
  s.at(20.1).act("zix", "spinkick", 0.5).wait(0.2).hit("nova", -1, 1.1, "kick");
  s.at(21.1).jump("nova", 1020, 0.9, 320, 1).fx("speed", { d: 0.5 });
  s.at(22.1).face("zix", 1).act("nova", "cast", 0.5).proj("energy", "nova", "zix", 0.35, { sound: "laser", color: "#3ad0ff" }).wait(0.35).hit("zix", -1, 0.9, "zap", "ZAP!");
  s.at(23.4).cam(1.4, 720, 430, 0.4).say("zix", "Grrr! CLONE ATTACK!", 1.8).act("zix", "taunt", 0.8);
  s.at(24.8).cam(1, 640, 360, 0.3).fx("smoke", { x: 1250, y: 540, c: "rgba(255,80,200," }).show("zix2", 1250, -1).sfx("teleport");
  s.at(25.3).move("zix", 900, 0.4).move("zix2", 1130, 0.4).face("nova", -1);
  s.at(25.75).act("nova", "slash", 0.35).fx("slash", { x: 940, y: 450, dir: -1 }).hit("zix", -1, 0.8, "saber");
  s.at(26.15).face("nova", 1).act("nova", "slash", 0.35).fx("slash", { x: 1100, y: 450, dir: 1 }).wait(0.12).fx("smoke", { x: 1130, y: 520, c: "rgba(255,80,200," }).hide("zix2").sfx("teleport").fx("text", { x: 1130, y: 380, text: "POOF!", c: "#ff7ad8" });
  s.at(27).face("nova", -1).say("zix", "...uh oh.", 1.3);
  s.at(28.4).act("zix", "point", 1).sfx("gasp").proj("asteroid", [1500, -150], [1020, 560], 1.3, { size: 1.1 });
  s.at(28.9).jump("nova", 420, 0.9, 260, -1);
  s.at(29.7).fx("bigboom", { x: 1020, y: 540 });
  s.at(31.2).move("zix", 880, 0.4).face("nova", 1).face("zix", -1).say("nova", "Time to end this!", 1.7);
  s.at(32.9).act("nova", "charge", 1.2, true).glow("nova", "#3ad0ff").act("zix", "charge", 1.2, true).glow("zix", "#ff3aa0").sfx("powerup").cam(1.1, 640, 400, 0.6);
  s.at(34.2).act("nova", "cast", 2.6, true).act("zix", "cast", 2.6, true).fx("beam", { x: 480, y: 480, x2: 650, y2: 475, c: "#3ad0ff", w: 30, d: 2.2 }).fx("beam", { x: 800, y: 480, x2: 640, y2: 475, c: "#ff3aa0", w: 30, d: 2.2 });
  for (let i = 0; i < 5; i++) s.at(34.2 + i * 0.45).sfx("laser").shake(0.3).fx("sparks", { x: 645, y: 475, c: i % 2 ? "#3ad0ff" : "#ff7ad8" });
  s.at(36.4).fx("beam", { x: 480, y: 480, x2: 880, y2: 470, c: "#3ad0ff", w: 46, d: 0.6 }).sfx("laser").flash("#bfefff");
  s.at(36.7).ko("zix", 1, 1.5).fx("boom", { x: 900, y: 470 }).glow("nova", 0).glow("zix", 0);
  s.at(38).act("nova", "cheer", 1.5, true).show("host", 640, -1, "idle", 360).sfx("teleport").say("host", "WINNER... CAPTAIN NOVA!", 2.6).sfx("cheer").fx("confetti", { x: 640, y: 200 });
  s.at(41).up("zix").say("zix", "I'll be back... NEXT EPISODE!", 2.4);
  s.at(43.5).fx("smoke", { x: 1100, y: 520, c: "rgba(255,80,200," }).hide("zix").sfx("teleport");
  s.at(44).title("THE END", 3.2, "...or is it?");
  return { id: "galaxy", title: "Galaxy Gladiators", tag: "Laser swords. Clone attacks. One asteroid. Who will win the galaxy?", rating: "Talking · Space Action", bg: "space", music: "space", length: 47.5,
    poster: { c1: "#05030f", c2: "#5a1a8a", acc: "#3ad0ff" },
    cast: {
      nova: { name: "Captain Nova", body: "#f2f2f2", pants: "#d8dde3", hat: "helmet", hatC: "#ffffff", plume: "#3ad0ff", armor: "#3a7ad0", weapon: "saber", wc: "#3ad0ff", voice: 1.0 },
      zix: { name: "Zix", kind: "alien", skin: "#7be03a", body: "#6a3ad0", pants: "#3a1a6a", weapon: "saber", wc: "#ff3aa0", cape: "#a01a5a", voice: 0.45, rate: 0.9, scale: 1.1, angry: true },
      zix2: { kind: "alien", skin: "#7be03a", body: "#6a3ad0", pants: "#3a1a6a", weapon: "saber", wc: "#ff3aa0", cape: "#a01a5a", scale: 1.1, angry: true },
      host: { name: "Announcer Bot", kind: "robot", body: "#ffd23a", pants: "#b0901a", scale: 0.75, eye: "#3ad0ff", voice: 1.9, rate: 1.15 },
    }, events: s.events };
}

// ---------------------------------------------------------------- 4. THE DRAGON OF MOUNT EMBER (epic + funny)
function dragon() {
  const s = new Script();
  s.at(0).title("THE DRAGON OF MOUNT EMBER", 3.5, "An Epic Tale", "#ff7a1a", 82);
  s.at(3.5).show("knight", -60, 1).walk("knight", 330, 2.2);
  s.at(6).cam(1.4, 330, 440, 0.5).say("knight", "Foul beast! Come out and face SIR CLANK!", 2.8);
  s.at(9).cam(0.85, 700, 330, 0.8).sfx("roar").shake(0.6).show("drago", 1600, -1).walk("drago", 950, 1.6);
  for (let i = 0; i < 4; i++) s.at(9.2 + i * 0.4).sfx("thud").shake(0.35);
  s.at(10.9).act("drago", "roar", 1.5).sfx("roar").shake(0.8).act("knight", "block", 1.4);
  s.at(12.6).cam(1.5, 330, 440, 0.4).say("knight", "...it's bigger than the drawing.", 2.4).sfx("crowdlaugh");
  s.at(15.2).cam(0.9, 640, 360, 0.4).act("drago", "fire", 1.7).sfx("fire").fx("fire", { x: 725, y: 320, x2: 360, y2: 500, d: 1.5 }).act("knight", "block", 1.7);
  s.at(15.6).sfx("fire").fx("sparks", { x: 370, y: 480, c: "#ffb02a" });
  s.at(17.2).move("knight", 650, 0.55).sfx("horn");
  s.at(17.8);
  for (let i = 0; i < 2; i++) s.act("knight", "slash", 0.35).wait(0.15).fx("slash", { x: 730, y: 450 }).hit("drago", 1, 0.1, "clang", "CLANK!").wait(0.25);
  s.at(18.9).act("drago", "tail", 0.9).wait(0.4).ko("knight", -1, 1.4).sfx("thud");
  s.at(20.6).up("knight").say("knight", "Is that ALL you've got?!", 2.0);
  s.at(22.8).move("knight", 690, 0.6).wait(0.55).jump("knight", 880, 0.8, 140, 0, "jump", { y: 330 });
  s.at(23.9);
  for (let i = 0; i < 3; i++) s.act("knight", "slash", 0.3).wait(0.14).sfx("bonk").hit("drago", 1, 0.05, "bonk", "BONK!").wait(0.18);
  s.at(25.4).fx("stars", { who: "drago", d: 2.4 }).jump("knight", 560, 0.7, 120, 1, "jump", { y: 600 });
  s.at(26.5).ko("drago", 1, 0.25).sfx("thud").fx("dust", { x: 1000, y: G });
  s.at(27.8).walk("knight", 740, 1).act("knight", "cheer", 1.6).say("knight", "VICTORY is mine!", 2).sfx("cheer");
  s.at(30.2).up("drago").mood("drago", "sad").say("drago", "...I just wanted a friend...", 2.8);
  s.at(33.2).cam(1.4, 740, 430, 0.5).act("knight", "shrug", 1.4).say("knight", "...a friend?", 1.6);
  s.at(35).cam(1, 640, 360, 0.5).walk("knight", 790, 0.6).act("knight", "hug", 2.4).mood("drago", "happy").fx("hearts", { x: 870, y: 360 }).sfx("sparkle");
  s.at(35.8).say("knight", "Well... I DO need a ride home.", 2.4);
  s.at(38.4).say("drago", "Ah... ah... AH-CHOO!", 1.6).act("drago", "fire", 0.9);
  s.at(39.3).fx("fire", { x: 725, y: 320, x2: 790, y2: 470, d: 0.7 }).sfx("fire").look("knight", { mustache: null }).fx("smoke", { x: 790, y: 420 });
  s.at(40.3).cam(1.6, 790, 440, 0.4).mood("knight", "hurt").say("knight", "...my mustache.", 2).sfx("crowdlaugh");
  s.at(42.6).cam(1, 640, 360, 0.4).mood("knight", "happy").jump("knight", 930, 0.7, 120, 0, "sit", { y: 400 });
  s.at(43.4).jump("drago", 1900, 3, 360, 0).jump("knight", 2880, 3, 360, 0, "sit", { y: 400 }).sfx("whoosh").sfx("roar");
  s.at(44.5).title("THE END", 3.2, "Ember & Sir Clank: Best Friends Forever");
  return { id: "dragon", title: "The Dragon of Mount Ember", tag: "A brave knight. A giant dragon. A very unexpected friendship.", rating: "Talking · Epic Comedy", bg: "volcano", music: "epic", length: 48,
    poster: { c1: "#2a0a0a", c2: "#c0302a", acc: "#ff7a1a" },
    cast: {
      knight: { name: "Sir Clank", body: "#9aa4ae", pants: "#6a727c", hat: "helmet", hatC: "#c8ccd2", plume: "#e0302a", armor: "#c8ccd2", weapon: "sword", shield: "#2a5ad0", mustache: "#8a5a2a", voice: 0.9 },
      drago: { name: "Ember the Dragon", kind: "dragon", body: "#c0302a", belly: "#ffb03a", voice: 0.25, rate: 0.85 },
    }, events: s.events };
}

// ---------------------------------------------------------------- 5. KITCHEN KUNG FU (talking, silly)
function kitchen() {
  const s = new Script();
  s.at(0).title("KITCHEN KUNG FU", 3.2, "Who makes the best spaghetti?", "#ff5a3a");
  s.at(0.3).show("judge", 640, 1, "idle").show("noodle", 300, 1).show("bag", 980, -1);
  s.at(3.4).cam(1.4, 640, 420, 0.5).say("judge", "Chefs! You have ONE minute to make the perfect spaghetti!", 3.4).sfx("bell");
  s.at(7).cam(1.4, 300, 430, 0.4).say("noodle", "My sauce is the best in the WORLD!", 2.4);
  s.at(9.6).cam(1.4, 980, 430, 0.4).say("bag", "Ha! Your sauce tastes like KETCHUP!", 2.5);
  s.at(12.3).cam(1, 640, 360, 0.4).mood("noodle", "angry").say("noodle", "Take that BACK!", 1.6).sfx("gasp");
  s.at(14).act("noodle", "throw", 0.4).proj("tomato", "noodle", "bag", 0.5, { arc: 70, sound: "swing" });
  s.at(14.5).act("bag", "block", 0.5).sfx("bonk").proj("tomato", "bag", "judge", 0.4, { arc: 50 });
  s.at(14.9).hit("judge", -1, 0.2, "splat", "SPLAT!").fx("splat", { x: 640, y: 470, c: "#e0302a" });
  s.at(15.4).say("judge", "...hey.", 1.4).sfx("crowdlaugh");
  s.at(17).walk("judge", 640, 0.1).move("noodle", 520, 0.5).move("bag", 760, 0.5).jump("judge", 640, 0.6, 30);
  s.at(17.2).jump("judge", 640, 0.6, 20).wait(0.1);
  s.at(17.6).clash("noodle", "bag", 640, 460, 4, 0.34, "clang");
  s.at(19.2).act("bag", "throw", 0.5).fx("flour", { x: 540, y: 470 }).sfx("whoosh");
  s.at(19.8).say("noodle", "*cough* I can't SEE!", 1.8);
  s.at(21.8).jump("noodle", 980, 0.8, 260, 1).fx("speed", { d: 0.4 });
  s.at(22.7).face("bag", 1).act("noodle", "slash", 0.4).wait(0.15).hit("bag", -1, 1, "bonk", "CLANG!");
  s.at(23.8).act("bag", "throw", 0.4).proj("noodles", "bag", "noodle", 0.4, { sound: "swing" }).wait(0.4).hit("noodle", 1, 0.6, "splat", "SLURP!").say("noodle", "Not the NOODLES!", 1.6);
  s.at(25.6).combo("noodle", "bag", 3, 0.3, -1);
  s.at(27).mood("noodle", "normal").say("judge", "ENOUGH! Where is the SPAGHETTI?!", 2.8).cam(1.3, 640, 420, 0.4);
  s.at(29.9).cam(1, 640, 360, 0.4).act("noodle", "shrug", 1.4).act("bag", "shrug", 1.4).say("noodle", "...oops.", 1.3);
  s.at(31.6).sfx("thud").shake(0.4).proj("meatball", [-220, 520], [1550, 520], 2.6).sfx("gasp");
  for (let i = 0; i < 5; i++) s.at(31.8 + i * 0.5).sfx("thud").shake(0.3);
  s.at(32.5).jump("noodle", 980, 0.9, 240, 0, "jump");
  s.at(32.75).jump("judge", 640, 0.9, 260, 0, "jump").say("judge", "WHOA!", 1, true).sfx("boing");
  s.at(32.9).jump("bag", 760, 0.9, 250, 1);
  s.at(35.2).mood("judge", "happy").say("judge", "...that meatball was DELICIOUS. You BOTH win!", 3).sfx("cheer").fx("confetti", { x: 640, y: 200 });
  s.at(38.4).base("noodle", "dance").base("bag", "dance").base("judge", "dance").sfx("cheer");
  s.at(39.5).title("THE END", 3, "Don't forget to wash your hands");
  return { id: "kitchen", title: "Kitchen Kung Fu", tag: "Frying pans. Flour bombs. A giant meatball. Dinner is SERVED.", rating: "Talking · Food Fight Comedy", bg: "kitchen", music: "kitchen", length: 43,
    poster: { c1: "#fff3e0", c2: "#e0302a", acc: "#ff5a3a" },
    cast: {
      noodle: { name: "Chef Noodle", body: "#ffffff", pants: "#2a2a2e", hat: "chef", apron: "#e0302a", weapon: "pan", mustache: "#1a1a1a", voice: 1.25 },
      bag: { name: "Chef Baguette", body: "#ffffff", pants: "#3a3a6a", hat: "chef", apron: "#2a6ad0", weapon: "spoon", mustache: "#d8a040", voice: 0.8, scale: 1.1 },
      judge: { name: "Judge Gravy", body: "#6a3ad0", pants: "#2a1a3a", hair: "#b0b0b0", glasses: true, voice: 0.6, rate: 0.95, scale: 1.15 },
    }, events: s.events };
}

// ---------------------------------------------------------------- 6. DOJO DUEL (almost no talking, martial arts)
function dojo() {
  const s = new Script();
  s.at(0).title("DOJO DUEL", 3, "The Battle for the Golden Belt", "#ffd23a");
  s.at(0.3).show("wu", 640, 1, "sit").show("kai", 330, 1).show("shadow", 950, -1);
  s.at(3.2).cam(1.5, 640, 470, 0.5).say("wu", "Only one can wear... the GOLDEN BELT.", 3.2).sfx("gong");
  s.at(6.6).cam(1, 640, 360, 0.5).act("kai", "bow", 0.9).act("shadow", "bow", 0.9).walk("wu", 640, 0.1);
  s.at(7.2).jump("wu", 640, 0.8, 120, 0, "sit", { y: 380 }).e("float", { who: "wu", v: 1 });
  s.at(7.8).title("FIGHT!", 1.2, null, "#ff3a3a", 150).sfx("bell");
  s.at(8.4).act("kai", "guard", 0.5, true).act("shadow", "guard", 0.5, true).move("kai", 560, 0.4).move("shadow", 720, 0.4);
  s.at(9).combo("kai", "shadow", 3, 0.28, 1);
  s.at(10).act("shadow", "block", 0.5).sfx("slap").combo("shadow", "kai", 3, 0.28, -1);
  s.at(11.9).act("kai", "spinkick", 0.55).wait(0.25).hit("shadow", 1, 1.3, "kick", "WHAP!");
  s.at(12.9).jump("shadow", 1050, 0.7, 220, -1, "jump", { keepFace: true });
  s.at(13.9);
  for (let i = 0; i < 2; i++) s.act("shadow", "throw", 0.3).proj("shuriken", "shadow", "kai", 0.3, { sound: "swing" }).wait(0.28).act("kai", "block", 0.3).sfx("clang").fx("sparks", { x: 680, y: 470 }).wait(0.15);
  s.at(15.2).move("kai", 880, 0.35).fx("speed", { d: 0.4 }).wait(0.3).jump("kai", 950, 0.45, 70, 0, "flykick");
  s.at(15.95).hit("shadow", 1, 1.6, "kick", "HI-YAH!").shake(0.5);
  s.at(16.8).cam(1.5, 1040, 450, 0.4).slow(0.3, 1.2).move("shadow", 1100, 0.2);
  s.at(17.1).act("kai", "punch", 0.5).act("shadow", "punch", 0.5).wait(0.18).hit("kai", -1, 0.8).hit("shadow", 1, 0.8).flash();
  s.at(18.4).cam(1.05, 900, 380, 0.6).act("kai", "charge", 1.3, true).glow("kai", "#3ad0ff").act("shadow", "charge", 1.3, true).glow("shadow", "#ff3a3a").sfx("powerup").fx("lightning", { x: 900, y: 560 });
  s.at(19.8).act("kai", "cast", 2.8, true).act("shadow", "cast", 2.8, true);
  s.at(19.8).fx("beam", { x: 870, y: 480, x2: 1010, y2: 478, c: "#3ad0ff", w: 28, d: 2.4 }).fx("beam", { x: 1150, y: 480, x2: 1000, y2: 478, c: "#ff3a3a", w: 28, d: 2.4 });
  for (let i = 0; i < 5; i++) s.at(19.8 + i * 0.48).sfx("laser").shake(0.3).fx("sparks", { x: 1005, y: 478, c: i % 2 ? "#3ad0ff" : "#ff6a6a" });
  s.at(20.6).say("wu", "Believe in yourself, Kai!", 2.2);
  s.at(22.3).fx("beam", { x: 870, y: 480, x2: 1170, y2: 470, c: "#3ad0ff", w: 44, d: 0.6 }).sfx("laser").flash("#bfefff");
  s.at(22.6).ko("shadow", 1, 1.2).fx("boom", { x: 1170, y: 470 }).glow("kai", 0).glow("shadow", 0);
  s.at(24.2).cam(1, 640, 360, 0.6).jump("wu", 760, 0.7, 120, 0, "jump", { y: 600 }).e("float", { who: "wu", v: 0 });
  s.at(25.2).say("wu", "The Golden Belt... is yours, Kai.", 2.4).look("kai", { belt: "#ffd23a" }).fx("sparks", { x: 880, y: 540, c: "#ffd23a" }).sfx("ding").sfx("sparkle");
  s.at(27.7).act("kai", "cheer", 1.6).fx("confetti", { x: 880, y: 200 }).sfx("cheer");
  s.at(29.4).up("shadow").walk("shadow", 1060, 0.4).act("shadow", "bow", 1).act("kai", "bow", 1).say("kai", "Good fight.", 1.6);
  s.at(31.2).say("shadow", "...rematch. Next week.", 2.1);
  s.at(33.4).title("THE END", 3, "Kai: Golden Belt Champion");
  return { id: "dojo", title: "Dojo Duel", tag: "Two fighters. One golden belt. Lasers? Yes. Lasers.", rating: "Little talking · Martial Arts", bg: "dojo", music: "action", length: 36.5,
    poster: { c1: "#f0dcb0", c2: "#8a2a1a", acc: "#ffd23a" },
    cast: {
      kai: { name: "Kai", body: "#ff7a1a", pants: "#ff7a1a", belt: "#1a1a1a", hat: "headband", band: "#ffffff", hair: "#1a1a1a", skin: "#e9b48a", voice: 1.15 },
      shadow: { name: "Shadow", body: "#3a1a5a", pants: "#3a1a5a", belt: "#1a1a1a", mask: "#1a1020", eyeC: "#ff3a3a", angry: true, voice: 0.6 },
      wu: { name: "Master Wu", body: "#c8a060", pants: "#8a6a3a", beard: "#ffffff", hair: "#ffffff", scale: 0.8, voice: 0.7, rate: 0.85, weapon: "staff", wc: "#ffd23a" },
    }, events: s.events };
}

export const FILMS = [rooftop(), grandma(), galaxy(), dragon(), kitchen(), dojo()];
export const filmById = (id) => FILMS.find((f) => f.id === id);
