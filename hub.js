// GunnerVerse home page: the games list, search, the player's account (top right) and the game pages.
// Talks to the relay's /hub/* routes (relay/src/index.js). The account is shared with the game through
// localStorage "gg_account" = {u, t, d} (see unity/Assets/Plugins/WebGL/GGAccount.jslib): sign up here or in the game.
// Pages (in the address after #): #/  #/game/<id>  #/search/<words>  #/friends  #/create  #/me
// Testing on this computer: add ?relay=http://localhost:8788 to use the local relay (it's kept while you click around).
(function () {
  "use strict";
  var PROD_RELAY = "https://gamergunner-relay.gamergunner-relay.workers.dev";
  var relayParam = new URLSearchParams(location.search).get("relay");
  try { if (relayParam) sessionStorage.setItem("gg_relay", relayParam); else relayParam = sessionStorage.getItem("gg_relay"); } catch (e) {}
  var RELAY = (relayParam || PROD_RELAY).replace(/^ws/, "http").replace(/\/$/, "");

  var USER_RE = /^[A-Za-z0-9_]{3,16}$/, DISPLAY_RE = /^[A-Za-z0-9 _'\-]{1,16}$/;
  var COLORS = ["#1fae45", "#f0280f", "#2f7df6", "#ffc531", "#a64bf4", "#ff7a1a", "#13c4c4", "#ff4fa3"];

  var main = document.getElementById("main");
  var accountBox = document.getElementById("account");
  var modal = document.getElementById("modal"), modalBox = document.getElementById("modalBox");
  var searchInput = document.getElementById("search");

  var games = [], playing = {}, loaded = false, loadError = "";
  var me = readAccount(), liked = {}, banned = false;

  // ---------------------------------------------------------------- helpers
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function short(n) { n = n || 0; return n >= 1e6 ? (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, "") + "M" : n >= 1000 ? (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, "") + "K" : String(n); }
  function api(path, body) {
    return fetch(RELAY + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json(); });
  }
  function withRelay(url) { return relayParam ? url + (url.indexOf("?") < 0 ? "?" : "&") + "relay=" + encodeURIComponent(relayParam) : url; }

  function readAccount() {
    try {
      var a = JSON.parse(localStorage.getItem("gg_account") || "null");
      if (a && USER_RE.test(a.u) && /^[0-9a-f]{16,64}$/.test(a.t)) return { u: a.u, t: a.t, d: DISPLAY_RE.test(a.d || "") ? a.d : "" };
    } catch (e) {}
    return null;
  }
  function saveAccount(a) {
    me = a;
    try { if (a) localStorage.setItem("gg_account", JSON.stringify({ u: a.u, t: a.t, d: a.d || "" })); else localStorage.removeItem("gg_account"); } catch (e) {}
    drawAccount();
  }
  function myColor() {
    var c = -1;
    try { c = parseInt(localStorage.getItem("gg_hub_color"), 10); } catch (e) {}
    if (!(c >= 0 && c < COLORS.length) && me) { c = 0; for (var i = 0; i < me.u.length; i++) c = (c * 31 + me.u.charCodeAt(i)) % COLORS.length; }
    return COLORS[c >= 0 ? c : 0];
  }
  function avatar(name, color, big) {
    return '<span class="avatar' + (big ? " big" : "") + '" style="background:' + color + '">' + esc((name || "?").charAt(0).toUpperCase()) + "</span>";
  }
  function shownName() { return me ? (me.d || me.u) : ""; }

  // ---------------------------------------------------------------- account (top right)
  function drawAccount() {
    if (!me) {
      accountBox.innerHTML = '<button class="btn" id="signupBtn" type="button">Sign up</button>';
      document.getElementById("signupBtn").onclick = function () { openSignup(); };
      return;
    }
    accountBox.innerHTML = '<button class="me-chip" id="meChip" type="button" aria-label="Your account">' + avatar(shownName(), myColor()) +
      '<span class="me-name"><b>' + esc(shownName()) + "</b><small>@" + esc(me.u) + "</small></span></button>";
    document.getElementById("meChip").onclick = function () { location.hash = "#/me"; };
  }

  function checkAccount() {
    if (!me) return;
    api("/hub/me", { t: me.t }).then(function (r) {
      if (r.ok) {
        liked = {}; (r.liked || []).forEach(function (id) { liked[id] = 1; });
        banned = !!r.b;
        if (r.u && r.u !== me.u) saveAccount({ u: r.u, t: me.t, d: me.d });
        route();
      } else if (r.e === "signin") { // the relay doesn't know this account any more (same as the game's "unknown")
        saveAccount(null);
        route();
      }
    }).catch(function () {});
  }

  function openModal(html) {
    modalBox.innerHTML = html;
    modal.classList.remove("hidden");
    var first = modalBox.querySelector("input, button");
    if (first) first.focus();
  }
  function closeModal() { modal.classList.add("hidden"); modalBox.innerHTML = ""; }
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });

  function openSignup(why) {
    openModal(
      '<h2 id="modalTitle">Join GunnerVerse</h2>' +
      "<p>" + esc(why || "Pick a username to like games, and soon to add friends and make your own games.") + "</p>" +
      '<form id="signupForm">' +
      '<label class="field"><span>Username</span><input id="suUser" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="like GG_Fan_22">' +
      "<small>3 to 16 letters, numbers or _. You can't change it later. Don't use your real name.</small></label>" +
      '<label class="field"><span>Display name</span><input id="suDisplay" maxlength="16" autocomplete="off" placeholder="what people see">' +
      "<small>You can change this any time.</small></label>" +
      '<p class="err" id="suErr" role="alert"></p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="suCancel">Cancel</button><button class="btn" id="suGo">Create account</button></div>' +
      "</form>" +
      '<p style="margin:14px 0 0">Already playing GunnerVerse on this device? Your username from the game shows up here by itself after you open the game once.</p>');
    document.getElementById("suCancel").onclick = closeModal;
    document.getElementById("signupForm").onsubmit = function (e) {
      e.preventDefault();
      var u = document.getElementById("suUser").value.trim(), d = document.getElementById("suDisplay").value.trim();
      var err = document.getElementById("suErr"), go = document.getElementById("suGo");
      if (!USER_RE.test(u)) { err.textContent = "Usernames are 3 to 16 letters, numbers or _ (no spaces)."; return; }
      if (d && !DISPLAY_RE.test(d)) { err.textContent = "Display names can use letters, numbers, spaces, ' and -."; return; }
      err.textContent = ""; go.disabled = true; go.textContent = "Checking…";
      api("/claim", { u: u }).then(function (r) {
        go.disabled = false; go.textContent = "Create account";
        if (r.ok) { saveAccount({ u: r.u, t: r.t, d: d || r.u }); closeModal(); checkAccount(); route(); return; }
        err.textContent = {
          taken: "Somebody already has that username. Try another one!",
          bad: "Usernames are 3 to 16 letters, numbers or _ (no spaces).",
          badname: "That username isn't allowed. Try another one.",
          banned: "This device can't make new accounts.",
          slowdown: "Too many tries. Wait a minute and try again.",
        }[r.e] || "Something went wrong. Try again.";
      }).catch(function () {
        go.disabled = false; go.textContent = "Create account";
        err.textContent = "Couldn't reach GunnerVerse. Check your internet and try again.";
      });
    };
  }

  function openEditProfile() {
    var cur = COLORS.indexOf(myColor());
    openModal(
      '<h2 id="modalTitle">Edit profile</h2><p>Your username is <b>@' + esc(me.u) + "</b> (that one stays the same).</p>" +
      '<form id="edForm"><label class="field"><span>Display name</span><input id="edDisplay" maxlength="16" value="' + esc(me.d || "") + '"></label>' +
      '<div class="field"><span>Color</span><div class="colors" id="edColors">' +
      COLORS.map(function (c, i) { return '<button type="button" data-i="' + i + '" aria-label="Color ' + (i + 1) + '" class="' + (i === cur ? "on" : "") + '" style="background:' + c + '"></button>'; }).join("") +
      '</div></div><p class="err" id="edErr" role="alert"></p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="edCancel">Cancel</button><button class="btn">Save</button></div></form>');
    var pick = cur;
    Array.prototype.forEach.call(document.querySelectorAll("#edColors button"), function (b) {
      b.onclick = function () { pick = +b.getAttribute("data-i"); Array.prototype.forEach.call(document.querySelectorAll("#edColors button"), function (x) { x.classList.toggle("on", x === b); }); };
    });
    document.getElementById("edCancel").onclick = closeModal;
    document.getElementById("edForm").onsubmit = function (e) {
      e.preventDefault();
      var d = document.getElementById("edDisplay").value.trim();
      if (d && !DISPLAY_RE.test(d)) { document.getElementById("edErr").textContent = "Display names can use letters, numbers, spaces, ' and -."; return; }
      try { localStorage.setItem("gg_hub_color", String(pick)); } catch (x) {}
      saveAccount({ u: me.u, t: me.t, d: d || me.u });
      closeModal(); route();
    };
  }

  // ---------------------------------------------------------------- games
  function loadGames() {
    return api("/hub/games").then(function (r) {
      if (!r.ok) throw new Error("bad");
      games = r.games || []; playing = r.playing || {}; loaded = true; loadError = "";
    }).catch(function () {
      loadError = "Couldn't load the games. Check your internet and refresh.";
      if (!games.length) games = [{ id: "gunnerverse", title: "GunnerVerse", by: "GamerGunner", official: 1, url: "play/", thumb: "img/games/gunnerverse.jpg", desc: "The giant open world by Gamer Gunner." }];
      loaded = true;
    });
  }
  function find(id) { for (var i = 0; i < games.length; i++) if (games[i].id === id) return games[i]; return null; }
  function thumb(g, cls) {
    return '<img class="' + (cls || "thumb") + '" src="' + esc(g.thumb || "img/share.jpg") + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/share.jpg\'">';
  }
  function statsLine(g) {
    var p = playing[g.id] || 0;
    return '<div class="stats">' + (p ? '<span><span class="live-dot"></span><b>' + short(p) + "</b> playing</span>" : "") +
      '<span>👍 <b>' + short(g.likes) + "</b></span><span>▶ <b>" + short(g.plays) + "</b> plays</span></div>";
  }
  function card(g) {
    return '<a class="card" href="#/game/' + esc(g.id) + '">' + thumb(g) + '<div class="card-body"><div class="card-title">' + esc(g.title) + "</div>" +
      '<div class="card-by">by @' + esc(g.by) + (g.official ? '<span class="badge">✔ Official</span>' : "") + "</div>" + statsLine(g) + "</div></a>";
  }
  var createCard = '<div class="card soon"><div class="big-icon">✚</div><b>Your game here</b><span>Build your own game in the Create studio and publish it for everyone. Coming soon!</span></div>';

  function play(g) {
    api("/hub/play", { g: g.id }).catch(function () {});
    setTimeout(function () { location.href = withRelay(g.url); }, 120); // (give the play count a moment to go out)
  }
  function like(g, btn) {
    if (!me) { openSignup("Make a username so you can like games."); return; }
    if (banned) return;
    var on = !liked[g.id];
    btn.disabled = true;
    api("/hub/like", { g: g.id, t: me.t, on: on ? 1 : 0 }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { if (r.e === "signin") { saveAccount(null); openSignup("Please make a username again."); } return; }
      if (on) liked[g.id] = 1; else delete liked[g.id];
      g.likes = r.likes;
      route();
    }).catch(function () { btn.disabled = false; });
  }

  // ---------------------------------------------------------------- pages
  function setNav(which) {
    Array.prototype.forEach.call(document.querySelectorAll(".side a[data-nav]"), function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === which); });
  }

  function pageHome() {
    setNav("home");
    if (!loaded) { main.innerHTML = '<p class="empty">Loading games…</p>'; return; }
    var feat = games.filter(function (g) { return g.official; })[0] || games[0];
    var html = "";
    if (me) html += '<p class="hello">Hey, ' + esc(shownName()) + "!</p>" + '<p class="hello-sub">What are we playing today?</p>';
    if (banned) html += '<p class="err">This account is banned, so it can\'t like games or play online.</p>';
    if (loadError) html += '<p class="err">' + esc(loadError) + "</p>";
    if (feat) {
      html += '<section class="feature">' + thumb(feat, "") + '<div class="feature-text"><span class="tag">Featured</span><h1>' + esc(feat.title) + "</h1><p>" + esc(feat.desc) + "</p>" +
        statsLine(feat) + '<div class="actions"><button class="btn big" id="featPlay" type="button">▶ Play</button><a class="btn big ghost" href="#/game/' + esc(feat.id) + '">More</a></div></div></section>';
    }
    var byPlays = games.slice().sort(function (a, b) { return (b.plays || 0) - (a.plays || 0); });
    if (games.length >= 4) {
      html += '<h2 class="row-title">Popular</h2><div class="grid">' + byPlays.slice(0, 12).map(card).join("") + "</div>";
      var byNew = games.slice().sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
      html += '<h2 class="row-title">New</h2><div class="grid">' + byNew.slice(0, 12).map(card).join("") + "</div>";
    } else {
      html += '<h2 class="row-title">All games</h2><div class="grid">' + byPlays.map(card).join("") + createCard + "</div>";
    }
    var made = games.filter(function (g) { return !g.official; });
    if (games.length >= 4) html += '<h2 class="row-title">Made by players</h2><div class="grid">' + made.slice(0, 12).map(card).join("") + createCard + "</div>";
    html += '<footer class="foot"><a href="about.html">About GunnerVerse</a><a href="about.html#parents">For parents</a>' +
      '<a href="https://gamergunner.com" target="_blank" rel="noopener">Merch shop</a><a href="https://www.youtube.com/@GamerGunner" target="_blank" rel="noopener">YouTube</a>' +
      "<span>© " + new Date().getFullYear() + " Gamer Gunner</span></footer>";
    main.innerHTML = html;
    var fp = document.getElementById("featPlay");
    if (fp) fp.onclick = function () { play(feat); };
  }

  function pageGame(id) {
    setNav("");
    if (!loaded) { main.innerHTML = '<p class="empty">Loading…</p>'; return; }
    var g = find(id);
    if (!g) { main.innerHTML = '<a class="back" href="#/">← All games</a><p class="empty">We couldn\'t find that game. It might have been removed.</p>'; return; }
    var on = !!liked[g.id];
    main.innerHTML = '<a class="back" href="#/">← All games</a><div class="game-page"><div>' + thumb(g) + "</div><div>" +
      "<h1>" + esc(g.title) + '</h1><p class="by">by @' + esc(g.by) + (g.official ? '<span class="badge">✔ Official</span>' : "") + "</p>" +
      '<div class="actions"><button class="btn big" id="gPlay" type="button">▶ Play</button>' +
      '<button class="btn big ghost like' + (on ? " on" : "") + '" id="gLike" type="button" aria-pressed="' + on + '">👍 ' + (on ? "Liked" : "Like") + "</button></div>" +
      '<div class="stat-boxes"><div class="stat-box"><b>' + short(playing[g.id] || 0) + '</b><span>playing now</span></div>' +
      '<div class="stat-box"><b>' + short(g.likes) + '</b><span>likes</span></div><div class="stat-box"><b>' + short(g.plays) + "</b><span>plays</span></div></div>" +
      '<p class="desc">' + esc(g.desc) + "</p>" +
      (g.id === "gunnerverse" ? '<p class="desc"><a href="about.html">Controls, everything in the game, and info for parents →</a></p>' : "") +
      "</div></div>";
    document.getElementById("gPlay").onclick = function () { play(g); };
    document.getElementById("gLike").onclick = function () { like(g, this); };
  }

  function pageSearch(q) {
    setNav("");
    if (searchInput.value !== q) searchInput.value = q;
    if (!loaded) { main.innerHTML = '<p class="empty">Loading…</p>'; return; }
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hits = games.filter(function (g) {
      var hay = (g.title + " " + g.by + " " + g.desc).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
    main.innerHTML = '<h2 class="row-title">Results for "' + esc(q) + '" <small>' + hits.length + " game" + (hits.length === 1 ? "" : "s") + "</small></h2>" +
      (hits.length ? '<div class="grid">' + hits.map(card).join("") + "</div>" : '<p class="empty">No games match that yet. Try another word, or check back when players start publishing their own games!</p>');
  }

  function pageSoon(which) {
    setNav(which);
    var info = {
      friends: ["☺", "Friends are coming next", "Add people by their @username, see who's online and what they're playing, jump into their game, and send messages."],
      create: ["✚", "The Create studio is coming", "Build your own 3D game right here with free cars, trees, houses, coins, lava and more, then publish it so everyone can play."],
    }[which];
    main.innerHTML = '<div class="soon-page"><div class="big-icon">' + info[0] + "</div><h1>" + info[1] + "</h1><p>" + info[2] + "</p>" +
      (me ? '<a class="btn" href="#/">Back to games</a>' : '<button class="btn" id="soonSignup" type="button">Sign up now so you\'re ready</button>') + "</div>";
    var b = document.getElementById("soonSignup");
    if (b) b.onclick = function () { openSignup(); };
  }

  function pageMe() {
    setNav("me");
    if (!me) {
      main.innerHTML = '<div class="soon-page"><div class="big-icon">◉</div><h1>Your profile</h1><p>Make a username to get a profile, like games, and soon add friends and publish your own games.</p><button class="btn" id="meSignup" type="button">Sign up</button></div>';
      document.getElementById("meSignup").onclick = function () { openSignup(); };
      return;
    }
    var mine = games.filter(function (g) { return liked[g.id]; });
    main.innerHTML = '<div class="profile-head">' + avatar(shownName(), myColor(), true) + "<div><h1>" + esc(shownName()) + "</h1><p>@" + esc(me.u) + "</p></div></div>" +
      '<div class="actions"><button class="btn ghost" id="meEdit" type="button">Edit profile</button></div>' +
      (banned ? '<p class="err">This account is banned.</p>' : "") +
      '<h2 class="row-title">Games you liked</h2>' + (mine.length ? '<div class="grid">' + mine.map(card).join("") + "</div>" : '<p class="empty">Tap 👍 on a game to save it here.</p>') +
      '<h2 class="row-title">Your games</h2><div class="grid">' + createCard + "</div>" +
      '<p class="hello-sub" style="margin-top:26px">Your account is saved in this browser. Using another device? Pick a different username there for now.</p>';
    document.getElementById("meEdit").onclick = openEditProfile;
  }

  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var parts = h.split("/");
    if (parts[0] !== "search" && searchInput !== document.activeElement) searchInput.value = "";
    if (parts[0] === "game" && parts[1]) pageGame(parts[1]);
    else if (parts[0] === "search") pageSearch(parts.slice(1).join("/"));
    else if (parts[0] === "friends" || parts[0] === "create") pageSoon(parts[0]);
    else if (parts[0] === "me") pageMe();
    else pageHome();
  }

  // ---------------------------------------------------------------- search box
  var searchTimer = 0;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var q = searchInput.value.trim();
      var target = q ? "#/search/" + encodeURIComponent(q) : "#/";
      if (location.hash !== target) history.replaceState(null, "", target), route();
    }, 200);
  });
  document.getElementById("searchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = searchInput.value.trim();
    location.hash = q ? "#/search/" + encodeURIComponent(q) : "#/";
  });

  // ---------------------------------------------------------------- start
  // (Another tab, like the game, may sign up or change the account: pick it up.)
  window.addEventListener("storage", function (e) { if (e.key === "gg_account") { me = readAccount(); drawAccount(); checkAccount(); route(); } });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  drawAccount();
  route();
  loadGames().then(route);
  checkAccount();
})();
