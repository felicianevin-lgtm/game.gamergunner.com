// PUBLISH from GunnerVerse Studio: title, description and a thumbnail (a snapshot of the game or any uploaded picture,
// made 640 x 360), then the game goes live on the GunnerVerse home page right away (relay publish.js). Publishing again
// updates the same game; Unpublish takes it down. Needs a GunnerVerse account (the home page's Sign up).
import { api, account, thumbUrl } from "./net.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const W = 640, H = 360;

// Draw any picture into 640 x 360 (cropped to fill), as a JPEG data URL.
function toThumb(src) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height;
  const k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k;
  g.fillStyle = "#070a0d"; g.fillRect(0, 0, W, H);
  g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  let q = 0.85, url = cv.toDataURL("image/jpeg", q);
  while (url.length > 330000 && q > 0.4) url = cv.toDataURL("image/jpeg", (q -= 0.1));
  return url;
}

// ui = {game, snapshot(): canvas with the current view, saveNow(), openModal(html), closeModal(), $(id)}
export function openPublish(ui) {
  const { game, $ } = ui;
  const me = account();
  if (!me) {
    ui.openModal('<h2>Publish your game</h2><p>You need a GunnerVerse username to publish. Make one on the home page (it only takes a second), then come back. Your game stays saved here.</p>' +
      '<div class="modal-actions"><button class="btn" id="pbClose">Not now</button><a class="btn go" href="../#/me" target="_blank" rel="noopener">Sign up</a></div>');
    $("pbClose").onclick = ui.closeModal;
    return;
  }
  let thumb = null;
  const updating = !!game.pub;
  ui.openModal('<h2>' + (updating ? "Update your game" : "Publish your game") + "</h2>" +
    "<p>" + (updating ? "Publishing again puts your newest changes online." : "It goes live on GunnerVerse right away for everyone to play.") + " You're publishing as <b>@" + esc(me.u) + "</b>.</p>" +
    '<div class="pub-grid"><div>' +
    '<label class="field"><span>Title</span><input id="pbTitle" maxlength="40" value="' + esc(game.name) + '"></label>' +
    '<label class="field"><span>Description</span><textarea id="pbDesc" maxlength="300" rows="4" placeholder="What do players do in your game?">' + esc(game.desc || "") + "</textarea></label>" +
    "</div><div>" +
    '<span class="field-label">Thumbnail</span><div class="thumb-box" id="pbThumb">' + (updating ? '<img id="pbOld" alt="">' : "<span>No picture yet</span>") + "</div>" +
    '<div class="thumb-btns"><button class="btn" id="pbSnap" type="button">📷 Snapshot of my game</button>' +
    '<label class="btn" for="pbFile">🖼 Upload a picture</label><input type="file" id="pbFile" accept="image/*" hidden></div>' +
    '<p class="note">Tip: move the camera to a cool view before taking the snapshot.</p></div></div>' +
    '<p class="note">Everyone can see your title, description, picture and the words in your game, so keep it friendly. Links and bad words are removed.</p>' +
    '<p class="err" id="pbErr" role="alert"></p>' +
    '<div class="modal-actions">' + (updating ? '<button class="btn danger" id="pbUnpub" type="button">Unpublish</button><span style="flex:1"></span>' : "") +
    '<button class="btn" id="pbCancel" type="button">Cancel</button><button class="btn go" id="pbGo" type="button">' + (updating ? "⬆ Update" : "⬆ Publish") + "</button></div>");
  if (updating) {
    api("/hub/game/" + game.pub).then((r) => {
      if (r.ok && $("pbOld")) $("pbOld").src = thumbUrl(r.card.thumb);
      else if (!r.ok && r.e === "nogame") { delete game.pub; ui.saveNow(true); ui.closeModal(); openPublish(ui); } // (it was removed: publish fresh)
    }).catch(() => {});
  }
  const show = (url) => { thumb = url; $("pbThumb").innerHTML = '<img alt="Thumbnail preview" src="' + url + '">'; };
  $("pbSnap").onclick = () => show(toThumb(ui.snapshot()));
  $("pbFile").onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type) || f.size > 20e6) { $("pbErr").textContent = "That file isn't a picture we can use."; return; }
    const img = new Image();
    img.onload = () => { show(toThumb(img)); URL.revokeObjectURL(img.src); };
    img.onerror = () => { $("pbErr").textContent = "That picture couldn't be opened. Try a JPG or PNG."; };
    img.src = URL.createObjectURL(f);
  };
  $("pbCancel").onclick = ui.closeModal;
  if ($("pbUnpub")) $("pbUnpub").onclick = () => {
    if (!confirm("Take \"" + game.name + "\" off GunnerVerse? Its likes and plays will be gone. Your game stays saved here.")) return;
    api("/hub/unpublish", { t: me.t, g: game.pub }).then((r) => {
      if (r.ok || r.e === "nogame") { delete game.pub; ui.saveNow(true); ui.closeModal(); }
      else $("pbErr").textContent = "Couldn't unpublish. Try again.";
    }).catch(() => { $("pbErr").textContent = "Couldn't reach GunnerVerse. Check your internet."; });
  };
  $("pbGo").onclick = () => {
    const title = $("pbTitle").value.trim(), desc = $("pbDesc").value.trim();
    if (title.length < 3) { $("pbErr").textContent = "Give your game a title (at least 3 letters)."; return; }
    if (!updating && !thumb) { $("pbErr").textContent = "Add a thumbnail: take a snapshot or upload a picture."; return; }
    if (!game.objects.some((o) => o.b.k === "spawn")) { if (!confirm("Your game has no Spawn Point, so players start in the middle. Publish anyway?")) return; }
    const go = $("pbGo"); go.disabled = true; go.textContent = "Publishing…"; $("pbErr").textContent = "";
    const copy = { name: game.name, settings: game.settings, objects: game.objects, gui: game.gui || [] };
    api("/hub/publish", { t: me.t, id: game.pub || "", title, desc, game: copy, thumb: thumb || undefined }).then((r) => {
      go.disabled = false; go.textContent = updating ? "⬆ Update" : "⬆ Publish";
      if (!r.ok) {
        if (r.e === "notyours" || (r.e === "nogame")) { delete game.pub; ui.saveNow(true); }
        $("pbErr").textContent = {
          signin: "Your GunnerVerse account wasn't found. Sign up again on the home page.", banned: "This account can't publish games.",
          title: "Give your game a title (at least 3 letters, no links).", thumb: "That picture is too big or not a picture. Try another one.",
          toobig: "Your game is too big to publish. Try removing some things.", toomany: "You can publish up to 20 games. Unpublish one first.",
          slowdown: "That's a lot of publishing! Wait a few minutes and try again.", notyours: "That game isn't yours anymore. Press Publish again to make it a new game.",
          game: "Something's wrong with this game. Try saving and publishing again.",
        }[r.e] || "Publishing didn't work. Try again.";
        return;
      }
      game.pub = r.id; game.desc = desc;
      ui.saveNow(true);
      ui.openModal('<h2>🎉 ' + (updating ? "Updated!" : "Published!") + "</h2><p><b>" + esc(r.card.title) + "</b> is live on GunnerVerse. Share it with your friends!</p>" +
        '<div class="thumb-box"><img alt="" src="' + thumbUrl(r.card.thumb) + '"></div>' +
        '<div class="modal-actions" style="margin-top:14px"><button class="btn" id="pbDone">Keep building</button><a class="btn go" href="../#/game/' + r.id + '" target="_blank" rel="noopener">See it on GunnerVerse</a></div>');
      $("pbDone").onclick = ui.closeModal;
    }).catch(() => { go.disabled = false; go.textContent = updating ? "⬆ Update" : "⬆ Publish"; $("pbErr").textContent = "Couldn't reach GunnerVerse. Check your internet."; });
  };
}
