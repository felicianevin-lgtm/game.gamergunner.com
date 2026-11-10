// CLASH fighters: four original sorcerers (made for GunnerVerse), their looks (built from simple shapes, cel shaded with
// black outlines) and their moves. The moves themselves happen in moves.js; this file is what they are and how they move.
import * as THREE from "/create/vendor/three.module.js";

// key: 1 and 2 are normal moves (cooldown), 3 is the ULTIMATE (charges up), 4 is the DOMAIN (charges from ultimates).
export const FIGHTERS = {
  nova: {
    name: "Nova", title: "The Gravity Sorcerer", color: "#8b6cff", bg: ["#120d33", "#5a3fd0"],
    look: { skin: "#f3d6bd", hair: "#c9b8ff", hairStyle: "swept", coat: "#1c2140", trim: "#ffd25a", pants: "#141729", shoes: "#0b0c14", eyes: "#7fe8ff", extra: "visor" },
    moves: [
      { key: "1", name: "Pull Orb", icon: "🔵", cd: 6, desc: "A blue orb flies out and drags enemies into it" },
      { key: "2", name: "Push Burst", icon: "🔴", cd: 8, desc: "A red blast that sends enemies flying" },
      { key: "3", name: "Void Beam", icon: "🟣", ult: true, desc: "Smash red and blue together: a giant purple sphere that wipes out everything in its path" },
      { key: "4", name: "Infinite Starfield", icon: "🌌", dom: true, desc: "DOMAIN: enemies inside freeze, then crawl, and keep taking damage" },
    ],
  },
  rend: {
    name: "Rend", title: "The Crimson Demon", color: "#ff3b4e", bg: ["#2a0508", "#a3121f"],
    look: { skin: "#e9c2a6", hair: "#d8233b", hairStyle: "spikes", coat: "#18090c", trim: "#ff3b4e", pants: "#120507", shoes: "#070203", eyes: "#ff4040", extra: "horns" },
    moves: [
      { key: "1", name: "Cleave Flurry", icon: "🗡️", cd: 5, desc: "Six invisible slashes in front of you" },
      { key: "2", name: "Rift Slash", icon: "🌙", cd: 7, desc: "A huge flying slash that knocks enemies away" },
      { key: "3", name: "Hellfire Arrow", icon: "🏹", ult: true, desc: "Draw a bow of fire: the arrow explodes in a firestorm" },
      { key: "4", name: "Blood Shrine", icon: "⛩️", dom: true, desc: "DOMAIN: a shrine rises and slashes never stop for anyone inside" },
    ],
  },
  rook: {
    name: "Rook", title: "The Iron Brawler", color: "#ff8a1f", bg: ["#2b1300", "#c25a00"],
    look: { skin: "#c98d64", hair: "#2b1a10", hairStyle: "buzz", coat: "#ff8a1f", trim: "#1b1b1b", pants: "#23242b", shoes: "#111111", eyes: "#ffe08a", extra: "wraps", wide: 1.18 },
    moves: [
      { key: "1", name: "Rush Punch", icon: "👊", cd: 5, desc: "Dash in with a punch. Sometimes it SPARKS for 2.5x damage" },
      { key: "2", name: "Quake Slam", icon: "💥", cd: 8, desc: "Slam the ground: a shockwave launches everyone near you" },
      { key: "3", name: "Meteor Drop", icon: "☄️", ult: true, desc: "Leap into the sky and crash down like a meteor" },
      { key: "4", name: "Titan Awakening", icon: "🗿", dom: true, desc: "AWAKEN: grow huge, hit harder and take less damage" },
    ],
  },
  shade: {
    name: "Shade", title: "The Shadow Summoner", color: "#3fe0b0", bg: ["#04120e", "#127a5c"],
    look: { skin: "#efd0b5", hair: "#121418", hairStyle: "spikes2", coat: "#10161a", trim: "#3fe0b0", pants: "#0c1013", shoes: "#050708", eyes: "#3fe0b0", extra: "scarf" },
    moves: [
      { key: "1", name: "Shadow Hounds", icon: "🐺", cd: 7, desc: "Two shadow wolves hunt down the nearest enemy" },
      { key: "2", name: "Shadow Step", icon: "👤", cd: 6, desc: "Sink into the shadows and kick an enemy from behind" },
      { key: "3", name: "Great Serpent", icon: "🐍", ult: true, desc: "A giant shadow serpent bursts out of the ground under them" },
      { key: "4", name: "Shadow Garden", icon: "🌑", dom: true, desc: "DOMAIN: the floor turns to shadow, tendrils grab enemies, your moves recharge twice as fast" },
    ],
  },
};
export const FIGHTER_IDS = Object.keys(FIGHTERS);

