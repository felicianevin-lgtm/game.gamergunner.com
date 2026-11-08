// The AVATAR page on the GunnerVerse home page (#/avatar in site/hub.js loads this file when it's needed): a 3D preview
// you can spin, and tabs of cosmetics (body, face, hair, hats, shirts, pants, face stuff, back, hand) with colors.
// Every change saves right away (avatar.js saveAvatar); hub.js also sends it to your account.
import * as THREE from "../vendor/three.module.js";
import { buildAvatar, animateAvatar, loadAvatar, saveAvatar, sanitizeAvatar, randomAvatar, avatarPicture, DEFAULT_AVATAR, PALETTE,
  TOPS, FACES, HAIR, HATS, EYES, BACK, HAND, BUILDS } from "./avatar.js";

export { avatarPicture, loadAvatar, sanitizeAvatar };

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TABS = [
  { k: "body", icon: "🧍", label: "Body", items: ["build", BUILDS], colors: [["skin", "Skin"]] },
  { k: "face", icon: "😀", label: "Face", items: ["face", FACES] },
  { k: "hair", icon: "💇", label: "Hair", items: ["hair", HAIR], colors: [["hairColor", "Hair color"]] },
  { k: "hat", icon: "🎩", label: "Hats", items: ["hat", HATS], colors: [["hatColor", "Hat color"]] },
  { k: "top", icon: "👕", label: "Shirts", items: ["top", TOPS], colors: [["shirt", "Shirt color"], ["accent", "Design color"]] },
  { k: "pants", icon: "👖", label: "Pants", colors: [["pants", "Pants color"], ["shoes", "Shoe color"]] },
  { k: "eyes", icon: "🕶️", label: "Face stuff", items: ["eyes", EYES] },
  { k: "back", icon: "🎒", label: "Back", items: ["back", BACK], colors: [["accent", "Color"]] },
  { k: "hand", icon: "🗡️", label: "Hand", items: ["hand", HAND] },
];

// opts = {onChange(avatar)}
export function mountAvatarEditor(box, opts) {
  let av = loadAvatar(), tab = "body";
  box.innerHTML = '<div class="av-wrap"><div class="av-stage"><canvas id="avCanvas" aria-label="Your avatar (drag to spin)"></canvas>' +
    '<div class="av-btns"><button class="btn" type="button" id="avRand">🎲 Random</button><button class="btn ghost" type="button" id="avReset">↺ Start over</button></div>' +
    '<p class="av-note">Drag to spin. Your avatar is you in every game made in GunnerVerse Studio. It saves by itself!</p></div>' +
    '<div class="av-pick"><div class="av-tabs" id="avTabs"></div><div class="av-items" id="avItems"></div></div></div>';
  const canvas = box.querySelector("#avCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-3, 6, -6); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 40), new THREE.MeshStandardMaterial({ color: 0x1fae45, roughness: 0.8 }));
  floor.position.y = -0.1; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 2.2, -10); camera.lookAt(0, 1.75, 0);
  const holder = new THREE.Group(); scene.add(holder);
  let model = null, yaw = 0.5, spin = 0.5, drag = null, last = performance.now(), alive = true, t = 0;
  function rebuild() { if (model) holder.remove(model); model = buildAvatar(av); holder.add(model); }
  function changed() { saveAvatar(av); rebuild(); if (opts && opts.onChange) opts.onChange(av); }
  canvas.addEventListener("pointerdown", (e) => { drag = e.clientX; spin = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (drag == null) return; yaw += (e.clientX - drag) * 0.012; drag = e.clientX; });
  canvas.addEventListener("pointerup", () => { drag = null; setTimeout(() => { if (drag == null) spin = 0.5; }, 1500); });
  function frame(now) {
    if (!alive || !canvas.isConnected) { alive = false; renderer.dispose(); return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio()))) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    yaw += spin * dt;
    holder.rotation.y = yaw;
    if (model) { animateAvatar(model, dt, true, 0); model.userData.limbs.armR.rotation.x = Math.sin(t * 2) * 0.08; }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  function drawTabs() {
    box.querySelector("#avTabs").innerHTML = TABS.map((x) => '<button type="button" data-tab="' + x.k + '" class="' + (x.k === tab ? "on" : "") + '"><span>' + x.icon + "</span>" + esc(x.label) + "</button>").join("");
    box.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; drawTabs(); drawItems(); }));
  }
  function drawItems() {
    const T = TABS.find((x) => x.k === tab);
    let html = "";
    if (T.items) {
      const [key, list] = T.items;
      html += '<div class="av-grid">' + Object.entries(list).map(([k, label]) => '<button type="button" data-set="' + key + '" data-v="' + k + '" class="' + (av[key] === k ? "on" : "") + '">' +
        (thumbs[key] ? '<img alt="" src="' + thumb(key, k) + '">' : "") + "<span>" + esc(label) + "</span></button>").join("") + "</div>";
    }
    for (const [key, label] of T.colors || []) {
      html += '<div class="av-colors"><b>' + esc(label) + "</b><div>" + PALETTE.map((c) => '<button type="button" data-color="' + key + '" data-v="' + c + '" class="' + (av[key] === c ? "on" : "") + '" style="background:' + c + '" aria-label="' + c + '"></button>').join("") +
        '<label class="av-more" title="Any color"><input type="color" data-pick="' + key + '" value="' + av[key] + '">🎨</label></div></div>';
    }
    const box2 = box.querySelector("#avItems");
    box2.innerHTML = html;
    box2.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => { av[b.dataset.set] = b.dataset.v; changed(); drawItems(); }));
    box2.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { av[b.dataset.color] = b.dataset.v; changed(); drawItems(); }));
    box2.querySelectorAll("[data-pick]").forEach((inp) => (inp.onchange = () => { av[inp.dataset.pick] = inp.value; changed(); drawItems(); }));
  }
  // little pictures of each hat / hair / face / shirt: your avatar wearing it (made once, then remembered)
  const thumbs = { hat: 1, hair: 1, face: 1, eyes: 1, top: 1, back: 1, build: 1 };
  function thumb(key, v) { return avatarPicture({ ...av, [key]: v }, 96, key === "top" || key === "back" || key === "build"); }
  box.querySelector("#avRand").onclick = () => { av = randomAvatar(); changed(); drawItems(); };
  box.querySelector("#avReset").onclick = () => { av = { ...DEFAULT_AVATAR }; changed(); drawItems(); };
  rebuild(); drawTabs(); drawItems();
  return { set(a) { av = sanitizeAvatar(a); rebuild(); drawItems(); } };
}
