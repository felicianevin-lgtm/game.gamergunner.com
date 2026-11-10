// The play page for a PUBLISHED player game: create/play.html?g=<id>. Loads the game from the relay (publish.js),
// shows its title and maker, then runs it with the same Play code as the studio's play test (play.js).
// Exit (or Esc) goes back to the game's page on the home page.
import { createWorld } from "./world.js";
import { sanitize } from "./game.js";
import { startPlay } from "./play.js";
import { api, newCode } from "./net.js";
import { useFiles } from "./files.js";

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("g") || "";
// A friend's private server from a shared link (?code=12345), or picked under "Play with friends"
let server = /^\d{5}$/.test(new URLSearchParams(location.search).get("code") || "") ? { code: new URLSearchParams(location.search).get("code") } : null;
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
  $("btnStart").classList.remove("hidden"); $("friends").classList.remove("hidden");
  if (server) $("btnStart").textContent = "▶ Join your friend's server (" + server.code + ")";
  $("btnStart").focus();
}).catch(() => fail("Couldn't reach GunnerVerse. Check your internet."));

function start() {
  if (!game || playing) return;
  $("loading").classList.add("hidden");
  playing = startPlay(world, sanitize(JSON.parse(JSON.stringify(game))), { onStop(again) { playing = null; if (again) start(); else location.href = back; }, live: id, server }); // (live: play together, others.js)
  if (server && server.create) server = { code: playing.code || server.code }; // ("Try again" goes back to the same private server) // (again: "Try again" after losing)
}
$("btnStart").onclick = start;
// Play with friends: make a private server (a new code) or join one by its code
$("btnFriends").onclick = () => { $("friendsBox").classList.toggle("hidden"); $("codeIn").focus(); };
$("btnMake").onclick = () => { server = { code: newCode(), create: true }; start(); };
$("joinForm").onsubmit = (e) => {
  e.preventDefault();
  const c = $("codeIn").value.replace(/\D/g, "");
  if (c.length !== 5) { $("codeIn").value = ""; $("codeIn").placeholder = "Codes have 5 numbers"; return; }
  server = { code: c }; start();
};

const clock = { last: performance.now() };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - clock.last) / 1000, 0.05); clock.last = now;
  world.resize();
  if (playing) playing.update(dt);
  world.renderer.render(world.scene, world.camera);
}
requestAnimationFrame(frame);
