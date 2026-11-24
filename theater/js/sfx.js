// MOVIE THEATER: every sound is made in code with WebAudio (no sound files): punches, kicks, swooshes, booms, lasers,
// sword clangs, crowd cheers, the projector, little music loops for each movie, and cartoon voices (speech).
let ac = null, master = null, bus = null, musicBus = null, noiseBuf = null, muted = false, music = null;
try { muted = localStorage.getItem("gv_theater_mute") === "1"; } catch {}
export function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.75; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(master);
    bus = ac.createGain(); bus.connect(comp);
    musicBus = ac.createGain(); musicBus.gain.value = 0.18; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; try { localStorage.setItem("gv_theater_mute", m ? "1" : "0"); } catch {} if (master) master.gain.setTargetAtTime(m ? 0 : 0.75, ac.currentTime, 0.05); if (m) try { speechSynthesis.cancel(); } catch {} }
const live = () => ac && ac.state === "running" && !muted;
function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0, b = bus, attack = 0.004) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.2, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(b); o.start(t); o.stop(t + len + 0.05);
}
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, slide = 0, q = 1, b = bus) {
  const t = ac.currentTime + delay, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  n.buffer = noiseBuf; n.playbackRate.value = 0.8 + Math.random() * 0.4; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + len);
  g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(f); f.connect(g); g.connect(b); n.start(t); n.stop(t + len + 0.05);
}
const R = (a, b) => a + Math.random() * (b - a);
// sound effects by name (the movies + your own animations use these)
export const SOUNDS = {
  punch: () => { noise(0.12, 900, 1.1, "lowpass", 0, 200); tone(R(120, 160), 0.12, "sine", 50, 1.2); },
  kick: () => { noise(0.18, 600, 1.2, "lowpass", 0, 120); tone(R(80, 110), 0.2, "sine", 40, 1.4); },
  slap: () => { noise(0.08, 3000, 1.0, "highpass"); tone(900, 0.04, "square", 400, 0.3); },
  whoosh: () => noise(0.32, 500, 0.8, "bandpass", 0, 2600, 2),
  swing: () => noise(0.22, 2200, 0.7, "bandpass", 0, 600, 3),
  jump: () => tone(260, 0.22, "square", 720, 0.35),
  land: () => { noise(0.2, 300, 0.9); tone(70, 0.18, "sine", 40, 1); },
  boom: () => { noise(1.1, 900, 1.6, "lowpass", 0, 60); tone(70, 0.9, "sine", 25, 1.6); noise(0.25, 4000, 0.6, "highpass"); },
  bigboom: () => { noise(1.8, 1200, 2, "lowpass", 0, 40); tone(55, 1.6, "sine", 18, 2); tone(110, 0.6, "sawtooth", 30, 0.6); },
  laser: () => { tone(1800, 0.28, "sawtooth", 200, 0.55); tone(1200, 0.28, "square", 150, 0.25); },
  zap: () => { for (let i = 0; i < 5; i++) tone(R(600, 2400), 0.05, "square", 0, 0.35, i * 0.04); noise(0.2, 5000, 0.4, "highpass"); },
  clang: () => { tone(1240, 0.6, "triangle", 0, 0.7); tone(1870, 0.45, "triangle", 0, 0.45); tone(2650, 0.3, "sine", 0, 0.3); noise(0.06, 6000, 0.6, "highpass"); },
  saber: () => { tone(110, 0.5, "sawtooth", 140, 0.4); tone(220, 0.5, "sawtooth", 260, 0.25); },
  fire: () => noise(0.9, 700, 1.1, "lowpass", 0, 2400, 0.7),
  roar: () => { tone(90, 1.1, "sawtooth", 60, 1.1); noise(1.0, 500, 0.9, "lowpass", 0, 200); tone(140, 0.9, "square", 70, 0.4); },
  bonk: () => { tone(620, 0.16, "sine", 200, 0.9); noise(0.05, 2000, 0.5); },
  boing: () => { tone(180, 0.45, "sine", 520, 0.7); tone(240, 0.45, "triangle", 120, 0.3, 0.12); },
  splat: () => { noise(0.25, 700, 1, "lowpass", 0, 150); tone(200, 0.12, "sine", 80, 0.6); },
  ding: () => { tone(1568, 0.8, "triangle", 0, 0.7); tone(2093, 0.6, "sine", 0, 0.35, 0.05); },
  bell: () => { for (let i = 0; i < 3; i++) { tone(880, 0.5, "triangle", 0, 0.7, i * 0.25); tone(1320, 0.4, "sine", 0, 0.3, i * 0.25); } },
  cheer: () => { for (let i = 0; i < 4; i++) noise(1.4, R(900, 1600), 0.5, "bandpass", i * 0.08, 0, 1.5); for (let i = 0; i < 6; i++) tone(R(500, 900), 0.15, "triangle", 0, 0.12, R(0, 1)); },
  gasp: () => noise(0.5, 1500, 0.6, "bandpass", 0, 900, 2),
  laugh: () => { for (let i = 0; i < 6; i++) tone(R(260, 340), 0.1, "square", 0, 0.25, i * 0.13); },
  crowdlaugh: () => { for (let i = 0; i < 14; i++) tone(R(180, 420), 0.1, "triangle", 0, 0.12, R(0, 1.3)); noise(1.3, 1100, 0.25, "bandpass"); },
  sparkle: () => { for (let i = 0; i < 6; i++) tone(R(1800, 3200), 0.12, "sine", 0, 0.25, i * 0.05); },
  powerup: () => { for (let i = 0; i < 8; i++) tone(300 + i * 90, 0.12, "square", 0, 0.25, i * 0.05); },
  teleport: () => { tone(200, 0.5, "sine", 2400, 0.5); noise(0.5, 3000, 0.3, "bandpass", 0, 300); },
  thud: () => { tone(60, 0.35, "sine", 30, 1.4); noise(0.3, 250, 0.9); },
  crash: () => { noise(0.8, 3500, 1.2, "highpass", 0, 800); for (let i = 0; i < 5; i++) tone(R(1500, 3500), 0.15, "triangle", 0, 0.25, R(0, 0.3)); },
  gong: () => { tone(98, 2.5, "sine", 0, 1.1); tone(196, 2, "triangle", 0, 0.4); tone(262, 1.6, "sine", 0, 0.3); },
  ko: () => { tone(400, 0.8, "sawtooth", 60, 0.7); noise(0.5, 900, 0.6, "lowpass", 0, 100); },
  ticktock: () => { tone(1100, 0.04, "square", 0, 0.3); },
  projector: () => { for (let i = 0; i < 10; i++) noise(0.03, 2600, 0.18, "bandpass", i * 0.07, 0, 3); },
  beep: () => tone(880, 0.12, "square", 0, 0.4),
  horn: () => { tone(330, 0.5, "sawtooth", 0, 0.5); tone(415, 0.5, "sawtooth", 0, 0.4); },
};
export function sfx(name) { if (!live() || !SOUNDS[name]) return; try { SOUNDS[name](); } catch {} }
// talking: a cartoon voice reads the line (pitch + speed set per character)
export function say(text, pitch = 1, rate = 1.05) {
  if (muted || !("speechSynthesis" in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = rate; u.volume = 0.9; speechSynthesis.speak(u); } catch {}
}
export function hush() { try { speechSynthesis.cancel(); } catch {} }
// a little music loop per movie: notes (semitones from the root), a beat, a tempo
const STYLES = {
  action: { root: 110, bpm: 150, bass: [0, 0, 7, 0, 5, 0, 3, 5], lead: [12, null, 15, 12, null, 19, 17, 15], drum: "kxsxkksx" },
  space: { root: 98, bpm: 120, bass: [0, null, 0, 7, null, 7, 5, 3], lead: [24, 22, 19, null, 17, 19, null, 15], drum: "k.s.k.s." },
  western: { root: 131, bpm: 132, bass: [0, 7, 0, 7, 5, 12, 5, 12], lead: [12, 14, 16, 19, null, 16, 14, null], drum: "k.skk.s." },
  epic: { root: 87, bpm: 100, bass: [0, 0, 0, 0, 8, 8, 10, 10], lead: [12, null, 15, null, 20, 19, 15, null], drum: "k..sk.ss" },
  funky: { root: 123, bpm: 118, bass: [0, null, 12, 0, 10, null, 7, 5], lead: [null, 19, null, 22, 24, null, 19, null], drum: "kxsxkxsx" },
  kitchen: { root: 147, bpm: 140, bass: [0, 4, 7, 4, 5, 9, 7, 4], lead: [12, 16, 19, 16, 17, 21, 19, null], drum: "k.s.kks." },
  spooky: { root: 92, bpm: 96, bass: [0, null, 1, null, 0, null, 6, null], lead: [12, 13, null, 18, 17, null, 13, 12], drum: "k...s..." },
};
export function playMusic(style) {
  stopMusic(); if (!ac || !STYLES[style]) return;
  const S = STYLES[style], step = 60 / S.bpm / 2; let i = 0, next = ac.currentTime + 0.1;
  const tick = () => {
    if (!music) return;
    while (next < ac.currentTime + 0.3) {
      const k = i % 8, t = next - ac.currentTime;
      if (!muted) {
        const b = S.bass[k]; if (b !== null) tone(S.root * Math.pow(2, b / 12), step * 0.9, "triangle", 0, 1.6, t, musicBus);
        const l = S.lead[(k + Math.floor(i / 8) * 3) % 8]; if (l !== null && i % 16 >= 8) tone(S.root * Math.pow(2, l / 12), step * 0.8, "square", 0, 0.7, t, musicBus);
        const d = S.drum[k]; if (d === "k") { tone(110, 0.12, "sine", 40, 2.2, t, musicBus); } else if (d === "s") noise(0.12, 2500, 1.1, "highpass", t, 0, 1, musicBus); else if (d === "x") noise(0.04, 7000, 0.5, "highpass", t, 0, 1, musicBus);
      }
      i++; next += step;
    }
  };
  music = setInterval(tick, 80); tick();
}
export function stopMusic() { if (music) clearInterval(music); music = null; }
