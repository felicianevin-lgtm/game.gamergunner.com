// LAVA TOWER sounds: every sound is made in code with WebAudio (no sound files).
let ac = null, master = null, sfxBus = null, musicBus = null, muted = false, armed = false;
try { muted = localStorage.getItem("gv_lava_mute") === "1"; } catch {}

function audio() {
  if (!armed) return null; // (browsers only allow sound after a click or key press)
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    } catch { ac = null; return null; }
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
export function unlock() { armed = true; audio(); }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("gv_lava_mute", m ? "1" : "0"); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.05);
}

function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0, bus = null) {
  const a = audio(); if (!a) return;
  try {
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + len + 0.05);
  } catch {}
}
let noiseBuf = null;
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, q = 1, sweep = 0, bus = null) {
  const a = audio(); if (!a) return;
  try {
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = a.currentTime + delay, n = a.createBufferSource(); n.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + len);
    const g = a.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(bus || sfxBus); n.start(t, Math.random()); n.stop(t + len + 0.05);
  } catch {}
}

export const SFX = {
  jump: () => { tone(330, 0.14, "square", 660, 0.35); },
  land: () => noise(0.08, 900, 0.35),
  step: () => noise(0.04, 1400, 0.12, "bandpass", 0, 2),
  coin: () => { tone(988, 0.08, "square", 0, 0.35); tone(1319, 0.22, "square", 0, 0.35, 0.07); },
  bounce: () => { tone(180, 0.35, "sine", 900, 0.9); tone(360, 0.3, "triangle", 1400, 0.4); },
  checkpoint: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.5 : 0.16, "square", 0, 0.38, i * 0.1)),
  hit: () => { noise(0.2, 600, 0.7); tone(220, 0.2, "sawtooth", 90, 0.5); },
  crumble: () => noise(0.35, 400, 0.4, "lowpass", 0, 1, 120),
  hiss: () => noise(0.5, 3000 + Math.random() * 2000, 0.12, "highpass"),
  pop: () => tone(200 + Math.random() * 150, 0.09, "sine", 80, 0.25),
  death: () => { noise(1.2, 4000, 0.9, "lowpass", 0, 1, 200); [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, "square", f * 0.94, 0.4, 0.15 + i * 0.2)); },
  buy: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, "square", 0, 0.3, i * 0.06)),
  nope: () => tone(160, 0.2, "square", 120, 0.35),
  click: () => tone(660, 0.05, "square", 0, 0.25),
  warn: () => tone(880, 0.12, "square", 0, 0.3),
};

// ---------------------------------------------------------------- background music: a little upbeat synth loop
// C - Am - F - G, 128 bpm: bass on the beats, a bouncy arpeggio, a short melody on top. Scheduled a bit ahead.
const BPM = 128, S16 = 60 / BPM / 4;
const CHORDS = [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]];
const MELODY = [72, -1, 76, -1, 79, -1, 76, 74, 72, -1, 69, -1, 72, -1, -1, -1, 72, -1, 69, -1, 65, -1, 69, 72, 74, -1, 71, -1, 67, -1, -1, -1,
  76, -1, 79, -1, 84, -1, 79, 76, 77, -1, 76, -1, 74, -1, 72, -1, 69, -1, 72, -1, 77, -1, 76, 74, 74, -1, 72, -1, 71, -1, 74, -1];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
let musicOn = false, step = 0, nextT = 0, timer = null, intensity = 0;
export function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }
function schedule() {
  const a = audio(); if (!a || !musicOn) return;
  while (nextT < a.currentTime + 0.15) {
    const bar = Math.floor(step / 16) % 4, s = step % 16, ch = CHORDS[bar];
    if (s % 4 === 0) tone(midi(ch[0] - 12), S16 * 3, "triangle", 0, 1.2, nextT - a.currentTime, musicBus);
    if (s % 4 === 2) tone(midi(ch[0]), S16 * 1.5, "triangle", 0, 0.7, nextT - a.currentTime, musicBus);
    tone(midi(ch[1 + (s % 4)] + 12), S16 * 0.9, "square", 0, 0.16 + intensity * 0.08, nextT - a.currentTime, musicBus);
    const m = MELODY[step % MELODY.length];
    if (m > 0) tone(midi(m), S16 * 1.8, "square", 0, 0.32, nextT - a.currentTime, musicBus);
    if (s % 4 === 0) noise(0.05, 120, 1.6, "lowpass", nextT - a.currentTime, 1, 0, musicBus);       // kick-ish thump
    if (s % 8 === 4) noise(0.12, 2500, 0.7, "bandpass", nextT - a.currentTime, 0.7, 0, musicBus); // snare-ish
    if (s % 2 === 1) noise(0.03, 8000, 0.3, "highpass", nextT - a.currentTime, 1, 0, musicBus);     // hat
    nextT += S16 * (1 - intensity * 0.12); step++;
  }
}
export function music(on) {
  if (on === musicOn) return;
  musicOn = on;
  const a = audio();
  if (on && a) { nextT = a.currentTime + 0.05; step = 0; timer = setInterval(schedule, 50); schedule(); }
  else if (timer) { clearInterval(timer); timer = null; }
}