// ---------------------------------------------------------------- looks (cel shading + outlines, like an anime)
let ramp = null;
function toonRamp() {
  if (ramp) return ramp;
  const d = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  return ramp;
}
const mats = new Map();
export function toon(color, glow) {
  const k = color + (glow ? "!" : "");
  if (!mats.has(k)) mats.set(k, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() }));
  return mats.get(k);
}
const INK = new THREE.MeshBasicMaterial({ color: 0x07070a, side: THREE.BackSide });
// a shape with a black outline around it
function part(parent, geo, color, x, y, z, glow, outline = 0.06) {
  const m = new THREE.Mesh(geo, toon(color, glow));
  m.position.set(x, y, z); m.castShadow = true;
  if (outline && !glow) { const o = new THREE.Mesh(geo, INK); o.scale.setScalar(1 + outline); m.add(o); }
  parent.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// The fighter: root at the feet (turn it with rotation.y), body at the hips (tips over when knocked flying).
export function buildFighter(id) {
  const F = FIGHTERS[id] || FIGHTERS.nova, L = F.look, W = L.wide || 1;
  const root = new THREE.Group(), body = pivot(root, 0, 2.3, 0);
  const torso = pivot(body, 0, 0, 0);
  part(torso, box(1.15 * W, 0.7, 0.75), L.pants, 0, 0.1, 0); // hips
  part(torso, box(1.5 * W, 1.6, 0.85), L.coat, 0, 1.15, 0); // chest
  part(torso, box(1.52 * W, 0.18, 0.87), L.trim, 0, 0.42, 0, false, 0.02); // belt
  if (L.extra !== "wraps") part(torso, box(0.18, 1.3, 0.05), L.trim, 0, 1.15, 0.44, false, 0); // zip
  if (id === "nova") { part(torso, box(1.6, 0.5, 0.95), L.coat, 0, 2.0, 0); part(torso, box(1.62, 0.08, 0.97), L.trim, 0, 2.2, 0, false, 0); } // high collar
  if (L.extra === "scarf") { part(torso, box(1.35, 0.4, 1.0), L.trim, 0, 1.95, 0); part(torso, box(0.35, 1.1, 0.12), L.trim, 0.35, 1.3, -0.5).rotation.x = 0.2; }
  if (id === "rend") for (const s of [-1, 1]) { const p = part(torso, box(0.7, 0.35, 0.9), "#2a0c10", s * 0.95, 1.9, 0); p.rotation.z = s * -0.35; part(p, new THREE.ConeGeometry(0.12, 0.45, 5), "#ff3b4e", 0, 0.3, 0, true); }
  // coat tails
  if (id !== "rook") for (const s of [-1, 1]) part(torso, box(0.62 * W, 1.3, 0.12), L.coat, s * 0.38, -0.55, -0.38).rotation.x = 0.12;
  // head
  const neck = pivot(torso, 0, 2.0, 0);
  const head = pivot(neck, 0, 0.62, 0);
  part(head, box(1.0, 1.08, 0.95), L.skin, 0, 0, 0);
  const eyeM = toon(L.eyes, true);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(box(0.2, 0.12, 0.05), eyeM); e.position.set(s * 0.22, 0.04, 0.48); head.add(e); }
  part(head, box(0.32, 0.05, 0.04), "#3a2018", 0, -0.28, 0.48, false, 0); // mouth
  if (L.extra === "visor") { const v = new THREE.Mesh(box(1.04, 0.22, 0.1), toon("#7fe8ff", true)); v.position.set(0, 0.06, 0.47); head.add(v); }
  if (id === "rend") { for (const s of [-1, 1]) { part(head, box(0.06, 0.32, 0.03), "#120406", s * 0.4, -0.05, 0.48, false, 0); } part(head, box(0.5, 0.05, 0.03), "#120406", 0, 0.3, 0.48, false, 0); }
  // hair
  const H = L.hair, hairTop = part(head, box(1.1, 0.35, 1.05), H, 0, 0.6, -0.02);
  if (L.hairStyle === "buzz") { hairTop.scale.set(1, 0.6, 1); hairTop.position.y = 0.52; }
  else {
    part(head, box(1.1, 0.75, 0.3), H, 0, 0.2, -0.42); // back
    for (const s of [-1, 1]) part(head, box(0.15, 0.55, 0.9), H, s * 0.55, 0.3, -0.05, false, 0.03);
    const spikes = L.hairStyle === "swept" ? [[-0.3, 0.85, 0.2, 0.6], [0, 0.95, 0.25, 0.3], [0.32, 0.88, 0.15, -0.2], [0, 0.8, -0.35, 0]] :
      L.hairStyle === "spikes" ? [[-0.38, 0.95, 0, 0.5], [-0.12, 1.08, 0.1, 0.15], [0.14, 1.05, 0, -0.15], [0.4, 0.92, -0.05, -0.5], [0, 0.95, -0.35, 0]] :
      [[-0.4, 0.98, 0.05, 0.7], [-0.15, 1.12, -0.1, 0.25], [0.15, 1.1, 0.05, -0.25], [0.42, 0.95, -0.1, -0.7], [0, 1.0, -0.4, 0], [0.25, 0.85, 0.35, -0.4]];
    for (const [x, y, z, r] of spikes) { const c = part(head, new THREE.ConeGeometry(0.28, 0.75, 4), H, x, y, z, false, 0.04); c.rotation.z = r; }
    if (L.hairStyle === "swept") { const f = part(head, box(1.0, 0.25, 0.25), H, 0.12, 0.5, 0.45); f.rotation.z = -0.25; }
  }
  if (L.extra === "horns") for (const s of [-1, 1]) { const h = part(head, new THREE.ConeGeometry(0.12, 0.6, 6), "#f2e6d0", s * 0.42, 0.9, 0.1); h.rotation.z = s * -0.5; }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(torso, s * (0.95 * W), 1.75, 0);
    part(a, box(0.5 * W, 1.0, 0.5), L.coat, 0, -0.45, 0); // upper arm
    const fore = pivot(a, 0, -0.95, 0);
    part(fore, box(0.46 * W, 0.9, 0.46), L.extra === "wraps" ? L.skin : L.coat, 0, -0.4, 0);
    part(fore, box(0.5 * W, 0.42, 0.5), L.extra === "wraps" ? "#c8202a" : L.skin, 0, -0.95, 0); // hand
    if (L.extra === "wraps") part(a, box(0.52 * W, 0.12, 0.52), L.trim, 0, -0.05, 0, false, 0);
    arms.push({ a, fore });
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, s * 0.33 * W, -0.15, 0);
    part(l, box(0.55 * W, 1.1, 0.6), L.pants, 0, -0.5, 0);
    const shin = pivot(l, 0, -1.05, 0);
    part(shin, box(0.5 * W, 0.95, 0.55), L.pants, 0, -0.4, 0);
    part(shin, box(0.58 * W, 0.3, 0.85), L.shoes, 0, -0.95, 0.12);
    legs.push({ l, shin });
  }
  root.userData = { id, body, torso, neck, head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], t: Math.random() * 10, tilt: new THREE.Euler(), spin: 0 };
  return root;
}

