// GunnerVerse home page: the games list, search, the player's account (top right) and the game pages.
// Talks to the relay's /hub/* routes (relay/src/index.js). The account is shared with the game through
// localStorage "gg_account" = {u, t, d} (see unity/Assets/Plugins/WebGL/GGAccount.jslib): sign up here or in the game.
// Pages (in the address after #): #/  #/game/<id>  #/search/<words>  #/friends  #/avatar  #/u/<username>  #/create  #/me  #/admin
// #/avatar (and the avatar pictures) use create/js/avatar-ui.js, loaded when it's needed (it brings the 3D code).
// Player-made games come from GunnerVerse Studio (create/) through the relay's publish.js: they play at
// create/play.html?g=<id>, their pictures live on the relay ("@/hub/thumb/..."), anyone signed in can Report one, and
// #/admin (dev password, not linked anywhere) lists reports and removes games / bans makers.
// Friends (relay social.js): requests by @username, who's online / playing, Join a friend's Sandbox room, Block.
// There are NO private messages on purpose (Felicia, 2026-11-08).
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
  var social = null, socialTimer = 0; // the last /social/state answer (friends, requests, blocked)

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
  // ---------------------------------------------------------------- passwords (relay index.js /login, /setpass)
  // The password becomes a 64-character key HERE (PBKDF2, salted with the username), and only the key is sent.
  var PW_MIN = 6;
  function passKey(u, p) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode("gunnerverse-pw:" + u.toLowerCase()), iterations: 150000, hash: "SHA-256" }, k, 256);
    }).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
  }
  function passProblem(u, p, p2) {
    if (p.length < PW_MIN) return "Passwords need at least " + PW_MIN + " letters or numbers.";
    if (p.length > 64) return "That password is too long.";
    if (p.toLowerCase() === u.toLowerCase()) return "Your password can't be your username.";
    if (p2 != null && p !== p2) return "The two passwords don't match.";
    return "";
  }
  var hasPass = false;
  // Log out: the game (PlayerIdentity.cs) sees {"out":1} and lets go of the account too.
  function logOut() {
    try { localStorage.setItem("gg_account", JSON.stringify({ out: 1 })); localStorage.removeItem("gv_avatar"); } catch (e) {}
    me = null; social = null; liked = {}; banned = false; hasPass = false;
    drawAccount(); drawSide(); location.hash = "#/";
    route();
  }
  function openLogin(back) {
    openModal('<h2 id="modalTitle">Log in</h2><p>Use the username and password you made.</p><form id="liForm">' +
      '<label class="field"><span>Username</span><input id="liUser" maxlength="17" autocomplete="username" autocapitalize="off" spellcheck="false"></label>' +
      '<label class="field"><span>Password</span><input id="liPw" type="password" maxlength="64" autocomplete="current-password"></label>' +
      '<p class="err" id="liErr" role="alert"></p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="liCancel">Cancel</button><button class="btn" id="liGo">Log in</button></div></form>' +
      '<p style="margin:14px 0 0">New here? <a href="#" id="liNew">Make an account</a>. Forgot your password? Ask a grown-up to contact Gamer Gunner\'s team.</p>');
    document.getElementById("liCancel").onclick = closeModal;
    document.getElementById("liNew").onclick = function (e) { e.preventDefault(); openSignup(); };
    document.getElementById("liForm").onsubmit = function (e) {
      e.preventDefault();
      var u = document.getElementById("liUser").value.trim().replace(/^@/, ""), p = document.getElementById("liPw").value;
      var err = document.getElementById("liErr"), go = document.getElementById("liGo");
      if (!USER_RE.test(u)) { err.textContent = "Type your username (3 to 16 letters, numbers or _)."; return; }
      if (!p) { err.textContent = "Type your password."; return; }
      go.disabled = true; go.textContent = "Checking…"; err.textContent = "";
      passKey(u, p).then(function (pw) { return api("/login", { u: u, pw: pw }); }).then(function (r) {
        go.disabled = false; go.textContent = "Log in";
        if (r.ok) {
          try { localStorage.removeItem("gv_avatar"); } catch (x) {} // (your avatar comes from your account)
          hasPass = true;
          saveAccount({ u: r.u, t: r.t, d: r.u }); closeModal();
          if (back) { location.href = withRelay("play/"); return; }
          checkAccount(); location.hash = "#/me"; route();
          return;
        }
        err.textContent = {
          wrong: "That username or password isn't right.", nopass: "That account doesn't have a password yet. Open it on the device where you made it and add one in Profile.",
          locked: "Too many wrong tries. Wait 15 minutes and try again.", banned: "This account is banned.", slowdown: "Too many tries. Wait a minute.",
        }[r.e] || "Something went wrong. Try again.";
      }).catch(function () { go.disabled = false; go.textContent = "Log in"; err.textContent = "Couldn't reach GunnerVerse. Check your internet and try again."; });
    };
    document.getElementById("liUser").focus();
  }
  function openSetPassword() {
    var changing = hasPass;
    openModal('<h2 id="modalTitle">' + (changing ? "Change your password" : "Add a password") + "</h2>" +
      "<p>" + (changing ? "Type your old password, then the new one." : "With a password you can log in to @" + esc(me.u) + " on any computer, tablet or phone.") + '</p><form id="pwForm">' +
      (changing ? '<label class="field"><span>Old password</span><input id="pwOld" type="password" maxlength="64" autocomplete="current-password"></label>' : "") +
      '<label class="field"><span>New password</span><input id="pwNew" type="password" maxlength="64" autocomplete="new-password"><small>At least ' + PW_MIN + " letters or numbers. Don't use one you use anywhere else.</small></label>" +
      '<label class="field"><span>Type it again</span><input id="pwNew2" type="password" maxlength="64" autocomplete="new-password"></label>' +
      '<p class="tip">Write it down somewhere safe, or ask a grown-up to remember it. Never tell it to anyone in a game!</p>' +
      '<p class="err" id="pwErr" role="alert"></p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="pwCancel">Cancel</button><button class="btn" id="pwGo">Save password</button></div></form>');
    document.getElementById("pwCancel").onclick = closeModal;
    document.getElementById("pwForm").onsubmit = function (e) {
      e.preventDefault();
      var p = document.getElementById("pwNew").value, p2 = document.getElementById("pwNew2").value, old = changing ? document.getElementById("pwOld").value : "";
      var err = document.getElementById("pwErr"), go = document.getElementById("pwGo");
      var bad = passProblem(me.u, p, p2);
      if (changing && !old) bad = "Type your old password.";
      if (bad) { err.textContent = bad; return; }
      go.disabled = true; go.textContent = "Saving…"; err.textContent = "";
      Promise.all([passKey(me.u, p), changing ? passKey(me.u, old) : ""]).then(function (k) { return api("/setpass", { t: me.t, pw: k[0], old: k[1] || undefined }); }).then(function (r) {
        go.disabled = false; go.textContent = "Save password";
        if (r.ok) { hasPass = true; closeModal(); openModal('<h2 id="modalTitle">🔒 Password saved!</h2><p>Now you can log in to @' + esc(me.u) + ' anywhere: press <b>Log in</b> at the top and type your username and password.</p><div class="modal-actions"><button class="btn" id="pwOk">OK</button></div>'); document.getElementById("pwOk").onclick = closeModal; route(); return; }
        err.textContent = { wrongold: "Your old password isn't right.", needold: "Type your old password.", locked: "Too many wrong tries. Wait 15 minutes.", signin: "Your account wasn't found.", slowdown: "Too many tries. Wait a minute." }[r.e] || "Something went wrong. Try again.";
      }).catch(function () { go.disabled = false; go.textContent = "Save password"; err.textContent = "Couldn't reach GunnerVerse. Check your internet."; });
    };
  }
  function confirmLogOut() {
    openModal('<h2 id="modalTitle">Log out?</h2>' + (hasPass ? "<p>You can log back in any time with your username and password.</p>" :
      '<p class="err">⚠ @' + esc(me.u) + " doesn't have a password yet. If you log out, you can't get back into it! Add a password first.</p>") +
      '<div class="modal-actions"><button class="btn ghost" id="loNo">Cancel</button>' + (hasPass ? "" : '<button class="btn" id="loPw">Add a password</button>') + '<button class="btn danger" id="loYes">Log out</button></div>');
    document.getElementById("loNo").onclick = closeModal;
    if (document.getElementById("loPw")) document.getElementById("loPw").onclick = openSetPassword;
    document.getElementById("loYes").onclick = function () { closeModal(); logOut(); };
  }
  function myColor() {
    var c = -1;
    try { c = parseInt(localStorage.getItem("gg_hub_color"), 10); } catch (e) {}
    if (!(c >= 0 && c < COLORS.length) && me) { c = 0; for (var i = 0; i < me.u.length; i++) c = (c * 31 + me.u.charCodeAt(i)) % COLORS.length; }
    return COLORS[c >= 0 ? c : 0];
  }
  // A person's avatar picture (their 3D avatar once avatar-ui.js is loaded, otherwise their first letter).
  function avatar(name, color, big, av) {
    var pic = AVM && av ? AVM.avatarPicture(av, big ? 192 : 96, false) : "";
    if (pic) return '<img class="avatar pic' + (big ? " big" : "") + '" alt="" src="' + pic + '">';
    return '<span class="avatar' + (big ? " big" : "") + '" style="background:' + color + '">' + esc((name || "?").charAt(0).toUpperCase()) + "</span>";
  }
  var AVM = null, avLoading = null; // create/js/avatar-ui.js
  function loadAV() {
    if (!avLoading) avLoading = import("./create/js/avatar-ui.js").then(function (m) { AVM = m; return m; }).catch(function () { avLoading = null; return null; });
    return avLoading;
  }
  function hasOwnAvatar() { try { return !!localStorage.getItem("gv_avatar"); } catch (e) { return false; } }
  function myAvatar() { return AVM ? AVM.loadAvatar() : null; }
  var avTimer = 0;
  function sendAvatar(a) { // (to your account, so friends see it; a moment after you stop changing it)
    clearTimeout(avTimer);
    if (!me) return;
    avTimer = setTimeout(function () { api("/social/avatar", { t: me.t, a: a }).catch(function () {}); }, 1200);
  }
  function shownName() { return me ? (me.d || me.u) : ""; }
  function colorFor(u) { var c = 0; u = String(u || "").toLowerCase(); for (var i = 0; i < u.length; i++) c = (c * 31 + u.charCodeAt(i)) % COLORS.length; return COLORS[c]; }
  function personName(p) { return p.d || p.u; }

  // ---------------------------------------------------------------- account (top right)
  function drawAccount() {
    if (!me) {
      accountBox.innerHTML = '<button class="btn ghost" id="loginBtn" type="button">Log in</button><button class="btn" id="signupBtn" type="button">Sign up</button>';
      document.getElementById("signupBtn").onclick = function () { openSignup(); };
      document.getElementById("loginBtn").onclick = function () { openLogin(); };
      return;
    }
    accountBox.innerHTML = '<button class="me-chip" id="meChip" type="button" aria-label="Your account">' + avatar(shownName(), myColor(), false, myAvatar()) +
      '<span class="me-name"><b>' + esc(shownName()) + "</b><small>@" + esc(me.u) + "</small></span></button>";
    document.getElementById("meChip").onclick = function () { location.hash = "#/me"; };
  }

  function checkAccount() {
    if (!me) return;
    api("/hub/me", { t: me.t }).then(function (r) {
      if (r.ok) {
        liked = {}; (r.liked || []).forEach(function (id) { liked[id] = 1; });
        banned = !!r.b; hasPass = !!r.p;
        if (r.u && r.u !== me.u) saveAccount({ u: r.u, t: me.t, d: me.d });
        loadSocial();
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
      "<p>" + esc(why || "Pick a username to like games, add friends and publish your own games.") + "</p>" +
      '<form id="signupForm">' +
      '<label class="field"><span>Username</span><input id="suUser" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="like GG_Fan_22">' +
      "<small>3 to 16 letters, numbers or _. You can't change it later. Don't use your real name.</small></label>" +
      '<label class="field"><span>Display name</span><input id="suDisplay" maxlength="16" autocomplete="off" placeholder="what people see">' +
      "<small>You can change this any time.</small></label>" +
      '<label class="field"><span>Password</span><input id="suPw" type="password" maxlength="64" autocomplete="new-password">' +
      "<small>At least " + PW_MIN + " letters or numbers, so you can log in on other devices. Write it down or ask a grown-up to remember it.</small></label>" +
      '<label class="field"><span>Type the password again</span><input id="suPw2" type="password" maxlength="64" autocomplete="new-password"></label>' +
      '<p class="err" id="suErr" role="alert"></p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="suCancel">Cancel</button><button class="btn" id="suGo">Create account</button></div>' +
      "</form>" +
      '<p style="margin:14px 0 0">Already have an account? <a href="#" id="suLogin">Log in</a>.</p>');
    document.getElementById("suCancel").onclick = closeModal;
    document.getElementById("suLogin").onclick = function (e) { e.preventDefault(); openLogin(); };
    document.getElementById("signupForm").onsubmit = function (e) {
      e.preventDefault();
      var u = document.getElementById("suUser").value.trim(), d = document.getElementById("suDisplay").value.trim();
      var err = document.getElementById("suErr"), go = document.getElementById("suGo");
      if (!USER_RE.test(u)) { err.textContent = "Usernames are 3 to 16 letters, numbers or _ (no spaces)."; return; }
      if (d && !DISPLAY_RE.test(d)) { err.textContent = "Display names can use letters, numbers, spaces, ' and -."; return; }
      var p = document.getElementById("suPw").value, bad = passProblem(u, p, document.getElementById("suPw2").value);
      if (bad) { err.textContent = bad; return; }
      err.textContent = ""; go.disabled = true; go.textContent = "Checking…";
      passKey(u, p).then(function (pw) { return api("/claim", { u: u, pw: pw }); }).then(function (r) {
        go.disabled = false; go.textContent = "Create account";
        if (r.ok) { try { localStorage.removeItem("gv_avatar"); } catch (x) {} hasPass = !!r.p; saveAccount({ u: r.u, t: r.t, d: d || r.u }); closeModal(); checkAccount(); route(); return; }
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
      closeModal(); loadSocial(); route();
    };
  }

  // ---------------------------------------------------------------- friends
  function loadSocial() {
    clearTimeout(socialTimer);
    if (!me || banned) { social = null; drawSide(); return Promise.resolve(); }
    return api("/social/state", { t: me.t, d: me.d || "" }).then(function (r) {
      if (r.ok) {
        social = r;
        if (r.me && r.me.d && me && me.d !== r.me.d && DISPLAY_RE.test(r.me.d)) saveAccount({ u: me.u, t: me.t, d: r.me.d });
        var mine = r.me && r.me.av;
        if (mine && !hasOwnAvatar()) { try { localStorage.setItem("gv_avatar", JSON.stringify(mine)); } catch (e) {} drawAccount(); } // (made on another device)
        else if (!mine && hasOwnAvatar() && AVM) sendAvatar(AVM.loadAvatar());
      }
      else if (r.e === "signin") { saveAccount(null); social = null; }
      drawSide();
      if (location.hash.indexOf("#/friends") === 0 && !modalBusy()) pageFriends();
    }).catch(function () {}).then(function () { socialTimer = setTimeout(loadSocial, document.hidden ? 60000 : 20000); });
  }
  function modalBusy() { return !modal.classList.contains("hidden") || (document.activeElement && document.activeElement.tagName === "INPUT"); }
  function socialDo(path, body, after) {
    body.t = me.t;
    return api("/social/" + path, body).then(function (r) {
      if (!r.ok && r.e === "signin") { saveAccount(null); openSignup("Please make a username again."); return r; }
      return loadSocial().then(function () { if (after) after(r); route(); return r; });
    }).catch(function () { route(); });
  }
  function statusText(f) {
    if (f.st === "game") return '<span class="st on-game"><span class="live-dot"></span>Playing GunnerVerse' + (f.m === "t" ? " (Story)" : "") + "</span>";
    if (f.st === "hub") return '<span class="st on-hub"><span class="hub-dot"></span>Online</span>';
    return '<span class="st off">Offline</span>';
  }
  // The left side: friends online (desktop) + the request count on the Friends button.
  function drawSide() {
    var link = document.querySelector('.side a[data-nav="friends"] span');
    var n = social ? social.in.length : 0;
    if (link) link.innerHTML = "Friends" + (n ? ' <b class="count">' + n + "</b>" : "");
    var box = document.getElementById("sideFriends");
    if (!box) { box = document.createElement("div"); box.id = "sideFriends"; box.className = "side-friends"; document.querySelector(".side a.side-extra").before(box); }
    if (!social) { box.innerHTML = ""; return; }
    var on = social.friends.filter(function (f) { return f.st !== "off"; });
    box.innerHTML = '<div class="side-head">Friends online <small>' + on.length + "</small></div>" +
      (on.length ? on.slice(0, 8).map(function (f) {
        return '<a class="side-friend" href="#/u/' + esc(f.u) + '">' + avatar(personName(f), colorFor(f.u), false, f.av) + "<span><b>" + esc(personName(f)) + "</b>" + statusText(f) + "</span></a>";
      }).join("") : '<p class="side-none">' + (social.friends.length ? "Nobody's on right now." : 'No friends yet. <a href="#/friends">Add some!</a>') + "</p>");
  }
  function joinFriend(f) {
    openModal('<h2 id="modalTitle">Join ' + esc(personName(f)) + "</h2>" +
      "<p>GunnerVerse will open. Tap <b>Play</b>, then pick <b>SANDBOX</b> and you'll join " + esc(personName(f)) + "'s game (room " + esc(f.c) + ").</p>" +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="jCancel">Cancel</button><button type="button" class="btn" id="jGo">▶ Open GunnerVerse</button></div>');
    document.getElementById("jCancel").onclick = closeModal;
    document.getElementById("jGo").onclick = function () {
      api("/hub/play", { g: "gunnerverse" }).catch(function () {});
      setTimeout(function () { location.href = withRelay("play/?join=" + encodeURIComponent(f.c)); }, 120);
    };
  }
  function personRow(f, buttons) {
    return '<div class="person"><a href="#/u/' + esc(f.u) + '" class="person-main">' + avatar(personName(f), colorFor(f.u), false, f.av) +
      "<span><b>" + esc(personName(f)) + "</b><small>@" + esc(f.u) + "</small>" + (f.st ? statusText(f) : "") + "</span></a>" +
      '<div class="person-btns">' + buttons + "</div></div>";
  }
  function btn(label, act, u, ghost) { return '<button type="button" class="btn small' + (ghost ? " ghost" : "") + '" data-act="' + act + '" data-u="' + esc(u) + '">' + label + "</button>"; }
  function wireButtons(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function (b) {
      b.onclick = function () {
        var act = b.getAttribute("data-act"), u = b.getAttribute("data-u");
        if (act === "join") { var f = ((social && social.friends) || []).filter(function (x) { return x.u === u; })[0]; if (f && f.c) joinFriend(f); return; }
        if (act === "unfriend" || act === "block") { confirmAct(act, u); return; }
        b.disabled = true;
        socialDo(act, { u: u });
      };
    });
  }
  function confirmAct(act, u) {
    var text = act === "block" ? "Block @" + u + "? They won't be your friend anymore and can't send you friend requests." : "Remove @" + u + " from your friends?";
    openModal('<h2 id="modalTitle">' + (act === "block" ? "Block" : "Unfriend") + "</h2><p>" + esc(text) + "</p>" +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="cNo">Cancel</button><button type="button" class="btn danger" id="cYes">' + (act === "block" ? "Block" : "Unfriend") + "</button></div>");
    document.getElementById("cNo").onclick = closeModal;
    document.getElementById("cYes").onclick = function () { this.disabled = true; socialDo(act, { u: u }, closeModal); };
  }

  function pageFriends() {
    setNav("friends");
    if (!me) {
      main.innerHTML = '<div class="soon-page"><div class="big-icon">☺</div><h1>Friends</h1><p>Make a username so you can add friends, see when they\'re playing and join their game.</p><button class="btn" id="frSignup" type="button">Sign up</button></div>';
      document.getElementById("frSignup").onclick = function () { openSignup(); };
      return;
    }
    if (banned) { main.innerHTML = '<p class="err">This account is banned, so it can\'t use friends.</p>'; return; }
    if (!social) { main.innerHTML = '<p class="empty">Loading your friends…</p>'; return; }
    var old = document.getElementById("addName"), typed = old ? old.value : "", oldMsg = document.getElementById("addMsg");
    var html = '<h1 class="page-title">Friends</h1>' +
      '<form class="add-friend" id="addForm" autocomplete="off"><label for="addName">Add a friend</label><div class="add-row">' +
      '<input id="addName" maxlength="17" placeholder="@username" autocapitalize="off" spellcheck="false" value="' + esc(typed) + '">' +
      '<button class="btn" id="addGo">Send request</button></div><p class="' + (oldMsg ? oldMsg.className : "add-msg") + '" id="addMsg" role="status">' + (oldMsg ? oldMsg.innerHTML : "") + "</p>" +
      '<p class="tip">Only add people you know in real life. Never share your real name, school or where you live.</p></form>';
    if (social.in.length) html += '<h2 class="row-title">Friend requests <small>' + social.in.length + "</small></h2>" +
      '<div class="people">' + social.in.map(function (p) { return personRow(p, btn("Accept", "accept", p.u) + btn("Decline", "decline", p.u, 1)); }).join("") + "</div>";
    html += '<h2 class="row-title">Your friends <small>' + social.friends.length + "</small></h2>" +
      (social.friends.length ? '<div class="people">' + social.friends.map(function (f) {
        return personRow(f, (f.st === "game" && f.c ? btn("▶ Join", "join", f.u) : "") + btn("Unfriend", "unfriend", f.u, 1));
      }).join("") + "</div>" : '<p class="empty">No friends yet. Type a friend\'s @username above to send a request.</p>');
    if (social.out.length) html += '<h2 class="row-title">Requests you sent <small>' + social.out.length + "</small></h2>" +
      '<div class="people">' + social.out.map(function (p) { return personRow(p, btn("Cancel", "cancel", p.u, 1)); }).join("") + "</div>";
    if (social.blocked.length) html += '<h2 class="row-title">Blocked <small>' + social.blocked.length + "</small></h2>" +
      '<div class="people">' + social.blocked.map(function (p) { return personRow(p, btn("Unblock", "unblock", p.u, 1)); }).join("") + "</div>";
    main.innerHTML = html;
    wireButtons(main);
    document.getElementById("addForm").onsubmit = function (e) {
      e.preventDefault();
      var input = document.getElementById("addName"), out = document.getElementById("addMsg"), go = document.getElementById("addGo");
      var u = input.value.trim().replace(/^@/, "");
      if (!USER_RE.test(u)) { out.className = "add-msg err"; out.textContent = "Usernames are 3 to 16 letters, numbers or _."; return; }
      go.disabled = true;
      api("/social/request", { t: me.t, to: u }).then(function (r) {
        go.disabled = false;
        out.className = "add-msg " + (r.ok ? "good" : "err");
        out.textContent = r.ok ? (r.friends ? "You're now friends with @" + u + "!" : "Request sent to @" + u + "!") : ({
          nouser: "We couldn't find @" + u + ". Check the spelling.", self: "That's you!", already: "You're already friends.",
          pending: "You already sent them a request.", youblocked: "You blocked @" + u + ". Unblock them first (at the bottom).",
          toomany: "Too many friends or requests right now.", slowdown: "That's a lot of requests. Wait a few minutes.", banned: "This account is banned.",
        }[r.e] || "Something went wrong. Try again.");
        if (r.ok) { input.value = ""; input.blur(); loadSocial(); }
      }).catch(function () { go.disabled = false; out.className = "add-msg err"; out.textContent = "Couldn't reach GunnerVerse. Check your internet."; });
    };
  }

  function pageUser(u) {
    setNav("");
    u = u.replace(/^@/, "");
    if (me && u.toLowerCase() === me.u.toLowerCase()) { location.replace("#/me"); return; }
    var back = '<a class="back" href="#/friends">← Friends</a>';
    if (!main.querySelector(".profile-head")) main.innerHTML = back + '<p class="empty">Loading…</p>';
    api("/social/profile", me ? { t: me.t, u: u } : { u: u }).then(function (r) {
      if (location.hash.indexOf("#/u/") !== 0) return;
      if (!r.ok || !USER_RE.test(r.u || "")) { main.innerHTML = back + '<p class="empty">We couldn\'t find that player.</p>'; return; }
      var p = { u: r.u, d: r.d }, f = social && social.friends.filter(function (x) { return x.u.toLowerCase() === r.u.toLowerCase(); })[0];
      var b = "";
      if (!me) b = '<button class="btn" type="button" id="puSignup">Sign up to add friends</button>';
      else if (r.rel === "friend") b = (f && f.st === "game" && f.c ? btn("▶ Join", "join", r.u) : "") + '<span class="tag good-tag">✔ Friends</span>' + btn("Unfriend", "unfriend", r.u, 1) + btn("Block", "block", r.u, 1);
      else if (r.rel === "in") b = btn("Accept request", "accept", r.u) + btn("Decline", "decline", r.u, 1) + btn("Block", "block", r.u, 1);
      else if (r.rel === "out") b = '<span class="tag">Request sent</span>' + btn("Cancel", "cancel", r.u, 1) + btn("Block", "block", r.u, 1);
      else if (r.rel === "blocked") b = '<span class="tag">Blocked</span>' + btn("Unblock", "unblock", r.u, 1);
      else b = '<button class="btn" type="button" id="puAdd">+ Add friend</button>' + btn("Block", "block", r.u, 1);
      main.innerHTML = back + '<div class="profile-head">' + avatar(personName(p), colorFor(p.u), true, r.av) +
        "<div><h1>" + esc(personName(p)) + "</h1><p>@" + esc(p.u) + " · " + r.friends + " friend" + (r.friends === 1 ? "" : "s") + "</p>" +
        (f ? "<p>" + statusText(f) + "</p>" : "") + '</div></div><div class="actions">' + b + "</div>";
      wireButtons(main);
      var su = document.getElementById("puSignup"); if (su) su.onclick = function () { openSignup(); };
      var add = document.getElementById("puAdd");
      if (add) add.onclick = function () { add.disabled = true; socialDo("request", { to: r.u }); };
    }).catch(function () { main.innerHTML = back + '<p class="err">Couldn\'t reach GunnerVerse. Check your internet.</p>'; });
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
  function thumbSrc(t) { return t && t.charAt(0) === "@" ? RELAY + t.slice(1) : t || "img/share.jpg"; }
  function thumb(g, cls) {
    return '<img class="' + (cls || "thumb") + '" src="' + esc(thumbSrc(g.thumb)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/share.jpg\'">';
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
  function isMine(g) { return me && !g.official && g.byLow === me.u.toLowerCase(); }
  function reportGame(g) {
    if (!me) { openSignup("Make a username so you can report games."); return; }
    var whys = ["Bad words", "Scary, mean or gross", "Bad picture", "Copied from someone else", "It's broken", "Something else"];
    openModal('<h2 id="modalTitle">Report "' + esc(g.title) + '"</h2><p>Tell us what\'s wrong. Gamer Gunner\'s team will look at it and can take the game down.</p>' +
      '<form id="repForm"><div class="why-list">' + whys.map(function (w, i) { return '<label><input type="radio" name="why" value="' + esc(w) + '"' + (i ? "" : " checked") + "> " + esc(w) + "</label>"; }).join("") + "</div>" +
      '<label class="field"><span>More details (optional)</span><input id="repMore" maxlength="150"></label><p class="err" id="repErr"></p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="repNo">Cancel</button><button class="btn danger">Report</button></div></form>');
    document.getElementById("repNo").onclick = closeModal;
    document.getElementById("repForm").onsubmit = function (e) {
      e.preventDefault();
      var why = (document.querySelector('input[name="why"]:checked') || {}).value || "", more = document.getElementById("repMore").value.trim();
      api("/hub/report", { t: me.t, g: g.id, why: why + (more ? ": " + more : "") }).then(function (r) {
        if (r.ok) openModal('<h2 id="modalTitle">Thanks for telling us!</h2><p>We\'ll take a look at "' + esc(g.title) + '".</p><div class="modal-actions"><button class="btn" id="repOk">OK</button></div>'), document.getElementById("repOk").onclick = closeModal;
        else document.getElementById("repErr").textContent = r.e === "slowdown" ? "That's a lot of reports. Try again later." : "Couldn't send the report. Try again.";
      }).catch(function () { document.getElementById("repErr").textContent = "Couldn't reach GunnerVerse. Check your internet."; });
    };
  }
  function unpublishGame(g) {
    openModal('<h2 id="modalTitle">Delete "' + esc(g.title) + '"?</h2><p>It comes off GunnerVerse and its likes and plays are gone. The game stays saved in your Studio on the computer you made it on, so you can publish it again.</p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="unNo">Cancel</button><button type="button" class="btn danger" id="unYes">Delete</button></div>');
    document.getElementById("unNo").onclick = closeModal;
    document.getElementById("unYes").onclick = function () {
      this.disabled = true;
      api("/hub/unpublish", { t: me.t, g: g.id }).then(function (r) {
        closeModal();
        if (r.ok || r.e === "nogame") { games = games.filter(function (x) { return x.id !== g.id; }); location.hash = "#/me"; }
      }).catch(closeModal);
    };
  }
  var createCard = '<a class="card soon make" href="create/"><div class="big-icon">✚</div><b>Make your own game</b><span>Build it in GunnerVerse Studio with free cars, houses, coins, lava and more.</span></a>';

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
    var feat = games.filter(function (g) { return g.id === "gunnerverse"; })[0] || games.filter(function (g) { return g.official; })[0] || games[0]; // (GunnerVerse stays the big one on top)
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
      "<h1>" + esc(g.title) + '</h1><p class="by">by ' + (g.official ? "@" + esc(g.by) + '<span class="badge">✔ Official</span>' : '<a href="#/u/' + esc(g.by) + '">@' + esc(g.by) + "</a>") + "</p>" +
      '<div class="actions"><button class="btn big" id="gPlay" type="button">▶ Play</button>' +
      '<button class="btn big ghost like' + (on ? " on" : "") + '" id="gLike" type="button" aria-pressed="' + on + '">👍 ' + (on ? "Liked" : "Like") + "</button></div>" +
      '<div class="stat-boxes"><div class="stat-box"><b>' + short(playing[g.id] || 0) + '</b><span>playing now</span></div>' +
      '<div class="stat-box"><b>' + short(g.likes) + '</b><span>likes</span></div><div class="stat-box"><b>' + short(g.plays) + "</b><span>plays</span></div></div>" +
      '<p class="desc">' + esc(g.desc) + "</p>" +
      (g.id === "gunnerverse" ? '<p class="desc"><a href="about.html">Controls, everything in the game, and info for parents →</a></p>' :
        '<p class="desc small">Made in GunnerVerse Studio · ' + (g.n || 0) + " things · updated " + new Date(g.updated || g.created).toLocaleDateString() + "</p>" +
        '<div class="actions">' + (isMine(g) ? '<button class="btn ghost small" id="gDel" type="button">🗑 Delete from GunnerVerse</button>' : '<button class="btn ghost small" id="gRep" type="button">⚑ Report</button>') + "</div>") +
      "</div></div>";
    document.getElementById("gPlay").onclick = function () { play(g); };
    document.getElementById("gLike").onclick = function () { like(g, this); };
    var rb = document.getElementById("gRep"); if (rb) rb.onclick = function () { reportGame(g); };
    var db = document.getElementById("gDel"); if (db) db.onclick = function () { unpublishGame(g); };
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

  function pageCreate() {
    setNav("create");
    main.innerHTML = '<div class="soon-page"><div class="big-icon">✚</div><h1>GunnerVerse Studio</h1>' +
      "<p>Build your own 3D game right here: drag in free cars, trees, houses, coins, lava, jump pads and more, give things behaviors, and press Play to try it. " +
      "Start from a Baseplate, an Obby or a Racing game. When it's ready, press <b>⬆ Publish</b> to put it on GunnerVerse for everyone, with your own picture.</p>" +
      '<a class="btn big" href="create/">✚ Open the Studio</a><p class="tip" style="margin-top:14px">Works best on a computer with a mouse and keyboard.</p></div>';
  }

  function pageMe() {
    setNav("me");
    if (!me) {
      main.innerHTML = '<div class="soon-page"><div class="big-icon">◉</div><h1>Your profile</h1><p>Make a username to get a profile, like games, add friends and publish your own games.</p><div class="actions" style="justify-content:center"><button class="btn" id="meSignup" type="button">Sign up</button><button class="btn ghost" id="meLogin" type="button">Log in</button></div></div>';
      document.getElementById("meSignup").onclick = function () { openSignup(); };
      document.getElementById("meLogin").onclick = function () { openLogin(); };
      return;
    }
    var mine = games.filter(function (g) { return liked[g.id]; });
    var nf = social ? social.friends.length : 0;
    main.innerHTML = '<div class="profile-head">' + avatar(shownName(), myColor(), true, myAvatar()) + "<div><h1>" + esc(shownName()) + "</h1><p>@" + esc(me.u) +
      (social ? ' · <a href="#/friends">' + nf + " friend" + (nf === 1 ? "" : "s") + "</a>" : "") + "</p></div></div>" +
      '<div class="actions"><a class="btn" href="#/avatar">☻ Change my avatar</a><button class="btn ghost" id="meEdit" type="button">Edit profile</button>' +
      '<button class="btn ghost" id="mePw" type="button">' + (hasPass ? "🔒 Change password" : "🔒 Add a password") + '</button><button class="btn ghost" id="meOut" type="button">Log out</button></div>' +
      (hasPass ? "" : '<p class="tip pw-tip">🔒 Add a password so you can log in to @' + esc(me.u) + " on other computers and tablets (and never lose your account).</p>") +
      (banned ? '<p class="err">This account is banned.</p>' : "") +
      '<h2 class="row-title">Games you liked</h2>' + (mine.length ? '<div class="grid">' + mine.map(card).join("") + "</div>" : '<p class="empty">Tap 👍 on a game to save it here.</p>') +
      '<h2 class="row-title">Your games</h2><div class="grid" id="myGames">' + games.filter(isMine).map(card).join("") + createCard + "</div>" +
      '<p class="hello-sub" style="margin-top:26px">' + (hasPass ? "On another device? Press Log in and use your username and password." : "Your account is only on this device until you add a password.") + "</p>";
    document.getElementById("meEdit").onclick = openEditProfile;
    document.getElementById("mePw").onclick = openSetPassword;
    document.getElementById("meOut").onclick = confirmLogOut;
  }

  // ---------------------------------------------------------------- avatar (#/avatar)
  function pageAvatar() {
    setNav("avatar");
    main.innerHTML = '<h1 class="page-title">My Avatar</h1><p class="hello-sub">Make your character! Pick a body, face, hair, hats, clothes and cool stuff. You\'ll look like this in every game made in GunnerVerse Studio.</p>' +
      '<div id="avBox"><p class="empty">Loading…</p></div>' + (me ? "" : '<p class="hello-sub">Tip: <a href="#/me">sign up</a> so your friends can see your avatar too.</p>');
    loadAV().then(function (m) {
      var box = document.getElementById("avBox");
      if (!box) return;
      if (!m) { box.innerHTML = '<p class="err">The avatar maker couldn\'t load. Refresh and try again.</p>'; return; }
      m.mountAvatarEditor(box, { onChange: function (a) { sendAvatar(a); drawAccount(); },
        api: api, relay: RELAY, me: function () { return me; } }); // (🌍 publishing cosmetics for everyone needs your account)
      drawAccount();
    });
  }

  // ---------------------------------------------------------------- admin (#/admin, dev password)
  function pageAdmin() {
    setNav("");
    var pw = ""; try { pw = sessionStorage.getItem("gg_admin") || ""; } catch (e) {}
    if (!pw) {
      main.innerHTML = '<h1 class="page-title">Admin</h1><form class="add-friend" id="adForm"><label for="adPw">Dev password</label><div class="add-row"><input id="adPw" type="password" autocomplete="off">' +
        '<button class="btn">Open</button></div><p class="add-msg err" id="adErr"></p></form>';
      document.getElementById("adForm").onsubmit = function (e) { e.preventDefault(); try { sessionStorage.setItem("gg_admin", document.getElementById("adPw").value); } catch (x) {} pageAdmin(); };
      return;
    }
    var hdr = { "X-GG-Dev": pw, "Content-Type": "application/json" };
    var call = function (path, body) { return fetch(RELAY + path, body ? { method: "POST", headers: hdr, body: JSON.stringify(body) } : { headers: hdr }).then(function (r) { return r.json(); }); };
    main.innerHTML = '<h1 class="page-title">Admin</h1><p class="empty">Loading reports…</p>';
    call("/hub/admin/reports").then(function (r) {
      if (!r.ok) { try { sessionStorage.removeItem("gg_admin"); } catch (x) {} main.innerHTML = '<h1 class="page-title">Admin</h1><p class="err">Wrong password.</p><a class="btn" href="#/admin" onclick="location.reload()">Try again</a>'; return; }
      var rows = (r.reports || []).map(function (x) {
        return '<div class="person"><span class="person-main"><span><b>' + esc(x.title) + "</b><small>by @" + esc(x.maker) + " · reported by @" + esc(x.by) + " · " + new Date(x.at).toLocaleString() + "</small>" +
          '<span class="st">' + esc(x.why || "(no reason)") + "</span></span></span>" +
          '<div class="person-btns">' + (x.g.indexOf("s:") === 0 // (a Shared Toolbox thing: its picture)
            ? '<a class="btn small ghost" target="_blank" rel="noopener" href="' + esc(RELAY + "/hub/sthumb/" + x.g.slice(2)) + '">Picture</a><button class="btn small danger" data-rm="' + esc(x.g) + '">Remove it</button>'
            : '<a class="btn small ghost" href="#/game/' + esc(x.g) + '">View</a><button class="btn small danger" data-rm="' + esc(x.g) + '">Remove game</button>') +
          '<button class="btn small danger" data-ban="' + esc(x.maker) + '">Ban @' + esc(x.maker) + '</button><button class="btn small ghost" data-done="' + esc(x.id) + '">Dismiss</button></div></div>';
      }).join("");
      main.innerHTML = '<h1 class="page-title">Admin</h1><h2 class="row-title">Reported games <small>' + (r.reports || []).length + "</small></h2>" +
        (rows ? '<div class="people">' + rows + "</div>" : '<p class="empty">No reports. 🎉</p>') +
        '<h2 class="row-title">Reset a password</h2><form class="add-friend" id="rpForm"><label for="rpUser">Username (for a player who forgot their password: they add a new one on a device that\'s still logged in)</label><div class="add-row"><input id="rpUser" maxlength="17">' +
        '<button class="btn danger">Reset</button></div><p class="add-msg" id="rpMsg"></p></form>' +
        '<h2 class="row-title">Remove any game</h2><form class="add-friend" id="rmForm"><label for="rmId">Game id (the letters after #/game/ in its address)</label><div class="add-row"><input id="rmId" maxlength="16">' +
        '<button class="btn danger">Remove</button></div><p class="add-msg" id="rmMsg"></p></form>' +
        '<p class="tip" style="margin-top:20px">Bans block the account from GunnerVerse and the game (same as the dev menu ban). Unban from the game\'s dev menu.</p>';
      var act = function (fn) { return function () { var b = this; if (!confirm(b.textContent + "?")) return; b.disabled = true; fn(b).then(function () { loadGames().then(pageAdmin); }); }; };
      Array.prototype.forEach.call(main.querySelectorAll("[data-rm]"), function (b) { b.onclick = act(function (b) { return call("/hub/admin/remove", { g: b.getAttribute("data-rm") }).then(function () { return call("/hub/admin/done", { id: b.getAttribute("data-rm") }); }); }); });
      Array.prototype.forEach.call(main.querySelectorAll("[data-done]"), function (b) { b.onclick = act(function (b) { return call("/hub/admin/done", { id: b.getAttribute("data-done") }); }); });
      Array.prototype.forEach.call(main.querySelectorAll("[data-ban]"), function (b) { b.onclick = act(function (b) { return fetch(RELAY + "/ban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c: pw, u: b.getAttribute("data-ban") }) }).then(function (r) { return r.json(); }); }); });
      document.getElementById("rpForm").onsubmit = function (e) {
        e.preventDefault();
        var u = document.getElementById("rpUser").value.trim().replace(/^@/, "");
        if (!u || !confirm("Remove @" + u + "'s password?")) return;
        fetch(RELAY + "/resetpass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c: pw, u: u }) }).then(function (r) { return r.json(); })
          .then(function (r) { document.getElementById("rpMsg").textContent = r.ok ? "Done: @" + u + " has no password now. They can add a new one in Profile on a device that's still logged in." : r.e === "nouser" ? "No player with that username." : "Didn't work."; })
          .catch(function () { document.getElementById("rpMsg").textContent = "Couldn't reach GunnerVerse."; });
      };
      document.getElementById("rmForm").onsubmit = function (e) {
        e.preventDefault();
        var id = document.getElementById("rmId").value.trim().replace(/^.*#\/game\//, "");
        call("/hub/admin/remove", { g: id }).then(function (r) { document.getElementById("rmMsg").textContent = r.ok ? "Removed." : "No player game with that id."; if (r.ok) loadGames(); });
      };
    }).catch(function () { main.innerHTML = '<p class="err">Couldn\'t reach GunnerVerse.</p>'; });
  }

  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var parts = h.split("/");
    if (parts[0] !== "search" && searchInput !== document.activeElement) searchInput.value = "";
    if (parts[0] === "game" && parts[1]) pageGame(parts[1]);
    else if (parts[0] === "search") pageSearch(parts.slice(1).join("/"));
    else if (parts[0] === "friends") pageFriends();
    else if (parts[0] === "avatar") pageAvatar();
    else if (parts[0] === "login") { if (me) { location.replace(parts[1] === "play" ? withRelay("play/") : "#/me"); return; } pageHome(); openLogin(parts[1] === "play"); }
    else if (parts[0] === "u" && parts[1]) pageUser(parts[1]);
    else if (parts[0] === "create") pageCreate();
    else if (parts[0] === "me") pageMe();
    else if (parts[0] === "admin") pageAdmin();
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
  window.addEventListener("storage", function (e) { if (e.key === "gg_account") { me = readAccount(); social = null; drawAccount(); drawSide(); checkAccount(); route(); } });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && me) loadSocial(); });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  drawAccount();
  drawSide();
  route();
  loadGames().then(route);
  checkAccount();
  setTimeout(function () { loadAV().then(function (m) { if (m) { drawAccount(); drawSide(); if (!/^#\/(avatar|create)/.test(location.hash)) route(); } }); }, 600); // (avatar pictures)
})();
