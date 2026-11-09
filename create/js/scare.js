// MONSTERS + JUMP SCARES for anything in GunnerVerse Studio (a Block, a Character, an imported model...).
//   obj.chase = {sp: speed, dmg: damage per hit, r: starts chasing when you're this close (0 = always), face: 1 = turns
//                to face you, snd: sound when it hits}                                       (play.js chasers)
//   obj.scare = {when: "near" / "touch", r: how close, fx: SCARE_FX, flash: FLASHES, snd: SCARE_SOUNDS, secs,
//                again: 1 = every time (else once), hide: 1 = invisible until it jumps out, pic: a picture file instead}
// playScare() shows the scare on top of everything: the thing itself (or a picture) flies at your face, the screen
// flashes and shakes and it screams. The Studio's "▶ Try it" button plays the very same thing.
import * as THREE from "../vendor/three.module.js";
import { animateThing, motionOf } from "./motion.js";

export const CHASE_SOUNDS = { none: "No sound", scream: "😱 Scream", roar: "🦖 Roar", boom: "💥 Boom", glitch: "📺 Glitch" };
export const SCARE_FX = {
  lunge: { label: "Lunge", icon: "💨", note: "Rushes at your face" },
  pop: { label: "Pop up", icon: "💥", note: "Suddenly right there" },
  creep: { label: "Creep", icon: "👀", note: "Rises up slowly, then jumps" },
  shake: { label: "Shake", icon: "🫨", note: "Shaking like crazy" },
  spin: { label: "Spin in", icon: "🌀", note: "Spins toward you" },
  glitch: { label: "Glitch", icon: "📺", note: "Flickers in and out" },
};
export const FLASHES = { red: "🟥 Red", white: "⬜ White", black: "⬛ Dark", none: "No flash" };
export const SCARE_SOUNDS = { scream: "😱 Scream", roar: "🦖 Roar", glitch: "📺 Glitch", boom: "💥 Boom", none: "No sound" };
export const SCARE_WHEN = { near: "When a player gets close", touch: "When a player touches it" };

const word = (v, list, d) => (list[v] ? v : d);
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 10) / 10)) : d; };
export const DEFAULT_CHASE = { sp: 8, dmg: 20, r: 0, face: 1, snd: "scream" };
export function sanitizeChase(c) {
  if (!c || typeof c !== "object") return null;
  return { sp: num(c.sp, 1, 40, 8), dmg: num(c.dmg, 0, 100, 20), r: num(c.r, 0, 300, 0), face: c.face === 0 || c.face === false ? 0 : 1, snd: word(c.snd, CHASE_SOUNDS, "scream") };
}
export const DEFAULT_SCARE = { when: "near", r: 8, fx: "lunge", flash: "red", snd: "scream", secs: 1.5, again: 0, hide: 0, pic: "" };
export function sanitizeScare(s) {
  if (!s || typeof s !== "object") return null;
  return { when: word(s.when, SCARE_WHEN, "near"), r: num(s.r, 2, 60, 8), fx: word(s.fx, SCARE_FX, "lunge"), flash: word(s.flash, FLASHES, "red"), snd: word(s.snd, SCARE_SOUNDS, "scream"),
    secs: num(s.secs, 0.5, 4, 1.5), again: s.again ? 1 : 0, hide: s.hide ? 1 : 0, pic: /^[a-z0-9]{6,40}$/i.test(s.pic || "") ? s.pic : "" };
}

