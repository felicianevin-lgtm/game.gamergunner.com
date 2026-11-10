// CLASH fighters: four original sorcerers (made for GunnerVerse), their looks (built from simple shapes, cel shaded with
// black outlines) and their moves. The moves themselves happen in moves.js; this file is what they are and how they move.
import * as THREE from "/create/vendor/three.module.js";

// key: 1-4 are normal moves (cooldowns), R is the ULTIMATE (charges up), G is the DOMAIN EXPANSION (charges from ultimates).
export const FIGHTERS = {
  nova: {
    name: "Nova", title: "The Gravity Sorcerer", color: "#8b6cff", bg: ["#120d33", "#5a3fd0"],
    look: { skin: "#f3d6bd", hair: "#c9b8ff", hairStyle: "swept", coat: "#1c2140", trim: "#ffd25a", pants: "#141729", shoes: "#0b0c14", eyes: "#7fe8ff", extra: "visor" },
    moves: [
      { key: "1", name: "Blue Pull", icon: "🔵", cd: 6, desc: "Shoot BLUE: an orb that drags enemies into it" },
      { key: "2", name: "Red Push", icon: "🔴", cd: 8, desc: "Shoot RED: a blast that sends enemies flying" },
      { key: "3", name: "Blink", icon: "🌀", cd: 5, desc: "Teleport forward in a flash" },
      { key: "4", name: "Infinity Wall", icon: "♾️", cd: 14, desc: "For 2.5 seconds attacks can't touch you" },
      { key: "r", name: "Purple Void", icon: "🟣", ult: true, desc: "ULTIMATE: smash red and blue together and fire a giant purple sphere" },
      { key: "g", name: "Infinite Starfield", icon: "🌌", dom: true, desc: "DOMAIN EXPANSION: everyone inside is trapped, frozen, then slowed and hurt" },
    ],
  },
  rend: {
    name: "Rend", title: "The Crimson Demon", color: "#ff3b4e", bg: ["#2a0508", "#a3121f"],
    look: { skin: "#e9c2a6", hair: "#d8233b", hairStyle: "spikes", coat: "#18090c", trim: "#ff3b4e", pants: "#120507", shoes: "#070203", eyes: "#ff4040", extra: "horns" },
    moves: [
      { key: "1", name: "Cleave Flurry", icon: "🗡️", cd: 5, desc: "Six invisible slashes in front of you" },
      { key: "2", name: "Rift Slash", icon: "🌙", cd: 7, desc: "A huge flying slash that knocks enemies away" },
      { key: "3", name: "Demon Grab", icon: "✋", cd: 9, desc: "Grab the closest enemy and smash them into the ground" },
      { key: "4", name: "Crimson Rain", icon: "🩸", cd: 12, desc: "Slashes rain down on the area in front of you" },
      { key: "r", name: "Hellfire Arrow", icon: "🏹", ult: true, desc: "ULTIMATE: draw a bow of fire; the arrow explodes in a firestorm" },
      { key: "g", name: "Blood Shrine", icon: "⛩️", dom: true, desc: "DOMAIN EXPANSION: a shrine rises, everyone inside is trapped and slashed nonstop" },
    ],
  },
  rook: {
    name: "Rook", title: "The Iron Brawler", color: "#ff8a1f", bg: ["#2b1300", "#c25a00"],
    look: { skin: "#c98d64", hair: "#2b1a10", hairStyle: "buzz", coat: "#ff8a1f", trim: "#1b1b1b", pants: "#23242b", shoes: "#111111", eyes: "#ffe08a", extra: "wraps", wide: 1.18 },
    moves: [
      { key: "1", name: "Rush Punch", icon: "👊", cd: 5, desc: "Dash in with a punch. Sometimes it SPARKS for 2.5x damage" },
      { key: "2", name: "Quake Slam", icon: "💥", cd: 8, desc: "Slam the ground: a shockwave launches everyone near you" },
      { key: "3", name: "Rising Uppercut", icon: "⬆️", cd: 7, desc: "Launch an enemy straight into the sky" },
      { key: "4", name: "Iron Guard", icon: "🛡️", cd: 15, desc: "4 seconds: nothing knocks you down and you take half damage" },
      { key: "r", name: "Meteor Drop", icon: "☄️", ult: true, desc: "ULTIMATE: leap into the sky and crash down like a meteor" },
      { key: "g", name: "Titan Awakening", icon: "🗿", dom: true, desc: "AWAKENING: grow huge, hit harder and take less damage" },
    ],
  },
  shade: {
    name: "Shade", title: "The Shadow Summoner", color: "#3fe0b0", bg: ["#04120e", "#127a5c"],
    look: { skin: "#efd0b5", hair: "#121418", hairStyle: "spikes2", coat: "#10161a", trim: "#3fe0b0", pants: "#0c1013", shoes: "#050708", eyes: "#3fe0b0", extra: "scarf" },
    moves: [
      { key: "1", name: "Shadow Hounds", icon: "🐺", cd: 7, desc: "Two shadow wolves hunt down the nearest enemy" },
      { key: "2", name: "Shadow Step", icon: "👤", cd: 6, desc: "Sink into the shadows and kick an enemy from behind" },
      { key: "3", name: "Shadow Toad", icon: "🐸", cd: 10, desc: "A toad's tongue grabs an enemy and yanks them to you" },
      { key: "4", name: "Bat Swarm", icon: "🦇", cd: 9, desc: "A swarm of shadow bats rips through everyone in front" },
      { key: "r", name: "Great Serpent", icon: "🐍", ult: true, desc: "ULTIMATE: a giant shadow serpent bursts out of the ground under them" },
      { key: "g", name: "Shadow Garden", icon: "🌑", dom: true, desc: "DOMAIN EXPANSION: the floor turns to shadow, everyone inside is trapped, your moves recharge twice as fast" },
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

const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);
const sph = (r) => new THREE.SphereGeometry(r, 18, 14);
// The fighter: root at the feet (turn it with rotation.y), body at the hips (tips over when knocked flying).
// Round, anime-style shapes: a big head with big eyes, capsule arms and legs, coat tails that fly back when running.
export function buildFighter(id) {
  const F = FIGHTERS[id] || FIGHTERS.nova, L = F.look, W = L.wide || 1;
  const root = new THREE.Group(), body = pivot(root, 0, 2.3, 0);
  const torso = pivot(body, 0, 0, 0);
  part(torso, sph(0.62), L.pants, 0, 0.1, 0).scale.set(1.0 * W, 0.62, 0.7); // hips
  part(torso, cap(0.64, 0.55), L.coat, 0, 1.12, 0).scale.set(1.08 * W, 1, 0.66); // chest
  for (const s of [-1, 1]) part(torso, sph(0.36), L.coat, s * 0.78 * W, 1.62, 0).scale.set(1, 0.85, 0.9); // shoulders
  const belt = part(torso, new THREE.CylinderGeometry(0.66, 0.66, 0.17, 20), L.trim, 0, 0.5, 0, false, 0.02); belt.scale.set(1.04 * W, 1, 0.68);
  if (L.extra !== "wraps") part(torso, box(0.12, 1.15, 0.05), L.trim, 0, 1.12, 0.43, false, 0); // zip
  if (id === "nova") { const c = part(torso, new THREE.CylinderGeometry(0.5, 0.58, 0.55, 18, 1, true), L.coat, 0, 1.98, 0); c.material.side = THREE.DoubleSide; part(torso, new THREE.TorusGeometry(0.5, 0.05, 6, 20), L.trim, 0, 2.25, 0, false, 0).rotation.x = Math.PI / 2; }
  if (L.extra === "scarf") { part(torso, new THREE.TorusGeometry(0.42, 0.2, 8, 18), L.trim, 0, 1.92, 0).rotation.x = Math.PI / 2; }
  if (id === "rend") for (const s of [-1, 1]) { const p = part(torso, sph(0.42), "#2a0c10", s * 0.82, 1.78, 0); p.scale.set(1, 0.6, 1); for (let i = 0; i < 3; i++) { const sp = part(p, new THREE.ConeGeometry(0.1, 0.45, 6), "#ff3b4e", s * 0.15 * i - s * 0.1, 0.45, -0.1 + i * 0.1, true); sp.rotation.z = s * -0.4; } }
  if (id === "rook") part(torso, new THREE.TorusGeometry(0.56, 0.07, 6, 20), "#1b1b1b", 0, 1.55, 0, false, 0).rotation.x = Math.PI / 2;
  // coat tails (they flow back when moving)
  const tails = [];
  if (id !== "rook") for (const s of [-1, 1]) {
    const t = pivot(torso, s * 0.32, 0.45, -0.28);
    part(t, box(0.6 * W, 1.6, 0.08), L.coat, 0, -0.8, 0, false, 0.08);
    part(t, box(0.62 * W, 0.08, 0.1), L.trim, 0, -1.58, 0, false, 0);
    tails.push(t);
  }
  if (L.extra === "scarf") { const t = pivot(torso, 0.3, 1.9, -0.35); part(t, box(0.32, 1.3, 0.06), L.trim, 0, -0.65, 0, false, 0.08); tails.push(t); }
  // head: big and round, anime eyes
  const neck = pivot(torso, 0, 1.95, 0);
  part(neck, cap(0.2, 0.25), L.skin, 0, 0.15, 0, false, 0.04);
  const head = pivot(neck, 0, 0.72, 0);
  part(head, sph(0.6), L.skin, 0, 0, 0).scale.set(1, 1.04, 0.96);
  const white = toon("#ffffff", true), iris = toon(L.eyes, true), dark = toon("#120a08", true);
  if (L.extra !== "visor") for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sph(0.15), white); e.scale.set(1, 1.15, 0.35); e.position.set(s * 0.22, 0.02, 0.53); head.add(e);
    const i = new THREE.Mesh(sph(0.09), iris); i.scale.set(1, 1.3, 0.4); i.position.set(s * 0.22, 0.0, 0.58); head.add(i);
    const p = new THREE.Mesh(sph(0.04), dark); p.scale.set(1, 1.3, 0.4); p.position.set(s * 0.22, 0.0, 0.6); head.add(p);
    const b = new THREE.Mesh(box(0.26, 0.05, 0.04), dark); b.position.set(s * 0.22, 0.24, 0.55); b.rotation.z = s * (id === "rend" || id === "rook" ? 0.25 : -0.08); head.add(b);
  }
  if (L.extra === "visor") { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.24, 24, 1, true, -1.3, 2.6), toon("#7fe8ff", true)); v.position.y = 0.04; v.material.side = THREE.DoubleSide; head.add(v); }
  const mouth = new THREE.Mesh(box(0.2, 0.035, 0.03), dark); mouth.position.set(0, -0.3, 0.55); head.add(mouth);
  if (id === "rend") for (const s of [-1, 1]) { const m = new THREE.Mesh(box(0.05, 0.25, 0.03), dark); m.position.set(s * 0.42, -0.12, 0.42); m.rotation.y = s * 0.6; head.add(m); }
  // hair
  const H = L.hair;
  const cap0 = part(head, sph(0.66), H, 0, 0.22, -0.06); cap0.scale.set(1, L.hairStyle === "buzz" ? 0.62 : 0.78, 1);
  if (L.hairStyle !== "buzz") {
    part(head, sph(0.6), H, 0, -0.05, -0.18).scale.set(1.05, 0.9, 0.8); // back
    const spikes = L.hairStyle === "swept" ? [[-0.35, 0.72, 0.25, 0.7, 0.3], [-0.1, 0.85, 0.3, 0.3, 0.35], [0.2, 0.82, 0.25, -0.3, 0.3], [0.42, 0.66, 0.15, -0.8, 0.25], [0, 0.8, -0.35, 0, -0.4], [-0.3, 0.7, -0.3, 0.6, -0.4], [0.3, 0.7, -0.3, -0.6, -0.4]] :
      L.hairStyle === "spikes" ? [[-0.42, 0.75, 0.05, 0.75, 0], [-0.16, 0.92, 0.12, 0.25, 0.15], [0.14, 0.92, 0.05, -0.25, 0.1], [0.42, 0.75, 0, -0.75, 0], [0, 0.85, -0.35, 0, -0.5], [-0.3, 0.75, -0.3, 0.5, -0.5], [0.3, 0.75, -0.3, -0.5, -0.5]] :
      [[-0.45, 0.8, 0.05, 0.9, 0.1], [-0.18, 0.98, -0.05, 0.3, 0], [0.18, 0.98, 0.05, -0.3, 0.1], [0.45, 0.8, -0.05, -0.9, 0], [0, 0.9, -0.4, 0, -0.6], [0.3, 0.7, 0.35, -0.5, 0.5], [-0.32, 0.75, -0.35, 0.6, -0.5], [0.32, 0.75, -0.35, -0.6, -0.5]];
    for (const [x, y, z, rz, rx] of spikes) { const c = part(head, new THREE.ConeGeometry(0.24, 0.85, 6), H, x, y, z, false, 0.05); c.rotation.set(rx, 0, rz); }
    // bangs over the forehead
    for (const s of [-1, 0, 1]) { const b = part(head, new THREE.ConeGeometry(0.15, 0.5, 5), H, s * 0.22, 0.32, 0.5, false, 0.05); b.rotation.set(2.6, 0, s * 0.3); }
  }
  if (L.extra === "horns") for (const s of [-1, 1]) { const h = part(head, new THREE.ConeGeometry(0.11, 0.65, 8), "#f2e6d0", s * 0.42, 0.72, 0.1); h.rotation.z = s * -0.55; }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(torso, s * (0.86 * W), 1.6, 0);
    part(a, cap(0.21 * W, 0.55), L.coat, 0, -0.45, 0);
    const fore = pivot(a, 0, -0.92, 0);
    part(fore, cap(0.19 * W, 0.5), L.extra === "wraps" ? L.skin : L.coat, 0, -0.38, 0);
    part(fore, new THREE.CylinderGeometry(0.22 * W, 0.22 * W, 0.1, 14), L.trim, 0, -0.62, 0, false, 0); // cuff
    part(fore, sph(0.24 * W), L.extra === "wraps" ? "#c8202a" : L.skin, 0, -0.88, 0); // fist
    arms.push({ a, fore });
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const l = pivot(body, s * 0.3 * W, -0.12, 0);
    part(l, cap(0.26 * W, 0.6), L.pants, 0, -0.5, 0);
    const shin = pivot(l, 0, -1.02, 0);
    part(shin, cap(0.23 * W, 0.55), L.pants, 0, -0.4, 0);
    const shoe = part(shin, cap(0.22 * W, 0.4), L.shoes, 0, -0.93, 0.12); shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.1, 1, 0.75);
    legs.push({ l, shin });
  }
  root.userData = { id, body, torso, neck, head, tails, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], t: Math.random() * 10, spin: 0 };
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
  const flow = st.mode === "dash" ? 1.3 : Math.min(1.1, (st.speed || 0) / 18) + (st.mode === "air" ? 0.5 : 0);
  for (const [i, tl] of (U.tails || []).entries()) tl.rotation.x = lerp(tl.rotation.x, -0.08 - flow + Math.sin(t * 9 + i) * 0.08 * (0.3 + flow), k);
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
