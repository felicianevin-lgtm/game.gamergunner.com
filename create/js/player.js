// The play page for a PUBLISHED player game: create/play.html?g=<id>. Loads the game from the relay (publish.js),
// shows its title and maker, then runs it with the same Play code as the studio's play test (play.js).
// Exit (or Esc) goes back to the game's page on the home page.
import { createWorld } from "./world.js";
import { sanitize } from "./game.js";
import { startPlay } from "./play.js";
import { api } from "./net.js";
import { useFiles } from "./files.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("g") || "";
const back = "../#/game/" + encodeURIComponent(id);
$("backLink").href = back;

const world = createWorld($("canvas"));
let game = null, playing = null;

function fail(text) { $("loadTitle").textContent = "Oops!"; $("loadErr").textContent = text; }

if (!/^[a-z0-9]{8,16}$/.test(id)) fail("That game link isn't right.");
else api("/hub/game/" + id).then((r) => {
  if (!r.ok) { fail(r.e === "nogame" ? "This game isn't on GunnerVerse anymore." : "The game couldn't load. Try again in a minute."); return; }
  game = sanitize({ ...r.game, id });
  useFiles(game.files, true); // (imported models + pictures come from the relay)
  game.name = r.card.title;
  document.title = r.card.title + " | GunnerVerse";
  $("loadTitle").textContent = r.card.title;
  $("loadBy").textContent = "by @" + r.card.by;
  $("btnStart").classList.remove("hidden");
  $("btnStart").focus();
}).catch(() => fail("Couldn't reach GunnerVerse. Check your internet."));

function start() {
  if (!game || playing) return;
  $("loading").classList.add("hidden");
  playing = startPlay(world, sanitize(JSON.parse(JSON.stringify(game))), { onStop(again) { playing = null; if (again) start(); else location.href = back; } }); // (again: "Try again" after losing)
}
$("btnStart").onclick = start;

const clock = { last: performance.now() };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - clock.last) / 1000, 0.05); clock.last = now;
  world.resize();
  if (playing) playing.update(dt);
  world.renderer.render(world.scene, world.camera);
}
requestAnimationFrame(frame);
