// BACKROOMS SURVIVAL (game.gamergunner.com/backroomsurvival/): The Backrooms, but twelve levels long, and every level
// throws more monsters at you. Only the monsters from The Backrooms: the Bacteria, the Crawler (the water monster),
// the Partygoers and Captain Clark. Mazes, the Poolrooms and the Party Rooms all come back bigger and harder.
// The game itself is shared with The Backrooms (site/backrooms/js/game.js); the level builders are in levels.js there.
import { run } from "/backrooms/js/game.js";
import { mazeBuild, poolBuild } from "/backrooms/js/levels.js";

const L = (sub, goal, build) => ({ sub, goal, build });
const LIST = [
  L("The Lobby", "Find the EXIT. One Bacteria is hunting.", (s) => mazeBuild(s, { W: 11, H: 11, theme: "lobby", mons: { bacteria: 1 }, min: 8 })),
  L("The Long Halls", "Bigger halls. TWO Bacteria now.", (s) => mazeBuild(s, { W: 13, H: 13, theme: "lobby", mons: { bacteria: 2 }, min: 8 })),
  L("The Poolrooms", "TWO Crawlers in the water. Stay on the platforms. Throw rocks to distract them.", (s) => poolBuild(s, { len: 160, crawlers: 2 })),
  L("The Party Rooms  =)", "Three Partygoers want you at their party. Don't let them see you.", (s) => mazeBuild(s, { W: 9, H: 9, theme: "party", mons: { partygoer: 3 }, min: 5 })),
  L("The Dark Halls", "The lights are dying. Two Bacteria and two Partygoers in the dark.", (s) => mazeBuild(s, { W: 14, H: 14, theme: "dark", mons: { bacteria: 2, partygoer: 2 }, min: 8 })),
  L("The Deep Pool", "A longer pool and THREE Crawlers. They are fast. Save your rocks.", (s) => poolBuild(s, { len: 210, crawlers: 3 })),
  L("The Party Never Ends", "Four Partygoers and a Bacteria crashed the party.", (s) => mazeBuild(s, { W: 11, H: 11, theme: "party", mons: { partygoer: 4, bacteria: 1 }, min: 6 })),
  L("Clark's Hallways", "CAPTAIN CLARK is here. Listen for his peg leg. Three Bacteria and two Partygoers too.", (s) => mazeBuild(s, { W: 15, H: 15, theme: "deep", mons: { clark: 1, bacteria: 3, partygoer: 2 }, min: 9 })),
  L("The Red Rooms", "Everything is red. Four Bacteria and three Partygoers.", (s) => mazeBuild(s, { W: 16, H: 16, theme: "red", mons: { bacteria: 4, partygoer: 3 }, min: 9 })),
  L("The Endless Pool", "The longest pool. FOUR Crawlers. Don't. Touch. The water.", (s) => poolBuild(s, { len: 260, crawlers: 4 })),
  L("The Deep Lobby", "Captain Clark, four Bacteria and three Partygoers. RUN.", (s) => mazeBuild(s, { W: 18, H: 18, theme: "deep", mons: { clark: 1, bacteria: 4, partygoer: 3 }, min: 10 })),
  L("The Last Lobby", "The final level. TWO Captain Clarks and everything else. Find the way OUT.", (s) => mazeBuild(s, { W: 20, H: 20, theme: "red", mons: { clark: 2, bacteria: 4, partygoer: 4 }, min: 11, final: true })),
];
export const LEVELS = LIST.map((l, i) => ({ ...l, name: "LEVEL " + (i + 1) + " / " + LIST.length, label: "Level " + (i + 1) + ": " + l.sub.trim() }));

run({ levels: LEVELS, saveKey: "gv_backroomsurvival" });

// ?thumb draws the home-page card picture (site/img/games/backroomsurvival.jpg, a 960x540 screenshot of this page):
// a long hallway in the Deep Lobby with Captain Clark, a Partygoer and a Bacteria coming at you.
if (/[?&]thumb\b/.test(location.search)) thumb();
async function thumb() {
  const BR = window.BR, $ = (id) => document.getElementById(id);
  $("menu").classList.add("hidden"); BR.god = true; BR.frozen = true;
  await BR.startLevel(10);
  $("hud").classList.add("hidden");
  const g = BR.L.grid, mid = (i, j) => [g.x0 + (i + 0.5) * g.cell, g.z0 + (j + 0.5) * g.cell];
  let spot = [0, 0];
  for (let i = 0; i < g.W; i++) for (let j = 0; j < g.H - 3; j++) if (!g.south[i][j] && !g.south[i][j + 1] && !g.south[i][j + 2]) spot = [i, j];
  const [i, j] = spot, [cx, cz] = mid(i, j);
  const clark = BR.mons.find((m) => m.kind === "clark"), party = BR.mons.find((m) => m.kind === "partygoer"), bac = BR.mons.find((m) => m.kind === "bacteria");
  for (const m of BR.mons) { m.walk = m.chase = 0; m.pos.set(cx, 0, cz - 50); }
  clark.pos.set(cx + 0.3, 0, cz + 8.5); party.pos.set(cx - 1.7, 0, cz + 6.5); bac.pos.set(cx + 1.8, 0, cz + 5);
  BR.P.pos.set(cx, 0, mid(i, j + 3)[1] - 0.5); BR.P.yaw = 0; BR.P.pitch = 0.16;
  BR.step(12);
  $("danger").style.opacity = "0";
  const t = document.createElement("div");
  t.innerHTML = "<b>BACKROOMS</b><b>SURVIVAL</b><span>12 LEVELS · MORE MONSTERS EVERY LEVEL</span>";
  t.style.cssText = "position:fixed;left:28px;bottom:22px;font-family:'Russo One',sans-serif;color:#ff6a4a;text-shadow:0 4px 0 #3a0a04,0 0 24px rgba(255,60,30,.6);line-height:.95;z-index:9";
  t.querySelectorAll("b").forEach((b) => (b.style.cssText = "display:block;font-size:64px"));
  t.querySelector("span").style.cssText = "display:block;margin-top:10px;font-size:20px;color:#ffe3c0;text-shadow:0 2px 6px #000";
  document.body.appendChild(t);
  BR.render();
}
