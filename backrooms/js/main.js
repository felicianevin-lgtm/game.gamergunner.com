// THE BACKROOMS (game.gamergunner.com/backrooms/): a first-person escape through four levels.
//   Level 0 the Lobby (maze + the Bacteria) -> the Poolrooms (platforms over water + the Crawler, throw rocks to distract it)
//   -> Level Fun (party rooms + Partygoers) -> the Deep Lobby (big maze + Captain Clark) -> ESCAPE: you win the
//   Backrooms hazmat suit and the Backrooms monster suit for your GunnerVerse avatar.
// The game itself (shared with Backrooms Survival) is in game.js; the levels are in levels.js.
import { run } from "./game.js";
import { LEVELS } from "./levels.js";
run({ levels: LEVELS, saveKey: "gv_backrooms" });