// ---------------------------------------------------------------- moving (called every frame)
// st = {mode: idle | run | air | block | dash | rag | dead, speed, punch: 0..1 progress, side, pose: cast pose, poseT}
const lerp = (a, b, k) => a + (b - a) * k;
function set(o, x, y, z, k) { o.rotation.x = lerp(o.rotation.x, x, k); o.rotation.y = lerp(o.rotation.y, y, k); o.rotation.z = lerp(o.rotation.z, z, k); }
export function animateFighter(g, st, dt) {
  const U = g.userData, k = Math.min(1, dt * 14);
  U.t += dt;
  const t = U.t;
  let aL = [-0.5, 0, 0.25], aR = [-0.5, 0, -0.25], fL = -1.2, fR = -1.2, lL = 0, lR = 0, sL = 0, sR = 0, lean = 0.05, twist = 0, headX = 0, bodyY = 2.3;
  const run = st.mode === "run" || st.mode === "dash";
  if (st.mode === "idle") { const b = Math.sin(t * 2.4) * 0.05; aL = [-0.7 + b, 0.3, 0.3]; aR = [-0.9 - b, -0.3, -0.3]; fL = fR = -1.6; lL = 0.25; lR = -0.25; sL = 0.3; sR = 0.1; bodyY = 2.22 + b * 0.5; }
  if (run) {
    const sp = st.mode === "dash" ? 0 : Math.min(1.2, st.speed / 16), w = Math.sin(t * 13) * sp;
    lL = w * 1.1; lR = -w * 1.1; sL = Math.max(0, -w) * 1.4 + 0.15; sR = Math.max(0, w) * 1.4 + 0.15;
    aL = [-w * 0.9 + 0.2, 0, 0.2]; aR = [w * 0.9 + 0.2, 0, -0.2]; fL = fR = -0.9; lean = 0.25; bodyY = 2.3 + Math.abs(Math.cos(t * 13)) * 0.12 * sp;
    if (st.mode === "dash") { aL = [1.1, 0, 0.5]; aR = [1.1, 0, -0.5]; fL = fR = -0.2; lL = -0.6; lR = 0.8; sL = 1.4; sR = 0.4; lean = 0.6; }
  }
  if (st.mode === "air") { aL = [-2.4, 0, 0.6]; aR = [-2.4, 0, -0.6]; fL = fR = -0.6; lL = -0.8; lR = 0.1; sL = 1.6; sR = 0.6; }
  if (st.mode === "block") { aL = [-1.5, 0.6, 0.2]; aR = [-1.5, -0.6, -0.2]; fL = fR = -2.2; lL = 0.3; lR = -0.3; sL = sR = 0.4; lean = 0.15; bodyY = 2.15; }
  // a punch (0..1): the arm shoots forward then comes back
  if (st.punch > 0) {
    const p = Math.sin(Math.min(1, st.punch) * Math.PI), side = st.side || 0;
    const arm = [-1.55 * p - 0.5 * (1 - p), side ? -0.3 : 0.3, 0];
    if (side) { aR = arm; fR = -1.6 * (1 - p); } else { aL = arm; fL = -1.6 * (1 - p); }
    twist = (side ? 0.5 : -0.5) * p; lean = 0.2;
    if (st.kick) { lR = -1.6 * p; sR = 0.2; twist = 0.3 * p; }
  }
  // a cast pose
  if (st.pose) {
    const P = st.pose;
    if (P === "point") { aR = [-1.6, 0, 0]; fR = 0; }
    else if (P === "both") { aL = [-1.55, -0.25, 0]; aR = [-1.55, 0.25, 0]; fL = fR = -0.1; lean = 0.15; }
    else if (P === "up") { aL = [-2.9, 0, 0.3]; aR = [-2.9, 0, -0.3]; fL = fR = -0.2; headX = -0.4; }
    else if (P === "charge") { aL = [-1.2, 0.9, 0.9]; aR = [-1.2, -0.9, -0.9]; fL = fR = -1.2; lean = -0.1; }
    else if (P === "sweep") { const s = Math.sin(t * 30); aR = [-1.5, s * 1.2, -0.3]; aL = [-1.5, -s * 1.2, 0.3]; fL = fR = -0.3; twist = s * 0.4; }
    else if (P === "bow") { aL = [-1.57, 0, 0]; fL = 0; aR = [-1.57, -0.9, 0]; fR = -2.4; twist = 0.6; }
    else if (P === "slam") { aL = [-3, 0, 0.2]; aR = [-3, 0, -0.2]; fL = fR = -0.3; sL = sR = 1.2; lL = lR = -0.9; bodyY = 1.9; lean = 0.5; }
    else if (P === "flex") { aL = [-0.2, 0, 1.5]; aR = [-0.2, 0, -1.5]; fL = fR = -2.2; headX = -0.25; }
    else if (P === "sign") { aL = [-1.4, 0.5, 0.4]; aR = [-1.4, -0.5, -0.4]; fL = fR = -1.9; headX = -0.15; }
  }
  set(U.armL.a, aL[0], aL[1], aL[2], k); set(U.armR.a, aR[0], aR[1], aR[2], k);
  U.armL.fore.rotation.x = lerp(U.armL.fore.rotation.x, fL < -0.1 ? fL * 0.6 : fL, k); U.armR.fore.rotation.x = lerp(U.armR.fore.rotation.x, fR < -0.1 ? fR * 0.6 : fR, k);
  U.legL.l.rotation.x = lerp(U.legL.l.rotation.x, -lL, k); U.legR.l.rotation.x = lerp(U.legR.l.rotation.x, -lR, k);
  U.legL.shin.rotation.x = lerp(U.legL.shin.rotation.x, sL, k); U.legR.shin.rotation.x = lerp(U.legR.shin.rotation.x, sR, k);
  U.neck.rotation.x = lerp(U.neck.rotation.x, headX, k);
  // knocked flying (ragdoll): the body tumbles and the arms and legs flop around
  if (st.mode === "rag" || st.mode === "dead") {
    U.spin += dt * (st.mode === "rag" ? (st.speed > 4 ? 9 : 2) : 0);
    const flat = st.mode === "dead" || st.low;
    U.body.rotation.x = flat ? lerp(U.body.rotation.x, -Math.PI / 2, Math.min(1, dt * 8)) : -U.spin;
    U.body.rotation.z = lerp(U.body.rotation.z, st.mode === "dead" ? 0 : Math.sin(t * 7) * 0.5, k);
    U.body.position.y = lerp(U.body.position.y, flat ? 0.55 : 2.0, Math.min(1, dt * 8));
    const f = (n) => Math.sin(t * (st.mode === "dead" ? 0 : 11) + n) * 0.9;
    set(U.armL.a, -2 + f(1), 0.4, 1.2 + f(2) * 0.5, k); set(U.armR.a, -2 + f(3), -0.4, -1.2 + f(4) * 0.5, k);
    U.legL.l.rotation.x = lerp(U.legL.l.rotation.x, f(5) * 0.6 - 0.3, k); U.legR.l.rotation.x = lerp(U.legR.l.rotation.x, f(6) * 0.6 + 0.2, k);
    U.legL.shin.rotation.x = lerp(U.legL.shin.rotation.x, 0.6 + f(7) * 0.4, k); U.legR.shin.rotation.x = lerp(U.legR.shin.rotation.x, 0.3, k);
    return;
  }
  U.spin = 0;
  U.body.rotation.x = lerp(U.body.rotation.x, lean, k);
  U.body.rotation.z = lerp(U.body.rotation.z, 0, k);
  U.body.position.y = lerp(U.body.position.y, bodyY, k);
  U.torso.rotation.y = lerp(U.torso.rotation.y, twist, k);
}

// A picture of a fighter for the select screen (rendered once, in a cool pose, on their colors).
export function fighterPicture(id, w, h) {
  const F = FIGHTERS[id];
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(w, h, false); r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight(F.color, 3); rim.position.set(-4, 3, -5); scene.add(rim);
  const g = buildFighter(id);
  g.rotation.y = 0.45;
  const pose = { nova: "point", rend: "sweep", rook: "flex", shade: "sign" }[id];
  for (let i = 0; i < 40; i++) animateFighter(g, { mode: "idle", speed: 0, pose }, 0.05);
  scene.add(g);
  const cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
  cam.position.set(0.6, 3.6, 11); cam.lookAt(0, 3.0, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  r.dispose(); r.forceContextLoss();
  return url;
}