// ---------------------------------------------------------------- sounds (made right here, nothing to download)
let ac = null;
function audio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; } catch { return null; } }
function tone(a, f0, f1, secs, type, vol, at) {
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (at || 0);
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + secs);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + secs);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + secs + 0.05);
}
function hiss(a, secs, freq, vol, at) {
  const n = a.createBufferSource(), buf = a.createBuffer(1, Math.floor(a.sampleRate * secs), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = buf;
  const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.7;
  const g = a.createGain(); g.gain.value = vol;
  n.connect(f); f.connect(g); g.connect(a.destination); n.start(a.currentTime + (at || 0));
}
export function scareSound(name) {
  const a = audio(); if (!a || name === "none") return;
  if (name === "scream") { hiss(a, 1.2, 2600, 0.5); tone(a, 1500, 900, 1.1, "sawtooth", 0.18); tone(a, 1230, 700, 1.1, "square", 0.12); tone(a, 1800, 1100, 0.9, "sawtooth", 0.08, 0.05); }
  else if (name === "roar") { hiss(a, 1.3, 300, 0.7); tone(a, 140, 55, 1.3, "sawtooth", 0.35); tone(a, 95, 40, 1.3, "square", 0.2); }
  else if (name === "glitch") for (let i = 0; i < 9; i++) { tone(a, 200 + Math.random() * 1800, 100 + Math.random() * 900, 0.07, "square", 0.15, i * 0.08); if (i % 3 === 0) hiss(a, 0.08, 4000, 0.4, i * 0.08); }
  else if (name === "boom") { hiss(a, 0.9, 400, 0.8); tone(a, 90, 30, 0.8, "sine", 0.6); }
}

// ---------------------------------------------------------------- the scare itself
let playing = null;
// thing = a built object (world.js buildObject) or null, o = its saved settings, picUrl = a picture to show instead.
// Calls done() when it's over. Only one scare at a time.
export function playScare(thing, o, picUrl, done) {
  if (playing) { done && done(); return; }
  const s = sanitizeScare(o.scare) || DEFAULT_SCARE;
  const layer = document.createElement("div");
  layer.className = "scare-layer fx-" + s.fx;
  layer.innerHTML = '<div class="scare-flash flash-' + s.flash + '"></div>';
  document.body.appendChild(layer);
  const flash = layer.firstChild;
  let renderer = null, scene, camera, holder, inner = null, img = null;
  if (picUrl) {
    img = document.createElement("img"); img.className = "scare-pic"; img.alt = ""; img.src = picUrl; layer.insertBefore(img, flash);
  } else if (thing) {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(innerWidth, innerHeight, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      layer.insertBefore(renderer.domElement, flash);
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x220000, 1.2));
      const key = new THREE.DirectionalLight(0xffeedd, 2.6); key.position.set(0, -2, 3); scene.add(key); // (lit from below: spookier)
      const rim = new THREE.DirectionalLight(0xff3020, 2); rim.position.set(0, 3, -3); scene.add(rim);
      camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
      holder = new THREE.Group(); scene.add(holder);
      thing.position.set(0, 0, 0); thing.rotation.set(0, Math.PI, 0); // (its front faces you)
      const box = new THREE.Box3().setFromObject(thing), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const k = 1 / Math.max(0.01, size.y, size.x * 0.75);
      thing.position.sub(c); thing.position.y -= size.y * (size.y > size.x * 1.2 ? 0.28 : 0.05); holder.add(thing); holder.scale.setScalar(k); // (tall things: the head and shoulders fill the screen)
      inner = thing.userData.inner || null;
    } catch { renderer = null; }
  }
  scareSound(s.snd);
  const secs = s.secs, t0 = performance.now();
  playing = { stop: finish };
  function finish() {
    if (!playing) return;
    playing = null;
    layer.remove();
    if (renderer) renderer.dispose();
    done && done();
  }
  // how close (1 = far away, 0 = right in your face) and the extra moves for each preset
  function frame() {
    if (!playing) return;
    const t = (performance.now() - t0) / 1000, p = Math.min(1, t / secs);
    let z = 0.9, y = 0, spin = 0, shake = 0, show = 1;
    const rush = (a) => 1 - Math.pow(Math.min(1, a), 0.35);
    if (s.fx === "lunge") { z = 0.9 + rush(t / 0.35) * 9; shake = t < 0.35 ? 0 : 0.03; }
    else if (s.fx === "pop") { z = 0.85; shake = 0.05 * Math.max(0, 1 - t); }
    else if (s.fx === "creep") { const up = Math.min(1, t / (secs * 0.55)); y = -1.3 * (1 - up); z = t < secs * 0.55 ? 3 : 0.9 + rush((t - secs * 0.55) / 0.2) * 2.1; shake = t < secs * 0.55 ? 0 : 0.04; }
    else if (s.fx === "shake") { z = 1.1; shake = 0.09; }
    else if (s.fx === "spin") { const a = Math.min(1, t / 0.6); z = 0.9 + (1 - a) * 6; spin = (1 - a) * Math.PI * 4; }
    else if (s.fx === "glitch") { z = 1 + (Math.random() < 0.3 ? Math.random() * 1.5 : 0); show = Math.random() < 0.75 ? 1 : 0; shake = 0.06; }
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    // the "creep" only flashes once it jumps
    flash.style.opacity = s.flash === "none" ? 0 : String(Math.max(0, (s.fx === "creep" ? (t > secs * 0.55 ? 1 - (t - secs * 0.55) / 0.5 : 0) : 1 - t / 0.5)) * 0.85);
    layer.style.transform = shake ? "translate(" + sx * 40 + "px," + sy * 40 + "px)" : "";
    if (renderer) {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight, false);
      holder.position.set(sx, y + sy, -z); holder.rotation.set(0, spin, Math.sin(t * 30) * shake * 2);
      holder.visible = !!show;
      if (inner) { const mo = motionOf(o) || { g: "run", i: "dance", w: "always", sp: 1 }; animateThing(inner, 1, t, 1, { ...mo, w: "always", sp: 1.6 }); }
      renderer.render(scene, camera);
    } else if (img) {
      const k = 1 / Math.max(0.3, z); img.style.transform = "translate(" + sx * 60 + "px," + (y * 30 + sy * 60) + "%) scale(" + k * 0.9 + ") rotate(" + spin + "rad)"; img.style.opacity = show;
    }
    if (p >= 1) { finish(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
export function stopScare() { if (playing) playing.stop(); }
export function scaring() { return !!playing; }
